/*
 * The settings of one detached card form, held outside React so that roots which share no parent
 * can all read them and all hear when they change.
 *
 * NOT THE CARD. The card is in the form's VaultCardStore. Nothing here reads or writes it, which is
 * why a setting can change (a new appearance, a new locale) without the customer losing what they
 * typed.
 *
 * `get()` returns the SAME object until a setting really changes. React's useSyncExternalStore
 * needs that: a new object on every call would re-render every root forever.
 */

/* The <CardForm> settings a detached form reads. The two callbacks are kept apart: see callbacks(). */
export const SETTINGS = [
  'session',
  'sdkAuthorization',
  'vaultDetails',
  'environment',
  'customEndpoints',
  'locale',
  'localisation',
  'appearance',
  'disabled',
  'accessible',
  'enabledCardSchemes',
  'cardholderName',
  'unstyled',
];

/*
 * Callers pass the web's lowercase names ('sandbox') as well as the vault's ('SANDBOX'). The form
 * then reads the name exactly as <CardForm> does (VaultConfirm.normalizeEnvironment).
 */
const environmentOf = (value) => (typeof value === 'string' ? value.toUpperCase() : 'PROD');

/*
 * Settings are plain data, so two values that print the same ARE the same setting. A caller that
 * rebuilds an equal object on every render (or parses one from JSON) therefore changes nothing.
 */
const sameValue = (a, b) => {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
};

export function makeSettings(initial = {}) {
  let given = { ...initial };
  const listeners = new Set();

  const read = (previous) => {
    const next = {};
    let changed = previous === null;
    for (const key of SETTINGS) {
      const value = key === 'environment' ? environmentOf(given[key]) : given[key];
      /* Keep the old object for an equal value, so nothing downstream sees a change. */
      if (previous !== null && sameValue(previous[key], value)) {
        next[key] = previous[key];
      } else {
        next[key] = value;
        changed = true;
      }
    }
    return changed ? next : previous;
  };

  let current = read(null);

  return {
    /* What every root renders with. Stable until update() changes a setting. */
    get: () => current,

    /* onReady / onChange as last given. Read when an event fires, so replacing one re-renders nothing. */
    callbacks: () => ({ onReady: given.onReady, onChange: given.onChange }),

    /*
     * Merges `changes` over the settings so far. A key set to `undefined` goes back to its default;
     * a key left out keeps its value. Roots are told only when a setting really changed.
     */
    update(changes = {}) {
      given = { ...given, ...changes };
      const next = read(current);
      if (next === current) return;
      current = next;
      for (const listener of [...listeners]) listener();
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
