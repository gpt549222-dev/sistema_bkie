import React from 'react';
import { useCart } from '../../context/CartContext';
import { formatCurrency } from '../../utils/currency';
import {
  X,
  Trash2,
  Plus,
  Minus,
  ShoppingBag,
  ArrowRight,
  Tag,
  ShieldCheck,
} from 'lucide-react';

interface CartDrawerProps {
  onProceedToCheckout: () => void;
}

export const CartDrawer: React.FC<CartDrawerProps> = ({ onProceedToCheckout }) => {
  const {
    items,
    isCartOpen,
    setIsCartOpen,
    updateQuantity,
    removeItem,
    clearCart,
    subtotal,
    discount,
    total,
  } = useCart();

  if (!isCartOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        onClick={() => setIsCartOpen(false)}
        className="absolute inset-0 bg-black/80 backdrop-blur-xs transition-opacity"
      />

      <div className="absolute inset-y-0 right-0 max-w-full flex pl-6 sm:pl-10">
        <div className="w-screen max-w-md bg-[#0d0d0d] border-l border-white/10 text-white shadow-2xl flex flex-col justify-between">
          {/* Top header */}
          <div className="p-5 sm:p-6 border-b border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-[#dc2626] text-white flex items-center justify-center font-black accent-glow shadow-md">
                <ShoppingBag className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-black text-white font-display text-base uppercase tracking-tight">
                  BOLSA DE COMPRAS
                </h3>
                <p className="text-[10px] text-white/40 uppercase tracking-widest font-mono">
                  {items.length} {items.length === 1 ? 'ARTÍCULO' : 'ARTÍCULOS'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {items.length > 0 && (
                <button
                  onClick={clearCart}
                  className="text-xs text-white/40 hover:text-[#ef4444] transition-colors p-2 rounded-lg hover:bg-white/5 border border-transparent hover:border-white/10 cursor-pointer"
                  title="Vaciar carrito"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={() => setIsCartOpen(false)}
                className="p-2 text-white/40 hover:text-white hover:bg-white/5 border border-transparent hover:border-white/10 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Cart items list */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3">
            {items.length === 0 ? (
              <div className="text-center py-20">
                <div className="w-16 h-16 rounded-xl bg-white/5 text-white/30 flex items-center justify-center mx-auto mb-3 border border-white/10">
                  <ShoppingBag className="w-8 h-8" />
                </div>
                <h4 className="font-black text-white text-base uppercase tracking-tight font-display">
                  BOLSA VACÍA
                </h4>
                <p className="text-xs text-white/40 max-w-xs mx-auto mt-2 uppercase tracking-wider">
                  Explora el catálogo de útiles, suministros y cuadernos para iniciar tu pedido.
                </p>
              </div>
            ) : (
              items.map(({ product, quantity, calculation }) => {
                const itemHasDiscount = calculation.discountAmount > 0;
                return (
                  <div
                    key={product.id}
                    className="flex gap-3.5 p-3 rounded-xl bg-[#141414] border border-white/10 items-center justify-between shadow-sm"
                  >
                    {/* Item thumbnail */}
                    <div className="w-16 h-16 rounded-lg bg-[#1a1a1a] border border-white/10 overflow-hidden shrink-0">
                      {product.image_url ? (
                        <img
                          src={product.image_url}
                          alt={product.name}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[10px] font-black text-white/30 font-display">
                          BIKIE
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <h5 className="font-bold text-xs text-white truncate uppercase tracking-tight" title={product.name}>
                        {product.name}
                      </h5>
                      <div className="flex items-center gap-1.5 mt-0.5 font-mono">
                        <span className="font-black text-sm text-white">
                          {formatCurrency(calculation.finalPrice)}
                        </span>
                        {itemHasDiscount && (
                          <span className="text-[11px] text-white/40 line-through">
                            {formatCurrency(calculation.originalPrice)}
                          </span>
                        )}
                        {itemHasDiscount && (
                          <span className="text-[9px] bg-[#dc2626] text-white font-black px-1 rounded uppercase">
                            -{calculation.discountPercentage}%
                          </span>
                        )}
                      </div>

                      {/* Quantity buttons */}
                      <div className="flex items-center gap-2 mt-2">
                        <div className="flex items-center border border-white/20 rounded-lg bg-[#1a1a1a]">
                          <button
                            onClick={() => updateQuantity(product.id, quantity - 1)}
                            className="p-1 text-white/70 hover:text-[#ef4444] transition-colors cursor-pointer"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="px-2 text-xs font-mono font-black text-white">
                            {quantity}
                          </span>
                          <button
                            onClick={() => updateQuantity(product.id, quantity + 1)}
                            disabled={quantity >= product.stock}
                            className="p-1 text-white/70 hover:text-[#ef4444] transition-colors disabled:opacity-20 cursor-pointer"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>

                        <span className="text-[10px] text-white/50 font-mono">
                          = {formatCurrency(calculation.finalPrice * quantity)}
                        </span>
                      </div>
                    </div>

                    {/* Delete button */}
                    <button
                      onClick={() => removeItem(product.id)}
                      className="p-2 text-white/30 hover:text-[#ef4444] hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
                      title="Eliminar artículo"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer & Checkout button */}
          {items.length > 0 && (
            <div className="p-5 sm:p-6 border-t border-white/10 bg-[#0a0a0a] space-y-3">
              <div className="space-y-1.5 text-xs font-mono">
                <div className="flex justify-between text-white/60">
                  <span className="uppercase tracking-wider">Subtotal:</span>
                  <span className="font-bold">{formatCurrency(subtotal)}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-[#ef4444] font-bold">
                    <span className="flex items-center gap-1 uppercase tracking-wider">
                      <Tag className="w-3 h-3" />
                      Descuento:
                    </span>
                    <span>-{formatCurrency(discount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-black text-white pt-2 border-t border-white/10">
                  <span className="uppercase tracking-widest font-display">TOTAL A PAGAR:</span>
                  <span className="text-lg text-[#ef4444] font-display font-black">
                    {formatCurrency(total)}
                  </span>
                </div>
              </div>

              <button
                onClick={() => {
                  setIsCartOpen(false);
                  onProceedToCheckout();
                }}
                className="w-full py-3.5 bg-[#dc2626] hover:bg-[#ef4444] text-white font-black text-xs uppercase tracking-[0.2em] rounded-xl flex items-center justify-center gap-2 accent-glow active:scale-98 transition-all cursor-pointer shadow-lg"
              >
                <span>PROCEDER AL CHECKOUT</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <p className="text-[10px] uppercase tracking-wider text-center text-white/40 flex items-center justify-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                Despacho verificado con inventario Supabase
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
