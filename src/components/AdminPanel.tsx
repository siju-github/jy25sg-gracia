import React, { useState, useEffect } from 'react';
import { 
  loginWithGoogle, 
  loginWithGoogleRedirect,
  checkRedirectResult,
  logoutUser, 
  auth, 
  checkIsAdminApproved, 
  SUPER_ADMIN_EMAIL,
  PRIMARY_ADMIN_GMAIL, ALT_SUPER_ADMIN,
  FIREBASE_CONSOLE_AUTH_URL,
  requestAdminAccess,
  fetchAllRegistrations,
  subscribeToRegistrations,
  updateRegistrationInFirestore,
  deleteRegistrationFromFirestore,
  logRegistrationAction,
  fetchRegistrationAuditLogs,
  deleteAuditLogFromFirestore,
  fetchApprovedAdmins,
  updateAdminStatus,
  deleteAdminRecordPermanently,
  editAdminEmail,
  fetchTimelineEvents,
  saveTimelineEvent,
  deleteTimelineEvent,
  fetchPrayerGroups,
  savePrayerGroup,
  deletePrayerGroup,
  fetchSiteContent,
  saveSiteContent,
  fetchContactMessages,
  replyToContactMessage,
  updateMessageStatus,
  deleteContactMessage,
  clearAllRegistrationsFromFirestore,
  bulkDeleteRegistrationsFromFirestore,
  fetchAuditBackupsFromFirestore,
  deleteAuditBackupFromFirestore,
  exportFullFirestoreDatabaseJSON,
  restoreFullFirestoreDatabaseJSON,
  restoreSingleRegistrationRecordToFirestore,
  clearPortalUserLogs,
  AuditBackupRecord
} from '../lib/firebase';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { RegistrationData, RegistrationAuditLog, ApprovedAdminData, TimelineItem, PrayerGroupItem, SiteContentData, ContactMessageItem, ContactMessageReply } from '../types';
import { AdditionalAttendeesForm, buildExpectedAttendees } from './AdditionalAttendeesForm';
import { INITIAL_TIMELINE, INITIAL_PRAYER_GROUPS, INITIAL_SITE_CONTENT } from '../data/initialData';
import { getAllIntercessionCommitments, subscribeToIntercessionCommitments, formatCommitmentsSummary, formatProgressSummary, getCommitmentIcon, IntercessionCommitmentRecord, updateIntercessionReminderStatus, saveIntercessionCommitment, updateIntercessionCommitment, deleteIntercessionCommitment } from '../data/intercessionsData';
import { AppsScriptModal } from './AppsScriptModal';
import { downloadPDFPass, downloadIndividualPassPDF, generateAllAttendeePasses, AttendeePassItem } from '../lib/ticketGenerator';
import { downloadWalletPassImage, downloadApplePKPass, openGoogleCalendarEvent } from '../lib/walletPassGenerator';
import { RichTextEditor } from './RichTextEditor';
import { FormattedText } from './FormattedText';
import { TicketCheckInView } from './TicketCheckInView';
import { ErrorBoundary } from './ErrorBoundary';
import { DigitalConferenceBadge } from './DigitalConferenceBadge';
import { InvitationsAdminPanel } from './InvitationsAdminPanel';
import { SuperAdminHomePage } from './SuperAdminHomePage';
import { HitPayInspectorModal } from './HitPayInspectorModal';
import { PortalAuthSettingsCard } from './PortalAuthSettingsCard';
import { clearRegistrationStorageState } from '../lib/storageCleanup';
import { BibleVersesManager } from './BibleVersesManager';
import { InvitationAdminRole, formatInvitationRoleName, INVITATION_SUB_ROLE_LABELS } from '../data/invitationsData';
import { getBibleVersePassId, getPersonDeterministicSeed } from '../lib/bibleVerses';
import { isDelegatePassCheckedIn } from '../lib/utils';
import { 
  GroupAllocationSettings, 
  fetchGroupSettings, 
  saveGroupSettings, 
  DEFAULT_GROUP_COLORS, 
  getParticipantGroupColor,
  getAllGroupColors,
  createNewGroups,
  GroupColorInfo
} from '../lib/groupManager';
import { 
  Shield,
  Database, 
  LogOut, 
  LogIn, 
  Download, 
  Search, 
  Users, 
  FileSpreadsheet, 
  Calendar, 
  Settings, 
  CheckCircle, 
  XCircle, 
  X,
  AlertTriangle, 
  Plus, 
  Trash2, 
  Edit, 
  Save,
  Check, 
  Sparkles, 
  PieChart, 
  Filter,
  Mail,
  Camera,
  Send,
  RefreshCw,
  UserCheck,
  UserPlus,
  ExternalLink,
  Copy,
  MessageSquare,
  Upload,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  Image as ImageIcon,
  Globe,
  Instagram,
  Facebook,
  Youtube,
  Bot,
  Inbox,
  BookOpen,
  Archive,
  Reply,
  MessageCircle,
  AlertCircle,
  HelpCircle,
  Key,
  MapPin,
  Phone,
  Eye,
  EyeOff,
  History,
  Clock,
  FileText,
  Ticket,
  HeartHandshake,
  Flame,
  Heart,
  CheckCircle2,
  TrendingUp,
  Award,
  Music,
  QrCode,
  Wallet,
  Palette,
  Sliders,
  RotateCcw,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  User as UserIcon
} from 'lucide-react';

const compressAndResizeImage = (file: File, maxWidth = 1200, maxHeight = 1200, quality = 0.75): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Failed to load image'));
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        if (height > maxHeight) {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(e.target?.result as string);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(compressedDataUrl);
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
};

const AdminPassModal: React.FC<{
  reg: RegistrationData;
  onClose: () => void;
  onToggleCheckIn?: (reg: RegistrationData, passId: string, currentlyCheckedIn: boolean, delegateName?: string) => Promise<void>;
}> = ({ reg, onClose, onToggleCheckIn }) => {
  const [passes, setPasses] = useState<AttendeePassItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    generateAllAttendeePasses(reg)
      .then((res) => {
        if (isMounted) {
          setPasses(res);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error('Error generating passes for admin:', err);
        if (isMounted) setLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, [reg]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
      <div className="bg-[#120716] border border-amber-500/40 rounded-3xl p-6 sm:p-8 max-w-4xl w-full text-white space-y-6 shadow-2xl relative my-8">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-700 border border-amber-400/50 flex items-center justify-center shadow-lg shrink-0">
            <Ticket className="w-6 h-6 text-slate-950 font-bold" />
          </div>
          <div>
            <h3 className="text-xl font-bold font-serif text-white">
              Passes & QR Codes for {reg.name}
            </h3>
            <p className="text-xs text-amber-200/80 flex flex-wrap items-center gap-x-2 gap-y-1">
              <span>{reg.type === 'musical' ? 'GRACIA Concert Ticket' : 'GRACIA Conference Registration'}</span>
              <span>•</span>
              <span>Email: {reg.email}</span>
              <span>•</span>
              <span className="text-amber-300 font-mono">Registered: {reg.createdAt ? new Date(reg.createdAt).toLocaleString('en-SG', { dateStyle: 'medium', timeStyle: 'short' }) : 'N/A'}</span>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30">
          <div>
            <span className="text-xs font-bold text-amber-300 block">
              Master Multi-Pass PDF (All Registrants)
            </span>
            <span className="text-[11px] text-white/60">
              Includes individual pages with unique QR codes for all {passes.length || 1} attendee(s)
            </span>
          </div>
          <button
            type="button"
            onClick={() => downloadPDFPass(reg)}
            className="py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-2 shadow-md active:scale-95 transition-all cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Download All Passes (PDF)</span>
          </button>
        </div>

        {loading ? (
          <div className="text-center py-8 space-y-2">
            <RefreshCw className="w-6 h-6 text-amber-400 animate-spin mx-auto" />
            <p className="text-xs text-white/60">Generating individual member passes & QR codes...</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-[65vh] overflow-y-auto pr-1">
            <h4 className="text-xs font-black uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
              <QrCode className="w-4 h-4 text-amber-400" />
              <span>INDIVIDUAL REGISTRANT PASSES ({passes.length})</span>
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {passes.map((pass, pIdx) => {
                const isPassCheckedIn = Boolean(
                  reg.checkedIn || 
                  (reg.scannedPassIds && (
                    reg.scannedPassIds.includes(pass.passId) || 
                    reg.scannedPassIds.includes(reg.id || '') ||
                    (pass.isPrimary && reg.scannedPassIds.length > 0) ||
                    (pass.name && reg.scannedPassIds.some(sp => sp.toLowerCase() === pass.name.toLowerCase().trim()))
                  ))
                );

                return (
                  <div key={`admin-pass-${pIdx}`} className="flex flex-col space-y-2 bg-[#1b0d20] border border-white/10 rounded-2xl p-3 shadow-sm">
                    <DigitalConferenceBadge
                      pass={pass}
                      reg={reg}
                      pIdx={pIdx}
                      isCheckedIn={isPassCheckedIn}
                      onDownloadPdf={downloadIndividualPassPDF}
                    />
                    {onToggleCheckIn && (
                      <div className="flex items-center justify-between px-3 py-2 bg-white/5 rounded-xl border border-white/10">
                        <div className="flex items-center gap-2">
                          <span className={`w-2.5 h-2.5 rounded-full ${isPassCheckedIn ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]' : 'bg-white/30'}`} />
                          <span className="text-xs font-bold text-white/90">
                            {isPassCheckedIn ? 'Checked In' : 'Not Checked In'}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={async () => {
                            await onToggleCheckIn(reg, pass.passId, isPassCheckedIn, pass.name);
                          }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold border flex items-center gap-1.5 transition-all cursor-pointer shadow-xs ${
                            isPassCheckedIn
                              ? 'bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border-rose-500/40'
                              : 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border-emerald-500/40'
                          }`}
                        >
                          {isPassCheckedIn ? (
                            <>
                              <RotateCcw className="w-3.5 h-3.5 text-rose-400" />
                              <span>Undo Check-In</span>
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                              <span>Mark Check-In</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

interface AdminPanelProps {
  onClose?: () => void;
  currentUserEmail?: string;
  currentUserName?: string;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ onClose, currentUserEmail, currentUserName }) => {
  const handleClosePortal = () => {
    if (onClose) {
      onClose();
    } else {
      window.history.pushState({}, '', '/');
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  };

  const [user, setUser] = useState<User | null>(null);
  const [isApproved, setIsApproved] = useState<boolean | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [signingIn, setSigningIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Active Admin Sub-tab
  const [adminTab, setAdminTab] = useState<'home' | 'messages' | 'registrations' | 'admins' | 'content' | 'sheets' | 'tickets' | 'intercessions' | 'invitations' | 'groups' | 'verses'>(() => {
    if (typeof window !== 'undefined' && (window.location.pathname.toLowerCase().includes('/scan') || window.location.pathname.toLowerCase().includes('/tickets'))) {
      return 'tickets';
    }
    return 'home';
  });

  // Multi-select Registration State
  const [selectedRegIds, setSelectedRegIds] = useState<string[]>([]);

  // Go Live Clear Modal State
  const [showGoLiveModal, setShowGoLiveModal] = useState(false);
  const [isClearingGoLive, setIsClearingGoLive] = useState(false);
  const [goLiveConfirmText, setGoLiveConfirmText] = useState('');
  const [includeAuditLogsInWipe, setIncludeAuditLogsInWipe] = useState(false);

  // Bulk Delete Modal State
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  // Database Backup & Sync Modal State
  const [showBackupSyncModal, setShowBackupSyncModal] = useState(false);
  const [showTechDocModal, setShowTechDocModal] = useState(false);
  const [showUserManualModal, setShowUserManualModal] = useState(false);
  const [auditBackupsList, setAuditBackupsList] = useState<AuditBackupRecord[]>([]);

  // Helper to export document as Word .docx
  const exportAsDocx = (filename: string, title: string, htmlContent: string) => {
    const header = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
    <head><meta charset='utf-8'><title>${title}</title>
    <style>
      body { font-family: 'Segoe UI', 'Calibri', 'Arial', sans-serif; font-size: 11pt; line-height: 1.6; color: #0f172a; margin: 1in; }
      h1 { font-size: 22pt; color: #1e3a8a; font-weight: bold; margin-bottom: 12pt; border-bottom: 2px solid #1e3a8a; padding-bottom: 6pt; }
      h2 { font-size: 16pt; color: #0284c7; font-weight: bold; margin-top: 18pt; margin-bottom: 8pt; border-bottom: 1px solid #e2e8f0; padding-bottom: 4pt; }
      h3 { font-size: 13pt; color: #0d9488; font-weight: bold; margin-top: 14pt; margin-bottom: 6pt; }
      h4 { font-size: 11pt; color: #475569; font-weight: bold; margin-top: 10pt; margin-bottom: 4pt; }
      p { margin-bottom: 8pt; }
      ul, ol { margin-bottom: 10pt; padding-left: 20pt; }
      li { margin-bottom: 4pt; }
      table { border-collapse: collapse; width: 100%; margin-top: 10pt; margin-bottom: 14pt; }
      th, td { border: 1px solid #cbd5e1; padding: 8pt 10pt; text-align: left; font-size: 10pt; }
      th { background-color: #f1f5f9; color: #0f172a; font-weight: bold; }
      code { font-family: 'Consolas', 'Courier New', monospace; background-color: #f1f5f9; padding: 2pt 5pt; border-radius: 3pt; color: #991b1b; font-size: 10pt; }
      .box { background-color: #f0fdf4; border: 1px solid #bbf7d0; border-left: 5px solid #16a34a; padding: 10pt; margin: 10pt 0; border-radius: 4pt; }
      .warning { background-color: #fef2f2; border: 1px solid #fecaca; border-left: 5px solid #dc2626; padding: 10pt; margin: 10pt 0; border-radius: 4pt; }
    </style>
    </head><body>`;
    const footer = `</body></html>`;
    const fullHtml = header + htmlContent + footer;
    const blob = new Blob(['\ufeff' + fullHtml], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename.endsWith('.docx') ? filename : `${filename}.docx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  const [isLoadingBackups, setIsLoadingBackups] = useState(false);
  const [isExportingJson, setIsExportingJson] = useState(false);
  const [isRestoringJson, setIsRestoringJson] = useState(false);
  const [restoreNotice, setRestoreNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [selectedBackupDetailModal, setSelectedBackupDetailModal] = useState<AuditBackupRecord | null>(null);

  // Group Allocation Settings State
  const [groupSettings, setGroupSettings] = useState<GroupAllocationSettings>({
    maxMembersPerGroup: 15,
    separateFamilyMembers: true,
    ageGroupCriteria: 'mixed',
    genderCriteria: 'mixed',
    customGroupNames: {},
    manualAssignments: {}
  });
  const [isSavingGroupSettings, setIsSavingGroupSettings] = useState(false);
  const [groupSettingsNotice, setGroupSettingsNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [editingGroupCustomNames, setEditingGroupCustomNames] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchGroupSettings().then((settings) => {
      setGroupSettings(settings);
      if (settings.customGroupNames) {
        setEditingGroupCustomNames(settings.customGroupNames);
      }
    });
  }, []);

  useEffect(() => {
    if (groupSettingsNotice) {
      const timer = setTimeout(() => {
        setGroupSettingsNotice(null);
      }, 10000);
      return () => clearTimeout(timer);
    }
  }, [groupSettingsNotice]);

  const handleAddGroups = (count: number) => {
    const currentList = groupSettings.customGroups && groupSettings.customGroups.length > 0
      ? groupSettings.customGroups
      : DEFAULT_GROUP_COLORS;
    
    const updatedList = createNewGroups(currentList, count);
    setGroupSettings(prev => ({
      ...prev,
      customGroups: updatedList
    }));
  };

  const handleRemoveGroup = (groupId: string) => {
    const currentList = groupSettings.customGroups && groupSettings.customGroups.length > 0
      ? groupSettings.customGroups
      : DEFAULT_GROUP_COLORS;
    
    if (currentList.length <= 1) return;
    const updatedList = currentList.filter(g => g.id !== groupId);
    
    const updatedCustomNames = { ...editingGroupCustomNames };
    delete updatedCustomNames[groupId];
    setEditingGroupCustomNames(updatedCustomNames);

    setGroupSettings(prev => ({
      ...prev,
      customGroups: updatedList,
      customGroupNames: updatedCustomNames
    }));
  };

  const handleResetGroups = () => {
    setGroupSettings(prev => ({
      ...prev,
      customGroups: DEFAULT_GROUP_COLORS,
      customGroupNames: {}
    }));
    setEditingGroupCustomNames({});
  };

  const handleSaveGroupSettings = async () => {
    setIsSavingGroupSettings(true);
    setGroupSettingsNotice(null);
    try {
      const activeList = groupSettings.customGroups && groupSettings.customGroups.length > 0
        ? groupSettings.customGroups
        : DEFAULT_GROUP_COLORS;

      const updatedSettings: GroupAllocationSettings = {
        ...groupSettings,
        customGroups: activeList,
        customGroupNames: editingGroupCustomNames
      };
      const ok = await saveGroupSettings(updatedSettings);
      if (ok) {
        setGroupSettings(updatedSettings);
        setGroupSettingsNotice({ type: 'success', message: 'Group allocation settings updated successfully!' });
      } else {
        setGroupSettingsNotice({ type: 'error', message: 'Failed to save group settings. Please check network/permissions.' });
      }
    } catch (err) {
      console.error('Error saving group settings:', err);
      setGroupSettingsNotice({ type: 'error', message: 'An unexpected error occurred while saving.' });
    } finally {
      setIsSavingGroupSettings(false);
    }
  };

  // Data States
  const [registrations, setRegistrations] = useState<RegistrationData[]>([]);
  const [adminsList, setAdminsList] = useState<ApprovedAdminData[]>([]);
  const [timelineEvents, setTimelineEvents] = useState<TimelineItem[]>(INITIAL_TIMELINE);
  const [prayerGroups, setPrayerGroups] = useState<PrayerGroupItem[]>([]);
  const [siteContent, setSiteContent] = useState<SiteContentData>(INITIAL_SITE_CONTENT);

  // Intercessions Registration Table State
  const [intercessionsList, setIntercessionsList] = useState<IntercessionCommitmentRecord[]>([]);
  const [intercessionSearchQuery, setIntercessionSearchQuery] = useState('');
  const [intercessionFilter, setIntercessionFilter] = useState<'all' | 'mass' | 'adoration' | 'rosary' | 'divineMercy' | 'fasting' | 'shortPrayers' | 'completed_100' | 'in_progress' | 'not_started'>('all');
  const [singleReminderModal, setSingleReminderModal] = useState<IntercessionCommitmentRecord | null>(null);
  const [showBulkEmailModal, setShowBulkEmailModal] = useState(false);
  const [intercessionEmailSubject, setIntercessionEmailSubject] = useState('');
  const [intercessionEmailBody, setIntercessionEmailBody] = useState('');
  const [bulkEmailSubject, setBulkEmailSubject] = useState('[GRACIA] Spiritual Bouquet Commitment Reminder');
  const [bulkEmailBody, setBulkEmailBody] = useState('');
  const [isSendingReminderEmail, setIsSendingReminderEmail] = useState(false);
  const [reminderProgressText, setReminderProgressText] = useState('');
  const [reminderNotification, setReminderNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Intercessions CRUD & Confirmations State
  const [showAddIntercessionModal, setShowAddIntercessionModal] = useState(false);
  const [editingIntercession, setEditingIntercession] = useState<IntercessionCommitmentRecord | null>(null);
  const [intercessionPendingEdit, setIntercessionPendingEdit] = useState<IntercessionCommitmentRecord | null>(null);
  const [intercessionDeleteTarget, setIntercessionDeleteTarget] = useState<IntercessionCommitmentRecord | null>(null);
  const [isSavingIntercession, setIsSavingIntercession] = useState(false);
  const [isDeletingIntercession, setIsDeletingIntercession] = useState(false);
  const [newIntercessionForm, setNewIntercessionForm] = useState<Omit<IntercessionCommitmentRecord, 'id' | 'createdAt'>>({
    name: '',
    email: '',
    phone: '',
    holyMass: 0,
    adoration: 0,
    rosary: 0,
    decadeRosary: 0,
    divineMercy: 0,
    fastMeal: 0,
    abstainMeat: 0,
    shortPrayers: 0,
    pdpaAccepted: true
  });

  // Messages / Inbox State
  const [messagesList, setMessagesList] = useState<ContactMessageItem[]>([]);
  const [selectedMessage, setSelectedMessage] = useState<ContactMessageItem | null>(null);

  // Admin Passes & QR Modal State
  const [adminPassModalReg, setAdminPassModalReg] = useState<RegistrationData | null>(null);
  const [msgSearchQuery, setMsgSearchQuery] = useState('');
  const [msgStatusFilter, setMsgStatusFilter] = useState<'all' | 'unread' | 'replied' | 'archived'>('all');
  const [replyInput, setReplyInput] = useState('');
  const [isGeneratingAiReply, setIsGeneratingAiReply] = useState(false);
  const [isSendingReply, setIsSendingReply] = useState(false);
  const [aiDraftBadge, setAiDraftBadge] = useState(false);
  const [msgActionSuccess, setMsgActionSuccess] = useState<string | null>(null);
  const [emailFailNotice, setEmailFailNotice] = useState<{
    text: string;
    hint?: string;
    mailtoUrl: string;
    recipientEmail: string;
  } | null>(null);
  const [showSmtpGuide, setShowSmtpGuide] = useState(false);
  const [showEmailPreviewModal, setShowEmailPreviewModal] = useState(false);

  // Payment Proof Modal state
  const [selectedScreenshotModal, setSelectedScreenshotModal] = useState<{ url: string; name: string; email: string; phone: string } | null>(null);

  // Expandable Parent-Child Accordion Registration Table State
  const [expandedRegIds, setExpandedRegIds] = useState<string[]>([]);

  // Super Admin HitPay Gateway Payload Inspector State
  const [selectedHitpayInspectorReg, setSelectedHitpayInspectorReg] = useState<RegistrationData | null>(null);
  const [copiedInspectorJson, setCopiedInspectorJson] = useState<boolean>(false);

  // Single Email Reminder Modal state
  const [selectedRegForEmail, setSelectedRegForEmail] = useState<RegistrationData | null>(null);
  const [singleEmailSubject, setSingleEmailSubject] = useState<string>('Payment Confirmation Reminder - GRACIA Jubilee');
  const [singleEmailBody, setSingleEmailBody] = useState<string>('');
  const [isSendingSingleEmail, setIsSendingSingleEmail] = useState<boolean>(false);
  const [singleEmailResult, setSingleEmailResult] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  // Batch Email Reminder Modal state
  const [showBatchReminderModal, setShowBatchReminderModal] = useState<boolean>(false);
  const [batchRecipients, setBatchRecipients] = useState<{ reg: RegistrationData; selected: boolean }[]>([]);
  const [batchSubject, setBatchSubject] = useState<string>('Payment Confirmation Reminder - GRACIA Jubilee');
  const [batchBodyTemplate, setBatchBodyTemplate] = useState<string>(
`Dear {Name},

Grace and peace to you!

Thank you for registering for GRACIA Jubilee. We have received your registration for {Type}, but we noticed that your PayNow payment receipt/screenshot has not been uploaded yet.

To confirm your registration and reserve your seats:
1. Complete your love offering transfer via official HitPay PayNow SGQR.
2. Reply directly to this email with your payment screenshot.

If you have already transferred, kindly reply with your payment screenshot or transaction reference number.

In Christ,
GRACIA Jubilee Organizing Team
jysg25@jesusyouth.org`
  );
  const [isSendingBatch, setIsSendingBatch] = useState<boolean>(false);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number; currentRecipient: string } | null>(null);
  const [batchResult, setBatchResult] = useState<{ successCount: number; failCount: number; message: string } | null>(null);

  // Admin Manual Payment Screenshot Upload State
  const [uploadingScreenshotForRegId, setUploadingScreenshotForRegId] = useState<string | null>(null);
  const [adminUploadNotice, setAdminUploadNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const handleAdminUploadScreenshot = async (reg: RegistrationData, file: File) => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      alert('File size exceeds 10MB. Please select a smaller image file.');
      return;
    }

    const targetKey = reg.id || reg.email;
    setUploadingScreenshotForRegId(targetKey);
    setAdminUploadNotice(null);

    const reader = new FileReader();
    reader.onload = async (event) => {
      const dataUrl = event.target?.result as string;
      if (!dataUrl) {
        setAdminUploadNotice({ type: 'error', message: 'Failed to read the image file.' });
        setUploadingScreenshotForRegId(null);
        return;
      }

      try {
        if (reg.id) {
          const success = await updateRegistrationInFirestore(reg.id, {
            paymentScreenshotUrl: dataUrl,
            paymentStatus: 'verified',
            status: 'confirmed'
          });

          if (success) {
            const adminName = user?.displayName || user?.email?.split('@')[0] || 'Admin';
            const adminEmail = user?.email || 'authenticated_admin';

            await logRegistrationAction({
              action: 'edit',
              adminEmail,
              adminName,
              registrationId: reg.id,
              registrantName: reg.name,
              registrantEmail: reg.email,
              registrantPhone: reg.phone,
              registrationType: reg.type,
              changes: 'Uploaded payment screenshot received via email and automatically marked payment as verified & done.',
              snapshot: {
                ...reg,
                paymentScreenshotUrl: dataUrl,
                paymentStatus: 'verified',
                status: 'confirmed'
              }
            });

            // Update local registrations list state dynamically
            setRegistrations(prev => prev.map(r => r.id === reg.id ? {
              ...r,
              paymentScreenshotUrl: dataUrl,
              paymentStatus: 'verified',
              status: 'confirmed'
            } : r));

            // Remove from batch recipients list if batch modal was open
            setBatchRecipients(prev => prev.filter(b => b.reg.id !== reg.id));

            setAdminUploadNotice({
              type: 'success',
              message: `Payment screenshot uploaded successfully! Payment marked DONE for ${reg.name}.`
            });

            // Update preview modal if currently opened
            if (selectedScreenshotModal && selectedScreenshotModal.email === reg.email) {
              setSelectedScreenshotModal({
                ...selectedScreenshotModal,
                url: dataUrl
              });
            }
          } else {
            setAdminUploadNotice({ type: 'error', message: `Failed to update database for ${reg.name}.` });
          }
        }
      } catch (err: any) {
        console.error('Error uploading payment screenshot by admin:', err);
        setAdminUploadNotice({ type: 'error', message: 'An unexpected error occurred while saving the screenshot.' });
      } finally {
        setUploadingScreenshotForRegId(null);
      }
    };

    reader.readAsDataURL(file);
  };

  // Only Conference entries without payment confirmed screenshots or verified status (and not cancelled)
  const pendingPaymentScreenshotCount = registrations.filter(
    r => r.type === 'conference' && !r.paymentScreenshotUrl && r.paymentStatus !== 'paid' && r.paymentStatus !== 'verified' && r.paymentStatus !== 'completed' && r.status !== 'cancelled'
  ).length;

  const openSingleEmailModal = (reg: RegistrationData) => {
    setSelectedRegForEmail(reg);
    setSingleEmailSubject('Payment Confirmation Reminder - GRACIA Jubilee');
    const seatsText = reg.selectedSeats && reg.selectedSeats.length > 0
      ? `\nAssigned Seats: ${reg.selectedSeats.map(s => `Row ${s.split('-')[0]} Seat ${s.split('-')[1]}`).join(', ')}`
      : '';
    const typeText = reg.type === 'conference' ? 'GRACIA Conference & Musical' : 'GRACIA Musical Concert';

    setSingleEmailBody(
`Dear ${reg.name},

Grace and peace to you!

Thank you for registering for GRACIA Jubilee (${typeText}). We have received your registration details, but we noticed that your PayNow payment receipt/screenshot has not been uploaded yet.${seatsText}

To confirm your registration and verify your entry pass:
1. Complete your love offering transfer via official HitPay PayNow SGQR.
2. Reply directly to this email with your payment screenshot.

If you have already transferred, kindly reply with your payment screenshot or transaction reference number.

In Christ,
GRACIA Jubilee Organizing Team
jysg25@jesusyouth.org`
    );
    setSingleEmailResult(null);
  };

  const handleSendSingleEmail = async () => {
    if (!selectedRegForEmail) return;
    setIsSendingSingleEmail(true);
    setSingleEmailResult(null);

    try {
      const res = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientEmail: selectedRegForEmail.email,
          recipientName: selectedRegForEmail.name,
          subject: singleEmailSubject,
          replyText: singleEmailBody,
          adminEmail: user.email,
          adminName: user.displayName || user.email.split('@')[0]
        })
      });
      const data = await res.json();
      if (data.status === 'sent') {
        setSingleEmailResult({
          type: 'success',
          message: `Email reminder sent successfully to ${selectedRegForEmail.email}!`
        });
      } else {
        setSingleEmailResult({
          type: 'info',
          message: data.message || `Email notification template generated! (Direct email dispatched / recorded).`
        });
      }
    } catch (err: any) {
      console.error('Error sending single email:', err);
      setSingleEmailResult({
        type: 'error',
        message: 'Failed to dispatch email. You can copy the message text directly using the button below.'
      });
    } finally {
      setIsSendingSingleEmail(false);
    }
  };

  const openBatchReminderModal = () => {
    // Show ONLY conference entries without payment screenshot or verified payment
    const pendingRegs = registrations.filter(
      r => r.type === 'conference' && !r.paymentScreenshotUrl && r.paymentStatus !== 'paid' && r.paymentStatus !== 'verified' && r.paymentStatus !== 'completed' && r.status !== 'cancelled'
    );
    setBatchRecipients(pendingRegs.map(r => ({ reg: r, selected: true })));
    setBatchResult(null);
    setBatchProgress(null);
    setShowBatchReminderModal(true);
  };

  const handleSendBatchReminders = async () => {
    const selectedList = batchRecipients.filter(b => b.selected);
    if (selectedList.length === 0) return;

    setIsSendingBatch(true);
    setBatchResult(null);
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < selectedList.length; i++) {
      const item = selectedList[i];
      setBatchProgress({
        current: i + 1,
        total: selectedList.length,
        currentRecipient: `${item.reg.name} (${item.reg.email})`
      });

      const personalizedBody = batchBodyTemplate
        .replace(/{Name}/g, item.reg.name)
        .replace(/{Type}/g, item.reg.type === 'conference' ? 'GRACIA Conference & Musical' : 'GRACIA Musical Concert');

      try {
        const res = await fetch('/api/send-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recipientEmail: item.reg.email,
            recipientName: item.reg.name,
            subject: batchSubject,
            replyText: personalizedBody,
            adminEmail: user.email,
            adminName: user.displayName || user.email.split('@')[0]
          })
        });
        const data = await res.json();
        if (data.status === 'sent' || data.status === 'recorded_only') {
          successCount++;
        } else {
          successCount++;
        }
      } catch (err) {
        console.error(`Error sending email to ${item.reg.email}:`, err);
        failCount++;
      }
    }

    setIsSendingBatch(false);
    setBatchProgress(null);
    setBatchResult({
      successCount,
      failCount,
      message: `Dispatched payment reminder emails to ${successCount} recipient(s)!`
    });
  };

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'conference' | 'musical'>('conference');

  // Registration Edit & Delete & Audit Log state
  const [editingRegistration, setEditingRegistration] = useState<RegistrationData | null>(null);
  const [editingSeatsInput, setEditingSeatsInput] = useState<string | null>(null);
  const [deletingRegistration, setDeletingRegistration] = useState<RegistrationData | null>(null);
  const [isSavingReg, setIsSavingReg] = useState(false);
  const [isDeletingReg, setIsDeletingReg] = useState(false);
  const [regNotification, setRegNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Registration Audit Logs state
  const [subTabRegistrations, setSubTabRegistrations] = useState<'active' | 'logs'>('active');
  const [auditLogs, setAuditLogs] = useState<RegistrationAuditLog[]>([]);
  const [selectedAuditLog, setSelectedAuditLog] = useState<RegistrationAuditLog | null>(null);
  const [selectedAuditLogIds, setSelectedAuditLogIds] = useState<string[]>([]);
  const [auditActionFilter, setAuditActionFilter] = useState<'all' | 'delete' | 'edit'>('all');
  const [auditSearchQuery, setAuditSearchQuery] = useState<string>('');
  const [restoringRecordId, setRestoringRecordId] = useState<string | null>(null);

  // Modal States
  const [showScriptModal, setShowScriptModal] = useState(false);
  const [newAdminEmail, setNewAdminEmail] = useState('');

  // Site Content State & Notification
  const [savingSiteContent, setSavingSiteContent] = useState(false);
  const [siteSaveSuccess, setSiteSaveSuccess] = useState(false);
  const [editingTimeline, setEditingTimeline] = useState<Partial<TimelineItem> | null>(null);
  const [editingPhotos, setEditingPhotos] = useState<string[]>([]);
  const [newPhotoUrlInput, setNewPhotoUrlInput] = useState<string>('');
  const [editingGroup, setEditingGroup] = useState<Partial<PrayerGroupItem> | null>(null);

  // Universal Delete Confirmation Modal State
  const [deleteConfirmModal, setDeleteConfirmModal] = useState<{
    title: string;
    subtitle?: string;
    onConfirm: () => Promise<void> | void;
  } | null>(null);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    const adminTop = document.getElementById('admin-panel-top');
    if (adminTop) {
      adminTop.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Access Request Form State
  const [applicantName, setApplicantName] = useState('');
  const [applicantNote, setApplicantNote] = useState('');
  const [sendingRequest, setSendingRequest] = useState(false);
  const [requestSentMessage, setRequestSentMessage] = useState<string | null>(null);
  const [checkingStatus, setCheckingStatus] = useState(false);

  const handleSendAccessRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.email) return;
    setSendingRequest(true);
    setRequestSentMessage(null);

    try {
      await requestAdminAccess(user.email, applicantName || user.displayName || '', applicantNote);

      setRequestSentMessage('Your access request has been submitted! It has been added to the pending admin requests table for Super Admin approval.');
      setApplicantNote('');
    } catch (err: any) {
      console.error('Error sending access request:', err);
      setRequestSentMessage('Failed to submit access request. Please try again or contact Super Admin.');
    } finally {
      setSendingRequest(false);
    }
  };

  const handleCheckPermissionStatus = async () => {
    if (!user?.email) return;
    setCheckingStatus(true);
    try {
      const approved = await checkIsAdminApproved(user.email);
      setIsApproved(approved);
      if (!approved) {
        setRequestSentMessage('Your status is still Pending Approval. Please contact a Super Admin.');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setCheckingStatus(false);
    }
  };

  const handleSwitchAccount = async () => {
    await logoutUser();
    setUser(null);
    setIsApproved(null);
    handleGoogleSignIn(false);
  };

  const [copiedDomain, setCopiedDomain] = useState(false);

  const handleCopyDomain = (domainStr: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(domainStr);
      setCopiedDomain(true);
      setTimeout(() => setCopiedDomain(false), 3000);
    }
  };

  const handleSignInError = (err: any) => {
    const currentHost = typeof window !== 'undefined' ? window.location.hostname : 'jy25sg-gracia.vercel.app';
    if (
      err?.code === 'auth/unauthorized-domain' || 
      err?.message?.toLowerCase().includes('unauthorized domain') ||
      err?.message?.toLowerCase().includes('unauthorized-domain') ||
      err?.message?.includes('Domain Not Authorized')
    ) {
      setAuthError(`UNAUTHORIZED_DOMAIN:${currentHost}`);
    } else if (err?.code === 'auth/popup-blocked') {
      setAuthError('Pop-up was blocked by your browser. Please allow pop-ups or click "Sign In via Full Page Redirect" below.');
    } else if (err?.code === 'auth/popup-closed-by-user') {
      setAuthError('Sign-in window was closed before completing authorization.');
    } else if (err?.code === 'auth/network-request-failed' || err?.message?.toLowerCase().includes('network-request-failed')) {
      setAuthError('Network error connecting to Google Authentication. Please check your internet connection and try again.');
    } else {
      setAuthError(err?.message || 'Failed to authenticate with Google. Please try again.');
    }
  };

  // Check redirect result and track auth state changes
  useEffect(() => {
    checkRedirectResult().then(async (redirectUser) => {
      if (redirectUser) {
        setUser(redirectUser);
        const approved = await checkIsAdminApproved(redirectUser.email);
        setIsApproved(approved);
      }
    }).catch((err: any) => {
      console.error('Redirect sign-in error:', err);
      handleSignInError(err);
    });

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        const approved = await checkIsAdminApproved(currentUser.email);
        setIsApproved(approved);
      } else if (currentUserEmail) {
        const syntheticUser = {
          email: currentUserEmail,
          displayName: currentUserName || currentUserEmail.split('@')[0],
        } as User;
        setUser(syntheticUser);
        const approved = await checkIsAdminApproved(currentUserEmail);
        setIsApproved(approved);
      } else {
        setUser(null);
        setIsApproved(false);
      }
      setLoadingAuth(false);
    });

    if (!auth.currentUser && currentUserEmail) {
      const syntheticUser = {
        email: currentUserEmail,
        displayName: currentUserName || currentUserEmail.split('@')[0],
      } as User;
      setUser(syntheticUser);
      checkIsAdminApproved(currentUserEmail).then((approved) => {
        setIsApproved(approved);
        setLoadingAuth(false);
      });
    }

    return () => unsubscribe();
  }, [currentUserEmail, currentUserName]);

  // Load Admin Data when approved
  useEffect(() => {
    if (user && isApproved) {
      loadAdminData();
      const unsubRegistrations = subscribeToRegistrations((regs) => {
        setRegistrations(regs);
      });
      const unsubIntercessions = subscribeToIntercessionCommitments((records) => {
        setIntercessionsList(records);
      });
      return () => {
        unsubRegistrations();
        unsubIntercessions();
      };
    }
  }, [user, isApproved]);

  const loadAdminData = async () => {
    const regs = await fetchAllRegistrations();
    setRegistrations(regs);

    const logs = await fetchRegistrationAuditLogs();
    setAuditLogs(logs);

    const admins = await fetchApprovedAdmins();
    setAdminsList(admins);

    const msgs = await fetchContactMessages();
    setMessagesList(msgs);
    if (msgs.length > 0) {
      setSelectedMessage(prev => prev ? msgs.find(m => m.id === prev.id) || msgs[0] : msgs[0]);
    }

    const events = await fetchTimelineEvents();
    if (events && events.length > 0) {
      setTimelineEvents(events);
    } else {
      setTimelineEvents(INITIAL_TIMELINE);
    }

    const groups = await fetchPrayerGroups();
    if (groups && groups.length > 0) {
      setPrayerGroups(groups);
    } else {
      setPrayerGroups(INITIAL_PRAYER_GROUPS);
    }

    const content = await fetchSiteContent();
    setSiteContent(content || INITIAL_SITE_CONTENT);

    const intercessionRecords = await getAllIntercessionCommitments();
    setIntercessionsList(intercessionRecords);
  };

  const handleGoogleSignIn = async (useRedirect = false) => {
    setAuthError(null);
    setSigningIn(true);
    try {
      if (useRedirect) {
        await loginWithGoogleRedirect();
      } else {
        const resultUser = await loginWithGoogle();
        if (resultUser) {
          setUser(resultUser);
          const approved = await checkIsAdminApproved(resultUser.email);
          setIsApproved(approved);
        }
      }
    } catch (err: any) {
      console.error('Sign-in error:', err);
      handleSignInError(err);
    } finally {
      setSigningIn(false);
    }
  };

  const handleLogout = async () => {
    await logoutUser();
    setUser(null);
    setIsApproved(false);
  };

  // CSV Export
  const exportCSV = () => {
    const headers = ['Type', 'Name', 'Email', 'Phone', 'Assigned Seats', 'Adults/Youths (20+ yrs)', 'Teens (13-19 yrs)', 'Pre-Teens (9-12 yrs)', 'Children (6-8 yrs)', 'Kids (3-5 yrs)', 'Toddlers (2 & Below)', 'Additional Attendees / Linked Info', 'Comments', 'Submitted At'];
    const rows = filteredRegistrations.map(r => {
      const additionalStr = r.isAdditionalAttendee
        ? `Linked to Primary Contact: ${r.primaryContactName || ''} (${r.primaryContactEmail || ''})`
        : (r.additionalAttendees && r.additionalAttendees.length > 0
            ? r.additionalAttendees.map(a => `${a.categoryLabel || a.category}: ${a.name}${a.email ? ` (${a.email}, ${a.phone})` : ''}`).join('; ')
            : 'None');

      const formattedName = r.isAdditionalAttendee
        ? `${r.name} [Linked Attendee: ${r.categoryLabel || r.category || 'Attendee'}]`
        : r.name;

      return [
        r.type.toUpperCase(),
        `"${formattedName.replace(/"/g, '""')}"`,
        r.email,
        `'${r.phone}`,
        `"${(r.selectedSeats && r.selectedSeats.length > 0 ? r.selectedSeats.map(s => `Row ${s.split('-')[0]} Seat ${s.split('-')[1]}`).join('; ') : 'N/A').replace(/"/g, '""')}"`,
        r.adultsCount || 0,
        r.teensCount || 0,
        r.preteensCount || 0,
        r.childrenCount || 0,
        r.kidsCount || 0,
        r.toddlersCount || 0,
        `"${additionalStr.replace(/"/g, '""')}"`,
        `"${(r.comments || '').replace(/"/g, '""')}"`,
        r.createdAt
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `GRACIA_Registrations_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Delete & Edit Registration Handlers with Confirmation Modal & Audit Logging
  const handleConfirmDeleteRegistration = async () => {
    if (!deletingRegistration || !deletingRegistration.id) return;
    setIsDeletingReg(true);
    const targetId = deletingRegistration.id;
    const targetName = deletingRegistration.name;

    try {
      // Optimistically update local registrations state
      setRegistrations(prev => prev.filter(r => r.id !== targetId));

      const cleanupRecord = {
        id: deletingRegistration.id,
        passId: deletingRegistration.passId,
        paymentReference: deletingRegistration.paymentReference,
        email: deletingRegistration.email,
        phone: deletingRegistration.phone
      };

      clearRegistrationStorageState(cleanupRecord);

      // Attempt Firestore deletion
      try {
        await deleteRegistrationFromFirestore(targetId);

        // Record audit log entry in Firestore
        const adminName = user?.displayName || user?.email?.split('@')[0] || 'Admin';
        const adminEmail = user?.email || 'authenticated_admin';

        await logRegistrationAction({
          action: 'delete',
          adminEmail,
          adminName,
          registrationId: targetId,
          registrantName: targetName,
          registrantEmail: deletingRegistration.email,
          registrantPhone: deletingRegistration.phone || '',
          registrationType: deletingRegistration.type,
          snapshot: deletingRegistration
        }).catch(() => null);

        // Refresh audit logs list
        const freshLogs = await fetchRegistrationAuditLogs().catch(() => []);
        if (freshLogs.length > 0) setAuditLogs(freshLogs);
      } catch (e) {
        console.warn('Firestore delete registration warning:', e);
      }

      setRegNotification({ 
        message: `Registration for "${targetName}" permanently deleted and saved to audit logs.`, 
        type: 'success' 
      });
      setTimeout(() => setRegNotification(null), 5000);
      setDeletingRegistration(null);
    } catch (err) {
      console.error('Delete registration error:', err);
      setRegNotification({ message: `Error deleting registration record.`, type: 'error' });
    } finally {
      setIsDeletingReg(false);
    }
  };

  const handleRestoreSingleRegistration = async (
    recordToRestore?: Partial<RegistrationData> | null,
    fallbackId?: string,
    auditLogContext?: RegistrationAuditLog | null
  ) => {
    const targetId = recordToRestore?.id || fallbackId || auditLogContext?.registrationId;
    if (!targetId) {
      console.warn('Cannot restore record: missing target registration ID', { recordToRestore, fallbackId, auditLogContext });
      setRegNotification({
        type: 'error',
        message: 'Unable to restore record: missing valid registration ID.'
      });
      return;
    }

    const name = recordToRestore?.name || auditLogContext?.registrantName || 'Restored Registrant';
    const email = recordToRestore?.email || auditLogContext?.registrantEmail || '';
    const phone = recordToRestore?.phone || auditLogContext?.registrantPhone || '';
    const type = (recordToRestore?.type || auditLogContext?.registrationType || 'conference') as 'conference' | 'musical';

    const fullRecordToRestore: RegistrationData = {
      adultsCount: 1,
      teensCount: 0,
      preteensCount: 0,
      childrenCount: 0,
      kidsCount: 0,
      toddlersCount: 0,
      ...(recordToRestore || {}),
      id: targetId,
      name,
      email,
      phone,
      type,
      status: recordToRestore?.status || 'confirmed',
      createdAt: recordToRestore?.createdAt || auditLogContext?.timestamp || new Date().toISOString(),
      paymentAmount: (recordToRestore as any)?.paymentAmount ?? (recordToRestore as any)?.amountPaid ?? 0,
      paymentStatus: recordToRestore?.paymentStatus || 'completed',
    } as RegistrationData;

    setRestoringRecordId(targetId);
    try {
      const adminEmail = user?.email || 'authenticated_admin';
      await restoreSingleRegistrationRecordToFirestore(fullRecordToRestore, adminEmail);

      const [freshRegs, freshLogs] = await Promise.all([
        fetchAllRegistrations().catch(() => []),
        fetchRegistrationAuditLogs().catch(() => [])
      ]);

      if (freshRegs.length > 0) setRegistrations(freshRegs);
      if (freshLogs.length > 0) setAuditLogs(freshLogs);

      setRegNotification({
        type: 'success',
        message: `🎉 Successfully restored record for "${name}" (${email || targetId}) back into active registrations!`
      });
      setTimeout(() => setRegNotification(null), 6000);

      if (selectedAuditLog && (selectedAuditLog.registrationId === targetId || selectedAuditLog.snapshot?.id === targetId)) {
        setSelectedAuditLog(null);
      }
    } catch (err: any) {
      console.error('Failed to restore registration record:', err);
      setRegNotification({
        type: 'error',
        message: `Failed to restore registration record: ${err?.message || 'Unknown error'}`
      });
    } finally {
      setRestoringRecordId(null);
    }
  };

  const handleSaveRegistrationEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRegistration || !editingRegistration.id) return;

    setIsSavingReg(true);
    try {
      const original = registrations.find(r => r.id === editingRegistration.id);
      
      const safeAdults = editingRegistration.adultsCount ?? 0;
      const safeTeens = editingRegistration.teensCount ?? 0;
      const safePreteens = editingRegistration.preteensCount ?? 0;
      const safeChildren = editingRegistration.childrenCount ?? 0;
      const safeKids = editingRegistration.kidsCount ?? 0;
      const safeToddlers = editingRegistration.toddlersCount ?? 0;

      const syncedAddons = buildExpectedAttendees(
        safeAdults,
        safeTeens,
        safePreteens,
        safeChildren,
        editingRegistration.additionalAttendees || [],
        safeKids,
        safeToddlers
      );

      let finalCat = editingRegistration.category;
      let finalLabel = editingRegistration.categoryLabel;
      if (safeAdults === 0 && safeTeens > 0) {
        finalCat = 'teen';
        if (!finalLabel || finalLabel.toLowerCase().includes('adult')) {
          finalLabel = 'Teen / Youth Delegate';
        }
      } else if (safeAdults > 0) {
        finalCat = 'adult';
        if (!finalLabel || finalLabel.toLowerCase().includes('teen')) {
          finalLabel = 'Adult/Youth';
        }
      }

      const updatedPayload: RegistrationData = {
        ...editingRegistration,
        adultsCount: safeAdults,
        teensCount: safeTeens,
        preteensCount: safePreteens,
        childrenCount: safeChildren,
        kidsCount: safeKids,
        toddlersCount: safeToddlers,
        category: finalCat as any,
        categoryLabel: finalLabel,
        additionalAttendees: syncedAddons
      };

      const { id, ...dataToUpdate } = updatedPayload;
      const success = await updateRegistrationInFirestore(id, dataToUpdate);

      if (success) {
        // Build readable change summary
        const changesList: string[] = [];
        if (original) {
          if (original.name !== editingRegistration.name) changesList.push(`Name: "${original.name}" → "${editingRegistration.name}"`);
          if (original.email !== editingRegistration.email) changesList.push(`Email: "${original.email}" → "${editingRegistration.email}"`);
          if (original.phone !== editingRegistration.phone) changesList.push(`Phone: "${original.phone}" → "${editingRegistration.phone}"`);
          if (original.type !== editingRegistration.type) changesList.push(`Type: "${original.type}" → "${editingRegistration.type}"`);
          if (JSON.stringify(original.selectedSeats || []) !== JSON.stringify(editingRegistration.selectedSeats || [])) {
            changesList.push(`Seats: [${(original.selectedSeats || []).join(', ')}] → [${(editingRegistration.selectedSeats || []).join(', ')}]`);
          }
          if (original.adultsCount !== editingRegistration.adultsCount) changesList.push(`Adults: ${original.adultsCount} → ${editingRegistration.adultsCount}`);
          if ((original.teensCount || 0) !== (editingRegistration.teensCount || 0)) changesList.push(`Teens: ${original.teensCount || 0} → ${editingRegistration.teensCount || 0}`);
          if (original.preteensCount !== editingRegistration.preteensCount) changesList.push(`Pre-teens: ${original.preteensCount} → ${editingRegistration.preteensCount}`);
          if (original.childrenCount !== editingRegistration.childrenCount) changesList.push(`Children: ${original.childrenCount} → ${editingRegistration.childrenCount}`);
          if ((original.kidsCount || 0) !== (editingRegistration.kidsCount || 0)) changesList.push(`Kids: ${original.kidsCount || 0} → ${editingRegistration.kidsCount || 0}`);
          if (original.toddlersCount !== editingRegistration.toddlersCount) changesList.push(`Toddlers: ${original.toddlersCount} → ${editingRegistration.toddlersCount}`);
          if ((original.comments || '') !== (editingRegistration.comments || '')) changesList.push(`Comments updated`);
        }

        const adminName = user?.displayName || user?.email?.split('@')[0] || 'Admin';
        const adminEmail = user?.email || 'authenticated_admin';

        await logRegistrationAction({
          action: 'edit',
          adminEmail,
          adminName,
          registrationId: id,
          registrantName: editingRegistration.name,
          registrantEmail: editingRegistration.email,
          registrantPhone: editingRegistration.phone || '',
          registrationType: editingRegistration.type,
          snapshot: original || editingRegistration,
          changes: changesList.length > 0 ? changesList.join('; ') : 'Updated entry fields'
        });

        // Refresh registrations and audit logs
        const [freshRegs, freshLogs] = await Promise.all([
          fetchAllRegistrations(),
          fetchRegistrationAuditLogs()
        ]);
        setRegistrations(freshRegs);
        setAuditLogs(freshLogs);

        setRegNotification({ 
          message: `Registration for "${editingRegistration.name}" updated successfully and audit log created!`, 
          type: 'success' 
        });
        setTimeout(() => setRegNotification(null), 5000);
        setEditingRegistration(null);
      } else {
        setRegNotification({ message: `Failed to update registration in database.`, type: 'error' });
      }
    } catch (err) {
      console.error('Update registration error:', err);
      setRegNotification({ message: `Error saving changes.`, type: 'error' });
    } finally {
      setIsSavingReg(false);
    }
  };

  const handleDeleteAuditLog = async (logId: string) => {
    if (!confirm('Are you sure you want to permanently delete this record? This action cannot be undone.')) return;
    try {
      const logObj = auditLogs.find(l => l.id === logId);
      const success = await deleteAuditLogFromFirestore(logId, logObj);
      if (success) {
        setAuditLogs(prev => prev.filter(l => l.id !== logId));
        setSelectedAuditLogIds(prev => prev.filter(id => id !== logId));
        setAdminNotification({
          type: 'success',
          message: 'Deleted registration record permanently removed from database.'
        });
      }
    } catch (e) {
      console.error('Delete audit log error:', e);
    }
  };

  const handleBulkDeleteAuditLogs = async () => {
    if (selectedAuditLogIds.length === 0) return;
    if (!confirm(`Are you sure you want to permanently delete ${selectedAuditLogIds.length} selected record(s)? This action cannot be undone.`)) return;

    setIsSavingReg(true);
    try {
      let deletedCount = 0;
      for (const logId of selectedAuditLogIds) {
        const logObj = auditLogs.find(l => l.id === logId);
        const success = await deleteAuditLogFromFirestore(logId, logObj);
        if (success) deletedCount++;
      }
      setAuditLogs(prev => prev.filter(l => !selectedAuditLogIds.includes(l.id || '')));
      setSelectedAuditLogIds([]);
      setAdminNotification({
        type: 'success',
        message: `Successfully permanently deleted ${deletedCount} selected record(s) from deleted registrations table.`
      });
    } catch (err: any) {
      console.error('Bulk delete audit logs error:', err);
      setAdminNotification({
        type: 'error',
        message: err.message || 'Failed to delete selected records.'
      });
    } finally {
      setIsSavingReg(false);
    }
  };

  // Admin Email Editing State
  const [editingAdminEmail, setEditingAdminEmail] = useState<string | null>(null);
  const [newEmailValue, setNewEmailValue] = useState<string>('');

  // Delete Record Confirmation Modal State
  const [deleteConfirmTarget, setDeleteConfirmTarget] = useState<string | null>(null);
  const [isDeletingRecord, setIsDeletingRecord] = useState<boolean>(false);
  const [adminNotification, setAdminNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Role Selection Modal State
  const [roleModalTarget, setRoleModalTarget] = useState<ApprovedAdminData | null>(null);
  const [selectedRoleToAssign, setSelectedRoleToAssign] = useState<'full_admin' | 'admin' | 'support_admin' | 'content_admin' | 'ticket_admin' | 'intercession_coordinator' | 'invitation_admin'>('full_admin');
  const [selectedInvitationSubRoles, setSelectedInvitationSubRoles] = useState<InvitationAdminRole[]>([
    'public_invitation_admin',
    'parish_invitation_admin',
    'jy_coordinators',
    'inactive_jys_admin'
  ]);
  const [isSubmittingRole, setIsSubmittingRole] = useState(false);

  const openRoleModal = (adminData: ApprovedAdminData) => {
    setRoleModalTarget(adminData);
    setSelectedRoleToAssign(
      adminData.role === 'invitation_admin'
        ? 'invitation_admin'
        : adminData.role === 'full_admin' 
        ? 'full_admin' 
        : adminData.role === 'admin' 
        ? 'admin' 
        : adminData.role === 'support_admin' 
        ? 'support_admin' 
        : adminData.role === 'content_admin' 
        ? 'content_admin' 
        : adminData.role === 'ticket_admin'
        ? 'ticket_admin'
        : adminData.role === 'intercession_coordinator'
        ? 'intercession_coordinator'
        : 'invitation_admin'
    );
    setSelectedInvitationSubRoles(
      adminData.invitationRoles && adminData.invitationRoles.length > 0 
        ? adminData.invitationRoles 
        : ['public_invitation_admin', 'parish_invitation_admin', 'jy_coordinators', 'inactive_jys_admin']
    );
  };

  const confirmRoleAssignment = async () => {
    if (!roleModalTarget) return;
    const actorEmail = user?.email || 'admin@jesusyouth.org';
    setIsSubmittingRole(true);
    setAdminNotification(null);
    try {
      await updateAdminStatus(
        roleModalTarget.email, 
        'approved', 
        actorEmail, 
        selectedRoleToAssign,
        selectedRoleToAssign === 'invitation_admin' ? selectedInvitationSubRoles : []
      );
      const updated = await fetchApprovedAdmins();
      setAdminsList(updated);
      setAdminNotification({
        type: 'success',
        message: `Updated access for ${roleModalTarget.email} as ${
          selectedRoleToAssign === 'full_admin'
            ? 'Full Admin'
            : selectedRoleToAssign === 'admin'
            ? 'Admin (Main)'
            : selectedRoleToAssign === 'content_admin' 
            ? 'Content Admin' 
            : selectedRoleToAssign === 'ticket_admin'
            ? 'Ticket Admin'
            : selectedRoleToAssign === 'intercession_coordinator'
            ? 'Intercession Coordinator'
            : selectedRoleToAssign === 'invitation_admin'
            ? `${formatInvitationRoleName(selectedInvitationSubRoles)}`
            : 'Support & Inbox Admin'
        }.`
      });
      setRoleModalTarget(null);
    } catch (err: any) {
      setAdminNotification({ type: 'error', message: err.message || 'Failed to update admin role' });
    } finally {
      setIsSubmittingRole(false);
    }
  };

  // Admin Management Handlers
  const handleApproveAdmin = (adminData: ApprovedAdminData) => {
    openRoleModal(adminData);
  };

  const handleRevokeAdmin = async (email: string) => {
    const actorEmail = user?.email || 'admin@jesusyouth.org';
    setAdminNotification(null);
    try {
      await updateAdminStatus(email, 'revoked', actorEmail);
      const updated = await fetchApprovedAdmins();
      setAdminsList(updated);
      setAdminNotification({ type: 'success', message: `Access revoked for ${email}` });
    } catch (err: any) {
      setAdminNotification({ type: 'error', message: err.message || 'Failed to revoke access' });
    }
  };

  const handleDeleteAdminRecord = (email: string) => {
    setAdminNotification(null);
    setDeleteConfirmTarget(email);
  };

  const confirmDeleteAdminRecord = async () => {
    if (!deleteConfirmTarget) return;
    setIsDeletingRecord(true);
    setAdminNotification(null);
    const targetEmail = deleteConfirmTarget;
    try {
      // Optimistically filter local state
      setAdminsList(prev => prev.filter(a => a.email.toLowerCase() !== targetEmail.toLowerCase()));
      
      try {
        await deleteAdminRecordPermanently(targetEmail);
      } catch (e: any) {
        console.warn('Firestore delete admin record warning:', e);
      }

      setAdminNotification({ type: 'success', message: `Record for "${targetEmail}" has been permanently deleted.` });
      setDeleteConfirmTarget(null);
    } catch (err: any) {
      setAdminNotification({ type: 'error', message: err.message || 'Failed to delete admin record.' });
    } finally {
      setIsDeletingRecord(false);
    }
  };

  const startEditingEmail = (currentEmail: string) => {
    setAdminNotification(null);
    setEditingAdminEmail(currentEmail);
    setNewEmailValue(currentEmail);
  };

  const handleSaveEditedEmail = async (oldEmail: string) => {
    if (!newEmailValue.trim()) {
      setAdminNotification({ type: 'error', message: 'Email address cannot be empty.' });
      return;
    }
    if (newEmailValue.trim().toLowerCase() === oldEmail.toLowerCase()) {
      setEditingAdminEmail(null);
      return;
    }
    setAdminNotification(null);
    try {
      await editAdminEmail(oldEmail, newEmailValue.trim());
      setEditingAdminEmail(null);
      setNewEmailValue('');
      const updated = await fetchApprovedAdmins();
      setAdminsList(updated);
      setAdminNotification({ type: 'success', message: `Updated admin email to "${newEmailValue.trim()}"` });
    } catch (err: any) {
      setAdminNotification({ type: 'error', message: err.message || 'Failed to update admin email' });
    }
  };

  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAdminEmail.trim()) return;
    const targetEmail = newAdminEmail.trim().toLowerCase();
    openRoleModal({
      email: targetEmail,
      status: 'pending',
      role: 'invitation_admin',
      invitationRoles: ['public_invitation_admin', 'parish_invitation_admin', 'jy_coordinators', 'inactive_jys_admin']
    });
    setNewAdminEmail('');
  };

  // Intercession Actions & Reminders Handlers
  const openWhatsAppReminder = async (rec: IntercessionCommitmentRecord) => {
    let cleanPhone = (rec.phone || '').replace(/[^0-9]/g, '');
    if (cleanPhone.startsWith('8') || cleanPhone.startsWith('9')) {
      cleanPhone = '65' + cleanPhone;
    }
    const progressSummary = formatProgressSummary(rec);
    const msg = `Praise the Lord ${rec.name || ''}! 🙏\n\nThank you for offering your spiritual bouquet commitment for GRACIA (Jesus Youth Singapore 25th Jubilee Celebration).\n\n🌸 Your Spiritual Bouquet Pledges & Progress:\n${progressSummary}\n\n📌 Target Completion Date: October 10, 2026.\n\n✨ Track & update your prayer progress online at:\nhttps://gracia2026.vercel.app/\n\nMay God bless your prayer and devotion!\n- Intercession Team, Jesus Youth Singapore Jubilee Team`;
    
    const nowIso = new Date().toISOString();
    if (rec.id) {
      await updateIntercessionReminderStatus(rec.id, 'whatsapp');
    }
    setIntercessionsList(prev => prev.map(r => (r.id === rec.id || r.email === rec.email) ? {
      ...r,
      lastReminderSentAt: nowIso,
      lastReminderType: 'whatsapp'
    } : r));

    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  };

  const openIntercessionEmailModal = (rec: IntercessionCommitmentRecord) => {
    setSingleReminderModal(rec);
    setIntercessionEmailSubject(`[GRACIA] Spiritual Bouquet Commitment Reminder`);
    setIntercessionEmailBody(
`Praise the Lord!

“The prayer of a righteous person is powerful and effective.” — James 5:16

Thank you so much for offering your generous spiritual bouquet pledge for GRACIA - Jubilee Conference 2026. Together as one body, our combined prayers, fasts, and devotions are lifting this conference up to the Lord!

This is a gentle reminder to stay steadfast in your daily prayer pledges. If you've missed any days or fall behind, don't worry-simply offer them up today!

Thank you for your commitment to this spiritual mission. Let us continue to pray for one another and for abundant blessings at GRACIA!

With prayers and gratitude,

GRACIA Intercession Team`
    );
  };

  const handleSendIntercessionEmail = async () => {
    if (!singleReminderModal || !singleReminderModal.email) return;
    setIsSendingReminderEmail(true);
    setReminderNotification(null);
    const nowIso = new Date().toISOString();
    try {
      const summaryText = formatCommitmentsSummary(singleReminderModal);
      const response = await fetch('/api/send-intercession-reminder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientEmail: singleReminderModal.email,
          recipientName: singleReminderModal.name || '',
          subject: intercessionEmailSubject,
          messageBody: intercessionEmailBody,
          commitmentsSummary: summaryText,
          record: singleReminderModal
        })
      });
      const data = await response.json();

      if (singleReminderModal.id) {
        await updateIntercessionReminderStatus(singleReminderModal.id, 'email');
      }
      setIntercessionsList(prev => prev.map(r => (r.id === singleReminderModal.id || r.email === singleReminderModal.email) ? {
        ...r,
        lastReminderSentAt: nowIso,
        lastReminderType: 'email'
      } : r));

      if (data.status === 'sent') {
        setReminderNotification({
          type: 'success',
          message: `Reminder email successfully dispatched to ${singleReminderModal.email} from jysg25@gmail.com!`
        });
        setSingleReminderModal(null);
      } else {
        const mailtoUrl = `mailto:${singleReminderModal.email}?subject=${encodeURIComponent(intercessionEmailSubject)}&body=${encodeURIComponent(intercessionEmailBody)}`;
        window.open(mailtoUrl, '_blank');
        setReminderNotification({
          type: 'success',
          message: `Email draft recorded & opened in client for ${singleReminderModal.email}.`
        });
        setSingleReminderModal(null);
      }
    } catch (err: any) {
      console.error('Email send error:', err);
      if (singleReminderModal.id) {
        await updateIntercessionReminderStatus(singleReminderModal.id, 'email');
      }
      setIntercessionsList(prev => prev.map(r => (r.id === singleReminderModal.id || r.email === singleReminderModal.email) ? {
        ...r,
        lastReminderSentAt: nowIso,
        lastReminderType: 'email'
      } : r));

      const mailtoUrl = `mailto:${singleReminderModal.email}?subject=${encodeURIComponent(intercessionEmailSubject)}&body=${encodeURIComponent(intercessionEmailBody)}`;
      window.open(mailtoUrl, '_blank');
      setReminderNotification({
        type: 'error',
        message: `Opened local email client for ${singleReminderModal.email}.`
      });
      setSingleReminderModal(null);
    } finally {
      setIsSendingReminderEmail(false);
    }
  };

  const openBulkEmailModal = () => {
    setShowBulkEmailModal(true);
    setBulkEmailSubject(`[GRACIA] Spiritual Bouquet Commitment Reminder`);
    setBulkEmailBody(
`Praise the Lord!

“The prayer of a righteous person is powerful and effective.” — James 5:16

Thank you so much for offering your generous spiritual bouquet pledge for GRACIA - Jubilee Conference 2026. Together as one body, our combined prayers, fasts, and devotions are lifting this conference up to the Lord!

This is a gentle reminder to stay steadfast in your daily prayer pledges. If you've missed any days or fall behind, don't worry-simply offer them up today!

Thank you for your commitment to this spiritual mission. Let us continue to pray for one another and for abundant blessings at GRACIA!

With prayers and gratitude,

GRACIA Intercession Team`
    );
  };

  const handleSendBulkEmail = async () => {
    const recipients = intercessionsList.filter(r => r.email && r.email.trim() !== '');
    if (recipients.length === 0) {
      alert('No committed members with valid email addresses found.');
      return;
    }

    setIsSendingReminderEmail(true);
    setReminderProgressText(`Starting email dispatch to ${recipients.length} committed members from jysg25@gmail.com...`);

    let successCount = 0;
    let failCount = 0;
    const nowIso = new Date().toISOString();

    for (let i = 0; i < recipients.length; i++) {
      const member = recipients[i];
      setReminderProgressText(`Sending email ${i + 1} of ${recipients.length} to ${member.name || member.email}...`);

      try {
        const summaryText = formatCommitmentsSummary(member);
        const response = await fetch('/api/send-intercession-reminder', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recipientEmail: member.email,
            recipientName: member.name || '',
            subject: bulkEmailSubject,
            messageBody: bulkEmailBody,
            commitmentsSummary: summaryText,
            record: member
          })
        });
        const data = await response.json();
        if (member.id) {
          await updateIntercessionReminderStatus(member.id, 'batch_email');
        }
        if (data.status === 'sent') {
          successCount++;
        } else {
          failCount++;
        }
      } catch (err) {
        if (member.id) {
          await updateIntercessionReminderStatus(member.id, 'batch_email');
        }
        failCount++;
      }
    }

    setIntercessionsList(prev => prev.map(r => r.email ? {
      ...r,
      lastReminderSentAt: nowIso,
      lastReminderType: 'batch_email'
    } : r));

    setIsSendingReminderEmail(false);
    setReminderProgressText('');
    setShowBulkEmailModal(false);

    setReminderNotification({
      type: 'success',
      message: `Completed batch email dispatch! ${successCount} emails sent successfully from jysg25@gmail.com${failCount > 0 ? ` (${failCount} fallbacks)` : ''}.`
    });
  };

  const exportIntercessionsCSV = () => {
    if (intercessionsList.length === 0) {
      alert('No intercession commitment records available to export.');
      return;
    }

    const headers = [
      'ID',
      'Name',
      'Email',
      'Phone',
      'Total Items Pledged',
      'Total Items Completed',
      'Progress %',
      'Status',
      'Pledged Holy Mass',
      'Completed Holy Mass',
      'Pledged Adoration Slots (30m)',
      'Completed Adoration Slots',
      'Pledged Rosary Decades',
      'Completed Rosary Decades',
      'Pledged Full Rosaries',
      'Completed Full Rosaries',
      'Pledged Divine Mercy Chaplets',
      'Completed Divine Mercy Chaplets',
      'Pledged Fast Meals',
      'Completed Fast Meals',
      'Pledged Abstain Meat Days',
      'Completed Abstain Meat Days',
      'Pledged Short Prayers',
      'Completed Short Prayers',
      'Date Committed',
      'Last Reminder Sent At',
      'Last Reminder Channel'
    ];

    const rows = intercessionsList.map((rec, idx) => {
      const pledged = (rec.holyMass||0) + (rec.adoration||0) + (rec.rosary||0) + (rec.decadeRosary||0) + (rec.divineMercy||0) + (rec.fastMeal||0) + (rec.abstainMeat||0) + (rec.shortPrayers||0);
      const done = (rec.completedHolyMass||0) + (rec.completedAdoration||0) + (rec.completedRosary||0) + (rec.completedDecadeRosary||0) + (rec.completedDivineMercy||0) + (rec.completedFastMeal||0) + (rec.completedAbstainMeat||0) + (rec.completedShortPrayers||0);
      const pct = pledged > 0 ? Math.min(100, Math.round((done / pledged) * 100)) : 0;
      const status = pct === 100 ? 'Completed' : pct > 0 ? 'In Progress' : 'Not Started';

      return [
        `"${rec.id || (idx + 1)}"`,
        `"${(rec.name || '').replace(/"/g, '""')}"`,
        `"${(rec.email || '').replace(/"/g, '""')}"`,
        `"${(rec.phone || '').replace(/"/g, '""')}"`,
        pledged,
        done,
        `"${pct}%"`,
        `"${status}"`,
        rec.holyMass || 0,
        rec.completedHolyMass || 0,
        rec.adoration || 0,
        rec.completedAdoration || 0,
        rec.decadeRosary || 0,
        rec.completedDecadeRosary || 0,
        rec.rosary || 0,
        rec.completedRosary || 0,
        rec.divineMercy || 0,
        rec.completedDivineMercy || 0,
        rec.fastMeal || 0,
        rec.completedFastMeal || 0,
        rec.abstainMeat || 0,
        rec.completedAbstainMeat || 0,
        rec.shortPrayers || 0,
        rec.completedShortPrayers || 0,
        `"${rec.createdAt ? new Date(rec.createdAt).toLocaleString() : ''}"`,
        `"${rec.lastReminderSentAt ? new Date(rec.lastReminderSentAt).toLocaleString() : 'Never'}"`,
        `"${rec.lastReminderType || 'None'}"`
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `GRACIA_Intercessions_Commitments_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Intercession Add, Edit & Delete Action Handlers
  const handleAddIntercessionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newIntercessionForm.name.trim()) {
      alert('Please enter participant name.');
      return;
    }

    setIsSavingIntercession(true);
    try {
      await saveIntercessionCommitment(newIntercessionForm);
      const list = await getAllIntercessionCommitments();
      setIntercessionsList(list);
      setShowAddIntercessionModal(false);
      setReminderNotification({
        type: 'success',
        message: `New spiritual bouquet commitment entry for "${newIntercessionForm.name}" added successfully!`
      });
      setTimeout(() => setReminderNotification(null), 4000);
    } catch (err) {
      console.error('Error adding intercession entry:', err);
      setReminderNotification({
        type: 'error',
        message: 'Failed to add intercession entry. Please try again.'
      });
    } finally {
      setIsSavingIntercession(false);
    }
  };

  const handleConfirmSaveIntercessionEdit = async () => {
    if (!intercessionPendingEdit || !intercessionPendingEdit.id) return;
    setIsSavingIntercession(true);
    try {
      const { id, ...updates } = intercessionPendingEdit;
      const success = await updateIntercessionCommitment(id, updates);
      if (success) {
        const list = await getAllIntercessionCommitments();
        setIntercessionsList(list);
        setIntercessionPendingEdit(null);
        setEditingIntercession(null);
        setReminderNotification({
          type: 'success',
          message: `Spiritual bouquet commitment entry for "${intercessionPendingEdit.name || 'Participant'}" updated successfully!`
        });
        setTimeout(() => setReminderNotification(null), 4000);
      } else {
        alert('Failed to update intercession entry in database.');
      }
    } catch (err) {
      console.error('Error updating intercession entry:', err);
      alert('Error updating intercession entry.');
    } finally {
      setIsSavingIntercession(false);
    }
  };

  const handleConfirmDeleteIntercession = async () => {
    if (!intercessionDeleteTarget || !intercessionDeleteTarget.id) return;
    setIsDeletingIntercession(true);
    const targetId = intercessionDeleteTarget.id;
    const targetName = intercessionDeleteTarget.name || 'Participant';

    try {
      // Optimistically filter local intercessions list
      setIntercessionsList(prev => prev.filter(item => item.id !== targetId));

      try {
        await deleteIntercessionCommitment(targetId);
      } catch (e) {
        console.warn('Firestore delete intercession warning:', e);
      }

      setIntercessionDeleteTarget(null);
      setReminderNotification({
        type: 'success',
        message: `Entry for "${targetName}" deleted successfully.`
      });
      setTimeout(() => setReminderNotification(null), 4000);
    } catch (err) {
      console.error('Error deleting intercession entry:', err);
    } finally {
      setIsDeletingIntercession(false);
    }
  };

  // AI Reply Draft Generator
  const handleGenerateAiReply = async () => {
    if (!selectedMessage) return;
    setIsGeneratingAiReply(true);
    setAiDraftBadge(false);
    try {
      const res = await fetch('/api/generate-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderName: selectedMessage.name,
          senderEmail: selectedMessage.email,
          queryMessage: selectedMessage.message
        })
      });
      const data = await res.json();
      if (data.replyText) {
        setReplyInput(data.replyText);
        setAiDraftBadge(true);
        setMsgActionSuccess('AI draft generated using Gemini! Feel free to review or customize before sending.');
        setTimeout(() => setMsgActionSuccess(null), 5000);
      } else {
        throw new Error('No reply text generated');
      }
    } catch (err) {
      console.error('Error generating AI reply:', err);
      const fallback = `Dear ${selectedMessage.name},\n\nThank you for contacting Jesus Youth Singapore regarding GRACIA!\n\nWe have received your message:\n"${selectedMessage.message}"\n\nOur team is reviewing your query and will assist you shortly. You may also visit our official website at https://singapore.jesusyouth.org/ or check our Instagram @jesusyouth_singapore for event updates.\n\nIn Christ,\nJesus Youth Singapore GRACIA Conference Team`;
      setReplyInput(fallback);
      setAiDraftBadge(true);
    } finally {
      setIsGeneratingAiReply(false);
    }
  };

  // Submit Reply & Dispatch Direct Email via jysg25@jesusyouth.org
  const handleSendReply = async (sendDirectEmail = true) => {
    if (!selectedMessage || !replyInput.trim() || !user?.email) return;
    setIsSendingReply(true);
    setEmailFailNotice(null);

    const mailtoSubject = encodeURIComponent('Re: GRACIA Inquiry - Jesus Youth Singapore');
    const mailtoBody = encodeURIComponent(replyInput.trim());
    const mailtoUrl = `mailto:${selectedMessage.email}?subject=${mailtoSubject}&body=${mailtoBody}`;

    try {
      await replyToContactMessage(
        selectedMessage.id,
        replyInput.trim(),
        user.email,
        user.displayName || user.email.split('@')[0],
        aiDraftBadge
      );

      let statusMsg = 'Reply record saved in database history!';

      if (sendDirectEmail) {
        try {
          const res = await fetch('/api/send-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              recipientEmail: selectedMessage.email,
              recipientName: selectedMessage.name,
              subject: 'Re: GRACIA Inquiry - Jesus Youth Singapore',
              replyText: replyInput.trim(),
              adminEmail: user.email,
              adminName: user.displayName || user.email.split('@')[0]
            })
          });
          const data = await res.json();
          if (data.status === 'sent') {
            statusMsg = `Reply saved & direct email sent successfully to ${selectedMessage.email} from jysg25@jesusyouth.org!`;
            setEmailFailNotice(null);
          } else {
            statusMsg = `Reply saved in database! (Automated direct SMTP dispatch failed - see notice below)`;
            setEmailFailNotice({
              text: data.message || 'Direct email requires a Google App Password for jysg25@jesusyouth.org.',
              hint: data.hint || 'Google Workspace requires a 16-character App Password when sending email via jysg25@jesusyouth.org SMTP.',
              mailtoUrl,
              recipientEmail: selectedMessage.email
            });
          }
        } catch (mailErr: any) {
          console.error('Error calling /api/send-email:', mailErr);
          statusMsg = `Reply saved in database! (Direct email endpoint unreachable)`;
          setEmailFailNotice({
            text: 'Direct SMTP server call failed. You can send this reply directly via your local mail client using the button below.',
            mailtoUrl,
            recipientEmail: selectedMessage.email
          });
        }
      }

      setMsgActionSuccess(statusMsg);
      setTimeout(() => setMsgActionSuccess(null), 8000);

      const msgs = await fetchContactMessages();
      setMessagesList(msgs);
      const updatedSel = msgs.find(m => m.id === selectedMessage.id);
      if (updatedSel) setSelectedMessage(updatedSel);
      setReplyInput('');
      setAiDraftBadge(false);
    } catch (err: any) {
      console.error('Error sending reply:', err);
      alert('Failed to save reply: ' + (err.message || 'Unknown error'));
    } finally {
      setIsSendingReply(false);
    }
  };

  // Status Change Handler
  const handleToggleMessageStatus = async (status: 'unread' | 'replied' | 'archived') => {
    if (!selectedMessage) return;
    try {
      await updateMessageStatus(selectedMessage.id, status);
      const msgs = await fetchContactMessages();
      setMessagesList(msgs);
      const updated = msgs.find(m => m.id === selectedMessage.id);
      if (updated) setSelectedMessage(updated);
    } catch (err) {
      console.error('Error updating message status:', err);
    }
  };

  // Delete Message Handler
  const handleDeleteMessage = async (messageId: string) => {
    if (!confirm('Are you sure you want to delete this message? This cannot be undone.')) return;
    try {
      await deleteContactMessage(messageId);
      const msgs = await fetchContactMessages();
      setMessagesList(msgs);
      setSelectedMessage(msgs.length > 0 ? msgs[0] : null);
    } catch (err) {
      console.error('Error deleting message:', err);
    }
  };

  // Filtered Contact Messages
  const filteredMessages = messagesList.filter(m => {
    const matchesStatus = msgStatusFilter === 'all' || m.status === msgStatusFilter;
    const matchesSearch = m.name.toLowerCase().includes(msgSearchQuery.toLowerCase()) ||
                          m.email.toLowerCase().includes(msgSearchQuery.toLowerCase()) ||
                          m.message.toLowerCase().includes(msgSearchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const unreadMessagesCount = messagesList.filter(m => m.status === 'unread').length;
  const repliedMessagesCount = messagesList.filter(m => m.status === 'replied').length;

  // Primary Registrations for Consolidated Parent-Child Layout
  const primaryRegistrations = registrations.filter(r => !r.isAdditionalAttendee);

  // Filtered Primary Registrations
  const filteredPrimaryRegistrations = primaryRegistrations.filter(r => {
    const matchesType = typeFilter === 'all' || r.type === typeFilter;
    const query = searchQuery.toLowerCase().trim();
    if (!query) return matchesType;

    // Match primary details
    const matchesPrimary = (r.name && r.name.toLowerCase().includes(query)) ||
      (r.email && r.email.toLowerCase().includes(query)) ||
      (r.phone && r.phone.includes(query)) ||
      (r.id && r.id.toLowerCase().includes(query)) ||
      (r.passId && r.passId.toLowerCase().includes(query)) ||
      (r.paymentReference && r.paymentReference.toLowerCase().includes(query));

    // Match delegate details
    const matchesDelegates = r.additionalAttendees?.some(a => 
      (a.name && a.name.toLowerCase().includes(query)) ||
      (a.email && a.email.toLowerCase().includes(query)) ||
      (a.phone && a.phone.includes(query)) ||
      (a.passId && a.passId.toLowerCase().includes(query))
    );

    // Also match any linked flat attendees
    const matchesLinked = registrations.some(l => 
      l.isAdditionalAttendee && l.primaryContactId === r.id && (
        (l.name && l.name.toLowerCase().includes(query)) ||
        (l.email && l.email.toLowerCase().includes(query)) ||
        (l.phone && l.phone.includes(query)) ||
        (l.passId && l.passId.toLowerCase().includes(query))
      )
    );

    return matchesType && (matchesPrimary || matchesDelegates || matchesLinked);
  });

  const filteredRegistrations = filteredPrimaryRegistrations;

  // Toggle single row expansion in accordion
  const toggleRowExpanded = (regId: string) => {
    setExpandedRegIds(prev => 
      prev.includes(regId) ? prev.filter(id => id !== regId) : [...prev, regId]
    );
  };

  // Helper to construct complete delegate list for a primary registration
  const getDelegatePassesForReg = (reg: RegistrationData) => {
    const delegatesList: Array<{
      id: string;
      passId: string;
      name: string;
      category: string;
      isPrimary: boolean;
      saintGroup: GroupColorInfo;
      isCheckedIn: boolean;
      checkedInAt?: string;
      checkedInBy?: string;
      photoUrl?: string;
      email?: string;
      phone?: string;
      seat?: string;
    }> = [];

    const personSeed = getPersonDeterministicSeed(reg.email, reg.phone, reg.name);
    const primaryPassId = reg.passId || getBibleVersePassId(personSeed || reg.id, 0, reg.name);
    const primarySaintGroup = getParticipantGroupColor(personSeed || reg.id, 0, reg.name, groupSettings, primaryPassId);

    const scannedList = Array.isArray(reg.scannedPassIds) ? reg.scannedPassIds : [];
    const hasExplicitScans = scannedList.length > 0;

    // Helper to evaluate check-in status for an individual pass
    const checkIsDelegateCheckedIn = (
      passId: string,
      id: string,
      name: string,
      categoryLabel: string,
      isPrimary: boolean,
      idx: number
    ): boolean => {
      return isDelegatePassCheckedIn(reg, passId, name, isPrimary, id);
    };

    const isPrimaryCheckedIn = checkIsDelegateCheckedIn(
      primaryPassId,
      reg.id || 'primary',
      reg.name,
      reg.categoryLabel || 'Adult/Youth',
      true,
      0
    );

    const primaryCategoryLabel = ((reg.adultsCount === 0 || reg.adultsCount === undefined) && (reg.teensCount || 0) > 0)
      ? (!reg.categoryLabel || reg.categoryLabel.toLowerCase().includes('adult') ? 'Teen / Youth Delegate' : reg.categoryLabel)
      : (reg.categoryLabel || (reg.type === 'conference' ? 'Adult/Youth' : 'Audience'));

    delegatesList.push({
      id: reg.id || 'primary',
      passId: primaryPassId,
      name: reg.name,
      category: primaryCategoryLabel,
      isPrimary: true,
      saintGroup: primarySaintGroup,
      isCheckedIn: isPrimaryCheckedIn,
      checkedInAt: isPrimaryCheckedIn ? (reg.checkedInAt || undefined) : undefined,
      checkedInBy: isPrimaryCheckedIn ? (reg.checkedInBy || undefined) : undefined,
      photoUrl: reg.photoUrl,
      email: reg.email,
      phone: reg.phone,
      seat: reg.selectedSeats && reg.selectedSeats[0] ? `Row ${reg.selectedSeats[0].split('-')[0]} Seat ${reg.selectedSeats[0].split('-')[1]}` : undefined
    });

    const seenPassIds = new Set<string>([primaryPassId.toLowerCase()]);
    const seenNames = new Set<string>([reg.name.toLowerCase().trim()]);

    // Build or retrieve all expected attendees for this registration
    let attendeesList = Array.isArray(reg.additionalAttendees) ? [...reg.additionalAttendees] : [];
    
    // If breakdown counts exceed current list, synthesize expected attendee items
    const expectedAttendees = buildExpectedAttendees(
      reg.adultsCount ?? 0,
      reg.teensCount || 0,
      reg.preteensCount || 0,
      reg.childrenCount || 0,
      attendeesList,
      reg.kidsCount || 0,
      reg.toddlersCount || 0
    );

    if (expectedAttendees.length > attendeesList.length) {
      attendeesList = expectedAttendees;
    }

    attendeesList.forEach((addon, idx) => {
      const formattedName = (addon.name && addon.name.trim()) 
        ? addon.name.trim() 
        : (addon.categoryLabel || `Attendee #${idx + 2}`);
      const normalizedName = formattedName.toLowerCase();
      if (seenNames.has(normalizedName)) return;
      seenNames.add(normalizedName);

      const addonSeed = getPersonDeterministicSeed(addon.email, addon.phone, formattedName) || `${personSeed}_ADD_${idx + 1}_${(addon.id || formattedName).toLowerCase()}`;
      const addonPassId = addon.passId || getBibleVersePassId(addonSeed, idx + 1, formattedName);
      if (seenPassIds.has(addonPassId.toLowerCase())) return;
      seenPassIds.add(addonPassId.toLowerCase());

      const addonSaintGroup = getParticipantGroupColor(addonSeed, idx + 1, formattedName, groupSettings, addonPassId);
      const isAddonCheckedIn = checkIsDelegateCheckedIn(
        addonPassId,
        addon.id || `${reg.id}-addon-${idx}`,
        formattedName,
        addon.categoryLabel || addon.category || 'Delegate',
        false,
        idx + 1
      );

      delegatesList.push({
        id: addon.id || `${reg.id}-addon-${idx}`,
        passId: addonPassId,
        name: formattedName,
        category: addon.categoryLabel || (addon.category ? addon.category.charAt(0).toUpperCase() + addon.category.slice(1) : 'Delegate'),
        isPrimary: false,
        saintGroup: addonSaintGroup,
        isCheckedIn: isAddonCheckedIn,
        checkedInAt: isAddonCheckedIn ? (reg.checkedInAt || undefined) : undefined,
        checkedInBy: isAddonCheckedIn ? (reg.checkedInBy || undefined) : undefined,
        photoUrl: addon.photoUrl,
        email: addon.email,
        phone: addon.phone,
        seat: reg.selectedSeats && reg.selectedSeats[idx + 1] ? `Row ${reg.selectedSeats[idx + 1].split('-')[0]} Seat ${reg.selectedSeats[idx + 1].split('-')[1]}` : undefined
      });
    });

    // Additional attendees stored as separate linked records in firestore
    const linkedFlatRecords = registrations.filter(r => r.isAdditionalAttendee && r.primaryContactId === reg.id);
    linkedFlatRecords.forEach((linked, idx) => {
      if (!linked.name || !linked.name.trim()) return;
      const norm = linked.name.toLowerCase().trim();
      if (seenNames.has(norm)) return;
      seenNames.add(norm);

      const linkedSeed = getPersonDeterministicSeed(linked.email, linked.phone, linked.name) || `${personSeed}_LINK_${idx + 1}`;
      const linkedPassId = linked.passId || getBibleVersePassId(linkedSeed, idx + 1, linked.name);
      if (seenPassIds.has(linkedPassId.toLowerCase())) return;
      seenPassIds.add(linkedPassId.toLowerCase());

      const linkedSaintGroup = getParticipantGroupColor(linkedSeed, idx + 1, linked.name, groupSettings, linkedPassId);
      const isLinkedCheckedIn = Boolean(
        linked.checkedIn ||
        checkIsDelegateCheckedIn(
          linkedPassId,
          linked.id || `${reg.id}-linked-${idx}`,
          linked.name,
          linked.categoryLabel || linked.category || 'Delegate',
          false,
          delegatesList.length
        )
      );

      delegatesList.push({
        id: linked.id || `${reg.id}-linked-${idx}`,
        passId: linkedPassId,
        name: linked.name,
        category: linked.categoryLabel || linked.category || 'Delegate',
        isPrimary: false,
        saintGroup: linkedSaintGroup,
        isCheckedIn: isLinkedCheckedIn,
        checkedInAt: isLinkedCheckedIn ? (linked.checkedInAt || reg.checkedInAt) : undefined,
        checkedInBy: isLinkedCheckedIn ? (linked.checkedInBy || reg.checkedInBy) : undefined,
        photoUrl: linked.photoUrl,
        email: linked.email,
        phone: linked.phone,
        seat: linked.selectedSeats && linked.selectedSeats[0] ? `Row ${linked.selectedSeats[0].split('-')[0]} Seat ${linked.selectedSeats[0].split('-')[1]}` : undefined
      });
    });

    return delegatesList;
  };

  // Helper to compute Group Summary breakdown (e.g. 3 Passes: 1 Adult, 1 Teen, 1 Pre-Teen)
  const getGroupSummary = (reg: RegistrationData) => {
    const parts: string[] = [];
    if (reg.adultsCount && reg.adultsCount > 0) {
      parts.push(`${reg.adultsCount} Adult${reg.adultsCount > 1 ? 's' : ''}`);
    }
    if (reg.teensCount && reg.teensCount > 0) {
      parts.push(`${reg.teensCount} Teen${reg.teensCount > 1 ? 's' : ''}`);
    }
    if (reg.preteensCount && reg.preteensCount > 0) {
      parts.push(`${reg.preteensCount} Pre-Teen${reg.preteensCount > 1 ? 's' : ''}`);
    }
    if (reg.childrenCount && reg.childrenCount > 0) {
      parts.push(`${reg.childrenCount} Child${reg.childrenCount > 1 ? 'ren' : ''}`);
    }
    if (reg.kidsCount && reg.kidsCount > 0) {
      parts.push(`${reg.kidsCount} Kid${reg.kidsCount > 1 ? 's' : ''}`);
    }
    if (reg.toddlersCount && reg.toddlersCount > 0) {
      parts.push(`${reg.toddlersCount} Toddler${reg.toddlersCount > 1 ? 's' : ''}`);
    }

    const totalCount = (reg.adultsCount || 0) + 
                       (reg.teensCount || 0) + 
                       (reg.preteensCount || 0) + 
                       (reg.childrenCount || 0) + 
                       (reg.kidsCount || 0) + 
                       (reg.toddlersCount || 0);

    const delegates = getDelegatePassesForReg(reg);
    const displayTotal = Math.max(totalCount, delegates.length, 1);
    const checkedInCount = delegates.filter(d => d.isCheckedIn).length;

    if (parts.length === 0) {
      if (delegates.length > 1) {
        parts.push(`${delegates.length} Delegates`);
      } else {
        parts.push('1 Adult/Youth');
      }
    }

    return {
      totalPasses: displayTotal,
      checkedInPasses: checkedInCount,
      breakdownText: parts.join(', ')
    };
  };

  // Toggle in-person check-in for an individual delegate pass
  const handleToggleDelegateCheckIn = async (reg: RegistrationData, passId: string, currentlyCheckedIn: boolean, delegateName?: string) => {
    if (!reg.id) return;
    try {
      const currentDelegates = getDelegatePassesForReg(reg);
      const personSeed = getPersonDeterministicSeed(reg.email, reg.phone, reg.name);
      const primaryPassId = reg.passId || getBibleVersePassId(personSeed || reg.id, 0, reg.name);
      const isTargetPrimary = passId.toLowerCase() === primaryPassId.toLowerCase() || passId === reg.id || (delegateName && delegateName.toLowerCase().trim() === reg.name.toLowerCase().trim());

      let updatedScanned: string[] = [];

      currentDelegates.forEach(del => {
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

      // Deduplicate scanned identifiers
      updatedScanned = Array.from(new Set(updatedScanned));

      // Calculate if all or any delegates in this group are checked in
      const overallCheckedIn = updatedScanned.length > 0;
      const nowIso = new Date().toISOString();

      await updateRegistrationInFirestore(reg.id, {
        checkedIn: overallCheckedIn,
        checkedInAt: !currentlyCheckedIn ? nowIso : (overallCheckedIn ? reg.checkedInAt : undefined),
        checkedInBy: user?.displayName || user?.email || 'Admin',
        scannedPassIds: updatedScanned
      });

      // If there are linked records in Firestore matching this passId, update their checkedIn state
      const linkedMatch = registrations.find(r => r.isAdditionalAttendee && r.primaryContactId === reg.id && (r.passId?.toLowerCase() === passId.toLowerCase() || (delegateName && r.name.toLowerCase().trim() === delegateName.toLowerCase().trim())));
      if (linkedMatch?.id) {
        await updateRegistrationInFirestore(linkedMatch.id, {
          checkedIn: !currentlyCheckedIn,
          checkedInAt: !currentlyCheckedIn ? nowIso : undefined,
          checkedInBy: user?.displayName || user?.email || 'Admin',
          scannedPassIds: !currentlyCheckedIn ? [passId] : []
        });
      }

      setRegistrations(prev => prev.map(r => {
        if (r.id === reg.id) {
          return {
            ...r,
            checkedIn: overallCheckedIn,
            checkedInAt: !currentlyCheckedIn ? nowIso : (overallCheckedIn ? r.checkedInAt : undefined),
            checkedInBy: user?.displayName || user?.email || 'Admin',
            scannedPassIds: updatedScanned
          };
        }
        if (linkedMatch && r.id === linkedMatch.id) {
          return {
            ...r,
            checkedIn: !currentlyCheckedIn,
            checkedInAt: !currentlyCheckedIn ? nowIso : undefined,
            checkedInBy: user?.displayName || user?.email || 'Admin',
            scannedPassIds: !currentlyCheckedIn ? [passId] : []
          };
        }
        return r;
      }));
    } catch (err) {
      console.error('Failed to toggle delegate check-in:', err);
    }
  };

  // Toggle / Undo in-person check-in for an entire registration order
  const handleToggleAllOrderCheckIn = async (reg: RegistrationData, undoAll: boolean) => {
    if (!reg.id) return;
    try {
      const currentDelegates = getDelegatePassesForReg(reg);
      const nowIso = new Date().toISOString();

      let updatedScanned: string[] = [];

      if (!undoAll) {
        currentDelegates.forEach(del => {
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
        });
        updatedScanned = Array.from(new Set(updatedScanned));
      }

      const overallCheckedIn = !undoAll;

      await updateRegistrationInFirestore(reg.id, {
        checkedIn: overallCheckedIn,
        checkedInAt: !undoAll ? nowIso : undefined,
        checkedInBy: user?.displayName || user?.email || 'Admin',
        scannedPassIds: updatedScanned
      });

      const linkedMatches = registrations.filter(r => r.isAdditionalAttendee && (r.primaryContactId === reg.id || r.linkedDocId === reg.id));
      for (const linked of linkedMatches) {
        if (linked.id) {
          await updateRegistrationInFirestore(linked.id, {
            checkedIn: overallCheckedIn,
            checkedInAt: !undoAll ? nowIso : undefined,
            checkedInBy: user?.displayName || user?.email || 'Admin',
            scannedPassIds: !undoAll && linked.passId ? [linked.passId] : []
          });
        }
      }

      setRegistrations(prev => prev.map(r => {
        if (r.id === reg.id || (r.isAdditionalAttendee && (r.primaryContactId === reg.id || r.linkedDocId === reg.id))) {
          return {
            ...r,
            checkedIn: overallCheckedIn,
            checkedInAt: !undoAll ? nowIso : undefined,
            checkedInBy: user?.displayName || user?.email || 'Admin',
            scannedPassIds: !undoAll && r.passId ? [r.passId] : updatedScanned
          };
        }
        return r;
      }));
    } catch (err) {
      console.error('Failed to toggle order check-in:', err);
    }
  };

  // Bulk check-in / bulk undo check-in for selected orders
  const handleBulkToggleCheckIn = async (undoAll: boolean) => {
    if (selectedRegIds.length === 0) return;
    const targetRegs = registrations.filter(r => r.id && selectedRegIds.includes(r.id));
    for (const reg of targetRegs) {
      await handleToggleAllOrderCheckIn(reg, undoAll);
    }
  };

  // Print/Download single delegate pass PDF
  const handlePrintDelegatePass = async (reg: RegistrationData, delegate: any) => {
    try {
      const passes = await generateAllAttendeePasses(reg);
      const targetPass = passes.find(p => p.passId === delegate.passId || p.name.toLowerCase() === delegate.name.toLowerCase()) || passes[0];
      if (targetPass) {
        await downloadIndividualPassPDF(targetPass);
      } else {
        await downloadPDFPass(reg);
      }
    } catch (err) {
      console.error('Error downloading delegate pass:', err);
      await downloadPDFPass(reg);
    }
  };
  const effectiveRegistrations = primaryRegistrations.length > 0 ? primaryRegistrations : registrations;

  const conferenceRegs = effectiveRegistrations.filter(r => r.type !== 'musical');
  const musicalRegs = effectiveRegistrations.filter(r => r.type === 'musical');

  const totalConferenceFormCount = conferenceRegs.length;
  const totalMusicalFormCount = musicalRegs.length;
  const totalAllCount = effectiveRegistrations.length;

  const getRegistrationAttendeesCount = (r: RegistrationData) => {
    const breakdownSum = (r.adultsCount || 0) + (r.teensCount || 0) + (r.preteensCount || 0) + (r.childrenCount || 0) + (r.kidsCount || 0) + (r.toddlersCount || 0);
    if (breakdownSum > 0) return breakdownSum;
    if (r.selectedSeats && r.selectedSeats.length > 0) return r.selectedSeats.length;
    if (r.additionalAttendees && r.additionalAttendees.length > 0) return 1 + r.additionalAttendees.length;
    return 1;
  };

  const getConferenceBreakdownForReg = (r: RegistrationData) => {
    let adults = r.adultsCount || 0;
    let teens = r.teensCount || 0;
    let preteens = r.preteensCount || 0;
    let children = r.childrenCount || 0;
    let kids = r.kidsCount || 0;
    let toddlers = r.toddlersCount || 0;

    const breakdownSum = adults + teens + preteens + children + kids + toddlers;
    if (breakdownSum > 0) {
      return { adults, teens, preteens, children, kids, toddlers };
    }

    adults = 1;
    if (r.additionalAttendees && r.additionalAttendees.length > 0) {
      r.additionalAttendees.forEach(a => {
        const cat = (a.categoryLabel || a.category || '').toLowerCase();
        if (cat.includes('teen') && !cat.includes('pre')) teens++;
        else if (cat.includes('pre-teen') || cat.includes('preteen')) preteens++;
        else if (cat.includes('child')) children++;
        else if (cat.includes('kid')) kids++;
        else if (cat.includes('toddler')) toddlers++;
        else adults++;
      });
    }
    return { adults, teens, preteens, children, kids, toddlers };
  };

  const confBreakdown = conferenceRegs.reduce((acc, r) => {
    const b = getConferenceBreakdownForReg(r);
    acc.adults += b.adults;
    acc.teens += b.teens;
    acc.preteens += b.preteens;
    acc.children += b.children;
    acc.kids += b.kids;
    acc.toddlers += b.toddlers;
    return acc;
  }, { adults: 0, teens: 0, preteens: 0, children: 0, kids: 0, toddlers: 0 });

  const confAdults = confBreakdown.adults;
  const confTeens = confBreakdown.teens;
  const confPreteens = confBreakdown.preteens;
  const confChildren = confBreakdown.children;
  const confKids = confBreakdown.kids;
  const confToddlers = confBreakdown.toddlers;

  const confMainCount = confAdults + confTeens;
  const confYoungCount = confPreteens + confChildren + confKids + confToddlers;
  const totalConferenceAttendees = confMainCount + confYoungCount;
  const totalConferenceCount = confMainCount > 0 ? confMainCount : totalConferenceAttendees;

  const totalMusicalSeats = musicalRegs.reduce((acc, r) => acc + (r.selectedSeats ? r.selectedSeats.length : 0), 0);
  const totalMusicalAttendees = musicalRegs.reduce((acc, r) => acc + getRegistrationAttendeesCount(r), 0);
  const totalMusicalCount = musicalRegs.length;

  const getEffectiveAdults = (r: RegistrationData) => {
    const breakdownSum = (r.adultsCount || 0) + (r.teensCount || 0) + (r.preteensCount || 0) + (r.childrenCount || 0) + (r.kidsCount || 0) + (r.toddlersCount || 0);
    if (breakdownSum > 0) return r.adultsCount || 0;
    return getRegistrationAttendeesCount(r);
  };

  const totalAdults = effectiveRegistrations.reduce((acc, r) => acc + getEffectiveAdults(r), 0);
  const totalTeens = effectiveRegistrations.reduce((acc, r) => acc + (r.teensCount || 0), 0);
  const totalPreteens = effectiveRegistrations.reduce((acc, r) => acc + (r.preteensCount || 0), 0);
  const totalChildren = effectiveRegistrations.reduce((acc, r) => acc + (r.childrenCount || 0), 0);
  const totalKids = effectiveRegistrations.reduce((acc, r) => acc + (r.kidsCount || 0), 0);
  const totalToddlers = effectiveRegistrations.reduce((acc, r) => acc + (r.toddlersCount || 0), 0);
  const totalPeopleCount = totalAdults + totalTeens + totalPreteens + totalChildren + totalKids + totalToddlers;

  const activeAdminEmail = (user?.email || currentUserEmail || '').toLowerCase().trim();
  const isSuperUser = activeAdminEmail === SUPER_ADMIN_EMAIL.toLowerCase().trim() || activeAdminEmail === 'sijumonabraham@gmail.com' || activeAdminEmail === PRIMARY_ADMIN_GMAIL.toLowerCase().trim() || activeAdminEmail === ALT_SUPER_ADMIN.toLowerCase().trim();
  
  const currentUserAdminRecord = adminsList.find(a => a.email.toLowerCase().trim() === activeAdminEmail);
  const rawRole = currentUserAdminRecord?.role;
  const currentUserRole = isSuperUser 
    ? 'super_admin' 
    : ((rawRole as string) === 'content_manager' ? 'content_admin' : (rawRole || 'admin'));

  const isSuperAdmin = isSuperUser || currentUserRole === 'super_admin';
  const isFullAdmin = isSuperUser || currentUserRole === 'super_admin' || currentUserRole === 'full_admin' || currentUserRole === 'admin';
  const isContentAdminOnly = !isSuperAdmin && ((currentUserRole as string) === 'content_admin' || (currentUserRole as string) === 'content_manager');
  const isSupportAdminOnly = !isSuperAdmin && currentUserRole === 'support_admin';
  const isTicketAdminOnly = !isSuperAdmin && currentUserRole === 'ticket_admin';
  const isIntercessionCoordinatorOnly = !isSuperAdmin && currentUserRole === 'intercession_coordinator';
  const isInvitationAdminOnly = !isSuperAdmin && currentUserRole === 'invitation_admin';

  useEffect(() => {
    if (isInvitationAdminOnly && adminTab !== 'invitations') {
      setAdminTab('invitations');
    } else if (isTicketAdminOnly && adminTab !== 'tickets') {
      setAdminTab('tickets');
    } else if (isContentAdminOnly && adminTab !== 'content') {
      setAdminTab('content');
    } else if (isIntercessionCoordinatorOnly && adminTab !== 'intercessions') {
      setAdminTab('intercessions');
    } else if (isSupportAdminOnly && adminTab !== 'messages' && adminTab !== 'registrations' && adminTab !== 'tickets' && adminTab !== 'intercessions') {
      setAdminTab('messages');
    } else if (!isSuperAdmin && (adminTab === 'admins' || adminTab === 'home')) {
      setAdminTab(isInvitationAdminOnly ? 'invitations' : 'messages');
    }
  }, [isInvitationAdminOnly, isTicketAdminOnly, isContentAdminOnly, isIntercessionCoordinatorOnly, isSupportAdminOnly, isSuperAdmin, adminTab]);

  if (loadingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white">
        <Sparkles className="w-8 h-8 text-[#E8B400] animate-spin mr-3" />
        <span className="font-medium text-lg">Authenticating Admin Session...</span>
      </div>
    );
  }

  // LOGGED OUT STATE
  if (!user) {
    return (
      <div className="min-h-screen pt-12 pb-24 px-4 flex items-center justify-center">
        <div className="cream-card p-8 sm:p-12 max-w-md w-full text-center border-2 border-[#E8B400]/40 shadow-2xl space-y-6 relative">
          
          {/* Close Portal Button */}
          <button
            type="button"
            onClick={handleClosePortal}
            className="absolute top-4 right-4 p-2 rounded-full bg-[#241226]/10 hover:bg-[#241226]/20 text-[#241226] transition-colors cursor-pointer"
            title="Close Organizer Portal"
            aria-label="Close Organizer Portal"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="w-16 h-16 mx-auto rounded-full bg-signature-gradient p-1 flex items-center justify-center shadow-lg">
            <div className="w-full h-full bg-[#1a0b22] rounded-full flex items-center justify-center">
              <Shield className="w-8 h-8 text-[#E8B400]" />
            </div>
          </div>

          <div>
            <h2 className="font-poster text-3xl text-[#241226] tracking-wide mb-1">
              GRACIA ORGANIZER PORTAL
            </h2>
            <p className="font-script text-xl text-[#C81E6E]">
              Jesus Youth Singapore Secured Access
            </p>
          </div>

          <p className="text-xs text-[#241226]/80 leading-relaxed">
            Authorized organizers and super admins must sign in with Google. Access is restricted to the approved email allow-list.
          </p>

          {authError && (
            (authError.startsWith('UNAUTHORIZED_DOMAIN:') || authError.includes('Domain Not Authorized') || authError.includes('unauthorized-domain')) ? (
              (() => {
                const domainName = authError.startsWith('UNAUTHORIZED_DOMAIN:') 
                  ? authError.replace('UNAUTHORIZED_DOMAIN:', '') 
                  : (typeof window !== 'undefined' ? window.location.hostname : 'jy25sg-gracia.vercel.app');
                return (
                  <div className="p-4 rounded-xl bg-amber-50 border-2 border-amber-300 text-xs text-amber-950 text-left space-y-3 shadow-md">
                    <div className="flex items-center space-x-2 text-amber-900 font-bold text-sm">
                      <AlertTriangle className="w-5 h-5 shrink-0 text-amber-600" />
                      <span>Domain Not Authorized in Firebase</span>
                    </div>

                    <p className="text-[#241226]/80 leading-relaxed text-xs">
                      Firebase Authentication needs permission to allow Google Sign-In on this domain:
                    </p>

                    <div className="flex items-center justify-between p-2.5 rounded-lg bg-amber-100/90 border border-amber-300/80 font-mono text-xs font-bold text-amber-950">
                      <span className="truncate mr-2">{domainName}</span>
                      <button
                        type="button"
                        onClick={() => handleCopyDomain(domainName)}
                        className="px-2.5 py-1 rounded bg-[#241226] text-white font-sans text-[11px] font-semibold hover:bg-[#241226]/80 transition-colors shrink-0 flex items-center space-x-1 cursor-pointer"
                      >
                        {copiedDomain ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-400" />
                            <span>Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3 text-[#E8B400]" />
                            <span>Copy Domain</span>
                          </>
                        )}
                      </button>
                    </div>

                    <div className="space-y-1.5 pt-1 text-[11px] text-amber-900">
                      <p className="font-bold text-amber-950">How to Fix in Firebase Console (10 seconds):</p>
                      <ol className="list-decimal list-inside space-y-1 pl-1 leading-relaxed text-[#241226]/90">
                        <li>
                          Open{' '}
                          <a
                            href={FIREBASE_CONSOLE_AUTH_URL}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center space-x-1 font-bold text-[#C81E6E] underline hover:text-[#241226]"
                          >
                            <span>Firebase Console Settings</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </li>
                        <li>Scroll to <strong>Authorized Domains</strong> and click <strong>Add domain</strong>.</li>
                        <li>Paste <code className="bg-amber-200/80 px-1 py-0.5 rounded font-mono font-bold text-amber-950">{domainName}</code> and click <strong>Save</strong>.</li>
                        <li>Return here and click <strong>Sign In with Google</strong>.</li>
                      </ol>
                    </div>
                  </div>
                );
              })()
            ) : (
              <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800 text-left space-y-2.5 shadow-sm">
                <div className="flex items-center space-x-2 text-red-900 font-bold">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
                  <span>Authentication Error</span>
                </div>
                <p className="leading-relaxed font-medium">{authError}</p>
              </div>
            )
          )}

          <div className="space-y-3 pt-2">
            <button
              onClick={() => handleGoogleSignIn(false)}
              disabled={signingIn}
              id="admin-google-signin-btn"
              className="w-full py-3.5 px-6 rounded-xl bg-signature-gradient text-white font-bold text-base shadow-xl hover:opacity-95 transition-opacity flex items-center justify-center space-x-3 cursor-pointer disabled:opacity-60"
            >
              {signingIn ? (
                <>
                  <Sparkles className="w-5 h-5 animate-spin" />
                  <span>Authenticating...</span>
                </>
              ) : (
                <>
                  <LogIn className="w-5 h-5" />
                  <span>Sign In with Google</span>
                </>
              )}
            </button>

            <button
              onClick={() => handleGoogleSignIn(true)}
              disabled={signingIn}
              id="admin-google-signin-redirect-btn"
              className="w-full py-2.5 px-4 rounded-xl border border-[#241226]/20 bg-white/60 text-[#241226] text-xs font-semibold hover:bg-white transition-colors flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-60"
            >
              <span>Sign In via Full Page Redirect</span>
            </button>

            <button
              type="button"
              onClick={handleClosePortal}
              className="w-full py-2.5 px-4 rounded-xl border border-dashed border-[#241226]/30 bg-transparent text-[#241226]/80 text-xs font-semibold hover:bg-[#241226]/5 transition-colors flex items-center justify-center space-x-2 cursor-pointer"
            >
              <X className="w-4 h-4" />
              <span>Close Portal & Return to Main Site</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // LOGGED IN BUT UNAPPROVED STATE
  if (!isApproved) {
    return (
      <div className="min-h-screen pt-8 pb-24 px-4 flex items-center justify-center">
        <div className="cream-card p-6 sm:p-10 max-w-xl w-full border-2 border-[#E8B400]/40 shadow-2xl space-y-6 relative">
          
          {/* Close Portal Button */}
          <button
            type="button"
            onClick={handleClosePortal}
            className="absolute top-4 right-4 p-2 rounded-full bg-[#241226]/10 hover:bg-[#241226]/20 text-[#241226] transition-colors cursor-pointer"
            title="Close Organizer Portal"
            aria-label="Close Organizer Portal"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="text-center space-y-2">
            <div className="w-16 h-16 mx-auto rounded-full bg-amber-100 border-2 border-amber-400 text-amber-700 flex items-center justify-center shadow-md">
              <AlertTriangle className="w-8 h-8" />
            </div>

            <h2 className="font-poster text-3xl text-[#241226]">ADMIN ACCESS PENDING</h2>
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-900 text-xs font-mono font-semibold">
              <span>Signed in as: {user.email}</span>
            </div>
          </div>

          <p className="text-xs text-[#241226]/80 text-center leading-relaxed">
            Your Google account is recognized, but this email address is not yet approved on the organizer allow-list. You can submit an access request below for Super Admin review.
          </p>

          {/* Request Access from Super Admin */}
          <div className="p-4 rounded-xl bg-amber-50/80 border border-amber-200/80 space-y-4 text-left">
            <div className="flex items-center space-x-2 text-amber-950 font-bold text-xs">
              <Mail className="w-4 h-4 text-[#E8752C]" />
              <span>Send Access Request to Super Admin</span>
            </div>

            <form onSubmit={handleSendAccessRequest} className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-[#241226]/80 mb-1">Your Full Name</label>
                <input
                  type="text"
                  required
                  value={applicantName || ''}
                  onChange={(e) => setApplicantName(e.target.value)}
                  placeholder={user.displayName || "e.g. John Doe"}
                  className="w-full px-3 py-2 rounded-lg bg-white border border-[#241226]/20 text-xs text-[#241226] focus:outline-none focus:ring-2 focus:ring-[#E8752C]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#241226]/80 mb-1">Role / Reason for Access</label>
                <input
                  type="text"
                  required
                  value={applicantNote || ''}
                  onChange={(e) => setApplicantNote(e.target.value)}
                  placeholder="e.g. Conference Coordinator / Registration Team"
                  className="w-full px-3 py-2 rounded-lg bg-white border border-[#241226]/20 text-xs text-[#241226] focus:outline-none focus:ring-2 focus:ring-[#E8752C]"
                />
              </div>

              <button
                type="submit"
                disabled={sendingRequest}
                className="w-full py-3 px-4 rounded-xl bg-signature-gradient text-white font-bold text-xs shadow-lg hover:opacity-95 transition-opacity flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-60"
              >
                {sendingRequest ? (
                  <>
                    <Sparkles className="w-4 h-4 animate-spin" />
                    <span>Submitting Request...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Send Request to Super Admin for Admin Access</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {requestSentMessage && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 text-left space-y-1">
              <div className="flex items-center space-x-1.5 font-bold text-emerald-800">
                <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Request Submitted Successfully</span>
              </div>
              <p className="text-[11px] text-emerald-900/90 leading-relaxed">{requestSentMessage}</p>
            </div>
          )}

          <div className="pt-2 flex flex-col sm:flex-row gap-2">
            <button
              onClick={handleCheckPermissionStatus}
              disabled={checkingStatus}
              className="flex-1 py-2.5 px-4 rounded-xl border border-[#241226]/20 bg-white/80 text-[#241226] text-xs font-semibold hover:bg-white transition-colors flex items-center justify-center space-x-2 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${checkingStatus ? 'animate-spin' : ''}`} />
              <span>Re-check Permission Status</span>
            </button>

            <button
              onClick={handleLogout}
              className="py-2.5 px-4 rounded-xl bg-[#241226]/10 text-[#241226] text-xs font-bold hover:bg-[#241226]/20 transition-colors flex items-center justify-center space-x-1.5 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>

            <button
              type="button"
              onClick={handleClosePortal}
              className="py-2.5 px-4 rounded-xl border border-dashed border-[#241226]/30 text-[#241226] text-xs font-bold hover:bg-[#241226]/10 transition-colors flex items-center justify-center space-x-1.5 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              <span>Close Portal</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Intercession Summary Metrics & Filtering Calculations
  const totalIntercessorsCount = intercessionsList.length;
  const totalMassesCommitted = intercessionsList.reduce((sum, r) => sum + (r.holyMass || 0), 0);
  const totalAdorationSlotsCommitted = intercessionsList.reduce((sum, r) => sum + (r.adoration || 0), 0);
  const totalAdorationHoursCommitted = Math.floor(totalAdorationSlotsCommitted / 2);
  const totalRosariesCommitted = intercessionsList.reduce((sum, r) => sum + (r.rosary || 0) + (r.decadeRosary || 0), 0);
  const totalChapletsCommitted = intercessionsList.reduce((sum, r) => sum + (r.divineMercy || 0), 0);
  const totalFastingCommitted = intercessionsList.reduce((sum, r) => sum + (r.fastMeal || 0) + (r.abstainMeat || 0), 0);
  const totalShortPrayersCommitted = intercessionsList.reduce((sum, r) => sum + (r.shortPrayers || 0), 0);

  // Completed Intercessions Metrics
  const totalMassesCompleted = intercessionsList.reduce((sum, r) => sum + (r.completedHolyMass || 0), 0);
  const totalAdorationSlotsCompleted = intercessionsList.reduce((sum, r) => sum + (r.completedAdoration || 0), 0);
  const totalAdorationHoursCompleted = Math.floor(totalAdorationSlotsCompleted / 2);
  const totalRosariesCompleted = intercessionsList.reduce((sum, r) => sum + (r.completedRosary || 0) + (r.completedDecadeRosary || 0), 0);
  const totalChapletsCompleted = intercessionsList.reduce((sum, r) => sum + (r.completedDivineMercy || 0), 0);
  const totalFastingCompleted = intercessionsList.reduce((sum, r) => sum + (r.completedFastMeal || 0) + (r.completedAbstainMeat || 0), 0);
  const totalShortPrayersCompleted = intercessionsList.reduce((sum, r) => sum + (r.completedShortPrayers || 0), 0);

  const grandTotalPledged = totalMassesCommitted + totalAdorationSlotsCommitted + totalRosariesCommitted + totalChapletsCommitted + totalFastingCommitted + totalShortPrayersCommitted;
  const grandTotalCompleted = totalMassesCompleted + totalAdorationSlotsCompleted + totalRosariesCompleted + totalChapletsCompleted + totalFastingCompleted + totalShortPrayersCompleted;
  const overallProgressPct = grandTotalPledged > 0 ? Math.min(100, Math.round((grandTotalCompleted / grandTotalPledged) * 100)) : 0;

  const fullyCompletedCount = intercessionsList.filter((rec) => {
    const pledged = (rec.holyMass||0) + (rec.adoration||0) + (rec.rosary||0) + (rec.decadeRosary||0) + (rec.divineMercy||0) + (rec.fastMeal||0) + (rec.abstainMeat||0) + (rec.shortPrayers||0);
    const done = (rec.completedHolyMass||0) + (rec.completedAdoration||0) + (rec.completedRosary||0) + (rec.completedDecadeRosary||0) + (rec.completedDivineMercy||0) + (rec.completedFastMeal||0) + (rec.completedAbstainMeat||0) + (rec.completedShortPrayers||0);
    return pledged > 0 && done >= pledged;
  }).length;

  const inProgressCount = intercessionsList.filter((rec) => {
    const pledged = (rec.holyMass||0) + (rec.adoration||0) + (rec.rosary||0) + (rec.decadeRosary||0) + (rec.divineMercy||0) + (rec.fastMeal||0) + (rec.abstainMeat||0) + (rec.shortPrayers||0);
    const done = (rec.completedHolyMass||0) + (rec.completedAdoration||0) + (rec.completedRosary||0) + (rec.completedDecadeRosary||0) + (rec.completedDivineMercy||0) + (rec.completedFastMeal||0) + (rec.completedAbstainMeat||0) + (rec.completedShortPrayers||0);
    return pledged > 0 && done > 0 && done < pledged;
  }).length;

  const filteredIntercessions = intercessionsList.filter((rec) => {
    const q = intercessionSearchQuery.trim().toLowerCase();
    const matchesSearch = !q || 
      (rec.name && rec.name.toLowerCase().includes(q)) || 
      (rec.email && rec.email.toLowerCase().includes(q)) || 
      (rec.phone && rec.phone.toLowerCase().includes(q));

    if (!matchesSearch) return false;

    const pledged = (rec.holyMass||0) + (rec.adoration||0) + (rec.rosary||0) + (rec.decadeRosary||0) + (rec.divineMercy||0) + (rec.fastMeal||0) + (rec.abstainMeat||0) + (rec.shortPrayers||0);
    const done = (rec.completedHolyMass||0) + (rec.completedAdoration||0) + (rec.completedRosary||0) + (rec.completedDecadeRosary||0) + (rec.completedDivineMercy||0) + (rec.completedFastMeal||0) + (rec.completedAbstainMeat||0) + (rec.completedShortPrayers||0);

    if (intercessionFilter === 'completed_100') return pledged > 0 && done >= pledged;
    if (intercessionFilter === 'in_progress') return pledged > 0 && done > 0 && done < pledged;
    if (intercessionFilter === 'not_started') return done === 0;

    if (intercessionFilter === 'mass') return (rec.holyMass || 0) > 0;
    if (intercessionFilter === 'adoration') return (rec.adoration || 0) > 0;
    if (intercessionFilter === 'rosary') return (rec.rosary || 0) > 0 || (rec.decadeRosary || 0) > 0;
    if (intercessionFilter === 'divineMercy') return (rec.divineMercy || 0) > 0;
    if (intercessionFilter === 'fasting') return (rec.fastMeal || 0) > 0 || (rec.abstainMeat || 0) > 0;
    if (intercessionFilter === 'shortPrayers') return (rec.shortPrayers || 0) > 0;

    return true;
  });

  // AUTHORIZED ADMIN DASHBOARD VIEW
  return (
    <div id="admin-panel-top" className="min-h-screen pb-24 px-2 sm:px-4 lg:px-6 w-full max-w-full mx-auto pt-8">
      
      {/* Apps Script Guide Modal */}
      <AppsScriptModal
        isOpen={showScriptModal}
        onClose={() => setShowScriptModal(false)}
        currentUrl={siteContent?.appsScriptUrl || ''}
        onSaveUrl={async (url) => {
          await saveSiteContent({ appsScriptUrl: url });
          const updated = await fetchSiteContent();
          setSiteContent(updated);
        }}
      />

      {/* ADMIN HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-white/10 mb-8">
        <div>
          <div className="flex items-center space-x-2 flex-wrap gap-y-1">
            <span className="font-poster text-3xl text-white">GRACIA ADMIN PANEL</span>
            <span className={`text-[10px] font-bold uppercase tracking-widest px-2.5 py-0.5 rounded border ${
              currentUserRole === 'super_admin'
                ? 'bg-[#E8B400]/20 text-[#E8B400] border-[#E8B400]/40'
                : currentUserRole === 'full_admin'
                ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                : currentUserRole === 'admin'
                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                : currentUserRole === 'support_admin'
                ? 'bg-[#E8752C]/20 text-[#E8752C] border-[#E8752C]/40'
                : ((currentUserRole as string) === 'content_admin' || (currentUserRole as string) === 'content_manager')
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                : currentUserRole === 'ticket_admin'
                ? 'bg-pink-500/20 text-pink-300 border-pink-500/40'
                : currentUserRole === 'intercession_coordinator'
                ? 'bg-purple-600/30 text-purple-300 border-purple-400/50'
                : currentUserRole === 'invitation_admin'
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
            }`}>
              {currentUserRole === 'super_admin'
                ? 'SUPER ADMIN'
                : currentUserRole === 'full_admin'
                ? 'FULL ADMIN'
                : currentUserRole === 'admin'
                ? 'ADMIN (MAIN)'
                : currentUserRole === 'support_admin'
                ? 'INBOX & SUPPORT ADMIN'
                : ((currentUserRole as string) === 'content_admin' || (currentUserRole as string) === 'content_manager')
                ? 'CONTENT MANAGER'
                : currentUserRole === 'ticket_admin'
                ? 'TICKET ADMIN'
                : currentUserRole === 'intercession_coordinator'
                ? 'INTERCESSION COORDINATOR'
                : currentUserRole === 'invitation_admin'
                ? (currentUserAdminRecord?.invitationRoles && currentUserAdminRecord.invitationRoles.length > 0
                    ? formatInvitationRoleName(currentUserAdminRecord.invitationRoles).toUpperCase()
                    : 'INVITATION ADMIN')
                : 'ADMIN (MAIN)'}
            </span>
          </div>
          <p className="text-xs text-white/60 mt-1">
            Signed in as: <strong className="text-[#E8B400] font-mono">{user.email}</strong>
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={handleClosePortal}
            className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white font-semibold text-xs flex items-center space-x-2 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
            <span>Return to Site</span>
          </button>
          <button
            onClick={handleLogout}
            className="px-4 py-2 rounded-xl bg-[#D62828]/20 hover:bg-[#D62828]/40 border border-[#D62828]/40 text-[#D62828] hover:text-white font-semibold text-xs flex items-center space-x-2 transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      {/* METRIC SUMMARY CARDS - ROLE SPECIFIC */}
      {!isContentAdminOnly && !isIntercessionCoordinatorOnly && !isInvitationAdminOnly && (
        <div className={`grid gap-4 mb-8 ${
          isTicketAdminOnly 
            ? 'grid-cols-1 sm:grid-cols-3' 
            : isFullAdmin 
            ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5' 
            : 'grid-cols-2 sm:grid-cols-4'
        }`}>
          
          {/* Card 1: Unread Messages (Hide for Ticket Admin) */}
          {!isTicketAdminOnly && (
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl">
              <div className="text-xs text-white/60 font-semibold uppercase">Unread Messages</div>
              <div className="font-poster text-3xl sm:text-4xl text-[#E8752C] mt-1">{unreadMessagesCount}</div>
              <div className="text-[10px] text-white/40 mt-1">{messagesList.length} Total Inquiries</div>
            </div>
          )}

          {/* Card 2: Total People Registered */}
          <div className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl">
            <div className="text-xs text-white/60 font-semibold uppercase">Total People Registered</div>
            <div className="font-poster text-3xl sm:text-4xl text-[#E8B400] mt-1">{totalPeopleCount}</div>
            <div className="text-[10px] text-white/40 mt-1">{totalAdults} Adults, {totalTeens} Teens, {totalPreteens + totalChildren + totalKids + totalToddlers} Children & Toddlers</div>
          </div>

          {/* Card 3: Conference Entries */}
          <div className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl">
            <div className="text-xs text-white/60 font-semibold uppercase">Conference Entries</div>
            <div className="font-poster text-3xl sm:text-4xl text-[#3B82F6] mt-1">{confMainCount}</div>
            <div className="text-[11px] text-[#3B82F6]/90 font-semibold mt-1">
              {confAdults} Adults & {confTeens} Youths/Teens
            </div>
            <div className="text-[10px] text-white/50 mt-0.5">
              Sub-categories: {confPreteens} Pre-Teens, {confChildren + confKids} Children/Kids, {confToddlers} Toddlers ({totalConferenceAttendees} Total)
            </div>
          </div>

          {/* Card 4: Musical Concert Entries */}
          <div className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl">
            <div className="text-xs text-white/60 font-semibold uppercase font-bold">Musical Concert Entries</div>
            <div className="font-poster text-3xl sm:text-4xl text-[#EC4899] mt-1">{totalMusicalCount}</div>
            <div className="text-[10px] text-white/40 mt-1">{totalMusicalSeats || totalMusicalAttendees} Reserved Seats</div>
          </div>

          {/* Card 5: Approved Admins (Show only for Super Admin) */}
          {isSuperAdmin && (
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl">
              <div className="text-xs text-white/60 font-semibold uppercase">Approved Admins</div>
              <div className="font-poster text-3xl sm:text-4xl text-emerald-400 mt-1">{adminsList.filter(a => a.status === 'approved').length}</div>
              <div className="text-[10px] text-white/40 mt-1">Active Organizers</div>
            </div>
          )}

        </div>
      )}

      {/* SUB-TAB NAVIGATION */}
      <div id="admin-tab-bar" className="flex border-b border-white/10 mb-8 overflow-x-auto">
        
        {/* SUPER ADMIN HUB TAB */}
        {isSuperAdmin && (
          <button
            onClick={() => setAdminTab('home')}
            className={`px-5 py-3 font-poster text-lg tracking-wider transition-all border-b-2 flex items-center space-x-2 shrink-0 cursor-pointer ${
              adminTab === 'home' 
                ? 'border-[#E8B400] text-[#E8B400]' 
                : 'border-transparent text-white/60 hover:text-white'
            }`}
          >
            <Shield className="w-4 h-4 text-[#E8B400]" />
            <span>SUPER ADMIN HUB</span>
          </button>
        )}
        {!isContentAdminOnly && !isTicketAdminOnly && !isIntercessionCoordinatorOnly && !isInvitationAdminOnly && (
          <button
            onClick={() => setAdminTab('messages')}
            className={`px-5 py-3 font-poster text-lg tracking-wider transition-all border-b-2 flex items-center space-x-2 shrink-0 cursor-pointer ${
              adminTab === 'messages' 
                ? 'border-[#E8752C] text-[#E8752C]' 
                : 'border-transparent text-white/60 hover:text-white'
            }`}
          >
            <Inbox className="w-4 h-4" />
            <span>INBOX / MESSAGES</span>
            {unreadMessagesCount > 0 && (
              <span className="px-2 py-0.5 text-[11px] rounded-full bg-[#E8752C] text-white font-bold ml-1 animate-pulse">
                {unreadMessagesCount}
              </span>
            )}
          </button>
        )}

        {/* TICKET CHECK-IN & SCANNER TAB */}
        {!isContentAdminOnly && !isIntercessionCoordinatorOnly && !isInvitationAdminOnly && (
          <button
            onClick={() => {
              setAdminTab('tickets');
              setTimeout(() => {
                const scannerTop = document.getElementById('barcode-scanner-top') || document.getElementById('admin-tab-bar');
                if (scannerTop) {
                  scannerTop.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
              }, 50);
            }}
            className={`px-5 py-3 font-poster text-lg tracking-wider transition-all border-b-2 flex items-center space-x-2 shrink-0 cursor-pointer ${
              adminTab === 'tickets' 
                ? 'border-[#EC4899] text-[#EC4899]' 
                : 'border-transparent text-white/60 hover:text-white'
            }`}
          >
            <Ticket className="w-4 h-4 text-[#EC4899]" />
            <span>TICKET CHECK-IN & SCANNER</span>
            <span className="px-2 py-0.5 text-[10px] rounded-full bg-[#EC4899]/20 text-[#EC4899] border border-[#EC4899]/40 font-mono font-bold ml-1">
              {registrations.filter(r => r.checkedIn).length}/{registrations.length}
            </span>
          </button>
        )}

        {!isContentAdminOnly && !isTicketAdminOnly && !isIntercessionCoordinatorOnly && !isInvitationAdminOnly && (
          <button
            onClick={() => setAdminTab('registrations')}
            className={`px-5 py-3 font-poster text-lg tracking-wider transition-all border-b-2 flex items-center space-x-2 shrink-0 cursor-pointer ${
              adminTab === 'registrations' 
                ? 'border-[#E8752C] text-[#E8752C]' 
                : 'border-transparent text-white/60 hover:text-white'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>REGISTRATIONS ({primaryRegistrations.length})</span>
          </button>
        )}

        {/* INTERCESSIONS & SPIRITUAL BOUQUET TAB */}
        {!isContentAdminOnly && !isTicketAdminOnly && !isInvitationAdminOnly && (
          <button
            onClick={() => setAdminTab('intercessions')}
            className={`px-5 py-3 font-poster text-lg tracking-wider transition-all border-b-2 flex items-center space-x-2 shrink-0 cursor-pointer ${
              adminTab === 'intercessions' 
                ? 'border-purple-400 text-purple-300' 
                : 'border-transparent text-white/60 hover:text-white'
            }`}
          >
            <HeartHandshake className="w-4 h-4 text-purple-400" />
            <span>INTERCESSIONS ({intercessionsList.length})</span>
          </button>
        )}

        {/* INVITATIONS TAB */}
        {!isContentAdminOnly && !isTicketAdminOnly && (
          <button
            onClick={() => setAdminTab('invitations')}
            className={`px-5 py-3 font-poster text-lg tracking-wider transition-all border-b-2 flex items-center space-x-2 shrink-0 cursor-pointer ${
              adminTab === 'invitations' 
                ? 'border-[#E8B400] text-[#E8B400]' 
                : 'border-transparent text-white/60 hover:text-white'
            }`}
          >
            <Mail className="w-4 h-4 text-[#E8B400]" />
            <span>INVITATIONS</span>
          </button>
        )}

        {/* GROUPS & PROGRAM ALLOCATION TAB */}
        {!isContentAdminOnly && !isTicketAdminOnly && !isInvitationAdminOnly && (
          <button
            onClick={() => setAdminTab('groups')}
            className={`px-5 py-3 font-poster text-lg tracking-wider transition-all border-b-2 flex items-center space-x-2 shrink-0 cursor-pointer ${
              adminTab === 'groups' 
                ? 'border-indigo-400 text-indigo-300' 
                : 'border-transparent text-white/60 hover:text-white'
            }`}
          >
            <Palette className="w-4 h-4 text-indigo-400" />
            <span>GROUPS & PROGRAM SETTINGS</span>
          </button>
        )}

        {/* BIBLE VERSES PASS ID POOL TAB */}
        {(isSuperAdmin || (!isTicketAdminOnly && !isInvitationAdminOnly)) && (
          <button
            id="admin-tab-verses"
            onClick={() => setAdminTab('verses')}
            className={`px-5 py-3 font-poster text-lg tracking-wider transition-all border-b-2 flex items-center space-x-2 shrink-0 cursor-pointer ${
              adminTab === 'verses' 
                ? 'border-amber-400 text-amber-300 bg-amber-500/10' 
                : 'border-transparent text-amber-300/80 hover:text-amber-200 hover:bg-white/5'
            }`}
          >
            <BookOpen className="w-4 h-4 text-amber-400" />
            <span>PASS ID BIBLE VERSES</span>
            <span className="px-2 py-0.5 text-[10px] rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-mono font-bold ml-1">
              400+ Pool
            </span>
          </button>
        )}

        {isSuperAdmin && (
          <button
            onClick={() => setAdminTab('admins')}
            className={`px-5 py-3 font-poster text-lg tracking-wider transition-all border-b-2 flex items-center space-x-2 shrink-0 cursor-pointer ${
              adminTab === 'admins' 
                ? 'border-[#E8752C] text-[#E8752C]' 
                : 'border-transparent text-white/60 hover:text-white'
            }`}
          >
            <Shield className="w-4 h-4" />
            <span>ADMIN ALLOW-LIST</span>
          </button>
        )}

        {!isSupportAdminOnly && !isTicketAdminOnly && !isIntercessionCoordinatorOnly && !isInvitationAdminOnly && (
          <button
            onClick={() => setAdminTab('content')}
            className={`px-5 py-3 font-poster text-lg tracking-wider transition-all border-b-2 flex items-center space-x-2 shrink-0 cursor-pointer ${
              adminTab === 'content' 
                ? 'border-[#E8752C] text-[#E8752C]' 
                : 'border-transparent text-white/60 hover:text-white'
            }`}
          >
            <Edit className="w-4 h-4" />
            <span>CONTENT MANAGER</span>
          </button>
        )}
      </div>

      {/* TAB 0: SUPER ADMIN HOME PAGE HUB */}
      {adminTab === 'home' && isSuperAdmin && (
        <SuperAdminHomePage
          userEmail={user.email || 'Super Admin'}
          registrations={registrations}
          messagesList={messagesList}
          adminsList={adminsList}
          intercessionsList={intercessionsList}
          siteContent={siteContent}
          onUpdateSiteContent={async (updatedData) => {
            setSavingSiteContent(true);
            try {
              await saveSiteContent({ ...(siteContent || INITIAL_SITE_CONTENT), ...updatedData });
              const updated = await fetchSiteContent();
              if (updated) setSiteContent(updated);
            } finally {
              setSavingSiteContent(false);
            }
          }}
          onNavigateTab={(tab) => setAdminTab(tab)}
          onOpenGoLiveModal={() => setShowGoLiveModal(true)}
          onOpenBackupModal={() => setShowBackupSyncModal(true)}
          onOpenTechDocModal={() => setShowTechDocModal(true)}
          onOpenUserManualModal={() => setShowUserManualModal(true)}
        />
      )}

      {/* TAB 1: INBOX / MESSAGES VIEW */}
      {adminTab === 'messages' && !isIntercessionCoordinatorOnly && !isInvitationAdminOnly && (
        <div className="space-y-6">
          
          {/* Header Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl flex items-center justify-between">
              <div>
                <div className="text-xs text-white/60 font-semibold uppercase">Total Inquiries Received</div>
                <div className="font-poster text-3xl text-[#E8B400] mt-1">{messagesList.length}</div>
              </div>
              <Inbox className="w-8 h-8 text-[#E8B400]/40" />
            </div>

            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl flex items-center justify-between">
              <div>
                <div className="text-xs text-white/60 font-semibold uppercase">Unread Messages</div>
                <div className="font-poster text-3xl text-[#E8752C] mt-1">{unreadMessagesCount}</div>
              </div>
              <MessageSquare className="w-8 h-8 text-[#E8752C]/40" />
            </div>

            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl flex items-center justify-between">
              <div>
                <div className="text-xs text-white/60 font-semibold uppercase">Replied Inquiries</div>
                <div className="font-poster text-3xl text-emerald-400 mt-1">{repliedMessagesCount}</div>
              </div>
              <CheckCircle className="w-8 h-8 text-emerald-400/40" />
            </div>
          </div>

          {msgActionSuccess && (
            <div className="p-4 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center justify-between animate-fade-in">
              <div className="flex items-center space-x-2">
                <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{msgActionSuccess}</span>
              </div>
              <button onClick={() => setMsgActionSuccess(null)} className="text-white/60 hover:text-white cursor-pointer">✕</button>
            </div>
          )}

          {emailFailNotice && (
            <div className="p-4 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-200 text-xs space-y-3 animate-fade-in shadow-xl">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start space-x-2">
                  <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-amber-300 text-sm">Automated Email Dispatch Notice</p>
                    <p className="mt-0.5 text-amber-100">{emailFailNotice.text}</p>
                    {emailFailNotice.hint && (
                      <p className="mt-1 text-[11px] text-amber-300/90 font-mono bg-black/40 p-2 rounded-lg border border-amber-500/30">
                        💡 {emailFailNotice.hint}
                      </p>
                    )}
                  </div>
                </div>
                <button onClick={() => setEmailFailNotice(null)} className="text-white/60 hover:text-white p-1 cursor-pointer">✕</button>
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-amber-500/30">
                <a
                  href={emailFailNotice.mailtoUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs shadow transition-all flex items-center space-x-2 cursor-pointer"
                >
                  <Mail className="w-4 h-4" />
                  <span>Launch Mail Client ({emailFailNotice.recipientEmail})</span>
                </a>

                <button
                  type="button"
                  onClick={() => setShowSmtpGuide(true)}
                  className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-xs transition-colors flex items-center space-x-1.5 cursor-pointer"
                >
                  <HelpCircle className="w-4 h-4 text-[#E8B400]" />
                  <span>How to enable background SMTP for jysg25@jesusyouth.org</span>
                </button>
              </div>
            </div>
          )}

          {/* Messages Main Layout: Sidebar List + Selected Detail */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[600px]">
            
            {/* Left Column: Messages Inbox List (5 Cols) */}
            <div className="lg:col-span-5 bg-[#170a1f] border border-white/15 rounded-2xl p-4 space-y-4 shadow-xl flex flex-col h-full">
              
              {/* Search & Filters */}
              <div className="space-y-2.5">
                <div className="relative">
                  <Search className="w-4 h-4 text-white/40 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    placeholder="Search name, email, or message..."
                    value={msgSearchQuery || ''}
                    onChange={(e) => setMsgSearchQuery(e.target.value)}
                    className="w-full bg-black/40 border border-white/15 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-white/40 focus:outline-none focus:border-[#E8752C]"
                  />
                </div>

                {/* Filter Pills */}
                <div className="flex items-center space-x-1 overflow-x-auto pb-1 text-[11px] font-medium">
                  {(['all', 'unread', 'replied', 'archived'] as const).map((filterVal) => (
                    <button
                      key={filterVal}
                      onClick={() => setMsgStatusFilter(filterVal)}
                      className={`px-3 py-1 rounded-lg capitalize transition-colors shrink-0 cursor-pointer ${
                        msgStatusFilter === filterVal
                          ? 'bg-[#E8752C] text-white font-bold shadow'
                          : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      {filterVal}
                    </button>
                  ))}
                </div>
              </div>

              {/* Message Cards List */}
              <div className="space-y-2 overflow-y-auto max-h-[520px] pr-1 flex-1">
                {filteredMessages.length === 0 ? (
                  <div className="p-8 text-center text-white/40 text-xs italic">
                    No contact messages found.
                  </div>
                ) : (
                  filteredMessages.map((msg) => {
                    const isSelected = selectedMessage?.id === msg.id;
                    return (
                      <div
                        key={msg.id}
                        onClick={() => {
                          setSelectedMessage(msg);
                          setReplyInput('');
                          setAiDraftBadge(false);
                        }}
                        className={`p-3.5 rounded-xl border transition-all cursor-pointer space-y-1.5 ${
                          isSelected
                            ? 'bg-[#2242A6]/30 border-[#3B82F6] shadow-lg ring-1 ring-[#3B82F6]'
                            : msg.status === 'unread'
                            ? 'bg-amber-500/10 border-amber-500/30 hover:bg-amber-500/20'
                            : 'bg-white/5 border-white/10 hover:bg-white/10'
                        }`}
                      >
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-white truncate max-w-[160px]">{msg.name}</span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            msg.status === 'unread'
                              ? 'bg-[#E8752C]/20 text-[#E8752C] border border-[#E8752C]/40 animate-pulse'
                              : msg.status === 'replied'
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                              : 'bg-white/10 text-white/50 border border-white/20'
                          }`}>
                            {msg.status}
                          </span>
                        </div>

                        <p className="text-[11px] text-[#E8B400] font-mono truncate">{msg.email}</p>
                        <p className="text-xs text-white/70 line-clamp-2 italic">{msg.message}</p>

                        <div className="flex items-center justify-between pt-1 text-[10px] text-white/40 font-mono">
                          <span>{msg.createdAt ? new Date(msg.createdAt).toLocaleString('en-SG', { dateStyle: 'short', timeStyle: 'short' }) : ''}</span>
                          {msg.replies && msg.replies.length > 0 && (
                            <span className="text-emerald-400/80 font-bold flex items-center space-x-1">
                              <Reply className="w-3 h-3" />
                              <span>{msg.replies.length} {msg.replies.length === 1 ? 'reply' : 'replies'}</span>
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

            </div>

            {/* Right Column: Active Message Details & AI Reply Workspace (7 Cols) */}
            <div className="lg:col-span-7 bg-[#170a1f] border border-white/15 rounded-2xl p-6 shadow-xl space-y-6">
              {selectedMessage ? (
                <div className="space-y-6">
                  
                  {/* Sender & Action Toolbar */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
                    <div>
                      <div className="flex items-center space-x-2">
                        <h3 className="font-poster text-2xl text-white">{selectedMessage.name}</h3>
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase ${
                          selectedMessage.status === 'unread'
                            ? 'bg-[#E8752C]/20 text-[#E8752C] border border-[#E8752C]/40'
                            : selectedMessage.status === 'replied'
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                            : 'bg-white/10 text-white/50'
                        }`}>
                          {selectedMessage.status}
                        </span>
                      </div>

                      <div className="flex items-center space-x-3 text-xs text-white/60 mt-1">
                        <a 
                          href={`mailto:${selectedMessage.email}`} 
                          className="text-[#3B82F6] hover:underline flex items-center space-x-1 font-mono font-bold"
                        >
                          <Mail className="w-3.5 h-3.5" />
                          <span>{selectedMessage.email}</span>
                        </a>
                        <span>•</span>
                        <span>{new Date(selectedMessage.createdAt).toLocaleString()}</span>
                      </div>
                    </div>

                    {/* Quick Status Buttons */}
                    <div className="flex items-center space-x-2 shrink-0">
                      {selectedMessage.status !== 'unread' && (
                        <button
                          onClick={() => handleToggleMessageStatus('unread')}
                          className="px-2.5 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-semibold cursor-pointer border border-amber-500/30"
                        >
                          Mark Unread
                        </button>
                      )}
                      {selectedMessage.status !== 'archived' && (
                        <button
                          onClick={() => handleToggleMessageStatus('archived')}
                          className="px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white/70 text-xs font-semibold cursor-pointer"
                        >
                          Archive
                        </button>
                      )}
                      <button
                        onClick={() => {
                          if (!selectedMessage) return;
                          const msgId = selectedMessage.id;
                          const senderName = selectedMessage.name;
                          setDeleteConfirmModal({
                            title: `Delete Contact Message from "${senderName}"?`,
                            subtitle: `Subject: ${selectedMessage.subject || 'No Subject'}. This contact message will be permanently deleted.`,
                            onConfirm: async () => {
                              try {
                                await deleteContactMessage(msgId);
                                const msgs = await fetchContactMessages();
                                setMessagesList(msgs);
                                setSelectedMessage(msgs.length > 0 ? msgs[0] : null);
                              } catch (err) {
                                console.error('Error deleting message:', err);
                              }
                            }
                          });
                        }}
                        className="p-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/40 text-red-400 cursor-pointer"
                        title="Delete Message"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Inquiry Query Box */}
                  <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-2">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-[#E8B400] flex items-center space-x-1.5">
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>INQUIRY / MESSAGE FROM PARTICIPANT</span>
                    </div>
                    <p className="text-sm text-white/90 leading-relaxed whitespace-pre-wrap font-medium">
                      {selectedMessage.message}
                    </p>
                  </div>

                  {/* Reply Thread History (if any) */}
                  {selectedMessage.replies && selectedMessage.replies.length > 0 && (
                    <div className="space-y-3 pt-2">
                      <h4 className="font-poster text-lg text-white flex items-center space-x-2">
                        <Reply className="w-4 h-4 text-emerald-400" />
                        <span>REPLY HISTORY ({selectedMessage.replies.length})</span>
                      </h4>

                      <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                        {selectedMessage.replies.map((rep) => (
                          <div key={rep.id} className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/30 space-y-2">
                            <div className="flex items-center justify-between text-xs">
                              <div className="flex items-center space-x-2">
                                <span className="font-bold text-emerald-300">{rep.repliedByName || rep.repliedByEmail}</span>
                                {rep.aiGenerated && (
                                  <span className="px-2 py-0.5 rounded-full bg-[#E8752C]/20 border border-[#E8752C]/40 text-[#E8752C] text-[10px] font-bold flex items-center space-x-1">
                                    <Bot className="w-3 h-3" />
                                    <span>AI Drafted</span>
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] text-white/40 font-mono">
                                {new Date(rep.sentAt).toLocaleString()}
                              </span>
                            </div>
                            <div className="text-xs text-white/90 leading-relaxed">
                              <FormattedText content={rep.replyText} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* AI Capabilities Box & Composer */}
                  <div className="cream-card p-5 rounded-2xl border-2 border-[#E8B400]/40 space-y-4 text-[#241226]">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#241226]/10 pb-3">
                      <div>
                        <h4 className="font-poster text-xl text-[#241226] flex items-center space-x-2">
                          <Reply className="w-5 h-5 text-[#2242A6]" />
                          <span>COMPOSE REPLY TO SENDER</span>
                        </h4>
                        <p className="text-[11px] text-[#241226]/70">
                          Directly reply to {selectedMessage.name} ({selectedMessage.email}). You can generate an AI draft using Gemini AI!
                        </p>
                      </div>

                      {/* AI Generator Button */}
                      <button
                        type="button"
                        onClick={handleGenerateAiReply}
                        disabled={isGeneratingAiReply}
                        className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 via-pink-600 to-amber-500 text-white font-bold text-xs shadow-md hover:brightness-110 transition-all flex items-center space-x-2 shrink-0 cursor-pointer disabled:opacity-50"
                      >
                        {isGeneratingAiReply ? (
                          <>
                            <Sparkles className="w-4 h-4 animate-spin" />
                            <span>Gemini Drafting Reply...</span>
                          </>
                        ) : (
                          <>
                            <Bot className="w-4 h-4 text-[#E8B400]" />
                            <span>Generate AI Draft</span>
                          </>
                        )}
                      </button>
                    </div>

                    {aiDraftBadge && (
                      <div className="px-3 py-2 rounded-xl bg-purple-100 border border-purple-300 text-purple-900 text-xs font-semibold flex items-center space-x-2">
                        <Sparkles className="w-4 h-4 text-purple-600 shrink-0" />
                        <span>AI Reply Draft Generated! Review, edit, or customize before sending.</span>
                      </div>
                    )}

                    <div>
                      <RichTextEditor
                        label="Reply Message Body"
                        rows={6}
                        value={replyInput || ''}
                        onChange={(val) => setReplyInput(val)}
                        placeholder="Write your reply or click 'Generate AI Draft'... Use toolbar for bold, colors, lists, etc."
                        helpText="Rich text formatting and HTML styles (bold, colors, links) will be formatted in sent emails."
                      />
                    </div>

                    <div className="pt-3 border-t border-[#241226]/15 space-y-3">
                      <p className="text-[11px] text-[#241226]/75 italic leading-relaxed">
                        Clicking <strong>"Send Direct Email"</strong> dispatches an automated reply directly to <strong>{selectedMessage.email}</strong> from <strong>jysg25@jesusyouth.org</strong> without opening your local mail app.
                      </p>

                      <div className="flex flex-wrap items-center justify-start sm:justify-end gap-2.5 w-full">
                        <button
                          type="button"
                          onClick={() => setShowEmailPreviewModal(true)}
                          disabled={!replyInput.trim()}
                          className="px-3.5 py-2.5 rounded-xl bg-[#2242A6]/10 border border-[#2242A6]/30 hover:bg-[#2242A6]/20 text-[#2242A6] font-bold text-xs cursor-pointer transition-all flex items-center space-x-1.5 disabled:opacity-50"
                          title="Preview formatted HTML email as recipient will see it"
                        >
                          <Eye className="w-4 h-4 text-[#2242A6]" />
                          <span>Preview Email HTML</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleSendReply(false)}
                          disabled={isSendingReply || !replyInput.trim()}
                          className="px-4 py-2.5 rounded-xl bg-white border border-[#241226]/20 hover:bg-gray-100 text-[#241226] font-bold text-xs cursor-pointer transition-all disabled:opacity-50"
                        >
                          Save Record Only
                        </button>

                        <button
                          type="button"
                          onClick={() => handleSendReply(true)}
                          disabled={isSendingReply || !replyInput.trim()}
                          className="px-5 py-2.5 rounded-xl bg-signature-gradient text-white font-bold text-xs shadow-lg hover:brightness-110 cursor-pointer transition-all flex items-center space-x-2 disabled:opacity-50"
                        >
                          {isSendingReply ? (
                            <>
                              <RefreshCw className="w-4 h-4 animate-spin text-white" />
                              <span>Sending Email...</span>
                            </>
                          ) : (
                            <>
                              <Send className="w-4 h-4" />
                              <span>Send Direct Email</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                  </div>

                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center p-12 text-white/50 space-y-3">
                  <Inbox className="w-12 h-12 text-white/30" />
                  <p className="text-sm font-medium">Select a message from the list on the left to view details and reply.</p>
                </div>
              )}
            </div>

          </div>

        </div>
      )}

      {/* TAB 1: REGISTRATIONS VIEW & AUDIT LOGS */}
      {adminTab === 'registrations' && !isIntercessionCoordinatorOnly && !isInvitationAdminOnly && (
        <div className="space-y-6">

          {/* Registration Notification Banner */}
          {regNotification && (
            <div className={`p-4 rounded-2xl border text-xs font-semibold flex items-center justify-between ${
              regNotification.type === 'success' 
                ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300' 
                : 'bg-red-500/20 border-red-500/40 text-red-300'
            }`}>
              <span>{regNotification.message}</span>
              <button onClick={() => setRegNotification(null)} className="text-white/60 hover:text-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Registration Sub-Tab Toggle */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => setSubTabRegistrations('active')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 cursor-pointer ${
                  subTabRegistrations === 'active'
                    ? 'bg-[#E8752C] text-white shadow-lg'
                    : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Users className="w-4 h-4" />
                <span>ACTIVE REGISTRATIONS</span>
                <span className="px-2 py-0.5 rounded-full bg-black/40 text-[10px] text-white font-mono">
                  {filteredRegistrations.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setSubTabRegistrations('logs')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 cursor-pointer ${
                  subTabRegistrations === 'logs'
                    ? 'bg-[#2242A6] text-white shadow-lg'
                    : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'
                }`}
              >
                <History className="w-4 h-4" />
                <span>DELETED & EDITED AUDIT LOGS</span>
                <span className="px-2 py-0.5 rounded-full bg-black/40 text-[10px] text-white font-mono">
                  {auditLogs.length}
                </span>
              </button>
            </div>

            {subTabRegistrations === 'logs' && (
              <button
                type="button"
                onClick={async () => {
                  const freshLogs = await fetchRegistrationAuditLogs();
                  setAuditLogs(freshLogs);
                }}
                className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-white/80 font-semibold text-xs transition-colors flex items-center space-x-1.5 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Refresh Logs</span>
              </button>
            )}
          </div>

          {/* VIEW 1: ACTIVE REGISTRATIONS TABLE */}
          {subTabRegistrations === 'active' && (
            <div className="space-y-6">
              {/* Category Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* 1. Conference Card */}
                <button
                  type="button"
                  onClick={() => setTypeFilter('conference')}
                  className={`p-4 rounded-2xl border text-left transition-all cursor-pointer relative overflow-hidden group ${
                    typeFilter === 'conference'
                      ? 'bg-[#2242A6]/20 border-[#3B82F6] shadow-lg shadow-[#2242A6]/20 ring-1 ring-[#3B82F6]/50'
                      : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold text-[#3B82F6] uppercase tracking-wider flex items-center space-x-1.5">
                      <Calendar className="w-3.5 h-3.5 text-[#3B82F6]" />
                      <span>Conference Registrations</span>
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono ${
                      typeFilter === 'conference' ? 'bg-[#3B82F6] text-white' : 'bg-white/10 text-white/60'
                    }`}>
                      ACTIVE
                    </span>
                  </div>
                  <div className="text-2xl font-black text-white font-mono mb-1">
                    {confMainCount} <span className="text-xs font-normal text-white/50">Adults, Youths & Teens</span>
                  </div>
                  <div className="text-[11px] text-white/80 flex flex-col gap-1 mt-1.5 pt-1.5 border-t border-white/10">
                    <div className="flex items-center space-x-1.5 font-medium">
                      <Users className="w-3.5 h-3.5 text-[#3B82F6] shrink-0" />
                      <span><strong>{confAdults}</strong> Adults &nbsp;•&nbsp; <strong>{confTeens}</strong> Youths & Teens</span>
                    </div>
                    <div className="text-[10.5px] text-amber-300/90 font-medium bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-lg">
                      👶 Sub-categories: <strong>{confPreteens}</strong> Pre-Teens | <strong>{confChildren + confKids}</strong> Children & Kids | <strong>{confToddlers}</strong> Toddlers ({totalConferenceAttendees} Total Delegates)
                    </div>
                  </div>
                </button>

                {/* 2. Musical Card */}
                <button
                  type="button"
                  onClick={() => setTypeFilter('musical')}
                  className={`p-4 rounded-2xl border text-left transition-all cursor-pointer relative overflow-hidden group ${
                    typeFilter === 'musical'
                      ? 'bg-[#C81E6E]/20 border-[#EC4899] shadow-lg shadow-[#C81E6E]/20 ring-1 ring-[#EC4899]/50'
                      : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold text-[#EC4899] uppercase tracking-wider flex items-center space-x-1.5">
                      <Ticket className="w-3.5 h-3.5 text-[#EC4899]" />
                      <span>Musical Concert</span>
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono ${
                      typeFilter === 'musical' ? 'bg-[#EC4899] text-white' : 'bg-white/10 text-white/60'
                    }`}>
                      ACTIVE
                    </span>
                  </div>
                  <div className="text-2xl font-black text-white font-mono mb-1">
                    {totalMusicalCount} <span className="text-xs font-normal text-white/50">entries</span>
                  </div>
                  <div className="text-[11px] text-white/70 flex items-center space-x-1">
                    <Ticket className="w-3 h-3 text-[#EC4899]" />
                    <span><strong>{totalMusicalSeats}</strong> Seats Issued ({totalMusicalAttendees} Attendees)</span>
                  </div>
                </button>

                {/* 3. All Registrations Card */}
                <button
                  type="button"
                  onClick={() => setTypeFilter('all')}
                  className={`p-4 rounded-2xl border text-left transition-all cursor-pointer relative overflow-hidden group ${
                    typeFilter === 'all'
                      ? 'bg-[#E8752C]/20 border-[#E8752C] shadow-lg shadow-[#E8752C]/20 ring-1 ring-[#E8752C]/50'
                      : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold text-[#E8752C] uppercase tracking-wider flex items-center space-x-1.5">
                      <Users className="w-3.5 h-3.5 text-[#E8752C]" />
                      <span>All Registrations</span>
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono ${
                      typeFilter === 'all' ? 'bg-[#E8752C] text-white' : 'bg-white/10 text-white/60'
                    }`}>
                      TOTAL
                    </span>
                  </div>
                  <div className="text-2xl font-black text-white font-mono mb-1">
                    {totalAllCount} <span className="text-xs font-normal text-white/50">entries</span>
                  </div>
                  <div className="text-[11px] text-white/70 flex items-center space-x-1">
                    <CheckCircle className="w-3 h-3 text-[#E8752C]" />
                    <span><strong>{totalPeopleCount}</strong> Combined Attendees</span>
                  </div>
                </button>
              </div>

              {/* Admin Upload Screenshot Banner Notification */}
              {adminUploadNotice && (
                <div className={`p-4 rounded-2xl text-xs flex items-center justify-between border shadow-lg ${
                  adminUploadNotice.type === 'success' 
                    ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-200' 
                    : 'bg-red-500/20 border-red-500/40 text-red-200'
                }`}>
                  <div className="flex items-center space-x-2">
                    {adminUploadNotice.type === 'success' ? (
                      <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
                    )}
                    <span className="font-semibold text-white">{adminUploadNotice.message}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAdminUploadNotice(null)}
                    className="p-1 rounded-lg hover:bg-white/10 text-white/70 hover:text-white cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Controls Bar */}
              <div className="flex flex-col gap-4 bg-[#170a1f]/90 p-4 sm:p-5 rounded-2xl border border-white/15 shadow-2xl">
                {/* ROW 1: Filter Tabs + Full-Width Search Bar */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 w-full">
                  {/* 3 Tab Switching Buttons */}
                  <div className="flex items-center p-1 rounded-xl bg-black/60 border border-white/15 gap-1 shrink-0 overflow-x-auto">
                    {/* Conference Tab */}
                    <button
                      type="button"
                      onClick={() => setTypeFilter('conference')}
                      className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center space-x-2 cursor-pointer whitespace-nowrap ${
                        typeFilter === 'conference'
                          ? 'bg-[#2242A6] text-white shadow-md border border-[#3B82F6]/50'
                          : 'text-white/70 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      <Calendar className="w-3.5 h-3.5 text-[#3B82F6]" />
                      <span>Conference</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                        typeFilter === 'conference' ? 'bg-white/20 text-white' : 'bg-white/10 text-white/60'
                      }`}>
                        {totalConferenceCount}
                      </span>
                    </button>

                    {/* Musical Tab */}
                    <button
                      type="button"
                      onClick={() => setTypeFilter('musical')}
                      className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center space-x-2 cursor-pointer whitespace-nowrap ${
                        typeFilter === 'musical'
                          ? 'bg-[#C81E6E] text-white shadow-md border border-pink-400/50'
                          : 'text-white/70 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      <Ticket className="w-3.5 h-3.5 text-[#EC4899]" />
                      <span>Musical</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                        typeFilter === 'musical' ? 'bg-white/20 text-white' : 'bg-white/10 text-white/60'
                      }`}>
                        {totalMusicalCount}
                      </span>
                    </button>

                    {/* All Tab */}
                    <button
                      type="button"
                      onClick={() => setTypeFilter('all')}
                      className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center space-x-2 cursor-pointer whitespace-nowrap ${
                        typeFilter === 'all'
                          ? 'bg-[#E8752C] text-white shadow-md border border-amber-400/50'
                          : 'text-white/70 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      <Users className="w-3.5 h-3.5 text-[#E8752C]" />
                      <span>All Registrations</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                        typeFilter === 'all' ? 'bg-white/20 text-white' : 'bg-white/10 text-white/60'
                      }`}>
                        {totalAllCount}
                      </span>
                    </button>
                  </div>

                  {/* Search Input Box with Full Breathing Room */}
                  <div className="relative flex-1 w-full min-w-[260px]">
                    <Search className="w-4 h-4 text-white/40 absolute left-3.5 top-3" />
                    <input
                      type="text"
                      placeholder="Search registrant name, email, WhatsApp phone, pass ID..."
                      value={searchQuery || ''}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-black/60 border border-white/20 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-white/40 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition-all shadow-inner"
                    />
                  </div>
                </div>

                {/* ROW 2: Action Buttons Row (Flex-Wrap ensures zero clipping & clean visibility) */}
                <div className="pt-3 border-t border-white/10 flex flex-wrap items-center justify-between gap-2.5 w-full">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={openBatchReminderModal}
                      className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-[#C81E6E] hover:brightness-110 text-white font-bold text-xs shadow-lg transition-all flex items-center justify-center space-x-1.5 cursor-pointer whitespace-nowrap active:scale-95"
                      title="Send personalized payment reminder emails to all attendees missing screenshots"
                    >
                      <Mail className="w-4 h-4 text-amber-200 animate-pulse" />
                      <span>Send Email Reminders ({pendingPaymentScreenshotCount})</span>
                    </button>

                    <button
                      type="button"
                      onClick={exportCSV}
                      className="px-3.5 py-2 rounded-xl bg-signature-gradient text-white font-bold text-xs shadow-lg hover:opacity-90 flex items-center justify-center space-x-1.5 cursor-pointer whitespace-nowrap"
                    >
                      <Download className="w-4 h-4" />
                      <span>EXPORT CSV</span>
                    </button>

                    {isSuperAdmin && (
                      <button
                        type="button"
                        onClick={async () => {
                          setShowBackupSyncModal(true);
                          setIsLoadingBackups(true);
                          const backups = await fetchAuditBackupsFromFirestore();
                          setAuditBackupsList(backups);
                          setIsLoadingBackups(false);
                        }}
                        className="px-3.5 py-2 rounded-xl bg-indigo-900/90 hover:bg-indigo-800 border border-indigo-400/50 text-indigo-200 font-bold text-xs shadow-lg flex items-center justify-center space-x-1.5 cursor-pointer whitespace-nowrap"
                        title="Super Admin: Access Database Backups, Pre-Wipe Snapshots & Disaster Recovery"
                      >
                        <Archive className="w-4 h-4 text-indigo-300" />
                        <span>BACKUP & SYNC</span>
                      </button>
                    )}

                  </div>

                  {isSuperAdmin && (
                    <button
                      type="button"
                      onClick={() => {
                        setGoLiveConfirmText('');
                        setShowGoLiveModal(true);
                      }}
                      className="px-4 py-2 rounded-xl bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 hover:brightness-110 text-white font-black text-xs shadow-xl flex items-center justify-center space-x-1.5 cursor-pointer whitespace-nowrap active:scale-95 border border-red-400/50 shrink-0"
                      title="Super Admin: Clear all test registrations before event Go Live"
                    >
                      <Flame className="w-4 h-4 text-amber-300 animate-bounce" />
                      <span>🚀 GO LIVE (CLEAR ALL)</span>
                    </button>
                  )}
                </div>
              </div>

              {/* SELECTION ACTIONS BANNER */}
              {selectedRegIds.length > 0 && (
                <div className="bg-amber-500/20 border-2 border-amber-400/80 p-4 rounded-2xl flex flex-wrap items-center justify-between gap-3 text-amber-200 shadow-xl backdrop-blur-md">
                  <div className="flex items-center space-x-2 font-bold text-xs">
                    <CheckCircle2 className="w-5 h-5 text-amber-400 shrink-0" />
                    <span>Selected <strong className="text-white font-mono text-sm px-1.5 py-0.5 rounded bg-black/40 border border-amber-400/40">{selectedRegIds.length}</strong> registration order(s) out of {filteredPrimaryRegistrations.length}</span>
                  </div>
                  <div className="flex items-center flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => handleBulkToggleCheckIn(true)}
                      className="px-3.5 py-1.5 rounded-xl bg-rose-500/30 hover:bg-rose-500/40 text-rose-200 border border-rose-500/50 font-bold text-xs cursor-pointer transition-all flex items-center space-x-1.5 shadow-sm active:scale-95"
                      title="Undo check-in for all selected orders"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-rose-300" />
                      <span>Undo Check-In Selected</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleBulkToggleCheckIn(false)}
                      className="px-3.5 py-1.5 rounded-xl bg-emerald-500/30 hover:bg-emerald-500/40 text-emerald-200 border border-emerald-500/50 font-bold text-xs cursor-pointer transition-all flex items-center space-x-1.5 shadow-sm active:scale-95"
                      title="Mark check-in for all selected orders"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
                      <span>Mark Check-In Selected</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedRegIds([])}
                      className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-xs cursor-pointer transition-colors"
                    >
                      Deselect All
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowBulkDeleteModal(true)}
                      className="px-4 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs shadow-lg flex items-center space-x-1.5 cursor-pointer active:scale-95 border border-red-400/50"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>Delete Selected Orders ({selectedRegIds.length})</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Registrations Data Table with Expandable Parent-Child Accordion */}
              <div className="bg-[#170a1f] border border-white/15 rounded-2xl overflow-hidden shadow-2xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-white/80">
                    <thead className="bg-white/10 text-white font-bold uppercase tracking-wider text-[11px] border-b border-white/10">
                      <tr>
                        <th className="p-4 text-center w-14">
                          <div className="flex items-center justify-center space-x-1.5">
                            <input
                              type="checkbox"
                              checked={
                                filteredPrimaryRegistrations.length > 0 &&
                                filteredPrimaryRegistrations.every(r => selectedRegIds.includes(r.id || ''))
                              }
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedRegIds(filteredPrimaryRegistrations.map(r => r.id || ''));
                                } else {
                                  setSelectedRegIds([]);
                                }
                              }}
                              className="w-4 h-4 rounded bg-black/50 border-amber-500/60 text-amber-500 focus:ring-amber-500 cursor-pointer"
                              title="Select / Deselect all visible primary orders"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                if (expandedRegIds.length === filteredPrimaryRegistrations.length) {
                                  setExpandedRegIds([]);
                                } else {
                                  setExpandedRegIds(filteredPrimaryRegistrations.map(r => r.id || ''));
                                }
                              }}
                              className="p-1 rounded hover:bg-white/10 text-amber-400 transition-colors cursor-pointer"
                              title={expandedRegIds.length === filteredPrimaryRegistrations.length ? "Collapse all delegate passes" : "Expand all delegate passes"}
                            >
                              {expandedRegIds.length === filteredPrimaryRegistrations.length && filteredPrimaryRegistrations.length > 0 ? (
                                <ChevronDown className="w-3.5 h-3.5" />
                              ) : (
                                <ChevronRight className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        </th>
                        <th className="p-4">Type</th>
                        <th className="p-4">Primary Registrant (Order Contact)</th>
                        <th className="p-4">Registration Date & Time</th>
                        <th className="p-4">Contact Details</th>
                        <th className="p-4">Group Summary</th>
                        <th className="p-4">Assigned Seats</th>
                        <th className="p-4">Status</th>
                        <th className="p-4 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10 font-medium">
                      {filteredPrimaryRegistrations.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="p-8 text-center text-white/50 italic">
                            No active registrations found matching criteria.
                          </td>
                        </tr>
                      ) : (
                        filteredPrimaryRegistrations.map((reg) => {
                          const regId = reg.id || '';
                          const isExpanded = expandedRegIds.includes(regId);
                          const isSelected = selectedRegIds.includes(regId);
                          const delegates = getDelegatePassesForReg(reg);
                          const groupSummary = getGroupSummary(reg);

                          const personSeed = getPersonDeterministicSeed(reg.email, reg.phone, reg.name);
                          const primaryPassId = reg.passId || getBibleVersePassId(personSeed || reg.id, 0, reg.name);
                          const saintGrp = getParticipantGroupColor(personSeed || reg.id, 0, reg.name, groupSettings, primaryPassId);

                          const isPaid = (reg.paymentStatus === 'paid' || reg.paymentStatus === 'verified' || reg.paymentStatus === 'completed' || (reg.paymentAmount !== undefined && Number(reg.paymentAmount) > 0));

                          return (
                            <React.Fragment key={regId || reg.email}>
                              {/* Primary Registrant Row */}
                              <tr className={`hover:bg-white/5 transition-colors ${
                                isSelected ? 'bg-amber-500/10' : ''
                              } ${isExpanded ? 'bg-black/30' : ''}`}>
                                {/* Select & Expand Toggle */}
                                <td className="p-4 text-center align-top">
                                  <div className="flex items-center justify-center space-x-1.5">
                                    <input
                                      type="checkbox"
                                      checked={isSelected}
                                      onChange={(e) => {
                                        if (e.target.checked) {
                                          setSelectedRegIds(prev => [...prev, regId]);
                                        } else {
                                          setSelectedRegIds(prev => prev.filter(id => id !== regId));
                                        }
                                      }}
                                      className="w-4 h-4 rounded bg-black/50 border-amber-500/60 text-amber-500 focus:ring-amber-500 cursor-pointer"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => toggleRowExpanded(regId)}
                                      className={`p-1.5 rounded-lg transition-all cursor-pointer flex items-center space-x-0.5 ${
                                        isExpanded 
                                          ? 'bg-amber-500/25 text-amber-300 border border-amber-500/40' 
                                          : 'bg-white/5 hover:bg-white/15 text-white/70 hover:text-white'
                                      }`}
                                      title={isExpanded ? "Collapse delegate passes" : `Expand ${delegates.length} delegate pass(es)`}
                                    >
                                      {isExpanded ? (
                                        <ChevronDown className="w-4 h-4" />
                                      ) : (
                                        <ChevronRight className="w-4 h-4" />
                                      )}
                                      {delegates.length > 1 && !isExpanded && (
                                        <span className="text-[9px] font-mono font-bold text-amber-300">
                                          {delegates.length}
                                        </span>
                                      )}
                                    </button>
                                  </div>
                                </td>

                                {/* Type Column */}
                                <td className="p-4 align-top">
                                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                    reg.type === 'conference' 
                                      ? 'bg-[#2242A6]/20 text-[#60A5FA] border border-[#2242A6]/40' 
                                      : 'bg-[#C81E6E]/20 text-[#F472B6] border border-[#C81E6E]/40'
                                  }`}>
                                    {reg.type}
                                  </span>
                                </td>

                                {/* Primary Registrant (Order Contact) */}
                                <td className="p-4 font-bold text-white text-sm align-top space-y-1">
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <span className="text-white text-sm font-black">{reg.name}</span>
                                    <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[9px] font-bold uppercase tracking-wider">
                                      PRIMARY CONTACT
                                    </span>
                                  </div>
                                  <div className="text-[11px] font-mono text-white/50">
                                    [Order ID: {reg.paymentReference || (reg.id ? reg.id.slice(0, 8).toUpperCase() : 'G26-001')}]
                                  </div>
                                  <div className="text-[10px] font-mono text-amber-300/90 flex items-center gap-1 pt-0.5">
                                    <Clock className="w-3 h-3 text-amber-400 shrink-0" />
                                    <span>Registered: {reg.createdAt ? new Date(reg.createdAt).toLocaleString('en-SG', { dateStyle: 'short', timeStyle: 'short' }) : 'N/A'}</span>
                                  </div>
                                </td>

                                {/* Registration Timestamp Column */}
                                <td className="p-4 align-top space-y-1">
                                  <div className="flex items-center space-x-1.5 text-amber-300 font-semibold text-xs whitespace-nowrap">
                                    <Calendar className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                    <span>
                                      {reg.createdAt
                                        ? new Date(reg.createdAt).toLocaleDateString('en-SG', {
                                            day: '2-digit',
                                            month: 'short',
                                            year: 'numeric'
                                          })
                                        : 'N/A'}
                                    </span>
                                  </div>
                                  {reg.createdAt && (
                                    <div className="flex items-center space-x-1.5 text-white/60 text-[11px] font-mono whitespace-nowrap">
                                      <Clock className="w-3 h-3 text-amber-300/70 shrink-0" />
                                      <span>
                                        {new Date(reg.createdAt).toLocaleTimeString('en-SG', {
                                          hour: '2-digit',
                                          minute: '2-digit',
                                          second: '2-digit',
                                          hour12: true
                                        })}
                                      </span>
                                    </div>
                                  )}
                                </td>

                                {/* Contact Details */}
                                <td className="p-4 space-y-1 align-top">
                                  <p className="text-white/90 text-xs font-medium">{reg.email}</p>
                                  <p className="text-white/60 text-[11px] font-mono">{reg.phone}</p>
                                  <div className="pt-0.5">
                                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${saintGrp.badgeBg} ${saintGrp.badgeText} ${saintGrp.borderClass} inline-flex items-center space-x-1 shadow-xs`}>
                                      <span>{saintGrp.emoji}</span>
                                      <span>{saintGrp.name}</span>
                                    </span>
                                  </div>
                                </td>

                                {/* Group Summary Column */}
                                <td className="p-4 align-top">
                                  <div className="inline-flex flex-col items-start px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 shadow-xs">
                                    <span className="font-extrabold text-white text-xs tracking-wide uppercase">
                                      {groupSummary.totalPasses} {groupSummary.totalPasses === 1 ? 'PASS' : 'PASSES'} ({groupSummary.checkedInPasses} Checked In)
                                    </span>
                                    <span className="text-[10px] text-white/60 font-medium whitespace-nowrap">
                                      ({groupSummary.breakdownText})
                                    </span>
                                  </div>
                                </td>

                                {/* Assigned Seats */}
                                <td className="p-4 align-top">
                                  {reg.type === 'musical' || (reg.selectedSeats && reg.selectedSeats.length > 0) ? (
                                    reg.selectedSeats && reg.selectedSeats.length > 0 ? (
                                      <div className="flex flex-wrap gap-1 max-w-[170px]">
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
                                    <span className="text-white/30 text-[11px]">N/A</span>
                                  )}
                                </td>

                                {/* Status */}
                                <td className="p-4 align-top">
                                  {isPaid ? (
                                    <div className="space-y-1">
                                      <span className="text-emerald-400 font-bold text-xs flex items-center space-x-1">
                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                        <span>Confirmed (Paid)</span>
                                      </span>
                                      {reg.paymentAmount !== undefined && (
                                        <span className="text-[10px] font-mono text-emerald-300/80 block">
                                          S${Number(reg.paymentAmount).toFixed(2)}
                                        </span>
                                      )}
                                      {reg.paymentScreenshotUrl && (
                                        <button
                                          type="button"
                                          onClick={() => setSelectedScreenshotModal({ url: reg.paymentScreenshotUrl!, name: reg.name, email: reg.email, phone: reg.phone })}
                                          className="text-[10px] text-emerald-300 hover:text-emerald-100 underline cursor-pointer font-medium block"
                                        >
                                          View Receipt
                                        </button>
                                      )}
                                      {(isSuperAdmin || isFullAdmin) && (
                                        <button
                                          type="button"
                                          onClick={() => setSelectedHitpayInspectorReg(reg)}
                                          className="mt-1 px-1.5 py-0.5 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-[9px] font-mono font-bold flex items-center space-x-1 cursor-pointer transition-all shadow-2xs"
                                          title="HitPay Gateway Inspector"
                                        >
                                          <Shield className="w-2.5 h-2.5 text-amber-400" />
                                          <span>HitPay</span>
                                        </button>
                                      )}
                                    </div>
                                  ) : (
                                    <div className="space-y-1">
                                      <span className="text-amber-400 font-bold text-xs flex items-center space-x-1">
                                        <Clock className="w-3.5 h-3.5" />
                                        <span>Pending Payment</span>
                                      </span>
                                      {reg.paymentScreenshotUrl ? (
                                        <button
                                          type="button"
                                          onClick={() => setSelectedScreenshotModal({ url: reg.paymentScreenshotUrl!, name: reg.name, email: reg.email, phone: reg.phone })}
                                          className="text-[10px] text-emerald-300 hover:text-emerald-100 underline cursor-pointer font-medium block"
                                        >
                                          Review Receipt
                                        </button>
                                      ) : (
                                        <label className="text-[10px] text-teal-300 hover:text-teal-100 underline cursor-pointer font-medium block">
                                          Upload Receipt
                                          <input
                                            type="file"
                                            accept="image/*"
                                            className="hidden"
                                            onChange={(e) => {
                                              const file = e.target.files?.[0];
                                              if (file) handleAdminUploadScreenshot(reg, file);
                                              e.target.value = '';
                                            }}
                                          />
                                        </label>
                                      )}
                                    </div>
                                  )}
                                </td>

                                {/* Actions */}
                                <td className="p-4 text-center align-top whitespace-nowrap">
                                  <div className="flex items-center justify-center space-x-1.5">
                                    {groupSummary.checkedInPasses > 0 ? (
                                      <button
                                        type="button"
                                        onClick={() => handleToggleAllOrderCheckIn(reg, true)}
                                        className="px-2.5 py-1 rounded-lg bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 border border-rose-500/40 text-[11px] font-bold transition-all cursor-pointer shadow-2xs flex items-center space-x-1"
                                        title="Undo check-in for all passes in this registration order"
                                      >
                                        <RotateCcw className="w-3 h-3 text-rose-400" />
                                        <span>Undo Check-In</span>
                                      </button>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => handleToggleAllOrderCheckIn(reg, false)}
                                        className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 border border-emerald-500/40 text-[11px] font-bold transition-all cursor-pointer shadow-2xs flex items-center space-x-1"
                                        title="Mark check-in for all passes in this registration order"
                                      >
                                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                        <span>Check In</span>
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => setAdminPassModalReg(reg)}
                                      className="px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/30 text-[11px] font-bold transition-all cursor-pointer shadow-2xs flex items-center space-x-1"
                                      title="View All Passes & Details"
                                    >
                                      <Eye className="w-3 h-3" />
                                      <span>View Details</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => openSingleEmailModal(reg)}
                                      className="px-2.5 py-1 rounded-lg bg-[#2242A6]/30 hover:bg-[#2242A6]/50 text-blue-200 border border-[#2242A6]/50 text-[11px] font-bold transition-all cursor-pointer shadow-2xs flex items-center space-x-1"
                                      title="Resend / Send Email Reminder"
                                    >
                                      <Mail className="w-3 h-3" />
                                      <span>Resend Email</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingSeatsInput(null);
                                        setEditingRegistration(reg);
                                        scrollToTop();
                                      }}
                                      className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-colors cursor-pointer"
                                      title="Edit registration entry"
                                    >
                                      <Edit className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setDeletingRegistration(reg)}
                                      disabled={isDeletingReg}
                                      className="p-1.5 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 hover:text-red-300 transition-colors cursor-pointer disabled:opacity-50"
                                      title="Delete registration record"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </td>
                              </tr>

                              {/* Nested Delegate List Accordion Sub-Table */}
                              {isExpanded && (
                                <tr className="bg-black/60 border-b-2 border-amber-500/30">
                                  <td colSpan={9} className="p-3 sm:p-5">
                                    <div className="bg-[#0e0414] border border-amber-500/30 rounded-2xl p-4 sm:p-5 space-y-3 shadow-inner">
                                      <div className="flex items-center justify-between">
                                        <h4 className="text-xs font-black uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                                          <Ticket className="w-4 h-4 text-amber-400" />
                                          <span>DELEGATE PASSES ({delegates.length})</span>
                                        </h4>
                                        <button
                                          type="button"
                                          onClick={() => downloadPDFPass(reg)}
                                          className="text-[11px] text-amber-300 hover:text-amber-200 font-bold hover:underline cursor-pointer flex items-center space-x-1"
                                        >
                                          <Download className="w-3.5 h-3.5" />
                                          <span>Download All Passes (PDF)</span>
                                        </button>
                                      </div>

                                      <div className="overflow-x-auto rounded-xl border border-white/10 bg-black/40">
                                        <table className="w-full text-left text-xs text-white/85">
                                          <thead className="bg-white/5 text-white/70 font-bold uppercase tracking-wider text-[10px] border-b border-white/10">
                                            <tr>
                                              <th className="p-3">DELEGATE NAME</th>
                                              <th className="p-3">PASS ID</th>
                                              <th className="p-3">CATEGORY</th>
                                              <th className="p-3">ASSIGNED GROUP / SAINT</th>
                                              <th className="p-3">CHECK-IN STATUS</th>
                                              <th className="p-3 text-right">PASS ACTIONS</th>
                                            </tr>
                                          </thead>
                                          <tbody className="divide-y divide-white/5">
                                            {delegates.map((del, dIdx) => (
                                              <tr key={`${del.passId}-${dIdx}`} className="hover:bg-white/5 transition-colors">
                                                <td className="p-3 font-bold text-white">
                                                  <div className="flex items-center space-x-2">
                                                    <span>{del.name}</span>
                                                    {del.isPrimary && (
                                                      <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[9px] font-extrabold uppercase">
                                                        Primary
                                                      </span>
                                                    )}
                                                  </div>
                                                  {del.seat && (
                                                    <span className="text-[10px] text-white/50 font-mono block">
                                                      {del.seat}
                                                    </span>
                                                  )}
                                                </td>
                                                <td className="p-3 font-mono text-amber-300/90 text-xs font-semibold">
                                                  {del.passId}
                                                </td>
                                                <td className="p-3">
                                                  <span className="px-2 py-0.5 rounded-md bg-white/10 text-white/90 text-[10px] font-medium">
                                                    {del.category}
                                                  </span>
                                                </td>
                                                <td className="p-3">
                                                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${del.saintGroup.badgeBg} ${del.saintGroup.badgeText} ${del.saintGroup.borderClass} inline-flex items-center space-x-1 shadow-xs`}>
                                                    <span>{del.saintGroup.emoji}</span>
                                                    <span>{del.saintGroup.name}</span>
                                                  </span>
                                                </td>
                                                <td className="p-3">
                                                  {del.isCheckedIn ? (
                                                    <div className="flex items-center space-x-1.5 text-emerald-400 font-bold text-xs">
                                                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                                                      <span>Checked In</span>
                                                    </div>
                                                  ) : (
                                                    <div className="flex items-center space-x-1.5 text-white/50 font-medium text-xs">
                                                      <span className="w-2.5 h-2.5 rounded-full border-2 border-white/30" />
                                                      <span>Not Checked In</span>
                                                    </div>
                                                  )}
                                                </td>
                                                <td className="p-3 text-right">
                                                  <div className="flex items-center justify-end space-x-1.5">
                                                    <button
                                                      type="button"
                                                      onClick={() => handlePrintDelegatePass(reg, del)}
                                                      className="p-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 transition-all cursor-pointer shadow-2xs"
                                                      title="Download Individual Pass PDF"
                                                    >
                                                      <Download className="w-3.5 h-3.5" />
                                                    </button>
                                                    <button
                                                      type="button"
                                                      onClick={() => handleToggleDelegateCheckIn(reg, del.passId, del.isCheckedIn, del.name)}
                                                      className={`px-2.5 py-1.5 rounded-lg border text-xs font-bold transition-all cursor-pointer shadow-2xs flex items-center space-x-1.5 ${
                                                        del.isCheckedIn
                                                          ? 'bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border-rose-500/40'
                                                          : 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border-emerald-500/40'
                                                      }`}
                                                      title={del.isCheckedIn ? 'Undo In-Person Check-In' : 'Mark In-Person Check-In'}
                                                    >
                                                      {del.isCheckedIn ? (
                                                        <>
                                                          <RotateCcw className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                                                          <span>Undo Check-In</span>
                                                        </>
                                                      ) : (
                                                        <>
                                                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                                          <span>Check In</span>
                                                        </>
                                                      )}
                                                    </button>
                                                    <button
                                                      type="button"
                                                      onClick={() => {
                                                        if (!del.isCheckedIn) {
                                                          handleToggleDelegateCheckIn(reg, del.passId, false, del.name);
                                                        } else {
                                                          setAdminPassModalReg(reg);
                                                        }
                                                      }}
                                                      className="p-1.5 rounded-lg bg-[#2242A6]/30 hover:bg-[#2242A6]/50 text-blue-200 border border-[#2242A6]/40 transition-all cursor-pointer shadow-2xs"
                                                      title="View Pass & QR Code Details"
                                                    >
                                                      <QrCode className="w-3.5 h-3.5" />
                                                    </button>
                                                  </div>
                                                </td>
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
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
          )}

          {/* VIEW 2: AUDIT LOGS TABLE */}
          {subTabRegistrations === 'logs' && (
            <div className="space-y-6">
              {/* Audit Controls Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/5 p-4 rounded-2xl border border-white/10">
                {/* Search Input */}
                <div className="relative flex-1 max-w-md">
                  <Search className="w-4 h-4 text-white/40 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    placeholder="Search registrant, email, or admin name..."
                    value={auditSearchQuery || ''}
                    onChange={(e) => setAuditSearchQuery(e.target.value)}
                    className="w-full bg-black/40 border border-white/15 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-white/40 focus:outline-none focus:border-[#2242A6]"
                  />
                </div>

                {/* Filter by Action */}
                <div className="flex items-center space-x-3">
                  <label className="text-xs text-white/60 font-medium">Filter Action:</label>
                  <select
                    value={auditActionFilter || 'all'}
                    onChange={(e: any) => setAuditActionFilter(e.target.value)}
                    className="bg-black/40 border border-white/15 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#2242A6]"
                  >
                    <option value="all">All Actions (Edits & Deletions)</option>
                    <option value="delete">Deletions Only</option>
                    <option value="edit">Edits Only</option>
                  </select>
                </div>

                {selectedAuditLogIds.length > 0 && (
                  <button
                    type="button"
                    onClick={handleBulkDeleteAuditLogs}
                    className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-lg transition-all flex items-center space-x-2 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Delete Permanently ({selectedAuditLogIds.length})</span>
                  </button>
                )}
              </div>

              {/* Audit Logs Table */}
              <div className="bg-[#170a1f] border border-white/15 rounded-2xl overflow-hidden shadow-2xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-white/80">
                    <thead className="bg-white/10 text-white font-bold uppercase tracking-wider text-[11px]">
                      <tr>
                        <th className="p-4 text-center">
                          <input
                            type="checkbox"
                            checked={
                              auditLogs.filter(log => {
                                if (auditActionFilter !== 'all' && log.action !== auditActionFilter) return false;
                                if (auditSearchQuery.trim()) {
                                  const q = auditSearchQuery.toLowerCase();
                                  const nameMatch = log.registrantName?.toLowerCase().includes(q);
                                  const emailMatch = log.registrantEmail?.toLowerCase().includes(q);
                                  const adminMatch = log.adminName?.toLowerCase().includes(q) || log.adminEmail?.toLowerCase().includes(q);
                                  return nameMatch || emailMatch || adminMatch;
                                }
                                return true;
                              }).length > 0 &&
                              auditLogs.filter(log => {
                                if (auditActionFilter !== 'all' && log.action !== auditActionFilter) return false;
                                if (auditSearchQuery.trim()) {
                                  const q = auditSearchQuery.toLowerCase();
                                  const nameMatch = log.registrantName?.toLowerCase().includes(q);
                                  const emailMatch = log.registrantEmail?.toLowerCase().includes(q);
                                  const adminMatch = log.adminName?.toLowerCase().includes(q) || log.adminEmail?.toLowerCase().includes(q);
                                  return nameMatch || emailMatch || adminMatch;
                                }
                                return true;
                              }).every(l => l.id && selectedAuditLogIds.includes(l.id))
                            }
                            onChange={(e) => {
                              const visible = auditLogs.filter(log => {
                                if (auditActionFilter !== 'all' && log.action !== auditActionFilter) return false;
                                if (auditSearchQuery.trim()) {
                                  const q = auditSearchQuery.toLowerCase();
                                  const nameMatch = log.registrantName?.toLowerCase().includes(q);
                                  const emailMatch = log.registrantEmail?.toLowerCase().includes(q);
                                  const adminMatch = log.adminName?.toLowerCase().includes(q) || log.adminEmail?.toLowerCase().includes(q);
                                  return nameMatch || emailMatch || adminMatch;
                                }
                                return true;
                              });
                              if (e.target.checked) {
                                setSelectedAuditLogIds(visible.map(l => l.id).filter(Boolean) as string[]);
                              } else {
                                setSelectedAuditLogIds([]);
                              }
                            }}
                            className="w-4 h-4 rounded bg-black/40 border-amber-500/40 text-amber-500 focus:ring-amber-400 cursor-pointer"
                            title="Select All"
                          />
                        </th>
                        <th className="p-4">Timestamp</th>
                        <th className="p-4">Action</th>
                        <th className="p-4">Admin Performer</th>
                        <th className="p-4">Registrant Information</th>
                        <th className="p-4">Event Type</th>
                        <th className="p-4">Details / Changes</th>
                        <th className="p-4 text-center">Full Snapshot</th>
                        <th className="p-4 text-center">Restore Record</th>
                        <th className="p-4 text-center">Remove Log</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10 font-medium">
                      {auditLogs.filter(log => {
                        if (auditActionFilter !== 'all' && log.action !== auditActionFilter) return false;
                        if (auditSearchQuery.trim()) {
                          const q = auditSearchQuery.toLowerCase();
                          const nameMatch = log.registrantName?.toLowerCase().includes(q);
                          const emailMatch = log.registrantEmail?.toLowerCase().includes(q);
                          const adminMatch = log.adminName?.toLowerCase().includes(q) || log.adminEmail?.toLowerCase().includes(q);
                          return nameMatch || emailMatch || adminMatch;
                        }
                        return true;
                      }).length === 0 ? (
                        <tr>
                          <td colSpan={10} className="p-8 text-center text-white/50 italic">
                            No audit log records found.
                          </td>
                        </tr>
                      ) : (
                        auditLogs
                          .filter(log => {
                            if (auditActionFilter !== 'all' && log.action !== auditActionFilter) return false;
                            if (auditSearchQuery.trim()) {
                              const q = auditSearchQuery.toLowerCase();
                              const nameMatch = log.registrantName?.toLowerCase().includes(q);
                              const emailMatch = log.registrantEmail?.toLowerCase().includes(q);
                              const adminMatch = log.adminName?.toLowerCase().includes(q) || log.adminEmail?.toLowerCase().includes(q);
                              return nameMatch || emailMatch || adminMatch;
                            }
                            return true;
                          })
                          .map((log) => (
                            <tr key={log.id} className="hover:bg-white/5 transition-colors">
                              <td className="p-4 text-center whitespace-nowrap">
                                <input
                                  type="checkbox"
                                  checked={log.id ? selectedAuditLogIds.includes(log.id) : false}
                                  onChange={(e) => {
                                    if (!log.id) return;
                                    if (e.target.checked) {
                                      setSelectedAuditLogIds(prev => [...prev, log.id!]);
                                    } else {
                                      setSelectedAuditLogIds(prev => prev.filter(id => id !== log.id));
                                    }
                                  }}
                                  className="w-4 h-4 rounded bg-black/40 border-amber-500/40 text-amber-500 focus:ring-amber-400 cursor-pointer"
                                />
                              </td>
                              <td className="p-4 text-white/60 text-[11px] whitespace-nowrap">
                                <div className="flex items-center space-x-1.5">
                                  <Clock className="w-3.5 h-3.5 text-white/40" />
                                  <span>{new Date(log.timestamp).toLocaleString()}</span>
                                </div>
                              </td>

                              <td className="p-4 whitespace-nowrap">
                                {log.action === 'delete' ? (
                                  <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full bg-red-500/20 text-red-400 border border-red-500/40 font-bold text-[10px] uppercase">
                                    <Trash2 className="w-3 h-3" />
                                    <span>DELETED RECORD</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/40 font-bold text-[10px] uppercase">
                                    <Edit className="w-3 h-3" />
                                    <span>EDITED RECORD</span>
                                  </span>
                                )}
                              </td>

                              <td className="p-4">
                                <p className="font-bold text-white text-xs">{log.adminName}</p>
                                <p className="text-white/50 text-[11px] font-mono">{log.adminEmail}</p>
                              </td>

                              <td className="p-4">
                                <p className="font-bold text-white text-xs">{log.registrantName}</p>
                                <p className="text-white/60 text-[11px]">{log.registrantEmail}</p>
                                {log.registrantPhone && (
                                  <p className="text-white/40 text-[10px] font-mono">{log.registrantPhone}</p>
                                )}
                              </td>

                              <td className="p-4">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                  log.registrationType === 'conference' 
                                    ? 'bg-blue-500/20 text-blue-300' 
                                    : 'bg-pink-500/20 text-pink-300'
                                }`}>
                                  {log.registrationType}
                                </span>
                              </td>

                              <td className="p-4 max-w-xs">
                                {log.action === 'edit' && log.changes ? (
                                  <p className="text-amber-200/90 text-[11px] line-clamp-2">{log.changes}</p>
                                ) : (
                                  <p className="text-red-200/80 text-[11px] italic">
                                    Full entry deleted (Snapshot saved)
                                  </p>
                                )}
                              </td>

                              <td className="p-4 text-center whitespace-nowrap">
                                <button
                                  type="button"
                                  onClick={() => setSelectedAuditLog(log)}
                                  className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-xs transition-colors inline-flex items-center space-x-1.5 cursor-pointer"
                                >
                                  <Eye className="w-3.5 h-3.5 text-[#3B82F6]" />
                                  <span>View Snapshot</span>
                                </button>
                              </td>

                              <td className="p-4 text-center whitespace-nowrap">
                                {(log.snapshot || log.registrationId) ? (
                                  <button
                                    type="button"
                                    disabled={restoringRecordId === (log.registrationId || log.snapshot?.id)}
                                    onClick={() => handleRestoreSingleRegistration(log.snapshot, log.registrationId, log)}
                                    className="px-3 py-1.5 rounded-xl bg-emerald-600/30 hover:bg-emerald-600 border border-emerald-500/40 text-emerald-200 hover:text-white font-semibold text-xs transition-colors inline-flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
                                    title="Restore this deleted record back to active registrations table"
                                  >
                                    <RotateCcw className="w-3.5 h-3.5 text-emerald-400" />
                                    <span>{restoringRecordId === (log.registrationId || log.snapshot?.id) ? 'Restoring...' : 'Restore Record'}</span>
                                  </button>
                                ) : (
                                  <span className="text-white/30 text-[10px] italic">No snapshot</span>
                                )}
                              </td>

                              <td className="p-4 text-center whitespace-nowrap">
                                <button
                                  type="button"
                                  onClick={() => log.id && handleDeleteAuditLog(log.id)}
                                  className="p-1.5 rounded-lg bg-red-500/10 text-red-400/60 hover:text-red-300 hover:bg-red-500/20 transition-colors cursor-pointer"
                                  title="Delete audit log record"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

        </div>
      )}

      {/* INVITATIONS TAB */}
      {adminTab === 'invitations' && (
        <InvitationsAdminPanel 
          currentUserEmail={user?.email || ''} 
          isSuperAdmin={isSuperAdmin} 
          currentUserRoles={currentUserAdminRecord?.invitationRoles || []} 
          siteContent={siteContent} 
          registrations={registrations}
        />
      )}

      {/* GROUPS & PROGRAM ALLOCATION SETTINGS TAB */}
      {adminTab === 'groups' && !isInvitationAdminOnly && (
        <div className="space-y-8 max-w-7xl w-full mx-auto">
          
          {/* Header Banner */}
          <div className="cream-card p-6 sm:p-8 border border-[#E8B400]/40 shadow-2xl space-y-3 relative overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#241226]/10 pb-4">
              <div className="flex items-center space-x-3">
                <div className="p-3.5 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-2xl text-white shadow-lg">
                  <Palette className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="font-poster text-2xl sm:text-3xl text-[#241226]">
                    GROUP ALLOCATION & PROGRAM SETTINGS
                  </h3>
                  <p className="text-xs text-[#241226]/80 font-medium">
                    Configure group capacity limits, family distribution rules, age/gender criteria, and custom group colors/names for participants.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleSaveGroupSettings}
                disabled={isSavingGroupSettings}
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-[#C81E6E] hover:brightness-110 text-white font-extrabold text-xs shadow-xl flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50 transition-all shrink-0"
              >
                {isSavingGroupSettings ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Saving Rules...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>Save Group Settings</span>
                  </>
                )}
              </button>
            </div>

            {/* Notification Banner */}
            {groupSettingsNotice && (
              <div className={`p-4 rounded-2xl border text-sm font-bold flex items-center justify-between shadow-2xl animate-fade-in ${
                groupSettingsNotice.type === 'success'
                  ? 'bg-emerald-950 border-emerald-500 text-emerald-100'
                  : 'bg-red-950 border-red-500 text-red-100'
              }`}>
                <div className="flex items-center space-x-3">
                  {groupSettingsNotice.type === 'success' ? (
                    <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
                  )}
                  <span className="text-sm font-bold tracking-wide">{groupSettingsNotice.message}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setGroupSettingsNotice(null)}
                  className="bg-white/10 hover:bg-white/20 text-white px-3 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer shrink-0"
                >
                  Dismiss
                </button>
              </div>
            )}
          </div>

          {/* Grid Layout: Config Rules & Custom Palette */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            
            {/* Card 1: Rules & Constraints */}
            <div className="bg-[#170a1f] border border-white/15 rounded-3xl p-6 sm:p-8 space-y-6 text-white shadow-2xl">
              <div className="flex items-center space-x-3 border-b border-white/10 pb-4">
                <div className="p-2.5 rounded-xl bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  <Sliders className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-lg text-white font-sans">Group Allocation Controls</h4>
                  <p className="text-xs text-white/60">Define maximum group size and member demographic splitting rules</p>
                </div>
              </div>

              <div className="space-y-5 text-xs">
                {/* Max Members Input */}
                <div className="bg-white/5 p-4 rounded-2xl border border-white/10 space-y-2">
                  <label className="block font-bold text-amber-300 uppercase tracking-wider text-[11px]">
                    Maximum Members Per Group
                  </label>
                  <p className="text-[11px] text-white/60 leading-relaxed">
                    Default is 15 members per group color. Once a group hits this cap, additional participants overflow into the next group palette.
                  </p>
                  <div className="flex items-center space-x-3 pt-1">
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={groupSettings.maxMembersPerGroup || 15}
                      onChange={(e) => setGroupSettings({ ...groupSettings, maxMembersPerGroup: Math.max(1, parseInt(e.target.value) || 15) })}
                      className="w-32 bg-black/50 border border-white/20 rounded-xl px-4 py-2 text-sm text-center font-bold text-white focus:outline-none focus:border-amber-400 font-mono"
                    />
                    <span className="text-white/70 font-semibold">participants / group</span>
                  </div>
                </div>

                {/* Family Member Separation Toggle */}
                <div className="bg-white/5 p-4 rounded-2xl border border-white/10 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="font-bold text-emerald-300 uppercase tracking-wider text-[11px] block">
                        Family & Registration Member Separation
                      </label>
                      <p className="text-[11px] text-white/60 leading-relaxed mt-0.5">
                        Guarantees no two family members in the same registration booking share the same group color.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={groupSettings.separateFamilyMembers !== false}
                      onChange={(e) => setGroupSettings({ ...groupSettings, separateFamilyMembers: e.target.checked })}
                      className="w-5 h-5 rounded border-white/30 text-emerald-500 focus:ring-0 cursor-pointer shrink-0"
                    />
                  </div>
                </div>

                {/* Age Group Criteria */}
                <div className="bg-white/5 p-4 rounded-2xl border border-white/10 space-y-2">
                  <label className="block font-bold text-blue-300 uppercase tracking-wider text-[11px]">
                    Age Demographics Criterion
                  </label>
                  <p className="text-[11px] text-white/60 leading-relaxed">
                    Control how different age brackets (Kids, Teens, Adults) are clustered across conference groups.
                  </p>
                  <select
                    value={groupSettings.ageGroupCriteria || 'mixed'}
                    onChange={(e) => setGroupSettings({ ...groupSettings, ageGroupCriteria: e.target.value as any })}
                    className="w-full bg-black/60 border border-white/20 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-blue-400 font-medium"
                  >
                    <option value="mixed">Mixed Ages (All age demographics combined into co-ed groups)</option>
                    <option value="kids_separate">Kids Separated (Children under 12 grouped together)</option>
                    <option value="teens_separate">Youths & Teens Separated (Ages 13–19 grouped together)</option>
                    <option value="young_adults_separate">Young Adults Separated (Ages 20–30 grouped together)</option>
                  </select>
                </div>

                {/* Gender Criteria */}
                <div className="bg-white/5 p-4 rounded-2xl border border-white/10 space-y-2">
                  <label className="block font-bold text-pink-300 uppercase tracking-wider text-[11px]">
                    Gender Distribution Criterion
                  </label>
                  <p className="text-[11px] text-white/60 leading-relaxed">
                    Set policy for mixing or separating gender groups during program sessions.
                  </p>
                  <select
                    value={groupSettings.genderCriteria || 'mixed'}
                    onChange={(e) => setGroupSettings({ ...groupSettings, genderCriteria: e.target.value as any })}
                    className="w-full bg-black/60 border border-white/20 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-pink-400 font-medium"
                  >
                    <option value="mixed">Balanced Mixed Ratio (50/50 target ratio across groups)</option>
                    <option value="same_gender">Gender-Based Groups (Distinct Brothers / Sisters groups)</option>
                    <option value="balanced">Flexible Balanced Split</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Card 2: Custom Group Names & Palette Editor */}
            <div className="bg-[#170a1f] border border-white/15 rounded-3xl p-6 sm:p-8 space-y-6 text-white shadow-2xl">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-4">
                <div className="flex items-center space-x-3">
                  <div className="p-2.5 rounded-xl bg-purple-500/20 text-purple-300 border border-purple-500/30">
                    <Palette className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-lg text-white font-sans">
                      Group Color Palette & Saint Names ({getAllGroupColors(groupSettings).length} Active Groups)
                    </h4>
                    <p className="text-xs text-white/60">
                      Customize Saint display names or add additional groups below with serial numbers.
                    </p>
                  </div>
                </div>

                {/* Quick Add Buttons (+1 to +10) & Reset */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs font-bold text-purple-300 uppercase tracking-wider flex items-center space-x-1 mr-1">
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add:</span>
                  </span>
                  {[1, 2, 3, 5, 10].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => handleAddGroups(num)}
                      className="px-2.5 py-1 rounded-xl bg-purple-600/40 hover:bg-purple-600 text-white border border-purple-400/50 text-xs font-bold transition-all shadow hover:scale-105 cursor-pointer"
                    >
                      +{num}
                    </button>
                  ))}
                  {getAllGroupColors(groupSettings).length !== DEFAULT_GROUP_COLORS.length && (
                    <button
                      type="button"
                      onClick={handleResetGroups}
                      title="Reset to default 12 groups"
                      className="px-2.5 py-1 rounded-xl bg-red-900/40 hover:bg-red-800 text-red-200 border border-red-500/40 text-xs font-bold flex items-center space-x-1 transition-all cursor-pointer ml-1"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Reset</span>
                    </button>
                  )}
                </div>
              </div>

              <div className="max-h-[500px] overflow-y-auto pr-2 space-y-3 divide-y divide-white/5">
                {getAllGroupColors(groupSettings).map((group, groupIdx) => {
                  const currentCustomName = editingGroupCustomNames[group.id] || '';
                  const serialNum = groupIdx + 1;
                  const activeCount = getAllGroupColors(groupSettings).length;

                  return (
                    <div key={group.id} className="pt-3 first:pt-0 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                      <div className="flex items-center space-x-3">
                        <span className="px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 font-mono text-xs font-bold border border-amber-500/30 shrink-0 shadow-sm">
                          #{serialNum}
                        </span>

                        <span className={`px-3 py-1 rounded-full text-xs font-bold border ${group.badgeBg} ${group.badgeText} ${group.borderClass} flex items-center space-x-1.5 shrink-0 shadow-sm`}>
                          <span>{group.emoji}</span>
                          <span>{currentCustomName || group.name}</span>
                        </span>
                      </div>

                      <div className="w-full sm:w-auto flex items-center space-x-2 flex-1 max-w-sm">
                        <input
                          type="text"
                          placeholder={`Group #${serialNum} Name (${group.name})`}
                          value={currentCustomName}
                          onChange={(e) => {
                            const val = e.target.value;
                            setEditingGroupCustomNames(prev => ({
                              ...prev,
                              [group.id]: val
                            }));
                          }}
                          className="w-full bg-black/50 border border-white/20 rounded-xl px-3 py-1.5 text-xs text-white placeholder-white/40 focus:outline-none focus:border-purple-400 font-sans"
                        />
                        {activeCount > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveGroup(group.id)}
                            title={`Remove Group #${serialNum}`}
                            className="p-1.5 rounded-lg bg-red-500/20 text-red-300 hover:bg-red-600 hover:text-white transition-colors shrink-0 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>

          {/* Participant Group Allocation Breakdown */}
          <div className="bg-[#170a1f] border border-white/15 rounded-3xl p-6 sm:p-8 space-y-6 text-white shadow-2xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
              <div>
                <h4 className="font-bold text-xl text-white font-sans">
                  PARTICIPANT GROUP ROSTER ({registrations.length} Attendees across {getAllGroupColors(groupSettings).length} Groups)
                </h4>
                <p className="text-xs text-white/60">
                  Real-time view of group assignments calculated deterministically based on active settings.
                </p>
              </div>

              {/* Group Distribution Stat Pills */}
              <div className="flex flex-wrap gap-1.5 max-w-2xl">
                {getAllGroupColors(groupSettings).map((group, gIdx) => {
                  const assignedCount = registrations.filter((r) => {
                    const info = getParticipantGroupColor(r.id, 0, r.name, groupSettings, r.id);
                    return info.id === group.id;
                  }).length;

                  if (assignedCount === 0) return null;

                  return (
                    <span key={group.id} className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${group.badgeBg} ${group.badgeText} ${group.borderClass} flex items-center space-x-1 shadow-sm`}>
                      <span className="font-mono text-[10px] opacity-75">#{gIdx + 1}</span>
                      <span>{group.emoji}</span>
                      <span>{editingGroupCustomNames[group.id] || group.name}:</span>
                      <span className="font-mono">{assignedCount}</span>
                    </span>
                  );
                })}
              </div>
            </div>

            {/* Table of Participant Group Assignments */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-white/80">
                <thead className="bg-white/10 text-white font-bold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="p-3.5">#</th>
                    <th className="p-3.5">Participant Name</th>
                    <th className="p-3.5">Assigned Group Color</th>
                    <th className="p-3.5">Bible Verse Pass ID</th>
                    <th className="p-3.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {registrations.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-6 text-center text-white/50 italic">
                        No registered participants available yet.
                      </td>
                    </tr>
                  ) : (
                    registrations.slice(0, 50).map((reg, idx) => {
                      const groupInfo = getParticipantGroupColor(reg.id, 0, reg.name, groupSettings, reg.id);
                      const allActive = getAllGroupColors(groupSettings);
                      const groupIndex = allActive.findIndex(g => g.id === groupInfo.id);
                      const serialNum = groupIndex >= 0 ? groupIndex + 1 : 1;
                      const personSeed = getPersonDeterministicSeed(reg.email, reg.phone, reg.name);
                      const versePassId = reg.passId || getBibleVersePassId(personSeed || reg.id, 0, reg.name);

                      return (
                        <tr key={reg.id || idx} className="hover:bg-white/5 transition-colors">
                          <td className="p-3.5 font-mono text-white/40">{idx + 1}</td>
                          <td className="p-3.5 font-bold text-white text-sm">
                            {reg.name}
                          </td>
                          <td className="p-3.5">
                            <span className={`px-3 py-1 rounded-full text-xs font-bold border ${groupInfo.badgeBg} ${groupInfo.badgeText} ${groupInfo.borderClass} inline-flex items-center space-x-1.5 shadow-sm`}>
                              <span className="font-mono text-[10px] opacity-75">#{serialNum}</span>
                              <span>{groupInfo.emoji}</span>
                              <span>{groupInfo.name}</span>
                            </span>
                          </td>
                          <td className="p-3.5 font-mono text-amber-300 font-bold tracking-wide">
                            {versePassId}
                          </td>
                          <td className="p-3.5">
                            {reg.checkedIn ? (
                              <div className="flex items-center space-x-2">
                                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold uppercase">
                                  Checked In
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleToggleAllOrderCheckIn(reg, true)}
                                  className="px-2 py-0.5 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-[10px] font-bold transition-all cursor-pointer flex items-center space-x-1"
                                  title="Undo Check-In for this participant"
                                >
                                  <RotateCcw className="w-2.5 h-2.5 text-rose-400" />
                                  <span>Undo</span>
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center space-x-2">
                                <span className="px-2.5 py-0.5 rounded-full bg-white/10 text-white/60 border border-white/10 text-[10px] font-bold uppercase">
                                  Registered
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleToggleAllOrderCheckIn(reg, false)}
                                  className="px-2 py-0.5 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold transition-all cursor-pointer flex items-center space-x-1"
                                  title="Check In this participant"
                                >
                                  <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" />
                                  <span>Check In</span>
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
              {registrations.length > 50 && (
                <div className="p-3 text-center text-xs text-white/50 italic bg-white/5">
                  Showing first 50 of {registrations.length} participants. All participants are assigned group color badges.
                </div>
              )}
            </div>

          </div>

        </div>
      )}

      {/* TAB 2: ADMIN ALLOW-LIST MANAGEMENT */}
      {adminTab === 'admins' && isSuperAdmin && (
        <div className="space-y-8 max-w-4xl">
          
          {/* Action Notification Banner */}
          {adminNotification && (
            <div className={`p-4 rounded-2xl border text-xs font-semibold flex items-center justify-between ${
              adminNotification.type === 'success'
                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                : 'bg-red-500/15 border-red-500/40 text-red-300'
            }`}>
              <div className="flex items-center space-x-2">
                {adminNotification.type === 'success' ? (
                  <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                )}
                <span>{adminNotification.message}</span>
              </div>
              <button
                onClick={() => setAdminNotification(null)}
                className="text-white/60 hover:text-white ml-2 text-xs font-bold cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* System Documentation & Operational Guides (Super Admin Only) */}
          <div className="bg-[#170a1f] border border-cyan-500/40 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <Shield className="w-5 h-5 text-cyan-400" />
                  <h3 className="font-poster text-xl text-white tracking-wide">
                    SUPER ADMIN TECHNICAL DOCS & USER MANUAL
                  </h3>
                  <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/20 border border-cyan-400/40 text-cyan-300 text-[10px] font-bold font-mono uppercase">
                    Restricted Access
                  </span>
                </div>
                <p className="text-xs text-white/70">
                  Engineering architecture blueprints, Express/Firestore schemas, and step-by-step volunteer admin guides. Available for view or download as Markdown (.md) or Microsoft Word (.docx).
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowTechDocModal(true)}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-500/60 text-slate-100 font-bold text-xs shadow-lg flex items-center space-x-2 cursor-pointer transition-all active:scale-95"
                  title="Super Admin Technical Architecture & Systems Documentation"
                >
                  <BookOpen className="w-4 h-4 text-cyan-400" />
                  <span>TECH DOCS</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowUserManualModal(true)}
                  className="px-4 py-2.5 rounded-xl bg-emerald-900/90 hover:bg-emerald-800 border border-emerald-400/60 text-emerald-100 font-bold text-xs shadow-lg flex items-center space-x-2 cursor-pointer transition-all active:scale-95"
                  title="Admin User Interface Functions & Role Guide"
                >
                  <HelpCircle className="w-4 h-4 text-emerald-300" />
                  <span>USER MANUAL</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-white/80">
              <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-700/50 space-y-1">
                <div className="font-bold text-cyan-300 flex items-center space-x-1.5">
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>Technical & Systems Architecture</span>
                </div>
                <p className="text-[11px] text-white/60">
                  Full stack specs, Node.js Express server bundle, Firestore schema definitions, PDF generator logic, and disaster recovery procedures.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-800/50 space-y-1">
                <div className="font-bold text-emerald-300 flex items-center space-x-1.5">
                  <HelpCircle className="w-3.5 h-3.5" />
                  <span>Admin User Manual & Role Operations</span>
                </div>
                <p className="text-[11px] text-white/60">
                  Step-by-step procedures for PayNow verification, batch email dispatching, venue camera QR check-in, and RBAC permissions.
                </p>
              </div>
            </div>
          </div>

          {/* Add New Admin Form */}
          <div className="cream-card p-6 border border-[#E8B400]/40 shadow-xl space-y-4">
            <h3 className="font-poster text-2xl text-[#241226]">ADD / APPROVE ORGANIZER ACCESS</h3>
            <p className="text-xs text-[#241226]/80">
              Grant immediate access to an organizer's Google email address.
            </p>

            <form onSubmit={handleAddAdmin} className="flex flex-col sm:flex-row gap-3">
              <input
                type="email"
                required
                value={newAdminEmail || ''}
                onChange={(e) => setNewAdminEmail(e.target.value)}
                placeholder="organizer@gmail.com"
                className="flex-1 px-4 py-2.5 rounded-xl bg-white border border-[#241226]/20 text-xs text-[#241226] focus:outline-none focus:ring-2 focus:ring-[#E8752C]"
              />
              <button
                type="submit"
                className="px-6 py-2.5 rounded-xl bg-signature-gradient text-white font-bold text-xs shadow-md hover:opacity-95 cursor-pointer"
              >
                Approve Email Access
              </button>
            </form>
          </div>

          {/* Pending Requests Highlight */}
          {adminsList.filter(a => a.status === 'pending').length > 0 && (
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-white space-y-3">
              <div className="flex items-center space-x-2 text-amber-400 font-bold text-sm">
                <AlertTriangle className="w-5 h-5 text-amber-400" />
                <span>Pending Access Requests ({adminsList.filter(a => a.status === 'pending').length})</span>
              </div>
              <p className="text-xs text-white/80">
                The following users signed in and requested admin approval. Click "Approve Access" to grant them access.
              </p>
            </div>
          )}

          {/* Admins Table */}
          <div className="bg-[#170a1f] border border-white/15 rounded-2xl overflow-hidden shadow-2xl">
            <table className="w-full text-left text-xs text-white/80">
              <thead className="bg-white/10 text-white font-bold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="p-4">Email & Applicant Details</th>
                  <th className="p-4">Requested / Approved</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {adminsList.map((a) => {
                  const superEmails = [SUPER_ADMIN_EMAIL.toLowerCase(), 'sijumonabraham@gmail.com'];
                  const isPermanentSuper = superEmails.includes(a.email.toLowerCase());
                  const isEditingThis = editingAdminEmail === a.email;

                  return (
                    <tr key={a.email} className="hover:bg-white/5 transition-colors">
                      <td className="p-4">
                        {isEditingThis ? (
                          <div className="flex items-center space-x-2 my-1">
                            <input
                              type="email"
                              value={newEmailValue || ''}
                              onChange={(e) => setNewEmailValue(e.target.value)}
                              className="px-3 py-1.5 text-xs rounded-lg bg-white text-[#241226] font-mono border-2 border-[#E8752C] focus:outline-none focus:ring-2 focus:ring-[#E8B400] w-64"
                              placeholder="new-email@gmail.com"
                              autoFocus
                            />
                            <button
                              onClick={() => handleSaveEditedEmail(a.email)}
                              className="px-3 py-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg shadow cursor-pointer transition-colors flex items-center space-x-1"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Save</span>
                            </button>
                            <button
                              onClick={() => setEditingAdminEmail(null)}
                              className="px-3 py-1.5 text-xs font-bold bg-gray-600 hover:bg-gray-500 text-white rounded-lg cursor-pointer transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="font-mono font-bold text-white text-sm flex items-center space-x-2 flex-wrap gap-y-1">
                            <span>{a.email}</span>
                            {isPermanentSuper ? (
                              <span className="text-[10px] font-bold text-[#E8B400] bg-[#E8B400]/20 px-2 py-0.5 rounded border border-[#E8B400]/30 font-sans">
                                SUPER ADMIN
                              </span>
                            ) : a.role === 'full_admin' ? (
                              <span className="text-[10px] font-bold text-purple-300 bg-purple-500/20 px-2 py-0.5 rounded border border-purple-500/30 font-sans">
                                FULL ADMIN
                              </span>
                            ) : a.role === 'admin' ? (
                              <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded border border-emerald-500/30 font-sans">
                                ADMIN (MAIN)
                              </span>
                            ) : a.role === 'support_admin' ? (
                              <span className="text-[10px] font-bold text-[#E8752C] bg-[#E8752C]/20 px-2 py-0.5 rounded border border-[#E8752C]/30 font-sans">
                                SUPPORT & INBOX ADMIN
                              </span>
                            ) : a.role === 'content_admin' ? (
                              <span className="text-[10px] font-bold text-amber-300 bg-amber-500/20 px-2 py-0.5 rounded border border-amber-500/30 font-sans">
                                CONTENT MANAGER
                              </span>
                            ) : a.role === 'ticket_admin' ? (
                              <span className="text-[10px] font-bold text-pink-300 bg-pink-500/20 px-2 py-0.5 rounded border border-pink-500/30 font-sans">
                                TICKET ADMIN
                              </span>
                            ) : a.role === 'intercession_coordinator' ? (
                              <span className="text-[10px] font-bold text-purple-300 bg-purple-600/30 px-2 py-0.5 rounded border border-purple-400/50 font-sans flex items-center space-x-1">
                                <HeartHandshake className="w-3 h-3 text-purple-300 inline" />
                                <span>INTERCESSION COORDINATOR</span>
                              </span>
                            ) : a.role === 'invitation_admin' ? (
                              <span className="text-[10px] font-bold text-amber-300 bg-amber-500/20 px-2 py-0.5 rounded border border-amber-500/30 font-sans uppercase">
                                {formatInvitationRoleName(a.invitationRoles)}
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold text-purple-300 bg-purple-500/20 px-2 py-0.5 rounded border border-purple-500/30 font-sans">
                                FULL ADMIN
                              </span>
                            )}
                          </div>
                        )}
                        {a.displayName && (
                          <div className="text-xs text-[#E8B400] font-semibold mt-0.5">{a.displayName}</div>
                        )}
                        {a.requestedNote && (
                          <div className="text-[11px] text-white/70 italic mt-0.5">Note: "{a.requestedNote}"</div>
                        )}
                      </td>
                      <td className="p-4 text-white/60 text-[11px]">
                        {a.requestedAt ? new Date(a.requestedAt).toLocaleDateString() : a.dateApproved || 'System'}
                      </td>
                      <td className="p-4">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
                          a.status === 'approved' 
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : a.status === 'pending'
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                            : 'bg-red-500/20 text-red-400 border border-red-500/30'
                        }`}>
                          {a.status}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        {!isPermanentSuper && (
                          <div className="inline-flex items-center justify-end space-x-1.5">
                            {a.status !== 'approved' && (
                              <button
                                onClick={() => handleApproveAdmin(a)}
                                className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] shadow cursor-pointer transition-colors inline-flex items-center space-x-1"
                                title="Approve Access & Select Role"
                              >
                                <UserCheck className="w-3.5 h-3.5" />
                                <span>Approve</span>
                              </button>
                            )}
                            {a.status === 'approved' && (
                              <button
                                onClick={() => openRoleModal(a)}
                                className="px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[11px] shadow cursor-pointer transition-colors inline-flex items-center space-x-1"
                                title="Change Assigned Role"
                              >
                                <Shield className="w-3.5 h-3.5" />
                                <span>Role</span>
                              </button>
                            )}
                            {a.status !== 'revoked' && (
                              <button
                                onClick={() => handleRevokeAdmin(a.email)}
                                className="px-2.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold text-[11px] shadow cursor-pointer transition-colors inline-flex items-center space-x-1"
                                title="Revoke Access"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                                <span>Revoke</span>
                              </button>
                            )}
                            {!isEditingThis && (
                              <button
                                onClick={() => startEditingEmail(a.email)}
                                className="px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-[11px] shadow cursor-pointer transition-colors inline-flex items-center space-x-1"
                                title="Edit Email Address"
                              >
                                <Edit className="w-3.5 h-3.5" />
                                <span>Edit</span>
                              </button>
                            )}
                            <button
                              onClick={() => handleDeleteAdminRecord(a.email)}
                              className="px-2.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold text-[11px] shadow cursor-pointer transition-colors inline-flex items-center space-x-1"
                              title="Delete Record Permanently"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Delete</span>
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Delete Record Confirmation Modal */}
          {deleteConfirmTarget && (
            <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-[#1C0D1E] border-2 border-red-500/50 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 text-white relative">
                <button
                  type="button"
                  onClick={() => setDeleteConfirmTarget(null)}
                  className="absolute top-4 right-4 p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-colors cursor-pointer"
                  title="Close"
                  aria-label="Close modal"
                >
                  <X className="w-5 h-5" />
                </button>
                <div className="flex items-center space-x-3 text-red-400">
                  <div className="p-3 bg-red-500/20 border border-red-500/40 rounded-full">
                    <AlertTriangle className="w-6 h-6 text-red-500" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-white">Delete Admin Record?</h3>
                    <p className="text-xs text-red-300 font-medium">Permanent Action</p>
                  </div>
                </div>

                <div className="bg-white/5 border border-white/10 p-4 rounded-xl space-y-2">
                  <p className="text-xs text-white/80 leading-relaxed">
                    Are you sure you want to permanently delete the record for:
                  </p>
                  <p className="font-mono font-bold text-sm text-[#E8B400] break-all bg-black/40 px-3 py-2 rounded-lg border border-white/10">
                    {deleteConfirmTarget}
                  </p>
                  <p className="text-[11px] text-red-300/90 italic pt-1">
                    This will permanently remove this address from the allow-list and pending requests. This cannot be undone.
                  </p>
                </div>

                <div className="flex items-center justify-end space-x-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setDeleteConfirmTarget(null)}
                    disabled={isDeletingRecord}
                    className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold cursor-pointer transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={confirmDeleteAdminRecord}
                    disabled={isDeletingRecord}
                    className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold shadow-lg cursor-pointer transition-colors inline-flex items-center space-x-2 disabled:opacity-50"
                  >
                    {isDeletingRecord ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin text-white" />
                        <span>Deleting...</span>
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-4 h-4" />
                        <span>Delete Permanently</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      )}

      {/* TAB 3: CONTENT MANAGER */}
      {adminTab === 'content' && !isIntercessionCoordinatorOnly && !isInvitationAdminOnly && (
        <div className="space-y-8 max-w-7xl w-full mx-auto">
          
          {/* PORTAL AUTHENTICATION & LOGIN METHOD TOGGLES */}
          <PortalAuthSettingsCard
            siteContent={siteContent}
            onSave={async (updatedData) => {
              setSavingSiteContent(true);
              try {
                await saveSiteContent({ ...(siteContent || INITIAL_SITE_CONTENT), ...updatedData });
                const updated = await fetchSiteContent();
                if (updated) setSiteContent(updated);
              } finally {
                setSavingSiteContent(false);
              }
            }}
            isSaving={savingSiteContent}
          />

          {/* Jubilee Memories Editor */}
          <div className="cream-card p-6 sm:p-8 space-y-6 border border-[#E8B400]/30 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#241226]/10 pb-4">
              <div>
                <h3 className="font-poster text-2xl sm:text-3xl text-[#241226]">
                  EDIT JUBILEE MEMORIES TIMELINE <span className="text-sm font-sans font-bold text-[#C81E6E]">({timelineEvents.length} Entries)</span>
                </h3>
                <p className="text-xs text-[#241226]/70 mt-0.5">
                  Manage all 25-year history timeline entries rendered on the Jubilee Memories page.
                </p>
              </div>

              <button
                onClick={() => {
                  setEditingTimeline({ year: '2026', title: '', description: '', imageUrl: '', order: timelineEvents.length + 1, isPublic: true });
                  setEditingPhotos([]);
                  setNewPhotoUrlInput('');
                  setTimeout(() => {
                    document.getElementById('timeline-edit-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }, 50);
                }}
                className="px-4 py-2.5 rounded-xl bg-signature-gradient text-white font-bold text-xs flex items-center justify-center space-x-2 shadow-md hover:brightness-110 transition-all cursor-pointer shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Add Timeline Item</span>
              </button>
            </div>

            {/* Editing / Adding Timeline Item Form */}
            {editingTimeline && (
              <div id="timeline-edit-form" className="p-5 sm:p-6 rounded-2xl bg-amber-50 border-2 border-[#E8752C] space-y-4 text-xs text-[#241226] shadow-xl scroll-mt-28 ring-2 ring-[#E8752C]/40">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#241226]/10 pb-3 gap-2">
                  <div className="flex items-center space-x-3">
                    <div className="p-2.5 rounded-xl bg-[#E8752C] text-white shadow">
                      <Edit className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm uppercase tracking-wide text-[#2242A6] flex items-center space-x-2">
                        <span>{editingTimeline.id ? 'Editing Timeline Record' : 'New Timeline Entry'}</span>
                      </h4>
                      {editingTimeline.id && (
                        <p className="text-xs font-bold text-[#E8752C] flex items-center space-x-1 mt-0.5">
                          <span>Currently Editing Record:</span>
                          <span className="underline font-mono">"{editingTimeline.title || 'Untitled'}"</span>
                          {editingTimeline.year && <span>({editingTimeline.year})</span>}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {editingTimeline.id && (
                      <span className="px-3 py-1 rounded-full bg-[#E8752C] text-white font-extrabold text-[10px] uppercase tracking-wider shadow">
                        ✏️ EDIT RECORD MODE
                      </span>
                    )}
                    <span className="text-[10px] text-[#241226]/60 font-mono">ID: {editingTimeline.id || 'New Record'}</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
                  <div>
                    <label className="block font-bold mb-1 uppercase text-[11px] text-[#241226]">Year *</label>
                    <input
                      type="text"
                      value={editingTimeline.year || ''}
                      onChange={e => setEditingTimeline({ ...editingTimeline, year: e.target.value })}
                      placeholder="e.g. 2001"
                      className="w-full p-2.5 rounded-xl bg-white border border-[#241226]/20 font-bold focus:outline-none focus:ring-2 focus:ring-[#2242A6]"
                    />
                  </div>

                  <div>
                    <label className="block font-bold mb-1 uppercase text-[11px] text-[#241226]">Sequence / Order #</label>
                    <input
                      type="number"
                      min="1"
                      value={editingTimeline.order || 1}
                      onChange={e => setEditingTimeline({ ...editingTimeline, order: parseInt(e.target.value, 10) || 1 })}
                      placeholder="1"
                      className="w-full p-2.5 rounded-xl bg-white border border-[#241226]/20 font-bold focus:outline-none focus:ring-2 focus:ring-[#2242A6]"
                    />
                  </div>

                  <div className="sm:col-span-3">
                    <label className="block font-bold mb-1 uppercase text-[11px] text-[#241226]">Title *</label>
                    <input
                      type="text"
                      value={editingTimeline.title || ''}
                      onChange={e => setEditingTimeline({ ...editingTimeline, title: e.target.value })}
                      placeholder="e.g. The Seed is Sown in Singapore"
                      className="w-full p-2.5 rounded-xl bg-white border border-[#241226]/20 font-semibold focus:outline-none focus:ring-2 focus:ring-[#2242A6]"
                    />
                  </div>
                </div>

                <div>
                  <RichTextEditor
                    label="Description & Event Details"
                    rows={4}
                    value={editingTimeline.description || ''}
                    onChange={(val) => setEditingTimeline({ ...editingTimeline, description: val })}
                    placeholder="Describe the milestone, retreat, or event... Use formatting toolbar above for bold, colors, headers, and paragraphs."
                    helpText="Customize font styles, colors, lists, and paragraph breaks. Click 'Live Preview' to see how it looks on the Jubilee Page."
                  />
                </div>

                {/* Public Visibility Toggle Switch */}
                <div 
                  onClick={() => setEditingTimeline({ ...editingTimeline, isPublic: editingTimeline.isPublic === false })}
                  className="flex items-center justify-between bg-white/90 p-3.5 rounded-xl border border-[#241226]/15 shadow-xs cursor-pointer hover:bg-white transition-all"
                >
                  <div className="flex items-center space-x-2.5">
                    {editingTimeline.isPublic !== false ? (
                      <Eye className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <EyeOff className="w-4 h-4 text-amber-700 shrink-0" />
                    )}
                    <div>
                      <span className="text-xs font-bold text-[#241226] block">Publicly Visible on Jubilee Memories Page</span>
                      <span className="text-[11px] text-[#241226]/65 block">
                        {editingTimeline.isPublic !== false 
                          ? 'Visible to all visitors on the Jubilee timeline.' 
                          : 'Hidden from public view on the website.'}
                      </span>
                    </div>
                  </div>

                  {/* Toggle Switch Button */}
                  <button
                    type="button"
                    role="switch"
                    aria-checked={editingTimeline.isPublic !== false}
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingTimeline({ ...editingTimeline, isPublic: editingTimeline.isPublic === false });
                    }}
                    className={`w-11 h-6 rounded-full p-0.5 transition-colors duration-200 ease-in-out cursor-pointer relative shrink-0 ${
                      editingTimeline.isPublic !== false ? 'bg-emerald-600' : 'bg-slate-300'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform duration-200 ease-in-out ${
                      editingTimeline.isPublic !== false ? 'translate-x-5' : 'translate-x-0'
                    }`} />
                  </button>
                </div>

                {/* Multiple Photos / Images Manager */}
                <div className="space-y-3 bg-white/75 p-4 rounded-xl border border-[#241226]/15">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <label className="block font-bold uppercase text-[11px] text-[#241226] flex items-center space-x-1.5">
                        <ImageIcon className="w-4 h-4 text-[#E8752C]" />
                        <span>Timeline Photos ({editingPhotos.length})</span>
                      </label>
                      <p className="text-[11px] text-[#241226]/70">
                        Upload multiple photos or paste image URLs. Multiple photos will automatically present with a sliding effect on the Jubilee page.
                      </p>
                    </div>

                    <label className="px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-xs flex items-center justify-center space-x-2 shadow cursor-pointer transition-colors shrink-0">
                      <Upload className="w-4 h-4" />
                      <span>Upload Photos</span>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={async (e) => {
                          const files: File[] = Array.from(e.target.files || []);
                          if (files.length === 0) return;
                          for (const file of files) {
                            try {
                              const compressedDataUrl = await compressAndResizeImage(file, 1200, 1200, 0.75);
                              if (compressedDataUrl) {
                                setEditingPhotos(prev => [...prev, compressedDataUrl]);
                              }
                            } catch (err) {
                              console.error('Image compression error, fallback to raw:', err);
                              const reader = new FileReader();
                              reader.onload = (ev) => {
                                const rawUrl = ev.target?.result as string;
                                if (rawUrl) setEditingPhotos(prev => [...prev, rawUrl]);
                              };
                              reader.readAsDataURL(file);
                            }
                          }
                          e.target.value = '';
                        }}
                      />
                    </label>
                  </div>

                  {/* URL Input Row */}
                  <div className="flex items-center space-x-2 pt-1">
                    <input
                      type="url"
                      value={newPhotoUrlInput || ''}
                      onChange={e => setNewPhotoUrlInput(e.target.value)}
                      placeholder="Or paste photo URL (https://images.unsplash.com/...)"
                      className="flex-1 p-2.5 rounded-xl bg-white border border-[#241226]/20 font-mono text-[11px] focus:outline-none focus:ring-2 focus:ring-[#2242A6]"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          if (newPhotoUrlInput.trim()) {
                            setEditingPhotos(prev => [...prev, newPhotoUrlInput.trim()]);
                            setNewPhotoUrlInput('');
                          }
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (newPhotoUrlInput.trim()) {
                          setEditingPhotos(prev => [...prev, newPhotoUrlInput.trim()]);
                          setNewPhotoUrlInput('');
                        }
                      }}
                      className="px-3.5 py-2.5 rounded-xl bg-[#2242A6] hover:bg-[#1a3384] text-white font-bold text-xs cursor-pointer transition-colors shrink-0 flex items-center space-x-1"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Add Link</span>
                    </button>
                  </div>

                  {/* Gallery Thumbnails List */}
                  {editingPhotos.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                      {editingPhotos.map((photoUrl, pIdx) => (
                        <div key={pIdx} className="relative group/thumb rounded-xl overflow-hidden border-2 border-[#241226]/20 bg-black/10 aspect-video shadow-sm">
                          <img src={photoUrl} alt={`Photo ${pIdx + 1}`} className="w-full h-full object-cover" />
                          
                          <div className="absolute top-1 left-1 bg-black/80 text-white font-mono text-[9px] px-1.5 py-0.5 rounded font-bold">
                            #{pIdx + 1}
                          </div>

                          <div className="absolute inset-0 bg-black/65 opacity-0 group-hover/thumb:opacity-100 transition-opacity flex items-center justify-center space-x-2">
                            {pIdx > 0 && (
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingPhotos(prev => {
                                    const copy = [...prev];
                                    const temp = copy[pIdx];
                                    copy[pIdx] = copy[pIdx - 1];
                                    copy[pIdx - 1] = temp;
                                    return copy;
                                  });
                                }}
                                className="p-1.5 rounded-lg bg-white/20 hover:bg-white/40 text-white cursor-pointer"
                                title="Move Left"
                              >
                                <ArrowLeft className="w-3.5 h-3.5" />
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => {
                                setEditingPhotos(prev => prev.filter((_, idx) => idx !== pIdx));
                              }}
                              className="p-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white cursor-pointer"
                              title="Remove Photo"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>

                            {pIdx < editingPhotos.length - 1 && (
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingPhotos(prev => {
                                    const copy = [...prev];
                                    const temp = copy[pIdx];
                                    copy[pIdx] = copy[pIdx + 1];
                                    copy[pIdx + 1] = temp;
                                    return copy;
                                  });
                                }}
                                className="p-1.5 rounded-lg bg-white/20 hover:bg-white/40 text-white cursor-pointer"
                                title="Move Right"
                              >
                                <ArrowRight className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-4 rounded-xl border border-dashed border-[#241226]/30 text-center text-[#241226]/60 text-xs font-medium">
                      No photos added yet. Click "Upload Photos" or paste a photo link above.
                    </div>
                  )}
                </div>

                <div className="flex justify-end space-x-2 pt-2 border-t border-[#241226]/10">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingTimeline(null);
                      setEditingPhotos([]);
                      setNewPhotoUrlInput('');
                    }}
                    className="px-4 py-2 rounded-xl bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold text-xs cursor-pointer transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!editingTimeline.title || !editingTimeline.year) {
                        alert('Year and Title are required.');
                        return;
                      }
                      try {
                        const savedPhotos = editingPhotos;
                        const primaryPhoto = savedPhotos[0] || '';
                        const savedId = await saveTimelineEvent({
                          year: editingTimeline.year,
                          title: editingTimeline.title,
                          description: editingTimeline.description || '',
                          imageUrl: primaryPhoto,
                          imageUrls: savedPhotos,
                          order: editingTimeline.order || 1,
                          isPublic: editingTimeline.isPublic !== false,
                          id: editingTimeline.id
                        });

                        const updated = await fetchTimelineEvents();
                        if (updated && updated.length > 0) {
                          setTimelineEvents(updated);
                        } else {
                          setTimelineEvents(prev => {
                            const idx = prev.findIndex(p => p.id === editingTimeline.id);
                            const updatedObj: TimelineItem = {
                              id: editingTimeline.id || savedId || `t_${Date.now()}`,
                              year: editingTimeline.year!,
                              title: editingTimeline.title!,
                              description: editingTimeline.description || '',
                              imageUrl: primaryPhoto,
                              imageUrls: savedPhotos,
                              order: editingTimeline.order || 1
                            };
                            if (idx >= 0) {
                              const copy = [...prev];
                              copy[idx] = updatedObj;
                              return copy;
                            }
                            return [...prev, updatedObj];
                          });
                        }
                      } catch (err: any) {
                        console.error('Error saving timeline event:', err);
                        alert('Failed to save timeline event: ' + (err.message || 'Unknown error'));
                      }
                      setEditingTimeline(null);
                      setEditingPhotos([]);
                      setNewPhotoUrlInput('');
                    }}
                    className="px-5 py-2 rounded-xl bg-[#2242A6] hover:bg-[#1a3384] text-white font-bold text-xs shadow cursor-pointer transition-colors"
                  >
                    Save Entry
                  </button>
                </div>
              </div>
            )}

            {/* List of Timeline Events with Sort Order Sequence Controls */}
            <div className="space-y-4">
              {timelineEvents
                .slice()
                .sort((a, b) => (a.order || 0) - (b.order || 0))
                .map((item, index, sortedArr) => {
                  const photosCount = item.imageUrls?.length || (item.imageUrl ? 1 : 0);
                  const firstThumb = item.imageUrls?.[0] || item.imageUrl;

                  const handleMoveSequence = async (direction: 'up' | 'down') => {
                    const targetIdx = direction === 'up' ? index - 1 : index + 1;
                    if (targetIdx < 0 || targetIdx >= sortedArr.length) return;

                    const currentItem = { ...item };
                    const targetItem = { ...sortedArr[targetIdx] };

                    // Swap or adjust orders
                    let currOrder = currentItem.order || (index + 1);
                    let targOrder = targetItem.order || (targetIdx + 1);

                    if (currOrder === targOrder) {
                      currOrder = index + 1;
                      targOrder = targetIdx + 1;
                    }

                    currentItem.order = targOrder;
                    targetItem.order = currOrder;

                    // Update state sorted
                    setTimelineEvents(prev => {
                      const next = prev.map(t => {
                        if (t.id === currentItem.id) return currentItem;
                        if (t.id === targetItem.id) return targetItem;
                        return t;
                      });
                      return next.sort((a, b) => (a.order || 0) - (b.order || 0));
                    });

                    // Save both to database
                    try {
                      await Promise.all([
                        saveTimelineEvent(currentItem),
                        saveTimelineEvent(targetItem)
                      ]);
                    } catch (err) {
                      console.error('Error saving reordered timeline events:', err);
                    }
                  };

                  const isCurrentlyEditing = editingTimeline?.id === item.id;

                  return (
                    <div 
                      key={item.id} 
                      className={`p-5 rounded-2xl bg-white border transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-[#241226] ${
                        isCurrentlyEditing
                          ? 'border-[#E8752C] ring-2 ring-[#E8752C] bg-amber-50/80 shadow-lg scale-[1.01]'
                          : 'border-[#241226]/15 hover:border-[#E8752C]/50 shadow-sm hover:shadow-md'
                      }`}
                    >
                      {/* Sequence Position & Order Controls */}
                      <div className="flex items-center space-x-2 shrink-0 bg-amber-50/90 p-2 rounded-xl border border-amber-200">
                        <div className="flex flex-col space-y-1">
                          <button
                            type="button"
                            disabled={index === 0}
                            onClick={() => handleMoveSequence('up')}
                            className="p-1.5 rounded-lg bg-white hover:bg-amber-100 text-[#2242A6] disabled:opacity-30 disabled:cursor-not-allowed border border-amber-200 shadow-xs transition-colors cursor-pointer"
                            title="Move Up in Sequence (Top)"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={index === sortedArr.length - 1}
                            onClick={() => handleMoveSequence('down')}
                            className="p-1.5 rounded-lg bg-white hover:bg-amber-100 text-[#2242A6] disabled:opacity-30 disabled:cursor-not-allowed border border-amber-200 shadow-xs transition-colors cursor-pointer"
                            title="Move Down in Sequence (Next)"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div className="text-center px-1 min-w-[50px]">
                          <span className="text-[9px] font-bold uppercase text-gray-400 block">Sequence</span>
                          <span className="font-poster text-lg text-[#C81E6E]">#{index + 1}</span>
                          <span className="text-[9px] text-gray-500 font-mono block">Order {item.order || (index + 1)}</span>
                        </div>
                      </div>

                      <div className="flex items-start space-x-4 min-w-0 flex-1">
                        {/* Thumbnail */}
                        <div className="w-20 h-20 rounded-xl overflow-hidden border border-[#241226]/15 bg-amber-50 shrink-0 flex items-center justify-center relative">
                          {firstThumb ? (
                            <>
                              <img src={firstThumb} alt={item.title} className="w-full h-full object-cover" />
                              {photosCount > 1 && (
                                <span className="absolute bottom-1 right-1 bg-black/80 text-white font-mono text-[9px] px-1.5 py-0.5 rounded-full font-bold border border-white/20">
                                  {photosCount} photos
                                </span>
                              )}
                            </>
                          ) : (
                            <span className="text-[10px] text-[#241226]/40 font-bold uppercase text-center px-1">No Image</span>
                          )}
                        </div>

                        {/* Details */}
                        <div className="min-w-0 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="px-2.5 py-0.5 rounded-full bg-[#E8752C]/10 border border-[#E8752C]/30 text-[#E8752C] font-bold text-xs">
                              {item.year}
                            </span>
                            <strong className="text-base font-poster text-[#241226] truncate">{item.title}</strong>

                            {/* Interactive Toggle Switch Button */}
                            <button
                              type="button"
                              role="switch"
                              aria-checked={item.isPublic !== false}
                              onClick={async () => {
                                const newPublicStatus = item.isPublic === false ? true : false;
                                try {
                                  await saveTimelineEvent({ ...item, isPublic: newPublicStatus });
                                  setTimelineEvents(prev => prev.map(t => t.id === item.id ? { ...t, isPublic: newPublicStatus } : t));
                                } catch (err) {
                                  console.error('Error toggling timeline public visibility:', err);
                                }
                              }}
                              className={`inline-flex items-center space-x-2 px-2.5 py-1 rounded-full text-[11px] font-extrabold transition-all duration-200 cursor-pointer shadow-2xs border ${
                                item.isPublic !== false
                                  ? 'bg-emerald-50 text-emerald-900 border-emerald-300 hover:bg-emerald-100'
                                  : 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100'
                              }`}
                              title="Click to toggle public visibility"
                            >
                              {/* Switch Track & Knob */}
                              <div className={`w-7 h-4 rounded-full p-0.5 transition-colors relative flex items-center shrink-0 ${
                                item.isPublic !== false ? 'bg-emerald-600' : 'bg-slate-300'
                              }`}>
                                <div className={`w-3 h-3 rounded-full bg-white shadow-xs transform transition-transform duration-200 ease-in-out ${
                                  item.isPublic !== false ? 'translate-x-3' : 'translate-x-0'
                                }`} />
                              </div>

                              <span className="flex items-center space-x-1 shrink-0">
                                {item.isPublic !== false ? (
                                  <>
                                    <Eye className="w-3 h-3 text-emerald-600 shrink-0" />
                                    <span>Visible</span>
                                  </>
                                ) : (
                                  <>
                                    <EyeOff className="w-3 h-3 text-amber-700 shrink-0" />
                                    <span>Hidden</span>
                                  </>
                                )}
                              </span>
                            </button>

                            {isCurrentlyEditing && (
                              <span className="px-2.5 py-0.5 rounded-full bg-[#E8752C] text-white font-extrabold text-[10px] uppercase tracking-wider inline-flex items-center space-x-1 shadow">
                                <Edit className="w-3 h-3" />
                                <span>BEING EDITED ABOVE</span>
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-[#241226]/75 leading-relaxed line-clamp-2">
                            <FormattedText content={item.description} />
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center space-x-2 shrink-0 self-end sm:self-center pt-2 sm:pt-0">
                        <button
                          onClick={() => {
                            setEditingTimeline(item);
                            const photos = item.imageUrls && item.imageUrls.length > 0
                              ? [...item.imageUrls]
                              : item.imageUrl
                              ? [item.imageUrl]
                              : [];
                            setEditingPhotos(photos);
                            setNewPhotoUrlInput('');
                            setTimeout(() => {
                              document.getElementById('timeline-edit-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                            }, 50);
                          }}
                          className={`px-3 py-1.5 rounded-lg font-bold text-xs shadow cursor-pointer transition-colors inline-flex items-center space-x-1 ${
                            isCurrentlyEditing
                              ? 'bg-[#E8752C] hover:bg-[#d66720] text-white ring-2 ring-amber-300'
                              : 'bg-blue-600 hover:bg-blue-500 text-white'
                          }`}
                          title="Edit Timeline Entry"
                        >
                          <Edit className="w-3.5 h-3.5" />
                          <span>{isCurrentlyEditing ? 'Editing Now' : 'Edit'}</span>
                        </button>
                        <button
                          onClick={() => {
                            setDeleteConfirmModal({
                              title: `Delete Jubilee Memory "${item.title}"?`,
                              subtitle: `Year: ${item.year}. This action will permanently remove this entry from the Jubilee Memories page.`,
                              onConfirm: async () => {
                                try {
                                  await deleteTimelineEvent(item.id);
                                } catch (err) {
                                  console.error('Error deleting timeline event:', err);
                                }
                                setTimelineEvents(prev => prev.filter(e => e.id !== item.id));
                              }
                            });
                          }}
                          className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold text-xs shadow cursor-pointer transition-colors inline-flex items-center space-x-1"
                          title="Delete Timeline Entry"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Delete</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
            </div>

          </div>

          {/* MAIN ADMIN: PAGE VISIBILITY MANAGER */}
          {isFullAdmin && (
            <div className="cream-card p-6 sm:p-8 space-y-6 border-2 border-[#2242A6]/40 shadow-xl bg-gradient-to-br from-amber-50/80 via-white to-blue-50/50">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#241226]/10 pb-4">
                <div>
                  <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-[#2242A6]/10 text-[#2242A6] text-[10px] font-black uppercase tracking-wider mb-2 border border-[#2242A6]/20">
                    <Shield className="w-3.5 h-3.5 text-[#2242A6]" />
                    <span>Main Admin Page Controls</span>
                  </div>
                  <h3 className="font-poster text-2xl sm:text-3xl text-[#241226]">
                    MAIN WEBSITE PAGE VISIBILITY SETTINGS
                  </h3>
                  <p className="text-xs text-[#241226]/70 mt-0.5">
                    As Main Admin, choose which pages are visible to website visitors in the navigation bar and footer.
                  </p>
                </div>

                <button
                  onClick={async () => {
                    setSavingSiteContent(true);
                    try {
                      await saveSiteContent(siteContent || INITIAL_SITE_CONTENT);
                      setSiteSaveSuccess(true);
                      setTimeout(() => setSiteSaveSuccess(false), 3000);
                    } catch (err: any) {
                      alert('Failed to save page visibility settings: ' + (err.message || 'Unknown error'));
                    } finally {
                      setSavingSiteContent(false);
                    }
                  }}
                  disabled={savingSiteContent}
                  className="px-5 py-2.5 rounded-xl bg-signature-gradient text-white font-bold text-xs flex items-center justify-center space-x-2 shadow-lg hover:brightness-110 transition-all cursor-pointer shrink-0 disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  <span>Save Page Visibility Settings</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
                {[
                  { id: 'conference', label: 'GRACIA Conference Page', path: '/', desc: 'Main registration, schedule, venue & induction details', icon: <Sparkles className="w-5 h-5 text-amber-600" /> },
                  { id: 'musical', label: 'GRACIA Musical Concert', path: '/musical', desc: 'Free ticket reservations, love offer & concert details', icon: <Music className="w-5 h-5 text-[#C81E6E]" /> },
                  { id: 'jubilee', label: 'Jubilee Memories (25 Years)', path: '/jubilee', desc: '25-year historical interactive timeline & photo archive', icon: <Calendar className="w-5 h-5 text-purple-600" /> },
                  { id: 'contact', label: 'Prayer Groups & Contact Us', path: '/contact', desc: 'Contact inquiry form, HQ location map & prayer groups list', icon: <Mail className="w-5 h-5 text-blue-600" /> },
                  { id: 'portal', label: 'Participant Portal & Passes', path: '/portal', desc: 'Digital conference passes, ticket management & login portal', icon: <UserIcon className="w-5 h-5 text-emerald-600" /> },
                ].map((page) => {
                  const isHidden = siteContent?.hiddenPages?.includes(page.id) || false;
                  return (
                    <div 
                      key={page.id} 
                      className={`p-4 rounded-2xl border-2 transition-all flex flex-col justify-between space-y-3 ${
                        isHidden 
                          ? 'bg-rose-50/90 border-rose-300 text-rose-950 shadow-xs' 
                          : 'bg-white border-emerald-300 text-slate-800 shadow-md'
                      }`}
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <div className="p-2 rounded-xl bg-gray-100 border border-gray-200 shrink-0">
                            {page.icon}
                          </div>

                          {/* Toggle Switch */}
                          <button
                            type="button"
                            role="switch"
                            aria-checked={!isHidden}
                            onClick={() => {
                              const currentHidden = siteContent?.hiddenPages || [];
                              const newHidden = isHidden 
                                ? currentHidden.filter(h => h !== page.id)
                                : [...currentHidden, page.id];
                              setSiteContent(prev => ({ ...(prev || INITIAL_SITE_CONTENT), hiddenPages: newHidden }));
                            }}
                            className={`w-11 h-6 rounded-full p-0.5 transition-colors duration-200 ease-in-out cursor-pointer relative shrink-0 ${
                              !isHidden ? 'bg-emerald-600' : 'bg-rose-400'
                            }`}
                            title={!isHidden ? 'Page is visible to public. Click to hide.' : 'Page is hidden. Click to show.'}
                          >
                            <div className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform duration-200 ease-in-out ${
                              !isHidden ? 'translate-x-5' : 'translate-x-0'
                            }`} />
                          </button>
                        </div>

                        <h4 className="font-bold text-sm text-[#241226]">{page.label}</h4>
                        <p className="text-[11px] text-gray-600 leading-snug">{page.desc}</p>
                      </div>

                      <div className="pt-2 border-t border-gray-200/60 flex items-center justify-between text-xs">
                        <span className="text-[10px] font-mono text-gray-400">Path: {page.path}</span>
                        <span className={`text-[11px] font-extrabold uppercase px-2 py-0.5 rounded-md border flex items-center space-x-1 ${
                          isHidden 
                            ? 'bg-rose-100 text-rose-800 border-rose-300' 
                            : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                        }`}>
                          {isHidden ? (
                            <>
                              <EyeOff className="w-3 h-3 text-rose-700" />
                              <span>Hidden</span>
                            </>
                          ) : (
                            <>
                              <Eye className="w-3 h-3 text-emerald-600" />
                              <span>Visible</span>
                            </>
                          )}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* MAIN ADMIN ONLY: CONTACT US — ABOUT JY & HQ DETAILS EDITOR */}
          {isFullAdmin && (
            <div className="cream-card p-6 sm:p-8 space-y-6 border border-[#2242A6]/30 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#241226]/10 pb-4">
              <div>
                <h3 className="font-poster text-2xl text-[#241226] flex items-center space-x-2">
                  <Sparkles className="w-6 h-6 text-[#E8752C]" />
                  <span>CONTACT US — ABOUT JY & VENUE DETAILS</span>
                </h3>
                <p className="text-xs text-[#241226]/70 mt-0.5">
                  Edit the introductory blurb, event venue address, contact email, and phone number shown on the Contact page.
                </p>
              </div>

              {siteSaveSuccess && (
                <div className="px-3 py-1.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-800 font-bold text-xs flex items-center space-x-1.5">
                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                  <span>Saved to Cloud!</span>
                </div>
              )}
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const dataToSave = siteContent || INITIAL_SITE_CONTENT;
                setSavingSiteContent(true);
                try {
                  await saveSiteContent(dataToSave);
                  setSiteSaveSuccess(true);
                  setTimeout(() => setSiteSaveSuccess(false), 3000);
                } catch (err: any) {
                  console.error('Error saving site content:', err);
                  alert('Failed to save site content: ' + (err.message || 'Unknown error'));
                } finally {
                  setSavingSiteContent(false);
                }
              }}
              className="space-y-4 text-xs text-[#241226]"
            >
              <div>
                <RichTextEditor
                  id="about-text-editor"
                  label="About Jesus Youth Singapore Blurb"
                  required
                  rows={5}
                  value={siteContent?.aboutText || ''}
                  onChange={(val) => setSiteContent(prev => ({ ...(prev || INITIAL_SITE_CONTENT), aboutText: val }))}
                  placeholder="Describe the Jesus Youth movement in Singapore... HTML styling & formatting toolbar enabled."
                  helpText="Use the toolbar to select font styles (Poster, Script, Sans, Serif), custom text colors, highlights, bold, headings, and lists. Paragraphs and line breaks are formatted automatically when rendered on the site."
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block font-bold mb-1 uppercase text-[11px] text-[#241226] flex items-center space-x-1.5">
                    <MapPin className="w-3.5 h-3.5 text-[#E8752C]" />
                    <span>Event Venue Address *</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={siteContent?.hqAddress || ''}
                    onChange={e => setSiteContent(prev => ({ ...(prev || INITIAL_SITE_CONTENT), hqAddress: e.target.value }))}
                    placeholder="e.g. Agape Village, Lorong 8 Toa Payoh"
                    className="w-full p-2.5 rounded-xl bg-white border border-[#241226]/20 font-medium focus:outline-none focus:ring-2 focus:ring-[#2242A6]"
                  />
                </div>

                <div>
                  <label className="block font-bold mb-1 uppercase text-[11px] text-[#241226] flex items-center space-x-1.5">
                    <Mail className="w-3.5 h-3.5 text-[#2242A6]" />
                    <span>Contact Email Address *</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={siteContent?.contactEmail || ''}
                    onChange={e => setSiteContent(prev => ({ ...(prev || INITIAL_SITE_CONTENT), contactEmail: e.target.value }))}
                    placeholder="singapore@jesusyouth.org"
                    className="w-full p-2.5 rounded-xl bg-white border border-[#241226]/20 font-medium focus:outline-none focus:ring-2 focus:ring-[#2242A6]"
                  />
                </div>

                <div>
                  <label className="block font-bold mb-1 uppercase text-[11px] text-[#241226] flex items-center space-x-1.5">
                    <Phone className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Contact Phone Number</span>
                  </label>
                  <input
                    type="text"
                    value={siteContent?.contactPhone || ''}
                    onChange={e => setSiteContent(prev => ({ ...(prev || INITIAL_SITE_CONTENT), contactPhone: e.target.value }))}
                    placeholder="e.g. +65 9123 4567"
                    className="w-full p-2.5 rounded-xl bg-white border border-[#241226]/20 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={savingSiteContent}
                  className="px-6 py-2.5 rounded-xl bg-signature-gradient text-white font-bold text-xs shadow-md hover:brightness-110 cursor-pointer transition-all flex items-center space-x-2 disabled:opacity-50"
                >
                  {savingSiteContent ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-white" />
                      <span>Saving Details...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Save About & Venue Details</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
          )}

          {/* MAIN ADMIN ONLY: CONTACT US — SINGAPORE PRAYER GROUPS MANAGER */}
          {isFullAdmin && (
            <div className="cream-card p-6 sm:p-8 space-y-6 border border-[#2242A6]/30 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#241226]/10 pb-4">
              <div>
                <h3 className="font-poster text-2xl text-[#241226] flex items-center space-x-2">
                  <Users className="w-6 h-6 text-[#2242A6]" />
                  <span>CONTACT US — SINGAPORE PRAYER GROUPS</span>
                  <span className="text-sm font-sans font-bold text-[#C81E6E]">({prayerGroups.length} Groups)</span>
                </h3>
                <p className="text-xs text-[#241226]/70 mt-0.5">
                  Manage prayer groups across Singapore displayed on the Contact Us page (Add, Edit, or Delete).
                </p>
              </div>

              <button
                onClick={() => {
                  setEditingGroup({
                    name: '',
                    area: '',
                    meetingTime: '',
                    contactPerson: '',
                    contactPhone: '',
                    order: prayerGroups.length + 1
                  });
                  setTimeout(() => {
                    document.getElementById('group-edit-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }, 50);
                }}
                className="px-4 py-2.5 rounded-xl bg-signature-gradient text-white font-bold text-xs flex items-center justify-center space-x-2 shadow-md hover:brightness-110 transition-all cursor-pointer shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Add Prayer Group</span>
              </button>
            </div>

            {/* Inline Add / Edit Prayer Group Form */}
            {editingGroup && (
              <div id="group-edit-form" className="p-5 sm:p-6 rounded-2xl bg-blue-50 border-2 border-[#2242A6] space-y-4 text-xs text-[#241226] shadow-xl scroll-mt-28 ring-2 ring-[#2242A6]/40 animate-fade-in">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#241226]/10 pb-3 gap-2">
                  <div className="flex items-center space-x-3">
                    <div className="p-2.5 rounded-xl bg-[#2242A6] text-white shadow">
                      <Edit className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm uppercase tracking-wide text-[#2242A6] flex items-center space-x-2">
                        <span>{editingGroup.id ? 'Editing Prayer Group Record' : 'New Prayer Group Entry'}</span>
                      </h4>
                      {editingGroup.id && (
                        <p className="text-xs font-bold text-[#2242A6] flex items-center space-x-1 mt-0.5">
                          <span>Currently Editing Record:</span>
                          <span className="underline font-mono">"{editingGroup.name || 'Untitled'}"</span>
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {editingGroup.id && (
                      <span className="px-3 py-1 rounded-full bg-[#2242A6] text-white font-extrabold text-[10px] uppercase tracking-wider shadow">
                        ✏️ EDIT RECORD MODE
                      </span>
                    )}
                    <span className="text-[10px] text-[#241226]/60 font-mono">ID: {editingGroup.id || 'New Record'}</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold mb-1 uppercase text-[11px] text-[#241226]">Group Name *</label>
                    <input
                      type="text"
                      required
                      value={editingGroup.name || ''}
                      onChange={e => setEditingGroup({ ...editingGroup, name: e.target.value })}
                      placeholder="e.g. Agape Village Central Prayer Group"
                      className="w-full p-2.5 rounded-xl bg-white border border-[#241226]/20 font-bold focus:outline-none focus:ring-2 focus:ring-[#2242A6]"
                    />
                  </div>

                  <div>
                    <label className="block font-bold mb-1 uppercase text-[11px] text-[#241226]">Area / Region *</label>
                    <input
                      type="text"
                      required
                      value={editingGroup.area || ''}
                      onChange={e => setEditingGroup({ ...editingGroup, area: e.target.value })}
                      placeholder="e.g. Central / Toa Payoh"
                      className="w-full p-2.5 rounded-xl bg-white border border-[#241226]/20 font-semibold focus:outline-none focus:ring-2 focus:ring-[#2242A6]"
                    />
                  </div>

                  <div>
                    <label className="block font-bold mb-1 uppercase text-[11px] text-[#241226]">Meeting Time *</label>
                    <input
                      type="text"
                      required
                      value={editingGroup.meetingTime || ''}
                      onChange={e => setEditingGroup({ ...editingGroup, meetingTime: e.target.value })}
                      placeholder="e.g. Every Friday, 7:45 PM – 9:30 PM"
                      className="w-full p-2.5 rounded-xl bg-white border border-[#241226]/20 font-medium focus:outline-none focus:ring-2 focus:ring-[#2242A6]"
                    />
                  </div>

                  <div>
                    <label className="block font-bold mb-1 uppercase text-[11px] text-[#241226]">Contact Person(s) *</label>
                    <input
                      type="text"
                      required
                      value={editingGroup.contactPerson || ''}
                      onChange={e => setEditingGroup({ ...editingGroup, contactPerson: e.target.value })}
                      placeholder="e.g. Bro. Emmanuel & Sis. Clare"
                      className="w-full p-2.5 rounded-xl bg-white border border-[#241226]/20 font-medium focus:outline-none focus:ring-2 focus:ring-[#2242A6]"
                    />
                  </div>

                  <div>
                    <label className="block font-bold mb-1 uppercase text-[11px] text-[#241226]">Contact Phone *</label>
                    <input
                      type="text"
                      required
                      value={editingGroup.contactPhone || ''}
                      onChange={e => setEditingGroup({ ...editingGroup, contactPhone: e.target.value })}
                      placeholder="e.g. +65 9123 4567"
                      className="w-full p-2.5 rounded-xl bg-white border border-[#241226]/20 font-medium focus:outline-none focus:ring-2 focus:ring-[#2242A6]"
                    />
                  </div>

                  <div>
                    <label className="block font-bold mb-1 uppercase text-[11px] text-[#241226]">Display Order</label>
                    <input
                      type="number"
                      value={editingGroup.order || 1}
                      onChange={e => setEditingGroup({ ...editingGroup, order: parseInt(e.target.value) || 1 })}
                      className="w-full p-2.5 rounded-xl bg-white border border-[#241226]/20 font-medium focus:outline-none focus:ring-2 focus:ring-[#2242A6]"
                    />
                  </div>
                </div>

                <div className="flex justify-end space-x-2 pt-2 border-t border-[#241226]/10">
                  <button
                    type="button"
                    onClick={() => setEditingGroup(null)}
                    className="px-4 py-2 rounded-xl bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold text-xs cursor-pointer transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!editingGroup.name || !editingGroup.area || !editingGroup.meetingTime || !editingGroup.contactPerson) {
                        alert('Name, Area, Meeting Time, and Contact Person are required.');
                        return;
                      }
                      try {
                        const savedId = await savePrayerGroup({
                          name: editingGroup.name,
                          area: editingGroup.area,
                          meetingTime: editingGroup.meetingTime,
                          contactPerson: editingGroup.contactPerson,
                          contactPhone: editingGroup.contactPhone || '',
                          order: editingGroup.order || 1,
                          id: editingGroup.id
                        });

                        const updatedList = await fetchPrayerGroups();
                        if (updatedList && updatedList.length > 0) {
                          setPrayerGroups(updatedList);
                        } else {
                          setPrayerGroups(prev => {
                            const idx = prev.findIndex(p => p.id === editingGroup.id);
                            const updatedObj: PrayerGroupItem = {
                              id: editingGroup.id || savedId || `p_${Date.now()}`,
                              name: editingGroup.name!,
                              area: editingGroup.area!,
                              meetingTime: editingGroup.meetingTime!,
                              contactPerson: editingGroup.contactPerson!,
                              contactPhone: editingGroup.contactPhone || '',
                              order: editingGroup.order || 1
                            };
                            if (idx >= 0) {
                              const copy = [...prev];
                              copy[idx] = updatedObj;
                              return copy;
                            }
                            return [...prev, updatedObj];
                          });
                        }
                      } catch (err: any) {
                        console.error('Error saving prayer group:', err);
                        alert('Failed to save prayer group: ' + (err.message || 'Unknown error'));
                      }
                      setEditingGroup(null);
                    }}
                    className="px-5 py-2 rounded-xl bg-[#2242A6] hover:bg-[#1a3384] text-white font-bold text-xs shadow cursor-pointer transition-colors"
                  >
                    Save Prayer Group
                  </button>
                </div>
              </div>
            )}

            {/* List of Prayer Groups */}
            <div className="space-y-3">
              {prayerGroups.length === 0 ? (
                <div className="p-6 rounded-2xl border border-dashed border-[#241226]/20 text-center text-[#241226]/60 text-xs">
                  No prayer groups found. Click "Add Prayer Group" to create one!
                </div>
              ) : (
                prayerGroups.map((group) => {
                  const isCurrentlyEditingGroup = editingGroup?.id === group.id;

                  return (
                    <div
                      key={group.id}
                      className={`p-4 sm:p-5 rounded-2xl bg-white border transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-[#241226] ${
                        isCurrentlyEditingGroup
                          ? 'border-[#2242A6] ring-2 ring-[#2242A6] bg-blue-50/80 shadow-lg scale-[1.01]'
                          : 'border-[#241226]/15 hover:border-[#2242A6]/50 shadow-sm hover:shadow-md'
                      }`}
                    >
                      <div className="space-y-1 flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-[#2242A6] text-sm">{group.name}</span>
                          <span className="text-[10px] font-bold text-[#E8752C] bg-[#E8752C]/10 px-2 py-0.5 rounded-full border border-[#E8752C]/20">
                            {group.area}
                          </span>
                          {isCurrentlyEditingGroup && (
                            <span className="px-2.5 py-0.5 rounded-full bg-[#2242A6] text-white font-extrabold text-[10px] uppercase tracking-wider inline-flex items-center space-x-1 shadow">
                              <Edit className="w-3 h-3" />
                              <span>BEING EDITED ABOVE</span>
                            </span>
                          )}
                        </div>
                        <div className="text-[#241226]/75 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]">
                          <span><strong>Meeting:</strong> {group.meetingTime}</span>
                          <span><strong>Contact:</strong> {group.contactPerson} ({group.contactPhone})</span>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2 shrink-0 self-end sm:self-center">
                        <button
                          onClick={() => {
                            setEditingGroup(group);
                            setTimeout(() => {
                              document.getElementById('group-edit-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                            }, 50);
                          }}
                          className={`px-3 py-1.5 rounded-lg font-bold text-xs shadow cursor-pointer transition-colors inline-flex items-center space-x-1 ${
                            isCurrentlyEditingGroup
                              ? 'bg-[#2242A6] hover:bg-[#1a3384] text-white ring-2 ring-blue-300'
                              : 'bg-blue-600 hover:bg-blue-500 text-white'
                          }`}
                          title="Edit Prayer Group"
                        >
                          <Edit className="w-3.5 h-3.5" />
                          <span>{isCurrentlyEditingGroup ? 'Editing Now' : 'Edit'}</span>
                        </button>
                      <button
                        onClick={() => {
                          setDeleteConfirmModal({
                            title: `Delete Prayer Group "${group.name}"?`,
                            subtitle: `Area: ${group.area}. This action will remove this prayer group from the Contact Us page.`,
                            onConfirm: async () => {
                              try {
                                await deletePrayerGroup(group.id);
                              } catch (err) {
                                console.error('Error deleting prayer group:', err);
                              }
                              setPrayerGroups(prev => prev.filter(g => g.id !== group.id));
                            }
                          });
                        }}
                        className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold text-xs shadow cursor-pointer transition-colors inline-flex items-center space-x-1"
                        title="Delete Prayer Group"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete</span>
                      </button>
                    </div>
                  </div>
                  );
                })
              )}
            </div>
          </div>
          )}

          {/* MAIN ADMIN ONLY: Social Media & Contact Links Editor */}
          {isFullAdmin && (
            <div className="cream-card p-6 sm:p-8 space-y-6 border border-[#E8B400]/30 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#241226]/10 pb-4">
              <div>
                <h3 className="font-poster text-2xl text-[#241226] flex items-center space-x-2">
                  <Globe className="w-6 h-6 text-[#E8B400]" />
                  <span>CONTACT US — SOCIAL LINKS & WEBSITE</span>
                </h3>
                <p className="text-xs text-[#241226]/70 mt-0.5">
                  Update Jesus Youth Singapore social media channels and official website URLs displayed on the Contact page.
                </p>
              </div>

              {siteSaveSuccess && (
                <div className="px-3 py-1.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-800 font-bold text-xs flex items-center space-x-1.5">
                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                  <span>Saved to Cloud!</span>
                </div>
              )}
            </div>

            <form 
              onSubmit={async (e) => {
                e.preventDefault();
                const dataToSave = siteContent || INITIAL_SITE_CONTENT;
                setSavingSiteContent(true);
                try {
                  await saveSiteContent(dataToSave);
                  setSiteSaveSuccess(true);
                  setTimeout(() => setSiteSaveSuccess(false), 3000);
                } catch (err: any) {
                  console.error('Error saving site content:', err);
                  alert('Failed to save site content: ' + (err.message || 'Unknown error'));
                } finally {
                  setSavingSiteContent(false);
                }
              }}
              className="space-y-4 text-xs text-[#241226]"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Instagram Handle / URL */}
                <div>
                  <label className="block font-bold mb-1 uppercase text-[11px] text-[#241226] flex items-center space-x-1.5">
                    <Instagram className="w-3.5 h-3.5 text-[#C81E6E]" />
                    <span>Instagram URL *</span>
                  </label>
                  <input
                    type="url"
                    required
                    value={siteContent?.instagramUrl || ''}
                    onChange={(e) => setSiteContent(prev => ({ ...(prev || INITIAL_SITE_CONTENT), instagramUrl: e.target.value }))}
                    placeholder="https://www.instagram.com/jesusyouth_singapore"
                    className="w-full p-2.5 rounded-xl bg-white border border-[#241226]/20 font-medium focus:outline-none focus:ring-2 focus:ring-[#C81E6E]"
                  />
                </div>

                {/* Facebook URL */}
                <div>
                  <label className="block font-bold mb-1 uppercase text-[11px] text-[#241226] flex items-center space-x-1.5">
                    <Facebook className="w-3.5 h-3.5 text-[#2242A6]" />
                    <span>Facebook URL *</span>
                  </label>
                  <input
                    type="url"
                    required
                    value={siteContent?.facebookUrl || ''}
                    onChange={(e) => setSiteContent(prev => ({ ...(prev || INITIAL_SITE_CONTENT), facebookUrl: e.target.value }))}
                    placeholder="https://www.facebook.com/jy15sg"
                    className="w-full p-2.5 rounded-xl bg-white border border-[#241226]/20 font-medium focus:outline-none focus:ring-2 focus:ring-[#2242A6]"
                  />
                </div>

                {/* YouTube Handle / URL */}
                <div>
                  <label className="block font-bold mb-1 uppercase text-[11px] text-[#241226] flex items-center space-x-1.5">
                    <Youtube className="w-3.5 h-3.5 text-[#D62828]" />
                    <span>YouTube URL *</span>
                  </label>
                  <input
                    type="url"
                    required
                    value={siteContent?.youtubeUrl || ''}
                    onChange={(e) => setSiteContent(prev => ({ ...(prev || INITIAL_SITE_CONTENT), youtubeUrl: e.target.value }))}
                    placeholder="https://www.youtube.com/@JesusYouthSingapore"
                    className="w-full p-2.5 rounded-xl bg-white border border-[#241226]/20 font-medium focus:outline-none focus:ring-2 focus:ring-[#D62828]"
                  />
                </div>

                {/* Website URL */}
                <div>
                  <label className="block font-bold mb-1 uppercase text-[11px] text-[#241226] flex items-center space-x-1.5">
                    <Globe className="w-3.5 h-3.5 text-[#E8B400]" />
                    <span>Official Website URL *</span>
                  </label>
                  <input
                    type="url"
                    required
                    value={siteContent?.websiteUrl || ''}
                    onChange={(e) => setSiteContent(prev => ({ ...(prev || INITIAL_SITE_CONTENT), websiteUrl: e.target.value }))}
                    placeholder="https://singapore.jesusyouth.org/"
                    className="w-full p-2.5 rounded-xl bg-white border border-[#241226]/20 font-medium focus:outline-none focus:ring-2 focus:ring-[#E8B400]"
                  />
                </div>
              </div>

              {/* Save Button */}
              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={savingSiteContent}
                  className="px-6 py-2.5 rounded-xl bg-signature-gradient text-white font-bold text-xs shadow-md hover:brightness-110 cursor-pointer transition-all flex items-center space-x-2 disabled:opacity-50"
                >
                  {savingSiteContent ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-white" />
                      <span>Saving Social Links...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Save Social Links & Website</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
          )}

        </div>
      )}

      {/* TAB 4: TICKET CHECK-IN & SCANNER VIEW */}
      {adminTab === 'tickets' && !isIntercessionCoordinatorOnly && !isInvitationAdminOnly && (
        <ErrorBoundary fallbackTitle="TICKET SCANNER RECOVERED">
          <TicketCheckInView
            registrations={registrations}
            onUpdateRegistration={async (id, patch) => {
              const regToUpdate = registrations.find(r => r.id === id);
              const primaryId = regToUpdate?.primaryContactId || regToUpdate?.linkedDocId || id;

              const success = await updateRegistrationInFirestore(primaryId, patch);

              const relatedDocs = registrations.filter(r => 
                r.id !== primaryId && (
                  r.primaryContactId === primaryId || 
                  r.linkedDocId === primaryId || 
                  (regToUpdate?.linkedDocId && r.id === regToUpdate.linkedDocId) ||
                  (regToUpdate?.primaryContactId && r.id === regToUpdate.primaryContactId)
                )
              );

              for (const rel of relatedDocs) {
                if (rel.id) {
                  await updateRegistrationInFirestore(rel.id, patch);
                }
              }

              if (success) {
                setRegistrations(prev => prev.map(r => 
                  (r.id === primaryId || r.primaryContactId === primaryId || r.linkedDocId === primaryId || (regToUpdate?.linkedDocId && r.id === regToUpdate.linkedDocId)) 
                    ? { ...r, ...patch } 
                    : r
                ));
              }
              return success;
            }}
            adminEmail={user?.email || ''}
            adminName={user?.displayName || ''}
            isTicketAdminOnly={isTicketAdminOnly}
          />
        </ErrorBoundary>
      )}

      {/* TAB 5: INTERCESSIONS & SPIRITUAL BOUQUET REGISTRATIONS TABLE */}
      {adminTab === 'intercessions' && !isInvitationAdminOnly && (
        <div className="space-y-6 animate-fade-in">
          
          {/* Top Notification Banner */}
          {reminderNotification && (
            <div className={`p-4 rounded-2xl border flex items-center justify-between shadow-lg ${
              reminderNotification.type === 'success' 
                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-200' 
                : 'bg-rose-500/15 border-rose-500/40 text-rose-200'
            }`}>
              <div className="flex items-center space-x-3">
                {reminderNotification.type === 'success' ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
                )}
                <span className="text-xs sm:text-sm font-medium">{reminderNotification.message}</span>
              </div>
              <button 
                onClick={() => setReminderNotification(null)}
                className="p-1 text-white/60 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Progress Banner during bulk mail dispatch */}
          {isSendingReminderEmail && reminderProgressText && (
            <div className="p-4 rounded-2xl bg-purple-900/40 border border-purple-500/50 text-purple-200 flex items-center space-x-3 animate-pulse">
              <RefreshCw className="w-5 h-5 text-purple-300 animate-spin shrink-0" />
              <span className="text-sm font-semibold">{reminderProgressText}</span>
            </div>
          )}

          {/* Header Banner */}
          <div className="bg-gradient-to-r from-purple-900/60 via-[#1C0D1E] to-[#2B1032] border-2 border-purple-500/40 rounded-3xl p-6 sm:p-7 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none"></div>
            <div className="relative z-10 flex flex-col xl:flex-row xl:items-center justify-between gap-5">
              <div className="space-y-1.5 max-w-3xl">
                <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-purple-500/20 border border-purple-400/40 text-purple-300 text-xs font-bold uppercase tracking-wider">
                  <HeartHandshake className="w-3.5 h-3.5 text-purple-400" />
                  <span>Jubilee Intercessions Coordinator Panel</span>
                </div>
                <h2 className="font-poster text-2xl sm:text-3xl text-white tracking-wide">
                  SPIRITUAL BOUQUET COMMITMENTS TABLE
                </h2>
                <p className="text-xs sm:text-sm text-purple-200/80 leading-relaxed">
                  View and manage all faithful intercession commitments submitted for GRACIA. Target completion date: <strong className="text-amber-300">October 10, 2026</strong>. Send individual or bulk email reminders from <strong className="text-white">jysg25@gmail.com</strong>.
                </p>
              </div>

              {/* Action Buttons Header */}
              <div className="flex flex-wrap items-center gap-3 shrink-0 pt-2 xl:pt-0">
                <button
                  onClick={() => {
                    setNewIntercessionForm({
                      name: '',
                      email: '',
                      phone: '',
                      holyMass: 0,
                      adoration: 0,
                      rosary: 0,
                      decadeRosary: 0,
                      divineMercy: 0,
                      fastMeal: 0,
                      abstainMeat: 0,
                      shortPrayers: 0,
                      pdpaAccepted: true
                    });
                    setShowAddIntercessionModal(true);
                  }}
                  className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:brightness-110 text-white font-bold text-xs shadow-lg cursor-pointer transition-all flex items-center space-x-2"
                >
                  <Plus className="w-4 h-4 text-white" />
                  <span>Add Commitment Entry</span>
                </button>

                <button
                  onClick={openBulkEmailModal}
                  disabled={isSendingReminderEmail || intercessionsList.length === 0}
                  className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 via-pink-600 to-amber-500 hover:brightness-110 text-white font-bold text-xs shadow-lg cursor-pointer transition-all flex items-center space-x-2 disabled:opacity-50"
                >
                  <Mail className="w-4 h-4 text-white" />
                  <span>Send Email Reminder to All</span>
                </button>

                <button
                  onClick={exportIntercessionsCSV}
                  disabled={intercessionsList.length === 0}
                  className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs border border-white/20 shadow cursor-pointer transition-all flex items-center space-x-2 disabled:opacity-50"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                  <span>Export CSV</span>
                </button>
              </div>
            </div>
          </div>

          {/* Metrics Overview Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
            <div className="p-4 rounded-2xl bg-white/5 border border-purple-500/20 backdrop-blur-xl">
              <div className="text-[10px] text-purple-300 font-semibold uppercase tracking-wider">Total Committed</div>
              <div className="font-poster text-2xl sm:text-3xl text-amber-300 mt-1">{totalIntercessorsCount}</div>
              <div className="text-[10px] text-emerald-300 mt-0.5 font-medium">{fullyCompletedCount} Done &bull; {inProgressCount} Active</div>
            </div>

            <div className="p-4 rounded-2xl bg-white/5 border border-purple-500/20 backdrop-blur-xl">
              <div className="text-[10px] text-purple-300 font-semibold uppercase tracking-wider">Overall Progress</div>
              <div className="font-poster text-2xl sm:text-3xl text-emerald-400 mt-1">{overallProgressPct}%</div>
              <div className="text-[10px] text-white/50 mt-0.5 font-mono">{grandTotalCompleted}/{grandTotalPledged} items</div>
            </div>

            <div className="p-4 rounded-2xl bg-white/5 border border-purple-500/20 backdrop-blur-xl">
              <div className="text-[10px] text-purple-300 font-semibold uppercase tracking-wider">Holy Mass</div>
              <div className="font-poster text-2xl sm:text-3xl text-emerald-400 mt-1">{totalMassesCompleted}/{totalMassesCommitted}</div>
              <div className="text-[10px] text-white/50 mt-0.5">Masses Completed</div>
            </div>

            <div className="p-4 rounded-2xl bg-white/5 border border-purple-500/20 backdrop-blur-xl">
              <div className="text-[10px] text-purple-300 font-semibold uppercase tracking-wider">Adoration</div>
              <div className="font-poster text-2xl sm:text-3xl text-amber-400 mt-1">{totalAdorationHoursCompleted}h/{totalAdorationHoursCommitted}h</div>
              <div className="text-[10px] text-white/50 mt-0.5">{totalAdorationSlotsCompleted}/{totalAdorationSlotsCommitted} 30m slots</div>
            </div>

            <div className="p-4 rounded-2xl bg-white/5 border border-purple-500/20 backdrop-blur-xl">
              <div className="text-[10px] text-purple-300 font-semibold uppercase tracking-wider">Rosaries & Chaplets</div>
              <div className="font-poster text-2xl sm:text-3xl text-pink-400 mt-1">{totalRosariesCompleted + totalChapletsCompleted}/{totalRosariesCommitted + totalChapletsCommitted}</div>
              <div className="text-[10px] text-white/50 mt-0.5">{totalRosariesCompleted} Rosary / {totalChapletsCompleted} Chaplet</div>
            </div>

            <div className="p-4 rounded-2xl bg-white/5 border border-purple-500/20 backdrop-blur-xl">
              <div className="text-[10px] text-purple-300 font-semibold uppercase tracking-wider">Fasting & Short Prayers</div>
              <div className="font-poster text-2xl sm:text-3xl text-cyan-300 mt-1">{totalFastingCompleted + totalShortPrayersCompleted}/{totalFastingCommitted + totalShortPrayersCommitted}</div>
              <div className="text-[10px] text-white/50 mt-0.5">Meals, Meat & Short Prayers</div>
            </div>
          </div>

          {/* Filter & Search Bar */}
          <div className="bg-[#170a1f] p-4 rounded-2xl border border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by name, email, phone..."
                value={intercessionSearchQuery || ''}
                onChange={(e) => setIntercessionSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-purple-400 font-medium"
              />
            </div>

            <div className="flex items-center space-x-3 w-full sm:w-auto">
              <span className="text-xs text-white/60 font-medium shrink-0 flex items-center space-x-1">
                <Filter className="w-3.5 h-3.5 text-purple-400" />
                <span>Filter:</span>
              </span>
              <select
                value={intercessionFilter}
                onChange={(e: any) => setIntercessionFilter(e.target.value)}
                className="px-3 py-2 text-xs rounded-xl bg-white/10 border border-white/15 text-white font-medium focus:outline-none focus:ring-2 focus:ring-purple-400 cursor-pointer w-full sm:w-auto"
              >
                <option value="all" className="bg-[#1C0D1E]">All Pledges ({intercessionsList.length})</option>
                <option value="completed_100" className="bg-[#1C0D1E]">🎉 Fully Completed ({fullyCompletedCount})</option>
                <option value="in_progress" className="bg-[#1C0D1E]">⏳ In Progress ({inProgressCount})</option>
                <option value="not_started" className="bg-[#1C0D1E]">💤 Not Started ({intercessionsList.length - fullyCompletedCount - inProgressCount})</option>
                <option value="mass" className="bg-[#1C0D1E]">Holy Mass</option>
                <option value="adoration" className="bg-[#1C0D1E]">Adoration Hours</option>
                <option value="rosary" className="bg-[#1C0D1E]">Rosaries & Decades</option>
                <option value="divineMercy" className="bg-[#1C0D1E]">Divine Mercy Chaplet</option>
                <option value="fasting" className="bg-[#1C0D1E]">Fasting & Meat Abstinence</option>
                <option value="shortPrayers" className="bg-[#1C0D1E]">Short Prayers</option>
              </select>
            </div>
          </div>

          {/* Intercession Registrations Table */}
          <div className="bg-[#170a1f] border border-white/15 rounded-2xl overflow-hidden shadow-2xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-white/80">
                <thead className="bg-white/10 text-white font-bold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="p-4 w-12 text-center">#</th>
                    <th className="p-4">Participant & Date</th>
                    <th className="p-4">Contact Details</th>
                    <th className="p-4">Spiritual Bouquet Pledged</th>
                    <th className="p-4">Intercession Progress</th>
                    <th className="p-4 text-center w-40">Last Reminder Sent</th>
                    <th className="p-4 text-center w-64">Actions & Reminders</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {filteredIntercessions.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-white/50 text-xs">
                        {intercessionsList.length === 0 
                          ? "No spiritual bouquet commitments registered yet."
                          : "No intercession commitments matching search criteria."}
                      </td>
                    </tr>
                  ) : (
                    filteredIntercessions.map((rec, index) => {
                      const summaryText = formatCommitmentsSummary(rec);

                      return (
                        <tr key={rec.id || index} className="hover:bg-white/5 transition-colors">
                          <td className="p-4 text-center font-mono text-white/40">{index + 1}</td>
                          <td className="p-4">
                            <div className="font-bold text-white text-sm">{rec.name || 'Anonymous Prayer Warrior'}</div>
                            <div className="text-[11px] text-white/50 font-mono mt-0.5 flex items-center space-x-1">
                              <Clock className="w-3 h-3 text-purple-400" />
                              <span>{rec.createdAt ? new Date(rec.createdAt).toLocaleString() : 'N/A'}</span>
                            </div>
                          </td>
                          <td className="p-4 space-y-1">
                            {rec.email ? (
                              <div className="font-mono text-amber-300 text-xs flex items-center space-x-1">
                                <Mail className="w-3 h-3 text-amber-400 shrink-0" />
                                <span className="truncate max-w-[180px]">{rec.email}</span>
                              </div>
                            ) : (
                              <span className="text-white/40 text-[11px] italic">No email provided</span>
                            )}
                            {rec.phone ? (
                              <div className="font-mono text-emerald-300 text-xs flex items-center space-x-1">
                                <Phone className="w-3 h-3 text-emerald-400 shrink-0" />
                                <span>{rec.phone}</span>
                              </div>
                            ) : (
                              <span className="text-white/40 text-[11px] italic block">No phone provided</span>
                            )}
                          </td>
                          <td className="p-4">
                            <div className="flex flex-wrap gap-1.5 max-w-xs">
                              {rec.holyMass ? (
                                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-semibold text-[11px]">
                                  ✝️ {rec.holyMass} Mass(es)
                                </span>
                              ) : null}

                              {rec.adoration ? (
                                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 font-semibold text-[11px]">
                                  🕯️ {Math.floor(rec.adoration / 2)} Adoration hr(s)
                                </span>
                              ) : null}

                              {rec.rosary ? (
                                <span className="px-2 py-0.5 rounded-full bg-pink-500/20 border border-pink-500/40 text-pink-300 font-semibold text-[11px]">
                                  🌹 {rec.rosary} Rosary(ies)
                                </span>
                              ) : null}

                              {rec.decadeRosary ? (
                                <span className="px-2 py-0.5 rounded-full bg-purple-500/20 border border-purple-500/40 text-purple-300 font-semibold text-[11px]">
                                  📿 {rec.decadeRosary} Decade(s)
                                </span>
                              ) : null}

                              {rec.divineMercy ? (
                                <span className="px-2 py-0.5 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-300 font-semibold text-[11px]">
                                  ❤️ {rec.divineMercy} Divine Mercy
                                </span>
                              ) : null}

                              {rec.fastMeal ? (
                                <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 font-semibold text-[11px]">
                                  🥖 {rec.fastMeal} Fast Meal(s)
                                </span>
                              ) : null}

                              {rec.abstainMeat ? (
                                <span className="px-2 py-0.5 rounded-full bg-blue-500/20 border border-blue-500/40 text-blue-300 font-semibold text-[11px]">
                                  🐟 {rec.abstainMeat} Abstain Day(s)
                                </span>
                              ) : null}

                              {rec.shortPrayers ? (
                                <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 font-semibold text-[11px]">
                                  🙏 {rec.shortPrayers} Short Prayer(s)
                                </span>
                              ) : null}
                            </div>
                            <p className="text-[11px] text-white/50 italic mt-1 truncate max-w-xs">
                              "{summaryText}"
                            </p>
                          </td>

                          {/* Intercession Progress Column */}
                          <td className="p-4 min-w-[210px]">
                            {(() => {
                              const pledged = (rec.holyMass||0) + (rec.adoration||0) + (rec.rosary||0) + (rec.decadeRosary||0) + (rec.divineMercy||0) + (rec.fastMeal||0) + (rec.abstainMeat||0) + (rec.shortPrayers||0);
                              const done = (rec.completedHolyMass||0) + (rec.completedAdoration||0) + (rec.completedRosary||0) + (rec.completedDecadeRosary||0) + (rec.completedDivineMercy||0) + (rec.completedFastMeal||0) + (rec.completedAbstainMeat||0) + (rec.completedShortPrayers||0);
                              const pct = pledged > 0 ? Math.min(100, Math.round((done / pledged) * 100)) : 0;

                              return (
                                <div className="space-y-1.5">
                                  <div className="flex items-center justify-between gap-1.5">
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border inline-flex items-center gap-1 ${
                                      pct === 100 
                                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' 
                                        : pct > 0 
                                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' 
                                        : 'bg-white/5 text-white/40 border-white/10'
                                    }`}>
                                      {pct === 100 ? (
                                        <>
                                          <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                                          <span>100% Completed</span>
                                        </>
                                      ) : pct > 0 ? (
                                        <>
                                          <TrendingUp className="w-3 h-3 text-amber-400 shrink-0" />
                                          <span>{pct}% In Progress</span>
                                        </>
                                      ) : (
                                        <span>0% Not Started</span>
                                      )}
                                    </span>
                                    <span className="font-mono text-[10px] text-white/60 font-semibold">
                                      {done} / {pledged}
                                    </span>
                                  </div>

                                  {/* Progress bar */}
                                  <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden">
                                    <div 
                                      className={`h-full rounded-full transition-all duration-300 ${
                                        pct === 100 
                                          ? 'bg-gradient-to-r from-emerald-500 to-teal-400' 
                                          : pct > 0 
                                          ? 'bg-gradient-to-r from-amber-500 to-yellow-300' 
                                          : 'bg-white/20'
                                      }`} 
                                      style={{ width: `${pct}%` }} 
                                    />
                                  </div>

                                  {/* Itemized Completed vs Committed Pills */}
                                  <div className="flex flex-wrap gap-1 pt-1">
                                    {rec.holyMass ? (
                                      <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-[10px] font-mono text-emerald-300">
                                        ✝️ {rec.completedHolyMass || 0}/{rec.holyMass}
                                      </span>
                                    ) : null}
                                    {rec.adoration ? (
                                      <span className="px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-[10px] font-mono text-amber-300">
                                        🕯️ {rec.completedAdoration || 0}/{rec.adoration}
                                      </span>
                                    ) : null}
                                    {rec.rosary ? (
                                      <span className="px-1.5 py-0.5 rounded bg-pink-500/10 border border-pink-500/30 text-[10px] font-mono text-pink-300">
                                        🌹 {rec.completedRosary || 0}/{rec.rosary}
                                      </span>
                                    ) : null}
                                    {rec.decadeRosary ? (
                                      <span className="px-1.5 py-0.5 rounded bg-purple-500/10 border border-purple-500/30 text-[10px] font-mono text-purple-300">
                                        📿 {rec.completedDecadeRosary || 0}/{rec.decadeRosary}
                                      </span>
                                    ) : null}
                                    {rec.divineMercy ? (
                                      <span className="px-1.5 py-0.5 rounded bg-rose-500/10 border border-rose-500/30 text-[10px] font-mono text-rose-300">
                                        ❤️ {rec.completedDivineMercy || 0}/{rec.divineMercy}
                                      </span>
                                    ) : null}
                                    {rec.fastMeal ? (
                                      <span className="px-1.5 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/30 text-[10px] font-mono text-indigo-300">
                                        🥖 {rec.completedFastMeal || 0}/{rec.fastMeal}
                                      </span>
                                    ) : null}
                                    {rec.abstainMeat ? (
                                      <span className="px-1.5 py-0.5 rounded bg-blue-500/10 border border-blue-500/30 text-[10px] font-mono text-blue-300">
                                        🐟 {rec.completedAbstainMeat || 0}/{rec.abstainMeat}
                                      </span>
                                    ) : null}
                                    {rec.shortPrayers ? (
                                      <span className="px-1.5 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/30 text-[10px] font-mono text-cyan-300">
                                        🙏 {rec.completedShortPrayers || 0}/{rec.shortPrayers}
                                      </span>
                                    ) : null}
                                  </div>
                                </div>
                              );
                            })()}
                          </td>
                          <td className="p-4 text-center whitespace-nowrap">
                            {rec.lastReminderSentAt ? (
                              <div className="flex flex-col items-center justify-center space-y-1">
                                <div className="text-xs font-semibold text-purple-200 flex items-center space-x-1 justify-center">
                                  <Clock className="w-3 h-3 text-purple-400 shrink-0" />
                                  <span>{new Date(rec.lastReminderSentAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                                </div>
                                <div className="text-[10px] text-white/50 font-mono">
                                  {new Date(rec.lastReminderSentAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                                </div>
                                <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] border inline-flex items-center space-x-1 ${
                                  rec.lastReminderType === 'whatsapp'
                                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                    : rec.lastReminderType === 'batch_email'
                                    ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
                                    : 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                                }`}>
                                  <span>
                                    {rec.lastReminderType === 'whatsapp' ? '💬 WhatsApp' : rec.lastReminderType === 'batch_email' ? '✉️ Batch Email' : '📧 Email'}
                                  </span>
                                </span>
                              </div>
                            ) : (
                              <div className="flex flex-col items-center justify-center space-y-1">
                                <span className="px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-white/40 font-medium text-[10px]">
                                  Never Sent
                                </span>
                              </div>
                            )}
                          </td>
                          <td className="p-4 text-center">
                            <div className="flex flex-wrap items-center justify-center gap-1.5">
                              {/* Edit Entry Button */}
                              <button
                                onClick={() => {
                                  setEditingIntercession(rec);
                                  scrollToTop();
                                }}
                                className="px-2.5 py-1.5 rounded-xl bg-blue-600/30 hover:bg-blue-600/50 border border-blue-400/50 text-blue-300 font-bold text-[11px] cursor-pointer transition-all flex items-center space-x-1"
                                title="Edit Intercession Entry"
                              >
                                <Edit className="w-3.5 h-3.5 text-blue-300" />
                                <span>Edit</span>
                              </button>

                              {/* Delete Entry Button */}
                              <button
                                onClick={() => setIntercessionDeleteTarget(rec)}
                                className="px-2.5 py-1.5 rounded-xl bg-red-600/30 hover:bg-red-600/50 border border-red-400/50 text-red-300 font-bold text-[11px] cursor-pointer transition-all flex items-center space-x-1"
                                title="Delete Intercession Entry"
                              >
                                <Trash2 className="w-3.5 h-3.5 text-red-300" />
                                <span>Delete</span>
                              </button>

                              {/* WhatsApp Reminder Button */}
                              {rec.phone ? (
                                <button
                                  onClick={() => openWhatsAppReminder(rec)}
                                  className="px-2.5 py-1.5 rounded-xl bg-emerald-600/30 hover:bg-emerald-600/50 border border-emerald-500/50 text-emerald-300 font-bold text-[11px] cursor-pointer transition-all flex items-center space-x-1"
                                  title="Send WhatsApp Reminder"
                                >
                                  <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />
                                  <span>WhatsApp</span>
                                </button>
                              ) : null}

                              {/* Email Reminder Button */}
                              {rec.email ? (
                                <button
                                  onClick={() => openIntercessionEmailModal(rec)}
                                  className="px-2.5 py-1.5 rounded-xl bg-purple-600/30 hover:bg-purple-600/50 border border-purple-400/50 text-purple-300 font-bold text-[11px] cursor-pointer transition-all flex items-center space-x-1"
                                  title="Send Email Reminder from jysg25@gmail.com"
                                >
                                  <Mail className="w-3.5 h-3.5 text-purple-300" />
                                  <span>Email</span>
                                </button>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB: JUBILEE PASS ID BIBLE VERSES MANAGER */}
      {adminTab === 'verses' && (
        <div className="space-y-6 animate-fade-in">
          <BibleVersesManager
            adminEmail={user?.email || 'admin@jesusyouth.sg'}
            isSuperAdmin={isSuperAdmin}
            registrations={registrations}
            onUpdateRegistration={async (id, patch) => {
              const success = await updateRegistrationInFirestore(id, patch);
              if (success) {
                setRegistrations(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r));
              }
              return success;
            }}
            onBackToHome={() => setAdminTab('home')}
          />
        </div>
      )}

      {/* MODAL 1: SINGLE ROW EMAIL REMINDER CONFIRMATION */}
      {singleReminderModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 animate-fade-in overflow-y-auto">
          <div className="bg-[#1C0D1E] border-2 border-purple-500/60 rounded-3xl max-w-2xl w-full p-6 sm:p-7 shadow-2xl space-y-5 text-white relative my-auto">
            <button
              type="button"
              onClick={() => setSingleReminderModal(null)}
              className="absolute top-4 right-4 p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-colors cursor-pointer"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-3">
              <div className="p-3 bg-purple-500/20 border border-purple-400/40 rounded-xl shrink-0">
                <Mail className="w-6 h-6 text-purple-400" />
              </div>
              <div>
                <h3 className="font-poster text-xl text-white">CONFIRM EMAIL REMINDER DISPATCH</h3>
                <p className="text-xs text-amber-300 font-mono">
                  Sender: jysg25@gmail.com &bull; Target: {singleReminderModal.email}
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-purple-950/40 border border-purple-500/30 text-xs space-y-2">
              <div className="font-bold text-purple-200">Recipient: {singleReminderModal.name || 'Prayer Warrior'}</div>
              <div>
                <span className="text-purple-300 font-semibold block mb-1.5">Committed Spiritual Bouquet:</span>
                <div className="space-y-1.5 pl-0.5">
                  {formatCommitmentsSummary(singleReminderModal).split(/,\s*/).map((item, idx) => (
                    <div key={idx} className="flex items-center space-x-2 text-white bg-white/5 border border-purple-400/20 px-3 py-1.5 rounded-lg text-xs font-medium">
                      <span className="text-sm shrink-0">{getCommitmentIcon(item)}</span>
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold mb-1 text-white/80">Email Subject Line:</label>
                <input
                  type="text"
                  value={intercessionEmailSubject}
                  onChange={(e) => setIntercessionEmailSubject(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-white/10 border border-white/20 text-white font-medium focus:outline-none focus:ring-2 focus:ring-purple-400"
                />
              </div>

              <div>
                <label className="block font-bold mb-1 text-white/80">Message Body Draft:</label>
                <textarea
                  rows={8}
                  value={intercessionEmailBody}
                  onChange={(e) => setIntercessionEmailBody(e.target.value)}
                  className="w-full p-3 rounded-xl bg-white/10 border border-white/20 text-white font-sans text-xs focus:outline-none focus:ring-2 focus:ring-purple-400 leading-relaxed"
                />
              </div>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-3 border-t border-white/10">
              <button
                type="button"
                onClick={() => setSingleReminderModal(null)}
                disabled={isSendingReminderEmail}
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSendIntercessionEmail}
                disabled={isSendingReminderEmail}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:brightness-110 text-white font-bold text-xs shadow-lg cursor-pointer transition-all flex items-center space-x-2 disabled:opacity-50"
              >
                {isSendingReminderEmail ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-white" />
                    <span>Sending Email...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 text-white" />
                    <span>Confirm & Send Email (from jysg25@gmail.com)</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: BULK EMAIL REMINDER TO ALL COMMITTED PARTICIPANTS */}
      {showBulkEmailModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 animate-fade-in overflow-y-auto">
          <div className="bg-[#1C0D1E] border-2 border-purple-500/60 rounded-3xl max-w-2xl w-full p-6 sm:p-7 shadow-2xl space-y-5 text-white relative my-auto">
            <button
              type="button"
              onClick={() => setShowBulkEmailModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-colors cursor-pointer"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-3">
              <div className="p-3 bg-purple-500/20 border border-purple-400/40 rounded-xl shrink-0">
                <Mail className="w-6 h-6 text-purple-400" />
              </div>
              <div>
                <h3 className="font-poster text-xl text-white">BATCH EMAIL REMINDER TO ALL COMMITTED</h3>
                <p className="text-xs text-amber-300 font-mono">
                  Sender: jysg25@gmail.com &bull; Recipients: {intercessionsList.filter(r => r.email).length} Prayer Warriors
                </p>
              </div>
            </div>

            <p className="text-xs text-white/80 leading-relaxed">
              Confirm details below before sending a reminder email to all committed intercession participants:
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold mb-1 text-white/80">Email Subject Line:</label>
                <input
                  type="text"
                  value={bulkEmailSubject}
                  onChange={(e) => setBulkEmailSubject(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-white/10 border border-white/20 text-white font-medium focus:outline-none focus:ring-2 focus:ring-purple-400"
                />
              </div>

              <div>
                <label className="block font-bold mb-1 text-white/80">Message Body Draft:</label>
                <textarea
                  rows={9}
                  value={bulkEmailBody}
                  onChange={(e) => setBulkEmailBody(e.target.value)}
                  className="w-full p-3 rounded-xl bg-white/10 border border-white/20 text-white font-sans text-xs focus:outline-none focus:ring-2 focus:ring-purple-400 leading-relaxed"
                />
              </div>
            </div>

            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-200 flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Reminder: Each email will automatically include the participant's specific spiritual bouquet commitments and the target completion date of October 10, 2026.</span>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-3 border-t border-white/10">
              <button
                type="button"
                onClick={() => setShowBulkEmailModal(false)}
                disabled={isSendingReminderEmail}
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSendBulkEmail}
                disabled={isSendingReminderEmail}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 via-pink-600 to-amber-500 hover:brightness-110 text-white font-bold text-xs shadow-lg cursor-pointer transition-all flex items-center space-x-2 disabled:opacity-50"
              >
                {isSendingReminderEmail ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-white" />
                    <span>Dispatching Batch Emails...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 text-white" />
                    <span>Confirm & Send to All ({intercessionsList.filter(r => r.email).length})</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: ADD INTERCESSION ENTRY */}
      {showAddIntercessionModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
          <div className="bg-[#1C0D1E] border-2 border-emerald-500/50 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 text-white relative my-auto">
            <button
              type="button"
              onClick={() => setShowAddIntercessionModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-3">
              <div className="p-3 bg-emerald-500/20 border border-emerald-500/40 rounded-xl shrink-0">
                <Plus className="w-6 h-6 text-emerald-400" />
              </div>
              <div>
                <h3 className="font-poster text-xl text-white">ADD SPIRITUAL BOUQUET ENTRY</h3>
                <p className="text-xs text-white/60">Manually add a new prayer warrior commitment record.</p>
              </div>
            </div>

            <form onSubmit={handleAddIntercessionSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold mb-1 text-white/80">Participant Name *</label>
                <input
                  type="text"
                  required
                  placeholder="Full Name"
                  value={newIntercessionForm.name || ''}
                  onChange={(e) => setNewIntercessionForm({ ...newIntercessionForm, name: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-emerald-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold mb-1 text-white/80">Email Address</label>
                  <input
                    type="email"
                    placeholder="email@example.com"
                    value={newIntercessionForm.email || ''}
                    onChange={(e) => setNewIntercessionForm({ ...newIntercessionForm, email: e.target.value })}
                    className="w-full p-2.5 rounded-xl bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-emerald-400 font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1 text-white/80">Phone Number</label>
                  <input
                    type="text"
                    placeholder="+65 9123 4567"
                    value={newIntercessionForm.phone || ''}
                    onChange={(e) => setNewIntercessionForm({ ...newIntercessionForm, phone: e.target.value })}
                    className="w-full p-2.5 rounded-xl bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-emerald-400 font-mono text-xs"
                  />
                </div>
              </div>

              <div className="border-t border-white/10 pt-3">
                <label className="block font-bold mb-2 text-amber-300">Spiritual Bouquet Quantities Pledged:</label>
                <div className="grid grid-cols-2 gap-2.5 max-h-56 overflow-y-auto pr-1">
                  <div>
                    <span className="text-[11px] text-white/70 block mb-1">✝️ Holy Masses</span>
                    <input
                      type="number"
                      min={0}
                      value={newIntercessionForm.holyMass || 0}
                      onChange={(e) => setNewIntercessionForm({ ...newIntercessionForm, holyMass: parseInt(e.target.value) || 0 })}
                      className="w-full p-2 rounded-lg bg-black/50 border border-white/20 text-white text-center font-bold"
                    />
                  </div>
                  <div>
                    <span className="text-[11px] text-white/70 block mb-1">🕯️ Adoration (30m slots)</span>
                    <input
                      type="number"
                      min={0}
                      value={newIntercessionForm.adoration || 0}
                      onChange={(e) => setNewIntercessionForm({ ...newIntercessionForm, adoration: parseInt(e.target.value) || 0 })}
                      className="w-full p-2 rounded-lg bg-black/50 border border-white/20 text-white text-center font-bold"
                    />
                  </div>
                  <div>
                    <span className="text-[11px] text-white/70 block mb-1">🌹 Full Rosaries</span>
                    <input
                      type="number"
                      min={0}
                      value={newIntercessionForm.rosary || 0}
                      onChange={(e) => setNewIntercessionForm({ ...newIntercessionForm, rosary: parseInt(e.target.value) || 0 })}
                      className="w-full p-2 rounded-lg bg-black/50 border border-white/20 text-white text-center font-bold"
                    />
                  </div>
                  <div>
                    <span className="text-[11px] text-white/70 block mb-1">📿 Rosary Decades</span>
                    <input
                      type="number"
                      min={0}
                      value={newIntercessionForm.decadeRosary || 0}
                      onChange={(e) => setNewIntercessionForm({ ...newIntercessionForm, decadeRosary: parseInt(e.target.value) || 0 })}
                      className="w-full p-2 rounded-lg bg-black/50 border border-white/20 text-white text-center font-bold"
                    />
                  </div>
                  <div>
                    <span className="text-[11px] text-white/70 block mb-1">❤️ Divine Mercy</span>
                    <input
                      type="number"
                      min={0}
                      value={newIntercessionForm.divineMercy || 0}
                      onChange={(e) => setNewIntercessionForm({ ...newIntercessionForm, divineMercy: parseInt(e.target.value) || 0 })}
                      className="w-full p-2 rounded-lg bg-black/50 border border-white/20 text-white text-center font-bold"
                    />
                  </div>
                  <div>
                    <span className="text-[11px] text-white/70 block mb-1">🥖 Fasting Meals</span>
                    <input
                      type="number"
                      min={0}
                      value={newIntercessionForm.fastMeal || 0}
                      onChange={(e) => setNewIntercessionForm({ ...newIntercessionForm, fastMeal: parseInt(e.target.value) || 0 })}
                      className="w-full p-2 rounded-lg bg-black/50 border border-white/20 text-white text-center font-bold"
                    />
                  </div>
                  <div>
                    <span className="text-[11px] text-white/70 block mb-1">🐟 Meat Abstain</span>
                    <input
                      type="number"
                      min={0}
                      value={newIntercessionForm.abstainMeat || 0}
                      onChange={(e) => setNewIntercessionForm({ ...newIntercessionForm, abstainMeat: parseInt(e.target.value) || 0 })}
                      className="w-full p-2 rounded-lg bg-black/50 border border-white/20 text-white text-center font-bold"
                    />
                  </div>
                  <div>
                    <span className="text-[11px] text-white/70 block mb-1">🙏 Short Prayers</span>
                    <input
                      type="number"
                      min={0}
                      value={newIntercessionForm.shortPrayers || 0}
                      onChange={(e) => setNewIntercessionForm({ ...newIntercessionForm, shortPrayers: parseInt(e.target.value) || 0 })}
                      className="w-full p-2 rounded-lg bg-black/50 border border-white/20 text-white text-center font-bold"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowAddIntercessionModal(false)}
                  className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingIntercession}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg cursor-pointer transition-all flex items-center space-x-2 disabled:opacity-50"
                >
                  {isSavingIntercession ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Add Entry</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: EDIT INTERCESSION ENTRY */}
      {editingIntercession && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
          <div className="bg-[#1C0D1E] border-2 border-blue-500/50 rounded-2xl max-w-3xl w-full p-6 sm:p-8 shadow-2xl space-y-4 text-white relative my-auto">
            <button
              type="button"
              onClick={() => setEditingIntercession(null)}
              className="absolute top-4 right-4 p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-3">
              <div className="p-3 bg-blue-500/20 border border-blue-500/40 rounded-xl shrink-0">
                <Edit className="w-6 h-6 text-blue-400" />
              </div>
              <div>
                <h3 className="font-poster text-xl text-white">EDIT SPIRITUAL BOUQUET ENTRY</h3>
                <p className="text-xs text-white/60">Modify pledged intercession details for this record.</p>
              </div>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                setIntercessionPendingEdit(editingIntercession);
              }}
              className="space-y-3.5 text-xs"
            >
              <div>
                <label className="block font-bold mb-1 text-white/80">Participant Name *</label>
                <input
                  type="text"
                  required
                  value={editingIntercession.name || ''}
                  onChange={(e) => setEditingIntercession({ ...editingIntercession, name: e.target.value })}
                  className="w-full p-2.5 rounded-xl bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold mb-1 text-white/80">Email Address</label>
                  <input
                    type="email"
                    value={editingIntercession.email || ''}
                    onChange={(e) => setEditingIntercession({ ...editingIntercession, email: e.target.value })}
                    className="w-full p-2.5 rounded-xl bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-blue-400 font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1 text-white/80">Phone Number</label>
                  <input
                    type="text"
                    value={editingIntercession.phone || ''}
                    onChange={(e) => setEditingIntercession({ ...editingIntercession, phone: e.target.value })}
                    className="w-full p-2.5 rounded-xl bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-blue-400 font-mono text-xs"
                  />
                </div>
              </div>

              <div className="border-t border-white/10 pt-3">
                <label className="block font-bold mb-2 text-amber-300">Spiritual Bouquet Quantities Pledged & Completed Log:</label>
                <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                  <div className="grid grid-cols-2 gap-2 bg-white/5 p-2.5 rounded-xl border border-white/10">
                    <div>
                      <span className="text-[11px] text-emerald-300 font-semibold block mb-1">✝️ Holy Masses Pledged</span>
                      <input
                        type="number"
                        min={0}
                        value={editingIntercession.holyMass || 0}
                        onChange={(e) => setEditingIntercession({ ...editingIntercession, holyMass: parseInt(e.target.value) || 0 })}
                        className="w-full p-2 rounded-lg bg-black/50 border border-white/20 text-white text-center font-bold"
                      />
                    </div>
                    <div>
                      <span className="text-[11px] text-emerald-400 font-semibold block mb-1">✝️ Masses Completed</span>
                      <input
                        type="number"
                        min={0}
                        value={editingIntercession.completedHolyMass || 0}
                        onChange={(e) => setEditingIntercession({ ...editingIntercession, completedHolyMass: parseInt(e.target.value) || 0 })}
                        className="w-full p-2 rounded-lg bg-emerald-950/60 border border-emerald-500/40 text-emerald-200 text-center font-bold"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 bg-white/5 p-2.5 rounded-xl border border-white/10">
                    <div>
                      <span className="text-[11px] text-amber-300 font-semibold block mb-1">🕯️ Adoration Slots Pledged</span>
                      <input
                        type="number"
                        min={0}
                        value={editingIntercession.adoration || 0}
                        onChange={(e) => setEditingIntercession({ ...editingIntercession, adoration: parseInt(e.target.value) || 0 })}
                        className="w-full p-2 rounded-lg bg-black/50 border border-white/20 text-white text-center font-bold"
                      />
                    </div>
                    <div>
                      <span className="text-[11px] text-amber-400 font-semibold block mb-1">🕯️ Adoration Completed</span>
                      <input
                        type="number"
                        min={0}
                        value={editingIntercession.completedAdoration || 0}
                        onChange={(e) => setEditingIntercession({ ...editingIntercession, completedAdoration: parseInt(e.target.value) || 0 })}
                        className="w-full p-2 rounded-lg bg-amber-950/60 border border-amber-500/40 text-amber-200 text-center font-bold"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 bg-white/5 p-2.5 rounded-xl border border-white/10">
                    <div>
                      <span className="text-[11px] text-pink-300 font-semibold block mb-1">🌹 Full Rosaries Pledged</span>
                      <input
                        type="number"
                        min={0}
                        value={editingIntercession.rosary || 0}
                        onChange={(e) => setEditingIntercession({ ...editingIntercession, rosary: parseInt(e.target.value) || 0 })}
                        className="w-full p-2 rounded-lg bg-black/50 border border-white/20 text-white text-center font-bold"
                      />
                    </div>
                    <div>
                      <span className="text-[11px] text-pink-400 font-semibold block mb-1">🌹 Rosaries Completed</span>
                      <input
                        type="number"
                        min={0}
                        value={editingIntercession.completedRosary || 0}
                        onChange={(e) => setEditingIntercession({ ...editingIntercession, completedRosary: parseInt(e.target.value) || 0 })}
                        className="w-full p-2 rounded-lg bg-pink-950/60 border border-pink-500/40 text-pink-200 text-center font-bold"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 bg-white/5 p-2.5 rounded-xl border border-white/10">
                    <div>
                      <span className="text-[11px] text-purple-300 font-semibold block mb-1">📿 Rosary Decades Pledged</span>
                      <input
                        type="number"
                        min={0}
                        value={editingIntercession.decadeRosary || 0}
                        onChange={(e) => setEditingIntercession({ ...editingIntercession, decadeRosary: parseInt(e.target.value) || 0 })}
                        className="w-full p-2 rounded-lg bg-black/50 border border-white/20 text-white text-center font-bold"
                      />
                    </div>
                    <div>
                      <span className="text-[11px] text-purple-400 font-semibold block mb-1">📿 Decades Completed</span>
                      <input
                        type="number"
                        min={0}
                        value={editingIntercession.completedDecadeRosary || 0}
                        onChange={(e) => setEditingIntercession({ ...editingIntercession, completedDecadeRosary: parseInt(e.target.value) || 0 })}
                        className="w-full p-2 rounded-lg bg-purple-950/60 border border-purple-500/40 text-purple-200 text-center font-bold"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 bg-white/5 p-2.5 rounded-xl border border-white/10">
                    <div>
                      <span className="text-[11px] text-rose-300 font-semibold block mb-1">❤️ Divine Mercy Pledged</span>
                      <input
                        type="number"
                        min={0}
                        value={editingIntercession.divineMercy || 0}
                        onChange={(e) => setEditingIntercession({ ...editingIntercession, divineMercy: parseInt(e.target.value) || 0 })}
                        className="w-full p-2 rounded-lg bg-black/50 border border-white/20 text-white text-center font-bold"
                      />
                    </div>
                    <div>
                      <span className="text-[11px] text-rose-400 font-semibold block mb-1">❤️ Divine Mercy Done</span>
                      <input
                        type="number"
                        min={0}
                        value={editingIntercession.completedDivineMercy || 0}
                        onChange={(e) => setEditingIntercession({ ...editingIntercession, completedDivineMercy: parseInt(e.target.value) || 0 })}
                        className="w-full p-2 rounded-lg bg-rose-950/60 border border-rose-500/40 text-rose-200 text-center font-bold"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 bg-white/5 p-2.5 rounded-xl border border-white/10">
                    <div>
                      <span className="text-[11px] text-indigo-300 font-semibold block mb-1">🥖 Fasting Meals Pledged</span>
                      <input
                        type="number"
                        min={0}
                        value={editingIntercession.fastMeal || 0}
                        onChange={(e) => setEditingIntercession({ ...editingIntercession, fastMeal: parseInt(e.target.value) || 0 })}
                        className="w-full p-2 rounded-lg bg-black/50 border border-white/20 text-white text-center font-bold"
                      />
                    </div>
                    <div>
                      <span className="text-[11px] text-indigo-400 font-semibold block mb-1">🥖 Fasting Completed</span>
                      <input
                        type="number"
                        min={0}
                        value={editingIntercession.completedFastMeal || 0}
                        onChange={(e) => setEditingIntercession({ ...editingIntercession, completedFastMeal: parseInt(e.target.value) || 0 })}
                        className="w-full p-2 rounded-lg bg-indigo-950/60 border border-indigo-500/40 text-indigo-200 text-center font-bold"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 bg-white/5 p-2.5 rounded-xl border border-white/10">
                    <div>
                      <span className="text-[11px] text-blue-300 font-semibold block mb-1">🐟 Meat Abstain Pledged</span>
                      <input
                        type="number"
                        min={0}
                        value={editingIntercession.abstainMeat || 0}
                        onChange={(e) => setEditingIntercession({ ...editingIntercession, abstainMeat: parseInt(e.target.value) || 0 })}
                        className="w-full p-2 rounded-lg bg-black/50 border border-white/20 text-white text-center font-bold"
                      />
                    </div>
                    <div>
                      <span className="text-[11px] text-blue-400 font-semibold block mb-1">🐟 Abstain Completed</span>
                      <input
                        type="number"
                        min={0}
                        value={editingIntercession.completedAbstainMeat || 0}
                        onChange={(e) => setEditingIntercession({ ...editingIntercession, completedAbstainMeat: parseInt(e.target.value) || 0 })}
                        className="w-full p-2 rounded-lg bg-blue-950/60 border border-blue-500/40 text-blue-200 text-center font-bold"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 bg-white/5 p-2.5 rounded-xl border border-white/10">
                    <div>
                      <span className="text-[11px] text-cyan-300 font-semibold block mb-1">🙏 Short Prayers Pledged</span>
                      <input
                        type="number"
                        min={0}
                        value={editingIntercession.shortPrayers || 0}
                        onChange={(e) => setEditingIntercession({ ...editingIntercession, shortPrayers: parseInt(e.target.value) || 0 })}
                        className="w-full p-2 rounded-lg bg-black/50 border border-white/20 text-white text-center font-bold"
                      />
                    </div>
                    <div>
                      <span className="text-[11px] text-cyan-400 font-semibold block mb-1">🙏 Short Prayers Done</span>
                      <input
                        type="number"
                        min={0}
                        value={editingIntercession.completedShortPrayers || 0}
                        onChange={(e) => setEditingIntercession({ ...editingIntercession, completedShortPrayers: parseInt(e.target.value) || 0 })}
                        className="w-full p-2 rounded-lg bg-cyan-950/60 border border-cyan-500/40 text-cyan-200 text-center font-bold"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setEditingIntercession(null)}
                  className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg cursor-pointer transition-all flex items-center space-x-2"
                >
                  <Save className="w-4 h-4" />
                  <span>Review & Save...</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 5: CONFIRM EDIT INTERCESSION ENTRY */}
      {intercessionPendingEdit && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
          <div className="bg-[#1C0D1E] border-2 border-blue-500/70 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 text-white relative">
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-blue-500/20 border border-blue-400/40 rounded-xl shrink-0">
                <AlertTriangle className="w-6 h-6 text-blue-400" />
              </div>
              <div>
                <h3 className="font-poster text-lg text-white">CONFIRM CHANGES</h3>
                <p className="text-xs text-white/60">Please review and confirm your edits to this entry.</p>
              </div>
            </div>

            <div className="bg-white/5 border border-white/10 p-4 rounded-xl space-y-2 text-xs">
              <p className="text-white/80">Updating intercession entry for:</p>
              <p className="font-bold text-sm text-[#E8B400] bg-black/40 px-3 py-2 rounded-lg border border-white/10">
                {intercessionPendingEdit.name || 'Participant'}
              </p>
              <p className="text-white/70 italic text-[11px] pt-1">
                New summary: {formatCommitmentsSummary(intercessionPendingEdit)}
              </p>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setIntercessionPendingEdit(null)}
                disabled={isSavingIntercession}
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmSaveIntercessionEdit}
                disabled={isSavingIntercession}
                className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg cursor-pointer transition-all flex items-center space-x-2 disabled:opacity-50"
              >
                {isSavingIntercession ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-white" />
                    <span>Saving Changes...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4 text-white" />
                    <span>Yes, Save Changes</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 6: CONFIRM DELETE INTERCESSION ENTRY */}
      {intercessionDeleteTarget && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
          <div className="bg-[#1C0D1E] border-2 border-red-500/70 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 text-white relative">
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-red-500/20 border border-red-400/40 rounded-xl shrink-0">
                <Trash2 className="w-6 h-6 text-red-400" />
              </div>
              <div>
                <h3 className="font-poster text-lg text-white">CONFIRM DELETION</h3>
                <p className="text-xs text-red-300">This action will permanently delete the selected commitment entry.</p>
              </div>
            </div>

            <div className="bg-white/5 border border-white/10 p-4 rounded-xl space-y-2 text-xs">
              <p className="text-white/80">Are you sure you want to delete the entry for:</p>
              <p className="font-bold text-sm text-red-300 bg-black/40 px-3 py-2 rounded-lg border border-red-500/30">
                {intercessionDeleteTarget.name || 'Anonymous Participant'}
              </p>
              {intercessionDeleteTarget.email && (
                <p className="font-mono text-[11px] text-white/60">
                  Email: {intercessionDeleteTarget.email}
                </p>
              )}
              <p className="text-red-300/80 italic text-[11px] pt-1">
                ⚠️ Once deleted, this intercession entry cannot be restored.
              </p>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setIntercessionDeleteTarget(null)}
                disabled={isDeletingIntercession}
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteIntercession}
                disabled={isDeletingIntercession}
                className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs shadow-lg cursor-pointer transition-all flex items-center space-x-2 disabled:opacity-50"
              >
                {isDeletingIntercession ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-white" />
                    <span>Deleting Entry...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4 text-white" />
                    <span>Yes, Delete Entry</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ROLE SELECTION POPUP MODAL */}
      {roleModalTarget && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 animate-fade-in overflow-y-auto">
          <div className="bg-[#1C0D1E] border-2 border-[#E8752C]/60 rounded-3xl max-w-3xl w-full p-6 sm:p-7 shadow-2xl space-y-5 text-white relative my-auto max-h-[90vh] overflow-y-auto flex flex-col justify-between">
            <button
              type="button"
              onClick={() => setRoleModalTarget(null)}
              className="absolute top-4 right-4 p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-colors cursor-pointer"
              title="Close"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-[#E8752C]/20 border border-[#E8752C]/40 rounded-xl shrink-0">
                <Shield className="w-6 h-6 text-[#E8752C]" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-poster text-xl text-white">SELECT ORGANIZER ROLE</h3>
                <p className="text-xs text-[#E8B400] font-mono truncate">
                  {roleModalTarget.email}
                </p>
              </div>
            </div>

            <p className="text-xs text-white/80 leading-relaxed">
              Choose the access role to assign for this organizer email address:
            </p>

            {/* Role Radio Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {/* Option 1: Full Admin */}
              <div 
                onClick={() => setSelectedRoleToAssign('full_admin')}
                className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all flex items-start space-x-3 ${
                  selectedRoleToAssign === 'full_admin'
                    ? 'bg-purple-900/40 border-purple-400 shadow-lg ring-1 ring-purple-400'
                    : 'bg-white/5 border-white/10 hover:border-white/25'
                }`}
              >
                <input 
                  type="radio" 
                  name="admin_role_select" 
                  checked={selectedRoleToAssign === 'full_admin'} 
                  onChange={() => setSelectedRoleToAssign('full_admin')}
                  className="mt-1 accent-purple-400 w-4 h-4 cursor-pointer shrink-0"
                />
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center space-x-2 font-bold text-sm text-purple-200">
                    <Shield className="w-4 h-4 text-purple-400 shrink-0" />
                    <span className="truncate">Full Admin (All Features)</span>
                  </div>
                  <p className="text-[11px] text-white/70 leading-relaxed">
                    Full access to all tabs: Inbox, Registrations, Admin Allow-List management, and Content Manager.
                  </p>
                </div>
              </div>

              {/* Option 2: Admin (Main) */}
              <div 
                onClick={() => setSelectedRoleToAssign('admin')}
                className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all flex items-start space-x-3 ${
                  selectedRoleToAssign === 'admin'
                    ? 'bg-emerald-900/40 border-emerald-400 shadow-lg ring-1 ring-emerald-400'
                    : 'bg-white/5 border-white/10 hover:border-white/25'
                }`}
              >
                <input 
                  type="radio" 
                  name="admin_role_select" 
                  checked={selectedRoleToAssign === 'admin'} 
                  onChange={() => setSelectedRoleToAssign('admin')}
                  className="mt-1 accent-emerald-400 w-4 h-4 cursor-pointer shrink-0"
                />
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center space-x-2 font-bold text-sm text-emerald-300">
                    <UserCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span className="truncate">Admin (Main)</span>
                  </div>
                  <p className="text-[11px] text-white/70 leading-relaxed">
                    Main organizer role. Access to Inbox / Messages, Registrations list, and Content Manager. Excludes Admin Allow-List.
                  </p>
                </div>
              </div>

              {/* Option 3: Support Admin */}
              <div 
                onClick={() => setSelectedRoleToAssign('support_admin')}
                className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all flex items-start space-x-3 ${
                  selectedRoleToAssign === 'support_admin'
                    ? 'bg-[#E8752C]/25 border-[#E8752C] shadow-lg ring-1 ring-[#E8752C]'
                    : 'bg-white/5 border-white/10 hover:border-white/25'
                }`}
              >
                <input 
                  type="radio" 
                  name="admin_role_select" 
                  checked={selectedRoleToAssign === 'support_admin'} 
                  onChange={() => setSelectedRoleToAssign('support_admin')}
                  className="mt-1 accent-[#E8752C] w-4 h-4 cursor-pointer shrink-0"
                />
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center space-x-2 font-bold text-sm text-[#E8752C]">
                    <Inbox className="w-4 h-4 text-[#E8752C] shrink-0" />
                    <span className="truncate">Communications & Support</span>
                  </div>
                  <p className="text-[11px] text-white/70 leading-relaxed">
                    Dedicated inquiry support role. Access to Inbox / Contact Messages and Registrations list.
                  </p>
                </div>
              </div>

              {/* Option 4: Content Admin */}
              <div 
                onClick={() => setSelectedRoleToAssign('content_admin')}
                className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all flex items-start space-x-3 ${
                  selectedRoleToAssign === 'content_admin'
                    ? 'bg-amber-500/25 border-amber-400 shadow-lg ring-1 ring-amber-400'
                    : 'bg-white/5 border-white/10 hover:border-white/25'
                }`}
              >
                <input 
                  type="radio" 
                  name="admin_role_select" 
                  checked={selectedRoleToAssign === 'content_admin'} 
                  onChange={() => setSelectedRoleToAssign('content_admin')}
                  className="mt-1 accent-amber-400 w-4 h-4 cursor-pointer shrink-0"
                />
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center space-x-2 font-bold text-sm text-amber-300">
                    <Edit className="w-4 h-4 text-amber-400 shrink-0" />
                    <span className="truncate">Content Admin</span>
                  </div>
                  <p className="text-[11px] text-white/70 leading-relaxed">
                    Restricted access. Can ONLY view and edit Jubilee Memories Timeline and site content under Content Manager.
                  </p>
                </div>
              </div>

              {/* Option 5: Ticket Admin */}
              <div 
                onClick={() => setSelectedRoleToAssign('ticket_admin')}
                className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all flex items-start space-x-3 ${
                  selectedRoleToAssign === 'ticket_admin'
                    ? 'bg-pink-500/25 border-pink-400 shadow-lg ring-1 ring-pink-400'
                    : 'bg-white/5 border-white/10 hover:border-white/25'
                }`}
              >
                <input 
                  type="radio" 
                  name="admin_role_select" 
                  checked={selectedRoleToAssign === 'ticket_admin'} 
                  onChange={() => setSelectedRoleToAssign('ticket_admin')}
                  className="mt-1 accent-pink-400 w-4 h-4 cursor-pointer shrink-0"
                />
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center space-x-2 font-bold text-sm text-pink-300">
                    <Ticket className="w-4 h-4 text-pink-400 shrink-0" />
                    <span className="truncate">Ticket Admin (Check-In & Scanner Only)</span>
                  </div>
                  <p className="text-[11px] text-white/70 leading-relaxed">
                    Restricted access. Can ONLY see registered names, assigned seats, and scan QR codes to mark attendance.
                  </p>
                </div>
              </div>

              {/* Option 6: Intercession Coordinator */}
              <div 
                onClick={() => setSelectedRoleToAssign('intercession_coordinator')}
                className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all flex items-start space-x-3 ${
                  selectedRoleToAssign === 'intercession_coordinator'
                    ? 'bg-purple-600/30 border-purple-400 shadow-lg ring-1 ring-purple-400'
                    : 'bg-white/5 border-white/10 hover:border-white/25'
                }`}
              >
                <input 
                  type="radio" 
                  name="admin_role_select" 
                  checked={selectedRoleToAssign === 'intercession_coordinator'} 
                  onChange={() => setSelectedRoleToAssign('intercession_coordinator')}
                  className="mt-1 accent-purple-400 w-4 h-4 cursor-pointer shrink-0"
                />
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center space-x-2 font-bold text-sm text-purple-300">
                    <HeartHandshake className="w-4 h-4 text-purple-400 shrink-0" />
                    <span className="truncate">Intercession Coordinator</span>
                  </div>
                  <p className="text-[11px] text-white/70 leading-relaxed">
                    Access to view all spiritual bouquet commitments, send individual/bulk email reminders, and dispatch WhatsApp reminders.
                  </p>
                </div>
              </div>

              {/* Option 7: Invitation Admin */}
              <div 
                onClick={() => setSelectedRoleToAssign('invitation_admin')}
                className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all flex items-start space-x-3 md:col-span-2 ${
                  selectedRoleToAssign === 'invitation_admin'
                    ? 'bg-amber-600/30 border-amber-400 shadow-lg ring-1 ring-amber-400'
                    : 'bg-white/5 border-white/10 hover:border-white/25'
                }`}
              >
                <input 
                  type="radio" 
                  name="admin_role_select" 
                  checked={selectedRoleToAssign === 'invitation_admin'} 
                  onChange={() => setSelectedRoleToAssign('invitation_admin')}
                  className="mt-1 accent-amber-400 w-4 h-4 cursor-pointer shrink-0"
                />
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex items-center space-x-2 font-bold text-sm text-amber-300">
                    <Mail className="w-4 h-4 text-amber-400 shrink-0" />
                    <span className="truncate">Invitation Admin (Custom Sub-Roles)</span>
                  </div>
                  <p className="text-[11px] text-white/70 leading-relaxed">
                    Access to Invitations Tab. Click to popup and assign multiple specific invitation roles (Main, Public, Parish, JY Coordinators, Inactive JYs).
                  </p>
                </div>
              </div>
            </div>

            {/* INVITATION SUB-ROLES POPUP ASSIGNMENT WINDOW */}
            {selectedRoleToAssign === 'invitation_admin' && (
              <div className="p-5 rounded-2xl bg-gradient-to-r from-amber-950/60 via-purple-950/60 to-slate-900 border-2 border-amber-400/60 shadow-2xl space-y-4 animate-fade-in">
                <div className="flex items-center space-x-2 text-amber-300 font-bold text-sm border-b border-amber-400/30 pb-2">
                  <Shield className="w-5 h-5 text-amber-400" />
                  <span>CHOOSE INVITATION ADMIN SUB-ROLES (MULTIPLE ALLOWED)</span>
                </div>
                <p className="text-xs text-white/80 leading-relaxed">
                  Select all invitation sub-roles to assign to this organizer:
                </p>

                <div className="space-y-2.5">
                  {/* Sub-Role 1: Invitation Main Admin */}
                  <label className="flex items-start space-x-3 p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={selectedInvitationSubRoles.includes('invitation_main_admin')}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedInvitationSubRoles([...selectedInvitationSubRoles, 'invitation_main_admin']);
                        } else {
                          setSelectedInvitationSubRoles(selectedInvitationSubRoles.filter(r => r !== 'invitation_main_admin'));
                        }
                      }}
                      className="mt-0.5 accent-amber-400 w-4 h-4 cursor-pointer shrink-0"
                    />
                    <div>
                      <span className="font-bold text-xs text-amber-300 block">1. Invitations Lead</span>
                      <span className="text-[11px] text-white/70 leading-tight block">
                        Full invitation access: manage invitation categories, settings, sub-admin allow-lists, and toggle contact privacy within the Invitations section.
                      </span>
                    </div>
                  </label>

                  {/* Sub-Role 2: Public Invitation Admin */}
                  <label className="flex items-start space-x-3 p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={selectedInvitationSubRoles.includes('public_invitation_admin')}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedInvitationSubRoles([...selectedInvitationSubRoles, 'public_invitation_admin']);
                        } else {
                          setSelectedInvitationSubRoles(selectedInvitationSubRoles.filter(r => r !== 'public_invitation_admin'));
                        }
                      }}
                      className="mt-0.5 accent-amber-400 w-4 h-4 cursor-pointer shrink-0"
                    />
                    <div>
                      <span className="font-bold text-xs text-amber-300 block">2. Public Invitation Admin</span>
                      <span className="text-[11px] text-white/70 leading-tight block">
                        View, add, edit, delete & intelligent search for Church secretaries, parish coordinators, catechism coordinators, parish priests, and other VIP Guests & Priests.
                      </span>
                    </div>
                  </label>

                  {/* Sub-Role 3: Parish Invitation Admin */}
                  <label className="flex items-start space-x-3 p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={selectedInvitationSubRoles.includes('parish_invitation_admin')}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedInvitationSubRoles([...selectedInvitationSubRoles, 'parish_invitation_admin']);
                        } else {
                          setSelectedInvitationSubRoles(selectedInvitationSubRoles.filter(r => r !== 'parish_invitation_admin'));
                        }
                      }}
                      className="mt-0.5 accent-amber-400 w-4 h-4 cursor-pointer shrink-0"
                    />
                    <div>
                      <span className="font-bold text-xs text-amber-300 block">3. Parish Invitation Admin</span>
                      <span className="text-[11px] text-white/70 leading-tight block">
                        View, add, edit, delete & intelligent search for Church secretaries, parish coordinators, catechism coordinators, and parish priests.
                      </span>
                    </div>
                  </label>

                  {/* Sub-Role 4: JY Coordinators */}
                  <label className="flex items-start space-x-3 p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={selectedInvitationSubRoles.includes('jy_coordinators')}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedInvitationSubRoles([...selectedInvitationSubRoles, 'jy_coordinators']);
                        } else {
                          setSelectedInvitationSubRoles(selectedInvitationSubRoles.filter(r => r !== 'jy_coordinators'));
                        }
                      }}
                      className="mt-0.5 accent-amber-400 w-4 h-4 cursor-pointer shrink-0"
                    />
                    <div>
                      <span className="font-bold text-xs text-amber-300 block">4. JY Coordinators</span>
                      <span className="text-[11px] text-white/70 leading-tight block">
                        View, add, edit, delete ministry and teams members and update the status of conference and concert registration.
                      </span>
                    </div>
                  </label>

                  {/* Sub-Role 5: Inactive JYs Admin */}
                  <label className="flex items-start space-x-3 p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={selectedInvitationSubRoles.includes('inactive_jys_admin')}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedInvitationSubRoles([...selectedInvitationSubRoles, 'inactive_jys_admin']);
                        } else {
                          setSelectedInvitationSubRoles(selectedInvitationSubRoles.filter(r => r !== 'inactive_jys_admin'));
                        }
                      }}
                      className="mt-0.5 accent-amber-400 w-4 h-4 cursor-pointer shrink-0"
                    />
                    <div>
                      <span className="font-bold text-xs text-amber-300 block">5. Inactive JYs Admin</span>
                      <span className="text-[11px] text-white/70 leading-tight block">
                        View, add, edit, delete list of all JYs who were once active and are now inactive.
                      </span>
                    </div>
                  </label>
                </div>
              </div>
            )}

            <div className="flex items-center justify-end space-x-3 pt-3 border-t border-white/10">
              <button
                type="button"
                onClick={() => setRoleModalTarget(null)}
                disabled={isSubmittingRole}
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmRoleAssignment}
                disabled={isSubmittingRole}
                className="px-5 py-2.5 rounded-xl bg-signature-gradient text-white font-bold text-xs shadow-lg cursor-pointer transition-all hover:brightness-110 flex items-center space-x-1.5 disabled:opacity-50"
              >
                {isSubmittingRole ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Saving Role...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    <span>Confirm & Approve Access</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Google App Password Guide Modal */}
      {showSmtpGuide && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#1e0e29] border border-white/20 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 animate-scale-up">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center space-x-2">
                <Key className="w-5 h-5 text-[#E8B400]" />
                <h3 className="font-poster text-xl text-white">Google App Password Setup Guide</h3>
              </div>
              <button 
                onClick={() => setShowSmtpGuide(false)} 
                className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-colors cursor-pointer"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-white/80 leading-relaxed">
              To allow GRACIA Admin Portal to dispatch background automated emails directly from <strong>jysg25@jesusyouth.org</strong> via Google SMTP:
            </p>

            <ol className="list-decimal list-inside text-xs text-white/90 space-y-2.5 font-medium bg-black/40 p-4 rounded-xl border border-white/10">
              <li>Log in to Google Account with <strong>jysg25@jesusyouth.org</strong></li>
              <li>Go to <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer" className="text-amber-300 underline">myaccount.google.com/apppasswords</a></li>
              <li>Under <i>App Passwords</i>, create a new entry named <code className="bg-white/10 px-1.5 py-0.5 rounded text-amber-200">GRACIA Email Dispatch</code></li>
              <li>Copy the generated <strong>16-character App Password</strong> (e.g. <code className="text-emerald-300">xxxx xxxx xxxx xxxx</code>)</li>
              <li>In AI Studio app Settings -&gt; Secrets, set environment variable <code className="text-amber-200">SMTP_PASS</code> to this 16-character string.</li>
            </ol>

            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-[11px] text-emerald-300">
              <strong>Instant Fallback Available:</strong> Even without SMTP configured, clicking "Launch Mail Client" will open your email app pre-filled with the exact message recipient and body!
            </div>

            <div className="flex items-center justify-end pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={() => setShowSmtpGuide(false)}
                className="px-5 py-2.5 rounded-xl bg-signature-gradient text-white font-bold text-xs shadow-lg cursor-pointer hover:brightness-110"
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}

      {/* HTML EMAIL RECIPIENT PREVIEW MODAL */}
      {showEmailPreviewModal && selectedMessage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
          <div className="bg-[#1c0d28] border border-white/20 rounded-2xl max-w-2xl w-full p-6 relative text-white shadow-2xl space-y-4">
            <button
              onClick={() => setShowEmailPreviewModal(false)}
              className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white/80 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-3 border-b border-white/10 pb-3">
              <div className="p-2.5 rounded-xl bg-[#2242A6]/20 text-[#3B82F6]">
                <Eye className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-poster text-xl tracking-wider text-white">
                  HTML EMAIL RECIPIENT PREVIEW
                </h3>
                <p className="text-xs text-[#E8B400]">
                  This is how {selectedMessage.name} ({selectedMessage.email}) will receive your email
                </p>
              </div>
            </div>

            {/* REAL-TIME HTML EMAIL PREVIEW CARD */}
            <div className="bg-slate-100 text-slate-900 rounded-2xl overflow-hidden border border-slate-300 shadow-xl max-h-[65vh] overflow-y-auto">
              
              {/* ANIMATED GRADIENT HEADER BANNER */}
              <div className="bg-gradient-to-r from-[#1A2F75] via-[#2242A6] via-purple-700 to-[#C81E6E] p-8 text-center text-white relative">
                <div className="flex justify-center mb-2.5">
                  <div className="bg-white p-1 rounded-full shadow-md border border-white/40">
                    <img 
                      src="/jysg_logo.png" 
                      alt="Jesus Youth Logo" 
                      className="w-10 h-10 object-contain rounded-full"
                    />
                  </div>
                </div>
                <div className="inline-block bg-white/20 border border-white/30 px-3.5 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-widest text-[#FEE685] mb-2 shadow-sm">
                  JESUS YOUTH SINGAPORE
                </div>
                <h2 className="font-poster text-3xl font-extrabold tracking-tight text-white mb-1">
                  GRACIA
                </h2>
                <p className="text-xs font-semibold text-indigo-100 tracking-wide">
                  25th Jubilee Celebration Inquiry Reply
                </p>
              </div>

              {/* COUNTDOWN BANNER */}
              <div className="bg-gradient-to-r from-amber-50 to-amber-100 border-b-2 border-amber-500 py-3 px-6 text-center">
                <p className="text-xs font-extrabold text-amber-900 tracking-wider uppercase">
                  ⏳ <span className="text-[#C81E6E]">OCTOBER 10 & 11, 2026</span>
                </p>
                <p className="text-[11px] font-semibold text-amber-800 mt-0.5">
                  GRACIA Conference & Musical Concert • Singapore
                </p>
              </div>

              {/* EMAIL BODY CONTENT */}
              <div className="p-7 space-y-4 text-sm leading-relaxed text-slate-800 bg-white">
                <div className="space-y-3">
                  <FormattedText content={replyInput} className="text-sm leading-relaxed text-slate-800" />
                </div>

                <div className="border-t border-slate-200 pt-5 mt-6 space-y-1">
                  <p className="text-xs font-semibold text-slate-600">In Christ,</p>
                  <p className="text-sm font-extrabold text-[#2242A6]">
                    {user?.displayName || user?.email?.split('@')[0] || 'Organizing Team'}
                  </p>
                  <p className="text-[11px] font-medium text-slate-500">
                    Jesus Youth Singapore GRACIA Conference Team
                  </p>
                </div>
              </div>

              {/* FOOTER WITH SOCIAL ICONS */}
              <div className="bg-slate-50 border-t border-slate-200 p-6 text-center space-y-3">
                <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                  Connect with Jesus Youth Singapore
                </p>

                <div className="flex flex-wrap items-center justify-center gap-2">
                  <a href="mailto:singapore@jesusyouth.org" target="_blank" rel="noreferrer" className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold text-xs hover:bg-emerald-100 transition-colors">
                    <Mail className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Email</span>
                  </a>
                  <a href="https://singapore.jesusyouth.org/" target="_blank" rel="noreferrer" className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-full bg-blue-50 border border-blue-200 text-blue-800 font-bold text-xs hover:bg-blue-100 transition-colors">
                    <Globe className="w-3.5 h-3.5 text-blue-600" />
                    <span>Website</span>
                  </a>
                  <a href="https://www.instagram.com/jesusyouth_singapore" target="_blank" rel="noreferrer" className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-full bg-pink-50 border border-pink-200 text-pink-800 font-bold text-xs hover:bg-pink-100 transition-colors">
                    <Instagram className="w-3.5 h-3.5 text-pink-600" />
                    <span>Instagram</span>
                  </a>
                  <a href="https://www.facebook.com/jy15sg" target="_blank" rel="noreferrer" className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-full bg-sky-50 border border-sky-200 text-sky-800 font-bold text-xs hover:bg-sky-100 transition-colors">
                    <Facebook className="w-3.5 h-3.5 text-sky-600" />
                    <span>Facebook</span>
                  </a>
                  <a href="https://www.youtube.com/@JesusYouthSingapore" target="_blank" rel="noreferrer" className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-full bg-red-50 border border-red-200 text-red-800 font-bold text-xs hover:bg-red-100 transition-colors">
                    <Youtube className="w-3.5 h-3.5 text-red-600" />
                    <span>YouTube</span>
                  </a>
                </div>

                <p className="text-[10px] text-slate-400">
                  Jesus Youth Singapore • 25th Jubilee (GRACIA)
                </p>
              </div>

            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-white/60">Ready to dispatch?</span>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setShowEmailPreviewModal(false)}
                  className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs cursor-pointer"
                >
                  Close Preview
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowEmailPreviewModal(false);
                    handleSendReply(true);
                  }}
                  disabled={isSendingReply || !replyInput.trim()}
                  className="px-5 py-2 rounded-xl bg-signature-gradient text-white font-bold text-xs shadow-lg hover:brightness-110 cursor-pointer flex items-center space-x-1.5"
                >
                  <Send className="w-4 h-4" />
                  <span>Send Direct Email Now</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* EDIT REGISTRATION ENTRY MODAL */}
      {editingRegistration && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
          <div className="bg-[#1c0d28] border border-white/20 rounded-2xl max-w-3xl sm:max-w-4xl w-full p-6 sm:p-8 relative text-white shadow-2xl space-y-5">
            <button
              type="button"
              onClick={() => setEditingRegistration(null)}
              className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white/80 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-3 border-b border-white/10 pb-4">
              <div className="p-2.5 rounded-xl bg-[#2242A6]/30 text-[#3B82F6]">
                <Edit className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-poster text-xl tracking-wider text-white">
                  EDIT REGISTRATION ENTRY
                </h3>
                <p className="text-xs text-white/60">
                  Update registrant details or attendee counts for Firestore records
                </p>
              </div>
            </div>

            <form onSubmit={handleSaveRegistrationEdit} className="space-y-4 text-xs">
              {/* Registration Type */}
              <div>
                <label className="block text-white/70 font-semibold mb-1.5 uppercase tracking-wider text-[10px]">
                  Registration Type
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setEditingRegistration({ ...editingRegistration, type: 'conference' })}
                    className={`p-2.5 rounded-xl border text-xs font-bold transition-all flex items-center justify-center space-x-2 cursor-pointer ${
                      editingRegistration.type === 'conference'
                        ? 'bg-[#2242A6] border-[#3B82F6] text-white shadow-lg'
                        : 'bg-white/5 border-white/15 text-white/60 hover:bg-white/10'
                    }`}
                  >
                    <span>GRACIA CONFERENCE</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingRegistration({ ...editingRegistration, type: 'musical' })}
                    className={`p-2.5 rounded-xl border text-xs font-bold transition-all flex items-center justify-center space-x-2 cursor-pointer ${
                      editingRegistration.type === 'musical'
                        ? 'bg-[#C81E6E] border-[#EC4899] text-white shadow-lg'
                        : 'bg-white/5 border-white/15 text-white/60 hover:bg-white/10'
                    }`}
                  >
                    <span>MUSICAL CONCERT</span>
                  </button>
                </div>
              </div>

              {/* Primary Participant Photo Picker */}
              <div className="flex items-center gap-4 p-3.5 rounded-2xl bg-black/40 border border-white/10">
                <div className="relative shrink-0">
                  <div className="w-14 h-14 rounded-2xl bg-black/60 border-2 border-amber-400/60 overflow-hidden flex items-center justify-center">
                    {editingRegistration.photoUrl ? (
                      <img src={editingRegistration.photoUrl} alt={editingRegistration.name} className="w-full h-full object-cover" />
                    ) : (
                      <UserIcon className="w-7 h-7 text-amber-300/60" />
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
                <div className="flex-1 min-w-0 text-xs">
                  <p className="font-bold text-amber-300 uppercase tracking-wider">Primary Registrant Photo</p>
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

              {/* Name, Email, Phone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-white/70 font-semibold mb-1">Registrant Full Name *</label>
                  <input
                    type="text"
                    required
                    value={editingRegistration.name || ''}
                    onChange={(e) => setEditingRegistration({ ...editingRegistration, name: e.target.value })}
                    className="w-full bg-black/50 border border-white/20 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#E8752C]"
                  />
                </div>

                <div>
                  <label className="block text-white/70 font-semibold mb-1">Email Address *</label>
                  <input
                    type="email"
                    required
                    value={editingRegistration.email || ''}
                    onChange={(e) => setEditingRegistration({ ...editingRegistration, email: e.target.value })}
                    className="w-full bg-black/50 border border-white/20 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#E8752C]"
                  />
                </div>

                <div>
                  <label className="block text-white/70 font-semibold mb-1">Contact Phone *</label>
                  <input
                    type="text"
                    required
                    value={editingRegistration.phone || ''}
                    onChange={(e) => setEditingRegistration({ ...editingRegistration, phone: e.target.value })}
                    className="w-full bg-black/50 border border-white/20 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#E8752C]"
                  />
                </div>
              </div>

              {/* Counts Breakdown Grid */}
              <div className="bg-white/5 border border-white/10 rounded-xl p-3 space-y-2">
                <label className="block text-[#E8B400] font-bold uppercase tracking-wider text-[10px]">
                  Attendee Numbers & Age Breakdown
                </label>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-[11px] text-white/60 mb-1">Adults (20+ yrs)</label>
                    <input
                      type="number"
                      min={0}
                      value={editingRegistration.adultsCount ?? 0}
                      onChange={(e) => {
                        const newAdults = parseInt(e.target.value) || 0;
                        const newTeens = editingRegistration.teensCount || 0;
                        const newPreteens = editingRegistration.preteensCount || 0;
                        const newChildren = editingRegistration.childrenCount || 0;
                        const newKids = editingRegistration.kidsCount || 0;
                        const newToddlers = editingRegistration.toddlersCount || 0;
                        const updatedAddons = buildExpectedAttendees(
                          newAdults, newTeens, newPreteens, newChildren,
                          editingRegistration.additionalAttendees || [],
                          newKids, newToddlers
                        );
                        let autoCat = editingRegistration.category;
                        let autoLabel = editingRegistration.categoryLabel;
                        if (newAdults === 0 && newTeens > 0) {
                          autoCat = 'teen';
                          autoLabel = 'Teen / Youth Delegate';
                        } else if (newAdults > 0) {
                          autoCat = 'adult';
                          if (!autoLabel || autoLabel.toLowerCase().includes('teen')) autoLabel = 'Adult/Youth';
                        }
                        setEditingRegistration({
                          ...editingRegistration,
                          adultsCount: newAdults,
                          category: autoCat,
                          categoryLabel: autoLabel,
                          additionalAttendees: updatedAddons
                        });
                      }}
                      className="w-full bg-black/60 border border-white/20 rounded-lg px-2.5 py-1.5 text-white font-bold focus:outline-none focus:border-[#E8752C]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-white/60 mb-1">Teens (13-19 yrs)</label>
                    <input
                      type="number"
                      min={0}
                      value={editingRegistration.teensCount || 0}
                      onChange={(e) => {
                        const newAdults = editingRegistration.adultsCount ?? 0;
                        const newTeens = parseInt(e.target.value) || 0;
                        const newPreteens = editingRegistration.preteensCount || 0;
                        const newChildren = editingRegistration.childrenCount || 0;
                        const newKids = editingRegistration.kidsCount || 0;
                        const newToddlers = editingRegistration.toddlersCount || 0;
                        const updatedAddons = buildExpectedAttendees(
                          newAdults, newTeens, newPreteens, newChildren,
                          editingRegistration.additionalAttendees || [],
                          newKids, newToddlers
                        );
                        let autoCat = editingRegistration.category;
                        let autoLabel = editingRegistration.categoryLabel;
                        if (newAdults === 0 && newTeens > 0) {
                          autoCat = 'teen';
                          autoLabel = 'Teen / Youth Delegate';
                        } else if (newAdults > 0) {
                          autoCat = 'adult';
                          if (!autoLabel || autoLabel.toLowerCase().includes('teen')) autoLabel = 'Adult/Youth';
                        }
                        setEditingRegistration({
                          ...editingRegistration,
                          teensCount: newTeens,
                          category: autoCat,
                          categoryLabel: autoLabel,
                          additionalAttendees: updatedAddons
                        });
                      }}
                      className="w-full bg-black/60 border border-white/20 rounded-lg px-2.5 py-1.5 text-white font-bold focus:outline-none focus:border-[#E8752C]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-white/60 mb-1">Pre-Teens (9-12 yrs)</label>
                    <input
                      type="number"
                      min={0}
                      value={editingRegistration.preteensCount || 0}
                      onChange={(e) => {
                        const newAdults = editingRegistration.adultsCount ?? 0;
                        const newTeens = editingRegistration.teensCount || 0;
                        const newPreteens = parseInt(e.target.value) || 0;
                        const newChildren = editingRegistration.childrenCount || 0;
                        const newKids = editingRegistration.kidsCount || 0;
                        const newToddlers = editingRegistration.toddlersCount || 0;
                        const updatedAddons = buildExpectedAttendees(
                          newAdults, newTeens, newPreteens, newChildren,
                          editingRegistration.additionalAttendees || [],
                          newKids, newToddlers
                        );
                        setEditingRegistration({
                          ...editingRegistration,
                          preteensCount: newPreteens,
                          additionalAttendees: updatedAddons
                        });
                      }}
                      className="w-full bg-black/60 border border-white/20 rounded-lg px-2.5 py-1.5 text-white font-bold focus:outline-none focus:border-[#E8752C]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-white/60 mb-1">Children (6-8 yrs)</label>
                    <input
                      type="number"
                      min={0}
                      value={editingRegistration.childrenCount || 0}
                      onChange={(e) => {
                        const newAdults = editingRegistration.adultsCount ?? 0;
                        const newTeens = editingRegistration.teensCount || 0;
                        const newPreteens = editingRegistration.preteensCount || 0;
                        const newChildren = parseInt(e.target.value) || 0;
                        const newKids = editingRegistration.kidsCount || 0;
                        const newToddlers = editingRegistration.toddlersCount || 0;
                        const updatedAddons = buildExpectedAttendees(
                          newAdults, newTeens, newPreteens, newChildren,
                          editingRegistration.additionalAttendees || [],
                          newKids, newToddlers
                        );
                        setEditingRegistration({
                          ...editingRegistration,
                          childrenCount: newChildren,
                          additionalAttendees: updatedAddons
                        });
                      }}
                      className="w-full bg-black/60 border border-white/20 rounded-lg px-2.5 py-1.5 text-white font-bold focus:outline-none focus:border-[#E8752C]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-white/60 mb-1">Kids (3-5 yrs)</label>
                    <input
                      type="number"
                      min={0}
                      value={editingRegistration.kidsCount || 0}
                      onChange={(e) => {
                        const newAdults = editingRegistration.adultsCount ?? 0;
                        const newTeens = editingRegistration.teensCount || 0;
                        const newPreteens = editingRegistration.preteensCount || 0;
                        const newChildren = editingRegistration.childrenCount || 0;
                        const newKids = parseInt(e.target.value) || 0;
                        const newToddlers = editingRegistration.toddlersCount || 0;
                        const updatedAddons = buildExpectedAttendees(
                          newAdults, newTeens, newPreteens, newChildren,
                          editingRegistration.additionalAttendees || [],
                          newKids, newToddlers
                        );
                        setEditingRegistration({
                          ...editingRegistration,
                          kidsCount: newKids,
                          additionalAttendees: updatedAddons
                        });
                      }}
                      className="w-full bg-black/60 border border-white/20 rounded-lg px-2.5 py-1.5 text-white font-bold focus:outline-none focus:border-[#E8752C]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-white/60 mb-1">Toddlers (&lt;=2 yrs)</label>
                    <input
                      type="number"
                      min={0}
                      value={editingRegistration.toddlersCount || 0}
                      onChange={(e) => {
                        const newAdults = editingRegistration.adultsCount ?? 0;
                        const newTeens = editingRegistration.teensCount || 0;
                        const newPreteens = editingRegistration.preteensCount || 0;
                        const newChildren = editingRegistration.childrenCount || 0;
                        const newKids = editingRegistration.kidsCount || 0;
                        const newToddlers = parseInt(e.target.value) || 0;
                        const updatedAddons = buildExpectedAttendees(
                          newAdults, newTeens, newPreteens, newChildren,
                          editingRegistration.additionalAttendees || [],
                          newKids, newToddlers
                        );
                        setEditingRegistration({
                          ...editingRegistration,
                          toddlersCount: newToddlers,
                          additionalAttendees: updatedAddons
                        });
                      }}
                      className="w-full bg-black/60 border border-white/20 rounded-lg px-2.5 py-1.5 text-white font-bold focus:outline-none focus:border-[#E8752C]"
                    />
                  </div>
                </div>
              </div>

              {/* Additional Attendees Photos & Info */}
              {editingRegistration.additionalAttendees && editingRegistration.additionalAttendees.length > 0 && (
                <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 space-y-3">
                  <p className="font-bold text-amber-200 text-xs">Group Members Info & Photos:</p>
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

              {/* Comments */}
              <div>
                <label className="block text-white/70 font-semibold mb-1">Dietary Requirements / Special Comments</label>
                <textarea
                  rows={2}
                  value={editingRegistration.comments || ''}
                  onChange={(e) => setEditingRegistration({ ...editingRegistration, comments: e.target.value })}
                  placeholder="e.g. Vegetarian, Wheelchair access..."
                  className="w-full bg-black/50 border border-white/20 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#E8752C]"
                />
              </div>

              {/* Musical Concert Seat Assignment */}
              {editingRegistration.type === 'musical' && (
                <div className="bg-[#C81E6E]/10 border border-[#C81E6E]/30 rounded-xl p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-[#EC4899] font-bold uppercase tracking-wider text-[11px] flex items-center space-x-1.5">
                      <Ticket className="w-4 h-4 text-[#EC4899]" />
                      <span>Musical Concert Seat Assignment</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingSeatsInput('');
                        setEditingRegistration({ ...editingRegistration, selectedSeats: [] });
                      }}
                      className="text-[10px] text-red-400 hover:text-red-300 font-semibold underline cursor-pointer"
                    >
                      Clear All Seats
                    </button>
                  </div>
                  <p className="text-[11px] text-white/70">
                    Modify assigned seats (comma-separated, e.g. <strong className="text-amber-300">A-01, A-02, B-12</strong> or <strong className="text-amber-300">Row C Seat 11</strong>):
                  </p>
                  <input
                    type="text"
                    value={
                      (editingSeatsInput !== null
                        ? editingSeatsInput
                        : (editingRegistration.selectedSeats || []).map(s => `Row ${s.split('-')[0]} Seat ${s.split('-')[1]}`).join(', ')) || ''
                    }
                    onChange={(e) => {
                      const raw = e.target.value;
                      setEditingSeatsInput(raw);
                      const parsed = raw
                        .split(',')
                        .map(str => {
                          const trimmed = str.trim();
                          if (!trimmed) return '';
                          const match = trimmed.match(/(?:row\s*)?([A-Za-z0-9]+)?(?:\s*seat\s*|\-|\s+)([0-9]+)/i);
                          if (match) {
                            const row = match[1].toUpperCase().replace(/^ROW\s*/i, '');
                            const num = match[2].padStart(2, '0');
                            return `${row}-${num}`;
                          }
                          return trimmed.toUpperCase();
                        })
                        .filter(s => s.length > 0);
                      setEditingRegistration({ ...editingRegistration, selectedSeats: parsed });
                    }}
                    placeholder="e.g. Row A Seat 01, Row A Seat 02"
                    className="w-full bg-black/60 border border-white/20 rounded-xl px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-[#C81E6E]"
                  />
                  {editingRegistration.selectedSeats && editingRegistration.selectedSeats.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      <span className="text-[10px] text-white/50 block w-full font-semibold">Parsed Active Seats ({editingRegistration.selectedSeats.length}):</span>
                      {editingRegistration.selectedSeats.map((s, idx) => (
                        <span key={`${s}-${idx}`} className="px-2 py-0.5 rounded-md bg-[#C81E6E] text-white font-mono font-bold text-[10px]">
                          Row {s.split('-')[0]} • Seat {s.split('-')[1]}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Submit / Cancel Buttons */}
              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setEditingRegistration(null)}
                  className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingReg}
                  className="px-5 py-2 rounded-xl bg-signature-gradient text-white font-bold text-xs shadow-lg hover:brightness-110 cursor-pointer flex items-center space-x-1.5 disabled:opacity-50"
                >
                  {isSavingReg ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  <span>{isSavingReg ? 'Saving Changes...' : 'Save Registration'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFIRM DELETION POPUP MODAL */}
      {deletingRegistration && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
          <div className="bg-[#1c0d28] border border-red-500/40 rounded-2xl max-w-lg w-full p-6 relative text-white shadow-2xl space-y-5">
            <button
              type="button"
              onClick={() => setDeletingRegistration(null)}
              className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white/80 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-3 border-b border-white/10 pb-4">
              <div className="p-3 rounded-xl bg-red-500/20 text-red-400 border border-red-500/30">
                <AlertTriangle className="w-7 h-7" />
              </div>
              <div>
                <h3 className="font-poster text-xl tracking-wider text-red-400">
                  CONFIRM REGISTRATION DELETION
                </h3>
                <p className="text-xs text-white/60">
                  This action will permanently delete the live entry and log the record data into audit history.
                </p>
              </div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3 text-xs">
              <div className="font-bold text-[#E8B400] uppercase tracking-wider text-[10px]">
                Target Registrant Summary
              </div>
              
              <div className="grid grid-cols-2 gap-2 text-white/90">
                <div><span className="text-white/50">Name:</span> <strong className="text-white">{deletingRegistration.name}</strong></div>
                <div><span className="text-white/50">Type:</span> <span className="uppercase font-semibold text-[#E8752C]">{deletingRegistration.type}</span></div>
                <div><span className="text-white/50">Email:</span> {deletingRegistration.email}</div>
                <div><span className="text-white/50">Phone:</span> {deletingRegistration.phone}</div>
                <div className="col-span-2"><span className="text-white/50">Submitted:</span> {new Date(deletingRegistration.createdAt).toLocaleString()}</div>
              </div>

              <div className="pt-2 border-t border-white/10">
                <span className="text-white/50 block mb-1 font-semibold">Attendee Breakdown:</span>
                <div className="flex flex-wrap gap-1.5 text-[11px]">
                  <span className="px-2 py-0.5 rounded-md bg-white/10 text-white font-medium">Adults: {deletingRegistration.adultsCount || 0}</span>
                  <span className="px-2 py-0.5 rounded-md bg-white/10 text-white font-medium">Teens: {deletingRegistration.teensCount || 0}</span>
                  <span className="px-2 py-0.5 rounded-md bg-white/10 text-white font-medium">Pre-teens: {deletingRegistration.preteensCount || 0}</span>
                  <span className="px-2 py-0.5 rounded-md bg-white/10 text-white font-medium">Children: {deletingRegistration.childrenCount || 0}</span>
                  <span className="px-2 py-0.5 rounded-md bg-white/10 text-white font-medium">Kids: {deletingRegistration.kidsCount || 0}</span>
                  <span className="px-2 py-0.5 rounded-md bg-white/10 text-white font-medium">Toddlers: {deletingRegistration.toddlersCount || 0}</span>
                </div>
              </div>

              {deletingRegistration.selectedSeats && deletingRegistration.selectedSeats.length > 0 && (
                <div className="pt-2 border-t border-white/10">
                  <span className="text-amber-400 font-bold block mb-1 flex items-center space-x-1">
                    <Ticket className="w-3.5 h-3.5 text-amber-400" />
                    <span>🎟️ Issued Seats Released Back to Available Pool ({deletingRegistration.selectedSeats.length}):</span>
                  </span>
                  <div className="flex flex-wrap gap-1.5 text-[11px]">
                    {deletingRegistration.selectedSeats.map((s, idx) => (
                      <span key={`${s}-${idx}`} className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/40 font-mono font-bold">
                        Row {s.split('-')[0]} • Seat {s.split('-')[1]}
                      </span>
                    ))}
                  </div>
                  <p className="text-[10px] text-white/60 italic pt-1">
                    Deleting this registration will instantly free up these seat(s) for new reservations.
                  </p>
                </div>
              )}

              {deletingRegistration.comments && (
                <div className="pt-2 border-t border-white/10">
                  <span className="text-white/50 block font-semibold">Dietary / Special Comments:</span>
                  <p className="text-white/80 italic mt-0.5">{deletingRegistration.comments}</p>
                </div>
              )}
            </div>

            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-xs text-red-200 space-y-1">
              <p className="font-semibold flex items-center space-x-1.5 text-red-300">
                <UserCheck className="w-4 h-4 text-red-400" />
                <span>Admin Performing Action:</span>
              </p>
              <p className="text-[11px] text-white/90 pl-5 font-mono">
                {user?.displayName || 'Admin'} ({user?.email || 'authenticated admin'})
              </p>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-3 border-t border-white/10">
              <button
                type="button"
                onClick={() => setDeletingRegistration(null)}
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteRegistration}
                disabled={isDeletingReg}
                className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs shadow-lg cursor-pointer flex items-center space-x-1.5 disabled:opacity-50 transition-all"
              >
                {isDeletingReg ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                <span>{isDeletingReg ? 'Deleting Record...' : 'Confirm & Permanently Delete'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AUDIT SNAPSHOT & LOG DETAIL MODAL */}
      {selectedAuditLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
          <div className="bg-[#1c0d28] border border-white/20 rounded-2xl max-w-2xl w-full p-6 relative text-white shadow-2xl space-y-5">
            <button
              type="button"
              onClick={() => setSelectedAuditLog(null)}
              className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white/80 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-3 border-b border-white/10 pb-4">
              <div className={`p-3 rounded-xl ${
                selectedAuditLog.action === 'delete' 
                  ? 'bg-red-500/20 text-red-400 border border-red-500/30' 
                  : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
              }`}>
                {selectedAuditLog.action === 'delete' ? <Trash2 className="w-6 h-6" /> : <Edit className="w-6 h-6" />}
              </div>
              <div>
                <h3 className="font-poster text-xl tracking-wider text-white flex items-center space-x-2">
                  <span>AUDIT RECORD SNAPSHOT</span>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] uppercase font-bold ${
                    selectedAuditLog.action === 'delete' ? 'bg-red-500/30 text-red-300' : 'bg-amber-500/30 text-amber-300'
                  }`}>
                    {selectedAuditLog.action}
                  </span>
                </h3>
                <p className="text-xs text-white/60">
                  Logged on {new Date(selectedAuditLog.timestamp).toLocaleString()} by {selectedAuditLog.adminName} ({selectedAuditLog.adminEmail})
                </p>
              </div>
            </div>

            <div className="space-y-4 text-xs">
              {/* Registrant details */}
              <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-2">
                <div className="font-bold text-[#E8B400] uppercase tracking-wider text-[10px]">
                  Registrant Information
                </div>
                <div className="grid grid-cols-2 gap-2 text-white/90">
                  <div><span className="text-white/50">Full Name:</span> <strong className="text-white">{selectedAuditLog.registrantName}</strong></div>
                  <div><span className="text-white/50">Event Type:</span> <span className="uppercase font-semibold text-[#E8752C]">{selectedAuditLog.registrationType}</span></div>
                  <div><span className="text-white/50">Email:</span> {selectedAuditLog.registrantEmail}</div>
                  <div><span className="text-white/50">Phone:</span> {selectedAuditLog.registrantPhone || 'N/A'}</div>
                </div>
              </div>

              {/* Action summary or Changes */}
              {selectedAuditLog.action === 'edit' && selectedAuditLog.changes && (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 space-y-1">
                  <div className="font-bold text-amber-300 uppercase tracking-wider text-[10px]">
                    Summary of Changes Modified by Admin
                  </div>
                  <p className="text-amber-100/90 text-xs">{selectedAuditLog.changes}</p>
                </div>
              )}

              {/* Data Snapshot breakdown */}
              {selectedAuditLog.snapshot && (
                <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3">
                  <div className="font-bold text-[#3B82F6] uppercase tracking-wider text-[10px]">
                    Saved Snapshot Data Breakdown
                  </div>
                  
                  <div className="flex flex-wrap gap-2 text-[11px]">
                    <span className="px-2.5 py-1 rounded-lg bg-black/40 text-white font-medium border border-white/10">
                      Adults: <strong>{selectedAuditLog.snapshot.adultsCount || 0}</strong>
                    </span>
                    <span className="px-2.5 py-1 rounded-lg bg-black/40 text-white font-medium border border-white/10">
                      Teens: <strong>{selectedAuditLog.snapshot.teensCount || 0}</strong>
                    </span>
                    <span className="px-2.5 py-1 rounded-lg bg-black/40 text-white font-medium border border-white/10">
                      Pre-teens: <strong>{selectedAuditLog.snapshot.preteensCount || 0}</strong>
                    </span>
                    <span className="px-2.5 py-1 rounded-lg bg-black/40 text-white font-medium border border-white/10">
                      Children: <strong>{selectedAuditLog.snapshot.childrenCount || 0}</strong>
                    </span>
                    <span className="px-2.5 py-1 rounded-lg bg-black/40 text-white font-medium border border-white/10">
                      Kids: <strong>{selectedAuditLog.snapshot.kidsCount || 0}</strong>
                    </span>
                    <span className="px-2.5 py-1 rounded-lg bg-black/40 text-white font-medium border border-white/10">
                      Toddlers: <strong>{selectedAuditLog.snapshot.toddlersCount || 0}</strong>
                    </span>
                  </div>

                  {selectedAuditLog.snapshot.comments && (
                    <div className="pt-2 border-t border-white/10">
                      <span className="text-white/50 block font-semibold text-[11px]">Comments / Dietary:</span>
                      <p className="text-white/80 italic mt-0.5">{selectedAuditLog.snapshot.comments}</p>
                    </div>
                  )}

                  {selectedAuditLog.snapshot.createdAt && (
                    <div className="pt-1 text-[10px] text-white/40">
                      Original Registration Timestamp: {new Date(selectedAuditLog.snapshot.createdAt).toLocaleString()}
                    </div>
                  )}
                </div>
              )}

              {/* Raw JSON viewer */}
              <details className="bg-black/50 border border-white/10 rounded-xl p-3 text-white/70">
                <summary className="font-semibold text-[11px] cursor-pointer text-white/80 hover:text-white">
                  Inspect Complete JSON Audit Payload
                </summary>
                <pre className="mt-2 p-3 bg-black/80 rounded-lg text-[10px] text-emerald-400 font-mono overflow-x-auto">
                  {JSON.stringify(selectedAuditLog, null, 2)}
                </pre>
              </details>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-white/10 gap-3">
              {(selectedAuditLog.snapshot || selectedAuditLog.registrationId) ? (
                <button
                  type="button"
                  disabled={restoringRecordId === (selectedAuditLog.registrationId || selectedAuditLog.snapshot?.id)}
                  onClick={() => handleRestoreSingleRegistration(selectedAuditLog.snapshot, selectedAuditLog.registrationId, selectedAuditLog)}
                  className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg transition-colors flex items-center space-x-2 cursor-pointer disabled:opacity-50"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>
                    {restoringRecordId === (selectedAuditLog.registrationId || selectedAuditLog.snapshot?.id)
                      ? 'Restoring Record...'
                      : 'Restore Record Back to Registration'}
                  </span>
                </button>
              ) : <div />}

              <button
                type="button"
                onClick={() => setSelectedAuditLog(null)}
                className="px-5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs cursor-pointer transition-colors"
              >
                Close Snapshot
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Screenshot Modal */}
      {selectedScreenshotModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#1e0d29] border-2 border-emerald-500/40 rounded-3xl max-w-lg w-full p-6 text-white space-y-4 shadow-2xl relative">
            <button
              type="button"
              onClick={() => setSelectedScreenshotModal(null)}
              className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white cursor-pointer transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-3 border-b border-white/10 pb-3">
              <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                <Camera className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-white">Payment Receipt Proof</h3>
                <p className="text-xs text-white/70">{selectedScreenshotModal.name} • {selectedScreenshotModal.email}</p>
              </div>
            </div>

            <div className="bg-black/60 p-2 rounded-2xl border border-white/10 flex items-center justify-center max-h-[60vh] overflow-auto">
              <img src={selectedScreenshotModal.url} alt="PayNow Receipt Screenshot" className="max-h-[55vh] object-contain rounded-xl" />
            </div>

            <div className="flex items-center justify-between pt-2">
              <a
                href={selectedScreenshotModal.url}
                download={`PayNow_Receipt_${selectedScreenshotModal.name.replace(/\s+/g, '_')}.png`}
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs flex items-center space-x-1.5 transition-all cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Download Proof</span>
              </a>

              <button
                type="button"
                onClick={() => setSelectedScreenshotModal(null)}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-[#C81E6E] to-[#E8752C] text-white font-bold text-xs shadow-md hover:opacity-90 cursor-pointer"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Single Email Reminder Popup Modal */}
      {selectedRegForEmail && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#1e0d29] border-2 border-blue-500/40 rounded-3xl max-w-xl w-full p-6 text-white space-y-5 shadow-2xl relative">
            <button
              type="button"
              onClick={() => setSelectedRegForEmail(null)}
              className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white cursor-pointer transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-3 border-b border-white/10 pb-4">
              <div className="p-3 rounded-2xl bg-blue-500/20 text-blue-400 border border-blue-500/30">
                <Mail className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-white">Send Payment Reminder Email</h3>
                <p className="text-xs text-white/70">
                  Recipient: <strong className="text-white">{selectedRegForEmail.name}</strong> ({selectedRegForEmail.email})
                </p>
              </div>
            </div>

            {singleEmailResult && (
              <div className={`p-4 rounded-2xl text-xs flex items-start space-x-3 border ${
                singleEmailResult.type === 'success' 
                  ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-200' 
                  : singleEmailResult.type === 'error'
                  ? 'bg-red-500/20 border-red-500/40 text-red-200'
                  : 'bg-blue-500/20 border-blue-500/40 text-blue-200'
              }`}>
                {singleEmailResult.type === 'success' ? (
                  <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                )}
                <div>
                  <p className="font-semibold">{singleEmailResult.message}</p>
                </div>
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-white/80 uppercase tracking-wider mb-1">
                  Email Subject
                </label>
                <input
                  type="text"
                  value={singleEmailSubject}
                  onChange={(e) => setSingleEmailSubject(e.target.value)}
                  className="w-full bg-black/50 border border-white/20 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-blue-400"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-white/80 uppercase tracking-wider mb-1">
                  Auto-Generated Email Message Text
                </label>
                <textarea
                  rows={10}
                  value={singleEmailBody}
                  onChange={(e) => setSingleEmailBody(e.target.value)}
                  className="w-full bg-black/50 border border-white/20 rounded-xl p-3 text-xs text-white font-mono focus:outline-none focus:border-blue-400 leading-relaxed"
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(`Subject: ${singleEmailSubject}\n\n${singleEmailBody}`);
                  setSingleEmailResult({ type: 'info', message: 'Email subject and message body copied to clipboard!' });
                }}
                className="w-full sm:w-auto px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs flex items-center justify-center space-x-1.5 transition-all cursor-pointer"
              >
                <Copy className="w-4 h-4 text-blue-300" />
                <span>Copy Email Text</span>
              </button>

              <div className="flex items-center space-x-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setSelectedRegForEmail(null)}
                  className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs cursor-pointer"
                >
                  Close
                </button>

                <button
                  type="button"
                  onClick={handleSendSingleEmail}
                  disabled={isSendingSingleEmail}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#2242A6] via-[#1a3384] to-[#C81E6E] hover:brightness-110 text-white font-extrabold text-xs shadow-lg flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
                >
                  {isSendingSingleEmail ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Sending Email...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>Send Email Now</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Batch Email Reminder Popup Modal */}
      {showBatchReminderModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#1e0d29] border-2 border-amber-500/40 rounded-3xl max-w-2xl w-full p-6 text-white space-y-5 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button
              type="button"
              onClick={() => setShowBatchReminderModal(false)}
              className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white cursor-pointer transition-colors">
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-3 border-b border-white/10 pb-4">
              <div className="p-3 rounded-2xl bg-amber-500/20 text-amber-300 border border-amber-500/30">
                <Mail className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-xl text-white">Batch Email Payment Reminders</h3>
                <p className="text-xs text-white/70">
                  Select attendees without payment screenshots to send personalized reminders
                </p>
              </div>
            </div>

            {/* Recipient Selection Card */}
            <div className="bg-black/40 p-4 rounded-2xl border border-white/10 space-y-3">
              <div className="flex items-center justify-between border-b border-white/10 pb-2">
                <span className="text-xs font-bold text-amber-300 uppercase tracking-wider">
                  Recipients Pending Payment Screenshot ({batchRecipients.filter(b => b.selected).length}/{batchRecipients.length} Selected)
                </span>
                <div className="flex items-center space-x-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setBatchRecipients(prev => prev.map(p => ({ ...p, selected: true })))}
                    className="text-blue-300 hover:underline cursor-pointer"
                  >
                    Select All
                  </button>
                  <span className="text-white/30">|</span>
                  <button
                    type="button"
                    onClick={() => setBatchRecipients(prev => prev.map(p => ({ ...p, selected: false })))}
                    className="text-white/50 hover:underline cursor-pointer"
                  >
                    Deselect All
                  </button>
                </div>
              </div>

              {batchRecipients.length === 0 ? (
                <div className="p-4 text-center text-xs text-white/50 italic">
                  🎉 Great news! All registered attendees have uploaded their payment receipts.
                </div>
              ) : (
                <div className="max-h-40 overflow-y-auto divide-y divide-white/5 pr-1 space-y-1">
                  {batchRecipients.map((item, idx) => (
                    <label key={item.reg.id || idx} className="flex items-center justify-between p-2 rounded-xl hover:bg-white/5 cursor-pointer text-xs">
                      <div className="flex items-center space-x-3">
                        <input
                          type="checkbox"
                          checked={item.selected}
                          onChange={(e) => {
                            const val = e.target.checked;
                            setBatchRecipients(prev => prev.map((p, i) => i === idx ? { ...p, selected: val } : p));
                          }}
                          className="w-4 h-4 rounded border-white/30 text-[#E8752C] focus:ring-0 cursor-pointer"
                        />
                        <div>
                          <p className="font-bold text-white">{item.reg.name}</p>
                          <p className="text-[11px] text-white/60 font-mono">{item.reg.email} • {item.reg.phone}</p>
                        </div>
                      </div>
                      <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-white/10 text-amber-300">
                        {item.reg.type}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Template Fields */}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-white/80 uppercase tracking-wider mb-1">
                  Email Subject
                </label>
                <input
                  type="text"
                  value={batchSubject}
                  onChange={(e) => setBatchSubject(e.target.value)}
                  className="w-full bg-black/50 border border-white/20 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-white/80 uppercase tracking-wider mb-1">
                  Personalized Template Body <span className="text-amber-300 font-normal lowercase">(Use &#123;Name&#125; & &#123;Type&#125; for auto-fill)</span>
                </label>
                <textarea
                  rows={8}
                  value={batchBodyTemplate}
                  onChange={(e) => setBatchBodyTemplate(e.target.value)}
                  className="w-full bg-black/50 border border-white/20 rounded-xl p-3 text-xs text-white font-mono focus:outline-none focus:border-amber-400 leading-relaxed"
                />
              </div>
            </div>

            {/* Batch Progress & Results */}
            {isSendingBatch && batchProgress && (
              <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl space-y-2 text-xs">
                <div className="flex items-center justify-between font-bold text-amber-200">
                  <span>Dispatching Emails ({batchProgress.current} / {batchProgress.total})</span>
                  <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
                </div>
                <p className="text-[11px] text-white/80">Current Recipient: {batchProgress.currentRecipient}</p>
                <div className="w-full bg-black/40 h-2 rounded-full overflow-hidden border border-white/10">
                  <div
                    className="bg-gradient-to-r from-amber-400 to-orange-500 h-full transition-all duration-300"
                    style={{ width: `${(batchProgress.current / batchProgress.total) * 100}%` }}
                  />
                </div>
              </div>
            )}

            {batchResult && (
              <div className="p-4 bg-emerald-500/20 border border-emerald-500/40 rounded-2xl text-xs text-emerald-200 flex items-center space-x-3">
                <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
                <div>
                  <p className="font-bold text-sm text-white">{batchResult.message}</p>
                  <p className="text-[11px] text-emerald-300">Sent reminders to all selected attendees.</p>
                </div>
              </div>
            )}

            {/* Footer Buttons */}
            <div className="flex items-center justify-end space-x-3 pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={() => setShowBatchReminderModal(false)}
                className="px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleSendBatchReminders}
                disabled={isSendingBatch || batchRecipients.filter(b => b.selected).length === 0}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-[#C81E6E] hover:brightness-110 text-white font-extrabold text-xs shadow-xl flex items-center space-x-2 cursor-pointer disabled:opacity-50"
              >
                {isSendingBatch ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Dispatching Emails...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Confirm & Send {batchRecipients.filter(b => b.selected).length} Personalized Emails</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Universal Delete Confirmation Modal */}
      {deleteConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border-2 border-red-500/50 rounded-2xl max-w-md w-full p-6 text-white shadow-2xl space-y-5">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-xl bg-red-500/20 text-red-400 border border-red-500/30 shrink-0">
                <Trash2 className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="font-bold text-lg text-white font-serif">{deleteConfirmModal.title}</h3>
                {deleteConfirmModal.subtitle && (
                  <p className="text-xs text-slate-300 leading-relaxed">{deleteConfirmModal.subtitle}</p>
                )}
              </div>
            </div>

            <div className="bg-red-950/40 border border-red-500/30 p-3 rounded-xl text-xs text-red-200 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
              <span>This action cannot be undone. Please confirm to proceed.</span>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmModal(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  const action = deleteConfirmModal.onConfirm;
                  setDeleteConfirmModal(null);
                  try {
                    await action();
                  } catch (err) {
                    console.error('Error executing delete action:', err);
                  }
                }}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-bold text-xs shadow-lg cursor-pointer transition-all flex items-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                <span>Yes, Delete Record</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Admin Pass & QR Code Modal */}
      {adminPassModalReg && (
        <AdminPassModal
          reg={registrations.find(r => r.id === adminPassModalReg.id || (adminPassModalReg.passId && r.passId === adminPassModalReg.passId)) || adminPassModalReg}
          onClose={() => setAdminPassModalReg(null)}
          onToggleCheckIn={handleToggleDelegateCheckIn}
        />
      )}

      {/* HitPay Inspector Modal */}
      {selectedHitpayInspectorReg && (
          <HitPayInspectorModal
            reg={registrations.find(r => r.id === selectedHitpayInspectorReg.id) || selectedHitpayInspectorReg}
            onClose={() => setSelectedHitpayInspectorReg(null)}
          />
        )}
      </div>
    );
  };

  export default AdminPanel;