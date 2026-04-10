import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group, Mesh, Texture } from "three";
import { CircleGeometry, MeshBasicMaterial, RepeatWrapping, SRGBColorSpace, TextureLoader } from "three";
import type { HomieState } from "../types/homie";
import { motionForState } from "./avatarMotions";

type SpriteSheetDef = {
  file: string;
  columns: number;
  rows: number;
  frame_width: number;
  frame_height: number;
};

type SpriteAnimationDef = {
  fps: number;
  frame_count: number;
  loop?: boolean;
  sprite_sheet: SpriteSheetDef;
};

type SpriteFocusDef = {
  sprite_height?: number;
  pose_y?: number;
  pose_z?: number;
  aura_scale?: number;
  aura_opacity?: number;
  floor_glow_y?: number;
};

type SpriteBlinkDef = {
  enabled?: boolean;
  min_interval_ms?: number;
  max_interval_ms?: number;
};

type SpriteManifest = {
  name?: string;
  anchor?: {
    x?: number;
    y?: number;
  };
  focus?: SpriteFocusDef;
  blink?: SpriteBlinkDef;
  animations: {
    idle?: SpriteAnimationDef;
    talk?: SpriteAnimationDef;
    listening?: SpriteAnimationDef;
    alert?: SpriteAnimationDef;
    celebrate?: SpriteAnimationDef;
    blink?: SpriteAnimationDef;
  };
};

type LoadedSpriteAnimation = SpriteAnimationDef & {
  texture: Texture;
};

type LoadedSpritePayload = {
  anchorX: number;
  anchorY: number;
  focus: Required<SpriteFocusDef>;
  blink: Required<SpriteBlinkDef>;
  animations: Partial<Record<keyof SpriteManifest["animations"], LoadedSpriteAnimation>>;
};

type Props = {
  state: HomieState;
  sourceUrl: string;
  scale: number;
  onLoading: () => void;
  onReady: () => void;
  onError: (message: string) => void;
};

const FLOOR_GLOW_GEOMETRY = new CircleGeometry(0.66, 48);
const DEFAULT_FOCUS: Required<SpriteFocusDef> = {
  sprite_height: 2.22,
  pose_y: -1.0,
  pose_z: 0.1,
  aura_scale: 1.015,
  aura_opacity: 0.045,
  floor_glow_y: -1.17
};
const DEFAULT_BLINK: Required<SpriteBlinkDef> = {
  enabled: true,
  min_interval_ms: 2800,
  max_interval_ms: 5400
};

function damp(current: number, target: number, speed = 0.12) {
  return current + (target - current) * speed;
}

function resolveAssetPath(baseUrl: string, file: string) {
  if (!file) return file;
  if (file.startsWith("http://") || file.startsWith("https://") || file.startsWith("/")) return file;
  const base = baseUrl.slice(0, baseUrl.lastIndexOf("/") + 1);
  return `${base}${file}`;
}

function loadTexture(url: string) {
  return new Promise<Texture>((resolve, reject) => {
    const loader = new TextureLoader();
    loader.load(url, resolve, undefined, reject);
  });
}

function isSpriteManifest(value: unknown): value is SpriteManifest {
  return Boolean(value) && typeof value === "object" && "animations" in (value as Record<string, unknown>);
}

function buildStaticManifest(sourceUrl: string): SpriteManifest {
  return {
    anchor: { x: 0.5, y: 0.92 },
    focus: DEFAULT_FOCUS,
    blink: { enabled: false, min_interval_ms: DEFAULT_BLINK.min_interval_ms, max_interval_ms: DEFAULT_BLINK.max_interval_ms },
    animations: {
      idle: {
        fps: 12,
        frame_count: 1,
        loop: true,
        sprite_sheet: {
          file: sourceUrl,
          columns: 1,
          rows: 1,
          frame_width: 384,
          frame_height: 384
        }
      },
      talk: {
        fps: 12,
        frame_count: 1,
        loop: true,
        sprite_sheet: {
          file: sourceUrl,
          columns: 1,
          rows: 1,
          frame_width: 384,
          frame_height: 384
        }
      }
    }
  };
}

