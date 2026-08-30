import type { VercelRequest, VercelResponse } from '@vercel/node';
import nodemailer from 'nodemailer';
import QRCode from 'qrcode';
import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { INITIAL_400_BIBLE_VERSES } from '../src/data/inspiringBibleVerses400';

const currentDir = typeof __dirname !== 'undefined'
  ? __dirname
  : path.dirname(fileURLToPath(import.meta.url));

// Hardcoded public absolute production URLs hosted on Vercel CDN for 100% email client compatibility
const JYSG_PUBLIC_LOGO_URL = "https://gracia2026.vercel.app/jysg_logo.png";
const JY_OFFICIAL_LOGO_URL = "https://gracia2026.vercel.app/jysg_logo.png";
const JUBILEE_25_LOGO_URL = "https://gracia2026.vercel.app/jysg_jubilee_logo.png";
const JY_FALLBACK_LOGO_URL = "https://gracia2026.vercel.app/jysg_logo.png";

function getHeaderLogoAttachments() {
  // Do NOT attach logo files as email attachments so they do not show up as downloadable files at the bottom of emails
  return [];
}

function toProperCase(str?: string | null): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .split(/\s+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
    .trim();
}

function getInitials(name?: string | null): string {
  if (!name) return 'SG';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'SG';
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function cleanFilename(nameStr: string): string {
  return nameStr.replace(/[^a-zA-Z0-9]/g, '_');
}

export interface ServerPdfPassData {
  id?: string;
  name: string;
  email: string;
  phone?: string;
  type?: string;
  passId: string;
  categoryLabel?: string;
  seat?: string;
  isPrimary?: boolean;
  primaryContactName?: string;
  additionalAttendees?: Array<{
    name: string;
    category?: string;
    categoryLabel?: string;
    email?: string;
    phone?: string;
    passId?: string;
  }>;
  selectedSeats?: string[];
}

async function generateServerPdfPassBuffer(data: ServerPdfPassData): Promise<Buffer> {
  const isMusical = data.type === 'musical';
  const eventName = isMusical ? 'GRACIA Musical Concert' : 'GRACIA Jubilee Conference 2026';
  const eventDate = isMusical ? 'Sunday, 11 October 2026 • 7:30 PM' : 'Sat & Sun, 10–11 October 2026 • 9:00 AM - 6:00 PM';
  const venueStr = 'Caritas Agape Village, 7A Lorong 8 Toa Payoh, Singapore 319264';

  const passes: Array<{
    passId: string;
    name: string;
    categoryLabel: string;
    email: string;
    phone: string;
    isPrimary: boolean;
    primaryContactName: string;
    seat: string;
  }> = [];

  const rawSeed = data.passId || data.id || data.email || data.name || 'GRACIA';
  const mainPassId = data.passId || getInlineVersePassId(rawSeed, 0, data.name);

  // Primary Pass
  const primarySeat = data.selectedSeats && data.selectedSeats.length > 0
    ? `Row ${data.selectedSeats[0].split('-')[0]} Seat ${data.selectedSeats[0].split('-')[1]}`
    : 'General Admission';

  passes.push({
    passId: mainPassId,
    name: data.name || 'Participant',
    categoryLabel: data.categoryLabel || 'Conference Delegate',
    email: data.email || 'N/A',
    phone: data.phone || 'N/A',
    isPrimary: true,
    primaryContactName: data.name || 'Primary Contact',
    seat: primarySeat
  });

  // Additional Attendees
  if (data.additionalAttendees && Array.isArray(data.additionalAttendees)) {
    data.additionalAttendees.forEach((addon, idx) => {
      if (!addon.name) return;
      const addonSeat = data.selectedSeats && data.selectedSeats[idx + 1]
        ? `Row ${data.selectedSeats[idx + 1].split('-')[0]} Seat ${data.selectedSeats[idx + 1].split('-')[1]}`
        : 'General Admission';

      const addonPassId = addon.passId || getInlineVersePassId(rawSeed, idx + 1, addon.name);

      passes.push({
        passId: addonPassId,
        name: addon.name,
        categoryLabel: addon.categoryLabel || 'Delegate Member',
        email: addon.email || data.email || 'N/A',
        phone: addon.phone || data.phone || 'N/A',
        isPrimary: false,
        primaryContactName: data.name || 'Primary Contact',
        seat: addonSeat
      });
    });
  }

  return new Promise(async (resolve, reject) => {
    let isSettled = false;
    const timer = setTimeout(() => {
      if (!isSettled) {
        isSettled = true;
        reject(new Error('PDF generation timed out after 5000ms'));
      }
    }, 5000);

    const safeResolve = (buf: Buffer) => {
      if (!isSettled) {
        isSettled = true;
        clearTimeout(timer);
        resolve(buf);
      }
    };

    const safeReject = (err: any) => {
      if (!isSettled) {
        isSettled = true;
        clearTimeout(timer);
        reject(err);
      }
    };

    try {
      const doc = new PDFDocument({ margin: 30, size: 'A4' });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => safeResolve(Buffer.concat(chunks)));
      doc.on('error', (err) => safeReject(err));

      for (let i = 0; i < passes.length; i++) {
        if (i > 0) {
          doc.addPage();
        }

        const pass = passes[i];

        // 1. TOP BRANDING HEADER
        doc.roundedRect(30, 30, 535, 78, 8).fill('#0A1128');
        doc.rect(30, 30, 535, 4).fill('#F59E0B');

        doc.fillColor('#FFFFFF').fontSize(9).font('Helvetica-Bold').text('JESUS YOUTH SINGAPORE', 48, 44);
        doc.fillColor('#F59E0B').fontSize(24).font('Helvetica-Bold').text('GRACIA', 48, 56);
        doc.fillColor('#E2E8F0').fontSize(9.5).font('Helvetica-Bold').text('25 YEARS OF GRACE IN SINGAPORE', 48, 83);
        doc.fillColor('#F43F5E').fontSize(9).font('Helvetica-Bold').text(
          isMusical ? 'MUSICAL CONCERT PASS' : 'CONFERENCE PASS',
          360, 44, { align: 'right', width: 190 }
        );

        if (passes.length > 1) {
          doc.fillColor('#FDE68A').fontSize(9).font('Helvetica-Bold').text(`PASS ${i + 1} OF ${passes.length}`, 360, 58, { align: 'right', width: 190 });
        }

        // 2. MAIN CARD CONTAINER
        doc.roundedRect(30, 116, 535, 436, 8).stroke('#E2E8F0');
        doc.rect(30, 116, 535, 28).fill('#FAF8F6');
        doc.fillColor('#0A1128').fontSize(10).font('Helvetica-Bold').text(
          pass.isPrimary ? 'CONFERENCE PASS & RESERVATION' : 'DELEGATE MEMBER PASS',
          48, 125
        );

        // PASS HOLDER DETAILS
        doc.fillColor('#0A1128').fontSize(11).font('Helvetica-Bold').text('DELEGATE DETAILS', 50, 158);
        
        doc.fillColor('#64748B').fontSize(8.5).font('Helvetica-Bold').text('PASS HOLDER:', 50, 178);
        doc.fillColor('#0F172A').fontSize(15).font('Helvetica-Bold').text(pass.name, 50, 192);

        doc.fillColor('#64748B').fontSize(8.5).font('Helvetica-Bold').text('ROLE / CATEGORY:', 50, 218);
        doc.fillColor('#1E293B').fontSize(10).font('Helvetica-Bold').text(pass.categoryLabel, 50, 230);

        doc.fillColor('#64748B').fontSize(8.5).font('Helvetica-Bold').text('PASS REFERENCE ID:', 50, 252);
        doc.fillColor('#0A1128').fontSize(11).font('Helvetica-Bold').text(pass.passId, 50, 264);

        doc.fillColor('#64748B').fontSize(8.5).font('Helvetica-Bold').text('PRIMARY CONTACT:', 50, 286);
        doc.fillColor('#1E293B').fontSize(9.5).font('Helvetica').text(`${pass.primaryContactName} (${pass.email})`, 50, 298);

        // QR CODE - Minimal Pass ID string with Error Correction Level M for instant scanning
        const qrPngBuffer = await QRCode.toBuffer(pass.passId, {
          margin: 2,
          width: 155,
          errorCorrectionLevel: 'M',
          color: { dark: '#000000', light: '#FFFFFF' }
        });

        doc.roundedRect(360, 154, 185, 172, 8).fill('#FFFFFF');
        doc.roundedRect(360, 154, 185, 172, 8).stroke('#E2E8F0');
        doc.image(qrPngBuffer, 377, 160, { width: 150, height: 150 });
        doc.fillColor('#0A1128').fontSize(8.5).font('Helvetica-Bold').text(`PASS ID: ${pass.passId}`, 360, 313, { align: 'center', width: 185 });

        // DIVIDER
        doc.moveTo(50, 336).lineTo(515, 336).dash(3, { space: 3 }).stroke('#CBD5E1').undash();

        // EVENT & VENUE DETAILS
        doc.fillColor('#0A1128').fontSize(11).font('Helvetica-Bold').text('EVENT & VENUE DETAILS', 50, 348);
        doc.fillColor('#334155').fontSize(9).font('Helvetica-Bold').text('EVENT:', 50, 365);
        doc.fillColor('#0F172A').fontSize(9).font('Helvetica').text(eventName, 105, 365);

        doc.fillColor('#334155').fontSize(9).font('Helvetica-Bold').text('DATE:', 50, 381);
        doc.fillColor('#0F172A').fontSize(9).font('Helvetica').text(eventDate, 105, 381);

        doc.fillColor('#334155').fontSize(9).font('Helvetica-Bold').text('VENUE:', 50, 397);
        doc.fillColor('#0F172A').fontSize(9).font('Helvetica').text(venueStr, 105, 397);

        // SEAT / PASS HIGHLIGHT BOX
        doc.roundedRect(50, 420, 495, 34, 6).fill('#FAF8F6');
        doc.roundedRect(50, 420, 495, 34, 6).stroke('#F1E5DE');
        doc.fillColor('#64748B').fontSize(8).font('Helvetica-Bold').text('ASSIGNED SEAT / STATUS:', 62, 427);
        doc.fillColor('#0F172A').fontSize(10.5).font('Helvetica-Bold').text(pass.seat, 62, 439);

        // JUBILEE BLESSING CALLOUT
        doc.roundedRect(50, 464, 495, 76, 6).fill('#FFFBEB');
        doc.roundedRect(50, 464, 495, 76, 6).stroke('#FED7AA');
        doc.fillColor('#92400E').fontSize(9).font('Helvetica-Bold').text('A SPECIAL GIFT OF GRACE: PARTIAL INDULGENCE', 62, 473);
        doc.fillColor('#78350F').fontSize(8).font('Helvetica').text(
          'A Partial Indulgence has been granted by the Apostolic Penitentiary to all the faithful who, after fulfilling the customary conditions, participate in the Thanksgiving Mass celebrated by His Eminence William Cardinal Goh.',
          62, 486, { width: 470, lineGap: 2 }
        );

        // FOOTER BAR
        doc.roundedRect(30, 560, 535, 24, 4).fill('#0A1128');
        doc.fillColor('#FFFFFF').fontSize(8.5).font('Helvetica-Bold').text(
          'JESUS YOUTH SINGAPORE • GRACIA 2026 OFFICIAL DELEGATE PASS',
          30, 567, { align: 'center', width: 535 }
        );

        // FOOTER INSTRUCTIONS
        doc.fillColor('#777777').fontSize(7.5).font('Helvetica').text(
          '• Please present this official pass (printed or on your smartphone) at venue check-in. • For assistance: singapore@jesusyouth.org',
          30, 592, { align: 'center', width: 535 }
        );
      }

      doc.end();
    } catch (e) {
      reject(e);
    }
  });
}

