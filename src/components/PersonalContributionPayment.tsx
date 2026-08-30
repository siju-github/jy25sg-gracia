import React, { useState, useEffect } from 'react';
import { 
  Heart, 
  Copy, 
  Check, 
  CheckCircle2, 
  QrCode, 
  ArrowRight, 
  Sparkles, 
  Gift, 
  ShieldCheck, 
  Info 
} from 'lucide-react';
import { motion } from 'motion/react';
import paynowQrImg from '../assets/images/regenerated_image_1785556021273.jpg';

export interface PersonalContributionPaymentProps {
  registrationRef?: string;
  onCompleted: () => void;
  onSkip: () => void;
  className?: string;
}

export const PersonalContributionPayment: React.FC<PersonalContributionPaymentProps> = ({
  registrationRef = 'GRACIA-JUBILEE-CONTRIBUTION',
  onCompleted,
  onSkip,
  className = ''
}) => {
  const [copiedMobile, setCopiedMobile] = useState<boolean>(false);
  const [copiedName, setCopiedName] = useState<boolean>(false);
  const [copiedRef, setCopiedRef] = useState<boolean>(false);

  const personalMobile = '82982404';
  const personalName = 'Thann_______ Ben__ Dan___';

  const copyMobile = () => {
    navigator.clipboard.writeText(personalMobile);
    setCopiedMobile(true);
    setTimeout(() => setCopiedMobile(false), 2000);
  };

  const copyName = () => {
    navigator.clipboard.writeText(personalName);
    setCopiedName(true);
    setTimeout(() => setCopiedName(false), 2000);
  };

  const copyRef = () => {
    navigator.clipboard.writeText(registrationRef);
    setCopiedRef(true);
    setTimeout(() => setCopiedRef(false), 2000);
  };

  return (
    <div className={`bg-white rounded-2xl border border-rose-200 shadow-xl overflow-hidden p-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center space-x-3 pb-4 border-b border-rose-100">
        <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center font-bold">
          <Heart className="w-5 h-5 fill-rose-500" />
        </div>
        <div>
          <span className="inline-block px-2 py-0.5 bg-rose-100 text-rose-800 font-bold text-[10px] uppercase rounded-full tracking-wider mb-0.5">
            Voluntary Personal PayNow Contribution
          </span>
          <h3 className="font-bold text-stone-900 text-lg">Optional Love Offering</h3>
        </div>
      </div>

      {/* Description */}
      <div className="mt-4 bg-rose-50/60 p-3.5 rounded-xl border border-rose-100 text-xs text-rose-950 leading-relaxed space-y-1">
        <p className="font-semibold text-rose-900">
          The registration love offering of $25 is a commitment amount. The actual cost per participant is $150–$200. We warmly invite you to make an additional voluntary love offering via this PayNow QR code directly to the Jubilee account to support the conference.
        </p>
        <p className="text-rose-700">
          If you wish to make an additional voluntary love offering beyond your base registration love offering, scan or transfer via the personal PayNow Mobile number below.
        </p>
      </div>

      {/* QR Code and Account Info Grid */}
      <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-5 items-center">
        {/* Static Personal QR Code */}
        <div className="text-center p-4 bg-stone-50 rounded-2xl border border-stone-200">
          <div className="inline-block p-3 bg-white rounded-xl shadow-sm border border-stone-200">
            <img 
              src={paynowQrImg} 
              alt="Voluntary Personal PayNow QR Code" 
              className="w-48 h-48 mx-auto object-contain"
            />
          </div>
          <p className="text-[11px] font-medium text-stone-500 mt-2">
            Scan using any Singapore Banking App (DBS, OCBC, UOB, PayLah!)
          </p>
        </div>

        {/* Transfer Details */}
        <div className="space-y-3">
          {/* Mobile Number */}
          <div className="p-3 bg-stone-50 rounded-xl border border-stone-200">
            <span className="text-[10px] text-stone-400 font-bold uppercase tracking-wider block">PayNow Mobile Number</span>
            <div className="flex items-center justify-between mt-1">
              <span className="font-mono text-base font-extrabold text-stone-900">+65 {personalMobile}</span>
              <button
                type="button"
                onClick={copyMobile}
                className="px-2.5 py-1 bg-stone-200 hover:bg-stone-300 rounded-lg text-xs font-semibold text-stone-800 transition flex items-center space-x-1"
              >
                {copiedMobile ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedMobile ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>

          {/* Account Recipient Name */}
          <div className="p-3 bg-stone-50 rounded-xl border border-stone-200">
            <span className="text-[10px] text-stone-400 font-bold uppercase tracking-wider block">Recipient Name</span>
            <div className="flex items-center justify-between mt-1">
              <span className="text-xs font-bold text-stone-800">{personalName}</span>
              <button
                type="button"
                onClick={copyName}
                className="px-2.5 py-1 bg-stone-200 hover:bg-stone-300 rounded-lg text-xs font-semibold text-stone-800 transition flex items-center space-x-1"
              >
                {copiedName ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedName ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>

          {/* Reference Note */}
          <div className="p-3 bg-stone-50 rounded-xl border border-stone-200">
            <span className="text-[10px] text-stone-400 font-bold uppercase tracking-wider block">Reference Note</span>
            <div className="flex items-center justify-between mt-1">
              <span className="font-mono text-xs font-bold text-stone-900">{registrationRef}</span>
              <button
                type="button"
                onClick={copyRef}
                className="px-2.5 py-1 bg-stone-200 hover:bg-stone-300 rounded-lg text-xs font-semibold text-stone-800 transition flex items-center space-x-1"
              >
                {copiedRef ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedRef ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="mt-6 flex flex-col sm:flex-row items-center gap-3">
        <button
          type="button"
          onClick={onCompleted}
          className="w-full sm:flex-1 py-3 bg-rose-600 text-white rounded-xl font-bold text-sm hover:bg-rose-700 transition shadow-lg shadow-rose-200 flex items-center justify-center space-x-2"
        >
          <CheckCircle2 className="w-4 h-4" />
          <span>I Have Completed Contribution</span>
        </button>

        <button
          type="button"
          onClick={onSkip}
          className="w-full sm:w-auto px-5 py-3 bg-stone-100 text-stone-700 hover:bg-stone-200 rounded-xl font-semibold text-sm transition flex items-center justify-center space-x-1"
        >
          <span>Skip & Complete Registration</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
