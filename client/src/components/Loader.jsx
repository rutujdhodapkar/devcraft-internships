import { useEffect, useRef } from 'react';
import MetallicPaint from './MetallicPaint';

export default function Loader({ onFinish }) {
  const containerRef = useRef(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (onFinish) onFinish();
    }, 2000);
    return () => clearTimeout(timer);
  }, [onFinish]);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 99999,
        background: '#0a0a0a',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div style={{ width: 'min(85vw, 1200px)', height: 'min(50vh, 500px)' }}>
        <MetallicPaint
          imageSrc="/devcraft-logo.svg"
          seed={42}
          scale={2.5}
          patternSharpness={0.8}
          noiseScale={0.6}
          speed={0.4}
          liquid={0.5}
          mouseAnimation={false}
          brightness={3}
          contrast={1.2}
          refraction={0.025}
          blur={0.02}
          chromaticSpread={2.5}
          fresnel={2}
          angle={15}
          waveAmplitude={0.8}
          distortion={0.5}
          contour={0.3}
          lightColor="#ffffff"
          darkColor="#111111"
          tintColor="#ffffff"
        />
      </div>
    </div>
  );
}
