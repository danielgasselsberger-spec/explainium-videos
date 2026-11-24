import React, { useMemo } from "react";
import * as THREE from "three";
import { useEnvMap } from "../../engine/common";
import { Glow, Inst, Instances, Motes } from "../../engine/prims";
import { clamp, easeIn, easeInOut, easeOut, lerp, lerpV, range, rng, smooth } from "../../engine/lib";
import { Character, Pose, animPose, handFrame, pose } from "../../engine/Character";
import { Cam, Post, StudioLights } from "../../engine/common";
import { Backdrop } from "../../engine/prims";
import { World } from "../science02/Shots";

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const dist = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
type C = { pos: number[]; target: number[]; fov?: number; roll?: number };
const mv = (a: number[], b: number[], t: number, d: number, target: number[] | ((k: number) => number[]), fov = 40, roll = 0): C => {
  const k = easeInOut(clamp(t / d));
  return { pos: lerpV(a, b, k), target: typeof target === "function" ? target(k) : target, fov, roll };
};
const pushIn = (from: number[], to: number[], target: number[], t: number, d: number): C => {
  const k = easeIn(clamp(t / d));
  return { pos: lerpV(from, to, k), target, fov: lerp(42, 30, k) };
};

// ---------- materials ----------
export function useEngineMats() {
  const env = useEnvMap();
  return useMemo(() => {
    const block = new THREE.MeshStandardMaterial({ color: "#7d8aa6", metalness: 0.7, roughness: 0.4, envMap: env, envMapIntensity: 0.6 });
    const head = new THREE.MeshStandardMaterial({ color: "#c96a3a", metalness: 0.8, roughness: 0.35, envMap: env, envMapIntensity: 0.8 });
    const steel = new THREE.MeshStandardMaterial({ color: "#c9d2de", metalness: 0.5, roughness: 0.4, envMap: env, envMapIntensity: 0.5 });
    const piston = new THREE.MeshStandardMaterial({ color: "#ffb08a", metalness: 0.4, roughness: 0.4, envMap: env, envMapIntensity: 0.5 });
    const rod = new THREE.MeshStandardMaterial({ color: "#9aa4b8", metalness: 0.8, roughness: 0.3, envMap: env });
    const valve = new THREE.MeshStandardMaterial({ color: "#ff3355", metalness: 0.5, roughness: 0.3, envMap: env, emissive: new THREE.Color("#8a0a20"), emissiveIntensity: 0.4 });
    const cyl = new THREE.MeshPhysicalMaterial({ color: "#2fe8ff", transparent: true, opacity: 0.18, roughness: 0.05, clearcoat: 1, depthWrite: false });
    const spark = new THREE.MeshBasicMaterial({ color: "#fff6a0", toneMapped: false });
    const gasMat = new THREE.MeshBasicMaterial({ color: "#ffffff", toneMapped: false, transparent: true, opacity: 0.8, depthWrite: false });
    const cr = new THREE.MeshStandardMaterial({ color: "#ffd23a", metalness: 0.85, roughness: 0.3, envMap: env, emissive: new THREE.Color("#8a6a0a"), emissiveIntensity: 0.25 });
    const wheel = new THREE.MeshStandardMaterial({ color: "#26232e", roughness: 0.6 });
    const rim = new THREE.MeshStandardMaterial({ color: "#3ff0e0", metalness: 0.9, roughness: 0.2, envMap: env, emissive: new THREE.Color("#0a8a80"), emissiveIntensity: 0.4 });
    return { block, head, steel, piston, rod, valve, cyl, spark, gasMat, cr, wheel, rim };
  }, [env]);
}
export type EM = ReturnType<typeof useEngineMats>;

