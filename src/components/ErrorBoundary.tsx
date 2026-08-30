import React, { Component, ErrorInfo, ReactNode } from 'react';
import { ShieldAlert, RefreshCw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallbackTitle?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public override state: ErrorBoundaryState = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error caught by ErrorBoundary:', error, errorInfo);
  }

  public override render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[350px] flex items-center justify-center p-6 text-center">
          <div className="max-w-md w-full bg-[#2D1645]/95 border-2 border-amber-500/40 rounded-3xl p-8 text-white space-y-5 shadow-2xl backdrop-blur-2xl">
            <div className="w-14 h-14 rounded-2xl bg-red-500/15 border border-red-500/30 flex items-center justify-center mx-auto text-red-400">
              <ShieldAlert className="w-7 h-7" />
            </div>
            <div className="space-y-2">
              <h3 className="font-poster text-2xl text-amber-300">
                {this.props.fallbackTitle || 'SCANNER SYSTEM RECOVERED'}
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                An unexpected error occurred during QR code processing. The system has prevented a blank screen crash.
              </p>
            </div>
            {this.state.error && (
              <div className="bg-black/60 border border-red-500/30 rounded-xl p-3 text-left font-mono text-[11px] text-red-300 overflow-x-auto max-h-24">
                {this.state.error.message}
              </div>
            )}
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
              className="px-6 py-2.5 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs uppercase tracking-wider shadow-xl flex items-center justify-center space-x-2 mx-auto cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Reset Scanner & Reload</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
