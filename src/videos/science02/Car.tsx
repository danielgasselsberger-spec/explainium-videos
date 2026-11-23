import React, { useMemo } from "react";
import * as THREE from "three";
import { useEnvMap } from "../../engine/common";
import { Glow, Inst, Instances } from "../../engine/prims";
import { clamp, easeOut, lerp, mixColor, range, rng, smooth } from "../../engine/lib";

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

// ---------- shared materials ----------
export function useFactoryMats() {
  const env = useEnvMap();
  return useMemo(() => {
    const steel = new THREE.MeshStandardMaterial({ color: "#8f9aae", metalness: 0.85, roughness: 0.32, envMap: env, envMapIntensity: 0.65 });
    const darkSteel = new THREE.MeshStandardMaterial({ color: "#4a4f63", metalness: 0.8, roughness: 0.35, envMap: env });
    const paint = new THREE.MeshPhysicalMaterial({ color: "#ff2d8f", metalness: 0.35, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.06, envMap: env, envMapIntensity: 1.3 });
    const glass = new THREE.MeshPhysicalMaterial({ color: "#1b2350", metalness: 0.2, roughness: 0.05, clearcoat: 1, envMap: env, envMapIntensity: 1.6 });
    const tire = new THREE.MeshStandardMaterial({ color: "#26232e", roughness: 0.7 });
    const rim = new THREE.MeshStandardMaterial({ color: "#3ff0e0", metalness: 0.9, roughness: 0.2, envMap: env, emissive: new THREE.Color("#0a8a80"), emissiveIntensity: 0.4 });
    const head = new THREE.MeshStandardMaterial({ color: "#fff6d0", emissive: new THREE.Color("#fff2b0"), emissiveIntensity: 0.2, toneMapped: false });
    const tail = new THREE.MeshStandardMaterial({ color: "#ff3355", emissive: new THREE.Color("#ff1a3a"), emissiveIntensity: 0.4 });
    const robot = new THREE.MeshStandardMaterial({ color: "#dcd8ee", metalness: 0.2, roughness: 0.4, envMap: env, envMapIntensity: 0.6 });
    const robotJoint = new THREE.MeshStandardMaterial({ color: "#ff3fa8", metalness: 0.3, roughness: 0.3, envMap: env, emissive: new THREE.Color("#c0106a"), emissiveIntensity: 0.3 });
    const accent = new THREE.MeshStandardMaterial({ color: "#2fe8ff", metalness: 0.5, roughness: 0.25, envMap: env, emissive: new THREE.Color("#0aa0c0"), emissiveIntensity: 0.6 });
    const copper = new THREE.MeshStandardMaterial({ color: "#e08a4a", metalness: 0.9, roughness: 0.25, envMap: env });
    const wood = new THREE.MeshStandardMaterial({ color: "#ffb347", roughness: 0.5 });
    return { steel, darkSteel, paint, glass, tire, rim, head, tail, robot, robotJoint, accent, copper, wood };
  }, [env]);
}
export type FM = ReturnType<typeof useFactoryMats>;

