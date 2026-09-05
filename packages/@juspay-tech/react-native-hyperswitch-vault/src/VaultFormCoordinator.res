type readySession = {
  authorization: string,
  expiresAt: option<float>,
}

type sessionState =
  | Ready(readySession)
  | Unusable(string)

let parseExpiresAt = (session: Dict.t<JSON.t>): option<float> =>
  session
  ->Dict.get("expires_at")
  ->Option.flatMap(JSON.Decode.string)
  ->Option.flatMap(text => {
    let ms = Date.fromString(text)->Date.getTime
    Float.isNaN(ms) ? None : Some(ms)
  })

let readSession = (session: JSON.t): sessionState => {
  let root = session->JSON.Decode.object
  let vaultDetails =
    root
    ->Option.flatMap(root => root->Dict.get("vault_details"))
    ->Option.flatMap(JSON.Decode.object)

  switch vaultDetails {
  | None => Unusable("This session does not support saving a card.")
  | Some(details) =>
    let vaultType =
      details
      ->Dict.get("vault_type")
      ->Option.flatMap(JSON.Decode.string)
      ->Option.getOr("")
      ->String.trim
      ->String.toLowerCase

    let authorization =
      details
      ->Dict.get("vault_data")
      ->Option.flatMap(JSON.Decode.object)
      ->Option.flatMap(vaultData => vaultData->Dict.get("sdk_authorization"))
      ->Option.flatMap(JSON.Decode.string)
      ->Option.getOr("")

    switch vaultType {
    | "hyperswitch" =>
      authorization->String.trim->String.length > 0
        ? Ready({authorization, expiresAt: root->Option.flatMap(parseExpiresAt)})
        : Unusable("This session is missing its vault details.")
    | _ => Unusable("This session uses a card vault this component does not support.")
    }
  }
}

let sessionFromAuthorization = (sdkAuthorization: string): sessionState => {
  let trimmed = sdkAuthorization->String.trim
  trimmed->String.length > 0
    ? Ready({authorization: trimmed, expiresAt: None})
    : Unusable("No card-vault session was supplied.")
}

let sessionFromVaultDetails = (
  ~details: VaultDetails.vaultDetails,
  ~sdkAuthorization: option<string>,
): sessionState => {
  let vaultType = details.vaultType->Option.getOr("hyperswitch")->String.trim->String.toLowerCase
  let authorization =
    details.vaultData
    ->Option.flatMap(data => data.sdkAuthorization)
    ->Option.map(String.trim)
    ->Option.filter(value => value->String.length > 0)
    ->Option.orElse(sdkAuthorization->Option.map(String.trim))
    ->Option.getOr("")
  switch vaultType {
  | "" | "hyperswitch" =>
    authorization->String.length > 0
      ? Ready({authorization, expiresAt: None})
      : Unusable("This session is missing its vault details.")
  | _ => Unusable("This session uses a card vault this component does not support.")
  }
}

let isExpired = (session: readySession) =>
  switch session.expiresAt {
  | Some(expiresAt) => Date.now() >= expiresAt
  | None => false
  }

let environmentKey = (environment: VaultConfirm.vaultEnvironment) =>
  switch environment {
  | #PROD => "PROD"
  | #SANDBOX => "SANDBOX"
  | #INTEG => "INTEG"
  }

@genType
type paymentConfirmInput = {

  cardSource: VaultCardSource.paymentCardSource,
  paymentId: string,

  sdkAuthorization?: string,
  publishableKey?: string,
  clientSecret?: string,

  cardholderName?: string,
  paymentMethodType?: VaultConfirmBody.paymentMethodType,
  paymentMethodData?: VaultPaymentMethodData.hostPaymentMethodData,
  customerAcceptance?: VaultConfirmBody.hostCustomerAcceptance,
  browserInfo?: VaultConfirmBody.hostBrowserInfo,
  returnUrl?: string,
  paymentType?: VaultConfirmBody.paymentType,
  email?: string,

  eligibilityRequired?: bool,

  appId?: string,

  endpoint?: VaultEndpoint.vaultEndpointConfig,

  vaultEndpoint?: VaultEndpoint.vaultEndpointConfig,
}

type submitFlow =
  | NewCard
  | SavedCardCvc(CardStateReducer.savedCard)

type machinery = {
  tokenize: unit => promise<VaultResult.vaultTokenizeResult>,
  confirmPayment: paymentConfirmInput => promise<VaultResult.vaultPaymentResult>,
  reset: unit => unit,
  isSubmitting: bool,

  isConsumed: bool,
}

