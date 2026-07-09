"use client";

import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { Button } from "../ui/button";

export function SignOut() {
	const router = useRouter();

	return (
		<Button
			onClick={async () => {
				await signOut();
				router.push("/");
			}}
		>
			Odjava
		</Button>
	);
}
