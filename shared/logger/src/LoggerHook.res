open LoggerTypes

// Outside a <LoggerContext> every call is a no-op.
let useLoggerHook = () => {
  let logger = React.useContext(LoggerContext.loggerContext)
  (
    ~logType,
    ~value,
    ~category,
    ~paymentMethod=?,
    ~paymentExperience=?,
    ~internalMetadata=?,
    ~eventName,
    ~latency=?,
    (),
  ) =>
    logger->Option.forEach(logger =>
      logger->LoggerCore.record(
        ~logType,
        ~category,
        ~eventName,
        ~value,
        ~internalMetadata?,
        ~paymentMethod?,
        ~paymentExperience?,
        ~latency?,
        (),
      )
    )
}

let useApiLogWrapper = () => {
  let logger = React.useContext(LoggerContext.loggerContext)
  (
    ~logType,
    ~eventName,
    ~url,
    ~statusCode,
    ~apiLogType,
    ~data,
    ~paymentMethod=?,
    ~paymentExperience=?,
    (),
  ) =>
    logger->Option.forEach(logger =>
      logger->LoggerCore.logApi(
        ~logType,
        {eventName, apiLogType, url, statusCode, data, ?paymentMethod, ?paymentExperience},
      )
    )
}

// Record-argument spellings of the two hooks above, for TypeScript callers.

@genType
let useLogger = () => {
  let logger = React.useContext(LoggerContext.loggerContext)
  (event: logEvent) => logger->Option.forEach(logger => logger->LoggerCore.log(event))
}

@genType
let useApiLogger = () => {
  let logger = React.useContext(LoggerContext.loggerContext)
  (event: apiLogEvent) => logger->Option.forEach(logger => logger->LoggerCore.logApi(event))
}
