import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Environment variables
const envUrl = import.meta.env.VITE_SUPABASE_URL || '';
const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Stored config fallback in case user enters it via connection assistant UI
const storedUrl = typeof window !== 'undefined' ? localStorage.getItem('bikie_supabase_url') || '' : '';
const storedKey = typeof window !== 'undefined' ? localStorage.getItem('bikie_supabase_anon_key') || '' : '';

export const SUPABASE_URL = (envUrl || storedUrl || '').trim();
export const SUPABASE_ANON_KEY = (envKey || storedKey || '').trim();

export const isConfigured = Boolean(
  SUPABASE_URL.startsWith('http') && SUPABASE_ANON_KEY.length > 10
);

// Fallback dummy for initialization if not configured yet (avoids throwing at module evaluation)
const activeUrl = isConfigured ? SUPABASE_URL : 'https://placeholder-bikie.supabase.co';
const activeKey = isConfigured ? SUPABASE_ANON_KEY : 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy';

export let supabase: SupabaseClient = createClient(activeUrl, activeKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

export function reconfigureSupabase(url: string, key: string) {
  const cleanUrl = url.trim();
  const cleanKey = key.trim();
  if (typeof window !== 'undefined') {
    localStorage.setItem('bikie_supabase_url', cleanUrl);
    localStorage.setItem('bikie_supabase_anon_key', cleanKey);
  }
  supabase = createClient(cleanUrl, cleanKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  });
}

export function isTableMissingError(error: any): boolean {
  if (!error) return false;
  const msg = typeof error.message === 'string' ? error.message.toLowerCase() : '';
  const code = error.code;
  return (
    code === 'PGRST205' ||
    code === '42P01' ||
    msg.includes('could not find the table') ||
    msg.includes('schema cache') ||
    (msg.includes('relation') && msg.includes('does not exist'))
  );
}

export async function checkSupabaseHealth(): Promise<{
  connected: boolean;
  message: string;
  tablesFound?: boolean;
}> {
  if (!isConfigured && !storedUrl) {
    return {
      connected: false,
      tablesFound: false,
      message: 'Supabase no está configurado. Por favor ingresa la URL y la Anon Key del proyecto.',
    };
  }

  try {
    const { data, error } = await supabase.from('products').select('id').limit(1);
    if (error) {
      if (isTableMissingError(error)) {
        return {
          connected: true,
          tablesFound: false,
          message: "Conexión a Supabase establecida, pero las tablas aún no han sido creadas. Ejecuta el script SQL en el SQL Editor de Supabase.",
        };
      }
      return {
        connected: false,
        tablesFound: false,
        message: error.message || 'Error al conectar con la base de datos de Supabase.',
      };
    }
    return {
      connected: true,
      message: 'Conexión a Supabase establecida exitosamente con la tabla products.',
      tablesFound: true,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Error de conexión de red con Supabase';
    return {
      connected: false,
      tablesFound: false,
      message: errorMsg,
    };
  }
}
