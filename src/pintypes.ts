export var SCALE_REFERENCE_HOUSES = 600;
export var SHOP_LISTS = {
  surnames: ["Oakhart", "Vance", "Hollick", "Jessop", "Pemberton", "Ironhand", "Foxglove", "Thornwood", "Ashby", "Crane", "Marlow", "Pike", "Quill", "Rooke", "Sallow", "Tanner", "Underhill", "Welk", "Brightwater", "Dunmore", "Fenwick", "Garrow"],
  adjectives: ["Sleeping", "Crooked", "Salty", "Drunken", "Rusty", "Silver", "Broken", "Weeping", "Faithful", "Singing", "One-Eyed", "Gilded", "Whistling", "Hollow"],
  nouns: ["Forge", "Smithy", "Apothecary", "Herbalist", "Mercantile", "General Goods", "Tannery", "Bakery", "Curiosities", "Provisioner", "Cooperage", "Chandlery"]
};
export var INN_LISTS = {
  surnames: ["Bramble", "Hart", "Crow", "Stagg", "Mead", "Barrow", "Finch", "Hale"],
  adjectives: ["Weeping", "Broken", "Salty", "Rusty", "Crooked", "Faithful", "Singing", "One-Eyed", "Silver", "Drunken", "Sleeping", "Laughing", "Prancing", "Gilded"],
  nouns: ["Anchor", "Lantern", "Tower", "Bell", "Hare", "Fox", "Eagle", "Stag", "Tankard", "Crown", "Barrel", "Hound"]
};
export var GENERIC_LISTS = {
  surnames: ["Oakhart", "Vance", "Hollick", "Thornwood", "Ashby", "Marlow", "Dunmore", "Fenwick"],
  adjectives: ["Old", "New", "North", "South", "High", "Low", "Stone", "River"],
  nouns: ["House", "Place", "Yard", "Holding", "Lodge", "Hall"]
};
export var DEFAULT_PIN_TYPES = [
  // Anchored to real structures Town Forge builds.
  { id: "castle", noteType: "Castle", enabled: true, icon: "castle", layerName: "Civic", placement: "anchored", anchor: "castle", countMin: 1, countMax: 1, countMode: "fixed", nameMode: "builtin", nameLists: { surnames: [], adjectives: [], nouns: [], proper: ["The Keep", "Castle Greymark", "Castle Thorn", "The Citadel", "Highhold Keep", "Castle Vance", "The Old Castle", "Ravenshold"] } },
  { id: "cathedral", noteType: "Temple", enabled: true, icon: "place-of-worship", layerName: "Religious", placement: "anchored", anchor: "cathedral", countMin: 1, countMax: 1, countMode: "fixed", nameMode: "builtin", nameLists: { surnames: [], adjectives: [], nouns: [], proper: ["The Temple of Light", "Shrine of Saint Aldric", "The Grand Cathedral", "Chapel of Saint Mirelle", "The High Sanctuary", "Temple of the Dawn"] } },
  { id: "market", noteType: "Market", enabled: true, icon: "circle_black_city", layerName: "Civic", placement: "anchored", anchor: "market", countMin: 1, countMax: 1, countMode: "fixed", nameMode: "builtin", nameLists: { surnames: [], adjectives: [], nouns: [], proper: ["Market Square", "The Old Market", "The Grand Exchange", "Market Cross", "The Trade Square"] } },
  { id: "barracks", noteType: "Barracks", enabled: true, icon: "shield", layerName: "Civic", placement: "anchored", anchor: "barracks", countMin: 1, countMax: 1, countMode: "fixed", nameMode: "builtin", nameLists: { surnames: [], adjectives: [], nouns: [], proper: ["The Garrison", "The Watch House", "Town Barracks", "The Old Garrison", "The Guardhouse"] } },
  { id: "tower", noteType: "Tower", enabled: true, icon: "pinRed", layerName: "Landmarks", placement: "anchored", anchor: "tower", countMin: 1, countMax: 1, countMode: "fixed", nameMode: "builtin", nameLists: { surnames: [], adjectives: [], nouns: [], proper: ["The Lonely Tower", "Blackspire", "Ravenspire", "The Mage's Tower", "The Old Tower", "Greywatch Tower", "The Spire", "Thornwatch"] } },
  { id: "dock", noteType: "Dock", enabled: true, icon: "anchor", layerName: "Infrastructure", placement: "anchored", anchor: "dock", countMin: 1, countMax: 1, countMode: "fixed", nameMode: "builtin", nameLists: { surnames: [], adjectives: [], nouns: [], proper: ["The Docks", "The Wharf", "The Quay", "North Wharf", "The Harbour", "The Riverside Docks"] } },
  { id: "mill", noteType: "Mill", enabled: true, icon: "wheat", layerName: "Infrastructure", placement: "anchored", anchor: "mill", countMin: 1, countMax: 2, countMode: "fixed", nameMode: "builtin", nameLists: { surnames: ["Oakhart", "Welk", "Garrow", "Pike"], adjectives: ["Old", "River", "Lower", "Upper"], nouns: ["Mill", "Watermill", "Millhouse"], proper: ["The Old Mill", "Riverside Mill", "Lower Watermill"] } },
  { id: "stable", noteType: "Stable", enabled: true, icon: "horseshoe", layerName: "Infrastructure", placement: "anchored", anchor: "stable", countMin: 1, countMax: 2, countMode: "fixed", nameMode: "builtin", nameLists: { surnames: ["Hart", "Stagg", "Crane", "Marlow"], adjectives: ["Old", "Town", "North"], nouns: ["Stables", "Livery", "Mews"] } },
  { id: "farm", noteType: "Farm", enabled: true, icon: "wheat", layerName: "Rural", placement: "anchored", anchor: "farm", countMin: 1, countMax: 4, countMode: "scaled", nameMode: "builtin", nameLists: { surnames: ["Oakhart", "Welk", "Garrow", "Fenwick", "Brightwater", "Dunmore"], adjectives: ["Old", "North", "South", "Hill", "River", "Green"], nouns: ["Farm", "Steading", "Holding", "Grange"] } },
  // Sampled over ordinary houses.
  { id: "shop", noteType: "Shop", enabled: true, icon: "shop", layerName: "Shops", placement: "sampled", countMin: 8, countMax: 14, countMode: "scaled", nameMode: "builtin", nameLists: SHOP_LISTS, subtypes: ["general", "weapon", "armor", "alchemy", "magic"] },
  { id: "inn", noteType: "Inn", enabled: true, icon: "beer-stein", layerName: "Taverns & Inns", placement: "both", anchor: "inn", countMin: 3, countMax: 7, countMode: "scaled", nameMode: "builtin", nameLists: INN_LISTS }
];
export function newCustomPinType() {
  return {
    id: "custom_" + Math.random().toString(36).slice(2, 8),
    noteType: "Place",
    enabled: true,
    icon: "circle_black_city",
    layerName: "Places",
    placement: "sampled",
    countMin: 1,
    countMax: 3,
    countMode: "scaled",
    nameMode: "builtin",
    nameLists: GENERIC_LISTS
  };
}
export function parsePinTypesJson(json) {
  let raw;
  try {
    raw = JSON.parse(json);
  } catch (e) {
    return { error: `Invalid JSON: ${e instanceof Error ? e.message : String(e)}` };
  }
  if (!Array.isArray(raw))
    return { error: "Top level must be an array of pin types." };
  const types = [];
  const seenIds = /* @__PURE__ */ new Set();
  for (let i = 0; i < raw.length; i++) {
    const o = raw[i];
    if (typeof o !== "object" || o === null)
      return { error: `Item ${i} is not an object.` };
    const noteType = String(o.noteType ?? "").trim();
    if (!noteType)
      return { error: `Item ${i}: "noteType" is required.` };
    let id = String(o.id ?? "").trim() || noteType.toLowerCase().replace(/\s+/g, "_");
    while (seenIds.has(id))
      id = id + "_";
    seenIds.add(id);
    const placement = o.placement === "anchored" ? "anchored" : o.placement === "both" ? "both" : "sampled";
    const countMode = o.countMode === "fixed" ? "fixed" : "scaled";
    const nameMode = o.nameMode === "js" ? "js" : "builtin";
    const min = Math.max(0, Math.floor(Number(o.countMin ?? 1)) || 0);
    const max = Math.max(min, Math.floor(Number(o.countMax ?? min)) || min);
    const t = {
      id,
      noteType,
      enabled: o.enabled !== false,
      icon: String(o.icon ?? "circle_black_city").trim() || "circle_black_city",
      layerName: String(o.layerName ?? "Places").trim() || "Places",
      placement,
      countMin: min,
      countMax: max,
      countMode,
      nameMode
    };
    if ((placement === "anchored" || placement === "both") && typeof o.anchor === "string")
      t.anchor = o.anchor;
    if (nameMode === "js") {
      t.nameJs = String(o.nameJs ?? "");
    } else {
      const nl = o.nameLists ?? {};
      t.nameLists = {
        surnames: toStrArr(nl.surnames, GENERIC_LISTS.surnames),
        adjectives: toStrArr(nl.adjectives, GENERIC_LISTS.adjectives),
        nouns: toStrArr(nl.nouns, GENERIC_LISTS.nouns)
      };
      if (Array.isArray(nl.proper)) {
        const p = nl.proper.map((x) => String(x)).filter((s) => s.length > 0);
        if (p.length)
          t.nameLists.proper = p;
      }
    }
    if (Array.isArray(o.subtypes)) {
      const st = o.subtypes.map((x) => String(x).trim()).filter((s) => s.length > 0);
      if (st.length)
        t.subtypes = st;
    }
    types.push(t);
  }
  return { types };
}
export function toStrArr(v, fallback) {
  if (!Array.isArray(v))
    return [...fallback];
  const out = v.map((x) => String(x)).filter((s) => s.length > 0);
  return out.length ? out : [...fallback];
}
export function pinTypesToJson(types) {
  return JSON.stringify(types, null, 2);
}
