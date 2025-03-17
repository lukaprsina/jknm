import { pgTable, varchar, serial, text, index, integer, timestamp, json, foreignKey, unique, primaryKey, pgEnum } from "drizzle-orm/pg-core"
  import { sql } from "drizzle-orm"

export const authorType = pgEnum("author_type", ['member', 'guest'])



export const duplicateArticleUrls = pgTable("duplicate_article_urls", {
	url: varchar("url", { length: 255 }).primaryKey().notNull(),
});

export const author = pgTable("author", {
	id: serial("id").primaryKey().notNull(),
	authorType: authorType("author_type").notNull(),
	name: varchar("name", { length: 255 }).notNull(),
	googleId: varchar("google_id", { length: 255 }),
	email: text("email"),
	image: varchar("image", { length: 255 }),
});

export const publishedArticle = pgTable("published_article", {
	id: serial("id").primaryKey().notNull(),
	oldId: integer("old_id"),
	title: varchar("title", { length: 255 }).notNull(),
	url: varchar("url", { length: 255 }).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).notNull(),
	content: json("content"),
	thumbnailCrop: json("thumbnail_crop"),
	contentPreview: text("content_preview").default(''),
},
(table) => {
	return {
		pCreatedAtIdx: index("p_created_at_idx").using("btree", table.createdAt.asc().nullsLast()),
	}
});

export const session = pgTable("session", {
	sessionToken: varchar("session_token", { length: 255 }).primaryKey().notNull(),
	userId: varchar("user_id", { length: 255 }).notNull(),
	expires: timestamp("expires", { withTimezone: true, mode: 'string' }).notNull(),
},
(table) => {
	return {
		userIdIdx: index("session_user_id_idx").using("btree", table.userId.asc().nullsLast()),
		sessionUserIdUserIdFk: foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "session_user_id_user_id_fk"
		}),
	}
});

export const user = pgTable("user", {
	id: varchar("id", { length: 255 }).primaryKey().notNull(),
	name: varchar("name", { length: 255 }),
	email: varchar("email", { length: 255 }).notNull(),
	emailVerified: timestamp("email_verified", { withTimezone: true, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`),
	image: varchar("image", { length: 255 }),
});

export const draftArticle = pgTable("draft_article", {
	id: serial("id").primaryKey().notNull(),
	publishedId: integer("published_id"),
	title: varchar("title", { length: 255 }).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).notNull(),
	content: json("content"),
	thumbnailCrop: json("thumbnail_crop"),
	contentPreview: text("content_preview").default(''),
},
(table) => {
	return {
		dCreatedAtIdx: index("d_created_at_idx").using("btree", table.createdAt.asc().nullsLast()),
		draftArticlePublishedIdPublishedArticleIdFk: foreignKey({
			columns: [table.publishedId],
			foreignColumns: [publishedArticle.id],
			name: "draft_article_published_id_published_article_id_fk"
		}),
		draftArticlePublishedIdUnique: unique("draft_article_published_id_unique").on(table.publishedId),
	}
});

export const verificationToken = pgTable("verification_token", {
	identifier: varchar("identifier", { length: 255 }).notNull(),
	token: varchar("token", { length: 255 }).notNull(),
	expires: timestamp("expires", { withTimezone: true, mode: 'string' }).notNull(),
},
(table) => {
	return {
		verificationTokenIdentifierTokenPk: primaryKey({ columns: [table.identifier, table.token], name: "verification_token_identifier_token_pk"}),
	}
});

export const pArticlesToAuthors = pgTable("p_articles_to_authors", {
	publishedId: integer("published_id").notNull(),
	authorId: integer("author_id").notNull(),
	order: integer("order").default(0).notNull(),
},
(table) => {
	return {
		pArticlesToAuthorsAuthorIdAuthorIdFk: foreignKey({
			columns: [table.authorId],
			foreignColumns: [author.id],
			name: "p_articles_to_authors_author_id_author_id_fk"
		}).onDelete("cascade"),
		pArticlesToAuthorsPublishedIdPublishedArticleIdFk: foreignKey({
			columns: [table.publishedId],
			foreignColumns: [publishedArticle.id],
			name: "p_articles_to_authors_published_id_published_article_id_fk"
		}).onDelete("cascade"),
		pArticlesToAuthorsPublishedIdAuthorIdPk: primaryKey({ columns: [table.publishedId, table.authorId], name: "p_articles_to_authors_published_id_author_id_pk"}),
	}
});

export const dArticlesToAuthors = pgTable("d_articles_to_authors", {
	draftId: integer("draft_id").notNull(),
	authorId: integer("author_id").notNull(),
	order: integer("order").default(0).notNull(),
},
(table) => {
	return {
		dArticlesToAuthorsAuthorIdAuthorIdFk: foreignKey({
			columns: [table.authorId],
			foreignColumns: [author.id],
			name: "d_articles_to_authors_author_id_author_id_fk"
		}).onDelete("cascade"),
		dArticlesToAuthorsDraftIdDraftArticleIdFk: foreignKey({
			columns: [table.draftId],
			foreignColumns: [draftArticle.id],
			name: "d_articles_to_authors_draft_id_draft_article_id_fk"
		}).onDelete("cascade"),
		dArticlesToAuthorsDraftIdAuthorIdPk: primaryKey({ columns: [table.draftId, table.authorId], name: "d_articles_to_authors_draft_id_author_id_pk"}),
	}
});

export const account = pgTable("account", {
	userId: varchar("user_id", { length: 255 }).notNull(),
	type: varchar("type", { length: 255 }).notNull(),
	provider: varchar("provider", { length: 255 }).notNull(),
	providerAccountId: varchar("provider_account_id", { length: 255 }).notNull(),
	refreshToken: text("refresh_token"),
	accessToken: text("access_token"),
	expiresAt: integer("expires_at"),
	tokenType: varchar("token_type", { length: 255 }),
	scope: varchar("scope", { length: 255 }),
	idToken: text("id_token"),
	sessionState: varchar("session_state", { length: 255 }),
},
(table) => {
	return {
		userIdIdx: index("account_user_id_idx").using("btree", table.userId.asc().nullsLast()),
		accountUserIdUserIdFk: foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "account_user_id_user_id_fk"
		}),
		accountProviderProviderAccountIdPk: primaryKey({ columns: [table.provider, table.providerAccountId], name: "account_provider_provider_account_id_pk"}),
	}
});