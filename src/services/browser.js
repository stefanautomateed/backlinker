import { chromium } from 'playwright';
import { config } from '../config/config.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Browser Automation Service
 * Handles all Playwright browser operations
 */
export class BrowserService {
  constructor() {
    this.browser = null;
    this.context = null;
    this.page = null;
  }

  /**
   * Initialize browser
   */
  async init() {
    this.browser = await chromium.launch({
      headless: config.automation.headlessBrowser,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    this.context = await this.browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    });

    this.page = await this.context.newPage();
    this.page.setDefaultTimeout(config.automation.timeoutMs);

    return this.page;
  }

  /**
   * Navigate to URL
   */
  async navigate(url) {
    if (!this.page) {
      await this.init();
    }

    try {
      await this.page.goto(url, {
        waitUntil: 'networkidle',
        timeout: config.automation.timeoutMs,
      });

      // Wait a bit for any dynamic content to load
      await this.page.waitForTimeout(config.rateLimiting.delayBetweenPagesMs);

      return true;
    } catch (error) {
      console.error(`Error navigating to ${url}:`, error.message);
      return false;
    }
  }

  /**
   * Get page HTML content
   */
  async getHTML() {
    if (!this.page) {
      throw new Error('Browser not initialized');
    }
    return await this.page.content();
  }

  /**
   * Get page URL
   */
  async getURL() {
    if (!this.page) {
      throw new Error('Browser not initialized');
    }
    return this.page.url();
  }

  /**
   * Take screenshot
   */
  async screenshot(filename) {
    if (!this.page) {
      throw new Error('Browser not initialized');
    }

    const screenshotsDir = join(__dirname, '../../screenshots');
    const fs = await import('fs');
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true });
    }

    const filepath = join(screenshotsDir, filename);
    await this.page.screenshot({ path: filepath, fullPage: true });
    return filepath;
  }

  /**
   * Click an element
   */
  async click(selector) {
    if (!this.page) {
      throw new Error('Browser not initialized');
    }

    try {
      await this.page.waitForSelector(selector, { timeout: 10000 });
      await this.page.click(selector);
      await this.page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
      await this.page.waitForTimeout(config.rateLimiting.delayBetweenPagesMs);
      return true;
    } catch (error) {
      console.error(`Error clicking ${selector}:`, error.message);
      return false;
    }
  }

  /**
   * Fill form field
   */
  async fill(selector, value) {
    if (!this.page) {
      throw new Error('Browser not initialized');
    }

    try {
      await this.page.waitForSelector(selector, { timeout: 10000 });
      await this.page.fill(selector, value);
      return true;
    } catch (error) {
      console.error(`Error filling ${selector}:`, error.message);
      return false;
    }
  }

  /**
   * Select dropdown option
   */
  async select(selector, value) {
    if (!this.page) {
      throw new Error('Browser not initialized');
    }

    try {
      await this.page.waitForSelector(selector, { timeout: 10000 });
      await this.page.selectOption(selector, value);
      return true;
    } catch (error) {
      console.error(`Error selecting ${selector}:`, error.message);
      return false;
    }
  }

  /**
   * Check checkbox or radio button
   */
  async check(selector) {
    if (!this.page) {
      throw new Error('Browser not initialized');
    }

    try {
      await this.page.waitForSelector(selector, { timeout: 10000 });
      await this.page.check(selector);
      return true;
    } catch (error) {
      console.error(`Error checking ${selector}:`, error.message);
      return false;
    }
  }

  /**
   * Type text with delay (more human-like)
   */
  async type(selector, text, delayMs = 50) {
    if (!this.page) {
      throw new Error('Browser not initialized');
    }

    try {
      await this.page.waitForSelector(selector, { timeout: 10000 });
      await this.page.type(selector, text, { delay: delayMs });
      return true;
    } catch (error) {
      console.error(`Error typing in ${selector}:`, error.message);
      return false;
    }
  }

  /**
   * Check if element exists
   */
  async exists(selector) {
    if (!this.page) {
      throw new Error('Browser not initialized');
    }

    try {
      const element = await this.page.$(selector);
      return element !== null;
    } catch (error) {
      return false;
    }
  }

  /**
   * Wait for selector
   */
  async waitForSelector(selector, timeoutMs = 10000) {
    if (!this.page) {
      throw new Error('Browser not initialized');
    }

    try {
      await this.page.waitForSelector(selector, { timeout: timeoutMs });
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Evaluate JavaScript on page
   */
  async evaluate(fn, ...args) {
    if (!this.page) {
      throw new Error('Browser not initialized');
    }
    return await this.page.evaluate(fn, ...args);
  }

  /**
   * Get all form fields on the page
   */
  async getFormFields() {
    if (!this.page) {
      throw new Error('Browser not initialized');
    }

    return await this.page.evaluate(() => {
      const fields = [];
      const inputs = document.querySelectorAll('input, textarea, select');

      inputs.forEach((input, index) => {
        const field = {
          tag: input.tagName.toLowerCase(),
          type: input.type || 'text',
          name: input.name || '',
          id: input.id || '',
          placeholder: input.placeholder || '',
          required: input.required || false,
          value: input.value || '',
          label: '',
        };

        // Try to find associated label
        if (input.id) {
          const label = document.querySelector(`label[for="${input.id}"]`);
          if (label) {
            field.label = label.textContent.trim();
          }
        }

        // If no label found, look for parent label
        if (!field.label) {
          const parentLabel = input.closest('label');
          if (parentLabel) {
            field.label = parentLabel.textContent.trim();
          }
        }

        fields.push(field);
      });

      return fields;
    });
  }

  /**
   * Check for CAPTCHA
   */
  async hasCaptcha() {
    if (!this.page) {
      throw new Error('Browser not initialized');
    }

    const captchaSelectors = [
      '[class*="captcha"]',
      '[id*="captcha"]',
      '.g-recaptcha',
      '[class*="recaptcha"]',
      '.h-captcha',
      '[class*="hcaptcha"]',
    ];

    for (const selector of captchaSelectors) {
      if (await this.exists(selector)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Close browser
   */
  async close() {
    if (this.page) {
      await this.page.close().catch(() => {});
    }
    if (this.context) {
      await this.context.close().catch(() => {});
    }
    if (this.browser) {
      await this.browser.close().catch(() => {});
    }
    this.page = null;
    this.context = null;
    this.browser = null;
  }
}
