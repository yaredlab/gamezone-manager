/**
 * admin/app.js
 * Admin Dashboard entry point.
 * Owns navigation, renderAll(), page routing, and toast notifications.
 */

import { loadState } from '../shared/storage.js';
import { renderOverview }                       from './overview.js';
import { renderTransactions, initTransactionListeners } from './transactions.js';
import { renderConsoles, initConsolesListeners } from './consoles.js';
import { renderWorkers, initWorkersListeners }   from './workers.js';
import { renderPricing, initPricingListeners }   from './pricing.js';
import { renderReports, initReportsListeners }   from './reports.js';
import { renderSettings, initSettingsListeners } from './settings.js';

// ── Toast (global helper used by other admin modules) ─────────────────────────

/**
 * Show a brief toast notification.
 * Exposed on window so admin submodules can call showToast() without circular imports.
 * @param {string} message
 * @param {'info'|'error'|'warn'} [type='info']
 */
window.showToast = function(message, type = 'info') {
  const toast = document.getElementById('adminToast');
  toast.textContent = message;
  toast.className   = `admin-toast show toast-${type}`;
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove('show'), 2800);
};

// ── State ─────────────────────────────────────────────────────────────────────

/** Current active page id */
let activePage = 'overview';

// ── Render router ─────────────────────────────────────────────────────────────

/**
 * Full render: re-draws the active page from latest state.
 * All submodules call renderAll() after a state mutation.
 */
function renderAll() {
  const state = loadState();      // always read fresh from storage

  switch (activePage) {
    case 'overview':     renderOverview(state);     break;
    case 'transactions': renderTransactions(state); break;
    case 'consoles':     renderConsoles(state);     break;
    case 'workers':      renderWorkers();           break;
    case 'pricing':      renderPricing();           break;
    case 'reports':      renderReports(state);      break;
    case 'settings':     renderSettings();          break;
  }
}

// ── Navigation ────────────────────────────────────────────────────────────────

function navigate(page) {
  activePage = page;

  /* Update nav button active states */
  document.querySelectorAll('[data-page]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.page === page);
  });

  /* Show/hide page sections */
  document.querySelectorAll('.page').forEach(section => {
    section.classList.toggle('show', section.id === `page-${page}`);
  });

  renderAll();
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {

  /* ── Date in header ── */
  document.getElementById('adminDate').textContent = new Date().toLocaleDateString(
    undefined,
    { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }
  );

  /* ── Nav links ── */
  document.querySelectorAll('[data-page]').forEach(btn => {
    btn.addEventListener('click', () => navigate(btn.dataset.page));
  });

  /* ── Refresh button on overview ── */
  document.getElementById('refresh').addEventListener('click', () => {
    renderAll();
    showToast('Dashboard refreshed');
  });

  /* ── Initialise all section listeners (once only) ── */
  const state = loadState();

  initTransactionListeners(state);
  initConsolesListeners(renderAll);
  initWorkersListeners(renderAll);
  initPricingListeners(renderAll);
  initReportsListeners(state, renderAll);
  initSettingsListeners(renderAll);

  /* ── Auto-refresh every 30 seconds to pick up worker changes ── */
  setInterval(renderAll, 30_000);

  /* ── Initial render ── */
  navigate('overview');
});