function getBookAbbrev(bookName: string): string {
  if (!bookName) return 'GEN';
  const upper = bookName.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (upper.startsWith('1JOHN') || upper.startsWith('1JN')) return '1JN';
  if (upper.startsWith('2JOHN') || upper.startsWith('2JN')) return '2JN';
  if (upper.startsWith('3JOHN') || upper.startsWith('3JN')) return '3JN';
  if (upper.startsWith('1COR')) return '1CO';
  if (upper.startsWith('2COR')) return '2CO';
  if (upper.startsWith('1THESS')) return '1TH';
  if (upper.startsWith('2THESS')) return '2TH';
  if (upper.startsWith('1TIM')) return '1TI';
  if (upper.startsWith('2TIM')) return '2TI';
  if (upper.startsWith('1PET')) return '1PE';
  if (upper.startsWith('2PET')) return '2PE';
  if (upper.startsWith('PHIL')) return 'PHI';
  if (upper.startsWith('ROM')) return 'ROM';
  if (upper.startsWith('EPH')) return 'EPH';
  if (upper.startsWith('COL')) return 'COL';
  if (upper.startsWith('ISA')) return 'ISA';
  if (upper.startsWith('JER')) return 'JER';
  if (upper.startsWith('PSA')) return 'PSA';
  if (upper.startsWith('PRO')) return 'PRO';
  if (upper.startsWith('JOHN') || upper.startsWith('JHN')) return 'JHN';
  if (upper.startsWith('MAT')) return 'MAT';
  if (upper.startsWith('GAL')) return 'GAL';
  if (upper.startsWith('HEB')) return 'HEB';
  if (upper.startsWith('JAS')) return 'JAS';
  if (upper.startsWith('REV')) return 'REV';
  return upper.substring(0, 3);
}

function formatBibleRef(rawRef: string): string {
  if (!rawRef) return '';
  const clean = rawRef.trim().replace(/^GRACIA-[A-Z0-9]{3,4}-/i, '');
  const [rawBook, versePart] = clean.split('-');
  if (!versePart) return clean;

  const bookUpper = rawBook.toUpperCase();
  const bookMap: Record<string, string> = {
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
    'GAL': 'Galatians', 'EPH': 'Ephesians', 'EPHESIANS': 'Ephesians', 'PHP': 'Philippians', 'PHIL': 'Philippians', 'PHILIPPIANS': 'Philippians', 'COL': 'Colossians', 'COLOSSIANS': 'Colossians',
    '1TH': '1 Thessalonians', '1THESS': '1 Thessalonians', '2TH': '2 Thessalonians', '2THESS': '2 Thessalonians',
    '1TI': '1 Timothy', '1TIM': '1 Timothy', '2TI': '2 Timothy', '2TIM': '2 Timothy',
    'TIT': 'Titus', 'PHM': 'Philemon', 'HEB': 'Hebrews', 'HEBREWS': 'Hebrews', 'JAS': 'James', '1PE': '1 Peter', '1PET': '1 Peter',
    '2PE': '2 Peter', '2PET': '2 Peter', '1JN': '1 John', '1JOHN': '1 John', '2JN': '2 John', '3JN': '3 John',
    'JUD': 'Jude', 'REV': 'Revelation'
  };

  if (bookMap[bookUpper]) {
    return `${bookMap[bookUpper]} ${versePart}`;
  }

  const numMatch = bookUpper.match(/^([1-3])([A-Z]+)$/);
  if (numMatch) {
    const num = numMatch[1];
    const rest = numMatch[2];
    const restFormatted = rest.charAt(0).toUpperCase() + rest.slice(1).toLowerCase();
    return `${num} ${restFormatted} ${versePart}`;
  }

  const formattedBook = bookUpper.charAt(0).toUpperCase() + bookUpper.slice(1).toLowerCase();
  return `${formattedBook} ${versePart}`;
}

