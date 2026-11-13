/**
 * admin/settings.js
 * Business information and system preferences.
 */

import { getSettings, setSettings } from '../shared/api.js';

/**
 * Load settings into the form.
 */
export function renderSettings() {
  const s = getSettings();
  document.getElementById('settingBusinessName').value = s.businessName || '';
  document.getElementById('settingLocation').value     = s.location     || '';
  document.getElementById('settingPhone').value        = s.phone        || '';
  document.getElementById('settingCurrency').value     = s.currency     || 'ETB';
  document.getElementById('settingTimezone').value     = s.timezone     || 'Africa/Addis_Ababa';
}

/**
 * Bind save button.
 * @param {Function} renderAll
 */
export function initSettingsListeners(renderAll) {
  document.getElementById('saveSettings').addEventListener('click', () => {
    const s = {
      businessName: document.getElementById('settingBusinessName').value.trim(),
      location:     document.getElementById('settingLocation').value.trim(),
      phone:        document.getElementById('settingPhone').value.trim(),
      currency:     document.getElementById('settingCurrency').value,
      timezone:     document.getElementById('settingTimezone').value,
    };
    if (!s.businessName) { showToast('Business name is required.', 'error'); return; }
    setSettings(s);
    renderAll();
    showToast('Settings saved.');
  });
}
