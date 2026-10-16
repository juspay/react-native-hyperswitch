/*
 * The non-visual root of a detached card form, rendered once by the screen that owns the form. It
 * holds the form's tokenizer and reports the form's state; the fields render in roots of their own
 * (DetachedCardField). Unmounting it ends the form: the card is cleared and tokenize() refuses.
 */

/* The <CardForm> provider's hook, over a store the form shares across roots. */
let useShared = (
  ~store: VaultCardStore.t,
  ~sdkAuthorization: option<string>,
  ~vaultDetails: option<VaultDetails.vaultDetails>,
  ~environment: VaultFormOptions.vaultEnvironment,
  ~appearance: option<VaultFormOptions.appearance>,
  ~locale: option<string>,
  ~customEndpoints: option<VaultEndpoint.customEndpoints>,
  ~disabled: bool,
  ~onReady: option<VaultPublicState.cardFormEvent => unit>,
  ~onChange: option<VaultPublicState.cardFormChange => unit>,
) =>
  VaultFormHost.useHost(
    ~store,
    ~session=None,
    ~sdkAuthorization,
    ~vaultDetails,
    ~environment,
    ~appearance,
    ~locale,
    ~localisation=None,
    ~disabled,
    ~accessible=None,
    ~enabledCardSchemes=[],
    ~eligibility=None,
    ~vaultEndpoint=VaultEndpoint.configOf(customEndpoints),
    ~cardholderNameMode=#collect,
    ~onReady,
    ~onChange,
    ~unstyled=CardFieldOptions.defaultUnstyled,
    ~defaultErrorDisplay=CardFieldOptions.defaultErrorDisplayComposable,
  )

@react.component
let make = (
  ~store: VaultCardStore.t,
  ~link: DetachedCardLink.t,
  ~sdkAuthorization: option<string>=?,
  ~vaultDetails: option<VaultDetails.vaultDetails>=?,
  ~environment: VaultFormOptions.vaultEnvironment,
  ~appearance: option<VaultFormOptions.appearance>=?,
  ~locale: option<string>=?,
  ~customEndpoints: option<VaultEndpoint.customEndpoints>=?,
  ~onReady: option<VaultPublicState.cardFormEvent => unit>=?,
  ~onChange: option<VaultPublicState.cardFormChange => unit>=?,
) => {
  let host = useShared(
    ~store,
    ~sdkAuthorization,
    ~vaultDetails,
    ~environment,
    ~appearance,
    ~locale,
    ~customEndpoints,
    ~disabled=false,
    ~onReady,
    ~onChange,
  )

  React.useEffectOnEveryRender(() => {
    link.machinery = Some(host.machinery)
    link.focusField = Some(host.focusField)
    link->DetachedCardLink.setSubmitting(host.machinery.isSubmitting)
    None
  })

  React.useEffect0(() => Some(
    () => {
      link.machinery = None
      link.focusField = None
      link->DetachedCardLink.setSubmitting(false)
      store->VaultCardStore.dispatch(CardStateReducer.Reset)
    },
  ))

  React.null
}
