import React, { useMemo } from "react";
import * as THREE from "three";
import { Cam, MacroLights, Post } from "./common";
import { Backdrop, Glow, glowTexture, Inst, Instances, LiveBlob, Motes, blobGeometry, rbcGeometry, tubeGeo, useRbcMaterial } from "./prims";
import { clamp, easeIn, easeInOut, easeOut, lerp, lerpV, mixColor, noise3, range, rng, smooth } from "../lib";

type S = { t: number; d: number; gt: number };
const dist = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

const World: React.FC<{ cam: { pos: number[]; target: number[]; fov?: number; roll?: number }; t: number; top?: string; bottom?: string; tint?: string; rim?: string; bloom?: number; focus?: number; bokeh?: number; shake?: number; children: React.ReactNode; fog?: string; fogNear?: number; fogFar?: number }> = ({
  cam, t, top = "#a0157a", bottom = "#2a0752", tint, rim, bloom = 1.1, focus, bokeh = 5, shake = 0, children, fog, fogNear = 8, fogFar = 40,
}) => (
  <>
    <Backdrop top={top} bottom={bottom} />
    {fog && <fog attach="fog" args={[fog, fogNear, fogFar]} />}
    <MacroLights tint={tint} rim={rim} />
    <Cam {...cam} t={t} shake={shake} />
    {children}
    <Post focus={focus ?? dist(cam.pos, cam.target)} bokeh={bokeh} bloom={bloom} />
  </>
);

// ---------- background tissue cells (soft blurry blobs) ----------
const TissueBg: React.FC<{ t: number; seed?: number; color?: string; z?: number; count?: number; spread?: number; size?: number }> = ({ t, seed = 1, color = "#ff8fc8", z = -12, count = 14, spread = 26, size = 2.4 }) => {
  const geos = useMemo(() => [0, 1, 2].map((i) => blobGeometry(seed + i, 0.22, 3)), [seed]);
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color, roughness: 0.5, emissive: new THREE.Color(color), emissiveIntensity: 0.25, transparent: true, opacity: 0.85 }), [color]);
  const nuc = useMemo(() => new THREE.MeshStandardMaterial({ color: "#8a2be2", roughness: 0.4, emissive: new THREE.Color("#5a12a0"), emissiveIntensity: 0.5 }), []);
  const items = useMemo(() => {
    const r = rng(seed * 31);
    return Array.from({ length: count }, () => ({ x: (r() - 0.5) * spread, y: (r() - 0.5) * spread * 1.4, z: z + (r() - 0.5) * 8, s: size * (0.6 + r() * 0.8), g: Math.floor(r() * 3), ph: r() * 6 }));
  }, [seed, count, spread, z, size]);
  return (
    <>
      {items.map((it, i) => (
        <group key={i} position={[it.x, it.y + Math.sin(t * 0.6 + it.ph) * 0.2, it.z]} scale={it.s}>
          <mesh geometry={geos[it.g]} material={mat} />
          <mesh geometry={geos[(it.g + 1) % 3]} material={nuc} scale={0.38} position={[0.15, 0.1, 0.45]} />
        </group>
      ))}
    </>
  );
};

