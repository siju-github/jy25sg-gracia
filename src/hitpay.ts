export type HitPayCurrency =
  | 'SGD'
  | 'USD'
  | 'MYR'
  | 'EUR'
  | 'GBP'
  | 'AUD'
  | 'HKD'
  | 'JPY'
  | 'CAD'
  | 'PHP'
  | 'IDR'
  | 'THB'
  | 'VND'
  | 'NZD'
  | 'INR'
  | 'BND';

export type HitPayPaymentMethod =
  | 'card'
  | 'paynow_online'
  | 'apple_pay'
  | 'google_pay'
  | 'grabpay'
  | 'wechatpay'
  | 'alipay'
  | 'shopeepay'
  | 'zip';

export type HitPayPaymentStatus =
  | 'pending'
  | 'completed'
  | 'failed'
  | 'canceled'
  | 'expired';

export interface CreatePaymentSessionPayload {
  amount: number | string;
  currency: string;
  payment_methods?: HitPayPaymentMethod[];
  email?: string;
  name?: string;
  phone?: string;
  purpose?: string;
  reference_number?: string;
  redirect_url?: string;
  webhook?: string;
  channel?: string;
  expires_after?: string;
  send_email?: boolean;
  send_sms?: boolean;
}

export interface HitPaySessionResponse {
  id: string;
  url: string;
  checkoutUrl?: string;
  status: HitPayPaymentStatus;
  amount: string;
  currency: string;
  reference_number?: string;
  payment_methods?: string[];
  created_at?: string;
  expiry_date?: string;
  redirect_url?: string;
  webhook?: string;
  is_mock?: boolean;
  raw_response?: Record<string, unknown>;
}

export interface HitPayPaymentRecord {
  id: string;
  payment_request_id?: string;
  payment_id?: string;
  status: HitPayPaymentStatus;
  amount: string | number;
  currency: string;
  payment_type?: string;
  buyer_name?: string;
  buyer_email?: string;
  buyer_phone?: string;
  reference_number?: string;
  created_at: string;
  updated_at?: string;
  fees?: string;
  net_amount?: string;
  receipt_url?: string;
  failure_reason?: string;
}

export interface HitPayStatusResponse {
  id: string;
  status: HitPayPaymentStatus;
  amount: string;
  currency: string;
  reference_number?: string;
  isPaid?: boolean;
  is_paid?: boolean;
  payments?: HitPayPaymentRecord[];
  created_at?: string;
  updated_at?: string;
  is_mock?: boolean;
  raw_response?: Record<string, unknown>;
}

export interface HitPayWebhookEvent {
  id: string;
  payment_id?: string;
  payment_request_id: string;
  reference_number?: string;
  status: HitPayPaymentStatus;
  amount: string;
  currency: string;
  hmac_verified?: boolean;
  received_at: string;
  payload: Record<string, unknown>;
}

export interface HitPayConfigStatus {
  hasApiKey: boolean;
  apiKeyMasked: string;
  isSandbox: boolean;
  apiEndpoint: string;
  appUrl: string;
  saltConfigured: boolean;
}

export type CheckoutPresentationMode = 'popup' | 'modal' | 'redirect';

export interface HitPayInitiateOptions {
  amount: number | string;
  currency?: string;
  paymentMethods?: HitPayPaymentMethod[];
  email?: string;
  name?: string;
  phone?: string;
  purpose?: string;
  referenceNumber?: string;
  presentationMode?: CheckoutPresentationMode;
  onSuccess?: (result: HitPayStatusResponse) => void;
  onFailure?: (error: { status: HitPayPaymentStatus; message: string; details?: unknown }) => void;
  onCancel?: () => void;
}

export interface HitPayApiLog {
  id: string;
  timestamp: string;
  method: 'GET' | 'POST' | 'WEBHOOK';
  endpoint: string;
  status: number;
  durationMs: number;
  requestBody?: unknown;
  responseBody?: unknown;
  isMock?: boolean;
}