// ---------- one cylinder with piston, rod, valves, spark; axis = y, crank in xz at x=0 ----------
// stroke phase `ph` in [0,1): 0 = top dead centre at start of intake
const strokeOf = (ph: number) => {
  // four strokes over ph in [0,1): intake, compression, power, exhaust
  const s = Math.floor(ph * 4) % 4;
  const u = ph * 4 - Math.floor(ph * 4);
  return { s, u };
};
export const Cylinder: React.FC<{ m: EM; crank: number; x: number; z: number; mix?: number; sparkAt?: number; burn?: number; exhaust?: number; t: number; cut?: boolean }> = ({ m, crank, x, z, mix = 0, sparkAt, burn = 0, exhaust = 0, t, cut }) => {
  // crank angle -> piston height (slider-crank)
  const R = 0.7, L = 2.1;
  const sinA = Math.sin(crank), cosA = Math.cos(crank);
  const pistonY = 0.5 + R * cosA + Math.sqrt(Math.max(0.0001, L * L - R * R * sinA * sinA)) - L + 1.6;
  const topY = 2.2;
  const pY = Math.min(topY - 0.2, pistonY);
  const gasH = Math.max(0.2, pY - 0.5);
  const compress = clamp(1 - (pY - 0.5) / (topY - 0.7));
  return (
    <group position={[x, 0, z]}>
      {/* cylinder wall (glass, cut-away front half) */}
      <mesh material={m.cyl} position={[0, 1.6, 0]}>
        <cylinderGeometry args={[0.62, 0.62, 2.8, 40, 1, true, cut ? Math.PI : 0, Math.PI * 2]} />
      </mesh>
      {/* fuel-air mix below piston */}
      {mix > 0 && (
        <mesh position={[0, 0.5 + gasH / 2, 0]} scale={[0.55, gasH / 2, 0.55]}>
          <cylinderGeometry args={[1, 1, 1, 32, 1, false]} />
          <meshBasicMaterial color={burn > 0 ? "#ff7a1a" : compress > 0.4 ? "#ffd27a" : "#bff8ff"} transparent opacity={0.45} toneMapped={false} depthWrite={false} />
        </mesh>
      )}
      {/* piston crown + rings */}
      <mesh material={m.piston} position={[0, pY, 0]}>
        <cylinderGeometry args={[0.56, 0.56, 0.32, 40]} />
      </mesh>
      <mesh material={m.piston} position={[0, pY - 0.22, 0]}>
        <cylinderGeometry args={[0.52, 0.52, 0.3, 40]} />
      </mesh>
      {/* connecting rod */}
      <mesh material={m.rod} position={[0, (pY + 0.9) / 2 - 0.1, 0]} scale={[1, Math.max(0.2, (pY - 0.9) / 1), 1]}>
        <boxGeometry args={[0.12, 1, 0.12]} />
      </mesh>
      {/* valves: intake (left) opens in intake stroke, exhaust (right) in exhaust stroke */}
      {[-1, 1].map((s) => {
        const open = s < 0 ? (strokeOf(crank / (2 * Math.PI) * 0.5).s === 0 ? 1 : 0) : (strokeOf(crank / (2 * Math.PI) * 0.5).s === 3 ? 1 : 0);
        return (
          <group key={s} position={[s * 0.3, 2.42, 0]}>
            <mesh material={s < 0 ? m.steel : m.valve} position={[0, -open * 0.12, 0]}>
              <cylinderGeometry args={[0.07, 0.07, 0.8, 12]} />
            </mesh>
            <mesh material={s < 0 ? m.steel : m.valve} position={[0, -0.36 - open * 0.12, 0]} rotation={[Math.PI, 0, 0]}>
              <coneGeometry args={[0.12, 0.1, 16]} />
            </mesh>
          </group>
        );
      })}
      {/* spark plug */}
      <mesh material={m.steel} position={[0, 2.6, 0]}>
        <cylinderGeometry args={[0.07, 0.07, 0.4, 12]} />
      </mesh>
      {sparkAt !== undefined && sparkAt > 0 && sparkAt < 1 && (
        <>
          <mesh material={m.spark} position={[0, 2.25, 0]}>
            <sphereGeometry args={[0.07 + 0.05 * Math.sin(sparkAt * Math.PI), 12, 8]} />
          </mesh>
          <Glow position={[0, 2.25, 0]} scale={1.1 * Math.sin(sparkAt * Math.PI)} color="#fff6a0" opacity={Math.sin(sparkAt * Math.PI)} />
        </>
      )}
      {burn > 0 && <Glow position={[0, 1.0, 0]} scale={2.2 * burn} color="#ff7a1a" opacity={0.85 * burn} />}
      {exhaust > 0 && (
        <Motes t={t} count={12} spread={1.2} center={[0, 2.8 + exhaust, 0]} color="#c8c8d4" size={0.12} opacity={exhaust} />
      )}
    </group>
  );
};

