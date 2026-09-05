type bundle = {
  localeDirection: string,
  cardNumberLabel: string,
  validThruText: string,
  cvcTextLabel: string,
  cardHolderName: string,
  expiryPlaceholder: string,
  cardNumberEmptyText: string,
  inValidCardErrorText: string,
  cardExpiryDateEmptyText: string,
  inValidExpiryErrorText: string,
  cvcNumberEmptyText: string,
  inValidCVCErrorText: string,
  unsupportedCardErrorText: string,
  cardNotEligibleText: string,
  selectCardBrand: string,
}

@module("./localeStrings.mjs") external bundles: Dict.t<bundle> = "localeStrings"

let english: bundle = {
  let d = LocaleDataType.defaultLocale
  {
    localeDirection: d.localeDirection,
    cardNumberLabel: d.cardNumberLabel,
    validThruText: d.validThruText,
    cvcTextLabel: d.cvcTextLabel,
    cardHolderName: d.cardHolderName,
    expiryPlaceholder: d.expiryPlaceholder,
    cardNumberEmptyText: d.cardNumberEmptyText,
    inValidCardErrorText: d.inValidCardErrorText,
    cardExpiryDateEmptyText: d.cardExpiryDateEmptyText,
    inValidExpiryErrorText: d.inValidExpiryErrorText,
    cvcNumberEmptyText: d.cvcNumberEmptyText,
    inValidCVCErrorText: d.inValidCVCErrorText,
    unsupportedCardErrorText: d.unsupportedCardErrorText,
    cardNotEligibleText: d.cardNotEligibleText,
    selectCardBrand: d.selectCardBrand,
  }
}

let isEnglish = (bundle: bundle) => bundle === english

let resolve = (locale: option<string>): bundle =>
  switch locale->Option.map(String.trim) {
  | None | Some("") | Some("auto") => english
  | Some(code) =>
    switch LocaleDataType.localeStringToType(code) {
    | None | Some(LocaleDataType.En) => english
    | Some(known) =>
      bundles->Dict.get(LocaleDataType.localeTypeToString(Some(known)))->Option.getOr(english)
    }
  }
