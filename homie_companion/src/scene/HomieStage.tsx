export function HomieStage() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.2, 0]} receiveShadow>
        <circleGeometry args={[1.48, 48]} />
        <meshStandardMaterial color="#1a2a45" roughness={0.8} metalness={0.15} />
      </mesh>
      <mesh position={[0, -1.04, -0.22]}>
        <torusGeometry args={[0.96, 0.035, 16, 64]} />
        <meshBasicMaterial color="#57c7ff" />
      </mesh>
    </group>
  );
}
