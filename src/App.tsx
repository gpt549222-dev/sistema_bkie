import React, { useState, useEffect } from 'react';
import { Header } from './components/common/Header';
import { HeroBanner } from './components/storefront/HeroBanner';
import { CategoryBar } from './components/storefront/CategoryBar';
import { ProductGrid } from './components/storefront/ProductGrid';
import { ProductDetailModal } from './components/storefront/ProductDetailModal';
import { CartDrawer } from './components/storefront/CartDrawer';
import { CheckoutModal } from './components/storefront/CheckoutModal';
import { OrderTrackingModal } from './components/storefront/OrderTrackingModal';
import { InvoiceViewerModal } from './components/storefront/InvoiceViewerModal';
import { ConnectionModal } from './components/common/ConnectionModal';
import { AdminLoginModal } from './components/admin/AdminLoginModal';

// Admin modules
import { AdminLayout, AdminTab } from './components/admin/AdminLayout';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { AdminOrders } from './components/admin/AdminOrders';
import { AdminPos } from './components/admin/AdminPos';
import { AdminServices } from './components/admin/AdminServices';
import { AdminSuppliers } from './components/admin/AdminSuppliers';
import { AdminInvoices } from './components/admin/AdminInvoices';
import { AdminProducts } from './components/admin/AdminProducts';
import { AdminCategories } from './components/admin/AdminCategories';
import { AdminOffers } from './components/admin/AdminOffers';
import { AdminInventory } from './components/admin/AdminInventory';
import { AdminSales } from './components/admin/AdminSales';
import { AdminNotifications } from './components/admin/AdminNotifications';
import { AdminSettings } from './components/admin/AdminSettings';
import { FloatingCalculator } from './components/common/FloatingCalculator';
import { AiListScannerModal } from './components/storefront/AiListScannerModal';

// Services & Context
import { getProducts, getCategories } from './services/productService';
import { getOffers } from './services/offerService';
import { getBusinessSettings } from './services/settingsService';
import { isConfigured } from './services/supabase';
import { useAuth } from './context/AuthContext';
import { useRealtime } from './context/RealtimeContext';
import { Product, Category, Offer, Order, Invoice, BusinessSettings } from './types';
import {
  Sparkles,
  ShoppingBag,
  Database,
  Truck,
  ShieldCheck,
  Search,
  BookOpen,
  AlertTriangle,
} from 'lucide-react';

