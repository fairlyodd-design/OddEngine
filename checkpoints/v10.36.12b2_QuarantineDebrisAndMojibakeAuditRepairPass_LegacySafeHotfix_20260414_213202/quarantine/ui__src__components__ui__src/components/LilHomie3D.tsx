import React, { Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Canvas, useFrame } from "@react-three/fiber";
import { useGLTF, useTexture } from "@react-three/drei";

// Lightweight 3D buddy renderer.
// - If /public/models/lilhomie.glb exists: loads it and plays Idle/Walk/Talk animations (by name)
// - Otherwise: renders a billboard head using the Fortnite mascot texture + simple capsule body.

type Props = {
  hostRef: React.RefObject<HTMLElement>;
  /** Optional: allow tweaking energy from prefs in the future */
  energy?: number;
};

function useHostState(hostRef: React.RefObject<HTMLElement>) {
  const stateRef = useRef({ walking: false, speaking: false, faceLeft: false });
  useFrame(() => {
    const el = hostRef.current;
    if (!el) return;
    const cls = el.classList;
    stateRef.current.walking = cls.contains("walking");
    stateRef.current.speaking = cls.contains("speaking");
    stateRef.current.faceLeft = cls.contains("face-left");
  });
  return stateRef;
}

function MascotFallback({ hostRef, energy = 0.9 }: Props) {
  const headTex = useTexture("/assets/homie-mascot.png");
  const buddyRef = useRef<THREE.Group>(null);
  const s = useHostState(hostRef);

  useMemo(() => {
    // improve texture quality on small avatar
    headTex.colorSpace = THREE.SRGBColorSpace;
    headTex.anisotropy = 8;
    headTex.needsUpdate = true;
    return null;
  }, [headTex]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const g = buddyRef.current;
    if (!g) return;
    const st = s.current;

    const idle = 0.06 + 0.05 * energy;
    const bob = Math.sin(t * (1.6 + energy)) * idle;
    const talk = st.speaking ? (Math.sin(t * 10.5) * 0.03 + 0.04) : 0;
    const walk = st.walking ? (Math.sin(t * 12.0) * 0.05) : 0;

    g.position.y = bob + walk + talk;
    g.rotation.y = THREE.MathUtils.lerp(g.rotation.y, st.faceLeft ? Math.PI : 0, 0.18);
    g.rotation.z = Math.sin(t * 0.9) * 0.02;
    g.scale.setScalar(1 + (st.speaking ? 0.02 : 0));
  });

  return (
    <group ref={buddyRef} position={[0, -0.15, 0]}>
      {/* soft ground shadow */}
      <mesh position={[0, -0.95, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.45, 32]} />
        <meshStandardMaterial color="#000" transparent opacity={0.22} />
      </mesh>

      {/* body */}
      <mesh position={[0, -0.55, 0]}>
        <capsuleGeometry args={[0.28, 0.55, 10, 20]} />
        <meshStandardMaterial color="#2a2d34" roughness={0.6} metalness={0.05} />
      </mesh>

      {/* hoodie accent */}
      <mesh position={[0, -0.43, 0.01]}>
        <torusGeometry args={[0.20, 0.06, 16, 36]} />
        <meshStandardMaterial color="#1f232a" roughness={0.7} metalness={0.02} />
      </mesh>

      {/* head billboard */}
      <mesh position={[0, 0.05, 0.16]}>
        <planeGeometry args={[0.95, 0.95]} />
        <meshStandardMaterial map={headTex} transparent roughness={0.9} metalness={0.0} />
      </mesh>

      {/* subtle rim glow */}
      <mesh position={[0, 0.02, -0.02]}>
        <sphereGeometry args={[0.54, 24, 24]} />
        <meshStandardMaterial color="#88ffd6" emissive="#88ffd6" emissiveIntensity={0.08} transparent opacity={0.08} />
      </mesh>
    </group>
  );
}

function pickActionName(names: string[], kind: "idle" | "walk" | "talk") {
  const k = kind.toLowerCase();
  const direct = names.find((n) => n.toLowerCase() === k);
  if (direct) return direct;
  const contains = names.find((n) => n.toLowerCase().includes(k));
  if (contains) return contains;
  // common alternates
  if (kind === "idle") return names.find((n) => /stand|breath/.test(n.toLowerCase())) || names[0];
  if (kind === "walk") return names.find((n) => /run|move/.test(n.toLowerCase())) || names[0];
  if (kind === "talk") return names.find((n) => /speak|chat/.test(n.toLowerCase())) || names[0];
  return names[0];
}

