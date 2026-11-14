/**
 * shared/api.js
 * API integration layer — placeholder for future backend connection.
 *
 * In V1 all functions fall back to localStorage via storage.js.
 * In V2 replace the localStorage calls with fetch() to your REST API.
 *
 * USAGE RULE: Every module that reads or writes persistent data should
 * call a function from this file rather than touching localStorage directly.
 * This keeps the backend migration to a single-file change.
 */

import { loadState, saveState } from './storage.js';

// ── Connection status ──────────────────────────────────────────────────────────

/**
 * Whether the app is connected to a real backend.
 * Always false in V1. Set to true in V2 when API_BASE_URL is configured.
 */
export const IS_BACKEND_CONNECTED = false;

/**
 * Base URL for the future REST API.
 * Example: 'https://api.gamezone.et/v1'
 */
export const API_BASE_URL = '';

// ── Generic fetch wrapper (for V2) ────────────────────────────────────────────

/**
 * Make an authenticated API request.
 * Currently unused — prepared for V2.
 *
 * @param {string} path   - API path, e.g. '/transactions'
 * @param {object} [opts] - fetch options
 * @returns {Promise<any>}
 */
export async function apiFetch(path, opts = {}) {
  if (!IS_BACKEND_CONNECTED) {
    throw new Error('[api] Backend not connected. Using localStorage fallback.');
  }
  const res = await fetch(API_BASE_URL + path, {
    headers: { 'Content-Type': 'application/json', ...opts.headers },
    ...opts,
  });
  if (!res.ok) throw new Error(`API error ${res.status}: ${res.statusText}`);
  return res.json();
}

// ── Data access functions (localStorage in V1, API in V2) ─────────────────────

/**
 * Load the full application state.
 * @returns {AppState}
 */
export function getAppState() {
  return loadState();
}

/**
 * Persist the full application state.
 * @param {AppState} state
 */
export function setAppState(state) {
  saveState(state);
}

/**
 * Default system pricing in ETB.
 */
export const DEFAULT_PRICING = {
  ps4: 25,             // ETB per FIFA match on PS4
  ps5: 30,             // ETB per FIFA match on PS5
  missionPrice: 50,    // ETB per Mission Mode bubble
  missionInterval: 30, // Billing interval in minutes (default: 30)
  mission30: 50,       // Legacy alias for backward compatibility
  mission60: 100,      // Legacy alias for backward compatibility
};

/**
 * Load admin-only pricing configuration.
 * Key is separate from worker state so admin can update without touching sessions.
 * Automatically synchronizes between Admin Dashboard and Worker Control Panel.
 * @returns {{ ps4: number, ps5: number, missionPrice: number, missionInterval: number, mission30: number, mission60: number }}
 */
export function getPricing() {
  try {
    const raw = localStorage.getItem('gamezone-admin-pricing');
    if (raw) {
      const parsed = JSON.parse(raw);
      // Migration / fallback for legacy fields
      const missionPrice = parsed.missionPrice ?? parsed.mission30 ?? DEFAULT_PRICING.missionPrice;
      const missionInterval = parsed.missionInterval ?? DEFAULT_PRICING.missionInterval;
      return {
        ...DEFAULT_PRICING,
        ...parsed,
        missionPrice: Number(missionPrice) || DEFAULT_PRICING.missionPrice,
        missionInterval: Number(missionInterval) || DEFAULT_PRICING.missionInterval,
        mission30: Number(missionPrice) || DEFAULT_PRICING.missionPrice,
        mission60: (Number(missionPrice) || DEFAULT_PRICING.missionPrice) * 2,
      };
    }
  } catch (e) {
    console.warn('[api] Failed to load pricing:', e);
  }
  return { ...DEFAULT_PRICING };
}

/**
 * Save admin-only pricing configuration.
 * Saves to localStorage and triggers storage/pricing-updated events for immediate sync.
 * @param {{ ps4: number, ps5: number, missionPrice: number, missionInterval: number }} pricing
 */
export function setPricing(pricing) {
  const normalized = {
    ps4: Number(pricing.ps4),
    ps5: Number(pricing.ps5),
    missionPrice: Number(pricing.missionPrice ?? pricing.mission30 ?? DEFAULT_PRICING.missionPrice),
    missionInterval: Math.max(1, Math.round(Number(pricing.missionInterval) || DEFAULT_PRICING.missionInterval)),
    mission30: Number(pricing.missionPrice ?? pricing.mission30 ?? DEFAULT_PRICING.missionPrice),
    mission60: Number(pricing.mission60 ?? ((pricing.missionPrice ?? 50) * 2)),
  };
  localStorage.setItem('gamezone-admin-pricing', JSON.stringify(normalized));
  // Dispatch custom event for same-tab reactivity
  try {
    window.dispatchEvent(new CustomEvent('pricing-updated', { detail: normalized }));
  } catch (_) {}
}

/**
 * Load admin worker list.
 * @returns {Array<WorkerObj>}
 */
export function getWorkers() {
  const defaults = [
    { id: 'W001', name: 'Worker 1', role: 'worker', active: true, pin: '' },
    { id: 'W002', name: 'Worker 2', role: 'worker', active: true, pin: '' },
  ];
  try {
    const raw = localStorage.getItem('gamezone-admin-workers');
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.warn('[api] Failed to load workers:', e);
  }
  return defaults;
}

/**
 * Save admin worker list.
 * @param {Array<WorkerObj>} workers
 */
export function setWorkers(workers) {
  localStorage.setItem('gamezone-admin-workers', JSON.stringify(workers));
}

/**
 * Load admin settings (business info, preferences).
 * @returns {Object}
 */
export function getSettings() {
  const defaults = {
    businessName: 'GameZone',
    location: '',
    phone: '',
    currency: 'ETB',
    timezone: 'Africa/Addis_Ababa',
  };
  try {
    const raw = localStorage.getItem('gamezone-admin-settings');
    if (raw) return { ...defaults, ...JSON.parse(raw) };
  } catch (e) {
    console.warn('[api] Failed to load settings:', e);
  }
  return defaults;
}

/**
 * Save admin settings.
 * @param {Object} settings
 */
export function setSettings(settings) {
  localStorage.setItem('gamezone-admin-settings', JSON.stringify(settings));
}
