import React, { useState, useEffect } from 'react';
import {
  getOffers,
  createOffer,
  updateOffer,
  deleteOffer,
  setOfferStatus,
} from '../../services/offerService';
import { getCategories, getProducts } from '../../services/productService';
import { Offer, Category, Product, OfferType, OfferStatus } from '../../types';
import { formatCurrency } from '../../utils/currency';
import { useRealtime } from '../../context/RealtimeContext';
import {
  Tag,
  Plus,
  Edit2,
  Trash2,
  X,
  RefreshCw,
  Sparkles,
} from 'lucide-react';

export const AdminOffers: React.FC = () => {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingOffer, setEditingOffer] = useState<Offer | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: 'percentage' as OfferType,
    value: 15,
    is_global: true,
    target_mode: 'global' as 'global' | 'category' | 'product',
    selected_category_id: '',
    selected_product_id: '',
    start_date: new Date().toISOString().slice(0, 16),
    end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
    status: 'active' as OfferStatus,
  });

  const { refreshTrigger, triggerGlobalRefresh } = useRealtime();

  useEffect(() => {
    loadData();
  }, [refreshTrigger]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [o, c, p] = await Promise.all([getOffers(), getCategories(), getProducts(false)]);
      setOffers(o);
      setCategories(c);
      setProducts(p);
    } catch (err: any) {
      console.error('Error loading offers:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenCreate = () => {
    setEditingOffer(null);
    setFormData({
      name: '',
      description: '',
      type: 'percentage',
      value: 15,
      is_global: true,
      target_mode: 'global',
      selected_category_id: categories[0]?.id || '',
      selected_product_id: products[0]?.id || '',
      start_date: new Date().toISOString().slice(0, 16),
      end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
      status: 'active',
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (offer: Offer) => {
    setEditingOffer(offer);
    const isCat = Boolean(offer.category_ids && offer.category_ids.length > 0);
    const isProd = Boolean(offer.product_ids && offer.product_ids.length > 0);
    const targetMode = offer.is_global ? 'global' : isCat ? 'category' : isProd ? 'product' : 'global';

    setFormData({
      name: offer.name,
      description: offer.description || '',
      type: offer.type,
      value: offer.value,
      is_global: offer.is_global,
      target_mode: targetMode,
      selected_category_id: offer.category_ids?.[0] || '',
      selected_product_id: offer.product_ids?.[0] || '',
      start_date: offer.start_date.slice(0, 16),
      end_date: offer.end_date.slice(0, 16),
      status: offer.status,
    });
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return alert('El nombre es obligatorio');

    const isGlobal = formData.target_mode === 'global';
    const categoryIds = formData.target_mode === 'category' && formData.selected_category_id ? [formData.selected_category_id] : [];
    const productIds = formData.target_mode === 'product' && formData.selected_product_id ? [formData.selected_product_id] : [];

    try {
      if (editingOffer) {
        await updateOffer(editingOffer.id, {
          name: formData.name.trim(),
          description: formData.description.trim() || null,
          type: formData.type,
          value: Number(formData.value),
          is_global: isGlobal,
          category_ids: categoryIds,
          product_ids: productIds,
          start_date: new Date(formData.start_date).toISOString(),
          end_date: new Date(formData.end_date).toISOString(),
          status: formData.status,
        });
      } else {
        await createOffer({
          name: formData.name.trim(),
          description: formData.description.trim() || undefined,
          type: formData.type,
          value: Number(formData.value),
          is_global: isGlobal,
          category_ids: categoryIds,
          product_ids: productIds,
          start_date: new Date(formData.start_date).toISOString(),
          end_date: new Date(formData.end_date).toISOString(),
          status: formData.status,
        });
      }

      setIsModalOpen(false);
      triggerGlobalRefresh();
    } catch (err: any) {
      alert(`Error al guardar oferta: ${err.message}`);
    }
  };

  const handleDelete = async (offer: Offer) => {
    if (confirm(`¿Eliminar la promoción "${offer.name}"?`)) {
      try {
        await deleteOffer(offer.id);
        triggerGlobalRefresh();
      } catch (err: any) {
        alert(`Error al eliminar: ${err.message}`);
      }
    }
  };

  const handleToggleStatus = async (offer: Offer) => {
    const nextStatus: OfferStatus = offer.status === 'active' ? 'paused' : 'active';
    try {
      await setOfferStatus(offer.id, nextStatus);
      triggerGlobalRefresh();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6 font-mono">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#0d0d0d] p-6 rounded-xl border border-white/10">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-white font-display uppercase tracking-tight">
            MOTOR DE PROMOCIONES
          </h1>
          <p className="text-[10px] text-white/40 uppercase tracking-widest mt-0.5">
            GESTIÓN DE DESCUENTOS %, MONTOS FIJOS Y PRECIOS ESPECIALES EN SUPABASE
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleOpenCreate}
            className="px-4 py-2.5 bg-[#dc2626] hover:bg-[#ef4444] text-white text-xs font-black uppercase tracking-wider rounded-lg flex items-center gap-1.5 accent-glow shadow-md transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>NUEVA PROMOCIÓN</span>
          </button>
          <button
            onClick={loadData}
            disabled={isLoading}
            className="p-2.5 bg-[#141414] hover:bg-white/10 border border-white/10 text-white rounded-lg transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-[#ef4444]' : ''}`} />
          </button>
        </div>
      </div>

      {/* Offers List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {offers.map((offer) => {
          const isActive = offer.status === 'active';
          return (
            <div
              key={offer.id}
              className={`bg-[#0d0d0d] p-5 rounded-xl border flex flex-col justify-between transition-all ${
                isActive ? 'border-white/10 hover:border-[#dc2626]' : 'border-white/5 opacity-50'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span
                    className={`px-2.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider ${
                      isActive
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : offer.status === 'paused'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : 'bg-white/10 text-white/50 border border-white/20'
                    }`}
                  >
                    {(offer.status || '').toUpperCase()}
                  </span>

                  <span className="bg-[#dc2626] text-white text-[10px] font-black px-2 py-0.5 rounded-md shadow accent-glow">
                    {offer.type === 'percentage'
                      ? `-${offer.value}%`
                      : offer.type === 'fixed_discount'
                      ? `-${formatCurrency(offer.value)}`
                      : formatCurrency(offer.value)}
                  </span>
                </div>

                <h3 className="font-bold text-white text-base leading-tight mb-1 uppercase">
                  {offer.name}
                </h3>
                <p className="text-xs text-white/40 mb-3">
                  {offer.description || 'Sin descripción adicional'}
                </p>

                {/* Scope */}
                <div className="text-[10px] text-white/60 space-y-1 p-3 rounded-lg bg-[#141414] border border-white/10 mb-3 uppercase">
                  <p>
                    🎯 ALCANCE:{' '}
                    <strong className="text-white">
                      {offer.is_global
                        ? 'TODO EL CATÁLOGO'
                        : offer.category_ids && offer.category_ids.length > 0
                        ? 'CATEGORÍA ESPECÍFICA'
                        : 'PRODUCTOS SELECCIONADOS'}
                    </strong>
                  </p>
                  <p>
                    📅 VENCE:{' '}
                    <strong className="text-[#ef4444]">
                      {new Date(offer.end_date).toLocaleDateString()}
                    </strong>
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between pt-4 mt-2 border-t border-white/10">
                <button
                  onClick={() => handleToggleStatus(offer)}
                  className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-md cursor-pointer transition-colors ${
                    isActive
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30'
                      : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30'
                  }`}
                >
                  {isActive ? 'PAUSAR' : 'ACTIVAR'}
                </button>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleOpenEdit(offer)}
                    className="p-1.5 bg-[#141414] hover:bg-white/10 border border-white/10 text-white rounded-lg cursor-pointer"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(offer)}
                    className="p-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-[#ef4444] rounded-lg cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Create / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs overflow-y-auto">
          <div className="bg-[#0d0d0d] rounded-xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-white/10 relative my-8 text-white font-mono">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 p-2 text-white/40 hover:text-white hover:bg-white/10 border border-transparent hover:border-white/10 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-black text-white font-display uppercase tracking-tight mb-4">
              {editingOffer ? 'EDITAR PROMOCIÓN' : 'NUEVA PROMOCIÓN'}
            </h3>

            <form onSubmit={handleSave} className="space-y-4 text-xs">
              <div>
                <label className="block font-black text-white/60 uppercase tracking-wider mb-1">
                  NOMBRE DE LA PROMOCIÓN *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ej. TEMPORADA ESCOLAR - 15% OFF"
                  className="w-full p-2.5 bg-[#141414] border border-white/10 rounded-lg text-white uppercase placeholder:text-white/30 focus:border-[#dc2626] focus:outline-hidden text-sm"
                />
              </div>

              <div>
                <label className="block font-black text-white/60 uppercase tracking-wider mb-1">DESCRIPCIÓN</label>
                <textarea
                  rows={2}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Condiciones o detalles de la oferta..."
                  className="w-full p-2.5 bg-[#141414] border border-white/10 rounded-lg text-white placeholder:text-white/30 focus:border-[#dc2626] focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-black text-white/60 uppercase tracking-wider mb-1">TIPO DE DESCUENTO</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as OfferType })}
                    className="w-full p-2.5 bg-[#141414] border border-white/10 rounded-lg text-white uppercase focus:border-[#dc2626] focus:outline-hidden"
                  >
                    <option value="percentage" className="bg-[#141414] text-white">PORCENTAJE (%)</option>
                    <option value="fixed_discount" className="bg-[#141414] text-white">MONTO FIJO (FCFA)</option>
                    <option value="special_price" className="bg-[#141414] text-white">PRECIO ESPECIAL (FCFA)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-black text-white/60 uppercase tracking-wider mb-1">
                    VALOR DEL DESCUENTO *
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={formData.value}
                    onChange={(e) => setFormData({ ...formData, value: parseFloat(e.target.value) || 0 })}
                    className="w-full p-2.5 bg-[#141414] border border-white/10 rounded-lg text-white font-mono font-black focus:border-[#dc2626] focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block font-black text-white/60 uppercase tracking-wider mb-1">ALCANCE</label>
                  <select
                    value={formData.target_mode}
                    onChange={(e) => setFormData({ ...formData, target_mode: e.target.value as any })}
                    className="w-full p-2.5 bg-[#141414] border border-white/10 rounded-lg text-white uppercase focus:border-[#dc2626] focus:outline-hidden"
                  >
                    <option value="global" className="bg-[#141414] text-white">TODO EL CATÁLOGO (GLOBAL)</option>
                    <option value="category" className="bg-[#141414] text-white">CATEGORÍA ESPECÍFICA</option>
                    <option value="product" className="bg-[#141414] text-white">PRODUCTO ESPECÍFICO</option>
                  </select>
                </div>

                {formData.target_mode === 'category' && (
                  <div>
                    <label className="block font-black text-white/60 uppercase tracking-wider mb-1">SELECCIONAR CATEGORÍA</label>
                    <select
                      value={formData.selected_category_id}
                      onChange={(e) => setFormData({ ...formData, selected_category_id: e.target.value })}
                      className="w-full p-2.5 bg-[#141414] border border-white/10 rounded-lg text-white uppercase focus:border-[#dc2626] focus:outline-hidden"
                    >
                      <option value="" className="bg-[#141414] text-white">-- ELIGE UNA CATEGORÍA --</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id} className="bg-[#141414] text-white">
                          {(c.name || '').toUpperCase()}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {formData.target_mode === 'product' && (
                  <div>
                    <label className="block font-black text-white/60 uppercase tracking-wider mb-1">SELECCIONAR PRODUCTO</label>
                    <select
                      value={formData.selected_product_id}
                      onChange={(e) => setFormData({ ...formData, selected_product_id: e.target.value })}
                      className="w-full p-2.5 bg-[#141414] border border-white/10 rounded-lg text-white uppercase focus:border-[#dc2626] focus:outline-hidden"
                    >
                      <option value="" className="bg-[#141414] text-white">-- ELIGE UN PRODUCTO --</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id} className="bg-[#141414] text-white">
                          {(p.name || '').toUpperCase()} ({formatCurrency(p.price)})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-black text-white/60 uppercase tracking-wider mb-1">FECHA DE INICIO</label>
                  <input
                    type="datetime-local"
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    className="w-full p-2.5 bg-[#141414] border border-white/10 rounded-lg text-white font-mono text-xs focus:border-[#dc2626] focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block font-black text-white/60 uppercase tracking-wider mb-1">FECHA DE FIN</label>
                  <input
                    type="datetime-local"
                    value={formData.end_date}
                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                    className="w-full p-2.5 bg-[#141414] border border-white/10 rounded-lg text-white font-mono text-xs focus:border-[#dc2626] focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block font-black text-white/60 uppercase tracking-wider mb-1">ESTADO</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as OfferStatus })}
                  className="w-full p-2.5 bg-[#141414] border border-white/10 rounded-lg text-white uppercase focus:border-[#dc2626] focus:outline-hidden"
                >
                  <option value="active" className="bg-[#141414] text-white">ACTIVO</option>
                  <option value="paused" className="bg-[#141414] text-white">PAUSADO</option>
                  <option value="scheduled" className="bg-[#141414] text-white">PROGRAMADO</option>
                  <option value="finished" className="bg-[#141414] text-white">FINALIZADO</option>
                </select>
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
                  GUARDAR OFERTA
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
