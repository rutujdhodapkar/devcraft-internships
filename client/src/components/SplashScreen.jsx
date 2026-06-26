import { useEffect, useRef, useState } from 'react';
import MetallicPaint from './MetallicPaint';
import './SplashScreen.css';

export default function SplashScreen({ loading }) {
  const [dataUrl, setDataUrl] = useState(null);
  const [visible, setVisible] = useState(true);
  const [fadeOut, setFadeOut] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    const generate = async () => {
      await document.fonts.load('bold 160px Humane');
      const canvas = document.createElement('canvas');
      const w = 900, h = 350;
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#000';
      ctx.font = 'bold 160px Humane';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('DEV/CRAFT', w / 2, h / 2);
      setDataUrl(canvas.toDataURL());
    };
    generate();
  }, []);

  useEffect(() => {
    if (!loading && dataUrl) {
      timerRef.current = setTimeout(() => {
        setFadeOut(true);
        setTimeout(() => setVisible(false), 600);
      }, 2000);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [loading, dataUrl]);

  if (!visible) return null;

  return (
    <div className={`splash-overlay ${fadeOut ? 'splash-fade-out' : ''}`}>
      <div className="splash-inner">
        {dataUrl ? (
          <MetallicPaint
            imageSrc={dataUrl}
            seed={42}
            scale={4}
            refraction={0.015}
            blur={0.01}
            liquid={0.75}
            speed={0.3}
            brightness={2}
            contrast={0.5}
            lightColor="#ffffff"
            darkColor="#111111"
            tintColor="#feb3ff"
            chromaticSpread={2}
            waveAmplitude={1}
            noiseScale={0.5}
            distortion={1}
            contour={0.2}
          />
        ) : (
          <div className="splash-placeholder">DEV/CRAFT</div>
        )}
      </div>
    </div>
  );
}
