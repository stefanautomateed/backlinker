import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { BacklinkerDB } from '../database/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Load directories from JSON file into database
 */
export function loadDirectories() {
  const db = new BacklinkerDB();
  const directoriesPath = join(__dirname, '../data/directories.json');

  try {
    const data = readFileSync(directoriesPath, 'utf8');
    const directories = JSON.parse(data);

    let added = 0;
    let updated = 0;

    for (const dir of directories) {
      const existing = db.getDirectoryByUrl(dir.url);
      if (existing) {
        updated++;
      } else {
        added++;
      }
      db.upsertDirectory(dir.name, dir.url, dir.category);
    }

    console.log(`✓ Loaded ${directories.length} directories (${added} new, ${updated} existing)`);
    return directories.length;
  } catch (error) {
    console.error('Error loading directories:', error.message);
    throw error;
  } finally {
    db.close();
  }
}

/**
 * Get directory list from database
 */
export function getDirectories(status = null) {
  const db = new BacklinkerDB();
  try {
    if (status) {
      return db.getDirectoriesByStatus(status);
    }
    return db.getAllDirectories();
  } finally {
    db.close();
  }
}
