# Phase 3: Layout & Surfaces — Borders, Panels, Cards, Modals

> **Status: ✅ Implemented** — March 2026

## Objective

Soften the visual weight of the app's container structure. Replace heavy `1px solid #ced4da` borders with lighter dividers and shadow-based depth. Modernize cards, modals, and the split-panel surfaces for a cleaner, more spacious feel.

## Prerequisites

- **Phase 1 completed** — design tokens available
- **Phase 2 completed** — header and toolbar already using tokens
- Branch: `ui-refresh`
- Frontend running: `docker compose up frontend -d`

---

## Current State

### Layout — `services/ui/src/styles/_layout.scss`

Key problem areas (with line references):

1. **Editor container** (around line 84-100): Uses `border: 1px solid #ced4da` with hard-coded dark override `border-color: #495057`
2. **Preview container** (around line 105-130): Uses `box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1)`, `border: #ced4da 1px solid`
3. **Shared view** (around line 60-80): Uses hard-coded `border: #ced4da 1px solid`, `border-radius: 0.5rem`, `box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1)`
4. **Padding** values are inconsistent `0.5rem` (recently reduced from `1rem`)

### Modals — `services/ui/src/styles/modals/_base.scss`

1. `.modal-content` — `border-radius: 0.5rem`, `box-shadow: 0 0.5rem 1rem rgba(0, 0, 0, 0.15)`
2. `.modal-header` — hard-coded dark mode `background-color: #2a2a2a`
3. `.modal-body` — dark mode `background-color: #1a1a1a`
4. `.modal-footer` — uses `!important` on padding/height
5. `body .custom-modal-content` — hard-coded `background-color: #fff`, dark `background-color: #2a2a2a`

### Code Blocks — `services/ui/src/styles/code/_blocks.scss`

1. `.code-block` — `border: 1px solid variables.$color-border`, `border-radius: 4px`
2. `.code-block-header` — hard-coded `variables.$color-bg-light` background
3. Inline code `code:not(pre code)` — uses `var(--bs-tertiary-bg)` and `var(--bs-border-color)`

### Preview — `services/ui/src/styles/_preview.scss`

1. Markdown elements use hard-coded colors (`#f8f9fa`, `#2d2d2d`, `#dee2e6`)
2. Blockquote uses hard-coded `border-left: 4px solid #dee2e6`, `background-color: #f8f9fa`
3. Table uses hard-coded `border: 2px solid #212529`, `background: #fff`

---

## Changes

### 1. Update `_layout.scss` — Panel Surfaces

Replace hard-coded borders and shadows with design tokens. The key principle: **use shadows for depth, borders only for separation**.

**Find the `#editorContainer` block with the `#editor` sub-block:**

```scss
    #editorContainer {
      flex: 0 0 40%;
      height: 100%;
      display: flex;
      flex-direction: column;
      min-height: 0;
      max-height: 100%;
      border-top-left-radius: 0.5rem;
      border-bottom-left-radius: 0.5rem;
      padding: 0.5rem;
      box-sizing: border-box;
      overflow: hidden;

      #editor {
        flex: 1 1 auto;
        border: 1px solid #ced4da;
        border-radius: 0.5rem;
        overflow: hidden;
        min-height: 0;

        @include mixins.dark {
          border-color: #495057;
        }
      }
    }
```

**Replace with:**

```scss
    #editorContainer {
      flex: 0 0 40%;
      height: 100%;
      display: flex;
      flex-direction: column;
      min-height: 0;
      max-height: 100%;
      border-top-left-radius: variables.$radius-md;
      border-bottom-left-radius: variables.$radius-md;
      padding: variables.$space-2;
      box-sizing: border-box;
      overflow: hidden;

      #editor {
        flex: 1 1 auto;
        border: 1px solid var(--mm-border);
        border-radius: variables.$radius-md;
        overflow: hidden;
        min-height: 0;
        @include mixins.elevation("xs");
      }
    }
```

