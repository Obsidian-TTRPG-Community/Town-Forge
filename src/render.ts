import { pointInPolygonNonzero } from "./geometry";
import { buildHeightField, contourSegments, hillshadeAt } from "./mountains";

export var PALETTE = {
  grassBase: "rgb(155,178,115)",
  grassBright: "rgb(175,195,130)",
  beach: "rgb(242,232,200)",
  waterDeep: "rgb(60,98,122)",
  waterLight: "rgb(95,138,165)",
  waterHigh: "rgb(140,178,198)",
  mtnFill: "rgba(160,144,116,0.92)",
  mtnOut: "rgba(110,90,64,0.9)",
  ink: "rgb(35,35,35)",
  vignette: "rgb(25,35,40)"
};
export function pathPoly(ctx, poly) {
  ctx.beginPath();
  ctx.moveTo(poly[0].x, poly[0].y);
  for (let i = 1; i < poly.length; i++)
    ctx.lineTo(poly[i].x, poly[i].y);
  ctx.closePath();
}
export function bufferPolygon(poly, dist) {
  const n = poly.length;
  const out = [];
  let area = 0;
  for (let i = 0; i < n; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % n];
    area += (b.x - a.x) * (b.y + a.y);
  }
  const sign = area > 0 ? 1 : -1;
  for (let i = 0; i < n; i++) {
    const prev = poly[(i - 1 + n) % n];
    const next = poly[(i + 1) % n];
    const tx = next.x - prev.x;
    const ty = next.y - prev.y;
    const tl = Math.hypot(tx, ty) || 1;
    const nx = -ty / tl * sign;
    const ny = tx / tl * sign;
    out.push({ x: poly[i].x + nx * dist, y: poly[i].y + ny * dist });
  }
  return out;
}
export function drawBase(ctx, scene, w, h) {
  ctx.fillStyle = PALETTE.grassBase;
  ctx.fillRect(0, 0, w, h);
  const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.6);
  g.addColorStop(0, "rgba(175,195,130,0.55)");
  g.addColorStop(1, "rgba(175,195,130,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  if (scene.water) {
    const water = scene.water;
    const beachDist = Math.min(w, h) * 0.02;
    const beach = bufferPolygon(water, beachDist);
    ctx.fillStyle = PALETTE.beach;
    pathPoly(ctx, beach);
    ctx.fill();
    ctx.fillStyle = PALETTE.waterDeep;
    pathPoly(ctx, water);
    ctx.fill();
    const inner = bufferPolygon(water, -Math.min(w, h) * 8e-3);
    ctx.fillStyle = PALETTE.waterLight;
    pathPoly(ctx, inner);
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.45)";
    ctx.lineWidth = 1.2;
    pathPoly(ctx, water);
    ctx.stroke();
    if (scene.centreline && scene.terrain === "river") {
      ctx.strokeStyle = "rgba(140,178,198,0.6)";
      ctx.lineWidth = Math.max(2, Math.min(w, h) * 6e-3);
      ctx.beginPath();
      ctx.moveTo(scene.centreline[0].x, scene.centreline[0].y);
      for (let i = 1; i < scene.centreline.length; i++) {
        ctx.lineTo(scene.centreline[i].x, scene.centreline[i].y);
      }
      ctx.stroke();
    }
  }
  if (scene.mountains && scene.mountains.length) {
    for (const mtn of scene.mountains)
      drawContourMountain(ctx, mtn, scene.water ?? void 0);
  } else if (scene.ridges) {
    for (const ridge of scene.ridges) {
      const rings = 4;
      for (let k = 0; k < rings; k++) {
        const ring = k === 0 ? ridge : bufferPolygon(ridge, -Math.min(w, h) * 0.012 * k);
        const shade = 1 - k * 0.12;
        ctx.fillStyle = `rgba(${Math.round(160 * shade)},${Math.round(144 * shade)},${Math.round(116 * shade)},0.95)`;
        pathPoly(ctx, ring);
        ctx.fill();
        ctx.strokeStyle = PALETTE.mtnOut;
        ctx.lineWidth = 1;
        pathPoly(ctx, ring);
        ctx.stroke();
      }
    }
  }
}
export var HYPSO = [
  [196, 184, 150],
  [202, 188, 152],
  [208, 192, 156],
  [214, 198, 160],
  [220, 204, 168],
  [228, 212, 180],
  [236, 222, 196],
  [246, 236, 214]
];
export var GRASS_RGB = [155, 178, 115];
export function reliefColor(field, gx, gy, v, maxH) {
  const sh = hillshadeAt(field, field.minx + gx * field.cell, field.miny + gy * field.cell);
  const band = Math.min(HYPSO.length - 1, Math.floor(v * HYPSO.length));
  const [r, g, b] = HYPSO[band];
  const m = 0.78 + sh * 0.4;
  let R = r * m, G = g * m, B = b * m;
  if (v > 0.88) {
    const t = (v - 0.88) / 0.12;
    R = R * (1 - t) + 244 * t;
    G = G * (1 - t) + 244 * t;
    B = B * (1 - t) + 240 * t;
  }
  if (v < 0.12) {
    const a = v / 0.12;
    R = GRASS_RGB[0] * (1 - a) + R * a;
    G = GRASS_RGB[1] * (1 - a) + G * a;
    B = GRASS_RGB[2] * (1 - a) + B * a;
  }
  const q = 3;
  R = Math.round(R / q) * q;
  G = Math.round(G / q) * q;
  B = Math.round(B / q) * q;
  return `rgb(${R},${G},${B})`;
}
export function drawContourMountain(ctx, mtn, water) {
  const field = buildHeightField(mtn, 4, 44, water);
  const { H, GW, GH, cell, minx, miny, maxH } = field;
  if (maxH <= 0)
    return;
  const LEVELS = 11;
  const invMaxH = 1 / maxH;
  ctx.fillStyle = "rgba(40,30,18,0.06)";
  for (let gy = 0; gy < GH - 1; gy++) {
    let gx = 0;
    while (gx < GW - 1) {
      if (H[gy * GW + gx] > 0.02 * maxH) {
        const start = gx;
        while (gx < GW - 1 && H[gy * GW + gx] > 0.02 * maxH)
          gx++;
        ctx.fillRect(minx + start * cell + 3, miny + gy * cell + 4, (gx - start) * cell + 1, cell + 1);
      } else
        gx++;
    }
  }
  let curCol = "";
  for (let gy = 0; gy < GH - 1; gy++) {
    let gx = 0;
    while (gx < GW - 1) {
      const v = H[gy * GW + gx] * invMaxH;
      if (v <= 0.02) {
        gx++;
        continue;
      }
      const col = reliefColor(field, gx, gy, v, maxH);
      const start = gx;
      gx++;
      while (gx < GW - 1) {
        const v2 = H[gy * GW + gx] * invMaxH;
        if (v2 <= 0.02)
          break;
        if (reliefColor(field, gx, gy, v2, maxH) !== col)
          break;
        gx++;
      }
      if (col !== curCol) {
        ctx.fillStyle = col;
        curCol = col;
      }
      ctx.fillRect(minx + start * cell, miny + gy * cell, (gx - start) * cell + 1, cell + 1);
    }
  }
  for (let li = 2; li < LEVELS; li++) {
    const L = li / LEVELS * maxH;
    const segs = contourSegments(field, L);
    const isIndex = li % 3 === 0;
    ctx.strokeStyle = isIndex ? "rgba(60,44,30,0.62)" : "rgba(72,56,38,0.34)";
    ctx.lineWidth = isIndex ? 1.3 : 0.7;
    ctx.beginPath();
    for (const [a, b] of segs) {
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
    }
    ctx.stroke();
  }
}
export function drawForests(ctx, scene, excludeZone, extraExclude) {
  if (!scene.forests)
    return;
  const TREE_DARK = "rgb(48,76,40)";
  const TREE_MID = "rgb(78,110,62)";
  const TREE_LIGHT = "rgb(108,142,82)";
  for (const f of scene.forests) {
    const poly = f.polygon;
    if (poly.length < 3)
      continue;
    let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
    for (const p of poly) {
      if (p.x < minx)
        minx = p.x;
      if (p.y < miny)
        miny = p.y;
      if (p.x > maxx)
        maxx = p.x;
      if (p.y > maxy)
        maxy = p.y;
    }
    const area = Math.abs(polyArea(poly));
    const R = Math.max(7, Math.min(16, Math.sqrt(area) * 0.05));
    const target = Math.max(6, Math.floor(area / (R * R * 1.4)));
    let s = Math.floor(f.cx * 928371 + f.cy * 1299709) >>> 0 || 1;
    const rand = () => {
      s = s * 1664525 + 1013904223 >>> 0;
      return s / 4294967296;
    };
    const crowns = [];
    let attempts = 0;
    while (crowns.length < target && attempts < target * 8) {
      attempts++;
      const px = minx + rand() * (maxx - minx);
      const py = miny + rand() * (maxy - miny);
      if (!pointInPoly2({ x: px, y: py }, poly))
        continue;
      if (excludeZone && pointInPoly2({ x: px, y: py }, excludeZone))
        continue;
      if (extraExclude && Math.hypot(px - extraExclude.c.x, py - extraExclude.c.y) < extraExclude.r)
        continue;
      if (scene.water) {
        if (pointInPolygonNonzero({ x: px, y: py }, scene.water))
          continue;
        const br = R * 0.7;
        let overWater = false;
        for (let a = 0; a < 8; a++) {
          const ang = a / 8 * Math.PI * 2;
          if (pointInPolygonNonzero({ x: px + Math.cos(ang) * br, y: py + Math.sin(ang) * br }, scene.water)) {
            overWater = true;
            break;
          }
        }
        if (overWater)
          continue;
      }
      crowns.push({ x: px, y: py });
    }
    if (!crowns.length)
      continue;
    crowns.sort((a, b) => a.y - b.y);
    ctx.fillStyle = "rgba(30,45,28,0.35)";
    for (const c of crowns) {
      ctx.beginPath();
      ctx.arc(c.x + 2.2, c.y + 2.8, R * 1.02, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = TREE_DARK;
    for (const c of crowns) {
      ctx.beginPath();
      ctx.arc(c.x, c.y, R, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = TREE_MID;
    for (const c of crowns) {
      ctx.beginPath();
      ctx.arc(c.x - R * 0.12, c.y - R * 0.12, R * 0.82, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = TREE_LIGHT;
    for (const c of crowns) {
      ctx.beginPath();
      ctx.arc(c.x - R * 0.28, c.y - R * 0.3, R * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
export function polyArea(poly) {
  let s = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    s += a.x * b.y - b.x * a.y;
  }
  return s / 2;
}
export function pointInPoly2(pt, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, yi = poly[i].y;
    const xj = poly[j].x, yj = poly[j].y;
    if (yi > pt.y !== yj > pt.y && pt.x < (xj - xi) * (pt.y - yi) / (yj - yi) + xi)
      inside = !inside;
  }
  return inside;
}
export function drawVignetteAndTitle(ctx, w, h, title, mapDistance, distanceUnit) {
  const vg = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.4, w / 2, h / 2, Math.max(w, h) * 0.72);
  vg.addColorStop(0, "rgba(20,30,34,0)");
  vg.addColorStop(1, "rgba(20,30,34,0.42)");
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = "rgba(30,38,40,0.85)";
  ctx.lineWidth = Math.max(3, Math.min(w, h) * 6e-3);
  ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2, w - ctx.lineWidth, h - ctx.lineWidth);
  const unit = Math.min(w, h);
  const label = title.toUpperCase();
  ctx.font = `600 ${Math.round(unit * 0.032)}px Georgia, serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const tw = ctx.measureText(label).width;
  const padX = 14;
  const pillW = tw + padX * 2;
  const pillH = Math.round(unit * 0.05);
  const pillX = w / 2 - pillW / 2;
  const pillY = Math.round(h * 0.02);
  ctx.fillStyle = "rgba(247,243,233,0.94)";
  ctx.strokeStyle = PALETTE.ink;
  ctx.lineWidth = 1.5;
  roundRect(ctx, pillX, pillY, pillW, pillH, 4);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = PALETTE.ink;
  ctx.fillText(label, w / 2, pillY + pillH / 2 + 1);
  const cr = unit * 0.035;
  const ccx = w - cr - unit * 0.04;
  const ccy = cr + unit * 0.04;
  ctx.fillStyle = "rgba(247,243,233,0.94)";
  ctx.strokeStyle = PALETTE.ink;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(ccx, ccy, cr, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "rgb(60,60,66)";
  ctx.beginPath();
  ctx.moveTo(ccx, ccy - cr * 0.7);
  ctx.lineTo(ccx - cr * 0.22, ccy);
  ctx.lineTo(ccx + cr * 0.22, ccy);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "rgb(150,150,156)";
  ctx.beginPath();
  ctx.moveTo(ccx, ccy + cr * 0.7);
  ctx.lineTo(ccx - cr * 0.22, ccy);
  ctx.lineTo(ccx + cr * 0.22, ccy);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = PALETTE.ink;
  ctx.font = `700 ${Math.round(cr * 0.5)}px Georgia, serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("N", ccx, ccy - cr * 0.72);
  drawScaleBar(ctx, w, h, unit, mapDistance, distanceUnit);
}
export function niceRound(x) {
  if (x <= 0)
    return 1;
  const exp = Math.floor(Math.log10(x));
  const base = Math.pow(10, exp);
  const f = x / base;
  let nice;
  if (f >= 5)
    nice = 5;
  else if (f >= 2)
    nice = 2;
  else
    nice = 1;
  return nice * base;
}
export function fmtDist(v) {
  if (Number.isInteger(v))
    return String(v);
  return String(parseFloat(v.toFixed(2)));
}
export function drawScaleBar(ctx, w, h, unit, mapDistance, distanceUnit) {
  const distPerPx = mapDistance / w;
  const targetPx = w * 0.18;
  const rawDist = targetPx * distPerPx;
  const niceDist = niceRound(rawDist);
  const barW = niceDist / distPerPx;
  const barH = unit * 0.012;
  const barX = unit * 0.04;
  const barY = h - barH - unit * 0.06;
  const segs = 4;
  const segW = barW / segs;
  for (let i = 0; i < segs; i++) {
    ctx.fillStyle = i % 2 === 0 ? "rgb(40,40,40)" : "rgb(245,245,240)";
    ctx.fillRect(barX + i * segW, barY, segW, barH);
  }
  ctx.strokeStyle = PALETTE.ink;
  ctx.lineWidth = 1;
  ctx.strokeRect(barX, barY, barW, barH);
  ctx.fillStyle = PALETTE.ink;
  ctx.font = `600 ${Math.round(unit * 0.022)}px Georgia, serif`;
  ctx.textBaseline = "bottom";
  const labelY = barY - 2;
  ctx.textAlign = "center";
  ctx.fillText("0", barX, labelY);
  ctx.fillText(fmtDist(niceDist / 2), barX + barW / 2, labelY);
  ctx.textAlign = "left";
  ctx.fillText(`${fmtDist(niceDist)} ${distanceUnit}`, barX + barW + 4, labelY + unit * 0.022 * 0);
  ctx.textAlign = "center";
}
export function renderScene(ctx, scene, w, h, title, mapDistance = 8, distanceUnit = "miles") {
  drawBase(ctx, scene, w, h);
  drawForests(ctx, scene);
  drawVignetteAndTitle(ctx, w, h, title, mapDistance, distanceUnit);
}
export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
export var STREET_COL = "rgb(188,170,134)";
export var ROAD_COL = "rgb(176,158,120)";
export var ROOF_PALETTE = [
  [[178, 132, 92], [138, 96, 64]],
  // warm brown
  [[155, 122, 88], [118, 90, 60]],
  // tan
  [[130, 108, 84], [98, 78, 58]],
  // darker brown
  [[110, 116, 122], [78, 84, 92]]
  // slate
];
export function pickRoofColours(seed) {
  const palI = seed % 8;
  if (palI < 3)
    return ROOF_PALETTE[palI];
  if (palI < 6)
    return ROOF_PALETTE[palI - 3];
  return ROOF_PALETTE[3];
}
export function rgb(c) {
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}
export function rgbLift(c, amt) {
  return `rgb(${Math.min(255, c[0] + amt)},${Math.min(255, c[1] + amt)},${Math.min(255, c[2] + amt)})`;
}
export function strokePolyline(ctx, pts) {
  if (pts.length < 2)
    return;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++)
    ctx.lineTo(pts[i].x, pts[i].y);
  ctx.stroke();
}
export function renderFull(ctx, scene, w, h, title, mapDistance = 8, distanceUnit = "miles", name) {
  drawBase(ctx, scene, w, h);
  let excludeZone;
  if (scene.footprint && scene.footprint.length >= 3) {
    excludeZone = bufferPolygon(scene.footprint, 22);
  } else if (scene.walls && scene.walls.ring && scene.walls.ring.length >= 3) {
    excludeZone = bufferPolygon(scene.walls.ring, 22);
  }
  const dockExclude = scene.dock ? { c: scene.dock.shorePt, r: 46 } : void 0;
  drawForests(ctx, scene, excludeZone, dockExclude);
  if (scene.farms && scene.farms.length)
    drawFarms(ctx, scene.farms);
  const isCity = scene.street_base && scene.street_base.length || scene.footprint && scene.footprint.length;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const road of scene.roads) {
    if (road.class === "bridge")
      continue;
    const isArterial = road.role === "primary" || road.role === "branch";
    ctx.strokeStyle = ROAD_COL;
    ctx.lineWidth = isArterial ? 7 : 4;
    strokePolyline(ctx, road.points);
  }
  if (scene.outlanes && scene.outlanes.length) {
    ctx.strokeStyle = ROAD_COL;
    ctx.lineWidth = 4;
    ctx.save();
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    for (const lane of scene.outlanes) {
      if (lane.points.length < 2)
        continue;
      const p = lane.points;
      ctx.beginPath();
      ctx.moveTo(p[0].x, p[0].y);
      if (p.length === 2) {
        ctx.lineTo(p[1].x, p[1].y);
      } else {
        for (let i = 1; i < p.length - 1; i++) {
          const mx = (p[i].x + p[i + 1].x) / 2;
          const my = (p[i].y + p[i + 1].y) / 2;
          ctx.quadraticCurveTo(p[i].x, p[i].y, mx, my);
        }
        ctx.lineTo(p[p.length - 1].x, p[p.length - 1].y);
      }
      ctx.stroke();
    }
    ctx.restore();
  }
  if (scene.street_base && scene.street_base.length) {
    ctx.fillStyle = STREET_COL;
    for (const block of scene.street_base) {
      const expanded = bufferPolygon(block, 4);
      pathPoly(ctx, expanded);
      ctx.fill();
    }
  }
  if (scene.parks) {
    ctx.fillStyle = "rgb(150,173,112)";
    for (const park of scene.parks) {
      const inner = bufferPolygon(park, -1);
      pathPoly(ctx, inner);
      ctx.fill();
    }
  }
  for (const road of scene.roads) {
    if (road.class !== "bridge")
      continue;
    ctx.strokeStyle = "rgb(150,130,98)";
    ctx.lineWidth = 9;
    strokePolyline(ctx, road.points);
    ctx.strokeStyle = "rgba(60,45,30,0.6)";
    ctx.lineWidth = 1.5;
    strokePolyline(ctx, road.points);
  }
  if (scene.houses && scene.houses.length) {
    if (isCity) {
      ctx.fillStyle = "rgba(35,26,18,0.28)";
      for (const hh of scene.houses) {
        if (!hh.polygon || hh.polygon.length < 3)
          continue;
        ctx.beginPath();
        ctx.moveTo(hh.polygon[0].x + 1.2, hh.polygon[0].y + 1.6);
        for (let i = 1; i < hh.polygon.length; i++)
          ctx.lineTo(hh.polygon[i].x + 1.2, hh.polygon[i].y + 1.6);
        ctx.closePath();
        ctx.fill();
      }
      ctx.strokeStyle = "rgb(40,28,20)";
      ctx.lineWidth = 0.7;
      for (const hh of scene.houses) {
        if (!hh.polygon || hh.polygon.length < 3)
          continue;
        const seed = Math.floor(Math.abs(hh.centre.x * 7.3 + hh.centre.y * 13.7));
        const [light] = pickRoofColours(seed);
        ctx.fillStyle = rgbLift(light, 8);
        pathPoly(ctx, hh.polygon);
        ctx.fill();
        ctx.stroke();
      }
    } else {
      for (const hh of scene.houses) {
        drawSmallHouse(ctx, hh.centre, hh.size, hh.angle);
      }
    }
  }
  if (scene.outbuildings && scene.outbuildings.length)
    drawOutbuildings(ctx, scene.outbuildings);
  if (scene.walls) {
    const wls = scene.walls;
    const ringsToDraw = wls.rings && wls.rings.length ? wls.rings : [{ ring: wls.ring, gates: wls.gates, towers: wls.towers, open: false }];
    for (const wr of ringsToDraw) {
      if (!wr.ring || wr.ring.length < 2)
        continue;
      ctx.strokeStyle = "rgb(120,112,96)";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(wr.ring[0].x, wr.ring[0].y);
      for (let i = 1; i < wr.ring.length; i++)
        ctx.lineTo(wr.ring[i].x, wr.ring[i].y);
      if (!wr.open)
        ctx.closePath();
      ctx.stroke();
      ctx.strokeStyle = "rgba(60,52,40,0.7)";
      ctx.lineWidth = 1;
      ctx.stroke();
      for (const g of wr.gates) {
        ctx.fillStyle = STREET_COL;
        ctx.beginPath();
        ctx.arc(g.pos.x, g.pos.y, 5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = "rgb(110,102,86)";
      ctx.strokeStyle = "rgba(50,44,34,0.8)";
      ctx.lineWidth = 1;
      for (const t of wr.towers) {
        ctx.beginPath();
        ctx.arc(t.x, t.y, 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    }
  }
  if (scene.landmarks) {
    for (const lm of scene.landmarks) {
      if (lm.type === "castle")
        drawCastle(ctx, lm);
      else if (lm.type === "cathedral")
        drawCathedral(ctx, lm);
      else if (lm.type === "market")
        drawMarket(ctx, lm);
      else if (lm.type === "barracks")
        drawBarracks(ctx, lm);
      else if (lm.type === "tower")
        drawTower(ctx, lm);
    }
  }
  if (scene.dock)
    drawDock(ctx, scene.dock);
  drawVignetteAndTitle(ctx, w, h, name && name.trim() ? name : title, mapDistance, distanceUnit);
}
export function drawDock(ctx, dock) {
  const fillStroke = (poly, fill, stroke, lw = 1) => {
    ctx.fillStyle = fill;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lw;
    pathPoly(ctx, poly);
    ctx.fill();
    ctx.stroke();
  };
  const shadow = (poly, ox, oy, a) => {
    ctx.fillStyle = `rgba(0,0,0,${a})`;
    ctx.beginPath();
    ctx.moveTo(poly[0].x + ox, poly[0].y + oy);
    for (let i = 1; i < poly.length; i++)
      ctx.lineTo(poly[i].x + ox, poly[i].y + oy);
    ctx.closePath();
    ctx.fill();
  };
  const PLANK = "rgb(150,120,86)";
  const PLANK_DK = "rgb(96,72,48)";
  const PLANK_EDGE = "rgba(60,44,28,0.85)";
  if (dock.lane && dock.lane.length >= 2) {
    ctx.save();
    ctx.strokeStyle = ROAD_COL;
    ctx.lineWidth = 4;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    const p = dock.lane;
    ctx.beginPath();
    ctx.moveTo(p[0].x, p[0].y);
    if (p.length === 2) {
      ctx.lineTo(p[1].x, p[1].y);
    } else {
      for (let i = 1; i < p.length - 1; i++) {
        const mx = (p[i].x + p[i + 1].x) / 2;
        const my = (p[i].y + p[i + 1].y) / 2;
        ctx.quadraticCurveTo(p[i].x, p[i].y, mx, my);
      }
      ctx.lineTo(p[p.length - 1].x, p[p.length - 1].y);
    }
    ctx.stroke();
    ctx.restore();
  }
  for (const j of dock.jetties) {
    shadow(j, 1.5, 1.5, 0.18);
    fillStroke(j, PLANK, PLANK_EDGE, 1);
  }
  shadow(dock.quay, 1.5, 1.5, 0.2);
  fillStroke(dock.quay, PLANK, PLANK_EDGE, 1.2);
  if (dock.quay.length === 4) {
    const m1 = { x: (dock.quay[0].x + dock.quay[1].x) / 2, y: (dock.quay[0].y + dock.quay[1].y) / 2 };
    const m2 = { x: (dock.quay[2].x + dock.quay[3].x) / 2, y: (dock.quay[2].y + dock.quay[3].y) / 2 };
    ctx.strokeStyle = "rgba(60,44,28,0.4)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(m1.x, m1.y);
    ctx.lineTo(m2.x, m2.y);
    ctx.stroke();
  }
  for (const wh of dock.warehouses) {
    if (wh.length < 4)
      continue;
    shadow(wh, 1.2, 1.2, 0.22);
    fillStroke(wh, "rgb(120,92,62)", "rgba(40,28,18,0.9)", 1);
    const m1 = { x: (wh[0].x + wh[3].x) / 2, y: (wh[0].y + wh[3].y) / 2 };
    const m2 = { x: (wh[1].x + wh[2].x) / 2, y: (wh[1].y + wh[2].y) / 2 };
    ctx.strokeStyle = "rgba(70,50,32,0.8)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(m1.x, m1.y);
    ctx.lineTo(m2.x, m2.y);
    ctx.stroke();
  }
  for (const b of dock.boats) {
    const ca = Math.cos(b.angle);
    const sa = Math.sin(b.angle);
    const L = b.len;
    const Wd = b.len * 0.34;
    const hull = [
      { x: b.pos.x - ca * L * 0.5 + -sa * Wd * 0.5, y: b.pos.y - sa * L * 0.5 + ca * Wd * 0.5 },
      { x: b.pos.x - ca * L * 0.5 - -sa * Wd * 0.5, y: b.pos.y - sa * L * 0.5 - ca * Wd * 0.5 },
      { x: b.pos.x + ca * L * 0.32 - -sa * Wd * 0.5, y: b.pos.y + sa * L * 0.32 - ca * Wd * 0.5 },
      { x: b.pos.x + ca * L * 0.5, y: b.pos.y + sa * L * 0.5 },
      // bow point
      { x: b.pos.x + ca * L * 0.32 + -sa * Wd * 0.5, y: b.pos.y + sa * L * 0.32 + ca * Wd * 0.5 }
    ];
    shadow(hull, 1, 1, 0.18);
    fillStroke(hull, "rgb(124,92,60)", "rgba(40,28,18,0.9)", 1);
    ctx.strokeStyle = "rgba(40,28,18,0.55)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(b.pos.x - ca * L * 0.3, b.pos.y - sa * L * 0.3);
    ctx.lineTo(b.pos.x + ca * L * 0.2, b.pos.y + sa * L * 0.2);
    ctx.stroke();
  }
}
export function drawOutbuildings(ctx, obs) {
  const rotRect = (cx, cy, long, short, ang) => {
    const ca = Math.cos(ang);
    const sa = Math.sin(ang);
    const hl = long / 2;
    const hs = short / 2;
    const out = [];
    for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      out.push({ x: cx + sx * hl * ca - sy * hs * sa, y: cy + sx * hl * sa + sy * hs * ca });
    }
    return out;
  };
  const fillStroke = (poly, fill, stroke) => {
    ctx.fillStyle = fill;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1;
    pathPoly(ctx, poly);
    ctx.fill();
    ctx.stroke();
  };
  const shadow = (poly, ox, oy, a) => {
    ctx.fillStyle = `rgba(0,0,0,${a})`;
    ctx.beginPath();
    ctx.moveTo(poly[0].x + ox, poly[0].y + oy);
    for (let i = 1; i < poly.length; i++)
      ctx.lineTo(poly[i].x + ox, poly[i].y + oy);
    ctx.closePath();
    ctx.fill();
  };
  const ridge = (poly, col) => {
    const m1 = { x: (poly[0].x + poly[3].x) / 2, y: (poly[0].y + poly[3].y) / 2 };
    const m2 = { x: (poly[1].x + poly[2].x) / 2, y: (poly[1].y + poly[2].y) / 2 };
    ctx.strokeStyle = col;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(m1.x, m1.y);
    ctx.lineTo(m2.x, m2.y);
    ctx.stroke();
  };
  for (const ob of obs) {
    const cx = ob.centre.x;
    const cy = ob.centre.y;
    const [long, short] = ob.size;
    const ang = ob.angle;
    const ca = Math.cos(ang);
    const sa = Math.sin(ang);
    if (ob.type === "mill") {
      const body = rotRect(cx, cy, long * 0.8, short, ang);
      shadow(body, 2, 3, 0.22);
      fillStroke(body, "rgb(96,70,52)", "rgb(62,44,32)");
      ridge(body, "rgb(132,100,78)");
      const wx = cx - ca * (long * 0.5);
      const wy = cy - sa * (long * 0.5);
      const r = short * 0.5;
      ctx.fillStyle = "rgb(70,60,48)";
      ctx.strokeStyle = "rgb(40,32,24)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(wx, wy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.lineWidth = 1;
      for (let k = 0; k < 4; k++) {
        const aa = ang + k * Math.PI / 4;
        ctx.beginPath();
        ctx.moveTo(wx, wy);
        ctx.lineTo(wx + Math.cos(aa) * r, wy + Math.sin(aa) * r);
        ctx.stroke();
      }
    } else if (ob.type === "inn") {
      const body = rotRect(cx, cy, long, short, ang);
      shadow(body, 2, 3, 0.22);
      fillStroke(body, "rgb(150,140,124)", "rgb(60,52,42)");
      const roofPoly = body.map((p) => ({ x: (p.x - cx) * 0.78 + cx, y: (p.y - cy) * 0.78 + cy }));
      fillStroke(roofPoly, "rgb(120,84,60)", "rgb(78,52,36)");
      ridge(roofPoly, "rgb(150,110,82)");
      const sx = cx + ca * (long * 0.5 + 4);
      const sy = cy + sa * (long * 0.5 + 4);
      ctx.fillStyle = "rgb(90,70,50)";
      ctx.strokeStyle = "rgb(50,36,24)";
      ctx.beginPath();
      ctx.arc(sx, sy, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else if (ob.type === "stable") {
      const pad = rotRect(cx, cy, long * 1.4, short * 1.5, ang);
      ctx.strokeStyle = "rgb(96,80,58)";
      ctx.lineWidth = 1;
      pathPoly(ctx, pad);
      ctx.stroke();
      const bx = cx + ca * (long * 0.4);
      const by = cy + sa * (long * 0.4);
      const barn = rotRect(bx, by, long * 0.7, short, ang);
      shadow(barn, 2, 3, 0.2);
      fillStroke(barn, "rgb(110,92,68)", "rgb(72,58,42)");
      ridge(barn, "rgb(140,118,88)");
    } else if (ob.type === "generic") {
      const body = rotRect(cx, cy, long, short, ang);
      shadow(body, 1.5, 2.5, 0.2);
      const mid1 = { x: (body[0].x + body[1].x) / 2, y: (body[0].y + body[1].y) / 2 };
      const mid2 = { x: (body[2].x + body[3].x) / 2, y: (body[2].y + body[3].y) / 2 };
      fillStroke([body[0], mid1, mid2, body[3]], "rgb(150,116,84)", "rgb(64,46,32)");
      fillStroke([mid1, body[1], body[2], mid2], "rgb(116,86,60)", "rgb(64,46,32)");
    }
  }
}
export function drawFarms(ctx, farms) {
  const fieldFill = "rgb(201,192,166)";
  const fieldEdge = "rgb(128,116,94)";
  const furrow = "rgba(160,148,122,0.65)";
  const houseFill = "rgb(120,96,74)";
  const houseEdge = "rgb(50,36,26)";
  for (const farm of farms) {
    const poly = farm.polygon;
    if (poly.length < 3)
      continue;
    ctx.fillStyle = fieldFill;
    ctx.strokeStyle = fieldEdge;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(poly[0].x, poly[0].y);
    for (let i = 1; i < poly.length; i++)
      ctx.lineTo(poly[i].x, poly[i].y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(poly[0].x, poly[0].y);
    for (let i = 1; i < poly.length; i++)
      ctx.lineTo(poly[i].x, poly[i].y);
    ctx.closePath();
    ctx.clip();
    const ang = farm.hatchAngle;
    const dx = Math.cos(ang);
    const dy = Math.sin(ang);
    const px = -dy;
    const py = dx;
    let cx = 0, cy = 0;
    for (const q of poly) {
      cx += q.x;
      cy += q.y;
    }
    cx /= poly.length;
    cy /= poly.length;
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
    const diag = Math.hypot(maxx - minx, maxy - miny);
    ctx.strokeStyle = furrow;
    ctx.lineWidth = 1;
    const step = 4;
    for (let k = -diag / 2; k < diag / 2; k += step) {
      const ox = cx + px * k;
      const oy = cy + py * k;
      ctx.beginPath();
      ctx.moveTo(ox - dx * diag, oy - dy * diag);
      ctx.lineTo(ox + dx * diag, oy + dy * diag);
      ctx.stroke();
    }
    ctx.restore();
    if (farm.house) {
      const r = 4;
      ctx.fillStyle = "rgba(0,0,0,0.2)";
      ctx.fillRect(farm.house.x - r + 1, farm.house.y - r * 0.7 + 1, r * 2, r * 1.4);
      ctx.fillStyle = houseFill;
      ctx.strokeStyle = houseEdge;
      ctx.lineWidth = 1;
      ctx.fillRect(farm.house.x - r, farm.house.y - r * 0.7, r * 2, r * 1.4);
      ctx.strokeRect(farm.house.x - r, farm.house.y - r * 0.7, r * 2, r * 1.4);
    }
  }
}
export function drawCastle(ctx, c) {
  const bailey = c.bailey;
  if (bailey.length < 3)
    return;
  const towers = c.towers;
  const keep = c.keep;
  const gate = c.gate;
  const ground = "rgb(158,148,128)";
  const stoneDark = "rgb(48,43,38)";
  const stoneMid = "rgb(95,86,76)";
  const stoneLight = "rgb(132,122,108)";
  const roofA = "rgb(96,66,52)";
  const roofD = "rgb(66,44,34)";
  const ccx = bailey.reduce((s, p) => s + p.x, 0) / bailey.length;
  const ccy = bailey.reduce((s, p) => s + p.y, 0) / bailey.length;
  const n = bailey.length;
  if (c.approach && c.approach.length >= 2) {
    ctx.strokeStyle = "rgb(188,170,134)";
    ctx.lineWidth = 6;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    strokePolyline(ctx, c.approach);
  }
  ctx.fillStyle = "rgba(0,0,0,0.22)";
  ctx.beginPath();
  ctx.moveTo(bailey[0].x + 4, bailey[0].y + 4);
  for (let i = 1; i < n; i++)
    ctx.lineTo(bailey[i].x + 4, bailey[i].y + 4);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = ground;
  pathPoly(ctx, bailey);
  ctx.fill();
  ctx.fillStyle = stoneMid;
  ctx.strokeStyle = stoneDark;
  ctx.lineWidth = 1;
  for (let i = 0; i < n; i++) {
    const a = bailey[i];
    const b = bailey[(i + 1) % n];
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    let ix = ccx - mx;
    let iy = ccy - my;
    const d = Math.hypot(ix, iy) || 1;
    ix /= d;
    iy /= d;
    const bx = mx + ix * 11;
    const by = my + iy * 11;
    const r = 5;
    ctx.fillRect(bx - r, by - r * 0.7, r * 2, r * 1.4);
    ctx.strokeRect(bx - r, by - r * 0.7, r * 2, r * 1.4);
  }
  const gateGap = 9;
  const nearGate = (p) => gate != null && Math.hypot(p.x - gate.x, p.y - gate.y) < gateGap;
  const ring = [];
  for (let i = 0; i < n; i++) {
    const a = bailey[i];
    const b = bailey[(i + 1) % n];
    const steps = Math.max(2, Math.floor(Math.hypot(b.x - a.x, b.y - a.y) / 4));
    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      ring.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    }
  }
  const flush = (sp) => {
    if (sp.length < 2)
      return;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = stoneDark;
    ctx.lineWidth = 8;
    strokePolyline(ctx, sp);
    ctx.strokeStyle = stoneMid;
    ctx.lineWidth = 5;
    strokePolyline(ctx, sp);
    ctx.strokeStyle = stoneLight;
    ctx.lineWidth = 2;
    strokePolyline(ctx, sp);
  };
  let seg = [];
  for (let i = 0; i <= ring.length; i++) {
    const p = ring[i % ring.length];
    if (nearGate(p)) {
      flush(seg);
      seg = [];
    } else {
      seg.push(p);
    }
  }
  flush(seg);
  for (const t of towers) {
    const r = 10;
    ctx.fillStyle = "rgba(0,0,0,0.24)";
    ctx.beginPath();
    ctx.arc(t.x, t.y + 3, r + 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = stoneMid;
    ctx.strokeStyle = stoneDark;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(t.x, t.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = stoneLight;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(t.x, t.y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  if (gate) {
    const ga = c.gateAngle ?? 0;
    const ax = -Math.sin(ga);
    const ay = Math.cos(ga);
    for (const sgn of [-1, 1]) {
      const bx = gate.x + ax * gateGap * sgn;
      const by = gate.y + ay * gateGap * sgn;
      const r = 6;
      ctx.fillStyle = stoneMid;
      ctx.strokeStyle = stoneDark;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(bx, by, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = stoneLight;
      ctx.beginPath();
      ctx.arc(bx, by, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  if (keep.length >= 3) {
    const kcx = keep.reduce((s, p) => s + p.x, 0) / keep.length;
    const kcy = keep.reduce((s, p) => s + p.y, 0) / keep.length;
    const big = keep.map((p) => ({ x: (p.x - kcx) * 1.25 + kcx, y: (p.y - kcy) * 1.25 + kcy }));
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.beginPath();
    ctx.moveTo(big[0].x + 4, big[0].y + 5);
    for (let i = 1; i < big.length; i++)
      ctx.lineTo(big[i].x + 4, big[i].y + 5);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = stoneMid;
    ctx.strokeStyle = stoneDark;
    ctx.lineWidth = 1;
    pathPoly(ctx, big);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = stoneLight;
    for (const p of big) {
      const r = 4;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    const inner = big.map((p) => ({ x: (p.x - kcx) * 0.6 + kcx, y: (p.y - kcy) * 0.6 + kcy }));
    ctx.fillStyle = roofA;
    ctx.strokeStyle = roofD;
    pathPoly(ctx, inner);
    ctx.fill();
    ctx.stroke();
    if (inner.length >= 3) {
      ctx.strokeStyle = "rgb(120,88,70)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(inner[0].x, inner[0].y);
      ctx.lineTo(inner[2].x, inner[2].y);
      ctx.stroke();
    }
  }
}
export function drawCathedral(ctx, c) {
  const wallD = "rgb(54,48,40)";
  const wallL = "rgb(158,148,132)";
  const roofA = "rgb(92,62,50)";
  const roofD = "rgb(58,38,30)";
  ctx.fillStyle = "rgba(0,0,0,0.32)";
  for (const poly of [c.nave, c.transept]) {
    ctx.beginPath();
    ctx.moveTo(poly[0].x + 3.5, poly[0].y + 4.5);
    for (let i = 1; i < poly.length; i++)
      ctx.lineTo(poly[i].x + 3.5, poly[i].y + 4.5);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillStyle = wallL;
  ctx.strokeStyle = wallD;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(c.apse.pos.x, c.apse.pos.y, c.apse.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = wallL;
  ctx.lineWidth = 1.5;
  for (const poly of [c.nave, c.transept]) {
    pathPoly(ctx, poly);
    ctx.fill();
    ctx.stroke();
  }
  const insetRoof = (poly) => {
    const pcx = poly.reduce((s, p) => s + p.x, 0) / poly.length;
    const pcy = poly.reduce((s, p) => s + p.y, 0) / poly.length;
    const roof = poly.map((p) => ({ x: (p.x - pcx) * 0.74 + pcx, y: (p.y - pcy) * 0.74 + pcy }));
    ctx.fillStyle = roofA;
    ctx.strokeStyle = roofD;
    ctx.lineWidth = 1;
    pathPoly(ctx, roof);
    ctx.fill();
    ctx.stroke();
    if (roof.length === 4) {
      const m1 = { x: (roof[0].x + roof[3].x) / 2, y: (roof[0].y + roof[3].y) / 2 };
      const m2 = { x: (roof[1].x + roof[2].x) / 2, y: (roof[1].y + roof[2].y) / 2 };
      ctx.strokeStyle = "rgb(140,100,80)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(m1.x, m1.y);
      ctx.lineTo(m2.x, m2.y);
      ctx.stroke();
    }
  };
  insetRoof(c.nave);
  insetRoof(c.transept);
  const crx = c.transept.reduce((s, p) => s + p.x, 0) / c.transept.length;
  const cry = c.transept.reduce((s, p) => s + p.y, 0) / c.transept.length;
  ctx.fillStyle = wallL;
  ctx.strokeStyle = wallD;
  ctx.lineWidth = 1.5;
  ctx.fillRect(crx - 5, cry - 5, 10, 10);
  ctx.strokeRect(crx - 5, cry - 5, 10, 10);
}
export function drawMarket(ctx, c) {
  const paving = "rgb(224,212,182)";
  const pavingEdge = "rgb(120,108,88)";
  const stallCols = ["rgb(160,92,62)", "rgb(96,118,88)", "rgb(110,100,126)", "rgb(176,144,88)"];
  const stallEdge = "rgb(55,44,34)";
  ctx.fillStyle = paving;
  ctx.strokeStyle = pavingEdge;
  ctx.lineWidth = 2;
  pathPoly(ctx, c.plaza);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = stallEdge;
  ctx.lineWidth = 1;
  for (let i = 0; i < c.stalls.length; i++) {
    const stall = c.stalls[i];
    if (stall.length < 3)
      continue;
    ctx.fillStyle = stallCols[i % stallCols.length];
    pathPoly(ctx, stall);
    ctx.fill();
    ctx.stroke();
  }
  ctx.fillStyle = "rgb(150,140,124)";
  ctx.strokeStyle = "rgb(55,44,34)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(c.feature.pos.x, c.feature.pos.y, c.feature.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}
export function drawBarracks(ctx, c) {
  const yardFill = "rgb(168,158,140)";
  const yardEdge = "rgb(70,62,50)";
  const hallFill = "rgb(120,104,86)";
  const hallRoof = "rgb(86,72,58)";
  const hallEdge = "rgb(48,38,28)";
  ctx.fillStyle = "rgba(0,0,0,0.20)";
  ctx.beginPath();
  ctx.moveTo(c.yard[0].x + 3, c.yard[0].y + 4);
  for (let i = 1; i < c.yard.length; i++)
    ctx.lineTo(c.yard[i].x + 3, c.yard[i].y + 4);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = yardFill;
  ctx.strokeStyle = yardEdge;
  ctx.lineWidth = 2;
  pathPoly(ctx, c.yard);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = "rgba(70,62,50,0.6)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(c.drill.pos.x, c.drill.pos.y, c.drill.r, 0, Math.PI * 2);
  ctx.stroke();
  for (const hall of c.halls) {
    if (hall.length < 3)
      continue;
    ctx.fillStyle = "rgba(0,0,0,0.18)";
    ctx.beginPath();
    ctx.moveTo(hall[0].x + 1.5, hall[0].y + 2);
    for (let i = 1; i < hall.length; i++)
      ctx.lineTo(hall[i].x + 1.5, hall[i].y + 2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = hallFill;
    ctx.strokeStyle = hallEdge;
    ctx.lineWidth = 1;
    pathPoly(ctx, hall);
    ctx.fill();
    ctx.stroke();
    if (hall.length === 4) {
      const m1 = { x: (hall[0].x + hall[3].x) / 2, y: (hall[0].y + hall[3].y) / 2 };
      const m2 = { x: (hall[1].x + hall[2].x) / 2, y: (hall[1].y + hall[2].y) / 2 };
      ctx.strokeStyle = hallRoof;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(m1.x, m1.y);
      ctx.lineTo(m2.x, m2.y);
      ctx.stroke();
    }
  }
}
export function drawTower(ctx, t) {
  const cx = t.centre.x, cy = t.centre.y, r = t.radius;
  if (t.lane && t.lane.length >= 2) {
    ctx.strokeStyle = ROAD_COL;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = 3;
    strokePolyline(ctx, t.lane);
  }
  ctx.fillStyle = "rgba(0,0,0,0.22)";
  ctx.beginPath();
  ctx.ellipse(cx + 2.5, cy + 3, r * 1.02, r * 0.92, 0, 0, Math.PI * 2);
  ctx.fill();
  const stoneFill = "rgb(150,144,150)";
  const stoneEdge = "rgb(70,64,74)";
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = stoneFill;
  ctx.fill();
  ctx.strokeStyle = stoneEdge;
  ctx.lineWidth = 1.4;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx - r * 0.12, cy - r * 0.14, r * 0.66, 0, Math.PI * 2);
  ctx.fillStyle = "rgb(168,162,168)";
  ctx.fill();
  ctx.strokeStyle = stoneEdge;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx - r * 0.12, cy - r * 0.14, r * 0.38, 0, Math.PI * 2);
  ctx.fillStyle = "rgb(74,58,104)";
  ctx.fill();
  ctx.strokeStyle = "rgb(44,32,66)";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx - r * 0.12, cy - r * 0.14, Math.max(1.2, r * 0.12), 0, Math.PI * 2);
  ctx.fillStyle = "rgba(150,130,210,0.85)";
  ctx.fill();
}
export function drawSmallHouse(ctx, centre, size, angle) {
  const [long, short] = size;
  const hl = long / 2;
  const hs = short / 2;
  const ca = Math.cos(angle);
  const sa = Math.sin(angle);
  const pt = (sx, sy) => ({
    x: centre.x + sx * hl * ca - sy * hs * sa,
    y: centre.y + sx * hl * sa + sy * hs * ca
  });
  const f1 = pt(-1, -1);
  const f2 = pt(1, -1);
  const f3 = pt(1, 1);
  const f4 = pt(-1, 1);
  ctx.fillStyle = "rgba(0,0,0,0.20)";
  ctx.beginPath();
  ctx.moveTo(f1.x + 1.6, f1.y + 1.6);
  ctx.lineTo(f2.x + 1.6, f2.y + 1.6);
  ctx.lineTo(f3.x + 1.6, f3.y + 1.6);
  ctx.lineTo(f4.x + 1.6, f4.y + 1.6);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "rgb(214,196,164)";
  ctx.beginPath();
  ctx.moveTo(f1.x, f1.y);
  ctx.lineTo(f2.x, f2.y);
  ctx.lineTo(f3.x, f3.y);
  ctx.lineTo(f4.x, f4.y);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(60,42,30,0.85)";
  ctx.lineWidth = 0.8;
  ctx.stroke();
  const inset = 0.18;
  const r1 = pt(-1 + inset * 0.5, -1 + inset);
  const r2 = pt(1 - inset * 0.5, -1 + inset);
  const r3 = pt(1 - inset * 0.5, 1 - inset);
  const r4 = pt(-1 + inset * 0.5, 1 - inset);
  const ridgeA = pt(-1 + inset * 0.5, 0);
  const ridgeB = pt(1 - inset * 0.5, 0);
  const seed = Math.floor(Math.abs(centre.x * 7.3 + centre.y * 13.7));
  const [light, dark] = pickRoofColours(seed);
  ctx.fillStyle = rgbLift(light, 18);
  ctx.beginPath();
  ctx.moveTo(r1.x, r1.y);
  ctx.lineTo(r2.x, r2.y);
  ctx.lineTo(ridgeB.x, ridgeB.y);
  ctx.lineTo(ridgeA.x, ridgeA.y);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = rgb(dark);
  ctx.beginPath();
  ctx.moveTo(ridgeA.x, ridgeA.y);
  ctx.lineTo(ridgeB.x, ridgeB.y);
  ctx.lineTo(r3.x, r3.y);
  ctx.lineTo(r4.x, r4.y);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(48,26,20,0.85)";
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  ctx.moveTo(r1.x, r1.y);
  ctx.lineTo(r2.x, r2.y);
  ctx.lineTo(r3.x, r3.y);
  ctx.lineTo(r4.x, r4.y);
  ctx.closePath();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(ridgeA.x, ridgeA.y);
  ctx.lineTo(ridgeB.x, ridgeB.y);
  ctx.stroke();
}
