---
name: BuildPath
description: AI-generated project roadmaps rendered as a warm, lit serpentine timeline
colors:
  amber: "#d4a24c"
  terracotta: "#c65d3a"
  canvas: "#1a1714"
  surface: "#231f1b"
  surface-raised: "#2d2822"
  border: "#3d362e"
  border-bright: "#564d42"
  ink: "#ede6db"
  ink-secondary: "#a89c8c"
  ink-muted: "#6b5f52"
  sage: "#7ab06a"
  muted-red: "#b54d3a"
  dusty-purple: "#8b7198"
  warm-teal: "#5b9a8c"
typography:
  display:
    fontFamily: "Playfair Display, Georgia, serif"
    fontSize: "48px"
    fontWeight: 700
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Playfair Display, Georgia, serif"
    fontSize: "32px"
    fontWeight: 700
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Playfair Display, Georgia, serif"
    fontSize: "20px"
    fontWeight: 700
    letterSpacing: "-0.02em"
  body:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 500
    letterSpacing: "0.08em"
rounded:
  sm: "4px"
  md: "6px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  xxl: "48px"
components:
  button-primary:
    backgroundColor: "{colors.terracotta}"
    textColor: "{colors.canvas}"
    rounded: "{rounded.md}"
    padding: "10px 20px"
  button-amber:
    backgroundColor: "{colors.amber}"
    textColor: "{colors.canvas}"
    rounded: "{rounded.md}"
    padding: "9px 18px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink-secondary}"
    rounded: "{rounded.md}"
    padding: "9px 16px"
  chip:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "9px 14px"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.md}"
    padding: "20px"
  card-current:
    backgroundColor: "{colors.surface-raised}"
    rounded: "{rounded.md}"
    padding: "20px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "12px 14px"
---

# Design System: BuildPath

## 1. Overview

**Creative North Star: "The Workshop Blueprint"**

BuildPath is a maker's drafting table at golden hour — warm and precise. The surfaces are aged oak and dark walnut, never cold; the line currently being drawn carries warm amber light, like a brass instrument catching lamp glow. Structure still does the talking — hairline rules, tabular numerals, consistent 6px radii — but the temperature is workshop, not server room. Think Aesop packaging, not GitHub dashboard.

The system rejects (per PRODUCT.md, re-tempered): the **generic SaaS dashboard**, **neon overload** of any temperature, and **sterile gray** — and adds a hard rule of its own: **zero cold blues, cyans, or blue-grays anywhere**. Every neutral is brown-shifted. The glow budget survives the retheme: amber light is spent on the current phase and nowhere else.

**Key Characteristics:**
- Warm dark surfaces (aged oak → walnut → raised brown), every gray brown-shifted
- One illuminated element per screen; the light is amber, like a task lamp
- Terracotta for the single forward action; amber for state, progress, and focus
- Editorial typography: Playfair Display serif headings over an Inter body
- Tight 6px radii, hairline dividers, paper-like cards

## 2. Colors

A golden-hour workshop palette: amber line-work and terracotta action on warm walnut.