**Find the `#previewContainer` block with the `#preview` sub-block:**

```scss
    #previewContainer {
      flex: 0 0 60%;
      height: 100%;
      display: flex;
      flex-direction: column;
      min-height: 0;
      padding: 0.5rem;
      padding-top: 0.5rem;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);

      #preview {
        width: 100%;
        display: flex;
        flex-direction: column;
        border-radius: 0.5rem;
        border: #ced4da 1px solid;
        padding: 0.25rem;
        box-sizing: border-box;
        flex: 1 1 auto;
        min-height: 0;

        @include mixins.dark {
          border-color: #495057;
        }
      }
```

**Replace with:**

```scss
    #previewContainer {
      flex: 0 0 60%;
      height: 100%;
      display: flex;
      flex-direction: column;
      min-height: 0;
      padding: variables.$space-2;
      padding-top: variables.$space-2;

      #preview {
        width: 100%;
        display: flex;
        flex-direction: column;
        border-radius: variables.$radius-md;
        border: 1px solid var(--mm-border);
        padding: variables.$space-1;
        box-sizing: border-box;
        flex: 1 1 auto;
        min-height: 0;
        @include mixins.elevation("xs");
      }
```

**Find the `&.shared-view` block and update its hard-coded values:**

```scss
    &.shared-view {
      #previewContainer {
        width: 100% !important;
        flex: 1 1 100% !important;
        padding: 0.5rem !important;
        border-radius: 0.5rem !important;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1) !important;

        #preview {
          width: 100% !important;
          border: #ced4da 1px solid;
          border-radius: 0.5rem;
```

**Replace with:**

```scss
    &.shared-view {
      #previewContainer {
        width: 100% !important;
        flex: 1 1 100% !important;
        padding: variables.$space-2 !important;
        border-radius: variables.$radius-md !important;
        box-shadow: var(--mm-shadow-sm) !important;

        #preview {
          width: 100% !important;
          border: 1px solid var(--mm-border);
          border-radius: variables.$radius-md;
```

### 2. Update `modals/_base.scss` — Modal Surfaces

Replace hard-coded modal colors with design tokens.

**Find:**
```scss
.modal-content {
  border-radius: 0.5rem;
  border: none;
  box-shadow: 0 0.5rem 1rem rgba(0, 0, 0, 0.15);
}
```

**Replace with:**
```scss
.modal-content {
  border-radius: variables.$radius-lg;
  border: 1px solid var(--mm-border);
  box-shadow: var(--mm-shadow-lg);
  background-color: var(--mm-bg-elevated);
}
```

**Find:**
```scss
.modal-header {
  border-bottom: 1px solid #dee2e6;
  border-top-left-radius: 0.5rem;
  border-top-right-radius: 0.5rem;

  [data-bs-theme="dark"] & {
    border-bottom-color: #444;
    background-color: #2a2a2a;
    color: #fff;
  }
}
```

**Replace with:**
```scss
.modal-header {
  border-bottom: 1px solid var(--mm-border);
  border-top-left-radius: variables.$radius-lg;
  border-top-right-radius: variables.$radius-lg;
  background-color: var(--mm-bg-surface);
}
```

**Find:**
```scss
.modal-body {
  [data-bs-theme="dark"] & {
    background-color: #1a1a1a;
    color: #fff;
  }
}
```

**Replace with:**
```scss
.modal-body {
  background-color: var(--mm-bg-elevated);
  color: var(--mm-text);
}
```

**Find:**
```scss
.modal-footer {
  height: auto !important;
  padding: 0.5rem 1rem !important;
  min-height: unset !important;

  border-top: 1px solid #dee2e6;
  border-bottom-left-radius: 0.5rem;
  border-bottom-right-radius: 0.5rem;

  [data-bs-theme="dark"] & {
    border-top-color: #444;
    background-color: #2a2a2a;
  }
}
```

