# RN 0.86 upgrade + Hyperswitch vaulting enablement

**Date:** 2026-09-10 / 2026-09-11
**Repos:** `react-native-hyperswitch` @ `c976c2f` · `hyperswitch-client-core` @ `d606952`
**Goal:** run the Hyperswitch-vault card flow (PMS tokenize → `/payments/confirm` with `payment_method_data.vault_card`) end to end in the RN wrapper's example app.

Nine distinct defects stood between the wrapper and that flow. They are documented below in the order they surfaced, because each one masked the next.

---

## 0. Starting point — why the embedded bundle was stale

`react-native-hyperswitch` embeds **four** prebuilt Metro bundles, not one:

| path | RN target | selected by |
|---|---|---|
| `android/src/main/assets/hyperswitch.bundle` | RN ≥ 0.82 | build time, `android/build.gradle:117` |
| `android/src/rn79/assets/hyperswitch.bundle` | RN < 0.82 | build time, same |
| `ios/…/Resources/hyperswitch-rn82plus.bundle` | RN ≥ 0.82 | runtime, `HyperBundleResolver.swift` |
| `ios/…/Resources/hyperswitch.bundle` | RN 0.76–0.81 | runtime, same |

The shipped set was committed in `a95bd7c` (2026-08-28 20:01 IST) and built from client-core's **turbo lineage at `43da00a`**, *not* `main`. Evidence: four strings (`savePaymentDetailsWhereverPossible`, `partially_supported`, `customer_acceptance_support`, `account_holder_name`) are present in both bundles, absent from `main@78f2084` (main's tip that day), and present in `43da00a`; they only reached `main` on 2026-09-01 via `0771312`. `git merge-base --is-ancestor 43da00a main` → false.

