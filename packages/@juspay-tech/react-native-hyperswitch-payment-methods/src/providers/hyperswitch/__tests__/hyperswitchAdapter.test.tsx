import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { act, render, screen, waitFor } from '@testing-library/react-native';

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
    hyper: { publishableKey: 'pk_snd_test' },
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

describe("hyperswitch adapter — the merchant's endpoints", () => {
  it('passes customEndpoints on to the vault, so an EU or self-hosted backend gets the confirm', async () => {
    const customEndpoints = { commonEndpoint: 'https://eu.hyperswitch.io/api' };
    render(
      <SessionContext.Provider
        value={session({
          hyper: { publishableKey: 'pk_prd_eu', customEndpoints },
        })}
      >
        <CardForm vaultDetails={details}>
          <CardNumberField />
        </CardForm>
      </SessionContext.Provider>
    );

    await waitFor(() => expect(vaultProps.form).toBeDefined());
    expect(vaultProps.form?.customEndpoints).toEqual(customEndpoints);
  });

  it('passes none when the merchant set none, leaving the vault on its environment', async () => {
    render(
      <SessionContext.Provider
        value={session({ hyper: { publishableKey: 'pk_snd_x' } })}
      >
        <CardForm vaultDetails={details}>
          <CardNumberField />
        </CardForm>
      </SessionContext.Provider>
    );

    await waitFor(() => expect(vaultProps.form).toBeDefined());
    expect(vaultProps.form?.customEndpoints).toBeUndefined();
  });
});

describe('hyperswitch adapter — before the configuration is known', () => {
  const form = (value: Partial<PaymentMethodsSession>) => (
    <SessionContext.Provider value={session(value)}>
      <CardForm vaultDetails={details}>
        <CardNumberField />
      </CardForm>
    </SessionContext.Provider>
  );

  it("does not mount the vault until the merchant's hyper resolves, so nothing runs on a guessed environment", async () => {
    const view = render(form({ hyper: null }));
    await act(async () => {});
    expect(vaultProps.form).toBeUndefined();

    view.rerender(
      form({ hyper: { publishableKey: 'pk_prd_x', environment: 'PROD_EU' } })
    );
    await waitFor(() => expect(vaultProps.form).toBeDefined());
    expect(vaultProps.form?.environment).toBe('PROD_EU');
  });

  it('never mounts the vault when hyper failed', async () => {
    render(form({ hyper: null, error: new Error('init failed') }));
    await act(async () => {});
    expect(vaultProps.form).toBeUndefined();
  });
});

describe('hyperswitch adapter — the environment', () => {
  const renderWith = (
    value: Partial<PaymentMethodsSession> | null,
    vaultDetails: VaultDetails = details
  ) => {
    const form = (
      <CardForm vaultDetails={vaultDetails}>
        <CardNumberField />
      </CardForm>
    );
    render(
      value ? (
        <SessionContext.Provider value={session({ vaultDetails, ...value })}>
          {form}
        </SessionContext.Provider>
      ) : (
        form
      )
    );
  };

  it("follows the merchant's environment when vaultData names none, so a sandbox session confirms on sandbox", async () => {
    renderWith({
      hyper: { publishableKey: 'pk_snd_x', environment: 'SANDBOX' },
    });
    await waitFor(() => expect(vaultProps.form).toBeDefined());
    expect(vaultProps.form?.environment).toBe('SANDBOX');
  });

  it("lets vaultData's own environment win", async () => {
    renderWith(
      { hyper: { publishableKey: 'pk_snd_x', environment: 'SANDBOX' } },
      {
        vaultType: 'hyperswitch',
        vaultData: { sdkAuthorization: 'sdk_auth_123', environment: 'INTEG' },
      }
    );
    await waitFor(() => expect(vaultProps.form).toBeDefined());
    expect(vaultProps.form?.environment).toBe('INTEG');
  });

  it('passes PROD_EU through to the vault', async () => {
    renderWith({
      hyper: { publishableKey: 'pk_prd_x', environment: 'PROD_EU' },
    });
    await waitFor(() => expect(vaultProps.form).toBeDefined());
    expect(vaultProps.form?.environment).toBe('PROD_EU');
  });

  it('defaults to PROD when neither names one', async () => {
    renderWith({ hyper: { publishableKey: 'pk_prd_x' } });
    await waitFor(() => expect(vaultProps.form).toBeDefined());
    expect(vaultProps.form?.environment).toBe('PROD');
  });
});
