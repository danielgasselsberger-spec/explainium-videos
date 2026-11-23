import React, { useMemo } from "react";
import * as THREE from "three";
import { useEnvMap } from "../../engine/common";
import { Glow, Inst, Instances, blobGeometry } from "../../engine/prims";
import { clamp, lerp, mixColor, rng, smooth } from "../../engine/lib";

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

export function usePlaneMats() {
  const env = useEnvMap();
  return useMemo(() => {
    const body = new THREE.MeshPhysicalMaterial({ color: "#f4f2fb", metalness: 0.2, roughness: 0.3, clearcoat: 0.8, envMap: env, envMapIntensity: 0.7 });
    const stripe = new THREE.MeshStandardMaterial({ color: "#ff2d8f", roughness: 0.3, envMap: env, emissive: new THREE.Color("#a0104a"), emissiveIntensity: 0.3 });
    const accent = new THREE.MeshStandardMaterial({ color: "#2fe8ff", metalness: 0.4, roughness: 0.25, envMap: env, emissive: new THREE.Color("#0aa0c0"), emissiveIntensity: 0.6 });
    const glass = new THREE.MeshPhysicalMaterial({ color: "#1b2350", roughness: 0.05, clearcoat: 1, envMap: env, envMapIntensity: 1.4 });
    const dark = new THREE.MeshStandardMaterial({ color: "#3a3650", metalness: 0.6, roughness: 0.4, envMap: env, envMapIntensity: 0.5 });
    const steel = new THREE.MeshStandardMaterial({ color: "#8f9aae", metalness: 0.85, roughness: 0.32, envMap: env, envMapIntensity: 0.6 });
    const tire = new THREE.MeshStandardMaterial({ color: "#26232e", roughness: 0.7 });
    const cloud = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.9, emissive: new THREE.Color("#c8d8ff"), emissiveIntensity: 0.35, transparent: true, opacity: 0.92 });
    const runway = new THREE.MeshStandardMaterial({ color: "#2a2440", roughness: 0.7 });
    const white = new THREE.MeshBasicMaterial({ color: "#ffffff", toneMapped: false });
    return { body, stripe, accent, glass, dark, steel, tire, cloud, runway, white };
  }, [env]);
}
export type PM = ReturnType<typeof usePlaneMats>;

// ---------- geometry ----------
let _geo: Record<string, THREE.BufferGeometry> | null = null;
function planeGeo() {
  if (_geo) return _geo;
  const ext = (pts: number[][], depth: number) => {
    const s = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
    const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 2 });
    g.translate(0, 0, -depth / 2);
    return g;
  };
  // wing in x (chord) / y (span) -> rotated so span is world z
  const wing = ext([[0.7, 0.3], [-1.75, 3.5], [-2.25, 3.5], [-1.1, 0.3], [-1.1, -0.3], [-2.25, -3.5], [-1.75, -3.5], [0.7, -0.3]], 0.07);
  wing.rotateX(Math.PI / 2);
  const stab = ext([[-2.3, 0.2], [-2.95, 1.4], [-3.25, 1.4], [-2.95, 0.2], [-2.95, -0.2], [-3.25, -1.4], [-2.95, -1.4], [-2.3, -0.2]], 0.05);
  stab.rotateX(Math.PI / 2);
  const fin = ext([[-1.9, 0.25], [-2.85, 1.6], [-3.25, 1.6], [-3.05, 0.25]], 0.06);
  _geo = { wing, stab, fin };
  return _geo;
}

export type PlaneState = { fan?: number; ail?: number; elev?: number; gear?: number; lights?: number; exhaust?: number; scale?: number };

