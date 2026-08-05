# Changelog

All notable changes to Town Forge are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.2.1] - 2026-08-05

Maintenance release: no gameplay or generation changes. It clears the two errors
raised by the Obsidian community-plugin review of 1.2.0.

### Changed

- **Styling moved out of the code and into `styles.css`.** All 218 inline
  `element.style.*` assignments in the settings tab, the rendered map block and
  the preview panel are now CSS classes (`tf-s-*` for the settings/render side,
  `tf-p-*` for the panel), so themes and CSS snippets can finally restyle Town
  Forge. The handful of genuinely dynamic values — pan/zoom transform, per-field
  widths, drag cursor, tri-state landmark buttons, row visibility — use
  `setCssStyles`/`toggleClass` instead. Nothing looks different.
- **`minAppVersion` raised to 1.7.2**, which is the version that introduced the
  awaitable `Workspace.revealLeaf` the panel uses.
- **The plugin's own settings object is no longer called `settings`.** Obsidian
  1.13 added a `settings` property to `Plugin` itself; ours is now `tfSettings`
  so the two can't collide. Saved settings are untouched — the on-disk format
  and `data.json` are unchanged.
- Release assets are now attested with GitHub build provenance, `styles.css`
  ships alongside `main.js`/`manifest.json`, and `versions.json` is no longer
  attached (Obsidian never downloaded it). A committed `package-lock.json` makes
  the build byte-for-byte reproducible.
- Minor lint tidy-ups: `createEl("div"|"span")` → `createDiv`/`createSpan`, and
  `setTimeout` → `window.setTimeout` for popout-window compatibility.

## [1.2.0] - 2026-08-02

### Added

- **Unique NPC names across a town.** Place templates now draw NPC names from
  the Fantasy Hub's new `TF-PersonName` pool (tens of thousands of race- and
  gender-appropriate names, versus the few hundred the portrait module's
  built-in list could produce) and check each one against a `cast` list kept in
  the map folder's town note. A name already used elsewhere in the settlement is
  rerolled, and the town note ends up with a roster of everyone the map named.
  Falls back to the portrait's own name — and to plain rolls — when the Fantasy
  Hub content or the town note isn't there, so a template used on its own still
  works.
- **Heraldry Weaver in the set-up checklist.** The castle and guild templates
  render their crests through Heraldry Weaver, so it now appears as step 3 of
  *Create place templates*, alongside the existing shield button that installs
  it. Installed-but-disabled is reported separately from not-installed. Like the
  Templater step it doesn't gate the button — only the Fantasy Hub check does.

## [1.1.1] - 2026-07-11

### Fixed

- **Create place templates no longer triggers Templater prompts.** The template
  folder is now added to Templater's excluded-folders list automatically, so
  Templater's *Trigger on new file creation* won't execute the template files as
  they're written — which previously popped up "Settlement size?" / "Town name?"
  prompts and could overwrite the templates. Stamped place notes still run
  normally, since they land in the (un-excluded) export folder.

### Changed

- **Preview panel action bar** — the status line, Generate / Same seed, and the
  Copy / Insert / Save / Export buttons now sit in a sticky footer that stays
  visible at any panel width, with wrapping button rows so nothing is cut off.
  Reaching Export no longer requires resizing the panel.

## [1.1.0] - 2026-07-11

### Added

- **Map from note Properties** — keep a map's settings in the note's Properties
  instead of the code block. Prefix any config key with `townforge-` (e.g.
  `townforge-terrain`, `townforge-seed`, `townforge-settlement`) and leave the
  block empty; the map reads them from the note it sits in. List properties
  become letter runs (`townforge-edges: [N, E]` → `NE`) and checkbox properties
  work as on/off.
- **Draw a map from another note** — a `from: [[Note]]` (or `source: [[Note]]`)
  line in a `town-forge` block renders a map from that note's Properties. Explicit
  lines in the block still override.

### Changed

- **Set-up readiness checklist** on *Create place templates* — a live checklist
  (Randomness, Templater trigger, Fantasy Portrait Pack, Fantasy Hub content)
  that turns green as each piece is in place and only enables the button once the
  generators are actually detected. The description now states the Fantasy Hub
  dependency as a prerequisite.
- Correctly detect Templater's *Trigger on new file creation* toggle, which is a
  per-device setting, so the checklist reflects it accurately.

### Documentation

- Documented "Map from note Properties" in the README.
- Corrected the documented `farms` / `forest` range to `0–4`.

## [1.0.4] and earlier

Initial public releases (map generation, settlements, landmarks, the live
preview panel, code blocks, and TTRPG Tools: Maps export). These predate this
changelog — see the [commit history](https://github.com/Obsidian-TTRPG-Community/Town-Forge/commits/main)
for details.

[Unreleased]: https://github.com/Obsidian-TTRPG-Community/Town-Forge/compare/1.2.0...HEAD
[1.2.0]: https://github.com/Obsidian-TTRPG-Community/Town-Forge/compare/1.1.1...1.2.0
[1.1.1]: https://github.com/Obsidian-TTRPG-Community/Town-Forge/compare/1.1.0...1.1.1
[1.1.0]: https://github.com/Obsidian-TTRPG-Community/Town-Forge/compare/1.0.4...1.1.0
