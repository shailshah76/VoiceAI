# Conversational AI Architecture

## Overview

This document describes the modular conversational AI system designed for the VoiceAI presentation platform. The system provides contextually-aware responses based on slide content, maintains conversation history, detects user intent, and supports future extensibility for features like sentiment analysis and external API integrations.

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Frontend (React)                            │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │  QuestionsPage  │  │  Voice Input    │  │   Analytics     │  │
│  │     Component   │  │    Component    │  │    Dashboard    │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                                │ HTTP API Calls
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Backend API Layer                           │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │  Conversation   │  │  Session Mgmt   │  │   Analytics     │  │
│  │    Router       │  │   Endpoints     │  │   Endpoints     │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                 ConversationalAI Service                       │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │  Intent         │  │  Context        │  │   Response      │  │
│  │  Detection      │  │  Management     │  │  Generation     │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                  External Services                             │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │   AI Provider   │  │      TTS        │  │   Audio Cache   │  │
│  │ (Groq/Gemini)   │  │   Services      │  │     System      │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. ConversationalAI Service (`src/services/conversationalAI.js`)

The main service that orchestrates all conversational AI functionality.

#### Key Features:
- **Session Management**: Manages multiple concurrent conversation sessions
- **Intent Detection**: Identifies user intent using pattern matching and confidence scoring
- **Context Awareness**: Maintains slide context and conversation history
- **Response Generation**: Creates contextually relevant responses using AI providers
- **Audio Integration**: Generates speech for responses using TTS services
- **Analytics**: Tracks conversation metrics and user patterns

#### Intent Types:
```javascript
const intents = {
  GREETING: 'greeting',        // "Hello", "Hi there"
  QUESTION: 'question',        // "What is...", "How does..."
  CLARIFICATION: 'clarification', // "Can you explain more..."
  SUMMARY: 'summary',          // "Summarize the main points"
  NAVIGATION: 'navigation',    // "Go to slide 3"
  FAREWELL: 'farewell',        // "Thank you", "Goodbye"
  UNKNOWN: 'unknown'           // Fallback for unrecognized intents
};
```

#### Session Structure:
```javascript
{
  sessionId: string,
  createdAt: Date,
  lastActive: Date,
  conversationHistory: Array<ConversationEntry>,
  slideContext: {
    presentationId: string,
    title: string,
    slides: Array<SlideData>,
    fullText: string,
    summary: string
  },
  userProfile: {
    preferredResponseLength: 'short' | 'medium' | 'detailed',
    interests: Array<string>,
    previousQuestions: Array<string>
  },
  metrics: {
    totalQuestions: number,
    averageResponseTime: number,
    satisfactionScore: number
  }
}
```

### 2. Conversation Router (`src/routes/conversation.js`)

RESTful API endpoints for managing conversations.

#### Endpoints:

##### Core Conversation
- `POST /api/conversation/chat` - Main chat endpoint
- `POST /api/conversation/session/init` - Initialize new session
- `PUT /api/conversation/session/:sessionId/context` - Update slide context

##### Session Management
- `GET /api/conversation/session/:sessionId` - Get session info
- `DELETE /api/conversation/session/:sessionId` - Delete session
- `GET /api/conversation/sessions` - List all sessions (admin)

##### Analytics & Utilities
- `GET /api/conversation/session/:sessionId/analytics` - Session analytics
- `POST /api/conversation/intent/detect` - Intent detection utility
- `POST /api/conversation/cleanup` - Clean old sessions
- `GET /api/conversation/health` - Service health check

### 3. Frontend Integration (`slide-whisperer-ai/src/pages/QuestionsPage.tsx`)

Enhanced React component with:
- **Session Initialization**: Automatically sets up conversation context
- **Real-time Chat Interface**: Modern chat UI with intent badges
- **Voice Input**: Speech-to-text integration
- **Audio Playback**: Response audio with visual feedback
- **Analytics Dashboard**: Real-time conversation metrics
- **Slide Navigation**: Direct navigation to relevant slides

## API Usage Examples

### Initialize a Conversation Session

