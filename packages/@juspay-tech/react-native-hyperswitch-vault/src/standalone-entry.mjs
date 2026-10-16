/*
 * Runtime entry for the package root. The ONLY source of runtime values for `.`.
 *
 * `src/public.ts` is the parallel type-only surface (tsc runs with emitDeclarationOnly, so nothing
 * there executes). The two must agree; `scripts/verify-public-surface.mjs` fails the build if they
 * drift.
 *
 * Everything below is a binding over the ReScript components. No wrapper component: a wrapper
 * would break `===` identity, add a render frame, and give React.memo and devtools a second name
 * for the same thing.
 *
 * The names are the web SDK's: `cardNumber`, `cardExpiry`, `cardCvc` become `CardNumberField`,
 * `CardExpiryField`, `CardCVCField`. The legacy `*Widget` spellings, the `HyperswitchVault`
 * namespace and the standalone saved-card form were removed with that alignment; a saved card is
 * now `<CardCVCField savedCard={...} />` inside `<CardForm>`, as it is on the web.
 */

import { make as HyperswitchVaultFormImpl } from './HyperswitchVaultForm.bs.js';
import { make as CardFormImpl } from './CardForm.bs.js';
import { make as CardNumberFieldImpl } from './CardNumberField.bs.js';
import { make as CardExpiryFieldImpl } from './CardExpiryField.bs.js';
import { make as CardCVCFieldImpl } from './CardCVCField.bs.js';
import { make as CardholderNameFieldImpl } from './CardholderNameField.bs.js';
import { createCardForm as createCardFormImpl } from './createCardForm.mjs';
import { createDetachedCardForm as createDetachedCardFormImpl } from './createDetachedCardForm.mjs';

export const CardForm = CardFormImpl;
export const CardNumberField = CardNumberFieldImpl;
export const CardExpiryField = CardExpiryFieldImpl;
export const CardCVCField = CardCVCFieldImpl;
export const CardholderNameField = CardholderNameFieldImpl;

/* The ready-made form: the same provider with the four fields laid out by the library. */
export const HyperswitchVaultForm = HyperswitchVaultFormImpl;

/*
 * The imperative spelling of <CardForm>, for callers who want to hold the form in a variable and
 * drive it with method calls the way the web's `cardForm()` object is driven.
 */
export const createCardForm = createCardFormImpl;

/*
 * A card form whose fields each sit in a React root of their own (one native view per field). Also
 * re-exported, with the same fields, from `./detached`.
 */
export const createDetachedCardForm = createDetachedCardFormImpl;
