import { env } from "~/env";

/* TODO: 17 marec */
export function get_base_url(force_domain?: boolean): string {
  if (!force_domain && typeof window !== "undefined") return ""; // browser should use relative url
  if (env.NEXT_PUBLIC_NEXTAUTH_URL) return `${env.NEXT_PUBLIC_NEXTAUTH_URL}`; // SSR should use vercel url
  return `http://localhost:${process.env.PORT ?? 3000}`; // dev SSR should use localhost
}
