// Ambient declarations for react-native deep imports used by the codegen
// specs. The runtime modules exist on every supported React Native version,
// but the strict TypeScript API of newer versions does not expose their
// types. This file is not part of any codegen spec (name matches neither
// Native* nor *NativeComponent).
declare module 'react-native/Libraries/Utilities/codegenNativeComponent' {
  import type {HostComponent} from 'react-native';

  type Options = {
    interfaceOnly?: boolean;
    paperComponentName?: string;
    paperComponentNameDeprecated?: string;
    excludedPlatforms?: ReadonlyArray<'iOS' | 'android'>;
  };

  export default function codegenNativeComponent<Props extends object>(
    componentName: string,
    options?: Options
  ): HostComponent<Props>;
}

declare module 'react-native/Libraries/Types/CodegenTypes' {
  export type Double = number;
  export type Float = number;
  export type Int32 = number;
  export type UnsafeObject = object;
  export type WithDefault<T, _V> = T | undefined;
}
