Preserving search rankings during a domain and architecture migration is critical—especially when holding top search results for Slovenian caving.

---

## 1. Which HTTP Redirect Status Code to Use?

### **Recommendation: HTTP 308 or HTTP 301** (Both are equal for SEO)

* **HTTP 301 (Moved Permanently):** The legacy standard. Google transfers 100% of link equity, PageRank, and canonical signals through a 301 redirect.
* **HTTP 308 (Permanent Redirect):** The modern HTTP standard counterpart to 301. It preserves the HTTP request method (e.g., GET requests remain GET).
* **What Next.js does:** Next.js built-in functions like `permanentRedirect()` issue an **HTTP 308**.
* **SEO Impact:** Google Search Advocate John Mueller has repeatedly confirmed that **Google Search treats 308 redirects identically to 301 redirects** for indexing and link equity.

> **Verdict:** Use **308** (Next.js default `permanentRedirect()`) or **301** (via Route Handlers). Both pass full SEO ranking power.

---

## 2. Options Ranking for Next.js 16 (App Router)

Since old URLs look like `/si/?id=690`, you need to extract query parameter `id`, look up `oldId` in PostgreSQL via Drizzle ORM, and issue a permanent redirect to `/novica/<slug>`.

Here is how the options rank:

### 🥇 **Rank 1: Server Page (`src/app/si/page.tsx`) — RECOMMENDED**

In Next.js 15+, `searchParams` on Server Components is an asynchronous `Promise`. You can handle the DB lookup directly inside a Server Component in Node.js runtime.

* **Pros:** Standard Node.js runtime (no Edge DB connection issues with Drizzle), fast, native Next.js pattern, zero extra infrastructure.
* **Cons:** None.

```tsx
// src/app/si/page.tsx
import { permanentRedirect, redirect } from 'next/navigation';
import { db } from '@/db'; // Your Drizzle DB instance
import { posts } from '@/db/schema';
import { eq } from 'drizzle-orm';

interface Props {
  searchParams: Promise<{ id?: string }>;
}

export default async function LegacySiRedirectPage({ searchParams }: Props) {
  const { id } = await searchParams;

  if (id) {
    const oldArticleId = parseInt(id, 10);
    
    if (!isNaN(oldArticleId)) {
      // Query Drizzle DB by oldId
      const article = await db.query.posts.findFirst({
        where: eq(posts.oldId, oldArticleId),
      });

      if (article?.slug) {
        // Sends HTTP 308 Permanent Redirect to Google & browsers
        permanentRedirect(`/novica/${article.slug}`);
      }
    }
  }

  // Fallback if no ID or article not found: redirect to news archive or home
  redirect('/novica');
}

```

---

### 🥈 **Rank 2: App Router Route Handler (`src/app/si/route.ts`)**

Instead of a page, you create an explicit API endpoint to handle requests to `/si`.

* **Pros:** Allows hardcoding an explicit `301` status code using `NextResponse.redirect(url, 301)` if you prefer strictly `301` over Next's default `308`.
* **Cons:** Replaces the page segment at `/si`.

```ts
// src/app/si/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { posts } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const idStr = searchParams.get('id');

  if (idStr) {
    const oldArticleId = parseInt(idStr, 10);
    if (!isNaN(oldArticleId)) {
      const article = await db.query.posts.findFirst({
        where: eq(posts.oldId, oldArticleId),
      });

      if (article?.slug) {
        // Explicit 301 Permanent Redirect
        return NextResponse.redirect(
          new URL(`/novica/${article.slug}`, request.url),
          301
        );
      }
    }
  }

  return NextResponse.redirect(new URL('/novica', request.url), 301);
}

```

---

### 🥉 **Rank 3: Proxy / Middleware (`proxy.ts`)**

Intercepting requests at the proxy level before hitting page routes.

* **Pros:** Intercepts early in the request lifecycle.
* **Cons:** Next.js Proxy/Middleware runs in an Edge runtime environment. Database drivers (like PostgreSQL TCP connections via Drizzle) often fail or require HTTP/WebSocket adapters (e.g. Neon Serverless / Supabase HTTP client). Doing DB calls on every request at Edge can introduce latency unless heavily cached.

---

### 🛑 **Rank 4: `next.config.ts` static `redirects()**`

Next.js supports static redirect rules in configuration.

* **Why to avoid:** `next.config.ts` requires pre-defining every single source and destination rule. If you have hundreds of archived caving news articles, hardcoding them into configuration degrades build times, and hosting platforms like Vercel impose limits (e.g., max 1,024 static redirects).

---

## 3. Critical Domain Migration Checklist for SEO

When switching `www.jknm.si` to the new Next.js site:

1. **Keep standard non-www to www redirects:** Ensure `jknm.si` seamlessly redirects to `www.jknm.si` (or vice versa, matching your canonical setup).
2. **Google Search Console (GSC):** Use the **Change of Address** tool inside Google Search Console once the live DNS point switches over.
3. **Dynamic Sitemap (`src/app/sitemap.ts`):** Ensure all new `/novica/<slug>` URLs are listed in your XML sitemap so Google re-crawls and re-indexes them quickly.
4. **Canonical Meta Tags:** Ensure Next.js Metadata API specifies canonical tags on every page:
```ts
export const metadata = {
  metadataBase: new URL('https://www.jknm.si'),
  alternates: { canonical: `/novica/${slug}` },
};

```



To learn more about how Google handles 301 and 308 redirects for SEO, here is a helpful video breakdown:

[Google SEO Redirects Explained](https://www.youtube.com/watch?v=qPsY4AKFlnM)
This video provides an overview of route parameters, query strings, and handling dynamic navigation in Next.js App Router.