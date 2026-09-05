import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';

import { SessionContext } from './SessionContext';
import type { PaymentMethodsSession } from './SessionContext';
import type { HyperswitchConfiguration } from './config';
import { fetchVaultDetails } from './fetchVaultDetails';
import type { Appearance, VaultDetails } from '../core/types';

interface CommonOptions {
  appearance?: Appearance;
}

export type HyperPaymentMethodsSessionOptions =
  | (CommonOptions & { vaultDetails: VaultDetails; sdkAuthorization?: string })
  | (CommonOptions & { sdkAuthorization: string; vaultDetails?: VaultDetails });

export interface HyperPaymentMethodsSessionProps {
  hyper: HyperswitchConfiguration | Promise<HyperswitchConfiguration>;

  options: HyperPaymentMethodsSessionOptions;

  onError?: (error: Error) => void;

  children: ReactNode;
}

export function HyperPaymentMethodsSession({
  hyper,
  options,
  onError,
  children,
}: HyperPaymentMethodsSessionProps) {
  const {
    appearance,
    vaultDetails: providedVaultDetails,
    sdkAuthorization,
  } = options;

  const [resolvedHyper, setResolvedHyper] =
    useState<HyperswitchConfiguration | null>(null);
  const [hyperError, setHyperError] = useState<Error | null>(null);

  const [fetchedVaultDetails, setFetchedVaultDetails] =
    useState<VaultDetails | null>(null);
  const [vaultLoading, setVaultLoading] = useState(false);
  const [vaultError, setVaultError] = useState<Error | null>(null);

  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  useEffect(() => {
    let cancelled = false;

    Promise.resolve(hyper).then(
      (instance) => {
        if (cancelled) return;
        setResolvedHyper(instance);
        setHyperError(null);
      },
      (reason: unknown) => {
        if (cancelled) return;
        const failure =
          reason instanceof Error ? reason : new Error(String(reason));
        setResolvedHyper(null);
        setHyperError(failure);
        onErrorRef.current?.(failure);
      }
    );

    return () => {
      cancelled = true;
    };
  }, [hyper]);

  useEffect(() => {
    if (providedVaultDetails || !sdkAuthorization) {
      setFetchedVaultDetails(null);
      setVaultLoading(false);
      setVaultError(null);
      return;
    }

    setVaultLoading(true);
    setVaultError(null);
    if (!resolvedHyper) return;

    let cancelled = false;
    const controller = new AbortController();

    fetchVaultDetails({
      sdkAuthorization,
      environment: resolvedHyper.environment,
      customEndpoints: resolvedHyper.customEndpoints,
      signal: controller.signal,
    }).then((result) => {
      if (cancelled) return;
      if (result.ok) {
        setFetchedVaultDetails(result.vaultDetails);
        setVaultLoading(false);
        return;
      }
      const failure = new Error(result.message);
      setFetchedVaultDetails(null);
      setVaultError(failure);
      setVaultLoading(false);
      onErrorRef.current?.(failure);
    });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [providedVaultDetails, sdkAuthorization, resolvedHyper]);

  const value = useMemo<PaymentMethodsSession>(
    () => ({
      hyper: resolvedHyper,
      sdkAuthorization: sdkAuthorization ?? null,
      vaultDetails: providedVaultDetails ?? fetchedVaultDetails,
      appearance: appearance ?? null,
      loading: (!resolvedHyper && !hyperError) || vaultLoading,
      error: hyperError ?? vaultError,
    }),
    [
      resolvedHyper,
      sdkAuthorization,
      providedVaultDetails,
      fetchedVaultDetails,
      appearance,
      hyperError,
      vaultLoading,
      vaultError,
    ]
  );

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}
