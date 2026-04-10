import { useCallback, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group, Mesh } from "three";
import type { AvatarRuntime } from "../types/avatar";
import type { HomieState } from "../types/homie";
import { detectAvatarKind } from "../lib/avatarRuntime";
import { motionForState } from "./avatarMotions";
import { LoadedAvatar } from "./LoadedAvatar";

type Props = {
  state: HomieState;
  avatar: AvatarRuntime;
  speechAmplitude?: number;
  onAvatarLoading: (sourceUrl: string) => void;
  onAvatarReady: (sourceUrl: string) => void;
  onAvatarError: (error: string, sourceUrl: string) => void;
};

function damp(current: number, target: number, speed = 0.12) {
  return current + (target - current) * speed;
}

function ProceduralFallback({ state, speechAmplitude = 0 }: { state: HomieState; speechAmplitude?: number }) {
  const rigRef = useRef<Group>(null);
  const leftArmRef = useRef<Group>(null);
  const rightArmRef = useRef<Group>(null);
  const haloRef = useRef<Mesh>(null);
  const mouthRef = useRef<Mesh>(null);
  const current = useRef({ y: 0, bodyTilt: 0, armSwing: 0, glow: 0.3, turn: 0, mouth: 0.08 });

  useFrame(({ clock }) => {
    const rig = rigRef.current;
    const leftArm = leftArmRef.current;
    const rightArm = rightArmRef.current;
    const halo = haloRef.current;
    const mouth = mouthRef.current;
    if (!rig || !leftArm || !rightArm || !halo || !mouth) return;

    const target = motionForState(state, clock.getElapsedTime());
    const talkingTarget = state === "talking" ? 0.1 + speechAmplitude * 0.32 + Math.abs(Math.sin(clock.getElapsedTime() * 9)) * 0.06 : 0.08;
    current.current.y = damp(current.current.y, target.y);
    current.current.bodyTilt = damp(current.current.bodyTilt, target.bodyTilt);
    current.current.armSwing = damp(current.current.armSwing, target.armSwing);
    current.current.glow = damp(current.current.glow, target.glow);
    current.current.turn = damp(current.current.turn, target.turn);
    current.current.mouth = damp(current.current.mouth, talkingTarget, 0.22);

    rig.position.y = current.current.y;
    rig.rotation.z = current.current.bodyTilt * 0.2;
    rig.rotation.y = current.current.turn;
    leftArm.rotation.z = -0.38 - current.current.armSwing;
    rightArm.rotation.z = 0.38 + current.current.armSwing;

    halo.scale.setScalar(1 + current.current.glow * 0.12);
    halo.position.y = 1.24 + current.current.y * 0.15;
    mouth.scale.set(1, current.current.mouth, 1);
  });

  return (
    <group ref={rigRef} position={[0, -0.18, 0]}>
      <mesh ref={haloRef} position={[0, 1.25, -0.2]}>
        <circleGeometry args={[0.8, 48]} />
        <meshBasicMaterial color="#6fd7ff" transparent opacity={0.18} />
      </mesh>

      <mesh position={[0, 1.05, 0]}>
        <sphereGeometry args={[0.38, 32, 32]} />
        <meshStandardMaterial color="#f4d1b0" />
      </mesh>

      <mesh position={[0, 1.45, 0.03]}>
        <sphereGeometry args={[0.42, 32, 32]} />
        <meshStandardMaterial color="#f2f2f2" />
      </mesh>

      <mesh position={[0, 0.25, 0]}>
        <capsuleGeometry args={[0.42, 0.95, 10, 16]} />
        <meshStandardMaterial color={state === "alert" ? "#ffb560" : state === "celebrate" ? "#8d9cff" : "#74a8ff"} />
      </mesh>

      <group ref={leftArmRef} position={[-0.52, 0.45, 0]}>
        <mesh position={[0, -0.28, 0]}>
          <capsuleGeometry args={[0.1, 0.55, 8, 12]} />
          <meshStandardMaterial color="#f4d1b0" />
        </mesh>
      </group>

      <group ref={rightArmRef} position={[0.52, 0.45, 0]}>
        <mesh position={[0, -0.28, 0]}>
          <capsuleGeometry args={[0.1, 0.55, 8, 12]} />
          <meshStandardMaterial color="#f4d1b0" />
        </mesh>
      </group>

      <group position={[-0.2, -0.65, 0]}>
        <mesh position={[0, -0.35, 0]}>
          <capsuleGeometry args={[0.11, 0.72, 8, 12]} />
          <meshStandardMaterial color="#2a3650" />
        </mesh>
      </group>

      <group position={[0.2, -0.65, 0]}>
        <mesh position={[0, -0.35, 0]}>
          <capsuleGeometry args={[0.11, 0.72, 8, 12]} />
          <meshStandardMaterial color="#2a3650" />
        </mesh>
      </group>

      <mesh position={[-0.13, 1.1, 0.34]}>
        <sphereGeometry args={[0.035, 18, 18]} />
        <meshBasicMaterial color="#222" />
      </mesh>
      <mesh position={[0.13, 1.1, 0.34]}>
        <sphereGeometry args={[0.035, 18, 18]} />
        <meshBasicMaterial color="#222" />
      </mesh>
      <mesh ref={mouthRef} position={[0, 0.95, 0.34]}>
        <torusGeometry args={[0.09, 0.012, 12, 32, Math.PI]} />
        <meshBasicMaterial color="#8b4f2c" />
      </mesh>
    </group>
  );
}

export function HomieAvatar({ state, avatar, speechAmplitude = 0, onAvatarLoading, onAvatarReady, onAvatarError }: Props) {
  const kind = detectAvatarKind(avatar.sourceUrl);
  const shouldAttemptLoad = Boolean(avatar.sourceUrl) && kind !== "fallback";

  const handleLoading = useCallback(() => {
    onAvatarLoading(avatar.sourceUrl);
  }, [avatar.sourceUrl, onAvatarLoading]);

  const handleReady = useCallback(() => {
    onAvatarReady(avatar.sourceUrl);
  }, [avatar.sourceUrl, onAvatarReady]);

  const handleError = useCallback((message: string) => {
    onAvatarError(message, avatar.sourceUrl);
  }, [avatar.sourceUrl, onAvatarError]);

  return (
    <group>
      {shouldAttemptLoad ? (
        <LoadedAvatar
          state={state}
          sourceUrl={avatar.sourceUrl}
          scale={avatar.scale}
          kind={kind}
          onLoading={handleLoading}
          onReady={handleReady}
          onError={handleError}
        />
      ) : null}

      {!shouldAttemptLoad || avatar.status !== "ready" ? (
        <group scale={avatar.scale * 1.08} position={[0, -0.22, 0]}>
          <ProceduralFallback state={state} speechAmplitude={speechAmplitude} />
        </group>
      ) : null}
    </group>
  );
}
