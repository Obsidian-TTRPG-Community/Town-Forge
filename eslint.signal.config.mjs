import base from "./eslint.config.mjs";

/*
 * The reviewer-equivalent run (eslint.config.mjs) with the untyped-source noise
 * muted, so a real regression is visible instead of being buried.
 *
 * Every rule below has a single root cause: src/ was reconstructed by decompiling
 * an esbuild bundle, so it carries no type annotations and TypeScript infers `any`
 * almost everywhere. That produces ~7,000 findings which say nothing about
 * correctness. They are tracked as typing debt in CHANGELOG.md under "Known
 * remaining warnings" — annotating the source is the fix, not a suppression here.
 *
 * Everything else the reviewer checks — the obsidianmd/* rules that decide
 * pass/fail, floating promises, unused vars, deprecation, implied eval — stays on.
 */

const untypedSourceDebt = {
  "@typescript-eslint/no-unsafe-argument": "off",
  "@typescript-eslint/no-unsafe-assignment": "off",
  "@typescript-eslint/no-unsafe-call": "off",
  "@typescript-eslint/no-unsafe-member-access": "off",
  "@typescript-eslint/no-unsafe-return": "off",
  "@typescript-eslint/no-explicit-any": "off",
  "@typescript-eslint/no-unsafe-enum-comparison": "off",
  "@typescript-eslint/restrict-template-expressions": "off",
  "@typescript-eslint/restrict-plus-operands": "off",
};

/*
 * The name hook (panel.ts runNameHook) builds a function from user-authored JS.
 * That is the feature — power users write their own name generators — so the
 * construct is intentional and stays. Locally these two rules are `error`, which
 * would make this script exit non-zero forever; the Obsidian reviewer reports the
 * same construct as a Warning, so match its severity and keep it visible.
 */
const deliberateNameHook = {
  "@typescript-eslint/no-implied-eval": "warn",
  "obsidianmd/rule-custom-message": "warn",
};

export default [
  ...base,
  {
    files: ["src/**/*.ts"],
    rules: { ...untypedSourceDebt, ...deliberateNameHook },
  },
];
