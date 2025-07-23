import express from 'express';

const router = express.Router();

// POST /api/narrate
// Expects: { slide: { title, text } }
router.post('/narrate', async (req, res) => {
  const { slide } = req.body;
  if (!slide) {
    return res.status(400).json({ error: 'No slide provided' });
  }
  // TODO: Call GROQ API for narration
  const narration = `Narration for slide: ${slide.title || 'Untitled'} - ${slide.text || ''}`;
  res.json({ narration });
});

// POST /api/ask
// Expects: { slide: { title, text }, question }
router.post('/ask', async (req, res) => {
  const { slide, question } = req.body;
  if (!slide || !question) {
    return res.status(400).json({ error: 'Slide and question required' });
  }
  // TODO: Call GROQ API for Q&A
  const answer = `AI answer to: "${question}" about slide "${slide.title || 'Untitled'}"`;
  res.json({ answer });
});

export default router; 