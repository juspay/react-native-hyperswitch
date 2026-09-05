open ReactNative

type contextValue = {
  controller: VaultCardController.controller,
  theme: CardFormTypes.cardTheme,
  labels: CardFormTypes.cardLabels,
  errorFontSize: float,
  errorSpacing: float,
  brandIconMode: CardIcons.brandIconMode,
  iconBaseUrl: string,
  accessible: option<bool>,
  editable: bool,
  isProcessing: bool,
  onAnalytics: CardFormTypes.analyticsEvent => unit,

  unstyled: bool,

  defaultErrorDisplay: CardFieldOptions.errorDisplay,

  defaultLabelBehavior: CardFieldOptions.labelBehavior,

  publicSnapshot: unit => VaultPublicState.controllerSnapshot,
}

let context: React.Context.t<option<contextValue>> = React.createContext(None)

module ContextProvider = {
  let make = React.Context.provider(context)
}

let useRequired = (widgetName: string): contextValue =>
  switch React.useContext(context) {
  | Some(value) => value
  | None =>
    Js.Exn.raiseError(widgetName ++ " must be rendered inside a <CardForm>.")
  }

module ErrorText = {
  @react.component
  let make = (
    ~message: string,
    ~theme: CardFormTypes.cardTheme,
    ~errorFontSize,
    ~errorSpacing,

    ~errorStyle: option<CardFieldStyles.textStyleProp>=?,
  ) =>
    <Text
      testID=CardTestIds.errorTextTestId
      style={Style.s({
        color: theme.dangerColor,
        fontFamily: theme.fontFamily,
        fontSize: errorFontSize,
        marginTop: errorSpacing->Style.dp,
      })->CardFieldStyles.withText(errorStyle)}>
      {React.string(message)}
    </Text>
}

let useRegistration = (ctx: contextValue, kind: VaultCardController.widgetKind) => {
  let register = ctx.controller.register
  React.useEffect0(() => Some(register(kind)))
  let renderError = message =>
    <ErrorText
      message
      theme=ctx.theme
      errorFontSize=ctx.errorFontSize
      errorSpacing=ctx.errorSpacing
    />
  renderError
}

let commonFor = (ctx: contextValue): CardFields.common => {
  theme: ctx.theme,
  isProcessing: ctx.isProcessing,
  editable: ctx.editable,
  accessible: ctx.accessible,
}
