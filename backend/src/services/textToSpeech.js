import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';

class TextToSpeechService {
  constructor() {
    this.outputDir = path.join(process.cwd(), 'uploads', 'audio');
    this.apiKey = process.env.HF_TOKEN;
    this.baseUrl = 'https://api-inference.huggingface.co/models';
    // Using a more accessible TTS model that works with standard HF tokens
    this.model = 'microsoft/speecht5_tts';
    
    // Ensure audio directory exists
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
    
    if (!this.apiKey) {
      console.warn('HF_TOKEN not found - TTS will fall back to local synthesis');
    }
  }

  /**
   * Convert text to speech using Hugging Face API or fallback to local TTS
   * @param {string} text - The text to convert to speech
   * @param {string} outputPath - Output path to save the audio file
   * @returns {Promise<Buffer>} - Audio data as buffer
   */
  async textToSpeech(text, outputPath = null) {
    if (!text || typeof text !== 'string') {
      throw new Error('Text input is required and must be a string');
    }

    console.log('Converting text to speech:', text.substring(0, 50) + '...');

    if (!outputPath) {
      outputPath = path.join(this.outputDir, `tts-${Date.now()}.mp3`);
    }

    // Try Hugging Face API first
    if (this.apiKey) {
      try {
        return await this.textToSpeechHF(text, outputPath);
      } catch (error) {
        console.warn('HF TTS failed, falling back to ElevenLabs-style API:', error.message);
        // Try a different approach or fallback
      }
    }

    // Fallback to a simple mock MP3 (for now)
    return await this.textToSpeechFallback(text, outputPath);
  }

  /**
   * Use Hugging Face TTS API
   */
  async textToSpeechHF(text, outputPath) {
    console.log('Using Hugging Face TTS API...');
    
    const response = await fetch(`${this.baseUrl}/${this.model}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: text,
        parameters: {
          // Optional parameters
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Hugging Face API error: ${response.status} - ${errorText}`);
    }

    const audioBuffer = await response.buffer();
    
    if (audioBuffer.length === 0) {
      throw new Error('Received empty audio response');
    }

    // Save to file
    fs.writeFileSync(outputPath, audioBuffer);
    console.log('HF TTS conversion successful, audio size:', audioBuffer.length, 'bytes');
    
    return audioBuffer;
  }

  /**
   * Fallback TTS using Google Text-to-Speech (via gTTS-like API)
   */
  async textToSpeechFallback(text, outputPath) {
    console.log('Using fallback TTS API...');
    
    try {
      // Use a simple TTS service that returns MP3
      const encodedText = encodeURIComponent(text);
      const response = await fetch(`https://translate.google.com/translate_tts?ie=UTF-8&q=${encodedText}&tl=en&client=tw-ob`, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      if (!response.ok) {
        throw new Error(`TTS API error: ${response.status}`);
      }

      const audioBuffer = await response.buffer();
      
      if (audioBuffer.length === 0) {
        throw new Error('Received empty audio response');
      }
      
      // Save to file
      fs.writeFileSync(outputPath, audioBuffer);
      console.log('Fallback TTS conversion successful, audio size:', audioBuffer.length, 'bytes');
      
      return audioBuffer;
    } catch (error) {
      console.error('Fallback TTS failed:', error.message);
      
      // Last resort: create a simple text file that frontend can handle
      const textContent = `Audio not available: ${text}`;
      fs.writeFileSync(outputPath.replace('.mp3', '.txt'), textContent);
      throw new Error('Text-to-speech conversion failed - all methods exhausted');
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
    
    // Return the public URL path
    return `/uploads/audio/${filename}.mp3`;
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