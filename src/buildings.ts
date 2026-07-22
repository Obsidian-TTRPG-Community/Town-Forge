import { pointInPolygon, pointInPolygonNonzero } from "./geometry";
import { GRID_H, GRID_W, astar, bankEndpointForBridge, buildCostGrid, chaikinOpen, findOpenTownsite, pathToPolyline, waterSideOfPoint, worldToGrid } from "./roads";

export var INF2 = Infinity;
export var ZONE_RADIUS_BY_SIZE = {
  hamlet: 90,
  village: 110,
  small_town: 140,
  town: 170,
  large_town: 200,
  small_city: 130,
  city: 172,
  large_city: 222,
  metropolis: 285
};
export var ARM_LENGTH_BY_SIZE = {
  hamlet: null,
  village: null,
  small_town: null,
  town: null,
  large_town: null,
  small_city: 90,
  city: 140,
  large_city: 200,
  metropolis: 270
};
export var HOUSE_TARGET_BY_SIZE = {
  hamlet: 6,
  village: 14,
  small_town: 28,
  town: 50,
  large_town: 85,
  small_city: 180,
  city: 320,
  large_city: 500,
  metropolis: 800
};
export var SUB_ROAD_COUNT_BY_SIZE = {
  hamlet: 1,
  village: 2,
  small_town: 3,
  town: 4,
  large_town: 6,
  small_city: 8,
  city: 12,
  large_city: 17,
  metropolis: 24
};
export var MAP_SIZE_BY_SIZE = {
  hamlet: 720,
  village: 760,
  small_town: 820,
  town: 900,
  large_town: 980,
  small_city: 900,
  city: 1020,
  large_city: 1180,
  metropolis: 1400
};
export var HOUSE_LONG_MIN = 16;
export var HOUSE_LONG_MAX = 24;
export var HOUSE_SHORT_MIN = 10;
export var HOUSE_SHORT_MAX = 14;
export var HOUSE_INTERVAL_MULT = 1.55;
export var SETBACK_MIN = 12;
export var SETBACK_MAX = 16;
export function stampRoadAvoidance(grid, polyline, cellW, cellH, radius = 5, penalty = 22) {
  const stamped = /* @__PURE__ */ new Set();
  for (const p of polyline) {
    const ix0 = Math.max(0, Math.min(GRID_W - 1, Math.floor(p.x / cellW)));
    const iy0 = Math.max(0, Math.min(GRID_H - 1, Math.floor(p.y / cellH)));
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const nx = ix0 + dx;
        const ny = iy0 + dy;
        if (nx < 0 || nx >= GRID_W || ny < 0 || ny >= GRID_H)
          continue;
        const k = ny * GRID_W + nx;
        if (stamped.has(k))
          continue;
        stamped.add(k);
        if (grid[ny][nx] === INF2)
          continue;
        const d = Math.max(Math.abs(dx), Math.abs(dy));
        const attenuation = d <= radius ? 1 - 0.7 * (d / radius) : 0;
        grid[ny][nx] = Math.min(grid[ny][nx] + penalty * attenuation, 60);
      }
    }
  }
}
export function clearAnchorCells(grid, anchorPt, cellW, cellH, radius = 2) {
  const ix0 = Math.max(0, Math.min(GRID_W - 1, Math.floor(anchorPt.x / cellW)));
  const iy0 = Math.max(0, Math.min(GRID_H - 1, Math.floor(anchorPt.y / cellH)));
  const cleared = [];
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const nx = ix0 + dx;
      const ny = iy0 + dy;
      if (nx < 0 || nx >= GRID_W || ny < 0 || ny >= GRID_H)
        continue;
      if (grid[ny][nx] === INF2)
        continue;
      cleared.push([nx, ny, grid[ny][nx]]);
      grid[ny][nx] = 1;
    }
  }
  return cleared;
}
export function restoreClearedCells(grid, cleared) {
  for (const [nx, ny, original] of cleared)
    grid[ny][nx] = original;
}
export function pointNearAnyPolyline(pt, polylines, threshold) {
  const t2 = threshold * threshold;
  for (const poly of polylines) {
    for (let i = 0; i < poly.length - 1; i++) {
      const a = poly[i];
      const b = poly[i + 1];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const segL2 = dx * dx + dy * dy;
      let cx;
      let cy;
      if (segL2 === 0) {
        cx = a.x;
        cy = a.y;
      } else {
        let t = ((pt.x - a.x) * dx + (pt.y - a.y) * dy) / segL2;
        t = Math.max(0, Math.min(1, t));
        cx = a.x + t * dx;
        cy = a.y + t * dy;
      }
      const d2 = (pt.x - cx) ** 2 + (pt.y - cy) ** 2;
      if (d2 <= t2)
        return true;
    }
  }
  return false;
}
export function runsAlongside(polyline, existing, skipFrac = 0.15, thresholdDist = 14, maxOverlapFrac = 0.25) {
  if (!existing.length || polyline.length < 2)
    return false;
  const samples = [];
  for (let i = 0; i < polyline.length - 1; i++) {
    const a = polyline[i];
    const b = polyline[i + 1];
    const d = Math.hypot(b.x - a.x, b.y - a.y);
    const nSamples = Math.max(2, Math.floor(d / 4));
    for (let k = 0; k < nSamples; k++) {
      const t = k / nSamples;
      samples.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    }
  }
  samples.push(polyline[polyline.length - 1]);
  const startIdx = Math.floor(samples.length * skipFrac);
  const endIdx = Math.floor(samples.length * (1 - skipFrac));
  const checked = endIdx > startIdx ? samples.slice(startIdx, endIdx) : samples.slice(startIdx);
  if (!checked.length)
    return false;
  let closeCount = 0;
  for (const p of checked) {
    if (pointNearAnyPolyline(p, existing, thresholdDist))
      closeCount++;
  }
  return closeCount / checked.length > maxOverlapFrac;
}
export function tryPlaceSubroad(rng, grid, scene, cellW, cellH, w, h, anchorPt, chosenAngles, existingPolylines, zoneRadius) {
  const MAX_ANGLE_TRIES = 10;
  for (let attempt = 0; attempt < MAX_ANGLE_TRIES; attempt++) {
    let bestAng = null;
    let bestSep = -1;
    for (let k = 0; k < 8; k++) {
      const cand = (rng() - 0.5) * 2 * Math.PI;
      let minSep = Math.PI;
      for (const a of chosenAngles) {
        const d = Math.abs(((cand - a) % (2 * Math.PI) + 3 * Math.PI) % (2 * Math.PI) - Math.PI);
        if (d < minSep)
          minSep = d;
      }
      if (minSep > bestSep) {
        bestSep = minSep;
        bestAng = cand;
      }
    }
    if (bestAng === null)
      continue;
    const length = zoneRadius * (0.5 + rng() * 0.4);
    let endX = anchorPt.x + Math.cos(bestAng) * length;
    let endY = anchorPt.y + Math.sin(bestAng) * length;
    endX = Math.max(8, Math.min(w - 8, endX));
    endY = Math.max(8, Math.min(h - 8, endY));
    const endPt = { x: endX, y: endY };
    if (scene.water && pointInPolygon(endPt, scene.water))
      continue;
    let inRidge = false;
    if (scene.ridges) {
      for (const ridge of scene.ridges) {
        if (pointInPolygon(endPt, ridge)) {
          inRidge = true;
          break;
        }
      }
    }
    if (inRidge)
      continue;
    const aCell = worldToGrid(anchorPt, cellW, cellH);
    const eCell = worldToGrid(endPt, cellW, cellH);
    const path = astar(grid, aCell, eCell);
    if (path === null || path.length < 2)
      continue;
    let polyline = pathToPolyline(path, cellW, cellH);
    polyline[0] = anchorPt;
    polyline[polyline.length - 1] = endPt;
    polyline = chaikinOpen(polyline, 3);
    polyline[0] = anchorPt;
    polyline[polyline.length - 1] = endPt;
    if (runsAlongside(polyline, existingPolylines, 0.15, 14))
      continue;
    return { polyline, angle: bestAng };
  }
  return null;
}
export function generateSubRoads(rng, scene, w, h, townSite, zoneRadius, count, terrain) {
  if (count <= 0)
    return [];
  const { grid, cellW, cellH } = buildCostGrid(scene, w, h);
  const roads = scene.roads;
  for (const road of roads) {
    if (road.class === "bridge")
      continue;
    stampRoadAvoidance(grid, road.points, cellW, cellH, 5, 22);
  }
  const anchorPoints = [];
  for (const road of roads) {
    if (road.class === "bridge")
      continue;
    if (road.role !== "primary" && road.role !== "branch")
      continue;
    const pts = road.points;
    for (let i = 0; i < pts.length; i += 4) {
      const p = pts[i];
      const d = Math.hypot(p.x - townSite.x, p.y - townSite.y);
      if (d <= zoneRadius * 0.7)
        anchorPoints.push(p);
    }
  }
  if (!anchorPoints.length)
    return [];
  const existingAngles = [];
  for (const road of roads) {
    if (road.class === "bridge")
      continue;
    if (road.role !== "primary" && road.role !== "branch")
      continue;
    const pts = road.points;
    if (pts.length < 2)
      continue;
    existingAngles.push(Math.atan2(pts[pts.length - 1].y - pts[0].y, pts[pts.length - 1].x - pts[0].x));
  }
  const existingPolylines = roads.filter((r) => r.class !== "bridge").map((r) => r.points);
  const newRoads = [];
  const chosenAngles = existingAngles.slice();
  for (let i = 0; i < count; i++) {
    const anchorPt = anchorPoints[Math.floor(rng() * anchorPoints.length)];
    const cleared = clearAnchorCells(grid, anchorPt, cellW, cellH, 2);
    let placed = null;
    try {
      placed = tryPlaceSubroad(rng, grid, scene, cellW, cellH, w, h, anchorPt, chosenAngles, existingPolylines, zoneRadius);
    } finally {
      restoreClearedCells(grid, cleared);
    }
    if (placed === null)
      continue;
    chosenAngles.push(placed.angle);
    stampRoadAvoidance(grid, placed.polyline, cellW, cellH, 5, 22);
    newRoads.push({ points: placed.polyline, class: "sub_road", role: "sub_road" });
  }
  return newRoads;
}
export function placeHouses(rng, scene, w, h, townSite, zoneRadius, targetCount, terrain) {
  const houses = [];
  const occupied = [];
  const avgLong = (HOUSE_LONG_MIN + HOUSE_LONG_MAX) / 2;
  const sampleInterval = avgLong * HOUSE_INTERVAL_MULT;
  const densityAt = (pt) => {
    const d = Math.hypot(pt.x - townSite.x, pt.y - townSite.y);
    const t = d / zoneRadius;
    if (t < 0.4)
      return 1;
    if (t < 1)
      return 1 - (t - 0.4) / 0.6 * 0.8;
    return 0;
  };
  const collides = (cx, cy, halfLong, halfShort) => {
    const r = Math.max(halfLong, halfShort) * 1.15;
    for (const [ox, oy, orad] of occupied) {
      if (Math.hypot(cx - ox, cy - oy) < (r + orad) * 1.05)
        return true;
    }
    return false;
  };
  const inObstacle = (cx, cy, halfLong, halfShort) => {
    const pt = { x: cx, y: cy };
    if (scene.water && pointInPolygon(pt, scene.water))
      return true;
    if (scene.ridges) {
      for (const ridge of scene.ridges) {
        if (pointInPolygon(pt, ridge))
          return true;
      }
    }
    if (scene.forests) {
      for (const f of scene.forests) {
        if (pointInPolygon(pt, f.polygon))
          return true;
      }
    }
    const margin = Math.max(halfLong, halfShort) + 4;
    if (cx < margin || cx > w - margin)
      return true;
    if (cy < margin || cy > h - margin)
      return true;
    return false;
  };
  const inZone = (pt) => Math.hypot(pt.x - townSite.x, pt.y - townSite.y) <= zoneRadius;
  const roads = scene.roads;
  outer:
    for (const road of roads) {
      if (road.class === "bridge")
        continue;
      const pts = road.points;
      if (pts.length < 2)
        continue;
      const segLengths = [];
      for (let k = 0; k < pts.length - 1; k++) {
        segLengths.push(Math.hypot(pts[k + 1].x - pts[k].x, pts[k + 1].y - pts[k].y));
      }
      const totalLength = segLengths.reduce((s2, v) => s2 + v, 0);
      let s = sampleInterval * 0.5;
      while (s < totalLength) {
        let acc = 0;
        let segI = -1;
        let segS = 0;
        for (let k = 0; k < segLengths.length; k++) {
          if (acc + segLengths[k] >= s) {
            segI = k;
            segS = s - acc;
            break;
          }
          acc += segLengths[k];
        }
        if (segI === -1)
          break;
        const a = pts[segI];
        const b = pts[segI + 1];
        const segL = segLengths[segI] || 1;
        const t = segS / segL;
        const roadPt = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
        if (!inZone(roadPt)) {
          s += sampleInterval;
          continue;
        }
        const tx = (b.x - a.x) / segL;
        const ty = (b.y - a.y) / segL;
        const perpL = [-ty, tx];
        const perpR = [ty, -tx];
        const density = densityAt(roadPt);
        for (const perp of [perpL, perpR]) {
          if (rng() > density)
            continue;
          const houseLong = HOUSE_LONG_MIN + rng() * (HOUSE_LONG_MAX - HOUSE_LONG_MIN);
          const houseShort = HOUSE_SHORT_MIN + rng() * (HOUSE_SHORT_MAX - HOUSE_SHORT_MIN);
          const setback = SETBACK_MIN + rng() * (SETBACK_MAX - SETBACK_MIN);
          let cx = roadPt.x + perp[0] * setback;
          let cy = roadPt.y + perp[1] * setback;
          const jitter = (rng() - 0.5) * sampleInterval * 0.3;
          cx += tx * jitter;
          cy += ty * jitter;
          const hl = houseLong / 2;
          const hs = houseShort / 2;
          if (inObstacle(cx, cy, hl, hs))
            continue;
          if (collides(cx, cy, hl, hs))
            continue;
          const angle = Math.atan2(ty, tx);
          houses.push({ centre: { x: cx, y: cy }, size: [houseLong, houseShort], angle });
          occupied.push([cx, cy, Math.max(hl, hs)]);
          if (houses.length >= targetCount)
            break outer;
        }
        s += sampleInterval;
      }
    }
  const rescueFloor = Math.max(3, Math.floor(targetCount * 0.12));
  if (houses.length < rescueFloor) {
    let attempts = 0;
    const maxAttempts = targetCount * 40;
    while (houses.length < targetCount && attempts < maxAttempts) {
      attempts++;
      const ang = rng() * 2 * Math.PI;
      const rad = zoneRadius * Math.sqrt(rng());
      const cx = townSite.x + Math.cos(ang) * rad;
      const cy = townSite.y + Math.sin(ang) * rad;
      if (rng() > densityAt({ x: cx, y: cy }))
        continue;
      const houseLong = HOUSE_LONG_MIN + rng() * (HOUSE_LONG_MAX - HOUSE_LONG_MIN);
      const houseShort = HOUSE_SHORT_MIN + rng() * (HOUSE_SHORT_MAX - HOUSE_SHORT_MIN);
      const hl = houseLong / 2;
      const hs = houseShort / 2;
      if (inObstacle(cx, cy, hl, hs))
        continue;
      if (collides(cx, cy, hl, hs))
        continue;
      const angle = Math.atan2(townSite.y - cy, townSite.x - cx);
      houses.push({ centre: { x: cx, y: cy }, size: [houseLong, houseShort], angle });
      occupied.push([cx, cy, Math.max(hl, hs)]);
    }
  }
  return houses;
}
export function segmentsIntersect(ax, ay, bx, by, cx, cy, dx, dy) {
  const ccw = (px, py, qx, qy, rx, ry) => (ry - py) * (qx - px) - (qy - py) * (rx - px);
  const d1 = ccw(cx, cy, dx, dy, ax, ay);
  const d2 = ccw(cx, cy, dx, dy, bx, by);
  const d3 = ccw(ax, ay, bx, by, cx, cy);
  const d4 = ccw(ax, ay, bx, by, dx, dy);
  return d1 > 0 !== d2 > 0 && d3 > 0 !== d4 > 0;
}
export function builtAreaPolys(scene) {
  const avoid = [];
  const footprint = scene.footprint;
  if (footprint && footprint.length >= 3)
    avoid.push(footprint);
  const walls = scene.walls;
  if (walls && walls.ring && walls.ring.length)
    avoid.push(walls.ring);
  return avoid;
}
export function placeRibbonHouses(rng, scene, townSite, zoneRadius, size, w, h, houses) {
  const roads = scene.roads;
  const footprint = scene.footprint;
  const water = scene.water;
  const blocked = (pt) => {
    if (water && pointInPolygon(pt, water))
      return true;
    if (scene.ridges) {
      for (const ridge of scene.ridges) {
        if (pointInPolygon(pt, ridge))
          return true;
      }
    }
    if (footprint && pointInPolygon(pt, footprint))
      return true;
    return false;
  };
  const newHouses = [];
  const reach = zoneRadius * 1.8;
  for (const road of roads) {
    if (road.class === "bridge")
      continue;
    if (road.role !== "primary" && road.role !== "branch")
      continue;
    const pts = road.points;
    if (pts.length < 2)
      continue;
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      const dTown = Math.hypot(p.x - townSite.x, p.y - townSite.y);
      if (footprint && pointInPolygon(p, footprint))
        continue;
      if (dTown > reach)
        continue;
      const t = Math.max(0, Math.min(1, (dTown - zoneRadius) / (reach - zoneRadius)));
      const prob = 0.5 * (1 - t);
      const nb = pts[Math.min(i + 1, pts.length - 1)];
      let tx = nb.x - p.x;
      let ty = nb.y - p.y;
      const tl = Math.hypot(tx, ty) || 1;
      tx /= tl;
      ty /= tl;
      const px = -ty;
      const py = tx;
      for (const sgn of [-1, 1]) {
        if (rng() > prob)
          continue;
        const off = zoneRadius * 0.04 + 6 + rng() * 4;
        const hx = p.x + px * off * sgn;
        const hy = p.y + py * off * sgn;
        if (blocked({ x: hx, y: hy }))
          continue;
        let tooClose = false;
        for (const h2 of newHouses) {
          if (Math.hypot(hx - h2.centre.x, hy - h2.centre.y) < 10) {
            tooClose = true;
            break;
          }
        }
        if (tooClose)
          continue;
        const ang = Math.atan2(ty, tx);
        const hw = 14 + rng() * 6;
        const hh = 9 + rng() * 3;
        newHouses.push({ centre: { x: hx, y: hy }, size: [hw, hh], angle: ang });
      }
    }
  }
  for (const nh of newHouses)
    houses.push(nh);
  return newHouses;
}
export function rngShuffle(rng, lst) {
  for (let i = lst.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = lst[i];
    lst[i] = lst[j];
    lst[j] = tmp;
  }
}
export var OUTBUILDING_COUNTS = {
  // Small settlements get a handful of outlying functional buildings for
  // character — a mill, an inn, a stable — with no generic sprawl (that's a
  // city phenomenon).  Numbers grow with size.
  village: { mill: 1, inn: 1, stable: 1, generic: 0 },
  small_town: { mill: 1, inn: 1, stable: 1, generic: 0 },
  town: { mill: 1, inn: 1, stable: 2, generic: 0 },
  large_town: { mill: 1, inn: 2, stable: 2, generic: 0 },
  // Cities get more, plus generic sprawl trailing the approach roads.
  small_city: { mill: 1, inn: 1, stable: 1, generic: 0 },
  city: { mill: 1, inn: 2, stable: 2, generic: 4 },
  large_city: { mill: 2, inn: 3, stable: 3, generic: 9 },
  metropolis: { mill: 2, inn: 4, stable: 4, generic: 16 }
};
export function placeOutbuildings(rng, scene, townSite, zoneRadius, size, w, h) {
  const water = scene.water;
  const forests = scene.forests ?? [];
  const ridges = scene.ridges ?? [];
  const footprint = scene.footprint;
  const roads = scene.roads ?? [];
  const wallRings = [];
  {
    const walls = scene.walls;
    if (walls) {
      if (walls.rings && walls.rings.length)
        for (const r of walls.rings) {
          if (r && r.length >= 3)
            wallRings.push(r);
        }
      else if (walls.ring && walls.ring.length >= 3)
        wallRings.push(walls.ring);
    }
  }
  const counts = OUTBUILDING_COUNTS[size] ?? { mill: 0, inn: 0, stable: 0 };
  const placed = [];
  const outlanes = [];
  const beachDist = Math.min(w, h) * 0.02;
  const waterMargin = beachDist + 4;
  const distToPoly = (pt, poly) => {
    let best = Infinity;
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i];
      const b = poly[(i + 1) % poly.length];
      const ex = b.x - a.x, ey = b.y - a.y;
      const s2 = ex * ex + ey * ey || 1;
      let t = ((pt.x - a.x) * ex + (pt.y - a.y) * ey) / s2;
      t = Math.max(0, Math.min(1, t));
      const qx = a.x + ex * t, qy = a.y + ey * t;
      const d = Math.hypot(pt.x - qx, pt.y - qy);
      if (d < best)
        best = d;
    }
    return best;
  };
  const distToFootprint = (pt) => {
    if (!footprint || footprint.length < 2)
      return Infinity;
    return distToPoly(pt, footprint);
  };
  const openGround = (pt, clear = 14, checkBuildings = true, footprintClear = 0) => {
    if (water && pointInPolygon(pt, water))
      return false;
    for (const r of ridges) {
      if (pointInPolygon(pt, r))
        return false;
    }
    for (const f of forests) {
      if (pointInPolygon(pt, f.polygon))
        return false;
    }
    if (footprint && pointInPolygon(pt, footprint))
      return false;
    if (footprintClear > 0 && distToFootprint(pt) < footprintClear)
      return false;
    for (const ring of wallRings) {
      if (pointInPolygon(pt, ring))
        return false;
      const wc = footprintClear > 0 ? footprintClear : clear;
      if (distToPoly(pt, ring) < wc)
        return false;
    }
    if (checkBuildings) {
      for (const ob of placed) {
        if (Math.hypot(pt.x - ob.centre.x, pt.y - ob.centre.y) < clear + ob.size[0] * 0.5)
          return false;
      }
    }
    return true;
  };
  const acceptCandidates = (cand, count, type, bsize) => {
    let n = 0;
    const sep = bsize[0] * 0.5;
    for (const [pos, ang] of cand) {
      if (n >= count)
        break;
      if (!openGround(pos, sep, true))
        continue;
      placed.push({ type, centre: pos, size: bsize, angle: ang });
      n++;
    }
  };
  if (water && counts.mill > 0) {
    const n = water.length;
    const cand = [];
    for (let i = 0; i < n; i += 2) {
      const wx = water[i].x;
      const wy = water[i].y;
      const dTown = Math.hypot(wx - townSite.x, wy - townSite.y);
      if (dTown < zoneRadius * 0.8 || dTown > zoneRadius * 1.8)
        continue;
      let ix = townSite.x - wx;
      let iy = townSite.y - wy;
      const il = Math.hypot(ix, iy) || 1;
      ix /= il;
      iy /= il;
      const mx = wx + ix * (waterMargin + 7);
      const my = wy + iy * (waterMargin + 7);
      if (openGround({ x: mx, y: my }, 16, true, 12)) {
        const bx = water[(i + 1) % n].x;
        const by = water[(i + 1) % n].y;
        cand.push([{ x: mx, y: my }, Math.atan2(by - wy, bx - wx)]);
      }
    }
    rngShuffle(rng, cand);
    acceptCandidates(cand, counts.mill, "mill", [20, 14]);
  }
  if (counts.inn > 0) {
    const cand = [];
    for (const road of roads) {
      if (road.class === "bridge")
        continue;
      if (road.role !== "primary" && road.role !== "branch")
        continue;
      const pts = road.points;
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        const dTown = Math.hypot(p.x - townSite.x, p.y - townSite.y);
        if (dTown < zoneRadius * 1.2 || dTown > zoneRadius * 2.6)
          continue;
        const nb = pts[Math.min(i + 1, pts.length - 1)];
        let tx = nb.x - p.x;
        let ty = nb.y - p.y;
        const tl = Math.hypot(tx, ty) || 1;
        tx /= tl;
        ty /= tl;
        const px = -ty;
        const py = tx;
        const off = 12 + rng() * 4;
        const sgn = rng() < 0.5 ? 1 : -1;
        const ix = p.x + px * off * sgn;
        const iy = p.y + py * off * sgn;
        if (openGround({ x: ix, y: iy }, 18, true, 16))
          cand.push([{ x: ix, y: iy }, Math.atan2(ty, tx)]);
      }
    }
    rngShuffle(rng, cand);
    acceptCandidates(cand, counts.inn, "inn", [22, 15]);
  }
  if (counts.stable > 0) {
    const cand = [];
    for (const road of roads) {
      if (road.class === "bridge")
        continue;
      if (road.role !== "primary" && road.role !== "branch")
        continue;
      const pts = road.points;
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        const dTown = Math.hypot(p.x - townSite.x, p.y - townSite.y);
        if (dTown < zoneRadius * 0.95 || dTown > zoneRadius * 1.6)
          continue;
        const nb = pts[Math.min(i + 1, pts.length - 1)];
        let tx = nb.x - p.x;
        let ty = nb.y - p.y;
        const tl = Math.hypot(tx, ty) || 1;
        tx /= tl;
        ty /= tl;
        const px = -ty;
        const py = tx;
        const off = 14 + rng() * 5;
        const sgn = rng() < 0.5 ? 1 : -1;
        const ix = p.x + px * off * sgn;
        const iy = p.y + py * off * sgn;
        if (openGround({ x: ix, y: iy }, 20, true, 18))
          cand.push([{ x: ix, y: iy }, Math.atan2(ty, tx)]);
      }
    }
    rngShuffle(rng, cand);
    acceptCandidates(cand, counts.stable, "stable", [24, 16]);
  }
  {
    const laneClear = (q) => {
      if (water && pointInPolygon(q, water))
        return false;
      for (const r of ridges)
        if (pointInPolygon(q, r))
          return false;
      return true;
    };
    const segClear = (a, b) => {
      const steps = Math.max(2, Math.floor(Math.hypot(b.x - a.x, b.y - a.y) / 10));
      for (let s = 1; s <= steps; s++) {
        const t = s / steps;
        if (!laneClear({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }))
          return false;
      }
      return true;
    };
    const candidatePoints = [];
    for (const road of roads)
      for (const q of road.points)
        candidatePoints.push(q);
    const nearestLandConnectable = (pt) => {
      let best = null;
      let bestd = Infinity;
      for (const q of candidatePoints) {
        const d = Math.hypot(q.x - pt.x, q.y - pt.y);
        if (d >= bestd)
          continue;
        if (!segClear(q, pt))
          continue;
        bestd = d;
        best = q;
      }
      for (const lane of outlanes)
        for (const q of lane.points) {
          const d = Math.hypot(q.x - pt.x, q.y - pt.y);
          if (d >= bestd)
            continue;
          if (!segClear(q, pt))
            continue;
          bestd = d;
          best = q;
        }
      return [best, bestd];
    };
    const NEAR_ROAD = 16;
    const MAX_LANE = Math.min(zoneRadius * 0.9, 150);
    const dropped = /* @__PURE__ */ new Set();
    for (const ob of placed) {
      const [anchor, ad] = nearestLandConnectable(ob.centre);
      if (anchor === null) {
        dropped.add(ob);
        continue;
      }
      if (ad <= NEAR_ROAD)
        continue;
      if (ad > MAX_LANE) {
        dropped.add(ob);
        continue;
      }
      let dx = ob.centre.x - anchor.x;
      let dy = ob.centre.y - anchor.y;
      const dl = Math.hypot(dx, dy) || 1;
      dx /= dl;
      dy /= dl;
      const stop = Math.max(0, dl - ob.size[0] * 0.5);
      const end = { x: anchor.x + dx * stop, y: anchor.y + dy * stop };
      const buildCurved = (amp) => {
        const len = Math.hypot(end.x - anchor.x, end.y - anchor.y);
        const segCount = Math.max(4, Math.round(len / 28));
        const px = -dy;
        const py = dx;
        const bowDir = rng() < 0.5 ? 1 : -1;
        const bowMag = amp * (0.5 + rng() * 0.6) * bowDir;
        const phase = rng() * Math.PI * 2;
        const freq = 1.2 + rng() * 1.3;
        const pts = [];
        for (let s = 0; s <= segCount; s++) {
          const t = s / segCount;
          const bx = anchor.x + (end.x - anchor.x) * t;
          const by = anchor.y + (end.y - anchor.y) * t;
          const taper = Math.sin(t * Math.PI);
          const bow = bowMag * taper;
          const wobble = amp * 0.35 * Math.sin(phase + t * Math.PI * 2 * freq) * taper;
          const off = bow + wobble;
          pts.push({ x: bx + px * off, y: by + py * off });
        }
        pts[0] = { x: anchor.x, y: anchor.y };
        pts[pts.length - 1] = { x: end.x, y: end.y };
        for (const q of pts)
          if (!laneClear(q))
            return null;
        return pts;
      };
      const ampBase = Math.min(40, Math.max(12, Math.hypot(end.x - anchor.x, end.y - anchor.y) * 0.12));
      const curved = buildCurved(ampBase) ?? buildCurved(ampBase * 0.5) ?? buildCurved(ampBase * 0.25);
      outlanes.push({ points: curved ?? [{ x: anchor.x, y: anchor.y }, end] });
    }
    if (dropped.size) {
      for (let i = placed.length - 1; i >= 0; i--)
        if (dropped.has(placed[i]))
          placed.splice(i, 1);
    }
  }
  if (counts.generic > 0) {
    const inner = zoneRadius * 1.4;
    const outer = zoneRadius * 3.2;
    const falloff = (d) => {
      if (d <= inner)
        return 1;
      if (d >= outer)
        return 0;
      return 1 - (d - inner) / (outer - inner);
    };
    const genPts = [];
    const seeds = [];
    for (const road of roads) {
      if (road.class === "bridge")
        continue;
      if (road.role !== "primary" && road.role !== "branch")
        continue;
      const pts = road.points;
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        const dTown = Math.hypot(p.x - townSite.x, p.y - townSite.y);
        if (dTown < inner || dTown > outer)
          continue;
        if (rng() < 0.5 * falloff(dTown)) {
          const nb = pts[Math.min(i + 1, pts.length - 1)];
          let tx = nb.x - p.x;
          let ty = nb.y - p.y;
          const tl = Math.hypot(tx, ty) || 1;
          tx /= tl;
          ty /= tl;
          seeds.push([{ x: p.x, y: p.y }, { x: tx, y: ty }, dTown]);
        }
      }
    }
    rngShuffle(rng, seeds);
    let budget = counts.generic;
    for (const [sp, tan, dTown] of seeds) {
      if (budget <= 0)
        break;
      const px = -tan.y;
      const py = tan.x;
      const sgn = rng() < 0.5 ? 1 : -1;
      const baseOff = 34 + rng() * 30;
      const bx = sp.x + px * baseOff * sgn;
      const by = sp.y + py * baseOff * sgn;
      let clump = 1 + Math.floor(rng() * (1 + 2 * falloff(dTown) + 1));
      clump = Math.min(clump, budget);
      for (let k = 0; k < clump; k++) {
        const jx = bx + (rng() - 0.5) * 26;
        const jy = by + (rng() - 0.5) * 26;
        let tooClose = false;
        for (const gp of genPts) {
          if (Math.hypot(gp.x - jx, gp.y - jy) < 16) {
            tooClose = true;
            break;
          }
        }
        if (tooClose)
          continue;
        if (openGround({ x: jx, y: jy }, 9, true, 11)) {
          genPts.push({ x: jx, y: jy });
          budget -= 1;
          if (budget <= 0)
            break;
        }
      }
    }
    for (const g of genPts) {
      const gw = 11 + rng() * 6;
      const gh = 8 + rng() * 3;
      const ang = rng() * Math.PI;
      placed.push({ type: "generic", centre: g, size: [gw, gh], angle: ang });
    }
    const CLUSTER_R = 34;
    const used = new Array(genPts.length).fill(false);
    const clusters = [];
    for (let a = 0; a < genPts.length; a++) {
      if (used[a])
        continue;
      const group = [a];
      used[a] = true;
      let changed = true;
      while (changed) {
        changed = false;
        for (let b = 0; b < genPts.length; b++) {
          if (used[b])
            continue;
          for (const m of group) {
            if (Math.hypot(genPts[b].x - genPts[m].x, genPts[b].y - genPts[m].y) < CLUSTER_R) {
              group.push(b);
              used[b] = true;
              changed = true;
              break;
            }
          }
        }
      }
      clusters.push(group);
    }
    const nearestArterialPoint = (pt) => {
      let best = null;
      let bestd = Infinity;
      for (const road of roads) {
        if (road.class === "bridge")
          continue;
        if (road.role !== "primary" && road.role !== "branch")
          continue;
        for (const q of road.points) {
          const d = Math.hypot(q.x - pt.x, q.y - pt.y);
          if (d < bestd) {
            bestd = d;
            best = q;
          }
        }
      }
      return [best, bestd];
    };
    for (const group of clusters) {
      if (group.length < 2)
        continue;
      let gx = 0;
      let gy = 0;
      for (const i of group) {
        gx += genPts[i].x;
        gy += genPts[i].y;
      }
      gx /= group.length;
      gy /= group.length;
      const [anchor, ad] = nearestArterialPoint({ x: gx, y: gy });
      if (anchor === null)
        continue;
      if (ad < 16)
        continue;
      const lane = [{ x: anchor.x, y: anchor.y }, { x: gx, y: gy }];
      let far = null;
      let fard = 0;
      for (const i of group) {
        const d = Math.hypot(genPts[i].x - anchor.x, genPts[i].y - anchor.y);
        if (d > fard) {
          fard = d;
          far = genPts[i];
        }
      }
      if (far !== null && Math.hypot(far.x - gx, far.y - gy) > 22) {
        lane.push({ x: far.x, y: far.y });
      }
      let ok = true;
      for (let k = 1; k < lane.length; k++) {
        if (!openGround(lane[k], 3, false)) {
          ok = false;
          break;
        }
      }
      if (ok)
        outlanes.push({ points: lane });
    }
  }
  scene.outlanes = outlanes;
  scene.outbuildings = placed;
  return placed;
}
export function ensureRiverBridge(rng, scene, w, h) {
  const roads = scene.roads || [];
  if (roads.some((r) => r.class === "bridge"))
    return;
  const cline = scene.centreline;
  const houses = scene.houses || [];
  if (!cline || cline.length < 2 || houses.length < 20)
    return;
  const a = [], b = [];
  for (const hh of houses) {
    if (waterSideOfPoint(hh.centre, scene, w, h) === "A")
      a.push(hh);
    else
      b.push(hh);
  }
  const minor = Math.min(a.length, b.length);
  if (minor < 15 || minor / houses.length < 0.12)
    return;
  const cen = (arr) => ({
    x: arr.reduce((s, p) => s + p.centre.x, 0) / arr.length,
    y: arr.reduce((s, p) => s + p.centre.y, 0) / arr.length
  });
  const ca = cen(a), cb = cen(b);
  const mid = { x: (ca.x + cb.x) / 2, y: (ca.y + cb.y) / 2 };
  let best = null, bestD = Infinity;
  const lo = Math.floor(cline.length * 0.08), hi = Math.floor(cline.length * 0.92);
  for (let i = lo; i < hi; i++) {
    const p = cline[i];
    if (p.x < w * 0.05 || p.x > w * 0.95 || p.y < h * 0.05 || p.y > h * 0.95)
      continue;
    const d = Math.hypot(p.x - mid.x, p.y - mid.y);
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  }
  if (best === null)
    return;
  const bankA = bankEndpointForBridge(best, scene, w, h, "A");
  const bankB = bankEndpointForBridge(best, scene, w, h, "B");
  roads.push({ points: [bankA, best, bankB], class: "bridge", role: "bridge" });
  const stub = (bank, target) => {
    const dx = target.x - bank.x, dy = target.y - bank.y;
    const d = Math.hypot(dx, dy) || 1;
    const len = Math.min(d, 60);
    return [bank, { x: bank.x + dx / d * len, y: bank.y + dy / d * len }];
  };
  roads.push({ points: stub(bankA, ca), class: "arterial", role: "branch", side: "A" });
  roads.push({ points: stub(bankB, cb), class: "arterial", role: "branch", side: "B" });
  scene.roads = roads;
}
export function buildDock(rng, scene, townSite, zoneRadius, size, w, h, terrain) {
  const water = scene.water;
  if (!water || water.length < 4)
    return null;
  const footprint = scene.footprint;
  const ref = footprint && footprint.length >= 3 ? { x: footprint.reduce((s, p) => s + p.x, 0) / footprint.length, y: footprint.reduce((s, p) => s + p.y, 0) / footprint.length } : townSite;
  const roads = scene.roads ?? [];
  const bridgePts = [];
  for (const road of roads) {
    if (road.class === "bridge")
      for (const p of road.points)
        bridgePts.push(p);
  }
  const bridgeClear = 40;
  const nearBridge = (p) => {
    for (const bp of bridgePts) {
      if (Math.hypot(bp.x - p.x, bp.y - p.y) < bridgeClear)
        return true;
    }
    return false;
  };
  const margin = Math.min(w, h) * 0.04;
  const inCanvas = (p) => p.x >= -margin && p.x <= w + margin && p.y >= -margin && p.y <= h + margin;
  let boundary;
  if (footprint && footprint.length >= 3) {
    boundary = footprint;
  } else {
    boundary = [];
    for (let i = 0; i < 48; i++) {
      const a = 2 * Math.PI * i / 48;
      boundary.push({ x: townSite.x + Math.cos(a) * zoneRadius, y: townSite.y + Math.sin(a) * zoneRadius });
    }
  }
  const beachDist = Math.min(w, h) * 0.02;
  const denseBoundary = [];
  for (let i = 0; i < boundary.length; i++) {
    const a = boundary[i];
    const b = boundary[(i + 1) % boundary.length];
    denseBoundary.push(a);
    const segLen = Math.hypot(b.x - a.x, b.y - a.y);
    const steps = Math.floor(segLen / 12);
    for (let s = 1; s < steps; s++) {
      denseBoundary.push({ x: a.x + (b.x - a.x) * (s / steps), y: a.y + (b.y - a.y) * (s / steps) });
    }
  }
  let shorePt = null;
  let ox = 0, oy = 0;
  let bestScore = Infinity;
  for (const bp of denseBoundary) {
    let dx = bp.x - ref.x;
    let dy = bp.y - ref.y;
    const dl = Math.hypot(dx, dy) || 1;
    dx /= dl;
    dy /= dl;
    let hit = Infinity;
    for (let s = 1; s <= 18; s++) {
      const q = { x: bp.x + dx * s * 4, y: bp.y + dy * s * 4 };
      if (pointInPolygonNonzero(q, water)) {
        hit = s * 4;
        break;
      }
    }
    if (!isFinite(hit))
      continue;
    if (hit > beachDist + 16)
      continue;
    if (nearBridge(bp))
      continue;
    if (hit < bestScore) {
      bestScore = hit;
      shorePt = bp;
      ox = dx;
      oy = dy;
    }
  }
  if (shorePt === null) {
    return null;
  }
  {
    let bestD = Infinity;
    let segTx = -oy, segTy = ox;
    const n = water.length;
    for (let i = 0; i < n; i++) {
      const a = water[i];
      const b = water[(i + 1) % n];
      const ex = b.x - a.x, ey = b.y - a.y;
      const s2 = ex * ex + ey * ey || 1;
      let t = ((shorePt.x - a.x) * ex + (shorePt.y - a.y) * ey) / s2;
      t = Math.max(0, Math.min(1, t));
      const qx = a.x + ex * t, qy = a.y + ey * t;
      const d = (shorePt.x - qx) ** 2 + (shorePt.y - qy) ** 2;
      if (d < bestD) {
        bestD = d;
        const el = Math.hypot(ex, ey) || 1;
        segTx = ex / el;
        segTy = ey / el;
      }
    }
    let nx = -segTy, ny = segTx;
    const reachesWater = (dx, dy) => {
      for (let s = 1; s <= 14; s++) {
        if (pointInPolygonNonzero({ x: shorePt.x + dx * s * 3, y: shorePt.y + dy * s * 3 }, water))
          return true;
      }
      return false;
    };
    if (!reachesWater(nx, ny) && reachesWater(-nx, -ny)) {
      nx = -nx;
      ny = -ny;
    }
    if (reachesWater(nx, ny)) {
      ox = nx;
      oy = ny;
    }
  }
  let landRoot = { x: shorePt.x, y: shorePt.y };
  const findLand = () => {
    for (let s = 0; s <= 24; s++) {
      const q = { x: shorePt.x - ox * s * 3, y: shorePt.y - oy * s * 3 };
      if (!pointInPolygonNonzero(q, water)) {
        landRoot = q;
        return true;
      }
    }
    return false;
  };
  if (!findLand()) {
    ox = -ox;
    oy = -oy;
    if (!findLand()) {
      return null;
    }
  }
  const inward = { x: -ox, y: -oy };
  const tx = -oy;
  const ty = ox;
  let waterlinePt = { x: landRoot.x + ox * 8, y: landRoot.y + oy * 8 };
  let gapDist = 8;
  {
    for (let s = 0; s <= 80; s++) {
      const q = { x: landRoot.x + ox * s * 3, y: landRoot.y + oy * s * 3 };
      if (pointInPolygonNonzero(q, water)) {
        waterlinePt = q;
        gapDist = s * 3;
        break;
      }
    }
  }
  if (gapDist > beachDist + 30) {
    return null;
  }
  const scaleBySize = { small_city: 0.8, city: 1, large_city: 1.25, metropolis: 1.5 };
  const sc = scaleBySize[size] ?? 0.8;
  const quayHalfLen = 34 * sc;
  const quayDepth = 12 * sc;
  const quaySpan = gapDist + quayDepth * 0.5;
  const quayCentre = {
    x: landRoot.x + ox * (quaySpan * 0.5),
    y: landRoot.y + oy * (quaySpan * 0.5)
  };
  const quayHalf = quaySpan * 0.5 + 1;
  const quay = [
    { x: quayCentre.x + tx * quayHalfLen + ox * quayHalf, y: quayCentre.y + ty * quayHalfLen + oy * quayHalf },
    { x: quayCentre.x - tx * quayHalfLen + ox * quayHalf, y: quayCentre.y - ty * quayHalfLen + oy * quayHalf },
    { x: quayCentre.x - tx * quayHalfLen - ox * quayHalf, y: quayCentre.y - ty * quayHalfLen - oy * quayHalf },
    { x: quayCentre.x + tx * quayHalfLen - ox * quayHalf, y: quayCentre.y + ty * quayHalfLen - oy * quayHalf }
  ];
  const jettyCount = size === "small_city" ? 1 : size === "metropolis" ? 3 : 2;
  const riverish = terrain === "river";
  let waterSpan = Infinity;
  {
    const stepLen = 6;
    let steps = 0;
    for (let s = 1; s <= 80; s++) {
      const q = { x: waterlinePt.x + ox * s * stepLen, y: waterlinePt.y + oy * s * stepLen };
      if (!pointInPolygonNonzero(q, water)) {
        steps = s;
        break;
      }
      steps = s;
    }
    waterSpan = steps * stepLen;
  }
  let jettyLen = ((riverish ? 22 : 34) + rng() * (riverish ? 8 : 14)) * sc;
  if (isFinite(waterSpan))
    jettyLen = Math.min(jettyLen, waterSpan * 0.45);
  jettyLen = Math.max(jettyLen, 16);
  const jettyHalfW = 3.2 * sc;
  const jetties = [];
  const boats = [];
  for (let j = 0; j < jettyCount; j++) {
    const frac = jettyCount === 1 ? 0 : (j / (jettyCount - 1) - 0.5) * 1.5;
    const root = {
      x: waterlinePt.x - ox * 4 + tx * (quayHalfLen * frac),
      y: waterlinePt.y - oy * 4 + ty * (quayHalfLen * frac)
    };
    let reach = jettyLen + 4;
    {
      let intoWater = 0;
      for (let s = 1; s <= 60; s++) {
        const q = { x: root.x + ox * s * 4, y: root.y + oy * s * 4 };
        if (pointInPolygonNonzero(q, water)) {
          intoWater = s * 4;
          break;
        }
      }
      reach = Math.max(reach, intoWater + jettyLen * 0.5);
      if (isFinite(waterSpan))
        reach = Math.min(reach, (intoWater || 0) + waterSpan * 0.45);
    }
    const tip = { x: root.x + ox * reach, y: root.y + oy * reach };
    jetties.push([
      { x: root.x + tx * jettyHalfW, y: root.y + ty * jettyHalfW },
      { x: tip.x + tx * jettyHalfW, y: tip.y + ty * jettyHalfW },
      { x: tip.x - tx * jettyHalfW, y: tip.y - ty * jettyHalfW },
      { x: root.x - tx * jettyHalfW, y: root.y - ty * jettyHalfW }
    ]);
    if (rng() < 0.7) {
      const along = 0.6 + rng() * 0.3;
      const side = rng() < 0.5 ? 1 : -1;
      const bpos = {
        x: root.x + ox * (reach * along) + tx * side * (jettyHalfW + 5 * sc),
        y: root.y + oy * (reach * along) + ty * side * (jettyHalfW + 5 * sc)
      };
      boats.push({ pos: bpos, angle: Math.atan2(oy, ox), len: (16 + rng() * 8) * sc });
    }
  }
  const houses = scene.houses ?? [];
  const overlapsHouse = (cx2, cy2, clr) => {
    for (const h2 of houses) {
      if (Math.hypot(h2.centre.x - cx2, h2.centre.y - cy2) < clr)
        return true;
    }
    return false;
  };
  const warehouses = [];
  {
    const whCount = size === "small_city" ? 1 : size === "metropolis" ? 4 : 2;
    const whW = 13 * sc;
    const whD = 9 * sc;
    const spread = quayHalfLen * 1.1;
    for (let k = 0; k < whCount; k++) {
      const frac = whCount === 1 ? 0 : (k / (whCount - 1) - 0.5) * 2;
      const cxw = waterlinePt.x - ox * (whD * 0.5 + 3) + tx * (spread * frac * 0.7);
      const cyw = waterlinePt.y - oy * (whD * 0.5 + 3) + ty * (spread * frac * 0.7);
      if (overlapsHouse(cxw, cyw, whW * 0.55 + 6))
        continue;
      const hw = whW / 2;
      const hd = whD / 2;
      warehouses.push([
        { x: cxw + tx * hw + ox * hd, y: cyw + ty * hw + oy * hd },
        { x: cxw - tx * hw + ox * hd, y: cyw - ty * hw + oy * hd },
        { x: cxw - tx * hw - ox * hd, y: cyw - ty * hw - oy * hd },
        { x: cxw + tx * hw - ox * hd, y: cyw + ty * hw - oy * hd }
      ]);
    }
  }
  let anyTipInWater = false;
  for (const jp of jetties) {
    const tip = { x: (jp[1].x + jp[2].x) / 2, y: (jp[1].y + jp[2].y) / 2 };
    if (pointInPolygonNonzero(tip, water)) {
      anyTipInWater = true;
      break;
    }
  }
  if (!anyTipInWater) {
    return null;
  }
  if (pointInPolygonNonzero(landRoot, water)) {
    return null;
  }
  {
    const houses2 = scene.houses ?? [];
    let near = false;
    const reach = 70;
    for (const h2 of houses2) {
      if (Math.hypot(h2.centre.x - landRoot.x, h2.centre.y - landRoot.y) < reach) {
        near = true;
        break;
      }
    }
    if (!near) {
      return null;
    }
  }
  let lane;
  {
    const candidates = [];
    for (const road of roads) {
      if (road.class === "bridge")
        continue;
      for (const p of road.points)
        candidates.push(p);
    }
    const sb = scene.street_base;
    if (sb)
      for (const blk of sb)
        for (const p of blk)
          candidates.push(p);
    let best = null;
    let bestD = Infinity;
    const laneStart = { x: landRoot.x - ox * 4, y: landRoot.y - oy * 4 };
    for (const cp of candidates) {
      const d = Math.hypot(cp.x - laneStart.x, cp.y - laneStart.y);
      if (d < 6 || d > 220)
        continue;
      if (d < bestD) {
        bestD = d;
        best = cp;
      }
    }
    if (best) {
      let clear = true;
      const steps = Math.max(4, Math.round(bestD / 10));
      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        const q = { x: laneStart.x + (best.x - laneStart.x) * t, y: laneStart.y + (best.y - laneStart.y) * t };
        if (pointInPolygonNonzero(q, water)) {
          clear = false;
          break;
        }
      }
      if (clear && bestD > 18) {
        const mx = (laneStart.x + best.x) / 2;
        const my = (laneStart.y + best.y) / 2;
        let px = -(best.y - laneStart.y);
        let py = best.x - laneStart.x;
        const pl = Math.hypot(px, py) || 1;
        px /= pl;
        py /= pl;
        const bow = (rng() - 0.5) * Math.min(18, bestD * 0.15);
        lane = [
          { x: laneStart.x, y: laneStart.y },
          { x: mx + px * bow, y: my + py * bow },
          { x: best.x, y: best.y }
        ];
      }
    }
  }
  return { quay, jetties, boats, warehouses, lane, shorePt, inward };
}
export var FARM_CAP = {
  hamlet: 14,
  village: 28,
  small_town: 45,
  town: 65,
  large_town: 90,
  small_city: 120,
  city: 160,
  large_city: 210,
  metropolis: 280
};
export function placeFarms(rng, scene, townSite, zoneRadius, size, w, h, houses, farmMul = 1) {
  const water = scene.water;
  const forests = scene.forests ?? [];
  const ridges = scene.ridges ?? [];
  const avoid = builtAreaPolys(scene);
  const cornerReach = Math.max(
    Math.hypot(townSite.x, townSite.y),
    Math.hypot(w - townSite.x, townSite.y),
    Math.hypot(townSite.x, h - townSite.y),
    Math.hypot(w - townSite.x, h - townSite.y)
  ) + 40;
  const minReach = zoneRadius * 2.8 + Math.min(w, h) * 0.22;
  const farmReach = Math.max(cornerReach, minReach);
  const n = 64;
  let region = [];
  for (let i = 0; i < n; i++) {
    const a = 2 * Math.PI * i / n;
    const rr = farmReach * (0.95 + 0.1 * Math.sin(a * 2 + rng() * 6));
    region.push({ x: townSite.x + Math.cos(a) * rr, y: townSite.y + Math.sin(a) * rr });
  }
  const targetFieldArea = Math.max(1800, zoneRadius * zoneRadius * 0.1);
  const parcels = subdivideFootprint(region, targetFieldArea, rng, townSite, zoneRadius);
  const roadSegs = [];
  for (const road of scene.roads ?? []) {
    let clr;
    if (road.class === "bridge")
      clr = 10;
    else if (road.role === "primary" || road.role === "branch")
      clr = 9;
    else
      clr = 6;
    const pts = road.points ?? [];
    for (let i = 0; i < pts.length - 1; i++) {
      roadSegs.push([pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y, clr]);
    }
  }
  for (const lane of scene.outlanes ?? []) {
    const pts = lane.points ?? [];
    for (let i = 0; i < pts.length - 1; i++) {
      roadSegs.push([pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y, 6]);
    }
  }
  const segPointDist = (px, py, ax, ay, bx, by) => {
    const dx = bx - ax;
    const dy = by - ay;
    const seg2 = dx * dx + dy * dy;
    if (seg2 < 1e-9)
      return Math.hypot(px - ax, py - ay);
    const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / seg2));
    return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
  };
  const roadCrosses = (poly) => {
    let minx = Infinity, maxx = -Infinity, miny = Infinity, maxy = -Infinity;
    for (const q of poly) {
      if (q.x < minx)
        minx = q.x;
      if (q.x > maxx)
        maxx = q.x;
      if (q.y < miny)
        miny = q.y;
      if (q.y > maxy)
        maxy = q.y;
    }
    for (const [ax, ay, bx, by, clr] of roadSegs) {
      if (Math.max(ax, bx) < minx - clr || Math.min(ax, bx) > maxx + clr || Math.max(ay, by) < miny - clr || Math.min(ay, by) > maxy + clr)
        continue;
      if (pointInPolygon({ x: ax, y: ay }, poly) || pointInPolygon({ x: bx, y: by }, poly))
        return true;
      for (const v of poly) {
        if (segPointDist(v.x, v.y, ax, ay, bx, by) < clr)
          return true;
      }
      for (let i = 0; i < poly.length; i++) {
        const c = poly[i];
        const d = poly[(i + 1) % poly.length];
        if (segmentsIntersect(ax, ay, bx, by, c.x, c.y, d.x, d.y))
          return true;
      }
    }
    return false;
  };
  const beachDist = Math.min(w, h) * 0.02;
  const waterMargin = beachDist + 5;
  const distToPolyEdge = (pt, poly) => {
    let best = Infinity;
    const nn = poly.length;
    for (let i = 0; i < nn; i++) {
      const a = poly[i];
      const b = poly[(i + 1) % nn];
      best = Math.min(best, segPointDist(pt.x, pt.y, a.x, a.y, b.x, b.y));
    }
    return best;
  };
  const parcelOnOpenGround = (poly) => {
    let cx = 0, cy = 0;
    for (const q of poly) {
      cx += q.x;
      cy += q.y;
    }
    cx /= poly.length;
    cy /= poly.length;
    if (cx < 0 || cx > w || cy < 0 || cy > h)
      return false;
    const testPts = poly.concat([{ x: cx, y: cy }]);
    for (const pt of testPts) {
      if (water) {
        if (pointInPolygon(pt, water))
          return false;
        if (distToPolyEdge(pt, water) < waterMargin)
          return false;
      }
      for (const r of ridges) {
        if (pointInPolygon(pt, r))
          return false;
      }
      for (const f of forests) {
        if (pointInPolygon(pt, f.polygon))
          return false;
      }
      for (const poly2 of avoid) {
        if (pointInPolygon(pt, poly2))
          return false;
      }
    }
    return true;
  };
  const cap = Math.max(0, Math.round((FARM_CAP[size] ?? 30) * farmMul));
  const farms = [];
  for (const p of parcels) {
    if (p.length < 3)
      continue;
    if (farms.length >= cap)
      break;
    let cx = 0, cy = 0;
    for (const q of p) {
      cx += q.x;
      cy += q.y;
    }
    cx /= p.length;
    cy /= p.length;
    if (Math.hypot(cx - townSite.x, cy - townSite.y) < zoneRadius * 1.05)
      continue;
    const sp = shrinkPolygon(p, 2);
    if (!sp || sp.length < 3)
      continue;
    if (!parcelOnOpenGround(sp))
      continue;
    if (roadCrosses(sp))
      continue;
    let best = 0;
    let bl = 0;
    for (let i = 0; i < sp.length; i++) {
      const a = sp[i];
      const b = sp[(i + 1) % sp.length];
      const l = Math.hypot(b.x - a.x, b.y - a.y);
      if (l > bl) {
        bl = l;
        best = Math.atan2(b.y - a.y, b.x - a.x);
      }
    }
    const farm = { polygon: sp, hatchAngle: best };
    if (rng() < 0.28) {
      const vi = Math.floor(rng() * sp.length);
      const vx = sp[vi].x;
      const vy = sp[vi].y;
      farm.house = { x: vx + (cx - vx) * 0.35, y: vy + (cy - vy) * 0.35 };
    }
    farms.push(farm);
  }
  scene.farms = farms;
  return farms;
}
export function buildSettlement(rng, scene, w, h, size, terrain, overrides, cropSize) {
  const roads = scene.roads;
  if (!roads || !roads.length)
    return [];
  let townSite = null;
  for (const road of roads) {
    if (road.town_site) {
      townSite = road.town_site;
      break;
    }
  }
  if (townSite === null)
    return [];
  const zoneRadius = ZONE_RADIUS_BY_SIZE[size] ?? 150;
  const armLength = ARM_LENGTH_BY_SIZE[size];
  const subRoadCount = SUB_ROAD_COUNT_BY_SIZE[size] ?? 2;
  const houseTarget = HOUSE_TARGET_BY_SIZE[size] ?? 15;
  const isCity = armLength !== null && armLength !== void 0;
  if (!isCity && terrain === "coastal" && scene.water) {
    const water = scene.water;
    let nearest = water[0];
    let nd = Infinity;
    for (const p of water) {
      const d2 = (p.x - townSite.x) ** 2 + (p.y - townSite.y) ** 2;
      if (d2 < nd) {
        nd = d2;
        nearest = p;
      }
    }
    const dmin = Math.hypot(nearest.x - townSite.x, nearest.y - townSite.y);
    const want = zoneRadius * 0.5;
    if (dmin < want) {
      const ix = townSite.x - nearest.x;
      const iy = townSite.y - nearest.y;
      const il = Math.hypot(ix, iy) || 1;
      const push = want - dmin;
      let nx = townSite.x + ix / il * push;
      let ny = townSite.y + iy / il * push;
      const m = Math.min(w, h) * 0.06;
      nx = Math.max(m, Math.min(w - m, nx));
      ny = Math.max(m, Math.min(h - m, ny));
      townSite = { x: nx, y: ny };
      for (const road of roads)
        road.town_site = townSite;
    }
  }
  if (!isCity) {
    const newSubRoads = generateSubRoads(rng, scene, w, h, townSite, zoneRadius, subRoadCount, terrain);
    roads.push(...newSubRoads);
  }
  let houses;
  if (isCity) {
    houses = placeHousesCity(rng, scene, w, h, townSite, zoneRadius, armLength, houseTarget, terrain, size);
  } else {
    houses = placeHouses(rng, scene, w, h, townSite, zoneRadius, houseTarget, terrain);
  }
  if (!houses.length) {
    const { grid, cellW, cellH } = buildCostGrid(scene, w, h);
    const relocated = findOpenTownsite(rng, grid, w, h, cellW, cellH, scene, terrain);
    if (relocated !== null && (relocated.x !== townSite.x || relocated.y !== townSite.y)) {
      townSite = relocated;
      for (const road of roads)
        road.town_site = townSite;
      if (isCity) {
        houses = placeHousesCity(rng, scene, w, h, townSite, zoneRadius, armLength, houseTarget, terrain, size);
      } else {
        houses = placeHouses(rng, scene, w, h, townSite, zoneRadius, houseTarget, terrain);
      }
    }
  }
  scene.houses = houses;
  if (isCity && terrain === "river" && scene.centreline && scene.water) {
    ensureRiverBridge(rng, scene, w, h);
  }
  if (isCity) {
    placeLandmarks(rng, scene, townSite, zoneRadius, size, terrain, w, h, overrides, cropSize);
  }
  const footprint = scene.footprint;
  if (isCity && footprint && footprint.length >= 3) {
    const wallChance = { small_city: 0.5, city: 0.65, large_city: 0.8, metropolis: 0.9 };
    const roll = rng() < (wallChance[size] ?? 0.7);
    const want = overrides?.walls ?? roll;
    if (want) {
      scene.walls = buildCityWalls(rng, scene, townSite, zoneRadius, size, w, h);
    }
  }
  let curHouses = scene.houses ?? houses;
  if (isCity) {
    placeRibbonHouses(rng, scene, townSite, zoneRadius, size, w, h, curHouses);
    scene.houses = curHouses;
  }
  const OUTBUILDING_SIZES = ["village", "small_town", "town", "large_town", "small_city", "city", "large_city", "metropolis"];
  if (OUTBUILDING_SIZES.includes(size)) {
    placeOutbuildings(rng, scene, townSite, zoneRadius, size, w, h);
  }
  if (isCity && scene.water) {
    const dock = buildDock(rng, scene, townSite, zoneRadius, size, w, h, terrain);
    if (dock)
      scene.dock = dock;
  }
  placeFarms(rng, scene, townSite, zoneRadius, size, w, h, curHouses, overrides?.farmDensity ?? 1);
  return scene.houses ?? houses;
}
export function signedArea(polygon) {
  const n = polygon.length;
  if (n < 3)
    return 0;
  let s = 0;
  for (let i = 0; i < n; i++) {
    const a = polygon[i];
    const b = polygon[(i + 1) % n];
    s += a.x * b.y - b.x * a.y;
  }
  return s / 2;
}
export function polygonCentroid(polygon) {
  const n = polygon.length;
  if (n < 3) {
    return { x: polygon.reduce((s, p) => s + p.x, 0) / n, y: polygon.reduce((s, p) => s + p.y, 0) / n };
  }
  let sx = 0;
  let sy = 0;
  let a = 0;
  for (let i = 0; i < n; i++) {
    const p1 = polygon[i];
    const p2 = polygon[(i + 1) % n];
    const cross = p1.x * p2.y - p2.x * p1.y;
    sx += (p1.x + p2.x) * cross;
    sy += (p1.y + p2.y) * cross;
    a += cross;
  }
  a *= 0.5;
  if (Math.abs(a) < 1e-9) {
    return { x: polygon.reduce((s, p) => s + p.x, 0) / n, y: polygon.reduce((s, p) => s + p.y, 0) / n };
  }
  return { x: sx / (6 * a), y: sy / (6 * a) };
}
export function shrinkPolygon(polygon, inset) {
  const n = polygon.length;
  if (n < 3)
    return null;
  const area = signedArea(polygon);
  if (area === 0)
    return null;
  const sign = area > 0 ? 1 : -1;
  const out = [];
  for (let i = 0; i < n; i++) {
    const prev = polygon[(i - 1 + n) % n];
    const cur = polygon[i];
    const nxt = polygon[(i + 1) % n];
    const e1x = cur.x - prev.x;
    const e1y = cur.y - prev.y;
    const e2x = nxt.x - cur.x;
    const e2y = nxt.y - cur.y;
    const l1 = Math.hypot(e1x, e1y) || 1;
    const l2 = Math.hypot(e2x, e2y) || 1;
    const n1x = -e1y / l1 * sign;
    const n1y = e1x / l1 * sign;
    const n2x = -e2y / l2 * sign;
    const n2y = e2x / l2 * sign;
    const bx = n1x + n2x;
    const by = n1y + n2y;
    const bl = Math.hypot(bx, by);
    if (bl < 1e-6)
      continue;
    const scale = inset / bl * 2;
    out.push({ x: cur.x + bx * scale, y: cur.y + by * scale });
  }
  if (out.length < 3)
    return null;
  const newArea = signedArea(out);
  if (area > 0 !== newArea > 0)
    return null;
  if (Math.abs(newArea) < 8)
    return null;
  return out;
}
export function chaikinClosed(pts, iters = 2) {
  let poly = pts.slice();
  for (let k = 0; k < iters; k++) {
    const out = [];
    const n = poly.length;
    for (let i = 0; i < n; i++) {
      const a = poly[i];
      const b = poly[(i + 1) % n];
      out.push({ x: 0.75 * a.x + 0.25 * b.x, y: 0.75 * a.y + 0.25 * b.y });
      out.push({ x: 0.25 * a.x + 0.75 * b.x, y: 0.25 * a.y + 0.75 * b.y });
    }
    poly = out;
  }
  return poly;
}
export function fillBlockSolid(block, targetArea, rng) {
  const longestEdgeDir = (poly) => {
    let bestLen = 0;
    let bestDir = [1, 0];
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i];
      const b = poly[(i + 1) % poly.length];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const l = Math.hypot(dx, dy);
      if (l > bestLen) {
        bestLen = l;
        bestDir = [dx / l, dy / l];
      }
    }
    return [bestDir, bestLen];
  };
  const splitAlong = (poly, direction, offsetPt) => {
    const [dx, dy] = direction;
    const nx = -dy;
    const ny = dx;
    const side = (p) => (p.x - offsetPt.x) * nx + (p.y - offsetPt.y) * ny;
    const left = [];
    const right = [];
    const n = poly.length;
    for (let i = 0; i < n; i++) {
      const a = poly[i];
      const b = poly[(i + 1) % n];
      const sa = side(a);
      const sb = side(b);
      if (sa >= 0)
        left.push(a);
      else
        right.push(a);
      if (sa > 0 !== sb > 0 && Math.abs(sa - sb) > 1e-9) {
        const t = sa / (sa - sb);
        const ip = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
        left.push(ip);
        right.push(ip);
      }
    }
    return [left, right];
  };
  const recurse = (poly, depth) => {
    const area = Math.abs(signedArea(poly));
    if (area <= targetArea || depth > 10 || poly.length < 3)
      return [poly];
    const [edgeDir] = longestEdgeDir(poly);
    const [dx, dy] = edgeDir;
    const px = -dy;
    const py = dx;
    const projEdge = poly.map((v) => v.x * dx + v.y * dy);
    const projPerp = poly.map((v) => v.x * px + v.y * py);
    const spanEdge = Math.max(...projEdge) - Math.min(...projEdge);
    const spanPerp = Math.max(...projPerp) - Math.min(...projPerp);
    let cutLineDir;
    let axisX;
    let axisY;
    let span;
    let projs;
    if (spanEdge >= spanPerp) {
      cutLineDir = [px, py];
      axisX = dx;
      axisY = dy;
      span = spanEdge;
      projs = projEdge;
    } else {
      cutLineDir = [dx, dy];
      axisX = px;
      axisY = py;
      span = spanPerp;
      projs = projPerp;
    }
    if (span < 1e-6)
      return [poly];
    const pmin = Math.min(...projs);
    const frac = 0.42 + rng() * 0.16;
    const cutProj = pmin + span * frac;
    const base = poly[0];
    const baseProj = base.x * axisX + base.y * axisY;
    const shift = cutProj - baseProj;
    const offsetPt = { x: base.x + axisX * shift, y: base.y + axisY * shift };
    const [left, right] = splitAlong(poly, cutLineDir, offsetPt);
    const out2 = [];
    for (const piece of [left, right]) {
      if (piece.length >= 3 && Math.abs(signedArea(piece)) > 4)
        out2.push(...recurse(piece, depth + 1));
    }
    return out2.length ? out2 : [poly];
  };
  const rawLots = recurse(block, 0);
  const out = [];
  for (const lot of rawLots) {
    const shrunk = shrinkPolygon(lot, 0.5);
    if (shrunk && shrunk.length >= 3 && Math.abs(signedArea(shrunk)) > 3)
      out.push(shrunk);
  }
  return out;
}
export function subdivideFootprint(footprint, targetBlockArea, rng, townSite, coreRadius) {
  const longestEdgeDir = (poly) => {
    let bestLen = 0;
    let best = [1, 0];
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i];
      const b = poly[(i + 1) % poly.length];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const l = Math.hypot(dx, dy);
      if (l > bestLen) {
        bestLen = l;
        best = [dx / l, dy / l];
      }
    }
    return best;
  };
  const split = (poly, direction, offsetPt) => {
    const [dx, dy] = direction;
    const nx = -dy;
    const ny = dx;
    const side = (p) => (p.x - offsetPt.x) * nx + (p.y - offsetPt.y) * ny;
    const left = [];
    const right = [];
    const n = poly.length;
    for (let i = 0; i < n; i++) {
      const a = poly[i];
      const b = poly[(i + 1) % n];
      const sa = side(a);
      const sb = side(b);
      if (sa >= 0)
        left.push(a);
      else
        right.push(a);
      if (sa > 0 !== sb > 0 && Math.abs(sa - sb) > 1e-9) {
        const t = sa / (sa - sb);
        const ip = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
        left.push(ip);
        right.push(ip);
      }
    }
    return [left, right];
  };
  const localTarget = (poly) => {
    const cx = poly.reduce((s, p) => s + p.x, 0) / poly.length;
    const cy = poly.reduce((s, p) => s + p.y, 0) / poly.length;
    const d = Math.hypot(cx - townSite.x, cy - townSite.y) / Math.max(coreRadius, 1);
    const scale = 0.6 + Math.min(1, d) * 0.8;
    return targetBlockArea * scale;
  };
  const recurse = (poly, depth) => {
    const area = Math.abs(signedArea(poly));
    if (depth > 11 || poly.length < 3)
      return [poly];
    if (area <= localTarget(poly))
      return [poly];
    const edgeDir = longestEdgeDir(poly);
    const [dx, dy] = edgeDir;
    const px = -dy;
    const py = dx;
    const projE = poly.map((v) => v.x * dx + v.y * dy);
    const projP = poly.map((v) => v.x * px + v.y * py);
    const spanE = Math.max(...projE) - Math.min(...projE);
    const spanP = Math.max(...projP) - Math.min(...projP);
    let cutDir;
    let axis;
    let span;
    let projs;
    if (spanE >= spanP) {
      cutDir = [px, py];
      axis = [dx, dy];
      span = spanE;
      projs = projE;
    } else {
      cutDir = [dx, dy];
      axis = [px, py];
      span = spanP;
      projs = projP;
    }
    if (span < 1e-6)
      return [poly];
    const pmin = Math.min(...projs);
    const frac = 0.4 + rng() * 0.2;
    const cutProj = pmin + span * frac;
    const jitter = (rng() - 0.5) * 0.25;
    const ca = Math.cos(jitter);
    const sa = Math.sin(jitter);
    const cdx = cutDir[0] * ca - cutDir[1] * sa;
    const cdy = cutDir[0] * sa + cutDir[1] * ca;
    const base = poly[0];
    const baseProj = base.x * axis[0] + base.y * axis[1];
    const shift = cutProj - baseProj;
    const offsetPt = { x: base.x + axis[0] * shift, y: base.y + axis[1] * shift };
    const [aPoly, bPoly] = split(poly, [cdx, cdy], offsetPt);
    const out = [];
    for (const piece of [aPoly, bPoly]) {
      if (piece.length >= 3 && Math.abs(signedArea(piece)) > 8)
        out.push(...recurse(piece, depth + 1));
    }
    return out.length ? out : [poly];
  };
  return recurse(footprint, 0);
}
export function buildBanksideFootprints(scene, townSite, coreRadius, w, h, sandMargin, rng) {
  const water = scene.water;
  if (!water)
    return null;
  const n = water.length;
  let nearestI = 0;
  let nd = Infinity;
  for (let k = 0; k < n; k++) {
    const d2 = (water[k].x - townSite.x) ** 2 + (water[k].y - townSite.y) ** 2;
    if (d2 < nd) {
      nd = d2;
      nearestI = k;
    }
  }
  const npt = water[nearestI];
  const nearDist = Math.hypot(npt.x - townSite.x, npt.y - townSite.y);
  if (nearDist > coreRadius * 1.15)
    return null;
  const targetFrontage = coreRadius * 2.2;
  const half = targetFrontage / 2;
  const walk = (direction) => {
    const idxs = [];
    let acc = 0;
    let k = nearestI;
    let steps = 0;
    while (acc < half && steps < Math.floor(n / 2)) {
      const nk = (k + direction + n) % n;
      const seg = Math.hypot(water[nk].x - water[k].x, water[nk].y - water[k].y);
      if (Math.hypot(water[nk].x - townSite.x, water[nk].y - townSite.y) > coreRadius * 2)
        break;
      acc += seg;
      idxs.push(nk);
      k = nk;
      steps++;
    }
    return idxs;
  };
  const fwd = walk(1);
  const bwd = walk(-1);
  const run = bwd.slice().reverse().concat([nearestI], fwd);
  if (run.length < 8)
    return null;
  const cityDepth = coreRadius * 1.3;
  const bank = run.map((k) => water[k]);
  if (bank.length < 4)
    return null;
  const m = bank.length;
  const stations = [];
  for (let k = 0; k < m; k++) {
    const a = bank[Math.max(0, k - 2)];
    const b = bank[Math.min(m - 1, k + 2)];
    let tx = b.x - a.x;
    let ty = b.y - a.y;
    const tl = Math.hypot(tx, ty) || 1;
    tx /= tl;
    ty /= tl;
    let nx = -ty;
    let ny = tx;
    const probe = { x: bank[k].x + nx * 6, y: bank[k].y + ny * 6 };
    if (pointInPolygon(probe, water)) {
      nx = -nx;
      ny = -ny;
    }
    stations.push([bank[k], [nx, ny]]);
  }
  const waterfront = stations.map(([p, nrm]) => ({ x: p.x + nrm[0] * sandMargin, y: p.y + nrm[1] * sandMargin }));
  const nCtrl = Math.max(5, Math.min(8, Math.floor(m / 5)));
  const ctrlIdx = [];
  for (let j = 0; j < nCtrl; j++)
    ctrlIdx.push(Math.round(j * (m - 1) / (nCtrl - 1)));
  const ctrlDepth = [];
  let prev = 0.9;
  for (let j = 0; j < ctrlIdx.length; j++) {
    const target = 0.45 + rng() * 1.05;
    let varv = 0.5 * prev + 0.5 * target;
    prev = target;
    if (j === 0 || j === nCtrl - 1)
      varv = Math.min(varv, 0.3);
    ctrlDepth.push(cityDepth * varv);
  }
  const inland = [];
  for (let j = 0; j < ctrlIdx.length - 1; j++) {
    const k0 = ctrlIdx[j];
    const k1 = ctrlIdx[j + 1];
    const d0 = ctrlDepth[j];
    const d1 = ctrlDepth[j + 1];
    const seg = Math.max(1, k1 - k0);
    for (let s = 0; s < seg; s++) {
      const ki = k0 + s;
      const t = s / seg;
      const depth = d0 + (d1 - d0) * t;
      const [p, nrm] = stations[ki];
      inland.push({ x: p.x + nrm[0] * (sandMargin + depth), y: p.y + nrm[1] * (sandMargin + depth) });
    }
  }
  const [pLast, nLast] = stations[ctrlIdx[ctrlIdx.length - 1]];
  inland.push({ x: pLast.x + nLast[0] * (sandMargin + ctrlDepth[ctrlDepth.length - 1]), y: pLast.y + nLast[1] * (sandMargin + ctrlDepth[ctrlDepth.length - 1]) });
  let poly = waterfront.concat(inland.slice().reverse());
  poly = poly.map((p) => ({ x: Math.max(6, Math.min(w - 6, p.x)), y: Math.max(6, Math.min(h - 6, p.y)) }));
  const footprints = [];
  if (Math.abs(signedArea(poly)) > coreRadius * coreRadius * 0.3)
    footprints.push(chaikinClosed(poly, 1));
  if (!footprints.length)
    return null;
  const solid = [];
  for (const p of footprints) {
    const xs = p.map((q) => q.x);
    const ys = p.map((q) => q.y);
    const bbox = (Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys));
    if (bbox <= 0)
      continue;
    const fill = Math.abs(signedArea(p)) / bbox;
    if (fill >= 0.42)
      solid.push(p);
  }
  if (!solid.length)
    return null;
  const areas = solid.map((p) => Math.abs(signedArea(p)));
  const biggest = Math.max(...areas);
  const result = solid.filter((_, i) => areas[i] >= biggest * 0.5);
  if (!result.length)
    return null;
  const selfIntersects = (poly2) => {
    const m2 = poly2.length;
    if (m2 < 4)
      return false;
    for (let i = 0; i < m2; i++) {
      const a = poly2[i];
      const b = poly2[(i + 1) % m2];
      for (let j = i + 2; j < m2; j++) {
        if (i === 0 && j === m2 - 1)
          continue;
        const c = poly2[j];
        const d = poly2[(j + 1) % m2];
        if (segmentsIntersect(a.x, a.y, b.x, b.y, c.x, c.y, d.x, d.y))
          return true;
      }
    }
    return false;
  };
  for (const p of result) {
    if (selfIntersects(p))
      return null;
  }
  return result;
}
export function buildCityFootprint(rng, scene, townSite, coreRadius, armLength, w, h) {
  const water = scene.water;
  const beachDist = Math.min(w, h) * 0.02;
  const sandMargin = beachDist + 4;
  if (water) {
    const bankside = buildBanksideFootprints(scene, townSite, coreRadius, w, h, sandMargin, rng);
    if (bankside)
      return bankside;
  }
  const distToPolyEdge = (pt, poly) => {
    let best = Infinity;
    const n = poly.length;
    for (let i = 0; i < n; i++) {
      const a = poly[i];
      const b = poly[(i + 1) % n];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const seg2 = dx * dx + dy * dy;
      let d;
      if (seg2 < 1e-9)
        d = Math.hypot(pt.x - a.x, pt.y - a.y);
      else {
        const t = Math.max(0, Math.min(1, ((pt.x - a.x) * dx + (pt.y - a.y) * dy) / seg2));
        d = Math.hypot(pt.x - (a.x + dx * t), pt.y - (a.y + dy * t));
      }
      if (d < best)
        best = d;
    }
    return best;
  };
  const roads = scene.roads;
  const artAngles = [];
  for (const road of roads) {
    if (road.class === "bridge")
      continue;
    if (road.role !== "primary" && road.role !== "branch")
      continue;
    const pts = road.points;
    let far = pts[0];
    let fd = -1;
    for (const p of pts) {
      const d = Math.hypot(p.x - townSite.x, p.y - townSite.y);
      if (d > fd) {
        fd = d;
        far = p;
      }
    }
    artAngles.push(Math.atan2(far.y - townSite.y, far.x - townSite.x));
  }
  const nPts = 72;
  const baseR = coreRadius * (0.92 + rng() * 0.28);
  const H = [];
  for (const freq of [2, 3, 4, 5, 7]) {
    const amp = (freq <= 3 ? 0.18 : freq <= 5 ? 0.11 : 0.06) * (0.5 + rng());
    H.push([freq, amp, rng() * 2 * Math.PI]);
  }
  const nLobes = 2 + Math.floor(rng() * 3);
  const lobes = [];
  for (let i = 0; i < nLobes; i++) {
    lobes.push([rng() * 2 * Math.PI, 0.18 + rng() * 0.3, 0.2 + rng() * 0.35]);
  }
  const raw = [];
  for (let i = 0; i < nPts; i++) {
    const a = 2 * Math.PI * i / nPts;
    let wobble = 1;
    for (const [freq, amp, ph] of H)
      wobble += amp * Math.sin(a * freq + ph);
    let lobe = 0;
    for (const [la, lh, lw] of lobes) {
      const d = Math.abs(((a - la) % (2 * Math.PI) + 3 * Math.PI) % (2 * Math.PI) - Math.PI);
      lobe += lh * Math.exp(-(d * d) / (2 * lw * lw));
    }
    let bulge = 0;
    for (const aa of artAngles) {
      const d = Math.abs((a - aa + Math.PI) % (2 * Math.PI) - Math.PI);
      bulge = Math.max(bulge, 0.12 * Math.exp(-(d * d) / 0.2));
    }
    const r = baseR * Math.max(0.45, wobble + lobe + bulge);
    raw.push({ x: townSite.x + Math.cos(a) * r, y: townSite.y + Math.sin(a) * r });
  }
  let pieces = [raw];
  let doBankcut = false;
  if (water) {
    let ni = 0;
    let nd = Infinity;
    for (let k = 0; k < water.length; k++) {
      const d2 = (water[k].x - townSite.x) ** 2 + (water[k].y - townSite.y) ** 2;
      if (d2 < nd) {
        nd = d2;
        ni = k;
      }
    }
    const ndist = Math.hypot(water[ni].x - townSite.x, water[ni].y - townSite.y);
    doBankcut = ndist <= coreRadius * 1.15;
    if (doBankcut) {
      const distToWaterEdge = (pt) => {
        let best = Infinity;
        const m = water.length;
        for (let i = 0; i < m; i++) {
          const a = water[i];
          const b = water[(i + 1) % m];
          const ex = b.x - a.x;
          const ey = b.y - a.y;
          const seg2 = ex * ex + ey * ey;
          let qx;
          let qy;
          if (seg2 < 1e-9) {
            qx = a.x;
            qy = a.y;
          } else {
            const t = Math.max(0, Math.min(1, ((pt.x - a.x) * ex + (pt.y - a.y) * ey) / seg2));
            qx = a.x + ex * t;
            qy = a.y + ey * t;
          }
          const dd = Math.hypot(pt.x - qx, pt.y - qy);
          if (dd < best)
            best = dd;
        }
        return best;
      };
      const clearance = sandMargin + 3;
      const bad = (pt) => pointInPolygon(pt, water) || distToWaterEdge(pt) < clearance;
      const adjusted = raw.map((p) => {
        if (!bad(p))
          return p;
        let dx = townSite.x - p.x;
        let dy = townSite.y - p.y;
        const dl = Math.hypot(dx, dy) || 1;
        dx /= dl;
        dy /= dl;
        let cur = { x: p.x, y: p.y };
        const step = 4;
        let guard = 0;
        while (bad(cur) && guard < 200) {
          cur = { x: cur.x + dx * step, y: cur.y + dy * step };
          guard++;
          if ((cur.x - townSite.x) * dx + (cur.y - townSite.y) * dy > 0)
            break;
        }
        return cur;
      });
      pieces = [adjusted];
    }
  }
  const out = [];
  for (const p of pieces) {
    const sm = chaikinClosed(p, 1);
    if (sm.length >= 3)
      out.push(sm);
  }
  return out.length ? out : [raw];
}
export var TARGET_BLOCK_AREA_BY_SIZE = {
  small_city: 2200,
  city: 2e3,
  large_city: 1800,
  metropolis: 1600
};
export var PARK_COUNT_BY_SIZE = {
  small_city: 0,
  city: 1,
  large_city: 2,
  metropolis: 3
};
export function placeHousesCity(rng, scene, w, h, townSite, coreRadius, armLength, targetCount, terrain, size) {
  const pieces = buildCityFootprint(rng, scene, townSite, coreRadius, armLength, w, h);
  if (!pieces.length)
    return [];
  let largest = pieces[0];
  let la = -1;
  for (const p of pieces) {
    const a = Math.abs(signedArea(p));
    if (a > la) {
      la = a;
      largest = p;
    }
  }
  scene.footprint = largest;
  const targetBlockArea = TARGET_BLOCK_AREA_BY_SIZE[size] ?? 2e3;
  const rawBlocks = [];
  for (const piece of pieces) {
    if (piece.length >= 3)
      rawBlocks.push(...subdivideFootprint(piece, targetBlockArea, rng, townSite, coreRadius));
  }
  const blockBlocked = (cx, cy) => {
    if (scene.water && pointInPolygon({ x: cx, y: cy }, scene.water))
      return true;
    if (scene.ridges) {
      for (const ridge of scene.ridges) {
        if (pointInPolygon({ x: cx, y: cy }, ridge))
          return true;
      }
    }
    return false;
  };
  const buildable = [];
  for (const block of rawBlocks) {
    const area = Math.abs(signedArea(block));
    if (area < 200)
      continue;
    let perim = 0;
    for (let i = 0; i < block.length; i++) {
      const a = block[i];
      const b = block[(i + 1) % block.length];
      perim += Math.hypot(b.x - a.x, b.y - a.y);
    }
    if (perim * perim / area > 40)
      continue;
    const cx = block.reduce((s, p) => s + p.x, 0) / block.length;
    const cy = block.reduce((s, p) => s + p.y, 0) / block.length;
    if (blockBlocked(cx, cy))
      continue;
    const dCentre = Math.hypot(cx - townSite.x, cy - townSite.y);
    buildable.push({ block, cx, cy, dCentre, area });
  }
  const parkCount = PARK_COUNT_BY_SIZE[size] ?? 0;
  const parkIds = /* @__PURE__ */ new Set();
  if (parkCount > 0 && buildable.length > parkCount + 3) {
    const scored = [];
    for (let idx = 0; idx < buildable.length; idx++) {
      const b = buildable[idx];
      const t = b.dCentre / coreRadius;
      if (t < 0.15 || t > 0.85)
        continue;
      if (b.area < 400 || b.area > 5e3)
        continue;
      const interiorWeight = 1 - t;
      const score = interiorWeight * (0.5 + rng());
      scored.push([score, idx]);
    }
    scored.sort((a, b) => b[0] !== a[0] ? b[0] - a[0] : b[1] - a[1]);
    const MIN_PARK_SEPARATION = coreRadius * 0.4;
    const chosenCentres = [];
    for (const [, idx] of scored) {
      if (parkIds.size >= parkCount)
        break;
      const b = buildable[idx];
      let tooClose = false;
      for (const [px, py] of chosenCentres) {
        if (Math.hypot(b.cx - px, b.cy - py) < MIN_PARK_SEPARATION) {
          tooClose = true;
          break;
        }
      }
      if (tooClose)
        continue;
      parkIds.add(idx);
      chosenCentres.push([b.cx, b.cy]);
    }
  }
  const houses = [];
  const parks = [];
  const builtBlocks = [];
  for (let idx = 0; idx < buildable.length; idx++) {
    const b = buildable[idx];
    const block = b.block;
    if (parkIds.has(idx)) {
      parks.push(block);
      continue;
    }
    const dCentre = b.dCentre;
    let targetLotArea;
    if (dCentre <= coreRadius * 0.7)
      targetLotArea = 90;
    else if (dCentre <= coreRadius) {
      const t = (dCentre - coreRadius * 0.7) / (coreRadius * 0.3);
      targetLotArea = 90 + t * 70;
    } else
      targetLotArea = 170;
    const blockInner = shrinkPolygon(block, 2.2);
    if (blockInner === null || blockInner.length < 3)
      continue;
    const lots = fillBlockSolid(blockInner, targetLotArea, rng);
    const blockHouses = [];
    for (const poly of lots) {
      const polyCentre = polygonCentroid(poly);
      if (scene.water && pointInPolygon(polyCentre, scene.water))
        continue;
      let inRidge = false;
      if (scene.ridges) {
        for (const ridge of scene.ridges) {
          if (pointInPolygon(polyCentre, ridge)) {
            inRidge = true;
            break;
          }
        }
      }
      if (inRidge)
        continue;
      blockHouses.push({ centre: polyCentre, size: [0, 0], angle: 0, polygon: poly });
    }
    const blockArea = Math.abs(signedArea(block));
    let lotArea = 0;
    for (const bh of blockHouses)
      lotArea += Math.abs(signedArea(bh.polygon));
    if (blockArea > 0 && lotArea / blockArea >= 0.3 && blockHouses.length > 0) {
      for (const bh of blockHouses)
        houses.push(bh);
      builtBlocks.push(block);
    }
  }
  if (builtBlocks.length > 1) {
    const keep = connectedBlocks(builtBlocks, scene.roads);
    if (keep.size && keep.size < builtBlocks.length) {
      const keptBlocks = [];
      const keptHouses = [];
      for (let i = 0; i < builtBlocks.length; i++) {
        if (keep.has(i))
          keptBlocks.push(builtBlocks[i]);
      }
      const keptExpanded = keptBlocks.map((b) => b);
      for (const hh of houses) {
        const c = hh.centre;
        let inside = false;
        for (const kb of keptExpanded) {
          if (pointInPolygon(c, kb)) {
            inside = true;
            break;
          }
        }
        if (inside)
          keptHouses.push(hh);
      }
      if (keptHouses.length >= houses.length * 0.5) {
        houses.length = 0;
        houses.push(...keptHouses);
        builtBlocks.length = 0;
        builtBlocks.push(...keptBlocks);
      }
    }
  }
  scene.parks = parks;
  scene.street_base = builtBlocks;
  return houses;
}
export function connectedBlocks(blocks, roads) {
  const n = blocks.length;
  const seeds = /* @__PURE__ */ new Set();
  const ROAD_NEAR = 14;
  const ADJ = 10;
  const bbox = blocks.map((b) => {
    let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
    for (const p of b) {
      if (p.x < minx)
        minx = p.x;
      if (p.y < miny)
        miny = p.y;
      if (p.x > maxx)
        maxx = p.x;
      if (p.y > maxy)
        maxy = p.y;
    }
    return { minx, miny, maxx, maxy };
  });
  const roadPts = [];
  for (const r of roads) {
    for (const p of r.points)
      roadPts.push(p);
  }
  for (let i = 0; i < n; i++) {
    const bb = bbox[i];
    for (const rp of roadPts) {
      const cx = Math.max(bb.minx, Math.min(rp.x, bb.maxx));
      const cy = Math.max(bb.miny, Math.min(rp.y, bb.maxy));
      if (Math.hypot(rp.x - cx, rp.y - cy) <= ROAD_NEAR) {
        seeds.add(i);
        break;
      }
    }
  }
  const adj = Array.from({ length: n }, () => []);
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const a = bbox[i];
      const b = bbox[j];
      const overlapX = a.minx - ADJ <= b.maxx && b.minx - ADJ <= a.maxx;
      const overlapY = a.miny - ADJ <= b.maxy && b.miny - ADJ <= a.maxy;
      if (overlapX && overlapY) {
        adj[i].push(j);
        adj[j].push(i);
      }
    }
  }
  const reached = /* @__PURE__ */ new Set();
  const stack = [...seeds];
  for (const s of stack)
    reached.add(s);
  while (stack.length) {
    const cur = stack.pop();
    for (const nb of adj[cur]) {
      if (!reached.has(nb)) {
        reached.add(nb);
        stack.push(nb);
      }
    }
  }
  return seeds.size ? reached : /* @__PURE__ */ new Set();
}
export function minDistToPoly(pt, poly) {
  let best = Infinity;
  const n = poly.length;
  for (let i = 0; i < n; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % n];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const seg2 = dx * dx + dy * dy;
    let d;
    if (seg2 < 1e-9)
      d = Math.hypot(pt.x - a.x, pt.y - a.y);
    else {
      const t = Math.max(0, Math.min(1, ((pt.x - a.x) * dx + (pt.y - a.y) * dy) / seg2));
      d = Math.hypot(pt.x - (a.x + dx * t), pt.y - (a.y + dy * t));
    }
    if (d < best)
      best = d;
  }
  return best;
}
export function rayToPolyEdge(origin, angle, poly) {
  const ox = origin.x;
  const oy = origin.y;
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  let best = null;
  const n = poly.length;
  for (let i = 0; i < n; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % n];
    const ex = b.x - a.x;
    const ey = b.y - a.y;
    const den = dx * -ey - dy * -ex;
    if (Math.abs(den) < 1e-9)
      continue;
    const t = ((a.x - ox) * -ey - (a.y - oy) * -ex) / den;
    const u = (dx * (a.y - oy) - dy * (a.x - ox)) / den;
    if (t > 0 && u >= 0 && u <= 1) {
      if (best === null || t < best)
        best = t;
    }
  }
  return best;
}
export function removeHousesIn(scene, clearPoly) {
  const houses = scene.houses;
  if (!houses || !houses.length || !clearPoly || clearPoly.length < 3)
    return;
  const kept = [];
  for (const hh of houses) {
    let c = hh.centre;
    if (!c && hh.polygon) {
      const poly = hh.polygon;
      c = { x: poly.reduce((s, p) => s + p.x, 0) / poly.length, y: poly.reduce((s, p) => s + p.y, 0) / poly.length };
    }
    if (c && pointInPolygon(c, clearPoly))
      continue;
    kept.push(hh);
  }
  scene.houses = kept;
}
export function buildCastle(rng, scene, townSite, coreRadius, w, h, forced = false) {
  const footprint = scene.footprint;
  const waterPoly = scene.water;
  if (!footprint || footprint.length < 3)
    return null;
  const cr = coreRadius;
  let baileyR = Math.max(26, cr * 0.3);
  const fcx = footprint.reduce((s, p) => s + p.x, 0) / footprint.length;
  const fcy = footprint.reduce((s, p) => s + p.y, 0) / footprint.length;
  const insideFootprint = (pt, shrink) => {
    if (!pointInPolygon(pt, footprint))
      return false;
    if (minDistToPoly(pt, footprint) < shrink)
      return false;
    if (scene.forests) {
      for (const f of scene.forests) {
        if (pointInPolygon(pt, f.polygon))
          return false;
      }
    }
    if (scene.ridges) {
      for (const r of scene.ridges) {
        if (pointInPolygon(pt, r))
          return false;
      }
    }
    if (waterPoly) {
      if (pointInPolygon(pt, waterPoly))
        return false;
      for (let a = 0; a < 8; a++) {
        const ang = a / 8 * 2 * Math.PI;
        const rp = { x: pt.x + Math.cos(ang) * baileyR, y: pt.y + Math.sin(ang) * baileyR };
        if (pointInPolygon(rp, waterPoly))
          return false;
      }
    }
    return true;
  };
  const placeCentral = rng() < 0.5;
  let best = null;
  if (placeCentral) {
    for (let i = 0; i < 30; i++) {
      const jx = fcx + (rng() - 0.5) * coreRadius * 0.4;
      const jy = fcy + (rng() - 0.5) * coreRadius * 0.4;
      if (insideFootprint({ x: jx, y: jy }, baileyR + 6)) {
        best = { x: jx, y: jy };
        break;
      }
    }
    if (best === null && insideFootprint({ x: fcx, y: fcy }, baileyR + 6))
      best = { x: fcx, y: fcy };
  } else {
    let biasAng = null;
    if (waterPoly) {
      let ni = 0;
      let nd2 = Infinity;
      for (let k = 0; k < waterPoly.length; k++) {
        const d2 = (waterPoly[k].x - townSite.x) ** 2 + (waterPoly[k].y - townSite.y) ** 2;
        if (d2 < nd2) {
          nd2 = d2;
          ni = k;
        }
      }
      const npt = waterPoly[ni];
      const nd = Math.hypot(npt.x - townSite.x, npt.y - townSite.y);
      if (nd < cr * 2)
        biasAng = Math.atan2(npt.y - fcy, npt.x - fcx);
    }
    if (biasAng === null)
      biasAng = rng() * 2 * Math.PI;
    for (let i = 0; i < 40; i++) {
      const ang = biasAng + (rng() - 0.5) * 1.4;
      const frac = 0.5 + rng() * 0.3;
      const edgeD = rayToPolyEdge({ x: fcx, y: fcy }, ang, footprint);
      if (edgeD === null)
        continue;
      const dist = edgeD * frac;
      const cx = fcx + Math.cos(ang) * dist;
      const cy = fcy + Math.sin(ang) * dist;
      if (insideFootprint({ x: cx, y: cy }, baileyR + 6)) {
        best = { x: cx, y: cy };
        break;
      }
    }
  }
  if (best === null) {
    if (insideFootprint({ x: fcx, y: fcy }, baileyR + 6)) {
      best = { x: fcx, y: fcy };
    } else if (forced) {
      const tryFind = (clearShrink) => {
        for (let i = 0; i < 200; i++) {
          const ang = rng() * 2 * Math.PI;
          const edgeD = rayToPolyEdge({ x: fcx, y: fcy }, ang, footprint);
          if (edgeD === null)
            continue;
          const dist = edgeD * (rng() * 0.85);
          const cx = fcx + Math.cos(ang) * dist;
          const cy = fcy + Math.sin(ang) * dist;
          if (insideFootprint({ x: cx, y: cy }, clearShrink))
            return { x: cx, y: cy };
        }
        return null;
      };
      best = tryFind(baileyR + 6) ?? tryFind(baileyR) ?? tryFind(baileyR * 0.7);
      if (best === null) {
        for (let s = 0; s < 4 && best === null; s++) {
          baileyR *= 0.85;
          best = tryFind(baileyR * 0.6);
        }
        if (best === null && pointInPolygon({ x: fcx, y: fcy }, footprint))
          best = { x: fcx, y: fcy };
        if (best === null) {
          const houses = scene.houses || [];
          for (const hh of houses) {
            if (waterPoly && pointInPolygon(hh.centre, waterPoly))
              continue;
            let onRidge = false;
            if (scene.ridges) {
              for (const r of scene.ridges)
                if (pointInPolygon(hh.centre, r)) {
                  onRidge = true;
                  break;
                }
            }
            if (onRidge)
              continue;
            best = { x: hh.centre.x, y: hh.centre.y };
            break;
          }
        }
        if (best === null)
          return null;
      }
    } else {
      return null;
    }
  }
  const ccx = best.x;
  const ccy = best.y;
  const nSides = 4 + Math.floor(rng() * 2);
  const rot = rng() * 2 * Math.PI;
  const bailey = [];
  for (let i = 0; i < nSides; i++) {
    const a = rot + 2 * Math.PI * i / nSides;
    const rr = baileyR * (0.82 + rng() * 0.36);
    bailey.push({ x: ccx + Math.cos(a) * rr, y: ccy + Math.sin(a) * rr });
  }
  const towers = bailey.slice();
  let bestRoadPt = null;
  let bestRoadD = null;
  const roads = scene.roads;
  for (const road of roads) {
    if (road.class === "bridge")
      continue;
    for (const p of road.points) {
      const d = (p.x - ccx) ** 2 + (p.y - ccy) ** 2;
      if (bestRoadD === null || d < bestRoadD) {
        bestRoadD = d;
        bestRoadPt = p;
      }
    }
  }
  let gateAng;
  if (bestRoadPt !== null)
    gateAng = Math.atan2(bestRoadPt.y - ccy, bestRoadPt.x - ccx);
  else
    gateAng = Math.atan2(fcy - ccy, fcx - ccx);
  let gateD = baileyR * 0.95;
  {
    const dx = Math.cos(gateAng), dy = Math.sin(gateAng);
    let best2 = null;
    for (let i = 0, j = bailey.length - 1; i < bailey.length; j = i++) {
      const ax = bailey[j].x - ccx, ay = bailey[j].y - ccy;
      const bx = bailey[i].x - ccx, by = bailey[i].y - ccy;
      const den = (ax - bx) * dy - (ay - by) * dx;
      if (Math.abs(den) < 1e-9)
        continue;
      const t = (ax * dy - ay * dx) / den;
      if (t < 0 || t > 1)
        continue;
      const px = ax + t * (bx - ax), py = ay + t * (by - ay);
      if (px * dx + py * dy <= 0)
        continue;
      const d = Math.hypot(px, py);
      if (best2 === null || d < best2)
        best2 = d;
    }
    if (best2 !== null)
      gateD = best2;
  }
  const gate = { x: ccx + Math.cos(gateAng) * gateD, y: ccy + Math.sin(gateAng) * gateD };
  const backAng = gateAng + Math.PI;
  const keepCx = ccx + Math.cos(backAng) * baileyR * 0.32;
  const keepCy = ccy + Math.sin(backAng) * baileyR * 0.32;
  const keepR = baileyR * 0.32;
  const keep = [];
  const krot = rng() * 2 * Math.PI;
  for (let i = 0; i < 4; i++) {
    const a = krot + Math.PI / 2 * i;
    keep.push({ x: keepCx + Math.cos(a) * keepR, y: keepCy + Math.sin(a) * keepR });
  }
  let approach = null;
  if (bestRoadPt !== null) {
    if (Math.hypot(bestRoadPt.x - gate.x, bestRoadPt.y - gate.y) < baileyR * 2.5) {
      approach = [gate, { x: bestRoadPt.x, y: bestRoadPt.y }];
    }
  }
  const clearPoly = [];
  for (const p of bailey) {
    const dx = p.x - ccx;
    const dy = p.y - ccy;
    const d = Math.hypot(dx, dy) || 1;
    clearPoly.push({ x: p.x + dx / d * 8, y: p.y + dy / d * 8 });
  }
  return { type: "castle", bailey, towers, keep, gate, gateAngle: gateAng, approach, clearPoly, centre: { x: ccx, y: ccy } };
}
export function findInteriorSite(rng, scene, townSite, coreRadius, clearR, avoid, tLo = 0.12, tHi = 0.62, forced = false) {
  const footprint = scene.footprint;
  if (!footprint || footprint.length < 3)
    return null;
  const fcx = footprint.reduce((s, p) => s + p.x, 0) / footprint.length;
  const fcy = footprint.reduce((s, p) => s + p.y, 0) / footprint.length;
  const inWater = (pt) => {
    if (!scene.water)
      return false;
    if (pointInPolygonNonzero(pt, scene.water))
      return true;
    for (let a = 0; a < 8; a++) {
      const ang = a / 8 * 2 * Math.PI;
      if (pointInPolygonNonzero({ x: pt.x + Math.cos(ang) * clearR, y: pt.y + Math.sin(ang) * clearR }, scene.water))
        return true;
    }
    return false;
  };
  const ok = (pt, relax) => {
    if (!pointInPolygon(pt, footprint))
      return false;
    if (minDistToPoly(pt, footprint) < clearR * (1 - relax * 0.85))
      return false;
    for (const [ax, ay, ar] of avoid) {
      if (Math.hypot(pt.x - ax, pt.y - ay) < (ar + clearR) * (1 - relax * 0.6))
        return false;
    }
    if (inWater(pt))
      return false;
    if (scene.ridges) {
      for (const ridge of scene.ridges) {
        if (pointInPolygon(pt, ridge))
          return false;
      }
    }
    if (scene.forests) {
      for (const f of scene.forests) {
        if (pointInPolygon(pt, f.polygon))
          return false;
      }
    }
    return true;
  };
  for (let i = 0; i < 60; i++) {
    const ang = rng() * 2 * Math.PI;
    const frac = tLo + rng() * (tHi - tLo);
    const px = fcx + Math.cos(ang) * coreRadius * frac;
    const py = fcy + Math.sin(ang) * coreRadius * frac;
    if (ok({ x: px, y: py }, 0))
      return { x: px, y: py };
  }
  if (ok({ x: fcx, y: fcy }, 0))
    return { x: fcx, y: fcy };
  if (!forced)
    return null;
  for (let step = 1; step <= 5; step++) {
    const relax = step / 5;
    for (let i = 0; i < 80; i++) {
      const ang = rng() * 2 * Math.PI;
      const frac = tLo * (1 - relax) + rng() * (Math.min(0.92, tHi + relax * 0.3) - tLo * (1 - relax));
      const px = fcx + Math.cos(ang) * coreRadius * frac;
      const py = fcy + Math.sin(ang) * coreRadius * frac;
      if (ok({ x: px, y: py }, relax))
        return { x: px, y: py };
    }
  }
  const hardOk = (pt) => {
    if (!pointInPolygon(pt, footprint))
      return false;
    if (inWater(pt))
      return false;
    if (scene.ridges) {
      for (const r of scene.ridges)
        if (pointInPolygon(pt, r))
          return false;
    }
    if (scene.forests) {
      for (const f of scene.forests)
        if (pointInPolygon(pt, f.polygon))
          return false;
    }
    return true;
  };
  if (hardOk({ x: fcx, y: fcy }))
    return { x: fcx, y: fcy };
  for (const v of footprint) {
    const p = { x: (v.x + fcx) / 2, y: (v.y + fcy) / 2 };
    if (hardOk(p))
      return p;
  }
  const houses = scene.houses || [];
  for (const hh of houses) {
    if (hardOk(hh.centre))
      return { x: hh.centre.x, y: hh.centre.y };
  }
  return null;
}
export function buildCathedral(rng, scene, townSite, coreRadius, w, h, avoid, forced = false) {
  const cr = coreRadius;
  const naveLen = Math.max(24, cr * 0.28);
  const naveW = Math.max(7, cr * 0.08);
  const tranLen = Math.max(14, cr * 0.18);
  const tranW = Math.max(6, cr * 0.075);
  const clearR = naveLen * 0.55;
  const site = findInteriorSite(rng, scene, townSite, coreRadius, clearR, avoid, 0.1, 0.55, forced);
  if (site === null)
    return null;
  const ccx = site.x;
  const ccy = site.y;
  let angle = rng() * 2 * Math.PI;
  let bestD = null;
  const roads = scene.roads;
  for (const road of roads) {
    if (road.class === "bridge")
      continue;
    const pts = road.points;
    for (let i = 0; i < pts.length - 1; i++) {
      const mx = (pts[i].x + pts[i + 1].x) / 2;
      const my = (pts[i].y + pts[i + 1].y) / 2;
      const d = (mx - ccx) ** 2 + (my - ccy) ** 2;
      if (bestD === null || d < bestD) {
        bestD = d;
        angle = Math.atan2(pts[i + 1].y - pts[i].y, pts[i + 1].x - pts[i].x);
      }
    }
  }
  const ca = Math.cos(angle);
  const sa = Math.sin(angle);
  const rot = (dx, dy) => ({ x: ccx + dx * ca - dy * sa, y: ccy + dx * sa + dy * ca });
  const hl = naveLen / 2;
  const hw = naveW / 2;
  const htl = tranLen / 2;
  const htw = tranW / 2;
  const tcx = hl * 0.15;
  const nave = [rot(-hl, -hw), rot(hl, -hw), rot(hl, hw), rot(-hl, hw)];
  const transept = [rot(tcx - htw, -htl), rot(tcx + htw, -htl), rot(tcx + htw, htl), rot(tcx - htw, htl)];
  const apse = { pos: rot(-hl, 0), r: naveW * 0.6 };
  const outline = nave;
  const clearPoly = [];
  for (const p of nave.concat(transept)) {
    const dx = p.x - ccx;
    const dy = p.y - ccy;
    const d = Math.hypot(dx, dy) || 1;
    clearPoly.push({ x: p.x + dx / d * 7, y: p.y + dy / d * 7 });
  }
  return { type: "cathedral", nave, transept, apse, angle, outline, clearPoly, centre: { x: ccx, y: ccy } };
}
export function buildMarket(rng, scene, townSite, coreRadius, w, h, avoid, forced = false) {
  const cr = coreRadius;
  const plazaR = Math.max(9, cr * 0.1);
  const clearR = plazaR * 1.2;
  const site = findInteriorSite(rng, scene, townSite, coreRadius, clearR, avoid, 0.08, 0.5, forced);
  if (site === null)
    return null;
  const ccx = site.x;
  const ccy = site.y;
  const nSides = 4 + Math.floor(rng() * 2);
  const rot0 = rng() * 2 * Math.PI;
  const plaza = [];
  for (let i = 0; i < nSides; i++) {
    const a = rot0 + 2 * Math.PI * i / nSides;
    const rr = plazaR * (0.85 + rng() * 0.3);
    plaza.push({ x: ccx + Math.cos(a) * rr, y: ccy + Math.sin(a) * rr });
  }
  const stalls = [];
  const n = plaza.length;
  for (let i = 0; i < n; i++) {
    const a = plaza[i];
    const b = plaza[(i + 1) % n];
    for (const t of [0.3, 0.7]) {
      const mx = a.x + (b.x - a.x) * t;
      const my = a.y + (b.y - a.y) * t;
      let ix = ccx - mx;
      let iy = ccy - my;
      const d = Math.hypot(ix, iy) || 1;
      ix /= d;
      iy /= d;
      const sx = mx + ix * 6;
      const sy = my + iy * 6;
      let ex = b.x - a.x;
      let ey = b.y - a.y;
      const el = Math.hypot(ex, ey) || 1;
      ex /= el;
      ey /= el;
      const sl = 3;
      const sw = 2.2;
      stalls.push([
        { x: sx - ex * sl - ix * sw, y: sy - ey * sl - iy * sw },
        { x: sx + ex * sl - ix * sw, y: sy + ey * sl - iy * sw },
        { x: sx + ex * sl + ix * sw, y: sy + ey * sl + iy * sw },
        { x: sx - ex * sl + ix * sw, y: sy - ey * sl + iy * sw }
      ]);
    }
  }
  const feature = { pos: { x: ccx, y: ccy }, r: Math.max(2.5, plazaR * 0.12) };
  const clearPoly = [];
  for (const p of plaza) {
    const dx = p.x - ccx;
    const dy = p.y - ccy;
    const d = Math.hypot(dx, dy) || 1;
    clearPoly.push({ x: p.x + dx / d * 5, y: p.y + dy / d * 5 });
  }
  return { type: "market", plaza, stalls, feature, clearPoly, centre: { x: ccx, y: ccy } };
}
export function buildBarracks(rng, scene, townSite, coreRadius, w, h, avoid, forced = false) {
  const cr = coreRadius;
  const yardLen = Math.max(16, cr * 0.18);
  const yardW = Math.max(11, cr * 0.132);
  const clearR = Math.max(yardLen, yardW) * 0.6;
  const site = findInteriorSite(rng, scene, townSite, coreRadius, clearR, avoid, 0.2, 0.7, forced);
  if (site === null)
    return null;
  const ccx = site.x;
  const ccy = site.y;
  let angle = rng() * 2 * Math.PI;
  let bestD = null;
  const roads = scene.roads;
  for (const road of roads) {
    if (road.class === "bridge")
      continue;
    const pts = road.points;
    for (let i = 0; i < pts.length - 1; i++) {
      const mx = (pts[i].x + pts[i + 1].x) / 2;
      const my = (pts[i].y + pts[i + 1].y) / 2;
      const d = (mx - ccx) ** 2 + (my - ccy) ** 2;
      if (bestD === null || d < bestD) {
        bestD = d;
        angle = Math.atan2(pts[i + 1].y - pts[i].y, pts[i + 1].x - pts[i].x);
      }
    }
  }
  const ca = Math.cos(angle);
  const sa = Math.sin(angle);
  const rot = (dx, dy) => ({ x: ccx + dx * ca - dy * sa, y: ccy + dx * sa + dy * ca });
  const hl = yardLen / 2;
  const hw = yardW / 2;
  const yard = [rot(-hl, -hw), rot(hl, -hw), rot(hl, hw), rot(-hl, hw)];
  const halls = [];
  const hallHl = hl * 0.78;
  const hallHw = yardW * 0.16;
  for (const off of [-yardW * 0.26, yardW * 0.26]) {
    halls.push([
      rot(-hallHl, off - hallHw),
      rot(hallHl, off - hallHw),
      rot(hallHl, off + hallHw),
      rot(-hallHl, off + hallHw)
    ]);
  }
  const drill = { pos: rot(0, 0), r: Math.max(2, yardW * 0.1) };
  const clearPoly = [];
  for (const p of yard) {
    const dx = p.x - ccx;
    const dy = p.y - ccy;
    const d = Math.hypot(dx, dy) || 1;
    clearPoly.push({ x: p.x + dx / d * 6, y: p.y + dy / d * 6 });
  }
  return { type: "barracks", yard, halls, drill, angle, clearPoly, centre: { x: ccx, y: ccy } };
}
export function buildTower(rng, scene, townSite, coreRadius, w, h, forced, cropSize) {
  const footprint = scene.footprint;
  if (!footprint || footprint.length < 3)
    return null;
  const margin = Math.min(w, h) * 0.012 + 6;
  const radius = Math.max(7, coreRadius * 0.045);
  const frameLo = 12, frameHiX = w - 12, frameHiY = h - 12;
  let cityCx = townSite.x, cityCy = townSite.y;
  {
    const hs = scene.houses;
    if (hs && hs.length) {
      let sx = 0, sy = 0, n = 0;
      for (const hh of hs) {
        let c = hh.centre;
        if (!c && hh.polygon)
          c = { x: hh.polygon.reduce((s, p) => s + p.x, 0) / hh.polygon.length, y: hh.polygon.reduce((s, p) => s + p.y, 0) / hh.polygon.length };
        if (c) {
          sx += c.x;
          sy += c.y;
          n++;
        }
      }
      if (n) {
        cityCx = sx / n;
        cityCy = sy / n;
      }
    }
  }
  const cropOK = (p) => {
    if (!cropSize)
      return true;
    const fx = cropSize / 2 + (p.x - cityCx);
    const fy = cropSize / 2 + (p.y - cityCy);
    const m = 16 + radius;
    return fx >= m && fx <= cropSize - m && fy >= m && fy <= cropSize - m;
  };
  const roads = scene.roads || [];
  const isValid = (p) => {
    if (p.x < frameLo || p.x > frameHiX || p.y < frameLo || p.y > frameHiY)
      return false;
    if (!cropOK(p))
      return false;
    if (scene.water && pointInPolygonNonzero(p, scene.water))
      return false;
    if (pointInPolygon(p, footprint))
      return false;
    let nearFoot = Infinity;
    for (const fp of footprint) {
      const d = Math.hypot(fp.x - p.x, fp.y - p.y);
      if (d < nearFoot)
        nearFoot = d;
    }
    if (nearFoot < coreRadius * 0.5)
      return false;
    if (scene.forests) {
      for (const f of scene.forests)
        if (pointInPolygon(p, f.polygon))
          return false;
    }
    if (scene.water) {
      for (let a = 0; a < 8; a++) {
        const q = { x: p.x + Math.cos(a / 8 * Math.PI * 2) * (radius + margin), y: p.y + Math.sin(a / 8 * Math.PI * 2) * (radius + margin) };
        if (pointInPolygonNonzero(q, scene.water))
          return false;
      }
    }
    for (const road of roads) {
      for (const rp of road.points) {
        if (Math.hypot(rp.x - p.x, rp.y - p.y) < radius + 10)
          return false;
      }
    }
    return true;
  };
  const edgeDist = (p) => {
    let best2 = Infinity;
    if (scene.forests)
      for (const f of scene.forests)
        for (const v of f.polygon) {
          const d = Math.hypot(v.x - p.x, v.y - p.y);
          if (d < best2)
            best2 = d;
        }
    if (scene.mountains)
      for (const m of scene.mountains)
        for (const sp of m.spines)
          for (const pt of sp) {
            const d = Math.max(0, Math.hypot(pt.x - p.x, pt.y - p.y) - pt.w);
            if (d < best2)
              best2 = d;
          }
    return best2;
  };
  const candidateRoadPts = [];
  for (const road of roads) {
    if (road.class === "bridge")
      continue;
    for (const rp of road.points)
      candidateRoadPts.push(rp);
  }
  const buildLane = (from) => {
    const sorted = candidateRoadPts.map((rp) => ({ rp, d: Math.hypot(rp.x - from.x, rp.y - from.y) })).sort((a, b) => a.d - b.d).slice(0, 12);
    for (const { rp, d } of sorted) {
      if (d > coreRadius * 3.2)
        break;
      const steps = Math.max(2, Math.round(d / 24));
      const pts = [];
      let overWater = false;
      const perpA = Math.atan2(rp.y - from.y, rp.x - from.x) + Math.PI / 2;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const wob = Math.sin(t * Math.PI) * (d / 200) * 6;
        const px = from.x + (rp.x - from.x) * t + Math.cos(perpA) * wob;
        const py = from.y + (rp.y - from.y) * t + Math.sin(perpA) * wob;
        if (scene.water && pointInPolygonNonzero({ x: px, y: py }, scene.water)) {
          overWater = true;
          break;
        }
        pts.push({ x: px, y: py });
      }
      if (!overWater && pts.length >= 2)
        return pts;
    }
    return null;
  };
  let best = null;
  let bestLane = null;
  let bestScore = -Infinity;
  const ringMin = coreRadius * 0.9, ringMax = coreRadius * 2.2;
  for (let i = 0; i < 480; i++) {
    const ang = rng() * Math.PI * 2;
    const r = ringMin + rng() * (ringMax - ringMin);
    const p = { x: cityCx + Math.cos(ang) * r, y: cityCy + Math.sin(ang) * r };
    if (!isValid(p))
      continue;
    const lane = buildLane(p);
    if (!lane)
      continue;
    const ed = edgeDist(p);
    let edgeScore;
    if (ed === Infinity)
      edgeScore = 0;
    else if (ed < 6)
      edgeScore = 0.4;
    else if (ed <= 40)
      edgeScore = 1 - (ed - 6) / 80;
    else
      edgeScore = Math.max(0, 0.5 - (ed - 40) / 300);
    const distPenalty = Math.max(0, (r - coreRadius * 1.6) / (coreRadius * 2));
    const score = edgeScore - distPenalty * 0.3 + rng() * 0.05;
    if (score > bestScore) {
      bestScore = score;
      best = p;
      bestLane = lane;
    }
  }
  if (!best)
    return null;
  const basePoly = [];
  const nSeg = 16;
  for (let i = 0; i < nSeg; i++) {
    const a = i / nSeg * Math.PI * 2;
    basePoly.push({ x: best.x + Math.cos(a) * radius, y: best.y + Math.sin(a) * radius });
  }
  const clearPoly = [];
  for (let i = 0; i < nSeg; i++) {
    const a = i / nSeg * Math.PI * 2;
    clearPoly.push({ x: best.x + Math.cos(a) * (radius + 14), y: best.y + Math.sin(a) * (radius + 14) });
  }
  return { type: "tower", centre: best, radius, basePoly, lane: bestLane, clearPoly };
}
export function placeLandmarks(rng, scene, townSite, coreRadius, size, terrain, w, h, overrides, cropSize) {
  const footprint = scene.footprint;
  if (!footprint || footprint.length < 3)
    return;
  const landmarks = scene.landmarks || [];
  const avoid = [];
  const castleChance = { small_city: 0.4, city: 0.6, large_city: 0.8, metropolis: 1 };
  const castleRoll = rng() < (castleChance[size] ?? 0.5);
  if (overrides?.castle ?? castleRoll) {
    const castle = buildCastle(rng, scene, townSite, coreRadius, w, h, overrides?.castle === true);
    if (castle) {
      landmarks.push(castle);
      removeHousesIn(scene, castle.clearPoly);
      avoid.push([castle.centre.x, castle.centre.y, coreRadius * 0.35]);
    }
  }
  const cathChance = { small_city: 0.3, city: 0.55, large_city: 0.75, metropolis: 0.9 };
  const cathRoll = rng() < (cathChance[size] ?? 0.4);
  if (overrides?.cathedral ?? cathRoll) {
    const cath = buildCathedral(rng, scene, townSite, coreRadius, w, h, avoid, overrides?.cathedral === true);
    if (cath) {
      landmarks.push(cath);
      removeHousesIn(scene, cath.clearPoly);
      avoid.push([cath.centre.x, cath.centre.y, coreRadius * 0.25]);
    }
  }
  const barracksChance = { small_city: 0.3, city: 0.45, large_city: 0.6, metropolis: 0.75 };
  const barracksRoll = rng() < (barracksChance[size] ?? 0.4);
  if (overrides?.barracks ?? barracksRoll) {
    const barracks = buildBarracks(rng, scene, townSite, coreRadius, w, h, avoid, overrides?.barracks === true);
    if (barracks) {
      landmarks.push(barracks);
      removeHousesIn(scene, barracks.clearPoly);
      avoid.push([barracks.centre.x, barracks.centre.y, coreRadius * 0.28]);
    }
  }
  const marketSlots = { small_city: 1, city: 1, large_city: 2, metropolis: 3 };
  const marketChance = { small_city: 0.6, city: 0.75, large_city: 0.7, metropolis: 0.7 };
  const slots = marketSlots[size] ?? 1;
  const mChance = marketChance[size] ?? 0.6;
  for (let i = 0; i < slots; i++) {
    const mRoll = rng() < mChance;
    const want = i === 0 ? overrides?.market ?? mRoll : overrides?.market === false ? false : mRoll;
    if (!want)
      continue;
    const market = buildMarket(rng, scene, townSite, coreRadius, w, h, avoid, i === 0 && overrides?.market === true);
    if (market) {
      landmarks.push(market);
      removeHousesIn(scene, market.clearPoly);
      avoid.push([market.centre.x, market.centre.y, coreRadius * 0.2]);
    }
  }
  const towerRoll = rng() < 0.45;
  if (overrides?.tower ?? towerRoll) {
    const tower = buildTower(rng, scene, townSite, coreRadius, w, h, overrides?.tower === true, cropSize);
    if (tower) {
      landmarks.push(tower);
      removeHousesIn(scene, tower.clearPoly);
    }
  }
  scene.landmarks = landmarks;
}
export function resampleClosed(poly, step = 14) {
  if (poly.length < 3)
    return poly;
  const out = [];
  let carry = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const seg = Math.hypot(b.x - a.x, b.y - a.y);
    if (seg < 1e-9)
      continue;
    let d = carry;
    while (d < seg) {
      const t = d / seg;
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
      d += step;
    }
    carry = d - seg;
  }
  return out;
}
export function buildCityWalls(rng, scene, townSite, coreRadius, size, w, h) {
  const footprint = scene.footprint;
  if (!footprint || footprint.length < 3)
    return null;
  const blocks = scene.street_base || [footprint];
  const allpts = [];
  for (const blk of blocks)
    for (const p of blk)
      allpts.push(p);
  if (allpts.length < 3)
    return null;
  let minx = Math.min(...allpts.map((p) => p.x));
  let maxx = Math.max(...allpts.map((p) => p.x));
  let miny = Math.min(...allpts.map((p) => p.y));
  let maxy = Math.max(...allpts.map((p) => p.y));
  const pad = 18;
  minx -= pad;
  miny -= pad;
  maxx += pad;
  maxy += pad;
  const cell = 6;
  const gw = Math.max(8, Math.floor((maxx - minx) / cell) + 2);
  const gh = Math.max(8, Math.floor((maxy - miny) / cell) + 2);
  const grid = new Uint8Array(gw * gh);
  const at = (x, y) => y * gw + x;
  const toGrid = (p) => [Math.floor((p.x - minx) / cell), Math.floor((p.y - miny) / cell)];
  for (const blk of blocks) {
    const gpts = blk.map(toGrid);
    const ys = gpts.map((g) => g[1]);
    const ylo = Math.max(0, Math.min(...ys));
    const yhi = Math.min(gh, Math.max(...ys) + 1);
    for (let yy = ylo; yy < yhi; yy++) {
      const xsCross = [];
      const m = gpts.length;
      for (let i = 0; i < m; i++) {
        const [ax, ay] = gpts[i];
        const [bx, by] = gpts[(i + 1) % m];
        if (ay > yy !== by > yy) {
          const t = by - ay !== 0 ? (yy - ay) / (by - ay) : 0;
          xsCross.push(ax + t * (bx - ax));
        }
      }
      xsCross.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xsCross.length; k += 2) {
        const x0 = Math.floor(xsCross[k]);
        const x1 = Math.ceil(xsCross[k + 1]);
        for (let x = Math.max(0, x0); x < Math.min(gw, x1 + 1); x++)
          grid[at(x, yy)] = 1;
      }
    }
  }
  const g2 = new Uint8Array(grid);
  for (let y = 0; y < gh; y++) {
    for (let x = 0; x < gw; x++) {
      if (grid[at(x, y)])
        continue;
      let any = false;
      for (let dy = -1; dy <= 1 && !any; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && nx < gw && ny >= 0 && ny < gh && grid[at(nx, ny)]) {
            any = true;
            break;
          }
        }
      }
      if (any)
        g2[at(x, y)] = 1;
    }
  }
  const occGrid = g2;
  const isOcc = (x, y) => x >= 0 && x < gw && y >= 0 && y < gh && occGrid[at(x, y)] > 0;
  const compId = new Int32Array(gw * gh).fill(-1);
  const components = [];
  for (let y0 = 0; y0 < gh; y0++) {
    for (let x0 = 0; x0 < gw; x0++) {
      if (!isOcc(x0, y0) || compId[at(x0, y0)] >= 0)
        continue;
      const id = components.length;
      const cells = [];
      const stack = [[x0, y0]];
      compId[at(x0, y0)] = id;
      while (stack.length) {
        const top = stack.pop();
        if (!top)
          break;
        const [cx, cy] = top;
        cells.push(at(cx, cy));
        for (const [ddx, ddy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = cx + ddx;
          const ny = cy + ddy;
          if (isOcc(nx, ny) && compId[at(nx, ny)] < 0) {
            compId[at(nx, ny)] = id;
            stack.push([nx, ny]);
          }
        }
      }
      components.push(cells);
    }
  }
  if (!components.length)
    return null;
  const biggest = Math.max(...components.map((c) => c.length));
  const keptComponents = components.filter((c) => c.length >= Math.max(20, biggest * 0.12));
  const dirs = [[-1, 0], [-1, 1], [0, 1], [1, 1], [1, 0], [1, -1], [0, -1], [-1, -1]];
  const roads = scene.roads;
  const waterPoly = scene.water;
  const traceComponent = (compIndex) => {
    let bsx = -1;
    let bsy = -1;
    for (let y = 0; y < gh && bsy < 0; y++) {
      for (let x = 0; x < gw; x++) {
        if (compId[at(x, y)] === compIndex) {
          bsx = x;
          bsy = y;
          break;
        }
      }
    }
    if (bsx < 0)
      return null;
    const occHere = (x, y) => x >= 0 && x < gw && y >= 0 && y < gh && compId[at(x, y)] === compIndex;
    const contour = [];
    let cur = [bsx, bsy];
    let prev = [bsx - 1, bsy];
    const startc = [bsx, bsy];
    let guard = 0;
    const maxsteps = gw * gh * 2;
    while (guard < maxsteps) {
      guard++;
      const pdx = prev[0] - cur[0];
      const pdy = prev[1] - cur[1];
      let startIdx = 0;
      for (let i = 0; i < 8; i++) {
        if (dirs[i][0] === pdy && dirs[i][1] === pdx) {
          startIdx = i;
          break;
        }
      }
      let foundNext = null;
      for (let off = 1; off <= 8; off++) {
        const d = dirs[(startIdx + off) % 8];
        const nx = cur[0] + d[1];
        const ny = cur[1] + d[0];
        if (occHere(nx, ny)) {
          foundNext = [nx, ny];
          prev = cur;
          cur = [nx, ny];
          break;
        }
      }
      if (foundNext === null)
        break;
      contour.push({ x: minx + cur[0] * cell + cell / 2, y: miny + cur[1] * cell + cell / 2 });
      if (cur[0] === startc[0] && cur[1] === startc[1] && contour.length > 4)
        break;
    }
    if (contour.length < 6)
      return null;
    return contour;
  };
  const segIntersect = (p1, p2, p3, p4) => {
    const den = (p1.x - p2.x) * (p3.y - p4.y) - (p1.y - p2.y) * (p3.x - p4.x);
    if (Math.abs(den) < 1e-9)
      return null;
    const t = ((p1.x - p3.x) * (p3.y - p4.y) - (p1.y - p3.y) * (p3.x - p4.x)) / den;
    const u = ((p1.x - p3.x) * (p1.y - p2.y) - (p1.y - p3.y) * (p1.x - p2.x)) / den;
    if (t >= 0 && t <= 1 && u >= 0 && u <= 1)
      return { x: p1.x + t * (p2.x - p1.x), y: p1.y + t * (p2.y - p1.y) };
    return null;
  };
  const sandMarginForWalls = Math.min(w, h) * 0.02 + 4;
  const finishRing = (contour, riverTrim) => {
    const downsampled = contour.filter((_, i) => i % 2 === 0);
    let ring = chaikinClosed(downsampled, 2);
    ring = resampleClosed(ring, 14);
    if (ring.length < 8)
      return null;
    let open = false;
    if (riverTrim && waterPoly) {
      const nearWater = ring.map((p) => minDistToPoly(p, waterPoly) < sandMarginForWalls + 10);
      const cntNear = nearWater.filter(Boolean).length;
      if (cntNear >= 3 && cntNear < ring.length * 0.6) {
        const m = ring.length;
        let bestStart = -1;
        let bestLen = 0;
        let i = 0;
        let rot = 0;
        for (let k = 0; k < m; k++) {
          if (nearWater[k]) {
            rot = k;
            break;
          }
        }
        while (i < m) {
          const idx = (rot + i) % m;
          if (nearWater[idx]) {
            i++;
            continue;
          }
          let len = 0;
          let j = i;
          while (j < m && !nearWater[(rot + j) % m]) {
            len++;
            j++;
          }
          if (len > bestLen) {
            bestLen = len;
            bestStart = (rot + i) % m;
          }
          i = j;
        }
        if (bestStart >= 0 && bestLen >= 6) {
          const kept = [];
          for (let k = 0; k < bestLen; k++)
            kept.push(ring[(bestStart + k) % m]);
          ring = kept;
          open = true;
        }
      }
    }
    const n = ring.length;
    const nearestRing = (pt) => {
      let best = -1;
      let bestD = Infinity;
      for (let j = 0; j < n; j++) {
        const c = ring[j];
        const d = (pt.x - c.x) ** 2 + (pt.y - c.y) ** 2;
        if (d < bestD) {
          bestD = d;
          best = j;
        }
      }
      return best;
    };
    const gates = [];
    const gateReach = Math.max(28, coreRadius * 0.18);
    const segCount = open ? n - 1 : n;
    for (const road of roads) {
      if (road.role !== "primary" && road.role !== "branch")
        continue;
      const pts = road.points;
      if (pts.length < 2)
        continue;
      const crossings = [];
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i];
        const b = pts[i + 1];
        for (let j = 0; j < segCount; j++) {
          const c = ring[j];
          const d = ring[(j + 1) % n];
          const ip = segIntersect(a, b, c, d);
          if (ip) {
            const ta = Math.atan2(d.y - c.y, d.x - c.x);
            crossings.push({ pos: ip, angle: ta, ringI: j });
          }
        }
      }
      if (!crossings.length) {
        let best = null;
        for (const p of pts) {
          const j = nearestRing(p);
          const c = ring[j];
          const dd = Math.hypot(p.x - c.x, p.y - c.y);
          if (best === null || dd < best[0])
            best = [dd, j];
        }
        if (best && best[0] <= gateReach) {
          const j = best[1];
          const c = ring[j];
          const d = ring[(j + 1) % n];
          const ta = Math.atan2(d.y - c.y, d.x - c.x);
          crossings.push({ pos: c, angle: ta, ringI: j });
        }
      }
      for (const found of crossings) {
        let okGate = true;
        for (const g of gates) {
          if (Math.hypot(found.pos.x - g.pos.x, found.pos.y - g.pos.y) <= coreRadius * 0.25) {
            okGate = false;
            break;
          }
        }
        if (okGate)
          gates.push(found);
      }
    }
    const nearGate = (pt, tol) => gates.some((g) => Math.hypot(pt.x - g.pos.x, pt.y - g.pos.y) < tol);
    const towers = [];
    const towerMinSep = Math.max(40, coreRadius * 0.28);
    const gateClear = coreRadius * 0.14;
    for (let i = 0; i < n; i++) {
      const a = ring[(i - 3 + n) % n];
      const b = ring[i];
      const c = ring[(i + 3) % n];
      const v1x = b.x - a.x;
      const v1y = b.y - a.y;
      const v2x = c.x - b.x;
      const v2y = c.y - b.y;
      const l1 = Math.hypot(v1x, v1y) || 1;
      const l2 = Math.hypot(v2x, v2y) || 1;
      const dot = (v1x * v2x + v1y * v2y) / (l1 * l2);
      const cross = v1x * v2y - v1y * v2x;
      const turn = Math.acos(Math.max(-1, Math.min(1, dot)));
      if (turn > 0.5 && cross < 0) {
        if (!nearGate(b, gateClear) && towers.every((t) => Math.hypot(b.x - t.x, b.y - t.y) > towerMinSep)) {
          towers.push(b);
        }
      }
    }
    const targetSpacing = Math.max(55, coreRadius * 0.45);
    let acc = 0;
    for (let i = 0; i < n; i++) {
      const b = ring[i];
      const nb = ring[(i + 1) % n];
      acc += Math.hypot(nb.x - b.x, nb.y - b.y);
      if (acc >= targetSpacing) {
        if (!nearGate(b, gateClear) && towers.every((t) => Math.hypot(b.x - t.x, b.y - t.y) > towerMinSep)) {
          towers.push(b);
          acc = 0;
        }
      }
    }
    if (open && ring.length >= 2) {
      for (const end of [ring[0], ring[ring.length - 1]]) {
        if (towers.every((t) => Math.hypot(end.x - t.x, end.y - t.y) > towerMinSep * 0.5))
          towers.push(end);
      }
    }
    return { ring, gates, towers, open };
  };
  const trimToRiver = !!waterPoly && keptComponents.length >= 2 && rng() < 0.45;
  const wallRings = [];
  for (let ci = 0; ci < components.length; ci++) {
    if (!keptComponents.includes(components[ci]))
      continue;
    const contour = traceComponent(ci);
    if (!contour)
      continue;
    const wr = finishRing(contour, trimToRiver);
    if (wr)
      wallRings.push(wr);
  }
  if (!wallRings.length)
    return null;
  wallRings.sort((a, b) => b.ring.length - a.ring.length);
  const primary = wallRings[0];
  return { ring: primary.ring, gates: primary.gates, towers: primary.towers, rings: wallRings };
}
