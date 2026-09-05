open ReactNative
open Style

@react.component
let make = (

  ~layout: CardFieldOptions.formLayout=#stacked,
  ~fieldArrangement: CardFieldOptions.fieldArrangement=#separate,

  ~fieldStyles: option<CardFieldStyles.formFieldStyles>=?,

  ~fieldOptions: option<CardFieldOptions.formFieldOptions>=?,

  ~cardholderName: CardFieldOptions.cardholderNameMode=#collect,
) => {
  let ctx = VaultWidgetContext.useRequired("CardFormView")
  let theme = ctx.theme
  let labels = ctx.labels
  let errors = ctx.controller.visibleErrors

  let numberStyles = fieldStyles->CardFieldStyles.cardNumberOf
  let expiryStyles = fieldStyles->CardFieldStyles.cardExpiryOf
  let cvcStyles = fieldStyles->CardFieldStyles.cardCvcOf

  let cardholderStyles = fieldStyles->CardFieldStyles.cardholderNameOf

  let numberOptions = fieldOptions->CardFieldOptions.cardNumberOf
  let expiryOptions = fieldOptions->CardFieldOptions.cardExpiryOf
  let cvcOptions = fieldOptions->CardFieldOptions.cardCvcOf
  let cardholderOptions = fieldOptions->CardFieldOptions.cardholderNameOf

  let fused = fieldArrangement === #fused
  let inline = layout === #inline

  let rendersInline = (resolved: CardFieldOptions.resolved) => resolved.errorDisplay === #inline
  let resolveInline = resolve =>
    resolve(
      ~formWideUnstyled=ctx.unstyled,
      ~formWideErrorDisplay=ctx.defaultErrorDisplay,
      ~formWideLabelBehavior=ctx.defaultLabelBehavior,
      ~labels,
    )->rendersInline
  let numberInline = resolveInline(CardFieldOptions.resolveCardNumber(numberOptions, ...))
  let expiryInline = resolveInline(CardFieldOptions.resolveExpiry(expiryOptions, ...))
  let cvcInline = resolveInline(CardFieldOptions.resolveCvc(cvcOptions, ...))

  let claim = (enabled, error) => enabled ? error : None

  let formLevelError = switch errors.network {
  | Some(error) => Some(error)
  | None => errors.eligibility
  }

  let fusedFieldError = if !fused {
    None
  } else {
    switch claim(numberInline, errors.cardNumber) {
    | Some(error) => Some((numberStyles, error))
    | None =>
      switch claim(expiryInline, errors.cardExpiry) {
      | Some(error) => Some((expiryStyles, error))
      | None =>
        switch claim(cvcInline, errors.cardCvc) {
        | Some(error) => Some((cvcStyles, error))
        | None => claim(numberInline, formLevelError)->Option.map(error => (numberStyles, error))
        }
      }
    }
  }

  let splitFormError = fused ? None : claim(numberInline, formLevelError)

  let renderErrorWith = (errorStyle, message) =>
    <VaultWidgetContext.ErrorText
      message
      theme
      errorFontSize=ctx.errorFontSize
      errorSpacing=ctx.errorSpacing
      ?errorStyle
    />

  let perFieldError = (styles: option<CardFieldStyles.fieldStyles>) =>
    fused
      ? Some(_ => React.null)
      : Some(message => renderErrorWith(styles->CardFieldStyles.errorOf, message))

  <React.Fragment>
    <View style={s({marginBottom: theme.gap->dp})}>

      <CardRenderIf condition={cardholderName === #collect}>
        <View style={s({width: 100.->pct, marginBottom: theme.gap->dp})}>
          <BoundCardFields.CardholderName
            ctx
            styles=?cardholderStyles
            options=?cardholderOptions
            renderError=?{Some(
              message => renderErrorWith(cardholderStyles->CardFieldStyles.errorOf, message),
            )}
          />
        </View>
      </CardRenderIf>
      <View style={s({width: 100.->pct, borderRadius: theme.borderRadius})}>
        <View
          style={s({
            width: 100.->pct,
            marginBottom: ?(fused ? None : Some(theme.gap->dp)),
          })}>
          <BoundCardFields.Number
            ctx
            styles=?numberStyles
            options=?numberOptions
            renderError=?{perFieldError(numberStyles)}

            iconRight={CardNumberAccessory.iconFor(
              ~ctx,
              ~brandIconMode=CardFieldOptions.resolveBrandIconMode(
                numberOptions,
                ~formWide=ctx.brandIconMode,
                ~unstyled=CardFieldOptions.unstyledFor(
                  numberOptions->Option.flatMap(o => o.unstyled),
                  ~formWide=ctx.unstyled,
                ),
              ),
            )}
            borderBottomWidth=?{fused ? Some(theme.borderWidth /. 2.) : None}
            borderBottomLeftRadius=?{fused ? Some(0.) : None}
            borderBottomRightRadius=?{fused ? Some(0.) : None}
          />
        </View>
        <View
          style={s({
            flexDirection: inline
              ? labels.isRtl ? #"row-reverse" : #row
              : #column,
            gap: ?(fused ? None : Some(theme.gap->dp)),
          })}>
          <View style={s({flex: ?(inline ? Some(1.) : None)})}>
            <BoundCardFields.Expiry
              ctx
              styles=?expiryStyles
              options=?expiryOptions
              renderError=?{perFieldError(expiryStyles)}
              borderTopWidth=?{fused ? Some(theme.borderWidth /. 2.) : None}

              borderRightWidth=?{fused && inline ? Some(theme.borderWidth /. 2.) : None}
              borderBottomWidth=?{fused && !inline ? Some(theme.borderWidth /. 2.) : None}
              borderTopLeftRadius=?{fused ? Some(0.) : None}
              borderTopRightRadius=?{fused ? Some(0.) : None}
              borderBottomRightRadius=?{fused ? Some(0.) : None}

              borderBottomLeftRadius=?{fused && !inline ? Some(0.) : None}
            />
          </View>
          <View style={s({flex: ?(inline ? Some(1.) : None)})}>
            <BoundCardFields.Cvc
              ctx
              styles=?cvcStyles
              options=?cvcOptions
              renderError=?{perFieldError(cvcStyles)}
              borderTopWidth={fused ? theme.borderWidth /. 2. : theme.borderWidth}
              borderLeftWidth={fused && inline ? theme.borderWidth /. 2. : theme.borderWidth}
              borderTopLeftRadius={fused ? 0. : theme.borderRadius}
              borderTopRightRadius={fused ? 0. : theme.borderRadius}

              borderBottomLeftRadius={fused && inline ? 0. : theme.borderRadius}
            />
          </View>
        </View>
      </View>

      <CardRenderIf condition={fusedFieldError->Option.isSome}>
        {switch fusedFieldError {
        | Some((styles, error)) => renderErrorWith(styles->CardFieldStyles.errorOf, error)
        | None => React.null
        }}
      </CardRenderIf>

      <CardRenderIf condition={splitFormError->Option.isSome}>
        {switch splitFormError {
        | Some(error) => renderErrorWith(numberStyles->CardFieldStyles.errorOf, error)
        | None => React.null
        }}
      </CardRenderIf>
    </View>
  </React.Fragment>
}
