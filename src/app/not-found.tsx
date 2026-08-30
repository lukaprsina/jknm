import { NotFoundContent } from "~/components/component-not-found";
import { PrijavaLink } from "~/components/prijava-link";
import { Shell } from "~/components/shell";

export default function FourOFour() {
	return (
		<Shell>
			<NotFoundContent title="404" description="Stran ne obstaja.">
				<p>
					Če je stran dostopna samo prijavljenim urednikom, se lahko
					prijavite spodaj.
				</p>
				<PrijavaLink />
			</NotFoundContent>
		</Shell>
	);
}
