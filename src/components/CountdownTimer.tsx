import React, { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';

interface CountdownTimerProps {
  targetDate?: string;
}

export const CountdownTimer: React.FC<CountdownTimerProps> = ({ 
  targetDate = '2026-10-10T09:00:00+08:00' 
}) => {
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0
  });

  useEffect(() => {
    const calculateTime = () => {
      const difference = +new Date(targetDate) - +new Date();
      if (difference > 0) {
        setTimeLeft({
          days: Math.floor(difference / (1000 * 60 * 60 * 24)),
          hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
          minutes: Math.floor((difference / 1000 / 60) % 60),
          seconds: Math.floor((difference / 1000) % 60)
        });
      } else {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
      }
    };

    calculateTime();
    const interval = setInterval(calculateTime, 1000);
    return () => clearInterval(interval);
  }, [targetDate]);

  return (
    <div className="bg-white/5 border border-white/10 backdrop-blur-xl rounded-2xl p-4 sm:p-6 shadow-2xl max-w-xl mx-auto">
      <div className="flex items-center justify-center space-x-2 text-[#E8B400] text-sm uppercase font-bold tracking-widest mb-4">
        <Clock className="w-4 h-4 animate-pulse text-[#E8752C]" />
        <span>COUNTDOWN TO GRACIA (10 OCT 2026)</span>
      </div>

      <div className="grid grid-cols-4 gap-2 sm:gap-4 text-center">
        
        {/* Days */}
        <div className="bg-[#2c1140]/80 border border-white/10 rounded-xl p-2 sm:p-3">
          <div className="font-poster text-2xl sm:text-4xl text-white font-bold tracking-tight">
            {timeLeft.days}
          </div>
          <div className="text-[10px] sm:text-xs text-[#E8752C] font-semibold uppercase mt-1">Days</div>
        </div>

        {/* Hours */}
        <div className="bg-[#2c1140]/80 border border-white/10 rounded-xl p-2 sm:p-3">
          <div className="font-poster text-2xl sm:text-4xl text-[#E8B400] font-bold tracking-tight">
            {String(timeLeft.hours).padStart(2, '0')}
          </div>
          <div className="text-[10px] sm:text-xs text-[#E8B400] font-semibold uppercase mt-1">Hours</div>
        </div>

        {/* Minutes */}
        <div className="bg-[#2c1140]/80 border border-white/10 rounded-xl p-2 sm:p-3">
          <div className="font-poster text-2xl sm:text-4xl text-[#C81E6E] font-bold tracking-tight">
            {String(timeLeft.minutes).padStart(2, '0')}
          </div>
          <div className="text-[10px] sm:text-xs text-[#C81E6E] font-semibold uppercase mt-1">Mins</div>
        </div>

        {/* Seconds */}
        <div className="bg-[#2c1140]/80 border border-white/10 rounded-xl p-2 sm:p-3">
          <div className="font-poster text-2xl sm:text-4xl text-[#3B82F6] font-bold tracking-tight">
            {String(timeLeft.seconds).padStart(2, '0')}
          </div>
          <div className="text-[10px] sm:text-xs text-[#3B82F6] font-semibold uppercase mt-1">Secs</div>
        </div>

      </div>
    </div>
  );
};
