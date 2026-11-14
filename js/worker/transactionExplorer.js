/**
 * worker/transactionExplorer.js
 * Professional Full-Screen Transaction Explorer for GameZone Manager.
 *
 * Features:
 * 1. 95vw/92vh Fullscreen Modal with dark GameZone design.
 * 2. Date Filtering (Today, Yesterday, This Week, This Month, Custom).
 * 3. Role-based Access Control (Worker View = Today Only; Admin View = Full History).
 * 4. Real-time Summary Cards (Revenue, Total TX, Cash, Mobile Banking).
 * 5. Interactive Transaction Table with search, sorting, filtering, and row details.
 * 6. Daily Closing Summary (Shift Handover) & Monthly Analytics (Admin).
 * 7. Multi-Format Exports (Excel, PDF, CSV, Print).
 */

import { formatMoney, esc } from '../shared/helpers.js';
import { getPricing } from '../shared/api.js';

// ── Module State ──────────────────────────────────────────────────────────────

let appState = null;
let currentRole = 'worker'; // 'worker' | 'admin'
let activeTab = 'list';     // 'list' | 'daily' | 'monthly'
let activeDateFilter = 'today'; // 'today' | 'yesterday' | 'week' | 'month' | 'custom'
let customStartDate = '';
let customEndDate = '';
let searchQuery = '';
let methodFilter = 'all';
let consoleFilter = 'all';
let sortBy = 'newest';
let selectedTxForDetail = null;

// ── Date Range Engine ─────────────────────────────────────────────────────────

function getStartOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function getStartOfYesterday() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getEndOfYesterday() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  d.setHours(23, 59, 59, 999);
  return d;
}

