import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, MapPin, Navigation, Bus, Train, Car, ExternalLink, Sparkles } from 'lucide-react';

interface LocationMapModalProps {
  isOpen: boolean;
  onClose: () => void;
  venueName?: string;
  address?: string;
  hallName?: string;
}

export const LocationMapModal: React.FC<LocationMapModalProps> = ({
  isOpen,
  onClose,
  venueName = 'Caritas Agape Village',
  address = '7A Lorong 8 Toa Payoh, Singapore 319264',
  hallName = 'Main Auditorium / Event Space',
}) => {
  if (!isOpen) return null;

  const handleGetDirections = () => {
    const destinationQuery = encodeURIComponent(`${venueName}, ${address}`);
    const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${destinationQuery}`;
    window.open(mapsUrl, '_blank', 'noopener,noreferrer');
  };

  const googleEmbedUrl = `https://maps.google.com/maps?q=${encodeURIComponent(
    'Agape Village 7A Lorong 8 Toa Payoh Singapore 319264'
  )}&t=&z=16&ie=UTF8&iwloc=&output=embed`;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="relative w-full max-w-2xl bg-gradient-to-br from-[#2c1140] via-[#1a0b22] to-[#120519] border-2 border-[#E8B400]/40 rounded-3xl p-5 sm:p-7 text-white shadow-2xl space-y-5 my-6"
        >
          {/* Close Button */}
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-all cursor-pointer z-10 group"
            aria-label="Close modal"
          >
            <X className="w-5 h-5 transition-transform group-hover:scale-110" />
          </button>

          {/* Modal Header */}
          <div className="text-center space-y-2 pr-8">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-[#E8752C]/20 border border-[#E8752C]/40 text-[#E8752C] text-xs font-bold uppercase tracking-widest">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Event Venue Location</span>
            </div>
            <h3 className="font-poster text-2xl sm:text-3xl text-white tracking-wide">
              {venueName}
            </h3>
            <p className="text-xs sm:text-sm text-white/80 flex items-center justify-center space-x-1.5 font-sans">
              <MapPin className="w-4 h-4 text-[#C81E6E] shrink-0" />
              <span>{address}</span>
            </p>
            {hallName && (
              <p className="text-xs font-semibold text-amber-300/90 font-mono">
                {hallName}
              </p>
            )}
          </div>

          {/* Interactive Location Card */}
          <div className="relative w-full h-60 sm:h-72 rounded-2xl overflow-hidden border-2 border-white/15 shadow-inner bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex flex-col items-center justify-center p-6 text-center group">
            <div className="w-14 h-14 rounded-full bg-amber-500/20 border border-amber-400/40 flex items-center justify-center mb-3 text-amber-400 shadow-lg">
              <MapPin className="w-7 h-7" />
            </div>
            <h4 className="text-lg font-bold text-white mb-1">{venueName}</h4>
            <p className="text-xs text-slate-300 max-w-sm mb-4">{address}</p>
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(venueName + ' ' + address)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs uppercase tracking-wider transition-all shadow-md"
            >
              <ExternalLink className="w-4 h-4" />
              <span>Open in Google Maps ➔</span>
            </a>
          </div>

          {/* Transit & Access Info Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
            <div className="p-3 rounded-xl bg-white/5 border border-white/10 flex items-start space-x-2.5">
              <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 shrink-0 mt-0.5">
                <Train className="w-4 h-4" />
              </div>
              <div>
                <span className="font-bold text-white block mb-0.5">Nearest MRT</span>
                <span className="text-white/70 text-[11px]">Toa Payoh (NS19) or Braddell (NS18)</span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-white/5 border border-white/10 flex items-start space-x-2.5">
              <div className="p-1.5 rounded-lg bg-blue-500/20 text-blue-300 shrink-0 mt-0.5">
                <Bus className="w-4 h-4" />
              </div>
              <div>
                <span className="font-bold text-white block mb-0.5">Bus Services</span>
                <span className="text-white/70 text-[11px]">238, 59, 231 (Lorong 8 Toa Payoh)</span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-white/5 border border-white/10 flex items-start space-x-2.5">
              <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-300 shrink-0 mt-0.5">
                <Car className="w-4 h-4" />
              </div>
              <div>
                <span className="font-bold text-white block mb-0.5">Parking</span>
                <span className="text-white/70 text-[11px]">On-site basement & nearby HDB carparks</span>
              </div>
            </div>
          </div>

          {/* Footer Action Buttons */}
          <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
            <button
              type="button"
              onClick={handleGetDirections}
              className="w-full sm:flex-1 py-3.5 px-6 rounded-2xl bg-gradient-to-r from-[#C81E6E] via-[#E8752C] to-[#E8B400] hover:from-[#d62477] hover:to-[#f0be10] text-white font-poster text-base tracking-wider shadow-xl transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer flex items-center justify-center space-x-2.5 group"
            >
              <Navigation className="w-5 h-5 text-white group-hover:rotate-12 transition-transform" />
              <span>GET DIRECTIONS (OPEN MAPS)</span>
              <ExternalLink className="w-4 h-4 text-white/80" />
            </button>

            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto py-3.5 px-6 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs uppercase tracking-wider transition-all cursor-pointer"
            >
              Close
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
