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
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { API_BASE_URL } from '../config/api.config';
import { StorageKeys } from '../constants/StorageKeys';

interface PayoutMethod {
  id: string;
  method_type: string;
  account_name: string;
  account_number_masked: string;
  routing_number_masked: string;
  is_default: boolean;
  is_verified: boolean;
  created_at: string;
}

const PayoutMethodsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [methods, setMethods] = useState<PayoutMethod[]>([]);
  const [settingDefault, setSettingDefault] = useState<string | null>(null);

  const fetchMethods = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem(StorageKeys.AUTH_TOKEN);
      if (!token) {
        console.log('No auth token');
        return;
      }

      const response = await fetch(`${API_BASE_URL}/api/driver/payout-methods`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setMethods(data.methods || []);
      }
    } catch (error) {
      console.log('Error fetching payout methods:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchMethods();
  }, [fetchMethods]);

  // Refresh when screen comes into focus (after adding new method)
  useFocusEffect(
    useCallback(() => {
      fetchMethods();
    }, [fetchMethods])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchMethods();
  };

  const setDefaultMethod = async (methodId: string) => {
    setSettingDefault(methodId);

    try {
      const token = await AsyncStorage.getItem(StorageKeys.AUTH_TOKEN);
      if (!token) return;

      const response = await fetch(
        `${API_BASE_URL}/api/driver/payout-methods/${methodId}/default`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.ok) {
        // Update local state
        setMethods((prev) =>
          prev.map((m) => ({
            ...m,
            is_default: m.id === methodId,
          }))
        );
      } else {
        Alert.alert('Error', 'Failed to set default method');
      }
    } catch (error) {
      console.log('Set default error:', error);
      Alert.alert('Error', 'Something went wrong');
    } finally {
      setSettingDefault(null);
    }
  };

  const confirmDelete = (method: PayoutMethod) => {
    Alert.alert(
      'Remove Payment Method',
      `Are you sure you want to remove ${method.account_name} (${method.account_number_masked})?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => deleteMethod(method.id),
        },
      ]
    );
  };

  const deleteMethod = async (methodId: string) => {
    try {
      const token = await AsyncStorage.getItem(StorageKeys.AUTH_TOKEN);
      if (!token) return;

      const response = await fetch(
        `${API_BASE_URL}/api/driver/payout-methods/${methodId}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (response.ok) {
        setMethods((prev) => prev.filter((m) => m.id !== methodId));
        Alert.alert('Success', 'Payment method removed');
      } else {
        Alert.alert('Error', 'Failed to remove payment method');
      }
    } catch (error) {
      console.log('Delete error:', error);
      Alert.alert('Error', 'Something went wrong');
    }
  };

  const getMethodIcon = (type: string) => {
    switch (type?.toLowerCase()) {
      case 'bank':
      case 'bank_account':
        return '🏦';
      case 'debit':
      case 'debit_card':
        return '💳';
      default:
        return '💰';
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4ADE80" />
          <Text style={styles.loadingText}>Loading payment methods...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Payment Methods</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Add New Method Button */}
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => navigation.navigate('AddPayoutMethod')}
        >
          <Text style={styles.addButtonIcon}>+</Text>
          <Text style={styles.addButtonText}>Add Bank Account</Text>
        </TouchableOpacity>

        {/* Methods List */}
        {methods.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🏦</Text>
            <Text style={styles.emptyTitle}>No Payment Methods</Text>
            <Text style={styles.emptySubtitle}>
              Add a bank account to receive your earnings
            </Text>
          </View>
        ) : (
          <View style={styles.methodsList}>
            {methods.map((method) => (
              <View key={method.id} style={styles.methodCard}>
                <View style={styles.methodMain}>
                  <Text style={styles.methodIcon}>{getMethodIcon(method.method_type)}</Text>
                  <View style={styles.methodInfo}>
                    <Text style={styles.methodName}>{method.account_name}</Text>
                    <Text style={styles.methodNumber}>{method.account_number_masked}</Text>
                    {method.routing_number_masked && (
                      <Text style={styles.methodRouting}>
                        Routing: {method.routing_number_masked}
                      </Text>
                    )}
                  </View>
                  {method.is_default && (
                    <View style={styles.defaultBadge}>
                      <Text style={styles.defaultBadgeText}>Default</Text>
                    </View>
                  )}
                </View>

                <View style={styles.methodActions}>
                  {!method.is_default && (
                    <TouchableOpacity
                      style={styles.setDefaultButton}
                      onPress={() => setDefaultMethod(method.id)}
                      disabled={settingDefault === method.id}
                    >
                      {settingDefault === method.id ? (
                        <ActivityIndicator size="small" color="#4ADE80" />
                      ) : (
                        <Text style={styles.setDefaultText}>Set as Default</Text>
                      )}
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() => confirmDelete(method)}
                  >
                    <Text style={styles.deleteButtonText}>Remove</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Info Section */}
        <View style={styles.infoSection}>
          <Text style={styles.infoTitle}>About Payouts</Text>
          <View style={styles.infoItem}>
            <Text style={styles.infoIcon}>⚡</Text>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Instant Payout</Text>
              <Text style={styles.infoDescription}>
                Receive funds within minutes. $0.50 fee applies.
              </Text>
            </View>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoIcon}>📅</Text>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Weekly Payout</Text>
              <Text style={styles.infoDescription}>
                Free automatic deposit every Monday for the previous week's earnings.
              </Text>
            </View>
          </View>
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
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: '#334155',
    borderStyle: 'dashed',
    marginBottom: 20,
  },
  addButtonIcon: {
    color: '#4ADE80',
    fontSize: 24,
    fontWeight: '600',
    marginRight: 8,
  },
  addButtonText: {
    color: '#4ADE80',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptySubtitle: {
    color: '#64748B',
    fontSize: 14,
    textAlign: 'center',
  },
  methodsList: {
    gap: 12,
  },
  methodCard: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  methodMain: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  methodIcon: {
    fontSize: 32,
    marginRight: 12,
  },
  methodInfo: {
    flex: 1,
  },
  methodName: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  methodNumber: {
    color: '#94A3B8',
    fontSize: 14,
    marginTop: 2,
  },
  methodRouting: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 2,
  },
  defaultBadge: {
    backgroundColor: '#4ADE8020',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  defaultBadgeText: {
    color: '#4ADE80',
    fontSize: 12,
    fontWeight: '600',
  },
  methodActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#334155',
    gap: 12,
  },
  setDefaultButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#334155',
    borderRadius: 8,
  },
  setDefaultText: {
    color: '#4ADE80',
    fontSize: 14,
    fontWeight: '500',
  },
  deleteButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  deleteButtonText: {
    color: '#EF4444',
    fontSize: 14,
    fontWeight: '500',
  },
  infoSection: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
  },
  infoTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
  },
  infoItem: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  infoIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  infoDescription: {
    color: '#64748B',
    fontSize: 13,
    marginTop: 4,
    lineHeight: 18,
  },
});

export default PayoutMethodsScreen;
