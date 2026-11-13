/**
 * worker/sessions.js
 * Session lifecycle: start, pause, resume, end, toggleMode, addMatch.
 *
 * AUTOMATIC MATCH TIMER
 * ─────────────────────
 * Each console carries two extra fields that track the 4-minute cycle:
 *   con.matchTimerElapsed    – seconds accumulated in the current cycle (paused portion)
 *   con.matchTimerStartedAt  – timestamp (ms) when the cycle timer last resumed
 *
 * When getMatchTimerElapsed(con) >= MATCH_INTERVAL_SECONDS (240 s),
 * the ticker in app.js calls autoAddMatch() to create one unpaid bubble
 * and reset the cycle counter.
 */

import { saveState } from '../shared/storage.js';
import { getElapsed, getCharge, getMatchTimerElapsed, MATCH_INTERVAL_SECONDS } from '../shared/helpers.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Start the 4-minute match cycle timer (or resume it after a pause). */
function startMatchTimer(con) {
  con.matchTimerStartedAt = Date.now();
}

/** Pause the match cycle timer – accumulate elapsed seconds into matchTimerElapsed. */
function pauseMatchTimer(con) {
  con.matchTimerElapsed = getMatchTimerElapsed(con);
  con.matchTimerStartedAt = null;
}

/** Reset the match cycle timer to 00:00 and immediately start counting. */
function resetMatchTimer(con) {
  con.matchTimerElapsed   = 0;
  con.matchTimerStartedAt = con.status === 'playing' ? Date.now() : null;
}

// ── Session lifecycle ─────────────────────────────────────────────────────────

export function startSession(state, con) {
  if (con.status !== 'free') return;
  con.status    = 'playing';
  con.startedAt = Date.now();
  con.elapsed   = 0;
  // Initialise the match cycle timer from zero
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
  if (con.mode === 'FIFA' && con.matches.some(m => !m.paid)) {
    return 'This session has unpaid match bubbles. Record payment or keep the session open.';
  }
  if (con.mode === 'MISSION' && getCharge(con) > 0) {
    return 'Record the mission payment in the transaction panel before ending this session.';
  }
  con.status              = 'free';
  con.elapsed             = 0;
  con.startedAt           = null;
  con.matches             = [];
  // Clear the match cycle timer
  con.matchTimerElapsed   = 0;
  con.matchTimerStartedAt = null;
  saveState(state);
  return null;
}

export function toggleMode(state, con) {
  if (con.status !== 'free') return;
  con.mode    = con.mode === 'FIFA' ? 'MISSION' : 'FIFA';
  con.matches = [];
  con.elapsed = 0;
  con.matchTimerElapsed   = 0;
  con.matchTimerStartedAt = null;
  saveState(state);
}

// ── Match helpers ─────────────────────────────────────────────────────────────

/**
 * Add one unpaid match bubble manually (worker clicks "+ 1 MATCH").
 * Does NOT reset the automatic cycle timer.
 */
export function addMatch(state, con) {
  if (con.status === 'free' || con.mode !== 'FIFA') return;
  const nextId = con.matches.length
    ? Math.max(...con.matches.map(m => m.id)) + 1
    : 1;
  con.matches.push({ id: nextId, paid: false, method: null });
  saveState(state);
}

/**
 * Automatically add one unpaid match bubble when the 4-minute timer fires.
 * Resets the cycle timer and immediately starts counting toward the next match.
 * Guards against double-firing.
 */
export function autoAddMatch(state, con) {
  if (con.status !== 'playing' || con.mode !== 'FIFA') return;
  // Double-check: only fire when the cycle is actually complete
  if (getMatchTimerElapsed(con) < MATCH_INTERVAL_SECONDS) return;

  const nextId = con.matches.length
    ? Math.max(...con.matches.map(m => m.id)) + 1
    : 1;
  con.matches.push({ id: nextId, paid: false, method: null });

  // Reset cycle so the next 4-minute countdown begins immediately
  resetMatchTimer(con);
  saveState(state);
}
