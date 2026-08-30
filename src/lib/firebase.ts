import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signInWithRedirect,
  getRedirectResult,
  signOut, 
  onAuthStateChanged,
  User 
} from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  getDoc, 
  setDoc, 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  orderBy, 
  where,
  deleteDoc,
  updateDoc,
  getDocFromServer,
  increment,
  writeBatch,
  onSnapshot,
  setLogLevel
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { ApprovedAdminData, RegistrationData, AdditionalAttendee, RegistrationAuditLog, PortalUserLogItem, TimelineItem, PrayerGroupItem, SiteContentData, ContactMessageItem, ContactMessageReply } from '../types';
import { INITIAL_TIMELINE, INITIAL_SITE_CONTENT } from '../data/initialData';
import { getBibleVersePassId, getPersonDeterministicSeed } from './bibleVerses';

// Super Admin constants
export const SUPER_ADMIN_EMAIL = 'sijumonabraham@gmail.com';
export const ALT_SUPER_ADMIN = 'sijumonabraham@gmail.com';
export const PRIMARY_ADMIN_GMAIL = 'sijumonabraham@gmail.com';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Firebase Project & Console links
export const FIREBASE_PROJECT_ID = firebaseConfig.projectId;
export const FIREBASE_CONSOLE_AUTH_URL = firebaseConfig.projectId 
  ? `https://console.firebase.google.com/project/${firebaseConfig.projectId}/authentication/settings`
  : 'https://console.firebase.google.com/';

// Initialize Firebase
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId || undefined);
try {
  setLogLevel('error');
} catch (e) {
  // Ignore if unsupported
}
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

// Test server connection
async function testFirestoreConnection() {
  try {
    await getDocFromServer(doc(db, 'site_content', 'test_conn'));
  } catch (error) {
    // Silent catch if document doesn't exist, just validates connection
  }
}
testFirestoreConnection();

// Auth Helpers
export const loginWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error: any) {
    if (
      error?.code === 'auth/popup-closed-by-user' ||
      error?.code === 'auth/cancelled-popup-request'
    ) {
      console.warn('Google Sign-In popup closed or cancelled by user.');
      return null;
    }

    console.error('Google Sign-In Popup Error:', error);
    // Fallback to redirect if popup is blocked or fails due to COOP/cross-origin constraints
    if (
      error?.code === 'auth/popup-blocked' ||
      error?.message?.includes('popup')
    ) {
      console.log('Popup blocked, falling back to signInWithRedirect...');
      await signInWithRedirect(auth, googleProvider);
      return null;
    }
    throw error;
  }
};

export const loginWithGoogleRedirect = async () => {
  try {
    await signInWithRedirect(auth, googleProvider);
  } catch (error: any) {
    if (error?.code === 'auth/network-request-failed') {
      console.warn('Network error during Google Sign-In redirect:', error);
    } else {
      console.error('Google Sign-In Redirect Error:', error);
    }
    throw error;
  }
};

export const checkRedirectResult = async () => {
  try {
    const result = await getRedirectResult(auth);
    return result?.user || null;
  } catch (error: any) {
    if (error?.code === 'auth/network-request-failed') {
      console.warn('Check redirect result network request failed (transient network connectivity issue):', error);
      return null;
    }
    console.error('Check Redirect Result Error:', error);
    throw error;
  }
};

export const logoutUser = async () => {
  await signOut(auth);
};

export const checkIsAdminApproved = async (userEmail: string | null, createPendingIfMissing = false): Promise<boolean> => {
  if (!userEmail) return false;
  const normalized = userEmail.toLowerCase().trim();

  const superEmails = [
    SUPER_ADMIN_EMAIL.toLowerCase(), 
    PRIMARY_ADMIN_GMAIL.toLowerCase()
  ];
  const isSuper = superEmails.includes(normalized);

  try {
    const adminDocRef = doc(db, 'approved_admins', normalized);
    let snap = await getDoc(adminDocRef);

    if (isSuper) {
      if (!snap.exists() || snap.data()?.status !== 'approved') {
        await setDoc(adminDocRef, {
          email: normalized,
          status: 'approved',
          approvedBy: 'System',
          dateApproved: 'Permanent'
        }, { merge: true });
      }
      return true;
    }

    if (snap.exists()) {
      const data = snap.data() as ApprovedAdminData;
      return data.status === 'approved';
    }

    if (createPendingIfMissing) {
      // Auto-create pending request doc if explicitly requested
      await setDoc(adminDocRef, {
        email: normalized,
        status: 'pending',
        requestedAt: new Date().toISOString()
      }, { merge: true });
    }

    return false;
  } catch (err) {
    console.error('Error checking admin permission:', err);
    if (isSuper) return true;
    return false;
  }
};

export const requestAdminAccess = async (email: string, displayName?: string, note?: string) => {
  const normalized = email.toLowerCase().trim();
  const ref = doc(db, 'approved_admins', normalized);
  await setDoc(ref, {
    email: normalized,
    displayName: displayName || '',
    requestedNote: note || '',
    status: 'pending',
    requestedAt: new Date().toISOString()
  }, { merge: true });
};

// Helper to recursively strip undefined properties and top-level 'id' field for Firestore
export const cleanFirestoreData = (data: Record<string, any>, isRoot = true): Record<string, any> => {
  if (!data || typeof data !== 'object') return {};
  const cleaned: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) {
      continue;
    }
    if (isRoot && key === 'id') {
      continue;
    }

    if (Array.isArray(value)) {
      cleaned[key] = value
        .filter(item => item !== undefined)
        .map(item => {
          if (typeof item === 'object' && item !== null && !(item instanceof Date)) {
            return cleanFirestoreData(item, false);
          }
          return item;
        });
    } else if (typeof value === 'object' && value !== null && !(value instanceof Date)) {
      cleaned[key] = cleanFirestoreData(value, false);
    } else {
      cleaned[key] = value;
    }
  }
  return cleaned;
};

// Helper to search across Firestore registrations for any existing pass ID for a person (by email or phone)
export const findExistingPassIdForPerson = async (
  email?: string,
  phone?: string,
  name?: string
): Promise<string | null> => {
  const normEmail = email ? email.trim().toLowerCase() : '';
  const normPhone = phone ? phone.replace(/\D/g, '') : '';
  const normName = name ? name.trim().toLowerCase() : '';

  if (!normEmail && !normPhone && !normName) return null;

  try {
    const q = query(collection(db, 'registrations'));
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;

    const deletedSet = await fetchDeletedRegistrationIds();
    const all = snapshot.docs
      .map(d => ({ id: d.id, ...d.data() } as RegistrationData))
      .filter(r => !isRecordDeleted(r, deletedSet));
    all.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

    // 1. Exact email + phone match
    if (normEmail && normPhone && normPhone.length >= 8) {
      const match = all.find(r => {
        const rEmail = r.email ? r.email.trim().toLowerCase() : '';
        const rPhone = r.phone ? r.phone.replace(/\D/g, '') : '';
        return rEmail === normEmail && rPhone === normPhone;
      });
      if (match?.passId) return match.passId;
    }

    // 2. Email match
    if (normEmail) {
      const match = all.find(r => {
        const rEmail = r.email ? r.email.trim().toLowerCase() : '';
        return rEmail === normEmail;
      });
      if (match?.passId) return match.passId;
    }

    // 3. Phone match
    if (normPhone && normPhone.length >= 8) {
      const match = all.find(r => {
        const rPhone = r.phone ? r.phone.replace(/\D/g, '') : '';
        return rPhone === normPhone;
      });
      if (match?.passId) return match.passId;
    }

    // 4. Additional attendees matching
    for (const reg of all) {
      if (Array.isArray(reg.additionalAttendees)) {
        for (const addon of reg.additionalAttendees) {
          const addonEmail = addon.email ? addon.email.trim().toLowerCase() : '';
          const addonPhone = addon.phone ? addon.phone.replace(/\D/g, '') : '';
          if (
            (normEmail && addonEmail === normEmail) ||
            (normPhone && normPhone.length >= 8 && addonPhone === normPhone)
          ) {
            if (addon.passId) return addon.passId;
          }
        }
      }
    }

    return null;
  } catch (err) {
    console.error('Error finding existing pass ID for person:', err);
    return null;
  }
};

