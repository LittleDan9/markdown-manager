/**
 * Icon Management Service
 * Handles installing and managing icon packs via admin API
 */

import { adminIconsApi } from '@/api/admin';

class IconManagementService {
  /**
   * Install new icon pack (admin function)
   */
  async installIconPack(packData, mappingConfig, packageType = 'json') {
    try {
      const result = await adminIconsApi.installIconPack(packData, mappingConfig, packageType);
      return result;
    } catch (error) {
      console.error('Failed to install icon pack:', error);
      throw error;
    }
  }

  /**
   * Remove icon pack (admin function)
   */
  async removeIconPack(packName) {
    try {
      const result = await adminIconsApi.deleteIconPack(packName);
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
      const result = await adminIconsApi.updateIconPackMetadata(packName, updateData);
      return result;
    } catch (error) {
      console.error('Failed to update icon pack:', error);
      throw error;
    }
  }
}

export default IconManagementService;
