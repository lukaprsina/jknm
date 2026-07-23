# Self-host on Hetzner via Kamal, deferred

> **Status (2026-07-23): superseded/on hold, not the current plan.** The maintainer has decided
> to stay on Next.js + Vercel + Supabase for the summer — no VPS/self-hosting migration in this
> window. `vercel.json` (crons, no Docker/Kamal config) and the absence of any `standalone`
> output wiring confirm the code has not moved either. This ADR's *approach*, if self-hosting is
> ever revisited, is still the recorded answer — nothing below is retracted — but treat every
> "once executed" / "what would change the answer" reference elsewhere in `docs/` (ADR-0005,
> ADR-0006) as pointing at a deferred, not scheduled, trigger.

The rewritten app currently runs on **Vercel + Supabase**, and stays there for the near-term production push. Separately, issue #10 already resolved the *future* self-hosting approach: **Hetzner + Kamal + self-hosted Postgres, all on one VPS**, to eliminate Vercel's cold starts. This ADR records that decision so it doesn't need re-litigating later — it does not change anything about the current Vercel/Supabase deployment.

**Provider**: Hetzner — cheap EU compute, good latency fit for a Slovenian-audience site.

**Platform**: Kamal (37signals), not a PaaS dashboard (Dokploy/Coolify/CapRover). All three dashboard options were compared and cost ~0.8–1.7GB idle RAM before the app even runs, for a platform daemon this project doesn't need. Kamal has no persistent daemon — it SSHes in on deploy and gets out of the way — so it costs nothing at idle.

**Build**: images are built in GitHub Actions (`docker/build-push-action` → GHCR), not on the VPS and not via Kamal's own remote-builder option. This keeps `next build`'s memory spikes off the box entirely.

**Deploy / reverse proxy / TLS**: `kamal deploy` over SSH pulls the pre-built image; `kamal-proxy` (bundled in Kamal 2) handles the zero-downtime container swap and automatic Let's Encrypt TLS — no separate nginx/Traefik.

**Deployment model**: one Kamal-managed stack on the VPS — the Next app (`standalone` output) plus self-hosted Postgres and the pg-boss worker (#11) as Kamal accessories, all colocated.

**Database**: Postgres moves off Supabase onto the VPS, colocated with the app and the pg-boss worker — avoids Supabase's free-tier shape (pause-on-inactivity, connection caps, egress) and the network hop between a VPS worker and an off-box DB.

**Cloudflare**: sits in front as DNS + CDN, proxied at the VPS's IP — consistent with #12's media-routing-through-Cloudflare decision.

**CI/CD**: two GitHub Actions workflows — build-and-push to GHCR, then a release workflow running `kamal deploy`.

## Considered Options

- **Dokploy / Coolify / CapRover** (PaaS dashboards) — rejected: Dokploy is the lightest of the three (native Compose support, lowest idle RAM) but every dashboard option still costs meaningful idle RAM for a platform daemon this single-app project doesn't need.
- **Kamal's own remote builder** (build on the VPS) — rejected: `next build`'s memory spikes would hit the box that's supposed to stay small; GitHub Actions builds keep that off-box.
- **Keep Postgres on Supabase after self-hosting the app** — rejected: defeats the point of colocating the app and worker with the DB, and keeps the free-tier constraints (pause-on-inactivity, connection caps, egress) this move is meant to escape.

## Consequences

- No code or environment changes happen now — this is a recorded decision for when self-hosting is actually executed, not a migration in progress.
- Once executed: backups/upgrades/monitoring for Postgres become self-managed (`pg_dump` cron + off-site copy) instead of Supabase-managed — accepted trade-off for eliminating cold starts and the DB network hop.
- Provisioning itself (buying the VPS, writing the `deploy.yml`, wiring the GitHub Actions workflows) is separate, later work — this ADR only fixes the *approach*.

_Full rationale: wayfinder ticket #10 (github.com/lukaprsina/jknm/issues/10)._
