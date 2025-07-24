import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';

dotenv.config();

class ImageAnalysisService {
  constructor() {
    this.hfToken = process.env.HF_TOKEN;
    this.groqApiKey = process.env.GROQ_API_KEY;
    this.geminiApiKey = process.env.GEMINI_API_KEY;
    this.visionModel = 'microsoft/DiT-base-finetuned-ade-512-512'; // Alternative: 'nlpconnect/vit-gpt2-image-captioning'
    this.hfBaseUrl = 'https://api-inference.huggingface.co/models';
    
    // Initialize Google GenAI client
    if (this.geminiApiKey) {
      this.genAI = new GoogleGenerativeAI(this.geminiApiKey);
    }
    
    console.log('ImageAnalysisService initialized:');
    console.log('- HF_TOKEN length:', this.hfToken ? this.hfToken.length : 'not set');
    console.log('- GROQ_API_KEY length:', this.groqApiKey ? this.groqApiKey.length : 'not set');
    console.log('- GEMINI_API_KEY length:', this.geminiApiKey ? this.geminiApiKey.length : 'not set');
    console.log('- Google GenAI client:', this.genAI ? 'initialized' : 'not initialized');
  }

  /**
   * Analyze image and generate natural narration
   * @param {string} imagePath - Path to the slide image
   * @param {Object} slideInfo - Additional slide information (title, text, etc.)
   * @returns {Promise<string>} - Generated narration text
   */
  async generateSlideNarration(imagePath, slideInfo = {}) {
    try {
      console.log('Analyzing slide image:', imagePath);
      
      // Try Gemini vision directly first
      if (this.genAI) {
        try {
          console.log('🔍 Using Gemini 2.5 Pro vision for slide narration...');
          console.log('📊 Slide info:', JSON.stringify(slideInfo, null, 2));
          
          // Check if image file exists
          const imagePath = path.join(process.cwd(), slideInfo.image);
          console.log('🖼️ Checking image at path:', imagePath);
          
          if (!fs.existsSync(imagePath)) {
            throw new Error(`Image file not found: ${imagePath}`);
          }
          
          console.log('✅ Image file exists, proceeding with Gemini...');
          const narration = await this.generateWithGeminiVision(slideInfo);
          console.log('✅ Gemini narration generated successfully:', narration);
          return narration;
        } catch (error) {
          console.error('❌ Gemini vision failed:', error.message);
          console.error('❌ Full Gemini error:', error);
        }
      } else {
        console.log('⚠️ Gemini client not available');
      }
      
      // Fallback: Step 1: Analyze the image to get visual description
      const imageDescription = await this.analyzeImage(imagePath);
      console.log('Image analysis result:', imageDescription);
      
      // Step 2: Generate contextual narration using LLM
      const narration = await this.generateNarrationFromDescription(imageDescription, slideInfo);
      console.log('Generated narration:', narration);
      
      return narration;
    } catch (error) {
      console.error('Failed to generate slide narration:', error);
      // Fallback to basic narration
      return this.generateFallbackNarration(slideInfo);
    }
  }

  /**
   * Analyze image using vision models to understand actual slide content
   * @param {string} imagePath - Path to the image file
   * @returns {Promise<string>} - Description of the image
   */
  async analyzeImage(imagePath) {
    console.log('Starting visual analysis for:', imagePath);
    
    // Try vision analysis first with multiple approaches
    if (this.groqApiKey) {
      try {
        return await this.analyzeImageWithVision(imagePath);
      } catch (error) {
        console.warn('Vision analysis failed:', error.message);
      }
    }
    
    // Try Hugging Face vision model
    if (this.hfToken) {
      try {
        return await this.analyzeImageWithHF(imagePath);
      } catch (error) {
        console.warn('HF vision analysis failed:', error.message);
      }
    }
    
    // Fallback to filename-based analysis
    return this.analyzeImageFromFilename(imagePath);
  }

