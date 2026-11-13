/**
 * admin/workers.js
 * Worker account management: list, add, edit, activate/deactivate.
 * Authentication and permissions will be enforced in the backend phase.
 */

import { esc } from '../shared/helpers.js';
import { getWorkers, setWorkers } from '../shared/api.js';

/** Counter for auto-generating worker IDs */
function nextId(workers) {
  const nums = workers.map(w => parseInt(w.id.replace(/\D/g, ''), 10)).filter(Number.isFinite);
  return 'W' + String((nums.length ? Math.max(...nums) : 0) + 1).padStart(3, '0');
}

/**
 * Render the worker list.
 */
export function renderWorkers() {
  const workers = getWorkers();
  const list    = document.getElementById('workerList');

  document.getElementById('workerCount').textContent = workers.length;

  list.innerHTML = workers.length
    ? workers.map(w => `
        <div class="worker-row">
          <div class="worker-info">
            <div class="worker-name">
              <span class="worker-avatar">${esc(w.name.charAt(0).toUpperCase())}</span>
              <div>
                <b>${esc(w.name)}</b>
                <div class="worker-meta">${esc(w.id)} · ${esc(w.role)}</div>
              </div>
            </div>
          </div>
          <div class="worker-actions">
            <span class="pill ${w.active ? 'pill-active' : ''}">${w.active ? 'Active' : 'Inactive'}</span>
            <button class="btn-sm" data-edit-worker="${esc(w.id)}">Edit</button>
            <button class="btn-sm ${w.active ? 'btn-danger' : 'btn-primary'}"
              data-toggle-worker="${esc(w.id)}">
              ${w.active ? 'Deactivate' : 'Activate'}
            </button>
            <button class="btn-sm btn-danger" data-remove-worker="${esc(w.id)}">Remove</button>
          </div>
        </div>`).join('')
    : `<div class="admin-empty">No workers added yet.</div>`;
}

/**
 * Open the add-worker modal.
 */
function openAddWorkerModal() {
  document.getElementById('workerModalTitle').textContent = 'Add worker';
  document.getElementById('workerNameInput').value = '';
  document.getElementById('workerRoleInput').value = 'worker';
  document.getElementById('workerModal').dataset.editId = '';
  document.getElementById('workerModal').classList.add('show');
  document.getElementById('workerNameInput').focus();
}

function closeWorkerModal() {
  document.getElementById('workerModal').classList.remove('show');
}

/**
 * Bind all worker management event listeners.
 * @param {Function} renderAll
 */
export function initWorkersListeners(renderAll) {
  document.getElementById('adminAddWorker').addEventListener('click', openAddWorkerModal);

  document.getElementById('cancelWorkerModal').addEventListener('click', closeWorkerModal);
  document.getElementById('workerModal').addEventListener('click', e => {
    if (e.target === document.getElementById('workerModal')) closeWorkerModal();
  });

  /* Save worker */
  document.getElementById('saveWorkerModal').addEventListener('click', () => {
    const name   = document.getElementById('workerNameInput').value.trim();
    const role   = document.getElementById('workerRoleInput').value;
    const editId = document.getElementById('workerModal').dataset.editId;

    if (!name) { showToast('Enter a worker name.', 'error'); return; }

    const workers = getWorkers();

    if (editId) {
      const w = workers.find(x => x.id === editId);
      if (w) { w.name = name; w.role = role; }
    } else {
      workers.push({ id: nextId(workers), name, role, active: true, pin: '' });
    }

    setWorkers(workers);
    closeWorkerModal();
    renderAll();
    showToast(editId ? 'Worker updated' : `${name} added`);
  });

  document.getElementById('workerNameInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('saveWorkerModal').click();
  });

  /* Delegated clicks on worker list */
  document.getElementById('workerList').addEventListener('click', e => {
    const editBtn    = e.target.closest('[data-edit-worker]');
    const toggleBtn  = e.target.closest('[data-toggle-worker]');
    const removeBtn  = e.target.closest('[data-remove-worker]');

    if (editBtn) {
      const id      = editBtn.dataset.editWorker;
      const workers = getWorkers();
      const w       = workers.find(x => x.id === id);
      if (!w) return;
      document.getElementById('workerModalTitle').textContent = `Edit ${w.name}`;
      document.getElementById('workerNameInput').value = w.name;
      document.getElementById('workerRoleInput').value = w.role;
      document.getElementById('workerModal').dataset.editId = id;
      document.getElementById('workerModal').classList.add('show');
      document.getElementById('workerNameInput').focus();
      return;
    }

    if (toggleBtn) {
      const id      = toggleBtn.dataset.toggleWorker;
      const workers = getWorkers();
      const w       = workers.find(x => x.id === id);
      if (w) { w.active = !w.active; setWorkers(workers); renderAll(); showToast(`${w.name} ${w.active ? 'activated' : 'deactivated'}`); }
      return;
    }

    if (removeBtn) {
      const id      = removeBtn.dataset.removeWorker;
      const workers = getWorkers();
      const w       = workers.find(x => x.id === id);
      if (!w || !confirm(`Remove worker ${w.name}?`)) return;
      setWorkers(workers.filter(x => x.id !== id));
      renderAll();
      showToast(`${w.name} removed`);
    }
  });
}
