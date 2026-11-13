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
import { autoAddMatch } from './sessions.js';
import { getMatchTimerElapsed, MATCH_INTERVAL_SECONDS } from '../shared/helpers.js';
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

// ── Auto match ticker ─────────────────────────────────────────────────────────
// Runs every second.  For each active FIFA console it:
//  1. Checks whether the 4-minute cycle is complete → fires autoAddMatch.
//  2. Updates the session timer display in-place (no full re-render).
//  3. Updates the match cycle progress bar in-place.

function ticker() {
  let matchCreated = false;

  state.consoles.forEach(con => {
    // ── Session timer (in-place update) ──
    const timerEl = document.querySelector(`[data-timer="${CSS.escape(con.id)}"]`);
    if (timerEl) timerEl.textContent = formatTimer(getElapsed(con));

    // ── Match cycle (auto-generate every 4 minutes) ──
    if (con.status === 'playing' && con.mode === 'FIFA') {
      const cycleEl = document.querySelector(`[data-cycle="${CSS.escape(con.id)}"]`);

      if (getMatchTimerElapsed(con) >= MATCH_INTERVAL_SECONDS) {
        // Fire – create one unpaid bubble and reset the cycle
        autoAddMatch(state, con);
        matchCreated = true;
        // Full re-render is triggered below after the loop
      } else if (cycleEl) {
        // Update progress bar without touching the whole DOM
        const cycleSecs   = getMatchTimerElapsed(con);
        const pct         = Math.round((cycleSecs / MATCH_INTERVAL_SECONDS) * 100);
        const remaining   = MATCH_INTERVAL_SECONDS - cycleSecs;
        const cm          = Math.floor(remaining / 60);
        const cs          = remaining % 60;
        const fill        = cycleEl.querySelector('.match-cycle-fill');
        const countdown   = cycleEl.querySelector('.cycle-countdown');
        if (fill)      fill.style.width = pct + '%';
        if (countdown) countdown.textContent =
          `Next match in ${String(cm).padStart(2,'0')}:${String(cs).padStart(2,'0')}`;
      }
    }
  });

  // A new match bubble was created – do a full re-render so it appears instantly
  if (matchCreated) renderAll();

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

  /* ── 1-second ticker ── */
  setInterval(ticker, 1000);

  renderAll();
});
