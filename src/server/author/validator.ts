import { z } from "zod";

export const delete_guests_validator = z.object({ ids: z.array(z.number()) });

export const insert_guest_validator = z.object({
	first_name: z.string(),
	last_name: z.string(),
});

export const rename_guest_validator = z.object({
	id: z.number(),
	first_name: z.string(),
	last_name: z.string(),
});
