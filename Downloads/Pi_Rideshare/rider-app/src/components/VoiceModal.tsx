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
import { aiService } from '../services/ai.service';
import { rideService } from '../services/ride.service';
import { StorageKeys } from '../constants';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';


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

type ModalState = 'idle' | 'listening' | 'processing' | 'responding' | 'confirming' | 'selecting' | 'choose_vehicle' | 'choose_preferences' | 'confirm_booking';

interface BookingFlow {
  destination: { latitude: number; longitude: number; address: string; name?: string } | null;
  pickup: { latitude: number; longitude: number; address: string } | null;
  vehicleType: 'economy' | 'standard' | 'xl' | 'premium' | null;
  preferences: string[];
  fare: number | null;
}

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

  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);

  const [bookingFlow, setBookingFlow] = useState<BookingFlow>({
    destination: null,
    pickup: null,
    vehicleType: null,
    preferences: [],
    fare: null,
  });

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
// Play Google Cloud TTS audio with fallback to expo-speech
  const speakWithGoogleTTS = async (text: string) => {
    try {
      const result = await aiService.speak(text);
      
      if (result.success && result.audioContent) {
        const { sound } = await Audio.Sound.createAsync(
          { uri: `data:audio/mp3;base64,${result.audioContent}` }
        );
        await sound.playAsync();
        
        // Wait for audio to finish
        const duration = Math.max(2000, text.length * 80);
        await new Promise(resolve => setTimeout(resolve, duration));
        await sound.unloadAsync();
      } else {
        // Fallback to expo-speech
        await voiceAIService.speak(text);
      }
    } catch (error) {
      console.error('TTS error, falling back:', error);
      await voiceAIService.speak(text);
    }
  };
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

  // Check for saved place by name (home, work, etc.)
  const getSavedPlace = async (placeName: string): Promise<{ latitude: number; longitude: number; address: string } | null> => {
    try {
      const data = await AsyncStorage.getItem(StorageKeys.SAVED_PLACES);
      if (data) {
        const places = JSON.parse(data);
        const place = places.find((p: any) => 
          p.name.toLowerCase() === placeName.toLowerCase() ||
          p.name.toLowerCase().includes(placeName.toLowerCase())
        );
        if (place) {
          return { latitude: place.latitude, longitude: place.longitude, address: place.address };
        }
      }
      return null;
    } catch (error) {
      console.error('Error getting saved place:', error);
      return null;
    }
  };

  // Get fare estimate for the booking
  const getFareEstimate = async (pickup: any, destination: any, vehicleType: string): Promise<number | null> => {
    try {
      const result = await rideService.getEstimate(pickup, destination);
      if (result.success && result.estimates) {
        const estimate = result.estimates.find((e: any) => e.vehicleType === vehicleType);
        return estimate?.totalFare || null;
      }
      return null;
    } catch (error) {
      console.error('Error getting fare estimate:', error);
      return null;
    }
  };

  // Start the booking flow when destination is identified
  const startBookingFlow = async (destination: { latitude: number; longitude: number; address: string; name?: string }) => {
    if (!userLocation) {
      await speakWithGoogleTTS("I couldn't get your location. Please try again.");
      return;
    }
    
    // Get current address for pickup
    const pickupAddress = await Location.reverseGeocodeAsync(userLocation);
    const pickup = {
      latitude: userLocation.latitude,
      longitude: userLocation.longitude,
      address: pickupAddress[0] ? `${pickupAddress[0].streetNumber || ''} ${pickupAddress[0].street || ''}, ${pickupAddress[0].city || ''}`.trim() : 'Current Location',
    };
    
    setBookingFlow({
      destination,
      pickup,
      vehicleType: null,
      preferences: [],
      fare: null,
    });
    
    setModalState('choose_vehicle');
    setResponse(`Taking you to ${destination.name || destination.address}`);
    await speakWithGoogleTTS(`Taking you to ${destination.name || destination.address}. Would you prefer an Economy, Standard, XL, or Premium ride?`);
    setResponse('Choose: Economy, Standard, XL, or Premium');
    
    // Start listening for vehicle choice
    setTimeout(() => startRecording(), 3000);
  };

  // Handle conversational booking flow
  const handleBookingConversation = async (userInput: string) => {
    const input = userInput.toLowerCase();
    
    // STATE: Choose Vehicle
    if (modalState === 'choose_vehicle') {
      let selectedVehicle: 'economy' | 'standard' | 'xl' | 'premium' | null = null;
      
      if (input.includes('economy') || input.includes('cheap') || input.includes('budget')) {
        selectedVehicle = 'economy';
      } else if (input.includes('standard') || input.includes('regular') || input.includes('normal')) {
        selectedVehicle = 'standard';
      } else if (input.includes('xl') || input.includes('large') || input.includes('big') || input.includes('suv')) {
        selectedVehicle = 'xl';
      } else if (input.includes('premium') || input.includes('luxury') || input.includes('business')) {
        selectedVehicle = 'premium';
      }
      
      if (selectedVehicle) {
        setBookingFlow(prev => ({ ...prev, vehicleType: selectedVehicle }));
        setModalState('choose_preferences');
        setResponse('Select preferences or say "none"');
        await speakWithGoogleTTS("Any ride preferences? AC On, Quiet Ride, Curbside Pickup, or Pet Friendly Car? Say none if no preferences.");
        // Start listening again
        setTimeout(() => startRecording(), 3500);
      } else {
        await speakWithGoogleTTS("Sorry, I didn't catch that. Would you prefer Economy, Standard, XL, or Premium?");
        setTimeout(() => startRecording(), 2500);
      }
      return;
    }
    
    // STATE: Choose Preferences
    if (modalState === 'choose_preferences') {
      const prefs: string[] = [];
      
      if (input.includes('ac') || input.includes('air condition') || input.includes('cool')) {
        prefs.push('ac_on');
      }
      if (input.includes('quiet') || input.includes('silent') || input.includes('no talk')) {
        prefs.push('quiet_ride');
      }
      if (input.includes('curbside') || input.includes('curb')) {
        prefs.push('curbside');
      }
      if (input.includes('pet') || input.includes('dog') || input.includes('cat')) {
        prefs.push('with_pet');
      }
      
      setBookingFlow(prev => ({ ...prev, preferences: prefs }));
      
      // Get fare estimate
      if (bookingFlow.pickup && bookingFlow.destination && bookingFlow.vehicleType) {
        setModalState('processing');
        setResponse('Calculating fare...');
        
        const fare = await getFareEstimate(bookingFlow.pickup, bookingFlow.destination, bookingFlow.vehicleType);
        setBookingFlow(prev => ({ ...prev, fare }));
        
        const vehicleName = bookingFlow.vehicleType.charAt(0).toUpperCase() + bookingFlow.vehicleType.slice(1);
        const fareText = fare ? `$${fare.toFixed(2)}` : 'estimated fare';
        
        setModalState('confirm_booking');
        setResponse(`Confirm ${vehicleName} for ${fareText}?`);
        await speakWithGoogleTTS(`Confirm your ${vehicleName} ride to ${bookingFlow.destination?.name || bookingFlow.destination?.address} for ${fareText}? Say Yes to book or No to cancel.`);
        setTimeout(() => startRecording(), 3500);
      }
      return;
    }
    
    // STATE: Confirm Booking
    if (modalState === 'confirm_booking') {
      if (input.includes('yes') || input.includes('confirm') || input.includes('book') || input.includes('ok')) {
        setModalState('processing');
        setResponse('Booking your ride...');
        
        try {
          const result = await rideService.requestRide(
            bookingFlow.pickup!,
            bookingFlow.destination!,
            bookingFlow.vehicleType!,
            'card',
            bookingFlow.preferences
          );
          
          if (result.success) {
            await speakWithGoogleTTS("Your ride has been booked! A driver is on the way.");
            setResponse('Ride booked successfully!');
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            
            // Navigate to ride tracking
            onCommandProcessedRef.current({
              type: 'ride_booked',
              action: 'ride_booked',
              destination: {
                name: bookingFlow.destination?.name || '',
                address: bookingFlow.destination!.address,
                latitude: bookingFlow.destination!.latitude,
                longitude: bookingFlow.destination!.longitude,
              },
              vehicleType: bookingFlow.vehicleType!,
              response: 'Ride booked successfully!',
            });
            
            setTimeout(() => onCloseRef.current(), 2000);
          } else {
            await speakWithGoogleTTS("Sorry, I couldn't book the ride. Please try again.");
            setResponse('Booking failed. Please try again.');
            setTimeout(() => onCloseRef.current(), 2000);
          }
        } catch (error) {
          await speakWithGoogleTTS("Sorry, there was an error booking your ride.");
          setResponse('Error booking ride.');
          setTimeout(() => onCloseRef.current(), 2000);
        }
      } else if (input.includes('no') || input.includes('cancel') || input.includes('stop')) {
        await speakWithGoogleTTS("Booking cancelled.");
        setResponse('Booking cancelled.');
        setTimeout(() => onCloseRef.current(), 1500);
      } else {
        await speakWithGoogleTTS("Please say Yes to confirm or No to cancel.");
        setTimeout(() => startRecording(), 2000);
      }
      return;
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
  }, 
  
  []);

  const startRecording = async () => {
    try {
      // Request permissions
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        setResponse('Microphone permission required');
        return;
      }

      // Configure audio mode
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      // Start recording
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      
      setRecording(recording);
      setIsRecording(true);
      setModalState('listening');
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      
      // Auto-stop after 10 seconds
      timeoutRef.current = setTimeout(() => {
        stopRecordingAndProcess();
      }, 10000);
      
    } catch (error) {
      console.error('Failed to start recording:', error);
      setResponse('Failed to start recording');
    }
  };

  const stopRecordingAndProcess = async () => {
    if (!recording) return;
    
    setIsRecording(false);
    setModalState('processing');
    
    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(null);
      
      if (!uri) {
        setResponse('No audio recorded');
        setModalState('idle');
        return;
      }

      // Read audio file as base64
      const base64Audio = await FileSystem.readAsStringAsync(uri, {
        encoding: 'base64',
      });

      // Transcribe audio
      const transcribeResult = await aiService.transcribeAudio(base64Audio);
      
      if (!transcribeResult.success || !transcribeResult.transcript) {
        setResponse('Could not understand audio. Please try again.');
        setModalState('idle');
        setTimeout(() => onCloseRef.current(), 2000);
        return;
      }

      const transcript = transcribeResult.transcript;
      setTranscript(transcript);
      
      // Check if we're in a booking conversation flow
      if (modalState === 'choose_vehicle' || modalState === 'choose_preferences' || modalState === 'confirm_booking') {
        await handleBookingConversation(transcript);
        return;
      }
      
      // Process the transcribed text (normal flow)
      await handleStarterPrompt(transcript);
      
    } catch (error) {
      console.error('Error processing recording:', error);
      setResponse('Error processing audio');
      setModalState('idle');
      setTimeout(() => onCloseRef.current(), 2000);
    }
  };
  
  const handleStarterPrompt = async (promptText: string) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setTranscript(promptText);
    setModalState('processing');
    await saveCommandToHistory(promptText);

    try {
      // Check for saved place keywords first (home, work, etc.)
      const savedPlaceKeywords = ['home', 'work', 'office', 'gym', 'school'];
      const lowerPrompt = promptText.toLowerCase();
      
      for (const keyword of savedPlaceKeywords) {
        if (lowerPrompt.includes(keyword)) {
          const savedPlace = await getSavedPlace(keyword);
          if (savedPlace) {
            setResponse(`Found your saved ${keyword} location`);
            await startBookingFlow({ 
              ...savedPlace, 
              name: keyword.charAt(0).toUpperCase() + keyword.slice(1) 
            });
            return;
          }
        }
      }
      
      // Try backend AI first
      const aiResult = await aiService.processVoiceCommand(promptText);
      
      if (aiResult.success && aiResult.command) {
        const cmd = aiResult.command;
        setResponse(cmd.response);
        await speakWithGoogleTTS(cmd.response);

        // Map AI response to VoiceCommandResult
        if (cmd.type === 'go_to' || cmd.type === 'book_ride') {
          if (cmd.destination) {
            // Check if it's airport
            if (cmd.destination.toLowerCase().includes('airport')) {
              const airports = await voiceAIService.findNearbyAirports(
                userLocation?.latitude || 36.3729,
                userLocation?.longitude || -94.2088
              );
              
              if (airports.length > 1) {
                setPendingResult({
                  type: 'clarify_airport',
                  response: cmd.response,
                  action: 'show_options',
                  options: airports.slice(0, 2),
                });
                setAirportOptions(airports.slice(0, 2));
                setModalState('selecting');
                return;
              } else if (airports.length === 1) {
                const result: VoiceCommandResult = {
                  type: 'book_ride',
                  destination: {
                    name: airports[0].name,
                    address: airports[0].address,
                    latitude: airports[0].latitude,
                    longitude: airports[0].longitude,
                  },
                  response: cmd.response,
                  action: 'navigate_confirm',
                  requiresConfirmation: true,
                };
                setPendingResult(result);
                setModalState('confirming');
                return;
              }
            }
            
            // Generic destination - go to search
            const result: VoiceCommandResult = {
              type: 'book_ride',
              response: cmd.response,
              action: 'navigate_search',
            };
            setModalState('responding');
            setTimeout(() => navigateToConfirm(result), 1500);
            return;
          }
        } else if (cmd.type === 'schedule' && cmd.time) {
          const scheduledTime = voiceAIService.parseTimeFromCommand(cmd.time);
          if (scheduledTime) {
            const result: VoiceCommandResult = {
              type: 'schedule_ride',
              scheduledTime,
              response: cmd.response,
              action: 'navigate_search',
            };
            setModalState('responding');
            setTimeout(() => navigateToConfirm(result), 1500);
            return;
          }
        } else if (cmd.type === 'check_surge') {
          // Get real surge prediction
          const surgeResult = await aiService.getSurgePrediction(
            userLocation?.latitude || 36.3729,
            userLocation?.longitude || -94.2088
          );
          
          if (surgeResult.success && surgeResult.prediction) {
            const p = surgeResult.prediction;
            const surgeMsg = p.currentSurge > 1 
              ? `Current surge is ${p.currentSurge}x. ${p.bestTimeToRide === 'now' ? "It's a good time to ride!" : `Wait ${p.bestTimeToRide} to save $${p.savings}.`}`
              : "No surge right now! It's a great time to ride.";
            setResponse(surgeMsg);
            await speakWithGoogleTTS(surgeMsg);
          }
          setModalState('responding');
          setTimeout(() => onCloseRef.current(), 3000);
          return;
        }

        // Default - just show response
        setModalState('responding');
        setTimeout(() => onCloseRef.current(), 2500);
        return;
      }

      // Fallback to local processing if AI fails
      const result = await voiceAIService.processCommand(promptText, userLocation);
      setResponse(result.response);
      await speakWithGoogleTTS(result.response);

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
      await speakWithGoogleTTS("Confirming your ride.");
      navigateToConfirm(pendingResult);
    }
  };

  const handleCancel = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setResponse("Cancelled.");
    speakWithGoogleTTS("Cancelled.");
    setTimeout(() => onCloseRef.current(), 1000);
  };

    const handleMicPress = async () => {
    if (isRecording) {
      // Stop recording and process
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      await stopRecordingAndProcess();
    } else {
      // Start recording
      await startRecording();
      startPulseAnimation();
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
                    {modalState === 'processing' ? '⏳' : isRecording ? '⏹️' : '🎤'}
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