import React, { useState } from 'react';
import {
  QrCode,
  Check,
  ArrowRight,
  Sparkles,
  Sliders,
  ShieldCheck,
  DollarSign,
  Building2,
  Lock,
} from 'lucide-react';
import type {
  HitPayCurrency,
  HitPayInitiateOptions,
} from './hitpay';

interface PaymentInitiatorProps {
  isLoading: boolean;
  onInitiate: (options: HitPayInitiateOptions) => void;
  isSandbox?: boolean;
}

const PRESET_AMOUNTS = [10, 50, 100, 250];

export const PaymentInitiator: React.FC<PaymentInitiatorProps> = ({
  isLoading,
  onInitiate,
  isSandbox = true,
}) => {
  const [selectedAmount, setSelectedAmount] = useState<number>(50);
  const [customAmount, setCustomAmount] = useState<string>('');
  const [isCustom, setIsCustom] = useState<boolean>(false);
  const currency: HitPayCurrency = 'SGD';

  // Gracia Registration Metadata Defaults
  const [showMetadata, setShowMetadata] = useState<boolean>(false);
  const [referenceNumber, setReferenceNumber] = useState<string>(
    () => 'GRACIA-' + Math.floor(100000 + Math.random() * 900000)
  );
  const [customerEmail, setCustomerEmail] = useState<string>('registrant@gracia.org');
  const [customerName, setCustomerName] = useState<string>('Gracia Registrant');
  const [purpose, setPurpose] = useState<string>('GRACIA Jubilee Registration Love Offering');

  const effectiveAmount = isCustom ? parseFloat(customAmount) || 0 : selectedAmount;
  const isAmountValid = effectiveAmount > 0 && !isNaN(effectiveAmount);

  const handlePay = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAmountValid || isLoading) return;

    onInitiate({
      amount: effectiveAmount.toFixed(2),
      currency: 'SGD',
      paymentMethods: ['paynow_online'],
      referenceNumber: referenceNumber.trim() || undefined,
      email: customerEmail.trim() || undefined,
      name: customerName.trim() || undefined,
      purpose: purpose.trim() || 'GRACIA Jubilee Registration Love Offering',
    });
  };

  const regenerateRef = () => {
    setReferenceNumber('GRACIA-' + Math.floor(100000 + Math.random() * 900000));
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
      <form onSubmit={handlePay} className="relative z-10 space-y-6">
        {/* Section Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-zinc-100">Gracia PayNow Checkout</h2>
              <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20 flex items-center gap-1">
                <QrCode className="w-3 h-3" />
                PayNow Online
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">
              Instant Singapore PayNow QR settlement exclusively enabled for Gracia Jubilee Registration.
            </p>
          </div>
          <div className="text-right hidden sm:block">
            <span className="text-[11px] text-zinc-500 font-mono">Channel: api_custom</span>
          </div>
        </div>

        {/* 1. Amount Selector (SGD) */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5 uppercase tracking-wider">
              <DollarSign className="w-3.5 h-3.5 text-purple-400" />
              <span>Offering / Registration Amount (SGD)</span>
            </label>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-950 border border-zinc-800 text-xs font-semibold text-purple-400">
              <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
              <span>Singapore Dollar (S$)</span>
            </div>
          </div>

          {/* Preset Buttons */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 mb-3">
            {PRESET_AMOUNTS.map(amt => (
              <button
                key={amt}
                type="button"
                id={`amount-preset-${amt}`}
                onClick={() => {
                  setSelectedAmount(amt);
                  setIsCustom(false);
                }}
                className={`py-3 px-4 rounded-xl text-center font-bold text-sm transition-all border ${
                  !isCustom && selectedAmount === amt
                    ? 'bg-purple-600/20 border-purple-500/60 text-purple-300 shadow-sm'
                    : 'bg-zinc-950 border-zinc-800 text-zinc-300 hover:bg-zinc-800/80 hover:border-zinc-700'
                }`}
              >
                <div className="text-sm font-extrabold font-mono">
                  S$ {amt}
                </div>
                <div className="text-[10px] text-zinc-500 font-normal mt-0.5">Preset Offering</div>
              </button>
            ))}

            {/* Custom Input Toggle Button */}
            <button
              type="button"
              id="amount-custom-toggle"
              onClick={() => setIsCustom(true)}
              className={`py-3 px-4 rounded-xl text-center font-bold text-sm transition-all border ${
                isCustom
                  ? 'bg-purple-600/20 border-purple-500/60 text-purple-300 shadow-sm'
                  : 'bg-zinc-950 border-zinc-800 text-zinc-300 hover:bg-zinc-800/80 hover:border-zinc-700'
              }`}
            >
              <div className="text-sm font-extrabold font-mono">Custom</div>
              <div className="text-[10px] text-zinc-500 font-normal mt-0.5">Any Amount</div>
            </button>
          </div>

          {/* Custom Input Box if chosen */}
          {isCustom && (
            <div className="mt-2 p-3 bg-zinc-950 border border-purple-500/40 rounded-xl flex items-center gap-3 animate-fadeIn">
              <span className="text-xs font-bold text-purple-400">SGD S$</span>
              <input
                type="number"
                id="custom-amount-input"
                step="0.01"
                min="0.50"
                placeholder="Enter custom love offering (e.g. 150.00)"
                value={customAmount}
                onChange={e => setCustomAmount(e.target.value)}
                autoFocus
                className="flex-1 bg-zinc-900 border border-zinc-800 rounded px-3 py-1.5 text-xs text-zinc-100 font-mono placeholder:text-zinc-600 focus:outline-none focus:border-purple-500"
              />
              <span className="text-[10px] text-zinc-500">Min S$ 0.50</span>
            </div>
          )}
        </div>

        {/* 2. Exclusive PayNow Online Method Banner */}
        <div className="p-4 bg-zinc-950/80 rounded-xl border border-purple-500/40 relative overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center shrink-0">
                <QrCode className="w-6 h-6 text-purple-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-zinc-100">PayNow Online (SGQR)</span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-600/20 text-purple-300 font-mono font-semibold">
                    Exclusively Active
                  </span>
                </div>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Dynamic QR generation with real-time webhook confirmation. Supports DBS/POSB, OCBC, UOB, StanChart, GrabPay, Maybank, HSBC, and all SG PayNow banking apps.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
              <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-md border border-emerald-500/20 flex items-center gap-1">
                <Check className="w-3 h-3 stroke-[3]" />
                0% Card Surcharges
              </span>
            </div>
          </div>
        </div>

        {/* 3. Customer Metadata Accordion */}
        <div>
          <button
            type="button"
            id="toggle-metadata-btn"
            onClick={() => setShowMetadata(!showMetadata)}
            className="text-xs font-semibold text-zinc-400 hover:text-zinc-200 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Sliders className="w-3.5 h-3.5 text-purple-400" />
            <span>{showMetadata ? 'Hide' : 'Configure'} Gracia Registrant Details & Reference ID</span>
          </button>

          {showMetadata && (
            <div className="mt-3 p-4 bg-zinc-950 border border-zinc-800 rounded-xl grid grid-cols-1 sm:grid-cols-2 gap-3 animate-fadeIn">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-semibold text-zinc-400">
                    Reference Number (Registration ID)
                  </label>
                  <button
                    type="button"
                    onClick={regenerateRef}
                    className="text-[10px] text-purple-400 hover:underline cursor-pointer"
                  >
                    Regenerate
                  </button>
                </div>
                <input
                  type="text"
                  id="metadata-ref"
                  value={referenceNumber}
                  onChange={e => setReferenceNumber(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded px-3 py-1.5 text-xs text-zinc-200 font-mono focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-zinc-400 mb-1 block">
                  Registrant Name
                </label>
                <input
                  type="text"
                  id="metadata-name"
                  value={customerName}
                  onChange={e => setCustomerName(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded px-3 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-zinc-400 mb-1 block">
                  Registrant Email
                </label>
                <input
                  type="email"
                  id="metadata-email"
                  value={customerEmail}
                  onChange={e => setCustomerEmail(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded px-3 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-zinc-400 mb-1 block">
                  Purpose / Registration Description
                </label>
                <input
                  type="text"
                  id="metadata-purpose"
                  value={purpose}
                  onChange={e => setPurpose(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded px-3 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>
          )}
        </div>

        {/* 4. Summary & Trigger Action */}
        <div className="pt-3 border-t border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="text-[11px] text-zinc-500 uppercase tracking-wider font-semibold">
              Total PayNow Offering Amount
            </div>
            <div className="text-2xl font-bold text-zinc-100 flex items-baseline gap-1.5 font-mono">
              <span className="text-lg text-purple-400">SGD S$</span>
              <span className="text-zinc-100">
                {isAmountValid ? effectiveAmount.toFixed(2) : '0.00'}
              </span>
            </div>
          </div>

          <button
            type="submit"
            id="pay-now-btn"
            disabled={isLoading || !isAmountValid}
            className={`flex items-center justify-center gap-2.5 px-8 py-3 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-xl text-sm transition-all cursor-pointer shadow-lg shadow-purple-600/25 ${
              isLoading || !isAmountValid
                ? 'opacity-50 cursor-not-allowed bg-zinc-800 text-zinc-500'
                : 'hover:scale-[1.01] active:scale-[0.99]'
            }`}
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Generating PayNow QR...</span>
              </>
            ) : (
              <>
                <QrCode className="w-4 h-4" />
                <span>Pay S$ {isAmountValid ? effectiveAmount.toFixed(2) : '0.00'} via PayNow</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
