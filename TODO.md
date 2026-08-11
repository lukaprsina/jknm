# TODO

- submit sitemap to bing webmaster and indexnow. AIs use bing.
- improve mobile
- TOC for articles doesn't work

```
/novica/jamarski-tecaj-2009 legacy_id=56	#19	„Izobraževanje"	.../si/izobrazevanje/
/novica/jamarski-tecaj-2021 581	#1	„program jamarske šole"	.../si/izobrazevanje/program/
/novica/jamarski-tecaj-2022 603	#1	„program jamarske šole"	same
/novica/jamarski-tecaj-2023 620	#1	„program jamarske šole"	same
/novica/jamarski-tecaj-2024 636	#1	„program jamarske šole"	same
/novica/jamarski-tecaj-2025 675	#1	„program jamarske šole"	https:// variant
```

## Dead `www.jknm.si` static-page links left in article content (intentionally, for now)

Per `scripts/audit-article-hotlinks.ts`, 27 refs across 16 articles still link
old-site pages that were never migrated (admin intentionally left these out —
they're outdated). Leaving the surrounding paragraphs alone rather than
stripping the links. `article-link` (13 refs, `/si/?id=N`) and `media-file`
(6 refs, old `/media/...pdf`) were handled separately — this is just the
plain static-page-link category:

- `/si/etc/impresum/` — legacy_id 142, 202, 356, 305, 264 (Jamarski tečaj 2010-2014)
- `/si/izobrazevanje/(program/)` — legacy_id 56, 581, 603, 620, 636, 675 (table above)
- `/si/publikacije/kras01/` through `kras05/` and bare `/si/publikacije/` —
  legacy_id 300 ("Publikacije Dolenjski kras", all 5 in one article) and
  legacy_id 504 ("Izšel je Dolenjski kras 7", links the bare index).
  **kras01 is getting self-hosted** — when that lands, revisit 02-05 too,
  same series.
- `/si/jame/naj/?v=najgloblje` and `?v=najdaljse` — legacy_id 95 ("Šumeča
  polšna - sklepno dejanje [3]")
- `/si/raziskovanje/grmec/` — legacy_id 167 ("Bosna 2010")

## Title renames

129, 358, 240, 351, 579, 624

75 → ours — mostly Slovene casing after a dash/on "Rog(a/u)" (legacy is inconsistently lowercase, ours is consistently capitalized as the proper noun it is), house-style dash vs en dash, [2]-bracket vs roman numeral, or a year/series-prefix the admin clearly added on purpose.
6 → legacy (real regressions worth fixing):
351, 240 — ours literally contains an unescaped HTML entity (&gt;, &amp;) baked into the title text — a migration bug, not an edit.
358 — ours has ponavljavci, legacy has the standard Slovene word ponavljalci — looks like a typo introduced during migration.
579 — legacy's sistem Pihalnika (genitive) is grammatically correct; ours (sistem Pihalnik) reads like a dropped case ending.
624 — legacy has an extra Županove jame at the end that ours is missing entirely — looks like an accidental truncation.
129 — ours (Ne me j****) reads like profanity-filter corruption vs legacy's Ne me J. — flagged for you to check against the article body since I can't tell intent from the title alone.
2 flagged ours (VERIFY), not confident either way:
488 — nad vs pod mostom (above/below the bridge) — opposite prepositions, can't tell which is right without checking the article/photos.
621 — Labodnico vs Labadnico — I guessed ours is the corrected spelling but didn't verify against any independent source.

## Next

The remaining older open threads, still just sitting in TODO.md, not urgent:
kras01–kras05 static-page links — waiting on you to self-host kras01.
The izobrazevanje paragraph links — your own manual edit, not mine.
The 23 unresolved stale-media refs — no further automated recovery path.