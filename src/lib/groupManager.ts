import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';

export interface GroupColorInfo {
  id: string;
  name: string;
  badgeLabel: string;
  colorHex: string;
  badgeBg: string;
  badgeText: string;
  borderClass: string;
  emoji: string;
}

export interface GroupAllocationSettings {
  maxMembersPerGroup: number; // default 15
  separateFamilyMembers: boolean; // default true
  ageGroupCriteria: 'mixed' | 'kids_separate' | 'teens_separate' | 'young_adults_separate';
  genderCriteria: 'mixed' | 'same_gender' | 'balanced';
  customGroupNames?: Record<string, string>; // groupId -> custom display name
  manualAssignments?: Record<string, string>; // passId or participantKey -> groupId
  customGroups?: GroupColorInfo[]; // Full list of active groups if customized/expanded
}

export const EXTRA_SAINT_PRESETS: Array<{ name: string; emoji: string; colorHex: string; badgeBg: string; badgeText: string; borderClass: string }> = [
  { name: 'St. Thomas', emoji: '✨', colorHex: '#F59E0B', badgeBg: 'bg-amber-100 dark:bg-amber-950/80', badgeText: 'text-amber-800 dark:text-amber-200', borderClass: 'border-amber-400 dark:border-amber-700' },
  { name: 'St. Luke', emoji: '🕯️', colorHex: '#10B981', badgeBg: 'bg-emerald-100 dark:bg-emerald-950/80', badgeText: 'text-emerald-800 dark:text-emerald-200', borderClass: 'border-emerald-400 dark:border-emerald-700' },
  { name: 'St. Mark', emoji: '🦁', colorHex: '#D97706', badgeBg: 'bg-yellow-100 dark:bg-yellow-950/80', badgeText: 'text-yellow-800 dark:text-yellow-200', borderClass: 'border-yellow-400 dark:border-yellow-700' },
  { name: 'St. Matthew', emoji: '📜', colorHex: '#8B5CF6', badgeBg: 'bg-purple-100 dark:bg-purple-950/80', badgeText: 'text-purple-800 dark:text-purple-200', borderClass: 'border-purple-400 dark:border-purple-700' },
  { name: 'St. Augustine', emoji: '🔥', colorHex: '#EF4444', badgeBg: 'bg-red-100 dark:bg-red-950/80', badgeText: 'text-red-800 dark:text-red-200', borderClass: 'border-red-400 dark:border-red-700' },
  { name: 'St. Benedict', emoji: '🛡️', colorHex: '#64748B', badgeBg: 'bg-slate-200 dark:bg-slate-800', badgeText: 'text-slate-800 dark:text-slate-200', borderClass: 'border-slate-400 dark:border-slate-600' },
  { name: 'St. Dominic', emoji: '⚜️', colorHex: '#0284C7', badgeBg: 'bg-sky-100 dark:bg-sky-950/80', badgeText: 'text-sky-800 dark:text-sky-200', borderClass: 'border-sky-400 dark:border-sky-700' },
  { name: 'St. Ignatius', emoji: '⚔️', colorHex: '#B91C1C', badgeBg: 'bg-rose-200 dark:bg-rose-950', badgeText: 'text-rose-900 dark:text-rose-200', borderClass: 'border-rose-500 dark:border-rose-700' },
  { name: 'St. Monica', emoji: '🕊️', colorHex: '#EC4899', badgeBg: 'bg-pink-100 dark:bg-pink-950/80', badgeText: 'text-pink-800 dark:text-pink-200', borderClass: 'border-pink-400 dark:border-pink-700' },
  { name: 'St. Cecilia', emoji: '🎵', colorHex: '#A855F7', badgeBg: 'bg-fuchsia-100 dark:bg-fuchsia-950/80', badgeText: 'text-fuchsia-800 dark:text-fuchsia-200', borderClass: 'border-fuchsia-400 dark:border-fuchsia-700' },
  { name: 'St. Joan', emoji: '👑', colorHex: '#EAB308', badgeBg: 'bg-yellow-200 dark:bg-yellow-900/80', badgeText: 'text-yellow-900 dark:text-yellow-100', borderClass: 'border-yellow-500 dark:border-yellow-600' },
  { name: 'St. Rita', emoji: '🌹', colorHex: '#BE123C', badgeBg: 'bg-rose-100 dark:bg-rose-900/80', badgeText: 'text-rose-800 dark:text-rose-200', borderClass: 'border-rose-400 dark:border-rose-700' },
  { name: 'St. Lawrence', emoji: '💎', colorHex: '#06B6D4', badgeBg: 'bg-cyan-100 dark:bg-cyan-950/80', badgeText: 'text-cyan-800 dark:text-cyan-200', borderClass: 'border-cyan-400 dark:border-cyan-700' },
  { name: 'St. Agnes', emoji: '🐑', colorHex: '#F472B6', badgeBg: 'bg-pink-50 dark:bg-pink-950/60', badgeText: 'text-pink-700 dark:text-pink-300', borderClass: 'border-pink-300 dark:border-pink-800' },
  { name: 'St. Sebastian', emoji: '🎯', colorHex: '#DC2626', badgeBg: 'bg-orange-100 dark:bg-orange-950/80', badgeText: 'text-orange-900 dark:text-orange-200', borderClass: 'border-orange-400 dark:border-orange-700' },
  { name: 'St. Veronica', emoji: '✝️', colorHex: '#7C3AED', badgeBg: 'bg-violet-100 dark:bg-violet-950/80', badgeText: 'text-violet-800 dark:text-violet-200', borderClass: 'border-violet-400 dark:border-violet-700' },
  { name: 'St. George', emoji: '🛡️', colorHex: '#2563EB', badgeBg: 'bg-blue-200 dark:bg-blue-900/80', badgeText: 'text-blue-900 dark:text-blue-100', borderClass: 'border-blue-400 dark:border-blue-700' },
  { name: 'St. Christopher', emoji: '🚶‍♂️', colorHex: '#059669', badgeBg: 'bg-teal-200 dark:bg-teal-900/80', badgeText: 'text-teal-900 dark:text-teal-100', borderClass: 'border-teal-400 dark:border-teal-700' },
  { name: 'St. Stephen', emoji: '⭐', colorHex: '#EAB308', badgeBg: 'bg-amber-200 dark:bg-amber-900/80', badgeText: 'text-amber-900 dark:text-amber-100', borderClass: 'border-amber-400 dark:border-amber-700' },
  { name: 'St. Catherine', emoji: '🌸', colorHex: '#DB2777', badgeBg: 'bg-pink-200 dark:bg-pink-900/80', badgeText: 'text-pink-900 dark:text-pink-100', borderClass: 'border-pink-400 dark:border-pink-700' }
];