// ---------- whole engine block: 4 cylinders in a row (x), crank along x ----------
export const Block: React.FC<{ m: EM; t: number; rpm?: number; cut?: boolean; phaseOffset?: number; mixOn?: boolean; sparkOn?: boolean; burnOn?: boolean; exhaustOn?: boolean; x?: number }> = ({ m, t, rpm = 1, cut = false, phaseOffset = 0, mixOn = true, sparkOn = true, burnOn = true, exhaustOn = true, x = 0 }) => {
  const crankBase = t * rpm * Math.PI * 2 * 0.5;
  const cyls = [-1.5, -0.5, 0.5, 1.5];
  return (
    <group position={[x, 0, 0]}>
      {/* engine block */}
      <mesh material={m.block} position={[0, -0.2, 0]}>
        <boxGeometry args={[4.2, 0.8, 1.9]} />
      </mesh>
      {/* crankshaft (along x) */}
      <mesh material={m.cr} rotation={[0, 0, Math.PI / 2]} position={[0, 0, 0]}>
        <cylinderGeometry args={[0.1, 0.1, 4.6, 12]} />
      </mesh>
      {/* cylinder head */}
      <mesh material={m.head} position={[0, 2.85, 0]}>
        <boxGeometry args={[4.2, 0.6, 1.9]} />
      </mesh>
      {cyls.map((cx, i) => {
        const crank = crankBase + i * (Math.PI / 2) + phaseOffset;
        const ph = ((crank / (2 * Math.PI)) * 0.5 % 1 + 1) % 1; // cycle 0..1 over two revolutions
        const s = strokeOf(ph);
        const mix = mixOn && s.s === 0 ? 0 : mixOn && s.s < 2 ? 1 : 0;
        const sparkAt = sparkOn && s.s === 2 && s.u < 0.12 ? s.u / 0.12 : undefined;
        const burn = burnOn && s.s === 2 ? Math.max(0, 1 - s.u * 2) : 0;
        const exhaust = exhaustOn && s.s === 3 ? s.u : 0;
        return (
          <Cylinder key={i} m={m} crank={crank} x={cx} z={0} mix={mix} sparkAt={sparkAt} burn={burn} exhaust={exhaust} t={t} cut={cut} />
        );
      })}
      {/* intake pipe (air + fuel) into the head, left side */}
      <mesh material={m.steel} position={[-2.6, 3.3, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.28, 0.28, 2.2, 24]} />
      </mesh>
      {/* exhaust manifold & intake */}
      <mesh material={m.steel} position={[0, 3.25, 1.2]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.2, 0.2, 2.0, 16]} />
      </mesh>
    </group>
  );
};

// ---------- wheel, drive shaft wiring ----------
export const Wheel: React.FC<{ m: EM; t: number; spin: number; position?: any; scale?: number }> = ({ m, spin, position, scale = 1 }) => (
  <group position={position} scale={scale}>
    <mesh material={m.wheel} rotation={[0, 0, spin]}>
      <cylinderGeometry args={[1, 1, 0.5, 40]} />
    </mesh>
    <mesh material={m.rim} rotation={[0, 0, spin]} position={[0, 0.27, 0]}>
      <cylinderGeometry args={[0.55, 0.55, 0.02, 40]} />
    </mesh>
  </group>
);

