import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { render, screen, waitFor } from '@testing-library/react-native';

/* The vault is an optional peer, so stand one in and record what it is handed.
   The adapter types it as `any`, so only this test pins the prop names. */
const vaultProps: {
  form?: Record<string, any>;
  fields: Record<string, any>;
} = { fields: {} };

jest.mock(
  '@juspay-tech/react-native-hyperswitch-vault',
  () => {
    const {
      Fragment,
      createElement,
      forwardRef,
      useImperativeHandle,
    } = require('react');
    const { Text } = require('react-native');
    const field = (elementType: string) => (props: Record<string, unknown>) => {
      vaultProps.fields[elementType] = props;
      return createElement(
        Text,
        { testID: `vault-${elementType}` },
        elementType
      );
    };
    return {
      /* The adapter treats the ref as the collector, so it must resolve. */
      CardForm: forwardRef(
        ({ children, ...rest }: Record<string, any>, ref: unknown) => {
          vaultProps.form = rest;
          useImperativeHandle(ref, () => ({ tokenize: async () => ({}) }), []);
          return createElement(Fragment, null, children);
        }
      ),
      CardNumberField: field('cardNumber'),
      CardExpiryField: field('cardExpiry'),
      CardCVCField: field('cardCvc'),
      CardholderNameField: field('cardholderName'),
    };
  },
  { virtual: true }
);

import { CardForm } from '../../../core/CardForm';
import { CardNumberField, CardCVCField } from '../../../fields';
import { registerAdapter } from '../../registry';
import { hyperswitchVaultAdapter } from '../adapter';
import { SessionContext } from '../../../session/SessionContext';
import type { PaymentMethodsSession } from '../../../session/SessionContext';
import type { Appearance, VaultDetails } from '../../../core/types';

const details: VaultDetails = {
  vaultType: 'hyperswitch',
  vaultData: { sdkAuthorization: 'sdk_auth_123' },
};

const appearance: Appearance = {
  colors: {
    light: {
      primary: '#0570DE',
      componentText: '#1A1A1A',
      componentBorder: '#E0E0E0',
      placeholderText: '#9E9E9E',
      componentBackground: '#FFFFFF',
      error: '#D32F2F',
    },
  },
  shapes: { borderRadius: 8, borderWidth: 1, inputHeight: 48, gap: 12 },
  font: { family: 'Inter', scale: 1.1 },
  labels: 'above',
};

const session = (value: Partial<PaymentMethodsSession>) =>
  ({
    vaultDetails: details,
    loading: false,
    error: null,
    locale: null,
    ...value,
  }) as PaymentMethodsSession;

beforeEach(() => {
  vaultProps.form = undefined;
  vaultProps.fields = {};
  registerAdapter(hyperswitchVaultAdapter);
});

describe('hyperswitch adapter — what the vault SDK receives', () => {
  it('hands the vault an appearance in its own variable names, plus locale', async () => {
    render(
      <SessionContext.Provider value={session({ locale: 'fr' })}>
        <CardForm vaultDetails={details} appearance={appearance}>
          <CardNumberField />
        </CardForm>
      </SessionContext.Provider>
    );

    await waitFor(() => expect(vaultProps.form).toBeDefined());
    expect(vaultProps.form?.appearance).toEqual({
      variables: {
        colorPrimary: '#0570DE',
        colorText: '#1A1A1A',
        colorTextPlaceholder: '#9E9E9E',
        colorBackground: '#FFFFFF',
        borderColor: '#E0E0E0',
        colorDanger: '#D32F2F',
        borderRadius: 8,
        borderWidth: 1,
        inputFieldHeight: 48,
        gap: 12,
        fontFamily: 'Inter',
        fontScale: 1.1,
      },
      labels: 'above',
    });
    expect(vaultProps.form?.locale).toBe('fr');
    expect(vaultProps.form?.vaultDetails).toEqual({
      vaultType: 'hyperswitch',
      vaultData: { sdkAuthorization: 'sdk_auth_123' },
    });
  });

  it('forwards the per-field chrome to the matching vault field', async () => {
    render(
      <SessionContext.Provider value={session({})}>
        <CardForm vaultDetails={details}>
          <CardNumberField
            placeholder="1234"
            label="Card"
            labelBehavior="never"
            errorDisplay="none"
            unstyled
            options={{ cardBrandIcon: 'hideGeneric' }}
          />
          <CardCVCField cvcIcon="hidden" />
        </CardForm>
      </SessionContext.Provider>
    );

    await waitFor(() =>
      expect(screen.getByTestId('vault-cardNumber')).toBeTruthy()
    );
    expect(vaultProps.fields.cardNumber).toMatchObject({
      placeholder: '1234',
      label: 'Card',
      labelBehavior: 'never',
      errorDisplay: 'none',
      unstyled: true,
      cardBrandIcon: 'hideGeneric',
    });
    /* Each icon reaches only the field that owns it. */
    expect(vaultProps.fields.cardNumber.cvcIcon).toBeUndefined();
    expect(vaultProps.fields.cardCvc.cvcIcon).toBe('hidden');
    expect(vaultProps.fields.cardCvc.cardBrandIcon).toBeUndefined();
  });

  it('omits appearance entirely when nothing themeable was given', async () => {
    render(
      <SessionContext.Provider value={session({})}>
        <CardForm vaultDetails={details}>
          <CardNumberField />
        </CardForm>
      </SessionContext.Provider>
    );

    await waitFor(() => expect(vaultProps.form).toBeDefined());
    expect(vaultProps.form?.appearance).toBeUndefined();
  });
});
