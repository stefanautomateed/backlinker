# Backlinker - Automated Directory Submission System

An intelligent automation system that submits your website to 158+ directories, SaaS listing sites, and startup communities using AI-powered form detection, CAPTCHA solving, and parallel processing.

## ✨ Features

### 🤖 AI-Powered Automation
- **GPT-4 Form Analysis** - Intelligently analyzes pages and detects submission forms
- **Automatic Form Filling** - Fills out forms using your website information
- **Smart Navigation** - Handles multi-page submission flows and button clicks
- **Submission Verification** - AI verifies if submissions were successful

### 🔓 CAPTCHA Solving
- **Automatic CAPTCHA Detection** - Identifies reCAPTCHA v2, v3, and hCaptcha
- **2captcha Integration** - Automatically solves CAPTCHAs (~$0.002 per solve)
- **High Success Rate** - Dramatically increases automation success rate

### ⚡ Parallel Processing
- **Bulk Submission Mode** - Process multiple directories simultaneously
- **Configurable Concurrency** - Run 5+ browsers in parallel
- **Batch Processing** - Submit to 100+ directories efficiently
- **Smart Rate Limiting** - Avoid detection with configurable delays

### 📊 Web Dashboard
- **Real-Time Monitoring** - Live activity feed of submissions
- **Visual Statistics** - Track success, failures, and manual reviews
- **Remote Control** - Start, pause, and resume submissions
- **REST API** - Full API for integration

### 📈 Advanced Tracking
- **SQLite Database** - Comprehensive tracking of all attempts
- **Retry Logic** - Automatic retries with exponential backoff
- **Screenshot Capture** - Visual debugging for failures
- **Detailed Logging** - Winston-powered logging system
- **158 Pre-loaded Directories** - Curated list of SaaS, AI tool, and startup directories

## 📋 Prerequisites

- Node.js 18 or higher
- OpenAI API key (GPT-4 access)
- (Optional) 2captcha API key for CAPTCHA solving

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
# Required
OPENAI_API_KEY=your_openai_api_key_here
WEBSITE_URL=https://yoursite.com
WEBSITE_NAME=Your Site Name
WEBSITE_EMAIL=your@email.com

# Optional - CAPTCHA Solving (highly recommended)
CAPTCHA_ENABLED=true
CAPTCHA_API_KEY=your_2captcha_api_key_here

# Optional - Parallel Processing (recommended for bulk)
BULK_SUBMISSION_ENABLED=true
PARALLEL_BROWSERS=5
BATCH_SIZE=20

