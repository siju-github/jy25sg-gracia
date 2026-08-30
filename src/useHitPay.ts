import { useState, useEffect, useRef, useCallback } from 'react';
import type {
  HitPayPaymentStatus,
  HitPaySessionResponse,
  HitPayStatusResponse,
  HitPayInitiateOptions,
} from './hitpay';

export type HitPayHookStatus =
  | 'idle'
  | 'creating'
  | 'awaiting_payment'
  | 'verifying'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface UseHitPayReturn {
  status: HitPayHookStatus;
  session: HitPaySessionResponse | null;
  paymentResult: HitPayStatusResponse | null;
  error: string | null;
  isLoading: boolean;
  isPolling: boolean;
  modalUrl: string | null;
  popupActive: boolean;
  initiatePayment: (options: HitPayInitiateOptions) => Promise<HitPaySessionResponse | null>;
  verifyPayment: (sessionId?: string) => Promise<HitPayStatusResponse | null>;
  cancelPayment: () => void;
  closeModal: () => void;
  resetState: () => void;
}

/**
 * useHitPay - Architecture-Grade React & Next.js hook for HitPay PayNow Payment Gateway lifecycle.
 * Features:
 * - Centered Popup Window on Desktop (480x720)
 * - Clean Target _blank Tab on Mobile (iOS Safari & Android Chrome)
 * - Auto-Close popup upon payment completion / postMessage signal
 * - Active 2-second background polling loop
 * - Instant visibility/focus re-sync on banking app switch-back
 */
