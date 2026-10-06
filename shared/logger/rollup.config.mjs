import { nodeResolve } from '@rollup/plugin-node-resolve';

/*
 * Same pipeline as the vault package: bundle the ReScript output so the ReScript runtime
 * (rescript/lib, @rescript/core) is inlined and a TypeScript consumer such as payment-methods
 * never has to install ReScript. ReScript consumers skip this bundle and compile src/*.res
 * through bs-dependencies.
 */

/* Always external: the host application's own React / React Native must be the only instances. */
const hostRuntime = ['react', 'react/jsx-runtime', 'react-native'];

export default {
  input: { index: 'src/index.mjs' },
  external: (id) => hostRuntime.includes(id),
  plugins: [nodeResolve({ extensions: ['.js', '.mjs'] })],
  treeshake: {
    moduleSideEffects: false,
    propertyReadSideEffects: false,
  },
  output: [
    {
      dir: 'dist/esm',
      format: 'es',
      entryFileNames: '[name].js',
      sourcemap: 'hidden',
    },
    {
      dir: 'dist/cjs',
      format: 'cjs',
      entryFileNames: '[name].js',
      exports: 'named',
      sourcemap: 'hidden',
    },
  ],
};
