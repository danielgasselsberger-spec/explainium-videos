import React, { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { clamp, noise3, rng } from "./lib";

// ---------- gradient backdrop sphere ----------
export const Backdrop: React.FC<{ top: string; bottom: string; radius?: number }> = ({ top, bottom, radius = 120 }) => {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: { top: { value: new THREE.Color(top) }, bottom: { value: new THREE.Color(bottom) } },
        vertexShader: `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0);} `,
        fragmentShader: `uniform vec3 top; uniform vec3 bottom; varying vec3 vP;
          void main(){ float h = smoothstep(-0.6, 0.7, vP.y); gl_FragColor = vec4(mix(bottom, top, h), 1.0);
          #include <colorspace_fragment>
          }`,
      }),
    [],
  );
  mat.uniforms.top.value.set(top);
  mat.uniforms.bottom.value.set(bottom);
  return (
    <mesh material={mat} renderOrder={-10} frustumCulled={false}>
      <sphereGeometry args={[radius, 32, 16]} />
    </mesh>
  );
};

// ---------- red blood cell geometry (biconcave disc) ----------
let _rbcGeo: THREE.BufferGeometry | null = null;
export function rbcGeometry() {
  if (_rbcGeo) return _rbcGeo;
  const pts: THREE.Vector2[] = [];
  const N = 24;
  const prof = (x: number) => 0.5 * Math.sqrt(Math.max(0, 1 - x * x)) * (0.207 + 2.003 * x * x - 1.123 * x ** 4);
  for (let i = 0; i <= N; i++) { const x = i / N; pts.push(new THREE.Vector2(x * 0.999, -prof(x) - 0.02 * (1 - x))); }
  for (let i = N; i >= 0; i--) { const x = i / N; pts.push(new THREE.Vector2(x * 0.999, prof(x) + 0.02 * (1 - x))); }
  _rbcGeo = new THREE.LatheGeometry(pts, 40);
  _rbcGeo.computeVertexNormals();
  return _rbcGeo;
}

export type Inst = { p: THREE.Vector3; r: THREE.Euler | THREE.Quaternion; s: number | THREE.Vector3; c?: THREE.Color | string };

// generic instanced mesh driven by an array of transforms each frame
export const Instances: React.FC<{
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  items: Inst[];
  max?: number;
}> = ({ geometry, material, items, max = 600 }) => {
  const ref = useRef<THREE.InstancedMesh>(null);
  const tmp = useMemo(() => new THREE.Object3D(), []);
  const col = useMemo(() => new THREE.Color(), []);
  useLayoutEffect(() => {
    const m = ref.current!;
    const n = Math.min(items.length, max);
    for (let i = 0; i < n; i++) {
      const it = items[i];
      tmp.position.copy(it.p);
      if (it.r instanceof THREE.Quaternion) tmp.quaternion.copy(it.r); else tmp.rotation.copy(it.r);
      if (typeof it.s === "number") tmp.scale.setScalar(it.s); else tmp.scale.copy(it.s);
      tmp.updateMatrix();
      m.setMatrixAt(i, tmp.matrix);
      if (it.c !== undefined) m.setColorAt(i, typeof it.c === "string" ? col.set(it.c) : it.c);
    }
    m.count = n;
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  });
  return <instancedMesh ref={ref} args={[geometry, material, max]} frustumCulled={false} />;
};

export function useRbcMaterial(opts: { emissive?: string; emissiveIntensity?: number } = {}) {
  return useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: "#ffffff",
        roughness: 0.32,
        clearcoat: 0.8,
        clearcoatRoughness: 0.25,
        sheen: 0.6,
        sheenColor: new THREE.Color("#ff9db0"),
        emissive: new THREE.Color(opts.emissive ?? "#5a0010"),
        emissiveIntensity: opts.emissiveIntensity ?? 0.6,
      }),
    [],
  );
}

// ---------- blob geometry (displaced icosphere) ----------
export function blobGeometry(seed: number, amp = 0.18, detail = 4, freq = 1.6) {
  const g = mergeVertices(new THREE.IcosahedronGeometry(1, detail).deleteAttribute("normal").deleteAttribute("uv"));
  const p = g.attributes.position as THREE.BufferAttribute;
  const o = seed * 13.1;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const n = 1 + amp * noise3(x * freq + o, y * freq - o, z * freq + o * 0.5);
    p.setXYZ(i, x * n, y * n, z * n);
  }
  g.computeVertexNormals();
  return g;
}

