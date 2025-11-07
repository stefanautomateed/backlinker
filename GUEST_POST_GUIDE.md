# Guest Post Automation Feature

Automatically find guest post opportunities, generate AI-written articles about Automateed.com, and submit them to target sites.

## 🎯 Overview

This feature extends Backlinker to:
1. **Search Google** for guest posting opportunities ("write for us", "submit guest post", etc.)
2. **Generate high-quality articles** using GPT-4 about Automateed.com
3. **Automatically submit** articles to those sites
4. **Track everything** in the database

## 🚀 Quick Start

### 1. Get API Keys

**SerpAPI (Recommended)**
- Sign up at https://serpapi.com
- 100 free searches/month
- Then $50 for 5000 searches ($0.01/search)

**OR Google Custom Search API**
- Create project at https://console.developers.google.com
- Enable Custom Search API
- Get API key and Search Engine ID
- Free: 100 searches/day

### 2. Configure Environment

Add to your `.env` file:

```env
# Required
GUEST_POST_ENABLED=true
GUEST_POST_SEARCH_ENGINE=serpapi
GUEST_POST_SEARCH_API_KEY=your_serpapi_key_here

# Optional
GUEST_POST_CONTENT_MODEL=gpt-4-turbo-preview
GUEST_POST_NICHE=AI tools, SaaS, content creation
GUEST_POST_WORD_COUNT=1500
```

### 3. Usage Examples

#### Find Guest Post Sites

```javascript
import { googleSearchService } from './src/services/google-search.js';

// Find 50 guest post opportunities
const sites = await googleSearchService.findGuestPostSites('AI tools', 50);

console.log(`Found ${sites.length} guest post opportunities`);
sites.forEach(site => {
  console.log(`- ${site.title}`);
  console.log(`  ${site.url}`);
});
```

#### Generate an Article

```javascript
import { contentGenerator } from './src/services/content-generator.js';

// Generate a guest post about Automateed
const article = await contentGenerator.generateGuestPost({
  targetSite: 'TechCrunch',
  targetAudience: 'Tech entrepreneurs',
  topic: 'AI tools for content creation',
  wordCount: 1500,
  tone: 'professional and informative',
});

console.log(`Generated: ${article.title}`);
console.log(`Word count: ${article.wordCount}`);
console.log(`Tags: ${article.tags.join(', ')}`);
```

#### Bulk Article Generation

```javascript
// Generate 5 articles with different topics
const articles = await contentGenerator.generateBulkArticles(5, {
  targetAudience: 'Content creators and marketers',
  tone: 'engaging and practical',
});

console.log(`Generated ${articles.length} articles`);
```

### 4. Database Operations

```javascript
import { BacklinkerDB } from './src/database/db.js';

const db = new BacklinkerDB();

// Save a discovered site
const siteId = db.addGuestPostSite({
  url: 'https://example.com/write-for-us',
  title: 'Example Blog - Write For Us',
  snippet: 'We accept guest posts...',
  query: 'AI tools "write for us"',
  isVerified: true,
  score: 8,
  hasForm: true,
});

// Save a generated article
const articleId = db.saveGeneratedArticle(article);

// Create a submission
const submissionId = db.createGuestPostSubmission(siteId, articleId);

// Get statistics
const stats = db.getGuestPostStats();
console.log(`Total sites: ${stats.totalSites}`);
console.log(`Total articles: ${stats.totalArticles}`);
console.log(`Successful submissions: ${stats.submissions.success}`);
```

## 📊 Features

### Google Search Service

**Capabilities:**
- Searches multiple query variations
- Deduplicates results
- Filters spam/low-quality sites
- Verifies if pages actually accept guest posts
- Supports SerpAPI and Google Custom Search API

**Search queries generated:**
- "{niche} write for us"
- "{niche} submit a guest post"
- "{niche} contribute to our blog"
- "{niche} guest post guidelines"
- "{niche} become a contributor"
- "{niche} submit an article"
- "{niche} inurl:write-for-us"
- And more...

### Content Generator

**Article Generation:**
- Uses GPT-4 for high-quality content
- Naturally mentions Automateed.com
- Includes SEO optimization
- Generates multiple title options
- Creates meta descriptions
- Includes author bio
- Generates relevant tags
- HTML formatted with proper headings

**Customization:**
- Target specific sites
- Adjust word count (500-3000 words)
- Set tone (professional, casual, technical, etc.)
- Specify target audience
- Choose topics

### Database Tracking

**Three new tables:**
1. `guest_post_sites` - Discovered opportunities
2. `generated_articles` - AI-generated content
3. `guest_post_submissions` - Submission attempts and results

**Full tracking:**
- Search queries used
- Site verification scores
- Form detection
- Contact emails found
- Submission success/failure
- Screenshots
- Notes

## 💰 Cost Estimation

### Finding Sites (SerpAPI)
- **Per search:** $0.01
- **For 50 sites:** ~$0.10 (10 queries)
- **Free tier:** 100 searches/month

### Generating Articles (GPT-4)
- **Per 1500-word article:** ~$0.15-0.30
- **For 10 articles:** ~$1.50-3.00
- **Bulk generation:** Slightly cheaper

### Total for Full Campaign
- **Find 50 sites:** $0.10
- **Generate 20 articles:** $3-6
- **Total:** $3-7 for complete guest posting campaign

## 📈 Expected Results

### Success Rates

**Site Discovery:**
- 50-100 potential sites found per niche
- 60-80% are actual guest post pages
- 30-50% have submission forms

**Article Quality:**
- Professional, publishable content
- SEO-optimized
- Naturally promotional (not spammy)
- 1500-2000 words typical

**Submission Success:**
- Form submissions: 50-70% success
- Email submissions: Depends on manual follow-up
- Total backlinks gained: 10-30 out of 50 attempts

