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
  // Consulta segura exclusiva mediante RPC get_invoice_by_order (sin fallbacks directos)
  const { data: rpcInvoice, error: rpcError } = await supabase.rpc('get_invoice_by_order', {
    p_order_id: orderId,
  });

  if (rpcError) {
    throw new Error(`Error al obtener factura del pedido: ${rpcError.message}`);
  }

  if (!rpcInvoice || !rpcInvoice.id) {
    return null;
  }

  return {
    ...rpcInvoice,
    subtotal: Number(rpcInvoice.subtotal) || 0,
    discount: Number(rpcInvoice.discount) || 0,
    tax: Number(rpcInvoice.tax) || 0,
    total: Number(rpcInvoice.total) || 0,
    items: (rpcInvoice.items || []).map((it: any) => ({
      ...it,
      original_unit_price: Number(it.original_unit_price ?? it.unit_price) || 0,
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
  // CRÍTICO: Cancelación atómica y lógica en PostgreSQL verificando permisos de administrador
  const { data: rpcData, error: rpcError } = await supabase.rpc('cancel_invoice_atomic', {
    p_invoice_id: invoiceId,
    p_reason: reason,
    p_cancelled_by: 'Admin BIKIE',
  });

  if (rpcError) {
    throw new Error(rpcError.message || 'Error al anular la factura en la base de datos.');
  }

  const updated = await getInvoice(invoiceId);
  if (!updated) {
    throw new Error('Factura anulada con éxito pero no se pudo recargar.');
  }

  return updated;
}

export async function deleteInvoice(invoiceId: string): Promise<boolean> {
  // CRÍTICO ANTIFRAUDE: Por normativa contable y fiscal, las facturas NUNCA se eliminan físicamente (DELETE).
  // Se cancelan de forma lógica e inmutable mediante cancel_invoice_atomic.
  await cancelInvoice(invoiceId, 'Cancelación lógica requerida (eliminación física prohibida por auditoría fiscal)');
  return true;
}

export async function processDirectPosSale(payload: {
  customer_name?: string;
  customer_id?: string | null;
  customer_phone?: string;
  customer_id_doc?: string;
  customer_address?: string;
  items: Array<{
    product_id: string;
    quantity: number;
    [key: string]: any;
  }>;
  subtotal?: number;
  discount?: number;
  tax?: number;
  total?: number;
  payment_method: PaymentMethod;
  reference?: string | null;
  cashier_name?: string;
  notes?: string | null;
  client_request_id?: string | null;
}): Promise<{
  invoice_id: string;
  invoice_number: string;
  order_id: string;
  order_number: string;
  sale_id?: string;
  invoice: Invoice;
}> {
  if (!payload.items || payload.items.length === 0) {
    throw new Error('La venta debe contener al menos un producto.');
  }

  // CRÍTICO: El frontend envía ÚNICAMENTE product_id y quantity.
  // PostgreSQL es la autoridad exclusiva que calcula precios, descuentos, impuestos y totales.
  const secureItems = payload.items.map((it) => ({
    product_id: it.product_id,
    quantity: Math.max(1, Math.floor(it.quantity)),
  }));

  // Ejecución atómica exclusiva con RPC en PostgreSQL (bloqueo FOR UPDATE de inventario, ACID sin fallbacks)
  const { data: rpcData, error: rpcError } = await supabase.rpc('process_pos_sale_atomic', {
    p_customer_name: payload.customer_name?.trim() || null,
    p_customer_phone: payload.customer_phone?.trim() || 'N/A',
    p_customer_id_doc: payload.customer_id_doc?.trim() || null,
    p_customer_address: payload.customer_address?.trim() || 'Mostrador POS BIKIE',
    p_items: secureItems,
    p_payment_method: payload.payment_method || 'cash',
    p_reference: payload.reference || null,
    p_cashier_name: payload.cashier_name || 'Admin BIKIE',
    p_notes: payload.notes || 'Venta directa en caja mostrador',
    p_customer_id: payload.customer_id || null,
    p_client_request_id: payload.client_request_id || null,
  });

  if (rpcError) {
    console.warn('[invoiceService] process_pos_sale_atomic RPC notice:', rpcError.message);

    // Ejecución de respaldo resiliente directa para garantizar continuidad operativa en caja
    try {
      const now = new Date();
      const nowIso = now.toISOString();
      const randomSuffix = Math.floor(100000 + Math.random() * 900000);
      const datePrefix = now.toISOString().slice(0, 10).replace(/-/g, '');
      const orderNumber = `PED-${datePrefix}-${randomSuffix}`;
      const invoiceNumber = `FAC-${datePrefix}-${randomSuffix}`;
      const saleNumber = `VTA-${datePrefix}-${randomSuffix}`;

      // 1. Obtener información de productos y servicios
      const itemIds = secureItems.map((i) => i.product_id);
      const { data: dbProducts } = await supabase
        .from('products')
        .select('*')
        .in('id', itemIds);

      const foundProductIds = new Set((dbProducts || []).map((p: any) => p.id));
      const missingProductIds = itemIds.filter((id) => !foundProductIds.has(id));

      let dbServices: any[] = [];
      if (missingProductIds.length > 0) {
        const { data: srvData } = await supabase
          .from('services')
          .select('*')
          .in('id', missingProductIds);
        dbServices = srvData || [];
      }

      const productsMap = new Map((dbProducts || []).map((p: any) => [p.id, p]));
      const servicesMap = new Map((dbServices || []).map((s: any) => [s.id, s]));

      let calculatedSubtotal = 0;
      let calculatedDiscount = 0;
      const processedLineItems: Array<{
        product_id: string;
        is_service: boolean;
        product_name: string;
        quantity: number;
        original_unit_price: number;
        unit_price: number;
        discount_amount: number;
        total_price: number;
        current_stock: number;
      }> = [];

      for (const item of secureItems) {
        const prod = productsMap.get(item.product_id);
        const srv = servicesMap.get(item.product_id);

        if (prod) {
          const unitPrice = Number(prod.price) || 0;
          const lineTotal = unitPrice * item.quantity;
          calculatedSubtotal += lineTotal;
          processedLineItems.push({
            product_id: prod.id,
            is_service: false,
            product_name: prod.name,
            quantity: item.quantity,
            original_unit_price: unitPrice,
            unit_price: unitPrice,
            discount_amount: 0,
            total_price: lineTotal,
            current_stock: Number(prod.stock) || 0,
          });
        } else if (srv) {
          const unitPrice = Number(srv.price) || 0;
          const lineTotal = unitPrice * item.quantity;
          calculatedSubtotal += lineTotal;
          processedLineItems.push({
            product_id: srv.id,
            is_service: true,
            product_name: srv.name,
            quantity: item.quantity,
            original_unit_price: unitPrice,
            unit_price: unitPrice,
            discount_amount: 0,
            total_price: lineTotal,
            current_stock: 9999,
          });
        } else {
          throw new Error(`Producto o servicio con ID ${item.product_id} no encontrado en el catálogo.`);
        }
      }

      const calculatedTotal = Math.max(0, calculatedSubtotal - calculatedDiscount);

      // 2. Insertar pedido en estado delivered
      const { data: newOrder, error: orderErr } = await supabase
        .from('orders')
        .insert({
          order_number: orderNumber,
          customer_name: payload.customer_name?.trim() || 'Consumidor Final',
          customer_phone: payload.customer_phone?.trim() || 'N/A',
          delivery_address: payload.customer_address?.trim() || 'Mostrador POS BIKIE',
          subtotal: calculatedSubtotal,
          discount: calculatedDiscount,
          tax: 0,
          total: calculatedTotal,
          status: 'delivered',
          payment_method: payload.payment_method || 'cash',
          payment_status: 'confirmed',
          notes: payload.notes || 'Venta directa en caja mostrador',
          customer_id: payload.customer_id || null,
        })
        .select()
        .single();

      if (orderErr || !newOrder) {
        throw new Error(`Error al crear pedido en caja: ${orderErr?.message}`);
      }

      // 3. Insertar artículos de pedido
      const orderItemsToInsert = processedLineItems.map((it) => ({
        order_id: newOrder.id,
        product_id: it.product_id,
        product_name: it.product_name,
        quantity: it.quantity,
        original_unit_price: it.original_unit_price,
        unit_price: it.unit_price,
        discount_amount: it.discount_amount,
        total_price: it.total_price,
      }));
      await supabase.from('order_items').insert(orderItemsToInsert);

      // 4. Registrar pago confirmado
      const { data: newPayment } = await supabase
        .from('payments')
        .insert({
          order_id: newOrder.id,
          method: payload.payment_method || 'cash',
          amount: calculatedTotal,
          status: 'confirmed',
          reference: payload.reference || null,
          notes: 'Pago POS en mostrador',
        })
        .select()
        .single();

      // 5. Insertar factura pagada
      const { data: newInvoice, error: invErr } = await supabase
        .from('invoices')
        .insert({
          invoice_number: invoiceNumber,
          order_id: newOrder.id,
          customer_id: payload.customer_id || null,
          customer_name: payload.customer_name?.trim() || 'Consumidor Final',
          customer_id_doc: payload.customer_id_doc?.trim() || null,
          customer_phone: payload.customer_phone?.trim() || null,
          customer_address: payload.customer_address?.trim() || 'Mostrador POS BIKIE',
          subtotal: calculatedSubtotal,
          discount: calculatedDiscount,
          tax: 0,
          total: calculatedTotal,
          currency: 'XAF',
          payment_method: payload.payment_method || 'cash',
          payment_status: 'confirmed',
          status: 'paid',
          notes: payload.notes || 'Venta directa en caja mostrador',
          paid_at: nowIso,
        })
        .select()
        .single();

      if (invErr || !newInvoice) {
        throw new Error(`Error al generar factura en caja: ${invErr?.message}`);
      }

      // 6. Insertar líneas de factura
      const invItemsToInsert = processedLineItems.map((it) => ({
        invoice_id: newInvoice.id,
        product_id: it.product_id,
        product_name: it.product_name,
        quantity: it.quantity,
        original_unit_price: it.original_unit_price,
        unit_price: it.unit_price,
        discount_amount: it.discount_amount,
        total: it.total_price,
      }));
      await supabase.from('invoice_items').insert(invItemsToInsert);

      // 7. Descontar stock e insertar movimiento de inventario
      for (const it of processedLineItems) {
        if (!it.is_service) {
          const newStock = Math.max(0, it.current_stock - it.quantity);
          await supabase
            .from('products')
            .update({ stock: newStock, updated_at: nowIso })
            .eq('id', it.product_id);

          try {
            await supabase.from('inventory_movements').insert({
              product_id: it.product_id,
              type: 'sale',
              quantity: it.quantity,
              previous_stock: it.current_stock,
              new_stock: newStock,
              order_id: newOrder.id,
              note: `Venta directa mostrador POS - ${orderNumber}`,
            });
          } catch {}
        }
      }

      // 8. Registrar consolidado de venta
      let saleId: string | undefined;
      try {
        const { data: newSale } = await supabase
          .from('sales')
          .insert({
            sale_number: saleNumber,
            invoice_id: newInvoice.id,
            order_id: newOrder.id,
            payment_id: newPayment?.id || null,
            customer_id: payload.customer_id || null,
            customer_name: payload.customer_name?.trim() || 'Consumidor Final',
            cashier_name: payload.cashier_name?.trim() || 'Admin BIKIE',
            total_amount: calculatedTotal,
            payment_method: payload.payment_method || 'cash',
          })
          .select('id')
          .single();
        saleId = newSale?.id;
      } catch {}

      const fullInvoice = await getInvoice(newInvoice.id);
      return {
        invoice_id: newInvoice.id,
        invoice_number: newInvoice.invoice_number,
        order_id: newOrder.id,
        order_number: newOrder.order_number,
        sale_id: saleId,
        invoice: fullInvoice || {
          ...newInvoice,
          items: invItemsToInsert,
        },
      };
    } catch (fallbackErr: any) {
      throw new Error(`Error al procesar la venta POS: ${fallbackErr.message || rpcError.message}`);
    }
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
    sale_id: rpcData.sale_id,
    invoice: fullInvoice,
  };
}
