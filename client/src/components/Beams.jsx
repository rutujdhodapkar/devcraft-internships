import { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

function Beam({ index, beamWidth, beamHeight, speed, noiseIntensity, scale, rotation, lightColor }) {
  const meshRef = useRef();
  const baseX = useMemo(() => (index % 10 - 5) * 1.5 + Math.random() * 0.5, [index]);
  const baseY = useMemo(() => Math.random() * 4 - 1, []);
  const angle = useMemo(() => (rotation || 0) * (Math.PI / 180) + Math.random() * 0.2, [rotation]);

  useFrame((state) => {
    if (!meshRef.current) return;
    const t = state.clock.elapsedTime * (speed || 2);
    meshRef.current.position.x = baseX + Math.sin(t * 0.3 + index) * (noiseIntensity || 1.5) * 0.3;
    meshRef.current.position.y = baseY + Math.sin(t * 0.5 + index * 1.3) * 0.15;
    meshRef.current.material.opacity = 0.15 + Math.sin(t * 0.7 + index * 2) * 0.1;
  });

  const color = useMemo(() => new THREE.Color(lightColor || '#ffffff'), [lightColor]);

  return (
    <mesh
      ref={meshRef}
      position={[baseX, baseY, -1]}
      rotation={[0, 0, angle]}
    >
      <planeGeometry args={[beamWidth || 2, beamHeight || 25]} />
      <meshBasicMaterial
        color={color}
        transparent
        opacity={0.2}
        side={THREE.DoubleSide}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}

export default function Beams({
  beamWidth = 3,
  beamHeight = 30,
  beamNumber = 20,
  lightColor = '#ffffff',
  speed = 2,
  noiseIntensity = 1.75,
  scale = 0.2,
  rotation = 30,
}) {
  return (
    <Canvas
      camera={{ position: [0, 0, 8], fov: 50 }}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
      }}
      gl={{ alpha: true, antialias: true }}
    >
      {Array.from({ length: beamNumber }).map((_, i) => (
        <Beam
          key={i}
          index={i}
          beamWidth={beamWidth}
          beamHeight={beamHeight}
          speed={speed}
          noiseIntensity={noiseIntensity}
          scale={scale}
          rotation={rotation}
          lightColor={lightColor}
        />
      ))}
    </Canvas>
  );
}
