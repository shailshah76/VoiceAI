import express from 'express';
import path from 'path';
import fs from 'fs';
import { exec } from 'child_process';
import imageAnalysisService from '../services/imageAnalysis.js';
import textToSpeechService from '../services/textToSpeech.js';
import slideContextService from '../services/slideContext.js';
import { generateFileHash } from '../utils/fileHash.js';

const router = express.Router();

// Pre-generate audio for a slide during processing
async function preGenerateAudio(slideInfo, pptName, pptFilePath) {
  try {
    console.log(`🎵 Pre-generating audio for slide ${slideInfo.pageNumber}...`);
    
    // Generate file hash for cache key
    let fileHash = null;
    try {
      fileHash = await generateFileHash(pptFilePath);
      console.log(`🔑 Generated file hash: ${fileHash.substring(0, 8)}...`);
    } catch (error) {
      console.warn(`⚠️ Could not generate file hash, falling back to filename: ${error.message}`);
      fileHash = pptName.replace(/[^a-zA-Z0-9]/g, '_'); // Fallback to filename if hashing fails
    }
    
    // Create deterministic filename based on file hash and slide number
    const audioFilename = `slide-${fileHash.substring(0, 12)}-${slideInfo.pageNumber}`;
    
    // Check if audio file already exists
    const audioDir = path.join(process.cwd(), 'uploads', 'audio');
    const existingAudioPath = path.join(audioDir, `${audioFilename}.wav`);
    
    if (fs.existsSync(existingAudioPath)) {
      console.log(`⚡ Using existing audio for slide ${slideInfo.pageNumber}: ${audioFilename}.wav`);
      const audioUrl = `/uploads/audio/${audioFilename}.wav`;
      
      // Try to read existing narration from cache file
      const narrationCacheFile = path.join(audioDir, `${audioFilename}.txt`);
      let narration = slideInfo.text || `Slide ${slideInfo.pageNumber}`;
      
      if (fs.existsSync(narrationCacheFile)) {
        try {
          narration = fs.readFileSync(narrationCacheFile, 'utf-8');
          console.log(`📄 Using cached narration for slide ${slideInfo.pageNumber}`);
        } catch (err) {
          console.warn(`⚠️ Could not read cached narration: ${err.message}`);
        }
      }
      
      slideInfo.preGeneratedAudio = audioUrl;
      slideInfo.preGeneratedNarration = narration;
      return slideInfo;
    }
    
    // Generate narration text using image analysis
    const imagePath = path.join(process.cwd(), slideInfo.image);
    const narration = await imageAnalysisService.generateSlideNarration(imagePath, slideInfo);
    
    // Generate audio file with deterministic filename and fileHash for caching
    const audioUrl = await textToSpeechService.textToSpeechFile(narration, audioFilename, fileHash);
    
    // Cache the narration text alongside the audio
    const narrationCacheFile = path.join(audioDir, `${audioFilename}.txt`);
    try {
      fs.writeFileSync(narrationCacheFile, narration, 'utf-8');
      console.log(`💾 Cached narration text for slide ${slideInfo.pageNumber}`);
    } catch (err) {
      console.warn(`⚠️ Could not cache narration text: ${err.message}`);
    }
    
    console.log(`✅ Pre-generated audio for slide ${slideInfo.pageNumber}: ${audioUrl}`);
    
    // Store the audio URL in the slide info
    slideInfo.preGeneratedAudio = audioUrl;
    slideInfo.preGeneratedNarration = narration;
    
    return slideInfo;
  } catch (error) {
    console.error(`❌ Failed to pre-generate audio for slide ${slideInfo.pageNumber}:`, error.message);
    // Don't fail the whole process if audio generation fails
    return slideInfo;
  }
}

// Helper to convert PPTX to PDF using LibreOffice
function convertPPTXtoPDF(pptxPath) {
  return new Promise((resolve, reject) => {
    const absPptxPath = path.resolve(pptxPath);
    const pptxDir = path.dirname(absPptxPath);
    const cmd = `soffice --headless --convert-to pdf --outdir "${pptxDir}" "${absPptxPath}"`;
    console.log('Running command:', cmd);
    exec(cmd, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(stderr || stdout || error.message));
      } else {
        const pptxBase = path.basename(absPptxPath, path.extname(absPptxPath));
        const files = fs.readdirSync(pptxDir);
        const pdfFile = files.find(f => f.startsWith(pptxBase) && f.endsWith('.pdf'));
        if (pdfFile) {
          resolve(path.join(pptxDir, pdfFile));
        } else {
          reject(new Error('PDF not created.'));
        }
      }
    });
  });
}

