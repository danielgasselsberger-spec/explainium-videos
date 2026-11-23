import React, { useMemo } from "react";
import * as THREE from "three";
import { Character, P, Pose, RAISED, animPose, handFrame, pose } from "../../engine/Character";
import { Cam, MacroLights, Post, StudioLights } from "../../engine/common";
import { Backdrop, Glow, Inst, Instances, Motes, tubeGeo } from "../../engine/prims";
import { clamp, easeIn, easeInOut, easeOut, lerp, lerpV, mixColor, range, rng, smooth } from "../../engine/lib";
import { Car, Coil, Engine, FM, HandTool, Press, Robot, Sparks, toolTip, useFactoryMats } from "./Car";

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const dist = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
type C = { pos: number[]; target: number[]; fov?: number; roll?: number };
export type S = { t: number; d: number; gt: number; cam?: C };

// =====================================================================================
// character side: workbench with a mini car
// =====================================================================================
const TABLE_Y = -2.8;
const MINI = 0.36; // mini car scale
export const MINI_POS: [number, number, number] = [0.05, TABLE_Y, 1.25];

const CharStage: React.FC<{ cam: C; t: number; top?: string; bottom?: string; focus?: number; children: React.ReactNode; shake?: number }> = ({ cam, t, top = "#cdeeff", bottom = "#5fb8f0", focus, children, shake = 0 }) => (
  <>
    <Backdrop top={top} bottom={bottom} />
    <StudioLights />
    <Cam {...cam} t={t} shake={shake} />
    {children}
    <Post focus={focus ?? dist(cam.pos, cam.target)} bokeh={4} bloom={0.55} />
  </>
);

// hammer poses
export const HAMMER_UP = pose({ ...RAISED, lw: [1.75, -0.55, 0.95], lp: [2.4, -2.0, -0.3], eyeYaw: 0.25, eyePitch: -0.35, brow: 0.5, smile: 0.7, head: [0.15, 0.2, -0.05] });
const HAMMER_HIT = pose({ lw: [0.55, -1.78, 1.3], lp: [1.6, -1.9, -0.6], eyeYaw: 0.25, eyePitch: -0.45, lid: 0.35, brow: -0.6, mouth: 0.6, smile: 0, head: [0.25, 0.15, 0.08] });
export const LOOP_CAM: C = { pos: [2.6, -0.3, 6.8], target: [0.45, -1.35, 0.9], fov: 42 };
const HOOK_END: C = { pos: [1.9, -0.9, 5.3], target: [0.3, -2.0, 1.1], fov: 40 };

const Sheet: React.FC<{ m: FM; dent?: number; position?: any }> = ({ m, position, dent = 0 }) => (
  <mesh material={m.steel} position={position} scale={[1, 1 + dent * 2, 1]}>
    <boxGeometry args={[1.5, 0.05, 0.95]} />
  </mesh>
);

// 1) hook: hammer strike on a steel sheet, sparks, the sheet pops into a car shell
export const HookShot: React.FC<S> = ({ t, gt }) => {
  const m = useFactoryMats();
  const hit = 0.62;
  const p = animPose(t, [
    [0, HAMMER_UP],
    [0.3, pose({ ...HAMMER_UP, lw: [1.8, -0.4, 0.8] })],
    [hit, HAMMER_HIT, easeIn],
    [hit + 0.3, pose({ ...HAMMER_HIT, lw: [0.65, -1.6, 1.25], lid: 1.1, brow: 0.9, mouth: 0.5, smile: 0.6 })],
    [2.2, pose({ ...HAMMER_HIT, lw: [1.0, -1.5, 1.0], lid: 1.15, brow: 1, mouth: 0.4, smile: 0.9, eyePitch: -0.4 })],
  ]);
  const hf = handFrame(p, "l");
  const k = easeInOut(range(t, 0, 2.2));
  const cam = { pos: lerpV(LOOP_CAM.pos, HOOK_END.pos, k), target: lerpV(LOOP_CAM.target, HOOK_END.target, k), fov: lerp(LOOP_CAM.fov!, HOOK_END.fov!, k) };
  const age = t - hit;
  const pop = smooth(range(t, hit + 0.05, hit + 0.45));
  return (
    <CharStage cam={cam} t={t} shake={age > 0 ? 0.1 * Math.exp(-age * 7) : 0} focus={dist(cam.pos, [0.3, -2.2, 1.2]) * 0.98}>
      <Character p={p} t={gt}>
        <HandTool m={m} hand={hf.hand} dir={hf.dir} kind="hammer" />
        {pop < 1 && <Sheet m={m} position={[MINI_POS[0], TABLE_Y + 0.03, MINI_POS[2]]} dent={age > 0 ? Math.exp(-age * 8) : 0} />}
        {pop > 0 && <Car m={m} paint={0} glass={0} wheels={0} position={MINI_POS} scale={MINI * (0.3 + 0.7 * easeOut(pop)) * (1 + Math.sin(pop * Math.PI) * 0.15)} />}
        {age > 0 && <Sparks age={age} seed={3} count={70} speed={2.6} position={[MINI_POS[0] + 0.1, TABLE_Y + 0.08, MINI_POS[2]]} size={0.8} />}
        {age > 0 && age < 0.5 && <Glow position={[MINI_POS[0], TABLE_Y + 0.2, MINI_POS[2]]} scale={0.8 + age * 5} color="#fff2c0" opacity={1 - age / 0.5} />}
      </Character>
    </CharStage>
  );
};

// generic character shot with a mini car on the table
export const BenchShot: React.FC<
  Omit<S, "cam"> & { p: (t: number) => Pose; cam: (k: number) => C; car?: (t: number) => any; extra?: (t: number, p: Pose, m: FM) => React.ReactNode; top?: string; bottom?: string; tool?: "hammer" | "torch" | "hose"; toolSide?: "l" | "r" }
