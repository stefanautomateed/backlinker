import { BrowserService } from './browser.js';
import { BacklinkerDB } from '../database/db.js';
import { googleSearchService } from './google-search.js';
import { contentGenerator } from './content-generator.js';
import { visionAnalyzer } from './vision-analyzer.js';
import { config } from '../config/config.js';
import { logger } from '../utils/logger.js';
import { EventEmitter } from 'events';

/**
 * Guest Post Orchestrator
 * Complete end-to-end workflow: Find → Generate → Submit with AI vision debugging
 *
 * This is the "intelligent agent" that:
 * 1. Finds "write for us" pages in tech/AI/writing niches
 * 2. Generates articles about Automateed
 * 3. Submits with AI analyzing screenshots when things go wrong
 */

export class GuestPostOrchestrator extends EventEmitter {
  constructor() {
    super();
    this.db = new BacklinkerDB();
  }

  /**
   * STEP 1: Find guest post opportunities in target niches
   */
  async findOpportunities(options = {}) {
    const {
      niches = ['AI tools', 'content creation', 'tech blog', 'publishing', 'writing tools'],
      maxPerNiche = 10,
      verify = true,
    } = options;

    logger.info(`\n🔍 STEP 1: Finding guest post opportunities`);
    logger.info(`Target niches: ${niches.join(', ')}`);

    const allSites = [];

    for (const niche of niches) {
      try {
        logger.info(`\nSearching for: ${niche}...`);

        // Find sites
        const sites = await googleSearchService.findGuestPostSites(niche, maxPerNiche);
        logger.info(`Found ${sites.length} potential sites`);

        // Verify if requested
        if (verify) {
          logger.info('Verifying sites...');
          for (const site of sites) {
            const verification = await googleSearchService.verifyGuestPostPage(site.url);

            if (verification.isValid) {
              // Save to database
              const siteData = {
                ...site,
                ...verification,
              };

              try {
                const siteId = this.db.addGuestPostSite(siteData);
                allSites.push({ ...siteData, id: siteId });
                logger.info(`✓ Verified: ${site.title} (score: ${verification.score})`);
              } catch (error) {
                if (!error.message.includes('UNIQUE constraint')) {
                  logger.error(`Failed to save site: ${error.message}`);
                }
              }
            }
          }
        } else {
          sites.forEach((site) => {
            try {
              const siteId = this.db.addGuestPostSite(site);
              allSites.push({ ...site, id: siteId });
            } catch (error) {
              // Skip duplicates
            }
          });
        }

        // Delay between niches
        await this.sleep(3000);
      } catch (error) {
        logger.error(`Error searching ${niche}: ${error.message}`);
      }
    }

    logger.info(`\n✅ Found and saved ${allSites.length} opportunities`);

    this.emit('opportunities:found', {
      count: allSites.length,
      sites: allSites,
    });

    return allSites;
  }

  /**
   * STEP 2: Generate articles about Automateed
   */
  async generateArticles(count = 10, options = {}) {
    logger.info(`\n✍️  STEP 2: Generating ${count} articles`);

    const {
      wordCount = 1500,
      topics = null,
    } = options;

    const defaultTopics = [
      'How AI is revolutionizing content creation',
      'The future of automated content generation',
      'Best AI tools for creating professional ebooks',
      'Transforming ideas into published books with AI',
      'AI-powered writing assistants: A comprehensive guide',
      'Automating your content workflow with AI',
      'From concept to publication: AI in book creation',
      'The rise of AI in digital publishing',
      'Creating professional content at scale with AI',
      'AI tools every content creator should know about',
    ];

    const articlesToGenerate = Math.min(count, (topics || defaultTopics).length);
    const generatedArticles = [];

    for (let i = 0; i < articlesToGenerate; i++) {
      try {
        const topic = (topics || defaultTopics)[i];
        logger.info(`\nGenerating article ${i + 1}/${articlesToGenerate}: ${topic}`);

        const article = await contentGenerator.generateGuestPost({
          topic,
          wordCount,
          targetAudience: 'Tech entrepreneurs, content creators, and digital publishers',
          tone: 'professional, informative, and engaging',
        });

        // Save to database
        const articleId = this.db.saveGeneratedArticle({
          ...article,
          topic,
        });

        generatedArticles.push({
          ...article,
          id: articleId,
          topic,
        });

        logger.info(`✓ Generated: "${article.title}" (${article.wordCount} words)`);

        this.emit('article:generated', {
          articleId,
          title: article.title,
          wordCount: article.wordCount,
        });

        // Delay to avoid rate limits
        if (i < articlesToGenerate - 1) {
          await this.sleep(2000);
        }
      } catch (error) {
        logger.error(`Failed to generate article ${i + 1}: ${error.message}`);
      }
    }

    logger.info(`\n✅ Generated ${generatedArticles.length} articles`);
    return generatedArticles;
  }

