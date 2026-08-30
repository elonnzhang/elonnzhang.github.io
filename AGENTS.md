# Repository Guide

This repository is a Hugo static site with a terminal TUI visual language. GitHub Actions builds the site and deploys the generated public directory to GitHub Pages.

## Architecture

- content/ contains Markdown content and front matter.
- layouts/ contains Hugo templates and reusable TUI partials.
- assets/ contains resources processed by Hugo Pipes, currently the SCSS entry point.
- static/ contains files copied unchanged to the published site.
- data/ contains structured data used by templates.
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
- Keep the Header prompt stable as elonnzhang@space:~$ and keep navigation right-aligned.
- The primary navigation is Home, Blog, Clippings, Archive, About, and RSS.
- Keep normal web mode and E-Ink mode working. The eink=1 query enables E-Ink mode and web=1 explicitly returns to normal web mode.
- Use root-relative or Hugo-generated URLs for local assets.
- Do not publish secrets, tokens, or local machine paths.

## Verification

After changing templates, styles, routes, or content:

1. Run a Hugo production build.
2. Check the changed page and at least one article in the generated output.
3. Check the affected page with and without the eink=1 query.
4. Check mobile layout when changing Header, lists, or page widths.
5. Run git diff --check.

