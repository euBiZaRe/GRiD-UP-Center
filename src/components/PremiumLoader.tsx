import React, { useState, useEffect } from 'react';

interface PremiumLoaderProps {
  text?: string;
}

const PremiumLoader: React.FC<PremiumLoaderProps> = ({ text = 'SYNCING SESSION DATA' }) => {
  const [displayMsg, setDisplayMsg] = useState(text);
  const [dots, setDots] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      if (displayMsg === text) setDisplayMsg('WAITING FOR DATA SOURCE...');
    }, 5000);
    return () => clearTimeout(timer);
  }, [text, displayMsg]);

  // Animated ellipsis
  useEffect(() => {
    const interval = setInterval(() => {
      setDots(d => d.length >= 3 ? '' : d + '.');
    }, 500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col items-center justify-center gap-10 select-none">

      {/* Logo */}
      <div className="relative flex items-center justify-center">
        {/* Glow ring */}
        <div
          className="absolute w-56 h-56 rounded-full animate-pulse"
          style={{ background: 'radial-gradient(circle, color-mix(in srgb, var(--color-accent) 15%, transparent) 0%, transparent 70%)' }}
        />
        <img
          src="teams/Grid Up Sim Endurance.png"
          alt="GRiD UP"
          className="w-44 h-auto object-contain relative z-10 drop-shadow-2xl animate-pulse"
          style={{ animationDuration: '2.5s' }}
        />
      </div>

      {/* Text & bar */}
      <div className="flex flex-col items-center gap-4 w-64">
        {/* Progress bar */}
        <div className="w-full h-px bg-white/5 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full"
            style={{
              background: 'var(--color-accent)',
              boxShadow: '0 0 8px var(--color-accent)',
              animation: 'loader-slide 1.8s ease-in-out infinite',
            }}
          />
        </div>

        <p className="text-[9px] font-black uppercase tracking-[0.4em] text-white/30">
          {displayMsg}{dots}
        </p>
      </div>

      <style>{`
        @keyframes loader-slide {
          0%   { width: 0%;   margin-left: 0%; }
          50%  { width: 60%;  margin-left: 20%; }
          100% { width: 0%;   margin-left: 100%; }
        }
      `}</style>
    </div>
  );
};

export default PremiumLoader;

