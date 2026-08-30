import QRCode from 'qrcode';
import { jsPDF } from 'jspdf';
import { RegistrationData } from '../types';
import { getBibleVersePassId, getBibleVerseText, getBibleVerseReference, getPersonDeterministicSeed } from './bibleVerses';
import { getParticipantGroupColor, GroupColorInfo } from './groupManager';
import { toProperCase } from './utils';

export async function generateQRCodeDataURI(text: string): Promise<string> {
  try {
    return await QRCode.toDataURL(text, {
      margin: 2,
      width: 250,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#241226',
        light: '#FFFFFF',
      },
    });
  } catch (err) {
    console.error('Error generating QR code:', err);
    return '';
  }
}

export async function generatePDFTicket(data: RegistrationData, docId?: string): Promise<{ pdfBase64: string; qrCodeDataUri: string }> {
  const isMusical = data.type === 'musical';
  const personSeed = getPersonDeterministicSeed(data.email, data.phone, data.name);
  const ticketId = data.passId || getBibleVersePassId(personSeed || docId || data.id, 0, data.name);
  const seatListStr = data.selectedSeats && data.selectedSeats.length > 0
    ? data.selectedSeats.map(s => `Row ${s.split('-')[0]} Seat ${s.split('-')[1]}`).join(', ')
    : 'General Admission / Unreserved';

  // Tagged Dependents (Pre-teens, Children, Kids, Toddlers - No separate QR required)
  const taggedDependents = (data.additionalAttendees || []).filter(a =>
    a.category === 'preteen' || a.category === 'child' || (a.categoryLabel && (a.categoryLabel.toLowerCase().includes('preteen') || a.categoryLabel.toLowerCase().includes('child') || a.categoryLabel.toLowerCase().includes('pre-teen')))
  );

  // Encode minimal Pass ID string for rapid, instantaneous scanning
  const qrCodeDataUri = await generateQRCodeDataURI(ticketId);

  // Initialize jsPDF document (Landscape ticket card or portrait standard pass)
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  // Ticket Dimensions & Canvas Styling
  doc.setFillColor(10, 17, 40); // #0A1128 Deep Navy Header Background
  doc.rect(20, 20, 170, 45, 'F');
  doc.setFillColor(245, 158, 11); // Amber accent bar
  doc.rect(20, 20, 170, 2.5, 'F');

  // Header Title
  doc.setTextColor(245, 158, 11); // Gold
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(20);
  doc.text('GRACIA', 30, 36);

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.setFont('Helvetica', 'bold');
  doc.text('JESUS YOUTH SINGAPORE • 25 YEARS OF GRACE', 30, 45);
  
  doc.setTextColor(244, 63, 94); // Coral / Rose
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(isMusical ? 'OFFICIAL MUSICAL CONCERT ENTRY TICKET' : 'OFFICIAL JUBILEE CONFERENCE PASS', 30, 54);

  // Ticket Body Box
  doc.setDrawColor(226, 232, 240); 
  doc.setLineWidth(1);
  doc.rect(20, 62, 170, 158);

  // Event Details
  doc.setTextColor(36, 18, 38);
  doc.setFontSize(11);
  doc.setFont('Helvetica', 'bold');
  doc.text('EVENT DETAILS', 30, 78);

  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Event: ${isMusical ? 'GRACIA Musical Concert' : 'GRACIA Jubilee Conference 2026'}`, 30, 86);
  doc.text(`Date & Time: ${isMusical ? 'Sunday, 11 October 2026 • 7:30 PM (Doors open 7:00 PM)' : 'Sat & Sun, 10–11 October 2026 • 9:00 AM - 6:00 PM'}`, 30, 93);
  doc.text(`Venue: ${isMusical ? 'Caritas Agape Village Main Auditorium, Lorong 8 Toa Payoh' : 'MPH, Caritas Agape Village, Singapore'}`, 30, 100);

  // Dashed Line Divider
  doc.setDrawColor(200, 200, 200);
  doc.setLineDashPattern([2, 2], 0);
  doc.line(30, 106, 180, 106);
  doc.setLineDashPattern([], 0);

  // Registrant Info
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('ATTENDEE & RESERVATION DETAILS', 30, 115);

  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.text(`Ticket Holder: ${data.name || 'Participant'}`, 30, 123);
  doc.text(`Email: ${data.email || 'N/A'}`, 30, 130);
  doc.text(`Contact Phone: ${data.phone || 'N/A'}`, 30, 137);
  doc.text(`Pass Reference ID: ${ticketId}`, 30, 144);

  // Add QR Code Image positioned neatly to the right
  if (qrCodeDataUri) {
    doc.addImage(qrCodeDataUri, 'PNG', 138, 110, 34, 34);
    doc.setFontSize(7.5);
    doc.setTextColor(120, 120, 120);
    doc.text('Scan & Confirm at Venue', 138, 147);
  }

  // Calculate dynamic wrapped lines for seat / category details
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(10);
  
  const depText = taggedDependents.length > 0
    ? ` | TAGGED DEPENDENTS: ${taggedDependents.map(d => `${d.name || 'Child'} (${d.categoryLabel || d.category})`).join(', ')}`
    : '';

  const seatText = isMusical 
    ? `ASSIGNED SEAT(S): ${seatListStr}${depText}` 
    : `CONFERENCE PASS TYPE: ${data.categoryLabel || 'Full Jubilee Conference Pass'} (${data.adultsCount || 1} Adult/Youth)${depText}`;

  const seatLines: string[] = doc.splitTextToSize(seatText, 140);

  const seatBoxY = 151;
  const lineSpacing = 5;
  const seatBoxHeight = Math.max(13, seatLines.length * lineSpacing + 5);

  // Highlighted Seat Box
  doc.setFillColor(254, 243, 199); // Amber light box
  doc.rect(30, seatBoxY, 150, seatBoxHeight, 'F');
  doc.setDrawColor(217, 119, 6);
  doc.rect(30, seatBoxY, 150, seatBoxHeight, 'S');

  doc.setTextColor(146, 64, 14); // Dark Amber
  seatLines.forEach((line: string, idx: number) => {
    doc.text(line, 35, seatBoxY + 6 + (idx * lineSpacing));
  });

  // Footer Instructions below seat box
  const footerStartY = seatBoxY + seatBoxHeight + 10;
  doc.setDrawColor(200, 200, 200);
  doc.line(30, footerStartY, 180, footerStartY);

  doc.setTextColor(100, 100, 100);
  doc.setFontSize(8);
  doc.text('• Please present this official pass (digital or printed) at the venue check-in counter.', 30, footerStartY + 7);
  doc.text('• QR code verification required for entrance confirmation.', 30, footerStartY + 12);
  doc.text('• For inquiries or group updates, contact singapore@jesusyouth.org', 30, footerStartY + 17);

  // Footer Bar
  doc.setFillColor(10, 17, 40);
  doc.rect(20, 215, 170, 12, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.setFont('Helvetica', 'bold');
  doc.text('JESUS YOUTH SINGAPORE • GRACIA (25 YEARS OF GRACE) 2026', 36, 222);

  // Export Base64 Data URL
  const pdfBase64 = doc.output('datauristring');
  return { pdfBase64, qrCodeDataUri };
}

export async function downloadPDFPass(data: RegistrationData, docId?: string): Promise<void> {
  const passes = await generateAllAttendeePasses(data, docId);
  if (passes.length === 1) {
    await downloadIndividualPassPDF(passes[0]);
    return;
  }

  // Multi-attendee PDF master ticket with individual QR codes for each registrant
  const isMusical = data.type === 'musical';
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  passes.forEach((pass, index) => {
    if (index > 0) {
      doc.addPage();
    }

    // Header Box
    doc.setFillColor(10, 17, 40);
    doc.rect(20, 20, 170, 45, 'F');
    doc.setFillColor(245, 158, 11);
    doc.rect(20, 20, 170, 2.5, 'F');

    doc.setTextColor(245, 158, 11);
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(20);
    doc.text('GRACIA', 30, 36);

    doc.setFontSize(9);
    doc.setFont('Helvetica', 'normal');
    doc.setTextColor(255, 255, 255);
    doc.text('JESUS YOUTH SINGAPORE • 25 YEARS OF GRACE', 30, 44);

    doc.setTextColor(244, 63, 94);
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.text(isMusical ? 'MUSICAL CONCERT ENTRY TICKET' : 'OFFICIAL JUBILEE CONFERENCE PASS', 30, 54);

    // Page indicator
    doc.setTextColor(253, 230, 138);
    doc.setFontSize(9);
    doc.setFont('Helvetica', 'bold');
    doc.text(`PASS ${index + 1} OF ${passes.length}`, 140, 36);

    // Border
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(1);
    doc.rect(20, 65, 170, 145);

    doc.setTextColor(10, 17, 40);
    doc.setFontSize(11);
    doc.setFont('Helvetica', 'bold');
    doc.text('EVENT DETAILS', 30, 78);

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Event: ${isMusical ? 'GRACIA Musical Concert' : 'GRACIA Jubilee Conference 2026'}`, 30, 86);
    doc.text(`Date & Time: ${isMusical ? 'Sunday, 11 October 2026 • 7:30 PM' : 'Sat & Sun, 10–11 October 2026 • 9:00 AM - 6:00 PM'}`, 30, 93);
    doc.text(`Venue: Caritas Agape Village, Lorong 8 Toa Payoh, Singapore`, 30, 100);

    doc.setDrawColor(200, 200, 200);
    doc.setLineDashPattern([2, 2], 0);
    doc.line(30, 106, 180, 106);
    doc.setLineDashPattern([], 0);

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('PASS HOLDER DETAILS', 30, 115);

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.text(`Pass Holder: ${pass.name}`, 30, 123);
    doc.text(`Category: ${pass.categoryLabel}`, 30, 130);
    doc.text(`Email: ${pass.email}`, 30, 137);
    doc.text(`Phone: ${pass.phone}`, 30, 144);
    doc.text(`Pass Reference ID: ${pass.passId}`, 30, 151);
    doc.text(`Group Primary Contact: ${pass.primaryContactName}`, 30, 158);

    if (pass.qrCodeDataUri) {
      doc.addImage(pass.qrCodeDataUri, 'PNG', 138, 115, 36, 36);
      doc.setFontSize(7.5);
      doc.setTextColor(120, 120, 120);
      doc.text('Scan for Entry', 140, 154);
    }

    // Seat Box
    doc.setFillColor(250, 248, 246);
    doc.rect(30, 165, 150, 15, 'F');
    doc.setDrawColor(241, 229, 222);
    doc.rect(30, 165, 150, 15, 'S');
    doc.setTextColor(15, 23, 42);
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(`ASSIGNED SEAT / PASS: ${pass.seat || 'General Admission'}`, 35, 174);

    // Footer bar
    doc.setFillColor(10, 17, 40);
    doc.rect(20, 200, 170, 10, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.setFont('Helvetica', 'bold');
    doc.text('JESUS YOUTH SINGAPORE • GRACIA 2026 OFFICIAL PASS', 42, 206);
  });

  const fileName = `GRACIA_All_Passes_${(data.name || 'Group').trim().replace(/\s+/g, '_')}.pdf`;
  doc.save(fileName);
}

