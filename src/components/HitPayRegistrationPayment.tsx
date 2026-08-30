import React, { useState, useEffect, useCallback } from 'react';
import QRCode from 'qrcode';
import { 
  Loader2, 
  CheckCircle2, 
  ExternalLink, 
  RefreshCw, 
  AlertCircle, 
  Copy, 
  Check, 
  Building2,
  QrCode,
  ShieldCheck,
  ArrowRight,
  Sparkles
} from 'lucide-react';
import { useHitPay } from '../hooks/useHitPay';
import { PaymentProcessingModal } from '../PaymentProcessingModal';
import { PaymentSuccessCard } from '../PaymentSuccessCard';
import { PaymentFailureCard } from '../PaymentFailureCard';
import type { HitPayStatusResponse } from '../types/hitpay';
import { dispatchConfirmationEmails } from '../lib/emailService';

export interface HitPayRegistrationPaymentProps {
  amount: number;
  referenceNumber: string;
  userName?: string;
  userEmail?: string;
  userPhone?: string;
  purpose?: string;
  initialCheckoutUrl?: string;
  initialPaymentRequestId?: string;
  additionalAttendees?: any[];
  onPaymentCompleted: (details: {
    paymentRequestId: string;
    amount: number;
    referenceNumber: string;
    hitpayChargeId?: string;
    hitpayResponse?: any;
  }) => void;
  onSkipOrBypass?: () => void;
  className?: string;
}

