import { env } from "~/env";

export function get_base_url(force_domain?: boolean): string {
  if (!force_domain && typeof window !== "undefined") return ""; // browser should use relative url
  if (env.NEXTAUTH_URL) return `https://${env.NEXTAUTH_URL}`; // SSR should use vercel url
  return `http://localhost:${process.env.PORT ?? 3000}`; // dev SSR should use localhost
}
