/**
 * worker/consoles.js
 * Console card rendering and delegated click handling.
 *
 * Supports:
 * - Match Mode: Per-match timer reset to 00:00 on each added match.
 * - Mission Mode: Continuous session timer with automatic 30-minute payment bubbles.
 * - Dynamic Pricing: Synced with Admin Dashboard configuration.
 */

import { saveState, removeConsoleFromState } from '../shared/storage.js';
import {
  startSession,
  pauseSession,
  resumeSession,
  endSession,
  toggleMode,
  addMatch,
} from './sessions.js';
import {
  getPrice,
  getElapsed,
  formatTimer,
  getCharge,
  getPaid,
  formatMoney,
  esc,
  getMatchTimerElapsed,
  MATCH_INTERVAL_SECONDS,
} from '../shared/helpers.js';
import { getPricing } from '../shared/api.js';

export { getPrice, getElapsed, formatTimer, getCharge, getPaid, formatMoney, esc };

// ── Card renderer ─────────────────────────────────────────────────────────────

export function buildConsoleCard(con, selected) {
  const elapsed   = getElapsed(con);
  const charge    = getCharge(con);
  const paidAmt   = getPaid(con);
  const paidCount = con.matches.filter(m => m.paid).length;
  const pricing   = getPricing();

  const statusClass = con.status === 'playing' ? 'playing' : con.status === 'paused' ? 'paused' : '';
  const badgeClass  = con.status === 'playing' ? 'live'    : con.status === 'paused' ? 'pause'  : '';
  const badgeLabel  = con.status === 'free'    ? 'AVAILABLE' : con.status.toUpperCase();

  // ── FIFA Match Mode: 4-minute auto-match countdown ────────────────────────
  const cycleElapsed   = getMatchTimerElapsed(con);
  const cycleSeconds   = Math.min(cycleElapsed, MATCH_INTERVAL_SECONDS);
  const cyclePct       = Math.round((cycleSeconds / MATCH_INTERVAL_SECONDS) * 100);
  const cycleRemaining = MATCH_INTERVAL_SECONDS - cycleSeconds;
  const cycleMin       = Math.floor(cycleRemaining / 60);
  const cycleSec       = cycleRemaining % 60;
  const cycleLabel     = con.status === 'playing'
    ? `Next match in ${String(cycleMin).padStart(2,'0')}:${String(cycleSec).padStart(2,'0')}`
    : (con.status === 'paused' ? 'Paused' : '');

  const matchProgressBar = con.status !== 'free' && con.mode === 'FIFA' ? `
    <div class="match-cycle" data-cycle="${esc(con.id)}">
      <div class="match-cycle-label">
        <span class="muted">AUTO MATCH TIMER (4 MIN)</span>
        <span class="cycle-countdown">${cycleLabel}</span>
      </div>
      <div class="match-cycle-track">
        <div class="match-cycle-fill" style="width:${cyclePct}%"></div>
      </div>
    </div>` : '';

  // ── Mission Mode: 30-minute bubble countdown ──────────────────────────────
  const intervalMinutes = Math.max(1, Number(pricing.missionInterval) || 30);
  const intervalSec     = intervalMinutes * 60;
  const missionCycleSec = elapsed % intervalSec;
  const missionRemain   = intervalSec - missionCycleSec;
  const missionPct      = Math.min(100, Math.round((missionCycleSec / intervalSec) * 100));
  const mMin            = Math.floor(missionRemain / 60);
  const mSec            = missionRemain % 60;
  const missionLabel    = con.status === 'playing'
    ? `Next bubble in ${String(mMin).padStart(2,'0')}:${String(mSec).padStart(2,'0')}`
    : (con.status === 'paused' ? 'Paused' : '');

  const missionProgressBar = con.status !== 'free' && con.mode === 'MISSION' ? `
    <div class="match-cycle" data-mission-cycle="${esc(con.id)}">
      <div class="match-cycle-label">
        <span class="muted">${intervalMinutes}-MIN BUBBLE TIMER</span>
        <span class="cycle-countdown">${missionLabel}</span>
      </div>
      <div class="match-cycle-track">
        <div class="match-cycle-fill" style="width:${missionPct}%"></div>
      </div>
    </div>` : '';

  // ── Metrics Row ───────────────────────────────────────────────────────────
  // In FIFA mode: displays current match timer (resets to 00:00 on each match).
  // In Mission mode: displays continuous session timer.
  const displayTimerSec = con.mode === 'FIFA'
    ? (con.status === 'free' ? 0 : getMatchTimerElapsed(con))
    : (con.status === 'free' ? 0 : elapsed);

  const metricsRow = `
    <div class="metrics">
      <div>
        <small>${con.mode === 'FIFA' ? 'MATCHES' : 'BUBBLES'}</small>
        <b>${con.matches.length}</b>
      </div>
      <div>
        <small>${con.mode === 'FIFA' ? 'MATCH TIMER' : 'MISSION TIMER'}</small>
        <b data-timer="${esc(con.id)}">${formatTimer(displayTimerSec)}</b>
      </div>
      <div>
        <small>TOTAL</small>
        <b>${formatMoney(charge)}</b>
      </div>
    </div>`;

  // ── FIFA Bubbles ──────────────────────────────────────────────────────────
  const bubblesFIFA = con.matches.map(m => {
    const k          = con.id + ':' + m.id;
    const isSelected = selected.has(k);
    const mPrice     = typeof m.price === 'number' ? m.price : getPrice(con, m);
    const title      = m.paid
      ? `Match ${m.id}: Paid by ${m.method} (${formatMoney(mPrice)})`
      : `Match ${m.id}: Unpaid (${formatMoney(mPrice)})`;
    return `<button
      class="bubble ${m.paid ? 'paid' : ''} ${isSelected ? 'selected' : ''}"
      data-bubble="${esc(k)}"
      title="${esc(title)}"
      aria-label="Match ${m.id} ${m.paid ? 'paid' : 'unpaid'}"
    >${m.paid ? '' : m.id}</button>`;
  }).join('') || '<span class="muted" style="font-size:11px">No matches yet. Start session and click "+ 1 MATCH".</span>';

  const bubbleAreaFIFA = `
    <div class="bubblearea">
      ${matchProgressBar}
      <div class="bubblehead">
        <span class="muted">MATCH PAYMENT BUBBLES</span>
        <span><b class="green">${paidCount} paid</b> / ${con.matches.length}</span>
      </div>
      <div class="bubbles">${bubblesFIFA}</div>
      <div class="payline">
        <span>Paid: <b class="green">${formatMoney(paidAmt)}</b></span>
        <span>Unpaid: <b>${formatMoney(charge - paidAmt)}</b></span>
      </div>
    </div>`;

  // ── Mission Bubbles ───────────────────────────────────────────────────────
  const bubblesMission = con.matches.map(m => {
    const k          = con.id + ':' + m.id;
    const isSelected = selected.has(k);
    const mPrice     = typeof m.price === 'number' ? m.price : (pricing.missionPrice || 50);
    const title      = m.paid
      ? `Bubble ${m.id}: Paid by ${m.method} (${formatMoney(mPrice)})`
      : `Bubble ${m.id}: Unpaid (${formatMoney(mPrice)})`;
    return `<button
      class="bubble ${m.paid ? 'paid' : ''} ${isSelected ? 'selected' : ''}"
      data-bubble="${esc(k)}"
      title="${esc(title)}"
      aria-label="Bubble ${m.id} ${m.paid ? 'paid' : 'unpaid'}"
    >${m.paid ? '' : m.id}</button>`;
  }).join('') || `<span class="muted" style="font-size:11px">Session active. 1st bubble adds at ${intervalMinutes}:00.</span>`;

  const bubbleAreaMISSION = `
    <div class="bubblearea">
      ${missionProgressBar}
      <div class="bubblehead">
        <span class="muted">MISSION PAYMENT BUBBLES</span>
        <span><b class="green">${paidCount} paid</b> / ${con.matches.length}</span>
      </div>
      <div class="bubbles">${bubblesMission}</div>
      <div class="payline">
        <span>Paid: <b class="green">${formatMoney(paidAmt)}</b></span>
        <span>Unpaid: <b>${formatMoney(charge - paidAmt)}</b></span>
      </div>
    </div>`;

  // ── Action Buttons ────────────────────────────────────────────────────────
  const isActive = con.status !== 'free';
  let actions = '';

  if (con.status === 'free') {
    actions += `<button class="primary" data-action="start" data-id="${esc(con.id)}">▶ Start</button>`;
  } else if (con.status === 'playing') {
    actions += `<button data-action="pause" data-id="${esc(con.id)}">⏸ Pause</button>`;
  } else {
    actions += `<button class="primary" data-action="resume" data-id="${esc(con.id)}">▶ Resume</button>`;
  }

  if (isActive && con.mode === 'FIFA') {
    actions += `<button data-action="match" data-id="${esc(con.id)}">＋ 1 MATCH</button>`;
  }
  if (isActive && con.mode === 'MISSION') {
    actions += `<button data-action="mission-bubble" data-id="${esc(con.id)}">＋ 1 BUBBLE</button>`;
  }
  if (isActive) {
    actions += `<button data-action="end" data-id="${esc(con.id)}">End session</button>`;
  }

  actions += `<button data-action="mode" data-id="${esc(con.id)}" ${isActive ? 'disabled' : ''}>
    ${con.mode === 'FIFA' ? 'Mission mode' : 'FIFA mode'}
  </button>`;
  actions += `<button data-action="remove" data-id="${esc(con.id)}" ${isActive ? 'disabled' : ''}>Remove</button>`;

  return `
    <article class="console ${statusClass}">
      <div class="conhead">
        <span class="conname">${esc(con.id)}</span>
        <span class="badge ${badgeClass}">${badgeLabel}</span>
      </div>
      ${metricsRow}
      ${con.mode === 'FIFA' ? bubbleAreaFIFA : bubbleAreaMISSION}
      <div class="actions">${actions}</div>
    </article>`;
}

