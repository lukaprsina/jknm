import { env } from "~/env";
import { Resend } from "resend";
import { type z } from "zod";
import { type contact_form_schema } from "~/app/kontakt/contact-form";
import {
  AdminContactEmailTemplate,
  UserContactEmailTemplate,
} from "~/components/email-template";

const resend = new Resend(env.RESEND_API_KEY);

/* TODO: zamenjaj domeno na jknm.si */
export async function POST(req: Request) {
  try {
    const values = (await req.json()) as z.infer<typeof contact_form_schema>;

    const admin_email = await resend.emails.send({
      from: "Jamarski klub Novo mesto <noreply@jknm.site>",
      to: ["info@jknm.site"],
      subject: "Novo sporočilo iz strani jknm.si",
      react: AdminContactEmailTemplate(values),
    });

    if (admin_email.error) {
      return Response.json(
        { error: admin_email.error, type: "admin" },
        { status: 500 },
      );
    }

    const user_email = await resend.emails.send({
      from: "Jamarski klub Novo mesto <noreply@jknm.site>",
      to: values.email,
      subject: "Potrditev prejema sporočila",
      react: UserContactEmailTemplate(values),
    });

    if (user_email.error) {
      return Response.json(
        { error: user_email.error, type: "user" },
        { status: 500 },
      );
    }

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error }, { status: 500 });
  }
}
