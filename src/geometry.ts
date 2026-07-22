export function smoothPolyline(pts, iters = 2) {
  let out = pts;
  for (let k = 0; k < iters; k++) {
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
export function smoothClosed(pts, iters = 2) {
  let out = pts;
  for (let k = 0; k < iters; k++) {
    const nxt = [];
    for (let i = 0; i < out.length; i++) {
      const a = out[i];
      const b = out[(i + 1) % out.length];
      nxt.push({ x: 0.75 * a.x + 0.25 * b.x, y: 0.75 * a.y + 0.25 * b.y });
      nxt.push({ x: 0.25 * a.x + 0.75 * b.x, y: 0.25 * a.y + 0.75 * b.y });
    }
    out = nxt;
  }
  return out;
}
export function offsetPolyline(pts, dist) {
  const left = [];
  const right = [];
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const prev = pts[Math.max(0, i - 1)];
    const next = pts[Math.min(pts.length - 1, i + 1)];
    const tx = next.x - prev.x;
    const ty = next.y - prev.y;
    const tl = Math.hypot(tx, ty) || 1;
    const nx = -ty / tl;
    const ny = tx / tl;
    left.push({ x: p.x + nx * dist, y: p.y + ny * dist });
    right.push({ x: p.x - nx * dist, y: p.y - ny * dist });
  }
  return left.concat(right.reverse());
}
export function pointInPolygon(pt, poly) {
  const x = pt.x;
  const y = pt.y;
  let inside = false;
  let j = poly.length - 1;
  for (let i = 0; i < poly.length; i++) {
    const xi = poly[i].x;
    const yi = poly[i].y;
    const xj = poly[j].x;
    const yj = poly[j].y;
    if (yi > y !== yj > y && x < (xj - xi) * (y - yi) / (yj - yi + 1e-9) + xi) {
      inside = !inside;
    }
    j = i;
  }
  return inside;
}
export function pointInPolygonNonzero(pt, poly) {
  const x = pt.x;
  const y = pt.y;
  let wind = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    if (a.y <= y) {
      if (b.y > y && (b.x - a.x) * (y - a.y) - (x - a.x) * (b.y - a.y) > 0)
        wind++;
    } else {
      if (b.y <= y && (b.x - a.x) * (y - a.y) - (x - a.x) * (b.y - a.y) < 0)
        wind--;
    }
  }
  return wind !== 0;
}
