// The logger without React: one instance per SDK session. LoggerContext/LoggerHook wrap it
// for components; imperative APIs (payment-methods' initPaymentMethodSession, the vault's
// form machinery) hold an instance directly.

open LoggerTypes

// Logs made before the merchant's identity is known (the publishable key often arrives as a
// promise) wait here and are sent once `configure` runs.
let maxPending = 50

// A runaway render loop cannot flood the endpoint.
let maxPerEvent = 100

let inactivityMs = 2 * 60 * 1000

type entry = {
  timestamp: float,
  logType: logType,
  category: logCategory,
  eventName: eventName,
  value: string,
  internalMetadata: string,
  paymentMethod: option<string>,
  paymentExperience: option<string>,
  latency: string,
  firstEvent: bool,
}

type t = {
  mutable config: option<loggerConfig>,
  events: Dict.t<float>,
  counts: Dict.t<int>,
  mutable pending: array<entry>,
  mutable timer: option<timeoutId>,
}

let make = (): t => {
  config: None,
  events: Dict.make(),
  counts: Dict.make(),
  pending: [],
  timer: None,
}

// client-core's useCalculateLatency, generalised: a response event is timed from its _INIT.
let calculateLatency = (events: Dict.t<float>, eventName: eventName, now: float) => {
  let latency = switch eventName {
  | PAYMENT_ATTEMPT =>
    switch events->Dict.get("APP_RENDERED") {
    | Some(rendered) => now -. rendered
    | None => -1.
    }
  | _ =>
    switch getApiInitEvent(eventName) {
    | Some(initEvent) =>
      switch events->Dict.get(initEvent->LoggerUtils.eventToStrMapper) {
      | Some(started) => now -. started
      | None => 0.
      }
    | None => 0.
    }
  }
  latency > 0. ? latency->Float.toString : ""
}

let toLogFile = (config: loggerConfig, entry: entry): logFile => {
  timestamp: entry.timestamp->Float.toString,
  logType: entry.logType,
  component: MOBILE,
  category: entry.category,
  version: config.sdkVersion,
  codePushVersion: config.codePushVersion->Option.getOr(""),
  clientCoreVersion: config.clientCoreVersion->Option.getOr(""),
  value: entry.value,
  internalMetadata: entry.internalMetadata,
  sessionId: config.sessionId,
  merchantId: config.publishableKey,
  paymentId: config.paymentId->Option.getOr(""),
  appId: ?config.appId,
  platform: config->LoggerUtils.getPlatform,
  userAgent: config.userAgent->Option.getOr("userAgent"),
  eventName: entry.eventName,
  latency: entry.latency,
  firstEvent: entry.firstEvent,
  paymentMethod: entry.paymentMethod->Option.getOr(""),
  paymentExperience: ?entry.paymentExperience,
  source: config.source,
}

// Every log leaves through here, including the inactivity timer's, which no caller can guard:
// nothing in building or sending a log line may throw into the app.
let send = (config: loggerConfig, entry: entry) =>
  try {
    LoggerUtils.sendLogs(
      toLogFile(config, entry),
      LoggerUtils.getLoggingUrl(~customEndpoints=config.customEndpoints, ~environment=config.environment),
      config.publishableKey,
      config.appId,
    )
  } catch {
  | _ => ()
  }

let cancelInactivity = (logger: t) => {
  logger.timer->Option.forEach(clearTimeout)
  logger.timer = None
}

