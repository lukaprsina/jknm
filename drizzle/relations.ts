import { relations } from "drizzle-orm/relations";
import { user, session, publishedArticle, draftArticle, author, pArticlesToAuthors, dArticlesToAuthors, account } from "./schema";

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

export const pArticlesToAuthorsRelations = relations(pArticlesToAuthors, ({one}) => ({
	author: one(author, {
		fields: [pArticlesToAuthors.authorId],
		references: [author.id]
	}),
	publishedArticle: one(publishedArticle, {
		fields: [pArticlesToAuthors.publishedId],
		references: [publishedArticle.id]
	}),
}));

export const authorRelations = relations(author, ({many}) => ({
	pArticlesToAuthors: many(pArticlesToAuthors),
	dArticlesToAuthors: many(dArticlesToAuthors),
}));

export const dArticlesToAuthorsRelations = relations(dArticlesToAuthors, ({one}) => ({
	author: one(author, {
		fields: [dArticlesToAuthors.authorId],
		references: [author.id]
	}),
	draftArticle: one(draftArticle, {
		fields: [dArticlesToAuthors.draftId],
		references: [draftArticle.id]
	}),
}));

export const accountRelations = relations(account, ({one}) => ({
	user: one(user, {
		fields: [account.userId],
		references: [user.id]
	}),
}));