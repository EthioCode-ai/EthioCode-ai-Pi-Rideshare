import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';

const NotificationSettingsScreen = () => {
  const { colors, isDark } = useTheme();
  const navigation = useNavigation<any>();

  const [settings, setSettings] = useState({
    rideUpdates: true,
    promotions: true,
    driverArrival: true,
    tripReceipts: true,
    safetyAlerts: true,
    newFeatures: false,
    sounds: true,
    vibration: true,
  });

  const toggleSetting = (key: keyof typeof settings) => {
    setSettings(prev => ({ ...prev, [key]: !prev[key] }));
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
    section: {
      marginBottom: 28,
    },
    sectionTitle: {
      fontSize: 13,
      fontWeight: '700',
      color: '#E67E22',
      marginBottom: 14,
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    settingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
    },
    settingLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    settingIcon: {
      fontSize: 22,
      marginRight: 16,
      width: 32,
      textAlign: 'center',
    },
    settingInfo: {
      flex: 1,
    },
    settingTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: isDark ? '#FFFFFF' : '#1a1a2e',
      marginBottom: 2,
    },
    settingDescription: {
      fontSize: 13,
      color: isDark ? '#888888' : '#888888',
    },
  });

  const SettingItem = ({ 
    icon, 
    title, 
    description, 
    value, 
    onToggle 
  }: { 
    icon: string; 
    title: string; 
    description: string; 
    value: boolean; 
    onToggle: () => void;
  }) => (
    <View style={styles.settingRow}>
      <View style={styles.settingLeft}>
        <Text style={styles.settingIcon}>{icon}</Text>
        <View style={styles.settingInfo}>
          <Text style={styles.settingTitle}>{title}</Text>
          <Text style={styles.settingDescription}>{description}</Text>
        </View>
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: '#D1D5DB', true: '#E67E22' }}
        thumbColor="#ffffff"
      />
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Ride Notifications</Text>
          
          <SettingItem
            icon="🚗"
            title="Ride Updates"
            description="Status changes for your rides"
            value={settings.rideUpdates}
            onToggle={() => toggleSetting('rideUpdates')}
          />
          
          <SettingItem
            icon="📍"
            title="Driver Arrival"
            description="When your driver is nearby"
            value={settings.driverArrival}
            onToggle={() => toggleSetting('driverArrival')}
          />
          
          <SettingItem
            icon="🧾"
            title="Trip Receipts"
            description="Email receipts after each ride"
            value={settings.tripReceipts}
            onToggle={() => toggleSetting('tripReceipts')}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Other Notifications</Text>
          
          <SettingItem
            icon="🛡️"
            title="Safety Alerts"
            description="Important safety information"
            value={settings.safetyAlerts}
            onToggle={() => toggleSetting('safetyAlerts')}
          />
          
          <SettingItem
            icon="🎁"
            title="Promotions"
            description="Deals, discounts, and offers"
            value={settings.promotions}
            onToggle={() => toggleSetting('promotions')}
          />
          
          <SettingItem
            icon="✨"
            title="New Features"
            description="Updates about new app features"
            value={settings.newFeatures}
            onToggle={() => toggleSetting('newFeatures')}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sound & Vibration</Text>
          
          <SettingItem
            icon="🔊"
            title="Sounds"
            description="Play notification sounds"
            value={settings.sounds}
            onToggle={() => toggleSetting('sounds')}
          />
          
          <SettingItem
            icon="📳"
            title="Vibration"
            description="Vibrate on notifications"
            value={settings.vibration}
            onToggle={() => toggleSetting('vibration')}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default NotificationSettingsScreen;