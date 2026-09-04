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
  // 1. Try secure RPC get_invoice_by_order
  try {
    const { data: rpcInvoice, error: rpcError } = await supabase.rpc('get_invoice_by_order', {
      p_order_id: orderId,
    });

    if (!rpcError && rpcInvoice && rpcInvoice.id) {
      return {
        ...rpcInvoice,
        subtotal: Number(rpcInvoice.subtotal) || 0,
        discount: Number(rpcInvoice.discount) || 0,
        tax: Number(rpcInvoice.tax) || 0,
        total: Number(rpcInvoice.total) || 0,
        items: (rpcInvoice.items || []).map((it: any) => ({
          ...it,
          original_unit_price: Number(it.original_unit_price) || 0,
          unit_price: Number(it.unit_price) || 0,
          discount_amount: Number(it.discount_amount) || 0,
          total: Number(it.total) || 0,
        })),
      };
    }
  } catch (err) {
    console.warn('RPC get_invoice_by_order not available, trying direct query:', err);
  }

  // 2. Direct query fallback
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
  // Transacción atómica en PostgreSQL: inserta pago, actualiza pedido, genera factura e historial sin fallbacks
  const { data: rpcData, error: rpcError } = await supabase.rpc('process_payment_and_invoice', {
    p_order_id: payload.order_id,
    p_payment_method: payload.payment_method,
    p_amount: payload.amount,
    p_reference: payload.reference || null,
    p_cashier_name: payload.cashier_name || 'Admin BIKIE',
  });

  if (rpcError) {
    throw new Error(`Error al procesar el pago y emitir la factura: ${rpcError.message}`);
  }

  if (!rpcData || !rpcData.invoice_id) {
    throw new Error('No se pudo completar el cobro y emisión de la factura.');
  }

  return {
    invoice_id: rpcData.invoice_id,
    invoice_number: rpcData.invoice_number,
    payment_id: rpcData.payment_id,
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

  // Ejecución atómica exclusiva con RPC en PostgreSQL (bloqueo FOR UPDATE de inventario, ACID sin fallbacks)
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
    throw new Error(`Error al procesar la venta POS: ${rpcError.message}`);
  }

  if (!rpcData?.success || !rpcData?.invoice_id) {
    throw new Error('No se pudo registrar la venta en caja.');
  }

  const fullInvoice = await getInvoice(rpcData.invoice_id);
  if (!fullInvoice) {
    throw new Error('Error al recuperar la factura generada por el servidor.');
  }

  return {
    invoice_id: rpcData.invoice_id,
    invoice_number: rpcData.invoice_number,
    order_id: rpcData.order_id,
    order_number: rpcData.order_number,
    invoice: fullInvoice,
  };
}
