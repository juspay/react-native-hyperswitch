import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';
import { terser } from 'rollup-plugin-terser';

const external = ['react', 'react-native', '@sentry/react-native', 'react-native-inappbrowser-reborn', 'react-native-svg', 'react-native-webview'];

export default [
  {
    input: 'src/index.tsx',
    output: {
      file: 'lib/commonjs/index.bundle.js',
      format: 'cjs',
      sourcemap: true,
      exports: 'auto',
    },
    external,
    plugins: [
      resolve({
        preferBuiltins: false,
        extensions: ['.tsx', '.ts', '.jsx', '.js'],
      }),
      commonjs(),
      typescript({
        tsconfig: './tsconfig.json',
        declaration: false,
        declarationMap: false,
        outDir: 'lib/commonjs',
      }),
      terser(),
    ],
  },
  {
    input: 'src/index.tsx',
    output: {
      file: 'lib/module/index.bundle.js',
      format: 'esm',
      sourcemap: true,
    },
    external,
    plugins: [
      resolve({
        preferBuiltins: false,
        extensions: ['.tsx', '.ts', '.jsx', '.js'],
      }),
      commonjs(),
      typescript({
        tsconfig: './tsconfig.json',
        declaration: false,
        declarationMap: false,
        outDir: 'lib/module',
      }),
      terser(),
    ],
  },
];
