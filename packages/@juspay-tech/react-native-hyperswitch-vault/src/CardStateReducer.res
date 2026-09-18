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

// The detected schemes the card may confirm with. `enabledSchemes` holds the
// merchant's accepted networks in canonical form (CardNetworkNames.normaliseList);
// an empty list means "every detected scheme".
let eligibleSchemes = (state: state, ~enabledSchemes: array<string>) =>
  enabledSchemes->Array.length === 0
    ? state.matchedSchemes
    : state.matchedSchemes->Array.filter(scheme =>
        enabledSchemes->Array.some(enabled => enabled === scheme)
      )

// The network in force, by precedence:
//   1. a saved card's stored network;
//   2. the user's pick, while it is still one of the eligible schemes;
//   3. the ONLY eligible scheme (a single-network card, or a co-badged card of
//      which the merchant enabled exactly one network): selected automatically,
//      no chooser;
//   4. with several eligible schemes and no pick yet, the detected brand when it
//      is eligible, else the first eligible scheme, until the user picks;
//   5. with no eligible scheme, the detected brand, so the network validator
//      reports it as unsupported.
// With no enabled schemes this reduces to the pick or the detected brand, the
// historical behaviour.
let effectiveNetwork = (state: state, ~enabledSchemes: array<string>) =>
  switch state.savedCard {
  | Some(saved) => saved.network
  | None =>
    let eligible = state->eligibleSchemes(~enabledSchemes)
    let picked = state.selectedNetwork
    if picked !== "" && eligible->Array.some(scheme => scheme === picked) {
      picked
    } else {
      switch eligible {
      | [only] => only
      | [] => state.brand
      | several =>
        several->Array.some(scheme => scheme === state.brand)
          ? state.brand
          : several->Array.get(0)->Option.getOr(state.brand)
      }
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

let errorsFor = (
  state: state,
  ~validators: validators,
  ~enabledSchemes: array<string>,
): errors => {
  let savedMode = state.savedCard->Option.isSome
  let network = state->effectiveNetwork(~enabledSchemes)
  {
    cardNumber: savedMode ? None : validators.cardNumber(Some(state.cardNumber)),
    expiry: savedMode ? None : validators.expiry(state.expiryDisplay)(Some(state.expiryYear)),

    cvc: validators.cvc(network)(Some(state.cvc)),
    network: savedMode
      ? None
      : validators.network->Option.flatMap(validate => validate(Some(network))),
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