```javascript
const response = await fetch('/api/conversation/session/init', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    sessionId: 'session-presentation-123',
    slideContext: {
      presentationId: 'pres-123',
      title: 'Machine Learning Fundamentals',
      slides: [
        {
          index: 0,
          title: 'Introduction',
          content: 'Machine learning is a subset of artificial intelligence...',
          imageUrl: '/uploads/slide-1.jpg'
        }
        // ... more slides
      ],
      fullText: 'Complete presentation text...',
      summary: 'This presentation covers ML fundamentals...'
    }
  })
});
```

### Send a Chat Message

```javascript
const response = await fetch('/api/conversation/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    message: 'What is supervised learning?',
    sessionId: 'session-presentation-123',
    options: {
      generateAudio: true,
      maxTokens: 500,
      temperature: 0.7
    }
  })
});

const result = await response.json();
// Returns: { success, message, audioUrl, intent, confidence, relevantSlides, ... }
```

### Get Session Analytics

```javascript
const response = await fetch('/api/conversation/session/session-123/analytics');
const analytics = await response.json();
// Returns: { totalQuestions, averageResponseTime, intentDistribution, ... }
```

## Intent Detection System

### Pattern-Based Detection

The system uses regex patterns to identify user intent:

```javascript
const intentPatterns = {
  greeting: /^(hi|hello|hey|good morning)/i,
  question: /\b(what|how|why|when|where|who|can you|explain)\b/i,
  clarification: /\b(clarify|explain more|elaborate|repeat)\b/i,
  summary: /\b(summarize|overview|main points|key takeaways)\b/i,
  navigation: /\b(go to|show me|navigate|slide|page)\b/i,
  farewell: /^(bye|goodbye|thanks|thank you)/i
};
```

### Confidence Scoring

Confidence is calculated based on:
- Pattern match strength
- Input length ratio
- Context relevance
- Historical accuracy

## Context Management

### Slide Context Storage

The system maintains rich context about presentations:

```javascript
{
  presentationId: 'unique-id',
  title: 'Presentation Title',
  slides: [
    {
      index: 0,
      title: 'Slide Title',
      content: 'Full slide content/narration',
      imageUrl: 'path/to/image'
    }
  ],
  fullText: 'Combined text from all slides',
  summary: 'AI-generated or manual summary'
}
```

### Conversation History

Each interaction is stored with metadata:

```javascript
{
  timestamp: Date,
  userInput: 'User question',
  intent: 'question',
  confidence: 0.85,
  response: 'AI response',
  audioUrl: '/uploads/audio/response.wav',
  relevantSlides: [
    { slideIndex: 2, title: 'Relevant Slide', relevanceScore: 0.9 }
  ],
  responseTime: 1250
}
```

## Response Generation Strategy

### Intent-Based Prompting

Different prompts are generated based on detected intent:

```javascript
switch (intent) {
  case 'greeting':
    return `Respond with a friendly greeting and introduce capabilities...`;
  
  case 'question':
    return `Answer using ONLY information from slide context. If not available, suggest alternatives...`;
  
  case 'summary':
    return `Provide concise summary with bullet points from presentation slides...`;
  
  // ... other intent-specific prompts
}
```

### Context Integration

Prompts include:
- Recent conversation history (last 3 exchanges)
- Full slide context with metadata
- User intent and confidence score
- Response formatting guidelines

## Audio Integration

### TTS Pipeline

1. **Response Generation**: AI generates text response
2. **Audio Generation**: TTS service converts text to speech
3. **Caching**: Audio cached for repeat requests
4. **Delivery**: Audio URL returned to frontend
5. **Playback**: Frontend plays audio with visual feedback

### Fallback Strategy

```
Primary: Groq PlayAI TTS
    ↓ (if rate limited/failed)
Fallback: Gemini Live TTS
    ↓ (if failed)
Final: Test beep audio (error indication)
```

## Analytics and Monitoring

### Session Metrics

- **Total Questions**: Number of user interactions
- **Average Response Time**: Performance metric
- **Intent Distribution**: Usage patterns
- **Confidence Scores**: Intent detection accuracy
- **Session Duration**: Engagement measurement

