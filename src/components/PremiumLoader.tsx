import React from 'react';

interface PremiumLoaderProps {
  text?: string;
}

const PremiumLoader: React.FC<PremiumLoaderProps> = ({ text = 'SYNCING SESSION DATA' }) => {
  return (
    <div className="loading-overlay">
      <div className="logo-container">
        <img 
          src="/teams/Grid Up Sim Endurance.png" 
          alt="Grid Up" 
          className="premium-logo"
        />
        <div className="logo-shimmer" />
      </div>
      
      <div className="loading-bar-container">
        <div className="loading-bar-fill" />
      </div>
      
      <div className="loading-text">
        {text}
      </div>
    </div>
  );
};

export default PremiumLoader;
