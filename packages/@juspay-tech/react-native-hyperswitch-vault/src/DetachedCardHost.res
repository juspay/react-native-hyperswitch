/*
 * The non-visual root of a detached card form, rendered once by the screen that owns the form. It
 * holds the form's tokenizer and reports the form's state; the fields render in roots of their own
 * (DetachedCardField). Unmounting it ends the form: the card is cleared and tokenize() refuses.
 */

/*
 * The <CardForm> provider's hook, over a store and a logger the form shares across roots. It takes
 * every setting a <CardForm> takes, with the same defaults, so a detached form behaves as that form
 * would. Only the Host root logs what belongs to the form as a whole (`ownsFormLogs`).
 */
/*
 * How long the Host waits, after the last field registered, before it logs the form's settings.
 * Each field is a root of its own and registers on its own, so without the wait the settings would
 * be logged once per field, each time with one more field in the list.
 */
let fieldsSettleMs = 500

let useShared = (
  ~store: VaultCardStore.t,
  ~link: DetachedCardLink.t,
  ~ownsFormLogs: bool,
  ~session: option<VaultFormOptions.vaultSession>,
  ~sdkAuthorization: option<string>,
  ~vaultDetails: option<VaultDetails.vaultDetails>,
  ~environment: VaultFormOptions.vaultEnvironment,
  ~appearance: option<VaultFormOptions.appearance>,
  ~locale: option<string>,
  ~localisation: option<VaultFormOptions.localisation>,
  ~customEndpoints: option<VaultEndpoint.customEndpoints>,
  ~disabled: bool,
  ~accessible: option<bool>,
  ~enabledCardSchemes: option<array<string>>,
  ~cardholderName: option<CardFieldOptions.cardholderNameMode>,
  ~unstyled: option<bool>,
  ~onReady: option<VaultPublicState.cardFormEvent => unit>,
  ~onChange: option<VaultPublicState.cardFormChange => unit>,
) =>
  VaultFormHost.useHost(
    ~store,
    ~loggerFor=DetachedCardLink.loggerFor(link, ...),
    ~ownsFormLogs,
    ~fieldsSettleMs,
    ~session=session->Option.map(VaultFormOptions.sessionToJson),
    ~sdkAuthorization,
    ~vaultDetails,
    ~environment,
    ~appearance,
    ~locale,
    ~localisation,
    ~disabled,
    ~accessible,
    ~enabledCardSchemes=enabledCardSchemes->Option.getOr([]),
    ~eligibility=None,
    ~customEndpoints,
    ~cardholderNameMode=cardholderName->Option.getOr(#collect),
    ~onReady,
    ~onChange,
    ~unstyled=unstyled->Option.getOr(CardFieldOptions.defaultUnstyled),
    ~defaultErrorDisplay=CardFieldOptions.defaultErrorDisplayComposable,
  )

@react.component
let make = (
  ~store: VaultCardStore.t,
  ~link: DetachedCardLink.t,
  ~session: option<VaultFormOptions.vaultSession>=?,
  ~sdkAuthorization: option<string>=?,
  ~vaultDetails: option<VaultDetails.vaultDetails>=?,
  ~environment: VaultFormOptions.vaultEnvironment,
  ~appearance: option<VaultFormOptions.appearance>=?,
  ~locale: option<string>=?,
  ~localisation: option<VaultFormOptions.localisation>=?,
  ~customEndpoints: option<VaultEndpoint.customEndpoints>=?,
  ~disabled: option<bool>=?,
  ~accessible: option<bool>=?,
  ~enabledCardSchemes: option<array<string>>=?,
  ~cardholderName: option<CardFieldOptions.cardholderNameMode>=?,
  ~unstyled: option<bool>=?,
  ~onReady: option<VaultPublicState.cardFormEvent => unit>=?,
  ~onChange: option<VaultPublicState.cardFormChange => unit>=?,
) => {
  let host = useShared(
    ~store,
    ~link,
    ~ownsFormLogs=true,
    ~session,
    ~sdkAuthorization,
    ~vaultDetails,
    ~environment,
    ~appearance,
    ~locale,
    ~localisation,
    ~customEndpoints,
    ~disabled=disabled->Option.getOr(false),
    ~accessible,
    ~enabledCardSchemes,
    ~cardholderName,
    ~unstyled,
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
