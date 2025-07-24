import express from 'express';
import textToSpeechService from '../services/textToSpeech.js';
import imageAnalysisService from '../services/imageAnalysis.js';
import path from 'path';
import fs from 'fs';

const router = express.Router();

// POST /api/cleanup - Delete all files in uploads folder
router.post('/cleanup', async (req, res) => {
  try {
    const uploadsDir = path.join(process.cwd(), 'uploads');
    
    if (!fs.existsSync(uploadsDir)) {
      return res.json({ message: 'Uploads directory does not exist', filesDeleted: 0 });
    }

    // Get all files and subdirectories in uploads
    const items = fs.readdirSync(uploadsDir);
    let deletedCount = 0;

    for (const item of items) {
      const itemPath = path.join(uploadsDir, item);
      const stat = fs.statSync(itemPath);

      if (stat.isDirectory()) {
        // Recursively delete directory and its contents
        fs.rmSync(itemPath, { recursive: true, force: true });
        deletedCount++;
        console.log(`Deleted directory: ${item}`);
      } else if (stat.isFile()) {
        // Delete file
        fs.unlinkSync(itemPath);
        deletedCount++;
        console.log(`Deleted file: ${item}`);
      }
    }

    console.log(`🧹 Cleanup completed: ${deletedCount} items deleted from uploads folder`);
    res.json({ 
      message: 'Cleanup completed successfully', 
      filesDeleted: deletedCount,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Cleanup failed:', error.message);
    res.status(500).json({ 
      error: 'Failed to cleanup uploads folder', 
      details: error.message 
    });
  }
});



// POST /api/narrate
// Expects: { slide: { title, text, image, pageNumber, totalPages } }
router.post('/narrate', async (req, res) => {
  const { slide } = req.body;
  if (!slide) {
    return res.status(400).json({ error: 'No slide provided' });
  }
  
  try {
    // Check if audio was pre-generated during file processing
    if (slide.preGeneratedAudio && slide.preGeneratedNarration) {
      console.log('⚡ Using pre-generated audio for instant response');
      return res.json({
        narration: slide.preGeneratedNarration,
        audioUrl: slide.preGeneratedAudio,
        message: 'Pre-generated narration served instantly'
      });
    }
    
    // Fallback: Generate narration and audio on-demand (slower)
    console.log('🐌 No pre-generated audio found, generating on-demand...');
    let narrationText = '';
    
    // If slide has an image path, analyze it for contextual narration
    if (slide.image && slide.image.startsWith('/uploads/')) {
      const imagePath = path.join(process.cwd(), slide.image);
      console.log('Generating contextual narration for image:', imagePath);
      
      const slideInfo = {
        title: slide.title,
        text: slide.text,
        image: slide.image,  // Include the image path for Gemini vision
        pageNumber: slide.pageNumber,
        totalPages: slide.totalPages
      };
      
      narrationText = await imageAnalysisService.generateSlideNarration(imagePath, slideInfo);
    } else {
      // Fallback to basic narration for non-image slides
      narrationText = slide.text || slide.title || 'This slide contains important presentation content.';
    }
    
    console.log('Generated narration text:', narrationText);
    
    // Generate TTS audio from the narration
    const audioPath = await textToSpeechService.textToSpeechFile(
      narrationText, 
      `narration-${slide.id || 'slide'}-${Date.now()}`
    );
    
    res.json({ 
      narration: narrationText,
      audioUrl: audioPath,
      message: 'Contextual narration generated successfully'
    });
  } catch (error) {
    console.error('Narration generation failed:', error);
    
    // Fallback to basic text narration
    const fallbackNarration = slide.text || slide.title || 'This slide presents important information.';
    
    try {
      const audioPath = await textToSpeechService.textToSpeechFile(
        fallbackNarration, 
        `fallback-${slide.id || 'slide'}-${Date.now()}`
      );
      
      res.json({ 
        narration: fallbackNarration,
        audioUrl: audioPath,
        message: 'Fallback narration generated'
      });
    } catch (audioError) {
      console.error('Audio generation also failed:', audioError);
      res.json({ 
        narration: fallbackNarration,
        audioUrl: null,
        message: 'Text narration only - audio generation failed'
      });
    }
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

// POST /api/pregenerate-audio
// Expects: { slide: { title, text, image, pageNumber, totalPages, pptName } }
router.post('/pregenerate-audio', async (req, res) => {
  const { slide } = req.body;
  if (!slide) {
    return res.status(400).json({ error: 'No slide provided' });
  }
  
  console.log(`🔄 Background pre-generating audio for slide ${slide.pageNumber}...`);
  
  try {
    // Check if audio already exists in memory
    if (slide.preGeneratedAudio) {
      console.log(`⚡ Audio already exists for slide ${slide.pageNumber}`);
      return res.json({
        success: true,
        audioUrl: slide.preGeneratedAudio,
        narration: slide.preGeneratedNarration,
        message: 'Audio already available'
      });
    }
    
    // Create deterministic filename based on PPT name and slide number
    const pptName = slide.pptName || 'unknown';
    const cleanPptName = pptName.replace(/[^a-zA-Z0-9]/g, '_');
    const audioFilename = `slide-${cleanPptName}-${slide.pageNumber}`;
    
    // Check if audio file already exists on disk
    const audioDir = path.join(process.cwd(), 'uploads', 'audio');
    const existingAudioPath = path.join(audioDir, `${audioFilename}.wav`);
    
    if (fs.existsSync(existingAudioPath)) {
      console.log(`⚡ Using existing cached audio for slide ${slide.pageNumber}: ${audioFilename}.wav`);
      const audioUrl = `/uploads/audio/${audioFilename}.wav`;
      
      // Try to read existing narration from cache file
      const narrationCacheFile = path.join(audioDir, `${audioFilename}.txt`);
      let narration = slide.text || `Slide ${slide.pageNumber}`;
      
      if (fs.existsSync(narrationCacheFile)) {
        try {
          narration = fs.readFileSync(narrationCacheFile, 'utf-8');
          console.log(`📄 Using cached narration for slide ${slide.pageNumber}`);
        } catch (err) {
          console.warn(`⚠️ Could not read cached narration: ${err.message}`);
        }
      }
      
      return res.json({
        success: true,
        audioUrl: audioUrl,
        narration: narration,
        message: `Cached audio served for slide ${slide.pageNumber}`
      });
    }
    
    // Generate narration text (only if not cached)
    let narrationText = '';
    if (slide.image && slide.image.startsWith('/uploads/')) {
      const imagePath = path.join(process.cwd(), slide.image);
      console.log(`🧠 Analyzing slide ${slide.pageNumber} image:`, imagePath);
      
      const slideInfo = {
        title: slide.title,
        text: slide.text,
        image: slide.image,
        pageNumber: slide.pageNumber,
        totalPages: slide.totalPages
      };
      
      narrationText = await imageAnalysisService.generateSlideNarration(imagePath, slideInfo);
    } else {
      narrationText = slide.text || slide.title || 'This slide contains important presentation content.';
    }
    
    console.log(`🎤 Generating TTS for slide ${slide.pageNumber} with filename: ${audioFilename}`);
    
    // Generate TTS audio with deterministic filename
    const audioUrl = await textToSpeechService.textToSpeechFile(narrationText, audioFilename);
    
    // Cache the narration text alongside the audio
    const narrationCacheFile = path.join(audioDir, `${audioFilename}.txt`);
    try {
      // Ensure audio directory exists
      if (!fs.existsSync(audioDir)) {
        fs.mkdirSync(audioDir, { recursive: true });
      }
      fs.writeFileSync(narrationCacheFile, narrationText, 'utf-8');
      console.log(`💾 Cached narration text for slide ${slide.pageNumber}`);
    } catch (err) {
      console.warn(`⚠️ Could not cache narration text: ${err.message}`);
    }
    
    console.log(`✅ Background audio generated for slide ${slide.pageNumber}: ${audioUrl}`);
    
    res.json({
      success: true,
      audioUrl: audioUrl,
      narration: narrationText,
      message: `Audio pre-generated for slide ${slide.pageNumber}`
    });
    
  } catch (error) {
    console.error(`❌ Background audio generation failed for slide ${slide.pageNumber}:`, error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      message: `Failed to generate audio for slide ${slide.pageNumber}`
    });
  }
});

export default router; 