@genType
let make = React.forwardRef((
  props: {

    "styles": option<CardFieldStyles.expiryStyles>,
    "placeholder": option<string>,
    "label": option<string>,
    "labelBehavior": option<CardFieldOptions.labelBehavior>,
    "errorDisplay": option<CardFieldOptions.errorDisplay>,
    "accessibilityLabel": option<string>,
    "accessibilityHint": option<string>,
    "testID": option<string>,
    "unstyled": option<bool>,
    "onReady": option<VaultPublicState.fieldEvent => unit>,
    "onFocus": option<VaultPublicState.fieldEvent => unit>,
    "onBlur": option<VaultPublicState.fieldEvent => unit>,
    "onChange": option<VaultPublicState.fieldChange => unit>,
    "form": option<VaultWidgetContext.contextValue>,
  },
  ref,
) => {
  let ctx = VaultWidgetContext.useResolved("CardExpiryField", ~override=?props["form"])

  VaultStateEmitter.use(
    ~build=() => ctx.publicSnapshot().cardExpiry,
    ~equal=VaultPublicState.fieldChangeEq,
    ~notify=props["onChange"],
  )
  VaultStateEmitter.useReady(~elementType=#cardExpiry, ~notify=props["onReady"])
  let controller = ctx.controller

  React.useImperativeHandle0(ref, () => {
    CardForm.focus: () => VaultCardController.focusRef(controller.expiryRef),
    blur: () => VaultCardController.blurRef(controller.expiryRef),
    clear: () => controller.clearField(#cardExpiry),
  })

  let options: CardFieldOptions.expiryOptions = {
    placeholder: ?props["placeholder"],
    label: ?props["label"],
    labelBehavior: ?props["labelBehavior"],
    errorDisplay: ?props["errorDisplay"],
    accessibilityLabel: ?props["accessibilityLabel"],
    accessibilityHint: ?props["accessibilityHint"],
    testID: ?props["testID"],
    unstyled: ?props["unstyled"],
  }

  <BoundCardFields.Expiry
    ctx
    styles=?{props["styles"]->Option.map(CardFieldStyles.widenExpiry)}
    options
    onFocus=?{props["onFocus"]}
    onBlur=?{props["onBlur"]}
  />
})