export function useHitPay(apiEndpoint: string = '/api/hitpay'): UseHitPayReturn {
  const [status, setStatus] = useState<HitPayHookStatus>('idle');
  const [session, setSession] = useState<HitPaySessionResponse | null>(null);
  const [paymentResult, setPaymentResult] = useState<HitPayStatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [modalUrl, setModalUrl] = useState<string | null>(null);
  const [popupActive, setPopupActive] = useState<boolean>(false);
  const [isPolling, setIsPolling] = useState<boolean>(false);

  const popupRef = useRef<Window | null>(null);
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);
  const popupCheckTimerRef = useRef<NodeJS.Timeout | null>(null);
  const optionsRef = useRef<HitPayInitiateOptions | null>(null);
  const currentSessionIdRef = useRef<string | null>(null);
  const statusRef = useRef<HitPayHookStatus>('idle');

  // Keep statusRef in sync for event listeners
  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  // Safely close the opened popup window reference
  const closePopupWindow = useCallback(() => {
    if (popupRef.current && !popupRef.current.closed) {
      try {
        popupRef.current.close();
      } catch {
        // Cross-origin restriction fallback
      }
    }
    popupRef.current = null;
    setPopupActive(false);
  }, []);

  // Clear polling & window watchers
  const stopTimers = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    if (popupCheckTimerRef.current) {
      clearInterval(popupCheckTimerRef.current);
      popupCheckTimerRef.current = null;
    }
    setIsPolling(false);
  }, []);

  // Reset all state to clean initial values
  const resetState = useCallback(() => {
    stopTimers();
    closePopupWindow();
    currentSessionIdRef.current = null;
    optionsRef.current = null;

    setStatus('idle');
    setSession(null);
    setPaymentResult(null);
    setError(null);
    setModalUrl(null);
    setIsPolling(false);
  }, [stopTimers, closePopupWindow]);

  // Verify payment status against the backend API endpoint
  const verifyPayment = useCallback(
    async (targetSessionId?: string): Promise<HitPayStatusResponse | null> => {
      const idToVerify = targetSessionId || currentSessionIdRef.current;
      if (!idToVerify) {
        return null;
      }

      try {
        const response = await fetch(
          `${apiEndpoint}?action=check-status&id=${encodeURIComponent(idToVerify)}`,
          {
            method: 'GET',
            headers: { 'Accept': 'application/json' },
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to verify transaction status');
        }

        const statusResponse: HitPayStatusResponse = data;
        setPaymentResult(statusResponse);

        if (statusResponse.status === 'completed') {
          stopTimers();
          closePopupWindow();
          setStatus('completed');
          setModalUrl(null);
          optionsRef.current?.onSuccess?.(statusResponse);
          return statusResponse;
        } else if (statusResponse.status === 'failed' || statusResponse.status === 'canceled' || statusResponse.status === 'expired') {
          stopTimers();
          closePopupWindow();
          setStatus('failed');
          setModalUrl(null);
          const errorMsg = 'Payment failed or was cancelled';
          setError(errorMsg);
          optionsRef.current?.onFailure?.({
            status: statusResponse.status,
            message: errorMsg,
            details: statusResponse,
          });
          return statusResponse;
        }

        return statusResponse;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Error verifying payment';
        console.warn('Status verification error:', message);
        return null;
      }
    },
    [apiEndpoint, stopTimers, closePopupWindow]
  );

  // Background polling loop while checkout is active (polls every 2 seconds)
  const startStatusPolling = useCallback(
    (sessionId: string) => {
      stopTimers();
      setIsPolling(true);

      pollTimerRef.current = setInterval(async () => {
        try {
          const res = await fetch(`${apiEndpoint}?action=check-status&id=${encodeURIComponent(sessionId)}`);
          if (res.ok) {
            const data: HitPayStatusResponse = await res.json();
            if (data.status === 'completed') {
              stopTimers();
              closePopupWindow();
              setPaymentResult(data);
              setStatus('completed');
              setModalUrl(null);
              optionsRef.current?.onSuccess?.(data);
            } else if (data.status === 'failed' || data.status === 'canceled' || data.status === 'expired') {
              stopTimers();
              closePopupWindow();
              setPaymentResult(data);
              setStatus('failed');
              setModalUrl(null);
              setError('Payment was not completed successfully');
              optionsRef.current?.onFailure?.({
                status: data.status,
                message: 'Payment failed or was rejected',
                details: data,
              });
            }
          }
        } catch (err) {
          console.warn('HitPay poll check error:', err);
        }
      }, 2000);
    },
    [apiEndpoint, stopTimers, closePopupWindow]
  );

  // Open Checkout Window (Desktop Centered Popup vs Mobile Tab)
  const openCheckoutWindow = useCallback((url: string): Window | null => {
    const isMobile =
      typeof window !== 'undefined' &&
      (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
        window.innerWidth < 768);

    if (isMobile) {
      // Mobile Safari / Chrome: standard target tab
      const mobileWindow = window.open(url, '_blank');
      return mobileWindow;
    }

    // Desktop: Centered 480x720 Popup
    const width = 480;
    const height = 720;
    const left = Math.max(0, Math.round(window.screenX + (window.outerWidth - width) / 2));
    const top = Math.max(0, Math.round(window.screenY + (window.outerHeight - height) / 2));

    const popup = window.open(
      url,
      'HitPayCheckout',
      `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes,status=no,toolbar=no,menubar=no`
    );

    if (!popup || popup.closed || typeof popup.closed === 'undefined') {
      // Fallback if popup blocker intercepted
      const fallback = window.open(url, '_blank');
      return fallback;
    }

    if (window.focus && popup) popup.focus();
    return popup;
  }, []);

  // Initiate HitPay Payment Session
  const initiatePayment = useCallback(
    async (options: HitPayInitiateOptions): Promise<HitPaySessionResponse | null> => {
      resetState();
      optionsRef.current = options;
      setStatus('creating');
      setError(null);

      // 1. Open popup window immediately on click to prevent mobile Safari/Chrome popup blockers
      const width = 480;
      const height = 720;
      const left = typeof window !== 'undefined' ? Math.max(0, Math.round(window.screenX + (window.outerWidth - width) / 2)) : 100;
      const top = typeof window !== 'undefined' ? Math.max(0, Math.round(window.screenY + (window.outerHeight - height) / 2)) : 100;

      const popup = window.open(
        'about:blank',
        'HitPayCheckout',
        `width=${width},height=${height},left=${left},top=${top},scrollbars=yes,status=no,location=no,toolbar=no`
      );

      if (popup && popup.document) {
        try {
          popup.document.write(`
            <!DOCTYPE html>
            <html>
              <head>
                <title>Connecting to HitPay...</title>
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                  body { font-family: system-ui, -apple-system, sans-serif; background: #130720; color: #ffffff; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; padding: 20px; text-align: center; }
                  .spinner { border: 4px solid rgba(255,255,255,0.1); width: 36px; height: 36px; border-radius: 50%; border-left-color: #f59e0b; animation: spin 1s linear infinite; margin-bottom: 16px; }
                  @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
                  p { font-size: 15px; color: #f3f4f6; margin: 0; font-weight: 600; }
                  span { font-size: 12px; color: #9ca3af; margin-top: 8px; display: block; }
                </style>
              </head>
              <body>
                <div class="spinner"></div>
                <p>Connecting to HitPay PayNow...</p>
                <span>Please wait while we generate your PayNow session</span>
              </body>
            </html>
          `);
        } catch {}
      }

      popupRef.current = popup;
      setPopupActive(true);

      try {
        const payload = {
          amount: options.amount,
          currency: options.currency || 'SGD',
          payment_methods: ['paynow_online'],
          channel: 'api_custom',
          email: options.email,
          name: options.name,
          phone: options.phone,
          purpose: options.purpose || `GRACIA Jubilee Registration - ${options.referenceNumber}`,
          reference_number: options.referenceNumber,
          referenceNumber: options.referenceNumber,
          redirect_url: typeof window !== 'undefined' ? `${window.location.origin}/payment-callback.html` : undefined
        };

        const response = await fetch(apiEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        const data = await response.json();

        if (!response.ok) {
          if (popup && !popup.closed) popup.close();
          popupRef.current = null;
          setPopupActive(false);
          throw new Error(data.error || data.message || 'HitPay API failed to create payment session');
        }

        const checkoutUrl = data.url || data.checkoutUrl;

        // 3. STRICT CHECK: Redirect popup to HitPay hosted URL ONLY if valid HTTP/HTTPS URL
        if (checkoutUrl && typeof checkoutUrl === 'string' && checkoutUrl.startsWith('http')) {
          if (popup && !popup.closed) {
            popup.location.href = checkoutUrl;
          }
        } else {
          if (popup && !popup.closed) popup.close();
          popupRef.current = null;
          setPopupActive(false);
          throw new Error(data.error || 'HitPay failed to return a checkout URL');
        }

        const sessionData: HitPaySessionResponse = {
          id: data.id || data.paymentRequestId || options.referenceNumber,
          url: checkoutUrl,
          checkoutUrl: checkoutUrl,
          status: data.status || 'pending',
          amount: String(options.amount),
          currency: options.currency || 'SGD',
          reference_number: options.referenceNumber
        };

        setSession(sessionData);
        currentSessionIdRef.current = sessionData.id;
        setStatus('awaiting_payment');
        startStatusPolling(sessionData.id);

        // Watch for popup window closure
        popupCheckTimerRef.current = setInterval(() => {
          if (popupRef.current && popupRef.current.closed) {
            if (popupCheckTimerRef.current) {
              clearInterval(popupCheckTimerRef.current);
              popupCheckTimerRef.current = null;
            }
            setPopupActive(false);

            // Trigger immediate backend status verification upon popup close
            setTimeout(async () => {
              if (currentSessionIdRef.current) {
                const finalCheck = await verifyPayment(currentSessionIdRef.current);
                if (finalCheck?.status !== 'completed' && finalCheck?.status !== 'failed') {
                  setStatus(prev => (prev === 'completed' ? 'completed' : 'cancelled'));
                  if (optionsRef.current?.onCancel) {
                    optionsRef.current.onCancel();
                  }
                }
              }
            }, 500);
          }
        }, 800);

        return sessionData;
      } catch (err: unknown) {
        if (popupRef.current && !popupRef.current.closed) {
          try { popupRef.current.close(); } catch {}
        }
        popupRef.current = null;
        setPopupActive(false);

        const errorMsg = err instanceof Error ? err.message : 'HitPay failed to return a checkout URL';
        setError(errorMsg);
        setStatus('failed');
        options.onFailure?.({
          status: 'failed',
          message: errorMsg,
        });
        return null;
      }
    },
    [apiEndpoint, resetState, startStatusPolling, verifyPayment]
  );

  // Manual cancel by user
  const cancelPayment = useCallback(() => {
    stopTimers();
    closePopupWindow();
    setModalUrl(null);
    setStatus('cancelled');
    optionsRef.current?.onCancel?.();
  }, [stopTimers, closePopupWindow]);

  const closeModal = useCallback(() => {
    setModalUrl(null);
    closePopupWindow();
    if (currentSessionIdRef.current) {
      verifyPayment(currentSessionIdRef.current);
    }
  }, [verifyPayment, closePopupWindow]);

  // Listen to postMessage returns from /payment-callback and /hitpay-return
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      if (!event.data || typeof event.data !== 'object') return;

      if (
        event.data.type === 'HITPAY_PAYMENT_SUCCESS' ||
        event.data.type === 'HITPAY_PAYMENT_RETURN'
      ) {
        const sessionId = event.data.id || currentSessionIdRef.current;
        closePopupWindow();

        if (sessionId) {
          await verifyPayment(sessionId);
        } else {
          setStatus('completed');
          stopTimers();
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [verifyPayment, stopTimers, closePopupWindow]);

  // Mobile App Switch-Back / Visibility & Focus Listener
  useEffect(() => {
    const handleAppVisibilitySync = () => {
      if (document.visibilityState === 'visible' && currentSessionIdRef.current) {
        if (statusRef.current === 'awaiting_payment') {
          // Immediately check status upon switching back from banking app
          verifyPayment(currentSessionIdRef.current);
        }
      }
    };

    const handleStorageEvent = (e: StorageEvent) => {
      if (
        (e.key === 'hitpay_payment_success' || e.key === 'hitpay_last_return') &&
        currentSessionIdRef.current
      ) {
        closePopupWindow();
        verifyPayment(currentSessionIdRef.current);
      }
    };

    document.addEventListener('visibilitychange', handleAppVisibilitySync);
    window.addEventListener('focus', handleAppVisibilitySync);
    window.addEventListener('storage', handleStorageEvent);

    return () => {
      document.removeEventListener('visibilitychange', handleAppVisibilitySync);
      window.removeEventListener('focus', handleAppVisibilitySync);
      window.removeEventListener('storage', handleStorageEvent);
    };
  }, [verifyPayment, closePopupWindow]);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      stopTimers();
      closePopupWindow();
    };
  }, [stopTimers, closePopupWindow]);

  const isLoading = status === 'creating' || status === 'verifying';

  return {
    status,
    session,
    paymentResult,
    error,
    isLoading,
    isPolling,
    modalUrl,
    popupActive,
    initiatePayment,
    verifyPayment,
    cancelPayment,
    closeModal,
    resetState,
  };
}

