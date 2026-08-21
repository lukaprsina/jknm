import { Resend } from "resend";
import type { z } from "zod";
import type { contact_form_schema } from "~/app/kontakt/contact-form";
import {
	AdminContactEmailTemplate,
	UserContactEmailTemplate,
} from "~/components/email-template";
import { env } from "~/env";

const resend = new Resend(env.RESEND_API_KEY);

/* TODO: zamenjaj domeno na jknm.si */
export async function POST(req: Request) {
	try {
		const values = (await req.json()) as z.infer<typeof contact_form_schema>;

		const admin_email = await resend.emails.send({
			from: "Jamarski klub Novo mesto <noreply@jknm.org>",
			to: ["info@jknm.org"],
			subject: "Novo sporočilo iz strani jknm.si",
			react: AdminContactEmailTemplate(values),
		});

		if (admin_email.error) {
			console.error("[api/send] admin email failed:", admin_email.error);
			return Response.json(
				{ error: admin_email.error.message ?? "unknown error", type: "admin" },
				{ status: 500 },
			);
		}

		const user_email = await resend.emails.send({
			from: "Jamarski klub Novo mesto <noreply@jknm.org>",
			to: values.email,
			subject: "Potrditev prejema sporočila",
			react: UserContactEmailTemplate(values),
		});

		if (user_email.error) {
			console.error("[api/send] user email failed:", user_email.error);
			return Response.json(
				{ error: user_email.error.message ?? "unknown error", type: "user" },
				{ status: 500 },
			);
		}

		return Response.json({ success: true });
	} catch (error) {
		console.error("[api/send] unexpected error:", error);
		return Response.json(
			{
				error: error instanceof Error ? error.message : "unknown error",
				type: "unexpected",
			},
			{ status: 500 },
		);
	}
}
