open LoggerTypes

@module("react-native") @scope("Platform") @val external platformOS: string = "OS"

let eventToStrMapper = (eventName: eventName) => {
  (eventName :> string)
}

let getPlatform = (config: loggerConfig) => config.platform->Option.getOr(platformOS)

let convertToScreamingSnakeCase = text => {
  text->String.trim->String.replaceRegExp(%re("/ /g"), "_")->String.toUpperCase
}

// Redaction is a backstop, applied to every value and internal_metadata at the final send step.
// Callers log fixed names, codes, URLs and status codes only; these catch anything that slips
// through.

let redacted = "[REDACTED]"
let maxValueLength = 2048

let truncate = (text, max) =>
  text->String.length > max ? text->String.slice(~start=0, ~end=max) ++ "..." : text

let passesLuhn = (digits: string) => {
  let sum = ref(0)
  let double = ref(false)
  let index = ref(digits->String.length - 1)
  while index.contents >= 0 {
    let digit = digits->String.charCodeAt(index.contents)->Float.toInt - 48
    let doubled = digit * 2
    sum := sum.contents + (double.contents ? doubled > 9 ? doubled - 9 : doubled : digit)
    double := !double.contents
    index := index.contents - 1
  }
  mod(sum.contents, 10) === 0
}

// Longer runs are never something a caller means to log, so they are redacted unchecked.
let maxCheckedDigits = 64

// Whether any 12-19 digit stretch of `digits` passes the Luhn check, so a card number run
// together with a CVC, an expiry or a reference is still found.
let containsCardNumber = (digits: string) => {
  let length = digits->String.length
  if length > maxCheckedDigits {
    true
  } else {
    let found = ref(false)
    let size = ref(12)
    while !found.contents && size.contents <= 19 {
      let start = ref(0)
      while !found.contents && start.contents + size.contents <= length {
        found :=
          digits
          ->String.slice(~start=start.contents, ~end=start.contents + size.contents)
          ->passesLuhn
        start := start.contents + 1
      }
      size := size.contents + 1
    }
    found.contents
  }
}

// Payment-method-session ids ("<cell>_pms_<32 hex>") are logged on purpose: they identify the
// session and grant nothing without its client secret.
let sessionIdPattern = %re("/^[A-Za-z0-9]{1,16}_pms_[0-9a-fA-F]{32}$/")

let isIdentifierChar = (text, index) => {
  let code = text->String.charCodeAt(index)->Float.toInt
  (code >= 48 && code <= 57) || (code >= 65 && code <= 90) || (code >= 97 && code <= 122) ||
    code === 95
}

// The identifier ([A-Za-z0-9_]) that text[start, end) sits in.
let enclosingIdentifier = (text, ~start, ~end) => {
  let first = ref(start)
  while first.contents > 0 && isIdentifierChar(text, first.contents - 1) {
    first := first.contents - 1
  }
  let last = ref(end)
  while last.contents < text->String.length && isIdentifierChar(text, last.contents) {
    last := last.contents + 1
  }
  text->String.slice(~start=first.contents, ~end=last.contents)
}

// Runs of 12 or more digits, optionally grouped by single spaces, dashes or dots. A run is
// redacted whole when it contains a card number, unless it is part of a session id's hex.
let redactCardNumbers = (text: string) =>
  text->String.unsafeReplaceRegExpBy0(%re("/\d(?:[ .\-]?\d){11,}/g"), (~match, ~offset, ~input) =>
    if (
      sessionIdPattern->RegExp.test(
        input->enclosingIdentifier(~start=offset, ~end=offset + match->String.length),
      )
    ) {
      match
    } else if match->String.replaceRegExp(%re("/\D/g"), "")->containsCardNumber {
      redacted
    } else {
      match
    }
  )

