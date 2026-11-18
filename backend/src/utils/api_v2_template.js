/**
 * shared/api.js  — V2 (Backend-Connected)
 * =====================================================================
 * Drop-in replacement for the V1 localStorage api.js.
 * When IS_BACKEND_CONNECTED = true, every function calls the REST API.
 * When false, it falls back to localStorage (V1 behavior — no breakage).
 *
 * MIGRATION STEPS:
 *   1. Set IS_BACKEND_CONNECTED = true
 *   2. Set API_BASE_URL = 'http://localhost:4000/api'  (or your domain)
 *   3. That's it — all other modules remain unchanged.
 * =====================================================================
 */

import { loadState, saveState } from './storage.js';

// ── Connection switch ─────────────────────────────────────────────────────────

/**
 * Set to true when the Express + PostgreSQL backend is running.
 * Workers and Admin Dashboard will immediately use the real database.
 * @type {boolean}
 */
export const IS_BACKEND_CONNECTED = false;    // ← Change to true for V2

/**
 * Base URL of the GameZone Manager REST API.
 * @type {string}
 */
export const API_BASE_URL = 'http://localhost:4000/api';  // ← Your server address

// ── Generic fetch wrapper ─────────────────────────────────────────────────────

/**
 * Authenticated API fetch helper used by all V2 functions.
 * Adds Authorization header when a JWT token is stored in sessionStorage.
 * @param {string} path   e.g. '/pricing'
 * @param {object} [opts] standard fetch options
 */
