import express from 'express';
import textToSpeechService from '../services/textToSpeech.js';
import imageAnalysisService from '../services/imageAnalysis.js';
import slideContextService from '../services/slideContext.js';
import aiProvider from '../services/aiProvider.js';
import path from 'path';
import fs from 'fs';

const router = express.Router();

// In-memory storage for presentation contexts (in production, use a database)
const presentationContexts = new Map();

// POST /api/conversation/store - Store slide context for RAG
router.post('/conversation/store', async (req, res) => {
  try {
    const { presentationId, slides } = req.body;
    
    if (!presentationId || !slides || !Array.isArray(slides)) {
      return res.status(400).json({ error: 'presentationId and slides array required' });
    }

    console.log(`📚 Storing context for presentation: ${presentationId}`);
    console.log(`📊 Received ${slides.length} slides for indexing`);

    // Create comprehensive context from all slides with better content extraction
    const processedSlides = slides.map((slide, index) => {
      const slideContent = slide.preGeneratedNarration || slide.text || slide.narration || slide.content || '';
      const slideTitle = slide.title || `Slide ${index + 1}`;
      
      console.log(`📄 Slide ${index + 1}: "${slideTitle}" - Content: ${slideContent.substring(0, 100)}...`);
      
      return {
        slideNumber: index + 1,
        title: slideTitle,
        content: slideContent,
        originalSlide: slide, // Keep original slide data
        totalSlides: slides.length
      };
    });

    // Create rich full-text context
    const fullText = processedSlides.map(slide => {
      const content = slide.content || 'No content available';
      return `=== SLIDE ${slide.slideNumber}: ${slide.title} ===\n${content}\n`;
    }).join('\n');

    const context = {
      presentationId,
      timestamp: Date.now(),
      slides: processedSlides,
      fullText,
      summary: `This presentation contains ${slides.length} slides. Topics covered: ${
        processedSlides.map(slide => slide.title).filter(title => title && !title.includes('Slide ')).join(', ') || 'Various presentation topics'
      }`,
      rawSlides: slides // Keep original slides for reference
    };

    // Store context both in memory and log for debugging
    presentationContexts.set(presentationId, context);
    
    // Also save to file for persistence (optional)
    try {
      const fs = await import('fs');
      const contextFile = path.join(process.cwd(), 'uploads', `context-${presentationId}.json`);
      await fs.promises.writeFile(contextFile, JSON.stringify(context, null, 2));
      console.log(`💾 Context also saved to file: ${contextFile}`);
    } catch (fileError) {
      console.warn('⚠️ Could not save context to file:', fileError.message);
    }
    
    console.log(`✅ Stored context for presentation: ${presentationId}`);
    console.log(`📝 Full text length: ${fullText.length} characters`);
    console.log(`🎯 Summary: ${context.summary}`);

    res.json({ 
      success: true, 
      presentationId,
      slidesStored: slides.length,
      contextLength: fullText.length,
      summary: context.summary,
      message: 'Presentation context stored successfully'
    });

  } catch (error) {
    console.error('❌ Error storing presentation context:', error);
    res.status(500).json({ error: 'Failed to store presentation context' });
  }
});