// ---------- skin block (cross-section) ----------
export const SkinBlock: React.FC<{ t: number; bruise?: number; bruiseColor?: string; pool?: number; poolColor?: string; patch?: number; patchColor?: string }> = ({
  t, bruise = 0, pool = 0, poolColor = "#d0103a", patch = 0, patchColor = "#d81e4a",
}) => {
  const W = 12, D = 7;
  const top = useMemo(() => {
    const g = new THREE.PlaneGeometry(W, D, 120, 70);
    g.rotateX(-Math.PI / 2);
    const p = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i);
      p.setY(i, 0.06 * noise3(x * 2.2, 0, z * 2.2) + 0.03 * Math.sin(x * 9 + Math.sin(z * 7)) );
    }
    g.computeVertexNormals();
    return g;
  }, []);
  const mats = useMemo(
    () => ({
      epi: new THREE.MeshStandardMaterial({ color: "#ffc7a8", roughness: 0.6 }),
      epiSide: new THREE.MeshStandardMaterial({ color: "#ffb08f", roughness: 0.6, emissive: new THREE.Color("#ff6a5a"), emissiveIntensity: 0.15 }),
      derm: new THREE.MeshStandardMaterial({ color: "#ff5c9e", roughness: 0.55, emissive: new THREE.Color("#c0186a"), emissiveIntensity: 0.25 }),
      fatBox: new THREE.MeshStandardMaterial({ color: "#ffcf6a", roughness: 0.5, emissive: new THREE.Color("#ff9a2a"), emissiveIntensity: 0.15 }),
      fat: new THREE.MeshStandardMaterial({ color: "#ffe08a", roughness: 0.25, emissive: new THREE.Color("#ffb02a"), emissiveIntensity: 0.25 }),
      cap: new THREE.MeshStandardMaterial({ color: "#ff1f5a", roughness: 0.3, emissive: new THREE.Color("#ff0a4a"), emissiveIntensity: 0.9 }),
      vein: new THREE.MeshStandardMaterial({ color: "#6a4bff", roughness: 0.3, emissive: new THREE.Color("#3a1fd0"), emissiveIntensity: 0.7 }),
      nerve: new THREE.MeshStandardMaterial({ color: "#ffe14a", roughness: 0.3, emissive: new THREE.Color("#ffb800"), emissiveIntensity: 0.9 }),
      hair: new THREE.MeshStandardMaterial({ color: "#d9d4e6", roughness: 0.35 }),
      patch: new THREE.MeshBasicMaterial({ color: patchColor, transparent: true, opacity: 0.85, depthWrite: false, toneMapped: false, map: glowTexture() }),
    }),
    [],
  );
  mats.patch.color.set(patchColor);
  const vessels = useMemo(() => {
    const out: { geo: THREE.TubeGeometry; m: "cap" | "vein" | "nerve" }[] = [];
    const zf = D / 2 + 0.02;
    // capillary loops reaching up into the dermis
    for (let i = 0; i < 9; i++) {
      const x = -5 + i * 1.25;
      const pts = [v(x - 0.25, -2.4, zf), v(x - 0.25, -1.2, zf), v(x - 0.1, -0.75, zf), v(x + 0.15, -0.75, zf), v(x + 0.28, -1.2, zf), v(x + 0.3, -2.4, zf)];
      out.push({ geo: tubeGeo(pts, 0.07, 60, 10).geo, m: "cap" });
    }
    const zz = (x: number) => zf;
    out.push({ geo: tubeGeo([v(-6, -2.4, zz(0)), v(-3, -2.5, zf), v(0, -2.35, zf), v(3, -2.5, zf), v(6, -2.4, zf)], 0.16, 100, 14).geo, m: "cap" });
    out.push({ geo: tubeGeo([v(-6, -3.0, zf), v(-2, -3.1, zf), v(2, -2.95, zf), v(6, -3.1, zf)], 0.2, 100, 14).geo, m: "vein" });
    out.push({ geo: tubeGeo([v(-6, -1.7, zf), v(-3, -1.5, zf), v(-1, -1.9, zf), v(2.5, -1.4, zf), v(6, -1.8, zf)], 0.06, 100, 8).geo, m: "nerve" });
    return out;
  }, []);
  const fatItems = useMemo(() => {
    const r = rng(5);
    const a: Inst[] = [];
    for (let i = 0; i < 26; i++) a.push({ p: v(-5.6 + (i % 13) * 0.9 + r() * 0.2, -4.2 - Math.floor(i / 13) * 0.85, D / 2 - 0.25), r: new THREE.Euler(r(), r(), r()), s: 0.42 + r() * 0.1 });
    return a;
  }, []);
  const sphere = useMemo(() => new THREE.SphereGeometry(1, 24, 16), []);
  // blood pool inside the dermis near the surface (bruise)
  const poolItems = useMemo(() => {
    const r = rng(9);
    return Array.from({ length: 160 }, () => ({ x: (r() - 0.5) * 3, y: -0.9 - r() * 1.2, z: D / 2 - r() * 0.5, a: r() * 6, b: r() * 6, c: r() }));
  }, []);
  const rbc = useRbcMaterial({ emissive: "#4a0010", emissiveIntensity: 0.5 });
  const col = new THREE.Color(poolColor);
  const pItems: Inst[] = poolItems
    .filter((p) => p.c < pool)
    .map((p) => ({ p: v(p.x * (0.5 + pool * 0.5), p.y, p.z + 0.05), r: new THREE.Euler(p.a + t * 0.3, p.b, 0), s: 0.13, c: col }));
  return (
    <group>
      <mesh geometry={top} material={mats.epi} />
      <mesh material={mats.epiSide} position={[0, -0.35, 0]}>
        <boxGeometry args={[W, 0.7, D]} />
      </mesh>
      <mesh material={mats.derm} position={[0, -2.15, 0]}>
        <boxGeometry args={[W, 2.9, D]} />
      </mesh>
      <mesh material={mats.fatBox} position={[0, -4.6, 0]}>
        <boxGeometry args={[W, 1.9, D]} />
      </mesh>
      <Instances geometry={sphere} material={mats.fat} items={fatItems} max={30} />
      {vessels.map((vv, i) => (
        <mesh key={i} geometry={vv.geo} material={mats[vv.m]} />
      ))}
      {/* hair shaft through the skin */}
      <mesh material={mats.hair} position={[-2.6, 0.9, 1.2]} rotation={[0.25, 0, -0.35]}>
        <cylinderGeometry args={[0.09, 0.11, 6, 16]} />
      </mesh>
      <mesh material={mats.epiSide} position={[-2.0, -1.6, D / 2 - 0.2]} rotation={[0, 0, -0.35]} scale={[0.35, 1.3, 0.35]}>
        <sphereGeometry args={[1, 24, 16]} />
      </mesh>
      {pool > 0 && <Instances geometry={rbcGeometry()} material={rbc} items={pItems} max={170} />}
      {patch > 0 && (
        <mesh material={mats.patch} position={[0, 0.13, 1.2]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[1.8 * patch, 48]} />
        </mesh>
      )}
      {patch > 0 && <Glow position={[0, 0.2, 1.2]} scale={4.5 * patch} color={patchColor} opacity={0.75} />}
    </group>
  );
};
const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

// shot: dive from above the skin into the cross-section
export const SkinDive: React.FC<S & { reverse?: boolean }> = ({ t, d, reverse }) => {
  const k0 = range(t, 0, d);
  const k = reverse ? 1 - easeOut(k0) : easeIn(k0) * 0.6 + easeInOut(k0) * 0.4;
  const cam = {
    pos: lerpV([0.6, 4.2, 10.5], [0.75, -1.05, 4.25], k),
    target: lerpV([0, -1.0, 0], [0.62, -1.1, 3.5], k),
    fov: lerp(38, 30, k),
  };
  return (
    <World cam={cam} t={t} top="#ffb0dd" bottom="#6a1a9a" bloom={0.9} bokeh={3}>
      <SkinBlock t={t} pool={reverse ? 0 : 0.25 + k0 * 0.5} patch={reverse ? 0 : 0.6} patchColor="#ff2a55" />
      <Motes t={t} count={40} spread={18} center={[0, 0, 4]} color="#ffe0f4" size={0.05} />
    </World>
  );
};