export interface AttendeePassItem {
  passId: string;
  verseText?: string | null;
  verseReference?: string;
  name: string;
  categoryLabel: string;
  email: string;
  phone: string;
  isPrimary: boolean;
  primaryContactName: string;
  qrCodeDataUri: string;
  seat?: string;
  type?: 'conference' | 'musical';
  groupColor?: GroupColorInfo;
  photoUrl?: string;
}

export async function generateAllAttendeePasses(
  data: RegistrationData,
  primaryDocId?: string
): Promise<AttendeePassItem[]> {
  const isMusical = data.type === 'musical';
  const personSeed = getPersonDeterministicSeed(data.email, data.phone, data.name);
  const mainPassId = data.passId || getBibleVersePassId(personSeed || primaryDocId || data.id, 0, data.name);
  const mainVerseText = getBibleVerseText(mainPassId);
  const mainVerseRef = getBibleVerseReference(mainPassId);
  const mainGroupColor = getParticipantGroupColor(personSeed || primaryDocId || data.id, 0, data.name, undefined, mainPassId);
  const passes: AttendeePassItem[] = [];

  // 1. Primary Contact Pass
  const primarySeat = data.selectedSeats && data.selectedSeats.length > 0
    ? `Row ${data.selectedSeats[0].split('-')[0]} Seat ${data.selectedSeats[0].split('-')[1]}`
    : 'General Admission';

  const formattedPrimaryName = toProperCase(data.name || 'Primary Participant');
  // Minimal Pass ID string for instant scanning
  const primaryQrCodeDataUri = await generateQRCodeDataURI(mainPassId);

  passes.push({
    passId: mainPassId,
    verseText: mainVerseText,
    verseReference: mainVerseRef,
    name: formattedPrimaryName,
    categoryLabel: data.categoryLabel || (data.adultsCount === 0 && (data.teensCount || 0) > 0 ? 'Teen / Youth Delegate' : 'Conference Delegate'),
    email: data.email || 'N/A',
    phone: data.phone || 'N/A',
    isPrimary: true,
    primaryContactName: formattedPrimaryName,
    qrCodeDataUri: primaryQrCodeDataUri,
    seat: primarySeat,
    type: data.type,
    groupColor: mainGroupColor,
    photoUrl: (data as any).photoUrl || undefined
  });

  const seenPassIds = new Set<string>([mainPassId]);
  const seenNames = new Set<string>([formattedPrimaryName.toLowerCase()]);

  // 2. Additional Attendees Passes
  if (data.additionalAttendees && Array.isArray(data.additionalAttendees)) {
    for (let idx = 0; idx < data.additionalAttendees.length; idx++) {
      const addon = data.additionalAttendees[idx];
      if (!addon.name || !addon.name.trim()) continue;

      const formattedAddonName = toProperCase(addon.name.trim());
      const normalizedName = formattedAddonName.toLowerCase();

      // Avoid repeating primary contact or duplicate attendee entries
      if (seenNames.has(normalizedName)) continue;
      seenNames.add(normalizedName);

      const addonSeed = getPersonDeterministicSeed(addon.email, addon.phone, formattedAddonName) || `${personSeed}_ADD_${idx + 1}_${formattedAddonName.toLowerCase()}`;
      const addonPassId = addon.passId || getBibleVersePassId(addonSeed, idx + 1, formattedAddonName);

      if (seenPassIds.has(addonPassId)) continue;
      seenPassIds.add(addonPassId);

      const addonVerseText = getBibleVerseText(addonPassId);
      const addonVerseRef = getBibleVerseReference(addonPassId);
      const addonGroupColor = getParticipantGroupColor(addonSeed, idx + 1, formattedAddonName, undefined, addonPassId);
      const addonSeat = data.selectedSeats && data.selectedSeats[idx + 1]
        ? `Row ${data.selectedSeats[idx + 1].split('-')[0]} Seat ${data.selectedSeats[idx + 1].split('-')[1]}`
        : 'General Admission';

      const addonEmail = (addon.email && addon.email.trim()) ? addon.email.trim() : (data.email || 'N/A');
      const addonPhone = (addon.phone && addon.phone.trim()) ? addon.phone.trim() : (data.phone || 'N/A');

      const catLabel = addon.categoryLabel || (
        addon.category === 'adult' ? 'Adult / Youth (20+ yrs)' :
        addon.category === 'teen' ? 'Teen (13-19 yrs)' :
        addon.category === 'preteen' ? 'Pre-Teen (9-12 yrs)' : 'Child (6-8 yrs)'
      );

      // Minimal Pass ID string for instant scanning
      const addonQrCodeDataUri = await generateQRCodeDataURI(addonPassId);

      passes.push({
        passId: addonPassId,
        verseText: addonVerseText,
        verseReference: addonVerseRef,
        name: formattedAddonName,
        categoryLabel: catLabel,
        email: addonEmail,
        phone: addonPhone,
        isPrimary: false,
        primaryContactName: formattedPrimaryName,
        qrCodeDataUri: addonQrCodeDataUri,
        seat: addonSeat,
        type: data.type,
        groupColor: addonGroupColor,
        photoUrl: addon.photoUrl || undefined
      });
    }
  }

  return passes;
}

