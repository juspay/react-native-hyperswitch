type hyperProviderData = {
  publishableKey: string,
  customBackendUrl?: string,
  customLogUrl?: string,
  customParams?: Js.Json.t,
  isInitialized: bool,
  error?: string,
}

let defaultVal: hyperProviderData = {
  publishableKey: "",
  isInitialized: false,
}

let hyperProviderContext = React.createContext((defaultVal, (_: hyperProviderData) => ()))

module Provider = {
  let make = React.Context.provider(hyperProviderContext)
}

@genType
let initHyperswitch = (~publishableKey, ~customBackendUrl=?, ~customLogUrl=?, ~customParams=?) => {
  NativeHyperswitchSdk.nativeHyperswitchSdk.initialise(
    ~publishableKey,
    ~customBackendUrl?,
    ~customLogUrl?,
    ~customParams?,
  )
}

@genType @react.component
let make = (
  ~children: React.element,
  ~publishableKey="",
  ~customBackendUrl=?,
  ~customLogUrl=?,
  ~customParams=?,
) => {
  let (state, setState) = React.useState(_ => {
    publishableKey,
    ?customBackendUrl,
    ?customLogUrl,
    ?customParams,
    isInitialized: false,
  })

  let getError = (~error="Failed to initialize Hyperswitch") => {...state, error}

  let initialise = async () => {
    try {
      let _ = await initHyperswitch(~publishableKey, ~customBackendUrl?, ~customLogUrl?, ~customParams?)
      setState(_ => {
        ...state,
        isInitialized:true,
      })
    } catch {
    | Exn.Error(obj) =>
      switch Exn.message(obj) {
      | Some(error) => setState(_ => getError(~error))
      | None => setState(_ => getError())
      }
    | _ => setState(_ => getError())
    }
  }

  React.useEffect1(() => {
    if (publishableKey != "") {
      initialise()->ignore
    }
    None
  }, [publishableKey])

  let setState = React.useCallback1(val => {
    setState(_ => val)
  }, [setState])

  <Provider value=(state, setState)> children </Provider>
}
