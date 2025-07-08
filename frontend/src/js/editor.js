import * as monaco from "monaco-editor/esm/vs/editor/editor.api";
import { EDITOR_KEY } from "./constants";

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

class Editor {
  constructor() {
    this.instance = null;
  }

  async setup(theme) {
    if (this.instance) {
      // Always update theme if already initialized
      await this.applyTheme(theme);
      return this.instance;
    }
    const saved = localStorage.getItem(EDITOR_KEY) || defaultGraph;
    this.instance = monaco.editor.create(document.getElementById("editor"), {
      value: saved,
      language: "markdown",
      theme: "vs-" + theme,
      automaticLayout: true,
      minimap: {
        enabled: false,
      },
      fontFamily: "Consolas, Courier New, monospace",
      fontSize: 14,
      wordWrap: "on",
      padding: {
        top: 20,
        bottom: 10,
      },
    });
    return this.instance;
  }

  async applyTheme(theme) {
    if (this.instance) {
      monaco.editor.setTheme("vs-" + theme);
    }
  }

  getInstance() {
    return this.instance;
  }
}

const editor = new Editor();
export default editor;
