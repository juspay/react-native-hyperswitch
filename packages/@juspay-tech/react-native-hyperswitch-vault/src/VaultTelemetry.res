// Payment Method Session logging for the vault.
//
// Standalone (no host sink): the vault is the SDK the merchant integrated, so it logs the whole
// event set under its own session_id, with merchant_id read from the sdkAuthorization's
// publishable_key. Without a publishable key nothing is sent.
//
// Hosted (a `logSink` is passed, e.g. by payment-methods): the host already logs the session
// events, so the vault forwards only its own backend calls (CONFIRM / UPDATE) to the sink and
// logs nothing else. Nothing is counted twice.
//
// Every value logged here is a fixed name, a code, a URL or a status. Card data, the
// sdkAuthorization and tokens are never passed in.

@genType.import(("./telemetryTypes", "VaultLogSink"))
type logSink = LoggerTypes.apiLogEvent => unit

let source = "VAULT_SDK"

// Replaced with package.json's version by rollup.config.mjs.
let sdkVersion = "__VAULT_SDK_VERSION__"

let vaultType = "hyperswitch"

type t = {
  log: (
    ~logType: LoggerTypes.logType,
    ~eventName: LoggerTypes.eventName,
    ~value: string,
    ~latency: float=?,
    unit,
  ) => unit,
  logApi: LoggerTypes.apiLogEvent => unit,
  crash: LoggerTypes.jsonValue => unit,
  // Web's rule: each mount logs MOUNTED, then RENDERED timed from it, and unmounting a field
  // that rendered forgets it, so mounting it again logs a fresh pair. A field unmounted before
  // it rendered keeps its first mount (StrictMode's double mount is not counted twice).
  fieldMounted: string => unit,
  fieldRendered: string => unit,
  fieldUnmounted: string => unit,
}

type fieldState = {
  mountedAt: float,
  mutable rendered: bool,
}

let guard = fn =>
  try fn() catch {
  | _ => ()
  }

let nonBlank = (value: string) => {
  let trimmed = value->String.trim
  trimmed->String.length > 0 ? Some(trimmed) : None
}

let jsonValue = (entries: array<(string, string)>) =>
  entries
  ->Array.map(((key, value)) => (key, value->JSON.Encode.string))
  ->Dict.fromArray
  ->JSON.Encode.object
  ->JSON.stringify

let paymentMethodSessionIdOf = (authorization: string): option<string> =>
  authorization->String.trim->VaultConfirm.decodeBase64->Option.flatMap(VaultConfirm.readSessionId)

let publishableKeyOf = (authorization: string): option<string> =>
  authorization
  ->String.trim
  ->VaultConfirm.decodeBase64
  ->Option.flatMap(decoded => decoded->VaultConfirm.readClaim("publishable_key"))

let loggerEndpoints = (custom: option<VaultEndpoint.customEndpoints>): option<
  LoggerTypes.customEndpoints,
> =>
  custom
  ->VaultEndpoint.normalize
  ->Option.map((entry): LoggerTypes.customEndpoints => {
    commonEndpoint: ?entry.commonEndpoint,
    overrideEndpoints: ?entry.overrideEndpoints->Option.map((
      over
    ): LoggerTypes.overrideEndpoints => {
      customBackendEndpoint: ?over.customBackendEndpoint,
      customLoggingEndpoint: ?over.customLoggingEndpoint,
    }),
  })

let environmentKey = (environment: VaultConfirm.vaultEnvironment) =>
  switch environment {
  | #PROD => "PROD"
  | #SANDBOX => "SANDBOX"
  | #INTEG => "INTEG"
  }

// Runs `fn` once the next frame is drawn; the returned function cancels it.
let afterNextFrame: (unit => unit) => (unit => unit) = %raw(`
  function (fn) {
    if (typeof requestAnimationFrame === "function") {
      var frame = requestAnimationFrame(function () { fn(); });
      return function () { if (typeof cancelAnimationFrame === "function") cancelAnimationFrame(frame); };
    }
    var timer = setTimeout(fn, 0);
    return function () { clearTimeout(timer); };
  }
`)

