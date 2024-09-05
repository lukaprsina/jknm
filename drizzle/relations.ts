import { relations } from "drizzle-orm/relations";
import { publishedArticle, draftArticle, user, session, dArticlesToAuthors, author, pArticlesToAuthors, account } from "./schema";

export const draftArticleRelations = relations(draftArticle, ({one, many}) => ({
	publishedArticle: one(publishedArticle, {
		fields: [draftArticle.publishedId],
		references: [publishedArticle.id]
	}),
	dArticlesToAuthors: many(dArticlesToAuthors),
}));

export const publishedArticleRelations = relations(publishedArticle, ({many}) => ({
	draftArticles: many(draftArticle),
	pArticlesToAuthors: many(pArticlesToAuthors),
}));

export const sessionRelations = relations(session, ({one}) => ({
	user: one(user, {
		fields: [session.userId],
		references: [user.id]
	}),
}));

export const userRelations = relations(user, ({many}) => ({
	sessions: many(session),
	accounts: many(account),
}));

export const dArticlesToAuthorsRelations = relations(dArticlesToAuthors, ({one}) => ({
	draftArticle: one(draftArticle, {
		fields: [dArticlesToAuthors.articleId],
		references: [draftArticle.id]
	}),
	author: one(author, {
		fields: [dArticlesToAuthors.authorId],
		references: [author.id]
	}),
}));

export const authorRelations = relations(author, ({many}) => ({
	dArticlesToAuthors: many(dArticlesToAuthors),
	pArticlesToAuthors: many(pArticlesToAuthors),
}));

export const pArticlesToAuthorsRelations = relations(pArticlesToAuthors, ({one}) => ({
	publishedArticle: one(publishedArticle, {
		fields: [pArticlesToAuthors.articleId],
		references: [publishedArticle.id]
	}),
	author: one(author, {
		fields: [pArticlesToAuthors.authorId],
		references: [author.id]
	}),
}));

export const accountRelations = relations(account, ({one}) => ({
	user: one(user, {
		fields: [account.userId],
		references: [user.id]
	}),
}));