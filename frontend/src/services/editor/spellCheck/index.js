/**
 * Spell Check Services - Barrel exports
 *
 * Centralized exports for all spell checking functionality including
 * service, markers, actions, worker pool, and text analysis.
 */

// Core spell checking service
export { default as SpellCheckService } from './SpellCheckService';

// Worker pool for performance optimization
export { default as SpellCheckWorkerPool } from './SpellCheckWorkerPool';

// Marker management and editor integration
export { default as SpellCheckMarkers } from './SpellCheckMarkers';

// Editor actions and quick fixes
export { default as SpellCheckActions } from './SpellCheckActions';

// Text analysis for performance optimization
export { default as TextRegionAnalyzer } from './TextRegionAnalyzer';