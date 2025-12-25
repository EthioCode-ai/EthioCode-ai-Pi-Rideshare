import * as Speech from 'expo-speech';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { placesService } from './places.service';
import { StorageKeys } from '../constants';

export interface VoiceCommandResult {
  type: 'book_ride' | 'schedule_ride' | 'find_driver' | 'cancel' | 'help' | 'unknown' | 'clarify_airport';
  destination?: {
    name: string;
    address: string;
    latitude: number;
    longitude: number;
  };
  scheduledTime?: Date;
  vehicleType?: string;
  response: string;
  action: 'navigate_confirm' | 'navigate_search' | 'navigate_active' | 'show_options' | 'none';
  options?: Array<{
    name: string;
    address: string;
    latitude: number;
    longitude: number;
    placeId: string;
  }>;
  requiresConfirmation?: boolean;
  confirmationPrompt?: string;
}

interface SavedPlace {
  label: string;
  name: string;
  location: {
    latitude: number;
    longitude: number;
    address?: string;
  };
}

class VoiceAIService {
  // Text-to-speech
  async speak(text: string): Promise<void> {
    return new Promise((resolve) => {
      Speech.speak(text, {
        language: 'en-US',
        pitch: 1.0,
        rate: 0.95,
        onDone: () => resolve(),
        onError: () => resolve(),
      });
    });
  }

  stopSpeaking(): void {
    Speech.stop();
  }

  // Parse time from voice command (e.g., "8 am", "8:30 pm", "tomorrow at 9am")
  parseTimeFromCommand(command: string): Date | null {
    const now = new Date();
    const lowerCommand = command.toLowerCase();

    // Match patterns like "8 am", "8:00 am", "8:30 pm"
    const timeMatch = lowerCommand.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i);
    if (!timeMatch) return null;

    let hours = parseInt(timeMatch[1]);
    const minutes = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
    const period = timeMatch[3].toLowerCase();

    if (period === 'pm' && hours !== 12) hours += 12;
    if (period === 'am' && hours === 12) hours = 0;

    const scheduledDate = new Date(now);
    scheduledDate.setHours(hours, minutes, 0, 0);

    // If time has passed today, schedule for tomorrow
    if (scheduledDate <= now) {
      scheduledDate.setDate(scheduledDate.getDate() + 1);
    }

    // Check for "tomorrow" keyword - ensure it's tomorrow
    if (lowerCommand.includes('tomorrow')) {
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      scheduledDate.setFullYear(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate());
    }

