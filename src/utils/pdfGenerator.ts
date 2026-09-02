import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Invoice, BusinessSettings, Sale } from '../types';
import { formatCurrency } from './currency';

export function generateInvoicePDF(
  invoice: Invoice,
  settings?: BusinessSettings
): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const businessName = settings?.business_name || 'BIKIE Sistemas Informáticos';
  const taxId = settings?.rif_tax_id || '0214081-21';
  const phone = settings?.phone || '333098318 - 222544924 - 222213126';
  const address = settings?.address || 'BARRIO EL PARAISO (cerca la guardería "Los Chupetes") - Malabo / Bata, GE';

  // 1. Primary Header & Brand Accent in Corporate Red
  doc.setFillColor(220, 38, 38); // Corporate Red #dc2626
  doc.rect(0, 0, 210, 8, 'F');

  // Brand Logo Box
  doc.setFillColor(220, 38, 38);
  doc.roundedRect(14, 14, 12, 12, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.text('B', 17.5, 22.5);

  // Business Name & Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(20, 20, 20);
  doc.text((businessName || 'BIKIE PAPELERÍA').toUpperCase(), 30, 22);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(90, 90, 90);
  doc.text(`RIF / Identificación Fiscal: ${taxId}`, 30, 27);
  doc.text(`Dirección: ${address}`, 30, 32);
  doc.text(`Teléfono / WhatsApp: ${phone}`, 30, 37);

  // Invoice Meta Box
  doc.setFillColor(254, 242, 242); // Light red tinted white #fef2f2
  doc.setDrawColor(220, 38, 38);
  doc.setLineWidth(0.4);
  doc.roundedRect(125, 14, 71, 30, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(220, 38, 38);
  doc.text('FACTURA COMERCIAL', 130, 22);

  doc.setFontSize(9.5);
  doc.setTextColor(20, 20, 20);
  doc.text(`N°: ${invoice.invoice_number}`, 130, 29);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(90, 90, 90);
  const invoiceDate = invoice.paid_at || invoice.created_at;
  const formattedDate = new Date(invoiceDate).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  doc.text(`Fecha: ${formattedDate}`, 130, 35);
  doc.text(`Estado: ${invoice.status === 'cancelled' ? 'ANULADA' : 'PAGADA'}`, 130, 40);

  // Divider
  doc.setDrawColor(220, 38, 38);
  doc.setLineWidth(0.6);
  doc.line(14, 48, 196, 48);

  // Customer Information Box
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(220, 38, 38);
  doc.text('DATOS DEL CLIENTE', 14, 55);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(50, 50, 50);
  doc.text(`Nombre / Razón Social: ${invoice.customer_name}`, 14, 61);
  doc.text(`Teléfono: ${invoice.customer_phone || 'N/A'}`, 14, 66);
  if (invoice.customer_address) {
    doc.text(`Dirección: ${invoice.customer_address}`, 14, 71);
  }
  doc.text(`Método de Pago: ${(invoice.payment_method || 'EFECTIVO').toUpperCase()}`, 130, 61);

  // Items Table
  const tableRows = (invoice.items || []).map((item, idx) => {
    const unitPrice = formatCurrency(item.unit_price);
    const itemTotal = formatCurrency(item.total);
    const discountInfo = item.discount_amount > 0 ? `(-${formatCurrency(item.discount_amount)})` : '';
    return [
      (idx + 1).toString(),
      item.product_name,
      item.quantity.toString(),
      `${unitPrice} ${discountInfo}`.trim(),
      itemTotal,
    ];
  });

  autoTable(doc, {
    startY: invoice.customer_address ? 76 : 72,
    head: [['#', 'DESCRIPCIÓN DEL PRODUCTO', 'CANT.', 'PRECIO UNITARIO', 'TOTAL']],
    body: tableRows,
    theme: 'grid',
    headStyles: {
      fillColor: [220, 38, 38], // Corporate Red
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8.5,
      halign: 'left',
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 20, halign: 'center' },
      3: { cellWidth: 40, halign: 'right' },
      4: { cellWidth: 35, halign: 'right' },
    },
    styles: {
      fontSize: 8,
      cellPadding: 2.5,
      textColor: [40, 40, 40],
    },
    alternateRowStyles: {
      fillColor: [254, 242, 242], // Light red tinted
    },
  });

  // Calculate position after table
  const finalY = (doc as any).lastAutoTable.finalY + 6;

  // Summary Totals
  const rightColX = 135;
  const valColX = 196;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(80, 80, 80);

  doc.text('Subtotal:', rightColX, finalY);
  doc.text(formatCurrency(invoice.subtotal), valColX, finalY, { align: 'right' });

  let curY = finalY;
  if (invoice.discount > 0) {
    curY += 5.5;
    doc.setTextColor(220, 38, 38);
    doc.text('Descuentos / Ofertas:', rightColX, curY);
    doc.text(`-${formatCurrency(invoice.discount)}`, valColX, curY, { align: 'right' });
  }

  if (invoice.tax > 0) {
    curY += 5.5;
    doc.setTextColor(80, 80, 80);
    doc.text('Impuestos (IVA):', rightColX, curY);
    doc.text(formatCurrency(invoice.tax), valColX, curY, { align: 'right' });
  }

  // Grand Total Box
  curY += 7;
  doc.setFillColor(220, 38, 38);
  doc.roundedRect(rightColX - 5, curY - 5, 66, 11, 1.5, 1.5, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text('TOTAL A PAGAR:', rightColX, curY + 2);
  doc.text(formatCurrency(invoice.total), valColX, curY + 2, { align: 'right' });

  // Notes / Footer
  const footerY = 272;
  doc.setDrawColor(220, 38, 38);
  doc.setLineWidth(0.4);
  doc.line(14, footerY, 196, footerY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(110, 110, 110);
  doc.text('Gracias por su compra en BIKIE Papelería & Suministros. Conserve esta factura como comprobante oficial.', 105, footerY + 4.5, { align: 'center' });
  doc.text(`Documento fiscal emitido en moneda de curso legal (XAF / FCFA) • BIKIE Papelería`, 105, footerY + 8.5, { align: 'center' });

  return doc;
}

export function downloadInvoicePDF(
  invoice: Invoice,
  settings?: BusinessSettings
): void {
  const doc = generateInvoicePDF(invoice, settings);
  doc.save(`Factura_${invoice.invoice_number}.pdf`);
}

/**
 * Generates an executive Monthly Sales & Invoicing PDF Report
 * adhering strictly to the corporate red and white branding.
 */
export function generateMonthlySalesReportPDF(
  monthStr: string, // 'YYYY-MM' or 'all'
  sales: Sale[],
  invoices: Invoice[],
  settings?: BusinessSettings
): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const businessName = settings?.business_name || 'BIKIE Sistemas Informáticos';
  const taxId = settings?.rif_tax_id || '0214081-21';
  const phone = settings?.phone || '333098318 - 222544924 - 222213126';
  const address = settings?.address || 'BARRIO EL PARAISO (cerca la guardería "Los Chupetes") - Malabo / Bata, GE';

  // Filter sales/invoices for the given month if not 'all'
  const filteredSales = monthStr === 'all'
    ? sales
    : sales.filter((s) => s.created_at.startsWith(monthStr));

  const filteredInvoices = monthStr === 'all'
    ? invoices
    : invoices.filter((inv) => inv.created_at.startsWith(monthStr));

  // Compute Financial Aggregates
  const totalSalesVolume = filteredSales.reduce((acc, s) => acc + Number(s.total_amount || 0), 0);
  const totalSalesCount = filteredSales.length;
  const averageTicket = totalSalesCount > 0 ? totalSalesVolume / totalSalesCount : 0;
  
  const totalDiscount = filteredInvoices.reduce((acc, inv) => acc + Number(inv.discount || 0), 0);
  const paidInvoicesCount = filteredInvoices.filter((i) => i.status === 'paid').length;
  const cancelledInvoicesCount = filteredInvoices.filter((i) => i.status === 'cancelled').length;

  // Breakdown by payment methods
  const methodStats: Record<string, { total: number; count: number }> = {};
  filteredSales.forEach((s) => {
    const m = s.payment_method || 'otro';
    if (!methodStats[m]) methodStats[m] = { total: 0, count: 0 };
    methodStats[m].total += Number(s.total_amount || 0);
    methodStats[m].count += 1;
  });

  // Human-readable Month Label
  let periodLabel = 'TODOS LOS REGISTROS HISTÓRICOS';
  if (monthStr !== 'all' && monthStr.includes('-')) {
    const [year, month] = monthStr.split('-');
    const dateObj = new Date(Number(year), Number(month) - 1, 1);
    const monthName = dateObj.toLocaleDateString('es-ES', { month: 'long' });
    periodLabel = `${(monthName || '').toUpperCase()} DE ${year}`;
  }

  // 1. Red Header Top Bar
  doc.setFillColor(220, 38, 38); // Corporate Red #dc2626
  doc.rect(0, 0, 210, 10, 'F');

  // Red Logo Badge
  doc.setFillColor(220, 38, 38);
  doc.roundedRect(14, 15, 14, 14, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(255, 255, 255);
  doc.text('B', 18, 25);

  // Business Name
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(20, 20, 20);
  doc.text((businessName || 'BIKIE PAPELERÍA').toUpperCase(), 32, 22);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(90, 90, 90);
  doc.text(`RIF: ${taxId} • Dirección: ${address}`, 32, 27);
  doc.text(`Contacto: ${phone} • Moneda: XAF / FCFA`, 32, 31.5);

  // Report Period Badge (Top Right)
  doc.setFillColor(254, 242, 242);
  doc.setDrawColor(220, 38, 38);
  doc.setLineWidth(0.5);
  doc.roundedRect(122, 14, 74, 24, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(220, 38, 38);
  doc.text('REPORTE MENSUAL DE VENTAS', 126, 20);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(20, 20, 20);
  doc.text(`PERÍODO: ${periodLabel}`, 126, 26);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 100, 100);
  const nowStr = new Date().toLocaleString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  doc.text(`Generado el: ${nowStr}`, 126, 32);

  // Red Section Divider
  doc.setDrawColor(220, 38, 38);
  doc.setLineWidth(0.8);
  doc.line(14, 42, 196, 42);

  // 2. Executive KPI Cards (Red and White Theme)
  const cardY = 46;
  const cardWidth = 43;
  const cardHeight = 22;
  const cardSpacing = 2.6;

  // Card 1: Volumen Total
  doc.setFillColor(254, 242, 242);
  doc.setDrawColor(220, 38, 38);
  doc.setLineWidth(0.4);
  doc.roundedRect(14, cardY, cardWidth, cardHeight, 1.5, 1.5, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(220, 38, 38);
  doc.text('VOLUMEN TOTAL', 17, cardY + 6);
  doc.setFontSize(10.5);
  doc.setTextColor(20, 20, 20);
  doc.text(formatCurrency(totalSalesVolume), 17, cardY + 14);
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(110, 110, 110);
  doc.text('Ingresos facturados', 17, cardY + 19);

  // Card 2: Transacciones
  const card2X = 14 + cardWidth + cardSpacing;
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(220, 220, 220);
  doc.roundedRect(card2X, cardY, cardWidth, cardHeight, 1.5, 1.5, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(100, 100, 100);
  doc.text('TRANSACCIONES', card2X + 3, cardY + 6);
  doc.setFontSize(11);
  doc.setTextColor(20, 20, 20);
  doc.text(`${totalSalesCount} Ventas`, card2X + 3, cardY + 14);
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(110, 110, 110);
  doc.text(`${paidInvoicesCount} Pagadas • ${cancelledInvoicesCount} Anuladas`, card2X + 3, cardY + 19);

  // Card 3: Ticket Promedio
  const card3X = card2X + cardWidth + cardSpacing;
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(220, 220, 220);
  doc.roundedRect(card3X, cardY, cardWidth, cardHeight, 1.5, 1.5, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(100, 100, 100);
  doc.text('TICKET PROMEDIO', card3X + 3, cardY + 6);
  doc.setFontSize(10.5);
  doc.setTextColor(20, 20, 20);
  doc.text(formatCurrency(averageTicket), card3X + 3, cardY + 14);
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(110, 110, 110);
  doc.text('Por transacción', card3X + 3, cardY + 19);

  // Card 4: Descuentos
  const card4X = card3X + cardWidth + cardSpacing;
  doc.setFillColor(254, 242, 242);
  doc.setDrawColor(220, 38, 38);
  doc.roundedRect(card4X, cardY, cardWidth, cardHeight, 1.5, 1.5, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(220, 38, 38);
  doc.text('DESCUENTOS OTORGADOS', card4X + 3, cardY + 6);
  doc.setFontSize(10.5);
  doc.setTextColor(220, 38, 38);
  doc.text(formatCurrency(totalDiscount), card4X + 3, cardY + 14);
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(110, 110, 110);
  doc.text('Ofertas y promociones', card4X + 3, cardY + 19);

  // 3. Payment Method Breakdown Table
  const methodRows = Object.entries(methodStats).map(([method, data]) => {
    const pct = totalSalesVolume > 0 ? (data.total / totalSalesVolume) * 100 : 0;
    return [
      (method || 'OTROS').toUpperCase().replace('_', ' '),
      data.count.toString(),
      formatCurrency(data.total),
      `${pct.toFixed(1)}%`,
    ];
  });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(220, 38, 38);
  doc.text('1. RESUMEN DE COBROS POR MÉTODO DE PAGO', 14, 75);

  autoTable(doc, {
    startY: 78,
    head: [['MÉTODO DE PAGO', 'CANTIDAD DE OPERACIONES', 'TOTAL FACTURADO', '% DEL VOLUMEN']],
    body: methodRows.length > 0 ? methodRows : [['SIN MOVIMIENTOS', '0', '0 XAF', '0.0%']],
    theme: 'grid',
    headStyles: {
      fillColor: [220, 38, 38], // Corporate Red
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'left',
    },
    columnStyles: {
      0: { cellWidth: 60 },
      1: { cellWidth: 45, halign: 'center' },
      2: { cellWidth: 45, halign: 'right' },
      3: { cellWidth: 32, halign: 'right' },
    },
    styles: {
      fontSize: 8,
      cellPadding: 2.2,
      textColor: [30, 30, 30],
    },
    alternateRowStyles: {
      fillColor: [254, 242, 242],
    },
  });

  // 4. Itemized Sales / Invoices Table
  const nextY = (doc as any).lastAutoTable.finalY + 8;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(220, 38, 38);
  doc.text('2. DETALLE CRONOLÓGICO DE OPERACIONES Y FACTURAS', 14, nextY);

  const salesTableRows = filteredSales.map((s, idx) => {
    const sDate = new Date(s.created_at).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
    const invNumber =
      s.invoice?.invoice_number ||
      invoices.find((i) => i.id === s.invoice_id)?.invoice_number ||
      s.sale_number ||
      'MOSTRADOR / POS';
    const customer = s.customer_name || 'CLIENTE GENERAL';
    const method = (s.payment_method || 'EFECTIVO').toUpperCase();
    const cashier = s.cashier_name || 'ADMIN';
    const amount = formatCurrency(Number(s.total_amount));

    return [(idx + 1).toString(), sDate, invNumber, customer, method, cashier, amount];
  });

  autoTable(doc, {
    startY: nextY + 3,
    head: [['#', 'FECHA & HORA', 'N° FACTURA', 'CLIENTE', 'MÉTODO', 'CAJERO', 'TOTAL']],
    body: salesTableRows.length > 0 ? salesTableRows : [['-', '-', '-', 'SIN VENTAS REGISTRADAS', '-', '-', '0 XAF']],
    theme: 'grid',
    headStyles: {
      fillColor: [20, 20, 20], // Dark charcoal header for contrast
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7.5,
      halign: 'left',
    },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 32 },
      2: { cellWidth: 30, halign: 'left' },
      3: { cellWidth: 42 },
      4: { cellWidth: 26, halign: 'left' },
      5: { cellWidth: 20, halign: 'left' },
      6: { cellWidth: 24, halign: 'right' },
    },
    styles: {
      fontSize: 7.5,
      cellPadding: 2,
      textColor: [40, 40, 40],
    },
    alternateRowStyles: {
      fillColor: [254, 242, 242],
    },
    didDrawPage: (data) => {
      // Footer on every page
      const pageCount = (doc as any).internal.getNumberOfPages();
      const currentPage = data.pageNumber;

      doc.setDrawColor(220, 38, 38);
      doc.setLineWidth(0.5);
      doc.line(14, 285, 196, 285);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(120, 120, 120);
      doc.text('BIKIE Papelería & Suministros • Reporte Oficial de Auditoría y Facturación Mensual', 14, 290);
      doc.text(`Página ${currentPage} de ${pageCount}`, 196, 290, { align: 'right' });
    },
  });

  return doc;
}

export function downloadMonthlySalesReportPDF(
  monthStr: string,
  sales: Sale[],
  invoices: Invoice[],
  settings?: BusinessSettings
): void {
  const doc = generateMonthlySalesReportPDF(monthStr, sales, invoices, settings);
  const cleanMonth = monthStr === 'all' ? 'Historico' : monthStr;
  doc.save(`Reporte_Ventas_BIKIE_${cleanMonth}.pdf`);
}

