# TODO

- submit sitemap to bing webmaster and indexnow. AIs use bing.
- >[browser] Detected `scroll-behavior: smooth` on the `<html>` element. To disable smooth scrolling during route transitions, add `data-scroll-behavior="smooth"` to your <html> element. Learn more: https://nextjs.org/docs/messages/missing-data-scroll-behavior
- https://gemini.google.com/app/fe2c72a3af40444e (seo for domain switch)
- improve mobile
- osnutka dva reš še slike in objav
- statične bold zgodovina **
- TOC article add H1 too

tysm, another thing. in my TOC system, i have h2s and h3s in an aside, but the main h1 is missing, you can't navigate to the top. it's guaranteed that an article's first h1 is at the top and that it's the only one (otherwise you can't publish), but you can also use the Article.title from the db.

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