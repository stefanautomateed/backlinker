import axios from 'axios';
import { config } from '../config/config.js';
import { logger } from '../utils/logger.js';

/**
 * CAPTCHA Solver Service
 * Integrates with 2captcha.com to solve CAPTCHAs automatically
 */

const TWOCAPTCHA_API_URL = 'https://2captcha.com';
const POLL_INTERVAL = 5000; // 5 seconds
const MAX_POLL_ATTEMPTS = 60; // 5 minutes max wait time

class CaptchaSolver {
  constructor() {
    this.apiKey = config.captcha.apiKey;
    this.enabled = config.captcha.enabled;
    this.solver = config.captcha.solver;
  }

  /**
   * Check if CAPTCHA solving is enabled and configured
   */
  isEnabled() {
    return this.enabled && this.apiKey;
  }

  /**
   * Solve reCAPTCHA v2
   * @param {string} siteKey - The site key from the CAPTCHA
   * @param {string} pageUrl - The URL where the CAPTCHA is located
   * @returns {Promise<string>} - The solved CAPTCHA token
   */
  async solveRecaptchaV2(siteKey, pageUrl) {
    if (!this.isEnabled()) {
      throw new Error('CAPTCHA solving is not enabled or configured');
    }

    logger.info(`Solving reCAPTCHA v2 for ${pageUrl}`);

    try {
      // Submit CAPTCHA to 2captcha
      const taskId = await this.submitRecaptchaV2(siteKey, pageUrl);

      // Poll for result
      const solution = await this.pollForSolution(taskId);

      logger.info(`Successfully solved reCAPTCHA v2 for ${pageUrl}`);
      return solution;
    } catch (error) {
      logger.error(`Failed to solve reCAPTCHA v2: ${error.message}`);
      throw error;
    }
  }

  /**
   * Solve reCAPTCHA v3
   * @param {string} siteKey - The site key from the CAPTCHA
   * @param {string} pageUrl - The URL where the CAPTCHA is located
   * @param {string} action - The action name (optional)
   * @returns {Promise<string>} - The solved CAPTCHA token
   */
  async solveRecaptchaV3(siteKey, pageUrl, action = 'submit') {
    if (!this.isEnabled()) {
      throw new Error('CAPTCHA solving is not enabled or configured');
    }

    logger.info(`Solving reCAPTCHA v3 for ${pageUrl}`);

    try {
      const taskId = await this.submitRecaptchaV3(siteKey, pageUrl, action);
      const solution = await this.pollForSolution(taskId);

      logger.info(`Successfully solved reCAPTCHA v3 for ${pageUrl}`);
      return solution;
    } catch (error) {
      logger.error(`Failed to solve reCAPTCHA v3: ${error.message}`);
      throw error;
    }
  }

  /**
   * Solve hCaptcha
   * @param {string} siteKey - The site key from the CAPTCHA
   * @param {string} pageUrl - The URL where the CAPTCHA is located
   * @returns {Promise<string>} - The solved CAPTCHA token
   */
  async solveHCaptcha(siteKey, pageUrl) {
    if (!this.isEnabled()) {
      throw new Error('CAPTCHA solving is not enabled or configured');
    }

    logger.info(`Solving hCaptcha for ${pageUrl}`);

    try {
      const taskId = await this.submitHCaptcha(siteKey, pageUrl);
      const solution = await this.pollForSolution(taskId);

      logger.info(`Successfully solved hCaptcha for ${pageUrl}`);
      return solution;
    } catch (error) {
      logger.error(`Failed to solve hCaptcha: ${error.message}`);
      throw error;
    }
  }

  /**
   * Submit reCAPTCHA v2 task to 2captcha
   */
  async submitRecaptchaV2(siteKey, pageUrl) {
    const response = await axios.post(`${TWOCAPTCHA_API_URL}/in.php`, null, {
      params: {
        key: this.apiKey,
        method: 'userrecaptcha',
        googlekey: siteKey,
        pageurl: pageUrl,
        json: 1,
      },
    });

    if (response.data.status === 0) {
      throw new Error(`2captcha error: ${response.data.request}`);
    }

    return response.data.request; // Task ID
  }

  /**
   * Submit reCAPTCHA v3 task to 2captcha
   */
  async submitRecaptchaV3(siteKey, pageUrl, action) {
    const response = await axios.post(`${TWOCAPTCHA_API_URL}/in.php`, null, {
      params: {
        key: this.apiKey,
        method: 'userrecaptcha',
        version: 'v3',
        googlekey: siteKey,
        pageurl: pageUrl,
        action: action,
        json: 1,
      },
    });

    if (response.data.status === 0) {
      throw new Error(`2captcha error: ${response.data.request}`);
    }

    return response.data.request;
  }

  /**
   * Submit hCaptcha task to 2captcha
   */
  async submitHCaptcha(siteKey, pageUrl) {
    const response = await axios.post(`${TWOCAPTCHA_API_URL}/in.php`, null, {
      params: {
        key: this.apiKey,
        method: 'hcaptcha',
        sitekey: siteKey,
        pageurl: pageUrl,
        json: 1,
      },
    });

    if (response.data.status === 0) {
      throw new Error(`2captcha error: ${response.data.request}`);
    }

    return response.data.request;
  }

