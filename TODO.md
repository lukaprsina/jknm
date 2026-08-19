# TODO

- legacy_id 534 (Obisk Mihovške jame): `slika_5.JPG` dead on legacy site (fake-200 error page) — likely actually lost
- legacy_id 642/657/666/677/685: 13 images DINOv2 flagged no_match — manual review
- legacy_id 210/264/305/356: `.doc`/`.xls` attachments under image path scheme, unresolved by media-hash-diff — decide if these need fixing

- 606: media is fixed; two malformed old-host partner links remain in the body.
- 637: media is fixed; two old-host inline links (Dolenjski list and Vrelec) remain.

- 534: okay, legacy img src was `/media/img/novice/2019/slika_5.JPG`, image exists at `/media/img/novice/2019/01/slika_5.JPG`. fixed on my site.
- 637: admin needs to upload the better images.
- 642: completely wrong text and images on my site, i'll fix it myself. the current content is from `https://jknm-si.vercel.app/novica/jamarske-raziskave-v-obori-stari-log`.
- 657: okay, one screenshot of the topodroid is different.
- 666: okay.
- 677: okay, two images were intentionally replaced.
- 685: okay, image dropped intentionally.


>https://www.jknm.si/si/?id=637
>https://jknm-si.vercel.app/si/?id=637
## later

- submit sitemap to bing webmaster and indexnow. AIs use bing.
- check whether `card.tsx`'s `is_legacy_hit` branch (old S3 `thumbnail.png` path convention for legacy Algolia hits) is still needed — thumbnails were migrated at some point, this branch might be dead like the permalink one was
