import React, { useState } from 'react';
import { Product, Offer } from '../../types';
import { calculateProductPrice } from '../../services/pricingEngine';
import { useCart } from '../../context/CartContext';
import { formatCurrency } from '../../utils/currency';
import { X, Plus, Minus, ShoppingBag, Tag, CheckCircle2, AlertCircle, ShieldCheck } from 'lucide-react';

interface ProductDetailModalProps {
  product: Product | null;
  offers: Offer[];
  onClose: () => void;
}

export const ProductDetailModal: React.FC<ProductDetailModalProps> = ({
  product,
  offers,
  onClose,
}) => {
  const [quantity, setQuantity] = useState(1);
  const { addItem } = useCart();

  if (!product) return null;

  const priceInfo = calculateProductPrice(product, offers, quantity);
  const hasDiscount = priceInfo.discountAmount > 0;
  const isOutOfStock = product.stock <= 0;
  const isLowStock = product.stock > 0 && product.stock <= product.min_stock;

  const handleAddToCart = () => {
    addItem(product, quantity);
    onClose();
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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-8 items-start">
          {/* Image box */}
          <div className="relative aspect-square rounded-lg bg-[#171717] overflow-hidden border border-white/10">
            {product.image_url ? (
              <img
                src={product.image_url}
                alt={product.name}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-white/20 font-display font-black text-3xl tracking-tighter">
                BIKIE.
              </div>
            )}
            {hasDiscount && (
              <div className="absolute top-3 left-3 bg-[#dc2626] text-white text-[10px] font-black px-2.5 py-1 rounded shadow-md flex items-center gap-1 uppercase tracking-wider accent-glow">
                <Tag className="w-3.5 h-3.5" />
                <span>
                  {priceInfo.discountPercentage > 0
                    ? `-${priceInfo.discountPercentage}% OFF`
                    : `-${formatCurrency(priceInfo.discountAmount)}`}
                </span>
              </div>
            )}
          </div>

          {/* Details column */}
          <div className="flex flex-col justify-between h-full">
            <div>
              <div className="flex items-center gap-2 text-[10px] font-bold text-white/40 uppercase tracking-widest mb-2 font-mono">
                <span>{product.category?.name || 'PAPELERÍA'}</span>
                <span>•</span>
                <span className="text-white/30">SKU: {product.code}</span>
              </div>

              <h2 className="text-xl sm:text-2xl font-black text-white leading-tight font-display uppercase tracking-tight mb-3">
                {product.name}
              </h2>

              <p className="text-xs text-white/60 leading-relaxed uppercase tracking-wider mb-4">
                {product.description || 'Artículo de papelería original BIKIE.'}
              </p>

              {/* Stock status */}
              <div className="p-3 rounded-lg bg-[#141414] border border-white/10 mb-4 flex items-center justify-between font-mono">
                <span className="text-[11px] text-white/50 uppercase tracking-wider">Disponibilidad Almacén:</span>
                {isOutOfStock ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-black text-[#ef4444] uppercase tracking-wider">
                    <AlertCircle className="w-3.5 h-3.5" />
                    AGOTADO
                  </span>
                ) : isLowStock ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-black text-amber-400 uppercase tracking-wider">
                    <AlertCircle className="w-3.5 h-3.5" />
                    ÚLTIMAS {product.stock} UNID.
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400 uppercase tracking-wider">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {product.stock} DISPONIBLES
                  </span>
                )}
              </div>

              {/* Price display in XAF */}
              <div className="mb-6">
                <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest mb-1 font-mono">
                  PRECIO UNITARIO:
                </p>
                <div className="flex items-baseline gap-3">
                  <span className="text-2xl sm:text-3xl font-black text-white font-mono tracking-tight">
                    {formatCurrency(priceInfo.finalPrice)}
                  </span>
                  {hasDiscount && (
                    <span className="text-base text-white/40 line-through font-mono">
                      {formatCurrency(priceInfo.originalPrice)}
                    </span>
                  )}
                </div>
                {hasDiscount && priceInfo.appliedOffer && (
                  <p className="text-xs text-[#ef4444] font-black uppercase tracking-wider mt-1">
                    ★ Promoción aplicada: {priceInfo.appliedOffer.name}
                  </p>
                )}
              </div>
            </div>

            {/* Quantity and Add CTA */}
            <div>
              <div className="flex items-center gap-4 mb-4">
                <span className="text-[10px] font-bold uppercase tracking-wider text-white/50 font-mono">Cantidad:</span>
                <div className="flex items-center border border-white/20 rounded-lg bg-[#1a1a1a] p-0.5">
                  <button
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    disabled={quantity <= 1 || isOutOfStock}
                    className="p-1.5 rounded text-white/70 hover:bg-white/10 hover:text-white transition-colors disabled:opacity-20 cursor-pointer"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="w-10 text-center font-black font-mono text-sm text-white">
                    {quantity}
                  </span>
                  <button
                    onClick={() => setQuantity((q) => Math.min(product.stock, q + 1))}
                    disabled={quantity >= product.stock || isOutOfStock}
                    className="p-1.5 rounded text-white/70 hover:bg-white/10 hover:text-white transition-colors disabled:opacity-20 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
                <span className="text-xs text-white/50 font-mono">
                  Subtotal: <strong className="text-[#ef4444]">{formatCurrency(priceInfo.finalPrice * quantity)}</strong>
                </span>
              </div>

              <button
                onClick={handleAddToCart}
                disabled={isOutOfStock}
                className="w-full py-3.5 bg-[#dc2626] hover:bg-[#ef4444] disabled:bg-white/5 disabled:text-white/20 text-white font-black uppercase tracking-[0.2em] rounded-xl text-xs flex items-center justify-center gap-2 accent-glow active:scale-98 transition-all cursor-pointer shadow-lg"
              >
                <ShoppingBag className="w-4 h-4" />
                <span>{isOutOfStock ? 'PRODUCTO AGOTADO' : 'AGREGAR AL CARRITO'}</span>
              </button>

              <p className="text-[10px] text-white/40 text-center mt-3 uppercase tracking-wider flex items-center justify-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                Sincronización de inventario Supabase garantizada
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
