import { describe, it, expect, jest, afterEach } from '@jest/globals';
import { render, screen, act, waitFor } from '@testing-library/react-native';

const mockMountSpy = jest.fn();

jest.mock(
  '@juspay-tech/react-native-hyperswitch-vault',
  () => {
    const React = require('react');

    const CardForm = React.forwardRef((props: any, ref: any) => {
      mockMountSpy();
      React.useImperativeHandle(ref, () => ({
        tokenize: jest.fn(async () => ({
          status: 'success',
          token: 'tok_hs',
          card: { last4: '4242' },
        })),
        confirmPayment: jest.fn(),
        reset: jest.fn(),
        focus: jest.fn(),
      }));
      React.useEffect(() => {
        props.onContext?.({
          sdkAuthorization: props.vaultDetails?.vaultData?.sdkAuthorization,
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [props.onContext]);
      return props.children ?? null;
    });

    const makeField = (elementType: string) => (props: any) => {
      const { Text } = require('react-native');
      return props.form
        ? React.createElement(Text, { testID: `hs-${elementType}` }, 'ready')
        : null;
    };

    return {
      __esModule: true,
      CardForm,
      CardNumberField: makeField('cardNumber'),
      CardExpiryField: makeField('cardExpiry'),
      CardCVCField: makeField('cardCvc'),
      CardholderNameField: makeField('cardholderName'),
    };
  },
  { virtual: true }
);

import { Hyperswitch } from '../../../session/init';
import {
  CardNumberField,
  CardExpiryField,
  CardCVCField,
  CardholderNameField,
} from '../../../fields';
import type { TokenizeResult, VaultDetails } from '../../../core/types';

const hyperswitchDetails: VaultDetails = {
  vaultType: 'hyperswitch',
  vaultData: { sdkAuthorization: 'auth_123' },
};

afterEach(() => {
  jest.clearAllMocks();
});

describe('hyperswitchVaultAdapter (headless)', () => {
  it('mounts every field standalone, with no wrapper, and only one session', async () => {
    const hyper = await Hyperswitch.init({ publishableKey: 'pk_test' });
    const session = await hyper.initPaymentMethodSession({
      vaultDetails: hyperswitchDetails,
    });
    const cardForm = session.createCardForm();

    render(
      <>
        <CardNumberField form={cardForm} />
        <CardExpiryField form={cardForm} />
        <CardCVCField form={cardForm} />
        <CardholderNameField form={cardForm} />
      </>
    );

    expect(screen.getByTestId('hs-placeholder-cardNumber')).toBeTruthy();
    expect(screen.getByTestId('hs-placeholder-cardExpiry')).toBeTruthy();

    await waitFor(() => expect(screen.getByTestId('hs-cardNumber')).toBeTruthy());
    expect(screen.getByTestId('hs-cardExpiry')).toBeTruthy();
    expect(screen.getByTestId('hs-cardCvc')).toBeTruthy();
    expect(screen.getByTestId('hs-cardholderName')).toBeTruthy();

    // Only CardNumberField mounts the session — the other three just consume it.
    expect(mockMountSpy).toHaveBeenCalledTimes(1);

    let result: TokenizeResult | undefined;
    await act(async () => {
      result = await cardForm.tokenize();
    });
    expect(result?.status).toBe('success');
    expect(result?.status === 'success' && result.data?.tokens).toEqual({
      payment_method_token: 'tok_hs',
    });
    expect(result?.status === 'success' && result.card?.last4).toBe('4242');
  });

  it('refuses to tokenize before CardNumberField has ever mounted', async () => {
    const hyper = await Hyperswitch.init({ publishableKey: 'pk_test' });
    const session = await hyper.initPaymentMethodSession({
      vaultDetails: hyperswitchDetails,
    });
    const cardForm = session.createCardForm();

    const result = await cardForm.tokenize();
    expect(result.status).toBe('error');
    expect(result.status === 'error' && result.error.code).toBe('sdk_not_ready');
  });
});
