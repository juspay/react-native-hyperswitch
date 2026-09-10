import { Platform } from 'react-native';
import NativeHyperswitchModule from '../codegen/modules/NativeHyperswitchModule';
import type { WalletName } from '../types/walletSession';

export function isGooglePaySupported(): Promise<boolean> {
  return NativeHyperswitchModule.isGooglePaySupported().catch(() => false);
}

export function isApplePaySupported(): Promise<boolean> {
  return NativeHyperswitchModule.isApplePaySupported().catch(() => false);
}

export function isWalletSupported(wallet: WalletName): Promise<boolean> {
  return wallet === 'google_pay'
    ? isGooglePaySupported()
    : isApplePaySupported();
}

export function isPlatformPaySupported(): Promise<boolean> {
  if (Platform.OS === 'ios') {
    return isApplePaySupported();
  }
  if (Platform.OS === 'android') {
    return isGooglePaySupported();
  }
  return Promise.resolve(false);
}