// airliner, nose along +x, length ~6.4, wingspan 7
export const Plane: React.FC<PlaneState & { m: PM; position?: any; rotation?: any; scale?: any }> = ({ m, fan = 0, ail = 0, elev = 0, gear = 1, lights = 1, exhaust = 0, position, rotation, scale }) => {
  const g = planeGeo();
  const windows = useMemo(() => Array.from({ length: 16 }, (_, i) => 1.9 - i * 0.24), []);
  return (
    <group position={position} rotation={rotation} scale={scale}>
      {/* fuselage */}
      <mesh material={m.body} rotation={[0, 0, -Math.PI / 2]}>
        <capsuleGeometry args={[0.38, 5.2, 12, 32]} />
      </mesh>
      <mesh material={m.stripe} position={[0, -0.05, 0]} rotation={[0, 0, -Math.PI / 2]} scale={[1.01, 0.9, 1.01]}>
        <cylinderGeometry args={[0.385, 0.385, 4.6, 32, 1, true, Math.PI * 0.35, Math.PI * 0.3]} />
      </mesh>
      <mesh material={m.stripe} position={[0, -0.05, 0]} rotation={[0, 0, -Math.PI / 2]} scale={[1.01, 0.9, 1.01]}>
        <cylinderGeometry args={[0.385, 0.385, 4.6, 32, 1, true, Math.PI * 1.35, Math.PI * 0.3]} />
      </mesh>
      {[-1, 1].map((s) =>
        windows.map((x, i) => (
          <mesh key={`${s}${i}`} material={m.glass} position={[x, 0.12, s * 0.37]} scale={[0.06, 0.08, 0.02]}>
            <sphereGeometry args={[1, 10, 8]} />
          </mesh>
        )),
      )}
      <mesh material={m.glass} position={[2.72, 0.16, 0]} rotation={[0, 0, -0.5]} scale={[0.25, 0.12, 0.5]}>
        <sphereGeometry args={[1, 20, 12]} />
      </mesh>
      {/* wings, tail */}
      <mesh geometry={g.wing} material={m.body} position={[0.3, -0.18, 0]} />
      <mesh geometry={g.stab} material={m.body} position={[0, 0.12, 0]} />
      <mesh geometry={g.fin} material={m.stripe} position={[0, 0.2, 0]} />
      {/* ailerons (opposite) and elevators */}
      {[-1, 1].map((s) => (
        <group key={s} position={[-1.65, -0.18, s * 2.9]} rotation={[0, s * 0.38, 0]}>
          <mesh material={m.accent} position={[-0.12, 0, 0]} rotation={[0, 0, s * ail * 0.6]}>
            <boxGeometry args={[0.24, 0.05, 0.9]} />
          </mesh>
        </group>
      ))}
      {[-1, 1].map((s) => (
        <group key={"e" + s} position={[-3.05, 0.12, s * 0.85]}>
          <mesh material={m.accent} position={[-0.1, 0, 0]} rotation={[0, 0, elev * 0.6]}>
            <boxGeometry args={[0.2, 0.04, 1.0]} />
          </mesh>
        </group>
      ))}
      {/* engines */}
      {[-1, 1].map((s) => (
        <group key={"n" + s} position={[0.35, -0.5, s * 1.45]}>
          <mesh material={m.body} rotation={[0, 0, -Math.PI / 2]}>
            <cylinderGeometry args={[0.24, 0.2, 0.95, 28, 1, true]} />
          </mesh>
          <group position={[0.42, 0, 0]} rotation={[fan, 0, 0]}>
            {[0, 1, 2, 3, 4, 5, 6, 7].map((b) => (
              <mesh key={b} material={m.accent} rotation={[(b / 8) * Math.PI * 2, 0, 0]} position={[0, 0, 0]}>
                <boxGeometry args={[0.03, 0.42, 0.06]} />
              </mesh>
            ))}
            <mesh material={m.dark} rotation={[0, 0, -Math.PI / 2]}>
              <coneGeometry args={[0.07, 0.15, 16]} />
            </mesh>
          </group>
          <mesh material={m.stripe} position={[0.2, 0.15, 0]}>
            <boxGeometry args={[0.3, 0.1, 0.04]} />
          </mesh>
          {exhaust > 0 && <Glow position={[-0.65, 0, 0]} scale={0.9 * exhaust} color="#ff8a3a" opacity={exhaust} />}
        </group>
      ))}
      {/* gear */}
      {gear > 0.01 &&
        [[1.8, 0], [-0.5, 0.55], [-0.5, -0.55]].map(([x, z], i) => (
          <group key={i} position={[x, -0.38 - 0.3 * gear, z]} scale={gear}>
            <mesh material={m.steel} position={[0, 0.15, 0]}>
              <cylinderGeometry args={[0.03, 0.03, 0.3, 8]} />
            </mesh>
            <mesh material={m.tire} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.12, 0.12, 0.1, 16]} />
            </mesh>
          </group>
        ))}
      {lights > 0 && (
        <>
          <Glow position={[-1.95, -0.15, 3.55]} scale={0.6} color="#3aff7a" opacity={lights} />
          <Glow position={[-1.95, -0.15, -3.55]} scale={0.6} color="#ff3355" opacity={lights} />
        </>
      )}
    </group>
  );
};

