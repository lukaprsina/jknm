import type * as z from "zod";
import { type contact_form_schema } from "../app/kontakt/contact-form";

export async function AdminContactEmailTemplate({
  name,
  email,
  message,
  address,
}: z.infer<typeof contact_form_schema>) {
  return (
    <>
      <p>Novo sporočilo iz strani jknm.si:</p>
      <ul>
        <li>
          <strong>Ime in priimek:</strong> {name}
        </li>
        <li>
          <strong>E-pošta:</strong> {email}
        </li>
        <li>
          <strong>Kraj/mesto:</strong> {address ?? "N/A"}
        </li>
        <li>
          <strong>Sporočilo:</strong> {message}
        </li>
      </ul>
    </>
  );
}
export async function UserContactEmailTemplate({
  name,
  email,
  message,
  address,
}: z.infer<typeof contact_form_schema>) {
  return (
    <>
      <p>Sporočilo uspešno poslano administratorju strani jknm.si:</p>
      <ul>
        <li>
          <strong>Ime in priimek:</strong> {name}
        </li>
        <li>
          <strong>E-pošta:</strong> {email}
        </li>
        <li>
          <strong>Kraj/mesto:</strong> {address ?? "N/A"}
        </li>
        <li>
          <strong>Sporočilo:</strong> {message}
        </li>
      </ul>
    </>
  );
}
