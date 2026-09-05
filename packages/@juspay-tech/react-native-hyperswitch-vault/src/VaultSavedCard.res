type updateRequest = {
  vaultBaseUrl: string,

  sdkAuthorization: string,

  paymentMethodToken: string,

  cvc: string,

  appId?: string,
  timeoutMs?: int,
  signal?: VaultConfirm.abortSignal,
}

let updateUrl = (~baseUrl, ~sessionId) =>
  `${baseUrl}/v1/payment-method-sessions/${sessionId->VaultConfirm.encodeURIComponent}/update-saved-payment-method`

let buildUpdateBody = (~paymentMethodToken: string, ~cvc: string) => {
  let cardData = (
    "payment_method_data",
    [("card", [("card_cvc", cvc->JSON.Encode.string)]->Dict.fromArray->JSON.Encode.object)]
    ->Dict.fromArray
    ->JSON.Encode.object,
  )

  switch paymentMethodToken {
  | "" => [cardData]
  | token => [("payment_method_token", token->JSON.Encode.string), cardData]
  }
  ->Dict.fromArray
  ->JSON.Encode.object
}

let headersFor = (~sdkAuthorization: string, ~appId: option<string>) =>
  [
    ("Content-Type", "application/json"),
    ("Authorization", sdkAuthorization),
    ("x-app-id", appId->VaultConfirm.appIdHeader),
    ("x-redirect-uri", ""),
  ]->Dict.fromArray

let updateSavedPaymentMethod = async (
  request: updateRequest,
): VaultResult.vaultTokenizeResult =>

  if !Validation.checkCardCVC(request.cvc, "") {
    VaultResult.tokenizeInvalidCardData()
  } else {
    switch request.sdkAuthorization->VaultConfirm.resolveSessionId {
    | Error(VaultConfirm.Failure({error})) => VaultResult.tokenizeFromPmsFailure(error)

    | Error(VaultConfirm.Success(_)) =>
      VaultResult.tokenizeFailedWith(#invalid_session, VaultResult.unusableSessionMessage)
    | Ok(sessionId) =>
      let url = updateUrl(~baseUrl=request.vaultBaseUrl, ~sessionId)

      let controller = VaultConfirm.makeAbortController()

      request.signal->Option.forEach(callerSignal =>
        if callerSignal->VaultConfirm.signalAborted {
          controller->VaultConfirm.abort
        } else {
          callerSignal->VaultConfirm.onSignalAbort("abort", () => controller->VaultConfirm.abort)
        }
      )

      let timedOut = ref(false)
      let timer = switch request.timeoutMs {
      | Some(ms) if ms > 0 =>
        Some(
          VaultConfirm.setTimeout(() => {
            timedOut := true
            controller->VaultConfirm.abort
          }, ms),
        )
      | _ => None
      }

      let options: VaultConfirm.fetchOptions = {
        method: "PUT",
        headers: headersFor(~sdkAuthorization=request.sdkAuthorization, ~appId=request.appId),
        body: buildUpdateBody(
          ~paymentMethodToken=request.paymentMethodToken->String.trim,
          ~cvc=request.cvc,
        )->JSON.stringify,
        signal: ?Some(controller->VaultConfirm.controllerSignal),
      }

      let attempted = try {
        Ok(await VaultConfirm.fetch(url, options))
      } catch {
      | _ => Error()
      }

      timer->Option.forEach(VaultConfirm.clearTimeout)

      let outcome = switch attempted {
      | Error() =>
        VaultConfirm.unknownOutcomeError(
          timedOut.contents
            ? "The vault did not respond in time; the outcome is unknown."
            : "The vault request did not complete; the outcome is unknown.",
        )
      | Ok(response) =>
        let status = response->VaultConfirm.responseStatus
        let parsed = try {
          Some(await response->VaultConfirm.responseJson)
        } catch {
        | _ => None
        }

        if response->VaultConfirm.responseOk {
          switch parsed {
          | None =>
            VaultConfirm.Failure({
              error: {
                code: #malformed_response,
                message: "The vault response was not valid JSON.",
                httpStatus: status,
                retryable: false,
                unknownOutcome: false,
              },
            })
          | Some(json) => json->VaultConfirm.decodeConfirmResponse(~httpStatus=status)
          }
        } else {
          VaultConfirm.describeHttpFailure(parsed, status)
        }
      }

      switch outcome {
      | VaultConfirm.Success({result}) => VaultResult.tokenizeSuccess(result.token)
      | VaultConfirm.Failure({error}) => VaultResult.tokenizeFromPmsFailure(error)
      }
    }
  }
