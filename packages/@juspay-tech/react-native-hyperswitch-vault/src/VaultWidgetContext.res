open ReactNative

/*
 * Opaque on the TS side (genType emits it as an unknown-shaped handle): a headless caller
 * (payment-methods' `hyperswitch` provider adapter) can hold this value and hand it to each
 * field's `~form` prop without knowing its shape — it never inspects it, only threads it from
 * wherever the session was established through to each field.
 */
@genType.opaque
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

/*
 * A headless caller (payment-methods' `hyperswitch` provider adapter) can hold this value and
 * hand it to each field's `~form` prop without knowing its shape — it never inspects it, only
 * threads it from wherever the session was established through to each field. `useContext` is
 * still called unconditionally on every render (Rules of Hooks), its result is just ignored when
 * `override` is present.
 */
let useResolved = (widgetName: string, ~override: option<contextValue>=?): contextValue => {
  let fromContext = React.useContext(context)
  switch override {
  | Some(value) => value
  | None =>
    switch fromContext {
    | Some(value) => value
    | None =>
      Js.Exn.raiseError(
        widgetName ++ " must be rendered inside a <CardForm>, or receive a `form` prop.",
      )
    }
  }
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
