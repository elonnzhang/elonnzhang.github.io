# Layout Guide

Templates define the presentation of the Hugo site. The visual system is a terminal TUI: monospace prompts, restrained colors, compact metadata, underlined links, and thin separators.

## Structure

- _default/baseof.html is the global HTML shell.
- _default/single.html renders single pages and articles.
- _default/list.html renders section list fallbacks.
- index.html renders the Home landing page.
- partials/ contains reusable Header, page command, article, pagination, and list components.

## TUI rules

- Primary pages begin with the shared page command format: ~/page-title $ ls -t.
- The Header prompt reflects the current page, for example home, blog, clippings, archive, or about.
- Keep the Header prompt in a fixed-width region and keep navigation right-aligned.
- Blog, Clippings, and Archive use unified-list-item.html. Home's 最近写了什么 list intentionally keeps its existing post-list presentation.
- Keep layouts semantic and usable without JavaScript.
- Use relURL, RelPermalink, or Hugo resource URLs for local links and assets.

## Modes

- Normal mode follows the saved theme or system preference.
- eink=1 enables monochrome E-Ink styling.
- web=1 takes precedence over forced E-Ink settings.
- Kindle and monochrome user agents should continue to receive the E-Ink experience.

