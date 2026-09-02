import React, { useState, useEffect } from 'react';
import {
  FileText,
  Plus,
  Search,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  Coffee,
  Copy,
  Printer,
  FileCheck,
  Shield,
  Layers,
  Sparkles,
  X,
  Check,
  Zap,
} from 'lucide-react';
import { AdditionalService, ServiceCategory } from '../../types';
import {
  getAdditionalServices,
  createAdditionalService,
  updateAdditionalService,
  deleteAdditionalService,
} from '../../services/serviceManager';
import { formatCurrency, parseCurrencyInput } from '../../utils/currency';

interface AdminServicesProps {
  onSelectServiceForPos?: (service: AdditionalService) => void;
}

export const AdminServices: React.FC<AdminServicesProps> = ({ onSelectServiceForPos }) => {
  const [services, setServices] = useState<AdditionalService[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<AdditionalService | null>(null);

  // Form Fields
  const [formCode, setFormCode] = useState('');
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState<string>('copias');
  const [formPrice, setFormPrice] = useState<string>('100');
  const [formUnitLabel, setFormUnitLabel] = useState('por servicio');
  const [formDescription, setFormDescription] = useState('');
  const [formIsActive, setFormIsActive] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadServices();
  }, []);

  const loadServices = async () => {
    setIsLoading(true);
    try {
      const data = await getAdditionalServices(true);
      setServices(data);
    } catch (err) {
      console.error('Error loading services:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenCreateModal = () => {
    setEditingService(null);
    setFormCode(`SRV-${Math.floor(100 + Math.random() * 900)}`);
    setFormName('');
    setFormCategory('copias');
    setFormPrice('100');
    setFormUnitLabel('por página');
    setFormDescription('');
    setFormIsActive(true);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (srv: AdditionalService) => {
    setEditingService(srv);
    setFormCode(srv.code);
    setFormName(srv.name);
    setFormCategory(srv.category);
    setFormPrice(String(srv.price));
    setFormUnitLabel(srv.unit_label || 'por servicio');
    setFormDescription(srv.description || '');
    setFormIsActive(srv.is_active);
    setIsModalOpen(true);
  };

  const handleSaveService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      alert('Por favor introduce el nombre del servicio.');
      return;
    }

    const priceNum = parseCurrencyInput(formPrice);
    if (priceNum < 0) {
      alert('El precio debe ser un número válido igual o mayor a cero.');
      return;
    }

    setIsSaving(true);
    try {
      if (editingService) {
        await updateAdditionalService(editingService.id, {
          code: formCode.trim(),
          name: formName.trim(),
          category: formCategory,
          price: priceNum,
          unit_label: formUnitLabel.trim() || 'por servicio',
          description: formDescription.trim() || null,
          is_active: formIsActive,
        });
      } else {
        await createAdditionalService({
          code: formCode.trim(),
          name: formName.trim(),
          category: formCategory,
          price: priceNum,
          unit_label: formUnitLabel.trim() || 'por servicio',
          description: formDescription.trim() || null,
          is_active: formIsActive,
        });
      }

      setIsModalOpen(false);
      await loadServices();
    } catch (err: any) {
      alert(`Error al guardar servicio: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleStatus = async (srv: AdditionalService) => {
    try {
      await updateAdditionalService(srv.id, { is_active: !srv.is_active });
      setServices((prev) =>
        prev.map((s) => (s.id === srv.id ? { ...s, is_active: !s.is_active } : s))
      );
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  const handleDelete = async (srv: AdditionalService) => {
    if (confirm(`¿Estás seguro de eliminar el servicio "${srv.name}"?`)) {
      try {
        await deleteAdditionalService(srv.id);
        setServices((prev) => prev.filter((s) => s.id !== srv.id));
      } catch (err: any) {
        alert(`Error al eliminar: ${err.message}`);
      }
    }
  };

  const getCategoryIcon = (cat: string) => {
    switch (cat.toLowerCase()) {
      case 'copias':
        return <Copy className="w-4 h-4 text-[#ef4444]" />;
      case 'impresiones':
        return <Printer className="w-4 h-4 text-rose-400" />;
      case 'redaccion':
        return <FileCheck className="w-4 h-4 text-emerald-400" />;
      case 'plastificado':
        return <Shield className="w-4 h-4 text-amber-400" />;
      case 'encuadernacion':
        return <Layers className="w-4 h-4 text-blue-400" />;
      case 'bebidas':
        return <Coffee className="w-4 h-4 text-orange-400" />;
      default:
        return <FileText className="w-4 h-4 text-white/60" />;
    }
  };

  const filteredServices = services.filter((srv) => {
    const matchesCategory = selectedCategory === 'all' || srv.category === selectedCategory;
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      srv.name.toLowerCase().includes(q) ||
      srv.code.toLowerCase().includes(q) ||
      (srv.description && srv.description.toLowerCase().includes(q));
    return matchesCategory && matchesSearch;
  });

  const categoriesList = [
    { id: 'all', label: 'Todos los Servicios' },
    { id: 'copias', label: 'Copias & Fotocopiado' },
    { id: 'impresiones', label: 'Impresiones' },
    { id: 'redaccion', label: 'Redacción & CV' },
    { id: 'plastificado', label: 'Plastificado' },
    { id: 'encuadernacion', label: 'Encuadernación' },
    { id: 'bebidas', label: 'Bebidas & Cafetería' },
    { id: 'digitalizacion', label: 'Escaneo & Digitalización' },
    { id: 'otros', label: 'Otros Servicios' },
  ];

  return (
    <div className="space-y-6 text-white">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 bg-[#0f0f0f] border border-white/10 rounded-xl">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 bg-[#dc2626] rounded-full accent-glow"></span>
            <span className="text-[10px] font-black uppercase tracking-[0.25em] text-white/50 font-mono">
              GESTIÓN DE SERVICIOS
            </span>
          </div>
          <h2 className="text-2xl font-black uppercase tracking-tight font-display text-white mt-1">
            Servicios Adicionales (POS & Tarifa)
          </h2>
          <p className="text-xs text-white/50 font-medium mt-0.5">
            Administra fotocopias, impresiones, redacción de documentos, plastificado, bebidas y más.
          </p>
        </div>

        <button
          id="btn-create-service"
          onClick={handleOpenCreateModal}
          className="py-2.5 px-4 bg-[#dc2626] hover:bg-[#b91c1c] text-white rounded-lg font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg accent-glow transition-all cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Nuevo Servicio</span>
        </button>
      </div>

      {/* Filters and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por nombre, código o descripción..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#141414] border border-white/15 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-white/40 focus:border-[#dc2626] focus:outline-none font-mono"
          />
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1">
          {categoriesList.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                selectedCategory === cat.id
                  ? 'bg-[#dc2626] text-white shadow-md'
                  : 'bg-white/5 hover:bg-white/10 text-white/60 hover:text-white border border-white/10'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Services Table */}
      <div className="bg-[#0f0f0f] border border-white/10 rounded-xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-black/50 border-b border-white/10 text-white/40 uppercase font-mono font-bold text-[10px] tracking-wider">
                <th className="py-3 px-4">Código</th>
                <th className="py-3 px-4">Servicio</th>
                <th className="py-3 px-4">Categoría</th>
                <th className="py-3 px-4 text-right">Tarifa (XAF)</th>
                <th className="py-3 px-4">Unidad</th>
                <th className="py-3 px-4 text-center">Estado</th>
                <th className="py-3 px-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-white/40 font-mono">
                    Cargando catálogo de servicios...
                  </td>
                </tr>
              ) : filteredServices.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-white/40 font-mono">
                    No se encontraron servicios que coincidan con la búsqueda.
                  </td>
                </tr>
              ) : (
                filteredServices.map((srv) => (
                  <tr key={srv.id} className="hover:bg-white/5 transition-colors">
                    <td className="py-3 px-4 font-mono text-white/70 font-bold">{srv.code}</td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-white text-sm">{srv.name}</div>
                      {srv.description && (
                        <div className="text-[11px] text-white/50 line-clamp-1 mt-0.5">
                          {srv.description}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5 uppercase font-mono text-[11px] font-bold text-white/70">
                        {getCategoryIcon(srv.category)}
                        <span>{srv.category}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-black text-sm text-[#ef4444]">
                      {formatCurrency(srv.price)}
                    </td>
                    <td className="py-3 px-4 text-white/60 font-mono text-[11px]">
                      {srv.unit_label || 'por unidad'}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => handleToggleStatus(srv)}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider cursor-pointer ${
                          srv.is_active
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : 'bg-white/10 text-white/40 border border-white/10'
                        }`}
                      >
                        {srv.is_active ? (
                          <>
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Activo</span>
                          </>
                        ) : (
                          <>
                            <XCircle className="w-3 h-3" />
                            <span>Inactivo</span>
                          </>
                        )}
                      </button>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenEditModal(srv)}
                          className="p-1.5 rounded bg-white/5 hover:bg-white/15 text-white/70 hover:text-white transition-colors cursor-pointer"
                          title="Editar Servicio"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(srv)}
                          className="p-1.5 rounded bg-white/5 hover:bg-[#dc2626]/20 text-white/40 hover:text-[#ef4444] transition-colors cursor-pointer"
                          title="Eliminar Servicio"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
          <div className="relative w-full max-w-lg bg-[#0d0d0d] border border-white/20 rounded-2xl shadow-2xl overflow-hidden flex flex-col text-white">
            <div className="bg-[#dc2626] px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-white" />
                <h3 className="text-base font-black uppercase tracking-tight font-display text-white">
                  {editingService ? 'Modificar Servicio' : 'Nuevo Servicio Adicional'}
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg bg-black/20 hover:bg-black/40 text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveService} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-white/70 font-bold uppercase tracking-wider text-[10px] mb-1">
                    Código Interno
                  </label>
                  <input
                    type="text"
                    required
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value)}
                    className="w-full bg-[#141414] border border-white/15 rounded-lg p-2.5 text-white font-mono uppercase focus:border-[#dc2626] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-white/70 font-bold uppercase tracking-wider text-[10px] mb-1">
                    Categoría
                  </label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full bg-[#141414] border border-white/15 rounded-lg p-2.5 text-white focus:border-[#dc2626] focus:outline-none"
                  >
                    <option value="copias">Copias & Fotocopias</option>
                    <option value="impresiones">Impresiones</option>
                    <option value="redaccion">Redacción (CV, Contratos)</option>
                    <option value="plastificado">Plastificado</option>
                    <option value="encuadernacion">Encuadernación</option>
                    <option value="bebidas">Bebidas & Cafetería</option>
                    <option value="digitalizacion">Digitalización & Escaneo</option>
                    <option value="otros">Otros</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-white/70 font-bold uppercase tracking-wider text-[10px] mb-1">
                  Nombre del Servicio *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Fotocopia B/N A4, Redacción de CV Profesional..."
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full bg-[#141414] border border-white/15 rounded-lg p-2.5 text-white font-bold text-sm focus:border-[#dc2626] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-white/70 font-bold uppercase tracking-wider text-[10px] mb-1">
                    Precio en XAF (FCFA) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    required
                    value={formPrice}
                    onChange={(e) => setFormPrice(e.target.value)}
                    className="w-full bg-[#141414] border border-white/15 rounded-lg p-2.5 text-white font-mono font-bold text-sm text-[#ef4444] focus:border-[#dc2626] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-white/70 font-bold uppercase tracking-wider text-[10px] mb-1">
                    Unidad de Cobro
                  </label>
                  <input
                    type="text"
                    placeholder="por página, por unidad, por doc..."
                    value={formUnitLabel}
                    onChange={(e) => setFormUnitLabel(e.target.value)}
                    className="w-full bg-[#141414] border border-white/15 rounded-lg p-2.5 text-white font-mono focus:border-[#dc2626] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-white/70 font-bold uppercase tracking-wider text-[10px] mb-1">
                  Descripción / Especificaciones
                </label>
                <textarea
                  rows={2}
                  placeholder="Detalles sobre papel, resolución, entrega o condiciones..."
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full bg-[#141414] border border-white/15 rounded-lg p-2.5 text-white focus:border-[#dc2626] focus:outline-none resize-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="chk-service-active"
                  checked={formIsActive}
                  onChange={(e) => setFormIsActive(e.target.checked)}
                  className="w-4 h-4 accent-[#dc2626] rounded cursor-pointer"
                />
                <label htmlFor="chk-service-active" className="text-white/80 font-bold cursor-pointer">
                  Servicio Activo y Disponible en POS
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg font-bold cursor-pointer transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 bg-[#dc2626] hover:bg-[#b91c1c] text-white rounded-lg font-bold shadow-lg accent-glow cursor-pointer transition-all flex items-center gap-2"
                >
                  {isSaving ? 'Guardando...' : editingService ? 'Actualizar Servicio' : 'Crear Servicio'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
