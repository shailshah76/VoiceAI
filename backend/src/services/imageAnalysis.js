// Using native fetch (Node.js 18+)
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';
import aiProvider from './aiProvider.js';

dotenv.config();

class ImageAnalysisService {
  constructor() {
    this.hfToken = process.env.HF_TOKEN;
    this.groqApiKey = process.env.GROQ_API_KEY;
    this.geminiApiKey = process.env.GEMINI_API_KEY;
    this.visionModel = 'microsoft/DiT-base-finetuned-ade-512-512';
    this.hfBaseUrl = 'https://api-inference.huggingface.co/models';
    
    // Initialize Google GenAI client for fallback
    if (this.geminiApiKey) {
      this.genAI = new GoogleGenerativeAI(this.geminiApiKey);
    }
    
    console.log('🔍 ImageAnalysisService initialized with AI provider support');
  }

  /**
   * Generate slide narration - main entry point
   */
  async generateSlideNarration(imagePath, slideInfo) {
    try {
      console.log(`🎯 Generating narration for slide ${slideInfo.pageNumber}`);
      
      // Try AI provider first for vision analysis
      if (slideInfo.image && slideInfo.image.startsWith('/uploads/')) {
        const visionPrompt = this.createVisionNarrationPrompt(slideInfo);
        const result = await this.analyzeImageWithAI(imagePath, visionPrompt);
        console.log('✅ AI provider vision success!');
        return result;
      } else {
        // Text-only narration
        const prompt = this.createNarrationPrompt('', slideInfo);
        const result = await this.generateWithAI(prompt);
        console.log('✅ AI provider text success!');
        return result;
      }
    } catch (error) {
      console.error('❌ AI provider failed, using fallback:', error.message);
      return await this.generateFallbackNarration(slideInfo);
    }
  }

  /**
   * Generate text using current AI provider
   */
  async generateWithAI(prompt, options = {}) {
    try {
      console.log(`🤖 Using AI provider: ${aiProvider.currentProvider.toUpperCase()}`);
      return await aiProvider.generateText(prompt, options);
    } catch (error) {
      console.error('❌ AI provider failed:', error.message);
      throw error;
    }
  }

  /**
   * Analyze image using current AI provider
   */
  async analyzeImageWithAI(imagePath, prompt, options = {}) {
    try {
      console.log(`👁️ Using AI provider for image analysis: ${aiProvider.currentProvider.toUpperCase()}`);
      return await aiProvider.analyzeImage(imagePath, prompt, options);
    } catch (error) {
      console.error('❌ AI provider image analysis failed:', error.message);
      throw error;
    }
  }

  /**
   * Fallback narration when AI providers fail
   */
  async generateFallbackNarration(slideInfo) {
    try {
      console.log('🔄 Using Gemini fallback...');
      if (this.genAI) {
        return await this.generateWithGeminiVision(slideInfo);
      }
    } catch (error) {
      console.error('❌ Gemini fallback also failed:', error.message);
    }
    
    // Final fallback
    return this.generateSimpleNarration(slideInfo);
  }

  /**
   * Create vision-specific prompt for AI providers
   */
  createVisionNarrationPrompt(slideInfo) {
    const { title, text, pageNumber, totalPages } = slideInfo;
    
    return `Analyze this presentation slide image and create a natural, engaging narration. 

Slide Context:
- Title: ${title || 'Slide ' + (pageNumber || 1)}
- Position: Page ${pageNumber || 1} of ${totalPages || 1}
- Additional Text: ${text || 'No additional text provided'}

Please:
1. Describe what you see in the slide
2. Explain any charts, diagrams, or visual elements
3. Create a natural narrative that would help someone understand the content
4. Keep it conversational and engaging
5. Aim for 2-3 sentences

Generate a natural narration as if you're presenting this slide to an audience.`;
  }

  /**
   * Create text prompt for narration generation
   */
  createNarrationPrompt(imageDescription, slideInfo) {
    const { title, text, pageNumber, totalPages } = slideInfo;
    
    return `Create a natural, engaging narration for this presentation slide:

Slide Information:
- Title: ${title || 'Slide ' + (pageNumber || 1)}
- Position: Page ${pageNumber || 1} of ${totalPages || 1}
- Content: ${text || 'No text content provided'}
- Description: ${imageDescription || 'No image description available'}

Create a conversational narration that:
1. Introduces the slide content naturally
2. Explains key concepts clearly
3. Connects to the overall presentation flow
4. Keeps the audience engaged
5. Uses 2-3 sentences

Generate as if you're presenting to a live audience.`;
  }

  /**
   * Generate simple narration when all else fails
   */
  generateSimpleNarration(slideInfo) {
    const { title, text, pageNumber, totalPages } = slideInfo;
    
    let narration = '';
    
    if (pageNumber === 1) {
      narration = `Welcome to this presentation. `;
    } else if (pageNumber === totalPages) {
      narration = `As we conclude with the final slide, `;
    } else {
      narration = `Moving to slide ${pageNumber} of ${totalPages}, `;
    }
    
    narration += `we now explore "${title || `Slide ${pageNumber}`}". `;
    
    if (text && text !== `Page ${pageNumber} of presentation`) {
      narration += `${text} `;
    } else {
      narration += `This slide presents important information for our discussion. `;
    }
    
    if (pageNumber < totalPages) {
      narration += `This insight leads us naturally to our next point of discussion.`;
    } else {
      narration += `This concludes our comprehensive examination of the topic.`;
    }
    
    return narration;
  }

  /**
   * Legacy Gemini vision method for fallback
   */
  async generateWithGeminiVision(slideInfo) {
    if (!this.genAI) {
      throw new Error('Gemini not available');
    }

    try {
      const imagePath = path.join(process.cwd(), slideInfo.image);
      const imageData = fs.readFileSync(imagePath);
      const base64Image = imageData.toString('base64');
      
             const model = this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
      
      const prompt = this.createVisionNarrationPrompt(slideInfo);
      
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
      console.error('❌ Gemini vision failed:', error.message);
      throw error;
    }
  }

  /**
   * Analyze image content (for slide context service)
   */
  async analyzeImageContent(imagePath) {
    try {
      const prompt = `Analyze this image and describe what you see. Focus on:
1. Text content (if any)
2. Charts, graphs, or diagrams
3. Key visual elements
4. Overall topic or theme

Provide a concise description in 2-3 sentences.`;

      return await this.analyzeImageWithAI(imagePath, prompt);
    } catch (error) {
      console.error('❌ Image content analysis failed:', error.message);
      return 'Image content could not be analyzed.';
    }
  }
}

export default new ImageAnalysisService(); 