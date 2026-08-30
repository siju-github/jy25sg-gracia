import { INITIAL_400_BIBLE_VERSES } from '../data/inspiringBibleVerses400';
import { 
  collection, 
  doc, 
  getDocs, 
  setDoc, 
  deleteDoc, 
  onSnapshot, 
  writeBatch 
} from 'firebase/firestore';
import { db } from './firebase';

export interface BibleVerseItem {
  id?: string;
  reference: string;
  text: string;
  category?: string;
  book?: string;
  chapter?: string;
  verse?: string;
  isActive?: boolean;
  isInvalid?: boolean;
  invalidReason?: string;
  isDeleted?: boolean;
  updatedAt?: string;
  updatedBy?: string;
}

// In-memory cache initialized with the 570+ positive and encouraging jubilee verses
export const INSPIRING_BIBLE_VERSES: BibleVerseItem[] = [...INITIAL_400_BIBLE_VERSES];

/**
 * Merge baseline 400+ Jubilee Bible verses with Firestore overrides and custom items.
 * Ensures that saving or editing 1 verse in Firestore NEVER wipes out the other 400+ built-in verses!
 */
export function mergeBibleVerses(firestoreDocs: BibleVerseItem[] = []): BibleVerseItem[] {
  const map = new Map<string, BibleVerseItem>();

  // 1. Load baseline built-in dataset
  INITIAL_400_BIBLE_VERSES.forEach((item) => {
    const cleanRef = item.reference.trim().toUpperCase().replace(/\s+/g, '-');
    const docId = cleanRef.replace(/[^A-Z0-9:-]/gi, '_');
    
    let book = '';
    let chapter = '';
    let verseNum = '';
    const [b, cv] = cleanRef.split('-');
    if (b) book = b;
    if (cv) {
      const [c, v] = cv.split(':');
      if (c) chapter = c;
      if (v) verseNum = v;
    }

    map.set(cleanRef, {
      ...item,
      id: docId,
      reference: cleanRef,
      book,
      chapter,
      verse: verseNum,
      isActive: item.isActive !== false,
      isInvalid: false,
      invalidReason: '',
      isDeleted: false
    });
  });

  // 2. Overlay Firestore documents (custom additions, updates, deleted markers, invalidations)
  firestoreDocs.forEach((docItem) => {
    if (!docItem) return;
    const cleanRef = (docItem.reference || docItem.id || '').trim().toUpperCase().replace(/\s+/g, '-');
    if (!cleanRef) return;

    if (docItem.isDeleted) {
      map.delete(cleanRef);
      return;
    }

    const existing = map.get(cleanRef) || {};
    
    let book = docItem.book || (existing as BibleVerseItem).book || '';
    let chapter = docItem.chapter || (existing as BibleVerseItem).chapter || '';
    let verseNum = docItem.verse || (existing as BibleVerseItem).verse || '';
    if (!book || !chapter || !verseNum) {
      const [b, cv] = cleanRef.split('-');
      if (b && !book) book = b;
      if (cv) {
        const [c, v] = cv.split(':');
        if (c && !chapter) chapter = c;
        if (v && !verseNum) verseNum = v;
      }
    }

    map.set(cleanRef, {
      ...existing,
      ...docItem,
      id: docItem.id || cleanRef.replace(/[^A-Z0-9:-]/gi, '_'),
      reference: cleanRef,
      book,
      chapter,
      verse: verseNum,
      isActive: docItem.isInvalid ? false : (docItem.isActive !== false),
      isInvalid: docItem.isInvalid === true || docItem.isActive === false,
      invalidReason: docItem.invalidReason || '',
      isDeleted: false
    });
  });

  return Array.from(map.values());
}

let cachedDynamicVerses: BibleVerseItem[] = mergeBibleVerses([]);

/**
 * Get current active verses in memory (or fallback to defaults)
 */