## 🛠️ Advanced Usage

### Custom Site Verification

```javascript
// Verify if a site actually accepts guest posts
const verification = await googleSearchService.verifyGuestPostPage(
  'https://example.com/write-for-us'
);

if (verification.isValid) {
  console.log(`✓ Valid guest post page (score: ${verification.score})`);
  console.log(`Has form: ${verification.hasForm}`);
  console.log(`Contact emails: ${verification.contactEmails.join(', ')}`);
}
```

### Generate for Specific Site

```javascript
// Generate article tailored to specific site's guidelines
const customArticle = await contentGenerator.generateCustomArticle(
  {
    siteName: 'TechCrunch',
    siteUrl: 'https://techcrunch.com',
    guidelines: 'Focus on innovation, 800-1200 words',
    preferredTopics: 'AI, startups, technology',
    minWords: 800,
    maxWords: 1200,
  },
  {
    topic: 'How AI is revolutionizing content creation',
    tone: 'professional and insightful',
  }
);
```

### Filter Quality Sites

```javascript
// Remove low-quality or spam sites
const qualitySites = googleSearchService.filterQualitySites(allResults);
```

## 📝 Article Structure

Generated articles include:

```html
<h2>Introduction</h2>
<p>Engaging opening paragraph...</p>

<h2>Main Content Section 1</h2>
<p>Detailed information...</p>

<h3>Subsection</h3>
<p>More specific details...</p>

<h2>How Automateed Fits In</h2>
<p>Natural mention of Automateed.com as a solution...</p>

<h2>Practical Tips</h2>
<ul>
  <li>Actionable tip 1</li>
  <li>Actionable tip 2</li>
</ul>

<h2>Conclusion</h2>
<p>Summary and CTA...</p>
```

**Author Bio:**
```
Stefan is a tech entrepreneur and founder of Automateed, an AI-powered
content creation platform. He is passionate about helping creators
leverage AI to scale their content production.
```

## 🎯 Best Practices

### Finding Sites
1. **Start with your niche** - Be specific (e.g., "AI tools" not just "technology")
2. **Verify sites** - Use the verification function before submitting
3. **Check DA/DR** - Target sites with good domain authority
4. **Read guidelines** - Every site has different requirements

### Generating Content
1. **Quality over quantity** - Generate fewer, better articles
2. **Customize per site** - Tailor content to each site's audience
3. **Don't over-promote** - Keep Automateed mentions natural (10-15% of content)
4. **Include value** - Provide actionable insights, not just promotion

### Submitting
1. **Follow guidelines** - Respect word counts and formatting rules
2. **Personalize** - Add a personal note when submitting
3. **Be patient** - Guest posts can take weeks to be approved
4. **Track results** - Monitor which sites give the best backlinks

## 🚧 Current Limitations

### What's NOT Automated (Yet)
- **Email follow-ups** - Need to manually send articles via email
- **Registration** - Can't auto-register on sites requiring accounts
- **Phone verification** - Can't handle sites requiring phone numbers
- **Payment** - Can't submit to paid guest post opportunities

### Manual Steps Required
1. Sites without forms - need to email directly
2. Sites requiring registration - create account manually first
3. Sites with complex editors - may need to format differently
4. Follow-up communications - need to respond to editors manually

## 🔄 Workflow Example

**Complete Guest Post Campaign:**

```javascript
// 1. Find opportunities
const sites = await googleSearchService.findGuestPostSites('AI tools', 50);

// 2. Verify quality sites
const verifiedSites = [];
for (const site of sites) {
  const verification = await googleSearchService.verifyGuestPostPage(site.url);
  if (verification.isValid && verification.score >= 3) {
    verifiedSites.push({...site, ...verification});
  }
}

// 3. Generate articles
const articles = await contentGenerator.generateBulkArticles(
  Math.min(10, verifiedSites.length)
);

// 4. Save to database
const db = new BacklinkerDB();
verifiedSites.forEach(site => db.addGuestPostSite(site));
articles.forEach(article => db.saveGeneratedArticle(article));

// 5. Match articles to sites and submit
// (This part would use the existing submission orchestrator)

// 6. Track results
const stats = db.getGuestPostStats();
console.log('Campaign Results:', stats);
```

## 📚 Next Steps

To fully integrate this feature:

1. **Create orchestrator** - Combine search, generation, and submission
2. **Add CLI commands** - `npm start guest-post:search`, etc.
3. **Dashboard integration** - View/manage guest posts in web UI
4. **Email templates** - For sites without forms
5. **Follow-up automation** - Track approval status

## 💡 Tips for Success

### SEO Benefits
- Guest posts build high-quality backlinks
- Diversifies your backlink profile
- Increases domain authority
- Drives referral traffic

### Content Strategy
- Write for the audience, not yourself
- Provide real value
- Use data and examples
- Include visuals when possible

### Outreach Strategy
- Build relationships with editors
- Follow up politely after 2 weeks
- Share published posts on social media
- Engage with comments on your articles

## 🆘 Troubleshooting

**No sites found:**
- Try different niche keywords
- Use more specific queries
- Check your API key is valid

**Low-quality articles:**
- Adjust temperature in GPT-4 settings
- Provide more specific prompts
- Use GPT-4 (not GPT-3.5) for better quality

**Submission failures:**
- Check form detection accuracy
- Verify site is still accepting posts
- Review screenshot for errors
- Try manual submission first

## 📞 Support

For issues with this feature:
1. Check API keys are configured
2. Verify sufficient API credits
3. Review logs for error messages
4. Check database for saved data
5. Test individual components separately

---

**Ready to start?** Get your SerpAPI key and start discovering guest post opportunities!
