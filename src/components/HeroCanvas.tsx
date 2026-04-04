'use client';

import { useRef, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, Stars } from '@react-three/drei';
import * as THREE from 'three';

function pseudoRandom(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453123;
  return x - Math.floor(x);
}

function createParticlePositions(count: number): Float32Array {
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = (pseudoRandom(i * 3 + 1) - 0.5) * 20;
    positions[i * 3 + 1] = (pseudoRandom(i * 3 + 2) - 0.5) * 15;
    positions[i * 3 + 2] = (pseudoRandom(i * 3 + 3) - 0.5) * 10 - 3;
  }
  return positions;
}

const PARTICLE_COUNT = 200;
const PARTICLE_POSITIONS = createParticlePositions(PARTICLE_COUNT);

// A floating photo frame mesh
function PhotoFrame({ position, rotation, scale, color }: {
  position: [number, number, number];
  rotation: [number, number, number];
  scale: number;
  color: string;
}) {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.y = state.clock.elapsedTime * 0.08 + rotation[1];
      meshRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.3 + position[0]) * 0.05;
    }
  });

  return (
    <Float speed={1.5} rotationIntensity={0.3} floatIntensity={0.8}>
      <mesh ref={meshRef} position={position} scale={scale}>
        {/* Frame outer */}
        <boxGeometry args={[1.6, 1.2, 0.06]} />
        <meshStandardMaterial
          color={color}
          metalness={0.6}
          roughness={0.3}
        />
      </mesh>
      {/* Photo inside */}
      <mesh position={[position[0], position[1], position[2] + 0.04]} scale={scale}>
        <boxGeometry args={[1.3, 0.95, 0.01]} />
        <meshStandardMaterial
          color="#1a1206"
          metalness={0}
          roughness={0.8}
        />
      </mesh>
    </Float>
  );
}

// Album book shape
function Album({ position, scale }: {
  position: [number, number, number];
  scale: number;
}) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = state.clock.elapsedTime * 0.06 + position[0];
      groupRef.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * 0.5 + position[2]) * 0.15;
    }
  });

  return (
    <group ref={groupRef} position={position} scale={scale}>
      {/* Book body */}
      <mesh>
        <boxGeometry args={[1.4, 1.0, 0.18]} />
        <meshStandardMaterial color="#2a1f10" metalness={0.1} roughness={0.9} />
      </mesh>
      {/* Gold spine */}
      <mesh position={[-0.7, 0, 0]}>
        <boxGeometry args={[0.04, 1.0, 0.19]} />
        <meshStandardMaterial color="#D4A853" metalness={0.8} roughness={0.2} />
      </mesh>
      {/* Cover detail */}
      <mesh position={[0, 0, 0.1]}>
        <boxGeometry args={[1.1, 0.7, 0.01]} />
        <meshStandardMaterial color="#1a1206" metalness={0} roughness={0.95} />
      </mesh>
    </group>
  );
}

// Particle system (bokeh-like dots)
function Particles() {
  const pointsRef = useRef<THREE.Points>(null);

  useFrame((state) => {
    if (pointsRef.current) {
      pointsRef.current.rotation.y = state.clock.elapsedTime * 0.01;
    }
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[PARTICLE_POSITIONS, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.04}
        color="#D4A853"
        transparent
        opacity={0.6}
        sizeAttenuation
      />
    </points>
  );
}

function Scene() {
  return (
    <>
      <ambientLight intensity={0.3} />
      <pointLight position={[5, 5, 5]} intensity={1.5} color="#D4A853" />
      <pointLight position={[-5, -3, 3]} intensity={0.8} color="#C8A882" />
      <pointLight position={[0, 8, -2]} intensity={0.5} color="#ffffff" />

      <Stars radius={80} depth={50} count={800} factor={2} fade speed={0.5} />
      <Particles />

      {/* Photo Frames */}
      <PhotoFrame position={[-3.5, 0.5, -1]} rotation={[0, 0.3, 0]} scale={0.85} color="#D4A853" />
      <PhotoFrame position={[3.8, -0.3, -2]} rotation={[0, -0.5, 0]} scale={0.75} color="#C8A882" />
      <PhotoFrame position={[-1.5, -1.8, 0.5]} rotation={[0.1, 0.2, 0]} scale={0.65} color="#B8934A" />
      <PhotoFrame position={[1.5, 1.8, -0.5]} rotation={[0, -0.15, 0]} scale={0.7} color="#E0B86A" />

      {/* Albums */}
      <Album position={[-4.5, -1.5, -2]} scale={0.8} />
      <Album position={[4.2, 1.2, -3]} scale={0.7} />
      <Album position={[0, -2.5, -1.5]} scale={0.6} />
    </>
  );
}

// Static fallback for mobile
function StaticBackground() {
  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      background: 'radial-gradient(ellipse at 30% 50%, rgba(212,168,83,0.12) 0%, transparent 60%), radial-gradient(ellipse at 70% 30%, rgba(200,168,130,0.08) 0%, transparent 50%)',
    }} />
  );
}

export default function HeroCanvas({ isMobile }: { isMobile?: boolean }) {
  if (isMobile) return <StaticBackground />;

  return (
    <div className="hero-canvas">
      <Canvas
        camera={{ position: [0, 0, 7], fov: 55 }}
        gl={{ antialias: true, alpha: true }}
        dpr={[1, 1.5]}
      >
        <Suspense fallback={null}>
          <Scene />
        </Suspense>
      </Canvas>
    </div>
  );
}