    return scheduledDate;
  }

  // Format time for speech output
  formatTimeForSpeech(date: Date): string {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);

    let dayStr = '';
    if (date.toDateString() === now.toDateString()) {
      dayStr = 'today';
    } else if (date.toDateString() === tomorrow.toDateString()) {
      dayStr = 'tomorrow';
    } else {
      dayStr = date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
    }

    const timeStr = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    return `${timeStr} ${dayStr}`;
  }

  // Get saved places from AsyncStorage
  private async getSavedPlaces(): Promise<SavedPlace[]> {
    try {
      const data = await AsyncStorage.getItem(StorageKeys.SAVED_PLACES);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  // Find airports near user using Google Places API
  async findNearbyAirports(
    userLat: number,
    userLng: number
  ): Promise<Array<{ name: string; address: string; latitude: number; longitude: number; placeId: string }>> {
    try {
      // Use Places autocomplete with "airport" query biased to user location
      const results = await placesService.autocomplete('airport', { latitude: userLat, longitude: userLng });

      // Filter to only airport-related results and get details for top 3
      const airportResults = results
        .filter(r => 
          r.description.toLowerCase().includes('airport') ||
          r.mainText.toLowerCase().includes('airport')
        )
        .slice(0, 3);

      // Get full details for each airport
      const airportsWithDetails = await Promise.all(
        airportResults.map(async (result) => {
          try {
            const details = await placesService.getPlaceDetails(result.placeId);
            if (details) {
              return {
                name: result.mainText,
                address: details.address,
                latitude: details.latitude,
                longitude: details.longitude,
                placeId: result.placeId,
              };
            }
          } catch (e) {
            console.error('Error getting airport details:', e);
          }
          return null;
        })
      );

      return airportsWithDetails.filter((a): a is NonNullable<typeof a> => a !== null);
    } catch (error) {
      console.error('Error finding airports:', error);
      return [];
    }
  }

  // Main command processor
  async processCommand(
    command: string,
    userLocation: { latitude: number; longitude: number } | null
  ): Promise<VoiceCommandResult> {
    const lowerCommand = command.toLowerCase().trim();

    // Get user location if not provided
    let location = userLocation;
    if (!location) {
      try {
        const loc = await Location.getCurrentPositionAsync({});
        location = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
      } catch {
        // Default fallback (Bentonville, AR)
        location = { latitude: 36.3729, longitude: -94.2088 };
      }
    }

    // ===== AIRPORT COMMANDS =====
    if (this.isAirportCommand(lowerCommand)) {
      return this.handleAirportCommand(lowerCommand, location);
    }

    // ===== SCHEDULE COMMANDS =====
    if (this.isScheduleCommand(lowerCommand)) {
      return this.handleScheduleCommand(lowerCommand, location);
    }

    // ===== DRIVER STATUS COMMANDS =====
    if (this.isDriverStatusCommand(lowerCommand)) {
      return {
        type: 'find_driver',
        response: "Let me check on your driver's location.",
        action: 'navigate_active',
      };
    }

    // ===== GO TO / TAKE ME TO COMMANDS =====
    if (this.isGoToCommand(lowerCommand)) {
      return this.handleGoToCommand(lowerCommand, location);
    }

    // ===== SURGE CHECK COMMANDS =====
    if (this.isSurgeCommand(lowerCommand)) {
      return {
        type: 'help',
        response: "Current surge is 1.0x. It's a great time to ride!",
        action: 'none',
      };
    }

    // ===== CANCEL COMMANDS =====
    if (this.isCancelCommand(lowerCommand)) {
      return {
        type: 'cancel',
        response: "Okay, cancelled.",
        action: 'none',
      };
    }

    // ===== HELP COMMANDS =====
    if (this.isHelpCommand(lowerCommand)) {
      return {
        type: 'help',
        response: "You can say: Take me to the airport, Schedule ride for 8 AM, What's surge right now, or Where's my driver.",
        action: 'none',
      };
    }

    // ===== UNKNOWN =====
    return {
      type: 'unknown',
      response: "I didn't understand that. Try saying 'Take me to the airport' or 'Schedule ride for 8 AM'.",
      action: 'none',
    };
  }

  // Command type checkers
  private isAirportCommand(cmd: string): boolean {
    return (
      cmd.includes('airport') ||
      cmd.includes('fly') ||
      cmd.includes('flight') ||
      cmd.includes('terminal')
    );
  }

  private isScheduleCommand(cmd: string): boolean {
    return (
      cmd.includes('schedule') ||
      cmd.includes('book for') ||
      cmd.includes('pick me up at') ||
      (cmd.includes('tomorrow') && (cmd.includes('am') || cmd.includes('pm')))
    );
  }

  private isDriverStatusCommand(cmd: string): boolean {
    return (
      cmd.includes("where's my driver") ||
      cmd.includes('where is my driver') ||
      cmd.includes('driver status') ||
      cmd.includes('how far is my driver') ||
      cmd.includes('eta')
    );
  }

  private isGoToCommand(cmd: string): boolean {
    return (
      cmd.includes('take me to') ||
      cmd.includes('go to') ||
      cmd.includes('drive to') ||
      cmd.includes('head to')
    );
  }

  private isSurgeCommand(cmd: string): boolean {
    return (
      cmd.includes('surge') ||
      cmd.includes('pricing') ||
      cmd.includes('how much')
    );
  }

  private isCancelCommand(cmd: string): boolean {
    return (
      cmd.includes('cancel') ||
      cmd.includes('nevermind') ||
      cmd.includes('never mind') ||
      cmd.includes('stop')
    );
  }

  private isHelpCommand(cmd: string): boolean {
    return (
      cmd.includes('help') ||
      cmd.includes('what can you do') ||
      cmd.includes('commands')
    );
  }

  // Handle airport-related commands
  private async handleAirportCommand(
    command: string,
    location: { latitude: number; longitude: number }
  ): Promise<VoiceCommandResult> {
    const scheduledTime = this.parseTimeFromCommand(command);
    const airports = await this.findNearbyAirports(location.latitude, location.longitude);

    if (airports.length === 0) {
      return {
        type: 'unknown',
        response: "I couldn't find any airports nearby. Please search manually.",
        action: 'navigate_search',
      };
    }

    // Single airport found
    if (airports.length === 1) {
      return this.buildAirportResult(airports[0], scheduledTime);
    }

    // Multiple airports - ask for clarification
    const airportNames = airports.slice(0, 2).map(a => a.name).join(' or ');
    return {
      type: 'clarify_airport',
      response: `I found multiple airports. Would you like to go to ${airportNames}?`,
      action: 'show_options',
      options: airports.slice(0, 2),
      scheduledTime: scheduledTime || undefined,
    };
  }

  // Build airport result
  private buildAirportResult(
    airport: { name: string; address: string; latitude: number; longitude: number },
    scheduledTime: Date | null
  ): VoiceCommandResult {
    const destination = {
      name: airport.name,
      address: airport.address,
      latitude: airport.latitude,
      longitude: airport.longitude,
    };

    if (scheduledTime) {
      const timeStr = this.formatTimeForSpeech(scheduledTime);
      return {
        type: 'schedule_ride',
        destination,
        scheduledTime,
        response: `Scheduling a ride to ${airport.name} for ${timeStr}. Should I confirm?`,
        action: 'navigate_confirm',
        requiresConfirmation: true,
        confirmationPrompt: `I'll schedule your ride to ${airport.name} for ${timeStr}. Should I confirm this booking?`,
      };
    }

    return {
      type: 'book_ride',
      destination,
      response: `Taking you to ${airport.name}. Should I confirm?`,
      action: 'navigate_confirm',
      requiresConfirmation: true,
      confirmationPrompt: `I'll request a ride to ${airport.name}. Should I confirm?`,
    };
  }

  // Handle schedule commands
  private async handleScheduleCommand(
    command: string,
    location: { latitude: number; longitude: number }
  ): Promise<VoiceCommandResult> {
    const scheduledTime = this.parseTimeFromCommand(command);

    if (!scheduledTime) {
      return {
        type: 'schedule_ride',
        response: "What time would you like to schedule your ride?",
        action: 'none',
      };
    }

    // Check if airport is mentioned
    if (this.isAirportCommand(command)) {
      return this.handleAirportCommand(command, location);
    }

    // Check for work/home
    const savedPlaces = await this.getSavedPlaces();

    if (command.includes('work')) {
      const work = savedPlaces.find(p => p.label === 'work');
      if (work) {
        return this.buildSavedPlaceResult('Work', work, scheduledTime);
      }
    }

    if (command.includes('home')) {
      const home = savedPlaces.find(p => p.label === 'home');
      if (home) {
        return this.buildSavedPlaceResult('Home', home, scheduledTime);
      }
    }

    // No destination specified - go to search
    const timeStr = this.formatTimeForSpeech(scheduledTime);
    return {
      type: 'schedule_ride',
      scheduledTime,
      response: `Scheduling for ${timeStr}. Where would you like to go?`,
      action: 'navigate_search',
    };
  }

  // Handle go to commands
  private async handleGoToCommand(
    command: string,
    location: { latitude: number; longitude: number }
  ): Promise<VoiceCommandResult> {
    const savedPlaces = await this.getSavedPlaces();

    // Extract destination from command
    let destination = command
      .replace(/take me to/gi, '')
      .replace(/go to/gi, '')
      .replace(/drive to/gi, '')
      .replace(/head to/gi, '')
      .replace(/the/gi, '')
      .trim();

    // Check for airport
    if (this.isAirportCommand(destination)) {
      return this.handleAirportCommand(command, location);
    }

    // Check for work
    if (destination.includes('work')) {
      const work = savedPlaces.find(p => p.label === 'work');
      if (work) {
        return this.buildSavedPlaceResult('Work', work, null);
      }
      return {
        type: 'unknown',
        response: "You haven't saved a work address yet. Please set it in your saved places.",
        action: 'none',
      };
    }

    // Check for home
    if (destination.includes('home')) {
      const home = savedPlaces.find(p => p.label === 'home');
      if (home) {
        return this.buildSavedPlaceResult('Home', home, null);
      }
      return {
        type: 'unknown',
        response: "You haven't saved a home address yet. Please set it in your saved places.",
        action: 'none',
      };
    }

    // Generic destination - navigate to search
    return {
      type: 'book_ride',
      response: `Searching for "${destination}". Please select from the results.`,
      action: 'navigate_search',
    };
  }

  // Build saved place result
  private buildSavedPlaceResult(
    label: string,
    place: SavedPlace,
    scheduledTime: Date | null
  ): VoiceCommandResult {
    const destination = {
      name: label,
      address: place.location.address || place.name,
      latitude: place.location.latitude,
      longitude: place.location.longitude,
    };

    if (scheduledTime) {
      const timeStr = this.formatTimeForSpeech(scheduledTime);
      return {
        type: 'schedule_ride',
        destination,
        scheduledTime,
        response: `Scheduling a ride to ${label} for ${timeStr}. Should I confirm?`,
        action: 'navigate_confirm',
        requiresConfirmation: true,
        confirmationPrompt: `I'll schedule your ride to ${label} for ${timeStr}. Should I confirm?`,
      };
    }

    return {
      type: 'book_ride',
      destination,
      response: `Taking you to ${label}. Should I confirm?`,
      action: 'navigate_confirm',
      requiresConfirmation: true,
      confirmationPrompt: `I'll request a ride to ${label}. Should I confirm?`,
    };
  }
}

export const voiceAIService = new VoiceAIService();
export default voiceAIService;