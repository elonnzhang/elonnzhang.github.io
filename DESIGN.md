# Blog Design System

## 1. Visual Theme and Atmosphere

The site pairs a raw terminal identity with a quiet paper-reading mode. Dark
mode feels like a focused terminal session; light mode feels like a clean
engineering printout. The desk lamp in the header is the signature control.

## 2. Color Palette and Roles

- Paper: `#f7f7f2` for the light canvas.
- Ink: `#1c211d` for light-mode text.
- Terminal: `#111210` for the dark canvas.
- Phosphor: `#b5e853` for dark-mode headings and focus.
- Signal blue: `#00658f` light / `#63c0f5` dark for links.
- Editorial red: `#9b3326` for light-mode metadata and rules.
- E-ink: pure black and white, with no decorative texture.

Hex colors are intentional: the Kindle browser constraint takes precedence
over newer color syntax.

## 3. Typography Rules

Body copy uses the local system sans stack for fast rendering and dependable
CJK coverage. Headings and code use the system monospace stack to preserve the
terminal character. Body text is 17px/1.75 on modern screens and 18px/1.7 in
e-ink mode; letter spacing remains zero.

## 4. Component Styling

- Navigation is plain underlined text with a visible focus outline.
- The theme control is a 44px square icon button with a Lucide desk lamp.
- Post listings are unframed rows separated by hairline rules.
- Code and tables scroll within their own bounds instead of widening the page.

## 5. Layout Principles

The reading column is capped at 760px. The header uses the wider 1040px shell
and wraps on narrow screens. Spacing follows an 8px base rhythm.

## 6. Depth and Elevation

Content remains flat and editorial. The lamp alone gets a small light-mode
glow; dark and e-ink modes do not use drop shadows for structure.

## 7. Do and Do Not

- Preserve public post URLs.
- Keep all critical assets local.
- Prefer semantic HTML over JavaScript-driven UI.
- Never require animation to understand state.
- Do not use cards, gradients, glass effects, or external font services.
- Do not allow long URLs, tables, or code to widen the viewport.

## 8. Responsive Behavior

At 720px the header wraps and post spacing tightens. Interactive targets remain
at least 44px. Kindle and monochrome displays remove texture, shadows,
transitions, sticky positioning, and color-dependent meaning.

## 9. Agent Prompt Guide

- "Add a post-list control using the existing paper/terminal tokens, 44px
  targets, zero letter spacing, and no card surface."
- "Add a reading feature within the 760px column; it must work without
  JavaScript and remain black-on-white in e-ink mode."
- "Add an icon action using a local Lucide SVG, a visible 2px focus outline,
  and no motion under reduced-motion or e-ink conditions."
