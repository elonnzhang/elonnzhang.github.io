# Personal Site Design System

## 1. Product And Visual Direction

This is a personal engineering site built with Hugo. Its primary visual language is a terminal TUI: prompt-like labels, monospace headings, compact metadata, underlined links, dashed rules, and restrained interaction feedback.

The normal web experience has two saved theme states:

- Light mode is a warm paper-like engineering notebook.
- Dark mode is a focused terminal session with phosphor-green headings.

The site should feel concise and intentional. It can be visually rich through hierarchy, typography, spacing, and functional panels, but it should not become a collection of decorative cards or unrelated effects.

## 2. Information Architecture

The primary Header navigation is fixed to this order and alignment:

Home · Blog · Clippings · Archive · About · RSS

The terminal prompt stays in a fixed-width region on the left. Navigation stays right-aligned so changing the current page name does not move the links.

The main spaces are:

- Home: landing page and the latest seven posts.
- Blog: engineering notes about Go, systems, databases, and AI tools.
- Clippings: saved external articles and related notes.
- Archive: chronological index of all blog posts.
- About: personal profile and links.
- Code Space: tool guides and reusable engineering notes.
- Ink Reader: a remote-document reader optimized for E-Ink devices.

Every primary page begins with the shared command line:

~/page-title $ ls -t

The current prompt is rendered as elonnzhang@space:~$, where space reflects the active page. The prompt width must remain stable across pages.

## 3. Home Landing Page

Home is a real landing page, not a marketing hero. The first viewport combines:

- A concise site statement about systems, code, and understanding.
- A terminal-style overview panel for the site's focus and content spaces.
- Direct actions to the latest notes and Blog.

The “最近写了什么” section intentionally keeps its existing post-list presentation. It is a dense, scannable table-like list with date, prompt marker, title, category, and summary. Do not replace it with the shared list component without a deliberate design decision.

The lower Home sections expose Clippings, Code Space, and Ink Reader as functional spaces. Use simple bordered entry blocks when they improve navigation; do not nest cards or turn every section into a floating panel.

## 4. Color Palette And Roles

The current color tokens are:

- Paper canvas: #f7f7f2.
- Light text: #1c211d.
- Light heading: #26352a.
- Terminal canvas: #111210.
- Dark surface: #171916.
- Phosphor green: #b5e853 for dark headings, accents, and focus.
- Progress green: #168a36 light / #39ff14 dark for progress and status.
- Signal blue: #00658f light / #63c0f5 dark for links.
- Editorial red: #9b3326 light accent and prompt marker.
- Rules: #b9bdb4 light / #566344 dark.
- E-Ink: pure black and white, with no color-dependent meaning.

Hex colors are intentional because the site supports Kindle and older monochrome browsers. New color syntax must not be required for the core reading experience.

The dark theme may use the local /assets/bkg.png texture. The texture is background atmosphere only and must not reduce text contrast or communicate state.

## 5. Typography

Body copy uses a local system sans stack for fast rendering and dependable CJK coverage. Headings, prompts, navigation metadata, code, and functional labels use the system monospace stack to preserve the terminal character.

- Normal desktop body: 17px with 1.75 line height.
- Normal mobile body: 16px with 1.7 line height.
- E-Ink body: 18px with 1.7 line height and a serif reading face.
- Letter spacing is always 0.
- Headings must wrap safely with long English words, URLs, and CJK text.

Do not scale font sizes directly with viewport width. Use breakpoint-specific sizes where needed.

## 6. Component Rules

- Links are primarily underlined text with a visible focus outline.
- The theme control is a 44px square icon button using the existing local inline SVG lamp mark. Do not describe it as a Lucide dependency unless the implementation actually adopts Lucide.
- Standard text navigation and pagination may use 40px minimum heights; primary controls and icon controls should target approximately 44px or more.
- Blog, Clippings, and Archive use the shared unified-list-item.html component.
- Home's latest-post list remains the separate post-list component.
- List rows are unframed, separated by thin dashed rules, and use fixed metadata columns with flexible title and summary columns.
- Dates use the readable YYYY-MM-DD format. Clippings must not expose timezone, clock, or Go time-object text in the visible list.
- Code blocks and tables scroll within their own bounds and must never widen the viewport.
- Images, videos, and iframes are constrained to their containing column.
- Reading progress is a functional fixed indicator, not decorative page chrome.

