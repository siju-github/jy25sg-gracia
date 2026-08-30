import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, setDoc, writeBatch, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { SiteContentData } from '../types';
import { INITIAL_INVITATIONS_DATA, INITIAL_PARISH_INVITATIONS } from './initialInvitationsData';

export interface InvitationRecord {
  id: string;
  serialNo: number;
  fullName: string;
  gender: 'Male' | 'Female' | '';
  phone: string;
  phone2?: string;
  email: string;
  category: string; // e.g. 'Family', 'Youth', 'Youth/Student', 'Single', 'Church Secretary', 'Parish Priest', etc.
  remarks: string; // e.g. 'CS Participant', 'Family Team; Mission', etc.
  keywords?: string; // Custom keywords or prompt hints for composing personalized invite email
  invitationStatus?: string; // e.g. 'not_invited', 'email_sent', 'whatsapp_sent', 'accepted', 'declined', 'attended', 'REGISTERED', or custom status
  lastInvitedAt?: string;
  statusUpdatedAt?: string;
  parishName?: string;
  designation?: string;
  isInactiveJY?: boolean;
  isMinistryTeam?: boolean;
  inCharge?: string; // In-charge person name
  invitedBy?: string; // Person who invites
  isDeleted?: boolean; // Soft delete flag (moved to Deleted Names tab)
  deletedAt?: string;
  deletedBy?: string; // Admin who deleted the record
}

export type InvitationAdminRole = 
  | 'invitation_main_admin'
  | 'public_invitation_admin'
  | 'parish_invitation_admin'
  | 'jy_coordinators'
  | 'inactive_jys_admin';

export const INVITATION_SUB_ROLE_LABELS: Record<InvitationAdminRole, string> = {
  invitation_main_admin: 'Invitations Lead',
  public_invitation_admin: 'Public',
  parish_invitation_admin: 'Parish',
  jy_coordinators: 'JY Coordinators',
  inactive_jys_admin: 'Inactive JYs'
};

export function formatInvitationRoleName(subRoles?: InvitationAdminRole[]): string {
  if (!subRoles || subRoles.length === 0) {
    return 'Invitation Admin';
  }
  const labels = subRoles.map(r => INVITATION_SUB_ROLE_LABELS[r] || r);
  return `Invitation Admin - ${labels.join(', ')}`;
}

export interface SingaporeParishInfo {
  id: string;
  parishName: string;
  district: 'City' | 'East' | 'West' | 'North' | 'Serangoon';
  address: string;
  phone: string;
  email: string;
  website: string;
  parishPriest: string;
  assistantPriests: string[];
  parishSecretaries: string[];
  catechismCoordinators: string[];
  youthCoordinators: string[];
}

