import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { 
  QrCode, 
  CheckCircle2, 
  Loader2, 
  Heart, 
  ShieldCheck, 
  Copy, 
  Check, 
  ArrowRight, 
  Sparkles, 
  Users, 
  DollarSign, 
  Zap, 
  Info,
  RefreshCw,
  Clock,
  ExternalLink,
  Shield,
  AlertCircle,
  X,
  Gift
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import paynowQrImg from '../assets/images/regenerated_image_1785556021273.jpg';
import { getSystemSettingsFromFirestore, auth, SUPER_ADMIN_EMAIL } from '../lib/firebase';
import { getBibleVersePassId, getPersonDeterministicSeed } from '../lib/bibleVerses';
import { HitPayRegistrationPayment } from './HitPayRegistrationPayment';
import { PersonalContributionPayment } from './PersonalContributionPayment';

interface HitPayCheckoutCardProps {
  passId?: string;
  adultsCount: number;
  teensCount: number;
  preteensCount: number;
  childrenCount: number;
  kidsCount: number;
  toddlersCount: number;
  userName: string;
  userEmail: string;
  userPhone: string;
  isDetailsValid?: boolean;
  previouslyPaidAmount?: number;
  isExistingPaidRegistration?: boolean;
  onPaymentSuccess: (details: {
    paymentRequestId: string;
    amount: number;
    baseFee: number;
    additionalContribution: number;
    referenceNumber: string;
  }) => void;
  onPaymentReset?: () => void;
  onValidationFailed?: () => void;
  className?: string;
}

export const HitPayCheckoutCard: React.FC<HitPayCheckoutCardProps> = ({
  passId,
  adultsCount = 1,
  teensCount = 0,
  preteensCount = 0,
  childrenCount = 0,
  kidsCount = 0,
  toddlersCount = 0,
  userName = '',
  userEmail = '',
  userPhone = '',
  isDetailsValid,
  previouslyPaidAmount = 0,
  isExistingPaidRegistration = false,
  onPaymentSuccess,
  onPaymentReset,
  onValidationFailed,
  className = ''
}) => {
  // Family cap toggle state - Adults, Youths and Teens only charged ($25 each). Pre-teens, children, kids & toddlers are free ($0).
  const payingAttendees = (Number(adultsCount) || 0) + (Number(teensCount) || 0);
  const uncappedBaseFee = payingAttendees * 25;
  const isAutoFamily = payingAttendees >= 4;
  
  // Flow Step: 1 = Registration Love Offering Checkout & Payment, 2 = Additional Contribution / Love Offering (Optional)
  const [checkoutStep, setCheckoutStep] = useState<1 | 2>(1);
  const [isFamilyCapApplied, setIsFamilyCapApplied] = useState<boolean>(true);
  const [additionalContribution, setAdditionalContribution] = useState<number | string>(0);
  
  // Calculate Base Registration Love Offering: $25/person, capped at $100 for family!
  const baseFee = isFamilyCapApplied ? Math.min(uncappedBaseFee, 100) : uncappedBaseFee;
  const extraContribNum = Math.max(0, parseFloat(String(additionalContribution)) || 0);

  // Previous payment and difference due (delta) for base registration fee
  const prevPaid = Math.max(0, Number(previouslyPaidAmount) || 0);
  const baseAmountDue = Math.max(0, baseFee - prevPaid);
  const isBaseAlreadyPaid = (isExistingPaidRegistration || prevPaid > 0 || baseFee === 0) && baseAmountDue <= 0;

  // Determine effective base amount to charge for the registration love offering in this transaction
  const amountToCharge = (prevPaid > 0 && baseAmountDue > 0) ? baseAmountDue : baseFee;

  // PayNow Generation State for Base Registration Love Offering
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [paymentRequestId, setPaymentRequestId] = useState<string | null>(null);
  const [paynowRef, setPaynowRef] = useState<string | null>(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [hitpayCheckoutUrl, setHitpayCheckoutUrl] = useState<string | null>(null);
  const [isHitpayActive, setIsHitpayActive] = useState<boolean>(false);
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'pending' | 'succeeded' | 'failed'>('idle');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [copiedUen, setCopiedUen] = useState<boolean>(false);
  const [copiedRef, setCopiedRef] = useState<boolean>(false);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [isVerifyingUserPayment, setIsVerifyingUserPayment] = useState<boolean>(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState<boolean>(false);
  const [userVerificationNotice, setUserVerificationNotice] = useState<string | null>(null);

  // Additional Contribution (Step 2) state
  const [isGeneratingContribQr, setIsGeneratingContribQr] = useState<boolean>(false);
  const [contribQrCodeDataUrl, setContribQrCodeDataUrl] = useState<string>('');
  const [contribPaynowRef, setContribPaynowRef] = useState<string>('');
  const [savedBasePaymentData, setSavedBasePaymentData] = useState<{ reqId: string; ref: string } | null>(null);
  const [isContribVerifying, setIsContribVerifying] = useState<boolean>(false);
  const [isContribSimulating, setIsContribSimulating] = useState<boolean>(false);
  const [copiedContribUen, setCopiedContribUen] = useState<boolean>(false);
  const [copiedContribRef, setCopiedContribRef] = useState<boolean>(false);
  
  // Super Admin & HitPay Gateway Inspector state
  const [isSuperAdminUser, setIsSuperAdminUser] = useState<boolean>(false);
  const [gatewayRawPayload, setGatewayRawPayload] = useState<any>(null);
  const [gatewayErrorData, setGatewayErrorData] = useState<any>(null);
  const [copiedPayload, setCopiedPayload] = useState<boolean>(false);

  useEffect(() => {
    const checkAdmin = () => {
      const u = auth.currentUser;
      if (u?.email && u.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()) {
        setIsSuperAdminUser(true);
      }
    };
    checkAdmin();
    const unsub = auth.onAuthStateChanged((u) => {
      if (u?.email && u.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()) {
        setIsSuperAdminUser(true);
      } else {
        setIsSuperAdminUser(false);
      }
    });
    return () => unsub();
  }, []);

  const [isGoLive, setIsGoLive] = useState<boolean>(() => {
    try {
      return localStorage.getItem('isGoLiveMode') === 'true';
    } catch {
      return false;
    }
  });

  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);
  const contribPaynowMobile = '201605888W';

  useEffect(() => {
    getSystemSettingsFromFirestore().then(s => {
      if (s && typeof s.isGoLive === 'boolean') {
        setIsGoLive(s.isGoLive);
      }
    }).catch(() => {});
  }, []);

  // Auto update family cap state when attendee numbers change
  useEffect(() => {
    if (payingAttendees >= 4) {
      setIsFamilyCapApplied(true);
    }
  }, [payingAttendees]);

  // Clean up polling timer on unmount
  useEffect(() => {
    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
      }
    };
  }, []);

  // Generate QR code for additional contribution
  const generateContributionQrCode = async (amount: number) => {
    if (amount <= 0) {
      setContribQrCodeDataUrl('');
      return;
    }
    setIsGeneratingContribQr(true);
    const personSeed = getPersonDeterministicSeed(userEmail, userPhone, userName);
    const basePass = passId || getBibleVersePassId(personSeed, 0, userName);
    const contribRefStr = `GIFT-${basePass.replace(/^GRACIA-/, '')}`;
    setContribPaynowRef(contribRefStr);

    try {
      setContribQrCodeDataUrl(paynowQrImg);
    } catch (err) {
      console.warn('Contrib QR generation fallback:', err);
      setContribQrCodeDataUrl(paynowQrImg);
    } finally {
      setIsGeneratingContribQr(false);
    }
  };

  // Re-generate contrib QR when additional contribution changes in step 2
  useEffect(() => {
    if (checkoutStep === 2 && extraContribNum > 0) {
      generateContributionQrCode(extraContribNum);
    }
  }, [checkoutStep, extraContribNum]);

  // Handler when base registration payment is completed -> Move to Step 2 page!
  const handleBasePaymentCompleted = (baseReqId: string, baseRef: string) => {
    setPaymentStatus('succeeded');
    setSavedBasePaymentData({ reqId: baseReqId, ref: baseRef });
    
    setStatusMessage('Registration Love Offering verified! Directing to next page...');
    setTimeout(() => {
      setCheckoutStep(2);
    }, 600);
  };

  // Finalize registration from Step 2 (with or without additional contribution)
  const handleFinalizeRegistration = (isContributionTransferred: boolean) => {
    const resolvedReqId = savedBasePaymentData?.reqId || paymentRequestId || (prevPaid > 0 ? 'PREVIOUSLY_VERIFIED' : 'NO_BASE_FEE');
    const resolvedRef = savedBasePaymentData?.ref || paynowRef || (prevPaid > 0 ? 'PREVIOUSLY_VERIFIED' : (passId || 'GRACIA-CONF'));
    const finalAmount = amountToCharge + (isContributionTransferred ? extraContribNum : 0);

    onPaymentSuccess({
      paymentRequestId: resolvedReqId,
      amount: finalAmount,
      baseFee,
      additionalContribution: isContributionTransferred ? extraContribNum : 0,
      referenceNumber: resolvedRef
    });
  };

  // Auto notify parent ONLY when base payment is already satisfied AND we are not on step 2
  useEffect(() => {
    if (isBaseAlreadyPaid && checkoutStep === 1) {
      // Allow user to proceed or skip to complete
    } else {
      if (onPaymentReset && paymentStatus !== 'succeeded' && checkoutStep === 1) {
        onPaymentReset();
      }
    }
  }, [isBaseAlreadyPaid, checkoutStep, onPaymentReset, paymentStatus]);

  // Poll status when paymentRequestId is set
  useEffect(() => {
    if (!paymentRequestId || paymentStatus === 'succeeded') return;

    const checkStatus = async () => {
      try {
        const res = await fetch(`/api/hitpay/status/${paymentRequestId}`);
        if (res.ok) {
          const data = await res.json().catch(() => null);
          if (data && (data.paymentStatus === 'succeeded' || data.paymentStatus === 'completed' || data.paymentStatus === 'paid')) {
            if (pollTimerRef.current) {
              clearInterval(pollTimerRef.current);
            }
            const activeRef = paynowRef || data.referenceNumber || `GRACIA-${Date.now()}`;
            handleBasePaymentCompleted(paymentRequestId, activeRef);
          }
        }
      } catch (err) {
        // Silently handle offline/static Vercel hosting mode
      }
    };

    // Poll every 3 seconds
    pollTimerRef.current = setInterval(checkStatus, 3000);

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [paymentRequestId, paymentStatus, amountToCharge, baseFee, extraContribNum, paynowRef]);

  // Generate dynamic HitPay PayNow QR Code for the Base Registration Love Offering
  const handleConfirmAndGenerateQR = async () => {
    if (onValidationFailed) {
      onValidationFailed();
    }

    if (isDetailsValid === false) {
      setValidationError('⚠️ Please complete all required participant details (Full Name, Email, Contact Number) and agree to the terms and conditions above to generate PayNow QR code.');
      
      setTimeout(() => {
        const firstErrorEl = document.querySelector<HTMLElement>(
          'input.border-red-500, select.border-red-500, textarea.border-red-500, [name="name"], [name="email"], [name="phone"], input[name="pdpaConsent"]'
        );
        if (firstErrorEl) {
          firstErrorEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
          if ('focus' in firstErrorEl && typeof firstErrorEl.focus === 'function') {
            firstErrorEl.focus();
          }
        }
      }, 50);

      return;
    }

    // If base fee is 0 ($0 due / all free / previously paid), clicking the button can advance directly to Step 2
    if (amountToCharge <= 0) {
      setCheckoutStep(2);
      return;
    }

    setValidationError(null);
    setIsGenerating(true);
    setStatusMessage('Generating dynamic PayNow QR code...');

    const personSeed = getPersonDeterministicSeed(userEmail, userPhone, userName);
    const computedPassId = passId || getBibleVersePassId(personSeed, 0, userName);
    let data: any = null;

    try {
      const res = await fetch('/api/hitpay/create-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: amountToCharge,
          baseFee,
          additionalContribution: 0, // Base checkout focuses strictly on registration love offering
          currency: 'SGD',
          name: userName || 'Participant',
          email: userEmail,
          phone: userPhone,
          purpose: `GRACIA Jubilee Registration Love Offering ${prevPaid > 0 ? '(Additional Pax Fee)' : ''} - ${userName || 'Participant'} (${computedPassId})`,
          referenceNumber: computedPassId,
          passId: computedPassId,
          isFamily: isFamilyCapApplied,
          payingCount: payingAttendees
        })
      });

      if (res.ok) {
        data = await res.json().catch(() => null);
      }
    } catch (err: any) {
      console.warn('HitPay backend endpoint not reachable (Vercel static mode active):', err);
    }

    setIsGenerating(false);

    if (data) {
      if (data.checkoutUrl) setHitpayCheckoutUrl(data.checkoutUrl);
      if (data.hitpayActive) setIsHitpayActive(true);
      if (data.rawPayload) setGatewayRawPayload(data.rawPayload);
      if (data.hitpayError) setGatewayErrorData(data.hitpayError);
    }

    // Extract or generate reference details
    const refStr = (data && data.referenceNumber) || computedPassId;
    const reqId = (data && data.paymentRequestId) || `hitpay_req_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

    setPaymentRequestId(reqId);
    setPaynowRef(refStr);
    setPaymentStatus('pending');

    // If HitPay returned official gateway QR code Data URL, use it directly
    if (data && data.hitpayQrDataUrl) {
      setQrCodeDataUrl(data.hitpayQrDataUrl);
    } else {
      setQrCodeDataUrl(paynowQrImg);
    }
  };

  // User manual confirmation after transferring base registration love offering via bank PayNow
  const handleVerifyUserPayment = async () => {
    const currentReqId = paymentRequestId || `hitpay_req_${Date.now()}`;
    const activeRef = paynowRef || `GRACIA-PAY-${Math.floor(100000 + Math.random() * 900000)}`;
    setIsVerifyingUserPayment(true);
    setUserVerificationNotice(null);

    try {
      const res = await fetch('/api/hitpay/verify-user-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          paymentRequestId: currentReqId,
          bankReference: activeRef
        })
      });

      if (res.ok) {
        const data = await res.json().catch(() => null);
        if (data && (data.paymentStatus === 'succeeded' || data.paymentStatus === 'completed' || data.isPaid === true)) {
          setUserVerificationNotice(null);
          handleBasePaymentCompleted(currentReqId, activeRef);
        } else {
          setUserVerificationNotice(data?.message || '❌ Payment NOT received on HitPay yet. Please scan the QR code and complete the transfer in your bank app first.');
        }
      } else {
        setUserVerificationNotice('❌ Payment NOT received on HitPay yet. Please scan the QR code and complete the transfer in your bank app first.');
      }
    } catch (err) {
      console.warn('Verify user payment warning:', err);
      setUserVerificationNotice('❌ Unable to verify payment with HitPay. Please scan the QR code and complete the transfer in your bank app first.');
    } finally {
      setIsVerifyingUserPayment(false);
    }
  };

  // Manual status check against server API
  const handleCheckStatusNow = async () => {
    if (!paymentRequestId) return;
    setIsCheckingStatus(true);
    try {
      const res = await fetch(`/api/hitpay/status/${paymentRequestId}`);
      if (res.ok) {
        const data = await res.json().catch(() => null);
        if (data) {
          if (data.rawPayload) setGatewayRawPayload(data.rawPayload);
          if (data.hitpayError) setGatewayErrorData(data.hitpayError);
          if (data.paymentStatus === 'succeeded' || data.paymentStatus === 'completed' || data.paymentStatus === 'paid') {
            const activeRef = paynowRef || data.referenceNumber || `GRACIA-${Date.now()}`;
            handleBasePaymentCompleted(paymentRequestId, activeRef);
          }
        }
      }
    } catch (err) {
      console.warn('Status check warning:', err);
    } finally {
      setIsCheckingStatus(false);
    }
  };

  const copyToClipboard = (text: string, type: 'uen' | 'ref') => {
    navigator.clipboard.writeText(text);
    if (type === 'uen') {
      setCopiedUen(true);
      setTimeout(() => setCopiedUen(false), 2000);
    } else {
      setCopiedRef(true);
      setTimeout(() => setCopiedRef(false), 2000);
    }
  };

  const copyContribToClipboard = (text: string, type: 'uen' | 'ref') => {
    navigator.clipboard.writeText(text);
    if (type === 'uen') {
      setCopiedContribUen(true);
      setTimeout(() => setCopiedContribUen(false), 2000);
    } else {
      setCopiedContribRef(true);
      setTimeout(() => setCopiedContribRef(false), 2000);
    }
  };

  return (
    <div id="hitpay-checkout-container" className={`space-y-6 ${className}`}>

      {/* ========================================================================= */}
      {/* STEP INDICATOR                                                           */}
      {/* ========================================================================= */}
      <div className="flex items-center justify-between px-4 py-2.5 rounded-2xl bg-white/80 border border-amber-200/90 shadow-2xs text-xs font-bold text-slate-700">
        <div className="flex items-center space-x-2">
          <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black ${checkoutStep === 1 ? 'bg-[#7B1113] text-white shadow-xs' : 'bg-emerald-600 text-white'}`}>
            {checkoutStep === 1 ? '1' : '✓'}
          </span>
          <span className={checkoutStep === 1 ? 'text-[#7B1113] font-black' : 'text-emerald-800'}>
            Step 1: Registration Love Offering
          </span>
        </div>

        <div className="h-0.5 w-8 bg-amber-200 hidden sm:block" />

        <div className="flex items-center space-x-2">
          <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black ${checkoutStep === 2 ? 'bg-purple-900 text-white shadow-xs' : 'bg-gray-200 text-gray-500'}`}>
            2
          </span>
          <span className={checkoutStep === 2 ? 'text-purple-900 font-black' : 'text-gray-400'}>
            Step 2: Additional Contribution
          </span>
        </div>
      </div>
      
      {checkoutStep === 1 ? (
        /* ========================================================================= */
        /* BOX 1: REGISTRATION LOVE OFFERING (SHOWS ONLY BASE REGISTRATION OFFERING) */
        /* ========================================================================= */
        <div className="p-5 sm:p-7 rounded-3xl bg-gradient-to-b from-amber-50/95 via-orange-50/80 to-purple-50/60 border-2 border-[#E8752C]/40 shadow-xl text-[#241226] text-left space-y-6">
        
        {/* HEADER BANNER */}
        <div className="space-y-2 border-b border-amber-200/80 pb-4">
          <div className="flex items-center justify-between">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-[#7B1113] text-white text-[11px] font-extrabold uppercase tracking-wider shadow-xs">
              <QrCode className="w-3.5 h-3.5" />
              <span>Secure PayNow Checkout</span>
            </div>
          </div>

          <h3 className="font-poster text-2xl sm:text-3xl text-[#241226] tracking-wide">
            Registration Love Offering
          </h3>
          
          <div className="space-y-2 text-xs sm:text-sm text-[#241226]/85 leading-relaxed font-sans">
            <p>
              A suggested love offering of <strong>$25 per person</strong> applies to adults, youths, and teens. This includes full access to the conference as well as a complimentary ticket for the Musical Concert.
            </p>
            <p>
              Pre-teens, children, and toddlers attend <strong>FREE</strong>! For families, the suggested love offering is <strong>capped at $100 per family</strong>. Your support helps meet the expenses of the conference and concert, and serves as confirmation of your registration.
            </p>
          </div>
        </div>

        {/* 1. LOVE OFFERING BREAKDOWN & FAMILY CAP TOGGLE */}
        <div className="bg-white/90 rounded-2xl p-4 sm:p-5 border border-amber-200/90 shadow-sm space-y-4">
          
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <span className="font-poster text-base text-[#241226] flex items-center space-x-2">
              <Users className="w-4 h-4 text-[#E8752C]" />
              <span>Attendee Breakdown</span>
            </span>
            <span className="text-xs font-bold text-purple-900 bg-purple-100 px-2.5 py-0.5 rounded-full">
              {payingAttendees} Paying Registrant{payingAttendees === 1 ? '' : 's'}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-2 gap-2 text-xs">
            <div className="p-2.5 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-between">
              <div>
                <span className="text-gray-500 font-medium block">Adults/Youths (20+):</span>
                <strong className="text-sm text-[#241226] font-bold">{adultsCount}</strong> × $25
              </div>
              <span className="font-extrabold text-[#241226]">${adultsCount * 25}</span>
            </div>
            <div className="p-2.5 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-between">
              <div>
                <span className="text-gray-500 font-medium block">Teens (13–19):</span>
                <strong className="text-sm text-[#241226] font-bold">{teensCount}</strong> × $25
              </div>
              <span className="font-extrabold text-[#241226]">${teensCount * 25}</span>
            </div>
            <div className="p-2.5 rounded-xl bg-emerald-50/80 border border-emerald-200/80 col-span-2 flex items-center justify-between text-gray-700">
              <span>Pre-teens (9–12), Children (6–8), Kids (3–5) & Toddlers (2 & under):</span>
              <strong className="text-emerald-700 font-extrabold uppercase bg-emerald-100 px-2.5 py-1 rounded-lg border border-emerald-300">
                FREE ({preteensCount + childrenCount + kidsCount + toddlersCount})
              </strong>
            </div>
          </div>

          {/* Family Cap Notice & Checkbox */}
          <div className="p-3.5 rounded-2xl bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-purple-500/10 border border-amber-300 text-xs space-y-2">
            <div className="flex items-start justify-between gap-3">
              <label className="flex items-center space-x-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isFamilyCapApplied}
                  onChange={(e) => setIsFamilyCapApplied(e.target.checked)}
                  className="w-4 h-4 rounded border-amber-400 text-[#E8752C] focus:ring-[#E8752C] cursor-pointer"
                />
                <span className="font-bold text-[#241226] text-xs sm:text-sm">
                  Apply Family Registration Cap ($100 Maximum)
                </span>
              </label>

              {isFamilyCapApplied && uncappedBaseFee > 100 && (
                <span className="text-[10px] font-extrabold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-300 shrink-0">
                  🎉 Saved ${uncappedBaseFee - 100}!
                </span>
              )}
            </div>

            <p className="text-[#241226]/80 text-[11px] leading-relaxed pl-6">
              If registering as a family with 4 or more paying members, your total base registration love offering will never exceed $100!
            </p>
          </div>

          {/* CALCULATION TOTAL DISPLAY (SHOWS ONLY REGISTRATION LOVE OFFERING) */}
          <div className="bg-gradient-to-r from-purple-900 via-[#2a1138] to-purple-950 p-4 sm:p-5 rounded-2xl text-white shadow-lg space-y-2">
            <div className="flex items-center justify-between text-xs text-amber-200/90 font-medium">
              <span>Base Registration Love Offering:</span>
              <span className="font-bold text-white">S$ {baseFee.toFixed(2)}</span>
            </div>

            <div className="pt-2 border-t border-white/15 flex items-center justify-between">
              <div>
                <span className="text-xs uppercase font-extrabold tracking-widest text-amber-400 block">
                  {prevPaid > 0 ? 'UPDATED REGISTRATION LOVE OFFERING' : 'REGISTRATION LOVE OFFERING DUE'}
                </span>
                <span className="text-[10px] text-gray-300 font-normal">Calculated for conference pass entry</span>
              </div>
              <div className="text-right">
                <span className="font-poster text-3xl sm:text-4xl text-[#E8B400] tracking-wider">
                  S$ {amountToCharge.toFixed(2)}
                </span>
              </div>
            </div>

            {/* DELTA BREAKDOWN IF PREVIOUS PAYMENT EXISTS */}
            {prevPaid > 0 && (
              <div className="mt-2 pt-2 border-t border-white/20 text-xs space-y-1.5 bg-white/10 p-2.5 rounded-xl">
                <div className="flex justify-between text-emerald-300 font-medium">
                  <span>Previously Paid & Verified:</span>
                  <span className="font-bold">- S$ {prevPaid.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-amber-300 font-black text-sm pt-1 border-t border-white/10">
                  <span>NET REGISTRATION BALANCE DUE NOW:</span>
                  <span>S$ {amountToCharge.toFixed(2)}</span>
                </div>
              </div>
            )}
          </div>

        </div>

        {/* STEP 1 CONTENT: OFFICIAL HITPAY REGISTRATION PAYMENT */}
        <div className="space-y-4">
          {isBaseAlreadyPaid || amountToCharge <= 0 ? (
            <div className="p-5 rounded-2xl bg-emerald-500/10 border-2 border-emerald-500/40 text-emerald-950 space-y-3 shadow-sm">
              <div className="flex items-center space-x-2.5 font-black text-emerald-900 text-sm">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <span>
                  {prevPaid > 0 
                    ? `REGISTRATION PAYMENT SATISFIED & VERIFIED (S$ ${prevPaid.toFixed(2)} PREVIOUSLY PAID)` 
                    : 'NO REGISTRATION LOVE OFFERING REQUIRED (S$ 0.00 DUE)'}
                </span>
              </div>
              <p className="text-xs text-emerald-900/90 leading-relaxed font-medium">
                All registered attendee categories for this entry are free of charge or fully paid. Click below to continue.
              </p>
              <button
                type="button"
                onClick={() => setCheckoutStep(2)}
                className="w-full sm:w-auto px-5 py-3 rounded-xl bg-purple-700 text-white font-bold text-xs tracking-wider hover:bg-purple-800 transition"
              >
                Continue to Voluntary Personal Contribution →
              </button>
            </div>
          ) : (
            <HitPayRegistrationPayment
              amount={amountToCharge}
              referenceNumber={paynowRef || passId || `GRACIA-${Date.now()}`}
              userName={userName}
              userEmail={userEmail}
              userPhone={userPhone}
              purpose={`GRACIA Jubilee Registration (${passId || 'Delegate'})`}
              onPaymentCompleted={(details) => {
                setSavedBasePaymentData({ reqId: details.paymentRequestId, ref: details.referenceNumber });
                setCheckoutStep(2);
              }}
              onSkipOrBypass={() => setCheckoutStep(2)}
            />
          )}
        </div>
      </div>
      ) : (
        /* ========================================================================= */
        /* STEP 2: VOLUNTARY PERSONAL PAYNOW CONTRIBUTION                          */
        /* ========================================================================= */
        <PersonalContributionPayment
          registrationRef={savedBasePaymentData?.ref || paynowRef || passId || 'GRACIA-JUBILEE'}
          onCompleted={() => handleFinalizeRegistration(true)}
          onSkip={() => handleFinalizeRegistration(false)}
        />
      )}
    </div>
  );
};

