/**
 * worker/dashboard.js
 * Stats bar rendering, transaction lists (recent sidebar & inline expanded),
 * eye toggle, 1-second tick, and inline panel collapse/expand.
 */

import { getCharge, getPaid, formatMoney, esc } from '../shared/helpers.js';
import { saveState } from '../shared/storage.js';

/**
 * Check if a timestamp is from today (local date).
 * @param {string|number} [createdAt]
 * @returns {boolean}
 */
function isToday(createdAt) {
  if (!createdAt) return true;
  const d = new Date(createdAt);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() &&
         d.getMonth() === now.getMonth() &&
         d.getDate() === now.getDate();
}

export function renderStats(state) {
  const total   = state.transactions.reduce((n, t) => n + (Number(t.amount) || 0), 0);
  const matches = state.consoles.reduce((n, c) => n + (c.mode === 'FIFA' ? (c.matches || []).length : 0), 0);
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
  // Filter today's transactions strictly
  const allTx = state.transactions || [];
  const todayTx = allTx.filter(t => isToday(t.createdAt));
  const todayReversed = todayTx.slice().reverse();

  // ── 1. Recent Transactions (Sidebar Scrollable Container) ──
  const txCountEl = document.getElementById('txCount');
  if (txCountEl) {
    txCountEl.textContent = `${todayTx.length} records`;
  }

  const txListEl = document.getElementById('txList');
  if (txListEl) {
    txListEl.innerHTML = todayReversed.length
      ? todayReversed.map(t => {
          const displayMethod = t.method || 'Cash';
          const timeStr = t.time || (t.createdAt ? new Date(t.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '');
          return `
            <div class="tx">
              <div>
                <div class="txname">${esc(displayMethod)} · ${esc(t.console || 'PS4')}</div>
                <div class="txmeta">${esc(t.description || 'Customer payment')} · ${esc(timeStr)}</div>
              </div>
              <div class="txamount">+${formatMoney(t.amount)}</div>
            </div>`;
        }).join('')
      : '<div class="empty">No transactions recorded today yet.</div>';
  }

  // ── 2. View All Button Text ──
  const viewAllBtn = document.getElementById('viewAll');
  const inlinePanel = document.getElementById('inlineTxSection');
  const isOpen = inlinePanel && inlinePanel.style.display !== 'none';

  if (viewAllBtn) {
    viewAllBtn.textContent = isOpen
      ? `▲ COLLAPSE TRANSACTIONS (${todayTx.length})`
      : `☷ VIEW ALL TRANSACTIONS (${todayTx.length})`;
  }

  // ── 3. Expanded Inline Today's Transactions Panel ──
  const inlineBadge = document.getElementById('inlineTxBadge');
  if (inlineBadge) {
    inlineBadge.textContent = `${todayTx.length} today`;
  }

  const inlineRowsEl = document.getElementById('inlineTxRows');
  if (inlineRowsEl) {
    inlineRowsEl.innerHTML = todayReversed.length
      ? todayReversed.map(t => {
          const displayMethod = t.method || 'Cash';
          const timeStr = t.time || (t.createdAt ? new Date(t.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—');
          const consoleName = t.console || '—';
          const matchesCount = t.matchesCount || (t.description && t.description.match(/\d+/) ? t.description.match(/\d+/)[0] : 1);
          const badgeClass = displayMethod.includes('Telebirr') ? 'pill-tele'
                           : displayMethod.includes('Commercial Bank') ? 'pill-cbe'
                           : '';

          return `
            <tr>
              <td><span style="font-weight:700">${esc(timeStr)}</span></td>
              <td><span class="badge" style="font-weight:700">${esc(consoleName)}</span></td>
              <td><span class="badge ${badgeClass}">${esc(displayMethod)}</span></td>
              <td><b>${esc(matchesCount)}</b> match(es)</td>
              <td><b style="color:var(--green)">+${formatMoney(t.amount)}</b></td>
              <td><span class="badge" style="background:rgba(38,189,131,0.15);color:var(--green);border:1px solid rgba(38,189,131,0.3)">PAID ✓</span></td>
            </tr>`;
        }).join('')
      : `<tr><td colspan="6" class="muted" style="text-align:center;padding:24px">No transactions recorded today yet.</td></tr>`;
  }
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
  // Toggle stats hidden/visible
  document.getElementById('toggleStats').addEventListener('click', () => {
    state.hidden = !state.hidden;
    saveState(state);
    renderStatsVisibility(state);
    renderStats(state);
  });

  // Toggle inline expandable transaction panel
  const viewAllBtn = document.getElementById('viewAll');
  const inlinePanel = document.getElementById('inlineTxSection');
  const collapseBtn = document.getElementById('collapseTxBtn');

  if (viewAllBtn && inlinePanel) {
    viewAllBtn.addEventListener('click', () => {
      const isCurrentlyOpen = inlinePanel.style.display !== 'none';
      const todayCount = (state.transactions || []).filter(t => isToday(t.createdAt)).length;

      if (isCurrentlyOpen) {
        inlinePanel.style.display = 'none';
        viewAllBtn.textContent = `☷ VIEW ALL TRANSACTIONS (${todayCount})`;
      } else {
        renderTransactions(state);
        inlinePanel.style.display = 'block';
        viewAllBtn.textContent = `▲ COLLAPSE TRANSACTIONS (${todayCount})`;
        inlinePanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    });
  }

  if (collapseBtn && inlinePanel && viewAllBtn) {
    collapseBtn.addEventListener('click', () => {
      const todayCount = (state.transactions || []).filter(t => isToday(t.createdAt)).length;
      inlinePanel.style.display = 'none';
      viewAllBtn.textContent = `☷ VIEW ALL TRANSACTIONS (${todayCount})`;
    });
  }
}
