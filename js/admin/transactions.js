/**
 * admin/transactions.js
 * Full transaction history with search, filter, and CSV export.
 */

import { formatMoney, esc } from '../shared/helpers.js';

/**
 * Normalise a raw transaction for display.
 * @param {Object} tx
 * @returns {Object}
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
    desc:    tx.description || 'Payment',
    date:    new Date(tx.createdAt || tx.timestamp || Date.now()),
  };
}

/**
 * Build a single transaction row HTML string.
 * @param {Object} t - normalised transaction
 * @param {number} index - row number for reference
 * @returns {string}
 */
function buildRow(t, index) {
  const refNum = `TXN-${String(index + 1).padStart(4, '0')}`;
  const methodBadge = t.method === 'Cash'
    ? 'pill'
    : t.method === 'Telebirr'
      ? 'pill pill-tele'
      : 'pill pill-cbe';

  return `
    <tr>
      <td class="tx-ref">${esc(refNum)}</td>
      <td>${esc(t.date.toLocaleDateString())} <span class="tx-time">${esc(t.date.toLocaleTimeString())}</span></td>
      <td><b>${esc(t.console)}</b></td>
      <td><span class="${methodBadge}">${esc(t.method)}</span></td>
      <td>${esc(t.desc)}</td>
      <td class="amt-green">+${formatMoney(t.amount)}</td>
    </tr>`;
}

/**
 * Render the transaction table, applying current filter and search values.
 * @param {AppState} state
 */
export function renderTransactions(state) {
  const methodFilter = document.getElementById('filterMethod').value;
  const query        = (document.getElementById('searchTx').value || '').toLowerCase().trim();

  const all = (state.transactions || []).map(normalise);

  const filtered = all.filter(t => {
    const methodMatch = methodFilter === 'all' || t.method === methodFilter;
    const textMatch   = !query || `${t.console} ${t.desc} ${t.method}`.toLowerCase().includes(query);
    return methodMatch && textMatch;
  });

  /* Newest first */
  const sorted = filtered.slice().sort((a, b) => b.date - a.date);

  /* Summary row counts */
  document.getElementById('txResultCount').textContent =
    `${sorted.length} of ${all.length} transactions`;

  document.getElementById('allRows').innerHTML = sorted.length
    ? sorted.map((t, i) => buildRow(t, i)).join('')
    : `<tr><td colspan="6" class="admin-empty">No transactions match the current filters.</td></tr>`;
}

/**
 * Export currently filtered transactions as a CSV file.
 * @param {AppState} state
 */
export function exportCSV(state) {
  const methodFilter = document.getElementById('filterMethod').value;
  const query        = (document.getElementById('searchTx').value || '').toLowerCase().trim();

  const all = (state.transactions || []).map(normalise);
  const filtered = all
    .filter(t => {
      const methodMatch = methodFilter === 'all' || t.method === methodFilter;
      const textMatch   = !query || `${t.console} ${t.desc}`.toLowerCase().includes(query);
      return methodMatch && textMatch;
    })
    .sort((a, b) => b.date - a.date);

  const header = ['Reference', 'Date', 'Time', 'Console', 'Payment Method', 'Description', 'Amount (ETB)'];
  const rows = filtered.map((t, i) => [
    `TXN-${String(i + 1).padStart(4, '0')}`,
    t.date.toLocaleDateString(),
    t.date.toLocaleTimeString(),
    t.console,
    t.method,
    t.desc,
    t.amount,
  ]);

  const csvContent = [header, ...rows]
    .map(row => row.map(x => `"${String(x).replace(/"/g, '""')}"`).join(','))
    .join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `gamezone-transactions-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Bind filter and search inputs.
 * @param {AppState} state
 */
export function initTransactionListeners(state) {
  document.getElementById('filterMethod').addEventListener('change', () => renderTransactions(state));
  document.getElementById('searchTx').addEventListener('input',      () => renderTransactions(state));
  document.getElementById('export').addEventListener('click', () => exportCSV(state));
}