  /**
   * Analyze image using vision-capable model via GROQ
   */
  async analyzeImageWithVision(imagePath) {
    console.log('Using vision model for image analysis...');
    
    // Read and encode image as base64
    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = imageBuffer.toString('base64');
    
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.groqApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.2-11b-vision-preview', // Vision model on GROQ
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                                 text: 'Read and extract all the text content from this presentation slide. List what is written on the slide: titles, headings, bullet points, captions, labels, and any other text. Be accurate and comprehensive in reading the actual text shown.'
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/jpeg;base64,${base64Image}`
                }
              }
            ]
          }
        ],
        max_tokens: 200,
        temperature: 0.3
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Vision API error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    
    if (result.choices && result.choices[0] && result.choices[0].message) {
      const description = result.choices[0].message.content.trim();
      console.log('Vision analysis result:', description);
      return description;
    } else {
      throw new Error('Unexpected response format from vision API');
    }
  }

  /**
   * Analyze image using Hugging Face vision model
   */
  async analyzeImageWithHF(imagePath) {
    console.log('Using HF vision model for image analysis...');
    
    const imageBuffer = fs.readFileSync(imagePath);
    
    const response = await fetch(`${this.hfBaseUrl}/nlpconnect/vit-gpt2-image-captioning`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.hfToken}`,
        'Content-Type': 'application/octet-stream',
      },
      body: imageBuffer
    });

    if (!response.ok) {
      throw new Error(`HF Vision API error: ${response.status}`);
    }

    const result = await response.json();
    
    if (Array.isArray(result) && result.length > 0 && result[0].generated_text) {
      return result[0].generated_text;
    } else if (result.generated_text) {
      return result.generated_text;
    } else {
      throw new Error('Unexpected response format from HF vision API');
    }
  }

  /**
   * Fallback: Analyze based on filename patterns
   */
  analyzeImageFromFilename(imagePath) {
    console.log('Using filename-based analysis fallback...');
    
    const filename = path.basename(imagePath);
    let description = 'A presentation slide';
    
    if (filename.includes('Hebrew_Topic_Model')) {
      description = 'A slide about Hebrew Topic Modeling, likely containing text analysis, charts, or methodological information related to natural language processing in Hebrew.';
    } else if (filename.includes('page-1')) {
      description = 'The opening slide of a presentation, typically containing the title, author information, and an overview of the topic.';
    } else if (filename.includes('page-2') || filename.includes('page-3')) {
      description = 'A content slide in the middle of the presentation, likely containing key information, charts, or detailed explanations of the main topic.';
    } else if (filename.includes('page-4') || filename.includes('page-5')) {
      description = 'A slide towards the end of the presentation, possibly containing results, conclusions, or summary information.';
    } else {
      description = 'A presentation slide containing visual content, charts, text, or other informational elements that support the overall presentation narrative.';
    }
    
    console.log('Filename-based description:', description);
    return description;
  }

  /**
   * Generate natural narration using GROQ LLM
   * @param {string} imageDescription - Description from image analysis
   * @param {Object} slideInfo - Additional slide context
   * @returns {Promise<string>} - Natural narration text
   */
  async generateNarrationFromDescription(imageDescription, slideInfo) {
    console.log('Gemini API client available:', !!this.genAI);
    
    if (this.genAI) {
      try {
        console.log('Attempting Gemini 2.5 Pro API call...');
        const result = await this.generateWithGeminiVision(slideInfo);
        console.log('Gemini 2.5 Pro API success! Generated narration:', result);
        return result;
      } catch (error) {
        console.error('Gemini 2.5 Pro API failed:', error.message);
        console.error('Full error:', error);
      }
    } else {
      console.log('No Gemini API client, trying GROQ...');
      
      if (this.groqApiKey) {
        try {
          const prompt = this.createNarrationPrompt(imageDescription, slideInfo);
          const result = await this.generateWithKimi(prompt);
          return result;
        } catch (error) {
          console.error('GROQ API also failed:', error.message);
        }
      }
    }
    
    // Fallback to a simpler narration generation
    console.log('Falling back to simple narration');
    return this.generateSimpleNarration(imageDescription, slideInfo);
  }

  /**
   * Create a prompt for LLM narration generation
   */
  createNarrationPrompt(imageDescription, slideInfo) {
    const { title, text, pageNumber, totalPages } = slideInfo;
    
    return `Read and narrate the content from this presentation slide. Base your narration on what is actually written on the slide.

Slide Position: Page ${pageNumber || 1} of ${totalPages || 1}
Text Content Found: ${imageDescription}

Task: Create a natural 60-80 word narration that reads and explains what is written on this slide. Focus on:
- Reading the actual text content shown
- Explaining the key points written on the slide
- Describing any important headings, bullet points, or data
- Speaking naturally as if presenting the slide content

Do not invent content. Only narrate what is actually visible on the slide.

Narration:`;
  }

  /**
   * Generate narration using Gemini 2.5 Pro with vision using official SDK
   */
  async generateWithGeminiVision(slideInfo) {
    if (!this.genAI) {
      throw new Error('Google GenAI client not initialized - missing GEMINI_API_KEY');
    }

    const { pageNumber, totalPages, image } = slideInfo;
    
    // Read and encode image as base64
    const imagePath = path.join(process.cwd(), image);
    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = imageBuffer.toString('base64');
    
    const prompt = `Persona:
You are a professional presentation coach. Your expertise is in helping people craft scripts that make complex information clear, engaging, and memorable. You transform simple descriptions into compelling narratives.
Task:
I will provide you with an image of a single presentation slide. Your task is to generate a concise, engaging script (approximately 2-4 sentences) that a presenter would use to explain the content of this slide to an audience.
Instructions & Style Guide:
Identify the Core Message: Go beyond a literal description. Analyze the image to identify its primary purpose and the key takeaway. Ask yourself: Is this slide showing data, a process, a comparison, a problem, or a conclusion? What is the single most important message the audience must understand?
Orient the Audience: Start by clearly and concisely telling the audience what they are looking at. Use orienting phrases like: "So, what this chart shows us is...", "On this slide, we've mapped out...", or "Here's a look at...".
Explain the "So What?": Immediately follow up by explaining the significance of the information. Answer the audience's unspoken question, "Why does this matter?" (e.g., "...which is crucial because...", "...and the key insight here is...").
Create a Narrative Bridge: Conclude the script by smoothly transitioning to the next logical point, connecting this slide to the larger story of the presentation.
Tone: The tone must be professional yet conversational and engaging. It should sound like a confident expert guiding the audience through their findings.
Output Requirement (Crucial):
Your response must contain only the generated script. Do not include any introductory phrases, conversational fillers, or pre-text like "Okay, here's a script:" or "Here is your text:". The first word of your output must be the first word of the script itself.

Context: This is slide ${pageNumber || 1} of ${totalPages || 1} in the presentation.`;

    try {
      console.log('🤖 Getting Gemini model: gemini-2.0-flash-exp');
      // Get the generative model
      const model = this.genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

      console.log('🖼️ Preparing image data, size:', base64Image.length, 'characters');
      // Prepare the image data
      const imagePart = {
        inlineData: {
          data: base64Image,
          mimeType: "image/jpeg"
        }
      };

      console.log('📝 Sending request to Gemini with prompt length:', prompt.length);
      // Generate content with both text and image
      const result = await model.generateContent([prompt, imagePart]);
      const response = await result.response;
      console.log('📨 Received response from Gemini');
      let narration = response.text();

      // Clean up any unwanted formatting
      narration = narration.replace(/\*\*/g, ''); // Remove bold markdown
      narration = narration.replace(/\*/g, ''); // Remove italic markdown
      narration = narration.replace(/\n+/g, ' '); // Replace newlines with spaces
      narration = narration.replace(/\s+/g, ' '); // Replace multiple spaces with single space
      narration = narration.trim();

      console.log('Gemini 2.5 Pro generated narration:', narration);
      return narration;

    } catch (error) {
      console.error('Gemini SDK error:', error);
      throw new Error(`Gemini API error: ${error.message}`);
    }
  }

  /**
   * Generate narration using Moonshot AI Kimi K2 Instruct via GROQ API
   */
  async generateWithKimi(prompt) {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.groqApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'moonshotai/kimi-k2-instruct', // Using Moonshot AI Kimi K2 Instruct model
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 120,
        temperature: 0.6
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Kimi K2 API error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    
    if (result.choices && result.choices[0] && result.choices[0].message) {
      let narration = result.choices[0].message.content.trim();
      
      // Clean up common LLM response prefixes/suffixes and formatting
      narration = narration.replace(/^(Here's|Here is|This is|The narration is|Narration:).*?[:]\s*/i, '');
      narration = narration.replace(/^["']|["']$/g, ''); // Remove quotes
      narration = narration.replace(/\n+/g, ' '); // Replace newlines with spaces
      narration = narration.replace(/\s+/g, ' '); // Replace multiple spaces with single space
      narration = narration.trim();
      
      // Ensure it's not too long for TTS (limit to ~500 characters)
      if (narration.length > 500) {
        narration = narration.substring(0, 500).replace(/\s+\S*$/, '') + '.';
      }
      
      return narration;
    } else {
      throw new Error('Unexpected response format from Kimi K2 API');
    }
  }

  /**
   * Generate enhanced narration without LLM using template-based approach
   */
  generateSimpleNarration(imageDescription, slideInfo) {
    const { title, text, pageNumber, totalPages } = slideInfo;
    
    let narration = '';
    
    // Opening based on slide position
    if (pageNumber === 1) {
      narration += `Welcome to this presentation. `;
      if (title) {
        narration += `We're starting with "${title}". `;
      }
      narration += `This opening slide sets the foundation for our discussion. `;
    } else if (pageNumber === totalPages) {
      narration += `As we conclude with slide ${pageNumber}, `;
      if (title) {
        narration += `this final section on "${title}" `;
      }
      narration += `brings together the key insights from our presentation. `;
    } else {
      narration += `Moving to slide ${pageNumber} of ${totalPages}, `;
      if (title) {
        narration += `we now explore "${title}". `;
      }
    }
    
    // Add content based on image description
    if (imageDescription && !imageDescription.includes('named')) {
      if (imageDescription.includes('Hebrew Topic Model')) {
        narration += `This slide focuses on Hebrew Topic Modeling, an advanced natural language processing technique. The content here likely demonstrates methodologies, results, or technical approaches specific to analyzing Hebrew text data. `;
      } else if (imageDescription.includes('opening slide')) {
        narration += `As an introductory slide, this typically presents the research topic, authors, and provides an overview of what we'll be exploring together. `;
      } else if (imageDescription.includes('content slide')) {
        narration += `This content slide delves deeper into the subject matter, presenting detailed information, analysis, or methodology that builds upon our previous discussion. `;
      } else if (imageDescription.includes('towards the end')) {
        narration += `As we approach the conclusion, this slide likely presents results, findings, or summarizes the key takeaways from our exploration. `;
      } else {
        narration += `${imageDescription} `;
      }
    }
    
    // Add any additional text content
    if (text && text !== title && text.length > 0) {
      narration += `The slide emphasizes: ${text}. `;
    }
    
    // Closing based on slide position
    if (pageNumber === 1) {
      narration += `This foundation prepares us for the detailed exploration ahead.`;
    } else if (pageNumber === totalPages) {
      narration += `This concludes our comprehensive examination of the topic.`;
    } else {
      narration += `This insight leads us naturally to our next point of discussion.`;
    }
    
    return narration;
  }

  /**
   * Fallback narration when all else fails
   */
  generateFallbackNarration(slideInfo) {
    const { title, text, pageNumber, totalPages } = slideInfo;
    
    let narration = '';
    
    if (pageNumber && totalPages) {
      narration += `Slide ${pageNumber} of ${totalPages}. `;
    }
    
    if (title) {
      narration += `${title}. `;
    }
    
    if (text && text !== title) {
      narration += text;
    } else {
      narration += 'This slide presents important information that supports our discussion.';
    }
    
    return narration;
  }
}

// Export singleton instance
const imageAnalysisService = new ImageAnalysisService();
export default imageAnalysisService; 