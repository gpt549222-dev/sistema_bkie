import React, { useState } from 'react';
import { Product } from '../../types';
import { formatCurrency } from '../../utils/currency';
import { getBarcodeDataUrl } from '../../utils/barcode';
import {
  Printer,
  CheckSquare,
  Square,
  X,
  Tag,
  Boxes,
} from 'lucide-react';

interface BatchBarcodeModalProps {
  products: Product[];
  onClose: () => void;
}

export const BatchBarcodeModal: React.FC<BatchBarcodeModalProps> = ({ products, onClose }) => {
  // Map of productId -> number of labels to print
  const [selectedItems, setSelectedItems] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    products.forEach((p) => {
      // Por defecto 1 o según stock razonable
      initial[p.id] = Math.max(1, Math.min(p.stock || 1, 5));
    });
    return initial;
  });

  const [activeTab, setActiveTab] = useState<'all' | 'in_stock'>('all');
  const [showStoreName, setShowStoreName] = useState(true);
  const [showPrice, setShowPrice] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);

  const toggleProduct = (productId: string, defaultQty: number) => {
    setSelectedItems((prev) => {
      const next = { ...prev };
      if (next[productId]) {
        delete next[productId];
      } else {
        next[productId] = defaultQty || 1;
      }
      return next;
    });
  };

  const setQuantity = (productId: string, qty: number) => {
    setSelectedItems((prev) => ({
      ...prev,
      [productId]: Math.max(1, qty),
    }));
  };

  const selectAll = () => {
    const next: Record<string, number> = {};
    products.forEach((p) => {
      next[p.id] = Math.max(1, Math.min(p.stock || 1, 5));
    });
    setSelectedItems(next);
  };

  const deselectAll = () => {
    setSelectedItems({});
  };

  const selectByStock = () => {
    const next: Record<string, number> = {};
    products.forEach((p) => {
      if (p.stock > 0) {
        next[p.id] = Math.min(p.stock, 20);
      }
    });
    setSelectedItems(next);
  };

  const totalLabels = (Object.values(selectedItems) as number[]).reduce((sum: number, q: number) => sum + q, 0);
  const totalProductsSelected = Object.keys(selectedItems).length;

  const handlePrintBatch = () => {
    if (totalLabels === 0) {
      alert('Selecciona al menos un producto para imprimir');
      return;
    }

    setIsGenerating(true);

    try {
      const printWindow = window.open('', '_blank', 'width=900,height=750');
      if (!printWindow) {
        alert('Por favor habilita ventanas emergentes para generar las etiquetas de impresión.');
        setIsGenerating(false);
        return;
      }

      // Preparar tarjetas de etiquetas
      let labelsHtml = '';

      products.forEach((p) => {
        const qty = selectedItems[p.id] || 0;
        if (qty <= 0) return;

        const dataUrl = getBarcodeDataUrl(p.code, {
          width: 1.8,
          height: 38,
          displayValue: true,
        });

        for (let i = 0; i < qty; i++) {
          labelsHtml += `
            <div class="label-card">
              ${showStoreName ? '<div class="store-name">BIKIE PAPELERÍA</div>' : ''}
              <div class="product-name">${p.name}</div>
              <div class="barcode-wrapper">
                <img src="${dataUrl}" class="barcode-img" alt="${p.code}" />
              </div>
              <div class="footer-row">
                ${showPrice ? `<div class="product-price">${formatCurrency(p.price)}</div>` : ''}
                <div class="sku-text">${p.code}</div>
              </div>
            </div>
          `;
        }
      });

      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Lote de Etiquetas - BIKIE Papelería (${totalLabels} etiquetas)</title>
            <style>
              @page {
                margin: 5mm;
                size: A4 portrait;
              }
              * {
                box-sizing: border-box;
                margin: 0;
                padding: 0;
              }
              body {
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
                background: #ffffff;
                color: #000000;
                padding: 4mm;
              }
              .labels-grid {
                display: grid;
                grid-template-columns: repeat(4, 1fr);
                gap: 3mm;
              }
              .label-card {
                border: 0.5px dashed #888888;
                padding: 2.5mm 3mm;
                background: #ffffff;
                text-align: center;
                page-break-inside: avoid;
                display: flex;
                flex-direction: column;
                justify-content: space-between;
                align-items: center;
                height: 32mm;
              }
              .store-name {
                font-size: 6.5pt;
                font-weight: 800;
                letter-spacing: 0.5px;
                text-transform: uppercase;
                border-bottom: 0.5px solid #000000;
                padding-bottom: 1px;
                margin-bottom: 1px;
                width: 100%;
              }
              .product-name {
                font-size: 7pt;
                font-weight: 700;
                text-transform: uppercase;
                line-height: 1.1;
                max-height: 2.2em;
                overflow: hidden;
                width: 100%;
                margin: 1px 0;
              }
              .barcode-wrapper {
                display: flex;
                justify-content: center;
                align-items: center;
                width: 100%;
                margin: 1px 0;
              }
              .barcode-img {
                max-width: 95%;
                height: auto;
                image-rendering: pixelated;
                display: block;
              }
              .footer-row {
                display: flex;
                justify-content: space-between;
                align-items: center;
                width: 100%;
                margin-top: 1px;
              }
              .product-price {
                font-size: 8.5pt;
                font-weight: 900;
              }
              .sku-text {
                font-size: 6.5pt;
                font-family: monospace;
              }

              @media print {
                body {
                  padding: 0;
                }
                .label-card {
                  border: 0.5px solid #bbbbbb;
                }
              }
            </style>
          </head>
          <body>
            <div class="labels-grid">
              ${labelsHtml}
            </div>
            <script>
              window.onload = function() {
                setTimeout(function() {
                  window.print();
                }, 400);
              };
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
    } finally {
      setIsGenerating(false);
    }
  };

  const displayedProducts =
    activeTab === 'in_stock' ? products.filter((p) => p.stock > 0) : products;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-xs overflow-y-auto font-mono text-white">
      <div className="bg-[#0d0d0d] rounded-2xl max-w-4xl w-full p-6 sm:p-7 shadow-2xl border border-white/10 relative my-6 text-xs flex flex-col max-h-[90vh]">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-white/40 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-4 border-b border-white/10 pb-4">
          <div className="p-2.5 bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-xl">
            <Tag className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-black font-display uppercase tracking-tight text-white">
              IMPRESIÓN MASIVA DE CÓDIGOS DE BARRAS EN LOTE
            </h3>
            <p className="text-[10px] text-white/50 uppercase tracking-widest mt-0.5">
              SELECCIONA PRODUCTOS Y CANTIDADES PARA IMPRIMIR EN HOJA A4 O ROLLO DE ETIQUETAS
            </p>
          </div>
        </div>

        {/* Quick actions bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-[#141414] p-3 rounded-xl border border-white/10 mb-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={selectAll}
              className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-[10px] font-bold uppercase tracking-wider text-white flex items-center gap-1.5 cursor-pointer"
            >
              <CheckSquare className="w-3.5 h-3.5 text-rose-400" />
              <span>Seleccionar Todos ({products.length})</span>
            </button>
            <button
              type="button"
              onClick={selectByStock}
              className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-[10px] font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1.5 cursor-pointer"
            >
              <Boxes className="w-3.5 h-3.5 text-amber-400" />
              <span>Solo con Stock</span>
            </button>
            <button
              type="button"
              onClick={deselectAll}
              className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-[10px] font-bold uppercase tracking-wider text-white/60 hover:text-white flex items-center gap-1.5 cursor-pointer"
            >
              <Square className="w-3.5 h-3.5" />
              <span>Deseleccionar</span>
            </button>
          </div>

          <div className="flex items-center gap-4 text-xs font-bold">
            <div className="flex items-center gap-1.5 text-white/70">
              <span className="text-[10px] text-white/40 uppercase">Artículos:</span>
              <span className="text-rose-400 font-mono">{totalProductsSelected}</span>
            </div>
            <div className="flex items-center gap-1.5 text-white/70">
              <span className="text-[10px] text-white/40 uppercase">Total Etiquetas:</span>
              <span className="text-emerald-400 font-mono text-sm">{totalLabels}</span>
            </div>
          </div>
        </div>

        {/* Product list table */}
        <div className="overflow-y-auto flex-1 border border-white/10 rounded-xl divide-y divide-white/5 pr-1">
          {displayedProducts.map((p) => {
            const isSelected = selectedItems[p.id] !== undefined;
            const currentQty = selectedItems[p.id] || 0;

            return (
              <div
                key={p.id}
                className={`p-3 flex items-center justify-between gap-3 transition-colors ${
                  isSelected ? 'bg-white/5' : 'opacity-60 hover:opacity-100'
                }`}
              >
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => toggleProduct(p.id, Math.max(1, Math.min(p.stock || 1, 5)))}
                    className="cursor-pointer text-rose-400"
                  >
                    {isSelected ? (
                      <CheckSquare className="w-5 h-5 text-rose-500" />
                    ) : (
                      <Square className="w-5 h-5 text-white/30" />
                    )}
                  </button>

                  <div>
                    <div className="font-bold text-white uppercase text-xs">{p.name}</div>
                    <div className="flex items-center gap-3 text-[10px] text-white/40 font-mono mt-0.5">
                      <span className="text-rose-400 font-bold">SKU: {p.code}</span>
                      <span>•</span>
                      <span>Stock: {p.stock} un.</span>
                      <span>•</span>
                      <span className="text-white/70">{formatCurrency(p.price)}</span>
                    </div>
                  </div>
                </div>

                {isSelected && (
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-white/50 uppercase">Copias:</span>
                    <input
                      type="number"
                      min="1"
                      max="200"
                      value={currentQty}
                      onChange={(e) => setQuantity(p.id, parseInt(e.target.value) || 1)}
                      className="w-16 p-1 bg-[#141414] border border-white/20 rounded-lg text-center font-mono font-bold text-white text-xs focus:border-rose-500 focus:outline-hidden"
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Options & footer buttons */}
        <div className="mt-4 pt-4 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4 text-[11px] text-white/70">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showStoreName}
                onChange={(e) => setShowStoreName(e.target.checked)}
                className="accent-rose-500 rounded"
              />
              <span>Nombre de papelería</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showPrice}
                onChange={(e) => setShowPrice(e.target.checked)}
                className="accent-rose-500 rounded"
              />
              <span>Precio de venta</span>
            </label>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-none px-4 py-2.5 bg-[#141414] hover:bg-white/10 border border-white/10 text-white rounded-xl font-bold uppercase tracking-wider text-xs cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handlePrintBatch}
              disabled={totalLabels === 0 || isGenerating}
              className="flex-1 sm:flex-none px-6 py-2.5 bg-rose-600 hover:bg-rose-500 active:bg-rose-700 disabled:opacity-50 text-white rounded-xl font-black uppercase tracking-wider text-xs flex items-center justify-center gap-2 shadow-lg shadow-rose-950/50 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>IMPRIMIR ({totalLabels} ETIQUETAS)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
