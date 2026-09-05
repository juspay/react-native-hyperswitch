import { nodeResolve } from '@rollup/plugin-node-resolve';

/*
 * Build pipeline stage 2: bundle the ReScript output into publishable artifacts.
 *
 * Why bundle instead of publishing per-module files (e.g. via react-native-builder-bob):
 *
 *   The card form compiles against hyperswitch-sdk-utils, which is a build-time submodule. A
 *   file-by-file publish would have to ship shared-code/ inside the tarball, and would drag in
 *   sdk-utils modules the card form never uses (PostalCodes for 244 countries, CPF/CNPJ tax-ID
 *   validators, and the near-dead CardValidations/CardPattern duplicates) because they sit in the
 *   same compilation unit graph as Validation.res.
 *
 *   Metro does not perform cross-module tree-shaking, so a React Native merchant would pay for all
 *   of that. Bundling here with Rollup's tree-shaking resolves it at publish time: only the code
 *   actually reachable from the library entry is emitted. Validation logic is still compiled from
 *   the pinned submodule — never copied — so sdk-utils remains the single source of truth.
 *
 * The ReScript runtime helpers (rescript/lib, @rescript/core) are deliberately NOT external: they
 * are inlined so the merchant never has to install ReScript.
 *
 *
 * NO FORM LIBRARY. The card fields are fully controlled: hyperswitch-client-core keeps its own
 * react-final-form and passes values and callbacks in, and the standalone entries use an internal
 * reducer. This file therefore builds ONE configuration — the two-configuration split existed only
 * to bundle react-final-form for the root entry while keeping it external for `/embedded`, and
 * there is nothing left to split on.
 *
 * Dual-package layout: dist/esm/*.js and dist/cjs/*.js, each with its own package.json "type"
 * marker written by scripts/emit-package-type.mjs.
 *
 * Both formats deliberately use the .js extension. hyperswitch-client-core's webpack config routes
 * any file whose extension is not in jsx?|tsx?|json|css|html|svg|images|fonts through
 * `type: 'asset/resource'` with `emit: false`. A .mjs or .cjs entry therefore becomes a 42-byte
 * asset stub: the build SUCCEEDS and the card form is silently missing from the bundle. Verified —
 * webpack resolved the `require` condition to dist/embedded.cjs and dropped it exactly that way.
 * Using .js for both formats makes the package independent of any consumer's loader allowlist.
 */

/* Always external: the host application's own React / React Native must be the only instances. */
const hostRuntime = ['react', 'react/jsx-runtime', 'react-native', 'react-native-svg'];



const plugins = [nodeResolve({ extensions: ['.js', '.mjs'] })];

/*
 * Packaged image assets are NOT bundled. Rollup leaves the specifier verbatim so React Native's
 * asset pipeline resolves it at build time and selects @1x/@2x/@3x per device scale — which only
 * works for a static path. `scripts/copy-assets.mjs` puts the PNGs at dist/assets/, so the emitted
 * `../assets/<name>.png` resolves from both dist/esm/ and dist/cjs/.
 */
const treeshake = {
  moduleSideEffects: false,
  propertyReadSideEffects: false,
};

/*
 * `sourcemap: 'hidden'` rather than `true`.
 *
 * The maps are still WRITTEN, so local debugging and any future decision to publish them are
 * unaffected. What 'hidden' removes is the `//# sourceMappingURL=` comment at the end of each
 * emitted file — and that comment was a dangling reference in the published package, because
 * `files[]` deliberately excludes `dist/**\/*.map`. Every consumer therefore received JS pointing
 * at a map that is not in the tarball. Metro strips the comment and never noticed, but any other
 * tool that follows it got a 404. Found by the Phase 4 external-consumer audit.
 */

/* Chunk prefixes differ per configuration so the two builds cannot collide in dist/. */
const outputs = (chunkPrefix) => [
  {
    dir: 'dist/esm',
    format: 'es',
    entryFileNames: '[name].js',
    chunkFileNames: `${chunkPrefix}-[hash].js`,
    sourcemap: 'hidden',
  },
  {
    dir: 'dist/cjs',
    format: 'cjs',
    entryFileNames: '[name].js',
    chunkFileNames: `${chunkPrefix}-[hash].js`,
    exports: 'named',
    sourcemap: 'hidden',
  },
];

export default [
  /*
   * THE MERCHANT ENTRY: the card form. The `/embedded` controlled fields and the `/vault`
   * transport subpath were removed in the merchant-only scope reset. The PMS confirmation
   * transport still exists — the merchant form cannot tokenize without it — but it is reachable
   * only from inside this bundle, never as a separately importable entry.
   */
  {
    input: {index: 'src/standalone-entry.mjs'},
    external: (id) => hostRuntime.includes(id),
    plugins,
    treeshake,
    output: outputs('shared'),
  },
  /*
   * THE ORCHESTRATION ENTRY: `confirmTokenizedCardPayment` for payment-methods (externally
   * tokenized cards). A SEPARATE configuration on purpose, not a second input above: with one
   * configuration Rollup would hoist the shared transport modules into common chunks, and
   * `scripts/verify-merchant-only.mjs` proves runtime containment by reading dist/esm/index.js
   * ALONE. Keeping the root bundle self-contained keeps that proof byte-stable; the price is that
   * the few shared body/transport modules are duplicated into orchestration.js, which no app pays
   * for unless it actually imports the subpath. This entry has no React and no components — the
   * provider renders the fields — so the whole bundle is a plain async function and its
   * dependencies.
   */
  {
    input: {orchestration: 'src/orchestration-entry.mjs'},
    external: (id) => hostRuntime.includes(id),
    plugins,
    treeshake,
    output: outputs('orch'),
  },
  /*
   * THE HOST ENTRY: the checkout SDK's typed view of the SAME components (ADR-0010). This is not a
   * third bundle of the form. `src/host-entry.mjs` re-exports from `standalone-entry.mjs`, and that
   * import is kept EXTERNAL and rewritten to `./index.js`, so dist/{esm,cjs}/host.js is a handful of
   * re-export lines over the root bundle. Bundling it separately would duplicate every component and
   * every React context into a second module graph — a field imported from `/host` would then never
   * find a provider imported from the root — and `scripts/verify-consumers.mjs` proves the identity
   * against the packed tarball precisely to rule that out.
   */
  {
    input: {host: 'src/host-entry.mjs'},
    external: (id) => hostRuntime.includes(id) || /standalone-entry\.mjs$/.test(id),
    plugins,
    treeshake,
    output: outputs('host').map((o) => ({
      ...o,
      paths: (id) => (/standalone-entry\.mjs$/.test(id) ? './index.js' : id),
    })),
  },
];
