/*
 * One field of a detached card form, in a React root of its own. It gives its children the widget
 * context a <CardForm> would, built over the form's shared store, so the fields of every root edit
 * one card. While the Host is submitting, the fields are disabled as they would be in a <CardForm>.
 */
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
  ~children: React.element,
) => {
  let submitting = React.useSyncExternalStore(
    ~subscribe=DetachedCardLink.subscribe(link, ...),
    ~getSnapshot=DetachedCardLink.isSubmitting(link, ...),
  )

  let host = DetachedCardHost.useShared(
    ~store,
    ~sdkAuthorization,
    ~vaultDetails,
    ~environment,
    ~appearance,
    ~locale,
    ~customEndpoints,
    ~disabled=submitting,
    ~onReady=None,
    ~onChange=None,
  )

  <VaultWidgetContext.ContextProvider value={Some(host.contextValue)}>
    children
  </VaultWidgetContext.ContextProvider>
}