// Helper to save/sync additional attendees as individual records linked to primary contact
export const syncAdditionalAttendeesToFirestore = async (
  primaryDocId: string,
  primaryData: Partial<Omit<RegistrationData, 'id'>>,
  additionalAttendees?: AdditionalAttendee[]
) => {
  if (!primaryDocId) return;

  try {
    // Delete existing linked attendee entries for this primaryDocId
    const q = query(collection(db, 'registrations'), where('primaryContactId', '==', primaryDocId));
    const querySnapshot = await getDocs(q);
    const deletePromises = querySnapshot.docs.map(docSnap => deleteDoc(doc(db, 'registrations', docSnap.id)));
    await Promise.all(deletePromises);

    // Save each additional attendee as an individual registration entry linked to primary contact
    if (additionalAttendees && Array.isArray(additionalAttendees) && additionalAttendees.length > 0) {
      const parentSeed = getPersonDeterministicSeed(primaryData.email, primaryData.phone, primaryData.name);

      const createPromises = additionalAttendees.map((addon, index) => {
        const addonDocId = `${primaryDocId}-ADD-${index + 1}`;
        const addonDocRef = doc(db, 'registrations', addonDocId);

        const category = addon.category || 'adult';
        const categoryLabel = addon.categoryLabel || (category === 'adult' ? 'Adults/Youths (20+ yrs)' : category === 'teen' ? 'Teens (13-19 yrs)' : category === 'preteen' ? 'Pre-Teens (9-12 yrs)' : 'Children (6-8 yrs)');
        const attSeed = getPersonDeterministicSeed(addon.email, addon.phone, addon.name) || `${parentSeed}_ADD_${index + 1}_${(addon.name || '').trim().toLowerCase()}`;
        const addonPassId = addon.passId || getBibleVersePassId(attSeed, index + 1, addon.name);

        const attendeeRecord = cleanFirestoreData({
          id: addonDocId,
          passId: addonPassId,
          type: primaryData.type || 'conference',
          name: (addon.name || '').trim(),
          email: (addon.email && addon.email.trim()) ? addon.email.trim() : (primaryData.email || ''),
          phone: (addon.phone && addon.phone.trim()) ? addon.phone.trim() : (primaryData.phone || ''),
          adultsCount: category === 'adult' ? 1 : 0,
          teensCount: category === 'teen' ? 1 : 0,
          preteensCount: category === 'preteen' ? 1 : 0,
          childrenCount: category === 'child' ? 1 : 0,
          kidsCount: 0,
          toddlersCount: 0,
          comments: `Additional attendee (${categoryLabel}) linked to primary contact ${primaryData.name || ''}`,
          createdAt: primaryData.createdAt || new Date().toISOString(),
          status: 'confirmed',
          isAdditionalAttendee: true,
          isLinkedExistingPass: addon.isLinkedExistingPass || false,
          linkedDocId: addon.linkedDocId || undefined,
          primaryContactId: primaryDocId,
          primaryContactName: primaryData.name || '',
          primaryContactEmail: primaryData.email || '',
          primaryContactPhone: primaryData.phone || '',
          category: category,
          categoryLabel: categoryLabel
        }, false);

        // If this attendee is a linked existing pass, also update their primary document in Firestore
        if (addon.isLinkedExistingPass && addon.linkedDocId) {
          updateRegistrationInFirestore(addon.linkedDocId, {
            linkedPrimaryContactId: primaryDocId,
            linkedPrimaryContactName: primaryData.name || '',
            linkedPrimaryContactEmail: primaryData.email || '',
            linkedPrimaryContactPhone: primaryData.phone || ''
          }).catch(err => console.error('Error updating linked primary doc:', err));
        }

        return setDoc(addonDocRef, attendeeRecord, { merge: true });
      });

      await Promise.all(createPromises);
    }
  } catch (err) {
    console.error('Failed to sync additional attendees to Firestore:', err);
  }
};

// Registration Firestore persistence
export const saveRegistrationToFirestore = async (regData: Omit<RegistrationData, 'id'>) => {
  try {
    const rawData = { ...regData };

    // Ensure deterministic and reusable passId when same person registers again
    let finalPassId = rawData.passId;
    if (!finalPassId) {
      finalPassId = await findExistingPassIdForPerson(rawData.email, rawData.phone, rawData.name);
      if (!finalPassId) {
        const seed = getPersonDeterministicSeed(rawData.email, rawData.phone, rawData.name);
        finalPassId = getBibleVersePassId(seed, 0, rawData.name);
      }
    }
    rawData.passId = finalPassId;
    (regData as any).passId = finalPassId;

    // Attach deterministic pass IDs to additional attendees
    if (rawData.additionalAttendees && Array.isArray(rawData.additionalAttendees)) {
      const parentSeed = getPersonDeterministicSeed(rawData.email, rawData.phone, rawData.name);
      rawData.additionalAttendees = rawData.additionalAttendees.map((addon, idx) => {
        const addonObj = { ...addon };
        if (!addonObj.passId) {
          const addonSeed = getPersonDeterministicSeed(addonObj.email, addonObj.phone, addonObj.name) || `${parentSeed}_ADD_${idx + 1}_${(addonObj.name || '').trim().toLowerCase()}`;
          addonObj.passId = getBibleVersePassId(addonSeed, idx + 1, addonObj.name);
        }
        return addonObj;
      });
      (regData as any).additionalAttendees = rawData.additionalAttendees;
    }

    const payloadToSave = cleanFirestoreData({
      ...rawData,
      passId: finalPassId || '',
      createdAt: rawData.createdAt || new Date().toISOString(),
      status: rawData.status || 'confirmed'
    }, true);

    // Look for existing registration by passId, paymentReference, or referenceNumber to prevent duplicate generation
    const searchRef = rawData.paymentReference || rawData.passId || (rawData as any).referenceNumber || (rawData as any).orderId || (rawData as any).reference_number;
    let existingDocId: string | null = (rawData as any).id || (rawData as any).docId || null;

    if (!existingDocId && searchRef) {
      try {
        const qPass = query(collection(db, 'registrations'), where('passId', '==', searchRef));
        const snapPass = await getDocs(qPass);
        if (!snapPass.empty) {
          existingDocId = snapPass.docs[0].id;
        } else {
          const qRef = query(collection(db, 'registrations'), where('paymentReference', '==', searchRef));
          const snapRef = await getDocs(qRef);
          if (!snapRef.empty) {
            existingDocId = snapRef.docs[0].id;
          }
        }
      } catch (searchErr) {
        console.warn('Lookup for existing registration error:', searchErr);
      }
    }

    // Clear any previous tombstones for this email/phone/passId so newly submitted registration is valid
    await clearTombstonesForRegistration(rawData.email, rawData.phone, finalPassId, existingDocId || undefined);

    let docId: string;
    if (existingDocId) {
      const docRef = doc(db, 'registrations', existingDocId);
      await setDoc(docRef, { ...payloadToSave, updatedAt: new Date().toISOString() }, { merge: true });
      docId = existingDocId;
    } else {
      const docRef = await addDoc(collection(db, 'registrations'), payloadToSave);
      docId = docRef.id;
    }

    if (rawData.additionalAttendees && rawData.additionalAttendees.length > 0) {
      await syncAdditionalAttendeesToFirestore(docId, rawData, rawData.additionalAttendees);
    }

    return docId;
  } catch (err) {
    console.error('Failed to save registration to Firestore:', err);
    return null;
  }
};

export const updateRegistrationInFirestore = async (
  docId: string, 
  regData: Partial<Omit<RegistrationData, 'id'>>
): Promise<boolean> => {
  if (!docId) return false;
  try {
    let targetDocId = docId;
    try {
      const directRef = doc(db, 'registrations', docId);
      const directSnap = await getDoc(directRef);
      if (!directSnap.exists()) {
        const qPass = query(collection(db, 'registrations'), where('passId', '==', docId));
        const snapPass = await getDocs(qPass);
        if (!snapPass.empty) {
          targetDocId = snapPass.docs[0].id;
        } else {
          const qRef = query(collection(db, 'registrations'), where('paymentReference', '==', docId));
          const snapRef = await getDocs(qRef);
          if (!snapRef.empty) {
            targetDocId = snapRef.docs[0].id;
          }
        }
      }
    } catch (lookupErr) {
      console.warn('Doc resolution fallback warning:', lookupErr);
    }

    const docRef = doc(db, 'registrations', targetDocId);
    const rawData = { ...regData };

    if (!rawData.passId && (rawData.email || rawData.phone || rawData.name)) {
      const existingPass = await findExistingPassIdForPerson(rawData.email, rawData.phone, rawData.name);
      if (existingPass) {
        rawData.passId = existingPass;
        (regData as any).passId = existingPass;
      } else {
        const seed = getPersonDeterministicSeed(rawData.email, rawData.phone, rawData.name);
        const computedPass = getBibleVersePassId(seed, 0, rawData.name);
        rawData.passId = computedPass;
        (regData as any).passId = computedPass;
      }
    }

    const cleaned = cleanFirestoreData({
      ...rawData,
      updatedAt: new Date().toISOString()
    }, true);

    await setDoc(docRef, cleaned, { merge: true });

    if (regData.additionalAttendees !== undefined) {
      await syncAdditionalAttendeesToFirestore(docId, regData, regData.additionalAttendees);
    }

    return true;
  } catch (err) {
    console.error('Failed to update registration in Firestore:', err);
    return false;
  }
};

import { releaseInvitationCodeForRegistration, deleteAllInvitationCodesFromFirestore } from './invitationCodes';

export interface SystemSettings {
  isGoLive: boolean;
  goLiveTimestamp?: string;
  updatedBy?: string;
}

export const getSystemSettingsFromFirestore = async (): Promise<SystemSettings> => {
  try {
    const docRef = doc(db, 'settings', 'systemSettings');
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data() as SystemSettings;
    }
  } catch (err) {
    console.warn('Failed to read system settings:', err);
  }
  return { isGoLive: false };
};

