let loggerContext: React.Context.t<option<LoggerCore.t>> = React.createContext(None)

module Provider = {
  let make = React.Context.provider(loggerContext)
}

// Logs from children before `config` is applied are queued, then sent by `configure`.
@genType @react.component
let make = (~config: LoggerTypes.loggerConfig, ~children: React.element) => {
  let logger = React.useMemo0(() => LoggerCore.make())
  React.useEffect1(() => {
    logger->LoggerCore.configure(config)
    None
  }, [config])
  React.useEffect0(() => Some(() => logger->LoggerCore.dispose))
  <Provider value={Some(logger)}> children </Provider>
}
