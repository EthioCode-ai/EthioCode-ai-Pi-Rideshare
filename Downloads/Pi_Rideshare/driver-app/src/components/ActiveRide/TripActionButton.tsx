/**
 * TripActionButton Component
 * Context-aware main action button that changes based on trip status
 * 
 * Phase 2.6 - Updated:
 * - "I've Arrived" only visible when within geofence (100m)
 * - Shows navigation status when not at destination
 * - Cleaner state management
 */

import React from 'react';
import { TouchableOpacity, Text, StyleSheet, View, ActivityIndicator } from 'react-native';
import { TripStatus } from '../../types/ride.types';

// Colors for different states
const BUTTON_CONFIGS = {
  navigating: { bg: '#6B46C1', emoji: '🧭' },      // Purple - in navigation
  arrived: { bg: '#10B981', emoji: '📍' },         // Green - can take action
  start_trip: { bg: '#10B981', emoji: '▶️' },      // Green - start trip
  complete: { bg: '#10B981', emoji: '✅' },        // Green - complete
  disabled: { bg: '#9CA3AF', emoji: '🧭' },        // Gray - waiting
};

interface TripActionButtonProps {
  tripStatus: TripStatus;
  isWithinGeofence: boolean;
  onPress: () => void;
  loading?: boolean;
  eta?: string;
  distanceToTarget?: string;
}

const TripActionButton: React.FC<TripActionButtonProps> = ({
  tripStatus,
  isWithinGeofence,
  onPress,
  loading = false,
  eta,
  distanceToTarget,
}) => {
  // Determine button state and content
  const getButtonConfig = () => {
    switch (tripStatus) {
      case 'en_route_to_pickup':
        if (isWithinGeofence) {
          return {
            config: BUTTON_CONFIGS.arrived,
            label: "I've Arrived",
            sublabel: 'Tap to notify rider',
            disabled: false,
            showArrow: true,
          };
        }
        return {
          config: BUTTON_CONFIGS.navigating,
          label: 'Navigating to Pickup',
          sublabel: eta ? `${eta} • ${distanceToTarget || ''}` : 'Calculating...',
          disabled: true,
          showArrow: false,
        };

      case 'at_pickup':
        return {
          config: BUTTON_CONFIGS.start_trip,
          label: 'Start Trip',
          sublabel: 'Tap when rider is in car',
          disabled: false,
          showArrow: true,
        };

      case 'in_trip':
        if (isWithinGeofence) {
          return {
            config: BUTTON_CONFIGS.complete,
            label: 'Complete Trip',
            sublabel: 'Tap to finish ride',
            disabled: false,
            showArrow: true,
          };
        }
        return {
          config: BUTTON_CONFIGS.navigating,
          label: 'Navigating to Destination',
          sublabel: eta ? `${eta} • ${distanceToTarget || ''}` : 'Calculating...',
          disabled: true,
          showArrow: false,
        };

      case 'completed':
        return {
          config: BUTTON_CONFIGS.complete,
          label: 'Done',
          sublabel: 'Return to home',
          disabled: false,
          showArrow: true,
        };

      default:
        return {
          config: BUTTON_CONFIGS.disabled,
          label: 'Please wait...',
          sublabel: '',
          disabled: true,
          showArrow: false,
        };
    }
  };

  const buttonState = getButtonConfig();

  return (
    <TouchableOpacity
      style={[
        styles.button,
        { backgroundColor: buttonState.disabled ? '#E5E7EB' : buttonState.config.bg },
      ]}
      onPress={onPress}
      disabled={buttonState.disabled || loading}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator size="small" color="#FFFFFF" />
      ) : (
        <View style={styles.content}>
          <View style={[
            styles.iconContainer,
            buttonState.disabled && styles.iconContainerDisabled
          ]}>
            <Text style={styles.emoji}>{buttonState.config.emoji}</Text>
          </View>
          <View style={styles.textContainer}>
            <Text style={[
              styles.actionText,
              buttonState.disabled && styles.actionTextDisabled
            ]}>
              {buttonState.label}
            </Text>
            {buttonState.sublabel && (
              <Text style={[
                styles.sublabel,
                buttonState.disabled && styles.sublabelDisabled
              ]}>
                {buttonState.sublabel}
              </Text>
            )}
          </View>
          {buttonState.showArrow && !buttonState.disabled && (
            <View style={styles.arrowContainer}>
              <Text style={styles.arrow}>→</Text>
            </View>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  iconContainerDisabled: {
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  emoji: {
    fontSize: 22,
  },
  textContainer: {
    flex: 1,
  },
  actionText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  actionTextDisabled: {
    color: '#6B7280',
  },
  sublabel: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 2,
  },
  sublabelDisabled: {
    color: '#9CA3AF',
  },
  arrowContainer: {
    marginLeft: 8,
  },
  arrow: {
    fontSize: 24,
    color: 'rgba(255, 255, 255, 0.7)',
  },
});

export default TripActionButton;
