/*
 * NOTHING THE VAULT'S ENGINE RUNS MAY WRITE A ROOT'S PROPS TO THE DEVICE LOG.
 *
 * React Native's own AppRegistry.setSurfaceProps runs
 *   console.log('Updating props for Surface "<name>" with ' + JSON.stringify(props))
 * with no __DEV__ check, every time native code gives a running root new props. The vault's roots
 * get their settings that way, and a form's settings carry sdkAuthorization (a field's can carry a
 * saved card's token). console.log reaches logcat on Android and os_log on iOS in release builds.
 *
 * So in this engine log, info, debug and trace go nowhere. The vault's own code never uses the
 * console (it reports through its logger, which sends no card data). warn and error stay: React and
 * React Native use them for faults, with messages and component names, not props.
 */
const SILENCED = ['log', 'info', 'debug', 'trace'];

const nothing = () => {};

/* Replaces the four methods on `target` (the engine's console). Safe to call more than once. */
export function silenceConsole(target = globalThis.console) {
  if (target == null) return;
  for (const level of SILENCED) {
    if (typeof target[level] === 'function') target[level] = nothing;
  }
}
