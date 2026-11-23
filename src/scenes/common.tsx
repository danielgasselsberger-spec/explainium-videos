import React from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as PP from "postprocessing";
import * as THREE from "three";

export type CamSpec = { pos: number[]; target: number[]; fov?: number; roll?: number };

export const Cam: React.FC<CamSpec & { shake?: number; t?: number }> = ({ pos, target, fov = 35, roll = 0, shake = 0, t = 0 }) => {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const sx = shake * (Math.sin(t * 71.3) * 0.6 + Math.sin(t * 43.1) * 0.4);
  const sy = shake * (Math.cos(t * 63.7) * 0.6 + Math.sin(t * 37.9) * 0.4);
  camera.position.set(pos[0] + sx, pos[1] + sy, pos[2]);
  camera.up.set(Math.sin(roll), Math.cos(roll), 0);
  camera.lookAt(target[0] + sx * 0.5, target[1] + sy * 0.5, target[2]);
  if (camera.fov !== fov) {
    camera.fov = fov;
    camera.updateProjectionMatrix();
  }
  camera.near = 0.02;
  camera.far = 400;
  camera.updateProjectionMatrix();
  return null;
};

export const StudioLights: React.FC<{ warm?: number; dim?: number }> = ({ warm = 1, dim = 1 }) => (
  <>
    <hemisphereLight args={["#e9f6ff", "#ffb3d1", 1.25 * dim]} />
    <directionalLight position={[4, 6, 8]} intensity={2.3 * warm * dim} color="#fff4e8" />
    <directionalLight position={[-6, 2, 4]} intensity={0.9 * dim} color="#9ff3ff" />
    <directionalLight position={[3, 3, -6]} intensity={2.2 * dim} color="#ff6fd0" />
    <pointLight position={[0, 1, 6]} intensity={6 * dim} distance={14} color="#ffffff" />
  </>
);

export const MacroLights: React.FC<{ tint?: string; rim?: string; key?: number }> = ({ tint = "#ff4fb0", rim = "#2ff0ff", key = 1 }) => (
  <>
    <hemisphereLight args={["#ffd6f0", "#3a0a5a", 0.9]} />
    <directionalLight position={[3, 5, 6]} intensity={2.4 * key} color="#ffffff" />
    <directionalLight position={[-5, -2, 2]} intensity={1.6} color={rim} />
    <directionalLight position={[2, 2, -6]} intensity={2.4} color={tint} />
  </>
);

// Post settings are written by the current shot during render and read by <PostFX/> each frame.
export const postSettings = { focus: 6, bokeh: 3, bloom: 0.9 };
export const Post: React.FC<{ focus?: number; bokeh?: number; bloom?: number; dof?: boolean }> = ({ focus = 6, bokeh = 3, bloom = 0.9, dof = true }) => {
  postSettings.focus = focus;
  postSettings.bokeh = dof ? bokeh : 0;
  postSettings.bloom = bloom;
  return null;
};

// synchronous composer (the @react-three/postprocessing one initialises asynchronously,
// which leaves the first frame after a mount blank in Remotion renders)
export const PostFX: React.FC = () => {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const fx = React.useMemo(() => {
    const composer = new PP.EffectComposer(gl, { frameBufferType: THREE.HalfFloatType, multisampling: 0 });
    composer.addPass(new PP.RenderPass(scene, camera));
    const dof = new PP.DepthOfFieldEffect(camera, { worldFocusDistance: 6, worldFocusRange: 2, bokehScale: 3 });
    const bloom = new PP.BloomEffect({ mipmapBlur: true, luminanceThreshold: 0.62, luminanceSmoothing: 0.25, intensity: 0.9, radius: 0.7 });
    const vignette = new PP.VignetteEffect({ offset: 0.32, darkness: 0.42 });
    composer.addPass(new PP.EffectPass(camera, dof));
    composer.addPass(new PP.EffectPass(camera, bloom, vignette));
    return { composer, dof, bloom };
  }, [gl, scene, camera]);
  React.useLayoutEffect(() => { fx.composer.setSize(size.width, size.height); }, [fx, size.width, size.height]);
  React.useEffect(() => () => fx.composer.dispose(), [fx]);
  useFrame((_, delta) => {
    const s = postSettings;
    fx.dof.cocMaterial.worldFocusDistance = s.focus;
    fx.dof.cocMaterial.worldFocusRange = Math.max(0.5, s.focus * 0.35);
    fx.dof.bokehScale = s.bokeh;
    fx.bloom.intensity = s.bloom;
    fx.composer.render(delta);
  }, 1);
  return null;
};
