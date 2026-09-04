import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Sanitization helpers to prevent issues with quotes, whitespace or trailing slashes
function sanitizeString(val: unknown): string {
  if (typeof val !== 'string') return '';
  let str = val.trim();
  // Strip surrounding quotes if user copied with quotes in Vercel dashboard
  if ((str.startsWith('"') && str.endsWith('"')) || (str.startsWith("'") && str.endsWith("'"))) {
    str = str.slice(1, -1).trim();
  }
  return str;
}

function sanitizeUrl(url: unknown): string {
  let str = sanitizeString(url);
  if (str.endsWith('/')) {
    str = str.slice(0, -1);
  }
  return str;
}

// Retrieve environment variables from Vite, Next/Vercel standard prefixes
const envUrl =
  (import.meta.env && import.meta.env.VITE_SUPABASE_URL) ||
  (import.meta.env && (import.meta.env as any).SUPABASE_URL) ||
  (import.meta.env && (import.meta.env as any).NEXT_PUBLIC_SUPABASE_URL) ||
  '';

const envKey =
  (import.meta.env && import.meta.env.VITE_SUPABASE_ANON_KEY) ||
  (import.meta.env && (import.meta.env as any).SUPABASE_ANON_KEY) ||
  (import.meta.env && (import.meta.env as any).NEXT_PUBLIC_SUPABASE_ANON_KEY) ||
  '';

export const SUPABASE_URL = sanitizeUrl(envUrl);
export const SUPABASE_ANON_KEY = sanitizeString(envKey);

export const isConfigured = Boolean(
  SUPABASE_URL.startsWith('http') &&
  !SUPABASE_URL.includes('placeholder') &&
  SUPABASE_ANON_KEY.length > 20 &&
  !SUPABASE_ANON_KEY.includes('dummy')
);

// Informative error message when Supabase is not configured
const CONFIG_ERROR_MESSAGE =
  'Supabase no está configurado en este despliegue. Configura las variables de entorno VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en Vercel (Project Settings > Environment Variables) y haz Redeploy.';

// Safe client creator: if configured, creates real Supabase client;
// if not configured, creates a proxy that does NOT ping any fake placeholder server and reports configuration error
function createSafeClient(url: string, key: string): SupabaseClient {
  if (isConfigured) {
    return createClient(url, key, {
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

  // Fallback proxy: avoids throwing at module evaluation while explicitly returning configuration error on any call
  const queryResult = {
    data: null,
    error: new Error(CONFIG_ERROR_MESSAGE),
  };

  const builder: any = {
    select: () => builder,
    insert: () => builder,
    update: () => builder,
    delete: () => builder,
    upsert: () => builder,
    eq: () => builder,
    neq: () => builder,
    order: () => builder,
    limit: () => builder,
    single: async () => queryResult,
    maybeSingle: async () => queryResult,
    then: (resolve: any) => resolve(queryResult),
  };

  const proxyClient: any = {
    from: () => builder,
    rpc: async () => queryResult,
    channel: () => ({
      on: () => ({ on: () => ({ subscribe: (cb: any) => { cb?.('CLOSED'); return {}; } }) }),
      subscribe: (cb: any) => { cb?.('CLOSED'); return {}; },
    }),
    auth: {
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      getSession: async () => ({ data: { session: null }, error: null }),
      getUser: async () => ({ data: { user: null }, error: null }),
      signInWithPassword: async () => ({ data: null, error: new Error(CONFIG_ERROR_MESSAGE) }),
      signOut: async () => ({ error: null }),
    },
  };

  return proxyClient as SupabaseClient;
}

export const supabase: SupabaseClient = createSafeClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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
  if (!isConfigured) {
    return {
      connected: false,
      tablesFound: false,
      message: CONFIG_ERROR_MESSAGE,
    };
  }

  try {
    const { error } = await supabase.from('products').select('id').limit(1);
    if (error) {
      if (isTableMissingError(error)) {
        return {
          connected: true,
          tablesFound: false,
          message: "Conexión a Supabase establecida, pero las tablas aún no han sido creadas. Ejecuta MODIF_DB.sql en el SQL Editor de Supabase.",
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
