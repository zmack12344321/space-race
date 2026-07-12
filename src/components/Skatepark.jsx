// Triplex-ready "skatepark playground" level.
//
// VISUAL ONLY — no <RigidBody>/physics here, so Triplex opens this file
// standalone (no rapier context needed). You build/move/scale the ramps in
// Triplex; `Game.jsx` wraps <Skatepark/> in <Physics> with auto cuboid
// colliders, so the colliders follow your edits with zero desync.
//
// Every object is a named literal-transform <group> wrapping a <mesh>, so each
// is individually draggable/scalable (and duplicable with Cmd+D) in Triplex.
export const Skatepark = () => {
  return (
    <group>
      <group name="Floor" position={[0, -0.5, 0]} rotation={[0, 0, 0]} scale={[1, 1, 1]}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[60, 1, 60]} />
          <meshStandardMaterial color="#3a3f4b" />
        </mesh>
      </group>

      <group name="Ramp1" position={[-14.52, 1.2, -4]} rotation={[0, 0, -0.3849065850398869]} scale={[1, 1, 1]}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[10, 0.5, 5]} />
          <meshStandardMaterial color="#5a6072" />
        </mesh>
      </group>

      <group name="Ramp2" position={[7, 0, 2]} rotation={[0, 0.4, 0.3]} scale={[1, 1, 1]}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[8, 0.5, 4]} />
          <meshStandardMaterial color="#5a6072" />
        </mesh>
      </group>

      <group name="Ramp3" position={[0, 0, 10]} rotation={[0.4, 0, 0]} scale={[1, 1, 1]}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[12, 0.5, 4]} />
          <meshStandardMaterial color="#5a6072" />
        </mesh>
      </group>

      <group name="Rail" position={[0, 1, -2]} rotation={[0, 0, 0]} scale={[1, 1, 1]}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[0.2, 2, 6]} />
          <meshStandardMaterial color="#c0c4cc" metalness={0.6} roughness={0.3} />
        </mesh>
      </group>

      <group name="Wall" position={[0, 1.5, -18]} rotation={[0, 0, 0]} scale={[1, 1, 1]}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[40, 3, 1]} />
          <meshStandardMaterial color="#2a2e38" />
        </mesh>
      </group>
    </group>
  );
};
