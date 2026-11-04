@genType
type hostBillingAddress = {
  firstName?: string,
  lastName?: string,
  line1?: string,
  line2?: string,
  line3?: string,
  city?: string,
  state?: string,
  country?: string,
  zip?: string,
}

@genType
type hostPhone = {
  number?: string,
  countryCode?: string,
}

@genType
type hostBilling = {
  address?: hostBillingAddress,
  email?: string,
  phone?: hostPhone,
}

@genType
type hostPaymentMethodData = {
  billing?: hostBilling,

  nickName?: string,
}

external toJson: hostPaymentMethodData => JSON.t = "%identity"

let forbiddenKeys = [
  "card",
  "card_number",
  "cardNumber",
  "card_cvc",
  "cvc",
  "cvv",
  "card_exp_month",
  "card_exp_year",
  "expiry",
  "expiryMonth",
  "expiryYear",
  "card_holder_name",
  "cardHolderName",
  "cardholderName",
  "bin",
  "bin_number",
  "binNumber",
  "extendedBin",
  "extended_bin",
  "last4",
  "last_four",
  "last4_digits",
  "card_isin",
  "card_network",
  "cardNetwork",
  "brand",
  "payment_token",
  "paymentToken",
  "vault_card",
  "vaultCard",
  "card_token",
  "cardToken",
]

let isForbiddenKey = (key: string) => forbiddenKeys->Array.some(forbidden => forbidden === key)

let maxDepth = 32

let rec scan = (value: JSON.t, ~depth: int): result<unit, unit> =>
  if depth > maxDepth {
    Error()
  } else {
    switch value->JSON.Decode.object {
    | Some(dict) =>
      dict
      ->Dict.toArray
      ->Array.reduce(Ok(), (acc, (key, child)) =>
        switch acc {
        | Error() => Error()
        | Ok() => isForbiddenKey(key) ? Error() : child->scan(~depth=depth + 1)
        }
      )
    | None =>
      switch value->JSON.Decode.array {
      | Some(items) =>
        items->Array.reduce(Ok(), (acc, item) =>
          switch acc {
          | Error() => Error()
          | Ok() => item->scan(~depth=depth + 1)
          }
        )
      | None => Ok()
      }
    }
  }

let validateHostData = (value: JSON.t): result<unit, unit> => value->scan(~depth=0)

let validateHostPaymentMethodData = (data: option<hostPaymentMethodData>): result<unit, unit> =>
  switch data {
  | None => Ok()
  | Some(data) => data->toJson->validateHostData
  }

let entry = (key: string, value: option<string>) =>
  switch value {
  | Some(text) if text->String.trim->String.length > 0 =>
    Some((key, text->String.trim->JSON.Encode.string))
  | _ => None
  }

let objectOf = (entries: array<option<(string, JSON.t)>>): option<JSON.t> => {
  let kept = entries->Array.filterMap(item => item)
  kept->Array.length > 0 ? Some(kept->Dict.fromArray->JSON.Encode.object) : None
}

let encodeAddress = (address: hostBillingAddress): option<JSON.t> =>
  objectOf([
    entry("first_name", address.firstName),
    entry("last_name", address.lastName),
    entry("line1", address.line1),
    entry("line2", address.line2),
    entry("line3", address.line3),
    entry("city", address.city),
    entry("state", address.state),
    entry("country", address.country),
    entry("zip", address.zip),
  ])

let encodePhone = (phone: hostPhone): option<JSON.t> =>
  objectOf([entry("number", phone.number), entry("country_code", phone.countryCode)])

let encodeBilling = (billing: hostBilling): option<JSON.t> =>
  objectOf([
    billing.address->Option.flatMap(encodeAddress)->Option.map(json => ("address", json)),
    entry("email", billing.email),
    billing.phone->Option.flatMap(encodePhone)->Option.map(json => ("phone", json)),
  ])

let encodeHostPaymentMethodData = (data: option<hostPaymentMethodData>): option<JSON.t> =>
  data
  ->Option.flatMap(data => data.billing)
  ->Option.flatMap(encodeBilling)
  ->Option.map(billing => [("billing", billing)]->Dict.fromArray->JSON.Encode.object)

let nickNameOf = (data: option<hostPaymentMethodData>): option<string> =>
  data
  ->Option.flatMap(data => data.nickName)
  ->Option.flatMap(name => {
    let trimmed = name->String.trim
    trimmed->String.length > 0 ? Some(trimmed) : None
  })

let buildFinalPaymentMethodData = (
  ~hostData: option<JSON.t>,
  ~cardSubtree: option<(string, JSON.t)>,
): option<JSON.t> => {
  let out = Dict.make()
  hostData
  ->Option.flatMap(JSON.Decode.object)
  ->Option.forEach(dict => dict->Dict.toArray->Array.forEach(((key, value)) => out->Dict.set(key, value)))
  cardSubtree->Option.forEach(((key, value)) => out->Dict.set(key, value))
  out->Dict.toArray->Array.length > 0 ? Some(out->JSON.Encode.object) : None
}

type jsDate
@new external dateNow: unit => jsDate = "Date"
@send external dateToISOString: jsDate => string = "toISOString"

@genType
type acceptanceType = [#online | #offline]

@genType
type hostOnlineAcceptance = {userAgent?: string}

@genType
type hostCustomerAcceptance = {
  acceptanceType: acceptanceType,
  acceptedAt: string,
  online: hostOnlineAcceptance,
}

let acceptanceTypeToWire = (value: acceptanceType) =>
  switch value {
  | #online => "online"
  | #offline => "offline"
  }

let encodeCustomerAcceptance = (acceptance: hostCustomerAcceptance): JSON.t => {
  let online =
    objectOf([entry("user_agent", acceptance.online.userAgent)])
    ->Option.getOr(Dict.make()->JSON.Encode.object)

  [
    ("acceptance_type", acceptance.acceptanceType->acceptanceTypeToWire->JSON.Encode.string),
    ("accepted_at", acceptance.acceptedAt->JSON.Encode.string),
    ("online", online),
  ]
  ->Dict.fromArray
  ->JSON.Encode.object
}

/* The platform's device browser string — no navigator in React Native, so the
   SDK owns a faithful stand-in (mirrors the SDK's payments acceptance builder). */
let nativeUserAgent = () =>
  switch ReactNative.Platform.os {
  | #ios => "Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148"
  | #android => "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Mobile Safari/537.36"
  | _ => ""
  }

/* PMM parity with the web SDK: the management save always stamps
   `customer_acceptance` at the moment of save. */
let acceptanceNow = (~userAgent: option<string>): hostCustomerAcceptance => {
  acceptanceType: #online,
  acceptedAt: dateNow()->dateToISOString,
  online: {userAgent: ?userAgent},
}
