import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { motion, AnimatePresence } from 'motion/react';
import { Heart, X } from 'lucide-react';
import { JubileeLogo } from './JubileeLogo';

interface SparkleConfettiProps {
  isOpen: boolean;
  onComplete: () => void;
}

export const SparkleConfetti: React.FC<SparkleConfettiProps> = ({ isOpen, onComplete }) => {
  useEffect(() => {
    if (!isOpen) return;

    // Trigger multi-stage confetti explosion using brand colors
    const brandColors = ['#2242A6', '#C81E6E', '#E8752C', '#E8B400', '#D62828', '#FFFFFF'];

    // Burst 1: Center burst
    confetti({
      particleCount: 80,
      spread: 100,
      origin: { y: 0.5 },
      colors: brandColors,
      scalar: 1.2,
      zIndex: 99999
    });

    // Burst 2 & 3: Side cannons after 250ms
    const timer = setTimeout(() => {
      confetti({
        particleCount: 50,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: brandColors,
        zIndex: 99999
      });
      confetti({
        particleCount: 50,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: brandColors,
        zIndex: 99999
      });
    }, 250);

    // Complete overlay after 1.4s
    const closeTimer = setTimeout(() => {
      onComplete();
    }, 1400);

    return () => {
      clearTimeout(timer);
      clearTimeout(closeTimer);
    };
  }, [isOpen, onComplete]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1a0b22]/90 backdrop-blur-md"
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 1.1, opacity: 0 }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
            className="cream-card p-8 sm:p-12 text-center max-w-md w-full relative overflow-hidden border-2 border-[#E8B400]"
          >
            <button
              onClick={onComplete}
              className="absolute top-4 right-4 p-2 rounded-full bg-[#241226]/10 hover:bg-[#241226]/20 text-[#241226] transition-colors cursor-pointer z-10"
              title="Close"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
            <motion.div 
              animate={{ rotate: [-10, 10, -10], y: [0, -8, 0] }}
              transition={{ repeat: Infinity, duration: 1.6, ease: "easeInOut" }}
              className="w-24 h-24 mx-auto mb-4 rounded-full bg-signature-gradient p-1 flex items-center justify-center shadow-2xl"
            >
              <div className="w-full h-full bg-[#1a0b22] rounded-full flex items-center justify-center p-2.5 overflow-hidden">
                <JubileeLogo className="w-full h-full object-contain" />
              </div>
            </motion.div>

            <h3 className="font-poster text-3xl sm:text-4xl text-[#241226] tracking-wide mb-2">
              WELCOME TO GRACIA!
            </h3>
            <p className="font-script text-2xl text-[#C81E6E] mb-4">
              Celebrating 25 Years of Grace
            </p>
            <p className="text-sm font-medium text-[#241226]/80 flex items-center justify-center space-x-1">
              <span>Opening registration form</span>
              <Heart className="w-4 h-4 text-[#D62828] fill-current animate-pulse" />
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