// ---------- runway ----------
export const Runway: React.FC<{ m: PM; t: number; speed?: number; y?: number }> = ({ m, t, speed = 0, y = 0 }) => {
  const off = (t * speed) % 4;
  return (
    <group position={[0, y, 0]}>
      <mesh material={m.runway} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[400, 6]} />
      </mesh>
      {Array.from({ length: 60 }, (_, i) => (
        <mesh key={i} material={m.white} position={[-120 + i * 4 - off, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[1.6, 0.12]} />
        </mesh>
      ))}
      {Array.from({ length: 40 }, (_, i) =>
        [-1, 1].map((s) => <Glow key={`${i}${s}`} position={[-80 + i * 4 - off, 0.15, s * 3.1]} scale={0.7} color={s > 0 ? "#2ff0ff" : "#ff4fd8"} opacity={0.9} />),
      )}
    </group>
  );
};

// ---------- clouds ----------
export const Clouds: React.FC<{ m: PM; t: number; count?: number; spread?: number[]; center?: number[]; speed?: number; seed?: number }> = ({ m, t, count = 20, spread = [60, 6, 30], center = [0, -4, -6], speed = 6, seed = 3 }) => {
  const geos = useMemo(() => [0, 1, 2].map((i) => blobGeometry(40 + i, 0.25, 3, 1.4)), []);
  const cs = useMemo(() => {
    const r = rng(seed);
    return Array.from({ length: count }, () => ({ x: (r() - 0.5) * spread[0], y: (r() - 0.5) * spread[1], z: (r() - 0.5) * spread[2], s: 1.2 + r() * 2.5, g: Math.floor(r() * 3), puffs: 3 + Math.floor(r() * 3) }));
  }, [count, seed]);
  return (
    <>
      {cs.map((c, i) => {
        const x = ((c.x - t * speed + spread[0] / 2) % spread[0] + spread[0]) % spread[0] - spread[0] / 2;
        return (
          <group key={i} position={[center[0] + x, center[1] + c.y, center[2] + c.z]} scale={c.s}>
            {Array.from({ length: c.puffs }, (_, k) => (
              <mesh key={k} geometry={geos[(c.g + k) % 3]} material={m.cloud} position={[k * 0.9 - c.puffs * 0.45, Math.sin(k * 2.1) * 0.2, Math.cos(k) * 0.3]} scale={[1, 0.65, 0.8]} />
            ))}
          </group>
        );
      })}
    </>
  );
};

// ---------- airfoil + flow ----------
let _foil: THREE.BufferGeometry | null = null;
export function airfoilGeo() {
  if (_foil) return _foil;
  const c = 4, tk = 0.14, m = 0.05, p = 0.4;
  const top: THREE.Vector2[] = [], bot: THREE.Vector2[] = [];
  for (let i = 0; i <= 60; i++) {
    const x = (1 - Math.cos((i / 60) * Math.PI)) / 2;
    const yt = 5 * tk * (0.2969 * Math.sqrt(x) - 0.126 * x - 0.3516 * x * x + 0.2843 * x ** 3 - 0.1036 * x ** 4);
    const yc = x < p ? (m / (p * p)) * (2 * p * x - x * x) : (m / ((1 - p) ** 2)) * (1 - 2 * p + 2 * p * x - x * x);
    top.push(new THREE.Vector2((x - 0.4) * c, (yc + yt) * c));
    bot.push(new THREE.Vector2((x - 0.4) * c, (yc - yt) * c));
  }
  const s = new THREE.Shape([...top, ...bot.reverse()]);
  _foil = new THREE.ExtrudeGeometry(s, { depth: 3, bevelEnabled: false, curveSegments: 4 });
  _foil.translate(0, 0, -1.5);
  return _foil;
}

