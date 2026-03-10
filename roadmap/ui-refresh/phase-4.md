# Phase 4: Micro-interactions & Transitions

> **Status: ✅ Implemented** — March 2026

## Objective

Add smooth transitions and micro-interactions throughout the UI to make it feel alive and responsive. This phase is purely additive — it adds CSS transitions and animations without changing layout or structure. Interactions become more polished: theme switching transitions smoothly, buttons have consistent hover feedback, dropdowns animate open/close, and the resizer gets a visual cue.

## Prerequisites

- **Phases 1–3 completed** — design tokens, header/toolbar redesign, surface refinements all in place
- Branch: `ui-refresh`
- Frontend running: `docker compose up frontend -d`

---

## Current State

### Existing Transitions
- `_base.scss`: Toast slide-in/out animations, alert auto-dismiss, scrollbar hover, `spin` keyframe
- `_navigation.scss`: `#documentTitle` has `transition: all 0.2s ease`
- `_buttons.scss`: `#themeToggleBtn` hover rotates icon 180deg (0.2s ease)
- `_buttons.scss`: Loading spinner has `btn-spin` keyframe
- `_dropdowns.scss`: `.dropdown-item` has `transition: background-color 0.15s ease-in-out`
- `modals/_base.scss`: Custom modal has `opacity/visibility 0.3s ease`, dialog has `transform scale 0.3s ease`

### Missing
- No transition on theme switch (background/text colors snap instantly)
- No transition on resizer hover (invisible with no visual indicator)
- No transition on panel width changes
- Dropdown menus appear/disappear instantly (no slide or fade)
- No subtle hover scale or lift on interactive cards
- No transition on toolbar button active/pressed states
- Code block copy button appears instantly (no fade)

---

## Changes

### 1. Theme Switch Transition — `_base.scss`

Add a global transition for theme switching. This makes background and text colors animate smoothly when toggling light/dark mode.

**Insert after the existing `:root` / `[data-bs-theme="dark"]` CSS custom property blocks (added in Phase 1), before the `*, *::before, *::after` block:**

```scss
// ─── THEME TRANSITION ───
// Smooth color transitions when switching themes
// Applied to all elements, scoped to color-related properties only
html[data-bs-theme] {
  &,
  *,
  *::before,
  *::after {
    transition:
      background-color var(--mm-transition-base),
      border-color var(--mm-transition-base),
      color var(--mm-transition-fast),
      box-shadow var(--mm-transition-fast);
  }
}

// Opt-out class for elements that shouldn't transition (e.g., Monaco editor, Mermaid diagrams)
.no-theme-transition,
.no-theme-transition *,
#editor *,
.mermaid *,
.mermaid-diagram * {
  transition: none !important;
}
```

### 2. Dropdown Animation — `_dropdowns.scss`

Add a subtle slide-down + fade animation when dropdown menus open.