> = ({ t, d, gt, p, cam, car, extra, top, bottom, tool, toolSide = "l" }) => {
  const m = useFactoryMats();
  const pp = p(t);
  const c = cam(easeInOut(range(t, 0, d)));
  const cs = car ? car(t) : { paint: 1 };
  const hf = handFrame(pp, toolSide);
  return (
    <CharStage cam={c} t={t} top={top} bottom={bottom} focus={dist(c.pos, [MINI_POS[0], MINI_POS[1] + 0.5, MINI_POS[2]])}>
      <Character p={pp} t={gt}>
        {cs && <Car m={m} position={cs.position ?? MINI_POS} scale={MINI} t={gt} {...cs} />}
        {tool && <HandTool m={m} hand={hf.hand} dir={hf.dir} kind={tool} />}
        {extra && extra(t, pp, m)}
      </Character>
    </CharStage>
  );
};

// press shot props: mini press on the table
export const MiniPress: React.FC<{ m: FM; ram: number }> = ({ m, ram }) => <Press m={m} ram={ram} position={[MINI_POS[0], TABLE_Y + 0.25, MINI_POS[2] - 0.1]} scale={0.32} />;

// =====================================================================================
// macro side
// =====================================================================================
export const World: React.FC<{ cam: C; t: number; top?: string; bottom?: string; tint?: string; rim?: string; bloom?: number; focus?: number; bokeh?: number; shake?: number; fog?: string; children: React.ReactNode }> = ({
  cam, t, top = "#7a1a9a", bottom = "#14062e", tint = "#ff3fb0", rim = "#2ff0ff", bloom = 1.1, focus, bokeh = 4, shake = 0, fog, children,
}) => (
  <>
    <Backdrop top={top} bottom={bottom} />
    {fog && <fog attach="fog" args={[fog, 12, 70]} />}
    <MacroLights tint={tint} rim={rim} />
    <Cam {...cam} t={t} shake={shake} />
    {children}
    <Post focus={focus ?? dist(cam.pos, cam.target)} bokeh={bokeh} bloom={bloom} />
  </>
);

const Floor: React.FC<{ color?: string; y?: number; grid?: boolean }> = ({ color = "#2a0c4a", y = 0, grid = true }) => {
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.3 }), [color]);
  const lineMat = useMemo(() => new THREE.MeshBasicMaterial({ color: "#ff3fb0", toneMapped: false, transparent: true, opacity: 0.55 }), []);
  return (
    <group position={[0, y, 0]}>
      <mesh material={mat} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[200, 200]} />
      </mesh>
      {grid &&
        Array.from({ length: 21 }, (_, i) => (
          <React.Fragment key={i}>
            <mesh material={lineMat} position={[(i - 10) * 4, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[0.05, 80]} />
            </mesh>
            <mesh material={lineMat} position={[0, 0.01, (i - 10) * 4]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[80, 0.05]} />
            </mesh>
          </React.Fragment>
        ))}
    </group>
  );
};

// ---- steel coil hero + ribbon ----
const Ribbon: React.FC<{ m: FM; t: number; length?: number }> = ({ m, t, length = 120 }) => {
  const band = useMemo(() => new THREE.MeshStandardMaterial({ color: "#5d6680", metalness: 0.7, roughness: 0.5, envMap: m.steel.envMap, envMapIntensity: 0.4 }), [m]);
  const stripes = useMemo(() => new THREE.MeshBasicMaterial({ color: "#ffffff", toneMapped: false, transparent: true, opacity: 0.5 }), []);
  return (
    <group>
      <mesh material={band} position={[0, 0.02, length / 2]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1.6, length]} />
      </mesh>
      {Array.from({ length: 30 }, (_, i) => {
        const z = (((i * 4 - t * 12) % 120) + 120) % 120;
        return (
          <mesh key={i} material={stripes} position={[0, 0.03, z]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[1.6, 0.06]} />
          </mesh>
        );
      })}
    </group>
  );
};

export const CoilHero: React.FC<S> = ({ cam: camO, t, d }) => {
  const m = useFactoryMats();
  const k = easeInOut(range(t, 0, d));
  const cam0 = { pos: [lerp(-5.5, 4.5, k), lerp(1.5, 3.2, k), lerp(6.5, 7.5, k)], target: [0, 2, 0], fov: 40 };
  return (
    <World cam={camO ?? cam0} t={t} top="#a01a8a" bottom="#1a0636" bloom={1.0}>
      <Floor />
      <Coil m={m} position={[0, 2, 0]} spin={-t * 0.6} />
      <group position={[0, 0, 0]}>
        <Ribbon m={m} t={t} />
      </group>
      <Glow position={[0, 2, 0.9]} scale={3} color="#ff4fd8" opacity={0.25} />
      <Motes t={t} count={60} spread={20} center={[0, 3, 0]} color="#ffd1f4" size={0.05} />
    </World>
  );
};

export const CoilCrane: React.FC<S> = ({ cam: camO, t, d }) => {
  const m = useFactoryMats();
  const k = easeInOut(range(t, 0, d));
  const lift = easeInOut(range(t, 0.1, d)) * 3;
  const sway = Math.sin(t * 2.4) * 0.08;
  const cam0 = { pos: [lerp(3, -3, k), lerp(0.8, 2.2, k), lerp(11, 10, k)], target: [0, 2.5 + lift * 0.5, 0], fov: 42 };
  return (
    <World cam={camO ?? cam0} t={t} top="#5a1aa0" bottom="#120428" bloom={1.0}>
      <Floor />
      <group position={[0, lift, 0]} rotation={[0, 0, sway]}>
        <Coil m={m} position={[0, 2, 0]} />
        {[-0.5, 0.5].map((x) => (
          <mesh key={x} material={m.accent} position={[x * 1.2, 4.5, 0]} rotation={[0, 0, x * 0.5]}>
            <cylinderGeometry args={[0.05, 0.05, 3.2, 8]} />
          </mesh>
        ))}
        <mesh material={m.robotJoint} position={[0, 6.1, 0]}>
          <boxGeometry args={[1.2, 0.4, 0.6]} />
        </mesh>
        <mesh material={m.darkSteel} position={[0, 12, 0]}>
          <cylinderGeometry args={[0.04, 0.04, 11.5, 8]} />
        </mesh>
      </group>
      <Motes t={t} count={50} spread={20} center={[0, 3, 0]} size={0.05} />
    </World>
  );
};

