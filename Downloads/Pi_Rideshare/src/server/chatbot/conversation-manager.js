const { db } = require('../database');
const chatbotService = require('./openai-service');

class ConversationManager {
  constructor() {
    this.activeSessions = new Map(); // In-memory session cache
    this.maxMessageHistory = 10; // Keep last 10 messages for context
  }

  // Start a new chat session
  async startSession(userId, userType, initialContext = {}) {
    try {
      const sessionId = `chat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Create session in database
      await db.query(`
        INSERT INTO chat_sessions (id, user_id, user_type, session_context, created_at, status)
        VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, 'active')
      `, [sessionId, userId, userType, JSON.stringify(initialContext)]);

      // Cache session in memory
      this.activeSessions.set(sessionId, {
        userId,
        userType,
        context: initialContext,
        messages: [],
        startedAt: new Date(),
        lastActivity: new Date()
      });

      return {
        success: true,
        sessionId,
        welcomeMessage: this.generateWelcomeMessage(userType, initialContext)
      };
    } catch (error) {
      console.error('Error starting chat session:', error);
      return {
        success: false,
        error: 'Unable to start chat session'
      };
    }
  }

  // Send a message in a conversation
  async sendMessage(sessionId, message, isUser = true) {
    try {
      const session = await this.getSession(sessionId);
      if (!session) {
        return {
          success: false,
          error: 'Session not found'
        };
      }

      // Add user message to conversation
      if (isUser) {
        const userMessage = {
          role: 'user',
          content: message,
          timestamp: new Date()
        };

        // Store in database
        await db.query(`
          INSERT INTO chat_messages (session_id, role, content, timestamp, tokens_used)
          VALUES ($1, 'user', $2, CURRENT_TIMESTAMP, 0)
        `, [sessionId, message]);

        // Add to session cache
        session.messages.push(userMessage);
        session.lastActivity = new Date();

        // Analyze user intent for potential escalation
        const intentAnalysis = await chatbotService.analyzeIntent(message);
        
        // Get conversation history for context
        const recentMessages = session.messages.slice(-this.maxMessageHistory);
        
        // Generate AI response
        const aiResponse = await chatbotService.generateResponse(
          recentMessages,
          session.userType,
          session.context
        );

        if (aiResponse.success) {
          const botMessage = {
            role: 'assistant',
            content: aiResponse.message,
            timestamp: new Date()
          };

          // Store AI response in database
          await db.query(`
            INSERT INTO chat_messages (session_id, role, content, timestamp, tokens_used, intent_analysis)
            VALUES ($1, 'assistant', $2, CURRENT_TIMESTAMP, $3, $4)
          `, [sessionId, aiResponse.message, aiResponse.tokensUsed, JSON.stringify(intentAnalysis)]);

          // Add to session cache
          session.messages.push(botMessage);

          // Generate quick reply suggestions
          const quickReplies = await chatbotService.generateQuickReplies(
            session.context,
            session.userType
          );

          return {
            success: true,
            message: aiResponse.message,
            intentAnalysis,
            quickReplies,
            needsEscalation: intentAnalysis.needsEscalation,
            sessionId
          };
        } else {
          return {
            success: false,
            error: aiResponse.error,
            fallbackMessage: aiResponse.fallbackMessage
          };
        }
      }
    } catch (error) {
      console.error('Error sending message:', error);
      return {
        success: false,
        error: 'Unable to process message'
      };
    }
  }

  // Get session from cache or database
  async getSession(sessionId) {
    // Check memory cache first
    if (this.activeSessions.has(sessionId)) {
      return this.activeSessions.get(sessionId);
    }

    // Load from database
    try {
      const sessionResult = await db.query(`
        SELECT * FROM chat_sessions WHERE id = $1 AND status = 'active'
      `, [sessionId]);

      if (sessionResult.length === 0) {
        return null;
      }

      const sessionData = sessionResult[0];
      
      // Load recent messages
      const messagesResult = await db.query(`
        SELECT role, content, timestamp FROM chat_messages 
        WHERE session_id = $1 
        ORDER BY timestamp DESC 
        LIMIT $2
      `, [sessionId, this.maxMessageHistory]);

      const messages = messagesResult.reverse().map(msg => ({
        role: msg.role,
        content: msg.content,
        timestamp: new Date(msg.timestamp)
      }));

      const session = {
        userId: sessionData.user_id,
        userType: sessionData.user_type,
        context: JSON.parse(sessionData.session_context || '{}'),
        messages,
        startedAt: new Date(sessionData.created_at),
        lastActivity: new Date()
      };

      // Cache in memory
      this.activeSessions.set(sessionId, session);
      return session;
    } catch (error) {
      console.error('Error loading session:', error);
      return null;
    }
  }

  // Update session context (e.g., when user starts a ride)
  async updateSessionContext(sessionId, newContext) {
    try {
      const session = await this.getSession(sessionId);
      if (!session) {
        return false;
      }

      // Merge new context
      session.context = { ...session.context, ...newContext };

      // Update database
      await db.query(`
        UPDATE chat_sessions 
        SET session_context = $1, updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
      `, [JSON.stringify(session.context), sessionId]);

      return true;
    } catch (error) {
      console.error('Error updating session context:', error);
      return false;
    }
  }

  // End a chat session
  async endSession(sessionId, reason = 'user_ended') {
    try {
      await db.query(`
        UPDATE chat_sessions 
        SET status = 'ended', ended_at = CURRENT_TIMESTAMP, end_reason = $1
        WHERE id = $2
      `, [reason, sessionId]);

      // Remove from memory cache
      this.activeSessions.delete(sessionId);

      return { success: true };
    } catch (error) {
      console.error('Error ending session:', error);
      return { success: false, error: 'Unable to end session' };
    }
  }

  // Get chat history for a user
  async getChatHistory(userId, limit = 5) {
    try {
      const sessions = await db.query(`
        SELECT s.id, s.created_at, s.ended_at, s.user_type,
               COUNT(m.id) as message_count,
               MAX(m.timestamp) as last_message_at
        FROM chat_sessions s
        LEFT JOIN chat_messages m ON s.id = m.session_id
        WHERE s.user_id = $1
        GROUP BY s.id
        ORDER BY s.created_at DESC
        LIMIT $2
      `, [userId, limit]);

      return sessions;
    } catch (error) {
      console.error('Error getting chat history:', error);
      return [];
    }
  }

  // Generate welcome message based on user type
  generateWelcomeMessage(userType, context) {
    const welcomeMessages = {
      rider: `👋 Hi! I'm Pi Assistant, your personal rideshare support agent. 

I can help you with:
• Booking rides and selecting vehicle types
• Payment and billing questions  
• Tracking rides and contacting drivers
• Corporate discount applications
• Trip history and account settings

How can I assist you today?`,

      driver: `🚗 Welcome! I'm Pi Assistant, here to support you as a Pi driver.

I can help with:
• Driver verification and document uploads
• Earnings, payouts, and performance metrics
• Navigation and trip management
• Airport queue positioning
• Vehicle requirements and insurance

What can I help you with?`,

      admin: `⚡ Hello! I'm Pi Assistant for platform administrators.

I can assist with:
• Dashboard and analytics questions
• Driver and rider management
• Surge pricing and market controls  
• Dispute resolution workflows
• Corporate client management

How can I help you manage the platform today?`
    };

    return welcomeMessages[userType] || welcomeMessages.rider;
  }

  // Clean up old sessions (run periodically)
  async cleanupOldSessions() {
    try {
      // End sessions older than 24 hours
      await db.query(`
        UPDATE chat_sessions 
        SET status = 'expired', ended_at = CURRENT_TIMESTAMP, end_reason = 'timeout'
        WHERE status = 'active' 
        AND created_at < NOW() - INTERVAL '24 hours'
      `);

      // Clean memory cache
      const now = new Date();
      for (const [sessionId, session] of this.activeSessions.entries()) {
        const hoursSinceActivity = (now - session.lastActivity) / (1000 * 60 * 60);
        if (hoursSinceActivity > 2) {
          this.activeSessions.delete(sessionId);
        }
      }
    } catch (error) {
      console.error('Error cleaning up sessions:', error);
    }
  }
}

module.exports = new ConversationManager();