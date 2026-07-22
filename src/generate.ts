import { MAP_SIZE_BY_SIZE, buildSettlement, removeHousesIn } from "./buildings";
import { offsetPolyline, pointInPolygon } from "./geometry";
import { makeCoast, makeLake, makeMountainSpine, makeMountainSpineOverlay, makeRiver, placeForests } from "./landscape";
import { Noise2D, hash32, makeRng } from "./rng";
import { buildRoadNetwork, waterSideOfPoint } from "./roads";

export function generateFull(terrain, seedStr, opts) {
  const rng = makeRng(hash32(seedStr + ":" + terrain));
  const noise = new Noise2D(rng);
  const fullMode = opts.mode === "full";
  const size = opts.size ?? "town";
  const OUT = fullMode ? MAP_SIZE_BY_SIZE[size] ?? 1e3 : 1e3;
  const w = fullMode ? OUT + 500 : OUT;
  const h = w;
  const scene = { terrain, water: null, centreline: null, ridges: null };
  if (terrain === "coastal") {
    scene.water = makeCoast(rng, noise, w, h, opts).water;
  } else if (terrain === "river") {
    const r = makeRiver(rng, noise, w, h, opts);
    scene.water = r.water;
    scene.centreline = r.centreline;
    scene.riverWidth = r.width;
  } else if (terrain === "lake") {
    scene.water = makeLake(rng, noise, w, h, opts).water;
  } else if (terrain === "mountain") {
    if (!fullMode) {
      const m = makeMountainSpine(rng, noise, w, h, opts);
      scene.mountains = m.mountains;
      scene.ridges = m.ridges;
    }
  }
  const mtnSide = opts.mountainSide;
  let roads = [];
  let townSite = null;
  if (opts.showRoads !== false) {
    const enabled = opts.enabledEdges ?? defaultEdges(rng, scene, w, h, terrain);
    const net = buildRoadNetwork(rng, scene, w, h, terrain, enabled);
    roads = net.roads;
    townSite = net.townSite;
  }
  if (terrain !== "mountain" && mtnSide && /[NESW]/.test(mtnSide)) {
    const anchor = townSite ?? { x: w / 2, y: h / 2 };
    const m = makeMountainSpineOverlay(rng, noise, w, h, opts, mtnSide, scene.water, OUT, anchor);
    scene.mountains = m.mountains;
    scene.ridges = m.ridges;
    scene.mountainSide = mtnSide;
  } else if (terrain === "mountain" && fullMode) {
    const anchor = townSite ?? { x: w / 2, y: h / 2 };
    const m = makeMountainSpine(rng, noise, w, h, opts, OUT, anchor);
    scene.mountains = m.mountains;
    scene.ridges = m.ridges;
  }
  const baseForest = terrain === "mountain" ? 5 : terrain === "inland" ? 13 : 12;
  let forestCount = baseForest;
  if (fullMode) {
    const areaRatio = w * h / (OUT * OUT);
    forestCount = Math.floor(baseForest * areaRatio * 1);
  }
  const forestMul = opts.overrides?.forestDensity;
  if (forestMul !== void 0)
    forestCount = Math.round(forestCount * forestMul);
  if (opts.showForest !== false && forestCount > 0) {
    scene.forests = placeForests(rng, noise, w, h, scene, forestCount);
  }
  scene.roads = roads;
  let houses = [];
  if (fullMode && roads.length) {
    houses = buildSettlement(rng, scene, w, h, size, terrain, opts.overrides, OUT);
    roads = scene.roads;
  }
  const full = {
    ...scene,
    roads,
    townSite,
    size,
    houses: scene.houses ?? houses,
    footprint: scene.footprint,
    parks: scene.parks,
    street_base: scene.street_base,
    walls: scene.walls ?? null,
    landmarks: scene.landmarks ?? [],
    farms: scene.farms ?? [],
    outbuildings: scene.outbuildings ?? [],
    outlanes: scene.outlanes ?? [],
    dock: scene.dock ?? null
  };
  if (fullMode) {
    recenterSceneOnCity(full, w, h, OUT);
  }
  return full;
}
export function translatePolyline(pts, dx, dy) {
  return pts.map((p) => ({ x: p.x + dx, y: p.y + dy }));
}
export function recenterSceneOnCity(scene, w, h, out = 1e3) {
  const houses = scene.houses || [];
  if (!houses.length)
    return;
  const cxs = [];
  const cys = [];
  for (const hh of houses) {
    let c = hh.centre;
    if (!c && hh.polygon) {
      const poly = hh.polygon;
      c = { x: poly.reduce((s, p) => s + p.x, 0) / poly.length, y: poly.reduce((s, p) => s + p.y, 0) / poly.length };
    }
    if (c) {
      cxs.push(c.x);
      cys.push(c.y);
    }
  }
  if (!cxs.length)
    return;
  const cityCx = cxs.reduce((s, v) => s + v, 0) / cxs.length;
  const cityCy = cys.reduce((s, v) => s + v, 0) / cys.length;
  const pickShift = (vals, centre, desired, lo0, hi0) => {
    const sorted = vals.slice().sort((a, b) => a - b);
    const nn = sorted.length;
    const bLo = sorted[Math.floor(nn * 0.02)] - 20;
    const bHi = sorted[Math.min(nn - 1, Math.ceil(nn * 0.98))] + 20;
    const fitLo = -bLo;
    const fitHi = out - bHi;
    const lo1 = Math.max(lo0, fitLo);
    const hi1 = Math.min(hi0, fitHi);
    if (lo1 <= hi1)
      return Math.max(lo1, Math.min(hi1, desired));
    const VOID_CAP = 220;
    const lo2 = Math.max(lo0 - VOID_CAP, fitLo);
    const hi2 = Math.min(hi0 + VOID_CAP, fitHi);
    if (lo2 <= hi2)
      return Math.max(lo2, Math.min(hi2, desired));
    return Math.max(lo0 - VOID_CAP, Math.min(hi0 + VOID_CAP, desired));
  };
  const dx = pickShift(cxs, cityCx, out / 2 - cityCx, out - w, 0);
  const dy = pickShift(cys, cityCy, out / 2 - cityCy, out - h, 0);
  if (Math.abs(dx) < 1 && Math.abs(dy) < 1)
    return;
  if (scene.water)
    scene.water = translatePolyline(scene.water, dx, dy);
  if (scene.centreline)
    scene.centreline = translatePolyline(scene.centreline, dx, dy);
  const floodStrips = [];
  if (scene.terrain === "river" && scene.centreline && scene.centreline.length >= 4 && scene.riverWidth) {
    const cl = scene.centreline;
    const inCrop = (p) => p.x >= 0 && p.x <= out && p.y >= 0 && p.y <= out;
    const headInside = inCrop(cl[0]);
    const tailInside = inCrop(cl[cl.length - 1]);
    if (headInside || tailInside) {
      const reach = out * 1.2;
      const extendPt = (a, b) => {
        let hx = a.x - b.x;
        let hy = a.y - b.y;
        const hl = Math.hypot(hx, hy) || 1;
        hx /= hl;
        hy /= hl;
        return { x: a.x + hx * reach, y: a.y + hy * reach };
      };
      const stripPad = 8;
      let extended = cl.slice();
      if (headInside) {
        const e0 = extendPt(cl[0], cl[1]);
        floodStrips.push(offsetPolyline([e0, cl[0]], scene.riverWidth / 2 + stripPad));
        extended = [e0, ...extended];
      }
      if (tailInside) {
        const e1 = extendPt(cl[cl.length - 1], cl[cl.length - 2]);
        floodStrips.push(offsetPolyline([cl[cl.length - 1], e1], scene.riverWidth / 2 + stripPad));
        extended = [...extended, e1];
      }
      scene.centreline = extended;
      scene.water = offsetPolyline(extended, scene.riverWidth / 2);
    }
  }
  if (scene.ridges)
    scene.ridges = scene.ridges.map((r) => translatePolyline(r, dx, dy));
  if (scene.mountains) {
    for (const m of scene.mountains) {
      m.spines = m.spines.map((sp) => sp.map((p) => ({ ...p, x: p.x + dx, y: p.y + dy })));
      m._field = void 0;
    }
  }
  if (scene.forests) {
    for (const f of scene.forests) {
      f.polygon = translatePolyline(f.polygon, dx, dy);
      f.cx += dx;
      f.cy += dy;
    }
  }
  let ts = null;
  if (scene.roads) {
    for (const road of scene.roads) {
      road.points = translatePolyline(road.points, dx, dy);
      if (road.town_site) {
        road.town_site = { x: road.town_site.x + dx, y: road.town_site.y + dy };
        ts = road.town_site;
      }
    }
    const waterPoly = scene.water;
    const inWater = (pt) => !!waterPoly && pointInPolygon(pt, waterPoly);
    const extendOne = (ptsIn, endIdx) => {
      let pts = ptsIn;
      const atStart = endIdx === 0;
      if (waterPoly) {
        if (atStart)
          while (pts.length > 2 && inWater(pts[0]))
            pts = pts.slice(1);
        else
          while (pts.length > 2 && inWater(pts[pts.length - 1]))
            pts = pts.slice(0, -1);
      }
      const end = atStart ? pts[0] : pts[pts.length - 1];
      const nbr = atStart ? pts[1] : pts[pts.length - 2];
      const margin = 2;
      if (end.x <= margin || end.x >= out - margin || end.y <= margin || end.y >= out - margin)
        return pts;
      if (ts && Math.hypot(end.x - ts.x, end.y - ts.y) < out * 0.28)
        return pts;
      if (inWater(end))
        return pts;
      let hx = end.x - nbr.x;
      let hy = end.y - nbr.y;
      const hl = Math.hypot(hx, hy) || 1;
      hx /= hl;
      hy /= hl;
      let ex = end.x;
      let ey = end.y;
      let steps = 0;
      let blockedByWater = false;
      while (ex >= 0 && ex <= out && ey >= 0 && ey <= out && steps < out * 2) {
        const nx = ex + hx * 8;
        const ny = ey + hy * 8;
        if (inWater({ x: nx, y: ny })) {
          blockedByWater = true;
          break;
        }
        ex = nx;
        ey = ny;
        steps++;
      }
      if (blockedByWater) {
        const advanced = Math.hypot(ex - end.x, ey - end.y);
        if (advanced > 10) {
          const newEnd2 = { x: ex, y: ey };
          return atStart ? [newEnd2, ...pts] : [...pts, newEnd2];
        }
        return pts;
      }
      const newEnd = { x: ex, y: ey };
      return atStart ? [newEnd, ...pts] : [...pts, newEnd];
    };
    const extendToEdge = (pts) => {
      if (pts.length < 2)
        return pts;
      let out2 = extendOne(pts, 0);
      out2 = extendOne(out2, out2.length - 1);
      return out2;
    };
    for (const road of scene.roads) {
      if (road.role === "primary" || road.role === "branch") {
        road.points = extendToEdge(road.points);
      }
    }
    {
      const edgeM = 6;
      const reachesEdge = (pts) => {
        for (const p of pts) {
          if (p.x <= edgeM || p.x >= out - edgeM || p.y <= edgeM || p.y >= out - edgeM)
            return true;
        }
        return false;
      };
      const connected = scene.roads.some(
        (r) => (r.role === "primary" || r.role === "branch") && reachesEdge(r.points)
      );
      if (!connected && ts) {
        const dirs = [
          [0, -1, ts.y],
          // north: distance ts.y
          [0, 1, out - ts.y],
          // south
          [-1, 0, ts.x],
          // west
          [1, 0, out - ts.x]
          // east
        ];
        dirs.sort((a, b) => a[2] - b[2]);
        for (const [hx, hy] of dirs) {
          const path = [{ x: ts.x, y: ts.y }];
          let ex = ts.x, ey = ts.y;
          let ok = true;
          let reached = false;
          let guard = 0;
          while (guard++ < out) {
            const nx = ex + hx * 8;
            const ny = ey + hy * 8;
            if (nx < 0 || nx > out || ny < 0 || ny > out) {
              reached = true;
              break;
            }
            if (inWater({ x: nx, y: ny })) {
              ok = false;
              break;
            }
            ex = nx;
            ey = ny;
            if (ex <= edgeM || ex >= out - edgeM || ey <= edgeM || ey >= out - edgeM) {
              path.push({ x: ex, y: ey });
              reached = true;
              break;
            }
            path.push({ x: ex, y: ey });
          }
          if (ok && reached && path.length >= 2) {
            scene.roads.push({ points: path, class: "arterial", role: "primary", side: "A", town_site: ts });
            break;
          }
        }
      }
    }
  }
  if (scene.footprint)
    scene.footprint = translatePolyline(scene.footprint, dx, dy);
  if (scene.parks)
    scene.parks = scene.parks.map((p) => translatePolyline(p, dx, dy));
  if (scene.street_base)
    scene.street_base = scene.street_base.map((b) => translatePolyline(b, dx, dy));
  if (scene.farms) {
    for (const farm of scene.farms) {
      farm.polygon = translatePolyline(farm.polygon, dx, dy);
      if (farm.house)
        farm.house = { x: farm.house.x + dx, y: farm.house.y + dy };
    }
  }
  if (scene.outbuildings) {
    for (const ob of scene.outbuildings) {
      ob.centre = { x: ob.centre.x + dx, y: ob.centre.y + dy };
    }
  }
  if (scene.outlanes) {
    for (const lane of scene.outlanes) {
      lane.points = translatePolyline(lane.points, dx, dy);
    }
  }
  if (scene.dock) {
    const d = scene.dock;
    d.quay = translatePolyline(d.quay, dx, dy);
    d.jetties = d.jetties.map((j) => translatePolyline(j, dx, dy));
    d.boats = d.boats.map((b) => ({ ...b, pos: { x: b.pos.x + dx, y: b.pos.y + dy } }));
    d.warehouses = d.warehouses.map((wh) => translatePolyline(wh, dx, dy));
    if (d.lane)
      d.lane = translatePolyline(d.lane, dx, dy);
    d.shorePt = { x: d.shorePt.x + dx, y: d.shorePt.y + dy };
  }
  if (scene.walls) {
    const wls = scene.walls;
    if (wls.rings && wls.rings.length) {
      for (const wr of wls.rings) {
        wr.ring = translatePolyline(wr.ring, dx, dy);
        for (const g of wr.gates)
          g.pos = { x: g.pos.x + dx, y: g.pos.y + dy };
        wr.towers = wr.towers.map((t) => ({ x: t.x + dx, y: t.y + dy }));
      }
      wls.ring = wls.rings[0].ring;
      wls.gates = wls.rings[0].gates;
      wls.towers = wls.rings[0].towers;
    } else {
      wls.ring = translatePolyline(wls.ring, dx, dy);
      for (const g of wls.gates)
        g.pos = { x: g.pos.x + dx, y: g.pos.y + dy };
      wls.towers = wls.towers.map((t) => ({ x: t.x + dx, y: t.y + dy }));
    }
  }
  if (scene.landmarks) {
    for (const lm of scene.landmarks) {
      lm.clearPoly = translatePolyline(lm.clearPoly, dx, dy);
      lm.centre = { x: lm.centre.x + dx, y: lm.centre.y + dy };
      if (lm.type === "castle") {
        lm.bailey = translatePolyline(lm.bailey, dx, dy);
        lm.keep = translatePolyline(lm.keep, dx, dy);
        lm.towers = lm.towers.map((t) => ({ x: t.x + dx, y: t.y + dy }));
        lm.gate = { x: lm.gate.x + dx, y: lm.gate.y + dy };
        if (lm.approach)
          lm.approach = translatePolyline(lm.approach, dx, dy);
      } else if (lm.type === "cathedral") {
        lm.nave = translatePolyline(lm.nave, dx, dy);
        lm.transept = translatePolyline(lm.transept, dx, dy);
        lm.outline = translatePolyline(lm.outline, dx, dy);
        lm.apse = { pos: { x: lm.apse.pos.x + dx, y: lm.apse.pos.y + dy }, r: lm.apse.r };
      } else if (lm.type === "market") {
        lm.plaza = translatePolyline(lm.plaza, dx, dy);
        lm.stalls = lm.stalls.map((s) => translatePolyline(s, dx, dy));
        lm.feature = { pos: { x: lm.feature.pos.x + dx, y: lm.feature.pos.y + dy }, r: lm.feature.r };
      } else if (lm.type === "barracks") {
        lm.yard = translatePolyline(lm.yard, dx, dy);
        lm.halls = lm.halls.map((hh) => translatePolyline(hh, dx, dy));
        lm.drill = { pos: { x: lm.drill.pos.x + dx, y: lm.drill.pos.y + dy }, r: lm.drill.r };
      } else if (lm.type === "tower") {
        lm.basePoly = translatePolyline(lm.basePoly, dx, dy);
        if (lm.lane)
          lm.lane = translatePolyline(lm.lane, dx, dy);
      }
    }
  }
  for (const hh of houses) {
    if (hh.polygon)
      hh.polygon = translatePolyline(hh.polygon, dx, dy);
    if (hh.centre)
      hh.centre = { x: hh.centre.x + dx, y: hh.centre.y + dy };
  }
  for (const strip of floodStrips) {
    removeHousesIn(scene, strip);
    if (scene.outbuildings)
      scene.outbuildings = scene.outbuildings.filter((ob) => !pointInPolygon(ob.centre, strip));
  }
  if (ts)
    scene.townSite = ts;
  else if (scene.townSite)
    scene.townSite = { x: scene.townSite.x + dx, y: scene.townSite.y + dy };
}
export function edgeMidpoint(edge, w, h) {
  const inset = 0.12;
  switch (edge) {
    case "N":
      return { x: w * 0.5, y: h * inset };
    case "S":
      return { x: w * 0.5, y: h * (1 - inset) };
    case "E":
      return { x: w * (1 - inset), y: h * 0.5 };
    default:
      return { x: w * inset, y: h * 0.5 };
  }
}
export function defaultEdges(rng, scene, w, h, terrain) {
  const dirs = ["N", "E", "S", "W"];
  const e = {};
  for (const k of dirs)
    e[k] = rng() < 0.6;
  if (!Object.values(e).some(Boolean)) {
    e[dirs[Math.floor(rng() * 4)]] = true;
  }
  if (terrain === "river" && scene.centreline && scene.centreline.length >= 2) {
    const bankOf = {};
    const byBank = { A: [], B: [] };
    for (const k of dirs) {
      const b = waterSideOfPoint(edgeMidpoint(k, w, h), scene, w, h);
      bankOf[k] = b;
      byBank[b].push(k);
    }
    if (byBank.A.length && byBank.B.length) {
      const enabledBanks = new Set(dirs.filter((k) => e[k]).map((k) => bankOf[k]));
      for (const bank of ["A", "B"]) {
        if (!enabledBanks.has(bank)) {
          const cand = byBank[bank];
          const pick2 = cand[Math.floor(rng() * cand.length)];
          e[pick2] = true;
        }
      }
    }
  }
  return e;
}