# Optional - Web Dashboard
DASHBOARD_ENABLED=true
DASHBOARD_PORT=3001
DASHBOARD_USERNAME=admin
DASHBOARD_PASSWORD=changeme123
```

5. **Initialize the database**
```bash
npm start init
```

## 🚀 Usage

### 🌐 Web Dashboard (Recommended)

The easiest way to use Backlinker is through the web dashboard:

```bash
npm run dashboard
```

Then open http://localhost:3001 in your browser.

**Dashboard Features:**
- 📊 Real-time statistics and progress
- ▶️ Start/pause/resume submissions
- 🔄 Reset failed directories
- 📈 Live activity feed
- 💰 CAPTCHA balance monitoring

Default credentials: `admin` / `changeme123`

### 📟 Command Line Interface

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

**With bulk/parallel mode enabled, submissions run 5x faster!**

Submit to more directories:
```bash
npm start submit -- --limit 50
```

Submit to ALL pending directories:
```bash
npm start submit -- --limit 0
```

The system automatically uses parallel processing for 6+ directories when enabled.

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

## ⚙️ Configuration Options

### Basic Automation Settings

```env
HEADLESS_BROWSER=true             # Run browser in headless mode
SCREENSHOT_ON_ERROR=true          # Take screenshots on errors
RETRY_ATTEMPTS=2                  # Number of retry attempts per directory
TIMEOUT_MS=30000                  # Page load timeout (30 seconds)
```

### 🔓 CAPTCHA Solving (Recommended)

```env
CAPTCHA_ENABLED=true              # Enable automatic CAPTCHA solving
CAPTCHA_API_KEY=your_key          # Get from 2captcha.com
CAPTCHA_SOLVER=2captcha           # Solver service (currently only 2captcha)
```

**Cost:** ~$0.002 per CAPTCHA (~$3 per 1000 CAPTCHAs)
**Success Rate Improvement:** 40-60% → 70-85%

Sign up at https://2captcha.com

### ⚡ Parallel/Bulk Processing (Recommended)

```env
BULK_SUBMISSION_ENABLED=true      # Enable parallel processing
PARALLEL_BROWSERS=5               # Run 5 browsers concurrently
BATCH_SIZE=20                     # Process 20 directories per batch
PAUSE_BETWEEN_BATCHES_MS=60000    # 1 minute pause between batches
```

**Speed Improvement:** Process 100 directories in ~30 minutes instead of 2+ hours

### 📊 Web Dashboard

```env
DASHBOARD_ENABLED=true            # Enable web dashboard
DASHBOARD_PORT=3001               # Port for dashboard
DASHBOARD_HOST=localhost          # Host for dashboard
DASHBOARD_USERNAME=admin          # Dashboard login username
DASHBOARD_PASSWORD=changeme123    # Dashboard login password (CHANGE THIS!)
```

### Rate Limiting

```env
DELAY_BETWEEN_SUBMISSIONS_MS=5000  # Wait 5s between submissions (sequential mode)
DELAY_BETWEEN_PAGES_MS=2000       # Wait 2s between page navigations
```

**Note:** In parallel mode, these delays apply per browser instance.

## 📈 Success Rate

### Without CAPTCHA Solving
**Expected Success Rate: 40-60%** (60-90 successful out of 158)

### With CAPTCHA Solving (Recommended)
**Expected Success Rate: 70-85%** (110-135 successful out of 158)

### Directories Requiring Manual Intervention

Some directories still require manual intervention due to:
- User registration requirements (can't automate email verification)
- Payment requirements (paid listings)
- Complex multi-step workflows with dynamic content
- Email verification links
- Manual approval processes
- Phone number verification

The system identifies these and flags them as "requires_manual" with screenshots for easy manual completion.

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

## 💰 Cost Estimation

### OpenAI API Costs (GPT-4 Turbo)
- **Per submission:** ~$0.01-0.03
- **For 158 directories:** ~$2-5 total

### 2captcha Costs (Optional)
- **Per CAPTCHA:** ~$0.002
- **Estimated for 158 directories:** ~$0.50-1.50 (25-50% have CAPTCHAs)

### Total Cost for Full Automation
- **Without CAPTCHA solving:** $2-5
- **With CAPTCHA solving:** $2.50-6.50

**Return on Investment:** Manual submission to 158 directories would take 20-40 hours. This system does it in 30-90 minutes for $2-7.

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

## 🎯 Feature Comparison

### Basic Mode (Free)
- ✅ Sequential processing (1 at a time)
- ✅ AI form detection & filling
- ✅ 40-60% success rate
- ✅ CLI interface
- ⏱️ Time: 2-3 hours for 158 directories

### Advanced Mode (Recommended)
- ✅ Parallel processing (5 browsers)
- ✅ CAPTCHA solving integration
- ✅ Web dashboard
- ✅ 70-85% success rate
- ✅ Real-time monitoring
- ⏱️ Time: 30-60 minutes for 158 directories
- 💰 Cost: +$2-3 for CAPTCHAs

## 🗺️ Roadmap

Completed:
- [x] CAPTCHA solving integration (2captcha)
- [x] Parallel/bulk processing
- [x] Web dashboard for monitoring
- [x] REST API for integration

Future enhancements:
- [ ] Email verification automation
- [ ] Support for login/registration flows
- [ ] Export reports (CSV, PDF)
- [ ] Notification system (email, Slack, Discord)
- [ ] Proxy support for IP rotation
- [ ] Custom directory list management UI
- [ ] Support for more CAPTCHA solvers (Anti-Captcha, CapMonster)
