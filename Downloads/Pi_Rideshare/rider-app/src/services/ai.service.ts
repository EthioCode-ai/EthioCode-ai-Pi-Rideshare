import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiUrl } from '../config/api.config';
import { StorageKeys } from '../constants';

export interface AIVoiceCommand {
  type: 'book_ride' | 'go_to' | 'schedule' | 'check_surge' | 'cancel' | 'unknown';
  destination: string | null;
  time: string | null;
  vehicleType: 'economy' | 'standard' | 'xl' | 'premium' | null;
  response: string;
}

export interface AIRideRecommendation {
  suggestedDeparture: 'now' | string;
  waitTimeMinutes: number;
  predictedSurge: number;
  potentialSavings: number;
  recommendedVehicle: 'economy' | 'standard' | 'xl' | 'premium';
  reason: string;
  tips: string[];
}

export interface AISuggestion {
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  reason: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface AICalendarSuggestion {
  eventId: string;
  eventTitle: string;
  departureTime: string;
  destination: string;
  vehicleRecommendation: 'standard' | 'premium';
  tip: string;
}

class AIService {
  private async getAuthHeaders(): Promise<HeadersInit> {
    const token = await AsyncStorage.getItem(StorageKeys.AUTH_TOKEN);
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    };
     }
  /**
   * Transcribe audio to text using OpenAI Whisper
   */
  async transcribeAudio(audioBase64: string): Promise<{
    success: boolean;
    transcript?: string;
    error?: string;
  }> {
    try {
      const response = await fetch(apiUrl('api/ai/transcribe'), {
        method: 'POST',
        headers: await this.getAuthHeaders(),
        body: JSON.stringify({ audioBase64 }),
      });

      const data = await response.json();
      if (response.ok && data.success) {
        return { success: true, transcript: data.transcript };
      }
      return { success: false, error: data.error || 'Failed to transcribe audio' };
    } catch (error) {
      console.error('Transcription error:', error);
      return { success: false, error: 'Network error' };
    }
  }

  /**
   * Process voice command using backend AI (OpenAI)
   */
  async processVoiceCommand(transcript: string): Promise<{
    success: boolean;
    command?: AIVoiceCommand;
    error?: string;
  }> {
    try {
      const response = await fetch(apiUrl('api/ai/process-voice'), {
        method: 'POST',
        headers: await this.getAuthHeaders(),
        body: JSON.stringify({ transcript }),
      });

      const data = await response.json();
      if (response.ok && data.success) {
        return { success: true, command: data.command };
      }
      return { success: false, error: data.error || 'Failed to process voice command' };
    } catch (error) {
      console.error('AI voice processing error:', error);
      return { success: false, error: 'Network error' };
    }
  }

  /**
   * Get AI-powered ride recommendation
   */
  async getRideRecommendation(
    pickup: { latitude: number; longitude: number; address: string },
    destination: { latitude: number; longitude: number; address: string },
    userPreferences?: Record<string, any>
  ): Promise<{
    success: boolean;
    recommendation?: AIRideRecommendation;
    error?: string;
  }> {
    try {
      const response = await fetch(apiUrl('api/ai/ride-recommendation'), {
        method: 'POST',
        headers: await this.getAuthHeaders(),
        body: JSON.stringify({
          pickup,
          destination,
          userPreferences,
        }),
      });

      const data = await response.json();
      if (response.ok && data.success) {
        return { success: true, recommendation: data.recommendation };
      }
      return { success: false, error: data.error || 'Failed to get recommendation' };
    } catch (error) {
      console.error('AI recommendation error:', error);
      return { success: false, error: 'Network error' };
    }
  }

  /**
   * Get smart destination suggestions based on history and time of day
   */
  async getSmartSuggestions(): Promise<{
    success: boolean;
    suggestions?: AISuggestion[];
    error?: string;
  }> {
    try {
      const response = await fetch(apiUrl('api/ai/suggestions'), {
        method: 'GET',
        headers: await this.getAuthHeaders(),
      });

      const data = await response.json();
      if (response.ok && data.success) {
        return { success: true, suggestions: data.suggestions };
      }
      return { success: false, error: data.error || 'Failed to get suggestions' };
    } catch (error) {
      console.error('AI suggestions error:', error);
      return { success: false, error: 'Network error' };
    }
  }

  /**
   * Get calendar-based ride suggestions
   */
  async getCalendarSuggestions(events: Array<{
    id: string;
    title: string;
    location: string;
    startDate: string;
    endDate: string;
  }>): Promise<{
    success: boolean;
    suggestions?: AICalendarSuggestion[];
    error?: string;
  }> {
    try {
      const response = await fetch(apiUrl('api/ai/calendar-suggestions'), {
        method: 'POST',
        headers: await this.getAuthHeaders(),
        body: JSON.stringify({ events }),
      });

      const data = await response.json();
      if (response.ok && data.success) {
        return { success: true, suggestions: data.suggestions };
      }
      return { success: false, error: data.error || 'Failed to get calendar suggestions' };
    } catch (error) {
      console.error('AI calendar suggestions error:', error);
      return { success: false, error: 'Network error' };
    }
  }

  /**
   * Get surge prediction for a location
   */
  async getSurgePrediction(
    latitude: number,
    longitude: number
  ): Promise<{
    success: boolean;
    prediction?: {
      currentSurge: number;
      predictedSurge: number;
      bestTimeToRide: string;
      savings: number;
    };
    error?: string;
  }> {
    try {
      const response = await fetch(apiUrl('api/ai/ride-recommendation'), {
        method: 'POST',
        headers: await this.getAuthHeaders(),
        body: JSON.stringify({
          pickup: { latitude, longitude },
          destination: { latitude, longitude }, // Same location for surge check
        }),
      });

      const data = await response.json();
      if (response.ok && data.success) {
        const rec = data.recommendation;
        return {
          success: true,
          prediction: {
            currentSurge: rec.predictedSurge || 1.0,
            predictedSurge: rec.predictedSurge || 1.0,
            bestTimeToRide: rec.suggestedDeparture || 'now',
            savings: rec.potentialSavings || 0,
          },
        };
      }
      return { success: false, error: data.error || 'Failed to get surge prediction' };
    } catch (error) {
      console.error('Surge prediction error:', error);
      return { success: false, error: 'Network error' };
    }
  }
}

export const aiService = new AIService();
export default aiService;