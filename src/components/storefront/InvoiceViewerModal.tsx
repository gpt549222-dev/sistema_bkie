import React from 'react';
import { Invoice, BusinessSettings } from '../../types';
import { formatCurrency } from '../../utils/currency';
import { downloadInvoicePDF } from '../../utils/pdfGenerator';
import {
  X,
  Printer,
  Download,
  Share2,
  Receipt,
} from 'lucide-react';

interface InvoiceViewerModalProps {
  invoice: Invoice | null;
  businessSettings: BusinessSettings;
  onClose: () => void;
}

export const InvoiceViewerModal: React.FC<InvoiceViewerModalProps> = ({
  invoice,
  businessSettings,
  onClose,
}) => {
  if (!invoice) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = () => {
    try {
      downloadInvoicePDF(invoice, businessSettings);
    } catch (err: any) {
      alert(`Error al generar PDF: ${err.message}`);
    }
  };

  const handleShareWhatsApp = () => {
    const cleanPhone = (invoice.customer_phone || '').replace(/[^0-9]/g, '');
    const msg =
      `¡Hola *${invoice.customer_name}*! 👋 Adjuntamos tu factura oficial de *BIKIE Sistemas Informáticos*.%0A%0A` +
      `📄 *Factura:* ${invoice.invoice_number}%0A` +
      `📅 *Fecha:* ${new Date(invoice.created_at).toLocaleDateString()}%0A` +
      `💰 *Total Facturado:* ${formatCurrency(invoice.total)} (${(invoice.payment_method || 'EFECTIVO').toUpperCase()})%0A` +
      `✅ *Estado:* ${(invoice.status || 'PAID').toUpperCase()}%0A%0A` +
      `¡Gracias por preferir a BIKIE Sistemas Informáticos!`;

    window.open(`https://wa.me/${cleanPhone}?text=${msg}`, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs overflow-y-auto">
      <div className="bg-[#0d0d0d] rounded-xl max-w-3xl w-full p-6 sm:p-10 shadow-2xl border border-white/10 relative my-8 text-white">
        {/* Controls bar (hidden when printing) */}
        <div className="no-print flex items-center justify-between pb-6 mb-6 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-[#ef4444]" />
            <span className="font-black text-xs uppercase tracking-widest font-mono text-white">
              COMPROBANTE OFICIAL DE VENTA (FCFA)
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadPDF}
              className="px-3.5 py-1.5 bg-[#dc2626] hover:bg-[#ef4444] text-white text-[10px] font-black uppercase tracking-wider rounded-lg flex items-center gap-1.5 cursor-pointer transition-all shadow-md"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Descargar PDF</span>
            </button>
            <button
              onClick={handlePrint}
              className="px-3.5 py-1.5 bg-white/10 hover:bg-white/20 border border-white/20 text-white text-[10px] font-black uppercase tracking-wider rounded-lg flex items-center gap-1.5 cursor-pointer transition-all"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Imprimir</span>
            </button>
            <button
              onClick={handleShareWhatsApp}
              className="px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-black text-[10px] font-black uppercase tracking-wider rounded-lg flex items-center gap-1.5 cursor-pointer transition-all"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>WhatsApp</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-white/40 hover:text-white hover:bg-white/10 border border-transparent hover:border-white/10 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Invoice Sheet */}
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start gap-4 pb-6 border-b border-white/10">
            <div>
              <div className="flex items-center gap-2.5 mb-1">
                <div className="w-8 h-8 rounded-lg bg-[#dc2626] text-white flex items-center justify-center font-black text-lg accent-glow font-display shadow-md">
                  B
                </div>
                <span className="font-black text-2xl tracking-tighter text-white font-display">
                  BIKIE. <span className="text-white/40 font-mono text-sm tracking-widest">SISTEMAS INFORMÁTICOS</span>
                </span>
              </div>
              <p className="text-xs font-bold text-white/80 uppercase tracking-wider">{businessSettings.business_name}</p>
              <p className="text-xs text-white/50 font-mono">RIF: {businessSettings.rif_tax_id}</p>
              <p className="text-xs text-white/50 font-mono">{businessSettings.address}</p>
              <p className="text-xs text-white/50 font-mono">Tlf / WhatsApp: {businessSettings.whatsapp}</p>
            </div>

            <div className="text-left sm:text-right font-mono">
              <div className="inline-block px-3 py-1 bg-[#dc2626]/10 border border-[#dc2626]/30 text-[#ef4444] font-mono font-black text-base rounded-lg mb-1">
                {invoice.invoice_number}
              </div>
              <p className="text-xs text-white/50">
                Fecha: <strong className="text-white">{new Date(invoice.created_at).toLocaleDateString()}</strong>
              </p>
              <p className="text-xs text-white/50">
                Estado:{' '}
                <span className="font-black text-emerald-400 uppercase">
                  {invoice.status === 'paid' ? 'PAGADO' : invoice.status}
                </span>
              </p>
            </div>
          </div>

          {/* Customer info card */}
          <div className="p-4 rounded-lg bg-[#141414] border border-white/10 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
            <div>
              <p className="font-black text-white/40 uppercase text-[10px] tracking-widest mb-1">
                FACTURADO A:
              </p>
              <p className="font-black text-sm text-white">{invoice.customer_name}</p>
              {invoice.customer_id_doc && (
                <p className="text-white/60">CI / RIF: {invoice.customer_id_doc}</p>
              )}
              {invoice.customer_phone && (
                <p className="text-white/60">Teléfono: {invoice.customer_phone}</p>
              )}
            </div>

            <div>
              <p className="font-black text-white/40 uppercase text-[10px] tracking-widest mb-1">
                DETALLES DE PAGO:
              </p>
              <p className="text-white/80">
                Método: <strong className="uppercase text-[#ef4444]">{invoice.payment_method}</strong>
              </p>
              {invoice.customer_address && (
                <p className="text-white/60">Entrega: {invoice.customer_address}</p>
              )}
              <p className="text-white/40 text-[10px]">
                Hora: {new Date(invoice.created_at).toLocaleTimeString()}
              </p>
            </div>
          </div>

          {/* Items Table */}
          <div className="overflow-x-auto font-mono">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-white/10 text-white/40 uppercase text-[10px] tracking-widest">
                  <th className="py-2.5 px-2 font-bold">Cant.</th>
                  <th className="py-2.5 px-2 font-bold">Descripción del Artículo</th>
                  <th className="py-2.5 px-2 font-bold text-right">P. Unit</th>
                  <th className="py-2.5 px-2 font-bold text-right">Desc.</th>
                  <th className="py-2.5 px-2 font-bold text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {invoice.items?.map((item) => (
                  <tr key={item.id}>
                    <td className="py-2.5 px-2 font-bold font-mono text-white/70">{item.quantity}</td>
                    <td className="py-2.5 px-2 font-bold text-white uppercase">{item.product_name}</td>
                    <td className="py-2.5 px-2 text-right font-mono text-white/60">
                      {formatCurrency(item.original_unit_price)}
                    </td>
                    <td className="py-2.5 px-2 text-right font-mono text-[#ef4444]">
                      {item.discount_amount > 0 ? `-${formatCurrency(item.discount_amount)}` : '-'}
                    </td>
                    <td className="py-2.5 px-2 text-right font-mono font-black text-white">
                      {formatCurrency(item.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="flex justify-end pt-4 border-t border-white/10 font-mono">
            <div className="w-72 space-y-2 text-xs">
              <div className="flex justify-between text-white/60">
                <span>Subtotal:</span>
                <span className="font-mono font-semibold text-white">{formatCurrency(invoice.subtotal)}</span>
              </div>
              {invoice.discount > 0 && (
                <div className="flex justify-between text-[#ef4444] font-bold">
                  <span>Descuento Promocional:</span>
                  <span className="font-mono">-{formatCurrency(invoice.discount)}</span>
                </div>
              )}
              {invoice.tax > 0 && (
                <div className="flex justify-between text-white/60">
                  <span>Impuestos (IVA):</span>
                  <span className="font-mono">{formatCurrency(invoice.tax)}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-black text-white pt-2 border-t border-white/10">
                <span className="uppercase tracking-wider">TOTAL PAGADO:</span>
                <span className="font-mono text-[#ef4444] font-black">
                  {formatCurrency(invoice.total)}
                </span>
              </div>
            </div>
          </div>

          {/* Footer remarks */}
          <div className="pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between text-[10px] uppercase tracking-wider text-white/40 gap-2 font-mono">
            <p>Comprobante generado automáticamente por el sistema BIKIE Sistemas Informáticos.</p>
            <p className="font-mono">ID Operación: {invoice.id.slice(0, 8)}</p>
          </div>
        </div>
      </div>
    </div>
  );
};
