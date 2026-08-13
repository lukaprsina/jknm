import type { Config } from "drizzle-kit";

if (!process.env.DATABASE_URL) {
	throw new Error("Missing DATABASE_URL");
}

const non_pooling_url = process.env.DATABASE_URL.replace(":6543", ":5432");

export default {
	schema: "./src/server/db/schema.ts",
	dialect: "postgresql",
	dbCredentials: {
		url: non_pooling_url,
	},
	// tablesFilter: ["jknm_*"],
} satisfies Config;
