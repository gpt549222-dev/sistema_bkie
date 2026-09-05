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

function isMissingFunctionError(error: any): boolean {
  if (!error) return false;
  const msg = String(error.message || error.details || error.hint || '').toLowerCase();
  const code = String(error.code || '');
  return (
    code === 'PGRST202' ||
    msg.includes('could not find the function') ||
    msg.includes('schema cache') ||
    msg.includes('not found') ||
    msg.includes('permission denied') ||
    msg.includes('violates row-level')
  );
}

/**
 * Create a new scanner session in Supabase (Staff only)
 * Resilient to schema cache propagation or pending database migrations
 */
export async function createScannerSession(
  posIdentifier: string = 'Caja Principal',
  expiresMinutes: number = 30
): Promise<PosScannerSession> {
  // 1. Try standard Supabase RPC
  try {
    const { data, error } = await supabase.rpc('create_pos_scanner_session', {
      p_pos_identifier: posIdentifier,
      p_expires_minutes: expiresMinutes,
    });

    if (!error && data && data.session_token) {
      return data as PosScannerSession;
    }

    if (error && !isMissingFunctionError(error)) {
      console.warn('[scannerService] RPC create_pos_scanner_session notice:', error.message);
    }
  } catch (err: any) {
    if (!isMissingFunctionError(err)) {
      console.warn('[scannerService] RPC invocation notice:', err?.message || err);
    }
  }

  // 2. Direct database table insert fallback if RPC is not present
  const token = generateSecureToken();
  const shortCode = generateShortCode();
  const nowIso = new Date().toISOString();
  const expiresAt = new Date(Date.now() + expiresMinutes * 60 * 1000).toISOString();
  const fallbackSession: PosScannerSession = {
    id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `ses_${Date.now()}`,
    session_token: token,
    short_code: shortCode,
    pos_identifier: posIdentifier,
    status: 'waiting',
    created_at: nowIso,
    expires_at: expiresAt,
  };

  try {
    const { data: dbData, error: dbError } = await supabase
      .from('pos_scanner_sessions')
      .insert({
        id: fallbackSession.id,
        session_token: fallbackSession.session_token,
        short_code: fallbackSession.short_code,
        pos_identifier: fallbackSession.pos_identifier,
        status: 'waiting',
        expires_at: fallbackSession.expires_at,
      })
      .select()
      .single();

    if (!dbError && dbData) {
      return dbData as PosScannerSession;
    }
  } catch {
    // If table doesn't exist yet, proceed with Realtime-only in-memory session
  }

  // 3. Pure Realtime session fallback (Supabase Realtime Broadcast works seamlessly)
  return fallbackSession;
}

/**
 * Connect a mobile device to an existing scanner session
 */
export async function connectScannerSession(params: {
  token?: string;
  shortCode?: string;
  deviceId?: string;
  deviceName?: string;
}): Promise<PosScannerSession> {
  const deviceId = params.deviceId || getOrCreateDeviceId();
  const deviceName = params.deviceName || getDeviceName();

  // 1. Try RPC
  try {
    const { data, error } = await supabase.rpc('connect_pos_scanner_session', {
      p_token: params.token || null,
      p_short_code: params.shortCode || null,
      p_device_id: deviceId,
      p_device_name: deviceName,
    });

    if (!error && data && data.status !== 'error') {
      return data as PosScannerSession;
    }
    if (error && !isMissingFunctionError(error)) {
      throw new Error(error.message);
    }
  } catch (err: any) {
    if (!isMissingFunctionError(err)) {
      throw err;
    }
  }

  // 2. Direct table update / query fallback
  if (params.token) {
    const cleanToken = params.token.trim();
    try {
      await supabase
        .from('pos_scanner_sessions')
        .update({
          status: 'connected',
          device_id: deviceId,
          device_name: deviceName,
          connected_at: new Date().toISOString(),
        })
        .eq('session_token', cleanToken);
    } catch {}

    return {
      id: `conn_${Date.now()}`,
      session_token: cleanToken,
      short_code: params.shortCode || '100000',
      pos_identifier: 'Caja Principal',
      status: 'connected',
      device_id: deviceId,
      device_name: deviceName,
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    };
  }

  if (params.shortCode) {
    const code = params.shortCode.trim();
    try {
      const { data: found } = await supabase
        .from('pos_scanner_sessions')
        .select('*')
        .eq('short_code', code)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (found) {
        try {
          await supabase
            .from('pos_scanner_sessions')
            .update({
              status: 'connected',
              device_id: deviceId,
              device_name: deviceName,
              connected_at: new Date().toISOString(),
            })
            .eq('id', found.id);
        } catch {}

        return { ...found, status: 'connected', device_id: deviceId, device_name: deviceName };
      }
    } catch {}

    // Same-origin localStorage check
    try {
      const saved = localStorage.getItem('bikie_pos_scanner_session');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.short_code === code) {
          return {
            ...parsed,
            status: 'connected',
            device_id: deviceId,
            device_name: deviceName,
          };
        }
      }
    } catch {}

    throw new Error('Código de escáner no encontrado o sesión expirada.');
  }

  throw new Error('Debes proporcionar un enlace o código de escáner válido.');
}

/**
 * Disconnect a scanner session
 */
export async function disconnectScannerSession(params: {
  sessionId?: string;
  token?: string;
  deviceId?: string;
}): Promise<void> {
  try {
    await supabase.rpc('disconnect_pos_scanner_session', {
      p_session_id: params.sessionId || null,
      p_token: params.token || null,
      p_device_id: params.deviceId || null,
    });
  } catch {}

  if (params.token) {
    try {
      await supabase
        .from('pos_scanner_sessions')
        .update({
          status: 'disconnected',
          disconnected_at: new Date().toISOString(),
        })
        .eq('session_token', params.token);
    } catch {}
  }
}

/**
 * Validate scan event on Supabase and check if product exists
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
  // 1. Try RPC
  try {
    const { data, error } = await supabase.rpc('validate_pos_scan_event', {
      p_token: token,
      p_barcode: barcode,
      p_device_id: deviceId || getOrCreateDeviceId(),
    });

    if (!error && data) {
      return data;
    }
  } catch {}

  // 2. Direct product lookup fallback
  const product = await getProductByCode(barcode);
  if (product) {
    return {
      valid: true,
      found: true,
      barcode: product.code || barcode,
      product_id: product.id,
      product_name: product.name,
      price: product.price,
      stock: product.stock,
    };
  }

  return {
    valid: true,
    found: false,
    barcode: barcode,
    error: 'Producto no encontrado en inventario',
  };
}

/**
 * Get current scanner session status
 */
export async function getScannerSessionStatus(params: {
  sessionId?: string;
  token?: string;
}): Promise<PosScannerSession | null> {
  try {
    const { data, error } = await supabase.rpc('get_pos_scanner_session_status', {
      p_session_id: params.sessionId || null,
      p_token: params.token || null,
    });

    if (!error && data && data.status !== 'not_found') {
      return data as PosScannerSession;
    }
  } catch {}

  if (params.token) {
    try {
      const { data } = await supabase
        .from('pos_scanner_sessions')
        .select('*')
        .eq('session_token', params.token)
        .maybeSingle();

      if (data) return data as PosScannerSession;
    } catch {}
  }

  return null;
}
