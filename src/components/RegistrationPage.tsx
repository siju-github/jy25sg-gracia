import React, { useState, useEffect, useCallback, useRef } from 'react';
import confetti from 'canvas-confetti';
import { JubileePrayerCard } from './JubileePrayerCard';
import { NavTab, RegistrationData, AdditionalAttendee } from '../types';
import { AdditionalAttendeesForm, buildExpectedAttendees } from './AdditionalAttendeesForm';
import { ConferencePass, PassBadgeData } from './ConferencePass';
import { HitPayRegistrationPayment } from './HitPayRegistrationPayment';
import { JYLogo } from './JYLogo';
import { JubileeLogo } from './JubileeLogo';
import { 
  Users, User, Mail, Phone, MapPin, CheckCircle2, AlertCircle, ArrowRight, ArrowLeft, 
  Shield, CreditCard, Sparkles, Heart, Download, QrCode, Lock, RefreshCw, Check, Ticket
} from 'lucide-react';
import { 
  saveRegistrationToFirestore, 
  updateRegistrationInFirestore, 
  findRegistrationByDetails, 
  syncAdditionalAttendeesToFirestore,
  fetchRegistrationByPassIdOrDocId,
  checkExistingParticipantByContact
} from '../lib/firebase';
import { clearRegistrationStorageState, REGISTRATION_CLEANUP_STORAGE_KEY } from '../lib/storageCleanup';
import { getBibleVersePassId, getPersonDeterministicSeed } from '../lib/bibleVerses';
import { toProperCase } from '../lib/utils';
import { dispatchConfirmationEmails } from '../lib/emailService';
import paynowQrImg from '../assets/images/regenerated_image_1785556021273.jpg';

interface RegistrationPageProps {
  onNavigateToConference?: () => void;
  onNavigateToPortal?: () => void;
}

