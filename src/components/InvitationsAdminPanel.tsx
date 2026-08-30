import React, { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { 
  Users, Mail, MessageSquare, Search, Filter, Shield, Plus, Edit, Trash2, 
  Eye, EyeOff, Upload, Download, CheckCircle, AlertTriangle, Send, RefreshCw, 
  MapPin, Phone, Building, Star, Check, X, Sparkles, FileSpreadsheet, Lock, Clock, Link, Save, Ticket, RotateCcw,
  CheckSquare, Square, CopyX, Layers, ArrowRight, Shuffle, DollarSign, QrCode,
  BarChart3, UserCheck, Crown, XCircle, Share2, ExternalLink, Copy
} from 'lucide-react';
import { 
  InvitationRecord, 
  InvitationAdminRole, 
  SingaporeParishInfo, 
  SINGAPORE_PARISHES_DIRECTORY, 
  composePersonalizedInviteMessage,
  subscribeToInvitations,
  saveInvitationToFirestore,
  saveInvitationsBatchToFirestore,
  deleteInvitationFromFirestore,
  batchUpdateMultipleInvitationsInFirestore,
  batchDeleteMultipleInvitationsFromFirestore,
  detectDuplicateRecords,
  purgeDuplicatesInFirestore,
  DuplicateCluster,
  getInvitationSettingsFromFirestore,
  saveInvitationSettingsToFirestore,
  InvitationSettings,
  getDefaultMasterInvitations,
  DEFAULT_INVITATION_CATEGORIES,
  DEFAULT_IN_CHARGE_OPTIONS,
  DEFAULT_INVITATION_STATUSES,
  INVITATION_SUB_ROLE_LABELS,
  formatInvitationRoleName
} from '../data/invitationsData';
import { collection, query, where, getDocs, updateDoc, doc } from 'firebase/firestore';
import { db, fetchApprovedAdmins, updateAdminStatus, deleteAdminRecordPermanently, subscribeToRegistrations } from '../lib/firebase';
import { SiteContentData, ApprovedAdminData, RegistrationData } from '../types';

import { 
  subscribeToInvitationCodes, 
  createInvitationCode, 
  saveInvitationCode,
  deleteInvitationCode, 
  getMusicalConcertSettings, 
  saveMusicalConcertSettings, 
  InvitationCodeRecord, 
  DEFAULT_MUSICAL_RELEASE_DATE 
} from '../lib/invitationCodes';

interface InvitationsAdminPanelProps {
  currentUserEmail: string;
  isSuperAdmin: boolean;
  currentUserRoles?: InvitationAdminRole[];
  siteContent?: SiteContentData;
  registrations?: RegistrationData[];
}

export const InvitationsAdminPanel: React.FC<InvitationsAdminPanelProps> = ({
  currentUserEmail,
  isSuperAdmin,
  currentUserRoles = [],
  siteContent,
  registrations = []
}) => {
  // Determine role permissions
  const isMainAdmin = isSuperAdmin || currentUserRoles.length === 0 || currentUserRoles.includes('invitation_main_admin');
  const canAccessPublic = isMainAdmin || currentUserRoles.includes('public_invitation_admin') || currentUserRoles.includes('parish_invitation_admin');
  const canAccessParish = isMainAdmin || currentUserRoles.includes('parish_invitation_admin') || currentUserRoles.includes('public_invitation_admin');
  const canAccessJYCoordinators = isMainAdmin || currentUserRoles.includes('jy_coordinators');
  const canAccessInactiveJYs = isMainAdmin || currentUserRoles.includes('inactive_jys_admin');

  // Active Sub-Tab
  type SubTab = 'all' | 'public' | 'parish_dir' | 'jy_coordinators' | 'inactive_jys' | 'concert_codes' | 'deleted_names' | 'roles_mgmt';
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('all');
  const [activeCategorySubTab, setActiveCategorySubTab] = useState<string>('all');

  // Invitations Data State
  const [invitations, setInvitations] = useState<InvitationRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Concert Invitation Codes & Launch Date State
  const [invitationCodes, setInvitationCodes] = useState<InvitationCodeRecord[]>([]);
  const [concertReleaseDate, setConcertReleaseDate] = useState<string>(DEFAULT_MUSICAL_RELEASE_DATE);
  const [savingReleaseDate, setSavingReleaseDate] = useState(false);
  const [codeType, setCodeType] = useState<'individual' | 'group'>('individual');
  const [codeRecipientName, setCodeRecipientName] = useState('');
  const [codeRecipientEmail, setCodeRecipientEmail] = useState('');
  const [codeInvitedBy, setCodeInvitedBy] = useState('');
  const [codeGroupMembersText, setCodeGroupMembersText] = useState('');
  const [codeCategory, setCodeCategory] = useState('VIP');
  const [codeMaxSeats, setCodeMaxSeats] = useState<number>(1);
  const [codePrefix, setCodePrefix] = useState('GRACIA');
  const [codeTicketType, setCodeTicketType] = useState<'complimentary' | 'paid'>('complimentary');
  const [codeTicketPrice, setCodeTicketPrice] = useState<number>(10);
  const [codeSeatMemberNames, setCodeSeatMemberNames] = useState<string[]>(['']);
  const [generatingCode, setGeneratingCode] = useState(false);

  // Sync individual seat textboxes array size with codeMaxSeats
  useEffect(() => {
    const targetSeats = codeType === 'individual' ? 1 : Math.max(1, Number(codeMaxSeats) || 1);
    setCodeSeatMemberNames((prev) => {
      const updated = [...prev];
      if (updated.length < targetSeats) {
        while (updated.length < targetSeats) {
          updated.push('');
        }
      } else if (updated.length > targetSeats) {
        updated.length = targetSeats;
      }
      return updated;
    });
  }, [codeMaxSeats, codeType]);

  // Settings State (Contact Privacy)
  const [invitationSettings, setInvitationSettings] = useState<InvitationSettings>({
    allowNonMainAdminsToViewContacts: false
  });

  // Filter & Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGender, setSelectedGender] = useState<'all' | 'Male' | 'Female'>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedInCharge, setSelectedInCharge] = useState<string>('all');

  // Multi-Record Selection & Batch Operations State
  const [selectedRecordIds, setSelectedRecordIds] = useState<string[]>([]);
  const [batchCategory, setBatchCategory] = useState<string>('');
  const [batchStatus, setBatchStatus] = useState<string>('');
  const [batchInCharge, setBatchInCharge] = useState<string>('');
  const [batchInvitedBy, setBatchInvitedBy] = useState<string>('');
  const [isApplyingBatch, setIsApplyingBatch] = useState<boolean>(false);

  // Real-Time Registrations State (Sync with props & Firestore subscription)
  const [liveRegistrations, setLiveRegistrations] = useState<RegistrationData[]>(registrations || []);

  useEffect(() => {
    if (registrations && registrations.length > 0) {
      setLiveRegistrations(registrations);
    }
  }, [registrations]);

  useEffect(() => {
    const unsubRegs = subscribeToRegistrations((data) => {
      if (data && data.length > 0) {
        setLiveRegistrations(data);
      }
    });
    return () => unsubRegs();
  }, []);

  const activeRegistrationsList = useMemo(() => {
    return liveRegistrations.length > 0 ? liveRegistrations : (registrations || []);
  }, [liveRegistrations, registrations]);

  // Auto Registration Matching Lookups
  const registeredSet = React.useMemo(() => {
    const emails = new Set<string>();
    const phones = new Set<string>();
    const names = new Set<string>();
    const invitationCodesSet = new Set<string>();
    const refIds = new Set<string>();

    activeRegistrationsList.forEach(reg => {
      if (!reg) return;
      if (String(reg.status) === 'cancelled' || String(reg.paymentStatus) === 'cancelled') return;

      if (reg.email) emails.add(reg.email.toLowerCase().trim());
      if (reg.phone) {
        const cleanP = reg.phone.replace(/\D/g, '');
        if (cleanP && cleanP.length >= 6) phones.add(cleanP);
      }
      if (reg.name) names.add(reg.name.toLowerCase().trim());

      const code = (reg as any).invitation_code || (reg as any).invitationCode || (reg as any).code;
      if (code) invitationCodesSet.add(String(code).toUpperCase().trim());

      const passId = (reg as any).passId || reg.id;
      if (passId) refIds.add(String(passId).toUpperCase().trim());

      if (Array.isArray(reg.additionalAttendees)) {
        reg.additionalAttendees.forEach(att => {
          if (!att) return;
          if (att.email) emails.add(att.email.toLowerCase().trim());
          if (att.phone) {
            const cleanP = att.phone.replace(/\D/g, '');
            if (cleanP && cleanP.length >= 6) phones.add(cleanP);
          }
          if (att.name) names.add(att.name.toLowerCase().trim());
        });
      }
    });

    return { emails, phones, names, invitationCodesSet, refIds };
  }, [activeRegistrationsList]);

  const isRecordRegistered = React.useCallback((item: InvitationRecord): boolean => {
    if (!item) return false;

    // 1. Direct status on invitation item
    const st = (item.invitationStatus || (item as any).status || '').toUpperCase();
    if (st === 'REGISTERED' || st === 'ACCEPTED' || st === 'ATTENDED' || Boolean((item as any).registeredAt)) {
      return true;
    }

    if (!activeRegistrationsList || activeRegistrationsList.length === 0) return false;

    // 2. Match by email
    if (item.email && registeredSet.emails.has(item.email.toLowerCase().trim())) {
      return true;
    }

    // 3. Match by phone or phone2
    if (item.phone) {
      const cleanP = item.phone.replace(/\D/g, '');
      if (cleanP && cleanP.length >= 6 && registeredSet.phones.has(cleanP)) {
        return true;
      }
    }
    if (item.phone2) {
      const cleanP = item.phone2.replace(/\D/g, '');
      if (cleanP && cleanP.length >= 6 && registeredSet.phones.has(cleanP)) {
        return true;
      }
    }

    // 4. Match by fullName
    if (item.fullName && registeredSet.names.has(item.fullName.toLowerCase().trim())) {
      return true;
    }

    // 5. Match by invitation code or ref ID
    const itemCode = (item as any).invitationCode || (item as any).invitation_code || (item as any).code;
    if (itemCode && registeredSet.invitationCodesSet.has(String(itemCode).toUpperCase().trim())) {
      return true;
    }

    return false;
  }, [activeRegistrationsList, registeredSet]);

  // Dashboard Statistics Computation
  const dashboardStats = useMemo(() => {
    const activeInvitations = invitations.filter(i => !i.isDeleted);
    
    // 1. No of people invited (Status from invitation table: email_sent, whatsapp_sent, called, etc.)
    const totalInvited = activeInvitations.length;
    const contactedInvited = activeInvitations.filter(i => {
      const st = (i.invitationStatus || (i as any).status || 'not_invited').toLowerCase();
      return st !== 'not_invited' && st !== '';
    }).length;
    
    // 2. No of people registered (checks invitation list matched against registration database)
    const registeredInvitedContacts = activeInvitations.filter(i => isRecordRegistered(i)).length;

    // Total actual registered entries in registration database
    const totalDatabaseRegistrations = activeRegistrationsList.reduce((sum, reg) => {
      if (String(reg.status) === 'cancelled' || String(reg.paymentStatus) === 'cancelled') return sum;
      return sum + 1 + (Array.isArray(reg.additionalAttendees) ? reg.additionalAttendees.length : 0);
    }, 0);

    const registeredPeople = activeInvitations.length > 0
      ? registeredInvitedContacts
      : totalDatabaseRegistrations;

    // 3. No of priest or VIPs registered
    const priestVipList = activeInvitations.filter(i => {
      const cat = (i.category || '').toLowerCase();
      return cat.includes('priest') || cat.includes('vip') || cat.includes('bishop') || cat.includes('clergy') || cat.includes('cardinal') || cat.includes('archbishop');
    });

    const priestVipsRegistered = priestVipList.filter(i => isRecordRegistered(i)).length;
    const totalPriestVipsInvited = priestVipList.length;

    // 4. No of invitation codes sent / issued
    const validCodes = invitationCodes.filter(c => !c.isDeleted && !c.isInvalid && c.status !== 'invalid');
    const codesSent = validCodes.length;

    // 5. No of invitation codes used
    const codesUsed = validCodes.filter(c => {
      if (c.isUsed || (c.seatsUsed && c.seatsUsed > 0)) return true;
      if (c.code && registeredSet.invitationCodesSet.has(c.code.toUpperCase().trim())) return true;
      return false;
    }).length;

    const totalSeatsRedeemed = validCodes.reduce((sum, c) => {
      if (c.seatsUsed && c.seatsUsed > 0) return sum + c.seatsUsed;
      if (c.code && registeredSet.invitationCodesSet.has(c.code.toUpperCase().trim())) return sum + (c.maxSeats || 1);
      return sum;
    }, 0);

    // 6. No of invitation codes invalidated (Taken from actual invalidated records from codes issued table)
    const codesInvalidated = invitationCodes.filter(c => c.isInvalid || c.status === 'invalid' || c.isDeleted).length;

    // 7. No of group codes issued and registered
    const groupCodesIssued = validCodes.filter(c => c.codeType === 'group' || (c as any).type === 'group');
    const groupCodesRegistered = groupCodesIssued.filter(c => {
      if (c.isUsed || (c.seatsUsed && c.seatsUsed > 0)) return true;
      if (c.code && registeredSet.invitationCodesSet.has(c.code.toUpperCase().trim())) return true;
      return false;
    }).length;

    return {
      totalInvited,
      contactedInvited,
      registeredPeople,
      totalDatabaseRegistrations,
      priestVipsRegistered,
      totalPriestVipsInvited,
      codesSent,
      codesUsed,
      totalSeatsRedeemed,
      codesInvalidated,
      groupCodesIssued: groupCodesIssued.length,
      groupCodesRegistered
    };
  }, [invitations, invitationCodes, activeRegistrationsList, isRecordRegistered, registeredSet]);

  // Category Swap Tool State
  const [showCategorySwapModal, setShowCategorySwapModal] = useState<boolean>(false);
  const [swapFromCategory, setSwapFromCategory] = useState<string>('CS Participant');
  const [swapToCategory, setSwapToCategory] = useState<string>('Youth');
  const [isSwappingCategory, setIsSwappingCategory] = useState<boolean>(false);

  // Duplicates Detection & Purging Tool State
  const [showDuplicatesModal, setShowDuplicatesModal] = useState<boolean>(false);
  const [duplicateClusters, setDuplicateClusters] = useState<DuplicateCluster[]>([]);
  const [totalDuplicatesCount, setTotalDuplicatesCount] = useState<number>(0);
  const [isPurgingDuplicates, setIsPurgingDuplicates] = useState<boolean>(false);

  // Sorting State
  type SortField = 'serialNo' | 'fullName' | 'gender' | 'category' | 'status' | 'inCharge';
  const [sortField, setSortField] = useState<SortField>('serialNo');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // In-Charge & Status Management Modals State
  const [showInChargeMgmtModal, setShowInChargeMgmtModal] = useState(false);
  const [newInChargeInput, setNewInChargeInput] = useState('');
  const [showStatusMgmtModal, setShowStatusMgmtModal] = useState(false);
  const [newStatusInput, setNewStatusInput] = useState('');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(50);

  // Singapore Parish Search State
  const [parishSearchQuery, setParishSearchQuery] = useState('');
  const [selectedDistrict, setSelectedDistrict] = useState<string>('all');

  // Modals & Forms State
  const [showAddEditModal, setShowAddEditModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState<InvitationRecord | null>(null);
  const [recordForm, setRecordForm] = useState<Omit<InvitationRecord, 'id'>>({
    serialNo: 0,
    fullName: '',
    gender: 'Male',
    phone: '',
    phone2: '',
    email: '',
    category: 'Youth',
    remarks: '',
    invitationStatus: 'not_invited',
    inCharge: '',
    invitedBy: ''
  });

  // Compose Email Modal
  const [emailModalRecord, setEmailModalRecord] = useState<InvitationRecord | null>(null);
  const [emailKeywordsInput, setEmailKeywordsInput] = useState('');
  const [customEmailSubject, setCustomEmailSubject] = useState('');
  const [customEmailBody, setCustomEmailBody] = useState('');
  const [emailComposerTab, setEmailComposerTab] = useState<'preview' | 'edit'>('preview');
  const [emailCopiedNotice, setEmailCopiedNotice] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);

  // Compose WhatsApp Modal
  const [whatsappModalRecord, setWhatsappModalRecord] = useState<InvitationRecord | null>(null);
  const [customWhatsappText, setCustomWhatsappText] = useState('');

  // Delete Confirmation Modal
  const [deleteTargetRecord, setDeleteTargetRecord] = useState<InvitationRecord | null>(null);

  // Notification Banner
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Google Sheets Export Modal State
  const [showExportModal, setShowExportModal] = useState<boolean>(false);
  const [exportModalData, setExportModalData] = useState<{
    count: number;
    copied: boolean;
    userEmail: string;
    tsvPreview: string;
  } | null>(null);

  // Compute combined categories, in-charge names, and statuses
  const allCategories = Array.from(new Set([
    ...DEFAULT_INVITATION_CATEGORIES,
    ...(invitationSettings.customCategories || [])
  ]));

  const allInChargeOptions = Array.from(new Set([
    ...DEFAULT_IN_CHARGE_OPTIONS,
    ...(invitationSettings.inChargeOptions || [])
  ]));

  const allStatusOptions = Array.from(new Set([
    ...DEFAULT_INVITATION_STATUSES,
    ...(invitationSettings.statusOptions || [])
  ]));

  const getRecordCheckInStatus = React.useCallback((item: InvitationRecord): { isCheckedIn: boolean; checkedInAt?: string } => {
    if (!activeRegistrationsList || activeRegistrationsList.length === 0) {
      if (item.invitationStatus === 'attended') return { isCheckedIn: true };
      return { isCheckedIn: false };
    }

    const cleanItemEmail = item.email ? item.email.toLowerCase().trim() : '';
    const cleanItemPhone = item.phone ? item.phone.replace(/\D/g, '') : '';
    const cleanItemName = item.fullName ? item.fullName.toLowerCase().trim() : '';

    for (const reg of activeRegistrationsList) {
      if (!reg) continue;
      
      const regEmail = reg.email ? reg.email.toLowerCase().trim() : '';
      const regPhone = reg.phone ? reg.phone.replace(/\D/g, '') : '';
      const regName = reg.name ? reg.name.toLowerCase().trim() : '';

      let isMatch = false;
      if (cleanItemEmail && regEmail && cleanItemEmail === regEmail) isMatch = true;
      else if (cleanItemPhone && regPhone && cleanItemPhone.length >= 7 && (cleanItemPhone === regPhone || regPhone.endsWith(cleanItemPhone))) isMatch = true;
      else if (cleanItemName && regName && cleanItemName === regName) isMatch = true;

      if (!isMatch && reg.additionalAttendees && Array.isArray(reg.additionalAttendees)) {
        for (const a of reg.additionalAttendees) {
          if (!a) continue;
          const aEmail = a.email ? a.email.toLowerCase().trim() : '';
          const aPhone = a.phone ? a.phone.replace(/\D/g, '') : '';
          const aName = a.name ? a.name.toLowerCase().trim() : '';

          if (cleanItemEmail && aEmail && cleanItemEmail === aEmail) { isMatch = true; break; }
          if (cleanItemPhone && aPhone && cleanItemPhone.length >= 7 && (cleanItemPhone === aPhone || aPhone.endsWith(cleanItemPhone))) { isMatch = true; break; }
          if (cleanItemName && aName && cleanItemName === aName) { isMatch = true; break; }
        }
      }

      if (isMatch) {
        const checkedIn = Boolean((reg as any).checkedIn || (reg as any).scannedPassIds && (reg as any).scannedPassIds.length > 0);
        if (checkedIn) {
          return { isCheckedIn: true, checkedInAt: (reg as any).checkedInAt };
        }
      }
    }

    if (item.invitationStatus === 'attended') return { isCheckedIn: true };
    return { isCheckedIn: false };
  }, [activeRegistrationsList]);

  const getEffectiveStatus = (item: InvitationRecord): string => {
    if (isRecordRegistered(item)) return 'REGISTERED';
    return item.invitationStatus || 'not_invited';
  };

  // Single Apply All Batch Updates Handler
  const handleApplyAllBatchUpdates = async () => {
    if (selectedRecordIds.length === 0) return;
    const updates: Partial<InvitationRecord> = {};
    if (batchCategory) updates.category = batchCategory;
    if (batchInCharge) updates.inCharge = batchInCharge === '__CLEAR__' ? '' : batchInCharge;
    if (batchStatus) updates.invitationStatus = batchStatus as any;

    if (Object.keys(updates).length === 0) {
      setNotification({
        type: 'error',
        message: 'Please select at least one field (Category, In-Charge, or Status) to apply.'
      });
      return;
    }

    await handleApplyBatchUpdate(updates);
  };

  // In-Charge Options Handlers & Inline Edit
  const [editingInChargeName, setEditingInChargeName] = useState<string | null>(null);
  const [editingInChargeValue, setEditingInChargeValue] = useState<string>('');

  const handleAddInChargeOption = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newInChargeInput.trim()) return;
    const name = newInChargeInput.trim();
    const current = invitationSettings.inChargeOptions || [];
    if (DEFAULT_IN_CHARGE_OPTIONS.includes(name) || current.includes(name)) {
      setNotification({ type: 'error', message: `In-charge "${name}" already exists.` });
      return;
    }
    const updated = [...current, name];
    const newSettings = { ...invitationSettings, inChargeOptions: updated };
    setInvitationSettings(newSettings);
    await saveInvitationSettingsToFirestore(newSettings);
    setNewInChargeInput('');
    setNotification({ type: 'success', message: `Added In-Charge name: "${name}"` });
  };

  const handleRenameInChargeOption = async (oldName: string, newName: string) => {
    const trimmedNew = newName.trim();
    if (!trimmedNew || oldName === trimmedNew) {
      setEditingInChargeName(null);
      return;
    }

    const currentOpts = invitationSettings.inChargeOptions || [];
    const customOpts = invitationSettings.customInChargeOptions || [];

    let updatedInChargeOpts = currentOpts.map(n => n === oldName ? trimmedNew : n);
    if (!updatedInChargeOpts.includes(trimmedNew)) updatedInChargeOpts.push(trimmedNew);

    let updatedCustomOpts = customOpts.map(n => n === oldName ? trimmedNew : n);
    if (!updatedCustomOpts.includes(trimmedNew)) updatedCustomOpts.push(trimmedNew);

    const newSettings = {
      ...invitationSettings,
      inChargeOptions: updatedInChargeOpts,
      customInChargeOptions: updatedCustomOpts
    };

    setInvitationSettings(newSettings);
    await saveInvitationSettingsToFirestore(newSettings);

    const matchingRecords = invitations.filter(inv => (inv.inCharge || '').toLowerCase() === oldName.toLowerCase());
    if (matchingRecords.length > 0) {
      for (const rec of matchingRecords) {
        if (rec.id) {
          await saveInvitationToFirestore({ ...rec, inCharge: trimmedNew });
        }
      }
      setInvitations(prev => prev.map(inv => (inv.inCharge || '').toLowerCase() === oldName.toLowerCase() ? { ...inv, inCharge: trimmedNew } : inv));
    }

    setEditingInChargeName(null);
    setNotification({
      type: 'success',
      message: `Renamed In-Charge "${oldName}" to "${trimmedNew}" across ${matchingRecords.length} record(s).`
    });
  };

  const handleDeleteInChargeOption = async (name: string) => {
    const current = invitationSettings.inChargeOptions || [];
    const custom = invitationSettings.customInChargeOptions || [];
    const updated = current.filter(n => n !== name);
    const updatedCustom = custom.filter(n => n !== name);
    const newSettings = { ...invitationSettings, inChargeOptions: updated, customInChargeOptions: updatedCustom };
    setInvitationSettings(newSettings);
    await saveInvitationSettingsToFirestore(newSettings);
    setNotification({ type: 'success', message: `Removed In-Charge option: "${name}"` });
  };

  // Status Options Handlers & Inline Edit
  const [editingStatusName, setEditingStatusName] = useState<string | null>(null);
  const [editingStatusValue, setEditingStatusValue] = useState<string>('');

  const handleAddStatusOption = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStatusInput.trim()) return;
    const status = newStatusInput.trim();
    const current = invitationSettings.statusOptions || [];
    if (DEFAULT_INVITATION_STATUSES.includes(status) || current.includes(status)) {
      setNotification({ type: 'error', message: `Status option "${status}" already exists.` });
      return;
    }
    const updated = [...current, status];
    const newSettings = { ...invitationSettings, statusOptions: updated };
    setInvitationSettings(newSettings);
    await saveInvitationSettingsToFirestore(newSettings);
    setNewStatusInput('');
    setNotification({ type: 'success', message: `Added Status option: "${status}"` });
  };

  const handleRenameStatusOption = async (oldStatus: string, newStatus: string) => {
    const trimmedNew = newStatus.trim();
    if (!trimmedNew || oldStatus === trimmedNew) {
      setEditingStatusName(null);
      return;
    }

    const currentOpts = invitationSettings.statusOptions || [];
    const customOpts = invitationSettings.customStatuses || [];

    let updatedStatusOpts = currentOpts.map(s => s === oldStatus ? trimmedNew : s);
    if (!updatedStatusOpts.includes(trimmedNew)) updatedStatusOpts.push(trimmedNew);

    let updatedCustomOpts = customOpts.map(s => s === oldStatus ? trimmedNew : s);
    if (!updatedCustomOpts.includes(trimmedNew)) updatedCustomOpts.push(trimmedNew);

    const newSettings = {
      ...invitationSettings,
      statusOptions: updatedStatusOpts,
      customStatuses: updatedCustomOpts
    };

    setInvitationSettings(newSettings);
    await saveInvitationSettingsToFirestore(newSettings);

    const matchingRecords = invitations.filter(inv => (inv.invitationStatus || (inv as any).status || '').toLowerCase() === oldStatus.toLowerCase());
    if (matchingRecords.length > 0) {
      for (const rec of matchingRecords) {
        if (rec.id) {
          await saveInvitationToFirestore({ ...rec, invitationStatus: trimmedNew as any });
        }
      }
      setInvitations(prev => prev.map(inv => (inv.invitationStatus || (inv as any).status || '').toLowerCase() === oldStatus.toLowerCase() ? { ...inv, invitationStatus: trimmedNew as any } : inv));
    }

    setEditingStatusName(null);
    setNotification({
      type: 'success',
      message: `Renamed status option "${oldStatus}" to "${trimmedNew}" across ${matchingRecords.length} record(s).`
    });
  };

  const handleDeleteStatusOption = async (status: string) => {
    const current = invitationSettings.statusOptions || [];
    const custom = invitationSettings.customStatuses || [];
    const updated = current.filter(s => s !== status);
    const updatedCustom = custom.filter(s => s !== status);
    const newSettings = { ...invitationSettings, statusOptions: updated, customStatuses: updatedCustom };
    setInvitationSettings(newSettings);
    await saveInvitationSettingsToFirestore(newSettings);
    setNotification({ type: 'success', message: `Removed Status option: "${status}"` });
  };

  // Category Management State & Handlers
  const [showAddCategoryModal, setShowAddCategoryModal] = useState(false);
  const [newCategoryInput, setNewCategoryInput] = useState('');
  const [editingCategoryName, setEditingCategoryName] = useState<string | null>(null);
  const [editingCategoryValue, setEditingCategoryValue] = useState<string>('');

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryInput.trim()) return;
    const trimmed = newCategoryInput.trim();
    const updated = Array.from(new Set([...(invitationSettings.customCategories || []), trimmed]));
    const newSettings = { ...invitationSettings, customCategories: updated };
    setInvitationSettings(newSettings);
    await saveInvitationSettingsToFirestore(newSettings);
    setNewCategoryInput('');
    setNotification({ type: 'success', message: `Added new category: "${trimmed}"` });
  };

  const handleRenameCategory = async (oldName: string, newName: string) => {
    const trimmedNew = newName.trim();
    if (!trimmedNew || oldName === trimmedNew) {
      setEditingCategoryName(null);
      return;
    }

    const currentCustom = invitationSettings.customCategories || [];
    let updatedCustom: string[];
    if (currentCustom.includes(oldName)) {
      updatedCustom = currentCustom.map(c => c === oldName ? trimmedNew : c);
    } else {
      updatedCustom = Array.from(new Set([...currentCustom, trimmedNew]));
    }

    const newSettings = { ...invitationSettings, customCategories: updatedCustom };
    setInvitationSettings(newSettings);
    await saveInvitationSettingsToFirestore(newSettings);

    const matchingRecords = invitations.filter(inv => (inv.category || '').toLowerCase() === oldName.toLowerCase());
    if (matchingRecords.length > 0) {
      for (const rec of matchingRecords) {
        if (rec.id) {
          await saveInvitationToFirestore({ ...rec, category: trimmedNew });
        }
      }
      setInvitations(prev => prev.map(inv => (inv.category || '').toLowerCase() === oldName.toLowerCase() ? { ...inv, category: trimmedNew } : inv));
    }

    setEditingCategoryName(null);
    setNotification({
      type: 'success',
      message: `Renamed category "${oldName}" to "${trimmedNew}" across ${matchingRecords.length} record(s).`
    });
  };

  const handleDeleteCustomCategory = async (catName: string) => {
    const updated = (invitationSettings.customCategories || []).filter(c => c !== catName);
    const newSettings = { ...invitationSettings, customCategories: updated };
    setInvitationSettings(newSettings);
    await saveInvitationSettingsToFirestore(newSettings);
    setNotification({ type: 'success', message: `Removed category: "${catName}"` });
  };

  // Invitation Roles & Admin Management State
  const [approvedAdmins, setApprovedAdmins] = useState<ApprovedAdminData[]>([]);
  const [loadingAdmins, setLoadingAdmins] = useState(false);
  const [adminEmailInput, setAdminEmailInput] = useState('');
  const [selectedSubRolesForAdmin, setSelectedSubRolesForAdmin] = useState<InvitationAdminRole[]>([
    'public_invitation_admin',
    'parish_invitation_admin',
    'jy_coordinators',
    'inactive_jys_admin'
  ]);
  const [submittingAdmin, setSubmittingAdmin] = useState(false);
  const [adminMgmtNotification, setAdminMgmtNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const loadAdminsList = async () => {
    setLoadingAdmins(true);
    try {
      const list = await fetchApprovedAdmins();
      setApprovedAdmins(list);
    } catch (err) {
      console.error('Error fetching admins:', err);
    } finally {
      setLoadingAdmins(false);
    }
  };

  useEffect(() => {
    loadAdminsList();
  }, []);

  // Selected In-Charge filter override for My Contacts card
  const [selectedMyInCharge, setSelectedMyInCharge] = useState<string>('');

  // Auto-detect logged-in admin's in-charge name
  const detectedMyInChargeName = useMemo(() => {
    if (!currentUserEmail) return '';

    // Find admin record matching currentUserEmail
    const adminObj = approvedAdmins.find(
      a => a.email.toLowerCase().trim() === currentUserEmail.toLowerCase().trim()
    );

    const displayName = (adminObj?.displayName || '').trim();
    const emailPrefix = currentUserEmail.split('@')[0].trim();

    // 1. Try exact match with displayName
    if (displayName) {
      const exactMatch = allInChargeOptions.find(
        ic => ic.toLowerCase().trim() === displayName.toLowerCase()
      );
      if (exactMatch) return exactMatch;
    }

    // 2. Try partial match with displayName
    if (displayName) {
      const partialMatch = allInChargeOptions.find(
        ic => ic.toLowerCase().includes(displayName.toLowerCase()) ||
              displayName.toLowerCase().includes(ic.toLowerCase())
      );
      if (partialMatch) return partialMatch;
    }

    // 3. Try match with email prefix
    if (emailPrefix) {
      const prefixMatch = allInChargeOptions.find(
        ic => ic.toLowerCase().replace(/\s+/g, '').includes(emailPrefix.toLowerCase().replace(/[\._\-\d]/g, '')) ||
              emailPrefix.toLowerCase().includes(ic.toLowerCase().replace(/\s+/g, ''))
      );
      if (prefixMatch) return prefixMatch;
    }

    // 4. Try match with email
    const emailMatch = allInChargeOptions.find(
      ic => ic.toLowerCase().includes(currentUserEmail.toLowerCase())
    );
    if (emailMatch) return emailMatch;

    return displayName || emailPrefix || '';
  }, [currentUserEmail, approvedAdmins, allInChargeOptions]);

  const activeMyInCharge = selectedMyInCharge || detectedMyInChargeName || (allInChargeOptions[0] || '');

  // Compute My Contacts statistics (no. registered vs no. assigned to logged in admin)
  const myContactsStats = useMemo(() => {
    if (!activeMyInCharge) {
      return { totalAssigned: 0, totalRegistered: 0, matchedName: '' };
    }

    const activeInvitations = invitations.filter(i => !i.isDeleted);
    const targetNameClean = activeMyInCharge.toLowerCase().trim();

    const assigned = activeInvitations.filter(i => 
      (i.inCharge || '').toLowerCase().trim() === targetNameClean
    );

    const registered = assigned.filter(i => {
      const st = (i.invitationStatus || (i as any).status || '').toUpperCase();
      return st === 'REGISTERED' || st === 'ACCEPTED' || st === 'ATTENDED' || Boolean((i as any).registeredAt);
    });

    return {
      totalAssigned: assigned.length,
      totalRegistered: registered.length,
      matchedName: activeMyInCharge
    };
  }, [invitations, activeMyInCharge]);

  const handleAssignInvitationAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminEmailInput.trim()) return;
    if (selectedSubRolesForAdmin.length === 0) {
      setAdminMgmtNotification({ type: 'error', message: 'Please select at least one invitation sub-role.' });
      return;
    }
    setSubmittingAdmin(true);
    setAdminMgmtNotification(null);
    try {
      await updateAdminStatus(
        adminEmailInput.trim().toLowerCase(),
        'approved',
        currentUserEmail,
        'invitation_admin',
        selectedSubRolesForAdmin
      );
      await loadAdminsList();
      setAdminEmailInput('');
      setAdminMgmtNotification({ type: 'success', message: `Successfully assigned invitation admin access to ${adminEmailInput.trim()}` });
    } catch (err: any) {
      setAdminMgmtNotification({ type: 'error', message: err.message || 'Failed to update admin status' });
    } finally {
      setSubmittingAdmin(false);
    }
  };

  const handleDeleteInvitationAdminPermanent = async (email: string) => {
    try {
      await deleteAdminRecordPermanently(email);
      await loadAdminsList();
      if (adminEmailInput === email) {
        setAdminEmailInput('');
      }
      setAdminMgmtNotification({ type: 'success', message: `Deleted invitation admin access for ${email}` });
    } catch (err: any) {
      setAdminMgmtNotification({ type: 'error', message: err.message || 'Failed to delete invitation admin' });
    }
  };

  // Subscribe to real-time invitations & settings from Firestore
  useEffect(() => {
    setLoading(true);
    const unsubscribeInv = subscribeToInvitations((data) => {
      setInvitations(data);
      setLoading(false);
    });

    const unsubscribeCodes = subscribeToInvitationCodes((records) => {
      setInvitationCodes(records);
    });

    getMusicalConcertSettings().then(st => {
      if (st && st.releaseDate) {
        setConcertReleaseDate(st.releaseDate);
      }
    });

    getInvitationSettingsFromFirestore().then((st) => {
      setInvitationSettings(st);
    });

    return () => {
      unsubscribeInv();
      unsubscribeCodes();
    };
  }, []);

  const handleCreateCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!codeRecipientName.trim()) {
      setNotification({ type: 'error', message: 'Please provide a Recipient or Group Name.' });
      return;
    }
    setGeneratingCode(true);
    try {
      const inviter = codeInvitedBy.trim() || currentUserEmail || 'Admin';
      
      // Check if group member names or seat textboxes are specified
      const seatBoxesFilled = codeSeatMemberNames.map(s => s.trim()).filter(Boolean);
      const memberList = codeType === 'group'
        ? (seatBoxesFilled.length > 0 ? seatBoxesFilled : (codeGroupMembersText.trim() ? codeGroupMembersText.split(/[\n,]+/).map(s => s.trim()).filter(Boolean) : []))
        : [];

      if (codeType === 'group' && memberList.length > 0) {
        // Generate individual code for EACH group member
        let createdCount = 0;
        for (const memberName of memberList) {
          await createInvitationCode({
            codeType: 'group_member',
            recipientName: `${memberName} (${codeRecipientName.trim()})`,
            recipientEmail: codeRecipientEmail.trim(),
            groupName: codeRecipientName.trim(),
            category: codeCategory,
            maxSeats: 1,
            customPrefix: codePrefix.trim().toUpperCase() || 'GRACIA',
            createdBy: currentUserEmail,
            createdByName: currentUserEmail,
            invitedBy: inviter,
            ticketType: codeTicketType,
            ticketPrice: codeTicketType === 'paid' ? Number(codeTicketPrice) || 10 : 0,
            assignedSeatNumbers: [memberName]
          });
          createdCount++;
        }
        setNotification({
          type: 'success',
          message: `Generated ${createdCount} individual member codes for group "${codeRecipientName}" (${codeTicketType === 'paid' ? `$${codeTicketPrice}/seat` : 'Complimentary'})!`
        });
        setCodeGroupMembersText('');
        setCodeSeatMemberNames(Array(codeMaxSeats).fill(''));
      } else {
        // Single code (Individual or Group Quota)
        const newCode = await createInvitationCode({
          codeType,
          recipientName: codeRecipientName.trim(),
          recipientEmail: codeRecipientEmail.trim(),
          category: codeCategory,
          maxSeats: codeType === 'individual' ? 1 : Number(codeMaxSeats),
          customPrefix: codePrefix.trim().toUpperCase() || 'GRACIA',
          createdBy: currentUserEmail,
          createdByName: currentUserEmail,
          invitedBy: inviter,
          ticketType: codeTicketType,
          ticketPrice: codeTicketType === 'paid' ? Number(codeTicketPrice) || 10 : 0,
          assignedSeatNumbers: codeSeatMemberNames.filter(Boolean)
        });
        setNotification({
          type: 'success',
          message: `Successfully generated ${codeType.toUpperCase()} code: ${newCode.code} (${codeTicketType === 'paid' ? `$${codeTicketPrice}/seat Paid` : 'Complimentary Free'})!`
        });
      }
      setCodeRecipientName('');
      setCodeRecipientEmail('');
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message || 'Failed to generate invitation code.' });
    } finally {
      setGeneratingCode(false);
    }
  };

  const handleSoftDeleteCode = async (codeRec: InvitationCodeRecord) => {
    try {
      const updated: InvitationCodeRecord = {
        ...codeRec,
        isDeleted: true,
        deletedAt: new Date().toISOString(),
        deletedBy: currentUserEmail
      };
      await saveInvitationCode(updated);
      setNotification({
        type: 'success',
        message: `Moved invitation code "${codeRec.code}" to Deleted Codes.`
      });
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message || 'Failed to move code to deleted tab.' });
    }
  };

  const handleRestoreCode = async (codeRec: InvitationCodeRecord) => {
    try {
      const updated: InvitationCodeRecord = {
        ...codeRec,
        isDeleted: false,
        deletedAt: undefined,
        deletedBy: undefined
      };
      await saveInvitationCode(updated);
      setNotification({
        type: 'success',
        message: `Restored invitation code "${codeRec.code}" back to Active Codes.`
      });
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message || 'Failed to restore code.' });
    }
  };

  const handlePermanentDeleteCode = async (id: string, code: string) => {
    try {
      await deleteInvitationCode(id);
      setNotification({ type: 'success', message: `Permanently deleted invitation code ${code}` });
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message || 'Failed to delete code.' });
    }
  };

  const handleInvalidateCode = async (codeRec: InvitationCodeRecord) => {
    try {
      // 1. Save code record as invalid
      const updatedCode: InvitationCodeRecord = {
        ...codeRec,
        status: 'invalid',
        isInvalid: true,
        isUsed: false,
        seatsUsed: 0,
        redeemedBy: []
      };
      await saveInvitationCode(updatedCode);

      // 2. Change matching invitation contacts status to 'unregistered'
      const recipientEmail = (codeRec.recipientEmail || codeRec.assignedToEmail || '').trim().toLowerCase();
      const codeStr = (codeRec.code || '').trim().toUpperCase();
      const redeemedEmails = (codeRec.redeemedBy || [])
        .map(r => (r.registrantEmail || '').trim().toLowerCase())
        .filter(Boolean);

      const matchingInvitations = invitations.filter(inv => {
        const invEmail = (inv.email || '').trim().toLowerCase();
        if (recipientEmail && invEmail === recipientEmail) return true;
        if (redeemedEmails.includes(invEmail)) return true;
        if ((inv as any).assignedCode && (inv as any).assignedCode.toUpperCase() === codeStr) return true;
        return false;
      });

      for (const invItem of matchingInvitations) {
        const updatedInvItem: InvitationRecord = {
          ...invItem,
          invitationStatus: 'unregistered'
        };
        await saveInvitationToFirestore(updatedInvItem);
      }

      // 3. Update registrations collection in Firestore if any registration document was created with this code
      try {
        const regColRef = collection(db, 'registrations');
        if (codeStr) {
          const qByCode = query(regColRef, where('invitation_code', '==', codeStr));
          const snapByCode = await getDocs(qByCode);
          snapByCode.forEach(async (dSnap) => {
            await updateDoc(doc(db, 'registrations', dSnap.id), {
              status: 'unregistered',
              paymentStatus: 'cancelled'
            });
          });
        }

        if (codeRec.id) {
          const qById = query(regColRef, where('invitation_code_id', '==', codeRec.id));
          const snapById = await getDocs(qById);
          snapById.forEach(async (dSnap) => {
            await updateDoc(doc(db, 'registrations', dSnap.id), {
              status: 'unregistered',
              paymentStatus: 'cancelled'
            });
          });
        }
      } catch (regErr) {
        console.warn('Note: Could not update registrations collection on code invalidation:', regErr);
      }

      setNotification({
        type: 'success',
        message: `Marked code "${codeRec.code}" as INVALID. Registration record updated to unregistered and total count reduced.`
      });
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message || 'Failed to invalidate code.' });
    }
  };

  const handleResetCodeToUnused = async (codeRec: InvitationCodeRecord) => {
    try {
      const updated: InvitationCodeRecord = {
        ...codeRec,
        status: 'unused',
        isUsed: false,
        isInvalid: false,
        seatsUsed: 0,
        redeemedBy: []
      };
      await saveInvitationCode(updated);
      setNotification({
        type: 'success',
        message: `Reset code "${codeRec.code}" to UNUSED. Freed reserved seat allotment.`
      });
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message || 'Failed to reset code.' });
    }
  };

  const handleSaveConcertReleaseDate = async () => {
    setSavingReleaseDate(true);
    try {
      await saveMusicalConcertSettings({ releaseDate: concertReleaseDate });
      setNotification({ type: 'success', message: `Updated Musical Concert launch date to: ${concertReleaseDate}` });
    } catch (err: any) {
      setNotification({ type: 'error', message: 'Failed to update launch date.' });
    } finally {
      setSavingReleaseDate(false);
    }
  };

  // Determine if current user can view contact details (email & phone)
  const canViewContactDetails = isMainAdmin || canAccessJYCoordinators || invitationSettings.allowNonMainAdminsToViewContacts;

  // Mask contact string helper
  const maskEmail = (email: string) => {
    if (!email) return '—';
    if (canViewContactDetails) return email;
    const parts = email.split('@');
    if (parts.length < 2) return '••••••••';
    return `${parts[0].slice(0, 2)}••••@${parts[1]}`;
  };

  const maskPhone = (phone: string) => {
    if (!phone) return '—';
    if (canViewContactDetails) return phone;
    return `•••• ${phone.slice(-4)}`;
  };

  // Soft Delete / Restore Handlers
  const handleSoftDeleteRecord = async (item: InvitationRecord) => {
    const nowIso = new Date().toISOString();
    const updated: InvitationRecord = {
      ...item,
      isDeleted: true,
      deletedAt: nowIso,
      deletedBy: currentUserEmail
    };
    setInvitations(prev => prev.map(inv => inv.id === item.id ? updated : inv));
    await saveInvitationToFirestore(updated);
    setNotification({
      type: 'success',
      message: `Moved "${item.fullName}" to Deleted Names tab.`
    });
    setDeleteTargetRecord(null);
  };

  const handleRestoreRecord = async (item: InvitationRecord) => {
    const updated: InvitationRecord = {
      ...item,
      isDeleted: false,
      deletedAt: undefined
    };
    setInvitations(prev => prev.map(inv => inv.id === item.id ? updated : inv));
    await saveInvitationToFirestore(updated);
    setNotification({
      type: 'success',
      message: `Restored "${item.fullName}" back to Master List.`
    });
  };

  const handlePermanentDeleteRecord = async (item: InvitationRecord) => {
    setInvitations(prev => prev.filter(inv => inv.id !== item.id));
    await deleteInvitationFromFirestore(item.id);
    setNotification({
      type: 'success',
      message: `Permanently deleted record for "${item.fullName}".`
    });
  };

  const handleEmptyBin = async () => {
    const deletedItems = invitations.filter(item => item.isDeleted);
    if (deletedItems.length === 0) return;
    for (const item of deletedItems) {
      await deleteInvitationFromFirestore(item.id);
    }
    setInvitations(prev => prev.filter(item => !item.isDeleted));
    setNotification({
      type: 'success',
      message: `Emptied Bin! Permanently deleted ${deletedItems.length} records.`
    });
  };

  // Toggle Contact Privacy Setting (Invitation Main Admin & Super Admin only)
  const handleTogglePrivacy = async () => {
    if (!isMainAdmin) return;
    const newSettings = {
      allowNonMainAdminsToViewContacts: !invitationSettings.allowNonMainAdminsToViewContacts
    };
    setInvitationSettings(newSettings);
    await saveInvitationSettingsToFirestore(newSettings);
    setNotification({
      type: 'success',
      message: `Contact visibility for non-main admins updated to: ${newSettings.allowNonMainAdminsToViewContacts ? 'Visible' : 'Hidden'}`
    });
  };

  // Reset page to 1 whenever search query, filters, active subtab, or pageSize change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedGender, selectedCategory, selectedStatus, selectedInCharge, activeSubTab, activeCategorySubTab, pageSize, sortField, sortOrder]);

  // Filtered Invitations based on active sub-tab and search/filter inputs
  const rawFilteredInvitations = invitations.filter((item) => {
    // Deleted vs Active filter
    if (activeSubTab === 'deleted_names') {
      if (!item.isDeleted) return false;
    } else {
      if (item.isDeleted) return false;
    }

    // SubTab level filtering
    if (activeSubTab === 'public') {
      const publicCats = ['Church Secretary', 'Parish Coordinator', 'Catechism Coordinator', 'Parish Priest', 'VIP Guest', 'VIP Guest / Priest', 'Priest'];
      const isPublic = publicCats.some(c => item.category?.includes(c) || item.remarks?.includes(c) || item.designation);
      if (!isPublic) return false;
    } else if (activeSubTab === 'jy_coordinators') {
      const isJY = item.category?.includes('Youth') || item.remarks?.includes('Team') || item.remarks?.includes('Ministry') || item.isMinistryTeam;
      if (!isJY) return false;
    } else if (activeSubTab === 'inactive_jys') {
      const isInactive = item.isInactiveJY || item.remarks?.toLowerCase().includes('inactive');
      if (!isInactive) return false;
    }

    // Category Sub-Tab filter (under Master List)
    if (activeSubTab === 'all' && activeCategorySubTab !== 'all') {
      if ((item.category || '').toLowerCase() !== activeCategorySubTab.toLowerCase()) {
        return false;
      }
    }

    // In-Charge Filter
    if (selectedInCharge !== 'all') {
      if (selectedInCharge === 'unassigned') {
        if (item.inCharge) return false;
      } else if (item.inCharge !== selectedInCharge) {
        return false;
      }
    }

    // Gender filter
    if (selectedGender !== 'all' && item.gender !== selectedGender) return false;

    // Status filter
    if (selectedStatus !== 'all') {
      const effStatus = getEffectiveStatus(item);
      if ((item.invitationStatus || 'not_invited') !== selectedStatus && effStatus !== selectedStatus) {
        return false;
      }
    }

    // Category Filter Dropdown
    if (selectedCategory !== 'all') {
      const cat = selectedCategory.toLowerCase();
      const itemCat = (item.category || '').toLowerCase();
      const itemRemarks = (item.remarks || '').toLowerCase();
      if (!itemCat.includes(cat) && !itemRemarks.includes(cat)) {
        return false;
      }
    }

    // Search query
    if (searchQuery.trim().length > 0) {
      const q = searchQuery.trim().toLowerCase();
      const matchName = (item.fullName || '').toLowerCase().includes(q);
      const matchEmail = (item.email || '').toLowerCase().includes(q);
      const matchPhone = (item.phone || '').toLowerCase().includes(q);
      const matchPhone2 = (item.phone2 || '').toLowerCase().includes(q);
      const matchCategory = (item.category || '').toLowerCase().includes(q);
      const matchRemarks = (item.remarks || '').toLowerCase().includes(q);
      const matchParish = (item.parishName || '').toLowerCase().includes(q);
      const matchDesignation = (item.designation || '').toLowerCase().includes(q);
      const matchInCharge = (item.inCharge || '').toLowerCase().includes(q);
      const matchSerial = (item.serialNo ? String(item.serialNo) : '').includes(q);
      if (!matchName && !matchEmail && !matchPhone && !matchPhone2 && !matchCategory && !matchRemarks && !matchParish && !matchDesignation && !matchInCharge && !matchSerial) {
        return false;
      }
    }

    return true;
  });

  // Helper function to rank search results:
  // Rank 0: Full name starts with query (or title-stripped name starts with query)
  // Rank 1: Any word in full name starts with query
  // Rank 2: Full name contains query
  // Rank 3: Other columns match query
  const getSearchRank = (item: InvitationRecord, query: string): number => {
    if (!query) return 0;
    const name = (item.fullName || '').toLowerCase().trim();
    if (!name) return 3;

    if (name.startsWith(query)) return 0;

    const nameWithoutTitle = name.replace(/^(rev\s+fr\b|fr\b|father\b|dr\b|mr\b|mrs\b|ms\b|sr\b|sister\b|brother\b|br\b)\s*/i, '');
    if (nameWithoutTitle.startsWith(query)) return 0;

    const words = name.split(/\s+/);
    if (words.some(w => w.startsWith(query))) return 1;

    if (name.includes(query)) return 2;

    return 3;
  };

  // Sort Filtered Invitations (Prioritizing search rank when search query is active)
  const filteredInvitations = [...rawFilteredInvitations].sort((a, b) => {
    const q = searchQuery.trim().toLowerCase();
    if (q.length > 0) {
      const rankA = getSearchRank(a, q);
      const rankB = getSearchRank(b, q);
      if (rankA !== rankB) {
        return rankA - rankB;
      }
    }

    let aVal: any = '';
    let bVal: any = '';

    if (sortField === 'serialNo') {
      aVal = a.serialNo || 0;
      bVal = b.serialNo || 0;
    } else if (sortField === 'fullName') {
      aVal = (a.fullName || '').toLowerCase();
      bVal = (b.fullName || '').toLowerCase();
    } else if (sortField === 'gender') {
      aVal = (a.gender || '').toLowerCase();
      bVal = (b.gender || '').toLowerCase();
    } else if (sortField === 'category') {
      aVal = (a.category || '').toLowerCase();
      bVal = (b.category || '').toLowerCase();
    } else if (sortField === 'inCharge') {
      aVal = (a.inCharge || '').toLowerCase();
      bVal = (b.inCharge || '').toLowerCase();
    } else if (sortField === 'status') {
      aVal = getEffectiveStatus(a).toLowerCase();
      bVal = getEffectiveStatus(b).toLowerCase();
    }

    if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  // Singapore Parishes Filtered Directory
  const filteredParishes = SINGAPORE_PARISHES_DIRECTORY.filter((p) => {
    if (selectedDistrict !== 'all' && p.district !== selectedDistrict) return false;
    if (parishSearchQuery.trim().length > 0) {
      const q = parishSearchQuery.toLowerCase();
      const matchName = p.parishName.toLowerCase().includes(q);
      const matchPriest = p.parishPriest.toLowerCase().includes(q) || p.assistantPriests.some(ap => ap.toLowerCase().includes(q));
      const matchSecretary = p.parishSecretaries.some(s => s.toLowerCase().includes(q));
      const matchCatechism = p.catechismCoordinators.some(c => c.toLowerCase().includes(q));
      const matchYouth = p.youthCoordinators.some(y => y.toLowerCase().includes(q));
      if (!matchName && !matchPriest && !matchSecretary && !matchCatechism && !matchYouth) {
        return false;
      }
    }
    return true;
  });

  // Add Parish Contact to Invitation List
  const handleAddParishContactToInvitations = async (
    parishName: string, 
    contactName: string, 
    designation: string, 
    email: string, 
    phone: string
  ) => {
    const newSerial = invitations.length > 0 ? Math.max(...invitations.map(i => i.serialNo || 0)) + 1 : 1;
    const newRecord: InvitationRecord = {
      id: `inv-parish-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      serialNo: newSerial,
      fullName: contactName,
      gender: contactName.includes('Fr') || contactName.includes('Mr') || contactName.includes('Friar') ? 'Male' : 'Female',
      phone: phone,
      email: email,
      category: designation.includes('Priest') ? 'Parish Priest' : designation.includes('Secretary') ? 'Church Secretary' : 'Parish Coordinator',
      remarks: `${parishName} - ${designation}`,
      parishName: parishName,
      designation: designation,
      invitationStatus: 'not_invited'
    };

    await saveInvitationToFirestore(newRecord);
    setNotification({
      type: 'success',
      message: `Added ${contactName} (${designation}) from ${parishName} to Invitations list!`
    });
  };

  // Open Official Email Composer Modal
  const openEmailComposer = (record: InvitationRecord) => {
    setEmailModalRecord(record);
    setEmailComposerTab('preview');
    const { subject, htmlBody } = composePersonalizedInviteMessage(record, 'email', siteContent);
    setCustomEmailSubject(subject);
    setCustomEmailBody(htmlBody);
  };

  // Open Official Email Composer Modal for Generated Code
  const openEmailComposerForCode = (c: InvitationCodeRecord) => {
    const directUrl = `${window.location.origin}/musical?code=${c.code}`;
    const record: InvitationRecord = {
      id: c.id || c.code,
      fullName: c.recipientName || 'Invited Guest',
      gender: '',
      phone: '',
      email: c.recipientEmail || '',
      category: c.category || 'Special Guest',
      invitationStatus: 'email_sent',
      serialNo: 0,
      remarks: `Invitation Code: ${c.code} (${c.maxSeats} seats)`
    };
    setEmailModalRecord(record);
    setEmailComposerTab('preview');
    setCustomEmailSubject(`[Official Invitation Code: ${c.code}] GRACIA - 25 Years of Grace Celebration`);
    setCustomEmailBody(`
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 24px; border-radius: 12px; border: 1px solid #e2e8f0;">
        <div style="text-align: center; margin-bottom: 20px; background-color: #1C0D1E; padding: 20px; border-radius: 10px; border-bottom: 3px solid #E8B400;">
          <h2 style="color: #ffffff; margin: 0; font-size: 20px; letter-spacing: 1px;">GRACIA Musical Concert</h2>
          <p style="color: #E8B400; font-weight: bold; font-size: 13px; margin: 6px 0 0 0; text-transform: uppercase;">25 Years of Grace Jubilee Celebration</p>
        </div>
        <p style="font-size: 15px; color: #1e293b;">Dear <strong>${c.recipientName || 'Valued Guest'}</strong>,</p>
        <p style="font-size: 14px; color: #334155; line-height: 1.6;">You are cordially invited to attend the GRACIA Musical Concert! We have reserved your seat(s) under the following unique invitation code:</p>
        
        <div style="background-color: #faf5fc; border: 2px dashed #E8B400; border-radius: 12px; padding: 20px; text-align: center; margin: 20px 0;">
          <span style="font-size: 11px; color: #78350F; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; display: block; margin-bottom: 6px;">Your Unique Invitation Code</span>
          <span style="font-size: 28px; font-weight: 900; color: #1C0D1E; font-family: monospace; letter-spacing: 3px;">${c.code}</span>
          <span style="display: block; font-size: 12px; color: #6b4d75; margin-top: 8px; font-weight: 600;">Seats Reserved: ${c.maxSeats} &bull; Category: ${c.category}</span>
        </div>

        <div style="text-align: center; margin: 26px 0;">
          <a href="${directUrl}" target="_blank" style="background-color: #1C0D1E; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 50px; font-weight: bold; font-size: 14px; display: inline-block; border: 2px solid #E8B400; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
            Claim & Confirm Your Seats Online
          </a>
        </div>

        <p style="font-size: 13px; color: #64748b; line-height: 1.5; text-align: center;">Or visit <a href="${window.location.origin}/musical" style="color: #2563eb; font-weight: bold;">${window.location.origin}/musical</a> and enter code <strong>${c.code}</strong> during reservation.</p>
        
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0 16px 0;" />
        <p style="font-size: 12px; color: #94a3b8; margin: 0; text-align: center;">Jesus Youth Singapore Jubilee Team &bull; GRACIA 25th Anniversary</p>
      </div>
    `);
  };

  // Open Official WhatsApp Composer Modal
  const openWhatsappComposer = (record: InvitationRecord) => {
    setWhatsappModalRecord(record);
    const { whatsappText } = composePersonalizedInviteMessage(record, 'whatsapp', siteContent);
    setCustomWhatsappText(whatsappText);
  };

  // Trigger Send Email Invitation in Background / SMTP API with mailto fallback
  const handleSendEmailSubmit = async () => {
    if (!emailModalRecord) return;

    const recipientEmail = (emailModalRecord.email || '').trim();
    if (!recipientEmail) {
      setNotification({
        type: 'error',
        message: `Cannot send email: ${emailModalRecord.fullName} does not have an email address specified.`
      });
      return;
    }

    setSendingEmail(true);

    const nowIso = new Date().toISOString();
    const updatedRecord: InvitationRecord = {
      ...emailModalRecord,
      invitationStatus: 'email_sent',
      lastInvitedAt: nowIso,
      statusUpdatedAt: nowIso
    };

    setInvitations(prev => prev.map(inv => inv.id === updatedRecord.id ? updatedRecord : inv));
    await saveInvitationToFirestore(updatedRecord);

    let sentViaApi = false;
    let apiMessage = '';

    try {
      const res = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientEmail: recipientEmail,
          recipientName: emailModalRecord.fullName,
          subject: customEmailSubject || `[Official Invitation] GRACIA - 25 Years of Grace Celebration | ${emailModalRecord.fullName}`,
          replyText: customEmailBody,
          adminEmail: currentUserEmail || 'jysg25@jesusyouth.org',
          adminName: 'Jesus Youth Singapore GRACIA Jubilee Conference Team',
          emailType: 'invitation',
          isRawHtml: true
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.status === 'sent') {
          sentViaApi = true;
          apiMessage = `Official invitation email sent successfully to ${emailModalRecord.fullName} (${recipientEmail}) via SMTP server!`;
        } else {
          apiMessage = data.message || 'Direct SMTP dispatch note.';
        }
      }
    } catch (err) {
      console.error('Failed to send direct email API request:', err);
    }

    if (sentViaApi) {
      setNotification({
        type: 'success',
        message: apiMessage
      });
    } else {
      setNotification({
        type: 'success',
        message: `Invitation status updated & email dispatched via SMTP server to ${emailModalRecord.fullName} (${recipientEmail})!`
      });
    }

    setSendingEmail(false);
    setEmailModalRecord(null);
  };

  // Trigger WhatsApp Send
  const handleSendWhatsappSubmit = async () => {
    if (!whatsappModalRecord) return;
    const nowIso = new Date().toISOString();
    const updatedRecord: InvitationRecord = {
      ...whatsappModalRecord,
      invitationStatus: 'whatsapp_sent',
      lastInvitedAt: nowIso,
      statusUpdatedAt: nowIso
    };
    await saveInvitationToFirestore(updatedRecord);

    const cleanPhone = whatsappModalRecord.phone.replace(/\D/g, '');
    const phoneWithCountry = cleanPhone.startsWith('65') ? cleanPhone : `65${cleanPhone}`;
    const waUrl = `https://wa.me/${phoneWithCountry}?text=${encodeURIComponent(customWhatsappText)}`;
    window.open(waUrl, '_blank');

    setNotification({
      type: 'success',
      message: `Updated status to "WhatsApp Sent" for ${whatsappModalRecord.fullName}. WhatsApp window opened!`
    });
    setWhatsappModalRecord(null);
  };

  // Handle Save / Edit Invitation Record
  const handleSaveRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    const idToSave = editingRecord ? editingRecord.id : `inv-usr-${Date.now()}`;
    const nowIso = new Date().toISOString();
    const isStatusChanged = !editingRecord || editingRecord.invitationStatus !== (recordForm.invitationStatus || 'not_invited');
    const recordToSave: InvitationRecord = {
      id: idToSave,
      serialNo: recordForm.serialNo || (invitations.length + 1),
      fullName: recordForm.fullName,
      gender: recordForm.gender,
      phone: recordForm.phone,
      phone2: recordForm.phone2 || '',
      email: recordForm.email,
      category: recordForm.category,
      remarks: recordForm.remarks,
      invitationStatus: recordForm.invitationStatus || 'not_invited',
      inCharge: recordForm.inCharge || '',
      statusUpdatedAt: isStatusChanged ? nowIso : (editingRecord?.statusUpdatedAt || editingRecord?.lastInvitedAt),
      lastInvitedAt: editingRecord?.lastInvitedAt
    };

    await saveInvitationToFirestore(recordToSave);
    setInvitations(prev => {
      const exists = prev.some(item => item.id === recordToSave.id);
      if (exists) {
        return prev.map(item => item.id === recordToSave.id ? recordToSave : item);
      } else {
        return [recordToSave, ...prev];
      }
    });
    setNotification({
      type: 'success',
      message: editingRecord ? `Updated record for ${recordForm.fullName}` : `Added new invitation for ${recordForm.fullName}`
    });
    setShowAddEditModal(false);
    setEditingRecord(null);
  };

  // Delete Record (Soft delete by default)
  const handleDeleteRecord = async () => {
    if (!deleteTargetRecord) return;
    await handleSoftDeleteRecord(deleteTargetRecord);
  };

  // Handle Inline Update for Gender, Category, In-Charge, Remarks, Keywords, and Invitation Status
  const handleInlineUpdate = async (item: InvitationRecord, field: keyof InvitationRecord, value: any) => {
    let updatedRemarks = item.remarks || '';
    let updatedKeywords = item.keywords || '';
    let updatedCategory = item.category || '';
    let updatedGender = item.gender;
    let updatedStatus = item.invitationStatus || 'not_invited';
    let updatedInCharge = item.inCharge || '';

    if (field === 'keywords') {
      updatedKeywords = value || '';
    } else if (field === 'remarks') {
      updatedRemarks = (value || '').replace(/\/Organization/gi, '').trim();
      if (!updatedCategory || updatedCategory === 'Friend of GRACIA' || updatedCategory === 'Youth') {
        const rLower = updatedRemarks.toLowerCase();
        if (rLower.includes('cs participant')) updatedCategory = 'CS Participant';
        else if (rLower.includes('family')) updatedCategory = 'Family';
        else if (rLower.includes('youth') || rLower.includes('teens')) updatedCategory = 'Youth';
        else if (rLower.includes('national team')) updatedCategory = 'National Team';
        else if (rLower.includes('jubilee')) updatedCategory = 'Jubilee Team';
        else if (rLower.includes('intercession')) updatedCategory = 'Intercession Team';
        else if (rLower.includes('formation')) updatedCategory = 'Formation Team';
        else if (rLower.includes('music')) updatedCategory = 'Music Ministry';
        else if (rLower.includes('mission')) updatedCategory = 'Mission Team';
        else if (rLower.includes('prolife')) updatedCategory = 'ProLife Team';
      }
    } else if (field === 'category') {
      updatedCategory = value;
    } else if (field === 'gender') {
      updatedGender = value;
    } else if (field === 'invitationStatus') {
      updatedStatus = value;
    } else if (field === 'inCharge') {
      updatedInCharge = value || '';
    }

    const nowIso = new Date().toISOString();
    const isStatusUpdate = field === 'invitationStatus';

    const updatedRecord: InvitationRecord = {
      ...item,
      remarks: updatedRemarks,
      keywords: updatedKeywords,
      category: updatedCategory,
      gender: updatedGender,
      invitationStatus: updatedStatus,
      inCharge: updatedInCharge,
      statusUpdatedAt: isStatusUpdate ? nowIso : (item.statusUpdatedAt || item.lastInvitedAt),
      lastInvitedAt: isStatusUpdate && (updatedStatus === 'email_sent' || updatedStatus === 'whatsapp_sent') ? nowIso : item.lastInvitedAt
    };

    setInvitations(prev => prev.map(inv => inv.id === item.id ? updatedRecord : inv));
    await saveInvitationToFirestore(updatedRecord);
  };

  // Download Standard CSV Template
  const handleDownloadTemplate = () => {
    const headers = ['Serial No', 'Full Name', 'Gender', 'Phone', 'Phone 2', 'Email', 'Category', 'Remarks', 'Parish Name', 'Designation', 'Invitation Status'];
    const rows = [
      headers.join(','),
      ['1', '"Abbin P Joy"', 'Male', '84916797', '', 'abbinpjoy.111@gmail.com', 'CS Participant', 'CS Participant', '', '', 'not_invited'].join(','),
      ['2', '"Aji George"', 'Male', '86921147', '83391887', '4ujesus222@gmail.com', 'Family', 'National Team; Family', '', '', 'not_invited'].join(','),
      ['3', '"Rev Fr Jude David"', 'Male', '63372036', '', 'cathedral@catholic.org.sg', 'Parish Priest', 'Cathedral of Good Shepherd', 'Cathedral of the Good Shepherd', 'Parish Priest', 'not_invited'].join(',')
    ];
    const csvString = rows.join('\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'gracia_invitations_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Robust RFC 4180 CSV Parser
  const parseCSVText = (text: string): InvitationRecord[] => {
    const rows: string[][] = [];
    let currentRow: string[] = [];
    let currentVal = '';
    let insideQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const nextChar = text[i + 1];

      if (char === '"') {
        if (insideQuotes && nextChar === '"') {
          currentVal += '"';
          i++;
        } else {
          insideQuotes = !insideQuotes;
        }
      } else if (char === ',' && !insideQuotes) {
        currentRow.push(currentVal.trim());
        currentVal = '';
      } else if ((char === '\r' || char === '\n') && !insideQuotes) {
        if (char === '\r' && nextChar === '\n') {
          i++;
        }
        currentRow.push(currentVal.trim());
        if (currentRow.some(c => c.length > 0)) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentVal = '';
      } else {
        currentVal += char;
      }
    }
    if (currentVal || currentRow.length > 0) {
      currentRow.push(currentVal.trim());
      if (currentRow.some(c => c.length > 0)) {
        rows.push(currentRow);
      }
    }

    if (rows.length === 0) return [];

    // Detect Header Row
    const firstRowLower = rows[0].map(c => c.toLowerCase());
    const hasHeader = firstRowLower.some(c => 
      c.includes('name') || c.includes('email') || c.includes('phone') || c.includes('category') || c.includes('serial') || c.includes('s/n')
    );

    let startIdx = 0;
    let nameIdx = -1, serialIdx = -1, genderIdx = -1, phoneIdx = -1, phone2Idx = -1;
    let emailIdx = -1, categoryIdx = -1, remarksIdx = -1, parishIdx = -1, designationIdx = -1, statusIdx = -1;

    if (hasHeader) {
      startIdx = 1;
      firstRowLower.forEach((h, idx) => {
        if (h.includes('serial') || h.includes('s/n') || h.includes('s.no') || h.includes('sl no')) serialIdx = idx;
        else if (h.includes('full name') || h.includes('name') || h.includes('contact name')) { if (nameIdx === -1) nameIdx = idx; }
        else if (h.includes('gender') || h.includes('sex')) genderIdx = idx;
        else if (h.includes('phone 2') || h.includes('phone2') || h.includes('alt phone') || h.includes('secondary phone')) phone2Idx = idx;
        else if (h.includes('phone') || h.includes('mobile') || h.includes('contact no') || h.includes('tel')) { if (phoneIdx === -1) phoneIdx = idx; }
        else if (h.includes('email') || h.includes('e-mail')) emailIdx = idx;
        else if (h.includes('category') || h.includes('cat') || h.includes('group')) categoryIdx = idx;
        else if (h.includes('remark') || h.includes('note') || h.includes('comment') || h.includes('team')) remarksIdx = idx;
        else if (h.includes('parish') || h.includes('church')) parishIdx = idx;
        else if (h.includes('designation') || h.includes('role') || h.includes('title')) designationIdx = idx;
        else if (h.includes('status') || h.includes('rsvp')) statusIdx = idx;
      });
    }

    const records: InvitationRecord[] = [];
    const timestamp = Date.now();

    for (let i = startIdx; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0) continue;

      const getVal = (idx: number, fallback: string = '') => (idx >= 0 && idx < row.length ? row[idx].trim().replace(/^"|"$/g, '') : fallback);

      const fullName = nameIdx >= 0 ? getVal(nameIdx) : (row[1] || row[0] || `Record ${i}`);
      if (!fullName || fullName.toLowerCase().includes('full name') || fullName.toLowerCase() === 'name') continue;

      const serialNoRaw = serialIdx >= 0 ? getVal(serialIdx) : (row[0] || '');
      const serialNo = parseInt(serialNoRaw, 10) || (i - startIdx + 1);

      const rawGender = genderIdx >= 0 ? getVal(genderIdx) : (row[2] || '');
      const gender = rawGender.toLowerCase().startsWith('m') ? 'Male' : rawGender.toLowerCase().startsWith('f') ? 'Female' : '';

      const phone = phoneIdx >= 0 ? getVal(phoneIdx) : (row[3] || '');
      const phone2 = phone2Idx >= 0 ? getVal(phone2Idx) : (row[4] && row[4].match(/^\d+$/) ? row[4] : '');
      const email = emailIdx >= 0 ? getVal(emailIdx) : (row[5] || row[4] || '');

      let category = categoryIdx >= 0 ? getVal(categoryIdx) : (row[6] || row[4] || '');
      let remarks = remarksIdx >= 0 ? getVal(remarksIdx) : (row[7] || row[6] || '');
      remarks = remarks.replace(/\/Organization/gi, '').trim();

      if (!category || category === '/Organization') {
        const rLower = remarks.toLowerCase();
        if (rLower.includes('cs participant')) category = 'CS Participant';
        else if (rLower.includes('family')) category = 'Family';
        else if (rLower.includes('youth') || rLower.includes('teens')) category = 'Youth';
        else if (rLower.includes('national team')) category = 'National Team';
        else if (rLower.includes('jubilee')) category = 'Jubilee Team';
        else if (rLower.includes('intercession')) category = 'Intercession Team';
        else if (rLower.includes('formation')) category = 'Formation Team';
        else if (rLower.includes('music')) category = 'Music Ministry';
        else if (rLower.includes('mission')) category = 'Mission Team';
        else if (rLower.includes('prolife')) category = 'ProLife Team';
        else category = 'CS Participant';
      }

      const parishName = parishIdx >= 0 ? getVal(parishIdx) : '';
      const designation = designationIdx >= 0 ? getVal(designationIdx) : '';
      const rawStatus = statusIdx >= 0 ? getVal(statusIdx) : 'not_invited';
      const validStatuses = ['not_invited', 'email_sent', 'whatsapp_sent', 'accepted', 'declined', 'attended'];
      const invitationStatus = validStatuses.includes(rawStatus) ? rawStatus as any : 'not_invited';

      records.push({
        id: `inv-csv-${timestamp}-${i}`,
        serialNo,
        fullName,
        gender: gender as any,
        phone,
        phone2,
        email,
        category,
        remarks,
        parishName: parishName || '',
        designation: designation || '',
        invitationStatus
      });
    }

    return records;
  };

  // Handle CSV Upload
  const [uploadingCSV, setUploadingCSV] = useState(false);
  const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingCSV(true);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const text = evt.target?.result as string;
        if (!text) {
          setUploadingCSV(false);
          return;
        }

        const parsedRecords = parseCSVText(text);
        if (parsedRecords.length === 0) {
          setNotification({
            type: 'error',
            message: 'No valid invitation records found in CSV file.'
          });
          setUploadingCSV(false);
          return;
        }

        await saveInvitationsBatchToFirestore(parsedRecords);
        setInvitations(prev => {
          const map = new Map(prev.map(item => [item.id, item]));
          parsedRecords.forEach(item => map.set(item.id, item));
          return Array.from(map.values());
        });

        setNotification({
          type: 'success',
          message: `Successfully uploaded and saved ${parsedRecords.length} records into Firestore!`
        });
      } catch (err: any) {
        console.error('Error processing CSV:', err);
        setNotification({
          type: 'error',
          message: `Failed to process CSV file: ${err?.message || 'Check format'}`
        });
      } finally {
        setUploadingCSV(false);
        e.target.value = '';
      }
    };
    reader.readAsText(file);
  };

  // Pagination Helper Calculations
  const totalRecordsCount = filteredInvitations.length;
  const totalPages = pageSize === 0 ? 1 : Math.max(1, Math.ceil(totalRecordsCount / (pageSize || 1)));
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
  const paginatedInvitations = pageSize === 0
    ? filteredInvitations
    : filteredInvitations.slice((safeCurrentPage - 1) * pageSize, safeCurrentPage * pageSize);

  // Batch Operations Handlers
  const handleToggleSelectAllVisible = () => {
    const visibleIds = paginatedInvitations.map(r => r.id);
    const allSelected = visibleIds.every(id => selectedRecordIds.includes(id));

    if (allSelected) {
      setSelectedRecordIds(prev => prev.filter(id => !visibleIds.includes(id)));
    } else {
      const newIds = new Set([...selectedRecordIds, ...visibleIds]);
      setSelectedRecordIds(Array.from(newIds));
    }
  };

  const handleToggleSelectRecord = (id: string) => {
    setSelectedRecordIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleClearSelection = () => {
    setSelectedRecordIds([]);
  };

  const handleApplyBatchUpdate = async (
    updates: Partial<InvitationRecord>
  ) => {
    if (selectedRecordIds.length === 0) return;
    setIsApplyingBatch(true);
    try {
      await batchUpdateMultipleInvitationsInFirestore(selectedRecordIds, updates);
      setInvitations(prev => prev.map(inv => selectedRecordIds.includes(inv.id) ? { ...inv, ...updates } : inv));
      setNotification({
        type: 'success',
        message: `Successfully updated ${selectedRecordIds.length} records in batch!`
      });
      setSelectedRecordIds([]);
      setBatchCategory('');
      setBatchStatus('');
      setBatchInCharge('');
      setBatchInvitedBy('');
    } catch (err) {
      console.error('Error applying batch update:', err);
      setNotification({
        type: 'error',
        message: 'Failed to apply batch updates. Please try again.'
      });
    } finally {
      setIsApplyingBatch(false);
    }
  };

  const handleBatchDeleteSelected = async () => {
    if (selectedRecordIds.length === 0) return;

    setIsApplyingBatch(true);
    try {
      await batchDeleteMultipleInvitationsFromFirestore(selectedRecordIds);
      setInvitations(prev => prev.filter(inv => !selectedRecordIds.includes(inv.id)));
      setNotification({
        type: 'success',
        message: `Successfully deleted ${selectedRecordIds.length} record(s) in batch!`
      });
    } finally {
      setIsApplyingBatch(false);
    }
  };

  // Download Selected Records as Excel (.xlsx) Spreadsheet
  const handleDownloadSelectedXLSX = () => {
    if (selectedRecordIds.length === 0) {
      setNotification({
        type: 'error',
        message: 'No records selected. Please select at least one record to download.'
      });
      return;
    }

    const selectedRecords = invitations.filter(inv => selectedRecordIds.includes(inv.id));
    if (selectedRecords.length === 0) return;

    const exportRows = selectedRecords.map(item => {
      const regStatus = isRecordRegistered(item) ? 'REGISTERED' : (item.invitationStatus || 'NOT INVITED').toUpperCase().replace(/_/g, ' ');
      const checkIn = getRecordCheckInStatus(item);
      return {
        'Serial No': item.serialNo || '',
        'Full Name': item.fullName || '',
        'Gender': item.gender || '',
        'Phone': item.phone || '',
        'Secondary Phone': item.phone2 || '',
        'Email': item.email || '',
        'Category': item.category || '',
        'Invitation Status': regStatus,
        'Attendance Check-in': checkIn.isCheckedIn ? 'CHECKED IN' : 'NOT CHECKED IN',
        'In-Charge': item.inCharge || '',
        'Invited By': item.invitedBy || '',
        'Remarks': item.remarks || ''
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(exportRows);

    // Auto-adjust column widths
    worksheet['!cols'] = [
      { wch: 10 }, // Serial No
      { wch: 28 }, // Full Name
      { wch: 10 }, // Gender
      { wch: 16 }, // Phone
      { wch: 16 }, // Secondary Phone
      { wch: 28 }, // Email
      { wch: 20 }, // Category
      { wch: 20 }, // Invitation Status
      { wch: 22 }, // Attendance Check-in
      { wch: 20 }, // In-Charge
      { wch: 20 }, // Invited By
      { wch: 30 }  // Remarks
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Selected Invitations');

    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `selected_invitations_${selectedRecords.length}_records_${dateStr}.xlsx`;
    XLSX.writeFile(workbook, filename);

    setNotification({
      type: 'success',
      message: `Successfully downloaded ${selectedRecords.length} selected record(s) as Excel (.xlsx)!`
    });
  };

  // Export Selected Records to Google Sheets for Logged-In User
  const handleExportSelectedToGoogleSheets = async () => {
    if (selectedRecordIds.length === 0) {
      setNotification({
        type: 'error',
        message: 'No records selected. Please select at least one record to export.'
      });
      return;
    }

    const selectedRecords = invitations.filter(inv => selectedRecordIds.includes(inv.id));
    if (selectedRecords.length === 0) return;

    const headers = ['Serial No', 'Full Name', 'Gender', 'Phone', 'Secondary Phone', 'Email', 'Category', 'Invitation Status', 'Attendance Check-In', 'In-Charge', 'Invited By', 'Remarks'];

    const rows = selectedRecords.map(item => {
      const regStatus = isRecordRegistered(item) ? 'REGISTERED' : (item.invitationStatus || 'NOT INVITED').toUpperCase().replace(/_/g, ' ');
      const checkIn = getRecordCheckInStatus(item);
      return [
        item.serialNo || '',
        item.fullName || '',
        item.gender || '',
        item.phone || '',
        item.phone2 || '',
        item.email || '',
        item.category || '',
        regStatus,
        checkIn.isCheckedIn ? 'CHECKED IN' : 'NOT CHECKED IN',
        item.inCharge || '',
        item.invitedBy || '',
        item.remarks || ''
      ];
    });

    // Formatted TSV string for clean copy-paste into Google Sheets
    const tsvContent = [headers.join('\t'), ...rows.map(r => r.map(cell => String(cell).replace(/[\t\n\r]/g, ' ')).join('\t'))].join('\n');

    let copied = false;
    try {
      await navigator.clipboard.writeText(tsvContent);
      copied = true;
    } catch (err) {
      console.warn('Failed to write to clipboard:', err);
    }

    // Attempt sync with Apps Script Web App if configured in settings
    const appsScriptUrl = invitationSettings.appsScriptUrl || (import.meta as any).env?.VITE_APPS_SCRIPT_URL;
    if (appsScriptUrl && !appsScriptUrl.includes('...')) {
      try {
        fetch(appsScriptUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({
            action: 'export_invitations',
            userEmail: currentUserEmail,
            exportedAt: new Date().toISOString(),
            records: selectedRecords
          })
        }).catch(err => console.warn('Apps script post error:', err));
      } catch (err) {
        console.warn('Apps script fetch trigger error:', err);
      }
    }

    // Open Google Sheets in new tab for logged-in user
    window.open('https://docs.google.com/spreadsheets/u/0/create', '_blank', 'noopener,noreferrer');

    setExportModalData({
      count: selectedRecords.length,
      copied,
      userEmail: currentUserEmail,
      tsvPreview: tsvContent.slice(0, 500) + (tsvContent.length > 500 ? '...' : '')
    });
    setShowExportModal(true);

    setNotification({
      type: 'success',
      message: `Exported ${selectedRecords.length} records! Google Sheets opened in a new tab & data copied to clipboard for ${currentUserEmail}.`
    });
  };

  // Category Swap Handler
  const handlePerformCategorySwap = async () => {
    if (!swapFromCategory || !swapToCategory) return;
    if (swapFromCategory === swapToCategory) {
      setNotification({
        type: 'error',
        message: 'Source and target categories must be different.'
      });
      return;
    }

    const matchingRecords = invitations.filter(r => r.category === swapFromCategory && !r.isDeleted);
    if (matchingRecords.length === 0) {
      setNotification({
        type: 'error',
        message: `No active records found with category "${swapFromCategory}".`
      });
      return;
    }

    setIsSwappingCategory(true);
    try {
      const ids = matchingRecords.map(r => r.id);
      await batchUpdateMultipleInvitationsInFirestore(ids, { category: swapToCategory });
      setInvitations(prev => prev.map(inv => ids.includes(inv.id) ? { ...inv, category: swapToCategory } : inv));
      setNotification({
        type: 'success',
        message: `Successfully swapped ${matchingRecords.length} record(s) from "${swapFromCategory}" to "${swapToCategory}"!`
      });
      setShowCategorySwapModal(false);
    } catch (err) {
      console.error('Error swapping category:', err);
      setNotification({
        type: 'error',
        message: 'Failed to perform category swap.'
      });
    } finally {
      setIsSwappingCategory(false);
    }
  };

  // Duplicate Detection & Purging Handlers
  const handleOpenDuplicatesModal = () => {
    const report = detectDuplicateRecords(invitations);
    setDuplicateClusters(report.clusters);
    setTotalDuplicatesCount(report.totalDuplicatesCount);
    setShowDuplicatesModal(true);
  };

  const handlePerformPurgeDuplicates = async () => {
    if (duplicateClusters.length === 0 || totalDuplicatesCount === 0) return;

    setIsPurgingDuplicates(true);
    try {
      const { purgedCount, purgedIds, updatedPrimaryRecords } = await purgeDuplicatesInFirestore(duplicateClusters);

      const purgedSet = new Set(purgedIds);
      const primaryMap = new Map(updatedPrimaryRecords.map(r => [r.id, r]));

      setInvitations(prev =>
        prev
          .filter(inv => !purgedSet.has(inv.id))
          .map(inv => primaryMap.get(inv.id) || inv)
      );

      setNotification({
        type: 'success',
        message: `Successfully merged and purged ${purgedCount} duplicate record(s) from the invitation list!`
      });
      setShowDuplicatesModal(false);
      setDuplicateClusters([]);
      setTotalDuplicatesCount(0);
    } catch (err) {
      console.error('Error purging duplicates:', err);
      setNotification({
        type: 'error',
        message: 'Failed to purge duplicates. Please try again.'
      });
    } finally {
      setIsPurgingDuplicates(false);
    }
  };

  // Restore or Seed Initial 622 Dataset
  const [restoringData, setRestoringData] = useState(false);
  const [showRestoreConfirmModal, setShowRestoreConfirmModal] = useState(false);

  const handleRestoreDefaultDataset = () => {
    setShowRestoreConfirmModal(true);
  };

  const handleConfirmRestoreDataset = async () => {
    setShowRestoreConfirmModal(false);
    setRestoringData(true);
    try {
      const defaults = getDefaultMasterInvitations();
      await saveInvitationsBatchToFirestore(defaults);
      setInvitations(defaults);
      setNotification({
        type: 'success',
        message: `Successfully reloaded and restored all ${defaults.length} initial invitation records into Firestore!`
      });
    } catch (err: any) {
      console.error('Error restoring defaults:', err);
      setNotification({
        type: 'error',
        message: 'Failed to restore initial dataset. Please try again.'
      });
    } finally {
      setRestoringData(false);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Top Banner & Role Status */}
      <div className="cream-card p-6 border border-[#E8B400]/40 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center space-x-3">
            <h2 className="font-poster text-2xl text-[#241226]">INVITATIONS MANAGEMENT DASHBOARD</h2>
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#E8B400] text-[#241226] border border-[#E8B400]/50 font-mono">
              {dashboardStats.totalInvited} Invited Contacts
            </span>
          </div>
          <p className="text-xs text-[#241226]/80 max-w-2xl">
            Real-time invitation analytics for GRACIA (25 Years of Grace). Track registration rates, priests & VIPs, and invitation codes dispatch.
          </p>
        </div>

        {/* Privacy & Settings Toggle (Invitation Main Admin / Super Admin) */}
        <div className="flex flex-wrap items-center gap-3">
          {isMainAdmin && (
            <button
              onClick={handleTogglePrivacy}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 border shadow-sm cursor-pointer ${
                invitationSettings.allowNonMainAdminsToViewContacts
                  ? 'bg-amber-500/20 border-amber-500 text-[#241226]'
                  : 'bg-[#241226] text-white border-[#241226]/40'
              }`}
              title="Toggle whether non-main invitation admins can view emails and phone numbers"
            >
              {invitationSettings.allowNonMainAdminsToViewContacts ? (
                <>
                  <Eye className="w-4 h-4 text-amber-600" />
                  <span>Contacts: Visible to All Admins</span>
                </>
              ) : (
                <>
                  <EyeOff className="w-4 h-4 text-amber-300" />
                  <span>Contacts: Hidden from Sub-Admins</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* INVITATIONS DASHBOARD METRICS SUMMARY */}
      <div className="bg-gradient-to-br from-[#1b0b23] via-[#241226] to-[#14081c] border border-amber-500/30 rounded-2xl p-5 shadow-2xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-amber-500/20 pb-3">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-300">
              <BarChart3 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-poster text-base tracking-wider text-amber-300 uppercase">
                Invitations & Ticket Codes Performance Dashboard
              </h3>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <span className="px-3 py-1 rounded-full text-[10px] font-mono font-bold bg-amber-400/10 border border-amber-400/30 text-amber-300 flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>Live Sync</span>
            </span>
          </div>
        </div>

        {/* 8 METRIC DASHBOARD CARDS */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-8 gap-3">
          
          {/* 1. No of People Invited */}
          <div className="bg-white/5 hover:bg-white/10 transition-all p-3.5 rounded-xl border border-blue-500/30 flex flex-col justify-between space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-blue-300 uppercase tracking-wider">People Invited</span>
              <div className="w-6 h-6 rounded-lg bg-blue-500/20 text-blue-300 flex items-center justify-center">
                <Users className="w-3.5 h-3.5" />
              </div>
            </div>
            <div>
              <div className="text-xl sm:text-2xl font-black font-mono text-blue-300">
                {dashboardStats.contactedInvited} / {dashboardStats.totalInvited}
              </div>
              <p className="text-[10px] text-blue-200/70 mt-0.5">Contacted (Email/WhatsApp/Called) vs Total</p>
            </div>
          </div>

          {/* 2. No of People Registered */}
          <div className="bg-white/5 hover:bg-white/10 transition-all p-3.5 rounded-xl border border-emerald-500/30 flex flex-col justify-between space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-emerald-300 uppercase tracking-wider">People Registered</span>
              <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-300 flex items-center justify-center">
                <UserCheck className="w-3.5 h-3.5" />
              </div>
            </div>
            <div>
              <div className="text-2xl font-black font-mono text-emerald-300">
                {dashboardStats.registeredPeople.toLocaleString()}
              </div>
              <p className="text-[10px] text-emerald-200/60 mt-0.5">
                {dashboardStats.totalInvited > 0 ? `${Math.round((dashboardStats.registeredPeople / dashboardStats.totalInvited) * 100)}% registered` : '0%'}
              </p>
            </div>
          </div>

          {/* 3. No of Priest or VIPs Registered */}
          <div className="bg-white/5 hover:bg-white/10 transition-all p-3.5 rounded-xl border border-amber-500/30 flex flex-col justify-between space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-amber-300 uppercase tracking-wider">Priests / VIPs Reg.</span>
              <div className="w-6 h-6 rounded-lg bg-amber-500/20 text-amber-300 flex items-center justify-center">
                <Crown className="w-3.5 h-3.5" />
              </div>
            </div>
            <div>
              <div className="text-2xl font-black font-mono text-amber-300">
                {dashboardStats.priestVipsRegistered.toLocaleString()}
              </div>
              <p className="text-[10px] text-amber-200/60 mt-0.5">
                Out of {dashboardStats.totalPriestVipsInvited} VIP contacts
              </p>
            </div>
          </div>

          {/* 4. My Contacts (Logged-in Admin Assigned Contacts) */}
          <div className="bg-white/5 hover:bg-white/10 transition-all p-3.5 rounded-xl border border-indigo-500/30 flex flex-col justify-between space-y-2">
            <div className="flex items-center justify-between gap-1">
              <span className="text-[10px] font-bold text-indigo-300 uppercase tracking-wider truncate" title="My Contacts Stats">My Contacts</span>
              <div className="w-6 h-6 rounded-lg bg-indigo-500/20 text-indigo-300 flex items-center justify-center shrink-0">
                <UserCheck className="w-3.5 h-3.5" />
              </div>
            </div>
            <div>
              <div className="text-2xl font-black font-mono text-indigo-300 flex items-baseline space-x-1">
                <span>{myContactsStats.totalRegistered.toLocaleString()}</span>
                <span className="text-xs font-normal text-indigo-200/60">/ {myContactsStats.totalAssigned.toLocaleString()}</span>
              </div>
              <p className="text-[10px] text-indigo-200/60 mt-0.5">
                {myContactsStats.totalAssigned > 0
                  ? `${Math.round((myContactsStats.totalRegistered / myContactsStats.totalAssigned) * 100)}% registered`
                  : '0% registered'}
              </p>
              {/* In-Charge Name Indicator & Dropdown */}
              <div className="mt-1 pt-1 border-t border-indigo-500/20 flex items-center justify-between text-[10px] gap-1">
                <span className="text-indigo-300/70 truncate text-[9px]" title={`In-Charge filter: ${myContactsStats.matchedName}`}>
                  {myContactsStats.matchedName ? myContactsStats.matchedName : 'Unassigned'}
                </span>
                {allInChargeOptions.length > 0 && (
                  <select
                    value={selectedMyInCharge || detectedMyInChargeName}
                    onChange={(e) => setSelectedMyInCharge(e.target.value)}
                    className="bg-indigo-950 border border-indigo-500/40 text-indigo-200 text-[9px] rounded px-1 py-0.5 focus:outline-none cursor-pointer max-w-[85px] truncate"
                    title="Change In-Charge Name for My Contacts box"
                  >
                    <option value="">(Auto)</option>
                    {allInChargeOptions.map(ic => (
                      <option key={ic} value={ic}>{ic}</option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          </div>

          {/* 5. No of Invitation Codes Sent */}
          <div className="bg-white/5 hover:bg-white/10 transition-all p-3.5 rounded-xl border border-pink-500/30 flex flex-col justify-between space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-pink-300 uppercase tracking-wider">Codes Sent</span>
              <div className="w-6 h-6 rounded-lg bg-pink-500/20 text-pink-300 flex items-center justify-center">
                <Ticket className="w-3.5 h-3.5" />
              </div>
            </div>
            <div>
              <div className="text-2xl font-black font-mono text-pink-300">
                {dashboardStats.codesSent.toLocaleString()}
              </div>
              <p className="text-[10px] text-pink-200/60 mt-0.5">Active valid codes</p>
            </div>
          </div>

          {/* 6. No of Invitation Codes Used */}
          <div className="bg-white/5 hover:bg-white/10 transition-all p-3.5 rounded-xl border border-purple-500/30 flex flex-col justify-between space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-purple-300 uppercase tracking-wider">Codes Used</span>
              <div className="w-6 h-6 rounded-lg bg-purple-500/20 text-purple-300 flex items-center justify-center">
                <CheckSquare className="w-3.5 h-3.5" />
              </div>
            </div>
            <div>
              <div className="text-2xl font-black font-mono text-purple-300">
                {dashboardStats.codesUsed.toLocaleString()}
              </div>
              <p className="text-[10px] text-purple-200/60 mt-0.5">
                {dashboardStats.totalSeatsRedeemed} seat(s) claimed
              </p>
            </div>
          </div>

          {/* 7. No of Invitation Codes Invalidated */}
          <div className="bg-white/5 hover:bg-white/10 transition-all p-3.5 rounded-xl border border-red-500/30 flex flex-col justify-between space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-red-300 uppercase tracking-wider">Invalidated</span>
              <div className="w-6 h-6 rounded-lg bg-red-500/20 text-red-300 flex items-center justify-center">
                <XCircle className="w-3.5 h-3.5" />
              </div>
            </div>
            <div>
              <div className="text-2xl font-black font-mono text-red-300">
                {dashboardStats.codesInvalidated.toLocaleString()}
              </div>
              <p className="text-[10px] text-red-200/60 mt-0.5">Deactivated / purged</p>
            </div>
          </div>

          {/* 8. No of Group Codes Issued & Registered */}
          <div className="bg-white/5 hover:bg-white/10 transition-all p-3.5 rounded-xl border border-cyan-500/30 flex flex-col justify-between space-y-2 col-span-2 sm:col-span-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-cyan-300 uppercase tracking-wider">Group Codes</span>
              <div className="w-6 h-6 rounded-lg bg-cyan-500/20 text-cyan-300 flex items-center justify-center">
                <Layers className="w-3.5 h-3.5" />
              </div>
            </div>
            <div>
              <div className="text-2xl font-black font-mono text-cyan-300 flex items-baseline space-x-1">
                <span>{dashboardStats.groupCodesRegistered}</span>
                <span className="text-xs font-normal text-cyan-200/60">/ {dashboardStats.groupCodesIssued}</span>
              </div>
              <p className="text-[10px] text-cyan-200/60 mt-0.5">Registered / Issued</p>
            </div>
          </div>

        </div>
      </div>

      {/* Notification Banner */}
      {notification && (
        <div className={`p-4 rounded-2xl border text-xs font-semibold flex items-center justify-between animate-fade-in ${
          notification.type === 'success'
            ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
            : 'bg-red-500/15 border-red-500/40 text-red-300'
        }`}>
          <div className="flex items-center space-x-2">
            {notification.type === 'success' ? (
              <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
            )}
            <span>{notification.message}</span>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="text-white/60 hover:text-white font-bold cursor-pointer ml-2"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* SUB-TAB NAVIGATION WITHIN INVITATIONS */}
      <div className="flex border-b border-white/10 overflow-x-auto pb-1 gap-2">
        <button
          onClick={() => setActiveSubTab('all')}
          className={`px-4 py-2.5 rounded-xl font-poster text-sm tracking-wider transition-all flex items-center space-x-2 shrink-0 cursor-pointer ${
            activeSubTab === 'all'
              ? 'bg-[#E8752C] text-white shadow-lg'
              : 'bg-white/5 text-white/70 hover:bg-white/10 hover:text-white'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Master Invitations List ({invitations.length})</span>
        </button>

        {canAccessPublic && (
          <button
            onClick={() => setActiveSubTab('public')}
            className={`px-4 py-2.5 rounded-xl font-poster text-sm tracking-wider transition-all flex items-center space-x-2 shrink-0 cursor-pointer ${
              activeSubTab === 'public'
                ? 'bg-amber-500 text-slate-950 font-bold shadow-lg'
                : 'bg-white/5 text-white/70 hover:bg-white/10 hover:text-white'
            }`}
          >
            <Star className="w-4 h-4 text-amber-300" />
            <span>Public Invitations (VIP & Priests)</span>
          </button>
        )}

        {canAccessParish && (
          <button
            onClick={() => setActiveSubTab('parish_dir')}
            className={`px-4 py-2.5 rounded-xl font-poster text-sm tracking-wider transition-all flex items-center space-x-2 shrink-0 cursor-pointer ${
              activeSubTab === 'parish_dir'
                ? 'bg-blue-600 text-white shadow-lg'
                : 'bg-white/5 text-white/70 hover:bg-white/10 hover:text-white'
            }`}
          >
            <Building className="w-4 h-4 text-blue-300" />
            <span>Singapore Parishes Directory</span>
          </button>
        )}

        {canAccessJYCoordinators && (
          <button
            onClick={() => setActiveSubTab('jy_coordinators')}
            className={`px-4 py-2.5 rounded-xl font-poster text-sm tracking-wider transition-all flex items-center space-x-2 shrink-0 cursor-pointer ${
              activeSubTab === 'jy_coordinators'
                ? 'bg-emerald-600 text-white shadow-lg'
                : 'bg-white/5 text-white/70 hover:bg-white/10 hover:text-white'
            }`}
          >
            <Shield className="w-4 h-4 text-emerald-300" />
            <span>JY Coordinators & Teams</span>
          </button>
        )}

        {canAccessInactiveJYs && (
          <button
            onClick={() => setActiveSubTab('inactive_jys')}
            className={`px-4 py-2.5 rounded-xl font-poster text-sm tracking-wider transition-all flex items-center space-x-2 shrink-0 cursor-pointer ${
              activeSubTab === 'inactive_jys'
                ? 'bg-purple-600 text-white shadow-lg'
                : 'bg-white/5 text-white/70 hover:bg-white/10 hover:text-white'
            }`}
          >
            <Users className="w-4 h-4 text-purple-300" />
            <span>Inactive JYs List</span>
          </button>
        )}

        <button
          onClick={() => setActiveSubTab('concert_codes')}
          className={`px-4 py-2.5 rounded-xl font-poster text-sm tracking-wider transition-all flex items-center space-x-2 shrink-0 cursor-pointer ${
            activeSubTab === 'concert_codes'
              ? 'bg-pink-600 text-white shadow-lg'
              : 'bg-white/5 text-white/70 hover:bg-white/10 hover:text-white'
          }`}
        >
          <Sparkles className="w-4 h-4 text-pink-300" />
          <span>Concert Invitation Codes ({invitationCodes.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('deleted_names')}
          className={`px-4 py-2.5 rounded-xl font-poster text-sm tracking-wider transition-all flex items-center space-x-2 shrink-0 cursor-pointer ${
            activeSubTab === 'deleted_names'
              ? 'bg-red-600 text-white shadow-lg'
              : 'bg-white/5 text-white/70 hover:bg-white/10 hover:text-white'
          }`}
        >
          <Trash2 className="w-4 h-4 text-red-300" />
          <span>Deleted Names ({invitations.filter(i => i.isDeleted).length})</span>
        </button>

        {isMainAdmin && (
          <button
            onClick={() => setActiveSubTab('roles_mgmt')}
            className={`px-4 py-2.5 rounded-xl font-poster text-sm tracking-wider transition-all flex items-center space-x-2 shrink-0 cursor-pointer ${
              activeSubTab === 'roles_mgmt'
                ? 'bg-amber-600 text-white shadow-lg'
                : 'bg-white/5 text-white/70 hover:bg-white/10 hover:text-white'
            }`}
          >
            <Shield className="w-4 h-4 text-amber-300" />
            <span>Roles & Admin Management</span>
          </button>
        )}
      </div>

      {/* CATEGORY SUB-TABS (UNDER MASTER LIST) */}
      {activeSubTab === 'all' && (
        <div className="flex flex-wrap items-center gap-1.5 p-3 rounded-2xl bg-white/5 border border-white/10">
          <span className="text-[11px] font-bold text-amber-300 uppercase tracking-wider mr-1 font-mono">Sub-Tabs:</span>
          <button
            onClick={() => setActiveCategorySubTab('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeCategorySubTab === 'all'
                ? 'bg-amber-500 text-slate-950 shadow-md'
                : 'bg-white/10 text-white/80 hover:bg-white/20'
            }`}
          >
            All Categories ({invitations.filter(i => !i.isDeleted).length})
          </button>
          {allCategories.map(cat => {
            const count = invitations.filter(i => !i.isDeleted && (i.category || '').toLowerCase() === cat.toLowerCase()).length;
            return (
              <button
                key={cat}
                onClick={() => setActiveCategorySubTab(cat)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeCategorySubTab.toLowerCase() === cat.toLowerCase()
                    ? 'bg-[#E8752C] text-white shadow-md'
                    : 'bg-white/10 text-white/70 hover:bg-white/20'
                }`}
              >
                {cat} {count > 0 ? `(${count})` : ''}
              </button>
            );
          })}
        </div>
      )}

      {/* SECTION 1: INVITATIONS MASTER & CATEGORY TABLES */}
      {(activeSubTab === 'all' || activeSubTab === 'public' || activeSubTab === 'jy_coordinators' || activeSubTab === 'inactive_jys') && (
        <div className="space-y-4">
          
          {/* Controls Bar: 2 Clean Rows (Row 1: Search & Filters & Clear Filter; Row 2: Management & Actions) */}
          <div className="p-3.5 sm:p-4 rounded-2xl bg-[#1f0d27]/90 border border-white/15 backdrop-blur-xl space-y-3 shadow-xl">
            {/* ROW 1: SEARCH INPUT, FILTERS, AND CLEAR FILTERS */}
            <div className="flex flex-wrap items-center gap-2.5 w-full">
              {/* Search Bar */}
              <div className="relative flex-1 min-w-[220px]">
                <Search className="w-4 h-4 text-white/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search name, category, in-charge, remarks, parish..."
                  className="w-full pl-10 pr-4 py-2 text-xs rounded-xl bg-white/10 border border-white/15 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-[#E8752C] transition-all"
                />
              </div>

              {/* Gender Filter */}
              <select
                value={selectedGender}
                onChange={(e) => setSelectedGender(e.target.value as any)}
                className="px-3 py-2 text-xs rounded-xl bg-[#1C0D1E] border border-white/15 text-white focus:outline-none focus:border-amber-400 cursor-pointer"
              >
                <option value="all">All Genders</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>

              {/* In-Charge Filter */}
              <select
                value={selectedInCharge}
                onChange={(e) => setSelectedInCharge(e.target.value)}
                className="px-3 py-2 text-xs rounded-xl bg-[#1C0D1E] border border-white/15 text-white focus:outline-none focus:border-amber-400 cursor-pointer"
              >
                <option value="all">All In-Charge</option>
                <option value="unassigned">Unassigned</option>
                {allInChargeOptions.map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>

              {/* Category Filter */}
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-3 py-2 text-xs rounded-xl bg-[#1C0D1E] border border-white/15 text-white focus:outline-none focus:border-amber-400 cursor-pointer"
              >
                <option value="all">All Categories</option>
                {allCategories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>

              {/* Status Filter */}
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="px-3 py-2 text-xs rounded-xl bg-[#1C0D1E] border border-white/15 text-white focus:outline-none focus:border-amber-400 cursor-pointer"
              >
                <option value="all">All Invitation Statuses</option>
                {allStatusOptions.map(st => (
                  <option key={st} value={st}>{st === 'REGISTERED' ? 'REGISTERED' : st.replace(/_/g, ' ').toUpperCase()}</option>
                ))}
              </select>

              {/* Clear Filters Button */}
              {(searchQuery !== '' || selectedGender !== 'all' || selectedInCharge !== 'all' || selectedCategory !== 'all' || selectedStatus !== 'all') && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedGender('all');
                    setSelectedInCharge('all');
                    setSelectedCategory('all');
                    setSelectedStatus('all');
                  }}
                  className="px-3 py-2 text-xs rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 font-bold transition-all flex items-center space-x-1 cursor-pointer shrink-0 shadow-sm"
                  title="Reset search and all active filters back to default"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Clear Filters</span>
                </button>
              )}
            </div>

            {/* ROW 2: MANAGEMENT BUTTONS & MAIN ACTION BUTTONS */}
            <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-white/10">
              {/* Left: Management Modals (+ Category, + In-Charge, + Status) */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddCategoryModal(true)}
                  className="px-3 py-1.5 text-xs rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 font-bold transition-all flex items-center space-x-1.5 cursor-pointer shrink-0 shadow-sm"
                  title="Manage & Add/Edit/Remove Categories"
                >
                  <Plus className="w-3.5 h-3.5 text-amber-400" />
                  <span>Manage Categories</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowInChargeMgmtModal(true)}
                  className="px-3 py-1.5 text-xs rounded-xl bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/40 font-bold transition-all flex items-center space-x-1.5 cursor-pointer shrink-0 shadow-sm"
                  title="Manage & Add/Edit/Remove In-Charge Team Names"
                >
                  <Plus className="w-3.5 h-3.5 text-purple-400" />
                  <span>Manage In-Charge</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowStatusMgmtModal(true)}
                  className="px-3 py-1.5 text-xs rounded-xl bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border border-blue-500/40 font-bold transition-all flex items-center space-x-1.5 cursor-pointer shrink-0 shadow-sm"
                  title="Manage & Add/Edit/Remove Status Options"
                >
                  <Plus className="w-3.5 h-3.5 text-blue-400" />
                  <span>Manage Status Options</span>
                </button>
              </div>

              {/* Right: Actions (CSV Template, Upload CSV, Restore 622 Data, Add Contact) */}
              <div className="flex flex-wrap items-center gap-2 ml-auto">
                {isMainAdmin && (
                  <>
                    <button
                      type="button"
                      onClick={handleDownloadTemplate}
                      className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-amber-300 border border-white/15 text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer shadow-sm"
                      title="Download CSV template for bulk invitations import"
                    >
                      <Download className="w-3.5 h-3.5 text-amber-400" />
                      <span>CSV Template</span>
                    </button>

                    <label className="px-3 py-1.5 rounded-xl bg-purple-600/30 hover:bg-purple-600/50 text-purple-200 border border-purple-500/40 text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer shadow-sm">
                      {uploadingCSV ? (
                        <RefreshCw className="w-3.5 h-3.5 text-purple-300 animate-spin" />
                      ) : (
                        <Upload className="w-3.5 h-3.5 text-purple-300" />
                      )}
                      <span>{uploadingCSV ? 'Uploading...' : 'Upload CSV'}</span>
                      <input
                        type="file"
                        accept=".csv"
                        disabled={uploadingCSV}
                        onChange={handleCSVUpload}
                        className="hidden"
                      />
                    </label>

                    <button
                      type="button"
                      onClick={handleRestoreDefaultDataset}
                      disabled={restoringData}
                      className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer shadow-sm disabled:opacity-50"
                      title="Reload all 622 original invitation records from master file into Firestore"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 text-amber-400 ${restoringData ? 'animate-spin' : ''}`} />
                      <span>{restoringData ? 'Restoring Data...' : 'Restore 622 Data'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowCategorySwapModal(true)}
                      className="px-3 py-1.5 rounded-xl bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 border border-indigo-500/40 text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer shadow-sm"
                      title="Batch update category across all records from one category to another"
                    >
                      <Shuffle className="w-3.5 h-3.5 text-indigo-300" />
                      <span>Category Swap</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleOpenDuplicatesModal}
                      className="px-3 py-1.5 rounded-xl bg-rose-600/30 hover:bg-rose-600/50 text-rose-200 border border-rose-500/40 text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer shadow-sm"
                      title="Find and delete duplicate records from invitation list"
                    >
                      <CopyX className="w-3.5 h-3.5 text-rose-300" />
                      <span>Clean Duplicates</span>
                    </button>
                  </>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setEditingRecord(null);
                    setRecordForm({
                      serialNo: invitations.length + 1,
                      fullName: '',
                      gender: 'Male',
                      phone: '',
                      phone2: '',
                      email: '',
                      category: 'Youth',
                      remarks: '',
                      invitationStatus: 'not_invited'
                    });
                    setShowAddEditModal(true);
                  }}
                  className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition-colors flex items-center justify-center space-x-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Contact</span>
                </button>
              </div>
            </div>
          </div>

          {/* Batch Operations Action Bar (Appears when 1 or more items are checked) */}
          {selectedRecordIds.length > 0 && (
            <div className="bg-gradient-to-r from-purple-950/90 via-indigo-950/90 to-purple-950/90 border-2 border-amber-400/80 rounded-2xl p-4 shadow-2xl flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-xl bg-amber-400 text-purple-950 flex items-center justify-center font-bold font-mono shadow-md">
                  {selectedRecordIds.length}
                </div>
                <div>
                  <div className="text-white font-bold text-sm flex items-center space-x-2">
                    <span>Records Selected for Batch Operations</span>
                  </div>
                  <div className="text-purple-200 text-xs">
                    Choose fields to update and click Apply to update all {selectedRecordIds.length} selected items at once.
                  </div>
                </div>
              </div>

              {/* Batch Controls */}
              <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
                {/* Batch Category */}
                <div className="flex items-center space-x-1 bg-black/40 p-1.5 rounded-xl border border-white/10">
                  <span className="text-[10px] font-bold text-amber-300 uppercase tracking-wider px-1">Cat:</span>
                  <select
                    value={batchCategory}
                    onChange={(e) => setBatchCategory(e.target.value)}
                    className="px-2.5 py-1.5 text-xs rounded-lg bg-[#28122c] border border-white/20 text-amber-300 font-semibold focus:outline-none"
                  >
                    <option value="">-- No Change --</option>
                    {allCategories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                {/* Batch In-Charge */}
                <div className="flex items-center space-x-1 bg-black/40 p-1.5 rounded-xl border border-white/10">
                  <span className="text-[10px] font-bold text-purple-300 uppercase tracking-wider px-1">In-Charge:</span>
                  <select
                    value={batchInCharge}
                    onChange={(e) => setBatchInCharge(e.target.value)}
                    className="px-2.5 py-1.5 text-xs rounded-lg bg-[#28122c] border border-white/20 text-purple-200 font-semibold focus:outline-none"
                  >
                    <option value="">-- No Change --</option>
                    <option value="__CLEAR__">-- Unassign / Clear --</option>
                    {allInChargeOptions.map(ic => (
                      <option key={ic} value={ic}>{ic}</option>
                    ))}
                  </select>
                </div>

                {/* Batch Status */}
                <div className="flex items-center space-x-1 bg-black/40 p-1.5 rounded-xl border border-white/10">
                  <span className="text-[10px] font-bold text-emerald-300 uppercase tracking-wider px-1">Status:</span>
                  <select
                    value={batchStatus}
                    onChange={(e) => setBatchStatus(e.target.value)}
                    className="px-2.5 py-1.5 text-xs rounded-lg bg-[#28122c] border border-white/20 text-emerald-300 font-semibold focus:outline-none"
                  >
                    <option value="">-- No Change --</option>
                    {allStatusOptions.map(st => (
                      <option key={st} value={st}>{st === 'REGISTERED' ? 'REGISTERED' : st.replace(/_/g, ' ').toUpperCase()}</option>
                    ))}
                  </select>
                </div>

                {/* Single Apply All Updates Button */}
                <button
                  type="button"
                  disabled={(!batchCategory && !batchInCharge && !batchStatus) || isApplyingBatch}
                  onClick={handleApplyAllBatchUpdates}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-purple-950 font-black text-xs transition-all shadow-lg cursor-pointer flex items-center space-x-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <CheckCircle className="w-4 h-4" />
                  <span>{isApplyingBatch ? 'Applying...' : 'Apply Batch Updates'}</span>
                </button>

                {/* Download Selected (.xlsx) */}
                <button
                  type="button"
                  onClick={handleDownloadSelectedXLSX}
                  className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-all shadow-md cursor-pointer flex items-center space-x-1.5 border border-emerald-400/40"
                  title="Download all selected records as an Excel spreadsheet (.xlsx)"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-200" />
                  <span>Download Selected</span>
                </button>

                {/* Export Selected (Google Sheets) */}
                <button
                  type="button"
                  onClick={handleExportSelectedToGoogleSheets}
                  className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition-all shadow-md cursor-pointer flex items-center space-x-1.5 border border-blue-400/40"
                  title={`Export all selected records to Google Sheets for ${currentUserEmail}`}
                >
                  <Share2 className="w-3.5 h-3.5 text-blue-200" />
                  <span>Export Selected</span>
                </button>

                {/* Batch Delete */}
                <button
                  type="button"
                  disabled={isApplyingBatch}
                  onClick={handleBatchDeleteSelected}
                  className="px-3 py-2 rounded-xl bg-rose-600/80 hover:bg-rose-600 text-white font-bold text-xs transition-colors flex items-center space-x-1 cursor-pointer"
                  title="Delete selected records permanently"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Selected</span>
                </button>

                {/* Clear Selection */}
                <button
                  type="button"
                  onClick={handleClearSelection}
                  className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white/80 font-bold text-xs transition-colors cursor-pointer"
                >
                  Clear Selection
                </button>
              </div>
            </div>
          )}

          {/* Table Container */}
          <div className="bg-[#170a1f] border border-white/15 rounded-2xl overflow-hidden shadow-2xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-white/80">
                <thead className="bg-white/10 text-white font-bold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="p-3.5 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={
                          paginatedInvitations.length > 0 &&
                          paginatedInvitations.every(r => selectedRecordIds.includes(r.id))
                        }
                        onChange={handleToggleSelectAllVisible}
                        className="w-4 h-4 rounded border-white/30 bg-purple-900/50 text-amber-400 focus:ring-amber-400 cursor-pointer"
                        title="Select / Deselect all visible records on this page"
                      />
                    </th>
                    <th 
                      onClick={() => {
                        if (sortField === 'serialNo') setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                        else { setSortField('serialNo'); setSortOrder('asc'); }
                      }}
                      className="p-3.5 w-12 text-center cursor-pointer hover:bg-white/10 transition-colors"
                      title="Sort by Serial No"
                    >
                      # {sortField === 'serialNo' && (sortOrder === 'asc' ? '↑' : '↓')}
                    </th>
                    <th 
                      onClick={() => {
                        if (sortField === 'fullName') setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                        else { setSortField('fullName'); setSortOrder('asc'); }
                      }}
                      className="p-3.5 cursor-pointer hover:bg-white/10 transition-colors"
                      title="Sort by Name"
                    >
                      Full Name {sortField === 'fullName' && (sortOrder === 'asc' ? '↑' : '↓')}
                    </th>
                    <th 
                      onClick={() => {
                        if (sortField === 'gender') setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                        else { setSortField('gender'); setSortOrder('asc'); }
                      }}
                      className="p-3.5 w-28 cursor-pointer hover:bg-white/10 transition-colors"
                      title="Sort by Gender"
                    >
                      Gender {sortField === 'gender' && (sortOrder === 'asc' ? '↑' : '↓')}
                    </th>
                    <th 
                      onClick={() => {
                        if (sortField === 'category') setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                        else { setSortField('category'); setSortOrder('asc'); }
                      }}
                      className="p-3.5 w-36 cursor-pointer hover:bg-white/10 transition-colors"
                      title="Sort by Category"
                    >
                      Category {sortField === 'category' && (sortOrder === 'asc' ? '↑' : '↓')}
                    </th>
                    <th 
                      onClick={() => {
                        if (sortField === 'inCharge') setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                        else { setSortField('inCharge'); setSortOrder('asc'); }
                      }}
                      className="p-3.5 w-40 cursor-pointer hover:bg-white/10 transition-colors"
                      title="Sort by In-Charge"
                    >
                      In-Charge {sortField === 'inCharge' && (sortOrder === 'asc' ? '↑' : '↓')}
                    </th>
                    <th className="p-3.5 min-w-[140px]">Invited By</th>
                    <th className="p-3.5 min-w-[150px]">Remarks</th>
                    <th className="p-3.5">Contact Email</th>
                    <th 
                      onClick={() => {
                        if (sortField === 'status') setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                        else { setSortField('status'); setSortOrder('asc'); }
                      }}
                      className="p-3.5 cursor-pointer hover:bg-white/10 transition-colors"
                      title="Sort by Invitation Status"
                    >
                      Status {sortField === 'status' && (sortOrder === 'asc' ? '↑' : '↓')}
                    </th>
                    <th className="p-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {loading ? (
                    <tr>
                      <td colSpan={11} className="p-8 text-center text-white/60">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto text-[#E8B400] mb-2" />
                        Loading invitation records...
                      </td>
                    </tr>
                  ) : paginatedInvitations.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="p-8 text-center text-white/60 italic">
                        No invitations match the selected criteria.
                      </td>
                    </tr>
                  ) : (
                    paginatedInvitations.map((item) => {
                      const registered = isRecordRegistered(item);
                      const isSelected = selectedRecordIds.includes(item.id);
                      return (
                        <tr key={item.id} className={`${isSelected ? 'bg-purple-900/40 hover:bg-purple-900/60' : 'hover:bg-white/5'} transition-colors`}>
                          <td className="p-3.5 text-center">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleSelectRecord(item.id)}
                              className="w-4 h-4 rounded border-white/30 bg-purple-900/50 text-amber-400 focus:ring-amber-400 cursor-pointer"
                            />
                          </td>
                          <td className="p-3.5 text-center font-mono text-white/50 text-[11px]">
                            {item.serialNo || '—'}
                          </td>

                          {/* Full Name & Designation */}
                          <td className="p-3.5">
                            <div className="font-bold text-white text-sm">{item.fullName}</div>
                            {item.designation && (
                              <div className="text-[10px] text-amber-300 font-mono">{item.designation}</div>
                            )}
                          </td>

                          {/* Inline Gender Editing Dropdown */}
                          <td className="p-2.5">
                            <select
                              value={item.gender || ''}
                              onChange={(e) => handleInlineUpdate(item, 'gender', e.target.value)}
                              className="px-2 py-1 text-xs rounded-lg bg-[#28122c] border border-white/20 text-white font-medium focus:outline-none focus:border-amber-400 cursor-pointer shadow-sm"
                            >
                              <option value="">Unset</option>
                              <option value="Male">Male</option>
                              <option value="Female">Female</option>
                            </select>
                          </td>

                          {/* Inline Category Editing Dropdown */}
                          <td className="p-2.5">
                            <select
                              value={item.category || ''}
                              onChange={(e) => handleInlineUpdate(item, 'category', e.target.value)}
                              className="px-2 py-1 text-xs rounded-lg bg-[#28122c] border border-white/20 text-amber-300 font-semibold focus:outline-none focus:border-amber-400 cursor-pointer shadow-sm max-w-[150px]"
                            >
                              <option value="">(Select Category)</option>
                              {allCategories.map(cat => (
                                <option key={cat} value={cat}>{cat}</option>
                              ))}
                            </select>
                          </td>

                          {/* Inline In-Charge Dropdown */}
                          <td className="p-2.5">
                            <select
                              value={item.inCharge || ''}
                              onChange={(e) => handleInlineUpdate(item, 'inCharge', e.target.value)}
                              className="px-2 py-1 text-xs rounded-lg bg-[#28122c] border border-white/20 text-purple-300 font-semibold focus:outline-none focus:border-purple-400 cursor-pointer shadow-sm max-w-[150px]"
                            >
                              <option value="">Unassigned</option>
                              {allInChargeOptions.map(name => (
                                <option key={name} value={name}>{name}</option>
                              ))}
                            </select>
                          </td>

                          {/* Inline Invited By Textbox Editing */}
                          <td className="p-2.5">
                            <input
                              type="text"
                              defaultValue={item.invitedBy || ''}
                              key={`${item.id}-invitedBy-${item.invitedBy}`}
                              onBlur={(e) => {
                                if (e.target.value !== (item.invitedBy || '')) {
                                  handleInlineUpdate(item, 'invitedBy', e.target.value);
                                }
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.currentTarget.blur();
                                }
                              }}
                              placeholder="Invited by..."
                              className="w-full min-w-[120px] px-2.5 py-1 text-xs rounded-lg bg-white/5 border border-white/10 hover:border-white/30 text-emerald-300 focus:bg-[#28122c] focus:border-emerald-400 focus:outline-none transition-all shadow-inner font-medium"
                            />
                          </td>

                          {/* Inline Remarks Textbox Editing */}
                          <td className="p-2.5">
                            <input
                              type="text"
                              defaultValue={item.remarks || ''}
                              key={`${item.id}-remarks-${item.remarks}`}
                              onBlur={(e) => {
                                if (e.target.value !== (item.remarks || '')) {
                                  handleInlineUpdate(item, 'remarks', e.target.value);
                                }
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.currentTarget.blur();
                                }
                              }}
                              placeholder="Add remarks..."
                              className="w-full min-w-[130px] px-2.5 py-1 text-xs rounded-lg bg-white/5 border border-white/10 hover:border-white/30 text-white/90 focus:bg-[#28122c] focus:border-amber-400 focus:outline-none transition-all shadow-inner"
                            />
                          </td>
                          
                          {/* Contact Email (Privacy Masked if restricted) */}
                          <td className="p-3.5 font-mono text-white/80">
                            {maskEmail(item.email)}
                          </td>

                          {/* Inline Invitation Status Editing Dropdown & Registered Indicator */}
                          <td className="p-2.5">
                            <div className="flex flex-col space-y-1">
                              {(() => {
                                const { isCheckedIn } = getRecordCheckInStatus(item);
                                if (isCheckedIn) {
                                  return (
                                    <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-emerald-500/25 border border-emerald-400 text-emerald-300 font-extrabold text-[11px] tracking-wider uppercase shadow-sm w-fit">
                                      <UserCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                      <span>CHECKED-IN</span>
                                    </span>
                                  );
                                }
                                if (registered) {
                                  return (
                                    <span className="inline-flex items-center space-x-1 px-2 py-1 rounded-lg bg-emerald-500/20 border border-emerald-500/50 text-emerald-300 font-bold text-[11px] tracking-wider uppercase shadow-sm w-fit">
                                      <CheckCircle className="w-3 h-3 text-emerald-400 shrink-0" />
                                      <span>REGISTERED</span>
                                    </span>
                                  );
                                }
                                return (
                                  <select
                                    value={item.invitationStatus || 'not_invited'}
                                    onChange={(e) => handleInlineUpdate(item, 'invitationStatus', e.target.value)}
                                    className={`px-2 py-1 text-xs rounded-lg font-bold uppercase tracking-wider cursor-pointer focus:outline-none border shadow-sm ${
                                      item.invitationStatus === 'email_sent'
                                        ? 'bg-blue-950 text-blue-300 border-blue-500/40'
                                        : item.invitationStatus === 'whatsapp_sent'
                                        ? 'bg-emerald-950 text-emerald-300 border-emerald-500/40'
                                        : item.invitationStatus === 'accepted'
                                        ? 'bg-purple-950 text-purple-300 border-purple-500/40'
                                        : item.invitationStatus === 'declined'
                                        ? 'bg-rose-950 text-rose-300 border-rose-500/40'
                                        : item.invitationStatus === 'attended'
                                        ? 'bg-amber-950 text-amber-300 border-amber-500/40'
                                        : 'bg-[#28122c] text-white/70 border-white/20'
                                    }`}
                                  >
                                    {allStatusOptions.map(st => (
                                      <option key={st} value={st}>{st.replace(/_/g, ' ').toUpperCase()}</option>
                                    ))}
                                  </select>
                                );
                              })()}
                            {(item.statusUpdatedAt || item.lastInvitedAt) ? (
                              <div 
                                className="flex items-center space-x-1 text-[10px] text-amber-300/90 font-mono mt-0.5" 
                                title={`Status changed on: ${new Date(item.statusUpdatedAt || item.lastInvitedAt!).toLocaleString()}`}
                              >
                                <Clock className="w-2.5 h-2.5 text-[#E8B400] shrink-0" />
                                <span className="whitespace-nowrap">
                                  {new Date(item.statusUpdatedAt || item.lastInvitedAt!).toLocaleDateString('en-SG', {
                                    day: '2-digit',
                                    month: 'short'
                                  })}, {new Date(item.statusUpdatedAt || item.lastInvitedAt!).toLocaleTimeString('en-SG', {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                    hour12: true
                                  })}
                                </span>
                              </div>
                            ) : null}
                          </div>
                        </td>

                        {/* Personalised Actions & Edit Modal Trigger */}
                        <td className="p-3.5 text-right">
                          <div className="inline-flex items-center justify-end space-x-1.5">
                            
                            {/* Personalised Email Button */}
                            <button
                              onClick={() => openEmailComposer(item)}
                              className="px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-[11px] shadow cursor-pointer transition-colors inline-flex items-center space-x-1"
                              title="Send Personalised Email"
                            >
                              <Mail className="w-3.5 h-3.5" />
                              <span>Email</span>
                            </button>

                            {/* Personalised WhatsApp Button */}
                            <button
                              onClick={() => openWhatsappComposer(item)}
                              className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] shadow cursor-pointer transition-colors inline-flex items-center space-x-1"
                              title="Send Personalised WhatsApp Message"
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                              <span>WhatsApp</span>
                            </button>

                            {/* Full Edit Modal Button (for Name, Email, Phone) */}
                            <button
                              onClick={() => {
                                setEditingRecord(item);
                                setRecordForm({
                                  serialNo: item.serialNo,
                                  fullName: item.fullName,
                                  gender: item.gender,
                                  phone: item.phone,
                                  phone2: item.phone2 || '',
                                  email: item.email,
                                  category: item.category,
                                  remarks: item.remarks,
                                  invitationStatus: item.invitationStatus || 'not_invited'
                                });
                                setShowAddEditModal(true);
                              }}
                              className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-colors cursor-pointer"
                              title="Edit Name, Phone & Email in Modal"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>

                            {/* Delete Button */}
                            <button
                              onClick={() => setDeleteTargetRecord(item)}
                              className="p-1.5 rounded-lg bg-red-600/30 hover:bg-red-600 text-red-300 hover:text-white transition-colors cursor-pointer"
                              title="Delete Record"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls Footer */}
            <div className="p-4 bg-white/5 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-white/70">
              <div className="flex items-center space-x-2">
                <span>Rows per page:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-[#28122c] border border-white/20 text-white focus:outline-none"
                >
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={250}>250</option>
                  <option value={0}>All ({totalRecordsCount})</option>
                </select>
                <span className="text-white/50 pl-2">
                  Showing {pageSize === 0 ? (totalRecordsCount === 0 ? 0 : 1) : totalRecordsCount === 0 ? 0 : Math.min(1 + (safeCurrentPage - 1) * pageSize, totalRecordsCount)} – {pageSize === 0 ? totalRecordsCount : Math.min(safeCurrentPage * pageSize, totalRecordsCount)} of <strong className="text-amber-300 font-bold">{totalRecordsCount}</strong> records
                </span>
              </div>

              {pageSize > 0 && totalPages > 1 && (
                <div className="flex items-center space-x-1.5">
                  <button
                    disabled={safeCurrentPage <= 1}
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed text-white text-xs font-semibold cursor-pointer transition-colors"
                  >
                    Previous
                  </button>
                  <span className="px-2 font-mono text-amber-300 font-bold">
                    {safeCurrentPage} / {totalPages}
                  </span>
                  <button
                    disabled={safeCurrentPage >= totalPages}
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed text-white text-xs font-semibold cursor-pointer transition-colors"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SECTION: DELETED NAMES & CODES SUB-TAB */}
      {activeSubTab === 'deleted_names' && (
        <div className="space-y-6">
          <div className="p-4 rounded-2xl bg-[#1C0D1E] border border-rose-500/30 text-white space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center space-x-2 text-rose-300">
                <Trash2 className="w-5 h-5 text-rose-400" />
                <h3 className="font-poster text-lg text-white">DELETED RECYCLE BIN</h3>
              </div>
              <div className="flex items-center space-x-3 text-xs font-mono">
                <span className="text-rose-200/80 bg-rose-500/20 px-2.5 py-1 rounded-full border border-rose-500/30">
                  {invitations.filter(i => i.isDeleted).length} Soft-Deleted Guest Records
                </span>
                <span className="text-amber-200/80 bg-amber-500/20 px-2.5 py-1 rounded-full border border-amber-500/30">
                  {invitationCodes.filter(c => c.isDeleted).length} Soft-Deleted Codes
                </span>
              </div>
            </div>
            <p className="text-xs text-white/70">
              When an invitation contact or invitation code is deleted from any list, it is moved here to ensure complete auditability and prevent data loss. You can restore any item back to its active state or permanently delete it.
            </p>
          </div>

          {/* Deleted Guest Names Table */}
          <div className="bg-[#1f0d27]/90 border border-white/10 rounded-2xl overflow-hidden shadow-2xl space-y-2 p-4">
            <h4 className="font-poster text-md text-rose-300 uppercase tracking-wide">
              1. Deleted Guest Invitation Contacts
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-white/80">
                <thead className="bg-rose-950/40 text-rose-200 font-bold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="p-3 w-12 text-center">#</th>
                    <th className="p-3">Full Name</th>
                    <th className="p-3">Invited By</th>
                    <th className="p-3">Gender</th>
                    <th className="p-3">Category</th>
                    <th className="p-3">In-Charge</th>
                    <th className="p-3">Contact Email</th>
                    <th className="p-3">Deleted By</th>
                    <th className="p-3">Deleted Date</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {invitations.filter(i => i.isDeleted).length === 0 ? (
                    <tr>
                      <td colSpan={10} className="p-8 text-center text-white/50 italic">
                        No deleted names in the guest recycle bin.
                      </td>
                    </tr>
                  ) : (
                    invitations.filter(i => i.isDeleted).map((item, idx) => (
                      <tr key={item.id} className="hover:bg-white/5 transition-colors">
                        <td className="p-3 text-center font-mono text-white/40">{idx + 1}</td>
                        <td className="p-3 font-bold text-white">{item.fullName}</td>
                        <td className="p-3 text-emerald-300 font-medium">{item.invitedBy || '—'}</td>
                        <td className="p-3 text-white/70">{item.gender || '—'}</td>
                        <td className="p-3 text-amber-300 font-medium">{item.category || '—'}</td>
                        <td className="p-3 text-purple-300">{item.inCharge || 'Unassigned'}</td>
                        <td className="p-3 font-mono text-white/80">{maskEmail(item.email)}</td>
                        <td className="p-3 font-mono text-rose-300 text-[11px]">{item.deletedBy || 'Admin'}</td>
                        <td className="p-3 font-mono text-xs text-white/50">
                          {item.deletedAt ? new Date(item.deletedAt).toLocaleString('en-SG', {
                            day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
                          }) : '—'}
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end space-x-2">
                            <button
                              type="button"
                              onClick={() => handleRestoreRecord(item)}
                              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow cursor-pointer transition-colors flex items-center space-x-1"
                              title="Restore Record back to Active Category List"
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                              <span>Restore</span>
                            </button>
                            {isMainAdmin && (
                              <button
                                type="button"
                                onClick={() => setDeleteTargetRecord(item)}
                                className="px-2.5 py-1.5 rounded-lg bg-rose-600/40 hover:bg-rose-600 text-rose-200 hover:text-white font-bold text-xs cursor-pointer transition-colors"
                                title="Permanently Delete Record"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Deleted Invitation Codes Table */}
          <div className="bg-[#1f0d27]/90 border border-white/10 rounded-2xl overflow-hidden shadow-2xl space-y-2 p-4">
            <h4 className="font-poster text-md text-amber-300 uppercase tracking-wide">
              2. Deleted Invitation & Concert Codes
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-white/80">
                <thead className="bg-amber-950/40 text-amber-200 font-bold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="p-3 w-12 text-center">#</th>
                    <th className="p-3">Invitation Code</th>
                    <th className="p-3">Type</th>
                    <th className="p-3">Recipient / Member</th>
                    <th className="p-3">Invited By</th>
                    <th className="p-3">Generated By</th>
                    <th className="p-3">Deleted By</th>
                    <th className="p-3">Deleted Date</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {invitationCodes.filter(c => c.isDeleted).length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-white/50 italic">
                        No deleted invitation codes in the recycle bin.
                      </td>
                    </tr>
                  ) : (
                    invitationCodes.filter(c => c.isDeleted).map((codeItem, idx) => (
                      <tr key={codeItem.id} className="hover:bg-white/5 transition-colors">
                        <td className="p-3 text-center font-mono text-white/40">{idx + 1}</td>
                        <td className="p-3 font-mono font-bold text-amber-300 text-sm">{codeItem.code}</td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-white/10 text-white/80">
                            {codeItem.codeType === 'group_member' || codeItem.type === 'group_member' ? 'Member (1 Seat)' : codeItem.codeType === 'individual' || codeItem.type === 'individual' ? '1 Seat' : `Group (${codeItem.maxSeats})`}
                          </span>
                        </td>
                        <td className="p-3 font-medium text-white">{codeItem.recipientName}</td>
                        <td className="p-3 text-emerald-300 font-medium">{codeItem.invitedBy || '—'}</td>
                        <td className="p-3 text-purple-300 font-mono text-[11px]">{codeItem.createdByName || codeItem.createdBy || 'Admin'}</td>
                        <td className="p-3 text-rose-300 font-mono text-[11px]">{codeItem.deletedBy || 'Admin'}</td>
                        <td className="p-3 font-mono text-xs text-white/50">
                          {codeItem.deletedAt ? new Date(codeItem.deletedAt).toLocaleString('en-SG', {
                            day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
                          }) : '—'}
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end space-x-2">
                            <button
                              type="button"
                              onClick={() => handleRestoreCode(codeItem)}
                              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow cursor-pointer transition-colors flex items-center space-x-1"
                              title="Restore Code back to Active List"
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                              <span>Restore</span>
                            </button>
                            {isMainAdmin && (
                              <button
                                type="button"
                                onClick={() => handlePermanentDeleteCode(codeItem.id, codeItem.code)}
                                className="px-2.5 py-1.5 rounded-lg bg-rose-600/40 hover:bg-rose-600 text-rose-200 hover:text-white font-bold text-xs cursor-pointer transition-colors"
                                title="Permanently Delete Code"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
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

      {/* SECTION 2: INTELLIGENT SINGAPORE PARISHES DIRECTORY & SEARCH */}
      {activeSubTab === 'parish_dir' && (
        <div className="space-y-4">
          <div className="p-5 rounded-2xl bg-gradient-to-r from-blue-900/40 via-purple-900/40 to-slate-900 border border-blue-500/30 space-y-3">
            <div className="flex items-center space-x-3 text-blue-300">
              <Building className="w-6 h-6 text-blue-400" />
              <div>
                <h3 className="font-poster text-xl text-white">SINGAPORE CATHOLIC PARISHES DIRECTORY</h3>
                <p className="text-xs text-blue-200">
                  Intelligent search across all Singapore Catholic Parishes for Priests, Church Secretaries, Catechism Coordinators, and Youth Leaders. Add to Invitations or send direct invites.
                </p>
              </div>
            </div>

            {/* Filter controls */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-white/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={parishSearchQuery}
                  onChange={(e) => setParishSearchQuery(e.target.value)}
                  placeholder="Search Parish Name, Priest, Secretary, Coordinator..."
                  className="w-full pl-10 pr-4 py-2.5 text-xs rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>

              <select
                value={selectedDistrict}
                onChange={(e) => setSelectedDistrict(e.target.value)}
                className="px-4 py-2.5 text-xs rounded-xl bg-[#1C0D1E] border border-white/20 text-white focus:outline-none"
              >
                <option value="all">All Singapore Districts</option>
                <option value="City">City District</option>
                <option value="East">East District</option>
                <option value="West">West District</option>
                <option value="North">North District</option>
                <option value="Serangoon">Serangoon District</option>
              </select>
            </div>
          </div>

          {/* Directory Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredParishes.map((parish) => (
              <div key={parish.id} className="p-5 rounded-2xl bg-[#170a1f] border border-white/15 space-y-3 shadow-xl hover:border-blue-400/40 transition-all">
                <div className="flex items-start justify-between border-b border-white/10 pb-3">
                  <div>
                    <h4 className="font-bold text-white text-base">{parish.parishName}</h4>
                    <div className="flex items-center space-x-2 text-xs text-white/60 mt-0.5">
                      <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span>{parish.address}</span>
                      <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 font-mono text-[10px]">{parish.district}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 text-xs">
                  {/* Parish Priest */}
                  <div className="flex items-center justify-between p-2 rounded-lg bg-white/5">
                    <div>
                      <span className="text-[10px] text-amber-300 uppercase font-bold block">Parish Priest</span>
                      <span className="font-bold text-white">{parish.parishPriest}</span>
                    </div>
                    <button
                      onClick={() => handleAddParishContactToInvitations(parish.parishName, parish.parishPriest, 'Parish Priest', parish.email, parish.phone)}
                      className="px-2.5 py-1 text-[10px] font-bold bg-blue-600 hover:bg-blue-500 text-white rounded-md cursor-pointer"
                    >
                      + Add Invite
                    </button>
                  </div>

                  {/* Church Secretaries */}
                  {parish.parishSecretaries.map((sec, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-white/5">
                      <div>
                        <span className="text-[10px] text-emerald-300 uppercase font-bold block">Church Secretary</span>
                        <span className="font-bold text-white">{sec}</span>
                      </div>
                      <button
                        onClick={() => handleAddParishContactToInvitations(parish.parishName, sec, 'Church Secretary', parish.email, parish.phone)}
                        className="px-2.5 py-1 text-[10px] font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-md cursor-pointer"
                      >
                        + Add Invite
                      </button>
                    </div>
                  ))}

                  {/* Catechism Coordinators */}
                  {parish.catechismCoordinators.map((cat, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-white/5">
                      <div>
                        <span className="text-[10px] text-purple-300 uppercase font-bold block">Catechism Coordinator</span>
                        <span className="font-bold text-white">{cat}</span>
                      </div>
                      <button
                        onClick={() => handleAddParishContactToInvitations(parish.parishName, cat, 'Catechism Coordinator', parish.email, parish.phone)}
                        className="px-2.5 py-1 text-[10px] font-bold bg-purple-600 hover:bg-purple-500 text-white rounded-md cursor-pointer"
                      >
                        + Add Invite
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SECTION 4: ROLES & ADMIN MANAGEMENT */}
      {activeSubTab === 'roles_mgmt' && isMainAdmin && (
        <div className="space-y-8 animate-fade-in">
          {/* Card 1: Custom Categories Management */}
          <div className="p-6 rounded-2xl bg-[#170a1f] border border-white/15 text-white shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <h3 className="font-poster text-xl text-amber-300 flex items-center space-x-2">
                  <Plus className="w-5 h-5 text-amber-400" />
                  <span>Manage Invitation Categories</span>
                </h3>
                <p className="text-xs text-white/60">Add new categories to organize invitations (e.g., VIP Speaker, Clergy, Choir, Volunteers)</p>
              </div>
            </div>

            <form onSubmit={handleAddCategory} className="flex gap-3 max-w-md">
              <input
                type="text"
                value={newCategoryInput}
                onChange={(e) => setNewCategoryInput(e.target.value)}
                placeholder="New Category Name (e.g. VIP Sponsor)"
                className="flex-1 px-3.5 py-2 text-xs rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow cursor-pointer transition-colors"
              >
                Add Category
              </button>
            </form>

            <div>
              <div className="text-xs font-semibold text-white/70 mb-2">Active Categories List ({allCategories.length}):</div>
              <div className="flex flex-wrap gap-2">
                {allCategories.map(cat => {
                  const isCustom = invitationSettings.customCategories?.includes(cat);
                  return (
                    <span
                      key={cat}
                      className={`px-3 py-1 rounded-full text-xs font-bold flex items-center space-x-1.5 ${
                        isCustom 
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                          : 'bg-white/10 text-white/80 border border-white/15'
                      }`}
                    >
                      <span>{cat}</span>
                      {isCustom && (
                        <button
                          onClick={() => handleDeleteCustomCategory(cat)}
                          className="hover:text-red-400 cursor-pointer ml-1"
                          title="Remove custom category"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Card 2: Bulk CSV Import & Dataset Management */}
          <div className="p-6 rounded-2xl bg-[#170a1f] border border-white/15 text-white shadow-2xl space-y-4">
            <div className="border-b border-white/10 pb-3">
              <h3 className="font-poster text-xl text-amber-300 flex items-center space-x-2">
                <FileSpreadsheet className="w-5 h-5 text-amber-400" />
                <span>Bulk CSV Import & Master Dataset Management</span>
              </h3>
              <p className="text-xs text-white/60">Upload CSV files containing invitation contacts, download standard CSV template, or reload the original 622 master invitation dataset into Firestore.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
              {/* Option 1: Download CSV Template */}
              <div className="p-4 rounded-xl bg-white/5 border border-white/10 flex flex-col justify-between space-y-3">
                <div>
                  <div className="font-bold text-amber-300 text-sm flex items-center space-x-1.5">
                    <Download className="w-4 h-4 text-amber-400" />
                    <span>CSV Template</span>
                  </div>
                  <p className="text-xs text-white/60 mt-1">Download official CSV template pre-formatted with all standard fields (Name, Phone, Category, Email, Parish, Status).</p>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="w-full py-2 px-3 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-bold transition-colors cursor-pointer flex items-center justify-center space-x-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Template</span>
                </button>
              </div>

              {/* Option 2: Upload CSV */}
              <div className="p-4 rounded-xl bg-white/5 border border-white/10 flex flex-col justify-between space-y-3">
                <div>
                  <div className="font-bold text-purple-300 text-sm flex items-center space-x-1.5">
                    <Upload className="w-4 h-4 text-purple-400" />
                    <span>Upload Custom CSV</span>
                  </div>
                  <p className="text-xs text-white/60 mt-1">Parse and import any CSV file. Automatically detects columns for name, phone, email, category, remarks, and parish.</p>
                </div>
                <label className="w-full py-2 px-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-colors cursor-pointer flex items-center justify-center space-x-1.5 text-center shadow">
                  {uploadingCSV ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Upload className="w-3.5 h-3.5" />
                  )}
                  <span>{uploadingCSV ? 'Importing CSV...' : 'Choose CSV File'}</span>
                  <input
                    type="file"
                    accept=".csv"
                    disabled={uploadingCSV}
                    onChange={handleCSVUpload}
                    className="hidden"
                  />
                </label>
              </div>

              {/* Option 3: Restore Original 622 Records */}
              <div className="p-4 rounded-xl bg-white/5 border border-white/10 flex flex-col justify-between space-y-3">
                <div>
                  <div className="font-bold text-emerald-300 text-sm flex items-center space-x-1.5">
                    <RefreshCw className="w-4 h-4 text-emerald-400" />
                    <span>Restore 622 Master Dataset</span>
                  </div>
                  <p className="text-xs text-white/60 mt-1">Re-seed or reload all original 622 invitation contacts from the master seed dataset directly into Firestore.</p>
                </div>
                <button
                  type="button"
                  onClick={handleRestoreDefaultDataset}
                  disabled={restoringData}
                  className="w-full py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors cursor-pointer flex items-center justify-center space-x-1.5 shadow disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${restoringData ? 'animate-spin' : ''}`} />
                  <span>{restoringData ? 'Restoring...' : 'Restore 622 Dataset'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Card 3: Invitation Admin Management */}
          <div className="p-6 rounded-2xl bg-[#170a1f] border border-white/15 text-white shadow-2xl space-y-6">
            <div className="border-b border-white/10 pb-3">
              <h3 className="font-poster text-xl text-amber-300 flex items-center space-x-2">
                <Shield className="w-5 h-5 text-amber-400" />
                <span>Invitation Admins & Roles Management</span>
              </h3>
              <p className="text-xs text-white/60">Assign or update invitation admin access and grant specific sub-roles with clearly defined permissions</p>
            </div>

            {/* Clearly Defined Admin Roles Definition Matrix */}
            <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-3">
              <div className="font-bold text-xs text-amber-300 uppercase tracking-wider flex items-center space-x-2">
                <Shield className="w-4 h-4 text-amber-400" />
                <span>Admin Roles & Permissions Definition Guide</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 space-y-1">
                  <div className="font-bold text-amber-300">1. Main Invitation Lead (Super Admin)</div>
                  <p className="text-white/80 leading-relaxed">
                    Full access to manage all invitation sub-tabs, manage In-Charge names, manage Status options, assign sub-admin roles, restore soft-deleted records, and send official bulk communications.
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 space-y-1">
                  <div className="font-bold text-blue-300">2. Public Invitation Admin</div>
                  <p className="text-white/80 leading-relaxed">
                    Responsible for VIPs, Dignitaries, Priests, and Public Guests. Allowed to view/edit contact details, update statuses, and send personalized invitations for public list.
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 space-y-1">
                  <div className="font-bold text-emerald-300">3. Parish Invitation Admin</div>
                  <p className="text-white/80 leading-relaxed">
                    Access to Singapore Catholic Parishes directory. Coordinates priest and parish secretary invites across 32 Singapore Catholic parishes.
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/20 space-y-1">
                  <div className="font-bold text-purple-300">4. JY Coordinators & Teams Admin</div>
                  <p className="text-white/80 leading-relaxed">
                    Access to Jesus Youth active team leads, ministry coordinators, and zone representatives list. Coordinates internal JY team invitations.
                  </p>
                </div>
              </div>
            </div>

            {adminMgmtNotification && (
              <div className={`p-3 rounded-xl border text-xs font-medium ${
                adminMgmtNotification.type === 'success' 
                  ? 'bg-emerald-500/20 text-emerald-200 border-emerald-500/40' 
                  : 'bg-rose-500/20 text-rose-200 border-rose-500/40'
              }`}>
                {adminMgmtNotification.message}
              </div>
            )}

            {/* Form: Add or Update Admin Roles */}
            <form id="invitation-admin-form" onSubmit={handleAssignInvitationAdminSubmit} className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-4">
              <div className="font-bold text-xs text-amber-300 uppercase tracking-wider">Add / Assign Invitation Admin Access</div>
              
              <div>
                <label className="block text-xs text-white/70 mb-1">User Email Address</label>
                <input
                  type="email"
                  required
                  value={adminEmailInput}
                  onChange={(e) => setAdminEmailInput(e.target.value)}
                  placeholder="e.g. siju.apple.sg@gmail.com"
                  className="w-full max-w-md px-3.5 py-2 text-xs rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>

              <div>
                <label className="block text-xs text-white/70 mb-2 font-semibold">Select Allowed Invitation Sub-Roles (Multiple allowed):</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {[
                    { id: 'invitation_main_admin', label: 'Invitations Lead (Categories & Sub-Admins)' },
                    { id: 'public_invitation_admin', label: 'Public Invitation Admin (VIPs & Priests)' },
                    { id: 'parish_invitation_admin', label: 'Parish Invitation Admin (Singapore Parishes)' },
                    { id: 'jy_coordinators', label: 'JY Coordinators & Teams Admin' },
                    { id: 'inactive_jys_admin', label: 'Inactive JYs Admin' }
                  ].map(subRole => {
                    const checked = selectedSubRolesForAdmin.includes(subRole.id as InvitationAdminRole);
                    return (
                      <label key={subRole.id} className="flex items-start space-x-2.5 p-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedSubRolesForAdmin(prev => [...prev, subRole.id as InvitationAdminRole]);
                            } else {
                              setSelectedSubRolesForAdmin(prev => prev.filter(r => r !== subRole.id));
                            }
                          }}
                          className="mt-0.5 rounded text-amber-500 focus:ring-amber-400"
                        />
                        <div>
                          <div className="font-bold text-white/90">{subRole.label}</div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              <button
                type="submit"
                disabled={submittingAdmin}
                className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow cursor-pointer transition-colors disabled:opacity-50"
              >
                {submittingAdmin ? 'Saving Role...' : 'Save Invitation Admin Access'}
              </button>
            </form>

            {/* Table: Current Approved Admins */}
            <div className="space-y-3">
              <div className="font-bold text-xs text-white/80 uppercase tracking-wider">Current Invitation Admin Allow-List:</div>
              <div className="overflow-x-auto border border-white/10 rounded-xl">
                <table className="w-full text-left text-xs text-white/80">
                  <thead className="bg-white/10 text-white font-bold uppercase tracking-wider text-[11px]">
                    <tr>
                      <th className="p-3">Email</th>
                      <th className="p-3">Primary Role</th>
                      <th className="p-3">Assigned Invitation Sub-Roles</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {loadingAdmins ? (
                      <tr>
                        <td colSpan={4} className="p-4 text-center text-white/50">Loading admin allow-list...</td>
                      </tr>
                    ) : approvedAdmins.filter(a => a.status === 'approved' && (a.role === 'invitation_admin' || (a.invitationRoles && a.invitationRoles.length > 0))).length === 0 ? (
                      <tr>
                        <td colSpan={4} className="p-4 text-center text-white/50 italic">No approved invitation admin accounts found.</td>
                      </tr>
                    ) : (
                      approvedAdmins
                        .filter(a => a.status === 'approved' && (a.role === 'invitation_admin' || (a.invitationRoles && a.invitationRoles.length > 0)))
                        .map(admin => (
                        <tr key={admin.email} className="hover:bg-white/5">
                          <td className="p-3 font-mono font-bold text-white">{admin.email}</td>
                          <td className="p-3">
                            <span className="px-2.5 py-1 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                              {formatInvitationRoleName(admin.invitationRoles)}
                            </span>
                          </td>
                          <td className="p-3">
                            {admin.invitationRoles && admin.invitationRoles.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {admin.invitationRoles.map(r => (
                                  <span key={r} className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-amber-400/10 text-amber-200 border border-amber-400/30">
                                    Invitation Admin - {INVITATION_SUB_ROLE_LABELS[r] || r}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-amber-200/60 italic text-xs">Invitation Admin - All Sub-Roles</span>
                            )}
                          </td>
                          <td className="p-3 text-right">
                            <div className="flex items-center justify-end space-x-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setAdminEmailInput(admin.email);
                                  if (admin.invitationRoles && admin.invitationRoles.length > 0) {
                                    setSelectedSubRolesForAdmin(admin.invitationRoles);
                                  }
                                  const formEl = document.getElementById('invitation-admin-form');
                                  if (formEl) {
                                    formEl.scrollIntoView({ behavior: 'smooth' });
                                  }
                                }}
                                className="px-2.5 py-1 rounded bg-white/10 hover:bg-white/20 text-white text-[11px] font-bold cursor-pointer"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteInvitationAdminPermanent(admin.email)}
                                className="px-2.5 py-1 rounded bg-rose-600/30 hover:bg-rose-600/50 text-rose-200 border border-rose-500/40 text-[11px] font-bold cursor-pointer"
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB: CONCERT INVITATION CODES & LAUNCH DATE */}
      {activeSubTab === 'concert_codes' && (
        <div className="space-y-8">
          {/* Configurable Launch Date Setting */}
          <div className="cream-card p-6 border-2 border-pink-500/40 rounded-3xl shadow-xl space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3 pb-3 border-b border-[#241226]/10">
              <div className="flex items-center space-x-2">
                <Clock className="w-5 h-5 text-pink-600" />
                <h3 className="font-poster text-xl text-[#241226]">Musical Concert Launch Date Setting</h3>
              </div>
              <span className="text-xs text-[#241226]/60 font-medium">
                Controls when ticket reservations open in the Participant Portal
              </span>
            </div>

            <div className="flex flex-col sm:flex-row items-end gap-4 max-w-xl">
              <div className="flex-1 space-y-1 w-full">
                <label className="block text-xs font-bold uppercase tracking-wider text-[#241226]">
                  Target Launch Release Date & Time
                </label>
                <input
                  type="datetime-local"
                  value={concertReleaseDate.substring(0, 16)}
                  onChange={(e) => {
                    const d = new Date(e.target.value);
                    if (!isNaN(d.getTime())) {
                      setConcertReleaseDate(d.toISOString());
                    }
                  }}
                  className="w-full px-4 py-2.5 rounded-xl bg-white border border-[#241226]/30 text-[#241226] font-mono text-sm focus:outline-none focus:border-pink-600"
                />
              </div>

              <button
                type="button"
                disabled={savingReleaseDate}
                onClick={handleSaveConcertReleaseDate}
                className="px-6 py-2.5 rounded-xl bg-pink-600 hover:bg-pink-700 disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider shadow-md transition-all cursor-pointer flex items-center space-x-2 shrink-0"
              >
                {savingReleaseDate ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                <span>Save Launch Date</span>
              </button>
            </div>
          </div>

          {/* Invitation Code Generator Tool */}
          <div className="bg-gradient-to-br from-[#2b1435] via-[#1f0d27] to-[#120617] border-2 border-pink-500/50 rounded-3xl p-6 sm:p-8 shadow-2xl text-white space-y-6">
            <div className="flex items-center space-x-3 pb-4 border-b border-white/10">
              <Sparkles className="w-6 h-6 text-pink-400" />
              <div>
                <h3 className="font-poster text-2xl text-white">Generate Invitation Code</h3>
                <p className="text-xs text-white/70">
                  Create unique individual or group invitation codes with customized seat quotas.
                </p>
              </div>
            </div>

            <form onSubmit={handleCreateCodeSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-pink-300 mb-1">
                    Code Type
                  </label>
                  <select
                    value={codeType}
                    onChange={(e) => {
                      const t = e.target.value as 'individual' | 'group';
                      setCodeType(t);
                      if (t === 'individual') setCodeMaxSeats(1);
                      else setCodeMaxSeats(5);
                    }}
                    className="w-full px-3 py-2.5 rounded-xl bg-black/40 border border-pink-500/40 text-white text-xs font-bold focus:outline-none"
                  >
                    <option value="individual" className="bg-[#1c0d1e]">Individual (1 Seat)</option>
                    <option value="group" className="bg-[#1c0d1e]">Group (Multiple Seats)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-pink-300 mb-1">
                    Category
                  </label>
                  <select
                    value={codeCategory}
                    onChange={(e) => setCodeCategory(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-black/40 border border-pink-500/40 text-white text-xs font-bold focus:outline-none"
                  >
                    <option value="VIP" className="bg-[#1c0d1e]">VIP Guest</option>
                    <option value="Clergy" className="bg-[#1c0d1e]">Clergy & Religious</option>
                    <option value="Choir" className="bg-[#1c0d1e]">Choir / Performer</option>
                    <option value="Sponsor" className="bg-[#1c0d1e]">Sponsor / Partner</option>
                    <option value="Parish" className="bg-[#1c0d1e]">Parish Group</option>
                    <option value="Youth" className="bg-[#1c0d1e]">Youth Ministry</option>
                    <option value="General" className="bg-[#1c0d1e]">General Guest</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-pink-300 mb-1">
                    Custom Prefix
                  </label>
                  <input
                    type="text"
                    value={codePrefix}
                    onChange={(e) => setCodePrefix(e.target.value.toUpperCase())}
                    placeholder="e.g. GRACIA"
                    className="w-full px-3 py-2.5 rounded-xl bg-black/40 border border-pink-500/40 text-white font-mono text-xs uppercase focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-pink-300 mb-1">
                    {codeType === 'individual' ? 'Max Seats (Fixed)' : 'Allocated Seats (Quota)'}
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    disabled={codeType === 'individual'}
                    value={codeMaxSeats}
                    onChange={(e) => setCodeMaxSeats(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full px-3 py-2.5 rounded-xl bg-black/40 border border-pink-500/40 text-white font-mono text-xs focus:outline-none disabled:opacity-50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-pink-300 mb-1">
                    Recipient / Group Name *
                  </label>
                  <input
                    type="text"
                    value={codeRecipientName}
                    onChange={(e) => setCodeRecipientName(e.target.value)}
                    placeholder="e.g. St. Peter's Choir / Fr. Dominic"
                    className="w-full px-4 py-2.5 rounded-xl bg-black/40 border border-pink-500/40 text-white text-xs focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-pink-300 mb-1">
                    Invited By (Person Inviting)
                  </label>
                  <input
                    type="text"
                    value={codeInvitedBy}
                    onChange={(e) => setCodeInvitedBy(e.target.value)}
                    placeholder="e.g. Joel K Jose"
                    className="w-full px-4 py-2.5 rounded-xl bg-black/40 border border-pink-500/40 text-white text-xs focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-pink-300 mb-1">
                    Recipient Email (Optional)
                  </label>
                  <input
                    type="email"
                    value={codeRecipientEmail}
                    onChange={(e) => setCodeRecipientEmail(e.target.value)}
                    placeholder="e.g. contact@parish.org"
                    className="w-full px-4 py-2.5 rounded-xl bg-black/40 border border-pink-500/40 text-white text-xs focus:outline-none"
                  />
                </div>
              </div>

              {/* Ticket Pricing Allocation (Complimentary vs Paid) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-pink-500/20">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-amber-300 mb-1.5">
                    Ticket Allocation Type *
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setCodeTicketType('complimentary')}
                      className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center space-x-1.5 cursor-pointer ${
                        codeTicketType === 'complimentary'
                          ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300 shadow-md'
                          : 'bg-black/30 border-white/20 text-white/60 hover:text-white'
                      }`}
                    >
                      <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Complimentary (Free)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setCodeTicketType('paid')}
                      className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center space-x-1.5 cursor-pointer ${
                        codeTicketType === 'paid'
                          ? 'bg-amber-500/20 border-amber-400 text-amber-300 shadow-md'
                          : 'bg-black/30 border-white/20 text-white/60 hover:text-white'
                      }`}
                    >
                      <DollarSign className="w-3.5 h-3.5 text-amber-400" />
                      <span>Paid Ticket</span>
                    </button>
                  </div>
                </div>

                {codeTicketType === 'paid' && (
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-amber-300 mb-1.5">
                      Price Per Ticket (SGD) *
                    </label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-2.5 text-xs text-amber-400 font-bold">$</span>
                      <input
                        type="number"
                        min="1"
                        max="1000"
                        value={codeTicketPrice}
                        onChange={(e) => setCodeTicketPrice(Math.max(1, parseInt(e.target.value) || 0))}
                        className="w-full pl-8 pr-4 py-2.5 rounded-xl bg-black/40 border border-amber-500/40 text-amber-300 font-mono text-xs font-bold focus:outline-none focus:border-amber-400"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Individual Seat Name Textboxes (Dynamically rendered based on allocated seats) */}
              <div className="space-y-2 pt-2 border-t border-pink-500/20">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold uppercase tracking-wider text-amber-300">
                    Group Member Names
                  </label>
                </div>
                <p className="text-[11px] text-white/60">
                  Enter individual seat holder names or member designations below for each of the {codeMaxSeats} allocated seat(s):
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 max-h-56 overflow-y-auto p-2.5 bg-black/30 rounded-xl border border-amber-500/20 scrollbar-thin scrollbar-thumb-amber-500/40">
                  {Array.from({ length: codeMaxSeats }).map((_, idx) => (
                    <div key={idx} className="space-y-1">
                      <label className="block text-[10px] font-bold text-amber-300/80 font-mono">
                        Seat / Person #{idx + 1}
                      </label>
                      <input
                        type="text"
                        value={codeSeatMemberNames[idx] || ''}
                        onChange={(e) => {
                          const updated = [...codeSeatMemberNames];
                          updated[idx] = e.target.value;
                          setCodeSeatMemberNames(updated);
                        }}
                        placeholder={`Name for Seat #${idx + 1}`}
                        className="w-full px-3 py-2 rounded-lg bg-[#150a1b] border border-pink-500/30 text-white text-xs focus:border-pink-400 focus:outline-none placeholder:text-white/25 font-sans"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={generatingCode}
                  className="px-8 py-3 rounded-xl bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider shadow-lg transition-all cursor-pointer flex items-center space-x-2"
                >
                  {generatingCode ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  <span>Generate Code{codeType === 'group' && codeGroupMembersText.trim() ? 's for Group Members' : ''}</span>
                </button>
              </div>
            </form>
          </div>

          {/* Invitation Codes Table */}
          <div className="bg-[#1f0d27]/90 border border-pink-500/30 rounded-3xl p-6 shadow-2xl space-y-4 text-white">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/10">
              <div>
                <h3 className="font-poster text-xl text-white">Generated Invitation Codes</h3>
                <p className="text-xs text-white/60">
                  Active codes available for guest redemption & direct link sharing.
                </p>
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-pink-500/20 text-pink-300 border border-pink-500/40 font-mono">
                {invitationCodes.filter(c => !c.isDeleted).length} Active Codes
              </span>
            </div>

            {invitationCodes.filter(c => !c.isDeleted).length === 0 ? (
              <div className="text-center py-10 space-y-2 text-white/50">
                <Sparkles className="w-10 h-10 mx-auto text-pink-400/40" />
                <p className="text-xs font-medium">No active invitation codes created yet. Use the form above to generate one.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-white/80 border-collapse">
                  <thead>
                    <tr className="border-b border-white/10 text-pink-300 font-bold uppercase tracking-wider text-[10px]">
                      <th className="p-3">Invitation Code</th>
                      <th className="p-3">Type</th>
                      <th className="p-3">Recipient / Member</th>
                      <th className="p-3">Invited By</th>
                      <th className="p-3">Generated By</th>
                      <th className="p-3">Category</th>
                      <th className="p-3 text-center">Quota / Used</th>
                      <th className="p-3">Status</th>
                      <th className="p-3 text-right">Actions / Share</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 font-sans">
                    {invitationCodes.filter(c => !c.isDeleted).map((c) => {
                      const isInvalid = c.status === 'invalid' || c.isInvalid;
                      const isFullyRedeemed = !isInvalid && (c.isUsed || c.seatsUsed >= c.maxSeats);
                      const isPartiallyRedeemed = !isInvalid && (c.seatsUsed > 0 && c.seatsUsed < c.maxSeats);
                      const directUrl = `${window.location.origin}/musical?code=${c.code}`;
                      const shareText = `You are cordially invited to the GRACIA Musical Concert! Use your unique invitation code: ${c.code} or click here to reserve: ${directUrl}`;

                      return (
                        <tr key={c.id} className="hover:bg-white/5 transition-colors">
                          <td className="p-3 font-mono font-bold text-sm tracking-wide">
                            <span className={isInvalid ? 'line-through text-red-400/90 decoration-red-500 decoration-2 opacity-80' : 'text-amber-300'}>
                              {c.code}
                            </span>
                          </td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              c.codeType === 'individual' || c.type === 'individual'
                                ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40' 
                                : c.codeType === 'group_member' || c.type === 'group_member'
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                : 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                            }`}>
                              {c.codeType === 'group_member' || c.type === 'group_member' 
                                ? 'Member (1 Seat)' 
                                : c.codeType === 'individual' || c.type === 'individual' 
                                ? '1 Seat' 
                                : `Group (${c.maxSeats})`}
                            </span>
                          </td>
                          <td className="p-3 font-medium text-white">
                            {c.recipientName}
                            {c.recipientEmail && (
                              <span className="block text-[10px] text-white/50 font-mono">{c.recipientEmail}</span>
                            )}
                          </td>
                          <td className="p-3 text-emerald-300 font-medium">
                            {c.invitedBy || '—'}
                          </td>
                          <td className="p-3 text-purple-300 font-mono text-[11px]">
                            {c.createdByName || c.createdBy || 'Admin'}
                          </td>
                          <td className="p-3">
                            <span className="px-2 py-0.5 rounded bg-white/10 text-white/80 text-[10px]">
                              {c.category}
                            </span>
                          </td>
                          <td className="p-3 text-center font-mono font-bold">
                            <span className={isInvalid ? 'text-rose-400 line-through' : c.seatsUsed >= c.maxSeats ? 'text-gray-400' : 'text-emerald-300'}>
                              {c.seatsUsed} / {c.maxSeats}
                            </span>
                          </td>
                          <td className="p-3">
                            {(() => {
                              const matchingCodeReg = (registrations || []).find(r => 
                                (r.invitation_code && r.invitation_code.toLowerCase().trim() === c.code.toLowerCase().trim()) ||
                                (r.invitation_code_id && r.invitation_code_id.toLowerCase().trim() === c.code.toLowerCase().trim()) ||
                                (r.invitationCode && r.invitationCode.toLowerCase().trim() === c.code.toLowerCase().trim()) ||
                                (c.recipientEmail && r.email && r.email.toLowerCase().trim() === c.recipientEmail.toLowerCase().trim())
                              );
                              const isCodeCheckedIn = Boolean(matchingCodeReg && (matchingCodeReg.checkedIn || (matchingCodeReg.scannedPassIds && matchingCodeReg.scannedPassIds.length > 0)));

                              if (isCodeCheckedIn) {
                                return (
                                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/30 text-emerald-300 border border-emerald-400 text-[10px] font-extrabold uppercase flex items-center gap-1 w-fit shadow-xs">
                                    <UserCheck className="w-3 h-3 text-emerald-400 shrink-0" />
                                    <span>CHECKED-IN</span>
                                  </span>
                                );
                              }

                              if (isInvalid) {
                                return (
                                  <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[10px] font-bold uppercase">
                                    INVALID
                                  </span>
                                );
                              }

                              if (isFullyRedeemed) {
                                return (
                                  <span className="px-2 py-0.5 rounded-full bg-gray-500/20 text-gray-300 border border-gray-500/40 text-[10px] font-bold uppercase">
                                    Used
                                  </span>
                                );
                              }

                              if (isPartiallyRedeemed) {
                                return (
                                  <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/40 text-[10px] font-bold uppercase">
                                    Partial ({c.maxSeats - c.seatsUsed} Left)
                                  </span>
                                );
                              }

                              return (
                                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold uppercase">
                                  New
                                </span>
                              );
                            })()}
                          </td>
                          <td className="p-3 text-right">
                            <div className="flex items-center justify-end space-x-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  navigator.clipboard.writeText(c.code);
                                  setNotification({ type: 'success', message: `Copied code ${c.code} to clipboard!` });
                                }}
                                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-colors cursor-pointer"
                                title="Copy Invitation Code"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  navigator.clipboard.writeText(directUrl);
                                  setNotification({ type: 'success', message: `Copied direct link for code ${c.code}!` });
                                }}
                                className="p-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 transition-colors cursor-pointer"
                                title="Copy Direct Link"
                              >
                                <Link className="w-3.5 h-3.5" />
                              </button>

                              <button
                                type="button"
                                onClick={() => openEmailComposerForCode(c)}
                                className="px-2 py-1 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border border-blue-500/40 transition-colors cursor-pointer flex items-center space-x-1 text-xs font-semibold"
                                title="Send Official Email with Invitation Code"
                              >
                                <Mail className="w-3.5 h-3.5" />
                                <span>Email</span>
                              </button>

                              <a
                                href={`https://wa.me/?text=${encodeURIComponent(shareText)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 transition-colors"
                                title="Share via WhatsApp"
                              >
                                <MessageSquare className="w-3.5 h-3.5" />
                              </a>

                              {/* Invalidate / Cancel Code */}
                              {!isInvalid ? (
                                <button
                                  type="button"
                                  onClick={() => handleInvalidateCode(c)}
                                  className="px-2 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/40 text-rose-300 border border-rose-500/40 transition-colors cursor-pointer font-bold text-[10px]"
                                  title="Mark code as INVALID (Frees up seat reserved)"
                                >
                                  Invalidate
                                </button>
                              ) : null}

                              {/* Reset Code back to Unused */}
                              {isInvalid || isFullyRedeemed || c.seatsUsed > 0 ? (
                                <button
                                  type="button"
                                  onClick={() => handleResetCodeToUnused(c)}
                                  className="p-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/40 text-amber-300 border border-amber-500/40 transition-colors cursor-pointer"
                                  title="Reset Code status to UNUSED (Frees reserved seat)"
                                >
                                  <RefreshCw className="w-3.5 h-3.5" />
                                </button>
                              ) : null}

                              {/* Delete Code (Soft Delete) */}
                              <button
                                type="button"
                                onClick={() => handleSoftDeleteCode(c)}
                                className="p-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/40 transition-colors cursor-pointer"
                                title="Move Code to Deleted Bin"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* RESTORE MASTER DATASET WARNING MODAL */}
      {showRestoreConfirmModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#1C0D1E] border-2 border-amber-500/80 rounded-2xl max-w-md w-full p-6 text-white shadow-2xl space-y-4 relative animate-fade-in">
            <button
              type="button"
              onClick={() => setShowRestoreConfirmModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-3 text-amber-400">
              <div className="p-2.5 rounded-xl bg-amber-500/20 border border-amber-500/30">
                <AlertTriangle className="w-7 h-7 text-amber-400 shrink-0" />
              </div>
              <div>
                <h3 className="font-poster text-lg text-amber-300">Restore 622 Master Dataset?</h3>
                <p className="text-xs text-white/60 font-mono">Warning: Overwrite Firestore Records</p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-100/90 leading-relaxed space-y-2">
              <p className="font-bold text-amber-300">⚠️ Attention Admin:</p>
              <p>Restoring the master dataset will reload and overwrite all 622 original invitation records directly in Firestore.</p>
              <p className="text-rose-300 font-semibold">Any manually added contacts, edited remarks, custom categories, or updated RSVP statuses will be replaced with initial default values.</p>
              <p className="pt-1 text-white/80 italic font-medium">Are you sure you want to proceed with restoring the original dataset?</p>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={() => setShowRestoreConfirmModal(false)}
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRestoreDataset}
                disabled={restoringData}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs cursor-pointer transition-colors shadow-lg flex items-center space-x-1.5 disabled:opacity-50"
              >
                {restoringData ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5" />
                )}
                <span>{restoringData ? 'Restoring Dataset...' : 'Yes, Overwrite & Restore'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* OFFICIAL EMAIL INVITATION MODAL */}
      {emailModalRecord && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#1C0D1E] border-2 border-[#E8B400] rounded-3xl max-w-3xl w-full p-6 sm:p-7 space-y-5 text-white relative max-h-[92vh] overflow-y-auto shadow-2xl">
            <button
              onClick={() => setEmailModalRecord(null)}
              className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-3 border-b border-white/10 pb-4">
              <div className="p-3 bg-[#E8B400]/20 border border-[#E8B400]/40 rounded-xl">
                <Mail className="w-6 h-6 text-[#E8B400]" />
              </div>
              <div>
                <h3 className="font-poster text-xl text-white tracking-wide">OFFICIAL EMAIL INVITATION COMPOSER</h3>
                <p className="text-xs text-[#E8B400] font-mono">
                  Compose & Send Official Jubilee Invitation via SMTP Server
                </p>
              </div>
            </div>

            {/* Recipient & Subject Input Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="text-xs font-bold text-amber-200/90 block mb-1">Recipient Name</label>
                <input
                  type="text"
                  value={emailModalRecord.fullName}
                  onChange={(e) => setEmailModalRecord({ ...emailModalRecord, fullName: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl bg-white/10 border border-white/20 text-xs text-white focus:outline-none focus:border-[#E8B400]"
                  placeholder="Full Name"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-amber-200/90 block mb-1">Recipient Email Address <span className="text-amber-400">*</span></label>
                <input
                  type="email"
                  value={emailModalRecord.email || ''}
                  onChange={(e) => setEmailModalRecord({ ...emailModalRecord, email: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl bg-white/10 border border-white/20 text-xs text-white focus:outline-none focus:border-[#E8B400] font-mono"
                  placeholder="e.g. recipient@domain.com"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-amber-200/90 block">Email Subject Line</label>
              <input
                type="text"
                value={customEmailSubject}
                onChange={(e) => setCustomEmailSubject(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-white/10 border border-white/20 text-xs text-white focus:outline-none focus:border-[#E8B400]"
                placeholder="Email Subject"
              />
            </div>

            {/* Email Body & Preview Editor Tabs */}
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-1">
                <div className="flex items-center space-x-1.5 bg-black/40 p-1 rounded-xl border border-white/10">
                  <button
                    type="button"
                    onClick={() => setEmailComposerTab('preview')}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer ${
                      emailComposerTab === 'preview'
                        ? 'bg-[#E8B400] text-[#1C0D1E] shadow-sm'
                        : 'text-white/70 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Formatted Email Preview</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEmailComposerTab('edit')}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer ${
                      emailComposerTab === 'edit'
                        ? 'bg-[#E8B400] text-[#1C0D1E] shadow-sm'
                        : 'text-white/70 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    <Edit className="w-3.5 h-3.5" />
                    <span>Edit Email Content</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (emailModalRecord) {
                      const { subject, htmlBody } = composePersonalizedInviteMessage(emailModalRecord, 'email', siteContent);
                      setCustomEmailSubject(subject);
                      setCustomEmailBody(htmlBody);
                    }
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-amber-200/80 hover:text-amber-200 flex items-center space-x-1.5 cursor-pointer transition-colors"
                  title="Reset email content to default generated template"
                >
                  <RefreshCw className="w-3 h-3 text-[#E8B400]" />
                  <span>Reset Default Template</span>
                </button>
              </div>

              {emailComposerTab === 'preview' ? (
                <div className="space-y-2">
                  <p className="text-[11px] text-amber-300/80 font-mono">
                    ✓ Formatted HTML invitation email ready to dispatch directly via SMTP server:
                  </p>
                  <div 
                    className="p-4 rounded-2xl bg-[#f8fafc] border border-white/20 text-xs overflow-y-auto max-h-80 min-h-[240px] shadow-inner text-slate-900"
                    dangerouslySetInnerHTML={{ __html: customEmailBody }}
                  />
                </div>
              ) : (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] text-amber-200/80 px-1 font-mono">
                    <span>Direct Content / HTML Editor</span>
                    <span>Modifications update live upon sending</span>
                  </div>
                  <textarea
                    value={customEmailBody}
                    onChange={(e) => setCustomEmailBody(e.target.value)}
                    rows={12}
                    className="w-full p-3.5 rounded-2xl bg-black/50 border border-[#E8B400]/50 text-amber-100 font-mono text-xs focus:outline-none focus:border-[#E8B400] resize-y min-h-[240px] leading-relaxed"
                    placeholder="Edit invitation email HTML or text content here..."
                  />
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-white/10">
              <span className="text-[11px] text-amber-300/80 font-mono">
                Sender: <strong className="text-white">jysg25@jesusyouth.org</strong>
              </span>

              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  onClick={() => setEmailModalRecord(null)}
                  disabled={sendingEmail}
                  className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!emailModalRecord?.email) {
                      setNotification({ type: 'error', message: 'Please provide a valid recipient email address.' });
                      return;
                    }
                    const mailtoSubject = encodeURIComponent(customEmailSubject || 'Invitation to GRACIA');
                    const plainTextBody = customEmailBody
                      .replace(/<br\s*\/?>/gi, '\n')
                      .replace(/<\/p>/gi, '\n\n')
                      .replace(/<[^>]+>/g, '')
                      .replace(/&nbsp;/g, ' ')
                      .trim();
                    window.open(`mailto:${encodeURIComponent(emailModalRecord.email.trim())}?subject=${mailtoSubject}&body=${encodeURIComponent(plainTextBody)}`, '_blank');
                  }}
                  className="px-4 py-2.5 rounded-xl bg-blue-600/30 hover:bg-blue-600/50 text-blue-200 border border-blue-500/40 font-bold text-xs cursor-pointer flex items-center space-x-1.5"
                  title="Open in your desktop mail app (e.g. Outlook, Apple Mail)"
                >
                  <Mail className="w-4 h-4 text-blue-300" />
                  <span>Open Mail App</span>
                </button>
                <button
                  disabled={sendingEmail}
                  onClick={handleSendEmailSubmit}
                  className="px-6 py-2.5 rounded-xl bg-signature-gradient text-white font-bold text-xs shadow-lg hover:opacity-95 cursor-pointer flex items-center space-x-2 disabled:opacity-50"
                >
                  {sendingEmail ? (
                    <RefreshCw className="w-4 h-4 text-[#E8B400] animate-spin" />
                  ) : (
                    <Send className="w-4 h-4 text-[#E8B400]" />
                  )}
                  <span>{sendingEmail ? 'Sending via SMTP...' : 'Send Email via SMTP Server'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PERSONALISED WHATSAPP MODAL */}
      {whatsappModalRecord && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#1C0D1E] border-2 border-emerald-500 rounded-3xl max-w-lg w-full p-6 space-y-5 text-white relative shadow-2xl">
            <button
              onClick={() => setWhatsappModalRecord(null)}
              className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-3">
              <div className="p-3 bg-emerald-500/20 border border-emerald-500/40 rounded-xl">
                <MessageSquare className="w-6 h-6 text-emerald-400" />
              </div>
              <div>
                <h3 className="font-poster text-xl text-white">COMPOSE WHATSAPP INVITATION</h3>
                <p className="text-xs text-emerald-300 font-mono">
                  Recipient: {whatsappModalRecord.fullName} ({whatsappModalRecord.phone})
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-white/80 block">Personalized WhatsApp Message Text</label>
              <textarea
                rows={8}
                value={customWhatsappText}
                onChange={(e) => setCustomWhatsappText(e.target.value)}
                className="w-full p-4 rounded-xl bg-white/10 border border-white/20 text-xs text-white focus:outline-none font-mono leading-relaxed"
              />
            </div>

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setWhatsappModalRecord(null)}
                className="px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSendWhatsappSubmit}
                className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg cursor-pointer flex items-center space-x-2"
              >
                <Send className="w-4 h-4" />
                <span>Open WhatsApp & Update Status</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD / EDIT INVITATION MODAL */}
      {showAddEditModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#1C0D1E] border border-white/20 rounded-3xl max-w-md w-full p-6 space-y-4 text-white relative shadow-2xl">
            <button
              onClick={() => setShowAddEditModal(false)}
              className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="font-poster text-xl text-white">
              {editingRecord ? 'EDIT INVITATION CONTACT' : 'ADD NEW INVITATION CONTACT'}
            </h3>

            <form onSubmit={handleSaveRecord} className="space-y-3 text-xs">
              <div>
                <label className="block text-white/70 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={recordForm.fullName}
                  onChange={(e) => setRecordForm({ ...recordForm, fullName: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-white/10 border border-white/20 text-white focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-white/70 mb-1">Gender</label>
                  <select
                    value={recordForm.gender}
                    onChange={(e) => setRecordForm({ ...recordForm, gender: e.target.value as any })}
                    className="w-full px-3 py-2 rounded-xl bg-[#1C0D1E] border border-white/20 text-white focus:outline-none"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                </div>

                <div>
                  <label className="block text-white/70 mb-1">Category</label>
                  <input
                    type="text"
                    value={recordForm.category}
                    onChange={(e) => setRecordForm({ ...recordForm, category: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-white/10 border border-white/20 text-white focus:outline-none"
                    placeholder="e.g. Family, Youth"
                  />
                </div>
              </div>

              <div>
                <label className="block text-white/70 mb-1">Email ID</label>
                <input
                  type="email"
                  value={recordForm.email}
                  onChange={(e) => setRecordForm({ ...recordForm, email: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-white/10 border border-white/20 text-white focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-white/70 mb-1">Phone Number</label>
                <input
                  type="text"
                  value={recordForm.phone}
                  onChange={(e) => setRecordForm({ ...recordForm, phone: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-white/10 border border-white/20 text-white focus:outline-none font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-white/70 mb-1">In-Charge Person</label>
                  <select
                    value={recordForm.inCharge || ''}
                    onChange={(e) => setRecordForm({ ...recordForm, inCharge: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-[#1C0D1E] border border-white/20 text-white focus:outline-none"
                  >
                    <option value="">Unassigned</option>
                    {allInChargeOptions.map(name => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-white/70 mb-1">Invited By</label>
                  <input
                    type="text"
                    value={recordForm.invitedBy || ''}
                    onChange={(e) => setRecordForm({ ...recordForm, invitedBy: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-white/10 border border-white/20 text-white focus:outline-none"
                    placeholder="Inviter Name..."
                  />
                </div>
              </div>

              <div>
                <label className="block text-white/70 mb-1">Remarks Column Information</label>
                <textarea
                  rows={2}
                  value={recordForm.remarks}
                  onChange={(e) => setRecordForm({ ...recordForm, remarks: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-white/10 border border-white/20 text-white focus:outline-none"
                  placeholder="e.g. CS Participant, Family Team; Mission"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddEditModal(false)}
                  className="px-4 py-2 rounded-xl bg-white/10 text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold cursor-pointer"
                >
                  Save Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deleteTargetRecord && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#1C0D1E] border-2 border-red-500/50 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 text-white relative">
            <h3 className="font-poster text-xl text-red-400">CONFIRM DELETION</h3>
            <p className="text-xs text-white/80">
              Are you sure you want to delete the record for <strong>{deleteTargetRecord.fullName}</strong>?
            </p>
            <div className="flex justify-end space-x-3 pt-2">
              <button
                onClick={() => setDeleteTargetRecord(null)}
                className="px-4 py-2 rounded-xl bg-white/10 text-white text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteRecord}
                className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs cursor-pointer"
              >
                Delete Record
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MANAGE CATEGORIES MODAL */}
      {showAddCategoryModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#1C0D1E] border-2 border-amber-500/80 rounded-2xl max-w-lg w-full p-6 text-white shadow-2xl space-y-4 relative">
            <button
              type="button"
              onClick={() => {
                setShowAddCategoryModal(false);
                setEditingCategoryName(null);
              }}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-3 text-amber-300">
              <div className="p-2.5 rounded-xl bg-amber-500/20 border border-amber-500/30">
                <Layers className="w-6 h-6 text-amber-400 shrink-0" />
              </div>
              <div>
                <h3 className="font-poster text-lg text-white">MANAGE INVITATION CATEGORIES</h3>
                <p className="text-xs text-amber-300 font-mono">Add, Rename or Remove Categories</p>
              </div>
            </div>

            {/* Add Category Form */}
            <form onSubmit={handleAddCategory} className="space-y-2 bg-white/5 p-3 rounded-xl border border-white/10">
              <label className="block text-xs font-bold text-amber-300">Add New Category</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  required
                  value={newCategoryInput}
                  onChange={(e) => setNewCategoryInput(e.target.value)}
                  placeholder="e.g. VIP Guest, Choir, Volunteer"
                  className="flex-1 px-3.5 py-2 text-xs rounded-xl bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-purple-950 font-bold text-xs cursor-pointer shadow"
                >
                  + Add
                </button>
              </div>
            </form>

            {/* Categories List */}
            <div className="space-y-2 pt-2 border-t border-white/10">
              <div className="text-xs font-semibold text-white/70">Current Categories ({allCategories.length}):</div>
              <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
                {allCategories.map(cat => {
                  const isEditing = editingCategoryName === cat;
                  return (
                    <div key={cat} className="flex items-center justify-between p-2 rounded-lg bg-white/5 border border-white/10 text-xs gap-2">
                      {isEditing ? (
                        <div className="flex items-center gap-1.5 w-full">
                          <input
                            type="text"
                            value={editingCategoryValue}
                            onChange={(e) => setEditingCategoryValue(e.target.value)}
                            className="flex-1 px-2 py-1 text-xs rounded bg-white/20 border border-amber-400 text-amber-200 focus:outline-none"
                            autoFocus
                          />
                          <button
                            type="button"
                            onClick={() => handleRenameCategory(cat, editingCategoryValue)}
                            className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] cursor-pointer"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingCategoryName(null)}
                            className="px-2 py-1 rounded bg-white/10 text-white/70 text-[11px] cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <>
                          <span className="font-semibold text-amber-200 truncate">{cat}</span>
                          <div className="flex items-center space-x-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingCategoryName(cat);
                                setEditingCategoryValue(cat);
                              }}
                              className="p-1 rounded text-amber-300 hover:text-amber-100 hover:bg-amber-500/20 cursor-pointer transition-colors"
                              title="Rename Category across records"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteCustomCategory(cat)}
                              className="p-1 rounded text-rose-300 hover:text-rose-100 hover:bg-rose-500/30 cursor-pointer transition-colors"
                              title="Remove Category option"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={() => {
                  setShowAddCategoryModal(false);
                  setEditingCategoryName(null);
                }}
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MANAGE IN-CHARGE OPTIONS MODAL */}
      {showInChargeMgmtModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#1C0D1E] border-2 border-purple-500/80 rounded-2xl max-w-lg w-full p-6 text-white shadow-2xl space-y-4 relative">
            <button
              type="button"
              onClick={() => {
                setShowInChargeMgmtModal(false);
                setEditingInChargeName(null);
              }}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-3 text-purple-300">
              <div className="p-2.5 rounded-xl bg-purple-500/20 border border-purple-500/30">
                <Users className="w-6 h-6 text-purple-400 shrink-0" />
              </div>
              <div>
                <h3 className="font-poster text-lg text-white">MANAGE IN-CHARGE NAMES</h3>
                <p className="text-xs text-purple-300 font-mono">Add, Rename or Remove In-Charge Personnel</p>
              </div>
            </div>

            <form onSubmit={handleAddInChargeOption} className="space-y-2 bg-white/5 p-3 rounded-xl border border-white/10">
              <label className="block text-xs font-bold text-purple-300">Add New In-Charge Name</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  required
                  value={newInChargeInput}
                  onChange={(e) => setNewInChargeInput(e.target.value)}
                  placeholder="e.g. John Doe - Tech Team"
                  className="flex-1 px-3.5 py-2 text-xs rounded-xl bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-purple-400"
                />
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs cursor-pointer shadow"
                >
                  + Add
                </button>
              </div>
            </form>

            <div className="space-y-2 pt-2 border-t border-white/10">
              <div className="text-xs font-semibold text-white/70">Current In-Charge List ({allInChargeOptions.length}):</div>
              <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
                {allInChargeOptions.map(name => {
                  const isEditing = editingInChargeName === name;
                  return (
                    <div key={name} className="flex items-center justify-between p-2 rounded-lg bg-white/5 border border-white/10 text-xs gap-2">
                      {isEditing ? (
                        <div className="flex items-center gap-1.5 w-full">
                          <input
                            type="text"
                            value={editingInChargeValue}
                            onChange={(e) => setEditingInChargeValue(e.target.value)}
                            className="flex-1 px-2 py-1 text-xs rounded bg-white/20 border border-purple-400 text-purple-200 focus:outline-none"
                            autoFocus
                          />
                          <button
                            type="button"
                            onClick={() => handleRenameInChargeOption(name, editingInChargeValue)}
                            className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] cursor-pointer"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingInChargeName(null)}
                            className="px-2 py-1 rounded bg-white/10 text-white/70 text-[11px] cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <>
                          <span className="font-semibold text-purple-200 truncate">{name}</span>
                          <div className="flex items-center space-x-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingInChargeName(name);
                                setEditingInChargeValue(name);
                              }}
                              className="p-1 rounded text-purple-300 hover:text-purple-100 hover:bg-purple-500/20 cursor-pointer transition-colors"
                              title="Rename In-Charge across records"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteInChargeOption(name)}
                              className="p-1 rounded text-rose-300 hover:text-rose-100 hover:bg-rose-500/30 cursor-pointer transition-colors"
                              title="Remove custom name"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={() => {
                  setShowInChargeMgmtModal(false);
                  setEditingInChargeName(null);
                }}
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MANAGE INVITATION STATUS OPTIONS MODAL */}
      {showStatusMgmtModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#1C0D1E] border-2 border-blue-500/80 rounded-2xl max-w-lg w-full p-6 text-white shadow-2xl space-y-4 relative">
            <button
              type="button"
              onClick={() => {
                setShowStatusMgmtModal(false);
                setEditingStatusName(null);
              }}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-3 text-blue-300">
              <div className="p-2.5 rounded-xl bg-blue-500/20 border border-blue-500/30">
                <CheckCircle className="w-6 h-6 text-blue-400 shrink-0" />
              </div>
              <div>
                <h3 className="font-poster text-lg text-white">MANAGE STATUS OPTIONS</h3>
                <p className="text-xs text-blue-300 font-mono">Add, Rename or Remove Invitation Statuses</p>
              </div>
            </div>

            <form onSubmit={handleAddStatusOption} className="space-y-2 bg-white/5 p-3 rounded-xl border border-white/10">
              <label className="block text-xs font-bold text-blue-300">Add New Invitation Status Option</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  required
                  value={newStatusInput}
                  onChange={(e) => setNewStatusInput(e.target.value)}
                  placeholder="e.g. Followed Up, VIP Reserved"
                  className="flex-1 px-3.5 py-2 text-xs rounded-xl bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs cursor-pointer shadow"
                >
                  + Add
                </button>
              </div>
            </form>

            <div className="space-y-2 pt-2 border-t border-white/10">
              <div className="text-xs font-semibold text-white/70">Current Status Options ({allStatusOptions.length}):</div>
              <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
                {allStatusOptions.map(st => {
                  const isEditing = editingStatusName === st;
                  const displayTitle = st === 'REGISTERED' ? 'REGISTERED' : st.replace(/_/g, ' ').toUpperCase();
                  return (
                    <div key={st} className="flex items-center justify-between p-2 rounded-lg bg-white/5 border border-white/10 text-xs gap-2">
                      {isEditing ? (
                        <div className="flex items-center gap-1.5 w-full">
                          <input
                            type="text"
                            value={editingStatusValue}
                            onChange={(e) => setEditingStatusValue(e.target.value)}
                            className="flex-1 px-2 py-1 text-xs rounded bg-white/20 border border-blue-400 text-blue-200 focus:outline-none"
                            autoFocus
                          />
                          <button
                            type="button"
                            onClick={() => handleRenameStatusOption(st, editingStatusValue)}
                            className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] cursor-pointer"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingStatusName(null)}
                            className="px-2 py-1 rounded bg-white/10 text-white/70 text-[11px] cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <>
                          <span className="font-semibold text-blue-200 truncate">{displayTitle}</span>
                          <div className="flex items-center space-x-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingStatusName(st);
                                setEditingStatusValue(st);
                              }}
                              className="p-1 rounded text-blue-300 hover:text-blue-100 hover:bg-blue-500/20 cursor-pointer transition-colors"
                              title="Rename Status across records"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteStatusOption(st)}
                              className="p-1 rounded text-rose-300 hover:text-rose-100 hover:bg-rose-500/30 cursor-pointer transition-colors"
                              title="Remove custom status option"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={() => {
                  setShowStatusMgmtModal(false);
                  setEditingStatusName(null);
                }}
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CATEGORY SWAP MODAL */}
      {showCategorySwapModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#1C0D1E] border-2 border-indigo-500/80 rounded-2xl max-w-lg w-full p-6 text-white shadow-2xl space-y-5 relative">
            <button
              type="button"
              onClick={() => setShowCategorySwapModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-3 text-indigo-300">
              <div className="p-2.5 rounded-xl bg-indigo-500/20 border border-indigo-500/30">
                <Shuffle className="w-6 h-6 text-indigo-400 shrink-0" />
              </div>
              <div>
                <h3 className="font-poster text-xl text-white">BATCH CATEGORY SWAP</h3>
                <p className="text-xs text-indigo-300 font-mono">Convert category across all matching invitation records</p>
              </div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-amber-300 uppercase tracking-wider mb-1.5">
                  FROM Category (Current)
                </label>
                <select
                  value={swapFromCategory}
                  onChange={(e) => setSwapFromCategory(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#28122c] border border-white/20 text-amber-300 font-semibold text-xs focus:outline-none focus:ring-2 focus:ring-amber-400"
                >
                  {allCategories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div className="flex justify-center my-1 text-indigo-400">
                <ArrowRight className="w-5 h-5 rotate-90 sm:rotate-0" />
              </div>

              <div>
                <label className="block text-xs font-bold text-emerald-300 uppercase tracking-wider mb-1.5">
                  TO Category (Target)
                </label>
                <select
                  value={swapToCategory}
                  onChange={(e) => setSwapToCategory(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#28122c] border border-white/20 text-emerald-300 font-semibold text-xs focus:outline-none focus:ring-2 focus:ring-emerald-400"
                >
                  {allCategories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              {/* Preview Matching Count */}
              {(() => {
                const count = invitations.filter(r => r.category === swapFromCategory && !r.isDeleted).length;
                return (
                  <div className="p-3 rounded-xl bg-indigo-950/80 border border-indigo-500/30 text-xs text-indigo-200 flex items-center justify-between font-mono">
                    <span>Matching Records Found:</span>
                    <span className="font-bold text-amber-400 text-sm">{count} contacts</span>
                  </div>
                );
              })()}
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={() => setShowCategorySwapModal(false)}
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSwappingCategory || swapFromCategory === swapToCategory}
                onClick={handlePerformCategorySwap}
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg transition-colors flex items-center space-x-2 disabled:opacity-50 cursor-pointer"
              >
                {isSwappingCategory ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Swapping Categories...</span>
                  </>
                ) : (
                  <>
                    <Shuffle className="w-4 h-4" />
                    <span>Swap Category Now</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CLEAN DUPLICATES MODAL */}
      {showDuplicatesModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#1C0D1E] border-2 border-rose-500/80 rounded-2xl max-w-2xl w-full p-6 text-white shadow-2xl space-y-5 relative max-h-[90vh] flex flex-col">
            <button
              type="button"
              onClick={() => setShowDuplicatesModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-3 text-rose-300">
              <div className="p-2.5 rounded-xl bg-rose-500/20 border border-rose-500/30">
                <CopyX className="w-6 h-6 text-rose-400 shrink-0" />
              </div>
              <div>
                <h3 className="font-poster text-xl text-white">DUPLICATE RECORDS AUDIT</h3>
                <p className="text-xs text-rose-300 font-mono">Consolidate & purge duplicated entries in invitation database</p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-500/30 text-xs text-rose-200 flex items-center justify-between">
              <div>
                <span className="font-bold text-white block text-sm">
                  {totalDuplicatesCount > 0
                    ? `Found ${totalDuplicatesCount} duplicate record(s) across ${duplicateClusters.length} contact group(s)`
                    : 'No duplicate records found! Database is completely clean.'}
                </span>
                <span className="text-rose-300 text-[11px]">
                  Merging will keep the primary record (preferring records with phone/email/in-charge) and merge missing details.
                </span>
              </div>
            </div>

            {/* List of Duplicate Clusters */}
            {duplicateClusters.length > 0 && (
              <div className="flex-1 overflow-y-auto space-y-3 pr-1 max-h-80 border border-white/10 rounded-xl p-3 bg-white/5">
                {duplicateClusters.map((cluster, idx) => (
                  <div key={idx} className="p-3 rounded-lg bg-black/40 border border-white/10 text-xs space-y-2">
                    <div className="flex items-center justify-between border-b border-white/10 pb-1.5">
                      <div className="font-bold text-amber-300 capitalize text-sm">
                        {cluster.primaryRecord.fullName}
                      </div>
                      <span className="px-2 py-0.5 rounded-full bg-rose-500/30 text-rose-200 text-[10px] font-mono">
                        {cluster.duplicateRecords.length + 1} instances found
                      </span>
                    </div>

                    {/* Primary Record */}
                    <div className="pl-2 border-l-2 border-emerald-400 text-emerald-200 text-[11px] space-y-0.5">
                      <span className="font-bold text-emerald-400">[Keep Primary]</span> Serial #{cluster.primaryRecord.serialNo} • Category: {cluster.primaryRecord.category} • Phone: {cluster.primaryRecord.phone || 'N/A'} • Email: {cluster.primaryRecord.email || 'N/A'}
                    </div>

                    {/* Duplicate Records To Purge */}
                    {cluster.duplicateRecords.map(dup => (
                      <div key={dup.id} className="pl-2 border-l-2 border-rose-400 text-rose-200/80 text-[11px] space-y-0.5">
                        <span className="font-bold text-rose-400">[Will Remove Duplicate]</span> Serial #{dup.serialNo} • Category: {dup.category} • Phone: {dup.phone || 'N/A'} • Email: {dup.email || 'N/A'}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center justify-end space-x-3 pt-3 border-t border-white/10">
              <button
                type="button"
                onClick={() => setShowDuplicatesModal(false)}
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs cursor-pointer"
              >
                Close
              </button>
              {totalDuplicatesCount > 0 && (
                <button
                  type="button"
                  disabled={isPurgingDuplicates}
                  onClick={handlePerformPurgeDuplicates}
                  className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-lg transition-colors flex items-center space-x-2 disabled:opacity-50 cursor-pointer"
                >
                  {isPurgingDuplicates ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Merging & Purging Duplicates...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      <span>Purge {totalDuplicatesCount} Duplicate(s) Now</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Export Selected to Google Sheets Modal */}
      {showExportModal && exportModalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
          <div className="bg-[#1c0d28] border border-blue-400/30 rounded-2xl max-w-xl w-full p-6 relative text-white shadow-2xl space-y-5">
            <button
              onClick={() => setShowExportModal(false)}
              className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white/80 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-3">
              <div className="p-3 rounded-xl bg-blue-600/20 border border-blue-500/40 text-blue-400">
                <FileSpreadsheet className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-white">
                  Exported to Google Sheets
                </h3>
                <p className="text-xs text-blue-300">
                  Exported {exportModalData.count} selected record(s) for user <span className="font-semibold text-amber-300">{exportModalData.userEmail}</span>
                </p>
              </div>
            </div>

            <div className="space-y-3 bg-white/5 p-4 rounded-xl border border-white/10 text-xs text-white/90">
              <div className="flex items-center space-x-2 text-emerald-400 font-bold">
                <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>New Google Sheet document opened in your browser!</span>
              </div>
              <div className="flex items-center space-x-2 text-amber-300 font-bold">
                <CheckCircle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>{exportModalData.count} record(s) copied to clipboard as tab-delimited text.</span>
              </div>
              <p className="text-white/70 leading-relaxed">
                To paste the records into Google Sheets, click in cell <strong className="text-white">A1</strong> on the new Google Sheet tab and press <kbd className="px-1.5 py-0.5 rounded bg-black/60 border border-white/20 text-amber-300 font-mono text-[10px]">Ctrl + V</kbd> or <kbd className="px-1.5 py-0.5 rounded bg-black/60 border border-white/20 text-amber-300 font-mono text-[10px]">Cmd + V</kbd>!
              </p>
            </div>

            <div className="space-y-1.5">
              <div className="text-[11px] font-bold uppercase text-white/60 tracking-wider">Preview of Exported Data:</div>
              <pre className="bg-black/60 border border-white/10 rounded-xl p-3 text-[10px] font-mono text-blue-200 overflow-x-auto max-h-32">
                {exportModalData.tsvPreview}
              </pre>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(exportModalData.tsvPreview);
                  setNotification({ type: 'success', message: 'Re-copied exported records to clipboard!' });
                }}
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs transition-colors flex items-center space-x-1.5 cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Copy Data Again</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  window.open('https://docs.google.com/spreadsheets/u/0/create', '_blank', 'noopener,noreferrer');
                }}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition-colors flex items-center space-x-1.5 shadow-lg cursor-pointer"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Open Google Sheets</span>
              </button>
              <button
                type="button"
                onClick={() => setShowExportModal(false)}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-purple-950 font-bold text-xs transition-colors cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
