import aiProvider from './aiProvider.js';
import textToSpeechService from './textToSpeech.js';

class ConversationalAI {
  constructor() {
    this.conversations = new Map(); // sessionId -> conversation data
    this.intents = {
      GREETING: 'greeting',
      QUESTION: 'question',
      CLARIFICATION: 'clarification',
      SUMMARY: 'summary',
      NAVIGATION: 'navigation',
      FAREWELL: 'farewell',
      UNKNOWN: 'unknown'
    };
    
    // Intent detection patterns
    this.intentPatterns = {
      [this.intents.GREETING]: /^(hi|hello|hey|good morning|good afternoon|good evening)/i,
      [this.intents.QUESTION]: /\b(what|how|why|when|where|who|can you|could you|explain|tell me)\b/i,
      [this.intents.CLARIFICATION]: /\b(clarify|explain more|elaborate|can you repeat|what do you mean)\b/i,
      [this.intents.SUMMARY]: /\b(summarize|summary|overview|main points|key takeaways)\b/i,
      [this.intents.NAVIGATION]: /\b(go to|show me|navigate|slide|page|next|previous)\b/i,
      [this.intents.FAREWELL]: /^(bye|goodbye|thanks|thank you|that's all|end)/i
    };
  }

  /**
   * Initialize a new conversation session
   */
  initializeSession(sessionId, slideContext = null) {
    const session = {
      sessionId,
      createdAt: new Date(),
      lastActive: new Date(),
      conversationHistory: [],
      slideContext: slideContext || {},
      userProfile: {
        preferredResponseLength: 'medium', // short, medium, detailed
        interests: [],
        previousQuestions: []
      },
      metrics: {
        totalQuestions: 0,
        averageResponseTime: 0,
        satisfactionScore: null
      }
    };

    this.conversations.set(sessionId, session);
    console.log(`🎯 Initialized conversation session: ${sessionId}`);
    return session;
  }

  /**
   * Update slide context for existing session
   */
  updateSlideContext(sessionId, slideContext) {
    const session = this.conversations.get(sessionId);
    if (session) {
      session.slideContext = {
        ...session.slideContext,
        ...slideContext
      };
      session.lastActive = new Date();
      console.log(`📋 Updated slide context for session: ${sessionId}`);
    }
  }

  /**
   * Detect user intent from input text
   */
  detectIntent(userInput) {
    const cleanInput = userInput.trim().toLowerCase();
    
    if (!cleanInput) {
      return { intent: this.intents.UNKNOWN, confidence: 0 };
    }

    // Check each intent pattern
    for (const [intent, pattern] of Object.entries(this.intentPatterns)) {
      if (pattern.test(cleanInput)) {
        const confidence = this.calculateIntentConfidence(cleanInput, pattern);
        return { intent, confidence, rawInput: userInput };
      }
    }

    // Default to question if it ends with '?'
    if (cleanInput.endsWith('?')) {
      return { intent: this.intents.QUESTION, confidence: 0.7, rawInput: userInput };
    }

    return { intent: this.intents.UNKNOWN, confidence: 0.3, rawInput: userInput };
  }

  /**
   * Calculate confidence score for intent detection
   */
  calculateIntentConfidence(input, pattern) {
    const matches = input.match(pattern);
    if (!matches) return 0;
    
    // Simple confidence based on match strength and input length
    const matchStrength = matches[0].length / input.length;
    return Math.min(0.9, 0.5 + matchStrength);
  }

  /**
   * Generate contextual AI prompt based on intent and slide context
   */
  generatePrompt(intent, userInput, slideContext, conversationHistory) {
    const recentHistory = conversationHistory.slice(-3); // Last 3 exchanges
    const historyText = recentHistory
      .map(h => `User: ${h.userInput}\nAssistant: ${h.response}`)
      .join('\n\n');

    // TESTING: Log detailed context being sent to AI
    console.log('=== TESTING: AI PROMPT CONTEXT GENERATION ===');
    console.log('Intent:', intent);
    console.log('User Input:', `"${userInput}"`);
    console.log('Slide Context Available:', !!slideContext);
    if (slideContext) {
      console.log('Slide Context Details:');
      console.log('  Presentation ID:', slideContext.presentationId);
      console.log('  Title:', slideContext.title);
      console.log('  Total Slides:', slideContext.slides?.length || 0);
      console.log('  Full Text Length:', slideContext.fullText?.length || 0, 'characters');
      if (slideContext.slides && slideContext.slides.length > 0) {
        console.log('  Slide Summaries:');
        slideContext.slides.forEach((slide, index) => {
          console.log(`    Slide ${index + 1}: "${slide.title}" (${slide.content?.length || 0} chars)`);
        });
      }
    }
    console.log('Conversation History Length:', conversationHistory.length);
    console.log('Recent History (Last 3):');
    recentHistory.forEach((h, index) => {
      console.log(`  Exchange ${index + 1}:`);
      console.log(`    User: "${h.userInput}"`);
      console.log(`    AI: "${h.response?.substring(0, 100)}${h.response?.length > 100 ? '...' : ''}"`);
    });
    console.log('History Text for AI:');
    console.log(historyText || 'No recent history');
    console.log('=== END AI PROMPT CONTEXT ===');

    const baseContext = `
You are an AI assistant helping users understand a presentation. 
Current slide context: ${JSON.stringify(slideContext, null, 2)}
Recent conversation:
${historyText}

Current user input: "${userInput}"
Detected intent: ${intent}
`;

    switch (intent) {
      case this.intents.GREETING:
        return `${baseContext}
Respond with a friendly greeting and briefly introduce what you can help with regarding this presentation. Keep it warm but professional.`;

      case this.intents.QUESTION:
        return `${baseContext}
Answer the user's question using ONLY the information from the provided slide context. If the information isn't available in the slides, politely say so and suggest what you can help with instead. Be comprehensive but concise.`;

      case this.intents.CLARIFICATION:
        return `${baseContext}
Provide a clearer, more detailed explanation of the topic from your previous response. Use examples from the slide content when possible.`;

      case this.intents.SUMMARY:
        return `${baseContext}
Provide a concise summary of the main points from the presentation slides. Structure it with bullet points or numbered list for clarity.`;

      case this.intents.NAVIGATION:
        return `${baseContext}
Help the user navigate through the presentation. Mention relevant slide numbers and provide a brief overview of what they'll find on specific slides.`;

      case this.intents.FAREWELL:
        return `${baseContext}
Respond with a polite farewell and offer to help again if needed. Keep it brief and friendly.`;

      default:
        return `${baseContext}
I'm not sure what you're asking for. Please rephrase your question or ask about specific topics from the presentation. I can help with explanations, summaries, or navigation through the slides.`;
    }
  }

  /**
   * Generate response with error handling and fallbacks
   */
  async generateResponse(sessionId, userInput, options = {}) {
    const startTime = Date.now();
    
    try {
      // Validate input
      if (!userInput || typeof userInput !== 'string') {
        throw new Error('Invalid user input: must be a non-empty string');
      }

      // Get or create session
      let session = this.conversations.get(sessionId);
      if (!session) {
        session = this.initializeSession(sessionId);
      }

      // Update session activity
      session.lastActive = new Date();
      session.metrics.totalQuestions++;

      // Detect intent
      const intentResult = this.detectIntent(userInput);
      console.log(`🎯 Intent detected: ${intentResult.intent} (confidence: ${intentResult.confidence})`);

      // Generate AI prompt
      const prompt = this.generatePrompt(
        intentResult.intent,
        userInput,
        session.slideContext,
        session.conversationHistory
      );

      // TESTING: Log the complete prompt being sent to AI
      console.log('=== TESTING: COMPLETE AI PROMPT ===');
      console.log('Prompt Length:', prompt.length, 'characters');
      console.log('Full Prompt:');
      console.log('---START PROMPT---');
      console.log(prompt);
      console.log('---END PROMPT---');
      console.log('AI Provider Options:', {
        maxTokens: options.maxTokens || 500,
        temperature: options.temperature || 0.7
      });
      console.log('=== END COMPLETE AI PROMPT ===');

      // Get AI response
      const aiResponse = await aiProvider.generateText(prompt, {
        maxTokens: options.maxTokens || 500,
        temperature: options.temperature || 0.7
      });
      
      // TESTING: Log AI response received
      console.log('=== TESTING: AI RESPONSE RECEIVED ===');
      console.log('Response Length:', aiResponse?.length || 0, 'characters');
      console.log('Response Preview:', aiResponse?.substring(0, 200) + (aiResponse?.length > 200 ? '...' : ''));
      console.log('Full Response:');
      console.log('---START AI RESPONSE---');
      console.log(aiResponse);
      console.log('---END AI RESPONSE---');
      console.log('=== END AI RESPONSE RECEIVED ===');

      // Generate audio if requested
      let audioUrl = null;
      if (options.generateAudio !== false) {
        try {
          const audioPath = await textToSpeechService.textToSpeech(aiResponse);
          audioUrl = audioPath ? `/uploads/audio/${audioPath.split('/').pop()}` : null;
        } catch (audioError) {
          console.warn('⚠️ Audio generation failed:', audioError.message);
        }
      }

      // Find relevant slides
      const relevantSlides = this.findRelevantSlides(userInput, session.slideContext);

      // Update conversation history
      const conversationEntry = {
        timestamp: new Date(),
        userInput,
        intent: intentResult.intent,
        confidence: intentResult.confidence,
        response: aiResponse,
        audioUrl,
        relevantSlides,
        responseTime: Date.now() - startTime
      };

      session.conversationHistory.push(conversationEntry);
      
      // TESTING: Log conversation history update
      console.log('=== TESTING: CONVERSATION HISTORY UPDATE ===');
      console.log('New Entry Added:');
      console.log('  Timestamp:', conversationEntry.timestamp);
      console.log('  User Input:', `"${conversationEntry.userInput}"`);
      console.log('  AI Response:', `"${conversationEntry.response}"`);
      console.log('  Intent:', conversationEntry.intent);
      console.log('  Confidence:', Math.round(conversationEntry.confidence * 100) + '%');
      console.log('  Relevant Slides Count:', conversationEntry.relevantSlides.length);
      console.log('  Response Time:', conversationEntry.responseTime + 'ms');
      console.log('  Has Audio:', !!conversationEntry.audioUrl);
      
      console.log('Total Conversation History:', session.conversationHistory.length, 'entries');
      console.log('Complete Conversation History:');
      session.conversationHistory.forEach((entry, index) => {
        console.log(`  Entry ${index + 1}:`);
        console.log(`    User: "${entry.userInput}"`);
        console.log(`    AI: "${entry.response.substring(0, 80)}${entry.response.length > 80 ? '...' : ''}"`);
        console.log(`    Intent: ${entry.intent} (${Math.round(entry.confidence * 100)}%)`);
      });
      
      console.log('Context Available for Next Question:');
      console.log('  Slide Context: Available');
      console.log('  Conversation History:', session.conversationHistory.length, 'entries');
      console.log('  Last 3 entries will be included in next prompt');
      console.log('=== END CONVERSATION HISTORY UPDATE ===');

      // Update metrics
      const responseTime = Date.now() - startTime;
      session.metrics.averageResponseTime = 
        (session.metrics.averageResponseTime * (session.metrics.totalQuestions - 1) + responseTime) 
        / session.metrics.totalQuestions;

      console.log(`✅ Generated response in ${responseTime}ms for session: ${sessionId}`);

      return {
        success: true,
        response: aiResponse,
        audioUrl,
        intent: intentResult.intent,
        confidence: intentResult.confidence,
        relevantSlides,
        sessionId,
        responseTime,
        conversationId: conversationEntry.timestamp.getTime()
      };

    } catch (error) {
      console.error('❌ ConversationalAI Error:', error.message);
      
      return {
        success: false,
        error: error.message,
        fallbackResponse: this.getFallbackResponse(userInput),
        sessionId,
        responseTime: Date.now() - startTime
      };
    }
  }

  /**
   * Find slides relevant to user query
   */
  findRelevantSlides(userInput, slideContext) {
    if (!slideContext.slides || !Array.isArray(slideContext.slides)) {
      return [];
    }

    const keywords = userInput.toLowerCase().split(/\s+/)
      .filter(word => word.length > 3); // Filter short words

    return slideContext.slides
      .map((slide, index) => {
        const slideText = (slide.content || slide.text || slide.narration || '').toLowerCase();
        const slideTitle = (slide.title || '').toLowerCase();
        
        let relevanceScore = 0;
        keywords.forEach(keyword => {
          if (slideText.includes(keyword)) relevanceScore += 2;
          if (slideTitle.includes(keyword)) relevanceScore += 3;
        });

        return {
          slideIndex: index,
          title: slide.title || `Slide ${index + 1}`,
          relevanceScore
        };
      })
      .filter(slide => slide.relevanceScore > 0)
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, 3); // Top 3 relevant slides
  }

