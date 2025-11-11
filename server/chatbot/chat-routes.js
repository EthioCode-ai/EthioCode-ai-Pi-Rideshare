const express = require('express');
const router = express.Router();
const conversationManager = require('./conversation-manager');
const chatbotService = require('./openai-service');
const { authenticateToken, apiKeyMiddleware } = require('../middleware/auth');

// Use JWT token authentication (same as other user endpoints)
const authMiddleware = authenticateToken;

// Health check for chatbot service
router.get('/health', async (req, res) => {
  try {
    const health = await chatbotService.healthCheck();
    res.json({
      success: true,
      chatbot: health,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Health check failed'
    });
  }
});

// Start a new chat session
router.post('/start', authMiddleware, async (req, res) => {
  try {
    const { userType, initialContext } = req.body;
    const userId = req.user?.userId || req.body.userId;

    if (!userId || !userType) {
      return res.status(400).json({
        success: false,
        error: 'userId and userType are required'
      });
    }

    // Validate userType
    if (!['rider', 'driver', 'admin'].includes(userType)) {
      return res.status(400).json({
        success: false,
        error: 'userType must be rider, driver, or admin'
      });
    }

    const result = await conversationManager.startSession(
      userId, 
      userType, 
      initialContext || {}
    );

    if (result.success) {
      res.json({
        success: true,
        sessionId: result.sessionId,
        welcomeMessage: result.welcomeMessage,
        quickReplies: await chatbotService.generateQuickReplies({}, userType)
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error || 'Failed to start chat session'
      });
    }
  } catch (error) {
    console.error('Error starting chat session:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Send a message in a chat session
router.post('/message', authMiddleware, async (req, res) => {
  try {
    const { sessionId, message } = req.body;

    if (!sessionId || !message) {
      return res.status(400).json({
        success: false,
        error: 'sessionId and message are required'
      });
    }

    const result = await conversationManager.sendMessage(sessionId, message, true);

    if (result.success) {
      res.json({
        success: true,
        response: result.message,
        sessionId: result.sessionId,
        quickReplies: result.quickReplies || [],
        intentAnalysis: result.intentAnalysis,
        needsEscalation: result.needsEscalation || false,
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error || 'Failed to process message',
        fallbackMessage: result.fallbackMessage
      });
    }
  } catch (error) {
    console.error('Error processing chat message:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      fallbackMessage: "I'm experiencing technical difficulties. Please try again in a moment, or contact our support team directly for immediate assistance."
    });
  }
});

// Update session context (e.g., when user starts a ride)
router.put('/session/:sessionId/context', authMiddleware, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { context } = req.body;

    if (!context || typeof context !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'context object is required'
      });
    }

    const success = await conversationManager.updateSessionContext(sessionId, context);

    if (success) {
      res.json({
        success: true,
        message: 'Session context updated successfully'
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'Session not found or failed to update'
      });
    }
  } catch (error) {
    console.error('Error updating session context:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// End a chat session
router.post('/session/:sessionId/end', authMiddleware, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { reason } = req.body;

    const result = await conversationManager.endSession(sessionId, reason || 'user_ended');

    if (result.success) {
      res.json({
        success: true,
        message: 'Chat session ended successfully'
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error || 'Failed to end session'
      });
    }
  } catch (error) {
    console.error('Error ending chat session:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Get chat history for a user
router.get('/history/:userId', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;
    const limit = parseInt(req.query.limit) || 5;

    const history = await conversationManager.getChatHistory(userId, limit);

    res.json({
      success: true,
      history: history,
      count: history.length
    });
  } catch (error) {
    console.error('Error getting chat history:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Get active session for a user
router.get('/session/active/:userId', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;
    
    // This would require a method to find active sessions by userId
    // For now, return empty - this can be enhanced later
    res.json({
      success: true,
      activeSession: null,
      message: 'No active session found'
    });
  } catch (error) {
    console.error('Error getting active session:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Admin route: Get chat analytics
router.get('/admin/analytics', authMiddleware, async (req, res) => {
  try {
    // This would include chat usage analytics
    // For now, return basic structure
    res.json({
      success: true,
      analytics: {
        totalSessions: 0,
        totalMessages: 0,
        averageSessionLength: 0,
        escalationRate: 0,
        topIssues: [],
        userSatisfaction: 0
      }
    });
  } catch (error) {
    console.error('Error getting chat analytics:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Quick replies for user type
router.get('/quick-replies/:userType', authMiddleware, async (req, res) => {
  try {
    const { userType } = req.params;
    
    if (!['rider', 'driver', 'admin'].includes(userType)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid user type'
      });
    }

    const quickReplies = await chatbotService.generateQuickReplies({}, userType);
    
    res.json({
      success: true,
      quickReplies: quickReplies
    });
  } catch (error) {
    console.error('Error getting quick replies:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

module.exports = router;