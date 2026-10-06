@genType
type logType = DEBUG | INFO | ERROR | WARNING
@genType
type logCategory = API | USER_ERROR | USER_EVENT | MERCHANT_EVENT
type logComponent = MOBILE
@genType
type apiLogType = Request | Response | NoResponse | Err
@genType
type eventName =
  | APP_RENDERED
  | S3_API
  | INACTIVE_SCREEN
  | COUNTRY_CHANGED
  | SDK_CLOSED
  | PAYMENT_METHOD_CHANGED
  | PAYMENT_DATA_FILLED
  | PAYMENT_ATTEMPT
  | PAYMENT_SUCCESS
  | PAYMENT_FAILED
  | INPUT_FIELD_CHANGED
  | RETRIEVE_CALL_INIT
  | RETRIEVE_CALL
  | CONFIRM_CALL_INIT
  | CONFIRM_CALL
  | SESSIONS_CALL_INIT
  | SESSIONS_CALL
  | CONFIG_CALL_INIT
  | CONFIG_CALL
  | CLIENT_LIST_CALL_INIT
  | CLIENT_LIST_CALL
  | BLUR
  | FOCUS
  | REDIRECTING_USER
  | PAYMENT_SESSION_INITIATED
  | LOADER_CHANGED
  | SCAN_CARD
  | AUTHENTICATION_CALL_INIT
  | AUTHENTICATION_CALL
  | AUTHORIZE_CALL_INIT
  | AUTHORIZE_CALL
  | POLL_STATUS_CALL_INIT
  | POLL_STATUS_CALL
  | DISPLAY_THREE_DS_SDK
  | NETCETERA_SDK
  | APPLE_PAY_STARTED_FROM_JS
  | APPLE_PAY_CALLBACK_FROM_NATIVE
  | APPLE_PAY_PRESENT_FAIL_FROM_NATIVE
  | APPLE_PAY_BRIDGE_SUCCESS
  | NO_WALLET_ERROR
  | DELETE_PAYMENT_METHODS_CALL_INIT
  | DELETE_PAYMENT_METHODS_CALL
  | DELETE_SAVED_PAYMENT_METHOD
  | ADD_PAYMENT_METHOD_CALL_INIT
  | ADD_PAYMENT_METHOD_CALL
  | UPDATE_PAYMENT_METHOD_CALL_INIT
  | UPDATE_PAYMENT_METHOD_CALL
  | SAMSUNG_PAY
  | POST_SESSION_TOKENS_CALL_INIT
  | POST_SESSION_TOKENS_CALL
  | CARD_SCHEME_SELECTION
  | VAULT_TOKENIZE
  | PAYMENT_METHOD_SESSION_INITIATED
  | PAYMENT_METHOD_SESSION_FIELD_MOUNTED
  | PAYMENT_METHOD_SESSION_FIELD_RENDERED
  | PAYMENT_METHOD_SESSION_DATA_FILLED
  | PAYMENT_METHOD_SESSION_TOKENIZE_INIT
  | PAYMENT_METHOD_SESSION_TOKENIZE
  | PAYMENT_METHOD_SESSION_RETRIEVE_CALL_INIT
  | PAYMENT_METHOD_SESSION_RETRIEVE_CALL
  | PAYMENT_METHOD_SESSION_CONFIRM_CALL_INIT
  | PAYMENT_METHOD_SESSION_CONFIRM_CALL
  | PAYMENT_METHOD_SESSION_UPDATE_CALL_INIT
  | PAYMENT_METHOD_SESSION_UPDATE_CALL
  | SDK_CRASH
  | VGS_VAULT_FLOW

