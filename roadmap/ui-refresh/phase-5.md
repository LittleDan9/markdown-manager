# Phase 5: Dark Mode Polish

> **Status: ✅ Implemented** — March 2026

## Objective

Elevate dark mode from "functional inversion" to a refined, first-class experience. Replace scattered hard-coded dark colors (`#2d2d2d`, `#232323`, `#666`, `#495057`) with the design token palette established in Phase 1. Improve contrast ratios, refine the gray ramp, and ensure every surface has intentional depth hierarchy. After this phase, dark mode should feel purposefully designed, not auto-generated.

## Prerequisites

- **Phases 1–4 completed** — design tokens, header/toolbar, surfaces, and transitions all in place
- Branch: `ui-refresh`
- Frontend running: `docker compose up frontend -d`

---

## Current State

### Problem Summary

The dark mode has two systematic issues:

1. **Scattered hard-coded hex values** — Dark colors are defined ad-hoc throughout the codebase: `#2d2d2d`, `#232323`, `#2a2a2a`, `#1a1a1a`, `#495057`, `#666`, `#444`, etc. These don't form a coherent palette.

2. **Redundant dark selectors** — After Phases 2–4 replaced many hard-coded values with `--mm-*` CSS custom properties (which auto-switch in dark mode), some files still have unnecessary `@include mixins.dark {}` or `[data-bs-theme="dark"] &` blocks that are now dead code.

### Files With Remaining Hard-Coded Dark Values

After Phases 1–4, the remaining files with hard-coded dark mode concerns:

**`_preview.scss`** — The largest source of hard-coded dark colors:
```scss
// Inline code
p > code:not([class*="language-"]) {
  @include mixins.dark {
    color: #f7e06e !important;
    background: #232323 !important;
  }
}

// Lists
ul, ol {
  @include mixins.dark {
    color: #fff;
  }
}

// Headings
h1, h2, h3, h4, h5, h6 {
  @include mixins.dark {
    color: #fff;
  }
}

// Strong/bold
strong, b {
  @include mixins.dark { color: #fff; }
}

// Italic
em, i {
  @include mixins.dark { color: #cccccc; }
}

// Links
a {
  color: #0d6efd;
  @include mixins.dark {
    color: #66b3ff;
    &:hover { color: #99ccff; }
  }
}

// Images
img {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

// Tables
table {
  background: #fff;
  th, td {
    border: 2px solid #212529;
  }
  // (likely has dark mode block too)
}
```

**`_base.scss`** — Scrollbar dark overrides use `var(--bs-dark)` and `var(--bs-secondary)`:
```scss
[data-bs-theme="dark"] {
  ::-webkit-scrollbar-track {
    background: var(--bs-dark);
  }
  ::-webkit-scrollbar-thumb {
    background: var(--bs-secondary);
    border: 1px solid var(--bs-dark);
  }
}
```

**`toolbar/_dropdowns.scss`** — Hard-coded dark dropdown base styles may still exist if Phase 2 didn't catch the `.dropdown-divider` and `.dropdown-header` dark blocks.

**`code/_blocks.scss`** — After Phase 3 updates, verify no remaining hard-coded dark values in the language badge or inline code blocks.

---

## Changes

### 1. Clean up `_preview.scss` — Markdown Content Dark Mode

This is the biggest file to address. Replace all hard-coded dark overrides with token-based values. The principle: use `var(--mm-*)` properties that auto-switch, and only keep `@include mixins.dark` blocks when there's a genuinely DIFFERENT treatment in dark mode (not just a color swap).

**Find the inline code block:**
```scss
      p > code:not([class*="language-"]) {
        color: #e83e8c;
        background: #f8f9fa;
        border-radius: 4px;
        padding: 2px 4px;
        font-size: 0.95em;

        @include mixins.dark {
          color: #f7e06e !important;
          background: #232323 !important;
        }
      }
```

**Replace with:**
```scss
      p > code:not([class*="language-"]) {
        color: variables.$color-code-inline-text;
        background: var(--mm-bg-surface);
        border-radius: variables.$radius-sm;
        padding: 2px 6px;
        font-size: 0.95em;

        @include mixins.dark {
          color: variables.$color-code-inline-text-dark;
        }
      }
```

**Find the list dark override:**
```scss
      ul,
      ol {
        margin: 0.75rem 0 0.75rem 1rem;
        padding-left: 1rem;

        & > li {
          margin: 0.25rem 0;
        }
        & > li > p {
          margin: 0;
          padding: 0;
        }

        @include mixins.dark {
          color: #fff;
          & > li { margin: 0.25rem 0; }
          & > li > p { margin: 0; padding: 0; }
        }
      }
```