export const saveSystemSettingsToFirestore = async (settings: Partial<SystemSettings>): Promise<void> => {
  try {
    const docRef = doc(db, 'settings', 'systemSettings');
    await setDoc(docRef, {
      ...settings,
      updatedAt: new Date().toISOString()
    }, { merge: true });

    if (typeof settings.isGoLive === 'boolean') {
      try {
        localStorage.setItem('isGoLiveMode', String(settings.isGoLive));
      } catch (e) {
        // ignore
      }
    }
  } catch (err) {
    console.error('Failed to save system settings:', err);
    throw err;
  }
};

// Helper to fetch set of explicitly deleted registration IDs / pass IDs / payment references
export const fetchDeletedRegistrationIds = async (): Promise<Set<string>> => {
  try {
    const snap = await getDocs(collection(db, 'deleted_registrations'));
    const set = new Set<string>();
    snap.docs.forEach(d => {
      set.add(d.id);
      const data = d.data();
      if (data.id) set.add(data.id);
      if (data.passId) set.add(data.passId);
      if (data.paymentReference) set.add(data.paymentReference);
      if (data.primaryContactId) set.add(data.primaryContactId);
      if (data.email) set.add(`EMAIL:${data.email.toLowerCase().trim()}`);
      if (data.phone) set.add(`PHONE:${data.phone.replace(/\D/g, '')}`);
    });
    return set;
  } catch (err) {
    console.warn('Failed to fetch deleted registration IDs:', err);
    return new Set<string>();
  }
};

export const isRecordDeleted = (r: Partial<RegistrationData>, deletedSet: Set<string>): boolean => {
  if (!r) return true;
  if ((r.status as string) === 'deleted' || (r as any).isDeleted || (r as any).deleted) return true;
  if (r.id && deletedSet.has(r.id)) return true;
  if (r.passId && deletedSet.has(r.passId)) return true;
  if (r.paymentReference && deletedSet.has(r.paymentReference)) return true;
  if (r.primaryContactId && deletedSet.has(r.primaryContactId)) return true;
  if (r.email && deletedSet.has(`EMAIL:${r.email.toLowerCase().trim()}`)) return true;
  if (r.phone && deletedSet.has(`PHONE:${r.phone.replace(/\D/g, '')}`)) return true;
  return false;
};

export const clearTombstonesForRegistration = async (email?: string, phone?: string, passId?: string, docId?: string) => {
  try {
    const cleanEmail = email ? email.toLowerCase().trim() : '';
    const cleanPhone = phone ? phone.replace(/\D/g, '') : '';
    const snap = await getDocs(collection(db, 'deleted_registrations'));
    const deletePromises: Promise<void>[] = [];
    snap.docs.forEach(d => {
      const data = d.data();
      const matchDoc = docId && (d.id === docId || data.id === docId);
      const matchPass = passId && (data.passId === passId || d.id === passId);
      const matchEmail = cleanEmail && data.email && data.email.toLowerCase().trim() === cleanEmail;
      const matchPhone = cleanPhone && data.phone && data.phone.replace(/\D/g, '') === cleanPhone;
      if (matchDoc || matchPass || matchEmail || matchPhone) {
        deletePromises.push(deleteDoc(doc(db, 'deleted_registrations', d.id)));
      }
    });
    await Promise.all(deletePromises);
  } catch (err) {
    console.warn('Error clearing tombstones:', err);
  }
};

export const deleteRegistrationFromFirestore = async (docId: string): Promise<boolean> => {
  if (!docId) return false;
  try {
    const docRef = doc(db, 'registrations', docId);
    let regData: any = null;

    try {
      const regSnap = await getDoc(docRef);
      if (regSnap.exists()) {
        regData = regSnap.data();
      }
    } catch (e) {
      console.warn('Error fetching registration before delete:', e);
    }

    // Auto-release linked invitation code if present
    if (regData) {
      try {
        if (regData.invitationCode) {
          await releaseInvitationCodeForRegistration(docId, regData.invitationCode);
        } else {
          await releaseInvitationCodeForRegistration(docId);
        }
      } catch (e) {
        console.warn('Auto-release invitation code warning:', e);
      }
    }

    // Record tombstone in deleted_registrations collection
    const passId = regData?.passId || '';
    const paymentReference = regData?.paymentReference || '';
    const email = regData?.email ? regData.email.toLowerCase().trim() : '';
    const phone = regData?.phone ? regData.phone.replace(/\D/g, '') : '';
    const primaryContactId = regData?.primaryContactId || '';

    try {
      await setDoc(doc(db, 'deleted_registrations', docId), {
        id: docId,
        passId,
        paymentReference,
        email,
        phone,
        primaryContactId,
        deletedAt: new Date().toISOString()
      });
      if (passId) {
        await setDoc(doc(db, 'deleted_registrations', passId), {
          id: passId,
          passId,
          paymentReference,
          email,
          phone,
          primaryContactId,
          deletedAt: new Date().toISOString()
        });
      }
    } catch (tombstoneErr) {
      console.warn('Failed to write deleted registration tombstone:', tombstoneErr);
    }

    // If this record is an additional attendee, update the parent document to remove it from additionalAttendees array
    if (regData?.isAdditionalAttendee || primaryContactId || docId.includes('-ADD-')) {
      const parentId = primaryContactId || docId.split('-ADD-')[0];
      if (parentId && parentId !== docId) {
        try {
          const parentRef = doc(db, 'registrations', parentId);
          const parentSnap = await getDoc(parentRef);
          if (parentSnap.exists()) {
            const parentData = parentSnap.data();
            const currentAddons = Array.isArray(parentData.additionalAttendees) ? parentData.additionalAttendees : [];
            const updatedAddons = currentAddons.filter((addon: any, idx: number) => {
              const addonDocId = `${parentId}-ADD-${idx + 1}`;
              if (addonDocId === docId) return false;
              if (addon.passId && addon.passId === passId) return false;
              if (regData?.name && addon.name?.trim().toLowerCase() === regData.name.trim().toLowerCase()) return false;
              return true;
            });
            await updateDoc(parentRef, {
              additionalAttendees: updatedAddons,
              updatedAt: new Date().toISOString()
            });
          }
        } catch (parentErr) {
          console.warn('Failed to update parent additionalAttendees on delete:', parentErr);
        }
      }
    }

    // Delete the target registration document
    await deleteDoc(docRef);

    // Also delete any linked additional attendee records and record tombstones for them
    try {
      const q = query(collection(db, 'registrations'), where('primaryContactId', '==', docId));
      const querySnapshot = await getDocs(q);
      const deletePromises = querySnapshot.docs.map(async (docSnap) => {
        const childData = docSnap.data();
        const childId = docSnap.id;
        const childPassId = childData.passId || '';
        try {
          await setDoc(doc(db, 'deleted_registrations', childId), {
            id: childId,
            passId: childPassId,
            email: childData.email ? childData.email.toLowerCase().trim() : email,
            phone: childData.phone ? childData.phone.replace(/\D/g, '') : phone,
            primaryContactId: docId,
            deletedAt: new Date().toISOString()
          });
          if (childPassId) {
            await setDoc(doc(db, 'deleted_registrations', childPassId), {
              id: childPassId,
              passId: childPassId,
              email: childData.email ? childData.email.toLowerCase().trim() : email,
              phone: childData.phone ? childData.phone.replace(/\D/g, '') : phone,
              primaryContactId: docId,
              deletedAt: new Date().toISOString()
            });
          }
        } catch {}
        return deleteDoc(doc(db, 'registrations', childId));
      });
      await Promise.all(deletePromises);
    } catch {
      // ignore
    }

    // Clean up local storage caches
    try {
      const keysToRemove = [
        `draft_registration_${docId}`,
        `draft_registration_${passId}`,
        `draft_registration_${paymentReference}`,
        'draft_registration_latest',
        `gracia_paid_${docId}`,
        `gracia_paid_${passId}`,
        `gracia_paid_${paymentReference}`,
        `payment_status_${docId}`,
        `payment_status_${passId}`,
        `payment_status_${paymentReference}`,
        `step_${docId}`,
        `step_${passId}`,
        `step_${paymentReference}`,
        `gracia_step_${docId}`,
        `gracia_step_${passId}`,
        `gracia_step_${paymentReference}`
      ];
      keysToRemove.forEach(k => {
        if (k) localStorage.removeItem(k);
      });
    } catch {}

    return true;
  } catch (err) {
    console.error('Failed to delete registration from Firestore:', err);
    return false;
  }
};

// Audit Log Persistence
export const logRegistrationAction = async (logData: Omit<RegistrationAuditLog, 'id' | 'timestamp'>): Promise<boolean> => {
  try {
    const cleaned = cleanFirestoreData({
      ...logData,
      timestamp: new Date().toISOString()
    }, true);
    await addDoc(collection(db, 'registration_audit_logs'), cleaned);
    return true;
  } catch (err) {
    console.error('Failed to record registration audit log:', err);
    return false;
  }
};