// ---------- capillary with flowing / spilling RBCs ----------
type CapProps = S & {
  tearAt?: number; // local time the vessel tears (-1 never)
  gapMax?: number;
  squeeze?: number; // 0..1 vessel constriction
  flow?: number;
  spill?: number; // 0..1 amount of spilling cells
  platelets?: number; // 0..1 platelets arriving
  plug?: number; // 0..1 plug forming
  cold?: number;
  cam: { pos: number[]; target: number[]; fov?: number; roll?: number };
  top?: string; bottom?: string; shake?: number; deoxy?: number;
};
export const Capillary: React.FC<CapProps> = ({ t, tearAt = -1, gapMax = 0.5, squeeze = 0, flow = 1, spill = 0, platelets = 0, plug = 0, cold = 0, cam, top, bottom, shake = 0, deoxy = 0 }) => {
  const R = 0.62 * (1 - squeeze * 0.45);
  const torn = tearAt >= 0 && t >= tearAt;
  const gap = tearAt < 0 ? 0 : tearAt <= -0.5 ? gapMax : torn ? gapMax * easeOut(range(t, tearAt, tearAt + 0.25)) : 0;
  const preTorn = tearAt === -2; // already torn before the shot
  const g = preTorn ? gapMax : gap;
  const wallMat = useMemo(() => new THREE.MeshPhysicalMaterial({ color: "#ff4fa8", roughness: 0.25, transparent: true, opacity: 0.42, side: THREE.DoubleSide, emissive: new THREE.Color("#ff1f8a"), emissiveIntensity: 0.35, clearcoat: 1, depthWrite: false }), []);
  const ringMat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#ff7ac4", roughness: 0.3, emissive: new THREE.Color("#ff2fa0"), emissiveIntensity: 0.8 }), []);
  wallMat.color.set(new THREE.Color("#ff4fa8").lerp(new THREE.Color("#7fdcff"), cold));
  wallMat.emissive.set(new THREE.Color("#ff1f8a").lerp(new THREE.Color("#2fa8ff"), cold));
  const L = 16;
  const rbc = useRbcMaterial();
  const red = new THREE.Color("#ff1238");
  const dark = new THREE.Color("#4a1f8a");
  const cCol = red.clone().lerp(dark, deoxy);
  const seeds = useMemo(() => {
    const r = rng(42);
    return Array.from({ length: 70 }, () => ({ x: r() * L - L / 2, a: r() * Math.PI * 2, rr: r(), rx: r() * 6, ry: r() * 6, sp: 0.8 + r() * 0.4, ex: r(), ey: r(), ez: r() }));
  }, []);
  const items: Inst[] = [];
  const speed = 2.2 * flow * (1 - squeeze * 0.5);
  for (const s of seeds) {
    let x = ((s.x + t * speed * s.sp + L / 2) % L + L) % L - L / 2;
    const rad = R * 0.55 * s.rr;
    let p = v(x, Math.sin(s.a) * rad, Math.cos(s.a) * rad);
    let sc = 0.36 * (1 - squeeze * 0.2);
    // spilling: cells passing the tear get flung out
    if ((torn || preTorn) && s.ex < spill) {
      const t0 = preTorn ? -s.ey * 3 : tearAt + s.ey * 0.4;
      const age = t - t0;
      if (age > 0) {
        const dir = v((s.ex - 0.5) * 1.2, 0.8 + s.ez, (s.ey - 0.4) * 1.6).normalize();
        const travel = 3.2 * (1 - Math.exp(-age * 1.4)) * (0.6 + s.sp * 0.5);
        p = v(0, R * 0.6, 0).add(dir.multiplyScalar(travel));
        p.x += (s.x / L) * 0.6;
      }
    }
    items.push({ p, r: new THREE.Euler(s.rx + t * 1.5 * s.sp, s.ry + t, 0), s: sc, c: cCol });
  }
  // platelets
  const plMat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#c38bff", roughness: 0.3, emissive: new THREE.Color("#7a2dff"), emissiveIntensity: 0.9, flatShading: true }), []);
  const plGeo = useMemo(() => blobGeometry(3, 0.45, 2, 3.2), []);
  const plSeeds = useMemo(() => {
    const r = rng(77);
    return Array.from({ length: 46 }, () => ({ x0: -8 - r() * 6, a: r() * Math.PI * 2, rr: r(), d: r(), fx: (r() - 0.5) * 2, fa: r() * Math.PI * 2, s: 0.12 + r() * 0.07, sp: r() }));
  }, []);
  const plItems: Inst[] = [];
  if (platelets > 0)
    for (const s of plSeeds) {
      if (s.d > platelets) continue;
      const arrive = clamp(plug * 1.2 - s.sp * 0.3);
      const flowP = v(s.x0 + t * 3.5 * (0.7 + s.sp * 0.6), Math.sin(s.a) * R * 0.5 * s.rr, Math.cos(s.a) * R * 0.5 * s.rr);
      // stuck position around the gap edge
      const ang = s.fa;
      const stuck = v(s.fx * g * 0.9, R * Math.cos(ang * 0.5) * 0.95, R * Math.sin(ang) * 0.6);
      const p = flowP.lerp(stuck, smooth(Math.max(arrive, range(flowP.x, -2.5, 0))));
      plItems.push({ p, r: new THREE.Euler(s.a + t * 2, s.fa + t, 0), s: s.s * (1 + plug * 0.3) });
    }
  // fibrin threads across the gap
  const fib = useMemo(() => {
    const r = rng(8);
    return Array.from({ length: 16 }, () => [v((r() - 0.5) * 1.4, (r() - 0.2) * 1.2, (r() - 0.5) * 1.2), v((r() - 0.5) * 1.4, (r() - 0.2) * 1.2, (r() - 0.5) * 1.2)]);
  }, []);
  const fibMat = useMemo(() => new THREE.MeshBasicMaterial({ color: "#3ff8ff", toneMapped: false, transparent: true }), []);
  fibMat.opacity = clamp(plug * 1.5 - 0.3);
  // ice crystals
  const iceMat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#d8f7ff", roughness: 0.05, emissive: new THREE.Color("#7fe8ff"), emissiveIntensity: 0.9, transparent: true, opacity: 0.85 }), []);
  const iceGeo = useMemo(() => new THREE.CylinderGeometry(1, 1, 0.08, 6), []);
  const iceItems = useMemo(() => {
    const r = rng(19);
    return Array.from({ length: 40 }, () => ({ p: v((r() - 0.5) * 16, (r() - 0.5) * 9, (r() - 0.5) * 8 - 1), r: new THREE.Euler(r() * 3, r() * 3, r() * 3), s: 0.1 + r() * 0.22, sp: r() }));
  }, []);
  const iceNow: Inst[] = cold > 0 ? iceItems.map((c) => ({ p: v(c.p.x + t * 0.6 * c.sp, c.p.y + Math.sin(t + c.sp * 6) * 0.3, c.p.z), r: new THREE.Euler(c.r.x + t * c.sp, c.r.y + t * 0.7, c.r.z), s: c.s * cold })) : [];
  const half = (L / 2 - g / 2);
  const tubeL = (x0: number, x1: number, key: string) => (
    <group key={key} position={[(x0 + x1) / 2, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
      <mesh material={wallMat}>
        <cylinderGeometry args={[R, R, Math.abs(x1 - x0), 48, 1, true]} />
      </mesh>
    </group>
  );
  return (
    <World cam={cam} t={t} top={top ?? (cold ? "#5fd0ff" : "#c0168a")} bottom={bottom ?? (cold ? "#1b2a8a" : "#2a0752")} rim={cold ? "#bff6ff" : "#2ff0ff"} tint={cold ? "#5fb0ff" : "#ff3fb0"} shake={shake} bloom={1.2}>
      <TissueBg t={t} seed={4} color={cold ? "#8fc8ff" : "#ff7ac0"} />
      {g > 0.001 ? (
        <>
          {tubeL(-L / 2, -g / 2, "a")}
          {tubeL(g / 2, L / 2, "b")}
          {[-1, 1].map((s) => (
            <mesh key={s} material={ringMat} position={[(s * g) / 2, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
              <torusGeometry args={[R, 0.045, 10, 48]} />
            </mesh>
          ))}
        </>
      ) : (
        tubeL(-L / 2, L / 2, "full")
      )}
      <Instances geometry={rbcGeometry()} material={rbc} items={items} max={80} />
      {platelets > 0 && <Instances geometry={plGeo} material={plMat} items={plItems} max={50} />}
      {plug > 0.2 &&
        fib.map(([a, b], i) => (
          <mesh key={i} position={a.clone().add(b).multiplyScalar(0.5).multiply(v(g, 1, 1))} quaternion={new THREE.Quaternion().setFromUnitVectors(v(0, 1, 0), b.clone().sub(a).normalize())} material={fibMat}>
            <cylinderGeometry args={[0.018, 0.018, a.distanceTo(b) * smooth(range(plug, 0.2 + i * 0.03, 0.8)), 6]} />
          </mesh>
        ))}
      {plug > 0.4 && <Glow position={[0, R * 0.6, 0]} scale={2.5 * plug} color="#3ff8ff" opacity={(plug - 0.4) * 1.2} />}
      {torn && t - tearAt < 0.6 && <Glow position={[0, R * 0.5, 0]} scale={1 + (t - tearAt) * 8} color="#ffffff" opacity={1 - (t - tearAt) / 0.6} />}
      {cold > 0 && <Instances geometry={iceGeo} material={iceMat} items={iceNow} max={40} />}
      <Motes t={t} count={50} spread={16} color={cold ? "#e8fbff" : "#ffd1ec"} size={0.05} />
    </World>
  );
};

// ---------- thinner than a hair ----------
export const HairCompare: React.FC<S> = ({ t, d }) => {
  const k = easeInOut(range(t, 0, d));
  const hair = useMemo(() => {
    const g = new THREE.CylinderGeometry(2.2, 2.2, 30, 64, 120, false);
    const p = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i);
      const s = 1 + 0.05 * ((((y * 1.4) % 1) + 1) % 1);
      p.setX(i, p.getX(i) * s);
      p.setZ(i, p.getZ(i) * s);
    }
    g.computeVertexNormals();
    return g;
  }, []);
  const hairMat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#c7bcd9", roughness: 0.4, emissive: new THREE.Color("#5a3a8a"), emissiveIntensity: 0.2 }), []);
  const cap = useMemo(() => tubeGeo([v(-14, -1, 3.2), v(-4, -0.6, 3.4), v(0, -0.9, 3.3), v(6, -0.5, 3.2), v(14, -0.8, 3)], 0.18, 200, 16), []);
  const capMat = useMemo(() => new THREE.MeshPhysicalMaterial({ color: "#ff4fa8", transparent: true, opacity: 0.55, emissive: new THREE.Color("#ff1f6a"), emissiveIntensity: 0.9, roughness: 0.2 }), []);
  const rbc = useRbcMaterial();
  const items: Inst[] = Array.from({ length: 40 }, (_, i) => {
    const u = ((i / 40 + t * 0.05) % 1 + 1) % 1;
    return { p: cap.curve.getPointAt(u), r: new THREE.Euler(i, t * 2 + i, 0), s: 0.1, c: "#ff1238" };
  });
  const cam = { pos: [lerp(-1.5, 3.2, k), lerp(0.5, -0.6, k), lerp(9, 6.2, k)], target: [lerp(-1, 2.2, k), -0.6, 2.5], fov: 34 };
  return (
    <World cam={cam} t={t} top="#8a1ab0" bottom="#1a0a4a" bloom={1.1}>
      <mesh geometry={hair} material={hairMat} rotation={[0.15, 0, -0.18]} position={[-3, 0, -1]} />
      <mesh geometry={cap.geo} material={capMat} />
      <Instances geometry={rbcGeometry()} material={rbc} items={items} max={40} />
      <Motes t={t} count={50} spread={18} size={0.05} />
    </World>
  );
};

// ---------- billions: capillary network pull-back ----------
export const Network: React.FC<S> = ({ t, d }) => {
  const k = easeInOut(range(t, 0, d));
  const tubes = useMemo(() => {
    const r = rng(12);
    const out: THREE.TubeGeometry[] = [];
    for (let i = 0; i < 46; i++) {
      let p = v((r() - 0.5) * 30, (r() - 0.5) * 40, (r() - 0.5) * 30 - 8);
      const pts = [p.clone()];
      let dir = v(r() - 0.5, r() - 0.5, r() - 0.5).normalize();
      for (let j = 0; j < 6; j++) {
        dir.add(v(r() - 0.5, r() - 0.5, r() - 0.5).multiplyScalar(0.9)).normalize();
        p = p.clone().add(dir.clone().multiplyScalar(2 + r() * 2));
        pts.push(p);
      }
      out.push(tubeGeo(pts, 0.08 + r() * 0.12, 80, 8).geo);
    }
    return out;
  }, []);
  const mats = useMemo(() => ["#ff1f6a", "#ff4fd8", "#b04bff", "#ff6a3a"].map((c) => new THREE.MeshStandardMaterial({ color: c, emissive: new THREE.Color(c), emissiveIntensity: 1.1, roughness: 0.3 })), []);
  const cam = { pos: [lerp(0.5, 3, k), lerp(0.2, 2, k), lerp(3, 30, easeIn(range(t, 0, d)) * 0.5 + k * 0.5)], target: [0, 0, -6], fov: 40, roll: k * 0.3 };
  return (
    <World cam={cam} t={t} top="#5a0a7a" bottom="#0a0230" bloom={1.5} focus={dist(cam.pos, [0, 0, -6])} bokeh={4} fog="#2a0650" fogNear={10} fogFar={60}>
      {tubes.map((g, i) => (
        <mesh key={i} geometry={g} material={mats[i % 4]} />
      ))}
      <Motes t={t} count={120} spread={40} center={[0, 0, -6]} size={0.08} color="#ff9ce0" />
    </World>
  );
};

// ---------- cells trapping RBCs ----------
export const TrappedBetweenCells: React.FC<S & { deoxy?: number }> = ({ t, d, deoxy = 0 }) => {
  const cells = useMemo(() => {
    const r = rng(21);
    const a: { p: THREE.Vector3; s: number; g: number }[] = [];
    for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) a.push({ p: v(i * 3.1 + (r() - 0.5) * 0.6, j * 3.1 + (r() - 0.5) * 0.6, -1 + (r() - 0.5)), s: 1.35 + r() * 0.2, g: Math.floor(r() * 3) });
    return a;
  }, []);
  const geos = useMemo(() => [0, 1, 2].map((i) => blobGeometry(10 + i, 0.12, 4)), []);
  const cellMat = useMemo(() => new THREE.MeshPhysicalMaterial({ color: "#ffa3cf", roughness: 0.35, emissive: new THREE.Color("#ff4fa0"), emissiveIntensity: 0.2, clearcoat: 0.6, transparent: true, opacity: 0.92 }), []);
  const nucMat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#9b30ff", emissive: new THREE.Color("#6a12d0"), emissiveIntensity: 0.6 }), []);
  const rbc = useRbcMaterial();
  const seeds = useMemo(() => {
    const r = rng(33);
    return Array.from({ length: 90 }, () => {
      const gi = Math.floor(r() * 4) - 2, gj = Math.floor(r() * 5) - 2;
      return { from: v(-14 - r() * 6, (r() - 0.5) * 4, 1 + r()), to: v(gi * 3.1 + 1.55 + (r() - 0.5) * 0.8, gj * 3.1 + (r() - 0.5) * 2.2, 0.2 + r() * 1.2), del: r() * 1.2, a: r() * 6, b: r() * 6 };
    });
  }, []);
  const col = new THREE.Color("#ff1238").lerp(new THREE.Color("#3b1d8a"), deoxy);
  const items: Inst[] = seeds.map((s) => {
    const k = easeOut(range(t, s.del * 0.6, s.del * 0.6 + 1.4));
    const p = s.from.clone().lerp(s.to, k);
    p.y += Math.sin(k * Math.PI) * 1.2;
    return { p, r: new THREE.Euler(s.a + t * (1 - k) * 3, s.b, 0), s: 0.4, c: col };
  });
  const k = easeInOut(range(t, 0, d));
  const cam = { pos: [lerp(-4, 3, k), lerp(-2, 1.5, k), lerp(7.5, 11, k)], target: [0, 0, 0], fov: 38 };
  return (
    <World cam={cam} t={t} top="#d0208a" bottom="#3a0868" focus={dist(cam.pos, [0, 0, 0.5])} bokeh={4}>
      {cells.map((c, i) => (
        <group key={i} position={c.p} scale={c.s}>
          <mesh geometry={geos[c.g]} material={cellMat} />
          <mesh geometry={geos[(c.g + 1) % 3]} material={nucMat} scale={0.4} position={[0.1, 0.1, 0.5]} />
        </group>
      ))}
      <Instances geometry={rbcGeometry()} material={rbc} items={items} max={100} />
      <Motes t={t} count={50} spread={20} size={0.05} />
    </World>
  );
};

// ---------- oxygen on fresh RBC ----------
const O2: React.FC<{ p: THREE.Vector3; s: number; o?: number }> = ({ p, s, o = 1 }) => (
  <group position={p} scale={s}>
    <mesh position={[-0.13, 0, 0]}>
      <sphereGeometry args={[0.2, 16, 12]} />
      <meshStandardMaterial color="#5ff8ff" emissive="#2fd8ff" emissiveIntensity={1.3} transparent opacity={o} />
    </mesh>
    <mesh position={[0.13, 0, 0]}>
      <sphereGeometry args={[0.2, 16, 12]} />
      <meshStandardMaterial color="#5ff8ff" emissive="#2fd8ff" emissiveIntensity={1.3} transparent opacity={o} />
    </mesh>
  </group>
);

export const OxygenCell: React.FC<S & { deoxy?: number }> = ({ t, d, deoxy = 0 }) => {
  const k = easeInOut(range(t, 0, d));
  const rbc = useRbcMaterial({ emissive: "#600012", emissiveIntensity: 0.7 });
  const col = mixColor([[0, "#ff1238"], [1, "#3b1d8a"]], deoxy);
  const bg = useMemo(() => {
    const r = rng(55);
    return Array.from({ length: 26 }, () => ({ p: v((r() - 0.5) * 14, (r() - 0.5) * 18, -3 - r() * 8), a: r() * 6, b: r() * 6 }));
  }, []);
  const items: Inst[] = [{ p: v(0, 0, 0), r: new THREE.Euler(1.15 + t * 0.25, 0.5 + t * 0.4, 0.3), s: 1.6, c: col }, ...bg.map((b) => ({ p: b.p, r: new THREE.Euler(b.a + t * 0.3, b.b, 0), s: 1.1, c: col }))];
  const o2 = Array.from({ length: 12 }, (_, i) => {
    const a = (i / 12) * Math.PI * 2 + t * 0.6;
    const leave = deoxy > 0 ? easeIn(clamp(deoxy * 1.6 - (i % 4) * 0.12)) : 0;
    const r = 2.05 + leave * 4 + Math.sin(t * 3 + i) * 0.05;
    return { p: v(Math.cos(a) * r, Math.sin(a) * r * 0.75 + leave * 3, Math.sin(a * 2) * 0.6 + 0.6), o: 1 - leave };
  });
  const cam = { pos: [lerp(-3.5, 3.0, k), lerp(1.8, -0.2, k), lerp(10, 8.2, k)], target: [0, 0, 0], fov: 38 };
  return (
    <World cam={cam} t={t} top={deoxy ? "#5a1a9a" : "#e0206a"} bottom={deoxy ? "#10083a" : "#3a0868"} bloom={1.2} focus={dist(cam.pos, [0, 0, 0])} bokeh={6}>
      <Instances geometry={rbcGeometry()} material={rbc} items={items} max={30} />
      {o2.map((o, i) => (
        <O2 key={i} p={o.p} s={0.9} o={o.o} />
      ))}
      {o2.map((o, i) => (
        <Glow key={"g" + i} position={o.p} scale={0.9} color="#2fd8ff" opacity={0.5 * o.o} />
      ))}
      <Motes t={t} count={40} spread={14} size={0.05} />
    </World>
  );
};

// ---------- bruise pool shrinking (top view) ----------
export const PoolTopView: React.FC<S> = ({ t, d }) => {
  const k = easeInOut(range(t, 0, d));
  const rbc = useRbcMaterial();
  const seeds = useMemo(() => {
    const r = rng(66);
    return Array.from({ length: 180 }, () => ({ a: r() * Math.PI * 2, rr: Math.sqrt(r()), z: r() * 0.4, x: r() * 6, y: r() * 6 }));
  }, []);
  const R = lerp(5.5, 3.2, easeInOut(range(t, 0.1, d * 0.8)));
  const items: Inst[] = seeds.map((s) => ({ p: v(Math.cos(s.a) * s.rr * R, s.z, Math.sin(s.a) * s.rr * R), r: new THREE.Euler(s.x + t * 0.2, s.y, 0), s: 0.34, c: s.rr * 5.5 < R ? "#ff1238" : "#ff1238" }));
  const ring = useMemo(() => new THREE.MeshBasicMaterial({ color: "#7fe8ff", transparent: true, opacity: 0.8, toneMapped: false }), []);
  const cam = { pos: [lerp(0.5, 0.2, k), lerp(9, 16, k), lerp(6, 4, k)], target: [0, 0, 0], fov: 40 };
  return (
    <World cam={cam} t={t} top="#5fd0ff" bottom="#2a0868" tint="#5fb0ff" bloom={1}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.3, 0]}>
        <circleGeometry args={[30, 64]} />
        <meshStandardMaterial color="#ff86c0" roughness={0.6} emissive="#c0186a" emissiveIntensity={0.25} />
      </mesh>
      <Instances geometry={rbcGeometry()} material={rbc} items={items} max={190} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.5, 0]} material={ring}>
        <ringGeometry args={[5.5, 5.62, 96]} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.5, 0]}>
        <ringGeometry args={[R + 0.1, R + 0.3, 96]} />
        <meshBasicMaterial color="#ffffff" toneMapped={false} transparent opacity={0.85} />
      </mesh>
    </World>
  );
};

