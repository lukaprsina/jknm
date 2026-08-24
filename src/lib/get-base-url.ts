import { CANONICAL_ORIGIN } from "~/lib/domains";

export function get_base_url(force_domain?: boolean): string {
	if (!force_domain && typeof window !== "undefined") return ""; // browser should use relative url
	return CANONICAL_ORIGIN;
}
