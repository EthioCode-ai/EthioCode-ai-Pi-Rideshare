import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';

import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';

const AccountScreen = () => {
  const { colors, isDark, toggleTheme } = useTheme();
  const { user, logout } = useAuth();
  const navigation = useNavigation<any>();

  const handleMenuPress = (item: string) => {
    switch (item) {
      case 'savedPlaces':
        navigation.navigate('SavedPlaces');
        break;
      case 'paymentMethods':
        navigation.navigate('PaymentMethods');
        break;
      case 'notifications':
        navigation.navigate('NotificationSettings');
        break;
      case 'editProfile':
        navigation.navigate('EditProfile');
        break;
      case 'safety':
        navigation.navigate('Safety');
        break;
      case 'help':
        navigation.navigate('HelpSupport');
        break;
      default:
        Alert.alert('Coming Soon', 'This feature is under development.');
    }
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      padding: 24,
      paddingTop: 20,
      alignItems: 'center',
      borderBottomWidth: 1,
      borderBottomColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)',
    },
    avatar: {
      width: 88,
      height: 88,
      borderRadius: 44,
      backgroundColor: '#E67E22',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 14,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 4,
      elevation: 4,
    },
    avatarText: {
      fontSize: 32,
      fontWeight: '700',
      color: '#ffffff',
    },
    userName: {
      fontSize: 20,
      fontWeight: '700',
      color: isDark ? '#FFFFFF' : '#1a1a2e',
      marginBottom: 4,
    },
    userEmail: {
      fontSize: 15,
      fontWeight: '500',
      color: isDark ? '#B0B0B0' : '#555555',
    },
    section: {
      marginTop: 28,
      paddingHorizontal: 20,
    },
    sectionTitle: {
      fontSize: 13,
      fontWeight: '700',
      color: '#E67E22',
      marginBottom: 14,
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    menuItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
    },
    menuIcon: {
      fontSize: 22,
      marginRight: 16,
      width: 32,
      textAlign: 'center',
    },
    menuText: {
      flex: 1,
      fontSize: 16,
      fontWeight: '600',
      color: isDark ? '#FFFFFF' : '#1a1a2e',
    },
    menuArrow: {
      fontSize: 18,
      fontWeight: '600',
      color: isDark ? '#888888' : '#999999',
    },
    themeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
    },
    themeLeft: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    logoutButton: {
      marginTop: 32,
      marginBottom: 40,
      marginHorizontal: 20,
      backgroundColor: '#DC3545',
      paddingVertical: 16,
      borderRadius: 12,
      alignItems: 'center',
      shadowColor: '#DC3545',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
      elevation: 4,
    },
    logoutText: {
      fontSize: 16,
      fontWeight: '700',
      color: '#ffffff',
      letterSpacing: 0.5,
    },
  });

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {user?.firstName?.[0]?.toUpperCase()}{user?.lastName?.[0]?.toUpperCase()}
            </Text>
          </View>
          <Text style={styles.userName}>{user?.firstName} {user?.lastName}</Text>
          <Text style={styles.userEmail}>{user?.email}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Preferences</Text>

          <View style={styles.themeRow}>
            <View style={styles.themeLeft}>
              <Text style={styles.menuIcon}>🌙</Text>
              <Text style={styles.menuText}>Dark Mode</Text>
            </View>
            <Switch
              value={isDark}
              onValueChange={toggleTheme}
              trackColor={{ false: '#D1D5DB', true: '#E67E22' }}
              thumbColor="#ffffff"
            />
          </View>

          <TouchableOpacity style={styles.menuItem} onPress={() => handleMenuPress('savedPlaces')}>
            <Text style={styles.menuIcon}>🏠</Text>
            <Text style={styles.menuText}>Saved Places</Text>
            <Text style={styles.menuArrow}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={() => handleMenuPress('paymentMethods')}>
            <Text style={styles.menuIcon}>💳</Text>
            <Text style={styles.menuText}>Payment Methods</Text>
            <Text style={styles.menuArrow}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={() => handleMenuPress('notifications')}>
            <Text style={styles.menuIcon}>🔔</Text>
            <Text style={styles.menuText}>Notifications</Text>
            <Text style={styles.menuArrow}>›</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>

          <TouchableOpacity style={styles.menuItem} onPress={() => handleMenuPress('editProfile')}>
            <Text style={styles.menuIcon}>👤</Text>
            <Text style={styles.menuText}>Edit Profile</Text>
            <Text style={styles.menuArrow}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={() => handleMenuPress('safety')}>
            <Text style={styles.menuIcon}>🛡️</Text>
            <Text style={styles.menuText}>Safety</Text>
            <Text style={styles.menuArrow}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={() => handleMenuPress('help')}>
            <Text style={styles.menuIcon}>❓</Text>
            <Text style={styles.menuText}>Help & Support</Text>
            <Text style={styles.menuArrow}>›</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={logout}>
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

export default AccountScreen;