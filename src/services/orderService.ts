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
  const { data, error } = await supabase
    .from('orders')
    .select('*, items:order_items(*), history:order_status_history(*), payments(*)')
    .ilike('order_number', cleanNumber)
    .maybeSingle();

  if (error) {
    throw new Error(`Error al buscar pedido: ${error.message}`);
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

  const orderNumber = `BIK-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;
  const clientRequestId = payload.client_request_id || `req-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

  // 1. Try atomic RPC function first
  try {
    const { data: rpcData, error: rpcError } = await supabase.rpc('create_order_atomic', {
      p_order_number: orderNumber,
      p_client_request_id: clientRequestId,
      p_customer_name: payload.customer_name.trim(),
      p_customer_phone: payload.customer_phone.trim(),
      p_customer_email: payload.customer_email?.trim() || null,
      p_delivery_address: payload.delivery_address?.trim() || null,
      p_payment_method: payload.payment_method,
      p_notes: payload.notes?.trim() || null,
      p_items: payload.items,
    });

    if (rpcError) {
      if (rpcError.message && (rpcError.message.includes('Stock insuficiente') || rpcError.message.includes('denegada'))) {
        throw new Error(rpcError.message);
      }
      throw rpcError;
    }

    if (rpcData?.order_id) {
      playNewOrderChime();
      return {
        order_id: rpcData.order_id,
        order_number: rpcData.order_number || orderNumber,
      };
    }
  } catch (rpcErr: any) {
    if (rpcErr.message && (rpcErr.message.includes('Stock insuficiente') || rpcErr.message.includes('denegada'))) {
      throw rpcErr;
    }
    console.warn('RPC create_order_atomic fallback to direct table inserts:', rpcErr);
  }

  // 2. Direct Supabase transactional inserts
  // Stock validation
  for (const item of payload.items) {
    const { data: product, error: pError } = await supabase
      .from('products')
      .select('stock, name')
      .eq('id', item.product_id)
      .single();

    if (pError || !product) {
      throw new Error(`Producto no encontrado en inventario: ${item.product_name}`);
    }
    if (product.stock < item.quantity) {
      throw new Error(`Stock insuficiente para "${product.name}". Disponible: ${product.stock}, Solicitado: ${item.quantity}.`);
    }
  }

  // Insert order
  const { data: newOrder, error: orderError } = await supabase
    .from('orders')
    .insert({
      order_number: orderNumber,
      client_request_id: clientRequestId,
      customer_name: payload.customer_name.trim(),
      customer_phone: payload.customer_phone.trim(),
      customer_email: payload.customer_email?.trim() || null,
      delivery_address: payload.delivery_address?.trim() || null,
      subtotal: payload.subtotal,
      discount: payload.discount,
      tax: payload.tax,
      total: payload.total,
      status: 'pending',
      payment_method: payload.payment_method,
      payment_status: 'pending',
      notes: payload.notes?.trim() || null,
    })
    .select()
    .single();

  if (orderError || !newOrder) {
    throw new Error(`Error al registrar el pedido en Supabase: ${orderError?.message || 'Error desconocido'}`);
  }

  // Insert order items and deduct stock
  for (const item of payload.items) {
    await supabase.from('order_items').insert({
      order_id: newOrder.id,
      product_id: item.product_id,
      product_name: item.product_name,
      quantity: item.quantity,
      original_unit_price: item.original_unit_price,
      unit_price: item.unit_price,
      discount_amount: item.discount_amount,
      total_price: item.total_price,
    });

    // Deduct stock & create Kardex entry
    const { data: prod } = await supabase.from('products').select('stock').eq('id', item.product_id).single();
    if (prod) {
      const newStock = Math.max(0, prod.stock - item.quantity);
      await supabase.from('products').update({ stock: newStock }).eq('id', item.product_id);

      await supabase.from('inventory_movements').insert({
        product_id: item.product_id,
        type: 'sale',
        quantity: item.quantity,
        previous_stock: prod.stock,
        new_stock: newStock,
        order_id: newOrder.id,
        note: `Venta en Pedido #${orderNumber}`,
      });
    }
  }

  // Record status history
  await supabase.from('order_status_history').insert({
    order_id: newOrder.id,
    previous_status: null,
    new_status: 'pending',
    changed_by: 'Cliente / Web',
    note: 'Pedido registrado exitosamente en Supabase',
  });

  // Notification for admin
  try {
    await supabase.from('notifications').insert({
      type: 'new_order',
      title: `¡Nuevo Pedido ${orderNumber}!`,
      message: `El cliente ${payload.customer_name} ha realizado un pedido por un total de ${payload.total} FCFA.`,
      order_id: newOrder.id,
    });
  } catch (err) {
    console.warn('Could not insert notification:', err);
  }

  playNewOrderChime();

  return {
    order_id: newOrder.id,
    order_number: orderNumber,
  };
}

export async function updateOrderStatus(
  orderId: string,
  newStatus: OrderStatus,
  changedBy = 'Administrador',
  note?: string
): Promise<void> {
  const current = await getOrder(orderId);
  if (!current) throw new Error('Pedido no encontrado');

  const { error } = await supabase
    .from('orders')
    .update({
      status: newStatus,
      updated_at: new Date().toISOString(),
    })
    .eq('id', orderId);

  if (error) {
    throw new Error(`Error al actualizar estado del pedido: ${error.message}`);
  }

  await supabase.from('order_status_history').insert({
    order_id: orderId,
    previous_status: current.status,
    new_status: newStatus,
    changed_by: changedBy,
    note: note || `Estado actualizado a ${newStatus}`,
  });
}

export async function cancelOrder(
  orderId: string,
  reason: string,
  cancelledBy = 'Administrador'
): Promise<void> {
  // Try atomic RPC function
  try {
    const { data: rpcData, error: rpcError } = await supabase.rpc('cancel_order_with_stock_return', {
      p_order_id: orderId,
      p_reason: reason,
      p_cancelled_by: cancelledBy,
    });

    if (!rpcError && rpcData?.success) {
      return;
    }
  } catch {
    // Continue with manual direct cancellation
  }

  const current = await getOrder(orderId);
  if (!current) throw new Error('Pedido no encontrado');
  if (current.status === 'cancelled') {
    throw new Error('El pedido ya se encuentra cancelado.');
  }

  // Return stock
  if (current.items && current.items.length > 0) {
    for (const item of current.items) {
      if (item.product_id) {
        const { data: prod } = await supabase.from('products').select('stock').eq('id', item.product_id).single();
        if (prod) {
          const newStock = prod.stock + item.quantity;
          await supabase.from('products').update({ stock: newStock }).eq('id', item.product_id);

          await supabase.from('inventory_movements').insert({
            product_id: item.product_id,
            type: 'refund',
            quantity: item.quantity,
            previous_stock: prod.stock,
            new_stock: newStock,
            order_id: orderId,
            note: `Reintegro por cancelación de Pedido #${current.order_number}: ${reason}`,
          });
        }
      }
    }
  }

  const { error } = await supabase
    .from('orders')
    .update({
      status: 'cancelled',
      updated_at: new Date().toISOString(),
    })
    .eq('id', orderId);

  if (error) {
    throw new Error(`Error al cancelar pedido: ${error.message}`);
  }

  await supabase.from('order_status_history').insert({
    order_id: orderId,
    previous_status: current.status,
    new_status: 'cancelled',
    changed_by: cancelledBy,
    note: `Cancelado: ${reason}`,
  });
}
