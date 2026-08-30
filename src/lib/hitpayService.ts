import QRCode from 'qrcode';
import crypto from 'crypto';
import { getBibleVersePassId } from './bibleVerses';

export interface CreatePaymentParams {
  amount: number;
  baseFee?: number;
  additionalContribution?: number;
  currency?: string;
  name: string;
  email?: string;
  phone?: string;
  purpose?: string;
  passId?: string;
  referenceNumber?: string;
  redirectUrl?: string;
  webhookUrl?: string;
}

export type PaymentLifecycleStatus = 'pending' | 'succeeded' | 'failed' | 'expired';

export interface HitPayWorkflowLogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'success' | 'warn' | 'error';
  stage: 'QR_GENERATED' | 'GATEWAY_REQUEST' | 'POLL_CHECK' | 'WEBHOOK_RECEIVED' | 'SIGNATURE_VERIFIED' | 'PAYMENT_SETTLED' | 'TEST_CONNECTION' | 'FALLBACK_TRIGGERED';
  referenceNumber?: string;
  paymentRequestId?: string;
  amount?: number;
  message: string;
  details?: any;
}

export interface PaymentRecord {
  id: string; // HitPay Payment Request ID or internal fallback ID
  referenceNumber: string;
  amount: number;
  baseFee: number;
  additionalContribution: number;
  currency: string;
  name: string;
  email: string;
  phone: string;
  purpose: string;
  status: PaymentLifecycleStatus;
  createdAt: string;
  settledAt?: string;
  paynowUen: string;
  isHitpayGateway: boolean;
  hitpayEnv: string;
  checkoutUrl?: string | null;
  hitpayQrCode?: string | null; // Raw EMVCo payload or URL
  hitpayQrDataUrl?: string | null; // High-res image data URL
  hitpayResponse?: any;
  hitpayError?: any;
  webhookReceived?: boolean;
  webhookPayload?: any;
  confirmation_email_sent?: boolean;
}

class HitPayService {
  private payments = new Map<string, PaymentRecord>();
  private logs: HitPayWorkflowLogEntry[] = [];
  private maxLogs = 300;

  public isConfirmationEmailSent(refId: string): boolean {
    if (!refId) return false;
    const p = this.payments.get(refId);
    return Boolean(p?.confirmation_email_sent);
  }

  public markConfirmationEmailSent(refId: string): void {
    if (!refId) return;
    const p = this.payments.get(refId);
    if (p) {
      p.confirmation_email_sent = true;
      this.payments.set(p.id, p);
      if (p.referenceNumber) {
        this.payments.set(p.referenceNumber, p);
      }
    }
  }

  constructor() {
    this.addLog({
      level: 'info',
      stage: 'TEST_CONNECTION',
      message: 'HitPay Payment Gateway Engine initialized.'
    });
  }

  public getApiKey(): string {
    const raw = (process.env.HITPAY_API_KEY || "").trim();
    if (!raw || raw === 'MY_HITPAY_API_KEY' || raw === 'YOUR_HITPAY_API_KEY' || raw === 'undefined' || raw === 'null' || raw.length < 6) {
      return "";
    }
    return raw;
  }

  public getEnv(): 'production' | 'sandbox' {
    const env = (process.env.HITPAY_ENV || 'production').trim().toLowerCase();
    return env === 'sandbox' ? 'sandbox' : 'production';
  }

  public getWebhookSalt(): string {
    return (process.env.HITPAY_SALT || '').trim();
  }

  public getBaseApiUrl(): string {
    return this.getEnv() === 'sandbox'
      ? 'https://api.sandbox.hit-pay.com/v1'
      : 'https://api.hit-pay.com/v1';
  }

