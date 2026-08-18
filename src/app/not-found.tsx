import { NotFoundContent } from "~/components/component-not-found";
import { Shell } from "~/components/shell";

export default function FourOFour() {
	return (
		<Shell>
			<NotFoundContent title="404" description="Stran ne obstaja." />
		</Shell>
	);
}
