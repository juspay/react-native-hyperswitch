import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import NativeHyperswitchModule from '../codegen/modules/NativeHyperswitchModule';
import {
  buildApplePaySupportedNetworks,
  buildGooglePayIsReadyToPayRequest,
} from '../utils/WalletAvailability';
import type {
  UseHyperswitchDeviceCapabilityOptions,
  UseHyperswitchDeviceCapabilityResult,
} from '../types/wallets';

async function checkGooglePayDeviceSupport(
  allowedCardNetworks: string[] | undefined
): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  try {
    const requestJson = buildGooglePayIsReadyToPayRequest(allowedCardNetworks);
    return await NativeHyperswitchModule.checkGooglePayReadiness(requestJson);
  } catch {
    return false;
  }
}

async function checkApplePayDeviceSupport(
  allowedCardNetworks: string[] | undefined
): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;
  try {
    const networksJson = buildApplePaySupportedNetworks(allowedCardNetworks);
    return await NativeHyperswitchModule.checkApplePayReadiness(networksJson);
  } catch {
    return false;
  }
}

/**
 * Reports whether *this device* is technically capable of Google Pay /
 * Apple Pay (Play Services `isReadyToPay` / PassKit `canMakePayments`),
 * using a generic card-network request. Does not reflect merchant or
 * connector configuration — pair with `useHyperswitchWallets()` for that.
 *
 * Unlike `useHyperswitchWallets`, this does not depend on the session and
 * can be called outside `<HyperElements>` — it's meant to resolve early,
 * so a checkout screen can optimistically reserve space for a wallet
 * button before the session-based eligibility check finishes.
 */
export function useHyperswitchDeviceCapability(
  options?: UseHyperswitchDeviceCapabilityOptions
): UseHyperswitchDeviceCapabilityResult {
  const allowedCardNetworksKey = options?.allowedCardNetworks?.join(',');

  const [state, setState] = useState<UseHyperswitchDeviceCapabilityResult>({
    isLoading: true,
    isGooglePayCapable: false,
    isApplePayCapable: false,
  });

  useEffect(() => {
    let cancelled = false;
    const allowedCardNetworks = allowedCardNetworksKey?.split(',');

    (async () => {
      const [isGooglePayCapable, isApplePayCapable] = await Promise.all([
        checkGooglePayDeviceSupport(allowedCardNetworks),
        checkApplePayDeviceSupport(allowedCardNetworks),
      ]);

      if (!cancelled) {
        setState({ isLoading: false, isGooglePayCapable, isApplePayCapable });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [allowedCardNetworksKey]);

  return state;
}