// ---------- car geometry (length 4, height ~1.6, width ~1.84, wheels on y=0.32) ----------
let _carGeo: { body: THREE.BufferGeometry; glass: THREE.BufferGeometry } | null = null;
function carGeo() {
  if (_carGeo) return _carGeo;
  const s = new THREE.Shape();
  s.moveTo(-2, 0.34);
  s.lineTo(-2.04, 0.84);
  s.quadraticCurveTo(-2.0, 1.02, -1.6, 1.04);
  s.lineTo(-1.05, 1.06);
  s.quadraticCurveTo(-0.78, 1.5, -0.42, 1.53);
  s.lineTo(0.42, 1.53);
  s.quadraticCurveTo(0.78, 1.5, 1.18, 1.06);
  s.lineTo(1.82, 0.96);
  s.quadraticCurveTo(2.1, 0.92, 2.08, 0.6);
  s.lineTo(2.04, 0.34);
  s.lineTo(1.74, 0.34);
  s.absarc(1.25, 0.34, 0.49, 0, Math.PI, false);
  s.lineTo(-0.76, 0.34);
  s.absarc(-1.25, 0.34, 0.49, 0, Math.PI, false);
  s.lineTo(-2, 0.34);
  const body = new THREE.ExtrudeGeometry(s, { depth: 1.56, bevelEnabled: true, bevelThickness: 0.14, bevelSize: 0.12, bevelSegments: 5, curveSegments: 28 });
  body.translate(0, 0, -0.78);
  body.computeVertexNormals();
  const g = new THREE.Shape();
  g.moveTo(-0.95, 1.1);
  g.quadraticCurveTo(-0.72, 1.44, -0.42, 1.47);
  g.lineTo(0.4, 1.47);
  g.quadraticCurveTo(0.72, 1.44, 1.05, 1.1);
  g.lineTo(-0.95, 1.1);
  const glass = new THREE.ExtrudeGeometry(g, { depth: 1.86, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.04, bevelSegments: 2, curveSegments: 16 });
  glass.translate(0, 0, -0.93);
  _carGeo = { body, glass };
  return _carGeo;
}

export type CarState = {
  paint?: number; // 0 raw steel, 0.5 primer, 1 magenta
  glass?: number; // 0/1
  wheels?: number; // 0..1 (scale in)
  lights?: number; // 0..1 headlights
  wet?: number; // 0..1 water droplets
  engine?: boolean; // show engine block under the body (seen from below)
  ghost?: number; // 0..1 fade (opacity)
  t?: number;
};

export const Car: React.FC<CarState & { m: FM; position?: any; rotation?: any; scale?: any }> = ({ m, paint = 1, glass = 1, wheels = 1, lights = 0, wet = 0, engine = false, t = 0, position, rotation, scale }) => {
  const geo = carGeo();
  const bodyMat = useMemo(() => m.paint.clone(), [m]);
  const c = mixColor([[0, "#8f9aae"], [0.45, "#d8d2e8"], [1, "#ff2d8f"]], paint);
  bodyMat.color.copy(c);
  bodyMat.metalness = lerp(0.85, 0.35, smooth(paint));
  bodyMat.roughness = lerp(0.28, 0.22, paint);
  bodyMat.clearcoat = smooth(range(paint, 0.6, 1)) + wet * 0.5;
  const headMat = useMemo(() => m.head.clone(), [m]);
  headMat.emissiveIntensity = 0.2 + lights * 3;
  const drops = useMemo(() => {
    const r = rng(4);
    return Array.from({ length: 120 }, () => ({ p: v((r() - 0.5) * 3.8, 0.5 + r() * 1.0, (r() > 0.5 ? 1 : -1) * 0.94), s: 0.03 + r() * 0.05, sp: r() }));
  }, []);
  const dropMat = useMemo(() => new THREE.MeshPhysicalMaterial({ color: "#bff6ff", roughness: 0, transmission: 0, transparent: true, opacity: 0.8, clearcoat: 1, emissive: new THREE.Color("#5fd8ff"), emissiveIntensity: 0.4 }), []);
  const sph = useMemo(() => new THREE.SphereGeometry(1, 10, 8), []);
  const dropItems: Inst[] = wet > 0 ? drops.filter((d) => d.sp < wet).map((d) => ({ p: v(d.p.x, d.p.y - ((t * (0.2 + d.sp * 0.5)) % 0.6), d.p.z), r: new THREE.Euler(), s: new THREE.Vector3(d.s, d.s * 1.4, d.s * 0.5) })) : [];
  return (
    <group position={position} rotation={rotation} scale={scale}>
      <mesh geometry={geo.body} material={bodyMat} />
      {glass > 0 && <mesh geometry={geo.glass} material={m.glass} />}
      {/* windshield + rear window */}
      {glass > 0 && (
        <>
          <mesh material={m.glass} position={[0.84, 1.3, 0]} rotation={[0, 0, -0.9]}>
            <boxGeometry args={[0.66, 0.03, 1.6]} />
          </mesh>
          <mesh material={m.glass} position={[-0.83, 1.3, 0]} rotation={[0, 0, 0.95]}>
            <boxGeometry args={[0.6, 0.03, 1.6]} />
          </mesh>
        </>
      )}
      {[-1.25, 1.25].map((x) =>
        [-1, 1].map((sz) => (
          <group key={`${x}${sz}`} position={[x, 0.34, sz * 0.86]} rotation={[Math.PI / 2, 0, 0]} scale={easeOut(wheels)}>
            <mesh material={m.tire}>
              <cylinderGeometry args={[0.42, 0.42, 0.3, 32]} />
            </mesh>
            <mesh material={m.rim} position={[0, sz * 0.02, 0]} rotation={[0, t * 2, 0]}>
              <cylinderGeometry args={[0.25, 0.25, 0.32, 6]} />
            </mesh>
          </group>
        )),
      )}
      {[-1, 1].map((sz) => (
        <mesh key={sz} material={headMat} position={[2.1, 0.74, sz * 0.58]} scale={[0.06, 0.1, 0.2]}>
          <sphereGeometry args={[1, 16, 12]} />
        </mesh>
      ))}
      {[-1, 1].map((sz) => (
        <mesh key={"t" + sz} material={m.tail} position={[-2.07, 0.8, sz * 0.6]} scale={[0.05, 0.08, 0.18]}>
          <sphereGeometry args={[1, 16, 12]} />
        </mesh>
      ))}
      {lights > 0.05 &&
        [-1, 1].map((sz) => <Glow key={"g" + sz} position={[2.25, 0.74, sz * 0.58]} scale={1.2 * lights} color="#fff4c0" opacity={lights} />)}
      {engine && <Engine m={m} position={[1.1, 0.55, 0]} scale={0.55} t={t} />}
      {dropItems.length > 0 && <Instances geometry={sph} material={dropMat} items={dropItems} max={120} />}
    </group>
  );
};

