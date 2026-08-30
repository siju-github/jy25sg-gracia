import React, { useState, useEffect, useRef } from 'react';
import { 
  Camera, 
  QrCode, 
  Barcode,
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Search, 
  RefreshCw, 
  User, 
  Ticket, 
  Clock, 
  Upload, 
  X, 
  Sparkles,
  ShieldAlert,
  ArrowRight,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import jsQR from 'jsqr';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { BrowserMultiFormatReader, BarcodeFormat, DecodeHintType } from '@zxing/library';
import { RegistrationData, AdditionalAttendee } from '../types';
import { getBibleVersePassId, getPersonDeterministicSeed } from '../lib/bibleVerses';
import { buildExpectedAttendees } from './AdditionalAttendeesForm';
import { isDelegatePassCheckedIn, getRegistrationCheckInStats } from '../lib/utils';

interface TicketCheckInViewProps {
  registrations: RegistrationData[];
  onUpdateRegistration: (id: string, patch: Partial<RegistrationData>) => Promise<boolean>;
  adminEmail: string;
  adminName?: string;
  isTicketAdminOnly?: boolean;
}

export const TicketCheckInView: React.FC<TicketCheckInViewProps> = ({
  registrations,
  onUpdateRegistration,
  adminEmail,
  adminName,
  isTicketAdminOnly = false,
}) => {
  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'checked_in'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'musical' | 'conference'>('all');
  const [expandedRegIds, setExpandedRegIds] = useState<string[]>([]);

  // Manual QR / Ticket Code Input State
  const [manualInput, setManualInput] = useState('');

  // Live Camera Scanner State
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const isScannerRunningRef = useRef<boolean>(false);
  const codeReaderRef = useRef<BrowserMultiFormatReader | null>(null);
  const lastScannedTimeRef = useRef<number>(0);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Scan Result Feedback State
  const [scanResult, setScanResult] = useState<{
    type: 'success' | 'already_checked_in' | 'not_found' | 'error';
    message: string;
    registrant?: RegistrationData;
  } | null>(null);

  const scanResultRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll to scan result banner immediately when scanResult updates
  useEffect(() => {
    if (scanResult && scanResultRef.current) {
      scanResultRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [scanResult]);

  const [isProcessingCheckIn, setIsProcessingCheckIn] = useState(false);

  // Helper to normalize strings for robust barcode comparison
  const cleanStr = (s: string) => (s ? String(s).replace(/[^a-zA-Z0-9]/g, '').toLowerCase() : '');

  // Reset scan state, start camera if requested, and smoothly scroll viewport up to scanner controls
  const scrollToScannerAndReset = (startCamera: boolean = true) => {
    setScanResult(null);
    setManualInput('');
    primeAudioContext();
    if (startCamera) {
      setIsCameraActive(true);
    }
    setTimeout(() => {
      const scannerElem = document.getElementById('barcode-scanner-top');
      if (scannerElem) {
        scannerElem.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 60);
  };

  const handleDismissResult = () => {
    setScanResult(null);
    setTimeout(() => {
      const scannerElem = document.getElementById('barcode-scanner-top');
      if (scannerElem) {
        scannerElem.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 60);
  };

  // Initialize and prime Web Audio context immediately on user tap / action to bypass browser autoplay restrictions
  const primeAudioContext = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioCtx();
      }
      if (audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume();
      }
    } catch (e) {
      console.warn('Could not initialize AudioContext on user gesture:', e);
    }
  };

  // Safe stop helper for html5-qrcode instance
  const safeStopScanner = async () => {
    if (html5QrCodeRef.current && isScannerRunningRef.current) {
      isScannerRunningRef.current = false;
      try {
        await html5QrCodeRef.current.stop();
      } catch (e) {
        console.warn('Html5Qrcode safe stop warning:', e);
      }
      try {
        html5QrCodeRef.current.clear();
      } catch (e) {
        console.warn('Html5Qrcode safe clear warning:', e);
      }
      html5QrCodeRef.current = null;
    }
  };

  // Sound effect / Audio feedback simulation using Web Audio API
  const playBeep = (type: 'success' | 'warning' | 'error') => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioCtx();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      if (type === 'success') {
        if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
          try { window.navigator.vibrate([100, 50, 100]); } catch (e) {}
        }

        const notes = [523.25, 659.25, 783.99, 1046.50];
        notes.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.08);
          gain.gain.setValueAtTime(0.35, ctx.currentTime + idx * 0.08);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.08 + 0.15);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(ctx.currentTime + idx * 0.08);
          osc.stop(ctx.currentTime + idx * 0.08 + 0.15);
        });
      } else if (type === 'warning') {
        [320, 200, 160].forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.12);
          gain.gain.setValueAtTime(0.4, ctx.currentTime + idx * 0.12);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.12 + 0.14);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(ctx.currentTime + idx * 0.12);
          osc.stop(ctx.currentTime + idx * 0.12 + 0.14);
        });
      } else {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(180, ctx.currentTime);
        osc.frequency.setValueAtTime(120, ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.45, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.38);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.38);
      }
    } catch (e) {
      console.error('Audio beep error:', e);
    }
  };

  // Process QR String, 1D Barcode, or Ticket ID safely
  const processScanPayload = async (rawPayload: string) => {
    let trimmed = (rawPayload || '').trim();
    if (!trimmed) return;

    setIsProcessingCheckIn(true);
    setScanResult(null);

    try {
      // 1. Extract query parameter if rawPayload is a full URL (e.g. https://.../?passId=JOHN-3:16-SG)
      if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
        try {
          const urlObj = new URL(trimmed);
          const passIdParam = urlObj.searchParams.get('passId') || urlObj.searchParams.get('ticketId') || urlObj.searchParams.get('id') || urlObj.searchParams.get('code');
          if (passIdParam) {
            trimmed = passIdParam.trim();
          }
        } catch (e) {
          // Keep raw string if URL parsing fails
        }
      }

      let parsedTicketId = '';
      let parsedEmail = '';
      let parsedName = '';

      // 2. Check if JSON payload from 2D QR Code
      if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || trimmed.includes('"ticketId"') || trimmed.includes('"passId"')) {
        try {
          const obj = JSON.parse(trimmed);
          parsedTicketId = String(obj.ticketId || obj.passId || obj.id || '').trim();
          parsedEmail = String(obj.email || '').trim();
          parsedName = String(obj.name || '').trim();
        } catch (e) {
          // Not valid JSON, fallback to raw string
        }
      }

      const trimmedNorm = cleanStr(trimmed);
      const parsedIdNorm = parsedTicketId ? cleanStr(parsedTicketId) : '';

      // 3. Search for matching registration safely across Conference & Concert records
      const match = registrations.find(r => {
        if (!r) return false;
        
        // Primary Bible Verse Pass ID (e.g. GRACIA-SIJU-ROM-12:2)
        const primaryPersonSeed = getPersonDeterministicSeed(r.email, r.phone, r.name);
        const primaryVerse = r.passId || getBibleVersePassId(primaryPersonSeed || r.id || '', 0, r.name || '');
        const primaryVerseNorm = cleanStr(primaryVerse);

        const verseMatch = (primaryVerse.toLowerCase() === trimmed.toLowerCase()) ||
                           (primaryVerseNorm && primaryVerseNorm === trimmedNorm) ||
                           (parsedTicketId && primaryVerse.toLowerCase() === parsedTicketId.toLowerCase()) ||
                           (parsedIdNorm && primaryVerseNorm === parsedIdNorm);

        // Direct Firestore Registration Document ID or Pass ID
        const rIdNorm = r.id ? cleanStr(r.id) : '';
        const idMatch = (r.id && (r.id === trimmed || r.id === parsedTicketId || trimmed.startsWith(r.id))) ||
                        (rIdNorm && (rIdNorm === trimmedNorm || (parsedIdNorm && parsedIdNorm === rIdNorm))) ||
                        (r.passId && (r.passId.toLowerCase() === trimmed.toLowerCase() || (parsedTicketId && r.passId.toLowerCase() === parsedTicketId.toLowerCase())));

        // Email Match
        const rEmail = r.email ? r.email.toLowerCase() : '';
        const emailMatch = (rEmail && rEmail === trimmed.toLowerCase()) ||
                           (parsedEmail && rEmail && rEmail === parsedEmail.toLowerCase());

        // Phone Match
        const phoneDigits = r.phone ? String(r.phone).replace(/[^0-9]/g, '') : '';
        const trimmedDigits = trimmed.replace(/[^0-9]/g, '');
        const phoneMatch = phoneDigits.length >= 7 && trimmedDigits.length >= 7 && phoneDigits.includes(trimmedDigits);

        // Name Match
        const rName = r.name ? r.name.toLowerCase() : '';
        const nameMatch = (rName && rName === trimmed.toLowerCase()) ||
                          (parsedName && rName && rName === parsedName.toLowerCase());

        // Selected Seats Match
        const seatMatch = Array.isArray(r.selectedSeats) && r.selectedSeats.some(s => {
          if (!s) return false;
          const sStr = String(s).toLowerCase();
          return sStr === trimmed.toLowerCase() || 
                 cleanStr(sStr) === trimmedNorm ||
                 `row ${sStr.split('-')[0]} seat ${sStr.split('-')[1]}` === trimmed.toLowerCase();
        });

        // Invitation Code / Code ID match
        const invCode = r.invitation_code ? r.invitation_code.toLowerCase() : '';
        const invCodeId = r.invitation_code_id ? r.invitation_code_id.toLowerCase() : '';
        const invMatch = (invCode && (invCode === trimmed.toLowerCase() || cleanStr(invCode) === trimmedNorm)) ||
                         (invCodeId && (invCodeId === trimmed.toLowerCase() || cleanStr(invCodeId) === trimmedNorm));

        // Additional Attendees / Family Members match
        const addonMatch = Array.isArray(r.additionalAttendees) && r.additionalAttendees.some((a, aIdx) => {
          if (!a) return false;
          const aName = a.name ? String(a.name) : '';
          const aEmail = a.email ? String(a.email) : '';
          const addonSeed = getPersonDeterministicSeed(a.email, a.phone, a.name) || `${primaryPersonSeed}_ADD_${aIdx + 1}_${aName.toLowerCase()}`;
          const addonVerse = a.passId || getBibleVersePassId(addonSeed || r.id || '', aIdx + 1, aName);
          const addonVerseNorm = cleanStr(addonVerse);
          const aNameNorm = cleanStr(aName);

          return (addonVerse.toLowerCase() === trimmed.toLowerCase()) ||
                 (addonVerseNorm && addonVerseNorm === trimmedNorm) ||
                 (parsedTicketId && addonVerse.toLowerCase() === parsedTicketId.toLowerCase()) ||
                 (parsedIdNorm && addonVerseNorm === parsedIdNorm) ||
                 (aName && (aName.toLowerCase() === trimmed.toLowerCase() || (parsedName && aName.toLowerCase() === parsedName.toLowerCase()))) ||
                 (aNameNorm && aNameNorm === trimmedNorm) ||
                 (aEmail && (aEmail.toLowerCase() === trimmed.toLowerCase() || (parsedEmail && aEmail.toLowerCase() === parsedEmail.toLowerCase()))) ||
                 (a.passId && (a.passId.toLowerCase() === trimmed.toLowerCase() || (parsedTicketId && a.passId.toLowerCase() === parsedTicketId.toLowerCase())));
        });

        return verseMatch || idMatch || emailMatch || phoneMatch || nameMatch || seatMatch || invMatch || addonMatch;
      });

      if (!match) {
        playBeep('error');
        setScanResult({
          type: 'not_found',
          message: `No active ticket or registrant found matching "${trimmed}". Please double-check ticket code or search by registrant name.`,
        });
        setIsProcessingCheckIn(false);
        return;
      }

      // Identify primary deterministic pass ID
      const primaryPersonSeed = getPersonDeterministicSeed(match.email, match.phone, match.name);
      const primaryPassId = match.passId || getBibleVersePassId(primaryPersonSeed || match.id || '', 0, match.name || '');

      // Identify specific attendee scanned or pass ID
      let matchedAddon: AdditionalAttendee | undefined = undefined;
      let matchedDelegatePassId = primaryPassId;
      let isAddon = false;

      if (Array.isArray(match.additionalAttendees)) {
        for (let aIdx = 0; aIdx < match.additionalAttendees.length; aIdx++) {
          const a = match.additionalAttendees[aIdx];
          if (!a || !a.name) continue;
          const addonSeed = getPersonDeterministicSeed(a.email, a.phone, a.name) || `${primaryPersonSeed}_ADD_${aIdx + 1}_${a.name.toLowerCase()}`;
          const aPassId = a.passId || getBibleVersePassId(addonSeed, aIdx + 1, a.name);
          const aName = a.name.toLowerCase().trim();
          const aEmail = (a.email || '').toLowerCase().trim();

          if (
            (trimmed && (
              trimmed.toLowerCase() === aPassId.toLowerCase() ||
              (a.passId && trimmed.toLowerCase() === a.passId.toLowerCase()) ||
              trimmed.toLowerCase() === aName ||
              (aEmail && trimmed.toLowerCase() === aEmail)
            )) ||
            (parsedTicketId && (
              parsedTicketId.toLowerCase() === aPassId.toLowerCase() ||
              (a.passId && parsedTicketId.toLowerCase() === a.passId.toLowerCase())
            )) ||
            (parsedName && parsedName.toLowerCase() === aName)
          ) {
            matchedAddon = a;
            matchedDelegatePassId = aPassId;
            isAddon = true;
            break;
          }
        }
      }

      const specificPassKey = matchedDelegatePassId;
      const checkInGreetingName = matchedAddon ? `${matchedAddon.name} (${matchedAddon.categoryLabel || matchedAddon.category || 'Guest'})` : match.name;

      // Identify tagged dependents (Pre-teens, Kids, Toddlers)
      const taggedDependents = (Array.isArray(match.additionalAttendees) ? match.additionalAttendees : []).filter(a => {
        if (!a) return false;
        const cat = a.category ? String(a.category).toLowerCase() : '';
        const catLabel = a.categoryLabel ? String(a.categoryLabel).toLowerCase() : '';
        return cat === 'preteen' || cat === 'child' || catLabel.includes('preteen') || catLabel.includes('child') || catLabel.includes('pre-teen');
      });

      const depNote = taggedDependents.length > 0 
        ? ` • Tagged Dependents (Included): ${taggedDependents.map(d => `${d.name} (${d.categoryLabel || d.category || 'Guest'})`).join(', ')}`
        : '';

      const existingScannedPasses = Array.isArray(match.scannedPassIds) ? match.scannedPassIds : [];
      const isSingleAttendee = (!match.additionalAttendees || match.additionalAttendees.length === 0);
      
      let isSpecificPassAlreadyScanned = false;
      if (isSingleAttendee) {
        isSpecificPassAlreadyScanned = Boolean(
          (match.checkedIn && existingScannedPasses.length === 0) ||
          existingScannedPasses.some(p => 
            p.toLowerCase() === matchedDelegatePassId.toLowerCase() ||
            p.toLowerCase() === trimmed.toLowerCase() ||
            p === match.id ||
            p === 'primary'
          )
        );
      } else {
        isSpecificPassAlreadyScanned = existingScannedPasses.some(p => {
          const lower = p.toLowerCase();
          if (lower === matchedDelegatePassId.toLowerCase()) return true;
          if (trimmed && lower === trimmed.toLowerCase()) return true;
          if (parsedTicketId && lower === parsedTicketId.toLowerCase()) return true;
          if (isAddon && matchedAddon) {
            if (matchedAddon.id && p === matchedAddon.id) return true;
            if (p === `${match.id}-PAX-${matchedAddon.id || matchedAddon.name}`) return true;
          } else {
            if (p === match.id || p === 'primary' || p === `${match.id}-PAX-primary`) return true;
          }
          return false;
        });
      }

      // CHECK IF PASS IS INVALIDATED / REVOKED
      const isPassRevoked = match.isPassInvalid === true || 
        (Array.isArray(match.invalidatedPassIds) && (
          match.invalidatedPassIds.includes(trimmed) || 
          match.invalidatedPassIds.includes(specificPassKey) ||
          match.invalidatedPassIds.includes(matchedDelegatePassId) ||
          match.invalidatedPassIds.includes(match.id || '') ||
          (parsedTicketId && match.invalidatedPassIds.includes(parsedTicketId))
        ));

      if (isPassRevoked) {
        playBeep('error');
        setScanResult({
          type: 'error',
          message: `⛔ SCAN REJECTED: THIS PASS IS INVALID / REVOKED! Super Admin has flagged this Pass ID as invalid (${match.invalidPassReason || 'Revoked / Suspended'}). Entry is not permitted.`,
          registrant: match
        });
        setIsProcessingCheckIn(false);
        return;
      }

      // CHECK IF ALREADY SCANNED (ENFORCE SINGLE SCAN ONLY PER ATTENDEE)
      if (isSpecificPassAlreadyScanned) {
        playBeep('warning');
        const timeStr = match.checkedInAt 
          ? new Date(match.checkedInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          : 'earlier today';
        const byUser = match.checkedInBy || 'Admin';

        setScanResult({
          type: 'already_checked_in',
          message: `⛔ SCAN REJECTED: THIS QR CODE HAS ALREADY BEEN SCANNED ONCE! Single-use pass policy enforced. Ticket for ${checkInGreetingName} (Main Contact: ${match.name}) was verified at ${timeStr} by ${byUser}.${depNote}`,
          registrant: match
        });
        setIsProcessingCheckIn(false);
        return;
      }

      // MARK AS SCANNED & CHECKED IN (1ST SCAN ONLY)
      const nowIso = new Date().toISOString();
      
      // Build comprehensive list of all pass IDs for this entire pass record
      const updatedPasses = Array.from(new Set([
        'all',
        'primary',
        ...(existingScannedPasses || []),
        matchedDelegatePassId,
        trimmed,
        parsedTicketId,
        match.id ? `${match.id}-all` : '',
        match.id ? `${match.id}-PAX-primary` : '',
        match.id || '',
        match.passId || '',
        primaryPassId || '',
        match.name ? match.name.toLowerCase().trim() : '',
        match.email ? match.email.toLowerCase().trim() : '',
        ...(Array.isArray(match.additionalAttendees) ? match.additionalAttendees.flatMap((a, aIdx) => {
          if (!a) return [];
          const aName = a.name ? a.name.toLowerCase().trim() : '';
          const addonSeed = getPersonDeterministicSeed(a.email, a.phone, a.name) || `${primaryPersonSeed}_ADD_${aIdx + 1}_${aName}`;
          const aPassId = a.passId || getBibleVersePassId(addonSeed, aIdx + 1, a.name);
          return [
            aPassId,
            a.passId || '',
            a.id || '',
            match.id ? `${match.id}-PAX-${a.id || aName}` : '',
            match.id ? `${match.id}-PAX-${aPassId}` : '',
            aName,
            a.email ? a.email.toLowerCase().trim() : ''
          ];
        }) : [])
      ].filter(Boolean)));

      const success = await onUpdateRegistration(match.id!, {
        checkedIn: true,
        checkedInAt: nowIso,
        checkedInBy: adminName ? `${adminName} (${adminEmail})` : adminEmail,
        scannedPassIds: updatedPasses
      });

      if (success) {
        playBeep('success');
        setScanResult({
          type: 'success',
          message: `✅ CHECK-IN VERIFIED (1st Scan Complete): Welcome, ${checkInGreetingName}! Ticket marked as USED and locked against re-use.${matchedAddon ? ` (Main Contact: ${match.name})` : ''}${depNote}`,
          registrant: {
            ...match,
            checkedIn: true,
            checkedInAt: nowIso,
            checkedInBy: adminName ? `${adminName} (${adminEmail})` : adminEmail,
            scannedPassIds: updatedPasses
          }
        });
        setManualInput('');
      } else {
        playBeep('error');
        setScanResult({
          type: 'error',
          message: 'Failed to update check-in status. Please verify network connection.',
        });
      }
    } catch (err: any) {
      console.error("Error processing scan payload:", err);
      playBeep('error');
      setScanResult({
        type: 'error',
        message: `Scan Processing Error: ${err?.message || 'An unexpected error occurred'}. Please try scanning again or look up by name.`,
      });
    } finally {
      setIsProcessingCheckIn(false);
    }
  };

  // Camera QR Scanner using html5-qrcode (strictly QR_CODE decoding format with 250x250px viewfinder)
  useEffect(() => {
    let html5QrCode: Html5Qrcode | null = null;

    if (isCameraActive) {
      setCameraError(null);

      const scannerId = "html5-qr-code-scanner-viewfinder";
      
      try {
        html5QrCode = new Html5Qrcode(scannerId, {
          formatsToSupport: [ Html5QrcodeSupportedFormats.QR_CODE ],
          verbose: false
        });
        html5QrCodeRef.current = html5QrCode;
        isScannerRunningRef.current = true;

        html5QrCode.start(
          { facingMode: "environment" },
          {
            fps: 15,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0,
          },
          (decodedText) => {
            const now = Date.now();
            if (now - lastScannedTimeRef.current > 2000) {
              lastScannedTimeRef.current = now;
              
              // Cleanly stop scanner before unmounting viewfinder element
              if (html5QrCodeRef.current && isScannerRunningRef.current) {
                isScannerRunningRef.current = false;
                const activeScanner = html5QrCodeRef.current;
                html5QrCodeRef.current = null;

                activeScanner.stop().then(() => {
                  try { activeScanner.clear(); } catch (e) {}
                  setIsCameraActive(false);
                  setTimeout(() => {
                    processScanPayload(decodedText);
                  }, 80);
                }).catch((stopErr) => {
                  console.warn("Camera stop warning:", stopErr);
                  setIsCameraActive(false);
                  setTimeout(() => {
                    processScanPayload(decodedText);
                  }, 80);
                });
              } else {
                setIsCameraActive(false);
                setTimeout(() => {
                  processScanPayload(decodedText);
                }, 80);
              }
            }
          },
          (errorMessage) => {
            // Scan frame without QR code - silent
          }
        ).catch((err) => {
          console.error("Html5Qrcode camera access error:", err);
          setCameraError("Unable to access camera or start scanner. Please grant camera permissions or use manual search.");
          isScannerRunningRef.current = false;
          setIsCameraActive(false);
        });
      } catch (e: any) {
        console.error("Html5Qrcode instantiation error:", e);
        setCameraError("Failed to initialize camera scanner. Please use manual search.");
        setIsCameraActive(false);
      }
    }

    return () => {
      safeStopScanner();
    };
  }, [isCameraActive]);

  const tickScan = async () => {
    if (!isCameraActive) return;

    if (videoRef.current && videoRef.current.readyState >= videoRef.current.HAVE_CURRENT_DATA) {
      const video = videoRef.current;
      if (video.videoWidth > 0 && video.videoHeight > 0) {
        // Optimize canvas dimensions for multi-format decoding (max 960px width)
        const maxDim = 960;
        let scale = 1;
        if (video.videoWidth > maxDim || video.videoHeight > maxDim) {
          scale = Math.min(maxDim / video.videoWidth, maxDim / video.videoHeight);
        }

        const canvas = canvasRef.current || document.createElement('canvas');
        canvas.width = Math.floor(video.videoWidth * scale);
        canvas.height = Math.floor(video.videoHeight * scale);
        const ctx = canvas.getContext('2d', { willReadFrequently: true });

        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

          let detectedText: string | null = null;

          // 1. Try ZXing MultiFormatReader (Supports CODE128, CODE39, EAN, QR Code, PDF417, etc.)
          if (codeReaderRef.current) {
            try {
              const result = (codeReaderRef.current as any).decodeFromCanvas(canvas);
              if (result && result.getText()) {
                detectedText = result.getText();
              }
            } catch (e) {
              // Expected when frame contains no barcode
            }
          }

          // 2. Try Native BarcodeDetector API if present and ZXing didn't catch it
          if (!detectedText && 'BarcodeDetector' in window) {
            try {
              const detector = new (window as any).BarcodeDetector({
                formats: ['code_128', 'code_39', 'qr_code', 'ean_13', 'pdf417']
              });
              const barcodes = await detector.detect(canvas);
              if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
                detectedText = barcodes[0].rawValue;
              }
            } catch (e) {
              // Ignore
            }
          }

          // 3. Try jsQR for 2D QR Code as high-contrast fallback
          if (!detectedText) {
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            let code = jsQR(imageData.data, imageData.width, imageData.height, {
              inversionAttempts: 'dontInvert',
            });
            if (!code || !code.data) {
              code = jsQR(imageData.data, imageData.width, imageData.height, {
                inversionAttempts: 'onlyInvert',
              });
            }
            if (code && code.data) {
              detectedText = code.data;
            }
          }

          if (detectedText) {
            const now = Date.now();
            if (now - lastScannedTimeRef.current > 1500) {
              lastScannedTimeRef.current = now;
              setIsCameraActive(false);
              processScanPayload(detectedText);
              return;
            }
          }
        }
      }
    }

    if (isCameraActive) {
      // Throttle scan ticks to ~18-20 FPS for optimal CPU & decoding performance
      setTimeout(() => {
        if (isCameraActive) {
          animFrameRef.current = requestAnimationFrame(tickScan);
        }
      }, 55);
    }
  };

  // File Upload Barcode & QR Reader
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = async () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);

          let detectedText: string | null = null;

          // 1. Try ZXing MultiFormat Reader
          if (!codeReaderRef.current) {
            const hints = new Map();
            hints.set(DecodeHintType.POSSIBLE_FORMATS, [
              BarcodeFormat.CODE_128,
              BarcodeFormat.CODE_39,
              BarcodeFormat.QR_CODE,
              BarcodeFormat.EAN_13,
              BarcodeFormat.EAN_8,
              BarcodeFormat.PDF_417,
              BarcodeFormat.DATA_MATRIX,
              BarcodeFormat.UPC_A,
              BarcodeFormat.UPC_E,
              BarcodeFormat.ITF,
            ]);
            hints.set(DecodeHintType.TRY_HARDER, true);
            codeReaderRef.current = new BrowserMultiFormatReader(hints);
          }

          if (codeReaderRef.current) {
            try {
              const result = (codeReaderRef.current as any).decodeFromCanvas(canvas);
              if (result && result.getText()) {
                detectedText = result.getText();
              }
            } catch (e) {
              // Ignore
            }
          }

          // 2. Try Native BarcodeDetector
          if (!detectedText && 'BarcodeDetector' in window) {
            try {
              const detector = new (window as any).BarcodeDetector({
                formats: ['code_128', 'code_39', 'qr_code', 'ean_13', 'pdf417']
              });
              const barcodes = await detector.detect(canvas);
              if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
                detectedText = barcodes[0].rawValue;
              }
            } catch (e) {
              // Ignore
            }
          }

          // 3. Try jsQR
          if (!detectedText) {
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            let code = jsQR(imageData.data, imageData.width, imageData.height, {
              inversionAttempts: 'dontInvert',
            });
            if (!code || !code.data) {
              code = jsQR(imageData.data, imageData.width, imageData.height, {
                inversionAttempts: 'attemptBoth',
              });
            }
            if (code && code.data) {
              detectedText = code.data;
            }
          }

          if (detectedText) {
            processScanPayload(detectedText);
          } else {
            playBeep('error');
            setScanResult({
              type: 'not_found',
              message: 'No readable 1D Barcode or 2D QR Code detected in uploaded image. Please ensure the code is clearly visible.',
            });
          }
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Toggle Check In / Out manually from table
  const handleToggleCheckIn = async (reg: RegistrationData) => {
    if (!reg.id) return;
    setIsProcessingCheckIn(true);
    setScanResult(null);

    const newCheckedIn = !reg.checkedIn;
    const nowIso = new Date().toISOString();

    const personSeed = getPersonDeterministicSeed(reg.email, reg.phone, reg.name);
    const primaryPassId = reg.passId || getBibleVersePassId(personSeed || reg.id, 0, reg.name);

    let updatedScanned: string[] = [];
    if (newCheckedIn) {
      updatedScanned.push(primaryPassId);
      updatedScanned.push('primary');
      updatedScanned.push(`${reg.id}-PAX-primary`);
      if (reg.id) updatedScanned.push(reg.id);
      if (reg.name) updatedScanned.push(reg.name.toLowerCase().trim());

      let attendeesList = Array.isArray(reg.additionalAttendees) ? [...reg.additionalAttendees] : [];
      const expected = buildExpectedAttendees(
        reg.adultsCount ?? 0,
        reg.teensCount || 0,
        reg.preteensCount || 0,
        reg.childrenCount || 0,
        attendeesList,
        reg.kidsCount || 0,
        reg.toddlersCount || 0
      );
      if (expected.length > attendeesList.length) {
        attendeesList = expected;
      }

      attendeesList.forEach((addon, idx) => {
        const formattedName = (addon.name && addon.name.trim()) ? addon.name.trim() : (addon.categoryLabel || `Attendee #${idx + 2}`);
        const addonSeed = getPersonDeterministicSeed(addon.email, addon.phone, formattedName) || `${personSeed}_ADD_${idx + 1}_${(addon.id || formattedName).toLowerCase()}`;
        const addonPassId = addon.passId || getBibleVersePassId(addonSeed, idx + 1, formattedName);
        updatedScanned.push(addonPassId);
        updatedScanned.push(`${reg.id}-PAX-${formattedName}`);
        updatedScanned.push(`${reg.id}-PAX-${addonPassId}`);
        if (addon.id) updatedScanned.push(addon.id);
        updatedScanned.push(formattedName.toLowerCase().trim());
      });
      updatedScanned = Array.from(new Set(updatedScanned));
    } else {
      updatedScanned = [];
    }

    const success = await onUpdateRegistration(reg.id, {
      checkedIn: newCheckedIn,
      checkedInAt: newCheckedIn ? nowIso : undefined,
      checkedInBy: newCheckedIn ? (adminName ? `${adminName} (${adminEmail})` : adminEmail) : undefined,
      scannedPassIds: updatedScanned
    });

    if (success) {
      playBeep(newCheckedIn ? 'success' : 'warning');
      setScanResult({
        type: newCheckedIn ? 'success' : 'not_found',
        message: newCheckedIn 
          ? `Check-In Confirmed for ${reg.name}!` 
          : `Check-In reversed for ${reg.name}. Status reset to pending.`,
        registrant: {
          ...reg,
          checkedIn: newCheckedIn,
          checkedInAt: newCheckedIn ? nowIso : undefined,
          checkedInBy: newCheckedIn ? (adminName ? `${adminName} (${adminEmail})` : adminEmail) : undefined,
          scannedPassIds: updatedScanned
        }
      });
    }
    setIsProcessingCheckIn(false);
  };

  // Helper to extract all individual delegate passes for a registration
  const getDelegatesForReg = (reg: RegistrationData) => {
    const personSeed = getPersonDeterministicSeed(reg.email, reg.phone, reg.name);
    const primaryPassId = reg.passId || getBibleVersePassId(personSeed || reg.id, 0, reg.name);

    const delegates = [
      {
        id: reg.id || 'primary',
        passId: primaryPassId,
        name: reg.name,
        category: reg.categoryLabel || (reg.type === 'conference' ? 'Adult/Youth' : 'Audience'),
        isPrimary: true,
        seat: reg.selectedSeats?.[0] || 'General Admission',
        isCheckedIn: isDelegatePassCheckedIn(reg, primaryPassId, reg.name, true, reg.id)
      }
    ];

    if (Array.isArray(reg.additionalAttendees)) {
      reg.additionalAttendees.forEach((att, idx) => {
        if (!att || !att.name) return;
        const attSeed = getPersonDeterministicSeed(att.email, att.phone, att.name) || `${personSeed}_ADD_${idx + 1}_${att.name.trim().toLowerCase()}`;
        const attPassId = att.passId || getBibleVersePassId(attSeed, idx + 1, att.name);
        delegates.push({
          id: att.id || `${reg.id}-att-${idx}`,
          passId: attPassId,
          name: att.name,
          category: att.categoryLabel || att.category || `Attendee ${idx + 2}`,
          isPrimary: false,
          seat: reg.selectedSeats?.[idx + 1] || 'General Admission',
          isCheckedIn: isDelegatePassCheckedIn(reg, attPassId, att.name, false, att.id)
        });
      });
    }

    return delegates;
  };

  // Toggle individual delegate pass check-in status
  const handleToggleDelegateCheckIn = async (
    reg: RegistrationData,
    passId: string,
    currentlyCheckedIn: boolean,
    delegateName?: string
  ) => {
    if (!reg.id) return;
    setIsProcessingCheckIn(true);
    try {
      const delegates = getDelegatesForReg(reg);
      const personSeed = getPersonDeterministicSeed(reg.email, reg.phone, reg.name);
      const primaryPassId = reg.passId || getBibleVersePassId(personSeed || reg.id, 0, reg.name);
      const isTargetPrimary = passId.toLowerCase() === primaryPassId.toLowerCase() || passId === reg.id || (delegateName && delegateName.toLowerCase().trim() === reg.name.toLowerCase().trim());

      let updatedScanned: string[] = [];

      delegates.forEach(del => {
        const isMatch = del.passId.toLowerCase() === passId.toLowerCase() ||
                        (delegateName && del.name.toLowerCase().trim() === delegateName.toLowerCase().trim()) ||
                        (isTargetPrimary && del.isPrimary);

        const shouldBeCheckedIn = isMatch ? !currentlyCheckedIn : del.isCheckedIn;

        if (shouldBeCheckedIn) {
          updatedScanned.push(del.passId);
          if (del.isPrimary) {
            updatedScanned.push('primary');
            updatedScanned.push(`${reg.id}-PAX-primary`);
            if (reg.id) updatedScanned.push(reg.id);
            if (reg.name) updatedScanned.push(reg.name.toLowerCase().trim());
          } else {
            updatedScanned.push(`${reg.id}-PAX-${del.name}`);
            updatedScanned.push(`${reg.id}-PAX-${del.passId}`);
            if (del.id) updatedScanned.push(del.id);
            if (del.name) updatedScanned.push(del.name.toLowerCase().trim());
          }
        }
      });

      updatedScanned = Array.from(new Set(updatedScanned));
      const overallCheckedIn = updatedScanned.length > 0;
      const nowIso = new Date().toISOString();

      const success = await onUpdateRegistration(reg.id, {
        checkedIn: overallCheckedIn,
        checkedInAt: !currentlyCheckedIn ? nowIso : (overallCheckedIn ? reg.checkedInAt : undefined),
        checkedInBy: adminName ? `${adminName} (${adminEmail})` : adminEmail,
        scannedPassIds: updatedScanned
      });

      if (success) {
        playBeep(!currentlyCheckedIn ? 'success' : 'warning');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsProcessingCheckIn(false);
    }
  };

  const toggleRowExpanded = (regId: string) => {
    setExpandedRegIds(prev =>
      prev.includes(regId) ? prev.filter(id => id !== regId) : [...prev, regId]
    );
  };

  // Filter out sub-pass records (isAdditionalAttendee) to use primary bookings as canonical source
  const primaryRegistrations = registrations.filter(r => !r.isAdditionalAttendee);
  const effectiveRegistrations = primaryRegistrations.length > 0 ? primaryRegistrations : registrations;

  // Filtered registrations for attendee table
  const filteredList = effectiveRegistrations.filter(r => {
    const q = searchQuery.toLowerCase().trim();
    const matchesDelegates = q ? (
      r.additionalAttendees?.some(a => 
        (a.name && a.name.toLowerCase().includes(q)) || 
        (a.email && a.email.toLowerCase().includes(q)) ||
        (a.passId && a.passId.toLowerCase().includes(q))
      )
    ) : false;

    const matchesSearch = !q ||
      r.name.toLowerCase().includes(q) ||
      r.email.toLowerCase().includes(q) ||
      r.phone.includes(q) ||
      (r.id && r.id.toLowerCase().includes(q)) ||
      (r.passId && r.passId.toLowerCase().includes(q)) ||
      (r.selectedSeats && r.selectedSeats.some(s => s.toLowerCase().includes(q))) ||
      matchesDelegates;

    const matchesStatus = 
      statusFilter === 'all' ||
      (statusFilter === 'checked_in' && r.checkedIn) ||
      (statusFilter === 'pending' && !r.checkedIn);

    const matchesType = 
      typeFilter === 'all' ||
      r.type === typeFilter;

    return matchesSearch && matchesStatus && matchesType;
  });

  // Calculate Metrics across all delegate passes without double-counting sub-pass documents
  let totalPassesCount = 0;
  let totalCheckedInPassesCount = 0;

  effectiveRegistrations.forEach(r => {
    const dels = getDelegatesForReg(r);
    totalPassesCount += dels.length;
    totalCheckedInPassesCount += dels.filter(d => d.isCheckedIn).length;
  });

  const totalCount = totalPassesCount || effectiveRegistrations.length;
  const checkedInCount = totalCheckedInPassesCount;
  const pendingCount = Math.max(totalCount - checkedInCount, 0);
  const percentCheckedIn = totalCount > 0 ? Math.round((checkedInCount / totalCount) * 100) : 0;

  return (
    <div className="space-y-6 animate-fade-in text-white">
      {/* SCANNER CONTROLS CARD - TOP OF PAGE FOR EASY TICKET ADMIN ACCESS */}
      <div id="barcode-scanner-top" className="bg-[#1C0D1E] border-2 border-amber-500/60 rounded-3xl p-6 shadow-2xl space-y-5">
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center space-x-2.5">
            <Barcode className="w-7 h-7 text-amber-400" />
            <div>
              <h3 className="font-poster text-xl sm:text-2xl text-white tracking-wide">
                GRACIA - SCAN QR CODE
              </h3>
            </div>
          </div>
          <span className="text-[11px] text-[#E8B400] font-mono font-bold bg-amber-500/20 px-3 py-1 rounded-full border border-amber-500/40 shrink-0">
            Scanner Ready
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* CAMERA SCANNER BOX - 250x250px Viewfinder strictly for QR_CODE format */}
          <div className="bg-black/60 border border-white/15 rounded-2xl p-5 flex flex-col items-center justify-center text-center relative min-h-[280px]">
            {isCameraActive ? (
              <div className="space-y-3 flex flex-col items-center w-full">
                <div className="relative w-[250px] h-[250px] bg-black rounded-2xl overflow-hidden border-2 border-amber-400 shadow-2xl flex items-center justify-center mx-auto">
                  <div id="html5-qr-code-scanner-viewfinder" className="w-[250px] h-[250px]" />
                </div>
                <button
                  type="button"
                  onClick={() => setIsCameraActive(false)}
                  className="px-4 py-2 rounded-xl bg-red-600/90 hover:bg-red-500 text-white font-bold text-xs flex items-center space-x-1.5 cursor-pointer shadow-lg transition-all"
                >
                  <X className="w-4 h-4" />
                  <span>Stop Camera Scanner</span>
                </button>
              </div>
            ) : (
              <div className="space-y-4 max-w-sm">
                <div className="w-16 h-16 rounded-2xl bg-amber-500/20 border border-amber-400/50 flex items-center justify-center text-amber-400 mx-auto">
                  <QrCode className="w-9 h-9" />
                </div>
                <div>
                  <h4 className="font-bold text-white text-base">Live QR Code Scanner</h4>
                  <p className="text-xs text-white/70 mt-1">
                    Point camera at attendee pass QR Code for automatic instant venue check-in (250x250px viewfinder).
                  </p>
                </div>
                {cameraError && (
                  <p className="text-xs text-red-400 bg-red-950/60 p-2.5 rounded-xl border border-red-500/30">
                    {cameraError}
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => {
                    primeAudioContext();
                    setIsCameraActive(true);
                  }}
                  className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs tracking-wider uppercase transition-all shadow-lg flex items-center justify-center space-x-2 cursor-pointer active:scale-98"
                >
                  <Camera className="w-4 h-4" />
                  <span>START QR CODE CAMERA SCANNER</span>
                </button>
              </div>
            )}
          </div>

          {/* MANUAL INPUT & FILE UPLOAD */}
          <div className="space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <label className="block text-xs font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                <Search className="w-4 h-4 text-amber-400" />
                <span>Manual Volunteer Search / Pass ID Lookup</span>
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    placeholder="Search by Pass ID (PSALM-...), Name, Email, or Phone..."
                    value={manualInput || ''}
                    onChange={(e) => setManualInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        processScanPayload(manualInput);
                      }
                    }}
                    className="w-full bg-black/70 border-2 border-amber-500/50 focus:border-amber-400 rounded-xl px-4 py-2.5 text-xs text-white placeholder-white/40 focus:outline-none font-mono tracking-wider font-bold pr-8"
                  />
                  {manualInput && (
                    <button
                      type="button"
                      onClick={() => setManualInput('')}
                      className="absolute right-2.5 top-2.5 text-white/50 hover:text-white"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    primeAudioContext();
                    processScanPayload(manualInput);
                  }}
                  disabled={!manualInput.trim() || isProcessingCheckIn}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white font-bold text-xs tracking-wider uppercase transition-all shadow-lg flex items-center space-x-1.5 cursor-pointer shrink-0"
                >
                  <CheckCircle className="w-4 h-4" />
                  <span>CHECK IN</span>
                </button>
              </div>
              <p className="text-[11px] text-amber-200/70 italic font-mono">
                ⚡ Search attendee by name or Pass ID if screen is damaged or scanner unavailable.
              </p>
            </div>

            {/* Upload QR File Box */}
            <div className="bg-black/30 border border-dashed border-white/20 rounded-2xl p-4 text-center space-y-2">
              <Upload className="w-5 h-5 text-white/60 mx-auto" />
              <div className="text-xs text-white/80 font-medium">Upload Ticket Screenshot or PDF Image</div>
              <label className="inline-block px-4 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs cursor-pointer border border-white/20 transition-colors">
                <span>Choose Image File</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        </div>

        {/* DYNAMIC SCAN RESULT BANNER - DISPLAYED IMMEDIATELY BELOW THE SCANNER */}
        {scanResult && (
          <div ref={scanResultRef} id="scan-result-card" className="pt-2 animate-bounce-in">
            {/* SUCCESS BANNER */}
            {scanResult.type === 'success' && (
              <div className="bg-gradient-to-br from-emerald-950/95 via-[#082a1d]/95 to-emerald-950/95 border-2 border-emerald-400 rounded-3xl p-5 sm:p-6 text-emerald-200 shadow-[0_0_40px_rgba(16,185,129,0.35)] space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-emerald-500/20 pb-4">
                  <div className="flex items-center space-x-3.5">
                    <div className="p-3 bg-emerald-500 text-black rounded-2xl font-bold shadow-lg shadow-emerald-500/30 shrink-0">
                      <CheckCircle className="w-8 h-8" />
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping shrink-0" />
                        <h4 className="font-poster text-xl sm:text-2xl text-emerald-300 uppercase tracking-wider">
                          ENTRY VERIFIED & CHECK-IN SUCCESSFUL!
                        </h4>
                      </div>
                      <p className="text-xs sm:text-sm text-emerald-100 font-medium mt-0.5">{scanResult.message}</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 shrink-0 self-end sm:self-center">
                    <button
                      type="button"
                      onClick={() => scrollToScannerAndReset(true)}
                      className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs flex items-center space-x-1.5 cursor-pointer shadow-md transition-all active:scale-95"
                    >
                      <Camera className="w-4 h-4" />
                      <span>SCAN NEXT TICKET</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleDismissResult}
                      className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-emerald-200 hover:text-white transition-colors"
                      title="Dismiss result"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {scanResult.registrant && (
                  <div className="bg-black/50 border border-emerald-500/30 rounded-2xl p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs text-white">
                    <div className="space-y-1">
                      <span className="text-emerald-400/80 block text-[10px] font-bold uppercase tracking-wider">Pass Holder:</span>
                      <strong className="text-emerald-300 font-bold text-base block truncate">{scanResult.registrant.name}</strong>
                      <span className="text-white/60 text-[11px] font-mono truncate block">{scanResult.registrant.email}</span>
                    </div>
                    <div className="space-y-1">
                      <span className="text-emerald-400/80 block text-[10px] font-bold uppercase tracking-wider">Event Track:</span>
                      <span className="inline-block px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold text-xs uppercase border border-emerald-500/40">
                        {scanResult.registrant.type}
                      </span>
                    </div>
                    <div className="space-y-1">
                      <span className="text-emerald-400/80 block text-[10px] font-bold uppercase tracking-wider">Assigned Seating:</span>
                      {scanResult.registrant.selectedSeats && scanResult.registrant.selectedSeats.length > 0 ? (
                        <span className="text-amber-300 font-mono font-bold text-xs bg-amber-500/10 px-2 py-1 rounded-lg border border-amber-500/30 inline-block">
                          {scanResult.registrant.selectedSeats.map(s => `Row ${s.split('-')[0]} Seat ${s.split('-')[1]}`).join(', ')}
                        </span>
                      ) : (
                        <span className="text-white/60 italic font-medium">General Admission Entry</span>
                      )}
                    </div>
                    <div className="space-y-1">
                      <span className="text-emerald-400/80 block text-[10px] font-bold uppercase tracking-wider">Pass Status:</span>
                      <span className="text-emerald-300 font-mono font-bold text-xs block">
                        ✓ MARKED AS USED
                      </span>
                      <span className="text-white/50 text-[10px] block">Locked against re-use</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ALREADY CHECKED IN ERROR BANNER */}
            {scanResult.type === 'already_checked_in' && (
              <div className="bg-gradient-to-br from-amber-950/95 via-[#2f1903]/95 to-amber-950/95 border-2 border-amber-400 rounded-3xl p-5 sm:p-6 text-amber-200 shadow-[0_0_40px_rgba(245,158,11,0.35)] space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-amber-500/20 pb-4">
                  <div className="flex items-start space-x-3.5">
                    <div className="p-3 bg-amber-500 text-black rounded-2xl font-bold shrink-0 shadow-lg shadow-amber-500/30">
                      <AlertTriangle className="w-8 h-8" />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping shrink-0" />
                        <h4 className="font-poster text-xl sm:text-2xl text-amber-300 uppercase tracking-wider">
                          ⛔ REJECTED: TICKET ALREADY SCANNED!
                        </h4>
                      </div>
                      <p className="text-xs sm:text-sm text-amber-100 font-semibold leading-relaxed">
                        {scanResult.message}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 shrink-0 self-end sm:self-center">
                    <button
                      type="button"
                      onClick={() => scrollToScannerAndReset(true)}
                      className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs flex items-center space-x-1.5 cursor-pointer shadow-md transition-all active:scale-95"
                    >
                      <Camera className="w-4 h-4" />
                      <span>SCAN NEXT TICKET</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleDismissResult}
                      className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-amber-200 hover:text-white transition-colors"
                      title="Dismiss message"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {scanResult.registrant && (
                  <div className="bg-black/55 border border-amber-500/40 rounded-2xl p-4 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs text-white">
                    <div className="space-y-1">
                      <span className="text-amber-400/80 block text-[10px] font-bold uppercase tracking-wider">Pass Holder:</span>
                      <strong className="text-amber-300 font-bold text-base block">{scanResult.registrant.name}</strong>
                      <span className="text-white/60 text-[11px] font-mono truncate block">{scanResult.registrant.email}</span>
                    </div>
                    <div className="space-y-1">
                      <span className="text-amber-400/80 block text-[10px] font-bold uppercase tracking-wider">Assigned Seating:</span>
                      {scanResult.registrant.selectedSeats && scanResult.registrant.selectedSeats.length > 0 ? (
                        <span className="text-amber-300 font-mono font-bold text-xs bg-amber-500/10 px-2 py-1 rounded-lg border border-amber-500/30 inline-block">
                          {scanResult.registrant.selectedSeats.map(s => `Row ${s.split('-')[0]} Seat ${s.split('-')[1]}`).join(', ')}
                        </span>
                      ) : (
                        <span className="text-white/60 italic font-medium">General Admission</span>
                      )}
                    </div>
                    <div className="space-y-1">
                      <span className="text-amber-400/80 block text-[10px] font-bold uppercase tracking-wider">First Scanned At:</span>
                      <span className="text-white/95 font-mono font-bold text-xs block">
                        {scanResult.registrant.checkedInAt 
                          ? new Date(scanResult.registrant.checkedInAt).toLocaleString() 
                          : 'Earlier Today'}
                      </span>
                      <span className="text-amber-300/80 text-[10px] block font-mono">
                        Verified by: {scanResult.registrant.checkedInBy || 'Volunteer'}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* NOT FOUND ERROR BANNER */}
            {scanResult.type === 'not_found' && (
              <div className="bg-gradient-to-br from-red-950/95 via-[#2b0811]/95 to-rose-950/95 border-2 border-red-500 rounded-3xl p-5 sm:p-6 text-red-200 shadow-[0_0_40px_rgba(239,68,68,0.35)] space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start space-x-3.5">
                    <div className="p-3 bg-red-600 text-white rounded-2xl font-bold shrink-0 shadow-lg shadow-red-600/30">
                      <XCircle className="w-8 h-8" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="font-poster text-xl sm:text-2xl text-red-300 uppercase tracking-wider">
                        ❌ INVALID QR CODE / TICKET NOT FOUND
                      </h4>
                      <p className="text-xs sm:text-sm text-red-200 font-medium leading-relaxed">
                        {scanResult.message}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 shrink-0 self-end sm:self-center">
                    <button
                      type="button"
                      onClick={() => scrollToScannerAndReset(true)}
                      className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs flex items-center space-x-1.5 cursor-pointer shadow-md transition-all active:scale-95"
                    >
                      <Camera className="w-4 h-4" />
                      <span>TRY SCANNING AGAIN</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleDismissResult}
                      className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-red-200 hover:text-white transition-colors"
                      title="Dismiss error"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* GENERIC ERROR / REVOKED PASS BANNER */}
            {scanResult.type === 'error' && (
              <div className="bg-gradient-to-br from-red-950/95 via-[#2b0811]/95 to-rose-950/95 border-2 border-red-500 rounded-3xl p-5 sm:p-6 text-red-200 shadow-[0_0_40px_rgba(239,68,68,0.35)] space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start space-x-3.5">
                    <div className="p-3 bg-red-600 text-white rounded-2xl font-bold shrink-0 shadow-lg shadow-red-600/30">
                      <ShieldAlert className="w-8 h-8" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="font-poster text-xl sm:text-2xl text-red-300 uppercase tracking-wider">
                        ⛔ SCAN REJECTED / SYSTEM ERROR
                      </h4>
                      <p className="text-xs sm:text-sm text-red-200 font-medium leading-relaxed">
                        {scanResult.message}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 shrink-0 self-end sm:self-center">
                    <button
                      type="button"
                      onClick={() => scrollToScannerAndReset(true)}
                      className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs flex items-center space-x-1.5 cursor-pointer shadow-md transition-all active:scale-95"
                    >
                      <Camera className="w-4 h-4" />
                      <span>TRY AGAIN</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleDismissResult}
                      className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-red-200 hover:text-white transition-colors"
                      title="Dismiss error"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {scanResult.registrant && (
                  <div className="bg-black/55 border border-red-500/40 rounded-2xl p-4 text-xs text-white grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <span className="text-red-400/80 block text-[10px] font-bold uppercase tracking-wider">Flagged Registrant:</span>
                      <strong className="text-red-300 font-bold text-sm block">{scanResult.registrant.name}</strong>
                    </div>
                    <div>
                      <span className="text-red-400/80 block text-[10px] font-bold uppercase tracking-wider">Invalidation Reason:</span>
                      <span className="text-amber-300 font-mono text-xs block">{scanResult.registrant.invalidPassReason || 'Super Admin Security Revocation'}</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Top Header Banner for Ticket Admin */}
      <div className="bg-gradient-to-r from-[#241226] via-[#3B153C] to-[#1F0D24] border border-[#EC4899]/40 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-64 h-64 bg-[#EC4899]/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-1.5">
            <div className="flex items-center space-x-2 text-[#EC4899] font-mono text-xs uppercase tracking-widest font-bold">
              <Ticket className="w-4 h-4 text-[#EC4899]" />
              <span>GRACIA Event Access Portal</span>
            </div>
            <h2 className="font-poster text-2xl sm:text-3xl text-white">
              TICKET ACCESS & QR CHECK-IN
            </h2>
            <p className="text-xs text-white/70 max-w-xl">
              Official venue scanner interface for Ticket Admins. Scan QR codes on attendee ticket passes or search by registrant name to confirm entry and assign attendance.
            </p>
          </div>

          {/* User Badge */}
          <div className="bg-black/40 border border-white/15 rounded-2xl p-3.5 flex items-center space-x-3 shrink-0">
            <div className="w-10 h-10 rounded-xl bg-[#EC4899]/20 border border-[#EC4899]/50 flex items-center justify-center text-[#EC4899] font-bold">
              <Ticket className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[10px] text-white/50 uppercase font-mono font-bold">LOGGED IN AS TICKET ADMIN</div>
              <div className="text-xs font-bold text-white font-mono">{adminName || adminEmail}</div>
            </div>
          </div>
        </div>

        {/* Attendance Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-6 border-t border-white/10 mt-6">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5">
            <span className="text-[10px] text-white/60 font-semibold uppercase block">Total Attendees</span>
            <span className="text-2xl font-black font-mono text-white">{totalCount}</span>
          </div>
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-3.5">
            <span className="text-[10px] text-emerald-300 font-semibold uppercase block">Checked In</span>
            <span className="text-2xl font-black font-mono text-emerald-400">{checkedInCount}</span>
          </div>
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-3.5">
            <span className="text-[10px] text-amber-300 font-semibold uppercase block">Pending Check-In</span>
            <span className="text-2xl font-black font-mono text-amber-400">{pendingCount}</span>
          </div>
          <div className="bg-pink-500/10 border border-pink-500/30 rounded-2xl p-3.5">
            <span className="text-[10px] text-pink-300 font-semibold uppercase block">Attendance Progress</span>
            <span className="text-2xl font-black font-mono text-pink-400">{percentCheckedIn}%</span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-black/40 h-2 rounded-full overflow-hidden mt-3 border border-white/10">
          <div 
            className="bg-gradient-to-r from-emerald-500 to-[#EC4899] h-full transition-all duration-500"
            style={{ width: `${percentCheckedIn}%` }}
          />
        </div>
      </div>

      {/* ATTENDEE ACCESS LIST TABLE */}
      <div className="bg-white/5 border border-white/10 rounded-3xl p-6 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-2">
            <User className="w-5 h-5 text-[#E8B400]" />
            <h3 className="font-poster text-xl text-white">
              REGISTERED ATTENDEES & SEATS ({filteredList.length})
            </h3>
          </div>

          {/* Filters Bar */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-white/40 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search name, seats, email..."
                value={searchQuery || ''}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-black/40 border border-white/15 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#EC4899]"
              />
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter || 'all'}
              onChange={(e: any) => setStatusFilter(e.target.value)}
              className="bg-black/40 border border-white/15 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#EC4899]"
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending Only</option>
              <option value="checked_in">Checked In Only</option>
            </select>

            {/* Type Filter */}
            <select
              value={typeFilter || 'all'}
              onChange={(e: any) => setTypeFilter(e.target.value)}
              className="bg-black/40 border border-white/15 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#EC4899]"
            >
              <option value="all">All Events</option>
              <option value="musical">Musical Concert Only</option>
              <option value="conference">Conference Only</option>
            </select>
          </div>
        </div>

        {/* Table Container */}
        <div className="overflow-x-auto rounded-2xl border border-white/10 bg-black/20">
          <table className="w-full text-left text-xs text-white/80">
            <thead className="bg-black/60 text-white font-poster tracking-wider uppercase text-[11px] border-b border-white/10">
              <tr>
                <th className="p-4">Registrant Name & Check-In</th>
                <th className="p-4">Type</th>
                <th className="p-4">Assigned Seats</th>
                <th className="p-4">Attendance Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10 font-medium">
              {filteredList.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-white/50 italic">
                    No matching registered attendees found.
                  </td>
                </tr>
              ) : (
                filteredList.map((reg) => {
                  const regId = reg.id || '';
                  const delegates = getDelegatesForReg(reg);
                  const isExpanded = expandedRegIds.includes(regId);
                  const stats = getRegistrationCheckInStats(reg, delegates);

                  return (
                    <React.Fragment key={reg.id}>
                      {/* Main Registration Row */}
                      <tr className={`hover:bg-white/5 transition-colors ${isExpanded ? 'bg-black/40' : ''}`}>
                        {/* Name & Action */}
                        <td className="p-4">
                          <div className="flex items-center space-x-3 flex-wrap gap-y-2">
                            {delegates.length > 1 && (
                              <button
                                type="button"
                                onClick={() => toggleRowExpanded(regId)}
                                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/15 text-amber-300 border border-amber-500/30 transition-all cursor-pointer flex items-center space-x-1"
                                title={isExpanded ? "Collapse passes" : `Expand ${delegates.length} passes`}
                              >
                                {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                <span className="text-[10px] font-mono font-bold">{delegates.length}</span>
                              </button>
                            )}
                            <div className="flex flex-col">
                              <span className="font-bold text-white text-sm">{reg.name}</span>
                              {delegates.length > 1 && (
                                <span className="text-[10px] text-white/50 font-mono">
                                  {stats.checkedInCount}/{stats.totalCount} Passes Checked In
                                </span>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => handleToggleCheckIn(reg)}
                              disabled={isProcessingCheckIn}
                              className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer shadow-md inline-flex items-center space-x-1 shrink-0 ${
                                stats.isAllCheckedIn
                                  ? 'bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/40'
                                  : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                              }`}
                            >
                              {stats.isAllCheckedIn ? (
                                <span>Undo Check-In</span>
                              ) : (
                                <>
                                  <CheckCircle className="w-3.5 h-3.5" />
                                  <span>{stats.isPartialCheckedIn ? 'Mark All Check In' : 'Mark Check In'}</span>
                                </>
                              )}
                            </button>
                          </div>
                        </td>

                        {/* Type */}
                        <td className="p-4">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold font-mono uppercase ${
                            reg.type === 'musical'
                              ? 'bg-[#C81E6E]/20 text-pink-300 border border-pink-500/40'
                              : 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                          }`}>
                            {reg.type}
                          </span>
                        </td>

                        {/* Assigned Seats */}
                        <td className="p-4">
                          {reg.type === 'musical' ? (
                            reg.selectedSeats && reg.selectedSeats.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {reg.selectedSeats.map((s, idx) => (
                                  <span key={`${s}-${idx}`} className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/40 font-mono text-[10px] font-bold">
                                    Row {s.split('-')[0]} • Seat {s.split('-')[1]}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-white/40 italic text-[11px]">No Seats</span>
                            )
                          ) : (
                            <span className="text-white/30 text-[11px]">General Admission</span>
                          )}
                        </td>

                        {/* Status */}
                        <td className="p-4">
                          {stats.isAllCheckedIn ? (
                            <div className="space-y-0.5">
                              <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold text-[10px]">
                                <CheckCircle className="w-3 h-3 text-emerald-400" />
                                <span>Checked In</span>
                              </span>
                              {reg.checkedInAt && (
                                <div className="text-[10px] text-white/40 font-mono">
                                  {new Date(reg.checkedInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </div>
                              )}
                            </div>
                          ) : stats.isPartialCheckedIn ? (
                            <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-bold text-[10px]">
                              <CheckCircle className="w-3 h-3 text-emerald-400" />
                              <span>Partial ({stats.checkedInCount}/{stats.totalCount})</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30 font-bold text-[10px]">
                              <Clock className="w-3 h-3 text-amber-400" />
                              <span>Pending</span>
                            </span>
                          )}
                        </td>
                      </tr>

                      {/* Expanded Delegates Sub-Rows */}
                      {isExpanded && (
                        <tr className="bg-black/60 border-b border-amber-500/30">
                          <td colSpan={4} className="p-3 pl-8">
                            <div className="bg-black/40 border border-white/10 rounded-xl p-3 space-y-2">
                              <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-amber-300">
                                INDIVIDUAL DELEGATE PASSES ({delegates.length})
                              </div>
                              <div className="divide-y divide-white/5">
                                {delegates.map((del) => (
                                  <div key={del.passId} className="py-2 flex items-center justify-between flex-wrap gap-2 text-xs">
                                    <div className="flex items-center space-x-2">
                                      <span className={`w-2 h-2 rounded-full ${del.isCheckedIn ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                                      <span className="font-bold text-white">{del.name}</span>
                                      <span className="text-[10px] px-2 py-0.5 rounded bg-white/10 text-white/70 font-mono">{del.category}</span>
                                      {del.isPrimary && <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold font-mono">Primary</span>}
                                      <span className="text-[10px] text-white/40 font-mono">Pass: {del.passId}</span>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                      {del.isCheckedIn ? (
                                        <span className="text-[10px] text-emerald-300 font-bold flex items-center space-x-1 bg-emerald-500/20 px-2 py-0.5 rounded-full border border-emerald-500/30">
                                          <CheckCircle className="w-3 h-3 text-emerald-400" />
                                          <span>Checked In</span>
                                        </span>
                                      ) : (
                                        <span className="text-[10px] text-amber-300 font-bold bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                                          Pending
                                        </span>
                                      )}
                                      <button
                                        type="button"
                                        onClick={() => handleToggleDelegateCheckIn(reg, del.passId, del.isCheckedIn, del.name)}
                                        disabled={isProcessingCheckIn}
                                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                                          del.isCheckedIn
                                            ? 'bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30'
                                            : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                                        }`}
                                      >
                                        {del.isCheckedIn ? 'Undo Check-In' : 'Mark Check In'}
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
