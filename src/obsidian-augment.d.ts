import "obsidian";

/*
 * Town Forge reads `app.plugins` to detect its companion plugins — Randomness,
 * Templater, Heraldry Weaver, TTRPG Tools: Maps — for the set-up checklist and
 * the export button. That property is real but undeclared in Obsidian's public
 * typings, so without this augmentation every use is a compile error (14 of
 * them) and the checklist code can't be type-checked at all.
 *
 * Types only. Narrow deliberately: these are the two members actually used, so
 * a typo in either is still caught.
 */
declare module "obsidian" {
  interface App {
    plugins: {
      /** Every installed plugin's manifest, keyed by plugin id. */
      manifests: Record<string, { id: string; name: string; version: string } | undefined>;
      /**
       * Instances of *enabled* plugins only, keyed by plugin id. Third-party
       * shapes we don't own (Randomness exposes `.api`, etc), so `any` here is
       * the honest type rather than a cast at every call site.
       */
      plugins: Record<string, any>;
    };
  }
}
