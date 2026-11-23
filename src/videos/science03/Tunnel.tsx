import React, { useMemo } from "react";
import * as THREE from "three";
import { useEnvMap } from "../../engine/common";
import { Glow, Inst, Instances, blobGeometry } from "../../engine/prims";
import { clamp, easeOut, lerp, range, rng, smooth } from "../../engine/lib";

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

export function useTunnelMats() {
  const env = useEnvMap();
  return useMemo(() => {
    const shell = new THREE.MeshStandardMaterial({ color: "#ff2d8f", metalness: 0.5, roughness: 0.3, envMap: env, envMapIntensity: 0.8 });
    const steel = new THREE.MeshStandardMaterial({ color: "#8f9aae", metalness: 0.85, roughness: 0.32, envMap: env, envMapIntensity: 0.6 });
    const dark = new THREE.MeshStandardMaterial({ color: "#3a3650", metalness: 0.6, roughness: 0.4, envMap: env, envMapIntensity: 0.5 });
    const accent = new THREE.MeshStandardMaterial({ color: "#2fe8ff", metalness: 0.4, roughness: 0.25, envMap: env, emissive: new THREE.Color("#0aa0c0"), emissiveIntensity: 0.7 });
    const light = new THREE.MeshBasicMaterial({ color: "#bff8ff", toneMapped: false });
    const concrete = new THREE.MeshStandardMaterial({ color: "#c8c2d8", roughness: 0.8, emissive: new THREE.Color("#3a2a5a"), emissiveIntensity: 0.15 });
    const rock1 = new THREE.MeshStandardMaterial({ color: "#6a4a8a", roughness: 0.9, emissive: new THREE.Color("#2a0a4a"), emissiveIntensity: 0.2 });
    const rock2 = new THREE.MeshStandardMaterial({ color: "#8a5a9a", roughness: 0.9, emissive: new THREE.Color("#3a0a4a"), emissiveIntensity: 0.15 });
    const chalk = new THREE.MeshStandardMaterial({ color: "#d8c8e8", roughness: 0.85 });
    const sand = new THREE.MeshStandardMaterial({ color: "#ffcf8a", roughness: 0.9, emissive: new THREE.Color("#a0602a"), emissiveIntensity: 0.15 });
    const water = new THREE.MeshPhysicalMaterial({ color: "#2fd8ff", transparent: true, opacity: 0.45, roughness: 0.1, clearcoat: 1, emissive: new THREE.Color("#0a7ab0"), emissiveIntensity: 0.4, depthWrite: false, side: THREE.DoubleSide });
    const mud = new THREE.MeshStandardMaterial({ color: "#8a4a6a", roughness: 0.6, emissive: new THREE.Color("#4a1a4a"), emissiveIntensity: 0.4 });
    const fish = new THREE.MeshStandardMaterial({ color: "#ffb03a", roughness: 0.4, emissive: new THREE.Color("#c05a0a"), emissiveIntensity: 0.4 });
    const glass = new THREE.MeshPhysicalMaterial({ color: "#e8fbff", transparent: true, opacity: 0.18, roughness: 0, clearcoat: 1, depthWrite: false });
    const red = new THREE.MeshStandardMaterial({ color: "#ff3355", roughness: 0.3, emissive: new THREE.Color("#c0102a"), emissiveIntensity: 0.6 });
    const ship = new THREE.MeshStandardMaterial({ color: "#3a2a6a", metalness: 0.4, roughness: 0.4, envMap: env });
    return { shell, steel, dark, accent, light, concrete, rock1, rock2, chalk, sand, water, mud, fish, glass, red, ship };
  }, [env]);
}
export type TM = ReturnType<typeof useTunnelMats>;

// ---------- cutterhead (faces +z, radius 1) ----------
export const Cutterhead: React.FC<{ m: TM; spin: number; glow?: number }> = ({ m, spin, glow = 0.5 }) => {
  const cutters = useMemo(() => {
    const a: { r: number; a: number }[] = [];
    for (const [r, n] of [[0.3, 4], [0.55, 8], [0.8, 12], [0.95, 14]] as [number, number][]) for (let i = 0; i < n; i++) a.push({ r, a: (i / n) * Math.PI * 2 + r * 3 });
    return a;
  }, []);
  return (
    <group rotation={[0, 0, spin]}>
      <mesh material={m.dark} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[1, 1, 0.12, 64]} />
      </mesh>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <mesh key={i} material={m.shell} rotation={[0, 0, (i / 6) * Math.PI * 2]} position={[0, 0, 0.08]}>
          <boxGeometry args={[0.16, 1.95, 0.08]} />
        </mesh>
      ))}
      {cutters.map((c, i) => (
        <mesh key={i} material={m.steel} position={[Math.cos(c.a) * c.r, Math.sin(c.a) * c.r, 0.14]} rotation={[0, Math.PI / 2, c.a]}>
          <cylinderGeometry args={[0.07, 0.07, 0.035, 20]} />
        </mesh>
      ))}
      <mesh material={m.accent} position={[0, 0, 0.12]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.16, 0.2, 0.12, 24]} />
      </mesh>
      <Glow position={[0, 0, 0.3]} scale={1.2} color="#2ff0ff" opacity={glow} />
    </group>
  );
};

