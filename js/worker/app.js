/**
 * worker/app.js
 * Application entry point and central render orchestrator for the Worker Dashboard.
 */

import { loadState, saveState, addConsoleToState } from '../shared/storage.js';
import {
  buildConsoleCard,
  handleConsoleGridClick,
  getElapsed,
  formatTimer,
} from './consoles.js';
import { autoAddMatch, checkMissionBubbles } from './sessions.js';
import { getMatchTimerElapsed, MATCH_INTERVAL_SECONDS } from '../shared/helpers.js';
import { getPricing } from '../shared/api.js';
import { updateSelectionUI, initPaymentListeners } from './payments.js';
import { initCalculator } from './calculator.js';
import {
  renderStats,
  renderStatsVisibility,
  renderTransactions,
  tickStats,
  initDashboardListeners,
} from './dashboard.js';

// ── Application state ──────────────────────────────────────────────────────────

const state    = loadState();
const selected = new Set();

// ── Central render function ───────────────────────────────────────────────────

function renderAll() {
  renderStats(state);
  renderStatsVisibility(state);

  document.getElementById('consoleGrid').innerHTML = state.consoles
    .map(con => buildConsoleCard(con, selected))
    .join('');

  renderTransactions(state);
  updateSelectionUI(state, selected);
}

// ── 1-Second Real-Time Ticker ─────────────────────────────────────────────────
// Runs every second:
// 1. In Match Mode (FIFA):
//    - Updates the match timer display (counts from 00:00 to 04:00).
//    - When 4 minutes complete, creates an unpaid match bubble and resets to 00:00.
//    - Updates the 4-minute progress bar and live countdown.
// 2. In Mission Mode:
//    - Updates the continuous session timer display (counting from 00:00 upward).
//    - At exactly 30 minutes (or admin-configured interval), creates a new unpaid bubble.
//    - Updates the 30-minute progress bar and live countdown.
// 3. Ticks live statistics and estimated totals.

function ticker() {
  let needsRerender = false;
  const pricing = getPricing();
  const intervalMinutes = Math.max(1, Number(pricing.missionInterval) || 30);
  const intervalSec = intervalMinutes * 60;

  state.consoles.forEach(con => {
    // ── Timer Display (In-place update) ──
    const timerEl = document.querySelector(`[data-timer="${CSS.escape(con.id)}"]`);
    if (timerEl) {
      if (con.status === 'free') {
        timerEl.textContent = '00:00:00';
      } else if (con.mode === 'FIFA') {
        // FIFA: current match timer (counts 00:00 -> 04:00, resets on addMatch)
        timerEl.textContent = formatTimer(getMatchTimerElapsed(con));
      } else {
        // Mission: continuous session timer
        timerEl.textContent = formatTimer(getElapsed(con));
      }
    }

    // ── FIFA Match Mode: Auto-match every 4 minutes ──
    if (con.status === 'playing' && con.mode === 'FIFA') {
      const cycleEl = document.querySelector(`[data-cycle="${CSS.escape(con.id)}"]`);

      if (getMatchTimerElapsed(con) >= MATCH_INTERVAL_SECONDS) {
        // 4 minutes reached: automatically add unpaid match and reset timer to 00:00
        autoAddMatch(state, con);
        needsRerender = true;
      } else if (cycleEl) {
        // Live update of progress bar and countdown
        const cycleSecs = getMatchTimerElapsed(con);
        const pct       = Math.min(100, Math.round((cycleSecs / MATCH_INTERVAL_SECONDS) * 100));
        const remaining = MATCH_INTERVAL_SECONDS - cycleSecs;
        const cm        = Math.floor(remaining / 60);
        const cs        = remaining % 60;
        const fill      = cycleEl.querySelector('.match-cycle-fill');
        const countdown = cycleEl.querySelector('.cycle-countdown');
        if (fill)      fill.style.width = pct + '%';
        if (countdown) countdown.textContent =
          `Next match in ${String(cm).padStart(2,'0')}:${String(cs).padStart(2,'0')}`;
      }
    }

    // ── Mission Mode: Auto-bubble every 30 minutes ──
    if (con.status === 'playing' && con.mode === 'MISSION') {
      if (checkMissionBubbles(state, con)) {
        needsRerender = true;
      } else {
        const missionCycleEl = document.querySelector(`[data-mission-cycle="${CSS.escape(con.id)}"]`);
        if (missionCycleEl) {
          const elapsed   = getElapsed(con);
          const cycleSecs = elapsed % intervalSec;
          const pct       = Math.min(100, Math.round((cycleSecs / intervalSec) * 100));
          const remaining = intervalSec - cycleSecs;
          const mm        = Math.floor(remaining / 60);
          const ms        = remaining % 60;
          const fill      = missionCycleEl.querySelector('.match-cycle-fill');
          const countdown = missionCycleEl.querySelector('.cycle-countdown');
          if (fill)      fill.style.width = pct + '%';
          if (countdown) countdown.textContent =
            `Next bubble in ${String(mm).padStart(2,'0')}:${String(ms).padStart(2,'0')}`;
        }
      }
    }
  });

  if (needsRerender) {
    renderAll();
  }

  tickStats(state);
}

// ── Bootstrap ──────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {

  document.getElementById('today').textContent = new Date().toLocaleDateString(
    undefined,
    { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }
  );

  initCalculator();
  initDashboardListeners(state, renderAll);
  initPaymentListeners(state, selected, renderAll);

  document.getElementById('consoleGrid').addEventListener('click', e => {
    handleConsoleGridClick(e, state, selected, renderAll);
  });

  /* ── Add Console modal ── */
  const modal        = document.getElementById('modal');
  const newNameInput = document.getElementById('newName');

  document.getElementById('addConsole').addEventListener('click', () => {
    newNameInput.value = '';
    modal.classList.add('show');
    newNameInput.focus();
  });

  document.getElementById('cancelModal').addEventListener('click', () => {
    modal.classList.remove('show');
  });

  modal.addEventListener('click', e => {
    if (e.target === modal) modal.classList.remove('show');
  });

  document.getElementById('saveConsole').addEventListener('click', () => {
    const id   = newNameInput.value.trim().toUpperCase();
    const type = document.getElementById('newType').value;
    if (!addConsoleToState(state, id, type)) {
      alert('Enter a unique, non-empty console name.');
      return;
    }
    saveState(state);
    modal.classList.remove('show');
    renderAll();
  });

  newNameInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('saveConsole').click();
  });

  /* ── Real-Time Pricing Synchronization with Admin Dashboard ── */
  // Listens for localStorage updates across tabs or same-tab events
  window.addEventListener('storage', e => {
    if (e.key === 'gamezone-admin-pricing' || e.key === 'gamezone-worker-v1') {
      renderAll();
    }
  });
  window.addEventListener('pricing-updated', () => {
    renderAll();
  });

  /* ── 1-second ticker ── */
  setInterval(ticker, 1000);

  renderAll();
});
