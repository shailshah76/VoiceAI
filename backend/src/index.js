import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import uploadRouter from './routes/upload.js';
import slidesRouter from './routes/slides.js';
import aiRouter from './routes/ai.js';
import path from 'path';
import fs from 'fs';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 7122;

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// TTS service diagnostics
app.get('/api/tts-status', (req, res) => {
  const hasPlayAI = !!process.env.PLAYAI_API_KEY;
  const hasGemini = !!process.env.GEMINI_API_KEY;
  
  res.json({
    services: {
      playai: {
        available: hasPlayAI,
        keyLength: hasPlayAI ? process.env.PLAYAI_API_KEY.length : 0,
        keyStart: hasPlayAI ? process.env.PLAYAI_API_KEY.substring(0, 8) + '...' : 'missing'
      },
      gemini: {
        available: hasGemini,
        keyLength: hasGemini ? process.env.GEMINI_API_KEY.length : 0,
        keyStart: hasGemini ? process.env.GEMINI_API_KEY.substring(0, 8) + '...' : 'missing'
      }
    },
    recommendation: !hasPlayAI ? 'Add PLAYAI_API_KEY to .env file' : 'TTS services configured'
  });
});

// Serve /uploads from the local uploads directory when running from backend/
const uploadsPath = path.join(process.cwd(), 'uploads');
console.log('Serving /uploads from:', uploadsPath);

// Add CORS headers for static files (excluding audio files which have custom handler)
app.use('/uploads', (req, res, next) => {
  // Skip audio files - they have a custom handler
  if (req.path.startsWith('/audio/')) {
    return next('route');
  }
  
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
}, express.static(uploadsPath));

// Custom audio serving with proper range request handling
app.get('/uploads/audio/:filename', (req, res) => {
  const filename = req.params.filename;
  const audioPath = path.join(uploadsPath, 'audio', filename);
  
  // Check if file exists
  if (!fs.existsSync(audioPath)) {
    return res.status(404).send('Audio file not found');
  }
  
  const stat = fs.statSync(audioPath);
  const fileSize = stat.size;
  const range = req.headers.range;
  
  // Set CORS headers
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Range');
  
  if (range) {
    // Handle range requests for audio streaming
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunksize = (end - start) + 1;
    
    const file = fs.createReadStream(audioPath, { start, end });
    const contentType = filename.endsWith('.wav') ? 'audio/wav' : 'audio/mpeg';
    const head = {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunksize,
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=3600',
      'Access-Control-Expose-Headers': 'Content-Range, Content-Length, Content-Type, Accept-Ranges'
    };
    
    console.log(`🎵 Serving audio range: ${filename} (${start}-${end}/${fileSize}) as ${contentType}`);
    res.writeHead(206, head);
    file.pipe(res);
  } else {
    // No range request, serve the entire file
    const contentType = filename.endsWith('.wav') ? 'audio/wav' : 'audio/mpeg';
    const head = {
      'Content-Length': fileSize,
      'Content-Type': contentType,
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      'Access-Control-Expose-Headers': 'Content-Length, Content-Type, Accept-Ranges'
    };
    
    console.log(`🎵 Serving audio file: ${filename} (${fileSize} bytes) as ${contentType}`);
    res.writeHead(200, head);
    fs.createReadStream(audioPath).pipe(res);
  }
});

// API routes
app.use('/api/upload', uploadRouter);
app.use('/api/slides', slidesRouter);
app.use('/api', aiRouter);

// Test endpoint for audio file validation
app.get('/api/test-audio/:filename', (req, res) => {
  const filename = req.params.filename;
  const audioPath = path.join(uploadsPath, 'audio', filename);
  
  if (!fs.existsSync(audioPath)) {
    return res.status(404).json({ error: 'Audio file not found' });
  }
  
  const stats = fs.statSync(audioPath);
  const fileBuffer = fs.readFileSync(audioPath);
  
  // Check if it's a valid WAV file
  const isValidWav = fileBuffer.length >= 44 && 
                     fileBuffer.slice(0, 4).toString() === 'RIFF' &&
                     fileBuffer.slice(8, 12).toString() === 'WAVE';
  
  res.json({
    filename,
    size: stats.size,
    isValidWav,
    mimeType: filename.endsWith('.wav') ? 'audio/wav' : 'audio/mpeg',
    url: `/uploads/audio/${filename}`,
    headers: {
      'RIFF': fileBuffer.slice(0, 4).toString(),
      'WAVE': fileBuffer.slice(8, 12).toString(),
      'fmt': fileBuffer.slice(12, 16).toString()
    }
  });
});

// TODO: Add API routes for /api/narrate, /api/ask

// All data is processed in-memory and saved to local files
// No database required for this application

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 