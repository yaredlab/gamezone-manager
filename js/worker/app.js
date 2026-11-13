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
import { updateSelectionUI, initPaymentListeners } from './payments.js';
import { initCalculator } from './calculator.js';
import {
  renderStats,
  renderStatsVisibility,
  renderTransactions,
  tickStats,
  initDashboardListeners,
} from './dashboard.js';

// ── Application state ─────────────────────────────────────────────────────────

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

// ── Bootstrap ─────────────────────────────────────────────────────────────────

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

  /* ── Per-second timer interval ── */
  setInterval(() => {
    document.querySelectorAll('[data-timer]').forEach(el => {
      const con = state.consoles.find(x => x.id === el.dataset.timer);
      if (con) el.textContent = formatTimer(getElapsed(con));
    });
    tickStats(state);
  }, 1000);

  renderAll();
});
