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
  const [microphonePermission, setMicrophonePermission] = useState<'granted' | 'denied' | 'prompt' | 'unknown'>('unknown');
  const [networkRetryCount, setNetworkRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);

  // UI state
  const [activeAudio, setActiveAudio] = useState<string | null>(null);
  const [showAnalytics, setShowAnalytics] = useState(false);

  const questionsEndRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const interimTranscriptRef = useRef('');

  // Initialize conversation session
  useEffect(() => {
    initializeSession();
    initializeSpeechRecognition();
  }, []);

  const initializeSpeechRecognition = async () => {
    // Check if speech recognition is supported
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      setError('Speech recognition is not supported in this browser. Please use Chrome, Edge, or Safari.');
      return;
    }

    try {
      // Request microphone permissions first
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop()); // Stop the stream, we just needed permission
      setMicrophonePermission('granted');
      console.log('🎤 Microphone permission granted');

      // Initialize speech recognition
      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
      const speechRecognition = new SpeechRecognition();
      
      speechRecognition.continuous = false;
      speechRecognition.interimResults = true;
      speechRecognition.lang = 'en-US';
      speechRecognition.maxAlternatives = 1;

      speechRecognition.onstart = () => {
        console.log('🎤 Speech recognition started');
        setIsListening(true);
        setError(null);
        interimTranscriptRef.current = '';
      };

      speechRecognition.onresult = (event: any) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          } else {
            interimTranscript += transcript;
          }
        }

        const currentTranscript = finalTranscript || interimTranscript;
        interimTranscriptRef.current = currentTranscript;
        setTranscript(currentTranscript);
        setCurrentQuestion(currentTranscript);
        
        console.log('🎤 Speech recognized:', `"${currentTranscript}"`);
      };

      speechRecognition.onend = () => {
        console.log('🎤 Speech recognition ended');
        setIsListening(false);
        
        // Auto-submit if we have a final transcript
        const finalTranscript = interimTranscriptRef.current.trim();
        if (finalTranscript) {
          console.log('📝 Auto-submitting transcript:', finalTranscript);
          setTimeout(() => {
            handleSubmitQuestion();
          }, 500);
        }
      };

      speechRecognition.onerror = (event: any) => {
        console.error('❌ Speech recognition error:', event.error);
        setIsListening(false);
        setIsRetrying(false);
        
        let errorMessage;
        switch (event.error) {
          case 'not-allowed':
            setMicrophonePermission('denied');
            errorMessage = 'Microphone access denied. Please click the microphone icon in your browser\'s address bar and allow access.';
            break;
          case 'no-speech':
            errorMessage = 'No speech detected. Please speak clearly and try again.';
            break;
          case 'network':
            // Try to retry network errors automatically
            if (networkRetryCount < 3) {
              setIsRetrying(true);
              const retryDelay = Math.pow(2, networkRetryCount) * 1000; // Exponential backoff
              console.log(`🔄 Network error, retrying in ${retryDelay}ms (attempt ${networkRetryCount + 1}/3)`);
              
              setTimeout(() => {
                setNetworkRetryCount(prev => prev + 1);
                setIsRetrying(false);
                if (recognition) {
                  try {
                    recognition.start();
                  } catch (e) {
                    console.error('❌ Retry failed:', e);
                    setError('Network connection unstable. Please check your internet and try again.');
                  }
                }
              }, retryDelay);
              
              errorMessage = `Network error (retrying in ${Math.round(retryDelay/1000)}s...)`;
            } else {
              setNetworkRetryCount(0);
              errorMessage = 'Network connection failed after 3 attempts. Please check your internet connection or try typing your question.';
            }
            break;
          case 'service-not-allowed':
            errorMessage = 'Speech recognition service blocked. Please check your browser settings or try a different browser.';
            break;
          case 'aborted':
            // User stopped recording, don't show error
            return;
          default:
            errorMessage = `Speech recognition error: ${event.error}. Please try again.`;
        }
          
        setError(errorMessage);
        
        // Auto-clear non-critical errors (except permission and persistent network issues)
        if (event.error !== 'not-allowed' && networkRetryCount === 0) {
          setTimeout(() => setError(null), 8000);
        }
      };

      setRecognition(speechRecognition);
      console.log('🎙️ Speech recognition initialized successfully');

    } catch (error) {
      console.error('❌ Failed to initialize microphone:', error);
      setMicrophonePermission('denied');
      setError('Microphone access denied. Please allow microphone access and refresh the page.');
    }
  };

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
      console.log('📋 Slide context available:', slideContext.slides.length, 'slides');

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

    console.log('🤔 Question submitted:', `"${questionText}"`);

    try {
      console.log('📡 Sending chat message to API...');

      const requestPayload = {
        message: questionText,
        sessionId,
        options: {
          generateAudio: true,
          maxTokens: 500,
          temperature: 0.7
        }
      };

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
      console.log('✅ AI Response:', result.intent, `(${Math.round((result.confidence || 0) * 100)}%)`, result.responseTime + 'ms');

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
      interimTranscriptRef.current = '';

      // Update session info
      if (sessionInfo) {
        setSessionInfo(prev => prev ? {
          ...prev,
          lastActive: new Date(),
          totalQuestions: prev.totalQuestions + 1
        } : null);
      }

      // Auto-play audio if available
      if (result.audioUrl && audioRef.current) {
        audioRef.current.src = `${API_BASE}${result.audioUrl}`;
        audioRef.current.play().catch(console.warn);
        setActiveAudio(questionId);
      }

    } catch (error) {
      console.error('❌ Question failed:', error instanceof Error ? error.message : String(error));
      setError(error instanceof Error ? error.message : 'Failed to process question');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleMicrophone = async () => {
    console.log('🎤 Microphone toggle clicked, current state:', { isListening, microphonePermission });
    
    if (isListening) {
      console.log('🛑 Stopping speech recognition');
      if (recognition) {
        recognition.stop();
      }
      setIsListening(false);
    } else {
      // Check microphone permission first
      if (microphonePermission === 'denied') {
        setError('Microphone access is denied. Please click the microphone icon in your browser\'s address bar and allow access, then refresh the page.');
        return;
      }

      if (microphonePermission === 'unknown') {
        setError('Microphone permission not initialized. Please refresh the page.');
        return;
      }

      if (!recognition) {
        setError('Speech recognition not available. Please refresh the page or try a different browser.');
        return;
      }

      console.log('▶️ Starting speech recognition');
      setCurrentQuestion('');
      setTranscript('');
      interimTranscriptRef.current = '';
      setError(null);
      setNetworkRetryCount(0); // Reset retry count for new session
      
      try {
        recognition.start();
      } catch (error) {
        console.error('❌ Failed to start speech recognition:', error);
        setError('Failed to start speech recognition. Please try again.');
        setIsListening(false);
      }
    }
  };

  const playAudio = (audioUrl: string, questionId: string) => {
    if (audioRef.current) {
      audioRef.current.src = `${API_BASE}${audioUrl}`;
      audioRef.current.play()
        .then(() => setActiveAudio(questionId))
        .catch((error) => console.error('❌ Audio playback failed:', error));
    }
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

      {/* Microphone Status */}
      {microphonePermission !== 'granted' && (
        <Card className="mb-6 border-yellow-200 bg-yellow-50">
          <CardContent className="py-4">
            <p className="text-yellow-700">
              🎤 Microphone {microphonePermission === 'denied' ? 'access denied' : 'not yet configured'}. 
              {microphonePermission === 'denied' && ' Click the microphone icon in your browser\'s address bar to allow access.'}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Error Display */}
      {error && (
        <Card className="mb-6 border-red-200 bg-red-50">
          <CardContent className="py-4">
            <p className="text-red-600">❌ {error}</p>
            {error.includes('Microphone access') && (
              <Button 
                size="sm" 
                variant="outline" 
                className="mt-2"
                onClick={() => window.location.reload()}
              >
                Refresh Page
              </Button>
            )}
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
              title={
                microphonePermission === 'denied' 
                  ? 'Microphone access denied - check browser settings'
                  : isListening 
                    ? 'Stop recording' 
                    : 'Start voice input'
              }
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
            <div className="mt-2 p-2 bg-blue-50 rounded-md">
              <p className="text-sm text-blue-600 font-medium">
                🎤 Listening... Speak now!
              </p>
              {transcript && (
                <p className="text-sm text-gray-600 mt-1">
                  Current: "{transcript}"
                </p>
              )}
            </div>
          )}
          
          {isRetrying && (
            <div className="mt-2 p-2 bg-yellow-50 rounded-md">
              <p className="text-sm text-yellow-600 font-medium">
                🔄 Network issue detected, retrying speech recognition...
              </p>
            </div>
          )}
          
          {microphonePermission === 'granted' && !recognition && (
            <p className="text-sm text-gray-500 mt-2">
              Speech recognition is being initialized...
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