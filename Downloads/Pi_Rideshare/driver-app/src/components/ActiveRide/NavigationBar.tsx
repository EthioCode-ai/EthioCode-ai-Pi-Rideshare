/**
 * NavigationBar Component
 * Displays current turn-by-turn navigation instruction
 * 
 * Phase 2.6 - Updated:
 * - Better handling of loading/calculating state
 * - Cleaner display of turn-by-turn instructions
 * - Shows ETA and distance prominently
 */

import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';

// Colors
const COLORS = {
  background: '#1F2937',
  primary: '#6B46C1',
  text: '#FFFFFF',
  textSecondary: '#9CA3AF',
  success: '#10B981',
};

export interface NavigationStep {
  instruction: string;
  distance: string;
  duration: string;
  maneuver?: string;
  endLocation?: {
    lat: number;
    lng: number;
  };
}

interface NavigationBarProps {
  currentStep: NavigationStep | null;
  nextStep?: NavigationStep | null;
  eta: string;
  totalDistance: string;
  isCalculating?: boolean;
}

/**
 * Get maneuver emoji based on type
 */
const getManeuverEmoji = (maneuver?: string): string => {
  const emojiMap: Record<string, string> = {
    'turn-left': '⬅️',
    'turn-right': '➡️',
    'turn-slight-left': '↖️',
    'turn-slight-right': '↗️',
    'turn-sharp-left': '⤴️',
    'turn-sharp-right': '⤵️',
    'uturn-left': '↩️',
    'uturn-right': '↪️',
    'merge': '🔀',
    'fork-left': '↙️',
    'fork-right': '↘️',
    'straight': '⬆️',
    'ramp-left': '↖️',
    'ramp-right': '↗️',
    'keep-left': '↖️',
    'keep-right': '↗️',
    'roundabout-left': '🔄',
    'roundabout-right': '🔄',
  };

  return emojiMap[maneuver || ''] || '⬆️';
};

/**
 * Strip HTML tags from Google's instructions
 */
const cleanInstruction = (instruction: string): string => {
  return instruction
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/Destination will be on the (right|left)/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
};

const NavigationBar: React.FC<NavigationBarProps> = ({
  currentStep,
  nextStep,
  eta,
  totalDistance,
  isCalculating = false,
}) => {
  // Show loading state
  if (isCalculating || (!currentStep && !eta)) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContent}>
          <Text style={styles.loadingEmoji}>🧭</Text>
          <Text style={styles.loadingText}>Calculating route...</Text>
        </View>
      </View>
    );
  }

  // No step but have ETA - show summary only
  if (!currentStep && eta) {
    return (
      <View style={styles.container}>
        <View style={styles.summaryOnly}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{eta}</Text>
            <Text style={styles.summaryLabel}>ETA</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{totalDistance}</Text>
            <Text style={styles.summaryLabel}>Distance</Text>
          </View>
        </View>
      </View>
    );
  }

  const cleanedInstruction = cleanInstruction(currentStep?.instruction || '');
  const maneuverEmoji = getManeuverEmoji(currentStep?.maneuver);

  return (
    <View style={styles.container}>
      {/* ETA and Distance header */}
      <View style={styles.headerRow}>
        <Text style={styles.etaText}>{eta || '--'}</Text>
        <Text style={styles.distanceText}>{totalDistance || '--'}</Text>
      </View>

      {/* Current instruction */}
      <View style={styles.instructionRow}>
        <View style={styles.maneuverContainer}>
          <Text style={styles.maneuverEmoji}>{maneuverEmoji}</Text>
        </View>
        <View style={styles.instructionContent}>
            <Text style={styles.instructionText} numberOfLines={2}>
            {cleanedInstruction || 'Continue on current road'}
          </Text>
        </View>
      </View>

      {/* Next step preview */}
     <View style={styles.nextStepRow}>
     <Text style={styles.thenText}>Then</Text>
     <Text style={styles.nextManeuver}>
      {nextStep ? getManeuverEmoji(nextStep.maneuver) : '📍'}
      </Text>
      <Text style={styles.nextStepText} numberOfLines={1}>
      {nextStep ? cleanInstruction(nextStep.instruction) : 'Destination on the right'}
     </Text>
    </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    left: 16,
    right: 16,
    backgroundColor: COLORS.background,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  // Loading state
  loadingContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  loadingEmoji: {
    fontSize: 24,
    marginRight: 12,
  },
  loadingText: {
    fontSize: 16,
    color: COLORS.textSecondary,
  },
  // Summary only (no steps)
  summaryOnly: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryItem: {
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.text,
  },
  summaryLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  summaryDivider: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  // Header with ETA/Distance
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  etaText: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.success,
  },
  distanceText: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.text,
  },
  // Instruction row
  instructionRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  maneuverContainer: {
    width: 52,
    height: 52,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  maneuverEmoji: {
    fontSize: 26,
  },
  instructionContent: {
    flex: 1,
  },
  stepDistance: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  instructionText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    lineHeight: 22,
  },
  // Next step
  nextStepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  thenText: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.textSecondary,
    marginRight: 8,
  },
  nextManeuver: {
    fontSize: 16,
    marginRight: 8,
  },
  nextStepText: {
    flex: 1,
    fontSize: 14,
    color: COLORS.textSecondary,
  },
});

export default NavigationBar;