let use = (
  ~logSink: option<logSink>,
  ~entry: string,
  ~environment: VaultConfirm.vaultEnvironment,
  ~customEndpoints: option<VaultEndpoint.customEndpoints>,
  ~authorization: option<string>,
  ~fallbackPublishableKey: option<string>,
): t => {
  let sinkRef = React.useRef(logSink)
  sinkRef.current = logSink
  let hosted = () => sinkRef.current->Option.isSome

  let logger = React.useMemo0(() => LoggerCore.make())
  let sessionId = React.useMemo0(() => LoggerUtils.generateSessionId())

  let publishableKey =
    authorization
    ->Option.flatMap(publishableKeyOf)
    ->Option.orElse(fallbackPublishableKey->Option.flatMap(nonBlank))
  let endpoints = loggerEndpoints(customEndpoints)
  let override = endpoints->Option.flatMap(e => e.overrideEndpoints)
  let configKey =
    [
      publishableKey->Option.getOr(""),
      environment->environmentKey,
      endpoints->Option.flatMap(e => e.commonEndpoint)->Option.getOr(""),
      override->Option.flatMap(o => o.customBackendEndpoint)->Option.getOr(""),
      override->Option.flatMap(o => o.customLoggingEndpoint)->Option.getOr(""),
    ]->Array.join("|")

  let configRef: React.ref<option<LoggerTypes.loggerConfig>> = React.useRef(None)
  configRef.current = publishableKey->Option.map((publishableKey): LoggerTypes.loggerConfig => {
    publishableKey,
    environment,
    customEndpoints: ?endpoints,
    sessionId,
    sdkVersion,
    source,
  })

  React.useEffect1(() => {
    if !hosted() {
      configRef.current->Option.forEach(config =>
        guard(() => logger->LoggerCore.configure(config))
      )
    }
    None
  }, [configKey])

  React.useEffect0(() => Some(() => logger->LoggerCore.dispose))

  let telemetry = React.useMemo0((): t => {
    let log = (~logType, ~eventName, ~value, ~latency=?, ()) =>
      if !hosted() {
        guard(() =>
          logger->LoggerCore.record(~logType, ~category=USER_EVENT, ~eventName, ~value, ~latency?, ())
        )
      }
    let fields: Dict.t<fieldState> = Dict.make()
    {
    log,
    logApi: event =>
      switch sinkRef.current {
      | Some(sink) => guard(() => sink(event))
      | None => guard(() => logger->LoggerCore.logApi(event))
      },
    crash: error =>
      if !hosted() {
        guard(() => logger->LoggerCore.logCrash(error))
      },
    fieldMounted: value =>
      switch fields->Dict.get(value) {
      | Some({rendered: false}) => ()
      | _ =>
        fields->Dict.set(value, {mountedAt: Date.now(), rendered: false})
        log(~logType=INFO, ~eventName=PAYMENT_METHOD_SESSION_FIELD_MOUNTED, ~value, ())
      },
    fieldRendered: value =>
      switch fields->Dict.get(value) {
      | Some(state) if !state.rendered =>
        state.rendered = true
        log(
          ~logType=INFO,
          ~eventName=PAYMENT_METHOD_SESSION_FIELD_RENDERED,
          ~value,
          ~latency=Math.round(Date.now() -. state.mountedAt),
          (),
        )
      | _ => ()
      },
    fieldUnmounted: value =>
      switch fields->Dict.get(value) {
      | Some({rendered: true}) => fields->Dict.delete(value)
      | _ => ()
      },
    }
  })

  // During the first render, so it precedes the fields' mount effects. Web logs the page URL
  // here; an app has none, so the entry point stands in for it.
  let initiatedRef = React.useRef(false)
  if !initiatedRef.current {
    initiatedRef.current = true
    telemetry.log(
      ~logType=INFO,
      ~eventName=PAYMENT_METHOD_SESSION_INITIATED,
      ~value=jsonValue([
        ("entry", entry),
        (
          "pmSessionId",
          authorization->Option.flatMap(paymentMethodSessionIdOf)->Option.getOr(""),
        ),
      ]),
      (),
    )
  }

  telemetry
}

let tokenizeInitiated = (telemetry: t) =>
  telemetry.log(~logType=INFO, ~eventName=PAYMENT_METHOD_SESSION_TOKENIZE_INIT, ~value=vaultType, ())

// One outcome per tokenize, timed from TOKENIZE_INIT, in web's shape. Every message a vault
// tokenize result carries is a fixed library string (VaultResult), never backend or card text.
let tokenizeOutcome = (telemetry: t, result: VaultResult.vaultTokenizeResult) =>
  switch (result.status, result.error) {
  | (#success, _) =>
    telemetry.log(
      ~logType=INFO,
      ~eventName=PAYMENT_METHOD_SESSION_TOKENIZE,
      ~value=jsonValue([("vaultType", vaultType)]),
      (),
    )
  | (_, error) =>
    telemetry.log(
      ~logType=ERROR,
      ~eventName=PAYMENT_METHOD_SESSION_TOKENIZE,
      ~value=jsonValue([
        ("vaultType", vaultType),
        ("code", error->Option.mapOr("tokenization_failed", error => (error.code :> string))),
        ("message", error->Option.mapOr("", error => error.message)),
      ]),
      (),
    )
  }
