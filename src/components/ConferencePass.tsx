import React, { useEffect, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Download, Wallet, CheckCircle2, Camera, BookOpen, QrCode, MapPin, Calendar, Copy, Check } from 'lucide-react';
import { JYLogo } from './JYLogo';
import { getBibleVerseReference, getBibleVerseText } from '../lib/bibleVerses';
import { toProperCase } from '../lib/utils';

export interface PassBadgeGroupColor {
  name: string;
  emoji: string;
  badgeBg: string;
  badgeText: string;
  borderClass: string;
}

export interface PassBadgeData {
  passId: string;
  name: string;
  email: string;
  categoryLabel?: string;
  parish?: string;
  seat?: string;
  verseText?: string | null;
  verseReference?: string;
  isPrimary?: boolean;
  groupColor?: PassBadgeGroupColor;
  qrCodeDataUri?: string;
  phone?: string;
  photoUrl?: string;
  type?: string;
}

export interface ConferencePassProps {
  pass: PassBadgeData;
  reg?: any;
  pIdx?: number;
  isCheckedIn?: boolean;
  googlePhotoUrl?: string;
  onDownloadPdf?: (pass: PassBadgeData) => void;
  onAddToWallet?: (reg: any, pass: PassBadgeData) => void;
  showActions?: boolean;
}

