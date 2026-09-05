open ReactNative

type widgetKind = VaultCardStore.widgetKind =
  | CardNumberKind
  | ExpiryKind
  | CvcKind
  | CardholderNameKind

let kindLabel = kind =>
  switch kind {
  | CardNumberKind => "CardNumberField"
  | ExpiryKind => "CardExpiryField"
  | CvcKind => "CardCVCField"
  | CardholderNameKind => "CardholderNameField"
  }

type controller = {
  values: CardFormTypes.cardFieldValues,
  visibleErrors: CardFormTypes.cardFieldErrors,
  fieldOk: CardFormTypes.cardFieldOk,

  publicSnapshot: unit => VaultPublicState.controllerSnapshot,
  onNumberChange: CardFieldLogic.numberChange => unit,
  onExpiryChange: CardFieldLogic.expiryChange => unit,
  onCvcChange: CardFieldLogic.cvcChange => unit,
  onFocus: CardStateReducer.field => unit,
  onBlur: CardStateReducer.field => unit,
  onBackspace: (CardStateReducer.field, CardFieldLogic.backspaceAction) => unit,
  isValid: bool,
  isValidNow: unit => bool,
  cardDetails: unit => VaultConfirm.cardDetails,

  cardholderName: unit => string,

  cardNetwork: unit => option<string>,

  selectNetwork: string => unit,

  scanCard: unit => unit,

  cardVersion: unit => int,

  eligibilityVerdict: unit => option<VaultEligibility.verdict>,
  recordEligibility: VaultEligibility.verdict => unit,
  markEligibilityPending: unit => unit,

  eligibilityProbe: unit => CardFieldLogic.eligibilityProbe,
  onCardholderNameChange: string => unit,
  markSubmitAttempted: unit => unit,
  reset: unit => unit,

  clearField: CardStateReducer.field => unit,

  setSavedCard: option<CardStateReducer.savedCard> => unit,
  savedCard: unit => option<CardStateReducer.savedCard>,
  focusField: VaultPublicState.elementType => unit,
  register: widgetKind => unit => unit,
  countOf: widgetKind => int,
  registryVersion: int,
  cardRef: React.ref<Nullable.t<TextInput.element>>,
  expiryRef: React.ref<Nullable.t<TextInput.element>>,
  cvcRef: React.ref<Nullable.t<TextInput.element>>,
  cardholderRef: React.ref<Nullable.t<TextInput.element>>,
  safeState: CardFormTypes.cardFieldValues => unit,
}

let focusRef = (ref: React.ref<Nullable.t<TextInput.element>>) =>
  switch ref.current->Nullable.toOption {
  | None => ()
  | Some(node) => node->TextInputElement.focus
  }

let blurRef = (ref: React.ref<Nullable.t<TextInput.element>>) =>
  switch ref.current->Nullable.toOption {
  | None => ()
  | Some(node) => node->TextInputElement.blur
  }

