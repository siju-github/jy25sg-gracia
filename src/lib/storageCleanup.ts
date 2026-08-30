export const REGISTRATION_CLEANUP_BROADCAST_CHANNEL = 'gracia_registration_cleanup';
export const REGISTRATION_CLEANUP_STORAGE_KEY = 'gracia_registration_cleanup_event';

export type RegistrationCleanupPayload = {
  type: 'registration_deleted';
  deletedAt: string;
  ids: string[];
  passIds: string[];
  refs: string[];
  emails: string[];
  phones: string[];
};

const REGISTRATION_STORAGE_PATTERNS = [
  /^draft_registration_/, 
  /^gracia_paid_/, 
  /^payment_status_/, 
  /^gracia_step_/, 
  /^step_/, 
  /^gracia_payment_status_/, 
  /^registration_status_/, 
  /^registration_step$/, 
  /^payment_status$/, 
  /^registration_status$/, 
  /^gracia_paid$/, 
  /^draft_registration_latest$/, 
  /^registration_draft$/, 
  /^form_cache$/, 
  /^gracia_registration_cleanup_event$/
];

const GLOBAL_CLEANUP_KEYS = [
  'draft_registration_latest',
  'registration_draft',
  'form_cache',
  'payment_status',
  'registration_status',
  'registration_step',
  'gracia_paid',
  'gracia_registration_cleanup_event',
  'gracia_payment_status'
];

const normalizeIdentifier = (value?: string) => (value || '').trim();

const clearMatchingStorage = (storage: Storage, identifiers: string[]) => {
  if (!storage) return;

  const keysToRemove = new Set<string>();
  for (let i = 0; i < storage.length; i += 1) {
    const key = storage.key(i);
    if (!key) continue;

    const isExplicitKey = GLOBAL_CLEANUP_KEYS.includes(key) || identifiers.some(id => key === id || key.includes(id));
    const isPatternKey = REGISTRATION_STORAGE_PATTERNS.some((pattern) => pattern.test(key));

    if (isExplicitKey || isPatternKey) {
      keysToRemove.add(key);
    }
  }

  keysToRemove.forEach((key) => {
    try {
      storage.removeItem(key);
    } catch (error) {
      console.warn('Failed to clear storage key during registration cleanup:', key, error);
    }
  });
};

export const clearRegistrationStorageState = (record?: {
  id?: string;
  passId?: string;
  paymentReference?: string;
  email?: string;
  phone?: string;
} | null) => {
  const ids = [record?.id, record?.passId, record?.paymentReference].filter(Boolean).map(normalizeIdentifier);
  const emails = [record?.email].filter(Boolean).map((email) => email.trim().toLowerCase());
  const phones = [record?.phone].filter(Boolean).map((phone) => phone.replace(/\D/g, ''));

  const identifiers = Array.from(new Set([
    ...ids,
    ...emails.map((email) => `EMAIL:${email}`),
    ...phones.map((phone) => `PHONE:${phone}`),
    ...GLOBAL_CLEANUP_KEYS
  ])).filter(Boolean);

  if (typeof window !== 'undefined') {
    try {
      clearMatchingStorage(window.localStorage, identifiers);
      clearMatchingStorage(window.sessionStorage, identifiers);
    } catch (error) {
      console.warn('Registration storage cleanup failed for local/session storage:', error);
    }

    const payload: RegistrationCleanupPayload = {
      type: 'registration_deleted',
      deletedAt: new Date().toISOString(),
      ids: ids,
      passIds: [record?.passId].filter(Boolean).map(normalizeIdentifier),
      refs: [record?.paymentReference].filter(Boolean).map(normalizeIdentifier),
      emails: emails,
      phones: phones
    };

    try {
      window.localStorage.setItem(REGISTRATION_CLEANUP_STORAGE_KEY, JSON.stringify(payload));
    } catch (error) {
      console.warn('Failed to broadcast cleanup signal to localStorage:', error);
    }

    try {
      window.dispatchEvent(new CustomEvent('gracia-registration-cleanup', { detail: payload }));
    } catch (error) {
      console.warn('Failed to dispatch registration cleanup event:', error);
    }

    if ('BroadcastChannel' in window) {
      try {
        const channel = new BroadcastChannel(REGISTRATION_CLEANUP_BROADCAST_CHANNEL);
        channel.postMessage(payload);
        channel.close();
      } catch (error) {
        console.warn('Failed to notify StorageChannel cleanup listeners:', error);
      }
    }
  }

  return true;
};
