import React, { useMemo } from "react";
import * as THREE from "three";
import { clamp, easeIn, easeInOut, lerp, lerpV, range, rng, smooth } from "../../engine/lib";
import { Character, Pose, animPose, pose } from "../../engine/Character";
import { Cam, Post, StudioLights, useEnvMap } from "../../engine/common";
import { Backdrop, Glow, Inst, Instances, LiveBlob, Motes, rbcGeometry, tubeGeo, blobGeometry } from "../../engine/prims";
import { World } from "../science02/Shots";

export type C = { pos: number[]; target: number[]; fov?: number; roll?: number };
export type S = { t: number; d: number; gt: number };
const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const dist = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
export const mv = (a: number[], b: number[], t: number, d: number, target: number[] | ((k: number) => number[]), fov = 40): C => {
  const k = easeInOut(clamp(t / d));
  return { pos: lerpV(a, b, k), target: typeof target === "function" ? target(k) : target, fov };
};

// ---------- materials ----------
export function useBodyMats() {
  const env = useEnvMap();
  return useMemo(() => ({
    blood: new THREE.MeshPhysicalMaterial({ color: "#ff1f4a", roughness: 0.25, clearcoat: 1, envMap: env, emissive: new THREE.Color("#8a0020"), emissiveIntensity: 0.5 }),
    heart: new THREE.MeshPhysicalMaterial({ color: "#ff3a6a", roughness: 0.35, clearcoat: 0.8, envMap: env, emissive: new THREE.Color("#b0103a"), emissiveIntensity: 0.6 }),
    vessel: new THREE.MeshPhysicalMaterial({ color: "#7a2aff", roughness: 0.3, clearcoat: 0.7, transparent: true, opacity: 0.85, emissive: new THREE.Color("#3a10c0"), emissiveIntensity: 0.5, depthWrite: false }),
    lung: new THREE.MeshPhysicalMaterial({ color: "#ffb8d8", roughness: 0.5, transparent: true, opacity: 0.85, emissive: new THREE.Color("#ff5a9a"), emissiveIntensity: 0.4 }),
    airway: new THREE.MeshStandardMaterial({ color: "#7fe8ff", roughness: 0.35, emissive: new THREE.Color("#1aa8d0"), emissiveIntensity: 0.5 }),
    nerve: new THREE.MeshStandardMaterial({ color: "#fff0a0", roughness: 0.3, emissive: new THREE.Color("#ffc020"), emissiveIntensity: 0.6 }),
    myelin: new THREE.MeshStandardMaterial({ color: "#f4f4ff", roughness: 0.4, emissive: new THREE.Color("#8080c0"), emissiveIntensity: 0.3 }),
    muscle: new THREE.MeshPhysicalMaterial({ color: "#ff5a7a", roughness: 0.45, clearcoat: 0.4, emissive: new THREE.Color("#9a0a30"), emissiveIntensity: 0.4 }),
    tendon: new THREE.MeshStandardMaterial({ color: "#ffe0c8", roughness: 0.5 }),
    bone: new THREE.MeshStandardMaterial({ color: "#f8f4ea", roughness: 0.6 }),
    cell: new THREE.MeshPhysicalMaterial({ color: "#ffd27a", roughness: 0.4, transparent: true, opacity: 0.85, emissive: new THREE.Color("#c07a10"), emissiveIntensity: 0.3 }),
    sugar: new THREE.MeshBasicMaterial({ color: "#fff27a", toneMapped: false }),
    o2: new THREE.MeshBasicMaterial({ color: "#5ff8ff", toneMapped: false }),
    skin: new THREE.MeshStandardMaterial({ color: "#f4b089", roughness: 0.55 }),
  }), [env]);
}
export type BM = ReturnType<typeof useBodyMats>;

// =====================================================================================
// character shots (static hook + breathing/moving variants)
// =====================================================================================
const CHEST_HAND = pose({ rw: [-1.45, -2.52, 1.5], rp: [-2.2, -2.2, -1], lw: [0.45, -1.55, 1.25], lp: [1.9, -2.2, 0.6], eyeYaw: 0.25, eyePitch: -0.3, brow: 0.6, smile: 0.7, head: [0.12, 0.12, 0] });
const HOOK_CAM: C = { pos: [1.8, -0.5, 5.6], target: [0.2, -1.5, 0.8], fov: 42 };

// Character props: `t` is frozen to 0 so the first and last frame of the loop are identical.
export const HookChar: React.FC<S> = () => (
  <>
    <Backdrop top="#cdeeff" bottom="#5fb8f0" />
    <StudioLights />
    <Cam pos={HOOK_CAM.pos} target={HOOK_CAM.target} fov={HOOK_CAM.fov} t={0} />
    <Character p={CHEST_HAND} t={0} />
    <Post focus={dist(HOOK_CAM.pos, [0.2, -1.5, 0.8])} bokeh={4} bloom={0.55} />
  </>
);