// POST /api/conversation/ask - RAG-based Q&A
router.post('/conversation/ask', async (req, res) => {
  try {
    const { question, presentationId } = req.body;
    
    if (!question || !presentationId) {
      return res.status(400).json({ error: 'question and presentationId required' });
    }

    // Debug: Log all stored contexts
    console.log('📚 Available presentation contexts:', Array.from(presentationContexts.keys()));
    console.log('🔍 Looking for presentationId:', presentationId);
    
    // Retrieve stored context
    let context = presentationContexts.get(presentationId);
    if (!context) {
      console.log('❌ Context not found. Available contexts:', Array.from(presentationContexts.keys()));
      
      // Try to load from file as backup
      try {
        const fs = await import('fs');
        const contextFile = path.join(process.cwd(), 'uploads', `context-${presentationId}.json`);
        if (await fs.promises.access(contextFile).then(() => true).catch(() => false)) {
          const fileContent = await fs.promises.readFile(contextFile, 'utf-8');
          context = JSON.parse(fileContent);
          presentationContexts.set(presentationId, context);
          console.log('✅ Loaded context from file backup');
        }
      } catch (fileError) {
        console.warn('⚠️ Could not load context from file:', fileError.message);
      }
      
      // If still no context, return error
      if (!context) {
        return res.status(404).json({ 
          error: 'Presentation context not found. Please view the presentation first.',
          availableContexts: Array.from(presentationContexts.keys()),
          requestedId: presentationId
        });
      }
    }

    console.log(`🤖 Processing question: "${question}" for presentation: ${presentationId}`);
    console.log(`📚 Using context with ${context.slides.length} slides, ${context.fullText.length} characters`);

    // Create RAG prompt with full presentation context
    const ragPrompt = `You are an AI assistant helping users understand a presentation. You must answer based ONLY on the provided presentation content.

PRESENTATION SUMMARY:
${context.summary}

COMPLETE SLIDE CONTENT:
${context.fullText}

USER QUESTION: ${question}

CRITICAL INSTRUCTIONS:
1. Answer ONLY using information from the slide content provided above
2. If the question asks about something not in the slides, say "That topic isn't covered in this presentation"
3. If you reference information, mention which slide it comes from (e.g., "As shown in Slide 2...")
4. Be conversational but accurate
5. Keep responses to 2-3 sentences maximum
6. Use natural language suitable for speech

Your answer based on this specific presentation:`;

    // Get AI response with fallback
    console.log('🧠 Sending prompt to AI provider...');
    console.log('📝 Prompt length:', ragPrompt.length);
    
    let aiResponse;
    try {
      aiResponse = await aiProvider.generateText(ragPrompt, {
        maxTokens: 300,
        temperature: 0.7
      });
      console.log('✅ AI response received:', aiResponse.substring(0, 100) + '...');
    } catch (aiError) {
      console.error('❌ Primary AI provider failed:', aiError.message);
      
      // Try fallback to Gemini
      try {
        console.log('🔄 Trying Gemini fallback...');
        aiProvider.setProvider('gemini');
        aiResponse = await aiProvider.generateText(ragPrompt, {
          maxTokens: 300,
          temperature: 0.7
        });
        console.log('✅ Gemini fallback response received');
      } catch (fallbackError) {
        console.error('❌ Fallback AI also failed:', fallbackError.message);
        throw new Error(`All AI providers failed. Primary: ${aiError.message}, Fallback: ${fallbackError.message}`);
      }
    }

    // Generate TTS for the response
    const audioFilename = `conversation-${presentationId}-${Date.now()}`;
    const audioPath = path.join(process.cwd(), 'uploads', 'audio', `${audioFilename}.wav`);
    
    try {
      await textToSpeechService.textToSpeech(aiResponse, audioPath);
      console.log(`🎵 Generated conversation audio: ${audioFilename}.wav`);
    } catch (ttsError) {
      console.error('❌ TTS generation failed for conversation:', ttsError);
      // Continue without audio
    }

    // Find most relevant slide (simple keyword matching)
    let relevantSlide = null;
    const questionLower = question.toLowerCase();
    const slideScores = context.slides.map(slide => {
      const slideText = `${slide.title} ${slide.content} ${slide.preGeneratedNarration}`.toLowerCase();
      const keywords = questionLower.split(' ').filter(word => word.length > 3);
      const score = keywords.reduce((acc, keyword) => {
        return acc + (slideText.includes(keyword) ? 1 : 0);
      }, 0);
      return { slide, score };
    });

    const bestMatch = slideScores.reduce((best, current) => 
      current.score > best.score ? current : best
    );

    if (bestMatch.score > 0) {
      relevantSlide = {
        slideNumber: bestMatch.slide.slideNumber,
        title: bestMatch.slide.title,
        confidence: Math.min(bestMatch.score / 3, 1) // Normalize to 0-1
      };
    }

    res.json({
      response: aiResponse,
      audioUrl: fs.existsSync(audioPath) ? `/uploads/audio/${audioFilename}.wav` : null,
      relevantSlide,
      contextUsed: {
        presentationId,
        totalSlides: context.slides.length,
        timestamp: context.timestamp
      }
    });

  } catch (error) {
    console.error('❌ Error processing conversation:', error);
    res.status(500).json({ 
      error: 'Failed to process question',
      response: "I'm sorry, I encountered an error while processing your question. Please try again."
    });
  }
});

// GET /api/debug-contexts - List all stored contexts
router.get('/debug-contexts', (req, res) => {
  const contexts = Array.from(presentationContexts.entries()).map(([id, context]) => ({
    presentationId: id,
    slidesCount: context.slides?.length || 0,
    timestamp: context.timestamp,
    summary: context.summary,
    textLength: context.fullText?.length || 0
  }));
  
  res.json({
    totalContexts: contexts.length,
    contexts
  });
});

