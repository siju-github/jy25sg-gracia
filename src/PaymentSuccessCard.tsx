import React, { useState } from 'react';
import {
  CheckCircle2,
  ArrowRight,
  Receipt,
  Download,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Sparkles,
  ShieldCheck,
  CreditCard,
  QrCode,
  Smartphone,
} from 'lucide-react';
import type { HitPayStatusResponse } from './hitpay';

interface PaymentSuccessCardProps {
  result: HitPayStatusResponse;
  onProceedNext: () => void;
  onReset: () => void;
}

export const PaymentSuccessCard: React.FC<PaymentSuccessCardProps> = ({
  result,
  onProceedNext,
  onReset,
}) => {
  const [copied, setCopied] = useState(false);
  const [showRawJson, setShowRawJson] = useState(false);

  const paymentRecord = result.payments?.[0];
  const paymentType = paymentRecord?.payment_type || 'paynow_online';
  const formattedDate = result.updated_at
    ? new Date(result.updated_at).toLocaleString()
    : new Date().toLocaleString();

  const handleCopyId = () => {
    navigator.clipboard.writeText(result.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getMethodIcon = (type: string) => {
    if (type.includes('paynow')) return <QrCode className="w-4 h-4 text-purple-400" />;
    if (type.includes('apple') || type.includes('google'))
      return <Smartphone className="w-4 h-4 text-blue-400" />;
    return <CreditCard className="w-4 h-4 text-emerald-400" />;
  };

  return (
    <div
      id="payment-success-card"
      className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 sm:p-8 shadow-2xl relative overflow-hidden animate-fadeIn"
    >
      {/* Centered Success Visual Icon */}
      <div className="flex flex-col items-center justify-center mb-4 text-center">
        <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mb-4 text-emerald-500 shadow-inner">
          <CheckCircle2 className="w-8 h-8 stroke-[2.5]" />
        </div>
        <h2 className="text-xl font-bold text-white mb-1">Payment Successful</h2>
        <p className="text-zinc-400 text-sm">
          Transaction{' '}
          <span className="text-zinc-200 font-mono font-semibold">
            #{result.reference_number || result.id.slice(0, 12)}
          </span>{' '}
          has been verified via HitPay {result.is_mock ? 'Simulator' : 'Gateway'}.
        </p>
      </div>

      {/* Breakdown Table matching Sleek Interface Design */}
      <div className="bg-zinc-950 rounded-xl p-4 my-6 border border-zinc-800 divide-y divide-zinc-800/80">
        <div className="flex justify-between items-center py-2.5 text-sm">
          <span className="text-zinc-500">Amount</span>
          <span className="text-zinc-100 font-semibold font-mono text-base">
            {result.currency} {parseFloat(result.amount).toFixed(2)}
          </span>
        </div>
        <div className="flex justify-between items-center py-2.5 text-sm">
          <span className="text-zinc-500">Payment Method</span>
          <span className="text-zinc-100 font-semibold uppercase flex items-center gap-1.5 text-xs">
            {getMethodIcon(paymentType)}
            <span>{paymentType.replace('_', ' ')}</span>
          </span>
        </div>
        <div className="flex justify-between items-center py-2.5 text-sm">
          <span className="text-zinc-500">HitPay Request ID</span>
          <div className="flex items-center gap-1.5 font-mono text-xs text-zinc-300">
            <span>{result.id.slice(0, 16)}...</span>
            <button
              id="copy-session-id-btn"
              onClick={handleCopyId}
              className="text-zinc-500 hover:text-blue-400 p-1 rounded hover:bg-zinc-800 transition-colors"
              title="Copy ID"
            >
              {copied ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>
        <div className="flex justify-between items-center py-2.5 text-sm">
          <span className="text-zinc-500">Timestamp</span>
          <span className="text-zinc-300 text-xs font-mono">{formattedDate}</span>
        </div>
      </div>

      {/* Non-Destructive Return Confirmation Alert */}
      <div className="p-3.5 bg-zinc-950 border border-zinc-800 rounded-xl mb-6 flex items-start gap-3">
        <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
        <div className="text-xs text-zinc-400 leading-relaxed">
          <strong className="text-zinc-200 block mb-0.5">Non-Destructive Return Completed</strong>
          The popup checkout session concluded and synced with the backend status endpoint without
          disrupting the current client-side state. The application is now awaiting explicit user
          action to proceed.
        </div>
      </div>

      {/* Action Buttons */}
      <div className="space-y-3">
        <button
          type="button"
          id="proceed-next-page-btn"
          onClick={onProceedNext}
          className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-blue-600/20 hover:scale-[1.01] active:scale-[0.99]"
        >
          <span>Proceed to Next Page</span>
          <ArrowRight className="w-4 h-4" />
        </button>

        <button
          type="button"
          id="test-another-payment-btn"
          onClick={onReset}
          className="w-full py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white font-semibold rounded-xl text-sm transition-colors border border-zinc-700 flex items-center justify-center gap-2 cursor-pointer"
        >
          <RotateCcw className="w-4 h-4" />
          <span>Reset Test Suite</span>
        </button>
      </div>

      {/* Raw JSON Accordion */}
      <div className="mt-6 pt-4 border-t border-zinc-800/80">
        <button
          type="button"
          id="toggle-raw-json-btn"
          onClick={() => setShowRawJson(!showRawJson)}
          className="text-xs text-zinc-500 hover:text-zinc-300 flex items-center gap-1.5 transition-colors font-mono"
        >
          {showRawJson ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          <span>{showRawJson ? 'Hide' : 'Inspect'} Gateway Verification Payload</span>
        </button>

        {showRawJson && (
          <div className="mt-3 p-4 bg-zinc-950 border border-zinc-800 rounded-xl overflow-x-auto text-[11px] font-mono text-emerald-400 max-h-60">
            <pre>{JSON.stringify(result, null, 2)}</pre>
          </div>
        )}
      </div>
    </div>
  );
};