export const CharShot: React.FC<S & { p: (t: number) => Pose; cam: (k: number) => C }> = ({ t, d, gt, p, cam }) => {
  const pp = p(t);
  const c = cam(easeInOut(clamp(t / d)));
  return (
    <>
      <Backdrop top="#cdeeff" bottom="#5fb8f0" />
      <StudioLights />
      <Cam pos={c.pos} target={c.target} fov={c.fov ?? 42} t={t} />
      <Character p={pp} t={gt} />
      <Post focus={dist(c.pos, c.target)} bokeh={4} bloom={0.55} />
    </>
  );
};

// =====================================================================================
// macro shots
// =====================================================================================
const Macro: React.FC<{ cam: C; t: number; top?: string; bottom?: string; tint?: string; children: React.ReactNode; bloom?: number }> = ({ cam, t, top = "#a0157a", bottom = "#2a0752", tint, children, bloom = 1.1 }) => (
  <World cam={cam} t={t} top={top} bottom={bottom} tint={tint} bloom={bloom}>
    {children}
    <Motes t={t} count={40} spread={14} size={0.05} />
  </World>
);

// ---------- heart chamber + blood flow ----------
export const HeartShot: React.FC<S & { cam: C; flow?: boolean }> = ({ t, cam, flow }) => {
  const m = useBodyMats();
  const beatHz = 72 / 60;
  const beat = t * beatHz;
  const pulse = Math.pow(Math.max(0, Math.sin(beat * Math.PI * 2)), 6);
  const vessels = useMemo(() => {
    const out: THREE.TubeGeometry[] = [];
    const paths = [
      [v(0, 1.2, 0), v(-1.8, 2.8, -0.5), v(-3.8, 4.0, -1)],
      [v(0, 1.2, 0), v(1.6, 2.9, 0.6), v(3.6, 3.6, 1.2)],
      [v(0, -1.2, 0), v(-1.6, -2.7, 0.4), v(-3.2, -3.6, 0.8)],
      [v(0, -1.2, 0), v(1.8, -2.6, -0.4), v(3.4, -4.0, -0.8)],
    ];
    for (const p of paths) out.push(tubeGeo(p, 0.45, 80, 14).geo);
    return out;
  }, []);
  const curve = useMemo(() => tubeGeo([v(-3.8, 4.0, -1), v(-1.8, 2.8, -0.5), v(0, 1.2, 0), v(1.6, 2.9, 0.6), v(3.6, 3.6, 1.2)], 0.45, 80, 6).curve, []);
  const cells = useMemo(() => Array.from({ length: 70 }, (_, i) => ({ u: (i / 70 + 0.01 * i) % 1, a: i * 2.3, rr: ((i * 37) % 11) / 22 })), []);
  const items: Inst[] = cells.map((c) => {
    const u = (c.u + t * (0.18 + pulse * 0.2)) % 1;
    const p = curve.getPointAt(u);
    return { p, r: new THREE.Euler(c.a, t * 2, 0), s: 0.2, c: "#ff1238" };
  });
  const rbc = rbcGeometry();
  return (
    <Macro cam={cam} t={t} top="#b0104a" bottom="#2a0230" tint="#ff3fb0">
      <LiveBlob t={t} seed={3} amp={0.1} freq={1.1} material={m.heart} scale={1.6 + pulse * 0.25} detail={5} />
      {vessels.map((g, i) => (
        <mesh key={i} geometry={g} material={m.vessel} />
      ))}
      <Instances geometry={rbc} material={m.blood} items={items} max={70} />
      <Glow position={[0, 0, 0]} scale={4 + pulse * 3} color="#ff3a6a" opacity={0.35 + pulse * 0.4} />
      {flow && <Glow position={[0, 1.2, 0.8]} scale={1 + pulse} color="#ffb0c0" opacity={pulse} />}
    </Macro>
  );
};

