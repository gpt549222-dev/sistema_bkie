import { supabase, isTableMissingError } from './supabase';
import { Purchase } from '../types';

export async function getPurchases(): Promise<Purchase[]> {
  const { data, error } = await supabase
    .from('purchases')
    .select('*, supplier:suppliers(*), items:purchase_items(*)')
    .order('created_at', { ascending: false });

  if (error) {
    if (isTableMissingError(error)) {
      console.warn("Tabla 'public.purchases' no encontrada. Ejecuta MODIF_DB.sql en Supabase.");
      return [];
    }
    throw new Error(`Error al obtener compras: ${error.message}`);
  }

  return (data || []).map((p: any) => ({
    ...p,
    total_amount: Number(p.total_amount) || 0,
    supplier_name: p.supplier?.name || 'Proveedor General',
    items: (p.items || []).map((it: any) => ({
      ...it,
      quantity: Number(it.quantity) || 0,
      cost_price: Number(it.cost_price) || 0,
      total_cost: Number(it.total_cost) || 0,
    })),
  }));
}

export async function createPurchase(payload: {
  supplier_id?: string | null;
  supplier_name?: string | null;
  items: Array<{
    product_id: string;
    product_name?: string;
    quantity: number;
    cost_price: number;
  }>;
  notes?: string | null;
  created_by?: string | null;
}): Promise<{ purchase_id: string; purchase_number: string }> {
  if (!payload.items || payload.items.length === 0) {
    throw new Error('La compra debe contener al menos un producto.');
  }

  for (const item of payload.items) {
    if (!item.product_id) {
      throw new Error('Todos los ítems de compra deben tener un producto válido.');
    }
    if (item.quantity <= 0) {
      throw new Error('La cantidad de cada producto debe ser mayor a cero.');
    }
    if (item.cost_price < 0) {
      throw new Error('El costo unitario no puede ser negativo.');
    }
  }

  // Ejecución atómica y transaccional exclusiva en PostgreSQL vía RPC
  const { data: rpcData, error: rpcError } = await supabase.rpc('register_purchase_atomic', {
    p_supplier_id: payload.supplier_id || null,
    p_notes: payload.notes || null,
    p_created_by: payload.created_by || 'Admin BIKIE',
    p_items: payload.items.map((it) => ({
      product_id: it.product_id,
      quantity: Math.floor(it.quantity),
      cost_price: Number(it.cost_price),
    })),
  });

  if (rpcError) {
    console.error('[purchaseService] Error en RPC register_purchase_atomic:', rpcError);
    throw new Error(rpcError.message || 'Error al registrar la compra en la base de datos.');
  }

  if (!rpcData?.success || !rpcData?.purchase_id) {
    throw new Error(rpcData?.message || 'No se pudo registrar la compra en el servidor.');
  }

  return {
    purchase_id: rpcData.purchase_id,
    purchase_number: rpcData.purchase_number,
  };
}

export async function deletePurchase(purchaseId: string): Promise<void> {
  await supabase.from('purchase_items').delete().eq('purchase_id', purchaseId);
  const { error } = await supabase.from('purchases').delete().eq('id', purchaseId);
  if (error) {
    throw new Error(`Error al eliminar compra: ${error.message}`);
  }
}
