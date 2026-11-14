/**
 * worker/payments.js
 * Bubble selection UI, payment recording, side-panel listeners.
 */

import { getPrice, formatMoney } from '../shared/helpers.js';
import { addTransaction, saveState } from '../shared/storage.js';

export function updateSelectionUI(state, selected) {
  let count = 0, total = 0;
  const labels = [];

  for (const k of selected) {
    const [id, mid] = k.split(':');
    const con   = state.consoles.find(x => x.id === id);
    const match = con?.matches.find(x => x.id === Number(mid));
    if (con && match && !match.paid) {
      count++;
      total += getPrice(con, match);
      labels.push(`${id} #${mid}`);
    }
  }

  document.getElementById('selectedCount').textContent   = count;
  document.getElementById('selectedTotal').textContent   = formatMoney(total);
  document.getElementById('selectedPreview').textContent =
    count ? labels.join(' · ') : 'No bubbles selected';
  document.getElementById('amount').value = count ? total.toFixed(2) : '';
  document.getElementById('recordPayment').disabled = count === 0;
}

export function recordPayment(state, selected, renderAll) {
  if (!selected.size) { alert('Select one or more unpaid match bubbles first.'); return false; }

  const method   = document.getElementById('method').value;
  const provider = method === 'Mobile Banking'
    ? document.getElementById('bankProvider').value : null;
  const amount   = Number(document.getElementById('amount').value);

  const toMark = [];
  for (const k of selected) {
    const [id, mid] = k.split(':');
    const con   = state.consoles.find(x => x.id === id);
    const match = con?.matches.find(x => x.id === Number(mid));
    if (con && match && !match.paid) toMark.push({ con, match });
  }

  if (!toMark.length) return false;

  const expected = toMark.reduce((sum, { con, match }) => sum + getPrice(con, match), 0);
  if (!Number.isFinite(amount) || Math.abs(amount - expected) > 0.001) {
    alert(`The amount must match the selected bubbles: ${formatMoney(expected)}.`);
    document.getElementById('amount').value = expected.toFixed(2);
    return false;
  }

  toMark.forEach(({ con, match }) => {
    match.paid = true;
    match.method = method;
    if (typeof match.price !== 'number') {
      match.price = getPrice(con, match);
    }
  });

  const displayMethod = provider ? `Mobile Banking · ${provider}` : 'Cash';
  const consoleGroup  = [...new Set(toMark.map(({ con }) => con.id))].join(', ');
  const description   = document.getElementById('description').value.trim()
    || `${toMark.length} match(es) marked PAID ✓`;

  addTransaction(state, {
    method: displayMethod, provider, amount,
    console: consoleGroup, description,
    time: new Date().toLocaleTimeString(),
    createdAt: new Date().toISOString(),
  });

  selected.clear();
  document.getElementById('description').value = '';
  saveState(state);
  renderAll();
  return true;
}

export function initPaymentListeners(state, selected, renderAll) {
  document.getElementById('method').addEventListener('change', () => {
    const isMobile = document.getElementById('method').value === 'Mobile Banking';
    document.getElementById('bankField').style.display = isMobile ? 'block' : 'none';
  });

  document.getElementById('recordPayment').addEventListener('click', () => {
    recordPayment(state, selected, renderAll);
  });

  document.getElementById('clearSelection').addEventListener('click', () => {
    selected.clear(); renderAll();
  });

  document.getElementById('viewAll').addEventListener('click', () => {
    const cash = state.transactions.filter(t => t.method === 'Cash').reduce((n, t) => n + t.amount, 0);
    const tele = state.transactions.filter(t => t.provider === 'Telebirr').reduce((n, t) => n + t.amount, 0);
    const cbe  = state.transactions.filter(t => t.provider === 'Commercial Bank of Ethiopia').reduce((n, t) => n + t.amount, 0);
    alert(
      `ALL TRANSACTIONS\n\nCash:                        ${formatMoney(cash)}\nTelebirr:                    ${formatMoney(tele)}\nCommercial Bank of Ethiopia: ${formatMoney(cbe)}\nTotal:                       ${formatMoney(cash + tele + cbe)}\nRecords:                     ${state.transactions.length}\n\nFull list is displayed in the panel above.`
    );
  });
}
