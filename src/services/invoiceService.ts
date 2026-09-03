import { supabase } from './supabase';
import { Invoice, InvoiceStatus, PaymentMethod, Sale, Payment } from '../types';
import { getOrder } from './orderService';

export async function getInvoices(statusFilter?: InvoiceStatus): Promise<Invoice[]> {
  let query = supabase
    .from('invoices')
    .select('*, items:invoice_items(*)')
    .order('created_at', { ascending: false });

  if (statusFilter) {
    query = query.eq('status', statusFilter);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`Error al obtener facturas de Supabase: ${error.message}`);
  }

  return (data || []).map((inv: any) => ({
    ...inv,
    subtotal: Number(inv.subtotal) || 0,
    discount: Number(inv.discount) || 0,
    tax: Number(inv.tax) || 0,
    total: Number(inv.total) || 0,
    items: (inv.items || []).map((it: any) => ({
      ...it,
      original_unit_price: Number(it.original_unit_price) || 0,
      unit_price: Number(it.unit_price) || 0,
      discount_amount: Number(it.discount_amount) || 0,
      total: Number(it.total) || 0,
    })),
  }));
}

export async function getInvoice(id: string): Promise<Invoice | null> {
  const { data, error } = await supabase
    .from('invoices')
    .select('*, items:invoice_items(*)')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    throw new Error(`Error al obtener factura: ${error.message}`);
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
      total: Number(it.total) || 0,
    })),
  };
}

export async function getInvoiceByOrderId(orderId: string): Promise<Invoice | null> {
  const { data, error } = await supabase
    .from('invoices')
    .select('*, items:invoice_items(*)')
    .eq('order_id', orderId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Error al obtener factura del pedido: ${error.message}`);
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
      total: Number(it.total) || 0,
    })),
  };
}

export async function processPaymentAndIssueInvoice(payload: {
  order_id: string;
  payment_method: PaymentMethod;
  amount: number;
  reference?: string | null;
  cashier_name?: string;
}): Promise<{
  invoice_id: string;
  invoice_number: string;
  payment_id: string;
}> {
  // 1. Try atomic stored procedure
  try {
    const { data: rpcData, error: rpcError } = await supabase.rpc('process_payment_and_invoice', {
      p_order_id: payload.order_id,
      p_payment_method: payload.payment_method,
      p_amount: payload.amount,
      p_reference: payload.reference || null,
      p_cashier_name: payload.cashier_name || 'Admin BIKIE',
    });

    if (!rpcError && rpcData?.invoice_id) {
      return {
        invoice_id: rpcData.invoice_id,
        invoice_number: rpcData.invoice_number,
        payment_id: rpcData.payment_id,
      };
    }
  } catch (rpcErr) {
    console.warn('RPC process_payment_and_invoice failed or not present, running sequential transaction:', rpcErr);
  }

  // 2. Sequential Supabase execution
  const order = await getOrder(payload.order_id);
  if (!order) throw new Error('Pedido no encontrado');

  // Insert payment
  const { data: paymentData, error: payError } = await supabase
    .from('payments')
    .insert({
      order_id: order.id,
      amount: payload.amount,
      method: payload.payment_method,
      status: 'confirmed',
      reference: payload.reference || null,
      notes: `Cobrado por ${payload.cashier_name || 'Admin BIKIE'}`,
      paid_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (payError) {
    throw new Error(`Error al registrar el pago: ${payError.message}`);
  }

  // Generate invoice number
  const year = new Date().getFullYear();
  const invoiceNumber = `BIKIE-${year}-${Math.floor(100000 + Math.random() * 900000)}`;

  const { data: newInvoice, error: invError } = await supabase
    .from('invoices')
    .insert({
      invoice_number: invoiceNumber,
      order_id: order.id,
      customer_id: order.customer_id,
      customer_name: order.customer_name,
      customer_id_doc: null,
      customer_phone: order.customer_phone,
      customer_address: order.delivery_address,
      subtotal: order.subtotal,
      discount: order.discount,
      tax: order.tax,
      total: order.total,
      currency: 'XAF',
      payment_method: payload.payment_method,
      payment_status: 'confirmed',
      status: 'paid',
      notes: 'Factura oficial BIKIE Papelería',
      paid_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (invError || !newInvoice) {
    throw new Error(`Error al emitir factura: ${invError?.message || 'Error desconocido'}`);
  }

  // Copy order items to invoice items
  if (order.items && order.items.length > 0) {
    const invoiceItemRows = order.items.map((item) => ({
      invoice_id: newInvoice.id,
      product_id: item.product_id,
      product_name: item.product_name,
      quantity: item.quantity,
      original_unit_price: item.original_unit_price,
      unit_price: item.unit_price,
      discount_amount: item.discount_amount,
      total: item.total_price,
    }));

    await supabase.from('invoice_items').insert(invoiceItemRows);
  }

  // Record sale
  const saleNumber = `VEN-${year}-${Math.floor(100000 + Math.random() * 900000)}`;
  await supabase.from('sales').insert({
    sale_number: saleNumber,
    order_id: order.id,
    invoice_id: newInvoice.id,
    payment_id: paymentData.id,
    customer_name: order.customer_name,
    total_amount: order.total,
    payment_method: payload.payment_method,
    cashier_name: payload.cashier_name || 'Admin BIKIE',
  });

  // Update order status
  await supabase
    .from('orders')
    .update({
      payment_status: 'confirmed',
      status: order.status === 'pending' ? 'accepted' : order.status,
      updated_at: new Date().toISOString(),
    })
    .eq('id', order.id);

  // Status history
  await supabase.from('order_status_history').insert({
    order_id: order.id,
    previous_status: order.status,
    new_status: order.status === 'pending' ? 'accepted' : order.status,
    changed_by: payload.cashier_name || 'Admin BIKIE',
    note: `Pago confirmado y Factura ${invoiceNumber} emitida`,
  });

  // Notification
  try {
    await supabase.from('notifications').insert({
      type: 'invoice_created',
      title: `Factura ${invoiceNumber} emitida`,
      message: `El pedido #${order.order_number} ha sido pagado y facturado con éxito.`,
      order_id: order.id,
      invoice_id: newInvoice.id,
    });
  } catch (err) {
    console.warn('Could not insert notification:', err);
  }

  return {
    invoice_id: newInvoice.id,
    invoice_number: invoiceNumber,
    payment_id: paymentData.id,
  };
}

export async function getSales(): Promise<Sale[]> {
  const { data, error } = await supabase
    .from('sales')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Error al obtener ventas: ${error.message}`);
  }

  return (data || []).map((s: any) => ({
    ...s,
    total_amount: Number(s.total_amount) || 0,
  }));
}

export async function getPayments(): Promise<Payment[]> {
  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Error al obtener pagos: ${error.message}`);
  }

  return (data || []).map((p: any) => ({
    ...p,
    amount: Number(p.amount) || 0,
  }));
}

export async function cancelInvoice(
  invoiceId: string,
  reason = 'Anulación de factura por administrador'
): Promise<Invoice> {
  const invoice = await getInvoice(invoiceId);
  if (!invoice) throw new Error('Factura no encontrada');
  if (invoice.status === 'cancelled') throw new Error('La factura ya está anulada');

  const notes = invoice.notes ? `${invoice.notes} | Anulada: ${reason}` : `Anulada: ${reason}`;

  const { data, error } = await supabase
    .from('invoices')
    .update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      notes,
    })
    .eq('id', invoiceId)
    .select('*, items:invoice_items(*)')
    .single();

  if (error) {
    throw new Error(`Error al anular la factura: ${error.message}`);
  }

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
      total: Number(it.total) || 0,
    })),
  };
}

export async function deleteInvoice(invoiceId: string): Promise<boolean> {
  try {
    // 1. Delete associated invoice_items
    await supabase.from('invoice_items').delete().eq('invoice_id', invoiceId);

    // 2. Delete sales linked to this invoice
    await supabase.from('sales').delete().eq('invoice_id', invoiceId);

    // 3. Delete invoice
    const { error } = await supabase.from('invoices').delete().eq('id', invoiceId);
    if (error) {
      throw new Error(`Error al eliminar factura de Supabase: ${error.message}`);
    }
  } catch (err: any) {
    console.warn('Error deleting invoice from Supabase:', err);
    throw err;
  }
  return true;
}

export async function processDirectPosSale(payload: {
  customer_name: string;
  customer_phone?: string;
  customer_id_doc?: string;
  customer_address?: string;
  items: Array<{
    product_id: string;
    product_name: string;
    quantity: number;
    original_unit_price: number;
    unit_price: number;
    discount_amount: number;
    total: number;
  }>;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  payment_method: PaymentMethod;
  reference?: string | null;
  cashier_name?: string;
  notes?: string | null;
}): Promise<{
  invoice_id: string;
  invoice_number: string;
  order_id: string;
  order_number: string;
  invoice: Invoice;
}> {
  if (!payload.items || payload.items.length === 0) {
    throw new Error('La venta debe contener al menos un producto.');
  }

  // 1. Try atomic PostgreSQL RPC execution (ACID with FOR UPDATE locks)
  try {
    const { data: rpcData, error: rpcError } = await supabase.rpc('process_pos_sale_atomic', {
      p_customer_name: payload.customer_name.trim() || 'Cliente Mostrador',
      p_customer_phone: payload.customer_phone?.trim() || 'N/A',
      p_customer_address: payload.customer_address?.trim() || 'Mostrador POS BIKIE',
      p_items: payload.items,
      p_subtotal: payload.subtotal,
      p_discount: payload.discount,
      p_tax: payload.tax,
      p_total: payload.total,
      p_payment_method: payload.payment_method,
      p_reference: payload.reference || null,
      p_cashier_name: payload.cashier_name || 'Admin BIKIE',
      p_notes: payload.notes || 'Venta directa en caja mostrador',
    });

    if (rpcError) {
      if (rpcError.message && (rpcError.message.includes('Stock insuficiente') || rpcError.message.includes('denegada'))) {
        throw new Error(rpcError.message);
      }
      throw rpcError;
    }

    if (rpcData?.success && rpcData?.invoice_id) {
      const fullInvoice = await getInvoice(rpcData.invoice_id);
      if (fullInvoice) {
        return {
          invoice_id: rpcData.invoice_id,
          invoice_number: rpcData.invoice_number,
          order_id: rpcData.order_id,
          order_number: rpcData.order_number,
          invoice: fullInvoice,
        };
      }
    }
  } catch (err: any) {
    if (err.message && (err.message.includes('Stock insuficiente') || err.message.includes('denegada'))) {
      throw err;
    }
    console.warn('RPC process_pos_sale_atomic not available or failed, falling back to direct operations:', err);
  }

  // 2. Direct operations fallback
  const year = new Date().getFullYear();
  const randNum = Math.floor(10000 + Math.random() * 90000);
  const orderNumber = `POS-${year}-${randNum}`;

  // Validate stock
  for (const item of payload.items) {
    const { data: prod } = await supabase.from('products').select('stock, name').eq('id', item.product_id).single();
    if (prod && prod.stock < item.quantity) {
      throw new Error(`Stock insuficiente para "${prod.name}". Disponible: ${prod.stock}, Solicitado: ${item.quantity}`);
    }
  }

  // Create order
  const { data: order, error: orderErr } = await supabase
    .from('orders')
    .insert({
      order_number: orderNumber,
      customer_name: payload.customer_name.trim() || 'Cliente Mostrador',
      customer_phone: payload.customer_phone?.trim() || 'N/A',
      customer_email: null,
      delivery_address: payload.customer_address?.trim() || 'Mostrador POS BIKIE',
      subtotal: payload.subtotal,
      discount: payload.discount,
      tax: payload.tax,
      total: payload.total,
      status: 'delivered',
      payment_method: payload.payment_method,
      payment_status: 'confirmed',
      notes: payload.notes || 'Venta directa en caja mostrador',
    })
    .select()
    .single();

  if (orderErr || !order) {
    throw new Error(`Error al crear pedido de venta POS: ${orderErr?.message}`);
  }

  // Order items and deduct stock
  for (const it of payload.items) {
    await supabase.from('order_items').insert({
      order_id: order.id,
      product_id: it.product_id,
      product_name: it.product_name,
      quantity: it.quantity,
      original_unit_price: it.original_unit_price,
      unit_price: it.unit_price,
      discount_amount: it.discount_amount,
      total_price: it.total,
    });

    const { data: prod } = await supabase.from('products').select('stock').eq('id', it.product_id).single();
    if (prod) {
      const newStock = Math.max(0, prod.stock - it.quantity);
      await supabase.from('products').update({ stock: newStock }).eq('id', it.product_id);

      await supabase.from('inventory_movements').insert({
        product_id: it.product_id,
        type: 'sale',
        quantity: it.quantity,
        previous_stock: prod.stock,
        new_stock: newStock,
        order_id: order.id,
        note: `Venta Directa POS #${orderNumber}`,
      });
    }
  }

  // Process payment and invoice
  const res = await processPaymentAndIssueInvoice({
    order_id: order.id,
    payment_method: payload.payment_method,
    amount: payload.total,
    reference: payload.reference,
    cashier_name: payload.cashier_name || 'Admin BIKIE',
  });

  const fullInvoice = await getInvoice(res.invoice_id);
  if (!fullInvoice) {
    throw new Error('Error al recuperar factura generada');
  }

  return {
    invoice_id: res.invoice_id,
    invoice_number: res.invoice_number,
    order_id: order.id,
    order_number: orderNumber,
    invoice: fullInvoice,
  };
}
