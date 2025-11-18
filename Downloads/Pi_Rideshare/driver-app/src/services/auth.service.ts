/**
 * Auth Service
 * 
 * Handles all authentication operations:
 * - Login (email/password)
 * - Logout
 * - Token management
 * - User session persistence
 * 
 * Uses api.service for HTTP requests
 */

import apiService from './api.service';
import { SHARED_ENDPOINTS } from '../config/api.config';

/**
 * User Interface
 */
export interface User {
  id: string;
  email: string;
  name: string;
  role: 'driver' | 'rider' | 'admin';
  phone?: string;
  rating?: number;
  isAvailable?: boolean;
  vehicleInfo?: {
    make: string;
    model: string;
    year: number;
    color: string;
    licensePlate: string;
  };
}

/**
 * Login Credentials
 */
export interface LoginCredentials {
  email: string;
  password: string;
}

/**
 * Login Response
 */
export interface LoginResponse {
  success: boolean;
  token: string;
  user: User;
  message?: string;
}

/**
 * Register Data
 */
export interface RegisterData {
  email: string;
  password: string;
  name: string;
  phone: string;
  role: 'driver' | 'rider';
}

/**
 * Auth Service Methods
 */
const authService = {
  /**
   * Login
   * 
   * Authenticates user and stores token + user data
   * 
   * @param credentials - Email and password
   * @returns Promise<LoginResponse>
   */
  login: async (credentials: LoginCredentials): Promise<LoginResponse> => {
    try {
      console.log('🔐 Attempting login:', credentials.email);

      // Make login request
      const response = await apiService.post<LoginResponse>(
        SHARED_ENDPOINTS.LOGIN,
        credentials
      );

      if (response.success && response.token && response.user) {
        // Store token
        await apiService.setToken(response.token);
        
        // Store user data
        await apiService.setUserData(response.user);

        console.log('✅ Login successful:', response.user.email);
        
        return response;
      } else {
        throw new Error('Invalid login response');
      }
    } catch (error: any) {
      console.error('❌ Login failed:', error);
      throw {
        success: false,
        message: error.message || 'Login failed. Please check your credentials.',
      };
    }
  },

  /**
   * Register
   * 
   * Creates a new user account
   * 
   * @param data - Registration data
   * @returns Promise<LoginResponse>
   */
  register: async (data: RegisterData): Promise<LoginResponse> => {
    try {
      console.log('📝 Attempting registration:', data.email);

      const response = await apiService.post<LoginResponse>(
        SHARED_ENDPOINTS.REGISTER,
        data
      );

      if (response.success && response.token && response.user) {
        // Store token
        await apiService.setToken(response.token);
        
        // Store user data
        await apiService.setUserData(response.user);

        console.log('✅ Registration successful:', response.user.email);
        
        return response;
      } else {
        throw new Error('Invalid registration response');
      }
    } catch (error: any) {
      console.error('❌ Registration failed:', error);
      throw {
        success: false,
        message: error.message || 'Registration failed. Please try again.',
      };
    }
  },

  /**
   * Logout
   * 
   * Clears stored token and user data
   * 
   * @returns Promise<void>
   */
  logout: async (): Promise<void> => {
    try {
      console.log('🚪 Logging out...');

      // Optional: Notify backend (if you have a logout endpoint)
      try {
        await apiService.post(SHARED_ENDPOINTS.LOGOUT);
      } catch (error) {
        // Ignore backend errors during logout
        console.warn('⚠️ Backend logout failed (continuing anyway)');
      }

      // Clear all stored data
      await apiService.clearAll();

      console.log('✅ Logout successful');
    } catch (error) {
      console.error('❌ Logout error:', error);
      // Still clear local data even if API call fails
      await apiService.clearAll();
    }
  },

  /**
   * Check if user is authenticated
   * 
   * @returns Promise<boolean>
   */
  isAuthenticated: async (): Promise<boolean> => {
    return await apiService.isAuthenticated();
  },

  /**
   * Get stored user data
   * 
   * @returns Promise<User | null>
   */
  getStoredUser: async (): Promise<User | null> => {
    return await apiService.getUserData();
  },

  /**
   * Get current auth token
   * 
   * @returns Promise<string | null>
   */
  getToken: async (): Promise<string | null> => {
    return await apiService.getToken();
  },

  /**
   * Verify token is still valid
   * 
   * Makes a request to verify the current token
   * 
   * @returns Promise<boolean>
   */
  verifyToken: async (): Promise<boolean> => {
    try {
      const token = await apiService.getToken();
      
      if (!token) {
        return false;
      }

      // Make a request to verify token
      await apiService.get(SHARED_ENDPOINTS.VERIFY_TOKEN);
      
      return true;
    } catch (error) {
      console.warn('⚠️ Token verification failed');
      
      // Clear invalid token
      await apiService.clearAll();
      
      return false;
    }
  },

  /**
   * Reset password (request reset email)
   * 
   * @param email - User's email address
   * @returns Promise<{ success: boolean; message: string }>
   */
  requestPasswordReset: async (email: string): Promise<{ success: boolean; message: string }> => {
    try {
      const response = await apiService.post<{ success: boolean; message: string }>(
        SHARED_ENDPOINTS.RESET_PASSWORD,
        { email }
      );
      
      return response;
    } catch (error: any) {
      throw {
        success: false,
        message: error.message || 'Failed to send reset email',
      };
    }
  },

  /**
   * Update user profile
   * 
   * @param updates - Partial user data to update
   * @returns Promise<User>
   */
  updateProfile: async (updates: Partial<User>): Promise<User> => {
    try {
      const response = await apiService.put<{ user: User }>(
        SHARED_ENDPOINTS.UPDATE_PROFILE,
        updates
      );

      // Update stored user data
      await apiService.setUserData(response.user);

      return response.user;
    } catch (error: any) {
      throw {
        message: error.message || 'Failed to update profile',
      };
    }
  },
};

export default authService;