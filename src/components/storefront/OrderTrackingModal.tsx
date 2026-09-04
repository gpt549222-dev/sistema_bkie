import React, { useState } from 'react';
import { getOrderByNumber } from '../../services/orderService';
import { getInvoiceByOrderId } from '../../services/invoiceService';
import { Order, OrderStatus, Invoice } from '../../types';
import { formatCurrency } from '../../utils/currency';
import {
  X,
  Search,
  Truck,
  CheckCircle2,
  Clock,
  Package,
  AlertCircle,
  Receipt,
  Phone,
  MapPin,
  Calendar,
  Send,
  Loader2,
} from 'lucide-react';

interface OrderTrackingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onViewInvoice?: (invoice: Invoice) => void;
}

export const OrderTrackingModal: React.FC<OrderTrackingModalProps> = ({
  isOpen,
  onClose,
  onViewInvoice,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [order, setOrder] = useState<Order | null>(null);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchTerm.trim()) return;

    setIsSearching(true);
    setErrorMessage(null);
    setOrder(null);
    setInvoice(null);
    setHasSearched(true);

    try {
      const found = await getOrderByNumber(searchTerm.trim());
      if (!found) {
        setErrorMessage('No se encontró ningún pedido con ese número.');
      } else {
        setOrder(found);
        // Check if invoice exists
        const inv = await getInvoiceByOrderId(found.id);
        if (inv) setInvoice(inv);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error al buscar el pedido');
    } finally {
      setIsSearching(false);
    }
  };

  const statusSteps: { id: OrderStatus; label: string; desc: string }[] = [
    { id: 'pending', label: 'Registrado', desc: 'Esperando confirmación' },
    { id: 'accepted', label: 'Aceptado', desc: 'Pedido verificado' },
    { id: 'preparing', label: 'En Preparación', desc: 'Empacando útiles' },
    { id: 'ready', label: 'Listo', desc: 'Empaque finalizado' },
    { id: 'shipped', label: 'En Camino / Enviado', desc: 'En ruta de entrega' },
    { id: 'delivered', label: 'Entregado', desc: 'Completado con éxito' },
  ];

  const getStepStatus = (stepId: OrderStatus, currentStatus: OrderStatus) => {
    if (currentStatus === 'cancelled') return 'cancelled';
    const orderFlow: OrderStatus[] = ['pending', 'accepted', 'preparing', 'ready', 'shipped', 'delivered'];
    const currentIndex = orderFlow.indexOf(currentStatus);
    const stepIndex = orderFlow.indexOf(stepId);

    if (stepIndex < currentIndex) return 'completed';
    if (stepIndex === currentIndex) return 'current';
    return 'upcoming';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs overflow-y-auto">
      <div className="bg-[#0d0d0d] rounded-xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl border border-white/10 text-white relative my-8 animate-in fade-in zoom-in-95 duration-200">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-white/40 hover:text-white hover:bg-white/5 border border-transparent hover:border-white/10 rounded-lg transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-white/10">
          <div className="w-12 h-12 rounded-xl bg-[#dc2626] text-white flex items-center justify-center accent-glow shadow-md">
            <Truck className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-white font-display uppercase tracking-tight">
              RASTREO DE PEDIDO EN VIVO
            </h2>
            <p className="text-[10px] text-white/40 uppercase tracking-widest font-mono">
              ESTADO DE PREPARACIÓN, FACTURACIÓN Y DESPACHO (XAF)
            </p>
          </div>
        </div>

        {/* Search input form */}
        <form onSubmit={handleSearch} className="mb-6">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Ingresa tu número de pedido (Ej. BIK-20260831-1234)"
                className="w-full pl-9.5 pr-4 py-3 bg-[#141414] border border-white/10 rounded-lg text-xs text-white placeholder:text-white/30 focus:border-[#dc2626] focus:outline-hidden font-mono"
              />
            </div>
            <button
              type="submit"
              disabled={isSearching || !searchTerm.trim()}
              className="px-5 py-3 bg-[#dc2626] hover:bg-[#ef4444] disabled:opacity-50 text-white font-black text-xs uppercase tracking-wider rounded-lg flex items-center gap-2 accent-glow cursor-pointer transition-all shrink-0 shadow-md"
            >
              {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              <span>BUSCAR</span>
            </button>
          </div>
        </form>

        {errorMessage && (
          <div className="p-4 rounded-lg bg-[#dc2626]/10 border border-[#dc2626]/30 text-[#ef4444] text-xs font-bold flex items-center gap-2 mb-6">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Order Details View */}
        {order && (
          <div className="space-y-6">
            {/* Status Highlight Banner */}
            <div
              className={`p-4 rounded-xl border flex items-center justify-between font-mono ${
                order.status === 'cancelled'
                  ? 'bg-red-950/40 border-red-500/30 text-red-300'
                  : order.status === 'delivered'
                  ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
                  : 'bg-[#141414] text-white border-white/10'
              }`}
            >
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-white/40">
                  ESTADO ACTUAL
                </span>
                <h3 className="text-base font-black uppercase tracking-wider">
                  {order.status === 'pending' && '🟡 PEDIDO REGISTRADO'}
                  {order.status === 'accepted' && '🔵 PEDIDO ACEPTADO'}
                  {order.status === 'preparing' && '🟠 EMPACANDO ÚTILES'}
                  {order.status === 'ready' && '🟢 LISTO PARA ENTREGA'}
                  {order.status === 'shipped' && '🚚 EN CAMINO A DESTINO'}
                  {order.status === 'delivered' && '✅ ENTREGADO CON ÉXITO'}
                  {order.status === 'cancelled' && '❌ PEDIDO CANCELADO'}
                </h3>
              </div>

              <div className="text-right">
                <span className="text-sm font-mono font-black text-[#ef4444] block">{order.order_number}</span>
                <span className="text-[11px] text-white/50">
                  TOTAL: {formatCurrency(order.total)}
                </span>
              </div>
            </div>

            {/* Timeline Progress */}
            {order.status !== 'cancelled' && (
              <div className="py-2">
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {statusSteps.map((step) => {
                    const st = getStepStatus(step.id, order.status);
                    return (
                      <div
                        key={step.id}
                        className={`p-2.5 rounded-lg border text-center transition-all font-mono ${
                          st === 'completed'
                            ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-400'
                            : st === 'current'
                            ? 'bg-[#dc2626] text-white border-[#dc2626] font-black accent-glow shadow-md'
                            : 'bg-[#141414] border-white/10 text-white/30'
                        }`}
                      >
                        <div className="text-[10px] font-black uppercase tracking-wider truncate">{step.label}</div>
                        <div className="text-[9px] mt-0.5 opacity-80 uppercase truncate">{step.desc}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Order & Items Summary */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
              <div className="p-3.5 bg-[#141414] rounded-lg border border-white/10 space-y-1">
                <p className="font-black text-white uppercase tracking-wider">RESUMEN DEL PEDIDO:</p>
                <p className="text-white/70">👤 CLIENTE: {order.customer_name}</p>
                <p className="text-white/50 text-[11px]">
                  📅 FECHA: {order.created_at ? new Date(order.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'N/A'}
                </p>
                <p className="text-white/40 text-[10px] uppercase">
                  💳 ESTADO DE PAGO: {order.payment_status === 'confirmed' ? 'PAGADO' : 'PENDIENTE'}
                </p>
              </div>

              <div className="p-3.5 bg-[#141414] rounded-lg border border-white/10 space-y-1.5">
                <p className="font-black text-white uppercase tracking-wider">ARTÍCULOS:</p>
                <div className="max-h-24 overflow-y-auto space-y-1">
                  {order.items?.map((item) => (
                    <div key={item.id} className="flex justify-between text-white/70">
                      <span className="truncate pr-2">
                        {item.quantity}x {item.product_name}
                      </span>
                      <span className="font-mono text-[#ef4444] font-bold">{formatCurrency(item.total_price)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-white/10">
              {invoice && onViewInvoice ? (
                <button
                  onClick={() => onViewInvoice(invoice)}
                  className="px-4 py-2.5 bg-white/10 hover:bg-white/20 border border-white/20 text-white font-black text-xs uppercase tracking-wider rounded-lg flex items-center gap-1.5 cursor-pointer"
                >
                  <Receipt className="w-3.5 h-3.5 text-[#ef4444]" />
                  <span>VER FACTURA OFICIAL ({invoice.invoice_number})</span>
                </button>
              ) : (
                <span className="text-[11px] text-white/40 font-mono">
                  {order.payment_status === 'confirmed'
                    ? 'Factura emitida en caja.'
                    : 'La factura se emitirá al confirmar el pago.'}
                </span>
              )}

              <button
                onClick={onClose}
                className="px-5 py-2.5 bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-black uppercase tracking-wider rounded-lg cursor-pointer"
              >
                CERRAR
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