// ---------- engine block ----------
export const Engine: React.FC<{ m: FM; position?: any; scale?: any; t: number; glow?: number }> = ({ m, position, scale, t, glow = 0.6 }) => (
  <group position={position} scale={scale}>
    <mesh material={m.darkSteel}>
      <boxGeometry args={[1.4, 0.9, 1.0]} />
    </mesh>
    {[-0.45, -0.15, 0.15, 0.45].map((x, i) => (
      <group key={x}>
        <mesh material={m.robotJoint} position={[x, 0.6 + Math.max(0, Math.sin(t * 14 + i * 1.6)) * 0.08, 0]}>
          <cylinderGeometry args={[0.13, 0.13, 0.35, 20]} />
        </mesh>
      </group>
    ))}
    <mesh material={m.accent} position={[0.78, 0.05, 0]} rotation={[0, 0, Math.PI / 2]}>
      <cylinderGeometry args={[0.3, 0.3, 0.12, 28]} />
    </mesh>
    <mesh material={m.steel} position={[0, 0.5, 0]}>
      <boxGeometry args={[1.3, 0.12, 0.6]} />
    </mesh>
    <Glow position={[0, 0.2, 0.55]} scale={1.6} color="#ff4fb0" opacity={glow} />
  </group>
);

// ---------- robot arm (base at origin) ----------
export const Robot: React.FC<{ m: FM; a: number[]; position?: any; rotation?: any; scale?: any; tool?: "weld" | "spray"; children?: React.ReactNode }> = ({ m, a, position, rotation, scale, children }) => (
  <group position={position} rotation={rotation} scale={scale}>
    <mesh material={m.robotJoint}>
      <cylinderGeometry args={[0.55, 0.7, 0.4, 32]} />
    </mesh>
    <group position={[0, 0.3, 0]} rotation={[0, a[0], 0]}>
      <mesh material={m.robot} position={[0, 0.25, 0]}>
        <cylinderGeometry args={[0.4, 0.45, 0.5, 24]} />
      </mesh>
      <group position={[0, 0.55, 0]} rotation={[0, 0, a[1]]}>
        <mesh material={m.robotJoint} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.3, 0.3, 0.6, 24]} />
        </mesh>
        <mesh material={m.robot} position={[0, 0.9, 0]}>
          <boxGeometry args={[0.38, 1.8, 0.38]} />
        </mesh>
        <group position={[0, 1.8, 0]} rotation={[0, 0, a[2]]}>
          <mesh material={m.robotJoint} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.24, 0.24, 0.5, 24]} />
          </mesh>
          <mesh material={m.robot} position={[0, 0.7, 0]}>
            <boxGeometry args={[0.3, 1.4, 0.3]} />
          </mesh>
          <group position={[0, 1.4, 0]} rotation={[0, 0, a[3] ?? 0]}>
            <mesh material={m.accent}>
              <sphereGeometry args={[0.2, 20, 14]} />
            </mesh>
            <mesh material={m.darkSteel} position={[0, 0.3, 0]}>
              <cylinderGeometry args={[0.08, 0.12, 0.5, 16]} />
            </mesh>
            <group position={[0, 0.58, 0]}>{children}</group>
          </group>
        </group>
      </group>
    </group>
  </group>
);

