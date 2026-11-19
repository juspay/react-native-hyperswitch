/*
 * One field of a detached card form, in a React root of its own. It gives its children the widget
 * context a <CardForm> would, built over the form's shared store, so the fields of every root edit
 * one card. While the Host is submitting, or the form is disabled, the fields are disabled as they
 * would be in a <CardForm>.
 */
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
  ~children: React.element,
) => {
  let submitting = React.useSyncExternalStore(
    ~subscribe=DetachedCardLink.subscribe(link, ...),
    ~getSnapshot=DetachedCardLink.isSubmitting(link, ...),
  )

  let host = DetachedCardHost.useShared(
    ~store,
    ~link,
    ~ownsFormLogs=false,
    ~session,
    ~sdkAuthorization,
    ~vaultDetails,
    ~environment,
    ~appearance,
    ~locale,
    ~localisation,
    ~customEndpoints,
    ~disabled=submitting || disabled->Option.getOr(false),
    ~accessible,
    ~enabledCardSchemes,
    ~cardholderName,
    ~unstyled,
    ~onReady=None,
    ~onChange=None,
  )

  <VaultWidgetContext.ContextProvider value={Some(host.contextValue)}>
    children
  </VaultWidgetContext.ContextProvider>
}
