/**
 * Icon Usage Service
 * Handles usage example generation and tracking
 */

import { iconsApi } from '@/api/iconsApi.js';

class IconUsageService {
  /**
   * Generate usage example for Mermaid diagrams
   */
  generateUsageExample(prefix, key, diagramType) {
    const iconRef = `${prefix}:${key}`;

    if (diagramType === 'architecture') {
      // Determine if it's a group or service based on prefix
      if (prefix.includes('grp') || prefix.includes('group')) {
        return `group mygroup(${iconRef})[My Group]`;
      } else {
        return `service myservice(${iconRef})[My Service]`;
      }
    } else if (diagramType === 'flowchart') {
      return `A@{ icon: "${iconRef}", form: "square", label: "Node" }`;
    }

    return iconRef;
  }

  /**
   * Track icon usage (optional analytics)
   */
  async trackUsage(pack, key, userId = null) {
    try {
      await iconsApi.trackUsage(pack, key, userId);
    } catch (error) {
      console.warn('Failed to track icon usage:', error);
      // Don't throw - usage tracking is optional
    }
  }

  /**
   * Generate formatted icon reference
   */
  generateIconReference(pack, key) {
    return `${pack}:${key}`;
  }

  /**
   * Parse icon reference back to components
   */
  parseIconReference(iconRef) {
    const parts = iconRef.split(':');
    if (parts.length !== 2) {
      throw new Error(`Invalid icon reference format: ${iconRef}`);
    }
    return {
      pack: parts[0],
      key: parts[1]
    };
  }

  /**
   * Validate icon reference format
   */
  isValidIconReference(iconRef) {
    try {
      this.parseIconReference(iconRef);
      return true;
    } catch {
      return false;
    }
  }
}

export default IconUsageService;
