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
    "cvcIcon": option<CardFieldOptions.cvcIconDisplay>,
    "options": option<CardFieldOptions.cvcOptions>,
    "onReady": option<VaultPublicState.fieldEvent => unit>,
    "onFocus": option<VaultPublicState.fieldEvent => unit>,
    "onBlur": option<VaultPublicState.fieldEvent => unit>,
    "onChange": option<VaultPublicState.fieldChange => unit>,
  },
  ref,
) => {
  let ctx = VaultWidgetContext.useRequired("CardCVCField")

  VaultStateEmitter.use(
    ~build=() => ctx.publicSnapshot().cardCvc,
    ~equal=VaultPublicState.fieldChangeEq,
    ~notify=props["onChange"],
  )
  VaultStateEmitter.useReady(~elementType=#cardCvc, ~notify=props["onReady"])
  let controller = ctx.controller

  React.useImperativeHandle0(ref, () => {
    CardForm.focus: () => VaultCardController.focusRef(controller.cvcRef),
    blur: () => VaultCardController.blurRef(controller.cvcRef),
    clear: () => controller.clearField(#cardCvc),
  })

  let provided: CardFieldOptions.cvcOptions = props["options"]->Option.getOr({})
  let options: CardFieldOptions.cvcOptions = {
    placeholder: ?props["placeholder"]->Option.orElse(provided.placeholder),
    label: ?props["label"]->Option.orElse(provided.label),
    labelBehavior: ?props["labelBehavior"]->Option.orElse(provided.labelBehavior),
    errorDisplay: ?props["errorDisplay"]->Option.orElse(provided.errorDisplay),
    accessibilityLabel: ?props["accessibilityLabel"]->Option.orElse(provided.accessibilityLabel),
    accessibilityHint: ?props["accessibilityHint"]->Option.orElse(provided.accessibilityHint),
    testID: ?props["testID"]->Option.orElse(provided.testID),
    unstyled: ?props["unstyled"]->Option.orElse(provided.unstyled),
    cvcIcon: ?props["cvcIcon"]->Option.orElse(provided.cvcIcon),
  }

  <BoundCardFields.Cvc
    ctx
    styles=?{props["styles"]}
    options
    savedCard=?{provided.savedCard}
    onFocus=?{props["onFocus"]}
    onBlur=?{props["onBlur"]}
  />
})
