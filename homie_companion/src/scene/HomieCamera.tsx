import { useLayoutEffect, useRef } from "react";
import { PerspectiveCamera } from "@react-three/drei";
import type { PerspectiveCamera as ThreePerspectiveCamera } from "three";

const CAMERA_TARGET: [number, number, number] = [0, -0.34, 0];

export function HomieCamera() {
  const cameraRef = useRef<ThreePerspectiveCamera>(null);

  useLayoutEffect(() => {
    cameraRef.current?.lookAt(...CAMERA_TARGET);
  }, []);

  return (
    <PerspectiveCamera
      ref={cameraRef}
      makeDefault
      position={[0, 0.5, 5.85]}
      fov={38}
      near={0.1}
      far={100}
      onUpdate={(camera) => camera.lookAt(...CAMERA_TARGET)}
    />
  );
}
