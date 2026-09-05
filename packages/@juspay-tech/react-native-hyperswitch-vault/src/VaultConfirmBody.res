@genType
type paymentMethodType = [#credit | #debit]

@genType
type paymentType = [#new_mandate | #setup_mandate]

@genType
type acceptanceType = [#online | #offline]

@genType
type confirmTokenMode = [#payment_token | #vault_card]

@genType
type hostBrowserInfo = {
  userAgent?: string,
  acceptHeader?: string,
  language?: string,
  colorDepth?: int,
  screenHeight?: int,
  screenWidth?: int,
  timeZone?: int,
  javaEnabled?: bool,
  javaScriptEnabled?: bool,
  deviceModel?: string,
  osType?: string,
  osVersion?: string,
}

@genType
type hostOnlineAcceptance = {userAgent?: string}

@genType
type hostCustomerAcceptance = {
  acceptanceType: acceptanceType,
  acceptedAt: string,
  online: hostOnlineAcceptance,
}

let paymentMethodTypeToWire = (value: paymentMethodType) =>
  switch value {
  | #credit => "credit"
  | #debit => "debit"
  }

let paymentTypeToWire = (value: paymentType) =>
  switch value {
  | #new_mandate => "new_mandate"
  | #setup_mandate => "setup_mandate"
  }

let acceptanceTypeToWire = (value: acceptanceType) =>
  switch value {
  | #online => "online"
  | #offline => "offline"
  }

let backendCardNetworks = [
  "Visa",
  "Mastercard",
  "AmericanExpress",
  "JCB",
  "DinersClub",
  "Discover",
  "CartesBancaires",
  "UnionPay",
  "Interac",
  "RuPay",
  "Maestro",
  "Star",
  "Pulse",
  "Accel",
  "Nyce",
]

let cardNetworkToWire = (network: option<string>): option<string> =>
  network->Option.flatMap(name => {
    let trimmed = name->String.trim
    backendCardNetworks->Array.some(known => known === trimmed) ? Some(trimmed) : None
  })

let stringEntry = VaultPaymentMethodData.entry

let intEntry = (key: string, value: option<int>) =>
  value->Option.map(number => (key, number->Int.toFloat->JSON.Encode.float))

let boolEntry = (key: string, value: option<bool>) =>
  value->Option.map(flag => (key, flag->JSON.Encode.bool))

let encodeBrowserInfo = (info: hostBrowserInfo): option<JSON.t> =>
  VaultPaymentMethodData.objectOf([
    stringEntry("user_agent", info.userAgent),
    stringEntry("accept_header", info.acceptHeader),
    stringEntry("language", info.language),
    intEntry("color_depth", info.colorDepth),
    intEntry("screen_height", info.screenHeight),
    intEntry("screen_width", info.screenWidth),
    intEntry("time_zone", info.timeZone),
    boolEntry("java_enabled", info.javaEnabled),
    boolEntry("java_script_enabled", info.javaScriptEnabled),
    stringEntry("device_model", info.deviceModel),
    stringEntry("os_type", info.osType),
    stringEntry("os_version", info.osVersion),
  ])

let encodeCustomerAcceptance = (acceptance: hostCustomerAcceptance): JSON.t => {
  let online =
    VaultPaymentMethodData.objectOf([stringEntry("user_agent", acceptance.online.userAgent)])
    ->Option.getOr(Dict.make()->JSON.Encode.object)

  [
    ("acceptance_type", acceptance.acceptanceType->acceptanceTypeToWire->JSON.Encode.string),
    ("accepted_at", acceptance.acceptedAt->JSON.Encode.string),
    ("online", online),
  ]
  ->Dict.fromArray
  ->JSON.Encode.object
}

let vaultCardSubtree = (~token: string, ~metadata: VaultConfirm.vaultCardMetadata): JSON.t =>
  [
    ("card_cvc", token->JSON.Encode.string),
    ("card_number", token->JSON.Encode.string),
    ("card_exp_month", metadata.expiryMonth->JSON.Encode.string),
    ("card_exp_year", metadata.expiryYear->JSON.Encode.string),
    ("last_four", metadata.last4Digits->JSON.Encode.string),
  ]
  ->Array.concat(VaultConfirm.optionalEntry("bin_number", metadata.binNumber))
  ->Dict.fromArray
  ->JSON.Encode.object

@genType
type providerTokenizedCard = {
  cardNumberAlias: string,
  cardCvcAlias: string,
  expiryMonth: string,
  expiryYear: string,
  cardHolderName?: string,
  cardNetwork?: string,
  lastFour?: string,
  binNumber?: string,
  nickName?: string,
}

let padExpiryMonth = (month: string) => {
  let trimmed = month->String.trim
  trimmed->String.length === 1 ? `0${trimmed}` : trimmed
}

let externalCardSubtree = (~card: providerTokenizedCard): JSON.t =>
  [
    ("card_number", card.cardNumberAlias->String.trim->JSON.Encode.string),
    ("card_cvc", card.cardCvcAlias->String.trim->JSON.Encode.string),
    ("card_exp_month", card.expiryMonth->padExpiryMonth->JSON.Encode.string),
    ("card_exp_year", card.expiryYear->VaultConfirm.requestExpiryYear->JSON.Encode.string),
  ]
  ->Array.concat(VaultConfirm.optionalEntry("card_holder_name", card.cardHolderName))
  ->Array.concat(VaultConfirm.optionalEntry("card_network", card.cardNetwork->cardNetworkToWire))
  ->Array.concat(VaultConfirm.optionalEntry("last_four", card.lastFour))
  ->Array.concat(VaultConfirm.optionalEntry("bin_number", card.binNumber))
  ->Array.concat(VaultConfirm.optionalEntry("nick_name", card.nickName))
  ->Dict.fromArray
  ->JSON.Encode.object

let directCardSubtree = (
  ~card: VaultConfirm.cardDetails,
  ~cardholderName: option<string>,
  ~cardNetwork: option<string>,
  ~nickName: option<string>,
): JSON.t =>
  [
    ("card_number", card.cardNumber->Validation.clearSpaces->JSON.Encode.string),
    ("card_exp_month", card.expiryMonth->JSON.Encode.string),
    ("card_exp_year", card.expiryYear->VaultConfirm.requestExpiryYear->JSON.Encode.string),
    ("card_cvc", card.cvc->JSON.Encode.string),
  ]
  ->Array.concat(VaultConfirm.optionalEntry("card_holder_name", cardholderName))

  ->Array.concat(VaultConfirm.optionalEntry("card_network", cardNetwork->cardNetworkToWire))

  ->Array.concat(VaultConfirm.optionalEntry("nick_name", nickName))
  ->Dict.fromArray
  ->JSON.Encode.object

type cardPayload =
  | TokenPayload({
      mode: confirmTokenMode,
      token: string,
      metadata: VaultConfirm.vaultCardMetadata,
    })
  | DirectPayload({
      card: VaultConfirm.cardDetails,
      cardholderName: option<string>,
      cardNetwork: option<string>,
      nickName: option<string>,
    })

  | ExternalTokenPayload({card: providerTokenizedCard})

let build = (
  ~cardPayload: cardPayload,
  ~paymentMethodType: option<paymentMethodType>,
  ~paymentMethodData: option<VaultPaymentMethodData.hostPaymentMethodData>,
  ~customerAcceptance: option<hostCustomerAcceptance>,
  ~browserInfo: option<hostBrowserInfo>,
  ~returnUrl: option<string>,
  ~paymentType: option<paymentType>,
  ~email: option<string>,
  ~clientSecret: option<string>,
): JSON.t => {
  let hostData = paymentMethodData->VaultPaymentMethodData.encodeHostPaymentMethodData

  let cardSubtree = switch cardPayload {
  | TokenPayload({mode: #vault_card, token, metadata}) =>
    Some(("vault_card", vaultCardSubtree(~token, ~metadata)))
  | TokenPayload({mode: #payment_token}) => None
  | DirectPayload({card, cardholderName, cardNetwork, nickName}) =>
    Some(("card", directCardSubtree(~card, ~cardholderName, ~cardNetwork, ~nickName)))
  | ExternalTokenPayload({card}) => Some(("vault_card", externalCardSubtree(~card)))
  }

  let finalPaymentMethodData =
    VaultPaymentMethodData.buildFinalPaymentMethodData(~hostData, ~cardSubtree)

  let entries = [
    Some(("payment_method", "card"->JSON.Encode.string)),
    Some((
      "payment_method_type",
      paymentMethodType->Option.getOr(#credit)->paymentMethodTypeToWire->JSON.Encode.string,
    )),
    switch cardPayload {
    | TokenPayload({mode: #payment_token, token}) => Some(("payment_token", token->JSON.Encode.string))
    | TokenPayload({mode: #vault_card}) => None

    | DirectPayload(_) => None

    | ExternalTokenPayload(_) => None
    },
    finalPaymentMethodData->Option.map(data => ("payment_method_data", data)),
    customerAcceptance->Option.map(acceptance => (
      "customer_acceptance",
      acceptance->encodeCustomerAcceptance,
    )),
    browserInfo->Option.flatMap(encodeBrowserInfo)->Option.map(info => ("browser_info", info)),
    stringEntry("return_url", returnUrl),
    paymentType->Option.map(value => (
      "payment_type",
      value->paymentTypeToWire->JSON.Encode.string,
    )),
    stringEntry("email", email),

    stringEntry("client_secret", clientSecret),
  ]

  entries->Array.filterMap(item => item)->Dict.fromArray->JSON.Encode.object
}
