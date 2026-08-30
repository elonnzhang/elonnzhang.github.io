# Content Guide

This directory contains all Hugo Markdown content. Keep presentation logic in layouts/.

## Sections

- posts/ contains Blog articles. posts/_index.md owns the Blog page at /blog/.
- clippings/ contains saved external articles and its list page.
- code-space/ contains tool guides and its index page.
- Root pages such as about.md, archive.md, and ink-reader.md are standalone pages selected by pageKind.

Do not create a second content/blog section. Blog articles stay in content/posts/ and the posts section owns the /blog/ entry point.

## Front matter

Blog posts should have title, date, stable slug, categories, tags when useful, and a short description. Clippings use published and created dates; the list template prefers published and displays dates as YYYY-MM-DD.

Use draft: true for unfinished content. Do not put template placeholders in published front matter.

## Content conventions

- Preserve article slugs and add aliases when an old URL needs compatibility.
- Use Markdown headings, fenced code blocks, tables, and links normally.
- Use /assets/... or another root-relative URL for local images.
- Do not use Obsidian embeds or Jekyll Liquid tags in published Hugo content.
- Keep source attribution in clipping front matter or article content.

