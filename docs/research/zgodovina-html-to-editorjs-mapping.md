# Zgodovina HTML → EditorJS block mapping (#36)

Derived by reading `src/app/(static)/zgodovina/content.mdx` (973 lines) in full and
inventorying every element it renders, cross-checked against the app's own toolbox
(`src/components/editor/plugins.ts`) and `@editorjs/list`'s type definitions. This is
the block-shape table the deterministic converter (still to be written) implements
against.

## Source element inventory (zgodovina only)

- 1× `<h1>` — page title.
- 22× `<h2>` — era section headings.
- Several `<h3>Pomembnejša odkritja</h3>` and further `<h3>` subsections.
- 156 `<li>` inside `<ul>` — every one carries inline `<b>`/`<a>`, occasionally `<sup>`.
- 94 `<Image>` MDX components, rendered (`src/components/image-with-caption.tsx`) as
  `<figure><picture>[<source type="image/avif">]<img src width height></picture>[<figcaption>caption</figcaption>]</figure>`.
- 10× `<sup>3</sup>` (cubic-meter units), plain passthrough text.
- Plain `<p>` paragraphs between list sections.
- 0 tables, 0 blockquotes, 0 ordered lists, 0 code blocks in zgodovina specifically.

## Mapping table

| Source | EditorJS block | data shape | Notes |
|---|---|---|---|
| container's own `<h1>` | *(skip)* | — | `create_draft` already seeds a `header` (level 1) block from the page title; converting the page's own `<h1>` too would duplicate it. |
| `<h2>text</h2>` | `header` | `{ text: "<inline-html>", level: 2 }` | `text` keeps inline `<b>`/`<a>` as raw HTML. |
| `<h3>text</h3>` | `header` | `{ text, level: 3 }` | |
| `<p>...</p>` | `paragraph` | `{ text: "<inline-html>" }` | |
| `<ul><li>...</li></ul>` | `list` | `{ style: "unordered", items: [{ content: "<inline-html>", meta: {}, items: [] }] }` | **Non-obvious**: `@editorjs/list@2.0.9` (the version pinned in `package.json`) uses the *new* nested-item shape (`ListItem[]`, fields `content`/`meta`/`items`) confirmed from `node_modules/@editorjs/list/dist/types/ListParams.d.ts` — not the old flat `items: string[]` shape some docs/examples online still show. Writing the old shape would silently fail to render/edit correctly. |
| `<figure><picture>...<img src=".../X.jpg">...</picture><figcaption>caption</figcaption></figure>` | `image` | `{ caption, file: { url, width?, height? }, stretched?, withBorder? }` | The rendered `<img src>` is the **un-rewritten `https://vsebina.jknm.org/<path>` hotlink** (`CONTENT_DOMAIN` in `image-with-caption.tsx`) — this is the same re-ingestion problem `pdf-postpass.ts` already solves for PDFs, not a separate case. Ingest via `ingest_media_from_url(img_src)` and use the returned media row for `file.url`/dimensions. Ignore the sibling `<source type="image/avif">` — that's a locally generated optimization variant (`scripts/optimize-static-content-images.ts`), not a canonical source to re-ingest. |
| `<a href="https://vsebina.jknm.org/media/pdf/*.pdf">` inside any block above | stays inline, href rewritten | — | Exactly `pdf-postpass.ts`'s existing regex/logic (`https://vsebina\.jknm\.org/[^"'\s\\<>)]+\.pdf`) — reuse unmodified as a second pass after block conversion, not reimplemented. |
| `<a href="/novica/...">` (internal, relative) | stays inline, untouched | — | Already correct — these are links to real published articles, not media. |
| `<b>` / `<sup>` inline elsewhere | passthrough, untouched | — | `plugins.ts`'s `superscript` inline tool sanitizes to bare `sup: {}`, so raw `<sup>` is valid stored HTML already — no conversion step needed. The default sanitizer already allows `<b>`/`<a>` (every existing paragraph/header block relies on this). |

## Not covered by zgodovina — seen in the other 4 pages, still fog

- Markdown tables (`publiciranje/content.mdx`, cells padded with `&nbsp;` suggesting merged-cell intent) → `table` block. Lossy-conversion risk already flagged in `docs/research/static-sites-to-articles-migration.md`; needs its own decision before `publiciranje` is converted. Out of scope for the zgodovina pilot.
- Grepping every `<...` tag across all 5 `content.mdx` files turned up only `<Image>` and `<sup>` as raw JSX/HTML — so the remaining 4 pages are expected to need no block type beyond header/paragraph/list/image, plus the table case above for `publiciranje` alone.

## Rendering approach (confirms, and simplifies, the "no separate render step" decision)

Since `/zgodovina` etc. are ordinary Next.js **server components**, a plain `fetch(url)`
against a running `next dev`/`next start` server already returns fully server-rendered
HTML — no browser or JS execution needed at all, not even headless. This is simpler than
either Playwright mode considered earlier: no browser, just an HTTP GET + `node-html-parser`.
(The sandbox's no-localhost-network constraint noted in `HANDOFF-content-migration.md`
blocks *testing* this from the agent's environment, not writing or running it — the
script runs against a `next dev` server on the user's own machine, where `fetch` and
`next dev` are on the same host.)
