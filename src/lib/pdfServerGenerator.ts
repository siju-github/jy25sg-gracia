import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import { toProperCase } from './utils';

// Deterministic Verse Pass ID helper (zero dependency)
function getInlineVersePassId(seed?: string, index: number = 0, name?: string): string {
  const cleanSeed = (seed || name || 'GRACIA').trim().toUpperCase();
  if (/^GRACIA-[A-Z0-9]{3,4}-[A-Z0-9]{2,3}-\d+:\d+$/i.test(cleanSeed)) {
    return cleanSeed;
  }
  const cleanName = (name || 'DELEGATE').replace(/[^a-zA-Z]/g, '').toUpperCase();
  const nameCode = cleanName.length >= 4 ? cleanName.substring(0, 4) : cleanName.padEnd(4, 'X');
  
  const books = ['ROM', 'EPH', 'PHI', 'COL', 'ISA', 'JER', 'PSA', 'PRO', 'JHN', 'MAT'];
  const verseRef = books[(cleanSeed.length + index) % books.length];
  const num = (Math.abs(cleanSeed.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) + index * 7) % 28) + 1;
  return `GRACIA-${nameCode}-${verseRef}-12:${num}`;
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

export async function generateServerPdfPassBuffer(data: ServerPdfPassData): Promise<Buffer> {
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
    name: toProperCase(data.name || 'Participant'),
    categoryLabel: data.categoryLabel || 'Conference Delegate',
    email: data.email || 'N/A',
    phone: data.phone || 'N/A',
    isPrimary: true,
    primaryContactName: toProperCase(data.name || 'Primary Contact'),
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
      const catLabel = addon.categoryLabel || (
        addon.category === 'adult' ? 'Adult / Youth (20+ yrs)' :
        addon.category === 'teen' ? 'Teen (13-19 yrs)' :
        addon.category === 'preteen' ? 'Pre-Teen (9-12 yrs)' :
        addon.category === 'child' ? 'Child (6-8 yrs)' :
        addon.category === 'kid' ? 'Kid (3-5 yrs)' :
        addon.category === 'toddler' ? 'Toddler (2 & under)' :
        'Delegate Member'
      );

      passes.push({
        passId: addonPassId,
        name: toProperCase(addon.name),
        categoryLabel: catLabel,
        email: addon.email || data.email || 'N/A',
        phone: addon.phone || data.phone || 'N/A',
        isPrimary: false,
        primaryContactName: toProperCase(data.name || 'Primary Contact'),
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

        // 1. TOP BRANDING HEADER (Navy Blue with Gold trim, matching email theme)
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
