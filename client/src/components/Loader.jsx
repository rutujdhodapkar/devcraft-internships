import { useEffect } from 'react';
import Beams from './Beams';

export default function Loader({ onFinish }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      if (onFinish) onFinish();
    }, 2000);
    return () => clearTimeout(timer);
  }, [onFinish]);

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 99999,
        background: '#000',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div style={{ position: 'absolute', inset: 0 }}>
        <Beams
          beamWidth={2}
          beamHeight={15}
          beamNumber={12}
          lightColor="#ffffff"
          speed={2}
          noiseIntensity={1.75}
          scale={0.2}
          rotation={0}
        />
      </div>
      <span
        style={{
          position: 'relative',
          zIndex: 1,
          color: '#fff',
          fontWeight: 900,
          fontSize: '1.4rem',
          textTransform: 'uppercase',
          letterSpacing: '6px',
          fontFamily: "'Inter',Arial,sans-serif",
        }}
      >
        Loading
      </span>
    </div>
  );
}
