import React from 'react';
import { Sparkles, Tag, ArrowRight, ShieldCheck, Truck, Camera, Zap } from 'lucide-react';
import { Offer } from '../../types';

interface HeroBannerProps {
  activeOffers: Offer[];
  onExploreOffers: () => void;
  onOpenAiScanner?: () => void;
}

export const HeroBanner: React.FC<HeroBannerProps> = ({
  activeOffers,
  onExploreOffers,
  onOpenAiScanner,
}) => {
  const topOffer = activeOffers[0];

  return (
    <div className="relative overflow-hidden bg-gradient-to-br from-[#111111] via-[#0d0d0d] to-[#150a0a] rounded-xl text-white shadow-2xl mb-10 border border-white/10 select-none">
      {/* Background glow and watermark */}
      <div className="absolute top-4 right-6 text-right pointer-events-none select-none">
        <div className="text-7xl sm:text-9xl font-black text-white/[0.03] tracking-tighter font-display">
          XAF
        </div>
      </div>
      <div className="absolute -bottom-10 -left-10 w-80 h-80 bg-[#dc2626]/15 rounded-full blur-3xl pointer-events-none"></div>

      <div className="relative max-w-7xl mx-auto px-6 py-10 sm:py-14 sm:px-10 lg:px-12 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-8">
        <div className="max-w-2xl">
          {/* Micro index label */}
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-px bg-white/20"></div>
            <span className="text-[10px] uppercase tracking-[0.4em] font-bold text-white/60">
              SUMINISTROS ESCOLARES & OFICINA • 2026
            </span>
            <div className="w-2.5 h-2.5 bg-[#dc2626] rounded-full accent-glow"></div>
          </div>

          {topOffer && (
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-[#dc2626]/20 border border-[#dc2626]/40 text-[#ef4444] text-[10px] font-black uppercase tracking-[0.2em] mb-4">
              <Tag className="w-3.5 h-3.5" />
              <span>OFERTA ACTIVA: {topOffer.name}</span>
            </div>
          )}

          {/* Huge Bold Typography Headline */}
          <div className="flex flex-col mb-4">
            <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black leading-[0.9] kern-tight uppercase mb-0 font-display">
              PAPELERÍA <span className="text-[#dc2626]">&</span>
            </h1>
            <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black leading-[0.9] kern-tight uppercase text-white font-display">
              SUMINISTROS
            </h1>
          </div>

          <p className="text-xs sm:text-sm text-neutral-300 leading-relaxed uppercase tracking-wider font-medium max-w-xl">
            Cuadernos, resmas, bolígrafos, útiles de dibujo y servicios de copias. ¡Saca una foto a tu lista de útiles y nuestra IA añade todo al carrito automáticamente!
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-4">
            {onOpenAiScanner && (
              <button
                onClick={onOpenAiScanner}
                id="btn-hero-ai-scanner"
                className="bg-gradient-to-r from-[#dc2626] to-[#b91c1c] hover:from-[#ef4444] hover:to-[#dc2626] text-white h-12 px-7 flex items-center gap-2.5 font-black text-xs uppercase tracking-[0.15em] rounded-lg cursor-pointer shadow-xl accent-glow hover:scale-102 active:scale-98 transition-all"
              >
                <Camera className="w-4 h-4 text-white" />
                <span>ESCANEAR LISTA CON IA</span>
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              </button>
            )}

            <button
              onClick={onExploreOffers}
              className="bg-white hover:bg-neutral-200 text-black h-12 px-7 flex items-center gap-2 font-black text-xs uppercase tracking-[0.15em] rounded-lg cursor-pointer hover:scale-102 active:scale-98 transition-all"
            >
              <span>EXPLORAR CATÁLOGO</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Feature badges architectural column */}
        <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-1 gap-3 w-full lg:w-72 shrink-0 border-t lg:border-t-0 lg:border-l border-white/10 pt-6 lg:pt-0 lg:pl-8">
          <div className="flex items-start gap-3 p-3.5 rounded-lg bg-white/5 border border-white/10">
            <div className="w-9 h-9 rounded-lg bg-[#dc2626]/20 text-[#ef4444] flex items-center justify-center shrink-0">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[11px] font-black uppercase tracking-wider text-white">IA Escáner de Listas</p>
              <p className="text-[10px] text-white/50 uppercase tracking-wide">Foto a carrito automático</p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3.5 rounded-lg bg-white/5 border border-white/10">
            <div className="w-9 h-9 rounded-lg bg-[#dc2626]/20 text-[#ef4444] flex items-center justify-center shrink-0">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[11px] font-black uppercase tracking-wider text-white">Precios en XAF</p>
              <p className="text-[10px] text-white/50 uppercase tracking-wide">Moneda oficial transparente</p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3.5 rounded-lg bg-white/5 border border-white/10">
            <div className="w-9 h-9 rounded-lg bg-[#dc2626]/20 text-[#ef4444] flex items-center justify-center shrink-0">
              <Truck className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[11px] font-black uppercase tracking-wider text-white">Despacho & Copias POS</p>
              <p className="text-[10px] text-white/50 uppercase tracking-wide">Servicios adicionales y pedidos</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