export const MileRibbon: React.FC<S> = ({ cam: camO, t, d }) => {
  const m = useFactoryMats();
  const k = easeInOut(range(t, 0, d));
  const cam0 = { pos: [lerp(1.6, -0.8, k), lerp(0.9, 2.4, k), lerp(-4, 6, k)], target: [0, 0, 60], fov: 44, roll: lerp(-0.15, 0.1, k) };
  return (
    <World cam={camO ?? cam0} t={t} top="#ff4fa0" bottom="#2a0858" bloom={1.2} fog="#5a1a7a" focus={12} bokeh={3}>
      <Floor color="#3a1060" />
      <group position={[0, 0.4, 0]}>
        <Ribbon m={m} t={t * 3} length={300} />
      </group>
      <Coil m={m} position={[0, 2.4, -2]} spin={-t * 3} />
      {Array.from({ length: 12 }, (_, i) => (
        <Glow key={i} position={[i % 2 ? 2 : -2, 0.6, 10 + i * 12]} scale={1.6} color={i % 2 ? "#2ff0ff" : "#ff4fd8"} opacity={0.9} />
      ))}
    </World>
  );
};

// ---- stamping press ----
function doorGeometry(deform: number) {
  const g = new THREE.PlaneGeometry(3, 1.8, 60, 36);
  const p = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i);
    // door: a soft outward bulge, a crease line and a recessed window frame
    let z = 0.25 * Math.cos((x / 3) * Math.PI) * Math.cos((y / 1.8) * Math.PI);
    z += 0.06 * Math.exp(-Math.pow((y + 0.15) / 0.05, 2));
    const inWin = x > -1.2 && x < 1.0 && y > 0.25 && y < 0.8;
    if (inWin) z -= 0.18;
    p.setZ(i, z * deform);
  }
  g.computeVertexNormals();
  return g;
}
export const PressSlam: React.FC<S & { impactAt: number; after?: boolean }> = ({ cam: camO, t, d, impactAt, after }) => {
  const m = useFactoryMats();
  const ram = after ? 1 - easeInOut(range(t, 0.15, 1.0)) : easeIn(range(t, 0, impactAt));
  const age = t - impactAt;
  const deform = after ? 1 : age > 0 ? 1 : 0;
  const geo = useMemo(() => [doorGeometry(0), doorGeometry(1)], []);
  const k = easeInOut(range(t, 0, d));
  const cam0 = after
    ? { pos: [lerp(-1.2, 1.6, k), lerp(4.6, 4.2, k), lerp(6.5, 6.0, k)], target: [0, 0.4, 0], fov: 40 }
    : { pos: [lerp(3.5, 2.5, k), lerp(0.6, 0.9, k), lerp(8.5, 7.5, k)], target: [0, 1.6, 0], fov: 42 };
  return (
    <World cam={camO ?? cam0} t={t} top="#d01a7a" bottom="#1a0636" shake={!after && age > 0 ? 0.14 * Math.exp(-age * 6) : 0} bloom={1.2}>
      <Floor y={-0.5} />
      <Press m={m} ram={ram} position={[0, 0, 0]} />
      <mesh geometry={geo[deform]} material={m.steel} position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[0.9, 0.9, 0.9]} />
      {!after && age > 0 && <Sparks age={age} seed={5} count={90} speed={5} position={[0, 0.1, 1]} spread={2} size={1.6} />}
      {!after && age > 0 && age < 0.4 && <Glow position={[0, 0.4, 1]} scale={3 + age * 12} color="#ffffff" opacity={1 - age / 0.4} />}
      <Motes t={t} count={50} spread={20} size={0.05} />
    </World>
  );
};

// ---- panels flying onto the frame ----
export const PanelsAssemble: React.FC<S & { times: number[] }> = ({ cam: camO, t, d, times }) => {
  const m = useFactoryMats();
  const k = easeInOut(range(t, 0, d));
  const frameMat = useMemo(() => new THREE.MeshBasicMaterial({ color: "#2ff0ff", toneMapped: false }), []);
  const frame = useMemo(() => {
    const pts = [v(-2, 0.4, 0), v(-2, 0.9, 0), v(-1.05, 1.05, 0), v(-0.45, 1.5, 0), v(0.45, 1.5, 0), v(1.15, 1.05, 0), v(2.05, 0.9, 0), v(2.05, 0.4, 0)];
    return [-0.85, 0.85].map((z) => tubeGeo(pts.map((p) => p.clone().setZ(z)), 0.035, 80, 8).geo);
  }, []);
  // panels: [targetPos, size, fromOffset, arriveTime]
  const panels: [number[], number[], number[], number, number][] = [
    [[0.3, 0.7, 0.92], [2.0, 0.65, 0.05], [0, 0.5, 6], times[0], 0],
    [[0, 1.52, 0], [0.95, 0.05, 1.7], [0, 6, 0], times[1], 0],
    [[1.55, 0.98, 0], [0.95, 0.05, 1.7], [5, 2, 0], times[2], -0.12],
    [[0.3, 0.7, -0.92], [2.0, 0.65, 0.05], [0, 0.5, -6], times[0] + 0.2, 0],
    [[-1.5, 1.04, 0], [0.9, 0.05, 1.7], [-5, 2, 0], times[1] + 0.3, 0.05],
  ];
  const shell = smooth(range(t, times[2] + 0.4, times[2] + 0.9));
  const cam0 = { pos: [lerp(5.5, 3.0, k), lerp(2.2, 2.8, k), lerp(6.5, 7.5, k)], target: [0, 0.9, 0], fov: 40 };
  return (
    <World cam={camO ?? cam0} t={t} top="#8a1ab0" bottom="#160634" bloom={1.2}>
      <Floor y={-0.1} />
      {frame.map((g, i) => (
        <mesh key={i} geometry={g} material={frameMat} />
      ))}
      {panels.map(([to, sz, off, at, rz], i) => {
        const a = easeOut(range(t, at - 0.5, at));
        const pos = [to[0] + off[0] * (1 - a), to[1] + off[1] * (1 - a), to[2] + off[2] * (1 - a)];
        return (
          <group key={i}>
            <mesh material={m.steel} position={pos as any} rotation={[0, 0, rz + (1 - a) * 2]}>
              <boxGeometry args={sz as any} />
            </mesh>
            {t > at && t - at < 0.35 && <Glow position={to} scale={1.5 + (t - at) * 6} color="#2ff0ff" opacity={1 - (t - at) / 0.35} />}
          </group>
        );
      })}
      {shell > 0 && <Car m={m} paint={0} glass={0} wheels={0} scale={[1, 1, 1]} position={[0, -0.02, 0]} />}
      <Motes t={t} count={40} spread={16} size={0.05} />
    </World>
  );
};

