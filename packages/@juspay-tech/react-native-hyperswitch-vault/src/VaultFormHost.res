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

  ~customEndpoints: option<VaultEndpoint.customEndpoints>,

  ~cardholderNameMode: CardFieldOptions.cardholderNameMode,

  ~onReady: option<VaultPublicState.cardFormEvent => unit>,
  ~onChange: option<VaultPublicState.cardFormChange => unit>,

  ~unstyled: bool,

  ~defaultErrorDisplay: CardFieldOptions.errorDisplay,
): host => {
  let environment = environment->VaultConfirm.normalizeEnvironment
  let vaultEndpoint = VaultEndpoint.configOf(customEndpoints)
  let loggingUrl = customEndpoints->VaultEndpoint.loggingUrl(~environment)

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
  let authorization = switch sessionState {
  | Ready({authorization}) => authorization
  | Unusable(_) => ""
  }
  let logger = React.useMemo1(
    () => VaultLogger.make(~url=loggingUrl, ~platform=(ReactNative.Platform.os :> string)),
    [loggingUrl],
  )
  // A session that replaces another starts the logger afresh, as web loads its frames afresh for
  // each. The first session to arrive does not: what the customer did before it keeps its session_id.
  let loggedAuthorizationRef = React.useRef("")
  React.useEffect2(() => {
    if authorization !== "" {
      let previous = loggedAuthorizationRef.current
      if previous !== "" && previous !== authorization {
        logger->VaultLogger.startNewSession
      }
      loggedAuthorizationRef.current = authorization
    }
    None
  }, (logger, authorization))
  // The merchant and session every log names. A session the form cannot use is still named by its
  // sdk_authorization when that can be read, so the logs that explain why can be found.
  let loggedAuthorization = switch sessionState {
  | Ready(_) => authorization
  | Unusable(_) => sdkAuthorization->Option.getOr("")
  }
  let (merchantId, paymentId) = React.useMemo1(
    () => (
      loggedAuthorization->VaultConfirm.publishableKeyOf,
      loggedAuthorization->VaultConfirm.resolveSessionId->Result.getOr(""),
    ),
    [loggedAuthorization],
  )
  // Queued logs go out when the form closes or the app leaves the foreground, as web sends them when
  // the page unloads.
  React.useEffect1(() => {
    let subscription = ReactNative.AppState.addEventListener(
      #change(
        state =>
          if state !== #active {
            logger->VaultLogger.sendLogs
          },
      ),
    )
    Some(
      () => {
        subscription->ReactNative.EventSubscription.remove
        logger->VaultLogger.sendLogs
      },
    )
  }, [logger])
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
    ~logger,
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

  // How the merchant set the form up: once per logger session, and again when a setting or the
  // session's status changes (not when a save uses the session up). A session the form was given
  // but cannot save a card with makes it an error, so it goes out at once; a blank sdkAuthorization
  // is no session yet, as when the merchant is still fetching one. It waits for the fields, which
  // register in their own effects and which the payment-methods SDK mounts only once the form is
  // ready; a form that gets none within a second is logged without them.
  let noSessionYet =
    session->Option.isNone &&
    vaultDetails->Option.isNone &&
    sdkAuthorization->Option.mapOr(true, authorization => authorization->String.trim === "")
  let loggedSessionStatus = switch sessionStatus {
  | #invalid if noSessionYet => "absent"
  | status => (status :> string)
  }
  let sessionProblem = switch sessionState {
  | Unusable(problem) => problem
  | Ready(_) => ""
  }
  let mountedFields = [
    (VaultCardController.CardNumberKind, "cardNumber"),
    (VaultCardController.ExpiryKind, "cardExpiry"),
    (VaultCardController.CvcKind, "cardCvc"),
    (VaultCardController.CardholderNameKind, "cardholderName"),
  ]->Array.filterMap(((kind, name)) => countOf(kind) > 0 ? Some(name) : None)
  let settings = VaultLogValues.optionsValue({
    environment: (environment :> string),
    sessionStatus: loggedSessionStatus,
    sessionProblem,
    customEndpoints,
    enabledCardSchemes: acceptedSchemes,
    unknownCardSchemes: enabledCardSchemes->CardNetworkNames.unknownOf,
    cardholderNameMode: (cardholderNameMode :> string),
    locale: locale->Option.getOr(""),
    fields: mountedFields,
    savedCard: switch presenceGate() {
    | Ok(VaultFormCoordinator.SavedCardCvc(_)) => true
    | Ok(NewCard) | Error(_) => false
    },
  })
  let hasFields = mountedFields->Array.length > 0
  let loggedSettingsRef = React.useRef("")
  React.useEffect4(() => {
    let key = `${logger.sessionId}|${settings}`
    let logSettings = () =>
      if loggedSettingsRef.current !== key {
        loggedSettingsRef.current = key
        logger->VaultLogger.setLogInfo(
          ~eventName=PAYMENT_ELEMENT_OPTIONS,
          ~value=settings,
          ~logType=loggedSessionStatus->VaultLogValues.isUnusableSession ? ERROR : DEBUG,
          ~merchantId,
          ~paymentId,
        )
      }
    if loggedSessionStatus === "consumed" || loggedSettingsRef.current === key {
      None
    } else if hasFields {
      logSettings()
      None
    } else {
      let timer = setTimeout(logSettings, 1000)
      Some(() => clearTimeout(timer))
    }
  }, (settings, authorization, logger, hasFields))

  // The card fields' user events. The co-badged network picker is logged as web's
  // CardSchemeComponent logs it. FOCUS and BLUR record the customer moving between fields, by field
  // name only; web logs those two names only when the merchant calls focus() or blur(). BLUR adds
  // what the customer left in the field, and APP_RENDERED is each field first showing, as each of
  // web's field frames logs its own.
  let logUserEvent = (~eventName, ~value) =>
    logger->VaultLogger.setLogInfo(~eventName, ~value, ~merchantId, ~paymentId)
  // The field's public name: VaultPublicState's elementType, as in focus() and state.field.
  let fieldName = (field: CardFormTypes.cardFieldId) =>
    switch field {
    | CardNumberField => (#cardNumber: VaultPublicState.elementType :> string)
    | ExpiryField => (#cardExpiry: VaultPublicState.elementType :> string)
    | CvcField => (#cardCvc: VaultPublicState.elementType :> string)
    | CardholderNameField => (#cardholderName: VaultPublicState.elementType :> string)
    }
  let fieldStatus = (field: CardFormTypes.cardFieldId) => {
    let snapshot = controller.publicSnapshot()
    let statusOf = (
      change: VaultPublicState.fieldChange,
      ~invalidCode,
      ~unsupportedNetwork=false,
    ) =>
      VaultLogValues.fieldStatus(
        ~empty=change.empty,
        ~complete=change.complete,
        ~invalidCode,
        ~unsupportedNetwork,
      )
    switch field {
    | CardNumberField =>
      snapshot.cardNumber->statusOf(
        ~invalidCode="invalid_card_number",
        ~unsupportedNetwork=snapshot.networkError->Option.isSome,
      )
    | ExpiryField => snapshot.cardExpiry->statusOf(~invalidCode="invalid_expiry")
    | CvcField => snapshot.cardCvc->statusOf(~invalidCode="invalid_cvc")
    | CardholderNameField => snapshot.cardholderName->statusOf(~invalidCode="")
    }
  }
  let onAnalytics = (event: CardFormTypes.analyticsEvent) =>
    switch event {
    | FieldFocused(field) => logUserEvent(~eventName=FOCUS, ~value=field->fieldName)
    | FieldBlurred(field) =>
      logUserEvent(
        ~eventName=BLUR,
        ~value=VaultLogValues.blurValue(~field=field->fieldName, ~status=field->fieldStatus),
      )
    | FieldRendered(field, latency) =>
      logger->VaultLogger.setLogInfo(
        ~eventName=APP_RENDERED,
        ~value=field->fieldName,
        ~latency,
        ~logType=DEBUG,
        ~merchantId,
        ~paymentId,
      )
    | CardNetworkMenu(Opened) =>
      logUserEvent(~eventName=CARD_SCHEME_SELECTION, ~value="CardSchemeMenu expanded")
    | CardNetworkMenu(Closed) =>
      logUserEvent(~eventName=CARD_SCHEME_SELECTION, ~value="CardSchemeMenu closed")
    }

  // A crash inside a field, once per logger session for each distinct error: React can render a
  // failing component more than once before the error leaves the form.
  let crashesLoggedRef = React.useRef(Dict.make())
  let onCrash = (componentName, thrown) => {
    let key = `${logger.sessionId}|${componentName}|${thrown->VaultLogger.crashSignature}`
    if crashesLoggedRef.current->Dict.get(key)->Option.isNone {
      crashesLoggedRef.current->Dict.set(key, true)
      logger->VaultLogger.logCrash(~thrown, ~componentName, ~merchantId, ~paymentId)
    }
  }

  // Once per logger session, as web logs it once per frame.
  let coBadgedLoggedInRef = React.useRef("")
  React.useEffect3(() => {
    if controller.values.isCoBadged && coBadgedLoggedInRef.current !== logger.sessionId {
      coBadgedLoggedInRef.current = logger.sessionId
      logUserEvent(~eventName=CARD_SCHEME_SELECTION, ~value="Card detected as co-badged")
    }
    None
  }, (controller.values.isCoBadged, authorization, logger))

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
      onAnalytics,
      onCrash,
      unstyled,
      defaultErrorDisplay,
      defaultLabelBehavior,
    },
    machinery,
    focusField: controller.focusField,
  }
}
