import { supabase, isTableMissingError } from './supabase';
import { AdditionalService } from '../types';

export async function getAdditionalServices(includeInactive = false): Promise<AdditionalService[]> {
  let query = supabase
    .from('services')
    .select('*')
    .order('name', { ascending: true });

  if (!includeInactive) {
    query = query.eq('is_active', true);
  }

  const { data, error } = await query;

  if (error) {
    if (isTableMissingError(error)) {
      console.warn("Tabla 'services' aún no creada en Supabase. Ejecuta MODIF_DB.sql en Supabase.");
      return [];
    }
    throw new Error(`Error al obtener servicios: ${error.message}`);
  }

  return (data || []).map((s: any) => ({
    id: s.id,
    code: s.code || `SRV-${s.id.slice(0, 5)}`,
    name: s.name,
    category: s.category || 'otros',
    price: Number(s.price) || 0,
    unit_label: s.unit_label || 'por unidad',
    description: s.description || null,
    is_active: s.is_active !== false,
    created_at: s.created_at,
    updated_at: s.updated_at,
  }));
}

export async function createAdditionalService(serviceData: {
  code?: string;
  name: string;
  category: string;
  price: number;
  unit_label?: string;
  description?: string | null;
  is_active?: boolean;
}): Promise<AdditionalService> {
  const generatedCode =
    serviceData.code ||
    `SRV-${(serviceData.category || 'SRV').slice(0, 3).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`;

  const { data, error } = await supabase
    .from('services')
    .insert({
      code: generatedCode.trim(),
      name: serviceData.name.trim(),
      category: serviceData.category || 'otros',
      price: Number(serviceData.price) || 0,
      unit_label: serviceData.unit_label || 'por servicio',
      description: serviceData.description ? serviceData.description.trim() : null,
      is_active: serviceData.is_active !== false,
    })
    .select()
    .single();

  if (error || !data) {
    throw new Error(`Error al crear servicio en Supabase: ${error?.message}`);
  }

  return {
    id: data.id,
    code: data.code,
    name: data.name,
    category: data.category,
    price: Number(data.price),
    unit_label: data.unit_label,
    description: data.description,
    is_active: data.is_active,
    created_at: data.created_at,
    updated_at: data.updated_at,
  };
}

export async function updateAdditionalService(
  id: string,
  updates: Partial<AdditionalService>
): Promise<AdditionalService> {
  const payload: any = {
    updated_at: new Date().toISOString(),
  };

  if (updates.code !== undefined) payload.code = updates.code.trim();
  if (updates.name !== undefined) payload.name = updates.name.trim();
  if (updates.category !== undefined) payload.category = updates.category;
  if (updates.price !== undefined) payload.price = Number(updates.price) || 0;
  if (updates.unit_label !== undefined) payload.unit_label = updates.unit_label;
  if (updates.description !== undefined) payload.description = updates.description ? updates.description.trim() : null;
  if (updates.is_active !== undefined) payload.is_active = updates.is_active;

  const { data, error } = await supabase
    .from('services')
    .update(payload)
    .eq('id', id)
    .select()
    .single();

  if (error || !data) {
    throw new Error(`Error al actualizar servicio en Supabase: ${error?.message}`);
  }

  return {
    id: data.id,
    code: data.code,
    name: data.name,
    category: data.category,
    price: Number(data.price),
    unit_label: data.unit_label,
    description: data.description,
    is_active: data.is_active,
    created_at: data.created_at,
    updated_at: data.updated_at,
  };
}

export async function deleteAdditionalService(id: string): Promise<boolean> {
  const { error } = await supabase.from('services').delete().eq('id', id);

  if (error) {
    throw new Error(`Error al eliminar servicio de Supabase: ${error.message}`);
  }

  return true;
}
