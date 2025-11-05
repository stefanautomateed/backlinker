# Project Structure

Complete overview of the Backlinker automation system.

## Architecture

```
┌─────────────────┐
│   CLI (index)   │  - Commander.js interface
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
┌───▼────┐  ┌▼────────────┐
│Database│  │Orchestrator  │  - Main workflow coordinator
└────────┘  └──────┬───────┘
                   │
        ┌──────────┼──────────┐
        │          │          │
    ┌───▼───┐  ┌──▼──┐   ┌───▼────┐
    │Browser│  │  AI  │   │Logger  │
    │Service│  │Analyzer  │        │
    └───┬───┘  └──▲──┘   └────────┘
        │         │
    ┌───▼─────────┴───┐
    │  Form Filler    │  - Coordinates browser + AI
    └─────────────────┘
```

## File Structure

### Core Application

#### `src/index.js` (Main CLI)
- Command-line interface using Commander.js
- Commands: init, status, submit, test, list, reset
- Entry point for all operations

#### `src/config/config.js`
- Loads environment variables from .env
- Configuration validation
- Exports config object with all settings

### Services Layer

#### `src/services/submission-orchestrator.js`
**Purpose**: Main workflow coordinator
- Orchestrates entire submission process
- Manages retry logic with exponential backoff
- Handles concurrent submissions with queue
- Coordinates browser, AI, and database
- Generates summary reports

**Key Methods**:
- `submitToDirectory()` - Submit to single directory
- `submitToDirectories()` - Batch submissions with retry
- `printSummary()` - Display results summary

#### `src/services/browser.js`
**Purpose**: Browser automation wrapper for Playwright
- Manages Chromium browser lifecycle
- Page navigation and interaction
- Form field detection and filling
- Screenshot capture
- CAPTCHA detection

**Key Methods**:
- `init()` - Launch browser
- `navigate(url)` - Go to URL
- `fill()`, `select()`, `check()` - Form interactions
- `getFormFields()` - Extract all form fields
- `screenshot()` - Capture page image

#### `src/services/ai-analyzer.js`
**Purpose**: OpenAI GPT-4 integration
- Analyzes pages for submission forms
- Analyzes form structure and fields
- Verifies submission success
- Determines next navigation actions

**Key Methods**:
- `analyzePage()` - Detect forms and submission flow
- `analyzeForm()` - Map form fields to config values
- `verifySubmission()` - Check if submission succeeded
- `determineNextAction()` - Decide next step

**AI Prompts**:
1. **Page Analysis**: Detects form presence, type, free/paid status
2. **Form Analysis**: Maps fields to values, detects CAPTCHA
3. **Verification**: Checks success messages and confirms submission
4. **Navigation**: Determines next action (click, navigate, fill)

#### `src/services/form-filler.js`
**Purpose**: Form filling logic
- Coordinates browser and AI services
- Fills forms based on AI analysis
- Maps config values to form fields
- Handles multi-page flows
- Submits forms and verifies

**Key Methods**:
- `analyzeAndFill()` - Complete analyze + fill workflow
- `fillForm()` - Fill all fields in a form
- `getFieldValue()` - Map config to field value
- `submit()` - Submit form and verify

### Database Layer

#### `src/database/db.js`
**Purpose**: SQLite database operations
- Manages 3 tables: directories, submissions, analysis_logs
- CRUD operations for all entities
- Status tracking and statistics

**Tables**:
1. **directories** - 158 directory listings with status
2. **submissions** - Each submission attempt with results
3. **analysis_logs** - AI analysis results for debugging

**Key Methods**:
- `upsertDirectory()` - Add/update directory
- `createSubmission()` - Start new submission
- `updateSubmission()` - Update submission result
- `getStats()` - Get overall statistics

### Utilities

#### `src/utils/directory-loader.js`
**Purpose**: Load directories from JSON
- Reads directories.json file
- Inserts into database
- Provides query functions

#### `src/utils/logger.js`
**Purpose**: Winston logging setup
- 3 log files: combined.log, error.log, submissions.log
- Structured JSON logging
- Helper functions for common log patterns

### Data

#### `src/data/directories.json`
**Purpose**: Master list of 158 directories
- Pre-researched directory list
- Categorized by type
- URLs and metadata

**Categories**:
- SaaS review/directory (Capterra, TechnologyAdvice, etc.)
- Startup communities (BetaList, F6S, IndieHackers, etc.)
- Design galleries (OnePageLove, Land-Book, etc.)
- AI tool directories (Supertools, Fazier, ToolFinder, etc.)
- General listings (Dev.to, HackerNews, etc.)

## Data Flow

### Submission Flow

1. **CLI Command**
   ```
   User runs: npm start submit --limit 10
   ```

2. **Orchestrator Initialization**
   ```
   - Load directories from DB (status=pending, limit=10)
   - Initialize queue with concurrency=3
   - Start processing
   ```

3. **For Each Directory**
   ```
   a. Update directory status to "in_progress"
   b. Create submission record
   c. Launch browser
   d. Navigate to URL
   ```

4. **Form Analysis**
   ```
   a. Get page HTML
   b. Send to AI for page analysis
   c. Determine if form exists, type, next action
   d. If needs click/navigation, do it and re-analyze
   ```

5. **Form Filling**
   ```
   a. Send HTML to AI for form field analysis
   b. Get field mappings (name→config_value)
   c. Fill each field with appropriate value
   d. Check for CAPTCHA (if found, flag as manual)
   ```

6. **Submission**
   ```
   a. Click submit button
   b. Wait for response
   c. Get result page HTML
   ```

7. **Verification**
   ```
   a. Send result HTML to AI
   b. AI checks for success indicators
   c. Determine success/failure/uncertain
   d. Take screenshot if not success
   ```