### System Health

- **Active Sessions**: Current load
- **Memory Usage**: Resource monitoring
- **Error Rates**: System reliability
- **Cache Hit Ratio**: Performance optimization

## Error Handling and Resilience

### Graceful Degradation

1. **AI Provider Failure**: Fallback to secondary provider
2. **TTS Failure**: Continue with text-only responses
3. **Intent Detection Failure**: Default to general question handling
4. **Context Loss**: Request context re-initialization

### Input Validation

- **Message Validation**: Non-empty string requirement
- **Session Validation**: Valid session ID requirement
- **Context Validation**: Slide data structure validation
- **Rate Limiting**: Prevent abuse and overload

## Future Extensibility

### Planned Extensions

1. **Sentiment Analysis**
   ```javascript
   // Extension point in generateResponse()
   const sentiment = await sentimentAnalyzer.analyze(userInput);
   // Adjust response tone based on sentiment
   ```

2. **External API Integration**
   ```javascript
   // Extension point for external knowledge
   if (requiresExternalData(userInput)) {
     const externalData = await externalAPI.query(userInput);
     context = { ...context, externalData };
   }
   ```

3. **Multi-language Support**
   ```javascript
   // Extension point for language detection
   const language = detectLanguage(userInput);
   const localizedPrompt = generateLocalizedPrompt(intent, language);
   ```

4. **Voice Cloning**
   ```javascript
   // Extension point for personalized voices
   const voiceProfile = getUserVoiceProfile(sessionId);
   const personalizedAudio = await tts.generateWithVoice(text, voiceProfile);
   ```

### Plugin Architecture

The system is designed for easy plugin integration:

```javascript
class ConversationalAI {
  constructor() {
    this.plugins = [];
  }
  
  addPlugin(plugin) {
    this.plugins.push(plugin);
  }
  
  async processWithPlugins(input, context) {
    for (const plugin of this.plugins) {
      context = await plugin.process(input, context);
    }
    return context;
  }
}
```

## Security Considerations

### Data Protection

- **Session Isolation**: Each session's data is isolated
- **Context Sanitization**: Slide content is sanitized
- **Input Validation**: All inputs are validated and sanitized
- **Rate Limiting**: Prevents abuse and DoS attacks

### Privacy

- **No Persistent Storage**: Conversations stored in memory only
- **Automatic Cleanup**: Old sessions automatically deleted
- **User Control**: Users can delete their sessions
- **Minimal Data**: Only necessary data is stored

## Performance Optimization

### Caching Strategy

- **Audio Caching**: Generated TTS cached by content hash
- **Context Caching**: Slide context cached in memory
- **Response Caching**: Common responses cached
- **Intent Caching**: Intent patterns compiled once

### Memory Management

- **Session Limits**: Maximum number of active sessions
- **History Limits**: Conversation history truncated
- **Cleanup Scheduler**: Automatic old data cleanup
- **Garbage Collection**: Proper object disposal

## Deployment and Scaling

### Horizontal Scaling

The system can be scaled by:
1. **Load Balancing**: Multiple backend instances
2. **Session Sharding**: Distribute sessions across instances
3. **Redis Integration**: Shared session storage
4. **Microservice Split**: Separate intent detection, response generation

### Monitoring

Key metrics to monitor:
- **Response Time**: API performance
- **Error Rate**: System reliability
- **Memory Usage**: Resource consumption
- **Cache Hit Rate**: Performance optimization
- **Session Count**: Load measurement

## Conclusion

This conversational AI system provides a robust, modular foundation for intelligent presentation interactions. Its design prioritizes:

- **Modularity**: Easy to extend and modify
- **Performance**: Optimized for real-time responses
- **Reliability**: Graceful error handling and fallbacks
- **User Experience**: Contextually aware and responsive
- **Scalability**: Designed for growth and expansion

The architecture supports current needs while providing clear extension points for future enhancements like sentiment analysis, external APIs, and advanced personalization features. 