// Runs of base64 / base64url / identifier characters and `/`, redacted whole when any
// `/`-separated part is 32 characters or longer and not a session id: an sdkAuthorization (whose
// base64 can contain `/`), a client secret (`pay_…_secret_…`), a JWT segment or a bearer token.
// The paths of logged URLs are made of short parts and session ids, so they survive.
let redactTokens = (text: string) =>
  text->String.unsafeReplaceRegExpBy0(%re("/[A-Za-z0-9+\/=_\-]{32,}/g"), (
    ~match,
    ~offset as _,
    ~input as _,
  ) =>
    match
    ->String.split("/")
    ->Array.some(part => part->String.length >= 32 && !(sessionIdPattern->RegExp.test(part)))
      ? redacted
      : match
  )

let redactSecrets = (text: string) => text->redactCardNumbers->redactTokens

let sanitizeValue = (text: string) => text->redactSecrets->truncate(maxValueLength)

// An error type or code is logged only when it looks like one: a short identifier.
let errorFieldPattern = %re("/^[A-Za-z0-9_.:\-]{1,64}$/")

// Keeps only error.type and error.code from a backend error body. The message is never logged:
// with customEndpoints the backend is the merchant's own or a proxy, and connector and external
// vault errors pass through it, so its text can quote anything.
let safeErrorResponse = (body: JSON.t): JSON.t => {
  let pick = (dict, key) =>
    dict
    ->Dict.get(key)
    ->Option.flatMap(JSON.Decode.string)
    ->Option.filter(text => errorFieldPattern->RegExp.test(text))
    ->Option.map(text => (key, text->redactSecrets->JSON.Encode.string))
  let fieldsOf = dict => ["type", "code"]->Array.filterMap(key => pick(dict, key))
  switch body->JSON.Decode.object {
  | None => JSON.Encode.null
  | Some(root) =>
    let fields = switch root->Dict.get("error")->Option.flatMap(JSON.Decode.object) {
    | Some(error) => fieldsOf(error)
    | None => fieldsOf(root)
    }
    [("error", fields->Dict.fromArray->JSON.Encode.object)]->Dict.fromArray->JSON.Encode.object
  }
}

// Why a request got no response, as one of the fixed reasons; anything else is "network_error".
let failureReasons = ["timeout", "aborted", "network_error"]

let safeFailureReason = (data: JSON.t): JSON.t => {
  let reason =
    data
    ->JSON.Decode.object
    ->Option.flatMap(dict => dict->Dict.get("error"))
    ->Option.flatMap(JSON.Decode.string)
    ->Option.filter(reason => failureReasons->Array.includes(reason))
    ->Option.getOr("network_error")
  [("error", reason->JSON.Encode.string)]->Dict.fromArray->JSON.Encode.object
}

// A logged request URL keeps its scheme, host and path. Credentials, the query and the hash are
// dropped: any of them can carry a secret.
let sanitizeUrl = (url: string) =>
  url
  ->String.replaceRegExp(%re("/[?#][\s\S]*$/"), "")
  ->String.replaceRegExp(%re("/^([A-Za-z][A-Za-z0-9+.\-]*:\/\/)[^\/]*@/"), "$1")

// A crash is reported by its error name alone ("TypeError", a custom class name). The message
// is never logged: an engine message can quote input text, such as a CVC, that redaction cannot
// recognise. A name that is not a plain identifier is reported as "Error".
let errorName: jsonValue => string = %raw(`
  function (error) {
    try {
      var name = error && typeof error === "object" ? error.name : undefined;
      return typeof name === "string" && /^[A-Za-z_$][\w$.]{0,63}$/.test(name) ? name : "Error";
    } catch (_) {
      return "Error";
    }
  }
`)

// Groups one SDK instance's log lines (a version-4 UUID). It correlates logs and authorises
// nothing, so where the runtime has no crypto (Hermes without a polyfill) Math.random stands in.
let generateSessionId: unit => string = %raw(`
  function () {
    var bytes = null;
    try {
      if (typeof crypto !== "undefined" && crypto && typeof crypto.getRandomValues === "function") {
        bytes = crypto.getRandomValues(new Uint8Array(16));
      }
    } catch (_) {
      bytes = null;
    }
    var hex = "0123456789abcdef";
    var out = "";
    var nibble = 0;
    for (var i = 0; i < 36; i++) {
      if (i === 8 || i === 13 || i === 18 || i === 23) {
        out += "-";
        continue;
      }
      var random = bytes ? (bytes[nibble >> 1] >> (nibble & 1 ? 0 : 4)) & 15 : (Math.random() * 16) | 0;
      nibble++;
      out += hex[i === 14 ? 4 : i === 19 ? (random & 3) | 8 : random];
    }
    return out;
  }
`)

