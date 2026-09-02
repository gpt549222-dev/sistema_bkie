import React, { useEffect, useState } from 'react';
import {
  TrendingUp,
  ShoppingBag,
  Package,
  AlertTriangle,
  Tag,
  Clock,
  ArrowRight,
  Plus,
  Calculator,
  Receipt,
  CheckCircle2,
  RefreshCw,
  ExternalLink,
  Layers,
  Truck,
  Sparkles,
  BarChart3,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { getOrders, updateOrderStatus } from '../../services/orderService';
import { getProducts } from '../../services/productService';
import { getOffers } from '../../services/offerService';
import { getInvoices, getSales } from '../../services/invoiceService';
import { Order, Product, Offer, Invoice, Sale } from '../../types';
import { useRealtime } from '../../context/RealtimeContext';
import { formatCurrency } from '../../utils/currency';
import { AdminTab } from './AdminLayout';

interface AdminDashboardProps {
  onNavigateTab: (tab: AdminTab) => void;
  onSelectOrder: (order: Order) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  onNavigateTab,
  onSelectOrder,
}) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { refreshTrigger, triggerGlobalRefresh } = useRealtime();

  useEffect(() => {
    loadDashboardData();
  }, [refreshTrigger]);

  const loadDashboardData = async () => {
    setIsLoading(true);
    try {
      const [oData, pData, ofData, sData, iData] = await Promise.allSettled([
        getOrders(),
        getProducts(true),
        getOffers(),
        getSales(),
        getInvoices(),
      ]);

      if (oData.status === 'fulfilled') setOrders(oData.value);
      if (pData.status === 'fulfilled') setProducts(pData.value);
      if (ofData.status === 'fulfilled') setOffers(ofData.value);
      if (sData.status === 'fulfilled') setSales(sData.value);
      if (iData.status === 'fulfilled') setInvoices(iData.value);
    } finally {
      setIsLoading(false);
    }
  };

  // Calculations
  const todayStr = new Date().toISOString().slice(0, 10);
  const todaySales = sales.filter((s) => s.created_at.startsWith(todayStr));
  const todayTotalSales = todaySales.reduce((sum, s) => sum + Number(s.total_amount || 0), 0);

  const monthStr = new Date().toISOString().slice(0, 7);
  const monthSales = sales.filter((s) => s.created_at.startsWith(monthStr));
  const monthTotalSales = monthSales.reduce((sum, s) => sum + Number(s.total_amount || 0), 0);

  const pendingOrders = orders.filter((o) => o.status === 'pending');
  const lowStockProducts = products.filter((p) => p.stock <= p.min_stock);
  const activeOffers = offers.filter((o) => o.status === 'active');
  const recentOrders = orders.slice(0, 5);

  // Daily sales chart data for the current month
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const monthPrefix = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
  const monthName = now.toLocaleString('es-ES', { month: 'long' });

  const dailyChartData = Array.from({ length: daysInMonth }, (_, i) => {
    const dayNum = i + 1;
    const dayStr = `${monthPrefix}-${String(dayNum).padStart(2, '0')}`;
    const daySalesItems = sales.filter((s) => s.created_at && s.created_at.startsWith(dayStr));
    const total = daySalesItems.reduce((sum, s) => sum + Number(s.total_amount || 0), 0);
    const count = daySalesItems.length;
    return {
      day: `Día ${dayNum}`,
      shortDay: `${dayNum}`,
      total,
      count,
    };
  });

  const handleQuickAccept = async (orderId: string) => {
    try {
      await updateOrderStatus(orderId, 'accepted', 'Dashboard');
      triggerGlobalRefresh();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Welcome Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#0d0d0d] p-6 rounded-xl border border-white/10 shadow-lg">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-white font-display uppercase tracking-tight">
            RESUMEN OPERATIVO
          </h1>
          <p className="text-[10px] text-white/50 uppercase tracking-widest font-mono mt-1">
            MÉTRICAS & STOCK EN TIEMPO REAL · BIKIE PAPELERÍA (XAF)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => onNavigateTab('pos')}
            className="px-4 py-2.5 bg-[#dc2626] hover:bg-[#ef4444] text-white font-black text-xs uppercase tracking-wider rounded-lg flex items-center gap-2 shadow-lg accent-glow transition-all cursor-pointer active:scale-95 font-mono"
          >
            <Calculator className="w-4 h-4" />
            <span>ABRIR POS / CAJA</span>
          </button>
          <button
            onClick={() => onNavigateTab('services')}
            className="px-3.5 py-2.5 bg-white/10 hover:bg-white/15 text-white font-black text-xs uppercase tracking-wider rounded-lg flex items-center gap-2 border border-white/10 transition-all cursor-pointer font-mono"
          >
            <Layers className="w-4 h-4 text-[#ef4444]" />
            <span>SERVICIOS</span>
          </button>
          <button
            onClick={() => onNavigateTab('suppliers')}
            className="px-3.5 py-2.5 bg-white/10 hover:bg-white/15 text-white font-black text-xs uppercase tracking-wider rounded-lg flex items-center gap-2 border border-white/10 transition-all cursor-pointer font-mono"
          >
            <Truck className="w-4 h-4 text-[#ef4444]" />
            <span>PROVEEDORES</span>
          </button>
          <button
            onClick={loadDashboardData}
            disabled={isLoading}
            className="p-2.5 bg-[#141414] hover:bg-white/10 border border-white/10 text-white/70 hover:text-white rounded-lg transition-colors cursor-pointer"
            title="Actualizar datos"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-[#ef4444]' : ''}`} />
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Sales Today */}
        <div className="bg-[#0d0d0d] p-5 rounded-xl border border-white/10 shadow-md">
          <div className="flex items-center justify-between text-white/50 mb-2">
            <span className="text-[10px] font-black uppercase tracking-widest font-mono">VENTAS DE HOY</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-white font-mono">
            {formatCurrency(todayTotalSales)}
          </div>
          <p className="text-[10px] text-white/40 font-mono mt-1">
            {todaySales.length} transacciones hoy
          </p>
        </div>

        {/* Pending Orders */}
        <div
          onClick={() => onNavigateTab('orders')}
          className="bg-[#0d0d0d] p-5 rounded-xl border border-white/10 hover:border-[#dc2626]/60 transition-colors cursor-pointer shadow-md"
        >
          <div className="flex items-center justify-between text-white/50 mb-2">
            <span className="text-[10px] font-black uppercase tracking-widest font-mono">PEDIDOS PENDIENTES</span>
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-[#ef4444] font-mono">
            {pendingOrders.length}
          </div>
          <p className="text-[10px] text-amber-400/80 font-mono mt-1">
            {pendingOrders.length > 0 ? 'Requieren atención en caja' : 'Todos al día'}
          </p>
        </div>

        {/* Low Stock Alerts */}
        <div
          onClick={() => onNavigateTab('products')}
          className="bg-[#0d0d0d] p-5 rounded-xl border border-white/10 hover:border-[#dc2626]/60 transition-colors cursor-pointer shadow-md"
        >
          <div className="flex items-center justify-between text-white/50 mb-2">
            <span className="text-[10px] font-black uppercase tracking-widest font-mono">ALERTAS DE STOCK</span>
            <div className="w-8 h-8 rounded-lg bg-red-500/10 text-[#ef4444] border border-red-500/20 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-white font-mono">
            {lowStockProducts.length}
          </div>
          <p className="text-[10px] text-[#ef4444] font-mono mt-1">
            {lowStockProducts.length > 0 ? 'Artículos con stock crítico' : 'Stock saludable'}
          </p>
        </div>

        {/* Active Promotions */}
        <div
          onClick={() => onNavigateTab('offers')}
          className="bg-[#0d0d0d] p-5 rounded-xl border border-white/10 hover:border-[#dc2626]/60 transition-colors cursor-pointer shadow-md"
        >
          <div className="flex items-center justify-between text-white/50 mb-2">
            <span className="text-[10px] font-black uppercase tracking-widest font-mono">OFERTAS ACTIVAS</span>
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20 flex items-center justify-center">
              <Tag className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-white font-mono">
            {activeOffers.length}
          </div>
          <p className="text-[10px] text-purple-300 font-mono mt-1">
            Descuentos en catálogo
          </p>
        </div>
      </div>

      {/* Daily Sales Chart Bar - Current Month */}
      <div className="bg-[#0d0d0d] rounded-xl p-6 border border-white/10 shadow-md space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-black text-white font-display uppercase tracking-tight flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-[#ef4444]" />
              <span>VENTAS DIARIAS DE {monthName.toUpperCase()} {currentYear}</span>
            </h3>
            <p className="text-[10px] text-white/40 uppercase tracking-widest font-mono">
              EVOLUCIÓN DIARIA EN FCFA (XAF) CON DATOS REALES DE SUPABASE
            </p>
          </div>
          <div className="text-right">
            <span className="text-[10px] text-white/40 font-mono uppercase block">TOTAL ACUMULADO DEL MES</span>
            <span className="text-base font-black text-white font-mono">{formatCurrency(monthTotalSales)}</span>
          </div>
        </div>

        <div className="h-64 w-full pt-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dailyChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
              <XAxis
                dataKey="shortDay"
                stroke="#ffffff40"
                fontSize={10}
                tickLine={false}
                axisLine={{ stroke: '#ffffff20' }}
              />
              <YAxis
                stroke="#ffffff40"
                fontSize={10}
                tickLine={false}
                axisLine={{ stroke: '#ffffff20' }}
                tickFormatter={(val) => (val >= 1000 ? `${(val / 1000).toFixed(0)}k` : `${val}`)}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#141414',
                  borderColor: '#ffffff20',
                  borderRadius: '8px',
                  color: '#ffffff',
                  fontSize: '11px',
                  fontFamily: 'monospace',
                }}
                formatter={(value: any) => [formatCurrency(Number(value || 0)), 'Ventas']}
                labelFormatter={(label) => `Día ${label} de ${monthName}`}
              />
              <Bar
                dataKey="total"
                fill="#dc2626"
                radius={[4, 4, 0, 0]}
                activeBar={{ fill: '#ef4444' }}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Main 2-column content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Orders List (2 columns) */}
        <div className="lg:col-span-2 bg-[#0d0d0d] rounded-xl p-6 border border-white/10 space-y-4 shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-black text-white font-display uppercase tracking-tight">
                PEDIDOS RECIENTES
              </h3>
              <p className="text-[10px] text-white/40 uppercase tracking-widest font-mono">
                ÚLTIMAS ÓRDENES REGISTRADAS DESDE WEB O POS
              </p>
            </div>
            <button
              onClick={() => onNavigateTab('orders')}
              className="text-xs font-black text-[#ef4444] hover:text-[#dc2626] flex items-center gap-1 cursor-pointer font-mono uppercase tracking-wider"
            >
              <span>VER TODOS ({orders.length})</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {recentOrders.length === 0 ? (
            <div className="text-center py-10 text-white/30 text-xs font-mono">
              NO HAY PEDIDOS REGISTRADOS AÚN.
            </div>
          ) : (
            <div className="divide-y divide-white/5 overflow-x-auto font-mono">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="text-white/40 font-bold uppercase text-[10px] tracking-widest pb-2 border-b border-white/10">
                    <th className="py-2">PEDIDO</th>
                    <th className="py-2">CLIENTE</th>
                    <th className="py-2">TOTAL</th>
                    <th className="py-2">ESTADO</th>
                    <th className="py-2 text-right">ACCIÓN</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {recentOrders.map((order) => (
                    <tr key={order.id} className="hover:bg-white/5 transition-colors">
                      <td className="py-3 font-mono font-black text-[#ef4444]">
                        {order.order_number}
                      </td>
                      <td className="py-3">
                        <p className="font-bold text-white uppercase">{order.customer_name}</p>
                        <p className="text-[10px] text-white/40">{order.customer_phone}</p>
                      </td>
                      <td className="py-3 font-mono font-black text-white">
                        {formatCurrency(order.total)}
                      </td>
                      <td className="py-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
                            order.status === 'pending'
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : order.status === 'accepted'
                              ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                              : order.status === 'delivered'
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : order.status === 'cancelled'
                              ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                              : 'bg-white/10 text-white/70 border border-white/20'
                          }`}
                        >
                          {(order.status || '').toUpperCase()}
                        </span>
                      </td>
                      <td className="py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {order.status === 'pending' && (
                            <button
                              onClick={() => handleQuickAccept(order.id)}
                              className="px-2 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-[10px] font-black uppercase tracking-wider cursor-pointer"
                            >
                              ACEPTAR
                            </button>
                          )}
                          <button
                            onClick={() => onSelectOrder(order)}
                            className="px-2.5 py-1 bg-white/10 hover:bg-white/20 border border-white/20 text-white rounded text-[10px] font-black uppercase tracking-wider cursor-pointer"
                          >
                            DETALLES
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Low Stock Watchlist (1 column) */}
        <div className="bg-[#0d0d0d] rounded-xl p-6 border border-white/10 space-y-4 shadow-md">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-black text-white font-display uppercase tracking-tight flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-[#ef4444]" />
              <span>CONTROL DE STOCK</span>
            </h3>
            <button
              onClick={() => onNavigateTab('products')}
              className="text-xs text-white/50 hover:text-white font-mono uppercase tracking-wider cursor-pointer"
            >
              Inventario
            </button>
          </div>

          {lowStockProducts.length === 0 ? (
            <div className="text-center py-8 text-white/30 text-xs font-mono">
              <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
              <p>TODO EL CATÁLOGO TIENE STOCK SUFICIENTE.</p>
            </div>
          ) : (
            <div className="space-y-2 font-mono">
              {lowStockProducts.slice(0, 5).map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between p-2.5 bg-[#141414] rounded-lg border border-white/10 text-xs"
                >
                  <div className="min-w-0 pr-2">
                    <p className="font-bold text-white uppercase truncate">{p.name}</p>
                    <p className="text-[10px] font-mono text-white/40">{p.code}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <span
                      className={`font-mono font-black text-[10px] px-2 py-0.5 rounded uppercase tracking-wider ${
                        p.stock <= 0
                          ? 'bg-red-500/20 text-[#ef4444] border border-red-500/30'
                          : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      }`}
                    >
                      {p.stock <= 0 ? '0 (AGOTADO)' : `${p.stock} DISP.`}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