// ---- welding robots ----
export const RobotWeld: React.FC<S & { close?: boolean }> = ({ cam: camO, t, d, close }) => {
  const m = useFactoryMats();
  const k = easeInOut(range(t, 0, d));
  const robots = [
    { p: [-1.2, 0, 2.6], ry: 2.2, ph: 0 },
    { p: [1.3, 0, 2.6], ry: 2.5, ph: 1.3 },
    { p: [-1.0, 0, -2.6], ry: -0.9, ph: 2.1 },
    { p: [1.4, 0, -2.6], ry: -0.6, ph: 0.7 },
  ];
  const weldPts = useMemo(() => {
    const r = rng(7);
    return Array.from({ length: 40 }, () => ({ p: v((r() - 0.5) * 3.6, 0.5 + r() * 0.9, (r() > 0.5 ? 1 : -1) * 0.93), at: r() * 1.6 }));
  }, []);
  const cam0 = close
    ? { pos: [lerp(3.6, 1.6, k), lerp(3.4, 3.0, k), lerp(5.2, 4.6, k)], target: [0.2, 0.9, 0.6], fov: 40 }
    : { pos: [lerp(-6, 5, k), lerp(4.5, 3.5, k), lerp(7, 8, k)], target: [0, 1, 0], fov: 42 };
  return (
    <World cam={camO ?? cam0} t={t} top="#5a10a0" bottom="#0e0322" bloom={1.4} tint="#ff7a2a">
      <Floor y={-0.05} />
      <Car m={m} paint={0} glass={0} wheels={0} />
      {robots.map((r, i) => {
        const w = t * 3 + r.ph;
        return (
          <group key={i}>
            <Robot m={m} a={[r.ry + Math.sin(w) * 0.25, 0.65 + Math.sin(w * 0.7) * 0.12, 1.25 + Math.cos(w) * 0.15, 0.6]} position={r.p} scale={0.7}>
              <Sparks age={((t + i * 0.37) % 0.6)} seed={10 + i + Math.floor((t + i * 0.37) / 0.6)} count={40} speed={2.2} size={0.7} />
              <Glow position={[0, 0, 0]} scale={0.9} color="#ffe6a0" opacity={0.7 + 0.3 * Math.sin(t * 40 + i)} />
            </Robot>
          </group>
        );
      })}
      {weldPts.filter((w) => w.at < t).map((w, i) => (
        <Glow key={i} position={w.p} scale={0.25} color="#ffb04a" opacity={Math.max(0.35, 1 - (t - w.at) * 2)} />
      ))}
      <Motes t={t} count={40} spread={16} size={0.05} color="#ffe0b0" />
    </World>
  );
};

// ---- spot weld cross-section ----
export const SpotWeld: React.FC<S & { current: number; melt: number }> = ({ cam: camO, t, d, current, melt }) => {
  const m = useFactoryMats();
  const k = easeInOut(range(t, 0, d));
  const squeeze = easeOut(range(t, 0, 0.5));
  const bolt = useMemo(() => new THREE.MeshBasicMaterial({ color: "#bff8ff", toneMapped: false }), []);
  const nugget = useMemo(() => new THREE.MeshStandardMaterial({ color: "#ff7a1a", emissive: new THREE.Color("#ff5a00"), emissiveIntensity: 2.5, toneMapped: false }), []);
  const lightning = useMemo(() => {
    const out: THREE.TubeGeometry[] = [];
    for (let s = 0; s < 4; s++) {
      const r = rng(Math.floor(t * 30) * 7 + s);
      const pts = Array.from({ length: 8 }, (_, i) => v((r() - 0.5) * 0.5, 1.05 - i * 0.3, (r() - 0.5) * 0.5));
      out.push(tubeGeo(pts, 0.025, 40, 5).geo);
    }
    return out;
  }, [Math.floor(t * 30)]);
  const cam0 = { pos: [lerp(-1.6, 1.6, k), lerp(0.8, 0.3, k), lerp(7.5, 6.5, k)], target: [0, 0.2, 0], fov: 40 };
  return (
    <World cam={camO ?? cam0} t={t} top="#3a0a7a" bottom="#08021a" bloom={1.6} tint="#ff7a2a">
      <mesh material={m.steel} position={[0, 0.11, 0]}>
        <boxGeometry args={[4, 0.2, 2]} />
      </mesh>
      <mesh material={m.steel} position={[0, -0.11, 0]}>
        <boxGeometry args={[4, 0.2, 2]} />
      </mesh>
      {[1, -1].map((s) => (
        <group key={s} position={[0, s * lerp(1.6, 0.22, squeeze), 0]} rotation={[s > 0 ? 0 : Math.PI, 0, 0]}>
          <mesh material={m.copper} position={[0, 0.9, 0]}>
            <cylinderGeometry args={[0.35, 0.35, 1.6, 32]} />
          </mesh>
          <mesh material={m.copper} position={[0, 0.05, 0]}>
            <cylinderGeometry args={[0.35, 0.12, 0.2, 32]} />
          </mesh>
        </group>
      ))}
      {current > 0 && lightning.map((g, i) => <mesh key={i} geometry={g} material={bolt} scale={[1, current, 1]} />)}
      {current > 0 && <Glow position={[0, 0, 0.3]} scale={2.5 * current} color="#2ff0ff" opacity={0.8 * current} />}
      {melt > 0 && (
        <mesh material={nugget} scale={[0.5 * melt, 0.17 * melt, 0.5 * melt]}>
          <sphereGeometry args={[1, 32, 16]} />
        </mesh>
      )}
      {melt > 0 && <Glow position={[0, 0, 0.6]} scale={2.2 * melt} color="#ff7a1a" opacity={melt} />}
      <Motes t={t} count={30} spread={10} size={0.04} color="#ffd0a0" />
    </World>
  );
};