function animationNameForState(state: HomieState, payload: LoadedSpritePayload) {
  if (state === "talking" && payload.animations.talk) return "talk" as const;
  if (state === "listening" && payload.animations.listening) return "listening" as const;
  if (state === "alert" && payload.animations.alert) return "alert" as const;
  if (state === "celebrate" && payload.animations.celebrate) return "celebrate" as const;
  return "idle" as const;
}

function applyFrame(texture: Texture, animation: LoadedSpriteAnimation, frameIndex: number) {
  const columns = Math.max(1, animation.sprite_sheet.columns || 1);
  const rows = Math.max(1, animation.sprite_sheet.rows || 1);
  const frame = Math.max(0, Math.min(frameIndex, animation.frame_count - 1));
  const column = frame % columns;
  const rowFromTop = Math.floor(frame / columns);
  const rowFromBottom = rows - rowFromTop - 1;

  texture.repeat.set(1 / columns, 1 / rows);
  texture.offset.set(column / columns, rowFromBottom / rows);
  texture.needsUpdate = true;
}

function randomBetween(min: number, max: number) {
  if (max <= min) return min;
  return min + Math.random() * (max - min);
}

export function SpriteAvatar({ state, sourceUrl, scale, onLoading, onReady, onError }: Props) {
  const billboardRef = useRef<Group>(null);
  const poseRef = useRef<Group>(null);
  const planeRef = useRef<Mesh>(null);
  const auraRef = useRef<Mesh>(null);
  const textureRefs = useRef<Texture[]>([]);
  const [payload, setPayload] = useState<LoadedSpritePayload | null>(null);
  const current = useRef({ y: 0, bodyTilt: 0, turn: 0, scale, glow: 0.36 });
  const lastFrameRef = useRef(-1);
  const lastAnimationRef = useRef("");
  const blinkStartMsRef = useRef<number | null>(null);
  const nextBlinkAtMsRef = useRef<number>(0);

  useEffect(() => {
    let disposed = false;
    textureRefs.current.forEach((texture) => texture.dispose());
    textureRefs.current = [];
    setPayload(null);
    lastFrameRef.current = -1;
    lastAnimationRef.current = "";
    blinkStartMsRef.current = null;
    nextBlinkAtMsRef.current = 0;

    onLoading();

    async function load() {
      try {
        const manifest = sourceUrl.toLowerCase().endsWith(".json")
          ? await fetch(sourceUrl).then(async (response) => {
              if (!response.ok) {
                throw new Error(`Failed to fetch sprite manifest: ${response.status} ${response.statusText}`);
              }
              return response.json();
            })
          : buildStaticManifest(sourceUrl);

        if (!isSpriteManifest(manifest)) {
          throw new Error("Sprite manifest is missing the animations block");
        }

        const requestedAnimations = Object.entries(manifest.animations).filter((entry): entry is [keyof SpriteManifest["animations"], SpriteAnimationDef] => Boolean(entry[1]));
        if (!requestedAnimations.length || !manifest.animations.idle) {
          throw new Error("Sprite manifest needs at least an idle animation");
        }

        const loadedAnimations = await Promise.all(requestedAnimations.map(async ([name, animation]) => {
          const texturePath = resolveAssetPath(sourceUrl, animation.sprite_sheet.file);
          const texture = await loadTexture(texturePath);
          texture.colorSpace = SRGBColorSpace;
          texture.wrapS = RepeatWrapping;
          texture.wrapT = RepeatWrapping;
          texture.generateMipmaps = true;
          texture.needsUpdate = true;
          const loadedAnimation: LoadedSpriteAnimation = { ...animation, texture };
          applyFrame(texture, loadedAnimation, 0);
          return [name, loadedAnimation] as const;
        }));

        if (disposed) {
          loadedAnimations.forEach(([, animation]) => animation.texture.dispose());
          return;
        }

        textureRefs.current = loadedAnimations.map(([, animation]) => animation.texture);
        setPayload({
          anchorX: manifest.anchor?.x ?? 0.5,
          anchorY: manifest.anchor?.y ?? 0.92,
          focus: {
            sprite_height: manifest.focus?.sprite_height ?? DEFAULT_FOCUS.sprite_height,
            pose_y: manifest.focus?.pose_y ?? DEFAULT_FOCUS.pose_y,
            pose_z: manifest.focus?.pose_z ?? DEFAULT_FOCUS.pose_z,
            aura_scale: manifest.focus?.aura_scale ?? DEFAULT_FOCUS.aura_scale,
            aura_opacity: manifest.focus?.aura_opacity ?? DEFAULT_FOCUS.aura_opacity,
            floor_glow_y: manifest.focus?.floor_glow_y ?? DEFAULT_FOCUS.floor_glow_y
          },
          blink: {
            enabled: manifest.blink?.enabled ?? DEFAULT_BLINK.enabled,
            min_interval_ms: manifest.blink?.min_interval_ms ?? DEFAULT_BLINK.min_interval_ms,
            max_interval_ms: manifest.blink?.max_interval_ms ?? DEFAULT_BLINK.max_interval_ms
          },
          animations: Object.fromEntries(loadedAnimations)
        });
        onReady();
      } catch (error) {
        if (disposed) return;
        onError(String(error instanceof Error ? error.message : error));
      }
    }

    void load();

    return () => {
      disposed = true;
      textureRefs.current.forEach((texture) => texture.dispose());
      textureRefs.current = [];
    };
  }, [onError, onLoading, onReady, sourceUrl]);

  const baseAnimation = useMemo(() => {
    if (!payload) return null;
    const name = animationNameForState(state, payload);
    return payload.animations[name] || payload.animations.idle || null;
  }, [payload, state]);

  const planeSize = useMemo(() => {
    const animation = baseAnimation || payload?.animations.idle || null;
    const frameWidth = animation?.sprite_sheet.frame_width || 384;
    const frameHeight = animation?.sprite_sheet.frame_height || 384;
    const aspect = frameWidth / Math.max(1, frameHeight);
    const height = payload?.focus.sprite_height ?? DEFAULT_FOCUS.sprite_height;
    return {
      width: height * aspect,
      height
    };
  }, [baseAnimation, payload]);

  useFrame(({ camera, clock }) => {
    const billboard = billboardRef.current;
    const pose = poseRef.current;
    const plane = planeRef.current;
    const aura = auraRef.current;
    if (!billboard || !pose || !plane || !aura || !payload || !baseAnimation) return;

    const nowMs = clock.getElapsedTime() * 1000;
    const blinkAnimation = payload.animations.blink;

    if (blinkAnimation && payload.blink.enabled) {
      if (!nextBlinkAtMsRef.current) {
        nextBlinkAtMsRef.current = nowMs + randomBetween(payload.blink.min_interval_ms, payload.blink.max_interval_ms);
      }

      const blinkDurationMs = (blinkAnimation.frame_count / Math.max(1, blinkAnimation.fps)) * 1000;
      if (blinkStartMsRef.current !== null && nowMs - blinkStartMsRef.current >= blinkDurationMs) {
        blinkStartMsRef.current = null;
        nextBlinkAtMsRef.current = nowMs + randomBetween(payload.blink.min_interval_ms, payload.blink.max_interval_ms);
      }

      if (blinkStartMsRef.current === null && nowMs >= nextBlinkAtMsRef.current) {
        blinkStartMsRef.current = nowMs;
      }
    }

    const target = motionForState(state, clock.getElapsedTime());
    current.current.y = damp(current.current.y, target.y);
    current.current.bodyTilt = damp(current.current.bodyTilt, target.bodyTilt);
    current.current.turn = damp(current.current.turn, target.turn);
    current.current.scale = damp(current.current.scale, scale, 0.08);
    current.current.glow = damp(current.current.glow, target.glow, 0.1);

    billboard.quaternion.copy(camera.quaternion);

    const blinkActive = Boolean(blinkAnimation && blinkStartMsRef.current !== null);
    const animationName = blinkActive ? "blink" : animationNameForState(state, payload);
    const animation = (blinkActive ? blinkAnimation : payload.animations[animationName]) || baseAnimation;
    const talkPulse = state === "talking" && !blinkActive
      ? (Math.sin(clock.getElapsedTime() * 13) + 1) / 2
      : 0;

    pose.position.y = payload.focus.pose_y + current.current.y + talkPulse * 0.02;
    pose.position.z = payload.focus.pose_z;
    pose.rotation.z = current.current.bodyTilt * 0.1;
    pose.rotation.y = current.current.turn * 0.4;
    pose.scale.set(
      current.current.scale * (1 + talkPulse * 0.012),
      current.current.scale * (1 + talkPulse * 0.05),
      current.current.scale
    );

    let frame = 0;
    if (blinkActive && blinkAnimation && blinkStartMsRef.current !== null) {
      frame = Math.min(
        blinkAnimation.frame_count - 1,
        Math.floor(((nowMs - blinkStartMsRef.current) / 1000) * Math.max(1, blinkAnimation.fps))
      );
    } else if (animation.frame_count > 1) {
      frame = Math.floor(clock.getElapsedTime() * Math.max(1, animation.fps)) % animation.frame_count;
    }

    if (frame !== lastFrameRef.current || animationName !== lastAnimationRef.current) {
      applyFrame(animation.texture, animation, frame);
      lastFrameRef.current = frame;
      lastAnimationRef.current = animationName;

      const material = plane.material as MeshBasicMaterial;
      material.map = animation.texture;
      material.needsUpdate = true;

      const auraMaterial = aura.material as MeshBasicMaterial;
      auraMaterial.map = animation.texture;
      auraMaterial.needsUpdate = true;
    }

    plane.position.x = planeSize.width * (payload.anchorX - 0.5);
    plane.position.y = planeSize.height * (payload.anchorY - 0.5) + talkPulse * 0.01;
    plane.scale.set(
      planeSize.width * (1 + talkPulse * 0.01),
      planeSize.height * (1 + talkPulse * 0.04),
      1
    );

    aura.position.x = plane.position.x;
    aura.position.y = plane.position.y + 0.01;
    aura.scale.set(
      planeSize.width * (payload.focus.aura_scale + current.current.glow * 0.028),
      planeSize.height * (payload.focus.aura_scale + current.current.glow * 0.035),
      1
    );
    (aura.material as MeshBasicMaterial).opacity = payload.focus.aura_opacity + current.current.glow * 0.035;
  });

  if (!payload || !baseAnimation) return null;

  return (
    <group ref={billboardRef}>
      <group ref={poseRef}>
        <mesh ref={auraRef} position={[0, -0.08, -0.03]}>
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial color="#6fd7ff" transparent alphaTest={0.04} opacity={0.06} toneMapped={false} />
        </mesh>
        <mesh ref={planeRef}>
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial map={baseAnimation.texture} transparent alphaTest={0.03} toneMapped={false} />
        </mesh>
        <mesh position={[0, payload.focus.floor_glow_y, -0.12]} rotation={[-Math.PI / 2, 0, 0]} geometry={FLOOR_GLOW_GEOMETRY}>
          <meshBasicMaterial color="#57c7ff" transparent opacity={0.065} toneMapped={false} />
        </mesh>
      </group>
    </group>
  );
}