// =====================================================================================
// character bench: a little engine on the table, he points / turns the crank
// =====================================================================================
const TY = -2.8;
const ENG_POS: [number, number, number] = [0.0, TY + 0.05, 1.7];
const ENG_S = 0.26;
const LOOP_CAM: C = { pos: [3.4, -0.2, 7.6], target: [0.2, -1.5, 1.2], fov: 44 };
const BASE = { rw: [-1.4, -2.5, 1.5], rp: [-2.2, -2.2, -1] };
const IDLE = pose({ ...BASE, lw: [1.4, -2.5, 1.5], lp: [2.3, -2.2, -0.6], eyeYaw: 0.25, eyePitch: -0.35, brow: 0.6, smile: 0.8, head: [0.18, 0.15, 0] });

const Bench: React.FC<{ t: number; gt: number; p: Pose; cam: C; rpm?: number; cut?: boolean; top?: string; bottom?: string; extra?: React.ReactNode; engine?: boolean }> = ({ t, gt, p, cam, rpm = 0, top = "#cdeeff", bottom = "#5fb8f0", extra, engine = true, cut }) => {
  const m = useEngineMats();
  return (
    <>
      <Backdrop top={top} bottom={bottom} />
      <StudioLights />
      <Cam {...cam} t={t} />
      <Character p={p} t={gt}>
        {engine && (
          <group position={ENG_POS} scale={ENG_S}>
            <Block m={m} t={t} rpm={rpm} cut={cut} />
          </group>
        )}
        {extra}
      </Character>
      <Post focus={dist(cam.pos, ENG_POS)} bokeh={4} bloom={0.55} />
    </>
  );
};

const HookShot = (t: number, d: number, gt: number) => {
  const p = animPose(t, [
    [0, IDLE],
    [0.3, pose({ ...IDLE, lw: [1.45, -2.3, 1.45], mouth: 0.4 })],
    [d, pose({ ...IDLE, lw: [1.5, -2.3, 1.4], lid: 1.15, brow: 0.9, mouth: 0.5, smile: 1, head: [0.15, 0.2, 0] })],
  ]);
  const k = easeInOut(range(t, 0, d));
  const cam = { pos: lerpV(LOOP_CAM.pos, [3.0, -0.6, 6.4], k), target: lerpV(LOOP_CAM.target, [0.2, -1.8, 1.3], k), fov: lerp(44, 42, k) };
  return <Bench t={t} gt={gt} p={p} cam={cam} rpm={0} />;
};

const ToolShot = (t: number, d: number, gt: number) => {
  const p = animPose(t, [
    [0, IDLE],
    [d, pose({ ...IDLE, lw: [1.1, -2.1, 1.7], lp: [2.3, -2.2, -0.2], eyePitch: -0.4, brow: 0.7, mouth: 0.3, smile: 0.9 })],
  ]);
  return <Bench t={t} gt={gt} p={p} cam={pushIn([2.0, -0.4, 6.8], [1.3, -1.6, 3.6], [ENG_POS[0], TY + 0.6, ENG_POS[2]], t, d)} rpm={0} />;
};

// crank turning shot: he turns the handle, the engine runs
const CrankShot = (t: number, d: number, gt: number) => {
  const turn = easeInOut(range(t, 0.1, d));
  const p = pose({ ...IDLE, lw: [1.15, -2.2 + 0.1 * Math.sin(turn * 8), 1.55], lp: [2.3, -2.2, -0.6], eyePitch: -0.4, brow: 0.6, smile: 0.7, head: [0.2, 0.1, 0] });
  return <Bench t={t} gt={gt} p={p} cam={pushIn([1.2, -0.5, 6.8], [0.8, -1.5, 4.0], [ENG_POS[0], TY + 0.8, ENG_POS[2]], t, d)} rpm={t * 1.2} />;
};

// macro shots
// =====================================================================================
const Stage: React.FC<{ cam: C; t: number; top?: string; bottom?: string; children: React.ReactNode; bloom?: number; fog?: string }> = ({ cam, t, top = "#2a0a6a", bottom = "#0a0220", children, bloom = 0.9, fog }) => (
  <World cam={cam} t={t} top={top} bottom={bottom} bloom={bloom} fog={fog}>
    {children}
  </World>
);