// ---------- swelling squeezing nerve fibres ----------
const NerveTree: React.FC<{ t: number; pulse: number; squeeze?: number; seed?: number }> = ({ t, pulse, squeeze = 0, seed = 2 }) => {
  const branches = useMemo(() => {
    const r = rng(seed);
    const out: { curve: THREE.CatmullRomCurve3; rad: number }[] = [];
    const trunk = [v(-12, -3, -1), v(-6, -2, 0), v(-2, -0.5, 0.3), v(1, 0.2, 0.5)];
    out.push({ curve: new THREE.CatmullRomCurve3(trunk), rad: 0.22 });
    const grow = (start: THREE.Vector3, dir: THREE.Vector3, depth: number, rad: number) => {
      if (depth === 0) return;
      for (let b = 0; b < 2; b++) {
        const d2 = dir.clone().add(v(r() - 0.4, (r() - 0.5) * 1.6, (r() - 0.5) * 1.2)).normalize();
        const len = 1.6 + r() * 1.6;
        const mid = start.clone().add(d2.clone().multiplyScalar(len * 0.5)).add(v(0, (r() - 0.5) * 0.6, 0));
        const end = start.clone().add(d2.clone().multiplyScalar(len));
        out.push({ curve: new THREE.CatmullRomCurve3([start, mid, end]), rad });
        grow(end, d2, depth - 1, rad * 0.7);
      }
    };
    grow(v(1, 0.2, 0.5), v(1, 0.1, 0), 4, 0.13);
    return out;
  }, [seed]);
  const geos = useMemo(() => branches.map((b) => new THREE.TubeGeometry(b.curve, 30, b.rad, 8)), [branches]);
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#ffd84a", roughness: 0.3, emissive: new THREE.Color("#ff9a00"), emissiveIntensity: 0.8 }), []);
  mat.emissiveIntensity = 0.8 + pulse * 1.5;
  mat.emissive.set(new THREE.Color("#ff9a00").lerp(new THREE.Color("#ff2a3a"), pulse * 0.6));
  return (
    <group scale={[1, 1 - squeeze * 0.25, 1]}>
      {geos.map((g, i) => (
        <mesh key={i} geometry={g} material={mat} />
      ))}
      {pulse > 0 &&
        branches.map((b, i) => {
          const u = 1 - (((t * 1.6 + i * 0.37) % 1) + 1) % 1;
          return <Glow key={i} position={b.curve.getPointAt(u)} scale={0.9 * pulse} color="#fff2a0" opacity={pulse} />;
        })}
      {branches.slice(1).filter((_, i) => i % 2 === 0).map((b, i) => (
        <Glow key={"e" + i} position={b.curve.getPointAt(1)} scale={0.6 + pulse * 0.9} color={pulse > 0.3 ? "#ff5a3a" : "#ffd84a"} opacity={0.5 + pulse * 0.5} />
      ))}
    </group>
  );
};

