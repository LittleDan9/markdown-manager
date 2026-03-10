# Phase 1: Design Foundation — Variables, Tokens & Spacing Scale

> **Status: ✅ Implemented** — March 2026

## Objective

Replace the ad-hoc color, spacing, and typography values with a cohesive design token system. This phase makes NO visual changes — it only establishes the foundation that subsequent phases will consume. The existing values are preserved as fallbacks so nothing breaks.

## Prerequisites

- Branch: `ui-refresh` (based on `main`)
- Read the project plan: `roadmap/ui-refresh/README.md`
- Frontend running: `docker compose up frontend -d`

## Context

### Current `_variables.scss` (full file)

**Path:** `services/ui/src/styles/_variables.scss`

```scss
// ─── SASS VARIABLES ───
// Centralized variables for colors, spacing, typography, etc.

// Colors
$color-border: #e1e1e1;
$color-border-light: #f8f9fa;
$color-border-dark: #444;
$color-bg-light: hsl(230, 1%, 98%);
$color-text-light: hsl(230, 8%, 24%);
$color-bg-dark: hsl(220, 13%, 18%);
$color-text-dark: hsl(220, 14%, 71%);
$color-primary: #007bff;
$color-primary-dark-hover: #66b0ff;
$color-code-inline-bg: #f8f9fa;
$color-code-inline-border: #e9ecef;
$color-code-inline-text: #e83e8c;
$color-code-inline-bg-dark: #2d3748;
$color-code-inline-border-dark: #4a5568;
$color-code-inline-text-dark: #f92672;

// Typography
$font-mono: "Fira Code", "Fira Mono", Menlo, Consolas, "DejaVu Sans Mono", monospace;
$font-mono-alt: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, Courier, monospace;

// Spacing
$spacing-base: 1rem;
$spacing-sm: 0.5rem;
$spacing-xs: 0.25rem;
$spacing-code-header-y: $spacing-xs;
$spacing-code-header-x: $spacing-base;
```

### Current `_mixins.scss` (full file)

**Path:** `services/ui/src/styles/_mixins.scss`

```scss
// ─── SASS MIXINS ───

// Dark theme wrapper: wraps styles inside [data-bs-theme="dark"] selector
@mixin dark {
  @at-root [data-bs-theme="dark"] & {
    @content;
  }
}

// Light theme wrapper (optional)
@mixin light {
  @at-root [data-bs-theme="light"] & {
    @content;
  }
}
```

### Current `_base.scss` (imports line)

**Path:** `services/ui/src/styles/_base.scss` — Line 1-2:
```scss
@use "variables";
@use "mixins";
```

---

## Changes

### 1. Expand `_variables.scss` with design tokens

Replace the entire file with the expanded version below. All existing variable names are preserved with their current values (nothing breaks). New tokens are added in clearly marked sections.

**Target content for `services/ui/src/styles/_variables.scss`:**