// Inline zero-dependency deterministic pass ID generator grounded in 400+ Bible Verses
function getInlineVersePassId(seed?: string, index: number = 0, name?: string): string {
  const cleanSeed = (seed || name || 'GRACIA').trim().toUpperCase();
  if (/^GRACIA-[A-Z0-9]{3,4}-[A-Z0-9]{2,3}-\d+:\d+$/i.test(cleanSeed)) {
    return cleanSeed;
  }
  const cleanName = (name || 'DELEGATE').replace(/[^a-zA-Z]/g, '').toUpperCase();
  const nameCode = cleanName.length >= 4 ? cleanName.substring(0, 4) : cleanName.padEnd(4, 'X');
  
  const strToHash = `${cleanSeed}_PAX_${index}`;
  let hash = 0;
  for (let i = 0; i < strToHash.length; i++) {
    hash = (hash << 5) - hash + strToHash.charCodeAt(i);
    hash |= 0;
  }
  const posHash = Math.abs(hash);
  const verseItem = INITIAL_400_BIBLE_VERSES[(posHash + index * 23) % INITIAL_400_BIBLE_VERSES.length];
  
  const [rawBook, verseNum] = verseItem.reference.split('-');
  const bookCode = getBookAbbrev(rawBook);
  return `GRACIA-${nameCode}-${bookCode}-${verseNum}`;
}

function getInlineVerseText(passId: string): string {
  if (!passId) return 'The Lord bless you and keep you; the Lord make his face shine upon you and be gracious to you. (Numbers 6:24-25)';
  
  const cleanPassId = passId.trim().toUpperCase();
  const withoutGracia = cleanPassId.replace(/^GRACIA-/i, '');
  const parts = withoutGracia.split('-');
  
  let bookCode = '';
  let verseNum = '';
  if (parts.length >= 3) {
    bookCode = parts[parts.length - 2];
    verseNum = parts[parts.length - 1];
  } else if (parts.length === 2) {
    bookCode = parts[0];
    verseNum = parts[1];
  }

  if (bookCode && verseNum) {
    // 1. Exact match by verseNum and bookCode prefix
    const match = INITIAL_400_BIBLE_VERSES.find(v => {
      const [vBook, vNum] = v.reference.toUpperCase().split('-');
      if (vNum !== verseNum) return false;
      return vBook.startsWith(bookCode) || bookCode.startsWith(vBook.slice(0, 3));
    });

    if (match) {
      const formattedRef = formatBibleRef(match.reference);
      return `${match.text} (${formattedRef})`;
    }

    // 2. Fallback search by verseNum alone
    const vNumMatch = INITIAL_400_BIBLE_VERSES.find(v => v.reference.toUpperCase().endsWith(`-${verseNum}`));
    if (vNumMatch) {
      const formattedRef = formatBibleRef(vNumMatch.reference);
      return `${vNumMatch.text} (${formattedRef})`;
    }

    // 3. Fallback search by bookCode alone
    const bookMatch = INITIAL_400_BIBLE_VERSES.find(v => {
      const [vBook] = v.reference.toUpperCase().split('-');
      return vBook.startsWith(bookCode) || bookCode.startsWith(vBook.slice(0, 3));
    });
    if (bookMatch) {
      const formattedRef = formatBibleRef(`${bookCode}-${verseNum}`);
      return `${bookMatch.text} (${formattedRef})`;
    }
  }

  return 'The Lord bless you and keep you; the Lord make his face shine upon you and be gracious to you. (Numbers 6:24-25)';
}

const INLINE_GROUP_COLORS = [
  { id: 'group-red', name: 'St. Peter', colorHex: '#DC2626', badgeLabel: '🔴 St. Peter', emoji: '🔴' },
  { id: 'group-blue', name: 'St. Michael', colorHex: '#2563EB', badgeLabel: '🔵 St. Michael', emoji: '🔵' },
  { id: 'group-green', name: 'St. Francis', colorHex: '#059669', badgeLabel: '🟢 St. Francis', emoji: '🟢' },
  { id: 'group-gold', name: 'St. Joseph', colorHex: '#D97706', badgeLabel: '🟡 St. Joseph', emoji: '🟡' },
  { id: 'group-purple', name: 'St. Paul', colorHex: '#9333EA', badgeLabel: '🟣 St. Paul', emoji: '🟣' },
  { id: 'group-teal', name: 'St. Jude', colorHex: '#0D9488', badgeLabel: '🩵 St. Jude', emoji: '🩵' },
  { id: 'group-orange', name: 'St. Anthony', colorHex: '#EA580C', badgeLabel: '🟠 St. Anthony', emoji: '🟠' },
  { id: 'group-pink', name: 'St. Teresa', colorHex: '#E11D48', badgeLabel: '🩷 St. Teresa', emoji: '🩷' },
  { id: 'group-indigo', name: 'St. John', colorHex: '#4F46E5', badgeLabel: '🫐 St. John', emoji: '🫐' },
  { id: 'group-cyan', name: 'St. Clare', colorHex: '#0891B2', badgeLabel: '🌊 St. Clare', emoji: '🌊' }
];

function getInlineGroupColor(seed?: string, index: number = 0) {
  const cleanSeed = (seed || 'GRACIA').toLowerCase();
  const hash = cleanSeed.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) + index * 3;
  return INLINE_GROUP_COLORS[Math.abs(hash) % INLINE_GROUP_COLORS.length];
}