// ── Delegated click handler ───────────────────────────────────────────────────

export function handleConsoleGridClick(e, state, selected, renderAll) {
  const bubbleEl = e.target.closest('[data-bubble]');
  if (bubbleEl) {
    const k     = bubbleEl.dataset.bubble;
    const [id, mid] = k.split(':');
    const con   = state.consoles.find(x => x.id === id);
    const match = con?.matches.find(x => x.id === Number(mid));
    if (!match || match.paid) return;
    selected.has(k) ? selected.delete(k) : selected.add(k);
    renderAll();
    return;
  }

  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const con = state.consoles.find(x => x.id === btn.dataset.id);
  if (!con) return;

  switch (btn.dataset.action) {
    case 'start':   startSession(state, con);  break;
    case 'pause':   pauseSession(state, con);  break;
    case 'resume':  resumeSession(state, con); break;
    case 'match':   addMatch(state, con);      break;
    case 'mission-bubble': {
      if (con.status === 'free' || con.mode !== 'MISSION') return;
      const nextId = con.matches.length
        ? Math.max(...con.matches.map(m => m.id)) + 1
        : 1;
      const pricing = getPricing();
      con.matches.push({
        id: nextId,
        paid: false,
        method: null,
        price: pricing.missionPrice || 50,
        createdAt: Date.now(),
      });
      saveState(state);
      break;
    }
    case 'mode':    toggleMode(state, con);    break;
    case 'end': {
      const err = endSession(state, con);
      if (err) { alert(err); return; }
      break;
    }
    case 'remove':
      if (con.status !== 'free') return;
      if (!confirm(`Remove ${con.id}?`)) return;
      removeConsoleFromState(state, con.id);
      saveState(state);
      break;
    default: return;
  }

  for (const k of [...selected]) {
    if (!state.consoles.some(x => k.startsWith(x.id + ':'))) selected.delete(k);
  }

  renderAll();
}
