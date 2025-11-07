import { BrowserService } from './browser.js';
import axios from 'axios';
import { config } from '../config/config.js';
import { logger } from '../utils/logger.js';

/**
 * Free Google Search Service
 * NO API KEY NEEDED! Uses Playwright to scrape Google directly
 *
 * This is 100% free and works without any API keys
 */

class FreeGoogleSearch {
  constructor() {
    this.results = [];
  }

  /**
   * Search Google using Playwright (FREE - no API needed)
   * @param {string} query - Search query
   * @param {number} maxResults - Max results to return
   * @returns {Promise<Array>} - Search results
   */
  async searchWithPlaywright(query, maxResults = 10) {
    const browser = new BrowserService();
    const results = [];

    try {
      logger.info(`Searching Google (free): "${query}"`);

      await browser.init();

      // Navigate to Google
      const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}&num=${maxResults}`;
      await browser.navigate(searchUrl);

      // Wait for results to load
      await browser.page.waitForTimeout(2000);

      // Extract search results
      const searchResults = await browser.page.evaluate(() => {
        const results = [];

        // Google search result selectors
        const resultElements = document.querySelectorAll('div.g');

        resultElements.forEach((element) => {
          try {
            const titleElement = element.querySelector('h3');
            const linkElement = element.querySelector('a');
            const snippetElement = element.querySelector('.VwiC3b, .IsZvec');

            if (titleElement && linkElement) {
              results.push({
                title: titleElement.textContent,
                url: linkElement.href,
                snippet: snippetElement ? snippetElement.textContent : '',
              });
            }
          } catch (error) {
            // Skip invalid results
          }
        });

        return results;
      });

      logger.info(`Found ${searchResults.length} results`);

      await browser.close();

      return searchResults.map((result) => ({
        ...result,
        source: 'google_scrape',
        query,
      }));
    } catch (error) {
      logger.error(`Google scraping failed: ${error.message}`);
      await browser.close();
      return [];
    }
  }

  /**
   * Search using Google Custom Search API (100 free searches/day)
   * Get free API key at: https://developers.google.com/custom-search/v1/overview
   */
  async searchWithGoogleAPI(query, maxResults = 10) {
    const apiKey = config.guestPost.searchApiKey || process.env.GOOGLE_API_KEY;
    const cx = config.guestPost.googleSearchEngineId || process.env.GOOGLE_CSE_ID;

    if (!apiKey || !cx) {
      logger.warn('Google Custom Search API not configured, skipping...');
      return [];
    }

    try {
      logger.info(`Searching Google Custom Search API: "${query}"`);

      const response = await axios.get('https://www.googleapis.com/customsearch/v1', {
        params: {
          key: apiKey,
          cx: cx,
          q: query,
          num: Math.min(maxResults, 10),
        },
      });

      const results = response.data.items || [];

      return results.map((result) => ({
        title: result.title,
        url: result.link,
        snippet: result.snippet,
        source: 'google_api',
        query,
      }));
    } catch (error) {
      logger.error(`Google Custom Search API failed: ${error.message}`);
      return [];
    }
  }

  /**
   * Search DuckDuckGo (100% free, no limits, no API key)
   * @param {string} query - Search query
   * @param {number} maxResults - Max results
   */
  async searchWithDuckDuckGo(query, maxResults = 10) {
    try {
      logger.info(`Searching DuckDuckGo (free): "${query}"`);

      // DuckDuckGo HTML search
      const response = await axios.get('https://html.duckduckgo.com/html/', {
        params: {
          q: query,
        },
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      });

      const html = response.data;

      // Simple regex to extract results (not perfect but works)
      const results = [];
      const resultRegex = /<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>/g;
      const snippetRegex = /<a[^>]*class="result__snippet"[^>]*>([^<]*)<\/a>/g;

      let match;
      let count = 0;

      while ((match = resultRegex.exec(html)) !== null && count < maxResults) {
        const url = match[1];
        const title = match[2];

        // Get snippet
        const snippetMatch = snippetRegex.exec(html);
        const snippet = snippetMatch ? snippetMatch[1] : '';

        results.push({
          title: this.decodeHTML(title),
          url: this.decodeURL(url),
          snippet: this.decodeHTML(snippet),
          source: 'duckduckgo',
          query,
        });

        count++;
      }

      logger.info(`Found ${results.length} DuckDuckGo results`);
      return results;
    } catch (error) {
      logger.error(`DuckDuckGo search failed: ${error.message}`);
      return [];
    }
  }

  /**
   * Search Bing (free, works well)
   */
  async searchWithBing(query, maxResults = 10) {
    const browser = new BrowserService();

    try {
      logger.info(`Searching Bing (free): "${query}"`);

      await browser.init();

      const searchUrl = `https://www.bing.com/search?q=${encodeURIComponent(query)}`;
      await browser.navigate(searchUrl);
      await browser.page.waitForTimeout(2000);

      const results = await browser.page.evaluate(() => {
        const results = [];
        const resultElements = document.querySelectorAll('.b_algo');

        resultElements.forEach((element) => {
          try {
            const titleElement = element.querySelector('h2 a');
            const snippetElement = element.querySelector('.b_caption p');

            if (titleElement) {
              results.push({
                title: titleElement.textContent,
                url: titleElement.href,
                snippet: snippetElement ? snippetElement.textContent : '',
              });
            }
          } catch (error) {
            // Skip
          }
        });

        return results;
      });

      await browser.close();

      logger.info(`Found ${results.length} Bing results`);

      return results.slice(0, maxResults).map((result) => ({
        ...result,
        source: 'bing_scrape',
        query,
      }));
    } catch (error) {
      logger.error(`Bing scraping failed: ${error.message}`);
      await browser.close();
      return [];
    }
  }

  /**
   * Master search function - tries multiple sources
   * Priority: Google Custom API (free 100/day) → Google scraping → DuckDuckGo → Bing
   */
  async search(query, maxResults = 10) {
    let results = [];

    // Try Google Custom Search API first (free 100/day)
    if (config.guestPost.searchApiKey && config.guestPost.googleSearchEngineId) {
      results = await this.searchWithGoogleAPI(query, maxResults);
      if (results.length > 0) {
        logger.info(`✓ Using Google Custom Search API (free tier)`);
        return results;
      }
    }

    // Try DuckDuckGo (100% free, no limits)
    results = await this.searchWithDuckDuckGo(query, maxResults);
    if (results.length > 0) {
      logger.info(`✓ Using DuckDuckGo (100% free)`);
      return results;
    }

    // Try Google scraping (free but may get rate limited)
    results = await this.searchWithPlaywright(query, maxResults);
    if (results.length > 0) {
      logger.info(`✓ Using Google scraping (free)`);
      return results;
    }

    // Try Bing as last resort
    results = await this.searchWithBing(query, maxResults);
    if (results.length > 0) {
      logger.info(`✓ Using Bing scraping (free)`);
      return results;
    }

    logger.warn('All search methods failed');
    return [];
  }

  /**
   * Find guest post opportunities using free methods
   */
  async findGuestPostSites(niche = 'AI tools', maxResults = 50) {
    const queries = this.generateSearchQueries(niche);
    const allResults = [];

    for (const query of queries) {
      try {
        // Use free search methods
        const results = await this.search(query, 10);
        allResults.push(...results);

        // Delay between searches to be respectful
        await this.sleep(5000); // 5 second delay

        if (allResults.length >= maxResults) {
          break;
        }
      } catch (error) {
        logger.error(`Search failed for "${query}": ${error.message}`);
      }
    }

    // Remove duplicates
    const uniqueResults = this.deduplicateResults(allResults);
    return uniqueResults.slice(0, maxResults);
  }

  /**
   * Generate search queries focused on tech/AI/writing
   */
  generateSearchQueries(niche) {
    const targetedQueries = [
      // AI & Tech
      `"artificial intelligence" "write for us"`,
      `"AI tools" "guest post"`,
      `"machine learning" "contribute"`,
      `"tech blog" "write for us"`,
      `"SaaS" "guest post"`,

      // Writing & Content
      `"content creation" "write for us"`,
      `"writing tools" "guest post"`,
      `"blogging" "write for us"`,

      // Publishing & Books
      `"publishing" "write for us"`,
      `"ebook" "guest post"`,
      `"self-publishing" "contribute"`,

      // Niche-specific
      `${niche} "write for us"`,
      `${niche} "guest post"`,
      `${niche} "contribute"`,
    ];

    return targetedQueries;
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
   * Normalize URL
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
   * Decode HTML entities
   */
  decodeHTML(text) {
    return text
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
  }

  /**
   * Decode URL
   */
  decodeURL(url) {
    // DuckDuckGo wraps URLs, extract the actual URL
    if (url.includes('uddg=')) {
      const match = url.match(/uddg=([^&]+)/);
      if (match) {
        return decodeURIComponent(match[1]);
      }
    }
    return url;
  }

  /**
   * Verify if a page is actually a guest post submission page
   * @param {string} url - URL to check
   * @returns {Promise<Object>} - Analysis result
   */
  async verifyGuestPostPage(url) {
    try {
      logger.info(`Verifying guest post page: ${url}`);

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

      logger.info(`Verification score: ${score}/7 for ${url}`);

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
}

// Export singleton
export const freeGoogleSearch = new FreeGoogleSearch();