## 7. Layout And Alignment

The Header and primary content share a wide 1040px outer shell. The main article, pagination, and footer may use narrower component-specific widths where that improves reading comfort; 760px is not a universal content-column rule.

Use an 8px spacing rhythm where practical. Keep page sections unframed and full-width within the shared shell. Use borders only for individual repeated items, terminal/tool panels, forms, menus, and other genuinely framed tools.

The Header layout has these invariants:

- The prompt region is 380px wide on larger screens.
- Navigation is pushed to the right with margin-left: auto and justify-content: flex-end.
- The theme toggle is positioned at the far right without changing the prompt or navigation flow.
- At widths up to 720px, the Header wraps; navigation remains right-aligned and the prompt remains readable.

## 8. Depth And Decoration

The visual system is mostly flat and editorial. The light theme lamp control may have a small glow. The landing terminal panel may use a hard offset shadow to reinforce the terminal-tool metaphor.

Avoid:

- Decorative card grids or cards inside cards.
- Large gradients, gradient Heroes, glass effects, or bokeh decorations.
- Generic image backgrounds that obscure content.
- Shadows used to establish a page-wide elevation hierarchy.

Functional details may use small borders, hard offset shadows, or limited texture. The reading experience must remain understandable without any of them.

## 9. Modes And Accessibility

Normal web mode reads the saved theme from local storage and falls back to the system color preference. The theme switch must continue to work when storage is unavailable.

E-Ink mode is enabled by any of the following:

- ?eink=1, ?eink=true, or ?eink=yes.
- A supported Kindle or monochrome user agent.
- The optional Cloudflare Worker translating X-Eink, Eink, or Prefer request headers into ?eink=1.

?web=1 takes precedence over E-Ink preview and forced page settings. In E-Ink mode:

- Colors are forced to black and white.
- The body switches to a serif reading face.
- Transitions and animations are disabled.
- The theme button, space-switching menu, reading progress, and decorative texture are hidden or disabled.
- Code blocks, tables, and images remain readable within the viewport.
- Long documents can use the E-Ink reader's paged layout and PREV / NEXT controls.

All essential content and navigation must remain usable without JavaScript. Respect prefers-reduced-motion; animation must never be required to understand state or complete navigation.

## 10. Responsive Behavior

The main breakpoint is 720px:

- The Header wraps into prompt and navigation rows.
- Landing Hero content becomes a single column.
- Space links become a single-column list.
- Unified list rows use date, title, metadata, and summary areas that can wrap without overflow.
- Home post summaries are hidden to preserve scanability.
- E-Ink remote-document reading is not forced into paged mode on small non-Kindle screens.

Interactive targets must not collapse when text wraps. Long URLs, tables, code, titles, and metadata must use min-width: 0, wrapping, or local scrolling as appropriate.

## 11. Content And Asset Conventions

- Preserve existing public post URLs and stable slugs.
- Keep critical assets local.
- Store blog images under static/assets/img/ and clipping images under static/assets/clippings/.
- Reference local assets with root-relative paths such as /assets/img/example.png.
- Put Hugo presentation logic in layouts/, not in Markdown content.
- Prefer semantic HTML and progressive enhancement over JavaScript-only rendering.
- Do not publish local machine paths, secrets, or tokens.

## 12. Agent Prompt Guide

- Add a page using the shared ~/page-title $ ls -t command, the fixed Header shell, and the existing TUI tokens.
- Add a list item using unified-list-item.html, readable YYYY-MM-DD dates, stable columns, local overflow handling, and no decorative card surface.
- Add a Home-only latest-post feature using the existing post-list component; preserve its current visual treatment.
- Add a reading feature inside the shared shell that works without JavaScript and becomes black-on-white in E-Ink mode.
- Add an icon action using the existing local SVG treatment, a visible 2px focus outline, and no motion under reduced-motion or E-Ink conditions.