  /**
   * STEP 3: Submit articles with AI vision debugging
   */
  async submitToSite(siteId, articleId) {
    logger.info(`\n📤 STEP 3: Submitting to site ${siteId} with article ${articleId}`);

    const site = this.db.getGuestPostSites().find((s) => s.id === siteId);
    const article = this.db.getArticle(articleId);

    if (!site || !article) {
      logger.error('Site or article not found');
      return { success: false, reason: 'Not found' };
    }

    logger.info(`Site: ${site.title || site.url}`);
    logger.info(`Article: "${article.title}"`);

    const browser = new BrowserService();
    let submissionId = null;

    try {
      // Create submission record
      submissionId = this.db.createGuestPostSubmission(siteId, articleId);

      // Initialize browser
      await browser.init();

      // Navigate to the site
      logger.info(`\n🌐 Navigating to ${site.url}`);
      const navigated = await browser.navigate(site.url);

      if (!navigated) {
        throw new Error('Failed to navigate to site');
      }

      await browser.page.waitForTimeout(3000);

      // Prepare form data
      const formData = {
        email: config.website.email,
        name: config.contact.name,
        website: config.website.url,
        articleTitle: article.title,
        content: article.content,
        authorBio: article.author_bio,
      };

      // Use AI vision to iteratively debug and submit
      logger.info(`\n🤖 Starting AI-guided submission with vision analysis`);

      const result = await visionAnalyzer.iterativeDebug(browser, site.url, formData);

      // Update submission based on result
      if (result.success) {
        logger.info('✅ Submission successful!');

        this.db.updateGuestPostSubmission(submissionId, {
          status: 'success',
          submission_method: 'ai_vision_automated',
          notes: JSON.stringify({
            iterations: result.iterations,
            history: result.history,
          }),
        });

        this.db.updateGuestPostSite(siteId, { status: 'submitted' });

        this.emit('submission:success', {
          siteId,
          articleId,
          iterations: result.iterations,
        });

        return {
          success: true,
          iterations: result.iterations,
          history: result.history,
        };
      } else {
        logger.info(`⚠️ Submission requires manual review: ${result.reason}`);

        const status = result.requiresManual ? 'requires_manual' : 'failed';

        this.db.updateGuestPostSubmission(submissionId, {
          status,
          submission_method: 'ai_vision_attempted',
          error_message: result.reason,
          notes: JSON.stringify({
            iterations: result.iterations,
            history: result.history,
            finalAnalysis: result.finalAnalysis,
          }),
        });

        this.emit('submission:manual', {
          siteId,
          articleId,
          reason: result.reason,
        });

        return {
          success: false,
          requiresManual: result.requiresManual,
          reason: result.reason,
          iterations: result.iterations,
        };
      }
    } catch (error) {
      logger.error(`❌ Submission error: ${error.message}`);

      // Take screenshot
      try {
        const screenshotPath = await browser.screenshot(
          `error_site${siteId}_${Date.now()}.png`
        );

        if (submissionId) {
          this.db.updateGuestPostSubmission(submissionId, {
            status: 'failed',
            error_message: error.message,
            screenshot_path: screenshotPath,
          });
        }
      } catch (screenshotError) {
        logger.error(`Failed to capture screenshot: ${screenshotError.message}`);
      }

      this.emit('submission:error', {
        siteId,
        articleId,
        error: error.message,
      });

      return {
        success: false,
        reason: error.message,
      };
    } finally {
      await browser.close();
    }
  }

