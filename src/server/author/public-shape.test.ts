import { describe, expect, test } from "vitest";
import type { Author } from "../db/schema";
import { to_public_author } from "./public-shape";

const member_row = (
	overrides: Partial<typeof Author.$inferSelect> = {},
): typeof Author.$inferSelect => ({
	id: 7,
	author_type: "member",
	first_name: "Ana",
	last_name: "Novak",
	google_id: "g7",
	email: "ana@jknm.si",
	image: "https://example.com/ana.jpg",
	user_id: "user-7",
	...overrides,
});

const guest_row = (
	overrides: Partial<typeof Author.$inferSelect> = {},
): typeof Author.$inferSelect => ({
	id: 3,
	author_type: "guest",
	first_name: "Miha",
	last_name: "Kovač",
	google_id: null,
	email: null,
	image: null,
	user_id: null,
	...overrides,
});

describe("to_public_author", () => {
	test("keeps only the byline fields a client ever needs", () => {
		expect(to_public_author(member_row())).toEqual({
			id: 7,
			author_type: "member",
			first_name: "Ana",
			last_name: "Novak",
		});
	});

	test("keeps author_type so the /avtorji guest filter still works", () => {
		expect(to_public_author(guest_row())).toEqual({
			id: 3,
			author_type: "guest",
			first_name: "Miha",
			last_name: "Kovač",
		});
	});
});