**Replace with (remove the dark block — `color: #fff` is redundant when body text inherits):**
```scss
      ul,
      ol {
        margin: variables.$space-3 0 variables.$space-3 variables.$space-4;
        padding-left: variables.$space-4;

        & > li {
          margin: variables.$space-1 0;
        }
        & > li > p {
          margin: 0;
          padding: 0;
        }
      }
```

**Find the heading dark override:**
```scss
      h1,
      h2,
      h3,
      h4,
      h5,
      h6 {
        font-weight: bold;
        margin-top: 1rem;
        margin-bottom: 1rem;
        line-height: 1.2;

        @include mixins.dark {
          color: #fff;
        }
      }
```

**Replace with (remove dark block — headings inherit body color which auto-switches):**
```scss
      h1,
      h2,
      h3,
      h4,
      h5,
      h6 {
        font-weight: variables.$font-weight-bold;
        margin-top: variables.$space-4;
        margin-bottom: variables.$space-4;
        line-height: 1.2;
        color: var(--mm-text);
      }
```

**Find the link styles:**
```scss
      a {
        color: #0d6efd;
        text-decoration: underline;
        transition: color 0.2s;

        &:hover {
          color: #0056b3;
        }

        @include mixins.dark {
          color: #66b3ff;
          &:hover { color: #99ccff; }
        }
      }
```

**Replace with:**
```scss
      a {
        color: var(--mm-primary);
        text-decoration: underline;
        text-decoration-color: transparent;
        text-underline-offset: 2px;
        transition: color variables.$transition-fast, text-decoration-color variables.$transition-fast;

        &:hover {
          color: var(--mm-primary-hover);
          text-decoration-color: var(--mm-primary-hover);
        }
      }
```

**Find the strong/bold dark override:**
```scss
      strong,
      b {
        font-weight: bold;

        @include mixins.dark { color: #fff; }
      }
```

**Replace with:**
```scss
      strong,
      b {
        font-weight: variables.$font-weight-bold;
        color: var(--mm-text);
      }
```

**Find the italic dark override:**
```scss
      em,
      i {
        font-style: italic;

        @include mixins.dark { color: #cccccc; }
      }
```

**Replace with:**
```scss
      em,
      i {
        font-style: italic;
        color: var(--mm-text-secondary);
      }
```

**Find the image styles:**
```scss
      img {
        max-width: 100%;
        height: auto;
        border-radius: 0.25rem;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
        margin: 1rem 0;
      }
```

**Replace with:**
```scss
      img {
        max-width: 100%;
        height: auto;
        border-radius: variables.$radius-md;
        box-shadow: var(--mm-shadow-sm);
        margin: variables.$space-4 0;
      }
```

**Find the table styles:**
```scss
      table {
        display: inline-table !important;
        width: auto !important;
        max-width: none !important;
        border-collapse: collapse;
        margin-bottom: 1rem;
        background: #fff;

        th,
        td {
          border: 2px solid #212529;
          padding: 0.75rem;
          text-align: left;
        }
```

**Replace with:**
```scss
      table {
        display: inline-table !important;
        width: auto !important;
        max-width: none !important;
        border-collapse: collapse;
        margin-bottom: variables.$space-4;
        background: var(--mm-bg-elevated);
        border-radius: variables.$radius-md;
        overflow: hidden;

        th,
        td {
          border: 1px solid var(--mm-border);
          padding: variables.$space-3;
          text-align: left;
        }
```

Also search for the table's dark mode block (likely further down in the file) and either update it to use tokens or remove it if the `var(--mm-*)` properties handle it.

### 2. Clean up `_base.scss` — Scrollbar Dark Overrides

The scrollbar dark mode block can be simplified since `var(--mm-*)` tokens handle color switching.

**Find:**
```scss
// Dark theme scrollbar overrides
[data-bs-theme="dark"] {
  ::-webkit-scrollbar-track {
    background: var(--bs-dark);
  }

  ::-webkit-scrollbar-thumb {
    background: var(--bs-secondary);
    border: 1px solid var(--bs-dark);

    &:hover {
      background: var(--bs-secondary-text-emphasis);
    }

    &:active {
      background: var(--bs-light);
    }
  }

  ::-webkit-scrollbar-corner {
    background: var(--bs-dark);
  }

  * {
    scrollbar-color: var(--bs-secondary) var(--bs-dark);
  }
}
```

**Replace with:**
```scss
// Dark theme scrollbar overrides
[data-bs-theme="dark"] {
  ::-webkit-scrollbar-track {
    background: var(--mm-bg);
  }

  ::-webkit-scrollbar-thumb {
    background: var(--mm-border);
    border: 1px solid var(--mm-bg);

    &:hover {
      background: variables.$color-gray-500;
    }

    &:active {
      background: variables.$color-gray-400;
    }
  }

  ::-webkit-scrollbar-corner {
    background: var(--mm-bg);
  }

  * {
    scrollbar-color: var(--mm-border) var(--mm-bg);
  }
}
```