// one cylinder cut-away at a given phase (0..1 over one cycle of four strokes)
const CylShot = (t: number, d: number, cam: C, ph0: number, ph1: number, opts: { mix?: boolean; spark?: boolean; burn?: boolean; exhaust?: boolean; top?: string; bottom?: string } = {}) => {
  const ph = lerp(ph0, ph1, clamp(t / d));
  const crank = ph * Math.PI * 2 * 2;
  const s = strokeOf(ph);
  return (
    <Stage cam={cam} t={t} top={opts.top} bottom={opts.bottom}>
      <CylinderShot t={t} crank={crank} s={s} opts={opts} />
    </Stage>
  );
};

const CylinderShot: React.FC<{ t: number; crank: number; s: { s: number; u: number }; opts: { mix?: boolean; spark?: boolean; burn?: boolean; exhaust?: boolean } }> = ({ t, crank, s, opts }) => {
  const m = useEngineMats();
  const mix = opts.mix && s.s < 2 ? 1 : 0;
  const sparkAt = opts.spark && s.s === 2 && s.u < 0.12 ? s.u / 0.12 : undefined;
  const burn = opts.burn && s.s === 2 ? Math.max(0, 1 - s.u * 2) : 0;
  const exhaust = opts.exhaust && s.s === 3 ? s.u : 0;
  return <Cylinder m={m} crank={crank} x={0} z={0} mix={mix} sparkAt={sparkAt} burn={burn} exhaust={exhaust} t={t} cut />;
};

// intake: air + fuel mist flows in
export const IntakeMist: React.FC<{ t: number }> = ({ t }) => {
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ color: "#bff8ff", toneMapped: false, transparent: true, opacity: 0.8, depthWrite: false }), []);
  const geo = useMemo(() => new THREE.SphereGeometry(1, 6, 4), []);
  const items: Inst[] = Array.from({ length: 120 }, (_, i) => {
    const u = (t * 0.5 + i / 120) % 1;
    const a = i * 2.4;
    return { p: v(-3 + u * 2.8, 2.9 + Math.sin(a) * 0.5 * (1 - u), Math.cos(a) * 0.5), r: new THREE.Euler(), s: 0.05 + 0.05 * (1 - u) };
  });
  return <Instances geometry={geo} material={mat} items={items} max={120} />;
};

// exhaust gas out
export const ExhaustPuff: React.FC<{ t: number }> = ({ t }) => {
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ color: "#c8c8d4", toneMapped: false, transparent: true, opacity: 0.55, depthWrite: false }), []);
  const geo = useMemo(() => new THREE.SphereGeometry(1, 8, 6), []);
  const items: Inst[] = Array.from({ length: 80 }, (_, i) => {
    const u = (t * 0.6 + i / 80) % 1;
    return { p: v(3.5 + u * 3, 3.2 + u * 1.5, 0.8 + Math.sin(i) * 0.2), r: new THREE.Euler(), s: 0.1 + u * 0.4 };
  });
  return <Instances geometry={geo} material={mat} items={items} max={80} />;
};

const FullEngine = (t: number, d: number, cam: C, rpm = 1, extra?: React.ReactNode, top?: string, bottom?: string) => {
  const m = useEngineMats();
  return (
    <Stage cam={cam} t={t} top={top} bottom={bottom}>
      <Block m={m} t={t} rpm={rpm} cut />
      {extra}
    </Stage>
  );
};

// the rest of the sequence lives in the shot list below
const CrankWheels: React.FC<{ t: number; d: number; cam: C }> = ({ t, d, cam }) => {
  const m = useEngineMats();
  const spin = t * 4;
  return (
    <Stage cam={cam} t={t} top="#1a5a9a" bottom="#0a1a3a">
      <group position={[0, 0, 0]} scale={0.9}>
        <Block m={m} t={t} rpm={1} cut />
      </group>
      {[-3.2, 3.2].map((x, i) => (
        <group key={i} position={[x, -2.2, 1.3]} rotation={[0, Math.PI / 2, 0]}>
          <Wheel m={m} t={t} spin={spin} scale={1.25} />
        </group>
      ))}
      <mesh material={m.cr} position={[0, -2.2, 0.0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.12, 0.12, 6.4, 12]} />
      </mesh>
      <Motes t={t} count={30} spread={16} size={0.05} color="#d8f0ff" />
    </Stage>
  );
};

