# Changelog

All notable changes to Town Forge are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[Unreleased]: https://github.com/Obsidian-TTRPG-Community/Town-Forge/compare/1.1.1...HEAD
[1.1.1]: https://github.com/Obsidian-TTRPG-Community/Town-Forge/compare/1.1.0...1.1.1
[1.1.0]: https://github.com/Obsidian-TTRPG-Community/Town-Forge/compare/1.0.4...1.1.0
