/*
 * Type surface of the `./detached` subpath. Runtime values come from `detached-entry.mjs`, which
 * re-exports the root's objects; these are the root's declarations, re-exported to match.
 */
export {
  createDetachedCardForm,
  CardNumberField,
  CardExpiryField,
  CardCVCField,
  CardholderNameField,
} from './public';

export type {
  DetachedCardFormConfig,
  DetachedCardFormInstance,
} from './public';
