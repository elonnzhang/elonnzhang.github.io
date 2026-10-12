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

Articles that belong to a series use `series` as a stable lowercase slug (for example, `adk`) and a numeric `series_order`. Keep each `series_order` unique within its series. The main Blog list places each series at the date of its newest member and lists its members together by `series_order`; other articles remain ordered by `date`. Series collection views also order members by `series_order`. Collection pages and draft article templates are navigation or authoring aids, not series members, so do not add `series` or `series_order` to them.

Use draft: true for unfinished content. Do not put template placeholders in published front matter.

## ADK source-reading series

- The shared source baseline is ADK-Go `v2.4.0` (commit `4e57df40cbd35f055ba654b03ffb0e509fdd754a`). Read the tag, not a moving main branch or local modifications; pin source links to `blob/v2.4.0/`.
- The collection is `posts/adk.md` at `/blog/adk/`. It is not itself a series member. Track which existing articles have actually been checked against the baseline; do not relabel an unchecked article as verified.
- ADK member articles use `series: adk`; assign their numeric `series_order` according to the reading order in `posts/adk.md`. That article directory is the source of truth for the current ADK sequence.
- New articles start from `posts/adk-source-reading-template.md`, which stays `draft: true`, is not a series member, and is not linked as a live page from published content.
- Keep the shared outline: source map; interfaces/data; execution/data/event flow; details; architecture/boundaries; purpose/trade-offs; takeaways; references. Preserve useful original source comments and distinguish excerpts from pseudocode.
- `posts/2026-09-20-adk-flow.md` is the first article using this outline and baseline. Preserve existing article slugs during migration.

## Content conventions

- Preserve article slugs and add aliases when an old URL needs compatibility.
- Use Markdown headings, fenced code blocks, tables, and links normally.
- Use /assets/... or another root-relative URL for local images.
- Hand-drawn callouts use the `ann` shortcode (neat-annotations). Example: `{{</* ann n amber "no refresh needed" */>}}in real time{{</* /ann */>}}`. Directions: n ne e se s sw w nw. Colors: amber blue green red purple rainbow.
- Do not use Obsidian embeds or Jekyll Liquid tags in published Hugo content.
- Keep source attribution in clipping front matter or article content.
