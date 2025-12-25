import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

type ThemeMode = 'light' | 'dark';

interface ThemeColors {
  // Backgrounds
  background: string;
  surface: string;
  card: string;
  cardBorder: string;
  
  // Text
  text: string;
  textSecondary: string;
  textMuted: string;
  
  // Brand
  primary: string;
  primaryLight: string;
  secondary: string;
  
  // Status
  success: string;
  warning: string;
  error: string;
  
  // Map
  mapStyle: 'dark' | 'standard';
  road: string;
  roadMain: string;
  building: string;
  
  // Components
  inputBackground: string;
  inputBorder: string;
  bottomSheet: string;
  overlay: string;
}

const darkColors: ThemeColors = {
  background: '#0d0d1a',
  surface: '#1a1a2e',
  card: '#1e1e2e',
  cardBorder: '#2d2d44',
  
  text: '#ffffff',
  textSecondary: '#94a3b8',
  textMuted: '#64748b',
  
  primary: '#f59e0b',
  primaryLight: '#fbbf24',
  secondary: '#22c55e',
  
  success: '#22c55e',
  warning: '#f59e0b',
  error: '#ef4444',
  
  mapStyle: 'dark',
  road: '#2d2d44',
  roadMain: '#3d3d5c',
  building: '#232340',
  
  inputBackground: '#1e1e2e',
  inputBorder: '#2d2d44',
  bottomSheet: 'rgba(30, 30, 46, 0.98)',
  overlay: 'rgba(13, 13, 26, 0.95)',
};

const lightColors: ThemeColors = {
  background: '#f8fafc',
  surface: '#ffffff',
  card: '#ffffff',
  cardBorder: '#e2e8f0',
  
  text: '#1e293b',
  textSecondary: '#475569',
  textMuted: '#94a3b8',
  
  primary: '#d97706',
  primaryLight: '#f59e0b',
  secondary: '#16a34a',
  
  success: '#16a34a',
  warning: '#d97706',
  error: '#dc2626',
  
  mapStyle: 'standard',
  road: '#e2e8f0',
  roadMain: '#cbd5e1',
  building: '#f1f5f9',
  
  inputBackground: '#f1f5f9',
  inputBorder: '#e2e8f0',
  bottomSheet: 'rgba(255, 255, 255, 0.98)',
  overlay: 'rgba(248, 250, 252, 0.95)',
};

interface ThemeContextType {
  theme: ThemeMode;
  colors: ThemeColors;
  toggleTheme: () => void;
  setTheme: (mode: ThemeMode) => void;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemeMode>('dark');

  useEffect(() => {
    loadTheme();
  }, []);

  const loadTheme = async () => {
    try {
      const saved = await AsyncStorage.getItem('theme');
      if (saved === 'light' || saved === 'dark') {
        setThemeState(saved);
      }
    } catch (error) {
      console.error('Error loading theme:', error);
    }
  };

  const setTheme = async (mode: ThemeMode) => {
    try {
      await AsyncStorage.setItem('theme', mode);
      setThemeState(mode);
    } catch (error) {
      console.error('Error saving theme:', error);
    }
  };

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  const colors = theme === 'dark' ? darkColors : lightColors;

  return (
    <ThemeContext.Provider value={{ theme, colors, toggleTheme, setTheme, isDark: theme === 'dark' }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export { darkColors, lightColors };
export type { ThemeColors, ThemeMode };