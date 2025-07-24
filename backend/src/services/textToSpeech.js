import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import { exec } from 'child_process';
import { GoogleGenAI } from '@google/genai';
import wav from 'wav';
import dotenv from 'dotenv';

// Ensure environment variables are loaded
dotenv.config();

class TextToSpeechService {
  constructor() {
    this.outputDir = path.join(process.cwd(), 'uploads', 'audio');
    this.geminiApiKey = process.env.GEMINI_API_KEY;
    

    
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
    
    console.log('TextToSpeechService initialized:');
    console.log('- Primary TTS engine: macOS say');
    console.log('- Google TTS available for future use:', !!this.genAI);
  }

  /**
   * Save WAV file from PCM data using Google TTS format
   */
  async saveWaveFile(filename, pcmData, channels = 1, rate = 24000, sampleWidth = 2) {
    return new Promise((resolve, reject) => {
      const writer = new wav.FileWriter(filename, {
        channels,
        sampleRate: rate,
        bitDepth: sampleWidth * 8,
      });

      writer.on('finish', resolve);
      writer.on('error', reject);

      writer.write(pcmData);
      writer.end();
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

    // Try Google TTS first
    if (this.genAI) {
      try {
        console.log('🔊 Using Google Gemini TTS:', text.substring(0, 50) + '...');
        console.log('🎤 Voice: Kore (Google AI voice)');
        return await this.textToSpeechGoogle(text, outputPath);
      } catch (error) {
        console.warn('❌ Google TTS failed, falling back to macOS say:', error.message);
        console.error('❌ Full Google TTS error:', error);
      }
    } else {
      console.log('⚠️ Google TTS client not available, using macOS say');
    }

    // Use macOS say as fallback
    console.log('🔊 Using macOS say TTS fallback:', text.substring(0, 50) + '...');
    console.log('🎤 Voice: Samantha (macOS native voice)');
    return await this.textToSpeechSay(text, outputPath);
  }

  /**
   * Generate TTS using Google Gemini TTS
   */
  async textToSpeechGoogle(text, outputPath) {
    console.log('🤖 Starting Google Gemini TTS generation...');
    console.log('📝 Text length:', text.length, 'characters');
    console.log('💾 Output path:', outputPath);

    try {
      // Using the exact structure from your sample code
      const response = await this.genAI.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: `Say cheerfully: ${text}` }] }],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Kore' },
            },
          },
        },
      });

      const data = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      
      if (!data) {
        throw new Error('No audio data received from Google TTS');
      }

      const audioBuffer = Buffer.from(data, 'base64');
      
      // Save as WAV file (browsers can play WAV directly)
      const wavPath = outputPath.replace('.mp3', '.wav');
      await this.saveWaveFile(wavPath, audioBuffer);
      
      console.log('✅ Google TTS conversion successful, audio size:', audioBuffer.length, 'bytes');
      console.log('✅ WAV audio file saved:', wavPath);
      return audioBuffer;

    } catch (error) {
      console.error('Google TTS error:', error.message);
      throw new Error(`Google TTS failed: ${error.message}`);
    }
  }

  /**
   * Use macOS say command to generate MP3 directly
   */
  async textToSpeechSay(text, outputPath) {
    console.log('Using macOS say command to generate audio...');
    
    // Always use AIFF format first (most reliable) then convert to MP3
    return this.textToSpeechSayWithConvert(text, outputPath);
  }

  /**
   * Fallback: Generate AIFF then convert to MP3 using afconvert
   */
  async textToSpeechSayWithConvert(text, outputPath) {
    console.log('Using AIFF to MP3 conversion fallback...');
    
    return new Promise((resolve, reject) => {
      const aiffPath = outputPath.replace('.mp3', '.aiff');
      
      // Step 1: Generate AIFF with a more natural voice
      const sayCmd = `say -v "Samantha" -o "${aiffPath}" "${text.replace(/"/g, '\\"')}"`;
      console.log('Executing say command for AIFF with Samantha voice:', sayCmd);
      
      exec(sayCmd, (error, stdout, stderr) => {
        if (error) {
          console.error('Say AIFF generation failed:', error.message);
          reject(new Error(`Say AIFF generation failed: ${error.message}`));
          return;
        }

        if (!fs.existsSync(aiffPath)) {
          reject(new Error('AIFF file was not created'));
          return;
        }

        // Step 2: Try multiple conversion methods
        console.log('Attempting AIFF to MP3 conversion...');
        
        // Try method 1: afconvert with different parameters
        let convertCmd = `afconvert -f m4af -d aac "${aiffPath}" "${outputPath.replace('.mp3', '.m4a')}"`;
        exec(convertCmd, (convertError, convertStdout, convertStderr) => {
          if (!convertError && fs.existsSync(outputPath.replace('.mp3', '.m4a'))) {
            // Rename .m4a to .mp3 (browsers can play m4a as mp3)
            try {
              fs.renameSync(outputPath.replace('.mp3', '.m4a'), outputPath);
              const audioBuffer = fs.readFileSync(outputPath);
              console.log('AIFF to M4A/MP3 conversion successful, audio size:', audioBuffer.length, 'bytes');
              
              // Clean up AIFF file
              if (fs.existsSync(aiffPath)) {
                fs.unlinkSync(aiffPath);
              }
              
              resolve(audioBuffer);
              return;
            } catch (renameError) {
              console.warn('M4A rename failed:', renameError.message);
            }
          }
          
          // Fallback: Just use the AIFF file directly and serve it as audio
          console.warn('MP3 conversion failed, serving AIFF directly');
          try {
            const audioBuffer = fs.readFileSync(aiffPath);
            // Copy AIFF to MP3 path so the URL still works
            fs.writeFileSync(outputPath, audioBuffer);
            console.log('Using AIFF as MP3 fallback, audio size:', audioBuffer.length, 'bytes');
            resolve(audioBuffer);
          } catch (fallbackError) {
            reject(new Error(`All conversion methods failed: ${fallbackError.message}`));
          }
        });
      });
    });
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