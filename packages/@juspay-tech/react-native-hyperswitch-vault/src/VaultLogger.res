// The vault's logs, in hyperswitch-web's structure (HyperLoggerTypes, HyperLogger,
// LoggerUtils.logApi, Utils.fetchApiWithLogging): the same record, event names and API values,
// queued and sent as one batch. It logs the vault's own API calls, the card fields' user events,
// how the form was set up and rendered, and crashes inside it: never a request body, never a card
// value.

// As web's logType. DEBUG marks a log kept for debugging, such as how long a field took to show.
type logType = DEBUG | INFO | ERROR

type logCategory = API | USER_EVENT | USER_ERROR

type apiLogType = Request | Response | NoResponse | Err

// CONFIRM_CALL is the payment confirm on web, which saving a card is not.
type eventName =
  | PAYMENT_METHOD_SESSION_CONFIRM_CALL_INIT
  | PAYMENT_METHOD_SESSION_CONFIRM_CALL
  | PAYMENT_METHOD_SESSION_UPDATE_CALL_INIT
  | PAYMENT_METHOD_SESSION_UPDATE_CALL
  | FOCUS
  | BLUR
  | CARD_SCHEME_SELECTION
  | APP_RENDERED
  | PAYMENT_ELEMENT_OPTIONS
  | SDK_CRASH

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
// the component and the platform from Platform.OS. An app has no browser, so browser_name and
// browser_version are left out (both are nullable downstream).
let logFileToObj = (logFile: logFile) =>
  [
    ("timestamp", logFile.timestamp->JSON.Encode.string),
    (
      "log_type",
      switch logFile.logType {
      | DEBUG => "DEBUG"
      | INFO => "INFO"
      | ERROR => "ERROR"
      }->JSON.Encode.string,
    ),
    ("component", "MOBILE"->JSON.Encode.string),
    (
      "category",
      switch logFile.category {
      | API => "API"
      | USER_EVENT => "USER_EVENT"
      | USER_ERROR => "USER_ERROR"
      }->JSON.Encode.string,
    ),
    ("source", "HYPERSWITCH_VAULT"->JSON.Encode.string),
    ("version", VaultVersion.version->JSON.Encode.string),
    ("value", logFile.value->JSON.Encode.string),
    ("session_id", logFile.sessionId->JSON.Encode.string),
    ("merchant_id", logFile.merchantId->JSON.Encode.string),
    ("payment_id", logFile.paymentId->JSON.Encode.string),
    ("app_id", ""->JSON.Encode.string),
    ("platform", logFile.platform->String.toUpperCase->JSON.Encode.string),
    ("user_agent", ""->JSON.Encode.string),
    ("event_name", (logFile.eventName :> string)->JSON.Encode.string),
    ("latency", logFile.latency->JSON.Encode.string),
    ("first_event", (logFile.firstEvent ? "true" : "false")->JSON.Encode.string),
    ("payment_method", ""->JSON.Encode.string),
  ]
  ->Dict.fromArray
  ->JSON.Encode.object

type timerId
@val external setTimeout: (unit => unit, int) => timerId = "setTimeout"
@val external clearTimeout: timerId => unit = "clearTimeout"

