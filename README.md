# Backlinker - Automated Directory Submission System

An intelligent automation system that submits your website to 158+ directories, SaaS listing sites, and startup communities using AI-powered form detection and filling.

## Features

- **AI-Powered Form Analysis** - Uses GPT-4 to intelligently analyze pages and detect submission forms
- **Automatic Form Filling** - Automatically fills out forms using your website information
- **Smart Navigation** - Handles multi-page submission flows and button clicks
- **CAPTCHA Detection** - Identifies CAPTCHAs and flags for manual intervention
- **Submission Verification** - AI verifies if submissions were successful
- **Progress Tracking** - SQLite database tracks all submission attempts and results
- **Retry Logic** - Automatic retries with exponential backoff
- **Screenshot Capture** - Takes screenshots on errors for debugging
- **Comprehensive Logging** - Detailed logs of all operations
- **158 Pre-loaded Directories** - Curated list of SaaS, AI tool, and startup directories

## Prerequisites

- Node.js 18 or higher
- OpenAI API key

## Installation

1. **Clone the repository**
```bash
git clone <repository-url>
cd backlinker
```

2. **Install dependencies**
```bash
npm install
```

3. **Install Playwright browsers**
```bash
npx playwright install chromium
```

4. **Configure environment variables**
```bash
cp .env.example .env
```

Edit `.env` and add your configuration:
```env
OPENAI_API_KEY=your_openai_api_key_here

WEBSITE_URL=https://automateed.com
WEBSITE_NAME=Automateed
WEBSITE_DESCRIPTION=AI-powered e-book generator
WEBSITE_EMAIL=stefan@automateed.com
CONTACT_NAME=Stefan
```

5. **Initialize the database**
```bash
npm start init
```

## Usage

### Check Status

View the current status of all directories:

```bash
npm start status
```

Filter by status:
```bash
npm start status -- --status pending
npm start status -- --status success
npm start status -- --status failed
npm start status -- --status requires_manual
```

### Start Submissions

Submit to pending directories (default: first 10):

```bash
npm start submit
```

Submit to more directories:
```bash
npm start submit -- --limit 50
```

Submit to all pending directories:
```bash
npm start submit -- --limit 0
```

Submit to specific directory by ID:
```bash
npm start submit -- --id 5
```

Retry failed submissions:
```bash
npm start submit -- --status failed --limit 10
```

### Test Single Directory

Test the system on a single directory URL:

```bash
npm start test https://betalist.com
```

### List Directories

List all directories:
```bash
npm start list
```

Filter by category:
```bash
npm start list -- --category "AI tools"
```

### Reset Status

Reset specific directory to pending:
```bash
npm start reset -- --id 5
```

Reset all failed directories:
```bash
npm start reset -- --status failed
```

Reset all directories:
```bash
npm start reset -- --all
```

## How It Works

### 1. Page Analysis
- Navigates to the directory URL
- Extracts HTML content
- Sends to GPT-4 for analysis
- Determines if submission form exists
- Identifies form type (listing, contact, review, etc.)
- Detects if it's free or paid

### 2. Form Detection
- Analyzes form structure
- Identifies all form fields
- Maps fields to your website data
- Detects required vs optional fields
- Checks for CAPTCHAs

### 3. Form Filling
- Fills fields with appropriate data:
  - Website name, URL, description
  - Contact email and name
  - Company name
  - Tags and categories
- Handles different input types:
  - Text inputs, textareas
  - Select dropdowns
  - Checkboxes, radio buttons

### 4. Submission
- Clicks submit button
- Waits for response
- Captures result page

### 5. Verification
- Analyzes result page
- Looks for success messages
- Verifies submission completion
- Updates database with status

### 6. Status Tracking

Results are categorized as:

- **Success** ✅ - Submission completed successfully
- **Failed** ❌ - Submission failed (will retry)
- **Requires Manual** ⚠️ - Needs human intervention (CAPTCHA, registration, payment)
- **Uncertain** ❓ - Submission completed but success unclear
- **Pending** ⏳ - Not yet attempted

## Directory Structure

