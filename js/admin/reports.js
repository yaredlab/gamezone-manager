/**
 * admin/reports.js
 * Business reports: daily, weekly, monthly summaries.
 * Console and worker performance breakdown.
 * CSV export of full transaction history.
 */

import { formatMoney, esc } from '../shared/helpers.js';

/** @type {'daily'|'weekly'|'monthly'} */
let activeRange = 'daily';

/**
 * Filter transactions to a date range relative to today.
 * @param {Array} txList
 * @param {'daily'|'weekly'|'monthly'} range
 * @returns {Array}
 */
function filterByRange(txList, range) {
  const now   = new Date();
  const start = new Date(now);

  if (range === 'daily') {
    start.setHours(0, 0, 0, 0);
  } else if (range === 'weekly') {
    start.setDate(now.getDate() - 6);
    start.setHours(0, 0, 0, 0);
  } else {
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
  }

  return txList.filter(t => t.date >= start);
}

/**
 * Normalise a raw transaction for reporting.
 */
function normalise(tx) {
  const m = tx.method || '';
  let method = tx.provider || '';
  if (!method) {
    if (m.includes('Telebirr'))        method = 'Telebirr';
    else if (m.includes('Commercial')) method = 'Commercial Bank of Ethiopia';
    else if (m === 'Cash')             method = 'Cash';
    else                               method = m || 'Unknown';
  }
  return {
    ...tx,
    method,
    amount:  Number(tx.amount) || 0,
    console: tx.console || '—',
    date:    new Date(tx.createdAt || tx.timestamp || Date.now()),
  };
}

/**
 * Render the reports page.
 * @param {AppState} state
 */
export function renderReports(state) {
  const allTx    = (state.transactions || []).map(normalise);
  const rangedTx = filterByRange(allTx, activeRange);

  const sum = arr => arr.reduce((n, t) => n + t.amount, 0);

  /* ── Summary cards ── */
  document.getElementById('reportCount').textContent = rangedTx.length;
  document.getElementById('reportTotal').textContent = formatMoney(sum(rangedTx));

  /* ── Payment method breakdown ── */
  const cash = sum(rangedTx.filter(t => t.method === 'Cash'));
  const tele = sum(rangedTx.filter(t => t.method === 'Telebirr'));
  const cbe  = sum(rangedTx.filter(t => t.method === 'Commercial Bank of Ethiopia'));
  const max  = Math.max(cash, tele, cbe, 1);

  document.getElementById('rptCashTotal').textContent = formatMoney(cash);
  document.getElementById('rptTeleTotal').textContent = formatMoney(tele);
  document.getElementById('rptCbeTotal').textContent  = formatMoney(cbe);
  document.getElementById('rptCashBar').style.width   = (cash / max * 100) + '%';
  document.getElementById('rptTeleBar').style.width   = (tele / max * 100) + '%';
  document.getElementById('rptCbeBar').style.width    = (cbe  / max * 100) + '%';

  /* ── Console performance table ── */
  const byConsole = {};
  rangedTx.forEach(t => {
    const ids = (t.console || '').split(',').map(s => s.trim());
    ids.forEach(id => {
      if (!byConsole[id]) byConsole[id] = { total: 0, count: 0 };
      byConsole[id].total += t.amount / ids.length;
      byConsole[id].count++;
    });
  });

  const consoleRows = Object.entries(byConsole)
    .sort((a, b) => b[1].total - a[1].total)
    .map(([id, { total, count }]) => `
      <tr>
        <td><b>${esc(id)}</b></td>
        <td>${count}</td>
        <td class="amt-green">${formatMoney(total)}</td>
      </tr>`).join('');

  document.getElementById('consoleReport').innerHTML = consoleRows ||
    `<tr><td colspan="3" class="admin-empty">No data for this period.</td></tr>`;

  /* ── Highlight active range button ── */
  ['daily','weekly','monthly'].forEach(r => {
    document.getElementById(`range-${r}`).classList.toggle('primary', r === activeRange);
  });
}

/**
 * Export all transactions in the current range to CSV.
 * @param {AppState} state
 */
export function exportReportCSV(state) {
  const allTx    = (state.transactions || []).map(normalise);
  const rangedTx = filterByRange(allTx, activeRange).sort((a, b) => b.date - a.date);

  const header = ['Date', 'Time', 'Console', 'Payment Method', 'Amount (ETB)'];
  const rows   = rangedTx.map(t => [
    t.date.toLocaleDateString(),
    t.date.toLocaleTimeString(),
    t.console,
    t.method,
    t.amount,
  ]);

  const csv  = [header, ...rows].map(r => r.map(x => `"${String(x).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = `gamezone-report-${activeRange}-${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Bind report range buttons and export button.
 * @param {AppState} state
 * @param {Function} renderAll
 */
export function initReportsListeners(state, renderAll) {
  ['daily','weekly','monthly'].forEach(r => {
    document.getElementById(`range-${r}`).addEventListener('click', () => {
      activeRange = r;
      renderAll();
    });
  });
  document.getElementById('reportExport').addEventListener('click', () => exportReportCSV(state));
}
