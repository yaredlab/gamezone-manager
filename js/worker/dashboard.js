/**
 * worker/dashboard.js
 * Stats bar rendering, transaction list, eye toggle, 1-second tick.
 */

import { getCharge, getPaid, formatMoney, esc } from '../shared/helpers.js';
import { saveState } from '../shared/storage.js';

export function renderStats(state) {
  const total   = state.transactions.reduce((n, t) => n + t.amount, 0);
  const matches = state.consoles.reduce((n, c) => n + (c.mode === 'FIFA' ? c.matches.length : 0), 0);
  const active  = state.consoles.filter(c => c.status !== 'free').length;
  const unpaid  = state.consoles.reduce((n, c) => n + Math.max(0, getCharge(c) - getPaid(c)), 0);

  document.getElementById('collected').textContent  = formatMoney(total);
  document.getElementById('matchCount').textContent  = matches;
  document.getElementById('activeCount').textContent = active;
  document.getElementById('unpaid').textContent      = formatMoney(unpaid);
}

export function renderStatsVisibility(state) {
  document.getElementById('stats').classList.toggle('hiddenstats', state.hidden);
  document.getElementById('toggleStats').innerHTML =
    `◉ <span>${state.hidden ? 'Show totals' : 'Hide totals'}</span>`;
}

export function renderTransactions(state) {
  const txReversed = state.transactions.slice().reverse();
  document.getElementById('txCount').textContent = `${txReversed.length} records`;

  document.getElementById('txList').innerHTML = txReversed.length
    ? txReversed.map(t => `
        <div class="tx">
          <div>
            <div class="txname">${esc(t.method)}${t.provider ? ` · ${esc(t.provider)}` : ''} · ${esc(t.console)}</div>
            <div class="txmeta">${esc(t.description || 'Customer payment')} · ${esc(t.time)}</div>
          </div>
          <div class="txamount">+${formatMoney(t.amount)}</div>
        </div>`).join('')
    : '<div class="empty">No transfers recorded yet.</div>';

  const cash = state.transactions.filter(t => t.method === 'Cash').reduce((n, t) => n + t.amount, 0);
  const tele = state.transactions.filter(t => t.provider === 'Telebirr').reduce((n, t) => n + t.amount, 0);
  const cbe  = state.transactions.filter(t => t.provider === 'Commercial Bank of Ethiopia').reduce((n, t) => n + t.amount, 0);
  const viewAllBtn = document.getElementById('viewAll');
  viewAllBtn.textContent = `☷ VIEW ALL TRANSACTIONS · ${txReversed.length}`;
  viewAllBtn.title = `Cash ${formatMoney(cash)} · Telebirr ${formatMoney(tele)} · CBE ${formatMoney(cbe)}`;
}

export function tickStats(state) {
  renderStats(state);
  document.querySelectorAll('.console').forEach((el, i) => {
    const con = state.consoles[i];
    if (!con) return;
    const totalEl = el.querySelector('.metrics div:last-child b');
    if (totalEl) totalEl.textContent = formatMoney(getCharge(con));
    if (con.mode === 'MISSION') {
      const missionLine = el.querySelector('.bubblearea .payline:last-child b');
      if (missionLine) missionLine.textContent = formatMoney(getCharge(con));
    }
  });
}

export function initDashboardListeners(state, renderAll) {
  document.getElementById('toggleStats').addEventListener('click', () => {
    state.hidden = !state.hidden;
    saveState(state);
    renderStatsVisibility(state);
    renderStats(state);
  });
}
