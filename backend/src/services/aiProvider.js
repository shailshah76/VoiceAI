import dotenv from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';
// Using native fetch (Node.js 18+)

dotenv.config();

class AIProviderService {
  constructor() {
    this.currentProvider = process.env.AI_PROVIDER || 'groq'; // Default to Groq (Kimi)
    this.providers = {
      gemini: this.initGemini(),
      groq: this.initGroq()
    };
    
    console.log(`🤖 AI Provider initialized: ${this.currentProvider.toUpperCase()}`);
  }

  initGemini() {
    try {
      if (!process.env.GEMINI_API_KEY) {
        console.warn('⚠️ GEMINI_API_KEY not found');
        return null;
      }
      return new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    } catch (error) {
      console.error('❌ Failed to initialize Gemini:', error.message);
      return null;
    }
  }



  initGroq() {
    try {
      if (!process.env.GROQ_API_KEY) {
        console.warn('⚠️ GROQ_API_KEY not found');
        return null;
      }
      return { apiKey: process.env.GROQ_API_KEY };
    } catch (error) {
      console.error('❌ Failed to initialize Groq:', error.message);
      return null;
    }
  }

  /**
   * Switch AI provider dynamically
   */
  setProvider(providerName) {
    if (this.providers[providerName]) {
      this.currentProvider = providerName;
      console.log(`🔄 Switched to AI provider: ${providerName.toUpperCase()}`);
      return true;
    }
    console.error(`❌ Provider ${providerName} not available`);
    return false;
  }

  /**
   * Get available providers
   */
  getAvailableProviders() {
    return Object.keys(this.providers).filter(name => this.providers[name] !== null);
  }

  /**
   * Main text generation method - routes to appropriate provider
   */
  async generateText(prompt, options = {}) {
    const provider = this.providers[this.currentProvider];
    if (!provider) {
      throw new Error(`Provider ${this.currentProvider} not available`);
    }

    console.log(`🤖 Generating text with ${this.currentProvider.toUpperCase()}...`);

    switch (this.currentProvider) {
      case 'gemini':
        return await this.generateWithGemini(prompt, options);
      case 'groq':
        return await this.generateWithGroq(prompt, options);
      default:
        throw new Error(`Unknown provider: ${this.currentProvider}`);
    }
  }

  /**
   * Gemini text generation
   */
  async generateWithGemini(prompt, options = {}) {
    try {
      const model = this.providers.gemini.getGenerativeModel({ 
        model: options.model || 'gemini-2.0-flash' 
      });
      
      const result = await model.generateContent(prompt);
      const response = await result.response;
      return response.text();
    } catch (error) {
      console.error('❌ Gemini generation failed:', error.message);
      throw new Error(`Gemini API error: ${error.message}`);
    }
  }



  /**
   * Groq text generation (fast and free!)
   */
  async generateWithGroq(prompt, options = {}) {
    try {
      console.log('🚀 Calling Groq API with model:', options.model || 'llama-3.1-8b-instant');
      
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.providers.groq.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: options.model || 'llama-3.1-8b-instant', // Use Llama 3.1 8B Instant (current Groq model)
          messages: [
            { role: 'user', content: prompt }
          ],
          max_tokens: options.maxTokens || 1000,
          temperature: options.temperature || 0.7
        })
      });

      console.log('📡 Groq response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Groq API error response:', errorText);
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch (e) {
          throw new Error(`Groq API error: ${response.status} - ${errorText}`);
        }
        throw new Error(`Groq API error: ${errorData.error?.message || response.statusText}`);
      }

      const data = await response.json();
      console.log('✅ Groq response received');
      return data.choices[0].message.content;
    } catch (error) {
      console.error('❌ Groq generation failed:', error.message);
      throw new Error(`Groq API error: ${error.message}`);
    }
  }

  /**
   * Vision/Image analysis - currently only Gemini supports this
   */
  async analyzeImage(imagePath, prompt, options = {}) {
    if (this.currentProvider === 'gemini') {
      return await this.analyzeImageWithGemini(imagePath, prompt, options);
    } else {
      throw new Error(`Image analysis not supported by ${this.currentProvider}. Use Gemini for vision tasks.`);
    }
  }

  async analyzeImageWithGemini(imagePath, prompt, options = {}) {
    try {
      const fs = await import('fs');
      const imageData = fs.readFileSync(imagePath);
      const base64Image = imageData.toString('base64');
      
      const model = this.providers.gemini.getGenerativeModel({ 
        model: options.model || 'gemini-2.0-flash' 
      });
      
      const result = await model.generateContent([
        prompt,
        {
          inlineData: {
            data: base64Image,
            mimeType: 'image/jpeg'
          }
        }
      ]);
      
      const response = await result.response;
      return response.text();
    } catch (error) {
      console.error('❌ Gemini image analysis failed:', error.message);
      throw new Error(`Gemini vision error: ${error.message}`);
    }
  }



  /**
   * Get current provider status
   */
  getStatus() {
    const available = this.getAvailableProviders();
    return {
      currentProvider: this.currentProvider,
      availableProviders: available,
      isConfigured: available.length > 0,
      supportsVision: ['gemini'].includes(this.currentProvider)
    };
  }
}

export default new AIProviderService(); 