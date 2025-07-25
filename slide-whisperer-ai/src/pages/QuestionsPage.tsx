import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Mic, MicOff, Send, ArrowLeft, Volume2, Bot, User, Brain, MessageSquare } from 'lucide-react';

const API_BASE = 'http://localhost:7122';

interface Question {
  id: string;
  userInput: string;
  aiResponse: string;
  audioUrl?: string;
  intent: string;
  confidence: number;
  relevantSlides: Array<{
    slideIndex: number;
    title: string;
    relevanceScore: number;
  }>;
  timestamp: Date;
  responseTime: number;
}

interface ConversationSession {
  sessionId: string;
  createdAt: Date;
  lastActive: Date;
  totalQuestions: number;
}

export default function QuestionsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { slides, presentationId } = location.state || {};

  // Session and conversation state
  const [sessionId] = useState(() => `session-${presentationId}-${Date.now()}`);
  const [sessionInfo, setSessionInfo] = useState<ConversationSession | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Speech recognition state
  const [isListening, setIsListening] = useState(false);
  const [recognition, setRecognition] = useState<any>(null);
  const [transcript, setTranscript] = useState('');

  // UI state
  const [activeAudio, setActiveAudio] = useState<string | null>(null);
  const [showAnalytics, setShowAnalytics] = useState(false);

  const questionsEndRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Initialize conversation session
  useEffect(() => {
    initializeSession();
  }, []);

  // Initialize speech recognition
  useEffect(() => {
    if ('webkitSpeechRecognition' in window) {
      const speechRecognition = new (window as any).webkitSpeechRecognition();
      speechRecognition.continuous = false;
      speechRecognition.interimResults = true;
      speechRecognition.lang = 'en-US';

      speechRecognition.onstart = () => {
        console.log('🎤 Speech recognition started');
        setIsListening(true);
      };

      speechRecognition.onresult = (event: any) => {
        const currentTranscript = event.results[0][0].transcript;
        setTranscript(currentTranscript);
        setCurrentQuestion(currentTranscript);
        
        // TESTING: Log speech recognition details
        console.log('=== TESTING: SPEECH RECOGNITION ===');
        console.log('Speech Recognition Result:', `"${currentTranscript}"`);
        console.log('Transcript Length:', currentTranscript.length, 'characters');
        console.log('Is Final Result:', event.results[0].isFinal);
        console.log('Confidence Score:', event.results[0][0].confidence || 'Not available');
        console.log('=== END SPEECH RECOGNITION ===');
      };

      speechRecognition.onend = () => {
        console.log('🎤 Speech recognition ended');
        setIsListening(false);
        
        // Auto-submit if we have a transcript
        if (transcript.trim()) {
          setTimeout(() => {
            handleSubmitQuestion();
          }, 500);
        }
      };

      speechRecognition.onerror = (event: any) => {
        console.error('❌ Speech recognition error:', event.error);
        setIsListening(false);
      };

      setRecognition(speechRecognition);
    }
  }, [transcript]);

  // Auto-scroll to latest question
  useEffect(() => {
    questionsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [questions]);

  const initializeSession = async () => {
    try {
      const slideContext = {
        presentationId,
        title: slides?.[0]?.title || 'Presentation',
        slides: slides?.map((slide: any, index: number) => ({
          index,
          title: slide.title || `Slide ${index + 1}`,
          content: slide.preGeneratedNarration || slide.text || slide.narration || slide.content || '',
          imageUrl: slide.imageUrl
        })) || [],
        fullText: slides?.map((slide: any) => 
          slide.preGeneratedNarration || slide.text || slide.narration || slide.content || ''
        ).join(' ') || '',
        summary: `This presentation contains ${slides?.length || 0} slides about various topics.`
      };

      console.log('🎯 Initializing conversation session:', sessionId);
      console.log('📋 Slide context:', slideContext);
      
      // TESTING: Log detailed slide information
      console.log('=== TESTING: SLIDE CONTEXT DETAILS ===');
      console.log('Presentation ID:', presentationId);
      console.log('Presentation Title:', slideContext.title);
      console.log('Total Slides:', slideContext.slides.length);
      console.log('Full Text Length:', slideContext.fullText.length, 'characters');
      
      slideContext.slides.forEach((slide, index) => {
        console.log(`--- SLIDE ${index + 1} ---`);
        console.log('Title:', slide.title);
        console.log('Content Length:', slide.content.length, 'characters');
        console.log('Content Preview:', slide.content.substring(0, 100) + '...');
        console.log('Has Image:', !!slide.imageUrl);
      });
      
      console.log('=== END SLIDE CONTEXT DETAILS ===');

      const response = await fetch(`${API_BASE}/api/conversation/session/init`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId,
          slideContext
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to initialize session: ${response.statusText}`);
      }

      const result = await response.json();
      console.log('✅ Session initialized:', result);

      setSessionInfo({
        sessionId: result.sessionId,
        createdAt: new Date(result.createdAt),
        lastActive: new Date(),
        totalQuestions: 0
      });

    } catch (error) {
      console.error('❌ Session initialization failed:', error);
      setError('Failed to initialize conversation. Please try again.');
    }
  };

  const handleSubmitQuestion = async () => {
    const questionText = currentQuestion.trim();
    if (!questionText || isLoading) return;

    setIsLoading(true);
    setError(null);
    const questionId = `q-${Date.now()}`;
    const startTime = Date.now();

    // TESTING: Log detailed question information
    console.log('=== TESTING: NEW QUESTION SUBMITTED ===');
    console.log('Question Number:', questions.length + 1);
    console.log('Timestamp:', new Date().toLocaleString());
    console.log('Session ID:', sessionId);
    console.log('Question Text:', `"${questionText}"`);
    console.log('Question Length:', questionText.length, 'characters');
    console.log('Question Type:', questionText.endsWith('?') ? 'Interrogative' : 'Statement');
    console.log('Input Method:', transcript ? 'Voice (Speech Recognition)' : 'Text (Typed)');
    if (transcript) {
      console.log('Speech Transcript:', `"${transcript}"`);
    }
    
    // Log available slide context
    if (slides && slides.length > 0) {
      console.log('--- AVAILABLE SLIDE CONTEXT ---');
      console.log('Total Slides Available:', slides.length);
      slides.forEach((slide, index) => {
        const content = slide.preGeneratedNarration || slide.text || slide.narration || slide.content || '';
        console.log(`Slide ${index + 1}:`, {
          title: slide.title || `Slide ${index + 1}`,
          contentLength: content.length,
          hasContent: content.length > 0,
          contentPreview: content.substring(0, 50) + (content.length > 50 ? '...' : '')
        });
      });
    } else {
      console.log('--- NO SLIDE CONTEXT AVAILABLE ---');
    }
    
    console.log('=== END QUESTION DETAILS ===');

    try {
      console.log('📡 Sending chat message to API...');

             // TESTING: Log the exact request being sent to the API
       const requestPayload = {
         message: questionText,
         sessionId,
         options: {
           generateAudio: true,
           maxTokens: 500,
           temperature: 0.7
         }
       };
       
       console.log('=== TESTING: API REQUEST PAYLOAD ===');
       console.log('API Endpoint:', `${API_BASE}/api/conversation/chat`);
       console.log('Request Method:', 'POST');
       console.log('Request Headers:', { 'Content-Type': 'application/json' });
       console.log('Request Payload:');
       console.log(JSON.stringify(requestPayload, null, 2));
       console.log('Payload Size:', JSON.stringify(requestPayload).length, 'bytes');
       console.log('=== END API REQUEST PAYLOAD ===');

       const response = await fetch(`${API_BASE}/api/conversation/chat`, {
         method: 'POST',
         headers: {
           'Content-Type': 'application/json',
         },
         body: JSON.stringify(requestPayload),
       });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Request failed: ${response.statusText}`);
      }

      const result = await response.json();
      console.log('✅ Chat response received from API');
      
      // TESTING: Log detailed response information
      console.log('=== TESTING: AI RESPONSE DETAILS ===');
      console.log('Response Success:', result.success);
      console.log('AI Response Text:', `"${result.message}"`);
      console.log('Response Length:', result.message?.length || 0, 'characters');
      console.log('Detected Intent:', result.intent);
      console.log('Intent Confidence:', Math.round((result.confidence || 0) * 100) + '%');
      console.log('Response Time:', result.responseTime + 'ms');
      console.log('Has Audio URL:', !!result.audioUrl);
      if (result.audioUrl) {
        console.log('Audio URL:', result.audioUrl);
      }
      
      if (result.relevantSlides && result.relevantSlides.length > 0) {
        console.log('--- RELEVANT SLIDES FOUND ---');
        result.relevantSlides.forEach((slide, index) => {
          console.log(`Relevant Slide ${index + 1}:`, {
            slideIndex: slide.slideIndex,
            title: slide.title,
            relevanceScore: slide.relevanceScore
          });
        });
      } else {
        console.log('--- NO RELEVANT SLIDES FOUND ---');
      }
      
      console.log('Conversation ID:', result.conversationId);
      console.log('Session ID:', result.sessionId);
      console.log('=== END AI RESPONSE DETAILS ===');

      const newQuestion: Question = {
        id: questionId,
        userInput: questionText,
        aiResponse: result.message,
        audioUrl: result.audioUrl,
        intent: result.intent,
        confidence: result.confidence,
        relevantSlides: result.relevantSlides || [],
        timestamp: new Date(result.timestamp),
        responseTime: result.responseTime
      };

      setQuestions(prev => [...prev, newQuestion]);
      setCurrentQuestion('');
      setTranscript('');
      
      // TESTING: Log updated conversation state
      console.log('=== TESTING: CONVERSATION STATE UPDATE ===');
      console.log('Total Questions in Conversation:', questions.length + 1);
      console.log('Question Added to History:', {
        questionNumber: questions.length + 1,
        userInput: questionText,
        intent: result.intent,
        hasAudio: !!result.audioUrl,
        relevantSlidesCount: result.relevantSlides?.length || 0
      });
      console.log('=== END CONVERSATION STATE UPDATE ===');

      // Update session info
      if (sessionInfo) {
        setSessionInfo(prev => prev ? {
          ...prev,
          lastActive: new Date(),
          totalQuestions: prev.totalQuestions + 1
        } : null);
      }

      // TESTING: Log context that will be sent with future questions
      console.log('=== TESTING: UPDATED CONTEXT FOR FUTURE QUESTIONS ===');
      const updatedConversationHistory = [...questions, newQuestion];
      console.log('Conversation History Length:', updatedConversationHistory.length);
      console.log('Full Conversation Context:');
      updatedConversationHistory.forEach((q, index) => {
        console.log(`  Question ${index + 1}:`);
        console.log(`    User: "${q.userInput}"`);
        console.log(`    AI: "${q.aiResponse}"`);
        console.log(`    Intent: ${q.intent} (${Math.round(q.confidence * 100)}%)`);
        console.log(`    Relevant Slides: ${q.relevantSlides.map(s => s.title).join(', ') || 'None'}`);
      });
      
      // Log what context will be available for the NEXT question
      console.log('--- CONTEXT AVAILABLE FOR NEXT QUESTION ---');
      console.log('Slide Context Summary:');
      if (slides && slides.length > 0) {
        slides.forEach((slide, index) => {
          const content = slide.preGeneratedNarration || slide.text || slide.narration || slide.content || '';
          console.log(`  Slide ${index + 1}: "${slide.title || `Slide ${index + 1}`}" (${content.length} chars)`);
        });
      }
      console.log('Recent Conversation (Last 3 exchanges):');
      const recentQuestions = updatedConversationHistory.slice(-3);
      recentQuestions.forEach((q, index) => {
        console.log(`  Exchange ${index + 1}: "${q.userInput}" → "${q.aiResponse.substring(0, 100)}..."`);
      });
      console.log('=== END UPDATED CONTEXT ===');

      // Auto-play audio if available
      if (result.audioUrl && audioRef.current) {
        audioRef.current.src = `${API_BASE}${result.audioUrl}`;
        audioRef.current.play().catch(console.warn);
        setActiveAudio(questionId);
      }

    } catch (error) {
      console.error('❌ Question submission failed:', error);
      
      // TESTING: Log detailed error information
      console.log('=== TESTING: ERROR DETAILS ===');
      console.log('Error Type:', error instanceof Error ? 'Error Object' : typeof error);
      console.log('Error Message:', error instanceof Error ? error.message : String(error));
      console.log('Question That Failed:', `"${questionText}"`);
      console.log('Session ID:', sessionId);
      console.log('Current Questions Count:', questions.length);
      console.log('=== END ERROR DETAILS ===');
      
      setError(error instanceof Error ? error.message : 'Failed to process question');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleMicrophone = () => {
    if (!recognition) {
      console.log('=== TESTING: SPEECH RECOGNITION ERROR ===');
      console.log('Speech Recognition Support:', 'Not Available');
      console.log('Browser:', navigator.userAgent);
      console.log('=== END SPEECH RECOGNITION ERROR ===');
      setError('Speech recognition not supported in this browser');
      return;
    }

    console.log('=== TESTING: MICROPHONE TOGGLE ===');
    console.log('Current State:', isListening ? 'Listening' : 'Not Listening');
    console.log('Action:', isListening ? 'Stopping Recognition' : 'Starting Recognition');
    console.log('Current Question:', currentQuestion);
    console.log('Current Transcript:', transcript);

    if (isListening) {
      recognition.stop();
      console.log('Speech Recognition Stopped');
    } else {
      setCurrentQuestion('');
      setTranscript('');
      recognition.start();
      console.log('Speech Recognition Started');
    }
    console.log('=== END MICROPHONE TOGGLE ===');
  };

  const playAudio = (audioUrl: string, questionId: string) => {
    console.log('=== TESTING: AUDIO PLAYBACK ===');
    console.log('Question ID:', questionId);
    console.log('Audio URL:', audioUrl);
    console.log('Full Audio URL:', `${API_BASE}${audioUrl}`);
    console.log('Audio Element Available:', !!audioRef.current);
    
    if (audioRef.current) {
      audioRef.current.src = `${API_BASE}${audioUrl}`;
      audioRef.current.play()
        .then(() => {
          console.log('✅ Audio playback started successfully');
          setActiveAudio(questionId);
        })
        .catch((error) => {
          console.error('❌ Audio playback failed:', error);
          console.log('Audio Error Details:', {
            error: error.message,
            audioSrc: audioRef.current?.src,
            audioReadyState: audioRef.current?.readyState,
            audioNetworkState: audioRef.current?.networkState
          });
        });
    } else {
      console.error('❌ Audio element not available');
    }
    console.log('=== END AUDIO PLAYBACK ===');
  };

  const navigateToSlide = (slideIndex: number) => {
    navigate('/walkthrough', { 
      state: { 
        slides, 
        presentationId,
        startSlide: slideIndex
      } 
    });
  };

  const getIntentColor = (intent: string) => {
    const colors = {
      greeting: 'bg-green-100 text-green-800',
      question: 'bg-blue-100 text-blue-800',
      clarification: 'bg-yellow-100 text-yellow-800',
      summary: 'bg-purple-100 text-purple-800',
      navigation: 'bg-orange-100 text-orange-800',
      farewell: 'bg-gray-100 text-gray-800',
      unknown: 'bg-red-100 text-red-800'
    };
    return colors[intent as keyof typeof colors] || colors.unknown;
  };

  const getConfidenceIcon = (confidence: number) => {
    if (confidence >= 0.8) return '🟢';
    if (confidence >= 0.6) return '🟡';
    return '🔴';
  };

  if (!slides || slides.length === 0) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardContent className="text-center py-8">
            <p className="text-gray-600">No presentation data available.</p>
            <Button onClick={() => navigate('/')} className="mt-4">
              Go Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            onClick={() => navigate('/walkthrough', { state: { slides, presentationId } })}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Presentation
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <MessageSquare className="w-6 h-6" />
              AI Q&A Session
            </h1>
            {sessionInfo && (
              <p className="text-sm text-gray-600">
                Session: {sessionInfo.totalQuestions} questions asked
              </p>
            )}
          </div>
        </div>

        <Button
          variant="outline"
          onClick={() => setShowAnalytics(!showAnalytics)}
          className="flex items-center gap-2"
        >
          <Brain className="w-4 h-4" />
          Analytics
        </Button>
      </div>

      {/* Error Display */}
      {error && (
        <Card className="mb-6 border-red-200 bg-red-50">
          <CardContent className="py-4">
            <p className="text-red-600">❌ {error}</p>
          </CardContent>
        </Card>
      )}

      {/* Analytics Panel */}
      {showAnalytics && sessionInfo && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="w-5 h-5" />
              Conversation Analytics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{questions.length}</div>
                <div className="text-sm text-gray-600">Total Questions</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {questions.length > 0 ? Math.round(questions.reduce((sum, q) => sum + q.responseTime, 0) / questions.length) : 0}ms
                </div>
                <div className="text-sm text-gray-600">Avg Response Time</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">
                  {questions.length > 0 ? Math.round(questions.reduce((sum, q) => sum + q.confidence, 0) / questions.length * 100) : 0}%
                </div>
                <div className="text-sm text-gray-600">Avg Confidence</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">{slides?.length || 0}</div>
                <div className="text-sm text-gray-600">Slides Available</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Questions Display */}
      <div className="space-y-4 mb-6">
        {questions.map((question) => (
          <Card key={question.id} className="w-full">
            <CardContent className="py-4">
              {/* User Question */}
              <div className="flex items-start gap-3 mb-4">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <User className="w-4 h-4 text-blue-600" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold">You</span>
                    <Badge className={getIntentColor(question.intent)}>
                      {question.intent}
                    </Badge>
                    <span className="text-xs text-gray-500">
                      {getConfidenceIcon(question.confidence)} {Math.round(question.confidence * 100)}%
                    </span>
                  </div>
                  <p className="text-gray-700">{question.userInput}</p>
                </div>
              </div>

              {/* AI Response */}
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                  <Bot className="w-4 h-4 text-green-600" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold">AI Assistant</span>
                    {question.audioUrl && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => playAudio(question.audioUrl!, question.id)}
                        className="flex items-center gap-1 h-6 px-2"
                      >
                        <Volume2 className="w-3 h-3" />
                        {activeAudio === question.id ? 'Playing...' : 'Play'}
                      </Button>
                    )}
                    <span className="text-xs text-gray-500">
                      {question.responseTime}ms
                    </span>
                  </div>
                  <p className="text-gray-700 mb-2">{question.aiResponse}</p>

                  {/* Relevant Slides */}
                  {question.relevantSlides.length > 0 && (
                    <div className="mt-3">
                      <p className="text-sm font-medium text-gray-600 mb-2">Related slides:</p>
                      <div className="flex flex-wrap gap-2">
                        {question.relevantSlides.map((slide) => (
                          <Button
                            key={slide.slideIndex}
                            variant="outline"
                            size="sm"
                            onClick={() => navigateToSlide(slide.slideIndex)}
                            className="text-xs"
                          >
                            {slide.title} (#{slide.slideIndex + 1})
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        <div ref={questionsEndRef} />
      </div>

      {/* Question Input */}
      <Card className="sticky bottom-0 bg-white shadow-lg">
        <CardContent className="py-4">
          <div className="flex gap-2">
            <Input
              value={currentQuestion}
              onChange={(e) => setCurrentQuestion(e.target.value)}
              placeholder="Ask a question about the presentation..."
              onKeyPress={(e) => e.key === 'Enter' && handleSubmitQuestion()}
              disabled={isLoading}
              className="flex-1"
            />
            <Button
              onClick={toggleMicrophone}
              variant={isListening ? "destructive" : "outline"}
              size="icon"
              disabled={isLoading}
            >
              {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </Button>
            <Button 
              onClick={handleSubmitQuestion}
              disabled={!currentQuestion.trim() || isLoading}
              className="flex items-center gap-2"
            >
              <Send className="w-4 h-4" />
              {isLoading ? 'Thinking...' : 'Ask'}
            </Button>
          </div>
          
          {isListening && (
            <p className="text-sm text-blue-600 mt-2">
              🎤 Listening... (Transcript: "{transcript}")
            </p>
          )}
        </CardContent>
      </Card>

      {/* Hidden audio element */}
      <audio
        ref={audioRef}
        onEnded={() => setActiveAudio(null)}
        onError={() => setActiveAudio(null)}
      />
    </div>
  );
} 