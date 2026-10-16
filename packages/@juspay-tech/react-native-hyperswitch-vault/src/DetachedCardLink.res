/*
 * What a detached card form's Host shares with its Fields. Each Field sits in a React root of its
 * own, so it cannot read the Host's context; it reads this instead.
 *
 * The card is NOT here. It lives in the VaultCardStore that the Host and every Field subscribe to.
 * This holds only the Host's machinery (so the form's handle can tokenize through it) and whether a
 * submit is in flight (so every Field disables itself, as it would inside a <CardForm>).
 */
type t = {
  mutable machinery: option<VaultFormCoordinator.machinery>,
  mutable focusField: option<VaultPublicState.elementType => unit>,
  mutable submitting: bool,
  mutable listeners: array<(int, unit => unit)>,
  mutable nextListenerId: int,
}

let make = (): t => {
  machinery: None,
  focusField: None,
  submitting: false,
  listeners: [],
  nextListenerId: 0,
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
