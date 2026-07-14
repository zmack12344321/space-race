// Triplex-ready "skatepark playground" level.
//
// VISUAL ONLY — no <RigidBody>/physics here, so Triplex opens this file
// standalone (no rapier context needed). You build/move/scale the ramps in
// Triplex; `Game.jsx` wraps <Skatepark/> in <Physics> with auto cuboid
// colliders, so the colliders follow your edits with zero desync.
//
// Every object is a named literal-transform <group> wrapping a <mesh>, so each
// is individually draggable/scalable (and duplicable with Cmd+D) in Triplex.
import { useEffect } from "react";
import { Stars, useTexture } from "@react-three/drei";
import { CuboidCollider, MeshCollider, RigidBody } from "@react-three/rapier";
import * as THREE from "three";

const SCALE = 100;

function Piece({ name, position, rotation, size, materialColor, children }) {
  return (
    <RigidBody type="fixed" colliders={false}>
      <CuboidCollider args={[size[0] / 2, size[1] / 2, size[2] / 2]} position={position} rotation={rotation} />
      <group name={name} position={position} rotation={rotation} scale={[1, 1, 1]}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={size} />
          <meshStandardMaterial color={materialColor} />
        </mesh>
        <mesh>
          <boxGeometry args={size} />
          <meshBasicMaterial wireframe color="#00e5ff" transparent opacity={0.28} depthWrite={false} />
        </mesh>
        {children}
      </group>
    </RigidBody>
  );
}

function Floor({ moonColor, moonNormal }) {
  return (
    <RigidBody type="fixed" colliders={false}>
      <MeshCollider type="trimesh">
        <mesh name="Floor" position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[60 * SCALE, 60 * SCALE, 1, 1]} />
        </mesh>
      </MeshCollider>
      <group position={[0, 0, 0]}>
        <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[60 * SCALE, 60 * SCALE, 1, 1]} />
          <meshStandardMaterial map={moonColor} normalMap={moonNormal} roughness={1} metalness={0} />
        </mesh>
      </group>
    </RigidBody>
  );
}

export const Skatepark = () => {
  const [moonColor, moonNormal] = useTexture([
    "/moon_01_diff_1k.jpg",
    "/moon_01_nor_gl_1k.jpg",
  ]);

  useEffect(() => {
    [moonColor, moonNormal].forEach((texture) => {
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(24, 24);
      texture.anisotropy = 8;
      texture.needsUpdate = true;
    });
    moonColor.colorSpace = THREE.SRGBColorSpace;
  }, [moonColor, moonNormal]);

  return (
    <group>
      <Floor moonColor={moonColor} moonNormal={moonNormal} />

      <Piece
        name="Ramp1"
        position={[-14.52 * SCALE, 1.2 * SCALE, -4 * SCALE]}
        rotation={[0, 0, -0.3849065850398869]}
        size={[10 * SCALE, 0.5 * SCALE, 5 * SCALE]}
        materialColor="#5a6072"
      />

      <Piece
        name="Ramp2"
        position={[7 * SCALE, 0 * SCALE, 2 * SCALE]}
        rotation={[0, 0.4, 0.3]}
        size={[8 * SCALE, 0.5 * SCALE, 4 * SCALE]}
        materialColor="#5a6072"
      />

      <Piece
        name="Ramp3"
        position={[0 * SCALE, 0 * SCALE, 10 * SCALE]}
        rotation={[0.4, 0, 0]}
        size={[12 * SCALE, 0.5 * SCALE, 4 * SCALE]}
        materialColor="#5a6072"
      />

      <Piece
        name="Rail"
        position={[0 * SCALE, 1 * SCALE, -2 * SCALE]}
        rotation={[0, 0, 0]}
        size={[0.2 * SCALE, 2 * SCALE, 6 * SCALE]}
        materialColor="#c0c4cc"
      />

      <Piece
        name="Wall"
        position={[0 * SCALE, 1.5 * SCALE, -18 * SCALE]}
        rotation={[0, 0, 0]}
        size={[40 * SCALE, 3 * SCALE, 1 * SCALE]}
        materialColor="#2a2e38"
      />

      <group position={[0, 0, 0]}>
        <Stars radius={220} depth={180} count={2200} factor={4} fade speed={0.5} saturation={0.15} />
        <gridHelper args={[2400, 120, "#7dd3fc", "#1f2a44"]} position={[0, 820, 0]} />
        <gridHelper args={[2400, 120, "#7dd3fc", "#1f2a44"]} position={[0, 280, -1200]} rotation={[Math.PI / 2, 0, 0]} />
      </group>
    </group>
  );
};
