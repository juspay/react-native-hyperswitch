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

// customEndpoints rebuilt from its string fields alone. JavaScript callers (payment-methods
// forwards its merchant's value) can pass null, a number or a conditional `{}` for any part;
// those read as absent instead of throwing during render.
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

// scheme://host[:port][/path] and nothing else: no credentials, query or hash. Matched by
// pattern rather than parsed with URL, whose getters React Native does not implement before 0.80.
let endpointPattern = %re(
  "/^(https?):\/\/([A-Za-z0-9.\-]+|\[[0-9A-Fa-f:.]+\])(:[0-9]{1,5})?(\/[^\s?#@\\]*)?$/i"
)

let loopbackHosts = ["localhost", "127.0.0.1", "10.0.2.2"]

// Cleartext only outside PROD, for a local proxy while developing.
let allowsCleartext = (environment: VaultConfirm.vaultEnvironment) => {
  let name = (environment :> string)
  name === "SANDBOX" || name === "INTEG"
}

// Drops trailing slashes with a loop: /\/+$/ backtracks quadratically on a URL with many slashes
// that does not end in one, and the URL comes from the merchant's configuration.
let trimTrailingSlashes = (text: string) => {
  let end = ref(text->String.length)
  while end.contents > 0 && text->String.charAt(end.contents - 1) === "/" {
    end := end.contents - 1
  }
  text->String.slice(~start=0, ~end=end.contents)
}

// https, or http to a loopback host outside PROD, with no credentials, query or hash; normalised
// to a lower-case scheme and host with no trailing slash. A base that fails is never called.
let validateEndpoint = (
  endpoint: option<vaultEndpointConfig>,
  ~environment: VaultConfirm.vaultEnvironment,
): result<option<string>, unit> =>
  switch endpoint {
  | None => Ok(None)
  | Some({baseUrl}) =>
    switch endpointPattern->RegExp.exec(baseUrl->String.trim) {
    | None => Error()
    | Some(parts) =>
      let part = index => parts->Array.getUnsafe(index)->Option.getOr("")
      let scheme = part(1)->String.toLowerCase
      let host = part(2)->String.toLowerCase
      let allowed =
        scheme === "https" ||
          (scheme === "http" &&
          environment->allowsCleartext &&
          loopbackHosts->Array.includes(host))
      allowed ? Ok(Some(`${scheme}://${host}${part(3)}${part(4)->trimTrailingSlashes}`)) : Error()
    }
  }

let resolveBaseUrl = (endpoint, ~environment: VaultConfirm.vaultEnvironment): result<string, unit> =>
  switch endpoint->validateEndpoint(~environment) {
  | Error() => Error()
  | Ok(None) => Ok(environment->VaultConfirm.vaultBaseUrl)
  | Ok(Some(base)) => Ok(base)
  }
