/**
 * admin/overview.js
 * Renders the Overview page: stat cards, payment method bars,
 * console activity panel, and recent transactions table.
 */

import { formatMoney, esc, getCharge, getPaid } from '../shared/helpers.js';
import { getPricing } from '../shared/api.js';

/**
 * Derive a normalised payment method label from a raw transaction object.
 * Handles legacy records where method and provider are stored differently.
 * @param {Object} tx
 * @returns {string}
 */
function resolveMethod(tx) {
  if (tx.provider) return tx.provider;
  const m = tx.method || '';
  if (m.includes('Telebirr'))        return 'Telebirr';
  if (m.includes('Commercial Bank')) return 'Commercial Bank of Ethiopia';
  if (m === 'Cash')                  return 'Cash';
  return m || 'Unknown';
}

/**
 * Render the entire Overview page from the shared worker state.
 * @param {AppState} state - loaded from shared storage
 */
export function renderOverview(state) {
  const pricing = getPricing();
  const now     = new Date();

  /* Normalise transactions with method labels and Date objects */
  const allTx = (state.transactions || []).map(t => ({
    ...t,
    method:  resolveMethod(t),
    amount:  Number(t.amount) || 0,
    console: t.console || '—',
    desc:    t.description || 'Payment',
    date:    new Date(t.createdAt || t.timestamp || Date.now()),
  }));

  const todayTx = allTx.filter(t => t.date.toDateString() === now.toDateString());
  const monthTx = allTx.filter(
    t => t.date.getMonth() === now.getMonth() && t.date.getFullYear() === now.getFullYear()
  );

  const sum = arr => arr.reduce((n, t) => n + t.amount, 0);

  /* ── Stat cards ── */
  document.getElementById('todayTotal').textContent   = formatMoney(sum(todayTx));
  document.getElementById('monthTotal').textContent   = formatMoney(sum(monthTx));
  document.getElementById('todayMatches').textContent =
    (state.consoles || []).reduce((n, c) => n + (c.matches || []).length, 0);

  /* Unpaid balance using shared helper calculation */
  const unpaid = (state.consoles || []).reduce((n, c) => {
    return n + Math.max(0, getCharge(c) - getPaid(c));
  }, 0);
  document.getElementById('unpaid').textContent = formatMoney(unpaid);

  /* ── Payment method bars ── */
  const cash = sum(todayTx.filter(t => t.method === 'Cash'));
  const tele = sum(todayTx.filter(t => t.method === 'Telebirr'));
  const cbe  = sum(todayTx.filter(t => t.method === 'Commercial Bank of Ethiopia'));
  const max  = Math.max(cash, tele, cbe, 1);

  document.getElementById('cashTotal').textContent = formatMoney(cash);
  document.getElementById('teleTotal').textContent = formatMoney(tele);
  document.getElementById('cbeTotal').textContent  = formatMoney(cbe);
  document.getElementById('cashBar').style.width   = (cash / max * 100) + '%';
  document.getElementById('teleBar').style.width   = (tele / max * 100) + '%';
  document.getElementById('cbeBar').style.width    = (cbe  / max * 100) + '%';

  /* ── Console activity ── */
  const consoles = state.consoles || [];
  document.getElementById('activeSessions').textContent =
    consoles.filter(c => c.status === 'playing' || c.status === 'paused').length;
  document.getElementById('consoleCount').textContent = consoles.length;

  /* ── Recent transactions (last 6, newest first) ── */
  const recent = allTx.slice().reverse().slice(0, 6);
  document.getElementById('recentRows').innerHTML = recent.length
    ? recent.map(t => `
        <tr>
          <td>${esc(t.date.toLocaleTimeString())}</td>
          <td>${esc(t.console)}</td>
          <td><span class="pill">${esc(t.method)}</span></td>
          <td>${esc(t.desc)}</td>
          <td class="amt-green">+${formatMoney(t.amount)}</td>
        </tr>`).join('')
    : `<tr><td colspan="5" class="admin-empty">
        No transactions yet. Worker transactions recorded in the same browser appear here automatically.
       </td></tr>`;
}
