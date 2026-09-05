open ReactNative

module SvgUri = {
  @module("react-native-svg") @react.component
  external make: (
    ~uri: string,
    ~width: float=?,
    ~height: float=?,
    ~color: string=?,
  ) => React.element = "SvgUri"
}

module SvgXml = {
  @module("react-native-svg") @react.component
  external make: (
    ~xml: string,
    ~width: float=?,
    ~height: float=?,
    ~color: string=?,
  ) => React.element = "SvgXml"
}

@module("./cardIconSvgs.mjs") external cvvSvg: string = "cvv"
@module("./cardIconSvgs.mjs") external cameraSvg: string = "camera"

type detectedScheme =
  | Visa
  | Mastercard
  | AmericanExpress
  | DinersClub
  | Discover
  | JCB
  | CartesBancaires
  | Interac
  | RuPay
  | UnionPay
  | Maestro
  | Bajaj
  | Sodexo
  | Unrecognised

let fromDetectedName = (name: string): detectedScheme =>
  switch name->String.trim->String.toLowerCase {
  | "visa" => Visa
  | "mastercard" => Mastercard
  | "americanexpress" => AmericanExpress
  | "dinersclub" => DinersClub
  | "discover" => Discover
  | "jcb" => JCB
  | "cartesbancaires" => CartesBancaires
  | "interac" => Interac
  | "rupay" => RuPay
  | "unionpay" => UnionPay
  | "maestro" => Maestro
  | "bajaj" => Bajaj
  | "sodexo" => Sodexo
  | _ => Unrecognised
  }

let artworkFor = (scheme: detectedScheme): string =>
  switch scheme {
  | Visa => "visa"
  | Mastercard => "mastercard"
  | AmericanExpress => "americanexpress"
  | DinersClub => "dinersclub"
  | Discover => "discover"
  | JCB => "jcb"
  | CartesBancaires => "cartesbancaires"
  | Interac => "interac"

  | RuPay
  | UnionPay
  | Maestro
  | Bajaj
  | Sodexo
  | Unrecognised => "waitcard"
  }

@genType
type brandIconMode = [#standard | #animated | #hidden | #hideGeneric]

let placeholderCycle = ["visa", "mastercard", "americanexpress", "dinersclub", "discover", "jcb"]

@react.component
let make = (
  ~detectedScheme: string,
  ~baseUrl: string,
  ~size: float=30.,
  ~mode: brandIconMode=#standard,
) => {
  let hasBrand = detectedScheme->String.trim->String.length > 0

  let fadeAnim = CardAnimatedValue.useAnimatedValue(1.)
  let scaleAnim = fadeAnim->Animated.Value.interpolate({
    inputRange: [0., 1.],
    outputRange: [0.8, 1.]->Animated.Interpolation.fromFloatArray,
    extrapolate: #clamp,
  })

  let ((_, placeholder), setPlaceholder) = React.useState(_ => (
    0,
    mode === #animated ? "visa" : "waitcard",
  ))

  let animationRef = React.useRef(None)

  let rec startContinuousAnimation = () => {
    let fadeOutSequence = Animated.sequence([
      Animated.delay(2000.),
      Animated.timing(
        fadeAnim,
        {
          toValue: 0.->Animated.Value.Timing.fromRawValue,
          duration: 300.,
          useNativeDriver: true,
          easing: Easing.ease,
        },
      ),
    ])

    animationRef.current = Some(fadeOutSequence)

    fadeOutSequence->Animated.start(~endCallback=endResult =>
      if endResult.finished {
        setPlaceholder(((index, _)) => {
          let newIndex = index === 5 ? 0 : index + 1
          (newIndex, placeholderCycle->Array.get(newIndex)->Option.getOr("waitcard"))
        })

        let fadeInAnimation = Animated.timing(
          fadeAnim,
          {
            toValue: 1.->Animated.Value.Timing.fromRawValue,
            duration: 300.,
            useNativeDriver: true,
            easing: Easing.ease,
          },
        )
        animationRef.current = Some(fadeInAnimation)
        fadeInAnimation->Animated.start(~endCallback=endResult =>
          if endResult.finished {
            startContinuousAnimation()
          }
        )
      }
    )
  }

  let stopAnimation = () =>
    switch animationRef.current {
    | Some(animation) => animation->Animated.stop
    | None => ()
    }

  React.useLayoutEffect2(() => {
    if mode === #animated && !hasBrand {
      startContinuousAnimation()
      Some(() => stopAnimation())
    } else {
      stopAnimation()
      fadeAnim->Animated.Value.setValue(1.)
      None
    }
  }, (detectedScheme, (mode :> string)))

  React.useEffect0(() => Some(() => stopAnimation()))

  let visible = switch mode {
  | #hidden => false
  | #hideGeneric => hasBrand
  | #standard | #animated => true
  }

  let iconName = hasBrand ? detectedScheme : placeholder

  visible
    ? <Animated.View
        style={Style.s({
          opacity: fadeAnim->Animated.StyleProp.float,
          transform: [Style.scale(~scale=scaleAnim->Animated.StyleProp.float)],
        })}>
        <SvgUri
          uri={CardIconUrls.iconUrl(~baseUrl, ~name=iconName->fromDetectedName->artworkFor)}
          width=size
          height=size
        />
      </Animated.View>
    : React.null
}

module Camera = {
  @react.component
  let make = (~size: float=20., ~color: string) =>
    cameraSvg->String.length === 0
      ? React.null
      : <SvgXml xml=cameraSvg width=size height=size color />
}

module Cvc = {
  @react.component
  let make = (~size: float=32.) =>
    cvvSvg->String.length === 0
      ? React.null
      : <SvgXml xml=cvvSvg width=size height=size />
}