external argsAsNullable: paymentConfirmInput => Nullable.t<paymentConfirmInput> = "%identity"

type inFlight =
  | TokenizeInFlight(promise<VaultResult.vaultTokenizeResult>)
  | ConfirmInFlight(promise<VaultResult.vaultPaymentResult>)

type mintedToken = {
  sessionKey: string,
  cardVersion: int,
  token: string,
  metadata: VaultConfirm.vaultCardMetadata,
}

type mintFailure =
  | Transport(VaultConfirm.vaultError)

  | Consumed

  | Expired

let useMachinery = (
  ~sessionState: sessionState,
  ~environment: VaultConfirm.vaultEnvironment,
  ~isValid: unit => bool,
  ~cardDetails: unit => VaultConfirm.cardDetails,
  ~cardholderName: unit => string,

  ~cardholderNameMode: CardFieldOptions.cardholderNameMode,

  ~vaultEndpoint: option<VaultEndpoint.vaultEndpointConfig>,

  ~cardNetwork: unit => option<string>,
  ~cardVersion: unit => int,

  ~eligibilityVerdict: unit => option<VaultEligibility.verdict>,
  ~recordEligibility: VaultEligibility.verdict => unit,
  ~markSubmitAttempted: unit => unit,

  ~presenceGate: unit => result<submitFlow, string>,
  ~clearLocal: unit => unit,

  ~savedCardKey: string,
): machinery => {

  let latestRef = React.useRef((sessionState, environment, cardholderNameMode, vaultEndpoint))
  latestRef.current = (sessionState, environment, cardholderNameMode, vaultEndpoint)
  let currentCardholderNameMode = () => {
    let (_, _, mode, _) = latestRef.current
    mode
  }

  let (isSubmitting, setIsSubmitting) = React.useState(_ => false)

  let inFlightRef: React.ref<option<inFlight>> = React.useRef(None)
  let abortRef: React.ref<option<(string, VaultConfirm.abortController)>> = React.useRef(None)
  let isMountedRef = React.useRef(true)
  let generationRef = React.useRef(0)
  let mintedRef: React.ref<option<mintedToken>> = React.useRef(None)

  let (consumedKey, setConsumedKey) = React.useState(_ => None)
  let consumedRef: React.ref<option<string>> = React.useRef(None)
  let markConsumed = (authorization: string) => {
    consumedRef.current = Some(authorization)
    if isMountedRef.current {
      setConsumedKey(_ => Some(authorization))
    }
  }
  let isConsumed = (authorization: string) =>
    switch consumedRef.current {
    | Some(key) => key === authorization
    | None => false
    }

  let abortInFlight = () => {
    abortRef.current->Option.forEach(((_, controller)) => controller->VaultConfirm.abort)
    abortRef.current = None
  }

  React.useEffect0(() => {
    isMountedRef.current = true
    Some(
      () => {
        isMountedRef.current = false
        generationRef.current = generationRef.current + 1
        inFlightRef.current = None
        mintedRef.current = None
        abortInFlight()
      },
    )
  })

  let sessionKey = switch sessionState {
  | Ready(session) => session.authorization
  | Unusable(_) => ""
  }
  let endpointKey = vaultEndpoint->Option.map(e => e.VaultEndpoint.baseUrl)->Option.getOr("")
  let requestKey = `${sessionKey}|${environment->environmentKey}|${endpointKey}|${savedCardKey}`
  React.useEffect1(() => {

    mintedRef.current = None
    switch abortRef.current {
    | Some((key, _)) if key !== requestKey =>
      generationRef.current = generationRef.current + 1
      inFlightRef.current = None
      abortInFlight()
      if isMountedRef.current {
        setIsSubmitting(_ => false)
      }
    | _ => ()
    }
    None
  }, [requestKey])

  let nonBlank = (value: string) => {
    let trimmed = value->String.trim
    trimmed->String.length > 0 ? Some(trimmed) : None
  }

  let resolveCardholderName = (~supplied: option<string>): result<option<string>, unit> =>
    switch currentCardholderNameMode() {
    | #collect => supplied->Option.isSome ? Error() : Ok(cardholderName()->nonBlank)
    | #"external" => Ok(supplied->Option.flatMap(nonBlank))
    | #omit => supplied->Option.isSome ? Error() : Ok(None)
    }

  let mintToken = async (
    ~session: readySession,
    ~vaultBaseUrl: string,
    ~appId: option<string>,
    ~nickName: option<string>,
    ~cardholderName: option<string>,
    ~signal: VaultConfirm.abortSignal,
  ): result<(string, VaultConfirm.vaultCardMetadata), mintFailure> => {
    let vaultAuthorization = session.authorization
    let currentVersion = cardVersion()
    let reusable = switch mintedRef.current {
    | Some(minted)
      if minted.sessionKey === vaultAuthorization && minted.cardVersion === currentVersion =>
      Some((minted.token, minted.metadata))
    | _ => None
    }

    switch reusable {
    | Some(pair) => Ok(pair)
    | None if isConsumed(vaultAuthorization) => Error(Consumed)
    | None if isExpired(session) => Error(Expired)
    | None =>
      let outcome = await VaultConfirm.confirmPaymentMethodSession({
        sdkAuthorization: vaultAuthorization,
        vaultBaseUrl,
        appId: ?appId,
        card: cardDetails(),
        cardholderName: ?cardholderName,

        cardNetwork: ?VaultConfirmBody.cardNetworkToWire(cardNetwork()),
        nickName: ?nickName,
        signal,
      })
      switch outcome {
      | VaultConfirm.Success({result}) =>
        mintedRef.current = Some({
          sessionKey: vaultAuthorization,
          cardVersion: currentVersion,
          token: result.token,
          metadata: result.card,
        })
        markConsumed(vaultAuthorization)
        Ok((result.token, result.card))
      | VaultConfirm.Failure({error}) => Error(Transport(error))
      }
    }
  }

  let openRequest = (~vaultAuthorization, ~environment) => {
    let controller = VaultConfirm.makeAbortController()
    let (_, _, _, currentEndpoint) = latestRef.current
    let currentEndpointKey =
      currentEndpoint->Option.map(e => e.VaultEndpoint.baseUrl)->Option.getOr("")
    abortRef.current = Some((
      `${vaultAuthorization}|${environment->environmentKey}|${currentEndpointKey}|${savedCardKey}`,
      controller,
    ))
    (controller, controller->VaultConfirm.controllerSignal)
  }

  let closeRequest = controller =>
    switch abortRef.current {
    | Some((_, current)) if current === controller => abortRef.current = None
    | _ => ()
    }

  let runTokenize = async () => {
    let (sessionState, environment, _, vaultEndpoint) = latestRef.current

    switch sessionState {
    | Unusable(message) => VaultResult.tokenizeFailedWith(#invalid_session, message)
    | Ready(session) =>
      if isConsumed(session.authorization) {
        VaultResult.tokenizeSessionConsumed()
      } else if isExpired(session) {
        VaultResult.tokenizeSessionExpired()
      } else {
        switch presenceGate() {
        | Error(message) => VaultResult.tokenizeIncompleteFieldSet(message)
        | Ok(flow) =>
          if !isValid() {
            markSubmitAttempted()
            VaultResult.tokenizeInvalidCardData()
          } else {
            switch vaultEndpoint->VaultEndpoint.resolveBaseUrl(~environment) {
            | Error() =>
              VaultResult.tokenizeFailedWith(
                #unsupported_configuration,
                VaultResult.unsupportedConfigurationMessage,
              )
            | Ok(vaultBaseUrl) =>
              switch flow {

              | SavedCardCvc(saved) =>
                let (controller, signal) = openRequest(
                  ~vaultAuthorization=session.authorization,
                  ~environment,
                )
                let result = await VaultSavedCard.updateSavedPaymentMethod({
                  vaultBaseUrl,
                  sdkAuthorization: session.authorization,
                  paymentMethodToken: saved.token,
                  cvc: cardDetails().cvc,
                  signal,
                })
                closeRequest(controller)
                if result.status === #success {
                  markConsumed(session.authorization)
                }
                result

              | NewCard =>
                let (controller, signal) = openRequest(
                  ~vaultAuthorization=session.authorization,
                  ~environment,
                )
                let minted = await mintToken(
                  ~session,
                  ~vaultBaseUrl,

                  ~appId=None,
                  ~nickName=None,

                  ~cardholderName=switch currentCardholderNameMode() {
                  | #collect => cardholderName()->nonBlank
                  | #"external" | #omit => None
                  },
                  ~signal,
                )
                closeRequest(controller)
                switch minted {
                | Ok((token, metadata)) =>
                  VaultResult.tokenizeSuccess(~card=?VaultResult.tokenizedCardOf(metadata), token)
                | Error(Consumed) => VaultResult.tokenizeSessionConsumed()
                | Error(Expired) => VaultResult.tokenizeSessionExpired()
                | Error(Transport(error)) => VaultResult.tokenizeFromPmsFailure(error)
                }
              }
            }
          }
        }
      }
    }
  }

  let eligibilityGate = async (~args: paymentConfirmInput, ~credential, ~baseUrl, ~signal) =>
    if !(args.eligibilityRequired->Option.getOr(false)) {
      Ok()
    } else {
      let verdict = switch eligibilityVerdict() {
      | Some(known) => known
      | None =>
        let fresh = await VaultEligibility.check({
          baseUrl,
          paymentId: args.paymentId,
          credential,
          appId: args.appId,
          cardNumber: cardDetails().cardNumber,
          signal,
        })
        recordEligibility(fresh)
        fresh
      }
      switch verdict {
      | VaultEligibility.Denied => Error()
      | VaultEligibility.Allowed => Ok()
      }
    }

  let runConfirmPayment = async (args: paymentConfirmInput) => {
    let (sessionState, environment, _, propVaultEndpoint) = latestRef.current

    if args->argsAsNullable->Nullable.toOption->Option.isNone {
      VaultResult.invalidSession(VaultResult.unusableSessionMessage)
    } else {
      switch presenceGate() {
      | Error(message) => VaultResult.incompleteFieldSet(message)

      | Ok(SavedCardCvc(_)) => VaultResult.unsupportedConfiguration()
      | Ok(NewCard) =>
        if !isValid() {
          markSubmitAttempted()
          VaultResult.invalidCardData()
        } else if (
          args.paymentMethodData->VaultPaymentMethodData.validateHostPaymentMethodData->Result.isError
        ) {
          VaultResult.forbiddenCardData()
        } else if args.paymentId->String.trim->String.length === 0 {
          VaultResult.invalidSession(VaultResult.unusableSessionMessage)
        } else {
          switch VaultCredential.resolve(
            ~sdkAuthorization=args.sdkAuthorization,
            ~publishableKey=args.publishableKey,
            ~clientSecret=args.clientSecret,
          ) {
          | None => VaultResult.invalidSession(VaultResult.unusableSessionMessage)
          | Some(credential) =>
            switch resolveCardholderName(~supplied=args.cardholderName) {
            | Error() => VaultResult.unsupportedConfiguration()
            | Ok(resolvedCardholderName) =>
              switch args.cardSource->VaultCardSource.resolve {
              | Error(rejection) =>
                switch rejection->VaultCardSource.describe {
                | #invalid_session => VaultResult.invalidSession(VaultResult.unusableSessionMessage)
                | #unsupported_configuration => VaultResult.unsupportedConfiguration()
                }
              | Ok(source) =>
                switch args.endpoint->VaultEndpoint.resolveBaseUrl(~environment) {
                | Error() => VaultResult.unsupportedConfiguration()
                | Ok(baseUrl) =>

                  let prepared = switch source {
                  | VaultCardSource.DirectSource =>
                    switch sessionState {
                    | Ready(_) => Error(VaultResult.unsupportedConfiguration())
                    | Unusable(_) => Ok((None, args.paymentId))
                    }
                  | VaultCardSource.VaultSource({confirmTokenMode, session}) =>
                    switch session->readSession {
                    | Ready(ready) => Ok((Some((confirmTokenMode, ready)), ready.authorization))
                    | Unusable(message) => Error(VaultResult.invalidSession(message))
                    }
                  }

                  switch prepared {
                  | Error(refused) => refused
                  | Ok((tokenMode, identity)) =>
                    let vaultBase = switch tokenMode {
                    | None => Ok("")
                    | Some(_) =>
                      switch args.vaultEndpoint {
                      | Some(_) => args.vaultEndpoint
                      | None => propVaultEndpoint
                      }->VaultEndpoint.resolveBaseUrl(~environment)
                    }
                    switch vaultBase {
                    | Error() => VaultResult.unsupportedConfiguration()
                    | Ok(vaultBaseUrl) =>
                      let (controller, signal) = openRequest(
                        ~vaultAuthorization=identity,
                        ~environment,
                      )

                      let outcome = switch await eligibilityGate(
                        ~args,
                        ~credential,
                        ~baseUrl,
                        ~signal,
                      ) {
                      | Error() => VaultResult.cardNotEligible()
                      | Ok() =>
                        switch tokenMode {

                        | None =>
                          let body = VaultConfirmBody.build(
                            ~cardPayload=DirectPayload({
                              card: cardDetails(),
                              cardholderName: resolvedCardholderName,
                              cardNetwork: cardNetwork(),
                              nickName: VaultPaymentMethodData.nickNameOf(args.paymentMethodData),
                            }),
                            ~paymentMethodType=args.paymentMethodType,
                            ~paymentMethodData=args.paymentMethodData,
                            ~customerAcceptance=args.customerAcceptance,
                            ~browserInfo=args.browserInfo,
                            ~returnUrl=args.returnUrl,
                            ~paymentType=args.paymentType,
                            ~email=args.email,
                            ~clientSecret=credential->VaultCredential.clientSecretForBody,
                          )

                          let navOutcome = await VaultFinalConfirm.confirmPayment({
                            baseUrl,
                            paymentId: args.paymentId,
                            credential,
                            appId: ?args.appId,
                            body,
                            signal,
                          })
                          navOutcome->VaultResult.fromNavOutcome

                        | Some((confirmTokenMode, vaultSession)) =>
                          let minted = await mintToken(
                            ~session=vaultSession,
                            ~vaultBaseUrl,
                            ~appId=args.appId,
                            ~nickName=VaultPaymentMethodData.nickNameOf(args.paymentMethodData),
                            ~cardholderName=resolvedCardholderName,
                            ~signal,
                          )

                          switch minted {
                          | Error(Consumed) => VaultResult.sessionConsumed()
                          | Error(Expired) => VaultResult.sessionExpired()
                          | Error(Transport(error)) => VaultResult.fromPmsFailure(error)
                          | Ok((token, metadata)) =>
                            let body = VaultConfirmBody.build(
                              ~cardPayload=TokenPayload({
                                mode: confirmTokenMode,
                                token,
                                metadata,
                              }),
                              ~paymentMethodType=args.paymentMethodType,
                              ~paymentMethodData=args.paymentMethodData,
                              ~customerAcceptance=args.customerAcceptance,
                              ~browserInfo=args.browserInfo,
                              ~returnUrl=args.returnUrl,
                              ~paymentType=args.paymentType,
                              ~email=args.email,
                              ~clientSecret=credential->VaultCredential.clientSecretForBody,
                            )

                            let navOutcome = await VaultFinalConfirm.confirmPayment({
                              baseUrl,
                              paymentId: args.paymentId,
                              credential,
                              appId: ?args.appId,
                              body,
                              signal,
                            })
                            navOutcome->VaultResult.fromNavOutcome
                          }
                        }
                      }

                      closeRequest(controller)
                      outcome
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  let trackTokenize = (pending: promise<VaultResult.vaultTokenizeResult>) => {
    let generation = generationRef.current
    setIsSubmitting(_ => true)
    let tracked = pending->Promise.then(result => {
      if generationRef.current === generation {
        inFlightRef.current = None
        if isMountedRef.current {
          setIsSubmitting(_ => false)
        }
      }
      Promise.resolve(result)
    })
    inFlightRef.current = Some(TokenizeInFlight(tracked))
    tracked
  }

  let trackConfirm = (pending: promise<VaultResult.vaultPaymentResult>) => {
    let generation = generationRef.current
    setIsSubmitting(_ => true)
    let tracked = pending->Promise.then(result => {
      if generationRef.current === generation {
        inFlightRef.current = None
        if isMountedRef.current {
          setIsSubmitting(_ => false)
        }
      }
      Promise.resolve(result)
    })
    inFlightRef.current = Some(ConfirmInFlight(tracked))
    tracked
  }

  let tokenize = () =>
    switch inFlightRef.current {
    | Some(TokenizeInFlight(pending)) => pending
    | Some(ConfirmInFlight(_)) => Promise.resolve(VaultResult.tokenizeConfirmInProgress())
    | None => trackTokenize(runTokenize())
    }

  let confirmPayment = (args: paymentConfirmInput) =>
    switch inFlightRef.current {
    | Some(ConfirmInFlight(pending)) => pending
    | Some(TokenizeInFlight(_)) => Promise.resolve(VaultResult.tokenizationInProgress())
    | None => trackConfirm(runConfirmPayment(args))
    }

  let reset = () =>
    switch inFlightRef.current {
    | Some(_) => ()
    | None =>
      mintedRef.current = None
      clearLocal()
    }

  {
    tokenize,
    confirmPayment,
    reset,
    isSubmitting,
    isConsumed: switch (sessionState, consumedKey) {
    | (Ready(session), Some(key)) => key === session.authorization
    | _ => false
    },
  }
}