export const SINGAPORE_PARISHES_DIRECTORY: SingaporeParishInfo[] = [
  {
    id: 'sg-parish-1',
    parishName: 'Cathedral of the Good Shepherd',
    district: 'City',
    address: 'A Queen Street, Singapore 188533',
    phone: '6337 2036',
    email: 'cathedral@catholic.org.sg',
    website: 'https://cathedral.catholic.sg',
    parishPriest: 'Rev Fr Jude David',
    assistantPriests: ['Rev Fr Biju Mathew', 'Rev Fr Alexius Tan'],
    parishSecretaries: ['Ms Grace Tan', 'Mr Bernard Lim'],
    catechismCoordinators: ['Mrs Evelyn De Souza'],
    youthCoordinators: ['Cathedral Youth Ministry (CYM)']
  },
  {
    id: 'sg-parish-2',
    parishName: 'Church of St Mary of the Angels',
    district: 'West',
    address: '5 Bukit Batok East Ave 2, Singapore 659918',
    phone: '6567 3888',
    email: 'connect.stmary@catholic.org.sg',
    website: 'https://stmary.sg',
    parishPriest: 'Friar Michael D’Cruz, OFM',
    assistantPriests: ['Friar Derrick Yee, OFM', 'Friar Eunan Hegarty, OFM'],
    parishSecretaries: ['Ms Catherine Wong', 'Ms Agnes Lee'],
    catechismCoordinators: ['Mr Dominic Ang'],
    youthCoordinators: ['Ignite Youth Ministry']
  },
  {
    id: 'sg-parish-3',
    parishName: 'Church of St Ignatius',
    district: 'West',
    address: '120 King’s Road, Singapore 268172',
    phone: '6466 0625',
    email: 'stignatius@catholic.org.sg',
    website: 'https://stignatius.org.sg',
    parishPriest: 'Rev Fr Leslie Raj, SJ',
    assistantPriests: ['Rev Fr Paul David, SJ', 'Rev Fr James Gasper, SJ'],
    parishSecretaries: ['Ms Teresa Tan', 'Mrs Pauline Loo'],
    catechismCoordinators: ['Mrs Mary Jane Kwek'],
    youthCoordinators: ['Ignatian Youth Council']
  },
  {
    id: 'sg-parish-4',
    parishName: 'Church of the Holy Family',
    district: 'East',
    address: '6 Chapel Road, Singapore 429602',
    phone: '6344 0046',
    email: 'chf.secretariat@catholic.org.sg',
    website: 'https://holyfamily.org.sg',
    parishPriest: 'Rev Fr Patrick V. Arockiam',
    assistantPriests: ['Rev Fr Andrew Lin', 'Rev Fr Stanislaus Pang'],
    parishSecretaries: ['Ms Christine Tay', 'Ms Helen Goh'],
    catechismCoordinators: ['Mr Francis Xavier Teo'],
    youthCoordinators: ['Holy Family Youth Office']
  },
  {
    id: 'sg-parish-5',
    parishName: 'Church of Our Lady of Perpetual Succour (OLPS)',
    district: 'East',
    address: '31 Siglap Hill, Singapore 456085',
    phone: '6241 9565',
    email: 'secretariat@olps.sg',
    website: 'https://olps.sg',
    parishPriest: 'Rev Fr Anthony Kenny Tan',
    assistantPriests: ['Rev Fr Edmund Falcao', 'Rev Fr Roy Choong'],
    parishSecretaries: ['Ms Doreen Soh', 'Ms Vivien Lee'],
    catechismCoordinators: ['Tammy Lim'],
    youthCoordinators: ['OLPS Youth Board']
  },
  {
    id: 'sg-parish-6',
    parishName: 'Church of the Holy Cross',
    district: 'West',
    address: '450 Clementi Ave 1, Singapore 129955',
    phone: '6777 5858',
    email: 'holycross@catholic.org.sg',
    website: 'https://holycross.org.sg',
    parishPriest: 'Rev Fr Henry Siew',
    assistantPriests: ['Rev Fr Martinmuthu', 'Rev Fr Andrew Tan'],
    parishSecretaries: ['Ms Clara Ho', 'Ms Joanne Lee'],
    catechismCoordinators: ['Mrs Bernadette Wong'],
    youthCoordinators: ['Crossfire Youth Ministry']
  },
  {
    id: 'sg-parish-7',
    parishName: 'Church of St Francis Xavier',
    district: 'Serangoon',
    address: '63A Chartwell Drive, Singapore 558758',
    phone: '6280 0608',
    email: 'secretariat@sfxchurch.sg',
    website: 'https://sfxchurch.sg',
    parishPriest: 'Rev Fr Benedict Goh',
    assistantPriests: ['Rev Fr Jude Thomas'],
    parishSecretaries: ['Ms Felicia Tan', 'Ms Susan Ong'],
    catechismCoordinators: ['Mr Joseph Nathan'],
    youthCoordinators: ['SFX Youth Circle']
  },
  {
    id: 'sg-parish-8',
    parishName: 'Church of the Risen Christ',
    district: 'North',
    address: '91 Toa Payoh Lorong 4, Singapore 319517',
    phone: '6253 2163',
    email: 'secretariat@risenchrist.org.sg',
    website: 'https://risenchrist.org.sg',
    parishPriest: 'Rev Fr Edward Seah',
    assistantPriests: ['Rev Fr Camillus Jansz', 'Rev Fr F.X. M. M. Varian'],
    parishSecretaries: ['Ms Patricia Lim'],
    catechismCoordinators: ['Mrs Angela Tay'],
    youthCoordinators: ['Risen Christ Youth']
  },
  {
    id: 'sg-parish-9',
    parishName: 'Church of Our Lady Star of the Sea',
    district: 'North',
    address: '10 Yishun Street 22, Singapore 768579',
    phone: '6257 4229',
    email: 'secretariat@olss.sg',
    website: 'https://olss.sg',
    parishPriest: 'Rev Fr Gregoire van Giang, MEP',
    assistantPriests: ['Rev Fr Joseph Ki', 'Rev Fr Stanislaus Surip, SVD'],
    parishSecretaries: ['Ms Jessica Pereira', 'Ms Monica Wong'],
    catechismCoordinators: ['Mrs Josephine Dass'],
    youthCoordinators: ['Star Youth Ministry']
  },
  {
    id: 'sg-parish-10',
    parishName: 'Church of St Vincent de Paul',
    district: 'Serangoon',
    address: '301 Yio Chu Kang Road, Singapore 805910',
    phone: '6482 0980',
    email: 'secretariat@svdp.sg',
    website: 'https://svdp.sg',
    parishPriest: 'Rev Fr Eugene Vaz',
    assistantPriests: ['Rev Fr Michael Thomas'],
    parishSecretaries: ['Ms Christina Koh'],
    catechismCoordinators: ['Mrs Maria Gomez'],
    youthCoordinators: ['SVDP Youth Core']
  },
  {
    id: 'sg-parish-11',
    parishName: 'Church of the Transfiguration',
    district: 'Serangoon',
    address: '51 Punggol Central, Singapore 828725',
    phone: '6341 9718',
    email: 'secretary@cott.sg',
    website: 'https://cott.sg',
    parishPriest: 'Rev Fr Alphonsus Joseph',
    assistantPriests: ['Rev Fr Kamilus Pantus'],
    parishSecretaries: ['Ms Cheryl Tan', 'Ms Melissa Fernandez'],
    catechismCoordinators: ['Mrs Jennifer Ho'],
    youthCoordinators: ['COTT Youth Team']
  },
  {
    id: 'sg-parish-12',
    parishName: 'Church of St Anthony',
    district: 'North',
    address: '25 Woodlands Ave 1, Singapore 739064',
    phone: '6269 8463',
    email: 'stanthony@catholic.org.sg',
    website: 'https://saint-anthony.org',
    parishPriest: 'Rev Fr Iggy M. Maria Joseph',
    assistantPriests: ['Rev Fr R. A. M. Varghese'],
    parishSecretaries: ['Ms Veronica De Cruz'],
    catechismCoordinators: ['Mr Peter Lim'],
    youthCoordinators: ['St Anthony Youth Council']
  },
  {
    id: 'sg-parish-13',
    parishName: 'Church of St Bernadette',
    district: 'City',
    address: '12 Zion Road, Singapore 247731',
    phone: '6737 3529',
    email: 'stbernadette@catholic.org.sg',
    website: 'https://stbernadette.org.sg',
    parishPriest: 'Rev Fr Kamelus',
    assistantPriests: ['Rev Fr Vance De Querol'],
    parishSecretaries: ['Ms Anna Teo'],
    catechismCoordinators: ['Mrs Rita Tan'],
    youthCoordinators: ['Bernadette Youth Office']
  },
  {
    id: 'sg-parish-14',
    parishName: 'Church of St Joseph (Bukit Timah)',
    district: 'West',
    address: '620 Upper Bukit Timah Road, Singapore 678116',
    phone: '6769 1666',
    email: 'sjbt@catholic.org.sg',
    website: 'https://stjoseph-bt.org.sg',
    parishPriest: 'Rev Fr Christopher Lee',
    assistantPriests: ['Rev Fr Peter Yew'],
    parishSecretaries: ['Ms Theresa Chia'],
    catechismCoordinators: ['Mrs Mary Ann Fernandez'],
    youthCoordinators: ['SJBT Youth Hub']
  },
  {
    id: 'sg-parish-15',
    parishName: 'Church of the Divine Mercy',
    district: 'East',
    address: '19 Pasir Ris Street 72, Singapore 518771',
    phone: '6583 8227',
    email: 'divinemercy@catholic.org.sg',
    website: 'https://divinemercy.sg',
    parishPriest: 'Rev Fr Damian De Wind',
    assistantPriests: ['Rev Fr John Joseph'],
    parishSecretaries: ['Ms Stephanie Kang'],
    catechismCoordinators: ['Mrs Karen Low'],
    youthCoordinators: ['CDM Youth Ministry']
  }
];