```scss
// ─── DESIGN TOKENS ───
// Centralized variables for colors, spacing, typography, and surfaces.
// Phase 1 of ui-refresh: establishes the foundation for all visual changes.

// ────────────────────────────────────────
// 1. COLOR PALETTE
// ────────────────────────────────────────

// Brand colors — distinctive identity (replaces generic Bootstrap blue)
$color-primary: #4f6df5;              // Modernized primary — vibrant indigo-blue
$color-primary-hover: #3b57d9;        // Darker on hover
$color-primary-subtle: #eef1fe;       // Light tint for backgrounds
$color-primary-dark-hover: #8fa4ff;   // Primary hover in dark mode

$color-accent: #10b981;              // Secondary accent — emerald green
$color-accent-hover: #059669;
$color-accent-subtle: #ecfdf5;

// Neutral palette — replaces Bootstrap's generic grays
$color-gray-50: #f9fafb;
$color-gray-100: #f3f4f6;
$color-gray-200: #e5e7eb;
$color-gray-300: #d1d5db;
$color-gray-400: #9ca3af;
$color-gray-500: #6b7280;
$color-gray-600: #4b5563;
$color-gray-700: #374151;
$color-gray-800: #1f2937;
$color-gray-900: #111827;

// Semantic colors
$color-success: #10b981;
$color-warning: #f59e0b;
$color-danger: #ef4444;
$color-info: #3b82f6;

// ── Light theme surface colors ──
$color-bg-light: #ffffff;
$color-bg-surface-light: $color-gray-50;      // Cards, panels, secondary surfaces
$color-bg-elevated-light: #ffffff;             // Elevated elements (modals, dropdowns)
$color-text-light: $color-gray-900;            // Primary text
$color-text-secondary-light: $color-gray-500;  // Muted/secondary text
$color-border: $color-gray-200;                // Default border
$color-border-light: $color-gray-100;          // Subtle border
$color-border-emphasis-light: $color-gray-300; // Emphasized border

// ── Dark theme surface colors ──
$color-bg-dark: #0f172a;                       // Deep navy — refined from generic dark
$color-bg-surface-dark: #1e293b;               // Cards, panels
$color-bg-elevated-dark: #334155;              // Elevated elements (modals, dropdowns)
$color-text-dark: #e2e8f0;                     // Primary text
$color-text-secondary-dark: #94a3b8;           // Muted/secondary text
$color-border-dark: #334155;                   // Default border
$color-border-emphasis-dark: #475569;          // Emphasized border

// ── Code/inline code colors (preserved) ──
$color-code-inline-bg: $color-gray-100;
$color-code-inline-border: $color-gray-200;
$color-code-inline-text: #e83e8c;
$color-code-inline-bg-dark: #1e293b;
$color-code-inline-border-dark: #334155;
$color-code-inline-text-dark: #f472b6;

// ────────────────────────────────────────
// 2. TYPOGRAPHY
// ────────────────────────────────────────

$font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
$font-mono: "Fira Code", "Fira Mono", "JetBrains Mono", Menlo, Consolas, "DejaVu Sans Mono", monospace;
$font-mono-alt: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, Courier, monospace;

// Font weight scale
$font-weight-normal: 400;
$font-weight-medium: 500;
$font-weight-semibold: 600;
$font-weight-bold: 700;

// Font size scale (relative to base 1rem = 16px)
$font-size-xs: 0.75rem;    // 12px — badges, captions
$font-size-sm: 0.8125rem;  // 13px — dropdown items, meta
$font-size-base: 0.875rem; // 14px — body text in app chrome
$font-size-md: 1rem;       // 16px — primary content
$font-size-lg: 1.125rem;   // 18px — section titles
$font-size-xl: 1.25rem;    // 20px — page titles
$font-size-2xl: 1.5rem;    // 24px — major headings

// ────────────────────────────────────────
// 3. SPACING SCALE
// ────────────────────────────────────────

// 4px base unit spacing scale
$space-0: 0;
$space-1: 0.25rem;   // 4px
$space-2: 0.5rem;    // 8px
$space-3: 0.75rem;   // 12px
$space-4: 1rem;      // 16px
$space-5: 1.25rem;   // 20px
$space-6: 1.5rem;    // 24px
$space-8: 2rem;      // 32px
$space-10: 2.5rem;   // 40px
$space-12: 3rem;     // 48px

// Legacy aliases (preserved for backward compatibility)
$spacing-base: $space-4;
$spacing-sm: $space-2;
$spacing-xs: $space-1;
$spacing-code-header-y: $space-1;
$spacing-code-header-x: $space-4;

// ────────────────────────────────────────
// 4. SURFACES & ELEVATION
// ────────────────────────────────────────

// Border radius scale
$radius-sm: 0.25rem;   // 4px — badges, inline code
$radius-md: 0.5rem;    // 8px — cards, inputs, panels
$radius-lg: 0.75rem;   // 12px — modals, large containers
$radius-xl: 1rem;      // 16px — feature cards
$radius-full: 9999px;  // Pill shape

// Box shadow scale (light theme)
$shadow-xs: 0 1px 2px rgba(0, 0, 0, 0.05);
$shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.08), 0 1px 2px rgba(0, 0, 0, 0.04);
$shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.08), 0 2px 4px -1px rgba(0, 0, 0, 0.04);
$shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.08), 0 4px 6px -2px rgba(0, 0, 0, 0.03);
$shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.08), 0 10px 10px -5px rgba(0, 0, 0, 0.02);

// Box shadow scale (dark theme — subtler, uses rgba white for glow)
$shadow-sm-dark: 0 1px 3px rgba(0, 0, 0, 0.3), 0 1px 2px rgba(0, 0, 0, 0.2);
$shadow-md-dark: 0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.2);
$shadow-lg-dark: 0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -2px rgba(0, 0, 0, 0.15);

// ────────────────────────────────────────
// 5. TRANSITIONS
// ────────────────────────────────────────

$transition-fast: 0.15s ease;
$transition-base: 0.2s ease;
$transition-slow: 0.3s ease;
$transition-theme: 0.25s ease;  // Theme switch transition
```

### 2. Add utility mixins to `_mixins.scss`

Add transition and surface helper mixins below the existing `dark` and `light` mixins. Keep the existing mixins unchanged.

**Append to `services/ui/src/styles/_mixins.scss`:**

```scss

// ─── SURFACE MIXINS ───

// Apply elevation shadow with dark mode variant
@mixin elevation($level: "sm") {
  @if $level == "xs" {
    box-shadow: variables.$shadow-xs;
    @include dark { box-shadow: variables.$shadow-sm-dark; }
  } @else if $level == "sm" {
    box-shadow: variables.$shadow-sm;
    @include dark { box-shadow: variables.$shadow-sm-dark; }
  } @else if $level == "md" {
    box-shadow: variables.$shadow-md;
    @include dark { box-shadow: variables.$shadow-md-dark; }
  } @else if $level == "lg" {
    box-shadow: variables.$shadow-lg;
    @include dark { box-shadow: variables.$shadow-lg-dark; }
  }
}

// Smooth transition for interactive elements
@mixin interactive-transition($properties: all) {
  transition: #{$properties} variables.$transition-base;
}

// Surface background with dark mode variant
@mixin surface($light-bg, $dark-bg) {
  background-color: $light-bg;
  @include dark {
    background-color: $dark-bg;
  }
}

// Border with dark mode variant
@mixin themed-border($light-color: variables.$color-border, $dark-color: variables.$color-border-dark) {
  border: 1px solid $light-color;
  @include dark {
    border-color: $dark-color;
  }
}
```

