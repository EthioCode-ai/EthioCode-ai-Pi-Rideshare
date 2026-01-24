import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Linking, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';

const HelpSupportScreen = () => {
  const { colors, isDark } = useTheme();
  const navigation = useNavigation<any>();

  const handleContact = (method: string) => {
    switch (method) {
      case 'phone':
        Linking.openURL('tel:+18005551234');
        break;
      case 'email':
        Linking.openURL('mailto:support@pivip.com?subject=Help Request');
        break;
      case 'chat':
        Alert.alert('Live Chat', 'Live chat feature coming soon!');
        break;
    }
  };

  const handleFAQ = (topic: string) => {
    Alert.alert(topic, 'Detailed help article coming soon!');
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
    contactCard: {
      flexDirection: 'row',
      backgroundColor: isDark ? '#1a1a2e' : '#FFFFFF',
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      alignItems: 'center',
    },
    contactIcon: {
      fontSize: 28,
      marginRight: 16,
      width: 40,
      textAlign: 'center',
    },
    contactInfo: {
      flex: 1,
    },
    contactTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: isDark ? '#FFFFFF' : '#1a1a2e',
      marginBottom: 4,
    },
    contactDescription: {
      fontSize: 14,
      color: isDark ? '#B0B0B0' : '#666666',
    },
    contactArrow: {
      fontSize: 18,
      fontWeight: '600',
      color: isDark ? '#888888' : '#999999',
    },
    faqItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
    },
    faqIcon: {
      fontSize: 22,
      marginRight: 16,
      width: 32,
      textAlign: 'center',
    },
    faqText: {
      flex: 1,
      fontSize: 16,
      fontWeight: '600',
      color: isDark ? '#FFFFFF' : '#1a1a2e',
    },
    faqArrow: {
      fontSize: 18,
      fontWeight: '600',
      color: isDark ? '#888888' : '#999999',
    },
    legalSection: {
      marginTop: 12,
    },
    legalItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
    },
    legalText: {
      flex: 1,
      fontSize: 15,
      fontWeight: '500',
      color: isDark ? '#B0B0B0' : '#666666',
    },
    versionText: {
      textAlign: 'center',
      fontSize: 13,
      color: isDark ? '#666666' : '#999999',
      marginTop: 24,
      marginBottom: 20,
    },
  });

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Help & Support</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contact Us</Text>

          <TouchableOpacity style={styles.contactCard} onPress={() => handleContact('chat')}>
            <Text style={styles.contactIcon}>💬</Text>
            <View style={styles.contactInfo}>
              <Text style={styles.contactTitle}>Live Chat</Text>
              <Text style={styles.contactDescription}>Chat with our support team</Text>
            </View>
            <Text style={styles.contactArrow}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.contactCard} onPress={() => handleContact('phone')}>
            <Text style={styles.contactIcon}>📞</Text>
            <View style={styles.contactInfo}>
              <Text style={styles.contactTitle}>Call Us</Text>
              <Text style={styles.contactDescription}>1-800-555-1234</Text>
            </View>
            <Text style={styles.contactArrow}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.contactCard} onPress={() => handleContact('email')}>
            <Text style={styles.contactIcon}>✉️</Text>
            <View style={styles.contactInfo}>
              <Text style={styles.contactTitle}>Email Support</Text>
              <Text style={styles.contactDescription}>support@pivip.com</Text>
            </View>
            <Text style={styles.contactArrow}>›</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Frequently Asked Questions</Text>

          <TouchableOpacity style={styles.faqItem} onPress={() => handleFAQ('How do I book a ride?')}>
            <Text style={styles.faqIcon}>🚗</Text>
            <Text style={styles.faqText}>How do I book a ride?</Text>
            <Text style={styles.faqArrow}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.faqItem} onPress={() => handleFAQ('Payment issues')}>
            <Text style={styles.faqIcon}>💳</Text>
            <Text style={styles.faqText}>Payment issues</Text>
            <Text style={styles.faqArrow}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.faqItem} onPress={() => handleFAQ('Lost items')}>
            <Text style={styles.faqIcon}>🔍</Text>
            <Text style={styles.faqText}>I lost an item during my ride</Text>
            <Text style={styles.faqArrow}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.faqItem} onPress={() => handleFAQ('Report a safety concern')}>
            <Text style={styles.faqIcon}>🛡️</Text>
            <Text style={styles.faqText}>Report a safety concern</Text>
            <Text style={styles.faqArrow}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.faqItem} onPress={() => handleFAQ('Fare disputes')}>
            <Text style={styles.faqIcon}>💰</Text>
            <Text style={styles.faqText}>Fare disputes and refunds</Text>
            <Text style={styles.faqArrow}>›</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Legal</Text>

          <View style={styles.legalSection}>
            <TouchableOpacity style={styles.legalItem} onPress={() => Linking.openURL('https://pivip.com/terms')}>
              <Text style={styles.legalText}>Terms of Service</Text>
              <Text style={styles.faqArrow}>›</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.legalItem} onPress={() => Linking.openURL('https://pivip.com/privacy')}>
              <Text style={styles.legalText}>Privacy Policy</Text>
              <Text style={styles.faqArrow}>›</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.legalItem} onPress={() => Linking.openURL('https://pivip.com/licenses')}>
              <Text style={styles.legalText}>Licenses</Text>
              <Text style={styles.faqArrow}>›</Text>
            </TouchableOpacity>
          </View>
        </View>

        <Text style={styles.versionText}>Pi VIP Rider App v1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
};

export default HelpSupportScreen;