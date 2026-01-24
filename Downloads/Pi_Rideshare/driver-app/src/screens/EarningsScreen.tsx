import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { API_BASE_URL } from '../config/api.config';
import { StorageKeys } from '../constants/StorageKeys';

interface EarningsSummary {
  totalEarnings: number;
  totalPayouts: number;
  availableBalance: number;
  summary: {
    today: number;
    week: number;
    month: number;
    trips: number;
  };
}

interface Payout {
  id: string;
  amount: number;
  fee: number;
  net_amount: number;
  status: string;
  initiated_at: string;
}

interface PayoutMethod {
  id: string;
  method_type: string;
  account_name: string;
  account_number_masked: string;
  is_default: boolean;
}

const EarningsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [earnings, setEarnings] = useState<EarningsSummary | null>(null);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [payoutMethods, setPayoutMethods] = useState<PayoutMethod[]>([]);
  const [processingPayout, setProcessingPayout] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem(StorageKeys.AUTH_TOKEN);
      if (!token) {
        console.log('No auth token');
        return;
      }

      // Fetch earnings summary
      const earningsRes = await fetch(`${API_BASE_URL}/api/driver/earnings`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (earningsRes.ok) {
        const earningsData = await earningsRes.json();
        setEarnings(earningsData);
      }

      // Fetch payout history
      const payoutsRes = await fetch(`${API_BASE_URL}/api/driver/payouts`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (payoutsRes.ok) {
        const payoutsData = await payoutsRes.json();
        setPayouts(payoutsData.payouts || []);
      }

      // Fetch payout methods
      const methodsRes = await fetch(`${API_BASE_URL}/api/driver/payout-methods`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (methodsRes.ok) {
        const methodsData = await methodsRes.json();
        setPayoutMethods(methodsData.methods || []);
      }
    } catch (error) {
      console.log('Error fetching earnings data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const getDefaultPayoutMethod = (): PayoutMethod | undefined => {
    return payoutMethods.find(m => m.is_default) || payoutMethods[0];
  };

  const requestPayout = async (payoutType: 'instant' | 'weekly') => {
    const availableBalance = earnings?.availableBalance || 0;
    
    if (availableBalance < 1) {
      Alert.alert('Insufficient Balance', 'You need at least $1.00 to cash out.');
      return;
    }

    const defaultMethod = getDefaultPayoutMethod();
    if (!defaultMethod) {
      Alert.alert(
        'No Payout Method',
        'Please add a bank account or debit card first.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Add Method', onPress: () => navigation.navigate('PayoutMethods') },
        ]
      );
      return;
    }

    const fee = payoutType === 'instant' ? 0.50 : 0;
    const netAmount = availableBalance - fee;
    const timeframe = payoutType === 'instant' ? 'within minutes' : 'at end of week';

    Alert.alert(
      `${payoutType === 'instant' ? 'Instant' : 'Weekly'} Cash Out`,
      `Amount: $${availableBalance.toFixed(2)}\nFee: $${fee.toFixed(2)}\nYou'll receive: $${netAmount.toFixed(2)}\n\nDeposited to: ${defaultMethod.account_name} (${defaultMethod.account_number_masked})\n\nFunds arrive ${timeframe}.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: () => processPayout(payoutType, availableBalance, defaultMethod.id),
        },
      ]
    );
  };

  const processPayout = async (
    payoutType: 'instant' | 'weekly',
    amount: number,
    payoutMethodId: string
  ) => {
    setProcessingPayout(true);

    try {
      const token = await AsyncStorage.getItem(StorageKeys.AUTH_TOKEN);
      if (!token) return;

      const response = await fetch(`${API_BASE_URL}/api/driver/payouts`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount,
          payoutMethodId,
          payoutType,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        Alert.alert(
          'Success',
          payoutType === 'instant'
            ? 'Your instant payout is being processed. Funds will arrive within minutes.'
            : 'Your weekly payout has been scheduled. Funds will be deposited at end of week.'
        );
        fetchData(); // Refresh data
      } else {
        const error = await response.json();
        Alert.alert('Error', error.error || 'Failed to process payout');
      }
    } catch (error) {
      console.log('Payout error:', error);
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setProcessingPayout(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return '#4ADE80';
      case 'pending':
        return '#FBBF24';
      case 'scheduled':
        return '#60A5FA';
      case 'failed':
        return '#EF4444';
      default:
        return '#94A3B8';
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4ADE80" />
          <Text style={styles.loadingText}>Loading earnings...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const availableBalance = earnings?.availableBalance || 0;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Earnings</Text>
        <TouchableOpacity
          onPress={() => navigation.navigate('PayoutMethods')}
          style={styles.settingsButton}
        >
          <Text style={styles.settingsButtonText}>🏦</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Available Balance Card */}
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Available Balance</Text>
          <Text style={styles.balanceAmount}>${availableBalance.toFixed(2)}</Text>
          
          {/* Cash Out Buttons */}
          <View style={styles.cashOutButtons}>
            <TouchableOpacity
              style={[styles.cashOutButton, styles.instantButton]}
              onPress={() => requestPayout('instant')}
              disabled={processingPayout || availableBalance < 1}
            >
              {processingPayout ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <>
                  <Text style={styles.cashOutButtonTitle}>Instant</Text>
                  <Text style={styles.cashOutButtonFee}>$0.50 fee</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.cashOutButton, styles.weeklyButton]}
              onPress={() => requestPayout('weekly')}
              disabled={processingPayout || availableBalance < 1}
            >
              <Text style={styles.cashOutButtonTitle}>Weekly</Text>
              <Text style={styles.cashOutButtonFee}>No fee</Text>
            </TouchableOpacity>
          </View>

          {payoutMethods.length === 0 && (
            <TouchableOpacity
              style={styles.addMethodPrompt}
              onPress={() => navigation.navigate('PayoutMethods')}
            >
              <Text style={styles.addMethodPromptText}>
                + Add bank account to cash out
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Earnings Summary */}
        <View style={styles.summaryCard}>
          <Text style={styles.sectionTitle}>Earnings Summary</Text>
          <View style={styles.summaryGrid}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>
                ${(earnings?.summary?.today || 0).toFixed(2)}
              </Text>
              <Text style={styles.summaryLabel}>Today</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>
                ${(earnings?.summary?.week || 0).toFixed(2)}
              </Text>
              <Text style={styles.summaryLabel}>This Week</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>
                ${(earnings?.summary?.month || 0).toFixed(2)}
              </Text>
              <Text style={styles.summaryLabel}>This Month</Text>
            </View>
          </View>
          <View style={styles.tripsRow}>
            <Text style={styles.tripsLabel}>Total Trips</Text>
            <Text style={styles.tripsValue}>{earnings?.summary?.trips || 0}</Text>
          </View>
        </View>

        {/* Lifetime Stats */}
        <View style={styles.lifetimeCard}>
          <View style={styles.lifetimeRow}>
            <Text style={styles.lifetimeLabel}>Total Earned</Text>
            <Text style={styles.lifetimeValue}>
              ${(earnings?.totalEarnings || 0).toFixed(2)}
            </Text>
          </View>
          <View style={styles.lifetimeRow}>
            <Text style={styles.lifetimeLabel}>Total Cashed Out</Text>
            <Text style={styles.lifetimeValue}>
              ${(earnings?.totalPayouts || 0).toFixed(2)}
            </Text>
          </View>
        </View>

        {/* Recent Payouts */}
        <View style={styles.payoutsCard}>
          <Text style={styles.sectionTitle}>Recent Payouts</Text>
          {payouts.length === 0 ? (
            <Text style={styles.noPayoutsText}>No payouts yet</Text>
          ) : (
            payouts.slice(0, 5).map((payout) => (
              <View key={payout.id} style={styles.payoutItem}>
                <View style={styles.payoutLeft}>
                  <Text style={styles.payoutAmount}>
                    ${payout.net_amount.toFixed(2)}
                  </Text>
                  <Text style={styles.payoutDate}>
                    {formatDate(payout.initiated_at)}
                  </Text>
                </View>
                <View style={styles.payoutRight}>
                  <View
                    style={[
                      styles.payoutStatus,
                      { backgroundColor: getStatusColor(payout.status) + '20' },
                    ]}
                  >
                    <Text
                      style={[
                        styles.payoutStatusText,
                        { color: getStatusColor(payout.status) },
                      ]}
                    >
                      {payout.status.charAt(0).toUpperCase() + payout.status.slice(1)}
                    </Text>
                  </View>
                  {payout.fee > 0 && (
                    <Text style={styles.payoutFee}>-${payout.fee.toFixed(2)} fee</Text>
                  )}
                </View>
              </View>
            ))
          )}
        </View>

        {/* Bottom spacing */}
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#94A3B8',
    marginTop: 12,
    fontSize: 16,
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
  settingsButton: {
    padding: 8,
  },
  settingsButtonText: {
    fontSize: 24,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  balanceCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
  },
  balanceLabel: {
    color: '#94A3B8',
    fontSize: 14,
    marginBottom: 8,
  },
  balanceAmount: {
    color: '#4ADE80',
    fontSize: 48,
    fontWeight: '700',
    marginBottom: 24,
  },
  cashOutButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  cashOutButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  instantButton: {
    backgroundColor: '#4ADE80',
  },
  weeklyButton: {
    backgroundColor: '#3B82F6',
  },
  cashOutButtonTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  cashOutButtonFee: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    marginTop: 4,
  },
  addMethodPrompt: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#334155',
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
  },
  addMethodPromptText: {
    color: '#60A5FA',
    fontSize: 14,
    fontWeight: '500',
  },
  summaryCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  sectionTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
  },
  summaryGrid: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#334155',
  },
  summaryValue: {
    color: '#FFF',
    fontSize: 22,
    fontWeight: '700',
  },
  summaryLabel: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 4,
  },
  tripsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  tripsLabel: {
    color: '#94A3B8',
    fontSize: 14,
  },
  tripsValue: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  lifetimeCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  lifetimeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  lifetimeLabel: {
    color: '#94A3B8',
    fontSize: 14,
  },
  lifetimeValue: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  payoutsCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 20,
  },
  noPayoutsText: {
    color: '#64748B',
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 20,
  },
  payoutItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  payoutLeft: {},
  payoutAmount: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  payoutDate: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 4,
  },
  payoutRight: {
    alignItems: 'flex-end',
  },
  payoutStatus: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  payoutStatusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  payoutFee: {
    color: '#64748B',
    fontSize: 11,
    marginTop: 4,
  },
});

export default EarningsScreen;
