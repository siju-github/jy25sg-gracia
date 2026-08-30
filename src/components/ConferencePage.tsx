import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { CountdownTimer } from './CountdownTimer';
import { IntercessionCounter } from './IntercessionCounter';
import { ConferenceHighlightsGrid } from './ConferenceHighlightsGrid';
import { SparkleConfetti } from './SparkleConfetti';
import { CelebrationFlashParticles } from './CelebrationFlashParticles';
import { JubileePrayerCard } from './JubileePrayerCard';
import { submitRegistration, sendConfirmationEmail } from '../lib/sheets';
import { findRegistrationByDetails, findAllRegistrationsByDetails, fetchAllRegistrations, updateRegistrationInFirestore } from '../lib/firebase';
import { RegistrationData, AdditionalAttendee } from '../types';
import { AdditionalAttendeesForm, buildExpectedAttendees } from './AdditionalAttendeesForm';
import { JubileeLogo } from './JubileeLogo';
import { JYLogo } from './JYLogo';
import { LoveOfferPayNowCard } from './LoveOfferPayNowCard';
import { HitPayCheckoutCard } from './HitPayCheckoutCard';
import { ConferenceRegistrationModal } from './ConferenceRegistrationModal';
import { SeatSelector } from './SeatSelector';
import { DigitalConferenceBadge } from './DigitalConferenceBadge';
import { generatePDFTicket, generateAllAttendeePasses, downloadIndividualPassPDF, AttendeePassItem } from '../lib/ticketGenerator';
import { getBibleVersePassId, getPersonDeterministicSeed } from '../lib/bibleVerses';
import { LocationMapModal } from './LocationMapModal';
import { toProperCase, isValidEmail } from '../lib/utils';
import { 
  Sparkles, 
  Calendar, 
  MapPin, 
  Navigation,
  Users, 
  Music, 
  Heart, 
  CheckCircle2, 
  Check, 
  AlertCircle, 
  Church, 
  BookOpen, 
  ShieldCheck, 
  ArrowDown, 
  UserPlus,
  Info,
  Ticket,
  PartyPopper,
  X,
  Plus,
  Minus,
  Mail,
  Baby,
  Zap,
  Smile,
  Star,
  Download,
  QrCode,
  RefreshCw
} from 'lucide-react';
import { motion } from 'motion/react';
import confetti from 'canvas-confetti';

interface ConferencePageProps {
  onNavigateToMusical: () => void;
}

