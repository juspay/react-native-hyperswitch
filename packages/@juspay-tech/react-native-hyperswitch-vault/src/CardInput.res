open ReactNative
open Style

type iconType =
  | NoIcon

  | CustomIcon(React.element)

  | InteractiveIcon(React.element)

let fontSize = 16.

@react.component
let make = (
  ~theme: CardFormTypes.cardTheme,
  ~isProcessing: bool,
  ~onAnalytics: CardFormTypes.analyticsEvent => unit,
  ~fieldId: CardFormTypes.cardFieldId,
  ~state,
  ~setState,

  ~options: CardFieldOptions.resolved,
  ~keyboardType,
  ~maxLength=None,
  ~isValid=true,
  ~textColor,
  ~secureTextEntry=false,
  ~editable=true,
  ~iconRight: iconType=NoIcon,
  ~reference=None,
  ~onKeyPress=?,
  ~onFocus=() => (),
  ~onBlur=() => (),
  ~accessible=?,
  ~borderTopWidth=?,
  ~borderBottomWidth=?,
  ~borderLeftWidth=?,
  ~borderRightWidth=?,
  ~borderTopLeftRadius=?,
  ~borderTopRightRadius=?,
  ~borderBottomLeftRadius=?,
  ~borderBottomRightRadius=?,

  ~styles: option<CardFieldStyles.fieldStyles>=?,
) => {
  let (isFocused, setIsFocused) = React.useState(_ => false)
  let animatedValue = CardAnimatedValue.useAnimatedValue(0.)

  let floating = options.labelBehavior === #floating
  let floatingResting = options.placeholder->Option.orElse(options.label)
  let floatingLifted = options.label->Option.orElse(options.placeholder)
  let showFloating = floating && (floatingResting->Option.isSome || floatingLifted->Option.isSome)

  let staticLabel = options.labelBehavior === #above ? options.label : None

  let showOverlayPlaceholder = !floating && state === "" && options.placeholder->Option.isSome

  let inputTextAlign = React.useMemo1(
    () => styles->CardFieldStyles.inputOf->CardFieldStyles.textAlignOf,
    [styles->CardFieldStyles.inputOf],
  )

  let placeholderSlot = React.useMemo1(
    () => styles->CardFieldStyles.placeholderOf->CardFieldStyles.splitAnimatedText,
    [styles->CardFieldStyles.placeholderOf],
  )
  let labelSlot = React.useMemo1(
    () => styles->CardFieldStyles.labelOf->CardFieldStyles.splitAnimatedText,
    [styles->CardFieldStyles.labelOf],
  )

  let restingFontSize =
    placeholderSlot.fontSize->Option.getOr(
      (fontSize +. theme.placeholderTextSizeAdjust) *. theme.fontScale,
    )
  let floatingFontSize =
    labelSlot.fontSize->Option.getOr(fontSize +. theme.placeholderTextSizeAdjust -. 5.)

  React.useEffect2(() => {
    if showFloating {
      animatedValue->Animated.Value.setValue(state === "" ? 0. : 1.)
    }
    None
  }, (showFloating, state))

  let lifted = isFocused || state !== ""
  let liftedRef = React.useRef(lifted)

  React.useEffect2(() => {
    if showFloating && liftedRef.current !== lifted {
      Animated.timing(
        animatedValue,
        {
          toValue: lifted
            ? 1.->Animated.Value.Timing.fromRawValue
            : 0.->Animated.Value.Timing.fromRawValue,
          duration: 200.,
          useNativeDriver: false,
        },
      )->Animated.start
    }
    liftedRef.current = lifted

    None
  }, (showFloating, lifted))

  let inputElement = (~unstyled: bool) =>
        <TextInput
          ref=?{reference->Option.map(ref => ref->ReactNative.Ref.value)}
          style={array([
            s({
              fontStyle: #normal,
              color: textColor,
              opacity: isProcessing ? 0.5 : 1.,
              fontFamily: theme.fontFamily,
              fontSize: (fontSize +. theme.placeholderTextSizeAdjust) *. theme.fontScale,
            }),
            s({
              padding: 0.->dp,

              height: unstyled
                ? Style.auto
                : showFloating ? (theme.inputHeight *. 0.7)->dp : 100.->pct,
              width: 100.->pct,

              textAlignVertical: showFloating ? #auto : #center,
            }),
          ])->CardFieldStyles.withText(styles->CardFieldStyles.inputOf)}
          testID={options.testID}
          accessibilityLabel={options.accessibilityLabel}
          accessibilityHint=?{options.accessibilityHint}
          secureTextEntry
          autoCapitalize=#none
          multiline={false}
          autoCorrect={false}
          clearTextOnFocus={false}
          ?maxLength
          placeholderTextColor={theme.placeholderColor}
          value={state}
          ?onKeyPress
          onChangeText={text => setState(text)}
          keyboardType
          autoFocus={false}
          autoComplete={#off}
          textContentType={#oneTimeCode}
          onFocus={_ => {
            setIsFocused(_ => true)
            onFocus()
            onAnalytics(FieldFocused(fieldId))
          }}
          onBlur={_ => {
            state->String.trim == "" ? setState("") : ()
            onBlur()
            setIsFocused(_ => false)
            onAnalytics(FieldBlurred(fieldId))
          }}
          editable
          pointerEvents=#auto
          ?accessible
        />

  if options.unstyled {
    inputElement(~unstyled=true)
  } else {
    <View style={s({width: 100.->pct})}>
      {switch staticLabel {
      | None => React.null
      | Some(text) =>
        <Text
          style={s({
            fontFamily: theme.fontFamily,
            fontSize: (fontSize +. theme.placeholderTextSizeAdjust -. 3.) *. theme.fontScale,
            color: theme.placeholderColor,
            marginBottom: 4.->dp,
          })->CardFieldStyles.withText(styles->CardFieldStyles.labelOf)}>
          {React.string(text)}
        </Text>
      }}
      <View
        style={array([
          theme.bgStyle,
          s({
            backgroundColor: theme.inputBackground,
            borderTopWidth: borderTopWidth->Option.getOr(theme.borderWidth),
            borderBottomWidth: borderBottomWidth->Option.getOr(theme.borderWidth),
            borderLeftWidth: borderLeftWidth->Option.getOr(theme.borderWidth),
            borderRightWidth: borderRightWidth->Option.getOr(theme.borderWidth),
            borderTopLeftRadius: borderTopLeftRadius->Option.getOr(theme.borderRadius),
            borderTopRightRadius: borderTopRightRadius->Option.getOr(theme.borderRadius),
            borderBottomLeftRadius: borderBottomLeftRadius->Option.getOr(theme.borderRadius),
            borderBottomRightRadius: borderBottomRightRadius->Option.getOr(theme.borderRadius),
            height: theme.inputHeight->dp,
            flexDirection: #row,

            borderColor: isValid || options.errorDisplay === #none
              ? isFocused ? theme.primaryColor : theme.normalBorderColor
              : theme.errorBorderColor,
            width: 100.->pct,
            paddingHorizontal: 13.->dp,
            alignItems: #center,
            justifyContent: #center,
          }),
          theme.shadowStyle,
        ])->CardFieldStyles.withView(styles->CardFieldStyles.containerOf)}>
        <View
          style={s({
            flex: 1.,
            position: #relative,
            height: 100.->pct,

            justifyContent: showFloating ? #"flex-end" : #center,
          })}>
          {showFloating
            ? <Animated.View
                pointerEvents=#none
                style={s({
                  top: 0.->dp,
                  position: #absolute,
                  height: animatedValue
                  ->Animated.Interpolation.interpolate({
                    inputRange: [0., 1.],
                    outputRange: [
                      "100%",
                      `${((theme.inputHeight +. 10.) /. 1.4)->Float.toString}%`,
                    ]->Animated.Interpolation.fromStringArray,
                  })
                  ->Animated.StyleProp.size,
                  justifyContent: #center,
                })}>
                <Animated.Text
                  style={array([
                    s({
                      fontFamily: theme.fontFamily,
                      fontWeight: isFocused || state != "" ? #500 : #normal,
                      fontSize: animatedValue
                      ->Animated.Interpolation.interpolate({
                        inputRange: [0., 1.],
                        outputRange: [
                          restingFontSize,
                          floatingFontSize,
                        ]->Animated.Interpolation.fromFloatArray,
                      })
                      ->Animated.StyleProp.float,
                      color: theme.placeholderColor,
                    }),
                  ])->CardFieldStyles.withText(
                    isFocused || state != "" ? labelSlot.rest : placeholderSlot.rest,
                  )}>
                  {React.string(
                    (
                      isFocused || state != "" ? floatingLifted : floatingResting
                    )->Option.getOr(""),
                  )}
                </Animated.Text>
              </Animated.View>
            : React.null}
        {inputElement(~unstyled=false)}
          {showOverlayPlaceholder
            ? <View
                pointerEvents=#none

                accessible={false}
                accessibilityElementsHidden={true}
                importantForAccessibility={#"no-hide-descendants"}
                style={s({
                  position: #absolute,
                  top: 0.->dp,
                  left: 0.->dp,
                  right: 0.->dp,
                  bottom: 0.->dp,

                  justifyContent: #center,
                })}>
                <Text
                  numberOfLines={1}
                  style={s({
                    fontFamily: theme.fontFamily,
                    fontSize: (fontSize +. theme.placeholderTextSizeAdjust) *. theme.fontScale,
                    color: theme.placeholderColor,

                    textAlign: ?inputTextAlign,

                    opacity: isProcessing ? 0.5 : 1.,
                  })->CardFieldStyles.withText(styles->CardFieldStyles.placeholderOf)}>
                  {React.string(options.placeholder->Option.getOr(""))}
                </Text>
              </View>
            : React.null}
        </View>
        {switch iconRight {
        | NoIcon => React.null
        | CustomIcon(element) =>

          <View
            accessible={false}
            accessibilityElementsHidden={true}
            importantForAccessibility={#"no-hide-descendants"}
            style={s({})->CardFieldStyles.withView(styles->CardFieldStyles.accessoryOf)}>
            element
          </View>
        | InteractiveIcon(element) =>

          <View style={s({})->CardFieldStyles.withView(styles->CardFieldStyles.accessoryOf)}>
            element
          </View>
        }}
      </View>
    </View>
  }
}