export function getActiveBibleVerses(): BibleVerseItem[] {
  const activeOnly = cachedDynamicVerses.filter(v => v.isActive !== false && !v.isInvalid);
  return activeOnly.length > 0 ? activeOnly : INSPIRING_BIBLE_VERSES;
}

/**
 * Real-time listener for Bible Verses from Firestore with baseline fallback merge
 */
export function subscribeBibleVerses(
  onUpdate: (verses: BibleVerseItem[]) => void,
  onError?: (error: any) => void
): () => void {
  try {
    const colRef = collection(db, 'bible_verses');
    return onSnapshot(
      colRef,
      (snapshot) => {
        const firestoreList: BibleVerseItem[] = snapshot.docs.map(d => ({
          id: d.id,
          ...(d.data() as Omit<BibleVerseItem, 'id'>)
        }));
        const merged = mergeBibleVerses(firestoreList);
        cachedDynamicVerses = merged;
        onUpdate(merged);
      },
      (err) => {
        console.warn('Bible verses Firestore subscription warning, using merged fallback dataset:', err);
        if (onError) onError(err);
        const merged = mergeBibleVerses([]);
        cachedDynamicVerses = merged;
        onUpdate(merged);
      }
    );
  } catch (err) {
    console.warn('Failed to subscribe to bible_verses collection:', err);
    const merged = mergeBibleVerses([]);
    cachedDynamicVerses = merged;
    onUpdate(merged);
    return () => {};
  }
}

/**
 * Fetch all Bible verses from Firestore once (merged with 400+ baseline)
 */
export async function fetchBibleVersesFromFirestore(): Promise<BibleVerseItem[]> {
  try {
    const colRef = collection(db, 'bible_verses');
    const snapshot = await getDocs(colRef);
    const firestoreList: BibleVerseItem[] = snapshot.docs.map(d => ({
      id: d.id,
      ...(d.data() as Omit<BibleVerseItem, 'id'>)
    }));
    const merged = mergeBibleVerses(firestoreList);
    cachedDynamicVerses = merged;
    return merged;
  } catch (err) {
    console.warn('Failed to fetch bible verses from Firestore, using built-in library:', err);
    const merged = mergeBibleVerses([]);
    cachedDynamicVerses = merged;
    return merged;
  }
}

/**
 * Add or update a Bible verse in Firestore
 */
export async function saveBibleVerseToFirestore(
  verse: BibleVerseItem, 
  adminEmail: string = 'admin@jesusyouth.sg'
): Promise<string> {
  const cleanRef = verse.reference.trim().toUpperCase().replace(/\s+/g, '-');
  const docId = verse.id || cleanRef.replace(/[^A-Z0-9:-]/gi, '_');
  const docRef = doc(db, 'bible_verses', docId);

  let book = verse.book;
  let chapter = verse.chapter;
  let verseNum = verse.verse;
  if (!book || !chapter || !verseNum) {
    const [b, cv] = cleanRef.split('-');
    if (b && !book) book = b;
    if (cv) {
      const [c, v] = cv.split(':');
      if (c && !chapter) chapter = c;
      if (v && !verseNum) verseNum = v;
    }
  }

  const isInvalid = verse.isInvalid === true || verse.isActive === false;

  const payload: BibleVerseItem = {
    id: docId,
    reference: cleanRef,
    text: verse.text.trim(),
    category: verse.category?.trim() || 'Encouragement',
    book: book || '',
    chapter: chapter || '',
    verse: verseNum || '',
    isActive: !isInvalid,
    isInvalid: isInvalid,
    invalidReason: verse.invalidReason?.trim() || '',
    isDeleted: false,
    updatedAt: new Date().toISOString(),
    updatedBy: adminEmail
  };

  await setDoc(docRef, payload, { merge: true });

  // Update local cache safely without clearing others
  const merged = mergeBibleVerses([payload]);
  cachedDynamicVerses = merged;

  return docId;
}