export const Swelling: React.FC<S> = ({ t, d }) => {
  const sw = easeInOut(range(t, 0, d * 0.8));
  const cellMat = useMemo(() => new THREE.MeshPhysicalMaterial({ color: "#ff8cc6", roughness: 0.35, emissive: new THREE.Color("#ff2f8a"), emissiveIntensity: 0.25, clearcoat: 0.6 }), []);
  const cells = [
    [-3, 2.6, 0, 0], [1.5, 2.8, -0.5, 1], [5, 2.4, 0, 2], [-2, -2.6, 0, 1], [3, -2.8, 0.3, 0],
  ];
  const k = easeInOut(range(t, 0, d));
  const cam = { pos: [lerp(-4, 3, k), lerp(0.5, 0.2, k), lerp(17, 15, k)], target: [1, 0, 0], fov: 42 };
  return (
    <World cam={cam} t={t} top="#e0306a" bottom="#3a0858" shake={sw * 0.02} bloom={1.4}>
      <NerveTree t={t} pulse={0.25 + sw * 0.6} squeeze={sw} />
      {cells.map(([x, y, z, g], i) => (
        <LiveBlob key={i} t={t} seed={i} amp={0.1} material={cellMat} detail={4} position={[x, y * 1.25 - Math.sign(y) * sw * 1.1, z - 1]} scale={1.6 + sw * 0.7 + Math.sin(t * 5 + i) * 0.04} />
      ))}
      {[...Array(6)].map((_, i) => (
        <Glow key={i} position={[-4 + i * 1.8, 0.1, 0.6]} scale={1.2 + sw * 2} color="#ff3a5a" opacity={sw * 0.4} />
      ))}
      <Motes t={t} count={40} spread={18} size={0.05} />
    </World>
  );
};

