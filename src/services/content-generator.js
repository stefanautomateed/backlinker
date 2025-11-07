import OpenAI from 'openai';
import { config } from '../config/config.js';
import { logger } from '../utils/logger.js';

/**
 * Content Generator Service
 * Generates high-quality guest posts using GPT-4
 */

class ContentGenerator {
  constructor() {
    this.openai = new OpenAI({
      apiKey: config.openai.apiKey,
    });
    this.model = config.guestPost.contentModel || 'gpt-4-turbo-preview';
  }

  /**
   * Generate a complete guest post article
   * @param {Object} options - Generation options
   * @returns {Promise<Object>} - Generated article
   */
  async generateGuestPost(options = {}) {
    const {
      targetSite = 'Generic Tech Blog',
      targetAudience = 'Tech entrepreneurs and content creators',
      topic = 'AI tools for content creation',
      wordCount = 1500,
      tone = 'professional and informative',
      includeAuthorBio = true,
    } = options;

    try {
      logger.info('Generating guest post article...');

      // Generate the article
      const article = await this.generateArticle({
        targetSite,
        targetAudience,
        topic,
        wordCount,
        tone,
      });

      // Generate title variations
      const titles = await this.generateTitles(article.content);

      // Generate meta description
      const metaDescription = await this.generateMetaDescription(article.content);

      // Generate author bio if requested
      let authorBio = null;
      if (includeAuthorBio) {
        authorBio = await this.generateAuthorBio();
      }

      // Generate tags
      const tags = await this.generateTags(article.content);

      logger.info('Guest post generated successfully');

      return {
        title: titles[0],
        alternateTitles: titles.slice(1),
        content: article.content,
        metaDescription,
        authorBio,
        tags,
        wordCount: this.countWords(article.content),
        generatedAt: new Date().toISOString(),
      };
    } catch (error) {
      logger.error(`Failed to generate guest post: ${error.message}`);
      throw error;
    }
  }

