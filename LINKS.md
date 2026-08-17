## script output

--kind=article is built and run. Result: 135 findings across 667 checked articles (317 legacy links inspected):

- missing_article_link (99) — the big one. Cross-references between old articles ("Cvingerska jama - dokumentiranje" linked to "Cvingerska jama - ciscenje", etc.) that never made it into the migrated content at all — not left as a stray www.jknm.si hotlink (those are already at 0 per HANDOFF.md), just silently dropped. This looks like a real migration gap, not noise.
- missing_external_link (29) — dropped third-party links: club-member mailto addresses, YouTube/Picasa photo albums, an external caving-org site. Some targets (Picasa) are dead now regardless, but they were still present in the legacy article and vanished during migration.
- missing_static_link (7) — legacy /si/publikacije/kras0N/ references that should now point at /publiciranje but don't appear anywhere in the migrated article.

Output: artifacts/link-diff-article.json (script: scripts/legacy-link-diff.ts).

One thing surfaced while building this that changes the plan: --kind=content isn't implemented. The map assumed the served mirror's static tree had the 5 evergreen pages' old content, but I checked — si/klub/default.asp, si/publikacije/default.asp, si/varstvo/default.asp etc. are all empty ASP redirect stubs, not saved HTML (e.g. klub/default.asp just redirects to klub/zgodovina/, which itself has no saved content either). There's no local legacy source to diff content-mode against. Options: live-fetch www.jknm.si directly for just these 5 pages (same site the article-mode resolve_pdf_bytes fallback already fetches live from), or drop content-mode from this script's scope. Also unresolved: is si/klub/'s content actually the zgodovina history, or a separate "about the club" page that just happens to redirect for a different reason? Worth a quick look before I guess.

Want me to live-fetch the 5 pages and build --kind=content, or leave it and move to the media-hash-diff script instead?

---

The media-hash-diff script is built and run (scripts/legacy-media-hash-diff.ts). Checked 667 articles, 4,416 legacy media refs — everything resolved successfully (served mirror or live fetch), so nothing came back unresolved.

Findings (419 total):

- missing_hash (409) — legacy image never made it into Media at all. Almost entirely concentrated in the 2024–2025 tail (legacy_id ~635–691: Kanin camps, Silvestrovanje, "Jame v Novem mestu," etc.), exactly the range the map already flagged as outside the served mirror's 2023 cutoff. The script live-fetched them from www.jknm.si directly to confirm — they're real, recoverable images that were simply never ingested during migration, not lost. Biggest single articles: "Bosna - nekaj kraških zanimivosti" (31), two "Kanin 2024/2025" reports (18 each).
- wrong_article (10) — all PDFs (DK journal issues, e.g. DK2_08_Ladisic_Jame_v_Novem_mestu.pdf), hash found in Media but not attached to this article. Worth a caveat: these look like the expected shared-file pattern already documented for 3631_cinkov_kriz.pdf — the same PDF cited by several articles, content-addressed and ingested once, attached to whichever article triggered ingestion but not the others that also link it. Not necessarily bugs, but real gaps in media_to_articles coverage for those other articles.

Output: artifacts/media-hash-diff-article.json. Also added it and link-diff-article.json to .gitignore alongside the other generated artifacts/* outputs.

That closes out all three "Remaining work" items from the wayfinder map (permalink deletion, link-diff, media-hash-diff). Nothing else queued up — want me to update the map issue with these two new scripts under Decisions so far / mark Remaining work done, or hold off since you haven't asked me to touch the tracker this session?

## deepseek report

Found it. The report is artifacts/unrecovered-legacy-media.md, produced by the dry-run of scripts/recover-legacy-media-from-served-mirror.ts (a follow-up to scripts/rescue-stale-media.ts). Re-running with --limit 1 against each legacy_id is how you'd regenerate the list.
Now the bucket findings — I checked all 23 refs against the synced artifacts\s3-jknm:
Recoverable — the bytes are in this bucket (15 refs):
- legacy_id 637 Radeščica (13 jpgs) — all present, but under cistilna-akcija-vvo-izvira-radescice-2-06-02-2024/ (the stale URLs reference a different slug, so the mirror-match failed). Not actually lost.
- 633 — dk8_43_presetnik...pdf exists as DK8_43_Presetnik__Hudoklin_Tri_desetletja_spremljanja_zatocisc_netopirjev.pdf (case + double-underscore differ).
- 75 — 2577_pihalnik.pdf exists, but in nova-odkritja-v-pihalniku-14-04-2021/ (different article folder).
Still genuinely gone (6 refs):
- 637: v_dveh_dneh_izvlekli_za_tri_kontejnerje_smeti_dl_13_15_2_2024.pdf and vrelec_296_str_15.png — not in the bucket.
- 116: 851_pecenevka.pdf, 145: 669_ledena_kunc.pdf, 107: 4669_solnovo.pdf, 500: dk7_23_prsina_razkrita_skrivnost_jame_na_cvingerju.pdf — their article folders are there but contain no PDF.
Not media (2 refs): the 606 .../si and .../sidg.si/ hrefs are malformed link fragments, correctly flagged for the www.jknm.si link cleanup instead.
So the bucket resolves 15 of the 23; 6 files appear to be unrecoverable, and 2 were never media.

---

# older

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