export const NerveFire: React.FC<S> = ({ t, d }) => {
  const k = easeInOut(range(t, 0, d));
  const flick = 0.75 + 0.25 * Math.sin(t * 40) * Math.sin(t * 17);
  const cam = { pos: [lerp(8, 1, k), lerp(2, 0.5, k), lerp(4.5, 7, k)], target: [lerp(4, -1, k), 0, 0], fov: 38, roll: -0.2 + k * 0.3 };
  return (
    <World cam={cam} t={t} top="#ff3a6a" bottom="#3a0638" bloom={1.6} tint="#ff7a3a">
      <NerveTree t={t} pulse={flick} seed={2} />
      <NerveTree t={t + 0.3} pulse={flick * 0.7} seed={5} />
      <Motes t={t} count={60} spread={20} color="#ffe8a0" size={0.05} />
    </World>
  );
};

// ---------- macrophage ----------
const useMacMats = () =>
  useMemo(
    () => ({
      body: new THREE.MeshPhysicalMaterial({ color: "#2ff0d8", roughness: 0.2, transparent: true, opacity: 0.55, emissive: new THREE.Color("#0ab8c8"), emissiveIntensity: 0.45, clearcoat: 1, depthWrite: false, side: THREE.DoubleSide }),
      nuc: new THREE.MeshStandardMaterial({ color: "#7a3aff", emissive: new THREE.Color("#5a12ff"), emissiveIntensity: 0.8, roughness: 0.3 }),
    }),
    [],
  );

