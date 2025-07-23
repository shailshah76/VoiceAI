import { useState, useEffect } from "react";
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
  const slides = (location.state && location.state.slides && Array.isArray(location.state.slides) && location.state.slides.length > 0)
    ? location.state.slides
    : sampleSlides;
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isListening, setIsListening] = useState(false);
  const [isNarrating, setIsNarrating] = useState(false);
  const [userQuestion, setUserQuestion] = useState("");

  const slide = slides[currentSlide];

  useEffect(() => {
    // Auto-start narration when slide loads
    startNarration();
  }, [currentSlide]);

  const startNarration = () => {
    setIsNarrating(true);
    // Simulate narration duration
    setTimeout(() => {
      setIsNarrating(false);
    }, 3000);
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
                <div className="bg-white/90 rounded-lg p-4 flex items-center space-x-3">
                  <Volume2 className="w-5 h-5 text-primary animate-pulse" />
                  <span className="text-sm font-medium">Narrating...</span>
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