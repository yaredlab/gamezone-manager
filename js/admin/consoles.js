/**
 * admin/consoles.js
 * Console management: list, add, edit name, remove.
 * Writes directly to the shared worker storage key so changes
 * are immediately visible in the Worker Dashboard.
 */

import { formatMoney, esc } from '../shared/helpers.js';
import { loadState, saveState, addConsoleToState, removeConsoleFromState } from '../shared/storage.js';
import { getPricing } from '../shared/api.js';

/** @type {string|null} ID of the console currently being edited */
let editingId = null;

/**
 * Render the consoles table.
 * @param {AppState} state
 */
export function renderConsoles(state) {
  const pricing  = getPricing();
  const consoles = state.consoles || [];

  document.getElementById('consoleCount').textContent  = consoles.length;
  document.getElementById('activeConsolesCount').textContent =
    consoles.filter(c => c.status !== 'free').length;

  document.getElementById('consoleRows').innerHTML = consoles.length
    ? consoles.map(c => {
        const price      = c.type === 'PS5' ? pricing.ps5 : pricing.ps4;
        const statusCls  = c.status === 'playing' ? 'pill pill-active'
                         : c.status === 'paused'  ? 'pill pill-pause'
                         : 'pill';
        const statusTxt  = c.status === 'free' ? 'Available'
                         : c.status === 'playing' ? 'Playing'
                         : c.status === 'paused'  ? 'Paused'
                         : esc(c.status);
        const isBusy     = c.status !== 'free';
        const matchCount = (c.matches || []).length;
        const unpaidCount = (c.matches || []).filter(m => !m.paid).length;

        return `
          <tr>
            <td><b>${esc(c.id)}</b></td>
            <td><span class="pill">${esc(c.type)}</span></td>
            <td>${formatMoney(price)} / match</td>
            <td>${esc(c.mode || 'FIFA')}</td>
            <td><span class="${statusCls}">${statusTxt}</span></td>
            <td>${matchCount} match${matchCount !== 1 ? 'es' : ''}
              ${unpaidCount > 0 ? `<span class="warn-badge">${unpaidCount} unpaid</span>` : ''}
            </td>
            <td class="action-cell">
              <button class="btn-sm" data-edit="${esc(c.id)}" ${isBusy ? 'disabled title="Session active"' : ''}>Rename</button>
              <button class="btn-sm btn-danger" data-remove="${esc(c.id)}" ${isBusy ? 'disabled title="Session active"' : ''}>Remove</button>
            </td>
          </tr>`;
      }).join('')
    : `<tr><td colspan="7" class="admin-empty">No consoles registered.</td></tr>`;
}

/**
 * Open the Add Console modal.
 */
function openAddModal() {
  editingId = null;
  document.getElementById('consoleModalTitle').textContent = 'Add console';
  document.getElementById('consoleName').value = '';
  document.getElementById('consoleType').value = 'PS4';
  document.getElementById('consoleModal').classList.add('show');
  document.getElementById('consoleName').focus();
}

/**
 * Open the Rename Console modal.
 * @param {string} id
 */
function openEditModal(id) {
  editingId = id;
  document.getElementById('consoleModalTitle').textContent = `Rename ${id}`;
  document.getElementById('consoleName').value = id;
  document.getElementById('consoleType').style.display = 'none'; // hide type for rename
  document.getElementById('consoleModal').classList.add('show');
  document.getElementById('consoleName').focus();
}

function closeModal() {
  document.getElementById('consoleModal').classList.remove('show');
  document.getElementById('consoleType').style.display = '';
}

/**
 * Bind all console management event listeners.
 * @param {Function} renderAll - admin-level full re-render
 */
export function initConsolesListeners(renderAll) {
  /* Add button */
  document.getElementById('adminAddConsole').addEventListener('click', openAddModal);

  /* Modal close */
  document.getElementById('cancelConsoleModal').addEventListener('click', closeModal);
  document.getElementById('consoleModal').addEventListener('click', e => {
    if (e.target === document.getElementById('consoleModal')) closeModal();
  });

  /* Save (add or rename) */
  document.getElementById('saveConsoleModal').addEventListener('click', () => {
    const state = loadState();
    const name  = document.getElementById('consoleName').value.trim().toUpperCase();
    const type  = document.getElementById('consoleType').value;

    if (!name) { showToast('Enter a console name.', 'error'); return; }

    if (editingId) {
      /* Rename: check unique, update id */
      if (name !== editingId && state.consoles.some(c => c.id === name)) {
        showToast('That name is already taken.', 'error'); return;
      }
      const con = state.consoles.find(c => c.id === editingId);
      if (con) con.id = name;
    } else {
      /* Add new */
      if (!addConsoleToState(state, name, type)) {
        showToast('A console with that name already exists.', 'error'); return;
      }
    }

    saveState(state);
    closeModal();
    renderAll();
    showToast(editingId ? `Renamed to ${name}` : `${name} added`);
  });

  /* Enter key inside name input */
  document.getElementById('consoleName').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('saveConsoleModal').click();
  });

  /* Delegated click on table rows (edit / remove) */
  document.getElementById('consoleRows').addEventListener('click', e => {
    const editBtn   = e.target.closest('[data-edit]');
    const removeBtn = e.target.closest('[data-remove]');

    if (editBtn) {
      openEditModal(editBtn.dataset.edit);
      return;
    }

    if (removeBtn) {
      const id    = removeBtn.dataset.remove;
      const state = loadState();
      if (!confirm(`Remove ${id}? This cannot be undone.`)) return;
      if (!removeConsoleFromState(state, id)) {
        showToast('Cannot remove a console with an active session.', 'error'); return;
      }
      saveState(state);
      renderAll();
      showToast(`${id} removed`);
    }
  });
}
