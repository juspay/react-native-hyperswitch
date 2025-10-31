import React, { useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Alert,
  TextInput,
  Switch,
} from 'react-native';

import {
  ClickToPayProvider,
  useClickToPay,
  type ClickToPayCard,
} from 'react-native-hyperswitch-click-to-pay';

const App: React.FC = () => {
  const [cookieInput, setCookieInput] = useState('');
  const [extractedCookies, setExtractedCookies] = useState('');
  const [activeCookies, setActiveCookies] = useState('');

  const handleCookiesExtracted = (cookies: string) => {
    console.log('Cookies extracted:', cookies);
    setExtractedCookies(cookies);
    setActiveCookies(cookies);
    Alert.alert(
      'Cookies Extracted',
      'Cookies have been automatically saved from checkout'
    );
  };

  const handleSetCookies = () => {
    if (!cookieInput.trim()) {
      Alert.alert('Error', 'Please enter cookies first');
      return;
    }
    setActiveCookies(cookieInput);
    Alert.alert('Success', 'Cookies have been set');
  };

  const handleClearCookies = () => {
    setCookieInput('');
    setExtractedCookies('');
    setActiveCookies('');
    Alert.alert('Success', 'All cookies have been cleared');
  };

  return (
    <ClickToPayProvider
      onCookiesExtracted={handleCookiesExtracted}
      initialCookies={activeCookies}
    >
      <CheckoutScreen
        cookieInput={cookieInput}
        setCookieInput={setCookieInput}
        extractedCookies={extractedCookies}
        activeCookies={activeCookies}
        onSetCookies={handleSetCookies}
        onClearCookies={handleClearCookies}
      />
    </ClickToPayProvider>
  );
};

type CheckoutScreenProps = {
  cookieInput: string;
  setCookieInput: (value: string) => void;
  extractedCookies: string;
  activeCookies: string;
  onSetCookies: () => void;
  onClearCookies: () => void;
};

