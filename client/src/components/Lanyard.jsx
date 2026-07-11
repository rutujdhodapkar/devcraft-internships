import React, { Suspense, useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
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
    ctx.fillText('NO PHOTO', canvas.width / 2, photoY + photoSize / 2 + 20);
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

function Card3D({ frontTexture, backTexture, offset = [0, 0], gravity = [0, -40, 0] }) {
  const meshRef = useRef();
  const gravityPull = Math.max(10, Math.abs(gravity?.[1] || -40));

  useFrame((state) => {
    if (!meshRef.current) return;
    const swing = Math.min(0.25, 14 / gravityPull);
    meshRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.6) * swing;
    meshRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.3) * swing * 0.45;
    meshRef.current.position.y = offset[1] + 0.5 + Math.sin(state.clock.elapsedTime * 0.4) * 0.08;
  });

  const frontMaterial = useMemo(() => new THREE.MeshStandardMaterial({
    map: frontTexture,
    side: THREE.FrontSide,
    roughness: 0.3,
    metalness: 0.05,
  }), [frontTexture]);

  const backMaterial = useMemo(() => new THREE.MeshStandardMaterial({
    map: backTexture || frontTexture,
    side: THREE.BackSide,
    roughness: 0.3,
    metalness: 0.05,
  }), [backTexture, frontTexture]);

  const edgeMaterial = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#f2f2f2',
    roughness: 0.35,
    metalness: 0.02,
  }), []);

  return (
    <mesh ref={meshRef} position={[offset[0], offset[1] + 0.5, 0]}>
      <boxGeometry args={[3.2, 4.8, 0.12]} />
      <primitive object={edgeMaterial} attach="material-0" />
      <primitive object={edgeMaterial} attach="material-1" />
      <primitive object={edgeMaterial} attach="material-2" />
      <primitive object={edgeMaterial} attach="material-3" />
      <primitive object={frontMaterial} attach="material-4" />
      <primitive object={backMaterial} attach="material-5" />
    </mesh>
  );
}

function LanyardBand({ width = 0.04, imageTexture = null, offset = [0, 0] }) {
  const bandMaterial = useMemo(() => {
    if (imageTexture) {
      imageTexture.wrapS = THREE.RepeatWrapping;
      imageTexture.wrapT = THREE.RepeatWrapping;
      imageTexture.repeat.set(1, 4);
      imageTexture.needsUpdate = true;
      return new THREE.MeshStandardMaterial({ map: imageTexture });
    }
    return new THREE.MeshStandardMaterial({ color: '#222' });
  }, [imageTexture]);

  return (
    <group position={[offset[0], offset[1], 0]}>
      {/* Left side of band */}
      <mesh position={[-0.55, 3.5, 0]} rotation={[0, 0, 0.15]}>
        <boxGeometry args={[width, 2, 0.02]} />
        <primitive object={bandMaterial} />
      </mesh>
      {/* Right side of band */}
      <mesh position={[0.55, 3.5, 0]} rotation={[0, 0, -0.15]}>
        <boxGeometry args={[width, 2, 0.02]} />
        <primitive object={bandMaterial} />
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
  position = [0, 0, 20],
  gravity = [0, -40, 0],
  frontImage,
  backImage,
  imageFit = 'cover',
  lanyardImage,
  lanyardWidth = 1,
}) {
  const generatedTexture = useMemo(() => generateCardTexture({
    name, internId, college, city, appliedDate, photoURL,
  }), [name, internId, college, city, appliedDate, photoURL]);

  const textureLoader = useMemo(() => new THREE.TextureLoader(), []);
  const frontImageTexture = useMemo(() => {
    if (!frontImage) return null;
    const t = textureLoader.load(frontImage);
    t.colorSpace = THREE.SRGBColorSpace;
    t.needsUpdate = true;
    return t;
  }, [frontImage, textureLoader]);
  const backImageTexture = useMemo(() => {
    if (!backImage) return null;
    const t = textureLoader.load(backImage);
    t.colorSpace = THREE.SRGBColorSpace;
    t.needsUpdate = true;
    return t;
  }, [backImage, textureLoader]);
  const lanyardTexture = useMemo(() => {
    if (!lanyardImage) return null;
    const t = textureLoader.load(lanyardImage);
    t.colorSpace = THREE.SRGBColorSpace;
    t.needsUpdate = true;
    return t;
  }, [lanyardImage, textureLoader]);

  const hasFrontImage = Boolean(frontImage);
  const hasBackImage = Boolean(backImage);
  const hasLanyardImage = Boolean(lanyardImage);

  const frontTexture = hasFrontImage ? frontImageTexture : generatedTexture;
  const backTexture = hasBackImage ? backImageTexture : generatedTexture;
  const bandWidth = 0.04 * Math.max(1, Number(lanyardWidth) || 1);

  if (imageFit === 'contain') {
    frontTexture.wrapS = THREE.ClampToEdgeWrapping;
    frontTexture.wrapT = THREE.ClampToEdgeWrapping;
    backTexture.wrapS = THREE.ClampToEdgeWrapping;
    backTexture.wrapT = THREE.ClampToEdgeWrapping;
  }

  const cameraZ = Math.max(8, Number(position?.[2]) || 20);
  const cardOffset = [Number(position?.[0]) || 0, Number(position?.[1]) || 0];

  return (
    <div style={{ width: '100%', height: '100%', minHeight: '400px' }}>
      <Canvas
        camera={{ position: [0, 0, cameraZ], fov: 28 }}
        style={{ background: 'transparent' }}
        gl={{ antialias: true, alpha: true }}
      >
        <ambientLight intensity={0.6} />
        <directionalLight position={[5, 8, 6]} intensity={0.8} />
        <directionalLight position={[-3, 2, 4]} intensity={0.3} />
        <Suspense fallback={null}>
          <Card3D frontTexture={frontTexture} backTexture={backTexture} offset={cardOffset} gravity={gravity} />
          <LanyardBand width={bandWidth} imageTexture={hasLanyardImage ? lanyardTexture : null} offset={cardOffset} />
        </Suspense>
      </Canvas>
    </div>
  );
}
