import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, 
  QrCode, 
  Heart, 
  CheckCircle2, 
  Check, 
  ChevronRight, 
  ChevronLeft, 
  Download, 
  Copy, 
  X, 
  Info, 
  Sparkles, 
  ShieldCheck, 
  RefreshCw, 
  AlertCircle, 
  Gift, 
  DollarSign, 
  Zap, 
  Clock, 
  ExternalLink,
  UserPlus,
  ArrowRight,
  Shield,
  Loader2,
  Mail
} from 'lucide-react';
import paynowQrImg from '../assets/images/regenerated_image_1785556021273.jpg';
import QRCode from 'qrcode';
import { getBibleVersePassId, getPersonDeterministicSeed } from '../lib/bibleVerses';
import { getSystemSettingsFromFirestore, auth, SUPER_ADMIN_EMAIL } from '../lib/firebase';
import { AdditionalAttendeesForm, buildExpectedAttendees } from './AdditionalAttendeesForm';
import { DigitalConferenceBadge } from './DigitalConferenceBadge';
import { JubileePrayerCard } from './JubileePrayerCard';
import { RegistrationData, AdditionalAttendee } from '../types';
import { AttendeePassItem } from '../lib/ticketGenerator';
import { toProperCase } from '../lib/utils';
import { HitPayRegistrationPayment } from './HitPayRegistrationPayment';
import { PersonalContributionPayment } from './PersonalContributionPayment';

export interface ConferenceRegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  formData: {
    name: string;
    email: string;
    phone: string;
    adultsCount: number;
    teensCount: number;
    preteensCount: number;
    childrenCount: number;
    kidsCount: number;
    toddlersCount: number;
    comments: string;
    pdpaConsent: boolean;
    honeypot: string;
  };
  setFormData: React.Dispatch<React.SetStateAction<{
    name: string;
    email: string;
    phone: string;
    adultsCount: number;
    teensCount: number;
    preteensCount: number;
    childrenCount: number;
    kidsCount: number;
    toddlersCount: number;
    comments: string;
    pdpaConsent: boolean;
    honeypot: string;
  }>>;
  additionalAttendees: AdditionalAttendee[];
  setAdditionalAttendees: React.Dispatch<React.SetStateAction<AdditionalAttendee[]>>;
  errors: Record<string, string>;
  setErrors: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  handleInputChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  handleInputBlur: () => void;
  updateCount: (field: 'adultsCount' | 'teensCount' | 'preteensCount' | 'childrenCount' | 'kidsCount' | 'toddlersCount', delta: number) => void;
  existingRegFound: RegistrationData | null;
  existingConferenceReg: RegistrationData | null;
  existingDocId: string | null;
  showExistingBanner: boolean;
  handleCloseNoticeBanner: (e?: React.MouseEvent) => void;
  detailsLoadedMessage: string | null;
  setDetailsLoadedMessage: (msg: string | null) => void;
  isSubmitted: boolean;
  setIsSubmitted: (val: boolean) => void;
  isSubmitting: boolean;
  allPasses: AttendeePassItem[];
  emailNoticeData: {
    status?: string;
    sentEmails?: string[];
    recipientCount?: number;
    message?: string;
  } | null;
  downloadIndividualPassPDF: (pass: AttendeePassItem) => void;
  onFinalSubmit: (paymentDetails: {
    paymentRequestId: string;
    amount: number;
    baseFee: number;
    additionalContribution: number;
    referenceNumber: string;
  }) => Promise<void>;
  existingPaidAmount: number;
  formRef: React.RefObject<HTMLDivElement>;
  validateFormAndScrollToError: () => boolean;
  onResetForNewRegistration: () => void;
  checkoutReturnRef?: string | null;
}