// Helper to convert PDF pages to images using pdftoppm directly
function convertPDFToImages(pdfPath) {
  return new Promise((resolve, reject) => {
    const outputDir = path.dirname(pdfPath);
    const pdfBaseName = path.basename(pdfPath, '.pdf');
    
    console.log('Converting PDF to images:', pdfPath);
    console.log('Output directory:', outputDir);
    
    // Use pdftoppm directly - more reliable than pdf-poppler
    const cmd = `pdftoppm -jpeg -r 150 "${pdfPath}" "${outputDir}/${pdfBaseName}-page"`;
    console.log('Running pdftoppm command:', cmd);
    
    exec(cmd, { timeout: 30000 }, (error, stdout, stderr) => {
      if (error) {
        console.error('pdftoppm error:', error);
        // Fallback: return the original PDF as a single slide
        resolve([{
          pageNumber: 1,
          imagePath: `/uploads/${path.basename(pdfPath)}`
        }]);
        return;
      }
      
      console.log('pdftoppm completed successfully');
      
      // Find generated image files
      try {
        const files = fs.readdirSync(outputDir);
        const imageFiles = files.filter(f => f.startsWith(`${pdfBaseName}-page`) && f.endsWith('.jpg'));
        
        if (imageFiles.length === 0) {
          console.log('No image files generated, using PDF fallback');
          resolve([{
            pageNumber: 1,
            imagePath: `/uploads/${path.basename(pdfPath)}`
          }]);
          return;
        }
        
        // Sort by page number
        imageFiles.sort((a, b) => {
          const aNum = parseInt(a.match(/-(\d+)\.jpg$/)?.[1] || '1');
          const bNum = parseInt(b.match(/-(\d+)\.jpg$/)?.[1] || '1');
          return aNum - bNum;
        });
        
        console.log('Generated image files:', imageFiles);
        
        const pages = imageFiles.map((file, index) => ({
          pageNumber: index + 1,
          imagePath: `/uploads/${file}`
        }));
        
        resolve(pages);
      } catch (err) {
        console.error('Error reading generated files:', err);
        resolve([{
          pageNumber: 1,
          imagePath: `/uploads/${path.basename(pdfPath)}`
        }]);
      }
    });
  });
}

// POST /api/slides/process
// Expects: { files: ["/uploads/filename1", ...] }
router.post('/process', async (req, res) => {
  const { files } = req.body;
  if (!files || !Array.isArray(files) || files.length === 0) {
    return res.status(400).json({ error: 'No files provided' });
  }

  let slides = [];
  try {
    for (const file of files) {
      const absPath = path.join(process.cwd(), file);
      if (file.endsWith('.pptx') || file.endsWith('.ppt')) {
        // Extract PPT name for deterministic audio filenames
        const pptName = path.basename(file, path.extname(file));
        console.log(`📄 Processing PPT: ${pptName}`);
        
        // Convert PPTX to PDF
        const pdfPath = await convertPPTXtoPDF(absPath);
        // Convert PDF pages to images
        const pageImages = await convertPDFToImages(pdfPath);
        
        // Create slides and only pre-generate audio for the FIRST slide
        for (let index = 0; index < pageImages.length; index++) {
          const page = pageImages[index];
          const slideInfo = {
            id: slides.length + 1,
            image: page.imagePath,
            title: `Slide ${index + 1}`,
            text: `Page ${page.pageNumber} of presentation`,
            pageNumber: page.pageNumber,
            totalPages: pageImages.length,
            pptName: pptName // Store PPT name for audio generation
          };
          
          // Only pre-generate audio for the first slide during upload
          if (index === 0) {
            console.log('🎵 Pre-generating audio for FIRST slide only...');
            const slideWithAudio = await preGenerateAudio(slideInfo, pptName, absPath);
            slides.push(slideWithAudio);
          } else {
            // Add slides without audio - will be generated on-demand
            console.log(`⏳ Slide ${index + 1} queued for lazy audio generation`);
            slideInfo.audioStatus = 'pending'; // Mark as pending generation
            slides.push(slideInfo);
          }
        }
      } else {
        // For other files, just show as image/text
        slides.push({
          id: slides.length + 1,
          image: file,
          title: `Slide ${slides.length + 1}`,
          text: `Extracted text for slide ${slides.length + 1}`
        });
      }
    }
    // Auto-index the presentation for conversational queries
    const presentationId = files[0].split('/').pop().split('-')[0] || 'presentation'; // Extract from filename
    try {
      console.log('🧠 Auto-indexing presentation for conversation...');
      await slideContextService.indexPresentation(presentationId, slides);
    } catch (indexError) {
      console.warn('⚠️ Could not index presentation for conversation:', indexError.message);
      // Don't fail the request if indexing fails
    }

    res.json({ 
      slides,
      presentationId: presentationId,
      conversationReady: true 
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router; 