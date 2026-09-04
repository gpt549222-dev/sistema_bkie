import React, { useState, useEffect } from 'react';
import { getInvoices, cancelInvoice, getSales } from '../../services/invoiceService';
import { Invoice, BusinessSettings, Sale } from '../../types';
import { useRealtime } from '../../context/RealtimeContext';
import { formatCurrency } from '../../utils/currency';
import { downloadInvoicePDF, downloadMonthlySalesReportPDF } from '../../utils/pdfGenerator';
import {
  Search,
  Eye,
  RefreshCw,
  Download,
  FileSpreadsheet,
  Calendar,
} from 'lucide-react';

interface AdminInvoicesProps {
  businessSettings: BusinessSettings;
  onViewInvoice: (invoice: Invoice) => void;
}

export const AdminInvoices: React.FC<AdminInvoicesProps> = ({
  businessSettings,
  onViewInvoice,
}) => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedMonth, setSelectedMonth] = useState<string>(
    new Date().toISOString().slice(0, 7) // 'YYYY-MM'
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const { refreshTrigger, triggerGlobalRefresh } = useRealtime();

  useEffect(() => {
    loadData();
  }, [refreshTrigger]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [invData, salesData] = await Promise.all([
        getInvoices(),
        getSales(),
      ]);
      setInvoices(invData);
      setSales(salesData);
    } catch (err: any) {
      console.error('Error al cargar datos de facturación:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportMonthlyPDF = () => {
    setIsExporting(true);
    try {
      downloadMonthlySalesReportPDF(selectedMonth, sales, invoices, businessSettings);
    } catch (err: any) {
      alert(`Error al generar reporte PDF: ${err.message}`);
    } finally {
      setIsExporting(false);
    }
  };

  const handleCancelInvoice = async (invoice: Invoice) => {
    if (invoice.status === 'cancelled') {
      alert('Esta factura ya está anulada.');
      return;
    }

    const reason = prompt(
      `¿Deseas anular la factura ${invoice.invoice_number}?\nIngresa el motivo de anulación oficial:`,
      'Error de facturación o devolución'
    );
    if (!reason || !reason.trim()) return;

    try {
      await cancelInvoice(invoice.id, reason.trim());
      alert('Factura anulada con éxito y registrada en auditoría contable.');
      triggerGlobalRefresh();
    } catch (err: any) {
      alert(`Error al anular factura: ${err.message}`);
    }
  };

  const handleDownloadPDF = (invoice: Invoice, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      downloadInvoicePDF(invoice, businessSettings);
    } catch (err: any) {
      alert(`Error al generar PDF: ${err.message}`);
    }
  };

  const filtered = invoices.filter((inv) => {
    const matchesStatus = statusFilter === 'all' || inv.status === statusFilter;
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      inv.invoice_number.toLowerCase().includes(q) ||
      inv.customer_name.toLowerCase().includes(q) ||
      (inv.customer_id_doc && inv.customer_id_doc.toLowerCase().includes(q));
    return matchesStatus && matchesSearch;
  });

  return (
    <div className="space-y-6 font-mono">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-[#0d0d0d] p-6 rounded-xl border border-white/10">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-white font-display uppercase tracking-tight">
            FACTURACIÓN & COMPROBANTES
          </h1>
          <p className="text-[10px] text-white/40 uppercase tracking-widest mt-0.5">
            REGISTRO CORRELATIVO DE VENTAS, RECIBOS E HISTORIAL TRIBUTARIO (FCFA)
          </p>
        </div>

        {/* Action controls including monthly PDF export */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1.5 bg-[#141414] border border-white/10 px-3 py-1.5 rounded-lg">
            <Calendar className="w-3.5 h-3.5 text-[#ef4444]" />
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-transparent text-white text-xs font-bold uppercase focus:outline-none cursor-pointer"
            />
          </div>

          <button
            onClick={handleExportMonthlyPDF}
            disabled={isExporting}
            id="btn-export-monthly-pdf"
            className="px-4 py-2 bg-[#dc2626] hover:bg-[#ef4444] text-white rounded-lg text-xs font-black uppercase tracking-wider flex items-center gap-2 shadow-lg accent-glow transition-all cursor-pointer hover:scale-102 active:scale-98"
            title="Exportar reporte de ventas mensual en PDF corporativo (Rojo y Blanco)"
          >
            <Download className="w-3.5 h-3.5" />
            <span>EXPORTAR REPORTE MENSUAL (PDF)</span>
          </button>

          <button
            onClick={loadData}
            disabled={isLoading}
            className="p-2 bg-[#141414] hover:bg-white/10 border border-white/10 text-white rounded-lg transition-colors cursor-pointer"
            title="Actualizar datos"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-[#ef4444]' : ''}`} />
          </button>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="bg-[#0d0d0d] rounded-xl p-6 border border-white/10 space-y-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="BUSCAR POR N° FACTURA, CLIENTE..."
              className="w-full pl-9.5 pr-4 py-2 bg-[#141414] border border-white/10 rounded-lg text-xs text-white uppercase placeholder:text-white/30 focus:border-[#dc2626] focus:outline-hidden"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {['all', 'paid', 'cancelled'].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                  statusFilter === st
                    ? 'bg-[#dc2626] text-white shadow-md accent-glow'
                    : 'bg-[#141414] text-white/60 hover:text-white border border-white/10'
                }`}
              >
                {st === 'all' ? 'TODAS' : st === 'paid' ? 'PAGADAS' : 'ANULADAS'}
              </button>
            ))}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-12 text-white/30 text-xs uppercase tracking-widest">
            NO SE ENCONTRARON FACTURAS REGISTRADAS.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="text-white/40 font-black uppercase text-[10px] tracking-wider border-b border-white/10 pb-2">
                  <th className="py-2.5">N° FACTURA</th>
                  <th className="py-2.5">FECHA</th>
                  <th className="py-2.5">CLIENTE</th>
                  <th className="py-2.5">MÉTODO</th>
                  <th className="py-2.5">SUBTOTAL</th>
                  <th className="py-2.5">DESC.</th>
                  <th className="py-2.5">TOTAL</th>
                  <th className="py-2.5">ESTADO</th>
                  <th className="py-2.5 text-right">ACCIONES</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filtered.map((inv) => (
                  <tr key={inv.id} className="hover:bg-white/5 transition-colors">
                    <td className="py-3 font-mono font-bold text-[#ef4444]">
                      {inv.invoice_number}
                    </td>
                    <td className="py-3 text-white/40 text-[11px]">
                      {new Date(inv.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-3">
                      <p className="font-bold text-white uppercase">{inv.customer_name}</p>
                      {inv.customer_phone && (
                        <p className="text-[10px] font-mono text-white/40">
                          {inv.customer_phone}
                        </p>
                      )}
                    </td>
                    <td className="py-3 uppercase text-[10px] font-semibold text-white/60">
                      {inv.payment_method}
                    </td>
                    <td className="py-3 font-mono text-white/60">
                      {formatCurrency(inv.subtotal)}
                    </td>
                    <td className="py-3 font-mono text-[#ef4444]">
                      {inv.discount > 0 ? `-${formatCurrency(inv.discount)}` : '-'}
                    </td>
                    <td className="py-3 font-mono font-black text-white text-sm">
                      {formatCurrency(inv.total)}
                    </td>
                    <td className="py-3">
                      <span
                        className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-lg ${
                          inv.status === 'paid'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : 'bg-red-500/20 text-red-300 border border-red-500/30'
                        }`}
                      >
                        {inv.status === 'paid' ? 'PAGADO' : 'ANULADO'}
                      </span>
                    </td>
                    <td className="py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => onViewInvoice(inv)}
                          className="px-2.5 py-1 bg-[#141414] hover:bg-white/10 border border-white/10 text-white rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-1 cursor-pointer transition-colors"
                          title="Ver comprobante"
                        >
                          <Eye className="w-3 h-3 text-[#ef4444]" />
                          <span>VER</span>
                        </button>
                        <button
                          onClick={(e) => handleDownloadPDF(inv, e)}
                          className="px-2 py-1 bg-[#dc2626]/20 hover:bg-[#dc2626]/30 border border-[#dc2626]/40 text-[#ef4444] rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-1 cursor-pointer transition-colors"
                          title="Descargar PDF"
                        >
                          <Download className="w-3 h-3" />
                          <span>PDF</span>
                        </button>
                        {inv.status === 'paid' && (
                          <button
                            onClick={() => handleCancelInvoice(inv)}
                            className="px-2 py-1 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 text-amber-400 rounded-lg text-[10px] font-black uppercase tracking-wider cursor-pointer transition-colors"
                            title="Anular comprobante oficialmente"
                          >
                            ANULAR
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

