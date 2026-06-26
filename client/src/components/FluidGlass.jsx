import * as THREE from 'three';
import { useRef, useMemo } from 'react';
import { Canvas, useFrame, createPortal, useThree } from '@react-three/fiber';
import { useFBO, MeshTransmissionMaterial } from '@react-three/drei';
import { easing } from 'maath';

function getGeometry(mode) {
  let geo;
  if (mode === 'lens') geo = new THREE.CylinderGeometry(1, 1, 0.15, 64);
  else if (mode === 'cube') geo = new THREE.BoxGeometry(1, 1, 1);
  else if (mode === 'bar') geo = new THREE.BoxGeometry(2, 0.3, 0.3);
  else geo = new THREE.CylinderGeometry(1, 1, 0.15, 64);
  geo.computeBoundingBox();
  return geo;
}

function GlassObject({ mode, modeProps = {} }) {
  const ref = useRef();
  const { nodes } = { nodes: {} };
  const buffer = useFBO();
  const { viewport: vp } = useThree();
  const [scene] = useMemo(() => [new THREE.Scene()], []);
  const geo = useMemo(() => getGeometry(mode), [mode]);
  const geoWidth = useMemo(() => {
    const box = geo.boundingBox;
    return box.max.x - box.min.x || 1;
  }, [geo]);

  useFrame((state, delta) => {
    const { gl, viewport, pointer, camera } = state;
    const v = viewport.getCurrentViewport(camera, [0, 0, 15]);

    const destX = (pointer.x * v.width) / 2;
    const destY = (pointer.y * v.height) / 2;
    easing.damp3(ref.current.position, [destX, destY, 15], 0.15, delta);

    if (modeProps.scale == null) {
      const maxWorld = v.width * 0.9;
      const desired = maxWorld / geoWidth;
      ref.current.scale.setScalar(Math.min(0.15, desired));
    }

    gl.setRenderTarget(buffer);
    gl.render(scene, camera);
    gl.setRenderTarget(null);
  });

  const { scale, ior, thickness, anisotropy, chromaticAberration, ...extraMat } = modeProps;

  return (
    <>
      {createPortal(null, scene)}
      <mesh ref={ref} scale={scale ?? 0.15} rotation-x={Math.PI / 2} geometry={geo}>
        <MeshTransmissionMaterial
          buffer={buffer.texture}
          ior={ior ?? 1.15}
          thickness={thickness ?? 5}
          anisotropy={anisotropy ?? 0.01}
          chromaticAberration={chromaticAberration ?? 0.1}
          background={new THREE.Color('#ffffff')}
          {...extraMat}
        />
      </mesh>
    </>
  );
}

export default function FluidGlass({ mode = 'lens', lensProps = {}, barProps = {}, cubeProps = {} }) {
  const rawOverrides = mode === 'bar' ? barProps : mode === 'cube' ? cubeProps : lensProps;
  const { ...modeProps } = rawOverrides;

  return (
    <Canvas camera={{ position: [0, 0, 20], fov: 15 }} gl={{ alpha: true }}>
      <GlassObject mode={mode} modeProps={modeProps} />
    </Canvas>
  );
}
