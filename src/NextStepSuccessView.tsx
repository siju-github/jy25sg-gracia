import React from 'react';
import {
  PartyPopper,
  ArrowLeft,
  CheckCircle,
  Package,
  FileText,
  Key,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react';
import type { HitPayStatusResponse } from './hitpay';

interface NextStepSuccessViewProps {
  paymentResult: HitPayStatusResponse | null;
  onReturnToHarness: () => void;
}

export const NextStepSuccessView: React.FC<NextStepSuccessViewProps> = ({
  paymentResult,
  onReturnToHarness,
}) => {
  const pmt = paymentResult?.payments?.[0];

  return (
    <div
      id="next-step-view"
      className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 sm:p-10 shadow-2xl relative overflow-hidden animate-fadeIn"
    >
      {/* Header */}
      <div className="text-center max-w-xl mx-auto mb-8">
        <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500 mx-auto mb-4">
          <PartyPopper className="w-8 h-8" />
        </div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold mb-2">
          <CheckCircle className="w-3.5 h-3.5" />
          <span>Workflow Continuation Verified</span>
        </div>
        <h2 className="text-2xl font-bold text-white tracking-tight">Order Fulfilled & Activated</h2>
        <p className="text-sm text-zinc-400 mt-2">
          The user explicitly clicked &ldquo;Proceed to Next Page&rdquo; after successful HitPay payment
          confirmation. The downstream application state is now unlocked.
        </p>
      </div>

      {/* Order Summary Receipt Box */}
      <div className="max-w-2xl mx-auto bg-zinc-950 border border-zinc-800 rounded-xl p-6 mb-8 space-y-4">
        <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <Package className="w-5 h-5 text-blue-400" />
            <div>
              <div className="text-sm font-bold text-zinc-100">Subscription / Service Plan</div>
              <div className="text-xs text-zinc-400 font-mono">
                Order Ref: {paymentResult?.reference_number || 'REF-ACTIVE'}
              </div>
            </div>
          </div>
          <span className="text-[10px] font-mono font-bold px-2.5 py-1 rounded bg-blue-600/20 text-blue-400 border border-blue-500/30">
            Status: Active
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
          <div>
            <span className="text-zinc-500 block mb-1">Amount Paid</span>
            <span className="font-mono font-bold text-zinc-100 text-sm">
              {paymentResult?.currency} {paymentResult?.amount}
            </span>
          </div>
          <div>
            <span className="text-zinc-500 block mb-1">Payment Method</span>
            <span className="font-semibold text-zinc-300 uppercase text-xs">
              {pmt?.payment_type || 'PayNow / Card'}
            </span>
          </div>
          <div>
            <span className="text-zinc-500 block mb-1">Customer</span>
            <span className="font-semibold text-zinc-300">{pmt?.buyer_name || 'Verified Customer'}</span>
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex justify-center items-center gap-4">
        <button
          type="button"
          id="return-to-harness-btn"
          onClick={onReturnToHarness}
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs border border-blue-500 transition-colors shadow-lg shadow-blue-600/20 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Test Harness</span>
        </button>
      </div>
    </div>
  );
};
