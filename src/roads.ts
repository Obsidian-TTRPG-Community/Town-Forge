import { pointInPolygon } from "./geometry";

export const GRID_W = 100;
export const GRID_H = 100;
export const MOUNTAIN_COST = 45;
export const INF = Infinity;
export const SQRT2 = Math.SQRT2;
export function buildCostGrid(scene, w, h) {
  const cellW = w / GRID_W;
  const cellH = h / GRID_H;
  const grid = [];
  for (let iy = 0; iy < GRID_H; iy++)
    grid.push(new Array(GRID_W).fill(1));
  const water = scene.water;
  const ridges = scene.ridges;
  const forests = scene.forests;
  for (let iy = 0; iy < GRID_H; iy++) {
    const cy = (iy + 0.5) * cellH;
    for (let ix = 0; ix < GRID_W; ix++) {
      const cx = (ix + 0.5) * cellW;
      const pt = { x: cx, y: cy };
      if (water && pointInPolygon(pt, water)) {
        grid[iy][ix] = INF;
        continue;
      }
      let blocked = false;
      if (ridges) {
        for (const ridge of ridges) {
          if (pointInPolygon(pt, ridge)) {
            grid[iy][ix] = MOUNTAIN_COST;
            blocked = true;
            break;
          }
        }
      }
      if (blocked)
        continue;
      if (forests) {
        for (const f of forests) {
          if (pointInPolygon(pt, f.polygon)) {
            grid[iy][ix] = 12;
            break;
          }
        }
      }
    }
  }
  const edgeCells = [];
  for (let iy = 0; iy < GRID_H; iy++) {
    for (let ix = 0; ix < GRID_W; ix++) {
      if (grid[iy][ix] !== 1)
        continue;
      let isEdge = false;
      for (let dy = -1; dy <= 1 && !isEdge; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0)
            continue;
          const nx = ix + dx;
          const ny = iy + dy;
          if (nx >= 0 && nx < GRID_W && ny >= 0 && ny < GRID_H && grid[ny][nx] === 12) {
            isEdge = true;
            break;
          }
        }
      }
      if (isEdge)
        edgeCells.push([ix, iy]);
    }
  }
  for (const [ix, iy] of edgeCells)
    grid[iy][ix] = 2;
  const SHORE_BUFFER_CELLS = 3;
  const SHORE_PENALTY = 4;
  const shoreCells = [];
  for (let iy = 0; iy < GRID_H; iy++) {
    for (let ix = 0; ix < GRID_W; ix++) {
      if (grid[iy][ix] === INF)
        continue;
      let isShore = false;
      for (let dy = -SHORE_BUFFER_CELLS; dy <= SHORE_BUFFER_CELLS && !isShore; dy++) {
        for (let dx = -SHORE_BUFFER_CELLS; dx <= SHORE_BUFFER_CELLS; dx++) {
          const nx = ix + dx;
          const ny = iy + dy;
          if (nx < 0 || nx >= GRID_W || ny < 0 || ny >= GRID_H)
            continue;
          if (grid[ny][nx] === INF) {
            const d = Math.max(Math.abs(dx), Math.abs(dy));
            if (d <= SHORE_BUFFER_CELLS) {
              isShore = true;
              break;
            }
          }
        }
      }
      if (isShore)
        shoreCells.push([ix, iy]);
    }
  }
  for (const [ix, iy] of shoreCells) {
    let minD = SHORE_BUFFER_CELLS;
    for (let dy = -SHORE_BUFFER_CELLS; dy <= SHORE_BUFFER_CELLS; dy++) {
      for (let dx = -SHORE_BUFFER_CELLS; dx <= SHORE_BUFFER_CELLS; dx++) {
        const nx = ix + dx;
        const ny = iy + dy;
        if (nx < 0 || nx >= GRID_W || ny < 0 || ny >= GRID_H)
          continue;
        if (grid[ny][nx] === INF) {
          const d = Math.max(Math.abs(dx), Math.abs(dy));
          if (d < minD)
            minD = d;
        }
      }
    }
    if (minD <= SHORE_BUFFER_CELLS) {
      let attenuation = 1 - (minD - 1) / SHORE_BUFFER_CELLS;
      attenuation = Math.max(0, Math.min(1, attenuation));
      grid[iy][ix] += SHORE_PENALTY * attenuation;
    }
  }
  return { grid, cellW, cellH };
}
export function worldToGrid(pt, cellW, cellH) {
  const ix = Math.max(0, Math.min(GRID_W - 1, Math.floor(pt.x / cellW)));
  const iy = Math.max(0, Math.min(GRID_H - 1, Math.floor(pt.y / cellH)));
  return [ix, iy];
}
export function gridToWorld(cell, cellW, cellH) {
  return { x: (cell[0] + 0.5) * cellW, y: (cell[1] + 0.5) * cellH };
}
export function nearestPassable(grid, cell, maxSearch = 8) {
  const [ix0, iy0] = cell;
  for (let radius = 1; radius <= maxSearch; radius++) {
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (Math.abs(dx) !== radius && Math.abs(dy) !== radius)
          continue;
        const nx = ix0 + dx;
        const ny = iy0 + dy;
        if (nx >= 0 && nx < GRID_W && ny >= 0 && ny < GRID_H && grid[ny][nx] !== INF) {
          return [nx, ny];
        }
      }
    }
  }
  return null;
}
export const MinHeap = class {
  constructor() {
    this.a = [];
  }
  get size() {
    return this.a.length;
  }
  less(i, j) {
    const x = this.a[i];
    const y = this.a[j];
    if (x.f !== y.f)
      return x.f < y.f;
    if (x.g !== y.g)
      return x.g < y.g;
    if (x.ix !== y.ix)
      return x.ix < y.ix;
    return x.iy < y.iy;
  }
  push(n) {
    this.a.push(n);
    let i = this.a.length - 1;
    while (i > 0) {
      const p = i - 1 >> 1;
      if (this.less(i, p)) {
        [this.a[i], this.a[p]] = [this.a[p], this.a[i]];
        i = p;
      } else
        break;
    }
  }
  pop() {
    const top = this.a[0];
    const last = this.a.pop();
    if (this.a.length > 0) {
      this.a[0] = last;
      let i = 0;
      const n = this.a.length;
      for (; ; ) {
        const l = 2 * i + 1;
        const r = 2 * i + 2;
        let m = i;
        if (l < n && this.less(l, m))
          m = l;
        if (r < n && this.less(r, m))
          m = r;
        if (m === i)
          break;
        [this.a[i], this.a[m]] = [this.a[m], this.a[i]];
        i = m;
      }
    }
    return top;
  }
};
export const NEIGHBOURS = [
  [-1, -1, SQRT2],
  [0, -1, 1],
  [1, -1, SQRT2],
  [-1, 0, 1],
  [1, 0, 1],
  [-1, 1, SQRT2],
  [0, 1, 1],
  [1, 1, SQRT2]
];
export function astar(grid, start, goal) {
  if (grid[start[1]][start[0]] === INF) {
    const s = nearestPassable(grid, start);
    if (s === null)
      return null;
    start = s;
  }
  if (grid[goal[1]][goal[0]] === INF) {
    const gl = nearestPassable(grid, goal);
    if (gl === null)
      return null;
    goal = gl;
  }
  const h = (ix, iy) => {
    const dx = Math.abs(ix - goal[0]);
    const dy = Math.abs(iy - goal[1]);
    return dx + dy + (SQRT2 - 2) * Math.min(dx, dy);
  };
  const key = (ix, iy) => iy * GRID_W + ix;
  const heap = new MinHeap();
  heap.push({ f: h(start[0], start[1]), g: 0, ix: start[0], iy: start[1] });
  const cameFrom = /* @__PURE__ */ new Map();
  const visited = /* @__PURE__ */ new Set();
  const gScore = /* @__PURE__ */ new Map();
  gScore.set(key(start[0], start[1]), 0);
  const START = key(start[0], start[1]);
  while (heap.size > 0) {
    const cur = heap.pop();
    const ck = key(cur.ix, cur.iy);
    if (visited.has(ck))
      continue;
    visited.add(ck);
    if (cur.ix === goal[0] && cur.iy === goal[1]) {
      const path = [];
      let c = ck;
      for (; ; ) {
        path.push([c % GRID_W, Math.floor(c / GRID_W)]);
        if (c === START)
          break;
        const p = cameFrom.get(c);
        if (p === void 0)
          break;
        c = p;
      }
      path.reverse();
      return path;
    }
    const cx = cur.ix;
    const cy = cur.iy;
    for (const [dx, dy, step] of NEIGHBOURS) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || nx >= GRID_W || ny < 0 || ny >= GRID_H)
        continue;
      const cost = grid[ny][nx];
      if (cost === INF)
        continue;
      if (dx !== 0 && dy !== 0) {
        if (grid[cy][nx] === INF || grid[ny][cx] === INF)
          continue;
      }
      const nk = key(nx, ny);
      if (visited.has(nk))
        continue;
      const ng = cur.g + step * cost;
      const prev = gScore.get(nk);
      if (prev !== void 0 && prev <= ng)
        continue;
      gScore.set(nk, ng);
      cameFrom.set(nk, ck);
      heap.push({ f: ng + h(nx, ny), g: ng, ix: nx, iy: ny });
    }
  }
  return null;
}
export function pathToPolyline(path, cellW, cellH) {
  return path.map((c) => gridToWorld(c, cellW, cellH));
}
export function chaikinOpen(pts, iters = 3) {
  let out = pts;
  for (let k = 0; k < iters; k++) {
    if (out.length < 3)
      break;
    const nxt = [out[0]];
    for (let i = 0; i < out.length - 1; i++) {
      const a = out[i];
      const b = out[i + 1];
      nxt.push({ x: 0.75 * a.x + 0.25 * b.x, y: 0.75 * a.y + 0.25 * b.y });
      nxt.push({ x: 0.25 * a.x + 0.75 * b.x, y: 0.25 * a.y + 0.75 * b.y });
    }
    nxt.push(out[out.length - 1]);
    out = nxt;
  }
  return out;
}
export function edgeNormal(pt, w, h, edgeMargin = 8) {
  let nx = 0;
  let ny = 0;
  if (pt.x <= edgeMargin)
    nx = -1;
  else if (pt.x >= w - edgeMargin)
    nx = 1;
  if (pt.y <= edgeMargin)
    ny = -1;
  else if (pt.y >= h - edgeMargin)
    ny = 1;
  const l = Math.hypot(nx, ny);
  if (l === 0)
    return null;
  return { x: nx / l, y: ny / l };
}
export function extendEndpointsOffMapAt(pts, w, h, end, overshootFrac = 0.03) {
  if (pts.length < 2)
    return pts;
  const overshoot = Math.min(w, h) * overshootFrac;
  const out = pts.slice();
  if (end === "start") {
    const n = edgeNormal(out[0], w, h);
    if (n)
      out.unshift({ x: out[0].x + n.x * overshoot, y: out[0].y + n.y * overshoot });
  } else {
    const n = edgeNormal(out[out.length - 1], w, h);
    if (n)
      out.push({ x: out[out.length - 1].x + n.x * overshoot, y: out[out.length - 1].y + n.y * overshoot });
  }
  return out;
}
export function extendEndpointsOffMap(pts, w, h, overshootFrac = 0.03) {
  if (pts.length < 2)
    return pts;
  let out = extendEndpointsOffMapAt(pts, w, h, "start", overshootFrac);
  out = extendEndpointsOffMapAt(out, w, h, "end", overshootFrac);
  return out;
}
export function pickEdgeInboundPoint(rng, edge, w, h, usedT, grid, cellW, cellH) {
  for (let attempt = 0; attempt < 30; attempt++) {
    const t = 0.2 + rng() * 0.6;
    if (usedT.some((t2) => Math.abs(t - t2) < 0.22))
      continue;
    let pt;
    if (edge === "N")
      pt = { x: t * w, y: 6 };
    else if (edge === "S")
      pt = { x: t * w, y: h - 6 };
    else if (edge === "W")
      pt = { x: 6, y: t * h };
    else
      pt = { x: w - 6, y: t * h };
    if (grid) {
      const ix = Math.max(0, Math.min(GRID_W - 1, Math.floor(pt.x / cellW)));
      const iy = Math.max(0, Math.min(GRID_H - 1, Math.floor(pt.y / cellH)));
      let viable = false;
      for (let dy = -2; dy <= 2 && !viable; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const nx = ix + dx;
          const ny = iy + dy;
          if (nx >= 0 && nx < GRID_W && ny >= 0 && ny < GRID_H && grid[ny][nx] !== INF) {
            viable = true;
            break;
          }
        }
      }
      if (!viable)
        continue;
    }
    usedT.push(t);
    return { pt, t };
  }
  return null;
}
export function waterSideOfPoint(pt, scene, w, h) {
  const cline = scene.centreline;
  if (!cline || cline.length < 2)
    return "A";
  const p0 = cline[0];
  const p1 = cline[cline.length - 1];
  let rx = p1.x - p0.x;
  let ry = p1.y - p0.y;
  const rl = Math.hypot(rx, ry) || 1;
  rx /= rl;
  ry /= rl;
  const perpX = ry;
  const perpY = -rx;
  const dx = pt.x - p0.x;
  const dy = pt.y - p0.y;
  const side = dx * perpX + dy * perpY;
  return side >= 0 ? "A" : "B";
}
export function findMeetingPoint(rng, grid, w, h, cellW, cellH, scene, sideFilter, edgesOnThisSide) {
  let cxT = w * 0.5;
  let cyT = h * 0.5;
  if (edgesOnThisSide && edgesOnThisSide.length) {
    cxT = edgesOnThisSide.reduce((s, p) => s + p.x, 0) / edgesOnThisSide.length;
    cyT = edgesOnThisSide.reduce((s, p) => s + p.y, 0) / edgesOnThisSide.length;
    let pull;
    if (edgesOnThisSide.length === 1)
      pull = 0.6;
    else if (edgesOnThisSide.length === 2)
      pull = 0.45;
    else
      pull = 0.3;
    cxT = (1 - pull) * cxT + pull * (w / 2);
    cyT = (1 - pull) * cyT + pull * (h / 2);
  }
  const band = Math.min(w, h) * 0.15;
  const waterClearance = Math.min(w, h) * 0.05;
  const water = scene.water;
  const ridges = scene.ridges;
  const searchBand = water && (scene.terrain === "river" || scene.terrain === "lake" || scene.terrain === "coastal") ? Math.min(w, h) * 0.42 : band;
  const ok = (pt) => {
    if (water) {
      if (pointInPolygon(pt, water))
        return false;
      for (const v of water) {
        if (Math.hypot(v.x - pt.x, v.y - pt.y) < waterClearance)
          return false;
      }
    }
    if (ridges) {
      for (const ridge of ridges) {
        if (pointInPolygon(pt, ridge))
          return false;
      }
    }
    if (sideFilter !== null) {
      if (waterSideOfPoint(pt, scene, w, h) !== sideFilter)
        return false;
    }
    return true;
  };
  const isWaterTerrain = !!water && (scene.terrain === "river" || scene.terrain === "lake" || scene.terrain === "coastal");
  const waterStandoff = Math.min(w, h) * 0.06;
  const distToWaterEdge = (pt) => {
    if (!water)
      return Infinity;
    let best = Infinity;
    const n = water.length;
    for (let i = 0; i < n; i++) {
      const a = water[i];
      const b = water[(i + 1) % n];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const seg2 = dx * dx + dy * dy;
      const t = seg2 < 1e-9 ? 0 : Math.max(0, Math.min(1, ((pt.x - a.x) * dx + (pt.y - a.y) * dy) / seg2));
      const qx = a.x + dx * t;
      const qy = a.y + dy * t;
      best = Math.min(best, Math.hypot(pt.x - qx, pt.y - qy));
    }
    return best;
  };
  let bestCand = null;
  let bestCandScore = Infinity;
  for (let i = 0; i < 240; i++) {
    const bx = i % 2 === 0 ? cxT : w / 2;
    const by = i % 2 === 0 ? cyT : h / 2;
    const x = bx + (rng() - 0.5) * 2 * searchBand;
    const y = by + (rng() - 0.5) * 2 * searchBand;
    if (!ok({ x, y }))
      continue;
    const ix = Math.max(0, Math.min(GRID_W - 1, Math.floor(x / cellW)));
    const iy = Math.max(0, Math.min(GRID_H - 1, Math.floor(y / cellH)));
    if (grid[iy][ix] >= 5)
      continue;
    if (!isWaterTerrain) {
      return { pt: { x, y }, cell: [ix, iy] };
    }
    const d = distToWaterEdge({ x, y });
    const centreDist = Math.hypot(x - w / 2, y - h / 2);
    const score = Math.abs(d - waterStandoff) + grid[iy][ix] * 0.5 + centreDist * 0.5;
    if (score < bestCandScore) {
      bestCandScore = score;
      bestCand = { pt: { x, y }, cell: [ix, iy] };
    }
  }
  if (bestCand)
    return bestCand;
  return null;
}
export function clearShorePenaltyNear(grid, pt, cellW, cellH, radius = 2) {
  const ix0 = Math.max(0, Math.min(GRID_W - 1, Math.floor(pt.x / cellW)));
  const iy0 = Math.max(0, Math.min(GRID_H - 1, Math.floor(pt.y / cellH)));
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const nx = ix0 + dx;
      const ny = iy0 + dy;
      if (nx < 0 || nx >= GRID_W || ny < 0 || ny >= GRID_H)
        continue;
      const c = grid[ny][nx];
      if (c === INF)
        continue;
      if (c <= 5.5)
        grid[ny][nx] = 1;
      else if (c <= 8)
        grid[ny][nx] = 2;
    }
  }
}
export function bankEndpointForBridge(bridgePt, scene, w, h, side) {
  const cline = scene.centreline;
  const water = scene.water;
  if (!cline || !water)
    return bridgePt;
  const p0 = cline[0];
  const p1 = cline[cline.length - 1];
  let rx = p1.x - p0.x;
  let ry = p1.y - p0.y;
  const rl = Math.hypot(rx, ry) || 1;
  rx /= rl;
  ry /= rl;
  const perpX = ry;
  const perpY = -rx;
  const sign = side === "A" ? 1 : -1;
  const dx = perpX * sign;
  const dy = perpY * sign;
  const cx = bridgePt.x;
  const cy = bridgePt.y;
  const step = 2;
  const maxSteps = Math.floor(Math.min(w, h) * 0.2 / step);
  let lastIn = { x: cx, y: cy };
  for (let k = 1; k < maxSteps; k++) {
    let px = cx + dx * step * k;
    let py = cy + dy * step * k;
    if (!pointInPolygon({ x: px, y: py }, water)) {
      for (let extra = 0; extra < 6; extra++) {
        const px2 = px + dx * step;
        const py2 = py + dy * step;
        if (px2 >= 0 && px2 < w && py2 >= 0 && py2 < h) {
          px = px2;
          py = py2;
        }
      }
      return { x: px, y: py };
    }
    lastIn = { x: px, y: py };
  }
  return { x: lastIn.x + dx * 30, y: lastIn.y + dy * 30 };
}
export function routeRoad(grid, p1, p2, cellW, cellH, w, h, endExtends) {
  const c1 = worldToGrid(p1, cellW, cellH);
  const c2 = worldToGrid(p2, cellW, cellH);
  const path = astar(grid, c1, c2);
  if (path === null || path.length < 2)
    return null;
  let polyline = pathToPolyline(path, cellW, cellH);
  polyline[0] = p1;
  polyline[polyline.length - 1] = p2;
  polyline = chaikinOpen(polyline, 3);
  polyline[0] = p1;
  polyline[polyline.length - 1] = p2;
  const [extS, extE] = endExtends;
  if (extS && extE)
    polyline = extendEndpointsOffMap(polyline, w, h);
  else if (extS)
    polyline = extendEndpointsOffMapAt(polyline, w, h, "start");
  else if (extE)
    polyline = extendEndpointsOffMapAt(polyline, w, h, "end");
  return polyline;
}
export function stampRoadCostWeighted(grid, polyline, cellW, cellH, nearEndFactor = 20, farFactor = 4, radius = 3) {
  const n = polyline.length;
  const stamped = /* @__PURE__ */ new Set();
  for (let i = 0; i < n; i++) {
    const p = polyline[i];
    const t = n > 1 ? i / (n - 1) : 1;
    const factor = farFactor + (nearEndFactor - farFactor) * t;
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
        if (grid[ny][nx] === INF)
          continue;
        const d = Math.max(Math.abs(dx), Math.abs(dy));
        const localFactor = d === 0 ? factor : factor / (1 + d);
        grid[ny][nx] = Math.min(grid[ny][nx] + localFactor, 60);
      }
    }
  }
}
export function closestPointOnPolylines(target, polylines) {
  let best = null;
  let bestD = Infinity;
  for (const poly of polylines) {
    for (let i = 0; i < poly.length - 1; i++) {
      const a = poly[i];
      const b = poly[i + 1];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const segL2 = dx * dx + dy * dy;
      let t;
      if (segL2 === 0)
        t = 0;
      else {
        t = ((target.x - a.x) * dx + (target.y - a.y) * dy) / segL2;
        t = Math.max(0, Math.min(1, t));
      }
      const cx = a.x + t * dx;
      const cy = a.y + t * dy;
      const d = Math.hypot(target.x - cx, target.y - cy);
      if (d < bestD) {
        bestD = d;
        best = { x: cx, y: cy };
      }
    }
  }
  return best;
}
export function choosePrimaryPair(entries, scene, terrain, w, h) {
  const n = entries.length;
  if (n < 2)
    return null;
  if (terrain === "river" && scene.water) {
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const si = waterSideOfPoint(entries[i].pt, scene, w, h);
        const sj = waterSideOfPoint(entries[j].pt, scene, w, h);
        if (si !== sj)
          return [i, j];
      }
    }
  }
  const opposites = { N: "S", S: "N", E: "W", W: "E" };
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (entries[j].edge === opposites[entries[i].edge])
        return [i, j];
    }
  }
  return [0, 1];
}
export function computeTownSite(roads, bridge, w, h) {
  if (!roads.length)
    return null;
  if (bridge)
    return bridge.centre;
  const primaries = roads.filter((r) => r.role === "primary");
  const branches = roads.filter((r) => r.role === "branch");
  if (!primaries.length)
    return null;
  if (!branches.length) {
    const pts = primaries[0].points;
    const nearEdge = (p) => p.x <= 12 || p.x >= w - 12 || p.y <= 12 || p.y >= h - 12;
    const startNear = nearEdge(pts[0]);
    const endNear = nearEdge(pts[pts.length - 1]);
    const centralPoint = () => {
      let best = pts[Math.floor(pts.length / 2)];
      let bd = Infinity;
      for (const p of pts) {
        const d = Math.hypot(p.x - w / 2, p.y - h / 2);
        if (d < bd) {
          bd = d;
          best = p;
        }
      }
      return best;
    };
    if (startNear && endNear)
      return centralPoint();
    if (startNear && !endNear)
      return pts[pts.length - 1];
    if (endNear && !startNear)
      return pts[0];
    return centralPoint();
  }
  const xs = branches.map((b) => b.points[b.points.length - 1].x);
  const ys = branches.map((b) => b.points[b.points.length - 1].y);
  return { x: xs.reduce((s, v) => s + v, 0) / xs.length, y: ys.reduce((s, v) => s + v, 0) / ys.length };
}
export function findOpenTownsite(rng, grid, w, h, cellW, cellH, scene, terrain) {
  const water = scene.water;
  let best = null;
  let bestScore = Infinity;
  const cx = w / 2;
  const cy = h / 2;
  const neighbourhoodBlock = (ix, iy) => {
    let blocked = 0;
    let total = 0;
    for (let dy = -3; dy <= 3; dy++) {
      for (let dx = -3; dx <= 3; dx++) {
        const nx = ix + dx;
        const ny = iy + dy;
        total++;
        if (nx < 0 || nx >= GRID_W || ny < 0 || ny >= GRID_H) {
          blocked++;
          continue;
        }
        if (grid[ny][nx] >= 8)
          blocked++;
      }
    }
    return total ? blocked / total : 1;
  };
  for (let iy = 0; iy < GRID_H; iy++) {
    for (let ix = 0; ix < GRID_W; ix++) {
      const c = grid[iy][ix];
      if (c >= 8)
        continue;
      const x = (ix + 0.5) * cellW;
      const y = (iy + 0.5) * cellH;
      const m = Math.min(w, h) * 0.12;
      if (x < m || x > w - m || y < m || y > h - m)
        continue;
      const nb = neighbourhoodBlock(ix, iy);
      if (nb > 0.6)
        continue;
      let score = c + nb * 6 + 8e-4 * Math.hypot(x - cx, y - cy);
      if ((terrain === "coastal" || terrain === "river" || terrain === "lake") && water) {
        let dmin = 1e9;
        for (const v of water) {
          const d = Math.hypot(v.x - x, v.y - y);
          if (d < dmin)
            dmin = d;
        }
        score += 0.02 * Math.abs(dmin - Math.min(w, h) * 0.08);
      }
      if (score < bestScore) {
        bestScore = score;
        best = { x, y };
      }
    }
  }
  return best;
}
export function fallbackNetwork(rng, grid, w, h, cellW, cellH, scene, terrain) {
  const town = findOpenTownsite(rng, grid, w, h, cellW, cellH, scene, terrain);
  if (town === null)
    return [];
  let bestRoad = null;
  for (const edge of ["N", "E", "S", "W"]) {
    const used = [];
    for (let a = 0; a < 4; a++) {
      const ep = pickEdgeInboundPoint(rng, edge, w, h, used, grid, cellW, cellH);
      if (ep === null)
        break;
      used.push(ep.t);
      const pl = routeRoad(grid, ep.pt, town, cellW, cellH, w, h, [true, false]);
      if (pl !== null) {
        bestRoad = pl;
        break;
      }
    }
    if (bestRoad !== null)
      break;
  }
  if (bestRoad !== null) {
    stampRoadCostWeighted(grid, bestRoad, cellW, cellH);
    return [{ points: bestRoad, class: "arterial", role: "primary", side: "A", town_site: town }];
  }
  const dx = w / 2 - town.x;
  const dy = h / 2 - town.y;
  const dl = Math.hypot(dx, dy) || 1;
  const stubLen = Math.min(w, h) * 0.12;
  const stubEnd = { x: town.x + dx / dl * stubLen, y: town.y + dy / dl * stubLen };
  return [{ points: [town, stubEnd], class: "arterial", role: "primary", side: "A", town_site: town }];
}
export function pullTownSiteToCoast(townSite, scene, w, h) {
  const water = scene.water;
  if (!water || water.length < 2)
    return townSite;
  const beachDist = Math.min(w, h) * 0.02;
  const harbourOffset = beachDist + 8;
  const edgeMargin = harbourOffset + 6;
  const onCanvas = (px, py) => px >= -edgeMargin && px <= w + edgeMargin && py >= -edgeMargin && py <= h + edgeMargin;
  const tx = townSite.x;
  const ty = townSite.y;
  let bestD2 = Infinity;
  let bestPt = null;
  let bestInward = null;
  const n = water.length;
  for (let i = 0; i < n; i++) {
    const a = water[i];
    const b = water[(i + 1) % n];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const seg2 = dx * dx + dy * dy;
    let px;
    let py;
    if (seg2 < 1e-9) {
      px = a.x;
      py = a.y;
    } else {
      const t = Math.max(0, Math.min(1, ((tx - a.x) * dx + (ty - a.y) * dy) / seg2));
      px = a.x + dx * t;
      py = a.y + dy * t;
    }
    if (!onCanvas(px, py))
      continue;
    const d2 = (tx - px) ** 2 + (ty - py) ** 2;
    if (d2 < bestD2) {
      bestD2 = d2;
      bestPt = { x: px, y: py };
      const ix = tx - px;
      const iy = ty - py;
      const il = Math.hypot(ix, iy);
      if (il > 1e-6)
        bestInward = { x: ix / il, y: iy / il };
      else {
        const nl = Math.hypot(dx, dy) || 1;
        bestInward = { x: -dy / nl, y: dx / nl };
      }
    }
  }
  if (bestPt === null || bestInward === null)
    return townSite;
  const nearDist = Math.sqrt(bestD2);
  if (nearDist <= harbourOffset * 1.5)
    return townSite;
  {
    const corridor = nearDist + 260;
    const corridor2 = corridor * corridor;
    let bestCentre = Infinity;
    for (let i = 0; i < n; i++) {
      const a = water[i];
      const b = water[(i + 1) % n];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const seg2 = dx * dx + dy * dy;
      let px;
      let py;
      if (seg2 < 1e-9) {
        px = a.x;
        py = a.y;
      } else {
        const t = Math.max(0, Math.min(1, ((tx - a.x) * dx + (ty - a.y) * dy) / seg2));
        px = a.x + dx * t;
        py = a.y + dy * t;
      }
      if (!onCanvas(px, py))
        continue;
      if ((tx - px) ** 2 + (ty - py) ** 2 > corridor2)
        continue;
      const cDist = Math.hypot(px - w / 2, py - h / 2);
      if (cDist < bestCentre) {
        bestCentre = cDist;
        bestPt = { x: px, y: py };
        const ix = tx - px;
        const iy = ty - py;
        const il = Math.hypot(ix, iy);
        if (il > 1e-6)
          bestInward = { x: ix / il, y: iy / il };
        else {
          const nl = Math.hypot(dx, dy) || 1;
          bestInward = { x: -dy / nl, y: dx / nl };
        }
      }
    }
  }
  let hx = bestPt.x + bestInward.x * harbourOffset;
  let hy = bestPt.y + bestInward.y * harbourOffset;
  hx = Math.max(edgeMargin, Math.min(w - edgeMargin, hx));
  hy = Math.max(edgeMargin, Math.min(h - edgeMargin, hy));
  return { x: hx, y: hy };
}
export function finalizeWithPull(roads, scene, terrain, w, h, bridge = null) {
  if (!roads.length)
    return roads;
  let townSite = null;
  for (const r of roads) {
    if (r.town_site) {
      townSite = r.town_site;
      break;
    }
  }
  if (townSite === null)
    townSite = computeTownSite(roads, bridge, w, h);
  if (townSite !== null && bridge === null && scene.water && (terrain === "coastal" || terrain === "river" || terrain === "lake")) {
    townSite = pullTownSiteToCoast(townSite, scene, w, h);
  }
  if (townSite !== null) {
    const arterialPolys = roads.filter((r) => r.role === "primary" || r.role === "branch" || r.role === "bridge").map((r) => r.points).filter((p) => p && p.length >= 2);
    if (arterialPolys.length) {
      const snapped = closestPointOnPolylines(townSite, arterialPolys);
      if (snapped !== null)
        townSite = snapped;
    }
  }
  if (townSite !== null) {
    for (const road of roads)
      road.town_site = townSite;
  }
  return roads;
}
export function buildRoadNetwork(rng, scene, w, h, terrain, enabledEdges) {
  const { grid, cellW, cellH } = buildCostGrid(scene, w, h);
  const entries = [];
  for (const edge of ["N", "E", "S", "W"]) {
    if (!enabledEdges[edge])
      continue;
    const usedT = [];
    const ep = pickEdgeInboundPoint(rng, edge, w, h, usedT, grid, cellW, cellH);
    if (ep === null)
      continue;
    entries.push({ pt: ep.pt, edge });
  }
  const finalize = (roads2, bridge2 = null) => {
    const out = finalizeWithPull(roads2, scene, terrain, w, h, bridge2);
    const ts = out.length ? out[0].town_site ?? null : null;
    return { roads: out, townSite: ts };
  };
  if (!entries.length) {
    return finalize(fallbackNetwork(rng, grid, w, h, cellW, cellH, scene, terrain));
  }
  const nEdges = entries.length;
  if (nEdges === 1) {
    const e = entries[0];
    const meet = findMeetingPoint(rng, grid, w, h, cellW, cellH, scene, null, [e.pt]);
    let polyline = null;
    if (meet !== null) {
      polyline = routeRoad(grid, e.pt, meet.pt, cellW, cellH, w, h, [true, false]);
    }
    if (meet === null || polyline === null) {
      return finalize(fallbackNetwork(rng, grid, w, h, cellW, cellH, scene, terrain));
    }
    return finalize([{ points: polyline, class: "arterial", role: "primary", side: "A", town_site: meet.pt }]);
  }
  const primaryIndices = choosePrimaryPair(entries, scene, terrain, w, h) ?? [0, 1];
  const [pI, pJ] = primaryIndices;
  const primaryA = entries[pI];
  const primaryB = entries[pJ];
  const branches = entries.filter((_, k) => k !== pI && k !== pJ);
  const roads = [];
  let bridge = null;
  if (terrain === "river" && scene.water) {
    const sideA = waterSideOfPoint(primaryA.pt, scene, w, h);
    const sideB = waterSideOfPoint(primaryB.pt, scene, w, h);
    if (sideA !== sideB && scene.centreline) {
      const cline = scene.centreline;
      let best = null;
      let bestCost = Infinity;
      const lo = Math.floor(cline.length * 0.12);
      const hi = Math.floor(cline.length * 0.88);
      for (let i = lo; i < hi; i++) {
        const p = cline[i];
        if (p.x < w * 0.08 || p.x > w * 0.92)
          continue;
        if (p.y < h * 0.08 || p.y > h * 0.92)
          continue;
        const cost = Math.hypot(primaryA.pt.x - p.x, primaryA.pt.y - p.y) + Math.hypot(primaryB.pt.x - p.x, primaryB.pt.y - p.y) + Math.hypot(p.x - w / 2, p.y - h / 2) * 1.5;
        if (cost < bestCost) {
          bestCost = cost;
          best = p;
        }
      }
      if (best !== null) {
        const bankA = bankEndpointForBridge(best, scene, w, h, sideA);
        const bankB = bankEndpointForBridge(best, scene, w, h, sideB);
        bridge = { centre: best, banks: { [sideA]: bankA, [sideB]: bankB } };
        clearShorePenaltyNear(grid, bankA, cellW, cellH, 2);
        clearShorePenaltyNear(grid, bankB, cellW, cellH, 2);
        const segA = routeRoad(grid, primaryA.pt, bankA, cellW, cellH, w, h, [true, false]);
        const segB = routeRoad(grid, bankB, primaryB.pt, cellW, cellH, w, h, [false, true]);
        if (segA !== null) {
          stampRoadCostWeighted(grid, segA, cellW, cellH);
          roads.push({ points: segA, class: "arterial", role: "primary", side: sideA });
        }
        if (segB !== null) {
          stampRoadCostWeighted(grid, segB, cellW, cellH);
          roads.push({ points: segB, class: "arterial", role: "primary", side: sideB });
        }
      }
    }
  }
  if (bridge === null) {
    const polyline = routeRoad(grid, primaryA.pt, primaryB.pt, cellW, cellH, w, h, [true, true]);
    if (polyline !== null) {
      stampRoadCostWeighted(grid, polyline, cellW, cellH, 14, 14);
      roads.push({ points: polyline, class: "arterial", role: "primary", side: "A" });
    }
  }
  if (roads.length) {
    const primaryPolylines = roads.filter((r) => r.role === "primary").map((r) => r.points);
    for (const branch of branches) {
      let targetPolys;
      if (terrain === "river" && scene.water) {
        const branchSide = waterSideOfPoint(branch.pt, scene, w, h);
        targetPolys = roads.filter((r) => r.role === "primary" && r.side === branchSide).map((r) => r.points);
        if (!targetPolys.length) {
          const meet = findMeetingPoint(rng, grid, w, h, cellW, cellH, scene, null, [branch.pt]);
          if (meet === null)
            continue;
          const pl2 = routeRoad(grid, branch.pt, meet.pt, cellW, cellH, w, h, [true, false]);
          if (pl2 === null)
            continue;
          stampRoadCostWeighted(grid, pl2, cellW, cellH);
          roads.push({ points: pl2, class: "arterial", role: "branch", side: branchSide });
          continue;
        }
      } else {
        targetPolys = primaryPolylines;
      }
      const junction = closestPointOnPolylines(branch.pt, targetPolys);
      if (junction === null)
        continue;
      const pl = routeRoad(grid, branch.pt, junction, cellW, cellH, w, h, [true, false]);
      if (pl === null)
        continue;
      stampRoadCostWeighted(grid, pl, cellW, cellH);
      roads.push({ points: pl, class: "arterial", role: "branch" });
    }
  }
  if (bridge !== null) {
    roads.push({
      points: [bridge.banks["A"], bridge.centre, bridge.banks["B"]],
      class: "bridge",
      role: "bridge"
    });
  }
  if (!roads.length) {
    return finalize(fallbackNetwork(rng, grid, w, h, cellW, cellH, scene, terrain));
  }
  return finalize(roads, bridge);
}
