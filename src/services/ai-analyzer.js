import OpenAI from 'openai';
import { config } from '../config/config.js';

/**
 * AI Analyzer Service
 * Uses OpenAI GPT-4 to analyze web pages and forms
 */
export class AIAnalyzer {
  constructor() {
    this.openai = new OpenAI({
      apiKey: config.openai.apiKey,
    });
  }

  /**
   * Analyze a page to determine if it has a submission form
   */
  async analyzePage(html, url) {
    try {
      const prompt = `You are a web scraping expert analyzing a webpage to find submission/listing forms.

URL: ${url}

Analyze this HTML and determine:
1. Does this page have a form for submitting/listing a product, tool, or website?
2. If yes, what type of form is it? (contact form, listing submission, review submission, etc.)
3. Is it free or paid submission?
4. Are there any obvious requirements or restrictions?
5. What is the next action needed? (fill form on this page, click a button to go to submission page, register first, etc.)

HTML Content (truncated to first 50000 chars):
${html.substring(0, 50000)}

Respond in JSON format:
{
  "hasForm": boolean,
  "formType": "listing|contact|review|signup|other",
  "isFree": boolean|null,
  "isPaid": boolean|null,
  "nextAction": "fill_form|click_button|register_first|navigate_to_page|unknown",
  "buttonText": "text of button to click if nextAction is click_button",
  "registrationRequired": boolean,
  "notes": "any important observations",
  "confidence": "high|medium|low"
}`;

      const response = await this.openai.chat.completions.create({
        model: config.openai.model,
        messages: [
          {
            role: 'system',
            content: 'You are a web scraping expert. Analyze HTML and provide structured JSON responses.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
      });

      const result = JSON.parse(response.choices[0].message.content);
      return result;
    } catch (error) {
      console.error('Error in AI page analysis:', error.message);
      throw error;
    }
  }

  /**
   * Analyze a form to understand its fields and structure
   */
  async analyzeForm(html, url) {
    try {
      const prompt = `You are a web form expert analyzing a submission form.

URL: ${url}

Analyze this form HTML and identify:
1. All form fields (name, email, url, description, etc.)
2. Required vs optional fields
3. Field types (text, textarea, select, radio, checkbox, etc.)
4. Any validation requirements
5. Submit button selector
6. Any special instructions or requirements

HTML Content (truncated to first 50000 chars):
${html.substring(0, 50000)}

Respond in JSON format:
{
  "fields": [
    {
      "name": "field name or id",
      "label": "human readable label",
      "type": "text|email|url|textarea|select|radio|checkbox|file",
      "required": boolean,
      "selector": "CSS selector to find this field",
      "suggestedValue": "which config value to use: website_name|website_url|website_description|contact_email|contact_name|company_name|tags|category|custom",
      "customValue": "if suggestedValue is custom, what value to use",
      "validationRules": "any validation rules mentioned"
    }
  ],
  "submitButton": "CSS selector for submit button",
  "formSelector": "CSS selector for the form element",
  "captchaDetected": boolean,
  "captchaType": "recaptcha|hcaptcha|custom|none",
  "additionalNotes": "any special requirements or observations"
}`;

      const response = await this.openai.chat.completions.create({
        model: config.openai.model,
        messages: [
          {
            role: 'system',
            content: 'You are a web form expert. Analyze forms and provide structured JSON responses with field mappings.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
      });

      const result = JSON.parse(response.choices[0].message.content);
      return result;
    } catch (error) {
      console.error('Error in AI form analysis:', error.message);
      throw error;
    }
  }

  /**
   * Verify if submission was successful
   */
  async verifySubmission(html, url, previousHtml = null) {
    try {
      const prompt = `You are analyzing a webpage to determine if a form submission was successful.

URL: ${url}

Look for success indicators such as:
- Success messages ("thank you", "submitted successfully", "we received your submission")
- Redirect to a success page
- Confirmation text
- Changes in the page content compared to before submission

${previousHtml ? `Previous HTML (before submission, truncated):\n${previousHtml.substring(0, 20000)}\n\n` : ''}

Current HTML (after submission, truncated):
${html.substring(0, 30000)}

Respond in JSON format:
{
  "success": boolean,
  "confidence": "high|medium|low",
  "reason": "explanation of why you think it succeeded or failed",
  "successMessage": "the success message found, if any",
  "nextSteps": "any next steps mentioned (email verification, approval process, etc.)"
}`;

      const response = await this.openai.chat.completions.create({
        model: config.openai.model,
        messages: [
          {
            role: 'system',
            content: 'You are a web automation expert. Analyze pages to determine submission success.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
      });

      const result = JSON.parse(response.choices[0].message.content);
      return result;
    } catch (error) {
      console.error('Error in AI verification:', error.message);
      throw error;
    }
  }

  /**
   * Determine next navigation action
   */
  async determineNextAction(html, url, goal) {
    try {
      const prompt = `You are analyzing a webpage to determine the next navigation step.

URL: ${url}
Goal: ${goal}

Analyze the page and determine what action to take next to achieve the goal.

HTML Content (truncated):
${html.substring(0, 50000)}

Respond in JSON format:
{
  "action": "click|navigate|fill_form|wait|complete",
  "selector": "CSS selector if action is click",
  "url": "URL if action is navigate",
  "reason": "explanation of the action",
  "confidence": "high|medium|low"
}`;

      const response = await this.openai.chat.completions.create({
        model: config.openai.model,
        messages: [
          {
            role: 'system',
            content: 'You are a web navigation expert. Analyze pages and determine next actions.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
      });

      const result = JSON.parse(response.choices[0].message.content);
      return result;
    } catch (error) {
      console.error('Error in AI action determination:', error.message);
      throw error;
    }
  }
}
