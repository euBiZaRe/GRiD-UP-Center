import React, { useState, useEffect } from 'react';

interface PremiumLoaderProps {
  text?: string;
}

const PremiumLoader: React.FC<PremiumLoaderProps> = ({ text = 'SYNCING SESSION DATA' }) => {
  const [displayMsg, setDisplayMsg] = useState(text);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (displayMsg === text) {
        setDisplayMsg('WAITING FOR DATA SOURCE...');
      }
    }, 5000);
    return () => clearTimeout(timer);
  }, [text, displayMsg]);

  return (
    <div className="loading-overlay">
      <div className="logo-container">
        <img 
          src="teams/Grid Up Sim Endurance.png" 
          alt="Grid Up" 
          className="premium-logo"
        />
        <div className="logo-shimmer" />
      </div>
      
      <div className="loading-bar-container">
        <div className="loading-bar-fill" />
      </div>
      
      <div className="loading-text">
        {displayMsg}
      </div>
    </div>
  );
};

export default PremiumLoader;
