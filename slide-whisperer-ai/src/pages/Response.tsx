import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Volume2, RotateCcw, ArrowRight, MessageCircle } from "lucide-react";
import aiMascot from "@/assets/ai-mascot.jpg";

const Response = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { question, slideIndex, totalSlides } = location.state || {};
  
  const [isNarrating, setIsNarrating] = useState(false);

  const aiResponse = "Great question! Wind energy efficiency has improved dramatically over the past decade. Modern wind turbines can convert about 35-45% of wind energy into electricity, compared to just 20-25% from older models. The key improvements include better blade design, advanced materials, and smart control systems that automatically adjust to wind conditions. This makes wind power one of the most cost-effective renewable energy sources available today.";

  useEffect(() => {
    // Auto-start AI response narration
    startNarration();
  }, []);

  const startNarration = () => {
    setIsNarrating(true);
    // Simulate narration duration
    setTimeout(() => {
      setIsNarrating(false);
    }, 8000);
  };

  const handleNextSlide = () => {
    navigate("/walkthrough");
  };

  const handleRepeat = () => {
    startNarration();
  };

  const handleAskAnother = () => {
    navigate("/walkthrough");
  };

  return (
    <div className="min-h-screen bg-gradient-soft p-4">
      <div className="max-w-3xl mx-auto">
        {/* Progress indicator */}
        <div className="text-center mb-8 animate-fade-in">
          <div className="flex items-center justify-center space-x-2 mb-4">
            <div className="w-8 h-8 bg-success rounded-full flex items-center justify-center text-success-foreground font-semibold text-sm">
              ✓
            </div>
            <div className="w-16 h-1 bg-success rounded-full"></div>
            <div className="w-8 h-8 bg-success rounded-full flex items-center justify-center text-success-foreground font-semibold text-sm">
              ✓
            </div>
            <div className="w-16 h-1 bg-primary rounded-full"></div>
            <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-primary-foreground font-semibold text-sm">
              3
            </div>
          </div>
          <p className="text-muted-foreground">AI Assistant Response</p>
        </div>

        {/* Your question */}
        <Card className="mb-6 p-6 border-l-4 border-l-accent animate-slide-up">
          <div className="flex items-start space-x-3">
            <div className="w-8 h-8 bg-accent rounded-full flex items-center justify-center flex-shrink-0">
              <MessageCircle className="w-4 h-4 text-accent-foreground" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Your question:</p>
              <p className="text-foreground italic">"{question || "Can you explain more about wind energy efficiency?"}"</p>
            </div>
          </div>
        </Card>

        {/* AI Response */}
        <Card className="mb-8 overflow-hidden shadow-soft">
          <div className="p-6">
            <div className="flex items-start space-x-4 mb-4">
              <div className="w-12 h-12 rounded-full overflow-hidden flex-shrink-0">
                <img 
                  src={aiMascot} 
                  alt="AI Assistant"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex-1">
                <div className="flex items-center space-x-2 mb-2">
                  <h3 className="font-semibold text-foreground">AI Assistant</h3>
                  {isNarrating && (
                    <div className="flex items-center space-x-1 text-primary">
                      <Volume2 className="w-4 h-4 animate-pulse" />
                      <span className="text-xs">Speaking...</span>
                    </div>
                  )}
                </div>
                <div className="prose prose-sm max-w-none">
                  <p className="text-foreground leading-relaxed">
                    {aiResponse}
                  </p>
                </div>
              </div>
            </div>
          </div>
          
          {isNarrating && (
            <div className="bg-primary/5 px-6 py-3 border-t">
              <div className="flex items-center justify-center space-x-2">
                <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
                <div className="w-2 h-2 bg-primary rounded-full animate-pulse delay-75"></div>
                <div className="w-2 h-2 bg-primary rounded-full animate-pulse delay-150"></div>
                <span className="text-sm text-primary ml-2">AI is speaking...</span>
              </div>
            </div>
          )}
        </Card>

        {/* Action buttons */}
        <div className="flex flex-col space-y-4 animate-slide-up">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button 
              variant="outline" 
              onClick={handleRepeat}
              className="flex items-center justify-center"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Repeat
            </Button>
            
            <Button 
              variant="secondary" 
              onClick={handleAskAnother}
              className="flex items-center justify-center"
            >
              <MessageCircle className="w-4 h-4 mr-2" />
              Ask Another
            </Button>
            
            <Button 
              variant="hero" 
              onClick={handleNextSlide}
              className="flex items-center justify-center"
            >
              Next Slide
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
          
          {/* Navigation hint */}
          <div className="text-center mt-6">
            <p className="text-sm text-muted-foreground">
              Slide {(slideIndex || 0) + 1} of {totalSlides || 2}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Response;