// ---------- lungs: bronchi, air sacs, oxygen crossing ----------
export const LungShot: React.FC<S & { cam: C; zoom?: boolean }> = ({ t, cam, zoom }) => {
  const m = useBodyMats();
  const breath = 0.5 + 0.5 * Math.sin(t * Math.PI / 2);
  const tree = useMemo(() => {
    const tubes: THREE.TubeGeometry[] = [];
    const ends: THREE.Vector3[] = [];
    const r = rng(12);
    const grow = (p: THREE.Vector3, dir: THREE.Vector3, depth: number, rad: number) => {
      if (depth === 0) { ends.push(p.clone()); return; }
      for (const s of [-1, 1]) {
        const d = dir.clone().add(v(s * (0.6 + r() * 0.3), -0.2, (r() - 0.5) * 0.6)).normalize();
        const len = 1.0 + r() * 0.5;
        const q = p.clone().add(d.clone().multiplyScalar(len));
        tubes.push(tubeGeo([p.clone(), q], rad, 8, 10).geo);
        grow(q, d, depth - 1, rad * 0.78);
      }
    };
    grow(v(0, 2.5, 0), v(0, -1, 0), 4, 0.2);
    return { tubes, ends };
  }, []);
  const sacs: Inst[] = tree.ends.map((p, i) => ({ p, r: new THREE.Euler(), s: 0.28 + breath * 0.1 + (i % 3) * 0.03, c: "#ffc0dc" }));
  const sacGeo = useMemo(() => new THREE.SphereGeometry(1, 16, 12), []);
  const bubbles: Inst[] = useMemo(() => Array.from({ length: 60 }, (_, i) => ({ p: v((i % 7) * 0.4 - 1.2, 2.4 - (i % 11) * 0.3, (i % 5) * 0.3 - 0.6), r: new THREE.Euler(), s: 0.05, c: "#5ff8ff" })), []);
  const o2 = useMemo(() => Array.from({ length: 50 }, (_, i) => ({ u: (i / 50 + t * 0.3) % 1, a: i * 2.1, s: 0.05 + (i % 4) * 0.02 })), [Math.floor(t * 10)]);
  const o2Items: Inst[] = o2.map((o) => ({ p: v(Math.cos(o.a) * (1.6 - o.u * 1.2), 1.0 + Math.sin(o.a * 1.7) * 0.4 + o.u * 0.4, Math.sin(o.a) * (1.1 - o.u * 0.6)), r: new THREE.Euler(), s: o.s, c: "#5ff8ff" }));
  return (
    <Macro cam={cam} t={t} top="#1a7aa0" bottom="#06203a" tint="#5fd0ff">
      {tree.tubes.map((g, i) => (
        <mesh key={i} geometry={g} material={m.airway} />
      ))}
      <Instances geometry={sacGeo} material={m.lung} items={sacs} max={tree.ends.length} />
      <Instances geometry={sacGeo} material={m.o2} items={o2Items} max={50} />
      <Instances geometry={sacGeo} material={m.o2} items={bubbles} max={60} />
      {zoom && <Glow position={[0, 1, 0]} scale={2.5} color="#7fe8ff" opacity={0.5} />}
    </Macro>
  );
};

// ---------- nerve signal ----------
export const NeuronShot: React.FC<S & { cam: C; speed?: number }> = ({ t, cam, speed = 0.12 }) => {
  const m = useBodyMats();
  const path = useMemo(() => tubeGeo([v(-3.5, -0.5, 0), v(-1.5, 0.6, 0.4), v(0.8, -0.4, 0.2), v(2.5, 0.8, -0.3), v(4.5, 0.2, 0)], 0.09, 200, 10), []);
  const myelin = useMemo(() => Array.from({ length: 10 }, (_, i) => i / 10 + 0.04), []);
  const pulseA = (t * speed) % 1;
  return (
    <Macro cam={cam} t={t} top="#3a1a9a" bottom="#0a0230" tint="#ffd23a" bloom={1.4}>
      <LiveBlob t={t} seed={7} amp={0.12} material={m.nerve} scale={1.1} position={[-3.8, -0.5, 0]} detail={4} />
      <mesh geometry={path.geo} material={m.nerve} />
      {myelin.map((u, i) => {
        const p = path.curve.getPointAt(u);
        const q = path.curve.getPointAt(Math.min(0.999, u + 0.02));
        return (
          <mesh key={i} material={m.myelin} position={p} quaternion={new THREE.Quaternion().setFromUnitVectors(v(0, 1, 0), q.clone().sub(p).normalize())}>
            <cylinderGeometry args={[0.13, 0.13, 0.2, 14]} />
          </mesh>
        );
      })}
      {[0, 0.35, 0.7].map((o, i) => {
        const u = (pulseA + o) % 1;
        return <Glow key={i} position={path.curve.getPointAt(u)} scale={0.9} color="#fff27a" opacity={0.95} />;
      })}
    </Macro>
  );
};

