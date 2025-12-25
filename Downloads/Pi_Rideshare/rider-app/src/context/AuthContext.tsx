import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StorageKeys } from '../constants';
import { User } from '../types';
import { apiUrl } from '../config/api.config';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (data: RegisterData) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  updateUser: (data: Partial<User>) => Promise<void>;
}

interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadStoredAuth();
  }, []);

  const loadStoredAuth = async () => {
    try {
      const storedToken = await AsyncStorage.getItem(StorageKeys.AUTH_TOKEN);
      const storedUser = await AsyncStorage.getItem(StorageKeys.USER_DATA);

      if (storedToken && storedUser) {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
      }
    } catch (error) {
      console.error('Error loading auth:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await fetch(apiUrl('api/auth/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (response.ok && data.token) {
        // Verify user is a rider
        if (data.user.userType !== 'rider' && data.user.user_type !== 'rider') {
          return { success: false, error: 'Please use the driver app for driver accounts' };
        }

        const userData: User = {
          id: data.user.id,
          email: data.user.email,
          firstName: data.user.first_name,
          lastName: data.user.last_name,
          phone: data.user.phone || '',
          profileImage: data.user.profile_image,
          userType: 'rider',
          createdAt: data.user.created_at,
        };

        await AsyncStorage.setItem(StorageKeys.AUTH_TOKEN, data.token);
        await AsyncStorage.setItem(StorageKeys.USER_DATA, JSON.stringify(userData));

        setToken(data.token);
        setUser(userData);

        return { success: true };
      } else {
        return { success: false, error: data.error || 'Login failed' };
      }
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: 'Network error. Please try again.' };
    }
  };

  const register = async (registerData: RegisterData): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await fetch(apiUrl('api/auth/register'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
         email: registerData.email,
         password: registerData.password,
         firstName: registerData.firstName,
         lastName: registerData.lastName,
         phone: registerData.phone,
         userType: 'rider',
   }),
      });

      const data = await response.json();

      if (response.ok && data.token) {
        const userData: User = {
          id: data.user.id,
          email: data.user.email,
          firstName: data.user.first_name,
          lastName: data.user.last_name,
          phone: data.user.phone || '',
          profileImage: data.user.profile_image,
          userType: 'rider',
          createdAt: data.user.created_at,
        };

        await AsyncStorage.setItem(StorageKeys.AUTH_TOKEN, data.token);
        await AsyncStorage.setItem(StorageKeys.USER_DATA, JSON.stringify(userData));

        setToken(data.token);
        setUser(userData);

        return { success: true };
      } else {
        return { success: false, error: data.error || 'Registration failed' };
      }
    } catch (error) {
      console.error('Register error:', error);
      return { success: false, error: 'Network error. Please try again.' };
    }
  };

  const logout = async () => {
    try {
      await AsyncStorage.multiRemove([StorageKeys.AUTH_TOKEN, StorageKeys.USER_DATA]);
      setToken(null);
      setUser(null);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const updateUser = async (data: Partial<User>) => {
    if (user) {
      const updatedUser = { ...user, ...data };
      setUser(updatedUser);
      await AsyncStorage.setItem(StorageKeys.USER_DATA, JSON.stringify(updatedUser));
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isAuthenticated: !!token && !!user,
        login,
        register,
        logout,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};