import React, { useState, useEffect } from 'react';
import {
  getOrders,
  updateOrderStatus,
  cancelOrder,
} from '../../services/orderService';
import { processPaymentAndIssueInvoice } from '../../services/invoiceService';
import { Order, OrderStatus, PaymentMethod, Invoice, BusinessSettings } from '../../types';
import { formatCurrency } from '../../utils/currency';
import { useRealtime } from '../../context/RealtimeContext';
import {
  Search,
  Filter,
  CheckCircle2,
  Clock,
  Truck,
  XCircle,
  Receipt,
  Phone,
  Eye,
  RefreshCw,
  Send,
  AlertCircle,
  FileText,
  CreditCard,
  X,
} from 'lucide-react';

interface AdminOrdersProps {
  businessSettings: BusinessSettings;
  onViewInvoice: (invoice: Invoice) => void;
  selectedOrderFromDashboard?: Order | null;
}

export const AdminOrders: React.FC<AdminOrdersProps> = ({
  businessSettings,
  onViewInvoice,
  selectedOrderFromDashboard,
}) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [paymentModalOrder, setPaymentModalOrder] = useState<Order | null>(null);
  const [payMethod, setPayMethod] = useState<PaymentMethod>('pago_movil');
  const [payReference, setPayReference] = useState('');
  const [cashierName, setCashierName] = useState('Caja Principal');
  const { refreshTrigger, triggerGlobalRefresh } = useRealtime();

  useEffect(() => {
    loadOrders();
  }, [refreshTrigger]);

  useEffect(() => {
    if (selectedOrderFromDashboard) {
      setSelectedOrder(selectedOrderFromDashboard);
    }
  }, [selectedOrderFromDashboard]);

  const loadOrders = async () => {
    setIsLoading(true);
    try {
      const data = await getOrders();
      setOrders(data);
      if (selectedOrder) {
        const updated = data.find((o) => o.id === selectedOrder.id);
        if (updated) setSelectedOrder(updated);
      }
    } catch (err: any) {
      console.error('Error al cargar pedidos:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStatusChange = async (orderId: string, newStatus: OrderStatus, note?: string) => {
    try {
      await updateOrderStatus(orderId, newStatus, 'Administrador', note);
      triggerGlobalRefresh();
    } catch (err: any) {
      alert(`Error al actualizar estado: ${err.message}`);
    }
  };

  const [cancelModalOrder, setCancelModalOrder] = useState<Order | null>(null);
  const [cancelReason, setCancelReason] = useState('Cancelado por solicitud del cliente');
  const [isCancelling, setIsCancelling] = useState(false);

  const handleConfirmCancel = async () => {
    if (!cancelModalOrder) return;
    setIsCancelling(true);
    try {
      await cancelOrder(cancelModalOrder.id, cancelReason.trim() || 'Cancelado por administrador', 'Administrador');
      triggerGlobalRefresh();
      setCancelModalOrder(null);
      if (selectedOrder?.id === cancelModalOrder.id) {
        setSelectedOrder((prev) => prev ? { ...prev, status: 'cancelled' } : null);
      }
    } catch (err: any) {
      alert(`Error al cancelar pedido: ${err.message}`);
    } finally {
      setIsCancelling(false);
    }
  };

  const handleConfirmPaymentAndInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentModalOrder) return;

    setIsProcessingPayment(true);
    try {
      const res = await processPaymentAndIssueInvoice({
        order_id: paymentModalOrder.id,
        payment_method: payMethod,
        amount: paymentModalOrder.total,
        reference: payReference.trim() || null,
        cashier_name: cashierName.trim() || 'Caja Principal',
      });

      alert(`¡Cobro registrado con éxito! Factura emitida: ${res.invoice_number}`);
      setPaymentModalOrder(null);
      triggerGlobalRefresh();
    } catch (err: any) {
      alert(`Error al procesar cobro y factura: ${err.message}`);
    } finally {
      setIsProcessingPayment(false);
    }
  };

  // Filtered orders
  const filteredOrders = orders.filter((o) => {
    const matchesStatus = statusFilter === 'all' || o.status === statusFilter;
    const matchesSearch =
      o.order_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.customer_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.customer_phone.includes(searchQuery);
    return matchesStatus && matchesSearch;
  });

  const getStatusBadge = (status: OrderStatus) => {
    switch (status) {
      case 'pending':
        return <span className="px-2 py-0.5 rounded-xs text-[9px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30">🟡 PENDIENTE</span>;
      case 'accepted':
        return <span className="px-2 py-0.5 rounded-xs text-[9px] font-black uppercase tracking-wider bg-blue-500/20 text-blue-300 border border-blue-500/30">🔵 ACEPTADO</span>;
      case 'preparing':
        return <span className="px-2 py-0.5 rounded-xs text-[9px] font-black uppercase tracking-wider bg-orange-500/20 text-orange-300 border border-orange-500/30">🟠 PREPARANDO</span>;
      case 'ready':
        return <span className="px-2 py-0.5 rounded-xs text-[9px] font-black uppercase tracking-wider bg-purple-500/20 text-purple-300 border border-purple-500/30">🟣 LISTO</span>;
      case 'shipped':
        return <span className="px-2 py-0.5 rounded-xs text-[9px] font-black uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">🚚 ENVIADO</span>;
      case 'delivered':
        return <span className="px-2 py-0.5 rounded-xs text-[9px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">✅ ENTREGADO</span>;
      case 'cancelled':
        return <span className="px-2 py-0.5 rounded-xs text-[9px] font-black uppercase tracking-wider bg-red-500/20 text-red-300 border border-red-500/30">❌ CANCELADO</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#0d0d0d] p-6 rounded-sm border border-white/10">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-white font-display uppercase tracking-tight">
            GESTIÓN DE PEDIDOS
          </h1>
          <p className="text-[10px] text-white/40 uppercase tracking-widest font-mono mt-0.5">
            FLUJO DE DESPACHO, COBROS & FACTURACIÓN DIGITAL
          </p>
        </div>

        <button
          onClick={loadOrders}
          disabled={isLoading}
          className="px-4 py-2.5 bg-[#141414] hover:bg-white/10 border border-white/10 text-white rounded-xs text-xs font-black uppercase tracking-wider flex items-center gap-1.5 cursor-pointer transition-colors font-mono"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-[#ff3e00]' : ''}`} />
          <span>ACTUALIZAR</span>
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none font-mono">
        {[
          { id: 'all', label: 'TODOS' },
          { id: 'pending', label: 'PENDIENTES' },
          { id: 'accepted', label: 'ACEPTADOS' },
          { id: 'preparing', label: 'EN PREPARACIÓN' },
          { id: 'ready', label: 'LISTOS' },
          { id: 'shipped', label: 'EN CAMINO' },
          { id: 'delivered', label: 'ENTREGADOS' },
          { id: 'cancelled', label: 'CANCELADOS' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setStatusFilter(tab.id)}
            className={`px-3.5 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider whitespace-nowrap transition-all cursor-pointer ${
              statusFilter === tab.id
                ? 'bg-[#dc2626] text-white shadow-md accent-glow'
                : 'bg-[#141414] text-white/60 hover:text-white border border-white/10 hover:bg-white/5'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search and Table */}
      <div className="bg-[#0d0d0d] rounded-xl p-6 border border-white/10 space-y-4">
        <div className="flex items-center gap-2 max-w-md">
          <div className="relative flex-1 font-mono">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="BUSCAR POR # PEDIDO, CLIENTE..."
              className="w-full pl-9.5 pr-4 py-2.5 bg-[#141414] border border-white/10 rounded-lg text-xs text-white placeholder:text-white/30 focus:border-[#dc2626] focus:outline-hidden uppercase"
            />
          </div>
        </div>

        {filteredOrders.length === 0 ? (
          <div className="text-center py-12 text-white/30 text-xs font-mono">
            NO SE ENCONTRARON PEDIDOS CON LOS FILTROS APLICADOS.
          </div>
        ) : (
          <div className="overflow-x-auto font-mono">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="text-white/40 font-bold uppercase text-[10px] tracking-widest border-b border-white/10 pb-2">
                  <th className="py-2.5">PEDIDO</th>
                  <th className="py-2.5">FECHA</th>
                  <th className="py-2.5">CLIENTE</th>
                  <th className="py-2.5">ITEMS</th>
                  <th className="py-2.5">TOTAL</th>
                  <th className="py-2.5">PAGO</th>
                  <th className="py-2.5">ESTADO</th>
                  <th className="py-2.5 text-right">ACCIONES</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-white/5 transition-colors">
                    <td className="py-3 font-mono font-black text-[#ef4444]">
                      {order.order_number}
                    </td>
                    <td className="py-3 text-white/50 text-[11px]">
                      {new Date(order.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-3">
                      <p className="font-bold text-white uppercase">{order.customer_name}</p>
                      <p className="text-[10px] text-white/40">{order.customer_phone}</p>
                    </td>
                    <td className="py-3 text-white/60">
                      {order.items?.length || 0} items
                    </td>
                    <td className="py-3 font-mono font-black text-white">
                      {formatCurrency(order.total)}
                    </td>
                    <td className="py-3">
                      <span
                        className={`text-[9px] font-black px-2 py-0.5 rounded-lg uppercase tracking-wider ${
                          order.payment_status === 'confirmed'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        }`}
                      >
                        {order.payment_status === 'confirmed' ? 'PAGADO' : 'PENDIENTE'}
                      </span>
                    </td>
                    <td className="py-3">{getStatusBadge(order.status)}</td>
                    <td className="py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {/* Quick state transitions */}
                        {order.status === 'pending' && (
                          <button
                            onClick={() => handleStatusChange(order.id, 'accepted')}
                            className="px-2 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-[9px] font-black uppercase tracking-wider cursor-pointer shadow"
                          >
                            ACEPTAR
                          </button>
                        )}
                        {order.status === 'accepted' && (
                          <button
                            onClick={() => handleStatusChange(order.id, 'preparing')}
                            className="px-2 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-[9px] font-black uppercase tracking-wider cursor-pointer shadow"
                          >
                            PREPARAR
                          </button>
                        )}
                        {order.status === 'preparing' && (
                          <button
                            onClick={() => handleStatusChange(order.id, 'ready')}
                            className="px-2 py-1 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-[9px] font-black uppercase tracking-wider cursor-pointer shadow"
                          >
                            LISTO
                          </button>
                        )}
                        {order.status === 'ready' && (
                          <button
                            onClick={() => handleStatusChange(order.id, 'shipped')}
                            className="px-2 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-[9px] font-black uppercase tracking-wider cursor-pointer shadow"
                          >
                            ENVIAR
                          </button>
                        )}
                        {order.status === 'shipped' && (
                          <button
                            onClick={() => handleStatusChange(order.id, 'delivered')}
                            className="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[9px] font-black uppercase tracking-wider cursor-pointer shadow"
                          >
                            ENTREGAR
                          </button>
                        )}

                        {/* Cobrar & Facturar button if not paid */}
                        {order.payment_status !== 'confirmed' && order.status !== 'cancelled' && (
                          <button
                            onClick={() => setPaymentModalOrder(order)}
                            className="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[9px] font-black uppercase tracking-wider flex items-center gap-1 cursor-pointer shadow"
                            title="Cobrar y Emitir Factura"
                          >
                            <Receipt className="w-3 h-3" />
                            <span>COBRAR</span>
                          </button>
                        )}

                        {/* Cancel & return stock button */}
                        {order.status !== 'cancelled' && (
                          <button
                            onClick={() => setCancelModalOrder(order)}
                            className="px-2 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30 rounded-lg text-[9px] font-black uppercase tracking-wider flex items-center gap-1 cursor-pointer"
                            title="Cancelar pedido y devolver stock a inventario"
                          >
                            <XCircle className="w-3 h-3 text-[#ef4444]" />
                            <span className="hidden sm:inline">CANCELAR</span>
                          </button>
                        )}

                        <button
                          onClick={() => setSelectedOrder(order)}
                          className="p-1.5 bg-white/10 hover:bg-white/20 border border-white/20 text-white rounded-lg text-[10px] font-bold cursor-pointer"
                          title="Ver detalles"
                        >
                          <Eye className="w-3.5 h-3.5" />
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

      {/* Order Detail Side Modal / Drawer */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs overflow-y-auto">
          <div className="bg-[#0d0d0d] rounded-xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl border border-white/10 relative my-8 text-white">
            <button
              onClick={() => setSelectedOrder(null)}
              className="absolute top-4 right-4 p-2 text-white/40 hover:text-white hover:bg-white/10 border border-transparent hover:border-white/10 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center justify-between pb-4 mb-4 border-b border-white/10">
              <div>
                <span className="text-xs font-mono font-black text-[#ef4444]">
                  {selectedOrder.order_number}
                </span>
                <h3 className="text-lg font-black text-white font-display uppercase tracking-tight">
                  DETALLE DEL PEDIDO
                </h3>
              </div>
              <div>{getStatusBadge(selectedOrder.status)}</div>
            </div>

            {/* Customer info & Delivery */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono bg-[#141414] p-4 rounded-lg border border-white/10 mb-4">
              <div>
                <p className="font-black text-white/40 uppercase text-[10px] tracking-widest mb-1">CLIENTE:</p>
                <p className="text-white font-bold">{selectedOrder.customer_name}</p>
                <p className="text-white/70">📞 {selectedOrder.customer_phone}</p>
                {selectedOrder.customer_email && (
                  <p className="text-white/70">✉️ {selectedOrder.customer_email}</p>
                )}
              </div>
              <div>
                <p className="font-black text-white/40 uppercase text-[10px] tracking-widest mb-1">ENTREGA & PAGO:</p>
                <p className="text-white">
                  📍 {selectedOrder.delivery_address || 'Retiro en tienda'}
                </p>
                <p className="text-white/70">
                  💳 {(selectedOrder.payment_method || 'EFECTIVO').toUpperCase()} ({selectedOrder.payment_status === 'confirmed' ? 'PAGADO' : 'PENDIENTE'})
                </p>
              </div>
            </div>

            {/* Items */}
            <div className="mb-4 font-mono">
              <p className="text-xs font-black text-white uppercase tracking-wider mb-2">ARTÍCULOS DEL PEDIDO:</p>
              <div className="border border-white/10 rounded-lg overflow-hidden divide-y divide-white/5 text-xs">
                {selectedOrder.items?.map((item) => (
                  <div key={item.id} className="p-3 flex justify-between items-center bg-[#141414]">
                    <div>
                      <p className="font-bold text-white uppercase">{item.product_name}</p>
                      <p className="text-[10px] text-white/50">
                        {item.quantity} x {formatCurrency(item.unit_price)}{' '}
                        {item.discount_amount > 0 && `(Desc: -${formatCurrency(item.discount_amount)})`}
                      </p>
                    </div>
                    <span className="font-mono font-bold text-white">
                      {formatCurrency(item.total_price)}
                    </span>
                  </div>
                ))}
                <div className="p-3 bg-[#181818] flex justify-between font-black text-xs text-white">
                  <span className="uppercase tracking-wider">TOTAL PEDIDO:</span>
                  <span className="font-mono text-sm text-[#ef4444]">
                    {formatCurrency(selectedOrder.total)}
                  </span>
                </div>
              </div>
            </div>

            {/* Status History Timeline */}
            {selectedOrder.history && selectedOrder.history.length > 0 && (
              <div className="mb-6 font-mono">
                <p className="text-xs font-black text-white uppercase tracking-wider mb-2">HISTORIAL DE ESTADOS:</p>
                <div className="space-y-1.5 text-[11px] max-h-32 overflow-y-auto p-2 bg-[#141414] rounded-lg border border-white/10">
                  {selectedOrder.history.map((h) => (
                    <div key={h.id} className="flex items-center justify-between text-white/70">
                      <span>
                        <strong className="text-white">{(h.new_status || '').toUpperCase()}</strong>: {h.note || 'Sin nota'}
                      </span>
                      <span className="text-[10px] text-white/40">
                        {new Date(h.created_at).toLocaleTimeString()} ({h.changed_by})
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-4 border-t border-white/10 font-mono">
              <div className="flex gap-2">
                {selectedOrder.status !== 'cancelled' && (
                  <button
                    onClick={() => {
                      setCancelModalOrder(selectedOrder);
                    }}
                    className="px-3 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30 text-[10px] font-black uppercase tracking-wider rounded-lg cursor-pointer flex items-center gap-1.5"
                  >
                    <XCircle className="w-3.5 h-3.5 text-[#ef4444]" />
                    <span>CANCELAR & DEVOLVER STOCK</span>
                  </button>
                )}
              </div>

              <div className="flex gap-2">
                {selectedOrder.payment_status !== 'confirmed' && selectedOrder.status !== 'cancelled' && (
                  <button
                    onClick={() => {
                      setPaymentModalOrder(selectedOrder);
                      setSelectedOrder(null);
                    }}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-black uppercase tracking-wider rounded-lg flex items-center gap-1 cursor-pointer shadow"
                  >
                    <Receipt className="w-3.5 h-3.5" />
                    <span>COBRAR Y FACTURAR</span>
                  </button>
                )}
                <button
                  onClick={() => setSelectedOrder(null)}
                  className="px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white text-[10px] font-black uppercase tracking-wider rounded-lg cursor-pointer"
                >
                  CERRAR
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Order & Return Stock Modal */}
      {cancelModalOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xs overflow-y-auto font-mono">
          <div className="bg-[#0d0d0d] rounded-2xl max-w-md w-full p-6 shadow-2xl border border-red-500/30 relative text-white space-y-4">
            <button
              onClick={() => setCancelModalOrder(null)}
              className="absolute top-4 right-4 p-2 text-white/40 hover:text-white hover:bg-white/10 rounded-lg cursor-pointer transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 pb-3 border-b border-white/10">
              <div className="w-10 h-10 rounded-xl bg-red-500/20 border border-red-500/30 text-[#ef4444] flex items-center justify-center">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-black text-white font-display uppercase tracking-tight">
                  CANCELAR PEDIDO & DEVOLVER STOCK
                </h3>
                <p className="text-[11px] text-white/50">
                  {cancelModalOrder.order_number} • {cancelModalOrder.customer_name}
                </p>
              </div>
            </div>

            <div className="p-3 bg-[#141414] rounded-xl border border-white/10 space-y-2 text-xs">
              <p className="text-white/60 text-[11px] uppercase">
                Artículos que regresarán automáticamente al inventario:
              </p>
              <div className="space-y-1">
                {cancelModalOrder.items?.map((item) => (
                  <div key={item.id} className="flex justify-between text-white font-mono text-[11px]">
                    <span className="truncate pr-2">• {item.product_name}</span>
                    <span className="text-emerald-400 font-bold">+{item.quantity} unid.</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2 text-xs">
              <label className="block text-white/60 font-black uppercase text-[10px] tracking-wider">
                MOTIVO DE LA CANCELACIÓN
              </label>
              <select
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="w-full p-2.5 bg-[#141414] border border-white/10 rounded-lg text-xs text-white focus:border-[#dc2626] focus:outline-hidden"
              >
                <option value="Cancelado por solicitud del cliente">Solicitud directa del cliente</option>
                <option value="Falta de pago / Comprobante no verificado">Falta de pago / Sin confirmación</option>
                <option value="Error en la selección del producto">Error en datos o producto</option>
                <option value="Sin stock disponible">Falta de disponibilidad física</option>
                <option value="Pedido duplicado">Pedido duplicado</option>
              </select>

              <input
                type="text"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="O escribe un motivo personalizado..."
                className="w-full p-2.5 bg-[#141414] border border-white/10 rounded-lg text-xs text-white placeholder:text-white/30 focus:border-[#dc2626] focus:outline-hidden"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={handleConfirmCancel}
                disabled={isCancelling}
                className="flex-1 py-3 bg-[#dc2626] hover:bg-[#b91c1c] text-white font-black uppercase tracking-wider text-xs rounded-xl flex items-center justify-center gap-1.5 cursor-pointer shadow-lg transition-all disabled:opacity-50 min-h-[44px]"
              >
                <XCircle className="w-4 h-4" />
                <span>{isCancelling ? 'RESTITUYENDO...' : 'CONFIRMAR Y RESTITUIR'}</span>
              </button>
              <button
                type="button"
                onClick={() => setCancelModalOrder(null)}
                className="py-3 px-4 bg-[#141414] hover:bg-white/10 border border-white/10 text-white font-black uppercase tracking-wider text-xs rounded-xl cursor-pointer min-h-[44px]"
              >
                VOLVER
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment & Invoice Modal */}
      {paymentModalOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs overflow-y-auto">
          <div className="bg-[#0d0d0d] rounded-xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-white/10 relative my-8 text-white font-mono">
            <button
              onClick={() => setPaymentModalOrder(null)}
              className="absolute top-4 right-4 p-2 text-white/40 hover:text-white hover:bg-white/10 border border-transparent hover:border-white/10 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4 pb-3 border-b border-white/10">
              <div className="w-10 h-10 rounded-lg bg-[#dc2626] text-white flex items-center justify-center accent-glow shadow">
                <Receipt className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-white font-display uppercase tracking-tight">
                  COBRAR Y FACTURAR
                </h3>
                <p className="text-xs text-white/40 font-mono">
                  {paymentModalOrder.order_number} • {formatCurrency(paymentModalOrder.total)}
                </p>
              </div>
            </div>

            <form onSubmit={handleConfirmPaymentAndInvoice} className="space-y-4 text-xs">
              <div>
                <label className="block font-black text-white/60 uppercase tracking-wider mb-1">MÉTODO DE PAGO</label>
                <select
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value as PaymentMethod)}
                  className="w-full p-2.5 bg-[#141414] border border-white/10 rounded-lg text-xs text-white focus:border-[#dc2626] focus:outline-hidden"
                >
                  <option value="pago_movil" className="bg-[#141414] text-white">Orange / MTN MoMo</option>
                  <option value="efectivo" className="bg-[#141414] text-white">Efectivo FCFA</option>
                  <option value="binance" className="bg-[#141414] text-white">Binance Pay USDT</option>
                  <option value="punto_venta" className="bg-[#141414] text-white">Punto de Venta</option>
                  <option value="transferencia" className="bg-[#141414] text-white">Transferencia Bancaria</option>
                </select>
              </div>

              <div>
                <label className="block font-black text-white/60 uppercase tracking-wider mb-1">
                  N° DE REFERENCIA / COMPROBANTE
                </label>
                <input
                  type="text"
                  value={payReference}
                  onChange={(e) => setPayReference(e.target.value)}
                  placeholder="Ej. REF-948190 o 'Efectivo en Caja'"
                  className="w-full p-2.5 bg-[#141414] border border-white/10 rounded-lg text-xs text-white placeholder:text-white/30 focus:border-[#dc2626] focus:outline-hidden font-mono"
                />
              </div>

              <div>
                <label className="block font-black text-white/60 uppercase tracking-wider mb-1">CAJERO / OPERADOR</label>
                <input
                  type="text"
                  value={cashierName}
                  onChange={(e) => setCashierName(e.target.value)}
                  className="w-full p-2.5 bg-[#141414] border border-white/10 rounded-lg text-xs text-white placeholder:text-white/30 focus:border-[#dc2626] focus:outline-hidden"
                />
              </div>

              <div className="p-3 bg-[#141414] rounded-lg border border-white/10 text-white/60 space-y-1 text-[10px] uppercase">
                <p>• SE REGISTRARÁ EN LA TABLA PAYMENTS DE SUPABASE.</p>
                <p>• SE GENERARÁ FACTURA DIGITAL CON CORRELATIVO OFICIAL.</p>
                <p>• SE REGISTRARÁ LA VENTA Y ACTUALIZARÁ EL ESTADO.</p>
              </div>

              <button
                type="submit"
                disabled={isProcessingPayment}
                className="w-full py-3.5 bg-[#dc2626] hover:bg-[#ef4444] text-white font-black uppercase tracking-[0.2em] rounded-xl text-xs flex items-center justify-center gap-2 cursor-pointer accent-glow transition-all disabled:opacity-50 shadow-lg"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  {isProcessingPayment ? 'PROCESANDO EN SUPABASE...' : `CONFIRMAR COBRO (${formatCurrency(paymentModalOrder.total)})`}
                </span>
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
