import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { generateAudioCacheKey } from '../utils/fileHash.js';

dotenv.config();

class TextToSpeechService {
  constructor() {
    this.outputDir = path.join(process.cwd(), 'uploads', 'audio');
    this.cacheDir = path.join(process.cwd(), 'uploads', 'audio-cache');
    this.groqApiKey = process.env.GROQ_API_KEY;
    this.voice = process.env.PLAYAI_VOICE || 'Mason-PlayAI'; // Configurable voice
    this.cache = new Map();
    
    // Ensure directories exist
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
    
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }
    
        console.log(`🎵 TTS Service initialized with Groq/PlayAI: ${this.groqApiKey ? '✅' : '❌ (no key)'}`);
    console.log(`🎤 Voice: ${this.voice}`);
  }

  /**
   * Check if cached audio exists
   */
  async checkAudioCache(fileHash, textContent) {
    try {
      const cacheKey = generateAudioCacheKey(fileHash, textContent);
      const cachedPath = path.join(this.cacheDir, `${cacheKey}.wav`);
      
      if (await fs.promises.access(cachedPath).then(() => true).catch(() => false)) {
        console.log(`🎵 Cache HIT: ${cacheKey}`);
        return cachedPath;
      }
      
      return null;
    } catch (error) {
      console.error('❌ Cache check error:', error.message);
      return null;
    }
  }

  /**
   * Save audio to cache
   */
  async saveToAudioCache(fileHash, textContent, audioBuffer) {
    try {
      const cacheKey = generateAudioCacheKey(fileHash, textContent);
      const cachedPath = path.join(this.cacheDir, `${cacheKey}.wav`);
      
      await fs.promises.writeFile(cachedPath, audioBuffer);
      console.log(`💾 Cached: ${cacheKey}`);
      
      return cachedPath;
    } catch (error) {
      console.error('❌ Cache save error:', error.message);
    }
  }

  /**
   * PlayAI TTS through Groq API
   * Available voices: Aaliyah-PlayAI, Adelaide-PlayAI, Angelo-PlayAI, Arista-PlayAI, 
   * Atlas-PlayAI, Basil-PlayAI, Briggs-PlayAI, Calum-PlayAI, Celeste-PlayAI, 
   * Cheyenne-PlayAI, Chip-PlayAI, Cillian-PlayAI, Deedee-PlayAI, Eleanor-PlayAI, 
   * Fritz-PlayAI, Gail-PlayAI, Indigo-PlayAI, Jennifer-PlayAI, Judy-PlayAI, 
   * Mamaw-PlayAI, Mason-PlayAI, Mikail-PlayAI, Mitch-PlayAI, Nia-PlayAI, 
   * Quinn-PlayAI, Ruby-PlayAI, Thunder-PlayAI
   */
  async textToSpeechGroqPlayAI(text) {
    if (!this.groqApiKey) {
      throw new Error('Groq API key not configured');
    }

    console.log('🔧 Groq/PlayAI TTS request starting...');

    const response = await fetch('https://api.groq.com/openai/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.groqApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'playai-tts',
        input: text,
        voice: this.voice,
        response_format: 'wav'
      })
    });

    console.log(`📡 Groq Response: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Groq/PlayAI Error:', errorText);
      throw new Error(`Groq/PlayAI API error: ${response.status} - ${errorText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = Buffer.from(arrayBuffer);
    
    console.log(`✅ Groq/PlayAI Success: ${audioBuffer.length} bytes`);
    
    if (audioBuffer.length < 100) {
      throw new Error(`Groq/PlayAI returned invalid audio: ${audioBuffer.length} bytes`);
    }

    return audioBuffer;
  }

  /**
   * Create test beep audio as fallback
   */
  createTestAudio(textLength = 100) {
    console.log('🔊 Generating test beep audio...');
    
    const sampleRate = 44100;
    const channels = 1;
    const bitsPerSample = 16;
    const durationSeconds = Math.min(Math.max(textLength / 50, 2), 8);
    const bytesPerSample = bitsPerSample / 8;
    const blockAlign = channels * bytesPerSample;
    const byteRate = sampleRate * blockAlign;
    const dataSize = sampleRate * durationSeconds * blockAlign;
    const fileSize = 36 + dataSize;

    // WAV header
    const header = Buffer.alloc(44);
    header.write('RIFF', 0);
    header.writeUInt32LE(fileSize, 4);
    header.write('WAVE', 8);
    header.write('fmt ', 12);
    header.writeUInt32LE(16, 16);
    header.writeUInt16LE(1, 20);
    header.writeUInt16LE(channels, 22);
    header.writeUInt32LE(sampleRate, 24);
    header.writeUInt32LE(byteRate, 28);
    header.writeUInt16LE(blockAlign, 32);
    header.writeUInt16LE(bitsPerSample, 34);
    header.write('data', 36);
    header.writeUInt32LE(dataSize, 40);
    
    // Beep pattern audio data
    const audioData = Buffer.alloc(dataSize);
    const frequency = 440;
    const volume = 0.3;
    
    for (let i = 0; i < dataSize / 2; i++) {
      const t = i / sampleRate;
      const beepCycle = t % 1.0;
      let sample = 0;
      
      if (beepCycle < 0.2) {
        sample = Math.sin(2 * Math.PI * frequency * t) * volume * 32767;
      }
      
      audioData.writeInt16LE(Math.round(sample), i * 2);
    }
    
    return Buffer.concat([header, audioData]);
  }

  /**
   * Main TTS method
   */
  async textToSpeech(text, outputPath = null, fileHash = null) {
    if (!text || typeof text !== 'string') {
      throw new Error('Text input is required and must be a string');
    }

    const cleanText = text.trim();
    if (!cleanText) {
      throw new Error('Text content is empty');
    }

    console.log(`🎤 TTS Request: "${cleanText.substring(0, 80)}${cleanText.length > 80 ? '...' : ''}"`);

    // Check cache first
    if (fileHash) {
      const cachedPath = await this.checkAudioCache(fileHash, cleanText);
      if (cachedPath) {
        if (outputPath) {
          await fs.promises.copyFile(cachedPath, outputPath);
          return outputPath;
        }
        return cachedPath;
      }
    }

    // Set output path
    if (outputPath) {
      const outputDir = path.dirname(outputPath);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
    } else {
      outputPath = path.join(this.outputDir, `tts-${Date.now()}.wav`);
    }

    let audioBuffer = null;
    let serviceName = 'none';

    // Try Groq/PlayAI TTS
    if (this.groqApiKey) {
      try {
        audioBuffer = await this.textToSpeechGroqPlayAI(cleanText);
        serviceName = 'Groq/PlayAI';
      } catch (error) {
        console.error('❌ Groq/PlayAI failed:', error.message);
      }
    }

    // Fallback to test audio
    if (!audioBuffer) {
      console.log('🎵 Using test beep fallback');
      audioBuffer = this.createTestAudio(cleanText.length);
      serviceName = 'TestBeep';
    }

    // Save audio file
    try {
      await fs.promises.writeFile(outputPath, audioBuffer);
      console.log(`✅ TTS Success (${serviceName}): ${outputPath} (${audioBuffer.length} bytes)`);
      
      // Cache if not test audio
      if (fileHash && serviceName !== 'TestBeep') {
        await this.saveToAudioCache(fileHash, cleanText, audioBuffer);
      }
      
      return outputPath;
    } catch (error) {
      console.error('❌ File save error:', error.message);
      throw new Error(`Failed to save audio file: ${error.message}`);
    }
  }

  /**
   * Generate TTS for a file with filename
   */
  async textToSpeechFile(text, filename, fileHash = null) {
    const audioPath = path.join(this.outputDir, `${filename}.wav`);
    await this.textToSpeech(text, audioPath, fileHash);
    return `/uploads/audio/${filename}.wav`;
  }

  /**
   * Generate narration for a slide
   */
  async generateSlideNarration(slide) {
    if (!slide) {
      throw new Error('Slide object is required');
    }

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

    const filename = `narration-${slide.id || 'slide'}-${Date.now()}`;
    
    console.log(`🎬 Generating narration for slide: ${slide.id || 'unknown'}`);
    
    return await this.textToSpeechFile(narrationText, filename);
  }

  /**
   * Health check
   */
  async healthCheck() {
    return {
      groq_playai: !!this.groqApiKey,
      cache_size: this.cache.size,
      output_dir: this.outputDir,
      cache_dir: this.cacheDir
    };
  }

  /**
   * Debug test method
   */
  async debugTest() {
    const testText = "Hello, this is a test of the text to speech system.";
    console.log('🧪 Testing Groq/PlayAI TTS...');
    
    try {
      const audioBuffer = await this.textToSpeechGroqPlayAI(testText);
      const testPath = path.join(this.outputDir, 'debug-test.wav');
      await fs.promises.writeFile(testPath, audioBuffer);
      console.log(`✅ Test Success: ${testPath} (${audioBuffer.length} bytes)`);
      return { success: true, path: testPath, size: audioBuffer.length };
    } catch (error) {
      console.error(`❌ Test Failed: ${error.message}`);
      return { success: false, error: error.message };
    }
  }
}

// Export singleton instance
const textToSpeechService = new TextToSpeechService();
export default textToSpeechService;