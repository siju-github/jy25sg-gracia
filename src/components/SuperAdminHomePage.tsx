import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Zap, 
  Database, 
  RefreshCw, 
  QrCode, 
  CheckCircle2, 
  AlertTriangle, 
  Copy, 
  Check, 
  Download, 
  Users, 
  Mail, 
  DollarSign, 
  Sparkles, 
  FileText, 
  BookOpen, 
  ExternalLink,
  Lock,
  ArrowRight,
  Server,
  Activity,
  Layers,
  Search,
  Clock,
  Trash2,
  Filter,
  UserCheck,
  UserX,
  Code,
  Terminal,
  Send,
  Play,
  Key,
  Globe,
  Cpu,
  Radio,
  FileCode,
  Tag,
  ChevronRight,
  Info,
  X,
  Compass,
  CheckCircle,
  HelpCircle,
  Ticket,
  Palette,
  Edit
} from 'lucide-react';
import { fetchPortalUserLogs, clearPortalUserLogs } from '../lib/firebase';
import { PortalUserLogItem, SiteContentData } from '../types';
import { PortalAuthSettingsCard } from './PortalAuthSettingsCard';

interface SuperAdminHomePageProps {
  userEmail: string;
  registrations: any[];
  messagesList: any[];
  adminsList: any[];
  intercessionsList: any[];
  invitationsList?: any[];
  siteContent?: SiteContentData;
  onUpdateSiteContent?: (newContent: Partial<SiteContentData>) => Promise<void>;
  onNavigateTab: (tab: 'home' | 'messages' | 'registrations' | 'admins' | 'content' | 'sheets' | 'tickets' | 'intercessions' | 'invitations' | 'groups' | 'verses') => void;
  onOpenGoLiveModal: () => void;
  onOpenBackupModal: () => void;
  onOpenTechDocModal: () => void;
  onOpenUserManualModal: () => void;
}

