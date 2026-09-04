import React from 'react';
import {
  ShoppingBag,
  Search,
  Truck,
  Sparkles,
  Camera,
  Lock,
} from 'lucide-react';
import { useCart } from '../../context/CartContext';

interface HeaderProps {
  onOpenTracker?: () => void;
  onOpenTracking?: () => void;
  onOpenAdmin: () => void;
  onOpenNotifications?: () => void;
  onOpenAiScanner?: () => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  currentView?: 'store' | 'admin' | 'storefront';
  setCurrentView?: (view: any) => void;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenTracker,
  onOpenTracking,
  onOpenAdmin,
  onOpenAiScanner,
  searchQuery,
  setSearchQuery,
  currentView = 'store',
  setCurrentView,
}) => {
  const { itemCount, setIsCartOpen } = useCart();
  const isStoreView = currentView === 'store' || currentView === 'storefront';
  const handleOpenTracker = onOpenTracker || onOpenTracking || (() => {});

  return (
    <header className="sticky top-0 z-40 bg-[#0a0a0a]/95 backdrop-blur-md border-b border-white/10 text-white shadow-xl">
      {/* Top micro announcement bar */}
      <div className="bg-[#050505] text-neutral-400 text-xs py-2 px-4 border-b border-white/5">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[9px] font-black bg-[#dc2626] text-white uppercase tracking-[0.2em] accent-glow">
              BIKIE PAPELERÍA
            </span>
            <span className="hidden sm:inline text-white/70 text-[11px] uppercase tracking-wider font-semibold">
              Suministros Escolares, Papelería Técnica & Oficina • Moneda Oficial: XAF / FCFA
            </span>
            <span className="sm:hidden text-white/70 text-[10px] uppercase tracking-wider font-semibold">
              OFICIAL XAF
            </span>
          </div>

          <div className="flex items-center gap-3 text-neutral-400 text-[11px]">
            <button
              onClick={handleOpenTracker}
              className="hover:text-white transition-colors flex items-center gap-1.5 font-bold uppercase tracking-widest text-[10px] cursor-pointer"
            >
              <Truck className="w-3.5 h-3.5 text-[#ef4444]" />
              <span className="hidden sm:inline">Rastrear Pedido</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Header Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5">
        <div className="flex items-center justify-between gap-4">
          {/* Logo BIKIE + Subtle Padlock */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setCurrentView?.('store')}
              className="flex items-center gap-3 text-left group cursor-pointer focus:outline-none"
            >
              <div className="w-10 h-10 rounded-xl bg-[#dc2626] text-white flex items-center justify-center font-black text-2xl tracking-tighter group-hover:scale-105 transition-transform duration-200 shadow-lg accent-glow font-display">
                B
              </div>
              <div>
                <div className="flex items-baseline">
                  <span className="font-black text-2xl tracking-tighter text-[#ef4444] font-display">B</span>
                  <span className="font-black text-2xl tracking-tighter text-white font-display">IKIE</span>
                </div>
                <p className="text-[9.5px] font-bold text-white/80 tracking-[0.2em] uppercase -mt-1 font-mono">
                  SISTEMAS INFORMÁTICOS
                </p>
              </div>
            </button>

            {/* Subtle small padlock next to logo for admin access */}
            <button
              onClick={onOpenAdmin}
              id="btn-secret-admin-lock"
              className="opacity-20 hover:opacity-80 p-1.5 text-white/50 hover:text-white rounded-md transition-all cursor-pointer hover:bg-white/5 focus:outline-none"
              title="Acceso restringido"
              aria-label="Acceso"
            >
              <Lock className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Search bar (Store mode) */}
          {isStoreView && (
            <div className="flex-1 max-w-md hidden md:block">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar cuadernos, bolígrafos, resmas, marcadores..."
                  className="w-full pl-9.5 pr-4 py-2 bg-[#121212] border border-white/15 rounded-lg text-xs text-white focus:outline-none focus:border-[#dc2626] transition-all placeholder:text-white/40 font-medium"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-white/40 hover:text-white"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Action buttons on client header */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Order Tracking Button in Header */}
            {isStoreView && (
              <button
                onClick={handleOpenTracker}
                id="btn-header-order-tracker"
                className="bg-[#171717] hover:bg-white/10 border border-white/15 text-white/90 hover:text-white px-3 sm:px-3.5 py-2 rounded-lg font-black text-xs uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer hover:scale-102 active:scale-98"
                title="Rastrear estado de mi pedido"
              >
                <Truck className="w-4 h-4 text-[#ef4444]" />
                <span className="hidden md:inline">Rastrear</span>
              </button>
            )}

            {/* AI Scanner Button in Header */}
            {isStoreView && onOpenAiScanner && (
              <button
                onClick={onOpenAiScanner}
                id="btn-header-ai-scanner"
                className="bg-gradient-to-r from-[#dc2626] to-[#b91c1c] hover:from-[#ef4444] hover:to-[#dc2626] text-white px-3 sm:px-3.5 py-2 rounded-lg font-black text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-lg accent-glow transition-all cursor-pointer hover:scale-102 active:scale-98"
                title="Escanear foto de lista de útiles con IA"
              >
                <Camera className="w-4 h-4" />
                <span className="hidden sm:inline">Escanear Lista IA</span>
                <Sparkles className="w-3 h-3 text-amber-300" />
              </button>
            )}

            {/* Cart Button */}
            {isStoreView && (
              <button
                onClick={() => setIsCartOpen(true)}
                id="btn-header-cart"
                className="relative bg-white hover:bg-neutral-200 text-black px-4 py-2 rounded-lg font-black text-xs uppercase tracking-[0.15em] flex items-center gap-2 shadow-lg hover:scale-102 active:scale-98 transition-all cursor-pointer"
              >
                <ShoppingBag className="w-4 h-4 text-[#dc2626]" />
                <span className="hidden sm:inline">Carrito</span>
                {itemCount > 0 && (
                  <span className="bg-[#dc2626] text-white font-black text-[10px] px-1.5 py-0.5 rounded-full min-w-[18px] text-center font-mono">
                    {itemCount}
                  </span>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Mobile search bar */}
        {isStoreView && (
          <div className="mt-3 md:hidden">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar productos en BIKIE..."
                className="w-full pl-9.5 pr-4 py-2 bg-[#121212] border border-white/15 rounded-lg text-xs text-white focus:outline-none focus:border-[#dc2626]"
              />
            </div>
          </div>
        )}
      </div>
    </header>
  );
};
