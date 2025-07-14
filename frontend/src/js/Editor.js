import * as monaco from "monaco-editor/esm/vs/editor/editor.api";

class Editor {
  async setup(domNode, value, theme){
    if (this.instance) {
      this.instance.dispose();
    }
    this.instance = monaco.editor.create(domNode, {
      value: value || "",
      language: "markdown",
      theme: "vs-" + (theme || "light"),
      automaticLayout: true,
      minimap: { enabled: false },
      fontFamily: "Consolas, Courier New, monospace",
      fontSize: 14,
      wordWrap: "on",
      padding: { top: 20, bottom: 10 },
    });
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