// The vault's logs, in hyperswitch-web's structure (HyperLoggerTypes, HyperLogger,
// LoggerUtils.logApi, Utils.fetchApiWithLogging): the same record, event names and API values, queued
// and sent as one batch. Only the vault's own API calls are logged: never a request body, never a
// card value.

type logType = INFO | ERROR

type logCategory = API

type apiLogType = Request | Response | NoResponse | Err

// CONFIRM_CALL is the payment confirm on web, which saving a card is not.
type eventName =
  | PAYMENT_METHOD_SESSION_CONFIRM_CALL_INIT
  | PAYMENT_METHOD_SESSION_CONFIRM_CALL
  | PAYMENT_METHOD_SESSION_UPDATE_CALL_INIT
  | PAYMENT_METHOD_SESSION_UPDATE_CALL

// As LoggerUtils.apiEventInitMapper.
let apiEventInitMapper = (eventName: eventName): option<eventName> =>
  switch eventName {
  | PAYMENT_METHOD_SESSION_CONFIRM_CALL => Some(PAYMENT_METHOD_SESSION_CONFIRM_CALL_INIT)
  | PAYMENT_METHOD_SESSION_UPDATE_CALL => Some(PAYMENT_METHOD_SESSION_UPDATE_CALL_INIT)
  | _ => None
  }

type logFile = {
  timestamp: string,
  logType: logType,
  category: logCategory,
  value: string,
  sessionId: string,
  merchantId: string,
  paymentId: string,
  platform: string,
  eventName: eventName,
  latency: string,
  firstEvent: bool,
}

// HyperLogger.logFileToObj, with the values web reads from the browser filled in for React Native:
// the component, the platform from Platform.OS, and web's own defaults for an unknown browser.
let logFileToObj = (logFile: logFile) =>
  [
    ("timestamp", logFile.timestamp->JSON.Encode.string),
    (
      "log_type",
      switch logFile.logType {
      | INFO => "INFO"
      | ERROR => "ERROR"
      }->JSON.Encode.string,
    ),
    ("component", "MOBILE"->JSON.Encode.string),
    (
      "category",
      switch logFile.category {
      | API => "API"
      }->JSON.Encode.string,
    ),
    ("source", "HYPER_VAULT"->JSON.Encode.string),
    ("version", VaultVersion.version->JSON.Encode.string),
    ("value", logFile.value->JSON.Encode.string),
    ("session_id", logFile.sessionId->JSON.Encode.string),
    ("merchant_id", logFile.merchantId->JSON.Encode.string),
    ("payment_id", logFile.paymentId->JSON.Encode.string),
    ("app_id", ""->JSON.Encode.string),
    ("platform", logFile.platform->String.toUpperCase->JSON.Encode.string),
    ("user_agent", ""->JSON.Encode.string),
    ("event_name", (logFile.eventName :> string)->JSON.Encode.string),
    ("browser_name", "OTHERS"->JSON.Encode.string),
    ("browser_version", "0"->JSON.Encode.string),
    ("latency", logFile.latency->JSON.Encode.string),
    ("first_event", (logFile.firstEvent ? "true" : "false")->JSON.Encode.string),
    ("payment_method", ""->JSON.Encode.string),
  ]
  ->Dict.fromArray
  ->JSON.Encode.object

type timerId
@val external setTimeout: (unit => unit, int) => timerId = "setTimeout"
@val external clearTimeout: timerId => unit = "clearTimeout"

// One per card form, as web keeps one logger per SDK frame.
type t = {
  url: option<string>,
  sessionId: string,
  platform: string,
  events: Dict.t<float>,
  counts: Dict.t<int>,
  mainLogFile: array<logFile>,
  mutable timeOut: option<timerId>,
}

let newSessionId = () =>
  "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx"
  ->String.split("")
  ->Array.map(symbol =>
    switch symbol {
    | "x" => Math.Int.random(0, 16)->Int.toString(~radix=16)
    | "y" => (8 + Math.Int.random(0, 4))->Int.toString(~radix=16)
    | other => other
    }
  )
  ->Array.join("")

let make = (~url: option<string>, ~platform: string): t => {
  url,
  sessionId: newSessionId(),
  platform,
  events: Dict.make(),
  counts: Dict.make(),
  mainLogFile: [],
  timeOut: None,
}

type response
type requestOptions = {
  method: string,
  body: string,
}
@val external fetch: (string, requestOptions) => promise<response> = "fetch"

// web's beaconApiCall, over fetch: the batch as one JSON array, sent as text with no credentials. A
// batch that cannot be sent is dropped: logging never changes what the card form does.
let beaconApiCall = (url, logs: array<logFile>) =>
  try {
    fetch(
      url,
      {method: "POST", body: logs->Array.map(logFileToObj)->JSON.Encode.array->JSON.stringify},
    )
    ->Promise.thenResolve(_ => ())
    ->Promise.catch(_ => Promise.resolve())
    ->ignore
  } catch {
  | _ => ()
  }

// Sends everything queued. web also calls this when the page unloads; the form calls it when it
// closes and when the app leaves the foreground.
let sendLogs = (logger: t) => {
  logger.timeOut->Option.forEach(clearTimeout)
  logger.timeOut = None
  switch (logger.url, logger.mainLogFile->Array.length) {
  | (Some(url), length) if length > 0 =>
    let batch = logger.mainLogFile->Array.copy
    logger.mainLogFile->Array.splice(~start=0, ~remove=length, ~insert=[])
    beaconApiCall(url, batch)
  | _ => ()
  }
}

