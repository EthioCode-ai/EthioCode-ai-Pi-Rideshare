/**
 * ChatScreen - Driver-Rider messaging
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import socketService from '../services/socket.service';
import { StorageKeys } from '../constants/StorageKeys';

interface Message {
  id: string;
  text: string;
  sender: 'driver' | 'rider';
  timestamp: Date;
}

type ChatRouteParams = {
  Chat: {
    riderId: string;
    riderName: string;
    rideId: string;
  };
};

const CANNED_MESSAGES = [
  "I have arrived.",
  "On my way!",
  "Stuck in traffic. I'll be there shortly.",
];

const ChatScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<ChatRouteParams, 'Chat'>>();
  const { riderId, riderName, rideId } = route.params || {};
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<any>(null);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    loadUser();
    setupSocketListener();
    
    return () => {
      // Cleanup socket listener
      socketService.off('chat-message');
    };
  }, []);

  const loadUser = async () => {
    const userData = await AsyncStorage.getItem(StorageKeys.USER_DATA);
    if (userData) {
      setUser(JSON.parse(userData));
    }
  };

  const setupSocketListener = () => {
    socketService.onChatMessage((data: any) => {
      if (data.rideId === rideId) {
        const newMessage: Message = {
          id: Date.now().toString(),
          text: data.message,
          sender: data.sender,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, newMessage]);
        scrollToBottom();
      }
    });
  };

  const scrollToBottom = () => {
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  const sendMessage = (text: string) => {
    if (!text.trim()) return;

    const newMessage: Message = {
      id: Date.now().toString(),
      text: text.trim(),
      sender: 'driver',
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, newMessage]);
    setInputText('');

    // Send via socket
    socketService.sendChatMessage({
      rideId,
      riderId,
      driverId: user?.id || '',
      message: text.trim(),
      sender: 'driver',
    });

    scrollToBottom();
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isDriver = item.sender === 'driver';
    return (
      <View style={[
        styles.messageBubble,
        isDriver ? styles.driverBubble : styles.riderBubble
      ]}>
        <Text style={[
          styles.messageText,
          isDriver ? styles.driverText : styles.riderText
        ]}>
          {item.text}
        </Text>
        <Text style={styles.timestamp}>
          {item.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>{riderName || 'Rider'}</Text>
          <Text style={styles.headerSubtitle}>Tap for quick responses</Text>
        </View>
      </View>

      {/* Quick Responses */}
      <View style={styles.quickResponses}>
        {CANNED_MESSAGES.map((msg, index) => (
          <TouchableOpacity
            key={index}
            style={styles.quickButton}
            onPress={() => sendMessage(msg)}
          >
            <Text style={styles.quickButtonText}>{msg}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.messagesList}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No messages yet</Text>
            <Text style={styles.emptySubtext}>Use quick responses or type a message</Text>
          </View>
        }
      />

      {/* Input */}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.textInput}
          value={inputText}
          onChangeText={setInputText}
          placeholder="Type a message..."
          placeholderTextColor="#9CA3AF"
          multiline
          maxLength={500}
        />
        <TouchableOpacity
          style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled]}
          onPress={() => sendMessage(inputText)}
          disabled={!inputText.trim()}
        >
          <Text style={styles.sendButtonText}>Send</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 16,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: { padding: 8, marginRight: 8 },
  backIcon: { fontSize: 24, color: '#1F2937' },
  headerInfo: { flex: 1 },
  headerTitle: { fontSize: 18, fontWeight: '600', color: '#1F2937' },
  headerSubtitle: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  quickResponses: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 12,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    gap: 8,
  },
  quickButton: {
    backgroundColor: '#EEF2FF',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  quickButtonText: { fontSize: 13, color: '#4338CA' },
  messagesList: { padding: 16, flexGrow: 1 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },
  emptyText: { fontSize: 16, color: '#6B7280', marginBottom: 4 },
  emptySubtext: { fontSize: 13, color: '#9CA3AF' },
  messageBubble: {
    maxWidth: '75%',
    padding: 12,
    borderRadius: 16,
    marginBottom: 8,
  },
  driverBubble: {
    backgroundColor: '#6B46C1',
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  riderBubble: {
    backgroundColor: '#FFF',
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  messageText: { fontSize: 15, lineHeight: 20 },
  driverText: { color: '#FFF' },
  riderText: { color: '#1F2937' },
  timestamp: { fontSize: 10, color: '#9CA3AF', marginTop: 4, alignSelf: 'flex-end' },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    backgroundColor: '#FFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  textInput: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    maxHeight: 100,
    color: '#1F2937',
  },
  sendButton: {
    backgroundColor: '#6B46C1',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginLeft: 8,
  },
  sendButtonDisabled: { backgroundColor: '#D1D5DB' },
  sendButtonText: { color: '#FFF', fontWeight: '600', fontSize: 15 },
});

export default ChatScreen;