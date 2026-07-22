## Agent skills

### Issue tracker

Issues live in GitHub Issues for lukaprsina/jknm (uses the `gh` CLI); external PRs are not pulled into triage. See `docs/agents/issue-tracker.md`.

### Triage labels

Default label vocabulary (needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout (CONTEXT.md + docs/adr/ at the repo root). See `docs/agents/domain.md`.

### Vendored upstream sources

Some dependencies are vendored as git submodules under `vendor/` (currently `fumadocs`,
`better-auth`) so their **documentation and source can be read as primary sources** rather
than recalled or fetched. Run `git submodule update --init` if `vendor/` is empty.

Prefer these over memory or the web when answering a question about one of these libraries,
and cite the repo-relative path. Where the vendored docs are ambiguous or self-contradictory,
check the package's `src/` and `package.json` — that has already settled at least one
question the docs got wrong (see the pre-flight comment on #32).
