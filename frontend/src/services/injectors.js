/**
 * Service Injector
 * Provides dependency injection for services to improve testability and decoupling
 */

import { AuthService, DocumentService, DocumentStorageService } from './core';
import { SpellCheckService } from './editor';
import { MermaidExportService } from './rendering';
import { IconService } from './icons';
import CopyService from './ui/CopyService.js';
import NotificationService from './utilities/notifications.js';

// Service instances cache
const serviceInstances = new Map();

/**
 * Get or create a service instance with dependencies injected
 * @param {string} serviceName - Name of the service
 * @param {Object} dependencies - Optional dependencies to inject
 * @returns {Object} Service instance
 */
export function getService(serviceName, dependencies = {}) {
  if (serviceInstances.has(serviceName)) {
    return serviceInstances.get(serviceName);
  }

  let instance;

  switch (serviceName) {
    case 'auth':
      instance = AuthService; // Already instantiated
      break;

    case 'document':
      // DocumentService is already instantiated (singleton)
      instance = DocumentService;
      break;

    case 'documentStorage':
      instance = DocumentStorageService; // Already instantiated
      break;

    case 'notification':
      instance = NotificationService; // Already instantiated
      break;

    case 'spellCheck':
      instance = SpellCheckService; // Already instantiated
      break;

    case 'mermaidExport':
      instance = MermaidExportService; // Static class
      break;

    case 'icon':
      instance = IconService; // Already instantiated
      break;

    case 'copy':
      instance = CopyService; // Already instantiated
      break;

    default:
      throw new Error(`Unknown service: ${serviceName}`);
  }

  serviceInstances.set(serviceName, instance);
  return instance;
}

/**
 * Clear service instances (useful for testing)
 */
export function clearServiceInstances() {
  serviceInstances.clear();
}

/**
 * Service factory for creating services with custom dependencies
 */
export const serviceFactory = {
  createAuthService: () => getService('auth'),
  createDocumentService: () => getService('document'),
  createDocumentStorageService: () => getService('documentStorage'),
  createNotificationService: () => getService('notification'),
  createSpellCheckService: () => getService('spellCheck'),
  createMermaidExportService: () => getService('mermaidExport'),
  createIconService: () => getService('icon'),
  createCopyService: () => getService('copy'),
};