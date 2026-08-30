import React, { useState, useEffect, useMemo } from 'react';
import {
  BookOpen,
  Plus,
  Search,
  Filter,
  RotateCcw,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Download,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Eye,
  Check,
  X,
  ShieldAlert,
  ShieldCheck,
  QrCode,
  Ticket,
  User,
  Users,
  AlertTriangle,
  RefreshCw,
  Clock
} from 'lucide-react';
import {
  BibleVerseItem,
  subscribeBibleVerses,
  saveBibleVerseToFirestore,
  setBibleVerseInvalidStatus,
  deleteBibleVerseFromFirestore,
  seedAllDefaultBibleVersesToFirestore,
  getBibleVersePassId,
  getPersonDeterministicSeed,
  getBookCode3,
  getNameCode4,
  INSPIRING_BIBLE_VERSES
} from '../lib/bibleVerses';
import { RegistrationData } from '../types';
import { isDelegatePassCheckedIn } from '../lib/utils';

interface BibleVersesManagerProps {
  adminEmail: string;
  isSuperAdmin: boolean;
  registrations?: RegistrationData[];
  onUpdateRegistration?: (id: string, patch: Partial<RegistrationData>) => Promise<boolean>;
  onBackToHome?: () => void;
}

export interface IssuedPassInfo {
  passId: string;
  registrantId: string;
  registrantName: string;
  registrantEmail: string;
  registrantPhone?: string;
  type: 'conference' | 'musical';
  attendeeName: string;
  attendeeCategory: string;
  verseReference: string;
  isScanned: boolean;
  scannedAt?: string;
  isInvalid: boolean;
  invalidReason?: string;
}

const COMMON_THEMES = [
  'Encouragement',
  'Grace',
  'Jubilee',
  'Faith',
  'Hope',
  'Love',
  'Peace',
  'Joy',
  'Strength',
  'Victory',
  'Comfort',
  'Trust',
  'Praise',
  'Wisdom',
  'Salvation'
];

export const BibleVersesManager: React.FC<BibleVersesManagerProps> = ({
  adminEmail,
  isSuperAdmin,
  registrations = [],
  onUpdateRegistration,
  onBackToHome
}) => {
  const [verses, setVerses] = useState<BibleVerseItem[]>(INSPIRING_BIBLE_VERSES);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'invalid' | 'issued' | 'scanned'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Active View Tab: Verses Pool vs Issued Passes
  const [activeTab, setActiveTab] = useState<'verses' | 'issued_passes'>('verses');

  // Modal states
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingVerse, setEditingVerse] = useState<BibleVerseItem | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [verseToDelete, setVerseToDelete] = useState<BibleVerseItem | null>(null);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);

  // Invalidation Confirmation Modal
  const [invalidatingPassTarget, setInvalidatingPassTarget] = useState<{
    passId?: string;
    verseRef?: string;
    registrantId?: string;
    targetName?: string;
    currentInvalid: boolean;
    reason: string;
  } | null>(null);

  // Action status feedback
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Subscribe to real-time verse updates
  useEffect(() => {
    setLoading(true);
    const unsubscribe = subscribeBibleVerses(
      (updatedList) => {
        setVerses(updatedList);
        setLoading(false);
      },
      (err) => {
        console.warn('Subscription warning, using cached verses:', err);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  // Flash message timeout
  useEffect(() => {
    if (actionMessage) {
      const timer = setTimeout(() => setActionMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [actionMessage]);

  // Derive all issued passes across registrations
  const allIssuedPasses: IssuedPassInfo[] = useMemo(() => {
    const list: IssuedPassInfo[] = [];

    registrations.forEach((reg) => {
      if (!reg || reg.status === 'cancelled') return;

      const personSeed = getPersonDeterministicSeed(reg.email, reg.phone, reg.name);
      const mainPassId = reg.passId || getBibleVersePassId(personSeed || reg.id, 0, reg.name);
      
      const isRegInvalid = reg.isPassInvalid === true || (Array.isArray(reg.invalidatedPassIds) && reg.invalidatedPassIds.includes(mainPassId));
      const isRegScanned = isDelegatePassCheckedIn(reg, mainPassId, reg.name, true, reg.id);

      // Extract verse ref from pass ID (e.g. GRACIA-SIJU-ROM-12:2)
      const parts = mainPassId.split('-');
      let verseRef = '';
      if (parts.length >= 4) {
        verseRef = `${parts[2]}-${parts[3]}`;
      }

      list.push({
        passId: mainPassId,
        registrantId: reg.id || '',
        registrantName: reg.name || 'Primary Attendee',
        registrantEmail: reg.email || '',
        registrantPhone: reg.phone || '',
        type: reg.type || 'conference',
        attendeeName: reg.name || 'Primary Attendee',
        attendeeCategory: 'Main Contact',
        verseReference: verseRef,
        isScanned: isRegScanned,
        scannedAt: reg.checkedInAt,
        isInvalid: isRegInvalid,
        invalidReason: reg.invalidPassReason || ''
      });

      // Additional attendees
      if (Array.isArray(reg.additionalAttendees)) {
        reg.additionalAttendees.forEach((att, idx) => {
          if (!att || !att.name) return;
          const attSeed = getPersonDeterministicSeed(att.email, att.phone, att.name) || `${personSeed}_ADD_${idx + 1}_${att.name.trim().toLowerCase()}`;
          const attPassId = att.passId || getBibleVersePassId(attSeed, idx + 1, att.name);
          const isAttInvalid = isRegInvalid || (Array.isArray(reg.invalidatedPassIds) && reg.invalidatedPassIds.includes(attPassId));
          const isAttScanned = isDelegatePassCheckedIn(reg, attPassId, att.name, false, att.id);

          const attParts = attPassId.split('-');
          let attVerseRef = '';
          if (attParts.length >= 4) {
            attVerseRef = `${attParts[2]}-${attParts[3]}`;
          }

          list.push({
            passId: attPassId,
            registrantId: reg.id || '',
            registrantName: reg.name,
            registrantEmail: reg.email,
            registrantPhone: reg.phone,
            type: reg.type || 'conference',
            attendeeName: att.name,
            attendeeCategory: att.categoryLabel || att.category || `Attendee ${idx + 2}`,
            verseReference: attVerseRef,
            isScanned: isAttScanned,
            scannedAt: reg.checkedInAt,
            isInvalid: isAttInvalid,
            invalidReason: reg.invalidPassReason || ''
          });
        });
      }
    });

    return list;
  }, [registrations]);

  // Compute live metrics
  const totalPassesIssued = allIssuedPasses.length;
  const totalPassesScanned = allIssuedPasses.filter(p => p.isScanned).length;
  const totalPassesUnscanned = totalPassesIssued - totalPassesScanned;
  const totalPassesInvalid = allIssuedPasses.filter(p => p.isInvalid).length;
  const scanRatePercent = totalPassesIssued > 0 ? Math.round((totalPassesScanned / totalPassesIssued) * 100) : 0;

  // Build mapping of verse reference to issued passes
  const verseToIssuedPassesMap = useMemo(() => {
    const map = new Map<string, IssuedPassInfo[]>();
    allIssuedPasses.forEach(pass => {
      // Clean verse ref
      const cleanRef = pass.verseReference.toUpperCase();
      if (!cleanRef) return;
      
      const existing = map.get(cleanRef) || [];
      existing.push(pass);
      map.set(cleanRef, existing);
    });
    return map;
  }, [allIssuedPasses]);

  // Extract distinct categories
  const categories = useMemo(() => {
    const cats = new Set<string>();
    verses.forEach((v) => {
      if (v.category) cats.add(v.category);
    });
    return Array.from(cats).sort();
  }, [verses]);

  // Filtered verses
  const filteredVerses = useMemo(() => {
    return verses.filter((v) => {
      const isInvalid = v.isInvalid === true || v.isActive === false;
      const cleanRef = v.reference.toUpperCase();
      const [book, num] = cleanRef.split('-');
      const book3 = getBookCode3(book || '');
      const shortRef = `${book3}-${num}`.toUpperCase();

      const matchedIssued = (verseToIssuedPassesMap.get(cleanRef) || []).concat(verseToIssuedPassesMap.get(shortRef) || []);
      const isIssued = matchedIssued.length > 0;
      const isScanned = matchedIssued.some(p => p.isScanned);

      // Status filter
      if (statusFilter === 'active' && isInvalid) return false;
      if (statusFilter === 'invalid' && !isInvalid) return false;
      if (statusFilter === 'issued' && !isIssued) return false;
      if (statusFilter === 'scanned' && !isScanned) return false;

      // Category filter
      if (selectedCategory !== 'all' && v.category !== selectedCategory) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const refMatch = v.reference.toLowerCase().includes(q);
        const textMatch = v.text.toLowerCase().includes(q);
        const catMatch = (v.category || '').toLowerCase().includes(q);
        const samplePass = getBibleVersePassId(v.reference, 0, 'Sijumon Abraham').toLowerCase();
        const passMatch = samplePass.includes(q);
        return refMatch || textMatch || catMatch || passMatch;
      }
      return true;
    });
  }, [verses, statusFilter, selectedCategory, searchQuery, verseToIssuedPassesMap]);

  // Filtered issued passes
  const filteredIssuedPasses = useMemo(() => {
    return allIssuedPasses.filter(p => {
      if (statusFilter === 'active' && p.isInvalid) return false;
      if (statusFilter === 'invalid' && !p.isInvalid) return false;
      if (statusFilter === 'scanned' && !p.isScanned) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        return (
          p.passId.toLowerCase().includes(q) ||
          p.attendeeName.toLowerCase().includes(q) ||
          p.registrantName.toLowerCase().includes(q) ||
          p.registrantEmail.toLowerCase().includes(q) ||
          p.verseReference.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [allIssuedPasses, statusFilter, searchQuery]);

  // Pagination calculation
  const currentList = activeTab === 'verses' ? filteredVerses : filteredIssuedPasses;
  const totalPages = Math.ceil(currentList.length / pageSize) || 1;
  
  const paginatedVerses = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredVerses.slice(start, start + pageSize);
  }, [filteredVerses, currentPage, pageSize]);

  const paginatedIssuedPasses = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredIssuedPasses.slice(start, start + pageSize);
  }, [filteredIssuedPasses, currentPage, pageSize]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedCategory, statusFilter, pageSize, activeTab]);

  // Open Edit Modal with robust auto-derived data
  const handleOpenEditModal = (verse: BibleVerseItem) => {
    const cleanRef = verse.reference.trim().toUpperCase().replace(/\s+/g, '-');
    let book = verse.book || '';
    let chapter = verse.chapter || '';
    let verseNum = verse.verse || '';

    if (!book || !chapter || !verseNum) {
      const [b, cv] = cleanRef.split('-');
      if (b && !book) book = b;
      if (cv) {
        const [c, v] = cv.split(':');
        if (c && !chapter) chapter = c;
        if (v && !verseNum) verseNum = v;
      }
    }

    setEditingVerse({
      ...verse,
      id: verse.id || cleanRef.replace(/[^A-Z0-9:-]/gi, '_'),
      reference: cleanRef,
      book,
      chapter,
      verse: verseNum,
      category: verse.category || 'Encouragement',
      text: verse.text || '',
      isActive: verse.isActive !== false && !verse.isInvalid,
      isInvalid: verse.isInvalid === true || verse.isActive === false,
      invalidReason: verse.invalidReason || ''
    });
    setIsEditModalOpen(true);
  };

  // Open Add New Verse Modal
  const handleOpenAddModal = () => {
    setEditingVerse({
      reference: '',
      book: '',
      chapter: '',
      verse: '',
      text: '',
      category: 'Encouragement',
      isActive: true,
      isInvalid: false,
      invalidReason: ''
    });
    setIsEditModalOpen(true);
  };

  // Handle Save / Edit
  const handleSaveVerse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingVerse) return;

    let cleanRef = (editingVerse.reference || '').trim().toUpperCase().replace(/\s+/g, '-');
    
    // Auto assemble reference if book, chapter, verse provided
    if (!cleanRef && editingVerse.book && editingVerse.chapter && editingVerse.verse) {
      cleanRef = `${editingVerse.book.toUpperCase().trim()}-${editingVerse.chapter.trim()}:${editingVerse.verse.trim()}`;
    }

    if (!cleanRef || !editingVerse.text.trim()) {
      setActionMessage({ type: 'error', text: 'Verse Reference and Scripture Text are strictly required.' });
      return;
    }

    try {
      setIsSubmitting(true);
      const verseToSave: BibleVerseItem = {
        ...editingVerse,
        reference: cleanRef,
        text: editingVerse.text.trim(),
        category: editingVerse.category?.trim() || 'Encouragement',
        isActive: !editingVerse.isInvalid,
        isInvalid: editingVerse.isInvalid === true,
        invalidReason: editingVerse.invalidReason?.trim() || ''
      };

      await saveBibleVerseToFirestore(verseToSave, adminEmail);
      setActionMessage({
        type: 'success',
        text: `Verse ${cleanRef} saved successfully. Status: ${verseToSave.isInvalid ? '⛔ INVALID / REVOKED' : '✅ VALID & ACTIVE'}.`
      });
      setIsEditModalOpen(false);
      setEditingVerse(null);
    } catch (err: any) {
      console.error('Failed to save verse:', err);
      setActionMessage({ type: 'error', text: `Failed to save verse: ${err.message || 'Unknown error'}` });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Invalidate / Validate Toggle for a Verse
  const handleToggleVerseValidity = async (verse: BibleVerseItem) => {
    const currentlyInvalid = verse.isInvalid === true || verse.isActive === false;
    const newInvalidState = !currentlyInvalid;

    try {
      setIsSubmitting(true);
      await setBibleVerseInvalidStatus(
        verse,
        newInvalidState,
        newInvalidState ? 'Marked invalid by Super Admin' : '',
        adminEmail
      );
      setActionMessage({
        type: 'success',
        text: `Verse ${verse.reference} is now ${newInvalidState ? '⛔ INVALIDATED / REVOKED (Entry Denied)' : '✅ VALID & ACTIVE'}.`
      });
    } catch (err: any) {
      console.error('Failed to toggle verse validity:', err);
      setActionMessage({ type: 'error', text: `Failed to update status: ${err.message || 'Unknown error'}` });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Invalidate an Individual Issued Pass ID
  const handleExecutePassInvalidation = async () => {
    if (!invalidatingPassTarget) return;
    const { registrantId, passId, currentInvalid, reason } = invalidatingPassTarget;

    try {
      setIsSubmitting(true);
      if (registrantId && onUpdateRegistration && passId) {
        const targetReg = registrations.find(r => r.id === registrantId);
        if (targetReg) {
          const currentList = Array.isArray(targetReg.invalidatedPassIds) ? targetReg.invalidatedPassIds : [];
          let updatedList: string[];

          if (!currentInvalid) {
            // Mark Invalid
            updatedList = Array.from(new Set([...currentList, passId]));
          } else {
            // Restore Valid
            updatedList = currentList.filter(id => id !== passId);
          }

          await onUpdateRegistration(registrantId, {
            invalidatedPassIds: updatedList,
            isPassInvalid: updatedList.length > 0,
            invalidPassReason: reason || (currentInvalid ? '' : 'Revoked by Admin')
          });

          setActionMessage({
            type: 'success',
            text: `Pass ${passId} has been ${currentInvalid ? 'restored to VALID' : 'flagged as INVALID / REVOKED'}.`
          });
        }
      }
      setInvalidatingPassTarget(null);
    } catch (err: any) {
      console.error('Failed to invalidate pass:', err);
      setActionMessage({ type: 'error', text: `Action failed: ${err.message || 'Unknown error'}` });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Delete Verse from database
  const handleDeleteConfirm = async () => {
    if (!verseToDelete) return;
    try {
      setIsSubmitting(true);
      const idToDelete = verseToDelete.id || verseToDelete.reference.replace(/[^A-Z0-9:-]/gi, '_');
      await deleteBibleVerseFromFirestore(idToDelete, adminEmail);
      setActionMessage({
        type: 'success',
        text: `Verse ${verseToDelete.reference} removed from the active Jubilee pool.`
      });
      setIsDeleteModalOpen(false);
      setVerseToDelete(null);
    } catch (err: any) {
      console.error('Failed to delete verse:', err);
      setActionMessage({ type: 'error', text: `Failed to delete verse: ${err.message || 'Unknown error'}` });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Reset to 400+ Standard Jubilee Verses
  const handleResetToDefaults = async () => {
    try {
      setIsSubmitting(true);
      const count = await seedAllDefaultBibleVersesToFirestore(adminEmail);
      setActionMessage({
        type: 'success',
        text: `Successfully initialized ${count} positive & encouraging Bible verses in Firestore database.`
      });
      setIsResetModalOpen(false);
    } catch (err: any) {
      console.error('Failed to reset bible verses:', err);
      setActionMessage({ type: 'error', text: `Reset failed: ${err.message || 'Unknown error'}` });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Export as CSV
  const handleExportCSV = () => {
    if (activeTab === 'issued_passes') {
      const headers = ['Pass ID', 'Attendee Name', 'Category', 'Registrant Name', 'Email', 'Phone', 'Type', 'Verse Ref', 'Status', 'Scanned'];
      const rows = filteredIssuedPasses.map(p => [
        `"${p.passId}"`,
        `"${p.attendeeName}"`,
        `"${p.attendeeCategory}"`,
        `"${p.registrantName}"`,
        `"${p.registrantEmail}"`,
        `"${p.registrantPhone || ''}"`,
        `"${p.type}"`,
        `"${p.verseReference}"`,
        p.isInvalid ? 'INVALID' : 'VALID',
        p.isScanned ? 'YES (USED)' : 'NO (PENDING)'
      ]);
      const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `gracia_issued_passes_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return;
    }

    const headers = ['ID', 'Reference', 'Category', 'Scripture Text', 'Status', 'Sample Pass ID (Sijumon)'];
    const rows = filteredVerses.map((v, idx) => [
      v.id || String(idx + 1),
      `"${v.reference}"`,
      `"${v.category || 'Encouragement'}"`,
      `"${v.text.replace(/"/g, '""')}"`,
      v.isInvalid || v.isActive === false ? 'INVALID / DISABLED' : 'VALID & ACTIVE',
      `"${getBibleVersePassId(v.reference, 0, 'Sijumon Abraham')}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `gracia_jubilee_bible_verses_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div id="bible-verses-manager-container" className="space-y-6">
      {/* Top Banner & Stats */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 text-white p-5 sm:p-6 rounded-2xl border border-slate-800/80 shadow-xl relative overflow-hidden">
        <div className="absolute -right-10 -bottom-10 w-72 h-72 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        
        {/* Header Content & Action Buttons */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5 relative z-10">
          <div className="space-y-2.5 flex-1 min-w-0">
            {/* Badges Row */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="whitespace-nowrap inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500/15 text-amber-300 border border-amber-500/30 rounded-full text-xs font-semibold tracking-wide shrink-0 shadow-sm">
                <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>Pass ID & Scripture Engine</span>
              </span>

              {isSuperAdmin && (
                <span className="whitespace-nowrap inline-flex items-center gap-1 px-2.5 py-1 bg-rose-500/15 text-rose-300 border border-rose-500/30 rounded-full text-[11px] font-bold uppercase tracking-wider shrink-0 shadow-sm">
                  <ShieldAlert className="w-3 h-3 text-rose-400 shrink-0" />
                  <span>Super Admin</span>
                </span>
              )}
            </div>

            {/* Title */}
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-extrabold tracking-tight text-white">
              Pass ID Bible Verses Pool <span className="text-amber-400 font-semibold text-lg sm:text-xl lg:text-2xl font-mono">(400+ Pool)</span>
            </h2>
            
            {/* Description & Interactive Syntax Pills */}
            <div className="text-xs sm:text-sm text-slate-300/90 leading-relaxed space-y-2">
              <p>
                Every GRACIA pass automatically features an inspiring Bible verse assigned via deterministic hashing:
              </p>
              
              <div className="flex flex-wrap items-center gap-2 pt-0.5">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800/90 border border-slate-700/80 text-xs">
                  <span className="text-slate-400 text-[11px]">Format:</span>
                  <span className="font-mono font-bold text-amber-300">GRACIA-[NAME4]-[BOOK3]-[CH:VS]</span>
                </div>

                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800/60 border border-slate-700/50 text-xs">
                  <span className="text-slate-400 text-[11px]">Example:</span>
                  <span className="font-mono font-bold text-emerald-300">GRACIA-SIJU-ROM-12:2</span>
                </div>

                <span className="text-slate-400 text-xs hidden xl:inline">
                  • Track issued passes, verify venue gate check-ins, or revoke compromised pass IDs in real time.
                </span>
              </div>
            </div>
          </div>

          {/* Action Buttons Toolbar */}
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 shrink-0 self-start lg:self-center">
            {onBackToHome && (
              <button
                type="button"
                onClick={onBackToHome}
                className="px-3.5 py-2.5 bg-purple-950/80 hover:bg-purple-900 text-purple-200 border border-purple-500/30 font-semibold rounded-xl text-xs flex items-center gap-1.5 whitespace-nowrap transition-all cursor-pointer shadow-sm active:scale-95"
                title="Return to Super Admin Overview"
              >
                <ChevronLeft className="w-4 h-4 text-purple-300 shrink-0" />
                <span>Super Admin Hub</span>
              </button>
            )}

            <button
              id="add-bible-verse-btn"
              type="button"
              onClick={handleOpenAddModal}
              className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1.5 whitespace-nowrap transition-all cursor-pointer shadow-md active:scale-95"
            >
              <Plus className="w-4 h-4 shrink-0" />
              <span>Add Custom Verse</span>
            </button>

            {isSuperAdmin && (
              <button
                type="button"
                onClick={() => setIsResetModalOpen(true)}
                className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-medium rounded-xl text-xs flex items-center gap-1.5 whitespace-nowrap transition-all cursor-pointer shadow-sm active:scale-95"
                title="Synchronize and reset all 400+ Jubilee verses in Firestore"
              >
                <RotateCcw className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>Sync 400+ Pool</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleExportCSV}
              className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-medium rounded-xl text-xs flex items-center gap-1.5 whitespace-nowrap transition-all cursor-pointer shadow-sm active:scale-95"
              title="Download full CSV report"
            >
              <Download className="w-3.5 h-3.5 text-slate-300 shrink-0" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* LIVE PASS ISSUANCE & SCANNING METRICS ROW */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mt-5 pt-5 border-t border-slate-800/80">
          
          {/* Card 1: Total Passes Issued */}
          <div className="p-3.5 rounded-xl bg-slate-800/50 border border-slate-700/60 hover:border-amber-500/40 transition-all">
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-300 uppercase tracking-wider">
              <span>Passes Issued</span>
              <Ticket className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <div className="text-2xl font-extrabold text-amber-400 tracking-tight mt-1 font-mono">
              {totalPassesIssued}
            </div>
            <div className="text-[10px] text-slate-400 mt-1 flex items-center justify-between">
              <span>Attendees</span>
              <button
                onClick={() => setActiveTab('issued_passes')}
                className="text-amber-300 hover:text-amber-200 font-semibold text-[10px] transition-colors"
              >
                View Passes →
              </button>
            </div>
          </div>

          {/* Card 2: Scanned & Used */}
          <div className="p-3.5 rounded-xl bg-emerald-950/30 border border-emerald-500/30 hover:border-emerald-400/50 transition-all">
            <div className="flex items-center justify-between text-[11px] font-bold text-emerald-300 uppercase tracking-wider">
              <span>Scanned & Used</span>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="text-2xl font-extrabold text-emerald-400 tracking-tight mt-1 font-mono">
              {totalPassesScanned}
            </div>
            <div className="text-[10px] text-emerald-200/70 mt-1 flex items-center justify-between">
              <span>Scan Rate:</span>
              <span className="font-bold text-emerald-300">{scanRatePercent}%</span>
            </div>
          </div>

          {/* Card 3: Pending / Unscanned Passes */}
          <div className="p-3.5 rounded-xl bg-slate-800/50 border border-slate-700/60 hover:border-blue-500/40 transition-all">
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-300 uppercase tracking-wider">
              <span>Pending Scans</span>
              <QrCode className="w-3.5 h-3.5 text-blue-400" />
            </div>
            <div className="text-2xl font-extrabold text-blue-400 tracking-tight mt-1 font-mono">
              {totalPassesUnscanned}
            </div>
            <div className="text-[10px] text-slate-400 mt-1">
              Awaiting check-in
            </div>
          </div>

          {/* Card 4: Invalidated / Revoked Passes */}
          <div className="p-3.5 rounded-xl bg-rose-950/30 border border-rose-500/30 hover:border-rose-400/50 transition-all">
            <div className="flex items-center justify-between text-[11px] font-bold text-rose-300 uppercase tracking-wider">
              <span>Invalid / Revoked</span>
              <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
            </div>
            <div className="text-2xl font-extrabold text-rose-400 tracking-tight mt-1 font-mono">
              {totalPassesInvalid}
            </div>
            <div className="text-[10px] text-rose-200/70 mt-1 flex items-center justify-between">
              <span>Blocked:</span>
              <button
                onClick={() => {
                  setActiveTab('issued_passes');
                  setStatusFilter('invalid');
                }}
                className="text-rose-300 hover:text-rose-200 font-semibold text-[10px] transition-colors"
              >
                Inspect →
              </button>
            </div>
          </div>

          {/* Card 5: Scripture Pool Total */}
          <div className="p-3.5 rounded-xl bg-slate-800/50 border border-slate-700/60 hover:border-purple-500/40 transition-all col-span-2 sm:col-span-1">
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-300 uppercase tracking-wider">
              <span>Scripture Pool</span>
              <BookOpen className="w-3.5 h-3.5 text-purple-400" />
            </div>
            <div className="text-2xl font-extrabold text-purple-300 tracking-tight mt-1 font-mono">
              {verses.length}
            </div>
            <div className="text-[10px] text-slate-400 mt-1 flex items-center justify-between">
              <span>Active: {verses.filter(v => v.isActive !== false && !v.isInvalid).length}</span>
              <button
                onClick={() => setActiveTab('verses')}
                className="text-purple-300 hover:text-purple-200 font-semibold text-[10px] transition-colors"
              >
                View Pool →
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* Action Message Flash Banner */}
      {actionMessage && (
        <div
          className={`p-4 rounded-2xl border flex items-center justify-between shadow-lg animate-fadeIn ${
            actionMessage.type === 'success'
              ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-900'
              : actionMessage.type === 'info'
              ? 'bg-blue-500/15 border-blue-500/40 text-blue-900'
              : 'bg-rose-500/15 border-rose-500/40 text-rose-900'
          }`}
        >
          <div className="flex items-center gap-3">
            {actionMessage.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : actionMessage.type === 'info' ? (
              <AlertCircle className="w-5 h-5 text-blue-600 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            )}
            <span className="text-sm font-semibold">{actionMessage.text}</span>
          </div>
          <button
            onClick={() => setActionMessage(null)}
            className="p-1 text-slate-500 hover:text-slate-900 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* SUB-VIEW TOGGLE TABS: Verses Pool Table vs Issued Passes Explorer */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-2">
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setActiveTab('verses')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center space-x-2 transition-all cursor-pointer ${
              activeTab === 'verses'
                ? 'bg-amber-600 text-white shadow-md'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Bible Verses Pool ({verses.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('issued_passes')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center space-x-2 transition-all cursor-pointer ${
              activeTab === 'issued_passes'
                ? 'bg-amber-600 text-white shadow-md'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Ticket className="w-4 h-4" />
            <span>Issued Pass IDs ({allIssuedPasses.length})</span>
            {totalPassesInvalid > 0 && (
              <span className="px-1.5 py-0.2 bg-rose-500 text-white text-[10px] rounded-full font-mono">
                {totalPassesInvalid} invalid
              </span>
            )}
          </button>
        </div>

        <span className="text-xs text-slate-500 hidden sm:inline">
          {activeTab === 'verses' ? `Showing Scripture reference catalog` : `Live Attendee Pass Verification Table`}
        </span>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
          
          {/* Search Box */}
          <div className="relative w-full sm:w-96">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder={activeTab === 'verses' ? "Search reference, text, theme (e.g. ROMANS, JOY)..." : "Search attendee name, email, pass ID (e.g. SIJU, ROM)..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Quick Filter Buttons */}
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                statusFilter === 'all'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All Records
            </button>

            <button
              onClick={() => setStatusFilter('active')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors flex items-center gap-1 ${
                statusFilter === 'active'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Valid & Active</span>
            </button>

            <button
              onClick={() => setStatusFilter('invalid')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors flex items-center gap-1 ${
                statusFilter === 'invalid'
                  ? 'bg-rose-600 text-white'
                  : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Invalid / Revoked</span>
            </button>

            {activeTab === 'verses' && (
              <button
                onClick={() => setStatusFilter('issued')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors flex items-center gap-1 ${
                  statusFilter === 'issued'
                    ? 'bg-amber-600 text-white'
                    : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                }`}
              >
                <Ticket className="w-3.5 h-3.5" />
                <span>Currently Issued</span>
              </button>
            )}

            <button
              onClick={() => setStatusFilter('scanned')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors flex items-center gap-1 ${
                statusFilter === 'scanned'
                  ? 'bg-blue-600 text-white'
                  : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
              }`}
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>Scanned / Used</span>
            </button>
          </div>
        </div>

        {/* Category Pills (For Verses Tab) */}
        {activeTab === 'verses' && (
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-2 border-t border-slate-100">
            <span className="text-[11px] font-bold text-slate-400 uppercase shrink-0 mr-1 flex items-center gap-1">
              <Filter className="w-3 h-3" />
              Category:
            </span>
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-2.5 py-1 rounded-md text-xs font-medium shrink-0 cursor-pointer transition-colors ${
                selectedCategory === 'all'
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All Categories ({verses.length})
            </button>
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => setSelectedCategory(c)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium shrink-0 cursor-pointer transition-colors ${
                  selectedCategory === c
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* VIEW 1: MAIN SCRIPTURE VERSES TABLE */}
      {activeTab === 'verses' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-slate-700 text-xs uppercase tracking-wider font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3.5 w-12 text-center">#</th>
                  <th className="px-4 py-3.5">Verse Reference</th>
                  <th className="px-4 py-3.5">Pass ID Format</th>
                  <th className="px-4 py-3.5">Scripture Text</th>
                  <th className="px-4 py-3.5">Theme</th>
                  <th className="px-4 py-3.5 text-center">Status</th>
                  <th className="px-4 py-3.5 text-center">Issued / Used</th>
                  <th className="px-4 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-normal">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                        <span>Loading Scripture verses from database...</span>
                      </div>
                    </td>
                  </tr>
                ) : paginatedVerses.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-slate-400">
                      <BookOpen className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                      <p className="font-medium text-slate-600">No Bible verses found matching filters</p>
                      <p className="text-xs text-slate-400 mt-1">
                        {searchQuery ? 'Try clearing your search query.' : 'Click "Sync 400+ Pool" to initialize all default Jubilee verses.'}
                      </p>
                    </td>
                  </tr>
                ) : (
                  paginatedVerses.map((verse, index) => {
                    const globalIdx = (currentPage - 1) * pageSize + index + 1;
                    const samplePassId = getBibleVersePassId(verse.reference, 0, 'Sijumon Abraham');
                    const isInvalid = verse.isInvalid === true || verse.isActive === false;

                    const cleanRef = verse.reference.toUpperCase();
                    const [book, num] = cleanRef.split('-');
                    const book3 = getBookCode3(book || '');
                    const shortRef = `${book3}-${num}`.toUpperCase();
                    const matchedIssued = (verseToIssuedPassesMap.get(cleanRef) || []).concat(verseToIssuedPassesMap.get(shortRef) || []);
                    const isUsedScanned = matchedIssued.some(p => p.isScanned);

                    return (
                      <tr
                        key={verse.id || verse.reference + index}
                        className={`hover:bg-slate-50/80 transition-colors ${
                          isInvalid ? 'bg-rose-50/30' : ''
                        }`}
                      >
                        <td className="px-4 py-3 text-center text-xs font-mono text-slate-400">
                          {globalIdx}
                        </td>

                        <td className="px-4 py-3 font-semibold text-slate-900 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs bg-slate-100 text-slate-800 px-2 py-1 rounded-md border border-slate-200 font-bold">
                              {verse.reference}
                            </span>
                          </div>
                        </td>

                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="font-mono text-xs font-bold text-amber-800 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200">
                            {samplePassId}
                          </span>
                        </td>

                        <td className="px-4 py-3 max-w-md">
                          <p className="line-clamp-2 text-xs text-slate-700 leading-relaxed italic">
                            "{verse.text}"
                          </p>
                        </td>

                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="inline-block px-2.5 py-0.5 text-xs font-medium rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                            {verse.category || 'Encouragement'}
                          </span>
                        </td>

                        {/* Status Toggle & Badge */}
                        <td className="px-4 py-3 text-center whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => handleToggleVerseValidity(verse)}
                            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold cursor-pointer transition-all ${
                              !isInvalid
                                ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border border-emerald-300'
                                : 'bg-rose-100 text-rose-800 hover:bg-rose-200 border border-rose-300'
                            }`}
                            title="Click to toggle between Valid & Invalid"
                          >
                            {!isInvalid ? (
                              <>
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                <span>Valid & Active</span>
                              </>
                            ) : (
                              <>
                                <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
                                <span>INVALID / BLOCKED</span>
                              </>
                            )}
                          </button>
                          {isInvalid && verse.invalidReason && (
                            <div className="text-[10px] text-rose-600 mt-0.5 italic max-w-[140px] truncate mx-auto" title={verse.invalidReason}>
                              {verse.invalidReason}
                            </div>
                          )}
                        </td>

                        {/* Issued / Scanned Status */}
                        <td className="px-4 py-3 text-center whitespace-nowrap">
                          {matchedIssued.length > 0 ? (
                            <div className="space-y-0.5">
                              <span className="inline-block px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                                {matchedIssued.length} Issued
                              </span>
                              {isUsedScanned && (
                                <div className="text-[10px] font-bold text-emerald-600 flex items-center justify-center gap-0.5">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                  <span>Scanned</span>
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-400 italic">In Pool (Unassigned)</span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              id={`edit-verse-${verse.reference}`}
                              type="button"
                              onClick={() => handleOpenEditModal(verse)}
                              className="px-2.5 py-1.5 text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-lg transition-colors border border-amber-200 flex items-center gap-1 cursor-pointer"
                              title="Edit verse details and status"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                              <span>Edit</span>
                            </button>

                            {isSuperAdmin && (
                              <button
                                id={`delete-verse-${verse.reference}`}
                                type="button"
                                onClick={() => {
                                  setVerseToDelete(verse);
                                  setIsDeleteModalOpen(true);
                                }}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                title="Delete from pool"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          <div className="bg-slate-50 px-4 py-3 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
            <div className="flex items-center gap-2">
              <span>
                Showing {filteredVerses.length > 0 ? (currentPage - 1) * pageSize + 1 : 0} to{' '}
                {Math.min(currentPage * pageSize, filteredVerses.length)} of {filteredVerses.length} verses
              </span>
              <span className="text-slate-300">|</span>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="bg-white border border-slate-200 rounded-md px-2 py-1 text-xs"
              >
                <option value={25}>25 per page</option>
                <option value={50}>50 per page</option>
                <option value={100}>100 per page</option>
              </select>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1 rounded-md border border-slate-200 disabled:opacity-30 hover:bg-white cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-2 font-mono">
                {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="p-1 rounded-md border border-slate-200 disabled:opacity-30 hover:bg-white cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 2: ISSUED PASSES TABLE WITH 1-CLICK INVALIDATION */}
      {activeTab === 'issued_passes' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-slate-700 text-xs uppercase tracking-wider font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3.5 w-12 text-center">#</th>
                  <th className="px-4 py-3.5">Issued Pass ID</th>
                  <th className="px-4 py-3.5">Attendee / Contact</th>
                  <th className="px-4 py-3.5">Type & Category</th>
                  <th className="px-4 py-3.5 text-center">Scan Status (Gate)</th>
                  <th className="px-4 py-3.5 text-center">Pass Validity</th>
                  <th className="px-4 py-3.5 text-right">Invalidate Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-normal">
                {paginatedIssuedPasses.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                      <Ticket className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                      <p className="font-medium text-slate-600">No issued passes found matching filters</p>
                    </td>
                  </tr>
                ) : (
                  paginatedIssuedPasses.map((pass, index) => {
                    const globalIdx = (currentPage - 1) * pageSize + index + 1;
                    return (
                      <tr
                        key={pass.passId + index}
                        className={`hover:bg-slate-50/80 transition-colors ${
                          pass.isInvalid ? 'bg-rose-50/40' : pass.isScanned ? 'bg-emerald-50/20' : ''
                        }`}
                      >
                        <td className="px-4 py-3 text-center text-xs font-mono text-slate-400">
                          {globalIdx}
                        </td>

                        <td className="px-4 py-3 font-mono font-bold text-slate-900 whitespace-nowrap">
                          <span className={`px-2.5 py-1 rounded-lg text-xs border ${
                            pass.isInvalid
                              ? 'bg-rose-100 text-rose-900 border-rose-300 line-through'
                              : 'bg-amber-50 text-amber-900 border-amber-200'
                          }`}>
                            {pass.passId}
                          </span>
                        </td>

                        <td className="px-4 py-3">
                          <div className="font-bold text-slate-900 text-xs">
                            {pass.attendeeName}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {pass.registrantEmail} {pass.registrantPhone ? `• ${pass.registrantPhone}` : ''}
                          </div>
                        </td>

                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                            {pass.type === 'musical' ? 'Concert' : 'Conference'} ({pass.attendeeCategory})
                          </span>
                        </td>

                        {/* Gate Scan Status */}
                        <td className="px-4 py-3 text-center whitespace-nowrap">
                          {pass.isScanned ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              <span>SCANNED & USED</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
                              <Clock className="w-3 h-3 text-slate-400" />
                              <span>Pending Scan</span>
                            </span>
                          )}
                          {pass.scannedAt && (
                            <div className="text-[10px] text-slate-400 mt-0.5 font-mono">
                              {new Date(pass.scannedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          )}
                        </td>

                        {/* Pass Validity */}
                        <td className="px-4 py-3 text-center whitespace-nowrap">
                          {pass.isInvalid ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300">
                              <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
                              <span>INVALID / REVOKED</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                              <span>VALID</span>
                            </span>
                          )}
                        </td>

                        {/* Invalidate / Restore Button */}
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => {
                              setInvalidatingPassTarget({
                                passId: pass.passId,
                                registrantId: pass.registrantId,
                                targetName: pass.attendeeName,
                                currentInvalid: pass.isInvalid,
                                reason: pass.invalidReason || ''
                              });
                            }}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm flex items-center gap-1.5 ml-auto ${
                              pass.isInvalid
                                ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                : 'bg-rose-600 hover:bg-rose-700 text-white'
                            }`}
                          >
                            {pass.isInvalid ? (
                              <>
                                <Check className="w-3.5 h-3.5" />
                                <span>Restore Pass</span>
                              </>
                            ) : (
                              <>
                                <ShieldAlert className="w-3.5 h-3.5" />
                                <span>Make Invalid</span>
                              </>
                            )}
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          <div className="bg-slate-50 px-4 py-3 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
            <div className="flex items-center gap-2">
              <span>
                Showing {filteredIssuedPasses.length > 0 ? (currentPage - 1) * pageSize + 1 : 0} to{' '}
                {Math.min(currentPage * pageSize, filteredIssuedPasses.length)} of {filteredIssuedPasses.length} issued passes
              </span>
              <span className="text-slate-300">|</span>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="bg-white border border-slate-200 rounded-md px-2 py-1 text-xs"
              >
                <option value={25}>25 per page</option>
                <option value={50}>50 per page</option>
                <option value={100}>100 per page</option>
              </select>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1 rounded-md border border-slate-200 disabled:opacity-30 hover:bg-white cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-2 font-mono">
                {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="p-1 rounded-md border border-slate-200 disabled:opacity-30 hover:bg-white cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: FULL EDIT / ADD SCRIPTURE VERSE MODAL (ALL FIELDS POPULATED) */}
      {isEditModalOpen && editingVerse && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-100 overflow-hidden max-h-[90vh] flex flex-col">
            
            {/* Modal Header */}
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <BookOpen className="w-5 h-5 text-amber-400" />
                <div>
                  <h3 className="font-bold text-base">
                    {editingVerse.id ? 'Edit Scripture Pass ID Details' : 'Add New Scripture to Jubilee Pool'}
                  </h3>
                  <p className="text-xs text-amber-200/80">
                    Format: GRACIA-[NAME4]-[BOOK3]-[CH:VS]
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsEditModalOpen(false);
                  setEditingVerse(null);
                }}
                className="text-slate-400 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form Content */}
            <form onSubmit={handleSaveVerse} className="p-6 space-y-4 overflow-y-auto">
              
              {/* Reference Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-1">
                  <label className="block text-xs font-bold text-slate-700 mb-1 uppercase">
                    Book Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. ROMANS"
                    value={editingVerse.book || ''}
                    onChange={(e) => {
                      const bookVal = e.target.value.toUpperCase();
                      const refVal = `${bookVal}-${editingVerse.chapter || '1'}:${editingVerse.verse || '1'}`;
                      setEditingVerse({
                        ...editingVerse,
                        book: bookVal,
                        reference: refVal
                      });
                    }}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-amber-500 uppercase"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 uppercase">
                    Chapter <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 12"
                    value={editingVerse.chapter || ''}
                    onChange={(e) => {
                      const chapVal = e.target.value;
                      const refVal = `${editingVerse.book || 'ROMANS'}-${chapVal}:${editingVerse.verse || '1'}`;
                      setEditingVerse({
                        ...editingVerse,
                        chapter: chapVal,
                        reference: refVal
                      });
                    }}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 uppercase">
                    Verse No <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 2"
                    value={editingVerse.verse || ''}
                    onChange={(e) => {
                      const verseVal = e.target.value;
                      const refVal = `${editingVerse.book || 'ROMANS'}-${editingVerse.chapter || '1'}:${verseVal}`;
                      setEditingVerse({
                        ...editingVerse,
                        verse: verseVal,
                        reference: refVal
                      });
                    }}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              {/* Computed Reference Display */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 uppercase">
                  Full Normalized Verse Reference <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. ROMANS-12:2"
                  value={editingVerse.reference || ''}
                  onChange={(e) =>
                    setEditingVerse({ ...editingVerse, reference: e.target.value.toUpperCase() })
                  }
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm font-mono font-bold bg-slate-50 focus:outline-none focus:ring-2 focus:ring-amber-500 uppercase"
                />
              </div>

              {/* Theme & Category */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 uppercase">
                  Theme / Category
                </label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {COMMON_THEMES.map((theme) => (
                    <button
                      key={theme}
                      type="button"
                      onClick={() => setEditingVerse({ ...editingVerse, category: theme })}
                      className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-colors cursor-pointer ${
                        editingVerse.category === theme
                          ? 'bg-amber-600 text-white font-bold'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {theme}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  placeholder="Or enter custom category..."
                  value={editingVerse.category || ''}
                  onChange={(e) => setEditingVerse({ ...editingVerse, category: e.target.value })}
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              {/* Scripture Text */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 uppercase">
                  Full Scripture Text <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows={4}
                  placeholder="Enter the full scripture verse text here..."
                  value={editingVerse.text || ''}
                  onChange={(e) => setEditingVerse({ ...editingVerse, text: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              {/* PASS VALIDITY & INVALIDATION CONTROLS */}
              <div className="p-4 rounded-2xl border bg-slate-50 space-y-3">
                <label className="block text-xs font-bold text-slate-800 uppercase">
                  Pass Validity & Invalidation Status
                </label>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className={`p-3 rounded-xl border flex items-center gap-2.5 cursor-pointer transition-all ${
                    !editingVerse.isInvalid
                      ? 'bg-emerald-50 border-emerald-400 text-emerald-950 font-bold'
                      : 'bg-white border-slate-200 text-slate-600'
                  }`}>
                    <input
                      type="radio"
                      name="passValidity"
                      checked={!editingVerse.isInvalid}
                      onChange={() => setEditingVerse({ ...editingVerse, isInvalid: false, isActive: true, invalidReason: '' })}
                      className="text-emerald-600 focus:ring-emerald-500"
                    />
                    <div className="text-xs">
                      <div className="font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Valid & Active</span>
                      </div>
                      <div className="text-[11px] text-slate-500 font-normal">
                        Permitted for Pass Generation & Gate Entry
                      </div>
                    </div>
                  </label>

                  <label className={`p-3 rounded-xl border flex items-center gap-2.5 cursor-pointer transition-all ${
                    editingVerse.isInvalid
                      ? 'bg-rose-50 border-rose-400 text-rose-950 font-bold'
                      : 'bg-white border-slate-200 text-slate-600'
                  }`}>
                    <input
                      type="radio"
                      name="passValidity"
                      checked={editingVerse.isInvalid === true}
                      onChange={() => setEditingVerse({ ...editingVerse, isInvalid: true, isActive: false })}
                      className="text-rose-600 focus:ring-rose-500"
                    />
                    <div className="text-xs">
                      <div className="font-bold flex items-center gap-1 text-rose-800">
                        <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
                        <span>Invalid / Revoked</span>
                      </div>
                      <div className="text-[11px] text-slate-500 font-normal">
                        Blocks QR scanning and gate check-in
                      </div>
                    </div>
                  </label>
                </div>

                {editingVerse.isInvalid && (
                  <div>
                    <label className="block text-[11px] font-bold text-rose-800 mb-1 uppercase">
                      Reason for Invalidation
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Duplicate pass, Refunded, Compromised QR code, Test pass..."
                      value={editingVerse.invalidReason || ''}
                      onChange={(e) => setEditingVerse({ ...editingVerse, invalidReason: e.target.value })}
                      className="w-full px-3.5 py-2 border border-rose-300 rounded-xl text-xs bg-white focus:outline-none focus:ring-2 focus:ring-rose-500 text-rose-900"
                    />
                  </div>
                )}
              </div>

              {/* LIVE PASS ID GENERATION PREVIEWS */}
              {editingVerse.reference && (
                <div className="bg-amber-50/80 p-4 rounded-2xl border border-amber-200/80 space-y-2">
                  <div className="text-xs font-bold text-amber-950 uppercase flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                    <span>Deterministic Generated Pass ID Previews:</span>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
                    <div className="bg-white p-2.5 rounded-xl border border-amber-200">
                      <span className="text-[10px] text-slate-500 block">Sample 1 (Sijumon Abraham):</span>
                      <strong className="text-amber-800">{getBibleVersePassId(editingVerse.reference, 0, 'Sijumon Abraham')}</strong>
                    </div>

                    <div className="bg-white p-2.5 rounded-xl border border-amber-200">
                      <span className="text-[10px] text-slate-500 block">Sample 2 (Mary Joseph):</span>
                      <strong className="text-amber-800">{getBibleVersePassId(editingVerse.reference, 1, 'Mary Joseph')}</strong>
                    </div>
                  </div>
                </div>
              )}

              {/* Form Buttons */}
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditModalOpen(false);
                    setEditingVerse(null);
                  }}
                  className="px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl transition-colors shadow-lg disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Saving to Pool...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Save Scripture Pass ID</span>
                    </>
                  )}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: CONFIRM INDIVIDUAL PASS INVALIDATION / RESTORATION */}
      {invalidatingPassTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl p-6 border border-slate-100 space-y-4">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mx-auto ${
              invalidatingPassTarget.currentInvalid
                ? 'bg-emerald-100 text-emerald-600'
                : 'bg-rose-100 text-rose-600'
            }`}>
              {invalidatingPassTarget.currentInvalid ? (
                <ShieldCheck className="w-6 h-6" />
              ) : (
                <ShieldAlert className="w-6 h-6" />
              )}
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-slate-900">
                {invalidatingPassTarget.currentInvalid
                  ? 'Restore Pass to Valid?'
                  : 'Invalidate / Revoke Pass ID?'}
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Pass ID: <span className="font-mono font-bold text-slate-800">{invalidatingPassTarget.passId}</span>
                <br />
                Attendee: <strong>{invalidatingPassTarget.targetName}</strong>
              </p>
            </div>

            {!invalidatingPassTarget.currentInvalid && (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 uppercase">
                  Reason for Invalidation
                </label>
                <input
                  type="text"
                  placeholder="e.g. Ticket cancelled, duplicate, security block..."
                  value={invalidatingPassTarget.reason}
                  onChange={(e) => setInvalidatingPassTarget({
                    ...invalidatingPassTarget,
                    reason: e.target.value
                  })}
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>
            )}

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setInvalidatingPassTarget(null)}
                className="w-1/2 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecutePassInvalidation}
                disabled={isSubmitting}
                className={`w-1/2 py-2.5 text-xs font-bold rounded-xl text-white shadow-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
                  invalidatingPassTarget.currentInvalid
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                {isSubmitting ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : invalidatingPassTarget.currentInvalid ? (
                  'Confirm Restore'
                ) : (
                  'Confirm Invalidate'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: DELETE VERSE CONFIRMATION */}
      {isDeleteModalOpen && verseToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl p-6 border border-slate-100 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-slate-900">
                Remove Verse from Pool?
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Are you sure you want to remove <span className="font-mono font-bold text-rose-700">{verseToDelete.reference}</span> from the active pool?
              </p>
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setVerseToDelete(null);
                }}
                className="w-1/2 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={isSubmitting}
                className="w-1/2 py-2.5 text-xs font-bold rounded-xl text-white bg-rose-600 hover:bg-rose-700 shadow-lg transition-colors cursor-pointer"
              >
                {isSubmitting ? 'Deleting...' : 'Delete Verse'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: SYNC / RESET 400+ VERSES CONFIRMATION */}
      {isResetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl p-6 border border-slate-100 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center mx-auto">
              <RotateCcw className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-slate-900">
                Sync 400+ Standard Jubilee Verses?
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                This will write all 400+ standard positive and encouraging Jubilee Bible verses to Firestore database so they are safely preserved in the cloud.
              </p>
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setIsResetModalOpen(false)}
                className="w-1/2 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleResetToDefaults}
                disabled={isSubmitting}
                className="w-1/2 py-2.5 text-xs font-bold rounded-xl text-white bg-amber-600 hover:bg-amber-700 shadow-lg transition-colors cursor-pointer"
              >
                {isSubmitting ? 'Syncing...' : 'Confirm Sync'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
