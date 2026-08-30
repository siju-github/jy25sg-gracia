import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  onSnapshot,
  query,
  where
} from 'firebase/firestore';
import { db } from './firebase';

export interface InvitationCodeRecord {
  id: string;
  code: string;
  codeType?: 'individual' | 'group' | 'group_member';
  type?: 'individual' | 'group' | 'group_member';
  maxSeats: number;
  seatsUsed: number;
  status: 'unused' | 'used' | 'invalid';
  isUsed?: boolean;
  isInvalid?: boolean;
  recipientName?: string;
  recipientEmail?: string;
  groupName?: string;
  category?: string;
  invitedBy?: string; // Person who invites
  createdBy?: string;
  createdByName?: string;
  createdByEmail?: string;
  ticketType?: 'complimentary' | 'paid'; // 'complimentary' (default) or 'paid'
  ticketPrice?: number; // Price per seat/ticket if paid
  assignedSeatNumbers?: string[]; // Array of assigned seat/member names for each allocated seat
  createdAt: string;
  isDeleted?: boolean;
  deletedAt?: string;
  deletedBy?: string; // Admin who deleted the code
  assignedToName?: string;
  assignedToEmail?: string;
  assignedToPhone?: string;
  notes?: string;
  redeemedBy?: {
    registrationId: string;
    registrantName: string;
    registrantEmail: string;
    seatsReserved: number;
    redeemedAt: string;
  }[];
}

export interface MusicalConcertSettings {
  releaseDate: string; // ISO string e.g. "2026-09-10T00:00:00Z"
  updatedAt?: string;
  updatedBy?: string;
}

export const DEFAULT_MUSICAL_RELEASE_DATE = '2026-09-10T00:00:00Z';

// Subscribe to invitation codes
export function subscribeToInvitationCodes(callback: (codes: InvitationCodeRecord[]) => void) {
  try {
    const colRef = collection(db, 'invitation_codes');
    return onSnapshot(colRef, (snap) => {
      const list: InvitationCodeRecord[] = [];
      snap.forEach((d) => {
        list.push({ id: d.id, ...d.data() } as InvitationCodeRecord);
      });
      // Sort newest first
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      callback(list);
    }, (err) => {
      console.error('Error subscribing to invitation codes:', err);
      callback([]);
    });
  } catch (e) {
    console.error('Failed to attach invitation codes listener:', e);
    callback([]);
    return () => {};
  }
}

// Save or Update invitation code
export async function saveInvitationCode(record: InvitationCodeRecord): Promise<void> {
  try {
    const docRef = doc(db, 'invitation_codes', record.id);
    await setDoc(docRef, record, { merge: true });
  } catch (err) {
    console.error('Error saving invitation code:', err);
    throw err;
  }
}

// Create new invitation code helper
export async function createInvitationCode(params: {
  codeType: 'individual' | 'group' | 'group_member';
  recipientName: string;
  recipientEmail?: string;
  groupName?: string;
  category?: string;
  maxSeats: number;
  customPrefix?: string;
  createdBy?: string;
  createdByName?: string;
  invitedBy?: string;
  ticketType?: 'complimentary' | 'paid';
  ticketPrice?: number;
  assignedSeatNumbers?: string[];
}): Promise<InvitationCodeRecord> {
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  const prefix = (params.customPrefix || 'GRACIA').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const codeStr = `${prefix}-${randomSuffix}`;
  const id = `code-${Date.now()}-${randomSuffix}`;

  const record: InvitationCodeRecord = {
    id,
    code: codeStr,
    codeType: params.codeType,
    type: params.codeType,
    recipientName: params.recipientName,
    recipientEmail: params.recipientEmail || '',
    groupName: params.groupName || '',
    category: params.category || 'General',
    maxSeats: params.maxSeats || 1,
    seatsUsed: 0,
    status: 'unused',
    isUsed: false,
    createdBy: params.createdBy || '',
    createdByName: params.createdByName || params.createdBy || '',
    invitedBy: params.invitedBy || '',
    ticketType: params.ticketType || 'complimentary',
    ticketPrice: params.ticketPrice ?? (params.ticketType === 'paid' ? 10 : 0),
    assignedSeatNumbers: params.assignedSeatNumbers || [],
    createdAt: new Date().toISOString()
  };

  await saveInvitationCode(record);
  return record;
}

// Delete invitation code
export async function deleteInvitationCode(codeId: string): Promise<void> {
  try {
    const docRef = doc(db, 'invitation_codes', codeId);
    await deleteDoc(docRef);
  } catch (err) {
    console.error('Error deleting invitation code:', err);
    throw err;
  }
}

