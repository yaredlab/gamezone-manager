/**
 * worker/consoles.js
 * Console card rendering and delegated click handling.
 */

import { saveState, removeConsoleFromState } from '../shared/storage.js';
import { startSession, pauseSession, resumeSession, endSession, toggleMode, addMatch } from './sessions.js';
import {
  getPrice, getElapsed, formatTimer, getCharge, getPaid, formatMoney, esc,
} from '../shared/helpers.js';

export { getPrice, getElapsed, formatTimer, getCharge, getPaid, formatMoney, esc };

// ── Card renderer ─────────────────────────────────────────────────────────────

export function buildConsoleCard(con, selected) {
  const elapsed   = getElapsed(con);
  const charge    = getCharge(con);
  const paidAmt   = getPaid(con);
  const paidCount = con.matches.filter(m => m.paid).length;

  const statusClass = con.status === 'playing' ? 'playing' : con.status === 'paused' ? 'paused' : '';
  const badgeClass  = con.status === 'playing' ? 'live'    : con.status === 'paused' ? 'pause'  : '';
  const badgeLabel  = con.status === 'free'    ? 'AVAILABLE' : con.status.toUpperCase();

  const metricsRow = `
    <div class="metrics">
      <div>
        <small>${con.mode === 'FIFA' ? 'MATCHES' : 'GAME TYPE'}</small>
        <b>${con.mode === 'FIFA' ? con.matches.length : 'MISSION'}</b>
      </div>
      <div>
        <small>TIMER</small>
        <b data-timer="${esc(con.id)}">${formatTimer(elapsed)}</b>
      </div>
      <div>
        <small>TOTAL</small>
        <b>${formatMoney(charge)}</b>
      </div>
    </div>`;

  const bubblesFIFA = con.matches.map(m => {
    const k          = con.id + ':' + m.id;
    const isSelected = selected.has(k);
    const title      = m.paid ? `Match ${m.id}: Paid by ${m.method}` : `Match ${m.id}: Unpaid`;
    return `<button
      class="bubble ${m.paid ? 'paid' : ''} ${isSelected ? 'selected' : ''}"
      data-bubble="${esc(k)}"
      title="${esc(title)}"
      aria-label="Match ${m.id} ${m.paid ? 'paid' : 'unpaid'}"
    >${m.paid ? '' : m.id}</button>`;
  }).join('') || '<span class="muted" style="font-size:11px">No matches yet. Start a session and add matches.</span>';

  const bubbleAreaFIFA = `
    <div class="bubblearea">
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

  const blocks = Math.ceil(elapsed / 1800);
  const bubbleAreaMISSION = `
    <div class="bubblearea">
      <div class="payline">
        <span class="muted">30-minute blocks</span>
        <b>${blocks}</b>
      </div>
      <div class="payline">
        <span class="muted">Estimated charge</span>
        <b>${formatMoney(charge)}</b>
      </div>
    </div>`;

  const isActive = con.status !== 'free';
  let actions = '';

  if (con.status === 'free') {
    actions += `<button class="primary" data-action="start" data-id="${esc(con.id)}">▶ Start</button>`;
  } else if (con.status === 'playing') {
    actions += `<button data-action="pause" data-id="${esc(con.id)}">Ⅱ Pause</button>`;
  } else {
    actions += `<button class="primary" data-action="resume" data-id="${esc(con.id)}">▶ Resume</button>`;
  }

  if (isActive && con.mode === 'FIFA') {
    actions += `<button data-action="match" data-id="${esc(con.id)}">＋ 1 MATCH</button>`;
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