  /**
   * Poll 2captcha for solution
   */
  async pollForSolution(taskId) {
    for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
      await this.sleep(POLL_INTERVAL);

      try {
        const response = await axios.get(`${TWOCAPTCHA_API_URL}/res.php`, {
          params: {
            key: this.apiKey,
            action: 'get',
            id: taskId,
            json: 1,
          },
        });

        if (response.data.status === 1) {
          // Solution ready
          return response.data.request;
        }

        if (response.data.request !== 'CAPCHA_NOT_READY') {
          throw new Error(`2captcha error: ${response.data.request}`);
        }

        // Still processing, continue polling
        logger.debug(`CAPTCHA not ready yet, attempt ${attempt + 1}/${MAX_POLL_ATTEMPTS}`);
      } catch (error) {
        if (error.response) {
          logger.error(`2captcha API error: ${error.response.data}`);
        }
        throw error;
      }
    }

    throw new Error('CAPTCHA solving timeout - exceeded maximum wait time');
  }

  /**
   * Get account balance from 2captcha
   */
  async getBalance() {
    if (!this.isEnabled()) {
      return null;
    }

    try {
      const response = await axios.get(`${TWOCAPTCHA_API_URL}/res.php`, {
        params: {
          key: this.apiKey,
          action: 'getbalance',
          json: 1,
        },
      });

      if (response.data.status === 1) {
        return parseFloat(response.data.request);
      }

      return null;
    } catch (error) {
      logger.error(`Failed to get 2captcha balance: ${error.message}`);
      return null;
    }
  }

  /**
   * Detect CAPTCHA type on a page
   * @param {Object} page - Playwright page object
   * @param {string} url - Current page URL
   * @returns {Promise<Object|null>} - CAPTCHA info or null
   */
  async detectCaptcha(page, url) {
    try {
      // Check for reCAPTCHA v2
      const recaptchaV2 = await page.evaluate(() => {
        const iframe = document.querySelector('iframe[src*="google.com/recaptcha"]');
        if (iframe) {
          const siteKey = iframe.src.match(/k=([^&]+)/)?.[1];
          return siteKey ? { type: 'recaptcha_v2', siteKey } : null;
        }
        return null;
      });

      if (recaptchaV2) {
        return { ...recaptchaV2, url };
      }

      // Check for reCAPTCHA v3
      const recaptchaV3 = await page.evaluate(() => {
        const scripts = Array.from(document.querySelectorAll('script'));
        for (const script of scripts) {
          const match = script.textContent?.match(/grecaptcha\.execute\('([^']+)'/);
          if (match) {
            return { type: 'recaptcha_v3', siteKey: match[1] };
          }
        }
        return null;
      });

      if (recaptchaV3) {
        return { ...recaptchaV3, url };
      }

      // Check for hCaptcha
      const hcaptcha = await page.evaluate(() => {
        const hcaptchaDiv = document.querySelector('[data-sitekey]');
        if (hcaptchaDiv && hcaptchaDiv.className.includes('h-captcha')) {
          return { type: 'hcaptcha', siteKey: hcaptchaDiv.getAttribute('data-sitekey') };
        }
        return null;
      });

      if (hcaptcha) {
        return { ...hcaptcha, url };
      }

      return null;
    } catch (error) {
      logger.error(`Error detecting CAPTCHA: ${error.message}`);
      return null;
    }
  }

  /**
   * Solve detected CAPTCHA
   * @param {Object} captchaInfo - CAPTCHA information from detectCaptcha
   * @returns {Promise<string>} - Solved CAPTCHA token
   */
  async solveCaptcha(captchaInfo) {
    const { type, siteKey, url } = captchaInfo;

    switch (type) {
      case 'recaptcha_v2':
        return this.solveRecaptchaV2(siteKey, url);

      case 'recaptcha_v3':
        return this.solveRecaptchaV3(siteKey, url);

      case 'hcaptcha':
        return this.solveHCaptcha(siteKey, url);

      default:
        throw new Error(`Unsupported CAPTCHA type: ${type}`);
    }
  }

  /**
   * Inject solved CAPTCHA token into page
   * @param {Object} page - Playwright page object
   * @param {Object} captchaInfo - CAPTCHA information
   * @param {string} token - Solved CAPTCHA token
   */
  async injectCaptchaToken(page, captchaInfo, token) {
    const { type } = captchaInfo;

    try {
      if (type === 'recaptcha_v2' || type === 'recaptcha_v3') {
        await page.evaluate((token) => {
          // Set the response token
          document.getElementById('g-recaptcha-response')?.setAttribute('value', token);

          // Trigger callback if exists
          if (window.grecaptcha && window.grecaptcha.getResponse) {
            window.grecaptcha.getResponse = () => token;
          }
        }, token);
      } else if (type === 'hcaptcha') {
        await page.evaluate((token) => {
          document.querySelector('[name="h-captcha-response"]')?.setAttribute('value', token);
          document.querySelector('[name="g-recaptcha-response"]')?.setAttribute('value', token);
        }, token);
      }

      logger.info(`Successfully injected ${type} token into page`);
    } catch (error) {
      logger.error(`Failed to inject CAPTCHA token: ${error.message}`);
      throw error;
    }
  }

  /**
   * Sleep helper
   */
  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Export singleton instance
export const captchaSolver = new CaptchaSolver();
