# @juspay-tech/react-native-hyperswitch-vault

Collect a card in React Native. The card details never touch your app code.

Authored in ReScript, published as JavaScript with genType-generated TypeScript declarations — you
need neither. No native step: no native module, no `pod install`, no Codegen, no autolinking. Peers
are `react` (>=19 <20) and `react-native` (>=0.79 <0.88); no runtime dependencies.

---

## Which library to reach for

Use this one when the profile stores cards in **Hyperswitch's own vault** and you want its card
fields directly — the library renders them, with labels, brand marks and error states.

If the profile might instead be configured with an **external vault** (VGS, Skyflow, Basis Theory,
Evervault), reach for `@juspay-tech/react-native-hyperswitch-payment-methods`. It drives all five,
this library included, behind one set of components — so nothing in your app changes when that
server-side setting moves. It reads `vault_details` and `external_vault_details` off the same
payment-method-session response and picks the right one, loading this package as an optional peer
when the answer is `hyperswitch`.

---

## One vocabulary with the web SDK

Where hyperswitch-web's separate card fields have a name, this library uses it; what it adds is
additive and cannot collide.

| Web SDK | This library |
|---|---|
| `cardForm.create('cardNumber' \| 'cardExpiry' \| 'cardCvc', options)` | `<CardNumberField />` `<CardExpiryField />` `<CardCVCField />`, options as props |
| `cardForm.tokenize()` | `tokenize()` on the `CardForm` ref |
| `field.on(…)`, `cardForm.on(…)` | `onReady` `onFocus` `onBlur` `onChange` props |
| `change` payload, `cardDetailsChange` envelope | the same keys, plus `touched`, `errorCode`, `isCoBadged`, `canSubmit`, `fields` |
| `{error: {code, message, type}}`, `placeholder`, `savedCard`, `appearance`, `locale` | the same envelope, codes and names, plus a `status` discriminant |

The root entry is the merchant's: `tokenize()`, and nothing that moves money. The Hyperswitch
checkout SDK drives payment confirmation through `…/host` with the same components; merchants never
import it.

---

## Quick start

```sh
yarn add @juspay-tech/react-native-hyperswitch-vault
```

