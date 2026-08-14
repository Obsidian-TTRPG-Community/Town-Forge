import path from "node:path";
import { fileURLToPath } from "node:url";

import obsidianmd from "eslint-plugin-obsidianmd";
import tseslint from "typescript-eslint";

// Not import.meta.dirname — that needs Node 20.11+, and BUILDING.md promises 18+.
const here = path.dirname(fileURLToPath(import.meta.url));

/*
 * Reproduces the Obsidian community-plugin automated review locally.
 *
 * The reviewer runs eslint-plugin-obsidianmd's `recommended` config, which also
 * switches on typescript-eslint's type-checked rule sets. Run it from the repo
 * root — the obsidianmd rules read ./manifest.json to check minAppVersion, and
 * resolve nothing if the cwd is elsewhere.
 *
 *   npm run lint          full reviewer-equivalent output (~7k findings)
 *   npm run lint:signal   the same run with the untyped-source noise muted
 *
 * lint:signal is the one to watch in day-to-day work; see
 * eslint.signal.config.mjs for what it mutes and why.
 */

export default tseslint.config(
  {
    ignores: ["main.js", "node_modules/**", "docs/**", "Examples/**", "*.mjs"],
  },

  ...obsidianmd.configs.recommended,

  {
    files: ["src/**/*.ts"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: here,
      },
    },
  },
);
