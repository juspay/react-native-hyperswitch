type field = [#cardNumber | #cardExpiry | #cardCvc | #cardholderName | #network]

type fieldMeta = {touched: bool, active: bool}

let untouched = {touched: false, active: false}

type eligibility =
  | Unknown
  | Pending
  | Allowed
  | Denied

type savedCard = {token: string, network: string}

type state = {
  cardNumber: string,
  expiryDisplay: string,
  expiryMonth: string,
  expiryYear: string,
  cvc: string,
  cardholderName: string,

  brand: string,
  matchedSchemes: array<string>,

  selectedNetwork: string,
  eligibility: eligibility,
  numberMeta: fieldMeta,
  expiryMeta: fieldMeta,
  cvcMeta: fieldMeta,
  cardholderMeta: fieldMeta,
  networkMeta: fieldMeta,
  submitAttempted: bool,

  cardVersion: int,
  savedCard: option<savedCard>,
}

let initial = {
  cardNumber: "",
  expiryDisplay: "",
  expiryMonth: "",
  expiryYear: "",
  cvc: "",
  cardholderName: "",
  brand: "",
  matchedSchemes: [],
  selectedNetwork: "",
  eligibility: Unknown,
  numberMeta: untouched,
  expiryMeta: untouched,
  cvcMeta: untouched,
  cardholderMeta: untouched,
  networkMeta: untouched,
  submitAttempted: false,
  cardVersion: 0,
  savedCard: None,
}

type action =
  | NumberChanged(CardFieldLogic.numberChange)
  | ExpiryChanged(CardFieldLogic.expiryChange)
  | CvcChanged(CardFieldLogic.cvcChange)
  | CardholderNameChanged(string)
  | NetworkSelected(string)
  | EligibilityChanged(eligibility)
  | SavedCardChanged(option<savedCard>)
  | Focused(field)
  | Blurred(field)

  | Cleared(field)
  | SubmitAttempted
  | Reset

let effectiveNetwork = (state: state) =>
  switch state.savedCard {
  | Some(saved) => saved.network
  | None =>
    switch state.selectedNetwork {
    | "" => state.brand
    | picked =>
      state.matchedSchemes->Array.some(scheme => scheme === picked) ? picked : state.brand
    }
  }

let coBadgeThreshold = 16

let isCoBadged = (state: state) =>
  state.savedCard->Option.isNone &&
  state.matchedSchemes->Array.length > 1 &&
  state.cardNumber->Validation.clearSpaces->String.length >= coBadgeThreshold

let withMeta = (state, field, update) =>
  switch field {
  | #cardNumber => {...state, numberMeta: update(state.numberMeta)}
  | #cardExpiry => {...state, expiryMeta: update(state.expiryMeta)}
  | #cardCvc => {...state, cvcMeta: update(state.cvcMeta)}
  | #cardholderName => {...state, cardholderMeta: update(state.cardholderMeta)}
  | #network => {...state, networkMeta: update(state.networkMeta)}
  }

let reduce = (state: state, action: action): state =>
  switch action {
  | NumberChanged(change) =>
    let cleared = change.clearDependents
    {
      ...state,
      cardNumber: change.formatted,
      brand: change.brand,
      matchedSchemes: change.matchedSchemes,

      selectedNetwork: change.matchedSchemes->Array.some(scheme => scheme === state.selectedNetwork)
        ? state.selectedNetwork
        : "",

      eligibility: Unknown,
      expiryDisplay: cleared ? "" : state.expiryDisplay,
      expiryMonth: cleared ? "" : state.expiryMonth,
      expiryYear: cleared ? "" : state.expiryYear,
      cvc: cleared ? "" : state.cvc,
      cardVersion: state.cardVersion + 1,
    }
  | ExpiryChanged(change) => {
      ...state,
      expiryDisplay: change.display,
      expiryMonth: change.month,
      expiryYear: change.year,
      cardVersion: state.cardVersion + 1,
    }
  | CvcChanged(change) => {...state, cvc: change.formatted, cardVersion: state.cardVersion + 1}
  | CardholderNameChanged(name) => {
      ...state,
      cardholderName: name,
      cardVersion: state.cardVersion + 1,
    }

  | NetworkSelected(network) => {
      ...state,
      selectedNetwork: network,
      networkMeta: {...state.networkMeta, touched: true},
      cardVersion: state.cardVersion + 1,
    }

  | EligibilityChanged(verdict) => {...state, eligibility: verdict}

  | SavedCardChanged(saved) =>
    let sameCard = switch (state.savedCard, saved) {
    | (None, None) => true
    | (Some(a), Some(b)) => a.token === b.token
    | _ => false
    }
    switch (state.savedCard, saved) {
    | (None, None) => state
    | _ =>
      sameCard
        ? {...state, savedCard: saved}
        : {...state, savedCard: saved, cvc: "", cvcMeta: untouched, cardVersion: state.cardVersion + 1}
    }
  | Focused(field) => state->withMeta(field, meta => {...meta, active: true})
  | Blurred(field) => state->withMeta(field, _ => {touched: true, active: false})
  | Cleared(field) =>
    switch field {
    | #cardNumber => {
        ...state,
        cardNumber: "",
        brand: "",
        matchedSchemes: [],
        selectedNetwork: "",
        eligibility: Unknown,
        numberMeta: untouched,
        cardVersion: state.cardVersion + 1,
      }
    | #cardExpiry => {
        ...state,
        expiryDisplay: "",
        expiryMonth: "",
        expiryYear: "",
        expiryMeta: untouched,
        cardVersion: state.cardVersion + 1,
      }
    | #cardCvc => {...state, cvc: "", cvcMeta: untouched, cardVersion: state.cardVersion + 1}
    | #cardholderName => {
        ...state,
        cardholderName: "",
        cardholderMeta: untouched,
        cardVersion: state.cardVersion + 1,
      }
    | #network => {...state, selectedNetwork: "", networkMeta: untouched}
    }
  | SubmitAttempted => {
      ...state,
      submitAttempted: true,
      numberMeta: {...state.numberMeta, touched: true},
      expiryMeta: {...state.expiryMeta, touched: true},
      cvcMeta: {...state.cvcMeta, touched: true},
      cardholderMeta: {...state.cardholderMeta, touched: true},
      networkMeta: {...state.networkMeta, touched: true},
    }

  | Reset => {...initial, savedCard: state.savedCard, cardVersion: state.cardVersion + 1}
  }