export function createNewGroups(currentList: GroupColorInfo[], countToAdd: number): GroupColorInfo[] {
  const newList = [...currentList];
  for (let i = 0; i < countToAdd; i++) {
    const nextIdx = newList.length;
    const presetIdx = (nextIdx - DEFAULT_GROUP_COLORS.length) % EXTRA_SAINT_PRESETS.length;
    const preset = EXTRA_SAINT_PRESETS[presetIdx >= 0 ? presetIdx : 0] || EXTRA_SAINT_PRESETS[0];
    const uniqueId = `group-custom-${nextIdx + 1}-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 5)}`;
    const saintName = nextIdx >= DEFAULT_GROUP_COLORS.length && (nextIdx - DEFAULT_GROUP_COLORS.length) < EXTRA_SAINT_PRESETS.length
      ? EXTRA_SAINT_PRESETS[nextIdx - DEFAULT_GROUP_COLORS.length].name
      : preset.name;

    newList.push({
      id: uniqueId,
      name: saintName,
      badgeLabel: `${preset.emoji} ${saintName}`,
      colorHex: preset.colorHex,
      badgeBg: preset.badgeBg,
      badgeText: preset.badgeText,
      borderClass: preset.borderClass,
      emoji: preset.emoji
    });
  }
  return newList;
}

