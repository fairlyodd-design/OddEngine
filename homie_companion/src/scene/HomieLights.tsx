export function HomieLights() {
  return (
    <>
      <ambientLight intensity={1.1} />
      <directionalLight position={[4, 6, 4]} intensity={2.2} />
      <directionalLight position={[-3, 3, -4]} intensity={0.6} />
      <pointLight position={[0, 2, 3]} intensity={1.2} />
    </>
  );
}