type logFile = {
  timestamp: string,
  logType: logType,
  component: logComponent,
  category: logCategory,
  version: string,
  codePushVersion: string,
  clientCoreVersion: string,
  value: string,
  internalMetadata: string,
  sessionId: string,
  merchantId: string,
  paymentId: string,
  appId?: string,
  platform: string,
  userAgent: string,
  eventName: eventName,
  latency?: string,
  firstEvent: bool,
  paymentMethod?: string,
  paymentExperience?: string,
  source: string,
}
let getApiInitEvent = (event: eventName): option<eventName> => {
  switch event {
  | RETRIEVE_CALL => Some(RETRIEVE_CALL_INIT)
  | CONFIRM_CALL => Some(CONFIRM_CALL_INIT)
  | SESSIONS_CALL => Some(SESSIONS_CALL_INIT)
  | CONFIG_CALL => Some(CONFIG_CALL_INIT)
  | CLIENT_LIST_CALL => Some(CLIENT_LIST_CALL_INIT)
  | AUTHENTICATION_CALL => Some(AUTHENTICATION_CALL_INIT)
  | AUTHORIZE_CALL => Some(AUTHORIZE_CALL_INIT)
  | POLL_STATUS_CALL => Some(POLL_STATUS_CALL_INIT)
  | DELETE_PAYMENT_METHODS_CALL => Some(DELETE_PAYMENT_METHODS_CALL_INIT)
  | ADD_PAYMENT_METHOD_CALL => Some(ADD_PAYMENT_METHOD_CALL_INIT)
  | UPDATE_PAYMENT_METHOD_CALL => Some(UPDATE_PAYMENT_METHOD_CALL_INIT)
  | POST_SESSION_TOKENS_CALL => Some(POST_SESSION_TOKENS_CALL_INIT)
  | PAYMENT_METHOD_SESSION_RETRIEVE_CALL => Some(PAYMENT_METHOD_SESSION_RETRIEVE_CALL_INIT)
  | PAYMENT_METHOD_SESSION_CONFIRM_CALL => Some(PAYMENT_METHOD_SESSION_CONFIRM_CALL_INIT)
  | PAYMENT_METHOD_SESSION_UPDATE_CALL => Some(PAYMENT_METHOD_SESSION_UPDATE_CALL_INIT)
  // Not a backend call, but timed the same way: the outcome from its _INIT, as on web.
  | PAYMENT_METHOD_SESSION_TOKENIZE => Some(PAYMENT_METHOD_SESSION_TOKENIZE_INIT)
  | _ => None
  }
}

// What client-core read from NativePropContext, supplied by the host package instead.

@genType
type environment = [#PROD | #SANDBOX | #INTEG]

// Same shape as the customEndpoints the vault and payment-methods packages already accept.
@genType
type overrideEndpoints = {
  customBackendEndpoint?: string,
  customLoggingEndpoint?: string,
}

@genType
type customEndpoints = {
  commonEndpoint?: string,
  overrideEndpoints?: overrideEndpoints,
}

@genType
type loggerConfig = {
  publishableKey: string,
  environment: environment,
  customEndpoints?: customEndpoints,
  sessionId: string,
  sdkVersion: string,
  // Reported as `source`, e.g. "VAULT" or "PAYMENT_METHODS".
  source: string,
  paymentId?: string,
  appId?: string,
  userAgent?: string,
  // Defaults to react-native's Platform.OS.
  platform?: string,
  codePushVersion?: string,
  clientCoreVersion?: string,
}

@genType.import(("./jsonValue", "jsonValue"))
type jsonValue = JSON.t

// One log line as a caller describes it. Values must already be free of card data and
// credentials; the logger only redacts as a backstop.
@genType
type logEvent = {
  logType: logType,
  category: logCategory,
  eventName: eventName,
  value: string,
  internalMetadata?: string,
  paymentMethod?: string,
  paymentExperience?: string,
  latency?: float,
}

// One backend call, shaped into value/internal_metadata the way client-core's apiLogWrapper
// does. `data` is ignored on a Response: a 2xx body can carry tokens and is never logged.
@genType
type apiLogEvent = {
  eventName: eventName,
  apiLogType: apiLogType,
  url: string,
  statusCode: string,
  data?: jsonValue,
  latency?: float,
  paymentMethod?: string,
  paymentExperience?: string,
}
