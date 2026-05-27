# Rich place notes with Randomness + Templater

Town Forge can name every shop, inn, and temple on a map and write a note for each one. On its own it fills those notes from simple templates. If you want each note to roll its *own* flavour — a shop's stock, an innkeeper's temperament, a rumour at the bar — you can wire Town Forge up to two companion plugins:

- **[Randomness](https://github.com/Obsidian-TTRPG-Community/Randomness)** — rolls on random tables (the kind that have powered tabletop generators for twenty years).
- **[Templater](https://community.obsidian.md/plugins/templater-obsidian)** — runs a template's logic the moment a note is created.

The result: Town Forge places a "weapon shop" pin called *Hilt & Pommel*, and the note that appears is already a weapon shop named *Hilt & Pommel*, with rolled stock and a proprietor — no two alike.

This guide sets that up. It's entirely optional; Town Forge works fine without it.

> **The one rule that matters:** Town Forge decides the name; the template only fills the body. Never let a template rename the note. Everything below follows from that. (The troubleshooting section explains why.)

## 1. Install the plugins

From **Settings → Community Plugins → Browse**, install and enable:

1. **Town Forge** (you have it).
2. **[Randomness](https://github.com/Obsidian-TTRPG-Community/Randomness)**.
3. **[Templater](https://community.obsidian.md/plugins/templater-obsidian)**.

If you want pinned, interactive maps, also install **TTRPG Tools: Maps** and turn on **Settings → Town Forge → Enable TTRPG Tools: Maps export**. (The per-place notes are written during that export, so the rest of this guide assumes export is on.)

## 2. Get the settlement tables

The ready-made tables live with the Randomness plugin, because they're useful on their own as PF2e settlement generators — Town Forge just happens to drive them.

1. Download **[`pf2e-settlement-generators.zip`](https://github.com/Obsidian-TTRPG-Community/Randomness/raw/refs/heads/main/demo/pf2e-settlement-generators.zip)** from the Randomness repo (`demo/` folder).
2. In Obsidian, open **Settings → Randomness** and note the **Generator root** — the vault folder Randomness searches for tables. (If it's blank, set it to something like `Generators`.)
3. **Extract the zip into that Generator root folder.** You should end up with the `.ipt` table files sitting inside your Generator root, e.g. `Generators/pf2e-settlement/…`.
4. Open the Randomness **generator browser** (the dice ribbon icon) and confirm the new tables appear. Click **Roll** on one to check it works.

You can roll these tables directly — in a `randomness` codeblock or an inline `` `rdm:` `` call — independently of Town Forge.

## 3. Add a template Town Forge can use

Town Forge writes one note per place during export. For each place it looks in its **template folder** for a note named after the place's type (e.g. `Shop.md`) and copies it, filling in `{{name}}`, `{{type}}`, `{{subtype}}`, and `{{town}}`. Any Templater or Randomness syntax in the template is left untouched and runs when the note is created/opened.

Create `Shop.md` in your Town Forge template folder (default `Templates/TownForge`):

````markdown
---
type: shop
subtype: "{{subtype}}"
town: "{{town}}"
---
<%*
const api = app.plugins.plugins["randomness"].api;
const fm = tp.frontmatter;
// Build the body to MATCH the name + subtype Town Forge already chose.
// No re-rolling the name, no renaming the file.
const shop = await api.rollUnscoped("TF-ShopByType", {
  promptValues: { town: fm.town, shopType: fm.subtype, shopName: fm.name }
});
tR += shop.result;
%>
````

Then point the two plugins at the right folders:

- **Town Forge** → *Template folder* = `Templates/TownForge` (or wherever you keep `Shop.md`).
- **Templater** → *Template folder location* must include that same folder, **and** enable *Trigger Templater on new file creation* (Templater settings) so the `<%* … %>` runs when Town Forge creates the note.

## 4. Make the name and subtype agree

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

…and the template from step 3 reads `fm.subtype` + `fm.name` to roll a body of the right kind with the right name. Name, subtype, and body all agree.

The shop subtypes the tables understand are `general`, `weapon`, `armor`, `alchemy`, and `magic`. Town Forge's Shop pin ships with exactly that list; keep the two in sync (or just use the JS hook, which can't drift).

## 5. Roll and lock

Inline `` `rdm:` `` calls render only in **Reading view** — in Live Preview they show as plain code spans. So after generating notes:

- Switch a note to **Reading view** to see the rolled results.
- Use the Randomness command **Lock all unfilled `rdm:` in current note** to bake the current rolls into the note permanently, or click 🎲 on any inline call to re-roll it.

Codeblock generators (```` ```randomness ````) render in both views.

## Troubleshooting

**The map folder or notes get renamed after a shop, and the export errors (`ENOENT … rename`).**
A template is calling `tp.file.rename()` (or `tp.file.move()`). Remove it. Town Forge has already named the note and pointed the map pin at that name — if the template renames the file, it breaks the pin link, races the export, and re-rolls the name. The template's only job is to fill the body. This is the single most common setup mistake.

**The shop's name and its contents don't match** (e.g. an "alchemist" named shop full of weapons).
The template is rolling a fresh shop (`TF-Shop`) instead of building from the locked values. Roll **`TF-ShopByType`** with `promptValues: { town: fm.town, shopType: fm.subtype, shopName: fm.name }` so the body uses the subtype and name Town Forge already chose.

**Notes have no `subtype`, or the body ignores it.**
Check that the Shop pin's name hook returns `{ name, subtype }` (step 4) and that the template's frontmatter includes `subtype: "{{subtype}}"` (step 3). Without both, there's no subtype for the body roll to match.

**Nothing rolls; the note shows raw `<%* … %>` or `rdm:` text.**
Either Templater isn't set to trigger on new-file creation (step 3), Randomness isn't installed/enabled, or you're looking at Live Preview — switch to Reading view for inline `rdm:` calls.

**`rollUnscoped("TF-ShopPick")` throws / returns nothing.**
The tables aren't where Randomness can find them. Confirm the zip was extracted into the **Generator root** (step 2) and that `TF-ShopPick` shows up in the generator browser. If your table is namespaced under a scope, `rollUnscoped` won't find it.

**A pin shows the wrong icon (or a generic pin).**
That's a TTRPG Tools: Maps icon-library matter, not a names/tables one. Town Forge writes whatever icon key the pin type is set to, but the maps plugin only renders a key whose SVG you've imported into its library. Import the icon, or set the pin to a stock key.

## The pattern, for other place types

Everything above generalises. To give guilds, temples, or any other pin type correlated names and bodies:

1. A `TF-<Type>Pick` table that emits `subtype|name`.
2. A matching `TF-<Type>ByType` table that builds a body from `shopType`/`town`/`name`-style prompts.
3. A pin type whose JS hook splits the pick into `{ name, subtype }`, with its subtype list filled in.
4. A `<Type>.md` template that rolls the `ByType` table from `fm.subtype`/`fm.name` — and never renames the note.

Town Forge already supports this for any pin type; the tables are the only new piece.
