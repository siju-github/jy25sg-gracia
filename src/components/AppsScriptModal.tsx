import React, { useState } from 'react';
import { APPS_SCRIPT_TEMPLATE } from '../data/initialData';
import { Copy, Check, ExternalLink, X, FileSpreadsheet } from 'lucide-react';

interface AppsScriptModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUrl?: string;
  onSaveUrl?: (url: string) => void;
}

export const AppsScriptModal: React.FC<AppsScriptModalProps> = ({
  isOpen,
  onClose,
  currentUrl = '',
  onSaveUrl
}) => {
  const [copied, setCopied] = useState(false);
  const [inputUrl, setInputUrl] = useState(currentUrl);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(APPS_SCRIPT_TEMPLATE);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSave = () => {
    if (onSaveUrl) {
      onSaveUrl(inputUrl);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
      <div className="bg-[#1c0d28] border border-white/20 rounded-2xl max-w-2xl w-full p-6 sm:p-8 relative text-white shadow-2xl">
        
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white/80 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center space-x-3 mb-4">
          <div className="p-3 rounded-xl bg-[#2242A6]/20 border border-[#2242A6]/40 text-[#3B82F6]">
            <FileSpreadsheet className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-poster text-2xl tracking-wider text-white">
              GOOGLE SHEETS INTEGRATION GUIDE
            </h3>
            <p className="text-xs text-[#E8B400]">
              Sync Conference & Musical Registrations directly to Google Sheets
            </p>
          </div>
        </div>

        {/* Step Guide */}
        <div className="space-y-4 text-sm text-white/80 mb-6 bg-white/5 p-4 rounded-xl border border-white/10">
          <div className="flex items-start space-x-2">
            <span className="w-5 h-5 rounded-full bg-[#E8752C] text-white font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">1</span>
            <p>Create a Google Sheet titled <strong className="text-white">"GRACIA Registrations"</strong> with two tabs: <strong className="text-white">Conference Registrations</strong> and <strong className="text-white">Musical Registrations</strong>.</p>
          </div>

          <div className="flex items-start space-x-2">
            <span className="w-5 h-5 rounded-full bg-[#C81E6E] text-white font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">2</span>
            <p>Go to <strong className="text-white">Extensions &gt; Apps Script</strong>, paste the code below, and click <strong className="text-white">Deploy &gt; New deployment</strong> (Select: <em>Web App</em>, Execute as: <em>Me</em>, Access: <em>Anyone</em>).</p>
          </div>

          <div className="flex items-start space-x-2">
            <span className="w-5 h-5 rounded-full bg-[#2242A6] text-white font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">3</span>
            <p>Copy your deployed Web App URL and paste it into the field below!</p>
          </div>
        </div>

        {/* Web App URL Input */}
        <div className="mb-6 space-y-2">
          <label className="block text-xs font-bold uppercase text-[#E8B400] tracking-wider">
            Apps Script Web App URL
          </label>
          <div className="flex space-x-2">
            <input
              type="url"
              value={inputUrl || ''}
              onChange={(e) => setInputUrl(e.target.value)}
              placeholder="https://script.google.com/macros/s/.../exec"
              className="flex-1 bg-black/40 border border-white/20 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#E8752C]"
            />
            {onSaveUrl && (
              <button
                onClick={handleSave}
                className="px-5 py-2.5 bg-signature-gradient text-white font-bold rounded-xl text-sm hover:opacity-90 transition-opacity shadow-lg"
              >
                Save URL
              </button>
            )}
          </div>
        </div>

        {/* Code Box */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-white/60 uppercase">Google Apps Script (Code.gs)</span>
            <button
              onClick={handleCopy}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs text-white font-medium transition-colors"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-[#E8B400]" />
                  <span className="text-[#E8B400]">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 text-white/80" />
                  <span>Copy Code</span>
                </>
              )}
            </button>
          </div>

          <pre className="bg-black/60 border border-white/10 rounded-xl p-4 text-xs font-mono text-emerald-400 overflow-x-auto max-h-56 leading-relaxed">
            {APPS_SCRIPT_TEMPLATE}
          </pre>
        </div>

      </div>
    </div>
  );
};
