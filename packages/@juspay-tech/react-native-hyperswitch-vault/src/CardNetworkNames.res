let canonical = [
  "Visa",
  "Mastercard",
  "AmericanExpress",
  "DinersClub",
  "Discover",
  "JCB",
  "CartesBancaires",
  "Interac",
  "Maestro",
  "UnionPay",
  "RuPay",
  "SODEXO",
  "BAJAJ",
]

let normalise = (name: string): option<string> =>
  switch name->String.toLowerCase->String.replaceRegExp(%re("/[\s_-]+/g"), "") {
  | "visa" => Some("Visa")
  | "mastercard" => Some("Mastercard")
  | "americanexpress" | "amex" => Some("AmericanExpress")
  | "dinersclub" | "diners" => Some("DinersClub")
  | "discover" => Some("Discover")
  | "jcb" => Some("JCB")
  | "cartesbancaires" => Some("CartesBancaires")
  | "interac" => Some("Interac")
  | "maestro" => Some("Maestro")
  | "unionpay" => Some("UnionPay")
  | "rupay" => Some("RuPay")
  | "sodexo" => Some("SODEXO")
  | "bajaj" => Some("BAJAJ")
  | _ => None
  }

let isDev: bool = %raw(`typeof __DEV__ !== "undefined" && __DEV__ === true`)

let normaliseList = (names: array<string>): array<string> => {
  let unknown = names->Array.filter(name => name->normalise->Option.isNone)
  if isDev && unknown->Array.length > 0 {
    Console.warn(
      `[react-native-hyperswitch-vault] enabledCardSchemes: unknown value(s) ${unknown->Array.join(
          ", ",
        )} ignored. Expected one of ${canonical->Array.join(", ")}.`,
    )
  }
  names->Array.filterMap(normalise)
}