function getSmtpCredentials() {
  const host = (
    process.env.SMTP_HOST ||
    process.env.GMAIL_SMTP_HOST ||
    process.env.MAIL_HOST ||
    process.env.EMAIL_HOST ||
    process.env.VITE_SMTP_HOST ||
    "smtp.gmail.com"
  ).trim();

  const port = parseInt(
    process.env.SMTP_PORT ||
    process.env.GMAIL_PORT ||
    process.env.MAIL_PORT ||
    process.env.EMAIL_PORT ||
    process.env.VITE_SMTP_PORT ||
    "587",
    10
  );

  const user = (
    process.env.SMTP_USER ||
    process.env.GMAIL_USER ||
    process.env.SMTP_EMAIL ||
    process.env.GMAIL_EMAIL ||
    process.env.SMTP_USERNAME ||
    process.env.GMAIL_USERNAME ||
    process.env.EMAIL_USER ||
    process.env.EMAIL_USERNAME ||
    process.env.EMAIL_ADDRESS ||
    process.env.EMAIL ||
    process.env.MAIL_USER ||
    process.env.MAIL_USERNAME ||
    process.env.MAIL_EMAIL ||
    process.env.GOOGLE_USER ||
    process.env.VITE_SMTP_USER ||
    process.env.VITE_GMAIL_USER ||
    process.env.VITE_GMAIL_EMAIL ||
    process.env.VITE_EMAIL_USER ||
    process.env.VITE_MAIL_USER ||
    process.env.VITE_EMAIL ||
    "jysg25@jesusyouth.org"
  ).trim();

  const rawPass = (
    process.env.SMTP_PASS ||
    process.env.GMAIL_APP_PASSWORD ||
    process.env.SMTP_PASSWORD ||
    process.env.GMAIL_PASSWORD ||
    process.env.GMAIL_PASS ||
    process.env.MAIL_PASSWORD ||
    process.env.MAIL_PASS ||
    process.env.EMAIL_PASSWORD ||
    process.env.EMAIL_PASS ||
    process.env.SMTP_APP_PASSWORD ||
    process.env.GOOGLE_APP_PASSWORD ||
    process.env.VITE_SMTP_PASS ||
    process.env.VITE_GMAIL_APP_PASSWORD ||
    process.env.VITE_SMTP_PASSWORD ||
    process.env.VITE_GMAIL_PASSWORD ||
    process.env.VITE_EMAIL_PASS ||
    process.env.VITE_EMAIL_PASSWORD ||
    process.env.NODEMAILER_PASS ||
    ""
  ).trim();

  const unquoted = rawPass.replace(/^["']|["']$/g, '').trim();
  const cleanPass = unquoted.replace(/[\s\-]/g, '');
  const pass = (cleanPass.length === 16 || host.includes('gmail')) ? cleanPass : (unquoted.includes(' ') && cleanPass.length > 0 ? cleanPass : unquoted);

  return { host, port, user, pass, rawPass };
}

function isValidEmail(email: string | undefined | null): boolean {
  if (!email || typeof email !== 'string') return false;
  const trimmed = email.trim();
  if (trimmed.length < 5 || trimmed.length > 254) return false;

  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  if (!emailRegex.test(trimmed)) return false;

  const parts = trimmed.split('@');
  if (parts.length !== 2) return false;
  const [local, domain] = parts;
  if (!local || !domain) return false;

  if (/[#_<>()[\]\\,;:\s"]/.test(domain)) return false;

  const domainParts = domain.split('.');
  if (domainParts.length < 2) return false;

  const tld = domainParts[domainParts.length - 1];
  if (!tld || tld.length < 2 || !/^[a-zA-Z]+$/.test(tld)) return false;

  return true;
}

async function sendMailWithFallback(mailOptions: {
  to: string | string[];
  cc?: string | string[];
  subject: string;
  html: string;
  attachments?: any[];
  replyTo?: string;
  fromName?: string;
}): Promise<{ success: boolean; messageId?: string; method?: string; error?: string; hint?: string }> {
  const { host, port, user, pass } = getSmtpCredentials();
  const senderEmail = user || "jysg25@jesusyouth.org";
  const fromName = mailOptions.fromName || "Jesus Youth Singapore (GRACIA)";
  const from = `"${fromName}" <${senderEmail}>`;

  const toList = (Array.isArray(mailOptions.to) ? mailOptions.to : [mailOptions.to])
    .map(e => (typeof e === 'string' ? e.trim() : ''))
    .filter(Boolean);

  const recipientEmail = toList[0] || '';

  if (!recipientEmail || !isValidEmail(recipientEmail)) {
    console.error(`[SMTP Validation Error] Cannot dispatch to "${recipientEmail}": address is not a valid RFC 5321 email address.`);
    return {
      success: false,
      error: `Invalid recipient address: "${recipientEmail}" is not a valid RFC 5321 email address.`,
      hint: `Please verify that the recipient email address is spelled correctly and contains a valid domain name.`
    };
  }

  if (!pass) {
    const hint = `SMTP_PASS environment variable is not configured. Please generate a 16-character Google App Password at myaccount.google.com/apppasswords and set SMTP_PASS in your Vercel Environment Variables.`;
    console.error(`[SMTP Error] Cannot dispatch to ${recipientEmail}: SMTP_PASS is missing.`);
    return {
      success: false,
      error: "SMTP_PASS not configured",
      hint
    };
  }

  // 1. Primary Attempt: Port 587 STARTTLS (optimal serverless / cloud container compatibility)
  try {
    const transporter587 = nodemailer.createTransport({
      host: host.includes("gmail") ? "smtp.gmail.com" : host,
      port: 587,
      secure: false, // STARTTLS
      requireTLS: true,
      auth: { user: senderEmail, pass },
      tls: { rejectUnauthorized: false },
      connectionTimeout: 8000,
      greetingTimeout: 6000,
      socketTimeout: 12000
    });

    const info = await transporter587.sendMail({
      from,
      to: mailOptions.to,
      cc: mailOptions.cc !== undefined ? mailOptions.cc : "jysg25@jesusyouth.org",
      replyTo: mailOptions.replyTo || "singapore@jesusyouth.org",
      subject: mailOptions.subject,
      html: mailOptions.html,
      attachments: mailOptions.attachments
    });

    console.log(`[SMTP 587 Success] Dispatched confirmation email to ${recipientEmail}: ${info.messageId}`);
    return { success: true, messageId: info.messageId, method: 'smtp-port-587' };
  } catch (err587: any) {
    const isPermanentError = (err587.responseCode && err587.responseCode >= 500 && err587.responseCode < 600) || 
                             /553|550|554|501|invalid|rejected|553-5\.1\.3/i.test(err587.message || '');

    if (isPermanentError) {
      console.error(`[SMTP Recipient Rejected] Address "${recipientEmail}" was rejected by SMTP server: ${err587.message}`);
      return {
        success: false,
        error: `Recipient rejected: ${err587.message}`,
        hint: `Ensure the recipient email address is valid and active.`
      };
    }

    console.warn(`[SMTP 587 Warning] Failed to ${recipientEmail}: ${err587.message}. Trying Port 465 SSL...`);

    // 2. Secondary Attempt: Port 465 SSL Direct
    try {
      const isGmail = host.includes("gmail");
      const transporter465 = nodemailer.createTransport({
        service: isGmail ? 'gmail' : undefined,
        host: isGmail ? undefined : host,
        port: isGmail ? undefined : 465,
        secure: true,
        auth: { user: senderEmail, pass },
        tls: { rejectUnauthorized: false },
        connectionTimeout: 8000,
        greetingTimeout: 6000,
        socketTimeout: 12000
      });

      const info465 = await transporter465.sendMail({
        from,
        to: mailOptions.to,
        cc: mailOptions.cc !== undefined ? mailOptions.cc : "jysg25@jesusyouth.org",
        replyTo: mailOptions.replyTo || "singapore@jesusyouth.org",
        subject: mailOptions.subject,
        html: mailOptions.html,
        attachments: mailOptions.attachments
      });

      console.log(`[SMTP 465 Success] Dispatched confirmation email to ${recipientEmail}: ${info465.messageId}`);
      return { success: true, messageId: info465.messageId, method: 'smtp-port-465' };
    } catch (err465: any) {
      console.error(`[SMTP Error] Both Port 587 and Port 465 failed for ${recipientEmail}:`, err465.message);
      return {
        success: false,
        error: `SMTP dispatch failed: ${err465.message || err587.message}`,
        hint: `Verify that SMTP_USER is set to your Gmail address, SMTP_PASS is a valid 16-character Google App Password, and 2-Step Verification is active on ${senderEmail}.`
      };
    }
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Support CORS for client requests
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ status: 'error', message: 'Method not allowed' });
  }

  try {
    const { 
      type, name, email, phone, parish, photoUrl,
      adultsCount = 1, teensCount = 0, preteensCount = 0, childrenCount = 0, kidsCount = 0, toddlersCount = 0, 
      comments, additionalAttendees = [], selectedSeats = [], pdfTicketBase64, isUpdate, isConferenceRegistered, docId 
    } = req.body || {};

    if (!email || !name) {
      return res.status(400).json({ status: "error", message: "Name and email are required" });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ status: "error", message: `Invalid recipient address: "${email}" does not satisfy RFC 5321 email syntax.` });
    }

    const isMusical = type === 'musical';
    const eventName = isMusical ? "GRACIA Musical Concert" : "GRACIA - Jubilee Conference, 25 years of grace in Singapore";
    const eventDateTime = isMusical 
      ? "Sunday, 11 October 2026 • 7:00 PM" 
      : "10 – 11 October 2026 (Saturday & Sunday)";
    const subject = isUpdate
      ? `[Updated Booking] ${isMusical ? 'GRACIA | Musical Concert Pass' : 'GRACIA | Conference Pass'} | Jesus Youth Singapore Celebrating 25 Years of Grace!`
      : `${isMusical ? 'GRACIA | Musical Concert Pass' : 'GRACIA | Conference Pass'} | Jesus Youth Singapore Celebrating 25 Years of Grace!`;

    const totalSeats = Number(adultsCount) + Number(teensCount) + Number(preteensCount) + Number(childrenCount) + Number(kidsCount) + Number(toddlersCount);
    const includeLoveOffer = type === 'conference' || (type === 'musical' && isConferenceRegistered === true);

    const rawSeed = docId || req.body.id || email || name || 'GRACIA';
    const mainPassId = req.body.passId || getInlineVersePassId(rawSeed, 0, name);
    const mainVerseText = getInlineVerseText(mainPassId);
    const mainGroupColor = getInlineGroupColor(rawSeed, 0);

    const getInitials = (n: string) => {
      if (!n) return 'G';
      const parts = n.trim().split(/\s+/);
      if (parts.length >= 2) return `${parts[0].charAt(0)}${parts[parts.length - 1].charAt(0)}`.toUpperCase();
      return n.substring(0, 2).toUpperCase();
    };

    // Categorize Attendees
    const taggedDependents = (additionalAttendees || []).filter((a: any) =>
      a.category === 'preteen' || a.category === 'child' || a.category === 'kid' || a.category === 'toddler' ||
      (a.categoryLabel && (a.categoryLabel.toLowerCase().includes('preteen') || a.categoryLabel.toLowerCase().includes('child') || a.categoryLabel.toLowerCase().includes('pre-teen') || a.categoryLabel.toLowerCase().includes('kid') || a.categoryLabel.toLowerCase().includes('toddler')))
    );

    const primarySeat = selectedSeats && selectedSeats.length > 0 
      ? `Row ${selectedSeats[0].split('-')[0]} Seat ${selectedSeats[0].split('-')[1]}` 
      : 'General Admission';

    // Read official logo buffer if locally available for 100% reliable inline CID rendering
    let jyLogoBuffer: Buffer | null = null;
    try {
      const candidatePaths = [
        path.join(process.cwd(), 'public', 'jysg_logo.png'),
        path.join(process.cwd(), 'public', 'jy-logo.png'),
        path.join(process.cwd(), 'dist', 'public', 'jysg_logo.png'),
        path.join(process.cwd(), 'dist', 'jysg_logo.png'),
        path.join(process.cwd(), 'jysg_logo.png'),
        path.join(process.cwd(), 'jy-logo.png')
      ];
      for (const p of candidatePaths) {
        if (fs.existsSync(p)) {
          jyLogoBuffer = fs.readFileSync(p);
          break;
        }
      }
    } catch (e) {
      console.warn("Could not read local jy-logo.png buffer:", e);
    }

    let mainQrBuffer: Buffer | null = null;
    let mainQrPublicUrl = "";
    try {
      // Minimal Pass ID string (e.g. GRACIA-SIJU-1JO-5:12) with error correction M and clean quiet zone
      const mainQrString = mainPassId;
      mainQrBuffer = await QRCode.toBuffer(mainQrString, { 
        margin: 2, 
        width: 240,
        errorCorrectionLevel: 'M'
      });
      mainQrPublicUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&ecc=M&margin=2&data=${encodeURIComponent(mainQrString)}`;
    } catch (e) {
      console.error("Error generating main QR code:", e);
    }

    // Prepare Additional Attendees Cards & Data
    const allAddons = (additionalAttendees || []).filter((a: any) => a && a.name && a.name.trim());
    const addonCardDataList: Array<{
      passId: string;
      name: string;
      categoryLabel: string;
      groupColor: any;
      verseText: string | null;
      seat: string;
      email: string;
      phone: string;
      qrBuffer: Buffer | null;
      qrPublicUrl: string;
      idx: number;
    }> = [];

    for (let idx = 0; idx < allAddons.length; idx++) {
      const addon = allAddons[idx];
      const addonPassId = addon.passId || getInlineVersePassId(rawSeed, idx + 1, addon.name);
      const addonVerseText = getInlineVerseText(addonPassId);
      const addonGroupColor = getInlineGroupColor(rawSeed, idx + 1);
      const addonSeat = selectedSeats && selectedSeats[idx + 1]
        ? `Row ${selectedSeats[idx + 1].split('-')[0]} Seat ${selectedSeats[idx + 1].split('-')[1]}`
        : 'General Admission';

      let addonQrBuf: Buffer | null = null;
      let addonQrUrl = "";
      try {
        // Minimal Pass ID string for addon pass
        const addonQrString = addonPassId;
        addonQrBuf = await QRCode.toBuffer(addonQrString, { 
          margin: 2, 
          width: 240,
          errorCorrectionLevel: 'M'
        });
        addonQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&ecc=M&margin=2&data=${encodeURIComponent(addonQrString)}`;
      } catch (e) {
        console.error(`Error generating QR code for addon ${addon.name}:`, e);
      }

      addonCardDataList.push({
        passId: addonPassId,
        name: addon.name,
        categoryLabel: addon.categoryLabel || addon.category || 'Delegate Member',
        groupColor: addonGroupColor,
        verseText: addonVerseText,
        seat: addonSeat,
        email: addon.email || '',
        phone: addon.phone || '',
        qrBuffer: addonQrBuf,
        qrPublicUrl: addonQrUrl,
        idx
      });
    }

    const renderPassCardHtml = (card: {
      name: string;
      categoryLabel: string;
      passId: string;
      seat: string;
      groupColor: any;
      verseText: string | null;
      qrCid?: string;
      qrPublicUrl?: string;
      photoUrl?: string;
      isPrimary?: boolean;
    }) => {
      const nameStr = card.name || "Participant";
      const initialsStr = getInitials(nameStr);
      const colorHex = card.groupColor?.colorHex || '#DC2626';
      const groupName = card.groupColor?.name || 'St. Peter';
      const photoUrlStr = card.photoUrl && card.photoUrl.startsWith('http') ? card.photoUrl : null;
      const qrImgSrc = card.qrCid ? `cid:${card.qrCid}` : (card.qrPublicUrl || `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(card.passId)}`);

      return `
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #FAF8F6; border: 1.5px solid #E2D9D0; border-radius: 16px; margin-bottom: 24px; overflow: hidden; box-shadow: 0 4px 16px rgba(0,0,0,0.04);">
          <!-- CARD HEADER -->
          <tr>
            <td style="background-color: #0A1128; padding: 14px 20px; border-bottom: 3px solid ${colorHex};">
              <table border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="left">
                    <span style="font-size: 10px; font-weight: 800; color: #F59E0B; text-transform: uppercase; letter-spacing: 1.5px;">GRACIA 2026 • OFFICIAL PASS</span>
                  </td>
                  <td align="right">
                    <span style="display: inline-block; background-color: rgba(255,255,255,0.12); color: #FFFFFF; font-size: 10.5px; font-weight: 700; padding: 3px 10px; border-radius: 20px; border: 1px solid rgba(255,255,255,0.25);">
                      ${card.isPrimary ? 'PRIMARY REGISTRANT' : 'DELEGATE PASS'}
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- CARD BODY -->
          <tr>
            <td style="padding: 20px;">
              <table border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <!-- LEFT: AVATAR & DETAILS -->
                  <td valign="top" style="padding-right: 14px;">
                    <table border="0" cellpadding="0" cellspacing="0" width="100%">
                      <tr>
                        <td style="padding-bottom: 12px;">
                          <table border="0" cellpadding="0" cellspacing="0">
                            <tr>
                              <td valign="middle" style="padding-right: 12px;">
                                ${photoUrlStr ? `
                                  <img src="${photoUrlStr}" alt="${nameStr}" width="56" height="56" style="width: 56px; height: 56px; border-radius: 50%; border: 2.5px solid #F59E0B; object-fit: cover; display: block;" />
                                ` : `
                                  <div style="width: 54px; height: 54px; border-radius: 50%; background: linear-gradient(135deg, #0A1128 0%, #1E1B4B 100%); color: #F59E0B; font-weight: 800; font-size: 19px; line-height: 54px; text-align: center; border: 2.5px solid #F59E0B;">
                                    ${initialsStr}
                                  </div>
                                `}
                              </td>
                              <td valign="middle">
                                <div style="font-size: 18px; font-weight: 800; color: #0A1128; line-height: 1.2; margin-bottom: 4px;">
                                  ${nameStr}
                                </div>
                                <span style="display: inline-block; background-color: #E2E8F0; color: #0F172A; font-size: 10.5px; font-weight: 700; padding: 2px 8px; border-radius: 4px;">
                                  ${card.categoryLabel}
                                </span>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>

                      <!-- PASS ID & SEAT -->
                      <tr>
                        <td style="padding: 10px 0 8px 0; border-top: 1px dashed #CBD5E1;">
                          <div style="font-size: 10px; font-weight: 700; color: #64748B; text-transform: uppercase; margin-bottom: 2px;">Pass Reference ID</div>
                          <div style="font-size: 13px; font-weight: 800; color: #0A1128; font-family: monospace; letter-spacing: 0.5px;">
                            ${card.passId}
                          </div>
                        </td>
                      </tr>

                      <tr>
                        <td style="padding-bottom: 8px;">
                          <div style="font-size: 10px; font-weight: 700; color: #64748B; text-transform: uppercase; margin-bottom: 2px;">Assigned Seat / Status</div>
                          <div style="font-size: 12px; font-weight: 700; color: #0F172A;">
                            ${card.seat}
                          </div>
                        </td>
                      </tr>

                      <!-- SAINT GROUP (HIDDEN: WILL BE ASSIGNED BY PROGRAM ADMIN AT LATER STAGE) -->
                    </table>
                  </td>

                  <!-- RIGHT: QR CODE -->
                  <td width="136" align="center" valign="middle" style="background-color: #FFFFFF; border: 1.5px solid #E2E8F0; border-radius: 12px; padding: 8px;">
                    <img src="${qrImgSrc}" alt="Pass QR Code" width="124" height="124" style="display: block; width: 124px; height: 124px; border: 0;" />
                    <div style="font-size: 9px; font-weight: 700; color: #64748B; margin-top: 4px; text-align: center;">SCAN AT VENUE</div>
                  </td>
                </tr>

                ${card.verseText ? `
                  <!-- VERSE BANNER -->
                  <tr>
                    <td colspan="2" style="padding-top: 12px;">
                      <div style="background-color: #FFFBEB; border: 1px solid #FEF3C7; border-radius: 8px; padding: 8px 12px; font-size: 11px; font-style: italic; color: #92400E; line-height: 1.4;">
                        "${card.verseText}"
                      </div>
                    </td>
                  </tr>
                ` : ''}
              </table>
            </td>
          </tr>
        </table>
      `;
    };

    // Render HTML Template for Main Email
    const htmlTemplate = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${eventName} Confirmation Pass</title>
      </head>
      <body style="margin: 0; padding: 0; background-color: #F8F6F3; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; color: #1E293B;">
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #F8F6F3; padding: 24px 12px;">
          <tr>
            <td align="center">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; margin: 0 auto; width: 100%; background-color: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 36px rgba(0,0,0,0.07); border: 1px solid #EAE5DF;">
                
                <!-- TOP BRAND HEADER -->
                <tr>
                  <td style="background-color: #1a0b36; background: linear-gradient(135deg, #1C0838 0%, #120224 100%); padding: 0; text-align: center; color: #FFFFFF; border-bottom: 2.5px solid #F2B544;">
                    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="width: 100%; margin: 0 auto;">
                      <tr>
                        <!-- LEFT LOGO: JESUS YOUTH ROUND EMBLEM -->
                        <td width="22%" align="center" valign="middle" style="text-align: center; vertical-align: middle; padding: 18px 0;">
                          <img src="https://gracia2026.vercel.app/jysg_logo.png" 
                               alt="Jesus Youth Singapore" 
                               width="54" 
                               height="54" 
                               style="display: inline-block; width: 54px; height: 54px; margin: 0 auto; border: 0; outline: none;" />
                        </td>

                        <!-- CENTER COLUMN: HEADER TEXT BLOCK -->
                        <td width="56%" align="center" valign="middle" style="text-align: center; vertical-align: middle; padding: 18px 4px;">
                          <!-- 1. JESUS YOUTH SINGAPORE -->
                          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 11px; font-weight: 800; color: #FFFFFF; letter-spacing: 2.5px; text-transform: uppercase; margin-bottom: 4px; line-height: 1.2; text-align: center;">
                            JESUS YOUTH SINGAPORE
                          </div>

                          <!-- 2. GRACIA VIBRANT DISPLAY TITLE -->
                          <div style="font-family: 'Arial Black', Impact, 'Segoe UI Black', -apple-system, sans-serif; font-size: 42px; font-weight: 900; letter-spacing: 5px; line-height: 1; margin: 4px 0 6px 0; text-align: center; text-transform: uppercase;">
                            <span style="color: #A855F7;">G</span><span style="color: #EC4899;">R</span><span style="color: #EF4444;">A</span><span style="color: #F97316;">C</span><span style="color: #F59E0B;">I</span><span style="color: #FACC15;">A</span>
                          </div>

                          <!-- 3. 25 YEARS OF GRACE IN SINGAPORE -->
                          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #FFFFFF; font-size: 11.5px; font-weight: 800; letter-spacing: 1.8px; text-transform: uppercase; margin: 0 0 5px 0; text-align: center;">
                            25 YEARS OF GRACE IN SINGAPORE
                          </div>

                          <!-- 4. FAITHFUL WITNESS. JOYFUL MISSIONARY. -->
                          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 10px; font-weight: 800; letter-spacing: 1.4px; text-transform: uppercase; text-align: center;">
                            <span style="color: #FF5376;">FAITHFUL WITNESS.</span>&nbsp;&nbsp;
                            <span style="color: #F28C38;">JOYFUL MISSIONARY.</span>
                          </div>
                        </td>

                        <!-- RIGHT LOGO: 25 JUBILEE LOGO -->
                        <td width="22%" align="center" valign="middle" style="text-align: center; vertical-align: middle; padding: 18px 0;">
                          <img src="https://gracia2026.vercel.app/jysg_jubilee_logo.png" 
                               alt="25 Years of Grace in Singapore" 
                               width="54" 
                               height="54" 
                               style="display: inline-block; width: 54px; height: 54px; margin: 0 auto; border: 0; outline: none;" />
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- STATUS PILL & GREETING -->
                <tr>
                  <td style="padding: 28px 24px 16px 24px;">
                    <div style="text-align: center; margin-bottom: 20px;">
                      <span style="display: inline-block; background-color: #ECFDF5; border: 1.5px solid #10B981; color: #065F46; font-size: 12px; font-weight: 800; padding: 6px 16px; border-radius: 24px; letter-spacing: 0.5px; text-transform: uppercase;">
                        ✓ REGISTRATION CONFIRMED
                      </span>
                    </div>

                    <div style="font-size: 16px; color: #0F172A; line-height: 1.5; margin-bottom: 12px;">
                      Dear <strong>${name}</strong>,
                    </div>
                    <div style="font-size: 14px; color: #475569; line-height: 1.6; margin-bottom: 20px;">
                      Thank you for registering for the <strong>${eventName}</strong>. We're delighted to confirm your reservation. Below is your official entry pass with individual QR code(s). Please retain this email or download the attached PDF ticket for fast-track entry at the registration counter.
                    </div>

                    <!-- EVENT BRIEF SUMMARY -->
                    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #F1F5F9; border-radius: 12px; padding: 14px 16px; margin-bottom: 24px;">
                      <tr>
                        <td style="font-size: 12.5px; color: #334155; line-height: 1.6;">
                          📅 <strong>Date & Time:</strong> ${eventDateTime}<br>
                          📍 <strong>Venue:</strong> Caritas Agape Village, 7A Lorong 8 Toa Payoh, Singapore 319264<br>
                          🎟️ <strong>Total Seats / Attendees:</strong> ${totalSeats} Pass(es)
                        </td>
                      </tr>
                    </table>

                    <!-- MAIN PARTICIPANT PASS CARD -->
                    <div style="font-size: 13px; font-weight: 800; color: #0A1128; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 10px;">
                      PRIMARY PASS
                    </div>
                    ${renderPassCardHtml({
                      name,
                      categoryLabel: req.body.categoryLabel || 'Primary Delegate Registrant',
                      passId: mainPassId,
                      seat: primarySeat,
                      groupColor: mainGroupColor,
                      verseText: mainVerseText,
                      qrCid: mainQrBuffer ? 'qrcode_main_pass' : undefined,
                      qrPublicUrl: mainQrPublicUrl,
                      photoUrl,
                      isPrimary: true
                    })}

                    ${addonCardDataList.length > 0 ? `
                      <!-- ADDITIONAL ATTENDEE PASSES -->
                      <div style="font-size: 13px; font-weight: 800; color: #0A1128; text-transform: uppercase; letter-spacing: 1px; margin: 24px 0 10px 0;">
                        ADDITIONAL ATTENDEE PASSES (${addonCardDataList.length})
                      </div>
                      ${addonCardDataList.map(addonCard => renderPassCardHtml({
                        name: addonCard.name,
                        categoryLabel: addonCard.categoryLabel,
                        passId: addonCard.passId,
                        seat: addonCard.seat,
                        groupColor: addonCard.groupColor,
                        verseText: addonCard.verseText,
                        qrCid: addonCard.qrBuffer ? `qrcode_addon_${addonCard.idx}` : undefined,
                        qrPublicUrl: addonCard.qrPublicUrl,
                        isPrimary: false
                      })).join('')}
                    ` : ''}

                    <!-- SPECIAL BLESSING CALLOUT -->
                    <div style="background-color: #FFFBEB; border: 1.5px solid #FDE68A; border-radius: 12px; padding: 14px 16px; margin: 20px 0;">
                      <div style="font-size: 12.5px; font-weight: 800; color: #92400E; margin-bottom: 4px;">
                        ✨ A Special Gift of Grace: Partial Indulgence
                      </div>
                      <div style="font-size: 12px; color: #78350F; line-height: 1.5;">
                        A Partial Indulgence has been granted by the Apostolic Penitentiary to all the faithful who, after fulfilling the customary conditions, participate in the Thanksgiving Mass celebrated by His Eminence William Cardinal Goh.
                      </div>
                    </div>

                    <div style="border-top: 1px solid #EAE5DF; padding-top: 16px; margin-top: 24px; font-size: 13px; color: #64748B;">
                      Warm regards in Christ,<br>
                      <strong style="color: #0A1128;">Jesus Youth Singapore GRACIA Committee</strong>
                    </div>
                  </td>
                </tr>

                <!-- FOOTER -->
                <tr>
                  <td style="background-color: #F8FAFC; padding: 18px 24px; text-align: center; border-top: 1px solid #EAE5DF; font-size: 11.5px; color: #64748B;">
                    <p style="margin: 0 0 4px 0; font-weight: 700; color: #1E1B4B;">
                      Jesus Youth Singapore • 25th Jubilee (GRACIA)
                    </p>
                    <p style="margin: 0;">
                      <a href="https://singapore.jesusyouth.org/" style="color: #1E1B4B; text-decoration: none; font-weight: 600;">singapore.jesusyouth.org</a> | 
                      <a href="mailto:jysg25@jesusyouth.org" style="color: #1E1B4B; text-decoration: none; font-weight: 600;">jysg25@jesusyouth.org</a>
                    </p>
                  </td>
                </tr>

              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    // 1. Build Main Participant PDF Attachment
    const mainAttachments: any[] = [];

    if (pdfTicketBase64) {
      const cleanBase64 = pdfTicketBase64.includes(',') ? pdfTicketBase64.split(',')[1] : pdfTicketBase64;
      mainAttachments.push({
        filename: `GRACIA_Pass_${cleanFilename(name)}.pdf`,
        content: Buffer.from(cleanBase64, 'base64'),
        contentType: 'application/pdf'
      });
    } else {
      try {
        const serverPdfBuf = await generateServerPdfPassBuffer({
          name,
          email,
          phone,
          type,
          passId: mainPassId,
          categoryLabel: req.body.categoryLabel || 'Primary Delegate Registrant',
          seat: primarySeat,
          additionalAttendees,
          selectedSeats
        });
        mainAttachments.push({
          filename: `GRACIA_Pass_${cleanFilename(name)}.pdf`,
          content: serverPdfBuf,
          contentType: 'application/pdf'
        });
      } catch (pdfErr) {
        console.error('Failed to generate server PDF pass:', pdfErr);
      }
    }

    // Attach PDF passes for all additional group attendees to the primary registrant email
    for (const addonCard of addonCardDataList) {
      try {
        const addonPdfBuf = await generateServerPdfPassBuffer({
          name: addonCard.name,
          email: addonCard.email || email,
          phone,
          type,
          passId: addonCard.passId,
          categoryLabel: addonCard.categoryLabel,
          seat: addonCard.seat,
          isPrimary: false,
          primaryContactName: name
        });
        mainAttachments.push({
          filename: `GRACIA_Pass_${cleanFilename(addonCard.name)}.pdf`,
          content: addonPdfBuf,
          contentType: 'application/pdf'
        });
      } catch (addonPdfErr) {
        console.error(`Failed to generate PDF pass for attendee ${addonCard.name}:`, addonPdfErr);
      }
    }

    // Dispatch Main Registration Confirmation Email
    const mainMailResult = await sendMailWithFallback({
      to: email,
      subject,
      html: htmlTemplate,
      attachments: mainAttachments
    });

    const dispatchedEmails: string[] = mainMailResult.success ? [email] : [];
    let sentCount = mainMailResult.success ? 1 : 0;

    // 2. Dispatch Individual Unique Pass Emails to All Attendees with valid emails
    for (const addonCard of addonCardDataList) {
      try {
        const targetEmail = (addonCard.email || '').trim().toLowerCase();
        if (!targetEmail || !isValidEmail(targetEmail)) {
          console.log(`[Multi-Attendee Dispatch] Skipping additional attendee "${addonCard.name}": no valid email provided.`);
          continue;
        }

        const singleAddonAttachments: any[] = [];
        try {
          const addonPdfBuffer = await generateServerPdfPassBuffer({
            name: addonCard.name,
            email: targetEmail,
            phone: addonCard.phone || phone,
            type,
            passId: addonCard.passId,
            categoryLabel: addonCard.categoryLabel,
            seat: addonCard.seat,
            isPrimary: false,
            primaryContactName: name,
            selectedSeats: [addonCard.seat]
          });
          singleAddonAttachments.push({
            filename: `GRACIA_Pass_${cleanFilename(addonCard.name)}.pdf`,
            content: addonPdfBuffer,
            contentType: 'application/pdf'
          });
        } catch (addonPdfErr) {
          console.warn(`Could not generate PDF for attendee ${addonCard.name}:`, addonPdfErr);
        }

        const addonResult = await sendMailWithFallback({
          to: targetEmail,
          subject: `[Official Pass] ${eventName} Entry Ticket for ${addonCard.name} [${addonCard.passId}]`,
          html: `
            <!DOCTYPE html>
            <html>
            <head><meta charset="utf-8"><title>GRACIA Entry Ticket</title></head>
            <body style="margin: 0; padding: 0; background-color: #F8F6F3; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; color: #1E293B;">
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #F8F6F3; padding: 28px 12px;">
                <tr><td align="center">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; margin: 0 auto; width: 100%; background-color: #ffffff; border-radius: 20px; overflow: hidden; border: 1px solid #EAE5DF; box-shadow: 0 8px 32px rgba(0,0,0,0.05);">
                    <!-- 3-COLUMN BRAND HEADER BANNER -->
                    <tr>
                      <td style="background-color: #1a0b36; background: linear-gradient(135deg, #1C0838 0%, #120224 100%); padding: 0; text-align: center; color: #FFFFFF; border-bottom: 2.5px solid #F2B544;">
                        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="width: 100%; margin: 0 auto;">
                          <tr>
                            <!-- LEFT LOGO: JESUS YOUTH ROUND EMBLEM -->
                            <td width="22%" align="center" valign="middle" style="text-align: center; vertical-align: middle; padding: 18px 0;">
                              <img src="https://gracia2026.vercel.app/jysg_logo.png" 
                                   alt="Jesus Youth Singapore" 
                                   width="54" 
                                   height="54" 
                                   style="display: inline-block; width: 54px; height: 54px; margin: 0 auto; border: 0; outline: none;" />
                            </td>

                            <!-- CENTER COLUMN: HEADER TEXT BLOCK -->
                            <td width="56%" align="center" valign="middle" style="text-align: center; vertical-align: middle; padding: 18px 4px;">
                              <!-- 1. JESUS YOUTH SINGAPORE -->
                              <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 11px; font-weight: 800; color: #FFFFFF; letter-spacing: 2.5px; text-transform: uppercase; margin-bottom: 4px; line-height: 1.2; text-align: center;">
                                JESUS YOUTH SINGAPORE
                              </div>

                              <!-- 2. GRACIA VIBRANT DISPLAY TITLE -->
                              <div style="font-family: 'Arial Black', Impact, 'Segoe UI Black', -apple-system, sans-serif; font-size: 42px; font-weight: 900; letter-spacing: 5px; line-height: 1; margin: 4px 0 6px 0; text-align: center; text-transform: uppercase;">
                                <span style="color: #A855F7;">G</span><span style="color: #EC4899;">R</span><span style="color: #EF4444;">A</span><span style="color: #F97316;">C</span><span style="color: #F59E0B;">I</span><span style="color: #FACC15;">A</span>
                              </div>

                              <!-- 3. 25 YEARS OF GRACE IN SINGAPORE -->
                              <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #FFFFFF; font-size: 11.5px; font-weight: 800; letter-spacing: 1.8px; text-transform: uppercase; margin: 0 0 5px 0; text-align: center;">
                                25 YEARS OF GRACE IN SINGAPORE
                              </div>

                              <!-- 4. FAITHFUL WITNESS. JOYFUL MISSIONARY. -->
                              <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 10px; font-weight: 800; letter-spacing: 1.4px; text-transform: uppercase; text-align: center;">
                                <span style="color: #FF5376;">FAITHFUL WITNESS.</span>&nbsp;&nbsp;
                                <span style="color: #F28C38;">JOYFUL MISSIONARY.</span>
                              </div>
                            </td>

                            <!-- RIGHT LOGO: 25 JUBILEE LOGO -->
                            <td width="22%" align="center" valign="middle" style="text-align: center; vertical-align: middle; padding: 18px 0;">
                              <img src="https://gracia2026.vercel.app/jysg_jubilee_logo.png" 
                                   alt="25 Years of Grace in Singapore" 
                                   width="54" 
                                   height="54" 
                                   style="display: inline-block; width: 54px; height: 54px; margin: 0 auto; border: 0; outline: none;" />
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                    <tr>
                      <td style="background-color: #FFFFFF; padding: 20px 24px 12px 24px; text-align: center;">
                        <table border="0" cellpadding="0" cellspacing="0" align="center" style="margin: 0 auto;">
                          <tr>
                            <td style="background-color: #FFFFFF; border: 1.5px solid #F2B544; border-radius: 50px; padding: 6px 22px; box-shadow: 0 3px 12px rgba(24, 11, 53, 0.06); text-align: center;">
                              <span style="color: #E52B3E; font-size: 12px; font-weight: 900; margin-right: 6px; vertical-align: middle;">&#10003;</span>
                              <span style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 10.5px; font-weight: 800; letter-spacing: 1.5px; color: #180B35; text-transform: uppercase; vertical-align: middle;">
                                OFFICIAL PARTICIPANT PASS
                              </span>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding: 10px 28px 24px 28px;">
                        <div style="font-size: 16px; color: #0F172A; margin-bottom: 8px;">
                          Dear <strong>${addonCard.name}</strong>,
                        </div>
                        <div style="font-size: 14px; line-height: 1.6; color: #334155; margin-bottom: 20px;">
                          Praise the Lord! Here is your official conference pass and check-in QR code for <strong style="color: #0F172A;">${eventName}</strong> registered under <strong style="color: #0F172A;">${name}</strong>.
                        </div>

                        <!-- INDIVIDUAL PASS CARD -->
                        ${renderPassCardHtml({
                          name: addonCard.name,
                          categoryLabel: addonCard.categoryLabel,
                          passId: addonCard.passId,
                          seat: addonCard.seat,
                          groupColor: addonCard.groupColor,
                          verseText: addonCard.verseText,
                          qrCid: addonCard.qrBuffer ? 'qrcode_addon_single' : undefined,
                          qrPublicUrl: addonCard.qrPublicUrl,
                          isPrimary: false
                        })}

                        <div style="border-top: 1px solid #EAE5DF; padding-top: 16px; margin-top: 20px; font-size: 12.5px; color: #475569;">
                          In Christ,<br><strong style="color: #0F172A;">Jesus Youth Singapore GRACIA Jubilee Conference Team</strong>
                        </div>
                      </td>
                    </tr>
                  </table>
                </td></tr>
              </table>
            </body>
            </html>
          `,
          attachments: singleAddonAttachments
        });

        if (addonResult.success) {
          sentCount++;
          dispatchedEmails.push(targetEmail);
          console.log(`[Multi-Attendee Success] Dispatched pass email to ${targetEmail} for attendee "${addonCard.name}" (${addonCard.passId})`);
        } else {
          console.warn(`[Multi-Attendee Warning] Could not send pass email to ${targetEmail} for "${addonCard.name}":`, addonResult.error);
        }
      } catch (addonErr: any) {
        console.error(`[Multi-Attendee Error] Exception sending pass email for attendee "${addonCard.name}" (${addonCard.email}):`, addonErr);
        // Individual try/catch prevents a single failing email dispatch from breaking the overall transaction or loop!
      }
    }

    const uniqueDispatched = Array.from(new Set(dispatchedEmails));

    if (mainMailResult.success) {
      return res.status(200).json({ 
        status: "sent", 
        messageId: mainMailResult.messageId, 
        sentEmails: uniqueDispatched,
        recipientCount: sentCount,
        method: mainMailResult.method,
        message: `Successfully dispatched ${sentCount} confirmation email(s) to ${uniqueDispatched.join(', ')} with unique entry pass QR codes and PDF tickets!`
      });
    } else {
      return res.status(200).json({ 
        status: "notice", 
        message: "Email dispatch attempted (SMTP credentials or Apps Script required).",
        details: mainMailResult.error || "No active credentials.",
        hint: mainMailResult.hint || "Set SMTP_PASS (Gmail 16-character App Password) in Vercel environment variables to enable live delivery."
      });
    }
  } catch (err: any) {
    console.error("Vercel Email dispatch error:", err);
    return res.status(500).json({ status: "error", message: err.message || "Failed to process confirmation email." });
  }
}
