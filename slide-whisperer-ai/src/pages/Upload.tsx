import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Upload as UploadIcon, FileText, ArrowRight, CheckCircle } from "lucide-react";

const API_BASE = "http://localhost:7122"; // Changed to match backend port

const Upload = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [slides, setSlides] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUseSampleSlides = () => {
    navigate("/walkthrough");
  };

  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      setUploadedFiles(files);
      setError(null);
      setSlides([]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      setUploadedFiles(files);
      setError(null);
      setSlides([]);
    }
  };

  const handleProcessFiles = async () => {
    if (uploadedFiles.length === 0) return;
    setError(null);
    setLoading(true);
    setSlides([]);
    try {
      // 1. Upload files
      const formData = new FormData();
      uploadedFiles.forEach((file) => formData.append("files", file));
      const uploadRes = await fetch(`${API_BASE}/api/upload`, {
        method: "POST",
        body: formData,
      });
      if (!uploadRes.ok) throw new Error("File upload failed");
      const uploadData = await uploadRes.json();
      const filePaths = uploadData.files.map((f: any) => `/uploads/${f.filename}`);

      // 2. Process slides
      const processRes = await fetch(`${API_BASE}/api/slides/process`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ files: filePaths }),
      });
      if (!processRes.ok) throw new Error("Slide processing failed");
      const processData = await processRes.json();
      // Navigate to walkthrough with slides in state
      navigate("/walkthrough", { state: { slides: processData.slides } });
    } catch (err: any) {
      setError(err.message || "An error occurred");
      setSlides([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-soft p-4">
      <div className="max-w-2xl mx-auto">
        {/* Progress indicator */}
        <div className="text-center mb-8 animate-fade-in">
          <div className="flex items-center justify-center space-x-2 mb-4">
            <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-primary-foreground font-semibold text-sm">
              1
            </div>
            <div className="w-16 h-1 bg-muted rounded-full"></div>
            <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center text-muted-foreground font-semibold text-sm">
              2
            </div>
            <div className="w-16 h-1 bg-muted rounded-full"></div>
            <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center text-muted-foreground font-semibold text-sm">
              3
            </div>
          </div>
          <p className="text-muted-foreground">Step 1 of 3</p>
        </div>

        {/* Main content */}
        <div className="text-center mb-8 animate-slide-up">
          <h1 className="text-4xl font-bold text-foreground mb-4">
            Upload Your Slides
          </h1>
          <p className="text-lg text-muted-foreground max-w-md mx-auto">
            Share 1-2 slides and let AI walk you through them with voice narration
          </p>
        </div>

        {/* Upload area */}
        <Card 
          className={`p-8 border-2 border-dashed transition-all duration-300 mb-6 cursor-pointer hover:shadow-soft ${
            isDragOver 
              ? "border-primary bg-primary/5 shadow-glow" 
              : "border-border hover:border-primary/50"
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div className="text-center">
            <UploadIcon className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              Drag & drop your slides here
            </h3>
            <p className="text-muted-foreground mb-4">
              Support for images, PDFs, or text files (Max 2 files)
            </p>
            <Button 
              variant="outline" 
              size="lg"
              onClick={handleFileSelect}
            >
              <FileText className="w-4 h-4 mr-2" />
              Choose Files
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,.pdf,.txt,.ppt,.pptx"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>
        </Card>

        {/* Error message */}
        {error && (
          <div className="mb-4 text-center text-red-500">{error}</div>
        )}
        {/* Loading indicator */}
        {loading && (
          <div className="mb-4 text-center text-blue-500">Processing...</div>
        )}

        {/* Show uploaded files and process button */}
        {uploadedFiles.length > 0 && !loading && (
          <Card className="mb-6 p-4">
            <h3 className="font-semibold mb-3">Uploaded Files:</h3>
            {uploadedFiles.map((file, index) => (
              <div key={index} className="flex items-center space-x-3 p-2 bg-success/10 rounded-lg mb-2">
                <CheckCircle className="w-5 h-5 text-success" />
                <span className="text-sm">{file.name}</span>
                <span className="text-xs text-muted-foreground">
                  ({(file.size / 1024 / 1024).toFixed(2)} MB)
                </span>
              </div>
            ))}
            <div className="mt-4 text-center">
              <Button variant="hero" size="lg" onClick={handleProcessFiles}>
                Process Files <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </Card>
        )}

        {/* Show slides after processing */}

        {/* Sample slides option */}
        {uploadedFiles.length === 0 && !loading && (
          <div className="text-center">
            <p className="text-muted-foreground mb-4">Or try our demo content:</p>
            <Button 
              variant="hero" 
              size="xl" 
              onClick={handleUseSampleSlides}
            >
              Use Sample Slides
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </div>
        )}

        {/* Back button */}
        <div className="mt-12 text-center">
          <Button 
            variant="ghost" 
            onClick={() => navigate("/")}
            className="text-muted-foreground hover:text-foreground"
          >
            ← Back to Home
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Upload;