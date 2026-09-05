open ReactNative

type common = {
  theme: CardFormTypes.cardTheme,
  isProcessing: bool,
  editable: bool,
  accessible: option<bool>,
}

let inputColors = (
  ~theme: CardFormTypes.cardTheme,
  ~error: option<string>,
  ~isValid,
  ~errorDisplay: CardFieldOptions.errorDisplay,
) => {
  let ok = isValid->Option.getOr(error->Option.isNone)
  (ok, !ok && errorDisplay !== #none ? theme.dangerColor : theme.textColor)
}

module ErrorSlot = {
  @react.component
  let make = (
    ~error: option<string>,
    ~renderError: option<string => React.element>,
    ~errorDisplay: CardFieldOptions.errorDisplay,
  ) =>
    switch (errorDisplay, error, renderError) {
    | (#inline, Some(message), Some(render)) => render(message)
    | _ => React.null
    }
}

module Number = {
  @react.component
  let make = (
    ~value: string,
    ~onChange: CardFieldLogic.numberChange => unit,
    ~currentBrand: string="",
    ~onFocus: unit => unit=() => (),
    ~onBlur: unit => unit=() => (),
    ~onBackspace: CardFieldLogic.backspaceAction => unit=_ => (),
    ~error: option<string>=?,
    ~isValid: bool=?,
    ~renderError: option<string => React.element>=?,
    ~options: CardFieldOptions.resolved,
    ~common: common,
    ~onAnalytics: CardFormTypes.analyticsEvent => unit=_ => (),
    ~iconRight: CardInput.iconType=CardInput.NoIcon,
    ~reference: option<React.ref<Nullable.t<TextInput.element>>>=?,
    ~borderBottomWidth: option<float>=?,
    ~borderBottomLeftRadius: option<float>=?,
    ~borderBottomRightRadius: option<float>=?,

    ~styles: option<CardFieldStyles.fieldStyles>=?,
  ) => {
    let (isValid, textColor) = inputColors(
      ~theme=common.theme,
      ~error,
      ~isValid,
      ~errorDisplay=options.errorDisplay,
    )
    <View
      style=?{styles
      ->CardFieldStyles.rootOf
      ->Option.map(root => Style.s({})->CardFieldStyles.withView(Some(root)))}>
      <CardInput
        ?styles
        theme=common.theme
        isProcessing=common.isProcessing
        editable=common.editable
        onAnalytics
        fieldId=CardFormTypes.CardNumberField
        options
        reference
        state=value
        setState={text => onChange(CardFieldLogic.onCardNumberText(text, ~currentBrand))}
        keyboardType=#"number-pad"
        isValid
        maxLength=Some(23)
        ?borderBottomWidth
        ?borderBottomLeftRadius
        ?borderBottomRightRadius
        textColor
        iconRight
        onFocus
        onBlur
        onKeyPress={(ev: TextInput.KeyPressEvent.t) =>
          if ev.nativeEvent.key == "Backspace" {
            onBackspace(CardFieldLogic.onCardNumberBackspace(~value))
          }}
        accessible=?common.accessible
      />
      <ErrorSlot error={error} renderError={renderError} errorDisplay={options.errorDisplay} />
    </View>
  }
}

module Expiry = {
  @react.component
  let make = (
    ~value: string,
    ~onChange: CardFieldLogic.expiryChange => unit,
    ~onFocus: unit => unit=() => (),
    ~onBlur: unit => unit=() => (),
    ~onBackspace: CardFieldLogic.backspaceAction => unit=_ => (),
    ~error: option<string>=?,
    ~isValid: bool=?,
    ~renderError: option<string => React.element>=?,
    ~options: CardFieldOptions.resolved,
    ~common: common,
    ~onAnalytics: CardFormTypes.analyticsEvent => unit=_ => (),
    ~reference: option<React.ref<Nullable.t<TextInput.element>>>=?,
    ~borderTopWidth: option<float>=?,
    ~borderRightWidth: option<float>=?,
    ~borderTopLeftRadius: option<float>=?,
    ~borderTopRightRadius: option<float>=?,
    ~borderBottomRightRadius: option<float>=?,
    ~borderBottomWidth: option<float>=?,
    ~borderBottomLeftRadius: option<float>=?,

    ~styles: option<CardFieldStyles.fieldStyles>=?,
  ) => {
    let (isValid, textColor) = inputColors(
      ~theme=common.theme,
      ~error,
      ~isValid,
      ~errorDisplay=options.errorDisplay,
    )
    <View
      style=?{styles
      ->CardFieldStyles.rootOf
      ->Option.map(root => Style.s({})->CardFieldStyles.withView(Some(root)))}>
      <CardInput
        ?styles
        theme=common.theme
        isProcessing=common.isProcessing
        editable=common.editable
        onAnalytics
        fieldId=CardFormTypes.ExpiryField
        options
        reference
        state=value
        setState={text => onChange(CardFieldLogic.onExpiryText(text))}
        keyboardType=#"number-pad"
        isValid
        maxLength=Some(7)
        ?borderTopWidth
        ?borderRightWidth
        ?borderTopLeftRadius
        ?borderTopRightRadius
        ?borderBottomRightRadius
        ?borderBottomWidth
        ?borderBottomLeftRadius
        textColor
        onFocus
        onBlur
        onKeyPress={(ev: TextInput.KeyPressEvent.t) =>
          if ev.nativeEvent.key == "Backspace" {
            onBackspace(CardFieldLogic.onExpiryBackspace(~display=value))
          }}
        accessible=?common.accessible
      />
      <ErrorSlot error={error} renderError={renderError} errorDisplay={options.errorDisplay} />
    </View>
  }
}

module CardholderName = {
  @react.component
  let make = (
    ~value: string,
    ~onChange: string => unit,
    ~onFocus: unit => unit=() => (),
    ~onBlur: unit => unit=() => (),
    ~error: option<string>=?,
    ~isValid: bool=?,
    ~renderError: option<string => React.element>=?,
    ~options: CardFieldOptions.resolved,
    ~common: common,
    ~onAnalytics: CardFormTypes.analyticsEvent => unit=_ => (),
    ~reference: option<React.ref<Nullable.t<TextInput.element>>>=?,
    ~borderBottomWidth: option<float>=?,
    ~borderBottomLeftRadius: option<float>=?,
    ~borderBottomRightRadius: option<float>=?,
    ~styles: option<CardFieldStyles.fieldStyles>=?,
  ) => {
    let (isValid, textColor) = inputColors(
      ~theme=common.theme,
      ~error,
      ~isValid,
      ~errorDisplay=options.errorDisplay,
    )
    <View
      style=?{styles
      ->CardFieldStyles.rootOf
      ->Option.map(root => Style.s({})->CardFieldStyles.withView(Some(root)))}>
      <CardInput
        ?styles
        theme=common.theme
        isProcessing=common.isProcessing
        editable=common.editable
        onAnalytics
        fieldId=CardFormTypes.CardholderNameField
        options
        reference
        state=value
        setState={text => onChange(CardFieldLogic.onCardholderNameText(text))}
        keyboardType=#default
        isValid
        maxLength=Some(255)
        ?borderBottomWidth
        ?borderBottomLeftRadius
        ?borderBottomRightRadius
        textColor
        onFocus
        onBlur
        accessible=?common.accessible
      />
      <ErrorSlot error={error} renderError={renderError} errorDisplay={options.errorDisplay} />
    </View>
  }
}

module Cvc = {
  @react.component
  let make = (
    ~value: string,
    ~onChange: CardFieldLogic.cvcChange => unit,
    ~brand: string="",
    ~onFocus: unit => unit=() => (),
    ~onBlur: unit => unit=() => (),
    ~onBackspace: CardFieldLogic.backspaceAction => unit=_ => (),
    ~error: option<string>=?,
    ~isValid: bool=?,
    ~renderError: option<string => React.element>=?,
    ~options: CardFieldOptions.resolved,
    ~common: common,
    ~onAnalytics: CardFormTypes.analyticsEvent => unit=_ => (),
    ~iconRight: CardInput.iconType=CardInput.NoIcon,
    ~reference: option<React.ref<Nullable.t<TextInput.element>>>=?,
    ~borderTopWidth: option<float>=?,
    ~borderLeftWidth: option<float>=?,
    ~borderTopLeftRadius: option<float>=?,
    ~borderTopRightRadius: option<float>=?,
    ~borderBottomLeftRadius: option<float>=?,
    ~borderBottomRightRadius: option<float>=?,
    ~borderBottomWidth: option<float>=?,
    ~borderRightWidth: option<float>=?,

    ~styles: option<CardFieldStyles.fieldStyles>=?,
  ) => {
    let (isValid, textColor) = inputColors(
      ~theme=common.theme,
      ~error,
      ~isValid,
      ~errorDisplay=options.errorDisplay,
    )
    <View
      style=?{styles
      ->CardFieldStyles.rootOf
      ->Option.map(root => Style.s({})->CardFieldStyles.withView(Some(root)))}>
      <CardInput
        ?styles
        theme=common.theme
        isProcessing=common.isProcessing
        editable=common.editable
        onAnalytics
        fieldId=CardFormTypes.CvcField
        options
        reference
        secureTextEntry=true
        state=value
        setState={text => onChange(CardFieldLogic.onCvcText(text, ~brand))}
        keyboardType=#"number-pad"
        isValid
        maxLength=Some(4)
        ?borderTopWidth
        ?borderLeftWidth
        ?borderTopLeftRadius
        ?borderTopRightRadius
        ?borderBottomLeftRadius
        ?borderBottomRightRadius
        ?borderBottomWidth
        ?borderRightWidth
        textColor
        iconRight
        onFocus
        onBlur
        onKeyPress={(ev: TextInput.KeyPressEvent.t) =>
          if ev.nativeEvent.key == "Backspace" {
            onBackspace(CardFieldLogic.onCvcBackspace(~value))
          }}
        accessible=?common.accessible
      />
      <ErrorSlot error={error} renderError={renderError} errorDisplay={options.errorDisplay} />
    </View>
  }
}