// ---- electric paint bath ----
export const PaintBath: React.FC<S & { inside?: boolean }> = ({ cam: camO, t, d, inside }) => {
  const m = useFactoryMats();
  const k = easeInOut(range(t, 0, d));
  const liquidGeo = useMemo(() => new THREE.PlaneGeometry(14, 8, 70, 40), []);
  const p = liquidGeo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i);
    p.setZ(i, Math.sin(x * 1.3 + t * 2) * 0.06 + Math.sin(y * 1.7 - t * 1.6) * 0.05);
  }
  p.needsUpdate = true;
  liquidGeo.computeVertexNormals();
  const liq = useMemo(() => new THREE.MeshPhysicalMaterial({ color: "#2fe8ff", transparent: true, opacity: 0.6, roughness: 0.1, clearcoat: 1, emissive: new THREE.Color("#0aa8d0"), emissiveIntensity: 0.6, side: THREE.DoubleSide, depthWrite: false }), []);
  const sink = inside ? 1 : easeInOut(range(t, 0.2, d * 0.9));
  const carY = lerp(3.2, -1.3, sink);
  // charged particles flowing to the body
  const parts = useMemo(() => {
    const r = rng(12);
    return Array.from({ length: 220 }, () => ({ from: v((r() - 0.5) * 12, -0.5 - r() * 3, (r() - 0.5) * 6), to: v((r() - 0.5) * 3.8, 0.5 + r() * 0.9, (r() - 0.5) * 1.8), del: r() }));
  }, []);
  const pm = useMemo(() => new THREE.MeshBasicMaterial({ color: "#ffffff", toneMapped: false }), []);
  const sph = useMemo(() => new THREE.SphereGeometry(1, 8, 6), []);
  const attract = inside ? range(t, 0, d) : 0;
  const items: Inst[] = parts.map((q, i) => {
    const a = easeInOut(clamp(attract * 1.6 - q.del * 0.6));
    const target = q.to.clone().add(v(0, carY, 0));
    const pos = q.from.clone().lerp(target, a);
    pos.y += Math.sin(t * 3 + i) * 0.05 * (1 - a);
    return { p: pos, r: new THREE.Euler(), s: 0.04 + 0.02 * (1 - a), c: a > 0.97 ? "#ff6fd0" : "#bff8ff" };
  });
  const cam0 = inside
    ? { pos: [lerp(4.5, 2.2, k), lerp(-1.0, -0.4, k), lerp(5, 3.6, k)], target: [0.5, carY + 0.8, 0.6], fov: 40 }
    : { pos: [lerp(-4, 3, k), lerp(4.5, 3.2, k), lerp(8.5, 8.0, k)], target: [0, 0.3, 0], fov: 42 };
  return (
    <World cam={camO ?? cam0} t={t} top={inside ? "#0a5a8a" : "#7a1aa0"} bottom={inside ? "#041a3a" : "#120430"} tint="#2fe8ff" rim="#ff4fd8" bloom={1.3}>
      {!inside && <Floor y={-3.5} />}
      <Car m={m} paint={inside ? 0.25 * attract : 0} glass={0} wheels={0} position={[0, carY, 0]} />
      <mesh geometry={liquidGeo} material={liq} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} />
      {!inside &&
        [-1, 1].map((s) => (
          <mesh key={s} material={m.robot} position={[s * 7, -1.5, 0]}>
            <boxGeometry args={[0.3, 3.4, 8.3]} />
          </mesh>
        ))}
      {inside && <Instances geometry={sph} material={pm} items={items} max={230} />}
      {inside && <Glow position={[0, carY + 0.8, 1.2]} scale={5} color="#2ff0ff" opacity={0.35} />}
      {Array.from({ length: 14 }, (_, i) => {
        const age = (t * 0.8 + i * 0.13) % 1;
        return <Glow key={i} position={[((i * 37) % 11) - 5.5, -2 + age * 2.2, ((i * 17) % 5) - 2.5]} scale={0.25} color="#bff8ff" opacity={1 - age} />;
      })}
    </World>
  );
};

