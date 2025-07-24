import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import uploadRouter from './routes/upload.js';
import slidesRouter from './routes/slides.js';
import aiRouter from './routes/ai.js';
import path from 'path';

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

// Add CORS headers for static files to ensure react-pdf can fetch them
app.use('/uploads', (req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
}, express.static(uploadsPath));

// Also serve audio files specifically
app.use('/uploads/audio', (req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
}, express.static(path.join(uploadsPath, 'audio')));

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