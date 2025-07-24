import imageAnalysisService from './imageAnalysis.js';
import path from 'path';

class SlideContextService {
  constructor() {
    this.slideIndex = new Map(); // slideId -> { content, keywords, summary }
    this.presentations = new Map(); // presentationId -> slides array
  }

  /**
   * Index all slides in a presentation for conversational queries
   */
  async indexPresentation(presentationId, slides) {
    console.log(`🧠 Indexing presentation: ${presentationId} with ${slides.length} slides`);
    
    const indexedSlides = [];
    
    for (const slide of slides) {
      try {
        const slideContext = await this.analyzeSlideContent(slide);
        
        const indexedSlide = {
          ...slide,
          context: slideContext,
          keywords: slideContext.keywords,
          summary: slideContext.summary,
          topics: slideContext.topics
        };
        
        this.slideIndex.set(slide.id, indexedSlide);
        indexedSlides.push(indexedSlide);
        
        console.log(`📄 Indexed slide ${slide.pageNumber}: ${slideContext.summary.substring(0, 100)}...`);
      } catch (error) {
        console.error(`❌ Failed to index slide ${slide.pageNumber}:`, error.message);
        // Add slide without deep context
        const basicSlide = {
          ...slide,
          context: { summary: slide.title || `Slide ${slide.pageNumber}`, keywords: [], topics: [] }
        };
        indexedSlides.push(basicSlide);
      }
    }
    
    this.presentations.set(presentationId, indexedSlides);
    console.log(`✅ Presentation indexed: ${indexedSlides.length} slides ready for conversation`);
    
    return indexedSlides;
  }

  /**
   * Analyze slide content for conversational context
   */
  async analyzeSlideContent(slide) {
    try {
      let analysisPrompt = `Analyze this slide for conversational context:
      
Title: ${slide.title}
Text: ${slide.text || 'No text available'}
Slide Number: ${slide.pageNumber}`;

      // If slide has an image, analyze it for visual content
      if (slide.image && slide.image.startsWith('/uploads/')) {
        const imagePath = path.join(process.cwd(), slide.image);
        console.log(`👁️ Analyzing slide ${slide.pageNumber} image for context...`);
        
        const visualAnalysis = await imageAnalysisService.analyzeImageContent(imagePath);
        analysisPrompt += `\nVisual Content: ${visualAnalysis}`;
      }

      analysisPrompt += `

Please provide:
1. A concise summary (2-3 sentences)
2. Key topics/concepts covered
3. Important keywords for search
4. What questions this slide could answer

Format as JSON:
{
  "summary": "...",
  "topics": ["topic1", "topic2"],
  "keywords": ["keyword1", "keyword2"],
  "questionsItAnswers": ["What is...", "How does..."]
}`;

      const contextAnalysis = await imageAnalysisService.generateWithAI(analysisPrompt);
      
      try {
        const parsed = JSON.parse(contextAnalysis);
        return {
          summary: parsed.summary || slide.title || `Slide ${slide.pageNumber}`,
          topics: parsed.topics || [],
          keywords: parsed.keywords || [],
          questionsItAnswers: parsed.questionsItAnswers || [],
          rawContent: slide.text || slide.title || ''
        };
      } catch (parseError) {
        console.warn(`⚠️ Could not parse context JSON for slide ${slide.pageNumber}, using fallback`);
        return this.generateFallbackContext(slide, contextAnalysis);
      }
    } catch (error) {
      console.error(`❌ Context analysis failed for slide ${slide.pageNumber}:`, error.message);
      return this.generateFallbackContext(slide);
    }
  }

  /**
   * Generate basic context when AI analysis fails
   */
  generateFallbackContext(slide, rawAnalysis = '') {
    const words = (slide.text || slide.title || '').toLowerCase().split(/\s+/);
    const keywords = words.filter(word => word.length > 3).slice(0, 5);
    
    return {
      summary: slide.title || `Slide ${slide.pageNumber}`,
      topics: [slide.title || 'General'],
      keywords: keywords,
      questionsItAnswers: [`What is on slide ${slide.pageNumber}?`],
      rawContent: slide.text || slide.title || '',
      rawAnalysis: rawAnalysis
    };
  }

