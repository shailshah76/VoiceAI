# VoiceAI Backend

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Create a `.env` file in the backend directory with:
   ```env
   GROQ_API_KEY=your_groq_api_key
   HF_TOKEN=your_huggingface_token
   ```
   - `GROQ_API_KEY`: For AI chat/Q&A functionality
   - `HF_TOKEN`: For text-to-speech narration using Hugging Face models

3. Start the server:
   ```bash
   npm run dev
   ```

## API Endpoints

### POST /api/upload
- Upload up to 2 files (images, PDFs, text, PPT/PPTX).
- Returns file references. Files are stored in the `uploads/` directory.

### POST /api/slides/process
- Processes uploaded files to extract slide data.
- For PPTX files: converts to PDF, then extracts each page as an image.
- Returns structured slide data (image, title, text).

### POST /api/narrate
- Returns AI-generated narration for a slide with text-to-speech audio.
- Uses Hugging Face `hexgrad/Kokoro-82M` model for high-quality voice synthesis.

### POST /api/ask
- Returns AI-generated answer to a user question about a slide with audio.

### POST /api/tts
- Convert any text to speech using Hugging Face TTS.
- Returns audio file URL for playback.

---

**Note:** This backend uses the local filesystem (`uploads/` directory) for file storage and Hugging Face Inference API for text-to-speech generation. 