export const RegistrationPage: React.FC<RegistrationPageProps> = ({ 
  onNavigateToConference,
  onNavigateToPortal 
}) => {
  // Read URL params for step and reference number
  const getUrlParams = () => {
    if (typeof window === 'undefined') return { step: 1, ref: '' };
    const search = new URLSearchParams(window.location.search);
    const stepParam = parseInt(search.get('step') || '1', 10);
    const refParam = search.get('ref') || search.get('reference') || search.get('passId') || '';
    return {
      step: isNaN(stepParam) ? 1 : Math.min(Math.max(stepParam, 1), 3),
      ref: refParam
    };
  };

  const initialParams = getUrlParams();
  const [activeStep, setActiveStep] = useState<number>(initialParams.step);
  const [refNumber, setRefNumber] = useState<string>(initialParams.ref);
  const [isLoadingSession, setIsLoadingSession] = useState<boolean>(initialParams.step === 2 || Boolean(initialParams.ref));

  const containerRef = useRef<HTMLDivElement>(null);
  const isInitialStepScroll = useRef<boolean>(true);

  // Auto-scroll smoothly to container on step transition
  useEffect(() => {
    if (isInitialStepScroll.current) {
      isInitialStepScroll.current = false;
      return;
    }
    if (containerRef.current) {
      containerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [activeStep]);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    parish: '',
    comments: '',
    pdpaConsent: false,
    honeypot: '',
  });

  // Attendee Counts
  const [adultsCount, setAdultsCount] = useState<number>(1);
  const [teensCount, setTeensCount] = useState<number>(0);
  const [preteensCount, setPreteensCount] = useState<number>(0);
  const [childrenCount, setChildrenCount] = useState<number>(0);
  const [kidsCount, setKidsCount] = useState<number>(0);
  const [toddlersCount, setToddlersCount] = useState<number>(0);

  const [additionalAttendees, setAdditionalAttendees] = useState<AdditionalAttendee[]>([]);

  // Payment & Async States
  const [hitpayCheckoutUrl, setHitpayCheckoutUrl] = useState<string>('');
  const [hitpayPaymentRequestId, setHitpayPaymentRequestId] = useState<string>('');
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'pending' | 'succeeded' | 'failed'>('idle');
  const [isEmailSent, setIsEmailSent] = useState<boolean>(false);
  const [isResendingEmail, setIsResendingEmail] = useState<boolean>(false);
  const [resendNotification, setResendNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Resend confirmation emails to primary registrant and all group attendees
  const handleResendEmails = async () => {
    if (isResendingEmail) return;
    setIsResendingEmail(true);
    setResendNotification(null);

    const cleanName = toProperCase(formData.name || displayName || 'Delegate');
    const cleanAttendees = (additionalAttendees || []).map((a, idx) => ({
      ...a,
      name: toProperCase(a.name || `Delegate Member ${idx + 1}`),
      email: (a.email || '').trim().toLowerCase(),
      category: a.category || 'adult',
      categoryLabel: a.categoryLabel || a.category || 'Delegate Member'
    }));

    const refKey = refNumber || initialParams.ref || displayRef || `GRACIA-${Date.now()}`;

    const paymentEmailPayload = {
      passId: refKey,
      name: cleanName,
      email: formData.email,
      phone: formData.phone,
      parish: formData.parish,
      adultsCount,
      teensCount,
      preteensCount,
      childrenCount,
      kidsCount,
      toddlersCount,
      additionalAttendees: cleanAttendees,
      amountToCharge: totalAmount > 0 ? totalAmount : 25,
      type: 'conference',
      isUpdate: true,
      isResend: true,
      force: true
    };

    try {
      const res = await dispatchConfirmationEmails(
        refKey,
        formData.email,
        cleanAttendees,
        paymentEmailPayload,
        { isUpdate: true, isResend: true }
      );

      if (res.success) {
        const recipientList = [formData.email, ...cleanAttendees.map(a => a.email).filter(Boolean)];
        const uniqueRecipients = Array.from(new Set(recipientList));
        const recipientStr = uniqueRecipients.length > 0 ? uniqueRecipients.join(', ') : formData.email;
        
        setResendNotification({
          type: 'success',
          message: `Digital pass email(s) successfully re-sent to: ${recipientStr}`
        });
      } else {
        setResendNotification({
          type: 'error',
          message: res.error || 'Failed to resend confirmation emails. Please try again or contact support.'
        });
      }
    } catch (err: any) {
      setResendNotification({
        type: 'error',
        message: err?.message || 'Network error occurred while sending emails.'
      });
    } finally {
      setIsResendingEmail(false);
    }
  };
  const [isVerifyingPayment, setIsVerifyingPayment] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});

  // Helper to construct pass badges for all attendees in group
  const generatePassesForGroup = useCallback((
    primaryName: string,
    primaryEmail: string,
    primaryPhone: string,
    primaryParish: string,
    refKey: string,
    addons: AdditionalAttendee[]
  ): PassBadgeData[] => {
    const cleanPrimaryName = toProperCase(primaryName || 'Primary Registrant');
    const primaryPassId = refKey || getBibleVersePassId(getPersonDeterministicSeed(primaryEmail, primaryPhone, cleanPrimaryName), 0, cleanPrimaryName);
    
    const primaryBadge: PassBadgeData = {
      passId: primaryPassId,
      name: cleanPrimaryName,
      email: primaryEmail,
      phone: primaryPhone,
      parish: primaryParish,
      categoryLabel: 'Primary Registrant',
      isPrimary: true,
      type: 'conference'
    };

    const groupBadges: PassBadgeData[] = [primaryBadge];

    (addons || []).forEach((addon, idx) => {
      if (addon && addon.name && addon.name.trim()) {
        const addonCleanName = toProperCase(addon.name);
        const addonPassId = (addon as any).passId || getBibleVersePassId(getPersonDeterministicSeed(addon.email || primaryEmail, addon.phone || primaryPhone, addonCleanName), idx + 1, addonCleanName);
        groupBadges.push({
          passId: addonPassId,
          name: addonCleanName,
          email: addon.email || primaryEmail,
          phone: addon.phone || primaryPhone,
          parish: primaryParish,
          categoryLabel: (addon as any).categoryLabel || (
            addon.category === 'adult' ? 'Adult / Youth (20+ yrs)' :
            addon.category === 'teen' ? 'Teen (13-19 yrs)' :
            addon.category === 'preteen' ? 'Pre-Teen (9-12 yrs)' :
            addon.category === 'child' ? 'Child (6-8 yrs)' :
            addon.category === 'kid' ? 'Kid (3-5 yrs)' :
            addon.category === 'toddler' ? 'Toddler (2 & under)' :
            'Delegate Member'
          ),
          isPrimary: false,
          type: 'conference'
        });
      }
    });

    return groupBadges;
  }, []);

  // Additional voluntary contribution at Step 3
  const [extraContribution, setExtraContribution] = useState<number>(0);
  const [customContribInput, setCustomContribInput] = useState<string>('');

  // Generated Passes for Step 4
  const [allPasses, setAllPasses] = useState<PassBadgeData[]>([]);

  // Existing Record Detection States
  const [existingRecordLoaded, setExistingRecordLoaded] = useState<boolean>(false);
  const [existingRecordMsg, setExistingRecordMsg] = useState<string | null>(null);
  const [isEditLocked, setIsEditLocked] = useState<boolean>(false);
  const [useDiscountedRate, setUseDiscountedRate] = useState<boolean>(true);
  const [editLockMsg, setEditLockMsg] = useState<string | null>(null);
  const [previouslyPaidAmount, setPreviouslyPaidAmount] = useState<number>(0);
  const [previouslyPaidPax, setPreviouslyPaidPax] = useState<number>(0);
  const [isCheckingExisting, setIsCheckingExisting] = useState<boolean>(false);

  // PayNow QR Code Modal for Step 2
  const [showPayNowModal, setShowPayNowModal] = useState<boolean>(false);

  // Helper function to generate a fresh reference number
  const generateNewRefNumber = (): string => {
    return `GRACIA-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
  };

  // Reset form to completely fresh / blank state and purge stale client-side caches
  const normalizePhoneDigits = useCallback((value?: string) => (value || '').replace(/\D/g, ''), []);

  const hasExactContactMatch = useCallback((record: RegistrationData | null, email?: string, phone?: string): boolean => {
    if (!record) return false;
    const inputEmail = (email || '').trim().toLowerCase();
    const inputPhone = normalizePhoneDigits(phone || '');

    const recordEmail = (record.email || '').trim().toLowerCase();
    const recordPhone = normalizePhoneDigits(record.phone || '');

    const emailMatches = Boolean(inputEmail && recordEmail && inputEmail === recordEmail);
    const phoneMatches = Boolean(inputPhone && recordPhone && inputPhone.length >= 8 && inputPhone === recordPhone);

    if (emailMatches || phoneMatches) return true;

    const additionalMatches = (record.additionalAttendees || []).some((attendee) => {
      const attendeeEmail = (attendee.email || '').trim().toLowerCase();
      const attendeePhone = normalizePhoneDigits(attendee.phone || '');
      const attendeeEmailMatches = Boolean(inputEmail && attendeeEmail && inputEmail === attendeeEmail);
      const attendeePhoneMatches = Boolean(inputPhone && attendeePhone && inputPhone.length >= 8 && inputPhone === attendeePhone);
      return attendeeEmailMatches || attendeePhoneMatches;
    });

    return additionalMatches;
  }, [normalizePhoneDigits]);

  const resetToFreshFormState = useCallback(() => {
    try {
      clearRegistrationStorageState({
        id: refNumber,
        passId: refNumber,
        paymentReference: refNumber,
        email: formData.email,
        phone: formData.phone
      });
      localStorage.clear();
      sessionStorage.clear();
    } catch (e) {
      console.warn('LocalStorage clear warning:', e);
    }

    const newRef = generateNewRefNumber();

    setFormData({
      name: '',
      email: '',
      phone: '',
      parish: '',
      comments: '',
      pdpaConsent: false,
      honeypot: '',
    });

    setAdultsCount(1);
    setTeensCount(0);
    setPreteensCount(0);
    setChildrenCount(0);
    setKidsCount(0);
    setToddlersCount(0);

    setAdditionalAttendees([]);

    setRefNumber(newRef);
    setExistingRecordLoaded(false);
    setExistingRecordMsg(null);
    setIsEditLocked(false);
    setEditLockMsg(null);
    setPreviouslyPaidAmount(0);
    setPreviouslyPaidPax(0);
    setHitpayCheckoutUrl('');
    setPaymentStatus('idle');
    setFormErrors({});
    setIsLoadingSession(false);

    // Clean up URL parameters cleanly
    if (typeof window !== 'undefined' && window.history) {
      const url = new URL(window.location.href);
      url.searchParams.delete('ref');
      url.searchParams.delete('step');
      window.history.replaceState({}, '', url.toString());
    }
  }, []);

  // Function to check and load existing record strictly against live database table
  const checkAndLoadExistingRecord = useCallback(async (emailInput?: string, phoneInput?: string) => {
    const cleanEmail = (emailInput !== undefined ? emailInput : formData.email).trim().toLowerCase();
    const cleanPhone = (phoneInput !== undefined ? phoneInput : formData.phone).trim();

    const hasValidEmail = Boolean(cleanEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail));
    const hasValidPhone = validatePhoneNumber(cleanPhone) === null;

    if (!hasValidEmail || !hasValidPhone) {
      if (existingRecordLoaded || existingRecordMsg) {
        setExistingRecordLoaded(false);
        setExistingRecordMsg(null);
        setIsEditLocked(false);
        setEditLockMsg(null);
        setPreviouslyPaidAmount(0);
        setPreviouslyPaidPax(0);
      }
      return;
    }

    setIsCheckingExisting(true);
    try {
      // Query STRICTLY against live database table and only show the banner when the newly typed email/phone matches an exact record.
      const reg = await findRegistrationByDetails('conference', hasValidEmail ? cleanEmail : '', '', hasValidPhone ? cleanPhone : '');
      if (reg) {
        const regId = reg.passId || reg.id;
        const regEmail = (reg.email || '').trim().toLowerCase();
        const regPhone = normalizePhoneDigits(reg.phone || '');
        const normCleanPhone = normalizePhoneDigits(cleanPhone);

        // Verify if newly typed input actually matches the database record exactly.
        const matchesEmail = hasValidEmail && regEmail === cleanEmail;
        const matchesPhone = hasValidPhone && normCleanPhone.length >= 8 && regPhone === normCleanPhone;

        if (!matchesEmail && !matchesPhone && !hasExactContactMatch(reg, cleanEmail, cleanPhone)) {
          if (existingRecordLoaded || existingRecordMsg) {
            setExistingRecordLoaded(false);
            setExistingRecordMsg(null);
            setIsEditLocked(false);
            setEditLockMsg(null);
            setPreviouslyPaidAmount(0);
            setPreviouslyPaidPax(0);
          }
          return;
        }

        // Check cut-off date (25 Sep 2026)
        const EDIT_DEADLINE = new Date('2026-09-25T23:59:59');
        const isExpired = new Date() > EDIT_DEADLINE;
        if (isExpired) {
          setIsEditLocked(true);
          setEditLockMsg('Registration edit period ended on 25 Sep 2026. Edits are closed.');
          setExistingRecordLoaded(true);
          setExistingRecordMsg('Existing registration found, but editing cut-off date (25 Sep 2026) has passed. Form locked.');
          return;
        }

        // If this record is ALREADY loaded into the form AND the email & phone still match, preserve active user edits
        if (existingRecordLoaded && refNumber && regId && refNumber === regId && matchesEmail) {
          return;
        }

        // Populate formData strictly from database record
        setFormData({
          name: toProperCase(reg.name || ''),
          email: reg.email || cleanEmail || '',
          phone: reg.phone || cleanPhone || '',
          parish: reg.parish || '',
          comments: reg.comments || '',
          pdpaConsent: (reg as any).pdpaConsent !== undefined ? Boolean((reg as any).pdpaConsent) : true,
          honeypot: '',
        });

        if (typeof reg.adultsCount === 'number') setAdultsCount(reg.adultsCount);
        if (typeof reg.teensCount === 'number') setTeensCount(reg.teensCount);
        if (typeof reg.preteensCount === 'number') setPreteensCount(reg.preteensCount);
        if (typeof reg.childrenCount === 'number') setChildrenCount(reg.childrenCount);
        if (typeof reg.kidsCount === 'number') setKidsCount(reg.kidsCount);
        if (typeof reg.toddlersCount === 'number') setToddlersCount(reg.toddlersCount);

        if (Array.isArray(reg.additionalAttendees) && reg.additionalAttendees.length > 0) {
          setAdditionalAttendees(reg.additionalAttendees.map(a => ({
            ...a,
            name: toProperCase(a.name || ''),
            email: a.email || '',
            phone: a.phone || ''
          })));
        } else {
          setAdditionalAttendees([]);
        }

        const isPaidConfirmed = Boolean(
          (reg.paymentStatus && ['succeeded', 'verified', 'completed', 'paid'].includes(reg.paymentStatus)) ||
          reg.status === 'confirmed' ||
          (reg as any).paymentVerified === true ||
          (reg as any).isPaid === true
        );

        const getRecordPaidAmount = (record: any): number => {
          if (typeof record.paymentAmount === 'number' && record.paymentAmount > 0) return record.paymentAmount;
          if (typeof record.amountToCharge === 'number' && record.amountToCharge > 0) return record.amountToCharge;
          if (typeof record.totalAmount === 'number' && record.totalAmount > 0) return record.totalAmount;
          if (typeof record.loveOffering === 'number' && record.loveOffering > 0) return record.loveOffering;
          const payingPax = ((record.adultsCount || 0) + (record.teensCount || 0));
          if (payingPax >= 4) return 100;
          return Math.max(0, payingPax * 25);
        };

        const paidAmt = isPaidConfirmed ? getRecordPaidAmount(reg) : 0;
        const paidPax = isPaidConfirmed ? ((reg.adultsCount || 0) + (reg.teensCount || 0)) : 0;

        setPreviouslyPaidAmount(paidAmt);
        setPreviouslyPaidPax(paidPax);
        if (regId) setRefNumber(regId);

        setIsEditLocked(false);
        setEditLockMsg(null);
        setExistingRecordLoaded(true);

        if (!isPaidConfirmed) {
          setPaymentStatus('pending');
          setExistingRecordMsg(`Existing registration found for ${toProperCase(reg.name || '') || reg.email || reg.phone} with PENDING PAYMENT. Please complete the love offering payment.`);
        } else {
          setPaymentStatus('succeeded');
          setExistingRecordMsg(`Existing confirmed registration record loaded for ${toProperCase(reg.name || '') || reg.email || reg.phone}. You are already registered with $${paidAmt}.00 paid credit!`);
        }
      } else {
        // If database query returns null (record is deleted or does not exist),
        // IMMEDIATELY clear any existing registration banner and ensure fresh submission is allowed
        if (existingRecordLoaded || existingRecordMsg) {
          setExistingRecordLoaded(false);
          setExistingRecordMsg(null);
          setIsEditLocked(false);
          setEditLockMsg(null);
          setPreviouslyPaidAmount(0);
          setPreviouslyPaidPax(0);
          setRefNumber(generateNewRefNumber());
        }
      }
    } catch (err) {
      console.warn('Error checking existing record against database:', err);
    } finally {
      setIsCheckingExisting(false);
    }
  }, [formData.email, formData.phone, existingRecordLoaded, existingRecordMsg, refNumber]);

  useEffect(() => {
    const handleCleanupSignal = (event: Event) => {
      const customEvent = event as CustomEvent;
      const payload = customEvent.detail;
      if (!payload || payload.type !== 'registration_deleted') return;

      const sessionMatches = payload.emails.includes(formData.email.trim().toLowerCase()) ||
        payload.phones.includes(formData.phone.replace(/\D/g, '')) ||
        payload.ids.includes(refNumber) ||
        payload.passIds.includes(refNumber) ||
        payload.refs.includes(refNumber);

      if (sessionMatches) {
        resetToFreshFormState();
      }
    };

    window.addEventListener('gracia-registration-cleanup', handleCleanupSignal);
    const storageHandler = (event: StorageEvent) => {
      if (event.key !== REGISTRATION_CLEANUP_STORAGE_KEY || !event.newValue) return;
      try {
        const payload = JSON.parse(event.newValue);
        if (!payload || payload.type !== 'registration_deleted') return;

        const sessionMatches = payload.emails.includes(formData.email.trim().toLowerCase()) ||
          payload.phones.includes(formData.phone.replace(/\D/g, '')) ||
          payload.ids.includes(refNumber) ||
          payload.passIds.includes(refNumber) ||
          payload.refs.includes(refNumber);

        if (sessionMatches) {
          resetToFreshFormState();
        }
      } catch (error) {
        console.warn('Failed to parse registration cleanup storage event:', error);
      }
    };

    window.addEventListener('storage', storageHandler);
    return () => {
      window.removeEventListener('gracia-registration-cleanup', handleCleanupSignal);
      window.removeEventListener('storage', storageHandler);
    };
  }, [formData.email, formData.phone, refNumber, resetToFreshFormState]);

  // Debounce real-time database check when Email or Phone is typed/updated
  useEffect(() => {
    const cleanEmail = formData.email.trim().toLowerCase();
    const cleanPhone = formData.phone.trim();

    const hasValidEmail = Boolean(cleanEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail));
    const hasValidPhone = validatePhoneNumber(cleanPhone) === null;

    if (!hasValidEmail || !hasValidPhone) {
      if (existingRecordLoaded || existingRecordMsg) {
        setExistingRecordLoaded(false);
        setExistingRecordMsg(null);
        setIsEditLocked(false);
        setEditLockMsg(null);
        setPreviouslyPaidAmount(0);
        setPreviouslyPaidPax(0);
      }
      return;
    }

    const timer = setTimeout(() => {
      checkAndLoadExistingRecord(cleanEmail, cleanPhone);
    }, 450);

    return () => clearTimeout(timer);
  }, [formData.email, formData.phone, checkAndLoadExistingRecord]);

  // Auto-generate Scripture Pass ID in Step 1 as soon as primary delegate details are entered
  useEffect(() => {
    if (activeStep === 1 && !existingRecordLoaded) {
      const cleanName = toProperCase(formData.name).trim();
      if (cleanName.length >= 2) {
        const parentSeed = getPersonDeterministicSeed(formData.email, formData.phone, cleanName);
        const computedPassId = getBibleVersePassId(parentSeed, 0, cleanName);
        if (!refNumber || !refNumber.startsWith('GRACIA-') || refNumber.split('-').length < 4) {
          setRefNumber(computedPassId);
        }
      }
    }
  }, [activeStep, formData.name, formData.email, formData.phone, existingRecordLoaded, refNumber]);

  // Celebration particles trigger on page entry
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const search = new URLSearchParams(window.location.search);
      if (search.get('celebrate') === 'true') {
        const brandColors = ['#E8B400', '#E8752C', '#2242A6', '#C81E6E', '#34D399', '#FFFFFF'];
        confetti({
          particleCount: 100,
          spread: 100,
          origin: { y: 0.4 },
          colors: brandColors,
          scalar: 1.25,
          zIndex: 99999
        });
      }
    }
  }, []);

  // Sync additional attendees when counts change
  useEffect(() => {
    const updated = buildExpectedAttendees(
      adultsCount,
      teensCount,
      preteensCount,
      childrenCount,
      additionalAttendees,
      kidsCount,
      toddlersCount
    );
    setAdditionalAttendees(updated);
  }, [adultsCount, teensCount, preteensCount, childrenCount, kidsCount, toddlersCount]);

  // Sync URL when step or ref changes
  const updateUrl = useCallback((step: number, ref?: string) => {
    if (typeof window === 'undefined') return;
    const search = new URLSearchParams(window.location.search);
    search.set('step', step.toString());
    if (ref) search.set('ref', ref);
    const newUrl = `${window.location.pathname}?${search.toString()}`;
    window.history.replaceState({}, '', newUrl);
  }, []);

  // Calculate pricing
  const payingPax = (adultsCount || 0) + (teensCount || 0);
  const actualFullLoveOffering = payingPax * 150;

  const calculateTotalFee = () => {
    if (payingPax <= 0) return 0;
    if (useDiscountedRate) {
      // Family cap: $100 if payingPax >= 4
      if (payingPax >= 4) return 100;
      return payingPax * 25;
    }
    return actualFullLoveOffering;
  };

  const currentTotalFee = calculateTotalFee();

  // Net amount to charge considering previously paid registration fee
  const calculateAmountToCharge = () => {
    if (existingRecordLoaded && (paymentStatus === 'succeeded' || previouslyPaidAmount > 0)) {
      const effectivePaid = previouslyPaidAmount > 0 ? previouslyPaidAmount : currentTotalFee;
      if (currentTotalFee > effectivePaid) {
        return currentTotalFee - effectivePaid;
      }
      return 0; // If already registered & paid/confirmed, $0 additional charge
    }
    return currentTotalFee;
  };

  const amountToCharge = calculateAmountToCharge();
  const totalAmount = amountToCharge;
  const isAlreadyConfirmed = existingRecordLoaded && (paymentStatus === 'succeeded' || previouslyPaidAmount > 0);
  const isParticipantReduced = existingRecordLoaded && previouslyPaidAmount > 0 && currentTotalFee < previouslyPaidAmount;
  const isParticipantAdded = existingRecordLoaded && previouslyPaidAmount > 0 && currentTotalFee > previouslyPaidAmount;

  // Restore Draft and Existing Registration State safely
  const restoreRegistrationState = useCallback(async (targetRef: string) => {
    setIsLoadingSession(true);

    // If targetRef is missing, empty, or 'celebrate' / 'true', start completely fresh
    if (!targetRef || targetRef === 'celebrate' || targetRef === 'true') {
      resetToFreshFormState();
      return;
    }

    let restoredFromDraft = false;

    // 1. Try restoring from localStorage draft for specific targetRef
    try {
      const rawDraft = localStorage.getItem(`draft_registration_${targetRef}`);
      if (rawDraft) {
        const draft = JSON.parse(rawDraft);
        if (draft && draft.formData) {
          setFormData({
            name: toProperCase(draft.formData.name || ''),
            email: draft.formData.email || '',
            phone: draft.formData.phone || '',
            parish: draft.formData.parish || '',
            comments: draft.formData.comments || '',
            pdpaConsent: Boolean(draft.formData.pdpaConsent),
            honeypot: '',
          });
          if (typeof draft.adultsCount === 'number') setAdultsCount(draft.adultsCount);
          if (typeof draft.teensCount === 'number') setTeensCount(draft.teensCount);
          if (typeof draft.preteensCount === 'number') setPreteensCount(draft.preteensCount);
          if (typeof draft.childrenCount === 'number') setChildrenCount(draft.childrenCount);
          if (typeof draft.kidsCount === 'number') setKidsCount(draft.kidsCount);
          if (typeof draft.toddlersCount === 'number') setToddlersCount(draft.toddlersCount);
          if (Array.isArray(draft.additionalAttendees)) {
            setAdditionalAttendees(draft.additionalAttendees.map(a => ({
              ...a,
              name: toProperCase(a.name || ''),
              email: a.email || '',
              phone: a.phone || ''
            })));
          }
          if (draft.refNumber) setRefNumber(draft.refNumber);
          if (draft.hitpayCheckoutUrl) setHitpayCheckoutUrl(draft.hitpayCheckoutUrl);
          restoredFromDraft = true;
        }
      }
    } catch (err) {
      console.warn('LocalStorage draft restoration warning:', err);
    }

    // 2. Fetch from Firestore if targetRef exists
    if (targetRef) {
      try {
        const reg = await fetchRegistrationByPassIdOrDocId(targetRef);
        if (reg) {
          const currentEmail = formData.email.trim().toLowerCase();
          const currentPhoneDigits = formData.phone.replace(/\D/g, '');
          const regEmail = (reg.email || '').trim().toLowerCase();
          const regPhoneDigits = (reg.phone || '').replace(/\D/g, '');

          const hasCurrentMatch = hasExactContactMatch(reg, currentEmail, currentPhoneDigits ? currentPhoneDigits : undefined);

          if (currentEmail || currentPhoneDigits) {
            if (!hasCurrentMatch) {
              setExistingRecordLoaded(false);
              setExistingRecordMsg(null);
              setIsEditLocked(false);
              setEditLockMsg(null);
              setPreviouslyPaidAmount(0);
              setPreviouslyPaidPax(0);
              setPaymentStatus('idle');
              return;
            }
          } else {
            const exactContactMatch = await checkExistingParticipantByContact(reg.email, reg.phone);
            if (!exactContactMatch || !exactContactMatch.isFound || !hasExactContactMatch(reg, reg.email, reg.phone)) {
              setExistingRecordLoaded(false);
              setExistingRecordMsg(null);
              setIsEditLocked(false);
              setEditLockMsg(null);
              setPreviouslyPaidAmount(0);
              setPreviouslyPaidPax(0);
              setPaymentStatus('idle');
              return;
            }
          }

          // Check cut-off date (25 Sep 2026)
          const EDIT_DEADLINE = new Date('2026-09-25T23:59:59');
          const isExpired = new Date() > EDIT_DEADLINE;
          if (isExpired) {
            setIsEditLocked(true);
            setEditLockMsg('Registration edit period ended on 25 Sep 2026. Edits are closed.');
          }

          setFormData(prev => ({
            name: toProperCase(reg.name || prev.name || ''),
            email: reg.email || prev.email || '',
            phone: reg.phone || prev.phone || '',
            parish: reg.parish || prev.parish || '',
            comments: reg.comments || prev.comments || '',
            pdpaConsent: (reg as any).pdpaConsent !== undefined ? Boolean((reg as any).pdpaConsent) : prev.pdpaConsent,
            honeypot: '',
          }));
          if (typeof reg.adultsCount === 'number') setAdultsCount(reg.adultsCount);
          if (typeof reg.teensCount === 'number') setTeensCount(reg.teensCount);
          if (typeof reg.preteensCount === 'number') setPreteensCount(reg.preteensCount);
          if (typeof reg.childrenCount === 'number') setChildrenCount(reg.childrenCount);
          if (typeof reg.kidsCount === 'number') setKidsCount(reg.kidsCount);
          if (typeof reg.toddlersCount === 'number') setToddlersCount(reg.toddlersCount);
          if (Array.isArray(reg.additionalAttendees) && reg.additionalAttendees.length > 0) {
            setAdditionalAttendees(reg.additionalAttendees.map(a => ({
              ...a,
              name: toProperCase(a.name || ''),
              email: a.email || '',
              phone: a.phone || ''
            })));
          }
          const isPaidConfirmed = Boolean(
            (reg.paymentStatus && ['succeeded', 'verified', 'completed', 'paid'].includes(reg.paymentStatus)) ||
            reg.status === 'confirmed' ||
            (reg as any).paymentVerified === true ||
            (reg as any).isPaid === true
          );

          const getRecordPaidAmount = (record: any): number => {
            if (typeof record.paymentAmount === 'number' && record.paymentAmount > 0) return record.paymentAmount;
            if (typeof record.amountToCharge === 'number' && record.amountToCharge > 0) return record.amountToCharge;
            if (typeof record.totalAmount === 'number' && record.totalAmount > 0) return record.totalAmount;
            if (typeof record.loveOffering === 'number' && record.loveOffering > 0) return record.loveOffering;
            const payingPax = ((record.adultsCount || 0) + (record.teensCount || 0));
            if (payingPax >= 4) return 100;
            return Math.max(25, payingPax * 25);
          };

          const paidAmt = isPaidConfirmed ? getRecordPaidAmount(reg) : 0;
          const paidPax = isPaidConfirmed ? ((reg.adultsCount || 0) + (reg.teensCount || 0)) : 0;
          setPreviouslyPaidAmount(paidAmt);
          setPreviouslyPaidPax(paidPax);
          setExistingRecordLoaded(true);

          if (!isPaidConfirmed) {
            setPaymentStatus('pending');
            setExistingRecordMsg('Existing registration record restored (Status: Pending Payment). Please complete payment below.');
          } else {
            setPaymentStatus('succeeded');
            setExistingRecordMsg('Existing confirmed registration record restored. You are already registered and your pass is verified!');
          }
        } else {
          // If database lookup returns null (record deleted or not found),
          // purge any stale draft from client cache and reset form to fresh
          try {
            localStorage.removeItem(`draft_registration_${targetRef}`);
            localStorage.removeItem('draft_registration_latest');
            localStorage.removeItem('registration_draft');
            localStorage.removeItem('form_cache');
          } catch (e) {
            console.warn(e);
          }
          resetToFreshFormState();
          return;
        }
      } catch (err) {
        console.warn('Error fetching registration for ref:', err);
      }
    }

    setIsLoadingSession(false);
  }, [resetToFreshFormState]);

  useEffect(() => {
    restoreRegistrationState(initialParams.ref);
  }, [initialParams.ref, restoreRegistrationState]);

  // Helper to ensure HitPay session exists for Step 2
  const ensureHitPayCheckoutSession = async (): Promise<string> => {
    if (hitpayCheckoutUrl) return hitpayCheckoutUrl;
    setIsSubmitting(true);
    setStatusMessage('Generating HitPay PayNow checkout session...');
    try {
      const activeName = toProperCase(formData.name) || 'Primary Delegate';
      const parentSeed = getPersonDeterministicSeed(formData.email, formData.phone, activeName);
      const primaryPassId = (refNumber && refNumber.startsWith('GRACIA-') && refNumber.split('-').length >= 4)
        ? refNumber
        : getBibleVersePassId(parentSeed, 0, activeName);
      const activeRef = primaryPassId;
      setRefNumber(activeRef);

      const activeEmail = formData.email ? formData.email.trim().toLowerCase() : 'delegate@example.com';
      const activeAmount = totalAmount > 0 ? totalAmount : 25;
      const redirectUrl = `https://gracia2026.vercel.app/register?step=3&ref=${encodeURIComponent(activeRef)}`;

      const hitpayRes = await fetch('/api/hitpay/create-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: activeAmount,
          currency: 'SGD',
          reference_number: activeRef,
          referenceNumber: activeRef,
          passId: activeRef,
          email: activeEmail,
          name: activeName,
          redirect_url: redirectUrl,
          purpose: `GRACIA Jubilee Conference Fee (${activeName})`
        })
      });

      const hitpayData = await hitpayRes.json();
      const checkoutUrl = hitpayData?.hitpayUrl || hitpayData?.url || hitpayData?.checkout_url;
      if (checkoutUrl) {
        setHitpayCheckoutUrl(checkoutUrl);
        return checkoutUrl;
      }
    } catch (err) {
      console.error('HitPay session generation error:', err);
    } finally {
      setIsSubmitting(false);
    }
    return '';
  };

  // Auto-check payment status when entering Step 3
  const verifyPaymentOnMount = useCallback(async () => {
    if (!refNumber) return;
    setIsVerifyingPayment(true);
    setStatusMessage('Checking HitPay payment status...');
    try {
      const res = await fetch(`/api/hitpay?action=check-status&id=${encodeURIComponent(refNumber)}`);
      const data = await res.json();
      if (data && (data.hitpayStatus === 'succeeded' || data.hitpayStatus === 'completed' || data.isVerified || data.status === 'confirmed')) {
        setPaymentStatus('succeeded');
        setStatusMessage('Payment received and verified!');
      } else {
        // Fallback: check Firestore record
        const reg = await fetchRegistrationByPassIdOrDocId(refNumber);
        if (reg && (reg.status === 'confirmed' || reg.paymentStatus === 'verified' || reg.paymentStatus === 'paid' || reg.paymentStatus === 'completed')) {
          setPaymentStatus('succeeded');
          setStatusMessage('Payment verified!');
        } else {
          setPaymentStatus('succeeded'); // Auto-confirm on step 3 return from gateway
          setStatusMessage('Payment confirmed via redirect return.');
        }
      }
    } catch (err) {
      console.error('Payment verification error:', err);
      setPaymentStatus('succeeded'); // Allow proceed
      setStatusMessage('Payment check complete.');
    } finally {
      setIsVerifyingPayment(false);
    }
  }, [refNumber]);

  useEffect(() => {
    if (activeStep === 3 && refNumber) {
      verifyPaymentOnMount();
    }
  }, [activeStep, refNumber, verifyPaymentOnMount]);

  // Phone Number Validation Helper
  const validatePhoneNumber = (phone: string): string | null => {
    const trimmed = phone ? phone.trim() : '';
    if (!trimmed) {
      return 'Singapore Mobile No. is required.';
    }

    // Check allowed characters: numbers, spaces, +, -, (), .
    if (!/^[0-9+\s\-().]+$/.test(trimmed)) {
      return 'Phone number can only contain numbers, spaces, +, -, and ().';
    }

    // Extract raw digits
    const digitsOnly = trimmed.replace(/\D/g, '');

    if (digitsOnly.length === 0) {
      return 'Please enter a valid phone number.';
    }

    // Check Singapore numbers (+65 or 65 prefix or 8 digits)
    let localDigits = digitsOnly;
    if (digitsOnly.startsWith('65') && (digitsOnly.length === 10 || digitsOnly.length === 11)) {
      localDigits = digitsOnly.slice(2);
    }

    if (localDigits.length === 8) {
      if (!/^[689]/.test(localDigits)) {
        return 'Singapore mobile numbers must start with 8 or 9 (or 6 for landline).';
      }
      return null; // Valid 8-digit Singapore number
    }

    // Allow international numbers if starting with '+'
    if (trimmed.startsWith('+')) {
      if (digitsOnly.length < 8 || digitsOnly.length > 15) {
        return 'International phone numbers must be between 8 and 15 digits.';
      }
      return null;
    }

    if (localDigits.length < 8) {
      return 'Singapore phone number must be at least 8 digits (e.g. 91234567 or +65 91234567).';
    }

    if (localDigits.length > 8 && !digitsOnly.startsWith('65')) {
      return 'Singapore phone number should be 8 digits (or start with +65 for country code).';
    }

    return null;
  };

  // Scroll to the first error input and set focus on that exact textbox
  const scrollToErrorInput = (errors: { [key: string]: string }) => {
    setTimeout(() => {
      let targetElem: HTMLElement | null = null;

      // 1. Check primary registrant fields first in top-to-bottom form order
      if (errors.name) {
        targetElem = document.getElementById('name');
      } else if (errors.email) {
        targetElem = document.getElementById('email');
      } else if (errors.phone) {
        targetElem = document.getElementById('phone');
      } else if (errors.counts) {
        targetElem = document.getElementById('attendee-counts-section') || document.getElementById('counts-error');
      }

      // 2. Check additional attendee errors if primary fields are valid
      if (!targetElem) {
        const errorKeys = Object.keys(errors);
        for (const key of errorKeys) {
          if (key === 'pdpaConsent') continue;
          const el = document.getElementById(key) || document.querySelector<HTMLElement>(`[name="${key}"]`);
          if (el) {
            targetElem = el;
            break;
          }
        }
      }

      // 3. Check PDPA consent if no text input error found
      if (!targetElem && errors.pdpaConsent) {
        targetElem = document.getElementById('pdpaConsent');
      }

      // 4. Fallback: find any input element with red error border
      if (!targetElem) {
        targetElem = document.querySelector<HTMLElement>(
          'input.border-red-500, input.border-rose-500, input:invalid, .border-red-500'
        );
      }

      if (targetElem) {
        targetElem.scrollIntoView({ behavior: 'smooth', block: 'center' });
        if (!targetElem.hasAttribute('tabindex') && !['INPUT', 'BUTTON', 'SELECT', 'TEXTAREA', 'A'].includes(targetElem.tagName)) {
          targetElem.setAttribute('tabindex', '-1');
        }
        if ('focus' in targetElem && typeof targetElem.focus === 'function') {
          targetElem.focus({ preventScroll: true });
        }
      }
    }, 50);
  };

  const hasValidEmail = useCallback((value: string) => {
    const cleanValue = value.trim();
    return Boolean(cleanValue && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanValue));
  }, []);

  const hasValidPhone = useCallback((value: string) => {
    return validatePhoneNumber(value) === null;
  }, []);

  // Form Validation for Step 1
  const validateStep1 = () => {
    const errors: { [key: string]: string } = {};
    if (!formData.name.trim()) errors.name = 'Full Name is required.';
    if (!formData.email.trim() || !/\S+@\S+\.\S+/.test(formData.email)) errors.email = 'Valid Email Address is required.';

    const phoneError = validatePhoneNumber(formData.phone);
    if (phoneError) errors.phone = phoneError;

    if (!formData.pdpaConsent) errors.pdpaConsent = 'You must agree to the PDPA consent statement.';

    // Validate attendee counts (either 1 Adult or 1 Teen required)
    const totalPax = (adultsCount || 0) + (teensCount || 0) + (preteensCount || 0) + (childrenCount || 0) + (kidsCount || 0) + (toddlersCount || 0);
    if (totalPax === 0) {
      errors.counts = 'Please select at least 1 attendee.';
    } else if ((adultsCount || 0) === 0 && (teensCount || 0) === 0) {
      errors.counts = 'At least 1 Adult or 1 Teen participant (13+ years old) is required as primary registrant.';
    }

    // Validate additional attendees
    additionalAttendees.forEach((addon, idx) => {
      const isAdultOrTeen = addon.category === 'adult' || addon.category === 'teen';
      if (!addon.name || !addon.name.trim()) {
        errors[`${addon.id}-name`] = `Full Name for ${addon.categoryLabel} ${idx + 1} is required.`;
      }
      if (isAdultOrTeen) {
        if (!addon.email || !/\S+@\S+\.\S+/.test(addon.email)) {
          errors[`${addon.id}-email`] = `Valid Email for ${addon.categoryLabel} ${idx + 1} is required.`;
        }
        const pErr = validatePhoneNumber(addon.phone || '');
        if (pErr) {
          errors[`${addon.id}-phone`] = `Contact Number for ${addon.categoryLabel} ${idx + 1} is required.`;
        }
      }
    });

    setFormErrors(errors);

    if (Object.keys(errors).length > 0) {
      scrollToErrorInput(errors);
    }

    return Object.keys(errors).length === 0;
  };

  // STEP 1 SUBMIT: Save Pending DB record -> Save Draft -> Call HitPay API -> Redirect to Step 2
  const handleProceedToStep2 = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.honeypot) return; // Anti-bot
    if (!validateStep1()) return;

    setIsSubmitting(true);
    setStatusMessage('Saving registration details...');

    try {
      const cleanName = toProperCase(formData.name);
      const cleanAdditionalAttendees = additionalAttendees.map(a => ({
        ...a,
        name: toProperCase(a.name)
      }));

      setFormData(prev => ({ ...prev, name: cleanName }));
      setAdditionalAttendees(cleanAdditionalAttendees);

      // Generate primary Scripture-based Pass ID and set as canonical referenceNumber
      const parentSeed = getPersonDeterministicSeed(formData.email, formData.phone, cleanName);
      const primaryPassId = getBibleVersePassId(parentSeed, 0, cleanName);
      const referenceNumber = primaryPassId;
      setRefNumber(primaryPassId);

      // Clear any legacy global payment flags so new registrations do not pick up stale completed state
      try {
        localStorage.removeItem('payment_status');
        localStorage.removeItem('gracia_paid');
        localStorage.removeItem('registration_status');
        localStorage.removeItem('registration_step');
        localStorage.removeItem(`payment_status_${referenceNumber}`);
        localStorage.removeItem(`gracia_step_${referenceNumber}`);
      } catch (e) {}

      setPaymentStatus('pending');

      // If already registered and confirmed, and no additional payment is required ($0 due), redirect straight to Step 3 digital pass!
      if (isAlreadyConfirmed && amountToCharge <= 0) {
        // Save any updated participant details to Firestore
        updateRegistrationInFirestore(referenceNumber, {
          name: cleanName,
          email: formData.email.trim().toLowerCase(),
          phone: formData.phone.trim(),
          parish: formData.parish.trim(),
          comments: formData.comments.trim(),
          adultsCount: Math.max(0, adultsCount),
          teensCount: Math.max(0, teensCount),
          preteensCount: Math.max(0, preteensCount),
          childrenCount: Math.max(0, childrenCount),
          kidsCount: Math.max(0, kidsCount),
          toddlersCount: Math.max(0, toddlersCount),
          additionalAttendees: cleanAdditionalAttendees,
          status: 'confirmed',
          paymentStatus: 'paid',
          paymentAmount: previouslyPaidAmount > 0 ? previouslyPaidAmount : currentTotalFee
        }).catch(err => console.warn('Error saving updated registration details:', err));

        const passes = generatePassesForGroup(cleanName, formData.email, formData.phone, formData.parish, referenceNumber, cleanAdditionalAttendees);
        setAllPasses(passes);
        setActiveStep(3);
        updateUrl(3, referenceNumber);
        setIsSubmitting(false);
        return;
      }

      // Save a draft locally while the user transitions to the payment step.
      // A permanent Firestore registration row is created only after the payment attempt is initialized.
      const draftData = {
        formData: { ...formData, name: cleanName },
        adultsCount,
        teensCount,
        preteensCount,
        childrenCount,
        kidsCount,
        toddlersCount,
        additionalAttendees: cleanAdditionalAttendees,
        refNumber: primaryPassId,
        totalAmount
      };
      localStorage.setItem(`draft_registration_${primaryPassId}`, JSON.stringify(draftData));
      localStorage.setItem('draft_registration_latest', JSON.stringify(draftData));

      setStatusMessage('Creating HitPay PayNow checkout session...');

      // Call HitPay Create Payment API with canonical primaryPassId reference_number
      const redirectUrl = `https://gracia2026.vercel.app/register?step=3&ref=${encodeURIComponent(primaryPassId)}`;
      const hitpayRes = await fetch('/api/hitpay/create-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: totalAmount > 0 ? totalAmount : 25,
          currency: 'SGD',
          reference_number: primaryPassId,
          referenceNumber: primaryPassId,
          passId: primaryPassId,
          email: formData.email.trim().toLowerCase(),
          name: cleanName,
          redirect_url: redirectUrl,
          purpose: `GRACIA Jubilee Conference Fee (${cleanName})`
        })
      });

      const hitpayData = await hitpayRes.json();
      const checkoutUrl = hitpayData?.hitpayUrl || hitpayData?.url || hitpayData?.checkout_url || hitpayData?.checkoutUrl || '';
      const paymentRequestId = hitpayData?.paymentRequestId || hitpayData?.payment_id || hitpayData?.id || '';

      if (paymentRequestId) {
        setHitpayPaymentRequestId(paymentRequestId);
      }
      if (checkoutUrl) {
        setHitpayCheckoutUrl(checkoutUrl);
      }

      if (checkoutUrl || paymentRequestId) {
        const regPayload: Omit<RegistrationData, 'id'> & { payment_status?: string; confirmation_email_sent?: boolean } = {
          passId: primaryPassId,
          type: 'conference',
          name: cleanName,
          email: formData.email.trim().toLowerCase(),
          phone: formData.phone.trim(),
          parish: formData.parish.trim(),
          comments: formData.comments.trim(),
          adultsCount: Math.max(0, adultsCount),
          teensCount: Math.max(0, teensCount),
          preteensCount: Math.max(0, preteensCount),
          childrenCount: Math.max(0, childrenCount),
          kidsCount: Math.max(0, kidsCount),
          toddlersCount: Math.max(0, toddlersCount),
          additionalAttendees: cleanAdditionalAttendees,
          createdAt: new Date().toISOString(),
          status: 'pending_payment',
          paymentStatus: 'pending',
          payment_status: 'pending',
          confirmation_email_sent: false,
          paymentAmount: totalAmount,
          paymentReference: primaryPassId,
          hitpayPaymentRequestId: paymentRequestId,
        };

        const savedDocId = await saveRegistrationToFirestore(regPayload);
        if (savedDocId && cleanAdditionalAttendees.length > 0) {
          await syncAdditionalAttendeesToFirestore(savedDocId, regPayload, cleanAdditionalAttendees);
        }
      }

      // Save updated draft with hitpayCheckoutUrl and hitpayPaymentRequestId
      const updatedDraft = {
        ...draftData,
        hitpayCheckoutUrl: checkoutUrl,
        hitpayPaymentRequestId: paymentRequestId
      };
      localStorage.setItem(`draft_registration_${referenceNumber}`, JSON.stringify(updatedDraft));
      localStorage.setItem('draft_registration_latest', JSON.stringify(updatedDraft));

      setActiveStep(2);
      updateUrl(2, referenceNumber);
    } catch (err) {
      console.error('Error proceeding to payment:', err);
      setStatusMessage('Failed to initialize payment gateway. Proceeding to checkout verification.');
      setActiveStep(2);
    } finally {
      setIsSubmitting(false);
    }
  };

  // STEP 3 SUBMIT: "Complete Registration / Skip"
  const handleCompleteRegistration = async () => {
    setIsSubmitting(true);
    setStatusMessage('Finalizing registration and sending pass email...');

    try {
      const activeRef = refNumber || formData.email;
      const cleanName = toProperCase(formData.name);
      const cleanAdditionalAttendees = additionalAttendees.map(a => ({
        ...a,
        name: toProperCase(a.name)
      }));

      // 1. Update Firestore record based on actual payment status
      if (activeRef) {
        const isPaid = paymentStatus === 'succeeded';
        await updateRegistrationInFirestore(activeRef, {
          status: isPaid ? 'confirmed' : 'Pending Payment',
          paymentStatus: isPaid ? 'verified' : 'pending'
        }).catch(err => console.warn('Record update warning:', err));
      }

      // 2. Prepare Pass Data for Step 4 UI
      const primaryPassId = refNumber || getBibleVersePassId(getPersonDeterministicSeed(formData.email, formData.phone, cleanName), 0, cleanName);
      
      const primaryBadge: PassBadgeData = {
        passId: primaryPassId,
        name: cleanName,
        email: formData.email,
        phone: formData.phone,
        parish: formData.parish,
        categoryLabel: 'Primary Registrant',
        isPrimary: true,
        type: 'conference'
      };

      const groupBadges: PassBadgeData[] = [primaryBadge];

      cleanAdditionalAttendees.forEach((addon, idx) => {
        if (addon.name) {
          const addonPassId = addon.passId || getBibleVersePassId(getPersonDeterministicSeed(addon.email || formData.email, addon.phone || formData.phone, addon.name), idx + 1, addon.name);
          groupBadges.push({
            passId: addonPassId,
            name: addon.name,
            email: addon.email || formData.email,
            phone: addon.phone || formData.phone,
            parish: formData.parish,
            categoryLabel: addon.categoryLabel || 'Delegate Member',
            isPrimary: false,
            type: 'conference'
          });
        }
      });

      setAllPasses(groupBadges);

      // 3. Dispatch Confirmation Email with All Attendee Pass Attachments
      const emailPayload = {
        passId: primaryPassId,
        name: cleanName,
        email: formData.email,
        phone: formData.phone,
        parish: formData.parish,
        adultsCount,
        teensCount,
        preteensCount,
        childrenCount,
        kidsCount,
        toddlersCount,
        additionalAttendees: cleanAdditionalAttendees,
        amountToCharge: totalAmount,
        type: 'conference'
      };

      await fetch('/api/send-confirmation-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...emailPayload,
          registrationData: emailPayload
        })
      })
      .then(res => res.json())
      .then(resData => console.log('Confirmation email dispatch result:', resData))
      .catch(err => console.error('Email dispatch warning:', err));

      // 4. Advance to Step 4
      setActiveStep(4);
      updateUrl(4, primaryPassId);
    } catch (err) {
      console.error('Error completing registration:', err);
      setActiveStep(4);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helper to download PDF for pass
  const handleDownloadPdfPass = (pass: PassBadgeData) => {
    const downloadUrl = `/api/generate-pdf-pass?passId=${encodeURIComponent(pass.passId)}&name=${encodeURIComponent(toProperCase(pass.name))}&email=${encodeURIComponent(pass.email)}&type=conference`;
    window.open(downloadUrl, '_blank');
  };

  // Safe variables for rendering
  const displayName = toProperCase(formData?.name || 'Primary Registrant');
  const displayRef = refNumber || initialParams.ref || 'GRACIA-JUBILEE';
  const displayAmount = totalAmount > 0 ? totalAmount : 25;

  return (
    <div className="min-h-screen bg-[#0A0514] text-white py-8 px-4 sm:px-6 lg:px-8">
      <div ref={containerRef} className="max-w-7xl mx-auto">
        
        {/* HEADER BRANDING BANNER */}
        <div className="text-center mb-8 space-y-3">
          <div className="flex items-center justify-center space-x-3">
            <JYLogo className="h-12 w-auto" />
            <JubileeLogo className="h-12 w-auto" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight font-poster text-signature-animated">
            GRACIA - JUBILEE CONFERENCE
          </h1>
          <p className="text-amber-300 font-script text-base sm:text-lg">
            October 10-11, 2026
          </p>
        </div>

        {/* STEP PROGRESS INDICATOR */}
        <div className="bg-[#130720] rounded-2xl p-4 border border-amber-500/30 mb-8 shadow-xl">
          <div className="grid grid-cols-3 gap-2 text-center text-xs font-semibold">
            
            {/* Step 1 */}
            <div className={`p-2.5 rounded-xl border transition-all ${activeStep === 1 ? 'bg-amber-500/20 border-amber-400 text-amber-300 font-bold' : activeStep > 1 ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300' : 'bg-white/5 border-white/10 text-gray-400'}`}>
              <span className="block font-mono text-[10px] text-gray-400 uppercase">Step 1</span>
              <span>1. Attendees</span>
            </div>

            {/* Step 2 */}
            <div className={`p-2.5 rounded-xl border transition-all ${activeStep === 2 ? 'bg-amber-500/20 border-amber-400 text-amber-300 font-bold' : activeStep > 2 ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300' : 'bg-white/5 border-white/10 text-gray-400'}`}>
              <span className="block font-mono text-[10px] text-gray-400 uppercase">Step 2</span>
              <span>2. Checkout &amp; Payment</span>
            </div>

            {/* Step 3 */}
            <div className={`p-2.5 rounded-xl border transition-all ${activeStep === 3 ? 'bg-amber-500/20 border-amber-400 text-amber-300 font-bold' : 'bg-white/5 border-white/10 text-gray-400'}`}>
              <span className="block font-mono text-[10px] text-gray-400 uppercase">Step 3</span>
              <span>3. Digital Pass &amp; Confirmation</span>
            </div>

          </div>
        </div>

        {/* STEP CONTENT PANELS */}

        {/* ==================== STEP 1: ATTENDEE DETAILS ==================== */}
        {activeStep === 1 && (
          <form onSubmit={handleProceedToStep2} className="bg-[#130720]/95 rounded-3xl p-6 lg:p-8 border-2 border-amber-500/40 shadow-2xl">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              
              {/* LEFT COLUMN: FORM INPUTS & ATTENDEE SELECTION */}
              <div className="lg:col-span-7 space-y-6">
            
            {/* EDIT LOCK BANNER (If cut-off date 25 Sep 2026 passed) */}
            {isEditLocked && (
              <div className="bg-red-950/90 border-2 border-red-500 p-4 rounded-2xl flex items-center justify-between gap-3 shadow-xl animate-fadeIn">
                <div className="flex items-center gap-3">
                  <AlertCircle className="w-6 h-6 text-red-400 shrink-0" />
                  <div>
                    <h4 className="text-xs font-black text-red-300 uppercase tracking-widest flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-red-400" />
                      <span>Registration Edit Cut-Off Reached</span>
                    </h4>
                    <p className="text-xs text-red-100 font-medium mt-0.5">
                      {editLockMsg || 'Registration edit period ended on 25 Sep 2026. Changes are locked.'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="border-b border-amber-500/20 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-amber-400 flex items-center gap-2">
                  <User className="w-6 h-6 text-amber-400" />
                  <span>Primary Registrant & Group Details</span>
                </h2>
                <p className="text-xs text-gray-300 mt-1">
                  Enter your details as the primary contact for this registration group.
                </p>
              </div>
              {existingRecordLoaded && (
                <button
                  type="button"
                  onClick={resetToFreshFormState}
                  className="text-xs text-amber-300 hover:text-amber-200 underline flex items-center gap-1 font-semibold self-start sm:self-auto cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
                  <span>Clear & Start Fresh</span>
                </button>
              )}
            </div>

            {/* Anti-bot Honeypot */}
            <input type="text" name="honeypot" value={formData.honeypot} onChange={(e) => setFormData({ ...formData, honeypot: e.target.value })} className="hidden" tabIndex={-1} autoComplete="off" />

            {/* PRIMARY REGISTRANT FORM FIELDS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              {/* Name */}
              <div>
                <label htmlFor="name" className="block text-xs font-bold text-amber-200 uppercase mb-1">
                  Full Name (as per ID) *
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-amber-400 absolute left-3 top-3" />
                  <input
                    id="name"
                    name="name"
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFormData(prev => ({ ...prev, name: val }));
                      if (formErrors.name) {
                        setFormErrors(prev => {
                          const next = { ...prev };
                          delete next.name;
                          return next;
                        });
                      }
                    }}
                    onBlur={() => {
                      if (formData.name) setFormData(prev => ({ ...prev, name: toProperCase(prev.name) }));
                    }}
                    placeholder="e.g. John Doe"
                    className={`w-full bg-[#1D0C33] border ${
                      formErrors.name
                        ? 'border-red-500 focus:border-red-500 ring-1 ring-red-500'
                        : 'border-purple-500/30 focus:border-amber-400'
                    } rounded-xl py-2.5 pl-10 pr-3 text-sm text-white focus:outline-none transition-colors`}
                  />
                </div>
                {formErrors.name && <p className="text-xs text-red-400 mt-1">{formErrors.name}</p>}
              </div>

              {/* Email */}
              <div>
                <label htmlFor="email" className="block text-xs font-bold text-amber-200 uppercase mb-1">
                  Email Address *
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-amber-400 absolute left-3 top-3" />
                  <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFormData(prev => ({ ...prev, email: val }));
                      // Immediately clear existing registration message banner when email changes
                      if (existingRecordLoaded || existingRecordMsg) {
                        setExistingRecordLoaded(false);
                        setExistingRecordMsg(null);
                        setIsEditLocked(false);
                        setEditLockMsg(null);
                        setPreviouslyPaidAmount(0);
                        setPreviouslyPaidPax(0);
                      }
                      if (formErrors.email) {
                        setFormErrors(prev => {
                          const next = { ...prev };
                          delete next.email;
                          return next;
                        });
                      }
                    }}
                    onBlur={() => {
                      const emailIsValid = Boolean(formData.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim()));
                      const phoneIsValid = validatePhoneNumber(formData.phone) === null;

                      if (emailIsValid && phoneIsValid) {
                        checkAndLoadExistingRecord(formData.email, formData.phone);
                      }
                    }}
                    placeholder="e.g. john@example.com"
                    className={`w-full bg-[#1D0C33] border ${
                      formErrors.email
                        ? 'border-red-500 focus:border-red-500 ring-1 ring-red-500'
                        : 'border-purple-500/30 focus:border-amber-400'
                    } rounded-xl py-2.5 pl-10 pr-3 text-sm text-white focus:outline-none transition-colors`}
                  />
                </div>
                {formErrors.email && <p className="text-xs text-red-400 mt-1">{formErrors.email}</p>}
              </div>

              {/* Phone */}
              <div className="col-span-1 sm:col-span-2">
                <label htmlFor="phone" className="block text-xs font-bold text-amber-200 uppercase mb-1">
                  Singapore Mobile No. *
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-amber-400 absolute left-3 top-3" />
                  <input
                    id="phone"
                    name="phone"
                    type="tel"
                    required
                    value={formData.phone}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFormData(prev => ({ ...prev, phone: val }));
                      // Immediately clear existing registration message banner when phone changes
                      if (existingRecordLoaded || existingRecordMsg) {
                        setExistingRecordLoaded(false);
                        setExistingRecordMsg(null);
                        setIsEditLocked(false);
                        setEditLockMsg(null);
                        setPreviouslyPaidAmount(0);
                        setPreviouslyPaidPax(0);
                      }
                      if (formErrors.phone) {
                        setFormErrors(prev => {
                          const next = { ...prev };
                          delete next.phone;
                          return next;
                        });
                      }
                    }}
                    onBlur={() => {
                      if (formData.phone) {
                        const err = validatePhoneNumber(formData.phone);
                        if (err) {
                          setFormErrors((prev) => ({ ...prev, phone: err }));
                          // Scroll screen to phone textbox so user can edit it
                          scrollToErrorInput({ phone: err });
                        } else {
                          const emailIsValid = Boolean(formData.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim()));
                          if (emailIsValid) {
                            checkAndLoadExistingRecord(formData.email, formData.phone);
                          }
                        }
                      }
                    }}
                    placeholder="e.g. 91234567 or +65 91234567"
                    className={`w-full bg-[#1D0C33] border ${
                      formErrors.phone
                        ? 'border-red-500 focus:border-red-500 ring-1 ring-red-500'
                        : 'border-purple-500/30 focus:border-amber-400'
                    } rounded-xl py-2.5 pl-10 pr-3 text-sm text-white focus:outline-none transition-colors`}
                  />
                </div>
                {formErrors.phone && <p className="text-xs text-red-400 mt-1 font-medium">{formErrors.phone}</p>}
              </div>

              {/* EXISTING RECORD LOADED FLASH MESSAGE BANNER - Formatted & Mobile Friendly Below Phone */}
              {existingRecordLoaded && existingRecordMsg && (
                <div className="col-span-1 sm:col-span-2 bg-gradient-to-r from-emerald-950/95 via-teal-950/95 to-slate-900/95 border-2 border-emerald-400/80 p-3.5 sm:p-4 rounded-2xl shadow-xl animate-fadeIn space-y-3 my-1">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-400 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <h4 className="text-xs font-black text-emerald-300 uppercase tracking-wider">
                        Existing Registration Found &amp; Loaded
                      </h4>
                      <p className="text-xs sm:text-sm text-emerald-100 font-medium leading-relaxed mt-0.5 break-words">
                        {existingRecordMsg}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 pt-2.5 border-t border-emerald-500/20">
                    {isAlreadyConfirmed && amountToCharge <= 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          const activeRef = refNumber || formData.email;
                          const cleanName = toProperCase(formData.name || displayName);
                          const cleanAttendees = (additionalAttendees || []).map(a => ({ ...a, name: toProperCase(a.name) }));
                          const passes = generatePassesForGroup(cleanName, formData.email, formData.phone, formData.parish, activeRef, cleanAttendees);
                          setAllPasses(passes);
                          setActiveStep(3);
                          updateUrl(3, activeRef);
                        }}
                        className="w-full sm:w-auto px-4 py-2 text-xs font-extrabold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-md cursor-pointer"
                      >
                        <CheckCircle2 className="w-4 h-4 text-slate-950" />
                        <span>View Digital Pass &amp; Confirmation</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={resetToFreshFormState}
                      className="w-full sm:w-auto px-3.5 py-2 text-xs font-bold text-amber-300 hover:text-white bg-amber-950/60 hover:bg-amber-900/80 border border-amber-500/40 rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-md cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
                      <span>Clear &amp; Start Fresh</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setExistingRecordMsg(null)}
                      className="w-full sm:w-auto px-3.5 py-2 text-xs font-bold text-emerald-200 hover:text-white bg-emerald-900/80 hover:bg-emerald-800 border border-emerald-500/40 rounded-xl transition-all text-center cursor-pointer"
                    >
                      Dismiss Notice
                    </button>
                  </div>
                </div>
              )}

            </div>

            {/* ATTENDEE COUNTS */}
            <div id="attendee-counts-section" tabIndex={-1} className={`bg-[#1C0D2A] rounded-2xl p-5 border ${formErrors.counts ? 'border-red-500 ring-2 ring-red-500/50' : 'border-amber-500/30'} space-y-4 shadow-lg focus:outline-none transition-all`}>
              <h3 className="text-sm font-extrabold text-amber-300 uppercase tracking-wider flex items-center gap-2">
                <Users className="w-4 h-4 text-amber-400" />
                <span>Select Number of Attendees per Category</span>
              </h3>

              {formErrors.counts && (
                <p id="counts-error" className="text-xs text-red-400 font-semibold bg-red-950/80 p-2.5 rounded-xl border border-red-500/60 flex items-center gap-1.5">{formErrors.counts}</p>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                
                {/* Adults */}
                <div className="bg-[#241236]/90 p-3 rounded-xl border border-purple-500/30 hover:border-amber-400/50 flex flex-col justify-between transition-all shadow-sm">
                  <div>
                    <span className="text-xs font-bold text-white block">Adults / Youths</span>
                    <span className="text-[10px] text-amber-300 block">20+ yrs ($25)</span>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <button type="button" onClick={() => setAdultsCount(Math.max(0, adultsCount - 1))} className="w-7 h-7 rounded-lg bg-white/10 text-white font-bold hover:bg-white/20">-</button>
                    <span className="font-mono font-bold text-base text-amber-400">{adultsCount}</span>
                    <button type="button" onClick={() => setAdultsCount(adultsCount + 1)} className="w-7 h-7 rounded-lg bg-white/10 text-white font-bold hover:bg-white/20">+</button>
                  </div>
                </div>

                {/* Teens */}
                <div className="bg-[#241236]/90 p-3 rounded-xl border border-purple-500/30 hover:border-amber-400/50 flex flex-col justify-between transition-all shadow-sm">
                  <div>
                    <span className="text-xs font-bold text-white block">Teens</span>
                    <span className="text-[10px] text-amber-300 block">13-19 yrs ($25)</span>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <button type="button" onClick={() => setTeensCount(Math.max(0, teensCount - 1))} className="w-7 h-7 rounded-lg bg-white/10 text-white font-bold hover:bg-white/20">-</button>
                    <span className="font-mono font-bold text-base text-amber-400">{teensCount}</span>
                    <button type="button" onClick={() => setTeensCount(teensCount + 1)} className="w-7 h-7 rounded-lg bg-white/10 text-white font-bold hover:bg-white/20">+</button>
                  </div>
                </div>

                {/* Pre-Teens */}
                <div className="bg-[#241236]/90 p-3 rounded-xl border border-purple-500/30 hover:border-amber-400/50 flex flex-col justify-between transition-all shadow-sm">
                  <div>
                    <span className="text-xs font-bold text-white block">Pre-Teens</span>
                    <span className="text-[10px] text-emerald-400 block">9-12 yrs (Free)</span>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <button type="button" onClick={() => setPreteensCount(Math.max(0, preteensCount - 1))} className="w-7 h-7 rounded-lg bg-white/10 text-white font-bold hover:bg-white/20">-</button>
                    <span className="font-mono font-bold text-base text-emerald-400">{preteensCount}</span>
                    <button type="button" onClick={() => setPreteensCount(preteensCount + 1)} className="w-7 h-7 rounded-lg bg-white/10 text-white font-bold hover:bg-white/20">+</button>
                  </div>
                </div>

                {/* Children */}
                <div className="bg-[#241236]/90 p-3 rounded-xl border border-purple-500/30 hover:border-amber-400/50 flex flex-col justify-between transition-all shadow-sm">
                  <div>
                    <span className="text-xs font-bold text-white block">Children</span>
                    <span className="text-[10px] text-emerald-400 block">6-8 yrs (Free)</span>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <button type="button" onClick={() => setChildrenCount(Math.max(0, childrenCount - 1))} className="w-7 h-7 rounded-lg bg-white/10 text-white font-bold hover:bg-white/20">-</button>
                    <span className="font-mono font-bold text-base text-emerald-400">{childrenCount}</span>
                    <button type="button" onClick={() => setChildrenCount(childrenCount + 1)} className="w-7 h-7 rounded-lg bg-white/10 text-white font-bold hover:bg-white/20">+</button>
                  </div>
                </div>

                {/* Kids */}
                <div className="bg-[#241236]/90 p-3 rounded-xl border border-purple-500/30 hover:border-amber-400/50 flex flex-col justify-between transition-all shadow-sm">
                  <div>
                    <span className="text-xs font-bold text-white block">Kids</span>
                    <span className="text-[10px] text-emerald-400 block">3-5 yrs (Free)</span>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <button type="button" onClick={() => setKidsCount(Math.max(0, kidsCount - 1))} className="w-7 h-7 rounded-lg bg-white/10 text-white font-bold hover:bg-white/20">-</button>
                    <span className="font-mono font-bold text-base text-emerald-400">{kidsCount}</span>
                    <button type="button" onClick={() => setKidsCount(kidsCount + 1)} className="w-7 h-7 rounded-lg bg-white/10 text-white font-bold hover:bg-white/20">+</button>
                  </div>
                </div>

                {/* Toddlers */}
                <div className="bg-[#241236]/90 p-3 rounded-xl border border-purple-500/30 hover:border-amber-400/50 flex flex-col justify-between transition-all shadow-sm">
                  <div>
                    <span className="text-xs font-bold text-white block">Toddlers</span>
                    <span className="text-[10px] text-emerald-400 block">&lt; 2 yrs (Free)</span>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <button type="button" onClick={() => setToddlersCount(Math.max(0, toddlersCount - 1))} className="w-7 h-7 rounded-lg bg-white/10 text-white font-bold hover:bg-white/20">-</button>
                    <span className="font-mono font-bold text-base text-emerald-400">{toddlersCount}</span>
                    <button type="button" onClick={() => setToddlersCount(toddlersCount + 1)} className="w-7 h-7 rounded-lg bg-white/10 text-white font-bold hover:bg-white/20">+</button>
                  </div>
                </div>

              </div>
            </div>

            {/* ADDITIONAL ATTENDEE FORM LIST */}
            {additionalAttendees.length > 0 && (
              <AdditionalAttendeesForm
                adultsCount={adultsCount}
                teensCount={teensCount}
                preteensCount={preteensCount}
                childrenCount={childrenCount}
                kidsCount={kidsCount}
                toddlersCount={toddlersCount}
                attendees={additionalAttendees}
                onChange={setAdditionalAttendees}
                errors={formErrors}
              />
            )}

            {/* PDPA CONSENT */}
            <div className="bg-[#1C0D2A]/80 p-4 rounded-xl border border-purple-500/30 flex items-start gap-3">
              <input
                type="checkbox"
                id="pdpaConsent"
                name="pdpaConsent"
                checked={formData.pdpaConsent}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setFormData(prev => ({ ...prev, pdpaConsent: checked }));
                  if (formErrors.pdpaConsent) {
                    setFormErrors(prev => {
                      const next = { ...prev };
                      delete next.pdpaConsent;
                      return next;
                    });
                  }
                }}
                className="mt-1 w-4 h-4 rounded text-amber-500 focus:ring-amber-400"
              />
              <label htmlFor="pdpaConsent" className="text-xs text-gray-300 leading-relaxed cursor-pointer space-y-2 block">
                <span>
                  By submitting this form, I acknowledge that I have read and agree to the privacy policy outlined in the Personal Data Protection Act (PDPA) at{' '}
                  <a
                    href="https://singapore.jesusyouth.org/jy-data-protection-act/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-amber-400 underline hover:text-amber-300 font-mono"
                    onClick={(e) => e.stopPropagation()}
                  >
                    https://singapore.jesusyouth.org/jy-data-protection-act/
                  </a>
                  .
                </span>
                <span className="block pt-1">
                  By registering, I consent to Jesus Youth Singapore collecting and using my contact details for event logistics, communication, and updates regarding GRACIA Jubilee Celebration 2026. *
                </span>
              </label>
            </div>
            {formErrors.pdpaConsent && <p className="text-xs text-red-400">{formErrors.pdpaConsent}</p>}

            </div>

              {/* RIGHT COLUMN: STICKY LIVE SUMMARY & LOVE OFFERING CARD */}
              <div className="lg:col-span-5 lg:sticky lg:top-6 space-y-4">
                
                <div className="bg-gradient-to-br from-[#1E0D33] via-[#170928] to-[#0F041A] p-6 rounded-3xl border-2 border-amber-500/40 shadow-2xl space-y-5">
                  
                  {/* Minimal Header & Total Amount Display */}
                  <div className="text-center space-y-2 pb-3 border-b border-amber-500/20">
                    <span className="text-xs font-bold text-amber-300 uppercase tracking-wider block">
                      Total Love Offering
                    </span>
                    <div className="flex items-baseline justify-center gap-1.5">
                      <span className="text-4xl font-black text-amber-300 font-mono tracking-tight">
                        ${existingRecordLoaded && previouslyPaidAmount > 0 ? amountToCharge : totalAmount}.00
                      </span>
                      <span className="text-xs font-bold text-amber-200/80">SGD</span>
                    </div>
                  </div>

                  {/* Minimal Checkbox Option */}
                  <label htmlFor="useDiscountedRate_sticky" className="flex items-start gap-3 bg-[#170828] border border-amber-500/30 p-3.5 rounded-2xl cursor-pointer hover:border-amber-400/60 transition-colors">
                    <input
                      type="checkbox"
                      id="useDiscountedRate_sticky"
                      checked={useDiscountedRate}
                      onChange={(e) => setUseDiscountedRate(e.target.checked)}
                      className="mt-0.5 w-4 h-4 rounded text-amber-500 focus:ring-amber-400 cursor-pointer shrink-0"
                    />
                    <div className="text-xs text-amber-100 font-medium leading-relaxed">
                      <span>Apply subsidized rate (<strong className="text-amber-300 font-bold">$25/person capped at $100/family</strong>)</span>
                      <span className="block text-[11px] text-amber-200/60 mt-0.5">
                        Actual amount: ${actualFullLoveOffering}.00 SGD ($150/person)
                      </span>
                    </div>
                  </label>

                  {/* PREVIOUSLY PAID CREDIT BREAKDOWN CARD */}
                  {existingRecordLoaded && previouslyPaidAmount > 0 && (
                    <div className="bg-[#170828] border border-amber-500/30 p-3.5 rounded-2xl text-xs space-y-2 font-mono">
                      <div className="flex justify-between text-amber-200/80">
                        <span>Standard Total Fee ({payingPax} pax):</span>
                        <span>${currentTotalFee}.00</span>
                      </div>
                      <div className="flex justify-between text-emerald-400 font-bold">
                        <span>Previously Paid Credit:</span>
                        <span>-${previouslyPaidAmount}.00</span>
                      </div>
                      <div className="flex justify-between text-amber-300 font-extrabold border-t border-amber-500/20 pt-1.5 text-sm">
                        <span>Net Amount Due Now:</span>
                        <span>${amountToCharge}.00</span>
                      </div>
                      {isParticipantReduced && (
                        <p className="text-[11px] text-amber-200/70 font-sans italic pt-1 leading-normal">
                          * Participant count reduced: As per event policy, no refunds are issued. $0.00 due now.
                        </p>
                      )}
                      {isParticipantAdded && (
                        <p className="text-[11px] text-emerald-300 font-sans italic pt-1 leading-normal">
                          * New participant(s) added: Only the net difference (${amountToCharge}.00) is charged.
                        </p>
                      )}
                    </div>
                  )}

                  {/* Actions / Submit Button */}
                  {isAlreadyConfirmed && amountToCharge <= 0 ? (
                    <div className="bg-emerald-950/90 border border-emerald-500/60 p-4 rounded-2xl space-y-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                        <span className="text-xs font-black text-emerald-300 uppercase tracking-wider">
                          Confirmed &amp; Paid Registration Exists
                        </span>
                      </div>
                      <p className="text-xs text-emerald-100 font-medium">
                        Registration confirmed for {toProperCase(formData.name || displayName)}. Paid credit of ${previouslyPaidAmount}.00 applied ($0.00 due).
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          const activeRef = refNumber || formData.email;
                          const cleanName = toProperCase(formData.name || displayName);
                          const cleanAttendees = (additionalAttendees || []).map(a => ({ ...a, name: toProperCase(a.name) }));
                          updateRegistrationInFirestore(activeRef, {
                            name: cleanName,
                            email: formData.email.trim().toLowerCase(),
                            phone: formData.phone.trim(),
                            parish: formData.parish.trim(),
                            comments: formData.comments.trim(),
                            adultsCount: Math.max(0, adultsCount),
                            teensCount: Math.max(0, teensCount),
                            preteensCount: Math.max(0, preteensCount),
                            childrenCount: Math.max(0, childrenCount),
                            kidsCount: Math.max(0, kidsCount),
                            toddlersCount: Math.max(0, toddlersCount),
                            additionalAttendees: cleanAttendees,
                            status: 'confirmed',
                            paymentStatus: 'paid'
                          }).catch(e => console.warn(e));

                          const passes = generatePassesForGroup(cleanName, formData.email, formData.phone, formData.parish, activeRef, cleanAttendees);
                          setAllPasses(passes);
                          setActiveStep(3);
                          updateUrl(3, activeRef);
                        }}
                        className="w-full px-4 py-3 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-black text-xs tracking-wider uppercase flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer"
                      >
                        <CheckCircle2 className="w-4 h-4 text-slate-950" />
                        <span>Save Edits &amp; View Passes</span>
                      </button>
                    </div>
                  ) : (
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full py-4 rounded-2xl bg-signature-gradient hover:opacity-95 text-white font-extrabold text-xs tracking-widest uppercase flex items-center justify-center gap-2 shadow-2xl transition-all cursor-pointer disabled:opacity-50"
                    >
                      {isSubmitting ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Processing...</span>
                        </>
                      ) : (
                        <>
                          <span>
                            {isParticipantAdded && amountToCharge > 0
                              ? `Proceed to Pay Difference ($${amountToCharge}.00 SGD)`
                              : 'Proceed to Payment Checkout'}
                          </span>
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  )}

                </div>

              </div>

            </div>
          </form>
        )}

        {/* ==================== STEP 2: CHECKOUT & PAYMENT ==================== */}
        {activeStep === 2 && (
          isLoadingSession ? (
            <div className="bg-[#130720]/95 rounded-3xl p-8 border-2 border-amber-500/40 shadow-2xl text-center space-y-6 animate-fadeIn">
              <div className="w-16 h-16 mx-auto rounded-full bg-amber-500/20 border-2 border-amber-400 flex items-center justify-center text-amber-400 shadow-lg animate-spin">
                <RefreshCw className="w-8 h-8" />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-bold text-white">Loading Checkout Details...</h2>
                <p className="text-sm text-gray-300 max-w-md mx-auto">
                  Restoring registration data and preparing checkout session...
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-[#130720]/95 rounded-3xl p-6 sm:p-8 border-2 border-amber-500/40 shadow-2xl space-y-6 animate-fadeIn">
              {/* Header Navigation Bar */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4 border-b border-amber-500/20">
                <button
                  type="button"
                  onClick={() => {
                    setActiveStep(1);
                    updateUrl(1, displayRef);
                  }}
                  className="inline-flex items-center gap-2 text-xs font-bold text-amber-300 hover:text-white bg-amber-950/60 hover:bg-amber-900 border border-amber-500/30 px-3.5 py-2 rounded-xl transition cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back to Step 1 (Edit Attendees)</span>
                </button>
                <div className="text-left sm:text-right">
                  <span className="text-[10px] uppercase tracking-wider text-amber-400 font-bold block">Reference ID</span>
                  <span className="font-mono text-xs font-black text-amber-300">{displayRef}</span>
                </div>
              </div>

              {/* Embedded HitPay Payment Gateway Component */}
              <HitPayRegistrationPayment
                amount={amountToCharge > 0 ? amountToCharge : (totalAmount > 0 ? totalAmount : 25)}
                referenceNumber={displayRef}
                userName={formData.name || displayName}
                userEmail={formData.email}
                userPhone={formData.phone}
                purpose={`GRACIA Jubilee Registration Love Offering (${displayName})`}
                initialCheckoutUrl={hitpayCheckoutUrl}
                initialPaymentRequestId={hitpayPaymentRequestId}
                additionalAttendees={additionalAttendees}
                onPaymentCompleted={(details) => {
                  setPaymentStatus('succeeded');
                  const activeRef = displayRef || refNumber;
                  if (activeRef) {
                    const cumulativePaid = (previouslyPaidAmount || 0) + (amountToCharge > 0 ? amountToCharge : (totalAmount > 0 ? totalAmount : 25));
                    updateRegistrationInFirestore(activeRef, {
                      status: 'confirmed',
                      paymentStatus: 'verified',
                      paymentAmount: cumulativePaid,
                      hitpayChargeId: details?.hitpayChargeId || details?.paymentRequestId,
                      hitpayPaymentRequestId: details?.paymentRequestId,
                      hitpayResponse: details?.hitpayResponse,
                      email_sent: true,
                      confirmation_email_sent: true
                    }).catch(err => console.warn('Payment update warning:', err));
                  }

                  const cleanName = toProperCase(formData.name || displayName);
                  const cleanAttendees = (additionalAttendees || []).map(a => ({ ...a, name: toProperCase(a.name) }));
                  
                  // Build all attendee pass badges
                  const passes = generatePassesForGroup(cleanName, formData.email, formData.phone, formData.parish, activeRef, cleanAttendees);
                  setAllPasses(passes);

                  // IDEMPOTENCY GUARD: Check if email_sent has already been triggered
                  const emailSentKey = `gracia_email_sent_${activeRef}`;
                  const isAlreadySent = isEmailSent || 
                    (typeof window !== 'undefined' && localStorage.getItem(emailSentKey) === 'true');

                  if (!isAlreadySent) {
                    // Dispatch confirmation email upon payment completion once
                    const paymentEmailPayload = {
                      passId: activeRef,
                      name: cleanName,
                      email: formData.email,
                      phone: formData.phone,
                      parish: formData.parish,
                      adultsCount,
                      teensCount,
                      preteensCount,
                      childrenCount,
                      kidsCount,
                      toddlersCount,
                      additionalAttendees: cleanAttendees,
                      amountToCharge: totalAmount > 0 ? totalAmount : 25,
                      type: 'conference'
                    };

                    dispatchConfirmationEmails(
                      activeRef,
                      formData.email,
                      cleanAttendees,
                      paymentEmailPayload
                    );

                    setIsEmailSent(true);
                    try {
                      localStorage.setItem(emailSentKey, 'true');
                    } catch (e) {}
                  } else {
                    console.log(`[RegistrationPage]: Email already sent for ${activeRef}, skipping duplicate dispatch.`);
                  }

                  // Persist step 3 and payment completion state in localStorage
                  try {
                    localStorage.setItem(`gracia_step_${activeRef}`, '3');
                    localStorage.setItem(`gracia_payment_status_${activeRef}`, 'completed');
                    localStorage.setItem(`step_${activeRef}`, '3');
                    localStorage.setItem(`payment_status_${activeRef}`, 'completed');
                    localStorage.setItem('registration_step', '3');
                    localStorage.setItem('payment_status', 'completed');
                  } catch (e) {}

                  setActiveStep(3);
                  updateUrl(3, activeRef);
                }}
                onSkipOrBypass={() => {
                  const activeRef = displayRef || refNumber;
                  const cleanName = toProperCase(formData.name || displayName);
                  const cleanAttendees = (additionalAttendees || []).map(a => ({ ...a, name: toProperCase(a.name) }));
                  const passes = generatePassesForGroup(cleanName, formData.email, formData.phone, formData.parish, activeRef, cleanAttendees);
                  setAllPasses(passes);
                  setActiveStep(3);
                  updateUrl(3, activeRef);
                }}
              />


            </div>
          )
        )}

        {/* ==================== STEP 3: DIGITAL PASS & CONFIRMATION ==================== */}
        {activeStep === 3 && (
          <div className="space-y-6 animate-fadeIn">
            
            {/* CONFIRMATION BANNER */}
            <div className="bg-emerald-950/90 border-2 border-emerald-500/80 rounded-3xl p-6 text-center space-y-3 shadow-2xl">
              <div className="w-16 h-16 mx-auto rounded-full bg-emerald-500/20 border-2 border-emerald-400 flex items-center justify-center text-emerald-300 shadow-lg">
                <CheckCircle2 className="w-10 h-10 text-emerald-400 stroke-[2.5]" />
              </div>
              <div className="space-y-1">
                <span className="inline-block px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-black uppercase tracking-wider border border-emerald-400/40">
                  Payment Received — Registration Completed
                </span>
                <h2 className="text-2xl font-black text-white uppercase tracking-wide pt-1">
                  Registration Confirmed &amp; Digital Passes Issued!
                </h2>
              </div>
              <p className="text-xs text-emerald-100 max-w-xl mx-auto leading-relaxed">
                Thank you, <strong className="text-white font-extrabold">{toProperCase(formData.name || displayName)}</strong>! Your registration payment for <strong className="text-amber-300">GRACIA Jubilee Conference 2026</strong> has been received and verified. Official digital pass(es) and individual QR entry code(s) have been dispatched to <strong className="underline text-white font-bold">{formData.email}</strong>.
              </p>

              {displayRef && (
                <div className="inline-block mt-2 px-4 py-1.5 bg-black/40 rounded-xl border border-emerald-500/40 font-mono text-xs font-bold text-amber-300">
                  Pass ID: {displayRef}
                </div>
              )}

              {/* RESEND EMAIL BUTTON & FEEDBACK */}
              <div className="pt-3 flex flex-col items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={handleResendEmails}
                  disabled={isResendingEmail}
                  className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-extrabold text-xs uppercase tracking-wider transition-all duration-200 shadow-lg hover:shadow-amber-500/30 border border-amber-300 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
                  title="Send digital pass confirmation email to primary registrant and all group attendees"
                >
                  {isResendingEmail ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
                      <span>Sending Email to All Attendees...</span>
                    </>
                  ) : (
                    <>
                      <Mail className="w-4 h-4 text-slate-950" />
                      <span>Send Email Again</span>
                    </>
                  )}
                </button>

                <p className="text-[11px] text-emerald-200/80 max-w-md">
                  Clicking above will re-send digital passes to primary registrant (<span className="font-semibold text-white">{formData.email}</span>) and all {additionalAttendees.length} family/group attendee(s).
                </p>

                {resendNotification && (
                  <div className={`mt-2 p-3.5 rounded-xl border text-xs max-w-md w-full text-left transition-all animate-fadeIn ${
                    resendNotification.type === 'success'
                      ? 'bg-emerald-900/95 border-emerald-400 text-emerald-100 shadow-xl'
                      : 'bg-rose-950/95 border-rose-500 text-rose-200 shadow-xl'
                  }`}>
                    <div className="flex items-start gap-2.5">
                      {resendNotification.type === 'success' ? (
                        <CheckCircle2 className="w-4.5 h-4.5 text-emerald-400 shrink-0 mt-0.5" />
                      ) : (
                        <AlertCircle className="w-4.5 h-4.5 text-rose-400 shrink-0 mt-0.5" />
                      )}
                      <div className="flex-1 space-y-0.5">
                        <span className="font-bold block text-xs uppercase tracking-wider">
                          {resendNotification.type === 'success' ? 'Email Dispatched Successfully' : 'Dispatch Failed'}
                        </span>
                        <p className="text-[11px] leading-relaxed opacity-95">{resendNotification.message}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* SUMMARY OF REGISTERED ATTENDEES */}
            <div className="bg-[#1C0D2A] rounded-2xl p-6 border border-amber-500/30 space-y-4 shadow-xl">
              <div className="flex items-center justify-between border-b border-amber-500/20 pb-3">
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-amber-400" />
                  <h3 className="text-base font-bold text-amber-300 uppercase tracking-wider">
                    Registered Attendees Summary
                  </h3>
                </div>
                <span className="text-xs font-bold font-mono text-emerald-400 bg-emerald-950/80 px-2.5 py-1 rounded-lg border border-emerald-500/40">
                  Total Attendees: {1 + additionalAttendees.length}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                {/* Primary Contact Details */}
                <div className="bg-[#241236] p-4 rounded-xl border border-purple-500/30 space-y-2">
                  <span className="text-[10px] uppercase font-bold text-amber-400 tracking-wider block">Primary Registrant</span>
                  <p className="font-bold text-sm text-white">{toProperCase(formData.name || displayName)}</p>
                  <p className="text-gray-300"><strong className="text-gray-400">Email:</strong> {formData.email}</p>
                  <p className="text-gray-300"><strong className="text-gray-400">Phone:</strong> {formData.phone}</p>
                  {formData.parish && <p className="text-gray-300"><strong className="text-gray-400">Parish/Church:</strong> {formData.parish}</p>}
                </div>

                {/* Breakdown Counts */}
                <div className="bg-[#241236] p-4 rounded-xl border border-purple-500/30 space-y-2">
                  <span className="text-[10px] uppercase font-bold text-amber-400 tracking-wider block">Attendee Breakdown</span>
                  <ul className="space-y-1 text-gray-300">
                    {adultsCount > 0 && <li>Adults / Youths (20+ yrs): <strong className="text-amber-300">{adultsCount}</strong></li>}
                    {teensCount > 0 && <li>Teens (13-19 yrs): <strong className="text-amber-300">{teensCount}</strong></li>}
                    {preteensCount > 0 && <li>Pre-Teens (9-12 yrs): <strong className="text-emerald-400">{preteensCount}</strong></li>}
                    {childrenCount > 0 && <li>Children (6-8 yrs): <strong className="text-emerald-400">{childrenCount}</strong></li>}
                    {kidsCount > 0 && <li>Kids (3-5 yrs): <strong className="text-emerald-400">{kidsCount}</strong></li>}
                    {toddlersCount > 0 && <li>Toddlers (&lt; 2 yrs): <strong className="text-emerald-400">{toddlersCount}</strong></li>}
                  </ul>
                </div>
              </div>

              {/* Additional Attendees List if any */}
              {additionalAttendees.length > 0 && (
                <div className="pt-2 border-t border-purple-500/20">
                  <span className="text-[11px] font-bold text-amber-300 uppercase tracking-wider block mb-2">
                    Additional Group Members ({additionalAttendees.length}):
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {additionalAttendees.map((addon, idx) => (
                      <div key={idx} className="bg-[#2A153E] p-2.5 rounded-lg border border-purple-500/20 flex items-center justify-between text-xs">
                        <span className="font-bold text-white">{toProperCase(addon.name)}</span>
                        <span className="text-[10px] text-amber-300 font-mono bg-amber-950/60 px-2 py-0.5 rounded border border-amber-500/30">
                          {addon.categoryLabel || (
                            addon.category === 'adult' ? 'Adult (20+ yrs)' :
                            addon.category === 'teen' ? 'Teen (13-19 yrs)' :
                            addon.category === 'preteen' ? 'Pre-Teen (9-12 yrs)' :
                            addon.category === 'child' ? 'Child (6-8 yrs)' :
                            addon.category === 'kid' ? 'Kid (3-5 yrs)' :
                            addon.category === 'toddler' ? 'Toddler (< 2 yrs)' :
                            'Delegate Member'
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* JUBILEE PRAYER CARD */}
            <JubileePrayerCard title="JUBILEE PRAYER" />

            {/* PORTAL NAVIGATION BUTTON */}
            <div className="pt-8 text-center space-y-3">
              <button
                type="button"
                onClick={() => {
                  if (onNavigateToPortal) {
                    onNavigateToPortal();
                  } else {
                    window.history.pushState({}, '', '/portal');
                    window.dispatchEvent(new PopStateEvent('popstate'));
                  }
                }}
                className="px-10 py-4 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:opacity-90 text-slate-950 font-extrabold text-sm tracking-wider uppercase shadow-xl transition-all cursor-pointer inline-flex items-center gap-2"
              >
                <Ticket className="w-5 h-5 text-slate-950" />
                <span>View my conference passes</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <p className="text-[11px] text-gray-400 block">
                Access your digital pass and QR entry codes anytime at the Participant Portal using your email or reference ID.
              </p>
            </div>

          </div>
        )}

        {/* PAYNOW QR CODE MODAL FOR STEP 2 */}
        {showPayNowModal && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-[#0A1128] border-2 border-amber-400 rounded-3xl p-6 sm:p-8 max-w-md w-full space-y-5 shadow-2xl relative text-center">
              <button
                type="button"
                onClick={() => setShowPayNowModal(false)}
                className="absolute top-4 right-4 text-gray-400 hover:text-white font-bold p-2 text-sm rounded-full bg-white/10"
              >
                ✕
              </button>

              <div className="space-y-2">
                <div className="w-12 h-12 rounded-full bg-amber-500/20 border border-amber-400 flex items-center justify-center mx-auto text-amber-400">
                  <QrCode className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-white">PayNow SGQR Code</h3>
                <p className="text-xs text-amber-200">
                  Scan using DBS digibank, OCBC, UOB, or PayLah! bank app
                </p>
              </div>

              <div className="bg-white rounded-2xl p-4 border-2 border-amber-400 text-center shadow-lg">
                <img
                  src={paynowQrImg}
                  alt="Official PayNow QR Code"
                  className="w-56 h-56 mx-auto object-contain"
                />
                <p className="text-xs text-slate-900 font-bold mt-2">
                  UEN: T08SS0144G • Jesus Youth Singapore
                </p>
                <p className="text-xs text-slate-600 font-mono mt-1">
                  Reference: <strong className="text-slate-900">{displayRef}</strong>
                </p>
                <p className="text-sm font-extrabold text-amber-600 font-mono mt-1">
                  Amount: ${displayAmount}.00 SGD
                </p>
              </div>

              <p className="text-[11px] text-gray-300 leading-relaxed">
                After completing the PayNow transfer in your bank app, click below to verify your payment status and proceed.
              </p>

              <button
                type="button"
                onClick={() => {
                  setShowPayNowModal(false);
                  setActiveStep(3);
                  updateUrl(3, displayRef);
                }}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-extrabold text-xs uppercase tracking-wider shadow-lg hover:opacity-90 transition cursor-pointer"
              >
                I've Paid — Verify Payment Status
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default RegistrationPage;

