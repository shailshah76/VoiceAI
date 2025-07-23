import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CheckCircle, RefreshCw, Upload, Star } from "lucide-react";
import { useState } from "react";

const Complete = () => {
  const navigate = useNavigate();
  const [rating, setRating] = useState(0);

  const handleStartAgain = () => {
    navigate("/upload");
  };

  const handleNewSlides = () => {
    navigate("/upload");
  };

  const handleHome = () => {
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-gradient-soft p-4">
      <div className="max-w-2xl mx-auto">
        {/* Success animation */}
        <div className="text-center mb-8 animate-fade-in">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-success rounded-full mb-6 shadow-glow animate-pulse-gentle">
            <CheckCircle className="w-10 h-10 text-success-foreground" />
          </div>
          
          <h1 className="text-4xl font-bold text-foreground mb-4">
            All Done! 🎉
          </h1>
          
          <p className="text-lg text-muted-foreground max-w-md mx-auto">
            You've completed your voice-guided slide walkthrough. Great job exploring your content!
          </p>
        </div>

        {/* Summary card */}
        <Card className="mb-8 p-6 shadow-soft animate-slide-up">
          <h3 className="text-lg font-semibold mb-4 text-center">Session Summary</h3>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-primary">2</div>
              <div className="text-sm text-muted-foreground">Slides Reviewed</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-accent">1</div>
              <div className="text-sm text-muted-foreground">Questions Asked</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-success">100%</div>
              <div className="text-sm text-muted-foreground">Completion</div>
            </div>
          </div>
        </Card>

        {/* Rating section */}
        <Card className="mb-8 p-6">
          <h3 className="text-lg font-semibold mb-4 text-center">How was your experience?</h3>
          <div className="flex justify-center space-x-2 mb-4">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                onClick={() => setRating(star)}
                className="transition-all duration-200 hover:scale-110"
              >
                <Star 
                  className={`w-8 h-8 ${
                    star <= rating 
                      ? "fill-warning text-warning" 
                      : "text-muted-foreground"
                  }`}
                />
              </button>
            ))}
          </div>
          {rating > 0 && (
            <p className="text-center text-sm text-muted-foreground animate-fade-in">
              {rating === 5 && "Amazing! Thank you for the perfect rating! ⭐"}
              {rating === 4 && "Great! We're happy you enjoyed it! 😊"}
              {rating === 3 && "Good! Thanks for your feedback! 👍"}
              {rating === 2 && "Thanks for the feedback. We'll improve! 🔧"}
              {rating === 1 && "Sorry it wasn't great. We'll do better! 💪"}
            </p>
          )}
        </Card>

        {/* Action buttons */}
        <div className="flex flex-col space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Button 
              variant="hero" 
              size="xl"
              onClick={handleStartAgain}
              className="flex items-center justify-center"
            >
              <RefreshCw className="w-5 h-5 mr-2" />
              Start Again
            </Button>
            
            <Button 
              variant="secondary" 
              size="xl"
              onClick={handleNewSlides}
              className="flex items-center justify-center"
            >
              <Upload className="w-5 h-5 mr-2" />
              Upload New Slides
            </Button>
          </div>
          
          <div className="text-center">
            <Button 
              variant="ghost" 
              onClick={handleHome}
              className="text-muted-foreground hover:text-foreground"
            >
              ← Back to Home
            </Button>
          </div>
        </div>

        {/* Tips for next time */}
        <Card className="mt-8 p-6 bg-accent/10 border-accent/20">
          <h4 className="font-semibold text-accent-foreground mb-3">💡 Tips for next time:</h4>
          <ul className="text-sm text-muted-foreground space-y-2">
            <li>• Try asking more detailed questions about specific slide content</li>
            <li>• Upload your own presentation slides for a personalized experience</li>
            <li>• Take advantage of the voice narration to learn while multitasking</li>
          </ul>
        </Card>
      </div>
    </div>
  );
};

export default Complete;