// animated blob: re-displace every frame
export const LiveBlob: React.FC<{ t: number; seed: number; amp?: number; freq?: number; speed?: number; material: THREE.Material; position?: any; scale?: any; detail?: number; pseudo?: THREE.Vector3[] }> = ({
  t, seed, amp = 0.15, freq = 1.4, speed = 1, material, position, scale, detail = 5, pseudo = [],
}) => {
  const base = useMemo(() => mergeVertices(new THREE.IcosahedronGeometry(1, detail).deleteAttribute("normal").deleteAttribute("uv")), [detail]);
  const geo = useMemo(() => base.clone(), [base]);
  useLayoutEffect(() => {
    const b = base.attributes.position as THREE.BufferAttribute;
    const p = geo.attributes.position as THREE.BufferAttribute;
    const o = seed * 7.7;
    const dir = new THREE.Vector3();
    for (let i = 0; i < b.count; i++) {
      const x = b.getX(i), y = b.getY(i), z = b.getZ(i);
      let n = 1 + amp * noise3(x * freq + o + t * 0.6 * speed, y * freq + t * 0.45 * speed, z * freq - o - t * 0.5 * speed);
      dir.set(x, y, z);
      for (const ps of pseudo) {
        const d = dir.dot(ps.clone().normalize());
        if (d > 0.6) n += ps.length() * Math.pow((d - 0.6) / 0.4, 2.2);
      }
      p.setXYZ(i, x * n, y * n, z * n);
    }
    p.needsUpdate = true;
    geo.computeVertexNormals();
  });
  return <mesh geometry={geo} material={material} position={position} scale={scale} />;
};

// ---------- floating bokeh particles for depth ----------
export const Motes: React.FC<{ t: number; count?: number; spread?: number; color?: string; seed?: number; size?: number; center?: [number, number, number]; opacity?: number }> = ({
  t, count = 60, spread = 20, color = "#ffd1ec", seed = 3, size = 0.08, center = [0, 0, 0], opacity = 0.8,
}) => {
  const base = useMemo(() => {
    const r = rng(seed);
    return Array.from({ length: count }, () => ({ p: new THREE.Vector3((r() - 0.5) * spread, (r() - 0.5) * spread, (r() - 0.5) * spread), s: size * (0.4 + r() * 1.2), ph: r() * 10 }));
  }, [count, spread, seed, size]);
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, toneMapped: false, depthWrite: false }), [color, opacity]);
  const geo = useMemo(() => new THREE.SphereGeometry(1, 10, 8), []);
  const items = base.map((b) => ({
    p: new THREE.Vector3(center[0] + b.p.x + Math.sin(t * 0.5 + b.ph) * 0.4, center[1] + b.p.y + Math.cos(t * 0.4 + b.ph) * 0.4, center[2] + b.p.z),
    r: new THREE.Euler(),
    s: b.s,
  }));
  return <Instances geometry={geo} material={mat} items={items} max={count} />;
};

// tube along points
export function tubeGeo(points: THREE.Vector3[], radius: number, seg = 120, radial = 24) {
  const curve = new THREE.CatmullRomCurve3(points);
  return { curve, geo: new THREE.TubeGeometry(curve, seg, radius, radial, false) };
}

// soft glow sprite (radial gradient texture)
let _glowTex: THREE.Texture | null = null;
export function glowTexture() {
  if (_glowTex) return _glowTex;
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, "rgba(255,255,255,1)");
  gr.addColorStop(0.3, "rgba(255,255,255,0.5)");
  gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr;
  g.fillRect(0, 0, 128, 128);
  _glowTex = new THREE.CanvasTexture(c);
  return _glowTex;
}
export const Glow: React.FC<{ position: any; scale: number; color: string; opacity?: number }> = ({ position, scale, color, opacity = 1 }) => (
  <sprite position={position} scale={[scale, scale, scale]}>
    <spriteMaterial map={glowTexture()} color={color} transparent opacity={clamp(opacity)} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
  </sprite>
);

// orient helper: quaternion that maps +Y to dir
export function quatFromY(dir: THREE.Vector3) {
  return new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
}
