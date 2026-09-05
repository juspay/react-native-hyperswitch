open ReactNative
open Style

module Option_ = {
  @react.component
  let make = (
    ~scheme: string,
    ~isSelected: bool,
    ~theme: CardFormTypes.cardTheme,
    ~baseUrl: string,
    ~onSelect: string => unit,
  ) =>
    <Pressable
      accessibilityRole=#button
      accessibilityLabel=scheme
      testID={CardTestIds.networkOption(scheme)}
      onPress={_ => onSelect(scheme)}
      style={_ =>
        s({
          flexDirection: #row,
          alignItems: #center,
          paddingVertical: 10.->dp,
          paddingHorizontal: 8.->dp,
          borderRadius: theme.borderRadius,
          backgroundColor: isSelected ? theme.dividerColor : "transparent",
        })}>
      {_ =>
        <>
          <CardIcons detectedScheme=scheme baseUrl size=30. mode=#standard />
          <View style={s({width: 10.->dp})} />
          <Text
            style={s({
              color: theme.textColor,
              fontFamily: theme.fontFamily,
              fontSize: 14. *. theme.fontScale,
            })}>
            {React.string(scheme)}
          </Text>
        </>}
    </Pressable>
}

@react.component
let make = (
  ~schemes: array<string>,
  ~selected: string,
  ~theme: CardFormTypes.cardTheme,
  ~label: string,
  ~brandIconMode: CardIcons.brandIconMode,
  ~baseUrl: string,
  ~editable: bool,
  ~onSelect: string => unit,
) => {
  let (isOpen, setIsOpen) = React.useState(() => false)

  <>
    <Pressable
      accessibilityRole=#button
      accessibilityLabel=label
      testID=CardTestIds.networkTrigger
      disabled={!editable}
      onPress={_ => setIsOpen(_ => true)}
      style={_ => s({flexDirection: #row, alignItems: #center})}>
      {_ =>
        <>
          <CardIcons detectedScheme=selected baseUrl size=30. mode=brandIconMode />

          <Text
            style={s({
              color: theme.placeholderColor,
              fontSize: 10. *. theme.fontScale,
              marginLeft: 2.->dp,
            })}>
            {React.string(`▾`)}
          </Text>
        </>}
    </Pressable>
    <Modal
      visible=isOpen
      transparent=true
      animationType=#fade
      onRequestClose={() => setIsOpen(_ => false)}>

      <Pressable
        accessibilityRole=#button
        accessibilityLabel=label
        testID=CardTestIds.networkBackdrop
        onPress={_ => setIsOpen(_ => false)}
        style={_ =>
          s({
            flex: 1.,
            justifyContent: #"flex-end",
            backgroundColor: "rgba(0,0,0,0.35)",
          })}>
        {_ =>
          <View
            style={s({
              backgroundColor: theme.inputBackground,
              borderTopLeftRadius: 16.,
              borderTopRightRadius: 16.,
              paddingHorizontal: 16.->dp,
              paddingTop: 16.->dp,
              paddingBottom: 24.->dp,
            })}>
            <Text
              testID=CardTestIds.networkHeading
              style={s({
                color: theme.textColor,
                fontFamily: theme.fontFamily,
                fontSize: 15. *. theme.fontScale,
                marginBottom: 8.->dp,
              })}>
              {React.string(label)}
            </Text>
            <ScrollView keyboardShouldPersistTaps=#handled>
              {schemes
              ->Array.mapWithIndex((scheme, index) =>
                <Option_
                  key={index->Int.toString}
                  scheme
                  isSelected={scheme === selected}
                  theme
                  baseUrl
                  onSelect={picked => {
                    onSelect(picked)
                    setIsOpen(_ => false)
                  }}
                />
              )
              ->React.array}
            </ScrollView>
          </View>}
      </Pressable>
    </Modal>
  </>
}
