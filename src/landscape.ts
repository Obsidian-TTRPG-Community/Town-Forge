import { offsetPolyline, pointInPolygon, smoothClosed, smoothPolyline } from "./geometry";
import { buildHeightField, densifySpine, footprintPolygon } from "./mountains";
import { Noise2D, hash32, makeRng } from "./rng";

export const TAU = Math.PI * 2;
export function closeAlongEdgesRect(curve, e1, e2, x0, y0, rw, rh, side) {
  const x1 = x0 + rw;
  const y1 = y0 + rh;
  const NW = { x: x0, y: y0 };
  const NE = { x: x1, y: y0 };
  const SE = { x: x1, y: y1 };
  const SW = { x: x0, y: y1 };
  const cornerBetween = {
    "N,E": NE,
    "E,N": NE,
    "E,S": SE,
    "S,E": SE,
    "S,W": SW,
    "W,S": SW,
    "W,N": NW,
    "N,W": NW
  };
  const cwNext = { N: "E", E: "S", S: "W", W: "N" };
  const ccwNext = { N: "W", W: "S", S: "E", E: "N" };
  const walk = (nextMap) => {
    const result = curve.slice();
    let cur = e2;
    let steps = 0;
    while (cur !== e1 && steps < 8) {
      const nxt = nextMap[cur];
      result.push(cornerBetween[cur + "," + nxt]);
      cur = nxt;
      steps++;
    }
    return result;
  };
  const cw = walk(cwNext);
  const ccw = walk(ccwNext);
  const absArea = (poly) => {
    let a = 0;
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i];
      const q = poly[(i + 1) % poly.length];
      a += (q.x - p.x) * (q.y + p.y);
    }
    return Math.abs(a) * 0.5;
  };
  const larger = absArea(cw) >= absArea(ccw) ? cw : ccw;
  const smaller = larger === cw ? ccw : cw;
  return side > 0 ? larger : smaller;
}
export function makeCoast(rng, noise, w, h, opts) {
  const roughness = opts.roughness;
  const octaves = opts.octaves;
  const margin = Math.min(w, h) * 0.55;
  const x0 = -margin;
  const y0 = -margin;
  const x1 = w + margin;
  const y1 = h + margin;
  const ew = x1 - x0;
  const eh = y1 - y0;
  const edgePointExp = (edge, t) => {
    switch (edge) {
      case "N":
        return { x: x0 + t * ew, y: y0 };
      case "S":
        return { x: x0 + t * ew, y: y1 };
      case "W":
        return { x: x0, y: y0 + t * eh };
      case "E":
        return { x: x1, y: y0 + t * eh };
    }
  };
  const ampBig = Math.min(w, h) * 0.28 * roughness;
  const ampSmall = Math.min(w, h) * 0.07 * roughness;
  const scaleBig = 1.8 / Math.min(w, h);
  const scaleSmall = 9 / Math.min(w, h);
  const SAMPLES = 280;
  const crossesCanvas = (curve2) => curve2.some((p) => p.x >= 0 && p.x <= w && p.y >= 0 && p.y <= h);
  const wellFramed = (curve2, poly2) => {
    if (!crossesCanvas(curve2))
      return false;
    const out = Math.min(w, h);
    const loX = (w - out) / 2;
    const loY = (h - out) / 2;
    let wet = 0;
    let grid = 0;
    for (let gx = loX; gx <= loX + out; gx += 50) {
      for (let gy = loY; gy <= loY + out; gy += 50) {
        grid++;
        if (pointInPolygon({ x: gx, y: gy }, poly2))
          wet++;
      }
    }
    const frac = grid ? wet / grid : 0;
    return frac >= 0.18 && frac <= 0.82;
  };
  const seaSide = opts.seaSide && ["N", "E", "S", "W"].includes(opts.seaSide) ? opts.seaSide : null;
  const attempt = () => {
    const horiz = seaSide ? seaSide === "N" || seaSide === "S" : rng() < 0.5;
    const e1 = horiz ? "W" : "N";
    const e2 = horiz ? "E" : "S";
    const p1 = edgePointExp(e1, 0.15 + rng() * 0.7);
    const p2 = edgePointExp(e2, 0.15 + rng() * 0.7);
    const mx = (p1.x + p2.x) / 2;
    const my = (p1.y + p2.y) / 2;
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const L = Math.hypot(dx, dy);
    const nx = -dy / L;
    const ny = dx / L;
    const bulgeMag = (0.25 + rng() * 0.4) * Math.min(w, h);
    const bulge = bulgeMag * (rng() < 0.5 ? 1 : -1);
    const ctrl = { x: mx + nx * bulge, y: my + ny * bulge };
    const pts = [];
    for (let i = 0; i <= SAMPLES; i++) {
      const t = i / SAMPLES;
      const u = 1 - t;
      const bx = u * u * p1.x + 2 * u * t * ctrl.x + t * t * p2.x;
      const by = u * u * p1.y + 2 * u * t * ctrl.y + t * t * p2.y;
      const tx = 2 * u * (ctrl.x - p1.x) + 2 * t * (p2.x - ctrl.x);
      const ty = 2 * u * (ctrl.y - p1.y) + 2 * t * (p2.y - ctrl.y);
      const tl = Math.hypot(tx, ty) || 1;
      const nnx = -ty / tl;
      const nny = tx / tl;
      const taper = Math.sin(t * Math.PI);
      const nBig = noise.fbm(bx * scaleBig, by * scaleBig, octaves, 0.55);
      const nSmall = noise.fbm(bx * scaleSmall, by * scaleSmall, Math.max(2, octaves - 2), 0.5);
      const off = (nBig * ampBig + nSmall * ampSmall) * taper;
      const x = Math.max(x0, Math.min(x1, bx + nnx * off));
      const y = Math.max(y0, Math.min(y1, by + nny * off));
      pts.push({ x, y });
    }
    const smoothed = smoothPolyline(pts, 2);
    let side = rng() < 0.5 ? 1 : -1;
    if (seaSide) {
      const probe = seaSide === "N" ? { x: w / 2, y: h * 0.06 } : seaSide === "S" ? { x: w / 2, y: h * 0.94 } : seaSide === "W" ? { x: w * 0.06, y: h / 2 } : { x: w * 0.94, y: h / 2 };
      const polyPos = closeAlongEdgesRect(smoothed, e1, e2, x0, y0, ew, eh, 1);
      side = pointInPolygon(probe, polyPos) ? 1 : -1;
    }
    const poly2 = closeAlongEdgesRect(smoothed, e1, e2, x0, y0, ew, eh, side);
    return { poly: poly2, curve: smoothed };
  };
  const MAX_ATTEMPTS = 16;
  let { poly, curve } = attempt();
  let tries = 1;
  while (!wellFramed(curve, poly) && tries < MAX_ATTEMPTS) {
    ({ poly, curve } = attempt());
    tries++;
  }
  return { water: poly };
}
export function makeLake(rng, noise, w, h, opts) {
  const roughness = opts.roughness;
  const octaves = opts.octaves;
  const lakeSize = opts.lakeSize ?? 0.3;
  const cx = w * (0.35 + rng() * 0.3);
  const cy = h * (0.35 + rng() * 0.3);
  const baseR = Math.min(w, h) * lakeSize;
  const stretchAngle = rng() * TAU;
  const stretch = 0.65 + rng() * 0.6;
  const SAMPLES = 180;
  const noiseRadius = 2 + rng() * 1.2;
  const pts = [];
  for (let i = 0; i < SAMPLES; i++) {
    const a = i / SAMPLES * TAU;
    const nx = Math.cos(a);
    const ny = Math.sin(a);
    const n = noise.fbm(noiseRadius * nx, noiseRadius * ny, octaves, 0.55);
    const r = baseR * (1 + n * roughness * 0.5);
    let px = nx * r;
    let py = ny * r;
    const ca = Math.cos(stretchAngle);
    const sa = Math.sin(stretchAngle);
    const rx = ca * px + sa * py;
    const ry = -sa * px + ca * py;
    px = rx * stretch;
    py = ry / stretch;
    const fx = ca * px - sa * py;
    const fy = sa * px + ca * py;
    pts.push({ x: cx + fx, y: cy + fy });
  }
  return { water: smoothClosed(pts, 3) };
}
export function makeRiver(rng, noise, w, h, opts) {
  const roughness = opts.roughness;
  const octaves = opts.octaves;
  const riverWidth = opts.riverWidth ?? 0.045;
  const edges = ["N", "E", "S", "W"];
  const e1 = edges[Math.floor(rng() * 4)];
  let e2;
  if (rng() < 0.7) {
    e2 = edges[(edges.indexOf(e1) + 2) % 4];
  } else {
    e2 = edges[(edges.indexOf(e1) + (rng() < 0.5 ? 1 : 3)) % 4];
  }
  const edgePoint = (edge, t) => {
    switch (edge) {
      case "N":
        return { x: t * w, y: 0 };
      case "S":
        return { x: t * w, y: h };
      case "W":
        return { x: 0, y: t * h };
      case "E":
        return { x: w, y: t * h };
    }
  };
  const p1 = edgePoint(e1, 0.2 + rng() * 0.6);
  const p2 = edgePoint(e2, 0.2 + rng() * 0.6);
  const SAMPLES = 220;
  const ampBig = Math.min(w, h) * 0.3 * roughness;
  const ampSmall = Math.min(w, h) * 0.06 * roughness;
  const scaleBig = 1.9 / Math.min(w, h);
  const scaleSmall = 9 / Math.min(w, h);
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const nx = -dy / Math.hypot(dx, dy);
  const ny = dx / Math.hypot(dx, dy);
  const overshoot = 1.4;
  const nTotal = SAMPLES + 1;
  const lo = -overshoot;
  const hi = 1 + overshoot;
  const centreline = [];
  for (let i = 0; i < nTotal; i++) {
    const t = lo + i / (nTotal - 1) * (hi - lo);
    const bx = p1.x + dx * t;
    const by = p1.y + dy * t;
    const tn = (t - lo) / (hi - lo);
    const taper = Math.pow(Math.sin(tn * Math.PI), 0.5);
    const nBig = noise.fbm(bx * scaleBig, by * scaleBig, octaves, 0.55);
    const nSmall = noise.fbm(bx * scaleSmall, by * scaleSmall, Math.max(2, octaves - 2), 0.5);
    const off = (nBig * ampBig + nSmall * ampSmall) * taper;
    centreline.push({ x: bx + nx * off, y: by + ny * off });
  }
  const smoothCentre = smoothPolyline(centreline, 2);
  const width = Math.min(w, h) * riverWidth;
  return { water: offsetPolyline(smoothCentre, width / 2), centreline: smoothCentre, width };
}
export function buildMassif(rng, cx, cy, dirAng, len, baseW, peakH) {
  const sx = Math.cos(dirAng), sy = Math.sin(dirAng);
  const px = -sy, py = sx;
  const seed = Math.floor(rng() * 1e9) >>> 0;
  const nCtrl = 5;
  const main = [];
  for (let i = 0; i < nCtrl; i++) {
    const t = i / (nCtrl - 1);
    const along = (t - 0.5) * len;
    const lat = (rng() - 0.5) * 0.22 * len;
    const x = cx + sx * along + px * lat;
    const y = cy + sy * along + py * lat;
    const taper = Math.sin(t * Math.PI);
    const wWobble = 0.55 + rng() * 0.85;
    const wv = baseW * (0.35 + 0.65 * taper) * wWobble;
    const hv = peakH * (0.45 + 0.55 * taper) * (0.8 + rng() * 0.35);
    main.push({ x, y, w: wv, h: Math.min(1, hv) });
  }
  const spines = [densifySpine(main)];
  const nSpur = 1 + (rng() < 0.6 ? 1 : 0);
  for (let s = 0; s < nSpur; s++) {
    const anchorIdx = 1 + Math.floor(rng() * (nCtrl - 2));
    const a = main[anchorIdx];
    const spurAng = dirAng + (rng() < 0.5 ? 1 : -1) * (Math.PI / 2) * (0.6 + rng() * 0.5);
    const spurLen = len * (0.22 + rng() * 0.16);
    const ex = Math.cos(spurAng), ey = Math.sin(spurAng);
    const spur = [];
    const ns = 3;
    for (let i = 0; i < ns; i++) {
      const t = i / (ns - 1);
      const x = a.x + ex * spurLen * t + (rng() - 0.5) * 16;
      const y = a.y + ey * spurLen * t + (rng() - 0.5) * 16;
      const wv = a.w * 0.9 * (1 - t * 0.3) * (0.85 + rng() * 0.35);
      const hv = a.h * (0.9 - t * 0.3);
      spur.push({ x, y, w: Math.max(26, wv), h: Math.max(0.35, hv) });
    }
    spines.push(densifySpine(spur));
  }
  return { spines, crag: 0.5, widthVar: 0.8, k: 0.32, seed };
}
export function mountainsToRidges(mtns, avoidWater) {
  const ridges = [];
  for (const m of mtns) {
    const field = buildHeightField(m, 8, 44, avoidWater ?? void 0);
    const fp = footprintPolygon(field, 0.05);
    if (fp.length >= 6)
      ridges.push(fp);
  }
  return ridges;
}
export function makeMountainSpine(rng, noise, w, h, opts, cropSize, anchor) {
  const rangeLen = opts.rangeLen ?? 0.65;
  const peakCount = Math.floor(opts.peakCount ?? 6);
  const scale = Math.max(0.55, 0.55 + (Math.max(1, peakCount) - 6) / 6 * 0.5);
  const peakH = Math.min(1.2, 0.85 + peakCount / 12 * 0.45);
  const mtns = [];
  if (anchor && cropSize) {
    const crop = cropSize;
    const cx0 = anchor.x, cy0 = anchor.y, half = crop / 2;
    const inset = crop * (0.16 + rng() * 0.04);
    const sides = ["N", "E", "S", "W"];
    for (let i = sides.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const t = sides[i];
      sides[i] = sides[j];
      sides[j] = t;
    }
    const chosen = sides.slice(0, 3 + (rng() < 0.4 ? 1 : 0));
    for (const s of chosen) {
      const horiz = s === "N" || s === "S";
      const edgeAng = horiz ? 0 : Math.PI / 2;
      const along = 0.5 + (rng() - 0.5) * 0.4;
      let cxm, cym;
      if (horiz) {
        cxm = cx0 - half + crop * along;
        cym = s === "N" ? cy0 - half + inset : cy0 + half - inset;
      } else {
        cym = cy0 - half + crop * along;
        cxm = s === "W" ? cx0 - half + inset : cx0 + half - inset;
      }
      const baseW = Math.min(w, h) * (0.09 + rng() * 0.05) * scale;
      const len = crop * (0.3 + rng() * 0.18) * scale;
      mtns.push(buildMassif(rng, cxm, cym, edgeAng + (rng() - 0.35) * 0.35, len, baseW, Math.min(1.2, peakH + rng() * 0.1)));
    }
    return { mountains: mtns, ridges: mountainsToRidges(mtns) };
  }
  const spineAngle = rng() * TAU;
  const spineLen = Math.min(w, h) * rangeLen * scale;
  const cx = w * 0.5 + (rng() - 0.5) * w * 0.18;
  const cy = h * 0.5 + (rng() - 0.5) * h * 0.18;
  const sx = Math.cos(spineAngle), sy = Math.sin(spineAngle);
  const nMass = 1 + (rng() < 0.7 ? 1 : 0);
  for (let i = 0; i < nMass; i++) {
    const t = nMass === 1 ? 0 : i / (nMass - 1) - 0.5;
    const mx = cx + sx * spineLen * 0.5 * t;
    const my = cy + sy * spineLen * 0.5 * t;
    const baseW = Math.min(w, h) * (0.1 + rng() * 0.05) * scale;
    mtns.push(buildMassif(rng, mx, my, spineAngle + (rng() - 0.5) * 0.4, spineLen * (0.55 + rng() * 0.3), baseW, Math.min(1.2, peakH + rng() * 0.05)));
  }
  return { mountains: mtns, ridges: mountainsToRidges(mtns) };
}
export function makeMountainSpineOverlay(rng, noise, w, h, opts, side, avoidWater, cropSize, anchor) {
  const peakCount = Math.floor(opts.peakCount ?? 6);
  if (peakCount <= 0)
    return { mountains: [], ridges: [] };
  const scale = 0.45 + peakCount / 6 * 0.55;
  const sxn = Math.min(w, h);
  const crop = cropSize ?? Math.min(w, h);
  const cx0 = anchor ? anchor.x : w / 2;
  const cy0 = anchor ? anchor.y : h / 2;
  const half = crop / 2;
  const along = (t) => 0.2 + 0.6 * t;
  const mtns = [];
  const sides = ["N", "E", "S", "W"].filter((s) => side.indexOf(s) >= 0);
  if (!sides.length)
    return { mountains: [], ridges: [] };
  for (const sd of sides) {
    const horiz = sd === "N" || sd === "S";
    const edgeAng = horiz ? 0 : Math.PI / 2;
    const band = 0.12 + rng() * 0.05;
    const inset = crop * band;
    const nMass = scale > 1.1 ? 2 : 1;
    const inward = horiz ? { x: 0, y: sd === "N" ? 1 : -1 } : { x: sd === "W" ? 1 : -1, y: 0 };
    const isWet = (x, y) => !!avoidWater && pointInPolygon({ x, y }, avoidWater);
    for (let i = 0; i < nMass; i++) {
      const t = nMass === 1 ? 0.5 : 0.28 + 0.44 * i;
      let cxm, cym;
      if (horiz) {
        cxm = cx0 - half + crop * along(t);
        cym = sd === "N" ? cy0 - half + inset : cy0 + half - inset;
      } else {
        cym = cy0 - half + crop * along(t);
        cxm = sd === "W" ? cx0 - half + inset : cx0 + half - inset;
      }
      if (isWet(cxm, cym)) {
        let found = false;
        const stepN = 24;
        for (let s = 1; s <= stepN; s++) {
          const dd = s / stepN * crop * 0.4;
          const nx = cxm + inward.x * dd, ny = cym + inward.y * dd;
          if (!isWet(nx, ny)) {
            cxm = nx;
            cym = ny;
            found = true;
            break;
          }
        }
        if (!found)
          continue;
      }
      const baseW = sxn * (0.09 + rng() * 0.05) * scale;
      const len = crop * (0.22 + rng() * 0.12) * scale;
      const peakH = Math.min(1.1, 0.55 + 0.5 * (peakCount / 12) + rng() * 0.12);
      mtns.push(buildMassif(rng, cxm, cym, edgeAng + (rng() - 0.5) * 0.3, len, baseW, peakH));
    }
  }
  return { mountains: mtns, ridges: mountainsToRidges(mtns, avoidWater) };
}
export function generateLandscape(terrain, seedStr, w, h, opts) {
  return generateWith(terrain, seedStr, w, h, opts);
}
export function generateWith(terrain, seedStr, w, h, opts) {
  const rng = makeRng(hash32(seedStr + ":" + terrain));
  const noise = new Noise2D(rng);
  const scene = { terrain, water: null, centreline: null, ridges: null };
  if (terrain === "coastal") {
    scene.water = makeCoast(rng, noise, w, h, opts).water;
  } else if (terrain === "river") {
    const r = makeRiver(rng, noise, w, h, opts);
    scene.water = r.water;
    scene.centreline = r.centreline;
  } else if (terrain === "lake") {
    scene.water = makeLake(rng, noise, w, h, opts).water;
  } else if (terrain === "mountain") {
    const m = makeMountainSpine(rng, noise, w, h, opts);
    scene.mountains = m.mountains;
    scene.ridges = m.ridges;
  }
  const mtnSide = opts.mountainSide;
  if (terrain !== "mountain" && mtnSide && /[NESW]/.test(mtnSide)) {
    const m = makeMountainSpineOverlay(rng, noise, w, h, opts, mtnSide, scene.water);
    scene.mountains = m.mountains;
    scene.ridges = m.ridges;
  }
  const baseForest = terrain === "mountain" ? 4 : terrain === "inland" ? 10 : 7;
  scene.forests = placeForests(rng, noise, w, h, scene, baseForest);
  return scene;
}
export function isWater(pt, scene) {
  return scene.water != null && pointInPolygon(pt, scene.water);
}
export function isMountain(pt, scene) {
  if (!scene.ridges)
    return false;
  for (const ridge of scene.ridges) {
    if (pointInPolygon(pt, ridge))
      return true;
  }
  return false;
}
export const FOOTHILL_MARGIN = 22;
export function canopyNearMountain(polygon, centre, scene, margin) {
  if (!scene.ridges || !scene.ridges.length)
    return false;
  for (const p of polygon) {
    if (isMountain(p, scene))
      return true;
    let dx = p.x - centre.x, dy = p.y - centre.y;
    const l = Math.hypot(dx, dy) || 1;
    dx /= l;
    dy /= l;
    if (isMountain({ x: p.x + dx * margin, y: p.y + dy * margin }, scene))
      return true;
  }
  return false;
}
export function placeForests(rng, noise, w, h, scene, count) {
  const patches = [];
  const target = Math.max(1, count);
  const gridN = Math.max(target * 3, 16);
  const cols = Math.max(1, Math.round(Math.sqrt(gridN * w / h)));
  const rows = Math.max(1, Math.round(gridN / cols));
  const cellW = w / cols;
  const cellH = h / rows;
  const cells = [];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      cells.push([c, r]);
  for (let i = cells.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = cells[i];
    cells[i] = cells[j];
    cells[j] = tmp;
  }
  const waterFracOk = (polygon, centre) => {
    if (isWater(centre, scene))
      return false;
    let wet = 0;
    for (const p of polygon)
      if (isWater(p, scene))
        wet++;
    return wet / polygon.length <= 0.25;
  };
  for (const [c, r] of cells) {
    if (patches.length >= target)
      break;
    if (rng() < 0.08)
      continue;
    const cx = (c + 0.18 + rng() * 0.64) * cellW;
    const cy = (r + 0.18 + rng() * 0.64) * cellH;
    const centre = { x: cx, y: cy };
    if (isWater(centre, scene))
      continue;
    if (isMountain(centre, scene))
      continue;
    const isBig = rng() < 0.3;
    let baseR;
    if (isBig)
      baseR = Math.min(cellW, cellH) * (0.5 + rng() * 0.22);
    else
      baseR = Math.min(cellW, cellH) * (0.3 + rng() * 0.2);
    const SAMPLES = isBig ? 80 : 60;
    const pts = [];
    const phase = rng() * 100;
    for (let i = 0; i < SAMPLES; i++) {
      const a = i / SAMPLES * TAU;
      const nx = Math.cos(a);
      const ny = Math.sin(a);
      const n = noise.fbm(phase + 2.5 * nx, phase + 2.5 * ny, 3, 0.55);
      const rr = baseR * (1 + n * 0.5);
      pts.push({ x: cx + nx * rr, y: cy + ny * rr });
    }
    const polygon = smoothClosed(pts, 1);
    if (!waterFracOk(polygon, centre))
      continue;
    if (canopyNearMountain(polygon, centre, scene, FOOTHILL_MARGIN))
      continue;
    patches.push({ cx, cy, polygon, big: isBig });
  }
  const gapCols = 6;
  const gapRows = 6;
  const gapCW = w / gapCols;
  const gapCH = h / gapRows;
  const minSepToForest = Math.min(gapCW, gapCH) * 0.55;
  for (let gr = 0; gr < gapRows; gr++) {
    for (let gc = 0; gc < gapCols; gc++) {
      const cx = (gc + 0.3 + rng() * 0.4) * gapCW;
      const cy = (gr + 0.3 + rng() * 0.4) * gapCH;
      const centre = { x: cx, y: cy };
      if (isWater(centre, scene))
        continue;
      if (isMountain(centre, scene))
        continue;
      let near = false;
      for (const f of patches) {
        if (Math.hypot(f.cx - cx, f.cy - cy) < minSepToForest) {
          near = true;
          break;
        }
      }
      if (near)
        continue;
      if (rng() < 0.35)
        continue;
      const baseR = Math.min(gapCW, gapCH) * (0.22 + rng() * 0.16);
      const SAMPLES = 56;
      const pts = [];
      const phase = rng() * 100;
      for (let i = 0; i < SAMPLES; i++) {
        const a = i / SAMPLES * TAU;
        const nx = Math.cos(a);
        const ny = Math.sin(a);
        const n = noise.fbm(phase + 2.5 * nx, phase + 2.5 * ny, 3, 0.55);
        const rr = baseR * (1 + n * 0.5);
        pts.push({ x: cx + nx * rr, y: cy + ny * rr });
      }
      const polygon = smoothClosed(pts, 1);
      if (!waterFracOk(polygon, centre))
        continue;
      if (canopyNearMountain(polygon, centre, scene, FOOTHILL_MARGIN))
        continue;
      patches.push({ cx, cy, polygon, big: false });
    }
  }
  return patches;
}
