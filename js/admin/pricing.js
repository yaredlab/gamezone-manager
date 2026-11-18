/**
 * admin/pricing.js
 * Pricing management — configure FIFA and Mission Mode prices and intervals.
 * Synchronizes with Worker Control Panel in real time.
 */

import { getPricing, setPricing } from '../shared/api.js';

/**
 * Load current pricing into the form inputs.
 */
export function renderPricing() {
  const p = getPricing();

  const ps4El = document.getElementById('ps4Price');
  const ps5El = document.getElementById('ps5Price');
  const mPriceEl = document.getElementById('missionPrice');
  const mIntervalEl = document.getElementById('missionInterval');

  if (ps4El) ps4El.value = p.ps4;
  if (ps5El) ps5El.value = p.ps5;
  if (mPriceEl) mPriceEl.value = p.missionPrice ?? p.mission30 ?? 50;
  if (mIntervalEl) mIntervalEl.value = p.missionInterval ?? 30;
}

/**
 * Bind save button, validation, and real-time synchronization.
 * @param {Function} renderAll
 */
export function initPricingListeners(renderAll) {
  const saveBtn = document.getElementById('savePrices');
  if (!saveBtn) return;

  saveBtn.addEventListener('click', () => {
    const ps4 = Number(document.getElementById('ps4Price').value);
    const ps5 = Number(document.getElementById('ps5Price').value);
    const missionPrice = Number(document.getElementById('missionPrice').value);
    const missionInterval = Number(document.getElementById('missionInterval').value);

    // Validation
    if (!Number.isFinite(ps4) || ps4 <= 0) {
      window.showToast('Enter a valid positive price for PS4 FIFA matches.', 'error');
      document.getElementById('ps4Price').focus();
      return;
    }
    if (!Number.isFinite(ps5) || ps5 <= 0) {
      window.showToast('Enter a valid positive price for PS5 FIFA matches.', 'error');
      document.getElementById('ps5Price').focus();
      return;
    }
    if (!Number.isFinite(missionPrice) || missionPrice <= 0) {
      window.showToast('Enter a valid positive price for Mission Mode.', 'error');
      document.getElementById('missionPrice').focus();
      return;
    }
    if (!Number.isFinite(missionInterval) || missionInterval < 1 || !Number.isInteger(missionInterval)) {
      window.showToast('Billing interval must be a positive integer in minutes (e.g. 30).', 'error');
      document.getElementById('missionInterval').focus();
      return;
    }

    if (ps5 < ps4) {
      window.showToast('Note: PS5 price is set lower than PS4.', 'warn');
    }

    setPricing({
      ps4,
      ps5,
      missionPrice,
      missionInterval,
      mission30: missionPrice,
      mission60: missionPrice * 2,
    });

    renderPricing();
    renderAll();
    window.showToast('✓ Pricing saved and synchronized with Worker Control Panel.');
  });

  /* Prevent negative input values */
  ['ps4Price', 'ps5Price', 'missionPrice', 'missionInterval'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', e => {
        if (Number(e.target.value) < 0) e.target.value = 0;
      });
    }
  });
}
