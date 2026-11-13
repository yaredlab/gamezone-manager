/**
 * worker/sessions.js
 * Session lifecycle: start, pause, resume, end, toggleMode, addMatch.
 */

import { saveState } from '../shared/storage.js';
import { getElapsed, getCharge } from '../shared/helpers.js';

export function startSession(state, con) {
  if (con.status !== 'free') return;
  con.status    = 'playing';
  con.startedAt = Date.now();
  con.elapsed   = 0;
  saveState(state);
}

export function pauseSession(state, con) {
  if (con.status !== 'playing') return;
  con.elapsed   = getElapsed(con);
  con.startedAt = null;
  con.status    = 'paused';
  saveState(state);
}

export function resumeSession(state, con) {
  if (con.status !== 'paused') return;
  con.startedAt = Date.now();
  con.status    = 'playing';
  saveState(state);
}

export function endSession(state, con) {
  if (con.mode === 'FIFA' && con.matches.some(m => !m.paid)) {
    return 'This session has unpaid match bubbles. Record payment or keep the session open.';
  }
  if (con.mode === 'MISSION' && getCharge(con) > 0) {
    return 'Record the mission payment in the transaction panel before ending this session.';
  }
  con.status    = 'free';
  con.elapsed   = 0;
  con.startedAt = null;
  con.matches   = [];
  saveState(state);
  return null;
}

export function toggleMode(state, con) {
  if (con.status !== 'free') return;
  con.mode    = con.mode === 'FIFA' ? 'MISSION' : 'FIFA';
  con.matches = [];
  con.elapsed = 0;
  saveState(state);
}

export function addMatch(state, con) {
  if (con.status === 'free' || con.mode !== 'FIFA') return;
  const nextId = con.matches.length
    ? Math.max(...con.matches.map(m => m.id)) + 1
    : 1;
  con.matches.push({ id: nextId, paid: false, method: null });
  saveState(state);
}