// Helper to combine base dataset
export function getDefaultMasterInvitations(): InvitationRecord[] {
  return [...INITIAL_INVITATIONS_DATA, ...INITIAL_PARISH_INVITATIONS];
}

// Firestore operations for Invitations
export async function getAllInvitationsFromFirestore(): Promise<InvitationRecord[]> {
  try {
    const colRef = collection(db, 'invitations');
    const snap = await getDocs(colRef);
    if (snap.empty) {
      return getDefaultMasterInvitations();
    }
    const list: InvitationRecord[] = [];
    snap.forEach((docSnap) => {
      list.push({ id: docSnap.id, ...docSnap.data() } as InvitationRecord);
    });
    return list.sort((a, b) => a.serialNo - b.serialNo);
  } catch (err) {
    console.error('Error getting invitations from Firestore:', err);
    return getDefaultMasterInvitations();
  }
}

export function subscribeToInvitations(callback: (items: InvitationRecord[]) => void) {
  try {
    const colRef = collection(db, 'invitations');
    return onSnapshot(colRef, (snap) => {
      if (snap.empty) {
        callback(getDefaultMasterInvitations());
        return;
      }
      const list: InvitationRecord[] = [];
      snap.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() } as InvitationRecord);
      });
      callback(list.sort((a, b) => a.serialNo - b.serialNo));
    }, (err) => {
      console.error('Error subscribing to invitations:', err);
      callback(getDefaultMasterInvitations());
    });
  } catch (e) {
    console.error('Snapshot failed:', e);
    callback(getDefaultMasterInvitations());
    return () => {};
  }
}

