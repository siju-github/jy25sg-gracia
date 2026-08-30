import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import QRCode from 'qrcode';
import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';



const currentDir = typeof __dirname !== 'undefined'
  ? __dirname
  : path.dirname(fileURLToPath(import.meta.url));

// Hardcoded public absolute production URLs hosted on Vercel CDN for 100% email client compatibility
const JY_OFFICIAL_LOGO_URL = "https://gracia2026.vercel.app/jysg_logo.png";
const JUBILEE_25_LOGO_URL = "https://gracia2026.vercel.app/jysg_jubilee_logo.png";

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

// Environment configurations
function getHitPayConfig() {
  const apiKey = (process.env.HITPAY_API_KEY || '').trim();
  const rawEnv = (process.env.HITPAY_ENV || 'production').trim().toLowerCase();
  const env = rawEnv === 'sandbox' ? 'sandbox' : 'production';
  const salt = (process.env.HITPAY_SALT || '').trim();
  const baseUrl = env === 'sandbox'
    ? 'https://api.sandbox.hit-pay.com/v1'
    : 'https://api.hit-pay.com/v1';

  return { apiKey, env, salt, baseUrl };
}

let aiClient: GoogleGenAI | null = null;
function getAIClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY || '';
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
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
    console.error(`[HitPay SMTP Validation Error] Cannot dispatch to "${recipientEmail}": address is not a valid RFC 5321 email address.`);
    return {
      success: false,
      error: `Invalid recipient address: "${recipientEmail}" is not a valid RFC 5321 email address.`,
      hint: `Please verify that the recipient email address is spelled correctly.`
    };
  }

  if (!pass) {
    const hint = "Please set SMTP_PASS (Gmail 16-character App Password) in Vercel Environment Variables.";
    console.error(`[HitPay SMTP Error] Cannot dispatch to ${recipientEmail}: SMTP_PASS is not configured.`);
    return {
      success: false,
      error: "SMTP_PASS not configured",
      hint
    };
  }

  // 1. Primary Attempt: Port 587 STARTTLS
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

    console.log(`[HitPay SMTP 587 Success] Dispatched email to ${recipientEmail}: ${info.messageId}`);
    return { success: true, messageId: info.messageId, method: 'smtp-port-587' };
  } catch (err587: any) {
    const isPermanentError = (err587.responseCode && err587.responseCode >= 500 && err587.responseCode < 600) || 
                             /553|550|554|501|invalid|rejected|553-5\.1\.3/i.test(err587.message || '');

    if (isPermanentError) {
      console.error(`[HitPay SMTP Recipient Rejected] Address "${recipientEmail}" was rejected by SMTP server: ${err587.message}`);
      return {
        success: false,
        error: `Recipient rejected: ${err587.message}`,
        hint: `Ensure the recipient email address is valid and active.`
      };
    }

    console.warn(`[HitPay SMTP 587 Warning] Failed to ${recipientEmail}: ${err587.message}. Trying Port 465 SSL...`);

    // 2. Secondary Attempt: Port 465 SSL
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

      console.log(`[HitPay SMTP 465 Success] Dispatched to ${recipientEmail}: ${info465.messageId}`);
      return { success: true, messageId: info465.messageId, method: 'smtp-port-465' };
    } catch (err465: any) {
      console.error(`[HitPay SMTP Error] Both Port 587 and Port 465 failed for ${recipientEmail}:`, err465.message);
      return {
        success: false,
        error: `SMTP dispatch failed: ${err465.message || err587.message}`,
        hint: `Verify that SMTP_USER is set to your Gmail address, SMTP_PASS is a valid 16-character Google App Password, and 2-Step Verification is active on ${senderEmail}.`
      };
    }
  }
}

/**
 * Verifies official HitPay Webhook HMAC-SHA256 signature
 */
