/*
 * What a detached card form's Host shares with its Fields. Each Field sits in a React root of its
 * own, so it cannot read the Host's context; it reads this instead.
 *
 * The card is NOT here. It lives in the VaultCardStore that the Host and every Field subscribe to.
 * This holds only the Host's machinery (so the form's handle can tokenize through it), whether a
 * submit is in flight (so every Field disables itself, as it would inside a <CardForm>), and the
 * form's one logger (so the logs of every root carry one session_id, as a <CardForm>'s do).
 */
type t = {
  mutable machinery: option<VaultFormCoordinator.machinery>,
  mutable focusField: option<VaultPublicState.elementType => unit>,
  mutable submitting: bool,
  mutable listeners: array<(int, unit => unit)>,
  mutable nextListenerId: int,
  // The form's logger and the URL it was made for ("" when the form logs nowhere).
  mutable logger: option<(string, VaultLogger.t)>,
}

let make = (): t => {
  machinery: None,
  focusField: None,
  submitting: false,
  listeners: [],
  nextListenerId: 0,
  logger: None,
}

let subscribe = (link: t, listener: unit => unit) => {
  link.nextListenerId = link.nextListenerId + 1
  let id = link.nextListenerId
  link.listeners = link.listeners->Array.concat([(id, listener)])
  () => link.listeners = link.listeners->Array.filter(((other, _)) => other !== id)
}

let isSubmitting = (link: t, ()) => link.submitting

let setSubmitting = (link: t, submitting: bool) =>
  if link.submitting !== submitting {
    link.submitting = submitting
    link.listeners->Array.forEach(((_, listener)) => listener())
  }

/*
 * The form's logger: made by whichever root asks first, then the same one for every root. A new
 * logging URL (the form's endpoints or environment changed) gets a new logger, as it does in a
 * <CardForm>; the roots flush the old one as they let go of it.
 */
let loggerFor = (link: t, ~url: option<string>, ~platform: string) => {
  let key = url->Option.getOr("")
  switch link.logger {
  | Some((current, logger)) if current === key => logger
  | _ =>
    let logger = VaultLogger.make(~url, ~platform)
    link.logger = Some((key, logger))
    logger
  }
}
