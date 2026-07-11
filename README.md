# Town Forge

An [Obsidian](https://obsidian.md) plugin that **procedurally generates fantasy maps for tabletop RPGs.**

From a seed and a few choices, Town Forge builds a complete map — terrain, forests, mountains, roads, and a settlement ranging from a lonely hamlet to a sprawling metropolis — in a polished cartographic style. Drop a `town-forge` code block into a note, or use the live preview panel to dial everything in, then insert the map as an image, save a PNG, or export it to the **TTRPG Tools: Maps** plugin as an interactive, pinned map.

## Features

- **Procedural terrain** — river, coastal, lake, mountain, and inland maps, each generated deterministically from a seed.
- **Settlements** — hamlet, village, small town, town, and large town, plus the city tier (small city, city, large city, metropolis) with organic street layouts, districts, city walls, and bridged rivers.
- **Landmarks** — castle, cathedral/temple, market, barracks, waterfront docks, mills, stables, and a rare isolated **tower** (the wizard/necromancer's retreat) placed out by a forest or mountain edge with its own path back to the road.
- **Live preview panel** — open the side panel (map ribbon icon, or the "Open map preview" command) to adjust terrain, settlement size, approach roads, forest/farm/mountain density, and which landmarks appear — regenerating as you go.
- **Code blocks** — embed a map in any note with a ```` ```town-forge ```` block; it renders inline and stays reproducible by seed.
- **TTRPG Tools: Maps export (optional, off by default)** — export an interactive map with pins, plus one note per place (shops, inns, temples, …) generated from your own templates. Pin types are fully configurable: what gets placed, how it's named, which note type and template it uses, and which icon and layer it lands on.
- **Deterministic** — the same seed always produces the same map.

## Install

### Via BRAT (recommended while in beta)

1. Install the [BRAT](https://github.com/TfTHacker/obsidian42-brat) plugin if you don't have it.
2. Open BRAT settings → Add Beta Plugin → enter this repo's URL.
3. Enable "Town Forge" under Community Plugins.

### Manually

1. Download `main.js`, `manifest.json`, and `versions.json` from the latest [release](https://github.com/Obsidian-TTRPG-Community/Town-Forge/releases).
2. Copy them into `.obsidian/plugins/town-forge/` inside your vault.
3. Enable "Town Forge" under Settings → Community Plugins.

## Usage

### The preview panel

Click the **map** ribbon icon (or run **Town Forge: open map preview**) to open the side panel. Choose a terrain, settlement size, and options; the map regenerates as you change them. From the panel you can:

- **Copy code** — copy a `town-forge` code block for the current map.
- **Insert** — insert that block into the active note.
- **Save PNG** — save the rendered image into your vault.
- **Export to TTRPG Tools: Maps** — (when enabled in settings) write a folder with the PNG, an interactive map note, and per-place notes.

### Code blocks

Embed a map in any note. Every field is optional except that a seed makes the map reproducible:

````
```town-forge
terrain: river
seed: frostkey
mode: full
settlement: city
```
````

Full list of keys:

| Key | Values | Notes |
| --- | --- | --- |
| `terrain` | `river`, `coastal`, `lake`, `mountain`, `inland` | |
| `seed` | any text | Same seed → same map |
| `name` | any text | Title shown on the map |
| `mode` | `full`, `landscape` | `full` places a settlement; `landscape` is terrain only |
| `settlement` | `hamlet` … `metropolis` | Settlement size (full mode) |
| `size` | pixel size | Output image size override |
| `scale` | number | Real-world distance the map width represents |
| `unit` | text | Scale-bar unit (e.g. `miles`, `km`) |
| `edges` | `N`, `E`, `S`, `W` (any combination) | Which sides have approach roads |
| `farms` | `0`–`4` | Farm density multiplier |
| `forest` | `0`–`4` | Forest density multiplier |
| `seaside` | `N`/`E`/`S`/`W` | Sea direction (coastal) |
| `mtnedges` | `N`, `E`, `S`, `W` | Sides a mountain range enters from |
| `mtnsize` / `peaks` | `0`–`12` | Mountain extent |
| `roughness`, `octaves` | numbers | Terrain noise tuning |
| `walls`, `castle`, `temple`, `market`, `barracks`, `tower` | `on` / `off` | Force a landmark on or off |

### Map from note Properties

Instead of writing settings inside the block, you can keep them in the note's **Properties** (frontmatter) and leave the block empty. Prefix any key from the table above with `townforge-`, and the map reads them from the note it sits in:

````
---
townforge-terrain: river
townforge-seed: frostkey
townforge-mode: full
townforge-settlement: city
townforge-walls: true
---

```town-forge
```
````

List properties become letter runs (`townforge-edges: [N, E]` → `NE`) and checkbox properties become on/off (handy for `townforge-walls`, `townforge-castle`, …).

You can also draw a map from **another** note's Properties with a `from:` (or `source:`) link — no duplication:

````
```town-forge
from: [[Frostkey]]
```
````

Explicit lines inside the block always override Properties, so existing blocks behave exactly as before. A missing or empty linked note is reported in the block's "Config notes" line rather than failing.

### Exporting to TTRPG Tools: Maps

Town Forge can hand a finished map to the [TTRPG Tools: Maps](https://obsidian.md/plugins?id=zoom-map) community plugin (formerly Zoom Map) as an interactive, pinned map. This is **off by default** — turn it on in **Settings → Town Forge → Enable TTRPG Tools: Maps export**.

When enabled, **Export to TTRPG Tools: Maps** creates, inside your configured export folder:

- `<Town>/<Town>.png` — the map image
- `<Town>/<Town>.png.markers.json` — the pin sidecar the maps plugin reads
- `<Town>/<Town>.md` — a note with a `zoommap` code block that renders the map
- one note per place (shops, inns, temples, …), optionally grouped into per-type subfolders

#### Pin types

Each **pin type** controls a category of marker: what building it anchors to (or whether it scatters across houses), how many appear, how they're named, the note type and template they use, the icon, and the map layer. You can edit pin types in settings, add your own, or edit them all as JSON.

Names come from either built-in word lists or a **custom JS hook**. A hook can return a plain string (the name), or `{ name, subtype }` to set both — useful for keeping a place's name and its kind in sync. Hooks have `app`, `api`, `seed`, `town`, `type`, `index`, and `subtypes` in scope.

#### Templates

When a place is pinned, Town Forge looks for a template note named after the place's note type (e.g. `Shop.md`) in your template folder and copies it as the place's note, filling `{{name}}`, `{{type}}`, `{{subtype}}`, and `{{town}}`. Any [Randomness](https://github.com/Obsidian-TTRPG-Community/Randomness) or Templater syntax in the template is left intact and resolves when the note is opened. If no template exists for a type, a simple default note is written.

> For a full walkthrough of wiring up rich, self-rolling place notes with **Randomness** and **Templater** — including ready-made settlement tables — see [docs/randomness-templater-setup.md](docs/randomness-templater-setup.md).

> **Icons:** TTRPG Tools: Maps renders icons from a user-configured library. Town Forge writes the icon key you set per pin type, but a key only renders if it exists in your maps-plugin icon library. The defaults use stock keys; customise per type once you've imported the icons you want.

## Settings

- **Map scale** — distance unit and a global scale multiplier.
- **Enable TTRPG Tools: Maps export** — master switch for the export button and all export options (off by default).
- **Export folder / Template folder** — where exports and per-place templates live.
- **Open note after export** — open the generated map note when an export finishes.
- **Group place notes by type** — write place notes into per-type subfolders.
- **Pin types** — the full pin-type editor, plus a visual **building key** and an advanced JSON editor.
- **Show troubleshooting button** — show a button in the panel that copies the full config for bug reports (off by default).

## Companion plugins

- **[TTRPG Tools: Maps](https://obsidian.md/plugins?id=zoom-map)** — renders the interactive, pinned maps Town Forge exports.
- **[Randomness](https://github.com/Obsidian-TTRPG-Community/Randomness)** — drives rich, correlated place names and note bodies from your templates.

Both are optional. Town Forge generates and renders maps on its own; these extend what you can do with the exported places.

## Development

```
npm install      # one-time setup
npm run build    # typecheck + bundle to main.js
npm run dev      # watch build
```

The renderer draws to a standard DOM canvas, so the plugin runs on both desktop and mobile.

## Acknowledgements

- **RedReaper21** — for extensive help testing and tuning the plugin; many of its rough edges were found and smoothed thanks to that feedback.
- **Jareika** — for [TTRPG Tools: Maps](https://github.com/Jareika/zoom-map) (formerly Zoom Map), the plugin Town Forge exports its interactive, pinned maps to.
- **[Randomness](https://github.com/Obsidian-TTRPG-Community/Randomness)** — the companion generator plugin that drives correlated place names and note bodies from templates.

## License

MIT — see [LICENSE](LICENSE).

Map rendering, terrain, and settlement generation are original to this plugin. Exported maps are intended for use with the TTRPG Tools: Maps plugin; that plugin and Randomness are separate works by their respective authors.
