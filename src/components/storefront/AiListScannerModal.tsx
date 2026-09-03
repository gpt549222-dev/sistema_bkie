import React, { useState, useRef } from 'react';
import {
  Camera,
  Upload,
  Sparkles,
  X,
  Check,
  ShoppingCart,
  AlertCircle,
  FileText,
  RefreshCw,
  Plus,
  Minus,
  Trash2,
  CheckCircle2,
  ListCheck,
  Zap,
} from 'lucide-react';
import { Product, AiScannedItem } from '../../types';
import { useCart } from '../../context/CartContext';
import {
  scanListWithAi,
  matchItemsToCatalog,
} from '../../services/aiListScanner';
import { formatCurrency } from '../../utils/currency';
import confetti from 'canvas-confetti';

interface AiListScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
}

export const AiListScannerModal: React.FC<AiListScannerModalProps> = ({
  isOpen,
  onClose,
  products,
}) => {
  const { addItem, setIsCartOpen } = useCart();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [textInput, setTextInput] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [scanStep, setScanStep] = useState<'upload' | 'results'>('upload');
  const [matchedItems, setMatchedItems] = useState<AiScannedItem[]>([]);
  const [unmatchedCount, setUnmatchedCount] = useState(0);
  const [scanSuccessMessage, setScanSuccessMessage] = useState<string | null>(null);
  const [scanErrorMessage, setScanErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleImageSelected = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setScanErrorMessage('Por favor selecciona un archivo de imagen válido (JPG, PNG, WebP).');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      setPreviewImage(result);
      setScanErrorMessage(null);
    };
    reader.readAsDataURL(file);
  };

  const handleRunAiScan = async (overridePrompt?: string, overrideImage?: string) => {
    const img = overrideImage !== undefined ? overrideImage : previewImage;
    const prompt = overridePrompt !== undefined ? overridePrompt : textInput;

    if (!img && !prompt.trim()) {
      setScanErrorMessage('Por favor toma una foto, sube una imagen o escribe tu lista de útiles.');
      return;
    }

    setIsScanning(true);
    setScanSuccessMessage(null);
    setScanErrorMessage(null);

    try {
      // Extract items using AI
      const extracted = await scanListWithAi(img, prompt);

      // Match with store products
      const matchResult = matchItemsToCatalog(extracted, products);
      setMatchedItems(matchResult.items);
      setUnmatchedCount(matchResult.unmatched_items.length);
      setScanStep('results');
    } catch (err: any) {
      console.error('Error scanning list:', err);
      setScanErrorMessage(err.message || 'Hubo un error al procesar la lista con la IA. Verifique que la imagen sea legible o escriba los materiales.');
    } finally {
      setIsScanning(false);
    }
  };

  const toggleItemSelection = (id: string) => {
    setMatchedItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, selected: !item.selected } : item))
    );
  };

  const updateItemQty = (id: string, delta: number) => {
    setMatchedItems((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const newQty = Math.max(1, item.quantity + delta);
          return { ...item, quantity: newQty };
        }
        return item;
      })
    );
  };

  const removeItem = (id: string) => {
    setMatchedItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleAddAllToCart = () => {
    const itemsToAdd = matchedItems.filter((i) => i.selected && i.matched_product);

    if (itemsToAdd.length === 0) {
      alert('No hay artículos con producto coincidente seleccionados.');
      return;
    }

    let addedCount = 0;
    itemsToAdd.forEach((item) => {
      if (item.matched_product) {
        addItem(item.matched_product, item.quantity);
        addedCount++;
      }
    });

    try {
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.7 },
        colors: ['#dc2626', '#ffffff', '#ef4444', '#171717'],
      });
    } catch {
      // ignore
    }

    setScanSuccessMessage(
      `¡Se agregaron ${addedCount} materiales automáticamente a tu carrito de compras!`
    );

    setTimeout(() => {
      onClose();
      setIsCartOpen(true);
    }, 1200);
  };

  const handleReset = () => {
    setPreviewImage(null);
    setTextInput('');
    setMatchedItems([]);
    setScanStep('upload');
    setScanSuccessMessage(null);
  };

  const totalCalculated = matchedItems
    .filter((i) => i.selected && i.matched_product)
    .reduce((sum, i) => sum + (i.matched_product?.price || 0) * i.quantity, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-[#0d0d0d] border border-white/20 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] text-white">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-[#dc2626] via-[#b91c1c] to-[#991b1b] px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white text-[#dc2626] flex items-center justify-center font-black shadow-md">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black uppercase tracking-tight font-display text-white">
                  Escáner de Lista con IA
                </h3>
                <span className="text-[10px] bg-white/25 px-2 py-0.5 rounded font-black tracking-widest uppercase">
                  BIKIE VISION
                </span>
              </div>
              <p className="text-xs text-white/80 font-medium">
                Saca una foto a tu lista y la IA agregará los materiales directo al carrito.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-black/20 hover:bg-black/40 text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-5">
          {scanSuccessMessage && (
            <div className="p-4 bg-emerald-950/80 border border-emerald-500/40 rounded-xl flex items-center gap-3 text-emerald-300 animate-in fade-in zoom-in-95">
              <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
              <p className="text-sm font-bold">{scanSuccessMessage}</p>
            </div>
          )}

          {scanErrorMessage && (
            <div className="p-4 bg-red-950/80 border border-red-500/40 rounded-xl flex items-center gap-3 text-red-300 animate-in fade-in zoom-in-95">
              <AlertCircle className="w-6 h-6 text-red-400 shrink-0" />
              <p className="text-sm font-medium">{scanErrorMessage}</p>
            </div>
          )}

          {scanStep === 'upload' ? (
            <>
              {/* Photo & Upload Area */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Take Photo with Camera */}
                <div
                  onClick={() => cameraInputRef.current?.click()}
                  className="group relative border-2 border-dashed border-white/20 hover:border-[#dc2626] bg-white/5 hover:bg-[#dc2626]/10 rounded-xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-3"
                >
                  <input
                    ref={cameraInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files?.[0]) handleImageSelected(e.target.files[0]);
                    }}
                  />
                  <div className="w-14 h-14 rounded-full bg-[#dc2626]/20 text-[#ef4444] group-hover:bg-[#dc2626] group-hover:text-white flex items-center justify-center transition-colors">
                    <Camera className="w-7 h-7" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-white group-hover:text-[#ef4444] transition-colors">
                      Tomar Foto con Cámara
                    </h4>
                    <p className="text-xs text-white/50 mt-1">
                      Apunta a la hoja manuscrita o impresa
                    </p>
                  </div>
                </div>

                {/* Upload Image File */}
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="group relative border-2 border-dashed border-white/20 hover:border-[#dc2626] bg-white/5 hover:bg-[#dc2626]/10 rounded-xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-3"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files?.[0]) handleImageSelected(e.target.files[0]);
                    }}
                  />
                  <div className="w-14 h-14 rounded-full bg-white/10 text-white group-hover:bg-[#dc2626] group-hover:text-white flex items-center justify-center transition-colors">
                    <Upload className="w-7 h-7" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-white group-hover:text-[#ef4444] transition-colors">
                      Subir Imagen / Archivo
                    </h4>
                    <p className="text-xs text-white/50 mt-1">PNG, JPG, JPEG o captura de pantalla</p>
                  </div>
                </div>
              </div>

              {/* Image Preview if selected */}
              {previewImage && (
                <div className="p-3 bg-white/5 border border-white/15 rounded-xl flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <img
                      src={previewImage}
                      alt="Foto lista"
                      className="w-16 h-16 object-cover rounded-lg border border-white/20"
                    />
                    <div>
                      <p className="text-xs font-bold text-white">Foto cargada lista para escanear</p>
                      <p className="text-[10px] text-white/50 font-mono">
                        La IA detectará artículos y cantidades
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setPreviewImage(null)}
                    className="p-2 text-white/40 hover:text-[#ef4444] cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Or Manual / Text Input */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-white/70 uppercase tracking-wider flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-[#ef4444]" />
                  O escribe / pega tu lista de materiales:
                </label>
                <textarea
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  placeholder="Ejemplo:&#10;3 cuadernos cosidos&#10;5 bolígrafos azules&#10;1 resma de papel bond&#10;2 borradores escolares"
                  className="w-full h-24 bg-[#141414] border border-white/15 rounded-xl p-3 text-sm text-white placeholder-white/30 focus:border-[#dc2626] focus:outline-none resize-none font-mono"
                />
              </div>

              {/* Scan Action Button */}
              <button
                id="btn-run-ai-scan"
                onClick={() => handleRunAiScan()}
                disabled={isScanning || (!previewImage && !textInput.trim())}
                className={`w-full py-3.5 px-6 rounded-xl font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2.5 shadow-lg transition-all cursor-pointer ${
                  isScanning || (!previewImage && !textInput.trim())
                    ? 'bg-white/10 text-white/30 cursor-not-allowed border border-white/5'
                    : 'bg-[#dc2626] hover:bg-[#b91c1c] text-white border border-[#dc2626] accent-glow active:scale-[0.99]'
                }`}
              >
                {isScanning ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    <span>Analizando con IA & Buscando en Catálogo...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5" />
                    <span>Escanear Lista con IA</span>
                  </>
                )}
              </button>
            </>
          ) : (
            /* Results Step */
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div>
                  <h4 className="text-sm font-black uppercase text-white flex items-center gap-2">
                    <ListCheck className="w-4 h-4 text-emerald-400" />
                    Materiales Detectados ({matchedItems.length})
                  </h4>
                  <p className="text-xs text-white/50 mt-0.5">
                    Verifica las cantidades y agrega todo a tu carrito con un clic.
                  </p>
                </div>
                <button
                  onClick={handleReset}
                  className="text-xs font-bold text-[#ef4444] hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Escanear otra lista
                </button>
              </div>

              {/* Matched Items List */}
              <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                {matchedItems.map((item) => {
                  const product = item.matched_product;
                  const hasStock = product && product.stock > 0;

                  return (
                    <div
                      key={item.id}
                      className={`p-3 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                        item.selected
                          ? 'bg-white/5 border-white/20'
                          : 'bg-black/30 border-white/5 opacity-50'
                      }`}
                    >
                      {/* Checkbox & Item info */}
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <button
                          type="button"
                          onClick={() => toggleItemSelection(item.id)}
                          className={`w-5 h-5 rounded flex items-center justify-center transition-colors cursor-pointer shrink-0 ${
                            item.selected
                              ? 'bg-[#dc2626] text-white'
                              : 'bg-white/10 text-transparent border border-white/20'
                          }`}
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-white truncate">
                              {product ? product.name : item.item_name}
                            </span>
                            {item.match_confidence && item.match_confidence > 0 ? (
                              <span className="text-[9px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded font-mono font-bold">
                                {Math.round(item.match_confidence * 100)}% match
                              </span>
                            ) : (
                              <span className="text-[9px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded font-mono">
                                No catalogado
                              </span>
                            )}
                          </div>

                          <div className="text-[11px] text-white/50 flex items-center gap-2 mt-0.5">
                            <span>Texto escaneado: "{item.raw_text}"</span>
                            {product && (
                              <span className="text-white/80 font-bold font-mono">
                                • {formatCurrency(product.price)} c/u
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Quantity Controls & Price */}
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="flex items-center bg-black/40 border border-white/15 rounded-lg p-1">
                          <button
                            onClick={() => updateItemQty(item.id, -1)}
                            className="p-1 hover:bg-white/10 rounded text-white/70 hover:text-white cursor-pointer"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="w-7 text-center font-mono font-black text-xs text-white">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => updateItemQty(item.id, 1)}
                            className="p-1 hover:bg-white/10 rounded text-white/70 hover:text-white cursor-pointer"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>

                        <div className="text-right min-w-[75px]">
                          <span className="text-xs font-black font-mono text-[#ef4444]">
                            {product ? formatCurrency(product.price * item.quantity) : '-'}
                          </span>
                        </div>

                        <button
                          onClick={() => removeItem(item.id)}
                          className="p-1 text-white/30 hover:text-[#ef4444] transition-colors cursor-pointer"
                          title="Eliminar de la lista"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Summary Bar */}
              <div className="p-4 bg-[#141414] border border-white/10 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold text-white/40 tracking-wider">
                    Total Estimado en XAF
                  </span>
                  <div className="text-xl font-black text-white font-mono">
                    {formatCurrency(totalCalculated)}
                  </div>
                </div>

                <button
                  id="btn-add-all-ai-cart"
                  onClick={handleAddAllToCart}
                  className="py-3 px-6 bg-[#dc2626] hover:bg-[#b91c1c] text-white rounded-xl font-black text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg accent-glow transition-all cursor-pointer active:scale-95"
                >
                  <ShoppingCart className="w-4 h-4" />
                  <span>Poner Materiales en el Carrito</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
