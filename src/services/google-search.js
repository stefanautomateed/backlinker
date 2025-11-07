import axios from 'axios';
import { config } from '../config/config.js';
import { logger } from '../utils/logger.js';

/**
 * Google Search Service
 * Finds guest post opportunities using Google Custom Search API or SerpAPI
 */

class GoogleSearchService {
  constructor() {
    this.searchEngine = config.guestPost.searchEngine || 'serpapi';
    this.apiKey = config.guestPost.searchApiKey;
  }

  /**
   * Search for guest post opportunities
   * @param {string} niche - The niche/topic to search for
   * @param {number} maxResults - Maximum number of results to return
   * @returns {Promise<Array>} - Array of guest post opportunities
   */
  async findGuestPostSites(niche = 'AI tools', maxResults = 50) {
    const queries = this.generateSearchQueries(niche);
    const allResults = [];

    for (const query of queries) {
      try {
        logger.info(`Searching: ${query}`);
        const results = await this.search(query, 10);
        allResults.push(...results);

        // Delay between searches to avoid rate limits
        await this.sleep(2000);
      } catch (error) {
        logger.error(`Search failed for "${query}": ${error.message}`);
      }

      if (allResults.length >= maxResults) {
        break;
      }
    }

    // Remove duplicates and filter
    const uniqueResults = this.deduplicateResults(allResults);
    return uniqueResults.slice(0, maxResults);
  }

  /**
   * Generate search queries for finding guest post opportunities
   * Focused on tech, AI, writing, publishing, and books niches
   */
  generateSearchQueries(niche) {
    // Base guest post queries
    const baseQueries = [
      `${niche} "write for us"`,
      `${niche} "submit a guest post"`,
      `${niche} "contribute to our blog"`,
      `${niche} "guest post guidelines"`,
      `${niche} "become a contributor"`,
      `${niche} "submit an article"`,
      `${niche} inurl:"write-for-us"`,
      `${niche} inurl:"guest-post"`,
      `${niche} "accepting guest posts"`,
    ];

    // Tech/AI/Writing specific variations
    const targetedQueries = [
      // AI & Tech
      `"artificial intelligence" "write for us"`,
      `"AI tools" "guest post"`,
      `"machine learning" "contribute"`,
      `"tech blog" "write for us"`,
      `"SaaS blog" "guest post"`,
      `"technology" "submit article"`,

      // Writing & Content
      `"content creation" "write for us"`,
      `"writing tools" "guest post"`,
      `"content marketing" "contribute"`,
      `"copywriting" "write for us"`,
      `"blogging" "guest author"`,

      // Publishing & Books
      `"publishing" "write for us"`,
      `"ebook" "guest post"`,
      `"book publishing" "contribute"`,
      `"self-publishing" "write for us"`,
      `"authors" "submit article"`,

      // Productivity & Automation
      `"productivity tools" "write for us"`,
      `"automation" "guest post"`,
      `"workflow" "contribute"`,
    ];

    // Combine and return based on niche
    const nicheLower = niche.toLowerCase();

    // If niche already includes our target keywords, use base queries
    if (
      nicheLower.includes('ai') ||
      nicheLower.includes('tech') ||
      nicheLower.includes('writing') ||
      nicheLower.includes('publishing') ||
      nicheLower.includes('book')
    ) {
      return baseQueries;
    }

    // Otherwise, use targeted queries
    return targetedQueries;
  }

  /**
   * Perform a Google search
   */
  async search(query, numResults = 10) {
    if (this.searchEngine === 'serpapi') {
      return this.searchWithSerpAPI(query, numResults);
    } else if (this.searchEngine === 'google') {
      return this.searchWithGoogleAPI(query, numResults);
    } else {
      throw new Error(`Unknown search engine: ${this.searchEngine}`);
    }
  }

