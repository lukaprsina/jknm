i used up the vercel free cpu limit of 4 hours/month, i want to move to cloudflare and pay monthly for workers paid (~5€/month, not done yet). changes:
- vinext/cloudflare instead of next/vercel.
- images and media. i have (realized a while back that it's only half-implemented) a backblaze b2 + cloudflare edge bandwidth alliance setup.
- `src/server/media/ingest.ts` is a problem, vinext doesn't run sharp. options:
  - cloudflare images / transformation api.
  - let the browser do client-side resizing, w `pica` or similar.
  - create a vercel hono w a sharp microservice just for the write path, replacing the need for a vps. is it possible to keep this a monorepo, as that microservice is just one api route? could be possible (nextjs 16, vercel.json and the vercel cli). the other option is that we put this into cloudflare containers if we want to stick w just cloudflare.
- we can move from backblaze b2 to r2. b2 says `jknm-gradivo` is 2GB. as i said before, the current setup is not functional, as it only creates variants for the thumbnails, not transforming the actual article images.
- and yes, d1 instead of supabase. it's postgres to sqlite, wrapped by drizzle
- anything else?

per my napkin math, this all fits on workers paid and then some. you have a cloudflare plugin installed, a shallow clone of cf docs at `/home/luka/code/repos/cloudflare/cloudflare-docs`:
- `src/content/docs/workers/platform/pricing.mdx`.
- `src/content/docs/cf/index.mdx`, the new cli subsuming wrangler. rip.
- `~/code/repos/`, `tree -d -L 2`, these are all my shallow-cloned repos for reference. other repos can be added.

my plan is to switch to `vite-plus` (voidzero also acquired by clodflare, now v1.4.0), pnpm (v12 now, oxidized w rust, fast. i prefer it over bun now). oxlint+oxfmt from biome as they come as default. run `vp -h`, it manages other package managers as shims, i use it for all my projects now.

jknm.si is now live for a few months. previously, the source of truth was a dump of 600 articles from the 2008 site, plus the hundred or so articles we made with the new site. this project is now the source of truth, all the old conversion scripts, plans and codepaths are now stale.

i'd like to make a new monorepo app via vite-plus, the cf cli and the vinext template, test it first w workers paid. then see how we can merge the new starter project structure into this repo (on a new branch), dropping all the old scripts, tools and so on, keeping the code and git history. there are things i want to update and need to diff the dirs.

possible future migrations, parked, just fyi:
- editorjs -> tiptap.
- algolia -> zbsearch (fork from the original orama team, they left the company a few months back).

research, report back, don't do anything yet. do you want to deviate in any way?