  /**
   * Complete end-to-end workflow
   */
  async runCampaign(options = {}) {
    const {
      findSites = true,
      generateArticles = true,
      submitArticles = true,
      maxSites = 20,
      maxArticles = 10,
      maxSubmissions = 5,
    } = options;

    logger.info('\n' + '='.repeat(80));
    logger.info('🚀 GUEST POST CAMPAIGN STARTING');
    logger.info('='.repeat(80));

    const results = {
      sitesFound: 0,
      articlesGenerated: 0,
      submissionsAttempted: 0,
      submissionsSuccessful: 0,
      submissionsManual: 0,
    };

    try {
      // Step 1: Find sites
      let sites = [];
      if (findSites) {
        sites = await this.findOpportunities({
          niches: ['AI tools', 'content creation', 'tech blog', 'publishing'],
          maxPerNiche: Math.ceil(maxSites / 4),
          verify: true,
        });
        results.sitesFound = sites.length;
      } else {
        // Use existing sites from database
        sites = this.db.getGuestPostSites('pending').slice(0, maxSites);
        logger.info(`Using ${sites.length} existing sites from database`);
      }

      // Step 2: Generate articles
      let articles = [];
      if (generateArticles) {
        articles = await this.generateArticles(maxArticles);
        results.articlesGenerated = articles.length;
      } else {
        // Use existing articles
        articles = this.db.getAllArticles().slice(0, maxArticles);
        logger.info(`Using ${articles.length} existing articles from database`);
      }

      // Step 3: Submit articles
      if (submitArticles && sites.length > 0 && articles.length > 0) {
        logger.info(`\n📤 Starting submissions (max: ${maxSubmissions})`);

        const submissionsToMake = Math.min(maxSubmissions, sites.length, articles.length);

        for (let i = 0; i < submissionsToMake; i++) {
          const site = sites[i];
          const article = articles[i % articles.length]; // Reuse articles if needed

          logger.info(`\n\nSubmission ${i + 1}/${submissionsToMake}`);

          const result = await this.submitToSite(site.id, article.id);

          results.submissionsAttempted++;

          if (result.success) {
            results.submissionsSuccessful++;
          } else if (result.requiresManual) {
            results.submissionsManual++;
          }

          // Delay between submissions
          if (i < submissionsToMake - 1) {
            logger.info('\n⏳ Waiting 10s before next submission...');
            await this.sleep(10000);
          }
        }
      }

      // Print summary
      this.printCampaignSummary(results);

      return results;
    } catch (error) {
      logger.error(`Campaign error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Print campaign summary
   */
  printCampaignSummary(results) {
    logger.info('\n' + '='.repeat(80));
    logger.info('📊 CAMPAIGN SUMMARY');
    logger.info('='.repeat(80));
    logger.info(`Sites Found: ${results.sitesFound}`);
    logger.info(`Articles Generated: ${results.articlesGenerated}`);
    logger.info(`Submissions Attempted: ${results.submissionsAttempted}`);
    logger.info(`  ✅ Successful: ${results.submissionsSuccessful}`);
    logger.info(`  ⚠️  Manual Review: ${results.submissionsManual}`);
    logger.info(`  ❌ Failed: ${results.submissionsAttempted - results.submissionsSuccessful - results.submissionsManual}`);
    logger.info('='.repeat(80) + '\n');
  }

  /**
   * Sleep helper
   */
  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Close database
   */
  close() {
    this.db.close();
  }
}