/**
 * Mark a Bible verse pass ID as invalid or valid directly
 */
export async function setBibleVerseInvalidStatus(
  verse: BibleVerseItem,
  isInvalid: boolean,
  reason: string = '',
  adminEmail: string = 'admin@jesusyouth.sg'
): Promise<void> {
  const cleanRef = verse.reference.trim().toUpperCase().replace(/\s+/g, '-');
  const docId = verse.id || cleanRef.replace(/[^A-Z0-9:-]/gi, '_');
  const docRef = doc(db, 'bible_verses', docId);

  const payload: Partial<BibleVerseItem> = {
    id: docId,
    reference: cleanRef,
    isActive: !isInvalid,
    isInvalid: isInvalid,
    invalidReason: reason || (isInvalid ? 'Manually revoked by admin' : ''),
    updatedAt: new Date().toISOString(),
    updatedBy: adminEmail
  };

  await setDoc(docRef, payload, { merge: true });
}

/**
 * Delete a Bible verse from Firestore
 */
export async function deleteBibleVerseFromFirestore(verseIdOrRef: string, adminEmail: string = 'admin@jesusyouth.sg'): Promise<void> {
  const cleanRef = verseIdOrRef.trim().toUpperCase().replace(/\s+/g, '-');
  const docId = cleanRef.replace(/[^A-Z0-9:-]/gi, '_');
  const docRef = doc(db, 'bible_verses', docId);
  
  // Set isDeleted flag so the merge doesn't resurrect baseline verse
  await setDoc(docRef, {
    id: docId,
    reference: cleanRef,
    isDeleted: true,
    isActive: false,
    updatedAt: new Date().toISOString(),
    updatedBy: adminEmail
  }, { merge: true });

  // Update local cache
  cachedDynamicVerses = cachedDynamicVerses.filter(v => v.id !== docId && v.reference !== cleanRef);
}

/**
 * Seed or reset all 570+ standard Jubilee Bible verses into Firestore
 */
export async function seedAllDefaultBibleVersesToFirestore(adminEmail: string = 'admin@jesusyouth.sg'): Promise<number> {
  const batchSize = 400; // Firestore batch limit is 500
  let count = 0;

  for (let i = 0; i < INITIAL_400_BIBLE_VERSES.length; i += batchSize) {
    const chunk = INITIAL_400_BIBLE_VERSES.slice(i, i + batchSize);
    const batch = writeBatch(db);

    for (const verse of chunk) {
      const cleanRef = verse.reference.trim().toUpperCase().replace(/\s+/g, '-');
      const docId = cleanRef.replace(/[^A-Z0-9:-]/gi, '_');
      const docRef = doc(db, 'bible_verses', docId);

      batch.set(docRef, {
        reference: cleanRef,
        text: verse.text.trim(),
        category: verse.category || 'Encouragement',
        isActive: true,
        updatedAt: new Date().toISOString(),
        updatedBy: adminEmail
      }, { merge: true });
      count++;
    }

    await batch.commit();
  }

  cachedDynamicVerses = [...INITIAL_400_BIBLE_VERSES];
  return count;
}

/**
 * Helper to extract a standardized 4-character name code (e.g. "Sijumon Abraham" -> "SIJU")
 */