export const fetchRegistrationAuditLogs = async (): Promise<RegistrationAuditLog[]> => {
  try {
    const q = query(collection(db, 'registration_audit_logs'), orderBy('timestamp', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as RegistrationAuditLog));
  } catch (err) {
    console.error('Failed to fetch audit logs:', err);
    return [];
  }
};

export const deleteAuditLogFromFirestore = async (docId: string, logData?: any): Promise<boolean> => {
  try {
    const docRef = doc(db, 'registration_audit_logs', docId);
    await deleteDoc(docRef);

    // Also clean up tombstones in deleted_registrations collection if present
    try {
      const delDocRef = doc(db, 'deleted_registrations', docId);
      const delSnap = await getDoc(delDocRef);
      if (delSnap.exists()) {
        await deleteDoc(delDocRef);
      }
      if (logData?.snapshot) {
        const snap = logData.snapshot;
        await clearTombstonesForRegistration(snap.email, snap.phone, snap.passId, snap.id);
      }
    } catch (e) {
      console.warn('Tombstone cleanup error:', e);
    }
    return true;
  } catch (err) {
    console.error('Failed to delete audit log:', err);
    return false;
  }
};

export const fetchRegistrationByPassIdOrDocId = async (ref: string): Promise<RegistrationData | null> => {
  if (!ref) return null;
  const cleanRef = ref.trim();
  try {
    const deletedSet = await fetchDeletedRegistrationIds();
    if (deletedSet.has(cleanRef) || deletedSet.has(`EMAIL:${cleanRef.toLowerCase()}`) || deletedSet.has(`PHONE:${cleanRef.replace(/\D/g, '')}`)) {
      return null;
    }

    const docRef = doc(db, 'registrations', cleanRef);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = { id: docSnap.id, ...docSnap.data() } as RegistrationData;
      if (isRecordDeleted(data, deletedSet)) return null;
      return data;
    }

    const allRegs = await fetchAllRegistrations();
    const found = allRegs.find(r => 
      r.id === cleanRef || 
      r.paymentReference === cleanRef || 
      r.passId === cleanRef ||
      r.additionalAttendees?.some(a => a.passId === cleanRef)
    );
    return found || null;
  } catch (err) {
    console.error('Error fetching registration by ref:', err);
    return null;
  }
};

export const findRegistrationByDetails = async (
  type: 'conference' | 'musical',
  email?: string,
  name?: string,
  phone?: string
): Promise<RegistrationData | null> => {
  const normEmail = email ? email.trim().toLowerCase() : '';
  const normName = name ? name.trim().toLowerCase() : '';
  const normPhone = phone ? phone.replace(/\D/g, '') : '';

  if (!normEmail && !normPhone && !normName) return null;

  try {
    const q = query(
      collection(db, 'registrations'),
      where('type', '==', type)
    );
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;

    const deletedSet = await fetchDeletedRegistrationIds();
    const all = snapshot.docs
      .map(d => ({ id: d.id, ...d.data() } as RegistrationData))
      .filter(r => !isRecordDeleted(r, deletedSet));

    // Sort descending by createdAt
    all.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

    // Separate primary records vs sub-records (additional attendees)
    const primaryRecords = all.filter(r => !r.isAdditionalAttendee && !r.primaryContactId);

    const resolvePrimary = (doc: RegistrationData): RegistrationData => {
      if (!doc.isAdditionalAttendee && !doc.primaryContactId) return doc;
      if (doc.primaryContactId) {
        const parent = primaryRecords.find(p => p.id === doc.primaryContactId);
        if (parent) return parent;
      }
      if (doc.primaryContactEmail || doc.email) {
        const parentEmail = (doc.primaryContactEmail || doc.email)?.trim().toLowerCase();
        const parent = primaryRecords.find(p => p.email?.trim().toLowerCase() === parentEmail);
        if (parent) return parent;
      }
      return doc;
    };

    let matchedDoc: RegistrationData | null = null;

    // Priority 1: Email + Name match (prefer primary record first)
    if (normEmail && normName) {
      const exactPrimary = primaryRecords.find(r => 
        r.email?.trim().toLowerCase() === normEmail && 
        r.name?.trim().toLowerCase() === normName
      );
      if (exactPrimary) {
        matchedDoc = exactPrimary;
      } else {
        const exactSub = all.find(r =>
          r.email?.trim().toLowerCase() === normEmail &&
          r.name?.trim().toLowerCase() === normName
        );
        if (exactSub) matchedDoc = resolvePrimary(exactSub);
      }
    }

    // Priority 2: Email match (prefer primary record first)
    if (!matchedDoc && normEmail) {
      const emailPrimary = primaryRecords.find(r => r.email?.trim().toLowerCase() === normEmail);
      if (emailPrimary) {
        matchedDoc = emailPrimary;
      } else {
        const emailSub = all.find(r => r.email?.trim().toLowerCase() === normEmail);
        if (emailSub) matchedDoc = resolvePrimary(emailSub);
      }
    }

    // Priority 3: Phone match (prefer primary record first)
    if (!matchedDoc && normPhone && normPhone.length >= 8) {
      const phonePrimary = primaryRecords.find(r => r.phone?.replace(/\D/g, '') === normPhone);
      if (phonePrimary) {
        matchedDoc = phonePrimary;
      } else {
        const phoneSub = all.find(r => r.phone?.replace(/\D/g, '') === normPhone);
        if (phoneSub) matchedDoc = resolvePrimary(phoneSub);
      }
    }

    if (!matchedDoc) return null;

    // Ensure matchedDoc is canonical primary doc
    matchedDoc = resolvePrimary(matchedDoc);

    // Check if matchedDoc or any of its sub-documents has confirmed status or paid status
    const subDocs = all.filter(s => s.isAdditionalAttendee && (s.primaryContactId === matchedDoc!.id || s.primaryContactEmail === matchedDoc!.email));
    const hasConfirmedSubDoc = subDocs.some(s => s.status === 'confirmed');

    if (hasConfirmedSubDoc || matchedDoc.status === 'confirmed') {
      matchedDoc.status = 'confirmed';
      if (!matchedDoc.paymentStatus || matchedDoc.paymentStatus === 'pending') {
        matchedDoc.paymentStatus = 'paid';
      }
    }

    if (!matchedDoc.passId) {
      matchedDoc.passId = getBibleVersePassId(getPersonDeterministicSeed(matchedDoc.email, matchedDoc.phone, matchedDoc.name), 0, matchedDoc.name);
    }

    // Ensure numeric paymentAmount is set if confirmed/paid but missing on record
    const isPaidConfirmed = Boolean(
      (matchedDoc.paymentStatus && ['succeeded', 'verified', 'completed', 'paid'].includes(matchedDoc.paymentStatus)) ||
      matchedDoc.status === 'confirmed' ||
      (matchedDoc as any).paymentVerified === true ||
      (matchedDoc as any).isPaid === true
    );

    if (isPaidConfirmed && (!matchedDoc.paymentAmount || matchedDoc.paymentAmount <= 0)) {
      const payingPax = (matchedDoc.adultsCount || 0) + (matchedDoc.teensCount || 0);
      if (payingPax >= 4) {
        matchedDoc.paymentAmount = 100;
      } else if (payingPax > 0) {
        matchedDoc.paymentAmount = payingPax * 25;
      }
    }

    return matchedDoc;
  } catch (err) {
    console.error('Error searching registration:', err);
    return null;
  }
};

export interface ExistingParticipantMatch {
  isFound: boolean;
  docId: string;
  name: string;
  email: string;
  phone: string;
  passId: string;
  isAdditionalAttendee?: boolean;
  primaryContactName?: string;
  registrationType?: 'conference' | 'musical';
  category?: string;
}