// ---------- tunnel lining ring (6 segments), axis z ----------
let _segGeo: THREE.BufferGeometry | null = null;
function segGeo() {
  if (_segGeo) return _segGeo;
  const s = new THREE.Shape();
  const a0 = 0.03, a1 = Math.PI / 3 - 0.03, r0 = 0.9, r1 = 1.0;
  s.absarc(0, 0, r1, a0, a1, false);
  s.absarc(0, 0, r0, a1, a0, true);
  _segGeo = new THREE.ExtrudeGeometry(s, { depth: 0.3, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.015, bevelSegments: 2, curveSegments: 16 });
  _segGeo.translate(0, 0, -0.15);
  return _segGeo;
}
export const Segment: React.FC<{ m: TM; i: number; position?: any; rotation?: any; scale?: any }> = ({ m, i, position, rotation, scale }) => (
  <group position={position} rotation={rotation} scale={scale}>
    <mesh geometry={segGeo()} material={m.concrete} rotation={[0, 0, (i * Math.PI) / 3]} />
  </group>
);
export const Ring: React.FC<{ m: TM; z: number; n?: number; seams?: number }> = ({ m, z, n = 6, seams = 0.4 }) => (
  <group position={[0, 0, z]}>
    {Array.from({ length: n }, (_, i) => (
      <Segment key={i} m={m} i={i} />
    ))}
    {seams > 0 && (
      <mesh material={m.light} >
        <torusGeometry args={[0.905, 0.008, 6, 64]} />
      </mesh>
    )}
  </group>
);

// ---------- full tunnel boring machine: cutterhead at z=0 facing +z, trailers towards -z ----------
export const TBM: React.FC<{ m: TM; spin: number; trailers?: number; rams?: number; position?: any; rotation?: any; scale?: any; t?: number }> = ({ m, spin, trailers = 6, rams = 0, position, rotation, scale, t = 0 }) => (
  <group position={position} rotation={rotation} scale={scale}>
    <Cutterhead m={m} spin={spin} />
    <mesh material={m.shell} position={[0, 0, -0.9]} rotation={[Math.PI / 2, 0, 0]}>
      <cylinderGeometry args={[1.02, 1.0, 1.8, 64, 1, true]} />
    </mesh>
    <mesh material={m.accent} position={[0, 0, -0.1]} rotation={[Math.PI / 2, 0, 0]}>
      <torusGeometry args={[1.02, 0.03, 8, 64]} />
    </mesh>
    {/* thrust rams */}
    {Array.from({ length: 8 }, (_, i) => {
      const a = (i / 8) * Math.PI * 2;
      const L = 0.6 + rams * 0.5;
      return (
        <group key={i} position={[Math.cos(a) * 0.8, Math.sin(a) * 0.8, -1.8 - L / 2]}>
          <mesh material={m.steel} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.05, 0.05, L, 12]} />
          </mesh>
          <mesh material={m.red} position={[0, 0, L / 2 - 0.15]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.08, 0.08, 0.3, 12]} />
          </mesh>
        </group>
      );
    })}
    {/* back-up trailers */}
    {Array.from({ length: trailers }, (_, i) => (
      <group key={i} position={[0, -0.35, -3.4 - i * 1.6]}>
        <mesh material={i % 2 ? m.dark : m.steel}>
          <boxGeometry args={[1.2, 0.8, 1.4]} />
        </mesh>
        <mesh material={m.light} position={[0, 0.42, 0]}>
          <boxGeometry args={[1.0, 0.03, 1.2]} />
        </mesh>
        <mesh material={m.accent} position={[0.62, 0, 0]}>
          <boxGeometry args={[0.03, 0.5, 1.2]} />
        </mesh>
      </group>
    ))}
    <Conveyor m={m} t={t} from={-1.6} to={-3.4 - trailers * 1.6} y={0.15} />
  </group>
);

