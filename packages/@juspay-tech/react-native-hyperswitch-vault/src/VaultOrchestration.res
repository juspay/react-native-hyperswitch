@genType
type orchestrationConfirmInput = {
  tokenizedCard: VaultConfirmBody.providerTokenizedCard,
  paymentId: string,

  sdkAuthorization?: string,
  publishableKey?: string,
  clientSecret?: string,

  environment: VaultFormOptions.vaultEnvironment,

  endpoint?: VaultEndpoint.vaultEndpointConfig,
  appId?: string,
  paymentMethodType?: VaultConfirmBody.paymentMethodType,

  paymentMethodData?: VaultPaymentMethodData.hostPaymentMethodData,
  customerAcceptance?: VaultConfirmBody.hostCustomerAcceptance,
  browserInfo?: VaultConfirmBody.hostBrowserInfo,
  returnUrl?: string,
  paymentType?: VaultConfirmBody.paymentType,
  email?: string,
  timeoutMs?: int,
}

let blank = (value: string) => value->String.trim->String.length === 0

@genType
let confirmTokenizedCardPayment = async (
  input: orchestrationConfirmInput,
): VaultResult.vaultPaymentResult => {
  let card = input.tokenizedCard

  if (
    blank(card.cardNumberAlias) ||
    blank(card.cardCvcAlias) ||
    blank(card.expiryMonth) ||
    blank(card.expiryYear)
  ) {
    VaultResult.invalidCardData()
  } else {
    switch VaultCredential.resolve(
      ~sdkAuthorization=input.sdkAuthorization,
      ~publishableKey=input.publishableKey,
      ~clientSecret=input.clientSecret,
    ) {

    | None => VaultResult.invalidSession(VaultResult.unusableSessionMessage)
    | Some(credential) =>
      switch input.paymentMethodData->VaultPaymentMethodData.validateHostPaymentMethodData {
      | Error() => VaultResult.forbiddenCardData()
      | Ok() =>
        switch input.endpoint->VaultEndpoint.resolveBaseUrl(~environment=input.environment) {
        | Error() => VaultResult.unsupportedConfiguration()
        | Ok(baseUrl) =>
          let body = VaultConfirmBody.build(
            ~cardPayload=ExternalTokenPayload({card: card}),
            ~paymentMethodType=input.paymentMethodType,
            ~paymentMethodData=input.paymentMethodData,
            ~customerAcceptance=input.customerAcceptance,
            ~browserInfo=input.browserInfo,
            ~returnUrl=input.returnUrl,
            ~paymentType=input.paymentType,
            ~email=input.email,
            ~clientSecret=credential->VaultCredential.clientSecretForBody,
          )

          let navOutcome = await VaultFinalConfirm.confirmPayment({
            baseUrl,
            paymentId: input.paymentId,
            credential,
            appId: ?input.appId,
            body,
            timeoutMs: ?input.timeoutMs,
          })

          navOutcome->VaultResult.fromNavOutcome
        }
      }
    }
  }
}
