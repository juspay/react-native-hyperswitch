import { NativeModules, Platform } from 'react-native';
import NativeHyperswitchAirborne from './NativeHyperswitchAirborne';

const LINKING_ERROR =
  `The package '@juspay-tech/react-native-hyperswitch-airborne' doesn't seem to be linked. Make sure: \n\n` +
  Platform.select({ ios: "- You have run 'pod install'\n", default: '' }) +
  '- You rebuilt the app after installing the package\n' +
  '- You are not using Expo Go\n';

const HyperswitchAirborneModule = NativeHyperswitchAirborne
  ? NativeHyperswitchAirborne
  : NativeModules.HyperswitchAirborne
  ? NativeModules.HyperswitchAirborne
  : new Proxy(
      {},
      {
        get() {
          throw new Error(LINKING_ERROR);
        },
      }
    );

export const isAirborneLinked = Boolean(
  NativeHyperswitchAirborne || NativeModules.HyperswitchAirborne
);

export function isAvailable(): Promise<boolean> {
  return HyperswitchAirborneModule.isAvailable();
}

export function getBundlePath(): Promise<string> {
  return HyperswitchAirborneModule.getBundlePath();
}

export function initialize(baseUrl: string, sdkVersion: string): Promise<boolean> {
  return HyperswitchAirborneModule.initialize(baseUrl, sdkVersion);
}

export default {
  isAirborneLinked,
  isAvailable,
  getBundlePath,
  initialize,
};