const CheckoutScreen: React.FC<CheckoutScreenProps> = ({
  cookieInput,
  setCookieInput,
  extractedCookies,
  activeCookies,
  onSetCookies,
  onClearCookies,
}) => {
  // Configuration state
  const [dpaId, setDpaId] = useState(
    '498WCF39JVQVH1UK4TGG21leLAj_MJQoapP5f12IanfEYaSno'
  );
  const [provider, setProvider] = useState<'visa' | 'mastercard'>('visa');
  const [environment, setEnvironment] = useState<'sandbox' | 'production'>(
    'sandbox'
  );
  const [idToken, setIdToken] = useState('');

  // User identity state
  const [userIdentity, setUserIdentity] = useState('shivam.shashank@juspay.in');
  const [identityType, setIdentityType] = useState<
    'EMAIL_ADDRESS' | 'PHONE_NUMBER'
  >('EMAIL_ADDRESS');

  // OTP state
  const [otpCode, setOtpCode] = useState('');
  const [requiresOTP, setRequiresOTP] = useState(false);
  const [maskedChannel, setMaskedChannel] = useState('');
  const [rememberMe, setRememberMe] = useState(true);

  // Payment state
  const [amount, setAmount] = useState('99.99');
  const [currency, setCurrency] = useState('USD');
  const [orderId, setOrderId] = useState('order-123');
  const [selectedCardId, setSelectedCardId] = useState('');

  // Card data for new card
  const [cardNumber, setCardNumber] = useState('4111111111111111');
  const [expiryMonth, setExpiryMonth] = useState('12');
  const [expiryYear, setExpiryYear] = useState('2025');
  const [cvv, setCvv] = useState('123');
  const [cardholderName, setCardholderName] = useState('John Doe');
  const [useNewCard, setUseNewCard] = useState(false);

  const {
    isLoading,
    cards,
    config,
    initialize,
    validate,
    authenticate,
    checkout,
  } = useClickToPay();

  const handleInitialize = async () => {
    try {
      await initialize({
        dpaId,
        environment,
        provider,
        locale: 'en_US',
        cardBrands: 'visa,mastercard',
        clientId: 'TestMerchant',
        transactionAmount: amount,
        transactionCurrency: currency,
        recognitionToken:
          provider === 'mastercard' && idToken ? idToken : undefined,
      });
      Alert.alert(
        'Success',
        'SDK initialized successfully' +
          (idToken ? ' with Recognition Token' : '')
      );
    } catch (err) {
      Alert.alert(
        'Error',
        err instanceof Error ? err.message : 'Initialization failed'
      );
    }
  };

  const handleValidate = async () => {
    try {
      const result = await validate({
        value: userIdentity,
        type: identityType,
      });

      if (result.requiresOTP) {
        setRequiresOTP(true);
        setMaskedChannel(result.maskedValidationChannel || '');
        Alert.alert(
          'OTP Required',
          `OTP sent to ${result.maskedValidationChannel}`
        );
      } else if (result.requiresNewCard) {
        setUseNewCard(true);
        Alert.alert('New Card Required', 'Please provide card details');
      } else if (result.cards && result.cards.length > 0) {
        setSelectedCardId(result.cards[0]!.id);
        Alert.alert('Success', `Found ${result.cards.length} card(s)`);
      }
    } catch (err) {
      Alert.alert(
        'Error',
        err instanceof Error ? err.message : 'Validation failed'
      );
    }
  };

  const handleAuthenticate = async () => {
    try {
      const retrievedCards = await authenticate(otpCode);
      if (retrievedCards.length > 0) {
        setSelectedCardId(retrievedCards[0]!.id);
        setRequiresOTP(false);
        Alert.alert('Success', `Retrieved ${retrievedCards.length} card(s)`);
      }
    } catch (err) {
      Alert.alert(
        'Error',
        err instanceof Error ? err.message : 'Authentication failed'
      );
    }
  };

  const handleCheckout = async () => {
    try {
      let result;

      if (useNewCard) {
        // Checkout with new card (auto-encrypted)
        result = await checkout({
          cardData: {
            primaryAccountNumber: cardNumber,
            panExpirationMonth: expiryMonth,
            panExpirationYear: expiryYear,
            cardSecurityCode: cvv,
            cardHolderName: cardholderName,
          },
          amount,
          currency,
          orderId,
          rememberMe,
        });
      } else {
        // Checkout with existing card
        if (!selectedCardId) {
          Alert.alert('Error', 'Please select a card first');
          return;
        }
        result = await checkout({
          srcDigitalCardId: selectedCardId,
          amount,
          currency,
          orderId,
          rememberMe,
        });
      }

      // Extract idToken from Mastercard response
      if (provider === 'mastercard' && result?.idToken) {
        setIdToken(result.idToken);
        Alert.alert(
          'Success',
          `Checkout completed! ID Token received and saved.`
        );
      } else {
        Alert.alert('Success', 'Checkout completed successfully');
      }

      console.log('Checkout result:', result);
    } catch (err) {
      Alert.alert(
        'Error',
        err instanceof Error ? err.message : 'Checkout failed'
      );
    }
  };

  const isInitialized = config !== null;

  return (
    <ScrollView style={styles.scrollView}>
      <View style={[styles.section, styles.cookieSection]}>
        <Text style={styles.sectionTitle}>🍪 Cookie Management</Text>

        <Text style={styles.label}>Manual Cookie Input</Text>
        <Text style={styles.helperText}>Format: key=value; key2=value2</Text>
        <TextInput
          style={[styles.input, styles.multilineInput]}
          value={cookieInput}
          onChangeText={setCookieInput}
          placeholder="sessionId=abc123; token=xyz789"
          multiline
          numberOfLines={3}
        />

        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[
              styles.button,
              styles.halfButton,
              !cookieInput && styles.buttonDisabled,
            ]}
            onPress={onSetCookies}
            disabled={!cookieInput}
          >
            <Text style={styles.buttonText}>Set Cookies</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.button, styles.halfButton, styles.dangerButton]}
            onPress={onClearCookies}
          >
            <Text style={styles.buttonText}>Clear All</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.label}>
          Extracted Cookies (Auto-populated after checkout)
        </Text>
        <TextInput
          style={[styles.input, styles.multilineInput, styles.readOnlyInput]}
          value={extractedCookies}
          placeholder="Cookies will appear here after successful checkout"
          multiline
          numberOfLines={3}
          editable={false}
        />

        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Active Cookies:</Text>
          <Text
            style={[
              styles.statusBadge,
              activeCookies
                ? styles.statusBadgeActive
                : styles.statusBadgeInactive,
            ]}
          >
            {activeCookies ? '✓ Set' : '✗ None'}
          </Text>
        </View>
        {activeCookies && (
          <Text style={styles.cookiePreview} numberOfLines={2}>
            {activeCookies}
          </Text>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>1. Initialize SDK</Text>

        <View style={styles.providerToggle}>
          <TouchableOpacity
            style={[
              styles.providerButton,
              provider === 'visa' && styles.providerButtonActive,
            ]}
            onPress={() => {
              setProvider('visa');
              setDpaId('498WCF39JVQVH1UK4TGG21leLAj_MJQoapP5f12IanfEYaSno');
            }}
          >
            <Text
              style={[
                styles.providerButtonText,
                provider === 'visa' && styles.providerButtonTextActive,
              ]}
            >
              Visa
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.providerButton,
              provider === 'mastercard' && styles.providerButtonActive,
            ]}
            onPress={() => {
              setProvider('mastercard');
              setDpaId('b6e06cc6-3018-4c4c-bbf5-9fb232615090');
            }}
          >
            <Text
              style={[
                styles.providerButtonText,
                provider === 'mastercard' && styles.providerButtonTextActive,
              ]}
            >
              Mastercard
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.switchRow}>
          <Text style={styles.label}>Sandbox Mode</Text>
          <Switch
            value={environment === 'sandbox'}
            onValueChange={(value) =>
              setEnvironment(value ? 'sandbox' : 'production')
            }
          />
        </View>

        <Text style={styles.label}>DPA ID</Text>
        <TextInput style={styles.input} value={dpaId} onChangeText={setDpaId} />

        {provider === 'mastercard' && (
          <>
            <Text style={styles.label}>
              ID Token (Recognition Token - Mastercard)
            </Text>
            <Text style={styles.helperText}>
              Auto-populated from checkout or enter manually
            </Text>
            <TextInput
              style={[styles.input, styles.multilineInput]}
              value={idToken}
              onChangeText={setIdToken}
              placeholder="ID Token from previous checkout"
              multiline
              numberOfLines={2}
            />
          </>
        )}

        <TouchableOpacity
          style={[styles.button, isInitialized && styles.buttonDisabled]}
          onPress={handleInitialize}
          disabled={isLoading || isInitialized}
        >
          <Text style={styles.buttonText}>
            {isInitialized
              ? '✓ Initialized'
              : isLoading
                ? 'Initializing...'
                : 'Initialize SDK'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>2. Validate User</Text>

        <Text style={styles.label}>Email/Phone</Text>
        <TextInput
          style={styles.input}
          value={userIdentity}
          onChangeText={setUserIdentity}
          placeholder="user@example.com"
        />

        <View style={styles.switchRow}>
          <Text style={styles.label}>Use Email</Text>
          <Switch
            value={identityType === 'EMAIL_ADDRESS'}
            onValueChange={(value) =>
              setIdentityType(value ? 'EMAIL_ADDRESS' : 'PHONE_NUMBER')
            }
          />
        </View>

        <TouchableOpacity
          style={[styles.button, !isInitialized && styles.buttonDisabled]}
          onPress={handleValidate}
          disabled={!isInitialized || isLoading}
        >
          <Text style={styles.buttonText}>
            {isLoading ? 'Validating...' : 'Validate User'}
          </Text>
        </TouchableOpacity>

        {maskedChannel && (
          <Text style={styles.infoText}>OTP sent to: {maskedChannel}</Text>
        )}
      </View>

      {requiresOTP && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>3. Authenticate with OTP</Text>

          <Text style={styles.label}>OTP Code</Text>
          <TextInput
            style={styles.input}
            value={otpCode}
            onChangeText={setOtpCode}
            placeholder="123456"
            keyboardType="number-pad"
            maxLength={6}
          />

          <View style={styles.switchRow}>
            <View>
              <Text style={styles.label}>Remember Me</Text>
              <Text style={styles.helperText}>
                Save card for future checkouts
              </Text>
            </View>
            <Switch value={rememberMe} onValueChange={setRememberMe} />
          </View>

          <TouchableOpacity
            style={[styles.button, !otpCode && styles.buttonDisabled]}
            onPress={handleAuthenticate}
            disabled={!otpCode || isLoading}
          >
            <Text style={styles.buttonText}>
              {isLoading ? 'Authenticating...' : 'Submit OTP'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {cards.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Available Cards ({cards.length})
          </Text>
          {cards.map((card: ClickToPayCard) => (
            <TouchableOpacity
              key={card.id}
              style={[
                styles.cardItem,
                selectedCardId === card.id && styles.cardItemSelected,
              ]}
              onPress={() => {
                setSelectedCardId(card.id);
                setUseNewCard(false);
              }}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.cardBrand}>{card.brand.toUpperCase()}</Text>
                {selectedCardId === card.id && (
                  <Text style={styles.selectedBadge}>✓ Selected</Text>
                )}
              </View>
              <Text style={styles.cardNumber}>•••• {card.maskedPan}</Text>
              <Text style={styles.cardExpiry}>
                Expires: {card.expiryMonth}/{card.expiryYear}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {useNewCard && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>New Card Details</Text>

          <Text style={styles.label}>Card Number</Text>
          <TextInput
            style={styles.input}
            value={cardNumber}
            onChangeText={setCardNumber}
            placeholder="4111111111111111"
            keyboardType="number-pad"
          />

          <View style={styles.row}>
            <View style={styles.halfWidth}>
              <Text style={styles.label}>Expiry Month</Text>
              <TextInput
                style={styles.input}
                value={expiryMonth}
                onChangeText={setExpiryMonth}
                placeholder="12"
                keyboardType="number-pad"
                maxLength={2}
              />
            </View>
            <View style={styles.halfWidth}>
              <Text style={styles.label}>Expiry Year</Text>
              <TextInput
                style={styles.input}
                value={expiryYear}
                onChangeText={setExpiryYear}
                placeholder="2025"
                keyboardType="number-pad"
                maxLength={4}
              />
            </View>
          </View>

          <View style={styles.row}>
            <View style={styles.halfWidth}>
              <Text style={styles.label}>CVV</Text>
              <TextInput
                style={styles.input}
                value={cvv}
                onChangeText={setCvv}
                placeholder="123"
                keyboardType="number-pad"
                maxLength={4}
                secureTextEntry
              />
            </View>
            <View style={styles.halfWidth}>
              <Text style={styles.label}>Cardholder Name</Text>
              <TextInput
                style={styles.input}
                value={cardholderName}
                onChangeText={setCardholderName}
                placeholder="John Doe"
              />
            </View>
          </View>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>4. Checkout</Text>

        <Text style={styles.label}>Amount</Text>
        <TextInput
          style={styles.input}
          value={amount}
          onChangeText={setAmount}
          placeholder="99.99"
          keyboardType="decimal-pad"
        />

        <Text style={styles.label}>Currency</Text>
        <TextInput
          style={styles.input}
          value={currency}
          onChangeText={setCurrency}
          placeholder="USD"
        />

        <Text style={styles.label}>Order ID</Text>
        <TextInput
          style={styles.input}
          value={orderId}
          onChangeText={setOrderId}
          placeholder="order-123"
        />

        {!useNewCard && cards.length > 0 && (
          <TouchableOpacity
            style={[styles.button, styles.secondaryButton]}
            onPress={() => setUseNewCard(true)}
          >
            <Text style={styles.buttonText}>Use New Card Instead</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[
            styles.button,
            styles.checkoutButton,
            (!isInitialized || (!selectedCardId && !useNewCard)) &&
              styles.buttonDisabled,
          ]}
          onPress={handleCheckout}
          disabled={
            !isInitialized || isLoading || (!selectedCardId && !useNewCard)
          }
        >
          <Text style={styles.buttonText}>
            {isLoading ? 'Processing...' : `Checkout ${currency} ${amount}`}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Status</Text>
        <Text style={styles.statusText}>
          SDK: {isInitialized ? '✓ Initialized' : '✗ Not Initialized'}
        </Text>
        <Text style={styles.statusText}>
          Loading: {isLoading ? 'Yes' : 'No'}
        </Text>
        <Text style={styles.statusText}>Cards: {cards.length}</Text>
        <Text style={styles.statusText}>Provider: {provider}</Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  section: {
    backgroundColor: '#fff',
    margin: 10,
    padding: 15,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.22,
    shadowRadius: 2.22,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#555',
    marginBottom: 5,
    marginTop: 10,
  },
  input: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    padding: 10,
    fontSize: 14,
    color: '#333',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
  },
  providerToggle: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  providerButton: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 6,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#ddd',
  },
  providerButtonActive: {
    backgroundColor: '#28a745',
    borderColor: '#28a745',
  },
  providerButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  providerButtonTextActive: {
    color: '#fff',
  },
  cardItem: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 6,
    marginBottom: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#007bff',
  },
  cardItemSelected: {
    backgroundColor: '#e3f2fd',
    borderLeftColor: '#28a745',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  cardBrand: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007bff',
  },
  selectedBadge: {
    fontSize: 12,
    fontWeight: '600',
    color: '#28a745',
  },
  cardNumber: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 2,
  },
  cardExpiry: {
    fontSize: 12,
    color: '#666',
  },
  button: {
    backgroundColor: '#007bff',
    padding: 12,
    borderRadius: 6,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
  },
  secondaryButton: {
    backgroundColor: '#6c757d',
  },
  checkoutButton: {
    backgroundColor: '#28a745',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    marginTop: 10,
    fontStyle: 'italic',
  },
  statusText: {
    fontSize: 14,
    color: '#333',
    marginBottom: 5,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  halfWidth: {
    flex: 1,
  },
  cookieSection: {
    borderLeftWidth: 4,
    borderLeftColor: '#ff9800',
  },
  helperText: {
    fontSize: 12,
    color: '#999',
    marginBottom: 5,
    fontStyle: 'italic',
  },
  multilineInput: {
    minHeight: 70,
    textAlignVertical: 'top',
  },
  readOnlyInput: {
    backgroundColor: '#f0f0f0',
    color: '#666',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  halfButton: {
    flex: 1,
    marginTop: 0,
  },
  dangerButton: {
    backgroundColor: '#dc3545',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 15,
    marginBottom: 5,
  },
  statusLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#555',
    marginRight: 10,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    fontSize: 12,
    fontWeight: '600',
  },
  statusBadgeActive: {
    backgroundColor: '#d4edda',
    color: '#155724',
  },
  statusBadgeInactive: {
    backgroundColor: '#f8d7da',
    color: '#721c24',
  },
  cookiePreview: {
    fontSize: 12,
    color: '#666',
    backgroundColor: '#f8f9fa',
    padding: 8,
    borderRadius: 4,
    marginTop: 5,
    fontFamily: 'monospace',
  },
});

export default App;
