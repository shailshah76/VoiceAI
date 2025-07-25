import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Play, Pause, Volume2, ArrowLeft, ArrowRight, MessageCircle, CheckCircle } from "lucide-react";
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

const API_BASE = "http://localhost:7122";

const Walkthrough = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { slides: locationSlides, initialSlide = 0, returnToQuestions = false, presentationId: locationPresentationId } = location.state || {};
  
  const initialSlides = (locationSlides && Array.isArray(locationSlides) && locationSlides.length > 0)
    ? locationSlides
    : sampleSlides;
  
  const [slides, setSlides] = useState(initialSlides);
  const [currentSlide, setCurrentSlide] = useState(initialSlide);
  const [isNarrating, setIsNarrating] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [narrationText, setNarrationText] = useState("");
  const [presentationId, setPresentationId] = useState(locationPresentationId || "");
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const slide = slides[currentSlide];
  const isLastSlide = currentSlide === slides.length - 1;

  // Extract presentation ID from slides
  useEffect(() => {
    if (slides.length > 0 && !presentationId) {
      // Create consistent presentationId from slide data
      const id = slides[0].pptName || 
                 slides[0].title || 
                 `presentation-${slides.length}-slides`;
      
      console.log('🎯 Setting presentationId:', id);
      setPresentationId(id);
    }
  }, [slides, presentationId]);

  // Background audio generation for next slide  
  const preGenerateNextSlideAudio = async (nextSlideIndex: number) => {
    if (nextSlideIndex >= slides.length) return;
    
    const nextSlide = slides[nextSlideIndex];
    
    if (nextSlide.preGeneratedAudio || nextSlide.audioStatus === 'generating') {
      console.log(`⚡ Slide ${nextSlideIndex + 1} audio already available or generating`);
      return;
    }
    
    console.log(`🔄 Starting background generation for slide ${nextSlideIndex + 1}...`);
    
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
            pptName: nextSlide.pptName
          }
        }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log(`✅ Background audio generated for slide ${nextSlideIndex + 1}`);
        
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

  const navigateToSlide = (slideIndex: number) => {
    if (slideIndex >= 0 && slideIndex < slides.length) {
      setCurrentSlide(slideIndex);
      
      // Pre-generate audio for next slide in background
      if (slideIndex + 1 < slides.length) {
        preGenerateNextSlideAudio(slideIndex + 1);
      }
    }
  };

  const handlePrevSlide = () => {
    if (currentSlide > 0) {
      navigateToSlide(currentSlide - 1);
    }
  };

  const handleNextSlide = () => {
    if (currentSlide < slides.length - 1) {
      navigateToSlide(currentSlide + 1);
    }
  };

  const handleQuestionsClick = () => {
    const finalPresentationId = presentationId || 
                               slides[0]?.pptName || 
                               slides[0]?.title || 
                               `presentation-${slides.length}-slides`;
    
    console.log('🚀 Navigating to questions with presentationId:', finalPresentationId);
    
    navigate("/questions", { 
      state: { 
        slides, 
        presentationId: finalPresentationId
      } 
    });
  };

  const handleComplete = () => {
    navigate("/complete");
  };

  const startNarration = async () => {
    console.log(`🎵 Starting narration for slide ${currentSlide + 1}`);
    setIsNarrating(true);

    // Stop any currently playing audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }

    let audioSource = null;
    let narration = "";

    // Check if audio is pre-generated
    if (slide.preGeneratedAudio) {
      console.log(`⚡ Using pre-generated audio for slide ${currentSlide + 1}`);
      audioSource = `${API_BASE}${slide.preGeneratedAudio}`;
      narration = slide.preGeneratedNarration || slide.text || slide.narration || `Slide ${currentSlide + 1}`;
    } else {
      console.log(`🔄 Generating audio on-demand for slide ${currentSlide + 1}`);
      
      try {
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
              pptName: slide.pptName
            }
          }),
        });

        if (response.ok) {
          const data = await response.json();
          audioSource = `${API_BASE}${data.audioUrl}`;
          narration = data.narration;
          console.log(`✅ Generated audio for slide ${currentSlide + 1}: ${data.audioUrl}`);
        } else {
          console.error(`❌ Failed to generate audio for slide ${currentSlide + 1}`);
          setIsNarrating(false);
          return;
        }
      } catch (error) {
        console.error(`❌ Error generating audio for slide ${currentSlide + 1}:`, error);
        setIsNarrating(false);
        return;
      }
    }

    // Play the audio
    if (audioSource) {
      const audio = new Audio(audioSource);
      audioRef.current = audio;
      setAudioUrl(audioSource);
      setNarrationText(narration);

      audio.onloadeddata = () => {
        console.log(`🎵 Playing audio for slide ${currentSlide + 1}`);
        audio.play().catch(err => {
          console.error('Failed to play audio:', err);
          setIsNarrating(false);
        });
      };

      audio.onended = () => {
        console.log(`✅ Finished narration for slide ${currentSlide + 1}`);
        setIsNarrating(false);
      };

      audio.onerror = (err) => {
        console.error('Audio playback error:', err);
        setIsNarrating(false);
      };
    }
  };

  const stopNarration = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setIsNarrating(false);
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
              {currentSlide + 1}
            </div>
            <div className="w-16 h-1 bg-muted rounded-full"></div>
            <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center text-muted-foreground font-semibold text-sm">
              ?
            </div>
          </div>
          <p className="text-muted-foreground">
            Slide {currentSlide + 1} of {slides.length}
            {isLastSlide && " - Ready for questions!"}
          </p>
        </div>

        {/* Main slide display */}
        <Card className="mb-8 overflow-hidden shadow-soft">
          <div className="relative">
            <img 
              src={slide.image?.startsWith('/') ? `${API_BASE}${slide.image}` : slide.image} 
              alt={slide.title}
              className="w-full h-96 object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
            <div className="absolute bottom-4 left-4 text-white">
              <h2 className="text-2xl font-bold mb-2">{slide.title}</h2>
            </div>
          </div>
          
          {isNarrating && (
            <div className="bg-primary/5 px-6 py-4 border-t">
              <div className="flex items-center justify-center space-x-3">
                <Volume2 className="w-5 h-5 text-primary animate-pulse" />
                <span className="text-primary font-medium">AI is narrating this slide...</span>
              </div>
              {narrationText && (
                <p className="text-center text-sm text-muted-foreground mt-2 italic">
                  "{narrationText.length > 150 ? narrationText.substring(0, 150) + '...' : narrationText}"
                </p>
              )}
            </div>
          )}
        </Card>

        {/* Control buttons */}
        <div className="flex flex-col space-y-6 animate-slide-up">
          {/* Narration controls */}
          <div className="text-center">
            {!isNarrating ? (
              <Button 
                variant="voice" 
                size="voice"
                onClick={startNarration}
                className="shadow-glow hover:shadow-xl"
              >
                <Play className="w-6 h-6" />
              </Button>
            ) : (
              <Button 
                variant="destructive" 
                size="voice"
                onClick={stopNarration}
              >
                <Pause className="w-6 h-6" />
              </Button>
            )}
            <p className="text-sm text-muted-foreground mt-2">
              {!isNarrating ? "Start narration" : "Stop narration"}
            </p>
          </div>

          {/* Navigation and Questions */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button 
              variant="outline" 
              onClick={handlePrevSlide}
              disabled={currentSlide === 0}
              className="flex items-center justify-center"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Previous
            </Button>
            
            {isLastSlide ? (
              <Button 
                variant="hero" 
                onClick={handleQuestionsClick}
                className="flex items-center justify-center"
              >
                <MessageCircle className="w-4 h-4 mr-2" />
                Ask Questions
              </Button>
            ) : (
              <Button 
                variant="secondary" 
                onClick={handleNextSlide}
                className="flex items-center justify-center"
              >
                Next Slide
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            )}
            
            <Button 
              variant="outline" 
              onClick={handleComplete}
              className="flex items-center justify-center"
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              Finish
            </Button>
          </div>

          {/* Back to questions option */}
          {returnToQuestions && (
            <div className="text-center">
              <Button 
                variant="ghost" 
                onClick={handleQuestionsClick}
                className="text-muted-foreground hover:text-foreground"
              >
                ← Back to Questions
              </Button>
            </div>
          )}

          {/* Slide navigation dots */}
          <div className="flex justify-center space-x-2">
            {slides.map((_, index) => (
              <button
                key={index}
                onClick={() => navigateToSlide(index)}
                className={`w-3 h-3 rounded-full transition-all duration-300 ${
                  index === currentSlide 
                    ? 'bg-primary scale-125' 
                    : 'bg-muted hover:bg-muted-foreground/50'
                }`}
                aria-label={`Go to slide ${index + 1}`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Walkthrough; 