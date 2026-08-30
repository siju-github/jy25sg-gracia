import React from 'react';
import { motion } from 'motion/react';
import { 
  Mic, 
  Music, 
  Church, 
  Film, 
  UtensilsCrossed, 
  Palette
} from 'lucide-react';

export interface HighlightCardItem {
  id: string;
  title: string;
  subtitle: string;
  icon: React.ElementType;
  badge?: string;
  cardBorder: string;
  cardBg: string;
  iconBg: string;
  iconColor: string;
  dividerColor: string;
}

export const SIX_HIGHLIGHT_CARDS: HighlightCardItem[] = [
  {
    id: 'talks',
    title: 'INSPIRING TALKS',
    subtitle: 'Life-changing talks and panel discussions by prominent Catholic speakers.',
    icon: Mic,
    cardBorder: 'border-[#7e22ce]/60 hover:border-[#9333ea]',
    cardBg: 'from-[#1a0b2e] via-[#130722] to-[#0d0417]',
    iconBg: 'bg-[#7e22ce]/20 border-[#7e22ce]/50',
    iconColor: 'text-[#c084fc]',
    dividerColor: 'bg-[#7e22ce]/60'
  },
  {
    id: 'worship',
    title: 'WORSHIP & PRAYER',
    subtitle: 'Live praise & worship, Eucharistic Adoration, and Confession & Prayer Rooms.',
    icon: Music,
    cardBorder: 'border-[#2563eb]/60 hover:border-[#3b82f6]',
    cardBg: 'from-[#0b1938] via-[#071128] to-[#040a1b]',
    iconBg: 'bg-[#2563eb]/20 border-[#2563eb]/50',
    iconColor: 'text-[#60a5fa]',
    dividerColor: 'bg-[#2563eb]/60'
  },
  {
    id: 'mass',
    title: 'THANKSGIVING HOLY MASS',
    subtitle: 'Celebrated by His Eminence Cardinal William Goh.',
    icon: Church,
    badge: '✝ PARTIAL INDULGENCE GRANTED',
    cardBorder: 'border-[#eab308]/90 hover:border-[#facc15]',
    cardBg: 'from-[#281f08] via-[#1c1504] to-[#120e02]',
    iconBg: 'bg-[#eab308]/20 border-[#eab308]/60',
    iconColor: 'text-[#fde047]',
    dividerColor: 'bg-[#eab308]/80'
  },
  {
    id: 'concert',
    title: 'GRACIA MUSICAL CONCERT',
    subtitle: 'Original theatrical production & stage showcase',
    icon: Film,
    badge: 'STAGE CONCERT',
    cardBorder: 'border-[#ec4899]/60 hover:border-[#f472b6]',
    cardBg: 'from-[#2e0e26] via-[#20091a] to-[#150511]',
    iconBg: 'bg-[#ec4899]/20 border-[#ec4899]/50',
    iconColor: 'text-[#f472b6]',
    dividerColor: 'bg-[#ec4899]/60'
  },
  {
    id: 'fellowship',
    title: 'FELLOWSHIP & FUN',
    subtitle: 'Delicious meals and warm community bonding.',
    icon: UtensilsCrossed,
    cardBorder: 'border-[#14b8a6]/60 hover:border-[#2dd4bf]',
    cardBg: 'from-[#082725] via-[#051a19] to-[#031110]',
    iconBg: 'bg-[#14b8a6]/20 border-[#14b8a6]/50',
    iconColor: 'text-[#2dd4bf]',
    dividerColor: 'bg-[#14b8a6]/60'
  },
  {
    id: 'arts',
    title: 'CREATIVE ARTS & HERITAGE',
    subtitle: 'Expressive performances and Jubilee memory gallery & exhibitions.',
    icon: Palette,
    cardBorder: 'border-[#a855f7]/60 hover:border-[#c084fc]',
    cardBg: 'from-[#1f0f35] via-[#150a26] to-[#0d051a]',
    iconBg: 'bg-[#a855f7]/20 border-[#a855f7]/50',
    iconColor: 'text-[#c084fc]',
    dividerColor: 'bg-[#a855f7]/60'
  }
];

export const ConferenceHighlightsGrid: React.FC = () => {
  return (
    <div className="w-full max-w-6xl mx-auto pt-2">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
        {SIX_HIGHLIGHT_CARDS.map((box) => {
          const IconComp = box.icon;
          return (
            <motion.div
              key={box.id}
              whileHover={{ y: -4, scale: 1.015 }}
              transition={{ duration: 0.2 }}
              className={`flex flex-col items-center text-center p-5 sm:p-6 rounded-2xl sm:rounded-3xl bg-gradient-to-b ${box.cardBg} border-2 ${box.cardBorder} shadow-xl relative transition-all duration-300 justify-between h-full min-h-[220px]`}
            >
              {/* Badge if present */}
              {box.badge ? (
                <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-[#eab308]/15 border border-[#eab308]/50 text-[#fde047] text-[10px] sm:text-[11px] font-extrabold uppercase tracking-wider mb-2 shrink-0">
                  <span>{box.badge}</span>
                </div>
              ) : (
                <div className="h-2" />
              )}

              {/* Center Icon Box */}
              <div className={`w-14 h-14 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl ${box.iconBg} border flex items-center justify-center my-2 shadow-md shrink-0`}>
                <IconComp className={`w-7 h-7 sm:w-8 sm:h-8 ${box.iconColor}`} />
              </div>

              {/* Title & Subtitle */}
              <div className="space-y-1.5 w-full flex flex-col items-center mt-1">
                <h4 className="font-poster text-base sm:text-lg text-white tracking-wider uppercase leading-snug">
                  {box.title}
                </h4>

                <div className={`w-10 h-0.5 ${box.dividerColor} my-1 rounded-full opacity-80`} />

                <p className="text-xs sm:text-sm text-white/80 leading-relaxed font-sans max-w-xs mx-auto">
                  {box.subtitle}
                </p>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};