let rec record = (
  logger: t,
  ~logType,
  ~category,
  ~eventName,
  ~value,
  ~internalMetadata="",
  ~paymentMethod=?,
  ~paymentExperience=?,
  ~latency: option<float>=?,
  ~rearm=true,
  (),
) => {
  let name = eventName->LoggerUtils.eventToStrMapper
  let count = logger.counts->Dict.get(name)->Option.getOr(0)
  if count < maxPerEvent {
    logger.counts->Dict.set(name, count + 1)
    let timestamp = Date.now()
    let entry = {
      timestamp,
      logType,
      category,
      eventName,
      value,
      internalMetadata,
      paymentMethod,
      paymentExperience,
      latency: switch latency {
      | Some(latency) => latency->Float.toString
      | None => calculateLatency(logger.events, eventName, timestamp)
      },
      firstEvent: logger.events->Dict.get(name)->Option.isNone,
    }
    logger.events->Dict.set(name, timestamp)
    switch logger.config {
    | Some(config) =>
      send(config, entry)
      if rearm {
        armInactivity(logger)
      }
    | None =>
      if logger.pending->Array.length < maxPending {
        logger.pending->Array.push(entry)
      }
    }
  }
}

// client-core's snooze: one INACTIVE_SCREEN after two minutes without a log.
and armInactivity = (logger: t) => {
  cancelInactivity(logger)
  logger.timer = Some(
    setTimeout(() => {
      logger.timer = None
      record(
        logger,
        ~logType=INFO,
        ~category=USER_EVENT,
        ~eventName=INACTIVE_SCREEN,
        ~value="Inactive Screen",
        ~rearm=false,
        (),
      )
    }, inactivityMs),
  )
}

let configure = (logger: t, config: loggerConfig) => {
  logger.config = Some(config)
  let queued = logger.pending
  logger.pending = []
  queued->Array.forEach(entry => send(config, entry))
  if queued->Array.length > 0 {
    armInactivity(logger)
  }
}

// Stops the inactivity timer. The instance stays usable, so a StrictMode remount loses nothing.
let dispose = (logger: t) => cancelInactivity(logger)

let log = (logger: t, event: logEvent) =>
  record(
    logger,
    ~logType=event.logType,
    ~category=event.category,
    ~eventName=event.eventName,
    ~value=event.value,
    ~internalMetadata=?event.internalMetadata,
    ~paymentMethod=?event.paymentMethod,
    ~paymentExperience=?event.paymentExperience,
    ~latency=?event.latency,
    (),
  )

// The logger trims what it is given rather than trusting each caller to: the URL loses its
// credentials, query and hash, an error body keeps only its type and code, and a missing
// response only its fixed reason. A 2xx body is never logged.
let logApi = (logger: t, ~logType: option<logType>=?, event: apiLogEvent) => {
  let url = ("url", event.url->LoggerUtils.sanitizeUrl->JSON.Encode.string)
  let data = event.data->Option.getOr(JSON.Encode.null)
  let (defaultLogType, value, internalMetadata) = switch event.apiLogType {
  | Request => (INFO, [url], [])
  | Response => (INFO, [url, ("statusCode", event.statusCode->JSON.Encode.string)], [])
  | NoResponse =>
    let reason = data->LoggerUtils.safeFailureReason
    (
      ERROR,
      [url, ("statusCode", "504"->JSON.Encode.string), ("response", reason)],
      [("response", reason)],
    )
  | Err =>
    let error = data->LoggerUtils.safeErrorResponse
    (
      ERROR,
      [url, ("statusCode", event.statusCode->JSON.Encode.string), ("response", error)],
      [("response", error)],
    )
  }
  record(
    logger,
    ~logType=logType->Option.getOr(defaultLogType),
    ~category=API,
    ~eventName=event.eventName,
    ~value=value->Dict.fromArray->JSON.Encode.object->JSON.stringify,
    ~internalMetadata=internalMetadata->Dict.fromArray->JSON.Encode.object->JSON.stringify,
    ~paymentMethod=?event.paymentMethod,
    ~paymentExperience=?event.paymentExperience,
    ~latency=?event.latency,
    (),
  )
}

// The error name only: no message and no stack, which can quote inputs, source and arguments.
let logCrash = (logger: t, error: jsonValue) =>
  record(
    logger,
    ~logType=ERROR,
    ~category=USER_ERROR,
    ~eventName=SDK_CRASH,
    ~value=error->LoggerUtils.errorName,
    (),
  )
