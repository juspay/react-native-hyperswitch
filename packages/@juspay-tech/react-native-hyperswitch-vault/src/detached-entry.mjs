/*
 * Runtime entry for the `./detached` subpath. The ONLY source of runtime values for it.
 *
 * AUDIENCE. Hosts that render each card field in a React root of its own — the payment-methods
 * SDK's hosted fields, one native view per field. `createDetachedCardForm` gives such a form a Host
 * (rendered once) and a Field wrapper (one per root); see `createDetachedCardForm.mjs`.
 *
 * SAME OBJECTS. Like `./host`, every export is the root entry's, re-exported: rollup keeps
 * `./standalone-entry.mjs` external and rewrites it to `./index.js`. A field imported from here is
 * therefore the root's field, and finds the root's single `VaultWidgetContext`.
 */

export {
  createDetachedCardForm,
  CardNumberField,
  CardExpiryField,
  CardCVCField,
  CardholderNameField,
} from './standalone-entry.mjs';
