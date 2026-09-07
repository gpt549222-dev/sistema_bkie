import { supabase } from './supabase';

export interface SystemUser {
  id: string;
  email: string;
  full_name: string;
  role: 'admin' | 'cashier' | 'customer';
  phone?: string;
  created_at?: string;
  last_sign_in_at?: string;
}

export interface CreateUserData {
  email: string;
  password: string;
  full_name: string;
  role: 'admin' | 'cashier' | 'customer';
  phone?: string;
}

/**
 * Obtener todos los usuarios del sistema (combinando auth y profiles)
 */
export async function getSystemUsers(): Promise<SystemUser[]> {
  // 1. Intentar RPC get_system_users
  try {
    const { data: rpcData, error: rpcError } = await supabase.rpc('get_system_users');
    if (!rpcError && Array.isArray(rpcData)) {
      return rpcData;
    }
  } catch {}

  // 2. Fallback directo a la tabla profiles
  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, full_name, role, phone, created_at')
    .order('created_at', { ascending: false });

  if (error) {
    console.warn('[userService] Error al obtener perfiles:', error.message);
    return [];
  }

  return (profiles || []).map((p: any) => ({
    id: p.id,
    email: p.full_name?.includes('@') ? p.full_name : 'Usuario registrado',
    full_name: p.full_name || 'Sin nombre',
    role: (p.role as 'admin' | 'cashier' | 'customer') || 'customer',
    phone: p.phone || '',
    created_at: p.created_at,
  }));
}

/**
 * Crear un nuevo usuario en el sistema
 */
export async function createSystemUser(data: CreateUserData): Promise<void> {
  const normalizedEmail = data.email.trim().toLowerCase();
  const cleanPassword = data.password.trim();

  if (!normalizedEmail || !cleanPassword) {
    throw new Error('El correo y la contraseña son obligatorios.');
  }

  if (cleanPassword.length < 6) {
    throw new Error('La contraseña debe tener un mínimo de 6 caracteres.');
  }

  // 1. Intentar mediante RPC atómico en PostgreSQL (seguro y directo)
  try {
    const { data: rpcData, error: rpcError } = await supabase.rpc('create_new_system_user', {
      p_email: normalizedEmail,
      p_password: cleanPassword,
      p_full_name: data.full_name.trim(),
      p_role: data.role,
      p_phone: data.phone?.trim() || '',
    });

    if (!rpcError) {
      if (rpcData && rpcData.success === false) {
        throw new Error(rpcData.message || 'Error al crear usuario en la base de datos.');
      }
      return;
    }
  } catch (err: any) {
    if (err.message && !err.message.includes('function') && !err.message.includes('does not exist')) {
      throw err;
    }
  }

  // 2. Fallback usando Supabase Auth signUp
  const { data: authData, error: signUpError } = await supabase.auth.signUp({
    email: normalizedEmail,
    password: cleanPassword,
    options: {
      data: {
        full_name: data.full_name.trim(),
        role: data.role,
        phone: data.phone?.trim() || '',
      },
    },
  });

  if (signUpError) {
    throw new Error(`Error en registro: ${signUpError.message}`);
  }

  if (authData.user) {
    // Asegurar que el perfil se actualice con el rol y nombre deseados
    await supabase.from('profiles').upsert({
      id: authData.user.id,
      full_name: data.full_name.trim() || normalizedEmail,
      role: data.role,
      phone: data.phone?.trim() || '',
      updated_at: new Date().toISOString(),
    });
  }
}

/**
 * Eliminar un usuario del sistema
 */
export async function deleteSystemUser(userId: string): Promise<void> {
  // 1. Intentar RPC
  try {
    const { data: rpcData, error: rpcError } = await supabase.rpc('delete_system_user', {
      p_user_id: userId,
    });
    if (!rpcError && rpcData?.success) {
      return;
    }
  } catch {}

  // 2. Fallback eliminando su perfil
  const { error } = await supabase.from('profiles').delete().eq('id', userId);
  if (error) {
    throw new Error(`Error al eliminar usuario: ${error.message}`);
  }
}

/**
 * Actualizar rol de un usuario existente
 */
export async function updateUserRole(
  userId: string,
  role: 'admin' | 'cashier' | 'customer'
): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ role, updated_at: new Date().toISOString() })
    .eq('id', userId);

  if (error) {
    throw new Error(`Error al actualizar rol: ${error.message}`);
  }
}