// ---------- sparks burst (deterministic, age in seconds) ----------
export const Sparks: React.FC<{ age: number; seed?: number; count?: number; speed?: number; position?: any; spread?: number; size?: number; color?: string; gravity?: number }> = ({
  age, seed = 1, count = 60, speed = 3, position, spread = 1, size = 1, color = "#ffd27a", gravity = 4,
}) => {
  const base = useMemo(() => {
    const r = rng(seed);
    return Array.from({ length: count }, () => ({ d: v(r() - 0.5, r() * 0.9 + 0.1, r() - 0.5).normalize(), sp: 0.4 + r(), life: 0.3 + r() * 0.5, del: r() * 0.15 }));
  }, [seed, count]);
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ color, toneMapped: false }), [color]);
  const geo = useMemo(() => new THREE.BoxGeometry(0.02, 0.18, 0.02), []);
  const items: Inst[] = [];
  for (const b of base) {
    const a = age - b.del;
    if (a < 0 || a > b.life) continue;
    const p = b.d.clone().multiply(v(spread, 1, spread)).multiplyScalar(speed * b.sp * a);
    p.y -= gravity * a * a * 0.5;
    const vel = b.d.clone().multiplyScalar(speed * b.sp);
    vel.y -= gravity * a;
    const k = 1 - a / b.life;
    items.push({ p, r: new THREE.Quaternion().setFromUnitVectors(v(0, 1, 0), vel.normalize()), s: new THREE.Vector3(k * size, k * size * 1.4, k * size) });
  }
  if (!items.length) return null;
  return (
    <group position={position}>
      <Instances geometry={geo} material={mat} items={items} max={count} />
    </group>
  );
};

// ---------- steel coil ----------
let _coilTex: THREE.Texture | null = null;
function coilTexture() {
  if (_coilTex) return _coilTex;
  const c = document.createElement("canvas");
  c.width = c.height = 512;
  const g = c.getContext("2d")!;
  g.fillStyle = "#8a94a6";
  g.fillRect(0, 0, 512, 512);
  for (let r = 60; r < 256; r += 3.2) {
    g.strokeStyle = `rgba(${90 + (r % 7) * 12},${100 + (r % 5) * 12},${125 + (r % 3) * 15},0.9)`;
    g.lineWidth = 1.2;
    g.beginPath();
    g.arc(256, 256, r, 0, Math.PI * 2);
    g.stroke();
  }
  _coilTex = new THREE.CanvasTexture(c);
  _coilTex.colorSpace = THREE.SRGBColorSpace;
  return _coilTex;
}
export const Coil: React.FC<{ m: FM; position?: any; rotation?: any; scale?: any; spin?: number }> = ({ m, position, rotation, scale, spin = 0 }) => {
  const capMat = useMemo(() => new THREE.MeshStandardMaterial({ map: coilTexture(), color: "#8a8fa0", metalness: 0.6, roughness: 0.45, envMap: m.steel.envMap, envMapIntensity: 0.5 }), [m]);
  return (
    <group position={position} rotation={rotation} scale={scale}>
      <group rotation={[0, 0, spin]}>
        <mesh material={m.steel} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[2, 2, 1.6, 64, 1, true]} />
        </mesh>
        <mesh material={m.darkSteel} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.5, 0.5, 1.6, 32, 1, true]} />
        </mesh>
        {[-1, 1].map((s) => (
          <mesh key={s} material={capMat} position={[0, 0, s * 0.8]} rotation={[0, s > 0 ? 0 : Math.PI, 0]}>
            <ringGeometry args={[0.5, 2, 64, 1]} />
          </mesh>
        ))}
      </group>
    </group>
  );
};