**Replace with:**
```scss
.modal-footer {
  height: auto !important;
  padding: variables.$space-2 variables.$space-4 !important;
  min-height: unset !important;

  border-top: 1px solid var(--mm-border);
  border-bottom-left-radius: variables.$radius-lg;
  border-bottom-right-radius: variables.$radius-lg;
  background-color: var(--mm-bg-surface);
}
```

**Find the custom modal content block:**
```scss
body .custom-modal-content {
  position: relative !important;
  display: flex !important;
  flex-direction: column !important;
  background-color: #fff !important;
  border: 1px solid rgba(0, 0, 0, 0.175) !important;
  border-radius: 0.5rem !important;
  box-shadow: 0 0.5rem 1rem rgba(0, 0, 0, 0.15) !important;
  overflow: hidden !important;

  [data-bs-theme="dark"] & {
    background-color: #2a2a2a !important;
    border-color: #495057 !important;
    color: #fff !important;
  }
}
```

**Replace with:**
```scss
body .custom-modal-content {
  position: relative !important;
  display: flex !important;
  flex-direction: column !important;
  background-color: var(--mm-bg-elevated) !important;
  border: 1px solid var(--mm-border) !important;
  border-radius: variables.$radius-lg !important;
  box-shadow: var(--mm-shadow-lg) !important;
  overflow: hidden !important;
}
```

**Find:**
```scss
.custom-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem;
  border-bottom: 1px solid #dee2e6;

  [data-bs-theme="dark"] & {
    border-bottom-color: #495057;
  }
}
```

**Replace with:**
```scss
.custom-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: variables.$space-4;
  border-bottom: 1px solid var(--mm-border);
  background-color: var(--mm-bg-surface);
}
```

**Find:**
```scss
.custom-modal-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.5rem;
  padding: 1rem;
  border-top: 1px solid #dee2e6;

  [data-bs-theme="dark"] & {
    border-top-color: #495057;
  }
}
```

**Replace with:**
```scss
.custom-modal-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: variables.$space-2;
  padding: variables.$space-4;
  border-top: 1px solid var(--mm-border);
  background-color: var(--mm-bg-surface);
}
```

### 3. Update `code/_blocks.scss` — Code Block Surfaces

**Find:**
```scss
.code-block {
  position: relative;
  margin: 2rem 0;
  border: 1px solid variables.$color-border;
  border-radius: 4px;
  overflow: hidden;

  @include mixins.dark {
    border-color: variables.$color-border-dark;
  }
```

**Replace with:**
```scss
.code-block {
  position: relative;
  margin: variables.$space-6 0;
  border: 1px solid var(--mm-border);
  border-radius: variables.$radius-md;
  overflow: hidden;
  @include mixins.elevation("xs");
```

**Find:**
```scss
  &-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem 1rem;
    background-color: variables.$color-bg-light;
    border-bottom: 1px solid variables.$color-border;
    font-size: 0.875rem;
    font-weight: 500;
    margin: 0;

    [data-bs-theme="dark"] & {
      background-color: variables.$color-bg-dark;
      border-bottom-color: variables.$color-border-dark;
      color: variables.$color-text-dark;
    }
  }
```

**Replace with:**
```scss
  &-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: variables.$space-2 variables.$space-4;
    background-color: var(--mm-bg-surface);
    border-bottom: 1px solid var(--mm-border);
    font-size: variables.$font-size-base;
    font-weight: variables.$font-weight-medium;
    margin: 0;
  }
```

### 4. Update `_preview.scss` — Markdown Content Surfaces

**Find the blockquote block:**
```scss
      blockquote {
        color: #6c757d;
        border-left: 4px solid #dee2e6;
        background-color: #f8f9fa;
        padding: 1rem;
        margin: 1rem 0;
        border-radius: 4px;

        p {
          margin: 0;
        }

        @include mixins.dark {
          color: #cccccc;
          border-left: 4px solid #666;
          background-color: #2d2d2d;
        }
      }
```