// analytic-ish streamlines around a lifting wing at x∈[-1.6, 2.4]; aoa tilts the deflection
export function flowPoint(x: number, y0: number, aoa: number) {
  const near = Math.exp(-Math.abs(y0) * 0.9);
  const bump = Math.exp(-Math.pow(x / 2.0, 2));
  let y = y0;
  if (y0 > 0) y += 0.45 * bump * near * (1 + aoa * 2);
  else y -= 0.15 * bump * near;
  // downwash after the wing
  y -= (0.25 + aoa * 2.4) * smooth((x + 0.5) / 3.5) * Math.exp(-Math.abs(y0) * 0.5);
  return y;
}
export const Flow: React.FC<{ t: number; aoa: number; count?: number; fastTop?: number; pressure?: boolean; ymax?: number }> = ({ t, aoa, count = 260, fastTop = 1, ymax = 2.6 }) => {
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ color: "#ffffff", toneMapped: false }), []);
  const geo = useMemo(() => new THREE.CapsuleGeometry(0.025, 0.28, 3, 6), []);
  const ps = useMemo(() => {
    const r = rng(23);
    return Array.from({ length: count }, () => ({ y0: (r() - 0.5) * 2 * ymax, z: (r() - 0.5) * 2.8, ph: r() }));
  }, [count, ymax]);
  const items: Inst[] = ps
    .filter((q) => Math.abs(q.y0) > 0.18)
    .map((q) => {
      const top = q.y0 > 0;
      const sp = top ? 1 + 0.6 * fastTop * Math.exp(-q.y0) : 1 - 0.15 * Math.exp(q.y0);
      const u = (t * 0.32 * sp + q.ph) % 1;
      const x = lerp(-6, 6, u);
      const y = flowPoint(x, q.y0, aoa);
      const dy = flowPoint(x + 0.05, q.y0, aoa) - y;
      const ang = Math.atan2(dy, 0.05);
      const col = top ? mixColor([[0, "#bff8ff"], [1, "#2fb8ff"]], Math.exp(-q.y0)) : mixColor([[0, "#ffd0f0"], [1, "#ff4fd8"]], Math.exp(q.y0));
      return { p: v(x, y, q.z), r: new THREE.Euler(0, 0, ang - Math.PI / 2), s: new THREE.Vector3(1, top ? sp : 1, 1), c: col };
    });
  return <Instances geometry={geo} material={mat} items={items} max={count} />;
};