function LilHomieModel({ hostRef, energy = 0.9 }: Props) {
  const group = useRef<THREE.Group>(null);
  const s = useHostState(hostRef);

  // glTF model at /public/models/lilhomie.glb
  const gltf = useGLTF("/models/lilhomie.glb");

  const mixer = useMemo(() => new THREE.AnimationMixer(gltf.scene), [gltf.scene]);
  const actionsRef = useRef<{ idle?: THREE.AnimationAction; walk?: THREE.AnimationAction; talk?: THREE.AnimationAction }>({});
  const activeRef = useRef<"idle" | "walk" | "talk">("idle");

  useEffect(() => {
    const clips = gltf.animations || [];
    if (!clips.length) return;
    const names = clips.map((c) => c.name);
    const idleName = pickActionName(names, "idle");
    const walkName = pickActionName(names, "walk");
    const talkName = pickActionName(names, "talk");

    const idle = mixer.clipAction(clips.find((c) => c.name === idleName) || clips[0], gltf.scene);
    const walk = mixer.clipAction(clips.find((c) => c.name === walkName) || clips[0], gltf.scene);
    const talk = mixer.clipAction(clips.find((c) => c.name === talkName) || clips[0], gltf.scene);

    idle.play();
    walk.play();
    talk.play();

    idle.weight = 1;
    walk.weight = 0;
    talk.weight = 0;

    actionsRef.current = { idle, walk, talk };
    return () => {
      try {
        idle.stop();
        walk.stop();
        talk.stop();
        mixer.stopAllAction();
      } catch {}
    };
  }, [gltf.animations, gltf.scene, mixer]);

  // optional: drive common mouth morphs if present
  const mouthTargets = useMemo(() => {
    const targets: Array<{ mesh: THREE.Mesh; index: number }> = [];
    gltf.scene.traverse((obj) => {
      const m = obj as any;
      if (!m.isMesh) return;
      const dict = m.morphTargetDictionary as Record<string, number> | undefined;
      const infl = m.morphTargetInfluences as number[] | undefined;
      if (!dict || !infl) return;
      const key = Object.keys(dict).find((k) => /mouthopen|jawopen|viseme_aa|aa|oh|open/i.test(k));
      if (!key) return;
      targets.push({ mesh: m as THREE.Mesh, index: dict[key] });
    });
    return targets;
  }, [gltf.scene]);

  useFrame(({ clock }, dt) => {
    const t = clock.getElapsedTime();
    const st = s.current;

    // choose main state
    const next: "idle" | "walk" | "talk" = st.walking ? "walk" : st.speaking ? "talk" : "idle";
    if (next !== activeRef.current) {
      activeRef.current = next;
      const { idle, walk, talk } = actionsRef.current;
      if (idle && walk && talk) {
        idle.weight = next === "idle" ? 1 : 0;
        walk.weight = next === "walk" ? 1 : 0;
        talk.weight = next === "talk" ? 1 : 0;
      }
    }

    // animate mixer
    mixer.update(dt);

    // face direction
    const g = group.current;
    if (g) {
      g.rotation.y = THREE.MathUtils.lerp(g.rotation.y, st.faceLeft ? Math.PI : 0, 0.18);
      const idleBob = Math.sin(t * (1.4 + energy)) * (0.02 + 0.02 * energy);
      const talkBob = st.speaking ? (Math.sin(t * 10.0) * 0.015 + 0.01) : 0;
      g.position.y = idleBob + talkBob;
    }

    // mouth morphs
    if (mouthTargets.length) {
      const talkLevel = st.speaking ? (0.45 + 0.45 * Math.max(0, Math.sin(t * 11.0))) : 0.02;
      for (const { mesh, index } of mouthTargets) {
        const infl = (mesh as any).morphTargetInfluences as number[] | undefined;
        if (!infl || index == null) continue;
        infl[index] = THREE.MathUtils.lerp(infl[index] || 0, talkLevel, 0.25);
      }
    }
  });

  return (
    <group ref={group} position={[0, -0.85, 0]}>
      <primitive object={gltf.scene} />
    </group>
  );
}

export default function LilHomie3D({ hostRef, energy = 0.9 }: Props) {
  const [hasModel, setHasModel] = useState<boolean>(false);

  useEffect(() => {
    let alive = true;
    // Check if the user dropped a model file in public/models.
    // Vite may SPA-fallback unknown paths to index.html (200 + text/html), so we guard against that.
    fetch("/models/lilhomie.glb", { method: "HEAD", cache: "no-store" as any })
      .then((r) => {
        const ct = (r.headers.get("content-type") || "").toLowerCase();
        const ok = r.ok && !ct.includes("text/html");
        if (alive) setHasModel(ok);
      })
      .catch(() => alive && setHasModel(false));
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="lilAgent3D" aria-hidden="true">
      <Canvas
        dpr={[1, 2]}
        gl={{ alpha: true, antialias: true, premultipliedAlpha: false }}
        camera={{ position: [0, 0.15, 2.15], fov: 42 }}
        style={{ width: "120px", height: "160px", background: "transparent", pointerEvents: "none" }}
      >
        <ambientLight intensity={0.85} />
        <directionalLight position={[2, 3, 2]} intensity={1.15} />
        <directionalLight position={[-2, 2, -1]} intensity={0.6} />

        <Suspense fallback={null}>
          {hasModel ? <LilHomieModel hostRef={hostRef} energy={energy} /> : <MascotFallback hostRef={hostRef} energy={energy} />}
        </Suspense>
      </Canvas>
    </div>
  );
}

