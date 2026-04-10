import { useEffect, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Box3, Group, Object3D, Vector3 } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { motionForState } from "./avatarMotions";
import type { AvatarKind } from "../types/avatar";
import type { HomieState } from "../types/homie";

type RuntimePayload = {
  root: Object3D;
  vrm?: { update?: (delta: number) => void };
};

type Props = {
  state: HomieState;
  sourceUrl: string;
  scale: number;
  kind: AvatarKind;
  onLoading: () => void;
  onReady: () => void;
  onError: (message: string) => void;
};

function centerModel(root: Object3D) {
  const box = new Box3().setFromObject(root);
  const center = new Vector3();
  box.getCenter(center);
  root.position.x -= center.x;
  root.position.z -= center.z;
  root.position.y -= box.min.y;
}

function damp(current: number, target: number, speed = 0.12) {
  return current + (target - current) * speed;
}

export function LoadedAvatar({ state, sourceUrl, scale, kind, onLoading, onReady, onError }: Props) {
  const rigRef = useRef<Group>(null);
  const [payload, setPayload] = useState<RuntimePayload | null>(null);
  const current = useRef({ y: 0, bodyTilt: 0, turn: 0, scale: scale });

  useEffect(() => {
    let disposed = false;
    if (!sourceUrl) {
      setPayload(null);
      return;
    }

    onLoading();
    setPayload(null);

    async function load() {
      try {
        const loader = new GLTFLoader();
        if (kind === "vrm") {
          const { VRMLoaderPlugin } = await import("@pixiv/three-vrm");
          loader.register((parser) => new VRMLoaderPlugin(parser));
        }

        loader.load(
          sourceUrl,
          (gltf) => {
            if (disposed) return;
            const vrm = gltf.userData?.vrm;
            const root = vrm?.scene || gltf.scene;
            root.rotation.set(0, 0, 0);
            centerModel(root);
            setPayload({ root, vrm });
            onReady();
          },
          undefined,
          (error) => {
            if (disposed) return;
            onError(String(error?.message || error || "Unknown avatar loader error"));
          }
        );
      } catch (error) {
        if (disposed) return;
        onError(String(error instanceof Error ? error.message : error));
      }
    }

    void load();

    return () => {
      disposed = true;
      setPayload(null);
    };
  }, [kind, onError, onLoading, onReady, sourceUrl]);

  useFrame((_state, delta) => {
    const rig = rigRef.current;
    if (!rig) return;
    const target = motionForState(state, performance.now() / 1000);
    current.current.y = damp(current.current.y, target.y);
    current.current.bodyTilt = damp(current.current.bodyTilt, target.bodyTilt);
    current.current.turn = damp(current.current.turn, target.turn);
    current.current.scale = damp(current.current.scale, scale, 0.08);

    rig.position.y = current.current.y;
    rig.rotation.z = current.current.bodyTilt * 0.12;
    rig.rotation.y = current.current.turn * 0.85;
    rig.scale.setScalar(current.current.scale);
    if (payload?.vrm?.update) payload.vrm.update(delta);
  });

  if (!payload) return null;

  return (
    <group ref={rigRef} position={[0, -1.12, 0]}>
      <primitive object={payload.root} />
    </group>
  );
}