// conveyor belt with rock chips moving towards -z
export const Conveyor: React.FC<{ m: TM; t: number; from: number; to: number; y?: number; speed?: number }> = ({ m, t, from, to, y = 0, speed = 1.2 }) => {
  const L = Math.abs(to - from);
  const chips = useMemo(() => {
    const r = rng(9);
    return Array.from({ length: 70 }, () => ({ u: r(), x: (r() - 0.5) * 0.25, s: 0.03 + r() * 0.04, a: r() * 6 }));
  }, []);
  const geo = useMemo(() => new THREE.DodecahedronGeometry(1, 0), []);
  const items: Inst[] = chips.map((c) => {
    const u = (c.u + (t * speed) / L) % 1;
    return { p: v(c.x, y + 0.06, from - u * L), r: new THREE.Euler(c.a, c.a * 2, 0), s: c.s };
  });
  return (
    <>
      <mesh material={m.dark} position={[0, y, (from + to) / 2]}>
        <boxGeometry args={[0.36, 0.04, L]} />
      </mesh>
      <Instances geometry={geo} material={m.rock2} items={items} max={70} />
    </>
  );
};

// ---------- rock chips burst ----------
export const Chips: React.FC<{ m: TM; age: number; seed?: number; count?: number; position?: any; speed?: number; size?: number }> = ({ m, age, seed = 1, count = 50, position, speed = 2, size = 1 }) => {
  const base = useMemo(() => {
    const r = rng(seed);
    return Array.from({ length: count }, () => ({ d: v(r() - 0.5, r() - 0.3, r() * 0.8 + 0.2).normalize(), sp: 0.4 + r(), s: 0.03 + r() * 0.05, a: r() * 6, life: 0.5 + r() * 0.6 }));
  }, [seed, count]);
  const geo = useMemo(() => new THREE.DodecahedronGeometry(1, 0), []);
  const items: Inst[] = [];
  for (const b of base) {
    const a = age % b.life;
    const p = b.d.clone().multiplyScalar(speed * b.sp * a);
    p.y -= 3 * a * a;
    items.push({ p, r: new THREE.Euler(b.a + a * 8, b.a, 0), s: b.s * size * (1 - a / b.life * 0.5) });
  }
  return (
    <group position={position}>
      <Instances geometry={geo} material={m.rock2} items={items} max={count} />
    </group>
  );
};

// ---------- ground cross-section (cut at z=0, tunnel axis along x at y=0) ----------
export const Ground: React.FC<{ m: TM; t: number; seaTop?: number; width?: number; hole?: boolean }> = ({ m, t, seaTop = 9, width = 80 }) => {
  const waveGeo = useMemo(() => new THREE.PlaneGeometry(width, 20, 80, 20), [width]);
  const p = waveGeo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) * 0.5 + t * 1.5) * 0.15 + Math.sin(p.getY(i) * 0.7 - t) * 0.1);
  p.needsUpdate = true;
  waveGeo.computeVertexNormals();
  // cut-away: floor + back wall + layered ceiling, open towards +z at tunnel height (y -1.1..1.1)
  const D = 14.9, zc = -8.55; // layered back wall behind the tunnel (front face z=-1.1); floor reaches to z=4
  return (
    <group>
      <mesh material={m.rock1} position={[0, -3.55, -6]}>
        <boxGeometry args={[width, 4.9, 20]} />
      </mesh>
      <mesh material={m.rock1} position={[0, 0, -8.55]}>
        <boxGeometry args={[width, 2.2, 14.9]} />
      </mesh>
      <mesh material={m.chalk} position={[0, 2.25, zc]}>
        <boxGeometry args={[width, 2.3, D]} />
      </mesh>
      <mesh material={m.rock2} position={[0, 3.9, zc]}>
        <boxGeometry args={[width, 1.0, D]} />
      </mesh>
      <mesh material={m.sand} position={[0, 4.65, zc]}>
        <boxGeometry args={[width, 0.5, D]} />
      </mesh>
      <mesh material={m.water} position={[0, (4.9 + seaTop) / 2, zc]}>
        <boxGeometry args={[width, seaTop - 4.9, D]} />
      </mesh>
      <mesh geometry={waveGeo} material={m.water} position={[0, seaTop, zc]} rotation={[-Math.PI / 2, 0, 0]} />
    </group>
  );
};

