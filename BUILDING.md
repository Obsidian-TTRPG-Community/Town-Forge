# Building Town Forge

The plugin is written as TypeScript modules under `src/` and bundled to `main.js`
with [esbuild](https://esbuild.github.io/).

## Prerequisites

- Node.js 18+ and npm

## Commands

```bash
npm install        # install dev dependencies
npm run dev        # watch-mode build (rebuilds main.js on save)
npm run build      # one-off production build -> main.js
npm run typecheck  # optional: tsc --noEmit (advisory; see note below)
```

## Continuous integration

- `.github/workflows/build.yml` builds the plugin on every push / PR to `main`
  and uploads `main.js`, `manifest.json`, `versions.json` as an artifact.
- `.github/workflows/release.yml` builds and publishes a GitHub Release with
  those three files attached whenever a tag is pushed. Tag with the plain
  version number, e.g. `git tag 1.1.2 && git push origin 1.1.2`.

## Releasing a new version

```bash
npm version patch   # bumps package.json, manifest.json and versions.json
git push && git push --tags
```

`npm version` runs `version-bump.mjs`, which keeps `manifest.json` and
`versions.json` in sync with the new version (Obsidian's standard convention).

## A note on the source

This `src/` tree was reconstructed from the compiled `main.js` bundle: the
original modules were split back out, esbuild's CommonJS/interop wrappers were
unwound, and cross-module `import`/`export` statements were restored. It builds
to a functionally-equivalent `main.js` (verified by comparing every function,
class, string literal and export against the original bundle).

Because types were erased at the original compile step, the reconstructed
modules are effectively untyped (`any`), so `npm run typecheck` reports many
"property does not exist" notices. These are advisory only — esbuild produces
the working plugin regardless. Adding real type annotations over time is a safe,
incremental improvement.
