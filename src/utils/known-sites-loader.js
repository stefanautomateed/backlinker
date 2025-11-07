import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { logger } from './logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const KNOWN_SITES_PATH = join(__dirname, '../data/known-guest-post-sites.json');

/**
 * Load known guest post sites from curated list
 * NO API NEEDED - just uses our pre-researched list
 */

/**
 * Load all known guest post sites
 */
export function loadKnownSites() {
  try {
    const data = fs.readFileSync(KNOWN_SITES_PATH, 'utf8');
    const sites = JSON.parse(data);
    logger.info(`Loaded ${sites.length} known guest post sites`);
    return sites;
  } catch (error) {
    logger.error(`Failed to load known sites: ${error.message}`);
    return [];
  }
}

/**
 * Filter sites by niche/category
 */
export function filterByNiche(sites, niches = []) {
  if (niches.length === 0) {
    return sites;
  }

  const nichesLower = niches.map((n) => n.toLowerCase());

  return sites.filter((site) => {
    const siteNiche = (site.niche || '').toLowerCase();
    const siteCategory = (site.category || '').toLowerCase();

    return nichesLower.some(
      (niche) => siteNiche.includes(niche) || siteCategory.includes(niche)
    );
  });
}

/**
 * Get sites for tech/AI/writing niches
 */
export function getTechAIWritingSites() {
  const allSites = loadKnownSites();

  return filterByNiche(allSites, [
    'ai',
    'tech',
    'technology',
    'programming',
    'development',
    'writing',
    'publishing',
    'content',
    'blogging',
    'marketing',
  ]);
}

/**
 * Get sites by category
 */
export function getSitesByCategory(category) {
  const allSites = loadKnownSites();
  return allSites.filter(
    (site) => site.category.toLowerCase().includes(category.toLowerCase())
  );
}

/**
 * Add a new site to the list
 */
export function addKnownSite(site) {
  try {
    const sites = loadKnownSites();

    // Check if already exists
    if (sites.some((s) => s.url === site.url)) {
      logger.warn(`Site already exists: ${site.url}`);
      return false;
    }

    sites.push(site);

    fs.writeFileSync(KNOWN_SITES_PATH, JSON.stringify(sites, null, 2));
    logger.info(`Added new site: ${site.name}`);
    return true;
  } catch (error) {
    logger.error(`Failed to add site: ${error.message}`);
    return false;
  }
}

/**
 * Get random sites (useful for testing)
 */
export function getRandomSites(count = 10) {
  const sites = getTechAIWritingSites();
  const shuffled = sites.sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

/**
 * Get site statistics
 */
export function getSiteStats() {
  const sites = loadKnownSites();

  const categories = {};
  sites.forEach((site) => {
    categories[site.category] = (categories[site.category] || 0) + 1;
  });

  return {
    total: sites.length,
    byCategory: categories,
  };
}
