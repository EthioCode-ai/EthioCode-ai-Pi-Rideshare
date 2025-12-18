/**
 * WaitTimer Component
 * Displays countdown timer for grace period and accumulating wait charges
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';

// Colors
const COLORS = {
  grace: '#10B981',
  charging: '#EF4444',
  warning: '#F59E0B',
  textSecondary: '#6B7280',
};

interface WaitTimerProps {
  startTime: Date;
  gracePeriodSeconds: number;
  waitRatePerMinute: number;
}

const WaitTimer: React.FC<WaitTimerProps> = ({
  startTime,
  gracePeriodSeconds,
  waitRatePerMinute,
}) => {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [pulseAnim] = useState(new Animated.Value(1));

  // Update elapsed time every second
  useEffect(() => {
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime.getTime()) / 1000);
      setElapsedSeconds(elapsed);
    }, 1000);

    return () => clearInterval(interval);
  }, [startTime]);

  // Pulse animation when charging
  useEffect(() => {
    if (elapsedSeconds > gracePeriodSeconds) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.02,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [elapsedSeconds > gracePeriodSeconds]);

  // Calculate times and charges
  const isCharging = elapsedSeconds > gracePeriodSeconds;
  const remainingGraceSeconds = Math.max(0, gracePeriodSeconds - elapsedSeconds);
  const chargedSeconds = Math.max(0, elapsedSeconds - gracePeriodSeconds);
  const chargedMinutes = chargedSeconds / 60;
  const waitCharges = chargedMinutes * waitRatePerMinute;

  // Format time as MM:SS
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Progress percentage
  const graceProgress = Math.min(100, (elapsedSeconds / gracePeriodSeconds) * 100);

  return (
    <Animated.View 
      style={[
        styles.container,
        isCharging && styles.containerCharging,
        { transform: [{ scale: pulseAnim }] }
      ]}
    >
      <View style={styles.header}>
        <Text style={styles.headerEmoji}>{isCharging ? '💰' : '⏱️'}</Text>
        <Text style={[styles.headerText, isCharging && styles.headerTextCharging]}>
          {isCharging ? 'Wait Charges Active' : 'Free Wait Time'}
        </Text>
      </View>

      <View style={styles.content}>
        {/* Timer display */}
        <View style={styles.timerSection}>
          <Text style={[styles.timerLabel, isCharging && styles.labelCharging]}>
            {isCharging ? 'Charged Time' : 'Grace Remaining'}
          </Text>
          <Text style={[styles.timerValue, isCharging && styles.valueCharging]}>
            {formatTime(isCharging ? chargedSeconds : remainingGraceSeconds)}
          </Text>
        </View>

        {/* Charges display */}
        {isCharging && (
          <View style={styles.chargesSection}>
            <Text style={styles.chargesLabel}>Wait Charges</Text>
            <Text style={styles.chargesValue}>+${waitCharges.toFixed(2)}</Text>
            <Text style={styles.rateText}>${waitRatePerMinute.toFixed(2)}/min</Text>
          </View>
        )}
      </View>

      {/* Progress bar (grace period only) */}
      {!isCharging && (
        <View style={styles.progressContainer}>
          <View style={styles.progressBackground}>
            <View 
              style={[
                styles.progressFill,
                { width: `${graceProgress}%` },
                graceProgress > 80 && styles.progressWarning
              ]} 
            />
          </View>
          <Text style={styles.progressText}>
            {Math.round(gracePeriodSeconds / 60)} min grace period
          </Text>
        </View>
      )}

      {/* Warning when grace almost over */}
      {!isCharging && remainingGraceSeconds <= 60 && remainingGraceSeconds > 0 && (
        <View style={styles.warningBanner}>
          <Text style={styles.warningText}>
            ⚠️ Wait charges start in {remainingGraceSeconds}s
          </Text>
        </View>
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ECFDF5',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  containerCharging: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerEmoji: {
    fontSize: 18,
    marginRight: 8,
  },
  headerText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.grace,
  },
  headerTextCharging: {
    color: COLORS.charging,
  },
  content: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  timerSection: {
    flex: 1,
  },
  timerLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  labelCharging: {
    color: COLORS.charging,
  },
  timerValue: {
    fontSize: 32,
    fontWeight: '700',
    color: COLORS.grace,
    fontVariant: ['tabular-nums'],
  },
  valueCharging: {
    color: COLORS.charging,
  },
  chargesSection: {
    alignItems: 'flex-end',
  },
  chargesLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  chargesValue: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.charging,
  },
  rateText: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  progressContainer: {
    marginTop: 12,
  },
  progressBackground: {
    height: 6,
    backgroundColor: '#A7F3D0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.grace,
    borderRadius: 3,
  },
  progressWarning: {
    backgroundColor: COLORS.warning,
  },
  progressText: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 6,
    textAlign: 'center',
  },
  warningBanner: {
    marginTop: 12,
    paddingVertical: 8,
    backgroundColor: '#FFFBEB',
    borderRadius: 6,
    alignItems: 'center',
  },
  warningText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.warning,
  },
});

export default WaitTimer;
