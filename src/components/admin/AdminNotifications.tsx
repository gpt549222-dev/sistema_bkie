import React, { useState, useEffect } from 'react';
import {
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  deleteAllNotifications,
  clearReadNotifications,
} from '../../services/notificationService';
import { AppNotification } from '../../types';
import { useRealtime } from '../../context/RealtimeContext';
import {
  Bell,
  CheckCircle2,
  AlertTriangle,
  ShoppingBag,
  CreditCard,
  Tag,
  Info,
  CheckCheck,
  RefreshCw,
  Trash2,
} from 'lucide-react';

export const AdminNotifications: React.FC = () => {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [filterType, setFilterType] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);
  const { refreshTrigger, triggerGlobalRefresh } = useRealtime();

  useEffect(() => {
    loadNotifications();
  }, [refreshTrigger]);

  const loadNotifications = async () => {
    setIsLoading(true);
    try {
      const data = await getNotifications();
      setNotifications(data);
    } catch (err: any) {
      console.error('Error loading notifications:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMarkAsRead = async (id: string) => {
    try {
      await markNotificationAsRead(id);
      triggerGlobalRefresh();
    } catch (err: any) {
      console.error(err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsAsRead();
      triggerGlobalRefresh();
    } catch (err: any) {
      console.error(err);
    }
  };

  const handleDeleteOne = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteNotification(id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      triggerGlobalRefresh();
    } catch (err: any) {
      alert(`Error al eliminar notificación: ${err.message}`);
    }
  };

  const handleClearAll = async () => {
    if (!confirm('¿Estás seguro de que deseas eliminar TODAS las notificaciones?')) return;
    try {
      await deleteAllNotifications();
      setNotifications([]);
      triggerGlobalRefresh();
    } catch (err: any) {
      alert(`Error al limpiar notificaciones: ${err.message}`);
    }
  };

  const handleClearRead = async () => {
    try {
      await clearReadNotifications();
      setNotifications((prev) => prev.filter((n) => !n.is_read));
      triggerGlobalRefresh();
    } catch (err: any) {
      alert(`Error al limpiar notificaciones leídas: ${err.message}`);
    }
  };

  const filtered = notifications.filter((n) => {
    return filterType === 'all' ? true : n.type === filterType;
  });

  const getIcon = (type: string) => {
    switch (type) {
      case 'new_order':
        return <ShoppingBag className="w-4 h-4 text-[#ef4444]" />;
      case 'payment_confirmed':
        return <CreditCard className="w-4 h-4 text-emerald-400" />;
      case 'low_stock':
        return <AlertTriangle className="w-4 h-4 text-amber-400" />;
      case 'offer_alert':
        return <Tag className="w-4 h-4 text-purple-400" />;
      default:
        return <Info className="w-4 h-4 text-white/60" />;
    }
  };

  return (
    <div className="space-y-6 font-mono">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-[#0d0d0d] p-6 rounded-xl border border-white/10">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-white font-display uppercase tracking-tight">
            CENTRO DE NOTIFICACIONES
          </h1>
          <p className="text-[10px] text-white/40 uppercase tracking-widest mt-0.5">
            ALERTAS DE NUEVOS PEDIDOS, PAGOS CONFIRMADOS Y AVISOS DE STOCK CRÍTICO
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleMarkAllRead}
            className="px-3.5 py-2 bg-[#141414] hover:bg-white/10 border border-white/10 text-white rounded-lg text-xs font-black uppercase tracking-wider flex items-center gap-1.5 cursor-pointer transition-all"
            title="Marcar todas como leídas"
          >
            <CheckCheck className="w-4 h-4 text-[#ef4444]" />
            <span>LEER TODO</span>
          </button>
          <button
            onClick={handleClearRead}
            className="px-3.5 py-2 bg-[#141414] hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 rounded-lg text-xs font-black uppercase tracking-wider flex items-center gap-1.5 cursor-pointer transition-all"
            title="Eliminar solo las notificaciones ya leídas"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>LIMPIAR LEÍDAS</span>
          </button>
          <button
            onClick={handleClearAll}
            className="px-3.5 py-2 bg-red-600/20 hover:bg-red-600 border border-red-500/40 text-red-300 hover:text-white rounded-lg text-xs font-black uppercase tracking-wider flex items-center gap-1.5 cursor-pointer transition-all"
            title="Eliminar todas las notificaciones"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>VACIAR BANDEJA</span>
          </button>
          <button
            onClick={loadNotifications}
            disabled={isLoading}
            className="p-2 bg-[#141414] hover:bg-white/10 border border-white/10 text-white rounded-lg transition-colors cursor-pointer"
            title="Actualizar"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-[#ef4444]' : ''}`} />
          </button>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        {[
          { id: 'all', label: 'TODAS' },
          { id: 'new_order', label: 'NUEVOS PEDIDOS' },
          { id: 'payment_confirmed', label: 'PAGOS' },
          { id: 'low_stock', label: 'STOCK BAJO' },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setFilterType(t.id)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
              filterType === t.id
                ? 'bg-[#dc2626] text-white accent-glow shadow'
                : 'bg-[#0d0d0d] text-white/60 hover:text-white border border-white/10'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Notifications list */}
      <div className="bg-[#0d0d0d] rounded-xl p-6 border border-white/10 space-y-3">
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-white/30 text-xs uppercase tracking-widest">
            NO HAY NOTIFICACIONES PARA MOSTRAR.
          </div>
        ) : (
          filtered.map((n) => (
            <div
              key={n.id}
              onClick={() => !n.is_read && handleMarkAsRead(n.id)}
              className={`p-4 rounded-lg border flex items-start justify-between gap-3 transition-all cursor-pointer ${
                n.is_read
                  ? 'bg-[#141414]/40 border-white/5 opacity-60'
                  : 'bg-[#141414] border-[#dc2626]/40 hover:border-[#dc2626]'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-black border border-white/10 flex items-center justify-center shrink-0 mt-0.5">
                  {getIcon(n.type)}
                </div>
                <div>
                  <h4 className="font-bold text-white text-xs uppercase">{n.title}</h4>
                  <p className="text-xs text-white/60 mt-0.5">{n.message}</p>
                  <span className="text-[10px] text-white/40 font-mono mt-1 block">
                    {new Date(n.created_at).toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {!n.is_read && (
                  <span className="w-2.5 h-2.5 rounded-full bg-[#dc2626] shrink-0 mt-1 accent-glow shadow"></span>
                )}
                <button
                  onClick={(e) => handleDeleteOne(n.id, e)}
                  className="p-1.5 hover:bg-white/10 text-white/40 hover:text-red-400 rounded transition-colors cursor-pointer"
                  title="Eliminar notificación"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

