/**
 * admin/pricing.js
 * Pricing management — read and write admin-controlled prices.
 * Prices are stored separately from worker state so they can be
 * updated without touching active session data.
 */

import { getPricing, setPricing } from '../shared/api.js';

/**
 * Load current pricing into the form inputs.
 */
export function renderPricing() {
  const p = getPricing();
  document.getElementById('ps4Price').value   = p.ps4;
  document.getElementById('ps5Price').value   = p.ps5;
  document.getElementById('mission30').value  = p.mission30;
  document.getElementById('mission60').value  = p.mission60;
}

/**
 * Bind save button and input validation.
 * @param {Function} renderAll
 */
export function initPricingListeners(renderAll) {
  document.getElementById('savePrices').addEventListener('click', () => {
    const ps4      = Number(document.getElementById('ps4Price').value);
    const ps5      = Number(document.getElementById('ps5Price').value);
    const m30      = Number(document.getElementById('mission30').value);
    const m60      = Number(document.getElementById('mission60').value);

    if ([ps4, ps5, m30, m60].some(n => !Number.isFinite(n) || n < 0)) {
      showToast('Enter valid positive prices for all fields.', 'error');
      return;
    }
    if (ps5 < ps4) {
      showToast('PS5 price is lower than PS4 — confirm this is intentional.', 'warn');
    }
    if (m60 < m30 * 2) {
      showToast('60-min price is lower than 2 × 30-min — confirm this is intentional.', 'warn');
    }

    setPricing({ ps4, ps5, mission30: m30, mission60: m60 });
    renderAll();
    showToast('Pricing saved. Changes will apply to new sessions.');
  });

  /* Prevent negative input */
  ['ps4Price','ps5Price','mission30','mission60'].forEach(id => {
    document.getElementById(id).addEventListener('input', e => {
      if (Number(e.target.value) < 0) e.target.value = 0;
    });
  });
}