export function getAllGroupColors(settings?: Partial<GroupAllocationSettings>): GroupColorInfo[] {
  const baseList = settings?.customGroups && settings.customGroups.length > 0
    ? settings.customGroups
    : DEFAULT_GROUP_COLORS;

  return baseList.map((group) => {
    const customName = settings?.customGroupNames?.[group.id];
    if (customName) {
      return {
        ...group,
        name: customName,
        badgeLabel: `${group.emoji} ${customName}`
      };
    }
    return group;
  });
}

export const DEFAULT_GROUP_COLORS: GroupColorInfo[] = [
  {
    id: 'group-red',
    name: 'St. Peter',
    badgeLabel: '🔴 St. Peter',
    colorHex: '#DC2626',
    badgeBg: 'bg-red-100 dark:bg-red-950/80',
    badgeText: 'text-red-700 dark:text-red-300',
    borderClass: 'border-red-300 dark:border-red-800',
    emoji: '🔴'
  },
  {
    id: 'group-blue',
    name: 'St. Michael',
    badgeLabel: '🔵 St. Michael',
    colorHex: '#2563EB',
    badgeBg: 'bg-blue-100 dark:bg-blue-950/80',
    badgeText: 'text-blue-700 dark:text-blue-300',
    borderClass: 'border-blue-300 dark:border-blue-800',
    emoji: '🔵'
  },
  {
    id: 'group-green',
    name: 'St. Francis',
    badgeLabel: '🟢 St. Francis',
    colorHex: '#059669',
    badgeBg: 'bg-emerald-100 dark:bg-emerald-950/80',
    badgeText: 'text-emerald-700 dark:text-emerald-300',
    borderClass: 'border-emerald-300 dark:border-emerald-800',
    emoji: '🟢'
  },
  {
    id: 'group-gold',
    name: 'St. Joseph',
    badgeLabel: '🟡 St. Joseph',
    colorHex: '#D97706',
    badgeBg: 'bg-amber-100 dark:bg-amber-950/80',
    badgeText: 'text-amber-700 dark:text-amber-300',
    borderClass: 'border-amber-300 dark:border-amber-800',
    emoji: '🟡'
  },
  {
    id: 'group-purple',
    name: 'St. Paul',
    badgeLabel: '🟣 St. Paul',
    colorHex: '#9333EA',
    badgeBg: 'bg-purple-100 dark:bg-purple-950/80',
    badgeText: 'text-purple-700 dark:text-purple-300',
    borderClass: 'border-purple-300 dark:border-purple-800',
    emoji: '🟣'
  },
  {
    id: 'group-teal',
    name: 'St. Jude',
    badgeLabel: '🩵 St. Jude',
    colorHex: '#0D9488',
    badgeBg: 'bg-teal-100 dark:bg-teal-950/80',
    badgeText: 'text-teal-700 dark:text-teal-300',
    borderClass: 'border-teal-300 dark:border-teal-800',
    emoji: '🩵'
  },
  {
    id: 'group-orange',
    name: 'St. Anthony',
    badgeLabel: '🟠 St. Anthony',
    colorHex: '#EA580C',
    badgeBg: 'bg-orange-100 dark:bg-orange-950/80',
    badgeText: 'text-orange-700 dark:text-orange-300',
    borderClass: 'border-orange-300 dark:border-orange-800',
    emoji: '🟠'
  },
  {
    id: 'group-pink',
    name: 'St. Teresa',
    badgeLabel: '🩷 St. Teresa',
    colorHex: '#E11D48',
    badgeBg: 'bg-rose-100 dark:bg-rose-950/80',
    badgeText: 'text-rose-700 dark:text-rose-300',
    borderClass: 'border-rose-300 dark:border-rose-800',
    emoji: '🩷'
  },
  {
    id: 'group-indigo',
    name: 'St. John',
    badgeLabel: '🫐 St. John',
    colorHex: '#4F46E5',
    badgeBg: 'bg-indigo-100 dark:bg-indigo-950/80',
    badgeText: 'text-indigo-700 dark:text-indigo-300',
    borderClass: 'border-indigo-300 dark:border-indigo-800',
    emoji: '🫐'
  },
  {
    id: 'group-cyan',
    name: 'St. Clare',
    badgeLabel: '🌊 St. Clare',
    colorHex: '#0891B2',
    badgeBg: 'bg-cyan-100 dark:bg-cyan-950/80',
    badgeText: 'text-cyan-700 dark:text-cyan-300',
    borderClass: 'border-cyan-300 dark:border-cyan-800',
    emoji: '🌊'
  },
  {
    id: 'group-bronze',
    name: 'St. Patrick',
    badgeLabel: '🟤 St. Patrick',
    colorHex: '#92400E',
    badgeBg: 'bg-stone-100 dark:bg-stone-900',
    badgeText: 'text-stone-700 dark:text-stone-300',
    borderClass: 'border-stone-300 dark:border-stone-700',
    emoji: '🟤'
  },
  {
    id: 'group-silver',
    name: 'St. Bernadette',
    badgeLabel: '🩶 St. Bernadette',
    colorHex: '#475569',
    badgeBg: 'bg-slate-100 dark:bg-slate-900',
    badgeText: 'text-slate-700 dark:text-slate-300',
    borderClass: 'border-slate-300 dark:border-slate-700',
    emoji: '🩶'
  }
];

