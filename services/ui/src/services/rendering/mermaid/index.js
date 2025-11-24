// Mermaid rendering services - modular architecture
export { default as MermaidRenderer } from './MermaidRenderer.js';
export { default as MermaidCache } from './MermaidCache.js';
export { default as MermaidThemeManager } from './MermaidThemeManager.js';
export { default as MermaidValidator } from './MermaidValidator.js';
export { default as MermaidIconLoader } from './MermaidIconLoader.js';
export { default as useMermaid } from './useMermaid.js';

// Create a singleton instance for backward compatibility
import MermaidRenderer from './MermaidRenderer.js';
export default new MermaidRenderer();
