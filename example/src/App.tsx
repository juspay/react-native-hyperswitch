import { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { HyperProvider } from '@juspay-tech/react-native-hyperswitch';
import PaymentScreen from './PaymentScreen';
import AuthenticationScreen from './AuthenticationScreen';

type Screen = 'payment' | 'authentication';

export default function App() {
  const [activeScreen, setActiveScreen] = useState<Screen>('payment');

  return (
    <HyperProvider
      publishableKey={process.env.HYPERSWITCH_PUBLISHABLE_KEY || ''}
    >
      <View style={styles.container}>
        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tab, activeScreen === 'payment' && styles.activeTab]}
            onPress={() => setActiveScreen('payment')}
          >
            <Text style={[styles.tabText, activeScreen === 'payment' && styles.activeTabText]}>
              Payment
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeScreen === 'authentication' && styles.activeTab]}
            onPress={() => setActiveScreen('authentication')}
          >
            <Text style={[styles.tabText, activeScreen === 'authentication' && styles.activeTabText]}>
              Authentication
            </Text>
          </TouchableOpacity>
        </View>
        <View style={styles.content}>
          {activeScreen === 'payment' ? <PaymentScreen /> : <AuthenticationScreen />}
        </View>
      </View>
    </HyperProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    paddingTop: 50,
  },
  tab: {
    flex: 1,
    paddingVertical: 15,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#007AFF',
  },
  tabText: {
    fontSize: 16,
    color: '#666',
  },
  activeTabText: {
    color: '#007AFF',
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
});
