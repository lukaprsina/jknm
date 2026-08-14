interface NamedAuthor {
	first_name: string;
	last_name: string;
}

export function format_author_name(author: NamedAuthor) {
	return `${author.first_name} ${author.last_name}`;
}

export function format_author_sort_name(author: NamedAuthor) {
	return `${author.last_name}, ${author.first_name}`;
}