export async function apiFetch(path, opts = {}) {
  const token = sessionStorage.getItem('gz_token');
  const res   = await fetch(API_BASE_URL + path, {
    headers: {
      'Content-Type':  'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...opts.headers,
    },
    ...opts,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw Object.assign(new Error(body.message || `API ${res.status}`), { status: res.status });
  }
  return res.json();
}

// ── Default pricing (used as fallback when backend is unavailable) ────────────

export const DEFAULT_PRICING = {
  ps4:             25,
  ps5:             30,
  missionPrice:    50,
  missionInterval: 30,
  mission30:       50,
  mission60:       100,
};

// ── Pricing ───────────────────────────────────────────────────────────────────

/**
 * Load active pricing.
 * V1: reads localStorage.  V2: calls GET /api/pricing synchronously (cached).
 *
 * Note: V2 usage should prefer the async version: await getPricingAsync()
 */
export function getPricing() {
  if (!IS_BACKEND_CONNECTED) {
    try {
      const raw = localStorage.getItem('gamezone-admin-pricing');
      if (raw) {
        const parsed = JSON.parse(raw);
        const missionPrice    = parsed.missionPrice ?? parsed.mission30 ?? DEFAULT_PRICING.missionPrice;
        const missionInterval = parsed.missionInterval ?? DEFAULT_PRICING.missionInterval;
        return {
          ...DEFAULT_PRICING,
          ...parsed,
          missionPrice:    Number(missionPrice)    || DEFAULT_PRICING.missionPrice,
          missionInterval: Number(missionInterval) || DEFAULT_PRICING.missionInterval,
          mission30:       Number(missionPrice)    || DEFAULT_PRICING.missionPrice,
          mission60:       (Number(missionPrice)   || DEFAULT_PRICING.missionPrice) * 2,
        };
      }
    } catch (e) {
      console.warn('[api] Failed to load pricing:', e);
    }
    return { ...DEFAULT_PRICING };
  }

  // V2: return in-memory cached pricing (populated by getPricingAsync)
  return window.__gz_pricing__ || { ...DEFAULT_PRICING };
}

/**
 * Async pricing loader — call this on page load in V2 and store result
 * in window.__gz_pricing__ so the synchronous getPricing() always has data.
 */
export async function getPricingAsync() {
  if (!IS_BACKEND_CONNECTED) return getPricing();
  try {
    const pricing = await apiFetch('/pricing');
    window.__gz_pricing__ = pricing;
    return pricing;
  } catch (e) {
    console.warn('[api] Failed to fetch pricing from backend:', e);
    return { ...DEFAULT_PRICING };
  }
}

/**
 * Persist updated pricing.
 * V1: localStorage. V2: PUT /api/pricing.
 */
export function setPricing(pricing) {
  if (!IS_BACKEND_CONNECTED) {
    const normalized = {
      ps4:             Number(pricing.ps4),
      ps5:             Number(pricing.ps5),
      missionPrice:    Number(pricing.missionPrice ?? pricing.mission30 ?? DEFAULT_PRICING.missionPrice),
      missionInterval: Math.max(1, Math.round(Number(pricing.missionInterval) || DEFAULT_PRICING.missionInterval)),
      mission30:       Number(pricing.missionPrice ?? pricing.mission30 ?? DEFAULT_PRICING.missionPrice),
      mission60:       Number(pricing.mission60    ?? ((pricing.missionPrice ?? 50) * 2)),
    };
    localStorage.setItem('gamezone-admin-pricing', JSON.stringify(normalized));
    try { window.dispatchEvent(new CustomEvent('pricing-updated', { detail: normalized })); } catch (_) {}
    return;
  }

  // V2: fire async, update cache
  apiFetch('/pricing', {
    method: 'PUT',
    body:   JSON.stringify(pricing),
  }).then(res => {
    window.__gz_pricing__ = res.pricing;
    try { window.dispatchEvent(new CustomEvent('pricing-updated', { detail: res.pricing })); } catch (_) {}
  }).catch(e => console.error('[api] setPricing failed:', e));
}

// ── App state (consoles + transactions) ──────────────────────────────────────

export function getAppState() { return loadState(); }
export function setAppState(state) { saveState(state); }

// ── Workers ───────────────────────────────────────────────────────────────────

export function getWorkers() {
  if (!IS_BACKEND_CONNECTED) {
    const defaults = [
      { id: 'W001', name: 'Worker 1', role: 'worker', active: true, pin: '' },
      { id: 'W002', name: 'Worker 2', role: 'worker', active: true, pin: '' },
    ];
    try {
      const raw = localStorage.getItem('gamezone-admin-workers');
      if (raw) return JSON.parse(raw);
    } catch (e) { console.warn('[api] Failed to load workers:', e); }
    return defaults;
  }
  // V2: use async getWorkersAsync() in components
  return window.__gz_workers__ || [];
}

export async function getWorkersAsync() {
  if (!IS_BACKEND_CONNECTED) return getWorkers();
  const workers = await apiFetch('/workers');
  window.__gz_workers__ = workers;
  return workers;
}

export function setWorkers(workers) {
  if (!IS_BACKEND_CONNECTED) {
    localStorage.setItem('gamezone-admin-workers', JSON.stringify(workers));
  }
  // V2: mutations go through dedicated PATCH /api/workers/:id calls
}

// ── Settings ──────────────────────────────────────────────────────────────────

export function getSettings() {
  const defaults = {
    businessName: 'GameZone',
    location:     '',
    phone:        '',
    currency:     'ETB',
    timezone:     'Africa/Addis_Ababa',
  };
  if (!IS_BACKEND_CONNECTED) {
    try {
      const raw = localStorage.getItem('gamezone-admin-settings');
      if (raw) return { ...defaults, ...JSON.parse(raw) };
    } catch (e) { console.warn('[api] Failed to load settings:', e); }
    return defaults;
  }
  return window.__gz_settings__ || defaults;
}

export async function getSettingsAsync() {
  if (!IS_BACKEND_CONNECTED) return getSettings();
  const settings = await apiFetch('/settings');
  window.__gz_settings__ = settings;
  return settings;
}

export function setSettings(settings) {
  if (!IS_BACKEND_CONNECTED) {
    localStorage.setItem('gamezone-admin-settings', JSON.stringify(settings));
    return;
  }
  apiFetch('/settings', { method: 'PUT', body: JSON.stringify(settings) })
    .then(s => { window.__gz_settings__ = s; })
    .catch(e => console.error('[api] setSettings failed:', e));
}
