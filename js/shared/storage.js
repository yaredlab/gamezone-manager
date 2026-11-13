/**
 * storage.js
 * Browser-based data persistence using localStorage.
 * All other modules import from here — this is the single source of truth
 * for reading and writing application state.
 */

const STORAGE_KEY = 'gamezone-worker-v1';

/**
 * Default consoles loaded on first run (before any user changes).
 * Each entry: [id, type]
 * @type {Array<[string, string]>}
 */
const DEFAULT_CONSOLES = [
  ['PS4-01', 'PS4'],
  ['PS4-02', 'PS4'],
  ['PS4-03', 'PS4'],
  ['PS4-04', 'PS4'],
  ['PS5-01', 'PS5'],
  ['PS5-02', 'PS5'],
  ['PS5-03', 'PS5'],
];

/**
 * Build a fresh console object from an [id, type] pair.
 * @param {string} id   - Console name, e.g. "PS4-01"
 * @param {string} type - "PS4" or "PS5"
 * @returns {ConsoleObj}
 */
function buildConsole(id, type) {
  return {
    id,
    type,
    status: 'free',   // 'free' | 'playing' | 'paused'
    mode: 'FIFA',     // 'FIFA' | 'MISSION'
    elapsed: 0,       // seconds accumulated during pauses
    startedAt: null,  // timestamp when last resumed (ms)
    matches: [],      // Array<MatchObj> — only relevant in FIFA mode
    // ── Automatic 4-minute match cycle ──
    matchTimerElapsed:   0,    // seconds accumulated in current 4-min cycle
    matchTimerStartedAt: null, // timestamp (ms) when cycle timer last started
  };
}

/**
 * Build the default application state.
 * @returns {AppState}
 */
function buildDefaultState() {
  return {
    consoles: DEFAULT_CONSOLES.map(([id, type]) => buildConsole(id, type)),
    transactions: [],
    hidden: false,
  };
}

/**
 * Load application state from localStorage.
 * Falls back to default state when no data or corrupted data exists.
 * Runs a migration pass to add any new console fields introduced in later
 * versions (e.g. matchTimerElapsed / matchTimerStartedAt for V1.1+).
 * @returns {AppState}
 */
export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.consoles)) {
        // ── Migration: ensure every console has the auto-match timer fields ──
        parsed.consoles.forEach(con => {
          if (con.matchTimerElapsed   === undefined) con.matchTimerElapsed   = 0;
          if (con.matchTimerStartedAt === undefined) con.matchTimerStartedAt = null;
          // If the console is currently "playing" but matchTimerStartedAt is missing,
          // start the cycle timer from now (best-effort recovery after a page reload).
          if (con.status === 'playing' && !con.matchTimerStartedAt) {
            con.matchTimerStartedAt = Date.now();
          }
        });
        return parsed;
      }
    }
  } catch (err) {
    console.warn('[storage] Failed to parse saved state:', err);
  }
  return buildDefaultState();
}

/**
 * Persist the current application state to localStorage.
 * @param {AppState} state
 */
export function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.error('[storage] Failed to save state:', err);
  }
}

/**
 * Create and add a new console to the state.
 * @param {AppState} state
 * @param {string} id
 * @param {string} type
 * @returns {boolean} true if added, false if duplicate id
 */
export function addConsoleToState(state, id, type) {
  const upperID = id.trim().toUpperCase();
  if (!upperID || state.consoles.some(c => c.id === upperID)) {
    return false;
  }
  state.consoles.push(buildConsole(upperID, type));
  return true;
}

/**
 * Remove a console from the state by id.
 * Only removes consoles that are free.
 * @param {AppState} state
 * @param {string} id
 * @returns {boolean} true if removed
 */
export function removeConsoleFromState(state, id) {
  const idx = state.consoles.findIndex(c => c.id === id && c.status === 'free');
  if (idx === -1) return false;
  state.consoles.splice(idx, 1);
  return true;
}

/**
 * Record a completed payment transaction.
 * @param {AppState} state
 * @param {Object} tx - Transaction fields
 */
export function addTransaction(state, tx) {
  state.transactions.push(tx);
}

export { buildConsole, buildDefaultState };
