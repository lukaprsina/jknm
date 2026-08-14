## Agent skills

### Issue tracker

Issues live in GitHub Issues for lukaprsina/jknm (uses the `gh` CLI); external PRs are not pulled into triage. See `docs/agents/issue-tracker.md`.

### Triage labels

Default label vocabulary (needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout (CONTEXT.md + docs/adr/ at the repo root). See `docs/agents/domain.md`.

### Vendored upstream sources

Some dependencies are vendored as git submodules under `vendor/` so their **documentation and source can be read as
primary sources** rather than recalled or fetched. Run `git submodule update --init` if `vendor/` is empty.

Prefer these over memory or the web when answering a question about one of these libraries,
and cite the repo-relative path. Where the vendored docs are ambiguous or self-contradictory,
check the package's `src/` and `package.json` — that has already settled at least one
question the docs got wrong (see the pre-flight comment on #32).

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
