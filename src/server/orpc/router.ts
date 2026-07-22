import {
	archiveArticle,
	createArticle,
	createSupersedingDraft,
	deleteArticle,
	discardDraft,
	publishArticle,
	saveArticle,
} from "./article/procedures";
import {
	deleteGuests,
	insertGuest,
	renameGuest,
	syncMembers,
} from "./author/procedures";

// Built here, not in the `"use server"` procedures files: Next.js requires
// every export of a `"use server"` module to be an async function, and these
// router objects are plain objects.
export const router = {
	article: {
		create: createArticle,
		save: saveArticle,
		publish: publishArticle,
		archive: archiveArticle,
		delete: deleteArticle,
		discardDraft,
		createSupersedingDraft,
	},
	author: {
		insertGuest,
		renameGuest,
		deleteGuests,
		syncMembers,
	},
};
