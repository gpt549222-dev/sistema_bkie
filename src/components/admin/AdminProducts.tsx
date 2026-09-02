import React, { useState, useEffect } from 'react';
import {
  getProducts,
  getCategories,
  createProduct,
  updateProduct,
  adjustProductStock,
  deleteProduct,
} from '../../services/productService';
import { Product, Category, InventoryMovementType } from '../../types';
import { formatCurrency } from '../../utils/currency';
import { useRealtime } from '../../context/RealtimeContext';
import {
  Package,
  Plus,
  Search,
  Edit2,
  Trash2,
  Boxes,
  AlertTriangle,
  CheckCircle2,
  X,
  Layers,
  Sparkles,
  RefreshCw,
  Eye,
  EyeOff,
} from 'lucide-react';

export const AdminProducts: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);

  // Edit / Create Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    description: '',
    category_id: '',
    price: 0,
    cost: 0,
    stock: 0,
    min_stock: 5,
    image_url: '',
    is_active: true,
  });

  // Stock Adjustment Modal state
  const [stockModalProduct, setStockModalProduct] = useState<Product | null>(null);
  const [stockAdjustmentType, setStockAdjustmentType] = useState<InventoryMovementType>('ajuste_manual');
  const [stockAdjustmentQty, setStockAdjustmentQty] = useState<number>(0);
  const [stockAdjustmentReason, setStockAdjustmentReason] = useState<string>('');
  const [isAdjustingStock, setIsAdjustingStock] = useState(false);

  const { refreshTrigger, triggerGlobalRefresh } = useRealtime();

  useEffect(() => {
    loadData();
  }, [refreshTrigger]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [pData, cData] = await Promise.all([getProducts(true), getCategories()]);
      setProducts(pData);
      setCategories(cData);
    } catch (err: any) {
      console.error('Error loading products:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenCreateModal = () => {
    setEditingProduct(null);
    setFormData({
      code: `BIK-${Math.floor(1000 + Math.random() * 9000)}`,
      name: '',
      description: '',
      category_id: categories[0]?.id || '',
      price: 0,
      cost_price: 0,
      stock: 10,
      min_stock: 5,
      image_url: '',
      is_active: true,
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      code: product.code,
      name: product.name,
      description: product.description || '',
      category_id: product.category_id || '',
      price: product.price,
      cost_price: product.cost_price || 0,
      stock: product.stock,
      min_stock: product.min_stock,
      image_url: product.image_url || '',
      is_active: product.is_active,
    });
    setIsModalOpen(true);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return alert('El nombre es obligatorio');
    if (!formData.code.trim()) return alert('El código SKU es obligatorio');

    try {
      if (editingProduct) {
        await updateProduct(editingProduct.id, {
          code: formData.code.trim(),
          name: formData.name.trim(),
          description: formData.description.trim() || undefined,
          category_id: formData.category_id || undefined,
          price: Number(formData.price),
          cost_price: Number(formData.cost_price),
          stock: Number(formData.stock),
          min_stock: Number(formData.min_stock),
          image_url: formData.image_url.trim() || undefined,
          is_active: formData.is_active,
        });
      } else {
        await createProduct({
          code: formData.code.trim(),
          name: formData.name.trim(),
          description: formData.description.trim() || undefined,
          category_id: formData.category_id || undefined,
          price: Number(formData.price),
          cost_price: Number(formData.cost_price),
          stock: Number(formData.stock),
          min_stock: Number(formData.min_stock),
          image_url: formData.image_url.trim() || undefined,
          is_active: formData.is_active,
        });
      }

      setIsModalOpen(false);
      triggerGlobalRefresh();
    } catch (err: any) {
      alert(`Error al guardar producto: ${err.message}`);
    }
  };

  const handleStockAdjustmentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stockModalProduct) return;
    if (stockAdjustmentQty === 0) return alert('Ingresa una cantidad distinta de cero');

    setIsAdjustingStock(true);
    try {
      await adjustProductStock(
        stockModalProduct.id,
        Number(stockAdjustmentQty),
        stockAdjustmentType,
        stockAdjustmentReason.trim() || 'Ajuste de inventario',
        'Administrador'
      );
      setStockModalProduct(null);
      setStockAdjustmentQty(0);
      setStockAdjustmentReason('');
      triggerGlobalRefresh();
    } catch (err: any) {
      alert(`Error al ajustar stock: ${err.message}`);
    } finally {
      setIsAdjustingStock(false);
    }
  };

  const handleDelete = async (product: Product) => {
    if (confirm(`¿Desactivar o eliminar el artículo "${product.name}"?`)) {
      try {
        await deleteProduct(product.id);
        triggerGlobalRefresh();
      } catch (err: any) {
        alert(`Error: ${err.message}`);
      }
    }
  };

  const filtered = products.filter((p) => {
    const matchesCat = categoryFilter === 'all' || p.category_id === categoryFilter;
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      p.name.toLowerCase().includes(q) ||
      p.code.toLowerCase().includes(q) ||
      (p.description && p.description.toLowerCase().includes(q));
    return matchesCat && matchesSearch;
  });

  return (
    <div className="space-y-6 font-mono">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#0d0d0d] p-6 rounded-xl border border-white/10">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-white font-display uppercase tracking-tight">
            CATÁLOGO & INVENTARIO
          </h1>
          <p className="text-[10px] text-white/40 uppercase tracking-widest font-mono mt-0.5">
            GESTIÓN DE SKU, PRECIOS, KARDEX Y EXISTENCIAS EN SUPABASE
          </p>
        </div>

        <div className="flex items-center gap-2 font-mono">
          <button
            onClick={handleOpenCreateModal}
            className="px-4 py-2.5 bg-[#dc2626] hover:bg-[#ef4444] text-white text-xs font-black uppercase tracking-wider rounded-lg flex items-center gap-1.5 accent-glow shadow-md transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>NUEVO PRODUCTO</span>
          </button>
          <button
            onClick={loadData}
            disabled={isLoading}
            className="p-2.5 bg-[#141414] hover:bg-white/10 border border-white/10 text-white/70 hover:text-white rounded-lg transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-[#ef4444]' : ''}`} />
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-[#0d0d0d] rounded-xl p-6 border border-white/10 space-y-4 font-mono">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="BUSCAR POR SKU, NOMBRE..."
              className="w-full pl-9.5 pr-4 py-2.5 bg-[#141414] border border-white/10 rounded-lg text-xs text-white placeholder:text-white/30 focus:border-[#dc2626] focus:outline-hidden uppercase"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto pb-1 scrollbar-none">
            <button
              onClick={() => setCategoryFilter('all')}
              className={`px-3.5 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider whitespace-nowrap transition-all cursor-pointer ${
                categoryFilter === 'all'
                  ? 'bg-[#dc2626] text-white shadow-md accent-glow'
                  : 'bg-[#141414] text-white/60 hover:text-white border border-white/10 hover:bg-white/5'
              }`}
            >
              TODAS LAS CATEGORÍAS
            </button>
            {categories.map((c) => (
              <button
                key={c.id}
                onClick={() => setCategoryFilter(c.id)}
                className={`px-3.5 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider whitespace-nowrap transition-all cursor-pointer ${
                  categoryFilter === c.id
                    ? 'bg-[#dc2626] text-white shadow-md accent-glow'
                    : 'bg-[#141414] text-white/60 hover:text-white border border-white/10 hover:bg-white/5'
                }`}
              >
                {(c.name || '').toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Product Table */}
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-white/30 text-xs">
            NO SE ENCONTRARON PRODUCTOS REGISTRADOS.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="text-white/40 font-bold uppercase text-[10px] tracking-widest border-b border-white/10 pb-2">
                  <th className="py-2.5">PRODUCTO</th>
                  <th className="py-2.5">SKU</th>
                  <th className="py-2.5">CATEGORÍA</th>
                  <th className="py-2.5">PRECIO VENTA</th>
                  <th className="py-2.5">COSTO</th>
                  <th className="py-2.5">STOCK</th>
                  <th className="py-2.5">ESTADO</th>
                  <th className="py-2.5 text-right">ACCIONES</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filtered.map((product) => {
                  const isLow = product.stock <= product.min_stock;
                  return (
                    <tr key={product.id} className="hover:bg-white/5 transition-colors">
                      <td className="py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-[#141414] overflow-hidden border border-white/10 shrink-0">
                            {product.image_url ? (
                              <img
                                src={product.image_url}
                                alt={product.name}
                                referrerPolicy="no-referrer"
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-[9px] font-black text-white/30">
                                BIKIE
                              </div>
                            )}
                          </div>
                          <div>
                            <p className="font-bold text-white uppercase">{product.name}</p>
                            <p className="text-[10px] text-white/40 line-clamp-1 max-w-xs">
                              {product.description || 'Sin descripción'}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 font-mono font-black text-[#ef4444]">
                        {product.code}
                      </td>

                      <td className="py-3 text-white/60 uppercase">
                        {product.category?.name || 'General'}
                      </td>

                      <td className="py-3 font-mono font-black text-white">
                        {formatCurrency(product.price)}
                      </td>

                      <td className="py-3 font-mono text-white/40">
                        {formatCurrency(product.cost_price || 0)}
                      </td>

                      <td className="py-3">
                        <button
                          onClick={() => setStockModalProduct(product)}
                          className={`px-2 py-0.5 rounded-lg font-mono font-black text-[10px] uppercase tracking-wider flex items-center gap-1 cursor-pointer transition-transform hover:scale-105 ${
                            product.stock <= 0
                              ? 'bg-red-500/20 text-[#ef4444] border border-red-500/30'
                              : isLow
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          }`}
                          title="Clic para ajustar stock en Kardex"
                        >
                          <Boxes className="w-3 h-3" />
                          <span>{product.stock} UN.</span>
                        </button>
                      </td>

                      <td className="py-3">
                        <span
                          className={`text-[9px] font-black px-2 py-0.5 rounded-lg uppercase tracking-wider ${
                            product.is_active
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : 'bg-white/10 text-white/50 border border-white/20'
                          }`}
                        >
                          {product.is_active ? 'ACTIVO' : 'OCULTO'}
                        </span>
                      </td>

                      <td className="py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenEditModal(product)}
                            className="p-1.5 bg-[#141414] hover:bg-white/10 border border-white/10 text-white rounded-lg cursor-pointer transition-colors"
                            title="Editar producto"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(product)}
                            className="p-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-[#ef4444] rounded-lg cursor-pointer transition-colors"
                            title="Eliminar"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Product Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs overflow-y-auto">
          <div className="bg-[#0d0d0d] rounded-xl max-w-xl w-full p-6 sm:p-8 shadow-2xl border border-white/10 relative my-8 text-white font-mono">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 p-2 text-white/40 hover:text-white hover:bg-white/10 border border-transparent hover:border-white/10 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-black text-white font-display uppercase tracking-tight mb-4">
              {editingProduct ? 'EDITAR PRODUCTO' : 'NUEVO PRODUCTO'}
            </h3>

            <form onSubmit={handleSaveProduct} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-black text-white/60 uppercase tracking-wider mb-1">CÓDIGO SKU *</label>
                  <input
                    type="text"
                    required
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    className="w-full p-2.5 bg-[#141414] border border-white/10 rounded-lg text-white uppercase focus:border-[#dc2626] focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block font-black text-white/60 uppercase tracking-wider mb-1">CATEGORÍA</label>
                  <select
                    value={formData.category_id}
                    onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                    className="w-full p-2.5 bg-[#141414] border border-white/10 rounded-lg text-white uppercase focus:border-[#dc2626] focus:outline-hidden"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id} className="bg-[#141414] text-white">
                        {(c.name || '').toUpperCase()}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-black text-white/60 uppercase tracking-wider mb-1">NOMBRE DEL PRODUCTO *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ej. Cuaderno BIKIE Profesional 100 Hojas"
                  className="w-full p-2.5 bg-[#141414] border border-white/10 rounded-lg text-white uppercase placeholder:text-white/30 focus:border-[#dc2626] focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-black text-white/60 uppercase tracking-wider mb-1">DESCRIPCIÓN</label>
                <textarea
                  rows={2}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Especificaciones, marca, colores..."
                  className="w-full p-2.5 bg-[#141414] border border-white/10 rounded-lg text-white placeholder:text-white/30 focus:border-[#dc2626] focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block font-black text-white/60 uppercase tracking-wider mb-1">PRECIO VENTA (FCFA) *</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                    className="w-full p-2.5 bg-[#141414] border border-white/10 rounded-lg text-white font-bold focus:border-[#dc2626] focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block font-black text-white/60 uppercase tracking-wider mb-1">COSTO (FCFA)</label>
                  <input
                    type="number"
                    step="any"
                    value={formData.cost_price}
                    onChange={(e) => setFormData({ ...formData, cost_price: parseFloat(e.target.value) || 0 })}
                    className="w-full p-2.5 bg-[#141414] border border-white/10 rounded-lg text-white focus:border-[#dc2626] focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block font-black text-white/60 uppercase tracking-wider mb-1">STOCK ACTUAL</label>
                  <input
                    type="number"
                    value={formData.stock}
                    onChange={(e) => setFormData({ ...formData, stock: parseInt(e.target.value) || 0 })}
                    className="w-full p-2.5 bg-[#141414] border border-white/10 rounded-lg text-white focus:border-[#dc2626] focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block font-black text-white/60 uppercase tracking-wider mb-1">STOCK MÍNIMO</label>
                  <input
                    type="number"
                    value={formData.min_stock}
                    onChange={(e) => setFormData({ ...formData, min_stock: parseInt(e.target.value) || 0 })}
                    className="w-full p-2.5 bg-[#141414] border border-white/10 rounded-lg text-white focus:border-[#dc2626] focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block font-black text-white/60 uppercase tracking-wider mb-1">URL DE IMAGEN</label>
                <input
                  type="url"
                  value={formData.image_url}
                  onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                  placeholder="https://images.unsplash.com/..."
                  className="w-full p-2.5 bg-[#141414] border border-white/10 rounded-lg text-white placeholder:text-white/30 focus:border-[#dc2626] focus:outline-hidden"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="rounded-md text-[#dc2626] focus:ring-[#dc2626] accent-[#dc2626]"
                />
                <label htmlFor="is_active" className="font-black text-white/80 uppercase text-[11px] cursor-pointer">
                  MOSTRAR PRODUCTO ACTIVO EN EL CATÁLOGO
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 bg-[#141414] hover:bg-white/10 border border-white/10 text-white rounded-lg font-black uppercase tracking-wider text-xs cursor-pointer"
                >
                  CANCELAR
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-[#dc2626] hover:bg-[#ef4444] text-white rounded-lg font-black uppercase tracking-wider text-xs accent-glow cursor-pointer shadow-md"
                >
                  GUARDAR PRODUCTO
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stock Adjustment Modal */}
      {stockModalProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="bg-[#0d0d0d] rounded-xl max-w-md w-full p-6 shadow-2xl border border-white/10 relative text-white font-mono">
            <button
              onClick={() => setStockModalProduct(null)}
              className="absolute top-4 right-4 p-2 text-white/40 hover:text-white hover:bg-white/10 border border-transparent hover:border-white/10 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4 pb-3 border-b border-white/10">
              <div className="w-10 h-10 rounded-lg bg-[#dc2626] text-white flex items-center justify-center accent-glow shadow">
                <Boxes className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-white font-display uppercase tracking-tight">
                  AJUSTE DE KARDEX
                </h3>
                <p className="text-xs text-white/40">
                  {(stockModalProduct.name || '').toUpperCase()} (STOCK ACTUAL: {stockModalProduct.stock})
                </p>
              </div>
            </div>

            <form onSubmit={handleStockAdjustmentSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-black text-white/60 uppercase tracking-wider mb-1">TIPO DE MOVIMIENTO</label>
                <select
                  value={stockAdjustmentType}
                  onChange={(e) => setStockAdjustmentType(e.target.value as InventoryMovementType)}
                  className="w-full p-2.5 bg-[#141414] border border-white/10 rounded-lg text-white uppercase focus:border-[#dc2626] focus:outline-hidden"
                >
                  <option value="compra" className="bg-[#141414] text-white">COMPRA / ENTRADA (+)</option>
                  <option value="ajuste_manual" className="bg-[#141414] text-white">AJUSTE MANUAL / AUDITORÍA</option>
                  <option value="devolucion_cliente" className="bg-[#141414] text-white">DEVOLUCIÓN DE CLIENTE (+)</option>
                  <option value="daño_merma" className="bg-[#141414] text-white">DAÑO / MERMA (-)</option>
                </select>
              </div>

              <div>
                <label className="block font-black text-white/60 uppercase tracking-wider mb-1">
                  CANTIDAD A MODIFICAR (+ PARA SUMAR, - PARA RESTAR)
                </label>
                <input
                  type="number"
                  required
                  value={stockAdjustmentQty}
                  onChange={(e) => setStockAdjustmentQty(parseInt(e.target.value) || 0)}
                  placeholder="Ej. 10 para sumar, -3 para restar"
                  className="w-full p-2.5 bg-[#141414] border border-white/10 rounded-lg text-white font-mono text-sm font-black focus:border-[#dc2626] focus:outline-hidden"
                />
                <p className="text-[10px] text-white/40 mt-1 uppercase">
                  NUEVO STOCK RESULTANTE:{' '}
                  <strong className="text-[#ef4444]">
                    {Math.max(0, stockModalProduct.stock + Number(stockAdjustmentQty))} UNIDADES
                  </strong>
                </p>
              </div>

              <div>
                <label className="block font-black text-white/60 uppercase tracking-wider mb-1">
                  MOTIVO / JUSTIFICACIÓN *
                </label>
                <input
                  type="text"
                  required
                  value={stockAdjustmentReason}
                  onChange={(e) => setStockAdjustmentReason(e.target.value)}
                  placeholder="Ej. Factura proveedor #4092 o conteo físico"
                  className="w-full p-2.5 bg-[#141414] border border-white/10 rounded-lg text-white uppercase placeholder:text-white/30 focus:border-[#dc2626] focus:outline-hidden"
                />
              </div>

              <button
                type="submit"
                disabled={isAdjustingStock}
                className="w-full py-3.5 bg-[#dc2626] hover:bg-[#ef4444] text-white font-black uppercase tracking-[0.2em] rounded-xl text-xs flex items-center justify-center gap-2 cursor-pointer accent-glow transition-all disabled:opacity-50 shadow-lg"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{isAdjustingStock ? 'ACTUALIZANDO...' : 'REGISTRAR EN KARDEX'}</span>
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
