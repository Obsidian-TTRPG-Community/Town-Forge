/*
 * Shared geometry and RNG types.
 *
 * src/ was reconstructed by decompiling an esbuild bundle, so it arrived with
 * every annotation erased — which is why the plugin review reports thousands of
 * `no-unsafe-*` findings. They almost all trace back to two things: function
 * parameters with no declared type, and class fields assigned in a constructor
 * but never declared. Annotating a module's boundary fixes it and everything
 * downstream of it, so these shared aliases are the foundation for that work.
 *
 * Types only — this file emits no JavaScript and cannot change the bundle.
 */

/** A 2D point. The single most common shape in the codebase. */
export interface Point {
  x: number;
  y: number;
}

/** An open polyline or a closed polygon; the distinction is by use, not type. */
export type Poly = Point[];

/** A seeded random source returning [0, 1). Produced by `makeRng`. */
export type Rng = () => number;

/** Which map edges a feature applies to. */
export interface EdgeFlags {
  N: boolean;
  E: boolean;
  S: boolean;
  W: boolean;
}

/**
 * The preview panel's live control state — what the sliders, dropdowns and
 * tri-state buttons are currently set to. Persisted across `rebuild()` so an
 * in-progress map survives a settings toggle.
 *
 * The tri-state fields (walls/castle/temple/market/barracks/tower) are
 * "auto" | "on" | "off", and `direction` is one of DIRECTIONS; they are typed as
 * string because the values are compared against the exported arrays above
 * rather than a union.
 */
export interface MapState {
  terrain: string;
  seed: string;
  name: string;
  mode: string;
  settlement: string;
  roughness: number;
  octaves: number;
  direction: string;
  mountainEdges: EdgeFlags;
  edges: EdgeFlags;
  edgesAuto: boolean;
  farm: number;
  forest: number;
  mountain: number;
  walls: string;
  castle: string;
  temple: string;
  market: string;
  barracks: string;
  tower: string;
}

/** Word lists a pin type draws names from when `nameMode` is "builtin". */
export interface PinNameLists {
  surnames?: string[];
  adjectives?: string[];
  nouns?: string[];
  proper?: string[];
}

/**
 * One configurable pin type: what gets placed on the map and what note is
 * written for it. `anchored` types attach to a real structure Town Forge builds
 * (castle, dock…), `sampled` types scatter over ordinary houses, `both` does
 * either. `nameJs` is the user-authored name hook, used when nameMode is "js".
 */
export interface PinType {
  id: string;
  noteType: string;
  enabled: boolean;
  icon: string;
  layerName: string;
  placement: string;
  countMin: number;
  countMax: number;
  countMode: string;
  nameMode: string;
  anchor?: string;
  nameLists?: PinNameLists;
  nameJs?: string;
  subtypes?: string[];
}

/**
 * Persisted plugin settings (data.json). Named `tfSettings` on the plugin rather
 * than `settings`, because Obsidian 1.13 added a `settings` property to `Plugin`
 * itself and the two would collide — see CHANGELOG 1.2.1.
 */
export interface TownForgeSettings {
  scaleMultiplier: number;
  distanceUnit: string;
  exportFolder: string;
  templateFolder: string;
  pinTypes: PinType[];
  openAfterExport: boolean;
  groupNotesByType: boolean;
  enableZoomMapExport: boolean;
  showTroubleshoot: boolean;
}

/**
 * A parsed `town-forge` code block (or the `townforge-*` note properties that
 * stand in for one). Only the first eight keys are always present — the rest are
 * written by `parseConfig` as it encounters the matching lines, so they are
 * optional here.
 */
export interface MapConfig {
  terrain: string;
  seed: string;
  size: number;
  roughness: number;
  octaves: number;
  mode: string;
  settlement: string;
  landmarks: Record<string, unknown>;
  name?: string;
  unit?: string;
  scale?: number;
  seaSide?: string;
  mountainSide?: string;
  peaks?: number;
  forest?: number;
  farms?: number;
  edges?: EdgeFlags;
}

/**
 * A generated map. Built up in stages by `generateFull` — terrain and water
 * first, then roads, then what sits on the blocks — so every field beyond
 * `terrain` is optional and populated only for the modes that produce it.
 *
 * The member types are still `unknown`-free `any` placeholders: modelling
 * polygons, lots and building footprints properly is the next piece of work.
 * Declaring the keys is what lets the compiler catch a misspelt stage name.
 */
export interface Scene {
  terrain: string;
  water: any;
  centreline: any;
  ridges: any;
  riverWidth?: number;
  mountains?: any;
  mountainSide?: any;
  roads?: any;
  outlanes?: any;
  walls?: any;
  street_base?: any;
  houses?: any;
  outbuildings?: any;
  footprint?: any;
  parks?: any;
  forests?: any;
  farms?: any;
  dock?: any;
  landmarks?: any;
}
