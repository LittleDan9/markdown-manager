# Phase 2: Header & Toolbar Redesign

> **Status: ✅ Implemented** — March 2026

## Objective

Transform the header and toolbar from generic Bootstrap chrome into a distinctive, polished application bar. The header gets a brand identity with visual hierarchy. The toolbar gets grouped controls, visual separators, and refined hover states. This is the highest-impact visual change in the project.

## Prerequisites

- **Phase 1 completed** — design tokens in `_variables.scss`, mixins in `_mixins.scss`, CSS custom properties in `_base.scss`
- Branch: `ui-refresh`
- Frontend running: `docker compose up frontend -d`

---

## Current State

### Header Component — `services/ui/src/components/Header.jsx`

```jsx
import React from "react";

function Header() {
  return (
    <header id="appHeader" className="bg-body-tertiary border-bottom">
      <div className="container-fluid px-3 py-2">
        <h1 className="h4 mb-0 text-center d-flex align-items-center justify-content-center gap-2">
          <i className="bi bi-markdown me-2 app-logo-light"></i>
          <i className="bi bi-markdown-fill me-2 app-logo-dark"></i>
          Markdown Manager
        </h1>
      </div>
    </header>
  );
}

export default Header;
```

### Header Styles — `services/ui/src/styles/toolbar/_header.scss`

```scss
@use "../variables";
@use "../mixins";

#appHeader {
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);

  h1 {
    margin: 0;
    font-weight: 600;
    color: var(--bs-body-color);

    i {
      color: #0d6efd;
    }
  }

  .app-brand {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    text-decoration: none;
    color: inherit;

    &:hover {
      text-decoration: none;
      color: inherit;
    }

    .brand-icon {
      font-size: 1.5rem;
      color: var(--bs-primary);
    }

    .brand-text {
      font-size: 1.25rem;
      font-weight: 600;
      margin: 0;
    }
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 0.75rem;

    .btn {
      display: flex;
      align-items: center;
      gap: 0.375rem;
    }
  }

  [data-bs-theme="dark"] & {
    border-bottom: 1px solid var(--bs-border-color);
    background-color: var(--bs-dark);

    h1 {
      color: var(--bs-light);
    }

    .brand-text {
      color: var(--bs-light);
    }
  }
}
```

### Toolbar Navigation — `services/ui/src/styles/toolbar/_navigation.scss`

```scss
@use "../variables";
@use "../mixins";

#toolbar {
  border-bottom: 1px solid var(--bs-border-color);
  min-height: 56px;

  .toolbar-section {
    display: flex;
    align-items: center;
    gap: 0.75rem;

    &.toolbar-start { flex: 0 0 auto; }
    &.toolbar-center { flex: 1 1 auto; justify-content: center; }
    &.toolbar-end { flex: 0 0 auto; justify-content: flex-end; }
  }
}

#fileMenuDropdown,
#categoryDropdown {
  border: none !important;
  background: transparent !important;
  color: var(--bs-body-color);

  &:hover {
    background-color: var(--bs-secondary-bg) !important;
    color: var(--bs-body-color);
  }

  &:focus {
    box-shadow: 0 0 0 0.2rem rgba(13, 110, 253, 0.25);
  }
}

.vr {
  width: 1px;
  height: 1.5rem;
  background-color: var(--bs-border-color);
}

#documentTitle {
  cursor: pointer;
  padding: 0.375rem 0.75rem;
  border-radius: 0.375rem;
  transition: all 0.2s ease;
  font-weight: 500;
  font-size: 0.95rem;
  max-width: 300px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;

  &:hover {
    background-color: var(--bs-secondary-bg);
    color: var(--bs-body-color);
  }

  &.editing {
    background-color: var(--bs-body-bg);
    border: 2px solid #0d6efd;
    outline: none;
    color: var(--bs-body-color);
  }

  &.has-changes {
    position: relative;

    &::after {
      content: "●";
      color: var(--bs-warning);
      margin-left: 0.25rem;
      font-size: 0.8rem;
    }
  }
}
```

### Toolbar Buttons — `services/ui/src/styles/toolbar/_buttons.scss`

Key sections of the current file (see full file at `services/ui/src/styles/toolbar/_buttons.scss`):

