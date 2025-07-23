import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Mic, Play, Sparkles, MessageCircle, ArrowRight } from "lucide-react";
import aiMascot from "@/assets/ai-mascot.jpg";

const Index = () => {
  const navigate = useNavigate();

  const handleStartDemo = () => {
    navigate("/upload");
  };

  return (
    <div className="min-h-screen bg-gradient-soft">
      {/* Header */}
      <header className="p-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-primary rounded-lg flex items-center justify-center shadow-soft">
              <Sparkles className="w-6 h-6 text-primary-foreground" />
            </div>
            <h1 className="text-xl font-bold text-foreground">SlideVoice AI</h1>
          </div>
          <Button variant="outline" size="sm">
            About
          </Button>
        </div>
      </header>

      {/* Hero Section */}
      <main className="pt-16 pb-24">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <div className="animate-fade-in">
            <div className="inline-flex items-center space-x-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium mb-6">
              <Sparkles className="w-4 h-4" />
              <span>AI-Powered Voice Assistant</span>
            </div>
            
            <h1 className="text-5xl lg:text-6xl font-bold text-foreground mb-6 leading-tight">
              Let AI walk you through your{" "}
              <span className="bg-gradient-primary bg-clip-text text-transparent">
                slides
              </span>
            </h1>
            
            <p className="text-xl text-muted-foreground mb-8 leading-relaxed max-w-2xl mx-auto">
              Upload your presentation and get AI-powered voice narration. 
              Ask questions in real-time and get instant, intelligent responses.
            </p>
            
            <Button 
              variant="hero" 
              size="xl"
              onClick={handleStartDemo}
            >
              Start Demo
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-12 bg-card">
        <div className="max-w-6xl mx-auto px-6 text-center">
          <div className="flex items-center justify-center space-x-3 mb-4">
            <div className="w-8 h-8 bg-gradient-primary rounded-lg flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="text-lg font-semibold text-foreground">SlideVoice AI</span>
          </div>
          <p className="text-muted-foreground">
            Making presentations more accessible through AI voice technology
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