export function getNameCode4(name: string | undefined): string {
  const clean = (name || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  if (clean.length === 0) return 'GUES';
  if (clean.length < 4) return clean.padEnd(4, 'X');
  return clean.slice(0, 4);
}

/**
 * Helper to extract 3-character book code from a Bible book name (e.g. "ROMANS" -> "ROM", "1CORINTHIANS" -> "1CO")
 */
export function getBookCode3(book: string): string {
  const clean = (book || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  if (clean.length === 0) return 'GEN';
  if (clean.length < 3) return clean.padEnd(3, 'X');
  return clean.slice(0, 3);
}

/**
 * Derives a consistent, canonical seed string based on a person's unique email, phone number, or name.
 * When the same person (same email and/or phone) registers again, this produces the identical seed.
 */
export function getPersonDeterministicSeed(email?: string, phone?: string, name?: string): string {
  const normEmail = email ? email.trim().toLowerCase() : '';
  const normPhone = phone ? phone.replace(/\D/g, '') : '';
  const normName = name ? name.trim().toLowerCase() : '';

  if (normEmail && normPhone && normPhone.length >= 8) {
    return `${normEmail}_${normPhone}`;
  }
  if (normEmail) {
    return normEmail;
  }
  if (normPhone && normPhone.length >= 8) {
    return `phone_${normPhone}`;
  }
  if (normName) {
    return `name_${normName}`;
  }
  return 'GRACIA';
}

/**
 * Returns a unique, standardized Bible verse Pass ID in the exact format:
 * GRACIA-[first 4 char of the name]-[first 3 char of the verse]-[verse no]
 * (e.g. for "Sijumon Abraham" and verse "ROMANS-12:2" -> "GRACIA-SIJU-ROM-12:2")
 * deterministically derived from a seed (like person's email + phone or name + index).
 */
export function getBibleVersePassId(
  seed: string | undefined,
  memberIndex: number = 0,
  fallbackName?: string,
  customVersesList?: BibleVerseItem[]
): string {
  const rawSeed = (seed || fallbackName || 'GRACIA').trim().toLowerCase();
  const nameCandidate = (fallbackName || seed || 'GUEST').trim();
  const nameCode = getNameCode4(nameCandidate);

  // If seed is ALREADY in the standard format GRACIA-[NAME4]-[BOOK3]-[CH:VS] (e.g. GRACIA-SIJU-ROM-12:2)
  if (/^GRACIA-[A-Z0-9]{3,4}-[A-Z0-9]{2,3}-\d+:\d+$/i.test(seed?.trim() || '')) {
    return (seed?.trim() || '').toUpperCase();
  }

  // If seed is in previous format GRACIA-[BOOK]-[CH:VS] or [BOOK]-[CH:VS] (e.g. GRACIA-ROMANS-12:2 or ROMANS-12:2)
  const legacyWithoutGracia = (seed?.trim() || '').replace(/^GRACIA-/i, '').trim();
  const legacyMatch = legacyWithoutGracia.match(/^([1-3]?[A-Z]+)-(\d+:\d+)$/i);
  if (legacyMatch) {
    const book3 = getBookCode3(legacyMatch[1]);
    const verseNum = legacyMatch[2];
    return `GRACIA-${nameCode}-${book3}-${verseNum}`;
  }

  // Determine active verse pool
  const pool = (customVersesList && customVersesList.length > 0)
    ? customVersesList.filter(v => v.isActive !== false)
    : getActiveBibleVerses();

  const verseList = pool.length > 0 ? pool : INITIAL_400_BIBLE_VERSES;

  // Calculate string hash deterministically from normalized seed
  const strToHash = `${rawSeed}_PAX_${memberIndex}`;
  let hash = 0;
  for (let i = 0; i < strToHash.length; i++) {
    hash = (hash << 5) - hash + strToHash.charCodeAt(i);
    hash |= 0;
  }
  const posHash = Math.abs(hash);

  // Pick index from array with member offset multiplier for max distribution
  const verseIndex = (posHash + memberIndex * 23) % verseList.length;
  const verseItem = verseList[verseIndex];
  const [book, verseNum] = verseItem.reference.split('-');
  const book3 = getBookCode3(book || 'ROM');

  return `GRACIA-${nameCode}-${book3}-${verseNum || '1:1'}`;
}

const BOOK_NAME_MAP: Record<string, string> = {
  'GEN': 'Genesis', 'EXO': 'Exodus', 'LEV': 'Leviticus', 'NUM': 'Numbers', 'DEU': 'Deuteronomy',
  'JOS': 'Joshua', 'JDG': 'Judges', 'RUT': 'Ruth', '1SA': '1 Samuel', '2SA': '2 Samuel',
  '1KI': '1 Kings', '2KI': '2 Kings', '1CH': '1 Chronicles', '2CH': '2 Chronicles', 'EZR': 'Ezra',
  'NEH': 'Nehemiah', 'EST': 'Esther', 'JOB': 'Job', 'PSA': 'Psalm', 'PSALM': 'Psalm', 'PSALMS': 'Psalms',
  'PRO': 'Proverbs', 'PROV': 'Proverbs', 'ECC': 'Ecclesiastes', 'SNG': 'Song of Songs', 'ISA': 'Isaiah',
  'JER': 'Jeremiah', 'LAM': 'Lamentations', 'EZK': 'Ezekiel', 'EZEK': 'Ezekiel', 'DAN': 'Daniel',
  'HOS': 'Hosea', 'JOL': 'Joel', 'AMO': 'Amos', 'OBA': 'Obadiah', 'JON': 'Jonah', 'MIC': 'Micah',
  'NAH': 'Nahum', 'HAB': 'Habakkuk', 'ZEP': 'Zephaniah', 'HAG': 'Haggai', 'ZEC': 'Zechariah', 'MAL': 'Malachi',
  'MAT': 'Matthew', 'MATT': 'Matthew', 'MRK': 'Mark', 'MARK': 'Mark', 'LUK': 'Luke', 'LUKE': 'Luke',
  'JHN': 'John', 'JOHN': 'John', 'ACT': 'Acts', 'ACTS': 'Acts', 'ROM': 'Romans', 'ROMANS': 'Romans',
  '1CO': '1 Corinthians', '1COR': '1 Corinthians', '2CO': '2 Corinthians', '2COR': '2 Corinthians',
  'GAL': 'Galatians', 'EPH': 'Ephesians', 'PHP': 'Philippians', 'PHIL': 'Philippians', 'COL': 'Colossians',
  '1TH': '1 Thessalonians', '1THESS': '1 Thessalonians', '2TH': '2 Thessalonians', '2THESS': '2 Thessalonians',
  '1TI': '1 Timothy', '1TIM': '1 Timothy', '2TI': '2 Timothy', '2TIM': '2 Timothy',
  'TIT': 'Titus', 'PHM': 'Philemon', 'HEB': 'Hebrews', 'JAS': 'James', '1PE': '1 Peter', '1PET': '1 Peter',
  '2PE': '2 Peter', '2PET': '2 Peter', '1JN': '1 John', '1JOHN': '1 John', '2JN': '2 John', '3JN': '3 John',
  'JUD': 'Jude', 'REV': 'Revelation'
};

/**
 * Formats raw Bible references (e.g. "2TIMOTHY-4:12", "PHILIPPIANS-4:13", "PSALM-23:1") into standard canonical citations like "2 Timothy 4:12"
 */
export function formatBibleReference(rawRef: string): string {
  if (!rawRef) return '';
  const clean = rawRef.trim().replace(/^GRACIA-[A-Z0-9]{3,4}-/i, '');
  const [rawBook, versePart] = clean.split('-');
  if (!versePart) return clean;

  const bookUpper = rawBook.toUpperCase();
  if (BOOK_NAME_MAP[bookUpper]) {
    return `${BOOK_NAME_MAP[bookUpper]} ${versePart}`;
  }

  // Handle numbered books like 1CORINTHIANS, 2TIMOTHY, 1JOHN, 2PETER
  const numMatch = bookUpper.match(/^([1-3])([A-Z]+)$/);
  if (numMatch) {
    const num = numMatch[1];
    const rest = numMatch[2];
    const restFormatted = rest.charAt(0).toUpperCase() + rest.slice(1).toLowerCase();
    return `${num} ${restFormatted} ${versePart}`;
  }

  // Standard books like ROMANS, PHILIPPIANS, PSALM
  const formattedBook = bookUpper.charAt(0).toUpperCase() + bookUpper.slice(1).toLowerCase();
  return `${formattedBook} ${versePart}`;
}

/**
 * Looks up the full Scripture BibleVerseItem for a given pass ID or reference
 */
export function getBibleVerseItem(
  reference: string,
  customVersesList?: BibleVerseItem[]
): BibleVerseItem | null {
  if (!reference) return null;
  const cleanRef = reference.trim().toUpperCase();

  const verses = (customVersesList && customVersesList.length > 0)
    ? customVersesList
    : (cachedDynamicVerses.length > 0 ? cachedDynamicVerses : INITIAL_400_BIBLE_VERSES);

  // 1. Direct match with reference in list (e.g. ROMANS-12:2)
  const directMatch = verses.find(v => v.reference.toUpperCase() === cleanRef);
  if (directMatch) return directMatch;

  // 2. Remove GRACIA- prefix
  const withoutGracia = cleanRef.replace(/^GRACIA-/i, '').trim();
  const matchNoGracia = verses.find(v => v.reference.toUpperCase() === withoutGracia);
  if (matchNoGracia) return matchNoGracia;

  // 3. Parse components: [NAME4]-[BOOK3]-[CH:VS] or [BOOK3]-[CH:VS]
  const parts = withoutGracia.split('-');
  let bookQuery = '';
  let verseNumQuery = '';

  if (parts.length >= 3) {
    bookQuery = parts[parts.length - 2];
    verseNumQuery = parts[parts.length - 1];
  } else if (parts.length === 2) {
    bookQuery = parts[0];
    verseNumQuery = parts[1];
  }

  if (bookQuery && verseNumQuery) {
    const bookQueryClean = bookQuery.replace(/[^A-Za-z0-9]/g, '');
    const match = verses.find(v => {
      const [vBook, vNum] = v.reference.toUpperCase().split('-');
      if (vNum !== verseNumQuery) return false;
      const vBookClean = (vBook || '').replace(/[^A-Za-z0-9]/g, '');
      return vBookClean.startsWith(bookQueryClean) || bookQueryClean.startsWith(vBookClean.slice(0, 3));
    });
    if (match) return match;
  }

  // 4. Fallback search by chapter:verse anywhere in reference
  const chapterVerseMatch = cleanRef.match(/(\d+:\d+)/);
  if (chapterVerseMatch) {
    const cv = chapterVerseMatch[1];
    const match = verses.find(v => v.reference.toUpperCase().endsWith(`-${cv}`));
    if (match) return match;
  }

  // 5. Fallback in INITIAL_400_BIBLE_VERSES if not in custom list
  if (verses !== INITIAL_400_BIBLE_VERSES) {
    return getBibleVerseItem(reference, INITIAL_400_BIBLE_VERSES);
  }

  return null;
}

/**
 * Returns formatted reference like "2 Timothy 4:12" or "Romans 12:2" from pass ID or raw reference
 */
export function getBibleVerseReference(
  passIdOrRef: string,
  customVersesList?: BibleVerseItem[]
): string {
  if (!passIdOrRef) return '';
  const item = getBibleVerseItem(passIdOrRef, customVersesList);
  if (item && item.reference) {
    return formatBibleReference(item.reference);
  }
  return formatBibleReference(passIdOrRef);
}

/**
 * Looks up the full Scripture text for a given Bible verse pass ID reference
 * Supports:
 * - Standard: GRACIA-SIJU-ROM-12:2
 * - Legacy: GRACIA-ROMANS-12:2, ROMANS-12:2, SIJU-ROM-12:2, ROM-12:2
 */
export function getBibleVerseText(
  reference: string,
  customVersesList?: BibleVerseItem[]
): string | null {
  const item = getBibleVerseItem(reference, customVersesList);
  return item ? item.text : null;
}
