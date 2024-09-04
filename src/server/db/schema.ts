import { relations, sql } from "drizzle-orm";
import {
  index,
  integer,
  json,
  pgEnum,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { type AdapterAccount } from "next-auth/adapters";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { content_validator } from "../../lib/validators";
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
    updated_at: timestamp("updated_at", { withTimezone: true }).$onUpdate(
      () => new Date(),
    ),
    content: json("content").$type<ArticleContentType>(),
    preview_image: varchar("preview_image", { length: 255 }),
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
    updated_at: timestamp("updated_at", { withTimezone: true }).$onUpdate(
      () => new Date(),
    ),
    content: json("content").$type<ArticleContentType>(),
    preview_image: varchar("preview_image", { length: 255 }),
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
});

export const PublishedArticlesToAuthors = pgTable(
  "p_articles_to_authors",
  {
    article_id: integer("article_id")
      .notNull()
      .references(() => PublishedArticle.id),
    author_id: integer("author_id")
      .notNull()
      .references(() => Author.id),
  },
  (published_articles_to_authors) => ({
    compoundKey: primaryKey({
      columns: [
        published_articles_to_authors.article_id,
        published_articles_to_authors.author_id,
      ],
    }),
  }),
);

export const DraftArticlesToAuthors = pgTable(
  "d_articles_to_authors",
  {
    article_id: integer("article_id")
      .notNull()
      .references(() => DraftArticle.id),
    author_id: integer("author_id")
      .notNull()
      .references(() => Author.id),
  },
  (draft_articles_to_authors) => ({
    compoundKey: primaryKey({
      columns: [
        draft_articles_to_authors.article_id,
        draft_articles_to_authors.author_id,
      ],
    }),
  }),
);

export const CreateDraftArticleSchema = createInsertSchema(DraftArticle, {
  content: content_validator,
  updated_at: z.date(),
}).omit({
  created_at: true,
});

export const SaveDraftArticleSchema = createInsertSchema(DraftArticle, {
  id: z.number(),
  content: content_validator,
  updated_at: z.date(),
}).omit({
  created_at: true,
});

export const PublishArticleSchema = createInsertSchema(DraftArticle, {
  content: content_validator,
  updated_at: z.date(),
}).omit({
  created_at: true,
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
