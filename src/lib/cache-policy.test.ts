import { describe, expect, test } from "vitest";
import {
	CACHE_TAGS,
	type CacheTag,
	DOMAIN_EVENTS,
	type DomainEvent,
	invalidations_for,
} from "./cache-policy";

/**
 * The expected mapping, written out longhand rather than derived from the
 * implementation — a test that recomputes the table it is checking asserts
 * nothing.
 */
const EXPECTED: Record<
	DomainEvent,
	{
		tags: CacheTag[];
		paths: string[];
		query_keys: unknown[][];
	}
> = {
	"article.created": {
		tags: ["drafts"],
		paths: ["/"],
		query_keys: [],
	},
	"article.saved": {
		tags: ["drafts"],
		paths: ["/"],
		query_keys: [],
	},
	"article.published": {
		tags: ["drafts", "archive", "homepage-feed", "all-published"],
		paths: ["/"],
		query_keys: [["infinite_published"]],
	},
	"article.archived": {
		tags: ["drafts", "archive", "homepage-feed", "all-published"],
		paths: ["/"],
		query_keys: [["infinite_published"]],
	},
	"article.unarchived": {
		tags: ["drafts", "archive", "all-published"],
		paths: ["/"],
		query_keys: [],
	},
	"article.deleted": {
		tags: ["drafts", "archive", "homepage-feed", "all-published"],
		paths: ["/"],
		query_keys: [["infinite_published"]],
	},
	"article.draft_discarded": {
		tags: ["drafts"],
		paths: ["/"],
		query_keys: [],
	},
	"article.superseding_draft_created": {
		tags: ["drafts"],
		paths: ["/"],
		query_keys: [],
	},
	"author.inserted": {
		tags: ["authors"],
		paths: ["/"],
		query_keys: [],
	},
	"author.renamed": {
		tags: ["authors"],
		paths: ["/"],
		query_keys: [],
	},
	"author.deleted": {
		tags: ["authors"],
		paths: ["/"],
		query_keys: [],
	},
	"author.synced": {
		tags: ["authors"],
		paths: ["/"],
		query_keys: [],
	},
};

describe("invalidations_for", () => {
	test.each(DOMAIN_EVENTS)("%s invalidates the expected set", (event) => {
		const descriptor = invalidations_for(event);
		const expected = EXPECTED[event];

		expect([...descriptor.tags].sort()).toEqual([...expected.tags].sort());
		expect([...descriptor.paths]).toEqual(expected.paths);
		expect(descriptor.query_keys.map((key) => [...key])).toEqual(
			expected.query_keys,
		);
	});

	/**
	 * Totality of the mapping itself is a typecheck guarantee
	 * (`Record<DomainEvent, …>`); what needs asserting is that the hand-written
	 * table above still covers every event, so a new event can't quietly go
	 * unchecked.
	 */
	test("the expected table covers every DomainEvent", () => {
		expect(Object.keys(EXPECTED).sort()).toEqual([...DOMAIN_EVENTS].sort());
	});
});

describe("cache tag reachability", () => {
	/**
	 * The test this ticket exists for. `homepage-feed` and `all-published` were
	 * declared at their cache sites and invalidated by nothing, so the homepage
	 * feed and `/preveri` served frozen data. A declared tag that no event
	 * reaches must fail the suite rather than silently serve staleness.
	 */
	test.each(CACHE_TAGS)("%s is invalidated by at least one event", (tag) => {
		const reaching = DOMAIN_EVENTS.filter((event) =>
			invalidations_for(event).tags.includes(tag),
		);

		expect(reaching).not.toHaveLength(0);
	});

	test("no descriptor names a tag outside CACHE_TAGS", () => {
		const declared = new Set<string>(CACHE_TAGS);

		for (const event of DOMAIN_EVENTS) {
			for (const tag of invalidations_for(event).tags) {
				expect(declared).toContain(tag);
			}
		}
	});
});
