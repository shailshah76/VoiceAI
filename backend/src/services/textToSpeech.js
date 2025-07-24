import fs from 'fs';
import path from 'path';
import { GoogleGenAI } from '@google/genai';
import wav from 'wav';
import dotenv from 'dotenv';

// Ensure environment variables are loaded
dotenv.config();

class TextToSpeechService {
  constructor() {
    this.outputDir = path.join(process.cwd(), 'uploads', 'audio');
    this.geminiApiKey = process.env.GEMINI_API_KEY;
    this.cache = new Map(); // Simple in-memory cache for speed
    
    // Initialize Google GenAI client for TTS
    if (this.geminiApiKey) {
      this.genAI = new GoogleGenAI({
        apiKey: this.geminiApiKey
      });
    }
    
    // Ensure audio directory exists
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
    
    console.log('TextToSpeechService initialized with Google TTS and caching');
  }

  /**
   * Save WAV file from PCM data using Google TTS format
   */
  async saveWaveFile(filename, audioData, channels = 1, rate = 24000, sampleWidth = 2) {
    return new Promise((resolve, reject) => {
      console.log(`📁 Creating WAV file: ${filename} (${audioData.length} bytes input)`);
      
      const writer = new wav.FileWriter(filename, {
        channels,
        sampleRate: rate,
        bitDepth: sampleWidth * 8,
      });

      writer.on('finish', () => {
        console.log(`🎵 WAV file creation finished: ${filename}`);
        resolve();
      });
      
      writer.on('error', (err) => {
        console.error(`❌ WAV writer error for ${filename}:`, err);
        reject(err);
      });

      // Google TTS returns audio data that may need different handling
      // Try writing the raw audio data directly
      try {
        writer.write(audioData);
        writer.end();
      } catch (err) {
        console.error(`❌ Error writing audio data to WAV:`, err);
        reject(err);
      }
    });
  }

  /**
   * Convert text to speech using Google TTS or fallback to local TTS
   * @param {string} text - The text to convert to speech
   * @param {string} outputPath - Output path to save the audio file
   * @returns {Promise<Buffer>} - Audio data as buffer
   */
  async textToSpeech(text, outputPath = null) {
    if (!text || typeof text !== 'string') {
      throw new Error('Text input is required and must be a string');
    }

    console.log('Converting text to speech:', text.substring(0, 50) + '...');

    // Ensure audio directory exists before saving
    if (!fs.existsSync(this.outputDir)) {
      console.log('Creating audio directory:', this.outputDir);
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
    
    // Also ensure the output directory for the specific file exists
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      console.log('Creating output directory:', outputDir);
      fs.mkdirSync(outputDir, { recursive: true });
    }

    if (!outputPath) {
      outputPath = path.join(this.outputDir, `tts-${Date.now()}.mp3`);
    }

    // Use Google TTS
    if (!this.genAI) {
      throw new Error('Google TTS not available - missing GEMINI_API_KEY');
    }

    return await this.textToSpeechGoogle(text, outputPath);
  }