export const checkExistingParticipantByContact = async (
  email?: string,
  phone?: string,
  excludeDocId?: string
): Promise<ExistingParticipantMatch | null> => {
  const normEmail = email ? email.trim().toLowerCase() : '';
  const normPhone = phone ? phone.replace(/\D/g, '') : '';

  if (!normEmail && (!normPhone || normPhone.length < 8)) return null;

  try {
    const q = query(collection(db, 'registrations'));
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;

    const deletedSet = await fetchDeletedRegistrationIds();
    const docs = snapshot.docs
      .map(d => ({ id: d.id, ...d.data() } as RegistrationData))
      .filter(r => !isRecordDeleted(r, deletedSet));

    for (const reg of docs) {
      if (excludeDocId && reg.id === excludeDocId) continue;

      // 1. Check primary registrant
      const regEmail = reg.email ? reg.email.trim().toLowerCase() : '';
      const regPhone = reg.phone ? reg.phone.replace(/\D/g, '') : '';

      const matchEmail = Boolean(normEmail && regEmail && regEmail === normEmail);
      const matchPhone = Boolean(normPhone && normPhone.length >= 8 && regPhone && regPhone === normPhone);

      if (matchEmail || matchPhone) {
        const seed = getPersonDeterministicSeed(reg.email, reg.phone, reg.name);
        const passId = reg.passId || getBibleVersePassId(seed, 0, reg.name);
        return {
          isFound: true,
          docId: reg.id || '',
          name: reg.name,
          email: reg.email,
          phone: reg.phone,
          passId: passId,
          isAdditionalAttendee: reg.isAdditionalAttendee || false,
          primaryContactName: reg.primaryContactName || reg.name,
          registrationType: reg.type
        };
      }

      // 2. Check additionalAttendees array in primary record
      if (reg.additionalAttendees && Array.isArray(reg.additionalAttendees)) {
        for (let idx = 0; idx < reg.additionalAttendees.length; idx++) {
          const addon = reg.additionalAttendees[idx];
          const addonEmail = addon.email ? addon.email.trim().toLowerCase() : '';
          const addonPhone = addon.phone ? addon.phone.replace(/\D/g, '') : '';

          const matchAddonEmail = Boolean(normEmail && addonEmail && addonEmail === normEmail);
          const matchAddonPhone = Boolean(normPhone && normPhone.length >= 8 && addonPhone && addonPhone === normPhone);

          if (matchAddonEmail || matchAddonPhone) {
            const parentSeed = getPersonDeterministicSeed(reg.email, reg.phone, reg.name);
            const attSeed = getPersonDeterministicSeed(addon.email, addon.phone, addon.name) || `${parentSeed}_ADD_${idx + 1}_${(addon.name || '').trim().toLowerCase()}`;
            const passId = addon.passId || getBibleVersePassId(attSeed, idx + 1, addon.name);

            return {
              isFound: true,
              docId: reg.id || '',
              name: addon.name,
              email: addon.email || reg.email,
              phone: addon.phone || reg.phone,
              passId: passId,
              isAdditionalAttendee: true,
              primaryContactName: reg.name,
              registrationType: reg.type,
              category: addon.category
            };
          }
        }
      }
    }

    return null;
  } catch (err) {
    console.error('Error checking existing participant by contact:', err);
    return null;
  }
};

export const findAllRegistrationsByDetails = async (
  email?: string,
  name?: string,
  phone?: string
): Promise<{ musical: RegistrationData | null; conference: RegistrationData | null }> => {
  const [musical, conference] = await Promise.all([
    findRegistrationByDetails('musical', email, name, phone),
    findRegistrationByDetails('conference', email, name, phone)
  ]);
  return { musical, conference };
};

export const fetchAllRegistrations = async (): Promise<RegistrationData[]> => {
  try {
    const deletedSet = await fetchDeletedRegistrationIds();
    const q = query(collection(db, 'registrations'), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    const allFetched = snapshot.docs
      .map(d => ({ id: d.id, ...d.data() } as RegistrationData))
      .filter(r => !isRecordDeleted(r, deletedSet));

    // Track set of primary doc IDs
    const primaryDocIds = new Set(
      allFetched.filter(r => !r.isAdditionalAttendee).map(r => r.id)
    );

    // Filter out orphaned additional attendee records whose primary parent document was deleted
    const validFetched = allFetched.filter(r => {
      if (r.isAdditionalAttendee && r.primaryContactId) {
        return primaryDocIds.has(r.primaryContactId);
      }
      return true;
    });

    // Deduplicate primary registrations by unique identifier
    const seenPrimaryKeys = new Set<string>();
    const deduplicatedPrimary: RegistrationData[] = [];

    for (const reg of validFetched) {
      if (!reg.isAdditionalAttendee) {
        const key = reg.paymentReference || reg.passId || reg.id;
        if (key) {
          if (seenPrimaryKeys.has(key)) {
            continue;
          }
          seenPrimaryKeys.add(key);
        }
      }
      deduplicatedPrimary.push(reg);
    }

    // Track primary contact IDs that already have linked attendee documents in Firestore
    const existingLinkedPrimaryIds = new Set(
      deduplicatedPrimary.filter(r => r.isAdditionalAttendee && r.primaryContactId).map(r => r.primaryContactId)
    );

    const resultList: RegistrationData[] = [];

    for (const reg of deduplicatedPrimary) {
      if (!reg.passId) {
        const seed = getPersonDeterministicSeed(reg.email, reg.phone, reg.name);
        reg.passId = getBibleVersePassId(seed, 0, reg.name);
      }

      resultList.push(reg);

      // If primary registration has additional attendees but no standalone docs exist yet
      if (!reg.isAdditionalAttendee && reg.id && reg.additionalAttendees && Array.isArray(reg.additionalAttendees) && reg.additionalAttendees.length > 0) {
        // Filter out deleted additional attendees
        const validAddons = reg.additionalAttendees.filter((addon, idx) => {
          const addonDocId = `${reg.id}-ADD-${idx + 1}`;
          if (deletedSet.has(addonDocId)) return false;
          if (addon.passId && deletedSet.has(addon.passId)) return false;
          return true;
        });

        if (!existingLinkedPrimaryIds.has(reg.id) && validAddons.length > 0) {
          // Trigger background sync to create them permanently in Firestore
          syncAdditionalAttendeesToFirestore(reg.id, reg, validAddons).catch(err => {
            console.error('Background sync of additional attendees failed:', err);
          });

          // Synthesize standalone linked objects for current view
          const parentSeed = getPersonDeterministicSeed(reg.email, reg.phone, reg.name);
          validAddons.forEach((addon, idx) => {
            const category = addon.category || 'adult';
            const categoryLabel = addon.categoryLabel || (category === 'adult' ? 'Adults/Youths (20+ yrs)' : category === 'teen' ? 'Teens (13-19 yrs)' : category === 'preteen' ? 'Pre-Teens (9-12 yrs)' : 'Children (6-8 yrs)');
            const addonDocId = `${reg.id}-ADD-${idx + 1}`;
            const attSeed = getPersonDeterministicSeed(addon.email, addon.phone, addon.name) || `${parentSeed}_ADD_${idx + 1}_${addon.name.trim().toLowerCase()}`;
            const addonPassId = addon.passId || getBibleVersePassId(attSeed, idx + 1, addon.name);

            if (!deletedSet.has(addonDocId) && !deletedSet.has(addonPassId)) {
              resultList.push({
                id: addonDocId,
                passId: addonPassId,
                type: reg.type,
                name: addon.name.trim(),
                email: (addon.email && addon.email.trim()) ? addon.email.trim() : reg.email,
                phone: (addon.phone && addon.phone.trim()) ? addon.phone.trim() : reg.phone,
                adultsCount: category === 'adult' ? 1 : 0,
                teensCount: category === 'teen' ? 1 : 0,
                preteensCount: category === 'preteen' ? 1 : 0,
                childrenCount: category === 'child' ? 1 : 0,
                kidsCount: category === 'kid' ? 1 : 0,
                toddlersCount: category === 'toddler' ? 1 : 0,
                comments: `Additional attendee (${categoryLabel}) linked to primary contact ${reg.name}`,
                createdAt: reg.createdAt,
                status: 'confirmed',
                isAdditionalAttendee: true,
                primaryContactId: reg.id,
                primaryContactName: reg.name,
                primaryContactEmail: reg.email,
                primaryContactPhone: reg.phone,
                category: category,
                categoryLabel: categoryLabel
              });
            }
          });
        }
      }
    }

    return resultList;
  } catch (err) {
    console.error('Error fetching registrations:', err);
    return [];
  }
};

export const subscribeToRegistrations = (callback: (registrations: RegistrationData[]) => void) => {
  try {
    const q = query(collection(db, 'registrations'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, async (snapshot) => {
      const deletedSet = await fetchDeletedRegistrationIds();
      const allFetched = snapshot.docs
        .map(d => ({ id: d.id, ...d.data() } as RegistrationData))
        .filter(r => !isRecordDeleted(r, deletedSet));

      // Track set of primary doc IDs
      const primaryDocIds = new Set(
        allFetched.filter(r => !r.isAdditionalAttendee).map(r => r.id)
      );

      // Filter out orphaned additional attendee records whose primary parent document was deleted
      const validFetched = allFetched.filter(r => {
        if (r.isAdditionalAttendee && r.primaryContactId) {
          return primaryDocIds.has(r.primaryContactId);
        }
        return true;
      });

      // Deduplicate primary registrations by unique identifier
      const seenPrimaryKeys = new Set<string>();
      const resultList: RegistrationData[] = [];

      for (const reg of validFetched) {
        if (!reg.isAdditionalAttendee) {
          const key = reg.paymentReference || reg.passId || reg.id;
          if (key) {
            if (seenPrimaryKeys.has(key)) {
              continue;
            }
            seenPrimaryKeys.add(key);
          }
        }

        if (!reg.passId) {
          const seed = getPersonDeterministicSeed(reg.email, reg.phone, reg.name);
          reg.passId = getBibleVersePassId(seed, 0, reg.name);
        }
        resultList.push(reg);
      }
      callback(resultList);
    }, (err) => {
      console.warn('Realtime registrations subscription warning:', err);
    });
  } catch (err) {
    console.warn('Failed to initialize registrations subscription:', err);
    return () => {};
  }
};

// Approved Admins Management
export const fetchApprovedAdmins = async (): Promise<ApprovedAdminData[]> => {
  try {
    // Delete old jy25sg@jesusyouth.org doc from Firestore if it exists
    try {
      const oldDocRef = doc(db, 'approved_admins', 'jy25sg@jesusyouth.org');
      const oldSnap = await getDoc(oldDocRef);
      if (oldSnap.exists()) {
        await deleteDoc(oldDocRef);
      }
    } catch (e) {
      // ignore
    }

    const snapshot = await getDocs(collection(db, 'approved_admins'));
    const admins = snapshot.docs
      .map(d => ({ email: d.id, ...d.data() } as ApprovedAdminData))
      .filter(a => a.email.toLowerCase() !== 'jy25sg@jesusyouth.org');
    
    // Ensure Super Admin is always present in the list
    const superEmails = [SUPER_ADMIN_EMAIL.toLowerCase(), PRIMARY_ADMIN_GMAIL.toLowerCase()];
    for (const superEmail of superEmails) {
      const existing = admins.find(a => a.email.toLowerCase() === superEmail);
      if (!existing) {
        admins.unshift({
          email: superEmail,
          status: 'approved',
          approvedBy: 'System',
          dateApproved: 'Permanent',
          role: 'super_admin'
        });
      } else {
        existing.role = 'super_admin';
      }
    }
    return admins;
  } catch (err) {
    console.error('Error fetching approved admins:', err);
    return [
      { email: SUPER_ADMIN_EMAIL, status: 'approved', approvedBy: 'System', role: 'super_admin' },
      { email: PRIMARY_ADMIN_GMAIL, status: 'approved', approvedBy: 'System', role: 'super_admin' }
    ];
  }
};

export const updateAdminStatus = async (
  email: string, 
  status: 'approved' | 'pending' | 'revoked', 
  approvedBy: string,
  role?: ApprovedAdminData['role'],
  invitationRoles?: ApprovedAdminData['invitationRoles']
) => {
  const normalized = email.toLowerCase().trim();
  const superEmails = [SUPER_ADMIN_EMAIL.toLowerCase(), PRIMARY_ADMIN_GMAIL.toLowerCase()];
  if (superEmails.includes(normalized)) return;
  const ref = doc(db, 'approved_admins', normalized);
  await setDoc(ref, {
    email: normalized,
    status,
    approvedBy,
    role: role || 'admin',
    invitationRoles: invitationRoles || [],
    dateApproved: new Date().toISOString()
  }, { merge: true });
};

export const deleteAdminRecordPermanently = async (email: string) => {
  const normalized = email.toLowerCase().trim();
  const superEmails = [SUPER_ADMIN_EMAIL.toLowerCase(), PRIMARY_ADMIN_GMAIL.toLowerCase()];
  if (superEmails.includes(normalized)) {
    throw new Error('Super Admin accounts cannot be deleted.');
  }
  const ref = doc(db, 'approved_admins', normalized);
  await deleteDoc(ref);
};

export const editAdminEmail = async (oldEmail: string, newEmail: string) => {
  const oldNorm = oldEmail.toLowerCase().trim();
  const newNorm = newEmail.toLowerCase().trim();
  if (!newNorm) throw new Error('New email address cannot be empty.');
  if (oldNorm === newNorm) return;

  const superEmails = [SUPER_ADMIN_EMAIL.toLowerCase(), PRIMARY_ADMIN_GMAIL.toLowerCase()];
  if (superEmails.includes(oldNorm)) {
    throw new Error('Super Admin email cannot be modified.');
  }

  const oldRef = doc(db, 'approved_admins', oldNorm);
  const oldSnap = await getDoc(oldRef);

  const newRef = doc(db, 'approved_admins', newNorm);
  if (oldSnap.exists()) {
    const data = oldSnap.data();
    await setDoc(newRef, {
      ...data,
      email: newNorm,
      updatedAt: new Date().toISOString()
    }, { merge: true });
    await deleteDoc(oldRef);
  } else {
    await setDoc(newRef, {
      email: newNorm,
      status: 'approved',
      dateApproved: new Date().toISOString()
    }, { merge: true });
  }
};

// Timeline Events Management
export const fetchTimelineEvents = async (): Promise<TimelineItem[]> => {
  try {
    const q = query(collection(db, 'timeline_events'), orderBy('order', 'asc'));
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      return INITIAL_TIMELINE;
    }

    const fetched = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as TimelineItem));

    // Combine fetched records with INITIAL_TIMELINE so no default event is lost
    const map = new Map<string, TimelineItem>();
    INITIAL_TIMELINE.forEach(i => map.set(i.id, i));
    fetched.forEach(f => map.set(f.id, f));

    return Array.from(map.values()).sort((a, b) => (a.order || 0) - (b.order || 0));
  } catch (err) {
    console.error('Error fetching timeline events:', err);
    try {
      handleFirestoreError(err, OperationType.LIST, 'timeline_events');
    } catch {
      // return defaults on permission failure
    }
    return INITIAL_TIMELINE;
  }
};