// The logs route sits directly under the API base the vault and payment-methods call, so
// `commonEndpoint` (that API base) gets only "/logs/sdk" appended.
let logsPath = "/logs/sdk"

// Anything that is not SANDBOX or INTEG, a missing value included, is PROD: the default every SDK
// here uses. Matched as a string, so a value from JavaScript outside the type cannot fall through
// to another host.
let defaultApiBase = (environment: environment) =>
  switch (environment :> string) {
  | "SANDBOX" => "https://app.hyperswitch.io/api"
  | "INTEG" => "https://integ.hyperswitch.io/api"
  | _ => "https://live.hyperswitch.io/api"
  }

let getDefaultLoggingUrl = (environment: environment) => defaultApiBase(environment) ++ logsPath

// Drops trailing slashes with a loop: /\/+$/ backtracks quadratically on a URL with many slashes
// that does not end in one, and these URLs come from the merchant's configuration.
let trimTrailingSlashes = (text: string) => {
  let end = ref(text->String.length)
  while end.contents > 0 && text->String.charAt(end.contents - 1) === "/" {
    end := end.contents - 1
  }
  text->String.slice(~start=0, ~end=end.contents)
}

let nonBlank = (url: string) => {
  let trimmed = url->String.trim->trimTrailingSlashes
  trimmed->String.length > 0 ? Some(trimmed) : None
}

// scheme://host[:port][/path] and nothing else: no credentials, query or hash. Matched by
// pattern rather than parsed with URL, whose getters React Native does not implement before 0.80.
let endpointPattern = %re(
  "/^(https?):\/\/([A-Za-z0-9.\-]+|\[[0-9A-Fa-f:.]+\])(:[0-9]{1,5})?(\/[^\s?#@\\]*)?$/i"
)

let loopbackHosts = ["localhost", "127.0.0.1", "10.0.2.2"]

// Cleartext is allowed only outside PROD, for a local proxy while developing.
let allowsCleartext = (environment: environment) => {
  let name = (environment :> string)
  name === "SANDBOX" || name === "INTEG"
}

// An endpoint the SDK may call, normalised (lower-case scheme and host, no trailing slash): https,
// or http to a loopback host outside PROD. None for anything else, which is then never called.
// The vault's backend calls and payment-methods' session lookup are checked with this too.
let validateEndpoint = (url: string, ~environment: environment): option<string> =>
  endpointPattern
  ->RegExp.exec(url->String.trim)
  ->Option.flatMap(parts => {
    let part = index => parts->Array.getUnsafe(index)->Option.getOr("")
    let scheme = part(1)->String.toLowerCase
    let host = part(2)->String.toLowerCase
    let path = part(4)->trimTrailingSlashes
    let allowed =
      scheme === "https" ||
        (scheme === "http" &&
        environment->allowsCleartext &&
        loopbackHosts->Array.includes(host))
    allowed ? Some(`${scheme}://${host}${part(3)}${path}`) : None
  })

type loggingTarget = Default | Custom(string) | Nothing

let loggingTarget = (customEndpoints: option<customEndpoints>) =>
  switch customEndpoints {
  | None => Default
  | Some({commonEndpoint: ?Some(common)}) =>
    common->nonBlank->Option.mapOr(Nothing, base => Custom(base ++ logsPath))
  | Some({overrideEndpoints: ?Some({customLoggingEndpoint: ?Some(logging)})}) =>
    logging->nonBlank->Option.mapOr(Nothing, url => Custom(url))
  | Some({overrideEndpoints: ?Some({customBackendEndpoint: ?Some(_)})}) => Nothing
  | Some(_) => Default
  }