export const ConferencePass: React.FC<ConferencePassProps> = ({
  pass,
  reg,
  pIdx = 0,
  isCheckedIn = false,
  googlePhotoUrl,
  onDownloadPdf,
  onAddToWallet,
  showActions = true,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const storageKey = `gracia_pass_photo_${pass.passId}`;
  const [copiedPassId, setCopiedPassId] = useState(false);

  // Google photo is strictly restricted to primary delegate passes or explicit individual matches
  const effectiveGooglePhoto = pass.isPrimary ? (googlePhotoUrl || null) : null;

  // Photo URL priority: LocalStorage -> Pass Prop -> Google Profile (Primary only) -> null
  const [currentPhoto, setCurrentPhoto] = useState<string | null>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) return saved;
    } catch (e) {
      // ignore
    }
    return pass.photoUrl || effectiveGooglePhoto || null;
  });

  const [hasCustomPhoto, setHasCustomPhoto] = useState<boolean>(() => {
    try {
      return !!localStorage.getItem(storageKey);
    } catch (e) {
      return false;
    }
  });

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (!saved) {
        setCurrentPhoto(pass.photoUrl || (pass.isPrimary ? googlePhotoUrl : null) || null);
      }
    } catch (e) {}
  }, [pass.photoUrl, googlePhotoUrl, pass.isPrimary, pass.passId, storageKey]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert('Please select an image smaller than 5MB.');
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        if (result) {
          setCurrentPhoto(result);
          setHasCustomPhoto(true);
          try {
            localStorage.setItem(storageKey, result);
          } catch (err) {
            console.error('Failed to save pass photo to localStorage:', err);
          }
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const triggerFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const getInitials = (nameStr: string) => {
    if (!nameStr) return 'G';
    const parts = nameStr.trim().split(' ');
    if (parts.length >= 2) {
      return `${parts[0].charAt(0)}${parts[parts.length - 1].charAt(0)}`.toUpperCase();
    }
    return nameStr.substring(0, 2).toUpperCase();
  };

  const copyPassId = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(pass.passId);
    setCopiedPassId(true);
    setTimeout(() => setCopiedPassId(false), 2000);
  };

  // Resolved Bible Verse Text & Citation Reference (e.g. "2 Timothy 4:12")
  const resolvedVerseText = pass.verseText || (pass.passId ? getBibleVerseText(pass.passId) : null);
  const resolvedVerseRef = pass.verseReference || (pass.passId ? getBibleVerseReference(pass.passId) : '');
  const isMusical = pass.type === 'musical' || reg?.type === 'musical';
  const parishName = pass.parish || reg?.parish || '';

  const formattedName = toProperCase(pass.name);

  return (
    <div className="w-full max-w-[440px] mx-auto rounded-[28px] bg-gradient-to-b from-[#0A1128] via-[#0E1738] to-[#0A1128] border-2 border-amber-500/40 hover:border-amber-400/80 shadow-[0_12px_40px_rgba(0,0,0,0.45)] overflow-hidden relative p-5 sm:p-6 transition-all flex flex-col justify-between group">
      {/* SIGNATURE TOP ACCENT LINE */}
      <div className="absolute top-0 left-0 right-0 h-1.5 bg-signature-gradient z-20" />

      {/* HIDDEN FILE INPUT FOR PHOTO UPLOAD */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/*"
        className="hidden"
      />

      {/* BACKGROUND DECORATIVE AMBIENT GLOW ACCENTS */}
      <div className="absolute top-0 right-0 w-40 h-40 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 left-0 w-40 h-40 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 space-y-4">
        {/* 1. LANYARD SLOT CUTOUT (TOP CENTER) */}
        <div className="w-16 h-3 bg-[#060B1C] border border-amber-400/40 rounded-full mx-auto flex items-center justify-center shadow-inner mt-1">
          <div className="w-9 h-1 bg-amber-400/40 rounded-full" />
        </div>

        {/* 2. HEADER: 25TH JUBILEE EMBLEM, EVENT TITLE & BADGE PILL */}
        <div className="border-b border-slate-700/60 pb-3 pt-1">
          <div className="flex items-start justify-between gap-2.5">
            {/* Left Emblem & Brand Typography */}
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="relative shrink-0 p-0.5 rounded-full bg-slate-800/80 border border-slate-700/80 shadow-md">
                <JYLogo className="w-9 h-9 sm:w-10 sm:h-10 shrink-0 drop-shadow-md rounded-full bg-[#0A1128]" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center shrink-0">
                  <span className="font-extrabold tracking-wider text-xl sm:text-2xl leading-none whitespace-nowrap inline-flex">
                    <span className="text-[#FFFFFF]">G</span>
                    <span className="text-[#F472B6]">R</span>
                    <span className="text-[#EF4444]">A</span>
                    <span className="text-[#F97316]">C</span>
                    <span className="text-[#FBBF24]">I</span>
                    <span className="text-[#F59E0B]">A</span>
                  </span>
                </div>
                <span className="text-[9px] sm:text-[9.5px] font-extrabold text-amber-400/95 tracking-wider uppercase block mt-1 leading-tight whitespace-nowrap">
                  25 YEARS OF GRACE IN SINGAPORE
                </span>
                <span className="text-[7.5px] sm:text-[8px] font-bold tracking-wide uppercase block text-rose-300/85 mt-0.5 whitespace-nowrap">
                  FAITHFUL WITNESS • JOYFUL MISSIONARY
                </span>
              </div>
            </div>

            {/* Right Delegate / Verification Pill & Pass ID Badge */}
            <div className="flex flex-col items-end gap-1 shrink-0 pl-1 self-start">
              <span
                className={`text-[9px] sm:text-[9.5px] font-mono font-black uppercase tracking-wider px-2.5 py-1 rounded-full shadow-md whitespace-nowrap ${
                  pass.isPrimary
                    ? 'bg-amber-400 text-slate-950 font-black border border-amber-300 shadow-amber-500/20'
                    : 'bg-indigo-500 text-white font-black border border-indigo-400 shadow-indigo-500/20'
                }`}
              >
                {pass.isPrimary ? 'PRIMARY DELEGATE' : `DELEGATE #${pIdx + 1}`}
              </span>
              <span className="text-[8.5px] font-mono font-bold text-amber-300 bg-black/70 px-2 py-0.5 rounded-md border border-amber-500/30 whitespace-nowrap shadow-xs">
                Pass ID: {pass.passId}
              </span>
              {isCheckedIn && (
                <span className="text-[8px] sm:text-[8.5px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 flex items-center gap-1 shadow-xs whitespace-nowrap">
                  <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" />
                  <span>Verified</span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* 3. ATTENDEE PROFILE PICTURE & NAME IDENTIFICATION */}
        <div className="flex items-center gap-3.5 pt-1">
          <div className="relative group/photo shrink-0">
            <div className="w-20 h-20 sm:w-22 sm:h-22 rounded-2xl p-0.5 bg-gradient-to-br from-amber-400 via-rose-500 to-indigo-500 shadow-xl overflow-hidden relative">
              {currentPhoto ? (
                <img
                  src={currentPhoto}
                  alt={formattedName}
                  className="w-full h-full object-cover rounded-[14px]"
                />
              ) : (
                <div className="w-full h-full rounded-[14px] bg-gradient-to-br from-[#121E42] to-[#0A1128] flex flex-col items-center justify-center text-amber-300 border border-amber-400/30">
                  <span className="font-extrabold text-2xl tracking-wider text-amber-300">
                    {getInitials(formattedName)}
                  </span>
                  <span className="text-[8px] font-mono uppercase text-slate-300/70 mt-0.5">
                    No Photo
                  </span>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={triggerFileInput}
              className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-amber-400 text-[#0A1128] border-2 border-[#0A1128] flex items-center justify-center shadow-lg hover:bg-amber-300 hover:scale-110 transition-all cursor-pointer z-10"
              title="Upload or change profile photo for pass"
            >
              <Camera className="w-3.5 h-3.5 font-bold" />
            </button>
          </div>

          <div className="space-y-1 flex-1 min-w-0">
            <h3
              className="font-extrabold text-2xl sm:text-3xl text-white tracking-wide leading-tight drop-shadow-md break-words"
              title={formattedName}
            >
              {formattedName}
            </h3>

            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
              <span className="inline-flex items-center text-[10.5px] font-bold px-2.5 py-0.5 rounded-full bg-white/10 text-white/90 border border-white/15">
                {pass.categoryLabel || (pass.isPrimary ? 'Primary Registrant' : 'Delegate Member')}
              </span>

              {pass.groupColor && (
                <span
                  className={`inline-flex items-center gap-1 text-[10.5px] font-bold px-2.5 py-0.5 rounded-full border shadow-xs ${pass.groupColor.badgeBg} ${pass.groupColor.badgeText} ${pass.groupColor.borderClass}`}
                >
                  <span>{pass.groupColor.emoji}</span>
                  <span>{pass.groupColor.name}</span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* 4. PASS DETAILS DATA GRID */}
        <div className="p-3.5 sm:p-4 rounded-2xl bg-[#111C3D]/85 backdrop-blur-md border border-slate-700/60 space-y-2 text-xs font-mono text-slate-200 shadow-inner">
          <div className="flex justify-between items-center border-b border-white/10 pb-2">
            <span className="text-slate-400 font-sans text-[11px] flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-amber-400" />
              <span>Pass ID:</span>
            </span>
            <button
              type="button"
              onClick={copyPassId}
              className="text-amber-400 hover:text-amber-300 font-extrabold text-xs tracking-wider font-mono flex items-center gap-1 bg-amber-400/10 px-2 py-0.5 rounded-md border border-amber-400/30 transition-all cursor-pointer"
              title="Click to copy Pass ID"
            >
              <span>{pass.passId}</span>
              {copiedPassId ? (
                <Check className="w-3 h-3 text-emerald-400" />
              ) : (
                <Copy className="w-3 h-3 opacity-70" />
              )}
            </button>
          </div>

          <div className="flex justify-between items-center border-b border-white/10 pb-2">
            <span className="text-slate-400 font-sans text-[11px]">Event:</span>
            <span className="text-white font-semibold font-sans">
              {isMusical ? 'Musical Concert' : 'GRACIA Jubilee Conference'}
            </span>
          </div>

          {parishName && (
            <div className="flex justify-between items-center border-b border-white/10 pb-2">
              <span className="text-slate-400 font-sans text-[11px]">Parish:</span>
              <span className="text-white/90 font-sans truncate max-w-[200px]" title={parishName}>
                {parishName}
              </span>
            </div>
          )}

          <div className="flex justify-between items-center border-b border-white/10 pb-2">
            <span className="text-slate-400 font-sans text-[11px]">Email:</span>
            <span className="text-white/90 font-mono truncate max-w-[170px] sm:max-w-[210px]" title={pass.email}>
              {pass.email}
            </span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-slate-400 font-sans text-[11px]">Assigned Seat:</span>
            <span
              className={
                isCheckedIn
                  ? 'text-emerald-300 font-bold font-sans flex items-center gap-1'
                  : 'text-amber-300 font-sans font-bold'
              }
            >
              {isCheckedIn ? '✓ Verified & Checked In' : pass.seat || 'General Admission'}
            </span>
          </div>

          {resolvedVerseText && (
            <div className="mt-2.5 pt-2 border-t border-white/10">
              <div className="text-[11px] font-serif italic text-amber-200 bg-slate-900/60 p-2.5 rounded-xl border border-slate-700/60 font-medium leading-relaxed shadow-xs flex flex-col space-y-1">
                <p>"{resolvedVerseText}"</p>
                {resolvedVerseRef && (
                  <span className="text-[10px] font-sans font-bold not-italic text-amber-400 text-right tracking-wider">
                    — {resolvedVerseRef}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* 5. QR CODE CHECK-IN SECTION */}
        {isCheckedIn ? (
          <div className="w-full py-3.5 px-4 rounded-2xl bg-emerald-950/90 border-2 border-emerald-500/80 text-center space-y-1.5 shadow-inner flex flex-col items-center justify-center">
            <div className="w-10 h-10 rounded-full bg-emerald-500/20 border-2 border-emerald-400 flex items-center justify-center text-emerald-300 shadow-md">
              <CheckCircle2 className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <div className="text-sm font-black tracking-wider uppercase text-emerald-300 font-sans">
                Successfully Checked-in
              </div>
              <p className="text-[10px] text-emerald-200/90 font-mono">
                Pass verified at venue check-in
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="bg-[#111C3D]/90 backdrop-blur-md rounded-2xl p-4 border border-slate-700/80 shadow-xl flex flex-col items-center justify-center space-y-2.5 w-full">
              <div className="p-3 bg-white rounded-xl shadow-md flex items-center justify-center">
                <QRCodeSVG
                  value={pass.passId}
                  size={165}
                  level="M"
                  bgColor="#FFFFFF"
                  fgColor="#0A1128"
                  marginSize={2}
                />
              </div>

              <div className="text-center space-y-1 w-full">
                <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-slate-400 block">
                  PASS ID / BACKUP LOOKUP TOKEN
                </span>
                <div className="font-mono font-black text-amber-300 text-sm tracking-[0.2em] bg-slate-900/90 px-4 py-1 rounded-lg border border-slate-700 inline-block shadow-inner">
                  {pass.passId}
                </div>
              </div>
            </div>

            <div className="text-[10px] font-mono text-amber-400 uppercase tracking-widest font-black text-center flex items-center justify-center gap-1.5">
              <QrCode className="w-3.5 h-3.5 text-amber-400" />
              <span>Scan QR Code or Present Pass ID at Venue Check-In</span>
            </div>
          </div>
        )}

        {/* 6. ACTION BUTTONS */}
        {showActions && (
          <div className="grid grid-cols-2 gap-2.5 pt-1 border-t border-white/10">
            {onDownloadPdf ? (
              <button
                type="button"
                onClick={() => onDownloadPdf(pass)}
                className="py-2.5 px-3 rounded-xl bg-signature-gradient hover:opacity-90 text-white font-bold tracking-wider text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-lg active:scale-95"
                title={`Download PDF Pass for ${pass.passId}`}
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Pass ({pass.passId})</span>
              </button>
            ) : (
              <div />
            )}

            {onAddToWallet && reg ? (
              <button
                type="button"
                onClick={() => onAddToWallet(reg, pass)}
                className="py-2.5 px-3 rounded-xl bg-[#131E3A] hover:bg-[#1C2C55] border border-amber-400/40 text-slate-100 font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95 shadow-md"
                title="Add member pass to digital wallet"
              >
                <Wallet className="w-3.5 h-3.5 text-amber-400" />
                <span>Add to Wallet</span>
              </button>
            ) : (
              <div />
            )}
          </div>
        )}

        {/* 7. FOOTER BRANDING */}
        <div className="text-center pt-1 border-t border-white/5">
          <p className="text-[9.5px] font-mono text-slate-400/80 tracking-wider">
            Jesus Youth Singapore • Jubilee Conference 2026
          </p>
        </div>
      </div>
    </div>
  );
};