The vaulting feature landed on `main` in `d606952` (#566, 2026-09-08), so the shipped bundle contained none of it — `vault_card`, `VaultCardElement`, `VaultTokenNormalizer` were all absent.

**Root cause of the staleness:** client-core's release CI (`create_draft_release.yml`) regenerates bundles only for the `hyperswitch-sdk-android` / `hyperswitch-sdk-ios` submodules. No client-core workflow references `react-native-hyperswitch`, and the wrapper repo has **no CI at all**. The only wrapper-facing script, `bundle:rn:android`, hardcodes a sibling path and writes **1 of the 4** bundles.

---

## 1. Event wire-name contract break

**Symptom:** every `subscribedEvents` callback silently stopped firing — no crash, no log.

**Cause:** client-core `0b36667` ("refactor: modified event names", #563, 2026-09-04) bumped `shared-code`, rewriting `PaymentEventTypes.res`:

| old wire string | new wire string |
|---|---|
| `PAYMENT_METHOD_INFO_CARD` | `cardDetailsChange` |
| `PAYMENT_METHOD_STATUS` | `paymentMethodChange` |
| `FORM_STATUS` | `formStatusChange` |
| `PAYMENT_METHOD_INFO_BILLING_ADDRESS` | `billingDetailsChange` |
| `CVC_STATUS` | `cvcStatusChange` |
| `SURCHARGE` | `surchargeInfo` |
| — | `appliedOffersInfo` (new) |

`eventFromString` stopped recognising the old strings, so every subscription parsed to `UnknownEvent`, `shouldEmitEvent` returned false for all five emitters, and nothing emitted. A public wire-format rename with no deprecation window and no wrapper-side change.

**Reproduced** by running client-core's compiled `PaymentEventTypes.bs.js` / `PaymentEventData.bs.js` against the wrapper's own `EventValidator.ts` list: **0/5 events fire** on the new bundle, **5/5** on the old one. After the fix: **5/5**.

**Fix** — aligned both sides on the new names:
- `src/utils/EventValidator.ts` — 6 old names → 7 new (dropped `PAYMENT_METHOD_INFO_ADDRESS`, which had no client-core counterpart)
- `src/types/PaymentSheetConfiguration.ts` — `SubscriptionEvent` union retyped
- `src/views/CVCElement.tsx` — `eventName === 'cvcStatusChange'`
- `ios/…/HyperEvents/PaymentEventType.swift` — enum **raw values** only; Swift case names kept, since they are public API for native iOS integrators
- `example/src/utils.ts`, `example/src/pages/HyperContent.tsx` — subscribe sites, both `eventName` gates, comments

Payload *shapes* were unchanged (the `shared-code` diff is append-only apart from the rename), so this was purely a name migration.

---

## 2. Example app moved to RN 0.86

Needed because the RN ≥ 0.82 bundle is what client-core `main` produces; the example was on RN 0.79.7 and therefore loading the *other* bundle.

`example/package.json`: `react-native` 0.79.7 → 0.86.0, `react` 19.0.0 → 19.2.3, `@react-native/*` → 0.86.0, `@react-native-community/cli*` 18.0.0 → 20.1.0, `@types/react` → ^19.2.0, `react-native-svg` → ^15.15.5, `@vgs/collect-react-native` → ^1.2.0, **added `react-native-safe-area-context` ^5.6.0**.

`example/android/build.gradle` — floors taken from RN 0.86's own `gradle/libs.versions.toml`, not guessed: `compileSdk`/`targetSdk` 35 → 36, `buildToolsVersion` → 36.0.0, `kotlinVersion` 2.0.21 → 2.1.20. `minSdk` 24 and NDK 27.1.12297006 unchanged. Gradle 8.13 already satisfies AGP 8.12.0. iOS needs no change — Podfile and podspec both use `min_ios_version_supported`, which follows the RN version automatically.

`packages/@juspay-tech/react-native-hyperswitch/package.json` — added `react-native-safe-area-context` and `@vgs/collect-react-native` to `peerDependencies`; the new bundle hard-imports both and neither was declared.

> **Side effect worth knowing:** `android/build.gradle:133-141` selects `src/rn81/java` when `REACT_NATIVE_MINOR_VERSION >= 81`, else `src/rn79/java`. The bump therefore switched the Android source set to a path the example had never exercised.

---

## 3. Kotlin: `Unresolved reference 'currentActivity'`

**Symptom:** `compileDebugKotlin` failed in `scancard` and `netcetera-3ds`.

**Cause:** RN 0.86 converted `ReactContextBaseJavaModule` from **Java to Kotlin**. Kotlin synthesises property accessors (`currentActivity`) only for *Java* getters, so once the declaring class became Kotlin the bare property disappeared. `ReactContext` is still Java, which is why `reactApplicationContext.currentActivity` on the very next token of `HyperswitchNetcetera3dsModule.kt` compiled fine. RN's own annotation names the replacement:

```kotlin
@Deprecated("Deprecated in 0.80.0. Use getReactApplicationContext().getCurrentActivity() instead.",
            ReplaceWith("reactApplicationContext.currentActivity"))
protected fun getCurrentActivity(): Activity?
```

**Fix** — 6 sites across 4 files. Only two were reported by Gradle; the build stopped before reaching the rest, including three in the main SDK package:

| file | lines |
|---|---|
| `…-scancard/…/HyperswitchScancardModule.kt` | 21 |
| `…-netcetera-3ds/…/HyperswitchNetcetera3dsModule.kt` | 17 |
| `…/io/hyperswitch/react/HyperModule.kt` | 146, 202, 342 |
| `…-trident-3ds/…/HyperswitchTrident3dsModule.kt` | 42, 66 |

`PaymentElementViewManager.kt:50` uses `context?.currentActivity` on a `ThemedReactContext` (still Java) — correct as-is, left alone.

---

## 4. Payment sheet rendered nothing

**Symptom:** SDK initialised, session created, sheet never appeared. No crash, no log.

**Cause:** client-core `c172c3d` ("replaced viewport with rn-safe-area-context", 2026-08-31) wrapped the entire SDK in `SafeAreaProvider` at `App.res:7`. That provider renders **nothing** until it holds insets:

```js
insets != null ? …children… : null
```

`insets` seeds from `initialWindowMetrics`, read from the native module's `getConstants()` **at module load**. The SDK runs its own embedded RN instance (`ReactNativeController` → `HyperPackageList`), where that is routinely `null`, so children never mounted. The pre-`c172c3d` code used host-supplied insets directly with no gating, which is why the old bundle worked.

**Fix (client-core, 2 files):**
- `src/components/modules/ReactNativeSafeArea.res` — added a `metricsData` seed constructor
- `src/contexts/SafeAreaContext.res` — when `initialWindowMetrics` is null, seed `initialMetrics` from the insets the host already passes plus window dimensions

Measured insets still take over via `NativeInsets` once they arrive, so real notch/gesture handling is unchanged. `yarn re:check` → RC=0 (750 modules).

---

## 5. Bundle built with empty base URLs *(self-inflicted)*

**Symptom:** *"Unable to load the payment configuration. Please retry"* on the card tab.

**Cause:** `hyperswitch-client-core/.env` is a committed **blank template** — every value empty, including the URLs. `babel.config.js` uses `module:react-native-dotenv`, which **inlines those at bundle time**. A bundle built on a fresh checkout compiles to:

```js
else if("backend"===n) switch(t){ case"INTEG": case"SANDBOX": return ""; … }
```

Every API call then goes to a relative URL and fails. The previously shipped bundle had `https://app.hyperswitch.io/api` baked in because whoever built it had a populated `.env`.

**Correct values** (recovered from the working shipped bundle). Note the source changed shape: `SANDBOX`/`INTEG` no longer get `backendPath` appended, so the env var must already include `/api`; only `PROD` gets it appended.

```
HYPERSWITCH_SANDBOX_URL=https://app.hyperswitch.io/api
HYPERSWITCH_INTEG_URL=https://integ.hyperswitch.io/api
HYPERSWITCH_PRODUCTION_URL=https://live.hyperswitch.io
SANDBOX_ASSETS_END_POINT=https://beta.hyperswitch.io
INTEG_ASSETS_END_POINT=https://dev.hyperswitch.io
PROD_ASSETS_END_POINT=https://checkout.hyperswitch.io
```

**Fix:** populate before `react-native bundle`, restore `.env` afterwards (verified byte-identical), and grep the output to confirm real hosts are baked in.

---

## 6. Example app silently targeting production

**Cause:** client-core does not take `environment` as a prop. `SdkTypes.res:877`:

```rescript
environment: GlobalVars.checkEnv(getString(hc, "publishableKey", ""))
```

and `GlobalVars.res:3` returns **PROD** for anything not starting `pk_snd_` — including `""`. `example/src/utils.ts:11` reads `process.env.HYPERSWITCH_PUBLISHABLE_KEY ?? ""` and there was **no `.env` anywhere in the wrapper repo**, so every SDK call went to `live.hyperswitch.io`.

This hid behind `initialBaseUrl`, which is hardcoded to `10.0.2.2:5252` — so the demo server call succeeded and "SDK initialized successfully" printed regardless.

**Fix:** create `example/.env` (already gitignored via `example/.gitignore:60`) with a real `pk_snd_…` key so `checkEnv` resolves to SANDBOX.

### Verified against sandbox after the fix

| call | result |
|---|---|
| `POST /payments` | `sdk_authorization` present |
| `GET {base}/v1/sdk/configs/android/sdk_config.json` | `account_config.profile.vaulting_action = "tokenize"` |
| `POST /payments/session_tokens` | `vault_details.vault_type = "hyperswitch"` + `vault_data.sdk_authorization` |
| client-core's real `parseVaultDetails` on that response | → `HyperswitchVault` |

Both auth variants work (`Authorization: <sdkAuth>` and `api-key: <pk>`), and `profile_id` in the create body turned out to be irrelevant — the merchant's default profile is the same one.

### The two gates, for future reference

`NavigationRouter.res:202-217`:

```
vaulting_action (SDK config: account_config.profile.vaulting_action)
  missing / unknown  -> Refused(UnreadableVaultingAction)  -> config error on the card tab
  "skip"             -> DirectCard                          -> normal card, vault never runs
  "tokenize"         -> needs session vault_details:
                          present -> VaultCard
                          absent  -> Refused(VaultUnavailable) -> config error
```

`parseVaultDetails` accepts only `vault_type` of `hyperswitch` or `vgs`, and for `hyperswitch` additionally requires `vault_data.sdk_authorization`. A `vault_type: "hyperswitch"` with no inner `sdk_authorization` fails exactly like a missing `vault_details`.

---

## 7. Host app frozen after the sheet closed

**Symptom:** once the SDK closed, nothing in the RN app was touchable until the process was restarted.

**Cause:** the sheet is added to **`android.R.id.content`** — a full-screen overlay on the host activity (`PaymentSessionReactLauncher.kt:190`) — but `HyperModule.exitPaymentsheet` only **hid** it:

```kotlin
it.supportFragmentManager.beginTransaction().hide(fragment).commitAllowingStateLoss()
```

`hide()` marks the view `GONE` while leaving the fragment attached with its React surface alive and **still holding input focus**, so the window's input stayed captured by an invisible view. Nothing ever calls `show()` on it — the only other reference (`PaymentSessionReactLauncher.kt:170`) *removes* it before adding a new one, so hiding bought nothing. Long-standing: `git log -L` shows `hide()` there since the file was created. It only became visible once the sheet got far enough to focus the vault card inputs.

**Fix:**
- `HyperModule.kt` — `clearFocus()` then `remove(fragment)` instead of `hide()`. Safe because re-presenting already removes and rebuilds, and `ReactHost` is a singleton so reopening stays fast.
- `PaymentSessionReactLauncher.kt` — the back-press callback was added **unowned on every `presentSheet()`** and never removed, leaking one per presentation, each forwarding back presses to a dead sheet. Now scoped to the fragment's lifecycle (`addCallback(newReactNativeFragmentSheet) { … }`), which the `remove()` above actually triggers.

---

## 8. `Cannot convert argument of type class java.util.LinkedHashMap`

**Symptom:** `ERROR [Error: Uncaught (in promise, id: 0): "Error: Exception in HostFunction: Cannot convert argument of type class java.util.LinkedHashMap"]`

**Cause:** `ReactNativeHyperswitchModule.presentPaymentSheet`'s catch block resolved a raw Kotlin map:

```kotlin
val map = mutableMapOf<String, Any>().apply { … }   // -> java.util.LinkedHashMap
promise?.resolve(map)
```

The codegen spec declares `presentPaymentSheet(params: Object): Promise<string>`, and under the New Architecture JSI only converts `WritableMap` / `WritableArray` / primitives / null. Worse, this is the **error path** — so the real exception was swallowed and replaced by a conversion crash that named none of it.

Audited every `promise.resolve` / `callback.invoke` across all packages: this was the **only** violation. Every other resolve passes a `String` (`toJSONString()` / `toString()`), and all event payloads use `Arguments.createMap()` (`WritableMap`) or `ReadableMap`.

**Fix:** resolve a JSON string in the file's existing house style:

```kotlin
promise?.resolve(
  StandardResult.Failed(code = "failed", message = "failed to open",
                        error = Throwable(e.message ?: "unknown error")).toJSONString()
)
```

**Also fixed** — the accompanying deprecation warning. RN 0.86 deprecates deep imports; the root now re-exports these:
- `src/codegen/components/ApplePayNativeComponent.ts`, `PaymentWidgetNativeComponent.ts` → `import { codegenNativeComponent } from 'react-native'`
- `src/codegen/modules/NativeHyperModule.ts` → `import type { EventEmitter } …` (type-only; erased at runtime)

No runtime deep imports remain. `tsc` → RC=0.

---

## Verification status

**Passed**
- client-core `yarn install --immutable`, `yarn re:check` (750 modules, warnings-as-errors clean), Metro bundle ×2
- wrapper `yarn install --immutable`, package `tsc` (RC=0 before and after every change)
- Event contract: wrapper's `validEventStrings` now equals client-core's `eventToString` range exactly; repro 0/5 → 5/5
- Full vault chain verified against sandbox with curl + client-core's real compiled parser
- Bundle freshness confirmed by string markers, not by trusting the build

**Not verified here**
- No Gradle or Xcode build on this machine (disk at 100%, NDK compile dies with *"No space left on device"*; Linux host has no Apple toolchain). The Kotlin fixes are verified by reading RN 0.86's actual sources and the call sites, not by compiling.
- Byte-exact provenance of the shipped bundle: `43da00a` records `shared-code` at `6bcc0a7`, which does not exist in the public `juspay/hyperswitch-sdk-utils` repo (server rejects a direct SHA fetch with *"not our ref"*), so it cannot be rebuilt for a checksum match.
- The RN 0.79 bundle pair cannot be produced from `main` at all — `main` pins `react-native: "0.86.0"` exactly. It still needs a build from `turbo-rn-79`.

---

## Prevention

1. **Stamp provenance into the bundle.** Emit `__HYPERSWITCH_BUILD__ = { commit, branch, rnVersion, builtAt }`. Nothing in the artifact says where it came from — that is why identifying the source took forensics rather than a lookup.
2. **Fail the build on an empty `.env`.** The blank-template inlining produced a bundle that looked fine and failed every network call. A guard in the bundle script would have caught it instantly.
3. **One script, all four outputs.** Replace `bundle:rn:android` with a `bundle:rn` that takes the wrapper path and writes every variant from the correct RN-pinned branch.
4. **Commit a `bundle-manifest.json`** in the wrapper: per bundle, the client-core commit, branch, RN target and SHA-256.
5. **Add CI to the wrapper.** It has none. A job that rebuilds from the manifest and diffs the checksum turns silent drift into a failed check.
6. **Contract-test the event names.** A test asserting the wrapper's `validEventStrings` equals client-core's `eventToString` range would have failed on 2026-09-04, the day of the rename.
7. **Treat the wire format as public API.** Renaming `eventToString` outputs breaks merchants and needs a deprecation window accepting both spellings.
8. **Don't let `environment` be inferred from an empty key.** `checkEnv("")` silently returning PROD is a foot-gun; an empty publishable key should throw.