8. **Update Records**
   ```
   a. Update submission with result
   b. Update directory status
   c. Log to Winston
   d. Close browser
   ```

9. **Retry Logic** (if failed)
   ```
   a. Wait with exponential backoff (5s, 10s, 20s)
   b. Retry up to maxRetries times
   c. Only retry if status=failed (not manual/uncertain)
   ```

10. **Summary**
    ```
    - Print results table
    - List manual interventions needed
    - Update database
    - Exit
    ```

## Configuration Values

### Website Data (from .env)
```javascript
{
  website: {
    url: "https://automateed.com",
    name: "Automateed",
    description: "AI-powered e-book generator...",
    email: "stefan@automateed.com",
    category: "AI Tools, SaaS, Content Creation",
    tags: "AI, ebook, generator, automation"
  },
  contact: {
    name: "Stefan",
    company: "Automateed"
  }
}
```

### Field Mapping Logic

AI suggests field mappings like:
```javascript
{
  name: "website_url",
  label: "Your Website",
  type: "url",
  selector: "#website-url",
  suggestedValue: "website_url",  // Maps to config.website.url
  required: true
}
```

Form filler maps to config:
```
website_name → config.website.name
website_url → config.website.url
website_description → config.website.description
contact_email → config.website.email
contact_name → config.contact.name
company_name → config.contact.company
tags → config.website.tags
category → config.website.category
```

## Status States

### Directory Status
- **pending** - Not yet attempted
- **in_progress** - Currently processing
- **success** - Successfully submitted
- **failed** - Failed (will retry)
- **requires_manual** - Needs human intervention
- **uncertain** - Completed but success unclear

### Submission Status
- **in_progress** - Currently submitting
- **success** - Verified successful
- **failed** - Failed submission
- **requires_manual** - CAPTCHA, registration, payment required
- **uncertain** - Submission sent but verification unclear

## Error Handling

### Automatic Retry
- Network errors
- Timeout errors
- Temporary page load issues
- Button click failures

### Flag as Manual
- CAPTCHA detected
- Registration required
- Payment required
- Complex multi-step requiring login

### Screenshot Capture
- All errors
- CAPTCHA detection
- Uncertain results
- Manual intervention needed

## Performance

### Concurrency
- Default: 3 concurrent submissions
- Configurable via `MAX_CONCURRENT_SUBMISSIONS`
- Uses p-queue for rate limiting

### Rate Limiting
- 5s delay between submissions
- 2s delay between page navigations
- Exponential backoff on retries (5s, 10s, 20s)

### Timeouts
- Page load: 30s default
- Element wait: 10s default
- Network idle: 15s default

## AI Prompts

### 1. Page Analysis Prompt
```
Input: HTML + URL
Task: Detect submission forms
Output: JSON with form type, next action, requirements
```

### 2. Form Analysis Prompt
```
Input: HTML + URL
Task: Map form fields to values
Output: JSON with field list, selectors, value mappings
```

### 3. Verification Prompt
```
Input: Before HTML + After HTML + URL
Task: Determine if submission succeeded
Output: JSON with success status, confidence, reason
```

### 4. Navigation Prompt
```
Input: HTML + URL + Goal
Task: Determine next action to achieve goal
Output: JSON with action type and parameters
```

## Database Schema

### directories table
```sql
id INTEGER PRIMARY KEY
name TEXT
url TEXT UNIQUE
category TEXT
status TEXT DEFAULT 'pending'
created_at DATETIME
updated_at DATETIME
```

### submissions table
```sql
id INTEGER PRIMARY KEY
directory_id INTEGER
status TEXT DEFAULT 'pending'
attempt_count INTEGER DEFAULT 0
last_attempt_at DATETIME
success_at DATETIME
error_message TEXT
page_html TEXT
form_data TEXT
screenshot_path TEXT
notes TEXT
created_at DATETIME
updated_at DATETIME
```

### analysis_logs table
```sql
id INTEGER PRIMARY KEY
directory_id INTEGER
submission_id INTEGER
analysis_type TEXT
result TEXT
created_at DATETIME
```

## Extension Points

### Adding New Directories
1. Add to `src/data/directories.json`
2. Run `npm start init` to reload
3. Submit with `npm start submit`

### Custom Field Mappings
Edit `getFieldValue()` in `src/services/form-filler.js`

### Custom AI Prompts
Edit prompts in `src/services/ai-analyzer.js`

### Additional Commands
Add to `src/index.js` using Commander.js

### Database Queries
Add methods to `src/database/db.js`

## Security Considerations

- API keys in .env (never commit)
- User-agent spoofing for bot detection
- Rate limiting to avoid blocks
- Respects robots.txt implicitly
- No CAPTCHA bypass (requires manual)

## Cost Estimation

### OpenAI API (GPT-4 Turbo)
- Page analysis: ~5K tokens = $0.005
- Form analysis: ~8K tokens = $0.008
- Verification: ~6K tokens = $0.006
- **Total per submission: ~$0.02**
- **158 directories: ~$3-5**

### Variations
- Simple pages: $0.01
- Complex pages: $0.03
- Retries add cost
- Failed submissions use less tokens

## Future Enhancements

1. **CAPTCHA Solving**
   - Integrate 2Captcha or Anti-Captcha API
   - Add solving logic to browser service

2. **Email Verification**
   - IMAP integration for verification links
   - Automated link clicking

3. **Login Support**
   - Session management
   - Cookie persistence
   - OAuth flows

4. **Web Dashboard**
   - Real-time monitoring
   - Result visualization
   - Manual intervention UI

5. **Reporting**
   - CSV/PDF exports
   - Email reports
   - Slack notifications

6. **Proxy Support**
   - IP rotation
   - Residential proxies
   - Avoid rate limits
