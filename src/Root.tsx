import React from "react";
import { Composition } from "remotion";
import { DURATION_FRAMES, FPS, Science01 } from "./Video";
export const Root: React.FC = () => (
  <Composition id="Science01" component={Science01} durationInFrames={DURATION_FRAMES} fps={FPS} width={1080} height={1920} />
);
