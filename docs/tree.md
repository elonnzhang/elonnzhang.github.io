# Project Structure

This repository is a Hugo static site with a terminal TUI visual language. The site is built by GitHub Actions and published to GitHub Pages. jiabin.dev is the canonical domain, while elonnzhang.github.io remains an available entry point for the same site.

## Directory Tree

The tree below lists the project structure and omits Git internals, dependency directories, and individual generated article or image files where a pattern is clearer.

~~~text
elonnzhang.github.io/
├── .github/
│   ├── AGENTS.md                         Repository automation rules
│   └── workflows/
│       └── hugo.yml                      Build and deploy workflow
├── .obsidian/                            Obsidian workspace settings
├── .vscode/
│   └── settings.json                     VS Code settings
├── assets/                               Hugo Pipes source assets
│   ├── AGENTS.md
│   └── css/
│       ├── main.scss                     SCSS entry point
│       ├── _base.scss                    Base layout and component styles
│       ├── _default_colors.scss           Light and dark theme colors
│       └── _rouge-base16-dark.scss       Code highlighting colors
├── cloudflare/                           Optional Cloudflare integration
│   ├── AGENTS.md
│   ├── worker.js                          Header-to-query E-Ink switch
│   └── wrangler.toml                      Worker configuration
├── content/                              Markdown content source
│   ├── AGENTS.md
│   ├── posts/                             Blog section
│   │   ├── _index.md                      /blog/ section page
│   │   └── *.md                           Blog posts
│   ├── clippings/                         Clippings section
│   │   ├── _index.md
│   │   └── *.md                           Saved articles and notes
│   ├── code-space/                        Code Space section
│   │   ├── _index.md
│   │   ├── claude_code.md
│   │   └── codex.md
│   ├── about.md                            About page
│   ├── archive.md                          Archive page
│   ├── ink-reader.md                       E-Ink reader page
│   └── 404.md                              Not-found page
├── data/
│   ├── AGENTS.md
│   └── site.yaml                           Shared site navigation data
├── docs/
│   └── tree.md                             This structure guide
├── go-change-lab/                          Independent Vite/React project
│   ├── src/                                TypeScript and React source
│   ├── scripts/                            Build helper scripts
│   ├── public/                             Vite public assets
│   ├── dist/                               Vite build output
│   ├── package.json                         Node.js scripts and dependencies
│   ├── package-lock.json                    Locked dependency versions
│   ├── postcss.config.mjs                   PostCSS configuration
│   └── vite.config.ts                       Vite configuration
├── layouts/                                Hugo templates
│   ├── AGENTS.md
│   ├── _default/
│   │   ├── baseof.html                      Global HTML shell
│   │   ├── list.html                        Section list fallback
│   │   └── single.html                      Single page dispatcher
│   ├── partials/
│   │   ├── head.html                        Metadata, CSS, theme initialization
│   │   ├── header.html                      Prompt, space switcher, navigation
│   │   ├── footer.html                      Site footer
│   │   ├── seo.html                         SEO metadata and canonical links
│   │   ├── page-command.html                ~/page-title $ ls -t heading
│   │   ├── post.html                        Blog and clipping article layout
│   │   ├── blog-index.html                  Blog index layout
│   │   ├── clippings-index.html             Clippings index layout
│   │   ├── archive.html                     Archive layout
│   │   ├── code-space-index.html            Code Space index layout
│   │   ├── code-space-doc.html              Code Space document layout
│   │   ├── ink-reader.html                  E-Ink reader layout
│   │   ├── unified-list-item.html           Shared list item component
│   │   └── pagination.html                  Section pagination
│   └── index.html                           Home landing page
├── resources/                               Hugo Pipes cache
│   └── _gen/                                Generated resource files
├── scripts/                                 Reserved project scripts directory
├── static/                                  Files copied unchanged to the site
│   ├── CNAME                                GitHub Pages custom-domain marker
│   ├── assets/
│   │   ├── img/                             Blog images
│   │   ├── clippings/                       Clippings images
│   │   ├── fonts/                           Local fonts
│   │   ├── images/                          Shared visual assets
│   │   └── js/                              Browser-side JavaScript
│   └── go-change-lab/                       Published Go Change Lab files
│       ├── index.html
│       ├── favicon.svg
│       └── assets/
├── public/                                  Hugo build output
│   ├── index.html                           Home page
│   ├── blog/                                /blog/ output
│   ├── clippings/                           Clippings output
│   ├── archive/                             Archive output
│   ├── about/                               About output
│   ├── code-space/                          Code Space output
│   ├── go-change-lab/                       Copied Vite application
│   ├── assets/                              Published static assets
│   ├── index.xml                            Home RSS feed
│   ├── sitemap.xml                          Sitemap
│   ├── robots.txt                           Robots rules
│   └── CNAME                                Published domain marker
├── AGENTS.md                                Repository-wide instructions
├── CNAME                                    Custom-domain configuration
├── DESIGN.md                                Visual and interaction design notes
├── README.md                                Project overview
├── .gitignore                               Ignored generated and local files
└── hugo.yaml                                Hugo site configuration
~~~

