import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Animated,
  ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';

import { useTheme } from '../context/ThemeContext';
import { voiceAIService, VoiceCommandResult } from '../services/voice-ai.service';

interface VoiceModalProps {
  visible: boolean;
  onClose: () => void;
  onCommandProcessed: (result: VoiceCommandResult) => void;
}

interface LearnedPrompt {
  text: string;
  icon: string;
  count: number;
}

type ModalState = 'idle' | 'listening' | 'processing' | 'responding' | 'confirming' | 'selecting';

const TIMEOUT_MS = 10000;
const VOICE_HISTORY_KEY = 'voice_command_history';

const DEFAULT_PROMPTS: LearnedPrompt[] = [
  { text: "Take me to the airport", icon: "✈️", count: 0 },
  { text: "What's surge right now?", icon: "📊", count: 0 },
  { text: "Schedule ride for 8am", icon: "📅", count: 0 },
];

const VoiceModal: React.FC<VoiceModalProps> = (props) => {
  const { visible, onClose } = props;
  const { colors, isDark } = useTheme();

  // Store callback in ref to avoid stale closures
  const onCommandProcessedRef = useRef(props.onCommandProcessed);
  const onCloseRef = useRef(onClose);

  // Keep refs updated
  useEffect(() => {
    onCommandProcessedRef.current = props.onCommandProcessed;
    onCloseRef.current = onClose;
  }, [props.onCommandProcessed, onClose]);

  const [modalState, setModalState] = useState<ModalState>('idle');
  const [transcript, setTranscript] = useState('');
  const [response, setResponse] = useState('');
  const [pendingResult, setPendingResult] = useState<VoiceCommandResult | null>(null);
  const [airportOptions, setAirportOptions] = useState<VoiceCommandResult['options'] | null>(null);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [learnedPrompts, setLearnedPrompts] = useState<LearnedPrompt[]>(DEFAULT_PROMPTS);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (visible) {
      initializeModal();
    } else {
      cleanup();
    }
    return cleanup;
  }, [visible]);

  const initializeModal = async () => {
    setModalState('listening');
    setTranscript('');
    setResponse('');
    setPendingResult(null);
    setAirportOptions(null);
    startPulseAnimation();
    startTimeout();
    await Promise.all([getUserLocation(), loadLearnedPrompts()]);
  };

  const cleanup = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    voiceAIService.stopSpeaking();
    pulseAnim.setValue(1);
  };

  const startTimeout = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      setResponse("No input received.");
      setModalState('idle');
      setTimeout(() => onCloseRef.current(), 2000);
    }, TIMEOUT_MS);
  };

  const getUserLocation = async () => {
    try {
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setUserLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
    } catch (error) {
      console.log('Could not get location');
    }
  };

  const loadLearnedPrompts = async () => {
    try {
      const data = await AsyncStorage.getItem(VOICE_HISTORY_KEY);
      if (data) {
        const history: LearnedPrompt[] = JSON.parse(data);
        const sorted = history.sort((a, b) => b.count - a.count).slice(0, 3);
        if (sorted.length >= 3) {
          setLearnedPrompts(sorted);
        } else {
          const combined = [...sorted];
          for (const def of DEFAULT_PROMPTS) {
            if (combined.length >= 3) break;
            if (!combined.find(p => p.text.toLowerCase() === def.text.toLowerCase())) {
              combined.push(def);
            }
          }
          setLearnedPrompts(combined);
        }
      }
    } catch (error) {
      console.log('Could not load voice history');
    }
  };

  const saveCommandToHistory = async (commandText: string) => {
    try {
      const data = await AsyncStorage.getItem(VOICE_HISTORY_KEY);
      let history: LearnedPrompt[] = data ? JSON.parse(data) : [];
      const existingIndex = history.findIndex(p => p.text.toLowerCase() === commandText.toLowerCase());
      
      if (existingIndex >= 0) {
        history[existingIndex].count += 1;
      } else {
        let icon = "🎯";
        const cmd = commandText.toLowerCase();
        if (cmd.includes('airport') || cmd.includes('fly')) icon = "✈️";
        else if (cmd.includes('schedule') || cmd.includes('am') || cmd.includes('pm')) icon = "📅";
        else if (cmd.includes('surge') || cmd.includes('price')) icon = "📊";
        else if (cmd.includes('work')) icon = "💼";
        else if (cmd.includes('home')) icon = "🏠";
        else if (cmd.includes('driver')) icon = "🚗";
        history.push({ text: commandText, icon, count: 1 });
      }
      await AsyncStorage.setItem(VOICE_HISTORY_KEY, JSON.stringify(history));
    } catch (error) {
      console.log('Could not save voice history');
    }
  };

  const startPulseAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.15, duration: 600, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      ])
    ).start();
  };

  // Navigate to ride confirm
  const navigateToConfirm = useCallback((result: VoiceCommandResult) => {
    if (onCommandProcessedRef.current) {
      onCommandProcessedRef.current(result);
    }
  }, []);

  const handleStarterPrompt = async (promptText: string) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setTranscript(promptText);
    setModalState('processing');
    await saveCommandToHistory(promptText);

    try {
      const result = await voiceAIService.processCommand(promptText, userLocation);
      setResponse(result.response);
      
      await voiceAIService.speak(result.response);

      if (result.action === 'show_options' && result.options && result.options.length > 0) {
        setPendingResult(result);
        setAirportOptions(result.options);
        setModalState('selecting');
      } else if (result.requiresConfirmation && result.destination) {
        setPendingResult(result);
        setModalState('confirming');
      } else if (result.action !== 'none' && result.destination) {
        navigateToConfirm(result);
      } else {
        setModalState('responding');
        setTimeout(() => onCloseRef.current(), 2500);
      }
    } catch (error) {
      console.error('Voice command error:', error);
      setResponse("Sorry, something went wrong.");
      setModalState('idle');
      setTimeout(() => onCloseRef.current(), 2000);
    }
  };

  const handleAirportSelect = async (option: NonNullable<VoiceCommandResult['options']>[0]) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    const result: VoiceCommandResult = {
      type: pendingResult?.scheduledTime ? 'schedule_ride' : 'book_ride',
      destination: {
        name: option.name,
        address: option.address,
        latitude: option.latitude,
        longitude: option.longitude,
      },
      scheduledTime: pendingResult?.scheduledTime,
      response: `Taking you to ${option.name}.`,
      action: 'navigate_confirm',
    };

    setResponse(result.response);
    setModalState('responding');
    
    await voiceAIService.speak(result.response);
    
    navigateToConfirm(result);
  };

  const handleConfirm = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    if (pendingResult) {
      setResponse("Confirming your ride...");
      await voiceAIService.speak("Confirming your ride.");
      navigateToConfirm(pendingResult);
    }
  };

  const handleCancel = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setResponse("Cancelled.");
    voiceAIService.speak("Cancelled.");
    setTimeout(() => onCloseRef.current(), 1000);
  };

  const handleMicPress = () => {
    if (modalState === 'listening') {
      startTimeout();
    } else if (modalState === 'idle') {
      setModalState('listening');
      startPulseAnimation();
      startTimeout();
    }
  };

  const getSubtitle = () => {
    switch (modalState) {
      case 'listening': return 'Listening... Tap a suggestion or speak';
      case 'processing': return 'Processing your request...';
      case 'responding': return "Here's what I found";
      case 'confirming': return 'Confirm your selection';
      case 'selecting': return 'Choose an airport';
      default: return 'Tap mic or select a suggestion';
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1}>
          <View style={[styles.container, { backgroundColor: colors.card, borderColor: colors.primary }]}>
            
            {/* Close */}
            <TouchableOpacity style={[styles.closeButton, { backgroundColor: colors.inputBackground }]} onPress={onClose}>
              <Text style={{ color: colors.textMuted, fontSize: 16 }}>✕</Text>
            </TouchableOpacity>

            {/* Title */}
            <Text style={[styles.title, { color: colors.text }]}>🎙️ Voice Command</Text>
            <Text style={[styles.subtitle, { color: colors.textMuted }]}>{getSubtitle()}</Text>

            {/* Mic Button */}
            {modalState !== 'confirming' && modalState !== 'selecting' && (
              <TouchableOpacity onPress={handleMicPress} style={styles.micContainer}>
                <Animated.View
                  style={[
                    styles.micButton,
                    { backgroundColor: modalState === 'listening' ? '#ef4444' : colors.primary },
                    { transform: [{ scale: modalState === 'listening' ? pulseAnim : 1 }] },
                  ]}
                >
                  <Text style={styles.micIcon}>
                    {modalState === 'processing' ? '⏳' : modalState === 'listening' ? '🎤' : '🎙️'}
                  </Text>
                </Animated.View>
              </TouchableOpacity>
            )}

            {/* Status */}
            <View style={styles.statusContainer}>
              {modalState === 'processing' && (
                <View style={styles.processingRow}>
                  <ActivityIndicator color={colors.primary} size="small" />
                  <Text style={{ color: colors.textMuted, marginLeft: 8 }}>Processing...</Text>
                </View>
              )}
              {transcript !== '' && (
                <Text style={[styles.transcriptText, { color: colors.text }]}>"{transcript}"</Text>
              )}
              {response !== '' && (
                <Text style={[styles.responseText, { color: colors.primary }]}>{response}</Text>
              )}
            </View>

            {/* Airport Options */}
            {modalState === 'selecting' && airportOptions && airportOptions.length > 0 && (
              <View style={styles.optionsContainer}>
                {airportOptions.map((option, idx) => (
                  <TouchableOpacity
                    key={idx}
                    style={[styles.optionButton, { backgroundColor: colors.inputBackground, borderColor: colors.cardBorder }]}
                    onPress={() => handleAirportSelect(option)}
                  >
                    <Text style={{ fontSize: 24, marginRight: 12 }}>✈️</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 15, fontWeight: '600', color: colors.text, marginBottom: 2 }}>
                        {option.name}
                      </Text>
                      <Text style={{ fontSize: 12, color: colors.textMuted }} numberOfLines={2}>
                        {option.address}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Confirm Buttons */}
            {modalState === 'confirming' && (
              <View style={styles.confirmContainer}>
                <TouchableOpacity
                  style={[styles.confirmButton, { backgroundColor: colors.inputBackground, borderColor: colors.cardBorder, borderWidth: 1 }]}
                  onPress={handleCancel}
                >
                  <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.confirmButton, { backgroundColor: colors.primary }]}
                  onPress={handleConfirm}
                >
                  <Text style={{ fontSize: 14, fontWeight: '600', color: isDark ? '#0d0d1a' : '#ffffff' }}>Confirm</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Learned Prompts */}
            {(modalState === 'idle' || modalState === 'listening') && (
              <View style={[styles.promptsContainer, { borderTopColor: colors.cardBorder }]}>
                <Text style={{ fontSize: 11, fontWeight: '600', color: colors.textMuted, textAlign: 'center', marginBottom: 12 }}>
                  TRY SAYING
                </Text>
                {learnedPrompts.map((prompt, idx) => (
                  <TouchableOpacity
                    key={idx}
                    style={[styles.promptButton, { backgroundColor: colors.inputBackground, borderColor: colors.cardBorder }]}
                    onPress={() => handleStarterPrompt(prompt.text)}
                  >
                    <Text style={{ fontSize: 20, marginRight: 12 }}>{prompt.icon}</Text>
                    <Text style={{ fontSize: 14, fontWeight: '500', color: colors.text, flex: 1 }}>{prompt.text}</Text>
                    <Text style={{ fontSize: 18, fontWeight: '600', color: colors.primary }}>→</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: 340,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    borderWidth: 2,
  },
  closeButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 4,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    marginBottom: 20,
    textAlign: 'center',
  },
  micContainer: {
    marginBottom: 20,
  },
  micButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  micIcon: {
    fontSize: 28,
  },
  statusContainer: {
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    width: '100%',
  },
  processingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  transcriptText: {
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 6,
  },
  responseText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  promptsContainer: {
    width: '100%',
    borderTopWidth: 1,
    paddingTop: 16,
  },
  promptButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
  },
  optionsContainer: {
    width: '100%',
    marginTop: 8,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
  },
  confirmContainer: {
    width: '100%',
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  confirmButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
});

export default VoiceModal;