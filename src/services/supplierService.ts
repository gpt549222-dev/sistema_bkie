import { supabase, isTableMissingError } from './supabase';
import { Supplier } from '../types';

export async function getSuppliers(includeInactive = false): Promise<Supplier[]> {
  let query = supabase
    .from('suppliers')
    .select('*')
    .order('name', { ascending: true });

  if (!includeInactive) {
    query = query.eq('is_active', true);
  }

  const { data, error } = await query;

  if (error) {
    if (isTableMissingError(error)) {
      console.warn("Tabla 'suppliers' aún no creada en Supabase. Ejecuta MODIF_DB.sql en Supabase.");
      return [];
    }
    throw new Error(`Error al obtener proveedores: ${error.message}`);
  }

  return (data || []).map((s: any) => ({
    id: s.id,
    name: s.name,
    contact_person: s.contact_person || null,
    website_url: s.website_url || null,
    phone: s.phone || null,
    email: s.email || null,
    address: s.address || null,
    category: s.category || 'General',
    notes: s.notes || null,
    is_active: s.is_active !== false,
    created_at: s.created_at,
    updated_at: s.updated_at,
  }));
}

export async function createSupplier(supplierData: {
  name: string;
  contact_person?: string | null;
  website_url?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  category?: string | null;
  notes?: string | null;
  is_active?: boolean;
}): Promise<Supplier> {
  const { data, error } = await supabase
    .from('suppliers')
    .insert({
      name: supplierData.name.trim(),
      contact_person: supplierData.contact_person?.trim() || null,
      website_url: supplierData.website_url?.trim() || null,
      phone: supplierData.phone?.trim() || null,
      email: supplierData.email?.trim() || null,
      address: supplierData.address?.trim() || null,
      category: supplierData.category || 'Papelería General',
      notes: supplierData.notes?.trim() || null,
      is_active: supplierData.is_active !== false,
    })
    .select()
    .single();

  if (error || !data) {
    throw new Error(`Error al crear proveedor en Supabase: ${error?.message}`);
  }

  return {
    id: data.id,
    name: data.name,
    contact_person: data.contact_person,
    website_url: data.website_url,
    phone: data.phone,
    email: data.email,
    address: data.address,
    category: data.category,
    notes: data.notes,
    is_active: data.is_active,
    created_at: data.created_at,
    updated_at: data.updated_at,
  };
}

export async function updateSupplier(
  id: string,
  updates: Partial<Supplier>
): Promise<Supplier> {
  const payload: any = {
    updated_at: new Date().toISOString(),
  };

  if (updates.name !== undefined) payload.name = updates.name.trim();
  if (updates.contact_person !== undefined) payload.contact_person = updates.contact_person?.trim() || null;
  if (updates.website_url !== undefined) payload.website_url = updates.website_url?.trim() || null;
  if (updates.phone !== undefined) payload.phone = updates.phone?.trim() || null;
  if (updates.email !== undefined) payload.email = updates.email?.trim() || null;
  if (updates.address !== undefined) payload.address = updates.address?.trim() || null;
  if (updates.category !== undefined) payload.category = updates.category;
  if (updates.notes !== undefined) payload.notes = updates.notes?.trim() || null;
  if (updates.is_active !== undefined) payload.is_active = updates.is_active;

  const { data, error } = await supabase
    .from('suppliers')
    .update(payload)
    .eq('id', id)
    .select()
    .single();

  if (error || !data) {
    throw new Error(`Error al actualizar proveedor en Supabase: ${error?.message}`);
  }

  return {
    id: data.id,
    name: data.name,
    contact_person: data.contact_person,
    website_url: data.website_url,
    phone: data.phone,
    email: data.email,
    address: data.address,
    category: data.category,
    notes: data.notes,
    is_active: data.is_active,
    created_at: data.created_at,
    updated_at: data.updated_at,
  };
}

export async function deleteSupplier(id: string): Promise<boolean> {
  const { error } = await supabase.from('suppliers').delete().eq('id', id);

  if (error) {
    throw new Error(`Error al eliminar proveedor de Supabase: ${error.message}`);
  }

  return true;
}
