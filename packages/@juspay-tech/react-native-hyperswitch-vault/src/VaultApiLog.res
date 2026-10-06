// The PAYMENT_METHOD_SESSION_*_CALL_INIT / *_CALL pair for one backend request. Only the URL,
// the status and a trimmed error body are logged: the request carries card data and a 2xx
// response carries the payment method token.

type sink = option<LoggerTypes.apiLogEvent => unit>

let emit = (sink: sink, event: LoggerTypes.apiLogEvent) =>
  sink->Option.forEach(fn =>
    try fn(event) catch {
    | _ => ()
    }
  )

// Returns the start time the response is timed from.
let request = (sink: sink, ~initEvent: LoggerTypes.eventName, ~url: string) => {
  emit(sink, {eventName: initEvent, apiLogType: Request, url, statusCode: ""})
  Date.now()
}

let responded = (
  sink: sink,
  ~eventName: LoggerTypes.eventName,
  ~url: string,
  ~startedAt: float,
  ~status: int,
  ~ok: bool,
  ~body: option<JSON.t>,
) => {
  let statusCode = status->Int.toString
  let latency = Date.now() -. startedAt
  emit(
    sink,
    ok
      ? {eventName, apiLogType: Response, url, statusCode, latency}
      : {
          eventName,
          apiLogType: Err,
          url,
          statusCode,
          data: body->Option.mapOr(JSON.Encode.null, LoggerUtils.safeErrorResponse),
          latency,
        },
  )
}

// A request that produced no response is reported as 504, as client-core does.
let failed = (
  sink: sink,
  ~eventName: LoggerTypes.eventName,
  ~url: string,
  ~startedAt: float,
  ~reason: string,
) =>
  emit(
    sink,
    {
      eventName,
      apiLogType: NoResponse,
      url,
      statusCode: "504",
      data: [("error", reason->JSON.Encode.string)]->Dict.fromArray->JSON.Encode.object,
      latency: Date.now() -. startedAt,
    },
  )
