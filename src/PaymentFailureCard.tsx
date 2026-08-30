import React from 'react';
import { AlertTriangle, RotateCcw, XCircle, Info, RefreshCw } from 'lucide-react';
import type { HitPayPaymentStatus, HitPayStatusResponse } from './hitpay';

interface PaymentFailureCardProps {
  status: HitPayPaymentStatus | 'cancelled' | 'failed';
  errorMessage: string | null;
  paymentResult?: HitPayStatusResponse | null;
  onRetry: () => void;
}

export const PaymentFailureCard: React.FC<PaymentFailureCardProps> = ({
  status,
  errorMessage,
  paymentResult,
  onRetry,
}) => {
  const isCancelled = status === 'cancelled';

  return (
    <div
      id="payment-failure-card"
      className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 sm:p-8 shadow-2xl relative overflow-hidden animate-fadeIn"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-zinc-800">
        <div className="flex items-center space-x-4">
          <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
            {isCancelled ? (
              <AlertTriangle className="w-7 h-7 stroke-[2]" />
            ) : (
              <XCircle className="w-7 h-7 stroke-[2]" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-rose-500/20 text-rose-400 border border-rose-500/30">
                {isCancelled ? 'Checkout Cancelled' : 'Payment Unsuccessful'}
              </span>
            </div>
            <h2 className="text-xl font-bold text-white mt-1">
              {isCancelled ? 'Checkout Window Closed' : 'Payment Failed'}
            </h2>
          </div>
        </div>
      </div>

      <div className="py-6 space-y-4">
        <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-xl">
          <div className="text-xs font-semibold text-rose-400 mb-1">Reason / Diagnosis</div>
          <p className="text-sm text-zinc-300">
            {errorMessage ||
              (isCancelled
                ? 'The checkout popup window was closed before completing payment authorization.'
                : 'The payment transaction was declined or failed during gateway processing.')}
          </p>
        </div>

        {paymentResult && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-lg">
              <span className="text-zinc-500 block mb-0.5">HitPay Request ID</span>
              <span className="font-mono text-zinc-300">{paymentResult.id}</span>
            </div>
            <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-lg">
              <span className="text-zinc-500 block mb-0.5">Reference Number</span>
              <span className="font-mono text-zinc-300">
                {paymentResult.reference_number || 'N/A'}
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-zinc-800">
        <p className="text-xs text-zinc-500">
          Your client-side form state and test parameters have been preserved.
        </p>

        {/* PRIMARY ACTIVE "Try Again" Button */}
        <button
          type="button"
          id="retry-payment-btn"
          onClick={onRetry}
          className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs tracking-wide shadow-lg shadow-blue-600/20 hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Try Again</span>
        </button>
      </div>
    </div>
  );
};
