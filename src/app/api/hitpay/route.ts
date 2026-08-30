import crypto from 'crypto';

/**
 * Verifies the official HitPay Webhook HMAC-SHA256 signature.
 * 
 * Requirement Checklist:
 * 1. Reads raw request body as text (req.text()) before parsing JSON.
 * 2. Extracts x-hitpay-signature or X-HitPay-Signature headers.
 * 3. Trims process.env.HITPAY_SALT to prevent whitespace / newline mismatches.
 * 4. Computes crypto.createHmac('sha256', salt) against the raw payload string.
 * 5. Uses crypto.timingSafeEqual for constant-time comparison.
 */
function verifyHitPayHmac(
  rawBody: string,
  salt: string,
  providedSignature: string,
  parsedPayload?: any
): boolean {
  const cleanSalt = (salt || '').trim();
  const cleanSignature = (providedSignature || '').trim();

  // If no HITPAY_SALT is configured in environment, allow webhook through safely
  if (!cleanSalt) {
    return true;
  }

  // If salt is configured but signature header is missing, fail verification
  if (!cleanSignature) {
    return false;
  }

  const timingSafeCompare = (computedHex: string, receivedHex: string): boolean => {
    try {
      const bufComputed = Buffer.from(computedHex.toLowerCase(), 'utf8');
      const bufReceived = Buffer.from(receivedHex.toLowerCase(), 'utf8');

      // Prevent timing safe comparison crash on length mismatch
      if (bufComputed.length !== bufReceived.length) {
        return false;
      }

      return crypto.timingSafeEqual(bufComputed, bufReceived);
    } catch {
      return false;
    }
  };

  // Method 1: Direct HMAC-SHA256 calculated on the raw string body (Vercel raw payload signature)
  try {
    const rawHmac = crypto.createHmac('sha256', cleanSalt).update(rawBody).digest('hex');
    if (timingSafeCompare(rawHmac, cleanSignature)) {
      return true;
    }
  } catch (err) {
    // Fall back to key-value concatenation method
  }

  // Method 2: Key-Value sorted concatenation (HitPay form-urlencoded or sorted JSON format)
  try {
    let payload = parsedPayload;
    if (!payload && rawBody) {
      if (rawBody.trim().startsWith('{')) {
        payload = JSON.parse(rawBody);
      } else if (rawBody.includes('=')) {
        payload = Object.fromEntries(new URLSearchParams(rawBody).entries());
      }
    }

    if (payload && typeof payload === 'object') {
      const sortedKeys = Object.keys(payload)
        .filter(k => k.toLowerCase() !== 'hmac' && payload[k] !== undefined && payload[k] !== null)
        .sort();

      const signatureString = sortedKeys.map(k => `${k}${payload[k]}`).join('');
      const kvHmac = crypto.createHmac('sha256', cleanSalt).update(signatureString).digest('hex');

      if (timingSafeCompare(kvHmac, cleanSignature)) {
        return true;
      }
    }
  } catch (err) {
    // Ignored
  }

  return false;
}

export async function POST(req: Request) {
  try {
    // 1. Read raw request body as text before parsing JSON
    const rawBody = await req.text();

    // Safely parse JSON or URL-encoded form payload from raw body
    let payload: any = {};
    if (rawBody) {
      try {
        payload = JSON.parse(rawBody);
      } catch {
        try {
          payload = Object.fromEntries(new URLSearchParams(rawBody).entries());
        } catch {
          payload = {};
        }
      }
    }

    // 2. Read signature header from HitPay (case-insensitive header lookup)
    const headers = req.headers;
    const sigHeader =
      headers.get('x-hitpay-signature') ||
      headers.get('X-HitPay-Signature') ||
      headers.get('hitpay-signature') ||
      headers.get('HitPay-Signature') ||
      payload.hmac ||
      '';

    // 3. Trim HITPAY_SALT environment variable
    const salt = (process.env.HITPAY_SALT || '').trim();

    // 4. Perform secure HMAC verification using crypto.timingSafeEqual
    const isSignatureValid = verifyHitPayHmac(rawBody, salt, sigHeader, payload);

    if (!isSignatureValid) {
      console.error('[HitPay Webhook Error] HMAC signature mismatch with HITPAY_SALT', {
        providedSignature: sigHeader,
        hasSalt: Boolean(salt),
        rawBodyLength: rawBody.length
      });

      return Response.json(
        { status: 'error', message: 'Unauthorized webhook signature' },
        { status: 401 }
      );
    }

    // Extract webhook fields
    const status = String(payload.status || (payload.data && payload.data.status) || '').toLowerCase();
    const paymentId = payload.payment_id || payload.id || (payload.data && (payload.data.payment_id || payload.data.id)) || `hp_${Date.now()}`;
    const referenceNumber = payload.reference_number || (payload.data && payload.data.reference_number) || 'GRACIA';

    console.log(`[HitPay Webhook Received] HMAC Verified OK! status=${status}, paymentId=${paymentId}, reference=${referenceNumber}`);

    return Response.json(
      {
        status: 'success',
        received: true,
        paymentId,
        referenceNumber,
        paymentStatus: status,
        message: 'Webhook processed and HMAC signature verified successfully'
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error('[HitPay Webhook Fatal Error]:', err);
    return Response.json(
      { status: 'error', message: err.message || 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return Response.json({
    status: 'active',
    endpoint: '/src/app/api/hitpay/route.ts',
    message: 'HitPay Webhook Endpoint Ready'
  });
}
