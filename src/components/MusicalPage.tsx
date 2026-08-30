import React, { useState, useRef, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { submitRegistration, sendConfirmationEmail } from '../lib/sheets';
import { 
  findRegistrationByDetails, 
  findAllRegistrationsByDetails, 
  fetchAllRegistrations,
  saveRegistrationToFirestore,
  auth,
  db,
  SUPER_ADMIN_EMAIL,
  PRIMARY_ADMIN_GMAIL
} from '../lib/firebase';
import { RegistrationData, AdditionalAttendee, ApprovedAdminData } from '../types';
import { AdditionalAttendeesForm, buildExpectedAttendees } from './AdditionalAttendeesForm';
import { JubileePrayerCard } from './JubileePrayerCard';
import { LoveOfferPayNowCard } from './LoveOfferPayNowCard';
import { SeatSelector } from './SeatSelector';
import { DigitalConferenceBadge } from './DigitalConferenceBadge';
import { generatePDFTicket, generateAllAttendeePasses, downloadIndividualPassPDF, AttendeePassItem } from '../lib/ticketGenerator';
import { LocationMapModal } from './LocationMapModal';
import { isValidEmail } from '../lib/utils';
import { 
  Music, 
  Sparkles, 
  Calendar, 
  MapPin, 
  Navigation,
  Ticket, 
  CheckCircle2, 
  Check,
  AlertCircle, 
  UserPlus, 
  Mic2, 
  Volume2, 
  Guitar,
  Star,
  ShieldCheck,
  Info,
  Plus,
  Minus,
  X,
  ArrowLeft,
  Mail,
  QrCode,
  Download,
  Printer,
  ArrowRight,
  Image as ImageIcon,
  Sliders,
  Video,
  Play,
  Pause,
  Film,
  Gauge,
  Upload,
  Trash2,
  Save,
  Link,
  Loader2,
  Church,
  Crown,
  Clock,
  Building,
  Phone,
  DollarSign,
  CreditCard,
  Copy
} from 'lucide-react';
import paynowQrImg from '../assets/images/regenerated_image_1785556021273.jpg';
import { motion, AnimatePresence } from 'motion/react';
import confetti from 'canvas-confetti';
import { fetchSiteContent, saveSiteContent } from '../lib/firebase';
import { DEFAULT_VIDEO_PRESETS } from '../data/initialData';
import { VideoSceneItem } from '../types';
import { saveLocalVideo, getLocalVideos, removeLocalVideo } from '../lib/videoStorage';

import { 
  validateInvitationCode, 
  redeemInvitationCode, 
  InvitationCodeRecord 
} from '../lib/invitationCodes';

interface MusicalPageProps {
  onClose?: () => void;
  onNavigateToPortal?: (subTab?: string) => void;
}

export const MusicalPage: React.FC<MusicalPageProps> = ({ onClose, onNavigateToPortal }) => {
  // Location Map Modal state
  const [showLocationModal, setShowLocationModal] = useState(false);

  // Reservation Options Modal & Invitation Verification State
  const [showReservationFlowModal, setShowReservationFlowModal] = useState(false);
  const [showInvitationCodeModal, setShowInvitationCodeModal] = useState(false);

  // Option 1: Clergy & VIP Modal State
  const [showClergyVipModal, setShowClergyVipModal] = useState(false);
  const [clergyName, setClergyName] = useState('');
  const [clergyEmail, setClergyEmail] = useState('');
  const [clergyPhone, setClergyPhone] = useState('');
  const [clergyDesignation, setClergyDesignation] = useState('Priest / Clergy');
  const [clergyParish, setClergyParish] = useState('');
  const [clergySeats, setClergySeats] = useState(1);
  const [clergyRemarks, setClergyRemarks] = useState('');
  const [submittingClergyVip, setSubmittingClergyVip] = useState(false);
  const [clergyVipError, setClergyVipError] = useState<string | null>(null);
  const [clergyVipSuccess, setClergyVipSuccess] = useState<{ refId: string; name: string; seats: number } | null>(null);

  // Option 4: Waitlist Modal State
  const [showWaitlistModal, setShowWaitlistModal] = useState(false);
  const [waitlistName, setWaitlistName] = useState('');
  const [waitlistEmail, setWaitlistEmail] = useState('');
  const [waitlistPhone, setWaitlistPhone] = useState('');
  const [waitlistSeats, setWaitlistSeats] = useState(1);
  const [waitlistCategory, setWaitlistCategory] = useState('General Public');
  const [waitlistRemarks, setWaitlistRemarks] = useState('');
  const [submittingWaitlist, setSubmittingWaitlist] = useState(false);
  const [waitlistError, setWaitlistError] = useState<string | null>(null);
  const [waitlistSuccess, setWaitlistSuccess] = useState<{ refId: string; name: string; email: string; seats: number } | null>(null);

  // Option 3: Invitation Code State & Step Control
  const [invitationStep, setInvitationStep] = useState<'verify' | 'details' | 'payment' | 'success'>('verify');
  const [invitationCodeInput, setInvitationCodeInput] = useState('');
  const [invitationCodeError, setInvitationCodeError] = useState<string | null>(null);
  const [invitationCodeSuccess, setInvitationCodeSuccess] = useState<string | null>(null);
  const [verifyingCode, setVerifyingCode] = useState(false);
  const [verifiedCodeRecord, setVerifiedCodeRecord] = useState<InvitationCodeRecord | null>(null);

  // Invitation Code Registration Form State
  const [invitationMainName, setInvitationMainName] = useState('');
  const [invitationMainEmail, setInvitationMainEmail] = useState('');
  const [invitationMainPhone, setInvitationMainPhone] = useState('');
  const [invitationGroupMembers, setInvitationGroupMembers] = useState<string[]>([]);
  const [invitationPayRef, setInvitationPayRef] = useState('');
  const [invitationPayReceipt, setInvitationPayReceipt] = useState<string | null>(null);
  const [submittingInvitationRedemption, setSubmittingInvitationRedemption] = useState(false);
  const [invitationRedemptionError, setInvitationRedemptionError] = useState<string | null>(null);
  const [invitationRedemptionSuccess, setInvitationRedemptionSuccess] = useState<{
    refId: string;
    name: string;
    email: string;
    seats: number;
  } | null>(null);

  // Option 1: Clergy & VIP Reservation Handler
  const handleClergyVipSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clergyName.trim() || !clergyEmail.trim() || !clergyPhone.trim()) {
      setClergyVipError('Please fill in your name, email, and phone number.');
      return;
    }
    setSubmittingClergyVip(true);
    setClergyVipError(null);

    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const refId = `VIP-2026-${randomSuffix}`;

    try {
      const regRecord: Omit<RegistrationData, 'id'> = {
        type: 'musical',
        name: clergyName.trim(),
        email: clergyEmail.trim().toLowerCase(),
        phone: clergyPhone.trim(),
        adultsCount: clergySeats,
        preteensCount: 0,
        childrenCount: 0,
        toddlersCount: 0,
        isClergyVip: true,
        designation: clergyDesignation,
        parish: clergyParish.trim(),
        seatsReserved: clergySeats,
        comments: `[Clergy & VIP Reservation] Ref: ${refId}. Designation: ${clergyDesignation}. Parish: ${clergyParish}. Remarks: ${clergyRemarks}`,
        createdAt: new Date().toISOString(),
        status: 'confirmed',
        categoryLabel: `Clergy & VIP (${clergyDesignation})`,
      };

      await saveRegistrationToFirestore(regRecord);

      try {
        confetti({ particleCount: 70, spread: 60, origin: { y: 0.6 } });
      } catch {
        // ignore
      }

      setClergyVipSuccess({
        refId,
        name: clergyName.trim(),
        seats: clergySeats,
      });
    } catch (err) {
      console.error('Failed to submit Clergy/VIP reservation:', err);
      setClergyVipError('Unable to complete reservation. Please try again.');
    } finally {
      setSubmittingClergyVip(false);
    }
  };

  // Option 4: Waitlist Interest Submission Handler
  const handleWaitlistSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!waitlistName.trim() || !waitlistEmail.trim() || !waitlistPhone.trim()) {
      setWaitlistError('Please fill in your name, email, and phone number.');
      return;
    }
    setSubmittingWaitlist(true);
    setWaitlistError(null);

    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const refId = `WTL-2026-${randomSuffix}`;

    try {
      const regRecord: Omit<RegistrationData, 'id'> = {
        type: 'musical',
        name: waitlistName.trim(),
        email: waitlistEmail.trim().toLowerCase(),
        phone: waitlistPhone.trim(),
        adultsCount: waitlistSeats,
        preteensCount: 0,
        childrenCount: 0,
        toddlersCount: 0,
        seatsNeeded: waitlistSeats,
        comments: `[Waitlist & Interest] Ref: ${refId}. Category: ${waitlistCategory}. Seats: ${waitlistSeats}. Remarks: ${waitlistRemarks}`,
        createdAt: new Date().toISOString(),
        status: 'confirmed',
        categoryLabel: `Waitlist (${waitlistCategory})`,
      };

      await saveRegistrationToFirestore(regRecord);

      setWaitlistSuccess({
        refId,
        name: waitlistName.trim(),
        email: waitlistEmail.trim().toLowerCase(),
        seats: waitlistSeats,
      });
    } catch (err) {
      console.error('Failed to submit waitlist registration:', err);
      setWaitlistError('Unable to register waitlist interest. Please try again.');
    } finally {
      setSubmittingWaitlist(false);
    }
  };
  const [videoScenes, setVideoScenes] = useState<VideoSceneItem[]>(DEFAULT_VIDEO_PRESETS);
  const [activeVideoId, setActiveVideoId] = useState<string>('auditorium');
  const [customVideoUrl, setCustomVideoUrl] = useState<string | null>(null);
  const [removedVideoIds, setRemovedVideoIds] = useState<string[]>([]);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(0.5); // Slow motion by default
  const [isVideoPlaying, setIsVideoPlaying] = useState<boolean>(true);
  const [showBgCustomizer, setShowBgCustomizer] = useState<boolean>(false);
  const [isContentAdmin, setIsContentAdmin] = useState<boolean>(false);
  const [isSavingVideo, setIsSavingVideo] = useState<boolean>(false);
  const [videoNotification, setVideoNotification] = useState<string | null>(null);
  const [videoUrlInput, setVideoUrlInput] = useState<string>('');
  const [videoNameInput, setVideoNameInput] = useState<string>('');
  const [showAddUrlInput, setShowAddUrlInput] = useState<boolean>(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const bgCustomizerRef = useRef<HTMLDivElement>(null);

  // Handle invitation code from URL parameters e.g. ?code=GRACIA-VIP-8291
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const codeParam = urlParams.get('code') || urlParams.get('invitationCode');
    if (codeParam) {
      const uppercaseCode = codeParam.toUpperCase().trim();
      setInvitationCodeInput(uppercaseCode);
      setVerifyingCode(true);
      validateInvitationCode(uppercaseCode).then((res) => {
        setVerifyingCode(false);
        if (res.valid && res.codeRecord) {
          setVerifiedCodeRecord(res.codeRecord);
          setInvitationCodeSuccess(res.message || 'Invitation Code verified!');
          setShowForm(true);
        } else {
          setInvitationCodeError(res.message || 'Invalid invitation code in URL.');
          setShowInvitationCodeModal(true);
        }
      });
    }
  }, []);

  const handleVerifyInvitationCode = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!invitationCodeInput.trim()) {
      setInvitationCodeError('Please enter an invitation code.');
      return;
    }
    setVerifyingCode(true);
    setInvitationCodeError(null);
    setInvitationCodeSuccess(null);

    const res = await validateInvitationCode(invitationCodeInput);
    setVerifyingCode(false);

    if (res.valid && res.codeRecord) {
      const rec = res.codeRecord;
      setVerifiedCodeRecord(rec);
      setInvitationCodeSuccess(res.message || 'Invitation code verified!');

      // Pre-fill fields if present
      setInvitationMainName(rec.recipientName || rec.assignedToName || '');
      setInvitationMainEmail(rec.recipientEmail || rec.assignedToEmail || '');
      setInvitationMainPhone(rec.assignedToPhone || '');

      const totalSeats = rec.maxSeats || 1;
      const remaining = totalSeats - (rec.seatsUsed || 0);
      const isGroupCode = rec.codeType === 'group' || rec.type === 'group' || totalSeats > 1;

      if (isGroupCode && remaining > 1) {
        setInvitationGroupMembers(Array(Math.max(0, remaining - 1)).fill(''));
      } else {
        setInvitationGroupMembers([]);
      }

      setInvitationRedemptionError(null);
      setInvitationStep('details');
    } else {
      setInvitationCodeError(res.message || 'Invalid or expired invitation code.');
    }
  };

  const processInvitationPassIssuance = async (
    paymentStatus: 'verified' | 'pending_verification',
    paymentDetailsText: string
  ) => {
    setSubmittingInvitationRedemption(true);
    setInvitationRedemptionError(null);

    try {
      const validGroupNames = invitationGroupMembers
        .map((n) => n.trim())
        .filter(Boolean);

      const additionalAttendees: AdditionalAttendee[] = validGroupNames.map((name, i) => ({
        id: `addon-inv-${Date.now()}-${i + 1}`,
        category: 'adult',
        categoryLabel: 'Adult',
        name,
      }));

      const totalSeatsReserved = 1 + additionalAttendees.length;
      const ticketDocId = `INV-PASS-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

      const regPayload: Omit<RegistrationData, 'id'> = {
        type: 'musical',
        name: invitationMainName.trim(),
        email: invitationMainEmail.trim().toLowerCase(),
        phone: invitationMainPhone.trim(),
        adultsCount: totalSeatsReserved,
        teensCount: 0,
        preteensCount: 0,
        childrenCount: 0,
        toddlersCount: 0,
        comments: `Claimed via Invitation Code: ${verifiedCodeRecord?.code} | ${paymentDetailsText}`,
        additionalAttendees,
        createdAt: new Date().toISOString(),
        status: 'confirmed',
        paymentStatus,
        source_type: 'INVITATION_CODE',
        invitation_code_id: verifiedCodeRecord?.id,
        invitation_code: verifiedCodeRecord?.code,
        invitationCode: verifiedCodeRecord?.code,
        seatsReserved: totalSeatsReserved,
      };

      // Generate Ticket PDF with QR Code
      const { pdfBase64 } = await generatePDFTicket(regPayload, ticketDocId);

      // Save registration to Firestore and dispatch confirmation email
      const result = await submitRegistration(
        regPayload,
        undefined,
        ticketDocId,
        pdfBase64
      );

      if (result.success && verifiedCodeRecord) {
        // Redeem invitation code
        await redeemInvitationCode(verifiedCodeRecord.id, totalSeatsReserved, {
          registrationId: ticketDocId,
          registrantName: invitationMainName.trim(),
          registrantEmail: invitationMainEmail.trim().toLowerCase(),
        });

        setInvitationRedemptionSuccess({
          refId: ticketDocId,
          name: invitationMainName.trim(),
          email: invitationMainEmail.trim().toLowerCase(),
          seats: totalSeatsReserved,
        });
        setInvitationStep('success');
      } else {
        setInvitationRedemptionError(result.message || 'Failed to generate pass. Please try again.');
      }
    } catch (err) {
      console.error('Error completing invitation registration:', err);
      setInvitationRedemptionError('An error occurred while creating your pass. Please try again.');
    } finally {
      setSubmittingInvitationRedemption(false);
    }
  };

  const handleInvitationDetailsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invitationMainName.trim() || !invitationMainEmail.trim() || !invitationMainPhone.trim()) {
      setInvitationRedemptionError('Please fill in Name, Email, and Phone for the main incharge person.');
      return;
    }
    if (!verifiedCodeRecord) {
      setInvitationRedemptionError('No verified invitation code found. Please re-enter your code.');
      setInvitationStep('verify');
      return;
    }

    setInvitationRedemptionError(null);

    // If ticket type is 'paid', move to PayNow QR code payment step!
    if (verifiedCodeRecord.ticketType === 'paid') {
      setInvitationStep('payment');
      return;
    }

    // If complimentary, proceed directly to complete pass issuance!
    await processInvitationPassIssuance('verified', 'Complimentary Pass (100% Waived)');
  };

  const handleInvitationPaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invitationPayRef.trim()) {
      setInvitationRedemptionError('Please enter your PayNow Transaction Reference / UEN receipt number.');
      return;
    }
    const pricePerSeat = verifiedCodeRecord?.ticketPrice || 10;
    const totalSeats = 1 + invitationGroupMembers.filter(Boolean).length;
    const totalAmount = pricePerSeat * totalSeats;

    await processInvitationPassIssuance(
      'pending_verification',
      `Paid Ticket ($${pricePerSeat}/seat) | Total: $${totalAmount} SGD | PayRef: ${invitationPayRef.trim()}`
    );
  };

  // Load saved video scenes and active selection from localStorage, IndexedDB & Firestore on mount
  useEffect(() => {
    let isMounted = true;
    const loadSavedVideoData = async () => {
      let localRemoved: string[] = [];
      let localScenes: VideoSceneItem[] | null = null;
      try {
        const rawRem = localStorage.getItem('gracia_removed_video_ids');
        if (rawRem) localRemoved = JSON.parse(rawRem);
        const rawSc = localStorage.getItem('gracia_custom_video_scenes');
        if (rawSc) localScenes = JSON.parse(rawSc);
      } catch (e) {
        console.warn('Error reading video scenes from localStorage:', e);
      }

      // Fetch local video files from IndexedDB
      const indexedDbVideos = await getLocalVideos();
      const indexedDbMap = new Map<string, string>();
      indexedDbVideos.forEach(v => {
        if (v.id && v.url) indexedDbMap.set(v.id, v.url);
      });

      try {
        const content = await fetchSiteContent();
        if (content && isMounted) {
          const firestoreRemoved = content.removedVideoIds || [];
          const allRemoved = Array.from(new Set([...localRemoved, ...firestoreRemoved]));
          setRemovedVideoIds(allRemoved);
          try {
            localStorage.setItem('gracia_removed_video_ids', JSON.stringify(allRemoved));
          } catch {}

          let scenes = content.customVideoScenes || localScenes || DEFAULT_VIDEO_PRESETS;
          
          // Restore actual Data URLs for any video stored in IndexedDB
          scenes = scenes.map(s => {
            if ((s.url === 'indexeddb_stored' || !s.url) && indexedDbMap.has(s.id)) {
              return { ...s, url: indexedDbMap.get(s.id)! };
            }
            return s;
          });

          // Append any local IndexedDB custom scenes not present in Firestore list
          indexedDbVideos.forEach(idbVideo => {
            if (!scenes.some(s => s.id === idbVideo.id)) {
              scenes.push({
                id: idbVideo.id,
                name: idbVideo.name,
                url: idbVideo.url,
                icon: idbVideo.icon || '🎥',
                isCustom: true
              });
            }
          });

          // Exclude removed scenes
          scenes = scenes.filter(s => !allRemoved.includes(s.id));

          setVideoScenes(scenes);

          const activeId = content.activeVideoId || localStorage.getItem('gracia_active_video_id');
          if (activeId && scenes.some(s => s.id === activeId)) {
            setActiveVideoId(activeId);
            const foundScene = scenes.find(s => s.id === activeId);
            if (foundScene && foundScene.url && foundScene.url !== 'indexeddb_stored') {
              setCustomVideoUrl(foundScene.url);
            }
          } else if (scenes.length > 0) {
            setActiveVideoId(scenes[0].id);
            if (scenes[0].url && scenes[0].url !== 'indexeddb_stored') {
              setCustomVideoUrl(scenes[0].url);
            }
          }
        }
      } catch (err) {
        console.warn('Error fetching site video scenes:', err);
        // Fallback to local
        if (isMounted) {
          let validLocal = (localScenes || DEFAULT_VIDEO_PRESETS).filter(s => !localRemoved.includes(s.id));
          validLocal = validLocal.map(s => {
            if (s.url === 'indexeddb_stored' && indexedDbMap.has(s.id)) {
              return { ...s, url: indexedDbMap.get(s.id)! };
            }
            return s;
          });
          setVideoScenes(validLocal);
          setRemovedVideoIds(localRemoved);
        }
      }
    };
    loadSavedVideoData();
    return () => { isMounted = false; };
  }, []);

  // Check if current authenticated user is a Content Admin, Super Admin, or Full Admin
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser || !currentUser.email) {
        setIsContentAdmin(false);
        return;
      }
      const emailNorm = currentUser.email.toLowerCase().trim();
      const superEmails = [
        SUPER_ADMIN_EMAIL.toLowerCase(), 
        PRIMARY_ADMIN_GMAIL.toLowerCase(),
        'sijumonabraham@gmail.com'
      ];
      if (superEmails.includes(emailNorm)) {
        setIsContentAdmin(true);
        return;
      }

      try {
        const adminDocRef = doc(db, 'approved_admins', emailNorm);
        const snap = await getDoc(adminDocRef);
        if (snap.exists()) {
          const data = snap.data() as ApprovedAdminData;
          if (data.status === 'approved') {
            const role = data.role || 'admin';
            const allowedRoles = ['content_admin', 'full_admin', 'admin', 'super_admin'];
            if (allowedRoles.includes(role)) {
              setIsContentAdmin(true);
              return;
            }
          }
        }
        setIsContentAdmin(false);
      } catch (err) {
        console.error('Error verifying content admin role:', err);
        setIsContentAdmin(false);
      }
    });
    return () => unsubscribe();
  }, []);

  const currentSelectedScene = videoScenes.find(v => v.id === activeVideoId);
  const activeVideoUrl = currentSelectedScene?.url || customVideoUrl || videoScenes[0]?.url || DEFAULT_VIDEO_PRESETS[0].url;

  // Persist video configuration to localStorage, IndexedDB and Firestore site_content
  const persistVideoConfig = async (
    scenes: VideoSceneItem[],
    activeId: string,
    activeUrl: string | null,
    removedIds: string[]
  ) => {
    setIsSavingVideo(true);

    // Filter scenes for localStorage to prevent QuotaExceededError on large data URLs
    const safeLocalScenes = scenes.map(s => {
      if (s.url && s.url.startsWith('data:') && s.url.length > 100000) {
        return { ...s, url: 'indexeddb_stored' };
      }
      return s;
    });

    try {
      localStorage.setItem('gracia_removed_video_ids', JSON.stringify(removedIds));
      localStorage.setItem('gracia_custom_video_scenes', JSON.stringify(safeLocalScenes));
      localStorage.setItem('gracia_active_video_id', activeId);
      if (activeUrl && !activeUrl.startsWith('data:')) {
        localStorage.setItem('gracia_active_video_url', activeUrl);
      }
    } catch (e) {
      console.warn('localStorage save warning:', e);
    }

    try {
      await saveSiteContent({
        customVideoScenes: scenes,
        activeVideoId: activeId,
        activeVideoUrl: (activeUrl && activeUrl.length < 100000) ? activeUrl : 'indexeddb_stored',
        removedVideoIds: removedIds
      });
      setVideoNotification('✓ Background video saved & synced!');
      setTimeout(() => setVideoNotification(null), 3500);
    } catch (err) {
      console.warn('Error saving video config to Firestore:', err);
      setVideoNotification('Notice: Background video updated for current session.');
      setTimeout(() => setVideoNotification(null), 3500);
    } finally {
      setIsSavingVideo(false);
    }
  };

  // Sync video properties (slow motion speed, loop, muted, playback)
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = playbackSpeed;
      videoRef.current.muted = true;
      videoRef.current.loop = true;
      if (isVideoPlaying) {
        videoRef.current.play().catch(() => {});
      } else {
        videoRef.current.pause();
      }
    }
  }, [playbackSpeed, activeVideoUrl, isVideoPlaying]);

  // Close customizer on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (bgCustomizerRef.current && !bgCustomizerRef.current.contains(event.target as Node)) {
        setShowBgCustomizer(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Upload custom video file and convert to Data URL + save to IndexedDB & Firestore
  const handleVideoFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const videoDataUrl = event.target?.result as string;
        if (videoDataUrl) {
          const newId = `custom_vid_${Date.now()}`;
          const newName = file.name.replace(/\.[^/.]+$/, '') || 'Uploaded Video';
          const newScene: VideoSceneItem = {
            id: newId,
            name: newName,
            url: videoDataUrl,
            icon: '🎥',
            isCustom: true
          };

          // Store full video binary in browser IndexedDB so it survives refreshes
          await saveLocalVideo({
            id: newId,
            name: newName,
            url: videoDataUrl,
            icon: '🎥',
            isCustom: true,
            createdAt: Date.now()
          });

          const updatedScenes = [...videoScenes, newScene];
          setVideoScenes(updatedScenes);
          setActiveVideoId(newId);
          setCustomVideoUrl(videoDataUrl);
          setIsVideoPlaying(true);

          persistVideoConfig(updatedScenes, newId, videoDataUrl, removedVideoIds);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Add custom video URL link (MP4/WebM)
  const handleAddVideoUrl = () => {
    if (!videoUrlInput.trim()) return;
    const url = videoUrlInput.trim();
    const name = videoNameInput.trim() || 'Custom Video Scene';
    const newId = `url_vid_${Date.now()}`;

    const newScene: VideoSceneItem = {
      id: newId,
      name,
      url,
      icon: '🔗',
      isCustom: true
    };

    const updatedScenes = [...videoScenes, newScene];
    setVideoScenes(updatedScenes);
    setActiveVideoId(newId);
    setCustomVideoUrl(url);
    setIsVideoPlaying(true);
    setVideoUrlInput('');
    setVideoNameInput('');
    setShowAddUrlInput(false);

    persistVideoConfig(updatedScenes, newId, url, removedVideoIds);
  };

  // Remove / Delete existing video scene
  const handleRemoveVideoScene = async (sceneId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();

    await removeLocalVideo(sceneId);

    const updatedScenes = videoScenes.filter(s => s.id !== sceneId);
    const updatedRemoved = Array.from(new Set([...removedVideoIds, sceneId]));

    setVideoScenes(updatedScenes);
    setRemovedVideoIds(updatedRemoved);

    let nextActiveId = activeVideoId;
    let nextActiveUrl = customVideoUrl;

    if (activeVideoId === sceneId) {
      if (updatedScenes.length > 0) {
        nextActiveId = updatedScenes[0].id;
        nextActiveUrl = updatedScenes[0].url;
      } else {
        nextActiveId = 'auditorium';
        nextActiveUrl = DEFAULT_VIDEO_PRESETS[0].url;
      }
      setActiveVideoId(nextActiveId);
      setCustomVideoUrl(nextActiveUrl);
    }

    persistVideoConfig(updatedScenes, nextActiveId, nextActiveUrl, updatedRemoved);
  };
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
    honeypot: ''
  });

  const [additionalAttendees, setAdditionalAttendees] = useState<AdditionalAttendee[]>([]);

  // Duplicate registration & update states
  const [existingRegFound, setExistingRegFound] = useState<RegistrationData | null>(null);
  const [existingMusicalReg, setExistingMusicalReg] = useState<RegistrationData | null>(null);
  const [existingConferenceReg, setExistingConferenceReg] = useState<RegistrationData | null>(null);
  const [existingDocId, setExistingDocId] = useState<string | null>(null);
  const [loadedRecordId, setLoadedRecordId] = useState<string | null>(null);
  const [showDuplicateModal, setShowDuplicateModal] = useState<boolean>(false);
  const [pendingDuplicateCheck, setPendingDuplicateCheck] = useState<RegistrationData | null>(null);
  const [showForm, setShowForm] = useState<boolean>(false);
  const [currentStep, setCurrentStep] = useState<'form' | 'seat_selector' | 'confirmed'>('form');
  const [bookedSeats, setBookedSeats] = useState<string[]>([]);
  const [selectedSeats, setSelectedSeats] = useState<string[]>([]);
  const [issuedTicket, setIssuedTicket] = useState<{
    ticketId: string;
    pdfBase64: string;
    qrCodeDataUri: string;
    seats: string[];
  } | null>(null);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submitMessage, setSubmitMessage] = useState('');
  const [allPasses, setAllPasses] = useState<AttendeePassItem[]>([]);
  const [emailNoticeData, setEmailNoticeData] = useState<{
    status?: string;
    sentEmails?: string[];
    recipientCount?: number;
    message?: string;
  } | null>(null);

  const formRef = useRef<HTMLDivElement>(null);

  // Scroll to top of confirmation card when submitted (second page loaded)
  useEffect(() => {
    if (isSubmitted && formRef.current) {
      setTimeout(() => {
        formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 50);
    }
  }, [isSubmitted]);

  const updateCount = (field: keyof typeof formData, delta: number) => {
    setFormData(prev => {
      const current = typeof prev[field] === 'number' ? (prev[field] as number) : 0;
      const updated = Math.max(0, current + delta);
      return { ...prev, [field]: updated };
    });
  };

  const scrollToForm = () => {
    setShowForm(true);
    setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  };

  const loadRegistrationRecordIntoForm = (reg: RegistrationData) => {
    setLoadedRecordId(reg.id || null);
    if (reg.type === 'musical') {
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
        reg.additionalAttendees
      );
      setAdditionalAttendees(loadedAddons);
    }
    if (reg.selectedSeats && Array.isArray(reg.selectedSeats)) {
      setSelectedSeats(reg.selectedSeats);
    }
  };

  const checkForExistingRegistration = async (emailVal: string, nameVal: string, phoneVal: string) => {
    if (!emailVal || !emailVal.includes('@')) {
      setExistingMusicalReg(null);
      setExistingRegFound(null);
      setExistingConferenceReg(null);
      setExistingDocId(null);
      setLoadedRecordId(null);
      return;
    }
    const { musical, conference } = await findAllRegistrationsByDetails(emailVal, nameVal, phoneVal);
    setExistingMusicalReg(musical);
    setExistingRegFound(musical || conference);
    setExistingConferenceReg(conference);

    const targetRecord = musical || conference;
    if (targetRecord && targetRecord.id) {
      if (loadedRecordId !== targetRecord.id) {
        loadRegistrationRecordIntoForm(targetRecord);
      }
    } else {
      setLoadedRecordId(null);
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
  };

  const handleInputBlur = () => {
    if (formData.email && formData.email.includes('@')) {
      checkForExistingRegistration(formData.email, formData.name, formData.phone);
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
      newErrors.phone = 'Please enter a valid contact number';
    }

    const totalAttendees = Number(formData.adultsCount) + Number(formData.teensCount) + Number(formData.preteensCount) + Number(formData.childrenCount) + Number(formData.kidsCount) + Number(formData.toddlersCount);
    if (totalAttendees <= 0) {
      newErrors.adultsCount = 'Please select at least 1 seat for the concert';
    } else if (Number(formData.adultsCount) === 0 && Number(formData.teensCount) === 0) {
      newErrors.adultsCount = 'At least 1 Adult or Teen / Youth participant (13+ years old) is required as primary registrant.';
    }

    // Validate Additional Attendees
    const expectedAttendees = buildExpectedAttendees(
      Number(formData.adultsCount),
      Number(formData.teensCount),
      Number(formData.preteensCount),
      Number(formData.childrenCount),
      additionalAttendees
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

  const loadBookedSeats = async (excludeDocId?: string | null, userEmail?: string) => {
    try {
      const allRegs = await fetchAllRegistrations();
      const musicalRegs = allRegs.filter(r => r.type === 'musical' && r.status !== 'cancelled');
      const taken: string[] = [];
      musicalRegs.forEach(r => {
        // Exclude current user's registration so their previously selected seats aren't marked as occupied by someone else
        if (excludeDocId && r.id === excludeDocId) return;
        if (userEmail && r.email && r.email.toLowerCase() === userEmail.toLowerCase()) return;

        if (r.selectedSeats && Array.isArray(r.selectedSeats)) {
          taken.push(...r.selectedSeats);
        }
      });
      setBookedSeats(taken);
    } catch (err) {
      console.error('Error fetching booked seats:', err);
    }
  };

  const proceedToSeatSelector = async (targetDocId?: string | null) => {
    setIsSubmitting(true);
    await loadBookedSeats(targetDocId || existingDocId, formData.email);
    setIsSubmitting(false);
    if (targetDocId) {
      setExistingDocId(targetDocId);
    }
    setCurrentStep('seat_selector');
    setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  };

  const handleSeatsConfirmed = async (chosenSeats: string[]) => {
    setIsSubmitting(true);
    setSelectedSeats(chosenSeats);

    const expectedAddons = buildExpectedAttendees(
      Number(formData.adultsCount),
      Number(formData.teensCount),
      Number(formData.preteensCount),
      Number(formData.childrenCount),
      additionalAttendees
    );

    const ticketDocId = existingDocId || `GRACIA-MUS-${Math.floor(100000 + Math.random() * 900000)}`;

    const sourceType: 'CONFERENCE_ATTENDEE' | 'INVITATION_CODE' = 
      verifiedCodeRecord ? 'INVITATION_CODE' : (existingConferenceReg ? 'CONFERENCE_ATTENDEE' : 'INVITATION_CODE');

    const primaryCategory = (Number(formData.adultsCount) > 0) ? 'adult' : 'teen';
    const primaryCategoryLabel = primaryCategory === 'teen' ? 'Teen / Youth (13-19 yrs)' : 'Adults/Youths (20+ yrs)';

    const regPayload: RegistrationData & { isConferenceRegistered?: boolean } = {
      id: ticketDocId,
      type: 'musical',
      name: formData.name.trim(),
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
      selectedSeats: chosenSeats,
      createdAt: new Date().toISOString(),
      isConferenceRegistered: !!existingConferenceReg,
      source_type: sourceType,
      conference_registration_id: existingConferenceReg?.id || undefined,
      invitation_code_id: verifiedCodeRecord?.id || undefined,
      invitation_code: verifiedCodeRecord?.code || undefined,
      invitationCode: verifiedCodeRecord?.code || undefined,
    };

    // Generate Ticket PDF & QR code
    const { pdfBase64, qrCodeDataUri } = await generatePDFTicket(regPayload, ticketDocId);

    // Save registration with PDF attachment sent in email
    const result = await submitRegistration(
      regPayload,
      undefined,
      existingDocId || undefined,
      pdfBase64,
      true // skip early email so we dispatch hydrated passes below
    );

    setIsSubmitting(false);

    if (result.success) {
      if (verifiedCodeRecord) {
        try {
          await redeemInvitationCode(verifiedCodeRecord.id, chosenSeats.length, {
            registrationId: ticketDocId,
            registrantName: formData.name.trim(),
            registrantEmail: formData.email.trim(),
          });
        } catch (err) {
          console.error('Error redeeming invitation code:', err);
        }
      }

      setIssuedTicket({
        ticketId: ticketDocId,
        pdfBase64,
        qrCodeDataUri,
        seats: chosenSeats
      });
      setIsSubmitted(true);
      setCurrentStep('confirmed');

      // Generate all individual passes with unique QR codes
      try {
        const passes = await generateAllAttendeePasses(regPayload, ticketDocId);
        setAllPasses(passes);

        if (passes && passes.length > 0) {
          regPayload.passId = passes[0].passId;
          if (regPayload.additionalAttendees && regPayload.additionalAttendees.length > 0) {
            regPayload.additionalAttendees = regPayload.additionalAttendees.map((addon, idx) => {
              const p = passes[idx + 1];
              return p ? { ...addon, passId: p.passId } : addon;
            });
          }
        }
      } catch (err) {
        console.error('Error generating all attendee passes:', err);
      }

      // Dispatch email notification and capture returned details
      try {
        const emailRes = await sendConfirmationEmail(regPayload, !!existingDocId, pdfBase64);
        setEmailNoticeData(emailRes);
      } catch (err) {
        console.error('Error dispatching email in MusicalPage:', err);
      }

      if (existingConferenceReg && !existingMusicalReg) {
        setSubmitMessage(`Thank you for reserving your seats for the GRACIA Musical Concert! We noticed you are also registered for the GRACIA Jubilee Conference under ${existingConferenceReg.name}. We look forward to seeing you at both events!`);
      } else {
        setSubmitMessage(result.message);
      }

      setExistingDocId(null);
      setExistingRegFound(null);
      setExistingMusicalReg(null);

      // Concert spotlight confetti
      confetti({
        particleCount: 140,
        spread: 90,
        origin: { y: 0.5 },
        colors: ['#2242A6', '#C81E6E', '#E8752C', '#E8B400', '#D62828']
      });
    } else {
      setErrors({ form: 'Failed to record registration. Please try again.' });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.honeypot) return;
    if (!validateForm()) return;

    if (!existingDocId) {
      setIsSubmitting(true);
      const { musical, conference } = await findAllRegistrationsByDetails(formData.email, formData.name, formData.phone);
      setIsSubmitting(false);

      setExistingMusicalReg(musical);
      setExistingRegFound(musical);
      setExistingConferenceReg(conference);

      if (musical) {
        setPendingDuplicateCheck(musical);
        setShowDuplicateModal(true);
        return;
      }
    }

    await proceedToSeatSelector(existingDocId);
  };

  return (
    <div className="relative min-h-screen pb-12 overflow-hidden bg-[#11071F] text-white">
      
      {/* FULL SCREEN SLOW MOTION LOOPING VIDEO BACKGROUND WITH FADED EDGES */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden select-none bg-[#11071F]">
        <video
          ref={videoRef}
          src={activeVideoUrl}
          autoPlay
          loop
          muted
          playsInline
          className="w-full h-full object-cover object-center scale-105 opacity-55 filter brightness-110 contrast-125 saturate-115 transition-opacity duration-700"
        />

        {/* Multi-Layered Soft Faded Edges Overlay Gradients into #11071F */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#11071F] via-[#11071F]/30 to-[#11071F]/85" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#11071F]/90 via-transparent to-[#11071F]" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#11071F] via-transparent to-[#11071F]" />
        <div className="absolute inset-0 [background:radial-gradient(ellipse_at_center,transparent_20%,#11071F_88%)]" />
      </div>

      <div className="relative z-10">
        {/* Concert Spotlight Background Glows */}
        <div className="absolute top-0 left-1/4 w-80 h-[400px] bg-[#2242A6]/20 blur-[100px] rounded-full pointer-events-none -z-10"></div>
        <div className="absolute top-10 right-1/4 w-80 h-[400px] bg-[#C81E6E]/20 blur-[100px] rounded-full pointer-events-none -z-10"></div>

      {/* CONCERT HERO SECTION */}
      <section className="relative pt-4 sm:pt-8 pb-8 px-4 sm:px-6 lg:px-8 text-center max-w-4xl mx-auto">
        
        <div className="flex items-center justify-between gap-2 mb-4">
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center space-x-2 px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-semibold backdrop-blur-md border border-white/20 transition-all cursor-pointer shadow-md active:scale-95"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Main Page</span>
            </button>
          ) : <div />}

          {/* BACKGROUND VIDEO CONTROL POPOVER - AVAILABLE ONLY FOR CONTENT ADMIN */}
          {isContentAdmin && (
            <div className="relative" ref={bgCustomizerRef}>
              <button
                type="button"
                onClick={() => setShowBgCustomizer(!showBgCustomizer)}
                className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-purple-900/50 hover:bg-purple-900/70 text-purple-200 text-xs font-bold backdrop-blur-md border border-purple-400/30 transition-all cursor-pointer shadow-lg active:scale-95"
                title="Configure Background Video & Motion (Content Admin Only)"
              >
                <Video className="w-3.5 h-3.5 text-purple-300 animate-pulse" />
                <span className="hidden sm:inline">Video Atmosphere</span>
                <span className="sm:hidden">Video</span>
                <span className="px-1.5 py-0.5 rounded-md bg-purple-950 text-[10px] text-amber-300 font-extrabold border border-amber-500/30">
                  {playbackSpeed}x Slow
                </span>
                <Sliders className="w-3 h-3 text-purple-400" />
              </button>

              {showBgCustomizer && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute right-0 mt-2 w-80 rounded-2xl bg-[#1d0b33]/95 border border-purple-500/40 p-4 shadow-2xl backdrop-blur-xl z-50 text-left space-y-3"
                >
                  <div className="flex items-center justify-between pb-2 border-b border-purple-500/20 text-xs font-extrabold text-purple-200 tracking-wider uppercase">
                    <div className="flex items-center space-x-1.5">
                      <Film className="w-4 h-4 text-[#E8B400]" />
                      <span>Concert Video Backdrop</span>
                    </div>
                    <button 
                      type="button" 
                      onClick={() => setShowBgCustomizer(false)}
                      className="p-1 rounded-lg hover:bg-purple-800/50 text-purple-300"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* PLAY / PAUSE & SPEED CONTROLS */}
                  <div className="p-2.5 rounded-xl bg-purple-950/60 border border-purple-500/20 space-y-2">
                    <div className="flex items-center justify-between text-xs font-medium text-purple-200">
                      <span className="flex items-center space-x-1.5">
                        <Gauge className="w-3.5 h-3.5 text-amber-400" />
                        <span>Motion Speed:</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setIsVideoPlaying(!isVideoPlaying)}
                        className="px-2 py-1 rounded-md bg-purple-800/60 hover:bg-purple-700 text-white text-[11px] font-bold flex items-center space-x-1"
                      >
                        {isVideoPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                        <span>{isVideoPlaying ? 'Pause' : 'Play'}</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-4 gap-1 pt-1">
                      {[0.25, 0.5, 0.75, 1.0].map((speed) => (
                        <button
                          key={speed}
                          type="button"
                          onClick={() => {
                            setPlaybackSpeed(speed);
                            if (!isVideoPlaying) setIsVideoPlaying(true);
                          }}
                          className={`py-1 rounded-lg text-[11px] font-bold transition-all ${
                            playbackSpeed === speed
                              ? 'bg-amber-500 text-slate-950 shadow-md font-extrabold'
                              : 'bg-purple-900/40 hover:bg-purple-800/60 text-purple-200'
                          }`}
                        >
                          {speed === 0.5 ? '0.5x Slow' : `${speed}x`}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* VIDEO NOTIFICATION BANNER */}
                  {videoNotification && (
                    <div className="p-2 rounded-xl bg-emerald-950/80 border border-emerald-500/40 text-[11px] text-emerald-200 font-medium flex items-center justify-between animate-fadeIn">
                      <span>{videoNotification}</span>
                    </div>
                  )}

                  {/* PLAY / PAUSE & SPEED CONTROLS */}
                  <div className="p-2.5 rounded-xl bg-purple-950/60 border border-purple-500/20 space-y-2">
                    <div className="flex items-center justify-between text-xs font-medium text-purple-200">
                      <span className="flex items-center space-x-1.5">
                        <Gauge className="w-3.5 h-3.5 text-amber-400" />
                        <span>Motion Speed:</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setIsVideoPlaying(!isVideoPlaying)}
                        className="px-2 py-1 rounded-md bg-purple-800/60 hover:bg-purple-700 text-white text-[11px] font-bold flex items-center space-x-1"
                      >
                        {isVideoPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                        <span>{isVideoPlaying ? 'Pause' : 'Play'}</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-4 gap-1 pt-1">
                      {[0.25, 0.5, 0.75, 1.0].map((speed) => (
                        <button
                          key={speed}
                          type="button"
                          onClick={() => {
                            setPlaybackSpeed(speed);
                            if (!isVideoPlaying) setIsVideoPlaying(true);
                          }}
                          className={`py-1 rounded-lg text-[11px] font-bold transition-all ${
                            playbackSpeed === speed
                              ? 'bg-amber-500 text-slate-950 shadow-md font-extrabold'
                              : 'bg-purple-900/40 hover:bg-purple-800/60 text-purple-200'
                          }`}
                        >
                          {speed === 0.5 ? '0.5x Slow' : `${speed}x`}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* VIDEO SCENES LIST WITH DELETE ACTION */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-purple-300 uppercase tracking-wider">Video Scenes</span>
                      {isSavingVideo && (
                        <span className="text-[10px] text-amber-300 flex items-center gap-1">
                          <Loader2 className="w-3 h-3 animate-spin" /> Saving...
                        </span>
                      )}
                    </div>

                    {videoScenes.length === 0 ? (
                      <p className="text-[11px] text-purple-300/60 italic py-1">No video scenes available. Please upload or add a link below.</p>
                    ) : (
                      videoScenes.map((scene) => {
                        const isActive = activeVideoId === scene.id;
                        return (
                          <div
                            key={scene.id}
                            onClick={() => {
                              setActiveVideoId(scene.id);
                              setCustomVideoUrl(scene.url);
                              setIsVideoPlaying(true);
                              persistVideoConfig(videoScenes, scene.id, scene.url, removedVideoIds);
                            }}
                            className={`w-full flex items-center space-x-2 p-2 rounded-xl text-xs font-semibold transition-all cursor-pointer group ${
                              isActive
                                ? 'bg-gradient-to-r from-[#C81E6E]/80 to-[#2242A6]/80 text-white border border-purple-300/40 shadow-md'
                                : 'bg-purple-950/40 hover:bg-purple-900/50 text-purple-200/90 hover:text-white border border-transparent'
                            }`}
                          >
                            <span className="text-base shrink-0">{scene.icon || '🎬'}</span>
                            <span className="flex-1 truncate">{scene.name}</span>
                            {isActive && <Check className="w-3.5 h-3.5 text-amber-300 shrink-0" />}

                            {/* DELETE / REMOVE SCENE BUTTON */}
                            <button
                              type="button"
                              onClick={(e) => handleRemoveVideoScene(scene.id, e)}
                              title="Remove/Delete this video scene"
                              className="p-1 rounded-lg hover:bg-red-500/30 text-purple-300 hover:text-red-300 transition-colors shrink-0"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* CUSTOM MP4 VIDEO UPLOAD & URL LINK */}
                  <div className="pt-2.5 border-t border-purple-500/20 space-y-2">
                    <label className="w-full flex items-center justify-center space-x-2 py-2 px-3 rounded-xl bg-purple-800/30 hover:bg-purple-800/60 text-purple-200 hover:text-white border border-dashed border-purple-400/40 text-xs font-semibold cursor-pointer transition-all">
                      <Upload className="w-3.5 h-3.5 text-amber-400" />
                      <span>Upload Custom MP4 File</span>
                      <input 
                        type="file" 
                        accept="video/mp4,video/webm,video/mov" 
                        onChange={handleVideoFileUpload} 
                        className="hidden" 
                      />
                    </label>

                    <button
                      type="button"
                      onClick={() => setShowAddUrlInput(!showAddUrlInput)}
                      className="w-full flex items-center justify-center space-x-1.5 py-1.5 px-3 rounded-xl bg-purple-950/40 hover:bg-purple-900/50 text-purple-300 hover:text-white text-[11px] font-semibold border border-purple-500/20 transition-all"
                    >
                      <Link className="w-3 h-3 text-cyan-400" />
                      <span>{showAddUrlInput ? 'Hide Video URL Input' : 'Add Direct Video URL Link'}</span>
                    </button>

                    {showAddUrlInput && (
                      <div className="p-2 rounded-xl bg-purple-950/80 border border-purple-500/30 space-y-2 text-xs animate-fadeIn">
                        <input
                          type="text"
                          placeholder="Video Name (e.g. Stage Light Loop)"
                          value={videoNameInput}
                          onChange={(e) => setVideoNameInput(e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded-lg bg-purple-900/40 border border-purple-500/40 text-white placeholder-purple-300/50 text-xs focus:outline-none focus:border-amber-400"
                        />
                        <input
                          type="url"
                          placeholder="https://.../video.mp4"
                          value={videoUrlInput}
                          onChange={(e) => setVideoUrlInput(e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded-lg bg-purple-900/40 border border-purple-500/40 text-white placeholder-purple-300/50 text-xs focus:outline-none focus:border-amber-400"
                        />
                        <button
                          type="button"
                          onClick={handleAddVideoUrl}
                          disabled={!videoUrlInput.trim()}
                          className="w-full py-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs disabled:opacity-50 transition-all flex items-center justify-center space-x-1"
                        >
                          <Save className="w-3 h-3" />
                          <span>Save Video Scene</span>
                        </button>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </div>
          )}
        </div>
        
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-[#C81E6E]/20 border border-[#C81E6E]/40 text-[#E8752C] mb-4"
        >
          <Music className="w-4 h-4 text-[#C81E6E] animate-bounce" />
          <span className="text-xs font-bold uppercase tracking-widest">
            WELCOME TO
          </span>
        </motion.div>

        {/* Concert Title */}
        <h1 className="font-poster text-4xl sm:text-6xl md:text-7xl tracking-wider text-white uppercase drop-shadow-2xl mb-3">
          GRACIA <span className="text-signature-animated">MUSICAL CONCERT</span>
        </h1>

        <p className="font-script text-2xl sm:text-4xl text-[#E8B400] mb-3">
          25 Years of Grace. One Voice in Worship.
        </p>

        <p className="font-sans text-sm sm:text-base text-white/80 max-w-xl mx-auto leading-relaxed mb-6">
          Join us for an inspiring evening of live Catholic contemporary music, dynamic theatre performances, and spirit-filled praise celebrating 25 years of grace in Singapore.
        </p>

        {/* Event Time Pill */}
        <div className="flex flex-wrap items-center justify-center gap-3 text-xs sm:text-sm font-semibold mb-6">
          <div className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-[#2c1140]/90 border border-[#E8752C]/40 text-white shadow-lg">
            <Calendar className="w-4 h-4 text-[#E8752C]" />
            <span>Sunday, 11 October 2026 • 6:30 PM – 9:30 PM</span>
          </div>

          <button
            type="button"
            onClick={() => setShowLocationModal(true)}
            className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-[#2c1140]/90 hover:bg-[#3d1958] border border-[#C81E6E]/40 hover:border-amber-400 text-white shadow-lg cursor-pointer transition-all hover:scale-105 group"
            title="Click to view location map & directions"
          >
            <MapPin className="w-4 h-4 text-[#C81E6E] group-hover:scale-110 transition-transform" />
            <span>Caritas Agape Village Main Auditorium, Singapore</span>
            <Navigation className="w-3.5 h-3.5 text-amber-400 opacity-80 group-hover:opacity-100 ml-1" />
          </button>
        </div>

        {/* Hero CTA Button */}
        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setShowReservationFlowModal(true)}
          id="register-for-musical-hero-btn"
          className="px-7 py-3 rounded-xl bg-signature-animated text-white font-poster text-lg tracking-wider shadow-xl glow-pulse inline-flex items-center space-x-2.5 cursor-pointer"
        >
          <Ticket className="w-5 h-5 text-white" />
          <span>RESERVE MY SEAT</span>
        </motion.button>

      </section>

      {/* CONCERT HIGHLIGHTS */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 mb-10">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          
          <div className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl space-y-2">
            <Mic2 className="w-6 h-6 text-[#C81E6E]" />
            <h3 className="font-poster text-lg text-white">LIVE STAGE PERFORMANCES</h3>
            <p className="text-xs text-white/70 leading-relaxed">
              Experience a spectacular evening of live music, inspiring performances, powerful choir anthems, and unforgettable moments celebrating 25 years of Jesus Youth Singapore.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl space-y-2">
            <Star className="w-6 h-6 text-[#E8B400]" />
            <h3 className="font-poster text-lg text-white">JUBILEE CELEBRATION</h3>
            <p className="text-xs text-white/70 leading-relaxed">
              Celebrate God's faithfulness through an evening of music, fellowship, special tributes, commemorative launches, and inspiring stories from our Jubilee journey.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl space-y-2">
            <Volume2 className="w-6 h-6 text-[#3B82F6]" />
            <h3 className="font-poster text-lg text-white">FREE ADMISSION (Reg Required)</h3>
            <p className="text-xs text-white/70 leading-relaxed">
              Everyone is welcome! Admission is free, get your free tickets with online registration. Bring your family and friends and be part of this once-in-a-generation Jubilee celebration.
            </p>
          </div>

        </div>
      </section>

      {/* MUSICAL REGISTRATION FORM */}
      {(showForm || isSubmitted) && (
        <section ref={formRef} className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 scroll-mt-24 pb-12">
          <div className="cream-card p-5 sm:p-8 border-2 border-[#C81E6E]/40 relative shadow-2xl">
            
            {(onClose || showForm) && (
              <button
                type="button"
                onClick={onClose || (() => setShowForm(false))}
                title="Close registration form"
                className="absolute top-4 right-4 p-2.5 rounded-full bg-[#241226]/5 hover:bg-[#241226]/15 text-[#241226]/70 hover:text-[#241226] transition-all cursor-pointer border border-[#241226]/10 shadow-xs z-10"
                aria-label="Close form"
              >
                <X className="w-5 h-5 stroke-[2.5]" />
              </button>
            )}

          <div className="text-center mb-6 border-b border-[#241226]/10 pb-4">
            <span className="text-[11px] font-bold uppercase tracking-widest px-3 py-1 rounded-full bg-[#2242A6]/10 text-[#2242A6] border border-[#2242A6]/20">
              FREE CONCERT ENTRY REGISTRATION
            </span>
            <h2 className="font-poster text-2xl sm:text-3xl text-[#241226] tracking-wide mt-2">
              RESERVE YOUR SEATS — GRACIA MUSICAL CONCERT
            </h2>
            <p className="font-script text-lg text-[#C81E6E] mt-0.5">
              Sunday, 11 October 2026 • 7:30 PM (Doors open 7:00 PM) • Caritas Agape Village
            </p>
          </div>

          {currentStep === 'seat_selector' ? (
            <SeatSelector
              requiredSeatsCount={
                (Number(formData.adultsCount) || 0) +
                (Number(formData.teensCount) || 0) +
                (Number(formData.preteensCount) || 0) +
                (Number(formData.childrenCount) || 0) +
                (Number(formData.kidsCount) || 0) +
                (Number(formData.toddlersCount) || 0)
              }
              registrantName={formData.name}
              registrantEmail={formData.email}
              existingBookedSeats={bookedSeats}
              initialSelectedSeats={selectedSeats}
              onConfirmSeats={handleSeatsConfirmed}
              onBack={() => setCurrentStep('form')}
            />
          ) : isSubmitted || currentStep === 'confirmed' ? (
            <div className="py-4 space-y-6">
              
              {/* Success Header Banner */}
              <div className="text-center space-y-2">
                <div className="w-16 h-16 mx-auto rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center border-2 border-emerald-500 shadow-lg">
                  <CheckCircle2 className="w-10 h-10" />
                </div>
                <h3 className="font-poster text-3xl text-[#241226]">
                  SEATS RESERVED & TICKET ISSUED!
                </h3>
                <p className="text-sm text-[#241226]/80 max-w-lg mx-auto font-medium">
                  {submitMessage || 'Praise the Lord! Your seats for GRACIA Musical Concert are confirmed and your entry ticket with QR Code has been generated.'}
                </p>

                <div className="p-3.5 rounded-2xl bg-emerald-100/90 border border-emerald-300 shadow-xs max-w-xl mx-auto space-y-1.5 text-left">
                  <div className="flex items-center space-x-2 text-xs font-bold text-emerald-950">
                    <Mail className="w-4 h-4 text-emerald-700 shrink-0" />
                    <span>
                      {emailNoticeData?.status === 'sent' ? 'Emails Sent Successfully!' : 'Confirmation Email Dispatched!'}
                    </span>
                  </div>
                  <p className="text-xs text-emerald-900 font-medium leading-relaxed">
                    {emailNoticeData?.sentEmails && emailNoticeData.sentEmails.length > 0 ? (
                      <>
                        Concert entry ticket(s) and individual QR code pass(es) have been sent to:{' '}
                        <strong className="underline text-emerald-950">{emailNoticeData.sentEmails.join(', ')}</strong>. Please check your email inbox or spam folder.
                      </>
                    ) : (
                      <>
                        Confirmation email with PDF ticket attached sent to <strong className="underline text-emerald-950">{formData.email}</strong>.
                      </>
                    )}
                  </p>
                </div>
              </div>

              <JubileePrayerCard />

              {/* INTERACTIVE CONCERT TICKET PASS */}
              <div id="printable-ticket" className="bg-gradient-to-br from-[#1A2F75] via-[#2242A6] to-[#2c1140] text-white p-6 sm:p-8 rounded-3xl border-2 border-[#C81E6E]/50 shadow-2xl space-y-6 relative overflow-hidden">
                
                {/* Decorative background accent circle */}
                <div className="absolute -top-12 -right-12 w-48 h-48 bg-[#C81E6E]/20 rounded-full blur-2xl pointer-events-none"></div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/20 pb-4">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-[#E8B400] bg-white/10 px-3 py-1 rounded-full border border-white/20">
                      JESUS YOUTH SINGAPORE • GRACIA
                    </span>
                    <h4 className="font-poster text-2xl text-white tracking-wide mt-1">
                      GRACIA MUSICAL CONCERT PASS
                    </h4>
                    <p className="text-xs text-white/80">
                      Sunday, 11 October 2026 • 7:30 PM (Doors open 7:00 PM) • Caritas Agape Village Auditorium
                    </p>
                  </div>

                  <div className="px-3 py-1.5 rounded-xl bg-amber-500/20 border border-amber-400/40 text-amber-300 text-xs font-bold shrink-0 text-center">
                    TICKET ID: <span className="font-mono text-sm block font-black">{issuedTicket?.ticketId || 'GRACIA-MUS-TICKET'}</span>
                  </div>
                </div>

                {/* Ticket Details & QR Code Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
                  
                  <div className="md:col-span-2 space-y-3 text-xs">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="bg-white/10 p-3 rounded-xl border border-white/15">
                        <span className="text-[10px] text-white/60 font-bold uppercase block">Attendee Name</span>
                        <span className="font-bold text-sm text-white">{formData.name}</span>
                      </div>

                      <div className="bg-white/10 p-3 rounded-xl border border-white/15">
                        <span className="text-[10px] text-white/60 font-bold uppercase block">Contact Phone</span>
                        <span className="font-bold text-sm text-white">{formData.phone}</span>
                      </div>
                    </div>

                    {/* Assigned Seats */}
                    <div className="bg-amber-500/20 p-3.5 rounded-2xl border border-amber-400/50 space-y-1.5">
                      <span className="text-xs font-black uppercase text-amber-300 tracking-wider flex items-center space-x-1.5">
                        <Ticket className="w-4 h-4 text-amber-400" />
                        <span>Assigned Concert Seats:</span>
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {(issuedTicket?.seats || selectedSeats).map((seat, idx) => (
                          <span key={`${seat}-${idx}`} className="px-3 py-1 rounded-lg bg-[#C81E6E] text-white font-poster text-sm shadow-md border border-white/30">
                            Row {seat.split('-')[0]} • Seat {seat.split('-')[1]}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* QR Code Container */}
                  <div className="bg-white p-4 rounded-2xl text-center shadow-xl space-y-2 border border-white/20">
                    {issuedTicket?.qrCodeDataUri ? (
                      <img 
                        src={issuedTicket.qrCodeDataUri} 
                        alt="Ticket QR Code" 
                        className="w-32 h-32 mx-auto object-contain"
                      />
                    ) : (
                      <div className="w-32 h-32 mx-auto bg-gray-100 rounded-xl flex items-center justify-center text-gray-400">
                        <QrCode className="w-16 h-16" />
                      </div>
                    )}
                    <span className="text-[10px] font-extrabold text-[#241226] uppercase tracking-wider block">
                      Scan at Entrance
                    </span>
                  </div>

                </div>

                {/* Ticket Actions */}
                <div className="pt-2 border-t border-white/20 flex flex-col sm:flex-row gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      if (!issuedTicket?.pdfBase64) return;
                      const link = document.createElement('a');
                      link.href = issuedTicket.pdfBase64;
                      link.download = `GRACIA_Musical_Concert_Ticket_${formData.name.replace(/\s+/g, '_')}.pdf`;
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                    }}
                    className="flex-1 py-3 px-5 rounded-xl bg-[#E8752C] hover:bg-[#d6651e] text-white font-bold text-xs uppercase tracking-wider shadow-lg transition-all cursor-pointer flex items-center justify-center space-x-2"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download PDF Ticket</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      window.print();
                    }}
                    className="py-3 px-5 rounded-xl bg-white/15 hover:bg-white/25 text-white font-bold text-xs uppercase tracking-wider border border-white/30 transition-all cursor-pointer flex items-center justify-center space-x-2"
                  >
                    <Printer className="w-4 h-4" />
                    <span>Print Ticket</span>
                  </button>
                </div>

              </div>

              {/* INDIVIDUAL PARTICIPANT PASSES & QR CODES */}
              {allPasses.length > 0 && (
                <div className="pt-2 max-w-2xl mx-auto space-y-4 text-left">
                  <div className="flex items-center justify-between border-b border-[#241226]/10 pb-2">
                    <h4 className="font-poster text-lg text-[#241226] flex items-center gap-2">
                      <QrCode className="w-5 h-5 text-[#E8752C]" />
                      <span>INDIVIDUAL ENTRY PASSES & QR CODES ({allPasses.length})</span>
                    </h4>
                    <span className="text-xs font-bold text-[#241226]/60">Scan at Entrance</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    {allPasses.map((pass, pIdx) => (
                      <DigitalConferenceBadge
                        key={`mus-pass-${pIdx}`}
                        pass={pass}
                        pIdx={pIdx}
                        googlePhotoUrl={pass.isPrimary ? (auth.currentUser?.photoURL || undefined) : undefined}
                        onDownloadPdf={downloadIndividualPassPDF}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Love Offer PayNow Section - Only shown for attendees also registered for the Jubilee Conference */}
              {existingConferenceReg && (
                <LoveOfferPayNowCard className="mt-4" />
              )}

              <div className="text-center pt-2">
                <button
                  onClick={() => {
                    setIsSubmitted(false);
                    setCurrentStep('form');
                    setSelectedSeats([]);
                    setIssuedTicket(null);
                    setExistingConferenceReg(null);
                    setFormData({ name: '', email: '', phone: '', adultsCount: 1, teensCount: 0, preteensCount: 0, childrenCount: 0, kidsCount: 0, toddlersCount: 0, comments: '', pdpaConsent: false, honeypot: '' });
                  }}
                  className="px-6 py-2.5 rounded-xl bg-[#241226]/10 hover:bg-[#241226]/20 text-[#241226] font-semibold text-sm transition-colors cursor-pointer"
                >
                  Register Additional Seats
                </button>
              </div>

            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              
              <input
                type="text"
                name="honeypot"
                value={formData.honeypot || ''}
                onChange={handleInputChange}
                className="hidden"
                tabIndex={-1}
              />

              {errors.form && (
                <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-center space-x-2">
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  <span>{errors.form}</span>
                </div>
              )}

              {/* Existing Registration Info Banner */}
              {(existingMusicalReg || existingConferenceReg) && (
                <div className="space-y-3">
                  {/* Case 1: Both Musical & Conference Registrations Found */}
                  {existingMusicalReg && existingConferenceReg && (
                    <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-purple-500/15 via-amber-500/10 to-purple-500/20 border-2 border-purple-400/50 text-[#241226] space-y-3 shadow-md relative overflow-hidden">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-purple-300/60 pb-2">
                        <div className="flex items-center space-x-2 text-purple-950 font-black text-xs uppercase tracking-wider">
                          <Sparkles className="w-4 h-4 text-[#E8B400] shrink-0" />
                          <span>REGISTERED FOR BOTH CONFERENCE & MUSICAL CONCERT</span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          <span className="text-[10px] font-bold bg-amber-200/90 text-amber-950 px-2 py-0.5 rounded-full border border-amber-300">
                            Conference: {new Date(existingConferenceReg.createdAt).toLocaleDateString()}
                          </span>
                          <span className="text-[10px] font-bold bg-purple-200/90 text-purple-950 px-2 py-0.5 rounded-full border border-purple-300">
                            Musical: {new Date(existingMusicalReg.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>

                      <p className="text-xs text-[#241226]/90 leading-relaxed font-medium">
                        Welcome back! We found your existing registration for the <strong>GRACIA Jubilee Conference</strong> and your <strong>Musical Concert reservation</strong> under <strong>{existingMusicalReg.name}</strong> ({existingMusicalReg.email}).
                      </p>

                      <div className="space-y-1">
                        <span className="text-[11px] font-bold text-purple-950/80 uppercase tracking-wider block">Previous Musical Seats Reserved:</span>
                        <div className="flex flex-wrap gap-1.5 text-xs">
                          <span className="px-2.5 py-1 rounded-lg bg-white/90 border border-purple-300 text-[#241226] font-bold shadow-xs">
                            {existingMusicalReg.adultsCount ?? 0} Adults/Youths
                          </span>
                          <span className="px-2.5 py-1 rounded-lg bg-white/90 border border-purple-300 text-[#241226] font-bold shadow-xs">
                            {existingMusicalReg.preteensCount ?? 0} Pre-teens
                          </span>
                          <span className="px-2.5 py-1 rounded-lg bg-white/90 border border-purple-300 text-[#241226] font-bold shadow-xs">
                            {existingMusicalReg.childrenCount ?? 0} Children (5-9)
                          </span>
                          <span className="px-2.5 py-1 rounded-lg bg-white/90 border border-purple-300 text-[#241226] font-bold shadow-xs">
                            {existingMusicalReg.toddlersCount ?? 0} Below 5
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2.5 pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            setFormData({
                              name: existingMusicalReg.name || formData.name,
                              email: existingMusicalReg.email || formData.email,
                              phone: existingMusicalReg.phone || formData.phone,
                              adultsCount: existingMusicalReg.adultsCount ?? 0,
                              teensCount: existingMusicalReg.teensCount ?? 0,
                              preteensCount: existingMusicalReg.preteensCount ?? 0,
                              childrenCount: existingMusicalReg.childrenCount ?? 0,
                              kidsCount: existingMusicalReg.kidsCount ?? 0,
                              toddlersCount: existingMusicalReg.toddlersCount ?? 0,
                              comments: existingMusicalReg.comments || '',
                              pdpaConsent: formData.pdpaConsent,
                              honeypot: ''
                            });
                            if (existingMusicalReg.selectedSeats && existingMusicalReg.selectedSeats.length > 0) {
                              setSelectedSeats(existingMusicalReg.selectedSeats);
                            }
                            setExistingDocId(existingMusicalReg.id || null);
                          }}
                          className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#C81E6E] to-[#a01657] hover:brightness-110 text-white font-bold text-xs shadow-md transition-all active:scale-95 cursor-pointer flex items-center space-x-1.5"
                        >
                          <Check className="w-4 h-4 stroke-[2.5]" />
                          <span>Load Details into Form to Update Musical Reservation</span>
                        </button>

                        {existingDocId && (
                          <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/15 border-2 border-emerald-500/40 text-emerald-900 font-extrabold text-xs shadow-sm">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                            <span>Update Registration Mode Active</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Case 2: Only Musical Concert Reservation Found */}
                  {existingMusicalReg && !existingConferenceReg && (
                    <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-purple-500/15 via-pink-500/10 to-purple-500/20 border-2 border-purple-400/50 text-[#241226] space-y-3 shadow-md relative overflow-hidden">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-purple-300/60 pb-2">
                        <div className="flex items-center space-x-2 text-purple-950 font-black text-xs uppercase tracking-wider">
                          <Info className="w-4 h-4 text-[#C81E6E] shrink-0" />
                          <span>PREVIOUS MUSICAL CONCERT RESERVATION FOUND</span>
                        </div>
                        <span className="text-[11px] font-bold bg-purple-200/90 text-purple-950 px-2.5 py-0.5 rounded-full border border-purple-300">
                          {new Date(existingMusicalReg.createdAt).toLocaleDateString()}
                        </span>
                      </div>

                      <p className="text-xs text-[#241226]/90 leading-relaxed font-medium">
                        We found an existing musical concert reservation under <strong>{existingMusicalReg.name}</strong> ({existingMusicalReg.email}).
                      </p>

                      <div className="space-y-1">
                        <span className="text-[11px] font-bold text-purple-950/80 uppercase tracking-wider block">Previous Seats Reserved:</span>
                        <div className="flex flex-wrap gap-1.5 text-xs">
                          <span className="px-2.5 py-1 rounded-lg bg-white/90 border border-purple-300 text-[#241226] font-bold shadow-xs">
                            {existingMusicalReg.adultsCount ?? 0} Adults/Youths
                          </span>
                          <span className="px-2.5 py-1 rounded-lg bg-white/90 border border-purple-300 text-[#241226] font-bold shadow-xs">
                            {existingMusicalReg.preteensCount ?? 0} Pre-teens
                          </span>
                          <span className="px-2.5 py-1 rounded-lg bg-white/90 border border-purple-300 text-[#241226] font-bold shadow-xs">
                            {existingMusicalReg.childrenCount ?? 0} Children (5-9)
                          </span>
                          <span className="px-2.5 py-1 rounded-lg bg-white/90 border border-purple-300 text-[#241226] font-bold shadow-xs">
                            {existingMusicalReg.toddlersCount ?? 0} Below 5
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2.5 pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            setFormData({
                              name: existingMusicalReg.name || formData.name,
                              email: existingMusicalReg.email || formData.email,
                              phone: existingMusicalReg.phone || formData.phone,
                              adultsCount: existingMusicalReg.adultsCount ?? 0,
                              teensCount: existingMusicalReg.teensCount ?? 0,
                              preteensCount: existingMusicalReg.preteensCount ?? 0,
                              childrenCount: existingMusicalReg.childrenCount ?? 0,
                              kidsCount: existingMusicalReg.kidsCount ?? 0,
                              toddlersCount: existingMusicalReg.toddlersCount ?? 0,
                              comments: existingMusicalReg.comments || '',
                              pdpaConsent: formData.pdpaConsent,
                              honeypot: ''
                            });
                            if (existingMusicalReg.selectedSeats && existingMusicalReg.selectedSeats.length > 0) {
                              setSelectedSeats(existingMusicalReg.selectedSeats);
                            }
                            setExistingDocId(existingMusicalReg.id || null);
                          }}
                          className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#C81E6E] to-[#a01657] hover:brightness-110 text-white font-bold text-xs shadow-md transition-all active:scale-95 cursor-pointer flex items-center space-x-1.5"
                        >
                          <Check className="w-4 h-4 stroke-[2.5]" />
                          <span>Load Details into Form to Update</span>
                        </button>

                        {existingDocId && (
                          <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/15 border-2 border-emerald-500/40 text-emerald-900 font-extrabold text-xs shadow-sm">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                            <span>Update Registration Mode Active</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Case 3: Only Conference Registration Found (No Musical Reservation yet) */}
                  {!existingMusicalReg && existingConferenceReg && (
                    <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-amber-500/15 via-emerald-500/10 to-amber-500/20 border-2 border-amber-400/50 text-[#241226] space-y-3 shadow-md relative overflow-hidden">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-300/60 pb-2">
                        <div className="flex items-center space-x-2 text-amber-950 font-black text-xs uppercase tracking-wider">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>JUBILEE CONFERENCE DELEGATE DETECTED</span>
                        </div>
                        <span className="text-[11px] font-bold bg-amber-200/90 text-amber-950 px-2.5 py-0.5 rounded-full border border-amber-300">
                          Registered: {new Date(existingConferenceReg.createdAt).toLocaleDateString()}
                        </span>
                      </div>

                      <p className="text-xs text-[#241226]/90 leading-relaxed font-medium">
                        Welcome back! We found your registration for the <strong>GRACIA Jubilee Conference</strong> under <strong>{existingConferenceReg.name}</strong> ({existingConferenceReg.email}). All registered conference delegates are automatically eligible & included for the Musical Concert! If you wish to update your participant counts or reserve additional seats, please update the form below.
                      </p>

                      <div className="flex flex-wrap items-center gap-2.5 pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            setFormData(prev => ({
                              ...prev,
                              name: existingConferenceReg.name || prev.name,
                              email: existingConferenceReg.email || prev.email,
                              phone: existingConferenceReg.phone || prev.phone,
                              adultsCount: existingConferenceReg.adultsCount ?? prev.adultsCount,
                              preteensCount: existingConferenceReg.preteensCount ?? prev.preteensCount,
                              childrenCount: existingConferenceReg.childrenCount ?? prev.childrenCount,
                              toddlersCount: existingConferenceReg.toddlersCount ?? prev.toddlersCount,
                            }));
                          }}
                          className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#2242A6] to-[#1a3384] hover:brightness-110 text-white font-bold text-xs shadow-md transition-all active:scale-95 cursor-pointer flex items-center space-x-1.5"
                        >
                          <Check className="w-4 h-4 stroke-[2.5]" />
                          <span>Fill Form to Update Participants Count</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Name */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#241226] mb-1">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name || ''}
                  onChange={handleInputChange}
                  onBlur={handleInputBlur}
                  placeholder="e.g. Maria Joseph"
                  className={`w-full px-4 py-3 rounded-xl bg-white border ${
                    errors.name ? 'border-red-500 bg-red-50' : 'border-[#241226]/20'
                  } text-[#241226] text-sm focus:outline-none focus:ring-2 focus:ring-[#C81E6E]`}
                />
                {errors.name && <p className="text-xs text-red-600 mt-1 font-medium">{errors.name}</p>}
              </div>

              {/* Email & Phone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#241226] mb-1">
                    Email Address <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email || ''}
                    onChange={handleInputChange}
                    onBlur={handleInputBlur}
                    placeholder="e.g. maria@example.com"
                    className={`w-full px-4 py-3 rounded-xl bg-white border ${
                      errors.email ? 'border-red-500 bg-red-50' : 'border-[#241226]/20'
                    } text-[#241226] text-sm focus:outline-none focus:ring-2 focus:ring-[#C81E6E]`}
                  />
                  {errors.email && <p className="text-xs text-red-600 mt-1 font-medium">{errors.email}</p>}
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#241226] mb-1">
                    Phone Number (Singapore) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone || ''}
                    onChange={handleInputChange}
                    onBlur={handleInputBlur}
                    placeholder="e.g. +65 9876 5432"
                    className={`w-full px-4 py-3 rounded-xl bg-white border ${
                      errors.phone ? 'border-red-500 bg-red-50' : 'border-[#241226]/20'
                    } text-[#241226] text-sm focus:outline-none focus:ring-2 focus:ring-[#C81E6E]`}
                  />
                  {errors.phone && <p className="text-xs text-red-600 mt-1 font-medium">{errors.phone}</p>}
                </div>
              </div>

              {/* Number of Seats Breakdown */}
              <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-purple-500/10 via-pink-500/5 to-purple-500/15 border-2 border-purple-400/40 space-y-4 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-purple-300/40 pb-2">
                  <h4 className="text-xs font-black uppercase tracking-wider text-[#241226] flex items-center space-x-1.5">
                    <span>NUMBER OF CONCERT SEATS NEEDED</span>
                  </h4>

                  <div className="flex items-center space-x-2">
                    <span className="text-[10px] font-bold text-[#C81E6E] bg-pink-50 px-2 py-0.5 rounded-full border border-pink-200">
                      Required for Seating Allocation
                    </span>
                    {(formData.adultsCount + formData.teensCount + formData.preteensCount + formData.childrenCount + formData.kidsCount + formData.toddlersCount > 0) && (
                      <span className="text-[11px] font-black text-[#C81E6E] bg-pink-100 border border-pink-300 px-2.5 py-0.5 rounded-full uppercase tracking-wider shadow-xs">
                        Total: {formData.adultsCount + formData.teensCount + formData.preteensCount + formData.childrenCount + formData.kidsCount + formData.toddlersCount} Seats
                      </span>
                    )}
                  </div>
                </div>

                {errors.adultsCount && (
                  <p className="text-xs text-red-600 font-medium">{errors.adultsCount}</p>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
                  {/* Adults/Youths */}
                  <div className={`p-3 rounded-2xl border-2 transition-all duration-200 flex flex-col justify-between space-y-2.5 ${
                    formData.adultsCount > 0 
                      ? 'bg-pink-50/70 border-[#C81E6E] ring-2 ring-[#C81E6E]/20 shadow-md' 
                      : 'bg-white border-[#241226]/15 hover:border-[#241226]/30 shadow-xs'
                  }`}>
                    <div>
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-xs font-black text-[#241226] uppercase tracking-wide">
                          Adults / Youths
                        </span>
                        {formData.adultsCount > 0 && (
                          <span className="text-[10px] font-extrabold text-[#C81E6E] bg-pink-100 border border-pink-200 px-1.5 py-0.5 rounded-full">
                            {formData.adultsCount}
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] font-semibold text-[#241226]/60 block">
                        (20+ yrs)
                      </span>
                    </div>

                    <div className="flex items-center justify-between bg-white p-1 rounded-xl border border-gray-300/70 shadow-inner">
                      <button
                        type="button"
                        onClick={() => updateCount('adultsCount', -1)}
                        disabled={formData.adultsCount <= 0}
                        className={`w-8 h-8 rounded-lg font-bold flex items-center justify-center transition-all ${
                          formData.adultsCount > 0
                            ? 'bg-red-500 hover:bg-red-600 text-white shadow-sm active:scale-95 cursor-pointer'
                            : 'bg-gray-100 text-gray-400 cursor-not-allowed opacity-50'
                        }`}
                        title="Decrease count"
                        aria-label="Decrease Adults count"
                      >
                        <Minus className="w-3.5 h-3.5 stroke-[2.5]" />
                      </button>

                      <input
                        type="number"
                        min="0"
                        name="adultsCount"
                        value={formData.adultsCount ?? 0}
                        onChange={handleInputChange}
                        className="w-10 h-8 bg-gray-50/50 border border-gray-200 rounded-lg text-[#241226] text-base font-black text-center focus:outline-none focus:ring-2 focus:ring-[#C81E6E] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none px-0 shadow-xs"
                      />

                      <button
                        type="button"
                        onClick={() => updateCount('adultsCount', 1)}
                        className="w-8 h-8 rounded-lg bg-[#C81E6E] hover:bg-[#a01657] text-white font-bold flex items-center justify-center transition-all active:scale-95 cursor-pointer shadow-sm"
                        title="Increase count"
                        aria-label="Increase Adults count"
                      >
                        <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                      </button>
                    </div>
                  </div>

                  {/* Teens */}
                  <div className={`p-3 rounded-2xl border-2 transition-all duration-200 flex flex-col justify-between space-y-2.5 ${
                    formData.teensCount > 0 
                      ? 'bg-pink-50/70 border-[#C81E6E] ring-2 ring-[#C81E6E]/20 shadow-md' 
                      : 'bg-white border-[#241226]/15 hover:border-[#241226]/30 shadow-xs'
                  }`}>
                    <div>
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-xs font-black text-[#241226] uppercase tracking-wide">
                          Teens
                        </span>
                        {formData.teensCount > 0 && (
                          <span className="text-[10px] font-extrabold text-[#C81E6E] bg-pink-100 border border-pink-200 px-1.5 py-0.5 rounded-full">
                            {formData.teensCount}
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] font-semibold text-[#241226]/60 block">
                        (13–19 yrs)
                      </span>
                    </div>

                    <div className="flex items-center justify-between bg-white p-1 rounded-xl border border-gray-300/70 shadow-inner">
                      <button
                        type="button"
                        onClick={() => updateCount('teensCount', -1)}
                        disabled={formData.teensCount <= 0}
                        className={`w-8 h-8 rounded-lg font-bold flex items-center justify-center transition-all ${
                          formData.teensCount > 0
                            ? 'bg-red-500 hover:bg-red-600 text-white shadow-sm active:scale-95 cursor-pointer'
                            : 'bg-gray-100 text-gray-400 cursor-not-allowed opacity-50'
                        }`}
                        title="Decrease count"
                        aria-label="Decrease Teens count"
                      >
                        <Minus className="w-3.5 h-3.5 stroke-[2.5]" />
                      </button>

                      <input
                        type="number"
                        min="0"
                        name="teensCount"
                        value={formData.teensCount ?? 0}
                        onChange={handleInputChange}
                        className="w-10 h-8 bg-gray-50/50 border border-gray-200 rounded-lg text-[#241226] text-base font-black text-center focus:outline-none focus:ring-2 focus:ring-[#C81E6E] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none px-0 shadow-xs"
                      />

                      <button
                        type="button"
                        onClick={() => updateCount('teensCount', 1)}
                        className="w-8 h-8 rounded-lg bg-[#C81E6E] hover:bg-[#a01657] text-white font-bold flex items-center justify-center transition-all active:scale-95 cursor-pointer shadow-sm"
                        title="Increase count"
                        aria-label="Increase Teens count"
                      >
                        <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                      </button>
                    </div>
                  </div>

                  {/* Pre-teens */}
                  <div className={`p-3 rounded-2xl border-2 transition-all duration-200 flex flex-col justify-between space-y-2.5 ${
                    formData.preteensCount > 0 
                      ? 'bg-pink-50/70 border-[#C81E6E] ring-2 ring-[#C81E6E]/20 shadow-md' 
                      : 'bg-white border-[#241226]/15 hover:border-[#241226]/30 shadow-xs'
                  }`}>
                    <div>
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-xs font-black text-[#241226] uppercase tracking-wide">
                          Pre-Teens
                        </span>
                        {formData.preteensCount > 0 && (
                          <span className="text-[10px] font-extrabold text-[#C81E6E] bg-pink-100 border border-pink-200 px-1.5 py-0.5 rounded-full">
                            {formData.preteensCount}
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] font-semibold text-[#241226]/60 block">
                        (9–12 yrs)
                      </span>
                    </div>

                    <div className="flex items-center justify-between bg-white p-1 rounded-xl border border-gray-300/70 shadow-inner">
                      <button
                        type="button"
                        onClick={() => updateCount('preteensCount', -1)}
                        disabled={formData.preteensCount <= 0}
                        className={`w-8 h-8 rounded-lg font-bold flex items-center justify-center transition-all ${
                          formData.preteensCount > 0
                            ? 'bg-red-500 hover:bg-red-600 text-white shadow-sm active:scale-95 cursor-pointer'
                            : 'bg-gray-100 text-gray-400 cursor-not-allowed opacity-50'
                        }`}
                        title="Decrease count"
                        aria-label="Decrease Pre-teens count"
                      >
                        <Minus className="w-3.5 h-3.5 stroke-[2.5]" />
                      </button>

                      <input
                        type="number"
                        min="0"
                        name="preteensCount"
                        value={formData.preteensCount ?? 0}
                        onChange={handleInputChange}
                        className="w-10 h-8 bg-gray-50/50 border border-gray-200 rounded-lg text-[#241226] text-base font-black text-center focus:outline-none focus:ring-2 focus:ring-[#C81E6E] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none px-0 shadow-xs"
                      />

                      <button
                        type="button"
                        onClick={() => updateCount('preteensCount', 1)}
                        className="w-8 h-8 rounded-lg bg-[#C81E6E] hover:bg-[#a01657] text-white font-bold flex items-center justify-center transition-all active:scale-95 cursor-pointer shadow-sm"
                        title="Increase count"
                        aria-label="Increase Pre-teens count"
                      >
                        <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                      </button>
                    </div>
                  </div>

                  {/* Children */}
                  <div className={`p-3 rounded-2xl border-2 transition-all duration-200 flex flex-col justify-between space-y-2.5 ${
                    formData.childrenCount > 0 
                      ? 'bg-pink-50/70 border-[#C81E6E] ring-2 ring-[#C81E6E]/20 shadow-md' 
                      : 'bg-white border-[#241226]/15 hover:border-[#241226]/30 shadow-xs'
                  }`}>
                    <div>
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-xs font-black text-[#241226] uppercase tracking-wide">
                          Children
                        </span>
                        {formData.childrenCount > 0 && (
                          <span className="text-[10px] font-extrabold text-[#C81E6E] bg-pink-100 border border-pink-200 px-1.5 py-0.5 rounded-full">
                            {formData.childrenCount}
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] font-semibold text-[#241226]/60 block">
                        (6–8 yrs)
                      </span>
                    </div>

                    <div className="flex items-center justify-between bg-white p-1 rounded-xl border border-gray-300/70 shadow-inner">
                      <button
                        type="button"
                        onClick={() => updateCount('childrenCount', -1)}
                        disabled={formData.childrenCount <= 0}
                        className={`w-8 h-8 rounded-lg font-bold flex items-center justify-center transition-all ${
                          formData.childrenCount > 0
                            ? 'bg-red-500 hover:bg-red-600 text-white shadow-sm active:scale-95 cursor-pointer'
                            : 'bg-gray-100 text-gray-400 cursor-not-allowed opacity-50'
                        }`}
                        title="Decrease count"
                        aria-label="Decrease Children count"
                      >
                        <Minus className="w-3.5 h-3.5 stroke-[2.5]" />
                      </button>

                      <input
                        type="number"
                        min="0"
                        name="childrenCount"
                        value={formData.childrenCount ?? 0}
                        onChange={handleInputChange}
                        className="w-10 h-8 bg-gray-50/50 border border-gray-200 rounded-lg text-[#241226] text-base font-black text-center focus:outline-none focus:ring-2 focus:ring-[#C81E6E] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none px-0 shadow-xs"
                      />

                      <button
                        type="button"
                        onClick={() => updateCount('childrenCount', 1)}
                        className="w-8 h-8 rounded-lg bg-[#C81E6E] hover:bg-[#a01657] text-white font-bold flex items-center justify-center transition-all active:scale-95 cursor-pointer shadow-sm"
                        title="Increase count"
                        aria-label="Increase Children count"
                      >
                        <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                      </button>
                    </div>
                  </div>

                  {/* Kids */}
                  <div className={`p-3 rounded-2xl border-2 transition-all duration-200 flex flex-col justify-between space-y-2.5 ${
                    formData.kidsCount > 0 
                      ? 'bg-pink-50/70 border-[#C81E6E] ring-2 ring-[#C81E6E]/20 shadow-md' 
                      : 'bg-white border-[#241226]/15 hover:border-[#241226]/30 shadow-xs'
                  }`}>
                    <div>
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-xs font-black text-[#241226] uppercase tracking-wide">
                          Kids
                        </span>
                        {formData.kidsCount > 0 && (
                          <span className="text-[10px] font-extrabold text-[#C81E6E] bg-pink-100 border border-pink-200 px-1.5 py-0.5 rounded-full">
                            {formData.kidsCount}
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] font-semibold text-[#241226]/60 block">
                        (3–5 yrs)
                      </span>
                    </div>

                    <div className="flex items-center justify-between bg-white p-1 rounded-xl border border-gray-300/70 shadow-inner">
                      <button
                        type="button"
                        onClick={() => updateCount('kidsCount', -1)}
                        disabled={formData.kidsCount <= 0}
                        className={`w-8 h-8 rounded-lg font-bold flex items-center justify-center transition-all ${
                          formData.kidsCount > 0
                            ? 'bg-red-500 hover:bg-red-600 text-white shadow-sm active:scale-95 cursor-pointer'
                            : 'bg-gray-100 text-gray-400 cursor-not-allowed opacity-50'
                        }`}
                        title="Decrease count"
                        aria-label="Decrease Kids count"
                      >
                        <Minus className="w-3.5 h-3.5 stroke-[2.5]" />
                      </button>

                      <input
                        type="number"
                        min="0"
                        name="kidsCount"
                        value={formData.kidsCount ?? 0}
                        onChange={handleInputChange}
                        className="w-10 h-8 bg-gray-50/50 border border-gray-200 rounded-lg text-[#241226] text-base font-black text-center focus:outline-none focus:ring-2 focus:ring-[#C81E6E] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none px-0 shadow-xs"
                      />

                      <button
                        type="button"
                        onClick={() => updateCount('kidsCount', 1)}
                        className="w-8 h-8 rounded-lg bg-[#C81E6E] hover:bg-[#a01657] text-white font-bold flex items-center justify-center transition-all active:scale-95 cursor-pointer shadow-sm"
                        title="Increase count"
                        aria-label="Increase Kids count"
                      >
                        <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                      </button>
                    </div>
                  </div>

                  {/* Toddlers */}
                  <div className={`p-3 rounded-2xl border-2 transition-all duration-200 flex flex-col justify-between space-y-2.5 ${
                    formData.toddlersCount > 0 
                      ? 'bg-pink-50/70 border-[#C81E6E] ring-2 ring-[#C81E6E]/20 shadow-md' 
                      : 'bg-white border-[#241226]/15 hover:border-[#241226]/30 shadow-xs'
                  }`}>
                    <div>
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-xs font-black text-[#241226] uppercase tracking-wide">
                          Toddlers
                        </span>
                        {formData.toddlersCount > 0 && (
                          <span className="text-[10px] font-extrabold text-[#C81E6E] bg-pink-100 border border-pink-200 px-1.5 py-0.5 rounded-full">
                            {formData.toddlersCount}
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] font-semibold text-[#241226]/60 block">
                        (2 & Below)
                      </span>
                    </div>

                    <div className="flex items-center justify-between bg-white p-1 rounded-xl border border-gray-300/70 shadow-inner">
                      <button
                        type="button"
                        onClick={() => updateCount('toddlersCount', -1)}
                        disabled={formData.toddlersCount <= 0}
                        className={`w-8 h-8 rounded-lg font-bold flex items-center justify-center transition-all ${
                          formData.toddlersCount > 0
                            ? 'bg-red-500 hover:bg-red-600 text-white shadow-sm active:scale-95 cursor-pointer'
                            : 'bg-gray-100 text-gray-400 cursor-not-allowed opacity-50'
                        }`}
                        title="Decrease count"
                        aria-label="Decrease Toddlers count"
                      >
                        <Minus className="w-3.5 h-3.5 stroke-[2.5]" />
                      </button>

                      <input
                        type="number"
                        min="0"
                        name="toddlersCount"
                        value={formData.toddlersCount ?? 0}
                        onChange={handleInputChange}
                        className="w-10 h-8 bg-gray-50/50 border border-gray-200 rounded-lg text-[#241226] text-base font-black text-center focus:outline-none focus:ring-2 focus:ring-[#C81E6E] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none px-0 shadow-xs"
                      />

                      <button
                        type="button"
                        onClick={() => updateCount('toddlersCount', 1)}
                        className="w-8 h-8 rounded-lg bg-[#C81E6E] hover:bg-[#a01657] text-white font-bold flex items-center justify-center transition-all active:scale-95 cursor-pointer shadow-sm"
                        title="Increase count"
                        aria-label="Increase Toddlers count"
                      >
                        <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Additional Attendees Personal Details */}
              <AdditionalAttendeesForm
                adultsCount={Number(formData.adultsCount)}
                teensCount={Number(formData.teensCount)}
                preteensCount={Number(formData.preteensCount)}
                childrenCount={Number(formData.childrenCount)}
                attendees={additionalAttendees}
                onChange={setAdditionalAttendees}
                errors={errors}
              />

              {/* Comments */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#241226] mb-1">
                  Questions / Comments
                </label>
                <textarea
                  rows={3}
                  name="comments"
                  value={formData.comments || ''}
                  onChange={handleInputChange}
                  placeholder="Optional questions or accessibility needs..."
                  className="w-full px-4 py-3 rounded-xl bg-white border border-[#241226]/20 text-[#241226] text-sm focus:outline-none focus:ring-2 focus:ring-[#C81E6E]"
                ></textarea>
              </div>

              {/* Personal Data Protection & Consent Form */}
              <div className="p-4 sm:p-5 rounded-2xl bg-[#C81E6E]/5 border border-[#C81E6E]/20 text-[#241226] space-y-2.5">
                <h4 className="font-bold text-xs uppercase tracking-wider text-[#C81E6E] flex items-center space-x-1.5">
                  <ShieldCheck className="w-4 h-4 text-[#E8752C]" />
                  <span>Personal Data Protection & Consent Form</span>
                </h4>
                <p className="text-xs text-[#241226]/80 leading-relaxed">
                  By submitting this form, I acknowledge that I have read and agree to the privacy policy outlined in the Personal Data Protection Act at{' '}
                  <a
                    href="https://singapore.jesusyouth.org/jy-data-protection-act/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline text-[#2242A6] hover:text-[#C81E6E] font-medium break-all"
                  >
                    https://singapore.jesusyouth.org/jy-data-protection-act/
                  </a>.
                </p>
                <label className="flex items-start space-x-2.5 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    name="pdpaConsent"
                    checked={formData.pdpaConsent}
                    onChange={handleInputChange}
                    className="mt-0.5 w-4 h-4 rounded border-gray-300 text-[#C81E6E] focus:ring-[#C81E6E] cursor-pointer shrink-0"
                  />
                  <span className="text-xs font-bold text-[#241226]">
                    I agree to the terms and conditions above <span className="text-red-500">*</span>
                  </span>
                </label>
                {errors.pdpaConsent && (
                  <p className="text-xs text-red-600 font-medium">{errors.pdpaConsent}</p>
                )}
              </div>

              {/* Prayer Card right above submit button */}
              <JubileePrayerCard />

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting}
                id="submit-musical-registration-btn"
                className="w-full py-4 rounded-xl bg-signature-gradient text-white font-poster text-xl tracking-wider shadow-xl hover:opacity-95 transition-opacity flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? (
                  <span>Checking Seat Availability...</span>
                ) : (
                  <>
                    <Ticket className="w-6 h-6" />
                    <span>Confirm and select your seats</span>
                    <ArrowRight className="w-5 h-5 ml-1" />
                  </>
                )}
              </button>

            </form>
          )}

        </div>
      </section>
      )}

      {/* Duplicate Registration Modal Confirmation */}
      {showDuplicateModal && pendingDuplicateCheck && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-gray-100 space-y-5 text-[#241226]">
            <div className="flex items-center space-x-3 text-purple-600">
              <div className="p-3 bg-purple-100 rounded-2xl shrink-0">
                <AlertCircle className="w-7 h-7 text-purple-600" />
              </div>
              <div>
                <h3 className="font-poster text-2xl tracking-wide text-[#241226]">Existing Reservation Found</h3>
                <p className="text-xs text-gray-500 font-medium">A musical concert reservation matches your details.</p>
              </div>
            </div>

            <p className="text-sm text-gray-700 leading-relaxed">
              A reservation under <strong>{pendingDuplicateCheck.name}</strong> (<span className="font-semibold text-[#C81E6E]">{pendingDuplicateCheck.email}</span>) was submitted on <strong>{new Date(pendingDuplicateCheck.createdAt).toLocaleDateString()}</strong>.
            </p>

            {existingConferenceReg && (
              <div className="flex items-center space-x-2 px-3 py-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-950 text-xs font-semibold">
                <Sparkles className="w-4 h-4 text-[#E8752C] shrink-0" />
                <span>Also registered for GRACIA Jubilee Conference ({new Date(existingConferenceReg.createdAt).toLocaleDateString()})</span>
              </div>
            )}

            {/* Previous Registration Summary Box */}
            <div className="bg-purple-50/80 border border-purple-200/80 rounded-2xl p-4 text-xs space-y-2">
              <h4 className="font-bold uppercase tracking-wider text-purple-900 text-[11px]">Previous Reservation Summary:</h4>
              <div className="grid grid-cols-2 gap-2 text-gray-800 font-medium">
                <div>• Adults/Youths: <strong className="text-[#C81E6E] font-bold">{pendingDuplicateCheck.adultsCount}</strong></div>
                <div>• Teens (13–19): <strong className="text-[#C81E6E] font-bold">{pendingDuplicateCheck.teensCount ?? 0}</strong></div>
                <div>• Pre-teens (9–12): <strong className="text-[#C81E6E] font-bold">{pendingDuplicateCheck.preteensCount}</strong></div>
                <div>• Children (6–8): <strong className="text-[#C81E6E] font-bold">{pendingDuplicateCheck.childrenCount}</strong></div>
                <div>• Kids (3–5): <strong className="text-[#C81E6E] font-bold">{pendingDuplicateCheck.kidsCount ?? 0}</strong></div>
                <div>• Toddlers (2 & Below): <strong className="text-[#C81E6E] font-bold">{pendingDuplicateCheck.toddlersCount}</strong></div>
              </div>
              {pendingDuplicateCheck.comments && (
                <div className="pt-1 text-gray-600 italic">
                  Comments: "{pendingDuplicateCheck.comments}"
                </div>
              )}
            </div>

            <p className="text-xs font-semibold text-gray-600">
              Would you like to update your previous reservation record with the new details, or submit as a brand new separate registration?
            </p>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => {
                  setShowDuplicateModal(false);
                  setExistingDocId(pendingDuplicateCheck.id || null);
                  if (pendingDuplicateCheck.selectedSeats && pendingDuplicateCheck.selectedSeats.length > 0) {
                    setSelectedSeats(pendingDuplicateCheck.selectedSeats);
                  }
                  proceedToSeatSelector(pendingDuplicateCheck.id);
                }}
                className="flex-1 py-3 px-4 rounded-xl bg-[#C81E6E] hover:bg-[#a01657] text-white font-bold text-xs uppercase tracking-wider shadow-md transition-all cursor-pointer flex items-center justify-center space-x-1.5"
              >
                <Check className="w-4 h-4" />
                <span>Update & Select Seats</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowDuplicateModal(false);
                  setExistingDocId(null);
                  proceedToSeatSelector(null);
                }}
                className="py-3 px-4 rounded-xl bg-gray-100 hover:bg-gray-200 text-[#241226] font-bold text-xs uppercase tracking-wider transition-all cursor-pointer"
              >
                New Entry & Select Seats
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
                className="text-[#C81E6E] hover:underline font-bold text-xs cursor-pointer"
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

      {/* RESERVATION FLOW OPTIONS MODAL */}
      {showReservationFlowModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/85 backdrop-blur-md overflow-y-auto">
          <div className="bg-gradient-to-br from-[#240c2e] via-[#1a0723] to-[#0f0314] border-2 border-amber-500/50 rounded-3xl p-6 sm:p-8 max-w-3xl w-full text-white space-y-6 shadow-[0_0_60px_rgba(232,180,0,0.2)] relative my-8">
            <button
              type="button"
              onClick={() => setShowReservationFlowModal(false)}
              className="absolute top-4 right-4 sm:top-5 sm:right-5 p-2.5 rounded-full bg-slate-900/90 border-2 border-amber-400/70 text-amber-300 hover:bg-amber-400 hover:text-slate-950 transition-all cursor-pointer shadow-xl z-20 flex items-center justify-center group"
              aria-label="Close modal"
              title="Close"
            >
              <X className="w-5 h-5 transition-transform group-hover:scale-110" />
            </button>

            <div className="text-center space-y-2 pr-8 sm:pr-0">
              <span className="text-[10px] font-black uppercase tracking-widest px-3.5 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 inline-block">
                GRACIA MUSICAL CONCERT
              </span>
              <h3 className="font-poster text-2xl sm:text-3xl text-white tracking-wide">
                Reserve Your Seat
              </h3>
              <p className="text-xs sm:text-sm text-white/75 max-w-md mx-auto leading-relaxed">
                Please select the option below that best applies to your attendance:
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Option 1: Clergy & VIP Guests */}
              <button
                type="button"
                onClick={() => {
                  setShowReservationFlowModal(false);
                  setShowClergyVipModal(true);
                  setClergyVipError(null);
                  setClergyVipSuccess(null);
                }}
                className="w-full h-full p-5 rounded-2xl bg-gradient-to-br from-amber-500/20 via-amber-900/30 to-purple-950/40 hover:from-amber-500/30 hover:to-purple-900/60 border-2 border-amber-500/50 hover:border-amber-400 text-left transition-all flex flex-col justify-between space-y-3 group cursor-pointer shadow-lg hover:shadow-amber-500/25"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2 text-amber-300 font-bold text-xs uppercase tracking-wider">
                      <Church className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform" />
                      <span>Option 1</span>
                    </div>
                    <ArrowRight className="w-4 h-4 text-amber-300 group-hover:translate-x-1 transition-transform" />
                  </div>
                  <h4 className="font-poster text-lg sm:text-xl text-white tracking-wide">
                    Clergy & Special Guests
                  </h4>
                  <p className="text-xs text-white/75 font-sans leading-relaxed">
                    For invited Priests, Religious, and VIPs. Click here to confirm your attendance.
                  </p>
                </div>
                <div className="pt-2 text-[11px] font-semibold text-amber-300/90 group-hover:text-amber-200 flex items-center space-x-1">
                  <span>Confirm Attendance</span>
                  <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </button>

              {/* Option 2: Conference Delegates */}
              <button
                type="button"
                onClick={() => {
                  setShowReservationFlowModal(false);
                  if (onNavigateToPortal) {
                    onNavigateToPortal('musical');
                  } else {
                    window.location.href = '/portal';
                  }
                }}
                className="w-full h-full p-5 rounded-2xl bg-gradient-to-br from-purple-500/20 via-purple-900/30 to-purple-950/40 hover:from-purple-500/30 hover:to-purple-900/60 border-2 border-purple-500/50 hover:border-purple-400 text-left transition-all flex flex-col justify-between space-y-3 group cursor-pointer shadow-lg hover:shadow-purple-500/25"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2 text-purple-300 font-bold text-xs uppercase tracking-wider">
                      <Ticket className="w-4 h-4 text-purple-400 group-hover:scale-110 transition-transform" />
                      <span>Option 2</span>
                    </div>
                    <ArrowRight className="w-4 h-4 text-purple-300 group-hover:translate-x-1 transition-transform" />
                  </div>
                  <h4 className="font-poster text-lg sm:text-xl text-white tracking-wide">
                    Conference Pass Holders
                  </h4>
                  <p className="text-xs text-white/75 font-sans leading-relaxed">
                    Log in with your registered email to claim your complimentary Musical Concert Pass.
                  </p>
                </div>
                <div className="pt-2 text-[11px] font-semibold text-purple-300/90 group-hover:text-purple-200 flex items-center space-x-1">
                  <span>Claim Conference Pass</span>
                  <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </button>

              {/* Option 3: Use Invitation Code */}
              <button
                type="button"
                onClick={() => {
                  setShowReservationFlowModal(false);
                  setInvitationStep('verify');
                  setInvitationCodeInput('');
                  setInvitationCodeError(null);
                  setInvitationCodeSuccess(null);
                  setInvitationMainName('');
                  setInvitationMainEmail('');
                  setInvitationMainPhone('');
                  setInvitationGroupMembers([]);
                  setInvitationRedemptionError(null);
                  setInvitationRedemptionSuccess(null);
                  setShowInvitationCodeModal(true);
                }}
                className="w-full h-full p-5 rounded-2xl bg-gradient-to-br from-pink-500/20 via-purple-900/30 to-pink-950/40 hover:from-pink-500/30 hover:to-pink-900/60 border-2 border-pink-500/50 hover:border-pink-400 text-left transition-all flex flex-col justify-between space-y-3 group cursor-pointer shadow-lg hover:shadow-pink-500/25"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2 text-pink-300 font-bold text-xs uppercase tracking-wider">
                      <QrCode className="w-4 h-4 text-pink-400 group-hover:scale-110 transition-transform" />
                      <span>Option 3</span>
                    </div>
                    <ArrowRight className="w-4 h-4 text-pink-300 group-hover:translate-x-1 transition-transform" />
                  </div>
                  <h4 className="font-poster text-lg sm:text-xl text-white tracking-wide">
                    Use Invitation Code
                  </h4>
                  <p className="text-xs text-white/75 font-sans leading-relaxed">
                    Redeem your individual or group invitation code to reserve your seats.
                  </p>
                </div>
                <div className="pt-2 text-[11px] font-semibold text-pink-300/90 group-hover:text-pink-200 flex items-center space-x-1">
                  <span>Use Invitation Code</span>
                  <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </button>

              {/* Option 4: Waitlist & Interest Registration */}
              <button
                type="button"
                onClick={() => {
                  setShowReservationFlowModal(false);
                  setShowWaitlistModal(true);
                  setWaitlistError(null);
                  setWaitlistSuccess(null);
                }}
                className="w-full h-full p-5 rounded-2xl bg-gradient-to-br from-cyan-500/20 via-teal-900/30 to-slate-950/40 hover:from-cyan-500/30 hover:to-teal-900/60 border-2 border-cyan-500/50 hover:border-cyan-400 text-left transition-all flex flex-col justify-between space-y-3 group cursor-pointer shadow-lg hover:shadow-cyan-500/25"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2 text-cyan-300 font-bold text-xs uppercase tracking-wider">
                      <Clock className="w-4 h-4 text-cyan-400 group-hover:scale-110 transition-transform" />
                      <span>Option 4</span>
                    </div>
                    <ArrowRight className="w-4 h-4 text-cyan-300 group-hover:translate-x-1 transition-transform" />
                  </div>
                  <h4 className="font-poster text-lg sm:text-xl text-white tracking-wide">
                    Waitlist & Interest
                  </h4>
                  <p className="text-xs text-white/75 font-sans leading-relaxed">
                    Register your interest to receive instant updates as additional seats open up.
                  </p>
                </div>
                <div className="pt-2 text-[11px] font-semibold text-cyan-300/90 group-hover:text-cyan-200 flex items-center space-x-1">
                  <span>Express Interest</span>
                  <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* OPTION 1: CLERGY & SPECIAL GUESTS RESERVATION MODAL */}
      {showClergyVipModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
          <div className="bg-gradient-to-br from-[#2b1435] via-[#1f0d27] to-[#120617] border-2 border-amber-500/50 rounded-3xl p-6 sm:p-8 max-w-lg w-full text-white space-y-6 shadow-2xl relative my-8">
            <button
              type="button"
              onClick={() => setShowClergyVipModal(false)}
              className="absolute top-4 right-4 sm:top-5 sm:right-5 p-2.5 rounded-full bg-slate-900/90 border-2 border-amber-400/70 text-amber-300 hover:bg-amber-400 hover:text-slate-950 transition-all cursor-pointer shadow-xl z-20 flex items-center justify-center group"
              aria-label="Close modal"
              title="Close"
            >
              <X className="w-5 h-5 transition-transform group-hover:scale-110" />
            </button>

            <div className="text-center space-y-2">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-300">
                <Church className="w-6 h-6" />
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 inline-block">
                OPTION 1: CLERGY & VIP GUESTS
              </span>
              <h3 className="font-poster text-2xl sm:text-3xl text-white">
                Clergy & Special Guests
              </h3>
              <p className="text-xs text-white/70 max-w-sm mx-auto leading-relaxed">
                For invited Priests, Religious, and VIPs. Please enter your details below to confirm your attendance.
              </p>
            </div>

            {clergyVipSuccess ? (
              <div className="bg-emerald-500/10 border-2 border-emerald-500/40 rounded-2xl p-6 text-center space-y-4">
                <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
                <div className="space-y-1">
                  <h4 className="font-poster text-2xl text-white">Attendance Confirmed!</h4>
                  <p className="text-xs text-emerald-200">
                    Thank you, <strong className="text-white">{clergyVipSuccess.name}</strong>. Your reservation for <strong className="text-white">{clergyVipSuccess.seats} seat(s)</strong> has been recorded.
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-black/40 border border-emerald-500/30 text-xs font-mono text-amber-300">
                  Reference Code: <span className="font-bold text-white tracking-widest">{clergyVipSuccess.refId}</span>
                </div>
                <p className="text-[11px] text-white/60">
                  Our organizing committee will issue your VIP access passes and send event details directly to your email.
                </p>
                <button
                  type="button"
                  onClick={() => setShowClergyVipModal(false)}
                  className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-wider transition-all cursor-pointer"
                >
                  Close & Return
                </button>
              </div>
            ) : (
              <form onSubmit={handleClergyVipSubmit} className="space-y-4 text-left">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-amber-300 mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={clergyName}
                    onChange={(e) => setClergyName(e.target.value)}
                    placeholder="e.g. Fr. Dominic / Sr. Maria"
                    className="w-full px-4 py-2.5 rounded-xl bg-black/40 border border-amber-500/40 text-white text-xs focus:border-amber-400 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-amber-300 mb-1">
                      Email Address *
                    </label>
                    <input
                      type="email"
                      required
                      value={clergyEmail}
                      onChange={(e) => setClergyEmail(e.target.value)}
                      placeholder="e.g. contact@parish.org"
                      className="w-full px-4 py-2.5 rounded-xl bg-black/40 border border-amber-500/40 text-white text-xs focus:border-amber-400 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-amber-300 mb-1">
                      Phone Number *
                    </label>
                    <input
                      type="tel"
                      required
                      value={clergyPhone}
                      onChange={(e) => setClergyPhone(e.target.value)}
                      placeholder="e.g. +65 9123 4567"
                      className="w-full px-4 py-2.5 rounded-xl bg-black/40 border border-amber-500/40 text-white text-xs focus:border-amber-400 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-amber-300 mb-1">
                      Designation / Category *
                    </label>
                    <select
                      value={clergyDesignation}
                      onChange={(e) => setClergyDesignation(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl bg-black/40 border border-amber-500/40 text-white text-xs font-semibold focus:border-amber-400 focus:outline-none"
                    >
                      <option value="Priest / Clergy" className="bg-[#1c0d1e]">Priest / Clergy</option>
                      <option value="Religious Brother/Sister" className="bg-[#1c0d1e]">Religious Brother / Sister</option>
                      <option value="VIP Guest" className="bg-[#1c0d1e]">VIP Guest</option>
                      <option value="Sponsor / Partner" className="bg-[#1c0d1e]">Sponsor / Partner</option>
                      <option value="Special Guest" className="bg-[#1c0d1e]">Special Guest</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-amber-300 mb-1">
                      Seats Reserving *
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="10"
                      value={clergySeats}
                      onChange={(e) => setClergySeats(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-full px-4 py-2.5 rounded-xl bg-black/40 border border-amber-500/40 text-white font-mono text-xs focus:border-amber-400 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-amber-300 mb-1">
                    Parish / Religious Order / Organization (Optional)
                  </label>
                  <input
                    type="text"
                    value={clergyParish}
                    onChange={(e) => setClergyParish(e.target.value)}
                    placeholder="e.g. St. Ignatius / Order of Preachers"
                    className="w-full px-4 py-2.5 rounded-xl bg-black/40 border border-amber-500/40 text-white text-xs focus:border-amber-400 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-amber-300 mb-1">
                    Special Remarks / Requests (Optional)
                  </label>
                  <textarea
                    rows={2}
                    value={clergyRemarks}
                    onChange={(e) => setClergyRemarks(e.target.value)}
                    placeholder="e.g. Accessibility or seating requirements"
                    className="w-full px-4 py-2.5 rounded-xl bg-black/40 border border-amber-500/40 text-white text-xs focus:border-amber-400 focus:outline-none resize-none"
                  />
                </div>

                {clergyVipError && (
                  <div className="p-3 rounded-xl bg-red-500/20 border border-red-500/40 text-red-200 text-xs font-medium flex items-center space-x-2">
                    <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                    <span>{clergyVipError}</span>
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowClergyVipModal(false)}
                    className="flex-1 py-3 px-4 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs uppercase tracking-wider transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingClergyVip}
                    className="flex-1 py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg transition-all cursor-pointer flex items-center justify-center space-x-2"
                  >
                    {submittingClergyVip ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Check className="w-4 h-4" />
                    )}
                    <span>Confirm Attendance</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* OPTION 4: WAITLIST & INTEREST REGISTRATION MODAL */}
      {showWaitlistModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
          <div className="bg-gradient-to-br from-[#2b1435] via-[#1f0d27] to-[#120617] border-2 border-cyan-500/50 rounded-3xl p-6 sm:p-8 max-w-lg w-full text-white space-y-6 shadow-2xl relative my-8">
            <button
              type="button"
              onClick={() => setShowWaitlistModal(false)}
              className="absolute top-4 right-4 sm:top-5 sm:right-5 p-2.5 rounded-full bg-slate-900/90 border-2 border-cyan-400/70 text-cyan-300 hover:bg-cyan-400 hover:text-slate-950 transition-all cursor-pointer shadow-xl z-20 flex items-center justify-center group"
              aria-label="Close modal"
              title="Close"
            >
              <X className="w-5 h-5 transition-transform group-hover:scale-110" />
            </button>

            <div className="text-center space-y-2">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-300">
                <Clock className="w-6 h-6" />
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 inline-block">
                OPTION 4: WAITLIST & INTEREST REGISTRATION
              </span>
              <h3 className="font-poster text-2xl sm:text-3xl text-white">
                Express Interest / Waitlist
              </h3>
              <p className="text-xs text-white/70 max-w-sm mx-auto leading-relaxed">
                Register your interest to receive instant updates as additional seats open up for the GRACIA Musical Concert.
              </p>
            </div>

            {waitlistSuccess ? (
              <div className="bg-cyan-500/10 border-2 border-cyan-500/40 rounded-2xl p-6 text-center space-y-4">
                <CheckCircle2 className="w-12 h-12 text-cyan-400 mx-auto" />
                <div className="space-y-1">
                  <h4 className="font-poster text-2xl text-white">Waitlist Interest Registered!</h4>
                  <p className="text-xs text-cyan-200">
                    Thank you, <strong className="text-white">{waitlistSuccess.name}</strong>. You have been placed on the priority waitlist for <strong className="text-white">{waitlistSuccess.seats} seat(s)</strong>.
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-black/40 border border-cyan-500/30 text-xs font-mono text-cyan-300">
                  Waitlist Reference: <span className="font-bold text-white tracking-widest">{waitlistSuccess.refId}</span>
                </div>
                <p className="text-[11px] text-white/60">
                  We will send a notification email to <strong className="text-cyan-200">{waitlistSuccess.email}</strong> as soon as extra seating allocations open up.
                </p>
                <button
                  type="button"
                  onClick={() => setShowWaitlistModal(false)}
                  className="w-full py-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs uppercase tracking-wider transition-all cursor-pointer"
                >
                  Close & Return
                </button>
              </div>
            ) : (
              <form onSubmit={handleWaitlistSubmit} className="space-y-4 text-left">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-cyan-300 mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={waitlistName}
                    onChange={(e) => setWaitlistName(e.target.value)}
                    placeholder="e.g. John Tan"
                    className="w-full px-4 py-2.5 rounded-xl bg-black/40 border border-cyan-500/40 text-white text-xs focus:border-cyan-400 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-cyan-300 mb-1">
                      Email Address *
                    </label>
                    <input
                      type="email"
                      required
                      value={waitlistEmail}
                      onChange={(e) => setWaitlistEmail(e.target.value)}
                      placeholder="e.g. john@example.com"
                      className="w-full px-4 py-2.5 rounded-xl bg-black/40 border border-cyan-500/40 text-white text-xs focus:border-cyan-400 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-cyan-300 mb-1">
                      Phone Number *
                    </label>
                    <input
                      type="tel"
                      required
                      value={waitlistPhone}
                      onChange={(e) => setWaitlistPhone(e.target.value)}
                      placeholder="e.g. +65 9123 4567"
                      className="w-full px-4 py-2.5 rounded-xl bg-black/40 border border-cyan-500/40 text-white text-xs focus:border-cyan-400 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-cyan-300 mb-1">
                      Category *
                    </label>
                    <select
                      value={waitlistCategory}
                      onChange={(e) => setWaitlistCategory(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl bg-black/40 border border-cyan-500/40 text-white text-xs font-semibold focus:border-cyan-400 focus:outline-none"
                    >
                      <option value="General Public" className="bg-[#1c0d1e]">General Public</option>
                      <option value="Youth" className="bg-[#1c0d1e]">Youth Ministry</option>
                      <option value="Parishioner" className="bg-[#1c0d1e]">Parishioner</option>
                      <option value="Visitor" className="bg-[#1c0d1e]">Overseas Visitor</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-cyan-300 mb-1">
                      Seats Needed *
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="10"
                      value={waitlistSeats}
                      onChange={(e) => setWaitlistSeats(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-full px-4 py-2.5 rounded-xl bg-black/40 border border-cyan-500/40 text-white font-mono text-xs focus:border-cyan-400 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-cyan-300 mb-1">
                    Remarks / Notes (Optional)
                  </label>
                  <textarea
                    rows={2}
                    value={waitlistRemarks}
                    onChange={(e) => setWaitlistRemarks(e.target.value)}
                    placeholder="e.g. Prefer evening show or special seating"
                    className="w-full px-4 py-2.5 rounded-xl bg-black/40 border border-cyan-500/40 text-white text-xs focus:border-cyan-400 focus:outline-none resize-none"
                  />
                </div>

                {waitlistError && (
                  <div className="p-3 rounded-xl bg-red-500/20 border border-red-500/40 text-red-200 text-xs font-medium flex items-center space-x-2">
                    <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                    <span>{waitlistError}</span>
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowWaitlistModal(false)}
                    className="flex-1 py-3 px-4 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs uppercase tracking-wider transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingWaitlist}
                    className="flex-1 py-3 px-4 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg transition-all cursor-pointer flex items-center justify-center space-x-2"
                  >
                    {submittingWaitlist ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Check className="w-4 h-4" />
                    )}
                    <span>Join Waitlist</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* INVITATION CODE VERIFICATION & REDEMPTION MODAL */}
      {showInvitationCodeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
          <div className="bg-gradient-to-br from-[#2b1435] via-[#1f0d27] to-[#120617] border-2 border-pink-500/50 rounded-3xl p-6 sm:p-8 max-w-lg w-full text-white space-y-6 shadow-2xl relative my-8">
            <button
              type="button"
              onClick={() => setShowInvitationCodeModal(false)}
              className="absolute top-4 right-4 sm:top-5 sm:right-5 p-2.5 rounded-full bg-slate-900/90 border-2 border-pink-400/70 text-pink-300 hover:bg-pink-400 hover:text-slate-950 transition-all cursor-pointer shadow-xl z-20 flex items-center justify-center group"
              aria-label="Close modal"
              title="Close"
            >
              <X className="w-5 h-5 transition-transform group-hover:scale-110" />
            </button>

            {/* STEP 1: VERIFY CODE */}
            {invitationStep === 'verify' && (
              <>
                <div className="text-center space-y-2">
                  <div className="w-12 h-12 mx-auto rounded-2xl bg-pink-500/20 border border-pink-500/40 flex items-center justify-center text-pink-300">
                    <QrCode className="w-6 h-6" />
                  </div>
                  <h3 className="font-poster text-2xl text-white">
                    Use Invitation Code
                  </h3>
                  <p className="text-xs text-white/70 max-w-sm mx-auto">
                    Please enter the unique group or individual invitation code provided to you:
                  </p>
                </div>

                <form onSubmit={handleVerifyInvitationCode} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-pink-300 mb-1.5">
                      Invitation Code
                    </label>
                    <input
                      type="text"
                      value={invitationCodeInput}
                      onChange={(e) => {
                        setInvitationCodeInput(e.target.value.toUpperCase());
                        setInvitationCodeError(null);
                      }}
                      placeholder="e.g. GRACIA-VIP-8291"
                      className="w-full px-4 py-3 rounded-xl bg-black/40 border-2 border-pink-500/40 text-white font-mono text-center tracking-widest text-lg uppercase focus:border-pink-400 focus:outline-none"
                      autoFocus
                    />
                  </div>

                  {invitationCodeError && (
                    <div className="p-3 rounded-xl bg-red-500/20 border border-red-500/40 text-red-200 text-xs font-medium flex items-center space-x-2">
                      <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                      <span>{invitationCodeError}</span>
                    </div>
                  )}

                  {invitationCodeSuccess && (
                    <div className="p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 text-xs font-medium flex items-center space-x-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>{invitationCodeSuccess}</span>
                    </div>
                  )}

                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowInvitationCodeModal(false)}
                      className="flex-1 py-3 px-4 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs uppercase tracking-wider transition-all cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={verifyingCode}
                      className="flex-1 py-3 px-4 rounded-xl bg-pink-600 hover:bg-pink-500 disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider shadow-lg transition-all cursor-pointer flex items-center justify-center space-x-2"
                    >
                      {verifyingCode ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Check className="w-4 h-4" />
                      )}
                      <span>Verify Code</span>
                    </button>
                  </div>
                </form>
              </>
            )}

            {/* STEP 2: PARTICIPANT DETAILS & GROUP MEMBERS */}
            {invitationStep === 'details' && verifiedCodeRecord && (
              <>
                <div className="text-center space-y-2">
                  <div className="w-12 h-12 mx-auto rounded-2xl bg-pink-500/20 border border-pink-500/40 flex items-center justify-center text-pink-300">
                    <UserPlus className="w-6 h-6" />
                  </div>
                  <h3 className="font-poster text-2xl text-white">
                    Claim Your Concert Pass
                  </h3>
                  <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-pink-500/20 border border-pink-500/40 text-pink-300 text-xs font-mono font-bold">
                    <span>Code: {verifiedCodeRecord.code}</span>
                    <span>•</span>
                    <span className="uppercase">
                      {(verifiedCodeRecord.codeType === 'group' || verifiedCodeRecord.type === 'group' || (verifiedCodeRecord.maxSeats || 1) > 1)
                        ? `Group Code (${verifiedCodeRecord.maxSeats} Seats)`
                        : 'Individual Pass'}
                    </span>
                  </div>
                </div>

                {/* Ticket Allocation Pricing Banner */}
                {verifiedCodeRecord.ticketType === 'paid' ? (
                  <div className="p-3.5 rounded-2xl bg-amber-500/20 border border-amber-500/50 text-amber-200 text-xs font-semibold flex items-center justify-between">
                    <div className="flex items-center space-x-2.5">
                      <div className="w-8 h-8 rounded-xl bg-amber-500/30 border border-amber-400/60 flex items-center justify-center shrink-0 text-amber-300">
                        <DollarSign className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="font-bold text-amber-300 block text-xs">Paid Ticket Code (${verifiedCodeRecord.ticketPrice || 10} / seat)</span>
                        <span className="text-[11px] text-amber-200/80">
                          Requires PayNow QR payment during checkout. Total: ${(verifiedCodeRecord.ticketPrice || 10) * (1 + invitationGroupMembers.filter(Boolean).length)} SGD.
                        </span>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-full bg-amber-400 text-slate-950 font-black font-mono text-xs shrink-0 ml-2">
                      ${(verifiedCodeRecord.ticketPrice || 10) * (1 + invitationGroupMembers.filter(Boolean).length)} SGD
                    </span>
                  </div>
                ) : (
                  <div className="p-3.5 rounded-2xl bg-emerald-500/20 border border-emerald-500/50 text-emerald-200 text-xs font-semibold flex items-center justify-between">
                    <div className="flex items-center space-x-2.5">
                      <div className="w-8 h-8 rounded-xl bg-emerald-500/30 border border-emerald-400/60 flex items-center justify-center shrink-0 text-emerald-300">
                        <Sparkles className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="font-bold text-emerald-300 block text-xs">Complimentary VIP Pass (100% Waived)</span>
                        <span className="text-[11px] text-emerald-200/80">
                          This code provides complimentary entry for all {1 + invitationGroupMembers.filter(Boolean).length} seat(s). No payment required!
                        </span>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-full bg-emerald-400 text-slate-950 font-black font-mono text-xs shrink-0 ml-2">
                      100% FREE
                    </span>
                  </div>
                )}

                <form onSubmit={handleInvitationDetailsSubmit} className="space-y-4 text-left">
                  <div className="space-y-3">
                    <div className="text-xs font-bold uppercase tracking-wider text-pink-300 border-b border-pink-500/20 pb-1 flex items-center space-x-1.5">
                      <Star className="w-3.5 h-3.5 text-pink-400" />
                      <span>Main Incharge / Contact Person Details</span>
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-pink-200 mb-1">
                        Full Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={invitationMainName}
                        onChange={(e) => setInvitationMainName(e.target.value)}
                        placeholder="e.g. Mary Tan"
                        className="w-full px-4 py-2.5 rounded-xl bg-black/40 border border-pink-500/40 text-white text-xs focus:border-pink-400 focus:outline-none"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-pink-200 mb-1">
                          Email Address *
                        </label>
                        <input
                          type="email"
                          required
                          value={invitationMainEmail}
                          onChange={(e) => setInvitationMainEmail(e.target.value)}
                          placeholder="e.g. mary@example.com"
                          className="w-full px-4 py-2.5 rounded-xl bg-black/40 border border-pink-500/40 text-white text-xs focus:border-pink-400 focus:outline-none"
                        />
                        <p className="text-[10px] text-white/50 mt-1">
                          Pass will be sent here & used to log in to Participant Portal.
                        </p>
                      </div>

                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-pink-200 mb-1">
                          Phone Number *
                        </label>
                        <input
                          type="tel"
                          required
                          value={invitationMainPhone}
                          onChange={(e) => setInvitationMainPhone(e.target.value)}
                          placeholder="e.g. +65 9123 4567"
                          className="w-full px-4 py-2.5 rounded-xl bg-black/40 border border-pink-500/40 text-white text-xs focus:border-pink-400 focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Group Members Section (if Group Code or maxSeats > 1) */}
                  {(verifiedCodeRecord.codeType === 'group' || verifiedCodeRecord.type === 'group' || (verifiedCodeRecord.maxSeats || 1) > 1) && (
                    <div className="space-y-3 pt-2 border-t border-pink-500/20">
                      <div className="flex items-center justify-between">
                        <div>
                          <label className="block text-xs font-bold uppercase tracking-wider text-pink-300">
                            Group Member Names (Max {(verifiedCodeRecord.maxSeats || 1) - 1} Additional)
                          </label>
                          <p className="text-[11px] text-white/60">
                            Provide names for each additional person joining with this group pass:
                          </p>
                        </div>
                        {invitationGroupMembers.length < ((verifiedCodeRecord.maxSeats || 1) - 1) && (
                          <button
                            type="button"
                            onClick={() => setInvitationGroupMembers([...invitationGroupMembers, ''])}
                            className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-pink-500/20 hover:bg-pink-500/30 text-pink-200 border border-pink-500/40 flex items-center space-x-1 transition-all cursor-pointer shrink-0"
                          >
                            <Plus className="w-3 h-3" />
                            <span>Add Member</span>
                          </button>
                        )}
                      </div>

                      {invitationGroupMembers.length === 0 ? (
                        <div className="p-3 rounded-xl bg-black/30 border border-pink-500/20 text-center text-xs text-white/60">
                          No additional members added yet. Click <strong>"+ Add Member"</strong> above to enter names for other attendees.
                        </div>
                      ) : (
                        <div className="space-y-2 max-h-48 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-pink-500/40">
                          {invitationGroupMembers.map((member, idx) => (
                            <div key={idx} className="flex items-center space-x-2">
                              <span className="text-xs font-mono font-bold text-pink-300/80 shrink-0 w-24">
                                Member #{idx + 2}:
                              </span>
                              <input
                                type="text"
                                value={member}
                                onChange={(e) => {
                                  const updated = [...invitationGroupMembers];
                                  updated[idx] = e.target.value;
                                  setInvitationGroupMembers(updated);
                                }}
                                placeholder={`Full Name of Member #${idx + 2}`}
                                className="flex-1 px-3 py-2 rounded-xl bg-black/40 border border-pink-500/40 text-white text-xs focus:border-pink-400 focus:outline-none"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  const updated = invitationGroupMembers.filter((_, i) => i !== idx);
                                  setInvitationGroupMembers(updated);
                                }}
                                className="p-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-300 transition-all shrink-0 cursor-pointer"
                                title="Remove Member"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {invitationRedemptionError && (
                    <div className="p-3 rounded-xl bg-red-500/20 border border-red-500/40 text-red-200 text-xs font-medium flex items-center space-x-2">
                      <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                      <span>{invitationRedemptionError}</span>
                    </div>
                  )}

                  <div className="flex gap-3 pt-3 border-t border-pink-500/20">
                    <button
                      type="button"
                      onClick={() => setInvitationStep('verify')}
                      className="py-3 px-4 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs uppercase tracking-wider transition-all cursor-pointer flex items-center space-x-1"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>Back</span>
                    </button>
                    <button
                      type="submit"
                      disabled={submittingInvitationRedemption}
                      className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider shadow-lg transition-all cursor-pointer flex items-center justify-center space-x-2"
                    >
                      {submittingInvitationRedemption ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : verifiedCodeRecord.ticketType === 'paid' ? (
                        <ArrowRight className="w-4 h-4" />
                      ) : (
                        <Check className="w-4 h-4" />
                      )}
                      <span>
                        {verifiedCodeRecord.ticketType === 'paid'
                          ? 'Proceed to PayNow Payment'
                          : 'Confirm & Generate Free Pass'}
                      </span>
                    </button>
                  </div>
                </form>
              </>
            )}

            {/* STEP 2.5: PAYNOW PAYMENT FOR PAID INVITATION CODE */}
            {invitationStep === 'payment' && verifiedCodeRecord && (
              <>
                <div className="text-center space-y-2">
                  <div className="w-12 h-12 mx-auto rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-300">
                    <CreditCard className="w-6 h-6" />
                  </div>
                  <h3 className="font-poster text-2xl text-white">
                    PayNow Payment
                  </h3>
                  <p className="text-xs text-amber-200/90 max-w-sm mx-auto">
                    Please complete PayNow QR payment to claim your invitation pass:
                  </p>
                </div>

                <form onSubmit={handleInvitationPaymentSubmit} className="space-y-4 text-left">
                  <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-3">
                    <div className="flex items-center justify-between text-xs font-bold border-b border-amber-500/20 pb-2">
                      <span className="text-amber-300">Total Amount Due ({1 + invitationGroupMembers.filter(Boolean).length} Seat(s)):</span>
                      <span className="text-lg font-mono text-amber-400 font-extrabold">
                        ${(verifiedCodeRecord.ticketPrice || 10) * (1 + invitationGroupMembers.filter(Boolean).length)} SGD
                      </span>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center gap-4 bg-black/40 p-3 rounded-xl border border-amber-500/20">
                      <div className="p-2 bg-white rounded-xl shrink-0 shadow-md">
                        <img 
                          src={paynowQrImg} 
                          alt="PayNow QR Code" 
                          className="w-32 h-32 object-contain" 
                        />
                      </div>
                      <div className="space-y-1.5 text-xs text-white/80">
                        <div className="font-bold text-amber-300 flex items-center space-x-1">
                          <QrCode className="w-3.5 h-3.5" />
                          <span>PayNow UEN / Mobile</span>
                        </div>
                        <p className="font-mono text-emerald-300 font-bold bg-emerald-500/10 px-2 py-1 rounded border border-emerald-500/30 text-[11px] inline-block">
                          UEN: T08SS0144G (JYSG Jubilee)
                        </p>
                        <p className="text-[10px] text-white/60">
                          Scan the QR code with your Singapore Bank app (DBS/POSB, OCBC, UOB, Maybank, HSBC, etc.)
                        </p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-amber-300 mb-1.5">
                      PayNow Transaction Reference / UEN Receipt No. *
                    </label>
                    <input
                      type="text"
                      required
                      value={invitationPayRef}
                      onChange={(e) => setInvitationPayRef(e.target.value)}
                      placeholder="e.g. 2026081198723450 or Bank Ref"
                      className="w-full px-4 py-2.5 rounded-xl bg-black/40 border border-amber-500/40 text-amber-300 font-mono text-xs focus:border-amber-400 focus:outline-none"
                    />
                    <p className="text-[10px] text-white/50 mt-1">
                      Enter the reference number from your bank app payment confirmation screen.
                    </p>
                  </div>

                  {invitationRedemptionError && (
                    <div className="p-3 rounded-xl bg-red-500/20 border border-red-500/40 text-red-200 text-xs font-medium flex items-center space-x-2">
                      <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                      <span>{invitationRedemptionError}</span>
                    </div>
                  )}

                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setInvitationStep('details')}
                      className="py-3 px-4 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs uppercase tracking-wider transition-all cursor-pointer flex items-center space-x-1"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>Back</span>
                    </button>
                    <button
                      type="submit"
                      disabled={submittingInvitationRedemption}
                      className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-pink-600 hover:from-amber-400 hover:to-pink-500 disabled:opacity-50 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg transition-all cursor-pointer flex items-center justify-center space-x-2"
                    >
                      {submittingInvitationRedemption ? (
                        <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                      ) : (
                        <Check className="w-4 h-4 text-slate-950" />
                      )}
                      <span>Submit Payment & Claim Pass</span>
                    </button>
                  </div>
                </form>
              </>
            )}

            {/* STEP 3: SUCCESS & PORTAL LINK */}
            {invitationStep === 'success' && (
              <div className="text-center space-y-4 py-2">
                <div className="w-16 h-16 mx-auto rounded-full bg-emerald-500/20 border-2 border-emerald-400 flex items-center justify-center text-emerald-300 shadow-lg shadow-emerald-500/20 animate-pulse">
                  <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                </div>
                <div className="space-y-1">
                  <h3 className="font-poster text-2xl text-white">Concert Pass Issued!</h3>
                  <p className="text-xs text-emerald-300 font-semibold uppercase tracking-wider">
                    Invitation Code: {verifiedCodeRecord?.code}
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-black/40 border border-emerald-500/30 text-left space-y-2 text-xs">
                  <div className="flex justify-between border-b border-white/10 pb-1.5">
                    <span className="text-white/60">Main Contact:</span>
                    <span className="font-bold text-white">{invitationRedemptionSuccess?.name}</span>
                  </div>
                  <div className="flex justify-between border-b border-white/10 pb-1.5">
                    <span className="text-white/60">Email Address:</span>
                    <span className="font-mono text-emerald-300">{invitationRedemptionSuccess?.email}</span>
                  </div>
                  <div className="flex justify-between border-b border-white/10 pb-1.5">
                    <span className="text-white/60">Pass ID / Ref:</span>
                    <span className="font-mono text-white/90">{invitationRedemptionSuccess?.refId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/60">Passes Included:</span>
                    <span className="font-bold text-emerald-300">{invitationRedemptionSuccess?.seats} Pass(es)</span>
                  </div>
                </div>

                <p className="text-xs text-white/70 leading-relaxed max-w-md mx-auto">
                  ✨ A confirmation email with your official Musical Concert Pass has been generated and sent to <strong className="text-emerald-300">{invitationRedemptionSuccess?.email}</strong>.
                </p>

                <div className="p-3 rounded-xl bg-purple-900/30 border border-purple-500/30 text-xs text-purple-200">
                  💡 You can log in to the <strong>Participant Portal</strong> anytime using your email address to view, download, or show your pass!
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowInvitationCodeModal(false);
                      if (onNavigateToPortal) {
                        onNavigateToPortal('registrations');
                      }
                    }}
                    className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-400 hover:to-purple-500 text-white font-bold text-xs uppercase tracking-wider shadow-lg transition-all cursor-pointer flex items-center justify-center space-x-2"
                  >
                    <Ticket className="w-4 h-4" />
                    <span>View Pass in Portal</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowInvitationCodeModal(false)}
                    className="py-3 px-4 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs uppercase tracking-wider transition-all cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* LOCATION MAP MODAL */}
      <LocationMapModal
        isOpen={showLocationModal}
        onClose={() => setShowLocationModal(false)}
        venueName="Caritas Agape Village Main Auditorium"
        address="7A Lorong 8 Toa Payoh, Singapore 319264"
        hallName="Musical Concert Stage"
      />

      </div>
    </div>
  );
};