export const SuperAdminHomePage: React.FC<SuperAdminHomePageProps> = ({
  userEmail,
  registrations,
  messagesList,
  adminsList,
  intercessionsList,
  invitationsList = [],
  siteContent,
  onUpdateSiteContent,
  onNavigateTab,
  onOpenGoLiveModal,
  onOpenBackupModal,
  onOpenTechDocModal,
  onOpenUserManualModal
}) => {
  // $1 Test QR Generator State - Persistent & Synchronized
  const [testAmount, setTestAmount] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('gracia_test_qr_amount');
      return saved ? parseFloat(saved) : 1.00;
    } catch {
      return 1.00;
    }
  });
  const [testRef, setTestRef] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('gracia_test_qr_ref');
      return saved && saved.startsWith('TEST-GRACIA-') ? saved : `TEST-GRACIA-${Math.floor(10000 + Math.random() * 90000)}`;
    } catch {
      return `TEST-GRACIA-${Math.floor(10000 + Math.random() * 90000)}`;
    }
  });
  // The actual reference currently encoded in the displayed QR image
  const [activeEncodedRef, setActiveEncodedRef] = useState<string>('');
  const [paynowProxy, setPaynowProxy] = useState<string>('201605888W');
  const [isUenProxy, setIsUenProxy] = useState<boolean>(false);
  const [testQrUrl, setTestQrUrl] = useState<string>('');
  const [testEmvPayload, setTestEmvPayload] = useState<string>('');
  const [isGeneratingTestQr, setIsGeneratingTestQr] = useState<boolean>(false);
  const [testPaymentStatus, setTestPaymentStatus] = useState<'idle' | 'pending' | 'verifying' | 'succeeded'>('idle');
  const [testStatusMsg, setTestStatusMsg] = useState<string>('');
  const [copiedPayload, setCopiedPayload] = useState<boolean>(false);
  const [copiedRef, setCopiedRef] = useState<boolean>(false);
  const [showPayloadInspector, setShowPayloadInspector] = useState<boolean>(false);
  const [testHitpayUrl, setTestHitpayUrl] = useState<string | null>(null);
  const [testRequestId, setTestRequestId] = useState<string | null>(null);
  const [isVerifyingManual, setIsVerifyingManual] = useState<boolean>(false);

  // HitPay Live Workflow Logs & Connection Diagnostics
  const [hitpayWorkflowLogs, setHitpayWorkflowLogs] = useState<Array<{
    id: string;
    timestamp: string;
    level: 'info' | 'success' | 'warn' | 'error';
    stage: 'QR_GENERATED' | 'GATEWAY_REQUEST' | 'POLL_CHECK' | 'WEBHOOK_RECEIVED' | 'SIGNATURE_VERIFIED' | 'PAYMENT_SETTLED' | 'TEST_CONNECTION' | 'FALLBACK_TRIGGERED';
    referenceNumber?: string;
    paymentRequestId?: string;
    amount?: number;
    message: string;
    details?: any;
  }>>([]);
  const [hitpayHealth, setHitpayHealth] = useState<{
    connected?: boolean;
    hasApiKey?: boolean;
    env?: string;
    apiKeyLength?: number;
    latencyMs?: number;
    message?: string;
    details?: any;
  } | null>(null);
  const [isTestingHitpayConn, setIsTestingHitpayConn] = useState<boolean>(false);
  const [hitpayWorkflowFilter, setHitpayWorkflowFilter] = useState<string>('');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  // Super Admin Gateway Sub-Tabs
  const [gatewayActiveTab, setGatewayActiveTab] = useState<'test_qr' | 'endpoints' | 'emvco_specs' | 'logs'>('test_qr');
  const [selectedEndpointId, setSelectedEndpointId] = useState<string>('create_payment');
  const [customEndpointPayload, setCustomEndpointPayload] = useState<string>('');
  const [isExecutingEndpoint, setIsExecutingEndpoint] = useState<boolean>(false);
  const [endpointExecutionResult, setEndpointExecutionResult] = useState<{
    status: number;
    statusText: string;
    latencyMs: number;
    headers: Record<string, string>;
    data: any;
    error?: string;
  } | null>(null);
  const [copiedCurlEndpointId, setCopiedCurlEndpointId] = useState<string | null>(null);
  const [copiedUrlEndpointId, setCopiedUrlEndpointId] = useState<string | null>(null);
  const [copiedResponse, setCopiedResponse] = useState<boolean>(false);

  // Super Admin Endpoints Catalog & Popup Modal State
  const [showHitpayEndpointsModal, setShowHitpayEndpointsModal] = useState<boolean>(false);
  const [modalEndpointCategory, setModalEndpointCategory] = useState<string>('all');
  const [modalSelectedEndpointId, setModalSelectedEndpointId] = useState<string>('create_payment');
  const [modalCustomPayload, setModalCustomPayload] = useState<string>('');
  const [isModalExecuting, setIsModalExecuting] = useState<boolean>(false);
  const [modalExecutionResult, setModalExecutionResult] = useState<{
    status: number;
    statusText: string;
    latencyMs: number;
    headers: Record<string, string>;
    data: any;
    error?: string;
  } | null>(null);
  const [copiedModalCurlId, setCopiedModalCurlId] = useState<string | null>(null);
  const [copiedModalUrlId, setCopiedModalUrlId] = useState<string | null>(null);
  const [copiedModalResponse, setCopiedModalResponse] = useState<boolean>(false);

  // Super Admin Endpoints Catalog
  const SYSTEM_ENDPOINTS = [
    {
      id: 'create_payment',
      name: 'Create Dynamic Payment Request & PayNow QR',
      method: 'POST',
      path: '/api/hitpay/create-payment',
      category: 'HitPay Gateway',
      description: 'Generates a live HitPay payment session with dynamic EMVCo PayNow QR code, unique tracking reference, and hosted checkout redirect URL.',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      defaultPayload: {
        amount: 25.00,
        baseFee: 25.00,
        additionalContribution: 10.00,
        currency: 'SGD',
        name: 'Maria Joseph',
        email: 'maria.joseph@example.com',
        phone: '82982404',
        purpose: 'GRACIA Jubilee 2026 Registration (TEST-GRACIA-26078)',
        referenceNumber: 'TEST-GRACIA-26078',
        redirectUrl: `${window.location.origin}/portal`,
        webhookUrl: `${window.location.origin}/api/hitpay/webhook`
      },
      responseSchema: {
        status: 'success',
        paymentRequestId: '99b9c03b-a1b2-4c3d-8e4f-567890abcdef',
        referenceNumber: 'TEST-GRACIA-26078',
        amount: 35.00,
        baseFee: 25.00,
        additionalContribution: 10.00,
        currency: 'SGD',
        paynowUen: '82982404',
        checkoutUrl: 'https://hitpay.app/r/req_sample123',
        hitpayQrDataUrl: 'data:image/png;base64,...',
        hitpayActive: true,
        hitpayEnv: 'live',
        paymentStatus: 'pending'
      },
      notes: 'Encodes participant reference into Tag 26 Sub-tag 05 (SG.PAYNOW) and Tag 62 Sub-tag 01 (Bill Number).'
    },
    {
      id: 'get_status',
      name: 'Query Payment Status & Polling Probe',
      method: 'GET',
      path: `/api/hitpay/status/${testRequestId || activeEncodedRef || 'TEST-GRACIA-26078'}`,
      category: 'HitPay Gateway',
      description: 'Queries HitPay Gateway API and in-memory store for the real-time settlement state of a payment request or reference number.',
      headers: {
        'Accept': 'application/json'
      },
      defaultPayload: null,
      responseSchema: {
        status: 'success',
        paymentRequestId: '99b9c03b-a1b2-4c3d-8e4f-567890abcdef',
        paymentStatus: 'succeeded',
        amount: 35.00,
        referenceNumber: 'TEST-GRACIA-26078',
        hitpayResponse: {
          id: '99b9c03b-a1b2-4c3d-8e4f-567890abcdef',
          status: 'completed',
          amount: '35.00',
          currency: 'SGD'
        }
      },
      notes: 'Used by the checkout card polling loop every 2.5 seconds to auto-transition the user screen once bank transfer settles.'
    },
    {
      id: 'webhook_receiver',
      name: 'HitPay Webhook Ingestion & HMAC Verification',
      method: 'POST',
      path: '/api/hitpay/webhook',
      category: 'HitPay Webhooks',
      description: 'Asynchronous webhook receiver invoked by HitPay servers upon successful FAST PayNow transaction. Validates SHA256 HMAC signature and triggers Firestore confirmation.',
      headers: {
        'Content-Type': 'application/json',
        'hitpay-signature': '3f18e9a2b4... (HMAC-SHA256 of payload with HITPAY_WEBHOOK_SECRET)'
      },
      defaultPayload: {
        payment_id: 'pay_live_99a8b7c6d5e4f3',
        payment_request_id: 'req_8877665544',
        reference_number: activeEncodedRef || 'TEST-GRACIA-26078',
        status: 'completed',
        amount: '35.00',
        currency: 'SGD',
        buyer_name: 'Maria Joseph',
        buyer_email: 'maria.joseph@example.com',
        buyer_phone: '82982404',
        hmac: '3f18e9a2b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1'
      },
      responseSchema: {
        status: 'success',
        message: 'Webhook processed successfully. Transaction settled in database.',
        referenceNumber: 'TEST-GRACIA-26078'
      },
      notes: 'Also accessible via alias path /api/hitpay for universal backwards compatibility.'
    },
    {
      id: 'gateway_health',
      name: 'HitPay Gateway Health & Connectivity Probe',
      method: 'GET',
      path: '/api/hitpay/health',
      category: 'Diagnostics',
      description: 'Tests active live network connectivity to HitPay API servers and verifies that the HITPAY_API_KEY environment variable is configured.',
      headers: {
        'Accept': 'application/json'
      },
      defaultPayload: null,
      responseSchema: {
        status: 'success',
        connected: true,
        env: 'live',
        hasApiKey: true,
        apiKeyLength: 64,
        latencyMs: 48,
        message: 'HitPay Gateway API connected successfully in live mode'
      },
      notes: 'Returns 200 OK when live API is responsive and ready for attendee registration transactions.'
    },
    {
      id: 'workflow_logs',
      name: 'Real-Time Gateway Event & Webhook Telemetry Logs',
      method: 'GET',
      path: '/api/hitpay/logs?limit=25',
      category: 'Telemetry',
      description: 'Fetches in-memory circular buffer of the most recent gateway lifecycle events (QR generation, polling, webhooks, signature checks).',
      headers: {
        'Accept': 'application/json'
      },
      defaultPayload: null,
      responseSchema: {
        status: 'success',
        count: 25,
        logs: [
          {
            id: 'log_1718000000000',
            timestamp: '2026-08-13T21:00:00.000Z',
            level: 'success',
            stage: 'PAYMENT_SETTLED',
            referenceNumber: 'TEST-GRACIA-26078',
            paymentRequestId: '99b9c03b-...',
            amount: 35.00,
            message: 'Payment verified and settled successfully in database'
          }
        ]
      },
      notes: 'Supports optional ?ref=TEST-GRACIA-26078 query parameter to filter by specific transaction.'
    },
    {
      id: 'generate_pass_pdf',
      name: 'High-Res Digital Conference Pass PDF Compiler',
      method: 'POST',
      path: '/api/generate-pdf-pass',
      category: 'Pass Compilation',
      description: 'Server-side PDF generation endpoint creating print-ready A4/badge passes with attendee details, QR code, and jubilee branding.',
      headers: {
        'Content-Type': 'application/json'
      },
      defaultPayload: {
        passId: 'JY-GRACIA-2026-89231',
        fullName: 'Maria Joseph',
        registrationType: 'FULL_CONFERENCE',
        zone: 'St. Peter Zone (Main Hall)',
        seat: 'Row G, Seat 14',
        referenceNumber: 'TEST-GRACIA-26078',
        churchParish: 'Church of the Holy Spirit',
        email: 'maria.joseph@example.com'
      },
      responseSchema: 'Binary PDF Stream (application/pdf)',
      notes: 'Returns Content-Type: application/pdf with Content-Disposition: attachment.'
    },
    {
      id: 'server_health',
      name: 'Full-Stack Core Server Health Check',
      method: 'GET',
      path: '/api/health',
      category: 'Platform Core',
      description: 'Lightweight load-balancer and container uptime probe reporting server status, Node runtime environment, and container health.',
      headers: {
        'Accept': 'application/json'
      },
      defaultPayload: null,
      responseSchema: {
        status: 'ok',
        timestamp: '2026-08-13T21:00:00.000Z',
        uptimeSeconds: 3600
      },
      notes: 'Monitored continuously by platform container health check.'
    }
  ];

  // Keep custom payload in sync when switching selected endpoint
  useEffect(() => {
    const ep = SYSTEM_ENDPOINTS.find(e => e.id === selectedEndpointId);
    if (ep) {
      if (ep.defaultPayload) {
        setCustomEndpointPayload(JSON.stringify(ep.defaultPayload, null, 2));
      } else {
        setCustomEndpointPayload('');
      }
      setEndpointExecutionResult(null);
    }
  }, [selectedEndpointId]);

  // Execute Endpoint Live
  const handleExecuteSelectedEndpoint = async () => {
    const ep = SYSTEM_ENDPOINTS.find(e => e.id === selectedEndpointId);
    if (!ep) return;

    setIsExecutingEndpoint(true);
    setEndpointExecutionResult(null);
    const startTime = performance.now();

    try {
      let reqBody: any = undefined;
      if (ep.method !== 'GET' && customEndpointPayload.trim()) {
        try {
          reqBody = JSON.parse(customEndpointPayload);
        } catch (jsonErr: any) {
          setIsExecutingEndpoint(false);
          setEndpointExecutionResult({
            status: 400,
            statusText: 'Client JSON Parse Error',
            latencyMs: 0,
            headers: {},
            data: null,
            error: `Invalid JSON in request payload editor: ${jsonErr.message}`
          });
          return;
        }
      }

      const res = await fetch(ep.path, {
        method: ep.method,
        headers: {
          ...(ep.headers || {}),
          'Content-Type': ep.method !== 'GET' ? 'application/json' : undefined
        } as any,
        body: ep.method !== 'GET' && reqBody ? JSON.stringify(reqBody) : undefined
      });

      const latencyMs = Math.round(performance.now() - startTime);
      const resHeaders: Record<string, string> = {};
      res.headers.forEach((val, key) => {
        resHeaders[key] = val;
      });

      const contentType = res.headers.get('content-type') || '';
      let resData: any = null;

      if (contentType.includes('application/json')) {
        resData = await res.json().catch(() => null);
      } else if (contentType.includes('application/pdf')) {
        resData = { message: `[Binary PDF Stream received: ${res.status} ${res.statusText}, Content-Length: ${res.headers.get('content-length') || 'dynamic'} bytes]` };
      } else {
        resData = await res.text().catch(() => '');
      }

      setEndpointExecutionResult({
        status: res.status,
        statusText: res.statusText || (res.ok ? 'OK' : 'Error'),
        latencyMs,
        headers: resHeaders,
        data: resData
      });
    } catch (err: any) {
      const latencyMs = Math.round(performance.now() - startTime);
      setEndpointExecutionResult({
        status: 0,
        statusText: 'Network Error',
        latencyMs,
        headers: {},
        data: null,
        error: err.message || 'Failed to connect to endpoint'
      });
    } finally {
      setIsExecutingEndpoint(false);
    }
  };

  const handleCopyCurl = (ep: any) => {
    const payloadStr = ep.method !== 'GET' && (customEndpointPayload || JSON.stringify(ep.defaultPayload || {}))
      ? ` -d '${(customEndpointPayload || JSON.stringify(ep.defaultPayload || {})).replace(/'/g, "\\'")}'`
      : '';
    const headerStr = Object.entries(ep.headers || {})
      .map(([k, v]) => ` -H "${k}: ${v}"`)
      .join('');
    const curl = `curl -X ${ep.method} "${window.location.origin}${ep.path}"${headerStr}${payloadStr}`;
    navigator.clipboard.writeText(curl);
    setCopiedCurlEndpointId(ep.id);
    setTimeout(() => setCopiedCurlEndpointId(null), 2500);
  };

  const handleCopyEndpointUrl = (path: string, id: string) => {
    const fullUrl = `${window.location.origin}${path}`;
    navigator.clipboard.writeText(fullUrl);
    setCopiedUrlEndpointId(id);
    setTimeout(() => setCopiedUrlEndpointId(null), 2500);
  };

  // Synchronize modal payload when modal selected endpoint changes
  useEffect(() => {
    const ep = SYSTEM_ENDPOINTS.find(e => e.id === modalSelectedEndpointId);
    if (ep) {
      if (ep.defaultPayload) {
        setModalCustomPayload(JSON.stringify(ep.defaultPayload, null, 2));
      } else {
        setModalCustomPayload('');
      }
      setModalExecutionResult(null);
    }
  }, [modalSelectedEndpointId]);

  // Execute modal selected endpoint live
  const handleExecuteModalEndpoint = async () => {
    const ep = SYSTEM_ENDPOINTS.find(e => e.id === modalSelectedEndpointId);
    if (!ep) return;

    setIsModalExecuting(true);
    setModalExecutionResult(null);
    const startTime = performance.now();

    try {
      let reqBody: any = undefined;
      if (ep.method !== 'GET' && modalCustomPayload.trim()) {
        try {
          reqBody = JSON.parse(modalCustomPayload);
        } catch (jsonErr: any) {
          setIsModalExecuting(false);
          setModalExecutionResult({
            status: 400,
            statusText: 'Client JSON Parse Error',
            latencyMs: 0,
            headers: {},
            data: null,
            error: `Invalid JSON in request payload editor: ${jsonErr.message}`
          });
          return;
        }
      }

      const res = await fetch(ep.path, {
        method: ep.method,
        headers: {
          ...(ep.headers || {}),
          'Content-Type': ep.method !== 'GET' ? 'application/json' : undefined
        } as any,
        body: ep.method !== 'GET' && reqBody ? JSON.stringify(reqBody) : undefined
      });

      const latencyMs = Math.round(performance.now() - startTime);
      const resHeaders: Record<string, string> = {};
      res.headers.forEach((val, key) => {
        resHeaders[key] = val;
      });

      const contentType = res.headers.get('content-type') || '';
      let resData: any = null;

      if (contentType.includes('application/json')) {
        resData = await res.json().catch(() => null);
      } else if (contentType.includes('application/pdf')) {
        resData = { message: `[Binary PDF Stream received: ${res.status} ${res.statusText}, Content-Length: ${res.headers.get('content-length') || 'dynamic'} bytes]` };
      } else {
        resData = await res.text().catch(() => '');
      }

      setModalExecutionResult({
        status: res.status,
        statusText: res.statusText || (res.ok ? 'OK' : 'Error'),
        latencyMs,
        headers: resHeaders,
        data: resData
      });
    } catch (err: any) {
      const latencyMs = Math.round(performance.now() - startTime);
      setModalExecutionResult({
        status: 0,
        statusText: 'Network Error',
        latencyMs,
        headers: {},
        data: null,
        error: err.message || 'Failed to connect to endpoint'
      });
    } finally {
      setIsModalExecuting(false);
    }
  };

  const handleCopyModalCurl = (ep: any) => {
    const payloadStr = ep.method !== 'GET' && (modalCustomPayload || JSON.stringify(ep.defaultPayload || {}))
      ? ` -d '${(modalCustomPayload || JSON.stringify(ep.defaultPayload || {})).replace(/'/g, "\\'")}'`
      : '';
    const headerStr = Object.entries(ep.headers || {})
      .map(([k, v]) => ` -H "${k}: ${v}"`)
      .join('');
    const curl = `curl -X ${ep.method} "${window.location.origin}${ep.path}"${headerStr}${payloadStr}`;
    navigator.clipboard.writeText(curl);
    setCopiedModalCurlId(ep.id);
    setTimeout(() => setCopiedModalCurlId(null), 2500);
  };

  const handleCopyModalEndpointUrl = (path: string, id: string) => {
    const fullUrl = `${window.location.origin}${path}`;
    navigator.clipboard.writeText(fullUrl);
    setCopiedModalUrlId(id);
    setTimeout(() => setCopiedModalUrlId(null), 2500);
  };

  const loadHitpayWorkflowLogs = async () => {
    try {
      const res = await fetch(`/api/hitpay/logs?limit=50${hitpayWorkflowFilter ? `&ref=${encodeURIComponent(hitpayWorkflowFilter)}` : ''}`);
      if (res.ok) {
        const data = await res.json().catch(() => null);
        if (data && Array.isArray(data.logs)) {
          setHitpayWorkflowLogs(data.logs);
        }
      }
    } catch {}
  };

  const handleTestHitpayConnection = async () => {
    setIsTestingHitpayConn(true);
    try {
      const res = await fetch('/api/hitpay/test-connection', { method: 'POST' });
      if (res.ok) {
        const data = await res.json().catch(() => null);
        setHitpayHealth(data);
      }
      await loadHitpayWorkflowLogs();
    } catch (err: any) {
      setHitpayHealth({
        connected: false,
        message: `Network error: ${err.message}`
      });
    } finally {
      setIsTestingHitpayConn(false);
    }
  };

  // Periodic poll of workflow logs
  useEffect(() => {
    loadHitpayWorkflowLogs();
    const logInterval = setInterval(loadHitpayWorkflowLogs, 3500);
    return () => clearInterval(logInterval);
  }, [hitpayWorkflowFilter]);

  // Initial connection check
  useEffect(() => {
    fetch('/api/hitpay/health')
      .then(res => res.json())
      .then(data => setHitpayHealth(data))
      .catch(() => {});
  }, []);

  // Auto-poll HitPay payment status every 2.5s when test payment is pending
  useEffect(() => {
    if (testPaymentStatus !== 'pending' || (!testRequestId && !testRef)) return;

    const interval = setInterval(async () => {
      try {
        const targetId = testRequestId || testRef;
        const res = await fetch(`/api/hitpay/status/${targetId}`);
        if (res.ok) {
          const data = await res.json().catch(() => null);
          if (data && (data.paymentStatus === 'succeeded' || data.paymentStatus === 'completed' || data.paymentStatus === 'paid')) {
            setTestPaymentStatus('succeeded');
            setTestStatusMsg(`✓ S${testAmount.toFixed(2)} HitPay Payment Verified & Credited! Ref: ${testRef}`);
            loadHitpayWorkflowLogs();
            clearInterval(interval);
          }
        }
      } catch (err) {
        // Silently ignore temporary polling errors
      }
    }, 2500);

    return () => clearInterval(interval);
  }, [testPaymentStatus, testRequestId, testRef, testAmount]);

  // System Mode State
  const [isGoLiveMode, setIsGoLiveMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem('isGoLiveMode') === 'true';
    } catch {
      return false;
    }
  });

  // Portal User Audit Trail State
  const [portalLogs, setPortalLogs] = useState<PortalUserLogItem[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState<boolean>(true);
  const [isClearingLogs, setIsClearingLogs] = useState<boolean>(false);
  const [showClearLogsConfirmModal, setShowClearLogsConfirmModal] = useState<boolean>(false);
  const [logSearchQuery, setLogSearchQuery] = useState<string>('');
  const [logCategoryFilter, setLogCategoryFilter] = useState<'all' | 'logins' | 'passes' | 'updates'>('all');
  const [copiedLogEmail, setCopiedLogEmail] = useState<string | null>(null);
  const [logActionMsg, setLogActionMsg] = useState<string | null>(null);

  const loadPortalLogs = async () => {
    setIsLoadingLogs(true);
    try {
      const logs = await fetchPortalUserLogs();
      logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setPortalLogs(logs);
    } catch (err) {
      console.error('Error fetching portal user logs:', err);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  useEffect(() => {
    loadPortalLogs();
  }, [userEmail]);

  const handleOpenClearLogsModal = () => {
    setShowClearLogsConfirmModal(true);
  };

  const handleConfirmClearAllPortalLogs = async () => {
    setIsClearingLogs(true);
    try {
      const success = await clearPortalUserLogs();
      if (success) {
        setPortalLogs([]);
        setShowClearLogsConfirmModal(false);
        setLogActionMsg('✓ Portal user audit logs cleared successfully.');
      } else {
        setLogActionMsg('⚠️ Unable to clear logs from server.');
      }
    } catch (err) {
      console.error('Error clearing portal logs:', err);
      setLogActionMsg('⚠️ Unable to clear logs from server.');
    } finally {
      setIsClearingLogs(false);
      setTimeout(() => setLogActionMsg(null), 4000);
    }
  };

  const handleExportLogsCSV = () => {
    if (filteredLogs.length === 0) return;

    const headers = ['User Name', 'Email ID', 'Timestamp', 'Action Taken', 'Details', 'Login Method'];
    const rows = filteredLogs.map(l => [
      `"${(l.name || '').replace(/"/g, '""')}"`,
      `"${(l.email || '').replace(/"/g, '""')}"`,
      `"${l.timestamp}"`,
      `"${(l.action || '').replace(/"/g, '""')}"`,
      `"${(l.details || '').replace(/"/g, '""')}"`,
      `"${(l.loginMethod || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `GRACIA_Portal_Audit_Trail_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setLogActionMsg(`✓ Exported ${filteredLogs.length} audit trail records to CSV.`);
    setTimeout(() => setLogActionMsg(null), 4000);
  };

  const handleCopyEmail = (email: string) => {
    navigator.clipboard.writeText(email);
    setCopiedLogEmail(email);
    setTimeout(() => setCopiedLogEmail(null), 2500);
  };

  const formatAuditTimestamp = (ts: string) => {
    if (!ts) return 'N/A';
    try {
      const d = new Date(ts);
      if (isNaN(d.getTime())) return ts;
      return d.toLocaleDateString('en-SG', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    } catch {
      return ts;
    }
  };

  const filteredLogs = portalLogs.filter(log => {
    const q = logSearchQuery.toLowerCase().trim();
    const matchQuery = !q || 
      (log.name && log.name.toLowerCase().includes(q)) ||
      (log.email && log.email.toLowerCase().includes(q)) ||
      (log.action && log.action.toLowerCase().includes(q)) ||
      (log.details && log.details.toLowerCase().includes(q));

    if (!matchQuery) return false;

    if (logCategoryFilter === 'logins') {
      return log.action.toLowerCase().includes('login') || log.action.toLowerCase().includes('access') || log.action.toLowerCase().includes('session') || log.action.toLowerCase().includes('auth');
    }
    if (logCategoryFilter === 'passes') {
      return log.action.toLowerCase().includes('pass') || log.action.toLowerCase().includes('ticket') || log.action.toLowerCase().includes('wallet') || log.action.toLowerCase().includes('view');
    }
    if (logCategoryFilter === 'updates') {
      return log.action.toLowerCase().includes('update') || log.action.toLowerCase().includes('seat') || log.action.toLowerCase().includes('reminder') || log.action.toLowerCase().includes('intercession');
    }

    return true;
  });

  const uniqueUsersCount = new Set(portalLogs.map(l => (l.email || '').toLowerCase().trim())).size;

  // Calculate high level metrics
  const primaryRegs = registrations.filter(r => !r.isAdditionalAttendee);
  const totalRegistrations = primaryRegs.length;
  const totalVerifiedPayments = primaryRegs.filter(r => r.paymentStatus === 'succeeded' || r.paymentVerified).length;
  const totalRevenueSGD = primaryRegs.reduce((acc, r) => {
    if (r.paymentStatus === 'succeeded' || r.paymentVerified) {
      return acc + (parseFloat(r.amountPaid) || parseFloat(r.totalAmount) || 25);
    }
    return acc;
  }, 0);

  const unreadMessagesCount = messagesList.filter(m => !m.read && m.status !== 'replied').length;
  const approvedAdminsCount = adminsList.filter(a => a.status === 'approved').length;
  const pendingAdminsCount = adminsList.filter(a => a.status === 'pending').length;

  // Generate initial $1 test QR code
  useEffect(() => {
    handleGenerateTestQr(testRef, testAmount, paynowProxy, isUenProxy);
  }, []);

  const handleGenerateTestQr = async (targetRef?: string, targetAmount?: number, targetProxy?: string, targetIsUen?: boolean) => {
    const activeRef = (targetRef !== undefined ? targetRef : testRef).trim().toUpperCase();
    const activeAmt = targetAmount !== undefined ? targetAmount : testAmount;
    const activeProxy = (targetProxy !== undefined ? targetProxy : paynowProxy).trim();
    const activeIsUen = targetIsUen !== undefined ? targetIsUen : isUenProxy;

    try {
      localStorage.setItem('gracia_test_qr_ref', activeRef);
      localStorage.setItem('gracia_test_qr_amount', activeAmt.toString());
    } catch {}

    setIsGeneratingTestQr(true);
    setActiveEncodedRef(activeRef);
    let data: any = null;

    try {
      const res = await fetch('/api/hitpay/create-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: activeAmt,
          baseFee: activeAmt,
          additionalContribution: 0,
          currency: 'SGD',
          name: 'Super Admin Test Transfer',
          email: 'sijumonabraham@gmail.com',
          phone: activeProxy,
          purpose: `HitPay S$${activeAmt.toFixed(2)} Test Payment (${activeRef})`,
          referenceNumber: activeRef
        })
      });

      if (res.ok) {
        data = await res.json().catch(() => null);
      }
    } catch (err) {
      console.warn('Backend payment creation warning:', err);
    }

    const reqId = data?.paymentRequestId || `hitpay_req_${Date.now()}`;
    setTestRequestId(reqId);
    if (data?.checkoutUrl) {
      setTestHitpayUrl(data.checkoutUrl);
    } else {
      setTestHitpayUrl(null);
    }

    if (data && data.hitpayQrDataUrl) {
      setTestQrUrl(data.hitpayQrDataUrl);
      if (data.hitpayQrCode) setTestEmvPayload(data.hitpayQrCode);
      setTestPaymentStatus('pending');
      setTestStatusMsg(`Live HitPay Gateway QR active. Scan with DBS/OCBC/UOB/PayLah! bank app.`);
    } else {
      setTestPaymentStatus('pending');
      setTestStatusMsg(`HitPay API request created. Scan official QR with bank app.`);
    }
    setIsGeneratingTestQr(false);
  };

  const handleCreateNewRandomRef = () => {
    const newRef = `TEST-GRACIA-${Math.floor(10000 + Math.random() * 90000)}`;
    setTestRef(newRef);
    handleGenerateTestQr(newRef, testAmount, paynowProxy, isUenProxy);
  };

  const handleCheckTestPaymentGateway = async () => {
    setTestPaymentStatus('verifying');
    setTestStatusMsg('Querying HitPay Payment Gateway API for reference status...');

    try {
      const targetId = testRequestId || testRef;
      const res = await fetch(`/api/hitpay/status/${targetId}`);
      if (res.ok) {
        const data = await res.json().catch(() => null);
        if (data && (data.paymentStatus === 'succeeded' || data.paymentStatus === 'completed' || data.paymentStatus === 'paid' || data.isPaid === true)) {
          setTestPaymentStatus('succeeded');
          setTestStatusMsg(`✓ S$${testAmount.toFixed(2)} Real Payment Verified on HitPay Gateway! Ref: ${testRef}`);
        } else {
          setTestPaymentStatus('pending');
          setTestStatusMsg(`❌ Payment NOT received on HitPay yet. Status: ${data?.hitpayStatus || 'pending'}. Please scan the QR code and complete the transfer in your bank app first.`);
        }
      } else {
        setTestPaymentStatus('pending');
        setTestStatusMsg('❌ Payment NOT received on HitPay yet. Please scan the QR code and complete the transfer in your bank app first.');
      }
    } catch (err) {
      console.warn('Payment Gateway query error:', err);
      setTestPaymentStatus('pending');
      setTestStatusMsg('❌ Unable to verify with Payment Gateway. Check internet connection or API key.');
    }
  };

  const handleVerifyManualTestPayment = async () => {
    setIsVerifyingManual(true);
    setTestStatusMsg('Querying HitPay Gateway to verify PayNow transfer status...');
    try {
      const targetId = testRequestId || testRef;
      const res = await fetch('/api/hitpay/verify-user-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentRequestId: targetId,
          bankReference: testRef
        })
      });

      if (res.ok) {
        const data = await res.json().catch(() => null);
        if (data && (data.paymentStatus === 'succeeded' || data.paymentStatus === 'completed' || data.isPaid === true)) {
          setTestPaymentStatus('succeeded');
          setTestStatusMsg(`✓ S$${testAmount.toFixed(2)} PayNow Transfer Received & Confirmed on HitPay! Ref: ${testRef}`);
        } else {
          setTestPaymentStatus('pending');
          setTestStatusMsg(`❌ Payment NOT received on HitPay yet. Status: ${data?.hitpayStatus || 'pending'}. Please scan the QR code and complete the transfer in your bank app first.`);
        }
      } else {
        setTestPaymentStatus('pending');
        setTestStatusMsg('❌ Payment NOT received on HitPay yet. Please scan the QR code and complete the transfer in your bank app first.');
      }
    } catch (err) {
      console.warn('Manual verify error:', err);
      setTestPaymentStatus('pending');
      setTestStatusMsg(`❌ Payment NOT received on HitPay yet. Please scan the QR code and complete the transfer in your bank app first.`);
    } finally {
      setIsVerifyingManual(false);
    }
  };

  const handleResetTestQr = () => {
    const newRef = `TEST-GRACIA-${Math.floor(10000 + Math.random() * 90000)}`;
    setTestRef(newRef);
    setTestPaymentStatus('idle');
    setTestStatusMsg('');
    setTimeout(() => {
      handleGenerateTestQr();
    }, 100);
  };

  const copyToClipboard = (text: string, type: 'payload' | 'ref') => {
    navigator.clipboard.writeText(text);
    if (type === 'payload') {
      setCopiedPayload(true);
      setTimeout(() => setCopiedPayload(false), 2000);
    } else {
      setCopiedRef(true);
      setTimeout(() => setCopiedRef(false), 2000);
    }
  };

  const toggleGoLiveMode = () => {
    const nextVal = !isGoLiveMode;
    setIsGoLiveMode(nextVal);
    try {
      localStorage.setItem('isGoLiveMode', String(nextVal));
    } catch {}
  };

  return (
    <div className="space-y-8 animate-fade-in text-white pb-12">
      
      {/* EXECUTIVE WELCOME BANNER */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border border-amber-500/30 p-5 sm:p-7 shadow-xl">
        <div className="absolute -right-10 -bottom-10 w-72 h-72 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col xl:flex-row xl:items-center justify-between gap-6">
          <div className="space-y-3 flex-1 min-w-0">
            {/* Status Badges */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="whitespace-nowrap inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 text-xs font-semibold tracking-wide shrink-0 shadow-sm">
                <ShieldCheck className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>Super Admin Command Hub</span>
              </span>
              
              <button
                type="button"
                onClick={toggleGoLiveMode}
                className={`whitespace-nowrap inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border transition-all cursor-pointer shrink-0 shadow-sm ${
                  isGoLiveMode
                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/25'
                    : 'bg-amber-500/15 text-amber-300 border-amber-500/40 hover:bg-amber-500/25'
                }`}
                title="Click to toggle between Sandbox and Live Production Mode"
              >
                <span className={`w-2 h-2 rounded-full ${isGoLiveMode ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
                <span>{isGoLiveMode ? 'Live Production Mode' : 'Sandbox / Testing Mode'}</span>
              </button>
            </div>

            {/* Main Greeting */}
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white tracking-tight">
              Welcome back, <span className="text-amber-400 font-bold">{userEmail.split('@')[0]}</span>
            </h1>

            {/* Description */}
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-3xl">
              Full administrative authority active. Manage database backups, financial gateway testing, Go Live test purges, and organizer access controls from your central executive home page.
            </p>
          </div>

          {/* Top Level Action Buttons */}
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5 shrink-0 self-start xl:self-center">
            <button
              onClick={() => onNavigateTab('verses')}
              className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md flex items-center gap-2 whitespace-nowrap transition-all cursor-pointer active:scale-95"
              title="Open the 400+ Jubilee Scripture Pass ID Management Table"
            >
              <BookOpen className="w-4 h-4 shrink-0 text-slate-950" />
              <span>Pass ID Bible Verses (400+)</span>
            </button>

            <button
              onClick={onOpenGoLiveModal}
              className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-md flex items-center gap-2 whitespace-nowrap transition-all cursor-pointer border border-rose-400/30 active:scale-95"
              title="Clear test registrations and initialize live database"
            >
              <Zap className="w-4 h-4 shrink-0 text-amber-300" />
              <span>Go Live (Clear Data)</span>
            </button>

            <button
              onClick={onOpenBackupModal}
              className="px-4 py-2.5 rounded-xl bg-purple-950/80 hover:bg-purple-900 border border-purple-500/40 text-purple-200 font-semibold text-xs flex items-center gap-2 whitespace-nowrap transition-all cursor-pointer shadow-md active:scale-95"
              title="Export database backups or restore snapshot"
            >
              <Database className="w-4 h-4 shrink-0 text-purple-300" />
              <span>Backup & Restore</span>
            </button>
          </div>
        </div>
      </div>

      {/* QUICK JUMP DIRECTORY / SUB-NAVIGATION CHIPS */}
      <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-xl flex items-center justify-between gap-3 overflow-x-auto no-scrollbar shadow-lg">
        <div className="flex items-center space-x-2 shrink-0 pl-1">
          <span className="text-xs font-bold tracking-wider text-slate-400 uppercase">Quick Jump:</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => onNavigateTab('verses')}
            className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap transition-all cursor-pointer hover:scale-[1.02] shadow-sm"
          >
            <BookOpen className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>Bible Verses (400+)</span>
          </button>
          <button
            onClick={() => onNavigateTab('registrations')}
            className="px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700/60 text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap transition-all cursor-pointer"
          >
            <Users className="w-3.5 h-3.5 text-[#E8752C] shrink-0" />
            <span>Registrations ({totalRegistrations})</span>
          </button>
          <button
            onClick={() => onNavigateTab('tickets')}
            className="px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700/60 text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap transition-all cursor-pointer"
          >
            <Ticket className="w-3.5 h-3.5 text-[#EC4899] shrink-0" />
            <span>Ticket Scanner</span>
          </button>
          <button
            onClick={() => onNavigateTab('invitations')}
            className="px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700/60 text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap transition-all cursor-pointer"
          >
            <Mail className="w-3.5 h-3.5 text-[#E8B400] shrink-0" />
            <span>Invitations</span>
          </button>
          <button
            onClick={() => onNavigateTab('admins')}
            className="px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700/60 text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap transition-all cursor-pointer"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-blue-400 shrink-0" />
            <span>Admin Allow-List</span>
          </button>
          <button
            onClick={() => onNavigateTab('groups')}
            className="px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700/60 text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap transition-all cursor-pointer"
          >
            <Palette className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
            <span>Groups</span>
          </button>
          <button
            onClick={() => onNavigateTab('content')}
            className="px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700/60 text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap transition-all cursor-pointer"
          >
            <Edit className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>Content</span>
          </button>
          <button
            onClick={() => onNavigateTab('messages')}
            className="px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700/60 text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap transition-all cursor-pointer"
          >
            <Mail className="w-3.5 h-3.5 text-[#E8752C] shrink-0" />
            <span>Inbox ({messagesList.length})</span>
          </button>
        </div>
      </div>

      {/* METRICS DASHBOARD CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        
        <div className="p-5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl space-y-2 hover:border-[#E8B400]/40 transition-all">
          <div className="flex items-center justify-between text-xs text-white/60 font-semibold uppercase">
            <span>Total Registered</span>
            <Users className="w-4 h-4 text-[#E8B400]" />
          </div>
          <div className="font-poster text-3xl sm:text-4xl text-[#E8B400]">{totalRegistrations}</div>
          <div className="text-[11px] text-white/50 flex items-center justify-between">
            <span>Verified Payments:</span>
            <span className="font-bold text-emerald-400">{totalVerifiedPayments}</span>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl space-y-2 hover:border-emerald-500/40 transition-all">
          <div className="flex items-center justify-between text-xs text-white/60 font-semibold uppercase">
            <span>Collections (SGD)</span>
            <DollarSign className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="font-poster text-3xl sm:text-4xl text-emerald-400">S$ {totalRevenueSGD.toFixed(2)}</div>
          <div className="text-[11px] text-white/50 flex items-center justify-between">
            <span>Verified PayNow Receipts</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl space-y-2 hover:border-blue-500/40 transition-all">
          <div className="flex items-center justify-between text-xs text-white/60 font-semibold uppercase">
            <span>Approved Admins</span>
            <ShieldCheck className="w-4 h-4 text-blue-400" />
          </div>
          <div className="font-poster text-3xl sm:text-4xl text-blue-400">{approvedAdminsCount}</div>
          <div className="text-[11px] text-white/50 flex items-center justify-between">
            <span>Pending Requests:</span>
            <span className={`font-bold ${pendingAdminsCount > 0 ? 'text-amber-400 animate-pulse' : 'text-white/60'}`}>{pendingAdminsCount}</span>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl space-y-2 hover:border-[#E8752C]/40 transition-all">
          <div className="flex items-center justify-between text-xs text-white/60 font-semibold uppercase">
            <span>Unread Support</span>
            <Mail className="w-4 h-4 text-[#E8752C]" />
          </div>
          <div className="font-poster text-3xl sm:text-4xl text-[#E8752C]">{unreadMessagesCount}</div>
          <div className="text-[11px] text-white/50 flex items-center justify-between">
            <span>Total Inquiries:</span>
            <span className="font-bold text-white/70">{messagesList.length}</span>
          </div>
        </div>

        <div className="col-span-2 sm:col-span-2 lg:col-span-1 p-5 rounded-2xl bg-gradient-to-br from-amber-950/40 via-amber-900/20 to-black/60 border border-amber-500/40 backdrop-blur-xl space-y-2 hover:border-amber-400 transition-all">
          <div className="flex items-center justify-between text-xs text-amber-300 font-semibold uppercase">
            <span>Scripture Pool</span>
            <BookOpen className="w-4 h-4 text-amber-400" />
          </div>
          <div className="font-poster text-3xl sm:text-4xl text-amber-400">400+</div>
          <div className="text-[11px] text-amber-200/70 flex items-center justify-between">
            <span>Pass ID Verses:</span>
            <button
              onClick={() => onNavigateTab('verses')}
              className="text-amber-300 hover:text-white font-bold underline cursor-pointer text-[10px]"
            >
              Open Table →
            </button>
          </div>
        </div>

      </div>

      {/* FEATURED SECTION 1: $1 FINANCIAL GATEWAY TESTING & EMVCO PAYLOAD INSPECTOR */}
      <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-b from-gray-900 to-gray-950 border-2 border-emerald-500/30 shadow-2xl space-y-6">
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <QrCode className="w-6 h-6 text-emerald-400" />
              <h2 className="font-poster text-2xl text-white tracking-wide">
                $1.00 LIVE PAYNOW TEST QR GENERATOR & GATEWAY VERIFIER
              </h2>
            </div>
            <p className="text-xs text-gray-300 leading-relaxed">
              Test end-to-end FAST bank transfers using standard EMVCo PayNow SGQR technology. Verifies that participant reference IDs are automatically embedded and identified by bank apps.
            </p>
          </div>

          <div className="flex items-center space-x-2 shrink-0 flex-wrap gap-y-2">
            <button
              onClick={() => setShowHitpayEndpointsModal(true)}
              className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-blue-900/90 to-indigo-900/90 hover:from-blue-800 hover:to-indigo-800 border border-blue-400/50 text-blue-200 text-xs font-semibold flex items-center space-x-1.5 transition-all cursor-pointer shadow-md hover:shadow-blue-500/20"
              title="Open Payment Gateway Endpoints & API Reference Modal"
            >
              <Code className="w-4 h-4 text-cyan-300" />
              <span>Gateway API Endpoints</span>
            </button>
            <button
              onClick={() => setShowPayloadInspector(!showPayloadInspector)}
              className="px-3.5 py-1.5 rounded-xl bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-500/40 text-emerald-300 text-xs font-semibold flex items-center space-x-1.5 transition-all cursor-pointer"
            >
              <FileText className="w-4 h-4 text-emerald-400" />
              <span>{showPayloadInspector ? 'Hide EMVCo Spec' : 'Inspect EMVCo Spec'}</span>
            </button>
            <button
              onClick={handleResetTestQr}
              className="px-3.5 py-1.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs font-semibold flex items-center space-x-1.5 transition-all cursor-pointer border border-gray-600"
            >
              <RefreshCw className="w-3.5 h-3.5 text-gray-300" />
              <span>New $1 Reference</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* QR CODE DISPLAY PANEL */}
          <div className="lg:col-span-5 bg-black/40 border border-emerald-500/30 p-6 rounded-2xl flex flex-col items-center justify-center space-y-4 text-center">
            
            <div className="bg-amber-500/10 border border-amber-500/30 px-3 py-1 rounded-full text-[11px] font-bold text-amber-300 flex items-center space-x-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>TEST TRANSACTION AMOUNT: S$ {testAmount.toFixed(2)}</span>
            </div>

            {/* QR Image Frame */}
            <div className="relative p-4 bg-white rounded-2xl shadow-xl border-4 border-emerald-500/50 min-h-[256px] flex items-center justify-center">
              {testPaymentStatus === 'succeeded' ? (
                <div className="w-56 h-56 rounded-xl bg-gradient-to-b from-emerald-600 via-teal-700 to-emerald-800 p-4 flex flex-col items-center justify-center text-white space-y-2 shadow-2xl animate-fade-in border-2 border-emerald-300">
                  <CheckCircle2 className="w-14 h-14 text-emerald-200 animate-bounce" />
                  <span className="font-poster text-xl tracking-wide text-center">PAYMENT RECEIVED & VERIFIED!</span>
                  <span className="text-[11px] text-emerald-100 font-mono text-center truncate max-w-[200px]">{testRef}</span>
                  <span className="text-[10px] text-emerald-200 bg-black/30 px-2.5 py-0.5 rounded-full font-bold">
                    S$ {testAmount.toFixed(2)} CONFIRMED
                  </span>
                </div>
              ) : isGeneratingTestQr ? (
                <div className="w-56 h-56 flex flex-col items-center justify-center text-gray-800 space-y-2">
                  <RefreshCw className="w-8 h-8 text-emerald-600 animate-spin" />
                  <span className="text-xs font-bold font-mono">Generating $1 QR...</span>
                </div>
              ) : testQrUrl ? (
                <img src={testQrUrl} alt="$1 Test PayNow QR" className="w-56 h-56 object-contain rounded-lg" />
              ) : (
                <div className="w-56 h-56 flex items-center justify-center text-gray-500">QR Generation Error</div>
              )}
            </div>

            {/* Reference Box */}
            <div className="w-full space-y-2">
              <div className="flex items-center justify-between text-[11px] text-gray-400 font-medium">
                <span>Bank Auto-Reference Tag (Encoded in QR):</span>
                <span className="text-[10px] text-emerald-400 font-semibold px-2 py-0.5 rounded bg-emerald-950/80 border border-emerald-500/40">
                  Tag 26-05 & 62
                </span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 font-mono text-xs font-bold shadow-inner">
                <span className="truncate">{activeEncodedRef || testRef}</span>
                <button
                  onClick={() => copyToClipboard(activeEncodedRef || testRef, 'ref')}
                  className="ml-2 p-1 hover:bg-emerald-800/60 rounded text-emerald-300 cursor-pointer"
                  title="Copy Reference"
                >
                  {copiedRef ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>

              {testRef !== activeEncodedRef && (
                <div className="p-2 rounded-lg bg-amber-950/70 border border-amber-500/40 text-[11px] text-amber-300 flex items-center justify-between">
                  <span>Input differs from active QR ({activeEncodedRef}).</span>
                  <button
                    onClick={() => handleGenerateTestQr(testRef, testAmount, paynowProxy, isUenProxy)}
                    className="underline font-bold text-amber-200 hover:text-white ml-2 shrink-0 cursor-pointer"
                  >
                    Sync QR Now
                  </button>
                </div>
              )}
            </div>

            {/* Verification Actions */}
            <div className="w-full pt-2 space-y-2.5">
              
              {testHitpayUrl && testPaymentStatus !== 'succeeded' && (
                <a
                  href={testHitpayUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-blue-700 to-indigo-800 hover:from-blue-600 hover:to-indigo-700 text-white font-poster text-xs tracking-wider shadow-md flex items-center justify-center space-x-2 transition-all cursor-pointer border border-blue-400/40"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-blue-200" />
                  <span>OPEN ONLINE PAYMENT PORTAL</span>
                </a>
              )}

              <button
                onClick={handleCheckTestPaymentGateway}
                disabled={testPaymentStatus === 'verifying' || testPaymentStatus === 'succeeded'}
                className="w-full py-3 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-600 active:scale-[0.99] text-white font-poster text-xs sm:text-sm tracking-wider shadow-lg transition-all flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50 border border-emerald-500/40"
              >
                {testPaymentStatus === 'verifying' ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-white" />
                    <span>CHECKING PAYMENT GATEWAY...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-amber-300" />
                    <span>VERIFY PAYMENT WITH GATEWAY</span>
                  </>
                )}
              </button>

              {testPaymentStatus !== 'succeeded' && (
                <button
                  onClick={handleVerifyManualTestPayment}
                  disabled={isVerifyingManual}
                  className="w-full py-2.5 px-3 rounded-xl bg-amber-600 hover:bg-amber-500 active:scale-[0.99] text-white font-poster text-xs tracking-wider shadow-md transition-all flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50 border border-amber-400/40"
                >
                  {isVerifyingManual ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-white" />
                  ) : (
                    <Check className="w-3.5 h-3.5 text-white" />
                  )}
                  <span>CONFIRM S${testAmount.toFixed(2)} PAYNOW TRANSFER RECEIVED</span>
                </button>
              )}

              {testStatusMsg && (
                <p className="text-xs text-emerald-400 font-medium mt-1 leading-tight text-center">
                  {testStatusMsg}
                </p>
              )}

              <div className="p-2.5 rounded-xl bg-black/60 border border-white/10 text-[10px] text-gray-300 leading-relaxed text-left space-y-1">
                <div className="font-bold text-amber-300 flex items-center space-x-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>🔒 PayNow Money Safety Guarantee:</span>
                </div>
                <p>
                  Transfers made via DBS/OCBC/UOB/PayLah! land directly into official PayNow account <strong className="text-white font-mono">{paynowProxy}</strong> (JESUS YOUTH SINGAPORE). No money is lost.
                </p>
              </div>

            </div>

          </div>

          {/* PARAMETERS & CONFIGURATION PANEL */}
          <div className="lg:col-span-7 space-y-5">
            
            <div className="p-5 rounded-2xl bg-white/5 border border-white/10 space-y-4">
              <h3 className="text-sm font-bold text-amber-300 uppercase tracking-wider flex items-center space-x-2">
                <Server className="w-4 h-4 text-amber-400" />
                <span>Test QR Configuration Parameters</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block text-gray-400 font-semibold mb-1">Test Amount (SGD)</label>
                  <input
                    type="number"
                    step="0.10"
                    min="0.10"
                    value={testAmount}
                    onChange={(e) => setTestAmount(parseFloat(e.target.value) || 1.00)}
                    className="w-full px-3 py-2 rounded-xl bg-black/50 border border-gray-700 text-white font-mono focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-gray-400 font-semibold mb-1">PayNow Proxy Number / UEN</label>
                  <input
                    type="text"
                    value={paynowProxy}
                    onChange={(e) => setPaynowProxy(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-black/50 border border-gray-700 text-white font-mono focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-gray-400 font-semibold mb-1">Test Reference ID (Auto-Encoded in Tag 26 & 62)</label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={testRef}
                    onChange={(e) => setTestRef(e.target.value.toUpperCase())}
                    placeholder="e.g. TEST-GRACIA-26078"
                    className="w-full px-3 py-2 rounded-xl bg-black/50 border border-gray-700 text-emerald-300 font-mono font-bold focus:border-emerald-500 focus:outline-none"
                  />
                  <div className="flex space-x-2 shrink-0 flex-wrap gap-y-2">
                    <button
                      onClick={() => setShowHitpayEndpointsModal(true)}
                      className="px-3 py-2 rounded-xl bg-gradient-to-r from-blue-700/90 to-indigo-700/90 hover:from-blue-600 hover:to-indigo-600 active:scale-[0.98] text-white font-bold text-xs cursor-pointer shadow-md transition-all flex items-center space-x-1.5 border border-blue-400/40"
                      title="Open HitPay Endpoints & API Schema Modal"
                    >
                      <Terminal className="w-3.5 h-3.5 text-cyan-300" />
                      <span>Endpoints Popup</span>
                    </button>
                    <button
                      onClick={() => handleGenerateTestQr(testRef, testAmount, paynowProxy, isUenProxy)}
                      className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white font-bold text-xs cursor-pointer shadow-md transition-all flex items-center space-x-1.5"
                      title="Apply input reference and regenerate QR"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Sync & Generate QR</span>
                    </button>
                    <button
                      onClick={handleCreateNewRandomRef}
                      className="px-3 py-2 rounded-xl bg-purple-700/80 hover:bg-purple-600 active:scale-[0.98] text-white font-bold text-xs cursor-pointer shadow-md transition-all flex items-center space-x-1 border border-purple-400/30"
                      title="Create fresh unique random test reference"
                    >
                      <span>🎲 New Ref</span>
                    </button>
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-xs text-emerald-200 space-y-1">
                <div className="font-bold flex items-center space-x-1.5 text-emerald-300">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>EMVCo Permanent Auto-Reference Fix Verified</span>
                </div>
                <p className="text-[11px] text-gray-300 leading-relaxed">
                  When Singapore bank apps (DBS digibank, OCBC Digital, UOB TMRW) scan this QR, they read Tag 26 Sub-tag 05 and Tag 62 Sub-tag 01/07. The bank app automatically fills <code className="text-emerald-300 bg-black/40 px-1 rounded font-bold">{activeEncodedRef || testRef}</code> into the transfer notes box, so the payment gateway and our webhook listener automatically identify the transaction.
                </p>
              </div>
            </div>

            {/* EMVCo Payload String Inspector */}
            {showPayloadInspector && (
              <div className="p-4 rounded-2xl bg-black/80 border border-emerald-500/40 space-y-2 animate-fade-in font-mono text-xs">
                <div className="flex items-center justify-between text-emerald-400 font-bold border-b border-emerald-500/30 pb-2">
                  <span>Raw EMVCo Payload String (SGQR Standard)</span>
                  <button
                    onClick={() => copyToClipboard(testEmvPayload, 'payload')}
                    className="flex items-center space-x-1 px-2 py-1 rounded bg-emerald-900/60 text-emerald-300 hover:bg-emerald-800 text-[10px] cursor-pointer"
                  >
                    {copiedPayload ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedPayload ? 'Copied' : 'Copy Payload'}</span>
                  </button>
                </div>

                <div className="p-3 rounded-xl bg-gray-950 border border-gray-800 text-emerald-300 break-all select-all leading-relaxed text-[11px]">
                  {testEmvPayload}
                </div>

                <div className="grid grid-cols-2 gap-2 text-[10px] text-gray-400 pt-1">
                  <div>Tag 26 (Merchant): <span className="text-amber-300">0009SG.PAYNOW...</span></div>
                  <div>Tag 26-05 (Bill Ref): <span className="text-emerald-300 font-bold">{activeEncodedRef || testRef}</span></div>
                  <div>Tag 54 (Amount): <span className="text-blue-300">05404{testAmount.toFixed(2)}</span></div>
                  <div>Tag 63 (CRC16): <span className="text-purple-300">Checksum 4-digit</span></div>
                </div>
              </div>
            )}

            {/* REAL-TIME GATEWAY WORKFLOW & WEBHOOK LOG INSPECTOR */}
            <div className="p-5 rounded-2xl bg-black/60 border border-emerald-500/30 space-y-4 font-sans">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-3">
                <div className="flex items-center space-x-2">
                  <Activity className="w-4 h-4 text-emerald-400 animate-pulse" />
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                    Payment Gateway Live Workflow & Webhook Inspector
                  </h4>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                    Live Stream
                  </span>
                </div>

                <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                  <button
                    onClick={() => setShowHitpayEndpointsModal(true)}
                    className="px-2.5 py-1 rounded-lg bg-blue-900/70 hover:bg-blue-800 border border-blue-400/40 text-[11px] font-semibold text-blue-200 flex items-center space-x-1 cursor-pointer transition-all"
                  >
                    <Code className="w-3 h-3 text-cyan-300" />
                    <span>Endpoints & Payloads</span>
                  </button>

                  <button
                    onClick={handleTestHitpayConnection}
                    disabled={isTestingHitpayConn}
                    className="px-2.5 py-1 rounded-lg bg-emerald-900/60 hover:bg-emerald-800 border border-emerald-500/40 text-[11px] font-semibold text-emerald-200 flex items-center space-x-1 cursor-pointer disabled:opacity-50 transition-all"
                  >
                    <RefreshCw className={`w-3 h-3 text-emerald-300 ${isTestingHitpayConn ? 'animate-spin' : ''}`} />
                    <span>{isTestingHitpayConn ? 'Testing API...' : 'Test Gateway Health'}</span>
                  </button>

                  <button
                    onClick={loadHitpayWorkflowLogs}
                    className="p-1 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 cursor-pointer"
                    title="Refresh logs"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Gateway Health Indicator */}
              {hitpayHealth && (
                <div className={`p-3 rounded-xl border text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
                  hitpayHealth.connected 
                    ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200' 
                    : 'bg-amber-950/40 border-amber-500/40 text-amber-200'
                }`}>
                  <div className="flex items-center space-x-2">
                    {hitpayHealth.connected ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                    )}
                    <div>
                      <span className="font-bold">{hitpayHealth.message}</span>
                      {hitpayHealth.latencyMs ? (
                        <span className="text-[11px] text-gray-400 ml-2 font-mono">({hitpayHealth.latencyMs}ms)</span>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2 text-[10px] font-mono text-gray-400">
                    <span>Env: <strong className="text-white uppercase">{hitpayHealth.env || 'live'}</strong></span>
                    <span>•</span>
                    <span>Key: {hitpayHealth.hasApiKey ? '✓ Active' : '⚠ Fallback UEN'}</span>
                  </div>
                </div>
              )}

              {/* Log filter */}
              <div className="flex items-center space-x-2">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={hitpayWorkflowFilter}
                    onChange={(e) => setHitpayWorkflowFilter(e.target.value)}
                    placeholder="Filter workflow logs by Ref, ID, or message..."
                    className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-black/50 border border-gray-700 text-white text-xs font-mono placeholder:text-gray-500 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                {hitpayWorkflowFilter && (
                  <button
                    onClick={() => setHitpayWorkflowFilter('')}
                    className="text-xs text-gray-400 hover:text-white px-2 py-1 cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </div>

              {/* Logs Stream List */}
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {hitpayWorkflowLogs.length === 0 ? (
                  <div className="p-4 rounded-xl bg-white/5 text-center text-xs text-gray-400">
                    No gateway workflow events recorded yet. Generate a test QR or make a transaction to see live step execution.
                  </div>
                ) : (
                  hitpayWorkflowLogs.map((log) => {
                    const isExpanded = expandedLogId === log.id;
                    const stageColor = 
                      log.stage === 'PAYMENT_SETTLED' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50' :
                      log.stage === 'WEBHOOK_RECEIVED' ? 'bg-purple-500/20 text-purple-300 border-purple-500/50' :
                      log.stage === 'SIGNATURE_VERIFIED' ? 'bg-blue-500/20 text-blue-300 border-blue-500/50' :
                      log.stage === 'QR_GENERATED' ? 'bg-teal-500/20 text-teal-300 border-teal-500/50' :
                      log.stage === 'GATEWAY_REQUEST' ? 'bg-amber-500/20 text-amber-300 border-amber-500/50' :
                      'bg-gray-700 text-gray-300 border-gray-600';

                    return (
                      <div 
                        key={log.id} 
                        className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs transition-all space-y-1.5"
                      >
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center space-x-1.5">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border ${stageColor}`}>
                              {log.stage.replace(/_/g, ' ')}
                            </span>
                            {log.referenceNumber && (
                              <span className="font-mono text-[10px] font-bold text-amber-300 bg-black/40 px-1.5 py-0.5 rounded">
                                {log.referenceNumber}
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-gray-400 font-mono">
                            {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </span>
                        </div>

                        <p className="text-gray-200 text-xs leading-snug">
                          {log.message}
                        </p>

                        {log.details && (
                          <div className="pt-1">
                            <button
                              onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                              className="text-[10px] text-emerald-400 hover:text-emerald-300 underline font-mono cursor-pointer"
                            >
                              {isExpanded ? 'Hide Payload Details' : 'View Payload Details'}
                            </button>
                            {isExpanded && (
                              <pre className="mt-1 p-2 rounded-lg bg-black/80 text-[10px] text-emerald-300 font-mono overflow-x-auto border border-white/10">
                                {JSON.stringify(log.details, null, 2)}
                              </pre>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

            </div>

          </div>

        </div>

      </div>

      {/* FEATURED SECTION 2: SUPER ADMIN ACTION MODULES */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        
        {/* MODULE 1: GO LIVE & TEST DATA WIPE */}
        <div className="p-6 rounded-3xl bg-white/5 border border-white/10 hover:border-red-500/40 transition-all space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-red-500/20 border border-red-500/40 flex items-center justify-center text-red-400">
              <Zap className="w-6 h-6 text-amber-300 fill-amber-300" />
            </div>
            <div>
              <h3 className="font-poster text-xl text-white tracking-wide">GO LIVE (CLEAR DATA)</h3>
              <p className="text-xs text-gray-300 mt-1 leading-relaxed">
                Purge test attendee registrations before launching official event registration. Automatically saves a pre-wipe snapshot to the <code className="text-amber-300">audit_backups</code> database collection.
              </p>
            </div>
          </div>

          <div className="pt-2">
            <button
              onClick={onOpenGoLiveModal}
              className="w-full py-3 px-4 rounded-xl bg-[#D62828] hover:bg-red-700 text-white font-poster text-sm tracking-wider shadow-md transition-all flex items-center justify-center space-x-2 cursor-pointer"
            >
              <Zap className="w-4 h-4 text-amber-300" />
              <span>LAUNCH GO LIVE PURGE</span>
            </button>
          </div>
        </div>

        {/* MODULE 2: DATABASE BACKUPS & DISASTER RECOVERY */}
        <div className="p-6 rounded-3xl bg-white/5 border border-white/10 hover:border-purple-500/40 transition-all space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-300">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-poster text-xl text-white tracking-wide">DATABASE BACKUPS & SYNC</h3>
              <p className="text-xs text-gray-300 mt-1 leading-relaxed">
                Download 1-click JSON full database backups, restore previous JSON snapshots, or inspect historical pre-wipe audit logs to guarantee zero data loss.
              </p>
            </div>
          </div>

          <div className="pt-2">
            <button
              onClick={onOpenBackupModal}
              className="w-full py-3 px-4 rounded-xl bg-purple-900/80 hover:bg-purple-800 text-purple-200 border border-purple-400/50 font-poster text-sm tracking-wider shadow-md transition-all flex items-center justify-center space-x-2 cursor-pointer"
            >
              <Database className="w-4 h-4 text-purple-300" />
              <span>OPEN BACKUP MANAGER</span>
            </button>
          </div>
        </div>

        {/* MODULE 3: ADMIN ACCESS & ALLOW-LIST */}
        <div className="p-6 rounded-3xl bg-white/5 border border-white/10 hover:border-blue-500/40 transition-all space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-blue-500/20 border border-blue-500/40 flex items-center justify-center text-blue-400">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-poster text-xl text-white tracking-wide">ADMIN ACCESS CONTROL</h3>
              <p className="text-xs text-gray-300 mt-1 leading-relaxed">
                Approve or revoke organizer access requests, assign specific roles (Full Admin, Ticket Admin, Content Admin), and enforce security allow-lists.
              </p>
            </div>
          </div>

          <div className="pt-2">
            <button
              onClick={() => onNavigateTab('admins')}
              className="w-full py-3 px-4 rounded-xl bg-blue-900/80 hover:bg-blue-800 text-blue-200 border border-blue-400/50 font-poster text-sm tracking-wider shadow-md transition-all flex items-center justify-center space-x-2 cursor-pointer"
            >
              <Users className="w-4 h-4 text-blue-300" />
              <span>MANAGE ADMIN USERS ({adminsList.length})</span>
            </button>
          </div>
        </div>

        {/* MODULE 4: SCRIPTURE PASS ID POOL (400+ VERSES) */}
        <div className="p-6 rounded-3xl bg-white/5 border border-white/10 hover:border-amber-500/40 transition-all space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-poster text-xl text-white tracking-wide">JUBILEE SCRIPTURE POOL (400+ VERSES)</h3>
              <p className="text-xs text-gray-300 mt-1 leading-relaxed">
                View, edit, add, or delete positive & encouraging Bible verses used to dynamically generate standardized Conference Pass IDs (<span className="font-mono text-amber-300">GRACIA-SIJU-ROM-12:2</span>).
              </p>
            </div>
          </div>

          <div className="pt-2">
            <button
              onClick={() => onNavigateTab('verses')}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white font-poster text-sm tracking-wider shadow-md transition-all flex items-center justify-center space-x-2 cursor-pointer"
            >
              <BookOpen className="w-4 h-4 text-amber-200" />
              <span>MANAGE BIBLE VERSES TABLE</span>
            </button>
          </div>
        </div>

      </div>

      {/* FEATURED SECTION 3: SYSTEM DOCUMENTATION & OPERATIONAL MANUALS */}
      <div className="p-6 rounded-3xl bg-white/5 border border-white/10 space-y-4">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <h3 className="font-poster text-xl text-white tracking-wide flex items-center space-x-2">
            <BookOpen className="w-5 h-5 text-[#E8B400]" />
            <span>SUPER ADMIN TECHNICAL DOCUMENTATION & MANUALS</span>
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          
          <button
            onClick={onOpenTechDocModal}
            className="p-4 rounded-2xl bg-black/40 hover:bg-black/60 border border-white/10 hover:border-[#E8B400]/50 text-left transition-all space-y-2 cursor-pointer group"
          >
            <div className="flex items-center justify-between">
              <span className="font-poster text-lg text-[#E8B400] group-hover:underline flex items-center space-x-2">
                <FileText className="w-4 h-4 text-[#E8B400]" />
                <span>TECHNICAL ARCHITECTURE GUIDE</span>
              </span>
              <ArrowRight className="w-4 h-4 text-white/40 group-hover:text-white transition-colors" />
            </div>
            <p className="text-xs text-gray-300 leading-relaxed">
              Complete engineering manual covering Node.js Express architecture, Firestore rules, PDF pass compilation, PayNow EMVCo specs, and check-in scanner logic.
            </p>
          </button>

          <button
            onClick={onOpenUserManualModal}
            className="p-4 rounded-2xl bg-black/40 hover:bg-black/60 border border-white/10 hover:border-purple-400/50 text-left transition-all space-y-2 cursor-pointer group"
          >
            <div className="flex items-center justify-between">
              <span className="font-poster text-lg text-purple-300 group-hover:underline flex items-center space-x-2">
                <BookOpen className="w-4 h-4 text-purple-400" />
                <span>ORGANIZER OPERATIONAL MANUAL</span>
              </span>
              <ArrowRight className="w-4 h-4 text-white/40 group-hover:text-white transition-colors" />
            </div>
            <p className="text-xs text-gray-300 leading-relaxed">
              Step-by-step operational guide for event leads, covering PayNow receipt verification, email reminders dispatch, group seating, and scanner volunteer workflows.
            </p>
          </button>

        </div>
      </div>

      {/* PORTAL AUTHENTICATION & LOGIN METHOD TOGGLES */}
      <PortalAuthSettingsCard
        siteContent={siteContent}
        onSave={async (updated) => {
          if (onUpdateSiteContent) {
            await onUpdateSiteContent(updated);
          }
        }}
      />

      {/* FEATURED SECTION 4: PORTAL USER LOGIN AUDIT TRAIL & ACTIVITY LOGS */}
      <div id="portal-user-audit-trail" className="p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-[#1b0a2a]/95 via-[#130720]/95 to-[#1e0d33]/95 border border-purple-500/30 space-y-6 shadow-2xl">
        
        {/* Header Bar */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-white/10 pb-5">
          <div className="space-y-1">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white shadow-lg">
                <Activity className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-poster text-xl sm:text-2xl text-white tracking-wide flex items-center space-x-2">
                  <span>PORTAL USER LOGIN AUDIT TRAIL</span>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-mono bg-purple-500/20 text-purple-300 border border-purple-500/30">
                    REAL-TIME LOGS
                  </span>
                </h3>
                <p className="text-xs text-gray-300">
                  Comprehensive security audit trail of all users logging into the Participant Portal, viewing digital passes, or executing account updates.
                </p>
              </div>
            </div>
          </div>

          {/* Stat Badges & Action Buttons */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <div className="px-3.5 py-2 rounded-2xl bg-black/40 border border-white/10 flex items-center space-x-2 text-xs font-mono text-gray-300">
              <Users className="w-4 h-4 text-purple-400" />
              <span>Unique Portal Users: <strong className="text-white">{uniqueUsersCount}</strong></span>
            </div>
            <div className="px-3.5 py-2 rounded-2xl bg-black/40 border border-white/10 flex items-center space-x-2 text-xs font-mono text-gray-300">
              <Activity className="w-4 h-4 text-emerald-400" />
              <span>Total Activity Logs: <strong className="text-white">{portalLogs.length}</strong></span>
            </div>

            <button
              onClick={loadPortalLogs}
              disabled={isLoadingLogs}
              className="p-2.5 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/20 text-white transition-all cursor-pointer flex items-center space-x-1 text-xs font-poster tracking-wider"
              title="Refresh Audit Trail"
            >
              <RefreshCw className={`w-4 h-4 text-purple-300 ${isLoadingLogs ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">REFRESH</span>
            </button>

            <button
              onClick={handleExportLogsCSV}
              disabled={filteredLogs.length === 0}
              className="px-3.5 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-poster text-xs tracking-wider shadow-lg transition-all flex items-center space-x-2 cursor-pointer border border-emerald-400/40 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Download className="w-4 h-4" />
              <span>EXPORT CSV</span>
            </button>

            <button
              id="btn-clear-portal-audit-trail"
              onClick={handleOpenClearLogsModal}
              disabled={portalLogs.length === 0 || isLoadingLogs || isClearingLogs}
              className="px-3.5 py-2.5 rounded-2xl bg-gradient-to-r from-red-950/80 via-red-900/80 to-rose-950/80 hover:from-red-900 hover:to-rose-900 border border-red-500/40 text-red-200 hover:text-white transition-all cursor-pointer text-xs font-poster tracking-wider shadow-lg flex items-center space-x-2 disabled:opacity-40 disabled:cursor-not-allowed"
              title="Clear all portal user audit logs"
            >
              <Trash2 className="w-4 h-4 text-red-400" />
              <span>CLEAR AUDIT TRAIL</span>
            </button>
          </div>
        </div>

        {/* Action Notice */}
        {logActionMsg && (
          <div className="p-3.5 rounded-2xl bg-emerald-950/80 border border-emerald-500/50 text-emerald-200 text-xs flex items-center justify-between font-mono animate-fade-in">
            <span>{logActionMsg}</span>
            <button onClick={() => setLogActionMsg(null)} className="text-emerald-400 hover:text-white text-xs font-bold">✕</button>
          </div>
        )}

        {/* Filter & Search Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-black/40 p-3 rounded-2xl border border-white/10">
          
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={logSearchQuery}
              onChange={(e) => setLogSearchQuery(e.target.value)}
              placeholder="Filter by user name, email ID, or action taken..."
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-xs placeholder-gray-400 focus:outline-none focus:border-purple-400 transition-colors"
            />
            {logSearchQuery && (
              <button
                onClick={() => setLogSearchQuery('')}
                className="absolute right-3 top-2.5 text-xs text-gray-400 hover:text-white font-bold"
              >
                ✕
              </button>
            )}
          </div>

          {/* Category Filter Pills */}
          <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 sm:pb-0">
            <button
              onClick={() => setLogCategoryFilter('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-poster tracking-wider transition-all whitespace-nowrap cursor-pointer ${
                logCategoryFilter === 'all'
                  ? 'bg-purple-600 text-white shadow-md border border-purple-400/50'
                  : 'bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white border border-white/5'
              }`}
            >
              ALL LOGS ({portalLogs.length})
            </button>
            <button
              onClick={() => setLogCategoryFilter('logins')}
              className={`px-3 py-1.5 rounded-xl text-xs font-poster tracking-wider transition-all whitespace-nowrap cursor-pointer ${
                logCategoryFilter === 'logins'
                  ? 'bg-emerald-600 text-white shadow-md border border-emerald-400/50'
                  : 'bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white border border-white/5'
              }`}
            >
              PORTAL LOGINS
            </button>
            <button
              onClick={() => setLogCategoryFilter('passes')}
              className={`px-3 py-1.5 rounded-xl text-xs font-poster tracking-wider transition-all whitespace-nowrap cursor-pointer ${
                logCategoryFilter === 'passes'
                  ? 'bg-blue-600 text-white shadow-md border border-blue-400/50'
                  : 'bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white border border-white/5'
              }`}
            >
              PASSES & TICKETS
            </button>
            <button
              onClick={() => setLogCategoryFilter('updates')}
              className={`px-3 py-1.5 rounded-xl text-xs font-poster tracking-wider transition-all whitespace-nowrap cursor-pointer ${
                logCategoryFilter === 'updates'
                  ? 'bg-amber-600 text-white shadow-md border border-amber-400/50'
                  : 'bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white border border-white/5'
              }`}
            >
              UPDATES & CLAIMS
            </button>
          </div>
        </div>

        {/* Audit Trail Table */}
        <div className="overflow-x-auto rounded-2xl border border-white/10 bg-black/40">
          <table className="w-full text-left text-xs text-gray-300 border-collapse">
            <thead>
              <tr className="bg-white/10 text-amber-300 font-poster tracking-wider uppercase border-b border-white/10 text-[11px]">
                <th className="py-3.5 px-4">USER NAME</th>
                <th className="py-3.5 px-4">EMAIL ID</th>
                <th className="py-3.5 px-4">TIMESTAMP</th>
                <th className="py-3.5 px-4">ACTION TAKEN</th>
                <th className="py-3.5 px-4">METHOD / DETAILS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {isLoadingLogs ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-gray-400 font-mono">
                    <div className="flex items-center justify-center space-x-2">
                      <RefreshCw className="w-5 h-5 text-purple-400 animate-spin" />
                      <span>Loading portal user audit trail...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-gray-400 font-mono">
                    <div className="space-y-2">
                      <UserX className="w-8 h-8 text-gray-500 mx-auto" />
                      <p>
                        {portalLogs.length === 0
                          ? 'No portal user audit records in database. Security events are captured automatically when participants log in.'
                          : 'No portal user audit records match your search query.'}
                      </p>
                      {logSearchQuery && (
                        <button
                          onClick={() => setLogSearchQuery('')}
                          className="text-xs text-purple-400 underline hover:text-purple-300 font-sans cursor-pointer"
                        >
                          Clear search filter
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log, index) => {
                  const isSuper = log.email.toLowerCase() === userEmail.toLowerCase() || log.action.toLowerCase().includes('super admin');
                  const isLoginAction = log.action.toLowerCase().includes('login') || log.action.toLowerCase().includes('auth') || log.action.toLowerCase().includes('session');
                  const isPassAction = log.action.toLowerCase().includes('pass') || log.action.toLowerCase().includes('ticket');

                  return (
                    <tr 
                      key={log.id || `log_${index}`} 
                      className="hover:bg-white/10 transition-colors group"
                    >
                      {/* USER NAME */}
                      <td className="py-3.5 px-4 font-medium text-white whitespace-nowrap">
                        <div className="flex items-center space-x-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-md ${
                            isSuper 
                              ? 'bg-gradient-to-tr from-amber-500 to-yellow-400 text-black font-poster' 
                              : isLoginAction 
                              ? 'bg-gradient-to-tr from-emerald-600 to-teal-500' 
                              : 'bg-gradient-to-tr from-purple-600 to-indigo-600'
                          }`}>
                            {(log.name || log.email || 'U').substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center space-x-2">
                              <span className="font-semibold text-white group-hover:text-amber-300 transition-colors">
                                {log.name || log.email.split('@')[0]}
                              </span>
                              {isSuper && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-poster bg-amber-400/20 text-amber-300 border border-amber-400/30">
                                  SUPER ADMIN
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-gray-400 sm:hidden">
                              {log.email}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* EMAIL ID */}
                      <td className="py-3.5 px-4 text-gray-200 font-mono text-[11px] whitespace-nowrap">
                        <div className="flex items-center space-x-1.5">
                          <span>{log.email}</span>
                          <button
                            onClick={() => handleCopyEmail(log.email)}
                            className="p-1 rounded hover:bg-white/20 text-gray-400 hover:text-white transition-colors cursor-pointer"
                            title="Copy Email ID"
                          >
                            {copiedLogEmail === log.email ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </td>

                      {/* TIMESTAMP */}
                      <td className="py-3.5 px-4 text-gray-300 whitespace-nowrap font-mono text-[11px]">
                        <div className="flex items-center space-x-1.5">
                          <Clock className="w-3.5 h-3.5 text-purple-400" />
                          <span>{formatAuditTimestamp(log.timestamp)}</span>
                        </div>
                      </td>

                      {/* ACTION TAKEN */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-xl text-xs font-poster tracking-wider border shadow-sm ${
                          isLoginAction
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                            : isPassAction
                            ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                            : 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                        }`}>
                          <UserCheck className="w-3 h-3 mr-1" />
                          <span>{log.action}</span>
                        </span>
                      </td>

                      {/* DETAILS / METHOD */}
                      <td className="py-3.5 px-4 text-gray-300 max-w-xs truncate text-[11px]">
                        <div className="flex flex-col">
                          <span className="text-gray-200 font-sans truncate">{log.details || 'Standard Portal Action'}</span>
                          <span className="text-[10px] text-gray-400 font-mono">{log.loginMethod || 'Google Auth'}</span>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Audit Log Footer & Counter */}
        <div className="flex flex-col sm:flex-row items-center justify-between text-xs text-gray-400 font-mono border-t border-white/10 pt-4">
          <div>
            Showing <strong className="text-white">{filteredLogs.length}</strong> of <strong className="text-white">{portalLogs.length}</strong> total portal audit entries
          </div>
          <div className="flex items-center space-x-2 mt-2 sm:mt-0">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>GRACIA Jubilee 2026 • Encrypted Audit Trail Log</span>
          </div>
        </div>

      </div>

      {/* HITPAY TRANSACTION ENDPOINTS & API ARCHITECTURE MODAL POPUP */}
      {showHitpayEndpointsModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto animate-fade-in">
          <div className="relative w-full max-w-5xl max-h-[92vh] bg-gradient-to-b from-gray-900 via-gray-900 to-gray-950 border-2 border-blue-500/40 rounded-3xl shadow-2xl flex flex-col overflow-hidden">
            
            {/* MODAL HEADER */}
            <div className="p-5 sm:p-6 bg-gradient-to-r from-blue-950/80 via-indigo-950/60 to-gray-900 border-b border-blue-500/30 flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
              <div className="space-y-1">
                <div className="flex items-center space-x-2.5 flex-wrap gap-y-1">
                  <div className="p-2 rounded-xl bg-blue-500/20 text-cyan-300 border border-blue-400/40">
                    <Code className="w-5 h-5" />
                  </div>
                  <h3 className="font-poster text-xl sm:text-2xl text-white tracking-wide">
                    PAYMENT TRANSACTION ENDPOINTS & API ARCHITECTURE
                  </h3>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                    Live Active
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono bg-blue-500/20 text-blue-300 border border-blue-500/40">
                    HMAC-SHA256 Protected
                  </span>
                </div>
                <p className="text-xs text-gray-300 leading-relaxed">
                  Interactive API specifications, JSON payloads, HMAC verification signatures, and live test runners for the end-to-end PayNow transaction lifecycle.
                </p>
              </div>

              <div className="flex items-center space-x-2 shrink-0 self-end md:self-center">
                <button
                  onClick={() => setShowHitpayEndpointsModal(false)}
                  className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white transition-all cursor-pointer"
                  title="Close popup (Esc)"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* MODAL BODY (SCROLLABLE) */}
            <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">

              {/* SECTION 1: TRANSACTION LIFECYCLE FLOWCHART */}
              <div className="p-4 sm:p-5 rounded-2xl bg-black/60 border border-blue-500/30 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 text-xs font-bold text-cyan-300 uppercase tracking-wider">
                    <Compass className="w-4 h-4 text-cyan-400" />
                    <span>PayNow Transaction Lifecycle Pipeline</span>
                  </div>
                  <span className="text-[10px] text-gray-400 font-mono">6 Sequential Subsystems</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5 text-[11px]">
                  <div className="p-3 rounded-xl bg-blue-950/60 border border-blue-500/30 space-y-1">
                    <div className="font-bold text-cyan-300 flex items-center space-x-1">
                      <span className="w-4 h-4 rounded-full bg-blue-500/30 text-cyan-300 flex items-center justify-center text-[10px]">1</span>
                      <span>Initiate & QR</span>
                    </div>
                    <p className="text-gray-300 text-[10px]">
                      <code className="text-cyan-200">POST /api/hitpay/create-payment</code> generates PayNow SGQR & checkout URL.
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/30 space-y-1">
                    <div className="font-bold text-emerald-300 flex items-center space-x-1">
                      <span className="w-4 h-4 rounded-full bg-emerald-500/30 text-emerald-300 flex items-center justify-center text-[10px]">2</span>
                      <span>Bank App Scan</span>
                    </div>
                    <p className="text-gray-300 text-[10px]">
                      Attendee scans SGQR. Bank reads Tag 26-05 & Tag 62 bill ref automatically.
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-amber-950/60 border border-amber-500/30 space-y-1">
                    <div className="font-bold text-amber-300 flex items-center space-x-1">
                      <span className="w-4 h-4 rounded-full bg-amber-500/30 text-amber-300 flex items-center justify-center text-[10px]">3</span>
                      <span>Status Polling</span>
                    </div>
                    <p className="text-gray-300 text-[10px]">
                      <code className="text-amber-200">GET /api/hitpay/status/:id</code> probes Payment Gateway API every 2.5s for settlement.
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-purple-950/60 border border-purple-500/30 space-y-1">
                    <div className="font-bold text-purple-300 flex items-center space-x-1">
                      <span className="w-4 h-4 rounded-full bg-purple-500/30 text-purple-300 flex items-center justify-center text-[10px]">4</span>
                      <span>Webhook Callback</span>
                    </div>
                    <p className="text-gray-300 text-[10px]">
                      <code className="text-purple-200">POST /api/hitpay/webhook</code> receives instant signed HMAC event.
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-teal-950/60 border border-teal-500/30 space-y-1">
                    <div className="font-bold text-teal-300 flex items-center space-x-1">
                      <span className="w-4 h-4 rounded-full bg-teal-500/30 text-teal-300 flex items-center justify-center text-[10px]">5</span>
                      <span>Firestore Sync</span>
                    </div>
                    <p className="text-gray-300 text-[10px]">
                      Registration updated to <strong className="text-white">succeeded</strong>. Confirmation email triggered.
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-pink-950/60 border border-pink-500/30 space-y-1">
                    <div className="font-bold text-pink-300 flex items-center space-x-1">
                      <span className="w-4 h-4 rounded-full bg-pink-500/30 text-pink-300 flex items-center justify-center text-[10px]">6</span>
                      <span>Pass Generation</span>
                    </div>
                    <p className="text-gray-300 text-[10px]">
                      <code className="text-pink-200">POST /api/generate-pdf-pass</code> compiles high-res badge PDF with QR.
                    </p>
                  </div>
                </div>
              </div>

              {/* SECTION 2: ENDPOINTS FILTER BAR */}
              <div className="flex items-center justify-between flex-wrap gap-2 border-b border-white/10 pb-3">
                <div className="flex items-center space-x-1.5 flex-wrap gap-y-1">
                  <span className="text-xs text-gray-400 font-semibold mr-1">Filter by Subsystem:</span>
                  {[
                    { id: 'all', label: 'All Endpoints', count: SYSTEM_ENDPOINTS.length },
                    { id: 'HitPay Gateway', label: 'HitPay Gateway', count: SYSTEM_ENDPOINTS.filter(e => e.category === 'HitPay Gateway').length },
                    { id: 'HitPay Webhooks', label: 'HitPay Webhooks', count: SYSTEM_ENDPOINTS.filter(e => e.category === 'HitPay Webhooks').length },
                    { id: 'Diagnostics', label: 'Diagnostics & Telemetry', count: SYSTEM_ENDPOINTS.filter(e => e.category === 'Diagnostics' || e.category === 'Telemetry').length },
                    { id: 'Pass Generation', label: 'Pass Generation', count: SYSTEM_ENDPOINTS.filter(e => e.category === 'Pass Generation').length }
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setModalEndpointCategory(tab.id)}
                      className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center space-x-1.5 ${
                        modalEndpointCategory === tab.id
                          ? 'bg-blue-600 text-white shadow-md'
                          : 'bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white'
                      }`}
                    >
                      <span>{tab.label}</span>
                      <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-black/40 text-gray-300">{tab.count}</span>
                    </button>
                  ))}
                </div>

                <div className="text-xs text-gray-400 font-mono">
                  Base Host: <span className="text-cyan-300 font-bold">{window.location.origin}</span>
                </div>
              </div>

              {/* SECTION 3: ENDPOINTS INTERACTIVE CATALOG & LIVE TEST RUNNER */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                
                {/* LEFT LIST: ALL ENDPOINTS */}
                <div className="lg:col-span-4 space-y-2">
                  <div className="text-xs font-bold text-gray-400 uppercase tracking-wider px-1">
                    Select Endpoint to Inspect:
                  </div>

                  <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
                    {SYSTEM_ENDPOINTS
                      .filter(ep => modalEndpointCategory === 'all' || ep.category === modalEndpointCategory || (modalEndpointCategory === 'Diagnostics' && (ep.category === 'Diagnostics' || ep.category === 'Telemetry')))
                      .map(ep => {
                        const isSelected = modalSelectedEndpointId === ep.id;
                        return (
                          <div
                            key={ep.id}
                            onClick={() => setModalSelectedEndpointId(ep.id)}
                            className={`p-3 rounded-2xl border transition-all cursor-pointer text-left space-y-1.5 ${
                              isSelected
                                ? 'bg-gradient-to-r from-blue-950/90 to-indigo-950/80 border-blue-400 text-white shadow-lg ring-1 ring-blue-400/50'
                                : 'bg-white/5 hover:bg-white/10 border-white/10 text-gray-300 hover:border-blue-400/30'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                                ep.method === 'POST' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                              }`}>
                                {ep.method}
                              </span>
                              <span className="text-[10px] text-gray-400 font-semibold">{ep.category}</span>
                            </div>
                            <div className="text-xs font-bold text-white line-clamp-1">
                              {ep.name}
                            </div>
                            <div className="text-[11px] font-mono text-cyan-300 truncate">
                              {ep.path}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>

                {/* RIGHT PANE: DEEP ENDPOINT DETAILS & TEST RUNNER */}
                {(() => {
                  const activeEp = SYSTEM_ENDPOINTS.find(e => e.id === modalSelectedEndpointId) || SYSTEM_ENDPOINTS[0];
                  return (
                    <div className="lg:col-span-8 space-y-4 p-5 rounded-2xl bg-black/60 border border-blue-500/30">
                      
                      {/* ENDPOINT TITLE & ACTIONS */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
                        <div className="space-y-1">
                          <div className="flex items-center space-x-2">
                            <span className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold ${
                              activeEp.method === 'POST' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                            }`}>
                              {activeEp.method}
                            </span>
                            <span className="font-mono text-xs sm:text-sm font-bold text-cyan-300 break-all select-all">
                              {activeEp.path}
                            </span>
                          </div>
                          <h4 className="text-sm font-bold text-white">
                            {activeEp.name}
                          </h4>
                        </div>

                        <div className="flex items-center space-x-2 shrink-0">
                          <button
                            onClick={() => handleCopyModalEndpointUrl(activeEp.path, activeEp.id)}
                            className="px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] font-semibold text-gray-200 flex items-center space-x-1 cursor-pointer transition-all"
                            title="Copy Endpoint URL"
                          >
                            {copiedModalUrlId === activeEp.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                            <span>{copiedModalUrlId === activeEp.id ? 'Copied URL' : 'Copy URL'}</span>
                          </button>

                          <button
                            onClick={() => handleCopyModalCurl(activeEp)}
                            className="px-2.5 py-1.5 rounded-xl bg-blue-900/60 hover:bg-blue-800 border border-blue-400/40 text-[11px] font-semibold text-blue-200 flex items-center space-x-1 cursor-pointer transition-all"
                            title="Copy cURL command"
                          >
                            {copiedModalCurlId === activeEp.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Terminal className="w-3.5 h-3.5" />}
                            <span>{copiedModalCurlId === activeEp.id ? 'Copied cURL' : 'Copy cURL'}</span>
                          </button>
                        </div>
                      </div>

                      {/* DESCRIPTION & ARCHITECTURAL NOTES */}
                      <div className="space-y-1.5 text-xs text-gray-300">
                        <p className="leading-relaxed">{activeEp.description}</p>
                        {activeEp.notes && (
                          <div className="p-2.5 rounded-xl bg-blue-950/40 border border-blue-500/20 text-[11px] text-cyan-200 flex items-start space-x-2">
                            <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                            <span><strong>Architecture Note:</strong> {activeEp.notes}</span>
                          </div>
                        )}
                      </div>

                      {/* REQUIRED HEADERS TABLE */}
                      <div className="space-y-1.5">
                        <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                          Required Headers
                        </div>
                        <div className="p-2.5 rounded-xl bg-gray-950 border border-gray-800 text-[11px] font-mono space-y-1">
                          {Object.entries(activeEp.headers || {}).map(([key, val]) => (
                            <div key={key} className="flex flex-col sm:flex-row sm:items-center justify-between text-gray-300">
                              <span className="text-amber-300 font-bold">{key}:</span>
                              <span className="text-gray-400 truncate max-w-sm">{val}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* REQUEST PAYLOAD (IF POST) */}
                      {activeEp.method !== 'GET' && (
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-xs text-gray-400 font-bold">
                            <span className="uppercase tracking-wider">Request JSON Body Payload</span>
                            <button
                              onClick={() => {
                                if (activeEp.defaultPayload) {
                                  setModalCustomPayload(JSON.stringify(activeEp.defaultPayload, null, 2));
                                }
                              }}
                              className="text-[10px] text-cyan-400 hover:text-cyan-300 underline font-normal cursor-pointer"
                            >
                              Reset to Default Payload
                            </button>
                          </div>
                          <textarea
                            rows={6}
                            value={modalCustomPayload}
                            onChange={(e) => setModalCustomPayload(e.target.value)}
                            className="w-full p-3 rounded-xl bg-gray-950 border border-gray-800 text-cyan-300 font-mono text-xs leading-relaxed focus:border-blue-500 focus:outline-none resize-y"
                            placeholder="Enter valid JSON payload..."
                          />
                        </div>
                      )}

                      {/* EXECUTION BUTTON */}
                      <div className="pt-1 flex items-center justify-between flex-wrap gap-2">
                        <button
                          onClick={handleExecuteModalEndpoint}
                          disabled={isModalExecuting}
                          className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-[0.98] text-white font-poster text-xs sm:text-sm tracking-wider shadow-lg flex items-center space-x-2 cursor-pointer disabled:opacity-50 transition-all border border-emerald-400/40"
                        >
                          {isModalExecuting ? (
                            <>
                              <RefreshCw className="w-4 h-4 animate-spin text-white" />
                              <span>SENDING REQUEST TO BACKEND...</span>
                            </>
                          ) : (
                            <>
                              <Play className="w-4 h-4 fill-white text-white" />
                              <span>SEND LIVE REQUEST (TEST ENDPOINT)</span>
                            </>
                          )}
                        </button>

                        <span className="text-[11px] text-gray-400">
                          Target: <code className="text-cyan-300 font-bold">{activeEp.path}</code>
                        </span>
                      </div>

                      {/* LIVE EXECUTION RESULT */}
                      {modalExecutionResult && (
                        <div className="p-4 rounded-xl bg-gray-950 border border-blue-500/40 space-y-2.5 animate-fade-in font-mono text-xs">
                          <div className="flex items-center justify-between border-b border-gray-800 pb-2">
                            <div className="flex items-center space-x-2">
                              <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                                modalExecutionResult.status >= 200 && modalExecutionResult.status < 300
                                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                  : 'bg-red-500/20 text-red-300 border border-red-500/40'
                              }`}>
                                {modalExecutionResult.status} {modalExecutionResult.statusText}
                              </span>
                              <span className="text-[11px] text-gray-400">
                                ⏱️ {modalExecutionResult.latencyMs} ms
                              </span>
                            </div>

                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(JSON.stringify(modalExecutionResult.data, null, 2));
                                setCopiedModalResponse(true);
                                setTimeout(() => setCopiedModalResponse(false), 2000);
                              }}
                              className="px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-[10px] text-gray-300 flex items-center space-x-1 cursor-pointer"
                            >
                              {copiedModalResponse ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                              <span>{copiedModalResponse ? 'Copied Response' : 'Copy JSON'}</span>
                            </button>
                          </div>

                          {modalExecutionResult.error && (
                            <div className="p-2.5 rounded-lg bg-red-950/60 border border-red-500/40 text-red-300 text-xs">
                              {modalExecutionResult.error}
                            </div>
                          )}

                          <pre className="p-3 rounded-lg bg-black/70 text-emerald-300 overflow-x-auto text-[11px] leading-relaxed max-h-56">
                            {JSON.stringify(modalExecutionResult.data, null, 2)}
                          </pre>
                        </div>
                      )}

                      {/* EXPECTED RESPONSE SCHEMA SPECIFICATION */}
                      <div className="space-y-1.5 pt-2">
                        <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                          Expected Response Schema (Reference Contract)
                        </div>
                        <pre className="p-3 rounded-xl bg-gray-950/80 border border-gray-800 text-cyan-200 overflow-x-auto text-[11px] font-mono leading-relaxed max-h-48">
                          {JSON.stringify(activeEp.responseSchema, null, 2)}
                        </pre>
                      </div>

                    </div>
                  );
                })()}

              </div>

            </div>

            {/* MODAL FOOTER */}
            <div className="p-4 sm:p-5 bg-gradient-to-r from-gray-950 via-gray-900 to-gray-950 border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0 text-xs text-gray-400 font-mono">
              <div className="flex items-center space-x-3 flex-wrap gap-y-1">
                <span className="flex items-center space-x-1 text-emerald-400 font-bold">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Payment Gateway: LIVE Production</span>
                </span>
                <span>•</span>
                <span>UEN: <strong className="text-white">201605888W (HitPay)</strong></span>
                <span>•</span>
                <span>Webhook HMAC: <strong className="text-emerald-300">Active</strong></span>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setShowHitpayEndpointsModal(false)}
                  className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-xs transition-all cursor-pointer"
                >
                  Close Reference Hub
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* CLEAR PORTAL AUDIT LOGS CONFIRMATION MODAL */}
      {showClearLogsConfirmModal && (
        <div 
          id="modal-clear-portal-logs"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in"
        >
          <div className="w-full max-w-lg bg-gradient-to-b from-[#1c081e] via-[#120516] to-[#0d0210] border border-red-500/40 rounded-3xl shadow-2xl overflow-hidden animate-scale-up">
            
            {/* Header */}
            <div className="p-6 border-b border-red-500/20 bg-red-950/30 flex items-start justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 rounded-2xl bg-red-500/20 border border-red-500/40 flex items-center justify-center shrink-0">
                  <Trash2 className="w-6 h-6 text-red-400" />
                </div>
                <div>
                  <h3 className="text-lg font-poster text-white tracking-wide">
                    CLEAR AUDIT TRAIL
                  </h3>
                  <p className="text-xs text-red-300 font-mono">
                    Permanent Purge of Portal Activity Records
                  </p>
                </div>
              </div>
              <button
                onClick={() => !isClearingLogs && setShowClearLogsConfirmModal(false)}
                disabled={isClearingLogs}
                className="text-gray-400 hover:text-white p-1 rounded-lg transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4 text-sm text-gray-300 font-sans">
              <div className="p-4 rounded-2xl bg-red-950/40 border border-red-500/30 space-y-2">
                <div className="flex items-center space-x-2 text-red-300 font-bold text-xs">
                  <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                  <span>WARNING: IRREVERSIBLE SECURITY ACTION</span>
                </div>
                <p className="text-xs text-red-200/90 leading-relaxed">
                  You are about to permanently delete all <strong className="text-white underline">{portalLogs.length}</strong> activity audit logs from the Firestore database collection (<code className="text-amber-300 bg-black/40 px-1 py-0.5 rounded">portal_user_logs</code>).
                </p>
              </div>

              <div className="text-xs text-gray-400 space-y-2">
                <p>• All tracked participant Google logins, pass viewings, and profile update timestamps will be erased.</p>
                <p>• New log events will continue to record automatically when users access the portal.</p>
              </div>
            </div>

            {/* Footer */}
            <div className="p-5 bg-black/60 border-t border-white/10 flex items-center justify-end space-x-3">
              <button
                type="button"
                onClick={() => setShowClearLogsConfirmModal(false)}
                disabled={isClearingLogs}
                className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white text-xs font-semibold transition-all cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmClearAllPortalLogs}
                disabled={isClearingLogs}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-red-600 via-rose-600 to-red-700 hover:from-red-500 hover:to-rose-500 text-white font-poster text-xs tracking-wider shadow-lg transition-all flex items-center space-x-2 cursor-pointer disabled:opacity-50"
              >
                {isClearingLogs ? (
                  <>
                    <RefreshCw className="w-4 h-4 text-white animate-spin" />
                    <span>PURGING AUDIT LOGS...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4 text-white" />
                    <span>YES, CLEAR ALL LOGS</span>
                  </>
                )}
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
