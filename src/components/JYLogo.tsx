import React, { useState } from 'react';
import { JUBILEE_LOGO_BASE64 } from '../assets/jubileeLogoData';

interface JYLogoProps {
  className?: string;
  style?: React.CSSProperties;
}

export const JYLogo: React.FC<JYLogoProps> = ({ className = "h-10 w-auto", style }) => {
  const [logoSrc, setLogoSrc] = useState<string>('/jysg_logo.png');

  return (
    <div className={`relative inline-flex items-center justify-center shrink-0 rounded-full bg-white p-0.5 shadow-sm ${className}`}>
      <img 
        src={logoSrc} 
        alt="Jesus Youth Logo" 
        className="max-h-full max-w-full h-auto w-auto object-contain rounded-full"
        style={{ objectFit: 'contain', height: 'auto', ...style }}
        onError={() => {
          if (logoSrc === '/jysg_logo.png') {
            setLogoSrc('/jy-logo.png');
          } else if (logoSrc === '/jy-logo.png') {
            setLogoSrc(JUBILEE_LOGO_BASE64);
          }
        }}
      />
    </div>
  );
};









