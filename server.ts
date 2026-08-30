import express from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import nodemailer from "nodemailer";
import QRCode from "qrcode";
import { getBibleVersePassId, getBibleVerseText, getBibleVerseReference } from "./src/lib/bibleVerses";
import { getParticipantGroupColor } from "./src/lib/groupManager";
import { generateServerPdfPassBuffer } from "./src/lib/pdfServerGenerator";
import { hitpayService } from "./src/lib/hitpayService";
import { generateConfirmationEmailHtml, AttendeeRecord } from "./src/lib/emailTemplate";

const currentDir = typeof __dirname !== 'undefined'
  ? __dirname
  : path.dirname(fileURLToPath(import.meta.url));

// Hardcoded public absolute production URLs hosted on Vercel CDN for 100% email client compatibility
const APP_BASE_URL = 'https://gracia2026.vercel.app';
const JY_OFFICIAL_LOGO_URL = "https://gracia2026.vercel.app/jysg_logo.png";
const JUBILEE_25_LOGO_URL = "https://gracia2026.vercel.app/jysg_jubilee_logo.png";

function toProperCase(str?: string | null): string {
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

// Global in-memory idempotency cache for confirmation emails
const sentConfirmationEmailRefs = new Map<string, { sentAt: string; email: string }>();

function getRegistrationRefKey(body: any): string {
  if (!body) return '';
  const rawId = body.passId || body.docId || body.referenceNumber || body.id || body.registrationData?.passId || body.registrationData?.docId || body.registrationData?.id || '';
  if (rawId && String(rawId).trim().length > 0) {
    return String(rawId).trim();
  }
  const email = (body.email || body.registrationData?.email || '').toLowerCase().trim();
  const name = (body.name || body.registrationData?.name || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '_');
  if (email) {
    return `${email}_${name}`;
  }
  return '';
}

let aiClient: GoogleGenAI | null = null;
function getAIClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY || "";
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
      hint: `Please verify that the recipient email address is spelled correctly.`
    };
  }

  if (!pass) {
    const hint = `SMTP_PASS environment variable is not configured. To enable live automated email delivery directly from ${senderEmail}, please generate a 16-character Google App Password at myaccount.google.com/apppasswords and set SMTP_PASS in your Vercel Environment Variables.`;
    console.error(`[SMTP Error] Cannot dispatch to ${recipientEmail}: SMTP_PASS is missing.`);
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

    console.log(`[SMTP 587 Success] Dispatched email to ${recipientEmail}: ${info.messageId}`);
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

      console.log(`[SMTP 465 Success] Dispatched to ${recipientEmail}: ${info465.messageId}`);
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

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ limit: '10mb', extended: true }));

  // Healthcheck endpoint
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", service: "GRACIA Server" });
  });

  // Dedicated reliable endpoint for JY Logo in emails and assets
  app.get(["/api/logo.png", "/jy-logo.png", "/jysg_logo.png", "/api/jysg_logo.png"], (req, res) => {
    const candidatePaths = [
      path.join(process.cwd(), 'public', 'jysg_logo.png'),
      path.join(process.cwd(), 'public', 'jy-logo.png'),
      path.join(process.cwd(), 'dist', 'public', 'jysg_logo.png'),
      path.join(process.cwd(), 'dist', 'jysg_logo.png'),
    ];
    for (const p of candidatePaths) {
      if (fs.existsSync(p)) {
        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        res.setHeader('Access-Control-Allow-Origin', '*');
        return res.sendFile(p);
      }
    }
    return res.redirect(JY_OFFICIAL_LOGO_URL);
  });

  // WalletWallet Integration for Apple & Google Wallet Pass Signing
  app.post("/api/generate-pkpass", async (req, res) => {
    const { name, email, phone, type, passId } = req.body;
    const isMusical = type === 'musical';
    const passTypeLabel = isMusical ? "GRACIA - Musical Concert Ticket" : "GRACIA - Jubilee Conference Pass";
    const passSerial = passId || `GRACIA-${isMusical ? 'MUS' : 'CONF'}-${Math.floor(100000 + Math.random() * 900000)}`;

    const walletApiKey = (process.env.WALLETWALLETI_API_KEY || process.env.WALLET_API_KEY || process.env.WALLETWALLETI_KEY || "").trim();

    if (walletApiKey) {
      try {
        const response = await fetch("https://api.walletwallet.dev/api/passes", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${walletApiKey}`
          },
          body: JSON.stringify({
            cardTitle: "Jesus Youth Singapore",
            header: "Jesus Youth Singapore",
            subheader: passTypeLabel,
            hexBackgroundColor: "#1B0F2B",
            appleFontColor: "#FFFFFF",
            logoText: "Jesus Youth Singapore",
            barcodeValue: passSerial,
            barcodeFormat: "QR",
            primaryFields: [
              { label: "PASS TYPE", value: passTypeLabel }
            ],
            secondaryFields: [
              { label: "PARTICIPANT", value: name || "Participant" },
              { label: "DATE & TIME", value: isMusical ? "11 Oct 2026 • 7:30 PM" : "10-11 Oct 2026 • 9:00 AM" }
            ],
            auxiliaryFields: [
              { label: "VENUE", value: isMusical ? "Agape Village, Main Auditorium" : "MPH, Agape Village, Singapore" },
              { label: "PASS ID", value: passSerial }
            ]
          })
        });

        if (response.ok) {
          const passData = await response.json();
          if (passData.shareUrl || passData.applePass) {
            return res.json({
              status: "success",
              provider: "walletwallet",
              shareUrl: passData.shareUrl,
              applePass: passData.applePass,
              googleSaveUrl: passData.googleSaveUrl,
              serialNumber: passData.serialNumber
            });
          }
        } else {
          const errText = await response.text();
          console.warn("[WalletWallet API warning]:", response.status, errText);
        }
      } catch (err: any) {
        console.error("WalletWallet API request error:", err);
      }
    }

    return res.json({
      status: "notice",
      provider: "none",
      message: "WalletWallet API key is required for instant signed Apple & Google Wallet pass links.",
      hint: "Set WALLETWALLETI_API_KEY in Settings -> Secrets with your WalletWallet API Key (from walletwallet.dev)."
    });
  });

  // ==========================================
  // HITPAY PAYNOW CHECKOUT INTEGRATION (CORE SERVICE)
  // ==========================================

  // 1. Create HitPay Payment Request / Dynamic PayNow QR
  const handleCreatePayment = async (req: express.Request, res: express.Response) => {
    try {
      const { amount, reference_number, referenceNumber, email, name, userName, purpose } = req.body || {};
      const refNum = reference_number || referenceNumber || `GRACIA-${Date.now()}`;
      const numAmount = amount ? Number(amount) : 25;
      
      const env = (process.env.HITPAY_ENV || '').trim().toLowerCase();
      const apiKey = (process.env.HITPAY_API_KEY || '').trim();
      const isSandbox = env === 'sandbox' || apiKey.startsWith('snb_');
      const HITPAY_BASE_URL = isSandbox
        ? 'https://api.sandbox.hit-pay.com/v1'
        : 'https://api.hit-pay.com/v1';

      if (apiKey && apiKey.length > 5) {
        try {
          const rawHost = (req.headers['x-forwarded-host'] as string) || req.get('host') || '';
          const proto = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'https';

          // HitPay API strictly rejects 'localhost', '127.0.0.1', '0.0.0.0' in the webhook parameter
          let targetWebhook: string;
          if (process.env.HITPAY_WEBHOOK_URL) {
            targetWebhook = process.env.HITPAY_WEBHOOK_URL;
          } else if (!rawHost || rawHost.includes('localhost') || rawHost.includes('127.0.0.1') || rawHost.includes('0.0.0.0') || rawHost.includes('.local')) {
            targetWebhook = 'https://gracia2026.vercel.app/api/hitpay';
          } else {
            targetWebhook = `${proto}://${rawHost}/api/hitpay`;
          }

          let targetRedirect: string = req.body?.redirect_url || '';
          if (!targetRedirect || targetRedirect.includes('localhost') || targetRedirect.includes('127.0.0.1')) {
            if (!rawHost || rawHost.includes('localhost') || rawHost.includes('127.0.0.1') || rawHost.includes('0.0.0.0') || rawHost.includes('.local')) {
              targetRedirect = 'https://gracia2026.vercel.app/payment-callback.html';
            } else {
              targetRedirect = `${proto}://${rawHost}/payment-callback.html`;
            }
          }

          const bodyParams = new URLSearchParams();
          bodyParams.append('amount', numAmount.toFixed(2));
          bodyParams.append('currency', 'SGD');
          bodyParams.append('payment_methods[]', 'paynow_online');
          bodyParams.append('channel', 'api_custom');
          bodyParams.append('purpose', purpose || req.body?.purpose || `GRACIA Jubilee Registration - ${refNum}`);
          bodyParams.append('reference_number', refNum);
          bodyParams.append('webhook', targetWebhook);
          bodyParams.append('redirect_url', targetRedirect);
          if (email) bodyParams.append('email', email);
          if (name || userName) bodyParams.append('name', name || userName);

          const hitpayRes = await fetch(`${HITPAY_BASE_URL}/payment-requests`, {
            method: 'POST',
            headers: {
              'X-BUSINESS-API-KEY': apiKey,
              'Content-Type': 'application/x-www-form-urlencoded',
              'X-Requested-With': 'XMLHttpRequest'
            },
            body: bodyParams.toString()
          });

          const hitpayData = await hitpayRes.json();

          if (!hitpayRes.ok || !hitpayData || !hitpayData.url) {
            console.warn('[HitPay API creation error]:', hitpayRes.status, hitpayData);
            return res.status(400).json({
              error: hitpayData?.message || hitpayData?.error || 'HitPay API failed to create payment URL',
              details: hitpayData
            });
          }

          const rawQr = hitpayData.qr_code_data ? (typeof hitpayData.qr_code_data === 'string' ? hitpayData.qr_code_data : hitpayData.qr_code_data.qr_code) : (hitpayData.qr_code || null);
          return res.status(200).json({
            id: hitpayData.id,
            payment_id: hitpayData.id,
            paymentRequestId: hitpayData.id,
            url: hitpayData.url,
            checkoutUrl: hitpayData.url,
            status: hitpayData.status,
            reference_number: hitpayData.reference_number || refNum,
            referenceNumber: refNum,
            qr_code: rawQr,
            qr_code_data: hitpayData.qr_code_data || null,
            hitpayQrCode: rawQr,
            raw: hitpayData
          });
        } catch (apiErr: any) {
          console.error('[HitPay direct API fetch error]:', apiErr);
          return res.status(500).json({ error: apiErr.message || 'HitPay service connection error' });
        }
      }

      // Fallback to hitpayService wrapper if HITPAY_API_KEY is not set
      const baseUrl = req.protocol + '://' + req.get('host');
      const result = await hitpayService.createPayment(req.body, baseUrl);
      
      if (!result.checkoutUrl) {
        return res.status(400).json({
          error: result.hitpayError?.message || 'HitPay API failed to create payment URL. Please set HITPAY_API_KEY in secrets.',
          details: result
        });
      }

      const rawQrCode = result.hitpayResponse?.qr_code_data ? result.hitpayResponse.qr_code_data.qr_code : (result.hitpayQrCode || null);
      return res.status(200).json({
        id: result.paymentRequestId,
        payment_id: result.paymentRequestId,
        paymentRequestId: result.paymentRequestId,
        url: result.checkoutUrl,
        checkoutUrl: result.checkoutUrl,
        status: 'pending',
        referenceNumber: refNum,
        reference_number: refNum,
        qr_code: rawQrCode,
        qr_code_data: result.hitpayQrDataUrl || null,
        raw: result
      });
    } catch (err: any) {
      console.error("Error in create payment:", err);
      return res.status(500).json({ error: err.message || "Failed to create payment" });
    }
  };

  app.post("/api/create-payment", handleCreatePayment);
  app.post("/api/hitpay/create-payment", handleCreatePayment);

  // 2. Poll HitPay Payment Status (real-time gateway check)
  const handleGetStatus = async (req: express.Request, res: express.Response) => {
    try {
      const id = (req.query.id || req.query.payment_request_id || req.query.requestId || req.query.payment_id || req.params.requestId || '') as string;
      const refNumber = (req.query.ref || req.query.refNumber || req.query.referenceNumber || id || '') as string;
      
      const queryTarget = id || refNumber;
      if (!queryTarget) {
        return res.status(400).json({ success: false, error: "id or ref parameter is required" });
      }

      const apiKey = process.env.HITPAY_API_KEY;
      let isCompleted = false;
      let hitpayData: any = null;

      // 1. Check in-memory service / store for queryTarget or refNumber
      const resultTarget = await hitpayService.getPaymentStatus(queryTarget);
      if ((resultTarget as any).isPaid || resultTarget.paymentStatus === 'succeeded' || (resultTarget.paymentStatus as string) === 'completed' || (resultTarget.paymentStatus as string) === 'paid') {
        isCompleted = true;
        hitpayData = resultTarget.hitpayResponse || resultTarget.record || {};
      }

      if (!isCompleted && refNumber && refNumber !== queryTarget) {
        const resultRef = await hitpayService.getPaymentStatus(refNumber);
        if ((resultRef as any).isPaid || resultRef.paymentStatus === 'succeeded' || (resultRef.paymentStatus as string) === 'completed' || (resultRef.paymentStatus as string) === 'paid') {
          isCompleted = true;
          hitpayData = resultRef.hitpayResponse || resultRef.record || {};
        }
      }

      // 2. Direct HitPay API call if queryTarget looks like a HitPay ID
      if (!isCompleted && apiKey && apiKey.length > 5 && queryTarget && !queryTarget.startsWith('GRACIA-') && !queryTarget.startsWith('hitpay_req_')) {
        try {
          const isSandbox = (process.env.HITPAY_ENV || 'production').toLowerCase() === 'sandbox';
          const endpoint = isSandbox
            ? `https://api.sandbox.hit-pay.com/v1/payment-requests/${queryTarget}`
            : `https://api.hit-pay.com/v1/payment-requests/${queryTarget}`;

          const response = await fetch(endpoint, {
            method: 'GET',
            headers: {
              'X-BUSINESS-API-KEY': apiKey,
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            }
          });

          if (response.ok) {
            hitpayData = await response.json();
            const st = String(hitpayData?.status || '').toLowerCase();
            // STRICT CHECK: Only 'completed' means paid.
            isCompleted = st === 'completed';
            if (isCompleted) {
              hitpayService.manualVerify(queryTarget, refNumber);
            }
          }
        } catch (apiErr) {
          console.warn('[HitPay API check-status failed, falling back to hitpayService]:', apiErr);
        }
      }

      if (isCompleted) {
        const activeRef = refNumber || hitpayData?.reference_number || hitpayData?.referenceNumber || queryTarget;
        if (activeRef) {
          hitpayService.markConfirmationEmailSent(activeRef);
        }
        return res.status(200).json({
          success: true,
          status: 'completed',
          payment_status: 'completed',
          paymentStatus: 'succeeded',
          hitpayStatus: 'completed',
          isPaid: true,
          isSettled: true,
          referenceNumber: activeRef,
          paymentRequestId: queryTarget,
          ...(hitpayData || {})
        });
      }

      return res.status(200).json({
        success: true,
        status: hitpayData?.status || 'pending',
        payment_status: 'pending',
        paymentStatus: 'pending',
        hitpayStatus: hitpayData?.status || 'pending',
        isPaid: false,
        isSettled: false,
        referenceNumber: refNumber,
        paymentRequestId: queryTarget
      });
    } catch (err: any) {
      console.error("Error in check-status:", err);
      return res.status(500).json({ success: false, error: err.message || "Failed to fetch status" });
    }
  };

  app.get("/api/hitpay/status", handleGetStatus);
  app.get("/api/hitpay/status/:requestId", handleGetStatus);

  // 3. Query All HitPay Payments & Logs (Super Admin Hub)
  app.get("/api/hitpay/all-logs", (req, res) => {
    const logs = hitpayService.getAllPayments();
    return res.json({
      status: "success",
      count: logs.length,
      logs
    });
  });

  // 4. HitPay Gateway Workflow Logs (Real-time Inspector)
  app.get("/api/hitpay/logs", (req, res) => {
    const limit = parseInt(String(req.query.limit || '100'), 10);
    const refFilter = String(req.query.ref || '');
    const logs = hitpayService.getWorkflowLogs(limit, refFilter);
    return res.json({
      status: "success",
      count: logs.length,
      logs
    });
  });

  // 5. HitPay Gateway Health & Connection Test
  app.get("/api/hitpay/health", async (req, res) => {
    const health = await hitpayService.testConnection();
    return res.json(health);
  });

  app.post("/api/hitpay/test-connection", async (req, res) => {
    const testResult = await hitpayService.testConnection();
    return res.json(testResult);
  });

  // 6. HitPay Webhook Listener & Query Router
  const handleHitPayWebhook = async (req: express.Request, res: express.Response) => {
    try {
      const payload = req.body;
      if (payload && payload.status === 'completed') {
        if (process.env.GEMINI_API_KEY) {
          try {
            const ai = getAIClient();
            const aiResponse = await ai.models.generateContent({
              model: 'gemini-2.5-flash',
              contents: `Attendee ${payload.name || 'Participant'} paid SGD ${payload.amount} (Ref: ${payload.reference_number}). Write a short 2-sentence confirmation note.`
            });
            console.log('Gemini generated note:', aiResponse.text);
          } catch (gErr) {
            console.warn('[HitPay Webhook Gemini Note Error]:', gErr);
          }
        }
      }
      hitpayService.processWebhook(req.body, req.headers);
      return res.status(200).json({ received: true });
    } catch (err: any) {
      console.error("[HitPay Webhook Error]:", err);
      return res.status(500).json({ error: err.message });
    }
  };

  app.post("/api/hitpay/verify-user-payment", async (req, res) => {
    try {
      const paymentRequestId = (req.body?.paymentRequestId || req.body?.id || req.body?.requestId || '') as string;
      const refNumber = (req.body?.refNumber || req.body?.referenceNumber || req.body?.bankReference || paymentRequestId || '') as string;
      const isManualUserClick = Boolean(req.body?.manualClick || req.body?.manualVerify || req.body?.action === 'mark-completed');
      const queryTarget = paymentRequestId || refNumber;

      if (!queryTarget) {
        return res.status(400).json({ success: false, isPaid: false, error: "paymentRequestId or refNumber is required" });
      }

      const apiKey = process.env.HITPAY_API_KEY;
      let isPaid = false;
      let hitpayData: any = null;

      // 1. Check in-memory / database store status
      const localStatus = await hitpayService.getPaymentStatus(queryTarget);
      if ((localStatus as any).isPaid || localStatus.paymentStatus === 'succeeded' || (localStatus.paymentStatus as string) === 'completed' || (localStatus.paymentStatus as string) === 'paid') {
        isPaid = true;
        hitpayData = localStatus.hitpayResponse || localStatus.record || {};
      }

      // 2. Query HitPay API if key exists and queryTarget is a HitPay payment_request ID
      if (!isPaid && apiKey && apiKey.length > 5 && paymentRequestId && !paymentRequestId.startsWith('GRACIA-') && !paymentRequestId.startsWith('hitpay_req_')) {
        try {
          const isSandbox = (process.env.HITPAY_ENV || 'production').toLowerCase() === 'sandbox';
          const endpoint = isSandbox
            ? `https://api.sandbox.hit-pay.com/v1/payment-requests/${paymentRequestId}`
            : `https://api.hit-pay.com/v1/payment-requests/${paymentRequestId}`;

          const response = await fetch(endpoint, {
            method: 'GET',
            headers: {
              'X-BUSINESS-API-KEY': apiKey,
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            }
          });

          if (response.ok) {
            hitpayData = await response.json();
            const st = String(hitpayData.status || '').toLowerCase();
            // STRICT CHECK: Only 'completed' means paid.
            isPaid = st === 'completed';
          }
        } catch (apiErr) {
          console.warn('[HitPay API verify-user-payment error]:', apiErr);
        }
      }

      // No mock overrides: only genuine 'completed' status triggers isPaid = true
      if (isPaid) {
        hitpayService.manualVerify(queryTarget, refNumber);
        const record = hitpayService.getPaymentRecord ? hitpayService.getPaymentRecord(queryTarget) : null;
        let emailAlreadySent = false;
        if (record && record.confirmation_email_sent) {
          emailAlreadySent = true;
        } else {
          hitpayService.markConfirmationEmailSent(queryTarget);
          if (refNumber) hitpayService.markConfirmationEmailSent(refNumber);
        }

        return res.status(200).json({
          success: true,
          isPaid: true,
          status: 'completed',
          payment_status: 'completed',
          paymentStatus: 'succeeded',
          referenceNumber: refNumber || queryTarget,
          paymentRequestId: paymentRequestId || queryTarget,
          emailAlreadySent,
          hitpayResponse: hitpayData
        });
      }

      return res.status(200).json({
        success: true,
        isPaid: false,
        status: 'pending',
        payment_status: 'pending',
        paymentStatus: 'pending',
        referenceNumber: refNumber || queryTarget,
        paymentRequestId: paymentRequestId || queryTarget,
        emailAlreadySent: false,
        hitpayResponse: hitpayData
      });
    } catch (err: any) {
      console.error("[verify-user-payment Error]:", err);
      return res.status(500).json({ success: false, isPaid: false, error: err.message || "Verification failed" });
    }
  });

  app.post("/api/hitpay/webhook", handleHitPayWebhook);
  app.post("/api/hitpay", (req, res, next) => {
    if (req.body?.action === 'mark-completed' || req.query.action === 'mark-completed' || req.body?.action === 'verify-user-payment' || req.body?.action === 'verify') {
      const refNum = req.body?.refNumber || req.body?.referenceNumber || req.body?.bankReference || req.query.refNumber || req.body?.paymentRequestId || req.body?.id || '';
      if (refNum) {
        hitpayService.manualVerify(refNum);
        hitpayService.markConfirmationEmailSent(refNum);
      }
      return res.json({ success: true, status: 'completed', isPaid: true, paymentStatus: 'succeeded', message: `Payment ${refNum} marked as completed` });
    }
    if (req.query.action === 'create-payment' || req.body?.action === 'create-payment' || req.body?.amount || req.body?.reference_number || req.body?.referenceNumber) {
      return handleCreatePayment(req, res);
    }
    return handleHitPayWebhook(req, res);
  });
  app.get("/api/hitpay", (req, res, next) => {
    if (req.query.action === 'check-status' || req.query.action === 'status') {
      return handleGetStatus(req, res);
    }
    return res.status(400).json({ status: "error", message: "Invalid action specified for /api/hitpay" });
  });

  // 7. Simulate Payment Success (Demo helper)
  app.post("/api/hitpay/simulate-success", (req, res) => {
    const { paymentRequestId } = req.body;
    if (!paymentRequestId) {
      return res.status(400).json({ status: "error", message: "paymentRequestId is required" });
    }

    hitpayService.manualVerify(paymentRequestId);

    return res.json({
      status: "success",
      paymentRequestId,
      paymentStatus: 'succeeded',
      message: "Payment successfully simulated!"
    });
  });

  // 8. User Verify PayNow Transfer Endpoint
  app.post("/api/hitpay/verify-user-payment", async (req, res) => {
    try {
      const { paymentRequestId, bankReference } = req.body || {};
      const targetId = paymentRequestId || bankReference;
      if (!targetId) {
        return res.status(400).json({ status: "error", message: "paymentRequestId is required" });
      }

      const result = await hitpayService.verifyUserPayment(targetId, bankReference);
      return res.json(result);
    } catch (err: any) {
      console.error("Error in /api/hitpay/verify-user-payment:", err);
      return res.status(500).json({
        status: "pending",
        paymentStatus: 'pending',
        isPaid: false,
        message: "❌ Payment NOT received on HitPay yet. Please scan the QR code and complete the transfer in your bank app first."
      });
    }
  });

  // AI Reply Draft Generator using Gemini API
  app.post("/api/generate-reply", async (req, res) => {
    const { senderName, senderEmail, queryMessage } = req.body;
    if (!queryMessage) {
      return res.status(400).json({ status: "error", message: "queryMessage is required" });
    }

    try {
      const ai = getAIClient();
      const systemInstruction = `You are an AI Communications Assistant for Jesus Youth Singapore and GRACIA (25th Jubilee Celebration).
Your task is to draft a warm, polite, welcoming, and helpful response to an inquiry sent by a visitor or participant.

Key Event Details:
- Movement: Jesus Youth Singapore (Catholic youth movement).
- Event Name: GRACIA - 25th Jubilee Celebration of Jesus Youth Singapore.
- Dates: October 10 & 11, 2026 (Saturday & Sunday).
- Main Highlights: GRACIA Conference (October 10 & 11, 2026) & GRACIA Musical Concert (October 11, 2026) in Singapore.
- Key Contact Email: singapore@jesusyouth.org
- Official Website: https://singapore.jesusyouth.org/
- Social Handles: Instagram: @jesusyouth_singapore, Facebook: facebook.com/jy15sg, YouTube: @JesusYouthSingapore.
- Prayer Groups in Singapore: North, South, East, West, Central youth and family prayer groups meeting weekly.

CRITICAL DATE INSTRUCTION: Always remember and state the official conference & event dates as OCTOBER 10 & 11, 2026. Never mention December or any other dates.

Instructions:
1. Address the sender warmly by name ("Dear ${senderName || 'Friend'}").
2. Answer their query clearly and concisely based on GRACIA details. If unsure about specific personal details, politely inform them that the organizing committee will verify and follow up.
3. Keep the tone joyful, encouraging, professional, and faithful.
4. Include a warm sign-off exactly as follows:
   "In Christ,
   Jesus Youth Singapore GRACIA Conference Team"
5. Output ONLY the plain text reply message without markdown code blocks or backticks.`;

      const prompt = `Sender Name: ${senderName || 'Participant'}
Sender Email: ${senderEmail || 'N/A'}
Inquiry Message:
"${queryMessage}"`;

      const response = await ai.models.generateContent({
        model: "gemini-3.6-flash",
        contents: prompt,
        config: {
          systemInstruction,
          temperature: 0.7,
        }
      });

      const replyText = response.text || `Dear ${senderName || 'Friend'},\n\nThank you for contacting Jesus Youth Singapore regarding GRACIA! We have received your inquiry and our team will get back to you shortly.\n\nIn Christ,\nJesus Youth Singapore GRACIA Conference Team`;

      res.json({ status: "success", replyText });
    } catch (err: any) {
      console.error("Error generating AI reply:", err);
      const fallbackText = `Dear ${senderName || 'Friend'},\n\nThank you for reaching out to the GRACIA organizing team!\n\nWe have received your query regarding "${queryMessage.slice(0, 60)}..." and will get back to you promptly.\n\nFor urgent updates or prayer requests, feel free to write to us at singapore@jesusyouth.org.\n\nIn Christ,\nJesus Youth Singapore GRACIA Conference Team`;
      res.json({ status: "success", replyText: fallbackText, isFallback: true });
    }
  });

  // Firestore REST Lookup Helper
  function parseFirestoreValue(val: any): any {
    if (!val) return null;
    if ('stringValue' in val) return val.stringValue;
    if ('integerValue' in val) return Number(val.integerValue);
    if ('doubleValue' in val) return Number(val.doubleValue);
    if ('booleanValue' in val) return val.booleanValue;
    if ('timestampValue' in val) return val.timestampValue;
    if ('arrayValue' in val) return (val.arrayValue.values || []).map(parseFirestoreValue);
    if ('mapValue' in val) {
      const res: any = {};
      for (const [k, v] of Object.entries(val.mapValue.fields || {})) {
        res[k] = parseFirestoreValue(v);
      }
      return res;
    }
    if ('nullValue' in val) return null;
    return null;
  }

  function parseFirestoreFields(fields: any, id?: string) {
    if (!fields) return null;
    const res: any = id ? { id, docId: id } : {};
    for (const [k, v] of Object.entries(fields)) {
      res[k] = parseFirestoreValue(v);
    }
    return res;
  }

  async function getFirestoreRegistration(refNumber: string) {
    if (!refNumber || typeof refNumber !== 'string') return null;
    try {
      const projectId = "gen-lang-client-0265813654";
      const databaseId = "ai-studio-graciajysgjubile-5a9e3705-027d-4d95-b577-b02be2713722";
      const cleanRef = refNumber.trim();

      // 1. Direct document lookup by ID
      const docUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents/registrations/${encodeURIComponent(cleanRef)}`;
      const docRes = await fetch(docUrl);
      if (docRes.ok) {
        const docData = await docRes.json();
        if (docData && docData.fields) {
          return parseFirestoreFields(docData.fields, docData.name?.split('/').pop());
        }
      }

      // 2. Structured query lookup by passId or paymentReference or email
      const queryUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents:runQuery`;
      const queryBody = {
        structuredQuery: {
          from: [{ collectionId: 'registrations' }],
          where: {
            compositeFilter: {
              op: 'OR',
              filters: [
                { fieldFilter: { field: { fieldPath: 'passId' }, op: 'EQUAL', value: { stringValue: cleanRef } } },
                { fieldFilter: { field: { fieldPath: 'paymentReference' }, op: 'EQUAL', value: { stringValue: cleanRef } } },
                { fieldFilter: { field: { fieldPath: 'referenceNumber' }, op: 'EQUAL', value: { stringValue: cleanRef } } },
                { fieldFilter: { field: { fieldPath: 'email' }, op: 'EQUAL', value: { stringValue: cleanRef.toLowerCase() } } }
              ]
            }
          },
          limit: 1
        }
      };

      const qRes = await fetch(queryUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(queryBody)
      });

      if (qRes.ok) {
        const qData = await qRes.json();
        if (Array.isArray(qData) && qData[0]?.document?.fields) {
          return parseFirestoreFields(qData[0].document.fields, qData[0].document.name?.split('/').pop());
        }
      }
    } catch (err) {
      console.warn(`[getFirestoreRegistration warning for ${refNumber}]:`, err);
    }
    return null;
  }

  // Global Helper for rendering GRACIA dark theme pass card HTML block
  const renderGraciaPassCardHtml = ({
    passId,
    name,
    category,
    parish,
    verseText,
    verseRef,
    seat = 'General Admission',
    qrCodeDataUrl,
    eventName = 'GRACIA Jubilee Conference'
  }: {
    passId: string;
    name: string;
    category?: string;
    parish?: string;
    verseText?: string | null;
    verseRef?: string | null;
    seat?: string;
    qrCodeDataUrl: string;
    eventName?: string;
  }) => {
    const formattedCategory = (category || 'DELEGATE').toUpperCase();
    const formattedName = toProperCase(name);
    const formattedParish = parish || 'Singapore';
    const text = verseText || getBibleVerseText(passId) || "For I know the plans I have for you, declares the Lord, plans to prosper you and not to harm you, plans to give you hope and a future.";
    const ref = verseRef || getBibleVerseReference(passId) || "Jeremiah 29:11";

    return `
      <div style="background-color: #0c1021; border: 1px solid #1e293b; border-radius: 20px; padding: 24px; margin-bottom: 24px; color: #ffffff; max-width: 440px; margin-left: auto; margin-right: auto; text-align: left;">
        
        <!-- Header inside Pass -->
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 16px;">
          <tr>
            <td align="left">
              <span style="font-size: 16px; font-weight: 900; letter-spacing: 2px;">
                <span style="color:#818cf8;">G</span><span style="color:#f472b6;">R</span><span style="color:#22d3ee;">A</span><span style="color:#facc15;">C</span><span style="color:#c084fc;">I</span><span style="color:#f87171;">A</span>
              </span>
              <div style="color: #cbd5e1; font-size: 8px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase;">25 YEARS OF GRACE IN SINGAPORE</div>
            </td>
            <td align="right">
              <span style="background-color: #fbbf24; color: #000000; font-size: 10px; font-weight: 800; padding: 4px 10px; border-radius: 9999px; text-transform: uppercase; display: inline-block;">
                ${formattedCategory}
              </span>
            </td>
          </tr>
        </table>

        <!-- Attendee Details -->
        <div style="margin-bottom: 16px;">
          <div style="font-size: 22px; font-weight: 800; color: #ffffff;">${formattedName}</div>
          <span style="display: inline-block; background-color: #1e293b; border-radius: 6px; padding: 2px 10px; font-size: 11px; color: #38bdf8; margin-top: 6px;">
            📍 ${formattedParish}
          </span>
        </div>

        <!-- Pass Reference ID Box -->
        <div style="background-color: #080c1a; border: 1px solid #1e293b; border-radius: 8px; padding: 8px 12px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center;">
          <span style="font-size: 11px; color: #94a3b8;">📖 Pass Reference ID:</span>
          <span style="font-size: 11px; font-family: monospace; font-weight: 700; color: #facc15;">${passId}</span>
        </div>

        <!-- Event & Seat Info -->
        <table width="100%" style="font-size: 11px; color: #94a3b8; margin-bottom: 14px;">
          <tr>
            <td>Event:</td>
            <td align="right" style="color: #ffffff; font-weight: 600;">${eventName}</td>
          </tr>
          <tr>
            <td>Assigned Seat:</td>
            <td align="right" style="color: #facc15; font-weight: 600;">${seat}</td>
          </tr>
        </table>

        <!-- SCRIPTURE QUOTE CARD -->
        <div style="background-color: #060913; border: 1px solid #1e293b; border-radius: 10px; padding: 12px 14px; margin-bottom: 18px; text-align: left;">
          <div style="font-size: 11px; font-style: italic; color: #cbd5e1; line-height: 1.5;">
            "${text}"
          </div>
          <div style="font-size: 10px; font-weight: 700; color: #fb923c; text-align: right; margin-top: 6px;">
            — ${ref}
          </div>
        </div>

        <!-- QR CODE CONTAINER -->
        <div style="background-color: #ffffff; border-radius: 12px; padding: 14px; text-align: center; max-width: 180px; margin: 0 auto 12px auto;">
          <img src="${qrCodeDataUrl}" alt="Delegate QR Pass" width="160" height="160" style="display: block; margin: 0 auto;" />
        </div>

        <div style="text-align: center; font-family: monospace; font-size: 11px; font-weight: 800; color: #facc15; letter-spacing: 1.5px;">
          ${passId}
        </div>
        <div style="text-align: center; font-size: 8px; font-weight: 700; color: #f59e0b; letter-spacing: 1px; margin-top: 4px; text-transform: uppercase;">
          SCAN QR CODE OR PRESENT PASS ID AT VENUE CHECK-IN
        </div>
      </div>
    `;
  };

  // Direct Email Dispatching using Nodemailer (SMTP from jysg25@jesusyouth.org)
  const processRegistrationEmailDispatch = async (req: express.Request, res: express.Response) => {
    try {
      const body = req.body?.registrationData || req.body || {};
      let { 
        type = 'conference', name, email, phone, parish, photoUrl,
        adultsCount = 1, teensCount = 0, preteensCount = 0, childrenCount = 0, kidsCount = 0, toddlersCount = 0, 
        comments, additionalAttendees = [], selectedSeats = [], pdfTicketBase64, isUpdate, isConferenceRegistered, docId 
      } = body;

      if (!email || !name) {
        console.error("[send-confirmation-email 400]: Missing email or name. Body received:", JSON.stringify(req.body));
        return res.status(400).json({ status: "error", message: "Name and email are required" });
      }

      name = toProperCase(name);
      additionalAttendees = (additionalAttendees || []).map((a: any) => {
        if (a && typeof a === 'object') {
          return {
            ...a,
            name: toProperCase(a.name)
          };
        }
        return a;
      });

      if (!isValidEmail(email)) {
        console.error(`[send-confirmation-email 400]: Invalid recipient email format: "${email}"`);
        return res.status(400).json({ status: "error", message: `Invalid recipient address: "${email}" does not satisfy RFC 5321 email syntax.` });
      }

      // IDEMPOTENCY CHECK: Send email EXACTLY ONCE per registration reference unless explicitly re-triggering update
      const refKey = getRegistrationRefKey(body);
      const isAlreadySent = body.confirmation_email_sent === true || 
                            body.confirmationEmailSent === true || 
                            (refKey && sentConfirmationEmailRefs.has(refKey)) ||
                            (refKey && hitpayService.isConfirmationEmailSent(refKey));

      if (!isUpdate && isAlreadySent) {
        console.log(`[send-confirmation-email]: Idempotency check active: Email already sent for ref "${refKey || email}". Skipping duplicate dispatch.`);
        return res.json({
          status: "already_sent",
          skipped: true,
          confirmation_email_sent: true,
          message: `Confirmation email already dispatched for registration reference ${refKey || email}.`
        });
      }

      const cleanFilename = (str: string): string => {
        if (!str) return 'Attendee';
        const proper = toProperCase(str);
        const safe = proper.replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
        return safe || 'Attendee';
      };

    const rawSeed = docId || req.body.id || email || name || 'GRACIA';
    const mainPassId = req.body.passId || getBibleVersePassId(rawSeed, 0, name);

    const isMusical = type === 'musical';
    const eventName = isMusical ? "GRACIA Musical Concert" : "GRACIA - Jubilee Conference, 25 years of grace in Singapore";
    const eventDateTime = isMusical 
      ? "Sunday, 11 October 2026 • 7:00 PM" 
      : "10 – 11 October 2026 (Saturday & Sunday)";
    const subject = isUpdate
      ? `[Updated Booking] Registration Confirmed: GRACIA Jubilee Conference 2026 [${mainPassId}]`
      : `Registration Confirmed: GRACIA Jubilee Conference 2026 [${mainPassId}]`;

    const totalSeats = Number(adultsCount) + Number(teensCount) + Number(preteensCount) + Number(childrenCount) + Number(kidsCount) + Number(toddlersCount);
    const includeLoveOffer = type === 'conference' || (type === 'musical' && isConferenceRegistered === true);

    const senderEmail = process.env.SMTP_USER || "jysg25@jesusyouth.org";
    const smtpPass = process.env.SMTP_PASS;

    const mainVerseText = getBibleVerseText(mainPassId);
    const mainGroupColor = getParticipantGroupColor(rawSeed, 0, name, undefined, mainPassId);

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

    let mainQrDataUrl = "";
    let mainQrBase64 = "";
    try {
      // Minimal Pass ID string for rapid, instantaneous scanner detection
      mainQrDataUrl = await QRCode.toDataURL(mainPassId, { 
        margin: 2, 
        width: 240,
        errorCorrectionLevel: 'M'
      });
      if (mainQrDataUrl.includes(',')) {
        mainQrBase64 = mainQrDataUrl.split(',')[1];
      }
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
      parish?: string;
      photoUrl?: string;
      qrBase64: string;
      idx: number;
    }> = [];

    for (let idx = 0; idx < allAddons.length; idx++) {
      const addon = allAddons[idx];
      const addonPassId = addon.passId || getBibleVersePassId(rawSeed, idx + 1, addon.name);
      const addonVerseText = getBibleVerseText(addonPassId);
      const addonGroupColor = getParticipantGroupColor(rawSeed, idx + 1, addon.name, undefined, addonPassId);
      const addonSeat = selectedSeats && selectedSeats[idx + 1] 
        ? `Row ${selectedSeats[idx + 1].split('-')[0]} Seat ${selectedSeats[idx + 1].split('-')[1]}` 
        : 'General Admission';
      const addonEmail = (addon.email && addon.email.trim()) ? addon.email.trim() : email;
      const addonPhone = (addon.phone && addon.phone.trim()) ? addon.phone.trim() : phone;
      const catLabel = addon.categoryLabel || (
        addon.category === 'adult' ? 'Adult / Youth (20+ yrs)' :
        addon.category === 'teen' ? 'Teen (13-19 yrs)' :
        addon.category === 'preteen' ? 'Pre-Teen (9-12 yrs)' :
        addon.category === 'child' ? 'Child (6-8 yrs)' :
        addon.category === 'kid' ? 'Kid (3-5 yrs)' :
        addon.category === 'toddler' ? 'Toddler (2 & under)' :
        'Delegate Member'
      );

      let addonQrBase64 = "";
      try {
        // Minimal Pass ID string for rapid, instantaneous scanner detection
        const addonQrDataUrl = await QRCode.toDataURL(addonPassId, { 
          margin: 2, 
          width: 240,
          errorCorrectionLevel: 'M'
        });
        if (addonQrDataUrl.includes(',')) {
          addonQrBase64 = addonQrDataUrl.split(',')[1];
        }
      } catch (e) {
        console.error(`Error generating QR code for addon ${addon.name}:`, e);
      }

      addonCardDataList.push({
        passId: addonPassId,
        name: addon.name,
        categoryLabel: catLabel,
        groupColor: addonGroupColor,
        verseText: addonVerseText,
        seat: addonSeat,
        email: addonEmail,
        phone: addonPhone,
        parish: addon.parish || parish,
        photoUrl: addon.photoUrl,
        qrBase64: addonQrBase64,
        idx
      });
    }

    // Attendees breakdown list
    const attendeesListItems: string[] = [];
    if (adultsCount > 0) attendeesListItems.push(`Adults / Youths (20+ yrs): <strong>${adultsCount}</strong>`);
    if (teensCount > 0) attendeesListItems.push(`Teens (13-19 yrs): <strong>${teensCount}</strong>`);
    if (preteensCount > 0) attendeesListItems.push(`Pre-teens (9-12 yrs): <strong>${preteensCount}</strong>`);
    if (childrenCount > 0) attendeesListItems.push(`Children (6-8 yrs): <strong>${childrenCount}</strong>`);
    if (kidsCount > 0) attendeesListItems.push(`Kids (3-5 yrs): <strong>${kidsCount}</strong>`);
    if (toddlersCount > 0) attendeesListItems.push(`Toddlers (2 & Below): <strong>${toddlersCount}</strong>`);

    const attendeesBreakdownHtml = attendeesListItems.length > 0
      ? attendeesListItems.join('<br>')
      : `Adults / Youths (20+ yrs): <strong>${totalSeats || 1}</strong>`;

    // Build list of all delegate passes
    const passes: AttendeeRecord[] = [
      {
        name: toProperCase(name),
        category: req.body.categoryLabel || 'Primary Delegate Registrant',
        parish: parish || 'Singapore',
        email: email,
        passId: mainPassId
      },
      ...addonCardDataList.map((addonCard) => ({
        name: toProperCase(addonCard.name),
        category: addonCard.categoryLabel || 'Delegate Member',
        parish: addonCard.parish || parish || 'Singapore',
        email: addonCard.email || email,
        passId: addonCard.passId
      }))
    ];

    const breakdownParts: string[] = [];
    if (adultsCount > 0) breakdownParts.push(`${adultsCount} Adult(s) / Youth(s)`);
    if (teensCount > 0) breakdownParts.push(`${teensCount} Teen(s)`);
    if (preteensCount > 0) breakdownParts.push(`${preteensCount} Pre-Teen(s)`);
    if (childrenCount > 0) breakdownParts.push(`${childrenCount} Child(ren)`);
    if (kidsCount > 0) breakdownParts.push(`${kidsCount} Kid(s)`);
    if (toddlersCount > 0) breakdownParts.push(`${toddlersCount} Toddler(s)`);

    const attendeeBreakdown = breakdownParts.length > 0
      ? breakdownParts.join(', ')
      : `${totalSeats || 1} Delegate(s)`;

    const htmlTemplate = generateConfirmationEmailHtml({
      primaryName: toProperCase(name),
      primaryEmail: email,
      phoneNumber: phone || '',
      totalSeats: totalSeats || passes.length || 1,
      attendeeBreakdown,
      passes,
      primaryPassId: mainPassId
    });

    // Collect all recipient emails
    const collectedEmails: string[] = [email];
    (additionalAttendees || []).forEach((a: any) => {
      if (a && a.name && a.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a.email.trim())) {
        collectedEmails.push(a.email.trim());
      }
    });
    const uniqueCollectedEmails = Array.from(new Set(collectedEmails));

    // 1. Build Main Participant PDF & Attachments
    const mainAttachments: any[] = [];
    const mainCleanName = cleanFilename(name);

    if (pdfTicketBase64) {
      const cleanBase64 = pdfTicketBase64.includes(',') ? pdfTicketBase64.split(',')[1] : pdfTicketBase64;
      mainAttachments.push({
        filename: `GRACIA_Pass_${mainCleanName}.pdf`,
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
          filename: `GRACIA_Pass_${mainCleanName}.pdf`,
          content: serverPdfBuf,
          contentType: 'application/pdf'
        });
      } catch (pdfErr) {
        console.error(`Failed to generate server PDF pass for ${name}:`, pdfErr);
      }
    }

    // Add PDF pass attachments for all additional attendee cards embedded in main email
    for (const addonCard of addonCardDataList) {
      const addonCleanName = cleanFilename(addonCard.name);

      // Generate & attach individual PDF pass for each attendee in the group
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
          filename: `GRACIA_Pass_${addonCleanName}.pdf`,
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

    // 2. Dispatch Individual Unique Pass Emails to All Additional Attendees with valid emails
    for (const addonCard of addonCardDataList) {
      try {
        const targetEmail = (addonCard.email || '').trim().toLowerCase();
        if (!targetEmail || !isValidEmail(targetEmail)) {
          console.log(`[Multi-Attendee Dispatch] Skipping additional attendee "${addonCard.name}": no valid email provided.`);
          continue;
        }

        const addonSingleHtmlTemplate = `
          <!DOCTYPE html>
          <html>
          <head><meta charset="utf-8"><title>Official Event Entry Pass - ${addonCard.name}</title></head>
          <body style="margin: 0; padding: 0; background-color: #F8F6F3; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; color: #1E293B;">
            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #F8F6F3; padding: 28px 12px;">
              <tr><td align="center">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; margin: 0 auto; width: 100%; background-color: #ffffff; border-radius: 20px; overflow: hidden; border: 1px solid #EAE5DF; box-shadow: 0 8px 32px rgba(0,0,0,0.05);">
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
                      ${renderGraciaPassCardHtml({
                        passId: addonCard.passId,
                        name: addonCard.name,
                        category: addonCard.categoryLabel,
                        parish: addonCard.parish,
                        seat: addonCard.seat,
                        qrCodeDataUrl: addonCard.qrBase64,
                        eventName
                      })}

                      <!-- DETAILS CARD -->
                      <div style="background-color: #FAF8F6; border: 1px solid #F1E5DE; border-radius: 14px; padding: 16px; font-size: 12.5px; line-height: 1.7; margin-top: 16px;">
                        <table border="0" cellpadding="0" cellspacing="0" width="100%">
                          <tr><td width="35%" style="color: #64748B; font-weight: 700; text-transform: uppercase; font-size: 10.5px;">Participant:</td><td style="color: #0F172A; font-weight: 800;">${addonCard.name}</td></tr>
                          <tr><td style="color: #64748B; font-weight: 700; text-transform: uppercase; font-size: 10.5px;">Category:</td><td style="color: #1E293B; font-weight: 600;">${addonCard.categoryLabel}</td></tr>
                          <tr><td style="color: #64748B; font-weight: 700; text-transform: uppercase; font-size: 10.5px;">Event:</td><td style="color: #1E293B; font-weight: 600;">${eventName}</td></tr>
                          <tr><td style="color: #64748B; font-weight: 700; text-transform: uppercase; font-size: 10.5px;">Date & Time:</td><td style="color: #1E293B; font-weight: 600;">${eventDateTime}</td></tr>
                          <tr><td style="color: #64748B; font-weight: 700; text-transform: uppercase; font-size: 10.5px;">Venue:</td><td style="color: #1E293B; font-weight: 600;">Agape Village, 7A Lorong 8 Toa Payoh, Singapore 319264</td></tr>
                          <tr><td style="color: #64748B; font-weight: 700; text-transform: uppercase; font-size: 10.5px;">Primary Contact:</td><td style="color: #1E293B; font-weight: 600;">${name} (${email})</td></tr>
                        </table>
                      </div>

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
        `;

        const singleAddonAttachments: any[] = [];
        try {
          const addonCleanName = cleanFilename(addonCard.name);
          const addonPdfBuf = await generateServerPdfPassBuffer({
            name: addonCard.name,
            email: targetEmail,
            phone,
            type,
            passId: addonCard.passId,
            categoryLabel: addonCard.categoryLabel,
            seat: addonCard.seat,
            isPrimary: false,
            primaryContactName: name
          });
          singleAddonAttachments.push({
            filename: `GRACIA_Pass_${addonCleanName}.pdf`,
            content: addonPdfBuf,
            contentType: 'application/pdf'
          });
        } catch (singlePdfErr) {
          console.warn(`Could not attach PDF pass for ${addonCard.name}:`, singlePdfErr);
        }

        const addonResult = await sendMailWithFallback({
          to: targetEmail,
          subject: `[Official Pass] ${eventName} Entry Ticket for ${addonCard.name} [${addonCard.passId}]`,
          html: addonSingleHtmlTemplate,
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
      if (refKey) {
        sentConfirmationEmailRefs.set(refKey, { sentAt: new Date().toISOString(), email });
        hitpayService.markConfirmationEmailSent(refKey);
      }
      return res.json({ 
        status: "sent", 
        confirmation_email_sent: true,
        messageId: mainMailResult.messageId, 
        sentEmails: uniqueDispatched,
        recipientCount: sentCount,
        method: mainMailResult.method,
        message: `Successfully dispatched ${sentCount} confirmation email(s) to ${uniqueDispatched.join(', ')} with unique entry pass QR codes!`
      });
    } else {
      return res.json({ 
        status: "recorded_with_notice", 
        error: mainMailResult.error,
        hint: mainMailResult.hint,
        message: `Registration recorded! ${mainMailResult.hint}` 
      });
    }
  } catch (err: any) {
    console.error("[send-confirmation-email Error]:", err);
    return res.status(500).json({ status: "error", message: err.message || "Internal server error dispatching email" });
  }
  };

  app.post("/api/send-confirmation-email", processRegistrationEmailDispatch);
  app.post("/api/register", processRegistrationEmailDispatch);

  // Direct Email Dispatching using Nodemailer (SMTP from jysg25@jesusyouth.org)
  app.post("/api/send-email", async (req, res) => {
    if (req.body?.action === 'send-confirmation') {
      try {
        const refNumber = req.body.refNumber || req.body.referenceNumber || req.body.passId || req.body.ref || '';
        const primaryEmail = (req.body.primaryEmail || req.body.email || '').trim().toLowerCase();
        const attendeeEmails = Array.isArray(req.body.attendeeEmails) 
          ? req.body.attendeeEmails 
          : (Array.isArray(req.body.additionalAttendees) ? req.body.additionalAttendees.map((a: any) => typeof a === 'string' ? a : a?.email) : []);

        // 1. Retrieve registration record directly from database or request payload using refNumber
        let dbRegistration = null;
        if (refNumber) {
          dbRegistration = await getFirestoreRegistration(refNumber);
        }

        const registrationData = req.body.registrationData || {};
        const combinedBody = {
          ...dbRegistration,
          ...registrationData,
          ...req.body,
          docId: dbRegistration?.id || dbRegistration?.docId || registrationData.docId || refNumber,
          passId: dbRegistration?.passId || registrationData.passId || refNumber,
          email: primaryEmail || registrationData.email || dbRegistration?.email || req.body.email || '',
          name: req.body.name || registrationData.name || dbRegistration?.name || '',
          phone: req.body.phone || registrationData.phone || dbRegistration?.phone || '',
          parish: req.body.parish || registrationData.parish || dbRegistration?.parish || '',
          additionalAttendees: registrationData.additionalAttendees || dbRegistration?.additionalAttendees || req.body.additionalAttendees || [],
          adultsCount: registrationData.adultsCount ?? dbRegistration?.adultsCount ?? 1,
          teensCount: registrationData.teensCount ?? dbRegistration?.teensCount ?? 0,
          preteensCount: registrationData.preteensCount ?? dbRegistration?.preteensCount ?? 0,
          childrenCount: registrationData.childrenCount ?? dbRegistration?.childrenCount ?? 0,
          kidsCount: registrationData.kidsCount ?? dbRegistration?.kidsCount ?? 0,
          toddlersCount: registrationData.toddlersCount ?? dbRegistration?.toddlersCount ?? 0,
        };

        // IDEMPOTENCY GUARD: Check if email was already dispatched for this registration reference
        const refKey = getRegistrationRefKey(combinedBody) || refNumber;
        const isAlreadySent = combinedBody.email_sent === true || 
                              combinedBody.confirmation_email_sent === true || 
                              combinedBody.confirmationEmailSent === true || 
                              (refKey && sentConfirmationEmailRefs.has(refKey)) ||
                              (refKey && hitpayService.isConfirmationEmailSent(refKey));

        if (!req.body.isUpdate && isAlreadySent) {
          console.log(`[send-email]: Idempotency check active: Email already sent for ref "${refKey || primaryEmail}". Skipping duplicate dispatch.`);
          return res.json({
            success: true,
            status: 'already_sent',
            skipped: true,
            confirmation_email_sent: true,
            message: 'Email already dispatched'
          });
        }

        // 2. Compile unique recipients list: primary + attendees
        const rawRecipients = [
          primaryEmail,
          combinedBody.email,
          ...(attendeeEmails || []),
          ...(combinedBody.additionalAttendees || []).map((a: any) => typeof a === 'string' ? a : a?.email)
        ];

        const recipients = Array.from(new Set(
          rawRecipients
            .map(e => (typeof e === 'string' ? e.trim().toLowerCase() : ''))
            .filter(e => e && isValidEmail(e))
        ));

        console.log('Dispatching email to:', recipients);

        if (recipients.length === 0) {
          return res.status(400).json({
            success: false,
            error: 'No valid recipient email address provided or found for registration reference.',
            refNumber
          });
        }

        if (refNumber) {
          hitpayService.manualVerify(refNumber);
          hitpayService.markConfirmationEmailSent(refNumber);
        }

        // 3. Generate digital passes and dispatch confirmation email
        const isMusical = combinedBody.type === 'musical';
        const eventName = isMusical ? "GRACIA Musical Concert" : "GRACIA - Jubilee Conference, 25 years of grace in Singapore";
        const subject = `Registration Confirmed: GRACIA Jubilee Conference 2026 [${combinedBody.passId || refNumber}]`;

        const name = toProperCase(combinedBody.name || (combinedBody.email ? combinedBody.email.split('@')[0] : 'Valued Delegate'));
        const cleanName = name.replace(/[^a-zA-Z0-9]/g, '_');

        // Attachments (PDF passes)
        const attachments: any[] = [];
        try {
          const serverPdfBuf = await generateServerPdfPassBuffer({
            name,
            email: combinedBody.email,
            phone: combinedBody.phone,
            type: combinedBody.type,
            passId: combinedBody.passId || refNumber,
            categoryLabel: combinedBody.categoryLabel || 'Primary Delegate Registrant',
            additionalAttendees: combinedBody.additionalAttendees,
            selectedSeats: combinedBody.selectedSeats
          });
          attachments.push({
            filename: `GRACIA_Pass_${cleanName}.pdf`,
            content: serverPdfBuf,
            contentType: 'application/pdf'
          });
        } catch (pdfErr) {
          console.error(`Failed to generate server PDF pass for ${name}:`, pdfErr);
        }

        for (const addon of (combinedBody.additionalAttendees || [])) {
          if (addon && addon.name) {
            const addonName = toProperCase(addon.name);
            const addonCleanName = addonName.replace(/[^a-zA-Z0-9]/g, '_');
            try {
              const addonPdfBuf = await generateServerPdfPassBuffer({
                name: addonName,
                email: addon.email || combinedBody.email,
                phone: combinedBody.phone,
                type: combinedBody.type,
                passId: addon.passId || getBibleVersePassId(refNumber, 1, addonName),
                categoryLabel: addon.categoryLabel || 'Delegate Member',
                isPrimary: false,
                primaryContactName: name
              });
              attachments.push({
                filename: `GRACIA_Pass_${addonCleanName}.pdf`,
                content: addonPdfBuf,
                contentType: 'application/pdf'
              });
            } catch (addonPdfErr) {
              console.error(`Failed to generate PDF pass for attendee ${addonName}:`, addonPdfErr);
            }
          }
        }

        // Build list of all delegate passes
        const passes: AttendeeRecord[] = [
          {
            name: name,
            category: combinedBody.categoryLabel || 'Primary Delegate Registrant',
            parish: combinedBody.parish || 'Singapore',
            email: combinedBody.email,
            passId: combinedBody.passId || refNumber
          },
          ...(combinedBody.additionalAttendees || []).map((addon: any, idx: number) => ({
            name: toProperCase(addon.name),
            category: addon.categoryLabel || (
              addon.category === 'adult' ? 'Adult (20+ yrs)' :
              addon.category === 'teen' ? 'Teen (13-19 yrs)' :
              addon.category === 'preteen' ? 'Pre-Teen (9-12 yrs)' :
              addon.category === 'child' ? 'Child (6-8 yrs)' :
              addon.category === 'kid' ? 'Kid (3-5 yrs)' :
              addon.category === 'toddler' ? 'Toddler (< 2 yrs)' :
              'Delegate Member'
            ),
            parish: addon.parish || combinedBody.parish || 'Singapore',
            email: addon.email || combinedBody.email,
            passId: addon.passId || getBibleVersePassId(refNumber, idx + 1, addon.name)
          }))
        ];

        const adultsCount = Number(combinedBody.adultsCount || 1);
        const teensCount = Number(combinedBody.teensCount || 0);
        const preteensCount = Number(combinedBody.preteensCount || 0);
        const childrenCount = Number(combinedBody.childrenCount || 0);
        const kidsCount = Number(combinedBody.kidsCount || 0);
        const toddlersCount = Number(combinedBody.toddlersCount || 0);
        const totalSeats = adultsCount + teensCount + preteensCount + childrenCount + kidsCount + toddlersCount;

        const breakdownParts: string[] = [];
        if (adultsCount > 0) breakdownParts.push(`${adultsCount} Adult(s) / Youth(s)`);
        if (teensCount > 0) breakdownParts.push(`${teensCount} Teen(s)`);
        if (preteensCount > 0) breakdownParts.push(`${preteensCount} Pre-Teen(s)`);
        if (childrenCount > 0) breakdownParts.push(`${childrenCount} Child(ren)`);
        if (kidsCount > 0) breakdownParts.push(`${kidsCount} Kid(s)`);
        if (toddlersCount > 0) breakdownParts.push(`${toddlersCount} Toddler(s)`);

        const attendeeBreakdown = breakdownParts.length > 0
          ? breakdownParts.join(', ')
          : `${totalSeats || 1} Delegate(s)`;

        const htmlTemplate = generateConfirmationEmailHtml({
          primaryName: name,
          primaryEmail: combinedBody.email,
          phoneNumber: combinedBody.phone || '',
          totalSeats: totalSeats || passes.length || 1,
          attendeeBreakdown,
          passes,
          primaryPassId: combinedBody.passId || refNumber || (passes[0] && passes[0].passId)
        });

        const mailResult = await sendMailWithFallback({
          to: recipients,
          subject,
          html: htmlTemplate,
          attachments,
          fromName: "GRACIA 2026"
        });

        if (mailResult.success) {
          if (refKey) {
            sentConfirmationEmailRefs.set(refKey, { sentAt: new Date().toISOString(), email: primaryEmail });
            hitpayService.markConfirmationEmailSent(refKey);
            try {
              if (combinedBody.docId) {
                const projectId = "gen-lang-client-0265813654";
                const databaseId = "ai-studio-graciajysgjubile-5a9e3705-027d-4d95-b577-b02be2713722";
                const patchUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents/registrations/${encodeURIComponent(combinedBody.docId)}?updateMask.fieldPaths=email_sent&updateMask.fieldPaths=confirmation_email_sent`;
                await fetch(patchUrl, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    fields: {
                      email_sent: { booleanValue: true },
                      confirmation_email_sent: { booleanValue: true }
                    }
                  })
                });
              }
            } catch (e) {
              console.warn('[Update email_sent in Firestore warning]:', e);
            }
          }
          return res.json({
            success: true,
            recipients,
            status: 'sent',
            refNumber,
            message: `Confirmation email successfully dispatched to recipients: ${recipients.join(', ')}`
          });
        } else {
          return res.status(500).json({
            success: false,
            error: mailResult.error || 'Failed to send confirmation email',
            refNumber
          });
        }
      } catch (err: any) {
        console.error('[send-email action=send-confirmation error]:', err);
        return res.status(500).json({
          success: false,
          error: err.message || 'Error processing email dispatch'
        });
      }
    }

    const { recipientEmail, recipientName, subject, replyText, adminEmail, adminName, pdfBase64, pdfFilename, emailType, isRawHtml } = req.body;
    
    if (!recipientEmail || !replyText) {
      return res.status(400).json({ status: "error", message: "recipientEmail and replyText are required" });
    }

    if (!isValidEmail(recipientEmail)) {
      return res.status(400).json({ status: "error", message: `Invalid recipient address: "${recipientEmail}" does not satisfy RFC 5321 email syntax.` });
    }

    const senderEmail = process.env.SMTP_USER || "jysg25@jesusyouth.org";

    // Prepare attachments if PDF provided
    const attachments = [];
    if (pdfBase64) {
      const cleanBase64 = pdfBase64.replace(/^data:application\/pdf;base64,/, '');
      attachments.push({
        filename: pdfFilename || `GRACIA-E-Ticket-${(recipientName || 'Attendee').replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`,
        content: Buffer.from(cleanBase64, 'base64'),
        contentType: 'application/pdf'
      });
    }

    // Check if replyText is already a complete HTML structure (e.g. invitation card)
    const isFullHtmlDocument = isRawHtml || emailType === 'invitation' || /^\s*<(div|table|!DOCTYPE|html)/i.test(replyText.trim());

    // Format body text: preserve HTML or convert plain text paragraphs
    const hasHtml = /<[a-z][\s\S]*>/i.test(replyText);
    const formattedBody = hasHtml 
      ? replyText 
      : replyText
          .split(/\n\s*\n/)
          .map((p: string) => `<p style="margin: 0 0 14px 0; line-height: 1.6; color: #1F2937;">${p.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br />")}</p>`)
          .join("");

    const htmlTemplate = isFullHtmlDocument ? formattedBody : `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Re: GRACIA Inquiry Support</title>
        <style>
          @keyframes pulseGlow {
            0% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
            100% { background-position: 0% 50%; }
          }
          .animated-header {
            background: linear-gradient(-45deg, #1A2F75, #2242A6, #7C3AED, #C81E6E);
            background-size: 300% 300%;
            animation: pulseGlow 8s ease infinite;
          }
        </style>
      </head>
      <body style="margin: 0; padding: 0; background-color: #f5edf7; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; color: #2D1836;">
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f5edf7; padding: 32px 16px;">
          <tr>
            <td align="center">
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 620px; background-color: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 12px 35px rgba(40,18,44,0.08); border: 1px solid #e2d2e8;">
                
                <!-- ANIMATED HEADER BANNER (GRACIA ROYAL PURPLE & GOLD) -->
                <tr>
                  <td class="animated-header" style="background: linear-gradient(135deg, #1C0D1E 0%, #28122C 50%, #3D1842 100%); padding: 32px 28px 24px 28px; text-align: center; color: #ffffff; border-top: 5px solid #E8B400;">
                    <div style="text-align: center; margin-bottom: 12px;">
                      <img src="${JY_OFFICIAL_LOGO_URL}" alt="Jesus Youth Singapore" width="50" height="50" border="0" style="width: 50px; height: 50px; max-width: 50px; max-height: 50px; border-radius: 50%; display: inline-block; vertical-align: middle; border: 2px solid #E8B400; background-color: #FFFFFF;" />
                    </div>
                    <div style="display: inline-block; background: rgba(232, 180, 0, 0.2); border: 1px solid #E8B400; padding: 5px 16px; border-radius: 20px; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 1.5px; color: #E8B400; margin-bottom: 10px;">
                      JESUS YOUTH SINGAPORE
                    </div>
                    <h1 style="margin: 0 0 6px 0; font-size: 30px; font-weight: 800; letter-spacing: -0.5px; color: #ffffff; font-family: 'Playfair Display', Georgia, serif;">
                      GRACIA
                    </h1>
                    <p style="margin: 0; font-size: 14px; font-weight: 600; color: #e3cbf5; letter-spacing: 0.5px;">
                      25th Jubilee Celebration Inquiry Reply
                    </p>
                  </td>
                </tr>

                <!-- COUNTDOWN SUB-HEADING BANNER -->
                <tr>
                  <td style="background: #FEF3C7; padding: 14px 24px; border-bottom: 2px solid #E8B400; text-align: center;">
                    <table border="0" cellpadding="0" cellspacing="0" width="100%">
                      <tr>
                        <td align="center">
                          <span style="font-size: 13px; font-weight: 800; color: #78350F; text-transform: uppercase; letter-spacing: 0.8px;">
                            ⏳ <span style="color: #C81E6E;">OCTOBER 10 & 11, 2026</span>
                          </span>
                          <div style="font-size: 11px; color: #78350F; font-weight: 600; margin-top: 2px;">
                            GRACIA Conference & Musical Concert • Singapore
                          </div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- BODY CONTENT -->
                <tr>
                  <td style="padding: 28px 32px 24px 32px; font-size: 15px; line-height: 1.7; color: #2D1836;">
                    <div style="margin-bottom: 20px;">
                      ${formattedBody}
                    </div>

                    <div style="border-top: 1px solid #e2d2e8; padding-top: 20px; margin-top: 28px;">
                      <p style="margin: 0 0 4px 0; font-size: 14px; font-weight: 600; color: #53325c;">
                        In Christ,
                      </p>
                      <p style="margin: 0 0 2px 0; font-size: 15px; font-weight: 800; color: #1C0D1E;">
                        ${adminName || 'Organizing Team'}
                      </p>
                      <p style="margin: 0; font-size: 12px; color: #6b4d75; font-weight: 500;">
                        Jesus Youth Singapore GRACIA Conference Team
                      </p>
                    </div>
                  </td>
                </tr>

                <!-- FOOTER WITH SOCIAL ICONS -->
                <tr>
                  <td style="background-color: #f0e6f5; padding: 24px 28px; text-align: center; border-top: 1px solid #e2d2e8;">
                    <p style="margin: 0 0 14px 0; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; color: #53325c;">
                      Connect with Jesus Youth Singapore
                    </p>

                    <!-- Social Links with Icon Buttons -->
                    <table border="0" cellpadding="0" cellspacing="0" align="center" style="margin: 0 auto;">
                      <tr>
                        <!-- Email Icon Button -->
                        <td style="padding: 4px;">
                          <a href="mailto:jysg25@jesusyouth.org" target="_blank" style="display: inline-block; background-color: #FAF5FC; border: 1px solid #E8B400; color: #1C0D1E; padding: 8px 14px; border-radius: 50px; text-decoration: none; font-size: 12px; font-weight: 700;">
                            ✉️ jysg25@jesusyouth.org
                          </a>
                        </td>
                        <!-- Website Icon Button -->
                        <td style="padding: 4px;">
                          <a href="https://singapore.jesusyouth.org/" target="_blank" style="display: inline-block; background-color: #FAF5FC; border: 1px solid #E8B400; color: #1C0D1E; padding: 8px 14px; border-radius: 50px; text-decoration: none; font-size: 12px; font-weight: 700;">
                            🌐 Website
                          </a>
                        </td>
                        <!-- Instagram Icon Button -->
                        <td style="padding: 4px;">
                          <a href="https://www.instagram.com/jesusyouth_singapore" target="_blank" style="display: inline-block; background-color: #FAF5FC; border: 1px solid #E8B400; color: #BE185D; padding: 8px 14px; border-radius: 50px; text-decoration: none; font-size: 12px; font-weight: 700;">
                            📸 Instagram
                          </a>
                        </td>
                      </tr>
                    </table>

                    <p style="margin: 16px 0 0 0; font-size: 11px; color: #6b4d75; line-height: 1.4;">
                      Jesus Youth Singapore • 25th Jubilee (GRACIA)
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

    // Dispatch Email using multi-tier fallback engine
    const mailResult = await sendMailWithFallback({
      to: recipientEmail,
      subject: subject || "Re: GRACIA Inquiry - Jesus Youth Singapore",
      html: htmlTemplate,
      attachments,
      replyTo: adminEmail || "singapore@jesusyouth.org",
      fromName: adminName || "Jesus Youth Singapore (GRACIA)"
    });

    if (mailResult.success) {
      return res.json({ 
        status: "sent", 
        messageId: mailResult.messageId, 
        method: mailResult.method,
        message: `Direct email sent successfully to ${recipientEmail}!`
      });
    } else {
      return res.json({ 
        status: "recorded_with_notice", 
        error: mailResult.error,
        hint: mailResult.hint,
        message: `Reply saved! ${mailResult.hint}` 
      });
    }
  });

  // Direct Intercession Reminder Email Dispatching Endpoint
  app.post("/api/send-intercession-reminder", async (req, res) => {
    const { recipientEmail, recipientName, subject, messageBody, commitmentsSummary, record } = req.body;

    if (!recipientEmail) {
      return res.status(400).json({ status: "error", message: "recipientEmail is required" });
    }

    const senderEmail = "jysg25@gmail.com";
    
    // Clean raw body to prevent duplicate "Dear Name,", "Your Spiritual Commitments:", or repeated sign-offs
    let cleanRawBody = messageBody || '';
    cleanRawBody = cleanRawBody.replace(/^Dear\s+[^,\n]+,?\s*/i, '').trim();
    cleanRawBody = cleanRawBody.replace(/Your Spiritual Commitments:[\s\S]*?(?=\n\n|\n[A-Z]|$)/i, '').trim();
    cleanRawBody = cleanRawBody.replace(/(United in Prayer|With prayers and gratitude|GRACIA Intercession Team|Intercession Team|Jesus Youth Singapore)[\s\S]*/i, '').trim();

    const formattedBody = cleanRawBody
      .split('\n')
      .map((line: string) => line.trim())
      .filter(Boolean)
      .map((line: string) => `<p style="margin: 0 0 12px 0; line-height: 1.6;">${line}</p>`)
      .join('');

    const formatCommitmentCardHtml = (summaryText: string, rec?: any) => {
      // If rec object is provided, render detailed progress breakdown
      if (rec && typeof rec === 'object') {
        const items: Array<{
          icon: string;
          label: string;
          pledgedStr: string;
          completedStr: string;
          percentage: number;
          isCompleted: boolean;
        }> = [];

        // 1. Holy Mass
        if (rec.holyMass) {
          const p = Number(rec.holyMass) || 0;
          const c = Number(rec.completedHolyMass) || 0;
          const pct = p > 0 ? Math.min(100, Math.round((c / p) * 100)) : 0;
          items.push({
            icon: '✝️',
            label: 'Holy Mass(es)',
            pledgedStr: `${p} Mass(es)`,
            completedStr: `${c} / ${p} (${pct}%)`,
            percentage: pct,
            isCompleted: c >= p && p > 0
          });
        }

        // 2. Eucharistic Adoration (slots -> 2 slots = 1 hour)
        if (rec.adoration) {
          const pSlots = Number(rec.adoration) || 0;
          const cSlots = Number(rec.completedAdoration) || 0;
          const pHours = Math.floor(pSlots / 2);
          const cHours = (cSlots * 0.5).toFixed(1).replace('.0', '');
          const pct = pSlots > 0 ? Math.min(100, Math.round((cSlots / pSlots) * 100)) : 0;
          items.push({
            icon: '🕯️',
            label: 'Eucharistic Adoration',
            pledgedStr: `${pHours} Hour(s)`,
            completedStr: `${cHours} / ${pHours} Hr(s) (${pct}%)`,
            percentage: pct,
            isCompleted: cSlots >= pSlots && pSlots > 0
          });
        }

        // 3. Full Rosary
        if (rec.rosary) {
          const p = Number(rec.rosary) || 0;
          const c = Number(rec.completedRosary) || 0;
          const pct = p > 0 ? Math.min(100, Math.round((c / p) * 100)) : 0;
          items.push({
            icon: '📿',
            label: 'Full Rosary(ies)',
            pledgedStr: `${p} Rosary(ies)`,
            completedStr: `${c} / ${p} (${pct}%)`,
            percentage: pct,
            isCompleted: c >= p && p > 0
          });
        }

        // 4. Decade of Rosary
        if (rec.decadeRosary) {
          const p = Number(rec.decadeRosary) || 0;
          const c = Number(rec.completedDecadeRosary) || 0;
          const pct = p > 0 ? Math.min(100, Math.round((c / p) * 100)) : 0;
          items.push({
            icon: '📿',
            label: 'Decade(s) of Rosary',
            pledgedStr: `${p} Decade(s)`,
            completedStr: `${c} / ${p} (${pct}%)`,
            percentage: pct,
            isCompleted: c >= p && p > 0
          });
        }

        // 5. Divine Mercy Chaplet
        if (rec.divineMercy) {
          const p = Number(rec.divineMercy) || 0;
          const c = Number(rec.completedDivineMercy) || 0;
          const pct = p > 0 ? Math.min(100, Math.round((c / p) * 100)) : 0;
          items.push({
            icon: '🕊️',
            label: 'Divine Mercy Chaplet(s)',
            pledgedStr: `${p} Chaplet(s)`,
            completedStr: `${c} / ${p} (${pct}%)`,
            percentage: pct,
            isCompleted: c >= p && p > 0
          });
        }

        // 6. Fasting
        if (rec.fastMeal) {
          const p = Number(rec.fastMeal) || 0;
          const c = Number(rec.completedFastMeal) || 0;
          const pct = p > 0 ? Math.min(100, Math.round((c / p) * 100)) : 0;
          items.push({
            icon: '🍞',
            label: 'Meal(s) Fasting',
            pledgedStr: `${p} Meal(s)`,
            completedStr: `${c} / ${p} (${pct}%)`,
            percentage: pct,
            isCompleted: c >= p && p > 0
          });
        }

        // 7. Abstain from Meat
        if (rec.abstainMeat) {
          const p = Number(rec.abstainMeat) || 0;
          const c = Number(rec.completedAbstainMeat) || 0;
          const pct = p > 0 ? Math.min(100, Math.round((c / p) * 100)) : 0;
          items.push({
            icon: '🥦',
            label: 'Day(s) Abstain from Meat',
            pledgedStr: `${p} Day(s)`,
            completedStr: `${c} / ${p} (${pct}%)`,
            percentage: pct,
            isCompleted: c >= p && p > 0
          });
        }

        // 8. Short Prayers
        if (rec.shortPrayers) {
          const p = Number(rec.shortPrayers) || 0;
          const c = Number(rec.completedShortPrayers) || 0;
          const pct = p > 0 ? Math.min(100, Math.round((c / p) * 100)) : 0;
          items.push({
            icon: '🤲',
            label: 'Short Prayer(s)',
            pledgedStr: `${p} Prayer(s)`,
            completedStr: `${c} / ${p} (${pct}%)`,
            percentage: pct,
            isCompleted: c >= p && p > 0
          });
        }

        if (items.length > 0) {
          const rowsHtml = items.map(item => {
            const badgeBg = item.isCompleted ? '#DCFCE7' : item.percentage > 0 ? '#FEF3C7' : '#F3E8FF';
            const badgeText = item.isCompleted ? '#166534' : item.percentage > 0 ? '#92400E' : '#6B21A8';
            const badgeBorder = item.isCompleted ? '#86EFAC' : item.percentage > 0 ? '#FDE68A' : '#E9D5FF';
            const statusLabel = item.isCompleted ? '✓ Completed' : item.percentage > 0 ? `${item.percentage}% Done` : 'Pending';

            return `
              <tr>
                <td style="background-color: #ffffff; border: 1.5px solid #E9D5FF; border-radius: 12px; padding: 14px 18px;">
                  <table border="0" cellpadding="0" cellspacing="0" width="100%">
                    <tr>
                      <td style="width: 32px; font-size: 20px; text-align: center; vertical-align: top; padding-top: 2px;">${item.icon}</td>
                      <td style="vertical-align: middle; line-height: 1.4; padding-left: 8px;">
                        <div style="color: #3B0764; font-weight: 800; font-size: 14px;">
                          ${item.label}
                        </div>
                        <div style="font-size: 12px; color: #6B7280; font-weight: 600; margin-top: 2px;">
                          Pledged: <span style="color: #4C1D95; font-weight: 700;">${item.pledgedStr}</span> &bull; Progress: <span style="color: #7E22CE; font-weight: 700;">${item.completedStr}</span>
                        </div>
                        <div style="width: 100%; background-color: #F3E8FF; border-radius: 10px; height: 8px; margin-top: 6px; overflow: hidden;">
                          <div style="width: ${item.percentage}%; background: linear-gradient(90deg, #7E22CE, #C81E6E); height: 100%; border-radius: 10px;"></div>
                        </div>
                      </td>
                      <td style="vertical-align: middle; text-align: right; width: 110px; padding-left: 10px;">
                        <span style="display: inline-block; background-color: ${badgeBg}; color: ${badgeText}; border: 1px solid ${badgeBorder}; border-radius: 20px; padding: 4px 10px; font-size: 11px; font-weight: 800; white-space: nowrap;">
                          ${statusLabel}
                        </span>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr><td style="height: 8px; font-size: 0; line-height: 0;">&nbsp;</td></tr>
            `;
          }).join('');

          return `
            <div style="background: #faf5fc; border: 1px solid #e9d8f0; border-left: 4px solid #E8B400; border-radius: 14px; padding: 22px 24px; margin: 24px 0; box-shadow: 0 4px 16px rgba(40, 18, 44, 0.04);">
              <div style="font-size: 13px; font-weight: 800; color: #78350F; text-transform: uppercase; margin-bottom: 14px; letter-spacing: 1px; border-bottom: 1px solid #e9d8f0; padding-bottom: 10px;">
                <span style="font-size: 16px; margin-right: 6px;">🌸</span> YOUR SPIRITUAL BOUQUET PLEDGES & LATEST PROGRESS:
              </div>
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse: separate;">
                ${rowsHtml}
              </table>
            </div>
          `;
        }
      }

      // Fallback format if rec object is not supplied
      if (!summaryText) return '';
      const items = summaryText.split(/,\s*|\n+/).map(s => s.trim()).filter(Boolean);
      if (items.length === 0) return '';

      const getIcon = (txt: string) => {
        const lower = txt.toLowerCase();
        if (lower.includes('mass')) return '✝️';
        if (lower.includes('adoration')) return '🕯️';
        if (lower.includes('rosary') || lower.includes('decade')) return '📿';
        if (lower.includes('divine mercy') || lower.includes('chaplet')) return '🕊️';
        if (lower.includes('fasting') || lower.includes('meal')) return '🍞';
        if (lower.includes('meat') || lower.includes('abstain')) return '🥦';
        if (lower.includes('short prayer') || lower.includes('memorare') || lower.includes('creed') || lower.includes('salve') || lower.includes('michael')) return '🤲';
        return '🌸';
      };

      const rowsHtml = items.map(item => {
        const icon = getIcon(item);
        return `
          <tr>
            <td style="background-color: #ffffff; border: 1px solid #e9d8f0; border-radius: 12px; padding: 12px 18px;">
              <table border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td style="width: 32px; font-size: 20px; text-align: center; vertical-align: middle;">${icon}</td>
                  <td style="vertical-align: middle; line-height: 1.4; color: #1C0D1E; font-weight: 700; font-size: 14px; padding-left: 8px;">
                    ${item}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr><td style="height: 8px; font-size: 0; line-height: 0;">&nbsp;</td></tr>
        `;
      }).join('');

      return `
        <div style="background: #faf5fc; border: 1px solid #e9d8f0; border-left: 4px solid #E8B400; border-radius: 14px; padding: 22px 24px; margin: 24px 0; box-shadow: 0 4px 16px rgba(40, 18, 44, 0.04);">
          <div style="font-size: 13px; font-weight: 800; color: #78350F; text-transform: uppercase; margin-bottom: 14px; letter-spacing: 1px; border-bottom: 1px solid #e9d8f0; padding-bottom: 10px;">
            <span style="font-size: 16px; margin-right: 6px;">🌸</span> YOUR SPIRITUAL BOUQUET COMMITMENTS:
          </div>
          <table border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse: separate;">
            ${rowsHtml}
          </table>
        </div>
      `;
    };

    const htmlTemplate = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>GRACIA Intercession Commitment Reminder</title>
      </head>
      <body style="margin: 0; padding: 0; background-color: #f5edf7; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; color: #2D1836;">
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f5edf7; padding: 32px 16px;">
          <tr>
            <td align="center">
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 620px; background-color: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 30px rgba(40, 18, 44, 0.08); border: 1px solid #e2d2e8;">
                
                <!-- HEADER BAR WITH JY LOGO (GRACIA ROYAL PURPLE & GOLD) -->
                <tr>
                  <td style="background: linear-gradient(135deg, #1C0D1E 0%, #28122C 50%, #3D1842 100%); padding: 32px 28px; text-align: center; border-top: 5px solid #E8B400;">
                    <div style="text-align: center; margin-bottom: 14px;">
                      <img src="${JY_OFFICIAL_LOGO_URL}" alt="Jesus Youth Singapore" width="52" height="52" border="0" style="width: 52px; height: 52px; max-width: 52px; max-height: 52px; border-radius: 50%; display: inline-block; vertical-align: middle; border: 2px solid #E8B400; background-color: #FFFFFF;" />
                    </div>
                    <div style="display: inline-block; background: rgba(232, 180, 0, 0.2); border: 1px solid #E8B400; padding: 5px 16px; border-radius: 20px; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 1.5px; color: #E8B400; margin-bottom: 10px;">
                      JESUS YOUTH SINGAPORE
                    </div>
                    <h1 style="color: #ffffff; margin: 0 0 6px 0; font-size: 26px; font-weight: 800; font-family: 'Playfair Display', Georgia, serif;">
                      GRACIA • SPIRITUAL BOUQUET
                    </h1>
                    <p style="color: #e3cbf5; margin: 0; font-size: 14px; font-weight: 600;">
                      Jesus Youth Singapore Silver Jubilee Intercession Reminder
                    </p>
                  </td>
                </tr>

                <!-- TARGET DATE BANNER -->
                <tr>
                  <td style="background-color: #FEF3C7; padding: 12px 28px; text-align: center; border-bottom: 2px solid #E8B400;">
                    <span style="font-size: 13px; font-weight: 800; color: #78350F; text-transform: uppercase; letter-spacing: 0.8px;">
                      🙏 Spiritual Commitments to be completed before <span style="color: #1C0D1E;">October 10, 2026</span>
                    </span>
                  </td>
                </tr>

                <!-- BODY -->
                <tr>
                  <td style="padding: 28px 32px; font-size: 15px; line-height: 1.7; color: #2D1836;">
                    <h3 style="margin: 0 0 16px 0; font-size: 18px; color: #1C0D1E; font-weight: 700;">
                      Dear ${recipientName || 'Prayer Warrior'},
                    </h3>

                    <div style="margin-bottom: 20px; color: #2D1836;">
                      ${formattedBody}
                    </div>

                    <!-- SPECIAL SPIRITUAL ANNOUNCEMENT CALLOUT BOX -->
                    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #fdf2f8; border: 1px solid #fbcfe8; border-left: 4px solid #E8B400; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
                      <tr>
                        <td>
                          <div style="font-size: 13px; font-weight: 800; color: #78350F; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">
                            ✝️ A Special Blessing for Our Jubilee
                          </div>
                          <p style="margin: 0 0 10px 0; font-size: 14px; color: #1C0D1E; line-height: 1.6; font-weight: 600;">
                            We are extremely overjoyed to share that the Apostolic Penitentiary has granted a <strong>Partial Indulgence</strong> to all who attend the Thanksgiving Mass to be celebrated by His Eminence Cardinal William Goh during the Gracia Jubilee Conference.
                          </p>
                          <p style="margin: 0; font-size: 13.5px; color: #53325c; line-height: 1.5;">
                            We warmly invite you to join us in full and active participation, with prayerful preparation, as we open our hearts to receive this extraordinary grace of the Jubilee.
                          </p>
                        </td>
                      </tr>
                    </table>

                    ${formatCommitmentCardHtml(commitmentsSummary, record)}

                    <!-- LOGIN TO PORTAL CTA BUTTON -->
                    <div style="text-align: center; margin: 28px 0 24px 0; background-color: #faf5fc; border: 1px solid #e9d8f0; border-radius: 16px; padding: 22px 20px;">
                      <p style="margin: 0 0 6px 0; font-size: 15px; font-weight: 800; color: #1C0D1E;">
                        ✨ Track & Update Your Prayer Progress Online
                      </p>
                      <p style="margin: 0 0 16px 0; font-size: 13px; color: #53325c; line-height: 1.5;">
                        Sign in with your Google account anytime to view your live commitments, log completed prayers, and update your spiritual bouquet progress.
                      </p>
                      <table border="0" cellpadding="0" cellspacing="0" align="center" style="margin: 0 auto;">
                        <tr>
                          <td align="center" style="border-radius: 50px; background: linear-gradient(135deg, #1C0D1E 0%, #28122C 50%, #3D1842 100%); border: 2px solid #E8B400; box-shadow: 0 6px 20px rgba(40, 18, 44, 0.25);">
                            <a href="https://gracia2026.vercel.app/" target="_blank" style="display: inline-block; color: #ffffff; text-decoration: none; padding: 14px 32px; font-weight: 800; font-size: 15px; border-radius: 50px; font-family: 'Helvetica Neue', Arial, sans-serif; letter-spacing: 0.3px;">
                              🔐 Login to Portal to Update Progress
                            </a>
                          </td>
                        </tr>
                      </table>
                    </div>

                    <div style="border-top: 1px solid #e2d2e8; padding-top: 20px; margin-top: 24px;">
                      <p style="margin: 0 0 4px 0; font-size: 14px; font-weight: 600; color: #53325c;">
                        With prayers and gratitude,
                      </p>
                      <p style="margin: 0 0 2px 0; font-size: 15px; font-weight: 800; color: #1C0D1E;">
                        GRACIA Intercession Team
                      </p>
                      <p style="margin: 0; font-size: 13px; color: #6b4d75; font-weight: 600;">
                        Jesus Youth Singapore Jubilee Team
                      </p>
                    </div>
                  </td>
                </tr>

                <!-- FOOTER -->
                <tr>
                  <td style="background-color: #f0e6f5; padding: 20px 28px; text-align: center; border-top: 1px solid #e2d2e8;">
                    <p style="margin: 0; font-size: 12px; color: #1C0D1E; font-weight: 700;">
                      Jesus Youth Singapore Jubilee Team • 25th Jubilee (GRACIA)
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

    try {
      const reminderResult = await sendMailWithFallback({
        to: recipientEmail,
        subject: subject || "GRACIA Spiritual Bouquet Commitment Reminder",
        html: htmlTemplate,
        replyTo: "jysg25@jesusyouth.org",
        fromName: "Jesus Youth Singapore Jubilee Team"
      });

      if (reminderResult.success) {
        return res.json({
          status: "sent",
          messageId: reminderResult.messageId,
          method: reminderResult.method,
          message: `Reminder email successfully dispatched to ${recipientEmail}!`
        });
      } else {
        return res.json({
          status: "recorded_with_notice",
          error: reminderResult.error,
          hint: reminderResult.hint,
          message: `Reminder recorded! ${reminderResult.hint}`
        });
      }
    } catch (err: any) {
      return res.json({
        status: "error",
        error: err.message || String(err),
        message: "Failed to dispatch reminder email."
      });
    }
  });

  // Proxy registration submissions to Google Apps Script if configured
  app.post("/api/register-proxy", async (req, res) => {
    const { appsScriptUrl, data } = req.body;
    if (!appsScriptUrl) {
      return res.status(400).json({ status: "error", message: "No Apps Script URL provided" });
    }

    try {
      const response = await fetch(appsScriptUrl, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(data),
      });
      const resultText = await response.text();
      res.json({ status: "success", result: resultText });
    } catch (err: any) {
      res.status(500).json({ status: "error", message: err.toString() });
    }
  });

  // Serve public static assets with CORS & long-term caching
  const publicPath = path.join(process.cwd(), "public");
  app.use(express.static(publicPath, {
    maxAge: '1y',
    setHeaders: (res) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    }
  }));

  // Vite middleware setup
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true, host: "0.0.0.0", port: 3000 },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`GRACIA Applet server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
