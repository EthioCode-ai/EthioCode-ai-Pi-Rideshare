import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import API_BASE_URL from '../config/api.config';

interface PaymentMethod {
  id: string;
  type: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
  isDefault: boolean;
}

const PaymentMethodsScreen = () => {
  const { colors, isDark } = useTheme();
  const { user } = useAuth();
  const navigation = useNavigation<any>();
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPaymentMethods();
  }, []);

  const fetchPaymentMethods = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/rider/${user?.id}/payment-methods`);
      if (response.ok) {
        const data = await response.json();
        setMethods(data.paymentMethods || []);
      }
    } catch (error) {
      console.log('Could not fetch payment methods:', error);
    } finally {
      setLoading(false);
    }
  };

  const getCardIcon = (brand: string) => {
    switch (brand.toLowerCase()) {
      case 'visa': return '💳';
      case 'mastercard': return '💳';
      case 'amex': return '💳';
      case 'discover': return '💳';
      default: return '💳';
    }
  };

  const getCardColor = (brand: string) => {
    switch (brand.toLowerCase()) {
      case 'visa': return '#1A1F71';
      case 'mastercard': return '#EB001B';
      case 'amex': return '#006FCF';
      case 'discover': return '#FF6600';
      default: return '#333333';
    }
  };

  const handleSetDefault = async (methodId: string) => {
    try {
      await fetch(`${API_BASE_URL}/api/rider/${user?.id}/payment-methods/${methodId}/default`, {
        method: 'PUT',
      });
      setMethods(methods.map(m => ({ ...m, isDefault: m.id === methodId })));
    } catch (error) {
      Alert.alert('Error', 'Could not set default payment method');
    }
  };

  const handleDeleteMethod = (methodId: string, last4: string) => {
    Alert.alert(
      'Remove Card',
      `Are you sure you want to remove the card ending in ${last4}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await fetch(`${API_BASE_URL}/api/rider/${user?.id}/payment-methods/${methodId}`, {
                method: 'DELETE',
              });
              setMethods(methods.filter(m => m.id !== methodId));
            } catch (error) {
              Alert.alert('Error', 'Could not remove payment method');
            }
          }
        },
      ]
    );
  };

  const handleAddCard = () => {
    Alert.alert('Add Card', 'Card addition will be implemented with Stripe integration.');
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 20,
      paddingTop: 10,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)',
    },
    backButton: {
      padding: 8,
      marginRight: 12,
    },
    backText: {
      fontSize: 24,
      color: isDark ? '#FFFFFF' : '#1a1a2e',
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: isDark ? '#FFFFFF' : '#1a1a2e',
    },
    content: {
      flex: 1,
      padding: 20,
    },
    cardItem: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDark ? '#1a1a2e' : '#FFFFFF',
      padding: 16,
      borderRadius: 12,
      marginBottom: 12,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
      elevation: 2,
    },
    cardIconContainer: {
      width: 50,
      height: 34,
      borderRadius: 6,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 16,
    },
    cardIcon: {
      fontSize: 24,
    },
    cardInfo: {
      flex: 1,
    },
    cardNumber: {
      fontSize: 16,
      fontWeight: '700',
      color: isDark ? '#FFFFFF' : '#1a1a2e',
      marginBottom: 4,
    },
    cardExpiry: {
      fontSize: 14,
      color: isDark ? '#B0B0B0' : '#666666',
    },
    defaultBadge: {
      backgroundColor: '#10B981',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
      marginRight: 8,
    },
    defaultText: {
      fontSize: 12,
      fontWeight: '700',
      color: '#FFFFFF',
    },
    deleteButton: {
      padding: 8,
    },
    deleteText: {
      fontSize: 20,
      color: '#DC3545',
    },
    addButton: {
      backgroundColor: '#E67E22',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 16,
      borderRadius: 12,
      marginTop: 12,
    },
    addButtonText: {
      fontSize: 16,
      fontWeight: '700',
      color: '#FFFFFF',
      marginLeft: 8,
    },
    emptyState: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 60,
    },
    emptyIcon: {
      fontSize: 64,
      marginBottom: 16,
    },
    emptyText: {
      fontSize: 18,
      fontWeight: '600',
      color: isDark ? '#888888' : '#666666',
      marginBottom: 8,
    },
    emptySubtext: {
      fontSize: 14,
      color: isDark ? '#666666' : '#999999',
      textAlign: 'center',
      paddingHorizontal: 40,
    },
  });

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Payment Methods</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {methods.length === 0 && !loading ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>💳</Text>
            <Text style={styles.emptyText}>No payment methods</Text>
            <Text style={styles.emptySubtext}>
              Add a card to pay for your rides quickly and securely.
            </Text>
          </View>
        ) : (
          methods.map((method) => (
            <TouchableOpacity 
              key={method.id} 
              style={styles.cardItem}
              onPress={() => !method.isDefault && handleSetDefault(method.id)}
            >
              <View style={[styles.cardIconContainer, { backgroundColor: getCardColor(method.brand) }]}>
                <Text style={styles.cardIcon}>{getCardIcon(method.brand)}</Text>
              </View>
              <View style={styles.cardInfo}>
                <Text style={styles.cardNumber}>
                  {method.brand.charAt(0).toUpperCase() + method.brand.slice(1)} •••• {method.last4}
                </Text>
                <Text style={styles.cardExpiry}>
                  Expires {method.expMonth.toString().padStart(2, '0')}/{method.expYear.toString().slice(-2)}
                </Text>
              </View>
              {method.isDefault && (
                <View style={styles.defaultBadge}>
                  <Text style={styles.defaultText}>Default</Text>
                </View>
              )}
              <TouchableOpacity 
                style={styles.deleteButton} 
                onPress={() => handleDeleteMethod(method.id, method.last4)}
              >
                <Text style={styles.deleteText}>✕</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          ))
        )}

        <TouchableOpacity style={styles.addButton} onPress={handleAddCard}>
          <Text style={styles.addButtonText}>+ Add Payment Method</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

export default PaymentMethodsScreen;