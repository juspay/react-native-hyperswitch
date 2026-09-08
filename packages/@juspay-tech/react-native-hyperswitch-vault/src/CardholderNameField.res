@genType
let make = React.forwardRef((
  props: {
    "styles": option<CardFieldStyles.fieldStyles>,

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
  let ctx = VaultWidgetContext.useResolved("CardholderNameField", ~override=?props["form"])

  VaultStateEmitter.use(
    ~build=() => ctx.publicSnapshot().cardholderName,
    ~equal=VaultPublicState.fieldChangeEq,
    ~notify=props["onChange"],
  )
  VaultStateEmitter.useReady(~elementType=#cardholderName, ~notify=props["onReady"])
  let controller = ctx.controller

  React.useImperativeHandle0(ref, () => {
    CardForm.focus: () => VaultCardController.focusRef(controller.cardholderRef),
    blur: () => VaultCardController.blurRef(controller.cardholderRef),
    clear: () => controller.clearField(#cardholderName),
  })

  let options: CardFieldOptions.cardholderNameOptions = {
    placeholder: ?props["placeholder"],
    label: ?props["label"],
    labelBehavior: ?props["labelBehavior"],
    errorDisplay: ?props["errorDisplay"],
    accessibilityLabel: ?props["accessibilityLabel"],
    accessibilityHint: ?props["accessibilityHint"],
    testID: ?props["testID"],
    unstyled: ?props["unstyled"],
  }

  <BoundCardFields.CardholderName
    ctx
    styles=?{props["styles"]}
    options
    onFocus=?{props["onFocus"]}
    onBlur=?{props["onBlur"]}
  />
})
