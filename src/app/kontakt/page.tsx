import type { Metadata } from "next";
import { Shell } from "~/components/shell";
import { Card, CardContent } from "~/components/ui/card";
import { page_variants } from "~/lib/page-variants";
import { cn } from "~/lib/utils";
import ContactForm from "./contact-form";

export const metadata: Metadata = {
	title: "Kontakt",
	description:
		"Kontaktirajte Jamarski klub Novo mesto ali nas obiščite na Seidlovi cesti 29.",
	alternates: { canonical: "/kontakt" },
};

export default function ContactPage() {
	return (
		<Shell>
			<div className={cn(page_variants({ max_width: "wide" }))}>
				<div className="prose mb-6">
					<h1>Kontakt</h1>
				</div>
				<div className="flex flex-col gap-6">
					<Card>
						<CardContent className="pt-6">
							<ContactForm />
						</CardContent>
					</Card>
					<Card className="overflow-hidden p-0">
						<div className="relative h-96 w-full">
							<iframe
								title="Zemljevid lokacije JKNM"
								src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2780.878072740336!2d15.17148101237302!3d45.81370020993017!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x4765001cb4a38a57%3A0xc99d5cf17a45c4f8!2sSeidlova%20cesta%2029%2C%208000%20mesto!5e0!3m2!1sen!2ssi!4v1739015680434!5m2!1sen!2ssi"
								className="absolute inset-0 h-full w-full border-0"
								allowFullScreen
								loading="lazy"
								referrerPolicy="no-referrer-when-downgrade"
							/>
						</div>
					</Card>
				</div>
			</div>
		</Shell>
	);
}