function verifyHitPaySignature(payload: any, salt: string, signatureHeader?: string): boolean {
  if (!salt) return true; // If no salt configured, allow through
  if (!payload || typeof payload !== 'object') return false;

  const providedHmac = (signatureHeader || payload.hmac || '').trim();
  if (!providedHmac) return false;

  try {
    const sortedKeys = Object.keys(payload)
      .filter(k => k !== 'hmac' && payload[k] !== undefined && payload[k] !== null)
      .sort();

    const signatureString = sortedKeys.map(k => `${k}${payload[k]}`).join('');
    const calculatedHmac = crypto.createHmac('sha256', salt).update(signatureString).digest('hex');

    if (calculatedHmac.toLowerCase() === providedHmac.toLowerCase()) {
      return true;
    }

    const jsonHmac = crypto.createHmac('sha256', salt).update(JSON.stringify(payload)).digest('hex');
    return jsonHmac.toLowerCase() === providedHmac.toLowerCase();
  } catch (sigErr) {
    console.error('[HitPay Webhook Signature Error]:', sigErr);
    return false;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // CORS support
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
      'Access-Control-Allow-Headers',
      'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, HitPay-Signature, x-hitpay-signature, x-business-api-key'
    );

    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    const { apiKey, env, salt, baseUrl } = getHitPayConfig();
    
    // Robust action detection across query params, rewrite paths, and URLs
    const queryAction = String(req.query.action || '').toLowerCase();
    const rawPath = Array.isArray(req.query.path) 
      ? req.query.path.join('/') 
      : (req.query.path || queryAction || '');
    const urlPath = (req.url || '').split('?')[0].toLowerCase();

    let pathAction = String(rawPath).toLowerCase();
    if (queryAction === 'create-payment' || urlPath.includes('create-payment') || pathAction.includes('create-payment')) {
      pathAction = 'create-payment';
    } else if (queryAction === 'check-status' || queryAction === 'status' || urlPath.includes('status') || pathAction.includes('status')) {
      pathAction = 'status';
    } else if (urlPath.includes('simulate-success') || pathAction.includes('simulate-success')) {
      pathAction = 'simulate-success';
    } else if (urlPath.includes('verify-user-payment') || pathAction.includes('verify-user-payment')) {
      pathAction = 'verify-user-payment';
    } else if (urlPath.includes('webhook') || pathAction.includes('webhook')) {
      pathAction = 'webhook';
    }

    // 1. HITPAY SIMULATE SUCCESS (POST action=simulate-success)
    if (req.method === 'POST' && pathAction === 'simulate-success') {
      const { paymentRequestId } = req.body || {};
      if (!paymentRequestId) {
        return res.status(400).json({ status: "error", message: "paymentRequestId is required" });
      }
      return res.status(200).json({
        status: "success",
        paymentRequestId,
        paymentStatus: 'succeeded',
        message: "Payment successfully simulated!"
      });
    }

    // 2. HITPAY VERIFY USER PAYMENT (POST action=verify-user-payment)
    if (req.method === 'POST' && pathAction === 'verify-user-payment') {
      const { paymentRequestId, bankReference } = req.body || {};
      const targetId = paymentRequestId || bankReference;
      if (!targetId) {
        return res.status(400).json({ status: "error", message: "paymentRequestId or bankReference is required" });
      }

      if (apiKey && apiKey.length > 5 && targetId && !targetId.startsWith('hitpay_req_')) {
        try {
          const hpRes = await fetch(`${baseUrl}/payment-requests/${targetId}`, {
            headers: {
              'X-BUSINESS-API-KEY': apiKey,
              'x-api-key': apiKey,
              'X-Requested-With': 'XMLHttpRequest',
              'Accept': 'application/json'
            }
          });

          if (hpRes.ok) {
            const hpData = await hpRes.json();
            const hpStatus = String(hpData.status || '').toLowerCase();
            const isSettled = hpStatus === 'completed' || hpStatus === 'succeeded' || hpStatus === 'paid' || hpStatus === 'closed';

            if (isSettled) {
              return res.status(200).json({
                status: "success",
                paymentRequestId: targetId,
                paymentStatus: 'succeeded',
                isPaid: true,
                hitpayStatus: hpStatus,
                referenceNumber: bankReference || hpData.reference_number || targetId,
                message: `✓ PayNow transfer verified on HitPay! Status: ${hpStatus}`
              });
            } else {
              return res.status(200).json({
                status: "pending",
                paymentRequestId: targetId,
                paymentStatus: 'pending',
                isPaid: false,
                hitpayStatus: hpStatus || 'pending',
                referenceNumber: bankReference || hpData.reference_number || targetId,
                message: `Payment is still pending on HitPay. Current status: ${hpStatus || 'pending'}`
              });
            }
          } else {
            console.warn('[HitPay verify-user-payment] HitPay API response status:', hpRes.status);
          }
        } catch (err: any) {
          console.error('[HitPay Verify User Payment Query Error]:', err);
        }
      }

      return res.status(200).json({
        status: "pending",
        paymentRequestId: targetId,
        paymentStatus: 'pending',
        isPaid: false,
        hitpayStatus: 'pending',
        referenceNumber: bankReference || targetId,
        message: "Payment is pending verification on HitPay. Please scan the QR code and complete the transfer in your bank app first."
      });
    }

    // 3. HITPAY WEBHOOK RECEIVER (POST)
   /* if (req.method === 'POST' && (!pathAction || pathAction === 'webhook')) {
      try {
        const payload = req.body || {};
        const sigHeader = (req.headers['hitpay-signature'] || req.headers['x-hitpay-signature'] || '') as string;

        // Verify HMAC signature
        const isSignatureValid = verifyHitPaySignature(payload, salt, sigHeader);
        if (!isSignatureValid) {
          console.error('[HitPay Webhook Error] HMAC signature mismatch with HITPAY_SALT', {
            providedHeader: sigHeader,
            hasSalt: Boolean(salt)
          });
          return res.status(401).json({ status: 'error', message: 'Unauthorized webhook signature' });
        }*/
    // 3. HITPAY WEBHOOK RECEIVER (POST)
    if (req.method === 'POST' && (pathAction === 'webhook' || req.headers['hitpay-signature'] || req.headers['x-hitpay-signature'] || (req.body && req.body.hmac))) {
      try {
      const payload = req.body || {};
      const sigHeader = (req.headers['hitpay-signature'] || req.headers['x-hitpay-signature'] || payload.hmac || '') as string;

    // Verify HMAC signature only if salt exists
    if (salt && sigHeader) {
      const isSignatureValid = verifyHitPaySignature(payload, salt, sigHeader);
      if (!isSignatureValid) {
        console.error('[HitPay Webhook Error] HMAC signature mismatch with HITPAY_SALT');
        return res.status(401).json({ status: 'error', message: 'Unauthorized webhook signature' });
      }
    }
        const status = String(payload.status || (payload.data && payload.data.status) || '').toLowerCase();
        const paymentId = payload.payment_id || payload.id || (payload.data && (payload.data.payment_id || payload.data.id)) || `hp_${Date.now()}`;
        const referenceNumber = payload.reference_number || (payload.data && payload.data.reference_number) || 'GRACIA';
        const amount = payload.amount || (payload.data && payload.data.amount) || '0';
        
        // Extract attendee details across all possible HitPay webhook formats
        const attendeeEmail = String(
          payload.buyer_email ||
          payload.customer_email ||
          payload.email ||
          (payload.data && (payload.data.buyer_email || payload.data.customer_email || payload.data.email)) ||
          ''
        ).trim();

        const attendeeName = String(
          payload.buyer_name ||
          payload.customer_name ||
          payload.name ||
          (payload.data && (payload.data.buyer_name || payload.data.customer_name || payload.data.name)) ||
          'Delegate'
        ).trim();

        const attendeePhone = String(
          payload.buyer_phone ||
          payload.customer_phone ||
          payload.phone ||
          (payload.data && (payload.data.buyer_phone || payload.data.customer_phone || payload.data.phone)) ||
          ''
        ).trim();

        console.log(`[HitPay Webhook Received] status=${status}, paymentId=${paymentId}, ref=${referenceNumber}, amount=${amount}, email=${attendeeEmail}, name=${attendeeName}`);

        const isPaymentSuccessful = status === 'completed' || status === 'succeeded' || status === 'paid' || status === 'closed';

        let emailDispatchResult: any = null;

        // If payment is completed/succeeded and we have an attendee email, trigger confirmation pass & email dispatch
        if (isPaymentSuccessful && attendeeEmail && isValidEmail(attendeeEmail)) {
          try {
            console.log(`[HitPay Webhook Action] Generating confirmation pass and dispatching email for ${attendeeEmail}...`);

            const isMusical = referenceNumber.toLowerCase().includes('musical') || 
              String(payload.purpose || (payload.data && payload.data.purpose) || '').toLowerCase().includes('musical');

            const eventName = isMusical ? 'GRACIA Musical Concert' : 'GRACIA Jubilee Conference 2026';
            const passId = referenceNumber.startsWith('GRACIA-') ? referenceNumber : `GRACIA-${attendeeName.replace(/[^a-zA-Z]/g, '').substring(0, 4).toUpperCase() || 'PASS'}-CONF-${Date.now().toString().slice(-4)}`;

            // 1. Generate Server PDF Pass Buffer (Strictly Awaited)
            let pdfBuffer: Buffer | null = null;
            try {
              pdfBuffer = await generateServerPdfPassBuffer({
                name: attendeeName,
                email: attendeeEmail,
                phone: attendeePhone,
                type: isMusical ? 'musical' : 'conference',
                passId,
                categoryLabel: isMusical ? 'Musical Concert Guest' : 'Conference Delegate'
              });
              console.log(`[HitPay Webhook Success] PDF pass buffer generated (${pdfBuffer.length} bytes) for ${attendeeEmail}`);
            } catch (pdfErr: any) {
              console.error('[HitPay Webhook Error] PDF generation failed:', pdfErr);
            }

            // 2. Generate QR code for email body
            let qrPublicUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&ecc=M&margin=2&data=${encodeURIComponent(passId)}`;

            // 3. Build HTML Email Template
            const htmlContent = `
              <!DOCTYPE html>
              <html>
              <head><meta charset="utf-8"><title>GRACIA Payment & Registration Pass</title></head>
              <body style="margin: 0; padding: 0; background-color: #FAF8F6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0F172A;">
                <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #FAF8F6; padding: 32px 16px;">
                  <tr>
                    <td align="center">
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; margin: 0 auto; width: 100%; background-color: #FFFFFF; border-radius: 16px; overflow: hidden; border: 1px solid #E2D9D0;">
                        <!-- PREMIUM MINIMALIST GRACIA HEADER -->
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
                                  <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 11px; font-weight: 800; color: #FFFFFF; letter-spacing: 2.5px; text-transform: uppercase; margin-bottom: 4px; line-height: 1.2; text-align: center;">
                                    JESUS YOUTH SINGAPORE
                                  </div>
                                  <div style="font-family: 'Arial Black', Impact, 'Segoe UI Black', -apple-system, sans-serif; font-size: 42px; font-weight: 900; letter-spacing: 5px; line-height: 1; margin: 4px 0 6px 0; text-align: center; text-transform: uppercase;">
                                    <span style="color: #A855F7;">G</span><span style="color: #EC4899;">R</span><span style="color: #EF4444;">A</span><span style="color: #F97316;">C</span><span style="color: #F59E0B;">I</span><span style="color: #FACC15;">A</span>
                                  </div>
                                  <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #FFFFFF; font-size: 11.5px; font-weight: 800; letter-spacing: 1.8px; text-transform: uppercase; margin: 0 0 5px 0; text-align: center;">
                                    25 YEARS OF GRACE IN SINGAPORE
                                  </div>
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
                          <td style="padding: 28px 24px;">
                            <div style="text-align: center; margin-bottom: 20px;">
                              <span style="display: inline-block; background-color: #ECFDF5; border: 1.5px solid #10B981; color: #065F46; font-size: 12px; font-weight: 800; padding: 6px 16px; border-radius: 24px; letter-spacing: 0.5px; text-transform: uppercase;">
                                ✓ REGISTRATION CONFIRMED
                              </span>
                            </div>

                            <p style="margin: 0 0 16px 0; font-size: 15px; color: #0F172A;">Dear <strong>${toProperCase(attendeeName)}</strong>,</p>
                            <p style="margin: 0 0 16px 0; font-size: 14.5px; line-height: 1.6; color: #334155;">
                              Thank you! Your payment of <strong>SGD $${Number(amount).toFixed(2)}</strong> for <strong>${eventName}</strong> has been successfully processed (HitPay Ref: ${paymentId}).
                            </p>

                            <div style="background-color: #FAF8F6; border: 1.5px solid #E2D9D0; border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 20px;">
                              <div style="font-size: 12px; font-weight: 700; color: #64748B; text-transform: uppercase;">Official Delegate Pass ID</div>
                              <div style="font-size: 18px; font-weight: 800; color: #0A1128; margin: 4px 0 14px 0;">${passId}</div>
                              <img src="${qrPublicUrl}" alt="Pass QR Code" width="180" height="180" style="border: 1px solid #E2D9D0; border-radius: 8px; background: #fff; padding: 6px; display: block; margin: 0 auto;" />
                              <p style="margin: 10px 0 0 0; font-size: 12px; color: #64748B;">Present this QR code or attached PDF ticket at registration check-in.</p>
                            </div>

                            <!-- SPECIAL BLESSING CALLOUT -->
                            <div style="background-color: #FFFBEB; border: 1.5px solid #FDE68A; border-radius: 12px; padding: 14px 16px; margin: 20px 0;">
                              <div style="font-size: 12.5px; font-weight: 800; color: #92400E; margin-bottom: 4px;">
                                ✨ A Special Gift of Grace: Partial Indulgence
                              </div>
                              <div style="font-size: 12px; color: #78350F; line-height: 1.5;">
                                A Partial Indulgence has been granted by the Apostolic Penitentiary to all the faithful who, after fulfilling the customary conditions, participate in the Thanksgiving Mass celebrated by His Eminence William Cardinal Goh.
                              </div>
                            </div>

                            <p style="margin: 0; font-size: 12.5px; color: #64748B; border-top: 1px solid #E2D9D0; padding-top: 16px;">
                              In Christ,<br><strong style="color: #0A1128;">Jesus Youth Singapore GRACIA Jubilee Conference Team</strong>
                            </p>
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

            const emailAttachments: any[] = [];

            if (pdfBuffer) {
              emailAttachments.push({
                filename: `GRACIA_Pass_${attendeeName.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`,
                content: pdfBuffer,
                contentType: 'application/pdf'
              });
            }

            // 4. Dispatch Email (Strictly Awaited)
            emailDispatchResult = await sendMailWithFallback({
              to: attendeeEmail,
              subject: isMusical 
                ? "GRACIA | Musical Concert Pass | Jesus Youth Singapore Celebrating 25 Years of Grace!" 
                : "GRACIA | Conference Pass | Jesus Youth Singapore Celebrating 25 Years of Grace!",
              html: htmlContent,
              attachments: emailAttachments
            });

            console.log(`[HitPay Webhook Email Result] Delivered to ${attendeeEmail}: success=${emailDispatchResult.success}, method=${emailDispatchResult.method}`);
          } catch (emailErr: any) {
            console.error('[HitPay Webhook Email Error] Failed to send confirmation email:', emailErr);
          }
        }

        // Return HTTP 200 OK with { status: "success" } immediately after processing so HitPay registers webhook delivery
        return res.status(200).json({
          status: "success",
          received: true,
          paymentId,
          referenceNumber,
          paymentStatus: status,
          emailDispatched: emailDispatchResult ? emailDispatchResult.success : false,
          emailMethod: emailDispatchResult ? emailDispatchResult.method : undefined,
          message: 'Webhook processed and confirmation tasks completed successfully'
        });
      } catch (err: any) {
        console.error('[HitPay Webhook Fatal Error]:', err);
        return res.status(500).json({ status: 'error', message: err.message || 'Webhook processing failed' });
      }
    }

    // 4. CREATE PAYMENT REQUEST (POST action=create-payment)
    if (req.method === 'POST' && (pathAction === 'create-payment' || (req.body && req.body.amount !== undefined && (!pathAction || pathAction === 'hitpay')))) {
      try {
        const { amount, currency = 'SGD', email, name, phone, purpose, referenceNumber, redirectUrl, webhookUrl } = req.body || {};
        const numAmount = Number(amount) || 25.00;

        if (isNaN(numAmount) || numAmount <= 0) {
          return res.status(400).json({ status: 'error', message: 'Invalid payment amount' });
        }

        const effectiveWebhook = webhookUrl || 'https://gracia2026.vercel.app/api/hitpay';
        const effectiveRedirectUrl = redirectUrl || `https://gracia2026.vercel.app/?session=checkout_return&ref=${encodeURIComponent(referenceNumber || '')}`;

        if (apiKey && apiKey.length > 5) {
          const urlParams = new URLSearchParams();
          urlParams.append('amount', numAmount.toFixed(2));
          urlParams.append('currency', 'SGD');
          if (email) urlParams.append('email', email);
          if (name) urlParams.append('name', name);
          if (phone) urlParams.append('phone', phone);
          urlParams.append('purpose', purpose || `GRACIA Jubilee Payment (${referenceNumber || 'Delegate'})`);
          if (referenceNumber) urlParams.append('reference_number', referenceNumber);
          urlParams.append('payment_methods[0]', 'paynow_online');
          urlParams.append('generate_qr', 'true');
          urlParams.append('redirect_url', effectiveRedirectUrl);
          urlParams.append('webhook', effectiveWebhook);

          const hpRes = await fetch(`${baseUrl}/payment-requests`, {
            method: 'POST',
            headers: {
              'X-BUSINESS-API-KEY': apiKey,
              'x-api-key': apiKey,
              'X-Requested-With': 'XMLHttpRequest',
              'Content-Type': 'application/x-www-form-urlencoded',
              'Accept': 'application/json'
            },
            body: urlParams.toString()
          });

          if (hpRes.ok) {
            const hpData = await hpRes.json();
            let rawQr = hpData.qr_code || hpData.paynow_qr || hpData.qr_code_data || null;
            let hitpayQrDataUrl: string | null = null;

            if (rawQr && typeof rawQr === 'string') {
              if (rawQr.startsWith('000201')) {
                hitpayQrDataUrl = await QRCode.toDataURL(rawQr, { width: 400, margin: 2, errorCorrectionLevel: 'M' });
              } else if (rawQr.startsWith('data:image') || /\.(png|jpg|jpeg|gif|svg)(\?.*)?$/i.test(rawQr)) {
                hitpayQrDataUrl = rawQr;
              }
            }

            return res.status(200).json({
              status: 'success',
              id: hpData.id,
              payment_id: hpData.id,
              paymentRequestId: hpData.id,
              url: hpData.url || null,
              checkoutUrl: hpData.url || null,
              referenceNumber: referenceNumber || hpData.reference_number,
              amount: numAmount,
              currency: 'SGD',
              hitpayQrCode: hpData.qr_code || null,
              hitpayQrDataUrl,
              hitpayActive: true,
              hitpayEnv: env,
              paymentStatus: 'pending',
              hitpayResponse: hpData
            });
          } else {
            const errText = await hpRes.text();
            console.error('[HitPay Create Payment Gateway Error]:', hpRes.status, errText);
            return res.status(hpRes.status).json({
              status: 'error',
              message: `HitPay API Error (${hpRes.status}): ${errText}`
            });
          }
        } else {
          return res.status(400).json({
            status: 'error',
            message: 'HITPAY_API_KEY environment variable is missing or invalid'
          });
        }
      } catch (err: any) {
        console.error('[HitPay Create Payment Error]:', err);
        return res.status(500).json({ status: 'error', message: err.message || 'Payment request failed' });
      }
    }

    // 5. GET STATUS CHECK (GET)
    if (req.method === 'GET') {
      let requestId = (req.query.id || req.query.payment_request_id || req.query.requestId || req.query.payment_id || req.query.reference_number || '') as string;
      const refNumber = (req.query.ref || req.query.refNumber || req.query.referenceNumber || '') as string;

      if (!requestId || requestId.toLowerCase() === 'status') {
        const urlSegments = (req.url || '').split('?')[0].split('/').filter(Boolean);
        if (urlSegments.length > 0) {
          const lastSegment = urlSegments[urlSegments.length - 1];
          if (lastSegment && lastSegment !== 'hitpay' && lastSegment !== 'status') {
            requestId = lastSegment;
          }
        }
      }

      const queryTarget = requestId || refNumber;

      if (apiKey && apiKey.length > 5 && queryTarget && queryTarget.toLowerCase() !== 'status' && !queryTarget.startsWith('GRACIA-') && !queryTarget.startsWith('hitpay_req_')) {
        try {
          const hpRes = await fetch(`${baseUrl}/payment-requests/${queryTarget}`, {
            headers: {
              'X-BUSINESS-API-KEY': apiKey,
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            }
          });

          if (hpRes.ok) {
            const hpData = await hpRes.json();
            const hpStatus = String(hpData.status || '').toLowerCase();
            const isSettled = hpStatus === 'completed' || hpStatus === 'succeeded' || hpStatus === 'paid' || hpStatus === 'closed';

            return res.status(200).json({
              success: true,
              status: isSettled ? 'completed' : hpStatus,
              payment_status: isSettled ? 'completed' : 'pending',
              paymentRequestId: queryTarget,
              paymentStatus: isSettled ? 'completed' : 'pending',
              hitpayStatus: hpStatus,
              isPaid: isSettled,
              isSettled,
              amount: Number(hpData.amount || 0),
              referenceNumber: hpData.reference_number || refNumber || '',
              hitpayResponse: hpData
            });
          }
        } catch (pollErr: any) {
          console.error('[HitPay Poll Error]:', pollErr);
        }
      }

      return res.status(200).json({
        success: true,
        status: 'pending',
        payment_status: 'pending',
        paymentRequestId: queryTarget || 'N/A',
        paymentStatus: 'pending',
        isPaid: false,
        isSettled: false,
        referenceNumber: refNumber,
        env,
        hasApiKey: Boolean(apiKey && apiKey.length > 5)
      });
    }

    return res.status(405).json({ status: 'error', message: 'Method not allowed' });
  } catch (fatalError: any) {
    console.error('[HitPay Handler Fatal Exception]:', fatalError);
    return res.status(500).json({
      status: 'error',
      message: fatalError.message || 'Internal Server Error'
    });
  }
}

