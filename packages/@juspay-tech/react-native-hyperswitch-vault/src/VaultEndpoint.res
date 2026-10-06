@genType
type vaultEndpointConfig = {baseUrl: string}

@genType
type overrideEndpointConfiguration = {
  customBackendEndpoint?: string,
  customLoggingEndpoint?: string,
  customAssetEndpoint?: string,
  customSDKConfigEndpoint?: string,
  customAirborneEndpoint?: string,
}

@genType
type customEndpoints = {
  commonEndpoint?: string,
  overrideEndpoints?: overrideEndpointConfiguration,
}

let keepEndpoints: option<customEndpoints> => option<customEndpoints> = %raw(`
  function (value) { return value !== null && typeof value === "object" ? value : undefined; }
`)
let keepOverrides: option<overrideEndpointConfiguration> => option<
  overrideEndpointConfiguration,
> = %raw(`
  function (value) { return value !== null && typeof value === "object" ? value : undefined; }
`)
let keepString: option<string> => option<string> = %raw(`
  function (value) { return typeof value === "string" ? value : undefined; }
`)

let normalize = (custom: option<customEndpoints>): option<customEndpoints> =>
  custom
  ->keepEndpoints
  ->Option.map((entry): customEndpoints => {
    commonEndpoint: ?entry.commonEndpoint->keepString,
    overrideEndpoints: ?entry.overrideEndpoints
    ->keepOverrides
    ->Option.map((over): overrideEndpointConfiguration => {
      customBackendEndpoint: ?over.customBackendEndpoint->keepString,
      customLoggingEndpoint: ?over.customLoggingEndpoint->keepString,
      customAssetEndpoint: ?over.customAssetEndpoint->keepString,
      customSDKConfigEndpoint: ?over.customSDKConfigEndpoint->keepString,
      customAirborneEndpoint: ?over.customAirborneEndpoint->keepString,
    }),
  })

let configOf = (custom: option<customEndpoints>): option<vaultEndpointConfig> =>
  custom
  ->normalize
  ->Option.flatMap(entry =>
    switch entry.commonEndpoint {
    | Some(url) => Some({baseUrl: url})
    | None =>
      entry.overrideEndpoints
      ->Option.flatMap(over => over.customBackendEndpoint)
      ->Option.map(url => {baseUrl: url})
    }
  )

let validateEndpoint = (
  endpoint: option<vaultEndpointConfig>,
  ~environment: VaultConfirm.vaultEnvironment,
): result<option<string>, unit> =>
  switch endpoint {
  | None => Ok(None)
  | Some({baseUrl}) =>
    switch baseUrl->LoggerUtils.validateEndpoint(~environment) {
    | Some(base) => Ok(Some(base))
    | None => Error()
    }
  }

let resolveBaseUrl = (endpoint, ~environment: VaultConfirm.vaultEnvironment): result<string, unit> =>
  switch endpoint->validateEndpoint(~environment) {
  | Error() => Error()
  | Ok(None) => Ok(environment->VaultConfirm.vaultBaseUrl)
  | Ok(Some(base)) => Ok(base)
  }
