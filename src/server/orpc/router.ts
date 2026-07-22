import { articleRouter } from "./article/procedures";
import { authorRouter } from "./author/procedures";

export const router = {
	article: articleRouter,
	author: authorRouter,
};
