// Single shared MermaidRenderer instance used across the entire application.
// Import this module (not MermaidRenderer.js directly) whenever you need the renderer.
import MermaidRenderer from './MermaidRenderer.js';

export default new MermaidRenderer();
