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

// Mirrors GlobalHooks.res in hyperswitch-client-core: `commonEndpoint` is a bare host and gets
// `/api` appended, while `overrideEndpoints.customBackendEndpoint` is used exactly as given.
let backendPath = "/api"

// Linear scan instead of /\/+$/: that regex backtracks polynomially on input with many
// non-trailing '/' (CodeQL js/polynomial-redos), and endpoints are caller-supplied.
let stripTrailingSlashes = (value: string) => {
  let end = ref(value->String.length)
  while end.contents > 0 && value->String.charCodeAt(end.contents - 1) == 47.0 {
    end := end.contents - 1
  }
  value->String.slice(~start=0, ~end=end.contents)
}

let configOf = (custom: option<customEndpoints>): option<vaultEndpointConfig> =>
  custom->Option.flatMap(entry =>
    switch entry.commonEndpoint {
    | Some(url) if url->String.trim->String.length > 0 =>
      Some({baseUrl: url->String.trim->stripTrailingSlashes ++ backendPath})
    | Some(url) => Some({baseUrl: url})
    | None =>
      entry.overrideEndpoints
      ->Option.flatMap(over => over.customBackendEndpoint)
      ->Option.map(url => {baseUrl: url})
    }
  )

type parsedUrl

@val @scope("globalThis") external urlConstructor: Nullable.t<'a> = "URL"
@new external makeUrl: string => parsedUrl = "URL"
@get external urlProtocol: parsedUrl => string = "protocol"
@get external urlHostname: parsedUrl => string = "hostname"
@get external urlUsername: parsedUrl => string = "username"
@get external urlPassword: parsedUrl => string = "password"
@get external urlPathname: parsedUrl => string = "pathname"
@get external urlSearch: parsedUrl => string = "search"
@get external urlHash: parsedUrl => string = "hash"
@get external urlOrigin: parsedUrl => string = "origin"

let loopbackHosts = ["localhost", "127.0.0.1", "10.0.2.2"]

let allowsCleartext = (environment: VaultConfirm.vaultEnvironment) =>
  switch environment {
  | #SANDBOX | #INTEG => true
  | #PROD => false
  }

let normalisePath = stripTrailingSlashes

let validateEndpoint = (
  endpoint: option<vaultEndpointConfig>,
  ~environment: VaultConfirm.vaultEnvironment,
): result<option<string>, unit> =>
  switch endpoint {
  | None => Ok(None)
  | Some({baseUrl}) =>
    let trimmed = baseUrl->String.trim
    if trimmed->String.length === 0 {
      Error()
    } else {
      switch urlConstructor->Nullable.toOption {
      | None => Error()
      | Some(_) =>
        switch try {Some(makeUrl(trimmed))} catch {
        | _ => None
        } {
        | None => Error()
        | Some(url) =>
          let protocol = url->urlProtocol
          let hostname = url->urlHostname
          let isLoopback = loopbackHosts->Array.some(host => host === hostname)
          let schemeOk =
            protocol === "https:" ||
              (protocol === "http:" && isLoopback && environment->allowsCleartext)
          let hasCredentials =
            url->urlUsername->String.length > 0 || url->urlPassword->String.length > 0
          let hasQuery = url->urlSearch->String.length > 0
          let hasHash = url->urlHash->String.length > 0

          if schemeOk && !hasCredentials && !hasQuery && !hasHash {
            Ok(Some(url->urlOrigin ++ url->urlPathname->normalisePath))
          } else {
            Error()
          }
        }
      }
    }
  }

let resolveBaseUrl = (endpoint, ~environment: VaultConfirm.vaultEnvironment): result<string, unit> =>
  switch endpoint->validateEndpoint(~environment) {
  | Error() => Error()
  | Ok(None) => Ok(environment->VaultConfirm.vaultBaseUrl)
  | Ok(Some(base)) => Ok(base)
  }
