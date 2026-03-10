# UI Refresh — Project Plan

## Overview

The Markdown Manager UI relies heavily on default Bootstrap 5.3 styling with minimal customization. The result is a generic, "Bootstrap starter" appearance — functional but visually flat and lacking personality. This project modernizes the visual design across 5 phases without changing the tech stack (React, Bootstrap+SCSS, Monaco Editor).

**Branch:** `ui-refresh`
**Base:** `main`
**Status:** ✅ All 5 phases implemented (March 2026)

---

## Current State Summary

| Aspect | Current | Problem |
|---|---|---|
| **Color palette** | Default Bootstrap `#007bff` primary, generic grays | No brand identity, indistinguishable from any Bootstrap app |
| **Header** | Centered `<h1 class="h4">` with `bi-markdown` icon | 2015-era SPA aesthetic, no visual hierarchy |
| **Toolbar** | Flat transparent buttons, all same visual weight | No grouping, no emphasis on primary vs. secondary actions |
| **Borders** | `1px solid #ced4da` everywhere | Heavy, boxed-in feeling; too much visual weight on containers |
| **Dark theme** | Functional but basic — hard-coded hex colors | Not refined; poor contrast hierarchy, sharp borders |
| **Spacing** | Ad-hoc `0.25rem`/`0.5rem`/`1rem`, many `!important` overrides | Inconsistent, cramped dropdowns, no design scale |
| **Transitions** | Minimal (some hover, toast slide-in) | Feels static; theme switch is instant, no micro-interactions |
| **Modals** | Standard Bootstrap with minor tweaks | No distinctive styling, no entrance refinement |
| **Code blocks** | Bordered rectangles with lang header | Utilitarian, no visual flair |

---

## Architecture Constraints

These rules apply to ALL phases (from `.github/instructions/`):

- **SCSS only** — no inline styles, no CSS-in-JS
- **Bootstrap 5.3 + React Bootstrap** — these remain the foundation
- **Components ≤ 300 lines** — refactor if exceeded
- **Docker only** — `docker compose up frontend` for development, never `npm` directly
- **PropTypes required** on all components
- **Functional components with hooks** — no class components
- **`@/` alias** for imports — `import { X } from '@/hooks'`
- **Bootstrap Icons** for iconography
- **Direct imports only** — no dynamic imports
- **Styles live in `services/ui/src/styles/`** — organized by component domain

---

## File Structure Reference

```
services/ui/src/
├── styles/
│   ├── _variables.scss          # Design tokens (colors, spacing, typography)
│   ├── _mixins.scss             # Dark/light theme mixins
│   ├── _base.scss               # Global resets, scrollbar, animations
│   ├── _layout.scss             # Main layout (#container, #main, panels)
│   ├── _preview.scss            # Markdown preview styling
│   ├── _responsive.scss         # Media queries
│   ├── main.scss                # Import orchestrator
│   ├── toolbar/
│   │   ├── _header.scss         # App header (#appHeader)
│   │   ├── _navigation.scss     # Toolbar (#toolbar)
│   │   ├── _buttons.scss        # Utility controls (#utilityControls)
│   │   ├── _dropdowns.scss      # Dropdown menus
│   │   └── _responsive.scss     # Toolbar responsive
│   ├── code/
│   │   ├── _blocks.scss         # Code block containers
│   │   ├── _actions.scss        # Copy button etc.
│   │   ├── _languages.scss      # Language badges
│   │   └── _syntax.scss         # Syntax highlighting
│   ├── modals/
│   │   ├── _base.scss           # Modal styling
│   │   └── ...
│   └── components/
│       └── _diagram-controls.scss
├── components/
│   ├── App.jsx                  # Root component
│   ├── Header.jsx               # App header (14 lines, very basic)
│   ├── layout/
│   │   ├── AppLayout.jsx        # Main layout structure
│   │   ├── InvisibleResizer.jsx # Split-panel drag resize
│   │   └── SharedViewLayout.jsx # Read-only shared view
│   ├── toolbar/
│   │   ├── Toolbar.jsx          # Main toolbar
│   │   ├── Document.jsx         # Document title/controls
│   │   ├── User.jsx             # User menu
│   │   └── groups/              # Toolbar button groups
│   ├── sections/
│   │   ├── EditorSection.jsx    # Editor wrapper
│   │   └── RendererSection.jsx  # Preview wrapper
│   └── shared/                  # Reusable components (AppCard, etc.)
```

---

## Phase Summary

| Phase | Focus | Files Touched | Risk | Status |
|---|---|---|---|---|
| **1** | Design Foundation (variables, tokens, spacing scale) | `_variables.scss`, `_mixins.scss`, `_base.scss` | Low — no visual changes yet, just token definitions | ✅ Done |
| **2** | Header & Toolbar Redesign | `Header.jsx`, `_header.scss`, `_navigation.scss`, `_buttons.scss`, `_dropdowns.scss` | Medium — visible changes, but isolated components | ✅ Done |
| **3** | Layout & Surfaces (borders, panels, cards, modals) | `_layout.scss`, `_preview.scss`, `modals/_base.scss`, shared components | Medium — touches core layout; test split-panel resize | ✅ Done |
| **4** | Micro-interactions & Transitions | `_base.scss`, various component SCSS | Low — additive CSS, no structural changes | ✅ Done |
| **5** | Dark Mode Polish | `_variables.scss`, all files using `@include mixins.dark` | Medium — many files, but changes are scoped inside dark selectors | ✅ Done |

---

## Validation Checklist (Every Phase)

After completing each phase, verify:

1. **Light theme** — all pages render correctly at `http://localhost/`
2. **Dark theme** — toggle theme, verify all affected elements
3. **Split-panel resize** — drag the invisible resizer, verify editor/preview proportions
4. **Fullscreen preview** — toggle fullscreen, verify editor hides completely
5. **Shared view** — navigate to a shared document URL
6. **Responsive** — resize browser below 768px, verify mobile layout
7. **Dropdowns** — File menu, category selector, user menu all open/close correctly
8. **Modals** — Open document info, icon browser, settings modals
9. **Code blocks** — Preview a document with fenced code blocks
10. **No regressions** — `docker compose logs frontend` shows no errors

---

## How to Use These Documents

Each phase has a dedicated detail document (`phase-1.md` through `phase-5.md`) in this directory. Each document contains:

1. **Objective** — what this phase accomplishes
2. **Prerequisites** — what must be done before starting
3. **Current State** — exact current content of files being modified (with line references)
4. **Target State** — exact changes to make, with before/after examples
5. **File Change Manifest** — every file touched, with the type of change
6. **Verification Steps** — how to confirm the phase is complete

An AI agent should be able to read the project plan (this file) and any single phase document, then implement that phase completely without additional context.

---

## Development Workflow

```bash
# Start frontend (from project root)
docker compose up frontend -d

# Watch logs for errors
docker compose logs frontend --follow

# If HMR memory overflow occurs
docker compose restart frontend

# View the app
open http://localhost/
```