let use = (
  ~store: VaultCardStore.t,
  ~validators: CardStateReducer.validators,
  ~enabledCardSchemes: array<string>,
) => {
  let state = React.useSyncExternalStore(
    ~subscribe=VaultCardStore.subscribe(store, ...),
    ~getSnapshot=VaultCardStore.getState(store, ...),
  )
  let dispatch = VaultCardStore.dispatch(store, ...)

  let cardRef = store.cardRef
  let expiryRef = store.expiryRef
  let cvcRef = store.cvcRef
  let cardholderRef = store.cardholderRef

  let registryVersion = React.useSyncExternalStore(
    ~subscribe=VaultCardStore.subscribe(store, ...),
    ~getSnapshot=VaultCardStore.getRegistryVersion(store, ...),
  )

  let register = kind => VaultCardStore.register(store, kind)
  let countOf = kind => VaultCardStore.countOf(store, kind)

  let errors = state->CardStateReducer.errorsFor(~validators)

  let latestRef = React.useRef((state, errors))
  latestRef.current = (state, errors)

  let onNumberChange = (change: CardFieldLogic.numberChange) => {
    dispatch(NumberChanged(change))
    if change.advanceFocus {
      focusRef(expiryRef)
    }
  }

  let onExpiryChange = (change: CardFieldLogic.expiryChange) => {
    dispatch(ExpiryChanged(change))
    if change.advanceFocus {
      focusRef(cvcRef)
    }
  }

  let onCvcChange = (change: CardFieldLogic.cvcChange) => {
    dispatch(CvcChanged(change))
  }

  let onBackspace = (_field, action: CardFieldLogic.backspaceAction) =>
    switch action {
    | #blurSelf => blurRef(cardRef)
    | #focusCardNumber => focusRef(cardRef)
    | #focusExpiry => focusRef(expiryRef)
    | #none => ()
    }

  let eligibleSchemes =
    enabledCardSchemes->Array.length === 0
      ? state.matchedSchemes
      : state.matchedSchemes->Array.filter(scheme =>
          enabledCardSchemes->Array.some(enabled => enabled === scheme)
        )

  let eligibilityStatus: VaultPublicState.vaultEligibilityStatus = switch state.eligibility {
  | Unknown => #unknown
  | Pending => #pending
  | Allowed => #allowed
  | Denied => #denied
  }

  let networkInForce = state->CardStateReducer.effectiveNetwork
  let isCoBadged = state->CardStateReducer.isCoBadged && eligibleSchemes->Array.length > 1

  let publicSnapshot = (): VaultPublicState.controllerSnapshot => {
    let brand = VaultPublicState.brandOf(networkInForce)
    {
      cardNumber: VaultPublicState.fieldChangeOf(
        {
          value: state.cardNumber,
          accepted: errors.cardNumber->Option.isNone,
          touched: state.numberMeta.touched,
          visibleError: CardStateReducer.numberError(state, errors),
          invalidCode: #invalid_card_number,
        },
        ~elementType=#cardNumber,
        ~brand,
        ~isCoBadged=Some(isCoBadged),
        ~eligibility=Some(eligibilityStatus),
      ),
      cardExpiry: VaultPublicState.fieldChangeOf(
        {
          value: state.expiryDisplay,
          accepted: errors.expiry->Option.isNone,
          touched: state.expiryMeta.touched,
          visibleError: CardStateReducer.expiryError(state, errors),
          invalidCode: #invalid_expiry,
        },
        ~elementType=#cardExpiry,
      ),

      cardCvc: VaultPublicState.fieldChangeOf(
        {
          value: state.cvc,
          accepted: errors.cvc->Option.isNone,
          touched: state.cvcMeta.touched,
          visibleError: CardStateReducer.cvcError(state, errors),
          invalidCode: #invalid_cvc,
        },
        ~elementType=#cardCvc,
        ~brand,
      ),
      cardholderName: VaultPublicState.cardholderNameChangeOf(
        ~value=state.cardholderName,
        ~touched=state.cardholderMeta.touched,
      ),

      networkError: errors.network->Option.map((
        message,
      ): VaultPublicState.vaultFieldError => {code: #unsupported_network, message}),
      eligibility: eligibilityStatus,

      cardDetails: VaultPublicState.cardDetailsOf(
        PaymentEventData.buildCardInfo(
          ~cardNumber=state.cardNumber,
          ~expiry=state.expiryDisplay,
          ~cvc=state.cvc,
          ~brand=networkInForce,
        ),
      ),
    }
  }

  {
    publicSnapshot,
    values: {
      cardNumber: state.cardNumber,
      expiryDisplay: state.expiryDisplay,
      cvc: state.cvc,
      cardholderName: state.cardholderName,
      brand: networkInForce,
      eligibleSchemes,

      isCoBadged,
      savedCard: state.savedCard,
    },
    visibleErrors: {
      cardNumber: ?CardStateReducer.numberError(state, errors),
      cardExpiry: ?CardStateReducer.expiryError(state, errors),
      cardCvc: ?CardStateReducer.cvcError(state, errors),
      network: ?CardStateReducer.networkError(state, errors),
      eligibility: ?CardStateReducer.eligibilityError(state, errors),
    },
    fieldOk: {
      cardNumber: CardStateReducer.numberFieldOk(state, errors),
      cardExpiry: CardStateReducer.expiryFieldOk(state, errors),
      cardCvc: CardStateReducer.cvcFieldOk(state, errors),
    },
    onNumberChange,
    onExpiryChange,
    onCvcChange,
    onFocus: field => dispatch(Focused(field)),
    onBlur: field => dispatch(Blurred(field)),
    onBackspace,
    isValid: CardStateReducer.isValid(errors),
    isValidNow: () => {
      let (_, latestErrors) = latestRef.current
      CardStateReducer.isValid(latestErrors)
    },
    cardDetails: () => {
      let (latest, _) = latestRef.current
      {
        VaultConfirm.cardNumber: latest.cardNumber,
        expiryMonth: latest.expiryMonth,
        expiryYear: latest.expiryYear,
        cvc: latest.cvc,
      }
    },
    cardholderName: () => {
      let (latest, _) = latestRef.current
      latest.cardholderName
    },
    cardNetwork: () => {
      let (latest, _) = latestRef.current

      if latest.matchedSchemes->Array.length > 1 {
        let network = latest->CardStateReducer.effectiveNetwork
        network->String.length > 0 ? Some(network) : None
      } else {
        None
      }
    },
    selectNetwork: network => dispatch(NetworkSelected(network)),

    scanCard: () =>
      ScanCardBridge.launch(outcome =>
        switch outcome {
        | ScanCardBridge.Succeeded(data) =>
          dispatch(NumberChanged(CardFieldLogic.onCardNumberText(data.pan, ~currentBrand="")))
          let display = data->ScanCardBridge.expiryDisplay
          if display->String.length > 0 {
            dispatch(ExpiryChanged(CardFieldLogic.onExpiryText(display)))
          }
          focusRef(cvcRef)
        | ScanCardBridge.Failed
        | ScanCardBridge.Cancelled
        | ScanCardBridge.NoResult => ()
        }
      ),
    cardVersion: () => {
      let (latest, _) = latestRef.current
      latest.cardVersion
    },
    eligibilityVerdict: () => {
      let (latest, _) = latestRef.current
      switch latest.eligibility {
      | Allowed => Some(VaultEligibility.Allowed)
      | Denied => Some(VaultEligibility.Denied)
      | Pending
      | Unknown => None
      }
    },
    recordEligibility: verdict =>
      dispatch(
        EligibilityChanged(
          switch verdict {
          | VaultEligibility.Allowed => Allowed
          | VaultEligibility.Denied => Denied
          },
        ),
      ),
    markEligibilityPending: () => dispatch(EligibilityChanged(Pending)),
    eligibilityProbe: () => {
      let (latest, _) = latestRef.current
      CardFieldLogic.eligibilityFor(
        ~cardNumber=latest.cardNumber,
        ~brand=latest->CardStateReducer.effectiveNetwork,
        ~alreadyAllowed=latest.eligibility === Allowed,
      )
    },
    onCardholderNameChange: name => dispatch(CardholderNameChanged(name)),
    markSubmitAttempted: () => dispatch(SubmitAttempted),
    reset: () => dispatch(Reset),
    clearField: field => dispatch(Cleared(field)),
    setSavedCard: saved => dispatch(SavedCardChanged(saved)),
    savedCard: () => {
      let (latest, _) = latestRef.current
      latest.savedCard
    },
    focusField: field =>
      switch field {
      | #cardNumber => focusRef(cardRef)
      | #cardExpiry => focusRef(expiryRef)
      | #cardCvc => focusRef(cvcRef)
      | #cardholderName => focusRef(cardholderRef)
      },
    register,
    countOf,
    registryVersion,
    cardRef,
    expiryRef,
    cvcRef,
    cardholderRef,
    safeState: _ => (),
  }
}
