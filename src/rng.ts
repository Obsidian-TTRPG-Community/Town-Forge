export function hash32(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}
export function makeRng(seed) {
  let a = seed >>> 0;
  return function() {
    a = a + 1831565813 >>> 0;
    let t = a;
    t = Math.imul(t ^ t >>> 15, 1 | t) >>> 0;
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    t = t >>> 0;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
export var Noise2D = class {
  constructor(rng) {
    const N = 256;
    const p = [];
    for (let i = 0; i < N; i++)
      p.push(i);
    for (let i = N - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const tmp = p[i];
      p[i] = p[j];
      p[j] = tmp;
    }
    this.perm = p.concat(p);
    this.grad = [];
    for (let i = 0; i < N; i++)
      this.grad.push(rng() * 2 - 1);
  }
  _v(ix, iy) {
    return this.grad[this.perm[ix + this.perm[iy & 255] & 255]];
  }
  sample(x, y) {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = x - ix;
    const fy = y - iy;
    const u = fx * fx * (3 - 2 * fx);
    const v = fy * fy * (3 - 2 * fy);
    const a = this._v(ix, iy);
    const b = this._v(ix + 1, iy);
    const c = this._v(ix, iy + 1);
    const d = this._v(ix + 1, iy + 1);
    return a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v;
  }
  fbm(x, y, octaves, persistence) {
    let amp = 1;
    let freq = 1;
    let total = 0;
    let norm = 0;
    for (let i = 0; i < octaves; i++) {
      total += amp * this.sample(x * freq, y * freq);
      norm += amp;
      amp *= persistence;
      freq *= 2;
    }
    return total / norm;
  }
};
