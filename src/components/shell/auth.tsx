"use client";

import { useRouter } from "next/navigation";
import { sign_out } from "~/lib/auth-client";
import { Button } from "../ui/button";

export function SignOut() {
	const router = useRouter();

	return (
		<Button
			onClick={async () => {
				await sign_out();
				router.push("/");
			}}
		>
			Odjava
		</Button>
	);
}