## Source Directories

### content/

Markdown pages and posts are the site's source content. Presentation logic belongs in layouts/, not in content files.

- content/posts/ contains blog articles. Keeping _index.md here makes the posts section own the /blog/ page while article URLs continue to use their stable short slugs.
- content/clippings/ contains saved articles and related notes.
- content/code-space/ contains tool guides and the Code Space index.
- Root-level Markdown files such as about.md, archive.md, and ink-reader.md are standalone pages selected by their pageKind front matter.

### layouts/

Hugo templates implement the terminal-style interface. _default/baseof.html provides the shared document shell, while _default/single.html and _default/list.html dispatch content to the appropriate partial.

The shared partials keep page formats consistent:

- head.html loads the compiled stylesheet, SEO metadata, theme state, and E-Ink initialization.
- header.html renders the fixed-width terminal prompt, space switcher, right-aligned navigation, and theme control.
- page-command.html renders the common ~/page-title $ ls -t command line.
- unified-list-item.html is used by Blog, Clippings, and Archive lists.
- Home's “最近写了什么” list intentionally remains its own post-list presentation.

### assets/

Files in assets/ are processed by Hugo Pipes. assets/css/main.scss is compiled, minified, and fingerprinted by layouts/partials/head.html.

### static/

Files in static/ are copied to the generated site without Hugo processing. Article images are stored under static/assets/img/, clipping images under static/assets/clippings/, and browser scripts under static/assets/js/. A Markdown file can reference them with root-relative paths such as /assets/img/example.png.

### go-change-lab/

This is an independent Vite/React/TypeScript source project and is intentionally kept at the repository root. Its production build is copied into static/go-change-lab/, so the deployed application is available at /go-change-lab/.

## Configuration And Deployment

- hugo.yaml defines the canonical URL, content sections, permalinks, taxonomies, output formats, and site parameters.
- .github/workflows/hugo.yml installs Hugo Extended, builds go-change-lab, copies its dist/ output into static/go-change-lab/, builds Hugo, and deploys public/ to GitHub Pages.
- CNAME declares jiabin.dev for GitHub Pages. The generated public/CNAME is the file that reaches the deployment artifact.
- cloudflare/ contains an optional Worker that can translate an E-Ink request header into the ?eink=1 query convention.

## Generated Directories

- public/ is the final Hugo output. It can be inspected locally but should not be edited by hand.
- resources/_gen/ contains Hugo Pipes cache files and is regenerated when assets are processed.
- go-change-lab/dist/ is generated by Vite from the go-change-lab/ source project.

## URLs And Modes

The same GitHub Pages deployment can be reached through both domains:

~~~text
https://jiabin.dev/
https://elonnzhang.github.io/

https://jiabin.dev/blog/
https://jiabin.dev/clippings/
https://jiabin.dev/archive/
https://jiabin.dev/about/
https://jiabin.dev/go-change-lab/
https://jiabin.dev/hello?eink=1
https://jiabin.dev/hello?web=1
~~~

Normal web mode uses the saved theme or system preference. E-Ink mode is enabled by ?eink=1, by the supported request header through the optional Cloudflare Worker, or automatically for compatible Kindle user agents. ?web=1 explicitly takes precedence and returns to normal web mode.

## Common Commands

Build the production site:

~~~bash
hugo --gc --minify
~~~

Build the Go Change Lab application:

~~~bash
cd go-change-lab
npm ci
npm run build
~~~

Run the deployment-style build locally:

~~~bash
cd go-change-lab
npm ci
npm run build
cd ..
cp -R go-change-lab/dist/. static/go-change-lab/
hugo --gc --minify
~~~

Check the working tree and generated output:

~~~bash
git diff --check
hugo --gc --minify --destination /tmp/elonnzhang-hugo-check
~~~
