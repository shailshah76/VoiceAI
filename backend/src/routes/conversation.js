import express from 'express';
import conversationalAI from '../services/conversationalAI.js';

const router = express.Router();

/**
 * POST /api/conversation/chat
 * Main conversational AI endpoint
 */
router.post('/chat', async (req, res) => {
  try {
    const { 
      message, 
      sessionId, 
      slideContext, 
      options = {} 
    } = req.body;

    // Validation
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Message is required and must be a non-empty string',
        code: 'INVALID_MESSAGE'
      });
    }

    if (!sessionId || typeof sessionId !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'SessionId is required and must be a string',
        code: 'INVALID_SESSION_ID'
      });
    }

    // Initialize or update session with slide context if provided
    if (slideContext) {
      conversationalAI.updateSlideContext(sessionId, slideContext);
    }

    // Generate response
    const result = await conversationalAI.generateResponse(sessionId, message, {
      maxTokens: options.maxTokens || 500,
      temperature: options.temperature || 0.7,
      generateAudio: options.generateAudio !== false
    });

    if (result.success) {
      res.json({
        success: true,
        message: result.response,
        audioUrl: result.audioUrl,
        intent: result.intent,
        confidence: result.confidence,
        relevantSlides: result.relevantSlides,
        sessionId: result.sessionId,
        conversationId: result.conversationId,
        responseTime: result.responseTime,
        timestamp: new Date()
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error,
        fallbackMessage: result.fallbackResponse,
        sessionId: result.sessionId,
        responseTime: result.responseTime,
        code: 'AI_GENERATION_FAILED'
      });
    }

  } catch (error) {
    console.error('❌ Conversation chat error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error while processing conversation',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * POST /api/conversation/session/init
 * Initialize a new conversation session
 */
router.post('/session/init', (req, res) => {
  try {
    const { sessionId, slideContext } = req.body;

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        error: 'SessionId is required',
        code: 'MISSING_SESSION_ID'
      });
    }

    const session = conversationalAI.initializeSession(sessionId, slideContext);

    res.json({
      success: true,
      sessionId: session.sessionId,
      createdAt: session.createdAt,
      message: 'Conversation session initialized successfully'
    });

  } catch (error) {
    console.error('❌ Session initialization error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to initialize conversation session',
      code: 'SESSION_INIT_FAILED'
    });
  }
});

/**
 * PUT /api/conversation/session/:sessionId/context
 * Update slide context for existing session
 */
router.put('/session/:sessionId/context', (req, res) => {
  try {
    const { sessionId } = req.params;
    const { slideContext } = req.body;

    if (!slideContext) {
      return res.status(400).json({
        success: false,
        error: 'Slide context is required',
        code: 'MISSING_SLIDE_CONTEXT'
      });
    }

    conversationalAI.updateSlideContext(sessionId, slideContext);

    res.json({
      success: true,
      sessionId,
      message: 'Slide context updated successfully'
    });

  } catch (error) {
    console.error('❌ Context update error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update slide context',
      code: 'CONTEXT_UPDATE_FAILED'
    });
  }
});

/**
 * GET /api/conversation/session/:sessionId
 * Get session summary and conversation history
 */
router.get('/session/:sessionId', (req, res) => {
  try {
    const { sessionId } = req.params;
    const { includeHistory = false } = req.query;

    const summary = conversationalAI.getSessionSummary(sessionId);

    if (!summary) {
      return res.status(404).json({
        success: false,
        error: 'Session not found',
        code: 'SESSION_NOT_FOUND'
      });
    }

    let response = {
      success: true,
      session: summary
    };

    // Include full conversation history if requested
    if (includeHistory === 'true') {
      const session = conversationalAI.conversations.get(sessionId);
      response.conversationHistory = session.conversationHistory.map(entry => ({
        timestamp: entry.timestamp,
        userInput: entry.userInput,
        response: entry.response,
        intent: entry.intent,
        confidence: entry.confidence,
        relevantSlides: entry.relevantSlides,
        responseTime: entry.responseTime
      }));
    }

    res.json(response);

  } catch (error) {
    console.error('❌ Session retrieval error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve session information',
      code: 'SESSION_RETRIEVAL_FAILED'
    });
  }
});

