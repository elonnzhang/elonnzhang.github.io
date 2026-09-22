# Repository Guide

This repository is a Hugo static site with a terminal TUI visual language. GitHub Actions builds the site and deploys the generated public directory to GitHub Pages.

## Theme architecture: archie base + TUI patch

The site runs on the athul/archie theme as the base, with a thin TUI patch layered on top. Hugo gives project files priority over theme files, so "theme = base, project = patch" is the native model here.

- themes/archie/ is the vendored base theme (layouts, CSS, fonts, JS). Prefer not to edit it; override from the project instead. It is enabled with `theme: archie` in hugo.yaml.
- layouts/ holds only the TUI patch overrides, not a full theme. Each file overrides or supplements an archie template:
  - partials/head.html overrides archie's masthead: the terminal prompt `elonnzhang@<space>$` where clicking `elonnzhang` goes home and clicking `@<space>$ ▾` opens a `<details>` space dropdown (data from data/site.yaml). Keeps archie's menu + dark-mode toggle and the `feathericon` template the footer needs.
  - _default/single.html adds a `cd ..` back link and conditionally loads the mermaid runtime; _default/term.html, terms.html, and archive.html add the same `cd ..` link and use archie-style lists.
  - _default/_markup/render-codeblock-mermaid.html renders ```mermaid fences as a fullscreen-capable figure.
  - partials/pagedescription.html clamps the home body-fallback preview to 5 lines.
  - gallery/* and partials/gallery-*, remote-asset.html are the self-contained gallery subsystem (its own chrome, unrelated to archie).
  - shortcodes/instagram.html keeps content that uses that shortcode building.
- assets/css/tui-patch.css is the TUI style patch, loaded via archie's `params.customCSS`. It carries the prompt, `cd ..` link, mermaid, TOC docking, list spacing, paginator, and scrollbar-gutter rules.
- static/assets/js/ holds patch scripts: space-switcher.js (close dropdown on outside-click/scroll/Esc), mermaid.js (official one-pass render), mermaid-fullscreen.js (fit-to-viewport overlay), plus the legacy TUI scripts.
- tui-patch/layouts/ preserves the original full custom TUI theme (baseof, index, header, footer, seo, etc.). It is outside Hugo's watched dirs, so it is inert; keep it as reference for further patch work. Do not re-add these into layouts/ wholesale or they will override archie again.

## Directory layout

- content/ contains Markdown content and front matter.
- assets/ contains resources processed by Hugo Pipes (the SCSS entry point and tui-patch.css).
- static/ contains files copied unchanged to the published site.
- data/ contains structured data used by templates (data/site.yaml drives the header space dropdown).
- hugo.yaml contains the site configuration. The canonical domain is jiabin.dev.
- go-change-lab/ is an independent Vite/React source project. Its build output is copied into static/go-change-lab/.
- cloudflare/ contains the optional Worker for E-Ink request headers.
- public/ is generated output. Never edit or commit it.

Hugo sources are authoritative. The old Jekyll files and directories are migration leftovers; do not update both systems for the same change.

## Commands

Run a Hugo production build with:

    hugo --gc --minify

Build the interactive Go project with:

    cd go-change-lab && npm ci && npm run build

Run a deployment-style local build with:

    cd go-change-lab && npm ci && npm run build
    cd ..
    cp -R go-change-lab/dist/. static/go-change-lab/
    hugo --gc --minify

Use a temporary destination when checking output without changing public/:

    hugo --gc --minify --destination /tmp/elonnzhang-hugo-check

## Site rules

- Preserve existing public URLs, especially short article URLs such as /raft and /gogc.
- Keep jiabin.dev as the canonical URL while allowing elonnzhang.github.io to serve the same GitHub Pages site.
- The Header prompt is `elonnzhang@<space>$` (rendered by the archie masthead override in layouts/partials/head.html). `<space>` reflects the active section; clicking `elonnzhang` goes home, clicking `@<space>$ ▾` opens the space dropdown. Keep the owner + `@space` underline continuous (one line via `.tui-prompt` with `text-decoration-skip-ink: none`).
- The primary navigation is Home, Blog, Clippings, Archive, About, Tags, plus the dark-mode toggle. It comes from `menu.main` in hugo.yaml and stays right-aligned (archie's `header { justify-content: space-between }`).
- Set the theme (light/dark) via archie's `params.mode: toggle`; the favicon via `params.favicon`.
- E-Ink mode is currently NOT wired on the archie base. The original E-Ink system (eink-reader.js, space-transition, ink-reader page) lives with the preserved TUI in tui-patch/ and is inert. If E-Ink support is required again, re-port it as a patch (load the scripts from the archie <head> and re-add the ink-reader layout); do not assume ?eink=1 works today.
- Use root-relative or Hugo-generated URLs for local assets.
- Do not publish secrets, tokens, or local machine paths.

## Verification

After changing templates, styles, routes, or content:

1. Run a Hugo production build.
2. Check the changed page and at least one article in the generated output.
3. When changing the header, TOC, mermaid, or page widths, check at both a wide (>=1360px, TOC docks right) and a narrow width.
4. When touching mermaid, verify diagrams render (not empty), fit as an overview, and the fullscreen overlay opens and closes.
5. Run git diff --check.
6. tui-patch.css is loaded through archie's `params.customCSS`; confirm the fingerprinted file appears in the built <head>.