export const saveTimelineEvent = async (event: Omit<TimelineItem, 'id'> & { id?: string }) => {
  const { id, ...data } = event;
  const cleanData = Object.fromEntries(
    Object.entries(data).filter(([_, v]) => v !== undefined)
  );

  if (id) {
    const ref = doc(db, 'timeline_events', id);
    await setDoc(ref, cleanData, { merge: true });
    return id;
  } else {
    const ref = await addDoc(collection(db, 'timeline_events'), cleanData);
    return ref.id;
  }
};

export const deleteTimelineEvent = async (id: string) => {
  await deleteDoc(doc(db, 'timeline_events', id));
};

export const toggleTimelineLike = async (itemId: string, incrementVal: number) => {
  try {
    const ref = doc(db, 'timeline_events', itemId);
    await setDoc(ref, { likesCount: increment(incrementVal) }, { merge: true });
  } catch (err) {
    console.error('Error toggling timeline like in Firestore:', err);
  }
};

// Prayer Groups Management
export const fetchPrayerGroups = async (): Promise<PrayerGroupItem[]> => {
  try {
    const q = query(collection(db, 'prayer_groups'), orderBy('order', 'asc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as PrayerGroupItem));
  } catch (err) {
    console.error('Error fetching prayer groups:', err);
    try {
      handleFirestoreError(err, OperationType.LIST, 'prayer_groups');
    } catch {
      // return defaults on permission failure
    }
    return [];
  }
};

export const savePrayerGroup = async (group: Omit<PrayerGroupItem, 'id'> & { id?: string }) => {
  const { id, ...data } = group;
  const cleanData = Object.fromEntries(
    Object.entries(data).filter(([_, v]) => v !== undefined)
  );

  if (id) {
    const ref = doc(db, 'prayer_groups', id);
    await setDoc(ref, cleanData, { merge: true });
    return id;
  } else {
    const ref = await addDoc(collection(db, 'prayer_groups'), cleanData);
    return ref.id;
  }
};

export const deletePrayerGroup = async (id: string) => {
  await deleteDoc(doc(db, 'prayer_groups', id));
};

// Site Content Management
export const fetchSiteContent = async (): Promise<SiteContentData | null> => {
  try {
    const ref = doc(db, 'site_content', 'main');
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const data = snap.data() as Partial<SiteContentData>;

      let jubileeLogoUrl = data.jubileeLogoUrl;
      if (
        !jubileeLogoUrl || 
        jubileeLogoUrl.includes('ais-dev-') || 
        jubileeLogoUrl.includes('localhost') ||
        jubileeLogoUrl.startsWith('/assets/regenerated_image') ||
        jubileeLogoUrl === 'https://logodix.com/logo/1753988.png'
      ) {
        jubileeLogoUrl = undefined;
      }

      const merged: SiteContentData = {
        ...INITIAL_SITE_CONTENT,
        ...data,
        jubileeLogoUrl,
        instagramUrl: (!data.instagramUrl || data.instagramUrl.includes('jesusyouthsg')) 
          ? 'https://www.instagram.com/jesusyouth_singapore' 
          : data.instagramUrl,
        facebookUrl: (!data.facebookUrl || data.facebookUrl.includes('jesusyouthsg')) 
          ? 'https://www.facebook.com/jy15sg' 
          : data.facebookUrl,
        youtubeUrl: (!data.youtubeUrl || data.youtubeUrl.includes('@jesusyouthsingapore')) 
          ? 'https://www.youtube.com/@JesusYouthSingapore' 
          : data.youtubeUrl,
        websiteUrl: !data.websiteUrl ? 'https://singapore.jesusyouth.org/' : data.websiteUrl,
      };

      return merged;
    }
    return INITIAL_SITE_CONTENT;
  } catch (err) {
    console.error('Error fetching site content:', err);
    try {
      handleFirestoreError(err, OperationType.GET, 'site_content/main');
    } catch {
      // return default on read failure
    }
    return INITIAL_SITE_CONTENT;
  }
};

export const subscribeToSiteContent = (callback: (content: SiteContentData) => void) => {
  const ref = doc(db, 'site_content', 'main');
  return onSnapshot(ref, (snap) => {
    if (snap.exists()) {
      const data = snap.data() as Partial<SiteContentData>;
      let jubileeLogoUrl = data.jubileeLogoUrl;
      if (
        !jubileeLogoUrl || 
        jubileeLogoUrl.includes('ais-dev-') || 
        jubileeLogoUrl.includes('localhost') ||
        jubileeLogoUrl.startsWith('/assets/regenerated_image') ||
        jubileeLogoUrl === 'https://logodix.com/logo/1753988.png'
      ) {
        jubileeLogoUrl = undefined;
      }

      const merged: SiteContentData = {
        ...INITIAL_SITE_CONTENT,
        ...data,
        jubileeLogoUrl,
        enableGoogleLogin: data.enableGoogleLogin ?? true,
        enablePassIdLogin: data.enablePassIdLogin ?? false,
        enableEmailLogin: data.enableEmailLogin ?? false,
      };
      callback(merged);
    } else {
      callback(INITIAL_SITE_CONTENT);
    }
  }, (err) => {
    console.warn('Error listening to site content:', err);
    callback(INITIAL_SITE_CONTENT);
  });
};

export const saveSiteContent = async (content: Partial<SiteContentData>) => {
  const ref = doc(db, 'site_content', 'main');

  // Sanitize content to prevent Firestore document size limit crashes (1MB limit)
  const sanitizedContent = { ...content };

  if (sanitizedContent.customVideoScenes) {
    sanitizedContent.customVideoScenes = sanitizedContent.customVideoScenes.map(scene => {
      if (scene.url && scene.url.startsWith('data:') && scene.url.length > 100000) {
        return {
          ...scene,
          url: 'indexeddb_stored'
        };
      }
      return scene;
    });
  }

  if (sanitizedContent.activeVideoUrl && sanitizedContent.activeVideoUrl.startsWith('data:') && sanitizedContent.activeVideoUrl.length > 100000) {
    sanitizedContent.activeVideoUrl = 'indexeddb_stored';
  }

  await setDoc(ref, {
    ...sanitizedContent,
    updatedAt: new Date().toISOString()
  }, { merge: true });
};

// ==================== CONTACT MESSAGES / INBOX ====================
export const sendContactMessage = async (name: string, email: string, message: string): Promise<string> => {
  try {
    const messageData = {
      name,
      email,
      message,
      status: 'unread',
      createdAt: new Date().toISOString(),
      replies: []
    };
    const docRef = await addDoc(collection(db, 'contact_messages'), messageData);
    return docRef.id;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, 'contact_messages');
    throw err;
  }
};

