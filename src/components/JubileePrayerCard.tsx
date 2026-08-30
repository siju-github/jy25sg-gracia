import React from 'react';
import { JUBILEE_CROSS_BASE64 } from '../assets/jubileeCrossData';

interface JubileePrayerCardProps {
  className?: string;
  title?: string;
  prayerText?: React.ReactNode;
  offerText?: React.ReactNode;
  showCrosses?: boolean;
}

export const JubileePrayerCard: React.FC<JubileePrayerCardProps> = ({
  className = "w-full max-w-5xl mx-auto bg-gradient-to-br from-[#26102b]/95 via-[#2f0e3d]/95 to-[#1a0820]/95 border-2 border-[#D4AF37]/40 rounded-3xl p-5 sm:p-7 shadow-2xl relative overflow-hidden backdrop-blur-md font-sans mt-2 mb-2 text-white",
  title = "JUBILEE PRAYER",
  prayerText,
  offerText = null,
  showCrosses = true
}) => {
  const defaultPrayer = (
    <div className="text-xs sm:text-sm md:text-base text-amber-50/90 leading-relaxed font-sans space-y-3">
      <p className="leading-relaxed">
        <strong className="text-amber-300 font-semibold">Heavenly Father,</strong> we thank You for 25 years of Grace, planting and nurturing our mission in Singapore through many humble hearts filled with love for You. May the seeds sown in faith bear fruit and lead us into a future full of hope and mission.
      </p>
      <p className="leading-relaxed">
        In this Jubilee year, renew our hearts, deepen our faith, increase our zeal for the Gospel and empower us to become <span className="text-amber-200 font-medium">&ldquo;faithful witnesses and joyful missionaries&rdquo;</span> in the world today. <span className="font-semibold text-amber-300">Amen.</span>
      </p>
      <div className="pt-2 text-xs sm:text-sm italic text-amber-200/90 font-medium space-y-1 border-t border-[#D4AF37]/20">
        <p>O Mary, Star of the New Evangelisation, walk with us, intercede for us, and lead us ever closer to Jesus.</p>
        <p>St. Francis of Assisi, Patron Saint of Jesus Youth, intercede for us.</p>
      </div>
    </div>
  );

  return (
    <div className={className}>
      {/* Ambient background glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-16 bg-[#D4AF37]/15 rounded-full blur-2xl pointer-events-none" />
      <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 w-1/2 h-16 bg-[#C81E6E]/15 rounded-full blur-2xl pointer-events-none" />

      <div className="relative z-10 flex flex-col sm:flex-row items-center justify-between gap-6 sm:gap-8">
        {/* Left Jubilee Cross */}
        {showCrosses && (
          <div className="shrink-0 flex items-center justify-center">
            <img 
              src={JUBILEE_CROSS_BASE64} 
              alt="Jubilee Cross" 
              className="h-32 sm:h-48 md:h-56 w-auto object-contain drop-shadow-[0_8px_24px_rgba(212,175,55,0.4)] hover:scale-105 transition-transform duration-300 filter" 
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src = '/jubilee-cross.svg';
              }}
            />
          </div>
        )}

        {/* Center Prayer Content */}
        <div className="flex-1 text-center space-y-3">
          <div className="inline-flex items-center justify-center px-4 py-1 rounded-full bg-[#D4AF37]/15 border border-[#D4AF37]/40 shadow-sm">
            <h3 className="font-bold tracking-widest uppercase text-xs sm:text-sm text-[#FEE685] font-sans">
              {title}
            </h3>
          </div>

          <div className="px-1 sm:px-2">
            {prayerText || defaultPrayer}
          </div>

          {offerText && (
            <div className="pt-3 border-t border-[#D4AF37]/25 text-xs tracking-wider text-[#FEE685] font-semibold uppercase font-sans">
              {offerText}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};




