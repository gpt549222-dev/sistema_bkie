import React, { useState, useEffect } from 'react';
import { 
  Smartphone, 
  X, 
  Wifi, 
  WifiOff, 
  RefreshCw, 
  LogOut, 
  CheckCircle, 
  XCircle, 
  Copy, 
  ExternalLink,
  Clock,
  Minimize2,
  Maximize2,
  ShieldCheck,
  QrCode
} from 'lucide-react';
import { generateQrCodeDataUrl, createScannerSession } from '../../services/scannerService';
import { PosScannerSession } from '../../types';

interface MobileScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: PosScannerSession | null;
  onSessionUpdate: (session: PosScannerSession | null) => void;
  onDisconnect: () => Promise<void>;
  isConnected: boolean;
  connectedDeviceName?: string | null;
  lastScannedItem: {
    barcode: string;
    name?: string;
    price?: number;
    success: boolean;
    time: string;
  } | null;
}

export const MobileScannerModal: React.FC<MobileScannerModalProps> = ({
  isOpen,
  onClose,
  session,
  onSessionUpdate,
  onDisconnect,
  isConnected,
  connectedDeviceName,
  lastScannedItem,
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [isMinimized, setIsMinimized] = useState<boolean>(false);
  const [timeLeftMinutes, setTimeLeftMinutes] = useState<number | null>(null);

  // Connection URL pointing to mobile scanner page
  const connectionUrl = session
    ? `${window.location.origin}/scanner?token=${session.session_token}`
    : '';

  // Generate QR Code whenever session changes
  useEffect(() => {
    if (!session?.session_token) {
      setQrDataUrl(null);
      return;
    }

    let isMounted = true;
    setIsGenerating(true);

    generateQrCodeDataUrl(connectionUrl)
      .then((url) => {
        if (isMounted) {
          setQrDataUrl(url);
          setIsGenerating(false);
        }
      })
      .catch((err) => {
        console.error('[MobileScannerModal] Error generating QR code:', err);
        if (isMounted) setIsGenerating(false);
      });

    return () => {
      isMounted = false;
    };
  }, [session?.session_token, connectionUrl]);

  // Calculate remaining session minutes countdown
  useEffect(() => {
    if (!session?.expires_at) {
      setTimeLeftMinutes(null);
      return;
    }

    const checkTime = () => {
      const remainingMs = new Date(session.expires_at).getTime() - Date.now();
      const mins = Math.max(0, Math.ceil(remainingMs / (1000 * 60)));
      setTimeLeftMinutes(mins);
    };

    checkTime();
    const interval = setInterval(checkTime, 30000);
    return () => clearInterval(interval);
  }, [session?.expires_at]);

  // Create new session if none exists or if expired
  const handleCreateSession = async () => {
    setIsGenerating(true);
    try {
      const newSession = await createScannerSession('Caja Principal', 45);
      onSessionUpdate(newSession);
    } catch (err: any) {
      console.error('[MobileScannerModal] Error creating session:', err);
      alert(err.message || 'Error al iniciar sesión de escáner');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyLink = () => {
    if (!connectionUrl) return;
    navigator.clipboard.writeText(connectionUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCopyCode = () => {
    if (!session?.short_code) return;
    navigator.clipboard.writeText(session.short_code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const formatPrice = (val?: number) => {
    if (val === undefined || val === null) return '';
    return new Intl.NumberFormat('es-GQ', { style: 'currency', currency: 'XAF', maximumFractionDigits: 0 }).format(val);
  };

  if (!isOpen) return null;

  // Minimized floating widget on the bottom corner of POS
  if (isMinimized) {
    return (
      <div 
        id="scanner-minimized-floating-widget"
        className="fixed bottom-4 right-4 z-50 bg-slate-900 border border-slate-700 text-white rounded-2xl shadow-2xl p-3.5 flex items-center gap-3 animate-in fade-in slide-in-from-bottom-3"
      >
        <div className="relative">
          <div className="w-10 h-10 rounded-xl bg-rose-600/20 border border-rose-500/30 flex items-center justify-center text-rose-400">
            <Smartphone className="w-5 h-5" />
          </div>
          <span className={`absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-slate-900 ${
            isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
          }`} />
        </div>

        <div className="text-left">
          <p className="text-xs font-bold text-white flex items-center gap-1.5">
            <span>Escáner móvil</span>
            <span className={`text-[10px] font-medium px-1.5 py-0.2 rounded ${
              isConnected ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'
            }`}>
              {isConnected ? 'Conectado' : 'Esperando'}
            </span>
          </p>
          <p className="text-[11px] text-slate-400">
            {connectedDeviceName || (session ? `Código: ${session.short_code}` : 'Sin sesión')}
          </p>
        </div>

        <div className="flex items-center gap-1 ml-2">
          <button
            onClick={() => setIsMinimized(false)}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
            title="Maximizar ventana"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-rose-400 transition"
            title="Cerrar ventana"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div 
      id="modal-mobile-scanner"
      className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden text-slate-100 animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-rose-600/20 border border-rose-500/30 flex items-center justify-center text-rose-400 shadow-sm">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                <span>Escanear con móvil</span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
                  POS Remoto
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Usa la cámara del teléfono móvil como lector inalámbrico de códigos
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setIsMinimized(true)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              title="Minimizar (el escáner seguirá activo en segundo plano)"
            >
              <Minimize2 className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              title="Cerrar modal"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6">
          {/* Connection Status Badge Banner */}
          <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800">
            <div className="flex items-center gap-3">
              <span className="flex h-3 w-3 relative">
                {isConnected ? (
                  <>
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                  </>
                ) : (
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-400 animate-pulse"></span>
                )}
              </span>
              <div>
                <p className="text-xs font-bold text-white">
                  {isConnected ? '🟢 Móvil conectado' : '🟡 Esperando conexión del móvil...'}
                </p>
                <p className="text-[11px] text-slate-400">
                  {isConnected
                    ? connectedDeviceName || session?.device_name || 'Dispositivo vinculado'
                    : 'Apunta la cámara del móvil a este código QR'}
                </p>
              </div>
            </div>

            {isConnected && (
              <button
                id="btn-disconnect-session-modal"
                onClick={onDisconnect}
                className="px-3 py-1.5 rounded-xl bg-rose-950/50 hover:bg-rose-900/60 border border-rose-800/50 text-rose-300 text-xs font-semibold flex items-center gap-1.5 transition"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Desconectar</span>
              </button>
            )}
          </div>

          {/* QR Code and Code Section */}
          <div className="flex flex-col sm:flex-row items-center gap-6 p-4 rounded-2xl bg-slate-950/50 border border-slate-800">
            {/* QR Card */}
            <div className="flex-shrink-0 flex flex-col items-center">
              <div className="relative p-2.5 bg-white rounded-2xl shadow-xl flex items-center justify-center w-[170px] h-[170px]">
                {qrDataUrl ? (
                  <img
                    src={qrDataUrl}
                    alt="Código QR de conexión con el escáner móvil"
                    className="w-full h-full object-contain rounded-lg"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-slate-400 gap-2">
                    <RefreshCw className="w-6 h-6 animate-spin text-rose-600" />
                    <span className="text-[10px] font-medium text-slate-600">Generando QR...</span>
                  </div>
                )}
              </div>
              <span className="text-[10px] text-slate-400 mt-2 font-medium">
                Escanea con la cámara del móvil
              </span>
            </div>

            {/* Connection Information & Manual PIN */}
            <div className="flex-1 space-y-3 w-full text-left">
              <div>
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Código de enlace manual
                </span>
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex-1 py-2 px-3 bg-slate-900 border border-slate-700 rounded-xl text-center text-xl font-mono font-bold tracking-widest text-white shadow-inner">
                    {session?.short_code || '------'}
                  </div>
                  <button
                    onClick={handleCopyCode}
                    className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                    title="Copiar código corto"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
                {copiedCode && (
                  <p className="text-[10px] text-emerald-400 mt-1">✓ Código copiado</p>
                )}
              </div>

              {/* Direct link button / copy */}
              <div className="pt-1">
                <button
                  onClick={handleCopyLink}
                  className="w-full py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center justify-center gap-2 transition"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{copiedLink ? '✓ Enlace copiado' : 'Copiar enlace directo'}</span>
                </button>
              </div>

              {/* Expiration Timer & New Session button */}
              <div className="pt-1 flex items-center justify-between text-[11px] text-slate-400">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3 text-slate-500" />
                  <span>
                    {timeLeftMinutes !== null ? `Expira en ${timeLeftMinutes} min` : 'Sesión temporal'}
                  </span>
                </span>
                <button
                  onClick={handleCreateSession}
                  disabled={isGenerating}
                  className="text-rose-400 hover:text-rose-300 font-semibold flex items-center gap-1 transition"
                >
                  <RefreshCw className={`w-3 h-3 ${isGenerating ? 'animate-spin' : ''}`} />
                  <span>Generar nuevo</span>
                </button>
              </div>
            </div>
          </div>

          {/* Last Scanned Item in Realtime */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Último producto escaneado
            </span>
            <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800">
              {lastScannedItem ? (
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {lastScannedItem.success ? (
                      <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center flex-shrink-0">
                        <CheckCircle className="w-4 h-4" />
                      </div>
                    ) : (
                      <div className="w-8 h-8 rounded-lg bg-rose-500/20 text-rose-400 flex items-center justify-center flex-shrink-0">
                        <XCircle className="w-4 h-4" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-white truncate">
                        {lastScannedItem.name || (lastScannedItem.success ? 'Producto' : 'No encontrado')}
                      </p>
                      <p className="text-[11px] text-slate-400 font-mono">
                        {lastScannedItem.barcode} • {lastScannedItem.time}
                      </p>
                    </div>
                  </div>
                  {lastScannedItem.success && lastScannedItem.price !== undefined && (
                    <span className="text-xs font-bold text-emerald-400 whitespace-nowrap">
                      {formatPrice(lastScannedItem.price)}
                    </span>
                  )}
                  {!lastScannedItem.success && (
                    <span className="text-[11px] font-medium text-rose-400 whitespace-nowrap">
                      Código no existe
                    </span>
                  )}
                </div>
              ) : (
                <p className="text-xs text-slate-500 text-center py-1">
                  Aún no se ha escaneado ningún producto en esta sesión.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span>Conexión segura cifrada con Supabase Realtime</span>
          </div>

          <button
            onClick={() => setIsMinimized(true)}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold flex items-center gap-1.5 transition shadow-sm"
          >
            <Minimize2 className="w-3.5 h-3.5" />
            <span>Minimizar y seguir cobrando</span>
          </button>
        </div>
      </div>
    </div>
  );
};
export default MobileScannerModal;
