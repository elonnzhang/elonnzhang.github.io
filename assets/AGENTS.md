# Asset Guide

The assets directory contains resources processed by Hugo Pipes. The main entry point is assets/css/main.scss, which imports the TUI styles.

## Rules

- Keep SCSS compatible with Hugo's extended Sass compiler.
- Use the existing color tokens, zero letter spacing, responsive constraints, and normal/E-Ink selectors unless a visual redesign is requested.
- Put directly published images, fonts, and browser scripts in static/ unless they require Hugo processing.
- Do not add external font services or unnecessary build dependencies.
- Verify that a Hugo build creates the fingerprinted CSS referenced by generated HTML.

