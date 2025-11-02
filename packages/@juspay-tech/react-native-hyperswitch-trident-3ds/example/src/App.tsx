import { isAvailable } from '@juspay-tech/react-native-hyperswitch-trident-3ds';
import { Text, View, StyleSheet } from 'react-native';
import { useState, useEffect } from 'react';

export default function App() {
  const [status, setStatus] = useState<string>('Checking...');

  useEffect(() => {
    // Check if the native module is available
    if (isAvailable) {
      setStatus('Native module is properly linked and available!');
    } else {
      setStatus('Native module is not available. Please check the linking.');
    }
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Hyperswitch Trident 3DS</Text>
      <Text style={styles.status}>Status: {status}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  status: {
    fontSize: 16,
    textAlign: 'center',
  },
});