Your server creates the payment-method session with your secret key; pass the response through
untouched. (`vaultDetails={{vaultType: 'hyperswitch', vaultData: {sdkAuthorization}}}`, the web
SDK's spelling, is accepted in place of `session` — at the cost of not knowing its `expires_at`.)

```tsx
import {
  CardForm, CardNumberField, CardExpiryField, CardCVCField,
  type VaultFormHandle,
} from '@juspay-tech/react-native-hyperswitch-vault';

const formRef = useRef<VaultFormHandle>(null);
const [canSave, setCanSave] = useState(false);

<CardForm
  ref={formRef}
  session={session}
  environment="SANDBOX"
  locale="en"
  onChange={e => setCanSave(e.canSubmit)}>
  <CardNumberField />
  <View style={{flexDirection: 'row', gap: 12}}>
    <CardExpiryField />
    <CardCVCField />
  </View>
</CardForm>;
```

Then, on your button:

```ts
const result = await formRef.current?.tokenize();

if (result?.status === 'success') {
  await sendTokenToYourBackend(result.token); // never store or display the token in the app
} else if (result?.error) {
  showMessage(result.error.message);          // result.error.code names the cause
}
```

Unconfigured, a field renders a complete input: placeholder, floating label, brand mark, CVC glyph,
error tint. Composed fields print no error text — it arrives on `onChange` as `error`, for you to
place; the ready-made `HyperswitchVaultForm` prints it.

`tokenize()` takes no arguments and moves no money. A premature press answers `validation_error` or
`incomplete_field_set` with **no network request**; `onChange` gives you `canSubmit` as they type.

---

## Saved card — CVC only

Mount **only** `CardCVCField`, pass the stored card's token and network, settle with the same
`tokenize()`.

```tsx
<CardForm ref={formRef} session={session} environment="SANDBOX" onChange={e => setReady(e.canSubmit)}>
  <CardCVCField
    options={{savedCard: {token: entry.payment_method_token, brand: entry.payment_method_data.card.card_network}}}
  />
</CardForm>;

const result = await formRef.current?.tokenize(); // use result.token, not the one you passed
```

Your backend lists the cards with `GET /v1/payment-method-sessions/{id}/list-payment-methods` on the
**same** session and reads `requires_cvv`: `false` charges the listed token with nothing mounted,
`true` mounts this field with that entry's token. The CVC is held under the returned token for 15
minutes — confirm inside that window.

`brand` sets the CVC length rule (`'amex'` and similar aliases are understood); without it
`valid` turns true at three digits even on an Amex. The field must be the only one in the form.

`paymentMethodToken` is optional, as it is on the route: supply it and the CVC is refreshed on
that saved card; omit it and the key is left out of the request. Know what the backend does with
an absent one — it mints a **new** `TemporaryCardToken` and stores the CVC under that, the update
answers 200, and the payment confirm that follows fails with `HE_00`. Pass the listing's token
unless you specifically want that.

---

## Custom layout

Place the fields yourself; everything else is identical. Exactly one card-number, one expiry and one
CVC field per form (or one CVC field with `savedCard`). `CardholderNameField` is the one field the
web SDK lacks; blank, it is omitted from the request.

```tsx
<CardForm ref={formRef} session={session} environment="SANDBOX" appearance={{labels: 'above'}}>
  <CardholderNameField label="Name on card" />
  <CardNumberField placeholder="Card number" cardBrandIcon="standard" />
  <CardExpiryField placeholder="MM / YY" />
  <CardCVCField placeholder="CVC" cvcIcon="default" />
</CardForm>;
```

---

## Events

Callbacks fire once after mount, then only when the snapshot changes — an inline arrow is safe.
Pass none and nothing is derived. No field event carries a card value.

**On a field.** `onReady`, `onFocus` and `onBlur` give `{elementType}`. `onChange` gives:

| Key | Meaning |
|---|---|
| `empty`, `complete`, `valid` | `complete` is identical to `valid`, as on the web |
| `brand` | `'Visa' \| 'Mastercard' \| 'AmericanExpress' \| …`, absent until detected |
| `error`, `errorCode` | the message on screen and its code (`required`, `invalid_card_number`, `invalid_expiry`, `invalid_cvc`) — present once the customer leaves a bad field, gone while the cursor is back inside |
| `touched` | has the customer left this field yet? |
| `isCoBadged` | card number only: a genuine choice of network is being offered |

**On the form.** `onReady` gives `{elementType: 'cardForm'}` whenever all required fields become
complete. `onChange` gives the web's `cardDetailsChange` envelope plus this library's summary:

| Key | Meaning |
|---|---|
| `payload` | `bin`, `last4`, `brand`, `expiryMonth`, `expiryYear`, `formattedExpiry`, `isCardNumberComplete`, `isCvcComplete`, `isExpiryComplete`, `isCardNumberValid`, `isExpiryValid` — `null` until known |
| `canSubmit` | `fieldsReady && session usable && valid && !submitting` |
| `sessionStatus` | `'valid' \| 'invalid' \| 'absent' \| 'expired' \| 'consumed'` |
| `fieldsReady`, `complete`, `valid`, `submitting`, `isCoBadged` | form-wide state |
| `networkError` | present when the network is not one you accept |
| `fields` | `{cardNumber, cardExpiry, cardCvc, cardholderName?}` — each a field `change` |

`payload` comes from the same sdk-utils function the web SDK uses: `bin` at six digits, `last4` when
the number completes. It is the only place a card-derived digit reaches your code — never the PAN,
the CVC or the token.

---

## The handle

```ts
/* root — merchants */
type VaultFormHandle = {
  tokenize(): Promise<VaultTokenizeResult>;
  reset(): void;
  focus(field: 'cardNumber' | 'cardExpiry' | 'cardCvc' | 'cardholderName'): void;
};

/* each field's ref */
type VaultFieldHandle = {focus(): void; blur(): void; clear(): void};

/* ./host — the checkout SDK; the same runtime object */
type HostFormHandle = VaultFormHandle & {
  confirmPayment(input: VaultPaymentConfirmInput): Promise<VaultPaymentResult>;
};
```

- Repeating the **same** operation while it is pending returns the same promise, so double presses
  are harmless. (The web answers a second call `tokenization_in_progress`; this is deliberate.)
- Requesting the **other** operation mid-flight (on `./host`) answers `confirm_in_progress` /
  `tokenization_in_progress` with no request.
- `reset()` clears values, validation and errors, and is ignored mid-flight. `clear()` on a field
  ref clears that field.

---

## Results

```ts
/* The ONLY published type carrying a token. */
type VaultTokenizeResult =
  | {status: 'success';          token: string; card?: VaultTokenizedCard}
  | {status: 'validation_error'; error: SafeVaultError}
  | {status: 'error';            error: SafeVaultError};

/* The vault's echo of the card it stored — the members `onChange` publishes, and no more.
   Present for a new card, absent on the saved-card CVC refresh. An absent member is an
   absent key, never `undefined`. */
type VaultTokenizedCard = {
  bin?: string; last4: string; brand?: string; expiryMonth: string; expiryYear: string;
};

type SafeVaultError = {
  code: SafeVaultErrorCode;
  message: string;                                         // library-owned, customer-safe
  type: 'validation_error' | 'api_error' | 'card_error';   // the web's classification
};
```

`if (result.error)` works as it does on the web; `status` is this library's addition so TypeScript
can narrow.

| `error.code` | Meaning | Request sent? |
|---|---|---|
| `validation_error` | a field is empty or malformed, or `savedCard` has no token | no |
| `incomplete_field_set` | a required field is missing or mounted twice | no |
| `session_expired` | the session's `expires_at` has passed | no |
| `session_consumed` | this session already tokenized a card | no |
| `invalid_session` | no session, an unreadable one, or another vault's | no |
| `unsupported_configuration` | an invalid endpoint, or `savedCard` beside a card-number field | no |
| `tokenization_failed` | the vault refused, or answered unreadably | yes |
| `unknown_outcome` | the request threw, timed out, or was aborted — reconcile before retrying | unknown |
| `confirm_in_progress` | `./host` only: a payment confirmation is in flight | no |

---

## Appearance, labels and locale

```tsx
<CardForm
  appearance={{
    variables: {colorPrimary: '#0570DE', colorText: '#1A1A1A', borderRadius: 8, inputFieldHeight: 48},
    labels: 'floating',   // 'above' | 'floating' | 'never', for every field
  }}
  locale="fr"             // any code the web SDK accepts; the same sdk-utils bundles
  localisation={{validationMessages: {cardNumberInvalid: 'Vérifiez le numéro'}}}
/>
```

`variables` takes the web's names — `colorPrimary`, `colorText`, `colorDanger`,
`colorTextPlaceholder`, `colorBackground`, `borderColor`, `borderRadius`, `fontFamily`,
`inputFieldHeight` — plus this library's `borderWidth`, `gap`, `fontScale`,
`placeholderTextSizeAdjust`, `errorTextSizeAdjust`, `errorMessageSpacing` and `cardBrandIcon`.

The web's `theme`, `rules`, `innerLayout` and `fonts` are CSS concepts with no React Native
analogue. Per-field looks use `styles` slots (`root`, `container`, `input`, `placeholder`, `label`,
`error`, `accessory`), which patch the theme rather than replace it.

## Field options

| Prop | Fields | Values | Default |
|---|---|---|---|
| `placeholder` | all | any string; `''` renders none | the locale's, or the web's `1234 1234 1234 1234` / `123` |
| `label` | all | any string; `''` renders none | the locale's |
| `labelBehavior` | all | `'above' \| 'floating' \| 'never'` | `appearance.labels`, else `'floating'` |
| `errorDisplay` | all | `'none' \| 'colorOnly' \| 'inline'` | `'colorOnly'` composed, `'inline'` ready-made |
| `cardBrandIcon` | card number | `'standard' \| 'hidden' \| 'animated' \| 'hideGeneric'` | `appearance.variables.cardBrandIcon`, else `'standard'` |
| `cvcIcon` | CVC | `'hidden' \| 'default'` | `'default'` |
| `savedCard` | CVC, under `options` | `{token, brand}` | none |
| `unstyled` | all | boolean | the form's `unstyled` |
| `accessibilityLabel`, `accessibilityHint`, `testID` | all | string | library defaults |

`enabledCardSchemes` on the form restricts the networks you accept; spellings are canonicalised
(`'visa'`, `'amex'`, `'American Express'`), and an unrecognised entry is ignored with a
development-only warning.

---

## Self-hosted deployments

`environment` selects a public Hyperswitch host; `customEndpoints` overrides it with your own, and is
where `tokenize()` posts:

```tsx
<CardForm session={session} environment="SANDBOX" customEndpoints={{commonEndpoint: 'https://payments.your-company.example/api'}} />
```

The base is validated — `https` required (`http` only on loopback, never in production), no
credentials, query string or fragment. A base that fails returns `unsupported_configuration` with
nothing sent.

---

## Lifecycle

- **A session is single-use.** After a successful `tokenize()` it is `consumed`: `canSubmit` turns
  false and a second call answers `session_consumed`, as on the web. Fetch one session per card.
- **`expires_at` is honoured** when the session response is passed through — `sessionStatus` reports
  `expired` and `tokenize()` answers `session_expired` without a request.
- **Replacing the `session` prop** aborts in-flight work and starts fresh.
- **A minted token is never re-minted.** On `./host`, a failed payment confirm retries only the
  confirm.

---

## Security

- Secret API key: **server only.** Never in the app, an app `.env`, or version control.
- Never log or display the session or the `sdk_authorization`. This library logs nothing at all,
  beyond a development-only warning for an unrecognised `enabledCardSchemes` entry.
- The payment-method token belongs on your backend, not in your app and not in your logs.

> PAN, expiry and CVC never cross the library's supported public API. They stay in library-owned
> state and are sent only by the library's own tokenization transport. You receive the card-details
> payload (BIN, last four, expiry parts), safe UI state, and the token.

An API and data-flow guarantee — **not** process isolation, memory zeroization, a PCI DSS claim, or
protection from malicious code inside your own app. Only your assessor can determine your scope.

---

## Troubleshooting

| Symptom | Cause |
|---|---|
| `invalid_session` immediately, nothing sent | the session has no `vault_details`, an unsupported `vault_type`, or a blank authorization. Check your server returned the response *verbatim*. |
| `incomplete_field_set` | a required field is not mounted, or is mounted twice. |
| `session_consumed` | this session already tokenized a card. Fetch a new one. |
| every card reports `networkError` | `enabledCardSchemes` contains no recognised network. Check the development warning. |
| `Cannot read properties of null (reading 'useMemo')` at render | two copies of React in the bundle. Alias `react`, `react-dom` and `react-native` to single absolute paths. |

---

## Migrating from 0.8

| 0.8 | 0.9 |
|---|---|
| `CardCVCWidget`, `CardNumberWidget`, `CardExpiryWidget`, `CardholderNameWidget`, `HyperswitchVault.*` | `CardCVCField`, `CardNumberField`, `CardExpiryField`, `CardholderNameField` |
| `'expiry'`, `'cvc'` (in `focus()`, `state.field`, `fields.*`, `fieldOptions.*`, `fieldStyles.*`) | `'cardExpiry'`, `'cardCvc'` |
| `onStateChange` / `onFormStateChange` | `onChange` (+ `onReady`, `onFocus`, `onBlur`) |
| `state.status`, `state.focused`, `state.error.code` | `empty`/`complete`, focus/blur events, `errorCode` |
| `brand: 'visa' \| 'americanExpress' \| … \| 'unknown'` | `brand: 'Visa' \| 'AmericanExpress' \| …`, absent when unknown |
| `brandIconMode` | `cardBrandIcon` |
| `cvcIcon: 'none'` | `cvcIcon: 'hidden'` |
| `labelBehavior: 'static' \| 'none'` | `'above' \| 'never'` (and form-wide `appearance.labels`) |
| `appearance.primaryColor`, `textColor`, `errorColor`, `placeholderColor`, `backgroundColor`, `inputHeight`, `brandIconMode` | `appearance.variables.colorPrimary`, `colorText`, `colorDanger`, `colorTextPlaceholder`, `colorBackground`, `inputFieldHeight`, `cardBrandIcon` |
| `HyperswitchVaultSavedCardForm` + `updateSavedPaymentMethod()` | `<CardCVCField savedCard={…} />` inside `<CardForm>` + `tokenize()` |
| `invalid_card_data`, `not_ready`, `server_error` | `validation_error`, `incomplete_field_set`, `tokenization_failed` |

## Example app

`example/` is a runnable React Native app and `example-server/` a dependency-free merchant backend.
They are separate directories on purpose — **the secret API key belongs only on the server.**
