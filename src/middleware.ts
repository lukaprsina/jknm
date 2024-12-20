import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { env } from "./env";

export function middleware(req: NextRequest) {
  // Extract the path after /novica/
  const path = req.nextUrl.pathname.replace(/^\/novica\//, "");
  const new_url = new URL(`https://cdn.${env.NEXT_PUBLIC_SITE_DOMAIN}/${path}`);

  console.log("MIDDLEWARE", req.nextUrl.pathname, new_url.toString());
  return NextResponse.rewrite(new_url);
}

export const config = {
  matcher: [
    /*
     * Match only paths like:
     * - /novica/my-article/image_1.jpg
     * Exclude paths starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/novica/:slug/:image((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};