  /**
   * Search using SerpAPI (recommended)
   */
  async searchWithSerpAPI(query, numResults = 10) {
    try {
      const response = await axios.get('https://serpapi.com/search', {
        params: {
          q: query,
          api_key: this.apiKey,
          engine: 'google',
          num: numResults,
          gl: 'us',
          hl: 'en',
        },
      });

      const results = response.data.organic_results || [];

      return results.map((result) => ({
        title: result.title,
        url: result.link,
        snippet: result.snippet,
        source: 'serpapi',
        query: query,
      }));
    } catch (error) {
      logger.error(`SerpAPI error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Search using Google Custom Search API
   */
  async searchWithGoogleAPI(query, numResults = 10) {
    try {
      const cx = config.guestPost.googleSearchEngineId;
      const response = await axios.get('https://www.googleapis.com/customsearch/v1', {
        params: {
          key: this.apiKey,
          cx: cx,
          q: query,
          num: Math.min(numResults, 10), // Google API limits to 10 per request
        },
      });

      const results = response.data.items || [];

      return results.map((result) => ({
        title: result.title,
        url: result.link,
        snippet: result.snippet,
        source: 'google',
        query: query,
      }));
    } catch (error) {
      logger.error(`Google API error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Remove duplicate URLs
   */
  deduplicateResults(results) {
    const seen = new Set();
    return results.filter((result) => {
      const url = this.normalizeUrl(result.url);
      if (seen.has(url)) {
        return false;
      }
      seen.add(url);
      return true;
    });
  }

  /**
   * Normalize URL for comparison
   */
  normalizeUrl(url) {
    try {
      const parsed = new URL(url);
      return `${parsed.protocol}//${parsed.hostname}${parsed.pathname}`.toLowerCase();
    } catch {
      return url.toLowerCase();
    }
  }

  /**
   * Verify if a page is actually a guest post submission page
   * @param {string} url - URL to check
   * @returns {Promise<Object>} - Analysis result
   */
  async verifyGuestPostPage(url) {
    try {
      const response = await axios.get(url, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      });

      const html = response.data.toLowerCase();

      // Check for guest post indicators
      const indicators = {
        hasWriteForUs: html.includes('write for us') || html.includes('write for me'),
        hasGuestPost: html.includes('guest post') || html.includes('guest article'),
        hasContribute: html.includes('contribute') || html.includes('contributor'),
        hasSubmitArticle: html.includes('submit article') || html.includes('submit post'),
        hasGuidelines: html.includes('guidelines') || html.includes('submission guidelines'),
        hasForm: html.includes('<form') && (html.includes('type="submit"') || html.includes('type=submit')),
        hasEmail: html.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g),
      };

      const score = Object.values(indicators).filter(Boolean).length;

      return {
        url,
        isValid: score >= 2,
        score,
        indicators,
        hasForm: indicators.hasForm,
        contactEmails: indicators.hasEmail || [],
      };
    } catch (error) {
      logger.error(`Failed to verify ${url}: ${error.message}`);
      return {
        url,
        isValid: false,
        score: 0,
        error: error.message,
      };
    }
  }

  /**
   * Filter out low-quality or spam sites
   */
  filterQualitySites(results) {
    const blacklist = [
      'fiverr.com',
      'upwork.com',
      'freelancer.com',
      'reddit.com',
      'quora.com',
      'medium.com',
      'linkedin.com',
    ];

    return results.filter((result) => {
      const url = result.url.toLowerCase();
      return !blacklist.some((domain) => url.includes(domain));
    });
  }

  /**
   * Sleep helper
   */
  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get estimated cost for search
   */
  getEstimatedCost(numSearches) {
    if (this.searchEngine === 'serpapi') {
      // SerpAPI: $50 for 5000 searches = $0.01 per search
      return numSearches * 0.01;
    } else if (this.searchEngine === 'google') {
      // Google Custom Search: $5 per 1000 queries = $0.005 per search
      return numSearches * 0.005;
    }
    return 0;
  }
}

// Export singleton instance
export const googleSearchService = new GoogleSearchService();
