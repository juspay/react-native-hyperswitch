open NativeHyperswitchSdk

let getError: (~error: string=?) => presentPaymentSheetResult = (
  ~error="Unknown error occurred while presenting payment sheet",
) => {
  {
    error: {
      code: "failed",
      message: error,
    },
  }
}

let _initPaymentSession = async (params: initPaymentSessionParams): initPaymentSessionResult => {
  try {
    await nativeHyperswitchSdk.initPaymentSession(
      ~paymentIntentClientSecret=params.paymentIntentClientSecret->Option.getOr(""),
    )
    {}
  } catch {
  | Exn.Error(obj) =>
    switch Exn.message(obj) {
    | Some(msg) => {error: msg}
    | None => {error: "Unknown error occurred while initializing payment sheet"}
    }
  | _ => {error: "Unexpected error occurred while initializing payment sheet"}
  }
}
let getData = (data, ~key : string, ~fallback : string)=>{
  data
  ->Option.flatMap(obj =>
        obj->Js.Dict.get(key)->Option.flatMap(json => json->Js.Json.decodeString)
      )
      ->Option.getOr(fallback)
}

let parsePaymentSheetResult = (result: 'a): presentPaymentSheetResult => {
  try {
    let parsed = switch Js.typeof(result) {
    | "string" => Js.Json.parseExn(result)
    | _ => result->Obj.magic
    }
    let decodedObject = parsed->Js.Json.decodeObject

    let status =
      decodedObject->getData(~key="status", ~fallback="failed")
    let errorMessage =
      decodedObject->getData(~key="error", ~fallback="")
    

    let code =
      decodedObject->getData(~key="code", ~fallback="")

    let typeData =
      decodedObject->getData(~key="type", ~fallback="")
      
    let message =
      decodedObject
      ->getData(~key="message", ~fallback="failed")

    let paymentResult = {
      status,
      message,
      error: errorMessage,
      \"type": typeData,
    }
    let error = {
      code,
      message: errorMessage,
    }

    if errorMessage != "" {
      {error, paymentResult}
    } else {
      {paymentResult: paymentResult}
    }
  } catch {
  | _ => getError(~error="Failed to parse payment sheet result")
  }
}

let _presentPaymentSheet = async (params: presentPaymentSheetParams): presentPaymentSheetResult => {
  try {
    let result = await nativeHyperswitchSdk.presentPaymentSheet(params)
    result->parsePaymentSheetResult
  } catch {
  | Exn.Error(obj) =>
    // Check if the error is an object error - if so, return the error
    switch Js.typeof(obj) {
    | "object" =>
      // Try to parse the object error
      try {
        let errorObj = obj->Obj.magic
        let parsedError = errorObj->parsePaymentSheetResult
        parsedError
      } catch {
      | _ =>
        switch Exn.message(obj) {
        | Some(error) => getError(~error)
        | None => getError()
        }
      }
    | _ =>
      switch Exn.message(obj) {
      | Some(error) => getError(~error)
      | None => getError()
      }
    }
  | _ => getError()
  }
}

type useHyper = {
  initPaymentSession: initPaymentSessionParams => promise<initPaymentSessionResult>,
  presentPaymentSheet: presentPaymentSheetParams => promise<presentPaymentSheetResult>,
}

@genType
let useHyper = () => {
  let (contextData, _) = React.useContext(HyperProvider.hyperProviderContext)
  let isReady = contextData.isInitialized && contextData.error->Belt.Option.isNone

  let initPaymentSession = React.useCallback0((params: initPaymentSessionParams) => {
    _initPaymentSession(params)
  })

  let presentPaymentSheet = React.useCallback1((params: presentPaymentSheetParams) => {
    if !isReady {
      let a: promise<presentPaymentSheetResult> = Promise.resolve(
        getError(~error="Hyperswitch is not initialized"),
      )
      a
    } else {
      _presentPaymentSheet(params)
    }
  }, [isReady])

  {
    initPaymentSession,
    presentPaymentSheet,
  }
}
