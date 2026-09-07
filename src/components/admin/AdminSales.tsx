import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { getSales, getInvoices } from '../../services/invoiceService';
import {
  getActiveCashShift,
  getCashShifts,
  openCashShift,
  closeCashShift,
  getCashMovements,
  registerCashMovement,
} from '../../services/cashService';
import { Sale, Invoice, CashShift, CashMovement } from '../../types';
import { formatCurrency } from '../../utils/currency';
import { useRealtime } from '../../context/RealtimeContext';
import { downloadMonthlySalesReportPDF } from '../../utils/pdfGenerator';
import { ConfirmModal } from '../common/ConfirmModal';
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
  Calculator,
  Lock,
  Unlock,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownLeft,
  CheckCircle2,
  Plus,
  X,
  Clock,
  Coins,
} from 'lucide-react';

export const AdminSales: React.FC = () => {
  // Main view tab: 'sales' | 'cash' | 'movements'
  const [activeTab, setActiveTab] = useState<'sales' | 'cash' | 'movements'>('sales');

  // Sales & Invoices State
  const [sales, setSales] = useState<Sale[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'month'>('all');
  const [selectedMonth, setSelectedMonth] = useState<string>(
    new Date().toISOString().slice(0, 7) // 'YYYY-MM'
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  // Cash Register State
  const [activeShift, setActiveShift] = useState<CashShift | null>(null);
  const [cashShifts, setCashShifts] = useState<CashShift[]>([]);
  const [cashMovements, setCashMovements] = useState<CashMovement[]>([]);
  const [isLoadingCash, setIsLoadingCash] = useState(false);

  // Cash Modals State
  const [isOpenShiftModalOpen, setIsOpenShiftModalOpen] = useState(false);
  const [openShiftAmount, setOpenShiftAmount] = useState<number>(10000);
  const [openShiftCashier, setOpenShiftCashier] = useState<string>('Cajero BIKIE');
  const [openShiftNotes, setOpenShiftNotes] = useState<string>('');

  const [isCloseShiftModalOpen, setIsCloseShiftModalOpen] = useState(false);
  const [countedCashAmount, setCountedCashAmount] = useState<number>(0);
  const [closeShiftNotes, setCloseShiftNotes] = useState<string>('');
  const [isClosingShift, setIsClosingShift] = useState(false);

  const [isMovementModalOpen, setIsMovementModalOpen] = useState(false);
  const [movementType, setMovementType] = useState<'deposit' | 'withdrawal'>('deposit');
  const [movementAmount, setMovementAmount] = useState<number>(5000);
  const [movementReason, setMovementReason] = useState<string>('');
  const [isSavingMovement, setIsSavingMovement] = useState(false);

  const { refreshTrigger, triggerGlobalRefresh } = useRealtime();

  useEffect(() => {
    loadData();
  }, [refreshTrigger, activeTab]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [salesData, invoicesData] = await Promise.all([
        getSales(),
        getInvoices(),
      ]);
      setSales(salesData);
      setInvoices(invoicesData);

      if (activeTab === 'cash' || activeTab === 'movements') {
        await loadCashData();
      }
    } catch (err: any) {
      console.error('Error al cargar ventas:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadCashData = async () => {
    setIsLoadingCash(true);
    try {
      const [shift, shiftsList, movs] = await Promise.all([
        getActiveCashShift(),
        getCashShifts(),
        getCashMovements(),
      ]);
      setActiveShift(shift);
      setCashShifts(shiftsList);
      setCashMovements(movs);
    } catch (err) {
      console.error('Error al cargar datos de caja:', err);
    } finally {
      setIsLoadingCash(false);
    }
  };

  // Calculations for current active shift
  const shiftCashSales = React.useMemo(() => {
    if (!activeShift) return 0;
    const openedTime = new Date(activeShift.opened_at).getTime();
    return sales
      .filter((s) => {
        const isCash = (s.payment_method || '').toLowerCase().includes('efectivo') || s.payment_method === 'cash';
        const saleTime = new Date(s.created_at).getTime();
        return isCash && saleTime >= openedTime;
      })
      .reduce((sum, s) => sum + Number(s.total_amount || 0), 0);
  }, [activeShift, sales]);

  const shiftDeposits = React.useMemo(() => {
    if (!activeShift) return 0;
    return cashMovements
      .filter((m) => m.cash_register_id === activeShift.id && m.type === 'deposit')
      .reduce((sum, m) => sum + Number(m.amount || 0), 0);
  }, [activeShift, cashMovements]);

  const shiftWithdrawals = React.useMemo(() => {
    if (!activeShift) return 0;
    return cashMovements
      .filter((m) => m.cash_register_id === activeShift.id && m.type === 'withdrawal')
      .reduce((sum, m) => sum + Number(m.amount || 0), 0);
  }, [activeShift, cashMovements]);

  const expectedCashInDrawer = React.useMemo(() => {
    if (!activeShift) return 0;
    return (
      Number(activeShift.initial_amount || 0) +
      shiftCashSales +
      shiftDeposits -
      shiftWithdrawals
    );
  }, [activeShift, shiftCashSales, shiftDeposits, shiftWithdrawals]);

  // Cash Handlers
  const handleOpenShift = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await openCashShift(openShiftAmount, openShiftCashier.trim(), openShiftNotes.trim());
      setIsOpenShiftModalOpen(false);
      await loadCashData();
      triggerGlobalRefresh();
      alert('¡Turno de caja abierto correctamente!');
    } catch (err: any) {
      alert(`Error al abrir caja: ${err.message}`);
    }
  };

  const handleStartCloseShift = () => {
    setCountedCashAmount(expectedCashInDrawer);
    setCloseShiftNotes('');
    setIsCloseShiftModalOpen(true);
  };

  const handleConfirmCloseShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeShift) return;
    setIsClosingShift(true);
    try {
      const res = await closeCashShift(
        activeShift.id,
        countedCashAmount,
        closeShiftNotes.trim()
      );
      setIsCloseShiftModalOpen(false);
      await loadCashData();
      triggerGlobalRefresh();
      alert(
        `Arqueo de caja completado:\n• Efectivo esperado: ${formatCurrency(res.expectedAmount)}\n• Efectivo contado: ${formatCurrency(res.finalCountedAmount)}\n• Diferencia: ${formatCurrency(res.difference)}`
      );
    } catch (err: any) {
      alert(`Error al cerrar turno de caja: ${err.message}`);
    } finally {
      setIsClosingShift(false);
    }
  };

  const handleSaveMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeShift) {
      alert('Debes tener un turno de caja abierto para registrar un movimiento.');
      return;
    }
    setIsSavingMovement(true);
    try {
      await registerCashMovement({
        shiftId: activeShift.id,
        type: movementType,
        amount: movementAmount,
        description: movementReason.trim(),
      });
      setIsMovementModalOpen(false);
      setMovementReason('');
      await loadCashData();
      triggerGlobalRefresh();
      alert('Movimiento de efectivo registrado en caja.');
    } catch (err: any) {
      alert(`Error al registrar movimiento: ${err.message}`);
    } finally {
      setIsSavingMovement(false);
    }
  };

  // Sales Filters
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
    const m = (s.payment_method || 'otro').toLowerCase();
    methodTotals[m] = (methodTotals[m] || 0) + Number(s.total_amount || 0);
  });

  return (
    <div className="space-y-6 font-mono text-white">
      {/* Top Header with Tab Switcher */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-[#0d0d0d] p-6 rounded-xl border border-white/10 shadow-lg">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 bg-[#dc2626] rounded-full accent-glow"></span>
            <span className="text-[10px] font-black uppercase tracking-[0.25em] text-white/50">
              CONTROL FINANCIERO Y OPERATIVO
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white font-display uppercase tracking-tight mt-1">
            VENTAS, CAJA & ARQUEO
          </h1>
          <p className="text-[10px] text-white/40 uppercase tracking-widest mt-0.5 font-mono">
            GESTIÓN DE FACTURACIÓN, APERTURA/CIERRE DE TURNO Y CONTROL DE EFECTIVO (XAF)
          </p>
        </div>

        {/* Tab Buttons */}
        <div className="flex flex-wrap items-center gap-2 bg-[#141414] p-1.5 rounded-lg border border-white/10">
          <button
            onClick={() => setActiveTab('sales')}
            className={`px-3.5 py-2 rounded-md text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'sales'
                ? 'bg-[#dc2626] text-white shadow-md'
                : 'text-white/60 hover:text-white'
            }`}
          >
            <Receipt className="w-3.5 h-3.5" />
            <span>Ventas & Reportes</span>
          </button>
          <button
            onClick={() => setActiveTab('cash')}
            className={`px-3.5 py-2 rounded-md text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'cash'
                ? 'bg-[#dc2626] text-white shadow-md'
                : 'text-white/60 hover:text-white'
            }`}
          >
            <Coins className="w-3.5 h-3.5" />
            <span>Control de Caja & Arqueo</span>
          </button>
          <button
            onClick={() => setActiveTab('movements')}
            className={`px-3.5 py-2 rounded-md text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'movements'
                ? 'bg-[#dc2626] text-white shadow-md'
                : 'text-white/60 hover:text-white'
            }`}
          >
            <ArrowUpRight className="w-3.5 h-3.5" />
            <span>Movimientos Efectivo</span>
          </button>
        </div>
      </div>

      {/* TAB 1: HISTORIAL DE VENTAS */}
      {activeTab === 'sales' && (
        <div className="space-y-6">
          {/* Quick Date Filters & Export */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-[#0d0d0d] p-4 rounded-xl border border-white/10">
            <div className="flex items-center gap-2">
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
                  className="bg-[#141414] border border-white/10 text-white rounded-lg px-2.5 py-1 text-xs"
                />
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleExportCSV}
                className="px-3 py-1.5 bg-[#141414] hover:bg-white/10 border border-white/10 text-white/70 hover:text-white rounded-lg text-xs font-black uppercase flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>CSV</span>
              </button>
              <button
                onClick={handleExportExcel}
                className="px-3 py-1.5 bg-emerald-950/40 hover:bg-emerald-900/60 border border-emerald-500/30 text-emerald-400 rounded-lg text-xs font-black uppercase flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>EXCEL</span>
              </button>
              <button
                onClick={handleExportPDF}
                disabled={isExporting}
                className="px-3 py-1.5 bg-red-950/40 hover:bg-red-900/60 border border-red-500/30 text-red-400 rounded-lg text-xs font-black uppercase flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>PDF</span>
              </button>
            </div>
          </div>

          {/* Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-[#0d0d0d] p-5 rounded-xl border border-white/10">
              <div className="flex items-center justify-between text-white/40 mb-2">
                <span className="text-[10px] font-black uppercase tracking-widest">INGRESOS TOTALES</span>
                <DollarSign className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-2xl font-black text-white">{formatCurrency(totalVolume)}</div>
              <p className="text-[10px] text-white/40 mt-1">Facturación consolidada</p>
            </div>

            <div className="bg-[#0d0d0d] p-5 rounded-xl border border-white/10">
              <div className="flex items-center justify-between text-white/40 mb-2">
                <span className="text-[10px] font-black uppercase tracking-widest">NÚMERO DE VENTAS</span>
                <ShoppingBag className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-2xl font-black text-white">{totalCount}</div>
              <p className="text-[10px] text-white/40 mt-1">Transacciones procesadas</p>
            </div>

            <div className="bg-[#0d0d0d] p-5 rounded-xl border border-white/10">
              <div className="flex items-center justify-between text-white/40 mb-2">
                <span className="text-[10px] font-black uppercase tracking-widest">TICKET MEDIO</span>
                <TrendingUp className="w-4 h-4 text-[#ef4444]" />
              </div>
              <div className="text-2xl font-black text-white">{formatCurrency(averageTicket)}</div>
              <p className="text-[10px] text-white/40 mt-1">Promedio por venta</p>
            </div>
          </div>

          {/* Sales Table */}
          <div className="bg-[#0d0d0d] p-6 rounded-xl border border-white/10 space-y-4">
            <div className="relative">
              <Search className="w-4 h-4 text-white/30 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="BUSCAR POR CLIENTE, FACTURA, CAJERO O MÉTODO DE PAGO..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
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
      )}

      {/* TAB 2: ARQUEO & CONTROL DE CAJA */}
      {activeTab === 'cash' && (
        <div className="space-y-6">
          {/* Active Shift Card */}
          <div className="bg-[#0d0d0d] p-6 rounded-xl border border-white/10 shadow-lg">
            {activeShift ? (
              <div className="space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
                      <Unlock className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 text-[10px] font-black rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 uppercase">
                          TURNO DE CAJA ABIERTO
                        </span>
                        <span className="text-xs text-white/40">
                          Iniciado: {new Date(activeShift.opened_at).toLocaleTimeString('es-ES')}
                        </span>
                      </div>
                      <h3 className="text-lg font-black text-white uppercase mt-0.5">
                        Cajero Responsable: {activeShift.opened_by}
                      </h3>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setIsMovementModalOpen(true)}
                      className="px-3.5 py-2 rounded-lg bg-white/10 hover:bg-white/15 border border-white/10 text-xs font-black uppercase tracking-wider flex items-center gap-1.5 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Entrada/Retiro</span>
                    </button>
                    <button
                      onClick={handleStartCloseShift}
                      className="px-4 py-2 rounded-lg bg-[#dc2626] hover:bg-[#ef4444] text-white text-xs font-black uppercase tracking-wider accent-glow shadow-md cursor-pointer flex items-center gap-2"
                    >
                      <Lock className="w-3.5 h-3.5" />
                      <span>ARQUEO Y CIERRE DE CAJA</span>
                    </button>
                  </div>
                </div>

                {/* Grid with calculations */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-[#141414] p-4 rounded-lg border border-white/5">
                    <span className="text-[10px] text-white/40 uppercase block">Fondo Inicial (Apertura)</span>
                    <span className="text-lg font-black text-white font-mono">
                      {formatCurrency(activeShift.initial_amount)}
                    </span>
                  </div>

                  <div className="bg-[#141414] p-4 rounded-lg border border-white/5">
                    <span className="text-[10px] text-emerald-400 uppercase block">+ Ventas en Efectivo</span>
                    <span className="text-lg font-black text-emerald-400 font-mono">
                      {formatCurrency(shiftCashSales)}
                    </span>
                  </div>

                  <div className="bg-[#141414] p-4 rounded-lg border border-white/5">
                    <span className="text-[10px] text-white/40 uppercase block">Depósitos / Retiros</span>
                    <span className="text-lg font-black text-white font-mono">
                      +{formatCurrency(shiftDeposits)} / -{formatCurrency(shiftWithdrawals)}
                    </span>
                  </div>

                  <div className="bg-red-950/30 p-4 rounded-lg border border-red-900/40">
                    <span className="text-[10px] text-[#ef4444] uppercase font-bold block">
                      EFECTIVO ESPERADO EN GAVETA
                    </span>
                    <span className="text-xl font-black text-white font-mono">
                      {formatCurrency(expectedCashInDrawer)}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-8 text-center space-y-4">
                <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 text-white/40 flex items-center justify-center mx-auto">
                  <Lock className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white uppercase">LA CAJA SE ENCUENTRA CERRADA</h3>
                  <p className="text-xs text-white/40 max-w-md mx-auto mt-1">
                    Abre un nuevo turno de caja para iniciar el registro de ventas en mostrador y control de efectivo.
                  </p>
                </div>
                <button
                  onClick={() => setIsOpenShiftModalOpen(true)}
                  className="px-5 py-2.5 bg-[#dc2626] hover:bg-[#ef4444] text-white text-xs font-black uppercase tracking-wider rounded-lg accent-glow shadow-md cursor-pointer inline-flex items-center gap-2"
                >
                  <Unlock className="w-4 h-4" />
                  <span>ABRIR TURNO DE CAJA</span>
                </button>
              </div>
            )}
          </div>

          {/* Past Shifts History Table */}
          <div className="bg-[#0d0d0d] p-6 rounded-xl border border-white/10 space-y-4 shadow-md">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-white uppercase">HISTORIAL DE TURNOS Y ARQUEOS</h3>
                <p className="text-[10px] text-white/40 uppercase tracking-widest">
                  AUDITORÍA HISTÓRICA DE CIERRES, CONTEOS REALES Y DIFERENCIAS
                </p>
              </div>
            </div>

            {cashShifts.length === 0 ? (
              <div className="text-center py-10 text-white/30 text-xs">
                NO HAY TURNOS DE CAJA REGISTRADOS.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="text-white/40 font-bold uppercase text-[10px] tracking-widest border-b border-white/10 bg-[#141414]">
                      <th className="py-3 px-4">FECHA APERTURA / CIERRE</th>
                      <th className="py-3 px-4">CAJERO</th>
                      <th className="py-3 px-4 text-right">FONDO INICIAL</th>
                      <th className="py-3 px-4 text-right">VENTAS EFECTIVO</th>
                      <th className="py-3 px-4 text-right">CONTEO FINAL</th>
                      <th className="py-3 px-4 text-center">ESTADO</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {cashShifts.map((s) => (
                      <tr key={s.id} className="hover:bg-white/5 transition-colors">
                        <td className="py-3 px-4 font-mono">
                          <div className="text-white">{new Date(s.opened_at).toLocaleString('es-ES')}</div>
                          {s.closed_at && (
                            <div className="text-[10px] text-white/40">
                              Cerró: {new Date(s.closed_at).toLocaleTimeString('es-ES')}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4 font-bold text-white uppercase">
                          {s.opened_by}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-white/70">
                          {formatCurrency(s.initial_amount)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-emerald-400">
                          {formatCurrency(s.total_sales || 0)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-white">
                          {s.final_amount !== null ? formatCurrency(s.final_amount) : 'En curso'}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`px-2 py-0.5 text-[10px] font-black rounded uppercase ${
                              s.status === 'open'
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                : 'bg-white/10 text-white/60 border border-white/10'
                            }`}
                          >
                            {s.status === 'open' ? 'ABIERTO' : 'CERRADO'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: MOVIMIENTOS DE EFECTIVO */}
      {activeTab === 'movements' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-[#0d0d0d] p-4 rounded-xl border border-white/10">
            <div>
              <h3 className="text-base font-black text-white uppercase tracking-tight">
                MOVIMIENTOS DE CAJA (ENTRADAS / SALIDAS)
              </h3>
              <p className="text-[10px] text-white/40 uppercase tracking-widest">
                REGISTRO DE RETIROS DE DINERO, GASTOS MENORES O APORTES DE EFECTIVO
              </p>
            </div>

            <button
              onClick={() => setIsMovementModalOpen(true)}
              disabled={!activeShift}
              className="py-2 px-4 bg-[#dc2626] hover:bg-[#ef4444] text-white rounded-lg font-black text-xs uppercase tracking-wider flex items-center gap-2 accent-glow transition-all cursor-pointer disabled:opacity-40"
            >
              <Plus className="w-4 h-4" />
              <span>REGISTRAR MOVIMIENTO</span>
            </button>
          </div>

          {cashMovements.length === 0 ? (
            <div className="text-center py-12 bg-[#0d0d0d] rounded-xl border border-white/10 text-white/30 text-xs">
              NO HAY MOVIMIENTOS DE EFECTIVO REGISTRADOS.
            </div>
          ) : (
            <div className="bg-[#0d0d0d] border border-white/10 rounded-xl overflow-hidden">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="text-white/40 font-bold uppercase text-[10px] tracking-widest border-b border-white/10 bg-[#141414]">
                    <th className="py-3 px-4">FECHA / HORA</th>
                    <th className="py-3 px-4">TIPO</th>
                    <th className="py-3 px-4">MOTIVO / CONCEPTO</th>
                    <th className="py-3 px-4 text-right">MONTO (XAF)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {cashMovements.map((m) => (
                    <tr key={m.id} className="hover:bg-white/5 transition-colors">
                      <td className="py-3 px-4 font-mono text-white/50">
                        {new Date(m.created_at).toLocaleString('es-ES')}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 text-[10px] font-black rounded uppercase ${
                            m.type === 'deposit'
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : 'bg-red-500/20 text-[#ef4444] border border-red-500/30'
                          }`}
                        >
                          {m.type === 'deposit' ? 'DEPÓSITO (+)' : 'RETIRO (-)'}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-medium text-white">{m.description}</td>
                      <td
                        className={`py-3 px-4 text-right font-mono font-black text-sm ${
                          m.type === 'deposit' ? 'text-emerald-400' : 'text-[#ef4444]'
                        }`}
                      >
                        {m.type === 'deposit' ? '+' : '-'}
                        {formatCurrency(m.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* MODAL APERTURA DE CAJA */}
      {isOpenShiftModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="bg-[#0d0d0d] border border-white/15 rounded-xl max-w-md w-full p-6 text-white relative shadow-2xl animate-in zoom-in-95">
            <button
              onClick={() => setIsOpenShiftModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 text-white/40 hover:text-white rounded-lg hover:bg-white/10"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="text-lg font-black uppercase tracking-tight mb-4 flex items-center gap-2">
              <Unlock className="w-5 h-5 text-emerald-400" />
              <span>Apertura de Turno de Caja</span>
            </h3>

            <form onSubmit={handleOpenShift} className="space-y-3 text-xs">
              <div>
                <label className="block text-white/60 font-bold mb-1 uppercase text-[10px]">
                  Fondo Inicial de Caja (XAF) *
                </label>
                <input
                  type="number"
                  min="0"
                  required
                  value={openShiftAmount}
                  onChange={(e) => setOpenShiftAmount(Number(e.target.value))}
                  placeholder="10000"
                  className="w-full bg-[#141414] border border-white/15 rounded-lg px-3 py-2 text-white font-mono text-base focus:outline-hidden focus:border-[#dc2626]"
                />
              </div>

              <div>
                <label className="block text-white/60 font-bold mb-1 uppercase text-[10px]">
                  Nombre del Cajero / Responsable *
                </label>
                <input
                  type="text"
                  required
                  value={openShiftCashier}
                  onChange={(e) => setOpenShiftCashier(e.target.value)}
                  className="w-full bg-[#141414] border border-white/15 rounded-lg px-3 py-2 text-white uppercase focus:outline-hidden focus:border-[#dc2626]"
                />
              </div>

              <div>
                <label className="block text-white/60 font-bold mb-1 uppercase text-[10px]">
                  Observaciones de Apertura
                </label>
                <textarea
                  rows={2}
                  value={openShiftNotes}
                  onChange={(e) => setOpenShiftNotes(e.target.value)}
                  placeholder="Cambio inicial en billetes de 500 y 1000 XAF..."
                  className="w-full bg-[#141414] border border-white/15 rounded-lg px-3 py-2 text-white focus:outline-hidden focus:border-[#dc2626]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsOpenShiftModalOpen(false)}
                  className="px-4 py-2 bg-[#1a1a1a] hover:bg-white/10 text-white rounded-lg font-black uppercase tracking-wider text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-black uppercase tracking-wider text-xs accent-glow"
                >
                  CONFIRMAR APERTURA
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL CIERRE Y ARQUEO DE CAJA */}
      {isCloseShiftModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="bg-[#0d0d0d] border border-white/15 rounded-xl max-w-md w-full p-6 text-white relative shadow-2xl animate-in zoom-in-95">
            <button
              onClick={() => setIsCloseShiftModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 text-white/40 hover:text-white rounded-lg hover:bg-white/10"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="text-lg font-black uppercase tracking-tight mb-2 flex items-center gap-2">
              <Lock className="w-5 h-5 text-[#ef4444]" />
              <span>Arqueo y Cierre de Caja</span>
            </h3>
            <p className="text-[10px] text-white/40 uppercase tracking-widest mb-4">
              VERIFICACIÓN DE CONTEO FÍSICO CONTRA REGISTRO SISTÉMICO
            </p>

            <form onSubmit={handleConfirmCloseShift} className="space-y-4 text-xs">
              <div className="bg-[#141414] p-3 rounded-lg border border-white/10 space-y-1">
                <div className="flex justify-between text-white/60">
                  <span>Efectivo Sistémico Esperado:</span>
                  <span className="font-mono font-bold text-white">{formatCurrency(expectedCashInDrawer)}</span>
                </div>
              </div>

              <div>
                <label className="block text-white/60 font-bold mb-1 uppercase text-[10px]">
                  Efectivo Físico Contado en Gaveta (XAF) *
                </label>
                <input
                  type="number"
                  min="0"
                  required
                  value={countedCashAmount}
                  onChange={(e) => setCountedCashAmount(Number(e.target.value))}
                  className="w-full bg-[#141414] border border-white/15 rounded-lg px-3 py-2 text-white font-mono text-lg font-black focus:outline-hidden focus:border-[#dc2626]"
                />
              </div>

              {/* Difference card */}
              <div
                className={`p-3 rounded-lg border flex items-center justify-between ${
                  countedCashAmount - expectedCashInDrawer === 0
                    ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-400'
                    : countedCashAmount - expectedCashInDrawer > 0
                    ? 'bg-amber-950/30 border-amber-500/40 text-amber-400'
                    : 'bg-red-950/40 border-red-500/40 text-[#ef4444]'
                }`}
              >
                <span className="font-bold uppercase text-[10px]">Diferencia de Arqueo:</span>
                <span className="font-mono font-black text-sm">
                  {countedCashAmount - expectedCashInDrawer === 0
                    ? 'CUADRADO EXACTO (0 XAF)'
                    : countedCashAmount - expectedCashInDrawer > 0
                    ? `SOBRANTE: +${formatCurrency(countedCashAmount - expectedCashInDrawer)}`
                    : `FALTANTE: ${formatCurrency(countedCashAmount - expectedCashInDrawer)}`}
                </span>
              </div>

              <div>
                <label className="block text-white/60 font-bold mb-1 uppercase text-[10px]">
                  Notas / Justificación de Cierre
                </label>
                <textarea
                  rows={2}
                  value={closeShiftNotes}
                  onChange={(e) => setCloseShiftNotes(e.target.value)}
                  placeholder="Detalles sobre billetes o justificación en caso de diferencia..."
                  className="w-full bg-[#141414] border border-white/15 rounded-lg px-3 py-2 text-white focus:outline-hidden focus:border-[#dc2626]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsCloseShiftModalOpen(false)}
                  className="px-4 py-2 bg-[#1a1a1a] hover:bg-white/10 text-white rounded-lg font-black uppercase tracking-wider text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isClosingShift}
                  className="px-5 py-2 bg-[#dc2626] hover:bg-[#ef4444] text-white rounded-lg font-black uppercase tracking-wider text-xs accent-glow"
                >
                  {isClosingShift ? 'CERRANDO...' : 'CONFIRMAR CIERRE'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL ENTRADA / SALIDA DE EFECTIVO */}
      {isMovementModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="bg-[#0d0d0d] border border-white/15 rounded-xl max-w-md w-full p-6 text-white relative shadow-2xl animate-in zoom-in-95">
            <button
              onClick={() => setIsMovementModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 text-white/40 hover:text-white rounded-lg hover:bg-white/10"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="text-lg font-black uppercase tracking-tight mb-4 flex items-center gap-2">
              <Coins className="w-5 h-5 text-[#ef4444]" />
              <span>Registrar Movimiento de Efectivo</span>
            </h3>

            <form onSubmit={handleSaveMovement} className="space-y-3 text-xs">
              <div>
                <label className="block text-white/60 font-bold mb-1 uppercase text-[10px]">
                  Tipo de Movimiento
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setMovementType('deposit')}
                    className={`py-2 rounded-lg font-black uppercase text-xs border transition-all cursor-pointer ${
                      movementType === 'deposit'
                        ? 'bg-emerald-600 text-white border-emerald-500'
                        : 'bg-[#141414] text-white/50 border-white/10'
                    }`}
                  >
                    + Entrada / Depósito
                  </button>
                  <button
                    type="button"
                    onClick={() => setMovementType('withdrawal')}
                    className={`py-2 rounded-lg font-black uppercase text-xs border transition-all cursor-pointer ${
                      movementType === 'withdrawal'
                        ? 'bg-red-600 text-white border-red-500'
                        : 'bg-[#141414] text-white/50 border-white/10'
                    }`}
                  >
                    - Salida / Retiro
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-white/60 font-bold mb-1 uppercase text-[10px]">
                  Monto (XAF) *
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={movementAmount}
                  onChange={(e) => setMovementAmount(Number(e.target.value))}
                  className="w-full bg-[#141414] border border-white/15 rounded-lg px-3 py-2 text-white font-mono text-base focus:outline-hidden focus:border-[#dc2626]"
                />
              </div>

              <div>
                <label className="block text-white/60 font-bold mb-1 uppercase text-[10px]">
                  Motivo / Concepto *
                </label>
                <input
                  type="text"
                  required
                  value={movementReason}
                  onChange={(e) => setMovementReason(e.target.value)}
                  placeholder="Ej: Pago de flete, compra de cinta embalaje, etc."
                  className="w-full bg-[#141414] border border-white/15 rounded-lg px-3 py-2 text-white focus:outline-hidden focus:border-[#dc2626]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsMovementModalOpen(false)}
                  className="px-4 py-2 bg-[#1a1a1a] hover:bg-white/10 text-white rounded-lg font-black uppercase tracking-wider text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingMovement}
                  className="px-5 py-2 bg-[#dc2626] hover:bg-[#ef4444] text-white rounded-lg font-black uppercase tracking-wider text-xs accent-glow"
                >
                  {isSavingMovement ? 'GUARDANDO...' : 'REGISTRAR'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
