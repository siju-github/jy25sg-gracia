import React, { useState } from 'react';
import { NavTab } from '../types';
import { JYLogo } from './JYLogo';
import { Heart, Instagram, Facebook, Youtube, Shield, MapPin, Calendar, Globe, Navigation } from 'lucide-react';
import { LocationMapModal } from './LocationMapModal';

interface FooterProps {
  onSelectTab: (tab: NavTab) => void;
  hiddenPages?: string[];
}

export const Footer: React.FC<FooterProps> = ({ onSelectTab, hiddenPages }) => {
  const [showLocationModal, setShowLocationModal] = useState(false);

  return (
    <footer className="relative bg-[#170a1f] border-t border-white/10 pt-16 pb-12 overflow-hidden text-white/70">
      {/* Signature Animated Top Divider Bar */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-signature-animated"></div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-12">
          
          {/* Col 1: Brand */}
          <div className="space-y-4 md:col-span-1">
            <div className="flex items-center space-x-3">
              <JYLogo className="w-9 h-9" />
              <div>
                <div className="flex items-center space-x-1.5">
                  <span className="font-poster text-2xl tracking-widest text-signature-animated">GRACIA</span>
                  <span className="text-[10px] font-bold text-[#E8B400] bg-[#E8B400]/10 px-1.5 py-0.5 rounded border border-[#E8B400]/30">
                    25 YRS
                  </span>
                </div>
              </div>
            </div>
            <p className="font-sans font-semibold tracking-wide text-[#E8752C] text-base sm:text-lg italic">
              "Faithful Witness, Joyful Missionary"
            </p>
            <p className="text-sm text-white/80 font-medium leading-relaxed">
              Jesus Youth is Celebrating 25 Years of Grace in Singapore
            </p>
          </div>

          {/* Col 2: Event Info */}
          <div className="space-y-3">
            <h4 className="font-poster text-lg text-white tracking-wider">EVENT DETAILS</h4>
            <div className="space-y-2 text-sm">
              <div className="flex items-start space-x-2 text-white/80">
                <Calendar className="w-4 h-4 text-[#E8752C] shrink-0 mt-0.5" />
                <span>10–11 October 2026</span>
              </div>
              <button
                type="button"
                onClick={() => setShowLocationModal(true)}
                className="flex items-start space-x-2 text-white/80 hover:text-white transition-colors cursor-pointer text-left group"
                title="Click to view location map & directions"
              >
                <MapPin className="w-4 h-4 text-[#C81E6E] group-hover:scale-110 transition-transform shrink-0 mt-0.5" />
                <span>
                  Caritas Agape Village, 7A Lorong 8 Toa Payoh, Singapore 319264
                  <Navigation className="w-3 h-3 text-[#E8B400] inline-block ml-1 opacity-80 group-hover:opacity-100" />
                </span>
              </button>
            </div>
          </div>

          {/* Col 3: Quick Navigation */}
          <div className="space-y-3">
            <h4 className="font-poster text-lg text-white tracking-wider">NAVIGATION</h4>
            <ul className="space-y-2 text-sm">
              {!hiddenPages?.includes('conference') && (
                <li>
                  <button onClick={() => onSelectTab('conference')} className="hover:text-[#E8752C] transition-colors cursor-pointer">
                    GRACIA Conference
                  </button>
                </li>
              )}
              {!hiddenPages?.includes('musical') && (
                <li>
                  <button onClick={() => onSelectTab('musical')} className="hover:text-[#C81E6E] transition-colors cursor-pointer">
                    GRACIA Musical Concert
                  </button>
                </li>
              )}
              {!hiddenPages?.includes('jubilee') && (
                <li>
                  <button onClick={() => onSelectTab('jubilee')} className="hover:text-[#E8B400] transition-colors cursor-pointer">
                    Jubilee Memories (25 Years)
                  </button>
                </li>
              )}
              {!hiddenPages?.includes('contact') && (
                <li>
                  <button onClick={() => onSelectTab('contact')} className="hover:text-[#2242A6] transition-colors cursor-pointer">
                    Prayer Groups & Contact
                  </button>
                </li>
              )}
              {!hiddenPages?.includes('portal') && (
                <li>
                  <button onClick={() => onSelectTab('portal')} className="hover:text-emerald-400 transition-colors cursor-pointer">
                    My Portal & Digital Pass
                  </button>
                </li>
              )}
            </ul>
          </div>

          {/* Col 4: Connect */}
          <div className="space-y-3">
            <h4 className="font-poster text-lg text-white tracking-wider">CONNECT WITH US</h4>
            <p className="text-sm text-white/70">
              Email: <a href="mailto:singapore@jesusyouth.org" className="text-[#E8B400] underline hover:text-white">singapore@jesusyouth.org</a>
            </p>
            <p className="text-sm text-white/70">
              Web: <a href="https://singapore.jesusyouth.org/" target="_blank" rel="noreferrer" className="text-[#3B82F6] underline hover:text-white">singapore.jesusyouth.org</a>
            </p>
            <div className="flex space-x-3 pt-2">
              <a 
                href="https://www.instagram.com/jesusyouth_singapore" 
                target="_blank" 
                rel="noreferrer" 
                aria-label="Instagram (@jesusyouth_singapore)"
                title="Instagram: @jesusyouth_singapore"
                className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-[#C81E6E] hover:text-white transition-all"
              >
                <Instagram className="w-5 h-5" />
              </a>
              <a 
                href="https://www.facebook.com/jy15sg" 
                target="_blank" 
                rel="noreferrer" 
                aria-label="Facebook"
                title="Facebook: facebook.com/jy15sg"
                className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-[#2242A6] hover:text-white transition-all"
              >
                <Facebook className="w-5 h-5" />
              </a>
              <a 
                href="https://www.youtube.com/@JesusYouthSingapore" 
                target="_blank" 
                rel="noreferrer" 
                aria-label="YouTube (@JesusYouthSingapore)"
                title="YouTube: @JesusYouthSingapore"
                className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-[#D62828] hover:text-white transition-all"
              >
                <Youtube className="w-5 h-5" />
              </a>
              <a 
                href="https://singapore.jesusyouth.org/" 
                target="_blank" 
                rel="noreferrer" 
                aria-label="Website"
                title="Website: singapore.jesusyouth.org"
                className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-[#E8B400] hover:text-black transition-all"
              >
                <Globe className="w-5 h-5" />
              </a>
            </div>
          </div>

        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-white/10 flex flex-col sm:flex-row items-center justify-center text-xs text-white/50 space-y-4 sm:space-y-0">
          <p className="flex items-center space-x-1">
            <span>© 2026 Jesus Youth Singapore. Built with</span>
            <Heart className="w-3.5 h-3.5 text-[#D62828] fill-current" />
            <span>for GRACIA 25th Jubilee.</span>
          </p>
        </div>

      </div>

      {/* LOCATION MAP MODAL */}
      <LocationMapModal
        isOpen={showLocationModal}
        onClose={() => setShowLocationModal(false)}
        venueName="Caritas Agape Village"
        address="7A Lorong 8 Toa Payoh, Singapore 319264"
        hallName="Jesus Youth Singapore Jubilee Venue"
      />
    </footer>
  );
};