function sanitizeFirestoreRecord<T extends Record<string, any>>(obj: T): Record<string, any> {
  const clean: Record<string, any> = {};
  Object.keys(obj).forEach(key => {
    if (obj[key] !== undefined) {
      clean[key] = obj[key];
    }
  });
  return clean;
}

export async function saveInvitationToFirestore(record: InvitationRecord): Promise<void> {
  try {
    const docRef = doc(db, 'invitations', record.id);
    await setDoc(docRef, sanitizeFirestoreRecord(record), { merge: true });
  } catch (err) {
    console.error('Error saving invitation doc:', err);
  }
}

export async function saveInvitationsBatchToFirestore(records: InvitationRecord[]): Promise<void> {
  try {
    const BATCH_SIZE = 400;
    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const chunk = records.slice(i, i + BATCH_SIZE);
      const batch = writeBatch(db);
      chunk.forEach(rec => {
        const docRef = doc(db, 'invitations', rec.id);
        batch.set(docRef, sanitizeFirestoreRecord(rec), { merge: true });
      });
      await batch.commit();
    }
  } catch (err) {
    console.error('Error batch saving invitations:', err);
    throw err;
  }
}

export async function deleteInvitationFromFirestore(recordId: string): Promise<void> {
  try {
    const docRef = doc(db, 'invitations', recordId);
    await deleteDoc(docRef);
  } catch (err) {
    console.error('Error deleting invitation doc:', err);
  }
}

export async function batchUpdateMultipleInvitationsInFirestore(
  ids: string[],
  updates: Partial<InvitationRecord>
): Promise<void> {
  try {
    const BATCH_SIZE = 400;
    const cleanUpdates = sanitizeFirestoreRecord(updates);
    for (let i = 0; i < ids.length; i += BATCH_SIZE) {
      const chunk = ids.slice(i, i + BATCH_SIZE);
      const batch = writeBatch(db);
      chunk.forEach(id => {
        const docRef = doc(db, 'invitations', id);
        batch.update(docRef, cleanUpdates);
      });
      await batch.commit();
    }
  } catch (err) {
    console.error('Error batch updating invitations:', err);
    throw err;
  }
}

export async function batchDeleteMultipleInvitationsFromFirestore(
  ids: string[]
): Promise<void> {
  try {
    const BATCH_SIZE = 400;
    for (let i = 0; i < ids.length; i += BATCH_SIZE) {
      const chunk = ids.slice(i, i + BATCH_SIZE);
      const batch = writeBatch(db);
      chunk.forEach(id => {
        const docRef = doc(db, 'invitations', id);
        batch.delete(docRef);
      });
      await batch.commit();
    }
  } catch (err) {
    console.error('Error batch deleting invitations:', err);
    throw err;
  }
}

export interface DuplicateCluster {
  keyName: string;
  primaryRecord: InvitationRecord;
  duplicateRecords: InvitationRecord[];
}

