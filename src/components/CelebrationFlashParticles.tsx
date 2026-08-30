import React, { useEffect, useMemo } from 'react';
import confetti from 'canvas-confetti';
import { motion, AnimatePresence } from 'motion/react';
import { JubileeLogo } from './JubileeLogo';

interface CelebrationFlashParticlesProps {
  isOpen: boolean;
  onComplete: () => void;
  title?: string;
  subtitle?: string;
}

export const CelebrationFlashParticles: React.FC<CelebrationFlashParticlesProps> = ({
  isOpen,
  onComplete,
  title = "YES, COUNT ME IN!",
  subtitle = "Loading Jubilee Registration Page..."
}) => {
  // Generate random floating particles for the flash background
  const particles = useMemo(() => {
    return Array.from({ length: 32 }).map((_, i) => ({
      id: i,
      size: Math.random() * 12 + 6,
      x: Math.random() * 100, // percentage
      y: Math.random() * 100,
      duration: Math.random() * 1.5 + 1.2,
      delay: Math.random() * 0.4,
      color: ['#E8B400', '#E8752C', '#C81E6E', '#2242A6', '#34D399', '#FFFFFF'][i % 6],
      shape: i % 3 === 0 ? 'star' : i % 3 === 1 ? 'circle' : 'diamond'
    }));
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    // Trigger multi-stage celebratory confetti flash particle explosions
    const brandColors = ['#E8B400', '#E8752C', '#2242A6', '#C81E6E', '#D62828', '#34D399', '#FFFFFF'];

    // Stage 1: Immediate high-density center flash explosion
    confetti({
      particleCount: 110,
      spread: 120,
      origin: { y: 0.5 },
      colors: brandColors,
      scalar: 1.35,
      zIndex: 999999,
      ticks: 300,
      gravity: 0.8,
      drift: 0.1
    });

    // Stage 2: Dual side cannons after 150ms
    const timer1 = setTimeout(() => {
      confetti({
        particleCount: 65,
        angle: 60,
        spread: 65,
        origin: { x: 0, y: 0.6 },
        colors: brandColors,
        scalar: 1.2,
        zIndex: 999999
      });
      confetti({
        particleCount: 65,
        angle: 120,
        spread: 65,
        origin: { x: 1, y: 0.6 },
        colors: brandColors,
        scalar: 1.2,
        zIndex: 999999
      });
    }, 150);

    // Stage 3: Golden sparkle starburst after 400ms
    const timer2 = setTimeout(() => {
      confetti({
        particleCount: 50,
        spread: 140,
        origin: { y: 0.35 },
        colors: ['#E8B400', '#FFF', '#FFD700', '#F59E0B'],
        scalar: 1.5,
        zIndex: 999999,
        shapes: ['star']
      });
    }, 400);

    // Complete overlay & navigate after 1.2s
    const closeTimer = setTimeout(() => {
      onComplete();
    }, 1200);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
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
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-[#0A0514]/92 backdrop-blur-xl overflow-hidden pointer-events-auto"
        >
          {/* FLASH LIGHT BEAM RADIANCE */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <motion.div
              initial={{ scale: 0.2, opacity: 0.9 }}
              animate={{ scale: [0.2, 2.5, 3], opacity: [0.9, 0.4, 0] }}
              transition={{ duration: 0.9, ease: "easeOut" }}
              className="w-96 h-96 rounded-full bg-gradient-to-r from-amber-400/50 via-pink-500/30 to-purple-600/40 blur-3xl"
            />
          </div>

          {/* FLOATING CELEBRATION FLASH PARTICLES */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {particles.map((p) => (
              <motion.div
                key={p.id}
                initial={{
                  x: `${p.x}vw`,
                  y: `${p.y + 20}vh`,
                  scale: 0,
                  opacity: 0,
                  rotate: 0
                }}
                animate={{
                  y: [`${p.y}vh`, `${p.y - 35}vh`],
                  scale: [0, 1.4, 0.8, 0],
                  opacity: [0, 1, 0.8, 0],
                  rotate: [0, 180, 360]
                }}
                transition={{
                  duration: p.duration,
                  delay: p.delay,
                  ease: "easeInOut",
                  repeat: Infinity
                }}
                style={{
                  position: 'absolute',
                  width: `${p.size}px`,
                  height: `${p.size}px`,
                  backgroundColor: p.color,
                  boxShadow: `0 0 12px ${p.color}`,
                  borderRadius: p.shape === 'circle' ? '50%' : p.shape === 'star' ? '20%' : '2px',
                  transform: p.shape === 'diamond' ? 'rotate(45deg)' : undefined
                }}
              />
            ))}
          </div>

          {/* CENTRAL CELEBRATION CARD */}
          <motion.div
            initial={{ scale: 0.7, opacity: 0, y: 30 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 1.05, opacity: 0, y: -20 }}
            transition={{ type: 'spring', damping: 18, stiffness: 280 }}
            className="relative z-10 p-8 sm:p-12 text-center max-w-sm w-full rounded-3xl bg-gradient-to-b from-[#1C0D2A]/95 via-[#130720]/98 to-[#0C0317]/95 border-2 border-amber-400/80 shadow-[0_0_60px_rgba(232,180,0,0.35)] flex flex-col items-center justify-center space-y-6"
          >
            {/* Glowing Golden Ring around Logo (without white background) */}
            <div className="relative w-32 h-32 mx-auto flex items-center justify-center">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 8, ease: "linear" }}
                className="absolute inset-0 rounded-full border-2 border-dashed border-amber-400/60"
              />
              <motion.div
                animate={{ scale: [1, 1.15, 1], opacity: [0.7, 1, 0.7] }}
                transition={{ repeat: Infinity, duration: 1.4, ease: "easeInOut" }}
                className="absolute -inset-2 rounded-full bg-gradient-to-r from-amber-500/30 via-pink-500/20 to-amber-500/30 blur-md"
              />
              <div className="relative w-28 h-28 flex items-center justify-center">
                <JubileeLogo className="w-full h-full object-contain" />
              </div>
            </div>

            {/* ONLY TEXT: Warm Welcome */}
            <h2 className="font-poster text-3xl sm:text-4xl text-amber-300 tracking-wide drop-shadow-md">
              Warm Welcome
            </h2>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
