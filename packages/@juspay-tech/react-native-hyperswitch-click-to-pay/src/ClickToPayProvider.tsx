import React, {
  createContext,
  useContext,
  useState,
  useRef,
  useCallback,
} from 'react';
import ClickToPayComponent, {
  type ClickToPayComponentRef,
} from './ClickToPayComponent';
import type { ClickToPayConfig, ClickToPayCard } from './types';

type ValidateResult = {
  cards?: ClickToPayCard[];
  requiresOTP?: boolean;
  requiresNewCard?: boolean;
  maskedValidationChannel?: string;
};

type CardData = {
  primaryAccountNumber: string;
  panExpirationMonth: string;
  panExpirationYear: string;
  cardSecurityCode: string;
  cardHolderName?: string;
};

type CheckoutParams = {
  srcDigitalCardId?: string;
  encryptedCard?: string;
  cardData?: CardData;
  amount: string;
  currency: string;
  orderId: string;
  rememberMe?: boolean;
};

type ClickToPayContextValue = {
  isLoading: boolean;
  cards: ClickToPayCard[];
  config: ClickToPayConfig | null;
  initialize: (config: ClickToPayConfig) => Promise<void>;
  validate: (userIdentity: {
    value: string;
    type: 'EMAIL_ADDRESS' | 'PHONE_NUMBER';
  }) => Promise<ValidateResult>;
  authenticate: (otpCode: string) => Promise<ClickToPayCard[]>;
  checkout: (params: CheckoutParams) => Promise<any>;
};

const ClickToPayContext = createContext<ClickToPayContextValue | null>(null);

export type ClickToPayProviderProps = {
  children: React.ReactNode;
  onCookiesExtracted?: (cookies: string) => void;
  initialCookies?: string;
};

