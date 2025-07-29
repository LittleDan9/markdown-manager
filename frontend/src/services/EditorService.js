import * as monaco from "monaco-editor/esm/vs/editor/editor.api";
import PerformanceOptimizer from "./PerformanceOptimizer";

class Editor {
  async setup(domNode, value, theme){
    if (this.instance) {
      this.instance.dispose();
    }

    // Get optimized options based on document size
    const baseOptions = {
      value: value || "",
      language: "markdown",
      theme: "vs-" + (theme || "light"),
      automaticLayout: true,
      fontFamily: "Consolas, Courier New, monospace",
      fontSize: 14,
      padding: { top: 20, bottom: 10 },
      // Always disable minimap for Markdown editor
      minimap: { enabled: false },
      // Always enable word wrap for Markdown editor
      wordWrap: "on",
      // Disable performance-heavy features to prevent Chrome freezing
      hover: { enabled: false },
      quickSuggestions: false,
      suggestOnTriggerCharacters: false,
      acceptSuggestionOnEnter: "off",
      tabCompletion: "off",
      wordBasedSuggestions: false,
      // Disable language features that might cause performance issues
      semanticHighlighting: { enabled: false },
      occurrencesHighlight: false,
      selectionHighlight: false,
      // Disable potentially expensive decorations
      renderLineHighlight: "none",
      renderWhitespace: "none",
      renderControlCharacters: false,
      direction: "LTR"
    };

    // Apply performance optimizations for large documents
    const optimizedOptions = {
      ...baseOptions,
      ...PerformanceOptimizer.getOptimizedEditorOptions(value)
    };

    this.instance = monaco.editor.create(domNode, optimizedOptions);

    // Log performance info for debugging
    if (PerformanceOptimizer.isLargeDocument(value)) {
      const size = Math.round((value?.length || 0) / 1024);
      console.log(`Editor: Performance mode active for ${size}KB document`);
    }

    return this.instance;
  }

  applyTheme(theme) {
    if (this.instance) {
      monaco.editor.setTheme("vs-" + (theme || "light"));
    }
  }

  getInstance() {
    return this.instance;
  }
}

export default new Editor();

/*
const defaultGraph = [
  "# This is a sample Mermaid flowchart",
  "``` mermaid",
  "---",
  "title: Sample flowchart",
  "---",
  "flowchart LR",
  "  A[Square Rect] --> B((Circle))",
  "  B --> C{Rhombus?}",
  "  C -->|One| D[Result 1]",
  "  C -->|Two| E[Result 2]",
  "```",
].join("\n");

*/