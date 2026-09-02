import React, { useState, useEffect } from 'react';
import { getInventoryMovements } from '../../services/productService';
import { InventoryMovement } from '../../types';
import { useRealtime } from '../../context/RealtimeContext';
import {
  Boxes,
  Search,
  RefreshCw,
  ArrowDownRight,
  ArrowUpRight,
  Filter,
  Calendar,
} from 'lucide-react';

export const AdminInventory: React.FC = () => {
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);
  const { refreshTrigger } = useRealtime();

  useEffect(() => {
    loadMovements();
  }, [refreshTrigger]);

  const loadMovements = async () => {
    setIsLoading(true);
    try {
      const data = await getInventoryMovements();
      setMovements(data);
    } catch (err: any) {
      console.error('Error al cargar kardex:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const filtered = movements.filter((m) => {
    const matchesType = typeFilter === 'all' || m.movement_type === typeFilter;
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      (m.product?.name && m.product.name.toLowerCase().includes(q)) ||
      (m.product?.code && m.product.code.toLowerCase().includes(q)) ||
      (m.reason && m.reason.toLowerCase().includes(q)) ||
      (m.user_name && m.user_name.toLowerCase().includes(q));
    return matchesType && matchesSearch;
  });

  const getMovementBadge = (type: string) => {
    switch (type) {
      case 'venta':
        return <span className="px-2 py-0.5 rounded-xs text-[9px] font-black uppercase tracking-wider bg-blue-500/20 text-blue-300 border border-blue-500/30">Venta POS/Web (-)</span>;
      case 'compra':
        return <span className="px-2 py-0.5 rounded-xs text-[9px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">Compra / Entrada (+)</span>;
      case 'ajuste_manual':
        return <span className="px-2 py-0.5 rounded-xs text-[9px] font-black uppercase tracking-wider bg-purple-500/20 text-purple-300 border border-purple-500/30">Ajuste Manual</span>;
      case 'devolucion_cliente':
        return <span className="px-2 py-0.5 rounded-xs text-[9px] font-black uppercase tracking-wider bg-teal-500/20 text-teal-300 border border-teal-500/30">Devolución (+)</span>;
      case 'cancelacion_pedido':
        return <span className="px-2 py-0.5 rounded-xs text-[9px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30">Restitución Cancelación (+)</span>;
      case 'daño_merma':
        return <span className="px-2 py-0.5 rounded-xs text-[9px] font-black uppercase tracking-wider bg-red-500/20 text-red-300 border border-red-500/30">Merma / Daño (-)</span>;
      default:
        return <span className="px-2 py-0.5 rounded-xs text-[9px] font-black uppercase tracking-wider bg-white/10 text-white/70 border border-white/20">{(type || '').toUpperCase()}</span>;
    }
  };

  return (
    <div className="space-y-6 font-mono">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#0d0d0d] p-6 rounded-sm border border-white/10">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-white font-display uppercase tracking-tight">
            KARDEX & AUDITORÍA DE INVENTARIO
          </h1>
          <p className="text-[10px] text-white/40 uppercase tracking-widest mt-0.5">
            TRAZABILIDAD COMPLETA DE ENTRADAS, SALIDAS, VENTAS Y AJUSTES DE STOCK
          </p>
        </div>

        <button
          onClick={loadMovements}
          disabled={isLoading}
          className="px-4 py-2 bg-[#141414] hover:bg-white/10 border border-white/10 text-white rounded-lg text-xs font-black uppercase tracking-wider flex items-center gap-1.5 cursor-pointer transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-[#ef4444]' : ''}`} />
          <span>ACTUALIZAR KARDEX</span>
        </button>
      </div>

      {/* Filter and Table */}
      <div className="bg-[#0d0d0d] rounded-xl p-6 border border-white/10 space-y-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="BUSCAR POR PRODUCTO, MOTIVO O USUARIO..."
              className="w-full pl-9.5 pr-4 py-2 bg-[#141414] border border-white/10 rounded-lg text-xs text-white uppercase placeholder:text-white/30 focus:border-[#dc2626] focus:outline-hidden"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto pb-1 scrollbar-none">
            {[
              { id: 'all', label: 'TODOS' },
              { id: 'venta', label: 'VENTAS' },
              { id: 'compra', label: 'COMPRAS' },
              { id: 'ajuste_manual', label: 'AJUSTES' },
              { id: 'cancelacion_pedido', label: 'CANCELACIONES' },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setTypeFilter(t.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider whitespace-nowrap transition-all cursor-pointer ${
                  typeFilter === t.id
                    ? 'bg-[#dc2626] text-white shadow-md accent-glow'
                    : 'bg-[#141414] text-white/60 hover:text-white border border-white/10 hover:border-white/20'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-12 text-white/30 text-xs uppercase tracking-widest">
            NO SE HAN REGISTRADO MOVIMIENTOS DE INVENTARIO TODAVÍA.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="text-white/40 font-black uppercase text-[10px] tracking-wider border-b border-white/10 pb-2">
                  <th className="py-2.5">FECHA / HORA</th>
                  <th className="py-2.5">PRODUCTO</th>
                  <th className="py-2.5">TIPO MOVIMIENTO</th>
                  <th className="py-2.5 text-center">VARIACIÓN</th>
                  <th className="py-2.5 text-center">STOCK (ANT → NUEVO)</th>
                  <th className="py-2.5">MOTIVO / JUSTIFICACIÓN</th>
                  <th className="py-2.5 text-right">USUARIO</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filtered.map((m) => {
                  const isPositive = m.quantity_change > 0;
                  return (
                    <tr key={m.id} className="hover:bg-white/5 transition-colors">
                      <td className="py-3 text-white/40 font-mono text-[11px]">
                        {new Date(m.created_at).toLocaleString()}
                      </td>

                      <td className="py-3">
                        <p className="font-bold text-white uppercase">{m.product?.name || 'Artículo'}</p>
                        <p className="text-[10px] font-mono text-white/40">
                          {m.product?.code}
                        </p>
                      </td>

                      <td className="py-3">{getMovementBadge(m.movement_type)}</td>

                      <td className="py-3 text-center">
                        <span
                          className={`font-mono font-black text-xs px-2 py-0.5 rounded-xs ${
                            isPositive
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : 'bg-red-500/20 text-red-300 border border-red-500/30'
                          }`}
                        >
                          {isPositive ? `+${m.quantity_change}` : m.quantity_change}
                        </span>
                      </td>

                      <td className="py-3 text-center font-mono text-white/60">
                        {m.old_stock} → <strong className="text-white font-bold">{m.new_stock}</strong>
                      </td>

                      <td className="py-3 text-white/70 text-[11px]">
                        {m.reason || 'Sin observación'}
                      </td>

                      <td className="py-3 text-right text-white/40 font-semibold text-[11px] uppercase">
                        {m.user_name || 'SISTEMA'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
