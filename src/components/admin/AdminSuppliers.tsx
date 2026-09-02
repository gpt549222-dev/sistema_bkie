import React, { useState, useEffect } from 'react';
import {
  Truck,
  Plus,
  Search,
  Edit2,
  Trash2,
  ExternalLink,
  Phone,
  Mail,
  MapPin,
  CheckCircle2,
  XCircle,
  Building2,
  Globe,
  FileText,
  X,
  MessageSquare,
} from 'lucide-react';
import { Supplier } from '../../types';
import { useRealtime } from '../../context/RealtimeContext';
import {
  getSuppliers,
  createSupplier,
  updateSupplier,
  deleteSupplier,
} from '../../services/supplierService';

export const AdminSuppliers: React.FC = () => {
  const { triggerGlobalRefresh, lastRefresh } = useRealtime();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);

  // Form Fields
  const [formName, setFormName] = useState('');
  const [formContactPerson, setFormContactPerson] = useState('');
  const [formWebsiteUrl, setFormWebsiteUrl] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formCategory, setFormCategory] = useState('Papelería General');
  const [formNotes, setFormNotes] = useState('');
  const [formIsActive, setFormIsActive] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadSuppliers();
  }, [lastRefresh]);

  const loadSuppliers = async () => {
    setIsLoading(true);
    try {
      const data = await getSuppliers(true);
      setSuppliers(data);
    } catch (err) {
      console.error('Error loading suppliers:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenCreateModal = () => {
    setEditingSupplier(null);
    setFormName('');
    setFormContactPerson('');
    setFormWebsiteUrl('');
    setFormPhone('');
    setFormEmail('');
    setFormAddress('');
    setFormCategory('Papelería General');
    setFormNotes('');
    setFormIsActive(true);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (sup: Supplier) => {
    setEditingSupplier(sup);
    setFormName(sup.name);
    setFormContactPerson(sup.contact_person || '');
    setFormWebsiteUrl(sup.website_url || '');
    setFormPhone(sup.phone || '');
    setFormEmail(sup.email || '');
    setFormAddress(sup.address || '');
    setFormCategory(sup.category || 'Papelería General');
    setFormNotes(sup.notes || '');
    setFormIsActive(sup.is_active);
    setIsModalOpen(true);
  };

  const handleSaveSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      alert('Por favor introduce el nombre del proveedor o empresa.');
      return;
    }

    setIsSaving(true);
    try {
      if (editingSupplier) {
        await updateSupplier(editingSupplier.id, {
          name: formName.trim(),
          contact_person: formContactPerson.trim() || null,
          website_url: formWebsiteUrl.trim() || null,
          phone: formPhone.trim() || null,
          email: formEmail.trim() || null,
          address: formAddress.trim() || null,
          category: formCategory.trim() || 'Papelería General',
          notes: formNotes.trim() || null,
          is_active: formIsActive,
        });
      } else {
        await createSupplier({
          name: formName.trim(),
          contact_person: formContactPerson.trim() || null,
          website_url: formWebsiteUrl.trim() || null,
          phone: formPhone.trim() || null,
          email: formEmail.trim() || null,
          address: formAddress.trim() || null,
          category: formCategory.trim() || 'Papelería General',
          notes: formNotes.trim() || null,
          is_active: formIsActive,
        });
      }

      setIsModalOpen(false);
      await loadSuppliers();
      triggerGlobalRefresh();
    } catch (err: any) {
      alert(`Error al guardar proveedor: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleStatus = async (sup: Supplier) => {
    try {
      await updateSupplier(sup.id, { is_active: !sup.is_active });
      setSuppliers((prev) =>
        prev.map((s) => (s.id === sup.id ? { ...s, is_active: !s.is_active } : s))
      );
      triggerGlobalRefresh();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  const handleDelete = async (sup: Supplier) => {
    if (confirm(`¿Estás seguro de eliminar permanentemente al proveedor "${sup.name}"?`)) {
      try {
        await deleteSupplier(sup.id);
        setSuppliers((prev) => prev.filter((s) => s.id !== sup.id));
        triggerGlobalRefresh();
      } catch (err: any) {
        alert(`Error al eliminar: ${err.message}`);
      }
    }
  };

  const filteredSuppliers = suppliers.filter((sup) => {
    const matchesCategory = selectedCategory === 'all' || sup.category === selectedCategory;
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      sup.name.toLowerCase().includes(q) ||
      (sup.contact_person && sup.contact_person.toLowerCase().includes(q)) ||
      (sup.category && sup.category.toLowerCase().includes(q)) ||
      (sup.email && sup.email.toLowerCase().includes(q)) ||
      (sup.phone && sup.phone.toLowerCase().includes(q));
    return matchesCategory && matchesSearch;
  });

  const categories = Array.from(
    new Set(suppliers.map((s) => s.category).filter(Boolean))
  ) as string[];

  return (
    <div className="space-y-6 text-white">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 bg-[#0f0f0f] border border-white/10 rounded-xl">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 bg-[#dc2626] rounded-full accent-glow"></span>
            <span className="text-[10px] font-black uppercase tracking-[0.25em] text-white/50 font-mono">
              DIRECTORIO DE COMPRAS
            </span>
          </div>
          <h2 className="text-2xl font-black uppercase tracking-tight font-display text-white mt-1">
            Gestión de Proveedores & Enlaces
          </h2>
          <p className="text-xs text-white/50 font-medium mt-0.5">
            Administra distribuidores mayoristas, enlaces de pedidos, teléfonos de contacto y catálogos.
          </p>
        </div>

        <button
          id="btn-create-supplier"
          onClick={handleOpenCreateModal}
          className="py-2.5 px-4 bg-[#dc2626] hover:bg-[#b91c1c] text-white rounded-lg font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg accent-glow transition-all cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Nuevo Proveedor</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar proveedor, contacto, teléfono..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#141414] border border-white/15 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-white/40 focus:border-[#dc2626] focus:outline-none font-mono"
          />
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
              selectedCategory === 'all'
                ? 'bg-[#dc2626] text-white shadow-md'
                : 'bg-white/5 hover:bg-white/10 text-white/60 hover:text-white border border-white/10'
            }`}
          >
            Todos ({suppliers.length})
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                selectedCategory === cat
                  ? 'bg-[#dc2626] text-white shadow-md'
                  : 'bg-white/5 hover:bg-white/10 text-white/60 hover:text-white border border-white/10'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Suppliers Grid / Cards */}
      {isLoading ? (
        <div className="p-12 text-center text-white/40 font-mono bg-[#0f0f0f] border border-white/10 rounded-xl">
          Cargando listado de proveedores...
        </div>
      ) : filteredSuppliers.length === 0 ? (
        <div className="p-12 text-center text-white/40 font-mono bg-[#0f0f0f] border border-white/10 rounded-xl">
          No se encontraron proveedores registrados.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredSuppliers.map((sup) => (
            <div
              key={sup.id}
              className="bg-[#0f0f0f] border border-white/10 hover:border-white/20 rounded-xl p-5 shadow-lg flex flex-col justify-between transition-all"
            >
              <div>
                {/* Card Header */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-[#dc2626]/20 text-[#ef4444] border border-[#dc2626]/30 flex items-center justify-center font-black">
                      <Building2 className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-base leading-tight">{sup.name}</h3>
                      <span className="text-[10px] bg-white/10 text-white/70 px-2 py-0.5 rounded font-mono font-bold uppercase mt-1 inline-block">
                        {sup.category || 'Papelería General'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleToggleStatus(sup)}
                      className={`p-1 px-2 rounded-full text-[10px] font-black uppercase tracking-wider cursor-pointer ${
                        sup.is_active
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : 'bg-white/10 text-white/40 border border-white/10'
                      }`}
                    >
                      {sup.is_active ? 'Activo' : 'Inactivo'}
                    </button>
                    <button
                      onClick={() => handleOpenEditModal(sup)}
                      className="p-1.5 rounded bg-white/5 hover:bg-white/15 text-white/70 hover:text-white transition-colors cursor-pointer"
                      title="Editar Proveedor"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(sup)}
                      className="p-1.5 rounded bg-white/5 hover:bg-[#dc2626]/20 text-white/40 hover:text-[#ef4444] transition-colors cursor-pointer"
                      title="Eliminar Proveedor"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Details List */}
                <div className="space-y-2 text-xs text-white/70 pt-2 border-t border-white/5">
                  {sup.contact_person && (
                    <div className="flex items-center gap-2">
                      <span className="text-white/40 text-[11px] w-20 shrink-0 font-bold uppercase">
                        Contacto:
                      </span>
                      <span className="text-white font-medium">{sup.contact_person}</span>
                    </div>
                  )}

                  {sup.phone && (
                    <div className="flex items-center gap-2">
                      <span className="text-white/40 text-[11px] w-20 shrink-0 font-bold uppercase">
                        Teléfono:
                      </span>
                      <a
                        href={`tel:${sup.phone}`}
                        className="text-white hover:text-[#ef4444] font-mono font-bold flex items-center gap-1.5"
                      >
                        <Phone className="w-3 h-3 text-[#ef4444]" />
                        {sup.phone}
                      </a>
                    </div>
                  )}

                  {sup.email && (
                    <div className="flex items-center gap-2">
                      <span className="text-white/40 text-[11px] w-20 shrink-0 font-bold uppercase">
                        Email:
                      </span>
                      <a
                        href={`mailto:${sup.email}`}
                        className="text-white hover:text-[#ef4444] font-mono flex items-center gap-1.5 truncate"
                      >
                        <Mail className="w-3 h-3 text-white/50" />
                        {sup.email}
                      </a>
                    </div>
                  )}

                  {sup.address && (
                    <div className="flex items-start gap-2">
                      <span className="text-white/40 text-[11px] w-20 shrink-0 font-bold uppercase">
                        Dirección:
                      </span>
                      <span className="text-white/80 flex items-start gap-1">
                        <MapPin className="w-3.5 h-3.5 text-white/40 shrink-0 mt-0.5" />
                        {sup.address}
                      </span>
                    </div>
                  )}

                  {sup.notes && (
                    <div className="mt-2 p-2.5 bg-black/40 border border-white/5 rounded-lg text-[11px] text-white/60">
                      <p className="line-clamp-2">💬 {sup.notes}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons: Website / Order Portal */}
              <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between gap-2">
                {sup.website_url ? (
                  <a
                    href={
                      sup.website_url.startsWith('http')
                        ? sup.website_url
                        : `https://${sup.website_url}`
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="py-1.5 px-3 bg-white/10 hover:bg-[#dc2626] text-white rounded-lg font-bold text-xs flex items-center gap-1.5 transition-colors"
                  >
                    <Globe className="w-3.5 h-3.5" />
                    <span>Abrir Enlace Web / Catálogo</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                ) : (
                  <span className="text-[11px] text-white/30 italic">Sin enlace web</span>
                )}

                {sup.phone && (
                  <a
                    href={`https://wa.me/${sup.phone.replace(/[^0-9]/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="py-1.5 px-3 bg-emerald-600/30 hover:bg-emerald-600 text-emerald-300 hover:text-white rounded-lg font-bold text-xs flex items-center gap-1.5 transition-colors"
                    title="Chatear en WhatsApp"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>WhatsApp</span>
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
          <div className="relative w-full max-w-lg bg-[#0d0d0d] border border-white/20 rounded-2xl shadow-2xl overflow-hidden flex flex-col text-white">
            <div className="bg-[#dc2626] px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Truck className="w-5 h-5 text-white" />
                <h3 className="text-base font-black uppercase tracking-tight font-display text-white">
                  {editingSupplier ? 'Modificar Proveedor' : 'Nuevo Proveedor'}
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg bg-black/20 hover:bg-black/40 text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSupplier} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block text-white/70 font-bold uppercase tracking-wider text-[10px] mb-1">
                  Nombre de la Empresa o Distribuidor *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Distribuidora Central de Papelería S.A."
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full bg-[#141414] border border-white/15 rounded-lg p-2.5 text-white font-bold text-sm focus:border-[#dc2626] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-white/70 font-bold uppercase tracking-wider text-[10px] mb-1">
                    Persona de Contacto
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: Jean-Pierre Mbarga"
                    value={formContactPerson}
                    onChange={(e) => setFormContactPerson(e.target.value)}
                    className="w-full bg-[#141414] border border-white/15 rounded-lg p-2.5 text-white focus:border-[#dc2626] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-white/70 font-bold uppercase tracking-wider text-[10px] mb-1">
                    Categoría de Suministros
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: Papelería General, Consumibles..."
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full bg-[#141414] border border-white/15 rounded-lg p-2.5 text-white focus:border-[#dc2626] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-white/70 font-bold uppercase tracking-wider text-[10px] mb-1">
                  Enlace Web / Portal de Pedidos / Catálogo
                </label>
                <input
                  type="url"
                  placeholder="https://proveedor-ejemplo.com o link de drive/catálogo"
                  value={formWebsiteUrl}
                  onChange={(e) => setFormWebsiteUrl(e.target.value)}
                  className="w-full bg-[#141414] border border-white/15 rounded-lg p-2.5 text-white font-mono focus:border-[#dc2626] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-white/70 font-bold uppercase tracking-wider text-[10px] mb-1">
                    Teléfono / WhatsApp
                  </label>
                  <input
                    type="text"
                    placeholder="+237 670 000 000"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    className="w-full bg-[#141414] border border-white/15 rounded-lg p-2.5 text-white font-mono focus:border-[#dc2626] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-white/70 font-bold uppercase tracking-wider text-[10px] mb-1">
                    Correo Electrónico
                  </label>
                  <input
                    type="email"
                    placeholder="pedidos@empresa.com"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    className="w-full bg-[#141414] border border-white/15 rounded-lg p-2.5 text-white font-mono focus:border-[#dc2626] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-white/70 font-bold uppercase tracking-wider text-[10px] mb-1">
                  Dirección Física / Ubicación
                </label>
                <input
                  type="text"
                  placeholder="Ciudad, Calle, Zona industrial o local"
                  value={formAddress}
                  onChange={(e) => setFormAddress(e.target.value)}
                  className="w-full bg-[#141414] border border-white/15 rounded-lg p-2.5 text-white focus:border-[#dc2626] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-white/70 font-bold uppercase tracking-wider text-[10px] mb-1">
                  Notas Internas (Días de entrega, condiciones, crédito)
                </label>
                <textarea
                  rows={2}
                  placeholder="Condiciones de pago a 30 días, descuento por volumen..."
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="w-full bg-[#141414] border border-white/15 rounded-lg p-2.5 text-white focus:border-[#dc2626] focus:outline-none resize-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="chk-supplier-active"
                  checked={formIsActive}
                  onChange={(e) => setFormIsActive(e.target.checked)}
                  className="w-4 h-4 accent-[#dc2626] rounded cursor-pointer"
                />
                <label htmlFor="chk-supplier-active" className="text-white/80 font-bold cursor-pointer">
                  Proveedor Activo
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
                  {isSaving ? 'Guardando...' : editingSupplier ? 'Actualizar Proveedor' : 'Guardar Proveedor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