  /**
   * Generate TTS using Google Gemini TTS
   */
  async textToSpeechGoogle(text, outputPath) {
    try {
      // Log full text for debugging
      console.log(`🎤 TTS Input text (${text.length} chars):`, text);
      
      // Don't truncate text - use full narration for complete audio
      const fullText = text.trim();
      
      // Check cache first for speed
      const cacheKey = fullText;
      if (this.cache.has(cacheKey)) {
        const cachedBuffer = this.cache.get(cacheKey);
        const wavPath = outputPath.replace('.mp3', '.wav');
        // Save cached audio to new file
        this.saveWaveFile(wavPath, cachedBuffer).catch(err => 
          console.error('Cached WAV save error:', err.message)
        );
        return cachedBuffer;
      }
      
      // Generate full audio with complete text
      console.log(`🎵 Generating TTS for full text: "${fullText.substring(0, 100)}${fullText.length > 100 ? '...' : ''}"`);
      const response = await this.genAI.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: fullText }] }], // Use full text
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Zephyr' }, // Faster voice option
            },
          },
        },
      });

      const data = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      
      if (!data) {
        throw new Error('No audio data received from Google TTS');
      }

      const audioBuffer = Buffer.from(data, 'base64');
      console.log(`🎵 Generated audio buffer: ${audioBuffer.length} bytes`);
      
      // Cache the result for future use (limit cache size to 50 items)
      if (this.cache.size >= 50) {
        const firstKey = this.cache.keys().next().value;
        this.cache.delete(firstKey);
      }
      this.cache.set(cacheKey, audioBuffer);
      
      // Save as WAV file and wait for completion to ensure it's properly saved
      const wavPath = outputPath.replace('.mp3', '.wav');
      console.log(`💾 Saving audio to: ${wavPath}`);
      
      try {
        // First, save the raw audio data as a backup
        const rawPath = wavPath.replace('.wav', '.raw');
        fs.writeFileSync(rawPath, audioBuffer);
        console.log(`💾 Raw audio saved: ${rawPath} (${audioBuffer.length} bytes)`);
        
        // Try to save as WAV
        await this.saveWaveFile(wavPath, audioBuffer);
        console.log(`✅ Audio saved successfully: ${wavPath}`);
        
        // Verify file size
        const stats = fs.statSync(wavPath);
        console.log(`📊 Saved audio file size: ${stats.size} bytes`);
        
        // If WAV is significantly smaller than raw, there might be an issue
        if (stats.size < audioBuffer.length * 0.5) {
          console.warn(`⚠️ WAV file seems smaller than expected. Raw: ${audioBuffer.length}, WAV: ${stats.size}`);
        }
        
      } catch (err) {
        console.error('❌ WAV save error:', err.message);
        
        // Fallback: save raw audio data directly
        try {
          const fallbackPath = wavPath.replace('.wav', '.audio');
          fs.writeFileSync(fallbackPath, audioBuffer);
          console.log(`🔄 Fallback: saved raw audio as ${fallbackPath}`);
        } catch (fallbackErr) {
          console.error('❌ Fallback save also failed:', fallbackErr.message);
        }
        
        throw new Error(`Failed to save audio file: ${err.message}`);
      }
      
      // Return immediately without waiting for file save
      return audioBuffer;

    } catch (error) {
      throw new Error(`Google TTS failed: ${error.message}`);
    }
  }



  /**
   * Convert text to speech and save as audio file
   * @param {string} text - The text to convert
   * @param {string} filename - Output filename (without extension)
   * @returns {Promise<string>} - Path to the saved audio file
   */
  async textToSpeechFile(text, filename) {
    const audioPath = path.join(this.outputDir, `${filename}.mp3`);
    
    await this.textToSpeech(text, audioPath);
    
    // Return the WAV URL path (browsers can play WAV directly)
    return `/uploads/audio/${filename}.wav`;
  }

  /**
   * Generate narration for a slide
   * @param {Object} slide - Slide object with title and text
   * @returns {Promise<string>} - Path to the audio file
   */
  async generateSlideNarration(slide) {
    if (!slide) {
      throw new Error('Slide object is required');
    }

    // Create narration text from slide content
    let narrationText = '';
    
    if (slide.title) {
      narrationText += `${slide.title}. `;
    }
    
    if (slide.text) {
      narrationText += slide.text;
    }
    
    if (!narrationText.trim()) {
      narrationText = 'This slide contains visual content.';
    }

    // Generate unique filename based on slide ID and timestamp
    const filename = `narration-${slide.id || 'slide'}-${Date.now()}`;
    
    console.log('Generating narration for slide:', slide.id || 'unknown');
    console.log('Narration text:', narrationText);
    
    return await this.textToSpeechFile(narrationText, filename);
  }

  /**
   * Check if TTS is available on the system
   * @returns {Promise<boolean>}
   */
  async checkTTSAvailability() {
    return new Promise((resolve) => {
      exec('which say', (error) => {
        resolve(!error);
      });
    });
  }
}

// Export singleton instance
const textToSpeechService = new TextToSpeechService();
export default textToSpeechService; 