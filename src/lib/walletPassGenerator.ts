import JSZip from 'jszip';
import { RegistrationData } from '../types';
import { generateQRCodeDataURI } from './ticketGenerator';
import { getBibleVersePassId } from './bibleVerses';

// 1. Generate High-Res Pass Card PNG via HTML5 Canvas
export async function generateWalletPassImage(data: RegistrationData, docId?: string): Promise<string> {
  const isMusical = data.type === 'musical';
  const passId = getBibleVersePassId(docId || data.id, 0, data.name);
  const qrDataUri = await generateQRCodeDataURI(passId);

  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    canvas.width = 600;
    canvas.height = 960;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      resolve('');
      return;
    }

    // Canvas Background (Deep Royal Purple gradient with gold accents)
    const gradient = ctx.createLinearGradient(0, 0, 0, 960);
    gradient.addColorStop(0, '#1c0924');
    gradient.addColorStop(0.5, '#2b1038');
    gradient.addColorStop(1, '#0f0414');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 600, 960);

    // Border Frame (Gold foil 2px)
    ctx.strokeStyle = '#d97706';
    ctx.lineWidth = 4;
    ctx.strokeRect(12, 12, 576, 936);

    // Header Bar
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(14, 14, 572, 10);

    // Top Header Text
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 26px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('JESUS YOUTH SINGAPORE', 300, 60);

    ctx.fillStyle = '#fcd34d';
    ctx.font = '600 14px sans-serif';
    ctx.fillText('GRACIA • 25 YEARS OF GRACE', 300, 85);

    // Event Pill Category Tag
    const passTypeTitle = isMusical ? 'GRACIA - Musical Concert Ticket' : 'GRACIA - Jubilee Conference Pass';
    ctx.fillStyle = isMusical ? '#c81e6e' : '#3b82f6';
    ctx.beginPath();
    if (typeof (ctx as any).roundRect === 'function') {
      (ctx as any).roundRect(80, 105, 440, 38, 19);
    } else {
      ctx.rect(80, 105, 440, 38);
    }
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText(passTypeTitle, 300, 129);

    // Card White Inner Area for Details
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    if (typeof (ctx as any).roundRect === 'function') {
      (ctx as any).roundRect(30, 160, 540, 760, 20);
    } else {
      ctx.rect(30, 160, 540, 760);
    }
    ctx.fill();

    // Details Text
    ctx.textAlign = 'left';
    ctx.fillStyle = '#64748b';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText('PASS HOLDER / PARTICIPANT', 55, 195);
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText(data.name || 'Participant', 55, 222);

    ctx.fillStyle = '#64748b';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText('EMAIL ADDRESS', 55, 255);
    ctx.fillStyle = '#1e293b';
    ctx.font = '16px sans-serif';
    ctx.fillText(data.email || 'N/A', 55, 278);

    ctx.fillStyle = '#64748b';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText('CONTACT PHONE', 340, 255);
    ctx.fillStyle = '#1e293b';
    ctx.font = '16px sans-serif';
    ctx.fillText(data.phone || 'N/A', 340, 278);

    // Seat / Category Highlight Box
    ctx.fillStyle = '#fef3c7';
    ctx.beginPath();
    if (typeof (ctx as any).roundRect === 'function') {
      (ctx as any).roundRect(50, 305, 500, 75, 12);
    } else {
      ctx.rect(50, 305, 500, 75);
    }
    ctx.fill();
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#92400e';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText(isMusical ? 'RESERVED SEATING DETAILS' : 'CONFERENCE PASS CATEGORY', 70, 330);

    ctx.fillStyle = '#78350f';
    ctx.font = 'bold 16px sans-serif';
    const seatStr = isMusical 
      ? (data.selectedSeats && data.selectedSeats.length > 0 ? data.selectedSeats.map(s => `Row ${s.split('-')[0]} Seat ${s.split('-')[1]}`).join(', ') : 'General Admission')
      : `${data.categoryLabel || 'Jubilee Conference Pass'} (${data.adultsCount || 1} Person)`;
    ctx.fillText(seatStr, 70, 358);

    // Event Date & Time
    ctx.fillStyle = '#64748b';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText('DATE & TIME', 55, 415);
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText(isMusical ? 'Sunday, 11 Oct 2026 • 7:30 PM (Doors 7:00 PM)' : 'Sat & Sun, 10–11 Oct 2026 • 9:00 AM - 6:00 PM', 55, 438);

    // Venue
    ctx.fillStyle = '#64748b';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText('VENUE LOCATION', 55, 470);
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText(isMusical ? 'Caritas Agape Village Main Auditorium, Lor 8 Toa Payoh' : 'MPH, Caritas Agape Village, Singapore', 55, 493);

    // Serial Code Box
    ctx.fillStyle = '#f1f5f9';
    ctx.beginPath();
    if (typeof (ctx as any).roundRect === 'function') {
      (ctx as any).roundRect(50, 515, 500, 42, 10);
    } else {
      ctx.rect(50, 515, 500, 42);
    }
    ctx.fill();

    ctx.fillStyle = '#475569';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText('PASS SERIAL CODE:', 70, 541);
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 16px monospace';
    ctx.fillText(passId, 220, 541);

    // QR Code Image (Moved UP and Centered)
    if (qrDataUri) {
      const qrImg = new Image();
      qrImg.onload = () => {
        // Centered QR Code at x = (600 - 240) / 2 = 180, y = 580
        ctx.drawImage(qrImg, 180, 575, 240, 240);
        
        ctx.textAlign = 'center';
        ctx.fillStyle = '#334155';
        ctx.font = 'bold 13px sans-serif';
        ctx.fillText('SCAN & CONFIRM AT VENUE CHECK-IN', 300, 840);

        ctx.fillStyle = '#94a3b8';
        ctx.font = '11px sans-serif';
        ctx.fillText('Jesus Youth Singapore • GRACIA (25 Years of Grace)', 300, 885);

        resolve(canvas.toDataURL('image/png'));
      };
      qrImg.src = qrDataUri;
    } else {
      resolve(canvas.toDataURL('image/png'));
    }
  });
}