// GET /api/test-ai - Test AI provider
router.get('/test-ai', async (req, res) => {
  try {
    console.log('🧪 Testing AI provider...');
    const testPrompt = "Say hello and tell me you're working correctly in exactly one sentence.";
    
    const response = await aiProvider.generateText(testPrompt, {
      maxTokens: 100,
      temperature: 0.7
    });
    
    res.json({
      success: true,
      provider: aiProvider.currentProvider,
      prompt: testPrompt,
      response: response,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ AI test failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      provider: aiProvider.currentProvider
    });
  }
});

// GET /api/conversation/context/:presentationId - Get stored context
router.get('/conversation/context/:presentationId', async (req, res) => {
  try {
    const { presentationId } = req.params;
    const context = presentationContexts.get(presentationId);
    
    if (!context) {
      return res.status(404).json({ error: 'Presentation context not found' });
    }

    res.json({
      presentationId,
      slidesCount: context.slides.length,
      timestamp: context.timestamp,
      summary: context.summary,
      available: true
    });

  } catch (error) {
    console.error('❌ Error retrieving context:', error);
    res.status(500).json({ error: 'Failed to retrieve context' });
  }
});

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
        // Recursively delete directory contents
        const deleteDirectory = (dirPath) => {
          const files = fs.readdirSync(dirPath);
          for (const file of files) {
            const filePath = path.join(dirPath, file);
            const fileStat = fs.statSync(filePath);
            if (fileStat.isDirectory()) {
              deleteDirectory(filePath);
            } else {
              fs.unlinkSync(filePath);
              deletedCount++;
            }
          }
          fs.rmdirSync(dirPath);
        };

        deleteDirectory(itemPath);
      } else {
        // Delete file
        fs.unlinkSync(itemPath);
        deletedCount++;
      }
    }

    // Clear presentation contexts from memory
    presentationContexts.clear();
    console.log('🧹 Cleared all presentation contexts from memory');

    res.json({ message: 'Cleanup completed successfully', filesDeleted: deletedCount });
  } catch (error) {
    console.error('❌ Cleanup error:', error);
    res.status(500).json({ error: 'Cleanup failed', details: error.message });
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

// POST /api/conversation/index
// Index a presentation for conversational queries
router.post('/conversation/index', async (req, res) => {
  const { presentationId, slides } = req.body;
  
  if (!presentationId || !slides) {
    return res.status(400).json({ error: 'PresentationId and slides are required' });
  }
  
  try {
    console.log(`🧠 Indexing presentation ${presentationId} for conversation...`);
    const indexedSlides = await slideContextService.indexPresentation(presentationId, slides);
    
    const summary = slideContextService.getPresentationSummary(presentationId);
    
    res.json({
      success: true,
      presentationId: presentationId,
      indexedSlides: indexedSlides.length,
      summary: summary,
      message: `Presentation indexed successfully. You can now ask questions about ${indexedSlides.length} slides.`
    });
    
  } catch (error) {
    console.error('❌ Indexing failed:', error.message);
    res.status(500).json({
      error: 'Failed to index presentation',
      message: error.message
    });
  }
});

// GET /api/conversation/summary/:presentationId
// Get presentation summary for conversation context
router.get('/conversation/summary/:presentationId', (req, res) => {
  const { presentationId } = req.params;
  
  const summary = slideContextService.getPresentationSummary(presentationId);
  
  if (!summary) {
    return res.status(404).json({ error: 'Presentation not found or not indexed' });
  }
  
  res.json({
    presentationId: presentationId,
    ...summary,
    availableTopics: summary.topics,
    conversationReady: true
  });
});

// GET /api/ai-providers
// Get available AI providers and current status
router.get('/ai-providers', (req, res) => {
  try {
    const status = aiProvider.getStatus();
    res.json({
      ...status,
      message: `Currently using ${status.currentProvider.toUpperCase()}`
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/ai-providers/switch
// Switch to a different AI provider
router.post('/ai-providers/switch', (req, res) => {
  const { provider } = req.body;
  
  if (!provider) {
    return res.status(400).json({ error: 'Provider name is required' });
  }
  
  try {
    const success = aiProvider.setProvider(provider);
    
    if (success) {
      const status = aiProvider.getStatus();
      res.json({
        success: true,
        ...status,
        message: `Successfully switched to ${provider.toUpperCase()}`
      });
    } else {
      res.status(400).json({
        success: false,
        error: `Provider ${provider} is not available`,
        availableProviders: aiProvider.getAvailableProviders()
      });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router; 