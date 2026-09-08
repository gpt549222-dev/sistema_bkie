import QRCode from 'qrcode';
import { supabase } from './supabase';
import { getProductByCode } from './productService';
import { PosScannerSession, ScannerScanEvent, ScannerScanAck } from '../types';

/**
 * Service for remote POS mobile scanner sessions using Supabase and Realtime
 */

// Generate or retrieve persistent mobile device identifier
export function getOrCreateDeviceId(): string {
  try {
    const key = 'bikie_scanner_device_id';
    let id = localStorage.getItem(key);
    if (!id) {
      id = 'dev_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now().toString(36);
      localStorage.setItem(key, id);
    }
    return id;
  } catch {
    return 'dev_' + Math.random().toString(36).substring(2, 11);
  }
}

// Get user-friendly device info
export function getDeviceName(): string {
  try {
    const ua = navigator.userAgent;
    let os = 'Dispositivo';
    let browser = 'Navegador';

    if (/iPhone/i.test(ua)) os = 'iPhone';
    else if (/iPad/i.test(ua)) os = 'iPad';
    else if (/Android/i.test(ua)) os = 'Android';
    else if (/Windows/i.test(ua)) os = 'Windows';
    else if (/Macintosh|Mac OS/i.test(ua)) os = 'Mac';

    if (/CriOS|Chrome/i.test(ua)) browser = 'Chrome';
    else if (/FxiOS|Firefox/i.test(ua)) browser = 'Firefox';
    else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) browser = 'Safari';

    return `${os} (${browser})`;
  } catch {
    return 'Móvil';
  }
}

// Audio synthesizer for audio feedback without requiring external audio files
export function playScanSound(type: 'success' | 'error' | 'connect') {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    if (type === 'success') {
      // Crisp POS chime
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1760, ctx.currentTime); // A6
      osc.frequency.setValueAtTime(2349.32, ctx.currentTime + 0.08); // D7
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    } else if (type === 'error') {
      // Low dual buzz
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, ctx.currentTime);
      osc.frequency.setValueAtTime(180, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.35, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } else if (type === 'connect') {
      // Pleasant connection chime
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
      osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.08); // E5
      osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.16); // G5
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    }
  } catch {
    // Ignore audio context autoplay limitations
  }
}

export function triggerVibration(pattern: number[] = [60]) {
  try {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(pattern);
    }
  } catch {
    // Ignore vibration error
  }
}

/**
 * Generate high-resolution QR code data URL for display on the POS screen
 */
export async function generateQrCodeDataUrl(url: string): Promise<string> {
  return QRCode.toDataURL(url, {
    errorCorrectionLevel: 'M',
    width: 340,
    margin: 2,
    color: {
      dark: '#0f172a',
      light: '#ffffff',
    },
  });
}

function generateSecureToken(): string {
  try {
    if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
      const bytes = new Uint8Array(24);
      window.crypto.getRandomValues(bytes);
      return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    }
  } catch {}
  return (
    Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15) +
    Date.now().toString(36)
  );
}

function generateShortCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

/**
 * Create a new scanner session in Supabase (Staff only)
 * Uses atomic RPC exclusively for security and audit trail
 */
export async function createScannerSession(
  posIdentifier: string = 'Caja Principal',
  expiresMinutes: number = 30
): Promise<PosScannerSession> {
  const { data, error } = await supabase.rpc('create_pos_scanner_session', {
    p_pos_identifier: posIdentifier,
    p_expires_minutes: expiresMinutes,
  });

  if (error) {
    console.error('[scannerService] Error al crear sesión de escáner:', error);
    throw new Error(error.message || 'Error al crear la sesión de escáner en el servidor.');
  }

  if (!data || !data.session_token) {
    throw new Error('La base de datos no devolvió los datos requeridos para la sesión de escáner.');
  }

  return data as PosScannerSession;
}

/**
 * Connect a mobile device to an existing scanner session
 * Uses atomic RPC exclusively
 */
export async function connectScannerSession(params: {
  token?: string;
  shortCode?: string;
  deviceId?: string;
  deviceName?: string;
}): Promise<PosScannerSession> {
  const deviceId = params.deviceId || getOrCreateDeviceId();
  const deviceName = params.deviceName || getDeviceName();

  if (!params.token && !params.shortCode) {
    throw new Error('Debes proporcionar un enlace o código de escáner válido.');
  }

  const { data, error } = await supabase.rpc('connect_pos_scanner_session', {
    p_token: params.token ? params.token.trim() : null,
    p_short_code: params.shortCode ? params.shortCode.trim() : null,
    p_device_id: deviceId,
    p_device_name: deviceName,
  });

  if (error) {
    console.error('[scannerService] Error al conectar sesión de escáner:', error);
    throw new Error(error.message || 'No fue posible conectar con la sesión de escáner.');
  }

  if (!data || data.status === 'error') {
    throw new Error(data?.message || 'Error al conectar el dispositivo a la sesión.');
  }

  return data as PosScannerSession;
}

/**
 * Disconnect a scanner session
 * Uses atomic RPC exclusively
 */
export async function disconnectScannerSession(params: {
  sessionId?: string;
  token?: string;
  deviceId?: string;
}): Promise<void> {
  const { error } = await supabase.rpc('disconnect_pos_scanner_session', {
    p_session_id: params.sessionId || null,
    p_token: params.token ? params.token.trim() : null,
    p_device_id: params.deviceId || null,
  });

  if (error) {
    console.warn('[scannerService] Aviso al desconectar sesión de escáner:', error.message);
  }
}

/**
 * Validate scan event on Supabase and verify product existence
 * Uses atomic RPC exclusively (search by barcode first, then code or id)
 */
export async function validateScanEvent(
  token: string,
  barcode: string,
  deviceId?: string
): Promise<{
  valid: boolean;
  found?: boolean;
  barcode?: string;
  product_id?: string;
  product_name?: string;
  price?: number;
  stock?: number;
  error?: string;
}> {
  const cleanBarcode = (barcode || '').trim();
  if (!cleanBarcode) {
    return {
      valid: false,
      error: 'El código de barras está vacío.',
    };
  }

  const { data, error } = await supabase.rpc('validate_pos_scan_event', {
    p_token: token.trim(),
    p_barcode: cleanBarcode,
    p_device_id: deviceId || getOrCreateDeviceId(),
  });

  if (error) {
    console.error('[scannerService] Error en RPC validate_pos_scan_event:', error);
    return {
      valid: false,
      error: error.message || 'Error al validar el escaneo en el servidor.',
    };
  }

  return data;
}

/**
 * Get current scanner session status
 * Uses atomic RPC exclusively
 */
export async function getScannerSessionStatus(params: {
  sessionId?: string;
  token?: string;
}): Promise<PosScannerSession | null> {
  const { data, error } = await supabase.rpc('get_pos_scanner_session_status', {
    p_session_id: params.sessionId || null,
    p_token: params.token ? params.token.trim() : null,
  });

  if (error) {
    console.warn('[scannerService] Error al obtener estado de sesión:', error.message);
    return null;
  }

  if (!data || data.status === 'not_found' || data.error) {
    return null;
  }

  return data as PosScannerSession;
}