export const ClickToPayProvider: React.FC<ClickToPayProviderProps> = ({
  children,
  onCookiesExtracted,
  initialCookies,
}) => {
  const [config, setConfig] = useState<ClickToPayConfig | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [cards, setCards] = useState<ClickToPayCard[]>([]);
  const [userIdentity, setUserIdentity] = useState<{
    value: string;
    type: 'EMAIL_ADDRESS' | 'PHONE_NUMBER';
  } | null>(null);

  const componentRef = useRef<ClickToPayComponentRef>(null);
  const pendingPromiseRef = useRef<{
    resolve: (value: any) => void;
    reject: (error: Error) => void;
  } | null>(null);

  const isVisa = config?.provider === 'visa';

  const buildSDKUrl = useCallback((cfg: ClickToPayConfig): string => {
    const isVisaProvider = cfg.provider === 'visa';
    if (isVisaProvider) {
      const baseUrl =
        cfg.environment === 'sandbox'
          ? 'https://sandbox.secure.checkout.visa.com/checkout-widget/resources/js/integration/v2/sdk.js'
          : 'https://secure.checkout.visa.com/checkout-widget/resources/js/integration/v2/sdk.js';

      return `${baseUrl}?dpaId=${cfg.dpaId}&cardBrands=${cfg.cardBrands}&dpaClientId=${cfg.clientId}&locale=${cfg.locale}`;
    } else {
      const baseUrl =
        cfg.environment === 'sandbox'
          ? 'https://sandbox.src.mastercard.com/srci/integration/2/lib.js'
          : 'https://src.mastercard.com/srci/integration/2/lib.js';

      return `${baseUrl}?srcDpaId=${cfg.dpaId}&locale=${cfg.locale}`;
    }
  }, []);

  const buildInitializeOptions = useCallback((cfg: ClickToPayConfig): any => {
    const isVisaProvider = cfg.provider === 'visa';
    const transactionAmount = isVisaProvider
      ? String(cfg.transactionAmount)
      : Number(cfg.transactionAmount);

    if (isVisaProvider) {
      return {
        dpaTransactionOptions: {
          dpaLocale: cfg.locale,
          authenticationPreferences: {
            authenticationMethods: [
              {
                authenticationMethodType: '3DS',
                authenticationSubject: 'CARDHOLDER',
                methodAttributes: {
                  challengeIndicator: '01',
                },
              },
            ],
            payloadRequested: 'AUTHENTICATED',
          },
          paymentOptions: [
            {
              dpaDynamicDataTtlMinutes: 15,
              dynamicDataType: 'CARD_APPLICATION_CRYPTOGRAM_LONG_FORM',
            },
          ],
          transactionAmount: {
            transactionAmount: transactionAmount,
            transactionCurrencyCode: cfg.transactionCurrency,
          },
          acquirerBIN: '455555',
          acquirerMerchantId: '12345678',
          merchantCategoryCode: '4289',
          merchantCountryCode: 'US',
          payloadTypeIndicator: 'FULL',
          dpaBillingPreference: 'NONE',
          merchantName: cfg.clientId,
          merchantOrderId: 'ctp_2142',
        },
      };
    } else {
      const mastercardOptions: any = {
        srcDpaId: cfg.dpaId,
        dpaData: {
          dpaName: cfg.clientId,
        },
        dpaTransactionOptions: {
          dpaLocale: cfg.locale,
          authenticationPreferences: {
            payloadRequested: 'AUTHENTICATED',
          },
          paymentOptions: [
            {
              dpaDynamicDataTtlMinutes: 15,
              dynamicDataType: 'CARD_APPLICATION_CRYPTOGRAM_LONG_FORM',
            },
          ],
          transactionAmount: {
            transactionAmount: transactionAmount,
            transactionCurrencyCode: cfg.transactionCurrency,
          },
          acquirerBIN: '545301',
          acquirerMerchantId: 'SRC3DS',
          merchantCategoryCode: '0001',
          merchantCountryCode: 'US',
        },
        checkoutExperience: 'WITHIN_CHECKOUT',
        cardBrands: cfg.cardBrands?.split(','),
      };

      if (cfg.recognitionToken) {
        mastercardOptions.recognitionToken = cfg.recognitionToken;
      }

      return mastercardOptions;
    }
  }, []);

  const formatCards = useCallback((data: any): ClickToPayCard[] => {
    let cardsList = [];

    if (data?.profiles?.[0]?.maskedCards) {
      cardsList = data.profiles[0].maskedCards;
    } else if (Array.isArray(data)) {
      cardsList = data;
    } else if (data?.cards) {
      cardsList = data.cards;
    } else {
      return [];
    }

    return cardsList.map((card: any) => ({
      id: card.srcDigitalCardId ?? card.digitalCardId,
      maskedPan:
        card.panLastFour ??
        card.tokenLastFour ??
        card.maskedBillingAddress?.accountNumber,
      brand:
        card.digitalCardData?.descriptorName?.toLowerCase() ??
        card.paymentCardDescriptor ??
        card.brand,
      expiryMonth: card.panExpirationMonth ?? card.digitalCardData?.expiryMonth,
      expiryYear: card.panExpirationYear ?? card.digitalCardData?.expiryYear,
      digitalCardId: card.srcDigitalCardId ?? card.digitalCardId,
    }));
  }, []);

  const sendToWebView = useCallback((type: string, data: any) => {
    componentRef.current?.sendMessage(type, data);
  }, []);

  const handleWebViewMessage = useCallback(
    (type: string, data: any) => {
      console.log(`[Provider] Received: ${type}`, data);

      switch (type) {
        case 'LOAD_SUCCESS':
          if (!config) return;
          const initializeOptions = buildInitializeOptions(config);
          sendToWebView('INIT', {
            isVISA: config.provider === 'visa',
            initializeOptions,
          });
          break;

        case 'LOAD_ERROR':
          setIsLoading(false);
          if (pendingPromiseRef.current) {
            pendingPromiseRef.current.reject(new Error('SDK_LOAD_ERROR'));
            pendingPromiseRef.current = null;
          }
          break;

        case 'INIT_SUCCESS':
          setIsLoading(false);
          if (pendingPromiseRef.current) {
            pendingPromiseRef.current.resolve(undefined);
            pendingPromiseRef.current = null;
          }
          break;

        case 'INIT_FAILED':
          setIsLoading(false);
          if (pendingPromiseRef.current) {
            pendingPromiseRef.current.reject(new Error(data));
            pendingPromiseRef.current = null;
          }
          break;

        case 'GET_CARDS_SUCCESS':
          if (data.actionCode === 'PENDING_CONSUMER_IDV') {
            setIsLoading(false);
            if (pendingPromiseRef.current) {
              pendingPromiseRef.current.resolve({
                requiresOTP: true,
                maskedValidationChannel: data.maskedValidationChannel,
              });
              pendingPromiseRef.current = null;
            }
          } else if (data.actionCode === 'ADD_CARD') {
            setIsLoading(false);
            if (pendingPromiseRef.current) {
              pendingPromiseRef.current.resolve({
                requiresNewCard: true,
              });
              pendingPromiseRef.current = null;
            }
          } else {
            const formattedCards = formatCards(data);
            setCards(formattedCards);
            setIsLoading(false);
            if (pendingPromiseRef.current) {
              pendingPromiseRef.current.resolve({ cards: formattedCards });
              pendingPromiseRef.current = null;
            }
          }
          break;

        case 'GET_CARDS_FAILED':
          setIsLoading(false);
          if (pendingPromiseRef.current) {
            pendingPromiseRef.current.reject(new Error(data));
            pendingPromiseRef.current = null;
          }
          break;

        case 'ID_LOOKUP_SUCCESS':
          setIsLoading(false);
          if (pendingPromiseRef.current) {
            pendingPromiseRef.current.resolve(data);
            pendingPromiseRef.current = null;
          }
          break;

        case 'ID_LOOKUP_FAILED':
          setIsLoading(false);
          if (pendingPromiseRef.current) {
            pendingPromiseRef.current.reject(new Error(data));
            pendingPromiseRef.current = null;
          }
          break;

        case 'INITIATE_VALIDATION_SUCCESS':
          setIsLoading(false);
          if (pendingPromiseRef.current) {
            pendingPromiseRef.current.resolve(data);
            pendingPromiseRef.current = null;
          }
          break;

        case 'INITIATE_VALIDATION_FAILED':
          setIsLoading(false);
          if (pendingPromiseRef.current) {
            pendingPromiseRef.current.reject(new Error(data));
            pendingPromiseRef.current = null;
          }
          break;

        case 'VALIDATE_SUCCESS':
          const validatedCards = formatCards(data);
          setCards(validatedCards);
          setIsLoading(false);
          if (pendingPromiseRef.current) {
            pendingPromiseRef.current.resolve(validatedCards);
            pendingPromiseRef.current = null;
          }
          break;

        case 'VALIDATE_FAILED':
          setIsLoading(false);
          if (pendingPromiseRef.current) {
            pendingPromiseRef.current.reject(new Error(data));
            pendingPromiseRef.current = null;
          }
          break;

        case 'CHECKOUT_SUCCESS':
          setIsLoading(false);
          if (pendingPromiseRef.current) {
            pendingPromiseRef.current.resolve(data);
            pendingPromiseRef.current = null;
          }
          break;

        case 'CHECKOUT_FAILED':
          setIsLoading(false);
          if (pendingPromiseRef.current) {
            pendingPromiseRef.current.reject(new Error(data));
            pendingPromiseRef.current = null;
          }
          break;

        case 'ENCRYPT_CARD_SUCCESS':
          if (pendingPromiseRef.current) {
            pendingPromiseRef.current.resolve(data);
            pendingPromiseRef.current = null;
          }
          break;

        case 'ENCRYPT_CARD_FAILED':
          if (pendingPromiseRef.current) {
            pendingPromiseRef.current.reject(new Error(data));
            pendingPromiseRef.current = null;
          }
          break;

        default:
          console.log(`[Provider] Unhandled message type: ${type}`);
      }
    },
    [buildInitializeOptions, formatCards, sendToWebView, config]
  );

  const initialize = useCallback(
    async (newConfig: ClickToPayConfig): Promise<void> => {
      setConfig(newConfig);
      setIsLoading(true);

      const sdkUrl = buildSDKUrl(newConfig);

      return new Promise((resolve, reject) => {
        pendingPromiseRef.current = { resolve, reject };
        sendToWebView('LOAD', { sdkUrl });
      });
    },
    [buildSDKUrl, sendToWebView]
  );

  const validate = useCallback(
    async (identity: {
      value: string;
      type: 'EMAIL_ADDRESS' | 'PHONE_NUMBER';
    }): Promise<ValidateResult> => {
      if (!config) {
        throw new Error('SDK not initialized');
      }

      setUserIdentity(identity);
      setIsLoading(true);

      const params = {
        consumerIdentity: {
          identityProvider: 'SRC',
          identityValue: identity.value,
          identityType: identity.type,
        },
      };

      return new Promise(async (resolve, reject) => {
        pendingPromiseRef.current = { resolve, reject };
        sendToWebView('GET_CARDS', {
          isVISA: isVisa,
          params,
        });
      }).then(async (result: any) => {
        if (result.cards && result.cards.length > 0) {
          return result;
        }

        if (result.requiresOTP || result.requiresNewCard) {
          return result;
        }

        if (!isVisa) {
          const idLookupParams =
            identity.type === 'EMAIL_ADDRESS'
              ? { email: identity.value }
              : {
                  mobileNumber: {
                    countryCode: '1',
                    phoneNumber: identity.value,
                  },
                };

          return new Promise((resolve, reject) => {
            pendingPromiseRef.current = { resolve, reject };
            sendToWebView('ID_LOOKUP', {
              isVISA: false,
              params: idLookupParams,
            });
          }).then(async (idLookupResult: any) => {
            if (idLookupResult.consumerPresent) {
              return new Promise((resolve, reject) => {
                pendingPromiseRef.current = { resolve, reject };
                sendToWebView('INITIATE_VALIDATION', {
                  isVISA: false,
                  params: undefined,
                });
              }).then(() => ({
                requiresOTP: true,
              }));
            } else {
              return {
                requiresNewCard: true,
              };
            }
          });
        }

        return result;
      });
    },
    [isVisa, config, sendToWebView]
  );

  const authenticate = useCallback(
    async (otpCode: string): Promise<ClickToPayCard[]> => {
      if (!config) {
        throw new Error('SDK not initialized');
      }

      setIsLoading(true);

      if (isVisa) {
        const params = {
          consumerIdentity: {
            identityProvider: 'SRC',
            identityValue: userIdentity?.value,
            identityType: userIdentity?.type,
          },
          validationData: otpCode,
        };

        return new Promise((resolve, reject) => {
          pendingPromiseRef.current = { resolve, reject };
          sendToWebView('GET_CARDS', {
            isVISA: true,
            params,
          });
        }).then((result: any) => {
          if (result.cards) {
            return result.cards;
          }
          const formattedCards = formatCards(result);
          return formattedCards;
        });
      } else {
        const params = {
          value: otpCode,
        };

        return new Promise((resolve, reject) => {
          pendingPromiseRef.current = { resolve, reject };
          sendToWebView('VALIDATE', {
            isVISA: false,
            params,
          });
        });
      }
    },
    [isVisa, config, userIdentity, sendToWebView, formatCards]
  );

  const checkout = useCallback(
    async (params: CheckoutParams): Promise<any> => {
      if (!config) {
        throw new Error('SDK not initialized');
      }

      setIsLoading(true);

      let encryptedCardData: string | undefined = params.encryptedCard;

      if (params.cardData) {
        try {
          encryptedCardData = await new Promise<string>((resolve, reject) => {
            pendingPromiseRef.current = { resolve, reject };
            sendToWebView('ENCRYPT_CARD', { cardData: params.cardData });
          });
        } catch (error) {
          setIsLoading(false);
          throw new Error(
            `Card encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`
          );
        }
      }

      let checkoutParams: any;

      if (isVisa) {
        checkoutParams = {
          // ...buildInitializeOptions(config),
          encryptedCard: encryptedCardData,
          // amount: params.amount,
          // currency: params.currency,
          // merchantOrderId: params.orderId,
          consumer: {
            consumerIdentity: {
              identityProvider: 'SRC',
              identityValue: userIdentity?.value,
              identityType: userIdentity?.type,
            },
            countryCode: 'IN',
            emailAddress: userIdentity?.value,
            fullName: 'test test',
            locale: 'en',
            mobileNumber: {
              phoneNumber: '8003132369',
              countryCode: '91',
            },
          },
          payloadTypeIndicatorCheckout: 'FULL',
        };
      } else {
        checkoutParams = {
          // ...buildInitializeOptions(config),
          encryptedCard: encryptedCardData,
          // consumer: {
          //   emailAddress: userIdentity?.value,
          //   firstName: 'test',
          //   lastName: 'test',
          //   mobileNumber: {
          //     phoneNumber: '8003132369',
          //     countryCode: '91'
          //   }
          // },
          rememberMe:
            params.rememberMe !== undefined ? params.rememberMe : true,
          recognitionTokenRequested:
            params.rememberMe !== undefined ? params.rememberMe : true,
        };
      }

      console.log(checkoutParams);

      if (params.srcDigitalCardId) {
        checkoutParams.srcDigitalCardId = params.srcDigitalCardId;
      }

      const complianceSettingsVisa = {
        complianceResources: [
          {
            complianceType: 'PRIVACY_POLICY',
            uri: 'https://www.visa.com/en_us/checkout/legal/global-privacy-notice.html',
          },
          {
            complianceType: 'REMEMBER_ME',
            uri: 'https://www.visa.com/en_us/checkout/legal/global-privacy-notice/cookie-notice.html',
          },
          {
            complianceType: 'TERMS_AND_CONDITIONS',
            uri: 'https://www.visa.com/en_us/checkout/legal/terms-of-service.html',
          },
        ],
      };

      const complianceSettingsMC = {
        privacy: {
          acceptedVersion: 'LATEST',
          latestVersion: 'LATEST',
          latestVersionUri:
            'https://www.mastercard.com/global/click-to-pay/country-listing/privacy.html',
        },
        tnc: {
          acceptedVersion: 'LATEST',
          latestVersion: 'LATEST',
          latestVersionUri:
            'https://www.mastercard.com/global/click-to-pay/country-listing/terms.html',
        },
        cookie: {
          acceptedVersion: 'LATEST',
          latestVersion: 'LATEST',
          latestVersionUri:
            'https://www.mastercard.com/global/click-to-pay/en-sg/privacy-notice.html',
        },
      };

      if (params.rememberMe) {
        checkoutParams.complianceSettings = isVisa
          ? complianceSettingsVisa
          : complianceSettingsMC;
      }

      return new Promise((resolve, reject) => {
        pendingPromiseRef.current = { resolve, reject };
        sendToWebView('CHECKOUT', {
          isVISA: isVisa,
          params: checkoutParams,
        });
      });
    },
    [isVisa, config, userIdentity, sendToWebView]
  );

  const contextValue: ClickToPayContextValue = {
    isLoading,
    cards,
    config,
    initialize,
    validate,
    authenticate,
    checkout,
  };

  return (
    <ClickToPayContext.Provider value={contextValue}>
      <ClickToPayComponent
        ref={componentRef}
        onMessage={handleWebViewMessage}
        onCookiesExtracted={onCookiesExtracted}
        initialCookies={initialCookies}
      />
      {children}
    </ClickToPayContext.Provider>
  );
};

export const useClickToPay = (): ClickToPayContextValue => {
  const context = useContext(ClickToPayContext);
  if (!context) {
    throw new Error('useClickToPay must be used within ClickToPayProvider');
  }
  return context;
};