// The URL logs are sent to, or None to send nothing. Every target, the default included, must
// pass validateEndpoint.
let getLoggingUrl = (~customEndpoints: option<customEndpoints>, ~environment) =>
  switch loggingTarget(customEndpoints) {
  | Default => getDefaultLoggingUrl(environment)->validateEndpoint(~environment)
  | Custom(url) => url->validateEndpoint(~environment)
  | Nothing => None
  }

let logFileToObj = logFile => {
  [
    ("timestamp", logFile.timestamp->JSON.Encode.string),
    (
      "log_type",
      switch logFile.logType {
      | DEBUG => "DEBUG"
      | INFO => "INFO"
      | ERROR => "ERROR"
      | WARNING => "WARNING"
      }->JSON.Encode.string,
    ),
    (
      "component",
      switch logFile.component {
      | MOBILE => "MOBILE"
      }->JSON.Encode.string,
    ),
    (
      "category",
      switch logFile.category {
      | API => "API"
      | USER_ERROR => "USER_ERROR"
      | USER_EVENT => "USER_EVENT"
      | MERCHANT_EVENT => "MERCHANT_EVENT"
      }->JSON.Encode.string,
    ),
    ("version", logFile.version->JSON.Encode.string), // repoversion of orca-android
    ("code_push_version", logFile.codePushVersion->JSON.Encode.string), // replace with ota version
    ("client_core_version", logFile.clientCoreVersion->JSON.Encode.string),
    ("value", logFile.value->sanitizeValue->JSON.Encode.string),
    ("internal_metadata", logFile.internalMetadata->sanitizeValue->JSON.Encode.string),
    ("session_id", logFile.sessionId->JSON.Encode.string),
    ("merchant_id", logFile.merchantId->JSON.Encode.string),
    ("payment_id", logFile.paymentId->JSON.Encode.string),
    // These SDKs pass no app id, so the platform stands in for it, as plain text.
    ("app_id", logFile.appId->Option.getOr(logFile.platform)->JSON.Encode.string),
    ("platform", logFile.platform->convertToScreamingSnakeCase->JSON.Encode.string),
    ("user_agent", logFile.userAgent->JSON.Encode.string),
    ("event_name", logFile.eventName->eventToStrMapper->JSON.Encode.string),
    ("first_event", (logFile.firstEvent ? "true" : "false")->JSON.Encode.string),
    (
      "payment_method",
      logFile.paymentMethod
      ->Option.getOr("")
      ->convertToScreamingSnakeCase
      ->JSON.Encode.string,
    ),
    (
      "payment_experience",
      switch logFile.paymentExperience {
      | None => ""
      | Some(exp) => exp
      }->JSON.Encode.string,
    ),
    ("latency", logFile.latency->Option.getOr("")->JSON.Encode.string),
    ("source", logFile.source->JSON.Encode.string),
  ]
  ->Dict.fromArray
  ->JSON.Encode.object
}

type fetchOptions = {
  method: string,
  headers: Dict.t<string>,
  body: string,
  mode: string,
}

@val external fetch: (string, fetchOptions) => promise<unit> = "fetch"

let getHeaders = (~publishableKey, ~appId, ~platform) =>
  [
    ("Content-Type", "application/json"),
    ("X-Client-Platform", platform),
    ("api-key", publishableKey),
    ("x-app-id", appId->Option.getOr("")->String.replace(".hyperswitch://", "")),
    ("x-redirect-uri", ""),
  ]->Dict.fromArray

let sendLogs = (logFile: logFile, uri: option<string>, publishableKey, appId) => {
  switch uri {
  | Some("") | None => ()
  | Some(uri) =>
    try {
      fetch(
        uri,
        {
          method: "POST",
          headers: getHeaders(~publishableKey, ~appId, ~platform=logFile.platform),
          body: logFile->logFileToObj->JSON.stringify,
          mode: "no-cors",
        },
      )
      ->Promise.catch(_ => Promise.resolve())
      ->ignore
    } catch {
    | _ => ()
    }
  }
}
