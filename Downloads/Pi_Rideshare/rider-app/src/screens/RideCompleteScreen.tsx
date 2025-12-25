import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';

import { useTheme } from '../context/ThemeContext';
import { RootStackParamList } from '../navigation/AppNavigator';
import { rideService } from '../services/ride.service';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'RideComplete'>;
type RouteProps = RouteProp<RootStackParamList, 'RideComplete'>;

const RideCompleteScreen = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProps>();
  const { colors, isDark } = useTheme();

  const { rideId, fare } = route.params;

  const [rating, setRating] = useState(5);
  const [tip, setTip] = useState<number | null>(null);
  const [feedback, setFeedback] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const tipOptions = [0, 2, 5, 10];

  const handleStarPress = (star: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRating(star);
  };

  const handleTipPress = (amount: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTip(amount === tip ? null : amount);
  };

  const handleSubmit = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    
    try {
      await rideService.rateRide(rideId, rating, feedback);
      if (tip && tip > 0) {
        await rideService.addTip(rideId, tip);
      }
    } catch (error) {
      console.error('Error submitting rating:', error);
    }

    setSubmitted(true);
    
    setTimeout(() => {
      navigation.reset({
        index: 0,
        routes: [{ name: 'MainTabs' }],
      });
    }, 1500);
  };

  const handleSkip = () => {
    navigation.reset({
      index: 0,
      routes: [{ name: 'MainTabs' }],
    });
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      flex: 1,
      padding: 24,
      justifyContent: 'center',
    },
    header: {
      alignItems: 'center',
      marginBottom: 32,
    },
    checkmark: {
      fontSize: 64,
      marginBottom: 16,
    },
    title: {
      fontSize: 28,
      fontWeight: '800',
      color: colors.text,
      marginBottom: 8,
    },
    subtitle: {
      fontSize: 16,
      color: colors.textSecondary,
    },
    fareCard: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 20,
      alignItems: 'center',
      marginBottom: 32,
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    fareLabel: {
      fontSize: 14,
      color: colors.textMuted,
      marginBottom: 4,
    },
    fareAmount: {
      fontSize: 36,
      fontWeight: '800',
      color: colors.primary,
    },
    section: {
      marginBottom: 24,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 12,
      textAlign: 'center',
    },
    starsRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 12,
    },
    star: {
      fontSize: 40,
    },
    starInactive: {
      opacity: 0.3,
    },
    tipRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 12,
    },
    tipButton: {
      paddingVertical: 12,
      paddingHorizontal: 20,
      backgroundColor: colors.inputBackground,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: 'transparent',
      minWidth: 70,
      alignItems: 'center',
    },
    tipButtonSelected: {
      borderColor: colors.primary,
      backgroundColor: `${colors.primary}15`,
    },
    tipButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
    },
    tipButtonTextSelected: {
      color: colors.primary,
    },
    feedbackInput: {
      backgroundColor: colors.inputBackground,
      borderRadius: 12,
      padding: 14,
      fontSize: 15,
      color: colors.text,
      borderWidth: 1,
      borderColor: colors.inputBorder,
      minHeight: 80,
      textAlignVertical: 'top',
    },
    submitButton: {
      backgroundColor: colors.primary,
      paddingVertical: 18,
      borderRadius: 14,
      alignItems: 'center',
      marginBottom: 12,
    },
    submitButtonText: {
      fontSize: 16,
      fontWeight: '700',
      color: isDark ? '#0d0d1a' : '#ffffff',
    },
    skipButton: {
      paddingVertical: 12,
      alignItems: 'center',
    },
    skipButtonText: {
      fontSize: 14,
      color: colors.textMuted,
    },
    successOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: colors.background,
      justifyContent: 'center',
      alignItems: 'center',
    },
    successIcon: {
      fontSize: 80,
      marginBottom: 16,
    },
    successText: {
      fontSize: 24,
      fontWeight: '700',
      color: colors.text,
    },
  });

  if (submitted) {
    return (
      <View style={styles.successOverlay}>
        <Text style={styles.successIcon}>✅</Text>
        <Text style={styles.successText}>Thank you!</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.checkmark}>🎉</Text>
          <Text style={styles.title}>Ride Complete!</Text>
          <Text style={styles.subtitle}>Thanks for riding with Pi VIP</Text>
        </View>

        <View style={styles.fareCard}>
          <Text style={styles.fareLabel}>Total Fare</Text>
          <Text style={styles.fareAmount}>${fare.toFixed(2)}</Text>
        </View>

        {/* Rating */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Rate your driver</Text>
          <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map((star) => (
              <TouchableOpacity key={star} onPress={() => handleStarPress(star)}>
                <Text style={[styles.star, star > rating && styles.starInactive]}>⭐</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Tip */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Add a tip</Text>
          <View style={styles.tipRow}>
            {tipOptions.map((amount) => (
              <TouchableOpacity
                key={amount}
                style={[styles.tipButton, tip === amount && styles.tipButtonSelected]}
                onPress={() => handleTipPress(amount)}
              >
                <Text style={[styles.tipButtonText, tip === amount && styles.tipButtonTextSelected]}>
                  {amount === 0 ? 'None' : `$${amount}`}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Feedback */}
        <View style={styles.section}>
          <TextInput
            style={styles.feedbackInput}
            placeholder="Any feedback? (optional)"
            placeholderTextColor={colors.textMuted}
            value={feedback}
            onChangeText={setFeedback}
            multiline
          />
        </View>

        <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
          <Text style={styles.submitButtonText}>Submit & Done</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
          <Text style={styles.skipButtonText}>Skip for now</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

export default RideCompleteScreen;