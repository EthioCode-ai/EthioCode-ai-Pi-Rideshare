import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, Send, Minimize2, X, Bot, User, Mic, MicOff } from 'lucide-react';

interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
}

interface ChatBotProps {
  userType: 'rider' | 'driver' | 'admin';
  userId?: string;
  className?: string;
  isMinimized?: boolean;
  onToggleMinimize?: () => void;
  onClose?: () => void;
}

const ChatBot: React.FC<ChatBotProps> = ({
  userType,
  userId,
  className = '',
  isMinimized = false,
  onToggleMinimize,
  onClose
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [speechRecognition, setSpeechRecognition] = useState<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Voice-only mode - no text input focus needed

  // Initialize chat session
  useEffect(() => {
    if (!sessionId) {
      initializeChat();
    }
  }, [sessionId]);

  // Initialize speech recognition
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';
      
      recognition.onstart = () => {
        setIsListening(true);
      };
      
      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInputMessage(transcript);
        setIsListening(false);
        // Auto-send voice message immediately
        setTimeout(() => sendVoiceMessage(transcript), 100);
      };
      
      recognition.onerror = () => {
        setIsListening(false);
      };
      
      recognition.onend = () => {
        setIsListening(false);
      };
      
      setSpeechRecognition(recognition);
    }
  }, []);

  // Cleanup speech recognition on unmount
  useEffect(() => {
    return () => {
      if (speechRecognition && isListening) {
        speechRecognition.stop();
      }
    };
  }, [speechRecognition, isListening]);

  const initializeChat = async () => {
    try {
      const response = await fetch('/api/chat/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          userType,
          userId: userId || 'anonymous'
        })
      });

      if (response.ok) {
        const data = await response.json();
        setSessionId(data.sessionId);
        
        // Use server-provided welcome message instead of hardcoded one
        const welcomeMessage: Message = {
          id: Date.now().toString(),
          content: data.welcomeMessage || getWelcomeMessage(userType),
          role: 'assistant',
          timestamp: new Date()
        };
        setMessages([welcomeMessage]);
        
        // TODO: Add support for quick replies from server
        // if (data.quickReplies && data.quickReplies.length > 0) {
        //   setQuickReplies(data.quickReplies);
        // }
      }
    } catch (error) {
      console.error('Failed to initialize chat:', error);
    }
  };

  const getWelcomeMessage = (type: string): string => {
    switch (type) {
      case 'rider':
        return "Hi! I'm your Pi AI assistant. I can help you with ride booking, payment issues, account questions, and more. How can I assist you today?";
      case 'driver':
        return "Hello! I'm here to help with your driving experience. I can assist with earnings questions, ride issues, vehicle requirements, and platform navigation. What can I help you with?";
      case 'admin':
        return "Welcome to Pi Admin Support! I can help you with platform operations, driver management, ride analytics, system issues, and administrative tasks. How can I assist you?";
      default:
        return "Hello! I'm your Pi AI assistant. How can I help you today?";
    }
  };

  const sendMessage = async () => {
    if (!inputMessage.trim() || isLoading || !sessionId) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      content: inputMessage.trim(),
      role: 'user',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat/message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          sessionId,
          message: userMessage.content,
          userType,
          userId: userId || 'anonymous'
        })
      });

      if (response.ok) {
        const data = await response.json();
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          content: data.response,
          role: 'assistant',
          timestamp: new Date()
        };
        setMessages(prev => [...prev, assistantMessage]);
      } else {
        throw new Error('Failed to send message');
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: "I'm sorry, I'm having trouble responding right now. Please try again in a moment.",
        role: 'assistant',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const sendVoiceMessage = async (message: string) => {
    if (!message.trim() || isLoading || !sessionId) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      content: message.trim(),
      role: 'user',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat/message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          sessionId,
          message: userMessage.content,
          userType,
          userId: userId || 'anonymous'
        })
      });

      if (response.ok) {
        const data = await response.json();
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          content: data.response,
          role: 'assistant',
          timestamp: new Date()
        };
        setMessages(prev => [...prev, assistantMessage]);
      } else {
        throw new Error('Failed to send message');
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: "I'm sorry, I'm having trouble responding right now. Please try again in a moment.",
        role: 'assistant',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleVoiceInput = () => {
    if (!speechRecognition) {
      alert('Speech recognition is not supported in this browser');
      return;
    }

    if (isListening) {
      speechRecognition.stop();
    } else {
      speechRecognition.start();
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (isMinimized) {
    return (
      <div className={`fixed bottom-4 right-4 z-50 ${className}`}>
        {/* Compact Pi Assistant FAB - won't obstruct driver controls */}
        <div className="bg-blue-600 text-white p-3 rounded-full shadow-xl cursor-pointer hover:bg-blue-700 transition-colors"
             onClick={onToggleMinimize}
             title="Expand Pi Assistant">
          <div className="flex items-center space-x-2">
            <Bot size={20} />
            <span className="text-sm font-medium">Pi</span>
          </div>
        </div>
        
        {/* Quick voice input indicator (floating above FAB when listening) */}
        {speechRecognition && isListening && (
          <div className="absolute bottom-16 right-0 bg-red-600 text-white p-2 rounded-lg shadow-lg">
            <div className="flex items-center space-x-2">
              <MicOff size={16} />
              <span className="text-xs">Listening...</span>
              <button 
                onClick={toggleVoiceInput}
                className="text-white hover:text-red-200"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`fixed bottom-4 right-4 w-80 h-96 bg-white rounded-lg shadow-xl border flex flex-col z-50 ${className}`}>
      {/* Header */}
      <div className="bg-blue-600 text-white p-4 rounded-t-lg flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Bot size={20} />
          <span className="font-semibold">Pi AI Assistant</span>
        </div>
        <div className="flex items-center space-x-1">
          {onToggleMinimize && (
            <button
              onClick={onToggleMinimize}
              className="p-1 hover:bg-blue-700 rounded"
            >
              <Minimize2 size={16} />
            </button>
          )}
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 hover:bg-blue-700 rounded"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                message.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-800'
              }`}
            >
              <div className="flex items-start space-x-2">
                {message.role === 'assistant' && (
                  <Bot size={16} className="mt-1 flex-shrink-0" />
                )}
                {message.role === 'user' && (
                  <User size={16} className="mt-1 flex-shrink-0" />
                )}
                <div className="flex-1">
                  <p className="text-sm">{message.content}</p>
                  <p className={`text-xs mt-1 ${
                    message.role === 'user' ? 'text-blue-100' : 'text-gray-500'
                  }`}>
                    {formatTime(message.timestamp)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        ))}
        
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 text-gray-800 px-4 py-2 rounded-lg">
              <div className="flex items-center space-x-2">
                <Bot size={16} />
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                </div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Voice-Only Input */}
      <div className="p-4 border-t">
        <div className="flex flex-col items-center space-y-3">
          {!speechRecognition ? (
            <div className="text-center text-gray-500">
              <p className="text-sm">Speech recognition not supported in this browser</p>
            </div>
          ) : (
            <div className="flex flex-col items-center space-y-2">
              <button
                onClick={toggleVoiceInput}
                disabled={isLoading}
                className={`w-16 h-16 rounded-full flex items-center justify-center transition-all duration-200 ${
                  isListening 
                    ? 'bg-red-600 text-white shadow-lg transform scale-110' 
                    : 'bg-blue-600 text-white hover:bg-blue-700 shadow-md'
                }`}
                title={isListening ? 'Stop listening' : 'Tap to speak'}
              >
                {isListening ? (
                  <div className="flex flex-col items-center">
                    <MicOff size={32} />
                    <div className="w-2 h-2 bg-white rounded-full mt-1 animate-pulse"></div>
                  </div>
                ) : (
                  <Mic size={32} />
                )}
              </button>
              <p className="text-sm text-gray-600 text-center">
                {isListening 
                  ? 'Listening... Speak now' 
                  : isLoading 
                    ? 'Processing...' 
                    : 'Tap microphone to speak'
                }
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatBot;