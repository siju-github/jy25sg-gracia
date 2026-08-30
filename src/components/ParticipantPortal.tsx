import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { 
  auth, 
  loginWithGoogle, 
  logoutUser, 
  fetchAllRegistrations, 
  subscribeToRegistrations,
  updateRegistrationInFirestore,
  deleteRegistrationFromFirestore,
  checkIsAdminApproved,
  logPortalUserActivity,
  fetchRegistrationByPassIdOrDocId,
  subscribeToSiteContent,
  SUPER_ADMIN_EMAIL,
  PRIMARY_ADMIN_GMAIL,
  ALT_SUPER_ADMIN
} from '../lib/firebase';
import { 
  getAllIntercessionCommitments, 
  updateIntercessionCommitment, 
  formatCommitmentsSummary, 
  getCommitmentIcon,
  INTERCESSION_ITEMS, 
  IntercessionCommitmentRecord,
  IntercessionTotals
} from '../data/intercessionsData';
import { RegistrationData, AdditionalAttendee, SiteContentData } from '../types';
import { isDelegatePassCheckedIn } from '../lib/utils';
import { AdditionalAttendeesForm, buildExpectedAttendees } from './AdditionalAttendeesForm';
import { SeatSelector } from './SeatSelector';
import { AdminPanel } from './AdminPanel';
import { DigitalConferenceBadge } from './DigitalConferenceBadge';
import { 
  generatePDFTicket, 
  generateQRCodeDataURI, 
  downloadPDFPass,
  generateAllAttendeePasses,
  downloadIndividualPassPDF,
  AttendeePassItem
} from '../lib/ticketGenerator';
import { getBibleVersePassId, getPersonDeterministicSeed } from '../lib/bibleVerses';
import { 
  downloadWalletPassImage, 
  downloadApplePKPass, 
  downloadAppleCalendarEvent, 
  openGoogleCalendarEvent 
} from '../lib/walletPassGenerator';
import { 
  getMusicalConcertSettings, 
  DEFAULT_MUSICAL_RELEASE_DATE 
} from '../lib/invitationCodes';
import { motion, AnimatePresence } from 'motion/react';
import { 
  User as UserIcon, 
  LogOut,
  Mail, 
  LogIn, 
  Key, 
  Edit3, 
  Save, 
  X, 
  CheckCircle2, 
  Sparkles, 
  Music, 
  Heart, 
  Calendar, 
  Search, 
  Plus, 
  Minus, 
  RefreshCw, 
  Ticket, 
  Check, 
  AlertCircle, 
  Church, 
  Award,
  Bell, 
  Users,
  MessageSquare,
  Trash2,
  Wallet,
  QrCode,
  Download,
  Smartphone,
  Share2,
  ExternalLink,
  Shield,
  Camera,
  MailCheck,
  Send,
  Lock
} from 'lucide-react';

