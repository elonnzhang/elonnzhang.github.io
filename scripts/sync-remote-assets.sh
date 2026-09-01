#!/usr/bin/env bash

set -euo pipefail

bucket="blog-img"
base="https://blog-assets.jiabin.dev"
upload=false

if [[ "${1:-}" == "--upload" ]]; then
  upload=true
elif [[ $# -gt 0 ]]; then
  echo "usage: $0 [--upload]" >&2
  exit 2
fi

root="$(git rev-parse --show-toplevel)"
cd "$root"

is_excluded() {
  case "$1" in
    static/assets/images/ink-splash.png) return 0 ;;
    *) return 1 ;;
  esac
}

content_type() {
  extension="$(printf '%s' "$1" | tr '[:upper:]' '[:lower:]')"
  case "$extension" in
    avif) echo "image/avif" ;;
    gif) echo "image/gif" ;;
    jpg | jpeg) echo "image/jpeg" ;;
    png) echo "image/png" ;;
    svg) echo "image/svg+xml" ;;
    webp) echo "image/webp" ;;
    *) echo "application/octet-stream" ;;
  esac
}

while IFS= read -r -d '' file; do
  if is_excluded "$file"; then
    continue
  fi
  relative="${file#static/assets/}"
  case "$relative" in
    gallery/thumbs/*) key="thumb/${relative#gallery/thumbs/}" ;;
    gallery/display/*) key="display/${relative#gallery/display/}" ;;
    images/thumbs/*) key="thumb/${relative#images/thumbs/}" ;;
    images/display/*) key="display/${relative#images/display/}" ;;
    img/thumbs/*) key="thumb/${relative#img/thumbs/}" ;;
    img/display/*) key="display/${relative#img/display/}" ;;
    *) key="$relative" ;;
  esac
  url="$base/$key"
  type="$(content_type "${file##*.}")"

  if [[ "$upload" == false ]]; then
    echo "PUT $bucket/$key ($type) <- $file"
    continue
  fi

  npx --yes wrangler r2 object put "$bucket/$key" \
    --file "$file" \
    --content-type "$type" \
    --remote

  printf '%s ' "$url"
  code="$(curl -sS -o /dev/null -w '%{http_code}' --head "$url?verify=$(date +%s)" || true)"
  echo "$code"
done < <(find static/assets/gallery static/assets/images -type f -print0 | sort -z)

if [[ "$upload" == false ]]; then
  echo "Dry run only. Re-run with --upload to copy these objects to R2." >&2
fi