// ---- spray painting ----
export const SprayPaint: React.FC<S & { from: number; to: number; gloss?: boolean }> = ({ cam: camO, t, d, from, to, gloss }) => {
  const m = useFactoryMats();
  const k = easeInOut(range(t, 0, d));
  const paint = lerp(from, to, smooth(range(t, 0.1, d - 0.1)));
  const mistCol = mixColor([[0, "#ffffff"], [0.45, "#f4f0ff"], [1, "#ff2d8f"]], to);
  const mist = useMemo(() => {
    const r = rng(21);
    return Array.from({ length: 160 }, () => ({ a: r() * Math.PI * 2, rr: r(), sp: r(), del: r() }));
  }, []);
  const mm = useMemo(() => new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.35, depthWrite: false }), []);
  const sph = useMemo(() => new THREE.SphereGeometry(1, 8, 6), []);
  const guns = [
    { base: [-1, 0, 2.8], ry: 2.0, ph: 0 },
    { base: [1.6, 0, 2.8], ry: 2.6, ph: 1.7 },
  ];
  const items: Inst[] = [];
  guns.forEach((g, gi) => {
    const nozzle = v(g.base[0] + Math.sin(t * 2 + g.ph) * 0.8, 1.4, 1.6);
    for (const q of mist) {
      const age = (t * 1.5 + q.del) % 1;
      const p = nozzle.clone().add(v(Math.cos(q.a) * q.rr * age * 0.6, Math.sin(q.a) * q.rr * age * 0.6, -age * 0.75));
      items.push({ p, r: new THREE.Euler(), s: 0.03 + age * 0.06, c: mistCol });
    }
  });
  const shine = gloss ? range(t, 0.2, d) : -1;
  const cam0 = { pos: [lerp(6.5, -4.5, k), lerp(3.2, 2.6, k), lerp(8.5, 9.0, k)], target: [0, 0.9, 0], fov: 40 };
  return (
    <World cam={camO ?? cam0} t={t} top="#a01a7a" bottom="#150530" bloom={1.2}>
      <Floor y={-0.05} />
      <Car m={m} paint={paint} glass={0} wheels={0} />
      {guns.map((g, i) => (
        <Robot key={i} m={m} a={[g.ry + Math.sin(t * 2 + g.ph) * 0.3, 0.7, 1.2, 0.9]} position={g.base} scale={0.6} />
      ))}
      <Instances geometry={sph} material={mm} items={items} max={330} />
      {shine >= 0 && <Glow position={[lerp(-2.5, 2.5, shine), 1.2, 1.0]} scale={2.2} color="#ffffff" opacity={Math.sin(shine * Math.PI) * 0.9} />}
      <Motes t={t} count={30} spread={16} size={0.05} />
    </World>
  );
};

// ---- paint layers cross-section, then sheet of paper ----
export const Layers: React.FC<S & { paper?: boolean }> = ({ cam: camO, t, d, paper }) => {
  const k = easeInOut(range(t, 0, d));
  const layers = [
    { c: "#9aa6b8", h: 0.9, name: "steel" },
    { c: "#2fd8e8", h: 0.22 },
    { c: "#f0eaff", h: 0.32 },
    { c: "#ff2d8f", h: 0.26 },
    { c: "#e8fbff", h: 0.3, clear: true },
  ];
  let y = 0;
  const env = useFactoryMats().steel.envMap;
  const cam0 = paper
    ? { pos: [lerp(2, 5, k), lerp(1.6, 2.4, k), lerp(6, 10, k)], target: [0.8, 0.8, 0], fov: 40 }
    : { pos: [lerp(-3, 2.5, k), lerp(2.6, 2.2, k), lerp(8.5, 7.5, k)], target: [0, 0.9, 0], fov: 40 };
  return (
    <World cam={camO ?? cam0} t={t} top="#6a1aa0" bottom="#100428" bloom={1.0}>
      {layers.map((L, i) => {
        const grow = paper ? 1 : i === 0 ? 1 : easeOut(range(t, 0.1 + (i - 1) * 0.3, 0.4 + (i - 1) * 0.3));
        const h = L.h * grow;
        const yy = y + h / 2;
        y += h;
        return (
          <mesh key={i} position={[0, yy, 0]}>
            <boxGeometry args={[3, Math.max(0.001, h), 2]} />
            <meshPhysicalMaterial color={L.c} roughness={L.clear ? 0.02 : 0.35} metalness={i === 0 ? 0.8 : 0.1} clearcoat={L.clear ? 1 : 0} transparent={!!L.clear} opacity={L.clear ? 0.55 : 1} envMap={env} emissive={L.c} emissiveIntensity={i === 0 ? 0 : 0.08} />
          </mesh>
        );
      })}
      {paper && (
        <group position={[2.4, 0, 0]}>
          <mesh position={[0, 0.9 + 0.55 / 2 + 0.05 * Math.sin(t * 2), 0]} rotation={[0, 0, 0]}>
            <boxGeometry args={[1.6, 1.1, 2]} />
            <meshStandardMaterial color="#ffffff" roughness={0.9} emissive="#ffffff" emissiveIntensity={0.15} />
          </mesh>
          <Glow position={[0, 1.4, 1.1]} scale={2} color="#2ff0ff" opacity={0.4} />
        </group>
      )}
      <Motes t={t} count={30} spread={12} size={0.04} />
    </World>
  );
};

