/**
 * Icon Management Service
 * Handles installing and managing icon packs
 */

import { iconsApi } from '@/api/iconsApi.js';

class IconManagementService {
  /**
   * Install new icon pack (admin function)
   */
  async installIconPack(packData, mappingConfig, packageType = 'json') {
    try {
      const result = await iconsApi.installIconPack(packData, mappingConfig, packageType);
      return result;
    } catch (error) {
      console.error('Failed to install icon pack:', error);
      throw error;
    }
  }

  /**
   * Get cache statistics (for debugging)
   */
  async getCacheStats() {
    try {
      return await iconsApi.getCacheStats();
    } catch (error) {
      console.error('Failed to get cache stats:', error);
      throw error;
    }
  }

  /**
   * Clear server cache
   */
  async clearServerCache() {
    try {
      await iconsApi.clearCache();
    } catch (error) {
      console.warn('Failed to clear server cache:', error);
      throw error;
    }
  }

  /**
   * Remove icon pack (admin function)
   */
  async removeIconPack(packName) {
    try {
      const result = await iconsApi.removeIconPack(packName);
      return result;
    } catch (error) {
      console.error('Failed to remove icon pack:', error);
      throw error;
    }
  }

  /**
   * Update icon pack metadata (admin function)
   */
  async updateIconPack(packName, updateData) {
    try {
      const result = await iconsApi.updateIconPack(packName, updateData);
      return result;
    } catch (error) {
      console.error('Failed to update icon pack:', error);
      throw error;
    }
  }

  /**
   * Get icon pack installation status
   */
  async getInstallationStatus(packName) {
    try {
      return await iconsApi.getInstallationStatus(packName);
    } catch (error) {
      console.error('Failed to get installation status:', error);
      throw error;
    }
  }
}

export default IconManagementService;
