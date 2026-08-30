import React, { useState, useEffect } from 'react';
import { 
  Shield, 
  X, 
  Sparkles, 
  Copy, 
  CheckCircle2, 
  RefreshCw, 
  FileText, 
  QrCode,
  Edit3,
  Save,
  AlertCircle
} from 'lucide-react';
import { RegistrationData } from '../types';
import { updateRegistrationInFirestore } from '../lib/firebase';

interface HitPayInspectorModalProps {
  reg: RegistrationData;
  onClose: () => void;
  onUpdateReg?: (updatedReg: RegistrationData) => void;
}

export const HitPayInspectorModal: React.FC<HitPayInspectorModalProps> = ({ reg, onClose, onUpdateReg }) => {
  const [copiedChargeId, setCopiedChargeId] = useState(false);
  const [copiedRef, setCopiedRef] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyMessage, setVerifyMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [showRawJson, setShowRawJson] = useState(false);
  const [currentReg, setCurrentReg] = useState<RegistrationData>(reg);
  
  // Manual edit state for linking existing legacy records
  const [isEditingChargeId, setIsEditingChargeId] = useState(false);
  const [manualChargeInput, setManualChargeInput] = useState('');
  const [isSavingChargeId, setIsSavingChargeId] = useState(false);

  useEffect(() => {
    setCurrentReg(reg);
  }, [reg]);

  const rawHitpay = currentReg.hitpayResponse || currentReg.hitpayPayload || {};
  
  // Extract HitPay Charge ID - filter out GRACIA- reference strings
  const candidateId = 
    currentReg.hitpayChargeId || 
    rawHitpay.payment_id || 
    rawHitpay.charge_id || 
    (Array.isArray(rawHitpay.payments) && rawHitpay.payments[0]?.id) || 
    rawHitpay.id || 
    currentReg.hitpayPaymentRequestId;

  const isValidHitpayChargeId = candidateId && typeof candidateId === 'string' && !candidateId.startsWith('GRACIA-');
  const chargeId = isValidHitpayChargeId ? candidateId : null;

  const passReference = currentReg.paymentReference || currentReg.passId || currentReg.id || 'N/A';

  const isPaid = 
    currentReg.paymentStatus === 'paid' || 
    currentReg.paymentStatus === 'verified' || 
    currentReg.paymentStatus === 'completed' || 
    currentReg.paymentStatus === 'succeeded' ||
    currentReg.status === 'confirmed';

  const handleCopyChargeId = () => {
    if (chargeId) {
      navigator.clipboard.writeText(chargeId);
      setCopiedChargeId(true);
      setTimeout(() => setCopiedChargeId(false), 2500);
    }
  };

  const handleCopyRef = () => {
    if (passReference && passReference !== 'N/A') {
      navigator.clipboard.writeText(passReference);
      setCopiedRef(true);
      setTimeout(() => setCopiedRef(false), 2500);
    }
  };

  const handleSaveManualChargeId = async () => {
    const cleanId = manualChargeInput.trim();
    if (!cleanId) {
      setVerifyMessage({ type: 'error', text: 'Please enter a valid HitPay Charge ID.' });
      return;
    }

    setIsSavingChargeId(true);
    setVerifyMessage(null);
    try {
      const targetDocId = currentReg.id || currentReg.passId || currentReg.paymentReference || '';
      const updatedFields: Partial<RegistrationData> = {
        hitpayChargeId: cleanId,
        hitpayPaymentRequestId: cleanId,
        status: 'confirmed',
        paymentStatus: 'verified'
      };

      if (targetDocId) {
        await updateRegistrationInFirestore(targetDocId, updatedFields);
      }

      const updatedRegObj = { ...currentReg, ...updatedFields };
      setCurrentReg(updatedRegObj);
      if (onUpdateReg) onUpdateReg(updatedRegObj);

      setIsEditingChargeId(false);
      setVerifyMessage({ 
        type: 'success', 
        text: `Successfully linked HitPay Charge ID ${cleanId} to ${passReference}!` 
      });
    } catch (err: any) {
      console.error('Save manual Charge ID error:', err);
      setVerifyMessage({ 
        type: 'error', 
        text: `Failed to save Charge ID: ${err.message || 'Unknown error'}` 
      });
    } finally {
      setIsSavingChargeId(false);
    }
  };

  const handleLiveReverify = async () => {
    setIsVerifying(true);
    setVerifyMessage({ type: 'info', text: 'Contacting HitPay API Gateway to query live payment status...' });
    
    try {
      const queryTarget = chargeId || passReference;
      const res = await fetch('/api/hitpay/verify-user-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentRequestId: queryTarget,
          refNumber: passReference,
          manualVerify: true,
          isAlreadyPaid: isPaid
        })
      });

      const data = await res.json();
      if (data.isPaid || data.status === 'completed' || data.payment_status === 'completed') {
        const updatedChargeId = data.hitpayChargeId || data.hitpayResponse?.payment_id || data.hitpayResponse?.charge_id || chargeId || queryTarget;
        const updatedFields: Partial<RegistrationData> = {
          status: 'confirmed',
          paymentStatus: 'verified',
          hitpayChargeId: updatedChargeId,
          hitpayPaymentRequestId: queryTarget,
          hitpayResponse: data.hitpayResponse || rawHitpay
        };

        const targetDocId = currentReg.id || currentReg.passId || currentReg.paymentReference || '';
        if (targetDocId) {
          await updateRegistrationInFirestore(targetDocId, updatedFields);
        }

        const newRegObj = { ...currentReg, ...updatedFields };
        setCurrentReg(newRegObj);
        if (onUpdateReg) onUpdateReg(newRegObj);

        setVerifyMessage({ 
          type: 'success', 
          text: `Verified successfully! HitPay Charge ID: ${updatedChargeId}` 
        });
      } else {
        setVerifyMessage({ 
          type: 'error', 
          text: data.message || 'Payment not yet marked as completed on HitPay gateway.' 
        });
      }
    } catch (err: any) {
      console.error('HitPay inspector re-verify error:', err);
      setVerifyMessage({ 
        type: 'error', 
        text: `Gateway inquiry failed: ${err.message || 'Network error'}` 
      });
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-amber-500/30 rounded-3xl shadow-2xl max-w-2xl w-full p-6 text-slate-100 relative space-y-5 my-8">
        
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xl font-bold font-serif text-white flex items-center gap-2">
                HitPay Transaction Inspector
              </h3>
              <p className="text-xs text-slate-400">
                Gateway verification & cross-reference details for merchant portal
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            title="Close popup"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Hero Charge ID Banner */}
        <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/30 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              HitPay Gateway Charge ID (Merchant Portal Reference)
            </span>
            <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${
              isPaid 
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' 
                : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
            }`}>
              {isPaid ? '✓ VERIFIED & PAID' : 'PENDING'}
            </span>
          </div>

          {isEditingChargeId ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={manualChargeInput}
                  onChange={(e) => setManualChargeInput(e.target.value)}
                  placeholder="Paste HitPay Charge ID (e.g. a292331f-aa81-46bb-b19d-bf6e47ef91ce)"
                  className="flex-1 bg-slate-950 border border-amber-500/50 rounded-xl px-3 py-2 text-xs font-mono text-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
                <button
                  type="button"
                  onClick={handleSaveManualChargeId}
                  disabled={isSavingChargeId}
                  className="px-3 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold rounded-xl flex items-center gap-1 shrink-0 cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{isSavingChargeId ? 'Saving...' : 'Save & Link'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditingChargeId(false)}
                  className="px-2.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
              </div>
              <p className="text-[10px] text-slate-400">
                Paste the HitPay transaction ID from your HitPay Merchant Dashboard to manually link legacy records.
              </p>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3 bg-slate-950/80 p-3 rounded-xl border border-amber-500/20">
              {chargeId ? (
                <>
                  <code className="font-mono text-xs sm:text-sm font-bold text-amber-300 break-all select-all">
                    {chargeId}
                  </code>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={handleCopyChargeId}
                      className="px-2.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold flex items-center gap-1 transition-all cursor-pointer shadow-sm"
                      title="Copy Charge ID to clipboard"
                    >
                      {copiedChargeId ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 text-slate-950" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setManualChargeInput(chargeId || '');
                        setIsEditingChargeId(true);
                      }}
                      className="px-2 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs flex items-center gap-1 cursor-pointer"
                      title="Edit Charge ID"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-2 text-slate-400 text-xs font-mono">
                    <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>Not Linked Yet (Legacy Record)</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setManualChargeInput('');
                      setIsEditingChargeId(true);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-bold flex items-center gap-1 transition-all cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Link Charge ID</span>
                  </button>
                </div>
              )}
            </div>
          )}

          <p className="text-[11px] text-slate-400 leading-relaxed">
            HitPay Charge ID is HitPay's transaction UUID. Reconcile this against your HitPay Merchant Portal under <em>Payments & Charges</em>.
          </p>
        </div>

        {/* Verification Alert Notice */}
        {verifyMessage && (
          <div className={`p-3 rounded-xl text-xs flex items-center justify-between gap-2 border ${
            verifyMessage.type === 'success' 
              ? 'bg-emerald-950/50 border-emerald-500/40 text-emerald-200' 
              : verifyMessage.type === 'error'
                ? 'bg-red-950/50 border-red-500/40 text-red-200'
                : 'bg-blue-950/50 border-blue-500/40 text-blue-200'
          }`}>
            <span>{verifyMessage.text}</span>
            <button 
              onClick={() => setVerifyMessage(null)}
              className="text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Transaction Key Details Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="bg-slate-800/60 p-3.5 rounded-2xl border border-slate-700/50 space-y-1">
            <span className="text-[10px] uppercase font-bold text-slate-400">Registrant Name & Email</span>
            <p className="font-bold text-white text-sm">{currentReg.name}</p>
            <p className="text-slate-300 font-mono text-[11px]">{currentReg.email}</p>
            {currentReg.phone && <p className="text-slate-400 font-mono text-[11px]">{currentReg.phone}</p>}
          </div>

          <div className="bg-slate-800/60 p-3.5 rounded-2xl border border-slate-700/50 space-y-1">
            <span className="text-[10px] uppercase font-bold text-slate-400">Payment Amount & Status</span>
            <p className="font-mono font-black text-emerald-400 text-base">
              S${(currentReg.paymentAmount || 0).toFixed(2)} SGD
            </p>
            <div className="flex items-center gap-2 pt-0.5">
              <span className="text-[11px] text-slate-300 font-semibold">Gateway Status:</span>
              <span className="font-mono font-bold text-amber-300 uppercase">
                {currentReg.paymentStatus || currentReg.status || 'unknown'}
              </span>
            </div>
          </div>

          <div className="bg-slate-800/60 p-3.5 rounded-2xl border border-slate-700/50 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold text-slate-400">GRACIA Pass Reference ID</span>
              <button onClick={handleCopyRef} className="text-amber-400 hover:text-amber-300 text-[10px] flex items-center gap-1 font-bold cursor-pointer">
                {copiedRef ? <CheckCircle2 className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                {copiedRef ? 'Copied' : 'Copy'}
              </button>
            </div>
            <p className="font-mono font-bold text-amber-300 text-xs break-all">
              {passReference}
            </p>
          </div>

          <div className="bg-slate-800/60 p-3.5 rounded-2xl border border-slate-700/50 space-y-1">
            <span className="text-[10px] uppercase font-bold text-slate-400">HitPay Charge ID</span>
            <p className="font-mono font-semibold text-slate-200 text-xs break-all">
              {chargeId || 'Not Linked Yet'}
            </p>
          </div>

          <div className="bg-slate-800/60 p-3.5 rounded-2xl border border-slate-700/50 space-y-1">
            <span className="text-[10px] uppercase font-bold text-slate-400">Registration Timestamp</span>
            <p className="font-mono text-slate-300 text-xs">
              {currentReg.createdAt ? new Date(currentReg.createdAt).toLocaleString('en-SG', { dateStyle: 'medium', timeStyle: 'medium' }) : 'N/A'}
            </p>
          </div>

          <div className="bg-slate-800/60 p-3.5 rounded-2xl border border-slate-700/50 space-y-1">
            <span className="text-[10px] uppercase font-bold text-slate-400">Payment Method</span>
            <p className="font-bold text-white text-xs flex items-center gap-1.5">
              <QrCode className="w-3.5 h-3.5 text-amber-400" />
              HitPay PayNow SGQR
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-slate-800">
          <button
            type="button"
            onClick={handleLiveReverify}
            disabled={isVerifying}
            className="w-full sm:w-auto px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isVerifying ? 'animate-spin' : ''}`} />
            <span>{isVerifying ? 'Checking HitPay API...' : 'Re-verify Live with HitPay'}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowRawJson(!showRawJson)}
            className="w-full sm:w-auto px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <FileText className="w-4 h-4 text-slate-400" />
            <span>{showRawJson ? 'Hide Raw JSON' : 'Inspect Raw Gateway Payload'}</span>
          </button>
        </div>

        {/* Expandable Raw Gateway JSON Payload */}
        {showRawJson && (
          <div className="space-y-1.5 pt-2 animate-in fade-in duration-150">
            <span className="text-[10px] uppercase font-bold text-slate-400">HitPay Gateway Response & Webhook Object</span>
            <pre className="bg-slate-950 p-4 rounded-2xl text-[11px] font-mono text-emerald-400 overflow-x-auto border border-slate-800 max-h-60 leading-relaxed">
              {JSON.stringify({
                hitpayChargeId: chargeId,
                passReference,
                paymentStatus: currentReg.paymentStatus,
                paymentAmount: currentReg.paymentAmount,
                hitpayResponse: rawHitpay
              }, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};
