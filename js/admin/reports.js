/**
 * admin/reports.js
 * Business reports: daily, weekly, monthly summaries.
 * Console performance breakdown with expandable transaction inspection.
 * All transactions table in selected reporting period with independent vertical scrolling.
 * CSV export of reporting period transaction history.
 */

import { formatMoney, esc } from '../shared/helpers.js';

/** @type {'daily'|'weekly'|'monthly'} */
let activeRange = 'daily';

/** @type {string|null} */
let expandedConsole = null;

/** @type {AppState|null} */
let _latestState = null;

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
 * @param {Object} tx
 * @param {number} index
 * @returns {Object}
 */
function normalise(tx, index = 0) {
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
    date:    d,
    time:    tx.time || d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    status:  'PAID',
  };
}

/**
 * Render the reports page.
 * @param {AppState} state
 */
export function renderReports(state) {
  _latestState = state;

  const allTx    = (state.transactions || []).map((t, i) => normalise(t, i));
  const rangedTx = filterByRange(allTx, activeRange);

  const sum = arr => arr.reduce((n, t) => n + t.amount, 0);

  /* ── Summary cards ── */
  const countEl = document.getElementById('reportCount');
  const totalEl = document.getElementById('reportTotal');
  if (countEl) countEl.textContent = rangedTx.length;
  if (totalEl) totalEl.textContent = formatMoney(sum(rangedTx));

  /* ── Payment method breakdown ── */
  const cash = sum(rangedTx.filter(t => t.method === 'Cash'));
  const tele = sum(rangedTx.filter(t => t.method === 'Telebirr'));
  const cbe  = sum(rangedTx.filter(t => t.method === 'Commercial Bank of Ethiopia'));
  const max  = Math.max(cash, tele, cbe, 1);

  const cashTotEl = document.getElementById('rptCashTotal');
  const teleTotEl = document.getElementById('rptTeleTotal');
  const cbeTotEl  = document.getElementById('rptCbeTotal');
  const cashBar   = document.getElementById('rptCashBar');
  const teleBar   = document.getElementById('rptTeleBar');
  const cbeBar    = document.getElementById('rptCbeBar');

  if (cashTotEl) cashTotEl.textContent = formatMoney(cash);
  if (teleTotEl) teleTotEl.textContent = formatMoney(tele);
  if (cbeTotEl)  cbeTotEl.textContent  = formatMoney(cbe);
  if (cashBar)   cashBar.style.width   = (cash / max * 100) + '%';
  if (teleBar)   teleBar.style.width   = (tele / max * 100) + '%';
  if (cbeBar)    cbeBar.style.width    = (cbe  / max * 100) + '%';

  /* ── Console performance table ── */
  const byConsole = {};
  rangedTx.forEach(t => {
    const ids = (t.console || '').split(',').map(s => s.trim()).filter(Boolean);
    const consoleKeys = ids.length ? ids : ['Unassigned'];
    consoleKeys.forEach(id => {
      if (!byConsole[id]) byConsole[id] = { total: 0, count: 0, txs: [] };
      byConsole[id].total += t.amount / consoleKeys.length;
      byConsole[id].count++;
      byConsole[id].txs.push(t);
    });
  });

  const consoleReportEl = document.getElementById('consoleReport');
  if (consoleReportEl) {
    const consoleEntries = Object.entries(byConsole).sort((a, b) => b[1].total - a[1].total);

    if (!consoleEntries.length) {
      consoleReportEl.innerHTML = `<tr><td colspan="4" class="admin-empty">No console activity for this period.</td></tr>`;
    } else {
      let rowsHtml = '';
      consoleEntries.forEach(([id, { total, count, txs }]) => {
        const isExpanded = (expandedConsole === id);
        rowsHtml += `
          <tr>
            <td><b>${esc(id)}</b></td>
            <td>${count}</td>
            <td class="amt-green">${formatMoney(total)}</td>
            <td style="text-align:right">
              <button class="console-inspect-btn" data-inspect="${esc(id)}" type="button">
                ${isExpanded ? '▲ Close' : '▼ Inspect'}
              </button>
            </td>
          </tr>`;

        if (isExpanded) {
          const subRows = txs.map(txItem => {
            const badgeClass = txItem.method === 'Cash'
              ? 'pill'
              : txItem.method === 'Telebirr'
                ? 'pill pill-tele'
                : 'pill pill-cbe';

            return `
              <tr>
                <td>${esc(txItem.date.toLocaleDateString())}</td>
                <td><span class="tx-time">${esc(txItem.time)}</span></td>
                <td><span class="${badgeClass}">${esc(txItem.method)}</span></td>
                <td><b>${esc(txItem.matchesCount)}</b> match(es)</td>
                <td class="amt-green">+${formatMoney(txItem.amount)}</td>
                <td><span class="pill pill-live" style="font-size:10px">PAID ✓</span></td>
              </tr>`;
          }).join('');

          rowsHtml += `
            <tr class="console-detail-row">
              <td colspan="4" style="padding:0">
                <div class="console-subtable-box">
                  <div style="font-size:11px;font-weight:700;margin-bottom:8px;color:var(--cyan);display:flex;justify-content:space-between">
                    <span>${esc(id)} — Detailed Transactions (${txs.length})</span>
                    <span>Total: ${formatMoney(total)}</span>
                  </div>
                  <table style="width:100%;font-size:11px">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Time</th>
                        <th>Method</th>
                        <th>Matches</th>
                        <th>Amount</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${subRows}
                    </tbody>
                  </table>
                </div>
              </td>
            </tr>`;
        }
      });

      consoleReportEl.innerHTML = rowsHtml;

      // Attach click listeners to all inspect buttons
      consoleReportEl.querySelectorAll('.console-inspect-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const consoleId = e.currentTarget.getAttribute('data-inspect');
          expandedConsole = (expandedConsole === consoleId) ? null : consoleId;
          if (_latestState) renderReports(_latestState);
        });
      });
    }
  }

  /* ── All Transactions in Selected Period ── */
  const titleEl = document.getElementById('rptRangeTitle');
  if (titleEl) {
    const titles = { daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly' };
    titleEl.textContent = titles[activeRange] || 'Daily';
  }

  const rptAllTxCountEl = document.getElementById('rptAllTxCount');
  if (rptAllTxCountEl) {
    rptAllTxCountEl.textContent = `${rangedTx.length} transaction${rangedTx.length === 1 ? '' : 's'} recorded`;
  }

  const rptAllRowsEl = document.getElementById('rptAllRows');
  if (rptAllRowsEl) {
    const sorted = [...rangedTx].sort((a, b) => b.date - a.date);
    if (!sorted.length) {
      rptAllRowsEl.innerHTML = `<tr><td colspan="7" class="admin-empty">No transactions found in this reporting period.</td></tr>`;
    } else {
      rptAllRowsEl.innerHTML = sorted.map(t => {
        const methodBadge = t.method === 'Cash'
          ? 'pill'
          : t.method === 'Telebirr'
            ? 'pill pill-tele'
            : 'pill pill-cbe';
        return `
          <tr>
            <td>${esc(t.date.toLocaleDateString())}</td>
            <td><span class="tx-time">${esc(t.time)}</span></td>
            <td><b>${esc(t.console)}</b></td>
            <td><span class="${methodBadge}">${esc(t.method)}</span></td>
            <td><b>${esc(t.matchesCount)}</b> match(es)</td>
            <td class="amt-green">+${formatMoney(t.amount)}</td>
            <td><span class="pill pill-live">PAID ✓</span></td>
          </tr>`;
      }).join('');
    }
  }

  /* ── Highlight active range button ── */
  ['daily','weekly','monthly'].forEach(r => {
    const btn = document.getElementById(`range-${r}`);
    if (btn) btn.classList.toggle('primary', r === activeRange);
  });
}

/**
 * Export all transactions in the current range to CSV.
 * @param {AppState} state
 */
export function exportReportCSV(state) {
  const allTx    = (state.transactions || []).map((t, i) => normalise(t, i));
  const rangedTx = filterByRange(allTx, activeRange).sort((a, b) => b.date - a.date);

  const header = ['Date', 'Time', 'Console', 'Payment Method', 'Matches', 'Amount (ETB)', 'Status'];
  const rows   = rangedTx.map(t => [
    t.date.toLocaleDateString(),
    t.time,
    t.console,
    t.method,
    t.matchesCount,
    t.amount,
    t.status,
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
  _latestState = state;
  ['daily','weekly','monthly'].forEach(r => {
    const btn = document.getElementById(`range-${r}`);
    if (btn) {
      btn.addEventListener('click', () => {
        activeRange = r;
        expandedConsole = null; // reset expanded console on range switch
        renderAll();
      });
    }
  });

  const exportBtn = document.getElementById('reportExport');
  if (exportBtn) {
    exportBtn.addEventListener('click', () => exportReportCSV(_latestState || state));
  }
}
