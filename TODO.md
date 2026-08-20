# TODO

- make arhiv year histogram less rounded
- 

## links

- legacy_id 642: 13 images DINOv2 flagged no_match — manual review
- legacy_id 210/264/305/356: `.doc`/`.xls` attachments under image path scheme — confirmed no fix needed, not an image so media-hash-diff's magic-byte check doesn't apply.
- 606: fixed by admin (malformed old-host partner links corrected).
- 637: fixed by admin (old-host inline links + media corrected, better images uploaded).

- 642: completely wrong text and images on my site, i'll fix it myself. the current content is from `https://jknm-si.vercel.app/novica/jamarske-raziskave-v-obori-stari-log`.
- 662: fixed by admin via editor.
- 667: intentional drop, confirmed by admin.
- 659/663/664 (wrong_article, shared DK journal PDFs): all already on working hosts, no rewrite needed. Reconciled `media_to_articles` for all 3 directly (2026-08-20) so each owns its own join row and survives `sweep-stale-content.ts` regardless of the other citing article.
- Zgodovina/Varstvo static-page hotlinks: fixed 2026-08-20 (`scripts/fix-static-page-links.ts`) — 8 `kras01`-`08` journal-issue PDFs (Zgodovina) + 21 DK/pdf links (Varstvo) ingested into `gradivo.jknm.org` and rewritten. Klub's self-link was already fixed by hand. See `docs/research/legacy-migration-notes.md`.


## later

- submit sitemap to bing webmaster and indexnow. AIs use bing.
- check whether `card.tsx`'s `is_legacy_hit` branch (old S3 `thumbnail.png` path convention for legacy Algolia hits) is still needed — thumbnails were migrated at some point, this branch might be dead like the permalink one was
