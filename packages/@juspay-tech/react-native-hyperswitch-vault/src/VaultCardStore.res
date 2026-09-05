open ReactNative

type widgetKind = CardNumberKind | ExpiryKind | CvcKind | CardholderNameKind

type t = {
  mutable state: CardStateReducer.state,
  mutable listeners: array<(int, unit => unit)>,
  mutable nextListenerId: int,
  registry: Map.t<int, widgetKind>,
  mutable nextWidgetId: int,
  mutable registryVersion: int,
  cardRef: React.ref<Nullable.t<TextInput.element>>,
  expiryRef: React.ref<Nullable.t<TextInput.element>>,
  cvcRef: React.ref<Nullable.t<TextInput.element>>,
  cardholderRef: React.ref<Nullable.t<TextInput.element>>,
}

let makeRef = (): React.ref<Nullable.t<TextInput.element>> => {current: Nullable.null}

let make = (): t => {
  state: CardStateReducer.initial,
  listeners: [],
  nextListenerId: 0,
  registry: Map.make(),
  nextWidgetId: 0,
  registryVersion: 0,
  cardRef: makeRef(),
  expiryRef: makeRef(),
  cvcRef: makeRef(),
  cardholderRef: makeRef(),
}

let notify = (store: t) => store.listeners->Array.forEach(((_, listener)) => listener())

let subscribe = (store: t, listener: unit => unit) => {
  store.nextListenerId = store.nextListenerId + 1
  let id = store.nextListenerId
  store.listeners = store.listeners->Array.concat([(id, listener)])
  () => store.listeners = store.listeners->Array.filter(((other, _)) => other !== id)
}

let getState = (store: t, ()) => store.state

let dispatch = (store: t, action: CardStateReducer.action) => {
  let next = CardStateReducer.reduce(store.state, action)
  if next !== store.state {
    store.state = next
    store->notify
  }
}

let register = (store: t, kind: widgetKind) => {
  store.nextWidgetId = store.nextWidgetId + 1
  let id = store.nextWidgetId
  store.registry->Map.set(id, kind)
  store.registryVersion = store.registryVersion + 1
  store->notify
  () => {
    store.registry->Map.delete(id)->ignore
    store.registryVersion = store.registryVersion + 1
    store->notify
  }
}

let countOf = (store: t, kind: widgetKind) =>
  store.registry
  ->Map.values
  ->Iterator.toArray
  ->Array.filter(entry => entry === kind)
  ->Array.length

let getRegistryVersion = (store: t, ()) => store.registryVersion
