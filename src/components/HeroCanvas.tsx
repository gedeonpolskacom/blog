'use client';

import { useRef, Suspense, useEffect, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, Stars } from '@react-three/drei';
import * as THREE from 'three';

type ThemeMode = 'dark' | 'light';

type ThemePalette = {
  frameColors: [string, string, string, string];
  photoColor: string;
  albumColor: string;
  albumDetailColor: string;
  particleColor: string;
  particleOpacity: number;
  ambientLight: number;
  pointPrimary: number;
  pointSecondary: number;
  pointTop: number;
  showStars: boolean;
};

const DARK_PALETTE: ThemePalette = {
  frameColors: ['#D4A853', '#C8A882', '#B8934A', '#E0B86A'],
  photoColor: '#1a1206',
  albumColor: '#2a1f10',
  albumDetailColor: '#1a1206',
  particleColor: '#D4A853',
  particleOpacity: 0.6,
  ambientLight: 0.3,
  pointPrimary: 1.5,
  pointSecondary: 0.8,
  pointTop: 0.5,
  showStars: true,
};

const LIGHT_PALETTE: ThemePalette = {
  frameColors: ['#2A1B08', '#1F1408', '#251706', '#301E0B'],
  photoColor: '#070707',
  albumColor: '#2B1A0A',
  albumDetailColor: '#050505',
  particleColor: '#D4A853',
  particleOpacity: 0.78,
  ambientLight: 0.48,
  pointPrimary: 1.85,
  pointSecondary: 0.95,
  pointTop: 0.7,
  showStars: false,
};

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

const PARTICLE_COUNT = 220;
const PARTICLE_POSITIONS = createParticlePositions(PARTICLE_COUNT);

function PhotoFrame({
  position,
  rotation,
  scale,
  frameColor,
  photoColor,
}: {
  position: [number, number, number];
  rotation: [number, number, number];
  scale: number;
  frameColor: string;
  photoColor: string;
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
        <boxGeometry args={[1.6, 1.2, 0.06]} />
        <meshStandardMaterial color={frameColor} metalness={0.6} roughness={0.3} />
      </mesh>
      <mesh position={[position[0], position[1], position[2] + 0.04]} scale={scale}>
        <boxGeometry args={[1.3, 0.95, 0.01]} />
        <meshStandardMaterial color={photoColor} metalness={0} roughness={0.8} />
      </mesh>
    </Float>
  );
}

function Album({
  position,
  scale,
  albumColor,
  albumDetailColor,
}: {
  position: [number, number, number];
  scale: number;
  albumColor: string;
  albumDetailColor: string;
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
      <mesh>
        <boxGeometry args={[1.4, 1.0, 0.18]} />
        <meshStandardMaterial color={albumColor} metalness={0.1} roughness={0.9} />
      </mesh>
      <mesh position={[-0.7, 0, 0]}>
        <boxGeometry args={[0.04, 1.0, 0.19]} />
        <meshStandardMaterial color="#D4A853" metalness={0.8} roughness={0.2} />
      </mesh>
      <mesh position={[0, 0, 0.1]}>
        <boxGeometry args={[1.1, 0.7, 0.01]} />
        <meshStandardMaterial color={albumDetailColor} metalness={0} roughness={0.95} />
      </mesh>
    </group>
  );
}

function Particles({ color, opacity }: { color: string; opacity: number }) {
  const pointsRef = useRef<THREE.Points>(null);

  useFrame((state) => {
    if (pointsRef.current) {
      pointsRef.current.rotation.y = state.clock.elapsedTime * 0.01;
    }
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[PARTICLE_POSITIONS, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.045} color={color} transparent opacity={opacity} sizeAttenuation />
    </points>
  );
}

function Scene({ palette }: { palette: ThemePalette }) {
  return (
    <>
      <ambientLight intensity={palette.ambientLight} />
      <pointLight position={[5, 5, 5]} intensity={palette.pointPrimary} color="#D4A853" />
      <pointLight position={[-5, -3, 3]} intensity={palette.pointSecondary} color="#C8A882" />
      <pointLight position={[0, 8, -2]} intensity={palette.pointTop} color="#ffffff" />

      {palette.showStars && <Stars radius={80} depth={50} count={800} factor={2} fade speed={0.5} />}
      <Particles color={palette.particleColor} opacity={palette.particleOpacity} />

      <PhotoFrame
        position={[-3.5, 0.5, -1]}
        rotation={[0, 0.3, 0]}
        scale={0.85}
        frameColor={palette.frameColors[0]}
        photoColor={palette.photoColor}
      />
      <PhotoFrame
        position={[3.8, -0.3, -2]}
        rotation={[0, -0.5, 0]}
        scale={0.75}
        frameColor={palette.frameColors[1]}
        photoColor={palette.photoColor}
      />
      <PhotoFrame
        position={[-1.5, -1.8, 0.5]}
        rotation={[0.1, 0.2, 0]}
        scale={0.65}
        frameColor={palette.frameColors[2]}
        photoColor={palette.photoColor}
      />
      <PhotoFrame
        position={[1.5, 1.8, -0.5]}
        rotation={[0, -0.15, 0]}
        scale={0.7}
        frameColor={palette.frameColors[3]}
        photoColor={palette.photoColor}
      />

      <Album position={[-4.5, -1.5, -2]} scale={0.8} albumColor={palette.albumColor} albumDetailColor={palette.albumDetailColor} />
      <Album position={[4.2, 1.2, -3]} scale={0.7} albumColor={palette.albumColor} albumDetailColor={palette.albumDetailColor} />
      <Album position={[0, -2.5, -1.5]} scale={0.6} albumColor={palette.albumColor} albumDetailColor={palette.albumDetailColor} />
    </>
  );
}

function StaticBackground({ theme }: { theme: ThemeMode }) {
  if (theme === 'light') {
    return (
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(ellipse at 30% 50%, rgba(212,168,83,0.13) 0%, transparent 60%), radial-gradient(ellipse at 70% 30%, rgba(58,38,14,0.08) 0%, transparent 52%)',
        }}
      />
    );
  }

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background:
          'radial-gradient(ellipse at 30% 50%, rgba(212,168,83,0.12) 0%, transparent 60%), radial-gradient(ellipse at 70% 30%, rgba(200,168,130,0.08) 0%, transparent 50%)',
      }}
    />
  );
}

export default function HeroCanvas({ isMobile }: { isMobile?: boolean }) {
  const [theme, setTheme] = useState<ThemeMode>(() => {
    if (typeof document === 'undefined') return 'dark';
    return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
  });

  useEffect(() => {
    const observer = new MutationObserver(() => {
      const nextTheme = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
      setTheme(nextTheme);
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });

    return () => observer.disconnect();
  }, []);

  const palette = theme === 'light' ? LIGHT_PALETTE : DARK_PALETTE;

  if (isMobile) return <StaticBackground theme={theme} />;

  return (
    <div className="hero-canvas">
      <Canvas camera={{ position: [0, 0, 7], fov: 55 }} gl={{ antialias: true, alpha: true }} dpr={[1, 1.5]}>
        <Suspense fallback={null}>
          <Scene palette={palette} />
        </Suspense>
      </Canvas>
    </div>
  );
}
