/**
 * admin/transactions.js
 * Full transaction history with advanced search, filters,
 * scrollable table container, and CSV export.
 */

import { formatMoney, esc } from '../shared/helpers.js';

/**
 * Normalise a raw transaction for display.
 * @param {Object} tx
 * @param {number} index
 * @returns {Object}
 */
function normalise(tx, index) {
  const m = tx.method || '';
  let method = tx.provider || '';
  if (!method) {
    if (m.includes('Telebirr'))        method = 'Telebirr';
    else if (m.includes('Commercial')) method = 'Commercial Bank of Ethiopia';
    else if (m === 'Cash')             method = 'Cash';
    else                               method = m || 'Unknown';
  }

  const d = new Date(tx.createdAt || tx.timestamp || Date.now());
  const matchesCount = tx.matchesCount ||
    (tx.description && tx.description.match(/\d+/) ? tx.description.match(/\d+/)[0] : 1);

  return {
    ...tx,
    id: tx.id || `TXN-${String(index + 1).padStart(4, '0')}`,
    method,
    matchesCount,
    amount:  Number(tx.amount) || 0,
    console: tx.console || '—',
    desc:    tx.description || 'Payment',
    date:    d,
    time:    tx.time || d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    status:  'PAID',
  };
}

/**
 * Date range checking helper.
 */
function matchesDateFilter(d, filter) {
  if (filter === 'all') return true;

  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);

  if (filter === 'today') {
    return d >= startToday;
  }
  if (filter === 'yesterday') {
    const startYest = new Date(startToday);
    startYest.setDate(startYest.getDate() - 1);
    const endYest = new Date(startToday);
    endYest.setMilliseconds(-1);
    return d >= startYest && d <= endYest;
  }
  if (filter === 'week') {
    const startWeek = new Date(startToday);
    startWeek.setDate(startWeek.getDate() - 6);
    return d >= startWeek;
  }
  if (filter === 'month') {
    const startMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
    return d >= startMonth;
  }
  return true;
}

/**
 * Build a single transaction row HTML string.
 * @param {Object} t - normalised transaction
 * @returns {string}
 */
function buildRow(t) {
  const methodBadge = t.method === 'Cash'
    ? 'pill'
    : t.method === 'Telebirr'
      ? 'pill pill-tele'
      : 'pill pill-cbe';

  return `
    <tr>
      <td><span class="tx-ref">#${esc(t.id)}</span></td>
      <td>${esc(t.date.toLocaleDateString())}</td>
      <td><span class="tx-time">${esc(t.time)}</span></td>
      <td><b>${esc(t.console)}</b></td>
      <td><span class="${methodBadge}">${esc(t.method)}</span></td>
      <td><b>${esc(t.matchesCount)}</b> match(es)</td>
      <td class="amt-green">+${formatMoney(t.amount)}</td>
      <td><span class="pill pill-live">PAID ✓</span></td>
    </tr>`;
}

/**
 * Filter transactions based on current UI inputs.
 */
function getFilteredTransactions(state) {
  const methodEl = document.getElementById('filterMethod');
  const queryEl  = document.getElementById('searchTx');
  const statusEl = document.getElementById('filterStatus');
  const dateEl   = document.getElementById('filterDate');

  const methodFilter = methodEl ? methodEl.value : 'all';
  const query        = queryEl  ? (queryEl.value || '').toLowerCase().trim() : '';
  const statusFilter = statusEl ? statusEl.value : 'all';
  const dateFilter   = dateEl   ? dateEl.value : 'all';

  const all = (state.transactions || []).map((t, i) => normalise(t, i));

  return all.filter(t => {
    // Method filter
    const methodMatch = methodFilter === 'all' || t.method === methodFilter;
    // Status filter
    const statusMatch = statusFilter === 'all' || t.status.toLowerCase() === statusFilter.toLowerCase();
    // Date filter
    const dateMatch = matchesDateFilter(t.date, dateFilter);
    // Text search filter (console, id, description, method)
    const textMatch = !query || `${t.id} ${t.console} ${t.desc} ${t.method}`.toLowerCase().includes(query);

    return methodMatch && statusMatch && dateMatch && textMatch;
  });
}

/**
 * Render the transaction table, applying current filter and search values.
 * @param {AppState} state
 */
export function renderTransactions(state) {
  const allCount = (state.transactions || []).length;
  const filtered = getFilteredTransactions(state);

  // Newest first
  const sorted = filtered.slice().sort((a, b) => b.date - a.date);

  // Summary row counts
  const counterEl = document.getElementById('txResultCount');
  if (counterEl) {
    counterEl.textContent = `Showing ${sorted.length} of ${allCount} transactions`;
  }

  const rowsEl = document.getElementById('allRows');
  if (rowsEl) {
    rowsEl.innerHTML = sorted.length
      ? sorted.map(t => buildRow(t)).join('')
      : `<tr><td colspan="8" class="admin-empty" style="text-align:center;padding:30px">No transactions match the selected filters.</td></tr>`;
  }
}

/**
 * Export currently filtered transactions as a CSV file.
 * @param {AppState} state
 */
export function exportCSV(state) {
  const filtered = getFilteredTransactions(state).sort((a, b) => b.date - a.date);

  if (!filtered.length) {
    alert('No transactions to export.');
    return;
  }

  const header = ['Transaction ID', 'Date', 'Time', 'Console', 'Payment Method', 'Matches', 'Amount (ETB)', 'Status', 'Description'];
  const rows = filtered.map(t => [
    t.id,
    t.date.toLocaleDateString(),
    t.time,
    t.console,
    t.method,
    t.matchesCount,
    t.amount.toFixed(2),
    t.status,
    t.desc,
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
  const bind = (id, event) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener(event, () => renderTransactions(state));
  };

  bind('filterMethod', 'change');
  bind('filterStatus', 'change');
  bind('filterDate',   'change');
  bind('searchTx',     'input');

  const exportBtn = document.getElementById('export');
  if (exportBtn) {
    exportBtn.addEventListener('click', () => exportCSV(state));
  }
}
