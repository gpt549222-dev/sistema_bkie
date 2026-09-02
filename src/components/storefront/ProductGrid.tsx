import React from 'react';
import { Product, Offer } from '../../types';
import { calculateProductPrice } from '../../services/pricingEngine';
import { useCart } from '../../context/CartContext';
import { formatCurrency } from '../../utils/currency';
import { Plus, Tag, Eye, CheckCircle2, AlertCircle, PackageX } from 'lucide-react';

interface ProductGridProps {
  products: Product[];
  offers: Offer[];
  onSelectProduct: (product: Product) => void;
  isLoading?: boolean;
}

export const ProductGrid: React.FC<ProductGridProps> = ({
  products,
  offers,
  onSelectProduct,
  isLoading = false,
}) => {
  const { addItem } = useCart();

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
        {[...Array(8)].map((_, i) => (
          <div
            key={i}
            className="bg-[#121212] rounded-xl p-4 border border-white/10 animate-pulse space-y-3"
          >
            <div className="w-full aspect-square bg-white/5 rounded-lg"></div>
            <div className="h-4 bg-white/10 rounded-md w-3/4"></div>
            <div className="h-3 bg-white/5 rounded-md w-1/2"></div>
            <div className="h-6 bg-white/10 rounded-md w-1/3 mt-2"></div>
          </div>
        ))}
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="text-center py-20 px-4 bg-[#0f0f0f] rounded-xl border border-white/10 shadow-2xl">
        <div className="w-16 h-16 rounded-xl bg-[#dc2626]/10 text-[#ef4444] flex items-center justify-center mx-auto mb-4 border border-[#dc2626]/20">
          <PackageX className="w-8 h-8" />
        </div>
        <h3 className="text-xl font-black uppercase tracking-tight text-white font-display">
          CATÁLOGO SIN COINCIDENCIAS
        </h3>
        <p className="text-xs text-white/50 max-w-md mx-auto mt-2 uppercase tracking-wider">
          No hay artículos registrados para el filtro o término de búsqueda seleccionado.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
      {products.map((product) => {
        const priceInfo = calculateProductPrice(product, offers, 1);
        const hasDiscount = priceInfo.discountAmount > 0;
        const isOutOfStock = product.stock <= 0;
        const isLowStock = product.stock > 0 && product.stock <= product.min_stock;

        return (
          <div
            key={product.id}
            className="group relative bg-[#0f0f0f] rounded-xl border border-white/10 p-3.5 sm:p-4 flex flex-col justify-between hover:border-[#dc2626]/60 hover:shadow-2xl transition-all duration-200 select-none"
          >
            {/* Discount Badge */}
            {hasDiscount && (
              <div className="absolute top-3 left-3 z-10 bg-[#dc2626] text-white text-[10px] font-black px-2 py-0.5 rounded shadow-md flex items-center gap-1 uppercase tracking-wider accent-glow">
                <Tag className="w-2.5 h-2.5" />
                <span>
                  {priceInfo.discountPercentage > 0
                    ? `-${priceInfo.discountPercentage}%`
                    : `-${formatCurrency(priceInfo.discountAmount)}`}
                </span>
              </div>
            )}

            {/* Product Image Container */}
            <div
              onClick={() => onSelectProduct(product)}
              className="relative w-full aspect-square rounded-lg bg-[#171717] border border-white/5 overflow-hidden mb-3 cursor-pointer"
            >
              {product.image_url ? (
                <img
                  src={product.image_url}
                  alt={product.name}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 opacity-90 group-hover:opacity-100"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-white/20 font-display font-black text-2xl tracking-tighter">
                  BIKIE.
                </div>
              )}

              {/* Quick preview overlay button */}
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectProduct(product);
                  }}
                  className="px-3 py-2 bg-white hover:bg-[#dc2626] text-black hover:text-white rounded-lg shadow-lg font-black text-[10px] uppercase tracking-widest flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <Eye className="w-3 h-3" />
                  <span className="hidden sm:inline">VER DETALLE</span>
                </button>
              </div>
            </div>

            {/* Product Metadata */}
            <div className="flex-1 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-1 text-[10px] font-bold text-white/40 mb-1 uppercase tracking-wider font-mono">
                  <span className="truncate">{product.category?.name || 'PAPELERÍA'}</span>
                  <span className="text-white/30 shrink-0">
                    {product.code}
                  </span>
                </div>

                <h4
                  onClick={() => onSelectProduct(product)}
                  className="font-bold text-white text-sm leading-snug line-clamp-2 hover:text-[#ef4444] transition-colors cursor-pointer"
                  title={product.name}
                >
                  {product.name}
                </h4>
              </div>

              {/* Stock and Pricing */}
              <div className="mt-3 pt-3 border-t border-white/10">
                {/* Stock Indicator */}
                <div className="mb-2">
                  {isOutOfStock ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-black text-[#ef4444] uppercase tracking-wider">
                      <AlertCircle className="w-3 h-3" />
                      <span>AGOTADO</span>
                    </span>
                  ) : isLowStock ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-black text-amber-400 uppercase tracking-wider">
                      <AlertCircle className="w-3 h-3" />
                      <span>¡ÚLTIMAS {product.stock} UNID.!</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>DISP: {product.stock}</span>
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between gap-2">
                  {/* Price info in XAF */}
                  <div>
                    {hasDiscount ? (
                      <div className="flex flex-col">
                        <span className="text-[11px] text-white/40 line-through font-mono">
                          {formatCurrency(priceInfo.originalPrice)}
                        </span>
                        <span className="text-base sm:text-lg font-black text-[#ef4444] font-mono tracking-tight">
                          {formatCurrency(priceInfo.finalPrice)}
                        </span>
                      </div>
                    ) : (
                      <span className="text-base sm:text-lg font-black text-white font-mono tracking-tight">
                        {formatCurrency(priceInfo.originalPrice)}
                      </span>
                    )}
                  </div>

                  {/* Add to Cart Button */}
                  <button
                    onClick={() => addItem(product, 1)}
                    disabled={isOutOfStock}
                    className={`p-2.5 rounded-lg font-black text-xs flex items-center justify-center transition-all cursor-pointer ${
                      isOutOfStock
                        ? 'bg-white/5 text-white/20 border border-white/5 cursor-not-allowed'
                        : 'bg-[#dc2626] hover:bg-[#ef4444] text-white accent-glow active:scale-95 shadow-md'
                    }`}
                    title={isOutOfStock ? 'Producto agotado' : 'Agregar al carrito'}
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