- `#utilityControls .btn` — min-width 40px, height 38px, transparent bg, no border
- `#userDropdown .dropdown-toggle` — borderless, removes caret
- `#themeToggleBtn` — hover rotates icon 180deg
- `.action-buttons .separator` — 1px × 20px divider

### Toolbar Dropdowns — `services/ui/src/styles/toolbar/_dropdowns.scss`

Key sections (see full file at `services/ui/src/styles/toolbar/_dropdowns.scss`):

- `.dropdown-menu` — min-width 16rem, hard-coded white bg, `rgba(0,0,0,0.175)` border
- `.dropdown-item` — 0.375rem 1rem padding, 0.875rem font-size
- `.dropdown-submenu` — nested dropdown positioning

### Toolbar Component — `services/ui/src/components/toolbar/Toolbar.jsx`

The toolbar uses `<nav id="toolbar" className="navbar navbar-expand-lg bg-body-tertiary px-3">` as its wrapper. It has three sections: left (file menu + document title), center (document toolbar actions), right (user controls).

---

## Changes

### 1. Redesign `Header.jsx`

Replace the simple centered title with a branded header bar.

**Target content for `services/ui/src/components/Header.jsx`:**

```jsx
import React from "react";

function Header() {
  return (
    <header id="appHeader">
      <div className="header-inner">
        <div className="app-brand">
          <span className="brand-icon-wrapper">
            <i className="bi bi-markdown-fill"></i>
          </span>
          <span className="brand-text">
            Markdown<span className="brand-text-accent">Manager</span>
          </span>
        </div>
      </div>
    </header>
  );
}

export default Header;
```

### 2. Restyle `_header.scss`

Replace the entire file. The new header has:
- Left-aligned brand with icon in a colored pill
- Two-tone wordmark ("Markdown" regular, "Manager" accented)
- Subtle bottom border accent line using the primary color
- Compact height (~44px)

**Target content for `services/ui/src/styles/toolbar/_header.scss`:**

```scss
@use "../variables";
@use "../mixins";

// ─── APP HEADER ───
#appHeader {
  background-color: var(--mm-bg);
  border-bottom: 1px solid var(--mm-border);
  position: relative;
  z-index: 10;
  @include mixins.elevation("xs");

  // Accent line at the bottom
  &::after {
    content: "";
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 2px;
    background: linear-gradient(
      90deg,
      var(--mm-primary) 0%,
      var(--mm-accent) 100%
    );
    opacity: 0.8;
  }

  .header-inner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: variables.$space-2 variables.$space-4;
    max-height: 44px;
  }

  .app-brand {
    display: flex;
    align-items: center;
    gap: variables.$space-2;
    text-decoration: none;
    color: inherit;
    user-select: none;
  }

  .brand-icon-wrapper {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: variables.$radius-md;
    background: var(--mm-primary);
    color: #ffffff;
    font-size: variables.$font-size-base;
    flex-shrink: 0;
  }

  .brand-text {
    font-size: variables.$font-size-lg;
    font-weight: variables.$font-weight-semibold;
    color: var(--mm-text);
    letter-spacing: -0.01em;
    line-height: 1;
  }

  .brand-text-accent {
    color: var(--mm-primary);
    font-weight: variables.$font-weight-bold;
  }

  // Dark theme
  @include mixins.dark {
    background-color: var(--mm-bg-surface);
    border-bottom-color: var(--mm-border);
  }
}
```

### 3. Update `_navigation.scss`

Update the toolbar styling to use design tokens and improve visual grouping.

**Target content for `services/ui/src/styles/toolbar/_navigation.scss`:**