// ---------- fish school ----------
export const Fish: React.FC<{ m: TM; t: number; count?: number; center?: number[]; spread?: number[]; seed?: number }> = ({ m, t, count = 30, center = [0, 7, -2], spread = [20, 3, 6], seed = 5 }) => {
  const body = useMemo(() => {
    const g = new THREE.SphereGeometry(1, 16, 10);
    g.scale(1, 0.45, 0.28);
    return g;
  }, []);
  const tail = useMemo(() => {
    const g = new THREE.ConeGeometry(0.4, 0.6, 4);
    g.rotateZ(Math.PI / 2);
    g.scale(1, 1, 0.3);
    g.translate(-1.15, 0, 0);
    return g;
  }, []);
  const fs = useMemo(() => {
    const r = rng(seed);
    return Array.from({ length: count }, () => ({ x: (r() - 0.5) * spread[0], y: (r() - 0.5) * spread[1], z: (r() - 0.5) * spread[2], sp: 0.6 + r() * 0.8, s: 0.18 + r() * 0.2, c: r() }));
  }, [count, seed]);
  const items: Inst[] = fs.map((f) => {
    const x = ((f.x + t * f.sp + spread[0] / 2) % spread[0] + spread[0]) % spread[0] - spread[0] / 2;
    return { p: v(center[0] + x, center[1] + f.y + Math.sin(t * 2 + f.x) * 0.15, center[2] + f.z), r: new THREE.Euler(0, 0, Math.sin(t * 6 + f.x) * 0.1), s: f.s, c: f.c < 0.33 ? "#ffb03a" : f.c < 0.66 ? "#2ff0ff" : "#ff6fd0" };
  });
  const tailItems = items.map((it, i) => ({ ...it, r: new THREE.Euler(0, Math.sin(t * 10 + i) * 0.4, 0) }));
  return (
    <>
      <Instances geometry={body} material={m.fish} items={items} max={count} />
      <Instances geometry={tail} material={m.fish} items={tailItems} max={count} />
    </>
  );
};

