import * as Speech from 'expo-speech';
import { Audio } from 'expo-av';

export interface VoiceCommand {
  type: 'book_ride' | 'go_to' | 'schedule' | 'check_surge' | 'cancel' | 'unknown';
  destination?: string;
  time?: string;
  vehicleType?: string;
  rawText: string;
}

class VoiceService {
  private isListening: boolean = false;
  private recording: Audio.Recording | null = null;

  async initialize(): Promise<boolean> {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        return false;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      return true;
    } catch (error) {
      console.error('Voice service initialization error:', error);
      return false;
    }
  }

  // Parse voice command text into structured command
  parseCommand(text: string): VoiceCommand {
    const lowerText = text.toLowerCase().trim();

    // "Take me to [destination]" or "Go to [destination]"
    const goToMatch = lowerText.match(/(?:take me to|go to|drive me to|head to)\s+(.+)/);
    if (goToMatch) {
      return {
        type: 'go_to',
        destination: goToMatch[1],
        rawText: text,
      };
    }

    // "Book a ride to [destination]"
    const bookMatch = lowerText.match(/book\s+(?:a\s+)?(?:ride\s+)?(?:an?\s+)?(\w+)?\s*(?:to\s+)?(.+)?/);
    if (bookMatch) {
      return {
        type: 'book_ride',
        vehicleType: bookMatch[1],
        destination: bookMatch[2],
        rawText: text,
      };
    }

    // "Schedule [ride] for [time]" or "Schedule [ride] to [destination] at [time]"
    const scheduleMatch = lowerText.match(/schedule\s+(?:a\s+)?(?:ride\s+)?(?:to\s+)?(.+?)?\s*(?:at|for|tomorrow at)?\s*(\d+(?::\d+)?\s*(?:am|pm)?)?/);
    if (scheduleMatch || lowerText.includes('schedule')) {
      return {
        type: 'schedule',
        destination: scheduleMatch?.[1],
        time: scheduleMatch?.[2],
        rawText: text,
      };
    }

    // "What's the surge" or "Check surge"
    if (lowerText.includes('surge') || lowerText.includes('pricing')) {
      return {
        type: 'check_surge',
        rawText: text,
      };
    }

    // "Cancel"
    if (lowerText.includes('cancel')) {
      return {
        type: 'cancel',
        rawText: text,
      };
    }

    // Common destinations
    if (lowerText.includes('home')) {
      return { type: 'go_to', destination: 'home', rawText: text };
    }
    if (lowerText.includes('work') || lowerText.includes('office')) {
      return { type: 'go_to', destination: 'work', rawText: text };
    }
    if (lowerText.includes('airport')) {
      return { type: 'go_to', destination: 'airport', rawText: text };
    }

    return { type: 'unknown', rawText: text };
  }

  // Text to speech
  async speak(text: string, options?: { rate?: number; pitch?: number }): Promise<void> {
    return new Promise((resolve) => {
      Speech.speak(text, {
        rate: options?.rate || 0.9,
        pitch: options?.pitch || 1.0,
        onDone: () => resolve(),
        onError: () => resolve(),
      });
    });
  }

  stopSpeaking() {
    Speech.stop();
  }

  // AI response generation (placeholder - would connect to backend AI)
  generateResponse(command: VoiceCommand): string {
    switch (command.type) {
      case 'go_to':
        return `Finding a ride to ${command.destination}. Let me check the best options for you.`;
      case 'book_ride':
        const vehicle = command.vehicleType || 'standard';
        return `Booking a ${vehicle} ride${command.destination ? ` to ${command.destination}` : ''}. Please confirm your pickup location.`;
      case 'schedule':
        return `I'll help you schedule a ride${command.destination ? ` to ${command.destination}` : ''}${command.time ? ` at ${command.time}` : ''}. Let me check availability.`;
      case 'check_surge':
        return `Let me check the current surge pricing in your area.`;
      case 'cancel':
        return `I'll cancel your current ride request.`;
      default:
        return `I'm not sure I understood. You can say things like "Take me to the airport" or "Book a ride to work".`;
    }
  }

  // Suggested voice commands
  getSuggestions(): string[] {
    return [
      '"Take me to the airport"',
      '"Book a ride to work"',
      '"What\'s the surge right now?"',
      '"Schedule a ride for tomorrow at 8am"',
      '"When should I leave for my meeting?"',
    ];
  }
}

export const voiceService = new VoiceService();
export default voiceService;