export const DEFAULT_SETTINGS: GroupAllocationSettings = {
  maxMembersPerGroup: 15,
  separateFamilyMembers: true,
  ageGroupCriteria: 'mixed',
  genderCriteria: 'mixed',
  customGroupNames: {},
  manualAssignments: {}
};

/**
 * Assigns a group color info deterministically to a participant.
 * Guaranteed that family members (different memberIndex) get different group colors!
 */
export function getParticipantGroupColor(
  registrationSeed: string | undefined,
  memberIndex: number = 0,
  participantName: string = '',
  settings?: Partial<GroupAllocationSettings>,
  passId?: string
): GroupColorInfo {
  const mergedSettings = { ...DEFAULT_SETTINGS, ...settings };
  const allGroups = getAllGroupColors(mergedSettings);

  // Check manual assignment override first
  if (passId && mergedSettings.manualAssignments && mergedSettings.manualAssignments[passId]) {
    const assignedId = mergedSettings.manualAssignments[passId];
    const found = allGroups.find(g => g.id === assignedId);
    if (found) {
      return found;
    }
  }

  // Calculate deterministic seed from registrationSeed or name
  const cleanSeed = (registrationSeed || participantName || 'GRACIA').trim();
  let hash = 0;
  for (let i = 0; i < cleanSeed.length; i++) {
    hash = (hash << 5) - hash + cleanSeed.charCodeAt(i);
    hash |= 0;
  }
  const posHash = Math.abs(hash);

  const totalGroups = allGroups.length || 1;
  
  // Base group for the primary registration:
  const baseGroupIdx = posHash % totalGroups;

  // Shift offset for family members to guarantee no two family members share a group color!
  const finalGroupIdx = (baseGroupIdx + memberIndex) % totalGroups;
  return allGroups[finalGroupIdx];
}

/**
 * Fetch group allocation settings from Firestore
 */
export async function fetchGroupSettings(): Promise<GroupAllocationSettings> {
  try {
    const docRef = doc(db, 'settings', 'group_allocation');
    const snapshot = await getDoc(docRef);
    if (snapshot.exists()) {
      return { ...DEFAULT_SETTINGS, ...snapshot.data() } as GroupAllocationSettings;
    }
  } catch (err) {
    console.warn('Could not fetch group settings from Firestore, using default settings:', err);
  }
  return DEFAULT_SETTINGS;
}

/**
 * Save group allocation settings to Firestore
 */
export async function saveGroupSettings(settings: GroupAllocationSettings): Promise<boolean> {
  try {
    const docRef = doc(db, 'settings', 'group_allocation');
    await setDoc(docRef, settings, { merge: true });
    return true;
  } catch (err) {
    console.error('Error saving group settings:', err);
    return false;
  }
}
