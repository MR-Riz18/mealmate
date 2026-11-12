/**
 * Small in-memory cache for recipe DISCOVERY only — Phase 5.
 *
 * Rules (documented in the README):
 * - Keyed by the full request URL (path + query string), so different
 *   searches, filters and pages are different entries.
 * - TTL is 60 seconds; expired entries are treated as misses and evicted.
 * - Only GET /api/recipes and /api/recipes/search go through this cache.
 *   User-specific endpoints (favorites, plans, pantry, dashboard) are
 *   NEVER cached: their responses differ per user and must stay fresh.
 * - Admin recipe create/update/delete and category rename clear the
 *   whole cache, so an admin change is visible on the next request.
 * - Counters (hits, misses, size) are exposed via GET /api/admin/stats
 *   so the cache is observable, not just claimed.
 */

const TTL_MS = 60 * 1000;

const entries = new Map(); // key -> { data, expiresAt }
let hits = 0;
let misses = 0;

function get(key) {
  const entry = entries.get(key);
  if (!entry) {
    misses += 1;
    return null;
  }
  if (entry.expiresAt <= Date.now()) {
    entries.delete(key);
    misses += 1;
    return null;
  }
  hits += 1;
  return entry.data;
}

function set(key, data) {
  entries.set(key, { data, expiresAt: Date.now() + TTL_MS });
}

function clear() {
  entries.clear();
}

function stats() {
  // Prune expired entries so `size` reflects live entries only.
  const now = Date.now();
  for (const [key, entry] of entries) {
    if (entry.expiresAt <= now) entries.delete(key);
  }
  return { hits, misses, size: entries.size, ttlMs: TTL_MS };
}

// Test helper: reset counters and entries (never used in production routes).
function resetForTests() {
  entries.clear();
  hits = 0;
  misses = 0;
}

module.exports = { get, set, clear, stats, resetForTests, TTL_MS };
