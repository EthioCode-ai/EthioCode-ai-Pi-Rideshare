/**
 * API Service
 * 
 * Central HTTP client using Axios for all backend communication.
 * Handles authentication, error responses, and request/response interceptors.
 * 
 * All other services (auth, driver, etc.) use this service to make API calls.
 */

import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL, REQUEST_TIMEOUT, DEBUG_MODE } from '../config/api.config';

/**
 * Storage Keys
 */
const STORAGE_KEYS = {
  AUTH_TOKEN: '@pi_rideshare:auth_token',
  USER_DATA: '@pi_rideshare:user_data',
};

/**
 * API Response Types
 */
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

/**
 * Create Axios Instance
 * 
 * Configured with base URL, timeout, and default headers
 */
const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: REQUEST_TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

/**
 * Request Interceptor
 * 
 * Automatically adds JWT token to requests if user is logged in
 */
apiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    try {
      // Get stored auth token
      const token = await AsyncStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
      
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }

      if (DEBUG_MODE) {
        console.log('🌐 API Request:', {
          method: config.method?.toUpperCase(),
          url: config.url,
          hasToken: !!token,
        });
      }

      return config;
    } catch (error) {
      console.error('❌ Request interceptor error:', error);
      return config;
    }
  },
  (error) => {
    console.error('❌ Request interceptor error:', error);
    return Promise.reject(error);
  }
);

/**
 * Response Interceptor
 * 
 * Handles errors globally and formats responses
 */
apiClient.interceptors.response.use(
  (response) => {
    if (DEBUG_MODE) {
      console.log('✅ API Response:', {
        url: response.config.url,
        status: response.status,
        data: response.data,
      });
    }
    return response;
  },
  async (error: AxiosError) => {
    // Handle different error types
    if (error.response) {
      // Server responded with error status
      const status = error.response.status;
      const data = error.response.data as any;

      if (DEBUG_MODE) {
        console.error('❌ API Error Response:', {
          url: error.config?.url,
          status,
          data,
        });
      }

      // Handle specific status codes
      switch (status) {
        case 401:
          // Unauthorized - token expired or invalid
          console.warn('🔐 Unauthorized - clearing stored token');
          await AsyncStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
          await AsyncStorage.removeItem(STORAGE_KEYS.USER_DATA);
          break;

        case 403:
          // Forbidden
          console.warn('🚫 Forbidden access');
          break;

        case 404:
          // Not found
          console.warn('🔍 Resource not found');
          break;

        case 500:
          // Server error
          console.error('💥 Server error');
          break;
      }

      // Return formatted error
      return Promise.reject({
        status,
        message: data?.error || data?.message || 'Request failed',
        data: data,
      });
    } else if (error.request) {
      // Request made but no response
      console.error('📡 No response from server:', error.request);
      return Promise.reject({
        status: 0,
        message: 'No response from server. Check your internet connection.',
      });
    } else {
      // Something else happened
      console.error('❌ Request error:', error.message);
      return Promise.reject({
        status: -1,
        message: error.message || 'An unexpected error occurred',
      });
    }
  }
);

/**
 * API Service Methods
 */
const apiService = {
  /**
   * GET request
   */
  get: async <T = any>(url: string, params?: any): Promise<T> => {
    const response = await apiClient.get<T>(url, { params });
    return response.data;
  },

  /**
   * POST request
   */
  post: async <T = any>(url: string, data?: any): Promise<T> => {
    const response = await apiClient.post<T>(url, data);
    return response.data;
  },

  /**
   * PUT request
   */
  put: async <T = any>(url: string, data?: any): Promise<T> => {
    const response = await apiClient.put<T>(url, data);
    return response.data;
  },

  /**
   * DELETE request
   */
  delete: async <T = any>(url: string): Promise<T> => {
    const response = await apiClient.delete<T>(url);
    return response.data;
  },

  /**
   * Upload file (multipart/form-data)
   * Used for document uploads, profile pictures, etc.
   */
  upload: async <T = any>(url: string, formData: FormData): Promise<T> => {
    const response = await apiClient.post<T>(url, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  /**
   * Get current auth token
   */
  getToken: async (): Promise<string | null> => {
    return await AsyncStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
  },

  /**
   * Set auth token
   */
  setToken: async (token: string): Promise<void> => {
    await AsyncStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, token);
  },

  /**
   * Clear auth token
   */
  clearToken: async (): Promise<void> => {
    await AsyncStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
  },

  /**
   * Check if user is authenticated
   */
  isAuthenticated: async (): Promise<boolean> => {
    const token = await AsyncStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
    return !!token;
  },

  /**
   * Get stored user data
   */
  getUserData: async (): Promise<any | null> => {
    const userData = await AsyncStorage.getItem(STORAGE_KEYS.USER_DATA);
    return userData ? JSON.parse(userData) : null;
  },

  /**
   * Store user data
   */
  setUserData: async (userData: any): Promise<void> => {
    await AsyncStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(userData));
  },

  /**
   * Clear user data
   */
  clearUserData: async (): Promise<void> => {
    await AsyncStorage.removeItem(STORAGE_KEYS.USER_DATA);
  },

  /**
   * Clear all stored data (logout)
   */
  clearAll: async (): Promise<void> => {
    await AsyncStorage.multiRemove([
      STORAGE_KEYS.AUTH_TOKEN,
      STORAGE_KEYS.USER_DATA,
    ]);
  },
};

export default apiService;
export { STORAGE_KEYS };