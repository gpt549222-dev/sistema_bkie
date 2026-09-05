import { supabase, isTableMissingError } from './supabase';
import { Customer } from '../types';

export async function getCustomers(): Promise<Customer[]> {
  try {
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .order('full_name', { ascending: true });

    if (error) {
      if (isTableMissingError(error)) {
        return [];
      }
      console.warn('Error al obtener lista de clientes de Supabase:', error.message);
      return [];
    }

    return (data || []).map((c: any) => ({
      id: c.id,
      user_id: c.user_id || null,
      full_name: c.full_name || 'Consumidor final',
      phone: c.phone || '',
      email: c.email || null,
      identification_number: c.id_doc || c.identification_number || '',
      id_doc: c.id_doc || c.identification_number || '',
      address: c.address || '',
      created_at: c.created_at || new Date().toISOString(),
    }));
  } catch (err: any) {
    console.warn('Excepción al cargar clientes:', err);
    return [];
  }
}

export async function createCustomer(payload: {
  full_name: string;
  phone?: string;
  email?: string;
  id_doc?: string;
  address?: string;
}): Promise<Customer | null> {
  try {
    const cleanName = payload.full_name.trim() || 'Consumidor final';
    const { data, error } = await supabase
      .from('customers')
      .insert([
        {
          full_name: cleanName,
          phone: payload.phone?.trim() || null,
          email: payload.email?.trim() || null,
          id_doc: payload.id_doc?.trim() || null,
          address: payload.address?.trim() || null,
        },
      ])
      .select()
      .single();

    if (error) {
      console.warn('Error al crear cliente:', error.message);
      return null;
    }

    return {
      id: data.id,
      user_id: data.user_id || null,
      full_name: data.full_name,
      phone: data.phone || '',
      email: data.email || null,
      identification_number: data.id_doc || data.identification_number || '',
      id_doc: data.id_doc || data.identification_number || '',
      address: data.address || '',
      created_at: data.created_at || new Date().toISOString(),
    };
  } catch (err: any) {
    console.warn('Excepción al crear cliente:', err);
    return null;
  }
}