export function App() {
  const { isAdmin, isAuthenticated } = useAuth();
  const { refreshTrigger } = useRealtime();

  // App Navigation View
  const [currentView, setCurrentView] = useState<'storefront' | 'admin'>('storefront');
  const [adminTab, setAdminTab] = useState<AdminTab>('dashboard');

  // Storefront Data State
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [businessSettings, setBusinessSettings] = useState<BusinessSettings>({
    business_name: 'BIKIE Sistemas Informáticos',
    rif_tax_id: '0214081-21',
    phone: '333098318 - 222544924 - 222213126',
    whatsapp: '+240 222544924',
    address: 'BARRIO EL PARAISO (cerca la guardería "Los Chupetes") - Malabo / Bata, GE',
    pago_movil_info: 'Orange Money / MTN MoMo • Tel: 222544924 / 333098318',
    binance_info: 'bikie_sistemas@pay.binance (Pay ID: 394819201)',
    bank_transfer_info: 'BANGE • Cta: 37101193101-51 • Sistemas Informáticos Bikie',
    tax_rate: 15,
    currency: 'XAF',
    currency_symbol: 'FCFA',
    invoice_prefix: 'BIKIE',
    sound_notifications_enabled: true,
  });

  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);

  // Modals
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isTrackingOpen, setIsTrackingOpen] = useState(false);
  const [isConnectionOpen, setIsConnectionOpen] = useState(false);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isAiScannerOpen, setIsAiScannerOpen] = useState(false);
  const [viewerInvoice, setViewerInvoice] = useState<Invoice | null>(null);
  const [orderToViewInAdmin, setOrderToViewInAdmin] = useState<Order | null>(null);

  // Load Storefront Data
  useEffect(() => {
    loadStorefrontData();
  }, [refreshTrigger]);

  const loadStorefrontData = async () => {
    setIsLoading(true);
    try {
      const [pData, cData, ofData, sData] = await Promise.all([
        getProducts(false),
        getCategories(),
        getOffers(),
        getBusinessSettings(),
      ]);
      setProducts(pData);
      setCategories(cData);
      setOffers(ofData);
      setBusinessSettings(sData);
    } catch (err: any) {
      console.error('Error loading storefront:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Switch to Admin
  const handleOpenAdmin = () => {
    if (isAdmin) {
      setCurrentView('admin');
    } else {
      setIsLoginOpen(true);
    }
  };

  // Product Counts per category
  const productCounts: Record<string, number> = {};
  products.forEach((p) => {
    if (p.category_id) {
      productCounts[p.category_id] = (productCounts[p.category_id] || 0) + 1;
    }
  });

  // Filtered products for Storefront
  const filteredProducts = products.filter((p) => {
    const matchesCategory = selectedCategoryId ? p.category_id === selectedCategoryId : true;
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      p.name.toLowerCase().includes(q) ||
      p.code.toLowerCase().includes(q) ||
      (p.description && p.description.toLowerCase().includes(q));
    return matchesCategory && matchesSearch;
  });

  // Active offers
  const activeOffers = offers.filter((o) => o.status === 'active');

  // If in Admin View
  if (currentView === 'admin') {
    if (!isAdmin) {
      setCurrentView('storefront');
      setIsLoginOpen(true);
      return null;
    }
    return (
      <AdminLayout
        currentTab={adminTab}
        setCurrentTab={setAdminTab}
        onExitAdmin={() => setCurrentView('storefront')}
        onOpenConnection={() => setIsConnectionOpen(true)}
      >
        {adminTab === 'dashboard' && (
          <AdminDashboard
            onNavigateTab={(tab) => setAdminTab(tab)}
            onSelectOrder={(order) => {
              setOrderToViewInAdmin(order);
              setAdminTab('orders');
            }}
          />
        )}
        {adminTab === 'orders' && (
          <AdminOrders
            businessSettings={businessSettings}
            onViewInvoice={(inv) => setViewerInvoice(inv)}
            selectedOrderFromDashboard={orderToViewInAdmin}
          />
        )}
        {adminTab === 'pos' && (
          <AdminPos
            businessSettings={businessSettings}
            onViewInvoice={(inv) => setViewerInvoice(inv)}
          />
        )}
        {adminTab === 'invoices' && (
          <AdminInvoices
            businessSettings={businessSettings}
            onViewInvoice={(inv) => setViewerInvoice(inv)}
          />
        )}
        {adminTab === 'services' && <AdminServices />}
        {adminTab === 'suppliers' && <AdminSuppliers />}
        {adminTab === 'products' && <AdminProducts />}
        {adminTab === 'categories' && <AdminCategories />}
        {adminTab === 'offers' && <AdminOffers />}
        {adminTab === 'inventory' && <AdminInventory />}
        {adminTab === 'sales' && <AdminSales />}
        {adminTab === 'notifications' && <AdminNotifications />}
        {adminTab === 'settings' && (
          <AdminSettings
            settings={businessSettings}
            onOpenConnection={() => setIsConnectionOpen(true)}
          />
        )}

        {/* Global Floating Calculator for Admin */}
        <FloatingCalculator />

        {/* Global Modals for Admin */}
        <InvoiceViewerModal
          invoice={viewerInvoice}
          businessSettings={businessSettings}
          onClose={() => setViewerInvoice(null)}
        />
        <ConnectionModal
          isOpen={isConnectionOpen}
          onClose={() => setIsConnectionOpen(false)}
        />
      </AdminLayout>
    );
  }

  // Storefront View
  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col justify-between text-white selection:bg-[#dc2626] selection:text-white">
      {/* Top Header */}
      <Header
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        onOpenAdmin={handleOpenAdmin}
        onOpenTracking={() => setIsTrackingOpen(true)}
        onOpenConnection={() => setIsConnectionOpen(true)}
        onOpenAiScanner={() => setIsAiScannerOpen(true)}
        currentView="store"
        setCurrentView={(view) => {
          if (view === 'admin') handleOpenAdmin();
          else setCurrentView('storefront');
        }}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Supabase Unconfigured Warning Banner */}
        {!isConfigured && (
          <div className="mb-6 p-4 bg-amber-950/40 border border-amber-500/30 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-amber-200 shadow-xl backdrop-blur-xs animate-in fade-in duration-300">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-black uppercase tracking-wider font-mono text-amber-300">
                  Supabase no detectado en este despliegue de Vercel
                </p>
                <p className="text-xs text-amber-200/80 mt-1 font-sans">
                  Para cargar y sincronizar los datos reales, agrega <span className="font-mono bg-black/40 px-1.5 py-0.5 rounded text-white text-[11px]">VITE_SUPABASE_URL</span> y <span className="font-mono bg-black/40 px-1.5 py-0.5 rounded text-white text-[11px]">VITE_SUPABASE_ANON_KEY</span> en el dashboard de Vercel (Project Settings &rarr; Environment Variables) y haz Redeploy.
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsConnectionOpen(true)}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black text-xs font-black uppercase tracking-wider rounded-lg transition-colors cursor-pointer shrink-0 shadow-sm"
            >
              Configurar Manualmente
            </button>
          </div>
        )}

        {/* Hero Promotion Banner */}
        <HeroBanner
          activeOffers={activeOffers}
          onExploreOffers={() => {
            setSelectedCategoryId(null);
            window.scrollTo({ top: 420, behavior: 'smooth' });
          }}
          onOpenAiScanner={() => setIsAiScannerOpen(true)}
        />

        {/* Category Horizontal Bar */}
        <CategoryBar
          categories={categories}
          selectedCategoryId={selectedCategoryId}
          onSelectCategory={setSelectedCategoryId}
          productCounts={productCounts}
        />

        {/* Products Grid */}
        <div className="mb-14">
          <div className="flex items-center justify-between mb-6 pb-3 border-b border-white/10">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="w-2.5 h-2.5 bg-[#dc2626] rounded-full accent-glow"></span>
                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white/50 font-mono">
                  INVENTARIO EN VIVO
                </span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-white font-display uppercase tracking-tight">
                {selectedCategoryId
                  ? categories.find((c) => c.id === selectedCategoryId)?.name || 'Catálogo'
                  : 'Catálogo General'}
              </h2>
              <p className="text-xs text-white/40 mt-1 uppercase tracking-wider font-mono">
                {filteredProducts.length}{' '}
                {filteredProducts.length === 1 ? 'ARTÍCULO DISPONIBLE' : 'ARTÍCULOS DISPONIBLES'} EN ALMACÉN
              </p>
            </div>
          </div>

          <ProductGrid
            products={filteredProducts}
            offers={offers}
            onSelectProduct={setSelectedProduct}
            isLoading={isLoading}
          />
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-[#050505] text-white border-t border-white/10 pt-14 pb-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pb-10 border-b border-white/10 text-xs">
            {/* Brand column */}
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#dc2626] text-white flex items-center justify-center font-black text-2xl shadow-lg accent-glow font-display">
                  B
                </div>
                <div>
                  <span className="font-black text-xl tracking-tighter text-white font-display">
                    BIKIE <span className="text-[#ef4444]">.</span>
                  </span>
                  <p className="text-[9px] font-bold text-white/60 tracking-[0.3em] uppercase -mt-0.5 font-mono">
                    SISTEMAS INFORMÁTICOS
                  </p>
                </div>
              </div>
              <p className="text-white/50 leading-relaxed uppercase tracking-wide text-[11px]">
                Plataforma integral para papelería técnica, suministros de oficina, copias, encuadernación y servicios informáticos en moneda oficial FCFA / XAF.
              </p>
            </div>

            {/* Business Info */}
            <div className="space-y-2 text-white/50 text-[11px] uppercase tracking-wide">
              <h4 className="text-white font-black uppercase tracking-[0.2em] text-xs font-display">
                Sede & Contacto
              </h4>
              <p>📍 {businessSettings.address}</p>
              <p>📞 {businessSettings.phone}</p>
              <p>💬 WhatsApp: {businessSettings.whatsapp}</p>
              <p className="font-mono text-white/70">NIF/RIF: {businessSettings.rif_tax_id}</p>
            </div>

            {/* Quick Links */}
            <div className="space-y-2">
              <h4 className="text-white font-black uppercase tracking-[0.2em] text-xs font-display">
                Atención al Cliente
              </h4>
              <ul className="space-y-2 text-white/50 text-[11px] uppercase tracking-wider">
                <li>
                  <button
                    onClick={() => setIsTrackingOpen(true)}
                    className="hover:text-[#ef4444] transition-colors cursor-pointer"
                  >
                    Rastrear Pedido
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => setIsAiScannerOpen(true)}
                    className="hover:text-[#ef4444] transition-colors cursor-pointer"
                  >
                    Escanear Lista de Útiles con IA
                  </button>
                </li>
              </ul>
            </div>
          </div>

          <div className="pt-6 flex flex-col sm:flex-row items-center justify-between text-xs text-white/40 gap-3 font-mono">
            <p className="text-[11px] uppercase tracking-wider">
              © {new Date().getFullYear()} BIKIE PAPELERÍA. TODOS LOS DERECHOS RESERVADOS.
            </p>
            <p className="text-[10px] uppercase text-white/30">
              VENTAS & SUMINISTROS EN MONEDA OFICIAL FCFA / XAF
            </p>
          </div>
        </div>
      </footer>

      {/* AI List Scanner Modal for clients */}
      <AiListScannerModal
        isOpen={isAiScannerOpen}
        onClose={() => setIsAiScannerOpen(false)}
        products={products}
      />

      {/* Global Modals */}
      <ProductDetailModal
        product={selectedProduct}
        offers={offers}
        onClose={() => setSelectedProduct(null)}
      />

      <CartDrawer
        onProceedToCheckout={() => setIsCheckoutOpen(true)}
      />

      <CheckoutModal
        isOpen={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
        businessSettings={businessSettings}
      />

      <OrderTrackingModal
        isOpen={isTrackingOpen}
        onClose={() => setIsTrackingOpen(false)}
        onViewInvoice={(inv) => setViewerInvoice(inv)}
      />

      <InvoiceViewerModal
        invoice={viewerInvoice}
        businessSettings={businessSettings}
        onClose={() => setViewerInvoice(null)}
      />

      <ConnectionModal
        isOpen={isConnectionOpen}
        onClose={() => setIsConnectionOpen(false)}
      />

      <AdminLoginModal
        isOpen={isLoginOpen}
        onClose={() => setIsLoginOpen(false)}
        onSuccess={() => setCurrentView('admin')}
      />
    </div>
  );
}
export default App;