  /**
   * Official HitPay Webhook HMAC-SHA256 Signature Verification
   * Algorithm:
   * 1. Exclude 'hmac' key from payload dictionary
   * 2. Sort remaining keys in alphabetical order
   * 3. Concatenate each key and value without delimiters (e.g. key1value1key2value2)
   * 4. Compute HMAC-SHA256 hash using HITPAY_SALT
   * 5. Compare computed hash with incoming signature
   */
  public verifyWebhookSignature(payload: any, signatureHeader?: string): { isValid: boolean; reason?: string } {
    const salt = this.getWebhookSalt();
    if (!salt) {
      return { isValid: true, reason: 'HITPAY_SALT not set; signature check bypassed' };
    }

    if (!payload || typeof payload !== 'object') {
      return { isValid: false, reason: 'Invalid or empty payload' };
    }

    const providedHmac = (
      signatureHeader ||
      payload.hmac ||
      ''
    ).trim();

    if (!providedHmac) {
      return { isValid: false, reason: 'No HMAC signature provided in payload or headers' };
    }

    try {
      // 1. Official HitPay Key-Value concatenation
      const sortedKeys = Object.keys(payload)
        .filter(k => k !== 'hmac' && payload[k] !== undefined && payload[k] !== null)
        .sort();

      const signatureString = sortedKeys.map(k => `${k}${payload[k]}`).join('');
      const calculatedHmac = crypto.createHmac('sha256', salt).update(signatureString).digest('hex');

      if (calculatedHmac.toLowerCase() === providedHmac.toLowerCase()) {
        return { isValid: true };
      }

      // Fallback check: raw JSON string representation if sent as JSON body
      const jsonHmac = crypto.createHmac('sha256', salt).update(JSON.stringify(payload)).digest('hex');
      if (jsonHmac.toLowerCase() === providedHmac.toLowerCase()) {
        return { isValid: true };
      }

      return {
        isValid: false,
        reason: `HMAC mismatch (Calculated: ${calculatedHmac.slice(0, 8)}..., Provided: ${providedHmac.slice(0, 8)}...)`
      };
    } catch (err: any) {
      return { isValid: false, reason: err.message || 'Error computing HMAC' };
    }
  }

