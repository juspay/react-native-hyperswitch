type errorUtils = {reportError: exn => unit}

@val @scope("globalThis") external errorUtils: Nullable.t<errorUtils> = "ErrorUtils"

external asExn: Js.Exn.t => exn = "%identity"

let reportNonFatal = (exn: exn) =>
  try switch errorUtils->Nullable.toOption {
  | None => ()
  | Some(utils) =>
    utils.reportError(
      switch exn {
      | Js.Exn.Error(jsError) => asExn(jsError)
      | _ => exn
      },
    )
  } catch {
  | _ => ()
  }

let notifySafely = (fn: 'a => unit, value: 'a) =>
  try fn(value) catch {
  | exn => reportNonFatal(exn)
  }

let use = (~build: unit => 'a, ~equal: ('a, 'a) => bool, ~notify: option<'a => unit>) => {
  let notifyRef = React.useRef(notify)
  notifyRef.current = notify

  let lastRef: React.ref<option<'a>> = React.useRef(None)
  let listeningRef = React.useRef(notify->Option.isSome)

  React.useEffectOnEveryRender(() => {
    let listening = notifyRef.current->Option.isSome

    if listening && !listeningRef.current {
      lastRef.current = None
    }
    listeningRef.current = listening

    switch notifyRef.current {
    | None => ()
    | Some(fn) =>
      let next = build()
      let changed = switch lastRef.current {
      | Some(previous) => !equal(previous, next)
      | None => true
      }
      if changed {
        lastRef.current = Some(next)
        notifySafely(fn, next)
      }
    }
    None
  })
}

let useReady = (~elementType: VaultPublicState.elementType, ~notify: option<VaultPublicState.fieldEvent => unit>) => {
  let notifyRef = React.useRef(notify)
  notifyRef.current = notify
  React.useEffect0(() => {
    switch notifyRef.current {
    | Some(fn) => notifySafely(fn, {VaultPublicState.elementType: elementType})
    | None => ()
    }
    None
  })
}