  /**
   * Generate the main article content
   */
  async generateArticle(options) {
    const { targetSite, targetAudience, topic, wordCount, tone } = options;

    const prompt = `You are a professional content writer creating a guest post for ${targetSite}.

TARGET AUDIENCE: ${targetAudience}
TOPIC: ${topic}
WORD COUNT: ${wordCount} words
TONE: ${tone}

ABOUT AUTOMATEED:
- Automateed.com is an AI-powered e-book creator
- Transforms ideas into professionally formatted e-books
- Uses advanced AI (GPT-4) to generate high-quality content
- Offers multiple formats (PDF, EPUB, MOBI)
- Perfect for content creators, marketers, and entrepreneurs
- Easy to use: just provide a topic, and AI does the rest
- Saves hours of writing and formatting time
- Professional templates and designs
- SEO-optimized content

INSTRUCTIONS:
1. Write a compelling, informative article about AI tools for content creation
2. Naturally mention Automateed.com as one of the tools (but don't make it overly promotional)
3. Provide real value to readers with actionable insights
4. Include practical tips and examples
5. Use engaging subheadings (H2, H3)
6. Write in ${tone} tone
7. Target ${wordCount} words
8. Format in HTML with proper tags (<h2>, <h3>, <p>, <ul>, <li>, <strong>, <em>)
9. Make it SEO-friendly
10. Include a natural CTA mentioning Automateed near the end

Write the complete article now:`;

    const response = await this.openai.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: 'system',
          content: 'You are an expert content writer who creates high-quality, engaging guest posts that provide real value while naturally promoting products.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 4000,
    });

    return {
      content: response.choices[0].message.content.trim(),
    };
  }

  /**
   * Generate multiple title options
   */
  async generateTitles(content) {
    const prompt = `Based on this article content, generate 5 compelling, SEO-friendly titles. Each title should be attention-grabbing and relevant.

Article excerpt:
${content.substring(0, 500)}...

Generate 5 titles in this format:
1. [Title 1]
2. [Title 2]
3. [Title 3]
4. [Title 4]
5. [Title 5]`;

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.8,
      max_tokens: 500,
    });

    const text = response.choices[0].message.content.trim();
    const titles = text
      .split('\n')
      .filter((line) => line.match(/^\d+\./))
      .map((line) => line.replace(/^\d+\.\s*/, '').trim());

    return titles.length > 0 ? titles : ['AI-Powered Content Creation: The Future is Here'];
  }

  /**
   * Generate meta description for SEO
   */
  async generateMetaDescription(content) {
    const prompt = `Based on this article, write a compelling meta description (150-160 characters) that will appear in search results:

${content.substring(0, 500)}...

Write only the meta description, nothing else:`;

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 100,
    });

    return response.choices[0].message.content.trim().replace(/^["']|["']$/g, '');
  }

  /**
   * Generate author bio
   */
  async generateAuthorBio() {
    const bios = [
      'Stefan is a tech entrepreneur and founder of Automateed, an AI-powered content creation platform. He is passionate about helping creators leverage AI to scale their content production.',
      'Stefan is an AI enthusiast and content creator who founded Automateed to help people transform their ideas into professional e-books using artificial intelligence.',
      'As the founder of Automateed, Stefan helps entrepreneurs and creators harness the power of AI for content creation. He believes in making professional content creation accessible to everyone.',
    ];

    // Return a random bio or generate a custom one
    return bios[Math.floor(Math.random() * bios.length)];
  }

  /**
   * Generate relevant tags for the article
   */
  async generateTags(content) {
    const prompt = `Based on this article, generate 5-10 relevant tags/keywords for categorization:

${content.substring(0, 500)}...

Generate tags as a comma-separated list:`;

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.5,
      max_tokens: 100,
    });

    const tagsText = response.choices[0].message.content.trim();
    const tags = tagsText.split(',').map((tag) => tag.trim());

    // Ensure we always include these relevant tags
    const baseTags = ['AI', 'content creation', 'automation', 'productivity'];
    return [...new Set([...tags, ...baseTags])].slice(0, 10);
  }

  /**
   * Generate a custom article for a specific site
   */
  async generateCustomArticle(siteInfo, articleRequirements) {
    const {
      siteName,
      siteUrl,
      guidelines,
      preferredTopics,
      minWords,
      maxWords,
    } = siteInfo;

    const targetWordCount = minWords && maxWords
      ? Math.floor((minWords + maxWords) / 2)
      : 1500;

    return this.generateGuestPost({
      targetSite: siteName,
      targetAudience: preferredTopics || 'Tech-savvy professionals',
      topic: articleRequirements?.topic || 'AI tools for content creation',
      wordCount: articleRequirements?.wordCount || targetWordCount,
      tone: articleRequirements?.tone || 'professional and informative',
      includeAuthorBio: true,
    });
  }

  /**
   * Generate multiple articles at once
   */
  async generateBulkArticles(count = 5, variations = {}) {
    const articles = [];
    const topics = variations.topics || [
      'AI tools for content creation',
      'How AI is transforming content marketing',
      'The future of automated content generation',
      'Best AI writing assistants for entrepreneurs',
      'Creating professional e-books with AI',
    ];

    for (let i = 0; i < Math.min(count, topics.length); i++) {
      try {
        logger.info(`Generating article ${i + 1}/${count}...`);

        const article = await this.generateGuestPost({
          ...variations,
          topic: topics[i],
        });

        articles.push({
          ...article,
          topicUsed: topics[i],
        });

        // Delay to avoid rate limits
        if (i < count - 1) {
          await this.sleep(2000);
        }
      } catch (error) {
        logger.error(`Failed to generate article ${i + 1}: ${error.message}`);
      }
    }

    return articles;
  }

  /**
   * Count words in text
   */
  countWords(text) {
    // Remove HTML tags and count words
    const plainText = text.replace(/<[^>]*>/g, ' ');
    return plainText.trim().split(/\s+/).length;
  }

  /**
   * Sleep helper
   */
  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Estimate cost for content generation
   */
  estimateCost(wordCount, numArticles = 1) {
    // GPT-4 Turbo pricing: $0.01 per 1K input tokens, $0.03 per 1K output tokens
    // Rough estimate: 1 word ≈ 1.3 tokens
    const tokensPerArticle = wordCount * 1.3;
    const costPerArticle = (tokensPerArticle / 1000) * 0.03; // Output tokens
    const inputCost = (500 / 1000) * 0.01; // Prompt tokens
    return (costPerArticle + inputCost) * numArticles;
  }
}

// Export singleton instance
export const contentGenerator = new ContentGenerator();
