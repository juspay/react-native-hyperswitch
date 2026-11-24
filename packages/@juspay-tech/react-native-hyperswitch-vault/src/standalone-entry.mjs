/*
 * Runtime entry for the package root. The ONLY source of runtime values for `.`.
 *
 * `src/public.ts` is the parallel type-only surface (tsc runs with emitDeclarationOnly, so nothing
 * there executes). The two must agree; `scripts/verify-public-surface.mjs` fails the build if they
 * drift.
 *
 * The form and the fields are small choosers over the ReScript components (see below): one render
 * frame that decides where the field runs. Everything else is a direct binding.
 *
 * The names are the web SDK's: `cardNumber`, `cardExpiry`, `cardCvc` become `CardNumberField`,
 * `CardExpiryField`, `CardCVCField`. The legacy `*Widget` spellings, the `HyperswitchVault`
 * namespace and the standalone saved-card form were removed with that alignment; a saved card is
 * now `<CardCVCField savedCard={...} />` inside `<CardForm>`, as it is on the web.
 */

import { make as HyperswitchVaultFormImpl } from './HyperswitchVaultForm.bs.js';
import {
  CardForm as CardFormChooser,
  CardNumberField as CardNumberFieldChooser,
  CardExpiryField as CardExpiryFieldChooser,
  CardCVCField as CardCVCFieldChooser,
  CardholderNameField as CardholderNameFieldChooser,
} from './native/choosers.mjs';
import { createCardForm as createCardFormImpl } from './createCardForm.mjs';
import { createDetachedCardForm as createDetachedCardFormImpl } from './createDetachedCardForm.mjs';

/*
 * The form and its fields choose, when they render, between the native path (each field a native
 * view whose content runs in the vault's own engine) and the plain JavaScript one. The choice and
 * its rule are in ./native/choosers.mjs and ./native/availability.mjs. The names, props, events and
 * handles are the same on both paths.
 */
export const CardForm = CardFormChooser;
export const CardNumberField = CardNumberFieldChooser;
export const CardExpiryField = CardExpiryFieldChooser;
export const CardCVCField = CardCVCFieldChooser;
export const CardholderNameField = CardholderNameFieldChooser;

/* The ready-made form: the same provider with the four fields laid out by the library. */
export const HyperswitchVaultForm = HyperswitchVaultFormImpl;

/*
 * The imperative spelling of <CardForm>, for callers who want to hold the form in a variable and
 * drive it with method calls the way the web's `cardForm()` object is driven.
 */
export const createCardForm = createCardFormImpl;

/*
 * A card form whose fields each sit in a React root of their own (one native view per field).
 * Exported from the root only: no subpath, so every React Native version's Metro resolves it.
 */
export const createDetachedCardForm = createDetachedCardFormImpl;