// ---------- jet engine cut-away (axis x, intake at -x) ----------
export const JetEngine: React.FC<{ m: PM; t: number; stage: number }> = ({ m, t, stage }) => {
  const discs = useMemo(() => {
    const a: { x: number; r: number; kind: string }[] = [{ x: -2.2, r: 1.25, kind: "fan" }];
    for (let i = 0; i < 7; i++) a.push({ x: -1.6 + i * 0.22, r: 0.85 - i * 0.06, kind: "comp" });
    for (let i = 0; i < 3; i++) a.push({ x: 0.9 + i * 0.25, r: 0.6 + i * 0.05, kind: "turb" });
    return a;
  }, []);
  const spin = t * 10;
  const parts = useMemo(() => {
    const r = rng(31);
    return Array.from({ length: 300 }, () => ({ a: r() * Math.PI * 2, rr: Math.sqrt(r()), ph: r() }));
  }, []);
  const pm = useMemo(() => new THREE.MeshBasicMaterial({ color: "#ffffff", toneMapped: false }), []);
  const sg = useMemo(() => new THREE.SphereGeometry(1, 8, 6), []);
  const items: Inst[] = parts.map((q) => {
    const u = (t * 0.35 + q.ph) % 1;
    // position along engine: compress between -1.6 and 0.4, accelerate after 1.6
    const x = u < 0.35 ? lerp(-5, -1.6, u / 0.35) : u < 0.7 ? lerp(-1.6, 0.6, (u - 0.35) / 0.35) : lerp(0.6, 6, ((u - 0.7) / 0.3) ** 1.6);
    const rad = x < -1.6 ? 1.1 : x < 0.6 ? lerp(0.8, 0.45, (x + 1.6) / 2.2) : x < 2 ? 0.5 : 0.5 + (x - 2) * 0.05;
    const c = x < -1.6 ? "#bff8ff" : x < 0 ? "#e8f0ff" : x < 0.9 ? "#ff9a3a" : "#ff4fd8";
    const s = x < 0 ? 0.04 : 0.055;
    return { p: v(x, Math.cos(q.a) * q.rr * rad, Math.sin(q.a) * q.rr * rad), r: new THREE.Euler(), s, c };
  });
  return (
    <group>
      {/* casing: back half only (cut-away) */}
      <mesh material={m.body} rotation={[0, 0, -Math.PI / 2]}>
        <cylinderGeometry args={[1.35, 0.7, 5.2, 48, 1, true, Math.PI / 2, Math.PI]} />
      </mesh>
      <mesh material={m.stripe} position={[-2.55, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
        <torusGeometry args={[1.35, 0.06, 10, 48, Math.PI]} />
      </mesh>
      {discs.map((d, i) => (
        <group key={i} position={[d.x, 0, 0]} rotation={[spin * (d.kind === "turb" ? -1 : 1) + i, 0, 0]}>
          {Array.from({ length: d.kind === "fan" ? 14 : 18 }, (_, b) => (
            <mesh key={b} material={d.kind === "fan" ? m.accent : d.kind === "comp" ? m.steel : m.stripe} rotation={[(b / (d.kind === "fan" ? 14 : 18)) * Math.PI * 2, 0.3, 0]} position={[0, 0, 0]}>
              <boxGeometry args={[0.04, d.r * 2, d.kind === "fan" ? 0.16 : 0.08]} />
            </mesh>
          ))}
        </group>
      ))}
      <mesh material={m.dark} rotation={[0, 0, -Math.PI / 2]}>
        <cylinderGeometry args={[0.2, 0.2, 4.4, 20]} />
      </mesh>
      {/* combustion chamber */}
      <mesh material={m.dark} position={[0.3, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
        <torusGeometry args={[0.55, 0.14, 12, 40]} />
      </mesh>
      {stage >= 2 && <Glow position={[0.3, 0, 0.3]} scale={2.4 + 0.3 * Math.sin(t * 30)} color="#ff7a1a" opacity={0.95} />}
      {stage >= 3 && <Glow position={[3.2, 0, 0]} scale={3.5} color="#ff4fd8" opacity={0.7} />}
      <Instances geometry={sg} material={pm} items={items} max={300} />
    </group>
  );
};

// wingtip vortex spiral (trailing towards -x from origin)
export const Vortex: React.FC<{ t: number; r?: number; count?: number; length?: number; spinDir?: 1 | -1; color?: string }> = ({ t, r = 0.6, count = 220, length = 18, spinDir = 1, color = "#bff8ff" }) => {
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ color, toneMapped: false, transparent: true, opacity: 0.85, depthWrite: false }), [color]);
  const geo = useMemo(() => new THREE.SphereGeometry(1, 6, 4), []);
  const items: Inst[] = Array.from({ length: count }, (_, i) => {
    const u = ((i / count + t * 0.25) % 1);
    const x = -u * length;
    const a = spinDir * (u * 30 + t * 6) + (i % 3) * 2.1;
    const rr = r * (0.3 + u * 1.2) * (0.7 + (i % 5) * 0.08);
    return { p: v(x, Math.cos(a) * rr, Math.sin(a) * rr), r: new THREE.Euler(), s: 0.04 * (1 - u * 0.5) };
  });
  return <Instances geometry={geo} material={mat} items={items} max={count} />;
};

// little car shape for the weight comparison
export const CarGrid: React.FC<{ m: PM; n: number; reveal: number; origin?: number[] }> = ({ m, n, reveal, origin = [0, 0, 0] }) => {
  const body = useMemo(() => new THREE.BoxGeometry(0.9, 0.3, 0.45), []);
  const cab = useMemo(() => new THREE.BoxGeometry(0.5, 0.22, 0.4), []);
  const cols = ["#ff2d8f", "#2fe8ff", "#b04bff", "#ffd23a", "#ff7a3a"];
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.35 }), []);
  const cols20 = 20;
  const items: Inst[] = [], cabs: Inst[] = [];
  for (let i = 0; i < n; i++) {
    const k = clamp(reveal * n * 1.1 - i);
    if (k <= 0) continue;
    const gx = i % cols20, gz = Math.floor(i / cols20);
    const p = v(origin[0] + gx * 1.1, origin[1] + 0.15 + (1 - k) * 2, origin[2] + gz * 0.65);
    items.push({ p, r: new THREE.Euler(), s: k, c: cols[i % 5] });
    cabs.push({ p: p.clone().add(v(-0.05, 0.24, 0)), r: new THREE.Euler(), s: k, c: "#1b2350" });
  }
  return (
    <>
      <Instances geometry={body} material={mat} items={items} max={n} />
      <Instances geometry={cab} material={mat} items={cabs} max={n} />
    </>
  );
};