  /**
   * Get fallback response for errors
   */
  getFallbackResponse(userInput) {
    const fallbacks = [
      "I apologize, but I'm having trouble processing your request right now. Could you please rephrase your question?",
      "Sorry, there seems to be a technical issue. Please try asking your question in a different way.",
      "I'm experiencing some difficulties at the moment. Can you try asking a more specific question about the presentation?",
      "Unfortunately, I can't process that request right now. Please ask about specific topics from the slides."
    ];

    return fallbacks[Math.floor(Math.random() * fallbacks.length)];
  }

  /**
   * Get conversation analytics
   */
  getSessionAnalytics(sessionId) {
    const session = this.conversations.get(sessionId);
    if (!session) return null;

    const intentDistribution = {};
    session.conversationHistory.forEach(entry => {
      intentDistribution[entry.intent] = (intentDistribution[entry.intent] || 0) + 1;
    });

    return {
      sessionId,
      totalQuestions: session.metrics.totalQuestions,
      averageResponseTime: session.metrics.averageResponseTime,
      sessionDuration: Date.now() - session.createdAt.getTime(),
      intentDistribution,
      lastActive: session.lastActive,
      conversationLength: session.conversationHistory.length
    };
  }

  /**
   * Clean up old sessions
   */
  cleanupOldSessions(maxAgeHours = 24) {
    const cutoffTime = Date.now() - (maxAgeHours * 60 * 60 * 1000);
    let cleanedCount = 0;

    for (const [sessionId, session] of this.conversations.entries()) {
      if (session.lastActive.getTime() < cutoffTime) {
        this.conversations.delete(sessionId);
        cleanedCount++;
      }
    }

    console.log(`🧹 Cleaned up ${cleanedCount} old conversation sessions`);
    return cleanedCount;
  }

  /**
   * Get session summary
   */
  getSessionSummary(sessionId) {
    const session = this.conversations.get(sessionId);
    if (!session) return null;

    return {
      sessionId,
      createdAt: session.createdAt,
      lastActive: session.lastActive,
      totalQuestions: session.conversationHistory.length,
      slideContext: {
        hasSlides: !!session.slideContext.slides,
        slideCount: session.slideContext.slides?.length || 0,
        presentationTitle: session.slideContext.title
      },
      recentQuestions: session.conversationHistory
        .slice(-5)
        .map(h => ({ question: h.userInput, intent: h.intent }))
    };
  }
}

// Export singleton instance
const conversationalAI = new ConversationalAI();
export default conversationalAI; 