export function detectDuplicateRecords(records: InvitationRecord[]): {
  clusters: DuplicateCluster[];
  totalDuplicatesCount: number;
} {
  const activeRecords = records.filter(r => !r.isDeleted);
  const map = new Map<string, InvitationRecord[]>();

  activeRecords.forEach(rec => {
    const key = rec.fullName ? rec.fullName.trim().toLowerCase() : '';
    if (!key) return;
    if (!map.has(key)) {
      map.set(key, []);
    }
    map.get(key)!.push(rec);
  });

  const clusters: DuplicateCluster[] = [];
  let totalDuplicatesCount = 0;

  map.forEach((recs, keyName) => {
    if (recs.length > 1) {
      const sorted = [...recs].sort((a, b) => {
        const scoreA = (a.email ? 2 : 0) + (a.phone ? 1 : 0) + (a.inCharge ? 1 : 0) + (a.category && a.category !== 'CS Participant' ? 1 : 0);
        const scoreB = (b.email ? 2 : 0) + (b.phone ? 1 : 0) + (b.inCharge ? 1 : 0) + (b.category && b.category !== 'CS Participant' ? 1 : 0);
        if (scoreB !== scoreA) return scoreB - scoreA;
        return a.serialNo - b.serialNo;
      });

      const primaryRecord = sorted[0];
      const duplicateRecords = sorted.slice(1);
      clusters.push({ keyName, primaryRecord, duplicateRecords });
      totalDuplicatesCount += duplicateRecords.length;
    }
  });

  return { clusters, totalDuplicatesCount };
}

export async function purgeDuplicatesInFirestore(clusters: DuplicateCluster[]): Promise<{
  purgedCount: number;
  purgedIds: string[];
  updatedPrimaryRecords: InvitationRecord[];
}> {
  const idsToDelete: string[] = [];
  const primaryUpdateRecords: InvitationRecord[] = [];

  clusters.forEach(cluster => {
    const { primaryRecord, duplicateRecords } = cluster;
    idsToDelete.push(...duplicateRecords.map(d => d.id));

    let mergedInCharge = primaryRecord.inCharge || '';
    let mergedCategory = primaryRecord.category || '';
    let mergedEmail = primaryRecord.email || '';
    let mergedPhone = primaryRecord.phone || '';
    let mergedRemarks = primaryRecord.remarks || '';
    let mergedInvitedBy = primaryRecord.invitedBy || '';

    duplicateRecords.forEach(dup => {
      if (!mergedInCharge && dup.inCharge) mergedInCharge = dup.inCharge;
      if ((!mergedCategory || mergedCategory === 'CS Participant') && dup.category && dup.category !== 'CS Participant') mergedCategory = dup.category;
      if (!mergedEmail && dup.email) mergedEmail = dup.email;
      if (!mergedPhone && dup.phone) mergedPhone = dup.phone;
      if (!mergedRemarks && dup.remarks) mergedRemarks = dup.remarks;
      if (!mergedInvitedBy && dup.invitedBy) mergedInvitedBy = dup.invitedBy;
    });

    primaryUpdateRecords.push({
      ...primaryRecord,
      inCharge: mergedInCharge,
      category: mergedCategory,
      email: mergedEmail,
      phone: mergedPhone,
      remarks: mergedRemarks,
      invitedBy: mergedInvitedBy
    });
  });

  if (idsToDelete.length > 0) {
    await batchDeleteMultipleInvitationsFromFirestore(idsToDelete);
  }

  if (primaryUpdateRecords.length > 0) {
    await saveInvitationsBatchToFirestore(primaryUpdateRecords);
  }

  return {
    purgedCount: idsToDelete.length,
    purgedIds: idsToDelete,
    updatedPrimaryRecords: primaryUpdateRecords
  };
}

// Invitation Contact Details Visibility Settings
export interface InvitationSettings {
  allowNonMainAdminsToViewContacts: boolean;
  appsScriptUrl?: string;
  customCategories?: string[];
  inChargeOptions?: string[]; // Dynamic in-charge names managed by Main Admin
  statusOptions?: string[];   // Dynamic status options managed by Main Admin
  customInChargeOptions?: string[];
  customStatuses?: string[];
}

export const DEFAULT_IN_CHARGE_OPTIONS: string[] = [
  'Joel K Jose',
  'Jilu Mathew',
  'Prijo Joy',
  'Elba Binu',
  'Shoyal',
  'Kiran Prakash',
  'Sijumon',
  'Albin - NT',
  'Vintu - Family Team'
];

export const DEFAULT_INVITATION_STATUSES: string[] = [
  'not_invited',
  'email_sent',
  'whatsapp_sent',
  'accepted',
  'declined',
  'attended',
  'REGISTERED'
];

