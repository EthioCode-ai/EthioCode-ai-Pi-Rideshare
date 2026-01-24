import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { create, open, LinkExit, LinkSuccess } from 'react-native-plaid-link-sdk';
import { API_BASE_URL } from '../config/api.config';
import { StorageKeys } from '../constants/StorageKeys';

const AddPayoutMethodScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const [loading, setLoading] = useState(false);
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [loadingLinkToken, setLoadingLinkToken] = useState(true);
  const [showManualEntry, setShowManualEntry] = useState(false);
  
  // Manual entry fields
  const [accountName, setAccountName] = useState('');
  const [routingNumber, setRoutingNumber] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [confirmAccountNumber, setConfirmAccountNumber] = useState('');

// Fetch Plaid link token on mount
  useEffect(() => {
    fetchLinkToken();
  }, []);

 
  const fetchLinkToken = async () => {
    try {
      const token = await AsyncStorage.getItem(StorageKeys.AUTH_TOKEN);
      if (!token) {
        setLoadingLinkToken(false);
        return;
      }

      const response = await fetch(`${API_BASE_URL}/api/plaid/create-link-token`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setLinkToken(data.link_token);
        console.log('✅ Plaid link token received');
      } else {
        console.log('❌ Failed to get link token');
      }
    } catch (error) {
      console.log('Error fetching link token:', error);
    } finally {
      setLoadingLinkToken(false);
    }
  };

  const openPlaidLink = () => {
    if (!linkToken) {
      Alert.alert('Error', 'Unable to connect to Plaid. Please try again.');
      return;
    }

    try {
      create({ token: linkToken });
      open({
        onSuccess: (success: LinkSuccess) => {
          handlePlaidSuccess(success);
        },
        onExit: (exit: LinkExit) => {
          console.log('Plaid Link exit:', exit);
          if (exit.error) {
            console.log('Plaid error:', exit.error);
          }
        },
      });
    } catch (error) {
      console.log('Plaid open error:', error);
      Alert.alert('Error', 'Failed to open bank connection. Please try again.');
    }
  };

  const handlePlaidSuccess = async (success: LinkSuccess) => {
    console.log('✅ Plaid Link success:', success);
    setLoading(true);

    try {
      const token = await AsyncStorage.getItem(StorageKeys.AUTH_TOKEN);
      if (!token) return;

      // Step 1: Exchange public token
      const exchangeResponse = await fetch(`${API_BASE_URL}/api/plaid/exchange-public-token`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          public_token: success.publicToken,
          metadata: success.metadata,
        }),
      });

      if (!exchangeResponse.ok) {
        throw new Error('Failed to exchange token');
      }

      // Step 2: Get accounts
      const accountsResponse = await fetch(`${API_BASE_URL}/api/plaid/accounts`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!accountsResponse.ok) {
        throw new Error('Failed to fetch accounts');
      }

      const accountsData = await accountsResponse.json();
      
      if (accountsData.accounts && accountsData.accounts.length > 0) {
        // Step 3: Verify first account (creates payout method)
        const verifyResponse = await fetch(`${API_BASE_URL}/api/plaid/verify-account`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            accountId: accountsData.accounts[0].id,
          }),
        });

        if (verifyResponse.ok) {
          Alert.alert(
            'Success',
            'Bank account linked successfully!',
            [{ text: 'OK', onPress: () => navigation.goBack() }]
          );
        } else {
          throw new Error('Failed to verify account');
        }
      }
    } catch (error) {
      console.log('Plaid error:', error);
      Alert.alert('Error', 'Failed to link bank account. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handlePlaidExit = (exit: LinkExit) => {
    console.log('Plaid Link exit:', exit);
    if (exit.error) {
      console.log('Plaid error:', exit.error);
    }
  };

  const validateInputs = (): boolean => {
    if (!accountName.trim()) {
      Alert.alert('Missing Information', 'Please enter the account holder name.');
      return false;
    }

    if (routingNumber.length !== 9) {
      Alert.alert('Invalid Routing Number', 'Routing number must be 9 digits.');
      return false;
    }

    if (accountNumber.length < 4 || accountNumber.length > 17) {
      Alert.alert('Invalid Account Number', 'Account number must be between 4 and 17 digits.');
      return false;
    }

    if (accountNumber !== confirmAccountNumber) {
      Alert.alert('Account Numbers Don\'t Match', 'Please make sure both account numbers match.');
      return false;
    }

    return true;
  };

  const handleManualSubmit = async () => {
    if (!validateInputs()) return;

    setLoading(true);

    try {
      const token = await AsyncStorage.getItem(StorageKeys.AUTH_TOKEN);
      if (!token) {
        Alert.alert('Error', 'Please log in again.');
        return;
      }

      const response = await fetch(`${API_BASE_URL}/api/driver/payout-methods`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          methodType: 'bank_account',
          accountName: accountName.trim(),
          routingNumber: routingNumber,
          accountNumber: accountNumber,
        }),
      });

      if (response.ok) {
        Alert.alert(
          'Success',
          'Bank account added successfully!',
          [
            {
              text: 'OK',
              onPress: () => navigation.goBack(),
            },
          ]
        );
      } else {
        const error = await response.json();
        Alert.alert('Error', error.error || 'Failed to add bank account.');
      }
    } catch (error) {
      console.log('Add payout method error:', error);
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const formatRoutingNumber = (text: string) => {
    const cleaned = text.replace(/\D/g, '');
    return cleaned.slice(0, 9);
  };

  const formatAccountNumber = (text: string) => {
    const cleaned = text.replace(/\D/g, '');
    return cleaned.slice(0, 17);
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add Bank Account</Text>
        <View style={styles.headerSpacer} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
          {/* Loading overlay */}
          {loading && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color="#4ADE80" />
              <Text style={styles.loadingText}>Linking account...</Text>
            </View>
          )}

          {/* Plaid Link Section */}
          {!showManualEntry && (
            <>
              <View style={styles.infoBanner}>
                <Text style={styles.infoBannerIcon}>🔒</Text>
                <Text style={styles.infoBannerText}>
                  Securely link your bank account through Plaid. Your credentials are never shared with us.
                </Text>
              </View>

              {loadingLinkToken ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color="#4ADE80" />
                  <Text style={styles.loadingSubText}>Preparing secure connection...</Text>
                </View>
              ) : linkToken ? (
                <TouchableOpacity style={styles.plaidButton} onPress={openPlaidLink}>
                  <Text style={styles.plaidButtonIcon}>🏦</Text>
                  <Text style={styles.plaidButtonText}>Link Bank Account</Text>
                  <Text style={styles.plaidButtonSubtext}>Instant verification with Plaid</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.errorContainer}>
                  <Text style={styles.errorText}>Unable to connect to Plaid</Text>
                  <TouchableOpacity onPress={fetchLinkToken} style={styles.retryButton}>
                    <Text style={styles.retryButtonText}>Retry</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Divider */}
              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>OR</Text>
                <View style={styles.dividerLine} />
              </View>

              {/* Manual Entry Toggle */}
              <TouchableOpacity
                style={styles.manualEntryButton}
                onPress={() => setShowManualEntry(true)}
              >
                <Text style={styles.manualEntryButtonText}>Enter account details manually</Text>
              </TouchableOpacity>
            </>
          )}

          {/* Manual Entry Form */}
          {showManualEntry && (
            <>
              <TouchableOpacity
                style={styles.backToPlaidButton}
                onPress={() => setShowManualEntry(false)}
              >
                <Text style={styles.backToPlaidText}>← Back to Plaid Link</Text>
              </TouchableOpacity>

              <View style={styles.infoBanner}>
                <Text style={styles.infoBannerIcon}>📝</Text>
                <Text style={styles.infoBannerText}>
                  Enter your bank account details manually. Make sure to double-check your routing and account numbers.
                </Text>
              </View>

              {/* Form */}
              <View style={styles.form}>
                {/* Account Holder Name */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Account Holder Name</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Full Name"
                    placeholderTextColor="#64748B"
                    value={accountName}
                    onChangeText={setAccountName}
                    autoCapitalize="words"
                    autoCorrect={false}
                  />
                  <Text style={styles.hint}>Name as it appears on your bank account</Text>
                </View>

                {/* Routing Number */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Routing Number</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="123456789"
                    placeholderTextColor="#64748B"
                    value={routingNumber}
                    onChangeText={(text) => setRoutingNumber(formatRoutingNumber(text))}
                    keyboardType="number-pad"
                    maxLength={9}
                  />
                  <Text style={styles.hint}>9-digit number found on your check</Text>
                </View>

                {/* Account Number */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Account Number</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="••••••••••••"
                    placeholderTextColor="#64748B"
                    value={accountNumber}
                    onChangeText={(text) => setAccountNumber(formatAccountNumber(text))}
                    keyboardType="number-pad"
                    maxLength={17}
                    secureTextEntry
                  />
                </View>

                {/* Confirm Account Number */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Confirm Account Number</Text>
                  <TextInput
                    style={[
                      styles.input,
                      confirmAccountNumber.length > 0 &&
                        confirmAccountNumber !== accountNumber &&
                        styles.inputError,
                    ]}
                    placeholder="••••••••••••"
                    placeholderTextColor="#64748B"
                    value={confirmAccountNumber}
                    onChangeText={(text) => setConfirmAccountNumber(formatAccountNumber(text))}
                    keyboardType="number-pad"
                    maxLength={17}
                    secureTextEntry
                  />
                  {confirmAccountNumber.length > 0 && confirmAccountNumber !== accountNumber && (
                    <Text style={styles.errorHint}>Account numbers don't match</Text>
                  )}
                </View>
              </View>

              {/* Check Diagram */}
              <View style={styles.checkDiagram}>
                <Text style={styles.checkDiagramTitle}>Where to find these numbers</Text>
                <View style={styles.checkImage}>
                  <Text style={styles.checkText}>┌─────────────────────────────────┐</Text>
                  <Text style={styles.checkText}>│  Your Name                      │</Text>
                  <Text style={styles.checkText}>│  123 Main St                    │</Text>
                  <Text style={styles.checkText}>│                                 │</Text>
                  <Text style={styles.checkText}>│                        $______  │</Text>
                  <Text style={styles.checkText}>│                                 │</Text>
                  <Text style={styles.checkText}>│  ⎣₁₂₃₄₅₆₇₈₉⎤ ⎣₀₀₁₂₃₄₅₆₇₈₉₀⎤      │</Text>
                  <Text style={styles.checkText}>│   ↑ Routing    ↑ Account        │</Text>
                  <Text style={styles.checkText}>└─────────────────────────────────┘</Text>
                </View>
              </View>

              {/* Submit Button */}
              <TouchableOpacity
                style={[
                  styles.submitButton,
                  loading && styles.submitButtonDisabled,
                ]}
                onPress={handleManualSubmit}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.submitButtonText}>Add Bank Account</Text>
                )}
              </TouchableOpacity>
            </>
          )}

          {/* Terms */}
          <Text style={styles.termsText}>
            By adding a bank account, you agree to our Terms of Service and authorize Pi VIP Rideshare to initiate deposits to this account.
          </Text>

          {/* Bottom spacing */}
          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    color: '#FFF',
    fontSize: 24,
  },
  headerTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '600',
  },
  headerSpacer: {
    width: 40,
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  loadingText: {
    color: '#FFF',
    fontSize: 16,
    marginTop: 12,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingSubText: {
    color: '#94A3B8',
    marginTop: 12,
    fontSize: 14,
  },
  infoBanner: {
    flexDirection: 'row',
    backgroundColor: '#1E3A5F',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    alignItems: 'center',
  },
  infoBannerIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  infoBannerText: {
    flex: 1,
    color: '#94A3B8',
    fontSize: 13,
    lineHeight: 18,
  },
  plaidButton: {
    backgroundColor: '#4ADE80',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
  },
  plaidButtonIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  plaidButtonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '700',
  },
  plaidButtonSubtext: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
    marginTop: 4,
  },
  errorContainer: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 14,
    marginBottom: 12,
  },
  retryButton: {
    backgroundColor: '#334155',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '500',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#334155',
  },
  dividerText: {
    color: '#64748B',
    paddingHorizontal: 16,
    fontSize: 14,
  },
  manualEntryButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  manualEntryButtonText: {
    color: '#60A5FA',
    fontSize: 14,
    fontWeight: '500',
  },
  backToPlaidButton: {
    marginBottom: 16,
  },
  backToPlaidText: {
    color: '#60A5FA',
    fontSize: 14,
  },
  form: {
    gap: 20,
  },
  inputGroup: {
    marginBottom: 4,
  },
  label: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    color: '#FFF',
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  inputError: {
    borderColor: '#EF4444',
  },
  hint: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 6,
  },
  errorHint: {
    color: '#EF4444',
    fontSize: 12,
    marginTop: 6,
  },
  checkDiagram: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    marginTop: 24,
    marginBottom: 24,
  },
  checkDiagramTitle: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  checkImage: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 12,
  },
  checkText: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 10,
    color: '#1E293B',
    lineHeight: 14,
  },
  submitButton: {
    backgroundColor: '#4ADE80',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  termsText: {
    color: '#64748B',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 18,
  },
});

export default AddPayoutMethodScreen;