export const ConferenceRegistrationModal: React.FC<ConferenceRegistrationModalProps> = ({
  isOpen,
  onClose,
  formData,
  setFormData,
  additionalAttendees,
  setAdditionalAttendees,
  errors,
  setErrors,
  handleInputChange,
  handleInputBlur,
  updateCount,
  existingRegFound,
  existingConferenceReg,
  existingDocId,
  showExistingBanner,
  handleCloseNoticeBanner,
  detailsLoadedMessage,
  setDetailsLoadedMessage,
  isSubmitted,
  setIsSubmitted,
  isSubmitting,
  allPasses,
  emailNoticeData,
  downloadIndividualPassPDF,
  onFinalSubmit,
  existingPaidAmount = 0,
  formRef,
  validateFormAndScrollToError,
  onResetForNewRegistration,
  checkoutReturnRef
}) => {
  // 4-Step Wizard Flow:
  // Step 1: Attendees Details & PDPA Consent
  // Step 2: Registration Love Offering (HitPay PayNow QR Code)
  // Step 3: Optional Additional Contribution (Default PayNow SG QR Code)
  // Step 4: Registration Success & Conference Pass
  const [activeStep, setActiveStep] = useState<1 | 2 | 3 | 4>(1);

  // Auto-handle checkout return from mobile HitPay payment flow
  useEffect(() => {
    if (checkoutReturnRef && isOpen) {
      setActiveStep(2);
      setPaynowRef(checkoutReturnRef);
      setPaymentRequestId(checkoutReturnRef);

      const checkReturnStatus = async () => {
        try {
          const res = await fetch(`/api/hitpay?action=check-status&id=${encodeURIComponent(checkoutReturnRef)}`);
          if (res.ok) {
            const data = await res.json().catch(() => null);
            if (data && (data.paymentStatus === 'succeeded' || data.paymentStatus === 'completed' || data.paymentStatus === 'paid' || data.status === 'completed')) {
              setPaymentStatus('succeeded');
              setSavedBasePayment({
                reqId: checkoutReturnRef,
                ref: checkoutReturnRef
              });
            }
          }
        } catch (err) {
          console.warn('Mobile checkout return status check error:', err);
        }
      };
      checkReturnStatus();
    }
  }, [checkoutReturnRef, isOpen]);

  // Synchronize activeStep when isSubmitted is toggled
  useEffect(() => {
    if (isSubmitted) {
      setActiveStep(4);
    } else if (activeStep === 4 && !isSubmitted) {
      setActiveStep(1);
    }
  }, [isSubmitted]);

  // Paying Attendees ($25 each for adults/youths and teens)
  const payingAttendees = (Number(formData.adultsCount) || 0) + (Number(formData.teensCount) || 0);
  const uncappedBaseFee = payingAttendees * 25;
  const isAutoFamily = payingAttendees >= 4;

  const [isFamilyCapApplied, setIsFamilyCapApplied] = useState<boolean>(true);
  const [additionalContribution, setAdditionalContribution] = useState<number | string>(0);
  const extraContribNum = Math.max(0, parseFloat(String(additionalContribution)) || 0);

  // Auto-apply family cap if 4+ paying attendees
  useEffect(() => {
    if (payingAttendees >= 4) {
      setIsFamilyCapApplied(true);
    }
  }, [payingAttendees]);

  // Base fee calculation
  const baseFee = isFamilyCapApplied ? Math.min(uncappedBaseFee, 100) : uncappedBaseFee;
  const prevPaid = Math.max(0, Number(existingPaidAmount) || 0);
  const baseAmountDue = Math.max(0, baseFee - prevPaid);
  const isBaseAlreadyPaid = (Boolean(existingConferenceReg || existingRegFound) || prevPaid > 0 || baseFee === 0) && baseAmountDue <= 0;
  const amountToCharge = isBaseAlreadyPaid ? 0 : (prevPaid > 0 ? baseAmountDue : baseFee);

  // HitPay / PayNow State for Step 2
  const [isGeneratingQr, setIsGeneratingQr] = useState<boolean>(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [paynowRef, setPaynowRef] = useState<string>('');
  const [paymentRequestId, setPaymentRequestId] = useState<string>('');
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'pending' | 'succeeded' | 'failed'>('idle');
  const [copiedUen, setCopiedUen] = useState<boolean>(false);
  const [copiedRef, setCopiedRef] = useState<boolean>(false);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState<boolean>(false);
  const [savedBasePayment, setSavedBasePayment] = useState<{ reqId: string; ref: string } | null>(null);

  // PayNow State for Step 3 (Optional Additional Contribution)
  const [contribQrCodeDataUrl, setContribQrCodeDataUrl] = useState<string>('');
  const [contribPaynowRef, setContribPaynowRef] = useState<string>('');
  const [isGeneratingContribQr, setIsGeneratingContribQr] = useState<boolean>(false);
  const [copiedContribUen, setCopiedContribUen] = useState<boolean>(false);
  const [copiedContribRef, setCopiedContribRef] = useState<boolean>(false);
  const [isContribSimulating, setIsContribSimulating] = useState<boolean>(false);

  // Copy Pass ID toast in Step 4
  const [copiedPassId, setCopiedPassId] = useState<boolean>(false);

  // Default PayNow UEN for Step 3 Voluntary Love Offering via HitPay
  const contribPaynowMobile = '201605888W';

  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Clean up polling timer on unmount
  useEffect(() => {
    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
      }
    };
  }, []);

  // Compute reference pass ID
  const primaryPassId = useMemo(() => {
    if (existingConferenceReg?.passId) return existingConferenceReg.passId;
    if (existingRegFound?.passId) return existingRegFound.passId;
    if (allPasses.length > 0 && allPasses[0].passId) return allPasses[0].passId;
    const personSeed = getPersonDeterministicSeed(formData.email, formData.phone, formData.name);
    return getBibleVersePassId(personSeed || existingDocId, 0, formData.name);
  }, [existingConferenceReg, existingRegFound, allPasses, existingDocId, formData.email, formData.phone, formData.name]);

  // Generate dynamic QR code for Step 2 whenever Step 2 is active or fee changes
  const generateStep2QR = useCallback(async () => {
    if (amountToCharge <= 0) {
      setPaymentStatus('succeeded');
      return;
    }

    setIsGeneratingQr(true);
    const computedPass = primaryPassId;
    let data: any = null;

    try {
      const res = await fetch('/api/hitpay/create-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: amountToCharge,
          baseFee,
          additionalContribution: 0,
          currency: 'SGD',
          name: formData.name || 'Participant',
          email: formData.email,
          phone: formData.phone,
          purpose: `GRACIA Jubilee Registration Love Offering ${prevPaid > 0 ? '(Additional Pax Fee)' : ''} - ${formData.name || 'Participant'} (${computedPass})`,
          referenceNumber: computedPass,
          passId: computedPass,
          isFamily: isFamilyCapApplied,
          payingCount: payingAttendees
        })
      });

      if (res.ok) {
        data = await res.json().catch(() => null);
      }
    } catch (err) {
      console.warn('HitPay endpoint fetch warning (using client fallback):', err);
    }

    setIsGeneratingQr(false);

    const refStr = (data && data.referenceNumber) || computedPass;
    const reqId = (data && data.paymentRequestId) || `hitpay_req_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

    setPaymentRequestId(reqId);
    setPaynowRef(refStr);
    setPaymentStatus('pending');

    if (data && data.hitpayQrDataUrl) {
      setQrCodeDataUrl(data.hitpayQrDataUrl);
    } else {
      setQrCodeDataUrl(paynowQrImg);
    }
  }, [amountToCharge, baseFee, formData.name, formData.email, formData.phone, isFamilyCapApplied, payingAttendees, prevPaid, primaryPassId]);

  // Auto-generate QR when moving to Step 2 if not already generated or succeeded
  useEffect(() => {
    if (activeStep === 2) {
      if (amountToCharge <= 0 || isBaseAlreadyPaid) {
        setPaymentStatus('succeeded');
      } else if (!qrCodeDataUrl || paymentStatus === 'idle') {
        generateStep2QR();
      }
    }
  }, [activeStep, amountToCharge, isBaseAlreadyPaid, qrCodeDataUrl, paymentStatus, generateStep2QR]);

  // Polling check for Step 2 payment status
  useEffect(() => {
    if (activeStep !== 2 || !paymentRequestId || paymentStatus === 'succeeded') return;

    const checkStatus = async () => {
      try {
        const res = await fetch(`/api/hitpay/status/${paymentRequestId}`);
        if (res.ok) {
          const data = await res.json().catch(() => null);
          if (data && (data.paymentStatus === 'succeeded' || data.paymentStatus === 'completed' || data.paymentStatus === 'paid')) {
            if (pollTimerRef.current) clearInterval(pollTimerRef.current);
            setPaymentStatus('succeeded');
            setSavedBasePayment({
              reqId: paymentRequestId,
              ref: paynowRef || data.referenceNumber || `GRACIA-${Date.now()}`
            });
          }
        }
      } catch {
        // Silently continue
      }
    };

    pollTimerRef.current = setInterval(checkStatus, 3000);
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [activeStep, paymentRequestId, paymentStatus, paynowRef]);

  // Step 2: Handle manual verification against HitPay API
  const handleVerifyStep2Payment = async () => {
    setIsVerifying(true);
    setErrors(prev => ({ ...prev, step2: '' }));
    const currentReqId = paymentRequestId || `hitpay_req_${Date.now()}`;
    const activeRef = paynowRef || primaryPassId || `GRACIA-PAY-${Math.floor(100000 + Math.random() * 900000)}`;

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
          setPaymentStatus('succeeded');
          setSavedBasePayment({ reqId: currentReqId, ref: activeRef });
          setErrors(prev => ({ ...prev, step2: '' }));
        } else {
          setPaymentStatus('pending');
          setErrors(prev => ({
            ...prev,
            step2: data?.message || '❌ Payment NOT received on HitPay yet. Please scan the QR code and complete the transfer in your bank app first.'
          }));
        }
      } else {
        setPaymentStatus('pending');
        setErrors(prev => ({
          ...prev,
          step2: '❌ Payment NOT received on HitPay yet. Please scan the QR code and complete the transfer in your bank app first.'
        }));
      }
    } catch {
      setPaymentStatus('pending');
      setErrors(prev => ({
        ...prev,
        step2: '❌ Payment NOT received on HitPay yet. Please scan the QR code and complete the transfer in your bank app first.'
      }));
    } finally {
      setIsVerifying(false);
    }
  };

  // Generate QR for Step 3 (Optional Additional Contribution)
  const generateStep3QR = useCallback(async (amount: number) => {
    if (amount <= 0) {
      setContribQrCodeDataUrl('');
      return;
    }
    setIsGeneratingContribQr(true);
    const contribRefStr = `GIFT-${primaryPassId.replace(/^GRACIA-/, '')}`;
    setContribPaynowRef(contribRefStr);

    try {
      setContribQrCodeDataUrl(paynowQrImg);
    } catch (err) {
      console.warn('Contrib QR generation fallback:', err);
      setContribQrCodeDataUrl(paynowQrImg);
    } finally {
      setIsGeneratingContribQr(false);
    }
  }, [primaryPassId, contribPaynowMobile]);

  // Re-generate Step 3 QR when additional contribution changes
  useEffect(() => {
    if (activeStep === 3 && extraContribNum > 0) {
      generateStep3QR(extraContribNum);
    }
  }, [activeStep, extraContribNum, generateStep3QR]);

  // Navigation: Go from Step 1 to Step 2
  const handleProceedToStep2 = () => {
    if (!validateFormAndScrollToError()) {
      return;
    }
    setActiveStep(2);
    if (formRef.current) {
      formRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Navigation: Go from Step 2 to Step 3
  const handleProceedToStep3 = () => {
    if (amountToCharge > 0 && paymentStatus !== 'succeeded') {
      setErrors(prev => ({
        ...prev,
        step2: 'Please complete or verify the PayNow transfer before proceeding.'
      }));
      return;
    }
    setErrors(prev => ({ ...prev, step2: '' }));
    setActiveStep(3);
    if (formRef.current) {
      formRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Navigation: Finalize registration from Step 3
  const handleFinalizeFromStep3 = async (isContribTransferred: boolean) => {
    const resolvedReqId = savedBasePayment?.reqId || paymentRequestId || (prevPaid > 0 ? 'PREVIOUSLY_VERIFIED' : 'NO_BASE_FEE');
    const resolvedRef = savedBasePayment?.ref || paynowRef || (prevPaid > 0 ? 'PREVIOUSLY_VERIFIED' : primaryPassId);
    const finalAmount = amountToCharge + (isContribTransferred ? extraContribNum : 0);

    const paymentDetails = {
      paymentRequestId: resolvedReqId,
      amount: finalAmount,
      baseFee,
      additionalContribution: isContribTransferred ? extraContribNum : 0,
      referenceNumber: resolvedRef
    };

    await onFinalSubmit(paymentDetails);
    setActiveStep(4);
  };

  // Download all passes helper
  const handleDownloadAllPasses = () => {
    if (allPasses && allPasses.length > 0) {
      allPasses.forEach((pass, index) => {
        setTimeout(() => {
          downloadIndividualPassPDF(pass);
        }, index * 400);
      });
    }
  };

  // Copy helper
  const copyToClipboard = (text: string, setCopied: (v: boolean) => void) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  if (!isOpen) return null;

  return (
    <div ref={formRef} className="pt-6 max-w-4xl lg:max-w-5xl xl:max-w-6xl mx-auto scroll-mt-20 text-left">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="cream-card p-4 sm:p-7 md:p-8 border-2 border-[#E8752C]/30 relative shadow-2xl overflow-hidden rounded-3xl"
      >
        {/* Close Modal Button */}
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onClose();
          }}
          className="absolute top-4 right-4 p-2 rounded-full bg-[#241226]/10 hover:bg-[#241226]/20 text-[#241226] transition-colors cursor-pointer z-30"
          title="Close Registration Window"
          aria-label="Close Registration Window"
        >
          <X className="w-5 h-5" />
        </button>

        {/* STEP PROGRESS TRACKER */}
        <div className="mb-6 border-b border-[#241226]/10 pb-4 pr-10">
          <div className="flex items-center justify-between max-w-xl mx-auto relative">
            {/* Background Line */}
            <div className="absolute left-6 right-6 top-1/2 -translate-y-1/2 h-0.5 bg-[#241226]/15 -z-0" />
            
            {/* Step 1 Pill */}
            <div className="relative z-10 flex flex-col items-center">
              <button
                type="button"
                onClick={() => {
                  if (activeStep > 1 && !isSubmitted) setActiveStep(1);
                }}
                disabled={activeStep === 1 || isSubmitted}
                className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-bold text-xs sm:text-sm transition-all shadow-sm ${
                  activeStep === 1
                    ? 'bg-[#E8752C] text-white ring-4 ring-[#E8752C]/20 scale-105'
                    : activeStep > 1
                    ? 'bg-emerald-600 text-white cursor-pointer'
                    : 'bg-white border border-[#241226]/20 text-[#241226]/60'
                }`}
              >
                {activeStep > 1 ? <Check className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.5]" /> : '1'}
              </button>
              <span className={`text-[10px] sm:text-xs font-extrabold mt-1.5 whitespace-nowrap ${
                activeStep === 1 ? 'text-[#E8752C]' : activeStep > 1 ? 'text-emerald-700' : 'text-[#241226]/50'
              }`}>
                1. Attendees
              </span>
            </div>

            {/* Step 2 Pill */}
            <div className="relative z-10 flex flex-col items-center">
              <button
                type="button"
                onClick={() => {
                  if (activeStep > 2 && !isSubmitted) setActiveStep(2);
                }}
                disabled={activeStep <= 2 || isSubmitted}
                className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-bold text-xs sm:text-sm transition-all shadow-sm ${
                  activeStep === 2
                    ? 'bg-[#E8752C] text-white ring-4 ring-[#E8752C]/20 scale-105'
                    : activeStep > 2
                    ? 'bg-emerald-600 text-white cursor-pointer'
                    : 'bg-white border border-[#241226]/20 text-[#241226]/60'
                }`}
              >
                {activeStep > 2 ? <Check className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.5]" /> : '2'}
              </button>
              <span className={`text-[10px] sm:text-xs font-extrabold mt-1.5 whitespace-nowrap ${
                activeStep === 2 ? 'text-[#E8752C]' : activeStep > 2 ? 'text-emerald-700' : 'text-[#241226]/50'
              }`}>
                2. Reg Fee
              </span>
            </div>

            {/* Step 3 Pill */}
            <div className="relative z-10 flex flex-col items-center">
              <button
                type="button"
                onClick={() => {
                  if (activeStep > 3 && !isSubmitted) setActiveStep(3);
                }}
                disabled={activeStep <= 3 || isSubmitted}
                className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-bold text-xs sm:text-sm transition-all shadow-sm ${
                  activeStep === 3
                    ? 'bg-[#E8752C] text-white ring-4 ring-[#E8752C]/20 scale-105'
                    : activeStep > 3
                    ? 'bg-emerald-600 text-white cursor-pointer'
                    : 'bg-white border border-[#241226]/20 text-[#241226]/60'
                }`}
              >
                {activeStep > 3 ? <Check className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.5]" /> : '3'}
              </button>
              <span className={`text-[10px] sm:text-xs font-extrabold mt-1.5 whitespace-nowrap ${
                activeStep === 3 ? 'text-[#E8752C]' : activeStep > 3 ? 'text-emerald-700' : 'text-[#241226]/50'
              }`}>
                3. Love Offering
              </span>
            </div>

            {/* Step 4 Pill */}
            <div className="relative z-10 flex flex-col items-center">
              <div
                className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-bold text-xs sm:text-sm transition-all shadow-sm ${
                  activeStep === 4
                    ? 'bg-emerald-600 text-white ring-4 ring-emerald-500/20 scale-105'
                    : 'bg-white border border-[#241226]/20 text-[#241226]/60'
                }`}
              >
                {activeStep === 4 ? <Check className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.5]" /> : '4'}
              </div>
              <span className={`text-[10px] sm:text-xs font-extrabold mt-1.5 whitespace-nowrap ${
                activeStep === 4 ? 'text-emerald-700' : 'text-[#241226]/50'
              }`}>
                4. Pass
              </span>
            </div>
          </div>
        </div>

        {/* ------------------------------------------------------------- */}
        {/* PAGE 1: ATTENDEES & CONTACT DETAILS                           */}
        {/* ------------------------------------------------------------- */}
        {activeStep === 1 && !isSubmitted && (
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            className="space-y-6"
          >
            {/* Header */}
            <div className="text-center space-y-1">
              <span className="text-[11px] font-extrabold uppercase tracking-widest px-3 py-1 rounded-full bg-[#E8752C]/10 text-[#E8752C] border border-[#E8752C]/20 inline-block">
                STEP 1 OF 3 • ATTENDEES INFORMATION
              </span>
              <h2 className="font-poster text-2xl sm:text-3xl text-[#241226] tracking-wide">
                PRIMARY CONTACT & ATTENDEES
              </h2>
              <p className="text-xs sm:text-sm text-[#241226]/70 max-w-md mx-auto">
                Please provide your contact details, attendee breakdown, and confirm PDPA consent.
              </p>
            </div>

            {/* Loaded Confirmation Toast Alert */}
            {detailsLoadedMessage && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="p-3.5 rounded-xl bg-emerald-600 text-white font-bold text-xs shadow-lg flex items-center justify-between"
              >
                <div className="flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-200 shrink-0" />
                  <span>{detailsLoadedMessage}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setDetailsLoadedMessage(null)}
                  className="p-1 rounded-md hover:bg-emerald-700 text-white transition-colors cursor-pointer"
                  title="Dismiss notification"
                  aria-label="Dismiss notification"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </motion.div>
            )}

            {/* Existing Registration Loaded Banner */}
            {existingRegFound && showExistingBanner && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, height: 0 }}
                className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-amber-500/15 via-emerald-500/10 to-amber-500/20 border-2 border-amber-400/50 text-[#241226] space-y-3 shadow-md relative overflow-hidden"
              >
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={handleCloseNoticeBanner}
                  className="absolute top-3 right-3 p-1.5 rounded-full bg-amber-200/80 hover:bg-amber-300 text-amber-950 transition-colors cursor-pointer"
                  title="Close notice"
                  aria-label="Close notice"
                >
                  <X className="w-4 h-4" />
                </button>

                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-300/60 pb-2 pr-8">
                  <div className="flex items-center space-x-2 text-amber-950 font-black text-xs uppercase tracking-wider">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>EXISTING RECORD LOADED</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] font-bold bg-amber-200/90 text-amber-950 px-2 py-0.5 rounded-full border border-amber-300">
                      Registered: {new Date(existingRegFound.createdAt).toLocaleDateString()}
                    </span>
                    <span className="text-[10px] font-extrabold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-300 flex items-center space-x-1">
                      <Check className="w-3 h-3 text-emerald-600" />
                      <span>Details Loaded</span>
                    </span>
                  </div>
                </div>

                <p className="text-xs text-[#241226]/90 leading-relaxed font-semibold">
                  An existing registration record for <strong>{existingRegFound.name}</strong> (<span className="underline">{existingRegFound.email}</span>) was found and your saved details have been automatically loaded.
                </p>
              </motion.div>
            )}

            {/* Primary Registrant Info Form */}
            <div id="participant-details-section" className="space-y-4">
              <h3 className="font-poster text-lg text-[#241226] border-b border-[#241226]/10 pb-2 flex items-center space-x-2">
                <span className="w-6 h-6 rounded-full bg-[#E8752C] text-white text-xs flex items-center justify-center font-bold">1</span>
                <span>PRIMARY CONTACT DETAILS</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Name */}
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-wider text-[#241226]">
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name || ''}
                    onChange={handleInputChange}
                    onBlur={handleInputBlur}
                    placeholder="e.g. John Tan"
                    className={`w-full px-4 py-3 rounded-xl bg-white border ${errors.name ? 'border-red-500 ring-1 ring-red-500' : 'border-[#241226]/20'} text-[#241226] text-sm focus:outline-none focus:border-[#E8752C] focus:ring-1 focus:ring-[#E8752C] transition-all`}
                  />
                  {errors.name && <p className="text-[11px] text-red-500 font-medium">{errors.name}</p>}
                </div>

                {/* Email */}
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-wider text-[#241226]">
                    Email Address <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email || ''}
                    onChange={handleInputChange}
                    onBlur={handleInputBlur}
                    placeholder="john@example.com"
                    className={`w-full px-4 py-3 rounded-xl bg-white border ${errors.email ? 'border-red-500 ring-1 ring-red-500' : 'border-[#241226]/20'} text-[#241226] text-sm focus:outline-none focus:border-[#E8752C] focus:ring-1 focus:ring-[#E8752C] transition-all`}
                  />
                  {errors.email && <p className="text-[11px] text-red-500 font-medium">{errors.email}</p>}
                </div>
              </div>

              {/* Phone */}
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-[#241226]">
                  Contact Number (WhatsApp preferred) <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone || ''}
                  onChange={handleInputChange}
                  onBlur={handleInputBlur}
                  placeholder="+65 9123 4567"
                  className={`w-full px-4 py-3 rounded-xl bg-white border ${errors.phone ? 'border-red-500 ring-1 ring-red-500' : 'border-[#241226]/20'} text-[#241226] text-sm focus:outline-none focus:border-[#E8752C] focus:ring-1 focus:ring-[#E8752C] transition-all`}
                />
                {errors.phone && <p className="text-[11px] text-red-500 font-medium">{errors.phone}</p>}
              </div>
            </div>

            {/* Attendance Breakdown per Category */}
            <div className="space-y-4 pt-2">
              <div className="flex items-center justify-between border-b border-[#241226]/10 pb-2">
                <h3 className="font-poster text-lg text-[#241226] flex items-center space-x-2">
                  <span className="w-6 h-6 rounded-full bg-[#E8752C] text-white text-xs flex items-center justify-center font-bold">2</span>
                  <span>ATTENDEES COUNT BY CATEGORY</span>
                </h3>
                <span className="text-xs text-[#241226]/60 font-medium">Select counts for your party</span>
              </div>

              {errors.adultsCount && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-600 font-medium">
                  {errors.adultsCount}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Adults / Youths (20+) */}
                <div className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between shadow-sm ${
                  formData.adultsCount > 0 
                    ? 'bg-[#E8752C]/5 border-[#E8752C] ring-1 ring-[#E8752C]/20' 
                    : 'bg-white border-[#241226]/15 hover:border-[#241226]/30'
                }`}>
                  <div>
                    <div className="font-poster text-sm text-[#241226] flex items-center gap-1.5">
                      <span>ADULTS & YOUTHS</span>
                      <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded-full bg-[#E8752C]/15 text-[#E8752C] border border-[#E8752C]/30 uppercase tracking-tight">Main / Party</span>
                    </div>
                    <div className="text-[11px] text-[#241226]/60">20+ years old ($25)</div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => updateCount('adultsCount', -1)}
                      disabled={formData.adultsCount <= 0}
                      className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed text-gray-700 font-bold text-base flex items-center justify-center transition-colors cursor-pointer"
                    >
                      -
                    </button>
                    <span className="w-6 text-center font-bold text-sm text-[#241226]">{formData.adultsCount}</span>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => updateCount('adultsCount', 1)}
                      className="w-8 h-8 rounded-lg bg-[#E8752C] hover:bg-[#d06420] text-white font-bold text-base flex items-center justify-center transition-colors cursor-pointer shadow-sm"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Teens (13-19) */}
                <div className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between shadow-sm ${
                  formData.teensCount > 0 
                    ? 'bg-[#C81E6E]/5 border-[#C81E6E] ring-1 ring-[#C81E6E]/20' 
                    : 'bg-white border-[#241226]/15 hover:border-[#241226]/30'
                }`}>
                  <div>
                    <div className="font-poster text-sm text-[#241226] flex items-center gap-1.5">
                      <span>TEENS & YOUTHS</span>
                      <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded-full bg-[#C81E6E]/15 text-[#C81E6E] border border-[#C81E6E]/30 uppercase tracking-tight">Main / Party</span>
                    </div>
                    <div className="text-[11px] text-[#241226]/60">13–19 years old ($25)</div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => updateCount('teensCount', -1)}
                      disabled={formData.teensCount <= 0}
                      className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed text-gray-700 font-bold text-base flex items-center justify-center transition-colors cursor-pointer"
                    >
                      -
                    </button>
                    <span className="w-6 text-center font-bold text-sm text-[#241226]">{formData.teensCount}</span>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => updateCount('teensCount', 1)}
                      className="w-8 h-8 rounded-lg bg-[#C81E6E] hover:bg-[#a8165a] text-white font-bold text-base flex items-center justify-center transition-colors cursor-pointer shadow-sm"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Pre-Teens (9-12) */}
                <div className="p-3.5 rounded-2xl bg-white border border-[#241226]/15 flex items-center justify-between shadow-sm">
                  <div>
                    <div className="font-poster text-sm text-[#241226]">PRE-TEENS</div>
                    <div className="text-[11px] text-[#241226]/60">9–12 years old (Free)</div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => updateCount('preteensCount', -1)}
                      className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-base flex items-center justify-center transition-colors cursor-pointer"
                    >
                      -
                    </button>
                    <span className="w-6 text-center font-bold text-sm text-[#241226]">{formData.preteensCount}</span>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => updateCount('preteensCount', 1)}
                      className="w-8 h-8 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-base flex items-center justify-center transition-colors cursor-pointer"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Children (6-8) */}
                <div className="p-3.5 rounded-2xl bg-white border border-[#241226]/15 flex items-center justify-between shadow-sm">
                  <div>
                    <div className="font-poster text-sm text-[#241226]">CHILDREN</div>
                    <div className="text-[11px] text-[#241226]/60">6–8 years old (Free)</div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => updateCount('childrenCount', -1)}
                      className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-base flex items-center justify-center transition-colors cursor-pointer"
                    >
                      -
                    </button>
                    <span className="w-6 text-center font-bold text-sm text-[#241226]">{formData.childrenCount}</span>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => updateCount('childrenCount', 1)}
                      className="w-8 h-8 rounded-lg bg-[#E8B400] hover:bg-[#c99c00] text-white font-bold text-base flex items-center justify-center transition-colors cursor-pointer"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Kids (3-5) */}
                <div className="p-3.5 rounded-2xl bg-white border border-[#241226]/15 flex items-center justify-between shadow-sm">
                  <div>
                    <div className="font-poster text-sm text-[#241226]">KIDS</div>
                    <div className="text-[11px] text-[#241226]/60">3–5 years old (Free)</div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => updateCount('kidsCount', -1)}
                      className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-base flex items-center justify-center transition-colors cursor-pointer"
                    >
                      -
                    </button>
                    <span className="w-6 text-center font-bold text-sm text-[#241226]">{formData.kidsCount}</span>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => updateCount('kidsCount', 1)}
                      className="w-8 h-8 rounded-lg bg-sky-500 hover:bg-sky-600 text-white font-bold text-base flex items-center justify-center transition-colors cursor-pointer"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Toddlers (2 & below) */}
                <div className="p-3.5 rounded-2xl bg-white border border-[#241226]/15 flex items-center justify-between shadow-sm">
                  <div>
                    <div className="font-poster text-sm text-[#241226]">TODDLERS</div>
                    <div className="text-[11px] text-[#241226]/60">2 & below (Free)</div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => updateCount('toddlersCount', -1)}
                      className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-base flex items-center justify-center transition-colors cursor-pointer"
                    >
                      -
                    </button>
                    <span className="w-6 text-center font-bold text-sm text-[#241226]">{formData.toddlersCount}</span>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => updateCount('toddlersCount', 1)}
                      className="w-8 h-8 rounded-lg bg-purple-500 hover:bg-purple-600 text-white font-bold text-base flex items-center justify-center transition-colors cursor-pointer"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Additional Attendees Form */}
            <AdditionalAttendeesForm
              adultsCount={Number(formData.adultsCount)}
              teensCount={Number(formData.teensCount)}
              preteensCount={Number(formData.preteensCount)}
              childrenCount={Number(formData.childrenCount)}
              kidsCount={Number(formData.kidsCount)}
              toddlersCount={Number(formData.toddlersCount)}
              attendees={additionalAttendees}
              onChange={setAdditionalAttendees}
              errors={errors}
            />

            {/* Special Remarks / Dietary Requirements */}
            <div className="space-y-1 pt-2">
              <label className="text-xs font-bold uppercase tracking-wider text-[#241226]">
                Dietary / Accessibility / Special Remarks (Optional)
              </label>
              <textarea
                name="comments"
                value={formData.comments || ''}
                onChange={handleInputChange}
                rows={2}
                placeholder="e.g., Vegetarian, Wheelchair access required, etc."
                className="w-full px-4 py-3 rounded-xl bg-white border border-[#241226]/20 text-[#241226] text-sm focus:outline-none focus:border-[#E8752C] focus:ring-1 focus:ring-[#E8752C] transition-all resize-none"
              />
            </div>

            {/* PDPA Consent Checkbox */}
            <div className="space-y-1 pt-1">
              <p className="text-xs text-[#241226]/80 leading-relaxed mb-1.5">
                By submitting this form, I acknowledge that I have read and agree to the privacy policy outlined in the Personal Data Protection Act (PDPA) at{' '}
                <a
                  href="https://singapore.jesusyouth.org/jy-data-protection-act/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline text-[#2242A6] hover:text-[#C81E6E] font-semibold break-all"
                >
                  https://singapore.jesusyouth.org/jy-data-protection-act/
                </a>.
              </p>
              <label className="flex items-start space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  name="pdpaConsent"
                  checked={formData.pdpaConsent}
                  onChange={handleInputChange}
                  className="mt-0.5 w-4 h-4 rounded border-gray-300 text-[#E8752C] focus:ring-[#E8752C] cursor-pointer shrink-0"
                />
                <span className="text-xs text-[#241226]/90 font-medium leading-snug">
                  By registering, I consent to Jesus Youth Singapore collecting and using my contact details for event logistics, communication, and updates regarding GRACIA Jubilee Celebration 2026. <span className="text-red-500">*</span>
                </span>
              </label>
              {errors.pdpaConsent && (
                <p className="text-[11px] text-red-500 font-medium pl-7">{errors.pdpaConsent}</p>
              )}
            </div>

            {/* Error banner if any */}
            {errors.form && (
              <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-600 font-semibold flex items-center space-x-2">
                <Info className="w-4 h-4 text-red-500 shrink-0" />
                <span>{errors.form}</span>
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="pt-4 flex justify-end">
              <button
                type="button"
                onClick={handleProceedToStep2}
                className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-signature-animated text-white font-poster text-lg tracking-wider shadow-xl hover:opacity-95 transition-all flex items-center justify-center space-x-3 cursor-pointer"
              >
                <span>PROCEED TO REGISTRATION LOVE OFFERING</span>
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </motion.div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* PAGE 2: OFFICIAL HITPAY REGISTRATION PAYMENT                   */}
        {/* ------------------------------------------------------------- */}
        {activeStep === 2 && !isSubmitted && (
          <motion.div
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            className="space-y-6"
          >
            <div className="text-center space-y-1">
              <span className="text-[11px] font-extrabold uppercase tracking-widest px-3 py-1 rounded-full bg-[#E8752C]/10 text-[#E8752C] border border-[#E8752C]/20 inline-block">
                STEP 2 OF 3 • REGISTRATION LOVE OFFERING (CORPORATE PAYNOW UEN)
              </span>
              <h2 className="font-poster text-2xl sm:text-3xl text-[#241226] tracking-wide">
                CONFERENCE REGISTRATION CHECKOUT
              </h2>
            </div>

            {amountToCharge <= 0 || isBaseAlreadyPaid ? (
              <div className="p-6 rounded-3xl bg-emerald-50 border-2 border-emerald-400 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                  <Check className="w-6 h-6 stroke-[3]" />
                </div>
                <h3 className="font-poster text-xl text-emerald-900">NO REGISTRATION LOVE OFFERING DUE</h3>
                <p className="text-xs text-emerald-800 font-medium">
                  {prevPaid > 0 ? 'Your registration love offering is already fully covered by previous payments.' : 'All registered attendees belong to free categories.'}
                </p>
                <button
                  type="button"
                  onClick={() => setActiveStep(3)}
                  className="px-6 py-3 rounded-xl bg-purple-700 text-white font-bold text-xs hover:bg-purple-800 transition"
                >
                  Continue to Voluntary Personal Contribution →
                </button>
              </div>
            ) : (
              <HitPayRegistrationPayment
                amount={amountToCharge}
                referenceNumber={paynowRef || primaryPassId || `GRACIA-${Date.now()}`}
                userName={formData.name}
                userEmail={formData.email}
                userPhone={formData.phone}
                purpose={`GRACIA Jubilee Registration (${primaryPassId || 'Delegate'})`}
                onPaymentCompleted={(details) => {
                  setSavedBasePayment({ reqId: details.paymentRequestId, ref: details.referenceNumber });
                  setPaymentStatus('succeeded');
                  setActiveStep(3);
                }}
                onSkipOrBypass={() => {
                  setPaymentStatus('succeeded');
                  setActiveStep(3);
                }}
              />
            )}

            <div className="pt-2 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setActiveStep(1)}
                className="px-4 py-2 bg-stone-100 hover:bg-stone-200 rounded-xl text-xs font-semibold text-stone-700 transition flex items-center space-x-1"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Back to Attendees</span>
              </button>
            </div>
          </motion.div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* PAGE 3: OPTIONAL PERSONAL VOLUNTARY CONTRIBUTION               */}
        {/* ------------------------------------------------------------- */}
        {activeStep === 3 && !isSubmitted && (
          <motion.div
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            className="space-y-6"
          >
            <div className="text-center space-y-1">
              <span className="text-[11px] font-extrabold uppercase tracking-widest px-3 py-1 rounded-full bg-rose-100 text-rose-800 border border-rose-200 inline-block">
                STEP 3 OF 3 • OPTIONAL PERSONAL VOLUNTARY CONTRIBUTION
              </span>
            </div>

            <PersonalContributionPayment
              registrationRef={savedBasePayment?.ref || primaryPassId || 'GRACIA-JUBILEE'}
              onCompleted={async () => {
                await handleFinalizeFromStep3(true);
              }}
              onSkip={async () => {
                await handleFinalizeFromStep3(false);
              }}
            />

            <div className="pt-2 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setActiveStep(2)}
                className="px-4 py-2 bg-stone-100 hover:bg-stone-200 rounded-xl text-xs font-semibold text-stone-700 transition flex items-center space-x-1"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Back to Registration Checkout</span>
              </button>
            </div>
          </motion.div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* PAGE 4: REGISTRATION SUCCESS & CONFERENCE PASS                */}
        {/* ------------------------------------------------------------- */}
        {(activeStep === 4 || isSubmitted) && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-4 space-y-6"
          >
            {/* Celebratory Icon */}
            <motion.div 
              initial={{ scale: 0 }} 
              animate={{ scale: 1 }} 
              transition={{ type: "spring" }}
              className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner ring-8 ring-emerald-50"
            >
              <CheckCircle2 className="w-12 h-12" />
            </motion.div>

            {/* Titles */}
            <div className="space-y-2">
              <h3 className="font-poster text-3xl sm:text-4xl text-[#241226]">REGISTRATION CONFIRMED!</h3>
              <p className="text-sm text-[#241226]/80 max-w-lg mx-auto">
                Praise God! Thank you, <strong>{toProperCase(formData.name)}</strong>. Your conference registration has been recorded for <strong>{formData.email}</strong>.
              </p>
            </div>

            {/* Prominent Conference Pass ID Showcase Card */}
            <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-[#241226] via-[#3a1548] to-[#241226] text-white max-w-xl mx-auto shadow-xl border-2 border-amber-400/60 text-center space-y-2">
              <span className="text-[11px] font-extrabold uppercase tracking-widest text-amber-300">
                OFFICIAL CONFERENCE PASS ID
              </span>
              <div className="flex items-center justify-center space-x-3">
                <span className="font-mono text-xl sm:text-2xl font-black text-amber-300 tracking-wider">
                  {primaryPassId}
                </span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(primaryPassId, setCopiedPassId)}
                  className="px-3 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 border border-white/20 text-white text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer"
                  title="Copy Pass ID"
                >
                  {copiedPassId ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedPassId ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <p className="text-[11px] text-white/70">Please present this pass or individual QR codes for venue check-in</p>
            </div>

            {/* Email Dispatch Notice */}
            <div className="p-4 rounded-2xl bg-emerald-50 border-2 border-emerald-300 text-emerald-950 text-left max-w-xl mx-auto space-y-2 shadow-md">
              <div className="flex items-center space-x-2 font-bold text-emerald-900 text-sm">
                <Mail className="w-5 h-5 text-emerald-600 shrink-0" />
                <span>
                  {emailNoticeData?.status === 'sent' ? 'Confirmation Emails Sent Successfully!' : 'Pass Details Dispatched!'}
                </span>
              </div>
              <p className="text-xs text-emerald-800 leading-relaxed font-medium">
                {emailNoticeData?.sentEmails && emailNoticeData.sentEmails.length > 0 ? (
                  <>
                    Official conference pass(es) and individual QR entry code(s) have been emailed to:{' '}
                    <strong className="underline text-emerald-950">{emailNoticeData.sentEmails.join(', ')}</strong>.
                  </>
                ) : (
                  <>
                    A confirmation notification with your pass and entry QR code has been sent to <strong className="underline text-emerald-950">{formData.email}</strong>.
                  </>
                )}
              </p>
            </div>

            {/* Individual Digital Conference Badges */}
            {allPasses.length > 0 && (
              <div className="pt-2 max-w-4xl lg:max-w-5xl mx-auto space-y-4 text-left w-full">
                <div className="flex items-center justify-between border-b border-[#241226]/10 pb-2">
                  <h4 className="font-poster text-lg text-[#241226] flex items-center gap-2">
                    <QrCode className="w-5 h-5 text-[#E8752C]" />
                    <span>INDIVIDUAL ENTRY PASSES & QR CODES ({allPasses.length})</span>
                  </h4>
                  <span className="text-xs font-bold text-[#241226]/60">Scan at Venue Check-in</span>
                </div>

                <div className={allPasses.length === 1 ? "flex justify-center" : "grid grid-cols-1 md:grid-cols-2 gap-6 w-full justify-items-center"}>
                  {allPasses.map((pass, pIdx) => (
                    <div key={`conf-pass-${pIdx}`} className="w-full flex justify-center">
                      <DigitalConferenceBadge
                        pass={pass}
                        pIdx={pIdx}
                        onDownloadPdf={downloadIndividualPassPDF}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            <JubileePrayerCard />

            {/* What Happens Next Card */}
            <div className="p-4 rounded-2xl bg-[#241226]/5 border border-[#241226]/10 text-xs text-[#241226]/70 max-w-md mx-auto space-y-2">
              <p className="font-semibold text-[#241226]">What happens next?</p>
              <p>You will receive a confirmation email with venue details and schedule updates shortly. We look forward to celebrating 25 years with you!</p>
            </div>

            {/* Action Buttons: Download PDF, Close Window, Register Another */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              {allPasses.length > 1 && (
                <button
                  type="button"
                  onClick={handleDownloadAllPasses}
                  className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-[#E8752C] hover:bg-[#d06420] text-white font-poster tracking-wide text-sm transition-colors flex items-center justify-center space-x-2 cursor-pointer shadow-md"
                >
                  <Download className="w-4 h-4" />
                  <span>DOWNLOAD ALL PASSES (PDF)</span>
                </button>
              )}

              <button
                type="button"
                onClick={onClose}
                className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-[#241226] hover:bg-[#241226]/90 text-white font-poster tracking-wide text-sm transition-colors cursor-pointer shadow-md"
              >
                CLOSE WINDOW
              </button>

              <button
                type="button"
                onClick={onResetForNewRegistration}
                className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-poster tracking-wide text-sm transition-colors cursor-pointer shadow-md"
              >
                REGISTER ANOTHER PASS
              </button>
            </div>
          </motion.div>
        )}

      </motion.div>
    </div>
  );
};

export default ConferenceRegistrationModal;
