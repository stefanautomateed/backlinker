# Quick Start Guide

Get up and running with Backlinker in 5 minutes!

## Step 1: Install Dependencies (1 min)

```bash
npm install
npx playwright install chromium
```

## Step 2: Configure (2 min)

Create `.env` file:

```bash
cp .env.example .env
```

Edit `.env` and add your OpenAI API key:

```env
OPENAI_API_KEY=sk-...your-key-here...

WEBSITE_URL=https://automateed.com
WEBSITE_NAME=Automateed
WEBSITE_DESCRIPTION=AI-powered e-book generator that transforms your ideas into professionally formatted e-books
WEBSITE_EMAIL=stefan@automateed.com
CONTACT_NAME=Stefan
```

## Step 3: Initialize (30 sec)

Load the 158 directories into the database:

```bash
npm start init
```

## Step 4: Run! (1 min)

Start with a test on a single directory:

```bash
npm start test https://betalist.com
```

Or start batch submissions (first 5 directories):

```bash
npm start submit -- --limit 5
```

## Step 5: Check Results

View status:

```bash
npm start status
```

See detailed results:

```bash
npm start status -- --status success
npm start status -- --status requires_manual
```

## What's Next?

- Review screenshots in `screenshots/` folder for failed submissions
- Manually complete submissions flagged as "requires_manual"
- Scale up: `npm start submit -- --limit 50`
- Check logs in `logs/` directory

## Quick Commands Cheat Sheet

```bash
# View all directories
npm start list

# Submit to first 10 pending
npm start submit

# Submit to all pending
npm start submit -- --limit 0

# Check overall stats
npm start status

# Test specific URL
npm start test https://example.com

# Reset failed to retry
npm start reset -- --status failed

# Reset all
npm start reset -- --all
```

## Expected Results

After running submissions:
- ✅ **40-60% Success** - Fully automated
- ⚠️ **20-30% Requires Manual** - CAPTCHA, registration, payment
- ❌ **10-20% Failed** - Technical issues (will retry)
- ❓ **10-20% Uncertain** - Needs verification

## Tips

1. Start small (5-10) to test your configuration
2. Review "requires_manual" submissions and complete them manually
3. Use appropriate delays to avoid rate limiting
4. Monitor OpenAI API usage and costs
5. Check email for verification links from submitted directories

## Troubleshooting

**Error: OPENAI_API_KEY is required**
- Add your API key to `.env` file

**Error: Browser failed to launch**
- Run: `npx playwright install chromium --with-deps`

**Low success rate**
- Check screenshots to see what's happening
- Some directories may have changed their submission process
- Increase timeout in `.env`: `TIMEOUT_MS=60000`

**Getting rate limited**
- Increase delays in `.env`:
  ```
  DELAY_BETWEEN_SUBMISSIONS_MS=10000
  DELAY_BETWEEN_PAGES_MS=3000
  ```

## Support

1. Check logs: `cat logs/combined.log`
2. Check screenshots: `ls screenshots/`
3. Review status: `npm start status`
4. Reset and retry: `npm start reset -- --status failed`

Happy backlinking! 🚀
