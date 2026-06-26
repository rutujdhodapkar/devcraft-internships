/* eslint-disable react/no-unknown-property */
import { useRef, useEffect, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { MeshTransmissionMaterial } from '@react-three/drei';
import { easing } from 'maath';
import * as THREE from 'three';

function GlassLens({ mouse, hovered }) {
  const mesh = useRef();
  const matRef = useRef();

  useFrame((state, delta) => {
    if (!mesh.current) return;
    const v = state.viewport.getCurrentViewport(state.camera, [0, 0, 10]);
    const destX = (mouse.current.x * v.width) / 2;
    const destY = (mouse.current.y * v.height) / 2;
    easing.damp3(mesh.current.position, [destX, destY, 0], 0.12, delta);
  });

  return (
    <mesh ref={mesh} scale={0.08}>
      <cylinderGeometry args={[0.5, 0.5, 0.3, 48, 48]} rotation={[Math.PI / 2, 0, 0]}>
      </cylinderGeometry>
      <MeshTransmissionMaterial
        ref={matRef}
        transmission={1}
        roughness={0}
        thickness={5}
        ior={1.15}
        chromaticAberration={0.08}
        anisotropy={0.02}
        color="#ffffff"
        attenuationColor="#aaccff"
        attenuationDistance={0.5}
      />
    </mesh>
  );
}

function Scene({ mouse, hovered }) {
  return (
    <>
      <ambientLight intensity={2} />
      <pointLight position={[5, 5, 5]} intensity={1} />
      <pointLight position={[-5, -5, 5]} intensity={0.5} />
      <GlassLens mouse={mouse} hovered={hovered} />
    </>
  );
}

export default function CursorGlass() {
  const [visible, setVisible] = useState(false);
  const mouse = useRef({ x: 0, y: 0 });
  const hovered = useRef(false);

  useEffect(() => {
    const check = () => setVisible(window.innerWidth > 1024);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => {
    const onMove = (e) => {
      mouse.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.current.y = -(e.clientY / window.innerHeight) * 2 + 1;
    };
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, []);

  if (!visible) return null;

  return (
    <>
      <style>{`
        @media (min-width: 1025px) {
          body * { cursor: none !important; }
        }
      `}</style>
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          pointerEvents: 'none',
          zIndex: 99998,
        }}
      >
        <Canvas camera={{ position: [0, 0, 10], fov: 30, near: 0.1, far: 100 }} dpr={[1, 1.5]}>
          <Scene mouse={mouse} hovered={hovered} />
        </Canvas>
      </div>
    </>
  );
}