// =====================================================================================
// components wrapping each shot (hooks must run inside the Canvas tree)
// =====================================================================================
const FullEngineC: React.FC<{ t: number; d: number; cam: C; rpm?: number; extra?: React.ReactNode; top?: string; bottom?: string }> = ({ t, d, cam, rpm = 1, extra, top, bottom }) => {
  const m = useEngineMats();
  return (
    <Stage cam={cam} t={t} top={top} bottom={bottom}>
      <Block m={m} t={t} rpm={rpm} cut />
      {extra}
    </Stage>
  );
};

const CylShotC: React.FC<{ t: number; d: number; cam: C; ph0: number; ph1: number; opts?: { mix?: boolean; spark?: boolean; burn?: boolean; exhaust?: boolean; top?: string; bottom?: string } }> = ({ t, d, cam, ph0, ph1, opts = {} }) => {
  const ph = lerp(ph0, ph1, clamp(t / d));
  const crank = ph * Math.PI * 2 * 2;
  const s = strokeOf(ph);
  return (
    <Stage cam={cam} t={t} top={opts.top} bottom={opts.bottom}>
      <CylinderShot t={t} crank={crank} s={s} opts={opts} />
    </Stage>
  );
};

const HookShotC: React.FC<{ t: number; d: number; gt: number }> = ({ t, d, gt }) => <>{HookShot(t, d, gt)}</>;
const ToolShotC: React.FC<{ t: number; d: number; gt: number }> = ({ t, d, gt }) => <>{ToolShot(t, d, gt)}</>;
const CrankShotC: React.FC<{ t: number; d: number; gt: number }> = ({ t, d, gt }) => <>{CrankShot(t, d, gt)}</>;

