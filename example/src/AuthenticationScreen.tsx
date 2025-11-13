import {
    isAvailable,
    initializeThreeDS,
    generateAReqParams,
    recieveChallengeParamsFromRN,
    generateChallenge,
    threeDSProvider
} from '@juspay-tech/react-native-hyperswitch-3ds';
import { Text, View, StyleSheet, Button, ScrollView, Platform } from 'react-native';
import { useState } from 'react';

export default function AuthenticationScreen() {
    const [threeDsResult, setThreeDsResult] = useState<string>('');
    const [aReqResult, setAReqResult] = useState<string>('');
    const [challengeParamsResult, setChallengeParamsResult] = useState<string>('');
    const [challengeResult, setChallengeResult] = useState<string>('');

    const handleInitThreeDs = () => {
        try {
            const configuration = {
                provider: threeDSProvider.trident,
                publishableKey: "pk_snd_test",
            };

            initializeThreeDS(configuration, 'sandbox', (status) => {
                console.log('3DS Status:', status);
                setThreeDsResult(`Status: ${status.status}\nMessage: ${status.message}`);
            });
        } catch (error) {
            setThreeDsResult(`Error: ${error}`);
            console.error('Failed to initialize 3DS session:', error);
        }
    };

    const handleGenerateAReqParams = () => {
        try {
            const messageVersion = '2.1.0';
            const directoryServerId = 'A0000001';
            const cardBrand = 'visa';

            generateAReqParams(
                messageVersion,
                (status, aReqParams) => {
                    const result = `Status: ${status.status}\nMessage: ${status.message}\n\nAReq Params:\n${JSON.stringify(aReqParams, null, 2)}`;
                    setAReqResult(result);
                },
                directoryServerId,
                cardBrand
            );
        } catch (error) {
            setAReqResult(`Error: ${error}`);
        }
    };

    const handleReceiveChallengeParams = () => {
        try {
            const acsSignedContent = 'test_acs_signed_content';
            const acsRefNumber = 'test_acs_ref_number';
            const acsTransactionId = 'test_acs_transaction_id';
            const threeDSRequestorAppURL = 'hyperswitch://challenge';
            const threeDSServerTransId = 'test_server_trans_id';

            recieveChallengeParamsFromRN(
                acsSignedContent,
                acsRefNumber,
                acsTransactionId,
                threeDSRequestorAppURL,
                threeDSServerTransId,
                (status) => {
                    setChallengeParamsResult(`Status: ${status.status}\nMessage: ${status.message}`);
                }
            );
        } catch (error) {
            setChallengeParamsResult(`Error: ${error}`);
        }
    };

    const handleGenerateChallenge = () => {
        try {
            generateChallenge((status) => {
                setChallengeResult(`Status: ${status.status}\nMessage: ${status.message}`);
            });
        } catch (error) {
            setChallengeResult(`Error: ${error}`);
        }
    };

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
            <Text style={styles.headerText}>Hyperswitch Auth Module Test</Text>
            <Text style={styles.infoText}>Module Available: {isAvailable ? '✓ Yes' : '✗ No'}</Text>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>1. Initialize 3DS Session</Text>
                <Button
                    title="Initialize 3DS"
                    onPress={handleInitThreeDs}
                />
                {threeDsResult ? (
                    <Text style={styles.resultText}>{threeDsResult}</Text>
                ) : null}
            </View>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>2. Generate AReq Params</Text>
                <Button
                    title="Generate AReq Params"
                    onPress={handleGenerateAReqParams}
                />
                {aReqResult ? (
                    <Text style={styles.resultText}>{aReqResult}</Text>
                ) : null}
            </View>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>3. Receive Challenge Params</Text>
                <Button
                    title="Receive Challenge Params"
                    onPress={handleReceiveChallengeParams}
                />
                {challengeParamsResult ? (
                    <Text style={styles.resultText}>{challengeParamsResult}</Text>
                ) : null}
            </View>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>4. Generate Challenge</Text>
                <Button
                    title="Generate Challenge"
                    onPress={handleGenerateChallenge}
                />
                {challengeResult ? (
                    <Text style={styles.resultText}>{challengeResult}</Text>
                ) : null}
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    contentContainer: {
        padding: 20,
        paddingTop: 50,
    },
    headerText: {
        fontSize: 24,
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: 10,
        color: '#333',
    },
    infoText: {
        fontSize: 16,
        textAlign: 'center',
        marginBottom: 20,
        color: '#666',
    },
    section: {
        marginBottom: 30,
        padding: 15,
        backgroundColor: '#f8f8f8',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#e0e0e0',
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 10,
        color: '#333',
    },
    resultText: {
        marginTop: 10,
        padding: 12,
        backgroundColor: '#fff',
        borderRadius: 5,
        borderWidth: 1,
        borderColor: '#ddd',
        fontSize: 12,
        fontFamily: Platform.select({ ios: 'Courier', android: 'monospace' }),
        color: '#333',
    },
});
