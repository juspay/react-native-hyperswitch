# @juspay-tech/react-native-hyperswitch-payment-methods

Provider-agnostic React Native card collection. Render **one** set of card fields and
let the backend decide which vault/tokenization provider is used — your app code never
branches on the provider. The names, options, events and results are the ones
hyperswitch-web's separate card fields and `@juspay-tech/react-native-hyperswitch-vault`
use, so one integration reads the same across all three.

```tsx
<CardNumberField />
<CardExpiryField />
<CardCVCField />
<CardholderNameField />
```

Supported vaults: **Hyperswitch**, plus **VGS, Skyflow, Basis Theory, Evervault**.

## Installation

```sh
npm install @juspay-tech/react-native-hyperswitch-payment-methods
```

Then install **only** the provider SDK(s) you actually use (they are optional peer
dependencies, so you only pay for — and natively link — what you configure):

| `vaultType`    | Peer dependency to install                          |
| -------------- | --------------------------------------------------- |
| `hyperswitch`  | `@juspay-tech/react-native-hyperswitch-vault`       |
| `vgs`          | `@vgs/collect-react-native`                         |
| `skyflow`      | `skyflow-react-native`                              |
| `basis_theory` | `@basis-theory/react-native-elements` (v3+)         |
| `evervault`    | `@evervault/react-native` (+ `react-native-webview`)|

If a `vaultType` is configured without its SDK installed, the form surfaces an
actionable "install X" error via `onError`.

## Usage

Wrap the checkout in `<HyperPaymentMethodSession>`. It carries the payment session, the
vault configuration and the appearance, so a form below it is just `<CardForm>` and its
fields — the same code for every provider.

Give it **either** `sdkAuthorization` **or** `vaultDetails`. With `sdkAuthorization` alone
the session reads the vault off the payment-method session for you; TypeScript requires
one of the two.

```tsx
import { useRef } from 'react';
import {
  Hyperswitch,
  HyperPaymentMethodSession,
  CardForm,
  CardNumberField,
  CardExpiryField,
  CardCVCField,
  CardholderNameField,
  type CardFormHandle,
} from '@juspay-tech/react-native-hyperswitch-payment-methods';

/* Created once, outside the component. */
const hyper = Hyperswitch.init({
  publishableKey: 'pk_snd_…',
  profileId: 'pro_…',      // optional; falls back to the one in sdkAuthorization
  environment: 'SANDBOX',  // 'PROD' (default) | 'SANDBOX' | 'INTEG'
});

function Checkout({ sdkAuthorization, appearance }) {
  const vaultRef = useRef<CardFormHandle>(null);

  const pay = async () => {
    const result = await vaultRef.current?.tokenize();
    if (result?.status === 'success') {
      // result.data.tokens -> the provider's tokens
    } else if (result?.error) {
      showError(result.error.message); // result.error.code names the cause
    }
  };

  return (
    <HyperPaymentMethodSession
      hyper={hyper}
      options={{ sdkAuthorization, appearance }}
    >
      <CardForm ref={vaultRef}>
        <CardNumberField />
        <CardExpiryField />
        <CardCVCField />
        <CardholderNameField />
      </CardForm>
    </HyperPaymentMethodSession>
  );
}
```

### The session's props

