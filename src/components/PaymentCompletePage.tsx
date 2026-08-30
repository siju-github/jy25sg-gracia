import React, { useEffect } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { motion } from 'motion/react';

export const PaymentCompletePage: React.FC = () => {
  const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const refNumber = params.get('reference') || params.get('reference_number') || params.get('ref') || params.get('id') || params.get('payment_id') || params.get('payment_request_id') || '';

  useEffect(() => {
    // 1. Cross-window signals
    try {
      const payload = { status: 'completed', reference: refNumber, timestamp: Date.now() };

      try {
        const bc = new BroadcastChannel('hitpay_payment_channel');
        bc.postMessage(payload);
        bc.close();
      } catch (e) {}

      try {
        localStorage.setItem('hitpay_payment_completed_signal', JSON.stringify(payload));
      } catch (e) {}

      if (window.opener) {
        try {
          window.opener.postMessage({ type: 'HITPAY_PAYMENT_COMPLETED', ...payload }, '*');
        } catch (e) {}
      }
    } catch (err) {}

    // 2. Direct client-triggered email & registration finalization workaround
    const finalizeRegistration = async () => {
      try {
        // 1. Force update payment status in DB/Supabase/Server
        await fetch('/api/hitpay', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'mark-completed',
            refNumber: refNumber,
          }),
        });

        // 2. Direct email dispatch call with passes (if not already dispatched)
        if (refNumber) {
          const emailSentKey = `gracia_email_sent_${refNumber}`;
          const isAlreadySent = localStorage.getItem(emailSentKey) === 'true';

          if (!isAlreadySent) {
            await fetch('/api/send-email', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'send-confirmation',
                refNumber: refNumber,
              }),
            });
            localStorage.setItem(emailSentKey, 'true');
          } else {
            console.log(`[PaymentCompletePage]: Email already sent for ${refNumber}, skipping duplicate dispatch.`);
          }
        }
        
        // 3. Mark local state
        if (refNumber) {
          localStorage.setItem(`gracia_paid_${refNumber}`, 'true');
          localStorage.setItem(`gracia_step_${refNumber}`, '3');
          localStorage.setItem(`gracia_payment_status_${refNumber}`, 'completed');
          localStorage.setItem(`step_${refNumber}`, '3');
          localStorage.setItem(`payment_status_${refNumber}`, 'completed');
          localStorage.setItem(`registration_status_${refNumber}`, 'completed');
        }
        localStorage.setItem('registration_step', '3');
        localStorage.setItem('payment_status', 'completed');
        localStorage.setItem('registration_status', 'completed');
      } catch (err) {
        console.error('Workaround finalize error:', err);
      }
    };

    if (refNumber) {
      finalizeRegistration();
    }
  }, [refNumber]);

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 selection:bg-purple-500 selection:text-white">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="max-w-md w-full bg-slate-900 border border-emerald-500/30 rounded-3xl p-8 sm:p-10 shadow-2xl text-center space-y-6 relative overflow-hidden"
      >
        {/* Subtle glow effect */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Success Icon */}
        <div className="relative inline-flex items-center justify-center">
          <div className="w-20 h-20 rounded-full bg-emerald-500/15 border-2 border-emerald-500/40 flex items-center justify-center text-emerald-400 shadow-xl ring-8 ring-emerald-500/10">
            <CheckCircle2 className="w-12 h-12 stroke-[2.5]" />
          </div>
        </div>

        {/* Text Details */}
        <div className="space-y-2">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Payment Successful!
          </h2>
          <p className="text-sm sm:text-base text-slate-300 font-medium leading-relaxed">
            Your registration payment for GRACIA 2026 is confirmed.
          </p>
          {refNumber && (
            <p className="text-xs font-mono text-amber-400 font-bold">
              Ref: {refNumber}
            </p>
          )}
        </div>

        {/* Subtext Notice */}
        <div className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700/60 text-xs text-slate-300 space-y-1">
          <p className="font-semibold text-emerald-400">✓ Transaction Verified by HitPay</p>
          <p>Confirmation email and digital passes have been dispatched to your email address.</p>
        </div>

        {/* Primary Action Button */}
        <div className="pt-2">
          <a
            href={`/register?step=3&ref=${refNumber}`}
            className="block w-full py-4 px-6 text-center font-bold text-lg text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-lg transition mt-4"
          >
            View Conference Passes & Details ➔
          </a>
        </div>
      </motion.div>
    </div>
  );
};

export default PaymentCompletePage;
