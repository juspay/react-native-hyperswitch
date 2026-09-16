@genType
type widgetHandle = {
  focus: unit => unit,
  blur: unit => unit,

  clear: unit => unit,
}

@genType
let make = React.forwardRef((
  props: {

    "session": option<VaultFormOptions.vaultSession>,
    "sdkAuthorization": option<string>,

    "vaultDetails": option<VaultDetails.vaultDetails>,
    "environment": VaultFormOptions.vaultEnvironment,
    "appearance": option<VaultFormOptions.appearance>,

    "locale": option<string>,
    "localisation": option<VaultFormOptions.localisation>,
    "disabled": option<bool>,
    "accessible": option<bool>,
    "enabledCardSchemes": option<array<string>>,
    "eligibility": option<VaultFormOptions.eligibilityConfig>,

    "customEndpoints": option<VaultEndpoint.customEndpoints>,

    "cardholderName": option<CardFieldOptions.cardholderNameMode>,

    "onReady": option<VaultPublicState.cardFormEvent => unit>,
    "onChange": option<VaultPublicState.cardFormChange => unit>,

    /*
     * Lets a headless caller (payment-methods' `hyperswitch` provider adapter) read the session's
     * `contextValue` out of a form that has no rendered children of its own — see `~form` on the
     * individual fields. Fires on every render that produces a new `contextValue` (it isn't
     * memoized), which is fine: the callback is expected to be a cheap store update.
     */
    "onContext": option<VaultWidgetContext.contextValue => unit>,

    "unstyled": option<bool>,
    "children": option<React.element>,
  },
  ref,
) => {
  let host = VaultFormHost.useHost(
    ~session=props["session"]->Option.map(VaultFormOptions.sessionToJson),
    ~sdkAuthorization=props["sdkAuthorization"],
    ~vaultDetails=props["vaultDetails"],
    ~environment=props["environment"],
    ~appearance=props["appearance"],
    ~locale=props["locale"],
    ~localisation=props["localisation"],
    ~disabled=props["disabled"]->Option.getOr(false),
    ~accessible=props["accessible"],
    ~enabledCardSchemes=props["enabledCardSchemes"]->Option.getOr([]),
    ~eligibility=props["eligibility"],
    ~vaultEndpoint=VaultEndpoint.configOf(props["customEndpoints"]),
    ~cardholderNameMode=props["cardholderName"]->Option.getOr(#collect),
    ~onReady=props["onReady"],
    ~onChange=props["onChange"],
    ~unstyled=props["unstyled"]->Option.getOr(CardFieldOptions.defaultUnstyled),

    ~defaultErrorDisplay=CardFieldOptions.defaultErrorDisplayComposable,
  )

  React.useImperativeHandle0(ref, () => {
    VaultFormOptions.tokenize: host.machinery.tokenize,
    confirmPayment: host.machinery.confirmPayment,
    reset: host.machinery.reset,
    focus: host.focusField,
  })

  let onContext = props["onContext"]
  let contextValue = host.contextValue
  React.useEffect1(() => {
    onContext->Option.forEach(fn => fn(contextValue))
    None
  }, [contextValue])

  <VaultWidgetContext.ContextProvider value={Some(host.contextValue)}>
    {props["children"]->Option.getOr(React.null)}
  </VaultWidgetContext.ContextProvider>
})
