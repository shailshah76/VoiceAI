import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CheckCircle, RefreshCw, Upload, Star } from "lucide-react";
import { useState } from "react";

const Complete = () => {
  const navigate = useNavigate();
  const [rating, setRating] = useState(0);
  const [isCleaningUp, setIsCleaningUp] = useState(false);
  const [cleanupMessage, setCleanupMessage] = useState("");

  const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:7122';

  const handleStartAgain = async () => {
    setIsCleaningUp(true);
    setCleanupMessage("");

    try {
      console.log('🧹 Starting cleanup before starting again...');
      const response = await fetch(`${API_BASE}/api/cleanup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Cleanup failed: ${response.status}`);
      }

      const result = await response.json();
      console.log('🧹 Cleanup result:', result);
      
      setCleanupMessage(`✅ Cleanup completed! ${result.filesDeleted} files deleted.`);
      
      // Navigate to upload after a short delay
      setTimeout(() => {
        navigate("/upload");
      }, 1500);

    } catch (error) {
      console.error('❌ Cleanup failed:', error);
      setCleanupMessage(`❌ Cleanup failed: ${error.message}`);
      // Still navigate to upload even if cleanup fails
      setTimeout(() => {
        navigate("/upload");
      }, 2000);
    } finally {
      setIsCleaningUp(false);
    }
  };

  const handleNewSlides = async () => {
    setIsCleaningUp(true);
    setCleanupMessage("");

    try {
      console.log('🧹 Starting cleanup before uploading new slides...');
      const response = await fetch(`${API_BASE}/api/cleanup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Cleanup failed: ${response.status}`);
      }

      const result = await response.json();
      console.log('🧹 Cleanup result:', result);
      
      setCleanupMessage(`✅ Cleanup completed! ${result.filesDeleted} files deleted.`);
      
      // Navigate to upload after a short delay
      setTimeout(() => {
        navigate("/upload");
      }, 1500);

    } catch (error) {
      console.error('❌ Cleanup failed:', error);
      setCleanupMessage(`❌ Cleanup failed: ${error.message}`);
      // Still navigate to upload even if cleanup fails
      setTimeout(() => {
        navigate("/upload");
      }, 2000);
    } finally {
      setIsCleaningUp(false);
    }
  };

  const handleHome = async () => {
    setIsCleaningUp(true);
    setCleanupMessage("");

    try {
      console.log('🧹 Starting cleanup before going home...');
      const response = await fetch(`${API_BASE}/api/cleanup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Cleanup failed: ${response.status}`);
      }

      const result = await response.json();
      console.log('🧹 Cleanup result:', result);
      
      setCleanupMessage(`✅ Cleanup completed! ${result.filesDeleted} files deleted.`);
      
      // Navigate to home after a short delay
      setTimeout(() => {
        navigate("/");
      }, 1500);

    } catch (error) {
      console.error('❌ Cleanup failed:', error);
      setCleanupMessage(`❌ Cleanup failed: ${error.message}`);
      // Still navigate home even if cleanup fails
      setTimeout(() => {
        navigate("/");
      }, 2000);
    } finally {
      setIsCleaningUp(false);
    }
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

        {/* Cleanup message */}
        {cleanupMessage && (
          <Card className="mb-6 p-4 text-center">
            <p className={`font-medium ${cleanupMessage.includes('✅') ? 'text-success' : 'text-destructive'}`}>
              {cleanupMessage}
            </p>
          </Card>
        )}

        {/* Action buttons */}
        <div className="flex flex-col space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Button 
              variant="hero" 
              size="xl"
              onClick={handleStartAgain}
              className="flex items-center justify-center"
              disabled={isCleaningUp}
            >
              {isCleaningUp ? (
                <>
                  <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
                  Cleaning...
                </>
              ) : (
                <>
                  <RefreshCw className="w-5 h-5 mr-2" />
                  Start Again
                </>
              )}
            </Button>
            
            <Button 
              variant="secondary" 
              size="xl"
              onClick={handleNewSlides}
              className="flex items-center justify-center"
              disabled={isCleaningUp}
            >
              {isCleaningUp ? (
                <>
                  <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
                  Cleaning...
                </>
              ) : (
                <>
                  <Upload className="w-5 h-5 mr-2" />
                  Upload New Slides
                </>
              )}
            </Button>
          </div>
          
          <div className="text-center">
            <Button 
              variant="ghost" 
              onClick={handleHome}
              className="text-muted-foreground hover:text-foreground"
              disabled={isCleaningUp}
            >
              {isCleaningUp ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Cleaning up & going home...
                </>
              ) : (
                "← Back to Home"
              )}
            </Button>
          </div>
        </div>


      </div>
    </div>
  );
};

export default Complete;