export const HitPayRegistrationPayment: React.FC<HitPayRegistrationPaymentProps> = ({
  amount,
  referenceNumber,
  userName = '',
  userEmail = '',
  userPhone = '',
  purpose = '',
  initialCheckoutUrl,
  initialPaymentRequestId,
  additionalAttendees = [],
  onPaymentCompleted,
  onSkipOrBypass,
  className = ''
}) => {
  const {
    status: hitpayStatus,
    session,
    paymentResult,
    error: hitpayError,
    isLoading: isHitpayLoading,
    isPolling,
    modalUrl,
    popupActive,
    initiatePayment,
    verifyPayment,
    cancelPayment,
    closeModal,
    resetState
  } = useHitPay();

  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
  const [copiedRef, setCopiedRef] = useState<boolean>(false);
  const [verifyNotice, setVerifyNotice] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [isEmailDispatched, setIsEmailDispatched] = useState<boolean>(false);

  // Check if payment is already completed locally
  const [isLocalCompleted, setIsLocalCompleted] = useState<boolean>(() => {
    if (typeof window !== 'undefined' && referenceNumber) {
      try {
        return localStorage.getItem(`payment_status_${referenceNumber}`) === 'completed' ||
               localStorage.getItem(`gracia_paid_${referenceNumber}`) === 'true';
      } catch {}
    }
    return false;
  });

  // Generate QR code data URL whenever session or initial checkout URL changes
  useEffect(() => {
    const activeUrl = session?.url || session?.checkoutUrl || initialCheckoutUrl;
    if (activeUrl) {
      QRCode.toDataURL(activeUrl, { margin: 2, width: 400 })
        .then(url => setQrCodeDataUrl(url))
        .catch(err => console.warn('[HitPay] QR code generation error:', err));
    }
  }, [session, initialCheckoutUrl]);

  // Handle PayNow payment initiation
  const handleInitiatePayNow = useCallback(async () => {
    try {
      await initiatePayment({
        amount,
        referenceNumber,
        email: userEmail || 'guest@gracia.org',
        name: userName || 'GRACIA Participant',
        phone: userPhone,
        purpose: purpose || `GRACIA Jubilee Registration Love Offering (${userName || referenceNumber})`
      });
    } catch (err) {
      console.error('[HitPayRegistrationPayment] Failed to initiate payment:', err);
    }
  }, [amount, referenceNumber, userEmail, userName, userPhone, purpose, initiatePayment]);

  // Handle Manual Status Verification Trigger
  const handleManualCheckStatus = useCallback(async () => {
    setIsVerifying(true);
    setVerifyNotice('Verifying payment status directly with HitPay Gateway...');
    try {
      const activeId = session?.id || initialPaymentRequestId || referenceNumber;
      const res = await verifyPayment(activeId);
      if (res.isPaid || res.status === 'completed') {
        setIsLocalCompleted(true);
        setVerifyNotice('Payment verified successfully!');
      } else {
        setVerifyNotice('Payment not yet received. Please scan the PayNow QR code and complete transfer in your bank app.');
        setTimeout(() => setVerifyNotice(null), 5000);
      }
    } catch (err: any) {
      console.warn('[HitPayRegistrationPayment] Verification check error:', err);
      setVerifyNotice('Verification attempt completed. Pending bank confirmation.');
      setTimeout(() => setVerifyNotice(null), 5000);
    } finally {
      setIsVerifying(false);
    }
  }, [session, initialPaymentRequestId, referenceNumber, verifyPayment]);

  // Trigger Email Dispatch & Advance to Step 3
  const handleProceedToStep3 = useCallback(async () => {
    const activeRef = referenceNumber || session?.id || initialPaymentRequestId || 'GRACIA-2026';
    const emailSentKey = `gracia_email_sent_${activeRef}`;
    const isAlreadySent = isEmailDispatched || 
      (typeof window !== 'undefined' && localStorage.getItem(emailSentKey) === 'true');
    
    // 1. Dispatch confirmation email via /api/send-email endpoint with attendee passes (once)
    if (!isAlreadySent) {
      try {
        await dispatchConfirmationEmails(activeRef, userEmail, additionalAttendees);
        setIsEmailDispatched(true);
        try {
          localStorage.setItem(emailSentKey, 'true');
        } catch (e) {}
      } catch (err) {
        console.warn('[HitPayRegistrationPayment] /api/send-email dispatch error:', err);
      }
    } else {
      console.log(`[HitPayRegistrationPayment]: Email already dispatched for ${activeRef}, skipping duplicate trigger.`);
    }

    // 2. Save completion state in localStorage
    try {
      localStorage.setItem(`gracia_step_${activeRef}`, '3');
      localStorage.setItem(`gracia_payment_status_${activeRef}`, 'completed');
      localStorage.setItem(`gracia_paid_${activeRef}`, 'true');
      localStorage.setItem(`step_${activeRef}`, '3');
      localStorage.setItem(`payment_status_${activeRef}`, 'completed');
      localStorage.setItem('registration_step', '3');
      localStorage.setItem('payment_status', 'completed');
    } catch (err) {
      console.warn('[HitPayRegistrationPayment] Local storage save error:', err);
    }

    // 3. Notify parent component to show Step 3 View Digital Passes
    const extractedChargeId = (paymentResult as any)?.hitpayChargeId || (paymentResult as any)?.payment_id || (paymentResult as any)?.charge_id || session?.id || initialPaymentRequestId || activeRef;
    onPaymentCompleted({
      paymentRequestId: session?.id || initialPaymentRequestId || activeRef,
      amount,
      referenceNumber: activeRef,
      hitpayChargeId: extractedChargeId,
      hitpayResponse: paymentResult || session
    });
  }, [referenceNumber, session, initialPaymentRequestId, isEmailDispatched, userEmail, additionalAttendees, amount, onPaymentCompleted]);

  const copyRef = () => {
    navigator.clipboard.writeText(referenceNumber);
    setCopiedRef(true);
    setTimeout(() => setCopiedRef(false), 2000);
  };

  // ----------------------------------------------------
  // VIEW 1: PAYMENT SUCCESSFUL CONFIRMATION
  // ----------------------------------------------------
  if (hitpayStatus === 'completed' || isLocalCompleted || paymentResult?.isPaid) {
    const successResult: HitPayStatusResponse = paymentResult || {
      id: session?.id || initialPaymentRequestId || referenceNumber,
      amount: String(amount.toFixed(2)),
      currency: 'SGD',
      status: 'completed',
      reference_number: referenceNumber,
      updated_at: new Date().toISOString(),
      payments: [
        {
          id: `pay_${Date.now()}`,
          payment_type: 'paynow_online',
          status: 'completed',
          amount: amount,
          currency: 'SGD',
          created_at: new Date().toISOString()
        }
      ]
    };

    return (
      <div className={`space-y-6 ${className}`}>
        <div className="bg-[#130720] border-2 border-emerald-500/50 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
          <div className="flex flex-col items-center justify-center text-center space-y-3">
            <div className="w-16 h-16 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center text-3xl font-bold shadow-lg shadow-emerald-500/20 border-2 border-emerald-400">
              <CheckCircle2 className="w-10 h-10 stroke-[2.5]" />
            </div>
            <div className="space-y-1">
              <span className="inline-block px-3.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-black uppercase tracking-wider border border-emerald-400/40">
                Payment Completed &amp; Verified
              </span>
              <h2 className="text-2xl sm:text-3xl font-black text-white uppercase tracking-wide">
                PayNow Payment Successful!
              </h2>
              <p className="text-xs font-mono text-amber-300 font-bold">
                Reference ID: {referenceNumber}
              </p>
            </div>
            <p className="text-slate-300 text-sm leading-relaxed max-w-md">
              Your payment of <strong className="text-white font-mono font-bold">${amount.toFixed(2)} SGD</strong> has been successfully processed and verified by HitPay Gateway.
            </p>
          </div>

          {/* Breakdown Card */}
          <div className="bg-[#1C0D2A]/90 rounded-2xl p-4 border border-purple-500/30 divide-y divide-purple-500/20">
            <div className="flex justify-between items-center py-2 text-xs">
              <span className="text-gray-400">Amount Paid:</span>
              <span className="text-amber-300 font-mono font-bold text-sm">${amount.toFixed(2)} SGD</span>
            </div>
            <div className="flex justify-between items-center py-2 text-xs">
              <span className="text-gray-400">Payment Gateway:</span>
              <span className="text-emerald-400 font-bold uppercase flex items-center gap-1">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>HitPay Corporate PayNow</span>
              </span>
            </div>
            <div className="flex justify-between items-center py-2 text-xs">
              <span className="text-gray-400">Primary Contact:</span>
              <span className="text-white font-semibold">{userName || 'Registrant'} ({userEmail})</span>
            </div>
          </div>

          {/* ACTIVE PRIMARY BUTTON: Proceed to Step 3 */}
          <div className="pt-2">
            <button
              type="button"
              id="proceed-step-3-btn"
              onClick={handleProceedToStep3}
              className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-500 hover:opacity-90 text-slate-950 font-black text-sm tracking-wider uppercase flex items-center justify-center gap-3 shadow-2xl transition-all cursor-pointer hover:scale-[1.01] active:scale-[0.99]"
            >
              <span>Proceed to Step 3: View Digital Passes</span>
              <ArrowRight className="w-5 h-5 stroke-[3]" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ----------------------------------------------------
  // VIEW 2: PAYMENT FAILED / CANCELLED
  // ----------------------------------------------------
  if (hitpayStatus === 'failed' || hitpayStatus === 'cancelled') {
    return (
      <div className={`space-y-6 ${className}`}>
        <PaymentFailureCard
          status={hitpayStatus}
          errorMessage={hitpayError || 'Payment transaction was declined or popup window was closed prior to bank authorization.'}
          paymentResult={paymentResult}
          onRetry={() => {
            resetState();
            handleInitiatePayNow();
          }}
        />
      </div>
    );
  }

  // ----------------------------------------------------
  // VIEW 3: ACTIVE CHECKOUT / AWAITING PAYMENT / IDLE
  // ----------------------------------------------------
  return (
    <div className={`bg-[#130720]/95 rounded-3xl p-6 sm:p-8 border-2 border-amber-500/40 shadow-2xl space-y-6 ${className}`}>
      {/* Modal Popup Handler */}
      {(popupActive || modalUrl) && (
        <PaymentProcessingModal
          session={session}
          popupActive={popupActive}
          modalUrl={modalUrl}
          isPolling={isPolling}
          onVerifyNow={handleManualCheckStatus}
          onCancel={cancelPayment}
          onCloseModal={closeModal}
        />
      )}

      {/* Header Info Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-amber-500/20">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-400/50 flex items-center justify-center text-amber-300 font-bold shadow-inner">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-white text-lg flex items-center gap-2">
              <span>PayNow Love Offering Checkout</span>
              <span className="text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-500/50 px-2 py-0.5 rounded-full uppercase font-mono">
                HitPay Gateway
              </span>
            </h3>
            <p className="text-xs text-amber-200/80">Corporate UEN • Bank-Validated PayNow Online</p>
          </div>
        </div>
        <div className="text-left sm:text-right">
          <span className="text-xs text-amber-300 block font-medium">Love Offering Amount</span>
          <span className="text-2xl font-black font-mono text-amber-400">${amount.toFixed(2)} SGD</span>
        </div>
      </div>

      {/* Reference ID Banner */}
      <div className="flex items-center justify-between p-3.5 bg-[#1C0D2A] rounded-xl border border-purple-500/30">
        <span className="text-xs text-gray-300 font-semibold">Registration Reference Number:</span>
        <div className="flex items-center space-x-2">
          <span className="font-mono text-xs font-black text-amber-300">{referenceNumber}</span>
          <button
            type="button"
            onClick={copyRef}
            className="p-1 hover:bg-purple-900/60 rounded text-amber-400 transition cursor-pointer"
            title="Copy Reference Number"
          >
            {copiedRef ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Main Action Area */}
      <div className="space-y-6 text-center">
        {isHitpayLoading ? (
          <div className="py-10 space-y-4">
            <Loader2 className="w-10 h-10 text-amber-400 animate-spin mx-auto" />
            <p className="text-sm font-bold text-white">Generating dynamic PayNow QR code session...</p>
            <p className="text-xs text-gray-400">Connecting securely to HitPay API Gateway</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* PayNow Action Container */}
            <div className="bg-[#1C0D2A]/90 p-6 sm:p-8 rounded-2xl border border-purple-500/30 space-y-5 max-w-md mx-auto">
              <div className="space-y-2">
                <div className="w-12 h-12 rounded-full bg-purple-500/20 text-amber-300 flex items-center justify-center mx-auto border border-purple-400/40">
                  <QrCode className="w-6 h-6" />
                </div>
                <h4 className="text-lg font-extrabold text-white">PayNow QR Checkout</h4>
                <p className="text-xs text-gray-300">
                  Click below to launch the PayNow QR code popup or scan with your banking app (DBS digibank, OCBC, UOB TMRW, PayLah!).
                </p>
              </div>

              {/* PRIMARY TRIGGER BUTTON: Pay with PayNow QR */}
              <button
                type="button"
                id="pay-with-paynow-btn"
                onClick={handleInitiatePayNow}
                disabled={isHitpayLoading}
                className="w-full py-4 px-6 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-600 hover:from-purple-500 hover:to-indigo-500 text-white font-extrabold text-sm tracking-wider uppercase flex items-center justify-center gap-2 shadow-xl hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer disabled:opacity-50"
              >
                <QrCode className="w-5 h-5 text-amber-300" />
                <span>Pay S${amount.toFixed(2)} with PayNow QR</span>
                <ArrowRight className="w-4 h-4 text-amber-300" />
              </button>
            </div>

            {/* Polling / Check Status Bar */}
            <div className="p-4 bg-[#1C0D2A] rounded-2xl border border-purple-500/30 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center space-x-2 text-xs text-amber-200 font-semibold">
                <RefreshCw className={`w-4 h-4 text-amber-400 shrink-0 ${isPolling || isVerifying ? 'animate-spin' : ''}`} />
                <span>{verifyNotice || (isPolling ? 'Awaiting payment confirmation (Auto-verifying live...)' : 'Click PayNow QR button above to pay, then verify status.')}</span>
              </div>
              <button
                type="button"
                id="check-payment-status-btn"
                onClick={handleManualCheckStatus}
                disabled={isVerifying}
                className="w-full sm:w-auto px-4 py-2.5 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 disabled:opacity-50 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl transition shadow-lg flex items-center justify-center gap-2 cursor-pointer shrink-0"
              >
                {isVerifying ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Verifying...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>I've Paid — Check Status</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default HitPayRegistrationPayment;
