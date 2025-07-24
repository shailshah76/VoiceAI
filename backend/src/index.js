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
  
  console.log('🎵 Audio request for:', filename);
  console.log('🔍 Range header:', req.headers.range);
  
  // Check if file exists
  if (!fs.existsSync(audioPath)) {
    console.log('❌ Audio file not found:', audioPath);
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
    };
    
    res.writeHead(206, head);
    file.pipe(res);
  } else {
    // No range request, serve the entire file
    const contentType = filename.endsWith('.wav') ? 'audio/wav' : 'audio/mpeg';
    const head = {
      'Content-Length': fileSize,
      'Content-Type': contentType,
      'Accept-Ranges': 'bytes',
    };
    
    res.writeHead(200, head);
    fs.createReadStream(audioPath).pipe(res);
  }
});

// API routes
app.use('/api/upload', uploadRouter);
app.use('/api/slides', slidesRouter);
app.use('/api', aiRouter);

// TODO: Add API routes for /api/narrate, /api/ask

// Connect to MongoDB Atlas
// The backend should not attempt to connect to MongoDB.
// Only keep Express, CORS, dotenv, and the API routes.

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 