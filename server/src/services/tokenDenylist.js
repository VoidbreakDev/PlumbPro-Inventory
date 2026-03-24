/**
 * In-process JWT token denylist.
 *
 * Tokens are stored with their expiry timestamp and automatically purged
 * once expired. This is sufficient for single-instance deployments.
 * For multi-instance deployments, replace the Map with a Redis-backed store.
 */

/** @type {Map<string, number>} token → expiry ms since epoch */
const denylist = new Map();

/**
 * Add a token to the denylist.
 * @param {string} token  - Raw JWT string
 * @param {number} expMs  - Expiry in milliseconds since epoch (decoded exp * 1000)
 */
export function addToDenylist(token, expMs) {
  denylist.set(token, expMs);
}

/**
 * Check whether a token has been explicitly revoked.
 * Automatically removes expired entries to prevent unbounded growth.
 * @param {string} token
 * @returns {boolean}
 */
export function isDenylisted(token) {
  const exp = denylist.get(token);
  if (exp === undefined) return false;
  // If the token has naturally expired, remove it and report not denylisted
  // (jwt.verify will reject it on its own).
  if (Date.now() > exp) {
    denylist.delete(token);
    return false;
  }
  return true;
}

// Purge fully expired entries every 15 minutes to prevent memory growth.
setInterval(() => {
  const now = Date.now();
  for (const [token, exp] of denylist) {
    if (now > exp) denylist.delete(token);
  }
}, 15 * 60 * 1000);
