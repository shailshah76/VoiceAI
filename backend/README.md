# VoiceAI Backend

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. (Optional) Create a `.env` file in the backend directory with:
   ```env
   GROQ_API_KEY=your_groq_api_key
   ```
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
- Returns structured slide data (image, title, text).

### POST /api/narrate
- Returns AI-generated narration for a slide.

### POST /api/ask
- Returns AI-generated answer to a user question about a slide.

---

**Note:** This backend does not use a database. All files and metadata are stored on the local filesystem in the `uploads/` directory. 