```scss
@use "../variables";
@use "../mixins";

// ─── NAVIGATION TOOLBAR ───
#toolbar {
  border-bottom: 1px solid var(--mm-border);
  min-height: 48px;
  background-color: var(--mm-bg);
  @include mixins.elevation("xs");
  position: relative;
  z-index: 9;

  .toolbar-section {
    display: flex;
    align-items: center;
    gap: variables.$space-3;

    &.toolbar-start { flex: 0 0 auto; }
    &.toolbar-center { flex: 1 1 auto; justify-content: center; }
    &.toolbar-end { flex: 0 0 auto; justify-content: flex-end; }
  }

  @include mixins.dark {
    background-color: var(--mm-bg-surface);
    border-bottom-color: var(--mm-border);
  }
}

// File menu and category dropdown
#fileMenuDropdown,
#categoryDropdown {
  border: none !important;
  background: transparent !important;
  color: var(--mm-text);
  border-radius: variables.$radius-md;
  @include mixins.interactive-transition(background-color, color);

  &:hover {
    background-color: var(--mm-bg-surface) !important;
    color: var(--mm-text);
  }

  &:focus-visible {
    box-shadow: 0 0 0 2px var(--mm-primary);
    outline: none;
  }
}

// Vertical separator — refined
.vr {
  width: 1px;
  height: 1.25rem;
  background-color: var(--mm-border);
  opacity: 0.6;
  margin: 0 variables.$space-1;
}

// Document title
#documentTitle {
  cursor: pointer;
  padding: variables.$space-1 variables.$space-3;
  border-radius: variables.$radius-md;
  @include mixins.interactive-transition(background-color, color, box-shadow);
  font-weight: variables.$font-weight-medium;
  font-size: variables.$font-size-base;
  max-width: 300px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--mm-text);

  &:hover {
    background-color: var(--mm-bg-surface);
  }

  &.editing {
    background-color: var(--mm-bg);
    border: 2px solid var(--mm-primary);
    outline: none;
    color: var(--mm-text);
    box-shadow: 0 0 0 3px var(--mm-primary-subtle);
  }

  &.has-changes {
    position: relative;

    &::after {
      content: "●";
      color: variables.$color-warning;
      margin-left: variables.$space-1;
      font-size: variables.$font-size-xs;
    }
  }
}
```

### 4. Update `_buttons.scss`

Refine utility button styling to use design tokens. Key changes:
- Use `--mm-*` custom properties instead of `--bs-*` for themed values
- Use spacing scale variables
- Improve focus styles from blue ring to primary-colored ring
- Add smooth transitions

**Changes in `services/ui/src/styles/toolbar/_buttons.scss`:**

Replace the `#utilityControls .btn` block styling:

**Find:**
```scss
#utilityControls {
  .btn {
    min-width: 40px;
    height: 38px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none !important;
    background: transparent !important;
    color: var(--bs-body-color);

    &:hover {
      background-color: var(--bs-secondary-bg) !important;
      color: var(--bs-body-color);
    }

    &:focus {
      box-shadow: 0 0 0 0.2rem rgba(13, 110, 253, 0.25);
    }
```

**Replace with:**
```scss
#utilityControls {
  .btn {
    min-width: 36px;
    height: 34px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none !important;
    background: transparent !important;
    color: var(--mm-text);
    border-radius: variables.$radius-md;
    @include mixins.interactive-transition(background-color, color, box-shadow);

    &:hover {
      background-color: var(--mm-bg-surface) !important;
      color: var(--mm-text);
    }

    &:focus-visible {
      box-shadow: 0 0 0 2px var(--mm-primary);
      outline: none;
    }
```

### 5. Update `_dropdowns.scss`

Modernize dropdown menus to use design tokens. Key changes:
- Replace hard-coded colors with `--mm-*` custom properties
- Use shadow scale for elevation
- Use radius scale for corners
- Improve item padding for better touch targets

**Find the `.dropdown-menu` base block (first selector):**

```scss
.dropdown-menu {
  &.show {
    display: block;
  }
  &:not(.show) {
    display: none;
  }
  position: absolute;
  top: 100%;
  left: 0;
  z-index: 1000;
  min-width: 16rem;
  padding: 0.5rem 0;
  margin: 0.125rem 0 0;
  font-size: 0.875rem;
  color: #212529;
  text-align: left;
  background-color: #fff;
  border: 1px solid rgba(0, 0, 0, 0.175);
  border-radius: 0.375rem;
  box-shadow: 0 0.5rem 1rem rgba(0, 0, 0, 0.175);

  [data-bs-theme="dark"] & {
    color: #dee2e6;
    background-color: #212529;
    border-color: #495057;
  }
```

**Replace with:**