/**
 * GET /api/conversation/session/:sessionId/analytics
 * Get conversation analytics for a session
 */
router.get('/session/:sessionId/analytics', (req, res) => {
  try {
    const { sessionId } = req.params;

    const analytics = conversationalAI.getSessionAnalytics(sessionId);

    if (!analytics) {
      return res.status(404).json({
        success: false,
        error: 'Session not found',
        code: 'SESSION_NOT_FOUND'
      });
    }

    res.json({
      success: true,
      analytics
    });

  } catch (error) {
    console.error('❌ Analytics retrieval error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve session analytics',
      code: 'ANALYTICS_RETRIEVAL_FAILED'
    });
  }
});

/**
 * POST /api/conversation/intent/detect
 * Detect intent from user input (utility endpoint)
 */
router.post('/intent/detect', (req, res) => {
  try {
    const { message } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Message is required and must be a string',
        code: 'INVALID_MESSAGE'
      });
    }

    const intentResult = conversationalAI.detectIntent(message);

    res.json({
      success: true,
      intent: intentResult.intent,
      confidence: intentResult.confidence,
      rawInput: intentResult.rawInput
    });

  } catch (error) {
    console.error('❌ Intent detection error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to detect intent',
      code: 'INTENT_DETECTION_FAILED'
    });
  }
});

/**
 * GET /api/conversation/sessions
 * List all active sessions (admin endpoint)
 */
router.get('/sessions', (req, res) => {
  try {
    const { limit = 50, sortBy = 'lastActive' } = req.query;

    const sessions = Array.from(conversationalAI.conversations.values())
      .map(session => conversationalAI.getSessionSummary(session.sessionId))
      .sort((a, b) => {
        if (sortBy === 'lastActive') {
          return new Date(b.lastActive) - new Date(a.lastActive);
        }
        if (sortBy === 'createdAt') {
          return new Date(b.createdAt) - new Date(a.createdAt);
        }
        if (sortBy === 'totalQuestions') {
          return b.totalQuestions - a.totalQuestions;
        }
        return 0;
      })
      .slice(0, parseInt(limit));

    res.json({
      success: true,
      sessions,
      totalSessions: conversationalAI.conversations.size,
      timestamp: new Date()
    });

  } catch (error) {
    console.error('❌ Sessions listing error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to list sessions',
      code: 'SESSIONS_LISTING_FAILED'
    });
  }
});

/**
 * DELETE /api/conversation/session/:sessionId
 * Delete a conversation session
 */
router.delete('/session/:sessionId', (req, res) => {
  try {
    const { sessionId } = req.params;

    const deleted = conversationalAI.conversations.delete(sessionId);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Session not found',
        code: 'SESSION_NOT_FOUND'
      });
    }

    res.json({
      success: true,
      sessionId,
      message: 'Session deleted successfully'
    });

  } catch (error) {
    console.error('❌ Session deletion error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete session',
      code: 'SESSION_DELETION_FAILED'
    });
  }
});

/**
 * POST /api/conversation/cleanup
 * Clean up old conversation sessions
 */
router.post('/cleanup', (req, res) => {
  try {
    const { maxAgeHours = 24 } = req.body;

    const cleanedCount = conversationalAI.cleanupOldSessions(maxAgeHours);

    res.json({
      success: true,
      cleanedCount,
      maxAgeHours,
      message: `Cleaned up ${cleanedCount} old sessions`
    });

  } catch (error) {
    console.error('❌ Cleanup error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to cleanup sessions',
      code: 'CLEANUP_FAILED'
    });
  }
});

/**
 * GET /api/conversation/health
 * Health check for conversational AI service
 */
router.get('/health', (req, res) => {
  try {
    const activeSessions = conversationalAI.conversations.size;
    const memoryUsage = process.memoryUsage();

    res.json({
      success: true,
      status: 'healthy',
      activeSessions,
      memoryUsage: {
        heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024) + 'MB',
        heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024) + 'MB'
      },
      uptime: process.uptime(),
      timestamp: new Date()
    });

  } catch (error) {
    console.error('❌ Health check error:', error);
    res.status(500).json({
      success: false,
      error: 'Health check failed',
      code: 'HEALTH_CHECK_FAILED'
    });
  }
});

export default router; 