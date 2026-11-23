import * as THREE from "three";
export const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const smooth = (t: number) => { t = clamp(t); return t * t * (3 - 2 * t); };
export const easeInOut = (t: number) => { t = clamp(t); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
export const easeOut = (t: number) => 1 - Math.pow(1 - clamp(t), 3);
export const easeIn = (t: number) => Math.pow(clamp(t), 3);
export const range = (t: number, a: number, b: number) => clamp((t - a) / (b - a));
export function rng(seed: number) {
  let s = seed >>> 0;
  return () => { s += 0x6d2b79f5; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export const v3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
export const lerpV = (a: number[], b: number[], t: number) => a.map((x, i) => lerp(x, b[i], t)) as [number, number, number];
export function mixColor(stops: [number, string][], t: number) {
  const c = new THREE.Color();
  if (t <= stops[0][0]) return c.set(stops[0][1]);
  for (let i = 0; i < stops.length - 1; i++) {
    const [a, ca] = stops[i]; const [b, cb] = stops[i + 1];
    if (t <= b) return c.set(ca).lerp(new THREE.Color(cb), smooth((t - a) / (b - a)));
  }
  return c.set(stops[stops.length - 1][1]);
}
// cheap smooth 3D noise (sum of sines) — deterministic
export function noise3(x: number, y: number, z: number) {
  return (Math.sin(x * 1.7 + Math.sin(y * 2.3) * 1.3) * Math.cos(y * 1.9 + Math.sin(z * 1.1) * 1.7) +
    Math.sin(z * 2.1 + Math.cos(x * 1.3) * 1.5) * 0.6 + Math.sin((x + y + z) * 3.1) * 0.25) / 1.85;
}
// bruise colour over the healing stage 0..1
export const bruiseStops: [number, string][] = [
  [0, "#e8506a"], [0.12, "#d8203f"], [0.3, "#7a2ab8"], [0.42, "#4a3ad0"], [0.6, "#6b8f2a"], [0.75, "#c9b42a"], [0.9, "#e8c87a"], [1, "#f2b48f"],
];