export const fetchContactMessages = async (): Promise<ContactMessageItem[]> => {
  try {
    const q = query(collection(db, 'contact_messages'), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as ContactMessageItem));
  } catch (err) {
    console.error('Error fetching contact messages:', err);
    try {
      handleFirestoreError(err, OperationType.LIST, 'contact_messages');
    } catch {
      // Return empty array on read failure for UI safety
    }
    return [];
  }
};

export const replyToContactMessage = async (
  messageId: string, 
  replyText: string, 
  adminEmail: string, 
  adminName?: string, 
  aiGenerated?: boolean
): Promise<void> => {
  try {
    const ref = doc(db, 'contact_messages', messageId);
    const snap = await getDoc(ref);
    if (!snap.exists()) throw new Error('Message not found');

    const data = snap.data() as ContactMessageItem;
    const newReply: ContactMessageReply = {
      id: 'reply_' + Date.now(),
      repliedByEmail: adminEmail,
      repliedByName: adminName || adminEmail.split('@')[0],
      replyText,
      sentAt: new Date().toISOString(),
      aiGenerated: !!aiGenerated
    };

    const updatedReplies = [...(data.replies || []), newReply];
    await updateDoc(ref, {
      replies: updatedReplies,
      status: 'replied',
      lastRepliedAt: new Date().toISOString()
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `contact_messages/${messageId}`);
    throw err;
  }
};

export const updateMessageStatus = async (messageId: string, status: 'unread' | 'replied' | 'archived'): Promise<void> => {
  try {
    const ref = doc(db, 'contact_messages', messageId);
    await updateDoc(ref, { status });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `contact_messages/${messageId}`);
    throw err;
  }
};

export const deleteContactMessage = async (messageId: string): Promise<void> => {
  try {
    const ref = doc(db, 'contact_messages', messageId);
    await deleteDoc(ref);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `contact_messages/${messageId}`);
    throw err;
  }
};

// ==================== AUDIT BACKUPS & GO-LIVE DATA CLEAR ====================

export interface AuditBackupRecord {
  id?: string;
  backupType: 'go_live_clear' | 'bulk_delete' | 'full_database_snapshot' | 'manual_backup';
  title: string;
  description: string;
  deletedByEmail: string;
  timestamp: string;
  recordsCount: number;
  totalPaymentAmount?: number;
  dataSnapshot: {
    registrations?: RegistrationData[];
    auditLogs?: RegistrationAuditLog[];
    intercessions?: any[];
    invitations?: any[];
    approvedAdmins?: any[];
    siteContent?: any[];
    timelineEvents?: any[];
    prayerGroups?: any[];
    contactMessages?: any[];
    [key: string]: any;
  };
}

export const saveAuditBackupToFirestore = async (
  backup: Omit<AuditBackupRecord, 'id'>
): Promise<string> => {
  try {
    const cleaned = cleanFirestoreData(backup as Record<string, any>);
    const docRef = await addDoc(collection(db, 'audit_backups'), cleaned);
    return docRef.id;
  } catch (err) {
    console.error('Failed to save audit backup record to Firestore:', err);
    throw err;
  }
};

export const fetchAuditBackupsFromFirestore = async (): Promise<AuditBackupRecord[]> => {
  try {
    const q = query(collection(db, 'audit_backups'), orderBy('timestamp', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as AuditBackupRecord));
  } catch (err) {
    console.error('Failed to fetch audit backups from Firestore:', err);
    return [];
  }
};

export const deleteAuditBackupFromFirestore = async (backupId: string): Promise<boolean> => {
  try {
    await deleteDoc(doc(db, 'audit_backups', backupId));
    return true;
  } catch (err) {
    console.error('Failed to delete audit backup:', err);
    return false;
  }
};

export const bulkDeleteRegistrationsFromFirestore = async (
  idsToDelete: string[],
  deletedByEmail: string,
  reason = 'Bulk registration deletion'
): Promise<{ success: boolean; deletedCount: number; backupId: string; deletedRecords: RegistrationData[] }> => {
  try {
    if (!idsToDelete || idsToDelete.length === 0) {
      return { success: true, deletedCount: 0, backupId: '', deletedRecords: [] };
    }

    // 1. Fetch current registrations to snapshot
    const allRegs = await fetchAllRegistrations();
    const recordsToBackup = allRegs.filter(r => idsToDelete.includes(r.id));

    const totalPaymentSum = recordsToBackup.reduce((sum, r) => sum + (Number(r.paymentAmount) || 0), 0);

    // 2. Save snapshot to audit_backups table
    const backupId = await saveAuditBackupToFirestore({
      backupType: 'bulk_delete',
      title: `Bulk Deletion (${recordsToBackup.length} Records)`,
      description: `Bulk deletion triggered by ${deletedByEmail}. Reason: ${reason}`,
      deletedByEmail,
      timestamp: new Date().toISOString(),
      recordsCount: recordsToBackup.length,
      totalPaymentAmount: totalPaymentSum,
      dataSnapshot: {
        registrations: recordsToBackup
      }
    });

    // 3. Delete from Firestore via deleteRegistrationFromFirestore for full tombstone & array cleanup
    const deletePromises = idsToDelete.map(id => deleteRegistrationFromFirestore(id));
    await Promise.all(deletePromises);

    // 4. Record audit log
    await logRegistrationAction({
      action: 'delete',
      adminEmail: deletedByEmail,
      adminName: deletedByEmail,
      registrationId: backupId,
      registrationType: 'conference',
      registrantName: `${recordsToBackup.length} Selected Registrations`,
      registrantEmail: deletedByEmail,
      snapshot: { name: 'Bulk Deleted Batch' } as any,
      details: `Bulk deleted ${recordsToBackup.length} registrations. Audit backup snapshot saved: ${backupId}`
    });

    return {
      success: true,
      deletedCount: recordsToBackup.length,
      backupId,
      deletedRecords: recordsToBackup
    };
  } catch (err) {
    console.error('Bulk delete registrations failed:', err);
    throw err;
  }
};

