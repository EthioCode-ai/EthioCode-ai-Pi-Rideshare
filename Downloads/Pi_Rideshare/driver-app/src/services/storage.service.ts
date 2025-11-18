import AsyncStorage from '@react-native-async-storage/async-storage';

// Storage Keys
export const STORAGE_KEYS = {
  AUTH_TOKEN: '@pi_vip_driver:auth_token',
  USER_DATA: '@pi_vip_driver:user_data',
  DEVICE_TOKEN: '@pi_vip_driver:device_token',
  LAST_LOCATION: '@pi_vip_driver:last_location',
};

// Generic Storage Service
class StorageService {
  // Save string value
  async setItem(key: string, value: string): Promise<void> {
    try {
      await AsyncStorage.setItem(key, value);
    } catch (error) {
      console.error('Error saving to storage:', error);
      throw error;
    }
  }

  // Get string value
  async getItem(key: string): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(key);
    } catch (error) {
      console.error('Error reading from storage:', error);
      return null;
    }
  }

  // Save object (automatically stringified)
  async setObject<T>(key: string, value: T): Promise<void> {
    try {
      const jsonValue = JSON.stringify(value);
      await AsyncStorage.setItem(key, jsonValue);
    } catch (error) {
      console.error('Error saving object to storage:', error);
      throw error;
    }
  }

  // Get object (automatically parsed)
  async getObject<T>(key: string): Promise<T | null> {
    try {
      const jsonValue = await AsyncStorage.getItem(key);
      return jsonValue != null ? JSON.parse(jsonValue) : null;
    } catch (error) {
      console.error('Error reading object from storage:', error);
      return null;
    }
  }

  // Remove item
  async removeItem(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(key);
    } catch (error) {
      console.error('Error removing from storage:', error);
      throw error;
    }
  }

  // Clear all storage
  async clear(): Promise<void> {
    try {
      await AsyncStorage.clear();
    } catch (error) {
      console.error('Error clearing storage:', error);
      throw error;
    }
  }

  // Auth-specific methods
  async saveAuthToken(token: string): Promise<void> {
    await this.setItem(STORAGE_KEYS.AUTH_TOKEN, token);
  }

  async getAuthToken(): Promise<string | null> {
    return await this.getItem(STORAGE_KEYS.AUTH_TOKEN);
  }

  async removeAuthToken(): Promise<void> {
    await this.removeItem(STORAGE_KEYS.AUTH_TOKEN);
  }

  async saveUserData<T>(userData: T): Promise<void> {
    await this.setObject(STORAGE_KEYS.USER_DATA, userData);
  }

  async getUserData<T>(): Promise<T | null> {
    return await this.getObject<T>(STORAGE_KEYS.USER_DATA);
  }

  async removeUserData(): Promise<void> {
    await this.removeItem(STORAGE_KEYS.USER_DATA);
  }

  // Clear all auth data
  async clearAuthData(): Promise<void> {
    await this.removeAuthToken();
    await this.removeUserData();
  }
}

export default new StorageService();