```scss
.dropdown-menu {
  &.show {
    display: block;
  }
  &:not(.show) {
    display: none;
  }
  position: absolute;
  top: 100%;
  left: 0;
  z-index: 1000;
  min-width: 16rem;
  padding: variables.$space-1 0;
  margin: variables.$space-1 0 0;
  font-size: variables.$font-size-base;
  color: var(--mm-text);
  text-align: left;
  background-color: var(--mm-bg-elevated);
  border: 1px solid var(--mm-border);
  border-radius: variables.$radius-md;
  @include mixins.elevation("md");

  [data-bs-theme="dark"] & {
    color: var(--mm-text);
    background-color: var(--mm-bg-elevated);
    border-color: var(--mm-border);
  }
```

**Find the `.dropdown-item` block inside `.dropdown-menu`:**

```scss
  .dropdown-item {
    display: flex;
    align-items: center;
    width: 100%;
    padding: 0.375rem 1rem;
    clear: both;
    font-weight: 400;
    color: inherit;
    text-decoration: none;
    background-color: transparent;
    border: 0;
    transition: background-color 0.15s ease-in-out;

    &:hover,
    &:focus {
      color: inherit;
      background-color: var(--bs-secondary-bg);
    }

    &.active,
    &:active {
      color: var(--bs-primary-text-emphasis);
      background-color: var(--bs-primary-bg-subtle);
    }
```

**Replace with:**

```scss
  .dropdown-item {
    display: flex;
    align-items: center;
    width: 100%;
    padding: variables.$space-2 variables.$space-4;
    clear: both;
    font-weight: variables.$font-weight-normal;
    color: inherit;
    text-decoration: none;
    background-color: transparent;
    border: 0;
    border-radius: variables.$radius-sm;
    margin: 0 variables.$space-1;
    width: calc(100% - #{variables.$space-2});
    @include mixins.interactive-transition(background-color, color);

    &:hover,
    &:focus {
      color: inherit;
      background-color: var(--mm-bg-surface);
    }

    &.active,
    &:active {
      color: var(--mm-primary);
      background-color: var(--mm-primary-subtle);
    }
```

---

## File Change Manifest

| File | Change Type | Description |
|---|---|---|
| `services/ui/src/components/Header.jsx` | **Replace** entire file | New branded header with icon pill and two-tone wordmark |
| `services/ui/src/styles/toolbar/_header.scss` | **Replace** entire file | Redesigned header with accent line, elevation, brand styling |
| `services/ui/src/styles/toolbar/_navigation.scss` | **Replace** entire file | Updated toolbar with design tokens, refined separators |
| `services/ui/src/styles/toolbar/_buttons.scss` | **Targeted edits** | Update `#utilityControls .btn` to use design tokens |
| `services/ui/src/styles/toolbar/_dropdowns.scss` | **Targeted edits** | Update `.dropdown-menu` and `.dropdown-item` to use design tokens |

---

## Verification

After applying changes:

1. **Header** — should show left-aligned brand with colored icon pill, "Markdown" in body color + "Manager" in primary color, subtle gradient accent line at bottom
2. **Toolbar** — should be slightly more compact (48px vs 56px), with smoother hover states on buttons
3. **Dropdowns** — File menu, category selector, user menu should open with refined shadows and rounded item hover states
4. **Dark mode** — toggle theme; header should use surface background, accent line should still be visible, all text readable
5. **Document title** — click to edit; editing state should show primary-colored border with subtle glow
6. **Keyboard navigation** — Tab through toolbar buttons; `focus-visible` ring should appear in primary color
7. **No regressions** — split-panel resize, fullscreen preview, shared view all still work

---

## Notes for AI Agents

- The `Header.jsx` change removes the `app-logo-light` / `app-logo-dark` class toggling. If those classes are referenced elsewhere, search for them and remove dead references.
- The `bg-body-tertiary` class is removed from the header; the new SCSS handles background colors directly via `--mm-bg`.
- The toolbar `navbar navbar-expand-lg bg-body-tertiary` classes on `<nav id="toolbar">` in `Toolbar.jsx` should be updated to `navbar bg-body px-3` (remove `navbar-expand-lg` and `bg-body-tertiary`). The SCSS now handles the background via the `#toolbar` selector.
- The `@include mixins.interactive-transition(background-color, color)` syntax passes a comma-separated list. Ensure the mixin handles this correctly — it uses `#{$properties}` interpolation.
- Dropdown items get `margin` and `border-radius` for the inset hover effect — this is a common modern pattern (like VS Code or Slack menus).