// Release invitation code when registration is deleted
export async function releaseInvitationCodeForRegistration(
  registrationId: string,
  codeStr?: string
): Promise<boolean> {
  try {
    const colRef = collection(db, 'invitation_codes');
    const snap = await getDocs(colRef);

    let targetDoc: { id: string; record: InvitationCodeRecord } | null = null;

    snap.forEach((d) => {
      const data = d.data() as InvitationCodeRecord;
      const isCodeMatch = codeStr && data.code && data.code.trim().toUpperCase() === codeStr.trim().toUpperCase();
      const hasRedemption = data.redeemedBy && data.redeemedBy.some(r => r.registrationId === registrationId);
      
      if (isCodeMatch || hasRedemption) {
        targetDoc = { id: d.id, record: data };
      }
    });

    if (!targetDoc) return false;

    const { id, record } = targetDoc;
    const existingRedeemed = record.redeemedBy || [];
    const removedRedemptions = existingRedeemed.filter(r => r.registrationId === registrationId);
    
    // Calculate seats reserved by this registration
    const seatsToRelease = removedRedemptions.reduce((sum, r) => sum + (r.seatsReserved || 1), 0) || 1;
    const newRedeemedList = existingRedeemed.filter(r => r.registrationId !== registrationId);

    const newSeatsUsed = Math.max(0, (record.seatsUsed || 0) - seatsToRelease);
    const isNowUsed = newSeatsUsed >= record.maxSeats;

    const docRef = doc(db, 'invitation_codes', id);
    await updateDoc(docRef, {
      seatsUsed: newSeatsUsed,
      status: isNowUsed ? 'used' : 'unused',
      isUsed: isNowUsed,
      redeemedBy: newRedeemedList
    });

    return true;
  } catch (err) {
    console.error('Error releasing invitation code:', err);
    return false;
  }
}

// Delete all invitation codes during Go Live
export async function deleteAllInvitationCodesFromFirestore(): Promise<number> {
  try {
    const colRef = collection(db, 'invitation_codes');
    const snap = await getDocs(colRef);
    const deletePromises = snap.docs.map(d => deleteDoc(d.ref));
    await Promise.all(deletePromises);
    return snap.docs.length;
  } catch (err) {
    console.error('Error deleting all invitation codes:', err);
    throw err;
  }
}

// Validate an invitation code string
export async function validateInvitationCode(codeStr: string): Promise<{
  valid: boolean;
  codeRecord?: InvitationCodeRecord;
  message?: string;
}> {
  if (!codeStr || !codeStr.trim()) {
    return { valid: false, message: 'Please enter an invitation code.' };
  }

  const cleanCode = codeStr.trim().toUpperCase();

  try {
    const colRef = collection(db, 'invitation_codes');
    const snap = await getDocs(colRef);
    let matchedDoc: InvitationCodeRecord | null = null;

    snap.forEach((d) => {
      const data = d.data() as InvitationCodeRecord;
      if (data.code && data.code.trim().toUpperCase() === cleanCode) {
        matchedDoc = { id: d.id, ...data };
      }
    });

    if (!matchedDoc) {
      return { valid: false, message: 'Invalid invitation code. Please check and try again.' };
    }

    const rec = matchedDoc as InvitationCodeRecord;

    if (rec.isDeleted) {
      return { 
        valid: false, 
        message: 'This invitation code is no longer active.' 
      };
    }

    if (rec.status === 'invalid' || rec.isInvalid) {
      return { 
        valid: false, 
        message: 'This invitation code has been marked as invalid or cancelled.' 
      };
    }

    const remainingSeats = rec.maxSeats - (rec.seatsUsed || 0);

    if (rec.status === 'used' || remainingSeats <= 0) {
      return { 
        valid: false, 
        codeRecord: rec, 
        message: 'This invitation code has already been fully redeemed.' 
      };
    }

    return { 
      valid: true, 
      codeRecord: rec, 
      message: `Code verified! ${remainingSeats} seat(s) available.` 
    };
  } catch (err) {
    console.error('Error validating invitation code:', err);
    return { valid: false, message: 'Server error validating invitation code.' };
  }
}

// Redeem an invitation code
export async function redeemInvitationCode(
  codeId: string, 
  seatsReserved: number,
  redemptionData: {
    registrationId: string;
    registrantName: string;
    registrantEmail: string;
  }
): Promise<boolean> {
  try {
    const docRef = doc(db, 'invitation_codes', codeId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return false;

    const data = snap.data() as InvitationCodeRecord;
    const newSeatsUsed = (data.seatsUsed || 0) + seatsReserved;
    const isNowUsed = newSeatsUsed >= data.maxSeats;

    const newRedemption = {
      ...redemptionData,
      seatsReserved,
      redeemedAt: new Date().toISOString()
    };

    const existingRedeemed = data.redeemedBy || [];

    await updateDoc(docRef, {
      seatsUsed: newSeatsUsed,
      status: isNowUsed ? 'used' : 'unused',
      redeemedBy: [...existingRedeemed, newRedemption]
    });

    return true;
  } catch (err) {
    console.error('Error redeeming invitation code:', err);
    return false;
  }
}

// Musical Concert Settings (Release Date)
export async function getMusicalConcertSettings(): Promise<MusicalConcertSettings> {
  try {
    const docRef = doc(db, 'settings', 'musicalSettings');
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data() as MusicalConcertSettings;
    }
  } catch (err) {
    console.warn('Error reading musical settings from Firestore:', err);
  }
  return { releaseDate: DEFAULT_MUSICAL_RELEASE_DATE };
}

export async function saveMusicalConcertSettings(settings: MusicalConcertSettings): Promise<void> {
  try {
    const docRef = doc(db, 'settings', 'musicalSettings');
    await setDoc(docRef, settings, { merge: true });
  } catch (err) {
    console.error('Error saving musical settings:', err);
    throw err;
  }
}