export const DEFAULT_INVITATION_CATEGORIES = [
  'CS Participant',
  'Youth',
  'Youth/Student',
  'Family',
  'National Team',
  'Jubilee Team',
  'Intercession Team',
  'Formation Team',
  'Music Ministry',
  'Mission Team',
  'ProLife Team',
  'Parish Priest',
  'Church Secretary',
  'Catechism Coordinator',
  'Parish Coordinator',
  'VIP Guest',
  'Other'
];

export async function getInvitationSettingsFromFirestore(): Promise<InvitationSettings> {
  try {
    const docRef = doc(db, 'settings', 'invitationSettings');
    const snap = await getDocs(collection(db, 'settings'));
    let foundSettings = { allowNonMainAdminsToViewContacts: false };
    snap.forEach(d => {
      if (d.id === 'invitationSettings') {
        foundSettings = d.data() as InvitationSettings;
      }
    });
    return foundSettings;
  } catch (err) {
    return { allowNonMainAdminsToViewContacts: false };
  }
}

export async function saveInvitationSettingsToFirestore(settings: InvitationSettings): Promise<void> {
  try {
    const docRef = doc(db, 'settings', 'invitationSettings');
    await setDoc(docRef, settings, { merge: true });
  } catch (err) {
    console.error('Error saving invitation settings:', err);
  }
}

