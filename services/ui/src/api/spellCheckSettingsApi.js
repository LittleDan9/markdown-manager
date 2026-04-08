/**
 * Spell Check Settings API - manages persisted user spell check preferences
 */
import { Api } from './api';

class SpellCheckSettingsApi extends Api {
  /**
   * Get the current user's spell check settings.
   * Returns null if no settings saved (use client defaults).
   */
  async getSettings() {
    try {
      const response = await this.apiCall('/spell-check-settings/', 'GET');
      return response.data;
    } catch (error) {
      if (error?.response?.status === 404) {
        return null; // No saved settings, use defaults
      }
      console.error('Failed to load spell check settings:', error);
      return null;
    }
  }

  /**
   * Save (create/update) spell check settings.
   * Only provided fields are updated; omitted fields keep their current values.
   */
  async saveSettings(settings) {
    try {
      const response = await this.apiCall('/spell-check-settings/', 'PUT', settings);
      return response.data;
    } catch (error) {
      console.error('Failed to save spell check settings:', error);
      throw error;
    }
  }

  /**
   * Reset spell check settings to defaults.
   */
  async resetSettings() {
    try {
      const response = await this.apiCall('/spell-check-settings/', 'DELETE');
      return response.data;
    } catch (error) {
      if (error?.response?.status === 404) {
        return { message: 'No settings to reset' };
      }
      console.error('Failed to reset spell check settings:', error);
      throw error;
    }
  }
}

export default new SpellCheckSettingsApi();
