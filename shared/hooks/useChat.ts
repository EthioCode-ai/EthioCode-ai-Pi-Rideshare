import { useState, useCallback, useRef } from 'react';

export interface ChatMessage {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
}

export interface ChatSession {
  sessionId: string;
  userType: 'rider' | 'driver' | 'admin';
  userId?: string;
  isActive: boolean;
}

export interface UseChatOptions {
  userType: 'rider' | 'driver' | 'admin';
  userId?: string;
  autoStart?: boolean;
}

export const useChat = (options: UseChatOptions) => {
  const { userType, userId, autoStart = false } = options;
  
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const abortControllerRef = useRef<AbortController | null>(null);

  const getAuthToken = useCallback(() => {
    return localStorage.getItem('token');
  }, []);

  const createSession = useCallback(async (): Promise<string | null> => {
    try {
      setError(null);
      
      const response = await fetch('/api/chat/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getAuthToken()}`,
        },
        body: JSON.stringify({
          userType,
          userId: userId || 'anonymous'
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to create chat session: ${response.statusText}`);
      }

      const data = await response.json();
      setSessionId(data.sessionId);
      setIsConnected(true);
      
      // Use server-provided welcome message instead of hardcoded one
      const welcomeMessage: ChatMessage = {
        id: `welcome-${Date.now()}`,
        content: data.welcomeMessage || getWelcomeMessage(userType),
        role: 'assistant',
        timestamp: new Date()
      };
      setMessages([welcomeMessage]);
      
      // TODO: Handle server-provided quick replies
      // if (data.quickReplies && data.quickReplies.length > 0) {
      //   setQuickReplies(data.quickReplies);
      // }
      
      return data.sessionId;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create chat session';
      setError(errorMessage);
      console.error('Chat session creation failed:', err);
      return null;
    }
  }, [userType, userId, getAuthToken]);

  const getWelcomeMessage = (type: string): string => {
    const messages = {
      rider: "Hi! I'm your Pi AI assistant. I can help you with ride booking, payment issues, account questions, and more. How can I assist you today?",
      driver: "Hello! I'm here to help with your driving experience. I can assist with earnings questions, ride issues, vehicle requirements, and platform navigation. What can I help you with?",
      admin: "Welcome to Pi Admin Support! I can help you with platform operations, driver management, ride analytics, system issues, and administrative tasks. How can I assist you?"
    };
    
    return messages[type as keyof typeof messages] || "Hello! I'm your Pi AI assistant. How can I help you today?";
  };

  const sendMessage = useCallback(async (content: string): Promise<boolean> => {
    if (!content.trim() || isLoading) return false;
    
    // Cancel any previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    // Create new abort controller for this request
    abortControllerRef.current = new AbortController();
    
    let currentSessionId = sessionId;
    
    // Create session if it doesn't exist
    if (!currentSessionId) {
      currentSessionId = await createSession();
      if (!currentSessionId) return false;
    }

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      content: content.trim(),
      role: 'user',
      timestamp: new Date()
    };

    // Add user message immediately
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/chat/message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getAuthToken()}`,
        },
        body: JSON.stringify({
          sessionId: currentSessionId,
          message: content.trim(),
          userType,
          userId: userId || 'anonymous'
        }),
        signal: abortControllerRef.current.signal
      });

      if (!response.ok) {
        throw new Error(`Failed to send message: ${response.statusText}`);
      }

      const data = await response.json();
      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        content: data.response,
        role: 'assistant',
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, assistantMessage]);
      return true;
      
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        // Request was cancelled, don't show error
        return false;
      }
      
      const errorMessage = err instanceof Error ? err.message : 'Failed to send message';
      setError(errorMessage);
      
      const errorResponse: ChatMessage = {
        id: `error-${Date.now()}`,
        content: "I'm sorry, I'm having trouble responding right now. Please try again in a moment.",
        role: 'assistant',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorResponse]);
      
      console.error('Message send failed:', err);
      return false;
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  }, [sessionId, isLoading, userType, userId, getAuthToken, createSession]);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  const reconnect = useCallback(async () => {
    setSessionId(null);
    setIsConnected(false);
    clearMessages();
    
    if (autoStart) {
      await createSession();
    }
  }, [autoStart, createSession, clearMessages]);

  const disconnect = useCallback(() => {
    // Cancel any ongoing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    setSessionId(null);
    setIsConnected(false);
    setIsLoading(false);
    setError(null);
  }, []);

  const getHistory = useCallback(async (): Promise<ChatMessage[]> => {
    if (!sessionId) return [];
    
    try {
      const response = await fetch(`/api/chat/history/${sessionId}`, {
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`,
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch chat history: ${response.statusText}`);
      }

      const data = await response.json();
      return data.messages || [];
    } catch (err) {
      console.error('Failed to fetch chat history:', err);
      return [];
    }
  }, [sessionId, getAuthToken]);

  return {
    // State
    messages,
    isLoading,
    isConnected,
    sessionId,
    error,
    
    // Actions
    sendMessage,
    createSession,
    clearMessages,
    reconnect,
    disconnect,
    getHistory,
    
    // Derived state
    canSendMessage: isConnected && !isLoading,
    hasMessages: messages.length > 0
  };
};