// As web's checkForPriorityEvents: an error goes out at once, and so does a queue of more than 8.
// None of the vault's events is on web's priority list.
let checkForPriorityEvents = (logs: array<logFile>) =>
  logs->Array.some(log => log.logType === ERROR) || logs->Array.length > 8

let checkLogSizeAndSendData = (logger: t) => {
  logger.timeOut->Option.forEach(clearTimeout)
  logger.timeOut = Some(setTimeout(() => logger->sendLogs, 20000))
  if logger.mainLogFile->checkForPriorityEvents {
    logger->sendLogs
  }
}

// web's maxLogsPushedPerEventName.
let maxLogsPushedPerEventName = 100

let conditionalLogPush = (logger: t, log: logFile) => {
  let key = (log.eventName :> string)
  let count = logger.counts->Dict.get(key)->Option.getOr(0) + 1
  logger.counts->Dict.set(key, count)
  if logger.url->Option.isSome && count <= maxLogsPushedPerEventName {
    logger.mainLogFile->Array.push(log)
  }
}

// As web's calculateLatencyHook: an API answer carries the time since its _INIT.
let calculateLatencyHook = (logger: t, ~eventName: eventName) => {
  let latency =
    logger.events
    ->Dict.get(`${(eventName :> string)}_INIT`)
    ->Option.mapOr(0., startedAt => Date.now() -. startedAt)
  latency > 0. ? latency->Float.toString : ""
}

let setLogApi = (
  logger: t,
  ~value: array<(string, JSON.t)>,
  ~eventName: eventName,
  ~logType,
  ~merchantId,
  ~paymentId,
) => {
  let key = (eventName :> string)
  let timestamp = Date.now()
  logger->conditionalLogPush({
    timestamp: timestamp->Float.toString,
    logType,
    category: API,
    value: value->Dict.fromArray->JSON.Encode.object->JSON.stringify,
    sessionId: logger.sessionId,
    merchantId,
    paymentId,
    platform: logger.platform,
    eventName,
    latency: logger->calculateLatencyHook(~eventName),
    firstEvent: logger.events->Dict.get(key)->Option.isNone,
  })
  logger->checkLogSizeAndSendData
  logger.events->Dict.set(key, timestamp)
}

// The identity every log of one API call carries.
type apiCall = {
  logger: t,
  eventName: eventName,
  url: string,
  merchantId: string,
  paymentId: string,
}

// As LoggerUtils.logApi: what each kind of API log records.
let logApi = (call: apiCall, ~eventName, ~apiLogType, ~statusCode=0, ~data=JSON.Encode.null) => {
  let url = ("url", call.url->JSON.Encode.string)
  let (value, logType) = switch apiLogType {
  | Request => ([url], INFO)
  | Response => ([url, ("statusCode", statusCode->JSON.Encode.int)], INFO)
  | NoResponse => ([url, ("statusCode", 504->JSON.Encode.int), ("response", data)], ERROR)
  | Err => ([url, ("statusCode", statusCode->JSON.Encode.int), ("response", data)], ERROR)
  }
  call.logger->setLogApi(
    ~value,
    ~eventName,
    ~logType,
    ~merchantId=call.merchantId,
    ~paymentId=call.paymentId,
  )
}

// The three points at which web's fetchApiWithLogging logs: before the request, on its answer, and
// when no answer arrives. A call without a logger logs nothing.
let callStarted = (call: option<apiCall>) =>
  call->Option.forEach(call =>
    call.eventName
    ->apiEventInitMapper
    ->Option.forEach(eventName => call->logApi(~eventName, ~apiLogType=Request))
  )

let callAnswered = (call: option<apiCall>, ~status: int, ~response: option<JSON.t>) =>
  call->Option.forEach(call =>
    if status >= 200 && status < 300 {
      call->logApi(~eventName=call.eventName, ~apiLogType=Response, ~statusCode=status)
    } else {
      call->logApi(
        ~eventName=call.eventName,
        ~apiLogType=Err,
        ~statusCode=status,
        ~data=response->Option.getOr(JSON.Encode.null),
      )
    }
  )

// The exception as web's Utils.formatException records it.
let formatException = (error: exn) =>
  switch error->Exn.asJsExn {
  | Some(jsExn) =>
    [
      ("message", jsExn->Exn.message->Option.getOr("Unknown Error")->JSON.Encode.string),
      ("type", jsExn->Exn.name->Option.getOr("Unknown")->JSON.Encode.string),
      ("stack", jsExn->Exn.stack->Option.getOr("Unknown")->JSON.Encode.string),
      ("fileName", jsExn->Exn.fileName->Option.getOr("Unknown")->JSON.Encode.string),
    ]
    ->Dict.fromArray
    ->JSON.Encode.object
  | None => JSON.Encode.null
  }

let callUnanswered = (call: option<apiCall>, ~error: exn) =>
  call->Option.forEach(call =>
    call->logApi(~eventName=call.eventName, ~apiLogType=NoResponse, ~data=error->formatException)
  )
