# Asset Guide

The assets directory contains resources processed by Hugo Pipes. Live styles are `css/chroma.css` (Chroma token colors), `css/neat-annotations.css` (hand-drawn callouts), and `css/tui-patch.css` (TUI overlay), all loaded via `params.customCSS`. `main.scss` is a leftover and is not wired on the archie base.

## Rules

- Keep SCSS compatible with Hugo's extended Sass compiler.
- Use the existing color tokens, zero letter spacing, responsive constraints, and normal/E-Ink selectors unless a visual redesign is requested.
- Put directly published images, fonts, and browser scripts in static/ unless they require Hugo processing.
- Do not add external font services or unnecessary build dependencies.
- Verify that a Hugo build creates the fingerprinted CSS referenced by generated HTML.

