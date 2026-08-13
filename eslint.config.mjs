import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import drizzle from "eslint-plugin-drizzle";
import tseslint from "typescript-eslint";

export default tseslint.config(
	{
		ignores: [
			".next/**",
			".vercel/**",
			"out/**",
			"build/**",
			"next-env.d.ts",
			"vendor/**",
			"drizzle/**",
		],
	},
	...nextCoreWebVitals,
	...tseslint.configs.recommendedTypeChecked,
	...tseslint.configs.stylisticTypeChecked,
	{
		languageOptions: {
			parserOptions: {
				projectService: true,
				tsconfigRootDir: import.meta.dirname,
			},
		},
		plugins: { drizzle },
		rules: {
			"@typescript-eslint/array-type": "off",
			"@typescript-eslint/consistent-type-definitions": "off",
			"@typescript-eslint/consistent-type-imports": [
				"warn",
				{
					prefer: "type-imports",
					fixStyle: "inline-type-imports",
				},
			],
			"@typescript-eslint/no-unused-vars": [
				"warn",
				{
					argsIgnorePattern: "^_",
				},
			],
			"@typescript-eslint/require-await": "off",
			"@typescript-eslint/prefer-nullish-coalescing": [
				"error",
				{
					ignoreMixedLogicalExpressions: true,
				},
			],
			"@typescript-eslint/no-misused-promises": [
				"error",
				{
					checksVoidReturn: {
						attributes: false,
					},
				},
			],
			"drizzle/enforce-delete-with-where": [
				"error",
				{
					drizzleObjectName: ["db", "ctx.db"],
				},
			],
			"drizzle/enforce-update-with-where": [
				"error",
				{
					drizzleObjectName: ["db", "ctx.db"],
				},
			],
		},
	},
);
