# Editor & Formatting

The editor is powered by Monaco (the same engine as VS Code) and provides a rich markdown editing experience with live preview.

## Markdown Toolbar

The toolbar above the editor provides one-click formatting:

| Group | Actions |
|---|---|
| **Text** | Bold, Italic, Inline Code |
| **Headings** | H1, H2, H3 |
| **Lists** | Unordered List, Ordered List |
| **Media** | Insert Link, Browse Images, Upload Image, Browse Attachments, Upload Attachment, Blockquote, Horizontal Rule |
| **Analysis** | Run Spell Check, Run Markdown Lint, Spell Check Settings |
| **Panels** | Toggle Document Outline, Toggle Comments Panel |

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| **Ctrl+B** | Bold selected text |
| **Ctrl+I** | Italicize selected text |
| **Ctrl+S** | Save document |
| **Ctrl+.** | Quick Fix — shows spelling/linting suggestions at cursor |
| **Ctrl+/** | Toggle comment |
| **Ctrl+Shift+L** | Toggle markdown linting on/off |
| **Shift+Enter** | New line in chat input (without sending) |

## Document Outline

Click the outline button in the toolbar to open a sidebar showing your document's heading structure (H1 through H6) as a collapsible tree. Click any heading to jump directly to that section in the editor. The outline button is disabled when the document has no headings.

## Live Preview

The right pane renders your markdown in real time, including:

- **Mermaid diagrams** — write diagram code in fenced code blocks and see them rendered as SVG
- **Syntax-highlighted code** — fenced code blocks are highlighted for the specified language
- **Math equations** — LaTeX math rendered via KaTeX
- **Tables, task lists, footnotes** — full GitHub Flavored Markdown support

### Scroll Sync

When "Sync Preview Scroll" is enabled (toggle in the user menu), scrolling the editor automatically scrolls the preview to the corresponding section, and vice versa.

## Image Handling

- **Upload** — use the Upload Image toolbar button or drag-and-drop a file onto the editor
- **Paste** — paste an image from your clipboard directly into the editor; it uploads automatically and inserts the markdown link
- **Browse** — click Browse Images to open the Image Browser, where you can search and select from previously uploaded images

## Spell Check

- Click the **Spell Check** button in the toolbar to run a check
- Errors appear as inline squiggles in the editor
- Press **Ctrl+.** with your cursor on a squiggle to see suggested corrections
- Configure which analysis types to run (Spelling, Grammar, Style, Readability) in **Settings → Spell Check**
- Add custom words to your personal dictionary in **Settings → Dictionary**

## Markdown Linting

- Click the **Markdown Lint** button in the toolbar to check for style issues
- Issues appear as inline markers with hover tooltips showing the rule and description
- Press **Ctrl+.** for quick fixes, or right-click for additional options:
  - Remove Trailing Spaces
  - Remove Multiple Blank Lines
  - Add Space After Heading Hash
  - Show Rule Documentation
- Configure which rules are active in **Settings → Linting**
- Toggle linting on/off at any time with **Ctrl+Shift+L**
