import fs from "node:fs/promises";
import { parse as parse_jsonc } from "jsonc-parser";

/**
 * Waivers: findings a legacy-diff script (`legacy-link-diff.ts`,
 * `legacy-media-hash-diff.ts`) deliberately excludes from its report — a
 * cross-run decision ("this is fine, stop flagging it") that would otherwise
 * get re-litigated by hand on every run. Kept as a hand-edited JSONC file
 * (comments allowed) rather than a database table: single-user, low-volume,
 * and the point is a human can read *why* right next to the entries it
 * covers, e.g.
 *
 *   // Picasa albums are long dead upstream — not worth relinking.
 *   { "legacy_id": 6, "kind": "missing_external_link", "legacy_url": "..." },
 *
 * Keyed on {legacy_id, kind, legacy_url} — deliberately narrower than a
 * finding's full shape, so adding or renaming other fields on a finding type
 * later doesn't invalidate existing waivers.
 */

export interface WaiverKey {
	legacy_id: number;
	kind: string;
	legacy_url: string;
}

function waiver_key({ legacy_id, kind, legacy_url }: WaiverKey): string {
	return `${legacy_id}|${kind}|${legacy_url}`;
}

/** Missing file reads as no waivers — nothing to opt into for a script's first run. */
export async function load_waivers(path: string): Promise<Set<string>> {
	const text = await fs.readFile(path, "utf8").catch(() => "[]");
	const parsed = parse_jsonc(text) as WaiverKey[];
	return new Set(parsed.map(waiver_key));
}

export function is_waived(waivers: Set<string>, entry: WaiverKey): boolean {
	return waivers.has(waiver_key(entry));
}
