import React, { useState, useEffect, useRef } from 'react';
import { Product } from '../../types';
import { formatCurrency } from '../../utils/currency';
import { renderBarcodeSvg, getBarcodeDataUrl } from '../../utils/barcode';
import {
  Printer,
  Download,
  Copy,
  Check,
  X,
  Layers,
  Settings,
  Tag,
  Eye,
} from 'lucide-react';

interface BarcodePrintModalProps {
  product: Product;
  onClose: () => void;
}

export type LabelSize = 'standard' | 'compact' | 'shelf' | 'a4_grid';

export const BarcodePrintModal: React.FC<BarcodePrintModalProps> = ({ product, onClose }) => {
  const [copies, setCopies] = useState<number>(Math.max(1, Math.min(product.stock || 1, 10)));
  const [labelSize, setLabelSize] = useState<LabelSize>('standard');
  const [showStoreName, setShowStoreName] = useState(true);
  const [showProductName, setShowProductName] = useState(true);
  const [showPrice, setShowPrice] = useState(true);
  const [showCodeText, setShowCodeText] = useState(true);
  const [copied, setCopied] = useState(false);

  const barcodeSvgRef = useRef<SVGSVGElement | null>(null);

  const barcodeValue = (product.code || '').trim();

  // Renderizar código de barras en el SVG de vista previa
  useEffect(() => {
    if (barcodeSvgRef.current && barcodeValue) {
      renderBarcodeSvg(barcodeSvgRef.current, barcodeValue, {
        width: labelSize === 'compact' ? 1.5 : 2,
        height: labelSize === 'compact' ? 35 : labelSize === 'shelf' ? 55 : 45,
        displayValue: showCodeText,
        fontSize: labelSize === 'compact' ? 10 : 12,
        margin: 4,
      });
    }
  }, [barcodeValue, labelSize, showCodeText]);

  // Manejar copia del código
  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(barcodeValue);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  // Descargar imagen PNG del código de barras
  const handleDownloadPng = () => {
    const dataUrl = getBarcodeDataUrl(barcodeValue, {
      width: 2.5,
      height: 70,
      displayValue: showCodeText,
    });
    if (!dataUrl) return;

    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `codigo-barra-${product.code || 'producto'}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Generar ventana de impresión aislada con CSS @media print
  const handlePrint = () => {
    const printWindow = window.open('', '_blank', 'width=850,height=700');
    if (!printWindow) {
      alert('Por favor permite ventanas emergentes (popups) en tu navegador para imprimir las etiquetas.');
      return;
    }

    const dataUrl = getBarcodeDataUrl(barcodeValue, {
      width: labelSize === 'compact' ? 1.4 : labelSize === 'shelf' ? 2.4 : 2,
      height: labelSize === 'compact' ? 35 : labelSize === 'shelf' ? 55 : 42,
      displayValue: showCodeText,
    });

    const labelsHtml = Array.from({ length: copies })
      .map(
        (_, idx) => `
        <div class="label-card label-${labelSize}">
          ${showStoreName ? '<div class="store-name">BIKIE PAPELERÍA</div>' : ''}
          ${showProductName ? `<div class="product-name">${product.name}</div>` : ''}
          <div class="barcode-wrapper">
            <img src="${dataUrl}" class="barcode-img" alt="${barcodeValue}" />
          </div>
          <div class="footer-row">
            ${showPrice ? `<div class="product-price">${formatCurrency(product.price)}</div>` : ''}
            <div class="sku-text">${product.code}</div>
          </div>
        </div>
      `
      )
      .join('');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Imprimir Etiquetas - ${product.name} (${product.code})</title>
          <style>
            @page {
              margin: 6mm;
              size: auto;
            }
            * {
              box-sizing: border-box;
              margin: 0;
              padding: 0;
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
              background: #ffffff;
              color: #000000;
              padding: 8px;
            }
            .labels-container {
              display: flex;
              flex-wrap: wrap;
              gap: 5mm;
              align-items: flex-start;
              justify-content: flex-start;
            }
            .label-card {
              border: 1px dashed #777777;
              padding: 4mm 5mm;
              background: #ffffff;
              text-align: center;
              page-break-inside: avoid;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: space-between;
            }
            /* Tamaños específicos */
            .label-standard {
              width: 54mm;
              height: 34mm;
            }
            .label-compact {
              width: 40mm;
              height: 24mm;
              padding: 2mm 3mm;
            }
            .label-shelf {
              width: 72mm;
              height: 42mm;
              padding: 5mm 6mm;
            }
            .label-a4_grid {
              width: 60mm;
              height: 36mm;
            }

            .store-name {
              font-size: 8pt;
              font-weight: 800;
              letter-spacing: 0.5px;
              text-transform: uppercase;
              color: #000000;
              border-bottom: 0.5px solid #000000;
              padding-bottom: 1px;
              margin-bottom: 2px;
              width: 100%;
            }
            .product-name {
              font-size: 8.5pt;
              font-weight: 700;
              text-transform: uppercase;
              line-height: 1.15;
              max-height: 2.3em;
              overflow: hidden;
              margin: 1px 0;
              width: 100%;
            }
            .label-compact .product-name {
              font-size: 7pt;
            }
            .label-shelf .product-name {
              font-size: 10.5pt;
            }
            .barcode-wrapper {
              display: flex;
              justify-content: center;
              align-items: center;
              margin: 1px 0;
              width: 100%;
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
              font-size: 10pt;
              font-weight: 900;
              color: #000000;
            }
            .label-shelf .product-price {
              font-size: 13pt;
            }
            .label-compact .product-price {
              font-size: 8pt;
            }
            .sku-text {
              font-size: 7pt;
              font-family: monospace;
              color: #333333;
            }

            @media print {
              body {
                padding: 0;
              }
              .label-card {
                border: 0.5px solid #cccccc;
              }
              .no-print {
                display: none !important;
              }
            }
          </style>
        </head>
        <body>
          <div class="labels-container">
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
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-xs overflow-y-auto font-mono text-white">
      <div className="bg-[#0d0d0d] rounded-2xl max-w-3xl w-full p-6 sm:p-7 shadow-2xl border border-white/10 relative my-6 text-xs">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-white/40 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-5 border-b border-white/10 pb-4">
          <div className="p-2.5 bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-xl">
            <Tag className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-black font-display uppercase tracking-tight text-white">
              IMPRESIÓN DE CÓDIGO DE BARRAS & ETIQUETAS
            </h3>
            <p className="text-[10px] text-white/50 uppercase tracking-widest mt-0.5">
              ETIQUETAS ADHESIVAS PARA ESCANEO RÁPIDO EN EL PUNTO DE VENTA (POS)
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          {/* Controls Panel (Left side) */}
          <div className="md:col-span-6 space-y-4">
            {/* Product summary card */}
            <div className="p-3 bg-[#141414] rounded-xl border border-white/10">
              <div className="text-[10px] text-white/40 uppercase tracking-wider mb-0.5">PRODUCTO SELECCIONADO</div>
              <div className="font-bold text-sm text-white uppercase line-clamp-1">{product.name}</div>
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/5">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-white/40">CÓDIGO:</span>
                  <span className="font-mono font-bold text-rose-400">{product.code}</span>
                  <button
                    onClick={handleCopyCode}
                    className="p-1 text-white/50 hover:text-white hover:bg-white/10 rounded transition cursor-pointer"
                    title="Copiar código"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <div className="font-mono font-bold text-emerald-400">{formatCurrency(product.price)}</div>
              </div>
            </div>

            {/* Copies selector */}
            <div>
              <label className="block font-bold text-white/70 uppercase tracking-wider mb-1.5 text-[11px]">
                CANTIDAD DE ETIQUETAS A IMPRIMIR
              </label>
              <div className="grid grid-cols-5 gap-1.5 mb-2">
                {[1, 5, 10, 20].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setCopies(num)}
                    className={`py-1.5 rounded-lg font-mono font-bold text-xs transition cursor-pointer ${
                      copies === num
                        ? 'bg-rose-600 text-white shadow-md'
                        : 'bg-[#141414] text-white/60 hover:text-white border border-white/10 hover:bg-white/5'
                    }`}
                  >
                    {num}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setCopies(Math.max(1, product.stock))}
                  className={`py-1.5 rounded-lg font-mono text-[10px] font-bold transition cursor-pointer ${
                    copies === product.stock
                      ? 'bg-rose-600 text-white shadow-md'
                      : 'bg-[#141414] text-amber-300 hover:text-white border border-amber-500/20 hover:bg-white/5'
                  }`}
                  title={`Stock actual: ${product.stock}`}
                >
                  STOCK ({product.stock})
                </button>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-white/40 uppercase">Personalizado:</span>
                <input
                  type="number"
                  min="1"
                  max="500"
                  value={copies}
                  onChange={(e) => setCopies(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-24 p-1.5 bg-[#141414] border border-white/10 rounded-lg text-white font-mono text-xs focus:border-rose-500 focus:outline-hidden text-center"
                />
                <span className="text-[10px] text-white/40">etiquetas en total</span>
              </div>
            </div>

            {/* Label size selector */}
            <div>
              <label className="block font-bold text-white/70 uppercase tracking-wider mb-1.5 text-[11px]">
                FORMATO / TAMAÑO DE ETIQUETA
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'standard', name: 'Estándar', desc: '54 × 34 mm (Adhesiva)' },
                  { id: 'compact', name: 'Compacta', desc: '40 × 24 mm (Bolígrafos)' },
                  { id: 'shelf', name: 'Góndola', desc: '72 × 42 mm (Estante)' },
                  { id: 'a4_grid', name: 'Hoja A4', desc: 'Cuadrícula papel normal' },
                ].map((format) => (
                  <button
                    key={format.id}
                    type="button"
                    onClick={() => setLabelSize(format.id as LabelSize)}
                    className={`p-2 rounded-xl text-left border transition cursor-pointer ${
                      labelSize === format.id
                        ? 'bg-rose-500/10 border-rose-500 text-white'
                        : 'bg-[#141414] border-white/10 text-white/60 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <div className="font-bold text-xs uppercase">{format.name}</div>
                    <div className="text-[9px] text-white/40 mt-0.5">{format.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Content options */}
            <div className="pt-2 border-t border-white/10 space-y-1.5">
              <div className="text-[10px] font-bold text-white/50 uppercase tracking-wider mb-1">
                CAMPOS INCLUIDOS EN LA ETIQUETA:
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="flex items-center gap-2 text-[11px] text-white/70 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showStoreName}
                    onChange={(e) => setShowStoreName(e.target.checked)}
                    className="accent-rose-500 rounded"
                  />
                  <span>Nombre tienda</span>
                </label>
                <label className="flex items-center gap-2 text-[11px] text-white/70 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showProductName}
                    onChange={(e) => setShowProductName(e.target.checked)}
                    className="accent-rose-500 rounded"
                  />
                  <span>Nombre producto</span>
                </label>
                <label className="flex items-center gap-2 text-[11px] text-white/70 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showPrice}
                    onChange={(e) => setShowPrice(e.target.checked)}
                    className="accent-rose-500 rounded"
                  />
                  <span>Precio de venta</span>
                </label>
                <label className="flex items-center gap-2 text-[11px] text-white/70 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showCodeText}
                    onChange={(e) => setShowCodeText(e.target.checked)}
                    className="accent-rose-500 rounded"
                  />
                  <span>Código de texto</span>
                </label>
              </div>
            </div>
          </div>

          {/* Label Preview (Right side) */}
          <div className="md:col-span-6 flex flex-col justify-between space-y-4">
            <div>
              <div className="flex items-center justify-between text-[11px] font-bold text-white/70 uppercase tracking-wider mb-2">
                <span className="flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5 text-rose-400" />
                  <span>VISTA PREVIA REAL DE ETIQUETA</span>
                </span>
                <span className="text-[10px] text-white/40">Fondo blanco para impresión</span>
              </div>

              {/* Physical printed label mockup */}
              <div className="bg-neutral-800 p-4 rounded-2xl border border-white/10 flex items-center justify-center min-h-[220px]">
                <div
                  className={`bg-white text-black p-3.5 rounded-md shadow-xl border border-neutral-300 flex flex-col items-center justify-between transition-all ${
                    labelSize === 'compact'
                      ? 'w-[200px] min-h-[120px]'
                      : labelSize === 'shelf'
                      ? 'w-[290px] min-h-[175px]'
                      : 'w-[250px] min-h-[155px]'
                  }`}
                >
                  {showStoreName && (
                    <div className="text-[9px] font-black tracking-wider uppercase border-b border-black/20 pb-0.5 w-full text-center text-neutral-800">
                      BIKIE PAPELERÍA
                    </div>
                  )}

                  {showProductName && (
                    <div
                      className={`font-bold uppercase text-center line-clamp-2 w-full text-black my-1 ${
                        labelSize === 'compact' ? 'text-[9px]' : labelSize === 'shelf' ? 'text-xs' : 'text-[11px]'
                      }`}
                    >
                      {product.name}
                    </div>
                  )}

                  {/* SVG Barcode output */}
                  <div className="w-full flex justify-center py-1">
                    <svg ref={barcodeSvgRef} className="max-w-full h-auto"></svg>
                  </div>

                  <div className="w-full flex items-center justify-between pt-1 border-t border-black/10 mt-1">
                    {showPrice ? (
                      <div
                        className={`font-black font-mono text-black ${
                          labelSize === 'compact' ? 'text-xs' : labelSize === 'shelf' ? 'text-base' : 'text-sm'
                        }`}
                      >
                        {formatCurrency(product.price)}
                      </div>
                    ) : (
                      <div></div>
                    )}
                    <div className="text-[9px] font-mono text-neutral-600 font-bold">{product.code}</div>
                  </div>
                </div>
              </div>

              <div className="text-[10px] text-center text-white/40 mt-2">
                Escaneable directamente en el POS y con el escáner móvil de cámara
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2 pt-2 border-t border-white/10">
              <button
                onClick={handlePrint}
                className="w-full py-3 bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white font-black text-xs uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-rose-950/40 transition cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>IMPRIMIR {copies} {copies === 1 ? 'ETIQUETA' : 'ETIQUETAS'}</span>
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleDownloadPng}
                  className="py-2.5 bg-[#141414] hover:bg-white/10 border border-white/10 text-white rounded-xl font-bold uppercase tracking-wider text-[11px] flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-rose-400" />
                  <span>DESCARGAR PNG</span>
                </button>
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="py-2.5 bg-[#141414] hover:bg-white/10 border border-white/10 text-white rounded-xl font-bold uppercase tracking-wider text-[11px] flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400">¡COPIADO!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-white/60" />
                      <span>COPIAR CÓDIGO</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