// fix ring UVs so the concentric texture maps radially (RingGeometry uses planar UVs already -> ok)

// ---------- simple press (frame + ram) ----------
export const Press: React.FC<{ m: FM; ram: number; position?: any; scale?: any }> = ({ m, ram, position, scale }) => (
  <group position={position} scale={scale}>
    <mesh material={m.robotJoint} position={[0, -0.25, 0]}>
      <boxGeometry args={[4.4, 0.5, 2.6]} />
    </mesh>
    {[-1.9, 1.9].map((x) => (
      <mesh key={x} material={m.robot} position={[x, 2.2, 0]}>
        <boxGeometry args={[0.5, 4.4, 1.2]} />
      </mesh>
    ))}
    <mesh material={m.robot} position={[0, 4.6, 0]}>
      <boxGeometry args={[4.4, 0.8, 1.6]} />
    </mesh>
    <mesh material={m.accent} position={[0, lerp(3.2, 0.75, ram), 0]}>
      <boxGeometry args={[3.0, 0.9, 2.0]} />
    </mesh>
    <mesh material={m.darkSteel} position={[0, lerp(3.2, 0.75, ram) + 0.9, 0]}>
      <cylinderGeometry args={[0.3, 0.3, 1.2, 20]} />
    </mesh>
  </group>
);

// hammer held in hand: handle along `dir`
export const toolDir = (dir: THREE.Vector3, kind: string) =>
  kind === "hammer" ? dir.clone().applyAxisAngle(v(1, 0, 0), Math.PI / 2).normalize() : dir.clone().normalize();
export const HandTool: React.FC<{ m: FM; hand: THREE.Vector3; dir: THREE.Vector3; kind: "hammer" | "torch" | "hose"; t?: number }> = ({ m, hand, dir, kind }) => {
  const q = new THREE.Quaternion().setFromUnitVectors(v(0, 1, 0), toolDir(dir, kind));
  return (
    <group position={hand} quaternion={q}>
      {kind === "hammer" && (
        <>
          <mesh material={m.wood} position={[0, 0.45, 0]}>
            <cylinderGeometry args={[0.07, 0.08, 0.95, 16]} />
          </mesh>
          <mesh material={m.steel} position={[0, 0.95, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <boxGeometry args={[0.24, 0.62, 0.24]} />
          </mesh>
          <mesh material={m.robotJoint} position={[0, 0.95, 0.32]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.13, 0.13, 0.06, 20]} />
          </mesh>
        </>
      )}
      {kind === "torch" && (
        <>
          <mesh material={m.robotJoint} position={[0, 0.3, 0]}>
            <cylinderGeometry args={[0.08, 0.08, 0.6, 16]} />
          </mesh>
          <mesh material={m.copper} position={[0, 0.7, 0]}>
            <cylinderGeometry args={[0.03, 0.06, 0.3, 12]} />
          </mesh>
        </>
      )}
      {kind === "hose" && (
        <>
          <mesh material={m.accent} position={[0, 0.25, 0]}>
            <cylinderGeometry args={[0.09, 0.09, 0.5, 16]} />
          </mesh>
          <mesh material={m.robotJoint} position={[0, 0.55, 0]}>
            <cylinderGeometry args={[0.05, 0.1, 0.18, 16]} />
          </mesh>
        </>
      )}
    </group>
  );
};
export const toolTip = (hand: THREE.Vector3, dir: THREE.Vector3, len: number) => hand.clone().add(dir.clone().normalize().multiplyScalar(len));