**Replace with:**
```scss
      blockquote {
        color: var(--mm-text-secondary);
        border-left: 4px solid var(--mm-primary);
        background-color: var(--mm-bg-surface);
        padding: variables.$space-4;
        margin: variables.$space-4 0;
        border-radius: variables.$radius-md;

        p {
          margin: 0;
        }
      }
```

**Find the `pre` block in preview:**
```scss
      pre {
        background: #f8f9fa;
        color: #212529;
        border-radius: 0.25rem;
        padding: 1rem;
        overflow-x: auto;
        margin: 1rem 0;

        @include mixins.dark {
          background: #2d2d2d;
          color: #f8f8f2;
        }
      }
```

**Replace with:**
```scss
      pre {
        background: var(--mm-bg-surface);
        color: var(--mm-text);
        border-radius: variables.$radius-md;
        padding: variables.$space-4;
        overflow-x: auto;
        margin: variables.$space-4 0;
      }
```

**Find the `hr` block:**
```scss
      hr {
        border: none;
        border-top: 2px solid #212529;
        margin: 2rem 0;

        @include mixins.dark {
          border-top: 2px solid #666;
        }
      }
```

**Replace with:**
```scss
      hr {
        border: none;
        border-top: 1px solid var(--mm-border);
        margin: variables.$space-8 0;
      }
```

---

## File Change Manifest

| File | Change Type | Description |
|---|---|---|
| `services/ui/src/styles/_layout.scss` | **Targeted edits** | Replace hard-coded borders/shadows with design tokens in editor, preview, and shared view panels |
| `services/ui/src/styles/modals/_base.scss` | **Targeted edits** | Replace hard-coded modal colors with `--mm-*` tokens, remove dark-mode-specific selectors where tokens auto-switch |
| `services/ui/src/styles/code/_blocks.scss` | **Targeted edits** | Update code block border, radius, header background with tokens |
| `services/ui/src/styles/_preview.scss` | **Targeted edits** | Update blockquote, pre, hr, and table styles with tokens |

---

## Verification

After applying changes:

1. **Split panel** — both editor and preview containers should have subtle shadows instead of hard borders, with softer borders still visible
2. **Drag resize** — resizer still works correctly; panels resize proportionally
3. **Fullscreen preview** — preview fills full width, no leftover editor border visible
4. **Shared view** — shared document view renders with soft shadow card
5. **Modals** — open any modal (document info, settings, icon browser); verify rounded corners, consistent backgrounds, no hard-coded dark mode artifacts
6. **Code blocks** — preview a document with fenced code blocks; header should use surface background, block should have subtle shadow
7. **Blockquotes** — should now have primary-colored left border instead of generic gray
8. **Dark mode** — ALL of the above should work in dark mode. The `--mm-*` tokens automatically switch, so there should be fewer explicit dark selectors.
9. **Horizontal rules** — should be thinner (1px instead of 2px) and use the theme border color

---

## Notes for AI Agents

- Many of the dark mode `@include mixins.dark {}` / `[data-bs-theme="dark"] &` blocks can be REMOVED when replacing hard-coded colors with `--mm-*` CSS custom properties, because the custom properties already switch values in dark mode. Only remove the block if the ONLY thing it does is change the color to the dark variant — if it does additional dark-mode-specific adjustments (like different spacing), keep the block.
- The `modals/_base.scss` file also has styles for `.recent-files-dropdown` and other modal sub-components. Do NOT change those in this phase — focus only on the base modal structure selectors listed above.
- The `_layout.scss` file has more content (`.preview-scroll`, media queries, etc.) beyond what's listed. Do NOT change those sections in this phase.
- The `box-shadow` on `#previewContainer` is REMOVED (replaced by shadow on `#preview` child). This is intentional — the shadow should be on the content boundary, not the outer container.
- When updating `_preview.scss`, only change the specific selectors listed above. The rest of the preview styles (links, lists, headings, tables, images) will be refined in Phase 5.
