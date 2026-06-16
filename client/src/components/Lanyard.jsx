import React, { Suspense, useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';

function generateCardTexture({ name, internId, college, city, appliedDate, photoURL }) {
  const canvas = document.createElement('canvas');
  canvas.width = 600;
  canvas.height = 900;
  const ctx = canvas.getContext('2d');

  // White background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Black border
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 6;
  ctx.strokeRect(6, 6, canvas.width - 12, canvas.height - 12);

  // Top dark bar
  ctx.fillStyle = '#000';
  ctx.fillRect(6, 6, canvas.width - 12, 140);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 36px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('DEV/CRAFT', canvas.width / 2, 85);
  ctx.font = '14px Inter, sans-serif';
  ctx.fillText('INTERN ID CARD', canvas.width / 2, 115);

  // Photo placeholder
  const photoX = 200, photoY = 180, photoSize = 200;
  ctx.fillStyle = '#f0f0f0';
  ctx.fillRect(photoX, photoY, photoSize, photoSize);
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 3;
  ctx.strokeRect(photoX, photoY, photoSize, photoSize);

  if (photoURL) {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = photoURL;
    try {
      ctx.drawImage(img, photoX, photoY, photoSize, photoSize);
    } catch {}
  } else {
    ctx.fillStyle = '#ccc';
    ctx.font = '60px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('📷', canvas.width / 2, photoY + photoSize / 2 + 20);
  }

  // Info fields
  const fields = [
    { label: 'NAME', value: (name || 'Student').toUpperCase() },
    { label: 'INTERN ID', value: internId || '—' },
    { label: 'COLLEGE', value: college || '—' },
    { label: 'CITY', value: city || '—' },
    { label: 'APPLIED', value: appliedDate || '—' },
  ];

  let y = 430;
  fields.forEach((f) => {
    ctx.fillStyle = '#888';
    ctx.font = 'bold 13px Inter, monospace';
    ctx.textAlign = 'left';
    ctx.fillText(f.label, 40, y);
    ctx.fillStyle = '#000';
    ctx.font = 'bold 22px Inter, sans-serif';
    ctx.fillText(f.value, 40, y + 30);
    y += 80;
  });

  // Bottom bar
  ctx.fillStyle = '#000';
  ctx.fillRect(6, canvas.height - 50, canvas.width - 12, 44);
  ctx.fillStyle = '#fff';
  ctx.font = '12px Inter, monospace';
  ctx.textAlign = 'center';
  ctx.fillText('devcraft.internship  •  VERIFIED', canvas.width / 2, canvas.height - 22);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

function Card3D({ frontTexture }) {
  const meshRef = useRef();

  useFrame((state) => {
    if (!meshRef.current) return;
    meshRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.4) * 0.15;
    meshRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.25) * 0.06;
    meshRef.current.position.y = Math.sin(state.clock.elapsedTime * 0.5) * 0.08;
  });

  const material = useMemo(() => new THREE.MeshStandardMaterial({
    map: frontTexture,
    side: THREE.DoubleSide,
    roughness: 0.3,
    metalness: 0.05,
  }), [frontTexture]);

  return (
    <mesh ref={meshRef} position={[0, 0.5, 0]}>
      <boxGeometry args={[3.2, 4.8, 0.12]} />
      <primitive object={material} />
    </mesh>
  );
}

function LanyardBand() {
  return (
    <group>
      {/* Left side of band */}
      <mesh position={[-0.55, 3.5, 0]} rotation={[0, 0, 0.15]}>
        <boxGeometry args={[0.04, 2, 0.02]} />
        <meshStandardMaterial color="#222" />
      </mesh>
      {/* Right side of band */}
      <mesh position={[0.55, 3.5, 0]} rotation={[0, 0, -0.15]}>
        <boxGeometry args={[0.04, 2, 0.02]} />
        <meshStandardMaterial color="#222" />
      </mesh>
      {/* Clip ring */}
      <mesh position={[0, 2.8, 0]}>
        <torusGeometry args={[0.12, 0.03, 8, 16]} />
        <meshStandardMaterial color="#555" metalness={0.8} roughness={0.2} />
      </mesh>
    </group>
  );
}

export default function Lanyard({
  name,
  internId,
  college,
  city,
  appliedDate,
  photoURL,
  position = [0, 0, 22],
  gravity = [0, -40, 0],
}) {
  const texture = useMemo(() => generateCardTexture({
    name, internId, college, city, appliedDate, photoURL,
  }), [name, internId, college, city, appliedDate, photoURL]);

  return (
    <div style={{ width: '100%', height: '100%', minHeight: '400px' }}>
      <Canvas
        camera={{ position: [0, 0, 10], fov: 28 }}
        style={{ background: 'transparent' }}
        gl={{ antialias: true, alpha: true }}
      >
        <ambientLight intensity={0.6} />
        <directionalLight position={[5, 8, 6]} intensity={0.8} />
        <directionalLight position={[-3, 2, 4]} intensity={0.3} />
        <Suspense fallback={null}>
          <Card3D frontTexture={texture} />
          <LanyardBand />
        </Suspense>
      </Canvas>
    </div>
  );
}