type MacProps = S & { phase: "approach" | "engulf" | "green" | "yellow" | "digest"; camOverride?: { pos: number[]; target: number[]; fov?: number } };
export const Macrophage: React.FC<MacProps> = ({ t, d, phase, camOverride }) => {
  const m = useMacMats();
  const rbc = useRbcMaterial();
  const k = easeInOut(range(t, 0, d));
  const partMat = useMemo(() => new THREE.MeshBasicMaterial({ color: "#ffffff", toneMapped: false }), []);
  const sph = useMemo(() => new THREE.SphereGeometry(1, 12, 8), []);
  const dark = "#4a1f8a";
  // macrophage position
  let mx = 0;
  let pseudoLen = 0;
  if (phase === "approach") { mx = lerp(-6, -2.4, easeOut(range(t, 0, d))); pseudoLen = 0.6 * k; }
  if (phase === "engulf") { mx = -1.2; pseudoLen = 0.6 + Math.sin(k * Math.PI) * 0.5; }
  const rbcItems: Inst[] = [];
  const clusterC = v(2.5, 0, 0);
  const cl = useMemo(() => {
    const r = rng(88);
    return Array.from({ length: 14 }, () => ({ p: v((r() - 0.3) * 3, (r() - 0.5) * 3, (r() - 0.5) * 2), a: r() * 6, b: r() * 6 }));
  }, []);
  if (phase === "approach" || phase === "engulf") {
    cl.forEach((c, i) => {
      let p = clusterC.clone().add(c.p);
      let s = 0.55;
      if (phase === "engulf" && i < 3) {
        const e = easeInOut(range(t, 0.1 + i * 0.15, 0.9 + i * 0.15));
        p = p.lerp(v(mx + 0.2 * i, 0.2 * i - 0.2, 0.2), e);
        s = lerp(0.55, 0.4, e);
      }
      rbcItems.push({ p, r: new THREE.Euler(c.a + t * 0.3, c.b, 0), s, c: dark });
    });
  }
  // particles (breakdown)
  const parts = useMemo(() => {
    const r = rng(99);
    return Array.from({ length: 140 }, () => ({ d: v(r() - 0.5, r() - 0.5, r() - 0.5).normalize().multiplyScalar(0.3 + r() * 1.5), ph: r() * 6, s: 0.05 + r() * 0.07, o: r() }));
  }, []);
  let partItems: Inst[] = [];
  let partColor = "#4a1f8a";
  let showMac = true;
  let macPos = v(mx, 0, 0);
  let macScale = 2.1;
  if (phase === "green" || phase === "yellow" || phase === "digest") macPos = v(0, 0, 0);
  if (phase === "green") {
    const g = smooth(range(t, 0.2, d * 0.75));
    partColor = "#" + mixColor([[0, "#4a1f8a"], [0.4, "#3a6a8a"], [1, "#3aff5a"]], g).getHexString();
    partItems = parts.map((p) => {
      const sp = 0.25 + g * 0.9;
      const q = p.d.clone().multiplyScalar(sp);
      q.applyAxisAngle(v(0, 1, 0), t * 0.8 + p.ph);
      return { p: q, r: new THREE.Euler(), s: p.s * 1.2, c: partColor };
    });
  }
  if (phase === "yellow") {
    const y = smooth(range(t, 0.1, d * 0.6));
    partColor = "#" + mixColor([[0, "#3aff5a"], [1, "#ffd21a"]], y).getHexString();
    partItems = parts.map((p) => {
      const out = easeIn(clamp(range(t, 0.3 + p.o * 0.8, d)));
      const q = p.d.clone().multiplyScalar(1.1);
      q.applyAxisAngle(v(0, 1, 0), t * 0.8 + p.ph);
      q.add(v(out * 9, out * 2 * (p.o - 0.5), out * 2));
      return { p: q, r: new THREE.Euler(), s: p.s * 1.2, c: partColor };
    });
  }
  const pool = useMemo(() => {
    const r = rng(5);
    return Array.from({ length: 60 }, () => ({ p: v((r() - 0.5) * 6, (r() - 0.5) * 4, (r() - 0.5) * 3), a: r() * 6, c: r() }));
  }, []);
  let multi: React.ReactNode = null;
  if (phase === "digest") {
    showMac = false;
    const shrink = easeInOut(range(t, 0, d));
    pool.forEach((pp, i) => {
      if (pp.c < shrink * 0.8) return;
      rbcItems.push({ p: pp.p.clone().multiplyScalar(1 - shrink * 0.3), r: new THREE.Euler(pp.a + t * 0.3, pp.a, 0), s: 0.45, c: i % 3 === 0 ? "#6b8f2a" : i % 3 === 1 ? "#c9b42a" : dark });
    });
    multi = [0, 1, 2, 3, 4].map((i) => {
      const a = (i / 5) * Math.PI * 2 + t * 0.3;
      const r = lerp(5, 3.6, shrink);
      return (
        <group key={i} position={[Math.cos(a) * r, Math.sin(a) * r * 0.75, -0.5]}>
          <LiveBlob t={t} seed={i + 2} amp={0.2} speed={1.5} material={m.body} scale={1.8} pseudo={[v(-Math.cos(a), -Math.sin(a), 0).multiplyScalar(0.5 + 0.3 * Math.sin(t * 3 + i))]} />
          <mesh material={m.nuc} scale={0.6} position={[0.2, 0.2, 0]}>
            <sphereGeometry args={[1, 24, 16]} />
          </mesh>
        </group>
      );
    });
  }
  const bgTint = phase === "green" ? ["#1a9a5a", "#06301a"] : phase === "yellow" ? ["#d0a01a", "#4a1a3a"] : ["#1aa8b0", "#1a0a4a"];
  const cam = camOverride ??
    (phase === "approach" ? { pos: [lerp(-3, 1.5, k), lerp(2.5, 1.2, k), lerp(17, 14.5, k)], target: [lerp(-2, 0.5, k), 0, 0], fov: 40 }
    : phase === "engulf" ? { pos: [lerp(3.5, 0.5, k), lerp(1, 2, k), lerp(12.5, 10.5, k)], target: [lerp(1, 0, k), 0, 0], fov: 40 }
    : phase === "green" ? { pos: [lerp(-3, 2, k), lerp(-0.5, 0.8, k), lerp(9.5, 8, k)], target: [0, 0, 0], fov: 40 }
    : phase === "yellow" ? { pos: [lerp(-1, 4, k), lerp(0.5, 0, k), lerp(9, 12, k)], target: [lerp(0, 3, k), 0, 0], fov: 40 }
    : { pos: [lerp(0, 1, k), lerp(0.5, 1.2, k), lerp(9, 16, k)], target: [0, 0, 0], fov: 38 });
  return (
    <World cam={cam} t={t} top={bgTint[0]} bottom={bgTint[1]} bloom={1.3} rim="#7fffe8" tint={phase === "yellow" ? "#ffb02a" : "#ff3fb0"}>
      <TissueBg t={t} seed={7} color={phase === "green" ? "#7affb0" : phase === "yellow" ? "#ffd27a" : "#ff8fd0"} z={-14} />
      {showMac && (
        <group position={macPos}>
          <LiveBlob t={t} seed={1} amp={0.18} speed={1.2} material={m.body} scale={macScale} pseudo={phase === "approach" || phase === "engulf" ? [v(1, 0.3, 0).multiplyScalar(pseudoLen), v(0.8, -0.6, 0.2).multiplyScalar(pseudoLen * 0.8)] : []} />
          <mesh material={m.nuc} scale={[0.9, 0.7, 0.8]} position={[-0.7, 0.4, -0.3]}>
            <sphereGeometry args={[1, 32, 24]} />
          </mesh>
        </group>
      )}
      {multi}
      <Instances geometry={rbcGeometry()} material={rbc} items={rbcItems} max={80} />
      {partItems.length > 0 && <Instances geometry={sph} material={partMat} items={partItems} max={150} />}
      {(phase === "green" || phase === "yellow") && <Glow position={[0, 0, 0]} scale={phase === "green" ? 3 + smooth(range(t, 0.2, d)) * 4 : 6} color={partColor} opacity={0.6} />}
      <Motes t={t} count={50} spread={20} size={0.05} color={phase === "green" ? "#c8ffd8" : "#fff0c0"} />
    </World>
  );
};

// ---------- see the dark blood through the skin ----------
export const ThroughSkin: React.FC<S> = ({ t, d }) => {
  const k = easeInOut(range(t, 0, d));
  const cam = { pos: lerpV([0.4, -1.4, 7.5], [0.2, 7.5, 7.0], k), target: lerpV([0, -1.4, 3.4], [0, 0, 1.2], k), fov: 38 };
  return (
    <World cam={cam} t={t} top="#8a7aff" bottom="#2a0a6a" bloom={0.9} bokeh={3}>
      <SkinBlock t={t} pool={0.95} poolColor="#3b1d8a" patch={0.55 + 0.25 * k} patchColor="#5a3acf" />
      <Motes t={t} count={30} spread={16} center={[0, 0, 3]} size={0.05} />
    </World>
  );
};
