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

    // Create indexes
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_directories_status ON directories(status);
      CREATE INDEX IF NOT EXISTS idx_submissions_status ON submissions(status);
      CREATE INDEX IF NOT EXISTS idx_submissions_directory_id ON submissions(directory_id);
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

    return {
      total: totalStmt.get().count,
      success: successStmt.get().count,
      failed: failedStmt.get().count,
      pending: pendingStmt.get().count,
      inProgress: inProgressStmt.get().count,
    };
  }

  /**
   * Close database connection
   */
  close() {
    this.db.close();
  }
}