// 2. Download Wallet Pass Image (PNG) with Direct Blob Download
export async function downloadWalletPassImage(data: RegistrationData, docId?: string): Promise<void> {
  const imageUrl = await generateWalletPassImage(data, docId);
  if (!imageUrl) return;

  const fileName = `GRACIA_Pass_Card_${(data.name || 'Participant').trim().replace(/\s+/g, '_')}.png`;

  try {
    // Convert base64 Data URL to Blob for clean cross-browser & iOS download
    const res = await fetch(imageUrl);
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = fileName;
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();

    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    }, 2000);
  } catch (err) {
    console.error('Error downloading pass image:', err);
    // Fallback to direct data URL download
    const a = document.createElement('a');
    a.href = imageUrl;
    a.download = fileName;
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => document.body.removeChild(a), 1000);
  }
}

// 3. Apple Wallet Pass Generator with WalletWallet API integration
export interface ApplePassResult {
  success: boolean;
  reason?: 'KEY_MISSING' | 'API_ERROR' | 'DOWNLOADED';
  message?: string;
}

export async function downloadApplePKPass(data: RegistrationData, docId?: string): Promise<ApplePassResult> {
  const isMusical = data.type === 'musical';
  const passId = getBibleVersePassId(docId || data.id, 0, data.name);

  try {
    // Attempt to issue signed pass via WalletWallet server API
    const response = await fetch('/api/generate-pkpass', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: data.name,
        email: data.email,
        phone: data.phone,
        type: data.type,
        passId
      })
    });

    if (response.ok) {
      const result = await response.json();

      if (result.status === 'success') {
        if (result.shareUrl) {
          // Open WalletWallet pass page with native 1-click Add to Apple & Google Wallet
          window.open(result.shareUrl, '_blank');
          return { success: true, reason: 'DOWNLOADED' };
        }

        if (result.applePass) {
          // Decode base64 signed .pkpass - iOS Safari will natively prompt "Add to Apple Wallet"
          const binaryStr = window.atob(result.applePass);
          const bytes = new Uint8Array(binaryStr.length);
          for (let i = 0; i < binaryStr.length; i++) {
            bytes[i] = binaryStr.charCodeAt(i);
          }
          const blob = new Blob([bytes], { type: 'application/vnd.apple.pkpass' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `GRACIA_Pass_${(data.name || 'Participant').trim().replace(/\s+/g, '_')}.pkpass`;
          document.body.appendChild(a);
          a.click();
          setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
          }, 2000);
          return { success: true, reason: 'DOWNLOADED' };
        }
      }

      if (result.status === 'notice') {
        return {
          success: false,
          reason: 'KEY_MISSING',
          message: result.message || 'WALLETWALLETI_API_KEY environment variable is required on Vercel.'
        };
      }
    }
  } catch (err: any) {
    console.warn("WalletPass API endpoint error:", err);
    return { success: false, reason: 'API_ERROR', message: err?.message };
  }

  return { success: false, reason: 'API_ERROR' };
}

// 4. Download Apple iCal (.ics) Calendar Event
export function downloadAppleCalendarEvent(data: RegistrationData, docId?: string): void {
  const isMusical = data.type === 'musical';
  const passId = getBibleVersePassId(docId || data.id, 0, data.name);

  const title = isMusical ? 'GRACIA Musical Concert' : 'GRACIA Jubilee Conference';
  const location = isMusical ? 'Caritas Agape Village Main Auditorium, Lorong 8 Toa Payoh, Singapore' : 'MPH, Caritas Agape Village, Singapore';
  const description = `GRACIA Pass\\nParticipant: ${data.name}\\nPass Ref: ${passId}\\nCheck-in Verification URL: https://gracia.vercel.app/`;

  const dtStart = isMusical ? '20261011T113000Z' : '20261010T010000Z'; // UTC equivalent for SGT (UTC+8)
  const dtEnd = isMusical ? '20261011T140000Z' : '20261011T100000Z';

  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Jesus Youth Singapore//GRACIA//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `SUMMARY:${title}`,
    `DESCRIPTION:${description}`,
    `LOCATION:${location}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `STATUS:CONFIRMED`,
    `UID:gracia-${passId}@jesusyouth.org`,
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');

  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `GRACIA_Apple_Calendar_${(data.name || 'Pass').trim().replace(/\s+/g, '_')}.ics`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 2000);
}

// 5. Open Google Calendar Add Link
export function openGoogleCalendarEvent(data: RegistrationData, docId?: string): void {
  const isMusical = data.type === 'musical';
  const passId = getBibleVersePassId(docId || data.id, 0, data.name);

  const title = encodeURIComponent(isMusical ? 'GRACIA Musical Concert' : 'GRACIA Jubilee Conference');
  const location = encodeURIComponent(isMusical ? 'Caritas Agape Village Main Auditorium, Lorong 8 Toa Payoh, Singapore' : 'MPH, Caritas Agape Village, Singapore');
  const details = encodeURIComponent(`Official Event Pass for ${data.name}.\nPass ID: ${passId}\nWebsite & Verification: https://gracia.vercel.app/`);

  const dates = isMusical ? '20261011T113000Z/20261011T140000Z' : '20261010T010000Z/20261011T100000Z';

  const gcalUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${dates}&details=${details}&location=${location}`;
  window.open(gcalUrl, '_blank');
}