| Prop | |
| --- | --- |
| `hyper` | **Required.** What `Hyperswitch.init(...)` returns, or a plain `HyperswitchConfiguration` — a promise or an object. The merchant's identity and endpoints live here, not in `options`, the same split `react-hyper-js` uses. The fields do not wait for it; only the lookup does. |
| `options.sdkAuthorization` | The payment session your backend minted, as the checkout SDK spells it. Enough on its own: the vault is [looked up](#resolving-the-vault) from it. |
| `options.vaultDetails` | Which vault to drive — `{vaultType, vaultData}`, the web SDK's shape. Supply it and **no lookup happens**, even alongside `sdkAuthorization`. |
| `options.appearance` | Style defaults for every field below. See [Appearance](#appearance). |
| `onError` | Called if the `hyper` promise rejects, or the lookup fails. |

### `Hyperswitch.init`

The instance factory, so this package stands on its own — nothing else is needed to use it.
`HyperswitchConfiguration` is the checkout SDK's, field for field, so one config object
configures either package:

| | |
| --- | --- |
| `publishableKey` | **Required.** |
| `platformPublishableKey` | Carried for parity; unused by this package. |
| `profileId` | Carried for parity with the checkout SDK; unused by this package. |
| `environment` | `'PROD'` (default), `'SANDBOX'` or `'INTEG'` — the checkout SDK's spelling and its default. |
| `customEndpoints` | `{commonEndpoint}` or `{overrideEndpoints: {customBackendEndpoint}}`. Wins over `environment`, and is the only way to reach `INTEG`. |

Already using `@juspay-tech/react-native-hyperswitch`? Its `Hyperswitch.init(...)` promise is
accepted directly — it resolves to a `{publishableKey}`. Pass this package's own instance when
you need `environment` or `customEndpoints`.

At least one of `sdkAuthorization` and `vaultDetails` is required, and the type enforces it.

`usePaymentMethodsSession()` reads it back from anywhere inside the session: `hyper` (the
resolved instance — `hyper.publishableKey` and the rest), `sdkAuthorization`, `vaultDetails`,
`appearance`, `loading` and `error`.

A `<CardForm vaultDetails={…}>` still works on its own, with no session around it, and
overrides the session's vault when there is one.

### Resolving the vault

Given `sdkAuthorization` and no `vaultDetails`, the session reads the vault off the
payment-method session:

```
GET {baseUrl}/v1/payment-method-sessions/{payment_method_session_id}
Authorization: <sdkAuthorization>
```

The session id is read out of the `sdkAuthorization` itself, which is base64 of a
comma-separated `key=value` list, so you pass it nowhere.

The vault is read from the response, `vault_details` first and then
`external_vault_details`:

```jsonc
"vault_details":          { "vault_type": "hyperswitch", "vault_data": { "sdk_authorization": "…" } },
"external_vault_details": { "vgs": { "external_vault_id": "…", "sdk_env": "…" } }
```

become `{vaultType: 'hyperswitch', vaultData: {sdkAuthorization: '…'}}` and
`{vaultType: 'vgs', vaultData: {vaultId: '…', environment: '…'}}`. So one integration covers a
profile on Hyperswitch's own vault and one on an external vault, with nothing to change in your
app when that setting moves.

Hyperswitch and VGS are the wire shapes confirmed against the API; the other providers' entries
are camelized and passed through, and the provider adapter's own validation is the backstop. If
your provider's fields don't line up, pass `vaultDetails` explicitly.

While the lookup is in flight the fields render their placeholders and `tokenize()` answers
`sdk_not_ready`. If it fails, `onError` fires, `usePaymentMethodsSession().error` holds the
reason, and `tokenize()` answers `unsupported_configuration` quoting it.

Default hosts: `https://live.hyperswitch.io/api` for `PROD` (the default) and
`https://app.hyperswitch.io/api` for `SANDBOX` — the route is appended after the `/api` prefix.
`INTEG` and self-hosted deployments have no default and are reached through `customEndpoints`.

### `vaultDetails`

| `vaultType`    | `vaultData`                                                                 |
| -------------- | --------------------------------------------------------------------------- |
| `hyperswitch`  | `{sdkAuthorization, environment?}`                                          |
| `vgs`          | `{vaultId, environment?, routeId?, cname?}`                                 |
| `skyflow`      | `{vaultId, vaultUrl, table, bearerToken?, columns?, options?}`              |
| `basis_theory` | `{apiKey, baseUrl?}`                                                        |
| `evervault`    | `{teamId, appId}`                                                           |

### Tokenizing from outside the tree

If a Pay button can't reach the form ref, give the form an `id` and tokenize by id:

```tsx
<CardForm id="checkout">...</CardForm>;

import { HyperswitchPaymentMethods } from '@juspay-tech/react-native-hyperswitch-payment-methods';
await HyperswitchPaymentMethods.tokenize('checkout');
```

Descendant components can also use the `useCardForm()` hook.

### Confirming a payment through the form (host SDKs)

For the Hyperswitch vault the form can own the whole card leg of a payment: it tokenizes,
builds the card representation, merges the non-card context you pass, POSTs
`${endpoint.baseUrl}/payments/${paymentId}/confirm`, and hands back the **complete** backend
body. Available on the form ref, on `useCardForm()`, and by id:

```ts
const result = await HyperswitchPaymentMethods.confirmCardPayment('checkout', {
  paymentId,
  auth: { type: 'sdk_authorization', authorization }, // or { type: 'publishable_key', publishableKey, clientSecret }
  endpoint: { baseUrl },                              // the resolved payment backend, never guessed
  appId, paymentMethodType, paymentMethodData /* billing only */, customerAcceptance,
  browserInfo, returnUrl, paymentType, email,         // already computed by the host; forwarded as given
});

if (result.status === 'backend_response') {
  handle(result.response); // the parsed JSON body, for 2xx AND non-2xx
} else {
  // 'validation_error' | 'not_ready' | 'tokenization_error' | 'network_error' | 'unknown_outcome'
  show(result.error.message);
}
```

- `auth` is the **payment-intent** credential and is separate from the vault `sdkAuthorization`
  in `vaultDetails`. `sdk_authorization` sends the `Authorization` header and no `client_secret`;
  `publishable_key` sends `api-key` and puts `client_secret` in the body.
- The host never supplies a card source, a token or any card key; the form decides those from its
  own state. Card keys in `paymentMethodData` are refused.
- One operation per form at a time: a second `confirmCardPayment` while one is pending returns the
  same promise; `tokenize` during a confirm (and vice versa) is refused without a request. A retry
  after a failed confirm re-sends the confirm only — the token minted for the same card is reused.
- Providers without payment support (VGS, Skyflow, Basis Theory, Evervault) answer
  `not_ready` / `unsupported_configuration`; their `tokenize` path is unchanged.
- Hyperswitch vault: `vaultData.environment` is required for confirmation; `nickName` in
  `paymentMethodData` is currently dropped on this path (recorded behaviour, unchanged).

### Direct card, no vault (host SDKs)

When the merchant profile does not tokenize (`vaulting_action = skip`), mount the form in
**explicit direct mode** instead of with `vaultDetails`. No payment-method session exists,
nothing is tokenized, and the raw card never leaves the provider's secure fields; on
`confirmCardPayment` the provider POSTs `payment_method_data.card` to
`${endpoint.baseUrl}/payments/${paymentId}/confirm` itself and hands back the complete body.

```tsx
<CardForm
  id="checkout"
  directCard={{
    environment: 'SANDBOX',                     // required; also picks the asset host
    enabledCardSchemes: ['Visa', 'Mastercard'], // optional: selects / offers the network
    cardholderName: 'external',                 // optional: collect (default) | external | omit
    eligibility: {                              // optional: the provider probes eligibility itself
      paymentId, auth: { type: 'sdk_authorization', authorization },
      appId, endpoint: { baseUrl },
    },
  }}
>
  <CardNumberField />
  <CardExpiryField />
  <CardCVCField />
</CardForm>

const result = await HyperswitchPaymentMethods.confirmCardPayment('checkout', {
  paymentId, auth, endpoint, appId, paymentMethodType,
  paymentMethodData: { billing, nickName, cardholderName }, // nickname IS sent; name only with cardholderName: 'external'
  customerAcceptance, browserInfo, returnUrl, paymentType, email,
  eligibilityRequired: true,                  // gate the confirm on the provider's verdict
});
```

- Direct mode is never inferred: `directCard` must be passed, and it cannot be combined with
  `vaultDetails` (prop or session). A form with neither is a configuration error, exactly as
  before. `tokenize()` on a direct form answers `unsupported_configuration` without a request.
- The request is the same `payment_method_data.card` a checkout's own card form sends
  (`card_number`, `card_exp_month`, `card_exp_year`, `card_cvc`, `card_network`, `nick_name`,
  plus `card_holder_name` when a `CardholderNameField` is mounted); the PAN is sent digits-only
  and the year as four digits, as the web SDK does.
- `CardFormChange.payload` additionally reports `isCoBadged`, `eligibility`
  (`unknown | pending | allowed | denied`) and `networkError` (the provider's message when the
  network is outside `enabledCardSchemes`; while present, `valid` is `false`). It never carries
  the PAN, CVC or expiry input.
- `enabledCardSchemes` selects the network: exactly one detected scheme enabled (a single-network
  card, or a co-badged card of which you accept one network) is selected automatically with no
  chooser; several enabled show the provider's chooser, with the detected brand until the user
  picks; none enabled makes the form invalid (`networkError`, `valid: false`) as soon as the number
  is complete — before any submit — and it recovers when the number changes to an accepted card.
  `payload.brand` is always the network in force and it is what `card_network` carries.
- `cardholderName` picks where the holder name comes from: `'collect'` (default) a mounted
  `<CardholderNameField />`; `'external'` the host passes it on the confirm input as
  `paymentMethodData.cardholderName` (no name field is rendered or required; blank is omitted);
  `'omit'` none is sent. The name lands in `payment_method_data.card.card_holder_name`, the
  nickname in `nick_name`, always as separate keys. In any other mode a host-supplied name is
  refused (`not_ready` / `unsupported_configuration`) rather than silently dropped.
- `eligibility` probes `/payments/{id}/eligibility` inside the provider as soon as the number is
  complete; only the request context (payment id, credential, app id, endpoint) crosses this
  boundary. With `eligibilityRequired: true` a denied card answers
  `validation_error` / `card_not_eligible` and no confirm is sent; the form stays usable. Without
  a mount-time `eligibility`, `eligibilityRequired` makes the confirm run the probe first.
- Only the Hyperswitch provider supports direct mode today (its fields ship the confirm
  transport). Tokenized forms are unchanged: `vaultDetails` still requires `sdkAuthorization`,
  `tokenize()` returns the same shapes, and the tokenized confirm still drops `nickName`.

## Saved card — CVC recollect

Mount **only** the CVC field and give it the stored card's token:

```tsx
<HyperPaymentMethodSession hyper={hyper} options={{ sdkAuthorization }}>
  <CardForm ref={vaultRef}>
    <CardCVCField
    options={{
      savedCard: {
        paymentMethodToken: entry.payment_method_token,
        paymentMethodData: { card: { cardNetwork: entry.payment_method_data.card.card_network } },
      },
    }}
  />
  </CardForm>
</HyperPaymentMethodSession>;

const result = await vaultRef.current?.tokenize();
```

`tokenize()` sends just the CVC through the configured vault and hands the stored card
back beside the vault's tokens, so your backend knows what to confirm with:

```ts
result.data.tokens;    // the provider's tokens for the CVC
result.data.savedCard; // the entry back, network in the web's spelling
```

Rules, all answered **without a request**:

- A CVC field with `savedCard` must be the only field in the form. Another field beside
  it is `unsupported_configuration`.
- `savedCard` on any field other than the CVC is `unsupported_configuration`.
- A missing or blank `paymentMethodToken` is `validation_error`.

`paymentMethodData.card.cardNetwork` is passed down to the provider's field as a card-network
hint and echoed back on the result in the web's spelling. Every member is optional, so a
`list-payment-methods` entry passes through without reshaping — the same shape
`@juspay-tech/react-native-hyperswitch-vault` takes. It is a hint, not a length rule this package enforces:
the digits never leave the provider's secure input, so CVC length validation is whatever
the provider does.

## The result shape

```ts
type TokenizeResult =
  | {
      status: 'success';
      vaultType?: VaultType;
      data?: { tokens?: Record<string, unknown>; raw?: unknown; savedCard?: SavedCard };
      card?: TokenizedCard;
    }
  | { status: 'validation_error' | 'error'; vaultType?: VaultType; error: { code; message; type } };

/* The card the provider reported, in the members `onChange` publishes — so `result.card.last4`
   and `event.payload.last4` read alike. Never a PAN, never a CVC. */
type TokenizedCard = {
  bin?: string; last4?: string; brand?: string; expiryMonth?: string; expiryYear?: string;
};
```

`tokenize()` never throws. `if (result.error)` reads the same way it does with the web
SDK; `status` lets TypeScript narrow.

`card` carries whatever the provider told the form about the card. A provider whose secure input
keeps every digit reports nothing, and then there is no `card` key at all; Evervault reports the
BIN, last four, brand and expiry. An absent member is an absent key, never `undefined`.

| `error.code`               | `type`             | Meaning                                                              |
| -------------------------- | ------------------ | -------------------------------------------------------------------- |
| `validation_error`         | `validation_error` | a field is empty or malformed, or `savedCard` has no paymentMethodToken           |
| `incomplete_field_set`     | `validation_error` | no `<CardForm id>` is mounted for the id given to `tokenize(id)`     |
| `unsupported_configuration`| `api_error`        | no vault configuration in scope or the lookup failed, or `savedCard` mounted beside other fields |
| `sdk_not_ready`            | `api_error`        | the provider's SDK has not finished initialising, or the vault lookup is still in flight |
| `session_expired`          | `api_error`        | Hyperswitch vault: the session's `expires_at` has passed             |
| `session_consumed`         | `api_error`        | Hyperswitch vault: this session already tokenized a card             |
| `invalid_session`          | `api_error`        | Hyperswitch vault: no session, or an unreadable one                  |
| `unknown_outcome`          | `api_error`        | the request threw, timed out, or was aborted — reconcile before retrying |
| `tokenization_failed`      | `api_error`        | the provider refused, answered unreadably, or failed to initialise   |

Two `tokenize()` calls at once share one request.

## Events

Every field takes the web's four events. The change carries no card value:

```tsx
<CardNumberField
  onReady={(e) => {/* e.elementType === 'cardNumber' */}}
  onFocus={(e) => setActive(e.elementType)}
  onBlur={() => setActive(null)}
  onChange={(s) => setValid(s.valid)}
  // s: {elementType, empty, complete, valid, brand?, error?, touched}
/>
```

`brand` is spelt as the web spells it (`Visa`, `Mastercard`, `AmericanExpress`, …).
Focus and blur are reported where the provider reports them (VGS, Skyflow); change is
wired for VGS, Skyflow and Basis Theory (Evervault reports validity at the card level).

The form emits the web's `cardDetailsChange` on every change, always on:

```tsx
<CardForm
  onReady={(e) => {/* e.elementType === 'cardForm' */}}
  onChange={(e) => {
    // e.eventName === 'cardDetailsChange'
    setCanPay(e.complete && e.valid);
    e.payload; // {bin, last4, brand, expiryMonth, expiryYear, formattedExpiry, is*Complete, is*Valid}
    e.fields;  // the latest change per mounted field
  }}
>
```

A provider's secure input keeps the digits to itself, so `bin`, `last4` and the expiry
parts are `null` unless the provider reports them (Evervault does); the flags are derived
from the fields.

## Handles

- Form ref (`CardFormHandle`): `tokenize(providerData?)`, `status`
  (`initializing | ready | tokenizing | error`).
- Field ref (`FieldHandle`): `focus()`, `blur()`, `clear()` — no-ops where the provider's
  secure input does not support them.

```tsx
const field = useRef<FieldHandle>(null);
<CardNumberField ref={field} />;
field.current?.focus();
```

`useCardForm()` is the ref-free spelling, for a Pay button that lives inside the form:

```tsx
function PayButton() {
  const { tokenize, status } = useCardForm();
  return <Button title="Pay" disabled={status !== 'ready'} onPress={() => tokenize()} />;
}
```

## Appearance

A field has the same two slots as the Hyperswitch vault fields:

- `styles.container` — the field's **box** (border, background, radius, height, padding).
- `styles.input` — the secure input's **text** (color, fontSize, fontFamily).
- `placeholder` — placeholder text.
- `cvcIcon` (`CardCVCField` only) — `'default'` shows the CVC icon, `'hidden'` removes it.
  Supported by the Hyperswitch vault; other providers ignore it.

```tsx
<CardNumberField
  styles={{
    container: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, height: 44, paddingHorizontal: 12 },
    input: { color: '#111', fontSize: 16 },
  }}
  placeholder="1234 5678 9012 3456"
/>
```

`options.appearance` sets defaults for those same slots across every field below, with
`fields` narrowing a default to one element type:

```tsx
<HyperPaymentMethodSession
  hyper={hyper}
  options={{
    sdkAuthorization,
    appearance: {
      container: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, height: 44 },
      input: { color: '#111', fontSize: 16 },
      fields: { cardCvc: { container: { width: 88 } } },
    },
  }}
>
```

Later wins, so the order is: the session's `appearance`, then a `<CardForm appearance>`,
then the per-element-type `fields` entry, then the field's own `styles`.

`styles.input` is forwarded to the provider's underlying secure input where supported
(VGS `textStyle`, Basis Theory / Evervault field style); providers that don't support
text styling ignore it.

## Custom providers

Register your own adapter (also handy in tests):

```ts
import { registerAdapter } from '@juspay-tech/react-native-hyperswitch-payment-methods';
const off = registerAdapter(myAdapter); // off() to unregister
```

An adapter provides `vaultType`, `validateVaultData`, a `Host`, a `Field` (which
receives `elementType`, `styles`, `placeholder`, `savedCard`, `cvcIcon`, `onChange`,
`onFocus`, `onBlur`) and `tokenize(collector, providerData?)`.

## Notes

- **VGS** uses `@vgs/collect-react-native`, currently in **beta** — pin the version.
- **Basis Theory** targets `@basis-theory/react-native-elements` **v3+** (the older SDK is
  deprecated).
- **Evervault** additionally requires `react-native-webview`.

## Contributing

- [Development workflow](CONTRIBUTING.md#development-workflow)
- [Sending a pull request](CONTRIBUTING.md#sending-a-pull-request)
- [Code of conduct](CODE_OF_CONDUCT.md)

## License

MIT

---

Made with [create-react-native-library](https://github.com/callstack/react-native-builder-bob)
