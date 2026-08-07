# Go Change Lab

This directory contains the editable React and TypeScript source for the
static site published at `dist/`.

## Local build

```bash
npm install
npm run dev
```

The production build writes the static assets into `dist/` and copies the
generated entry file to the parent `index.html`. Jekyll visitors can therefore
open `/go-change-lab/` directly while the build output remains isolated in
`dist/`.
