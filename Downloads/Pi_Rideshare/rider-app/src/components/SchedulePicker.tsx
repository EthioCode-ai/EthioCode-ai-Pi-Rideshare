import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Dimensions,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';

interface SchedulePickerProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (date: Date) => void;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const SchedulePicker: React.FC<SchedulePickerProps> = ({ visible, onClose, onConfirm }) => {
  const { colors, isDark } = useTheme();
  
  const now = new Date();
  const [selectedDate, setSelectedDate] = useState<Date>(now);
  const [selectedHour, setSelectedHour] = useState<number>(now.getHours());
  const [selectedMinute, setSelectedMinute] = useState<number>(now.getMinutes());

  // Generate next 30 days
  const getDays = () => {
    const days = [];
    const today = new Date();
    for (let i = 0; i < 30; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() + i);
      days.push(date);
    }
    return days;
  };

  const formatDay = (date: Date): { day: string; date: string; month: string } => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    let dayName = '';
    if (date.toDateString() === today.toDateString()) {
      dayName = 'Today';
    } else if (date.toDateString() === tomorrow.toDateString()) {
      dayName = 'Tomorrow';
    } else {
      dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
    }

    return {
      day: dayName,
      date: date.getDate().toString(),
      month: date.toLocaleDateString('en-US', { month: 'short' }),
    };
  };

  // All 24 hours
  const hours = Array.from({ length: 24 }, (_, i) => i);
  
  // All 60 minutes
  const minutes = Array.from({ length: 60 }, (_, i) => i);

  const formatHour = (hour: number): string => {
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour} ${period}`;
  };

  const formatMinute = (minute: number): string => {
    return minute.toString().padStart(2, '0');
  };

  const handleConfirm = () => {
    const finalDate = new Date(selectedDate);
    finalDate.setHours(selectedHour);
    finalDate.setMinutes(selectedMinute);
    finalDate.setSeconds(0);
    onConfirm(finalDate);
  };

  const isValidTime = (): boolean => {
    const currentTime = new Date();
    const selected = new Date(selectedDate);
    selected.setHours(selectedHour);
    selected.setMinutes(selectedMinute);
    // Must be at least 15 minutes in the future
    return selected.getTime() > currentTime.getTime() + 15 * 60 * 1000;
  };

  const getFormattedSummary = (): string => {
    const { day, date, month } = formatDay(selectedDate);
    const time = `${formatHour(selectedHour)}:${formatMinute(selectedMinute)}`;
    
    if (day === 'Today' || day === 'Tomorrow') {
      return `${day} at ${time}`;
    }
    return `${day}, ${month} ${date} at ${time}`;
  };

  const styles = StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      justifyContent: 'flex-end',
    },
    container: {
      backgroundColor: colors.card,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      padding: 20,
      paddingBottom: 40,
    },
    handle: {
      width: 40,
      height: 4,
      backgroundColor: colors.textMuted,
      borderRadius: 2,
      alignSelf: 'center',
      marginBottom: 16,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 20,
    },
    title: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.text,
    },
    closeButton: {
      padding: 8,
    },
    closeButtonText: {
      fontSize: 24,
      color: colors.textMuted,
    },
    section: {
      marginBottom: 20,
    },
    sectionTitle: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textMuted,
      marginBottom: 12,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    daysContainer: {
      height: 80,
    },
    daysScroll: {
      flexGrow: 0,
    },
    daysContent: {
      paddingRight: 20,
    },
    dayButton: {
      width: 65,
      paddingVertical: 10,
      backgroundColor: colors.inputBackground,
      borderRadius: 12,
      marginRight: 10,
      borderWidth: 2,
      borderColor: 'transparent',
      alignItems: 'center',
    },
    dayButtonSelected: {
      borderColor: colors.primary,
      backgroundColor: `${colors.primary}15`,
    },
    dayName: {
      fontSize: 11,
      color: colors.textMuted,
      marginBottom: 4,
    },
    dayNameSelected: {
      color: colors.primary,
    },
    dayDate: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.text,
    },
    dayDateSelected: {
      color: colors.primary,
    },
    dayMonth: {
      fontSize: 11,
      color: colors.textMuted,
      marginTop: 2,
    },
    dayMonthSelected: {
      color: colors.primary,
    },
    timeContainer: {
      flexDirection: 'row',
      gap: 12,
    },
    timeColumn: {
      flex: 1,
    },
    timeLabel: {
      fontSize: 12,
      color: colors.textMuted,
      marginBottom: 8,
      textAlign: 'center',
      fontWeight: '600',
    },
    timeScrollContainer: {
      height: 180,
      backgroundColor: colors.inputBackground,
      borderRadius: 12,
      overflow: 'hidden',
    },
    timeScrollContent: {
      paddingVertical: 68,
    },
    timeOption: {
      height: 44,
      justifyContent: 'center',
      alignItems: 'center',
    },
    timeOptionSelected: {
      backgroundColor: `${colors.primary}25`,
    },
    timeOptionText: {
      fontSize: 18,
      color: colors.textMuted,
    },
    timeOptionTextSelected: {
      color: colors.primary,
      fontWeight: '700',
      fontSize: 20,
    },
    selectedIndicator: {
      position: 'absolute',
      top: 68,
      left: 8,
      right: 8,
      height: 44,
      borderRadius: 8,
      borderWidth: 2,
      borderColor: colors.primary,
      backgroundColor: `${colors.primary}10`,
      pointerEvents: 'none',
    },
    summaryContainer: {
      backgroundColor: `${colors.primary}10`,
      padding: 16,
      borderRadius: 12,
      marginBottom: 20,
      borderWidth: 1,
      borderColor: `${colors.primary}30`,
    },
    summaryLabel: {
      fontSize: 12,
      color: colors.textMuted,
      marginBottom: 4,
    },
    summaryText: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.primary,
    },
    invalidText: {
      fontSize: 12,
      color: '#ef4444',
      marginTop: 6,
    },
    buttonsRow: {
      flexDirection: 'row',
      gap: 12,
    },
    cancelButton: {
      flex: 1,
      paddingVertical: 16,
      borderRadius: 12,
      backgroundColor: colors.inputBackground,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    cancelButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    confirmButton: {
      flex: 2,
      paddingVertical: 16,
      borderRadius: 12,
      backgroundColor: colors.primary,
      alignItems: 'center',
    },
    confirmButtonDisabled: {
      opacity: 0.4,
    },
    confirmButtonText: {
      fontSize: 16,
      fontWeight: '700',
      color: isDark ? '#0d0d1a' : '#ffffff',
    },
  });

  const days = getDays();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.handle} />
          
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>📅 Schedule Pickup</Text>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Day Selection */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Select Day</Text>
            <View style={styles.daysContainer}>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false} 
                style={styles.daysScroll}
                contentContainerStyle={styles.daysContent}
              >
                {days.map((day, index) => {
                  const formatted = formatDay(day);
                  const isSelected = selectedDate.toDateString() === day.toDateString();
                  return (
                    <TouchableOpacity
                      key={index}
                      style={[styles.dayButton, isSelected && styles.dayButtonSelected]}
                      onPress={() => setSelectedDate(day)}
                    >
                      <Text style={[styles.dayName, isSelected && styles.dayNameSelected]}>
                        {formatted.day}
                      </Text>
                      <Text style={[styles.dayDate, isSelected && styles.dayDateSelected]}>
                        {formatted.date}
                      </Text>
                      <Text style={[styles.dayMonth, isSelected && styles.dayMonthSelected]}>
                        {formatted.month}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          </View>

          {/* Time Selection */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Select Time</Text>
            <View style={styles.timeContainer}>
              {/* Hour Picker */}
              <View style={styles.timeColumn}>
                <Text style={styles.timeLabel}>Hour</Text>
                <View style={styles.timeScrollContainer}>
                  <View style={styles.selectedIndicator} />
                  <ScrollView
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={styles.timeScrollContent}
                    snapToInterval={44}
                    decelerationRate="fast"
                  >
                    {hours.map((hour) => (
                      <TouchableOpacity
                        key={hour}
                        style={[styles.timeOption, selectedHour === hour && styles.timeOptionSelected]}
                        onPress={() => setSelectedHour(hour)}
                      >
                        <Text style={[styles.timeOptionText, selectedHour === hour && styles.timeOptionTextSelected]}>
                          {formatHour(hour)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              </View>

              {/* Minute Picker */}
              <View style={styles.timeColumn}>
                <Text style={styles.timeLabel}>Minute</Text>
                <View style={styles.timeScrollContainer}>
                  <View style={styles.selectedIndicator} />
                  <ScrollView
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={styles.timeScrollContent}
                    snapToInterval={44}
                    decelerationRate="fast"
                  >
                    {minutes.map((minute) => (
                      <TouchableOpacity
                        key={minute}
                        style={[styles.timeOption, selectedMinute === minute && styles.timeOptionSelected]}
                        onPress={() => setSelectedMinute(minute)}
                      >
                        <Text style={[styles.timeOptionText, selectedMinute === minute && styles.timeOptionTextSelected]}>
                          :{formatMinute(minute)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              </View>
            </View>
          </View>

          {/* Summary */}
          <View style={styles.summaryContainer}>
            <Text style={styles.summaryLabel}>PICKUP TIME</Text>
            <Text style={styles.summaryText}>{getFormattedSummary()}</Text>
            {!isValidTime() && (
              <Text style={styles.invalidText}>Must be at least 15 minutes from now</Text>
            )}
          </View>

          {/* Buttons */}
          <View style={styles.buttonsRow}>
            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.confirmButton, !isValidTime() && styles.confirmButtonDisabled]}
              onPress={handleConfirm}
              disabled={!isValidTime()}
            >
              <Text style={styles.confirmButtonText}>Confirm Schedule</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default SchedulePicker;