// One per card form, as web keeps one logger per SDK frame; a new vault session starts it afresh.
type t = {
  url: option<string>,
  mutable sessionId: string,
  platform: string,
  mutable events: Dict.t<float>,
  mutable counts: Dict.t<int>,
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

// Whether the form logs anywhere: a self-hosted backend without a logging endpoint gets no logs.
let isLoggerEnabled = (logger: t) => logger.url->Option.isSome

type response
type requestOptions = {
  method: string,
  body: string,
}
@val external fetch: (string, requestOptions) => promise<response> = "fetch"

// web's beaconApiCall, over fetch: the batch as one JSON array, sent as text with no auth header. A
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
// closes, when its session changes and when the app leaves the foreground.
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

// A log session: its session_id, when each event was last logged (first_event and latency) and how
// many of each were queued (the per-event cap).
type session = {
  id: string,
  events: Dict.t<float>,
  counts: Dict.t<int>,
}

let currentSession = (logger: t) => {
  id: logger.sessionId,
  events: logger.events,
  counts: logger.counts,
}

// A new vault session on the same form, as web loads its frames afresh for each: what is queued goes
// out, then the session gets its own session_id, first_event and per-event counts. They are new
// dictionaries, so a call still in flight keeps counting in the session it started in.
let startNewSession = (logger: t) => {
  logger->sendLogs
  logger.sessionId = newSessionId()
  logger.events = Dict.make()
  logger.counts = Dict.make()
}

// As web's checkForPriorityEvents: an error goes out at once, and so does a queue of more than 8.
// Unlike web, a DEBUG log, and the first APP_RENDERED (on web's priority list), wait for the batch:
// web's DEBUG logs are failures, while the vault's are sent each time a form mounts.
let checkForPriorityEvents = (logs: array<logFile>) =>
  logs->Array.some(log => log.logType === ERROR) || logs->Array.length > 8

let checkLogSizeAndSendData = (logger: t) => {
  logger.timeOut->Option.forEach(clearTimeout)
  logger.timeOut = Some(setTimeout(() => logger->sendLogs, 20000))
  if logger.mainLogFile->checkForPriorityEvents {
    logger->sendLogs
  }
}

// As web's maxLogsPushedPerEventName.
let maxLogsPushedPerEventName = 100

let conditionalLogPush = (logger: t, log: logFile, ~counts: Dict.t<int>) => {
  let key = (log.eventName :> string)
  let count = counts->Dict.get(key)->Option.getOr(0) + 1
  counts->Dict.set(key, count)
  if count <= maxLogsPushedPerEventName {
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

// A run of twelve or more digits, the shape of a card number, with any number of spaces, line
// breaks, dots, slashes or dashes between the digits. The form's settings log blanks it. Separators
// and digits never overlap, so the match takes time in proportion to the text.
let redactDigits = (text: string) =>
  text->String.replaceRegExp(%re("/\d(?:[\s./-]*\d){11,}/g"), "[redacted]")

// An error's text as it is logged: a card-number shape is blanked as above, then every run of three
// or more digits is sent as stars, one per digit. An error code's two digits are kept.
let maskNumbers = (text: string) =>
  text
  ->redactDigits
  ->String.unsafeReplaceRegExpBy0(%re("/\d{3,}/g"), (~match, ~offset as _, ~input as _) =>
    "*"->String.repeat(match->String.length)
  )

// The fixed messages logged in place of what cannot be logged as it is.
let notJson = "The response body is not JSON"
let unrecognisedErrorBody = "The error response is not in the expected format"
let notAnError = "A value that is not an Error was thrown"
let noErrorMessage = "The error has no message"

let fixedMessage = (message: string) =>
  [("message", message->JSON.Encode.string)]->Dict.fromArray->JSON.Encode.object

// The backend's typed error: {"error": {type, code, message, reason}}.
let typedErrorFields = ["type", "code", "message", "reason"]
// The fields an error body of another shape, such as a proxy's, commonly has at its top level.
let topLevelErrorFields = [
  "message",
  "error",
  "error_code",
  "error_message",
  "code",
  "type",
  "reason",
]
let maxKeys = 10

// The named fields that are strings, each through maskNumbers.
let maskedStrings = (source: Dict.t<JSON.t>, keys: array<string>) =>
  keys->Array.filterMap(key =>
    switch source->Dict.get(key) {
    | Some(String(text)) => Some((key, text->maskNumbers->JSON.Encode.string))
    | _ => None
    }
  )

// What an API error body is logged as: the body with only known fields left, each only when it is a
// string, and every one through maskNumbers. First the backend's typed error, in its shape; failing
// that, the common top-level fields; failing that, a fixed message with the names of the body's
// top-level keys (never their values). Anything else in the body (data, payment_id, connector ids) is
// left out, and a body that is not an object is logged as the fixed message.
let errorBodyValue = (body: JSON.t): JSON.t =>
  switch body {
  | Object(body) =>
    let typed = switch body->Dict.get("error") {
    | Some(Object(error)) => error->maskedStrings(typedErrorFields)
    | _ => []
    }
    if typed->Array.length > 0 {
      [("error", typed->Dict.fromArray->JSON.Encode.object)]->Dict.fromArray->JSON.Encode.object
    } else {
      let topLevel = body->maskedStrings(topLevelErrorFields)
      if topLevel->Array.length > 0 {
        topLevel->Dict.fromArray->JSON.Encode.object
      } else {
        let keys =
          body
          ->Dict.keysToArray
          ->Array.slice(~start=0, ~end=maxKeys)
          ->Array.map(key => key->maskNumbers->JSON.Encode.string)
        keys->Array.length > 0
          ? [
              ("message", unrecognisedErrorBody->JSON.Encode.string),
              ("keys", keys->JSON.Encode.array),
            ]
            ->Dict.fromArray
            ->JSON.Encode.object
          : fixedMessage(unrecognisedErrorBody)
      }
    }
  | _ => fixedMessage(unrecognisedErrorBody)
  }

let isError: Exn.t => bool = %raw(`
  function (thrown) { try { return thrown instanceof Error; } catch (_) { return false; } }
`)

// A property of what was thrown when it is a string. A getter that throws reads as absent.
let stringProperty: (Exn.t, string) => option<string> = %raw(`
  function (thrown, key) {
    try { var value = thrown[key]; return typeof value === "string" ? value : undefined; }
    catch (_) { return undefined; }
  }
`)

// What an exception is logged as: its type and its message, both through maskNumbers; a missing or
// empty message is logged as a fixed one. Never its stack, which in a debug build carries the
// bundle's localhost or IP address URL that the log endpoint's WAF refuses. Any other value thrown
// is logged as a fixed message, since it can carry anything.
let exceptionValue = (thrown: Exn.t): JSON.t =>
  if thrown->isError {
    let type_ = switch thrown->stringProperty("name")->Option.map(String.trim) {
    | Some(name) if name !== "" => name->maskNumbers
    | _ => "Error"
    }
    let message = switch thrown->stringProperty("message")->Option.map(String.trim) {
    | Some(text) if text !== "" => text->maskNumbers
    | _ => noErrorMessage
    }
    [("type", type_->JSON.Encode.string), ("message", message->JSON.Encode.string)]
    ->Dict.fromArray
    ->JSON.Encode.object
  } else {
    fixedMessage(notAnError)
  }

let exceptionValueOf = (error: exn) =>
  error->Exn.asJsExn->Option.mapOr(fixedMessage(notAnError), exceptionValue)

let pushLog = (
  logger: t,
  ~value,
  ~eventName: eventName,
  ~logType,
  ~category,
  ~merchantId,
  ~paymentId,
  ~latency: option<float>=?,
  ~session: option<session>=?,
) =>
  if logger->isLoggerEnabled {
    let key = (eventName :> string)
    let timestamp = Date.now()
    // A log that belongs to a session the form has since left keeps that session's id, first_event
    // and counts, and leaves the current session's alone.
    let session = session->Option.getOr(logger->currentSession)
    let current = session.id === logger.sessionId
    logger->conditionalLogPush(~counts=session.counts, {
      timestamp: timestamp->Float.toString,
      logType,
      category,
      value,
      sessionId: session.id,
      merchantId,
      paymentId,
      platform: logger.platform,
      eventName,
      latency: switch latency {
      | Some(latency) => latency->Float.toString
      | None => current ? logger->calculateLatencyHook(~eventName) : ""
      },
      firstEvent: session.events->Dict.get(key)->Option.isNone,
    })
    logger->checkLogSizeAndSendData
    session.events->Dict.set(key, timestamp)
  }

let setLogApi = (
  logger: t,
  ~value: array<(string, JSON.t)>,
  ~eventName,
  ~logType,
  ~merchantId,
  ~paymentId,
  ~latency=?,
  ~session=?,
) =>
  logger->pushLog(
    ~value=value->Dict.fromArray->JSON.Encode.object->JSON.stringify,
    ~eventName,
    ~logType,
    ~category=API,
    ~merchantId,
    ~paymentId,
    ~latency?,
    ~session?,
  )

// As web's setLogInfo: a user event, recorded by name only, e.g. which card field gained focus. As
// on web, a latency given here replaces the one measured from an _INIT.
let setLogInfo = (
  logger: t,
  ~value,
  ~eventName,
  ~merchantId,
  ~paymentId,
  ~latency=?,
  ~logType=INFO,
) =>
  logger->pushLog(
    ~value,
    ~eventName,
    ~logType,
    ~category=USER_EVENT,
    ~merchantId,
    ~paymentId,
    ~latency?,
  )

// The identity every log of one API call carries. A call keeps the log session it started in and
// its own start time, so an answer that arrives after the form's session changed is still filed
// under the session that sent it, with that session's first_event and count and its real latency.
type apiCall = {
  logger: t,
  eventName: eventName,
  url: string,
  merchantId: string,
  paymentId: string,
  logSession: session,
  mutable startedAt: option<float>,
}

// As LoggerUtils.logApi: what each kind of API log records.
let logApi = (call: apiCall, ~eventName, ~apiLogType, ~statusCode=0, ~data=JSON.Encode.null) => {
  let url = ("url", call.url->JSON.Encode.string)
  let response = ("response", data)
  let (value, logType) = switch apiLogType {
  | Request => ([url], INFO)
  | Response => ([url, ("statusCode", statusCode->JSON.Encode.int)], INFO)
  | NoResponse => ([url, ("statusCode", 504->JSON.Encode.int), response], ERROR)
  | Err => ([url, ("statusCode", statusCode->JSON.Encode.int), response], ERROR)
  }
  // As web's calculateLatencyHook, an answer carries the time since its _INIT.
  let latency = switch (apiLogType, call.startedAt) {
  | (Request, _) | (_, None) => None
  | (_, Some(startedAt)) =>
    let latency = Date.now() -. startedAt
    latency > 0. ? Some(latency) : None
  }
  call.logger->setLogApi(
    ~value,
    ~eventName,
    ~logType,
    ~merchantId=call.merchantId,
    ~paymentId=call.paymentId,
    ~latency?,
    ~session=call.logSession,
  )
}

// The three points at which web's fetchApiWithLogging logs: before the request, on its answer, and
// when no answer arrives. A call without a logger logs nothing.
let callStarted = (call: option<apiCall>) =>
  call->Option.forEach(call => {
    call.startedAt = Some(Date.now())
    call.eventName
    ->apiEventInitMapper
    ->Option.forEach(eventName => call->logApi(~eventName, ~apiLogType=Request))
  })

let callAnswered = (call: option<apiCall>, ~status: int, ~response: JSON.t) =>
  call->Option.forEach(call =>
    if status >= 200 && status < 300 {
      call->logApi(~eventName=call.eventName, ~apiLogType=Response, ~statusCode=status)
    } else {
      call->logApi(
        ~eventName=call.eventName,
        ~apiLogType=Err,
        ~statusCode=status,
        ~data=response->errorBodyValue,
      )
    }
  )

let callUnanswered = (call: option<apiCall>, ~error: exn) =>
  call->Option.forEach(call =>
    call->logApi(~eventName=call.eventName, ~apiLogType=NoResponse, ~data=error->exceptionValueOf)
  )

// An answer whose body cannot be read as JSON: an error with its real status and a fixed message,
// never the body or what reading it raised.
let callUnreadable = (call: option<apiCall>, ~status: int) =>
  call->Option.forEach(call =>
    call->logApi(
      ~eventName=call.eventName,
      ~apiLogType=Err,
      ~statusCode=status,
      ~data=fixedMessage(notJson),
    )
  )

// What tells one crash from another: its type and message. Not its stack, which differs when React
// renders the failing component again before the error leaves the form.
let crashSignature = (thrown: Exn.t) =>
  switch thrown->exceptionValue {
  | Object(fields) =>
    [fields->Dict.get("type"), fields->Dict.get("message")]
    ->Array.map(field => field->Option.getOr(JSON.Encode.null))
    ->JSON.Encode.array
    ->JSON.stringify
  | other => other->JSON.stringify
  }

// As web's ErrorBoundary logs SDK_CRASH: an error in category USER_ERROR, so it goes out at once,
// with the component that crashed. The exception is recorded as exceptionValue records it.
let logCrash = (logger: t, ~thrown: Exn.t, ~componentName, ~merchantId, ~paymentId) => {
  let value = switch thrown->exceptionValue {
  | Object(fields) => fields
  | other => Dict.fromArray([("thrown", other)])
  }
  value->Dict.set("componentName", componentName->JSON.Encode.string)
  logger->pushLog(
    ~value=value->JSON.Encode.object->JSON.stringify,
    ~eventName=SDK_CRASH,
    ~logType=ERROR,
    ~category=USER_ERROR,
    ~merchantId,
    ~paymentId,
  )
}
