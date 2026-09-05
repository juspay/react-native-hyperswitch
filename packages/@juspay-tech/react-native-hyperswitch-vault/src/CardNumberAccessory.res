open ReactNative
open Style

module ScanButton = {
  @react.component
  let make = (~theme: CardFormTypes.cardTheme, ~editable: bool, ~onPress: unit => unit) =>
    <>
      <View
        style={s({
          backgroundColor: theme.dividerColor,
          marginHorizontal: 6.->dp,
          height: 60.->pct,
          width: 1.->dp,
        })}
      />
      <Pressable
        accessibilityRole=#button
        accessibilityLabel="Scan card"
        testID=CardTestIds.scanCardButton
        disabled={!editable}
        onPress={_ => onPress()}
        style={_ => s({paddingHorizontal: 2.->dp, justifyContent: #center})}>
        {_ => <CardIcons.Camera size={20. *. theme.fontScale} color=theme.primaryColor />}
      </Pressable>
    </>
}

module Body = {
  @react.component
  let make = (
    ~ctx: VaultWidgetContext.contextValue,
    ~brandIconMode: CardFieldOptions.brandIconMode,
    ~showScan: bool,
  ) => {
    let controller = ctx.controller
    let values = controller.values

    let brandElement = if values.isCoBadged {
      <CardNetworkChooser
        baseUrl=ctx.iconBaseUrl
        schemes=values.eligibleSchemes
        selected=values.brand
        theme=ctx.theme
        label=ctx.labels.selectCardBrandLabel
        brandIconMode={switch brandIconMode {

        | #hidden => #standard
        | mode => mode
        }}
        editable=ctx.editable
        onSelect=controller.selectNetwork
      />
    } else {
      switch brandIconMode {
      | #hidden => React.null
      | mode => <CardIcons detectedScheme=values.brand baseUrl=ctx.iconBaseUrl mode />
      }
    }

    <View style={s({flexDirection: #row, alignItems: #center})}>
      brandElement
      {showScan
        ? <ScanButton theme=ctx.theme editable=ctx.editable onPress=controller.scanCard />
        : React.null}
    </View>
  }
}

let scanOffered = (ctx: VaultWidgetContext.contextValue) =>
  ScanCardBridge.isAvailable && ctx.controller.values.cardNumber->String.length === 0

let iconFor = (
  ~ctx: VaultWidgetContext.contextValue,
  ~brandIconMode: CardFieldOptions.brandIconMode,
): CardInput.iconType => {
  let showScan = ctx->scanOffered
  let isCoBadged = ctx.controller.values.isCoBadged

  if isCoBadged || showScan {
    CardInput.InteractiveIcon(<Body ctx brandIconMode showScan />)
  } else {
    switch brandIconMode {

    | #hidden => CardInput.NoIcon
    | mode => CardInput.CustomIcon(
        <CardIcons detectedScheme=ctx.controller.values.brand baseUrl=ctx.iconBaseUrl mode />,
      )
    }
  }
}