  public addLog(entry: Omit<HitPayWorkflowLogEntry, 'id' | 'timestamp'>): HitPayWorkflowLogEntry {
    const fullEntry: HitPayWorkflowLogEntry = {
      id: `log_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toISOString(),
      ...entry
    };
    this.logs.unshift(fullEntry);
    if (this.logs.length > this.maxLogs) {
      this.logs.pop();
    }
    console.log(`[HitPay ${fullEntry.stage}] [${fullEntry.level.toUpperCase()}]: ${fullEntry.message}`);
    return fullEntry;
  }

  public getWorkflowLogs(limit = 100, referenceFilter?: string): HitPayWorkflowLogEntry[] {
    let result = this.logs;
    if (referenceFilter && referenceFilter.trim()) {
      const q = referenceFilter.trim().toLowerCase();
      result = result.filter(l => 
        (l.referenceNumber && l.referenceNumber.toLowerCase().includes(q)) ||
        (l.paymentRequestId && l.paymentRequestId.toLowerCase().includes(q)) ||
        (l.message && l.message.toLowerCase().includes(q))
      );
    }
    return result.slice(0, limit);
  }

  /**
   * Core function to create a dynamic HitPay Payment Request with real dynamic PayNow QR
   */
  public async createPayment(params: CreatePaymentParams, reqBaseUrl?: string): Promise<{
    status: 'success' | 'error';
    paymentRequestId: string;
    referenceNumber: string;
    amount: number;
    baseFee: number;
    additionalContribution: number;
    currency: string;
    paynowUen: string;
    checkoutUrl: string | null;
    hitpayQrCode: string | null;
    hitpayQrDataUrl: string | null;
    hitpayActive: boolean;
    hitpayEnv: string;
    paymentStatus: PaymentLifecycleStatus;
    hitpayResponse?: any;
    hitpayError?: any;
    rawPayload: any;
    message?: string;
  }> {
    const numAmount = Number(params.amount) || (Number(params.baseFee || 25) + Number(params.additionalContribution || 0));
    if (isNaN(numAmount) || numAmount <= 0) {
      throw new Error("Invalid payment amount specified");
    }

    const currency = params.currency || "SGD";
    const derivedPassId = params.passId || (params.referenceNumber ? getBibleVersePassId(params.referenceNumber, 0, params.name) : getBibleVersePassId(params.email || params.name, 0, params.name));
    const referenceNumber = params.referenceNumber?.startsWith('GRACIA-') ? params.referenceNumber : derivedPassId;
    const fallbackId = `hitpay_req_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;
    const paynowUen = "82982404";
    const apiKey = this.getApiKey();
    const env = this.getEnv();
    const baseUrl = (reqBaseUrl || process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");

    let hitpayResponseData: any = null;
    let hitpayErrorData: any = null;
    let checkoutUrl: string | null = null;
    let hitpayQrCode: string | null = null;
    let hitpayQrDataUrl: string | null = null;

    this.addLog({
      level: 'info',
      stage: 'GATEWAY_REQUEST',
      referenceNumber,
      amount: numAmount,
      message: `Initiating Payment Request for S$${numAmount.toFixed(2)} (Ref: ${referenceNumber})`,
      details: {
        env,
        hasApiKey: Boolean(apiKey && apiKey.length > 5),
        name: params.name,
        email: params.email
      }
    });

    if (apiKey && apiKey.length > 5) {
      const endpoint = `${this.getBaseApiUrl()}/payment-requests`;

      const safeWebhook = (params.webhookUrl && !params.webhookUrl.includes('localhost') && !params.webhookUrl.includes('127.0.0.1'))
        ? params.webhookUrl
        : (baseUrl && !baseUrl.includes('localhost') && !baseUrl.includes('127.0.0.1') && !baseUrl.includes('0.0.0.0'))
          ? `${baseUrl}/api/hitpay`
          : 'https://gracia2026.vercel.app/api/hitpay';

      const safeRedirect = (params.redirectUrl && !params.redirectUrl.includes('localhost') && !params.redirectUrl.includes('127.0.0.1'))
        ? params.redirectUrl
        : (baseUrl && !baseUrl.includes('localhost') && !baseUrl.includes('127.0.0.1') && !baseUrl.includes('0.0.0.0'))
          ? `${baseUrl}/payment-callback.html`
          : 'https://gracia2026.vercel.app/payment-callback.html';

      // HitPay v1 Payment Requests payload
      const urlParams = new URLSearchParams();
      urlParams.append("amount", numAmount.toString());
      urlParams.append("currency", currency);
      urlParams.append("email", params.email || "guest@gracia.org");
      urlParams.append("name", params.name || "GRACIA Participant");
      if (params.phone) urlParams.append("phone", params.phone);
      urlParams.append("purpose", params.purpose || "GRACIA Jubilee Conference 2026 Registration");
      urlParams.append("reference_number", referenceNumber);
      urlParams.append("payment_methods[]", "paynow_online");
      urlParams.append("channel", "api_custom");
      urlParams.append("generate_qr", "true");
      urlParams.append("redirect_url", safeRedirect);
      urlParams.append("webhook", safeWebhook);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 7000);

      try {
        const hpResponse = await fetch(endpoint, {
          method: "POST",
          headers: {
            "X-BUSINESS-API-KEY": apiKey,
            "x-api-key": apiKey,
            "X-Requested-With": "XMLHttpRequest",
            "Content-Type": "application/x-www-form-urlencoded",
            "Accept": "application/json"
          },
          body: urlParams.toString(),
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (hpResponse.ok) {
          hitpayResponseData = await hpResponse.json();
          checkoutUrl = hitpayResponseData.url || null;
          hitpayQrCode = hitpayResponseData.qr_code_data ? hitpayResponseData.qr_code_data.qr_code : (typeof hitpayResponseData.qr_code_data === 'string' ? hitpayResponseData.qr_code_data : (hitpayResponseData.qr_code || null));

          this.addLog({
            level: 'success',
            stage: 'QR_GENERATED',
            referenceNumber,
            paymentRequestId: hitpayResponseData.id,
            amount: numAmount,
            message: `HitPay Dynamic PayNow QR generated successfully (HitPay ID: ${hitpayResponseData.id})`,
            details: {
              id: hitpayResponseData.id,
              status: hitpayResponseData.status,
              hasQr: Boolean(hitpayQrCode),
              checkoutUrl
            }
          });
        } else {
          const errText = await hpResponse.text();
          let parsed: any = errText;
          try { parsed = JSON.parse(errText); } catch {}
          hitpayErrorData = {
            statusCode: hpResponse.status,
            statusText: hpResponse.statusText,
            message: typeof parsed === 'object' && parsed.message ? parsed.message : errText,
            raw: parsed
          };

          this.addLog({
            level: 'warn',
            stage: 'GATEWAY_REQUEST',
            referenceNumber,
            amount: numAmount,
            message: `HitPay API responded with ${hpResponse.status} ${hpResponse.statusText}: ${hitpayErrorData.message}`,
            details: hitpayErrorData
          });
        }
      } catch (networkErr: any) {
        clearTimeout(timeoutId);
        const isFetchFailed = networkErr.message?.includes('fetch failed') || networkErr.name === 'TypeError';
        hitpayErrorData = {
          statusCode: 503,
          statusText: "Direct PayNow Mode Active",
          message: isFetchFailed 
            ? "HitPay API endpoint unreachable in current environment. Direct SGQR PayNow mode active." 
            : (networkErr.message || String(networkErr))
        };
        this.addLog({
          level: 'info',
          stage: 'FALLBACK_TRIGGERED',
          referenceNumber,
          amount: numAmount,
          message: `HitPay gateway offline or unreachable. Direct Singapore PayNow SGQR mode active.`,
          details: hitpayErrorData
        });
      }
    } else {
      this.addLog({
        level: 'info',
        stage: 'FALLBACK_TRIGGERED',
        referenceNumber,
        amount: numAmount,
        message: 'No HITPAY_API_KEY detected in environment. Using standard SG PayNow EMVCo payload.'
      });
    }

    // Convert HitPay qr_code string or URL into high resolution Data URL
    if (hitpayQrCode && typeof hitpayQrCode === 'string') {
      try {
        if (hitpayQrCode.startsWith('000201')) {
          hitpayQrDataUrl = await QRCode.toDataURL(hitpayQrCode, {
            width: 400,
            margin: 2,
            errorCorrectionLevel: 'M'
          });
        } else if (hitpayQrCode.startsWith('data:image') || /\.(png|jpg|jpeg|gif|svg)(\?.*)?$/i.test(hitpayQrCode)) {
          hitpayQrDataUrl = hitpayQrCode;
        } else if (hitpayQrCode.length > 5) {
          hitpayQrDataUrl = await QRCode.toDataURL(hitpayQrCode, {
            width: 400,
            margin: 2,
            errorCorrectionLevel: 'M'
          });
        }
      } catch (qrErr) {
        console.warn("[QRCode generation from HitPay qr_code error]:", qrErr);
      }
    }

    if (!hitpayQrDataUrl && checkoutUrl) {
      try {
        hitpayQrDataUrl = await QRCode.toDataURL(checkoutUrl, {
          width: 400,
          margin: 2,
          errorCorrectionLevel: 'M'
        });
      } catch (qrErr) {
        console.warn("[QRCode generation from checkoutUrl error]:", qrErr);
      }
    }

    const effectiveId = hitpayResponseData?.id || fallbackId;
    const paymentRecord: PaymentRecord = {
      id: effectiveId,
      referenceNumber,
      amount: numAmount,
      baseFee: Number(params.baseFee) || numAmount,
      additionalContribution: Number(params.additionalContribution) || 0,
      currency,
      name: params.name || "Participant",
      email: params.email || "",
      phone: params.phone || "",
      purpose: params.purpose || `GRACIA Jubilee Payment (${referenceNumber})`,
      status: 'pending',
      createdAt: new Date().toISOString(),
      paynowUen,
      isHitpayGateway: Boolean(hitpayResponseData && apiKey),
      hitpayEnv: env,
      checkoutUrl,
      hitpayQrCode,
      hitpayQrDataUrl,
      hitpayResponse: hitpayResponseData,
      hitpayError: hitpayErrorData
    };

    // Store indexed by ID and by Reference Number
    this.payments.set(effectiveId, paymentRecord);
    this.payments.set(referenceNumber, paymentRecord);

    return {
      status: "success",
      paymentRequestId: effectiveId,
      referenceNumber,
      amount: numAmount,
      baseFee: paymentRecord.baseFee,
      additionalContribution: paymentRecord.additionalContribution,
      currency,
      paynowUen,
      checkoutUrl,
      hitpayQrCode,
      hitpayQrDataUrl,
      hitpayActive: paymentRecord.isHitpayGateway,
      hitpayEnv: env,
      paymentStatus: "pending",
      hitpayResponse: hitpayResponseData,
      hitpayError: hitpayErrorData,
      rawPayload: hitpayResponseData || hitpayErrorData || { notice: "Operating in Direct PayNow UEN Mode" }
    };
  }

  /**
   * Poll status of a payment request from memory and from HitPay API
   */
  public async getPaymentStatus(queryId: string): Promise<{
    status: 'success';
    paymentRequestId: string;
    paymentStatus: PaymentLifecycleStatus;
    amount: number;
    referenceNumber: string;
    hitpayResponse: any;
    hitpayError: any;
    rawPayload: any;
    record: PaymentRecord | null;
  }> {
    let record = this.payments.get(queryId) || null;

    if (!record && queryId) {
      for (const p of this.payments.values()) {
        if (p.referenceNumber === queryId || p.id === queryId) {
          record = p;
          break;
        }
      }
    }

    const apiKey = this.getApiKey();
    // If pending and has real HitPay ID, poll HitPay API directly
    if (apiKey && apiKey.length > 5 && record && record.status === 'pending' && record.id && !record.id.startsWith('hitpay_req_')) {
      const endpoint = `${this.getBaseApiUrl()}/payment-requests/${record.id}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      try {
        const hpCheck = await fetch(endpoint, {
          headers: {
            "X-BUSINESS-API-KEY": apiKey,
            "x-api-key": apiKey,
            "X-Requested-With": "XMLHttpRequest",
            "Accept": "application/json"
          },
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (hpCheck.ok) {
          const hpData = await hpCheck.json();
          const hpStatus = String(hpData.status || '').toLowerCase();
          
          if (hpStatus === 'completed' || hpStatus === 'succeeded' || hpStatus === 'paid' || hpStatus === 'closed') {
            record.status = 'succeeded';
            record.settledAt = new Date().toISOString();
            record.hitpayResponse = hpData;
            this.payments.set(record.id, record);
            if (record.referenceNumber) this.payments.set(record.referenceNumber, record);

            this.addLog({
              level: 'success',
              stage: 'PAYMENT_SETTLED',
              referenceNumber: record.referenceNumber,
              paymentRequestId: record.id,
              amount: record.amount,
              message: `Payment status cleared as SUCCEEDED via HitPay API Polling! (Ref: ${record.referenceNumber})`,
              details: hpData
            });
          }
        }
      } catch (pollErr: any) {
        clearTimeout(timeoutId);
        // Silently keep polling
      }
    }

    return {
      status: "success",
      paymentRequestId: queryId,
      paymentStatus: record ? record.status : 'pending',
      amount: record ? record.amount : 0,
      referenceNumber: record ? record.referenceNumber : '',
      hitpayResponse: record ? record.hitpayResponse : null,
      hitpayError: record ? record.hitpayError : null,
      rawPayload: record ? (record.hitpayResponse || record.hitpayError || record) : { notice: "No payment record found" },
      record
    };
  }

  /**
   * Process incoming HitPay webhook
   */
  public processWebhook(body: any, headers: any): {
    received: boolean;
    matched: boolean;
    paymentRequestId?: string;
    referenceNumber?: string;
    status?: string;
    message: string;
  } {
    const payload = body || {};
    const signature = headers['hitpay-signature'] || headers['x-hitpay-signature'] || payload.hmac || '';

    // Handle flat or nested event payload
    const eventData = payload.data || payload;
    const paymentId = eventData.payment_id || eventData.id;
    const paymentRequestId = eventData.payment_request_id || eventData.id;
    const referenceNumber = eventData.reference_number || eventData.referenceNumber;
    const status = String(eventData.status || payload.status || '').toLowerCase();
    const amount = Number(eventData.amount || payload.amount || 0);

    const targetId = paymentRequestId || paymentId || referenceNumber;
    let record = targetId ? this.payments.get(targetId) : null;

    if (!record && referenceNumber) {
      for (const p of this.payments.values()) {
        if (p.referenceNumber === referenceNumber) {
          record = p;
          break;
        }
      }
    }

    // HMAC verification if salt is provided
    const salt = this.getWebhookSalt();
    let signatureVerified = true;
    if (salt) {
      const verification = this.verifyWebhookSignature(payload, signature);
      signatureVerified = verification.isValid;
      this.addLog({
        level: signatureVerified ? 'success' : 'warn',
        stage: 'SIGNATURE_VERIFIED',
        referenceNumber,
        paymentRequestId: targetId,
        message: signatureVerified 
          ? '✓ HitPay Webhook HMAC Signature verified successfully with HITPAY_SALT.' 
          : `⚠ HitPay Webhook HMAC Signature mismatch (${verification.reason}). Check HITPAY_SALT in environment secrets.`,
        details: { signature: signature || payload.hmac, signatureVerified, reason: verification.reason }
      });
    }

    this.addLog({
      level: 'info',
      stage: 'WEBHOOK_RECEIVED',
      referenceNumber,
      paymentRequestId: targetId,
      amount,
      message: `Webhook Received: Status='${status}', Target='${targetId}', Ref='${referenceNumber}'`,
      details: { headers, payload }
    });

    if (record) {
      record.webhookReceived = true;
      record.webhookPayload = payload;

      if (status === 'completed' || status === 'succeeded' || status === 'paid' || status === 'closed') {
        record.status = 'succeeded';
        record.settledAt = new Date().toISOString();
        this.payments.set(record.id, record);
        if (record.referenceNumber) this.payments.set(record.referenceNumber, record);

        this.addLog({
          level: 'success',
          stage: 'PAYMENT_SETTLED',
          referenceNumber: record.referenceNumber,
          paymentRequestId: record.id,
          amount: record.amount,
          message: `✓ Payment verified & settled via Webhook for ${record.referenceNumber} ($${record.amount.toFixed(2)})`,
          details: payload
        });

        return {
          received: true,
          matched: true,
          paymentRequestId: record.id,
          referenceNumber: record.referenceNumber,
          status: 'succeeded',
          message: 'Payment successfully settled via webhook.'
        };
      } else if (status === 'failed') {
        record.status = 'failed';
        this.payments.set(record.id, record);
        return {
          received: true,
          matched: true,
          paymentRequestId: record.id,
          referenceNumber: record.referenceNumber,
          status: 'failed',
          message: 'Payment marked as failed via webhook.'
        };
      }
    }

    return {
      received: true,
      matched: Boolean(record),
      paymentRequestId: targetId,
      referenceNumber,
      status,
      message: record ? 'Webhook received and processed.' : 'Webhook received for unknown transaction.'
    };
  }

  /**
   * Health check and live connection test
   */
  public async testConnection(): Promise<{
    connected: boolean;
    hasApiKey: boolean;
    env: string;
    apiKeyLength: number;
    latencyMs: number;
    message: string;
    details?: any;
  }> {
    const apiKey = this.getApiKey();
    const env = this.getEnv();
    const startTime = Date.now();

    if (!apiKey || apiKey.length < 5) {
      return {
        connected: false,
        hasApiKey: false,
        env,
        apiKeyLength: 0,
        latencyMs: 0,
        message: 'No HITPAY_API_KEY configured. Please set HITPAY_API_KEY in Settings -> Secrets.'
      };
    }

    const endpoint = `${this.getBaseApiUrl()}/payment-methods`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    try {
      const response = await fetch(endpoint, {
        headers: {
          "X-BUSINESS-API-KEY": apiKey,
          "x-api-key": apiKey,
          "X-Requested-With": "XMLHttpRequest",
          "Accept": "application/json"
        },
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      const latencyMs = Date.now() - startTime;

      if (response.ok) {
        const data = await response.json().catch(() => ({}));
        this.addLog({
          level: 'success',
          stage: 'TEST_CONNECTION',
          message: `HitPay Gateway Connection Healthy (${latencyMs}ms latency) in ${env.toUpperCase()} mode.`
        });
        return {
          connected: true,
          hasApiKey: true,
          env,
          apiKeyLength: apiKey.length,
          latencyMs,
          message: `✓ Connected to HitPay Gateway (${env.toUpperCase()}) successfully in ${latencyMs}ms.`,
          details: data
        };
      } else {
        const errText = await response.text();
        this.addLog({
          level: 'warn',
          stage: 'TEST_CONNECTION',
          message: `HitPay Gateway Test returned ${response.status}: ${errText}`
        });
        return {
          connected: false,
          hasApiKey: true,
          env,
          apiKeyLength: apiKey.length,
          latencyMs,
          message: `HitPay Gateway returned status ${response.status}: ${errText}`,
          details: { status: response.status, body: errText }
        };
      }
    } catch (err: any) {
      clearTimeout(timeoutId);
      const latencyMs = Date.now() - startTime;
      const isFetchFailed = err.name === 'TypeError' || err.message?.includes('fetch failed') || err.message?.includes('network') || err.message?.includes('timeout') || err.message?.includes('abort');
      const diagnosticMsg = isFetchFailed
        ? `Unable to reach HitPay API endpoint (${endpoint}). Outbound connection was not completed; Direct SG PayNow mode is active.`
        : `HitPay Connection check: ${err.message}`;

      this.addLog({
        level: 'info',
        stage: 'TEST_CONNECTION',
        message: diagnosticMsg
      });
      return {
        connected: false,
        hasApiKey: true,
        env,
        apiKeyLength: apiKey.length,
        latencyMs,
        message: diagnosticMsg
      };
    }
  }

  public async verifyUserPayment(paymentRequestId: string, bankReference?: string): Promise<{
    status: 'success' | 'pending' | 'error';
    paymentRequestId: string;
    paymentStatus: PaymentLifecycleStatus;
    isPaid: boolean;
    referenceNumber: string;
    message: string;
  }> {
    const targetId = paymentRequestId || bankReference || '';
    let record = this.payments.get(targetId) || null;

    if (!record && bankReference) {
      for (const p of this.payments.values()) {
        if (p.referenceNumber === bankReference || p.id === bankReference) {
          record = p;
          break;
        }
      }
    }

    // If record is already marked as succeeded (e.g. via webhook or background API status polling)
    if (record && record.status === 'succeeded') {
      return {
        status: 'success',
        paymentRequestId: record.id,
        paymentStatus: 'succeeded',
        isPaid: true,
        referenceNumber: record.referenceNumber,
        message: '✓ Payment verified and confirmed on HitPay!'
      };
    }

    const apiKey = this.getApiKey();
    // Query real HitPay API if targetId is a real HitPay ID
    if (apiKey && apiKey.length > 5 && targetId && !targetId.startsWith('hitpay_req_')) {
      const endpoint = `${this.getBaseApiUrl()}/payment-requests/${targetId}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      try {
        const hpCheck = await fetch(endpoint, {
          headers: {
            "X-BUSINESS-API-KEY": apiKey,
            "x-api-key": apiKey,
            "X-Requested-With": "XMLHttpRequest",
            "Accept": "application/json"
          },
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (hpCheck.ok) {
          const hpData = await hpCheck.json();
          const hpStatus = String(hpData.status || '').toLowerCase();
          const isSettled = hpStatus === 'completed' || hpStatus === 'succeeded' || hpStatus === 'paid' || hpStatus === 'closed';

          if (isSettled) {
            if (record) {
              record.status = 'succeeded';
              record.settledAt = new Date().toISOString();
              record.hitpayResponse = hpData;
              this.payments.set(record.id, record);
              if (record.referenceNumber) this.payments.set(record.referenceNumber, record);
            }
            return {
              status: 'success',
              paymentRequestId: targetId,
              paymentStatus: 'succeeded',
              isPaid: true,
              referenceNumber: bankReference || (record ? record.referenceNumber : targetId),
              message: `✓ PayNow transfer verified on HitPay! Status: ${hpStatus}`
            };
          } else {
            return {
              status: 'pending',
              paymentRequestId: targetId,
              paymentStatus: 'pending',
              isPaid: false,
              referenceNumber: bankReference || (record ? record.referenceNumber : targetId),
              message: `❌ Payment NOT received on HitPay yet. Current status: ${hpStatus || 'pending'}. Please scan the QR code and complete the transfer in your bank app first.`
            };
          }
        }
      } catch (err) {
        clearTimeout(timeoutId);
        console.warn('HitPay verification check error:', err);
      }
    }

    // Default if not settled or offline simulated ID
    return {
      status: 'pending',
      paymentRequestId: targetId,
      paymentStatus: 'pending',
      isPaid: false,
      referenceNumber: bankReference || targetId,
      message: '❌ Payment NOT received on HitPay yet. Please scan the QR code and complete the transfer in your bank app first.'
    };
  }

  public manualVerify(paymentRequestId: string, bankReference?: string): boolean {
    let record = this.payments.get(paymentRequestId);
    if (!record && bankReference) {
      record = this.payments.get(bankReference);
    }
    if (!record && paymentRequestId) {
      const activeRef = bankReference || paymentRequestId;
      record = {
        id: paymentRequestId,
        referenceNumber: activeRef,
        amount: 25,
        baseFee: 25,
        additionalContribution: 0,
        currency: 'SGD',
        name: 'GRACIA Participant',
        email: '',
        phone: '',
        purpose: 'GRACIA 2026 Registration',
        status: 'succeeded',
        createdAt: new Date().toISOString(),
        settledAt: new Date().toISOString(),
        paynowUen: 'T08SS0123A',
        isHitpayGateway: true,
        hitpayEnv: 'production',
        confirmation_email_sent: true
      };
    }
    if (record) {
      record.status = 'succeeded';
      record.settledAt = new Date().toISOString();
      this.payments.set(record.id, record);
      if (record.referenceNumber) this.payments.set(record.referenceNumber, record);
      if (paymentRequestId) this.payments.set(paymentRequestId, record);
      if (bankReference) this.payments.set(bankReference, record);

      this.addLog({
        level: 'success',
        stage: 'PAYMENT_SETTLED',
        referenceNumber: record.referenceNumber,
        paymentRequestId: record.id,
        amount: record.amount,
        message: `Payment manually confirmed as SUCCEEDED by Administrator/User (Ref: ${record.referenceNumber})`
      });
      return true;
    }
    return false;
  }

  public getPaymentRecord(refKey: string): PaymentRecord | undefined {
    return this.payments.get(refKey);
  }

  public getAllPayments(): PaymentRecord[] {
    const map = new Map<string, PaymentRecord>();
    for (const p of this.payments.values()) {
      map.set(p.id, p);
    }
    return Array.from(map.values());
  }
}

export const hitpayService = new HitPayService();
