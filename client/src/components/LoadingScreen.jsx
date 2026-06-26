import { useMemo } from 'react';
import MetallicPaint from './MetallicPaint';

function generateSvgDataUrl() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 200" width="600" height="200">
    <rect width="600" height="200" fill="#ffffff"/>
    <text x="300" y="135" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="96" font-weight="900" fill="#000000">Dev/Craft</text>
  </svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export default function LoadingScreen({ visible }) {
  const svgSrc = useMemo(() => generateSvgDataUrl(), []);

  if (!visible) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      zIndex: 9999,
      background: '#000',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <div style={{ width: '80%', maxWidth: '700px', height: '40vh', maxHeight: '300px' }}>
        <MetallicPaint
          imageSrc={svgSrc}
          seed={42}
          scale={4}
          patternSharpness={1}
          noiseScale={0.5}
          speed={0.3}
          liquid={0.75}
          mouseAnimation={false}
          brightness={2}
          contrast={0.5}
          refraction={0.01}
          blur={0.015}
          chromaticSpread={2}
          fresnel={1}
          angle={0}
          waveAmplitude={1}
          distortion={1}
          contour={0.2}
          lightColor="#ffffff"
          darkColor="#000000"
          tintColor="#feb3ff"
        />
      </div>
    </div>
  );
}
