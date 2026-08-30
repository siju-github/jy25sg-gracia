import React, { useState, useEffect } from 'react';
import { Sparkles, Check, Info, ShieldAlert, Users, Undo2, ArrowRight, UserCheck } from 'lucide-react';

export interface SeatInfo {
  id: string; // e.g. "A-01"
  row: string; // e.g. "A"
  number: number; // e.g. 1
  label: string; // e.g. "Row A - Seat 01"
  zone: 'vip' | 'youth' | 'general';
  isOccupied: boolean;
}

interface SeatSelectorProps {
  requiredSeatsCount: number;
  registrantName: string;
  registrantEmail: string;
  existingBookedSeats?: string[];
  initialSelectedSeats?: string[];
  onConfirmSeats: (seats: string[]) => void;
  onBack: () => void;
}

export const SeatSelector: React.FC<SeatSelectorProps> = ({
  requiredSeatsCount,
  registrantName,
  registrantEmail,
  existingBookedSeats = [],
  initialSelectedSeats = [],
  onConfirmSeats,
  onBack
}) => {
  // Ensure target count is a valid positive integer (minimum 1)
  const targetCount = Math.max(1, Number(requiredSeatsCount) || 1);

  const [selectedSeats, setSelectedSeats] = useState<string[]>(initialSelectedSeats);
  const [hoveredSeat, setHoveredSeat] = useState<SeatInfo | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  // Sync state if initialSelectedSeats changes or becomes available
  useEffect(() => {
    if (initialSelectedSeats && initialSelectedSeats.length > 0) {
      setSelectedSeats(initialSelectedSeats.slice(0, targetCount));
    }
  }, [initialSelectedSeats, targetCount]);

  // Generate 300 seats layout (Rows A to J, 30 seats per row)
  const rows = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];

  const getSeatZone = (row: string, num: number): 'vip' | 'youth' | 'general' => {
    const isFrontHalf = ['A', 'B', 'C', 'D', 'E'].includes(row);
    if (isFrontHalf) {
      if (num >= 1 && num <= 10) return 'vip'; // Front Left 50 seats (5 rows x 10)
      if (num >= 21 && num <= 30) return 'youth'; // Front Right 50 seats (5 rows x 10)
    }
    return 'general'; // 200 seats (Middle front 50 + Rear 150)
  };

  // Build grid data
  const allSeats: SeatInfo[] = [];
  rows.forEach(row => {
    for (let num = 1; num <= 30; num++) {
      const id = `${row}-${num < 10 ? '0' + num : num}`;
      const label = `Row ${row} - Seat ${num < 10 ? '0' + num : num}`;
      const zone = getSeatZone(row, num);
      const isOccupied = existingBookedSeats.includes(id);
      allSeats.push({ id, row, number: num, label, zone, isOccupied });
    }
  });

  const showToast = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3500);
  };

  const autoPickSeats = () => {
    const available = allSeats.filter(s => !s.isOccupied && s.zone !== 'vip');
    if (available.length < targetCount) {
      showToast(`Only ${available.length} available seat(s) remaining in the hall!`);
      if (available.length > 0) {
        setSelectedSeats(available.map(s => s.id));
      }
      return;
    }

    // Attempt 1: Find `targetCount` consecutive seats in the same row
    let picked: string[] = [];
    for (const row of rows) {
      const rowAvailable = available.filter(s => s.row === row);
      for (let i = 0; i <= rowAvailable.length - targetCount; i++) {
        const window = rowAvailable.slice(i, i + targetCount);
        let isConsecutive = true;
        for (let j = 1; j < window.length; j++) {
          if (window[j].number !== window[j - 1].number + 1) {
            isConsecutive = false;
            break;
          }
        }
        if (isConsecutive) {
          picked = window.map(s => s.id);
          break;
        }
      }
      if (picked.length === targetCount) break;
    }

    // Fallback: Pick best available seats
    if (picked.length < targetCount) {
      picked = available.slice(0, targetCount).map(s => s.id);
    }

    if (picked.length > 0) {
      setSelectedSeats(picked);
      showToast(`Pre-selected ${picked.length} seat(s) based on your booking!`);
    }
  };

  // Auto-select initial seats if none selected, or trim if booking count reduced
  useEffect(() => {
    if (selectedSeats.length === 0) {
      autoPickSeats();
    } else if (selectedSeats.length > targetCount) {
      setSelectedSeats(prev => prev.slice(0, targetCount));
      showToast(`Adjusted seat selection to match your booking limit (${targetCount} seat(s)).`);
    }
  }, [targetCount, existingBookedSeats.length]);

  const handleSeatClick = (seat: SeatInfo) => {
    if (seat.isOccupied) {
      showToast(`Seat ${seat.id} is already reserved by another attendee.`);
      return;
    }

    if (seat.zone === 'vip') {
      showToast(`Row ${seat.row} Seats 1-10 are reserved for Guests & VIPs.`);
      return;
    }

    if (selectedSeats.includes(seat.id)) {
      // Unselect
      setSelectedSeats(prev => prev.filter(id => id !== seat.id));
    } else {
      // Select - strictly limit to targetCount
      if (selectedSeats.length >= targetCount) {
        showToast(`Your booking limit is ${targetCount} seat(s). Unselect a seat first to pick a different one.`);
        return;
      }
      setSelectedSeats(prev => [...prev, seat.id]);
    }
  };

  const isSelectionComplete = selectedSeats.length === targetCount;

  return (
    <div className="max-w-5xl mx-auto px-3 sm:px-6 py-6 text-white space-y-6">
      
      {/* Header Info */}
      <div className="bg-gradient-to-r from-[#1A2F75]/90 via-[#2242A6]/90 to-[#2c1140]/90 p-5 rounded-3xl border border-white/20 backdrop-blur-xl shadow-2xl flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-[#E8B400] text-xs font-bold uppercase tracking-widest mb-1">
            <Sparkles className="w-4 h-4" />
            <span>GRACIA Musical Concert • Agape Village Auditorium</span>
          </div>
          <h2 className="font-poster text-2xl sm:text-3xl text-white tracking-wide">
            SELECT YOUR SEATS
          </h2>
          <p className="text-xs sm:text-sm text-white/80 mt-1">
            Reserving for <strong className="text-white">{registrantName}</strong> ({registrantEmail}) • Required Seats: <strong className="text-[#E8B400] text-base font-bold">{targetCount} Seat(s)</strong>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-bold flex items-center space-x-1.5 transition-all cursor-pointer"
          >
            <Undo2 className="w-4 h-4" />
            <span>Back to Info</span>
          </button>
          
          <button
            type="button"
            onClick={autoPickSeats}
            className="px-4 py-2.5 rounded-xl bg-[#E8752C] hover:bg-[#d6651e] text-white text-xs font-bold flex items-center space-x-1.5 shadow-md transition-all cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            <span>Auto-Pick Best Seats</span>
          </button>
        </div>
      </div>

      {/* Toast Notification */}
      {notification && (
        <div className="bg-[#C81E6E] text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-lg border border-white/30 text-center animate-fade-in flex items-center justify-center space-x-2">
          <Info className="w-4 h-4 shrink-0" />
          <span>{notification}</span>
        </div>
      )}

      {/* Seat Category Legend */}
      <div className="bg-black/40 p-4 rounded-2xl border border-white/10 backdrop-blur-md grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
        
        {/* VIP Reserved */}
        <div className="flex items-center space-x-2 p-2 rounded-xl bg-amber-900/30 border border-amber-500/40">
          <div className="w-4 h-4 rounded-md bg-amber-500 border border-amber-300 shadow-sm shrink-0"></div>
          <div>
            <p className="font-bold text-amber-200">Guests & VIPs</p>
            <p className="text-[10px] text-amber-300/80">50 Seats (Front Left)</p>
          </div>
        </div>

        {/* Teens & Youth */}
        <div className="flex items-center space-x-2 p-2 rounded-xl bg-sky-900/30 border border-sky-500/40">
          <div className="w-4 h-4 rounded-md bg-sky-500 border border-sky-300 shadow-sm shrink-0"></div>
          <div>
            <p className="font-bold text-sky-200">Teens & Youth</p>
            <p className="text-[10px] text-sky-300/80">50 Seats (Front Right)</p>
          </div>
        </div>

        {/* General Available */}
        <div className="flex items-center space-x-2 p-2 rounded-xl bg-emerald-900/30 border border-emerald-500/40">
          <div className="w-4 h-4 rounded-md bg-emerald-500 border border-emerald-300 shadow-sm shrink-0"></div>
          <div>
            <p className="font-bold text-emerald-200">General Seats</p>
            <p className="text-[10px] text-emerald-300/80">200 Seats (Open)</p>
          </div>
        </div>

        {/* Selected */}
        <div className="flex items-center space-x-2 p-2 rounded-xl bg-pink-900/40 border border-pink-500/50">
          <div className="w-4 h-4 rounded-md bg-[#C81E6E] border border-white shadow-sm shrink-0 animate-pulse"></div>
          <div>
            <p className="font-bold text-pink-200">Your Selection</p>
            <p className="text-[10px] text-pink-300/80">{selectedSeats.length} / {targetCount} Picked</p>
          </div>
        </div>

        {/* Booked */}
        <div className="flex items-center space-x-2 p-2 rounded-xl bg-gray-900/40 border border-gray-600/40">
          <div className="w-4 h-4 rounded-md bg-slate-700 border border-slate-600 shrink-0"></div>
          <div>
            <p className="font-bold text-gray-300">Booked / Taken</p>
            <p className="text-[10px] text-gray-400">Unavailable</p>
          </div>
        </div>

      </div>

      {/* STAGE & SEAT MAP */}
      <div className="bg-[#12071f]/90 p-4 sm:p-8 rounded-3xl border border-white/15 shadow-2xl overflow-x-auto space-y-6">
        
        {/* Visual Stage */}
        <div className="max-w-xl mx-auto text-center space-y-2">
          <div className="relative py-3 rounded-2xl bg-gradient-to-r from-[#C81E6E]/80 via-[#E8752C]/80 to-[#E8B400]/80 border-2 border-white/30 shadow-2xl tracking-widest font-poster text-lg text-white uppercase overflow-hidden">
            <div className="absolute inset-0 bg-white/10 animate-pulse pointer-events-none"></div>
            <span>🎭 CONCERT STAGE / PERFORMANCE AREA 🎭</span>
          </div>
          <p className="text-[11px] text-white/60 uppercase tracking-widest font-bold">
            Audience Seating Layout • 300 Seats Total Capacity
          </p>
        </div>

        {/* Front Section Label */}
        <div className="flex items-center gap-3 sm:gap-4 text-center text-[10px] sm:text-xs font-black tracking-wider uppercase pt-2 min-w-[960px]">
          <div className="w-7 shrink-0" />
          <div className="flex-1 bg-amber-500/20 text-amber-300 py-2 px-2 rounded-xl border border-amber-500/30 shadow-xs">
            Front Left (50 Seats) — Guests & VIPs
          </div>
          <div className="w-2 sm:w-3 shrink-0" />
          <div className="flex-1 bg-emerald-500/20 text-emerald-300 py-2 px-2 rounded-xl border border-emerald-500/30 shadow-xs">
            Front Center (50 Seats) — General
          </div>
          <div className="w-2 sm:w-3 shrink-0" />
          <div className="flex-1 bg-sky-500/20 text-sky-300 py-2 px-2 rounded-xl border border-sky-500/30 shadow-xs">
            Front Right (50 Seats) — Teens & Youth
          </div>
          <div className="w-7 shrink-0" />
        </div>

        {/* Grid Container */}
        <div className="min-w-[960px] mx-auto pt-2 space-y-2.5">
          {rows.map((row) => {
            const isRearDivider = row === 'F';
            return (
              <React.Fragment key={row}>
                {isRearDivider && (
                  <div className="my-4 border-t border-dashed border-white/20 pt-3 text-center text-[11px] font-bold text-white/50 uppercase tracking-widest">
                    Main Rear Seating Area (150 Seats • General Admission)
                  </div>
                )}

                <div className="flex items-center space-x-2 sm:space-x-3">
                  {/* Row Letter Left */}
                  <span className="w-7 text-center font-poster text-lg text-[#E8B400] font-bold shrink-0">
                    {row}
                  </span>

                  {/* Seat Blocks Container */}
                  <div className="flex-1 flex items-center justify-between gap-3 sm:gap-4">
                    {[0, 10, 20].map((startColIdx, blockIdx) => (
                      <React.Fragment key={blockIdx}>
                        {blockIdx > 0 && (
                          <div className="w-2 sm:w-3 text-center text-[10px] text-white/30 font-bold select-none shrink-0">
                            •
                          </div>
                        )}
                        <div className="grid grid-cols-10 gap-1 sm:gap-1.5 flex-1">
                          {Array.from({ length: 10 }).map((_, i) => {
                            const colIdx = startColIdx + i;
                            const num = colIdx + 1;
                            const seatId = `${row}-${num < 10 ? '0' + num : num}`;
                            const seatInfo = allSeats.find(s => s.id === seatId)!;
                            const isSelected = selectedSeats.includes(seatId);

                            let bgClass = 'bg-emerald-600/30 text-emerald-200 border-emerald-500/40 hover:bg-emerald-500/60 hover:scale-110';
                            
                            if (seatInfo.isOccupied) {
                              bgClass = 'bg-slate-800 text-slate-500 border-slate-700 opacity-40 cursor-not-allowed';
                            } else if (isSelected) {
                              bgClass = 'bg-[#C81E6E] text-white border-2 border-white scale-110 ring-2 ring-[#C81E6E]/60 shadow-lg shadow-[#C81E6E]/50 z-10';
                            } else if (seatInfo.zone === 'vip') {
                              bgClass = 'bg-amber-500/25 text-amber-300 border-amber-500/50 hover:bg-amber-500/40';
                            } else if (seatInfo.zone === 'youth') {
                              bgClass = 'bg-sky-500/30 text-sky-200 border-sky-400/50 hover:bg-sky-500/50 hover:scale-110';
                            }

                            return (
                              <button
                                key={seatId}
                                type="button"
                                onClick={() => handleSeatClick(seatInfo)}
                                onMouseEnter={() => setHoveredSeat(seatInfo)}
                                onMouseLeave={() => setHoveredSeat(null)}
                                title={`${seatInfo.label} (${seatInfo.zone.toUpperCase()})`}
                                className={`h-7 sm:h-8 rounded-lg text-[10px] font-bold border transition-all duration-150 flex items-center justify-center cursor-pointer relative ${bgClass}`}
                              >
                                {isSelected ? (
                                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                                ) : (
                                  num
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </React.Fragment>
                    ))}
                  </div>

                  {/* Row Letter Right */}
                  <span className="w-7 text-center font-poster text-lg text-[#E8B400] font-bold shrink-0">
                    {row}
                  </span>
                </div>
              </React.Fragment>
            );
          })}
        </div>

        {/* Hover Information Display */}
        <div className="h-8 flex items-center justify-center text-xs text-center text-white/80 font-medium">
          {hoveredSeat ? (
            <span className="bg-white/10 px-4 py-1 rounded-full border border-white/20">
              Hovered: <strong className="text-[#E8B400]">{hoveredSeat.label}</strong> • Zone: <strong className="uppercase">{hoveredSeat.zone}</strong> • Status: {hoveredSeat.isOccupied ? 'Booked' : hoveredSeat.zone === 'vip' ? 'VIP Reserved' : 'Available'}
            </span>
          ) : (
            <span className="text-white/50">Hover over any seat to inspect details or click to select</span>
          )}
        </div>

      </div>

      {/* BOTTOM SELECTION BAR & CONFIRMATION */}
      <div className="bg-white p-5 rounded-3xl text-[#241226] shadow-2xl border-2 border-[#C81E6E]/30 space-y-4">
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 pb-4">
          <div>
            <h3 className="font-poster text-xl text-[#241226] tracking-wide">
              YOUR SELECTED CONCERT SEATS ({selectedSeats.length} / {targetCount})
            </h3>
            <p className="text-xs text-[#241226]/70">
              {isSelectionComplete 
                ? 'All required seats selected! Click confirm to issue your GRACIA concert ticket.' 
                : `Please select ${Math.max(0, targetCount - selectedSeats.length)} more seat(s) on the hall map above.`}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {selectedSeats.length === 0 ? (
              <span className="text-xs text-gray-400 italic">No seats selected yet</span>
            ) : (
              selectedSeats.map((id, idx) => (
                <span 
                  key={`${id}-${idx}`}
                  className="px-3 py-1.5 rounded-full bg-[#C81E6E] text-white text-xs font-bold shadow-xs flex items-center space-x-1"
                >
                  <span>{id}</span>
                  <button 
                    type="button" 
                    onClick={() => setSelectedSeats(prev => prev.filter(s => s !== id))}
                    className="hover:text-amber-300 ml-1 font-black cursor-pointer"
                  >
                    ×
                  </button>
                </span>
              ))
            )}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-1">
          <button
            type="button"
            onClick={onBack}
            className="w-full sm:w-auto px-6 py-3 rounded-xl bg-gray-100 hover:bg-gray-200 text-[#241226] font-bold text-sm transition-all cursor-pointer"
          >
            Modify Registration Info
          </button>

          <button
            type="button"
            disabled={!isSelectionComplete}
            onClick={() => onConfirmSeats(selectedSeats)}
            className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-signature-gradient text-white font-poster text-lg tracking-wider shadow-xl hover:opacity-95 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
          >
            <span>CONFIRM SEATS & ISSUE TICKET</span>
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>

      </div>

    </div>
  );
};
