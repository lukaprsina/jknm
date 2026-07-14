import { relations, sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import {
	boolean,
	index,
	integer,
	json,
	jsonb,
	pgEnum,
	pgTable,
	primaryKey,
	real,
	serial,
	text,
	timestamp,
	uuid,
	varchar,
} from "drizzle-orm/pg-core";
import type { AdapterAccount } from "next-auth/adapters";
import { z } from "zod";
import type { ThumbnailType } from "~/lib/validators";
import { content_validator, thumbnail_validator } from "~/lib/validators";

/**
 * This is an example of how to use the multi-project schema feature of Drizzle ORM. Use the same
 * database instance for multiple projects.
 *
 * @see https://orm.drizzle.team/docs/goodies#multi-project-schema
 */
// export const createTable = pgTableCreator((name) => `jknm_${name}`);

/* export const posts = pgTable(
  "post",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 256 }),
    createdById: varchar("created_by", { length: 255 })
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).$onUpdate(
      () => new Date()
    ),
  },
  (example) => ({
    createdByIdIdx: index("created_by_idx").on(example.createdById),
    nameIndex: index("name_idx").on(example.name),
  })
); */

export interface ArticleBlockType {
	id?: string;
	type: string;
	data: object;
}
export interface ArticleContentType {
	time?: number;
	blocks: ArticleBlockType[];
	version?: string;
}

export const PublishedArticle = pgTable(
	"published_article",
	{
		id: serial("id").primaryKey(),
		old_id: integer("old_id"),
		title: varchar("title", { length: 255 }).notNull(),
		url: varchar("url", { length: 255 }).notNull(),
		created_at: timestamp("created_at", { withTimezone: true })
			.default(sql`CURRENT_TIMESTAMP`)
			.notNull(),
		updated_at: timestamp("updated_at", { withTimezone: true })
			.$onUpdate(() => new Date())
			.notNull(),
		content: json("content").$type<ArticleContentType>(),
		content_preview: text("content_preview").default(""),
		thumbnail_crop: json("thumbnail_crop").$type<ThumbnailType>(),
		// image: varchar("image", { length: 255 }),
	},
	(published_article) => ({
		created_at_index: index("p_created_at_idx").on(
			published_article.created_at,
		),
	}),
);

export const PublishedArticleRelations = relations(
	PublishedArticle,
	({ many }) => ({
		published_articles_to_authors: many(PublishedArticlesToAuthors),
	}),
);

export const DuplicatedArticleUrls = pgTable("duplicate_article_urls", {
	url: varchar("url", { length: 255 }).primaryKey(),
});

export const DraftArticle = pgTable(
	"draft_article",
	{
		id: serial("id").primaryKey(),
		published_id: integer("published_id")
			.unique()
			.references(() => PublishedArticle.id),
		title: varchar("title", { length: 255 }).notNull(),
		created_at: timestamp("created_at", { withTimezone: true })
			.default(sql`CURRENT_TIMESTAMP`)
			.notNull(),
		updated_at: timestamp("updated_at", { withTimezone: true })
			.$onUpdate(() => new Date())
			.notNull(),
		content: json("content").$type<ArticleContentType>(),
		content_preview: text("content_preview").default(""),
		thumbnail_crop: json("thumbnail_crop").$type<ThumbnailType>(),
		// image: varchar("image", { length: 255 }),
	},
	(draft_article) => ({
		created_at_index: index("d_created_at_idx").on(draft_article.created_at),
	}),
);

export const DraftArticleRelations = relations(
	DraftArticle,
	({ one, many }) => ({
		draft_articles_to_authors: many(DraftArticlesToAuthors),
		published_article: one(PublishedArticle, {
			fields: [DraftArticle.published_id],
			references: [PublishedArticle.id],
		}),
	}),
);

export const author_type_enum = pgEnum("author_type", ["member", "guest"]);

// guests have name only
export const Author = pgTable("author", {
	id: serial("id").primaryKey(),
	author_type: author_type_enum("author_type").notNull(),
	name: varchar("name", { length: 255 }).notNull(),
	google_id: varchar("google_id", { length: 255 }),
	email: text("email"),
	image: varchar("image", { length: 255 }),
	user_id: varchar("user_id", { length: 255 }).references(() => users.id),
});

export const PublishedArticlesToAuthors = pgTable(
	"p_articles_to_authors",
	{
		published_id: integer("published_id")
			.notNull()
			.references(() => PublishedArticle.id, {
				onDelete: "cascade",
			}),
		author_id: integer("author_id")
			.notNull()
			.references(() => Author.id, {
				onDelete: "cascade",
			}),
		order: integer("order").default(0).notNull(),
	},
	(published_articles_to_authors) => ({
		compoundKey: primaryKey({
			columns: [
				published_articles_to_authors.published_id,
				published_articles_to_authors.author_id,
			],
		}),
	}),
);

export const PublishedArticlesToAuthorsRelations = relations(
	PublishedArticlesToAuthors,
	({ one }) => ({
		article: one(PublishedArticle, {
			fields: [PublishedArticlesToAuthors.published_id],
			references: [PublishedArticle.id],
		}),
		author: one(Author, {
			fields: [PublishedArticlesToAuthors.author_id],
			references: [Author.id],
		}),
	}),
);

export const DraftArticlesToAuthors = pgTable(
	"d_articles_to_authors",
	{
		draft_id: integer("draft_id")
			.notNull()
			.references(() => DraftArticle.id, { onDelete: "cascade" }),
		author_id: integer("author_id")
			.notNull()
			.references(() => Author.id, {
				onDelete: "cascade",
			}),
		order: integer("order").default(0).notNull(),
	},
	(draft_articles_to_authors) => ({
		compoundKey: primaryKey({
			columns: [
				draft_articles_to_authors.draft_id,
				draft_articles_to_authors.author_id,
			],
		}),
	}),
);

export const DraftArticlesToAuthorsRelations = relations(
	DraftArticlesToAuthors,
	({ one }) => ({
		article: one(DraftArticle, {
			fields: [DraftArticlesToAuthors.draft_id],
			references: [DraftArticle.id],
		}),
		author: one(Author, {
			fields: [DraftArticlesToAuthors.author_id],
			references: [Author.id],
		}),
	}),
);

export const CreateDraftArticleSchema = z.object({
	published_id: z.number().optional(),
	title: z.string(),
});

export const SaveDraftArticleSchema = z.object({
	title: z.string(),
	created_at: z.date().optional(),
	updated_at: z.date().optional(),
	content: content_validator.optional(),
	content_preview: z.string().optional(),
	thumbnail_crop: thumbnail_validator.optional(),
	published_id: z.number().optional(),
	draft_articles_to_authors: z
		.array(
			z.object({
				draft_id: z.number().optional(),
				author_id: z.number(),
				order: z.number().optional(),
			}),
		)
		.optional(),
});

export const PublishArticleSchema = z.object({
	old_id: z.number().optional(),
	title: z.string(),
	url: z.string(),
	created_at: z.date().optional(),
	updated_at: z.date().optional(),
	content: content_validator.optional(),
	content_preview: z.string().optional(),
	thumbnail_crop: thumbnail_validator.optional(),
	published_articles_to_authors: z
		.array(
			z.object({
				published_id: z.number().optional(),
				author_id: z.number(),
				order: z.number().optional(),
			}),
		)
		.optional(),
});

export const users = pgTable("user", {
	id: varchar("id", { length: 255 })
		.notNull()
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	name: varchar("name", { length: 255 }),
	email: varchar("email", { length: 255 }).notNull(),
	emailVerified: timestamp("email_verified", {
		mode: "date",
		withTimezone: true,
	}).default(sql`CURRENT_TIMESTAMP`),
	image: varchar("image", { length: 255 }),
});

export const usersRelations = relations(users, ({ many }) => ({
	accounts: many(accounts),
}));

export const accounts = pgTable(
	"account",
	{
		userId: varchar("user_id", { length: 255 })
			.notNull()
			.references(() => users.id),
		type: varchar("type", { length: 255 })
			.$type<AdapterAccount["type"]>()
			.notNull(),
		provider: varchar("provider", { length: 255 }).notNull(),
		providerAccountId: varchar("provider_account_id", {
			length: 255,
		}).notNull(),
		refresh_token: text("refresh_token"),
		access_token: text("access_token"),
		expires_at: integer("expires_at"),
		token_type: varchar("token_type", { length: 255 }),
		scope: varchar("scope", { length: 255 }),
		id_token: text("id_token"),
		session_state: varchar("session_state", { length: 255 }),
	},
	(account) => ({
		compoundKey: primaryKey({
			columns: [account.provider, account.providerAccountId],
		}),
		userIdIdx: index("account_user_id_idx").on(account.userId),
	}),
);

export const accountsRelations = relations(accounts, ({ one }) => ({
	user: one(users, { fields: [accounts.userId], references: [users.id] }),
}));

export const sessions = pgTable(
	"session",
	{
		sessionToken: varchar("session_token", { length: 255 })
			.notNull()
			.primaryKey(),
		userId: varchar("user_id", { length: 255 })
			.notNull()
			.references(() => users.id),
		expires: timestamp("expires", {
			mode: "date",
			withTimezone: true,
		}).notNull(),
	},
	(session) => ({
		userIdIdx: index("session_user_id_idx").on(session.userId),
	}),
);

export const sessionsRelations = relations(sessions, ({ one }) => ({
	user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const verificationTokens = pgTable(
	"verification_token",
	{
		identifier: varchar("identifier", { length: 255 }).notNull(),
		token: varchar("token", { length: 255 }).notNull(),
		expires: timestamp("expires", {
			mode: "date",
			withTimezone: true,
		}).notNull(),
	},
	(vt) => ({
		compoundKey: primaryKey({ columns: [vt.identifier, vt.token] }),
	}),
);

// --- Unified articles/media schema (#17) ---
// Additive alongside PublishedArticle/DraftArticle; nothing above is read from yet.

export const article_status_enum = pgEnum("article_status", [
	"draft",
	"published",
	"archived",
	"deleted",
]);

export const media_upload_status_enum = pgEnum("media_upload_status", [
	"pending",
	"processing",
	"completed",
	"failed",
]);

export interface MediaOriginalData {
	url: string;
	width: number;
	height: number;
	size_bytes: number;
}

export interface MediaVariantData {
	format: "avif" | "jpeg";
	width: number;
	height: number;
	url: string;
	size_bytes: number;
}

export interface MediaSrcsetsData {
	avif: string;
	jpeg: string;
	sizes: string;
}

export const Media = pgTable("media", {
	id: uuid("id").primaryKey(),
	filename: varchar("filename", { length: 255 }).notNull(),
	content_type: varchar("content_type", { length: 255 }).notNull(),
	size_bytes: integer("size_bytes").notNull(),
	original: jsonb("original").$type<MediaOriginalData>().notNull(),
	variants: jsonb("variants").$type<MediaVariantData[]>().notNull().default([]),
	srcsets: jsonb("srcsets").$type<MediaSrcsetsData>(),
	blur_placeholder: text("blur_placeholder"),
	upload_status: media_upload_status_enum("upload_status")
		.notNull()
		.default("pending"),
	created_at: timestamp("created_at", { withTimezone: true })
		.default(sql`CURRENT_TIMESTAMP`)
		.notNull(),
	updated_at: timestamp("updated_at", { withTimezone: true })
		.$onUpdate(() => new Date())
		.notNull(),
});

export const Article = pgTable(
	"articles",
	{
		id: uuid("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		legacy_id: integer("legacy_id"),
		status: article_status_enum("status").notNull().default("draft"),
		title: varchar("title", { length: 255 }).notNull(),
		excerpt: text("excerpt").default(""),
		content_json: jsonb("content_json").$type<ArticleContentType>(),
		content_markdown: text("content_markdown"),
		thumbnail_media_id: uuid("thumbnail_media_id").references(
			() => Media.id,
		),
		thumbnail_x: real("thumbnail_x"),
		thumbnail_y: real("thumbnail_y"),
		thumbnail_width: real("thumbnail_width"),
		thumbnail_height: real("thumbnail_height"),
		supersedes_id: uuid("supersedes_id").references(
			(): AnyPgColumn => Article.id,
		),
		created_by: varchar("created_by", { length: 255 }).references(
			() => users.id,
		),
		created_at: timestamp("created_at", { withTimezone: true })
			.default(sql`CURRENT_TIMESTAMP`)
			.notNull(),
		updated_at: timestamp("updated_at", { withTimezone: true })
			.$onUpdate(() => new Date())
			.notNull(),
		published_at: timestamp("published_at", { withTimezone: true }),
		archived_at: timestamp("archived_at", { withTimezone: true }),
		deleted_at: timestamp("deleted_at", { withTimezone: true }),
		published_year: integer("published_year").generatedAlwaysAs(
			() => sql`EXTRACT(YEAR FROM (published_at AT TIME ZONE 'UTC'))`,
		),
	},
	(articles) => ({
		legacy_id_idx: index("articles_legacy_id_idx").on(articles.legacy_id),
		status_published_year_idx: index(
			"articles_status_published_year_idx",
		).on(articles.status, articles.published_year),
	}),
);

export const ArticleRelations = relations(Article, ({ one, many }) => ({
	thumbnail_media: one(Media, {
		fields: [Article.thumbnail_media_id],
		references: [Media.id],
	}),
	supersedes: one(Article, {
		fields: [Article.supersedes_id],
		references: [Article.id],
		relationName: "supersedes",
	}),
	created_by_user: one(users, {
		fields: [Article.created_by],
		references: [users.id],
	}),
	articles_to_authors: many(ArticlesToAuthors),
	article_slugs: many(ArticleSlug),
	media_to_articles: many(MediaToArticles),
}));

export const ArticleSlug = pgTable(
	"article_slugs",
	{
		id: serial("id").primaryKey(),
		slug: varchar("slug", { length: 255 }).notNull().unique(),
		article_id: uuid("article_id")
			.notNull()
			.references(() => Article.id, { onDelete: "cascade" }),
		is_primary: boolean("is_primary").notNull().default(false),
		created_at: timestamp("created_at", { withTimezone: true })
			.default(sql`CURRENT_TIMESTAMP`)
			.notNull(),
	},
	(article_slugs) => ({
		article_id_idx: index("article_slugs_article_id_idx").on(
			article_slugs.article_id,
		),
	}),
);

export const ArticleSlugRelations = relations(ArticleSlug, ({ one }) => ({
	article: one(Article, {
		fields: [ArticleSlug.article_id],
		references: [Article.id],
	}),
}));

export const MediaToArticles = pgTable(
	"media_to_articles",
	{
		article_id: uuid("article_id")
			.notNull()
			.references(() => Article.id, { onDelete: "cascade" }),
		media_id: uuid("media_id")
			.notNull()
			.references(() => Media.id, { onDelete: "cascade" }),
		order: integer("order").default(0).notNull(),
	},
	(media_to_articles) => ({
		compoundKey: primaryKey({
			columns: [media_to_articles.article_id, media_to_articles.media_id],
		}),
	}),
);

export const MediaToArticlesRelations = relations(
	MediaToArticles,
	({ one }) => ({
		article: one(Article, {
			fields: [MediaToArticles.article_id],
			references: [Article.id],
		}),
		media: one(Media, {
			fields: [MediaToArticles.media_id],
			references: [Media.id],
		}),
	}),
);

export const MediaRelations = relations(Media, ({ many }) => ({
	media_to_articles: many(MediaToArticles),
}));

export const ArticlesToAuthors = pgTable(
	"articles_to_authors",
	{
		article_id: uuid("article_id")
			.notNull()
			.references(() => Article.id, { onDelete: "cascade" }),
		author_id: integer("author_id")
			.notNull()
			.references(() => Author.id, { onDelete: "cascade" }),
		order: integer("order").default(0).notNull(),
	},
	(articles_to_authors) => ({
		compoundKey: primaryKey({
			columns: [articles_to_authors.article_id, articles_to_authors.author_id],
		}),
	}),
);

export const ArticlesToAuthorsRelations = relations(
	ArticlesToAuthors,
	({ one }) => ({
		article: one(Article, {
			fields: [ArticlesToAuthors.article_id],
			references: [Article.id],
		}),
		author: one(Author, {
			fields: [ArticlesToAuthors.author_id],
			references: [Author.id],
		}),
	}),
);
