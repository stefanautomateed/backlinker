import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '../../.env') });

/**
 * Application configuration loaded from environment variables
 */
export const config = {
  // OpenAI Configuration
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    model: 'gpt-4-turbo-preview',
  },

  // Website Details for Submission
  website: {
    url: process.env.WEBSITE_URL || 'https://automateed.com',
    name: process.env.WEBSITE_NAME || 'Automateed',
    description: process.env.WEBSITE_DESCRIPTION || 'AI-powered e-book generator that transforms your ideas into professionally formatted e-books',
    email: process.env.WEBSITE_EMAIL || 'stefan@automateed.com',
    category: process.env.WEBSITE_CATEGORY || 'AI Tools, SaaS, Content Creation',
    tags: process.env.WEBSITE_TAGS || 'AI, ebook, generator, automation, content, writing',
  },

  // Contact Information
  contact: {
    name: process.env.CONTACT_NAME || 'Stefan',
    company: process.env.CONTACT_COMPANY || 'Automateed',
  },

  // Automation Settings
  automation: {
    maxConcurrentSubmissions: parseInt(process.env.MAX_CONCURRENT_SUBMISSIONS || '3'),
    headlessBrowser: process.env.HEADLESS_BROWSER !== 'false',
    screenshotOnError: process.env.SCREENSHOT_ON_ERROR !== 'false',
    retryAttempts: parseInt(process.env.RETRY_ATTEMPTS || '2'),
    timeoutMs: parseInt(process.env.TIMEOUT_MS || '30000'),
  },

  // Rate Limiting
  rateLimiting: {
    delayBetweenSubmissionsMs: parseInt(process.env.DELAY_BETWEEN_SUBMISSIONS_MS || '5000'),
    delayBetweenPagesMs: parseInt(process.env.DELAY_BETWEEN_PAGES_MS || '2000'),
  },

  // CAPTCHA Solving
  captcha: {
    enabled: process.env.CAPTCHA_ENABLED === 'true',
    apiKey: process.env.CAPTCHA_API_KEY,
    solver: process.env.CAPTCHA_SOLVER || '2captcha',
  },

  // Bulk Parallel Submission
  bulkSubmission: {
    enabled: process.env.BULK_SUBMISSION_ENABLED === 'true',
    parallelBrowsers: parseInt(process.env.PARALLEL_BROWSERS || '5'),
    batchSize: parseInt(process.env.BATCH_SIZE || '20'),
    pauseBetweenBatchesMs: parseInt(process.env.PAUSE_BETWEEN_BATCHES_MS || '60000'),
  },

  // Web Dashboard
  dashboard: {
    enabled: process.env.DASHBOARD_ENABLED === 'true',
    port: parseInt(process.env.DASHBOARD_PORT || '3001'),
    host: process.env.DASHBOARD_HOST || 'localhost',
    username: process.env.DASHBOARD_USERNAME || 'admin',
    password: process.env.DASHBOARD_PASSWORD || 'changeme123',
  },
};

/**
 * Validate configuration
 */
export function validateConfig() {
  const errors = [];

  if (!config.openai.apiKey) {
    errors.push('OPENAI_API_KEY is required in .env file');
  }

  if (!config.website.url) {
    errors.push('WEBSITE_URL is required in .env file');
  }

  if (!config.website.email) {
    errors.push('WEBSITE_EMAIL is required in .env file');
  }

  if (errors.length > 0) {
    throw new Error(`Configuration errors:\n${errors.join('\n')}`);
  }

  return true;
}