type validators = {
  cardNumber: option<string> => option<string>,
  expiry: string => option<string> => option<string>,
  cvc: string => option<string> => option<string>,
  network: option<option<string> => option<string>>,

  notEligible: option<string>,
}

type errors = {
  cardNumber: option<string>,
  expiry: option<string>,
  cvc: option<string>,
  network: option<string>,
  eligibility: option<string>,
}

let errorsFor = (state: state, ~validators: validators): errors => {
  let savedMode = state.savedCard->Option.isSome
  {
    cardNumber: savedMode ? None : validators.cardNumber(Some(state.cardNumber)),
    expiry: savedMode ? None : validators.expiry(state.expiryDisplay)(Some(state.expiryYear)),

    cvc: validators.cvc(state->effectiveNetwork)(Some(state.cvc)),
    network: savedMode
      ? None
      : validators.network->Option.flatMap(validate => validate(Some(state->effectiveNetwork))),
    eligibility: switch state.eligibility {
    | Denied => validators.notEligible
    | Unknown
    | Pending
    | Allowed => None
    },
  }
}

let isValid = (errors: errors) =>
  errors.cardNumber->Option.isNone &&
  errors.expiry->Option.isNone &&
  errors.cvc->Option.isNone &&
  errors.network->Option.isNone

let shownFor = (meta: fieldMeta, error: option<string>) =>
  meta.touched && !meta.active ? error : None

let okFor = (meta: fieldMeta, error: option<string>) =>
  error->Option.isNone || !meta.touched || meta.active

let numberError = (state, errors: errors) => shownFor(state.numberMeta, errors.cardNumber)
let expiryError = (state, errors: errors) => shownFor(state.expiryMeta, errors.expiry)
let cvcError = (state, errors: errors) => shownFor(state.cvcMeta, errors.cvc)

let networkError = (state, errors: errors) =>
  state.networkMeta.touched ? errors.network : None

let eligibilityError = (_state, errors: errors) => errors.eligibility

let numberFieldOk = (state, errors: errors) => okFor(state.numberMeta, errors.cardNumber)
let expiryFieldOk = (state, errors: errors) => okFor(state.expiryMeta, errors.expiry)
let cvcFieldOk = (state, errors: errors) => okFor(state.cvcMeta, errors.cvc)
