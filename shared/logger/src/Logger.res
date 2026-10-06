// LoggerCore for TypeScript callers, as a plain object. Every method swallows its own errors:
// a logging failure must never surface in a tokenize or confirm path.

@genType
type logger = {
  configure: LoggerTypes.loggerConfig => unit,
  log: LoggerTypes.logEvent => unit,
  logApi: LoggerTypes.apiLogEvent => unit,
  logCrash: LoggerTypes.jsonValue => unit,
  dispose: unit => unit,
}

let guard = fn =>
  try fn() catch {
  | _ => ()
  }

@genType
let createLogger = (): logger => {
  let core = LoggerCore.make()
  {
    configure: config => guard(() => core->LoggerCore.configure(config)),
    log: event => guard(() => core->LoggerCore.log(event)),
    logApi: event => guard(() => core->LoggerCore.logApi(event)),
    logCrash: error => guard(() => core->LoggerCore.logCrash(error)),
    dispose: () => guard(() => core->LoggerCore.dispose),
  }
}

@genType
let generateSessionId: unit => string = LoggerUtils.generateSessionId

@genType
let safeErrorResponse: LoggerTypes.jsonValue => LoggerTypes.jsonValue = LoggerUtils.safeErrorResponse

@genType
let redactSecrets: string => string = LoggerUtils.redactSecrets

// The vault's check on a backend URL, for payment-methods' own calls: the normalised URL, or
// undefined when the SDK must not call it.
@genType
let validateEndpoint = (url: string, environment: LoggerTypes.environment): option<string> =>
  LoggerUtils.validateEndpoint(url, ~environment)
