# Cloudflare Guide

Cloudflare provides DNS for jiabin.dev and may host the optional E-Ink header adapter.

The `blog-img` R2 bucket optionally mirrors selected content assets at
`blog-assets.jiabin.dev`. Local `static/assets/` files remain the source of truth;
sync only with the non-pruning script in `scripts/sync-remote-assets.sh`.

The Worker may redirect GET and HEAD requests carrying X-Eink: 1, Eink: 1, or Prefer: eink to the same URL with eink=1. It must preserve unrelated query parameters and must not alter POST requests.

The site itself remains static and is rendered by Hugo on GitHub Pages. Do not move page rendering or content logic into the Worker. Document DNS and route changes in docs/.
