import js from "@eslint/js"
import typescript from "@typescript-eslint/eslint-plugin"
import typescriptParser from "@typescript-eslint/parser"
import prettier from "eslint-plugin-prettier"

export default [
    js.configs.recommended,
    {
        files: ["**/*.ts", "**/*.tsx"],
        languageOptions: {
            parser: typescriptParser,
            parserOptions: {
                ecmaVersion: "latest",
                sourceType: "module",
                project: "./tsconfig.json",
            },
        },
        plugins: {
            "@typescript-eslint": typescript,
            prettier: prettier,
        },
        rules: {
            ...typescript.configs.recommended.rules,
            "prettier/prettier": "error",
            "@typescript-eslint/no-unused-vars": [
                "error",
                {
                    argsIgnorePattern: "^_",
                    varsIgnorePattern: "^_",
                },
            ],
            "@typescript-eslint/no-explicit-any": "warn",
            "no-console": "off",
            "no-undef": "off", // TypeScript handles this
        },
    },
    {
        ignores: ["node_modules/**", "dist/**", "*.js", "*.mjs"],
    },
]
