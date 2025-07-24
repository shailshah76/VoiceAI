import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import { exec } from 'child_process';

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

    // Try Hugging Face API first
    if (this.apiKey) {
      try {
        return await this.textToSpeechHF(text, outputPath);
      } catch (error) {
        console.warn('HF TTS failed, falling back to macOS say:', error.message);
      }
    }

    // Use macOS say command as reliable fallback
    return await this.textToSpeechSay(text, outputPath);
  }

  /**
   * Use Hugging Face TTS API
   */
  async textToSpeechHF(text, outputPath) {
    console.log('Using Hugging Face TTS API...');
    
    // Try multiple TTS models for better compatibility
    const models = [
      'microsoft/speecht5_tts',
      'facebook/fastspeech2-en-ljspeech',
      'facebook/mms-tts-eng'
    ];
    
    for (const model of models) {
      try {
        console.log(`Trying HF TTS model: ${model}`);
        
        const response = await fetch(`${this.baseUrl}/${model}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            inputs: text,
            parameters: {
              speaker_embeddings: "https://huggingface.co/datasets/Matthijs/cmu-arctic-xvectors/resolve/main/cmu_us_bdl_arctic-wav-22050_16bit-mono-xvector.npy"
            }
          })
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.warn(`HF model ${model} failed: ${response.status} - ${errorText}`);
          continue; // Try next model
        }

        const audioBuffer = await response.arrayBuffer();
        
        if (audioBuffer.byteLength === 0) {
          console.warn(`Model ${model} returned empty audio`);
          continue;
        }

        // Save to file
        fs.writeFileSync(outputPath, Buffer.from(audioBuffer));
        console.log(`HF TTS conversion successful with ${model}, audio size:`, audioBuffer.byteLength, 'bytes');
        
        return Buffer.from(audioBuffer);
      } catch (error) {
        console.warn(`Model ${model} failed:`, error.message);
        continue;
      }
    }
    
    throw new Error('All Hugging Face TTS models failed');
  }

    /**
   * Fallback TTS using a working web service
   */
  async textToSpeechFallback(text, outputPath) {
    console.log('Using fallback TTS API...');
    
    try {
      // Use a different working TTS service
      const response = await fetch('https://api.voicerss.org/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          key: 'demo', // Free demo key
          hl: 'en-us',
          src: text.substring(0, 100), // Limit length for demo
          f: '48khz_16bit_stereo',
          c: 'mp3'
        })
      });

      if (!response.ok) {
        console.warn('VoiceRSS failed, trying alternative...');
        throw new Error(`VoiceRSS error: ${response.status}`);
      }

      const audioBuffer = await response.arrayBuffer();
      
      if (audioBuffer.byteLength === 0) {
        throw new Error('Received empty audio response');
      }
      
      // Save to file
      fs.writeFileSync(outputPath, Buffer.from(audioBuffer));
      console.log('Fallback TTS conversion successful, audio size:', audioBuffer.byteLength, 'bytes');
      
      return Buffer.from(audioBuffer);
    } catch (error) {
      console.error('All external TTS failed:', error.message);
      
      // Use macOS say command as ultimate fallback
      try {
        return await this.textToSpeechSay(text, outputPath);
      } catch (sayError) {
        console.error('macOS say also failed:', sayError.message);
        
        // Create a simple text file that frontend can handle
        const textContent = `Audio not available: ${text}`;
        fs.writeFileSync(outputPath.replace('.mp3', '.txt'), textContent);
        throw new Error('Text-to-speech conversion failed - all methods exhausted');
      }
    }
  }

  /**
   * Use macOS say command to generate MP3 directly
   */
  async textToSpeechSay(text, outputPath) {
    console.log('Using macOS say command to generate MP3...');
    
    return new Promise((resolve, reject) => {
      // Try to generate MP3 directly using say with data format options
      const cmd = `say -v "Alex" --data-format=LEF32@22050 -o "${outputPath}" "${text.replace(/"/g, '\\"')}"`;
      console.log('Executing say command for MP3:', cmd);
      
      exec(cmd, (error, stdout, stderr) => {
        if (error) {
          console.warn('Say MP3 format failed, trying AIFF then convert:', error.message);
          // Fallback: generate AIFF then convert to MP3 using afconvert
          this.textToSpeechSayWithConvert(text, outputPath)
            .then(resolve)
            .catch(reject);
          return;
        }

        if (!fs.existsSync(outputPath)) {
          console.error('MP3 file was not created at:', outputPath);
          // Fallback: generate AIFF then convert
          this.textToSpeechSayWithConvert(text, outputPath)
            .then(resolve)
            .catch(reject);
          return;
        }

        try {
          const audioBuffer = fs.readFileSync(outputPath);
          console.log('macOS say MP3 successful, audio size:', audioBuffer.length, 'bytes');
          resolve(audioBuffer);
        } catch (readError) {
          console.error('Failed to read MP3 output:', readError.message);
          reject(new Error(`Failed to read MP3 output: ${readError.message}`));
        }
      });
    });
  }

  /**
   * Fallback: Generate AIFF then convert to MP3 using afconvert
   */
  async textToSpeechSayWithConvert(text, outputPath) {
    console.log('Using AIFF to MP3 conversion fallback...');
    
    return new Promise((resolve, reject) => {
      const aiffPath = outputPath.replace('.mp3', '.aiff');
      
      // Step 1: Generate AIFF
      const sayCmd = `say -v "Alex" -o "${aiffPath}" "${text.replace(/"/g, '\\"')}"`;
      console.log('Executing say command for AIFF:', sayCmd);
      
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
    
    // Return the public URL path (should always be MP3 now)
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