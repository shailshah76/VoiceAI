import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Mic, MicOff, Play, Pause, Volume2 } from "lucide-react";
import sampleSlide1 from "@/assets/sample-slide-1.jpg";
import sampleSlide2 from "@/assets/sample-slide-2.jpg";

const sampleSlides = [
  {
    id: 1,
    image: sampleSlide1,
    title: "Sustainable Energy Solutions",
    narration: "Welcome to our presentation on sustainable energy. Today we'll explore how solar and wind power are transforming our energy landscape."
  },
  {
    id: 2,
    image: sampleSlide2,
    title: "Team Collaboration",
    narration: "Effective teamwork is essential for success. Let's discuss how modern collaboration tools help teams work together seamlessly."
  }
];

const API_BASE = "http://localhost:7122"; // Match backend port

const Walkthrough = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const initialSlides = (location.state && location.state.slides && Array.isArray(location.state.slides) && location.state.slides.length > 0)
    ? location.state.slides
    : sampleSlides;
  
  // Use state to track slides with their audio status
  const [slides, setSlides] = useState(initialSlides);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isListening, setIsListening] = useState(false);
  const [isNarrating, setIsNarrating] = useState(false);
  const [userQuestion, setUserQuestion] = useState("");
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [narrationText, setNarrationText] = useState("");
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const slide = slides[currentSlide];

  // Background audio generation for next slide  
  const preGenerateNextSlideAudio = async (nextSlideIndex: number) => {
    if (nextSlideIndex >= slides.length) return; // No next slide
    
    const nextSlide = slides[nextSlideIndex];
    
    // Skip if audio already exists or is being generated
    if (nextSlide.preGeneratedAudio || nextSlide.audioStatus === 'generating') {
      console.log(`⚡ Slide ${nextSlideIndex + 1} audio already available or generating`);
      return;
    }
    
    console.log(`🔄 Starting HIGH PRIORITY background generation for slide ${nextSlideIndex + 1}...`);
    
    // Mark as generating
    setSlides(prevSlides => {
      const newSlides = [...prevSlides];
      newSlides[nextSlideIndex] = { ...newSlides[nextSlideIndex], audioStatus: 'generating' };
      return newSlides;
    });
    
    try {
      const response = await fetch(`${API_BASE}/api/pregenerate-audio`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          slide: {
            id: nextSlide.id,
            title: nextSlide.title,
            text: nextSlide.text || nextSlide.narration,
            image: nextSlide.image,
            pageNumber: nextSlideIndex + 1,
            totalPages: slides.length,
            pptName: nextSlide.pptName // Include PPT name for deterministic filenames
          }
        }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log(`✅ Background audio generated for slide ${nextSlideIndex + 1}`);
        
        // Update the slide with pre-generated audio
        setSlides(prevSlides => {
          const newSlides = [...prevSlides];
          newSlides[nextSlideIndex] = {
            ...newSlides[nextSlideIndex],
            preGeneratedAudio: data.audioUrl,
            preGeneratedNarration: data.narration,
            audioStatus: 'ready'
          };
          return newSlides;
        });
      } else {
        console.error(`❌ Failed to pre-generate audio for slide ${nextSlideIndex + 1}`);
        setSlides(prevSlides => {
          const newSlides = [...prevSlides];
          newSlides[nextSlideIndex] = { ...newSlides[nextSlideIndex], audioStatus: 'failed' };
          return newSlides;
        });
      }
    } catch (error) {
      console.error(`❌ Error pre-generating audio for slide ${nextSlideIndex + 1}:`, error);
      setSlides(prevSlides => {
        const newSlides = [...prevSlides];
        newSlides[nextSlideIndex] = { ...newSlides[nextSlideIndex], audioStatus: 'failed' };
        return newSlides;
      });
    }
  };

  useEffect(() => {
    // Auto-start narration when slide loads
    startNarration();
    
    // Pre-generate audio for next slide in background IMMEDIATELY
    const nextSlideIndex = currentSlide + 1;
    if (nextSlideIndex < slides.length) {
      console.log(`🚀 Immediately starting background audio generation for slide ${nextSlideIndex + 1}`);
      // Start immediately, don't wait
      preGenerateNextSlideAudio(nextSlideIndex);
      
      // Also pre-generate the slide after next if we have time (lower priority)
      const afterNextIndex = currentSlide + 2;
      if (afterNextIndex < slides.length) {
        setTimeout(() => {
          console.log(`📋 Low priority: starting background generation for slide ${afterNextIndex + 1}`);
          preGenerateNextSlideAudio(afterNextIndex);
        }, 2000); // Give 2 seconds for the immediate next slide to start
      }
    }
    
    // Cleanup function
    return () => {
      console.log('🧹 Slide changing - stopping any playing audio');
      // Stop audio when changing slides to prevent overlap
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
    };
  }, [currentSlide]);

  const startNarration = async () => {
    // Always stop any existing audio first to prevent overlap
    if (audioRef.current) {
      console.log('🛑 Stopping any existing audio to prevent overlap');
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    
    setIsNarrating(true);
    setAudioUrl(null);
    setNarrationText("");
    
    // Check if this slide has pre-generated audio
    if (slide.preGeneratedAudio && slide.preGeneratedNarration) {
      console.log('⚡ Using pre-generated audio for instant playback');
      setNarrationText(slide.preGeneratedNarration);
      const fullAudioUrl = `${API_BASE}${slide.preGeneratedAudio}`;
      setAudioUrl(fullAudioUrl);
      
      // Audio already stopped at start of function
      
      const audio = new Audio(fullAudioUrl);
      audioRef.current = audio;
      
      // Add comprehensive audio event logging
      audio.addEventListener('loadstart', () => console.log('🎵 Audio load started'));
      audio.addEventListener('loadeddata', () => console.log('🎵 Audio data loaded'));
      audio.addEventListener('loadedmetadata', () => console.log(`🎵 Audio metadata loaded - Duration: ${audio.duration}s`));
      audio.addEventListener('canplay', () => console.log('🎵 Audio can start playing'));
      audio.addEventListener('canplaythrough', () => console.log('🎵 Audio can play through completely'));
      audio.addEventListener('play', () => console.log('▶️ Audio started playing'));
      audio.addEventListener('pause', () => console.log('⏸️ Audio paused'));
      audio.addEventListener('ended', () => console.log('🏁 Audio ended naturally'));
      audio.addEventListener('abort', () => console.log('🚫 Audio aborted'));
      audio.addEventListener('stalled', () => console.log('⏳ Audio stalled'));
      audio.addEventListener('suspend', () => console.log('⏸️ Audio suspended'));
      audio.addEventListener('emptied', () => console.log('🗑️ Audio emptied'));
      audio.addEventListener('timeupdate', () => {
        if (audio.currentTime > 0) {
          console.log(`⏰ Audio progress: ${audio.currentTime.toFixed(1)}s / ${audio.duration?.toFixed(1) || '?'}s`);
        }
      });
      
      audio.onloadeddata = () => {
        console.log('⚡ Pre-generated audio loaded, playing...');
        audio.play().catch(err => {
          console.error('Failed to play pre-generated audio:', err);
          setIsNarrating(false);
        });
      };
      
      audio.onended = () => {
        console.log('⚡ Pre-generated audio finished playing completely');
        setIsNarrating(false);
      };
      
      audio.onerror = (err) => {
        console.error('⚡ Pre-generated audio error:', err);
        setIsNarrating(false);
      };
      
      return; // Exit early, no need to make API call
    }
    
    // Fallback: Generate on-demand (slower)
    try {
      console.log('🐌 No pre-generated audio, requesting on-demand narration for slide:', slide);
      const response = await fetch(`${API_BASE}/api/narrate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          slide: {
            id: slide.id,
            title: slide.title,
            text: slide.text || slide.narration,
            image: slide.image,
            pageNumber: currentSlide + 1,
            totalPages: slides.length,
            pptName: slide.pptName, // Include PPT name for deterministic filenames
            // Pass pre-generated audio info if available
            preGeneratedAudio: slide.preGeneratedAudio,
            preGeneratedNarration: slide.preGeneratedNarration
          }
        }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Narration response:', data);
        setNarrationText(data.narration);
        
        if (data.audioUrl) {
          const fullAudioUrl = `${API_BASE}${data.audioUrl}`;
          setAudioUrl(fullAudioUrl);
          
          // Audio already stopped at start of function
          
          const audio = new Audio(fullAudioUrl);
          audioRef.current = audio;
          
          // Add comprehensive audio event logging for fallback audio too
          audio.addEventListener('loadstart', () => console.log('🎵 Fallback audio load started'));
          audio.addEventListener('loadeddata', () => console.log('🎵 Fallback audio data loaded'));
          audio.addEventListener('loadedmetadata', () => console.log(`🎵 Fallback audio metadata loaded - Duration: ${audio.duration}s`));
          audio.addEventListener('canplay', () => console.log('🎵 Fallback audio can start playing'));
          audio.addEventListener('canplaythrough', () => console.log('🎵 Fallback audio can play through completely'));
          audio.addEventListener('play', () => console.log('▶️ Fallback audio started playing'));
          audio.addEventListener('pause', () => console.log('⏸️ Fallback audio paused'));
          audio.addEventListener('ended', () => console.log('🏁 Fallback audio ended naturally'));
          audio.addEventListener('abort', () => console.log('🚫 Fallback audio aborted'));
          audio.addEventListener('stalled', () => console.log('⏳ Fallback audio stalled'));
          audio.addEventListener('suspend', () => console.log('⏸️ Fallback audio suspended'));
          audio.addEventListener('emptied', () => console.log('🗑️ Fallback audio emptied'));
          audio.addEventListener('timeupdate', () => {
            if (audio.currentTime > 0) {
              console.log(`⏰ Fallback audio progress: ${audio.currentTime.toFixed(1)}s / ${audio.duration?.toFixed(1) || '?'}s`);
            }
          });
          
          audio.onloadeddata = () => {
            console.log('Audio loaded, playing...');
            audio.play().catch(err => {
              console.error('Failed to play audio:', err);
              setIsNarrating(false);
            });
          };
          
          audio.oncanplaythrough = () => {
            console.log('Audio can play through, attempting to play...');
            // Try to play, but if it fails due to autoplay policy, that's ok
            audio.play().catch(err => {
              console.warn('Autoplay blocked by browser policy. User interaction needed:', err);
              // Don't set isNarrating to false here - let user manually play
            });
          };
          
          audio.onended = () => {
            console.log('Audio finished playing completely');
            setIsNarrating(false);
          };
          
          audio.onerror = (err) => {
            console.error('Audio error:', err);
            setIsNarrating(false);
          };
        } else {
          // No audio available, just show text
          setTimeout(() => {
            setIsNarrating(false);
          }, 3000);
        }
      } else {
        console.error('Failed to get narration:', response.statusText);
        setIsNarrating(false);
      }
    } catch (error) {
      console.error('Error requesting narration:', error);
      setIsNarrating(false);
    }
  };

  const toggleListening = () => {
    if (isListening) {
      setIsListening(false);
      // Simulate user asking a question
      setUserQuestion("Can you explain more about wind energy efficiency?");
      setTimeout(() => {
        navigate("/response", { 
          state: { 
            question: userQuestion,
            slideIndex: currentSlide,
            totalSlides: slides.length
          }
        });
      }, 1000);
    } else {
      setIsListening(true);
      setUserQuestion("");
    }
  };

  const nextSlide = () => {
    if (currentSlide < slides.length - 1) {
      setCurrentSlide(currentSlide + 1);
    } else {
      navigate("/complete");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-soft p-4">
      <div className="max-w-4xl mx-auto">
        {/* Progress indicator */}
        <div className="text-center mb-8 animate-fade-in">
          <div className="flex items-center justify-center space-x-2 mb-4">
            <div className="w-8 h-8 bg-success rounded-full flex items-center justify-center text-success-foreground font-semibold text-sm">
              ✓
            </div>
            <div className="w-16 h-1 bg-success rounded-full"></div>
            <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-primary-foreground font-semibold text-sm">
              2
            </div>
            <div className="w-16 h-1 bg-muted rounded-full"></div>
            <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center text-muted-foreground font-semibold text-sm">
              3
            </div>
          </div>
          <p className="text-muted-foreground">Step 2 of 3 - Voice Walkthrough</p>
        </div>

        {/* Slide counter */}
        <div className="text-center mb-6">
          <span className="bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium">
            Slide {currentSlide + 1} of {slides.length}
          </span>
        </div>

        {/* Main slide area */}
        <Card className="mb-8 overflow-hidden shadow-soft">
          <div className="aspect-video relative bg-gradient-card">
            <img 
              src={slide.image && typeof slide.image === 'string' && slide.image.startsWith('/uploads/') ? (API_BASE + slide.image) : slide.image} 
              alt={slide.title}
              className="w-full h-full object-cover"
            />
            {isNarrating && (
              <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                <div className="bg-white/90 rounded-lg p-4 flex items-center space-x-3 max-w-md">
                  <Volume2 className="w-5 h-5 text-primary animate-pulse" />
                  <div className="flex-1">
                    <div className="text-sm font-medium">Narrating...</div>
                    {narrationText && (
                      <div className="text-xs text-muted-foreground mt-1">
                        {narrationText.substring(0, 100)}...
                      </div>
                    )}

                  </div>
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* Controls */}
        <div className="flex flex-col items-center space-y-6">
          {/* Narration control */}
          <Button 
            variant={isNarrating ? "soft" : "secondary"}
            size="lg"
            onClick={startNarration}
            disabled={isNarrating}
          >
            {isNarrating ? (
              <>
                <Pause className="w-5 h-5 mr-2" />
                Narrating...
              </>
            ) : (
              <>
                <Play className="w-5 h-5 mr-2" />
                Replay Narration
              </>
            )}
          </Button>

          {/* Voice interaction */}
          <div className="text-center">
            <Button
              variant="voice"
              size="voice"
              onClick={toggleListening}
              className={isListening ? "animate-pulse-gentle" : ""}
            >
              {isListening ? (
                <MicOff className="w-8 h-8" />
              ) : (
                <Mic className="w-8 h-8" />
              )}
            </Button>
            <p className="text-sm text-muted-foreground mt-3">
              {isListening 
                ? "Listening... Ask your question!" 
                : "Tap to ask a question about this slide"
              }
            </p>
            {userQuestion && (
              <div className="mt-4 p-3 bg-accent/20 rounded-lg">
                <p className="text-sm italic">"{userQuestion}"</p>
              </div>
            )}
          </div>

          {/* Navigation */}
          <div className="flex space-x-4">
            <Button 
              variant="outline" 
              onClick={() => navigate("/upload")}
            >
              ← Back
            </Button>
            <Button 
              variant="secondary" 
              onClick={nextSlide}
              size="lg"
            >
              {currentSlide < slides.length - 1 ? "Next Slide" : "Finish"} →
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Walkthrough;