// =====================================================================================
// shot list
// =====================================================================================
const CYL = { top: "#2a6ab0", bottom: "#071a40" };
export const SHOTS = [
  { a: 0, b: 2.06, kind: "char" as const, el: (t: number, d: number, gt: number) => <HookShotC t={t} d={d} gt={gt} /> },
  { a: 2.06, b: 3.2, kind: "macro" as const, el: (t: number, d: number) => <FullEngineC t={t} d={d} rpm={0.4} cam={mv([-6, 3.2, 9], [-4, 2.8, 8], t, d, [-1, 1.8, 0], 40)} /> },
  { a: 3.2, b: 5.73, kind: "macro" as const, el: (t: number, d: number) => <FullEngineC t={t} d={d} rpm={0.9} cam={mv([2, 4.4, 10], [0.6, 3.8, 6.4], t, d, [0, 1.8, 0], 40)} extra={<ExhaustPuff t={t} />} /> },
  { a: 5.73, b: 7.6, kind: "macro" as const, el: (t: number, d: number) => <FullEngineC t={t} d={d} rpm={1.1} cam={mv([0, 1.4, 10], [0.6, 1.2, 6.5], t, d, [0, 1.5, 0], 42)} /> },
  { a: 7.6, b: 9.93, kind: "char" as const, el: (t: number, d: number, gt: number) => <ToolShotC t={t} d={d} gt={gt} /> },
  { a: 9.93, b: 11.72, kind: "macro" as const, el: (t: number, d: number) => <CylShotC t={t} d={d} cam={mv([2.5, 3.2, 6.5], [1.5, 2.2, 3.4], t, d, [0, 1.3, 0], 42)} ph0={0} ph1={0.25} opts={CYL} /> },
  { a: 11.72, b: 14.55, kind: "macro" as const, el: (t: number, d: number) => <CylShotC t={t} d={d} cam={mv([-3, 1.5, 6.5], [-1.4, 1.2, 4.0], t, d, [0, 1.2, 0], 42)} ph0={0} ph1={0.25} opts={CYL} /> },
  { a: 14.55, b: 16.61, kind: "macro" as const, el: (t: number, d: number) => <CylShotC t={t} d={d} cam={mv([0, 3.4, 7], [0.3, 2.2, 4.5], t, d, [0, 1.4, 0], 40)} ph0={0.05} ph1={0.22} opts={{ mix: true, top: "#b01a7a", bottom: "#1a0630" }} /> },
  { a: 16.61, b: 19.05, kind: "macro" as const, el: (t: number, d: number) => <CylShotC t={t} d={d} cam={mv([2, 1.0, 5.5], [0.5, 1.0, 3.5], t, d, [0, 1.2, 0], 40)} ph0={0.02} ph1={0.16} opts={{ mix: true, top: "#7a1a9a", bottom: "#0e0226" }} /> },
  { a: 19.05, b: 21.5, kind: "macro" as const, el: (t: number, d: number) => <CylShotC t={t} d={d} cam={mv([-3.5, 2.8, 6.5], [-1.6, 2.0, 3.8], t, d, [0, 1.6, 0], 42)} ph0={0.2} ph1={0.42} opts={{ mix: true, top: "#7a1a9a", bottom: "#0e0226" }} /> },
  { a: 21.5, b: 23.62, kind: "macro" as const, el: (t: number, d: number) => <CylShotC t={t} d={d} cam={mv([1.4, 1.2, 4.5], [0.2, 1.6, 3.0], t, d, [0, 1.4, 0], 40)} ph0={0.4} ph1={0.52} opts={{ mix: true, top: "#7a1a9a", bottom: "#0e0226" }} /> },
  { a: 23.62, b: 27.12, kind: "macro" as const, el: (t: number, d: number) => <CylShotC t={t} d={d} cam={mv([0.5, 3.6, 8], [0.2, 2.6, 5.2], t, d, [0, 1.6, 0], 40)} ph0={0.5} ph1={0.74} opts={{ mix: true, top: "#ff3a6a", bottom: "#2a0220" }} /> },
  { a: 27.12, b: 28.93, kind: "macro" as const, el: (t: number, d: number) => <CylShotC t={t} d={d} cam={mv([1.8, 2.8, 4.0], [0.6, 2.3, 2.6], t, d, [0, 2.0, 0], 36)} ph0={0.7} ph1={0.8} opts={{ mix: true, spark: true, top: "#ff5a1a", bottom: "#2a0a10" }} /> },
  { a: 28.93, b: 31.0, kind: "macro" as const, el: (t: number, d: number) => <CylShotC t={t} d={d} cam={mv([-2.5, 2.4, 4.5], [-0.6, 2.0, 3.0], t, d, [0, 2.0, 0], 40)} ph0={0.76} ph1={0.84} opts={{ mix: true, spark: true, burn: true, top: "#ff5a1a", bottom: "#2a0a10" }} /> },
  { a: 31.0, b: 33.79, kind: "macro" as const, el: (t: number, d: number) => <CylShotC t={t} d={d} cam={mv([0, 3.8, 5.5], [0, 2.8, 3.5], t, d, [0, 1.8, 0], 40)} ph0={0.8} ph1={0.9} opts={{ burn: true, top: "#ff7a1a", bottom: "#2a0a10" }} /> },
  { a: 33.79, b: 37.12, kind: "macro" as const, el: (t: number, d: number) => <CylShotC t={t} d={d} cam={mv([3, 1.5, 6], [1.2, 1.5, 4.0], t, d, [0, 1.5, 0], 40)} ph0={0.82} ph1={1.0} opts={{ burn: true, top: "#ff3a6a", bottom: "#1a0424" }} /> },
  { a: 37.12, b: 37.88, kind: "macro" as const, el: (t: number, d: number) => <CylShotC t={t} d={d} cam={mv([0, 3.4, 9], [0, 2.8, 7], t, d, [0, 2.0, 0], 40)} ph0={0.0} ph1={0.1} opts={{ exhaust: true, top: "#2a0a6a", bottom: "#070220" }} /> },
  { a: 37.88, b: 39.95, kind: "macro" as const, el: (t: number, d: number) => <CylShotC t={t} d={d} cam={mv([-2.5, 2.2, 6], [-1.0, 2.0, 4], t, d, [0, 2.2, 0], 40)} ph0={0.25} ph1={0.5} opts={{ exhaust: true, top: "#5a1a8a", bottom: "#0e0226" }} /> },
  { a: 39.95, b: 43.85, kind: "macro" as const, el: (t: number, d: number) => <CylShotC t={t} d={d} cam={mv([2.5, 2.6, 6], [0.8, 2.4, 4], t, d, [0, 2.2, 0], 40)} ph0={0.5} ph1={0.78} opts={{ exhaust: true, top: "#5a1a8a", bottom: "#0e0226" }} /> },
  { a: 43.85, b: 44.7, kind: "macro" as const, el: (t: number, d: number) => <CylShotC t={t} d={d} cam={mv([0, 3.0, 9], [0, 2.4, 6], t, d, [0, 2.2, 0], 40)} ph0={0.78} ph1={1.0} opts={{ exhaust: true, top: "#2a0a6a", bottom: "#070220" }} /> },
  { a: 44.7, b: 47.48, kind: "macro" as const, el: (t: number, d: number) => <FullEngineC t={t} d={d} rpm={1.1} cam={mv([-6, 2.4, 10], [-4, 2.0, 7], t, d, [0, 1.8, 0], 42)} extra={<ExhaustPuff t={t} />} /> },
  { a: 47.48, b: 50.65, kind: "macro" as const, el: (t: number, d: number) => <FullEngineC t={t} d={d} rpm={1.3} cam={mv([0.5, 4.2, 10], [0.5, 3.2, 7], t, d, [0, 1.6, 0], 42)} /> },
  { a: 50.65, b: 54.3, kind: "macro" as const, el: (t: number, d: number) => <FullEngineC t={t} d={d} rpm={1.3} cam={mv([-3, 2.0, 11], [-1, 2.0, 9], t, d, [0, 1.2, 0], 44)} extra={<IntakeMist t={t} />} /> },
  { a: 54.3, b: 56.17, kind: "char" as const, el: (t: number, d: number, gt: number) => <CrankShotC t={t} d={d} gt={gt} /> },
  { a: 56.17, b: 59.98, kind: "macro" as const, el: (t: number, d: number) => <CrankWheels t={t} d={d} cam={mv([-6, 1.6, 10], [-3, 0.6, 9], t, d, [0, -0.8, 0], 44)} /> },
  { a: 59.98, b: 60.36, kind: "macro" as const, el: (t: number, d: number) => <CrankWheels t={t} d={d} cam={mv([3, 1, 9], [2, 0.8, 8], t, d, [1, -0.9, 0], 44)} /> },
  { a: 60.36, b: 63.9, kind: "char" as const, el: (t: number, d: number, gt: number) => <HookShotC t={t} d={d} gt={gt} /> },
];

export const SFX: [number, string, number][] = [
  [0.6, "thud", 0.6], [2.4, "shimmer", 0.35], [5.9, "pop", 0.35], [9.95, "clink", 0.4], [11.8, "plop", 0.35], [14.6, "plop", 0.35], [17.5, "drop", 0.35],
  [19.1, "pop", 0.4], [23.7, "thud", 0.45], [28.9, "pop", 0.55], [30.9, "thud", 0.5], [35.5, "shimmer", 0.35], [40.0, "pop", 0.35], [44.8, "drop", 0.35],
  [47.5, "timelapse", 0.25], [50.7, "shimmer", 0.35], [54.3, "clink", 0.4], [56.2, "timelapse", 0.25], [60.4, "shimmer", 0.4],
];

