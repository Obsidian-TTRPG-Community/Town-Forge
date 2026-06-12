# Rich place notes with Randomness + Templater

Town Forge can name every shop, inn, and temple on a map and write a note for each one. On its own it fills those notes from simple templates. Wire it up to two companion plugins and each note rolls its *own* flavour — a shop's stock, an innkeeper's temperament, a rumour at the bar — complete with **NPC portraits**:

- **[Randomness](https://github.com/Obsidian-TTRPG-Community/Randomness)** — rolls on random tables, generates seeded character portraits with names, and ships the whole settlement content bundle ("Fantasy Hub").
- **[Templater](https://community.obsidian.md/plugins/templater-obsidian)** — runs a template's logic the moment a note is created.

The result: Town Forge places a "weapon shop" pin called *Hilt & Pommel*, and the note that appears is already a weapon shop named *Hilt & Pommel* — rolled stock, a named proprietor with a portrait infobox, and a customer browsing the racks. No two alike.

This is entirely optional; Town Forge works fine without it.

> **The one rule that matters:** Town Forge decides the name; the template only fills the body. Never let a template rename the note. Everything below follows from that. (The troubleshooting section explains why.)

## 1. Install the plugins

From **Settings → Community Plugins → Browse**, install and enable:

1. **Town Forge** (you have it).
2. **[Randomness](https://github.com/Obsidian-TTRPG-Community/Randomness)** (1.1.0+).
3. **[Templater](https://community.obsidian.md/plugins/templater-obsidian)**.

If you want pinned, interactive maps, also install **TTRPG Tools: Maps** and turn on **Settings → Town Forge → Enable TTRPG Tools: Maps export**. (The per-place notes are written during that export, so the rest of this guide assumes export is on.)

## 2. Install the content — two buttons

Open **Settings → Randomness**:

1. **Install Fantasy Portrait Pack** — the portrait art (~7 MB). Portraits stay off until this is installed.
2. **Install Fantasy Hub content** — the settlement generators (five stocked shop types, tavern, inn, temple, castle, guild, barracks, market and more) **and the Town Forge templates**. This button also **points Town Forge's template folder at those templates automatically** and opens a *Start Here* note.

That's the tables, the templates, and the Town Forge configuration done. (Offline, or prefer manual? The same template set ships in this repo as `Examples/TownForge-Templates.zip` — extract it and set **Town Forge → Template folder** to the extracted folder, using forward slashes.)

## 3. The one manual switch: Templater

Enable **Templater → "Trigger Templater on new file creation"** and accept the warning. This is what makes the template logic run inside the notes Town Forge creates. Two things to know:

- It's a **per-device** setting in current Templater — vault sync won't carry it; flip it on each machine.
- The "Template matching mode" dropdown that appears can stay **None**.

## 4. Make the name and subtype agree (recommended)

The tables include a picker, **`TF-ShopPick`**, that returns a subtype and a matching name from a single roll, as `subtype|name` (for example `alchemy|The Smoking Alembic`). Town Forge's pin name hook splits that into both values.

In **Settings → Town Forge → Pin types**, find **Shop**, set its name mode to **custom JS**, and use:

```javascript
const pick = (await api.rollUnscoped("TF-ShopPick")).result; // "alchemy|The Smoking Alembic"
const i = pick.indexOf("|");
if (i < 0) return pick;                                       // no pipe → treat as name only
return { name: pick.slice(i + 1).trim(), subtype: pick.slice(0, i).trim() };
```

That hook returns `{ name, subtype }`. Town Forge writes both into the note's frontmatter:

```yaml
type: shop
subtype: alchemy
town: "Frostkey"
name: "The Smoking Alembic"
```

…and the Shop template reads `fm.subtype` + `fm.name` to roll a body of the right kind with the right name. Name, subtype, and body all agree. (With the builtin name mode the templates still work — the shop just gets a name from Town Forge's own lists instead of a subtype-matched one.)

The shop subtypes the tables understand are `general`, `weapon`, `armor`, `alchemy`, and `magic`. Town Forge's Shop pin ships with exactly that list; keep the two in sync (or just use the JS hook, which can't drift).

## 5. Stamp the town

Generate and export. Every place note arrives with:

- a **portrait infobox** for the keeper/commander/priest — name, race, gender, age — where the rolled text describes the *same* person (the templates pass the portrait's facts into the table rolls);
- rolled stock, prices, hooks, and a customer or extra faces where it fits;
- crests on castles and guilds if **[Heraldry Weaver](https://github.com/Obsidian-TTRPG-Community)** is installed, styled infoboxes with the **ITS theme**.

Inline `` `rdm:` `` calls and portraits render in **Reading view**. Use the Randomness command **Lock all unfilled `rdm:` in current note** to bake rolls permanently; portraits in the templates are already pinned (locked recipes) from birth.

## Troubleshooting

**The map folder or notes get renamed after a shop, and the export errors (`ENOENT … rename`).**
A template is calling `tp.file.rename()` (or `tp.file.move()`). Remove it. Town Forge has already named the note and pointed the map pin at that name — if the template renames the file, it breaks the pin link, races the export, and re-rolls the name. The template's only job is to fill the body. This is the single most common setup mistake.

**Every pin prompts me for a town name and size during export.**
Town Forge is pointed at Fantasy Hub's *standalone* templates (`…/fantasy-hub/templates`) instead of the Town Forge set (`…/fantasy-hub/townforge-templates`). The standalone set is for inserting into a note by hand; the Town Forge set never prompts. Re-run **Install Fantasy Hub content** (it repoints the folder), or fix **Town Forge → Template folder** yourself — with forward slashes.

**The shop's name and its contents don't match** (e.g. an "alchemist" named shop full of weapons).
The template is rolling a fresh shop (`TF-Shop`) instead of building from the locked values. Roll **`TF-ShopByType`** with `promptValues: { town: fm.town, shopType: fm.subtype, shopName: fm.name }` so the body uses the subtype and name Town Forge already chose.

**Notes have no `subtype`, or the body ignores it.**
Check that the Shop pin's name hook returns `{ name, subtype }` (step 4) and that the template's frontmatter includes `subtype: "{{subtype}}"`. Without both, there's no subtype for the body roll to match.

**Nothing rolls; the note shows raw `<%* … %>` or `rdm:` text.**
Either Templater isn't set to trigger on new-file creation (step 3 — remember it's per-device), Randomness isn't installed/enabled, or you're looking at Live Preview — switch to Reading view for inline `rdm:` calls.

**Portraits don't appear; infoboxes say "portrait pack not found".**
Install the pack: **Settings → Randomness → Install Fantasy Portrait Pack**. The templates degrade to text-only without it.

**`rollUnscoped("TF-ShopPick")` throws / returns nothing.**
The tables aren't where Randomness can find them. Confirm **Install Fantasy Hub content** completed (the generators live under your Randomness Generator root in `fantasy-hub/generators/`, as `.rdm` files) and that `TF-ShopPick` shows up in the generator browser.

**A pin shows the wrong icon (or a generic pin).**
That's a TTRPG Tools: Maps icon-library matter, not a names/tables one. Town Forge writes whatever icon key the pin type is set to, but the maps plugin only renders a key whose SVG you've imported into its library. Import the icon, or set the pin to a stock key.

## The pattern, for other place types

Everything above generalises. To give guilds, temples, or any other pin type correlated names and bodies:

1. A `TF-<Type>Pick` table that emits `subtype|name`.
2. A matching `TF-<Type>ByType` table that builds a body from `shopType`/`town`/`name`-style prompts.
3. A pin type whose JS hook splits the pick into `{ name, subtype }`, with its subtype list filled in.
4. A `<Type>.md` template that rolls the `ByType` table from `fm.subtype`/`fm.name` — and never renames the note.

The shipped templates also pass the portrait NPC's facts in as prompts (`keeperName`, `keeperRace`, `keeperGender`, `keeperAge`, `keeperDesc`; shops add `custName`/`custRace`/`custDesc`) — that's the contract that keeps the face, the name, and the prose describing one person. Any generator that accepts those prompts (falling back to its own rolls when they're empty) plugs straight into the same pattern.