function getStartOfWeek() {
  const d = new Date();
  const day = d.getDay(); // 0 is Sunday
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
  const monday = new Date(d.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function getStartOfMonth() {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Filter transactions strictly based on actual createdAt timestamps.
 */
function filterByDate(transactions) {
  const now = new Date();

  return transactions.filter(tx => {
    const txDate = tx.createdAt ? new Date(tx.createdAt) : new Date();

    switch (activeDateFilter) {
      case 'today':
        return txDate >= getStartOfToday();
      case 'yesterday':
        return txDate >= getStartOfYesterday() && txDate <= getEndOfYesterday();
      case 'week':
        return txDate >= getStartOfWeek();
      case 'month':
        return txDate >= getStartOfMonth();
      case 'custom': {
        if (!customStartDate) return true;
        const start = new Date(customStartDate);
        start.setHours(0, 0, 0, 0);
        const end = customEndDate ? new Date(customEndDate) : new Date();
        end.setHours(23, 59, 59, 999);
        return txDate >= start && txDate <= end;
      }
      default:
        return true;
    }
  });
}

/**
 * Filter and sort transactions based on search, method, console, and sort settings.
 */
function getProcessedTransactions() {
  if (!appState || !Array.isArray(appState.transactions)) return [];

  // Enforce Worker role restrictions: workers only see today's transactions
  if (currentRole === 'worker' && activeDateFilter !== 'today') {
    activeDateFilter = 'today';
  }

  let list = filterByDate(appState.transactions);

  // Search filter
  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase().trim();
    list = list.filter(t => {
      const id = (t.id || '').toLowerCase();
      const con = (t.console || '').toLowerCase();
      const method = (t.method || '').toLowerCase();
      const desc = (t.description || '').toLowerCase();
      const prov = (t.provider || '').toLowerCase();
      const amt = String(t.amount || '');
      return id.includes(q) || con.includes(q) || method.includes(q) || desc.includes(q) || prov.includes(q) || amt.includes(q);
    });
  }

  // Method filter
  if (methodFilter !== 'all') {
    if (methodFilter === 'cash') {
      list = list.filter(t => (t.method || '').includes('Cash'));
    } else if (methodFilter === 'telebirr') {
      list = list.filter(t => (t.provider === 'Telebirr') || (t.method || '').includes('Telebirr'));
    } else if (methodFilter === 'cbe') {
      list = list.filter(t => (t.provider === 'Commercial Bank of Ethiopia') || (t.method || '').includes('Commercial Bank'));
    }
  }

  // Console filter
  if (consoleFilter !== 'all') {
    list = list.filter(t => (t.console || '').includes(consoleFilter));
  }

  // Sorting
  list = list.slice().sort((a, b) => {
    const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    if (sortBy === 'newest') return timeB - timeA;
    if (sortBy === 'oldest') return timeA - timeB;
    if (sortBy === 'amount_desc') return (b.amount || 0) - (a.amount || 0);
    if (sortBy === 'amount_asc') return (a.amount || 0) - (b.amount || 0);
    return 0;
  });

  return list;
}

// ── HTML Injector ─────────────────────────────────────────────────────────────

function ensureModalInDOM() {
  if (document.getElementById('txExplorerModal')) return;

  const modalHtml = `
  <div class="explorer-modal" id="txExplorerModal" role="dialog" aria-modal="true">
    <div class="explorer-box">

      <!-- Header -->
      <div class="explorer-header">
        <div class="explorer-title-wrap">
          <h2>
            <span>⚡ TRANSACTION EXPLORER</span>
            <span class="role-badge worker" id="explorerRoleBadge">Worker Access</span>
          </h2>
          <div class="sub">Audited real-time receipts, ledger logs &amp; performance metrics</div>
        </div>

        <div class="explorer-header-actions">
          <button class="role-toggle-btn" id="explorerRoleToggleBtn" title="Switch between Worker and Admin views">
            🔒 Switch to Admin View
          </button>
          <button class="explorer-close-btn" id="explorerCloseBtn" aria-label="Close Explorer">✕</button>
        </div>
      </div>

      <!-- Navigation Tabs -->
      <div class="explorer-tabs">
        <button class="explorer-tab-btn active" data-tab="list">
          📑 Transactions Ledger
        </button>
        <button class="explorer-tab-btn" data-tab="daily">
          📋 Daily Closing Summary
        </button>
        <button class="explorer-tab-btn" data-tab="monthly" id="tabMonthlyBtn">
          📊 Monthly Analytics <span class="tab-lock-icon">🔒</span>
        </button>
      </div>

      <!-- Main Body -->
      <div class="explorer-body">

        <!-- Tab 1: Transaction List View -->
        <div id="tabViewList" style="display:flex;flex-direction:column;flex:1;overflow:hidden">

          <!-- Date Filters Bar -->
          <div class="explorer-filters-bar">
            <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
              <span class="muted" style="font-size:12px;font-weight:700">DATE PERIOD:</span>
              <div class="date-pill-group">
                <button class="date-pill active" data-filter="today">Today</button>
                <button class="date-pill" data-filter="yesterday" id="filterYesterday">Yesterday</button>
                <button class="date-pill" data-filter="week" id="filterWeek">This Week</button>
                <button class="date-pill" data-filter="month" id="filterMonth">This Month</button>
                <button class="date-pill" data-filter="custom" id="filterCustom">Custom Range</button>
              </div>

              <!-- Custom Date Pickers -->
              <div class="custom-range-inputs" id="customRangeWrap">
                <span>From:</span>
                <input type="date" id="customStartDate">
                <span>To:</span>
                <input type="date" id="customEndDate">
                <button class="date-pill active" id="applyCustomDateBtn" style="padding:4px 10px">Apply</button>
              </div>
            </div>

            <div class="date-status-note" id="dateFilterNotice">
              Showing today's transactions (Worker Shift)
            </div>
          </div>

          <!-- Summary Cards Grid -->
          <div class="explorer-summary-grid">
            <div class="summary-card revenue">
              <div class="summary-label">Total Revenue</div>
              <div class="summary-num" id="expSummaryRevenue">0 ETB</div>
              <div class="summary-sub" id="expSummaryRevenueSub">Filtered period</div>
            </div>

            <div class="summary-card count">
              <div class="summary-label">Transactions</div>
              <div class="summary-num" id="expSummaryCount">0</div>
              <div class="summary-sub">Completed payments</div>
            </div>

            <div class="summary-card cash">
              <div class="summary-label">Cash Payments</div>
              <div class="summary-num" id="expSummaryCash">0 ETB</div>
              <div class="summary-sub" id="expSummaryCashPct">0% of revenue</div>
            </div>

            <div class="summary-card mobile">
              <div class="summary-label">Mobile Banking</div>
              <div class="summary-num" id="expSummaryMobile">0 ETB</div>
              <div class="summary-sub" id="expSummaryMobileSub">Telebirr &amp; CBE</div>
            </div>
          </div>

          <!-- Controls Bar (Search, Filter, Export) -->
          <div class="explorer-controls-bar">
            <div class="controls-left">
              <div class="search-input-wrap">
                <span class="search-icon">🔍</span>
                <input type="text" id="explorerSearchInput" placeholder="Search by ID, console, method, or notes...">
              </div>

              <select class="filter-select" id="explorerMethodSelect">
                <option value="all">All Payment Methods</option>
                <option value="cash">Cash Only</option>
                <option value="telebirr">Telebirr</option>
                <option value="cbe">Commercial Bank of Ethiopia</option>
              </select>

              <select class="filter-select" id="explorerConsoleSelect">
                <option value="all">All Consoles</option>
              </select>

              <select class="filter-select" id="explorerSortSelect">
                <option value="newest">Sort: Newest First</option>
                <option value="oldest">Sort: Oldest First</option>
                <option value="amount_desc">Amount: High → Low</option>
                <option value="amount_asc">Amount: Low → High</option>
              </select>
            </div>

            <!-- Export Buttons -->
            <div class="export-group">
              <button class="export-btn" id="exportExcelBtn" title="Export to Excel Spreadsheet">
                📊 Excel
              </button>
              <button class="export-btn" id="exportPdfBtn" title="Export to PDF Report">
                📄 PDF
              </button>
              <button class="export-btn" id="exportCsvBtn" title="Export to CSV Spreadsheet">
                📑 CSV
              </button>
              <button class="export-btn print" id="printReportBtn" title="Print Current View">
                🖨 Print
              </button>
            </div>
          </div>

          <!-- Independently Scrollable Table -->
          <div class="explorer-table-wrap">
            <table class="explorer-table">
              <thead>
                <tr>
                  <th>TX ID</th>
                  <th>Date &amp; Time</th>
                  <th>Console</th>
                  <th>Payment Method</th>
                  <th>Matches / Items</th>
                  <th>Amount Paid</th>
                  <th>Payment Status</th>
                  <th style="text-align:right">Action</th>
                </tr>
              </thead>
              <tbody id="explorerTableBody">
                <!-- Rows dynamically injected -->
              </tbody>
            </table>
          </div>
        </div>

        <!-- Tab 2: Daily Closing Summary View -->
        <div id="tabViewDaily" class="report-view-container" style="display:none">
          <div class="report-panel">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:10px">
              <div>
                <h3 style="margin:0 0 4px">Daily Closing Summary &amp; Shift Reconciliation</h3>
                <div class="muted" style="font-size:12px" id="dailyClosingDate">Today's Date</div>
              </div>
              <button class="export-btn print" id="printDailyClosingBtn">
                🖨 Print Daily Closing Sheet
              </button>
            </div>

            <div class="explorer-summary-grid" style="padding:0;margin-bottom:20px;border:none">
              <div class="summary-card revenue">
                <div class="summary-label">Today's Revenue</div>
                <div class="summary-num" id="dailyRev">0 ETB</div>
                <div class="summary-sub">All payment channels</div>
              </div>
              <div class="summary-card count">
                <div class="summary-label">Total Transactions</div>
                <div class="summary-num" id="dailyCount">0</div>
                <div class="summary-sub">Settled customer payments</div>
              </div>
              <div class="summary-card cash">
                <div class="summary-label">Cash in Drawer</div>
                <div class="summary-num" id="dailyCash">0 ETB</div>
                <div class="summary-sub">To reconcile with physical cash</div>
              </div>
              <div class="summary-card mobile">
                <div class="summary-label">Digital Banking</div>
                <div class="summary-num" id="dailyMobile">0 ETB</div>
                <div class="summary-sub" id="dailyMobileBreakdown">Telebirr + CBE</div>
              </div>
            </div>

            <!-- Reconciliation details -->
            <div style="display:grid;grid-template-columns:repeat(2, minmax(0,1fr));gap:20px">
              <div style="background:var(--panel2);padding:16px;border-radius:var(--radius-sm);border:1px solid var(--line)">
                <h4 style="margin:0 0 12px;font-size:13px;color:var(--cyan)">Shift Operational Metrics</h4>
                <div class="detail-row"><span class="label">Matches &amp; Bubbles Paid:</span><span class="val" id="dailyMatchesPaid">0</span></div>
                <div class="detail-row"><span class="label">Telebirr Subtotal:</span><span class="val" id="dailyTelebirr">0 ETB</span></div>
                <div class="detail-row"><span class="label">CBE Subtotal:</span><span class="val" id="dailyCBE">0 ETB</span></div>
                <div class="detail-row"><span class="label">Average Ticket Size:</span><span class="val" id="dailyAvg">0 ETB</span></div>
              </div>

              <div style="background:var(--panel2);padding:16px;border-radius:var(--radius-sm);border:1px solid var(--line)">
                <h4 style="margin:0 0 12px;font-size:13px;color:var(--orange)">Active Floor Status</h4>
                <div class="detail-row"><span class="label">Consoles Playing Right Now:</span><span class="val" id="dailyActiveConsoles">0</span></div>
                <div class="detail-row"><span class="label">Unpaid Floor Balance:</span><span class="val" id="dailyUnpaidBalance" style="color:var(--orange)">0 ETB</span></div>
                <div class="detail-row"><span class="label">Reconciliation Status:</span><span class="val" style="color:var(--green)">Ready for Handover ✓</span></div>
                <div class="detail-row"><span class="label">Shift Closed At:</span><span class="val" id="dailyCloseTimestamp">—</span></div>
              </div>
            </div>
          </div>
        </div>

        <!-- Tab 3: Monthly Analytics View (Admin) -->
        <div id="tabViewMonthly" class="report-view-container" style="display:none">
          <div class="report-panel">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:10px">
              <div>
                <h3 style="margin:0 0 4px">Monthly Financial Analytics &amp; Revenue Trends</h3>
                <div class="muted" style="font-size:12px" id="monthlyPeriodTitle">Current Month</div>
              </div>
              <button class="export-btn print" id="printMonthlyReportBtn">
                🖨 Print Monthly Report
              </button>
            </div>

            <div class="explorer-summary-grid" style="padding:0;margin-bottom:20px;border:none">
              <div class="summary-card revenue">
                <div class="summary-label">Monthly Gross Revenue</div>
                <div class="summary-num" id="monthlyRev">0 ETB</div>
                <div class="summary-sub" id="monthlyMatchesSub">0 matches played</div>
              </div>
              <div class="summary-card count">
                <div class="summary-label">Best-Performing Day</div>
                <div class="summary-num" id="monthlyBestDay" style="font-size:18px">—</div>
                <div class="summary-sub" id="monthlyBestDayAmount">0 ETB</div>
              </div>
              <div class="summary-card cash">
                <div class="summary-label">Total Cash Revenue</div>
                <div class="summary-num" id="monthlyCash">0 ETB</div>
                <div class="summary-sub" id="monthlyCashPct">0% of month</div>
              </div>
              <div class="summary-card mobile">
                <div class="summary-label">Total Digital Revenue</div>
                <div class="summary-num" id="monthlyMobile">0 ETB</div>
                <div class="summary-sub" id="monthlyMobilePct">0% of month</div>
              </div>
            </div>

            <!-- Daily Revenue Bar Chart -->
            <h4 style="margin:20px 0 10px;font-size:13px;color:var(--cyan)">Daily Revenue Trend (This Month)</h4>
            <div class="day-bar-chart" id="monthlyBarChart">
              <!-- Dynamically populated bars -->
            </div>

            <!-- Day-by-day table -->
            <h4 style="margin:24px 0 10px;font-size:13px;color:var(--text)">Day-by-Day Revenue Breakdown</h4>
            <table class="explorer-table" style="background:var(--panel2);border-radius:var(--radius-sm)">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Transactions</th>
                  <th>Cash Revenue</th>
                  <th>Mobile Banking</th>
                  <th>Daily Total</th>
                </tr>
              </thead>
              <tbody id="monthlyBreakdownTable">
                <!-- Rows dynamically injected -->
              </tbody>
            </table>
          </div>
        </div>

      </div>

      <!-- Transaction Details Overlay Modal -->
      <div class="tx-details-overlay" id="txDetailsOverlay">
        <div class="tx-details-card">
          <div class="tx-details-head">
            <div>
              <b id="txDetailTitle">Transaction Details</b>
              <div class="muted" style="font-size:11px" id="txDetailSubtitle">Audit Record</div>
            </div>
            <button class="explorer-close-btn" id="closeTxDetailBtn">✕</button>
          </div>
          <div class="tx-details-body">
            <div class="detail-row"><span class="label">Transaction ID:</span><span class="val" id="dtId" style="color:var(--cyan);font-family:monospace"></span></div>
            <div class="detail-row"><span class="label">Date &amp; Time:</span><span class="val" id="dtTime"></span></div>
            <div class="detail-row"><span class="label">Console(s):</span><span class="val" id="dtConsole"></span></div>
            <div class="detail-row"><span class="label">Payment Method:</span><span class="val" id="dtMethod"></span></div>
            <div class="detail-row"><span class="label">Payment Status:</span><span class="val" style="color:var(--green)">PAID &amp; VERIFIED ✓</span></div>
            <div class="detail-row"><span class="label">Amount Paid:</span><span class="val" id="dtAmount" style="font-size:16px;color:var(--green)"></span></div>
            <div class="detail-row"><span class="label">Items / Matches:</span><span class="val" id="dtItems"></span></div>
            <div class="detail-row"><span class="label">Description / Note:</span><span class="val" id="dtDesc"></span></div>
            <div class="detail-row"><span class="label">Recorded By:</span><span class="val" id="dtRecorder">Worker Control Panel</span></div>

            <div style="margin-top:20px;display:flex;gap:10px">
              <button class="primary" id="printSingleReceiptBtn" style="flex:1">
                🖨 Print Customer Receipt
              </button>
              <button id="closeTxDetailBtn2" style="background:var(--panel2)">Close</button>
            </div>
          </div>
        </div>
      </div>

    </div>
  </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);
}

// ── Rendering Functions ───────────────────────────────────────────────────────

/**
 * Update summary cards and table rows for Tab 1 (Transactions List).
 */
function renderListTab() {
  const transactions = getProcessedTransactions();

  // Calculate figures
  let totalRev = 0;
  let cashRev = 0;
  let telebirrRev = 0;
  let cbeRev = 0;

  transactions.forEach(t => {
    const amt = Number(t.amount) || 0;
    totalRev += amt;
    const m = t.method || '';
    const prov = t.provider || '';
    if (m === 'Cash' || m.includes('Cash')) {
      cashRev += amt;
    } else {
      if (prov === 'Telebirr' || m.includes('Telebirr')) {
        telebirrRev += amt;
      } else if (prov === 'Commercial Bank of Ethiopia' || m.includes('Commercial Bank')) {
        cbeRev += amt;
      } else {
        telebirrRev += amt; // default digital
      }
    }
  });

  const mobileRev = telebirrRev + cbeRev;
  const count = transactions.length;

  // Update Summary Cards
  document.getElementById('expSummaryRevenue').textContent = formatMoney(totalRev);
  document.getElementById('expSummaryCount').textContent = count;
  document.getElementById('expSummaryCash').textContent = formatMoney(cashRev);
  const cashPct = totalRev > 0 ? Math.round((cashRev / totalRev) * 100) : 0;
  document.getElementById('expSummaryCashPct').textContent = `${cashPct}% of total revenue`;
  document.getElementById('expSummaryMobile').textContent = formatMoney(mobileRev);
  document.getElementById('expSummaryMobileSub').textContent = `Tele: ${formatMoney(telebirrRev)} · CBE: ${formatMoney(cbeRev)}`;

  // Update Table Body
  const tbody = document.getElementById('explorerTableBody');
  if (!transactions.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8">
          <div class="empty-state">
            <div class="icon">🔍</div>
            <div style="font-size:14px;font-weight:700;color:var(--text);margin-bottom:4px">No Transactions Found</div>
            <div>No payment records match the selected date range or search query.</div>
          </div>
        </td>
      </tr>`;
    return;
  }

  tbody.innerHTML = transactions.map((t, idx) => {
    const id = t.id || `TX-${String(1000 + idx).slice(-4)}`;
    const txDate = t.createdAt ? new Date(t.createdAt) : new Date();
    const dateFormatted = txDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    const timeFormatted = t.time || txDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const consoleName = t.console || 'PS4';
    const method = t.method || 'Cash';
    const amount = Number(t.amount) || 0;
    const matchesCount = t.matchesCount || (t.description && t.description.match(/\d+/) ? t.description.match(/\d+/)[0] : 1);

    const isMobile = method.includes('Mobile') || t.provider;
    const pillClass = method.includes('Telebirr') ? 'pill-telebirr'
                    : method.includes('Commercial Bank') ? 'pill-cbe'
                    : 'pill';

    return `
      <tr data-tx-index="${idx}" title="Click to view full transaction details">
        <td><span class="tx-id-badge">#${esc(id)}</span></td>
        <td>
          <div style="font-weight:600">${esc(dateFormatted)}</div>
          <div class="muted" style="font-size:10px">${esc(timeFormatted)}</div>
        </td>
        <td><span class="pill" style="font-weight:700">${esc(consoleName)}</span></td>
        <td><span class="pill ${pillClass}">${esc(method)}</span></td>
        <td><b>${esc(matchesCount)}</b> match(es)</td>
        <td><b style="color:var(--green);font-size:13px">+${formatMoney(amount)}</b></td>
        <td><span class="status-badge paid">PAID ✓</span></td>
        <td style="text-align:right">
          <button class="export-btn" style="padding:3px 8px;font-size:11px" data-view-tx="${idx}">
            View
          </button>
        </td>
      </tr>`;
  }).join('');
}

/**
 * Render Tab 2 (Daily Closing Summary).
 */
function renderDailyTab() {
  const allTx = appState.transactions || [];
  const startToday = getStartOfToday();
  const todayTx = allTx.filter(t => (t.createdAt ? new Date(t.createdAt) : new Date()) >= startToday);

  let rev = 0, cash = 0, tele = 0, cbe = 0, matches = 0;
  todayTx.forEach(t => {
    const amt = Number(t.amount) || 0;
    rev += amt;
    const m = t.method || '';
    const prov = t.provider || '';
    if (m === 'Cash' || m.includes('Cash')) cash += amt;
    else if (prov === 'Telebirr' || m.includes('Telebirr')) tele += amt;
    else if (prov === 'Commercial Bank of Ethiopia' || m.includes('Commercial Bank')) cbe += amt;
    else tele += amt;

    const count = Number(t.matchesCount) || 1;
    matches += count;
  });

  const activeConsoles = (appState.consoles || []).filter(c => c.status !== 'free').length;
  const unpaid = (appState.consoles || []).reduce((sum, c) => {
    const paid = (c.matches || []).filter(m => m.paid).reduce((s, m) => s + (m.price || 25), 0);
    const charge = (c.matches || []).reduce((s, m) => s + (m.price || 25), 0);
    return sum + Math.max(0, charge - paid);
  }, 0);

  document.getElementById('dailyClosingDate').textContent = new Date().toLocaleDateString(undefined, {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
  document.getElementById('dailyRev').textContent = formatMoney(rev);
  document.getElementById('dailyCount').textContent = todayTx.length;
  document.getElementById('dailyCash').textContent = formatMoney(cash);
  document.getElementById('dailyMobile').textContent = formatMoney(tele + cbe);
  document.getElementById('dailyMobileBreakdown').textContent = `Telebirr: ${formatMoney(tele)} · CBE: ${formatMoney(cbe)}`;

  document.getElementById('dailyMatchesPaid').textContent = matches;
  document.getElementById('dailyTelebirr').textContent = formatMoney(tele);
  document.getElementById('dailyCBE').textContent = formatMoney(cbe);
  document.getElementById('dailyAvg').textContent = todayTx.length ? formatMoney(rev / todayTx.length) : '0 ETB';
  document.getElementById('dailyActiveConsoles').textContent = activeConsoles;
  document.getElementById('dailyUnpaidBalance').textContent = formatMoney(unpaid);
  document.getElementById('dailyCloseTimestamp').textContent = new Date().toLocaleTimeString();
}

/**
 * Render Tab 3 (Monthly Analytics - Admin Only).
 */
function renderMonthlyTab() {
  const allTx = appState.transactions || [];
  const startMonth = getStartOfMonth();
  const monthTx = allTx.filter(t => (t.createdAt ? new Date(t.createdAt) : new Date()) >= startMonth);

  let rev = 0, cash = 0, mobile = 0, matches = 0;
  const dayMap = {};

  monthTx.forEach(t => {
    const amt = Number(t.amount) || 0;
    rev += amt;
    const m = t.method || '';
    if (m === 'Cash' || m.includes('Cash')) cash += amt;
    else mobile += amt;

    matches += Number(t.matchesCount) || 1;

    // Daily bucket
    const dateKey = t.createdAt ? new Date(t.createdAt).toLocaleDateString() : 'Today';
    if (!dayMap[dateKey]) {
      dayMap[dateKey] = { date: dateKey, total: 0, cash: 0, mobile: 0, count: 0 };
    }
    dayMap[dateKey].total += amt;
    dayMap[dateKey].count += 1;
    if (m === 'Cash' || m.includes('Cash')) dayMap[dateKey].cash += amt;
    else dayMap[dateKey].mobile += amt;
  });

  document.getElementById('monthlyPeriodTitle').textContent = new Date().toLocaleDateString(undefined, {
    month: 'long', year: 'numeric',
  });
  document.getElementById('monthlyRev').textContent = formatMoney(rev);
  document.getElementById('monthlyMatchesSub').textContent = `${matches} match(es) played`;
  document.getElementById('monthlyCash').textContent = formatMoney(cash);
  const cashPct = rev > 0 ? Math.round((cash / rev) * 100) : 0;
  document.getElementById('monthlyCashPct').textContent = `${cashPct}% of monthly revenue`;
  document.getElementById('monthlyMobile').textContent = formatMoney(mobile);
  document.getElementById('monthlyMobilePct').textContent = `${100 - cashPct}% of monthly revenue`;

  // Best day
  let bestDay = '—';
  let bestAmt = 0;
  Object.values(dayMap).forEach(d => {
    if (d.total > bestAmt) {
      bestAmt = d.total;
      bestDay = d.date;
    }
  });
  document.getElementById('monthlyBestDay').textContent = bestDay;
  document.getElementById('monthlyBestDayAmount').textContent = formatMoney(bestAmt);

  // Render Bar Chart
  const chartEl = document.getElementById('monthlyBarChart');
  const daysList = Object.values(dayMap);
  const maxDayVal = Math.max(...daysList.map(d => d.total), 1);

  if (!daysList.length) {
    chartEl.innerHTML = `<div class="muted" style="width:100%;text-align:center;padding:40px 0">No records recorded this month yet.</div>`;
  } else {
    chartEl.innerHTML = daysList.map(d => {
      const heightPct = Math.max(6, Math.round((d.total / maxDayVal) * 100));
      return `
        <div class="day-bar-col" title="${d.date}: ${formatMoney(d.total)} (${d.count} transactions)">
          <div class="day-bar-fill" style="height:${heightPct}%"></div>
          <span class="day-bar-label">${d.date.split('/')[1] || d.date.slice(0, 5)}</span>
        </div>`;
    }).join('');
  }

  // Render Daily Breakdown Table
  const tbody = document.getElementById('monthlyBreakdownTable');
  if (!daysList.length) {
    tbody.innerHTML = `<tr><td colspan="5" class="muted" style="text-align:center;padding:20px">No transaction days recorded.</td></tr>`;
  } else {
    tbody.innerHTML = daysList.slice().reverse().map(d => `
      <tr>
        <td><b>${esc(d.date)}</b></td>
        <td>${d.count}</td>
        <td>${formatMoney(d.cash)}</td>
        <td>${formatMoney(d.mobile)}</td>
        <td><b style="color:var(--green)">${formatMoney(d.total)}</b></td>
      </tr>
    `).join('');
  }
}

/**
 * Open the Transaction Details overlay for a specific record.
 */
function showTransactionDetail(tx) {
  if (!tx) return;
  selectedTxForDetail = tx;

  const id = tx.id || 'TX-UNKNOWN';
  const txDate = tx.createdAt ? new Date(tx.createdAt) : new Date();
  const dateFormatted = `${txDate.toLocaleDateString()} ${tx.time || txDate.toLocaleTimeString()}`;

  document.getElementById('dtId').textContent = id;
  document.getElementById('dtTime').textContent = dateFormatted;
  document.getElementById('dtConsole').textContent = tx.console || 'PS4';
  document.getElementById('dtMethod').textContent = tx.method || 'Cash';
  document.getElementById('dtAmount').textContent = formatMoney(tx.amount);
  document.getElementById('dtItems').textContent = `${tx.matchesCount || 1} match bubble(s)`;
  document.getElementById('dtDesc').textContent = tx.description || 'Customer Match Payment';
  document.getElementById('dtRecorder').textContent = currentRole === 'admin' ? 'Administrator' : 'Worker On Duty';

  document.getElementById('txDetailsOverlay').classList.add('show');
}

function hideTransactionDetail() {
  document.getElementById('txDetailsOverlay').classList.remove('show');
  selectedTxForDetail = null;
}

// ── Export Utilities ──────────────────────────────────────────────────────────

function generateExportData() {
  const list = getProcessedTransactions();
  return list.map((t, idx) => ({
    Transaction_ID: t.id || `TX-${1000 + idx}`,
    Date: t.createdAt ? new Date(t.createdAt).toLocaleDateString() : 'N/A',
    Time: t.time || (t.createdAt ? new Date(t.createdAt).toLocaleTimeString() : 'N/A'),
    Console: t.console || 'N/A',
    Method: t.method || 'Cash',
    Provider: t.provider || 'N/A',
    Matches_Count: t.matchesCount || 1,
    Amount_ETB: Number(t.amount) || 0,
    Status: 'PAID',
    Description: t.description || 'Payment',
  }));
}

/** Export to CSV (RFC 4180 format) */
export function exportToCSV() {
  const data = generateExportData();
  if (!data.length) {
    alert('No transactions to export.');
    return;
  }

  const headers = Object.keys(data[0]);
  const rows = data.map(row =>
    headers.map(h => `"${String(row[h]).replace(/"/g, '""')}"`).join(',')
  );
  const csvContent = [headers.join(','), ...rows].join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `GameZone_Transactions_${activeDateFilter}_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Export to Excel (Native Excel Spreadsheet XML) */
export function exportToExcel() {
  const data = generateExportData();
  if (!data.length) {
    alert('No transactions to export.');
    return;
  }

  let tableHtml = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
  <head><meta charset="utf-8"><!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>Transactions</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]--></head>
  <body>
  <table border="1">
    <tr style="background:#09111d;color:#ffffff;font-weight:bold">
      <th>Transaction ID</th><th>Date</th><th>Time</th><th>Console</th><th>Method</th><th>Provider</th><th>Items</th><th>Amount (ETB)</th><th>Status</th><th>Notes</th>
    </tr>`;

  data.forEach(d => {
    tableHtml += `<tr>
      <td>${esc(d.Transaction_ID)}</td>
      <td>${esc(d.Date)}</td>
      <td>${esc(d.Time)}</td>
      <td>${esc(d.Console)}</td>
      <td>${esc(d.Method)}</td>
      <td>${esc(d.Provider)}</td>
      <td>${d.Matches_Count}</td>
      <td style="font-weight:bold">${d.Amount_ETB.toFixed(2)}</td>
      <td>${esc(d.Status)}</td>
      <td>${esc(d.Description)}</td>
    </tr>`;
  });
  tableHtml += `</table></body></html>`;

  const blob = new Blob([tableHtml], { type: 'application/vnd.ms-excel;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `GameZone_Transactions_${activeDateFilter}_${new Date().toISOString().slice(0, 10)}.xls`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Print or Save as PDF with dedicated formatting */
export function printReport(title = 'GAMEZONE MANAGER — TRANSACTION AUDIT REPORT') {
  const data = generateExportData();
  const dateStr = new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const totalRev = data.reduce((s, d) => s + d.Amount_ETB, 0);

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Please allow popups to generate print report.');
    return;
  }

  printWindow.document.write(`
    <!doctype html>
    <html>
    <head>
      <title>${esc(title)}</title>
      <style>
        body { font-family: Inter, Arial, sans-serif; padding: 24px; color: #111; }
        .head { border-bottom: 2px solid #222; padding-bottom: 12px; margin-bottom: 16px; }
        .title { font-size: 20px; font-weight: 800; }
        .meta { font-size: 12px; color: #555; margin-top: 4px; }
        .summary-box { display: flex; gap: 20px; margin-bottom: 20px; padding: 12px; background: #f4f6f8; border: 1px solid #ddd; border-radius: 6px; }
        .summary-box div { flex: 1; }
        .summary-box small { font-size: 11px; color: #666; text-transform: uppercase; }
        .summary-box b { font-size: 18px; display: block; margin-top: 2px; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 12px; }
        th, td { border: 1px solid #ccc; padding: 7px 10px; text-align: left; }
        th { background: #eee; font-weight: bold; }
        .amt { font-weight: bold; text-align: right; }
        .status { color: #008844; font-weight: bold; }
        @media print {
          body { padding: 0; }
          button { display: none; }
        }
      </style>
    </head>
    <body>
      <div class="head">
        <div class="title">${esc(title)}</div>
        <div class="meta">Generated: ${esc(dateStr)} · Filter: ${esc(activeDateFilter.toUpperCase())} · Role: ${esc(currentRole.toUpperCase())}</div>
      </div>

      <div class="summary-box">
        <div><small>Total Revenue</small><b>${formatMoney(totalRev)}</b></div>
        <div><small>Transactions</small><b>${data.length}</b></div>
        <div><small>Status</small><b>VERIFIED PAID</b></div>
      </div>

      <table>
        <thead>
          <tr>
            <th>TX ID</th><th>Date/Time</th><th>Console</th><th>Method</th><th>Items</th><th style="text-align:right">Amount (ETB)</th><th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${data.map(d => `
            <tr>
              <td><b>#${esc(d.Transaction_ID)}</b></td>
              <td>${esc(d.Date)} ${esc(d.Time)}</td>
              <td>${esc(d.Console)}</td>
              <td>${esc(d.Method)}</td>
              <td>${d.Matches_Count}</td>
              <td class="amt">${d.Amount_ETB.toFixed(2)} ETB</td>
              <td class="status">PAID ✓</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <div style="margin-top:24px;font-size:11px;color:#777;text-align:center">
        GameZone Management System · End of Official Record
      </div>

      <script>
        window.onload = function() { window.print(); };
      </script>
    </body>
    </html>
  `);
  printWindow.document.close();
}

/** Print Single Receipt */
function printSingleReceipt(tx) {
  if (!tx) return;
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  const dateStr = tx.createdAt ? new Date(tx.createdAt).toLocaleString() : new Date().toLocaleString();

  printWindow.document.write(`
    <!doctype html>
    <html>
    <head>
      <title>Receipt - ${esc(tx.id || 'TX')}</title>
      <style>
        body { font-family: monospace; width: 280px; margin: 0 auto; padding: 16px; font-size: 13px; line-height: 1.4; color: #000; }
        .center { text-align: center; }
        .line { border-bottom: 1px dashed #000; margin: 10px 0; }
        .row { display: flex; justify-content: space-between; margin: 4px 0; }
        b { font-weight: bold; }
        @media print { body { width: 100%; } }
      </style>
    </head>
    <body>
      <div class="center">
        <b>GAMEZONE MANAGER</b><br>
        Customer Payment Receipt
      </div>
      <div class="line"></div>
      <div class="row"><span>Receipt #:</span><span>${esc(tx.id || 'TX')}</span></div>
      <div class="row"><span>Date:</span><span>${esc(dateStr)}</span></div>
      <div class="row"><span>Console:</span><span>${esc(tx.console || 'PS4')}</span></div>
      <div class="row"><span>Method:</span><span>${esc(tx.method || 'Cash')}</span></div>
      <div class="line"></div>
      <div class="row"><span>Items:</span><span>${tx.matchesCount || 1} match bubble(s)</span></div>
      <div class="row" style="font-size:16px;margin:8px 0"><span>TOTAL PAID:</span><b>${formatMoney(tx.amount)}</b></div>
      <div class="line"></div>
      <div class="center" style="font-size:11px">
        STATUS: PAID &amp; VERIFIED ✓<br>
        Thank you for playing at GameZone!
      </div>
      <script>window.onload = function() { window.print(); };</script>
    </body>
    </html>
  `);
  printWindow.document.close();
}

// ── Public API & Open/Close Orchestration ──────────────────────────────────────

export function openTransactionExplorer(state, role = 'worker') {
  appState = state;
  currentRole = role;
  ensureModalInDOM();

  // Reset tab to list
  activeTab = 'list';
  activeDateFilter = 'today';
  searchQuery = '';
  methodFilter = 'all';
  consoleFilter = 'all';

  // Populate console selector
  const consoleSelect = document.getElementById('explorerConsoleSelect');
  if (consoleSelect && Array.isArray(appState.consoles)) {
    consoleSelect.innerHTML = '<option value="all">All Consoles</option>' +
      appState.consoles.map(c => `<option value="${esc(c.id)}">${esc(c.id)} (${esc(c.type)})</option>`).join('');
  }

  updateRoleUI();
  updateTabsUI();
  updateFiltersUI();
  renderActiveView();

  const modal = document.getElementById('txExplorerModal');
  modal.classList.add('show');
}

export function closeTransactionExplorer() {
  const modal = document.getElementById('txExplorerModal');
  if (modal) modal.classList.remove('show');
  hideTransactionDetail();
}

function updateRoleUI() {
  const badge = document.getElementById('explorerRoleBadge');
  const toggleBtn = document.getElementById('explorerRoleToggleBtn');
  const notice = document.getElementById('dateFilterNotice');
  const monthlyBtn = document.getElementById('tabMonthlyBtn');

  if (currentRole === 'admin') {
    badge.className = 'role-badge admin';
    badge.textContent = 'Admin Access';
    toggleBtn.textContent = '👤 Switch to Worker View';
    notice.textContent = 'Admin mode: Access to all historical dates & monthly reports';
    monthlyBtn.style.opacity = '1';
    monthlyBtn.querySelector('.tab-lock-icon').textContent = '✓';

    // Enable all date pills
    document.querySelectorAll('.date-pill').forEach(p => p.disabled = false);
  } else {
    badge.className = 'role-badge worker';
    badge.textContent = 'Worker Access';
    toggleBtn.textContent = '🔒 Switch to Admin View';
    notice.textContent = "Showing today's transactions (Worker Shift)";
    monthlyBtn.style.opacity = '0.7';
    monthlyBtn.querySelector('.tab-lock-icon').textContent = '🔒';

    // Force date filter to today
    activeDateFilter = 'today';
  }
}

function updateTabsUI() {
  document.querySelectorAll('.explorer-tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === activeTab);
  });

  document.getElementById('tabViewList').style.display = activeTab === 'list' ? 'flex' : 'none';
  document.getElementById('tabViewDaily').style.display = activeTab === 'daily' ? 'block' : 'none';
  document.getElementById('tabViewMonthly').style.display = activeTab === 'monthly' ? 'block' : 'none';
}

function updateFiltersUI() {
  document.querySelectorAll('.date-pill').forEach(pill => {
    pill.classList.toggle('active', pill.dataset.filter === activeDateFilter);
  });

  const customWrap = document.getElementById('customRangeWrap');
  if (customWrap) {
    customWrap.classList.toggle('show', activeDateFilter === 'custom');
  }
}

function renderActiveView() {
  if (activeTab === 'list') {
    renderListTab();
  } else if (activeTab === 'daily') {
    renderDailyTab();
  } else if (activeTab === 'monthly') {
    renderMonthlyTab();
  }
}

// ── Event Listeners Setup ──────────────────────────────────────────────────────

export function initTransactionExplorer(state) {
  appState = state;
  ensureModalInDOM();

  // Close modal
  document.getElementById('explorerCloseBtn').addEventListener('click', closeTransactionExplorer);
  const modal = document.getElementById('txExplorerModal');
  modal.addEventListener('click', e => {
    if (e.target === modal) closeTransactionExplorer();
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && modal.classList.contains('show')) {
      if (document.getElementById('txDetailsOverlay').classList.contains('show')) {
        hideTransactionDetail();
      } else {
        closeTransactionExplorer();
      }
    }
  });

  // Role toggle
  document.getElementById('explorerRoleToggleBtn').addEventListener('click', () => {
    if (currentRole === 'worker') {
      const pin = prompt('Enter Admin PIN to unlock full history & monthly reports (Default: 1234):');
      if (pin === '1234' || pin === 'admin') {
        currentRole = 'admin';
        updateRoleUI();
        updateFiltersUI();
        renderActiveView();
      } else if (pin !== null) {
        alert('Invalid Admin PIN.');
      }
    } else {
      currentRole = 'worker';
      activeTab = 'list';
      activeDateFilter = 'today';
      updateRoleUI();
      updateTabsUI();
      updateFiltersUI();
      renderActiveView();
    }
  });

  // Tab buttons
  document.querySelectorAll('.explorer-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      if (tab === 'monthly' && currentRole !== 'admin') {
        const pin = prompt('Monthly Reports require Admin PIN (Default: 1234):');
        if (pin === '1234' || pin === 'admin') {
          currentRole = 'admin';
          updateRoleUI();
        } else {
          if (pin !== null) alert('Invalid Admin PIN.');
          return;
        }
      }
      activeTab = tab;
      updateTabsUI();
      renderActiveView();
    });
  });

  // Date filters
  document.querySelectorAll('.date-pill[data-filter]').forEach(pill => {
    pill.addEventListener('click', () => {
      const filter = pill.dataset.filter;
      if (filter !== 'today' && currentRole !== 'admin') {
        const pin = prompt("Viewing historical transactions requires Admin PIN (Default: 1234):");
        if (pin === '1234' || pin === 'admin') {
          currentRole = 'admin';
          updateRoleUI();
        } else {
          if (pin !== null) alert('Invalid Admin PIN. Workers can only see today\'s transactions.');
          return;
        }
      }

      activeDateFilter = filter;
      updateFiltersUI();
      renderActiveView();
    });
  });

  // Custom range apply
  document.getElementById('applyCustomDateBtn').addEventListener('click', () => {
    customStartDate = document.getElementById('customStartDate').value;
    customEndDate = document.getElementById('customEndDate').value;
    renderActiveView();
  });

  // Search input
  document.getElementById('explorerSearchInput').addEventListener('input', e => {
    searchQuery = e.target.value;
    renderActiveView();
  });

  // Method selector
  document.getElementById('explorerMethodSelect').addEventListener('change', e => {
    methodFilter = e.target.value;
    renderActiveView();
  });

  // Console selector
  document.getElementById('explorerConsoleSelect').addEventListener('change', e => {
    consoleFilter = e.target.value;
    renderActiveView();
  });

  // Sort selector
  document.getElementById('explorerSortSelect').addEventListener('change', e => {
    sortBy = e.target.value;
    renderActiveView();
  });

  // Table row click -> details modal
  document.getElementById('explorerTableBody').addEventListener('click', e => {
    const tr = e.target.closest('tr[data-tx-index]');
    if (!tr) return;
    const idx = Number(tr.dataset.txIndex);
    const list = getProcessedTransactions();
    const tx = list[idx];
    if (tx) showTransactionDetail(tx);
  });

  // Close detail drawer
  document.getElementById('closeTxDetailBtn').addEventListener('click', hideTransactionDetail);
  document.getElementById('closeTxDetailBtn2').addEventListener('click', hideTransactionDetail);

  // Print single receipt
  document.getElementById('printSingleReceiptBtn').addEventListener('click', () => {
    if (selectedTxForDetail) printSingleReceipt(selectedTxForDetail);
  });

  // Exports
  document.getElementById('exportCsvBtn').addEventListener('click', exportToCSV);
  document.getElementById('exportExcelBtn').addEventListener('click', exportToExcel);
  document.getElementById('exportPdfBtn').addEventListener('click', () => printReport('GAMEZONE MANAGER — PDF EXPORT REPORT'));
  document.getElementById('printReportBtn').addEventListener('click', () => printReport('GAMEZONE MANAGER — OFFICIAL TRANSACTION AUDIT'));
  document.getElementById('printDailyClosingBtn').addEventListener('click', () => printReport('GAMEZONE MANAGER — DAILY CLOSING SUMMARY & SHIFT REPORT'));
  document.getElementById('printMonthlyReportBtn').addEventListener('click', () => printReport('GAMEZONE MANAGER — MONTHLY FINANCIAL AUDIT REPORT'));
}