```
backlinker/
├── src/
│   ├── config/
│   │   └── config.js              # Configuration management
│   ├── data/
│   │   └── directories.json       # 158 directory listings
│   ├── database/
│   │   └── db.js                  # SQLite database operations
│   ├── services/
│   │   ├── ai-analyzer.js         # OpenAI GPT-4 integration
│   │   ├── browser.js             # Playwright browser automation
│   │   ├── form-filler.js         # Form detection and filling
│   │   └── submission-orchestrator.js  # Main workflow coordinator
│   ├── utils/
│   │   ├── directory-loader.js    # Directory list loader
│   │   └── logger.js              # Winston logging
│   └── index.js                   # CLI interface
├── logs/                          # Log files
├── screenshots/                   # Error screenshots
├── .env                           # Environment configuration
├── package.json
└── README.md
```

## Configuration Options

### Automation Settings

```env
MAX_CONCURRENT_SUBMISSIONS=3       # How many submissions to run in parallel
HEADLESS_BROWSER=true             # Run browser in headless mode
SCREENSHOT_ON_ERROR=true          # Take screenshots on errors
RETRY_ATTEMPTS=2                  # Number of retry attempts
TIMEOUT_MS=30000                  # Page load timeout (30 seconds)
```

### Rate Limiting

```env
DELAY_BETWEEN_SUBMISSIONS_MS=5000  # Wait 5s between submissions
DELAY_BETWEEN_PAGES_MS=2000       # Wait 2s between page navigations
```

## Success Rate

**Expected Success Rate: 40-60%**

Some directories will require manual intervention due to:
- CAPTCHA protection
- User registration requirements
- Payment requirements
- Complex multi-step workflows
- Email verification
- Manual approval processes

The system will identify these and flag them as "requires_manual" with screenshots for easy manual completion.

## Database

The system uses SQLite to track:

- **Directories** - All 158 directories with status
- **Submissions** - Each submission attempt with results
- **Analysis Logs** - AI analysis results for debugging

Database file: `backlinker.db`

## Logs

Logs are saved in the `logs/` directory:

- `combined.log` - All logs
- `error.log` - Error logs only
- `submissions.log` - Submission results

## Screenshots

Screenshots are automatically captured in `screenshots/` directory when:
- Errors occur
- CAPTCHA is detected
- Submission result is uncertain
- Manual intervention is required

## Troubleshooting

### OpenAI API Errors

If you get OpenAI API errors:
- Check your API key is correct
- Ensure you have sufficient credits
- Check your rate limits

### Browser Errors

If Playwright fails to launch:
```bash
npx playwright install chromium --with-deps
```

### Database Issues

Reset the database:
```bash
rm backlinker.db
npm start init
```

## Cost Estimation

**OpenAI API Costs (GPT-4 Turbo)**:
- ~$0.01-0.03 per directory submission
- For 158 directories: ~$2-5 total

Costs vary based on page complexity and whether retries are needed.

## Best Practices

1. **Start Small** - Test with 5-10 directories first
2. **Review Results** - Check screenshots for failed submissions
3. **Manual Follow-up** - Complete flagged submissions manually
4. **Verify Success** - Check success emails and verify listings
5. **Rate Limiting** - Use appropriate delays to avoid being blocked
6. **Monitor Logs** - Review logs for issues and patterns

## Limitations

- Cannot bypass CAPTCHAs (requires manual intervention)
- Cannot handle payment forms automatically
- Cannot complete email verification automatically
- May struggle with very complex JavaScript-heavy forms
- Success depends on consistent form structures

## Contributing

This is a private automation tool. Suggestions and improvements welcome!

## License

MIT License

## Disclaimer

This tool automates form submissions to public directories. Always:
- Respect website terms of service
- Use appropriate rate limiting
- Don't abuse or spam directories
- Verify your submissions are wanted/appropriate
- Review and complete manual interventions

The authors are not responsible for misuse of this tool.

## Support

For issues or questions:
1. Check the logs in `logs/` directory
2. Review screenshots in `screenshots/` directory
3. Check database status with `npm start status`
4. Review error messages and retry logic

## Roadmap

Future enhancements:
- [ ] CAPTCHA solving integration (2Captcha, Anti-Captcha)
- [ ] Email verification automation
- [ ] Support for login/registration flows
- [ ] Web dashboard for monitoring
- [ ] Export reports (CSV, PDF)
- [ ] Notification system (email, Slack)
- [ ] Proxy support for IP rotation
- [ ] Custom directory list management
