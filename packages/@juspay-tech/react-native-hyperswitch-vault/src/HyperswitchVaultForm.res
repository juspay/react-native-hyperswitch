@genType
type vaultEnvironment = VaultFormOptions.vaultEnvironment

@genType
type vaultSession = VaultFormOptions.vaultSession

@genType
type brandIconMode = VaultFormOptions.brandIconMode

@genType
type appearance = VaultFormOptions.appearance

@genType
type localisationLabels = VaultFormOptions.localisationLabels

@genType
type localisationMessages = VaultFormOptions.localisationMessages

@genType
type localisation = VaultFormOptions.localisation

@genType
type safeVaultErrorCode = VaultResult.safeVaultErrorCode

@genType
type safeVaultError = VaultResult.safeVaultError

@genType
type vaultPaymentResult = VaultResult.vaultPaymentResult

@genType
type vaultTokenizeResult = VaultResult.vaultTokenizeResult

@genType
type vaultFormHandle = VaultFormOptions.vaultFormHandle

@genType
type fieldStyles = CardFieldStyles.fieldStyles

@genType
type expiryStyles = CardFieldStyles.expiryStyles

@genType
type formFieldStyles = CardFieldStyles.formFieldStyles

@genType
type formFieldOptions = CardFieldOptions.formFieldOptions

@genType
type formLayout = CardFieldOptions.formLayout

@genType
type fieldArrangement = CardFieldOptions.fieldArrangement

@genType
type cardholderNameMode = CardFieldOptions.cardholderNameMode

@genType
type eligibilityConfig = VaultFormOptions.eligibilityConfig

@genType
type paymentCardSource = VaultCardSource.paymentCardSource

@genType
type cardSourceType = VaultCardSource.cardSourceType

@genType
let make = React.forwardRef((
  props: {

    "session": option<vaultSession>,
    "sdkAuthorization": option<string>,

    "vaultDetails": option<VaultDetails.vaultDetails>,
    "environment": vaultEnvironment,
    "appearance": option<appearance>,
    "locale": option<string>,
    "disabled": option<bool>,

    "layout": option<formLayout>,
    "fieldArrangement": option<fieldArrangement>,
    "localisation": option<localisation>,
    "accessible": option<bool>,
    "fieldStyles": option<formFieldStyles>,
    "fieldOptions": option<formFieldOptions>,

    "enabledCardSchemes": option<array<string>>,
    "eligibility": option<eligibilityConfig>,

    "customEndpoints": option<VaultEndpoint.customEndpoints>,

    "cardholderName": option<cardholderNameMode>,

    "unstyled": option<bool>,
    "onReady": option<VaultPublicState.cardFormEvent => unit>,
    "onChange": option<VaultPublicState.cardFormChange => unit>,
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

    ~defaultErrorDisplay=CardFieldOptions.defaultErrorDisplayReadyMade,
  )

  React.useImperativeHandle0(ref, () => {
    VaultFormOptions.tokenize: host.machinery.tokenize,
    confirmPayment: host.machinery.confirmPayment,

    reset: host.machinery.reset,
    focus: host.focusField,
  })

  <VaultWidgetContext.ContextProvider value={Some(host.contextValue)}>
    <CardFormView
      cardholderName=?{props["cardholderName"]}
      layout=?{props["layout"]}
      fieldArrangement=?{props["fieldArrangement"]}
      fieldStyles=?{props["fieldStyles"]}
      fieldOptions=?{props["fieldOptions"]}
    />
  </VaultWidgetContext.ContextProvider>
})