// ---- marriage: engine + axles rise into the body ----
export const Marriage: React.FC<S & { phase: 0 | 1 | 2 }> = ({ cam: camO, t, d, phase }) => {
  const m = useFactoryMats();
  const k = easeInOut(range(t, 0, d));
  const rise = phase === 0 ? easeInOut(range(t, 0.1, d)) * 0.7 : phase === 1 ? lerp(0.7, 1, easeOut(range(t, 0, 0.5))) : 1;
  const chassisY = lerp(-3.2, 0, rise);
  const cam0 =
    phase === 0 ? { pos: [lerp(4, 2, k), lerp(-1.6, -1.0, k), lerp(7, 6.5, k)], target: [0, -0.4, 0], fov: 42 }
    : phase === 1 ? { pos: [lerp(1.8, 0.8, k), lerp(-0.2, 0.0, k), lerp(4.0, 3.4, k)], target: [1, 0.3, 0.6], fov: 40 }
    : { pos: [Math.sin(lerp(-0.8, 0.8, k)) * 8, lerp(2.5, 1.8, k), Math.cos(lerp(-0.8, 0.8, k)) * 8], target: [0, 0.8, 0], fov: 40 };
  const bolts = [[1.4, 0.3, 0.6], [1.4, 0.3, -0.6], [-1.3, 0.3, 0.6], [-1.3, 0.3, -0.6]];
  return (
    <World cam={camO ?? cam0} t={t} top="#7a1a9a" bottom="#120430" bloom={1.3}>
      <Floor y={-3.6} />
      <Car m={m} paint={1} glass={1} wheels={0} />
      <group position={[0, chassisY, 0]}>
        <Engine m={m} position={[1.1, 0.55, 0]} scale={0.6} t={t} glow={0.9} />
        {[-1.25, 1.25].map((x) => (
          <group key={x} position={[x, 0.34, 0]}>
            <mesh material={m.darkSteel} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.07, 0.07, 1.8, 12]} />
            </mesh>
            {[-1, 1].map((s) => (
              <group key={s} position={[0, 0, s * 0.86]} rotation={[Math.PI / 2, 0, 0]}>
                <mesh material={m.tire}>
                  <cylinderGeometry args={[0.42, 0.42, 0.3, 32]} />
                </mesh>
                <mesh material={m.rim}>
                  <cylinderGeometry args={[0.25, 0.25, 0.32, 6]} />
                </mesh>
              </group>
            ))}
          </group>
        ))}
        <mesh material={m.robotJoint} position={[0, -0.35, 0]}>
          <boxGeometry args={[4.4, 0.15, 2.2]} />
        </mesh>
      </group>
      {phase >= 1 &&
        bolts.map((b, i) => {
          const a = range(t, 0.25 + i * 0.12, 0.6 + i * 0.12);
          return (
            <group key={i} position={[b[0], b[1] - 0.3 * (1 - a), b[2]]} rotation={[0, a * 20, 0]}>
              <mesh material={m.accent}>
                <cylinderGeometry args={[0.07, 0.07, 0.4, 6]} />
              </mesh>
              {a > 0.95 && <Glow position={[0, 0.1, 0]} scale={0.8} color="#2ff0ff" opacity={0.8} />}
            </group>
          );
        })}
      {phase === 2 && <Glow position={[0, 0.9, 0]} scale={6 + Math.sin(t * 3)} color="#ff4fd8" opacity={0.3} />}
      {phase === 2 &&
        Array.from({ length: 10 }, (_, i) => {
          const a = (i / 10) * Math.PI * 2 + t * 1.2;
          return <Glow key={i} position={[Math.cos(a) * 3, 0.8 + Math.sin(t * 2 + i) * 0.3, Math.sin(a) * 2]} scale={0.5} color={i % 2 ? "#2ff0ff" : "#ff4fd8"} opacity={0.9} />;
        })}
      <Motes t={t} count={40} spread={16} size={0.05} />
    </World>
  );
};

// ---- 30,000 parts: exploded swarm ----
export const PartsSwarm: React.FC<S> = ({ cam: camO, t, d }) => {
  const m = useFactoryMats();
  const k = easeInOut(range(t, 0, d));
  const parts = useMemo(() => {
    const r = rng(31);
    return Array.from({ length: 900 }, () => {
      // target on a car-like envelope
      const x = (r() - 0.5) * 4;
      const top = Math.abs(x) < 1 ? 1.5 : 1.0;
      const y = 0.3 + r() * (top - 0.3);
      const z = (r() - 0.5) * 1.8;
      return { to: v(x, y, z), dir: v(r() - 0.5, r() - 0.5, r() - 0.5).normalize().multiplyScalar(3 + r() * 6), kind: Math.floor(r() * 3), rot: v(r() * 6, r() * 6, r() * 6), s: 0.05 + r() * 0.09 };
    });
  }, []);
  const geos = useMemo(() => [new THREE.BoxGeometry(1, 1, 1), new THREE.CylinderGeometry(0.5, 0.5, 1.6, 8), new THREE.TorusGeometry(0.6, 0.2, 6, 12)], []);
  const mats = [m.steel, m.robotJoint, m.accent];
  const explode = 1 - easeInOut(range(t, 0.3, d)) * 0.55;
  const groups = [0, 1, 2].map((kd) =>
    parts.filter((p) => p.kind === kd).map((p) => ({ p: p.to.clone().add(p.dir.clone().multiplyScalar(explode)), r: new THREE.Euler(p.rot.x + t, p.rot.y + t * 0.7, p.rot.z), s: p.s })),
  );
  const cam0 = { pos: [Math.sin(lerp(-0.6, 0.9, k)) * lerp(14, 9, k), lerp(3, 1.5, k), Math.cos(lerp(-0.6, 0.9, k)) * lerp(14, 9, k)], target: [0, 0.8, 0], fov: 42 };
  return (
    <World cam={camO ?? cam0} t={t} top="#1a3aa0" bottom="#0a0428" bloom={1.2}>
      {groups.map((items, i) => (
        <Instances key={i} geometry={geos[i]} material={mats[i]} items={items} max={400} />
      ))}
      <Glow position={[0, 0.8, 0]} scale={7} color="#ff4fd8" opacity={0.25} />
      <Motes t={t} count={60} spread={24} size={0.05} />
    </World>
  );
};

export const Screw: React.FC<S> = ({ cam: camO, t, d }) => {
  const m = useFactoryMats();
  const k = easeInOut(range(t, 0, d));
  const thread = useMemo(() => {
    const pts = Array.from({ length: 300 }, (_, i) => {
      const a = i * 0.25;
      return v(Math.cos(a) * 0.32, -i * 0.009, Math.sin(a) * 0.32);
    });
    return tubeGeo(pts, 0.05, 600, 6).geo;
  }, []);
  const cam0 = { pos: [lerp(-1.6, 1.2, k), lerp(0.8, 0.2, k), lerp(4.6, 3.4, k)], target: [0, -0.9, 0], fov: 40 };
  return (
    <World cam={camO ?? cam0} t={t} top="#0a5a9a" bottom="#08041e" bloom={1.2} tint="#ff4fd8">
      <group rotation={[0.25, t * 3, 0.2]}>
        <mesh material={m.steel} position={[0, -1.35, 0]}>
          <cylinderGeometry args={[0.3, 0.28, 2.7, 32]} />
        </mesh>
        <mesh geometry={thread} material={m.steel} />
        <mesh material={m.steel} position={[0, 0.12, 0]}>
          <cylinderGeometry args={[0.62, 0.55, 0.26, 32]} />
        </mesh>
        {[0, Math.PI / 2].map((r) => (
          <mesh key={r} material={m.darkSteel} position={[0, 0.25, 0]} rotation={[0, r, 0]}>
            <boxGeometry args={[0.8, 0.06, 0.1]} />
          </mesh>
        ))}
      </group>
      <Glow position={[0, -0.9, 0.6]} scale={3} color="#2ff0ff" opacity={0.35} />
      <Motes t={t} count={40} spread={10} size={0.04} />
    </World>
  );
};

