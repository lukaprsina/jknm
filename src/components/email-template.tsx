import type * as z from "zod";
import type { contact_form_schema } from "../app/kontakt/contact-form";

export async function AdminContactEmailTemplate({
	name,
	email,
	address,
	interest,
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
					<strong>Prebivališče:</strong> {address}
				</li>
				<li>
					<strong>Zanima me:</strong> {interest}
				</li>
			</ul>
		</>
	);
}
export async function UserContactEmailTemplate({
	name,
	email,
	address,
	interest,
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
					<strong>Prebivališče:</strong> {address}
				</li>
				<li>
					<strong>Zanima me:</strong> {interest}
				</li>
			</ul>
		</>
	);
}
