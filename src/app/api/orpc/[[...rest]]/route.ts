import { RPCHandler } from "@orpc/server/fetch";
import type { NextRequest } from "next/server";
import { getServerAuthSession } from "~/server/auth";
import { router } from "~/server/orpc/router";

const handler = new RPCHandler(router);

async function handle(request: NextRequest) {
	const { matched, response } = await handler.handle(request, {
		prefix: "/api/orpc",
		context: { session: await getServerAuthSession() },
	});

	if (matched) return response;

	return new Response("Not found", { status: 404 });
}

export {
	handle as GET,
	handle as POST,
	handle as PUT,
	handle as PATCH,
	handle as DELETE,
};
