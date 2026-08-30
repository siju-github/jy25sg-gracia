import React, { useState, useEffect } from 'react';
import { SiteContentData } from '../types';
import { Shield, Key, Mail, CheckCircle2, Save, RefreshCw, AlertCircle, ToggleLeft, ToggleRight } from 'lucide-react';

interface PortalAuthSettingsCardProps {
  siteContent?: SiteContentData;
  onSave: (updated: Partial<SiteContentData>) => Promise<void>;
  isSaving?: boolean;
}

export const PortalAuthSettingsCard: React.FC<PortalAuthSettingsCardProps> = ({
  siteContent,
  onSave,
  isSaving = false
}) => {
  const [enableGoogleLogin, setEnableGoogleLogin] = useState<boolean>(
    siteContent?.enableGoogleLogin ?? true
  );
  const [enablePassIdLogin, setEnablePassIdLogin] = useState<boolean>(
    siteContent?.enablePassIdLogin ?? false
  );
  const [enableEmailLogin, setEnableEmailLogin] = useState<boolean>(
    siteContent?.enableEmailLogin ?? false
  );

  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (siteContent) {
      setEnableGoogleLogin(siteContent.enableGoogleLogin ?? true);
      setEnablePassIdLogin(siteContent.enablePassIdLogin ?? false);
      setEnableEmailLogin(siteContent.enableEmailLogin ?? false);
    }
  }, [siteContent]);

  const handleSaveSettings = async () => {
    if (!enableGoogleLogin && !enablePassIdLogin && !enableEmailLogin) {
      setSaveError('At least one authentication method must remain enabled so participants can log in.');
      return;
    }

    setSaveError(null);
    setSaveSuccess(false);

    try {
      await onSave({
        enableGoogleLogin,
        enablePassIdLogin,
        enableEmailLogin
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err: any) {
      setSaveError(err?.message || 'Failed to update portal authentication settings.');
    }
  };

  return (
    <div className="cream-card p-6 sm:p-8 space-y-6 border border-[#E8B400]/30 shadow-xl rounded-3xl bg-gradient-to-br from-[#1c0d1e] via-[#160a18] to-[#120716] text-white">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
        <div>
          <div className="flex items-center space-x-2 text-[#E8B400] mb-1">
            <Shield className="w-5 h-5" />
            <span className="text-xs font-bold uppercase tracking-wider">Super Admin Security Toggles</span>
          </div>
          <h3 className="font-poster text-2xl sm:text-3xl text-white">
            PORTAL LOGIN METHODS & AUTHENTICATION TOGGLES
          </h3>
          <p className="text-xs text-white/70 mt-1">
            Control allowed participant login methods on the portal authentication screen. Google Sign-In remains the primary default method.
          </p>
        </div>

        <button
          type="button"
          onClick={handleSaveSettings}
          disabled={isSaving}
          className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#E8752C] to-[#E8B400] hover:brightness-110 text-slate-950 font-extrabold text-xs uppercase tracking-wider flex items-center justify-center space-x-2 shadow-lg transition-all cursor-pointer disabled:opacity-50 shrink-0"
        >
          {isSaving ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Saving...</span>
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              <span>Save Auth Toggles</span>
            </>
          )}
        </button>
      </div>

      {saveSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="font-semibold">Portal authentication toggles saved! Settings are synchronized in real-time across all participant sessions.</span>
        </div>
      )}

      {saveError && (
        <div className="p-4 rounded-2xl bg-red-500/20 border border-red-500/40 text-red-200 text-xs flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
          <span>{saveError}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Toggle 1: Google OAuth */}
        <div className={`p-5 rounded-2xl border transition-all ${
          enableGoogleLogin
            ? 'bg-[#E8B400]/10 border-[#E8B400]/40 shadow-lg'
            : 'bg-white/5 border-white/10 opacity-60'
        }`}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-2.5">
              <div className="w-9 h-9 rounded-xl bg-[#E8B400]/20 border border-[#E8B400]/40 flex items-center justify-center">
                <svg className="w-4 h-4 bg-white rounded-full p-0.5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                </svg>
              </div>
              <span className="font-bold text-sm text-white">Google Login</span>
            </div>

            <button
              type="button"
              onClick={() => setEnableGoogleLogin(!enableGoogleLogin)}
              className="cursor-pointer text-[#E8B400] hover:text-[#E8B400]/80 transition-transform active:scale-95"
            >
              {enableGoogleLogin ? (
                <ToggleRight className="w-8 h-8 text-[#E8B400]" />
              ) : (
                <ToggleLeft className="w-8 h-8 text-white/40" />
              )}
            </button>
          </div>

          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                enableGoogleLogin ? 'bg-[#E8B400] text-slate-950' : 'bg-white/10 text-white/50'
              }`}>
                Primary Default
              </span>
              <span className="text-[11px] text-white/60 font-mono">
                {enableGoogleLogin ? 'ENABLED' : 'DISABLED'}
              </span>
            </div>
            <p className="text-xs text-white/70 leading-relaxed">
              Main OAuth single sign-on method. Automatically fetches participant Google profile avatar and matches registration.
            </p>
          </div>
        </div>

        {/* Toggle 2: Pass ID Login */}
        <div className={`p-5 rounded-2xl border transition-all ${
          enablePassIdLogin
            ? 'bg-purple-500/10 border-purple-500/40 shadow-lg'
            : 'bg-white/5 border-white/10 opacity-60'
        }`}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-2.5">
              <div className="w-9 h-9 rounded-xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-300">
                <Key className="w-4 h-4 text-purple-300" />
              </div>
              <span className="font-bold text-sm text-white">Pass ID Login</span>
            </div>

            <button
              type="button"
              onClick={() => setEnablePassIdLogin(!enablePassIdLogin)}
              className="cursor-pointer text-purple-400 hover:text-purple-300 transition-transform active:scale-95"
            >
              {enablePassIdLogin ? (
                <ToggleRight className="w-8 h-8 text-purple-400" />
              ) : (
                <ToggleLeft className="w-8 h-8 text-white/40" />
              )}
            </button>
          </div>

          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                enablePassIdLogin ? 'bg-purple-400 text-slate-950' : 'bg-white/10 text-white/50'
              }`}>
                Pass ID / Ref Lookup
              </span>
              <span className="text-[11px] text-white/60 font-mono">
                {enablePassIdLogin ? 'ENABLED' : 'DISABLED'}
              </span>
            </div>
            <p className="text-xs text-white/70 leading-relaxed">
              Displays the "Authenticate with Pass ID / Reference Number" card on the portal login screen.
            </p>
          </div>
        </div>

        {/* Toggle 3: Registered Email Login */}
        <div className={`p-5 rounded-2xl border transition-all ${
          enableEmailLogin
            ? 'bg-indigo-500/10 border-indigo-500/40 shadow-lg'
            : 'bg-white/5 border-white/10 opacity-60'
        }`}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-2.5">
              <div className="w-9 h-9 rounded-xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-300">
                <Mail className="w-4 h-4 text-indigo-300" />
              </div>
              <span className="font-bold text-sm text-white">Email Address Input</span>
            </div>

            <button
              type="button"
              onClick={() => setEnableEmailLogin(!enableEmailLogin)}
              className="cursor-pointer text-indigo-400 hover:text-indigo-300 transition-transform active:scale-95"
            >
              {enableEmailLogin ? (
                <ToggleRight className="w-8 h-8 text-indigo-400" />
              ) : (
                <ToggleLeft className="w-8 h-8 text-white/40" />
              )}
            </button>
          </div>

          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                enableEmailLogin ? 'bg-indigo-400 text-slate-950' : 'bg-white/10 text-white/50'
              }`}>
                Email Verification
              </span>
              <span className="text-[11px] text-white/60 font-mono">
                {enableEmailLogin ? 'ENABLED' : 'DISABLED'}
              </span>
            </div>
            <p className="text-xs text-white/70 leading-relaxed">
              Controls whether standard registered email input fields and email-based pass lookup are enabled on the login screen.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
