import * as z from "zod";

export const contact_form_schema = z.object({
	email: z.string().min(1, "Obvezno polje").email("Neveljaven e-poštni naslov"),
	name: z.string().min(1, "Obvezno polje"),
	address: z.string().min(1, "Obvezno polje"),
	interest: z.string().min(1, "Obvezno polje"),
});
