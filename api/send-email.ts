import type { VercelRequest, VercelResponse } from '@vercel/node';
import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const currentDir = typeof __dirname !== 'undefined'
  ? __dirname
  : path.dirname(fileURLToPath(import.meta.url));

// Hardcoded public absolute production URLs hosted on Vercel CDN for 100% email client compatibility
const APP_BASE_URL = 'https://gracia2026.vercel.app';
const JY_OFFICIAL_LOGO_URL = "https://gracia2026.vercel.app/jysg_logo.png";
const JUBILEE_25_LOGO_URL = "https://gracia2026.vercel.app/jysg_jubilee_logo.png";

function getHeaderLogoAttachments() {
  // Do NOT attach logo files as email attachments so they do not show up as downloadable files at the bottom of emails
  return [];
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

    console.log(`[SMTP 587 Success] Dispatched to ${recipientEmail}: ${info.messageId}`);
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
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
    let body = req.body || {};
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch (e) {
        console.error('Failed to parse stringified req.body in send-email:', e);
      }
    }

    // 1. If action is send-confirmation OR request contains registration/pass fields, delegate to confirmation pass handler
    const isConfirmationRequest = 
      body.action === 'send-confirmation' || 
      body.action === 'send-pass' || 
      Boolean(body.refNumber) || 
      Boolean(body.referenceNumber) || 
      Boolean(body.registrationData) ||
      (Boolean(body.primaryEmail) && !body.replyText && !body.html);

    if (isConfirmationRequest) {
      try {
        let handler: any;
        try {
          // @ts-ignore
          handler = (await import('./send-confirmation-email.js')).default;
        } catch (err1) {
          try {
            // @ts-ignore
            handler = (await import('./send-confirmation-email')).default;
          } catch (err2) {
            console.error('Dynamic import of send-confirmation-email failed:', err1, err2);
          }
        }
        if (typeof handler === 'function') {
          return await handler(req, res);
        }
      } catch (delegationErr: any) {
        console.error('Error delegating to confirmation email handler:', delegationErr);
      }
    }

    // 2. Extract and normalize fields with comprehensive fallback aliases for standard/inquiry emails
    const rawRecipientEmail = body.recipientEmail || body.email || body.primaryEmail || body.to || body.registrationData?.email || '';
    const recipientEmail = typeof rawRecipientEmail === 'string' ? rawRecipientEmail.trim().toLowerCase() : '';

    const rawRecipientName = body.recipientName || body.name || body.fullName || body.primaryContactName || body.registrationData?.name || '';
    const recipientName = (typeof rawRecipientName === 'string' && rawRecipientName.trim().length > 0) ? rawRecipientName.trim() : 'Delegate';

    const subject = body.subject || "GRACIA Update - Jesus Youth Singapore";
    const rawReplyText = body.replyText || body.html || body.htmlContent || body.body || body.message || body.text || '';

    if (!recipientEmail) {
      return res.status(400).json({ status: 'error', message: 'Recipient email address is required' });
    }

    if (!isValidEmail(recipientEmail)) {
      return res.status(400).json({ status: 'error', message: `Invalid recipient address: "${recipientEmail}" does not satisfy RFC 5321 email syntax.` });
    }

    const replyText = rawReplyText || `Thank you for registering for GRACIA 2026. Your registration and details have been recorded.`;

    const { adminEmail, adminName, pdfBase64, pdfFilename, emailType, isRawHtml } = body;

    const attachments: any[] = [...getHeaderLogoAttachments()];
    if (pdfBase64) {
      const cleanBase64 = pdfBase64.replace(/^data:application\/pdf;base64,/, '');
      attachments.push({
        filename: pdfFilename || `GRACIA-Pass-${(recipientName || 'Delegate').replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`,
        content: Buffer.from(cleanBase64, 'base64'),
        contentType: 'application/pdf'
      });
    }

    const isFullHtmlDocument = isRawHtml || emailType === 'invitation' || /^\s*<(div|table|!DOCTYPE|html)/i.test(replyText.trim());

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
      </head>
      <body style="margin: 0; padding: 0; background-color: #F8F6F3; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; color: #1E293B;">
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #F8F6F3; padding: 32px 16px;">
          <tr>
            <td align="center">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; margin: 0 auto; width: 100%; background-color: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 8px 32px rgba(0,0,0,0.06); border: 1px solid #EAE5DF;">
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
                  <td style="padding: 28px 28px 20px 28px;">
                    <div style="font-size: 15px; color: #0F172A; margin-bottom: 12px;">
                      Dear <strong>${recipientName || 'Delegate'}</strong>,
                    </div>
                    <div style="font-size: 14px; line-height: 1.7; color: #334155; margin-bottom: 24px;">
                      ${formattedBody}
                    </div>
                    ${adminName ? `
                      <div style="border-top: 1px solid #EAE5DF; padding-top: 16px; margin-top: 24px; font-size: 12.5px; color: #64748B;">
                        Responded by: <strong style="color: #0F172A;">${adminName}</strong>${adminEmail ? ` (<a href="mailto:${adminEmail}" style="color: #2563EB; text-decoration: none;">${adminEmail}</a>)` : ''}<br>
                        <strong style="color: #0F172A;">Jesus Youth Singapore GRACIA Jubilee Conference Team</strong>
                      </div>
                    ` : `
                      <div style="border-top: 1px solid #EAE5DF; padding-top: 16px; margin-top: 24px; font-size: 12.5px; color: #64748B;">
                        In Christ,<br>
                        <strong style="color: #0F172A;">Jesus Youth Singapore GRACIA Jubilee Conference Team</strong>
                      </div>
                    `}
                  </td>
                </tr>
                <tr>
                  <td style="background-color: #F8FAFC; padding: 16px 24px; text-align: center; border-top: 1px solid #EAE5DF; font-size: 11px; color: #64748B;">
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

    const mailResult = await sendMailWithFallback({
      to: recipientEmail,
      subject: subject || "GRACIA Update - Jesus Youth Singapore",
      html: htmlTemplate,
      attachments
    });

    if (mailResult.success) {
      return res.status(200).json({
        status: 'sent',
        message: `Email sent to ${recipientEmail}`,
        messageId: mailResult.messageId,
        method: mailResult.method
      });
    } else {
      return res.status(200).json({
        status: 'notice',
        message: 'Email service could not dispatch (credentials missing or not active).',
        details: mailResult.error,
        hint: mailResult.hint
      });
    }
  } catch (err: any) {
    console.error('Error handling send-email:', err);
    return res.status(500).json({ status: 'error', message: err.message || 'Failed to send email' });
  }
}
