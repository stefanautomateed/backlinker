import { config } from '../config/config.js';
import { AIAnalyzer } from './ai-analyzer.js';
import { captchaSolver } from './captcha-solver.js';

/**
 * Form Filler Service
 * Fills forms based on AI analysis and configuration
 */
export class FormFiller {
  constructor(browser) {
    this.browser = browser;
    this.ai = new AIAnalyzer();
  }

  /**
   * Analyze and fill a form
   */
  async analyzeAndFill(url) {
    try {
      // Get current page HTML
      const html = await this.browser.getHTML();

      // First, analyze the page to see if it has a form
      console.log('  📊 Analyzing page for forms...');
      const pageAnalysis = await this.ai.analyzePage(html, url);

      if (!pageAnalysis.hasForm) {
        return {
          success: false,
          reason: 'No form found on page',
          analysis: pageAnalysis,
        };
      }

      console.log(`  ✓ Form detected: ${pageAnalysis.formType}`);
      console.log(`  ℹ️  Next action: ${pageAnalysis.nextAction}`);

      // Handle different next actions
      if (pageAnalysis.nextAction === 'click_button' && pageAnalysis.buttonText) {
        console.log(`  🖱️  Clicking button: "${pageAnalysis.buttonText}"`);
        await this.clickSubmissionButton(pageAnalysis.buttonText);
        await this.browser.page.waitForTimeout(2000);

        // Re-analyze after clicking
        const newHtml = await this.browser.getHTML();
        const newUrl = await this.browser.getURL();
        return await this.analyzeAndFill(newUrl);
      }

      if (pageAnalysis.nextAction === 'register_first') {
        return {
          success: false,
          reason: 'Registration required',
          analysis: pageAnalysis,
          requiresManual: true,
        };
      }

      // If we can fill the form, analyze it in detail
      console.log('  📋 Analyzing form fields...');
      const formAnalysis = await this.ai.analyzeForm(html, url);

      // Check for CAPTCHA and try to solve it
      if (formAnalysis.captchaDetected) {
        console.log(`  ⚠️  CAPTCHA detected: ${formAnalysis.captchaType}`);

        // Try to solve CAPTCHA if enabled
        if (captchaSolver.isEnabled()) {
          console.log('  🔓 Attempting to solve CAPTCHA...');
          try {
            const captchaInfo = await captchaSolver.detectCaptcha(this.browser.page, url);

            if (captchaInfo) {
              const token = await captchaSolver.solveCaptcha(captchaInfo);
              await captchaSolver.injectCaptchaToken(this.browser.page, captchaInfo, token);
              console.log('  ✓ CAPTCHA solved successfully');

              // Small delay after injecting CAPTCHA token
              await this.browser.page.waitForTimeout(1000);
            } else {
              console.log('  ⚠️  Could not detect CAPTCHA details');
              return {
                success: false,
                reason: `CAPTCHA detected but could not be identified: ${formAnalysis.captchaType}`,
                analysis: formAnalysis,
                requiresManual: true,
              };
            }
          } catch (error) {
            console.log(`  ❌ Failed to solve CAPTCHA: ${error.message}`);
            return {
              success: false,
              reason: `CAPTCHA solving failed: ${error.message}`,
              analysis: formAnalysis,
              requiresManual: true,
            };
          }
        } else {
          console.log('  ⚠️  CAPTCHA solving is disabled');
          return {
            success: false,
            reason: `CAPTCHA detected: ${formAnalysis.captchaType} (solving disabled)`,
            analysis: formAnalysis,
            requiresManual: true,
          };
        }
      }

      // Fill the form
      console.log(`  ✍️  Filling ${formAnalysis.fields.length} form fields...`);
      const fillResult = await this.fillForm(formAnalysis);

      if (!fillResult.success) {
        return {
          success: false,
          reason: 'Failed to fill form',
          analysis: formAnalysis,
          fillResult,
        };
      }

      return {
        success: true,
        analysis: formAnalysis,
        fillResult,
      };
    } catch (error) {
      console.error('  ❌ Error in form analysis/filling:', error.message);
      return {
        success: false,
        reason: error.message,
        error,
      };
    }
  }