### Primary
- **Amber** (#d4a24c): the lit line. Timeline rail and orb, current-phase ring and left accent, progress and confidence fills, focus rings, the agent avatar, critical-path pills, user chat chips. Amber fills always carry dark #1a1714 text.

### Secondary
- **Terracotta** (#c65d3a): the action color — "Generate Roadmap", "Start Planning", "Mark Complete", the chat send button. Doubles as the danger hue (desaturated, warm). Always dark text on terracotta fills.

### Tertiary
- **Sage** (#7ab06a): success, completion states, quick-win tags, BUSINESS preset.
- **Muted Red** (#b54d3a): high-risk tags only.
- **Dusty Purple** (#8b7198): RESEARCH preset and dependency tags.
- **Warm Teal** (#5b9a8c): SOFTWARE preset — the one cool-leaning hue, kept desaturated and rare.

### Neutral
- **Canvas** (#1a1714): aged oak near-black, with a faint amber radial at the top of the page like a distant lamp.
- **Surface** (#231f1b) and **Surface Raised** (#2d2822): walnut cards and panels, paper-like — never glassy.
- **Border** (#3d362e) / **Border Bright** (#564d42): warm hairlines.
- **Ink** (#ede6db) warm cream, **Ink Secondary** (#a89c8c), **Ink Muted** (#6b5f52, hints only).

### Named Rules
**The One Lit Line Rule.** Amber glow may appear only on the timeline and the current phase's card, node, and connector. Two glowing elements on one screen means one is wrong.

**The Terracotta Means Go Rule.** Terracotta appears on exactly one affordance per screen: the action that moves the project forward.

**The Warm Neutral Rule.** No blue-shifted gray survives review. If a neutral's hue isn't brown, it's a bug.

## 3. Typography

**Display Font:** Playfair Display 700 (with Georgia, serif fallback)
**Body Font:** Inter 400/500/600 (with system sans fallback)

**Character:** A real contrast pairing — Playfair's high-contrast editorial serifs give headings the authority of a printed drawing title block, while Inter disappears into legibility for body, labels, and data. Numerals and annotations fall back to the system mono stack.

### Hierarchy
- **Display** (Playfair 700, 48px, -0.02em): the home page "BuildPath" title.
- **Headline** (Playfair 700, 32px, -0.01em): project titles.
- **Title** (Playfair 700, 20px, -0.02em): phase card titles.
- **Body** (Inter 400, 14px, line-height 1.6, Ink Secondary): descriptions, risks, checkpoints.
- **Label** (Inter 500, 11px, +0.08em, UPPERCASE): section toggles, widget labels, info-card labels.

### Named Rules
**The Tabular Rule.** Every changing number keeps `font-variant-numeric: tabular-nums` in the mono stack so reflow never wobbles.

**The Display Floor Rule.** Playfair Display never renders below 20px — its hairline strokes sparkle on the dark canvas at small sizes. Sub-20px heading roles (collapsed phase rows, the emphasized chat question, buttons, the avatar) are carried by Inter 600/700.

## 4. Elevation

Depth stays layered, not lifted: the warm tonal ramp (canvas → surface → raised) carries structure. Shadows are warm-black ambient grounding only; glow is the amber state signal, budgeted as ever. Hover changes border color, not altitude.

### Shadow Vocabulary
- **Ambient card** (`0 2px 24px rgba(12, 9, 5, 0.55)`): summary and error cards.
- **Current-phase ring** (`inset 0 0 0 1px rgba(212,162,76,0.3), 0 0 30px rgba(212,162,76,0.08)`): the one lit card, plus its 3px amber left accent.
- **Action glow** (`0 0 20px rgba(198, 93, 58, 0.3)`): terracotta buttons on hover only.

## 5. Components

Paper and brass: solid warm fills, immediate feedback, instrument-grade structure.

### Buttons
- **Primary (terracotta):** #c65d3a fill, dark #1a1714 text, 700 weight; hover brightens with the warm action glow.
- **Amber (filled):** #d4a24c with dark text, for mid-flow confirmations (multiselect Continue).
- **Ghost:** transparent, warm hairline border, Ink Secondary text; hover swaps border to amber.
- **Completed state:** "Completed ✓" in sage.

### Chips & Badges
- **Preset badges:** warm palette, one hue per type — teal SOFTWARE, terracotta HARDWARE, dusty-purple RESEARCH, sage BUSINESS, amber CUSTOM.
- **Tags:** desaturated and warm; critical-path terracotta, high-risk muted red, quick-win sage, dependency dusty purple, the work-type tags (research/build/test/deploy) in warm muted #6b5f52.
- **Critical-path pills:** amber text on rgba(212,162,76,0.12) with a 0.4-alpha amber border.

### Cards / Containers
- Paper-like: Surface fill, warm hairline border, 6px radius, 20px padding; current phase steps up to Surface Raised with the amber ring and 3px left accent; completed phases carry a whisper of amber tint (rgba(212,162,76,0.04)); upcoming phases collapse to a single row.

### The Serpentine Timeline (signature)
The S-curve SVG keeps its lighting language in amber: completed segments glow softly, the current segment is brightest and carries a warm-white orb with an amber halo, upcoming segments are dark warm (#3d362e), and the light bleeds into the dark after the current node. Nodes: filled amber + dark check, amber + warm pulsing halo, warm outline.

## 6. Do's and Don'ts

### Do:
- **Do** spend the amber glow budget on the current phase only.
- **Do** keep terracotta to one forward action per screen, always with dark #1a1714 text.
- **Do** brown-shift every neutral — canvas, borders, shadows, text all carry the warm hue.
- **Do** keep cards paper-like: warm fills and hairlines, no glass, no blur.
- **Do** keep every animation's `prefers-reduced-motion` alternative.

### Don't:
- **Don't** use cold blues, cyans, or blue-grays anywhere — including the old #49c4d8 / #050a0d family this theme replaced, and the original #3b82f6 / #f97316 defaults before it.
- **Don't** let any hue except amber and terracotta reach full brightness.
- **Don't** ship the generic SaaS dashboard, neon overload, or sterile gray (PRODUCT.md anti-references).
- **Don't** use Ink Muted (#6b5f52) for running text — hints and de-emphasized tags only.
- **Don't** put white text on amber or terracotta fills — both carry dark text.
