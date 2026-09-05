@genType.import(("./styleTypes", "VaultViewStyleProp"))
type viewStyleProp

@genType.import(("./styleTypes", "VaultTextStyleProp"))
type textStyleProp

@genType
type fieldStyles = {

  root?: viewStyleProp,

  container?: viewStyleProp,

  input?: textStyleProp,

  placeholder?: textStyleProp,

  label?: textStyleProp,

  error?: textStyleProp,

  accessory?: viewStyleProp,
}

@genType
type expiryStyles = {
  root?: viewStyleProp,
  container?: viewStyleProp,
  input?: textStyleProp,
  placeholder?: textStyleProp,
  label?: textStyleProp,
  error?: textStyleProp,
}

@genType
type formFieldStyles = {
  cardNumber?: fieldStyles,
  cardExpiry?: expiryStyles,
  cardCvc?: fieldStyles,

  cardholderName?: fieldStyles,
}

let widenExpiry = (styles: expiryStyles): fieldStyles => {
  root: ?styles.root,
  container: ?styles.container,
  input: ?styles.input,
  placeholder: ?styles.placeholder,
  label: ?styles.label,
  error: ?styles.error,
}

module Unsafe = {

  external viewStyleToStyle: viewStyleProp => ReactNative.Style.t = "%identity"
  external textStyleToStyle: textStyleProp => ReactNative.Style.t = "%identity"

  external flatStyleToDict: ReactNative.Style.t => Dict.t<JSON.t> = "%identity"
  external dictToTextStyleProp: Dict.t<JSON.t> => textStyleProp = "%identity"
}

@module("react-native") @scope("StyleSheet")
external flattenStyleProp: ReactNative.Style.t => Nullable.t<ReactNative.Style.t> = "flatten"

let withView = (base: ReactNative.Style.t, override: option<viewStyleProp>) =>
  switch override {
  | None => base
  | Some(style) => ReactNative.Style.array([base, style->Unsafe.viewStyleToStyle])
  }

let withText = (base: ReactNative.Style.t, override: option<textStyleProp>) =>
  switch override {
  | None => base
  | Some(style) => ReactNative.Style.array([base, style->Unsafe.textStyleToStyle])
  }

let empty: fieldStyles = {}

let rootOf = (styles: option<fieldStyles>) => styles->Option.flatMap(s => s.root)
let containerOf = (styles: option<fieldStyles>) => styles->Option.flatMap(s => s.container)
let inputOf = (styles: option<fieldStyles>) => styles->Option.flatMap(s => s.input)
let placeholderOf = (styles: option<fieldStyles>) => styles->Option.flatMap(s => s.placeholder)
let labelOf = (styles: option<fieldStyles>) => styles->Option.flatMap(s => s.label)
let errorOf = (styles: option<fieldStyles>) => styles->Option.flatMap(s => s.error)
let accessoryOf = (styles: option<fieldStyles>) => styles->Option.flatMap(s => s.accessory)

let cardNumberOf = (styles: option<formFieldStyles>) => styles->Option.flatMap(s => s.cardNumber)
let cardExpiryOf = (styles: option<formFieldStyles>) =>
  styles->Option.flatMap(s => s.cardExpiry)->Option.map(widenExpiry)
let cardCvcOf = (styles: option<formFieldStyles>) => styles->Option.flatMap(s => s.cardCvc)
let cardholderNameOf = (styles: option<formFieldStyles>) =>
  styles->Option.flatMap(s => s.cardholderName)

type animatedTextSlot = {
  fontSize: option<float>,
  rest: option<textStyleProp>,
}

let emptySlot: animatedTextSlot = {fontSize: None, rest: None}

let usableFontSize = (value: float) => Float.isFinite(value) && value > 0. ? Some(value) : None

let textAlignOf = (slot: option<textStyleProp>): option<
  [#auto | #left | #right | #center | #justify],
> =>
  slot->Option.flatMap(style =>
    switch style->Unsafe.textStyleToStyle->flattenStyleProp->Nullable.toOption {
    | None => None
    | Some(flat) =>
      switch flat
      ->Unsafe.flatStyleToDict
      ->Dict.get("textAlign")
      ->Option.flatMap(JSON.Decode.string) {
      | Some("auto") => Some(#auto)
      | Some("left") => Some(#left)
      | Some("right") => Some(#right)
      | Some("center") => Some(#center)
      | Some("justify") => Some(#justify)
      | _ => None
      }
    }
  )

let splitAnimatedText = (slot: option<textStyleProp>): animatedTextSlot =>
  switch slot {
  | None => emptySlot
  | Some(style) =>
    switch style->Unsafe.textStyleToStyle->flattenStyleProp->Nullable.toOption {
    | None => emptySlot
    | Some(flat) =>
      let dict = flat->Unsafe.flatStyleToDict
      let fontSize =
        dict->Dict.get("fontSize")->Option.flatMap(JSON.Decode.float)->Option.flatMap(usableFontSize)
      let rest = dict->Dict.toArray->Array.filter(((key, _)) => key !== "fontSize")
      {
        fontSize,
        rest: rest->Array.length === 0
          ? None
          : Some(rest->Dict.fromArray->Unsafe.dictToTextStyleProp),
      }
    }
  }