// Helper to generate standardized official invitation message
export function composePersonalizedInviteMessage(
  record: Partial<InvitationRecord>,
  channel: 'email' | 'whatsapp' = 'email',
  siteContent?: SiteContentData,
  _overrideKeywords?: string
): { subject: string; bodyText: string; htmlBody: string; whatsappText: string } {
  const name = record.fullName || 'Valued Guest';
  const venue = siteContent?.hqAddress || 'Caritas Agape Village, Lorong 8 Toa Payoh, Singapore';
  const remarksText = (record.remarks || '').trim();

  const subject = `[Official Invitation] GRACIA - 25 Years of Grace Celebration | ${name}`;

  const whatsappText = `*GRACIA - Official Jubilee Invitation* ✝️✨\n\n` +
    `Dear ${name},\n\n` +
    `We warmly invite you to join Jesus Youth Singapore as we mark 25 years of grace, faith, and fellowship in Christ at GRACIA!\n\n` +
    (remarksText ? `📌 *Invitation Remarks / Code:* ${remarksText}\n\n` : '') +
    `✝️ *Special Announcement for GRACIA Jubilee Conference*\n` +
    `We are blessed to share that the Apostolic Penitentiary has officially granted a *Partial Indulgence* to all who attend the Thanksgiving Mass celebrated by His Eminence Cardinal William Goh! 🙏✨\n` +
    `Come with an open heart to receive this gift of grace.\n\n` +
    `📍 *Venue:* ${venue}\n` +
    `📅 *Date:* October 10 & 11, 2026\n` +
    `✨ *Events:* GRACIA Jubilee Conference & GRACIA Musical Concert\n\n` +
    `📲 *Register / Details:* singapore.jesusyouth.org\n\n` +
    `With prayers & warm regards,\n` +
    `*GRACIA Organizing Committee*\n` +
    `Jesus Youth Singapore`;

  const htmlBody = `
    <div style="background-color: #f5edf7; padding: 24px 12px; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #2D1836; max-width: 600px; margin: 0 auto;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; margin: 0 auto; width: 100%; background-color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2d2e8; box-shadow: 0 10px 30px rgba(40,18,44,0.08);">
        
        <!-- HEADER HERO BANNER -->
        <tr>
          <td style="padding: 0;">
            <div style="background-color: #120924; padding: 32px 24px; text-align: center;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <!-- LEFT: JESUS YOUTH SINGAPORE LOGO -->
                  <td align="left" width="60" valign="middle">
                    <img 
                      src="https://gracia2026.vercel.app/jysg_logo.png" 
                      alt="Jesus Youth Singapore" 
                      width="54" 
                      style="display: block; max-width: 54px; height: auto;" 
                    />
                  </td>

                  <!-- CENTER: EVENT TITLES & MOTTO -->
                  <td align="center" valign="middle">
                    <div style="color: #94a3b8; font-size: 11px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase;">
                      JESUS YOUTH SINGAPORE
                    </div>
                    <div style="font-size: 32px; font-weight: 900; letter-spacing: 4px; margin: 4px 0;">
                      <span style="color: #6366f1;">G</span><span style="color: #ec4899;">R</span><span style="color: #06b6d4;">A</span><span style="color: #eab308;">C</span><span style="color: #8b5cf6;">I</span><span style="color: #ef4444;">A</span>
                    </div>
                    <div style="color: #ffffff; font-size: 11px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase;">
                      25 YEARS OF GRACE IN SINGAPORE
                    </div>
                    <div style="color: #f59e0b; font-size: 9px; font-weight: 700; letter-spacing: 2px; margin-top: 4px; text-transform: uppercase;">
                      FAITHFUL WITNESS. JOYFUL MISSIONARY.
                    </div>
                  </td>

                  <!-- RIGHT: JUBILEE 25TH LOGO -->
                  <td align="right" width="60" valign="middle">
                    <img 
                      src="https://gracia2026.vercel.app/jysg_jubilee_logo.png" 
                      alt="25 Years of Grace Jubilee" 
                      width="48" 
                      style="display: block; max-width: 48px; height: auto;" 
                    />
                  </td>
                </tr>
              </table>
            </div>
          </td>
        </tr>

        <!-- DATE & VENUE SUB-BANNER -->
        <tr>
          <td style="background-color: #FEF3C7; border-bottom: 2px solid #E8B400; padding: 12px 20px; text-align: center;">
            <span style="font-size: 12px; font-weight: 800; color: #78350F; text-transform: uppercase; letter-spacing: 1px;">
              📅 OCTOBER 10 & 11, 2026 &nbsp;|&nbsp; AGAPE VILLAGE, SINGAPORE
            </span>
          </td>
        </tr>

        <!-- BODY CONTENT -->
        <tr>
          <td style="padding: 32px 28px 24px 28px; font-size: 15px; line-height: 1.7; color: #2D1836;">
            <p style="font-size: 18px; color: #1C0D1E; font-weight: 700; margin-top: 0; margin-bottom: 16px;">
              Dear ${name},
            </p>
            
            <p style="margin: 0 0 16px 0;">
              By the abundant grace of God, <strong>Jesus Youth Singapore</strong> is marking <strong>25 Years of Grace</strong>. We have the honor and privilege of extending our official invitation to you for this landmark celebration of faith, praise, and fellowship.
            </p>

            ${remarksText ? `
            <!-- REMARKS & INVITATION CODE CALLOUT BOX -->
            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #fefce8; border: 1px dashed #E8B400; border-left: 5px solid #d97706; border-radius: 12px; padding: 18px; margin: 20px 0;">
              <tr>
                <td>
                  <div style="font-size: 12px; font-weight: 800; color: #92400e; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px;">
                    📌 Invitation Remarks & Access Code / Notes
                  </div>
                  <div style="font-size: 15px; font-weight: 800; color: #1C0D1E; font-family: monospace; letter-spacing: 0.5px; line-height: 1.5;">
                    ${remarksText}
                  </div>
                </td>
              </tr>
            </table>
            ` : ''}

            <p style="margin: 0 0 20px 0;">
              GRACIA brings together our Catholic youth, families, ministry leaders, and partners across Singapore for two enriching days of Eucharistic celebration, inspirational sessions, and a grand Musical Concert.
            </p>

            <!-- SPECIAL SPIRITUAL ANNOUNCEMENT CALLOUT BOX -->
            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #fdf2f8; border: 1px solid #fbcfe8; border-left: 4px solid #E8B400; border-radius: 12px; padding: 20px; margin: 24px 0;">
              <tr>
                <td>
                  <div style="font-size: 13px; font-weight: 800; color: #78350F; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">
                    ✝️ A Special Blessing for Our Jubilee
                  </div>
                  <p style="margin: 0 0 8px 0; font-size: 14px; color: #1C0D1E; line-height: 1.6; font-weight: 600;">
                    We are extremely overjoyed to share that the Apostolic Penitentiary has granted a <strong>Partial Indulgence</strong> to all who attend the Thanksgiving Mass to be celebrated by His Eminence Cardinal William Goh during the Gracia Jubilee Conference.
                  </p>
                  <p style="margin: 0; font-size: 13px; color: #53325c; line-height: 1.5;">
                    We warmly invite you to join us in full and active participation, with prayerful preparation, as we open our hearts to receive this extraordinary grace of the Jubilee.
                  </p>
                </td>
              </tr>
            </table>

            <!-- EVENT DETAILS CARD -->
            <div style="background-color: #faf5fc; border: 1px solid #e9d8f0; border-left: 4px solid #E8B400; border-radius: 12px; padding: 20px; margin: 24px 0;">
              <h3 style="color: #78350F; margin-top: 0; margin-bottom: 14px; font-size: 13px; letter-spacing: 1px; text-transform: uppercase; font-weight: 800;">
                ✨ EVENT SUMMARY
              </h3>
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="font-size: 14px; color: #2D1836; border-collapse: collapse;">
                <tr>
                  <td style="padding: 5px 0; font-weight: 700; width: 110px; color: #53325c; vertical-align: top;">Dates:</td>
                  <td style="padding: 5px 0; font-weight: 600; color: #1C0D1E;">October 10 & 11, 2026</td>
                </tr>
                <tr>
                  <td style="padding: 5px 0; font-weight: 700; color: #53325c; vertical-align: top;">Venue:</td>
                  <td style="padding: 5px 0; color: #2D1836;">${venue}</td>
                </tr>
                ${remarksText ? `
                <tr>
                  <td style="padding: 5px 0; font-weight: 700; color: #53325c; vertical-align: top;">Remarks/Code:</td>
                  <td style="padding: 5px 0; font-weight: 700; color: #78350F;">${remarksText}</td>
                </tr>
                ` : ''}
                <tr>
                  <td style="padding: 5px 0; font-weight: 700; color: #53325c; vertical-align: top;">Mass:</td>
                  <td style="padding: 5px 0; color: #2D1836;">Thanksgiving Mass (Celebrated by Cardinal William Goh • Partial Indulgence)</td>
                </tr>
                <tr>
                  <td style="padding: 5px 0; font-weight: 700; color: #53325c; vertical-align: top;">Program:</td>
                  <td style="padding: 5px 0; color: #2D1836;">GRACIA Jubilee Conference & GRACIA Musical Concert</td>
                </tr>
              </table>
            </div>

            <!-- RSVP BUTTON -->
            <div style="text-align: center; margin: 32px 0 24px 0;">
              <a href="https://singapore.jesusyouth.org/gracia" target="_blank" style="background: linear-gradient(135deg, #28122C 0%, #3D1842 100%); color: #ffffff; border: 2px solid #E8B400; text-decoration: none; font-weight: 800; font-size: 15px; padding: 14px 32px; border-radius: 30px; display: inline-block; box-shadow: 0 4px 16px rgba(40, 18, 44, 0.2); letter-spacing: 0.5px; text-transform: uppercase;">
                RSVP & Confirm Attendance
              </a>
            </div>

            <div style="border-top: 1px solid #e2d2e8; padding-top: 20px; margin-top: 28px;">
              <p style="margin: 0 0 4px 0; font-size: 14px; color: #53325c;">With prayers & warm regards,</p>
              <p style="margin: 0 0 2px 0; font-size: 15px; font-weight: 800; color: #1C0D1E;">GRACIA Organizing Committee</p>
              <p style="margin: 0; font-size: 13px; color: #6b4d75; font-weight: 500;">Jesus Youth Singapore</p>
            </div>
          </td>
        </tr>

        <!-- FOOTER -->
        <tr>
          <td style="background-color: #f0e6f5; padding: 20px 24px; text-align: center; border-top: 1px solid #e2d2e8; font-size: 12px; color: #53325c;">
            <p style="margin: 0 0 4px 0; font-weight: 700; color: #1C0D1E;">Jesus Youth Singapore · Catholic Youth Movement</p>
            <p style="margin: 0 0 8px 0; font-weight: 600;">Email: jysg25@jesusyouth.org | Web: singapore.jesusyouth.org</p>
            <p style="margin: 0; color: #855b00; font-style: italic; font-size: 11px;">"Rejoice always, pray continually, give thanks in all circumstances" — 1 Thess 5:16-18</p>
          </td>
        </tr>

      </table>
    </div>
  `;

  const bodyText = `Dear ${name},\n\n` +
    `By the abundant grace of God, Jesus Youth Singapore is marking 25 Years of Grace. We have the honor and privilege of extending our official invitation to you for GRACIA.\n\n` +
    (remarksText ? `Remarks / Code: ${remarksText}\n\n` : '') +
    `Venue: ${venue}\n` +
    `Date: October 10 & 11, 2026\n\n` +
    `RSVP & Confirm Attendance at: https://singapore.jesusyouth.org/gracia\n\n` +
    `With prayers & warm regards,\n` +
    `GRACIA Organizing Committee\n` +
    `Jesus Youth Singapore`;

  return { subject, bodyText, htmlBody, whatsappText };
}