  /**
   * Find relevant slides based on user question
   */
  async findRelevantSlides(presentationId, userQuestion, currentSlideId = null) {
    const slides = this.presentations.get(presentationId);
    if (!slides) {
      throw new Error('Presentation not indexed');
    }

    console.log(`🔍 Searching for slides relevant to: "${userQuestion}"`);

    try {
      // Use AI to understand the question and find relevant slides
      const searchPrompt = `User question: "${userQuestion}"

Available slides context:
${slides.map(slide => `
Slide ${slide.pageNumber}: ${slide.context.summary}
Topics: ${slide.context.topics.join(', ')}
Keywords: ${slide.context.keywords.join(', ')}
Questions it answers: ${slide.context.questionsItAnswers.join(', ')}
`).join('\n')}

Based on the user's question, which slides are most relevant? 
Provide a ranked list with explanations.

Format as JSON:
{
  "relevantSlides": [
    {
      "slideNumber": 1,
      "relevanceScore": 0.9,
      "reason": "This slide directly addresses the user's question about..."
    }
  ],
  "suggestedResponse": "Based on your question about..., I found relevant information on slides..."
}`;

      const searchResult = await imageAnalysisService.generateWithAI(searchPrompt);
      const parsed = JSON.parse(searchResult);

      const rankedSlides = parsed.relevantSlides
        .map(result => ({
          slide: slides.find(s => s.pageNumber === result.slideNumber),
          score: result.relevanceScore,
          reason: result.reason
        }))
        .filter(item => item.slide)
        .sort((a, b) => b.score - a.score);

      return {
        relevantSlides: rankedSlides,
        suggestedResponse: parsed.suggestedResponse,
        totalSlides: slides.length
      };

    } catch (error) {
      console.error('❌ AI search failed, using fallback keyword search:', error.message);
      return this.fallbackKeywordSearch(slides, userQuestion, currentSlideId);
    }
  }

  /**
   * Fallback keyword-based search when AI fails
   */
  fallbackKeywordSearch(slides, userQuestion, currentSlideId) {
    const queryWords = userQuestion.toLowerCase().split(/\s+/);
    
    const rankedSlides = slides.map(slide => {
      const content = (slide.context.summary + ' ' + slide.context.rawContent + ' ' + 
                     slide.context.keywords.join(' ') + ' ' + slide.context.topics.join(' ')).toLowerCase();
      
      const score = queryWords.reduce((acc, word) => {
        return acc + (content.includes(word) ? 1 : 0);
      }, 0) / queryWords.length;

      return {
        slide: slide,
        score: score,
        reason: `Contains ${Math.round(score * 100)}% of your keywords`
      };
    })
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score);

    return {
      relevantSlides: rankedSlides,
      suggestedResponse: `I found ${rankedSlides.length} slides that might help with your question.`,
      totalSlides: slides.length
    };
  }

  /**
   * Generate conversational response about a specific slide
   */
  async generateSlideResponse(slide, userQuestion, context = '') {
    try {
      const responsePrompt = `The user asked: "${userQuestion}"

Current slide context:
- Slide ${slide.pageNumber}: ${slide.context.summary}
- Content: ${slide.context.rawContent}
- Topics: ${slide.context.topics.join(', ')}

Additional context: ${context}

Generate a helpful, conversational response that:
1. Answers their question using the slide content
2. Explains what this slide shows
3. Suggests what they might want to know next

Keep it natural and engaging, like a knowledgeable presentation assistant.`;

      const response = await imageAnalysisService.generateWithAI(responsePrompt);
      return response;
    } catch (error) {
      console.error('❌ Failed to generate conversational response:', error.message);
      return `This is slide ${slide.pageNumber}: ${slide.context.summary}. How can I help you understand this content better?`;
    }
  }

  /**
   * Get presentation summary for conversation context
   */
  getPresentationSummary(presentationId) {
    const slides = this.presentations.get(presentationId);
    if (!slides) return null;

    return {
      totalSlides: slides.length,
      topics: [...new Set(slides.flatMap(s => s.context.topics))],
      overview: slides.map(s => `Slide ${s.pageNumber}: ${s.context.summary}`).join('\n')
    };
  }
}

export default new SlideContextService(); 