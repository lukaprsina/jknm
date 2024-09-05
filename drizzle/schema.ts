import { pgTable, unique, serial, varchar, text, index, foreignKey, integer, timestamp, json, primaryKey, pgEnum } from "drizzle-orm/pg-core"
  import { sql } from "drizzle-orm"

export const authorType = pgEnum("author_type", ['member', 'guest'])



export const author = pgTable("author", {
	id: serial("id").primaryKey().notNull(),
	authorType: authorType("author_type").notNull(),
	name: varchar("name", { length: 255 }).notNull(),
	googleId: varchar("google_id", { length: 255 }),
	email: text("email"),
	image: varchar("image", { length: 255 }),
},
(table) => {
	return {
		authorGoogleIdUnique: unique("author_google_id_unique").on(table.googleId),
	}
});

export const draftArticle = pgTable("draft_article", {
	id: serial("id").primaryKey().notNull(),
	publishedId: integer("published_id"),
	title: varchar("title", { length: 255 }).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
	content: json("content"),
	previewImage: varchar("preview_image", { length: 255 }),
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

export const publishedArticle = pgTable("published_article", {
	id: serial("id").primaryKey().notNull(),
	oldId: integer("old_id"),
	title: varchar("title", { length: 255 }).notNull(),
	url: varchar("url", { length: 255 }).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
	content: json("content"),
	previewImage: varchar("preview_image", { length: 255 }),
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

export const dArticlesToAuthors = pgTable("d_articles_to_authors", {
	articleId: integer("article_id").notNull(),
	authorId: integer("author_id").notNull(),
},
(table) => {
	return {
		dArticlesToAuthorsArticleIdDraftArticleIdFk: foreignKey({
			columns: [table.articleId],
			foreignColumns: [draftArticle.id],
			name: "d_articles_to_authors_article_id_draft_article_id_fk"
		}).onDelete("cascade"),
		dArticlesToAuthorsAuthorIdAuthorIdFk: foreignKey({
			columns: [table.authorId],
			foreignColumns: [author.id],
			name: "d_articles_to_authors_author_id_author_id_fk"
		}),
		dArticlesToAuthorsArticleIdAuthorIdPk: primaryKey({ columns: [table.articleId, table.authorId], name: "d_articles_to_authors_article_id_author_id_pk"}),
	}
});

export const pArticlesToAuthors = pgTable("p_articles_to_authors", {
	articleId: integer("article_id").notNull(),
	authorId: integer("author_id").notNull(),
},
(table) => {
	return {
		pArticlesToAuthorsArticleIdPublishedArticleIdFk: foreignKey({
			columns: [table.articleId],
			foreignColumns: [publishedArticle.id],
			name: "p_articles_to_authors_article_id_published_article_id_fk"
		}).onDelete("cascade"),
		pArticlesToAuthorsAuthorIdAuthorIdFk: foreignKey({
			columns: [table.authorId],
			foreignColumns: [author.id],
			name: "p_articles_to_authors_author_id_author_id_fk"
		}),
		pArticlesToAuthorsArticleIdAuthorIdPk: primaryKey({ columns: [table.articleId, table.authorId], name: "p_articles_to_authors_article_id_author_id_pk"}),
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