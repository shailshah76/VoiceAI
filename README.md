# VoiceAI - Slide Whisperer

An intelligent presentation assistant that converts PowerPoint slides into interactive voice-guided walkthroughs using advanced AI technologies.

## 🎯 What It Does

VoiceAI transforms static presentations into dynamic, narrated experiences by:

- **Converting PPTX to Interactive Slides**: Automatically processes PowerPoint files into web-viewable content
- **AI-Powered Narration**: Uses Google's Gemini 2.5 Pro to generate professional presenter scripts based on actual slide content
- **Text-to-Speech Integration**: Converts narrations into high-quality audio using multiple TTS engines
- **Interactive Q&A**: Allows users to ask questions about slide content with AI-powered responses
- **Clean Workspace Management**: Automatically manages file cleanup for optimal performance

## 🏗️ Architecture

### Frontend (`slide-whisperer-ai/`)
- **React + TypeScript**: Modern web application with type safety
- **Tailwind CSS**: Beautiful, responsive UI design
- **React Router**: Seamless navigation between pages
- **Component Library**: Custom UI components with shadcn/ui

### Backend (`backend/`)
- **Node.js + Express**: RESTful API server
- **Google Generative AI**: Gemini 2.5 Pro for vision, text generation, and TTS
- **Multiple TTS Engines**: Google Gemini TTS with macOS `say` fallback
- **File Processing**: LibreOffice + Poppler for PPTX → PDF → Image conversion

## 🚀 Quick Start

### Prerequisites

```bash
# Required system dependencies
brew install poppler           # For PDF processing
brew install libreoffice      # For PPTX conversion
node --version                # Node.js 18+ required
```

### 1. Clone & Setup

```bash
git clone https://github.com/shailshah76/VoiceAI.git
cd VoiceAI
```

### 2. Backend Setup

```bash
cd backend
npm install

# Create environment file
cp .env.example .env
# Edit .env with your API keys:
# GEMINI_API_KEY=your_gemini_api_key
# GROQ_API_KEY=your_groq_api_key (optional)
# PORT=7122

# Start backend server
npm run dev
```

### 3. Frontend Setup

```bash
cd ../slide-whisperer-ai
npm install

# Start frontend development server
npm run dev
```

### 4. Access Application

- **Frontend**: http://localhost:8080
- **Backend API**: http://localhost:7122

## 🔑 API Keys Required

### Essential
- **GEMINI_API_KEY**: Get from [Google AI Studio](https://makersuite.google.com/app/apikey)

### Optional (Fallbacks)
- **GROQ_API_KEY**: From [GROQ Console](https://console.groq.com/) - For additional AI capabilities

## 📖 How to Use

### 1. Upload Presentation
- Navigate to the upload page
- Select a PowerPoint (.pptx) file
- Click "Process Files" to convert and analyze

### 2. Experience Walkthrough
- View slides one at a time
- Listen to AI-generated narrations
- Ask questions about slide content
- Navigate with Previous/Next buttons

### 3. Interactive Features
- **Auto-play narration** for each slide
- **Q&A system** for deeper understanding
- **Voice responses** to your questions
- **Clean workspace** when finished

## 🛠️ Technical Features

### AI-Powered Content Analysis
```javascript
// Professional presentation coach persona
"Analyze this slide and generate a 2-4 sentence presenter script..."
// Result: Expert-level narrations that read actual slide content
```

### Robust File Processing Pipeline
```
PPTX → LibreOffice → PDF → Poppler → Individual Images → AI Analysis
```

### Multi-Engine TTS System
1. **macOS `say` command** (Primary) - Reliable native TTS
2. **Audio format conversion** - AIFF to MP3 for browser compatibility
3. **Google Gemini TTS** (Future) - When API becomes stable

### Smart Cleanup System
- Automatic file cleanup on session end
- Directory management and creation
- Error-resilient processing

## 📁 Project Structure

```
VoiceAI/
├── backend/                    # Node.js API server
│   ├── src/
│   │   ├── routes/            # API endpoints
│   │   ├── services/          # Business logic
│   │   │   ├── imageAnalysis.js    # Gemini AI integration
│   │   │   └── textToSpeech.js     # TTS processing
│   │   └── index.js           # Server entry point
│   ├── uploads/               # File storage (auto-created)
│   └── package.json
├── slide-whisperer-ai/        # React frontend
│   ├── src/
│   │   ├── components/        # UI components
│   │   ├── pages/            # Application pages
│   │   │   ├── Upload.tsx         # File upload
│   │   │   ├── Walkthrough.tsx    # Slide viewer
│   │   │   └── Complete.tsx       # Session completion
│   │   └── main.tsx          # App entry point
│   └── package.json
└── README.md                  # This file
```

## 🌟 Key Features

### Smart Presentation Analysis
- **Vision AI**: Reads actual text and visual elements from slides
- **Context Understanding**: Identifies charts, diagrams, and key information
- **Professional Narration**: Generates presenter-quality scripts

### Seamless User Experience
- **One-click processing**: Upload and automatically convert presentations
- **Auto-narration**: Each slide plays professional commentary
- **Interactive Q&A**: Ask questions and get intelligent responses
- **Clean interface**: Modern, responsive design

### Enterprise-Ready
- **Multiple AI providers**: Fallback systems for reliability
- **Error handling**: Graceful degradation and recovery
- **File management**: Automatic cleanup and organization
- **Scalable architecture**: Modular, maintainable codebase

## 🚨 Troubleshooting

### Common Issues

**"pdftoppm not found"**
```bash
brew install poppler
```

**"soffice command not found"**
```bash
brew install libreoffice
```

**"Gemini API error"**
- Verify GEMINI_API_KEY in .env file
- Check API key permissions and billing

**"Audio not playing"**
- Ensure proper file permissions
- Check browser audio settings
- Verify uploads/audio directory exists

### Development Tips

**Backend Logs**
```bash
cd backend
npm run dev  # Watch for console output
```

**Frontend Debug**
```bash
cd slide-whisperer-ai
npm run dev  # Check browser console
```

**File Processing**
- Ensure PPTX files are not corrupted
- Check file permissions in uploads/ directory
- Verify sufficient disk space

## 🤝 Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature-name`
3. Commit changes: `git commit -m 'Add feature'`
4. Push to branch: `git push origin feature-name`
5. Submit a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- **Google Gemini**: Advanced AI vision, language, and TTS capabilities
- **LibreOffice**: Document conversion capabilities
- **Poppler**: PDF processing utilities
- **React & Node.js**: Modern web development frameworks

---

**Built with ❤️ for better presentations and learning experiences** 