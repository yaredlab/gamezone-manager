/**
 * worker/sessions.js
 * Session lifecycle: start, pause, resume, end, toggleMode, addMatch, checkMissionBubbles.
 *
 * MATCH MODE TIMER:
 * ─────────────────
 * Starts from 00:00 when session starts.
 * When worker clicks "+ 1 MATCH" or 4-minute auto-timer triggers,
 * timer IMMEDIATELY RESETS to 00:00 and counts again for the new match.
 *
 * MISSION MODE TIMER & BUBBLES:
 * ─────────────────────────────
 * Continuous session timer starts from 00:00.
 * At exactly 30 minutes (or admin-configured interval), automatically adds 1 Bubble.
 * Every additional 30 minutes, automatically adds another Bubble.
 * Timer keeps running without resetting.
 */

import { saveState } from '../shared/storage.js';
import {
  getElapsed,
  getCharge,
  getPrice,
  getMatchTimerElapsed,
  MATCH_INTERVAL_SECONDS,
} from '../shared/helpers.js';
import { getPricing } from '../shared/api.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Start or resume the match cycle timer. */
function startMatchTimer(con) {
  con.matchTimerStartedAt = Date.now();
}

/** Freeze the match cycle timer during pause. */
function pauseMatchTimer(con) {
  con.matchTimerElapsed = getMatchTimerElapsed(con);
  con.matchTimerStartedAt = null;
}

/** Reset the match timer to 00:00 and immediately start counting from zero. */
export function resetMatchTimer(con) {
  con.matchTimerElapsed = 0;
  con.matchTimerStartedAt = con.status === 'playing' ? Date.now() : null;
}

// ── Session lifecycle ─────────────────────────────────────────────────────────

export function startSession(state, con) {
  if (con.status !== 'free') return;
  con.status    = 'playing';
  con.startedAt = Date.now();
  con.elapsed   = 0;
  con.matches   = [];

  // Match Mode: start current match timer at 00:00
  con.matchTimerElapsed   = 0;
  con.matchTimerStartedAt = Date.now();

  saveState(state);
}

export function pauseSession(state, con) {
  if (con.status !== 'playing') return;
  con.elapsed   = getElapsed(con);
  con.startedAt = null;
  con.status    = 'paused';

  // Freeze the match cycle timer so paused time does NOT count
  pauseMatchTimer(con);
  saveState(state);
}

export function resumeSession(state, con) {
  if (con.status !== 'paused') return;
  con.startedAt = Date.now();
  con.status    = 'playing';

  // Resume the match cycle timer from where it was frozen
  startMatchTimer(con);
  saveState(state);
}

export function endSession(state, con) {
  if (con.matches && con.matches.some(m => !m.paid)) {
    return 'This session has unpaid payment bubbles. Record payment or keep the session open.';
  }
  con.status              = 'free';
  con.elapsed             = 0;
  con.startedAt           = null;
  con.matches             = [];
  con.matchTimerElapsed   = 0;
  con.matchTimerStartedAt = null;
  saveState(state);
  return null;
}

export function toggleMode(state, con) {
  if (con.status !== 'free') return;
  con.mode                = con.mode === 'FIFA' ? 'MISSION' : 'FIFA';
  con.matches             = [];
  con.elapsed             = 0;
  con.matchTimerElapsed   = 0;
  con.matchTimerStartedAt = null;
  saveState(state);
}

// ── Match Mode Helpers ────────────────────────────────────────────────────────

/**
 * Add one unpaid match bubble when worker clicks "Add Match".
 * - Creates a new unpaid match using the latest Admin Dashboard price.
 * - Immediately resets the match timer to 00:00.
 * - Starts counting from 00:00 for the newly added match.
 * - Previous match timer stops; elapsed time does not carry over.
 */
export function addMatch(state, con) {
  if (con.status === 'free' || con.mode !== 'FIFA') return;
  const nextId = con.matches.length
    ? Math.max(...con.matches.map(m => m.id)) + 1
    : 1;

  // Retrieve current active price from Admin configuration
  const activePrice = getPrice(con);

  con.matches.push({
    id: nextId,
    paid: false,
    method: null,
    price: activePrice,
    createdAt: Date.now(),
  });

  // Immediately reset match timer to 00:00 and start counting fresh
  resetMatchTimer(con);
  saveState(state);
}

/**
 * Automatically add one unpaid match bubble when the 4-minute timer fires.
 * Resets the timer to 00:00 and immediately starts counting for the next match.
 */
export function autoAddMatch(state, con) {
  if (con.status !== 'playing' || con.mode !== 'FIFA') return;
  if (getMatchTimerElapsed(con) < MATCH_INTERVAL_SECONDS) return;

  const nextId = con.matches.length
    ? Math.max(...con.matches.map(m => m.id)) + 1
    : 1;

  const activePrice = getPrice(con);

  con.matches.push({
    id: nextId,
    paid: false,
    method: null,
    price: activePrice,
    createdAt: Date.now(),
  });

  // Reset cycle to 00:00
  resetMatchTimer(con);
  saveState(state);
}

// ── Mission Mode Helpers ──────────────────────────────────────────────────────

/**
 * Check and add Mission Mode bubbles automatically every 30 minutes (or configured interval).
 * - Timer keeps running continuously without resetting.
 * - At 30:00 -> adds 1 Bubble
 * - At 60:00 -> adds 2nd Bubble
 * - At 90:00 -> adds 3rd Bubble
 * - Prevents duplicate additions for the same interval.
 * - Each bubble uses current Admin Mission Mode price.
 *
 * @param {AppState} state
 * @param {ConsoleObj} con
 * @returns {boolean} true if a new bubble was added
 */
export function checkMissionBubbles(state, con) {
  if (con.status !== 'playing' || con.mode !== 'MISSION') return false;

  const pricing = getPricing();
  const intervalMinutes = Math.max(1, Number(pricing.missionInterval) || 30);
  const intervalSec = intervalMinutes * 60;
  const elapsed = getElapsed(con);
  const targetBubbles = Math.floor(elapsed / intervalSec);

  if (!Array.isArray(con.matches)) con.matches = [];

  if (con.matches.length >= targetBubbles) {
    return false;
  }

  let added = false;
  while (con.matches.length < targetBubbles) {
    const nextId = con.matches.length
      ? Math.max(...con.matches.map(m => m.id)) + 1
      : 1;
    const missionPrice = Number(pricing.missionPrice) || 50;

    con.matches.push({
      id: nextId,
      paid: false,
      method: null,
      price: missionPrice,
      createdAt: Date.now(),
    });
    added = true;
  }

  if (added) {
    saveState(state);
    return true;
  }
  return false;
}
