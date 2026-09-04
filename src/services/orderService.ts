import { supabase } from './supabase';
import { Order, OrderStatus, PaymentMethod } from '../types';
import { playNewOrderChime } from '../utils/audio';

export async function getOrders(statusFilter?: OrderStatus): Promise<Order[]> {
  let query = supabase
    .from('orders')
    .select('*, items:order_items(*), history:order_status_history(*), payments(*)')
    .order('created_at', { ascending: false });

  if (statusFilter) {
    query = query.eq('status', statusFilter);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`Error al obtener pedidos de Supabase: ${error.message}`);
  }

  return (data || []).map((o: any) => ({
    ...o,
    subtotal: Number(o.subtotal) || 0,
    discount: Number(o.discount) || 0,
    tax: Number(o.tax) || 0,
    total: Number(o.total) || 0,
    items: (o.items || []).map((it: any) => ({
      ...it,
      original_unit_price: Number(it.original_unit_price) || 0,
      unit_price: Number(it.unit_price) || 0,
      discount_amount: Number(it.discount_amount) || 0,
      total_price: Number(it.total_price) || 0,
    })),
  }));
}

export async function getOrder(id: string): Promise<Order | null> {
  const { data, error } = await supabase
    .from('orders')
    .select('*, items:order_items(*), history:order_status_history(*), payments(*)')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    throw new Error(`Error al obtener pedido: ${error.message}`);
  }
  if (!data) return null;

  return {
    ...data,
    subtotal: Number(data.subtotal) || 0,
    discount: Number(data.discount) || 0,
    tax: Number(data.tax) || 0,
    total: Number(data.total) || 0,
    items: (data.items || []).map((it: any) => ({
      ...it,
      original_unit_price: Number(it.original_unit_price) || 0,
      unit_price: Number(it.unit_price) || 0,
      discount_amount: Number(it.discount_amount) || 0,
      total_price: Number(it.total_price) || 0,
    })),
  };
}

export async function getOrderByNumber(orderNumber: string): Promise<Order | null> {
  const cleanNumber = (orderNumber || '').trim().toUpperCase();
  if (!cleanNumber) return null;

  // CRÍTICO: Rastrear únicamente mediante el RPC seguro track_order.
  // Prohíbe fallbacks directos que puedan exponer PII (teléfono, email, dirección, notas privadas).
  const { data: rpcOrder, error: rpcError } = await supabase.rpc('track_order', {
    p_order_number: cleanNumber,
  });

  if (rpcError) {
    throw new Error(`Error al consultar el pedido: ${rpcError.message}`);
  }

  if (!rpcOrder || !rpcOrder.id) {
    return null;
  }

  return {
    ...rpcOrder,
    subtotal: Number(rpcOrder.subtotal) || 0,
    discount: Number(rpcOrder.discount) || 0,
    tax: Number(rpcOrder.tax) || 0,
    total: Number(rpcOrder.total) || 0,
    items: (rpcOrder.items || []).map((it: any) => ({
      ...it,
      unit_price: Number(it.unit_price) || 0,
      total_price: Number(it.total_price) || 0,
    })),
    history: rpcOrder.history || [],
  };
}

export interface CreateOrderPayload {
  customer_name: string;
  customer_phone: string;
  customer_email?: string | null;
  delivery_address?: string | null;
  payment_method: PaymentMethod;
  notes?: string | null;
  client_request_id?: string;
  items: {
    product_id: string;
    product_name: string;
    quantity: number;
    original_unit_price: number;
    unit_price: number;
    discount_amount: number;
    total_price: number;
  }[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
}

export async function createOrder(payload: CreateOrderPayload): Promise<{
  order_id: string;
  order_number: string;
}> {
  if (!payload.items || payload.items.length === 0) {
    throw new Error('El pedido debe contener al menos un producto.');
  }
  if (!payload.customer_name?.trim()) {
    throw new Error('El nombre del cliente es obligatorio.');
  }
  if (!payload.customer_phone?.trim()) {
    throw new Error('El teléfono del cliente es obligatorio.');
  }

  const clientRequestId = payload.client_request_id || `req-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

  // Ejecución atómica y segura exclusiva en Supabase (servidor)
  // Precios recalculados en base de datos, bloqueo con FOR UPDATE, número generado por secuencia
  const { data: rpcData, error: rpcError } = await supabase.rpc('create_order_atomic', {
    p_order_number: null,
    p_client_request_id: clientRequestId,
    p_customer_name: payload.customer_name.trim(),
    p_customer_phone: payload.customer_phone.trim(),
    p_customer_email: payload.customer_email?.trim() || null,
    p_delivery_address: payload.delivery_address?.trim() || null,
    p_payment_method: payload.payment_method,
    p_notes: payload.notes?.trim() || null,
    p_items: payload.items.map((it) => ({
      product_id: it.product_id,
      quantity: it.quantity,
    })),
  });

  if (rpcError) {
    throw new Error(rpcError.message || 'Error al procesar el pedido de forma atómica en Supabase.');
  }

  if (!rpcData || !rpcData.order_id) {
    throw new Error('No se pudo confirmar la creación del pedido en el servidor.');
  }

  playNewOrderChime();
  return {
    order_id: rpcData.order_id,
    order_number: rpcData.order_number,
  };
}

export async function updateOrderStatus(
  orderId: string,
  newStatus: OrderStatus,
  changedBy = 'Administrador',
  note?: string
): Promise<void> {
  const { data: rpcData, error: rpcError } = await supabase.rpc('update_order_status_atomic', {
    p_order_id: orderId,
    p_new_status: newStatus,
    p_note: note || `Estado actualizado a ${newStatus}`,
    p_changed_by: changedBy,
  });

  if (rpcError) {
    // Si la función atómica aún no ha sido migrada, realizar actualización segura con RLS admin
    const { error: updateError } = await supabase
      .from('orders')
      .update({
        status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId);

    if (updateError) {
      throw new Error(`Error al actualizar estado del pedido: ${updateError.message}`);
    }
    return;
  }

  if (!rpcData?.success) {
    throw new Error('No se pudo actualizar el estado del pedido.');
  }
}

export async function cancelOrder(
  orderId: string,
  reason: string,
  cancelledBy = 'Administrador'
): Promise<void> {
  // Cancelación atómica con restitución estricta de inventario en base de datos
  const { data: rpcData, error: rpcError } = await supabase.rpc('cancel_order_with_stock_return', {
    p_order_id: orderId,
    p_reason: reason,
    p_cancelled_by: cancelledBy,
  });

  if (rpcError) {
    throw new Error(`Error al cancelar el pedido: ${rpcError.message}`);
  }

  if (!rpcData?.success) {
    throw new Error('No se pudo completar la cancelación y restitución de inventario.');
  }
}
