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
 * Load admin-only pricing configuration.
 * Key is separate from worker state so admin can update without touching sessions.
 * @returns {{ ps4: number, ps5: number, mission30: number, mission60: number }}
 */
export function getPricing() {
  const defaults = { ps4: 25, ps5: 30, mission30: 50, mission60: 100 };
  try {
    const raw = localStorage.getItem('gamezone-admin-pricing');
    if (raw) return { ...defaults, ...JSON.parse(raw) };
  } catch (e) {
    console.warn('[api] Failed to load pricing:', e);
  }
  return defaults;
}

/**
 * Save admin-only pricing configuration.
 * @param {{ ps4: number, ps5: number, mission30: number, mission60: number }} pricing
 */
export function setPricing(pricing) {
  localStorage.setItem('gamezone-admin-pricing', JSON.stringify(pricing));
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
