/**
 * Validates whether an email address string is strictly compliant with RFC 5321 syntax.
 * Rejects invalid domain/local characters (e.g. #, spaces, angle brackets) and invalid TLDs.
 */
export function isValidEmail(email: string | undefined | null): boolean {
  if (!email || typeof email !== 'string') return false;
  const trimmed = email.trim();
  if (trimmed.length < 5 || trimmed.length > 254) return false;

  // RFC 5321 strict email syntax check
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  if (!emailRegex.test(trimmed)) return false;

  const parts = trimmed.split('@');
  if (parts.length !== 2) return false;
  const [local, domain] = parts;
  if (!local || !domain) return false;

  // Domain labels cannot contain '#' or '_' or invalid characters
  if (/[#_<>()[\]\\,;:\s"]/.test(domain)) return false;

  const domainParts = domain.split('.');
  if (domainParts.length < 2) return false;

  const tld = domainParts[domainParts.length - 1];
  if (!tld || tld.length < 2 || !/^[a-zA-Z]+$/.test(tld)) return false;

  return true;
}

/**
 * Utility functions for formatting and string manipulations.
 */

/**
 * Converts any string into standard Proper Case (Title Case), handling hyphens, apostrophes, and multiple spaces.
 * Examples:
 * - "SIJUMON ABRAHAM" -> "Sijumon Abraham"
 * - "mary-jane o'connor" -> "Mary-Jane O'Connor"
 * - "JOHN DOE" -> "John Doe"
 */
export function toProperCase(str: string | undefined | null): string {
  if (!str) return '';
  return str
    .trim()
    .split(/\s+/)
    .map(word => {
      if (!word) return '';
      return word
        .split('-')
        .map(part => {
          if (!part) return '';
          return part
            .split("'")
            .map(subPart => {
              if (!subPart) return '';
              return subPart.charAt(0).toUpperCase() + subPart.slice(1).toLowerCase();
            })
            .join("'");
        })
        .join('-');
    })
    .join(' ');
}

/**
 * Determines whether a specific delegate pass (primary or additional attendee) is checked in
 * across all admin views and participant pass portals.
 */
export function isDelegatePassCheckedIn(
  reg: any,
  passId: string,
  passName?: string,
  isPrimary?: boolean,
  delegateId?: string
): boolean {
  if (!reg) return false;
  const scannedList = Array.isArray(reg.scannedPassIds) ? reg.scannedPassIds : [];

  if (scannedList.length > 0) {
    const passIdLower = (passId || '').toLowerCase().trim();
    const idLower = (delegateId || '').toLowerCase().trim();
    const nameLower = (passName || '').toLowerCase().trim();
    const regIdLower = (reg.id || '').toLowerCase().trim();

    return scannedList.some(sp => {
      const spLower = (sp || '').toLowerCase().trim();
      if (!spLower) return false;
      if (spLower === 'all' || (regIdLower && spLower === `${regIdLower}-all`)) return true;
      if (passIdLower && spLower === passIdLower) return true;
      if (idLower && spLower === idLower) return true;
      if (nameLower && spLower === nameLower) return true;
      if (passIdLower && spLower === `${regIdLower}-pax-${passIdLower}`) return true;
      if (idLower && spLower === `${regIdLower}-pax-${idLower}`) return true;
      if (nameLower && spLower === `${regIdLower}-pax-${nameLower}`) return true;
      if (isPrimary && (spLower === 'primary' || spLower === `${regIdLower}-pax-primary` || (regIdLower && spLower === regIdLower))) return true;
      return false;
    });
  }

  // If no explicit scannedPassIds list exists yet, fall back to reg.checkedIn
  return Boolean(reg.checkedIn);
}

/**
 * Calculates delegate check-in statistics for a registration
 */
export function getRegistrationCheckInStats(reg: any, delegates?: any[]) {
  if (!reg) return { checkedInCount: 0, totalCount: 0, isAllCheckedIn: false, isPartialCheckedIn: false };
  
  const dels = delegates || [];
  const totalCount = Math.max(dels.length, 1);
  
  let checkedInCount = 0;
  if (dels.length > 0) {
    checkedInCount = dels.filter(d => 
      isDelegatePassCheckedIn(reg, d.passId || d.id, d.name, d.isPrimary, d.id)
    ).length;
  } else {
    checkedInCount = reg.checkedIn ? 1 : 0;
  }

  const isAllCheckedIn = totalCount > 0 && checkedInCount === totalCount;
  const isPartialCheckedIn = checkedInCount > 0 && checkedInCount < totalCount;

  return {
    checkedInCount,
    totalCount,
    isAllCheckedIn,
    isPartialCheckedIn
  };
}

