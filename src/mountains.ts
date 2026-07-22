export function makeFieldNoise(seed) {
  const perm = new Uint8Array(512);
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++)
    p[i] = i;
  let s = seed >>> 0;
  for (let i = 255; i > 0; i--) {
    s = s * 1664525 + 1013904223 >>> 0;
    const j = s % (i + 1);
    const t = p[i];
    p[i] = p[j];
    p[j] = t;
  }
  for (let i = 0; i < 512; i++)
    perm[i] = p[i & 255];
  const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  const lerp = (a, b, t) => a + t * (b - a);
  const grad = (hh, x, y) => (hh & 1 ? x : -x) + (hh & 2 ? y : -y);
  return (x, y) => {
    const X = Math.floor(x) & 255, Y = Math.floor(y) & 255;
    const xf = x - Math.floor(x), yf = y - Math.floor(y);
    const u = fade(xf), v = fade(yf);
    const aa = perm[perm[X] + Y], ab = perm[perm[X] + Y + 1];
    const ba = perm[perm[X + 1] + Y], bb = perm[perm[X + 1] + Y + 1];
    return (lerp(
      lerp(grad(aa, xf, yf), grad(ba, xf - 1, yf), u),
      lerp(grad(ab, xf, yf - 1), grad(bb, xf - 1, yf - 1), u),
      v
    ) + 1) * 0.5;
  };
}
export function densifySpine(ctrl, samples = 28) {
  if (ctrl.length < 2)
    return ctrl.slice();
  const out = [];
  for (let i = 0; i < ctrl.length - 1; i++) {
    const p0 = ctrl[i - 1] || ctrl[i], p1 = ctrl[i], p2 = ctrl[i + 1], p3 = ctrl[i + 2] || ctrl[i + 1];
    for (let j = 0; j < samples; j++) {
      const t = j / samples, t2 = t * t, t3 = t2 * t;
      const x = 0.5 * (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3);
      const y = 0.5 * (2 * p1.y + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3);
      const w = p1.w + (p2.w - p1.w) * t, h = p1.h + (p2.h - p1.h) * t;
      out.push({ x, y, w, h });
    }
  }
  out.push({ ...ctrl[ctrl.length - 1] });
  return out;
}
export function smax(a, b, k) {
  if (a <= 0)
    return b;
  if (b <= 0)
    return a;
  const hh = Math.max(0, 1 - Math.abs(a - b) / k);
  return Math.max(a, b) + hh * hh * k * 0.25;
}
export function buildHeightField(mtn, cell = 4, pad = 44, avoidWater) {
  const noise = makeFieldNoise(mtn.seed);
  let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
  for (const sp of mtn.spines)
    for (const pt of sp) {
      const r = pt.w * 1.6;
      minx = Math.min(minx, pt.x - r);
      miny = Math.min(miny, pt.y - r);
      maxx = Math.max(maxx, pt.x + r);
      maxy = Math.max(maxy, pt.y + r);
    }
  minx -= pad;
  miny -= pad;
  maxx += pad;
  maxy += pad;
  const GW = Math.ceil((maxx - minx) / cell) + 1;
  const GH = Math.ceil((maxy - miny) / cell) + 1;
  const H = new Float32Array(GW * GH);
  const crag = mtn.crag, widthVar = mtn.widthVar, k = mtn.k;
  let maxH = 0;
  for (const sp of mtn.spines)
    for (const pt of sp)
      if (pt.h > maxH)
        maxH = pt.h;
  const spineSegs = mtn.spines.map((sp) => {
    const segs = [];
    let cum = 0;
    for (let i = 0; i < sp.length - 1; i++) {
      const a = sp[i], b = sp[i + 1];
      const ex = b.x - a.x, ey = b.y - a.y;
      const s2 = ex * ex + ey * ey || 1;
      const segLen = Math.sqrt(s2);
      segs.push({ ax: a.x, ay: a.y, ex, ey, invS2: 1 / s2, segLen, cum, aw: a.w, dw: b.w - a.w, ah: a.h, dh: b.h - a.h });
      cum += segLen;
    }
    return segs;
  });
  const sample = (x, y) => {
    let acc = 0;
    for (let si = 0; si < spineSegs.length; si++) {
      const segs = spineSegs[si];
      let bestSq = Infinity, bw = 30, bh = 1, along = 0, side = 1;
      for (let i = 0; i < segs.length; i++) {
        const s = segs[i];
        let t = ((x - s.ax) * s.ex + (y - s.ay) * s.ey) * s.invS2;
        if (t < 0)
          t = 0;
        else if (t > 1)
          t = 1;
        const qx = s.ax + s.ex * t, qy = s.ay + s.ey * t;
        const ddx = x - qx, ddy = y - qy;
        const dSq = ddx * ddx + ddy * ddy;
        if (dSq < bestSq) {
          bestSq = dSq;
          bw = s.aw + s.dw * t;
          bh = s.ah + s.dh * t;
          along = s.cum + t * s.segLen;
          side = (x - s.ax) * s.ey - (y - s.ay) * s.ex < 0 ? -1 : 1;
        }
      }
      const best = Math.sqrt(bestSq);
      const wN = noise(along * 0.01 + si * 10, 7.3);
      const wNa = noise(along * 0.02 + si * 4, side > 0 ? 2.1 : 9.7);
      const wEff = bw * (1 - widthVar * 0.5 + widthVar * (0.4 * wN + 0.6 * wNa) * 1.4);
      if (best < wEff * 1.25) {
        const nd = Math.max(0, 1 - best / wEff);
        let height = bh * Math.pow(nd, 0.9);
        const ridge = noise(x * 0.02, y * 0.02) * 0.6 + noise(x * 0.05, y * 0.05) * 0.4;
        height *= 1 - crag * 0.45 + crag * 0.9 * ridge;
        height += (ridge - 0.5) * 0.08 * bh;
        height = Math.max(0, Math.min(bh, height));
        acc = smax(acc, height, k);
      }
    }
    return acc;
  };
  let waterMask = null;
  if (avoidWater && avoidWater.length >= 3) {
    let wbx0 = Infinity, wby0 = Infinity, wbx1 = -Infinity, wby1 = -Infinity;
    for (const p of avoidWater) {
      if (p.x < wbx0)
        wbx0 = p.x;
      if (p.y < wby0)
        wby0 = p.y;
      if (p.x > wbx1)
        wbx1 = p.x;
      if (p.y > wby1)
        wby1 = p.y;
    }
    const fieldX1 = minx + GW * cell, fieldY1 = miny + GH * cell;
    const overlaps = !(wbx1 < minx || wbx0 > fieldX1 || wby1 < miny || wby0 > fieldY1);
    if (overlaps) {
      waterMask = new Uint8Array(GW * GH);
      for (let gy = 0; gy < GH; gy++) {
        const yy = miny + gy * cell;
        for (let gx = 0; gx < GW; gx++) {
          const xx = minx + gx * cell;
          waterMask[gy * GW + gx] = pointInPoly(xx, yy, avoidWater) ? 1 : 0;
        }
      }
    }
  }
  for (let gy = 0; gy < GH; gy++) {
    for (let gx = 0; gx < GW; gx++) {
      const x = minx + gx * cell, y = miny + gy * cell;
      let v = sample(x, y);
      if (v > 0 && waterMask) {
        const gi = gy * GW + gx;
        if (waterMask[gi])
          v = 0;
        else {
          let wet = 0, tot = 0;
          for (let dy = -1; dy <= 1; dy++) {
            const ny = gy + dy;
            if (ny < 0 || ny >= GH)
              continue;
            for (let dx = -1; dx <= 1; dx++) {
              if (dx === 0 && dy === 0)
                continue;
              const nx = gx + dx;
              if (nx < 0 || nx >= GW)
                continue;
              tot++;
              if (waterMask[ny * GW + nx])
                wet++;
            }
          }
          if (wet > 0) {
            const frac = wet / tot;
            v *= Math.max(0, 1 - frac * 1.6);
          }
        }
      }
      H[gy * GW + gx] = v;
    }
  }
  return { H, GW, GH, cell, minx, miny, maxH };
}
export function pointInPoly(x, y, poly) {
  let ins = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    if (poly[i].y > y !== poly[j].y > y && x < (poly[j].x - poly[i].x) * (y - poly[i].y) / (poly[j].y - poly[i].y) + poly[i].x)
      ins = !ins;
  }
  return ins;
}
export function contourSegments(field, L) {
  const { H, GW, GH, cell, minx, miny } = field;
  const segs = [];
  const val = (gx, gy) => H[gy * GW + gx];
  const ip = (x1, y1, v1, x2, y2, v2) => {
    const t = (L - v1) / (v2 - v1 || 1e-9);
    return { x: x1 + t * (x2 - x1), y: y1 + t * (y2 - y1) };
  };
  for (let gy = 0; gy < GH - 1; gy++) {
    for (let gx = 0; gx < GW - 1; gx++) {
      const x0 = minx + gx * cell, y0 = miny + gy * cell, x1 = x0 + cell, y1 = y0 + cell;
      const tl = val(gx, gy), tr = val(gx + 1, gy), br = val(gx + 1, gy + 1), bl = val(gx, gy + 1);
      let idx = 0;
      if (tl > L)
        idx |= 8;
      if (tr > L)
        idx |= 4;
      if (br > L)
        idx |= 2;
      if (bl > L)
        idx |= 1;
      if (idx === 0 || idx === 15)
        continue;
      const top = () => ip(x0, y0, tl, x1, y0, tr);
      const right = () => ip(x1, y0, tr, x1, y1, br);
      const bottom = () => ip(x0, y1, bl, x1, y1, br);
      const left = () => ip(x0, y0, tl, x0, y1, bl);
      const ps = (a, b) => segs.push([a, b]);
      switch (idx) {
        case 1:
          ps(left(), bottom());
          break;
        case 2:
          ps(bottom(), right());
          break;
        case 3:
          ps(left(), right());
          break;
        case 4:
          ps(top(), right());
          break;
        case 5:
          ps(left(), top());
          ps(bottom(), right());
          break;
        case 6:
          ps(top(), bottom());
          break;
        case 7:
          ps(left(), top());
          break;
        case 8:
          ps(left(), top());
          break;
        case 9:
          ps(top(), bottom());
          break;
        case 10:
          ps(left(), bottom());
          ps(top(), right());
          break;
        case 11:
          ps(top(), right());
          break;
        case 12:
          ps(left(), right());
          break;
        case 13:
          ps(bottom(), right());
          break;
        case 14:
          ps(left(), bottom());
          break;
      }
    }
  }
  return segs;
}
export function hillshadeAt(field, x, y) {
  const { H, GW, GH, cell, minx, miny } = field;
  const gx = Math.round((x - minx) / cell), gy = Math.round((y - miny) / cell);
  if (gx < 1 || gy < 1 || gx >= GW - 1 || gy >= GH - 1)
    return 0.5;
  const dzdx = (H[gy * GW + gx + 1] - H[gy * GW + gx - 1]) / 2;
  const dzdy = (H[(gy + 1) * GW + gx] - H[(gy - 1) * GW + gx]) / 2;
  const nx = -dzdx * 26, ny = -dzdy * 26, nz = 1;
  const nl = Math.hypot(nx, ny, nz) || 1;
  return Math.max(0, Math.min(1, 0.5 + (nx * -0.7 + ny * -0.7 + nz * 0.5) / nl * 0.8));
}
export function footprintPolygon(field, level = 0.04) {
  const L = level * field.maxH;
  const segs = contourSegments(field, L);
  if (!segs.length)
    return [];
  const used = new Array(segs.length).fill(false);
  const key = (p) => `${Math.round(p.x)},${Math.round(p.y)}`;
  const startMap = /* @__PURE__ */ new Map();
  for (let i = 0; i < segs.length; i++) {
    for (const p of segs[i]) {
      const kk = key(p);
      if (!startMap.has(kk))
        startMap.set(kk, []);
      startMap.get(kk).push(i);
    }
  }
  let bestLoop = [];
  for (let i = 0; i < segs.length; i++) {
    if (used[i])
      continue;
    const loop = [segs[i][0], segs[i][1]];
    used[i] = true;
    let guard = 0;
    while (guard++ < segs.length * 2) {
      const tail = loop[loop.length - 1];
      const cand = startMap.get(key(tail)) || [];
      let found = -1;
      for (const ci of cand) {
        if (used[ci])
          continue;
        const [a, b] = segs[ci];
        if (key(a) === key(tail)) {
          loop.push(b);
          used[ci] = true;
          found = ci;
          break;
        }
        if (key(b) === key(tail)) {
          loop.push(a);
          used[ci] = true;
          found = ci;
          break;
        }
      }
      if (found < 0)
        break;
    }
    if (loop.length > bestLoop.length)
      bestLoop = loop;
  }
  if (bestLoop.length > 60) {
    const step = Math.ceil(bestLoop.length / 60);
    bestLoop = bestLoop.filter((_, i) => i % step === 0);
  }
  return bestLoop;
}