  /**
   * Fill form fields based on analysis
   */
  async fillForm(formAnalysis) {
    const filledFields = [];
    const errors = [];

    for (const field of formAnalysis.fields) {
      try {
        const value = this.getFieldValue(field);

        if (!value && field.required) {
          console.log(`  ⚠️  Skipping required field (no value): ${field.label || field.name}`);
          errors.push(`Required field has no value: ${field.label || field.name}`);
          continue;
        }

        if (!value) {
          console.log(`  ⏭️  Skipping optional field: ${field.label || field.name}`);
          continue;
        }

        // Fill the field based on type
        let success = false;
        const selector = field.selector;

        switch (field.type) {
          case 'text':
          case 'email':
          case 'url':
          case 'textarea':
            success = await this.browser.fill(selector, value);
            break;

          case 'select':
            success = await this.browser.select(selector, value);
            break;

          case 'checkbox':
          case 'radio':
            if (value === true || value === 'true' || value === '1') {
              success = await this.browser.check(selector);
            }
            break;

          default:
            console.log(`  ⚠️  Unknown field type: ${field.type}`);
            success = await this.browser.fill(selector, value);
        }

        if (success) {
          filledFields.push({
            field: field.label || field.name,
            value: value.substring(0, 50),
          });
          console.log(`  ✓ Filled: ${field.label || field.name}`);
        } else {
          errors.push(`Failed to fill: ${field.label || field.name}`);
          console.log(`  ❌ Failed to fill: ${field.label || field.name}`);
        }

        // Small delay between fields to appear more human
        await this.browser.page.waitForTimeout(300);
      } catch (error) {
        errors.push(`Error filling ${field.label || field.name}: ${error.message}`);
        console.log(`  ❌ Error filling ${field.label || field.name}: ${error.message}`);
      }
    }

    return {
      success: errors.length === 0,
      filledFields,
      errors,
      formAnalysis,
    };
  }

  /**
   * Get value for a form field based on configuration
   */
  getFieldValue(field) {
    const { suggestedValue, customValue } = field;

    // If custom value is provided, use it
    if (customValue) {
      return customValue;
    }

    // Map suggested value to config
    switch (suggestedValue) {
      case 'website_name':
        return config.website.name;

      case 'website_url':
        return config.website.url;

      case 'website_description':
        return config.website.description;

      case 'contact_email':
        return config.website.email;

      case 'contact_name':
        return config.contact.name;

      case 'company_name':
        return config.contact.company;

      case 'tags':
        return config.website.tags;

      case 'category':
        return config.website.category;

      case 'custom':
        return customValue || '';

      default:
        // Try to infer from field name/label
        return this.inferValueFromField(field);
    }
  }

  /**
   * Infer value from field name/label if no suggestion provided
   */
  inferValueFromField(field) {
    const fieldText = (field.label + ' ' + field.name).toLowerCase();

    if (fieldText.includes('email')) {
      return config.website.email;
    }
    if (fieldText.includes('name') && !fieldText.includes('company')) {
      return config.contact.name;
    }
    if (fieldText.includes('company') || fieldText.includes('organization')) {
      return config.contact.company;
    }
    if (fieldText.includes('url') || fieldText.includes('website') || fieldText.includes('link')) {
      return config.website.url;
    }
    if (fieldText.includes('description') || fieldText.includes('about')) {
      return config.website.description;
    }
    if (fieldText.includes('tag')) {
      return config.website.tags;
    }
    if (fieldText.includes('category')) {
      return config.website.category;
    }

    return '';
  }

  /**
   * Click submission button using text matching
   */
  async clickSubmissionButton(buttonText) {
    try {
      // Try exact text match
      const button = await this.browser.page.getByText(buttonText, { exact: true }).first();
      if (button) {
        await button.click();
        return true;
      }

      // Try partial match
      const partialButton = await this.browser.page.getByText(buttonText).first();
      if (partialButton) {
        await partialButton.click();
        return true;
      }

      return false;
    } catch (error) {
      console.error('Error clicking submission button:', error.message);
      return false;
    }
  }

  /**
   * Submit the form
   */
  async submit(submitButtonSelector) {
    try {
      console.log('  📤 Submitting form...');

      // Store HTML before submission for comparison
      const beforeHtml = await this.browser.getHTML();

      // Click submit button
      const clicked = await this.browser.click(submitButtonSelector);

      if (!clicked) {
        // Try to find and click submit button by type
        const submitClicked = await this.browser.page
          .locator('button[type="submit"], input[type="submit"]')
          .first()
          .click()
          .then(() => true)
          .catch(() => false);

        if (!submitClicked) {
          return {
            success: false,
            reason: 'Could not find submit button',
          };
        }
      }

      // Wait for potential navigation or response
      await this.browser.page.waitForTimeout(3000);

      // Get HTML after submission
      const afterHtml = await this.browser.getHTML();
      const afterUrl = await this.browser.getURL();

      // Verify submission success using AI
      console.log('  🔍 Verifying submission...');
      const verification = await this.ai.verifySubmission(afterHtml, afterUrl, beforeHtml);

      return {
        success: verification.success,
        verification,
        beforeHtml,
        afterHtml,
      };
    } catch (error) {
      console.error('  ❌ Error submitting form:', error.message);
      return {
        success: false,
        reason: error.message,
        error,
      };
    }
  }
}