**Find the `.dropdown-menu` block (after the `&:not(.show)` rule):**

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
```

**Insert a new animation block right after `&:not(.show) { display: none; }` and before `position: absolute;`:**

```scss
  // Entrance animation
  &.show {
    display: block;
    animation: dropdown-enter variables.$transition-slow forwards;
  }

  @keyframes dropdown-enter {
    from {
      opacity: 0;
      transform: translateY(-4px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
```

**Note:** This replaces the existing `&.show { display: block; }` rule — merge them into one.

### 3. Button Press Feedback — `_buttons.scss`

Add a subtle scale-down effect when toolbar buttons are pressed.

**Find the `#utilityControls .btn` hover block (after the Phase 2 updates) and add an `&:active` rule after the `&:hover` rule:**

Insert after the `&:hover` block in `#utilityControls .btn`:

```scss
    &:active {
      transform: scale(0.95);
    }
```

### 4. Resizer Visual Cue — `_layout.scss`

The `InvisibleResizer` component creates a drag zone but has no visual indicator. Add a subtle line that appears on hover.

**Add at the end of `_layout.scss` (before any existing `@media` queries at the bottom):**

```scss
// ─── RESIZER VISUAL CUE ───
// The InvisibleResizer creates an invisible drag area. This adds a hover indicator.
.invisible-resizer,
[class*="resizer"] {
  position: relative;

  &::after {
    content: "";
    position: absolute;
    top: 20%;
    bottom: 20%;
    left: 50%;
    transform: translateX(-50%);
    width: 3px;
    border-radius: variables.$radius-full;
    background-color: var(--mm-border);
    opacity: 0;
    transition: opacity variables.$transition-base, background-color variables.$transition-base;
  }

  &:hover::after {
    opacity: 0.6;
    background-color: var(--mm-primary);
  }

  &:active::after {
    opacity: 1;
    background-color: var(--mm-primary);
  }
}
```

**Also check** `InvisibleResizer.jsx` to see what class/id it applies. If it uses a specific selector, update the CSS rule accordingly. The component renders a `<div>` — verify its className and adjust the selector above.

### 5. Card Hover Enhancement — `components/_diagram-controls.scss` or new shared styles

For any AppCard-like components that are interactive (clickable), add a subtle lift on hover.

**Add to `services/ui/src/styles/components/index.scss` (or a suitable component style file):**

```scss
// ─── INTERACTIVE CARD HOVER ───
.card-interactive {
  transition:
    transform variables.$transition-base,
    box-shadow variables.$transition-base;
  cursor: pointer;

  &:hover {
    transform: translateY(-2px);
    box-shadow: var(--mm-shadow-md);
  }

  &:active {
    transform: translateY(0);
    box-shadow: var(--mm-shadow-sm);
  }
}
```

### 6. Code Block Copy Button Fade — `code/_actions.scss`

The copy button on code blocks should fade in on block hover rather than being always visible.

**Read** `services/ui/src/styles/code/_actions.scss` to find the current copy button styles. The change:

- Copy button starts with `opacity: 0`
- On `.code-block:hover`, the copy button transitions to `opacity: 1`
- The transition uses `variables.$transition-base`

**Add/modify in `services/ui/src/styles/code/_actions.scss`:**

```scss
// Copy button fade-in on code block hover
.code-block-actions,
.copy-button,
[class*="copy"] {
  opacity: 0;
  transition: opacity variables.$transition-base;

  .code-block:hover & {
    opacity: 1;
  }

  // Always show on focus for keyboard accessibility
  &:focus,
  &:focus-visible {
    opacity: 1;
  }
}
```

### 7. Focus Ring Consistency — `_base.scss`

Add a consistent focus-visible style across all interactive elements.

**Add to `_base.scss` after the scrollbar theming section:**

```scss
// ─── FOCUS RING ───
// Consistent focus-visible ring for accessibility
:focus-visible {
  outline: 2px solid var(--mm-primary);
  outline-offset: 2px;
}

// Remove default focus for mouse users
:focus:not(:focus-visible) {
  outline: none;
}

// Specific overrides for inputs and buttons that have their own focus styles
input:focus-visible,
textarea:focus-visible,
select:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px var(--mm-primary-subtle);
  border-color: var(--mm-primary);
}
```

---

## File Change Manifest

| File | Change Type | Description |
|---|---|---|
| `services/ui/src/styles/_base.scss` | **Insert** | Theme transition rules, focus ring consistency |
| `services/ui/src/styles/toolbar/_dropdowns.scss` | **Modify** | Add dropdown entrance animation |
| `services/ui/src/styles/toolbar/_buttons.scss` | **Insert** | Add `&:active` scale-down to utility buttons |
| `services/ui/src/styles/_layout.scss` | **Append** | Add resizer hover visual cue |
| `services/ui/src/styles/components/index.scss` | **Append** | Add `.card-interactive` hover styles |
| `services/ui/src/styles/code/_actions.scss` | **Modify** | Add copy button fade-in on code block hover |

---

## Verification

After applying changes:

1. **Theme toggle** — click the theme toggle; backgrounds, borders, and text colors should animate smoothly (~200ms) instead of snapping instantly
2. **Monaco editor** — should NOT flicker or animate during theme toggle (`.no-theme-transition` rule)
3. **Mermaid diagrams** — should NOT animate during theme toggle
4. **Dropdown menus** — open File menu, user menu, category selector; each should slide down with a subtle fade-in
5. **Toolbar buttons** — hover shows smooth background transition; click/mousedown shows subtle scale-down (95%)
6. **Resizer** — hover over the boundary between editor and preview; a thin primary-colored line should appear
7. **Code blocks** — hover over a code block in preview; copy button should fade in smoothly
8. **Keyboard focus** — Tab through the UI; focus-visible rings should appear in primary color
9. **Dark mode** — all transitions should work identically in dark mode
10. **Performance** — no jank or layout shifts from the transitions; scrolling remains smooth

---

## Notes for AI Agents

- The theme transition (`html[data-bs-theme]`) selector is critical. It must NOT apply `transition` to the `content` property or `display` property. The current rule only transitions `background-color`, `border-color`, `color`, and `box-shadow` — keep it this way.
- The `.no-theme-transition` opt-out is essential for Monaco editor and Mermaid diagrams. These components manage their own theming and would look broken with CSS transitions applied.
- The dropdown animation replaces the existing `&.show { display: block; }` rule. The animation uses `display: block` in its own `&.show` selector.
- The resizer cue styling depends on the class/id used by `InvisibleResizer.jsx`. Read the component to confirm the correct CSS selector before implementing.
- The code block copy button fade MUST keep `&:focus-visible { opacity: 1 }` for keyboard accessibility — screen reader users must be able to see/find the button without hover.
- Read `services/ui/src/styles/code/_actions.scss` BEFORE implementing change 6 — the current file content is not included in this document because it wasn't reviewed during planning. Verify the current selectors before modifying.
- The `card-interactive` class is opt-in — it won't affect any existing cards unless the class is added to their markup. This is intentional for Phase 4 (no JSX changes).
