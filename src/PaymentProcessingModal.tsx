import React, { useState, useEffect } from 'react';
import {
  Loader2,
  ExternalLink,
  ShieldCheck,
  X,
  RefreshCw,
  Clock,
  Sparkles,
  AlertCircle,
  QrCode,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import type { HitPaySessionResponse } from './hitpay';

interface PaymentProcessingModalProps {
  session: HitPaySessionResponse | null;
  popupActive: boolean;
  modalUrl: string | null;
  isPolling: boolean;
  onVerifyNow: () => void;
  onCancel: () => void;
  onCloseModal: () => void;
}

export const PaymentProcessingModal: React.FC<PaymentProcessingModalProps> = ({
  session,
  popupActive,
  modalUrl,
  isPolling,
  onVerifyNow,
  onCancel,
  onCloseModal,
}) => {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [simulating, setSimulating] = useState(false);

  useEffect(() => {
    setElapsedSeconds(0);
    const interval = setInterval(() => {
      setElapsedSeconds(prev => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [session?.id]);

  const handleSimulateStatus = async (status: 'completed' | 'failed', paymentType: string) => {
    if (!session?.id) return;
    setSimulating(true);
    try {
      await fetch('/api/hitpay/simulate-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: session.id,
          status: status,
          payment_type: paymentType,
          failure_reason: status === 'failed' ? 'Simulated QR Session Expired' : undefined,
        }),
      });
      // trigger immediate verification
      onVerifyNow();
    } catch (err) {
      console.error('Simulation error:', err);
    } finally {
      setSimulating(false);
    }
  };

  if (!popupActive && !modalUrl) return null;

  return (
    <div
      id="payment-processing-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-md animate-fadeIn"
    >
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative overflow-hidden">
        {/* Top bar */}
        <div className="flex items-center justify-between border-b border-zinc-800 pb-4 mb-5">
          <div className="flex items-center space-x-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-xl bg-purple-600/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
                <Loader2 className="w-5 h-5 animate-spin" />
              </div>
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-zinc-900 animate-pulse" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-1.5">
                <QrCode className="w-4 h-4 text-purple-400" />
                <span>PayNow SGQR Checkout Window Active</span>
              </h3>
              <p className="text-xs text-zinc-400">
                {isPolling ? 'Polling HitPay every 2s for instant confirmation...' : 'Awaiting payment confirmation...'}
              </p>
            </div>
          </div>

          <button
            id="cancel-processing-btn"
            onClick={onCancel}
            className="text-zinc-400 hover:text-zinc-200 p-1.5 rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer"
            title="Cancel Checkout"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status Indicator & Details */}
        <div className="space-y-3 mb-6">
          <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-3.5 flex items-center justify-between text-xs">
            <div>
              <span className="text-zinc-500 block mb-0.5 font-medium">Offering Amount</span>
              <span className="font-mono font-bold text-purple-400 text-sm">
                {session?.currency} {session?.amount}
              </span>
            </div>
            <div>
              <span className="text-zinc-500 block mb-0.5 font-medium">Reference ID</span>
              <span className="font-mono text-zinc-300 truncate max-w-[130px] block" title={session?.reference_number || session?.id}>
                {session?.reference_number || (session?.id ? `${session.id.slice(0, 12)}...` : 'N/A')}
              </span>
            </div>
            <div>
              <span className="text-zinc-500 block mb-0.5 font-medium">Active Time</span>
              <span className="font-mono text-zinc-300 flex items-center gap-1">
                <Clock className="w-3 h-3 text-zinc-400" />
                {elapsedSeconds}s
              </span>
            </div>
          </div>

          <div className="p-3.5 bg-zinc-950 border border-purple-500/20 rounded-xl flex items-start gap-2.5 text-xs text-zinc-300">
            <ExternalLink className="w-4 h-4 shrink-0 mt-0.5 text-purple-400" />
            <div>
              <p className="font-semibold text-zinc-200">Scan & Pay on your Mobile / HitPay Window</p>
              <p className="text-zinc-400 mt-0.5">
                Complete the PayNow QR scan using DBS PayLah, OCBC Digital, UOB TMRW, or GrabPay. When completed, this window automatically closes and confirms your registration.
              </p>
            </div>
          </div>
        </div>

        {/* Sandbox Quick Simulator Triggers */}
        {session?.is_mock && (
          <div className="mb-6 p-3.5 bg-zinc-950 border border-zinc-800 rounded-xl">
            <div className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
              <span>Sandbox Test Simulator</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                id="sim-paynow-success-btn"
                disabled={simulating}
                onClick={() => handleSimulateStatus('completed', 'paynow_online')}
                className="p-2.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-purple-500/30 text-[11px] font-semibold text-purple-200 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Simulate PayNow Success</span>
              </button>
              <button
                type="button"
                id="sim-decline-btn"
                disabled={simulating}
                onClick={() => handleSimulateStatus('failed', 'paynow_online')}
                className="p-2.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-[11px] font-semibold text-rose-300 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <XCircle className="w-4 h-4 text-rose-400" />
                <span>Simulate Expired / Cancel</span>
              </button>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-zinc-800">
          <button
            type="button"
            id="modal-cancel-btn"
            onClick={onCancel}
            className="px-4 py-2 rounded-lg text-xs font-semibold text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            Cancel Checkout
          </button>

          <button
            type="button"
            id="modal-verify-btn"
            onClick={onVerifyNow}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-all shadow-md shadow-purple-600/20 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Check Status Now</span>
          </button>
        </div>
      </div>
    </div>
  );
};