const RegistrationMembersPasses: React.FC<{
  reg: RegistrationData;
  onOpenWallet: (reg: RegistrationData, memberPass: AttendeePassItem) => void;
}> = ({ reg, onOpenWallet }) => {
  const [passes, setPasses] = useState<AttendeePassItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    generateAllAttendeePasses(reg)
      .then((res) => {
        if (isMounted) {
          // Extra deduplication safety
          const uniquePasses: AttendeePassItem[] = [];
          const seenPassIds = new Set<string>();
          const seenNames = new Set<string>();
          for (const p of res) {
            const normName = (p.name || '').trim().toLowerCase();
            if (seenPassIds.has(p.passId) || seenNames.has(normName)) continue;
            seenPassIds.add(p.passId);
            seenNames.add(normName);
            uniquePasses.push(p);
          }
          setPasses(uniquePasses);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error('Error generating member passes:', err);
        if (isMounted) setLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, [reg]);

  if (loading) {
    return (
      <div className="py-3 text-xs text-amber-300/70 flex items-center gap-2">
        <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-400" />
        <span>Generating member passes and individual QR codes...</span>
      </div>
    );
  }

  if (passes.length === 0) return null;

  return (
    <div className="pt-4 border-t border-white/10 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-xs font-black uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
          <QrCode className="w-4 h-4 text-amber-400" />
          <span>REGISTERED MEMBERS & INDIVIDUAL PASSES ({passes.length})</span>
        </h4>
        <span className="text-[10px] text-white/50 font-mono">
          Each person has their own pass & unique QR code
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {passes.map((pass, pIdx) => {
          const isPassCheckedIn = isDelegatePassCheckedIn(reg, pass.passId, pass.name, pass.isPrimary, (pass as any).id);

          // Strictly restrict Google profile photo to the primary registrant's pass
          const currentUserEmail = auth.currentUser?.email?.toLowerCase().trim();
          const currentUserName = auth.currentUser?.displayName?.toLowerCase().trim();
          const passName = (pass.name || '').toLowerCase().trim();
          const regEmail = (reg.email || '').toLowerCase().trim();

          const isCurrentLoggedInUserPass = pass.isPrimary && (
            (currentUserEmail && regEmail === currentUserEmail) ||
            (currentUserName && passName === currentUserName) ||
            Boolean(currentUserEmail)
          );

          const passGooglePhoto = isCurrentLoggedInUserPass ? (auth.currentUser?.photoURL || undefined) : undefined;

          return (
            <DigitalConferenceBadge
              key={`reg-pass-${pIdx}`}
              pass={pass}
              reg={reg}
              pIdx={pIdx}
              isCheckedIn={isPassCheckedIn}
              googlePhotoUrl={passGooglePhoto}
              onDownloadPdf={downloadIndividualPassPDF}
              onAddToWallet={(r, p) => onOpenWallet(r, p as any)}
            />
          );
        })}
      </div>
    </div>
  );
};

const MusicalCountdownTimer: React.FC<{ targetDate: string }> = ({ targetDate }) => {
  const [timeLeft, setTimeLeft] = useState<{ days: number; hours: number; minutes: number; seconds: number }>({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    const calculateTimeLeft = () => {
      const diff = new Date(targetDate).getTime() - new Date().getTime();
      if (diff <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        return;
      }
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
      const minutes = Math.floor((diff / 1000 / 60) % 60);
      const seconds = Math.floor((diff / 1000) % 60);
      setTimeLeft({ days, hours, minutes, seconds });
    };

    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000);
    return () => clearInterval(timer);
  }, [targetDate]);

  return (
    <div className="grid grid-cols-4 gap-2 sm:gap-4 max-w-md mx-auto my-4 text-center">
      <div className="p-3 bg-black/40 border border-amber-500/30 rounded-2xl">
        <div className="text-xl sm:text-3xl font-black text-amber-300 font-mono">{timeLeft.days}</div>
        <div className="text-[10px] sm:text-xs text-white/60 font-bold uppercase tracking-wider">Days</div>
      </div>
      <div className="p-3 bg-black/40 border border-amber-500/30 rounded-2xl">
        <div className="text-xl sm:text-3xl font-black text-amber-300 font-mono">{timeLeft.hours}</div>
        <div className="text-[10px] sm:text-xs text-white/60 font-bold uppercase tracking-wider">Hours</div>
      </div>
      <div className="p-3 bg-black/40 border border-amber-500/30 rounded-2xl">
        <div className="text-xl sm:text-3xl font-black text-amber-300 font-mono">{timeLeft.minutes}</div>
        <div className="text-[10px] sm:text-xs text-white/60 font-bold uppercase tracking-wider">Mins</div>
      </div>
      <div className="p-3 bg-black/40 border border-amber-500/30 rounded-2xl">
        <div className="text-xl sm:text-3xl font-black text-amber-300 font-mono">{timeLeft.seconds}</div>
        <div className="text-[10px] sm:text-xs text-white/60 font-bold uppercase tracking-wider">Secs</div>
      </div>
    </div>
  );
};

interface ParticipantPortalProps {
  onNavigateToConference?: () => void;
  onNavigateToMusical?: () => void;
  initialView?: 'participant' | 'admin';
}

export const ParticipantPortal: React.FC<ParticipantPortalProps> = ({
  onNavigateToConference,
  onNavigateToMusical,
  initialView = 'participant'
}) => {
  const [currentUser, setCurrentUser] = useState<User | null>(auth.currentUser);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [loadingData, setLoadingData] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Direct Pass ID & Email Lookup Authentication State
  const [lookupUser, setLookupUser] = useState<{ email: string; displayName: string; passId?: string } | null>(null);
  const [lookupPassId, setLookupPassId] = useState('');
  const [lookupEmail, setLookupEmail] = useState('');
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [isSearchingPass, setIsSearchingPass] = useState(false);

  const [siteContentData, setSiteContentData] = useState<SiteContentData | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeToSiteContent((data) => {
      setSiteContentData(data);
    });
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const enableGoogleLogin = siteContentData?.enableGoogleLogin ?? true;
  const enablePassIdLogin = siteContentData?.enablePassIdLogin ?? false;
  const enableEmailLogin = siteContentData?.enableEmailLogin ?? false;
  const enableEmailCodeLogin = siteContentData?.enableEmailCodeLogin ?? true;
  const googleLoginSuperAdminOnly = siteContentData?.googleLoginSuperAdminOnly ?? false;

  const [showSuperAdminControls, setShowSuperAdminControls] = useState(false);

  const activeEmail = (currentUser?.email || lookupUser?.email || '').toLowerCase().trim();
  const superAdminEmails = [SUPER_ADMIN_EMAIL.toLowerCase(), PRIMARY_ADMIN_GMAIL.toLowerCase(), ALT_SUPER_ADMIN.toLowerCase()];
  const isCurrentSuperAdmin = !!activeEmail && superAdminEmails.includes(activeEmail);

  // Both Option 1 (Google Login) and Option 2 (Email Code Login) are ALWAYS enabled and visible for all users
  const shouldShowGoogleLogin = true;
  const shouldShowEmailCodeLogin = true;
  const shouldShowPassIdLogin = enablePassIdLogin && (isCurrentSuperAdmin || showSuperAdminControls);

  // Email Confirmation Code (OTP) Authentication State
  const [codeEmail, setCodeEmail] = useState('');
  const [codeInput, setCodeInput] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [codeSuccessNotice, setCodeSuccessNotice] = useState<string | null>(null);
  const [isSendingCode, setIsSendingCode] = useState(false);

  // Send Confirmation Code Action (Triggers backend SMTP email via jysg25@jesusyouth.org)
  const handleSendConfirmationCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = codeEmail.trim().toLowerCase();

    if (!cleanEmail || !cleanEmail.includes('@')) {
      setCodeError('Please enter a valid registered email address.');
      return;
    }

    setIsSendingCode(true);
    setCodeError(null);
    setCodeSuccessNotice(null);

    try {
      const res = await fetch('/api/send-portal-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail })
      });

      const data = await res.json();

      if (!res.ok || data.status === 'error') {
        setCodeError(data.message || 'Failed to send confirmation code email. Please verify your registered email address.');
        setIsSendingCode(false);
        return;
      }

      setCodeSent(true);
      setCodeSuccessNotice(data.message || `✓ Confirmation code sent to ${cleanEmail}. Please check your email inbox and spam folder.`);

      logPortalUserActivity({
        name: 'Participant',
        email: cleanEmail,
        phone: '',
        action: 'Request Confirmation Code',
        details: `Dispatched SMTP confirmation code email from jysg25@jesusyouth.org to ${cleanEmail}`,
        loginMethod: 'Email Confirmation Code (SMTP)'
      }).catch(err => console.warn('Failed to log code request activity:', err));

    } catch (err) {
      console.error('Error requesting confirmation code email:', err);
      setCodeError('An unexpected error occurred while dispatching the confirmation code. Please check your connection and try again.');
    } finally {
      setIsSendingCode(false);
    }
  };

  // Verify Confirmation Code Action (Validates code via backend API)
  const handleVerifyConfirmationCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = codeEmail.trim().toLowerCase();
    const enteredCode = codeInput.trim();

    if (!enteredCode) {
      setCodeError('Please enter the 6-digit confirmation code sent to your email.');
      return;
    }

    setCodeError(null);
    setIsSearchingPass(true);

    try {
      const res = await fetch('/api/verify-portal-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, code: enteredCode })
      });

      const data = await res.json();

      if (!res.ok || data.status === 'error') {
        setCodeError(data.message || 'Invalid or expired confirmation code. Please check your email and try again.');
        setIsSearchingPass(false);
        return;
      }

      // Backend code verification succeeded! Load user registration data
      const allRegs = await fetchAllRegistrations();
      const matchingReg = allRegs.find(r => {
        const regEmail = (r.email || '').trim().toLowerCase();
        const primaryEmail = (r.primaryContactEmail || '').trim().toLowerCase();
        const matchesMain = regEmail === cleanEmail || primaryEmail === cleanEmail;
        const matchesAttendee = r.additionalAttendees?.some(a => (a.email || '').trim().toLowerCase() === cleanEmail);
        return matchesMain || matchesAttendee;
      });

      const displayName = matchingReg?.name || data.name || 'GRACIA Participant';

      const tempUser = {
        email: cleanEmail,
        displayName,
        phoneNumber: matchingReg?.phone || '',
        photoURL: null
      };

      setLookupUser({
        email: cleanEmail,
        displayName
      });

      await loadUserParticipantData(tempUser, cleanEmail);

      logPortalUserActivity({
        name: displayName,
        email: cleanEmail,
        phone: matchingReg?.phone || '',
        action: 'Email Code Authentication',
        details: `Successfully verified confirmation code and logged into portal`,
        loginMethod: 'Email Confirmation Code (SMTP)'
      }).catch(err => console.warn('Failed to log code portal session:', err));

    } catch (err) {
      console.error('Error verifying confirmation code:', err);
      setCodeError('An unexpected error occurred during code verification. Please try again.');
    } finally {
      setIsSearchingPass(false);
    }
  };

  const handleResetCodeLogin = () => {
    setCodeSent(false);
    setCodeInput('');
    setCodeError(null);
    setCodeSuccessNotice(null);
  };

  const activeUser = currentUser || (lookupUser ? { email: lookupUser.email, displayName: lookupUser.displayName, phoneNumber: '', photoURL: null } as any : null);

  // Admin Rights State
  const [isAdminUser, setIsAdminUser] = useState<boolean>(false);
  const [portalViewMode, setPortalViewMode] = useState<'participant' | 'admin'>(initialView);

  // User's fetched data
  const [userRegistrations, setUserRegistrations] = useState<RegistrationData[]>([]);
  const [userIntercessions, setUserIntercessions] = useState<IntercessionCommitmentRecord[]>([]);

  // Search filter / additional email claim
  const [claimEmailQuery, setClaimEmailQuery] = useState('');
  const [activePortalTab, setActivePortalTab] = useState<'conference' | 'musical' | 'intercessions'>('conference');
  const [musicalReleaseDate, setMusicalReleaseDate] = useState<string>(DEFAULT_MUSICAL_RELEASE_DATE);
  const [requestingReminder, setRequestingReminder] = useState(false);
  const [reminderSuccessNotice, setReminderSuccessNotice] = useState<string | null>(null);

  useEffect(() => {
    getMusicalConcertSettings().then(st => {
      if (st && st.releaseDate) {
        setMusicalReleaseDate(st.releaseDate);
      }
    });
  }, []);

  const handleRequestReminder = async (conferenceReg: RegistrationData) => {
    if (!conferenceReg || !conferenceReg.id) return;
    setRequestingReminder(true);
    try {
      const updated = {
        ...conferenceReg,
        reminder_requested: true,
        reminder_requested_at: new Date().toISOString()
      };
      await updateRegistrationInFirestore(conferenceReg.id, updated);
      setUserRegistrations(prev => prev.map(r => r.id === conferenceReg.id ? updated : r));
      setReminderSuccessNotice(`✓ Reminder requested! We will send an email notification to ${conferenceReg.email} when reservations open.`);
    } catch (err) {
      console.error('Error requesting reminder:', err);
    } finally {
      setRequestingReminder(false);
    }
  };

  // Editing & Deleting state for Registration
  const [editingRegistration, setEditingRegistration] = useState<RegistrationData | null>(null);
  const [deleteTargetRegistration, setDeleteTargetRegistration] = useState<RegistrationData | null>(null);
  const [isChangingSeats, setIsChangingSeats] = useState(false);
  const [isSavingReg, setIsSavingReg] = useState(false);
  const [isDeletingReg, setIsDeletingReg] = useState(false);
  const [regSuccessMsg, setRegSuccessMsg] = useState<string | null>(null);

  // Editing state for Intercession Progress
  const [intercessionProgressData, setIntercessionProgressData] = useState<{ [id: string]: Partial<IntercessionCommitmentRecord> }>({});
  const [savingIntercessionId, setSavingIntercessionId] = useState<string | null>(null);
  const [intercessionSuccessMsg, setIntercessionSuccessMsg] = useState<string | null>(null);

  // Digital Wallet Pass Modal State
  const [walletModalReg, setWalletModalReg] = useState<RegistrationData | null>(null);
  const [walletModalMember, setWalletModalMember] = useState<AttendeePassItem | null>(null);
  const [walletQrCodeUrl, setWalletQrCodeUrl] = useState<string>('');
  const [walletTab, setWalletTab] = useState<'apple' | 'google' | 'qr'>('apple');
  const [walletSavedNotice, setWalletSavedNotice] = useState<string | null>(null);

  const handleOpenWalletModal = (reg: RegistrationData, memberPass?: AttendeePassItem) => {
    setWalletModalReg(reg);
    setWalletModalMember(memberPass || null);
  };

  const getEffectiveWalletReg = (reg: RegistrationData): RegistrationData => {
    if (!walletModalMember) return reg;
    return {
      ...reg,
      id: walletModalMember.passId,
      name: walletModalMember.name,
      email: walletModalMember.email || reg.email,
      phone: walletModalMember.phone || reg.phone,
    };
  };

  // Generate QR code for wallet modal
  useEffect(() => {
    if (walletModalReg) {
      const passId = walletModalMember ? walletModalMember.passId : (walletModalReg.passId || getBibleVersePassId(getPersonDeterministicSeed(walletModalReg.email, walletModalReg.phone, walletModalReg.name) || walletModalReg.id, 0, walletModalReg.name));
      generateQRCodeDataURI(passId).then(uri => setWalletQrCodeUrl(uri));
    } else {
      setWalletQrCodeUrl('');
      setWalletSavedNotice(null);
    }
  }, [walletModalReg, walletModalMember]);

  const handleAddToAppleWallet = async (reg: RegistrationData) => {
    try {
      const targetReg = getEffectiveWalletReg(reg);
      const res = await downloadApplePKPass(targetReg);
      if (res.success) {
        setWalletSavedNotice('🍏 Opening Apple Wallet Pass...');
      } else if (res.reason === 'KEY_MISSING') {
        alert(
          `🍏 Apple Wallet Pass (.pkpass) Setup Required\n\n` +
          `To enable native 1-click Add to Apple Wallet on your Vercel deployment:\n\n` +
          `1. Sign up for a free API Key at https://walletwallet.dev\n` +
          `2. In Vercel Dashboard -> Settings -> Environment Variables, add:\n` +
          `   • Name: WALLETWALLETI_API_KEY\n` +
          `   • Value: <your-api-key>\n` +
          `3. Redeploy your project on Vercel.\n\n` +
          `In the meantime, tap "Save Pass Image (.png)" below to save your pass card to iPhone Photos or Files!`
        );
        setWalletSavedNotice('ℹ️ Tap "Save Pass Image (.png)" to save card to Photos/Files.');
      } else {
        alert('Unable to generate native .pkpass. Please tap "Save Pass Image (.png)" below to save your pass card.');
      }
    } catch (err) {
      console.error('Error generating Apple wallet pass:', err);
      setWalletSavedNotice('ℹ️ Tap "Save Pass Image (.png)" to save card.');
    }
    setTimeout(() => setWalletSavedNotice(null), 6000);
  };

  const handleAddToGoogleWallet = async (reg: RegistrationData) => {
    try {
      const targetReg = getEffectiveWalletReg(reg);
      openGoogleCalendarEvent(targetReg);
      await downloadWalletPassImage(targetReg);
      setWalletSavedNotice('🤖 Saved to Google Calendar & downloaded Mobile Wallet Pass PNG!');
    } catch (err) {
      console.error('Error generating Google wallet pass:', err);
      setWalletSavedNotice('🤖 Google Pass opened!');
    }
    setTimeout(() => setWalletSavedNotice(null), 5000);
  };

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      setLoadingAuth(false);
      if (user && user.email) {
        logPortalUserActivity({
          name: user.displayName || user.email.split('@')[0],
          email: user.email,
          phone: user.phoneNumber || '',
          action: 'Portal Session Authenticated',
          details: 'User session verified via Google Auth',
          loginMethod: 'Google OAuth'
        }).catch(err => console.warn('Failed to log portal user session:', err));

        loadUserParticipantData(user);
      }
    });
    return () => unsubscribe();
  }, []);

  // Verify Admin Permissions whenever activeEmail changes (Google OAuth, Email OTP, Pass ID, etc.)
  useEffect(() => {
    if (!activeEmail) {
      setIsAdminUser(false);
      return;
    }

    checkIsAdminApproved(activeEmail, false)
      .then((approved) => {
        setIsAdminUser(approved);
        if (approved && initialView === 'admin') {
          setPortalViewMode('admin');
        }
      })
      .catch((err) => {
        console.error('Error verifying admin permissions for active email:', err);
        setIsAdminUser(false);
      });
  }, [activeEmail, initialView]);

  // Real-time listener for instant check-in sync across Participant Pass view
  useEffect(() => {
    if (!activeUser || !activeUser.email) return;

    const unsub = subscribeToRegistrations((allRegs) => {
      const queryStr = (claimEmailQuery || '').trim().toLowerCase();
      const userEmail = (activeUser.email || '').trim().toLowerCase();
      const userName = (activeUser.displayName || '').trim().toLowerCase();
      const userPhone = activeUser.phoneNumber ? activeUser.phoneNumber.replace(/\D/g, '') : '';
      const userPassId = lookupUser?.passId ? lookupUser.passId.trim().toLowerCase() : '';

      const queryPhone = queryStr ? queryStr.replace(/\D/g, '') : '';
      const isPhoneQuery = queryPhone.length >= 8;

      const matchedRegs = allRegs.filter((r) => {
        const regEmail = (r.email || '').trim().toLowerCase();
        const primaryEmail = (r.primaryContactEmail || '').trim().toLowerCase();
        const regName = (r.name || '').trim().toLowerCase();
        const regPhone = (r.phone || '').replace(/\D/g, '');
        const primaryPhone = (r.primaryContactPhone || '').replace(/\D/g, '');
        const regPassId = (r.passId || '').trim().toLowerCase();
        const regPaymentRef = (r.paymentReference || '').trim().toLowerCase();
        const regDocId = (r.id || '').trim().toLowerCase();

        // Pass ID match
        const matchPassId = (userPassId && (regPassId === userPassId || regPaymentRef === userPassId || regDocId === userPassId || regPassId.includes(userPassId))) ||
          (queryStr && (
            regPassId === queryStr || 
            regPaymentRef === queryStr || 
            regDocId === queryStr ||
            regPassId.includes(queryStr) ||
            queryStr.includes(regPassId)
          ));

        const matchDirectEmail = (userEmail && (regEmail === userEmail || primaryEmail === userEmail)) ||
          (queryStr && !isPhoneQuery && (regEmail === queryStr || primaryEmail === queryStr || matchPassId));

        const matchPhone = (isPhoneQuery && (
          (regPhone && (regPhone === queryPhone || regPhone.endsWith(queryPhone) || queryPhone.endsWith(regPhone))) ||
          (primaryPhone && (primaryPhone === queryPhone || primaryPhone.endsWith(queryPhone) || queryPhone.endsWith(primaryPhone)))
        )) || (userPhone && (
          (regPhone && (regPhone === userPhone || regPhone.endsWith(userPhone) || userPhone.endsWith(regPhone))) ||
          (primaryPhone && (primaryPhone === userPhone || primaryPhone.endsWith(userPhone) || userPhone.endsWith(primaryPhone)))
        ));

        const matchName = userName && regName === userName;

        const matchAttendee = r.additionalAttendees?.some(a => {
          const aEmail = (a.email || '').trim().toLowerCase();
          const aName = (a.name || '').trim().toLowerCase();
          const aPhone = (a.phone || '').replace(/\D/g, '');
          const aPassId = (a.passId || '').trim().toLowerCase();

          return (userEmail && aEmail === userEmail) ||
                 (queryStr && !isPhoneQuery && (aEmail === queryStr || (aPassId && (aPassId === queryStr || queryStr.includes(aPassId) || aPassId.includes(queryStr))))) ||
                 (userName && aName === userName) ||
                 (isPhoneQuery && aPhone && (aPhone === queryPhone || aPhone.endsWith(queryPhone) || queryPhone.endsWith(aPhone)));
        });

        return matchDirectEmail || matchPhone || matchName || matchAttendee || matchPassId;
      });

      const primaryContactIds = new Set(
        matchedRegs.filter(r => !r.isAdditionalAttendee && r.id).map(r => r.id!)
      );

      const nonRedundant = matchedRegs.filter(r => {
        if (r.isAdditionalAttendee && r.primaryContactId && primaryContactIds.has(r.primaryContactId)) {
          return false;
        }
        return true;
      });

      setUserRegistrations(nonRedundant);
    });

    return () => unsub();
  }, [activeUser, claimEmailQuery, lookupUser]);

  // Fetch participant records matching email, phone, name, or Pass ID
  const loadUserParticipantData = async (user: User | any, customSearchQuery?: string) => {
    setLoadingData(true);
    try {
      const queryStr = (customSearchQuery || '').trim().toLowerCase();
      const userEmail = (user?.email || '').trim().toLowerCase();
      const userName = (user?.displayName || '').trim().toLowerCase();
      const userPhone = user?.phoneNumber ? user.phoneNumber.replace(/\D/g, '') : '';
      const userPassId = lookupUser?.passId ? lookupUser.passId.trim().toLowerCase() : '';

      const queryPhone = queryStr ? queryStr.replace(/\D/g, '') : '';
      const isPhoneQuery = queryPhone.length >= 8;

      // Fetch all registrations
      const allRegs = await fetchAllRegistrations();
      const matchedRegs = allRegs.filter((r) => {
        const regEmail = (r.email || '').trim().toLowerCase();
        const primaryEmail = (r.primaryContactEmail || '').trim().toLowerCase();
        const regName = (r.name || '').trim().toLowerCase();
        const regPhone = (r.phone || '').replace(/\D/g, '');
        const primaryPhone = (r.primaryContactPhone || '').replace(/\D/g, '');
        const regPassId = (r.passId || '').trim().toLowerCase();
        const regPaymentRef = (r.paymentReference || '').trim().toLowerCase();
        const regDocId = (r.id || '').trim().toLowerCase();

        // Pass ID match
        const matchPassId = (userPassId && (regPassId === userPassId || regPaymentRef === userPassId || regDocId === userPassId || regPassId.includes(userPassId))) ||
          (queryStr && (
            regPassId === queryStr || 
            regPaymentRef === queryStr || 
            regDocId === queryStr ||
            regPassId.includes(queryStr) ||
            queryStr.includes(regPassId)
          ));

        // Email match
        const matchDirectEmail = (userEmail && (regEmail === userEmail || primaryEmail === userEmail)) ||
          (queryStr && !isPhoneQuery && (regEmail === queryStr || primaryEmail === queryStr || matchPassId));

        // Phone match
        const matchPhone = (isPhoneQuery && (
          (regPhone && (regPhone === queryPhone || regPhone.endsWith(queryPhone) || queryPhone.endsWith(regPhone))) ||
          (primaryPhone && (primaryPhone === queryPhone || primaryPhone.endsWith(queryPhone) || queryPhone.endsWith(primaryPhone)))
        )) || (userPhone && (
          (regPhone && (regPhone === userPhone || regPhone.endsWith(userPhone) || userPhone.endsWith(regPhone))) ||
          (primaryPhone && (primaryPhone === userPhone || primaryPhone.endsWith(userPhone) || userPhone.endsWith(primaryPhone)))
        ));

        // Name match
        const matchName = userName && regName === userName;

        // Additional attendees match
        const matchAttendee = r.additionalAttendees?.some(a => {
          const aEmail = (a.email || '').trim().toLowerCase();
          const aName = (a.name || '').trim().toLowerCase();
          const aPhone = (a.phone || '').replace(/\D/g, '');
          const aPassId = (a.passId || '').trim().toLowerCase();

          return (userEmail && aEmail === userEmail) ||
                 (queryStr && !isPhoneQuery && (aEmail === queryStr || (aPassId && (aPassId === queryStr || queryStr.includes(aPassId) || aPassId.includes(queryStr))))) ||
                 (userName && aName === userName) ||
                 (isPhoneQuery && aPhone && (aPhone === queryPhone || aPhone.endsWith(queryPhone) || queryPhone.endsWith(aPhone)));
        });

        return matchDirectEmail || matchPhone || matchName || matchAttendee || matchPassId;
      });

      // Intelligent Deduplication of Registrations
      // 1. Identify primary contact registration IDs present in results
      const primaryContactIds = new Set(
        matchedRegs.filter(r => !r.isAdditionalAttendee && r.id).map(r => r.id!)
      );

      // 2. Filter out synthesized child attendee docs IF their parent registration is already present
      // (The parent registration card already renders all member passes via RegistrationMembersPasses)
      const nonRedundant = matchedRegs.filter(r => {
        if (r.isAdditionalAttendee && r.primaryContactId && primaryContactIds.has(r.primaryContactId)) {
          return false;
        }
        return true;
      });

      // 3. Deduplicate multiple identical registration records (e.g. duplicate submissions or identical pass IDs)
      const deduplicatedRegs: RegistrationData[] = [];
      const seenPassKeys = new Set<string>();
      const seenPersonKeys = new Set<string>();

      for (const reg of nonRedundant) {
        const typeKey = reg.type || 'conference';
        const passKey = reg.passId ? `pass_${reg.passId}` : '';
        const idKey = reg.id ? `id_${reg.id}` : '';
        const normEmail = (reg.email || '').trim().toLowerCase();
        const normName = (reg.name || '').trim().toLowerCase();
        const personKey = `${normEmail}_${normName}_${typeKey}`;

        // If exact pass ID or document ID already seen, skip
        if (passKey && seenPassKeys.has(passKey)) continue;
        if (idKey && seenPassKeys.has(idKey)) continue;

        // If duplicate submission exists for the exact same person and event type
        if (personKey && seenPersonKeys.has(personKey)) {
          const existingIdx = deduplicatedRegs.findIndex(r => 
            `${(r.email || '').trim().toLowerCase()}_${(r.name || '').trim().toLowerCase()}_${r.type || 'conference'}` === personKey
          );
          if (existingIdx >= 0) {
            const existing = deduplicatedRegs[existingIdx];
            const existingScore = (existing.additionalAttendees?.length || 0) + (existing.selectedSeats?.length || 0) + (existing.checkedIn ? 10 : 0);
            const currentScore = (reg.additionalAttendees?.length || 0) + (reg.selectedSeats?.length || 0) + (reg.checkedIn ? 10 : 0);
            if (currentScore > existingScore) {
              deduplicatedRegs[existingIdx] = reg;
            }
          }
          continue;
        }

        if (passKey) seenPassKeys.add(passKey);
        if (idKey) seenPassKeys.add(idKey);
        if (personKey) seenPersonKeys.add(personKey);
        deduplicatedRegs.push(reg);
      }

      setUserRegistrations(deduplicatedRegs);

      // Fetch all intercessions
      const allIntercessions = await getAllIntercessionCommitments();
      const matchedIntercessions = allIntercessions.filter((i) => {
        const iEmail = (i.email || '').trim().toLowerCase();
        const iName = (i.name || '').trim().toLowerCase();
        const iPhone = (i.phone || '').replace(/\D/g, '');

        const matchEmail = (userEmail && iEmail === userEmail) || (queryStr && !isPhoneQuery && iEmail === queryStr);
        const matchPhone = (isPhoneQuery && iPhone && (iPhone === queryPhone || iPhone.endsWith(queryPhone) || queryPhone.endsWith(iPhone))) ||
                           (userPhone && iPhone && (iPhone === userPhone || iPhone.endsWith(userPhone) || userPhone.endsWith(iPhone)));
        const matchName = userName && iName === userName;

        return matchEmail || matchPhone || matchName;
      });

      setUserIntercessions(matchedIntercessions);

      // Initialize progress data map for intercessions
      const progressMap: { [id: string]: Partial<IntercessionCommitmentRecord> } = {};
      matchedIntercessions.forEach((rec) => {
        if (rec.id) {
          progressMap[rec.id] = { ...rec };
        }
      });
      setIntercessionProgressData(progressMap);

      // Auto-set tab based on findings
      if (matchedRegs.length === 0 && matchedIntercessions.length > 0) {
        setActivePortalTab('intercessions');
      } else {
        setActivePortalTab('conference');
      }
    } catch (err) {
      console.error('Error loading participant data:', err);
    } finally {
      setLoadingData(false);
    }
  };

  // Pass ID Direct Authentication Lookup
  const handlePassIdLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPassId = lookupPassId.trim();
    const cleanEmail = lookupEmail.trim().toLowerCase();

    if (!cleanPassId) {
      setLookupError('Please enter your Pass ID / Reference Number.');
      return;
    }

    if (enableEmailLogin && !cleanEmail) {
      setLookupError('Please enter your registered email address.');
      return;
    }

    setIsSearchingPass(true);
    setLookupError(null);

    try {
      const reg = await fetchRegistrationByPassIdOrDocId(cleanPassId);
      if (!reg) {
        setLookupError('No registration found matching Pass ID "' + cleanPassId + '". Please check your Pass ID.');
        setIsSearchingPass(false);
        return;
      }

      if (enableEmailLogin && cleanEmail) {
        const regEmail = (reg.email || '').trim().toLowerCase();
        const primaryEmail = (reg.primaryContactEmail || '').trim().toLowerCase();
        const matchesEmail = regEmail === cleanEmail || primaryEmail === cleanEmail ||
          reg.additionalAttendees?.some(a => (a.email || '').trim().toLowerCase() === cleanEmail);

        if (!matchesEmail) {
        setLookupError('The email "' + cleanEmail + '" does not match the registered record for Pass ID "' + cleanPassId + '".');
          setIsSearchingPass(false);
          return;
        }
      }

      const activeAuthEmail = cleanEmail || reg.email || reg.primaryContactEmail || 'participant@gracia.sg';

      const tempUser = {
        email: activeAuthEmail,
        displayName: reg.name || 'GRACIA Participant',
        phoneNumber: reg.phone || '',
        photoURL: null
      };

      setLookupUser({
        email: activeAuthEmail,
        displayName: reg.name || 'GRACIA Participant',
        passId: cleanPassId
      });

      await loadUserParticipantData(tempUser, cleanPassId);

      logPortalUserActivity({
        name: reg.name || 'Participant',
        email: activeAuthEmail,
        phone: reg.phone || '',
        action: 'Pass ID Authentication',
        details: 'Authenticated via Pass ID: ' + cleanPassId,
        loginMethod: enableEmailLogin ? 'Pass ID & Email' : 'Pass ID Direct'
      }).catch(err => console.warn('Failed to log portal user session:', err));

    } catch (err) {
      console.error('Error during Pass ID portal lookup:', err);
      setLookupError('An unexpected error occurred during pass lookup. Please try again.');
    } finally {
      setIsSearchingPass(false);
    }
  };

  // Direct Registered Email Portal Lookup
  const handleEmailOnlyLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = lookupEmail.trim().toLowerCase();

    if (!cleanEmail) {
      setLookupError('Please enter your registered email address.');
      return;
    }

    setIsSearchingPass(true);
    setLookupError(null);

    try {
      const tempUser = {
        email: cleanEmail,
        displayName: 'GRACIA Participant',
        phoneNumber: '',
        photoURL: null
      };

      setLookupUser({
        email: cleanEmail,
        displayName: 'GRACIA Participant'
      });

      await loadUserParticipantData(tempUser, cleanEmail);

      logPortalUserActivity({
        name: 'Participant',
        email: cleanEmail,
        phone: '',
        action: 'Email Portal Authentication',
        details: 'Authenticated via Registered Email: ' + cleanEmail,
        loginMethod: 'Registered Email'
      }).catch(err => console.warn('Failed to log portal user session:', err));

    } catch (err) {
      console.error('Error during email portal lookup:', err);
      setLookupError('An unexpected error occurred during email lookup. Please try again.');
    } finally {
      setIsSearchingPass(false);
    }
  };

  // Google Login Action
  const handleGoogleSignIn = async () => {
    setLoginError(null);
    try {
      const loggedUser = await loginWithGoogle();
      if (loggedUser) {
        setCurrentUser(loggedUser);
        setLookupUser(null);
        await loadUserParticipantData(loggedUser);
      }
    } catch (err: any) {
      console.error('Login error:', err);
      setLoginError(err?.message || 'Failed to sign in with Google. Please try again.');
    }
  };

  // Logout Action
  const handleSignOut = async () => {
    await logoutUser();
    setCurrentUser(null);
    setLookupUser(null);
    setUserRegistrations([]);
    setUserIntercessions([]);
    // Clear all login input fields and states on signout
    setCodeEmail('');
    setCodeInput('');
    setCodeSent(false);
    setCodeError(null);
    setCodeSuccessNotice(null);
    setLookupEmail('');
    setLookupPassId('');
    setLookupError(null);
    setLoginError(null);
  };

  // Custom Search Query (Pass ID, Email, Phone)
  const handleSearchByEmail = (e: React.FormEvent) => {
    e.preventDefault();
    if (activeUser && claimEmailQuery.trim()) {
      loadUserParticipantData(activeUser, claimEmailQuery.trim());
    }
  };

  // Registration Edit Actions
  const handleStartEditRegistration = (reg: RegistrationData) => {
    setEditingRegistration({ ...reg });
    setIsChangingSeats(false);
  };

  const handleSaveRegistrationEdit = async () => {
    if (!editingRegistration || !editingRegistration.id) return;
    setIsSavingReg(true);
    setRegSuccessMsg(null);

    try {
      const { id, ...dataToSave } = editingRegistration;
      const success = await updateRegistrationInFirestore(id, dataToSave);
      if (success) {
        setUserRegistrations(prev => prev.map(r => r.id === id ? editingRegistration : r));
        if (currentUser) {
          loadUserParticipantData(currentUser, editingRegistration.email);
        }
        setRegSuccessMsg('Registration details updated successfully!');
        setTimeout(() => setRegSuccessMsg(null), 4000);
        setEditingRegistration(null);
        setIsChangingSeats(false);
      } else {
        alert('Failed to update registration in database.');
      }
    } catch (err) {
      console.error('Error updating registration:', err);
      alert('An error occurred while saving changes.');
    } finally {
      setIsSavingReg(false);
    }
  };

  const handleDeleteRegistration = async () => {
    if (!deleteTargetRegistration || !deleteTargetRegistration.id) return;
    setIsDeletingReg(true);
    const targetId = deleteTargetRegistration.id;

    try {
      // Optimistically update local registrations state
      setUserRegistrations(prev => prev.filter(r => r.id !== targetId));

      try {
        await deleteRegistrationFromFirestore(targetId);
      } catch (err) {
        console.warn('Firestore delete warning in portal:', err);
      }

      setRegSuccessMsg('Registration deleted successfully.');
      setTimeout(() => setRegSuccessMsg(null), 4000);
      setDeleteTargetRegistration(null);
    } catch (err) {
      console.error('Error deleting registration:', err);
    } finally {
      setIsDeletingReg(false);
    }
  };

  // Auto-Save Intercession Progress to Firestore
  const autoSaveIntercessionRecord = async (recId: string, recData: IntercessionCommitmentRecord) => {
    if (!recId || !recData) return;

    setSavingIntercessionId(recId);

    try {
      const updates = {
        name: recData.name || currentUser?.displayName || 'Participant',
        email: recData.email || currentUser?.email || '',
        phone: recData.phone || '',
        createdAt: recData.createdAt || new Date().toISOString(),
        completedHolyMass: Number(recData.completedHolyMass) || 0,
        completedAdoration: Number(recData.completedAdoration) || 0,
        completedDecadeRosary: Number(recData.completedDecadeRosary) || 0,
        completedRosary: Number(recData.completedRosary) || 0,
        completedDivineMercy: Number(recData.completedDivineMercy) || 0,
        completedFastMeal: Number(recData.completedFastMeal) || 0,
        completedAbstainMeat: Number(recData.completedAbstainMeat) || 0,
        completedShortPrayers: Number(recData.completedShortPrayers) || 0,
        holyMass: Number(recData.holyMass) || 0,
        adoration: Number(recData.adoration) || 0,
        decadeRosary: Number(recData.decadeRosary) || 0,
        rosary: Number(recData.rosary) || 0,
        divineMercy: Number(recData.divineMercy) || 0,
        fastMeal: Number(recData.fastMeal) || 0,
        abstainMeat: Number(recData.abstainMeat) || 0,
        shortPrayers: Number(recData.shortPrayers) || 0,
        itemLastUpdated: recData.itemLastUpdated || {},
        updatedAt: new Date().toISOString()
      };

      const success = await updateIntercessionCommitment(recId, updates);
      if (success) {
        setUserIntercessions(prev => prev.map(i => i.id === recId ? { ...i, ...updates } : i));
      }
    } catch (err) {
      console.error('Error auto-saving intercession progress:', err);
    } finally {
      setSavingIntercessionId(null);
    }
  };

  // Intercession Progress Increment / Decrement
  const handleUpdateIntercessionCount = (
    recId: string, 
    field: keyof IntercessionTotals, 
    delta: number
  ) => {
    const current = intercessionProgressData[recId] || {};
    const completedKey = `completed${field.charAt(0).toUpperCase() + field.slice(1)}` as keyof IntercessionCommitmentRecord;
    const currentVal = Number(current[completedKey] || 0);
    const newVal = Math.max(0, currentVal + delta);
    const nowIso = new Date().toISOString();

    const updated = {
      ...current,
      [completedKey]: newVal,
      itemLastUpdated: {
        ...(current.itemLastUpdated || {}),
        [field]: nowIso
      }
    };

    setIntercessionProgressData(prev => ({
      ...prev,
      [recId]: updated
    }));

    autoSaveIntercessionRecord(recId, updated as any);
  };

  const handleDirectSetIntercessionCount = (
    recId: string, 
    field: keyof IntercessionTotals, 
    valStr: string
  ) => {
    const num = Math.max(0, parseInt(valStr, 10) || 0);
    const current = intercessionProgressData[recId] || {};
    const completedKey = `completed${field.charAt(0).toUpperCase() + field.slice(1)}` as keyof IntercessionCommitmentRecord;
    const nowIso = new Date().toISOString();

    const updated = {
      ...current,
      [completedKey]: num,
      itemLastUpdated: {
        ...(current.itemLastUpdated || {}),
        [field]: nowIso
      }
    };

    setIntercessionProgressData(prev => ({
      ...prev,
      [recId]: updated
    }));

    autoSaveIntercessionRecord(recId, updated as any);
  };

  return (
    <div className={`mx-auto px-3 sm:px-6 py-8 space-y-8 transition-all duration-300 ${portalViewMode === 'admin' ? 'w-full max-w-[96vw] xl:max-w-[1850px] 2xl:max-w-[1920px]' : 'max-w-6xl'}`}>
      
      {/* Header Title Banner */}
      <div className="text-center space-y-4 relative py-2">
        <h1 className="font-poster text-4xl sm:text-5xl lg:text-6xl tracking-wider text-white uppercase drop-shadow-2xl">
          PARTICIPANT <span className="text-signature-animated">SELF-SERVICE PORTAL</span>
        </h1>
        
        <p className="text-sm sm:text-base text-purple-200/80 max-w-2xl mx-auto leading-relaxed font-normal">
          Sign in with your Google account to view and update your GRACIA Jubilee Conference registration, Musical Concert tickets, and intercession prayer commitments.
        </p>

        <div className="w-24 h-1 bg-gradient-to-r from-transparent via-amber-400/40 to-transparent mx-auto rounded-full mt-2" />
      </div>

      {/* LOGIN / AUTHENTICATION CARD IF NOT LOGGED IN */}
      {!activeUser && !loadingAuth && (
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-xl mx-auto bg-gradient-to-br from-[#241226]/90 via-[#1c0d1e]/95 to-[#120716] border border-amber-500/30 rounded-3xl p-8 text-center shadow-2xl space-y-6 relative overflow-hidden"
        >
          <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-300 shadow-inner">
            <UserIcon className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-white font-serif">Attendee Portal Access</h2>
            <p className="text-xs sm:text-sm text-white/70 leading-relaxed px-4">
              Sign in with your Google account or enter your registered email address to receive a 6-digit verification code.
            </p>
          </div>

          {loginError && (
            <div className="p-3 rounded-xl bg-red-500/20 border border-red-500/40 text-red-200 text-xs flex items-center gap-2 text-left">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{loginError}</span>
            </div>
          )}

          {/* Option 1: Google OAuth Login */}
          {shouldShowGoogleLogin && (
            <div className="space-y-2">
              <button
                type="button"
                onClick={handleGoogleSignIn}
                className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 font-bold text-sm shadow-xl shadow-amber-500/20 transition-all transform hover:-translate-y-0.5 flex items-center justify-center space-x-3 group cursor-pointer"
              >
                <svg className="w-5 h-5 bg-white rounded-full p-0.5 shadow-sm shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                </svg>
                <span>Continue with Google</span>
              </button>
            </div>
          )}

          {/* DIVIDER */}
          {shouldShowGoogleLogin && shouldShowEmailCodeLogin && (
            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-amber-500/20"></div>
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-[#1c0d1e] px-3 text-amber-300/80 font-mono font-bold tracking-widest text-[10px]">
                  OR LOGIN WITH EMAIL CODE
                </span>
              </div>
            </div>
          )}

          {/* Option 2: Email Confirmation Code (OTP) Login */}
          {shouldShowEmailCodeLogin && (
            <div className="space-y-3.5 text-left bg-[#130915]/80 p-5 rounded-2xl border border-emerald-500/30 relative shadow-xl">
              <div className="flex items-center justify-between border-b border-white/10 pb-2.5 mb-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-300 shrink-0">
                    <MailCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-extrabold text-white uppercase tracking-wider">Email Confirmation Code Login</h3>
                    <p className="text-[10px] text-emerald-300/80">Log in with a unique 6-digit verification code</p>
                  </div>
                </div>
                {codeSent && (
                  <button
                    type="button"
                    onClick={handleResetCodeLogin}
                    className="text-[10px] text-amber-300 hover:underline flex items-center gap-1 cursor-pointer shrink-0"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Change Email</span>
                  </button>
                )}
              </div>

              {codeError && (
                <div className="p-3 rounded-xl bg-red-500/20 border border-red-500/40 text-red-200 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                  <span>{codeError}</span>
                </div>
              )}

              {codeSuccessNotice && (
                <div className="p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 text-xs flex items-center gap-2 font-bold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{codeSuccessNotice}</span>
                </div>
              )}

              {!codeSent ? (
                // Step 1: Input registered email address & validate
                <form onSubmit={handleSendConfirmationCode} className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-emerald-300 uppercase tracking-wider block">
                      Registered Email Address
                    </label>
                    <input
                      type="email"
                      value={codeEmail}
                      onChange={(e) => setCodeEmail(e.target.value)}
                      placeholder="e.g. attendee@example.com"
                      className="w-full px-4 py-2.5 rounded-xl bg-black/50 border border-emerald-500/30 text-white placeholder-white/30 text-xs font-mono focus:outline-none focus:border-emerald-400 transition-colors"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSendingCode}
                    className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-xs uppercase tracking-wider shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {isSendingCode ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Validating Email...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4 text-emerald-300" />
                        <span>Send Confirmation Code</span>
                      </>
                    )}
                  </button>
                </form>
              ) : (
                // Step 2 & 3: Input confirmation code and log in
                <form onSubmit={handleVerifyConfirmationCode} className="space-y-3">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-bold text-amber-300 uppercase tracking-wider block">
                        Enter Confirmation Code
                      </label>
                      <span className="text-[10px] text-white/60 font-mono">Sent to {codeEmail}</span>
                    </div>
                    <div className="relative">
                      <input
                        type="text"
                        maxLength={6}
                        value={codeInput}
                        onChange={(e) => setCodeInput(e.target.value.replace(/\D/g, ''))}
                        placeholder="123456"
                        className="w-full px-4 py-3 rounded-xl bg-black/60 border border-amber-500/40 text-amber-300 placeholder-white/20 text-center font-mono font-black text-xl tracking-[0.4em] focus:outline-none focus:border-amber-400 transition-colors"
                        required
                        autoFocus
                      />
                      <Lock className="w-4 h-4 text-amber-400/50 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleSendConfirmationCode}
                      disabled={isSendingCode}
                      className="py-3 px-3 rounded-xl bg-white/10 hover:bg-white/15 text-white/80 font-bold text-xs transition-all flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
                      title="Resend code"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isSendingCode ? 'animate-spin' : ''}`} />
                      <span>Resend</span>
                    </button>

                    <button
                      type="submit"
                      disabled={isSearchingPass}
                      className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 font-extrabold text-xs uppercase tracking-wider shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {isSearchingPass ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Verifying Code...</span>
                        </>
                      ) : (
                        <>
                          <LogIn className="w-4 h-4" />
                          <span>Verify & Login to Portal</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* Option B: Pass ID Authentication Form (Strictly visible ONLY for Super Admin) */}
          {shouldShowPassIdLogin && (
            <form onSubmit={handlePassIdLookup} className="space-y-3.5 text-left bg-[#130915]/80 p-5 rounded-2xl border border-purple-500/40 shadow-lg relative">
              <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-2">
                <div className="flex items-center gap-2">
                  <Key className="w-4 h-4 text-purple-300" />
                  <span className="text-xs font-bold text-white uppercase tracking-wider">Pass ID Authentication</span>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase bg-purple-500/20 text-purple-300 border border-purple-500/40">Super Admin Only</span>
              </div>

              {lookupError && (
                <div className="p-3 rounded-xl bg-red-500/20 border border-red-500/40 text-red-200 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                  <span>{lookupError}</span>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs font-bold text-amber-300 uppercase tracking-wider block">
                  Pass ID / Reference Number
                </label>
                <input
                  type="text"
                  value={lookupPassId}
                  onChange={(e) => setLookupPassId(e.target.value)}
                  placeholder="e.g. GRACIA-SIJU-ROM-13:8"
                  className="w-full px-4 py-2.5 rounded-xl bg-black/50 border border-amber-500/30 text-white placeholder-white/30 text-xs font-mono focus:outline-none focus:border-amber-400 transition-colors"
                  required
                />
              </div>

              {/* Email Input conditionally rendered based on enableEmailLogin */}
              {enableEmailLogin && (
                <div className="space-y-1">
                  <label className="text-xs font-bold text-amber-300 uppercase tracking-wider block">
                    Registered Email Address
                  </label>
                  <input
                    type="email"
                    value={lookupEmail}
                    onChange={(e) => setLookupEmail(e.target.value)}
                    placeholder="e.g. attendee@example.com"
                    className="w-full px-4 py-2.5 rounded-xl bg-black/50 border border-amber-500/30 text-white placeholder-white/30 text-xs font-mono focus:outline-none focus:border-amber-400 transition-colors"
                    required
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={isSearchingPass}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs uppercase tracking-wider shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isSearchingPass ? (
                  <span>Verifying Pass ID...</span>
                ) : (
                  <>
                    <Key className="w-4 h-4 text-amber-300" />
                    <span>Authenticate & Access Digital Pass</span>
                  </>
                )}
              </button>
            </form>
          )}

          {/* Option C: Direct Email Lookup (Only when Pass ID & Email Code are disabled AND Email Login is enabled) */}
          {!enablePassIdLogin && !enableEmailCodeLogin && enableEmailLogin && (
            <form onSubmit={handleEmailOnlyLookup} className="space-y-3.5 text-left bg-[#130915]/80 p-5 rounded-2xl border border-amber-500/20">
              {lookupError && (
                <div className="p-3 rounded-xl bg-red-500/20 border border-red-500/40 text-red-200 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                  <span>{lookupError}</span>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs font-bold text-amber-300 uppercase tracking-wider block">
                  Registered Email Address
                </label>
                <input
                  type="email"
                  value={lookupEmail}
                  onChange={(e) => setLookupEmail(e.target.value)}
                  placeholder="e.g. attendee@example.com"
                  className="w-full px-4 py-2.5 rounded-xl bg-black/50 border border-amber-500/30 text-white placeholder-white/30 text-xs font-mono focus:outline-none focus:border-amber-400 transition-colors"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={isSearchingPass}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-bold text-xs uppercase tracking-wider shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isSearchingPass ? (
                  <span>Searching Registrations...</span>
                ) : (
                  <>
                    <Mail className="w-4 h-4 text-amber-300" />
                    <span>Locate Pass via Registered Email</span>
                  </>
                )}
              </button>
            </form>
          )}

          {/* Super Admin Access Toggle Link */}
          {(googleLoginSuperAdminOnly || enablePassIdLogin) && (
            <div className="pt-1 text-center">
              <button
                type="button"
                onClick={() => setShowSuperAdminControls(!showSuperAdminControls)}
                className="text-xs text-amber-300/80 hover:text-amber-300 underline font-mono cursor-pointer transition-colors inline-flex items-center gap-1.5"
              >
                <Shield className="w-3.5 h-3.5 text-amber-400" />
                <span>{showSuperAdminControls ? 'Hide Super Admin Options' : 'Super Admin Login Options (Google / Pass ID)'}</span>
              </button>
            </div>
          )}

          <div className="pt-4 border-t border-white/10 text-xs text-white/50 flex items-center justify-center gap-4">
            <span className="flex items-center gap-1"><Ticket className="w-3.5 h-3.5 text-amber-400" /> Registrations</span>
            <span>•</span>
            <span className="flex items-center gap-1"><Music className="w-3.5 h-3.5 text-pink-400" /> Concert Tickets</span>
            <span>•</span>
            <span className="flex items-center gap-1"><Church className="w-3.5 h-3.5 text-sky-400" /> Intercession Progress</span>
          </div>
        </motion.div>
      )}

      {/* LOGGED IN CONTENT */}
      {activeUser && (
        <div className="space-y-6">
          
          {/* Admin Rights Banner for Authorized Organizers */}
          {isAdminUser && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gradient-to-r from-[#2A163D] via-[#3B1A58] to-[#1B0F2B] border-2 border-amber-500/50 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl"
            >
              <div className="flex items-center gap-3 text-center sm:text-left">
                <div className="p-3 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/40 shrink-0">
                  <Shield className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center justify-center sm:justify-start gap-2">
                    <span className="font-bold text-white text-base font-serif">Organizer Admin Access Granted</span>
                    <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                      Approved Admin
                    </span>
                  </div>
                  <p className="text-xs text-amber-200/80 mt-0.5">
                    Logged in as <strong className="text-white">{activeUser.email}</strong>. Access participant records, check-in scanner, message center, and admin settings.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 bg-black/40 p-1.5 rounded-xl border border-white/10 shrink-0 w-full sm:w-auto justify-center">
                <button
                  type="button"
                  onClick={() => setPortalViewMode('participant')}
                  className={`px-4 py-2 rounded-lg font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                    portalViewMode === 'participant'
                      ? 'bg-amber-500 text-slate-950 shadow-md'
                      : 'text-white/70 hover:text-white'
                  }`}
                >
                  <UserIcon className="w-3.5 h-3.5" />
                  <span>My Participant Portal</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPortalViewMode('admin')}
                  className={`px-4 py-2 rounded-lg font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                    portalViewMode === 'admin'
                      ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-md'
                      : 'text-white/70 hover:text-white'
                  }`}
                >
                  <Shield className="w-3.5 h-3.5" />
                  <span>Organizer Admin Panel</span>
                </button>
              </div>
            </motion.div>
          )}

          {/* User Profile Bar */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 sm:p-6 flex flex-col sm:flex-row items-center justify-between gap-4 backdrop-blur-xl shadow-lg">
            <div className="flex items-center space-x-4 text-center sm:text-left">
              {activeUser.photoURL ? (
                <img 
                  src={activeUser.photoURL} 
                  alt={activeUser.displayName || 'User'} 
                  className="w-14 h-14 rounded-full border-2 border-amber-400/60 shadow-md shrink-0"
                />
              ) : (
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-amber-500 to-amber-700 text-slate-950 font-bold text-xl flex items-center justify-center border-2 border-amber-400/60 shadow-md shrink-0">
                  {(activeUser.displayName || activeUser.email || 'U').charAt(0).toUpperCase()}
                </div>
              )}
              <div>
                <h3 className="text-lg font-bold text-white font-serif">{activeUser.displayName || 'GRACIA Participant'}</h3>
                <p className="text-xs sm:text-sm text-amber-300/90 font-mono">{activeUser.email}</p>
                <div className="flex items-center gap-2 mt-1 text-[11px] text-white/60">
                  <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span>{lookupUser ? `Authenticated via Pass ID (${lookupUser.passId})` : 'Verified Google Account'}</span>
                  {isAdminUser && (
                    <>
                      <span>•</span>
                      <span className="text-amber-300 font-bold flex items-center gap-1"><Shield className="w-3 h-3" /> Admin Authorized</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => loadUserParticipantData(activeUser, claimEmailQuery)}
                disabled={loadingData}
                className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white/90 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Refresh My Records"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingData ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>

              <button
                onClick={handleSignOut}
                className="px-4 py-2 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-200 border border-red-500/30 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>

          {/* RENDER ADMIN PANEL IF ADMIN MODE SELECTED */}
          {portalViewMode === 'admin' && isAdminUser ? (
            <div className="space-y-4">
              <AdminPanel 
                onClose={() => setPortalViewMode('participant')} 
                currentUserEmail={activeEmail}
                currentUserName={activeUser?.displayName}
              />
            </div>
          ) : (
            <div className="space-y-6">
              {/* Quick Email / Pass ID Search Bar */}
              <form onSubmit={handleSearchByEmail} className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2 text-amber-200">
                  <Search className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Search or claim matching registrations by Pass ID or Email:</span>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <input
                    type="text"
                    value={claimEmailQuery}
                    onChange={(e) => setClaimEmailQuery(e.target.value)}
                    placeholder="Enter Pass ID (e.g. GRACIA-SIJU-ROM-13:8) or email"
                    className="px-3 py-1.5 rounded-xl bg-black/40 border border-amber-500/30 text-white placeholder-white/40 text-xs w-full sm:w-72 focus:outline-none focus:border-amber-400 font-mono"
                  />
                  <button
                    type="submit"
                    disabled={loadingData}
                    className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold transition-colors shrink-0 cursor-pointer"
                  >
                    Search
                  </button>
                </div>
              </form>

              {/* PORTAL NAV TABS */}
              <div className="flex flex-wrap border-b border-white/10 gap-2">
                <button
                  onClick={() => {
                    setPortalViewMode('participant');
                    setActivePortalTab('conference');
                  }}
                  className={`px-5 py-3 rounded-t-xl font-bold text-sm flex items-center gap-2 transition-all ${
                    portalViewMode === 'participant' && activePortalTab === 'conference'
                      ? 'bg-amber-500 text-slate-950 shadow-lg'
                      : 'bg-white/5 text-white/70 hover:bg-white/10'
                  }`}
                >
                  <Ticket className="w-4 h-4" />
                  <span>Conference Pass ({userRegistrations.filter(r => r.type !== 'musical').length})</span>
                </button>

                <button
                  onClick={() => {
                    setPortalViewMode('participant');
                    setActivePortalTab('musical');
                  }}
                  className={`px-5 py-3 rounded-t-xl font-bold text-sm flex items-center gap-2 transition-all ${
                    portalViewMode === 'participant' && activePortalTab === 'musical'
                      ? 'bg-pink-600 text-white shadow-lg'
                      : 'bg-white/5 text-white/70 hover:bg-white/10'
                  }`}
                >
                  <Music className="w-4 h-4" />
                  <span>Musical Concert ({userRegistrations.filter(r => r.type === 'musical').length})</span>
                </button>

                <button
                  onClick={() => {
                    setPortalViewMode('participant');
                    setActivePortalTab('intercessions');
                  }}
                  className={`px-5 py-3 rounded-t-xl font-bold text-sm flex items-center gap-2 transition-all ${
                    portalViewMode === 'participant' && activePortalTab === 'intercessions'
                      ? 'bg-amber-500 text-slate-950 shadow-lg'
                      : 'bg-white/5 text-white/70 hover:bg-white/10'
                  }`}
                >
                  <Church className="w-4 h-4" />
                  <span>Intercession Commitments ({userIntercessions.length})</span>
                </button>

                {isAdminUser && (
                  <button
                    onClick={() => setPortalViewMode('admin')}
                    className={`px-5 py-3 rounded-t-xl font-bold text-sm flex items-center gap-2 transition-all ${
                      portalViewMode === 'admin'
                        ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg'
                        : 'bg-gradient-to-r from-purple-900/60 to-pink-900/60 text-amber-300 hover:from-purple-900/80 hover:to-pink-900/80 border-t border-x border-amber-500/40'
                    }`}
                  >
                    <Shield className="w-4 h-4 text-amber-300" />
                    <span>Organizer Admin Panel 🛡️</span>
                  </button>
                )}
              </div>

          {/* TAB 1: CONFERENCE PASS */}
          {activePortalTab === 'conference' && (
            <div className="space-y-6">
              {regSuccessMsg && (
                <div className="p-4 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 text-xs font-semibold flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                  <span>{regSuccessMsg}</span>
                </div>
              )}

              {loadingData ? (
                <div className="text-center py-12 space-y-3">
                  <RefreshCw className="w-8 h-8 text-amber-400 animate-spin mx-auto" />
                  <p className="text-xs text-white/60">Fetching your registrations...</p>
                </div>
              ) : userRegistrations.filter(r => r.type !== 'musical').length === 0 ? (
                <div className="text-center py-12 bg-white/5 border border-white/10 rounded-2xl p-8 space-y-4">
                  <Ticket className="w-12 h-12 text-amber-400/50 mx-auto" />
                  <h3 className="text-xl font-bold text-white font-serif">No Conference Registrations Found</h3>
                  <p className="text-xs sm:text-sm text-white/60 max-w-md mx-auto">
                    We couldn't find any GRACIA Conference registrations under <strong className="text-amber-300">{currentUser.email}</strong>.
                  </p>
                  <div className="flex flex-wrap justify-center gap-3 pt-2">
                    {onNavigateToConference && (
                      <button
                        onClick={onNavigateToConference}
                        className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs"
                      >
                        Register for GRACIA Conference
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-6">
                  {userRegistrations.filter(r => r.type !== 'musical').map((reg) => (
                    <div 
                      key={reg.id} 
                      className="bg-gradient-to-br from-[#241226]/90 via-[#1c0d1e]/95 to-[#120716] border border-amber-500/30 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6 relative overflow-hidden"
                    >
                      {/* Badge Top */}
                      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-white/10">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
                            reg.type === 'musical' 
                              ? 'bg-pink-500/20 text-pink-300 border border-pink-500/40' 
                              : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                          }`}>
                            {reg.type === 'musical' ? '🎵 Musical Concert Ticket' : '✨ GRACIA Conference Registration'}
                          </span>
                          {(reg.checkedIn || (reg.scannedPassIds && reg.scannedPassIds.length > 0)) && (
                            <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1.5 shadow-sm">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                              <span>Checked In {reg.checkedInAt ? `at ${new Date(reg.checkedInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}</span>
                            </span>
                          )}
                          <span className="text-xs text-white/50 font-mono">ID: #{reg.id?.substring(0, 8)}</span>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            onClick={() => handleOpenWalletModal(reg)}
                            className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 hover:from-purple-500 hover:to-indigo-500 text-white border border-purple-400/40 text-xs font-bold flex items-center gap-1.5 transition-all shadow-md active:scale-95 cursor-pointer"
                          >
                            <Wallet className="w-3.5 h-3.5 text-purple-200" />
                            <span>Add to Wallet</span>
                          </button>

                          <button
                            onClick={() => downloadPDFPass(reg)}
                            className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                            title="Download All Passes (PDF) with individual QR codes for all registrants"
                          >
                            <Ticket className="w-3.5 h-3.5" />
                            <span>Download All Passes</span>
                          </button>

                          <button
                            onClick={() => handleStartEditRegistration(reg)}
                            className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold flex items-center gap-1.5 transition-colors"
                          >
                            <Edit3 className="w-3.5 h-3.5 text-amber-400" />
                            <span>Edit Registration</span>
                          </button>

                          <button
                            onClick={() => setDeleteTargetRegistration(reg)}
                            className="px-3 py-1.5 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/40 text-xs font-bold flex items-center gap-1.5 transition-colors"
                            title="Delete Registration"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-red-400" />
                            <span>Delete</span>
                          </button>
                        </div>
                      </div>

                      {/* Details Summary */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs text-white/80">
                        <div className="space-y-2">
                          <p><strong className="text-white text-sm block font-serif">{reg.name}</strong></p>
                          <p><span className="text-white/50">Email:</span> {reg.email}</p>
                          <p><span className="text-white/50">Phone:</span> {reg.phone || 'N/A'}</p>
                          {reg.comments && (
                            <p className="p-2 rounded-lg bg-black/30 border border-white/5 text-white/70 italic">
                              "{reg.comments}"
                            </p>
                          )}
                        </div>

                        <div className="space-y-2">
                          <p className="font-semibold text-amber-300">Attendee Breakdown:</p>
                          <div className="flex flex-wrap gap-2">
                            {reg.adultsCount > 0 && <span className="px-2 py-1 rounded bg-white/10">{reg.adultsCount} Adults</span>}
                            {(reg.teensCount || 0) > 0 && <span className="px-2 py-1 rounded bg-white/10">{reg.teensCount} Teens</span>}
                            {reg.preteensCount > 0 && <span className="px-2 py-1 rounded bg-white/10">{reg.preteensCount} Pre-Teens</span>}
                            {reg.childrenCount > 0 && <span className="px-2 py-1 rounded bg-white/10">{reg.childrenCount} Children</span>}
                            {reg.toddlersCount > 0 && <span className="px-2 py-1 rounded bg-white/10">{reg.toddlersCount} Toddlers</span>}
                          </div>

                          {reg.type === 'musical' && reg.selectedSeats && reg.selectedSeats.length > 0 && (
                            <div className="pt-2">
                              <span className="font-semibold text-pink-300 block">Assigned Concert Seats:</span>
                              <div className="flex flex-wrap gap-1.5 mt-1">
                                {reg.selectedSeats.map(s => (
                                  <span key={s} className="px-2 py-0.5 rounded bg-pink-500/20 text-pink-200 border border-pink-500/40 text-[10px] font-mono">
                                    Row {s.split('-')[0]} Seat {s.split('-')[1]}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Members & Individual Passes Section */}
                      <RegistrationMembersPasses reg={reg} onOpenWallet={handleOpenWalletModal} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: MUSICAL CONCERT */}
          {activePortalTab === 'musical' && (
            <div className="space-y-6">
              {(() => {
                const musicalReg = userRegistrations.find(r => r.type === 'musical');
                const conferenceReg = userRegistrations.find(r => r.type !== 'musical') || userRegistrations[0];
                const isPastRelease = new Date() >= new Date(musicalReleaseDate);

                if (musicalReg) {
                  // User has a Musical Ticket! Render their ticket
                  return (
                    <div className="bg-gradient-to-br from-[#241226]/90 via-[#1c0d1e]/95 to-[#120716] border-2 border-pink-500/50 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
                      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-white/10">
                        <div className="flex items-center gap-2">
                          <span className="px-3.5 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-pink-500/20 text-pink-300 border border-pink-500/40">
                            🎵 Musical Concert Pass Issued
                          </span>
                          <span className="text-xs text-white/50 font-mono">ID: #{musicalReg.id}</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => handleOpenWalletModal(musicalReg)}
                            className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-xs font-bold flex items-center gap-1.5 shadow-md cursor-pointer"
                          >
                            <Wallet className="w-4 h-4 text-purple-200" />
                            <span>Add to Wallet</span>
                          </button>
                          <button
                            onClick={() => downloadPDFPass(musicalReg)}
                            className="px-4 py-2 rounded-xl bg-pink-500/20 hover:bg-pink-500/30 text-pink-200 border border-pink-500/40 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                          >
                            <Ticket className="w-4 h-4" />
                            <span>Download Pass PDF</span>
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs text-white/80">
                        <div className="space-y-2">
                          <p><strong className="text-white text-base font-serif">{musicalReg.name}</strong></p>
                          <p><span className="text-white/50">Email:</span> {musicalReg.email}</p>
                          <p><span className="text-white/50">Phone:</span> {musicalReg.phone || 'N/A'}</p>
                        </div>
                        <div className="space-y-2">
                          <p className="font-bold text-pink-300">Reserved Seats:</p>
                          <div className="flex flex-wrap gap-2">
                            {musicalReg.selectedSeats && musicalReg.selectedSeats.length > 0 ? (
                              musicalReg.selectedSeats.map(s => (
                                <span key={s} className="px-3 py-1 rounded-lg bg-pink-500/30 text-pink-100 border border-pink-500/50 font-mono text-xs">
                                  Row {s.split('-')[0]} Seat {s.split('-')[1]}
                                </span>
                              ))
                            ) : (
                              <span className="text-white/50">General Admission</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Members & Individual Passes Section */}
                      <RegistrationMembersPasses reg={musicalReg} onOpenWallet={handleOpenWalletModal} />
                    </div>
                  );
                } else if (!isPastRelease) {
                  // Pre-launch state: Countdown timer & Reminder CTA!
                  const hasRequestedReminder = conferenceReg?.reminder_requested;

                  return (
                    <div className="bg-gradient-to-br from-[#2c1140] via-[#1a0826] to-[#0f0417] border-2 border-amber-500/40 rounded-3xl p-6 sm:p-10 text-center space-y-6 shadow-2xl relative overflow-hidden">
                      <div className="inline-flex items-center space-x-2 px-4 py-1.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-bold uppercase tracking-wider">
                        <Calendar className="w-4 h-4 text-amber-400" />
                        <span>COMING SOON</span>
                      </div>

                      <div className="space-y-2 max-w-xl mx-auto">
                        <h3 className="font-poster text-3xl sm:text-5xl tracking-wider text-white uppercase drop-shadow-2xl">
                          GRACIA <span className="text-signature-animated">MUSICAL CONCERT TICKET</span>
                        </h3>
                        <p className="text-sm sm:text-base text-amber-200 font-medium">
                          Ticket reservation will be opened by 10th Sep 2026
                        </p>
                      </div>

                      {/* Live Countdown Timer */}
                      <MusicalCountdownTimer targetDate={musicalReleaseDate} />

                      {/* Consolidated Reminder Requested Banner or CTA */}
                      {hasRequestedReminder || reminderSuccessNotice ? (
                        <div className="max-w-xl mx-auto p-4 sm:p-5 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 text-xs sm:text-sm font-semibold flex items-center justify-center gap-3 shadow-lg">
                          <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
                          <span>
                            {reminderSuccessNotice || `✓ Reminder requested! We will send an email notification to ${currentUser?.email} when reservations open.`}
                          </span>
                        </div>
                      ) : (
                        <div className="pt-2">
                          <button
                            type="button"
                            disabled={requestingReminder || !conferenceReg}
                            onClick={() => conferenceReg && handleRequestReminder(conferenceReg)}
                            className="px-8 py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-sm uppercase tracking-wider shadow-xl transition-all cursor-pointer flex items-center justify-center space-x-2 mx-auto disabled:opacity-50"
                          >
                            <Bell className="w-5 h-5" />
                            <span>Send me a reminder</span>
                          </button>
                          <p className="text-[11px] text-white/50 mt-2">
                            We'll email you a priority reservation alert as soon as booking opens on 10th Sep 2026.
                          </p>
                        </div>
                      )}
                    </div>
                  );
                } else {
                  // Post-launch state: Ticket booking is OPEN!
                  return (
                    <div className="bg-gradient-to-br from-[#2c1140] via-[#1a0826] to-[#0f0417] border-2 border-pink-500/40 rounded-3xl p-6 sm:p-10 text-center space-y-6 shadow-2xl">
                      <div className="inline-flex items-center space-x-2 px-4 py-1.5 rounded-full bg-pink-500/20 border border-pink-500/40 text-pink-300 text-xs font-bold uppercase tracking-wider">
                        <Ticket className="w-4 h-4 text-pink-400" />
                        <span>RESERVATIONS OPEN</span>
                      </div>

                      <div className="space-y-2 max-w-xl mx-auto">
                        <h3 className="text-2xl sm:text-3xl font-black text-white font-serif">
                          Reserve Your Concert Ticket
                        </h3>
                        <p className="text-xs sm:text-sm text-white/70">
                          Seat reservations for the GRACIA Musical Concert are now open! Select your seats now to secure your pass.
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={onNavigateToMusical}
                        className="px-8 py-3.5 rounded-2xl bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white font-black text-sm uppercase tracking-wider shadow-xl transition-all cursor-pointer flex items-center justify-center space-x-2 mx-auto"
                      >
                        <Ticket className="w-5 h-5" />
                        <span>Reserve Ticket Now</span>
                      </button>
                    </div>
                  );
                }
              })()}
            </div>
          )}

          {/* TAB 3: INTERCESSION PRAYER COMMITMENTS & PROGRESS TRACKER */}
          {activePortalTab === 'intercessions' && (
            <div className="space-y-6">
              {loadingData ? (
                <div className="text-center py-12 space-y-3">
                  <RefreshCw className="w-8 h-8 text-amber-400 animate-spin mx-auto" />
                  <p className="text-xs text-white/60">Fetching your intercession prayer commitments...</p>
                </div>
              ) : userIntercessions.length === 0 ? (
                <div className="text-center py-12 bg-white/5 border border-white/10 rounded-2xl p-8 space-y-4">
                  <Church className="w-12 h-12 text-amber-400/50 mx-auto" />
                  <h3 className="text-xl font-bold text-white font-serif">No Intercession Commitments Found</h3>
                  <p className="text-xs sm:text-sm text-white/60 max-w-md mx-auto">
                    We couldn't find any spiritual bouquet intercession pledges under <strong className="text-amber-300">{currentUser.email}</strong>.
                  </p>
                  {onNavigateToConference && (
                    <button
                      onClick={onNavigateToConference}
                      className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs"
                    >
                      Pledge Intercession Prayers
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-8">
                  {userIntercessions.map((rec) => {
                    const recId = rec.id || '';
                    const liveData = intercessionProgressData[recId] || rec;

                    // Calculate total goal and total completed for overall progress ring
                    let totalPledged = 0;
                    let totalDone = 0;

                    INTERCESSION_ITEMS.forEach(item => {
                      const goal = Number(liveData[item.key] || 0);
                      const completedKey = `completed${item.key.charAt(0).toUpperCase() + item.key.slice(1)}` as keyof IntercessionCommitmentRecord;
                      const done = Number(liveData[completedKey] || 0);

                      totalPledged += goal;
                      totalDone += done;
                    });

                    const overallPercentage = totalPledged > 0 ? Math.min(100, Math.round((totalDone / totalPledged) * 100)) : 0;

                    return (
                      <div 
                        key={recId}
                        className="bg-gradient-to-br from-[#241226]/90 via-[#1c0d1e]/95 to-[#120716] border border-amber-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 relative overflow-hidden"
                      >
                        {/* Header Banner */}
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-white/10">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <Church className="w-5 h-5 text-amber-400" />
                              <h3 className="text-xl font-bold text-white font-serif">Spiritual Bouquet Intercession Progress</h3>
                              {savingIntercessionId === recId && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[11px] font-medium animate-pulse">
                                  <RefreshCw className="w-3 h-3 animate-spin" />
                                  <span>Saving...</span>
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-white/60 mt-1">
                              Participant: <strong className="text-amber-200">{rec.name || currentUser.displayName}</strong> ({rec.email})
                            </p>
                          </div>

                          <div className="flex items-center gap-4 bg-amber-500/10 border border-amber-500/20 px-4 py-2 rounded-2xl">
                            <div className="text-right">
                              <p className="text-[10px] uppercase font-bold text-amber-300">Overall Completion</p>
                              <p className="text-lg font-bold text-white font-mono">{overallPercentage}% Done</p>
                            </div>
                            <div className="w-10 h-10 rounded-full bg-amber-500/20 border border-amber-400 flex items-center justify-center font-black text-amber-300 text-xs">
                              {overallPercentage}%
                            </div>
                          </div>
                        </div>

                        {/* Overall Progress Bar */}
                        <div className="space-y-1.5">
                          <div className="flex justify-between text-xs text-white/70 font-semibold">
                            <span>Total Prayer Goal: {totalPledged} items</span>
                            <span>Completed: {totalDone} / {totalPledged}</span>
                          </div>
                          <div className="w-full h-3 bg-black/50 rounded-full overflow-hidden border border-white/10 p-0.5">
                            <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: `${overallPercentage}%` }}
                              transition={{ duration: 0.5 }}
                              className={`h-full rounded-full ${
                                overallPercentage >= 100 
                                  ? 'bg-gradient-to-r from-emerald-500 to-teal-400' 
                                  : 'bg-gradient-to-r from-amber-500 via-orange-500 to-pink-500'
                              }`}
                            />
                          </div>
                        </div>

                        {/* ITEMS PROGRESS GRID */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {INTERCESSION_ITEMS.map((item) => {
                            const goal = Number(liveData[item.key] || 0);
                            const completedKey = `completed${item.key.charAt(0).toUpperCase() + item.key.slice(1)}` as keyof IntercessionCommitmentRecord;
                            const done = Number(liveData[completedKey] || 0);
                            const percent = goal > 0 ? Math.min(100, Math.round((done / goal) * 100)) : 0;

                            if (goal === 0 && done === 0) return null; // Skip if 0 goal & 0 done

                            const itemLastUpd = liveData.itemLastUpdated?.[item.key] || liveData.updatedAt;
                            const formattedLastUpd = itemLastUpd 
                              ? new Date(itemLastUpd).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ', ' + new Date(itemLastUpd).toLocaleDateString([], { month: 'short', day: 'numeric' })
                              : null;

                            return (
                              <div 
                                key={item.key}
                                className={`p-4 rounded-2xl border ${item.borderColor} bg-gradient-to-br ${item.bgGradient} space-y-3 relative`}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <span className="text-lg">{getCommitmentIcon(item.label)}</span>
                                    <div>
                                      <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                                        <h4 className={`font-bold text-sm ${item.color}`}>{item.label}</h4>
                                        {formattedLastUpd && (
                                          <span className="text-[10px] text-white/50 font-normal italic">
                                            (Last Updated: {formattedLastUpd})
                                          </span>
                                        )}
                                      </div>
                                      <p className="text-[11px] text-white/60">Goal Pledged: {goal}</p>
                                    </div>
                                  </div>

                                  <div className="text-right font-mono">
                                    <span className={`text-sm font-bold ${percent >= 100 ? 'text-emerald-300' : 'text-white'}`}>
                                      {done} / {goal}
                                    </span>
                                    <span className="text-[10px] block text-white/50">{percent}%</span>
                                  </div>
                                </div>

                                {/* Progress Bar */}
                                <div className="w-full h-2 bg-black/40 rounded-full overflow-hidden">
                                  <motion.div 
                                    initial={{ width: 0 }}
                                    animate={{ width: `${percent}%` }}
                                    className={`h-full rounded-full ${percent >= 100 ? 'bg-emerald-400' : 'bg-amber-400'}`}
                                  />
                                </div>

                                {/* Controls to increment / decrement completed count */}
                                <div className="flex items-center justify-between pt-1 text-xs">
                                  <span className="text-[11px] text-white/70">Update Count:</span>
                                  <div className="flex items-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => handleUpdateIntercessionCount(recId, item.key, -1)}
                                      className="w-7 h-7 rounded-lg bg-black/40 hover:bg-black/60 border border-white/20 text-white font-bold flex items-center justify-center active:scale-95 transition-all"
                                      title="Subtract 1"
                                    >
                                      <Minus className="w-3.5 h-3.5" />
                                    </button>

                                    <input
                                      type="number"
                                      min="0"
                                      value={done}
                                      onChange={(e) => handleDirectSetIntercessionCount(recId, item.key, e.target.value)}
                                      className="w-14 h-7 text-center rounded-lg bg-black/50 border border-white/20 text-white font-mono font-bold text-xs focus:outline-none focus:border-amber-400"
                                    />

                                    <button
                                      type="button"
                                      onClick={() => handleUpdateIntercessionCount(recId, item.key, 1)}
                                      className="w-7 h-7 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold flex items-center justify-center active:scale-95 transition-all"
                                      title="Add 1"
                                    >
                                      <Plus className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )}

      {/* REGISTRATION EDIT MODAL */}
      <AnimatePresence>
        {editingRegistration && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#1c0d1e] border border-amber-500/40 rounded-3xl p-6 sm:p-8 max-w-2xl w-full text-white space-y-6 max-h-[90vh] overflow-y-auto shadow-2xl relative"
            >
              <div className="flex items-center justify-between pb-4 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <Edit3 className="w-5 h-5 text-amber-400" />
                  <h3 className="text-xl font-bold font-serif">Edit Registration Details</h3>
                </div>
                <button
                  onClick={() => setEditingRegistration(null)}
                  className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {isChangingSeats && editingRegistration.type === 'musical' ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-amber-300 font-semibold">Select your seats for GRACIA Musical Concert:</p>
                    <button
                      onClick={() => setIsChangingSeats(false)}
                      className="text-xs text-white/60 hover:text-white underline"
                    >
                      Done Selecting
                    </button>
                  </div>
                  <SeatSelector
                    requiredSeatsCount={
                      (editingRegistration.adultsCount || 0) + 
                      (editingRegistration.teensCount || 0) + 
                      (editingRegistration.preteensCount || 0) + 
                      (editingRegistration.childrenCount || 0)
                    }
                    registrantName={editingRegistration.name}
                    registrantEmail={editingRegistration.email}
                    initialSelectedSeats={editingRegistration.selectedSeats || []}
                    onConfirmSeats={(seats) => {
                      setEditingRegistration({ ...editingRegistration, selectedSeats: seats });
                      setIsChangingSeats(false);
                    }}
                    onBack={() => setIsChangingSeats(false)}
                  />
                </div>
              ) : (
                <div className="space-y-4 text-xs">
                  {/* Primary Participant Photo Pick */}
                  <div className="flex items-center gap-4 p-4 rounded-2xl bg-black/40 border border-white/10">
                    <div className="relative shrink-0">
                      <div className="w-16 h-16 rounded-2xl bg-black/50 border-2 border-amber-400/60 overflow-hidden flex items-center justify-center">
                        {editingRegistration.photoUrl ? (
                          <img src={editingRegistration.photoUrl} alt={editingRegistration.name} className="w-full h-full object-cover" />
                        ) : (
                          <UserIcon className="w-8 h-8 text-amber-300/60" />
                        )}
                      </div>
                      <label
                        className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center cursor-pointer shadow-lg hover:bg-amber-400 transition-all"
                        title="Upload or change primary participant photo"
                      >
                        <Camera className="w-3.5 h-3.5 font-bold" />
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              if (file.size > 5 * 1024 * 1024) {
                                alert('Photo size must be less than 5MB');
                                return;
                              }
                              const reader = new FileReader();
                              reader.onload = (ev) => {
                                const res = ev.target?.result as string;
                                if (res) setEditingRegistration({ ...editingRegistration, photoUrl: res });
                              };
                              reader.readAsDataURL(file);
                            }
                          }}
                        />
                      </label>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-amber-300 uppercase tracking-wider">Primary Registrant Photo</p>
                      <p className="text-[11px] text-white/60">Upload photo for badge printing and check-in pass verification.</p>
                      {editingRegistration.photoUrl && (
                        <button
                          type="button"
                          onClick={() => setEditingRegistration({ ...editingRegistration, photoUrl: undefined })}
                          className="mt-1 text-[10px] text-red-400 hover:text-red-300 underline font-mono cursor-pointer"
                        >
                          Remove Photo
                        </button>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-white/70 mb-1 font-semibold">Full Name *</label>
                    <input
                      type="text"
                      value={editingRegistration.name}
                      onChange={(e) => setEditingRegistration({ ...editingRegistration, name: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl bg-black/40 border border-white/20 text-white focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-white/70 mb-1 font-semibold">Email Address *</label>
                      <input
                        type="email"
                        value={editingRegistration.email}
                        onChange={(e) => setEditingRegistration({ ...editingRegistration, email: e.target.value })}
                        className="w-full px-4 py-2.5 rounded-xl bg-black/40 border border-white/20 text-white focus:outline-none focus:border-amber-400"
                      />
                    </div>
                    <div>
                      <label className="block text-white/70 mb-1 font-semibold">Phone Number *</label>
                      <input
                        type="tel"
                        value={editingRegistration.phone}
                        onChange={(e) => setEditingRegistration({ ...editingRegistration, phone: e.target.value })}
                        className="w-full px-4 py-2.5 rounded-xl bg-black/40 border border-white/20 text-white focus:outline-none focus:border-amber-400"
                      />
                    </div>
                  </div>

                  {/* Attendance Counts */}
                  <div className="p-4 rounded-2xl bg-black/30 border border-white/10 space-y-3">
                    <p className="font-bold text-amber-300">Attendee Counts:</p>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                      <div>
                        <label className="block text-white/60 text-[10px]">Adults (20+)</label>
                        <input
                          type="number"
                          min="0"
                          value={editingRegistration.adultsCount}
                          onChange={(e) => {
                            const newAdults = Math.max(0, parseInt(e.target.value, 10) || 0);
                            const updatedAttendees = buildExpectedAttendees(
                              newAdults,
                              editingRegistration.teensCount || 0,
                              editingRegistration.preteensCount,
                              editingRegistration.childrenCount,
                              editingRegistration.additionalAttendees || []
                            );
                            setEditingRegistration({
                              ...editingRegistration,
                              adultsCount: newAdults,
                              additionalAttendees: updatedAttendees
                            });
                          }}
                          className="w-full px-2 py-1.5 rounded-lg bg-black/50 border border-white/20 text-white text-center font-bold"
                        />
                      </div>

                      <div>
                        <label className="block text-white/60 text-[10px]">Teens (13-19)</label>
                        <input
                          type="number"
                          min="0"
                          value={editingRegistration.teensCount || 0}
                          onChange={(e) => {
                            const newTeens = Math.max(0, parseInt(e.target.value, 10) || 0);
                            const updatedAttendees = buildExpectedAttendees(
                              editingRegistration.adultsCount,
                              newTeens,
                              editingRegistration.preteensCount,
                              editingRegistration.childrenCount,
                              editingRegistration.additionalAttendees || []
                            );
                            setEditingRegistration({
                              ...editingRegistration,
                              teensCount: newTeens,
                              additionalAttendees: updatedAttendees
                            });
                          }}
                          className="w-full px-2 py-1.5 rounded-lg bg-black/50 border border-white/20 text-white text-center font-bold"
                        />
                      </div>

                      <div>
                        <label className="block text-white/60 text-[10px]">Pre-Teens (9-12)</label>
                        <input
                          type="number"
                          min="0"
                          value={editingRegistration.preteensCount}
                          onChange={(e) => {
                            const newPreteens = Math.max(0, parseInt(e.target.value, 10) || 0);
                            const updatedAttendees = buildExpectedAttendees(
                              editingRegistration.adultsCount,
                              editingRegistration.teensCount || 0,
                              newPreteens,
                              editingRegistration.childrenCount,
                              editingRegistration.additionalAttendees || []
                            );
                            setEditingRegistration({
                              ...editingRegistration,
                              preteensCount: newPreteens,
                              additionalAttendees: updatedAttendees
                            });
                          }}
                          className="w-full px-2 py-1.5 rounded-lg bg-black/50 border border-white/20 text-white text-center font-bold"
                        />
                      </div>

                      <div>
                        <label className="block text-white/60 text-[10px]">Children (6-8)</label>
                        <input
                          type="number"
                          min="0"
                          value={editingRegistration.childrenCount}
                          onChange={(e) => {
                            const newChildren = Math.max(0, parseInt(e.target.value, 10) || 0);
                            const updatedAttendees = buildExpectedAttendees(
                              editingRegistration.adultsCount,
                              editingRegistration.teensCount || 0,
                              editingRegistration.preteensCount,
                              newChildren,
                              editingRegistration.additionalAttendees || []
                            );
                            setEditingRegistration({
                              ...editingRegistration,
                              childrenCount: newChildren,
                              additionalAttendees: updatedAttendees
                            });
                          }}
                          className="w-full px-2 py-1.5 rounded-lg bg-black/50 border border-white/20 text-white text-center font-bold"
                        />
                      </div>

                      <div>
                        <label className="block text-white/60 text-[10px]">Toddlers (≤5)</label>
                        <input
                          type="number"
                          min="0"
                          value={editingRegistration.toddlersCount}
                          onChange={(e) => setEditingRegistration({ ...editingRegistration, toddlersCount: Math.max(0, parseInt(e.target.value, 10) || 0) })}
                          className="w-full px-2 py-1.5 rounded-lg bg-black/50 border border-white/20 text-white text-center font-bold"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Additional Attendees Form */}
                  {editingRegistration.additionalAttendees && editingRegistration.additionalAttendees.length > 0 && (
                    <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 space-y-3">
                      <p className="font-bold text-amber-200">Group Members Info:</p>
                      <AdditionalAttendeesForm
                        adultsCount={editingRegistration.adultsCount}
                        teensCount={editingRegistration.teensCount || 0}
                        preteensCount={editingRegistration.preteensCount}
                        childrenCount={editingRegistration.childrenCount}
                        attendees={editingRegistration.additionalAttendees}
                        onChange={(updated) => setEditingRegistration({ ...editingRegistration, additionalAttendees: updated })}
                      />
                    </div>
                  )}

                  {/* Seat Selection for Musical */}
                  {editingRegistration.type === 'musical' && (
                    <div className="p-4 rounded-2xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-between">
                      <div>
                        <p className="font-bold text-pink-300">Concert Seats Selected:</p>
                        <p className="text-white/70">
                          {editingRegistration.selectedSeats && editingRegistration.selectedSeats.length > 0
                            ? editingRegistration.selectedSeats.join(', ')
                            : 'No seats selected yet.'}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsChangingSeats(true)}
                        className="px-3 py-1.5 rounded-xl bg-pink-500 hover:bg-pink-400 text-slate-950 font-bold text-xs"
                      >
                        Change Seats
                      </button>
                    </div>
                  )}

                  <div>
                    <label className="block text-white/70 mb-1 font-semibold">Special Notes / Comments</label>
                    <textarea
                      rows={2}
                      value={editingRegistration.comments || ''}
                      onChange={(e) => setEditingRegistration({ ...editingRegistration, comments: e.target.value })}
                      className="w-full px-4 py-2 rounded-xl bg-black/40 border border-white/20 text-white focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  <div className="pt-4 border-t border-white/10 flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setEditingRegistration(null)}
                      className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-xs"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveRegistrationEdit}
                      disabled={isSavingReg}
                      className="px-6 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-lg"
                    >
                      {isSavingReg ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Saving...</span>
                        </>
                      ) : (
                        <>
                          <Save className="w-3.5 h-3.5" />
                          <span>Save Changes</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* REGISTRATION DELETE CONFIRMATION MODAL */}
      <AnimatePresence>
        {deleteTargetRegistration && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#1c0d1e] border border-red-500/40 rounded-3xl p-6 sm:p-8 max-w-md w-full text-white space-y-5 shadow-2xl relative"
            >
              <div className="flex items-center gap-3 text-red-400">
                <div className="w-10 h-10 rounded-full bg-red-500/20 border border-red-500/40 flex items-center justify-center shrink-0">
                  <Trash2 className="w-5 h-5" />
                </div>
                <h3 className="text-xl font-bold font-serif text-white">Delete Registration</h3>
              </div>

              <div className="space-y-2 text-xs text-white/80">
                <p>
                  Are you sure you want to delete the <strong>{deleteTargetRegistration.type === 'musical' ? 'Concert Ticket' : 'Conference Registration'}</strong> for <strong>{deleteTargetRegistration.name}</strong>?
                </p>
                <p className="text-red-300/90 font-medium">
                  ⚠️ This action cannot be undone and will cancel all booked seats/passes associated with this entry.
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setDeleteTargetRegistration(null)}
                  disabled={isDeletingReg}
                  className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteRegistration}
                  disabled={isDeletingReg}
                  className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg"
                >
                  {isDeletingReg ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Deleting...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Confirm Delete</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* DIGITAL WALLET PASS MODAL (APPLE & GOOGLE WALLET) */}
      <AnimatePresence>
        {walletModalReg && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-[#190a1c] border border-amber-500/40 rounded-3xl p-6 sm:p-8 max-w-lg w-full text-white space-y-6 shadow-2xl relative my-8"
            >
              {/* Close Button */}
              <button
                onClick={() => {
                  setWalletModalReg(null);
                  setWalletModalMember(null);
                }}
                className="absolute top-5 right-5 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Modal Header */}
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 border border-purple-400/50 flex items-center justify-center shadow-lg shrink-0">
                  <Wallet className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold font-serif text-white flex items-center gap-2">
                    Add to Mobile Wallet
                  </h3>
                  <p className="text-xs text-amber-200/80">
                    {walletModalMember ? `Pass for ${walletModalMember.name}` : 'GRACIA Jubilee Digital Conference & Concert Pass'}
                  </p>
                </div>
              </div>

              {/* Save Notice Banner */}
              {walletSavedNotice && (
                <div className="p-3.5 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 text-xs font-semibold flex items-center gap-2 animate-fadeIn">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{walletSavedNotice}</span>
                </div>
              )}

              {/* Wallet Platform Select Tabs */}
              <div className="grid grid-cols-3 gap-2 bg-black/40 p-1.5 rounded-2xl border border-white/10">
                <button
                  type="button"
                  onClick={() => setWalletTab('apple')}
                  className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                    walletTab === 'apple'
                      ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md'
                      : 'text-white/60 hover:text-white'
                  }`}
                >
                  <span>🍏 Apple Wallet</span>
                </button>
                <button
                  type="button"
                  onClick={() => setWalletTab('google')}
                  className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                    walletTab === 'google'
                      ? 'bg-gradient-to-r from-blue-600 to-emerald-600 text-white shadow-md'
                      : 'text-white/60 hover:text-white'
                  }`}
                >
                  <span>🤖 Google Wallet</span>
                </button>
                <button
                  type="button"
                  onClick={() => setWalletTab('qr')}
                  className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                    walletTab === 'qr'
                      ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                      : 'text-white/60 hover:text-white'
                  }`}
                >
                  <QrCode className="w-3.5 h-3.5" />
                  <span>Scan QR</span>
                </button>
              </div>

              {/* WALLET PASS PREVIEW CARD */}
              <div className="bg-gradient-to-br from-[#1B0F2B] via-[#2A163D] to-[#3B1A58] border border-amber-500/40 rounded-3xl p-6 shadow-2xl relative overflow-hidden space-y-5">
                
                {/* Metallic Gold Accent Top Line */}
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-500 via-amber-300 to-amber-600" />

                {/* Decorative Top Header: JESUS YOUTH SINGAPORE */}
                <div className="flex items-center justify-between pb-3.5 border-b border-white/10 pt-1">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                    <span className="text-xs font-black uppercase tracking-widest text-white">
                      JESUS YOUTH SINGAPORE
                    </span>
                  </div>
                  <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30">
                    25TH JUBILEE
                  </span>
                </div>

                {/* Pass Type Label */}
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-amber-400 font-bold mb-0.5">
                    PASS TYPE
                  </div>
                  <h4 className="text-xl font-extrabold text-white tracking-tight leading-snug">
                    {walletModalReg.type === 'musical'
                      ? 'GRACIA - Musical Concert Ticket'
                      : 'GRACIA - Jubilee Conference Pass'}
                  </h4>
                </div>

                {/* Participant & Event Details Grid */}
                <div className="grid grid-cols-2 gap-4 text-xs pt-2 border-t border-white/10">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-white/50 block tracking-wider">PARTICIPANT</span>
                    <strong className="text-white text-sm block truncate font-semibold">
                      {walletModalMember ? walletModalMember.name : walletModalReg.name}
                    </strong>
                    <span className="text-amber-200/70 text-[11px] font-mono block truncate">
                      {walletModalMember ? walletModalMember.email : walletModalReg.email}
                    </span>
                    {walletModalMember && (
                      <span className="text-indigo-300 text-[10px] block font-medium mt-0.5">
                        {walletModalMember.categoryLabel}
                      </span>
                    )}
                  </div>

                  <div>
                    <span className="text-[10px] uppercase font-bold text-white/50 block tracking-wider">DATE & TIME</span>
                    <strong className="text-amber-300 font-medium block">
                      {walletModalReg.type === 'musical' ? '11 Oct 2026 • 7:30 PM' : '10-11 Oct 2026 • 9:00 AM'}
                    </strong>
                    <span className="text-white/60 text-[11px] block">Singapore (SGT)</span>
                  </div>

                  <div>
                    <span className="text-[10px] uppercase font-bold text-white/50 block tracking-wider">VENUE</span>
                    <strong className="text-white font-medium block truncate">
                      {walletModalReg.type === 'musical' ? 'Agape Village, Main Auditorium' : 'MPH, Agape Village, Singapore'}
                    </strong>
                  </div>

                  <div>
                    <span className="text-[10px] uppercase font-bold text-white/50 block tracking-wider">PASS ID</span>
                    <strong className="text-amber-300 font-mono text-xs block">
                      {walletModalMember ? walletModalMember.passId : (walletModalReg.passId || getBibleVersePassId(getPersonDeterministicSeed(walletModalReg.email, walletModalReg.phone, walletModalReg.name) || walletModalReg.id, 0, walletModalReg.name))}
                    </strong>
                  </div>
                </div>

                {/* Unique Centered QR Code Box OR Checked-In Banner */}
                {isDelegatePassCheckedIn(
                  walletModalReg,
                  walletModalMember ? walletModalMember.passId : (walletModalReg.passId || getBibleVersePassId(getPersonDeterministicSeed(walletModalReg.email, walletModalReg.phone, walletModalReg.name) || walletModalReg.id, 0, walletModalReg.name)),
                  walletModalMember ? walletModalMember.name : walletModalReg.name,
                  walletModalMember ? walletModalMember.isPrimary : true,
                  walletModalMember ? ((walletModalMember as any).id || walletModalMember.passId) : walletModalReg.id
                ) ? (
                  <div className="bg-emerald-950/90 border-2 border-emerald-500/60 p-6 rounded-2xl text-center space-y-3 shadow-xl">
                    <div className="w-14 h-14 rounded-full bg-emerald-500/20 border-2 border-emerald-400 flex items-center justify-center mx-auto text-emerald-400 shadow-md">
                      <CheckCircle2 className="w-8 h-8" />
                    </div>
                    <div>
                      <div className="text-sm font-black tracking-widest uppercase text-emerald-300">
                        TICKET VERIFIED & CHECKED IN
                      </div>
                      <p className="text-xs text-emerald-200/80 mt-1 font-mono">
                        This pass was scanned and verified at venue check-in.
                      </p>
                    </div>
                    {walletModalReg.checkedInAt && (
                      <div className="pt-2 border-t border-emerald-500/30 text-[11px] text-emerald-300/90 font-mono">
                        Checked in on {new Date(walletModalReg.checkedInAt).toLocaleDateString()} at {new Date(walletModalReg.checkedInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        {walletModalReg.checkedInBy ? ` • Verified by ${walletModalReg.checkedInBy}` : ''}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-white p-4 rounded-2xl text-slate-950 text-center space-y-2 shadow-lg border border-amber-300/40">
                    <div className="flex justify-center py-1">
                      {walletQrCodeUrl ? (
                        <img 
                          src={walletQrCodeUrl} 
                          alt="Unique Wallet QR Code Pass" 
                          className="w-48 h-48 object-contain rounded-lg border border-slate-100 shadow-sm"
                        />
                      ) : (
                        <div className="w-48 h-48 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400 text-xs animate-pulse">
                          Generating Centered Pass QR...
                        </div>
                      )}
                    </div>
                    <div className="text-[11px] font-black tracking-wider uppercase text-slate-800">
                      SCAN & CONFIRM AT VENUE CHECK-IN
                    </div>
                  </div>
                )}
              </div>

              {/* ACTION BUTTONS ACCORDING TO SELECTED TAB */}
              <div className="space-y-3 pt-2">
                {walletTab === 'apple' && (
                  <div className="space-y-2.5">
                    <button
                      type="button"
                      onClick={() => handleAddToAppleWallet(walletModalReg)}
                      className="w-full py-3.5 px-5 rounded-2xl bg-black hover:bg-slate-950 text-white font-bold text-sm border border-white/20 shadow-xl flex items-center justify-center gap-3 transition-all active:scale-98 cursor-pointer group"
                    >
                      <svg className="w-5 h-5 fill-current shrink-0" viewBox="0 0 24 24">
                        <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.32c.67-.82 1.12-1.96.99-3.1-.96.04-2.13.64-2.82 1.44-.61.71-1.15 1.87-.99 2.99 1.08.08 2.16-.51 2.82-1.33z" />
                      </svg>
                      <span>Add to Apple Wallet</span>
                    </button>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <button
                        type="button"
                        onClick={() => downloadWalletPassImage(walletModalReg)}
                        className="py-2.5 px-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium border border-white/10 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5 text-amber-300" />
                        <span>Save Pass Image (.png)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => downloadAppleCalendarEvent(walletModalReg)}
                        className="py-2.5 px-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium border border-white/10 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Calendar className="w-3.5 h-3.5 text-sky-300" />
                        <span>Add iCal Event (.ics)</span>
                      </button>
                    </div>

                    <p className="text-[11px] text-center text-white/60">
                      Adds pass card directly to Apple Wallet or saves pass image and event reminder.
                    </p>
                  </div>
                )}

                {walletTab === 'google' && (
                  <div className="space-y-2.5">
                    <button
                      type="button"
                      onClick={() => handleAddToGoogleWallet(walletModalReg)}
                      className="w-full py-3.5 px-5 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-emerald-600 hover:brightness-110 text-white font-bold text-sm border border-white/20 shadow-xl flex items-center justify-center gap-3 transition-all active:scale-98 cursor-pointer"
                    >
                      <Smartphone className="w-5 h-5 text-emerald-300 shrink-0" />
                      <span>Add to Google Calendar & Save Pass</span>
                    </button>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <button
                        type="button"
                        onClick={() => downloadWalletPassImage(walletModalReg)}
                        className="py-2.5 px-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium border border-white/10 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5 text-emerald-300" />
                        <span>Save Pass Image (.png)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => openGoogleCalendarEvent(walletModalReg)}
                        className="py-2.5 px-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium border border-white/10 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Calendar className="w-3.5 h-3.5 text-blue-300" />
                        <span>Open Google Calendar</span>
                      </button>
                    </div>

                    <p className="text-[11px] text-center text-white/60">
                      Opens Google Calendar event with pass details and downloads HD Pass image for Android Gallery / Photos.
                    </p>
                  </div>
                )}

                {walletTab === 'qr' && (
                  <div className="space-y-3">
                    <button
                      type="button"
                      onClick={() => downloadPDFPass(walletModalReg)}
                      className="w-full py-3.5 px-6 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm shadow-xl flex items-center justify-center gap-2 transition-all cursor-pointer"
                    >
                      <Download className="w-5 h-5" />
                      <span>Download Printable PDF Pass</span>
                    </button>
                    <p className="text-[11px] text-center text-white/60">
                      Saves full high-resolution PDF ticket pass with QR code verification.
                    </p>
                  </div>
                )}
              </div>

              {/* Close Footer */}
              <div className="text-center pt-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setWalletModalReg(null)}
                  className="px-6 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-colors"
                >
                  Close Pass Preview
                </button>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
};