// ---------- muscle pair pulling on bone ----------
export const MuscleShot: React.FC<S & { cam: C }> = ({ t, cam }) => {
  const m = useBodyMats();
  const contract = 0.5 + 0.5 * Math.sin(t * Math.PI * 1.2);
  const bone = useMemo(() => tubeGeo([v(0, -3.2, 0), v(0, 3.2, 0)], 0.32, 40, 16).geo, []);
  return (
    <Macro cam={cam} t={t} top="#b01a50" bottom="#2a0218" tint="#ff6a7a">
      <mesh geometry={bone} material={m.bone} />
      {[-1, 1].map((s) => (
        <group key={s} position={[s * 0.85, 0, 0]}>
          <mesh material={m.muscle} scale={[1 + (s > 0 ? 0.0 : 0.25) * contract, lerp(2.6, 1.9, s > 0 ? contract : 1 - contract), 1]}>
            <capsuleGeometry args={[0.55, 1.6, 12, 32]} />
          </mesh>
          <mesh material={m.tendon} position={[0, s * 0, 0]} scale={[1, 1, 1]}>
            <cylinderGeometry args={[0.08, 0.08, 1.2, 10]} />
          </mesh>
        </group>
      ))}
      <Glow position={[0, 0, 0]} scale={3} color="#ff5a7a" opacity={0.3 + contract * 0.3} />
    </Macro>
  );
};

// ---------- gut cells taking up sugar ----------
export const GutShot: React.FC<S & { cam: C }> = ({ t, cam }) => {
  const m = useBodyMats();
  const geo = useMemo(() => blobGeometry(5, 0.18, 3, 1.6), []);
  const cellItems: Inst[] = useMemo(() => {
    const r = rng(8);
    return Array.from({ length: 36 }, () => ({ p: v((r() - 0.5) * 9, (r() - 0.5) * 5, (r() - 0.5) * 2), r: new THREE.Euler(r() * 3, r() * 3, 0), s: 0.8 + r() * 0.5 }));
  }, []);
  const sugar: Inst[] = useMemo(() => {
    const r = rng(19);
    return Array.from({ length: 120 }, (_, i) => ({ from: v(-5 + (r() - 0.5) * 2, 2.5 + r() * 1.5, 1), to: v((r() - 0.5) * 8, (r() - 0.5) * 4, 0), u0: r(), p: i }))
      .map((q) => ({ p: q.from, r: new THREE.Euler(), s: 0.09, c: "#fff27a", ...({ _to: q.to, _u0: q.u0 } as any) }));
  }, []);
  const moving: Inst[] = sugar.map((s: any) => {
    const u = (s._u0 + t * 0.25) % 1;
    return { p: s.p.clone().lerp(s._to, u), r: new THREE.Euler(), s: 0.09, c: "#fff27a" };
  });
  return (
    <Macro cam={cam} t={t} top="#9a3a10" bottom="#2a1002" tint="#ffb040">
      <Instances geometry={geo} material={m.cell} items={cellItems} max={36} />
      <Instances geometry={new THREE.SphereGeometry(1, 8, 6)} material={m.sugar} items={moving} max={120} />
    </Macro>
  );
};

// ---------- kidney filter ----------
export const KidneyShot: React.FC<S & { cam: C; zoom?: boolean }> = ({ t, cam, zoom }) => {
  const m = useBodyMats();
  const tub = useMemo(() => tubeGeo([v(-3, 1.5, 0), v(-1, -1.2, 0.4), v(1, 1.2, -0.4), v(3, -1.0, 0.2)], 0.3, 200, 14), []);
  const rbc = rbcGeometry();
  const items: Inst[] = useMemo(() => Array.from({ length: 50 }, (_, i) => ({ u0: (i / 50) % 1, a: i * 2.2 })), []).map((q) => {
    const u = (q.u0 + t * 0.2) % 1;
    return { p: tub.curve.getPointAt(u), r: new THREE.Euler(q.a, t, 0), s: 0.13, c: "#ff1238" };
  });
  const waste: Inst[] = useMemo(() => Array.from({ length: 30 }, (_, i) => ({ u0: i / 30, a: i })), []).map((q) => {
    const u = (q.u0 + t * 0.3) % 1;
    const p = tub.curve.getPointAt(0.999).clone().add(v(u * 3, -u * 2.5, 0.2 + u * 0.6));
    return { p, r: new THREE.Euler(), s: 0.07, c: "#ffd23a" };
  });
  return (
    <Macro cam={cam} t={t} top="#1a6a8a" bottom="#071a30" tint="#5fd0ff">
      <mesh geometry={tub.geo} material={m.vessel} />
      <Instances geometry={rbc} material={m.blood} items={items} max={50} />
      <Instances geometry={new THREE.SphereGeometry(1, 8, 6)} material={m.sugar} items={waste} max={30} />
      {zoom && <Glow position={[0, 0, 0]} scale={3} color="#5fd0ff" opacity={0.4} />}
    </Macro>
  );
};
