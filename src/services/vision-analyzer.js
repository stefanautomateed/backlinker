import OpenAI from 'openai';
import { config } from '../config/config.js';
import { logger } from '../utils/logger.js';
import fs from 'fs';

/**
 * Vision Analyzer Service
 * Uses GPT-4 Vision to analyze screenshots and debug form submission issues
 * This is the "AI sees what's wrong" feature
 */

class VisionAnalyzer {
  constructor() {
    this.openai = new OpenAI({
      apiKey: config.openai.apiKey,
    });
    this.model = 'gpt-4o'; // GPT-4 with vision
    this.maxIterations = 5; // Max debugging attempts
  }

  /**
   * Analyze a screenshot to understand what's happening on the page
   * @param {string} screenshotPath - Path to screenshot file
   * @param {string} context - What we were trying to do
   * @returns {Promise<Object>} - AI analysis with next steps
   */
  async analyzeScreenshot(screenshotPath, context = '') {
    try {
      logger.info(`Analyzing screenshot: ${screenshotPath}`);

      // Read screenshot as base64
      const imageBuffer = fs.readFileSync(screenshotPath);
      const base64Image = imageBuffer.toString('base64');

      const prompt = `You are an expert at analyzing web forms and debugging submission issues.

CONTEXT: ${context}

Analyze this screenshot and tell me:
1. What type of page is this? (submission form, error page, success page, login page, etc.)
2. What form fields are visible?
3. Are there any error messages? If yes, what do they say?
4. Is there a CAPTCHA? If yes, what type?
5. Are there any required fields that appear empty?
6. Is there a submit button? What does it say?
7. What should we do next to successfully submit?

Provide your analysis in JSON format:
{
  "pageType": "form/error/success/login/other",
  "formFields": [{"name": "field name", "type": "text/email/etc", "filled": true/false, "required": true/false}],
  "errors": ["error message 1", "error message 2"],
  "captcha": {"detected": true/false, "type": "recaptcha_v2/recaptcha_v3/hcaptcha/none"},
  "missingRequiredFields": ["field1", "field2"],
  "submitButton": {"text": "Submit", "visible": true/false},
  "nextAction": "fill_field_X / solve_captcha / click_button / fix_error / success / registration_required",
  "recommendation": "Detailed explanation of what to do next",
  "confidence": 0.95
}`;

      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: prompt,
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/png;base64,${base64Image}`,
                  detail: 'high',
                },
              },
            ],
          },
        ],
        max_tokens: 1000,
        temperature: 0.3,
      });

      const analysis = JSON.parse(response.choices[0].message.content);

      logger.info(`Vision analysis complete: ${analysis.pageType}`);
      logger.info(`Next action: ${analysis.nextAction}`);

      return analysis;
    } catch (error) {
      logger.error(`Vision analysis failed: ${error.message}`);
      return {
        pageType: 'error',
        nextAction: 'manual_review',
        recommendation: `AI analysis failed: ${error.message}`,
        confidence: 0,
      };
    }
  }

  /**
   * Analyze form submission failure and suggest fixes
   * @param {string} screenshotPath - Screenshot of failed state
   * @param {Object} previousAnalysis - Previous attempt's analysis
   * @param {Array} attemptHistory - History of what we've tried
   * @returns {Promise<Object>} - Recovery strategy
   */
  async analyzeFailure(screenshotPath, previousAnalysis = null, attemptHistory = []) {
    try {
      const imageBuffer = fs.readFileSync(screenshotPath);
      const base64Image = imageBuffer.toString('base64');

      const prompt = `You are debugging a failed form submission.

PREVIOUS ATTEMPTS:
${attemptHistory.map((h, i) => `Attempt ${i + 1}: ${h.action} - Result: ${h.result}`).join('\n')}

${previousAnalysis ? `PREVIOUS ANALYSIS:\n${JSON.stringify(previousAnalysis, null, 2)}` : ''}

Looking at this screenshot, analyze:
1. Why did the submission fail?
2. What specific error is shown?
3. What field(s) need to be corrected?
4. Is there a validation error?
5. Is the form waiting for something (CAPTCHA, verification, etc.)?

Provide a specific action plan in JSON:
{
  "failureReason": "Specific reason for failure",
  "errorMessages": ["visible error 1", "visible error 2"],
  "problematicFields": [{"field": "email", "issue": "invalid format", "suggestedValue": "user@example.com"}],
  "blockers": ["captcha_required", "registration_needed", "payment_required"],
  "recoveryAction": {
    "type": "retry/fix_field/solve_captcha/give_up",
    "specificSteps": ["Step 1", "Step 2"],
    "fieldChanges": [{"selector": "#email", "newValue": "correct@email.com"}]
  },
  "shouldRetry": true/false,
  "confidence": 0.85
}`;

      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: prompt,
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/png;base64,${base64Image}`,
                  detail: 'high',
                },
              },
            ],
          },
        ],
        max_tokens: 1200,
        temperature: 0.2,
      });

      const recovery = JSON.parse(response.choices[0].message.content);

      logger.info(`Failure analysis: ${recovery.failureReason}`);
      logger.info(`Should retry: ${recovery.shouldRetry}`);

      return recovery;
    } catch (error) {
      logger.error(`Failure analysis failed: ${error.message}`);
      return {
        failureReason: 'Could not analyze failure',
        shouldRetry: false,
        recoveryAction: { type: 'give_up' },
      };
    }
  }

  /**
   * Compare before/after screenshots to detect changes
   * @param {string} beforePath - Screenshot before action
   * @param {string} afterPath - Screenshot after action
   * @returns {Promise<Object>} - Change analysis
   */
  async compareScreenshots(beforePath, afterPath) {
    try {
      const beforeBuffer = fs.readFileSync(beforePath);
      const afterBuffer = fs.readFileSync(afterPath);
      const base64Before = beforeBuffer.toString('base64');
      const base64After = afterBuffer.toString('base64');

      const prompt = `Compare these two screenshots (before and after an action).

Analyze:
1. What changed between the screenshots?
2. Did we navigate to a new page?
3. Are there new error messages?
4. Are there new form fields?
5. Did the submission succeed?
6. Is there a success message?

Return JSON:
{
  "changedDetected": true/false,
  "changes": ["Form submitted", "New page loaded", "Error appeared"],
  "pageTransition": true/false,
  "newErrors": ["error1", "error2"],
  "successIndicators": ["Thank you message visible", "Confirmation shown"],
  "appearSuccessful": true/false,
  "nextRecommendation": "What to do next"
}`;

      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: prompt,
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/png;base64,${base64Before}`,
                  detail: 'high',
                },
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/png;base64,${base64After}`,
                  detail: 'high',
                },
              },
            ],
          },
        ],
        max_tokens: 800,
        temperature: 0.3,
      });

      return JSON.parse(response.choices[0].message.content);
    } catch (error) {
      logger.error(`Screenshot comparison failed: ${error.message}`);
      return {
        changedDetected: false,
        appearSuccessful: false,
      };
    }
  }

  /**
   * Iterative debugging - AI guides us through fixing the form
   * @param {Object} browser - Browser instance
   * @param {string} url - Current URL
   * @param {Object} formData - Data to submit
   * @returns {Promise<Object>} - Final result after iterations
   */
  async iterativeDebug(browser, url, formData) {
    const attemptHistory = [];
    let currentAnalysis = null;

    for (let iteration = 0; iteration < this.maxIterations; iteration++) {
      logger.info(`\n🔍 AI Debugging Iteration ${iteration + 1}/${this.maxIterations}`);

      try {
        // Take screenshot
        const screenshotPath = await browser.screenshot(
          `debug_iter${iteration}_${Date.now()}.png`
        );

        // Analyze current state
        const analysis = await this.analyzeScreenshot(
          screenshotPath,
          `Iteration ${iteration + 1}: Trying to submit guest post form`
        );

        currentAnalysis = analysis;

        // Check if we're done
        if (analysis.pageType === 'success' || analysis.nextAction === 'success') {
          logger.info('✅ AI detected success!');
          return {
            success: true,
            iterations: iteration + 1,
            finalAnalysis: analysis,
            history: attemptHistory,
          };
        }

        // Check if we should give up
        if (
          analysis.nextAction === 'registration_required' ||
          analysis.nextAction === 'manual_review' ||
          analysis.confidence < 0.5
        ) {
          logger.info(`⚠️ AI recommends manual review: ${analysis.recommendation}`);
          return {
            success: false,
            reason: analysis.recommendation,
            iterations: iteration + 1,
            requiresManual: true,
            finalAnalysis: analysis,
            history: attemptHistory,
          };
        }

        // Execute AI's recommended action
        logger.info(`🤖 AI recommends: ${analysis.nextAction}`);
        logger.info(`📋 Details: ${analysis.recommendation}`);

        const actionResult = await this.executeRecommendedAction(
          browser,
          analysis,
          formData
        );

        attemptHistory.push({
          iteration: iteration + 1,
          action: analysis.nextAction,
          result: actionResult.success ? 'success' : 'failed',
          details: actionResult.details,
        });

        // Wait for page to update
        await browser.page.waitForTimeout(2000);

        // If action failed, get failure analysis
        if (!actionResult.success) {
          const failureScreenshot = await browser.screenshot(
            `failure_iter${iteration}_${Date.now()}.png`
          );

          const recovery = await this.analyzeFailure(
            failureScreenshot,
            analysis,
            attemptHistory
          );

          if (!recovery.shouldRetry) {
            logger.info('🛑 AI recommends stopping');
            return {
              success: false,
              reason: recovery.failureReason,
              iterations: iteration + 1,
              finalAnalysis: recovery,
              history: attemptHistory,
            };
          }

          // Try recovery actions
          if (recovery.recoveryAction.fieldChanges) {
            for (const change of recovery.recoveryAction.fieldChanges) {
              await browser.fill(change.selector, change.newValue);
            }
          }
        }
      } catch (error) {
        logger.error(`Iteration ${iteration + 1} error: ${error.message}`);
        attemptHistory.push({
          iteration: iteration + 1,
          action: 'error',
          result: 'exception',
          details: error.message,
        });
      }
    }

    // Max iterations reached
    logger.info(`⏰ Max iterations reached (${this.maxIterations})`);
    return {
      success: false,
      reason: 'Max debugging iterations reached',
      iterations: this.maxIterations,
      finalAnalysis: currentAnalysis,
      history: attemptHistory,
    };
  }

  /**
   * Execute the action recommended by AI
   */
  async executeRecommendedAction(browser, analysis, formData) {
    try {
      switch (analysis.nextAction) {
        case 'fill_field':
        case 'fill_missing_fields':
          // Fill any missing required fields
          for (const field of analysis.missingRequiredFields || []) {
            const value = this.getFieldValue(field, formData);
            if (value) {
              await browser.fill(`[name="${field}"]`, value);
              logger.info(`✓ Filled field: ${field}`);
            }
          }
          return { success: true, details: 'Fields filled' };

        case 'click_button':
        case 'submit':
          // Click the submit button
          if (analysis.submitButton?.text) {
            await browser.page.getByText(analysis.submitButton.text).first().click();
            logger.info(`✓ Clicked: ${analysis.submitButton.text}`);
          } else {
            await browser.page.locator('button[type="submit"]').first().click();
            logger.info('✓ Clicked submit button');
          }
          return { success: true, details: 'Button clicked' };

        case 'solve_captcha':
          logger.info('⏳ CAPTCHA detected - attempting to solve...');
          // This would integrate with captcha-solver.js
          return { success: false, details: 'CAPTCHA requires solving' };

        case 'fix_error':
          // Try to fix errors based on AI's analysis
          for (const field of analysis.problematicFields || []) {
            if (field.suggestedValue) {
              await browser.fill(`[name="${field.field}"]`, field.suggestedValue);
              logger.info(`✓ Fixed field: ${field.field}`);
            }
          }
          return { success: true, details: 'Errors fixed' };

        default:
          logger.info(`⚠️ Unknown action: ${analysis.nextAction}`);
          return { success: false, details: 'Unknown action' };
      }
    } catch (error) {
      logger.error(`Action execution failed: ${error.message}`);
      return { success: false, details: error.message };
    }
  }

  /**
   * Get field value from form data
   */
  getFieldValue(fieldName, formData) {
    const fieldLower = fieldName.toLowerCase();

    if (fieldLower.includes('email')) return formData.email;
    if (fieldLower.includes('name')) return formData.name;
    if (fieldLower.includes('title')) return formData.articleTitle;
    if (fieldLower.includes('content') || fieldLower.includes('article') || fieldLower.includes('post')) {
      return formData.content;
    }
    if (fieldLower.includes('url') || fieldLower.includes('website')) return formData.website;
    if (fieldLower.includes('bio')) return formData.authorBio;

    return null;
  }

  /**
   * Estimate cost for vision analysis
   */
  estimateCost(numScreenshots) {
    // GPT-4 Vision: ~$0.01-0.03 per image depending on detail level
    return numScreenshots * 0.02;
  }
}

// Export singleton instance
export const visionAnalyzer = new VisionAnalyzer();
