import { supabase, isTableMissingError } from './supabase';
import { Offer, OfferType, OfferStatus } from '../types';

export async function getOffers(): Promise<Offer[]> {
  const { data: rawOffers, error } = await supabase
    .from('offers')
    .select('*, offer_products(product_id), offer_categories(category_id)')
    .order('priority', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    if (isTableMissingError(error)) {
      console.warn("Tabla 'public.offers' no encontrada en Supabase.");
      return [];
    }
    throw new Error(`Error al obtener ofertas: ${error.message}`);
  }

  return (rawOffers || []).map((item: any) => ({
    id: item.id,
    name: item.name,
    description: item.description,
    type: item.type as OfferType,
    value: Number(item.value) || 0,
    priority: Number(item.priority) || 0,
    start_date: item.start_date,
    end_date: item.end_date,
    status: item.status as OfferStatus,
    is_global: Boolean(item.is_global),
    created_at: item.created_at,
    updated_at: item.updated_at,
    product_ids: item.offer_products ? item.offer_products.map((p: any) => p.product_id) : [],
    category_ids: item.offer_categories ? item.offer_categories.map((c: any) => c.category_id) : [],
  }));
}

export async function createOffer(data: {
  name: string;
  description?: string;
  type: OfferType;
  value: number;
  priority?: number;
  start_date: string;
  end_date: string;
  status?: OfferStatus;
  is_global: boolean;
  product_ids?: string[];
  category_ids?: string[];
}): Promise<Offer> {
  if (!data.name?.trim()) throw new Error('El nombre de la oferta es obligatorio.');
  if (data.value <= 0) throw new Error('El valor del descuento debe ser mayor a cero.');
  if (data.type === 'percentage' && data.value > 100) {
    throw new Error('El porcentaje no puede ser mayor al 100%.');
  }
  if (new Date(data.end_date).getTime() <= new Date(data.start_date).getTime()) {
    throw new Error('La fecha final debe ser posterior a la fecha de inicio.');
  }

  const { data: newOffer, error } = await supabase
    .from('offers')
    .insert({
      name: data.name.trim(),
      description: data.description?.trim() || null,
      type: data.type,
      value: Number(data.value),
      priority: Number(data.priority || 0),
      start_date: data.start_date,
      end_date: data.end_date,
      status: data.status || 'active',
      is_global: data.is_global,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Error al crear oferta: ${error.message}`);
  }

  // Insert offer_products if not global
  if (!data.is_global && data.product_ids && data.product_ids.length > 0) {
    const productRows = data.product_ids.map((pid) => ({
      offer_id: newOffer.id,
      product_id: pid,
    }));
    await supabase.from('offer_products').insert(productRows);
  }

  // Insert offer_categories if not global
  if (!data.is_global && data.category_ids && data.category_ids.length > 0) {
    const catRows = data.category_ids.map((cid) => ({
      offer_id: newOffer.id,
      category_id: cid,
    }));
    await supabase.from('offer_categories').insert(catRows);
  }

  return {
    ...newOffer,
    value: Number(newOffer.value),
    priority: Number(newOffer.priority || 0),
    product_ids: data.product_ids || [],
    category_ids: data.category_ids || [],
  };
}

export async function updateOffer(
  id: string,
  data: Partial<Offer> & { product_ids?: string[]; category_ids?: string[] }
): Promise<void> {
  const payload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (data.name !== undefined) payload.name = data.name.trim();
  if (data.description !== undefined) payload.description = data.description?.trim() || null;
  if (data.type !== undefined) payload.type = data.type;
  if (data.value !== undefined) payload.value = Number(data.value);
  if (data.priority !== undefined) payload.priority = Number(data.priority);
  if (data.start_date !== undefined) payload.start_date = data.start_date;
  if (data.end_date !== undefined) payload.end_date = data.end_date;
  if (data.status !== undefined) payload.status = data.status;
  if (data.is_global !== undefined) payload.is_global = data.is_global;

  const { error } = await supabase.from('offers').update(payload).eq('id', id);
  if (error) {
    throw new Error(`Error al actualizar oferta: ${error.message}`);
  }

  if (data.product_ids !== undefined) {
    await supabase.from('offer_products').delete().eq('offer_id', id);
    if (!data.is_global && data.product_ids.length > 0) {
      const rows = data.product_ids.map((pid) => ({
        offer_id: id,
        product_id: pid,
      }));
      await supabase.from('offer_products').insert(rows);
    }
  }

  if (data.category_ids !== undefined) {
    await supabase.from('offer_categories').delete().eq('offer_id', id);
    if (!data.is_global && data.category_ids.length > 0) {
      const rows = data.category_ids.map((cid) => ({
        offer_id: id,
        category_id: cid,
      }));
      await supabase.from('offer_categories').insert(rows);
    }
  }
}

export async function deleteOffer(id: string): Promise<void> {
  const { error } = await supabase.from('offers').delete().eq('id', id);
  if (error) {
    throw new Error(`Error al eliminar oferta: ${error.message}`);
  }
}

export async function setOfferStatus(id: string, status: OfferStatus): Promise<void> {
  const { error } = await supabase
    .from('offers')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    throw new Error(`Error al cambiar estado de la oferta: ${error.message}`);
  }
}
