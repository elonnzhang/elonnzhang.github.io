# Remote Content Assets

Local assets are the source of truth and the default runtime source. The R2
mirror is optional and is enabled only after every mirrored object has been
verified.

Content images can live in both places:

- Git and Hugo keep the original files under `static/assets/`.
- The `blog-img` R2 bucket mirrors the selected prefixes at `blog-assets.jiabin.dev`.

Gallery and Markdown images additionally use compressed WebP variants:

- `thumb/<uuid>.webp` is a 1200px browser-width thumbnail.
- `display/<uuid>.webp` is a 2048px article/lightbox image.
- Original files remain in `gallery/` and `images/` as source archives.
- `static/assets/images/ink-splash.png` is intentionally local-only.

The custom domain maps to the bucket root. Repository paths therefore keep their
`assets/` prefix:

```text
static/assets/gallery/<uuid>.jpg
-> R2 key gallery/<uuid>.jpg
-> https://blog-assets.jiabin.dev/gallery/<uuid>.jpg
```

`layouts/partials/remote-asset.html` is the single URL decision point. Hugo
rewrites only these prefixes when enabled:

- `/assets/gallery/`
- `/assets/images/`

Upload the mirror without deleting either side:

```sh
scripts/sync-remote-assets.sh          # list planned uploads
scripts/sync-remote-assets.sh --upload # copy to R2
```

The script only creates or replaces objects; it never prunes local files or R2
objects. Verify each generated URL returns HTTP 200 before publishing:

```sh
curl -I https://blog-assets.jiabin.dev/gallery/<uuid>.jpg
```

Keep `params.remoteAssets.enabled` set to `false` for local-first publishing.
Set it to `true` only when the R2 mirror is deliberately preferred or needed.
Turning it back to `false` immediately restores the local URLs.
