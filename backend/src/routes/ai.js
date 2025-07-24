import express from 'express';
import textToSpeechService from '../services/textToSpeech.js';

const router = express.Router();

// POST /api/narrate
// Expects: { slide: { title, text } }
router.post('/narrate', async (req, res) => {
  const { slide } = req.body;
  if (!slide) {
    return res.status(400).json({ error: 'No slide provided' });
  }
  
  try {
    // Generate narration using Hugging Face TTS
    const audioPath = await textToSpeechService.generateSlideNarration(slide);
    res.json({ 
      narration: slide.text || slide.title || 'Slide content',
      audioUrl: audioPath,
      message: 'Narration generated successfully'
    });
  } catch (error) {
    console.error('Narration generation failed:', error);
    // Fallback to text-only response
    const narration = `${slide.title || 'Slide content'} - ${slide.text || ''}`;
    res.json({ 
      narration,
      audioUrl: null,
      message: 'Audio generation failed, text narration provided'
    });
  }
});

// POST /api/ask
// Expects: { slide: { title, text }, question }
router.post('/ask', async (req, res) => {
  const { slide, question } = req.body;
  if (!slide || !question) {
    return res.status(400).json({ error: 'Slide and question required' });
  }
  
  try {
    // TODO: Integrate with GROQ API for intelligent Q&A
    const answer = `AI answer to: "${question}" about slide "${slide.title || 'Untitled'}"`;
    
    // Generate TTS for the answer
    const audioPath = await textToSpeechService.textToSpeechFile(
      answer, 
      `answer-${Date.now()}`
    );
    
    res.json({ 
      answer,
      audioUrl: audioPath,
      message: 'Answer generated with audio'
    });
  } catch (error) {
    console.error('Answer generation failed:', error);
    // Fallback to text-only response
    const answer = `AI answer to: "${question}" about slide "${slide.title || 'Untitled'}"`;
    res.json({ 
      answer,
      audioUrl: null,
      message: 'Audio generation failed, text answer provided'
    });
  }
});

// POST /api/tts
// Expects: { text }
router.post('/tts', async (req, res) => {
  const { text } = req.body;
  if (!text) {
    return res.status(400).json({ error: 'Text is required' });
  }
  
  try {
    const audioPath = await textToSpeechService.textToSpeechFile(
      text, 
      `tts-${Date.now()}`
    );
    res.json({ 
      audioUrl: audioPath,
      message: 'Text-to-speech conversion successful'
    });
  } catch (error) {
    console.error('TTS conversion failed:', error);
    res.status(500).json({ 
      error: 'Text-to-speech conversion failed',
      details: error.message
    });
  }
});

export default router; 