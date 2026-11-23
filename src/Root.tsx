import React from "react";
import { Composition } from "remotion";
import { FPS } from "./engine/VideoBase";
import { VIDEOS } from "./videos";

export const Root: React.FC = () => (
  <>
    {VIDEOS.map((v) => (
      <Composition key={v.id} id={v.id} component={v.component} durationInFrames={v.frames} fps={FPS} width={1080} height={1920} />
    ))}
  </>
);
