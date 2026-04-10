import { Canvas } from "@react-three/fiber";
import { Float } from "@react-three/drei";
import type { AvatarRuntime } from "../types/avatar";
import type { HomieState } from "../types/homie";
import { HomieAvatar } from "./HomieAvatar";
import { HomieCamera } from "./HomieCamera";
import { HomieLights } from "./HomieLights";
import { HomieStage } from "./HomieStage";

type Props = {
  state: HomieState;
  avatar: AvatarRuntime;
  speechAmplitude?: number;
  onAvatarLoading: (sourceUrl: string) => void;
  onAvatarReady: (sourceUrl: string) => void;
  onAvatarError: (error: string, sourceUrl: string) => void;
};

export function HomieScene({ state, avatar, speechAmplitude = 0, onAvatarLoading, onAvatarReady, onAvatarError }: Props) {
  return (
    <div className="scene-shell">
      <Canvas>
        <color attach="background" args={["#08111d"]} />
        <HomieCamera />
        <HomieLights />
        <Float speed={1.2} rotationIntensity={0.05} floatIntensity={0.15}>
          <HomieAvatar
            state={state}
            avatar={avatar}
            speechAmplitude={speechAmplitude}
            onAvatarLoading={onAvatarLoading}
            onAvatarReady={onAvatarReady}
            onAvatarError={onAvatarError}
          />
        </Float>
        <HomieStage />
      </Canvas>
    </div>
  );
}
