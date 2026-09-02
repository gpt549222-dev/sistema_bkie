import React, { useState, useEffect } from 'react';
import {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} from '../../services/productService';
import { Category } from '../../types';
import { useRealtime } from '../../context/RealtimeContext';
import {
  Plus,
  Edit2,
  Trash2,
  X,
  RefreshCw,
  Bookmark,
} from 'lucide-react';

export const AdminCategories: React.FC = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: '',
    sort_order: 0,
  });

  const { refreshTrigger, triggerGlobalRefresh } = useRealtime();

  useEffect(() => {
    loadCategories();
  }, [refreshTrigger]);

  const loadCategories = async () => {
    setIsLoading(true);
    try {
      const data = await getCategories();
      setCategories(data);
    } catch (err: any) {
      console.error('Error al cargar categorías:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenCreate = () => {
    setEditingCategory(null);
    setFormData({
      name: '',
      slug: '',
      description: '',
      sort_order: categories.length + 1,
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (category: Category) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      slug: category.slug,
      description: category.description || '',
      sort_order: category.sort_order,
    });
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return alert('El nombre es obligatorio');
    const slug =
      formData.slug.trim() ||
      formData.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');

    try {
      if (editingCategory) {
        await updateCategory(editingCategory.id, {
          name: formData.name.trim(),
          slug,
          description: formData.description.trim() || null,
          sort_order: Number(formData.sort_order),
        });
      } else {
        await createCategory({
          name: formData.name.trim(),
          slug,
          description: formData.description.trim() || undefined,
          sort_order: Number(formData.sort_order),
        });
      }

      setIsModalOpen(false);
      triggerGlobalRefresh();
    } catch (err: any) {
      alert(`Error al guardar categoría: ${err.message}`);
    }
  };

  const handleDelete = async (category: Category) => {
    if (confirm(`¿Eliminar la categoría "${category.name}"?`)) {
      try {
        await deleteCategory(category.id);
        triggerGlobalRefresh();
      } catch (err: any) {
        alert(`Error al eliminar: ${err.message}`);
      }
    }
  };

  return (
    <div className="space-y-6 font-mono">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#0d0d0d] p-6 rounded-xl border border-white/10">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-white font-display uppercase tracking-tight">
            CATEGORÍAS DE CATÁLOGO
          </h1>
          <p className="text-[10px] text-white/40 uppercase tracking-widest mt-0.5">
            ORGANIZA SECCIONES ESCOLARES, OFICINA, ARTE Y SUMINISTROS
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleOpenCreate}
            className="px-4 py-2.5 bg-[#dc2626] hover:bg-[#ef4444] text-white text-xs font-black uppercase tracking-wider rounded-lg flex items-center gap-1.5 accent-glow shadow-md transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>NUEVA CATEGORÍA</span>
          </button>
          <button
            onClick={loadCategories}
            disabled={isLoading}
            className="p-2.5 bg-[#141414] hover:bg-white/10 border border-white/10 text-white rounded-lg transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-[#ef4444]' : ''}`} />
          </button>
        </div>
      </div>

      {/* Categories Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {categories.map((cat) => (
          <div
            key={cat.id}
            className="bg-[#0d0d0d] p-5 rounded-xl border border-white/10 flex items-center justify-between hover:border-[#dc2626] transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#dc2626] text-white flex items-center justify-center font-bold accent-glow shadow">
                <Bookmark className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-black text-white text-xs uppercase">{cat.name}</h4>
                <p className="text-[10px] font-mono text-white/40">/{cat.slug}</p>
                {cat.description && (
                  <p className="text-[10px] text-white/50 line-clamp-1 mt-0.5">{cat.description}</p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1">
              <span className="text-[10px] font-mono bg-[#141414] text-white/60 border border-white/10 px-2 py-0.5 rounded-md mr-1">
                #{cat.sort_order}
              </span>
              <button
                onClick={() => handleOpenEdit(cat)}
                className="p-1.5 bg-[#141414] hover:bg-white/10 border border-white/10 text-white rounded-lg cursor-pointer transition-colors"
                title="Editar"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => handleDelete(cat)}
                className="p-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-[#ef4444] rounded-lg cursor-pointer transition-colors"
                title="Eliminar"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Modal Create/Edit */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs font-mono">
          <div className="bg-[#0d0d0d] rounded-xl max-w-md w-full p-6 shadow-2xl border border-white/10 relative text-white">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 p-2 text-white/40 hover:text-white hover:bg-white/10 border border-transparent hover:border-white/10 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-black text-white font-display uppercase tracking-tight mb-4">
              {editingCategory ? 'EDITAR CATEGORÍA' : 'NUEVA CATEGORÍA'}
            </h3>

            <form onSubmit={handleSave} className="space-y-4 text-xs">
              <div>
                <label className="block font-black text-white/60 uppercase tracking-wider mb-1">
                  NOMBRE DE LA CATEGORÍA *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ej. Cuadernos y Libretas"
                  className="w-full p-2.5 bg-[#141414] border border-white/10 rounded-lg text-white uppercase placeholder:text-white/30 focus:border-[#dc2626] focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-black text-white/60 uppercase tracking-wider mb-1">
                  SLUG URL (OPCIONAL)
                </label>
                <input
                  type="text"
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                  placeholder="cuadernos-y-libretas"
                  className="w-full p-2.5 bg-[#141414] border border-white/10 rounded-lg text-white placeholder:text-white/30 focus:border-[#dc2626] focus:outline-hidden font-mono"
                />
              </div>

              <div>
                <label className="block font-black text-white/60 uppercase tracking-wider mb-1">
                  DESCRIPCIÓN (OPCIONAL)
                </label>
                <textarea
                  rows={2}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Breve detalle de la categoría..."
                  className="w-full p-2.5 bg-[#141414] border border-white/10 rounded-lg text-white placeholder:text-white/30 focus:border-[#dc2626] focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-black text-white/60 uppercase tracking-wider mb-1">
                  NÚMERO DE ORDEN VISUAL
                </label>
                <input
                  type="number"
                  value={formData.sort_order}
                  onChange={(e) => setFormData({ ...formData, sort_order: parseInt(e.target.value) || 0 })}
                  className="w-full p-2.5 bg-[#141414] border border-white/10 rounded-lg text-white font-mono focus:border-[#dc2626] focus:outline-hidden"
                />
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
                  GUARDAR
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
