/**
 * helpers.js
 * Math, formatting, and dynamic pricing utilities shared across modules.
 */

import { getPricing } from './api.js';

// ── Pricing ───────────────────────────────────────────────────────────────────

/**
 * Price for a match or bubble in ETB.
 * Always prefers the recorded price on historical match objects so price changes
 * never mutate past transactions or already-played matches.
 * Falls back to the latest active pricing configured in Admin Dashboard.
 *
 * @param {ConsoleObj} con
 * @param {MatchObj} [match]
 * @returns {number}
 */
export function getPrice(con, match) {
  if (match && typeof match.price === 'number') {
    return match.price;
  }
  const pricing = getPricing();
  if (con.mode === 'MISSION') {
    return pricing.missionPrice || 50;
  }
  return con.type === 'PS5' ? (pricing.ps5 || 30) : (pricing.ps4 || 25);
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
 * Total charge for a console's current session in ETB.
 * In FIFA mode: Sum of match bubble prices.
 * In MISSION mode: Sum of 30-minute bubble prices (0 ETB before 30:00, 50 ETB at 30:00, 100 ETB at 60:00...).
 *
 * @param {ConsoleObj} con
 * @returns {number} ETB
 */
export function getCharge(con) {
  if (!con.matches || con.matches.length === 0) {
    return 0;
  }
  return con.matches.reduce(
    (sum, m) => sum + (typeof m.price === 'number' ? m.price : getPrice(con, m)),
    0
  );
}

/**
 * Amount already paid for a console's current session in ETB.
 *
 * @param {ConsoleObj} con
 * @returns {number} ETB
 */
export function getPaid(con) {
  if (!con.matches || con.matches.length === 0) {
    return 0;
  }
  return con.matches
    .filter(m => m.paid)
    .reduce((sum, m) => sum + (typeof m.price === 'number' ? m.price : getPrice(con, m)), 0);
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
