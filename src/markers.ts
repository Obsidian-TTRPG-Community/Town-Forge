import { SCALE_REFERENCE_HOUSES } from "./pintypes";
import { hash32, makeRng } from "./rng";

export function pointInPoly3(p, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    if (poly[i].y > p.y !== poly[j].y > p.y && p.x < (poly[j].x - poly[i].x) * (p.y - poly[i].y) / (poly[j].y - poly[i].y) + poly[i].x) {
      inside = !inside;
    }
  }
  return inside;
}
export function anchorCentres(scene, anchor) {
  switch (anchor) {
    case "castle":
    case "cathedral":
    case "market":
    case "barracks":
    case "tower":
      return (scene.landmarks || []).filter((l) => l.type === anchor).map((l) => l.centre);
    case "dock": {
      const d = scene.dock;
      if (!d)
        return [];
      if (d.shorePt)
        return [d.shorePt];
      if (d.quay && d.quay.length)
        return [centroid(d.quay)];
      return [];
    }
    case "mill":
    case "stable":
    case "inn":
    case "generic":
      return (scene.outbuildings || []).filter((o) => o.type === anchor).map((o) => o.centre);
    case "farm":
      return (scene.farms || []).map((f) => f.house ?? (f.polygon ? centroid(f.polygon) : null)).filter((p) => !!p);
    default:
      return [];
  }
}
export function centroid(poly) {
  return { x: poly.reduce((s, p) => s + p.x, 0) / poly.length, y: poly.reduce((s, p) => s + p.y, 0) / poly.length };
}
export function rollCount(rng, t, houseCount) {
  const span = Math.max(0, t.countMax - t.countMin);
  let n = t.countMin + Math.floor(rng() * (span + 1));
  if (t.countMode === "scaled") {
    const ratio = houseCount / SCALE_REFERENCE_HOUSES;
    n = Math.round(n * ratio);
    if (t.countMin >= 1 && n < 1 && houseCount > 0 && rng() < houseCount / SCALE_REFERENCE_HOUSES * t.countMin + 0.15)
      n = 1;
  }
  return Math.max(0, n);
}
export function spreadSample(pool, count, rng, avoid) {
  if (!pool.length || count <= 0)
    return [];
  const cx = pool.reduce((s, p) => s + p.x, 0) / pool.length;
  const cy = pool.reduce((s, p) => s + p.y, 0) / pool.length;
  const withD = pool.map((p, i) => ({ i, d: Math.hypot(p.x - cx, p.y - cy) }));
  const sortedD = withD.map((w) => w.d).sort((a, b) => a - b);
  const pct = sortedD[Math.min(sortedD.length - 1, Math.floor(sortedD.length * 0.85))] || Infinity;
  let coreIdx = withD.filter((w) => w.d <= pct).map((w) => w.i);
  if (coreIdx.length < count)
    coreIdx = pool.map((_, i) => i);
  for (let i = coreIdx.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const t = coreIdx[i];
    coreIdx[i] = coreIdx[j];
    coreIdx[j] = t;
  }
  const chosenPts = [...avoid];
  const chosen = [];
  const stride = Math.max(1, Math.floor(coreIdx.length / 240));
  if (!chosenPts.length) {
    chosen.push(coreIdx[0]);
    chosenPts.push(pool[coreIdx[0]]);
  }
  while (chosen.length < count) {
    let bestIdx = -1, bestDist = -1;
    for (let k = 0; k < coreIdx.length; k += stride) {
      const ci = coreIdx[k];
      if (chosen.includes(ci))
        continue;
      let nearest = Infinity;
      for (const cp of chosenPts) {
        const dx = pool[ci].x - cp.x, dy = pool[ci].y - cp.y;
        const d = dx * dx + dy * dy;
        if (d < nearest)
          nearest = d;
      }
      if (nearest > bestDist) {
        bestDist = nearest;
        bestIdx = ci;
      }
    }
    if (bestIdx < 0)
      break;
    chosen.push(bestIdx);
    chosenPts.push(pool[bestIdx]);
  }
  return chosen;
}
export function collectSlots(scene, seedStr, pinTypes, mapSize) {
  const inFrame = (p) => {
    const m = 6;
    return p.x >= m && p.x <= mapSize - m && p.y >= m && p.y <= mapSize - m;
  };
  const allHouses = (scene.houses || []).map((h) => h.centre);
  const fp = scene.footprint && scene.footprint.length >= 3 ? scene.footprint : null;
  const forests = (scene.forests || []).map((f) => f.polygon).filter((p) => p && p.length >= 3);
  const houses = allHouses.filter((c) => {
    if (!inFrame(c))
      return false;
    if (fp && !pointInPoly3(c, fp))
      return false;
    for (const f of forests)
      if (pointInPoly3(c, f))
        return false;
    return true;
  });
  const houseCount = houses.length;
  const slots = [];
  const usedHouseIdx = /* @__PURE__ */ new Set();
  const sampledAvoid = [];
  for (const t of pinTypes) {
    if (!t.enabled)
      continue;
    const rng = makeRng(hash32(`${seedStr}:${t.id}`));
    const want = rollCount(rng, t, houseCount || 1);
    let placed = 0;
    const pushSlot = (px) => {
      slots.push({ pinTypeId: t.id, noteType: t.noteType, icon: t.icon, layerName: t.layerName, px, index: placed, seed: hash32(`${seedStr}:${t.id}:${placed}`) });
      placed++;
    };
    if (t.placement === "anchored" || t.placement === "both") {
      const centres = (t.anchor ? anchorCentres(scene, t.anchor) : []).filter(inFrame);
      if (centres.length) {
        const cap = t.placement === "both" ? centres.length : Math.min(want, centres.length);
        const order = centres.length > cap ? spreadSample(centres, cap, rng, []) : centres.map((_, i) => i);
        for (const ci of order) {
          pushSlot(centres[ci]);
          sampledAvoid.push(centres[ci]);
        }
      }
      if (t.placement === "anchored")
        continue;
    }
    const remaining = Math.max(0, want - placed);
    if (remaining <= 0)
      continue;
    const pool = houseCount ? houses : (scene.outbuildings || []).filter((o) => o.type === "generic").map((o) => o.centre);
    if (!pool.length)
      continue;
    const freeIdx = pool.map((_, i) => i).filter((i) => !usedHouseIdx.has(i));
    if (!freeIdx.length)
      continue;
    const freePool = freeIdx.map((i) => pool[i]);
    const chosenLocal = spreadSample(freePool, Math.min(remaining, freePool.length), rng, sampledAvoid);
    for (const cl of chosenLocal) {
      const globalIdx = freeIdx[cl];
      usedHouseIdx.add(globalIdx);
      sampledAvoid.push(pool[globalIdx]);
      pushSlot(pool[globalIdx]);
    }
  }
  return slots;
}
export function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}
export function builtinName(lists, seed, used) {
  const rng = makeRng(seed);
  const proper = lists.proper && lists.proper.length ? lists.proper : null;
  const surnames = lists.surnames.length ? lists.surnames : ["Oakhart"];
  const adjectives = lists.adjectives.length ? lists.adjectives : ["Old"];
  const nouns = lists.nouns.length ? lists.nouns : ["House"];
  for (let attempt = 0; attempt < 24; attempt++) {
    const name2 = proper ? pick(rng, proper) : rng() < 0.5 ? `${pick(rng, surnames)}'s ${pick(rng, nouns)}` : `The ${pick(rng, adjectives)} ${pick(rng, nouns)}`;
    if (!used.has(name2)) {
      used.add(name2);
      return name2;
    }
  }
  let n = 2;
  const base = proper ? pick(rng, proper) : `${pick(rng, surnames)}'s ${pick(rng, nouns)}`;
  while (used.has(`${base} ${n}`))
    n++;
  const name = `${base} ${n}`;
  used.add(name);
  return name;
}
export let _idState = 0;
export function shortId(n) {
  _idState = _idState * 1664525 + 1013904223 + n >>> 0;
  return "marker_poi_" + _idState.toString(36).slice(0, 6).padStart(6, "0");
}
export function layerId(name) {
  return name.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "places";
}
export function buildMarkersFile(opts) {
  const { places, mapSize, imagePath } = opts;
  _idState = 2654435769;
  const layers = [{ id: "default", name: "Default", visible: true, locked: false }];
  const seenLayers = /* @__PURE__ */ new Set(["default"]);
  for (const pl of places) {
    const id = layerId(pl.layerName);
    if (seenLayers.has(id))
      continue;
    seenLayers.add(id);
    layers.push({ id, name: pl.layerName, visible: true, locked: false });
  }
  const markers = places.map((pl, i) => ({
    type: "pin",
    id: shortId(i + 1),
    x: clamp01(pl.px.x / mapSize),
    y: clamp01(pl.px.y / mapSize),
    layer: layerId(pl.layerName),
    link: pl.noteTitle ?? pl.name,
    iconKey: pl.icon || "circle_black_city",
    tooltip: pl.name,
    scaleLikeSticker: true
  }));
  return {
    size: { w: mapSize, h: mapSize },
    layers,
    markers,
    bases: [imagePath],
    overlays: [],
    activeBase: imagePath,
    measurement: { scales: {}, customUnitPxPerUnit: {}, travelTimePresetIds: [], travelDaysEnabled: false },
    pinSizeOverrides: {},
    grids: [],
    panClamp: true,
    drawLayers: [],
    drawings: [],
    secondScreen: {},
    textLayers: []
  };
}
export function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