export const clearAllRegistrationsFromFirestore = async (
  deletedByEmail: string,
  options?: { deleteAuditLogs?: boolean }
): Promise<{ success: boolean; deletedCount: number; backupId: string; deletedRecords: RegistrationData[] }> => {
  try {
    // 1. Fetch all registrations
    const allRegs = await fetchAllRegistrations();
    const totalPaymentSum = allRegs.reduce((sum, r) => sum + (Number(r.paymentAmount) || 0), 0);

    let auditLogsSnapshot: RegistrationAuditLog[] = [];
    if (options?.deleteAuditLogs) {
      auditLogsSnapshot = await fetchRegistrationAuditLogs();
    }

    // 2. Save snapshot to audit_backups table
    const backupId = await saveAuditBackupToFirestore({
      backupType: 'go_live_clear',
      title: '🚀 Go Live Clear All Test Data',
      description: `Full wipe of all ${allRegs.length} test registration records prior to official event Go Live. Action executed by ${deletedByEmail}.`,
      deletedByEmail,
      timestamp: new Date().toISOString(),
      recordsCount: allRegs.length,
      totalPaymentAmount: totalPaymentSum,
      dataSnapshot: {
        registrations: allRegs,
        auditLogs: auditLogsSnapshot
      }
    });

    // 3. Delete all registrations
    const deleteRegPromises = allRegs.map(r => deleteDoc(doc(db, 'registrations', r.id)));
    await Promise.all(deleteRegPromises);

    // 4. Delete all invitation codes for Go Live
    try {
      await deleteAllInvitationCodesFromFirestore();
    } catch (e) {
      console.warn('Failed to delete all invitation codes during Go Live:', e);
    }

    // 5. Clear all portal user audit logs for Go Live
    try {
      await clearPortalUserLogs();
    } catch (e) {
      console.warn('Failed to clear portal user logs during Go Live:', e);
    }

    // 6. Save Go Live mode setting
    try {
      await saveSystemSettingsToFirestore({
        isGoLive: true,
        goLiveTimestamp: new Date().toISOString(),
        updatedBy: deletedByEmail
      });
    } catch (e) {
      console.warn('Failed to save system settings for Go Live:', e);
    }

    // 7. Optionally clear registration audit logs
    if (options?.deleteAuditLogs && auditLogsSnapshot.length > 0) {
      const deleteLogPromises = auditLogsSnapshot.map(l => deleteDoc(doc(db, 'registration_audit_logs', l.id)));
      await Promise.all(deleteLogPromises);
    }

    // 8. Create audit log entry for Go Live
    await logRegistrationAction({
      action: 'delete',
      adminEmail: deletedByEmail,
      adminName: deletedByEmail,
      registrationId: backupId,
      registrationType: 'conference',
      registrantName: 'SYSTEM GO-LIVE WIPE',
      registrantEmail: deletedByEmail,
      snapshot: { name: 'Go Live Wipe Batch' } as any,
      details: `Cleared all ${allRegs.length} test registrations for event Go Live. Backup snapshot stored with ID ${backupId}.`
    });

    return {
      success: true,
      deletedCount: allRegs.length,
      backupId,
      deletedRecords: allRegs
    };
  } catch (err) {
    console.error('Clear all registrations failed:', err);
    throw err;
  }
};

export const exportFullFirestoreDatabaseJSON = async () => {
  try {
    const [
      registrations,
      auditLogs,
      approvedAdmins,
      contactMessages,
      auditBackups
    ] = await Promise.all([
      fetchAllRegistrations(),
      fetchRegistrationAuditLogs(),
      fetchApprovedAdmins(),
      fetchContactMessages(),
      fetchAuditBackupsFromFirestore()
    ]);

    return {
      appName: "GRACIA Jubilee Celebration 2026",
      exportTimestamp: new Date().toISOString(),
      collections: {
        registrations,
        registration_audit_logs: auditLogs,
        approved_admins: approvedAdmins,
        contact_messages: contactMessages,
        audit_backups: auditBackups
      }
    };
  } catch (err) {
    console.error('Failed to export full database JSON:', err);
    throw err;
  }
};

export const restoreFullFirestoreDatabaseJSON = async (
  backupJson: any,
  restoredByEmail: string
): Promise<{ success: boolean; restoredCount: number }> => {
  try {
    if (!backupJson || !backupJson.collections) {
      throw new Error('Invalid backup file structure.');
    }

    let totalRestored = 0;
    const collections = backupJson.collections;

    // Restore registrations
    if (Array.isArray(collections.registrations) && collections.registrations.length > 0) {
      for (const reg of collections.registrations) {
        if (reg.id) {
          const cleaned = cleanFirestoreData(reg);
          await setDoc(doc(db, 'registrations', reg.id), cleaned, { merge: true });
          totalRestored++;
        }
      }
    }

    // Restore audit logs
    if (Array.isArray(collections.registration_audit_logs) && collections.registration_audit_logs.length > 0) {
      for (const logItem of collections.registration_audit_logs) {
        if (logItem.id) {
          const cleaned = cleanFirestoreData(logItem);
          await setDoc(doc(db, 'registration_audit_logs', logItem.id), cleaned, { merge: true });
        }
      }
    }

    // Record audit log
    await logRegistrationAction({
      action: 'restore',
      adminEmail: restoredByEmail,
      adminName: restoredByEmail,
      registrationId: 'restore-' + Date.now(),
      registrationType: 'conference',
      registrantName: 'DATABASE RESTORE',
      registrantEmail: restoredByEmail,
      snapshot: { name: 'Database Restore Batch' } as any,
      details: `Restored ${totalRestored} registration records from database backup file. Executed by ${restoredByEmail}.`
    });

    return { success: true, restoredCount: totalRestored };
  } catch (err) {
    console.error('Failed to restore database from backup JSON:', err);
    throw err;
  }
};

export const restoreSingleRegistrationRecordToFirestore = async (
  record: RegistrationData,
  restoredByEmail: string
): Promise<boolean> => {
  try {
    if (!record || !record.id) {
      throw new Error('Invalid record structure to restore.');
    }

    // 1. Clean data and restore registration document
    const cleaned = cleanFirestoreData(record as Record<string, any>);
    await setDoc(doc(db, 'registrations', record.id), cleaned, { merge: true });

    // Remove tombstone from deleted_registrations
    try {
      await deleteDoc(doc(db, 'deleted_registrations', record.id));
      if (record.passId) await deleteDoc(doc(db, 'deleted_registrations', record.passId));
      if (record.paymentReference) await deleteDoc(doc(db, 'deleted_registrations', record.paymentReference));
    } catch {}

    // 2. Sync additional attendees if present
    if (record.additionalAttendees && record.additionalAttendees.length > 0) {
      try {
        await syncAdditionalAttendeesToFirestore(record.id, record, record.additionalAttendees);
      } catch (err) {
        console.warn(`Failed to sync additional attendees during restore for ${record.id}:`, err);
      }
    }

    // 3. Record audit log
    await logRegistrationAction({
      action: 'restore',
      adminEmail: restoredByEmail,
      adminName: restoredByEmail,
      registrationId: record.id,
      registrationType: record.type || 'conference',
      registrantName: record.name,
      registrantEmail: record.email,
      registrantPhone: record.phone || '',
      snapshot: record,
      details: `Restored deleted registration record for "${record.name}" (${record.email}) back into active registrations.`
    }).catch(() => null);

    return true;
  } catch (err) {
    console.error('Failed to restore single registration record to Firestore:', err);
    throw err;
  }
};

// ==================== PORTAL USER AUDIT LOGS ====================
export const logPortalUserActivity = async (
  logData: {
    name?: string;
    email: string;
    phone?: string;
    action: string;
    details?: string;
    loginMethod?: string;
  }
): Promise<string> => {
  try {
    if (!logData.email) return '';

    const entry: PortalUserLogItem = {
      name: logData.name || logData.email.split('@')[0],
      email: logData.email.toLowerCase().trim(),
      phone: logData.phone || '',
      action: logData.action,
      details: logData.details || '',
      loginMethod: logData.loginMethod || 'Google Portal Login',
      timestamp: new Date().toISOString()
    };

    const docRef = await addDoc(collection(db, 'portal_user_logs'), entry);
    return docRef.id;
  } catch (err) {
    console.error('Failed to log portal user activity:', err);
    return '';
  }
};

export const fetchPortalUserLogs = async (): Promise<PortalUserLogItem[]> => {
  try {
    const q = query(collection(db, 'portal_user_logs'), orderBy('timestamp', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as PortalUserLogItem));
  } catch (err) {
    console.error('Error fetching portal user logs:', err);
    return [];
  }
};

export const clearPortalUserLogs = async (): Promise<boolean> => {
  try {
    const snapshot = await getDocs(collection(db, 'portal_user_logs'));
    if (snapshot.empty) return true;

    // Delete in batches of up to 400 docs to respect Firestore limits
    const docs = snapshot.docs;
    const batchSize = 400;
    for (let i = 0; i < docs.length; i += batchSize) {
      const batch = writeBatch(db);
      const chunk = docs.slice(i, i + batchSize);
      chunk.forEach(docSnap => {
        batch.delete(docSnap.ref);
      });
      await batch.commit();
    }
    return true;
  } catch (err) {
    console.error('Error clearing portal user logs:', err);
    // Fallback to individual deleteDoc if batch fails
    try {
      const snapshot = await getDocs(collection(db, 'portal_user_logs'));
      const promises = snapshot.docs.map(d => deleteDoc(d.ref));
      await Promise.all(promises);
      return true;
    } catch (fallbackErr) {
      console.error('Fallback deleteDoc error:', fallbackErr);
      return false;
    }
  }
};

