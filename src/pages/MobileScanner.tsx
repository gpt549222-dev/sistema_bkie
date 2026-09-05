import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats, CameraDevice } from 'html5-qrcode';
import { 
  Camera, 
  CameraOff, 
  RotateCw, 
  Flashlight, 
  FlashlightOff, 
  CheckCircle, 
  XCircle, 
  Loader2, 
  Wifi, 
  WifiOff, 
  Smartphone, 
  ArrowLeft,
  KeyRound,
  RefreshCw,
  LogOut,
  Barcode
} from 'lucide-react';
import { supabase } from '../services/supabase';
import { 
  connectScannerSession, 
  disconnectScannerSession, 
  validateScanEvent, 
  playScanSound, 
  triggerVibration,
  getOrCreateDeviceId,
  getDeviceName 
} from '../services/scannerService';
import { PosScannerSession, ScannerScanAck } from '../types';

export const MobileScanner: React.FC = () => {
  // Connection state
  const [token, setToken] = useState<string>('');
  const [shortCodeInput, setShortCodeInput] = useState<string>('');
  const [session, setSession] = useState<PosScannerSession | null>(null);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);

  // Scanner state
  const [isScannerRunning, setIsScannerRunning] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameras, setCameras] = useState<CameraDevice[]>([]);
  const [activeCameraIndex, setActiveCameraIndex] = useState<number>(0);
  const [torchEnabled, setTorchEnabled] = useState<boolean>(false);
  const [hasTorch, setHasTorch] = useState<boolean>(false);

  // Scan feedback state
  const [lastScanResult, setLastScanResult] = useState<{
    status: 'idle' | 'processing' | 'success' | 'error';
    barcode?: string;
    productName?: string;
    price?: number;
    message?: string;
    timestamp: number;
  }>({
    status: 'idle',
    timestamp: Date.now(),
  });

  // Recent scans history (local session memory)
  const [scanHistory, setScanHistory] = useState<Array<{
    barcode: string;
    productName?: string;
    price?: number;
    success: boolean;
    time: string;
  }>>([]);

  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const lastScanThrottleRef = useRef<{ code: string; time: number }>({ code: '', time: 0 });
  const realtimeChannelRef = useRef<any>(null);
  const readerElementId = 'bikie-mobile-scanner-viewfinder';

  // Read URL params on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tokenParam = params.get('token') || params.get('t');
    const codeParam = params.get('code') || params.get('c');

    if (tokenParam) {
      setToken(tokenParam);
      autoConnect({ token: tokenParam });
    } else if (codeParam) {
      setShortCodeInput(codeParam);
      autoConnect({ shortCode: codeParam });
    }
  }, []);

  // Online / offline listeners
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Connect to session
  const autoConnect = async (opts: { token?: string; shortCode?: string }) => {
    setIsConnecting(true);
    setConnectionError(null);

    try {
      const deviceId = getOrCreateDeviceId();
      const deviceName = getDeviceName();

      const ses = await connectScannerSession({
        token: opts.token,
        shortCode: opts.shortCode,
        deviceId,
        deviceName,
      });

      setSession(ses);
      setToken(ses.session_token);
      playScanSound('connect');
      triggerVibration([40, 30, 40]);
    } catch (err: any) {
      console.error('[MobileScanner] Connection error:', err);
      setConnectionError(err.message || 'Error al conectar con la sesión del POS');
      playScanSound('error');
    } finally {
      setIsConnecting(false);
    }
  };

  // Subscribe to Supabase Realtime channel when session is active
  useEffect(() => {
    if (!session) {
      if (realtimeChannelRef.current) {
        supabase.removeChannel(realtimeChannelRef.current);
        realtimeChannelRef.current = null;
      }
      return;
    }

    const channelName = `pos_scanner_${session.session_token}`;
    const channel = supabase.channel(channelName, {
      config: {
        broadcast: { ack: true, self: false },
      },
    });

    channel
      .on('broadcast', { event: 'scan_ack' }, ({ payload }: { payload: ScannerScanAck }) => {
        if (!payload) return;

        if (payload.success) {
          playScanSound('success');
          triggerVibration([50, 40, 60]);
          setLastScanResult({
            status: 'success',
            barcode: payload.barcode,
            productName: payload.name,
            price: payload.price,
            message: 'Añadido al POS',
            timestamp: Date.now(),
          });

          setScanHistory((prev) => [
            {
              barcode: payload.barcode,
              productName: payload.name,
              price: payload.price,
              success: true,
              time: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            },
            ...prev.slice(0, 19),
          ]);
        } else {
          playScanSound('error');
          triggerVibration([100, 50, 100]);
          setLastScanResult({
            status: 'error',
            barcode: payload.barcode,
            message: payload.error || 'Producto no encontrado',
            timestamp: Date.now(),
          });

          setScanHistory((prev) => [
            {
              barcode: payload.barcode,
              success: false,
              time: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            },
            ...prev.slice(0, 19),
          ]);
        }
      })
      .on('broadcast', { event: 'session_closed' }, () => {
        setSession(null);
        setConnectionError('La sesión fue finalizada desde el POS');
        playScanSound('error');
      })
      // Also listen to database row updates for session status
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'pos_scanner_sessions',
          filter: `id=eq.${session.id}`,
        },
        (payload: any) => {
          const updated = payload.new as PosScannerSession;
          if (updated) {
            if (updated.status === 'disconnected') {
              setSession(null);
              setConnectionError('El POS ha desconectado este escáner');
            } else if (updated.status === 'expired') {
              setSession(null);
              setConnectionError('La sesión de escáner ha expirado. Por favor genera un nuevo código en el POS.');
            } else {
              setSession(updated);
            }
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          // Notify POS that mobile is subscribed and ready
          channel.send({
            type: 'broadcast',
            event: 'device_connected',
            payload: {
              session_id: session.id,
              device_id: getOrCreateDeviceId(),
              device_name: getDeviceName(),
              timestamp: new Date().toISOString(),
            },
          });
        }
      });

    realtimeChannelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      realtimeChannelRef.current = null;
    };
  }, [session?.id, session?.session_token]);

  // Handle barcode scanned from camera
  const handleBarcodeScanned = useCallback(
    async (decodedText: string) => {
      const barcode = (decodedText || '').trim();
      if (!barcode || !session) return;

      const now = Date.now();
      // Debounce: ignore repeated readings of same code within 1800ms, or any code within 1000ms
      if (
        (barcode === lastScanThrottleRef.current.code && now - lastScanThrottleRef.current.time < 1800) ||
        now - lastScanThrottleRef.current.time < 1000
      ) {
        return;
      }

      lastScanThrottleRef.current = { code: barcode, time: now };

      // Immediate sensory feedback on physical detection
      triggerVibration([35]);
      setLastScanResult({
        status: 'processing',
        barcode,
        message: 'Buscando en catálogo...',
        timestamp: now,
      });

      // 1. Broadcast scan event through Realtime Channel (ultra low latency directly to POS screen)
      if (realtimeChannelRef.current) {
        realtimeChannelRef.current.send({
          type: 'broadcast',
          event: 'barcode_scanned',
          payload: {
            scanner_session_id: session.id,
            session_token: session.session_token,
            barcode,
            quantity: 1,
            timestamp: new Date().toISOString(),
            device_id: getOrCreateDeviceId(),
          },
        });
      }

      // 2. Validate with Supabase backend RPC (database source of truth and audit)
      try {
        const validation = await validateScanEvent(session.session_token, barcode, getOrCreateDeviceId());

        if (validation.valid && validation.found) {
          playScanSound('success');
          triggerVibration([50, 40, 60]);
          setLastScanResult({
            status: 'success',
            barcode: validation.barcode || barcode,
            productName: validation.product_name,
            price: validation.price,
            message: 'Añadido al POS',
            timestamp: Date.now(),
          });

          setScanHistory((prev) => {
            // Avoid duplicate if already inserted via realtime broadcast ack
            if (prev.length > 0 && prev[0].barcode === barcode && Date.now() - now < 3000) {
              return prev;
            }
            return [
              {
                barcode: validation.barcode || barcode,
                productName: validation.product_name,
                price: validation.price,
                success: true,
                time: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
              },
              ...prev.slice(0, 19),
            ];
          });
        } else if (validation.valid && !validation.found) {
          playScanSound('error');
          triggerVibration([100, 50, 100]);
          setLastScanResult({
            status: 'error',
            barcode,
            message: 'Producto no encontrado',
            timestamp: Date.now(),
          });

          setScanHistory((prev) => [
            {
              barcode,
              success: false,
              time: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            },
            ...prev.slice(0, 19),
          ]);
        } else if (!validation.valid) {
          setConnectionError(validation.error || 'La sesión ya no es válida');
          setSession(null);
        }
      } catch (err: any) {
        console.warn('[MobileScanner] Error validating scan event:', err);
      }
    },
    [session]
  );

  // Initialize and start camera scanner
  const startCamera = useCallback(async () => {
    setCameraError(null);

    try {
      // Ensure any previous scanner instance is stopped
      if (html5QrCodeRef.current) {
        try {
          if (html5QrCodeRef.current.isScanning) {
            await html5QrCodeRef.current.stop();
          }
          await html5QrCodeRef.current.clear();
        } catch {
          // Ignore clean-up error
        }
      }

      // Check available cameras
      const devices = await Html5Qrcode.getCameras();
      if (!devices || devices.length === 0) {
        setCameraError('No se encontró ninguna cámara en este dispositivo.');
        return;
      }

      setCameras(devices);

      // Select camera: preferred environment/back camera
      let selectedCameraId = devices[0].id;
      const backCameraIndex = devices.findIndex((d) => 
        d.label.toLowerCase().includes('back') || 
        d.label.toLowerCase().includes('rear') || 
        d.label.toLowerCase().includes('trasera') || 
        d.label.toLowerCase().includes('environment')
      );

      if (backCameraIndex !== -1) {
        selectedCameraId = devices[backCameraIndex].id;
        setActiveCameraIndex(backCameraIndex);
      }

      const formatsToSupport = [
        Html5QrcodeSupportedFormats.QR_CODE,
        Html5QrcodeSupportedFormats.EAN_13,
        Html5QrcodeSupportedFormats.EAN_8,
        Html5QrcodeSupportedFormats.CODE_128,
        Html5QrcodeSupportedFormats.CODE_39,
        Html5QrcodeSupportedFormats.UPC_A,
        Html5QrcodeSupportedFormats.UPC_E,
        Html5QrcodeSupportedFormats.ITF,
      ];

      const html5QrCode = new Html5Qrcode(readerElementId, {
        formatsToSupport,
        verbose: false,
      });
      html5QrCodeRef.current = html5QrCode;

      await html5QrCode.start(
        selectedCameraId,
        {
          fps: 12,
          qrbox: (viewfinderWidth, viewfinderHeight) => {
            const minDim = Math.min(viewfinderWidth, viewfinderHeight);
            return {
              width: Math.floor(minDim * 0.82),
              height: Math.floor(minDim * 0.55),
            };
          },
        },
        (decodedText) => {
          handleBarcodeScanned(decodedText);
        },
        (_errorMessage) => {
          // Silent scan frame miss
        }
      );

      setIsScannerRunning(true);
      setIsPaused(false);

      // Test torch capability if available
      try {
        // Some devices support torch via constraints
        setHasTorch(true);
      } catch {
        setHasTorch(false);
      }
    } catch (err: any) {
      console.error('[MobileScanner] Camera start error:', err);
      if (err?.name === 'NotAllowedError' || err?.message?.includes('Permission denied')) {
        setCameraError('No se puede acceder a la cámara. Comprueba los permisos de la cámara en el navegador de tu móvil.');
      } else {
        setCameraError(`Error al inicializar la cámara: ${err.message || 'Error desconocido'}`);
      }
      setIsScannerRunning(false);
    }
  }, [handleBarcodeScanned]);

  // Stop camera
  const stopCamera = useCallback(async () => {
    if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
      try {
        await html5QrCodeRef.current.stop();
        await html5QrCodeRef.current.clear();
      } catch (err) {
        console.warn('[MobileScanner] Camera stop error:', err);
      }
    }
    setIsScannerRunning(false);
  }, []);

  // Toggle pause/resume
  const togglePause = () => {
    if (!html5QrCodeRef.current || !isScannerRunning) return;

    if (isPaused) {
      html5QrCodeRef.current.resume();
      setIsPaused(false);
    } else {
      html5QrCodeRef.current.pause();
      setIsPaused(true);
    }
  };

  // Switch camera if multiple cameras exist
  const switchCamera = async () => {
    if (cameras.length <= 1 || !html5QrCodeRef.current) return;

    const nextIndex = (activeCameraIndex + 1) % cameras.length;
    setActiveCameraIndex(nextIndex);

    try {
      await stopCamera();
      const formatsToSupport = [
        Html5QrcodeSupportedFormats.QR_CODE,
        Html5QrcodeSupportedFormats.EAN_13,
        Html5QrcodeSupportedFormats.EAN_8,
        Html5QrcodeSupportedFormats.CODE_128,
        Html5QrcodeSupportedFormats.CODE_39,
        Html5QrcodeSupportedFormats.UPC_A,
        Html5QrcodeSupportedFormats.UPC_E,
        Html5QrcodeSupportedFormats.ITF,
      ];
      const html5QrCode = new Html5Qrcode(readerElementId, {
        formatsToSupport,
        verbose: false,
      });
      html5QrCodeRef.current = html5QrCode;

      await html5QrCode.start(
        cameras[nextIndex].id,
        {
          fps: 12,
          qrbox: (viewfinderWidth, viewfinderHeight) => {
            const minDim = Math.min(viewfinderWidth, viewfinderHeight);
            return {
              width: Math.floor(minDim * 0.82),
              height: Math.floor(minDim * 0.55),
            };
          },
        },
        handleBarcodeScanned,
        () => {}
      );

      setIsScannerRunning(true);
      setIsPaused(false);
    } catch (err: any) {
      console.error('[MobileScanner] Switch camera error:', err);
    }
  };

  // Toggle torch / flash
  const toggleTorch = async () => {
    if (!html5QrCodeRef.current || !isScannerRunning) return;

    try {
      const nextTorch = !torchEnabled;
      await html5QrCodeRef.current.applyVideoConstraints({
        advanced: [{ torch: nextTorch } as any],
      });
      setTorchEnabled(nextTorch);
    } catch {
      setHasTorch(false);
    }
  };

  // Start camera when session becomes active
  useEffect(() => {
    if (session) {
      startCamera();
    } else {
      stopCamera();
    }

    return () => {
      stopCamera();
    };
  }, [session, startCamera, stopCamera]);

  // Handle disconnect
  const handleDisconnect = async () => {
    if (session) {
      try {
        await disconnectScannerSession({
          sessionId: session.id,
          token: session.session_token,
          deviceId: getOrCreateDeviceId(),
        });
      } catch {
        // Ignore
      }
    }
    await stopCamera();
    setSession(null);
    setConnectionError(null);
  };

  // Format currency
  const formatPrice = (val?: number) => {
    if (val === undefined || val === null) return '';
    return new Intl.NumberFormat('es-GQ', { style: 'currency', currency: 'XAF', maximumFractionDigits: 0 }).format(val);
  };

  return (
    <div id="bikie-mobile-scanner-container" className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-rose-500 selection:text-white">
      {/* Header Bar */}
      <header className="sticky top-0 z-30 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              window.history.pushState({}, '', '/');
              window.dispatchEvent(new PopStateEvent('popstate'));
            }}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer"
            title="Volver a la tienda"
            aria-label="Volver a la tienda"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="w-8 h-8 rounded-lg bg-rose-600 flex items-center justify-center text-white font-bold text-sm shadow-md">
            B
          </div>
          <div>
            <h1 className="text-sm font-semibold tracking-tight text-white flex items-center gap-1.5">
              <span>BIKIE Scanner</span>
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-400 border border-rose-500/30">
                POS Móvil
              </span>
            </h1>
            <p className="text-[11px] text-slate-400 leading-none">
              {session ? session.pos_identifier : 'Lector de códigos'}
            </p>
          </div>
        </div>

        {/* Right Status Controls */}
        <div className="flex items-center gap-2">
          {session ? (
            <div className="flex items-center gap-1.5">
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-xs font-medium text-emerald-400">Conectado</span>
              <button
                id="btn-disconnect-mobile-scanner"
                onClick={handleDisconnect}
                className="ml-1 p-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-rose-400 transition"
                title="Desconectar escáner"
                aria-label="Desconectar escáner"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-xs text-amber-400">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
              <span>Sin conexión</span>
            </div>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col p-4 max-w-md mx-auto w-full">
        {/* Network offline warning banner */}
        {!isOnline && (
          <div className="mb-3 p-2.5 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-200 text-xs flex items-center gap-2">
            <WifiOff className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <span>Sin conexión a internet. Los escaneos se enviarán al recuperar la red.</span>
          </div>
        )}

        {/* 1. STATE: NOT CONNECTED -> Connection Screen */}
        {!session && (
          <div className="flex-1 flex flex-col justify-center space-y-6 py-6">
            <div className="text-center space-y-2">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-rose-600 to-amber-500 mx-auto flex items-center justify-center shadow-lg shadow-rose-950/50">
                <Smartphone className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-xl font-bold text-white tracking-tight">
                Vincular con el POS
              </h2>
              <p className="text-xs text-slate-400 max-w-xs mx-auto">
                Escanea el código QR que aparece en la pantalla del ordenador o introduce el código numérico de 6 dígitos.
              </p>
            </div>

            {/* Error banner if connection failed */}
            {connectionError && (
              <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5">
                <XCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-semibold text-rose-200">Error de conexión</p>
                  <p className="text-rose-300/90">{connectionError}</p>
                </div>
              </div>
            )}

            {/* Manual PIN entry form */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (shortCodeInput.trim()) {
                  autoConnect({ shortCode: shortCodeInput.trim() });
                }
              }}
              className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl"
            >
              <div className="space-y-1.5">
                <label htmlFor="input-short-code" className="block text-xs font-semibold text-slate-300">
                  Código de 6 dígitos del POS
                </label>
                <div className="relative">
                  <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    id="input-short-code"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={8}
                    value={shortCodeInput}
                    onChange={(e) => setShortCodeInput(e.target.value)}
                    placeholder="Ej. 482913"
                    className="w-full pl-10 pr-4 py-3 bg-slate-950 border border-slate-700 rounded-xl text-center text-lg font-mono tracking-widest text-white placeholder:text-slate-600 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition"
                    autoFocus
                  />
                </div>
                <p className="text-[11px] text-slate-500">
                  Visible en la ventana "📱 Escanear con móvil" del POS
                </p>
              </div>

              <button
                id="btn-connect-with-code"
                type="submit"
                disabled={isConnecting || !shortCodeInput.trim()}
                className="w-full py-3 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white font-medium text-sm flex items-center justify-center gap-2 shadow-lg shadow-rose-950/50 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {isConnecting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Conectando con el POS...</span>
                  </>
                ) : (
                  <>
                    <Wifi className="w-4 h-4" />
                    <span>Conectar al POS</span>
                  </>
                )}
              </button>
            </form>

            <div className="text-center">
              <button
                type="button"
                onClick={() => {
                  window.history.pushState({}, '', '/');
                  window.dispatchEvent(new PopStateEvent('popstate'));
                }}
                className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Volver a la tienda principal</span>
              </button>
            </div>
          </div>
        )}

        {/* 2. STATE: CONNECTED -> Live Camera Scanner View */}
        {session && (
          <div className="flex-1 flex flex-col space-y-3">
            {/* Viewfinder Camera Card */}
            <div className="relative w-full aspect-[4/3] max-h-[360px] bg-black rounded-2xl overflow-hidden border border-slate-800 shadow-2xl flex items-center justify-center">
              {/* HTML5 QR Code Mount Node */}
              <div id={readerElementId} className="w-full h-full object-cover"></div>

              {/* Scanning visual laser guide overlay */}
              {isScannerRunning && !isPaused && (
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  {/* Targeting frame corners */}
                  <div className="relative w-3/4 h-2/3 border-2 border-dashed border-rose-500/40 rounded-xl flex items-center justify-center">
                    <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-rose-500"></div>
                    <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-rose-500"></div>
                    <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-rose-500"></div>
                    <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-rose-500"></div>

                    {/* Animated laser scan line */}
                    <div className="w-full h-0.5 bg-rose-500 shadow-[0_0_12px_#f43f5e] animate-pulse"></div>
                  </div>
                </div>
              )}

              {/* Paused overlay */}
              {isPaused && (
                <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center text-center p-4">
                  <CameraOff className="w-10 h-10 text-slate-500 mb-2" />
                  <p className="text-sm font-semibold text-white">Escáner pausado</p>
                  <p className="text-xs text-slate-400 mt-1">Toca el botón inferior para reanudar la lectura</p>
                </div>
              )}

              {/* Camera Error banner */}
              {cameraError && (
                <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center text-center p-5">
                  <XCircle className="w-10 h-10 text-rose-500 mb-2" />
                  <p className="text-sm font-semibold text-rose-300">Acceso a cámara denegado</p>
                  <p className="text-xs text-slate-300 mt-1.5 max-w-xs">{cameraError}</p>
                  <button
                    onClick={startCamera}
                    className="mt-4 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium rounded-lg transition flex items-center gap-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Reintentar acceso</span>
                  </button>
                </div>
              )}

              {/* Viewfinder Controls floating pill */}
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 bg-slate-900/85 backdrop-blur-md px-3 py-1.5 rounded-full border border-slate-700/60 shadow-lg">
                <button
                  id="btn-scanner-toggle-pause"
                  onClick={togglePause}
                  className="p-1.5 text-slate-300 hover:text-white transition"
                  title={isPaused ? 'Reanudar lectura' : 'Pausar lectura'}
                  aria-label={isPaused ? 'Reanudar lectura' : 'Pausar lectura'}
                >
                  {isPaused ? <Camera className="w-4 h-4 text-emerald-400" /> : <CameraOff className="w-4 h-4" />}
                </button>

                {cameras.length > 1 && (
                  <button
                    id="btn-scanner-switch-camera"
                    onClick={switchCamera}
                    className="p-1.5 text-slate-300 hover:text-white transition"
                    title="Cambiar cámara"
                    aria-label="Cambiar cámara"
                  >
                    <RotateCw className="w-4 h-4" />
                  </button>
                )}

                {hasTorch && (
                  <button
                    id="btn-scanner-toggle-torch"
                    onClick={toggleTorch}
                    className={`p-1.5 transition ${torchEnabled ? 'text-amber-400' : 'text-slate-300 hover:text-white'}`}
                    title={torchEnabled ? 'Apagar flash' : 'Encender flash'}
                    aria-label={torchEnabled ? 'Apagar flash' : 'Encender flash'}
                  >
                    {torchEnabled ? <Flashlight className="w-4 h-4" /> : <FlashlightOff className="w-4 h-4" />}
                  </button>
                )}
              </div>
            </div>

            {/* Live Scan Result Card */}
            <div
              id="scanner-live-feedback-card"
              className={`rounded-2xl p-4 border transition-all duration-200 shadow-lg ${
                lastScanResult.status === 'success'
                  ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-100'
                  : lastScanResult.status === 'error'
                  ? 'bg-rose-950/40 border-rose-500/40 text-rose-100'
                  : lastScanResult.status === 'processing'
                  ? 'bg-sky-950/40 border-sky-500/40 text-sky-100'
                  : 'bg-slate-900 border-slate-800 text-slate-300'
              }`}
            >
              {lastScanResult.status === 'idle' && (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-slate-400 flex-shrink-0">
                    <Barcode className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-slate-200">
                      Listo para escanear
                    </p>
                    <p className="text-[11px] text-slate-400">
                      Apunta la cámara al código de barras o QR de cualquier producto
                    </p>
                  </div>
                </div>
              )}

              {lastScanResult.status === 'processing' && (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-sky-500/20 flex items-center justify-center text-sky-400 flex-shrink-0 animate-pulse">
                    <Loader2 className="w-5 h-5 animate-spin" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-sky-200">
                      Código detectado: {lastScanResult.barcode}
                    </p>
                    <p className="text-[11px] text-sky-300/80">
                      Verificando producto en el sistema...
                    </p>
                  </div>
                </div>
              )}

              {lastScanResult.status === 'success' && (
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 flex-shrink-0 mt-0.5">
                    <CheckCircle className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider">
                        ✓ Añadido al POS
                      </span>
                      <span className="text-sm font-bold text-emerald-300">
                        {formatPrice(lastScanResult.price)}
                      </span>
                    </div>
                    <p className="text-sm font-bold text-white truncate mt-0.5">
                      {lastScanResult.productName || 'Producto'}
                    </p>
                    <p className="text-[11px] text-emerald-300/70 font-mono mt-0.5">
                      Código: {lastScanResult.barcode}
                    </p>
                  </div>
                </div>
              )}

              {lastScanResult.status === 'error' && (
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400 flex-shrink-0 mt-0.5">
                    <XCircle className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-rose-200">
                      ❌ {lastScanResult.message || 'Producto no encontrado'}
                    </p>
                    <p className="text-[11px] text-rose-300/80 font-mono mt-0.5">
                      Código leído: {lastScanResult.barcode}
                    </p>
                    <p className="text-[11px] text-rose-300/60 mt-1">
                      No está registrado en el inventario o está inactivo.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Session History & Counter */}
            <div className="flex-1 bg-slate-900 border border-slate-800 rounded-2xl p-3.5 flex flex-col min-h-[140px] overflow-hidden">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800">
                <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <span>Historial de escaneo</span>
                  <span className="px-1.5 py-0.2 rounded-full bg-slate-800 text-[10px] text-slate-400">
                    {scanHistory.length}
                  </span>
                </span>
                <span className="text-[11px] text-slate-500 font-mono">
                  Sesión activa
                </span>
              </div>

              <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 text-xs">
                {scanHistory.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-slate-500 text-xs py-4 text-center">
                    Los productos escaneados aparecerán aquí y en la pantalla del POS en tiempo real.
                  </div>
                ) : (
                  scanHistory.map((item, idx) => (
                    <div
                      key={idx}
                      className={`p-2 rounded-lg flex items-center justify-between gap-2 text-xs border ${
                        item.success
                          ? 'bg-slate-950/60 border-slate-800/80 text-slate-200'
                          : 'bg-rose-950/30 border-rose-900/40 text-rose-300'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate text-white">
                          {item.productName || (item.success ? 'Producto' : 'No encontrado')}
                        </p>
                        <p className="text-[10px] text-slate-500 font-mono">
                          {item.barcode} • {item.time}
                        </p>
                      </div>
                      {item.success && item.price !== undefined && (
                        <span className="font-semibold text-emerald-400 whitespace-nowrap text-[11px]">
                          {formatPrice(item.price)}
                        </span>
                      )}
                      {!item.success && (
                        <span className="text-[10px] text-rose-400 font-medium whitespace-nowrap">
                          No existe
                        </span>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
export default MobileScanner;
