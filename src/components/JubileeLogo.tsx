import React, { useState, useEffect } from 'react';
import { fetchSiteContent } from '../lib/firebase';
import { JUBILEE_LOGO_BASE64 } from '../assets/jubileeLogoData';

interface JubileeLogoProps {
  className?: string;
  alt?: string;
  style?: React.CSSProperties;
}

export const JubileeLogo: React.FC<JubileeLogoProps> = ({ 
  className = "max-h-10 h-auto w-auto",
  alt = "GRACIA 25 Jubilee Logo",
  style
}) => {
  const [logoSrc, setLogoSrc] = useState<string>(JUBILEE_LOGO_BASE64);

  useEffect(() => {
    let mounted = true;
    fetchSiteContent().then((content) => {
      if (!mounted) return;
      const customUrl = content?.jubileeLogoUrl?.trim();
      
      // Filter out invalid/dev/broken URLs or missing remote links
      if (
        customUrl && 
        customUrl !== 'https://logodix.com/logo/1753988.png' &&
        !customUrl.includes('ais-dev-') &&
        !customUrl.includes('localhost') &&
        !customUrl.startsWith('/assets/regenerated_image') &&
        !customUrl.startsWith('data:')
      ) {
        setLogoSrc(customUrl);
      } else {
        setLogoSrc(JUBILEE_LOGO_BASE64);
      }
    }).catch(() => {
      if (mounted) setLogoSrc(JUBILEE_LOGO_BASE64);
    });
    return () => { mounted = false; };
  }, []);

  return (
    <img 
      src={logoSrc || JUBILEE_LOGO_BASE64} 
      alt={alt} 
      className={`shrink-0 object-contain aspect-square ${className}`}
      style={{ objectFit: 'contain', aspectRatio: '1 / 1', ...style }}
      onError={() => {
        if (logoSrc !== JUBILEE_LOGO_BASE64) {
          setLogoSrc(JUBILEE_LOGO_BASE64);
        }
      }}
    />
  );
};