// ---------- ship hull on the surface ----------
export const Ship: React.FC<{ m: TM; x: number; y: number; z?: number }> = ({ m, x, y, z = -3 }) => (
  <group position={[x, y, z]}>
    <mesh material={m.ship} scale={[4, 0.8, 1.2]}>
      <sphereGeometry args={[1, 32, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} />
    </mesh>
    <mesh material={m.shell} position={[0, 0.5, 0]}>
      <boxGeometry args={[6.5, 0.9, 2]} />
    </mesh>
    <mesh material={m.concrete} position={[-1.5, 1.4, 0]}>
      <boxGeometry args={[1.6, 1.0, 1.6]} />
    </mesh>
    {[0.3, 1.3, 2.3].map((cx) => (
      <mesh key={cx} material={[m.accent, m.red, m.fish][Math.round(cx) % 3]} position={[cx, 1.3, 0]}>
        <boxGeometry args={[0.9, 0.7, 1.5]} />
      </mesh>
    ))}
  </group>
);

// ---------- mud chamber (inside, facing camera) ----------
export const MudBlobs: React.FC<{ m: TM; t: number; fill: number; push?: number }> = ({ m, t, fill, push = 0 }) => {
  const geos = useMemo(() => [0, 1, 2].map((i) => blobGeometry(20 + i, 0.3, 3, 2.2)), []);
  const blobs = useMemo(() => {
    const r = rng(14);
    return Array.from({ length: 34 }, () => ({ a: r() * Math.PI * 2, rr: Math.sqrt(r()) * 0.85, s: 0.12 + r() * 0.14, g: Math.floor(r() * 3), k: r() }));
  }, []);
  return (
    <>
      {blobs.filter((b) => b.k < fill).map((b, i) => {
        const a = b.a + t * 0.6 * (i % 2 ? 1 : -1);
        return <mesh key={i} geometry={geos[b.g]} material={m.mud} position={[Math.cos(a) * b.rr, Math.sin(a) * b.rr, 0.2 + push * 0.3 + Math.sin(t * 3 + i) * 0.04]} scale={b.s * (1 + push * 0.3)} />;
      })}
    </>
  );
};

// ---------- table diorama (sea over rock, tunnel progress along x) ----------
export const Diorama: React.FC<{ m: TM; t: number; progress: number; from?: "right" | "both"; position?: any; carX?: number; pop?: number }> = ({ m, t, progress, from = "right", position, carX, pop = 1 }) => {
  const W = 2.0, H = 1.15, D = 0.75;
  const wave = Math.sin(t * 2) * 0.01;
  const tunnelLen = W * progress;
  return (
    <group position={position} scale={[1, pop, 1]}>
      <mesh material={m.rock1} position={[0, 0.18, 0]}>
        <boxGeometry args={[W, 0.36, D]} />
      </mesh>
      <mesh material={m.chalk} position={[0, 0.45, 0]}>
        <boxGeometry args={[W, 0.18, D]} />
      </mesh>
      <mesh material={m.sand} position={[0, 0.58, 0]}>
        <boxGeometry args={[W, 0.08, D]} />
      </mesh>
      <mesh material={m.water} position={[0, 0.62 + (H - 0.62) / 2 + wave, 0]}>
        <boxGeometry args={[W, H - 0.62, D]} />
      </mesh>
      <mesh material={m.glass} position={[0, H / 2, 0]}>
        <boxGeometry args={[W + 0.04, H, D + 0.04]} />
      </mesh>
      {tunnelLen > 0.01 && (
        <>
          {from === "right" ? (
            <mesh material={m.light} position={[W / 2 - tunnelLen / 2, 0.3, D / 2 + 0.002]} >
              <planeGeometry args={[tunnelLen, 0.12]} />
            </mesh>
          ) : (
            [-1, 1].map((s) => (
              <mesh key={s} material={m.light} position={[s * (W / 2 - tunnelLen / 4), 0.3, D / 2 + 0.002]}>
                <planeGeometry args={[tunnelLen / 2, 0.12]} />
              </mesh>
            ))
          )}
          <Glow position={[from === "right" ? W / 2 - tunnelLen : 0, 0.3, D / 2 + 0.05]} scale={0.5} color="#2ff0ff" opacity={0.9} />
        </>
      )}
      {carX !== undefined && (
        <mesh material={m.shell} position={[carX, 0.3, D / 2 + 0.01]}>
          <boxGeometry args={[0.12, 0.06, 0.02]} />
        </mesh>
      )}
      {/* tiny fish in the water */}
      {[0, 1, 2].map((i) => (
        <mesh key={i} material={m.fish} position={[((t * 0.3 + i * 0.6) % 1.8) - 0.9, 0.85 + i * 0.08, D / 2 - 0.1 - i * 0.15]} scale={[0.05, 0.025, 0.015]}>
          <sphereGeometry args={[1, 10, 8]} />
        </mesh>
      ))}
    </group>
  );
};

// mini drill in the hand (axis along dir)
export const MiniDrill: React.FC<{ m: TM; hand: THREE.Vector3; dir: THREE.Vector3; spin: number; scale?: number; aim?: THREE.Vector3 }> = ({ m, hand, dir, spin, scale = 1, aim }) => {
  const d = aim ? aim.clone().sub(hand) : dir;
  const q = new THREE.Quaternion().setFromUnitVectors(v(0, 1, 0), d.clone().normalize());
  return (
    <group position={hand} quaternion={q} scale={scale}>
      <mesh material={m.shell} position={[0, 0.3, 0]}>
        <cylinderGeometry args={[0.13, 0.13, 0.5, 24]} />
      </mesh>
      <group position={[0, 0.58, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={0.15}>
        <Cutterhead m={m} spin={spin} glow={0.3} />
      </group>
    </group>
  );
};
export const drillTip = (hand: THREE.Vector3, dir: THREE.Vector3) => hand.clone().add(dir.clone().normalize().multiplyScalar(0.62));

// four-story building silhouette
export const Building: React.FC<{ m: TM; position?: any; scale?: any; floors?: number }> = ({ m, position, scale, floors = 4 }) => (
  <group position={position} scale={scale}>
    {Array.from({ length: floors }, (_, i) => (
      <group key={i} position={[0, i * 0.5 + 0.25, 0]}>
        <mesh material={m.concrete}>
          <boxGeometry args={[1.2, 0.48, 0.8]} />
        </mesh>
        {[-0.35, 0, 0.35].map((x) => (
          <mesh key={x} material={m.light} position={[x, 0, 0.41]}>
            <planeGeometry args={[0.2, 0.22]} />
          </mesh>
        ))}
      </group>
    ))}
  </group>
);

// football field outline
export const Field: React.FC<{ position?: any; length: number }> = ({ position, length }) => {
  const g = useMemo(() => new THREE.MeshStandardMaterial({ color: "#3acf6a", roughness: 0.8, emissive: new THREE.Color("#0a6a2a"), emissiveIntensity: 0.4 }), []);
  const w = useMemo(() => new THREE.MeshBasicMaterial({ color: "#ffffff", toneMapped: false }), []);
  return (
    <group position={position}>
      <mesh material={g} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[length, length * 0.6]} />
      </mesh>
      {[-0.5, -0.25, 0, 0.25, 0.5].map((f) => (
        <mesh key={f} material={w} position={[f * length * 0.98, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.04, length * 0.6]} />
        </mesh>
      ))}
    </group>
  );
};

export const progressPulse = (t: number) => 0.5 + 0.5 * Math.sin(t * 6);
export { clamp, easeOut, lerp, range, smooth };
