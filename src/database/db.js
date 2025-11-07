import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DB_PATH = join(__dirname, '../../backlinker.db');

/**
 * Initialize SQLite database with schema
 */
export class BacklinkerDB {
  constructor() {
    this.db = new Database(DB_PATH);
    this.init();
  }

  /**
   * Initialize database schema
   */
  init() {
    // Create directories table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS directories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        url TEXT NOT NULL UNIQUE,
        category TEXT,
        status TEXT DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create submissions table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS submissions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        directory_id INTEGER NOT NULL,
        status TEXT DEFAULT 'pending',
        attempt_count INTEGER DEFAULT 0,
        last_attempt_at DATETIME,
        success_at DATETIME,
        error_message TEXT,
        page_html TEXT,
        form_data TEXT,
        screenshot_path TEXT,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (directory_id) REFERENCES directories(id)
      )
    `);

    // Create analysis_logs table for AI analysis results
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS analysis_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        directory_id INTEGER NOT NULL,
        submission_id INTEGER,
        analysis_type TEXT NOT NULL,
        result TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (directory_id) REFERENCES directories(id),
        FOREIGN KEY (submission_id) REFERENCES submissions(id)
      )
    `);

    // Create guest_post_sites table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS guest_post_sites (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        url TEXT NOT NULL UNIQUE,
        title TEXT,
        snippet TEXT,
        search_query TEXT,
        is_verified BOOLEAN DEFAULT 0,
        verification_score INTEGER DEFAULT 0,
        has_form BOOLEAN DEFAULT 0,
        contact_emails TEXT,
        site_guidelines TEXT,
        status TEXT DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create generated_articles table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS generated_articles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        alternate_titles TEXT,
        content TEXT NOT NULL,
        meta_description TEXT,
        author_bio TEXT,
        tags TEXT,
        word_count INTEGER,
        topic TEXT,
        generated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create guest_post_submissions table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS guest_post_submissions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guest_post_site_id INTEGER NOT NULL,
        article_id INTEGER NOT NULL,
        status TEXT DEFAULT 'pending',
        submission_method TEXT,
        attempt_count INTEGER DEFAULT 0,
        last_attempt_at DATETIME,
        success_at DATETIME,
        error_message TEXT,
        screenshot_path TEXT,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (guest_post_site_id) REFERENCES guest_post_sites(id),
        FOREIGN KEY (article_id) REFERENCES generated_articles(id)
      )
    `);

    // Create indexes
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_directories_status ON directories(status);
      CREATE INDEX IF NOT EXISTS idx_submissions_status ON submissions(status);
      CREATE INDEX IF NOT EXISTS idx_submissions_directory_id ON submissions(directory_id);
      CREATE INDEX IF NOT EXISTS idx_guest_post_sites_status ON guest_post_sites(status);
      CREATE INDEX IF NOT EXISTS idx_guest_post_submissions_status ON guest_post_submissions(status);
      CREATE INDEX IF NOT EXISTS idx_guest_post_submissions_site ON guest_post_submissions(guest_post_site_id);
    `);
  }

  /**
   * Add or update a directory
   */
  upsertDirectory(name, url, category) {
    const stmt = this.db.prepare(`
      INSERT INTO directories (name, url, category)
      VALUES (?, ?, ?)
      ON CONFLICT(url) DO UPDATE SET
        name = excluded.name,
        category = excluded.category,
        updated_at = CURRENT_TIMESTAMP
    `);
    const result = stmt.run(name, url, category);
    return result.lastInsertRowid || this.getDirectoryByUrl(url).id;
  }

  /**
   * Get directory by URL
   */
  getDirectoryByUrl(url) {
    const stmt = this.db.prepare('SELECT * FROM directories WHERE url = ?');
    return stmt.get(url);
  }

  /**
   * Get directory by ID
   */
  getDirectoryById(id) {
    const stmt = this.db.prepare('SELECT * FROM directories WHERE id = ?');
    return stmt.get(id);
  }

  /**
   * Get all directories
   */
  getAllDirectories() {
    const stmt = this.db.prepare('SELECT * FROM directories ORDER BY id');
    return stmt.all();
  }

  /**
   * Get directories by status
   */
  getDirectoriesByStatus(status) {
    const stmt = this.db.prepare('SELECT * FROM directories WHERE status = ? ORDER BY id');
    return stmt.all(status);
  }

  /**
   * Update directory status
   */
  updateDirectoryStatus(id, status) {
    const stmt = this.db.prepare(`
      UPDATE directories
      SET status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    return stmt.run(status, id);
  }

  /**
   * Create a new submission attempt
   */
  createSubmission(directoryId) {
    const stmt = this.db.prepare(`
      INSERT INTO submissions (directory_id, status, attempt_count, last_attempt_at)
      VALUES (?, 'in_progress', 1, CURRENT_TIMESTAMP)
    `);
    const result = stmt.run(directoryId);
    return result.lastInsertRowid;
  }

  /**
   * Update submission status
   */
  updateSubmission(submissionId, data) {
    const fields = [];
    const values = [];

    if (data.status) {
      fields.push('status = ?');
      values.push(data.status);
    }
    if (data.errorMessage !== undefined) {
      fields.push('error_message = ?');
      values.push(data.errorMessage);
    }
    if (data.pageHtml !== undefined) {
      fields.push('page_html = ?');
      values.push(data.pageHtml);
    }
    if (data.formData !== undefined) {
      fields.push('form_data = ?');
      values.push(JSON.stringify(data.formData));
    }
    if (data.screenshotPath !== undefined) {
      fields.push('screenshot_path = ?');
      values.push(data.screenshotPath);
    }
    if (data.notes !== undefined) {
      fields.push('notes = ?');
      values.push(data.notes);
    }
    if (data.incrementAttempt) {
      fields.push('attempt_count = attempt_count + 1');
      fields.push('last_attempt_at = CURRENT_TIMESTAMP');
    }
    if (data.status === 'success') {
      fields.push('success_at = CURRENT_TIMESTAMP');
    }

    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(submissionId);

    const stmt = this.db.prepare(`
      UPDATE submissions
      SET ${fields.join(', ')}
      WHERE id = ?
    `);
    return stmt.run(...values);
  }

  /**
   * Get submission by ID
   */
  getSubmission(submissionId) {
    const stmt = this.db.prepare('SELECT * FROM submissions WHERE id = ?');
    return stmt.get(submissionId);
  }

  /**
   * Get all submissions for a directory
   */
  getSubmissionsByDirectory(directoryId) {
    const stmt = this.db.prepare(`
      SELECT * FROM submissions
      WHERE directory_id = ?
      ORDER BY created_at DESC
    `);
    return stmt.all(directoryId);
  }

  /**
   * Log AI analysis result
   */
  logAnalysis(directoryId, submissionId, analysisType, result) {
    const stmt = this.db.prepare(`
      INSERT INTO analysis_logs (directory_id, submission_id, analysis_type, result)
      VALUES (?, ?, ?, ?)
    `);
    return stmt.run(directoryId, submissionId || null, analysisType, JSON.stringify(result));
  }

  /**
   * Get statistics
   */
  getStats() {
    const totalStmt = this.db.prepare('SELECT COUNT(*) as count FROM directories');
    const successStmt = this.db.prepare("SELECT COUNT(*) as count FROM directories WHERE status = 'success'");
    const failedStmt = this.db.prepare("SELECT COUNT(*) as count FROM directories WHERE status = 'failed'");
    const pendingStmt = this.db.prepare("SELECT COUNT(*) as count FROM directories WHERE status = 'pending'");
    const inProgressStmt = this.db.prepare("SELECT COUNT(*) as count FROM directories WHERE status = 'in_progress'");
    const manualStmt = this.db.prepare("SELECT COUNT(*) as count FROM directories WHERE status = 'requires_manual'");
    const uncertainStmt = this.db.prepare("SELECT COUNT(*) as count FROM directories WHERE status = 'uncertain'");

    return {
      total: totalStmt.get().count,
      success: successStmt.get().count,
      failed: failedStmt.get().count,
      pending: pendingStmt.get().count,
      inProgress: inProgressStmt.get().count,
      requiresManual: manualStmt.get().count,
      uncertain: uncertainStmt.get().count,
    };
  }

  /**
   * Get statistics by category
   */
  getStatsByCategory() {
    const stmt = this.db.prepare(`
      SELECT
        category,
        COUNT(*) as total,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
        SUM(CASE WHEN status = 'requires_manual' THEN 1 ELSE 0 END) as requires_manual,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending
      FROM directories
      GROUP BY category
      ORDER BY total DESC
    `);
    return stmt.all();
  }

  /**
   * Get recent submissions with directory info
   */
  getRecentSubmissions(limit = 20) {
    const stmt = this.db.prepare(`
      SELECT
        s.*,
        d.name as directory_name,
        d.url as directory_url,
        d.category as directory_category
      FROM submissions s
      JOIN directories d ON s.directory_id = d.id
      ORDER BY s.updated_at DESC
      LIMIT ?
    `);
    return stmt.all(limit);
  }

  /**
   * Get directories with their latest submission
   */
  getDirectoriesWithLatestSubmission() {
    const stmt = this.db.prepare(`
      SELECT
        d.*,
        s.status as submission_status,
        s.error_message,
        s.screenshot_path,
        s.updated_at as last_submission_at
      FROM directories d
      LEFT JOIN submissions s ON d.id = s.directory_id
      AND s.id = (
        SELECT id FROM submissions
        WHERE directory_id = d.id
        ORDER BY updated_at DESC
        LIMIT 1
      )
      ORDER BY d.updated_at DESC
    `);
    return stmt.all();
  }

  /**
   * Reset directories by status
   */
  resetDirectoriesByStatus(statuses) {
    const placeholders = statuses.map(() => '?').join(',');
    const stmt = this.db.prepare(`
      UPDATE directories
      SET status = 'pending', updated_at = CURRENT_TIMESTAMP
      WHERE status IN (${placeholders})
    `);
    return stmt.run(...statuses);
  }

  /**
   * Reset specific directory
   */
  resetDirectory(directoryId) {
    const stmt = this.db.prepare(`
      UPDATE directories
      SET status = 'pending', updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    return stmt.run(directoryId);
  }

  /**
   * Get CAPTCHA solving statistics from analysis logs
   */
  getCaptchaStats() {
    const stmt = this.db.prepare(`
      SELECT
        COUNT(*) as total_captchas,
        SUM(CASE WHEN result LIKE '%solved successfully%' THEN 1 ELSE 0 END) as solved,
        SUM(CASE WHEN result LIKE '%failed%' THEN 1 ELSE 0 END) as failed
      FROM analysis_logs
      WHERE analysis_type = 'form_analysis'
      AND result LIKE '%captcha%'
    `);
    return stmt.get();
  }

  // ============================================================================
  // GUEST POST METHODS
  // ============================================================================

  /**
   * Add a guest post site
   */
  addGuestPostSite(siteData) {
    const stmt = this.db.prepare(`
      INSERT INTO guest_post_sites (url, title, snippet, search_query, is_verified, verification_score, has_form, contact_emails)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      siteData.url,
      siteData.title || null,
      siteData.snippet || null,
      siteData.query || null,
      siteData.isVerified ? 1 : 0,
      siteData.score || 0,
      siteData.hasForm ? 1 : 0,
      siteData.contactEmails ? JSON.stringify(siteData.contactEmails) : null
    );
    return result.lastInsertRowid;
  }

  /**
   * Get all guest post sites
   */
  getGuestPostSites(status = null) {
    let query = 'SELECT * FROM guest_post_sites';
    if (status) {
      query += ` WHERE status = ?`;
      const stmt = this.db.prepare(query);
      return stmt.all(status);
    }
    const stmt = this.db.prepare(query);
    return stmt.all();
  }

  /**
   * Update guest post site
   */
  updateGuestPostSite(id, data) {
    const fields = [];
    const values = [];

    if (data.status !== undefined) {
      fields.push('status = ?');
      values.push(data.status);
    }
    if (data.is_verified !== undefined) {
      fields.push('is_verified = ?');
      values.push(data.is_verified ? 1 : 0);
    }
    if (data.verification_score !== undefined) {
      fields.push('verification_score = ?');
      values.push(data.verification_score);
    }
    if (data.has_form !== undefined) {
      fields.push('has_form = ?');
      values.push(data.has_form ? 1 : 0);
    }
    if (data.site_guidelines !== undefined) {
      fields.push('site_guidelines = ?');
      values.push(data.site_guidelines);
    }

    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    const stmt = this.db.prepare(`
      UPDATE guest_post_sites
      SET ${fields.join(', ')}
      WHERE id = ?
    `);
    return stmt.run(...values);
  }

  /**
   * Save a generated article
   */
  saveGeneratedArticle(article) {
    const stmt = this.db.prepare(`
      INSERT INTO generated_articles (title, alternate_titles, content, meta_description, author_bio, tags, word_count, topic)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      article.title,
      JSON.stringify(article.alternateTitles || []),
      article.content,
      article.metaDescription || null,
      article.authorBio || null,
      JSON.stringify(article.tags || []),
      article.wordCount || 0,
      article.topic || null
    );
    return result.lastInsertRowid;
  }

  /**
   * Get article by ID
   */
  getArticle(id) {
    const stmt = this.db.prepare('SELECT * FROM generated_articles WHERE id = ?');
    const article = stmt.get(id);
    if (article) {
      article.alternateTitles = JSON.parse(article.alternate_titles || '[]');
      article.tags = JSON.parse(article.tags || '[]');
    }
    return article;
  }

  /**
   * Get all generated articles
   */
  getAllArticles() {
    const stmt = this.db.prepare('SELECT * FROM generated_articles ORDER BY generated_at DESC');
    const articles = stmt.all();
    return articles.map((article) => ({
      ...article,
      alternateTitles: JSON.parse(article.alternate_titles || '[]'),
      tags: JSON.parse(article.tags || '[]'),
    }));
  }

  /**
   * Create a guest post submission
   */
  createGuestPostSubmission(siteId, articleId) {
    const stmt = this.db.prepare(`
      INSERT INTO guest_post_submissions (guest_post_site_id, article_id, status, attempt_count, last_attempt_at)
      VALUES (?, ?, 'in_progress', 1, CURRENT_TIMESTAMP)
    `);
    const result = stmt.run(siteId, articleId);
    return result.lastInsertRowid;
  }

  /**
   * Update guest post submission
   */
  updateGuestPostSubmission(submissionId, data) {
    const fields = [];
    const values = [];

    if (data.status) {
      fields.push('status = ?');
      values.push(data.status);
    }
    if (data.submission_method) {
      fields.push('submission_method = ?');
      values.push(data.submission_method);
    }
    if (data.error_message !== undefined) {
      fields.push('error_message = ?');
      values.push(data.error_message);
    }
    if (data.screenshot_path) {
      fields.push('screenshot_path = ?');
      values.push(data.screenshot_path);
    }
    if (data.notes) {
      fields.push('notes = ?');
      values.push(data.notes);
    }
    if (data.incrementAttempt) {
      fields.push('attempt_count = attempt_count + 1');
      fields.push('last_attempt_at = CURRENT_TIMESTAMP');
    }
    if (data.status === 'success') {
      fields.push('success_at = CURRENT_TIMESTAMP');
    }

    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(submissionId);

    const stmt = this.db.prepare(`
      UPDATE guest_post_submissions
      SET ${fields.join(', ')}
      WHERE id = ?
    `);
    return stmt.run(...values);
  }

  /**
   * Get guest post submissions with site and article info
   */
  getGuestPostSubmissions(status = null) {
    let query = `
      SELECT
        gps.*,
        s.url as site_url,
        s.title as site_title,
        a.title as article_title,
        a.word_count
      FROM guest_post_submissions gps
      JOIN guest_post_sites s ON gps.guest_post_site_id = s.id
      JOIN generated_articles a ON gps.article_id = a.id
    `;

    if (status) {
      query += ` WHERE gps.status = ?`;
      const stmt = this.db.prepare(query + ' ORDER BY gps.updated_at DESC');
      return stmt.all(status);
    }

    const stmt = this.db.prepare(query + ' ORDER BY gps.updated_at DESC');
    return stmt.all();
  }

  /**
   * Get guest post statistics
   */
  getGuestPostStats() {
    const sitesStmt = this.db.prepare('SELECT COUNT(*) as count FROM guest_post_sites');
    const articlesStmt = this.db.prepare('SELECT COUNT(*) as count FROM generated_articles');
    const submissionsStmt = this.db.prepare(`
      SELECT
        status,
        COUNT(*) as count
      FROM guest_post_submissions
      GROUP BY status
    `);

    const submissions = submissionsStmt.all();
    const submissionStats = {
      total: 0,
      success: 0,
      failed: 0,
      pending: 0,
      in_progress: 0,
    };

    submissions.forEach((row) => {
      submissionStats.total += row.count;
      submissionStats[row.status] = row.count;
    });

    return {
      totalSites: sitesStmt.get().count,
      totalArticles: articlesStmt.get().count,
      submissions: submissionStats,
    };
  }

  /**
   * Close database connection
   */
  close() {
    this.db.close();
  }
}
