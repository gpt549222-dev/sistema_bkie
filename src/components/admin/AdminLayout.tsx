import React, { useState } from 'react';
import {
  LayoutDashboard,
  ShoppingBag,
  Calculator,
  Receipt,
  Package,
  Layers,
  Tag,
  Boxes,
  TrendingUp,
  Bell,
  Settings,
  LogOut,
  ArrowLeft,
  Volume2,
  VolumeX,
  Database,
  Radio,
  User,
  Check,
  FileText,
  Truck,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useRealtime } from '../../context/RealtimeContext';
import { playSuccessChime } from '../../utils/audio';

export type AdminTab =
  | 'dashboard'
  | 'orders'
  | 'pos'
  | 'services'
  | 'suppliers'
  | 'invoices'
  | 'products'
  | 'categories'
  | 'offers'
  | 'inventory'
  | 'sales'
  | 'notifications'
  | 'settings';

interface AdminLayoutProps {
  currentTab: AdminTab;
  setCurrentTab: (tab: AdminTab) => void;
  onExitAdmin: () => void;
  children: React.ReactNode;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({
  currentTab,
  setCurrentTab,
  onExitAdmin,
  children,
}) => {
  const { user, logout } = useAuth();
  const { status, unreadCount, resetUnreadCount } = useRealtime();
  const [soundEnabled, setSoundEnabled] = useState(true);

  const menuItems: { id: AdminTab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'orders', label: 'Pedidos', icon: <ShoppingBag className="w-4 h-4" /> },
    { id: 'pos', label: 'Punto de Venta (POS)', icon: <Calculator className="w-4 h-4" /> },
    { id: 'services', label: 'Servicios Adicionales', icon: <FileText className="w-4 h-4" /> },
    { id: 'suppliers', label: 'Proveedores & Enlaces', icon: <Truck className="w-4 h-4" /> },
    { id: 'invoices', label: 'Facturas', icon: <Receipt className="w-4 h-4" /> },
    { id: 'products', label: 'Productos & Stock', icon: <Package className="w-4 h-4" /> },
    { id: 'categories', label: 'Categorías', icon: <Layers className="w-4 h-4" /> },
    { id: 'offers', label: 'Ofertas & Promociones', icon: <Tag className="w-4 h-4" /> },
    { id: 'inventory', label: 'Kardex / Movimientos', icon: <Boxes className="w-4 h-4" /> },
    { id: 'sales', label: 'Ventas & Caja', icon: <TrendingUp className="w-4 h-4" /> },
    { id: 'notifications', label: 'Notificaciones', icon: <Bell className="w-4 h-4" />, badge: unreadCount },
    { id: 'settings', label: 'Configuración & Empresa', icon: <Settings className="w-4 h-4" /> },
  ];

  const handleTestSound = () => {
    playSuccessChime();
    setSoundEnabled(!soundEnabled);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col md:flex-row text-white selection:bg-[#dc2626] selection:text-white">
      {/* Admin Sidebar */}
      <aside className="w-full md:w-64 bg-[#080808] text-neutral-300 flex flex-col justify-between shrink-0 border-r border-white/10">
        <div>
          {/* Brand header */}
          <div className="p-5 border-b border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-[#dc2626] text-white flex items-center justify-center font-black text-xl font-display shadow-lg accent-glow">
                B
              </div>
              <div>
                <span className="font-black text-lg text-white tracking-tighter font-display">BIKIE</span>
                <p className="text-[9px] text-[#ef4444] font-bold uppercase tracking-[0.2em] -mt-1 font-mono">
                  SISTEMAS INFORMÁTICOS
                </p>
              </div>
            </div>

            {/* Back to store button */}
            <button
              onClick={onExitAdmin}
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
              title="Volver a la Tienda"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          </div>

          {/* Realtime Status Indicator in Sidebar */}
          <div className="px-4 py-2.5 bg-[#050505] border-b border-white/10 flex items-center justify-between text-xs font-mono">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider select-none">
              <Radio className="w-3.5 h-3.5 text-[#ef4444]" />
              <span className="text-white/40">Sync:</span>
              <span
                className={`font-black ${
                  status === 'connected'
                    ? 'text-emerald-400'
                    : status === 'reconnecting'
                    ? 'text-amber-400'
                    : 'text-[#ef4444]'
                }`}
              >
                {status === 'connected' ? 'ONLINE' : status === 'reconnecting' ? 'SYNCING' : 'OFFLINE'}
              </span>
            </div>

            <button
              onClick={handleTestSound}
              className="p-1 text-white/40 hover:text-white transition-colors cursor-pointer"
              title={soundEnabled ? 'Sonido Activado' : 'Sonido Silenciado'}
            >
              {soundEnabled ? <Volume2 className="w-3.5 h-3.5 text-emerald-400" /> : <VolumeX className="w-3.5 h-3.5 text-white/30" />}
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="p-3 space-y-1">
            {menuItems.map((item) => {
              const isActive = currentTab === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setCurrentTab(item.id);
                    if (item.id === 'notifications') {
                      resetUnreadCount();
                    }
                  }}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-[11px] font-black uppercase tracking-[0.12em] transition-all cursor-pointer border ${
                    isActive
                      ? 'bg-[#dc2626] text-white border-[#dc2626] shadow-md accent-glow'
                      : 'bg-transparent text-white/60 hover:text-white hover:bg-white/5 border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    {item.icon}
                    <span>{item.label}</span>
                  </div>

                  {item.badge !== undefined && item.badge > 0 && (
                    <span className="bg-white text-[#dc2626] text-[9px] font-mono font-black px-1.5 py-0.5 rounded-full">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Footer Admin User / Logout */}
        <div className="p-4 border-t border-white/10 space-y-2.5 bg-[#050505]">
          <div className="flex items-center justify-between px-2 text-[10px] uppercase tracking-wider text-white/40 font-mono">
            <div className="flex items-center gap-1.5 truncate">
              <User className="w-3.5 h-3.5 text-[#ef4444] shrink-0" />
              <span className="truncate">{user?.email || 'ADMIN@BIKIE.COM'}</span>
            </div>
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/10 text-white/70 font-black">
              ADMIN
            </span>
          </div>

          <div className="flex flex-col gap-2">
            <button
              onClick={async () => {
                await logout();
                onExitAdmin();
              }}
              id="btn-admin-logout"
              className="w-full py-2.5 px-3 bg-red-600/15 hover:bg-[#dc2626] border border-red-500/30 hover:border-[#dc2626] text-white rounded-lg text-[10px] font-black uppercase tracking-[0.15em] flex items-center justify-center gap-2 transition-all cursor-pointer accent-glow"
              title="Cerrar sesión y volver a la tienda"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>CERRAR SESIÓN</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Admin View Content */}
      <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto max-w-7xl bg-[#0a0a0a]">
        {children}
      </main>
    </div>
  );
};
