open Validation

type numberChange = {
  formatted: string,
  brand: string,

  matchedSchemes: array<string>,
  clearDependents: bool,
  advanceFocus: bool,
}

let onCardNumberText = (text: string, ~currentBrand: string): numberChange => {
  let matchedSchemes = text->clearSpaces->getAllMatchedCardSchemes
  let brand = matchedSchemes->Array.get(0)->Option.getOr("")
  let formatted = formatCardNumber(text, cardType(brand))
  let clearDependents =
    brand !== currentBrand && matchedSchemes->Array.find(v => v === brand)->Option.isNone
  {
    formatted,
    brand,
    matchedSchemes,
    clearDependents,
    advanceFocus: cardValid(formatted, brand) && isCardNumberEqualsMax(formatted, brand),
  }
}

type expiryChange = {
  display: string,
  month: string,
  year: string,
  advanceFocus: bool,
}

let onExpiryText = (text: string): expiryChange => {
  let display = formatCardExpiryNumber(text)
  let (month, year) = display->splitExpiryDates
  {display, month, year, advanceFocus: checkCardExpiry(display)}
}

type cvcChange = {
  formatted: string,
  blurField: bool,
}

let onCvcText = (text: string, ~brand: string): cvcChange => {
  let formatted = formatCVCNumber(text, brand)
  {
    formatted,
    blurField: checkCardCVC(formatted, brand) && checkMaxCardCvv(formatted, brand),
  }
}

type backspaceAction = [#blurSelf | #focusCardNumber | #focusExpiry | #none]

let onCardholderNameText = (text: string): string => text

let onCardNumberBackspace = (~value: string) => value === "" ? #blurSelf : #none
let onExpiryBackspace = (~display: string) => display === "" ? #focusCardNumber : #none
let onCvcBackspace = (~value: string) => value === "" ? #focusExpiry : #none

type eligibilityProbe = [#check(string) | #reset | #idle]

let eligibilityFor = (~cardNumber: string, ~brand: string, ~alreadyAllowed: bool) => {
  let isValid = cardValid(cardNumber, brand)
  if isValid && isCardNumberEqualsMax(cardNumber, brand) {
    #check(cardNumber->clearSpaces)
  } else if !isValid && !alreadyAllowed {
    #reset
  } else {
    #idle
  }
}