### 3. Audit remaining dark mode blocks

After the above changes, do a codebase-wide search for remaining hard-coded dark values. Run:

```bash
grep -rn '#2d2d2d\|#232323\|#2a2a2a\|#1a1a1a\|#495057\|#666[^0-9a-fA-F]' services/ui/src/styles/
```

For each remaining occurrence:
- If it's inside a `[data-bs-theme="dark"]` or `@include mixins.dark` block, replace with the appropriate `--mm-*` token
- If the `--mm-*` token makes the explicit dark block unnecessary, remove the entire block
- If the dark block has non-color changes (spacing, layout), keep the block but update the colors

### 4. Preview highlight line — `_preview.scss`

**Find:**
```scss
.preview-line-highlight {
  background: none;
  transition: background 0.3s, color 0.3s;
  color: #f7e06e !important;
  font-weight: bold;

  @include mixins.dark {
    background: #232323 !important;
    color: #f7e06e !important;
  }
}
```

**Replace with:**
```scss
.preview-line-highlight {
  background: var(--mm-primary-subtle);
  transition: background variables.$transition-slow, color variables.$transition-slow;
  color: var(--mm-primary);
  font-weight: variables.$font-weight-bold;
}
```

---

## File Change Manifest

| File | Change Type | Description |
|---|---|---|
| `services/ui/src/styles/_preview.scss` | **Major targeted edits** | Replace all hard-coded dark overrides with design tokens; remove redundant dark blocks |
| `services/ui/src/styles/_base.scss` | **Targeted edit** | Update scrollbar dark overrides to use `--mm-*` tokens |
| `services/ui/src/styles/code/_blocks.scss` | **Audit** | Verify no remaining hard-coded dark values after Phase 3 |
| `services/ui/src/styles/toolbar/_dropdowns.scss` | **Audit** | Verify no remaining hard-coded dark values after Phase 2 |
| Any file found by `grep` audit | **Targeted edit** | Replace remaining hard-coded hex values |

---

## Verification

After applying changes:

### Light Mode
1. All markdown content renders correctly — headings, lists, code, links, tables, blockquotes, images
2. Preview line highlight works (click in editor, corresponding line highlights in preview)
3. Scrollbars match the light theme
4. No visual regressions from removing dark-mode-specific blocks

### Dark Mode (toggle theme and check each)
5. **Background hierarchy** — body (deepest), surface (panels, cards), elevated (modals, dropdowns) should form 3 distinct depth levels
6. **Text hierarchy** — primary text (`--mm-text`) for headings and body, secondary text (`--mm-text-secondary`) for muted/meta text
7. **Borders** — subtle, consistent color; not too bright (no `#495057` popping out)
8. **Code blocks** — inline code has readable contrast; fenced code blocks have distinct header
9. **Links** — primary-colored, clear hover state, underline on hover
10. **Tables** — readable borders, alternating rows if present, no white background
11. **Blockquotes** — primary-colored left border, surface background
12. **Images** — subtle shadow that's visible but not harsh
13. **Scrollbars** — dark background track, visible but non-distracting thumb
14. **Preview line highlight** — visible highlight without jarring yellow
15. **Theme transition** — switching themes animates smoothly (from Phase 4)

### Comprehensive
16. Run the grep audit command — **zero results** for the hard-coded hex pattern
17. No `!important` overrides remain in dark mode blocks (unless required to override Bootstrap)

---

## Notes for AI Agents

- This phase's primary goal is REMOVING code (dark-mode-specific blocks) and REPLACING hard-coded values with tokens. The net line count should go DOWN.
- When removing a `@include mixins.dark { color: #fff; }` block, verify that the element inherits `color` from a parent that uses `var(--mm-text)`. If the element has `color: inherit` or no explicit color, removing the dark block is safe because the body text color auto-switches.
- The preview line highlight color change from `#f7e06e` (yellow) to `var(--mm-primary)` (indigo-blue) is intentional — it aligns the highlight with the brand palette. If the user prefers yellow, they can override `--mm-primary-subtle` and `--mm-primary` with a dedicated highlight token.
- Tables may have additional styling beyond what's shown (striped rows, header backgrounds). Search the full `_preview.scss` file for all `table`, `th`, `td`, `thead`, `tbody` selectors and update them all.
- The `em, i` elements get `color: var(--mm-text-secondary)` — this makes italic text slightly muted, which is a common modern convention. If this doesn't look good in practice, it can be changed to `var(--mm-text)` (same as body).
- After this phase, the only place hard-coded dark colors should remain is in `_variables.scss` where the tokens are defined.
