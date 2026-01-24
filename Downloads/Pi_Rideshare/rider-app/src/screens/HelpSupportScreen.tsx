import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Linking, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';

interface FAQItem {
  id: string;
  icon: string;
  question: string;
  answer: string;
}

const faqData: FAQItem[] = [
  {
    id: '1',
    icon: '🚗',
    question: 'How do I book a ride?',
    answer: 'From the Home screen, enter your destination in the "Where to?" field. Select your pickup location, choose a ride type, and tap "Confirm Ride". A nearby driver will be matched with you.',
  },
  {
    id: '2',
    icon: '💳',
    question: 'Payment issues',
    answer: 'All payments are processed securely through your saved payment method. If a charge seems incorrect, go to Activity > select the trip > Report an issue. Refunds typically process within 5-7 business days.',
  },
  {
    id: '3',
    icon: '🔍',
    question: 'I lost an item during my ride',
    answer: 'Go to Activity, find the trip, and tap "I lost an item". You can contact your driver directly through the app within 24 hours of the trip. After that, contact our support team.',
  },
  {
    id: '4',
    icon: '🛡️',
    question: 'Report a safety concern',
    answer: 'Your safety is our priority. For emergencies, always call 911 first. To report a concern, go to Activity > select the trip > Report a safety issue. Our Trust & Safety team reviews all reports within 24 hours.',
  },
  {
    id: '5',
    icon: '💰',
    question: 'Fare disputes and refunds',
    answer: 'Fares are calculated based on distance, time, and demand. If you believe you were overcharged, go to Activity > select the trip > Review fare. You can request a fare review and our team will investigate.',
  },
  {
    id: '6',
    icon: '📍',
    question: 'Driver went the wrong way',
    answer: 'If your driver took an inefficient route, you may be eligible for a fare adjustment. Go to Activity > select the trip > Report an issue > Driver took a poor route.',
  },
  {
    id: '7',
    icon: '❌',
    question: 'Cancel a ride',
    answer: 'You can cancel a ride anytime before pickup. Open the ride screen and tap "Cancel Ride". Note: A cancellation fee may apply if the driver is already on the way or has arrived.',
  },
  {
    id: '8',
    icon: '⭐',
    question: 'How ratings work',
    answer: 'After each ride, both riders and drivers rate each other from 1-5 stars. Your rating is an average of your last 100 trips. Maintaining a high rating helps ensure a great experience for everyone.',
  },
];

const HelpSupportScreen = () => {
  const { colors, isDark } = useTheme();
  const navigation = useNavigation<any>();
  const [expandedFAQ, setExpandedFAQ] = useState<string | null>(null);

  const handleContact = (method: string) => {
    switch (method) {
      case 'phone':
        Linking.openURL('tel:+18005551234');
        break;
      case 'email':
        Linking.openURL('mailto:support@pivip.com?subject=Help Request');
        break;
      case 'chat':
        Alert.alert('Live Chat', 'Live chat support is available 24/7. This feature will connect you with a support agent.');
        break;
    }
  };

  const toggleFAQ = (id: string) => {
    setExpandedFAQ(expandedFAQ === id ? null : id);
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
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
      elevation: 2,
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
      backgroundColor: isDark ? '#1a1a2e' : '#FFFFFF',
      borderRadius: 12,
      marginBottom: 10,
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 1,
    },
    faqHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
    },
    faqIcon: {
      fontSize: 22,
      marginRight: 14,
      width: 30,
      textAlign: 'center',
    },
    faqQuestion: {
      flex: 1,
      fontSize: 15,
      fontWeight: '600',
      color: isDark ? '#FFFFFF' : '#1a1a2e',
    },
    faqArrow: {
      fontSize: 16,
      fontWeight: '600',
      color: isDark ? '#888888' : '#999999',
    },
    faqAnswer: {
      paddingHorizontal: 16,
      paddingBottom: 16,
      paddingTop: 0,
    },
    faqAnswerText: {
      fontSize: 14,
      lineHeight: 22,
      color: isDark ? '#B0B0B0' : '#666666',
    },
    legalSection: {
      marginTop: 8,
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
              <Text style={styles.contactDescription}>Available 24/7</Text>
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

          {faqData.map((faq) => (
            <View key={faq.id} style={styles.faqItem}>
              <TouchableOpacity style={styles.faqHeader} onPress={() => toggleFAQ(faq.id)}>
                <Text style={styles.faqIcon}>{faq.icon}</Text>
                <Text style={styles.faqQuestion}>{faq.question}</Text>
                <Text style={styles.faqArrow}>{expandedFAQ === faq.id ? '▼' : '›'}</Text>
              </TouchableOpacity>
              {expandedFAQ === faq.id && (
                <View style={styles.faqAnswer}>
                  <Text style={styles.faqAnswerText}>{faq.answer}</Text>
                </View>
              )}
            </View>
          ))}
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