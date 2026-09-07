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
  Package,
  Layers,
  ShoppingBag,
  ArrowRight,
  AlertCircle,
  DollarSign,
  Calendar,
} from 'lucide-react';
import { Supplier, Product, Purchase } from '../../types';
import { useRealtime } from '../../context/RealtimeContext';
import {
  getSuppliers,
  createSupplier,
  updateSupplier,
  deleteSupplier,
} from '../../services/supplierService';
import { getPurchases, createPurchase, deletePurchase } from '../../services/purchaseService';
import { getProducts } from '../../services/productService';
import { ConfirmModal } from '../common/ConfirmModal';
import { formatCurrency } from '../../utils/currency';

export const AdminSuppliers: React.FC = () => {
  const { triggerGlobalRefresh, lastRefresh } = useRealtime();

  // Active Tab
  const [activeTab, setActiveTab] = useState<'suppliers' | 'purchases'>('suppliers');

  // Suppliers State
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isLoadingSuppliers, setIsLoadingSuppliers] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Supplier Modal State
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [supplierToDelete, setSupplierToDelete] = useState<Supplier | null>(null);

  // Supplier Form Fields
  const [formName, setFormName] = useState('');
  const [formContactPerson, setFormContactPerson] = useState('');
  const [formWebsiteUrl, setFormWebsiteUrl] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formCategory, setFormCategory] = useState('Papelería General');
  const [formNotes, setFormNotes] = useState('');
  const [formIsActive, setFormIsActive] = useState(true);
  const [isSavingSupplier, setIsSavingSupplier] = useState(false);

  // Purchases State
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [catalogProducts, setCatalogProducts] = useState<Product[]>([]);
  const [isLoadingPurchases, setIsLoadingPurchases] = useState(false);
  const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);
  const [purchaseToDelete, setPurchaseToDelete] = useState<Purchase | null>(null);
  const [isSavingPurchase, setIsSavingPurchase] = useState(false);

  // New Purchase Form Fields
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
  const [purchaseNotes, setPurchaseNotes] = useState('');
  const [purchaseItems, setPurchaseItems] = useState<
    Array<{
      product_id: string;
      product_name: string;
      quantity: number;
      cost_price: number;
    }>
  >([]);

  useEffect(() => {
    loadSuppliers();
    if (activeTab === 'purchases') {
      loadPurchasesAndCatalog();
    }
  }, [lastRefresh, activeTab]);

  const loadSuppliers = async () => {
    setIsLoadingSuppliers(true);
    try {
      const data = await getSuppliers(true);
      setSuppliers(data);
    } catch (err) {
      console.error('Error al cargar proveedores:', err);
    } finally {
      setIsLoadingSuppliers(false);
    }
  };

  const loadPurchasesAndCatalog = async () => {
    setIsLoadingPurchases(true);
    try {
      const [purchData, prodData] = await Promise.all([
        getPurchases(),
        getProducts(true),
      ]);
      setPurchases(purchData);
      setCatalogProducts(prodData);
    } catch (err) {
      console.error('Error al cargar compras y catálogo:', err);
    } finally {
      setIsLoadingPurchases(false);
    }
  };

  // Supplier handlers
  const handleOpenCreateSupplier = () => {
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
    setIsSupplierModalOpen(true);
  };

  const handleOpenEditSupplier = (sup: Supplier) => {
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
    setIsSupplierModalOpen(true);
  };

  const handleSaveSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      alert('Por favor introduce el nombre del proveedor o empresa.');
      return;
    }

    setIsSavingSupplier(true);
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

      setIsSupplierModalOpen(false);
      await loadSuppliers();
      triggerGlobalRefresh();
    } catch (err: any) {
      alert(`Error al guardar proveedor: ${err.message}`);
    } finally {
      setIsSavingSupplier(false);
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

  const executeDeleteSupplier = async () => {
    if (!supplierToDelete) return;
    try {
      await deleteSupplier(supplierToDelete.id);
      setSuppliers((prev) => prev.filter((s) => s.id !== supplierToDelete.id));
      triggerGlobalRefresh();
      setSupplierToDelete(null);
    } catch (err: any) {
      alert(`Error al eliminar proveedor: ${err.message}`);
    }
  };

  // Purchase handlers
  const handleOpenCreatePurchase = async () => {
    if (catalogProducts.length === 0) {
      const prods = await getProducts(true);
      setCatalogProducts(prods);
    }
    setSelectedSupplierId(suppliers[0]?.id || '');
    setPurchaseNotes('');
    setPurchaseItems([
      {
        product_id: catalogProducts[0]?.id || '',
        product_name: catalogProducts[0]?.name || '',
        quantity: 10,
        cost_price: catalogProducts[0]?.cost_price || 0,
      },
    ]);
    setIsPurchaseModalOpen(true);
  };

  const handleAddPurchaseItem = () => {
    const firstProd = catalogProducts[0];
    if (!firstProd) return;
    setPurchaseItems((prev) => [
      ...prev,
      {
        product_id: firstProd.id,
        product_name: firstProd.name,
        quantity: 1,
        cost_price: Number(firstProd.cost_price) || 0,
      },
    ]);
  };

  const handleRemovePurchaseItem = (index: number) => {
    setPurchaseItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleProductSelectChange = (index: number, productId: string) => {
    const prod = catalogProducts.find((p) => p.id === productId);
    if (!prod) return;
    setPurchaseItems((prev) =>
      prev.map((item, i) =>
        i === index
          ? {
              ...item,
              product_id: prod.id,
              product_name: prod.name,
              cost_price: Number(prod.cost_price) || 0,
            }
          : item
      )
    );
  };

  const handleItemQtyChange = (index: number, qty: number) => {
    setPurchaseItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, quantity: Math.max(1, qty) } : item))
    );
  };

  const handleItemCostChange = (index: number, cost: number) => {
    setPurchaseItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, cost_price: Math.max(0, cost) } : item))
    );
  };

  const calculatePurchaseTotal = () => {
    return purchaseItems.reduce((sum, it) => sum + it.quantity * it.cost_price, 0);
  };

  const handleSavePurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (purchaseItems.length === 0) {
      alert('Agrega al menos un artículo a la compra.');
      return;
    }

    setIsSavingPurchase(true);
    try {
      const chosenSup = suppliers.find((s) => s.id === selectedSupplierId);
      await createPurchase({
        supplier_id: selectedSupplierId || null,
        supplier_name: chosenSup?.name || 'Proveedor General',
        items: purchaseItems,
        notes: purchaseNotes.trim() || null,
        created_by: 'Administración BIKIE',
      });

      alert('¡Compra registrada con éxito! El inventario de los productos se actualizó automáticamente.');
      setIsPurchaseModalOpen(false);
      await loadPurchasesAndCatalog();
      triggerGlobalRefresh();
    } catch (err: any) {
      alert(`Error al registrar compra: ${err.message}`);
    } finally {
      setIsSavingPurchase(false);
    }
  };

  const executeDeletePurchase = async () => {
    if (!purchaseToDelete) return;
    try {
      await deletePurchase(purchaseToDelete.id);
      setPurchases((prev) => prev.filter((p) => p.id !== purchaseToDelete.id));
      triggerGlobalRefresh();
      setPurchaseToDelete(null);
    } catch (err: any) {
      alert(`Error al eliminar registro de compra: ${err.message}`);
    }
  };

  const filteredSuppliers = suppliers.filter((sup) => {
    const matchesCategory = selectedCategory === 'all' || sup.category === selectedCategory;
    const q = searchQuery.toLowerCase();
    return (
      matchesCategory &&
      (sup.name.toLowerCase().includes(q) ||
        (sup.contact_person && sup.contact_person.toLowerCase().includes(q)) ||
        (sup.category && sup.category.toLowerCase().includes(q)) ||
        (sup.email && sup.email.toLowerCase().includes(q)) ||
        (sup.phone && sup.phone.toLowerCase().includes(q)))
    );
  });

  const categories = Array.from(
    new Set(suppliers.map((s) => s.category).filter(Boolean))
  ) as string[];

  return (
    <div className="space-y-6 text-white font-mono">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 bg-[#0f0f0f] border border-white/10 rounded-xl shadow-lg">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 bg-[#dc2626] rounded-full accent-glow"></span>
            <span className="text-[10px] font-black uppercase tracking-[0.25em] text-white/50">
              MÓDULO DE ABASTECIMIENTO
            </span>
          </div>
          <h2 className="text-2xl font-black uppercase tracking-tight font-display text-white mt-1">
            PROVEEDORES Y COMPRAS
          </h2>
          <p className="text-xs text-white/50 font-sans mt-0.5">
            Gestión de catálogo mayorista, albaranes de compra y entrada automática a inventario.
          </p>
        </div>

        {/* Tab switcher buttons */}
        <div className="flex items-center gap-2 bg-[#141414] p-1.5 rounded-lg border border-white/10">
          <button
            onClick={() => setActiveTab('suppliers')}
            className={`px-3.5 py-2 rounded-md text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'suppliers'
                ? 'bg-[#dc2626] text-white shadow-md'
                : 'text-white/60 hover:text-white'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>Proveedores ({suppliers.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('purchases')}
            className={`px-3.5 py-2 rounded-md text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'purchases'
                ? 'bg-[#dc2626] text-white shadow-md'
                : 'text-white/60 hover:text-white'
            }`}
          >
            <Package className="w-3.5 h-3.5" />
            <span>Compras & Albaranes</span>
          </button>
        </div>
      </div>

      {/* TAB 1: PROVEEDORES */}
      {activeTab === 'suppliers' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar proveedor, contacto, teléfono..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#141414] border border-white/15 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-white/40 focus:border-[#dc2626] focus:outline-hidden"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button
                onClick={handleOpenCreateSupplier}
                className="py-2.5 px-4 bg-[#dc2626] hover:bg-[#b91c1c] text-white rounded-lg font-black text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg accent-glow transition-all cursor-pointer shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>NUEVO PROVEEDOR</span>
              </button>
            </div>
          </div>

          {/* Category Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
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
                {cat} ({suppliers.filter((s) => s.category === cat).length})
              </button>
            ))}
          </div>

          {/* Suppliers Grid */}
          {isLoadingSuppliers ? (
            <div className="py-20 text-center text-white/40 text-xs">
              <div className="w-6 h-6 border-2 border-[#dc2626] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <span>CARGANDO PROVEEDORES...</span>
            </div>
          ) : filteredSuppliers.length === 0 ? (
            <div className="p-12 text-center bg-[#0d0d0d] border border-white/10 rounded-xl text-white/40">
              <Building2 className="w-8 h-8 mx-auto mb-2 text-white/20" />
              <p className="text-sm font-bold">No se encontraron proveedores</p>
              <p className="text-xs text-white/30 mt-1 font-sans">
                Registra a tus mayoristas de cuadernos, bolígrafos y papelería para controlar pedidos.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredSuppliers.map((sup) => (
                <div
                  key={sup.id}
                  className="bg-[#0d0d0d] border border-white/10 hover:border-white/25 rounded-xl p-5 flex flex-col justify-between transition-all"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#ef4444] bg-red-950/40 border border-red-900/40 px-2 py-0.5 rounded">
                          {sup.category || 'Papelería'}
                        </span>
                        <h3 className="text-base font-black text-white mt-1.5">{sup.name}</h3>
                      </div>
                      <button
                        onClick={() => handleToggleStatus(sup)}
                        title={sup.is_active ? 'Desactivar' : 'Activar'}
                        className={`text-xs px-2 py-1 rounded font-bold cursor-pointer transition-colors ${
                          sup.is_active
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                            : 'bg-red-500/15 text-[#ef4444] border border-red-500/30'
                        }`}
                      >
                        {sup.is_active ? 'ACTIVO' : 'INACTIVO'}
                      </button>
                    </div>

                    {sup.contact_person && (
                      <p className="text-xs text-white/70 flex items-center gap-1.5 font-sans">
                        <Building2 className="w-3.5 h-3.5 text-white/40 shrink-0" />
                        <span>{sup.contact_person}</span>
                      </p>
                    )}

                    {sup.phone && (
                      <p className="text-xs text-white/70 flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5 text-white/40 shrink-0" />
                        <a href={`tel:${sup.phone}`} className="hover:text-white underline">
                          {sup.phone}
                        </a>
                      </p>
                    )}

                    {sup.email && (
                      <p className="text-xs text-white/70 flex items-center gap-1.5 font-sans">
                        <Mail className="w-3.5 h-3.5 text-white/40 shrink-0" />
                        <a href={`mailto:${sup.email}`} className="hover:text-white truncate">
                          {sup.email}
                        </a>
                      </p>
                    )}

                    {sup.address && (
                      <p className="text-[11px] text-white/50 flex items-start gap-1.5 font-sans">
                        <MapPin className="w-3.5 h-3.5 text-white/40 shrink-0 mt-0.5" />
                        <span className="line-clamp-2">{sup.address}</span>
                      </p>
                    )}

                    {sup.notes && (
                      <p className="text-[11px] text-white/40 italic line-clamp-2 bg-white/5 p-2 rounded border border-white/5 font-sans">
                        "{sup.notes}"
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-4 mt-4 border-t border-white/10">
                    <div className="flex items-center gap-2">
                      {sup.website_url && (
                        <a
                          href={sup.website_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 bg-white/5 hover:bg-white/10 text-white/70 hover:text-white rounded border border-white/10 transition-colors"
                          title="Visitar sitio web / catálogo online"
                        >
                          <Globe className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleOpenEditSupplier(sup)}
                        className="p-1.5 bg-white/5 hover:bg-white/10 text-white/70 hover:text-white rounded border border-white/10 transition-colors cursor-pointer"
                        title="Editar proveedor"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setSupplierToDelete(sup)}
                        className="p-1.5 bg-red-950/30 hover:bg-red-900/50 text-[#ef4444] rounded border border-red-900/40 transition-colors cursor-pointer"
                        title="Eliminar proveedor"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: COMPRAS & ENTRADAS */}
      {activeTab === 'purchases' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-[#0d0d0d] p-4 rounded-xl border border-white/10">
            <div>
              <h3 className="text-base font-black text-white uppercase tracking-tight">
                HISTORIAL DE COMPRAS A PROVEEDOR
              </h3>
              <p className="text-[10px] text-white/40 uppercase tracking-widest">
                CADA COMPRA INCREMENTA AUTOMÁTICAMENTE EL STOCK EN EL KARDEX
              </p>
            </div>

            <button
              onClick={handleOpenCreatePurchase}
              className="py-2.5 px-4 bg-[#dc2626] hover:bg-[#b91c1c] text-white rounded-lg font-black text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg accent-glow transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>REGISTRAR COMPRA / ENTRADA</span>
            </button>
          </div>

          {isLoadingPurchases ? (
            <div className="py-20 text-center text-white/40 text-xs">
              <div className="w-6 h-6 border-2 border-[#dc2626] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <span>CARGANDO HISTORIAL DE COMPRAS...</span>
            </div>
          ) : purchases.length === 0 ? (
            <div className="p-12 text-center bg-[#0d0d0d] border border-white/10 rounded-xl text-white/40">
              <Package className="w-8 h-8 mx-auto mb-2 text-white/20" />
              <p className="text-sm font-bold">No hay compras registradas</p>
              <p className="text-xs text-white/30 mt-1 font-sans">
                Registra la recepción de mercancía para abastecer tu stock y llevar el control de costes.
              </p>
            </div>
          ) : (
            <div className="bg-[#0d0d0d] border border-white/10 rounded-xl overflow-hidden shadow-md">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="text-white/40 font-bold uppercase text-[10px] tracking-widest border-b border-white/10 bg-[#141414]">
                      <th className="py-3 px-4">FECHA / N° COMPRA</th>
                      <th className="py-3 px-4">PROVEEDOR</th>
                      <th className="py-3 px-4">ARTÍCULOS RECIBIDOS</th>
                      <th className="py-3 px-4 text-right">TOTAL COMPRA</th>
                      <th className="py-3 px-4 text-center">ESTADO</th>
                      <th className="py-3 px-4 text-right">ACCIÓN</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {purchases.map((purch) => (
                      <tr key={purch.id} className="hover:bg-white/5 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-black text-[#ef4444]">{purch.purchase_number}</div>
                          <div className="text-[10px] text-white/40">
                            {new Date(purch.created_at).toLocaleString('es-ES')}
                          </div>
                        </td>
                        <td className="py-3 px-4 font-bold text-white">
                          {purch.supplier_name || purch.supplier?.name || 'Proveedor General'}
                        </td>
                        <td className="py-3 px-4">
                          <div className="space-y-0.5">
                            {(purch.items || []).slice(0, 3).map((it, idx) => (
                              <div key={idx} className="text-[11px] text-white/70">
                                • {it.quantity}x {it.product_name || 'Ítem'} ({formatCurrency(it.cost_price)})
                              </div>
                            ))}
                            {(purch.items || []).length > 3 && (
                              <div className="text-[10px] text-white/40">
                                + {(purch.items || []).length - 3} artículos más
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right font-black text-white font-mono">
                          {formatCurrency(purch.total_amount)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 uppercase">
                            RECIBIDO EN STOCK
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => setPurchaseToDelete(purch)}
                            className="p-1.5 text-white/40 hover:text-[#ef4444] hover:bg-red-950/30 rounded transition-colors cursor-pointer"
                            title="Eliminar compra"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODAL CREAR / EDITAR PROVEEDOR */}
      {isSupplierModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="bg-[#0d0d0d] border border-white/15 rounded-xl max-w-lg w-full p-6 text-white relative shadow-2xl animate-in zoom-in-95">
            <button
              onClick={() => setIsSupplierModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 text-white/40 hover:text-white rounded-lg hover:bg-white/10"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="text-lg font-black uppercase tracking-tight mb-4">
              {editingSupplier ? 'Editar Proveedor' : 'Nuevo Proveedor Mayorista'}
            </h3>

            <form onSubmit={handleSaveSupplier} className="space-y-3 text-xs">
              <div>
                <label className="block text-white/60 font-bold mb-1">Nombre de la Empresa *</label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Ej: Distribuidora Escolar del Litoral"
                  className="w-full bg-[#141414] border border-white/15 rounded-lg px-3 py-2 text-white placeholder-white/30 focus:outline-hidden focus:border-[#dc2626]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-white/60 font-bold mb-1">Persona de Contacto</label>
                  <input
                    type="text"
                    value={formContactPerson}
                    onChange={(e) => setFormContactPerson(e.target.value)}
                    placeholder="Ej: Juan Obiang"
                    className="w-full bg-[#141414] border border-white/15 rounded-lg px-3 py-2 text-white placeholder-white/30 focus:outline-hidden focus:border-[#dc2626]"
                  />
                </div>
                <div>
                  <label className="block text-white/60 font-bold mb-1">Categoría</label>
                  <input
                    type="text"
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    placeholder="Ej: Cuadernos y Papelería"
                    className="w-full bg-[#141414] border border-white/15 rounded-lg px-3 py-2 text-white placeholder-white/30 focus:outline-hidden focus:border-[#dc2626]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-white/60 font-bold mb-1">Teléfono / WhatsApp</label>
                  <input
                    type="text"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    placeholder="+240 222 123456"
                    className="w-full bg-[#141414] border border-white/15 rounded-lg px-3 py-2 text-white placeholder-white/30 focus:outline-hidden focus:border-[#dc2626]"
                  />
                </div>
                <div>
                  <label className="block text-white/60 font-bold mb-1">Correo Electrónico</label>
                  <input
                    type="email"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    placeholder="ventas@proveedor.com"
                    className="w-full bg-[#141414] border border-white/15 rounded-lg px-3 py-2 text-white placeholder-white/30 focus:outline-hidden focus:border-[#dc2626]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-white/60 font-bold mb-1">Dirección / Almacén</label>
                <input
                  type="text"
                  value={formAddress}
                  onChange={(e) => setFormAddress(e.target.value)}
                  placeholder="Calle o zona comercial..."
                  className="w-full bg-[#141414] border border-white/15 rounded-lg px-3 py-2 text-white placeholder-white/30 focus:outline-hidden focus:border-[#dc2626]"
                />
              </div>

              <div>
                <label className="block text-white/60 font-bold mb-1">Catálogo Online / Enlace de Pedido</label>
                <input
                  type="url"
                  value={formWebsiteUrl}
                  onChange={(e) => setFormWebsiteUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full bg-[#141414] border border-white/15 rounded-lg px-3 py-2 text-white placeholder-white/30 focus:outline-hidden focus:border-[#dc2626]"
                />
              </div>

              <div>
                <label className="block text-white/60 font-bold mb-1">Notas / Días de Entrega</label>
                <textarea
                  rows={2}
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Observaciones de pago, crédito o tiempos de entrega..."
                  className="w-full bg-[#141414] border border-white/15 rounded-lg px-3 py-2 text-white placeholder-white/30 focus:outline-hidden focus:border-[#dc2626]"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="chk-sup-active"
                  checked={formIsActive}
                  onChange={(e) => setFormIsActive(e.target.checked)}
                  className="w-4 h-4 accent-[#dc2626]"
                />
                <label htmlFor="chk-sup-active" className="text-white/80 font-bold cursor-pointer">
                  Proveedor Activo
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsSupplierModalOpen(false)}
                  className="px-4 py-2 bg-[#1a1a1a] hover:bg-white/10 text-white rounded-lg font-black uppercase tracking-wider text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingSupplier}
                  className="px-5 py-2 bg-[#dc2626] hover:bg-[#ef4444] text-white rounded-lg font-black uppercase tracking-wider text-xs accent-glow"
                >
                  {isSavingSupplier ? 'Guardando...' : editingSupplier ? 'Actualizar' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL REGISTRAR COMPRA / ENTRADA DE STOCK */}
      {isPurchaseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xs">
          <div className="bg-[#0d0d0d] border border-white/15 rounded-xl max-w-2xl w-full p-6 text-white relative shadow-2xl max-h-[90vh] flex flex-col">
            <button
              onClick={() => setIsPurchaseModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 text-white/40 hover:text-white rounded-lg hover:bg-white/10"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="mb-4">
              <h3 className="text-lg font-black uppercase tracking-tight flex items-center gap-2">
                <Package className="w-5 h-5 text-[#ef4444]" />
                <span>Registrar Entrada de Mercancía / Compra</span>
              </h3>
              <p className="text-[10px] text-white/40 uppercase tracking-widest mt-0.5">
                EL STOCK DE LOS PRODUCTOS SE ACTUALIZARÁ AUTOMÁTICAMENTE
              </p>
            </div>

            <form onSubmit={handleSavePurchase} className="space-y-4 text-xs flex-1 overflow-y-auto pr-1">
              {/* Supplier Selection */}
              <div>
                <label className="block text-white/60 font-bold mb-1 uppercase tracking-wider text-[10px]">
                  Proveedor
                </label>
                <select
                  value={selectedSupplierId}
                  onChange={(e) => setSelectedSupplierId(e.target.value)}
                  className="w-full bg-[#141414] border border-white/15 rounded-lg px-3 py-2 text-white font-mono focus:outline-hidden focus:border-[#dc2626]"
                >
                  <option value="">-- Proveedor General / Mostrador --</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.category})
                    </option>
                  ))}
                </select>
              </div>

              {/* Items Table */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-white/60 font-bold uppercase tracking-wider text-[10px]">
                    Productos y Cantidades a Recibir
                  </label>
                  <button
                    type="button"
                    onClick={handleAddPurchaseItem}
                    className="px-2.5 py-1 bg-white/10 hover:bg-white/20 text-white rounded text-[10px] font-black uppercase flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Agregar Ítem</span>
                  </button>
                </div>

                <div className="space-y-2 max-h-60 overflow-y-auto divide-y divide-white/5 border border-white/10 rounded-lg p-2 bg-[#141414]">
                  {purchaseItems.map((item, idx) => (
                    <div key={idx} className="pt-2 first:pt-0 flex items-center gap-2">
                      <div className="flex-1">
                        <select
                          value={item.product_id}
                          onChange={(e) => handleProductSelectChange(idx, e.target.value)}
                          className="w-full bg-[#0d0d0d] border border-white/10 rounded px-2.5 py-1.5 text-xs text-white"
                        >
                          {catalogProducts.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} (Stock act: {p.stock})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="w-20">
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => handleItemQtyChange(idx, Number(e.target.value))}
                          placeholder="Cant."
                          className="w-full bg-[#0d0d0d] border border-white/10 rounded px-2 py-1.5 text-xs text-white text-center font-mono"
                        />
                      </div>

                      <div className="w-28">
                        <input
                          type="number"
                          min="0"
                          value={item.cost_price}
                          onChange={(e) => handleItemCostChange(idx, Number(e.target.value))}
                          placeholder="Coste XAF"
                          className="w-full bg-[#0d0d0d] border border-white/10 rounded px-2 py-1.5 text-xs text-white text-right font-mono"
                        />
                      </div>

                      <div className="w-24 text-right font-mono font-bold text-white text-xs">
                        {formatCurrency(item.quantity * item.cost_price)}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemovePurchaseItem(idx)}
                        disabled={purchaseItems.length <= 1}
                        className="p-1.5 text-white/30 hover:text-[#ef4444] disabled:opacity-20 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Total Summary */}
              <div className="bg-[#141414] p-3 rounded-lg border border-white/10 flex items-center justify-between">
                <span className="text-[11px] font-bold text-white/60 uppercase">
                  TOTAL DE LA COMPRA (XAF):
                </span>
                <span className="text-base font-black text-[#ef4444] font-mono">
                  {formatCurrency(calculatePurchaseTotal())}
                </span>
              </div>

              {/* Notes / Albarán */}
              <div>
                <label className="block text-white/60 font-bold mb-1 uppercase tracking-wider text-[10px]">
                  Notas / N° de Albarán o Factura del Proveedor
                </label>
                <input
                  type="text"
                  value={purchaseNotes}
                  onChange={(e) => setPurchaseNotes(e.target.value)}
                  placeholder="Ej: Factura Nº 8492 de Distribuidora Litoral"
                  className="w-full bg-[#141414] border border-white/15 rounded-lg px-3 py-2 text-white placeholder-white/30 focus:outline-hidden focus:border-[#dc2626]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsPurchaseModalOpen(false)}
                  className="px-4 py-2 bg-[#1a1a1a] hover:bg-white/10 text-white rounded-lg font-black uppercase tracking-wider text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingPurchase}
                  className="px-5 py-2 bg-[#dc2626] hover:bg-[#ef4444] text-white rounded-lg font-black uppercase tracking-wider text-xs accent-glow flex items-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{isSavingPurchase ? 'REGISTRANDO...' : 'REGISTRAR Y SUMAR A STOCK'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFIRM MODAL PROVEEDOR */}
      <ConfirmModal
        isOpen={Boolean(supplierToDelete)}
        onClose={() => setSupplierToDelete(null)}
        onConfirm={executeDeleteSupplier}
        title="¿Eliminar este proveedor?"
        message={`Estás a punto de borrar permanentemente al proveedor "${supplierToDelete?.name}".`}
        warningNote="Esta acción puede ser irreversible si no tiene compras vinculadas."
        confirmLabel="Eliminar Proveedor"
        cancelLabel="Cancelar"
        isDestructive={true}
      />

      {/* CONFIRM MODAL COMPRA */}
      <ConfirmModal
        isOpen={Boolean(purchaseToDelete)}
        onClose={() => setPurchaseToDelete(null)}
        onConfirm={executeDeletePurchase}
        title="¿Eliminar este registro de compra?"
        message={`Estás a punto de borrar el registro de compra ${purchaseToDelete?.purchase_number} por un importe de ${formatCurrency(purchaseToDelete?.total_amount || 0)}.`}
        warningNote="Esta acción borrará el comprobante de compra."
        confirmLabel="Eliminar Compra"
        cancelLabel="Cancelar"
        isDestructive={true}
      />
    </div>
  );
};
