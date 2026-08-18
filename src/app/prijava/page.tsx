import type { Metadata } from "next";
import SignIn from "./signin";

import "./google.css";
import { Shell } from "~/components/shell";
import { getServerAuthSession } from "~/server/auth";

export const metadata: Metadata = {
	title: "Prijava",
	robots: { index: false, follow: false },
};

export default async function Prijava() {
	const session = await getServerAuthSession();
	return (
		<Shell without_footer without_header full_bleed>
			<div className="h-screen w-full min-w-full">
				<SignIn session={session} />
			</div>
		</Shell>
	);
}
