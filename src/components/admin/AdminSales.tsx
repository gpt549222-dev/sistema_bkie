import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { getSales, getInvoices } from '../../services/invoiceService';
import { Sale, Invoice } from '../../types';
import { formatCurrency } from '../../utils/currency';
import { useRealtime } from '../../context/RealtimeContext';
import { downloadMonthlySalesReportPDF } from '../../utils/pdfGenerator';
import {
  TrendingUp,
  CreditCard,
  DollarSign,
  Calendar,
  RefreshCw,
  Search,
  Receipt,
  User,
  ShoppingBag,
  Download,
  FileSpreadsheet,
  FileText,
} from 'lucide-react';

export const AdminSales: React.FC = () => {
  const [sales, setSales] = useState<Sale[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'month'>('all');
  const [selectedMonth, setSelectedMonth] = useState<string>(
    new Date().toISOString().slice(0, 7) // 'YYYY-MM'
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const { refreshTrigger } = useRealtime();

  useEffect(() => {
    loadSales();
  }, [refreshTrigger]);

  const loadSales = async () => {
    setIsLoading(true);
    try {
      const [salesData, invoicesData] = await Promise.all([
        getSales(),
        getInvoices(),
      ]);
      setSales(salesData);
      setInvoices(invoicesData);
    } catch (err: any) {
      console.error('Error loading sales:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const todayStr = new Date().toISOString().slice(0, 10);
  const monthStr = new Date().toISOString().slice(0, 7);

  const filteredSales = sales.filter((s) => {
    const matchesDate =
      dateFilter === 'all'
        ? true
        : dateFilter === 'today'
        ? s.created_at.startsWith(todayStr)
        : s.created_at.startsWith(selectedMonth || monthStr);

    const q = searchQuery.toLowerCase();
    const matchesSearch =
      (s.customer_name && s.customer_name.toLowerCase().includes(q)) ||
      (s.cashier_name && s.cashier_name.toLowerCase().includes(q)) ||
      (s.payment_method && s.payment_method.toLowerCase().includes(q)) ||
      (s.invoice?.invoice_number && s.invoice.invoice_number.toLowerCase().includes(q));

    return matchesDate && matchesSearch;
  });

  const getExportData = () => {
    return filteredSales.map((sale) => {
      const matchedInvoice =
        invoices.find((inv) => inv.id === sale.invoice_id || inv.order_id === sale.order_id) ||
        sale.invoice;

      const productNames = (matchedInvoice?.items || [])
        .map((it) => `${it.product_name} (x${it.quantity})`)
        .join('; ');

      const totalQuantities = (matchedInvoice?.items || []).reduce(
        (sum, it) => sum + Number(it.quantity || 0),
        0
      );

      return {
        'Fecha y Hora': new Date(sale.created_at).toLocaleString('es-ES'),
        'N° Venta / Recibo': sale.sale_number || sale.id,
        'N° Factura': matchedInvoice?.invoice_number || 'N/A',
        'ID Pedido': sale.order_id || 'Venta Mostrador',
        'Cliente': sale.customer_name || 'Consumidor Final',
        'Productos': productNames || 'Venta directa',
        'Cantidad Total de Ítems': totalQuantities || 1,
        'Subtotal (XAF)': matchedInvoice ? matchedInvoice.subtotal : sale.total_amount,
        'Descuento (XAF)': matchedInvoice ? matchedInvoice.discount : 0,
        'Impuestos / IVA (XAF)': matchedInvoice ? matchedInvoice.tax : 0,
        'Total (XAF)': Number(sale.total_amount || 0),
        'Método de Pago': (sale.payment_method || 'efectivo').toUpperCase(),
        'Cajero / Registrado por': sale.cashier_name || 'Admin BIKIE',
        'Estado de Factura / Pago': matchedInvoice ? matchedInvoice.status.toUpperCase() : 'PAGADA',
      };
    });
  };

  const handleExportCSV = () => {
    try {
      const data = getExportData();
      if (data.length === 0) {
        alert('No hay ventas disponibles para exportar con los filtros seleccionados.');
        return;
      }

      const headers = Object.keys(data[0]);
      const csvRows: string[] = [];
      csvRows.push(headers.map((h) => `"${h.replace(/"/g, '""')}"`).join(','));

      data.forEach((row) => {
        const values = headers.map((header) => {
          const val = (row as any)[header];
          const stringVal = val === null || val === undefined ? '' : String(val);
          return `"${stringVal.replace(/"/g, '""')}"`;
        });
        csvRows.push(values.join(','));
      });

      const csvString = '\uFEFF' + csvRows.join('\r\n');
      const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `ventas_bikie_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: any) {
      alert(`Error al exportar CSV: ${err.message}`);
    }
  };

  const handleExportExcel = () => {
    try {
      const data = getExportData();
      if (data.length === 0) {
        alert('No hay ventas disponibles para exportar con los filtros seleccionados.');
        return;
      }

      const worksheet = XLSX.utils.json_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Historial de Ventas');

      // Set column widths
      const colWidths = Object.keys(data[0]).map((k) => ({
        wch: Math.max(k.length, 16),
      }));
      worksheet['!cols'] = colWidths;

      XLSX.writeFile(workbook, `ventas_bikie_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (err: any) {
      alert(`Error al exportar Excel: ${err.message}`);
    }
  };

  const handleExportPDF = () => {
    setIsExporting(true);
    try {
      const targetMonth = dateFilter === 'today' || dateFilter === 'month' ? selectedMonth : 'all';
      downloadMonthlySalesReportPDF(targetMonth, sales, invoices);
    } catch (err: any) {
      alert(`Error al generar reporte PDF: ${err.message}`);
    } finally {
      setIsExporting(false);
    }
  };

  const totalVolume = filteredSales.reduce((sum, s) => sum + Number(s.total_amount || 0), 0);
  const totalCount = filteredSales.length;
  const averageTicket = totalCount > 0 ? totalVolume / totalCount : 0;

  // Breakdown by payment method
  const methodTotals: Record<string, number> = {};
  filteredSales.forEach((s) => {
    const m = s.payment_method || 'otro';
    methodTotals[m] = (methodTotals[m] || 0) + Number(s.total_amount || 0);
  });

  return (
    <div className="space-y-6 font-mono">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-[#0d0d0d] p-6 rounded-xl border border-white/10">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-white font-display uppercase tracking-tight">
            VENTAS, CAJA & FACTURACIÓN
          </h1>
          <p className="text-[10px] text-white/40 uppercase tracking-widest mt-0.5">
            REPORTE FINANCIERO POR MÉTODOS DE PAGO Y ARQUEO DE CAJA EN SUPABASE
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {['all', 'today', 'month'].map((df) => (
            <button
              key={df}
              onClick={() => setDateFilter(df as any)}
              className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                dateFilter === df
                  ? 'bg-[#dc2626] text-white accent-glow shadow'
                  : 'bg-[#141414] text-white/60 hover:text-white border border-white/10'
              }`}
            >
              {df === 'all' ? 'HISTÓRICO' : df === 'today' ? 'HOY' : 'ESTE MES'}
            </button>
          ))}

          {dateFilter === 'month' && (
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-[#141414] border border-white/10 text-white text-xs font-bold uppercase px-2.5 py-1.5 rounded-lg focus:outline-none cursor-pointer"
            />
          )}

          {/* Excel Export Button */}
          <button
            onClick={handleExportExcel}
            id="btn-sales-export-excel"
            className="px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white rounded-lg text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow transition-all cursor-pointer hover:scale-102 active:scale-98"
            title="Exportar ventas a Excel (.xlsx)"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>EXCEL</span>
          </button>

          {/* CSV Export Button */}
          <button
            onClick={handleExportCSV}
            id="btn-sales-export-csv"
            className="px-3.5 py-1.5 bg-blue-700 hover:bg-blue-600 text-white rounded-lg text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow transition-all cursor-pointer hover:scale-102 active:scale-98"
            title="Exportar ventas a CSV"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>CSV</span>
          </button>

          {/* PDF Export Button */}
          <button
            onClick={handleExportPDF}
            disabled={isExporting}
            id="btn-sales-export-pdf"
            className="px-3.5 py-1.5 bg-[#dc2626] hover:bg-[#ef4444] text-white rounded-lg text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow accent-glow transition-all cursor-pointer hover:scale-102 active:scale-98"
            title="Exportar reporte de ventas en PDF"
          >
            <Download className="w-3.5 h-3.5" />
            <span>PDF</span>
          </button>

          <button
            onClick={loadSales}
            disabled={isLoading}
            className="p-2 bg-[#141414] hover:bg-white/10 border border-white/10 text-white rounded-lg transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-[#ef4444]' : ''}`} />
          </button>
        </div>
      </div>



      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-[#0d0d0d] p-5 rounded-xl border border-white/10">
          <span className="text-[10px] font-black text-white/40 uppercase tracking-wider block mb-1">
            VOLUMEN TOTAL FACTURADO
          </span>
          <div className="text-3xl font-black text-white font-display tracking-tight">
            {formatCurrency(totalVolume)}
          </div>
          <p className="text-[10px] text-white/40 uppercase mt-1">Período seleccionado</p>
        </div>

        <div className="bg-[#0d0d0d] p-5 rounded-xl border border-white/10">
          <span className="text-[10px] font-black text-white/40 uppercase tracking-wider block mb-1">
            TRANSACCIONES CERRADAS
          </span>
          <div className="text-3xl font-black text-white font-display tracking-tight">
            {totalCount}
          </div>
          <p className="text-[10px] text-emerald-400 font-bold uppercase mt-1">100% Pagadas</p>
        </div>

        <div className="bg-[#0d0d0d] p-5 rounded-xl border border-white/10">
          <span className="text-[10px] font-black text-white/40 uppercase tracking-wider block mb-1">
            TICKET PROMEDIO
          </span>
          <div className="text-3xl font-black text-white font-display tracking-tight">
            {formatCurrency(averageTicket)}
          </div>
          <p className="text-[10px] text-white/40 uppercase mt-1">Por cliente / venta</p>
        </div>
      </div>

      {/* Methods Breakdown */}
      <div className="bg-[#0d0d0d] rounded-xl p-6 border border-white/10">
        <h3 className="text-xs font-black text-white uppercase tracking-wider mb-4 flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-[#ef4444]" />
          <span>DISTRIBUCIÓN POR MÉTODO DE COBRO</span>
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {Object.entries(methodTotals).map(([method, amount]) => {
            const pct = totalVolume > 0 ? (amount / totalVolume) * 100 : 0;
            return (
              <div key={method} className="p-3 bg-[#141414] rounded-lg border border-white/10">
                <span className="text-[10px] font-black text-white/40 uppercase block">
                  {method.replace('_', ' ')}
                </span>
                <span className="text-base font-black text-white font-display block mt-1">
                  {formatCurrency(amount)}
                </span>
                <div className="w-full bg-white/10 h-1.5 rounded-lg mt-2 overflow-hidden">
                  <div
                    className="bg-[#dc2626] h-full rounded-lg accent-glow"
                    style={{ width: `${pct}%` }}
                  ></div>
                </div>
                <span className="text-[9px] text-white/40 font-mono block mt-1">
                  {pct.toFixed(1)}% DEL TOTAL
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-[#0d0d0d] rounded-xl p-6 border border-white/10 space-y-4">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="BUSCAR POR CLIENTE, CAJERO O MÉTODO..."
            className="w-full pl-9.5 pr-4 py-2 bg-[#141414] border border-white/10 rounded-lg text-xs text-white uppercase placeholder:text-white/30 focus:border-[#dc2626] focus:outline-hidden"
          />
        </div>

        {filteredSales.length === 0 ? (
          <div className="text-center py-12 text-white/30 text-xs uppercase tracking-widest">
            NO SE ENCONTRARON VENTAS PARA ESTE CRITERIO.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="text-white/40 font-black uppercase text-[10px] tracking-wider border-b border-white/10 pb-2">
                  <th className="py-2.5">FECHA</th>
                  <th className="py-2.5">FACTURA / RECIBO</th>
                  <th className="py-2.5">CLIENTE</th>
                  <th className="py-2.5">MÉTODO DE PAGO</th>
                  <th className="py-2.5">CAJERO</th>
                  <th className="py-2.5 text-right">MONTO TOTAL</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredSales.map((sale) => (
                  <tr key={sale.id} className="hover:bg-white/5 transition-colors">
                    <td className="py-3 font-mono text-white/40 text-[11px]">
                      {new Date(sale.created_at).toLocaleString()}
                    </td>
                    <td className="py-3 font-mono font-bold text-[#ef4444]">
                      {sale.invoice?.invoice_number || 'VENTA MOSTRADOR'}
                    </td>
                    <td className="py-3 font-bold text-white uppercase">
                      {sale.customer_name}
                    </td>
                    <td className="py-3 uppercase text-[10px] font-semibold text-white/60">
                      {sale.payment_method}
                    </td>
                    <td className="py-3 text-white/40 uppercase text-[11px]">
                      {sale.cashier_name}
                    </td>
                    <td className="py-3 text-right font-mono font-black text-white text-sm">
                      {formatCurrency(Number(sale.total_amount))}
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
