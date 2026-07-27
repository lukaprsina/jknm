# TODO

- submit sitemap to bing webmaster and indexnow. AIs use bing.
- >[browser] Detected `scroll-behavior: smooth` on the `<html>` element. To disable smooth scrolling during route transitions, add `data-scroll-behavior="smooth"` to your <html> element. Learn more: https://nextjs.org/docs/messages/missing-data-scroll-behavior
- https://gemini.google.com/app/fe2c72a3af40444e (seo for domain switch)
- improve mobile
- osnutka dva reš še slike in objav
- statične bold zgodovina **
- tanstack form
- TOC article add H1 too

>image uploading on vercel still doesn't work.

## Research content migration strategy for B2 bucket
1. good to crash, we'll get there when we get there. it only has to run once.
2. ok, but i can attest that every old article is published, verified a few days ago.
3. currently, every row in article_slugs is primary, no renames yet. but yeah, i think we have a util function for that in `src\server\article\lifecycle-rules.ts`.
4. all article links have the shape `https://www.jknm.si/si/?id=623&l=2016`, nothing else. id is mandatory, l(eto) is optional and if missing, gets 308d to the year of the article. however, the year only controls the sidebar (which "year" accordion is open) and doesn't have to match the article's year at all.

you can pull the raw matches, save them to a file in `artifacts`.