export async function downloadIndividualPassPDF(pass: AttendeePassItem): Promise<void> {
  const isMusical = pass.type === 'musical';
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  // Header Box
  doc.setFillColor(10, 17, 40);
  doc.rect(20, 20, 170, 45, 'F');
  doc.setFillColor(245, 158, 11);
  doc.rect(20, 20, 170, 2.5, 'F');

  doc.setTextColor(245, 158, 11);
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(22);
  doc.text('GRACIA', 30, 36);

  doc.setFontSize(9);
  doc.setFont('Helvetica', 'normal');
  doc.setTextColor(255, 255, 255);
  doc.text('JESUS YOUTH SINGAPORE • 25 YEARS OF GRACE', 30, 44);

  doc.setTextColor(244, 63, 94);
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(isMusical ? 'INDIVIDUAL MUSICAL CONCERT ENTRY PASS' : 'INDIVIDUAL JUBILEE CONFERENCE PASS', 30, 54);

  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(1);
  doc.rect(20, 65, 170, 145);

  doc.setTextColor(10, 17, 40);
  doc.setFontSize(11);
  doc.setFont('Helvetica', 'bold');
  doc.text('EVENT DETAILS', 30, 78);

  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Event: ${isMusical ? 'GRACIA Musical Concert' : 'GRACIA Jubilee Conference 2026'}`, 30, 86);
  doc.text(`Date & Time: ${isMusical ? 'Sunday, 11 October 2026 • 7:30 PM' : 'Sat & Sun, 10–11 October 2026 • 9:00 AM - 6:00 PM'}`, 30, 93);
  doc.text(`Venue: Caritas Agape Village, Lorong 8 Toa Payoh, Singapore`, 30, 100);

  doc.setDrawColor(200, 200, 200);
  doc.setLineDashPattern([2, 2], 0);
  doc.line(30, 106, 180, 106);
  doc.setLineDashPattern([], 0);

  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('PASS HOLDER DETAILS', 30, 115);

  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.text(`Pass Holder: ${pass.name}`, 30, 123);
  doc.text(`Category: ${pass.categoryLabel}`, 30, 130);
  doc.text(`Email: ${pass.email}`, 30, 137);
  doc.text(`Phone: ${pass.phone}`, 30, 144);
  doc.text(`Pass ID: ${pass.passId}`, 30, 151);
  doc.text(`Primary Contact: ${pass.primaryContactName}`, 30, 158);

  if (pass.qrCodeDataUri) {
    doc.addImage(pass.qrCodeDataUri, 'PNG', 138, 115, 36, 36);
    doc.setFontSize(7.5);
    doc.setTextColor(120, 120, 120);
    doc.text('Scan for Entry Verification', 136, 154);
  }

  // Seat box
  doc.setFillColor(250, 248, 246);
  doc.rect(30, 165, 150, 15, 'F');
  doc.setDrawColor(241, 229, 222);
  doc.rect(30, 165, 150, 15, 'S');
  doc.setTextColor(15, 23, 42);
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(`ASSIGNED SEAT / PASS TYPE: ${pass.seat || 'General Admission'}`, 35, 174);

  // Footer bar
  doc.setFillColor(10, 17, 40);
  doc.rect(20, 200, 170, 10, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.setFont('Helvetica', 'bold');
  doc.text('JESUS YOUTH SINGAPORE • GRACIA 2026 ENTRY PASS', 45, 206);

  const fileName = `GRACIA_Pass_${pass.name.trim().replace(/\s+/g, '_')}.pdf`;
  doc.save(fileName);
}
