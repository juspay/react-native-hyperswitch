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
    "cardBrandIcon": option<CardFieldOptions.brandIconMode>,

    "unstyled": option<bool>,

    "onReady": option<VaultPublicState.fieldEvent => unit>,
    "onFocus": option<VaultPublicState.fieldEvent => unit>,
    "onBlur": option<VaultPublicState.fieldEvent => unit>,
    "onChange": option<VaultPublicState.fieldChange => unit>,
    "form": option<VaultWidgetContext.contextValue>,
  },
  ref,
) => {
  let ctx = VaultWidgetContext.useResolved("CardNumberField", ~override=?props["form"])

  VaultStateEmitter.use(
    ~build=() => ctx.publicSnapshot().cardNumber,
    ~equal=VaultPublicState.fieldChangeEq,
    ~notify=props["onChange"],
  )
  VaultStateEmitter.useReady(~elementType=#cardNumber, ~notify=props["onReady"])
  let controller = ctx.controller

  React.useImperativeHandle0(ref, () => {
    CardForm.focus: () => VaultCardController.focusRef(controller.cardRef),
    blur: () => VaultCardController.blurRef(controller.cardRef),
    clear: () => controller.clearField(#cardNumber),
  })

  let options: CardFieldOptions.cardNumberOptions = {
    placeholder: ?props["placeholder"],
    label: ?props["label"],
    labelBehavior: ?props["labelBehavior"],
    errorDisplay: ?props["errorDisplay"],
    accessibilityLabel: ?props["accessibilityLabel"],
    accessibilityHint: ?props["accessibilityHint"],
    testID: ?props["testID"],
    unstyled: ?props["unstyled"],
    cardBrandIcon: ?props["cardBrandIcon"],
  }

  <BoundCardFields.Number
    ctx
    styles=?{props["styles"]}
    options
    onFocus=?{props["onFocus"]}
    onBlur=?{props["onBlur"]}

    iconRight={CardNumberAccessory.iconFor(
      ~ctx,
      ~brandIconMode=CardFieldOptions.resolveBrandIconMode(
        Some(options),
        ~formWide=ctx.brandIconMode,
        ~unstyled=CardFieldOptions.unstyledFor(props["unstyled"], ~formWide=ctx.unstyled),
      ),
    )}
  />
})
