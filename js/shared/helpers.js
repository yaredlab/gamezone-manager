/**
 * helpers.js
 * Pure math and formatting utilities shared across modules.
 * Has NO imports from other app modules — safe to import anywhere.
 */

// ── Pricing ───────────────────────────────────────────────────────────────────

/**
 * Price per FIFA match in ETB.
 * PS4 → 25 ETB, PS5 → 30 ETB.
 * @param {ConsoleObj} con
 * @returns {number}
 */
export function getPrice(con) {
  return con.type === 'PS4' ? 25 : 30;
}

// ── Time helpers ──────────────────────────────────────────────────────────────

/**
 * Total elapsed seconds including live time since last resume.
 * @param {ConsoleObj} con
 * @returns {number}
 */
export function getElapsed(con) {
  return (
    con.elapsed +
    (con.status === 'playing' && con.startedAt
      ? Math.floor((Date.now() - con.startedAt) / 1000)
      : 0)
  );
}

/**
 * Seconds elapsed within the CURRENT 4-minute match cycle.
 * Uses a separate timestamp (matchTimerStartedAt) so it is completely
 * independent from the main session timer and survives pause/resume.
 * @param {ConsoleObj} con
 * @returns {number}
 */
export function getMatchTimerElapsed(con) {
  return (
    (con.matchTimerElapsed || 0) +
    (con.status === 'playing' && con.matchTimerStartedAt
      ? Math.floor((Date.now() - con.matchTimerStartedAt) / 1000)
      : 0)
  );
}

/** Duration of one automatic match cycle in seconds (4 minutes). */
export const MATCH_INTERVAL_SECONDS = 240;

/**
 * Format seconds as HH:MM:SS.
 * @param {number} totalSeconds
 * @returns {string}
 */
export function formatTimer(totalSeconds) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return [h, m, s].map(n => String(n).padStart(2, '0')).join(':');
}

// ── Charge helpers ────────────────────────────────────────────────────────────

/**
 * Total charge for a console's current session.
 * FIFA:    matches × price per match.
 * MISSION: 30-minute blocks × 50 ETB.
 * @param {ConsoleObj} con
 * @returns {number} ETB
 */
export function getCharge(con) {
  if (con.mode === 'MISSION') {
    return Math.ceil(getElapsed(con) / 1800) * 50;
  }
  return con.matches.length * getPrice(con);
}

/**
 * Amount already paid for a console's current FIFA session.
 * @param {ConsoleObj} con
 * @returns {number} ETB
 */
export function getPaid(con) {
  return con.matches.filter(m => m.paid).length * getPrice(con);
}

// ── Formatting ────────────────────────────────────────────────────────────────

/**
 * Format a number as "X,XXX ETB".
 * @param {number} n
 * @returns {string}
 */
export function formatMoney(n) {
  return Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 2 }) + ' ETB';
}

/**
 * HTML-escape a string to prevent XSS in innerHTML templates.
 * @param {*} s
 * @returns {string}
 */
export function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;',
    '"': '&quot;', "'": '&#39;',
  }[c]));
}