// ---- water test ----
export const WaterTest: React.FC<S & { close?: boolean }> = ({ cam: camO, t, d, close }) => {
  const m = useFactoryMats();
  const k = easeInOut(range(t, 0, d));
  const jets = useMemo(() => {
    const r = rng(41);
    return Array.from({ length: 420 }, () => ({ x: (r() - 0.5) * 6, z: (r() - 0.5) * 3.6, ph: r(), sp: 0.8 + r() * 0.6 }));
  }, []);
  const wm = useMemo(() => new THREE.MeshBasicMaterial({ color: "#bff6ff", toneMapped: false, transparent: true, opacity: 0.75, depthWrite: false }), []);
  const cap = useMemo(() => new THREE.CapsuleGeometry(0.02, 0.3, 3, 6), []);
  const items: Inst[] = jets.map((j) => {
    const age = (t * j.sp * 1.6 + j.ph) % 1;
    return { p: v(j.x, 5 - age * 4.2, j.z), r: new THREE.Euler(0, 0, 0.1), s: 1 };
  });
  const cam0 = close
    ? { pos: [lerp(2.6, 1.6, k), lerp(1.2, 1.0, k), lerp(2.6, 2.0, k)], target: [0.6, 0.9, 0.95], fov: 38 }
    : { pos: [lerp(-5, 4, k), lerp(1.8, 2.6, k), lerp(7.5, 7.0, k)], target: [0, 1, 0], fov: 42 };
  const scan = range(t, 0.3, d - 0.2);
  return (
    <World cam={camO ?? cam0} t={t} top="#1a7ac0" bottom="#0a1040" tint="#5fd0ff" rim="#bff8ff" bloom={1.2}>
      <Floor y={-0.05} color="#1a2a6a" />
      <Car m={m} paint={1} glass={1} wheels={1} wet={1} t={t} />
      {!close && <Instances geometry={cap} material={wm} items={items} max={430} />}
      {close && <Glow position={[lerp(-0.6, 1.6, scan), 0.95, 1.0]} scale={0.9} color="#2ff0ff" opacity={Math.sin(scan * Math.PI)} />}
      {close && (
        <mesh position={[lerp(-0.6, 1.6, scan), 0.95, 1.02]}>
          <boxGeometry args={[0.02, 0.9, 0.02]} />
          <meshBasicMaterial color="#2ff0ff" toneMapped={false} />
        </mesh>
      )}
      <Motes t={t} count={50} spread={16} color="#e8fbff" size={0.05} />
    </World>
  );
};

// ---- assembly line ----
export const AssemblyLine: React.FC<S & { exit?: boolean }> = ({ cam: camO, t, d, exit }) => {
  const m = useFactoryMats();
  const k = easeInOut(range(t, 0, d));
  const speed = 1.4;
  const cars = [0, 1, 2, 3, 4, 5].map((i) => -i * 6 + ((t * speed) % 6));
  const rib = useMemo(() => new THREE.MeshStandardMaterial({ color: "#3a2a6a", metalness: 0.5, roughness: 0.4 }), []);
  const cam0 = exit
    ? { pos: [lerp(5, 3.5, k), lerp(1.0, 1.4, k), lerp(6, 4.5, k)], target: [lerp(2, 5, k), 0.8, 0], fov: 40 }
    : { pos: [lerp(-8, -2, k), lerp(5, 3.5, k), lerp(9, 8, k)], target: [lerp(-6, 0, k), 0.5, 0], fov: 42 };
  return (
    <World cam={camO ?? cam0} t={t} top="#a01a8a" bottom="#120430" bloom={1.3} fog="#3a0a5a">
      <Floor y={-0.25} />
      {Array.from({ length: 40 }, (_, i) => {
        const x = -40 + (((i * 2 + t * speed) % 80) + 80) % 80;
        return (
          <mesh key={i} material={rib} position={[x, -0.15, 0]}>
            <boxGeometry args={[0.2, 0.2, 2.6]} />
          </mesh>
        );
      })}
      {(exit ? [0] : cars).map((x, i) => (
        <Car key={i} m={m} paint={1} glass={1} wheels={1} lights={exit ? smooth(range(t, 0.2, 0.6)) : 0.3} position={[exit ? lerp(-1, 6, easeIn(range(t, 0.3, d))) : x, 0, 0]} t={t} />
      ))}
      {exit && (
        <group position={[3, 0, 0]}>
          {[-1.6, 1.6].map((z) => (
            <mesh key={z} material={m.accent} position={[0, 1.6, z]}>
              <boxGeometry args={[0.25, 3.2, 0.25]} />
            </mesh>
          ))}
          <mesh material={m.accent} position={[0, 3.2, 0]}>
            <boxGeometry args={[0.25, 0.25, 3.45]} />
          </mesh>
          <Glow position={[0, 1.6, 0]} scale={5} color="#2ff0ff" opacity={0.4} />
        </group>
      )}
      {!exit &&
        Array.from({ length: 6 }, (_, i) => <Glow key={i} position={[-30 + i * 7, 3.2, -2]} scale={2} color={i % 2 ? "#2ff0ff" : "#ff4fd8"} opacity={0.7} />)}
    </World>
  );
};

export { P };