**Important:** The `@use "variables";` import must be added at the top of `_mixins.scss` since the new mixins reference variables. The file should start with:

```scss
@use "variables";

// ─── SASS MIXINS ───
```

### 3. Add CSS custom properties to `_base.scss`

After the existing `@use` imports (line 1-2), add a `:root` block that exposes key tokens as CSS custom properties. This allows Bootstrap's `var()` references to pick up our custom values and enables runtime theme switching.

**Insert after line 2 of `services/ui/src/styles/_base.scss`:**

```scss

// ─── CSS CUSTOM PROPERTIES (Design Tokens) ───
// Expose SCSS tokens as CSS custom properties for runtime access
:root {
  // Brand
  --mm-primary: #{variables.$color-primary};
  --mm-primary-hover: #{variables.$color-primary-hover};
  --mm-primary-subtle: #{variables.$color-primary-subtle};
  --mm-accent: #{variables.$color-accent};

  // Surfaces (light defaults)
  --mm-bg: #{variables.$color-bg-light};
  --mm-bg-surface: #{variables.$color-bg-surface-light};
  --mm-bg-elevated: #{variables.$color-bg-elevated-light};
  --mm-text: #{variables.$color-text-light};
  --mm-text-secondary: #{variables.$color-text-secondary-light};
  --mm-border: #{variables.$color-border};
  --mm-border-subtle: #{variables.$color-border-light};

  // Shadows
  --mm-shadow-sm: #{variables.$shadow-sm};
  --mm-shadow-md: #{variables.$shadow-md};
  --mm-shadow-lg: #{variables.$shadow-lg};

  // Radii
  --mm-radius-sm: #{variables.$radius-sm};
  --mm-radius-md: #{variables.$radius-md};
  --mm-radius-lg: #{variables.$radius-lg};

  // Transitions
  --mm-transition-fast: #{variables.$transition-fast};
  --mm-transition-base: #{variables.$transition-base};
  --mm-transition-slow: #{variables.$transition-slow};
}

// ── Dark theme overrides ──
[data-bs-theme="dark"] {
  --mm-primary: #{variables.$color-primary};
  --mm-primary-hover: #{variables.$color-primary-dark-hover};
  --mm-primary-subtle: rgba(79, 109, 245, 0.15);
  --mm-accent: #{variables.$color-accent};

  --mm-bg: #{variables.$color-bg-dark};
  --mm-bg-surface: #{variables.$color-bg-surface-dark};
  --mm-bg-elevated: #{variables.$color-bg-elevated-dark};
  --mm-text: #{variables.$color-text-dark};
  --mm-text-secondary: #{variables.$color-text-secondary-dark};
  --mm-border: #{variables.$color-border-dark};
  --mm-border-subtle: #{variables.$color-border-dark};

  --mm-shadow-sm: #{variables.$shadow-sm-dark};
  --mm-shadow-md: #{variables.$shadow-md-dark};
  --mm-shadow-lg: #{variables.$shadow-lg-dark};
}
```

---

## File Change Manifest

| File | Change Type | Description |
|---|---|---|
| `services/ui/src/styles/_variables.scss` | **Replace** entire file | Expanded design token system with colors, typography, spacing, surfaces, transitions |
| `services/ui/src/styles/_mixins.scss` | **Prepend** `@use "variables"` + **Append** new mixins | Add `elevation()`, `interactive-transition()`, `surface()`, `themed-border()` mixins |
| `services/ui/src/styles/_base.scss` | **Insert** after line 2 | Add `:root` and `[data-bs-theme="dark"]` CSS custom property blocks |

---

## Verification

After applying changes:

1. Run `docker compose up frontend -d` and check `docker compose logs frontend` — no SCSS compilation errors
2. Open `http://localhost/` — the app should look **identical** to before (all existing variable names preserved)
3. Toggle dark mode — no regressions
4. Open browser DevTools → Elements → `:root` — verify `--mm-*` custom properties are present
5. Switch to dark theme → verify `--mm-*` values update under `[data-bs-theme="dark"]`

**Expected result:** Zero visual changes. The design token infrastructure is in place for Phases 2–5 to consume.

---

## Notes for AI Agents

- Do NOT change any other SCSS files in this phase. Only the 3 files listed above.
- The `@use "variables"` in `_mixins.scss` may cause a circular dependency warning if `_variables.scss` also uses `_mixins.scss`. It does not — `_variables.scss` has no imports, so this is safe.
- All new variable names use the `$color-*`, `$space-*`, `$radius-*`, `$shadow-*`, `$font-*` naming conventions.
- CSS custom properties use the `--mm-*` prefix (Markdown Manager) to avoid collisions with Bootstrap's `--bs-*` properties.
- Legacy aliases (`$spacing-base`, `$spacing-sm`, etc.) are preserved so existing `@use "variables"` references in other files continue to work.