export const ConferencePage: React.FC<ConferencePageProps> = ({ onNavigateToMusical }) => {
  // Location Map Modal state
  const [showLocationModal, setShowLocationModal] = useState(false);

  // Reveal state for registration form
  const [showForm, setShowForm] = useState(false);
  const [showSparkleModal, setShowSparkleModal] = useState(false);
  const [showCelebrationParticles, setShowCelebrationParticles] = useState(false);
  const [maybeLaterNudge, setMaybeLaterNudge] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    adultsCount: 1,
    teensCount: 0,
    preteensCount: 0,
    childrenCount: 0,
    kidsCount: 0,
    toddlersCount: 0,
    comments: '',
    pdpaConsent: false,
    honeypot: '' // Spam protection
  });

  const [additionalAttendees, setAdditionalAttendees] = useState<AdditionalAttendee[]>([]);

  // Duplicate registration & update states
  const [existingRegFound, setExistingRegFound] = useState<RegistrationData | null>(null);
  const [existingConferenceReg, setExistingConferenceReg] = useState<RegistrationData | null>(null);
  const [existingMusicalReg, setExistingMusicalReg] = useState<RegistrationData | null>(null);
  const [existingDocId, setExistingDocId] = useState<string | null>(null);
  const [loadedRecordId, setLoadedRecordId] = useState<string | null>(null);
  const [showDuplicateModal, setShowDuplicateModal] = useState<boolean>(false);
  const [pendingDuplicateCheck, setPendingDuplicateCheck] = useState<RegistrationData | null>(null);
  const [showExistingBanner, setShowExistingBanner] = useState<boolean>(true);
  const [detailsLoadedMessage, setDetailsLoadedMessage] = useState<string | null>(null);
  const dismissedBannerEmailRef = useRef<string | null>(null);

  const handleCloseNoticeBanner = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const currentEmail = formData.email ? formData.email.trim().toLowerCase() : 'dismissed';
    dismissedBannerEmailRef.current = currentEmail;
    setShowExistingBanner(false);
  };

  // Payment completion state
  const [checkoutReturnRef, setCheckoutReturnRef] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const session = params.get('session');
    const ref = params.get('ref') || params.get('reference_number') || params.get('referenceNumber');
    if (session === 'checkout_return' && ref) {
      setCheckoutReturnRef(ref);
      setShowForm(true);
    }
  }, []);

  const [paymentCompleted, setPaymentCompleted] = useState<boolean>(false);
  const [completedPaymentDetails, setCompletedPaymentDetails] = useState<{
    paymentRequestId: string;
    amount: number;
    baseFee: number;
    additionalContribution: number;
    referenceNumber: string;
  } | null>(null);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submitMessage, setSubmitMessage] = useState('');

  // Concert Seat Selection & QR Ticket states
  const [submittedDocId, setSubmittedDocId] = useState<string | null>(null);
  const [selectedSeats, setSelectedSeats] = useState<string[]>([]);
  const [bookedSeats, setBookedSeats] = useState<string[]>([]);
  const [showSeatSelector, setShowSeatSelector] = useState<boolean>(false);
  const [issuedTicket, setIssuedTicket] = useState<{ pdfBase64: string; qrCodeDataUri: string } | null>(null);
  const [emailSentStatus, setEmailSentStatus] = useState<boolean>(false);
  const [isSendingEmailOnly, setIsSendingEmailOnly] = useState<boolean>(false);
  const [allPasses, setAllPasses] = useState<AttendeePassItem[]>([]);
  const [emailNoticeData, setEmailNoticeData] = useState<{
    status?: string;
    sentEmails?: string[];
    recipientCount?: number;
    message?: string;
  } | null>(null);

  const totalAttendeesCount = Math.max(1, (Number(formData.adultsCount) || 0) + (Number(formData.teensCount) || 0) + (Number(formData.preteensCount) || 0) + (Number(formData.childrenCount) || 0) + (Number(formData.kidsCount) || 0));

  const openSeatPicker = async () => {
    setIsSubmitting(true);
    try {
      const allRegs = await fetchAllRegistrations();
      const musicalRegs = allRegs.filter(r => (r.type === 'musical' || r.type === 'conference') && r.status !== 'cancelled');
      const taken: string[] = [];
      musicalRegs.forEach(r => {
        if (r.selectedSeats && Array.isArray(r.selectedSeats)) {
          taken.push(...r.selectedSeats);
        }
      });
      setBookedSeats(taken);
    } catch (err) {
      console.error('Error fetching booked seats:', err);
    }
    setIsSubmitting(false);
    setShowSeatSelector(true);
  };

  const handleSeatsConfirmed = async (chosenSeats: string[]) => {
    setSelectedSeats(chosenSeats);
    setShowSeatSelector(false);

    const activeDocId = submittedDocId || existingDocId || `GRACIA-CONF-${Math.floor(100000 + Math.random() * 900000)}`;
    const expectedAddons = buildExpectedAttendees(
      Number(formData.adultsCount),
      Number(formData.teensCount),
      Number(formData.preteensCount),
      Number(formData.childrenCount),
      additionalAttendees,
      Number(formData.kidsCount),
      Number(formData.toddlersCount)
    );
    const mappedAddons = expectedAddons.map((addon, idx) => {
      const p = allPasses[idx + 1];
      return p ? { ...addon, passId: p.passId || addon.passId } : addon;
    });

    const regPayload: RegistrationData = {
      id: activeDocId,
      passId: allPasses[0]?.passId || (existingConferenceReg || existingRegFound)?.passId,
      type: 'conference',
      name: formData.name.trim(),
      email: formData.email.trim(),
      phone: formData.phone.trim(),
      adultsCount: Number(formData.adultsCount),
      teensCount: Number(formData.teensCount),
      preteensCount: Number(formData.preteensCount),
      childrenCount: Number(formData.childrenCount),
      kidsCount: Number(formData.kidsCount),
      toddlersCount: Number(formData.toddlersCount),
      comments: formData.comments.trim(),
      additionalAttendees: mappedAddons,
      selectedSeats: chosenSeats,
      createdAt: new Date().toISOString()
    };

    const { pdfBase64, qrCodeDataUri } = await generatePDFTicket(regPayload, activeDocId);
    setIssuedTicket({ pdfBase64, qrCodeDataUri });

    if (activeDocId) {
      await updateRegistrationInFirestore(activeDocId, { selectedSeats: chosenSeats });
    }

    // Send confirmation email WITH attached PDF ticket ON SEAT CONFIRMED ONLY
    try {
      const emailRes = await sendConfirmationEmail(regPayload, false, pdfBase64);
      setEmailNoticeData(emailRes);
      setEmailSentStatus(true);
    } catch (err) {
      console.error('Error dispatching seat confirmation email:', err);
    }

    // Confetti celebration
    confetti({
      particleCount: 140,
      spread: 90,
      origin: { y: 0.5 },
      colors: ['#2242A6', '#C81E6E', '#E8752C', '#E8B400', '#D62828']
    });
  };

  const handleSendEmailWithoutSeats = async () => {
    setIsSendingEmailOnly(true);
    const activeDocId = submittedDocId || existingDocId || `GRACIA-CONF-${Math.floor(100000 + Math.random() * 900000)}`;
    const expectedAddons = buildExpectedAttendees(
      Number(formData.adultsCount),
      Number(formData.teensCount),
      Number(formData.preteensCount),
      Number(formData.childrenCount),
      additionalAttendees,
      Number(formData.kidsCount),
      Number(formData.toddlersCount)
    );
    const mappedAddons = expectedAddons.map((addon, idx) => {
      const p = allPasses[idx + 1];
      return p ? { ...addon, passId: p.passId || addon.passId } : addon;
    });

    const regPayload: RegistrationData = {
      id: activeDocId,
      passId: allPasses[0]?.passId || (existingConferenceReg || existingRegFound)?.passId,
      type: 'conference',
      name: formData.name.trim(),
      email: formData.email.trim(),
      phone: formData.phone.trim(),
      adultsCount: Number(formData.adultsCount),
      teensCount: Number(formData.teensCount),
      preteensCount: Number(formData.preteensCount),
      childrenCount: Number(formData.childrenCount),
      kidsCount: Number(formData.kidsCount),
      toddlersCount: Number(formData.toddlersCount),
      comments: formData.comments.trim(),
      additionalAttendees: mappedAddons,
      selectedSeats: [],
      createdAt: new Date().toISOString()
    };

    try {
      const emailRes = await sendConfirmationEmail(regPayload, false, undefined);
      setEmailNoticeData(emailRes);
      setEmailSentStatus(true);
    } catch (err) {
      console.error('Error sending confirmation email without seats:', err);
    } finally {
      setIsSendingEmailOnly(false);
    }
  };

  const downloadPDFTicket = () => {
    if (!issuedTicket?.pdfBase64) return;
    const link = document.createElement('a');
    link.href = issuedTicket.pdfBase64;
    link.download = `GRACIA-Concert-Pass-${formData.name.replace(/\s+/g, '_')}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formRef = useRef<HTMLDivElement>(null);

  // Scroll to top of confirmation card when submitted (second page loaded)
  useEffect(() => {
    if (isSubmitted && formRef.current) {
      setTimeout(() => {
        if (formRef.current) {
          const yOffset = -90;
          const element = formRef.current;
          const y = element.getBoundingClientRect().top + window.pageYOffset + yOffset;
          window.scrollTo({ top: y, behavior: 'smooth' });
        }
      }, 50);
    }
  }, [isSubmitted]);

  const handleYesClick = () => {
    setMaybeLaterNudge(false);
    setShowCelebrationParticles(true);
  };

  const handleCelebrationComplete = () => {
    setShowCelebrationParticles(false);
    window.history.pushState({}, '', '/register?celebrate=true');
    window.dispatchEvent(new Event('popstate'));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSparkleComplete = () => {
    setShowSparkleModal(false);
    setShowForm(true);
  };

  // Helper function to load an existing record into form state
  const loadRegistrationRecordIntoForm = (reg: RegistrationData) => {
    setLoadedRecordId(reg.id || null);
    if (reg.type === 'conference') {
      setExistingDocId(reg.id || null);
    }
    setFormData(prev => ({
      ...prev,
      name: prev.name && prev.name.trim() ? prev.name : (reg.name || prev.name),
      email: prev.email && prev.email.trim() ? prev.email : (reg.email || prev.email),
      phone: prev.phone && prev.phone.trim() ? prev.phone : (reg.phone || prev.phone),
      adultsCount: reg.adultsCount ?? prev.adultsCount,
      teensCount: reg.teensCount ?? prev.teensCount,
      preteensCount: reg.preteensCount ?? prev.preteensCount,
      childrenCount: reg.childrenCount ?? prev.childrenCount,
      kidsCount: reg.kidsCount ?? prev.kidsCount,
      toddlersCount: reg.toddlersCount ?? prev.toddlersCount,
      comments: reg.comments || prev.comments,
    }));

    if (reg.additionalAttendees && Array.isArray(reg.additionalAttendees)) {
      const loadedAddons = buildExpectedAttendees(
        Number(reg.adultsCount ?? 0),
        Number(reg.teensCount ?? 0),
        Number(reg.preteensCount ?? 0),
        Number(reg.childrenCount ?? 0),
        reg.additionalAttendees,
        Number(reg.kidsCount ?? 0),
        Number(reg.toddlersCount ?? 0)
      );
      setAdditionalAttendees(loadedAddons);
    }
    if (reg.selectedSeats && Array.isArray(reg.selectedSeats)) {
      setSelectedSeats(reg.selectedSeats);
    }
  };

  // Check Firestore for duplicate on input blur
  const checkForExistingRegistration = async (emailVal: string, nameVal: string, phoneVal: string) => {
    const cleanEmail = emailVal ? emailVal.trim().toLowerCase() : '';
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setExistingConferenceReg(null);
      setExistingRegFound(null);
      setExistingMusicalReg(null);
      setExistingDocId(null);
      setLoadedRecordId(null);
      setShowExistingBanner(false);
      return;
    }
    const { musical, conference } = await findAllRegistrationsByDetails(cleanEmail, nameVal, phoneVal);
    setExistingConferenceReg(conference);
    setExistingRegFound(conference || musical);
    setExistingMusicalReg(musical);

    const targetRecord = conference || musical;
    if (targetRecord && targetRecord.id) {
      if (loadedRecordId !== targetRecord.id) {
        loadRegistrationRecordIntoForm(targetRecord);
      }
      // Only show notice banner if user has not explicitly dismissed it for this email address
      if (dismissedBannerEmailRef.current !== cleanEmail) {
        setShowExistingBanner(true);
      }
    } else {
      setShowExistingBanner(false);
      setLoadedRecordId(null);
      // If no registration matches the new clean email, clear existingDocId so edited email is saved as a distinct record or updated
      setExistingDocId(null);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target as HTMLInputElement;
    const val = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value;
    
    setFormData(prev => ({ ...prev, [name]: val }));

    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }

    if (name === 'email' || name === 'phone' || name === 'name') {
      if (showExistingBanner) {
        setShowExistingBanner(false);
      }
    }
  };

  const handleInputBlur = () => {
    if (formData.name) {
      setFormData(prev => ({ ...prev, name: toProperCase(prev.name) }));
    }
    if (formData.email && formData.email.includes('@')) {
      checkForExistingRegistration(formData.email, formData.name, formData.phone);
    }
  };

  const updateCount = (field: 'adultsCount' | 'teensCount' | 'preteensCount' | 'childrenCount' | 'kidsCount' | 'toddlersCount', delta: number) => {
    setFormData(prev => {
      const current = Number(prev[field]) || 0;
      const updated = Math.max(0, current + delta);
      return { ...prev, [field]: updated };
    });
    if (errors.adultsCount) {
      setErrors(prev => ({ ...prev, adultsCount: '' }));
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Full name is required';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email address is required';
    } else if (!isValidEmail(formData.email.trim())) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (!formData.phone.trim()) {
      newErrors.phone = 'Contact number is required';
    } else if (formData.phone.replace(/\D/g, '').length < 8) {
      newErrors.phone = 'Please enter a valid contact number (min 8 digits)';
    }

    const totalAttendees = Number(formData.adultsCount) + Number(formData.teensCount) + Number(formData.preteensCount) + Number(formData.childrenCount) + Number(formData.kidsCount) + Number(formData.toddlersCount);
    if (totalAttendees <= 0) {
      newErrors.adultsCount = 'Please indicate at least 1 attendee joining';
    } else if (Number(formData.adultsCount) === 0 && Number(formData.teensCount) === 0) {
      newErrors.adultsCount = 'At least 1 Adult or Teen / Youth participant (13+ years old) is required as primary registrant.';
    }

    // Validate Additional Attendees
    const expectedAttendees = buildExpectedAttendees(
      Number(formData.adultsCount),
      Number(formData.teensCount),
      Number(formData.preteensCount),
      Number(formData.childrenCount),
      additionalAttendees,
      Number(formData.kidsCount),
      Number(formData.toddlersCount)
    );

    expectedAttendees.forEach(item => {
      const isAdultOrTeen = item.category === 'adult' || item.category === 'teen';
      if (!item.name.trim()) {
        newErrors[`${item.id}-name`] = 'Full name is required';
      }
      if (isAdultOrTeen) {
        if (!item.email?.trim()) {
          newErrors[`${item.id}-email`] = 'Email address is required';
        } else if (!isValidEmail(item.email.trim())) {
          newErrors[`${item.id}-email`] = 'Please enter a valid email address';
        }
        if (!item.phone?.trim()) {
          newErrors[`${item.id}-phone`] = 'Contact number is required';
        } else if (item.phone.replace(/\D/g, '').length < 8) {
          newErrors[`${item.id}-phone`] = 'Min 8 digits required';
        }
      }
    });

    if (!formData.pdpaConsent) {
      newErrors.pdpaConsent = 'You must agree to the terms and conditions to proceed.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateFormAndScrollToError = () => {
    const isValid = validateForm();
    if (!isValid) {
      setTimeout(() => {
        let errorEl: HTMLElement | null = null;

        // 1. Primary Contact details in DOM order
        if (!formData.name.trim()) {
          errorEl = document.querySelector<HTMLElement>('input[name="name"]');
        } else if (!formData.email.trim() || !isValidEmail(formData.email.trim())) {
          errorEl = document.querySelector<HTMLElement>('input[name="email"]');
        } else if (!formData.phone.trim() || formData.phone.replace(/\D/g, '').length < 8) {
          errorEl = document.querySelector<HTMLElement>('input[name="phone"]');
        }

        // 2. Query DOM for any input, select, or textarea marked with red error border
        if (!errorEl) {
          errorEl = document.querySelector<HTMLElement>(
            'input.border-red-500, select.border-red-500, textarea.border-red-500'
          );
        }

        // 3. PDPA terms consent checkbox
        if (!errorEl && !formData.pdpaConsent) {
          errorEl = document.querySelector<HTMLElement>('input[name="pdpaConsent"]');
        }

        // 4. Smooth scroll directly to error element and apply high-contrast focus highlight
        if (errorEl) {
          errorEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
          if ('focus' in errorEl && typeof errorEl.focus === 'function') {
            errorEl.focus();
          }

          errorEl.classList.add('ring-4', 'ring-red-500', 'ring-offset-2');
          setTimeout(() => {
            errorEl?.classList.remove('ring-4', 'ring-red-500', 'ring-offset-2');
          }, 2500);
        }
      }, 60);
    }
    return isValid;
  };

  const executeFinalSubmission = async (
    targetDocId?: string | null,
    paymentDetails?: {
      paymentRequestId: string;
      amount: number;
      baseFee: number;
      additionalContribution: number;
      referenceNumber: string;
    }
  ) => {
    setIsSubmitting(true);

    const formattedPrimaryName = toProperCase(formData.name.trim());
    const primarySeed = getPersonDeterministicSeed(formData.email, formData.phone, formattedPrimaryName);
    const existingPassId = existingConferenceReg?.passId || existingRegFound?.passId;
    const finalPassId = existingPassId || getBibleVersePassId(primarySeed, 0, formattedPrimaryName);

    const expectedAddons = buildExpectedAttendees(
      Number(formData.adultsCount),
      Number(formData.teensCount),
      Number(formData.preteensCount),
      Number(formData.childrenCount),
      additionalAttendees,
      Number(formData.kidsCount),
      Number(formData.toddlersCount)
    ).map((addon, idx) => {
      const formattedAddonName = toProperCase(addon.name.trim());
      const addonSeed = getPersonDeterministicSeed(addon.email, addon.phone, formattedAddonName) || `${primarySeed}_ADD_${idx + 1}_${formattedAddonName.toLowerCase()}`;
      return {
        ...addon,
        name: formattedAddonName,
        passId: addon.passId || getBibleVersePassId(addonSeed, idx + 1, formattedAddonName)
      };
    });

    const primaryCategory = (Number(formData.adultsCount) > 0) ? 'adult' : 'teen';
    const primaryCategoryLabel = primaryCategory === 'teen' ? 'Teen / Youth (13-19 yrs)' : 'Adults/Youths (20+ yrs)';

    const registrationData: any = {
      type: 'conference',
      passId: finalPassId,
      name: formattedPrimaryName,
      email: formData.email.trim(),
      phone: formData.phone.trim(),
      category: primaryCategory,
      categoryLabel: primaryCategoryLabel,
      adultsCount: Number(formData.adultsCount),
      teensCount: Number(formData.teensCount),
      preteensCount: Number(formData.preteensCount),
      childrenCount: Number(formData.childrenCount),
      kidsCount: Number(formData.kidsCount),
      toddlersCount: Number(formData.toddlersCount),
      comments: formData.comments.trim(),
      additionalAttendees: expectedAddons,
      createdAt: new Date().toISOString()
    };

    if (paymentDetails) {
      registrationData.paymentStatus = 'paid';
      registrationData.paymentAmount = paymentDetails.amount;
      registrationData.paymentReference = paymentDetails.referenceNumber;
      registrationData.hitpayRequestId = paymentDetails.paymentRequestId;
      registrationData.additionalContribution = paymentDetails.additionalContribution;
    }

    const result = await submitRegistration(
      registrationData,
      undefined,
      targetDocId || undefined,
      undefined, // pdfTicketBase64
      true // Skip early email notification so we send hydrated passes below
    );

    setIsSubmitting(false);

    if (result.success) {
      const activeDocId = result.docId || targetDocId || `GRACIA-CONF-${Math.floor(100000 + Math.random() * 900000)}`;
      setSubmittedDocId(activeDocId);
      setIsSubmitted(true);
      setSubmitMessage(result.message);
      setExistingDocId(null);
      setExistingRegFound(null);

      // Generate individual entry passes with QR codes for all attendees
      registrationData.id = activeDocId;
      const passes = await generateAllAttendeePasses(registrationData, activeDocId);
      setAllPasses(passes);

      // Attach passIds onto registrationData and additionalAttendees
      if (passes && passes.length > 0) {
        registrationData.passId = passes[0].passId;
        if (registrationData.additionalAttendees && registrationData.additionalAttendees.length > 0) {
          registrationData.additionalAttendees = registrationData.additionalAttendees.map((addon, idx) => {
            const p = passes[idx + 1];
            return p ? { ...addon, passId: p.passId } : addon;
          });
        }
      }

      // Dispatch confirmation email notifications immediately and store response
      try {
        const emailRes = await sendConfirmationEmail(registrationData, !!targetDocId, undefined);
        setEmailNoticeData(emailRes);
        setEmailSentStatus(true);
      } catch (err) {
        console.error('Error dispatching confirmation email:', err);
      }

      // Do NOT issue ticket pass yet until seat selection is completed
      setIssuedTicket(null);
      setSelectedSeats([]);

      // Celebration confetti
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#2242A6', '#C81E6E', '#E8752C', '#E8B400', '#D62828']
      });
    } else {
      setErrors({ form: 'Failed to submit registration. Please try again.' });
    }
  };

  // Calculate previously paid amount for existing registration if editing
  const existingPaidAmount = useMemo(() => {
    const target = existingConferenceReg || existingRegFound;
    if (!target) return 0;
    if (target.paymentAmount !== undefined && target.paymentAmount !== null && Number(target.paymentAmount) > 0) {
      return Number(target.paymentAmount);
    }
    if (target.paymentStatus === 'paid' || target.paymentStatus === 'verified' || target.paymentStatus === 'completed') {
      const adults = Number(target.adultsCount) || 0;
      const teens = Number(target.teensCount) || 0;
      const paying = adults + teens;
      const base = Math.min(paying * 25, 100);
      const extra = Number(target.additionalContribution) || 0;
      return base + extra;
    }
    return 0;
  }, [existingConferenceReg, existingRegFound]);

  const handlePaymentSuccess = useCallback(async (paymentDetails: {
    paymentRequestId: string;
    amount: number;
    baseFee: number;
    additionalContribution: number;
    referenceNumber: string;
  }) => {
    const cumulativeAmountPaid = existingPaidAmount + paymentDetails.amount;
    const finalPaymentDetails = {
      ...paymentDetails,
      amount: cumulativeAmountPaid
    };

    setPaymentCompleted(true);
    setCompletedPaymentDetails(finalPaymentDetails);

    if (paymentDetails.amount > 0) {
      setDetailsLoadedMessage(`PayNow Payment of S$${paymentDetails.amount.toFixed(2)} verified successfully! Finalizing your conference registration...`);
    } else {
      setDetailsLoadedMessage(`Payment verified! Finalizing your conference registration...`);
    }

    // Auto complete registration submission if participant details are entered
    if (formData.name?.trim() && formData.email?.trim() && formData.phone?.trim() && !isSubmitting && !isSubmitted) {
      try {
        let activeTargetId = existingDocId;
        if (!activeTargetId) {
          setIsSubmitting(true);
          const { musical, conference } = await findAllRegistrationsByDetails(formData.email, formData.name, formData.phone);
          setIsSubmitting(false);

          setExistingConferenceReg(conference);
          setExistingRegFound(conference);
          setExistingMusicalReg(musical);

          if (conference) {
            setPendingDuplicateCheck(conference);
            setShowDuplicateModal(true);
            return;
          }
        }

        await executeFinalSubmission(activeTargetId, finalPaymentDetails);
      } catch (err) {
        console.error('Error auto-submitting registration after payment:', err);
      }
    }

    setTimeout(() => {
      setDetailsLoadedMessage(null);
    }, 8000);
  }, [existingPaidAmount, formData, isSubmitting, isSubmitted, existingDocId]);

  const handlePaymentReset = useCallback(() => {
    setPaymentCompleted(false);
    setCompletedPaymentDetails(null);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Honeypot spam check
    if (formData.honeypot) {
      console.warn('Bot detected via honeypot field');
      return;
    }

    if (!validateFormAndScrollToError()) {
      return;
    }

    if (!paymentCompleted || !completedPaymentDetails) {
      setErrors(prev => ({
        ...prev,
        form: '⚠️ Payment Required: Please generate the PayNow QR code above and complete your transfer before completing registration.'
      }));
      const checkoutEl = document.getElementById('hitpay-checkout-container');
      if (checkoutEl) {
        checkoutEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else if (formRef.current) {
        const yOffset = -90;
        const element = formRef.current;
        const y = element.getBoundingClientRect().top + window.pageYOffset + yOffset;
        window.scrollTo({ top: y, behavior: 'smooth' });
      }
      return;
    }

    // Check if there is an existing record with same name/email in Firestore
    let activeTargetId = existingDocId;
    if (!activeTargetId) {
      setIsSubmitting(true);
      const { musical, conference } = await findAllRegistrationsByDetails(formData.email, formData.name, formData.phone);
      setIsSubmitting(false);

      setExistingConferenceReg(conference);
      setExistingRegFound(conference);
      setExistingMusicalReg(musical);

      if (conference) {
        setPendingDuplicateCheck(conference);
        setShowDuplicateModal(true);
        return;
      }
    }

    await executeFinalSubmission(activeTargetId, completedPaymentDetails);
  };

  return (
    <div className="relative min-h-screen pb-24 overflow-hidden">
      
      {/* Confetti Modal Triggered on "Yes" */}
      <SparkleConfetti isOpen={showSparkleModal} onComplete={handleSparkleComplete} />
      <CelebrationFlashParticles isOpen={showCelebrationParticles} onComplete={handleCelebrationComplete} />

      {/* 1A. HERO SECTION WITH SILKY GALAXY ANIMATION */}
      <section className="relative pt-8 sm:pt-12 pb-16 sm:pb-20 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto overflow-hidden rounded-3xl">
        
        {/* Silky Smooth Animated Galaxy Nebulae & Glowing Orbs */}
        <motion.div
          animate={{
            scale: [1, 1.25, 0.95, 1],
            x: [0, 50, -30, 0],
            y: [0, -35, 40, 0],
            rotate: [0, 120, 240, 360],
          }}
          transition={{
            duration: 22,
            repeat: Infinity,
            repeatType: "mirror",
            ease: "easeInOut",
          }}
          className="absolute -top-16 -left-16 w-[480px] sm:w-[550px] h-[480px] sm:h-[550px] bg-gradient-to-tr from-[#C81E6E]/30 via-[#7E22CE]/25 to-[#E8752C]/20 rounded-full blur-3xl pointer-events-none -z-10"
        />

        <motion.div
          animate={{
            scale: [1, 1.3, 0.9, 1],
            x: [0, -60, 45, 0],
            y: [0, 45, -35, 0],
            rotate: [360, 240, 120, 0],
          }}
          transition={{
            duration: 26,
            repeat: Infinity,
            repeatType: "mirror",
            ease: "easeInOut",
          }}
          className="absolute -bottom-16 -right-16 w-[500px] sm:w-[580px] h-[500px] sm:h-[580px] bg-gradient-to-br from-[#2242A6]/30 via-[#E8B400]/25 to-[#C81E6E]/20 rounded-full blur-3xl pointer-events-none -z-10"
        />

        <motion.div
          animate={{
            scale: [0.85, 1.15, 0.85],
            opacity: [0.3, 0.65, 0.3],
          }}
          transition={{
            duration: 14,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] sm:w-[680px] h-[550px] sm:h-[680px] bg-gradient-to-r from-[#9333EA]/20 via-[#E8752C]/15 to-transparent rounded-full blur-3xl pointer-events-none -z-10"
        />

        {/* Twinkling Galaxy Stardust Particles */}
        {Array.from({ length: 20 }).map((_, i) => (
          <motion.div
            key={`hero-star-${i}`}
            className="absolute rounded-full bg-white pointer-events-none -z-10"
            style={{
              top: `${(i * 17 + 7) % 92}%`,
              left: `${(i * 23 + 11) % 96}%`,
              width: `${(i % 3) + 2}px`,
              height: `${(i % 3) + 2}px`,
              boxShadow: (i % 2 === 0) ? '0 0 10px 2px rgba(232, 180, 0, 0.85)' : '0 0 10px 2px rgba(255, 255, 255, 0.9)',
            }}
            animate={{
              opacity: [0.15, 0.95, 0.15],
              scale: [0.7, 1.5, 0.7],
            }}
            transition={{
              duration: 2.8 + (i % 4) * 1.1,
              repeat: Infinity,
              delay: (i % 5) * 0.6,
              ease: "easeInOut",
            }}
          />
        ))}

        {/* 2-Column Grid Layout on Desktop (lg:grid-cols-2), stacked on mobile */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
          
          {/* Left Column: Title & Event Details Block */}
          <div className="flex flex-col items-center lg:items-start text-center lg:text-left space-y-4 w-full">
            
            {/* Jubilee Badge */}
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center space-x-2 px-4 py-2 rounded-full bg-white/10 border border-white/20 backdrop-blur-md mb-1"
            >
              <span className="text-xs font-bold uppercase tracking-widest text-[#E8B400]">
                JESUS YOUTH SINGAPORE
              </span>
            </motion.div>

            {/* Color-Block GRACIA Wordmark */}
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.6 }}
              className="w-full"
            >
              <h1 className="font-poster text-6xl sm:text-8xl lg:text-7xl xl:text-8xl 2xl:text-9xl tracking-wider text-signature-animated drop-shadow-2xl uppercase">
                GRACIA
              </h1>
            </motion.div>

            {/* Cursive Tagline */}
            <p className="font-script text-2xl sm:text-3xl lg:text-3xl xl:text-4xl text-[#E8B400] drop-shadow-md">
              Celebrating 25 Years of Grace
            </p>

            <p className="font-sans text-base sm:text-lg lg:text-xl font-semibold text-white/90 tracking-wide">
              "Faithful Witness, Joyful Missionary"
            </p>

            {/* Event Key Meta Pill */}
            <div className="pt-2 flex flex-wrap items-center justify-center lg:justify-start gap-3 text-sm sm:text-base font-semibold w-full">
              <div className="flex items-center space-x-2.5 px-4 py-2.5 rounded-2xl bg-[#2c1140]/80 border border-white/15 text-white shadow-lg shrink-0">
                <Calendar className="w-5 h-5 text-[#E8752C] shrink-0" />
                <span className="whitespace-nowrap">10–11 October 2026</span>
              </div>

              <button
                type="button"
                onClick={() => setShowLocationModal(true)}
                className="flex items-center space-x-2.5 px-4 py-2.5 rounded-2xl bg-[#2c1140]/80 hover:bg-[#3d1958] border border-white/20 hover:border-amber-400 text-white shadow-lg shrink-0 cursor-pointer transition-all hover:scale-105 group"
                title="Click to view location map & directions"
              >
                <MapPin className="w-5 h-5 text-[#C81E6E] group-hover:scale-110 transition-transform shrink-0" />
                <span className="whitespace-nowrap">Caritas Agape Village, Singapore</span>
                <Navigation className="w-3.5 h-3.5 text-amber-400 opacity-80 group-hover:opacity-100 ml-1" />
              </button>
            </div>

          </div>

          {/* Right Column: Countdown Timer Block */}
          <div className="w-full">
            <CountdownTimer />
          </div>

        </div>

        {/* REGISTRATION & PARTIAL INDULGENCE 2-COLUMN GRID (PARALLEL ON DESKTOP, REGISTRATION TOP ON MOBILE) */}
        <div className="pt-8 max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 items-stretch">
          
          {/* LEFT COLUMN: REGISTRATION CALL TO ACTION */}
          <div className="h-full flex flex-col justify-between items-center p-6 sm:p-8 lg:p-8 rounded-3xl bg-gradient-to-b from-[#2c1140] to-[#1a0b22] border-2 border-[#E8B400]/40 shadow-2xl relative overflow-hidden text-center">
            <div className="absolute top-0 left-0 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-[#E8752C]/10 rounded-full blur-3xl pointer-events-none" />

            {/* Top: Brand Logo */}
            <div className="pt-1 sm:pt-2">
              <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto rounded-full bg-white p-2.5 flex items-center justify-center shadow-xl ring-4 ring-[#E8B400]/50 overflow-hidden shrink-0">
                <JYLogo className="w-full h-full object-contain aspect-square" />
              </div>
            </div>

            {/* Middle Content */}
            <div className="my-auto py-6 max-w-md mx-auto space-y-3">
              <p className="font-script text-2xl sm:text-3xl text-[#E8752C] leading-snug">
                25 Years of Grace<br />
                One Unforgettable Gathering
              </p>

              <h2 className="font-poster text-2xl sm:text-4xl text-white tracking-wide leading-tight">
                Would you like to celebrate this Jubilee together?
              </h2>
            </div>

            {/* Bottom Action Button */}
            <div className="w-full pt-2 pb-1 flex items-center justify-center">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleYesClick}
                id="yes-count-me-in-btn"
                className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-signature-animated text-white font-poster text-lg sm:text-xl tracking-wider shadow-2xl glow-pulse flex items-center justify-center space-x-3 cursor-pointer"
              >
                <CheckCircle2 className="w-6 h-6 text-white" />
                <span>YES, COUNT ME IN!</span>
              </motion.button>
            </div>

          </div>

          {/* RIGHT COLUMN: SPECIAL SPIRITUAL BLESSING BANNER (PARTIAL INDULGENCE) */}
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="h-full"
          >
            <div className="h-full flex flex-col justify-between relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#2a1138] via-[#3a1548] to-[#2a1138] border-2 border-[#E8B400] p-6 sm:p-7 shadow-2xl text-left backdrop-blur-md space-y-4">
              <div className="absolute top-0 right-0 transform translate-x-8 -translate-y-8 w-36 h-36 bg-[#E8B400]/10 rounded-full blur-2xl pointer-events-none" />
              
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row items-start gap-4">
                  <div className="p-3.5 rounded-2xl bg-[#E8B400]/20 border border-[#E8B400]/60 text-[#E8B400] shrink-0 shadow-lg">
                    <Church className="w-8 h-8 text-[#E8B400]" />
                  </div>
                  
                  <div className="space-y-2 flex-1">
                    <div className="inline-flex items-center space-x-2 px-3 py-0.5 rounded-full bg-[#E8B400]/20 border border-[#E8B400]/40 text-[#E8B400] text-[11px] font-extrabold uppercase tracking-widest">
                      <span>✝️ OFFICIAL APOSTOLIC BLESSING</span>
                    </div>
                    <h3 className="font-poster text-xl sm:text-2xl text-white tracking-wide">
                      A Special Gift of Grace: Partial Indulgence
                    </h3>
                  </div>
                </div>

                <p className="text-sm sm:text-base text-amber-100/95 leading-relaxed font-sans">
                  A Partial Indulgence has been granted by the Apostolic Penitentiary to all the faithful who, after fulfilling the customary conditions, participate in the Thanksgiving Mass celebrated by His Eminence William Cardinal Goh.
                </p>
              </div>

              {/* Bottom Customary Conditions Box to gracefully fill height */}
              <div className="mt-auto p-4 rounded-2xl bg-black/40 border border-[#E8B400]/30 space-y-3">
                <div className="flex items-center space-x-2 text-xs font-bold text-[#E8B400] uppercase tracking-wider">
                  <Sparkles className="w-4 h-4 text-[#E8B400]" />
                  <span>Customary Conditions for Receiving Indulgence</span>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                  <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 flex items-center space-x-2">
                    <div className="w-2 h-2 rounded-full bg-[#E8B400] shrink-0" />
                    <span className="text-xs text-amber-100 font-medium">Sacramental Confession</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 flex items-center space-x-2">
                    <div className="w-2 h-2 rounded-full bg-[#E8B400] shrink-0" />
                    <span className="text-xs text-amber-100 font-medium">Eucharistic Communion</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 flex items-center space-x-2">
                    <div className="w-2 h-2 rounded-full bg-[#E8B400] shrink-0" />
                    <span className="text-xs text-amber-100 font-medium">Prayers for Pope's Intentions</span>
                  </div>
                </div>
              </div>

            </div>
          </motion.div>

        </div>

        {/* 1C. MULTI-STEP REGISTRATION MODAL WIZARD */}
        <ConferenceRegistrationModal
          isOpen={showForm}
          checkoutReturnRef={checkoutReturnRef}
          onClose={() => {
            setIsSubmitted(false);
            setShowForm(false);
          }}
          formData={formData}
          setFormData={setFormData}
          additionalAttendees={additionalAttendees}
          setAdditionalAttendees={setAdditionalAttendees}
          errors={errors}
          setErrors={setErrors}
          handleInputChange={handleInputChange}
          handleInputBlur={handleInputBlur}
          updateCount={updateCount}
          existingRegFound={existingRegFound}
          existingConferenceReg={existingConferenceReg}
          existingDocId={existingDocId}
          showExistingBanner={showExistingBanner}
          handleCloseNoticeBanner={handleCloseNoticeBanner}
          detailsLoadedMessage={detailsLoadedMessage}
          setDetailsLoadedMessage={setDetailsLoadedMessage}
          isSubmitted={isSubmitted}
          setIsSubmitted={setIsSubmitted}
          isSubmitting={isSubmitting}
          allPasses={allPasses}
          emailNoticeData={emailNoticeData}
          downloadIndividualPassPDF={downloadIndividualPassPDF}
          onFinalSubmit={async (paymentDetails) => {
            let activeTargetId = existingDocId;
            if (!activeTargetId) {
              setIsSubmitting(true);
              const { musical, conference } = await findAllRegistrationsByDetails(formData.email, formData.name, formData.phone);
              setIsSubmitting(false);

              setExistingConferenceReg(conference);
              setExistingRegFound(conference);
              setExistingMusicalReg(musical);

              if (conference) {
                setPendingDuplicateCheck(conference);
                setShowDuplicateModal(true);
                return;
              }
            }
            await executeFinalSubmission(activeTargetId, paymentDetails);
          }}
          existingPaidAmount={existingPaidAmount}
          formRef={formRef}
          validateFormAndScrollToError={validateFormAndScrollToError}
          onResetForNewRegistration={() => {
            setFormData({
              name: '',
              email: '',
              phone: '',
              adultsCount: 1,
              teensCount: 0,
              preteensCount: 0,
              childrenCount: 0,
              kidsCount: 0,
              toddlersCount: 0,
              comments: '',
              pdpaConsent: false,
              honeypot: '',
            });
            setExistingRegFound(null);
            setExistingConferenceReg(null);
            setIsSubmitted(false);
          }}
        />
        <div className="pt-8 space-y-8">
          <div className="text-center space-y-3">
            <h2 className="font-poster text-4xl sm:text-5xl tracking-wide text-white">
              CONFERENCE <span className="text-signature-animated">HIGHLIGHTS</span>
            </h2>
            <p className="text-base sm:text-lg text-white/70 max-w-2xl mx-auto">
              A vibrant two-day Catholic faith festival filled with joyful worship, empowering talks, family fellowship, and an unforgettable Musical Concert.
            </p>
          </div>

          <ConferenceHighlightsGrid />
        </div>

      </section>

      {/* TAILORED PROGRAMMES SECTION */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 mb-8 sm:mb-10">

        {/* WHO IT'S FOR FEATURE CARDS - 4 REGISTRATION CATEGORIES */}
        <div className="pt-2 space-y-4">
          <div className="text-center space-y-1">
            <h3 className="font-poster text-2xl sm:text-3xl text-white tracking-wide">
              TAILORED PROGRAMMES FOR EVERY GENERATION
            </h3>
            <p className="text-xs sm:text-sm text-white/70 max-w-xl mx-auto">
              GRACIA offers dedicated streams and spiritual enrichment for every age group
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 pt-4">
            {/* 1. Adults / Youths */}
            <div className="p-5 rounded-2xl bg-white/5 border border-white/10 hover:border-[#E8752C]/50 hover:bg-white/[0.08] transition-all text-left space-y-3 relative group flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <div className="p-2.5 rounded-xl bg-[#E8752C]/20 border border-[#E8752C]/40 text-[#E8752C] shadow-sm">
                  <Users className="w-6 h-6" />
                </div>
                <span className="text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-[#E8752C]/20 text-[#FEE685] border border-[#E8752C]/40 tracking-wide">
                  20+ yrs
                </span>
              </div>
              <div>
                <h4 className="font-poster text-lg text-white tracking-wide">ADULTS & YOUTHS</h4>
                <p className="text-xs text-white/75 mt-1 leading-relaxed">
                  Empowering working adults, couples, parents, and young adults with inspiring keynotes, workshops, and faith-centered community.
                </p>
              </div>
            </div>

            {/* 2. Teens */}
            <div className="p-5 rounded-2xl bg-white/5 border border-white/10 hover:border-[#C81E6E]/50 hover:bg-white/[0.08] transition-all text-left space-y-3 relative group flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <div className="p-2.5 rounded-xl bg-[#C81E6E]/20 border border-[#C81E6E]/40 text-[#C81E6E] shadow-sm">
                  <Zap className="w-6 h-6" />
                </div>
                <span className="text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-[#C81E6E]/20 text-[#FEE685] border border-[#C81E6E]/40 tracking-wide">
                  13–19 yrs
                </span>
              </div>
              <div>
                <h4 className="font-poster text-lg text-white tracking-wide">TEENS</h4>
                <p className="text-xs text-white/75 mt-1 leading-relaxed">
                  Dynamic youth sessions, anointed praise & worship, motivational talks, and vibrant fellowship tailored for secondary & tertiary students.
                </p>
              </div>
            </div>

            {/* 3. Pre-Teens */}
            <div className="p-5 rounded-2xl bg-white/5 border border-white/10 hover:border-emerald-400/50 hover:bg-white/[0.08] transition-all text-left space-y-3 relative group flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <div className="p-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 shadow-sm">
                  <Star className="w-6 h-6" />
                </div>
                <span className="text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-[#FEE685] border border-emerald-500/40 tracking-wide">
                  9–12 yrs
                </span>
              </div>
              <div>
                <h4 className="font-poster text-lg text-white tracking-wide">PRE-TEENS</h4>
                <p className="text-xs text-white/75 mt-1 leading-relaxed">
                  Interactive faith adventure workshops, energetic group games, and spiritual mentorship for upper primary kids.
                </p>
              </div>
            </div>

            {/* 4. Children */}
            <div className="p-5 rounded-2xl bg-white/5 border border-white/10 hover:border-[#E8B400]/50 hover:bg-white/[0.08] transition-all text-left space-y-3 relative group flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <div className="p-2.5 rounded-xl bg-[#E8B400]/20 border border-[#E8B400]/40 text-[#E8B400] shadow-sm">
                  <Heart className="w-6 h-6" />
                </div>
                <span className="text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-[#E8B400]/20 text-[#FEE685] border border-[#E8B400]/40 tracking-wide">
                  6–8 yrs
                </span>
              </div>
              <div>
                <h4 className="font-poster text-lg text-white tracking-wide">CHILDREN</h4>
                <p className="text-xs text-white/75 mt-1 leading-relaxed">
                  Supervised fun, Bible storytelling, creative arts & crafts, and joyful kids’ praise activities throughout the conference.
                </p>
              </div>
            </div>
          </div>
        </div>

      </section>


{/* INTERCESSION COMMITMENT COUNTER SECTION (BOTTOM OF PAGE ABOVE FOOTER) */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 mb-8">
        <IntercessionCounter />
      </section>

      {/* JUBILEE PRAYER SECTION (BELOW INTERCESSION DIV & ABOVE FOOTER) */}
      <section id="jubilee-prayer-section" className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-4">
        <JubileePrayerCard />
      </section>

      {/* Duplicate Registration Modal Confirmation */}
      {showDuplicateModal && pendingDuplicateCheck && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-gray-100 space-y-5 text-[#241226]">
            <div className="flex items-center space-x-3 text-amber-600">
              <div className="p-3 bg-amber-100 rounded-2xl shrink-0">
                <AlertCircle className="w-7 h-7 text-amber-600" />
              </div>
              <div>
                <h3 className="font-poster text-2xl tracking-wide text-[#241226]">Existing Registration Found</h3>
                <p className="text-xs text-gray-500 font-medium">A registration record matches your details.</p>
              </div>
            </div>

            <p className="text-sm text-gray-700 leading-relaxed">
              A registration under <strong>{pendingDuplicateCheck.name}</strong> (<span className="font-semibold text-[#2242A6]">{pendingDuplicateCheck.email}</span>) was submitted on <strong>{new Date(pendingDuplicateCheck.createdAt).toLocaleDateString()}</strong>.
            </p>

            {/* Previous Registration Summary Box */}
            <div className="bg-amber-50/80 border border-amber-200/80 rounded-2xl p-4 text-xs space-y-2">
              <h4 className="font-bold uppercase tracking-wider text-amber-900 text-[11px]">Previous Registration Summary:</h4>
              <div className="grid grid-cols-2 gap-2 text-gray-800 font-medium">
                <div>• Adults/Youths: <strong className="text-[#2242A6] font-bold">{pendingDuplicateCheck.adultsCount}</strong></div>
                <div>• Teens (13–19): <strong className="text-[#2242A6] font-bold">{pendingDuplicateCheck.teensCount ?? 0}</strong></div>
                <div>• Pre-teens (9–12): <strong className="text-[#2242A6] font-bold">{pendingDuplicateCheck.preteensCount}</strong></div>
                <div>• Children (6–8): <strong className="text-[#2242A6] font-bold">{pendingDuplicateCheck.childrenCount}</strong></div>
                <div>• Kids (3–5): <strong className="text-[#2242A6] font-bold">{pendingDuplicateCheck.kidsCount ?? 0}</strong></div>
                <div>• Toddlers (2 & Below): <strong className="text-[#2242A6] font-bold">{pendingDuplicateCheck.toddlersCount}</strong></div>
              </div>
              {pendingDuplicateCheck.comments && (
                <div className="pt-1 text-gray-600 italic">
                  Comments: "{pendingDuplicateCheck.comments}"
                </div>
              )}
            </div>

            <p className="text-xs font-semibold text-gray-600">
              Would you like to update your previous registration record with the new details, or submit as a brand new separate registration?
            </p>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => {
                  setShowDuplicateModal(false);
                  setExistingDocId(pendingDuplicateCheck.id || null);
                  executeFinalSubmission(pendingDuplicateCheck.id, completedPaymentDetails);
                }}
                className="flex-1 py-3 px-4 rounded-xl bg-[#2242A6] hover:bg-[#1a3384] text-white font-bold text-xs uppercase tracking-wider shadow-md transition-all cursor-pointer flex items-center justify-center space-x-1.5"
              >
                <Check className="w-4 h-4" />
                <span>Update Previous Registration</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowDuplicateModal(false);
                  setExistingDocId(null);
                  executeFinalSubmission(null, completedPaymentDetails);
                }}
                className="py-3 px-4 rounded-xl bg-gray-100 hover:bg-gray-200 text-[#241226] font-bold text-xs uppercase tracking-wider transition-all cursor-pointer"
              >
                Submit as New Entry
              </button>
            </div>

            <div className="flex justify-between items-center pt-2 border-t border-gray-100 text-xs">
              <button
                type="button"
                onClick={() => {
                  setShowDuplicateModal(false);
                  setFormData({
                    name: pendingDuplicateCheck.name || formData.name,
                    email: pendingDuplicateCheck.email || formData.email,
                    phone: pendingDuplicateCheck.phone || formData.phone,
                    adultsCount: pendingDuplicateCheck.adultsCount ?? 0,
                    teensCount: pendingDuplicateCheck.teensCount ?? 0,
                    preteensCount: pendingDuplicateCheck.preteensCount ?? 0,
                    childrenCount: pendingDuplicateCheck.childrenCount ?? 0,
                    kidsCount: pendingDuplicateCheck.kidsCount ?? 0,
                    toddlersCount: pendingDuplicateCheck.toddlersCount ?? 0,
                    comments: pendingDuplicateCheck.comments || '',
                    pdpaConsent: formData.pdpaConsent,
                    honeypot: ''
                  });
                  setExistingDocId(pendingDuplicateCheck.id || null);
                }}
                className="text-[#2242A6] hover:underline font-bold text-xs cursor-pointer"
              >
                Load previous details into form
              </button>

              <button
                type="button"
                onClick={() => setShowDuplicateModal(false)}
                className="text-gray-400 hover:text-gray-600 font-medium text-xs cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LOCATION MAP MODAL */}
      <LocationMapModal
        isOpen={showLocationModal}
        onClose={() => setShowLocationModal(false)}
        venueName="Agape Village"
        address="7A Lorong 8 Toa Payoh, Singapore 319264"
        hallName="Jubilee Conference Venue"
      />
    </div>
  );
};
