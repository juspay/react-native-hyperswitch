let missingMessage = missing => {
  let names = missing->Array.map(VaultCardController.kindLabel)->Array.join(", ")
  `${names} must be mounted inside <CardForm> before submitting.`
}
let duplicateMessage = (kind, count) =>
  `Only one ${VaultCardController.kindLabel(
      kind,
    )} may be mounted per <CardForm>; found ${count->Int.toString}.`

let savedCardWithNumberMessage = "A CardCVCField carrying savedCard must be the only field mounted; remove the card-number and expiry fields to update a saved card."

let requiredKinds = [
  VaultCardController.CardNumberKind,
  VaultCardController.ExpiryKind,
  VaultCardController.CvcKind,
]

type host = {
  contextValue: VaultWidgetContext.contextValue,
  machinery: VaultFormCoordinator.machinery,
  focusField: VaultPublicState.elementType => unit,
}

let useHost = (
  ~store: option<VaultCardStore.t>=?,
  ~session: option<JSON.t>,

  ~sdkAuthorization: option<string>,

  ~vaultDetails: option<VaultDetails.vaultDetails>,
  ~environment: VaultFormOptions.vaultEnvironment,
  ~appearance: option<VaultFormOptions.appearance>,
  ~locale: option<string>,
  ~localisation: option<VaultFormOptions.localisation>,
  ~disabled: bool,
  ~accessible: option<bool>,
  ~enabledCardSchemes: array<string>,
  ~eligibility: option<VaultFormOptions.eligibilityConfig>,

  ~vaultEndpoint: option<VaultEndpoint.vaultEndpointConfig>,

  ~cardholderNameMode: CardFieldOptions.cardholderNameMode,

  ~onReady: option<VaultPublicState.cardFormEvent => unit>,
  ~onChange: option<VaultPublicState.cardFormChange => unit>,

  ~unstyled: bool,

  ~defaultErrorDisplay: CardFieldOptions.errorDisplay,
): host => {

  let sessionState = React.useMemo3(
    () =>
      switch (session, vaultDetails, sdkAuthorization) {
      | (Some(session), _, _) => session->VaultFormCoordinator.readSession
      | (None, Some(details), _) =>
        VaultFormCoordinator.sessionFromVaultDetails(~details, ~sdkAuthorization)
      | (None, None, Some(authorization)) =>
        VaultFormCoordinator.sessionFromAuthorization(authorization)
      | (None, None, None) => VaultFormCoordinator.Unusable("No card-vault session was supplied.")
      },
    (session, vaultDetails, sdkAuthorization),
  )
  let theme = React.useMemo1(() => appearance->VaultFormOptions.buildTheme, [appearance])
  let bundle = React.useMemo1(() => LocaleBundles.resolve(locale), [locale])
  let labels = React.useMemo2(
    () => localisation->VaultFormOptions.resolveLabels(~bundle),
    (localisation, bundle),
  )
  let messages = React.useMemo2(
    () => localisation->VaultFormOptions.resolveMessages(~bundle),
    (localisation, bundle),
  )
  let errorFontSize =
    (12. +. VaultFormOptions.errorTextSizeAdjustOf(appearance)) *. theme.fontScale
  let errorSpacing = VaultFormOptions.errorMessageSpacingOf(appearance)
  let brandIconMode = VaultFormOptions.cardBrandIconOf(appearance)
  let defaultLabelBehavior = VaultFormOptions.labelsModeOf(appearance)

  let schemesKey = enabledCardSchemes->Array.join(" ")
  let acceptedSchemes = React.useMemo1(
    () => CardNetworkNames.normaliseList(enabledCardSchemes),
    [schemesKey],
  )

  let validators: CardStateReducer.validators = {
    cardNumber: VaultFormOptions.makeCardNumberValidator(messages),
    expiry: VaultFormOptions.makeExpiryValidatorWith(messages),
    cvc: VaultFormOptions.makeCvcValidatorWith(messages),
    network: VaultFormOptions.makeNetworkValidator(~enabledCardSchemes=acceptedSchemes, messages),
    notEligible: Some(messages.cardNotEligible),
  }

  let ownStore = React.useMemo0(() => VaultCardStore.make())
  let store = store->Option.getOr(ownStore)

  let controller = VaultCardController.use(
    ~store,
    ~validators,
    ~enabledCardSchemes=acceptedSchemes,
  )

  let countOf = controller.countOf

  let presenceGate = (): result<VaultFormCoordinator.submitFlow, string> => {
    let numbers = countOf(VaultCardController.CardNumberKind)
    let expiries = countOf(VaultCardController.ExpiryKind)
    let cvcs = countOf(VaultCardController.CvcKind)
    if numbers === 0 && expiries === 0 && cvcs === 1 {
      Ok(
        VaultFormCoordinator.SavedCardCvc(
          controller.savedCard()->Option.getOr({CardStateReducer.token: "", network: ""}),
        ),
      )
    } else if numbers === 0 && expiries === 0 && cvcs === 0 {
      Error(VaultResult.incompleteFieldSetMessage)
    } else if controller.savedCard()->Option.isSome {

      Error(savedCardWithNumberMessage)
    } else {
      let missing = requiredKinds->Array.filter(kind => countOf(kind) == 0)
      if missing->Array.length > 0 {
        Error(missingMessage(missing))
      } else {
        switch requiredKinds->Array.find(kind => countOf(kind) > 1) {
        | Some(kind) => Error(duplicateMessage(kind, countOf(kind)))
        | None => Ok(VaultFormCoordinator.NewCard)
        }
      }
    }
  }

  let probeGenerationRef = React.useRef(0)
  let probeMountedRef = React.useRef(true)
  React.useEffect0(() => {
    probeMountedRef.current = true
    Some(
      () => {
        probeMountedRef.current = false
        probeGenerationRef.current = probeGenerationRef.current + 1
      },
    )
  })

  let probeKey = `${controller.values.cardNumber}|${controller.values.brand}`
  React.useEffect2(() => {
    switch eligibility {
    | None => ()
    | Some(config) =>
      switch controller.eligibilityProbe() {
      | #idle => ()
      | #reset => controller.recordEligibility(VaultEligibility.Allowed)
      | #check(digits) =>
        let credential = VaultCredential.resolve(
          ~sdkAuthorization=config.sdkAuthorization,
          ~publishableKey=config.publishableKey,
          ~clientSecret=config.clientSecret,
        )
        switch (config.endpoint->VaultEndpoint.resolveBaseUrl(~environment), credential) {
        | (Error(), _) => ()
        | (_, None) => ()
        | (Ok(baseUrl), Some(credential)) =>
          probeGenerationRef.current = probeGenerationRef.current + 1
          let generation = probeGenerationRef.current
          controller.markEligibilityPending()
          VaultEligibility.check({
            baseUrl,
            paymentId: config.paymentId,
            credential,
            appId: config.appId,
            cardNumber: digits,
          })
          ->Promise.then(verdict => {
            if probeMountedRef.current && probeGenerationRef.current === generation {
              controller.recordEligibility(verdict)
            }
            Promise.resolve()
          })
          ->ignore
        }
      }
    }
    None
  }, (probeKey, eligibility))

  let machinery = VaultFormCoordinator.useMachinery(
    ~sessionState,
    ~environment,
    ~isValid=controller.isValidNow,
    ~cardDetails=controller.cardDetails,
    ~cardholderName=controller.cardholderName,
    ~cardholderNameMode,
    ~vaultEndpoint,
    ~cardNetwork=controller.cardNetwork,
    ~cardVersion=controller.cardVersion,
    ~eligibilityVerdict=controller.eligibilityVerdict,
    ~recordEligibility=controller.recordEligibility,
    ~markSubmitAttempted=controller.markSubmitAttempted,
    ~presenceGate,
    ~clearLocal=controller.reset,
    ~savedCardKey=controller.values.savedCard->Option.mapOr("", saved => saved.token),
  )

  let sessionStatus: VaultPublicState.vaultSessionStatus = switch sessionState {
  | Unusable(_) =>
    session->Option.isNone && vaultDetails->Option.isNone && sdkAuthorization->Option.isNone
      ? #absent
      : #invalid
  | Ready(ready) =>
    if machinery.isConsumed {
      #consumed
    } else if VaultFormCoordinator.isExpired(ready) {
      #expired
    } else {
      #valid
    }
  }

  let isSubmitting = machinery.isSubmitting

  let buildFormChange = () => {
    let snapshot = controller.publicSnapshot()
    let savedCardMode = controller.values.savedCard->Option.isSome
    VaultPublicState.formChangeOf(
      ~fieldsReady=presenceGate()->Result.isOk,
      ~sessionStatus,
      ~submitting=isSubmitting,
      ~isCoBadged=controller.values.isCoBadged,
      ~eligibility=snapshot.eligibility,
      ~networkError=snapshot.networkError,
      ~payload=snapshot.cardDetails,
      ~fields={
        cardNumber: snapshot.cardNumber,
        cardExpiry: snapshot.cardExpiry,
        cardCvc: snapshot.cardCvc,

        cardholderName: ?(
          countOf(VaultCardController.CardholderNameKind) > 0
            ? Some(snapshot.cardholderName)
            : None
        ),
      },
      ~savedCardMode,
    )
  }

  VaultStateEmitter.use(
    ~build=buildFormChange,
    ~equal=VaultPublicState.formChangeEq,
    ~notify=onChange,
  )

  VaultStateEmitter.use(
    ~build=() => buildFormChange().complete,
    ~equal=(a, b) => a === b,
    ~notify=onReady->Option.map(fn => complete =>
      if complete {
        fn({VaultPublicState.elementType: #cardForm})
      }
    ),
  )

  {
    contextValue: {
      iconBaseUrl: CardIconUrls.host(environment),
      controller,
      publicSnapshot: controller.publicSnapshot,
      theme,
      labels,
      errorFontSize,
      errorSpacing,
      brandIconMode,
      accessible,
      editable: !machinery.isSubmitting && !disabled,
      isProcessing: machinery.isSubmitting || disabled,
      onAnalytics: _ => (),
      unstyled,
      defaultErrorDisplay,
      defaultLabelBehavior,
    },
    machinery,
    focusField: controller.focusField,
  }
}
