import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  Plus,
  Minus,
  Trash2,
  Receipt,
  CreditCard,
  User,
  Phone,
  Layers,
  Sparkles,
  Barcode,
  CheckCircle2,
  Printer,
  RefreshCw,
  Tag,
  DollarSign,
  FileText,
  Copy,
  Coffee,
  Shield,
  FileCheck,
  ShoppingCart,
  ArrowRight,
  Calculator,
  RotateCcw,
} from 'lucide-react';
import { getProducts, getCategories } from '../../services/productService';
import { getOffers } from '../../services/offerService';
import { getAdditionalServices } from '../../services/serviceManager';
import { processDirectPosSale } from '../../services/invoiceService';
import { calculateProductPrice } from '../../services/pricingEngine';
import {
  Product,
  Category,
  Offer,
  PaymentMethod,
  Invoice,
  BusinessSettings,
  AdditionalService,
} from '../../types';
import { formatCurrency } from '../../utils/currency';
import { useRealtime } from '../../context/RealtimeContext';
import { playSuccessChime } from '../../utils/audio';

interface AdminPosProps {
  businessSettings: BusinessSettings;
  onViewInvoice: (invoice: Invoice) => void;
}

interface PosCartItem {
  product: Product;
  quantity: number;
}

export const AdminPos: React.FC<AdminPosProps> = ({ businessSettings, onViewInvoice }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [services, setServices] = useState<AdditionalService[]>([]);
  const [activePosTab, setActivePosTab] = useState<'products' | 'services'>('products');
  const [mobileView, setMobileView] = useState<'catalog' | 'register'>('catalog');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedServiceCategory, setSelectedServiceCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState<PosCartItem[]>([]);
  const [customerName, setCustomerName] = useState('Cliente Mostrador');
  const [customerIdDoc, setCustomerIdDoc] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('efectivo');
  const [cashTendered, setCashTendered] = useState<string>('');
  const [cashierName, setCashierName] = useState('Caja 1 - Principal');
  const [isProcessing, setIsProcessing] = useState(false);
  const [completedInvoice, setCompletedInvoice] = useState<Invoice | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const { refreshTrigger, triggerGlobalRefresh } = useRealtime();

  useEffect(() => {
    loadPosData();
  }, [refreshTrigger]);

  const loadPosData = async () => {
    try {
      const [p, c, o, s] = await Promise.all([
        getProducts(false),
        getCategories(),
        getOffers(),
        getAdditionalServices(false),
      ]);
      setProducts(p);
      setCategories(c);
      setOffers(o);
      setServices(s);
    } catch (err: any) {
      console.error('Error loading POS data:', err);
    }
  };

  // Add product to POS cart
  const addToCart = (product: Product) => {
    if (product.stock <= 0) {
      alert(`El artículo "${product.name}" no tiene stock disponible.`);
      return;
    }

    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock) {
          alert(`Alcanzaste el límite de stock disponible (${product.stock}).`);
          return prev;
        }
        return prev.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  // Add Service to POS cart
  const addServiceToCart = (service: AdditionalService) => {
    const serviceProduct: Product = {
      id: service.id,
      code: service.code,
      name: `[SERVICIO] ${service.name}`,
      description: service.description,
      price: service.price,
      cost_price: 0,
      stock: 99999,
      min_stock: 0,
      category_id: null,
      image_url: null,
      is_active: true,
      is_featured: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === service.id);
      if (existing) {
        return prev.map((item) =>
          item.product.id === service.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { product: serviceProduct, quantity: 1 }];
    });
  };

  const updateQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }
    setCart((prev) =>
      prev.map((item) => {
        if (item.product.id === productId) {
          if (quantity > item.product.stock) {
            alert(`Stock máximo disponible: ${item.product.stock}`);
            return item;
          }
          return { ...item, quantity };
        }
        return item;
      })
    );
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((i) => i.product.id !== productId));
  };

  const clearCart = () => {
    setCart([]);
    setCustomerName('Cliente Mostrador');
    setCustomerIdDoc('');
    setCustomerPhone('');
    setCashTendered('');
  };

  // Fast Barcode / Enter-key handler
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchQuery.trim()) {
      const query = searchQuery.trim().toLowerCase();
      const exactMatch = products.find(
        (p) => p.code.toLowerCase() === query || p.id.toLowerCase() === query
      );
      if (exactMatch) {
        addToCart(exactMatch);
        setSearchQuery('');
      } else {
        const matches = filteredProducts;
        if (matches.length === 1) {
          addToCart(matches[0]);
          setSearchQuery('');
        }
      }
    }
  };

  // Cart calculations with pricing engine
  const calculatedItems = cart.map((item) => {
    const calc = calculateProductPrice(item.product, offers, item.quantity);
    return {
      ...item,
      calc,
    };
  });

  const totalItemsCount = cart.reduce((sum, i) => sum + i.quantity, 0);

  const subtotal = calculatedItems.reduce(
    (sum, item) => sum + item.calc.originalPrice * item.quantity,
    0
  );
  const total = calculatedItems.reduce(
    (sum, item) => sum + item.calc.finalPrice * item.quantity,
    0
  );
  const discount = Math.max(0, subtotal - total);

  // Cash change
  const cashAmountNum = parseFloat(cashTendered) || 0;
  const cashChange = Math.max(0, cashAmountNum - total);

  // Checkout POS atomic
  const handleProcessPosSale = async () => {
    if (cart.length === 0) {
      alert('Agrega al menos un artículo o servicio para procesar la venta.');
      return;
    }

    setIsProcessing(true);
    try {
      const payload = {
        customer_name: customerName.trim() || 'Cliente Mostrador',
        customer_id_doc: customerIdDoc.trim() || null,
        customer_phone: customerPhone.trim() || null,
        payment_method: paymentMethod,
        cashier_name: cashierName.trim() || 'Caja 1',
        subtotal,
        discount,
        tax: 0,
        total,
        items: calculatedItems.map((i) => ({
          product_id: i.product.id,
          product_name: i.product.name,
          quantity: i.quantity,
          original_unit_price: i.calc.originalPrice,
          unit_price: i.calc.finalPrice,
          discount_amount: i.calc.discountAmount,
          total_price: i.calc.finalPrice * i.quantity,
        })),
      };

      const result = await processDirectPosSale(payload);
      playSuccessChime();

      setCompletedInvoice({
        id: result.invoice_id,
        invoice_number: result.invoice_number,
        order_id: result.order_id,
        customer_id: null,
        customer_address: null,
        notes: null,
        currency: 'XAF',
        payment_status: 'paid',
        paid_at: new Date().toISOString(),
        cancelled_at: null,
        customer_name: payload.customer_name,
        customer_id_doc: payload.customer_id_doc || null,
        customer_phone: payload.customer_phone || '',
        payment_method: payload.payment_method,
        subtotal: payload.subtotal,
        discount: payload.discount,
        tax: 0,
        total: payload.total,
        status: 'paid',
        created_at: new Date().toISOString(),
        items: payload.items.map((i, idx) => ({
          id: `item-${idx}`,
          invoice_id: result.invoice_id,
          product_id: i.product_id,
          product_name: i.product_name,
          quantity: i.quantity,
          original_unit_price: i.original_unit_price,
          discount_amount: i.discount_amount,
          unit_price: i.unit_price,
          total: i.total_price,
          created_at: new Date().toISOString(),
        })),
      });

      clearCart();
      triggerGlobalRefresh();
    } catch (err: any) {
      alert(`Error al procesar la venta POS: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const filteredProducts = products.filter((p) => {
    const matchesCat = selectedCategory ? p.category_id === selectedCategory : true;
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      p.name.toLowerCase().includes(q) ||
      p.code.toLowerCase().includes(q) ||
      (p.description && p.description.toLowerCase().includes(q));
    return matchesCat && matchesSearch;
  });

  const filteredServices = services.filter((s) => {
    const matchesCat = selectedServiceCategory ? s.category === selectedServiceCategory : true;
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      s.name.toLowerCase().includes(q) ||
      s.code.toLowerCase().includes(q) ||
      (s.description && s.description.toLowerCase().includes(q));
    return matchesCat && matchesSearch;
  });

  return (
    <div className="flex flex-col h-full font-mono text-white">
      {/* Mobile Top Navigation Tabs (Android / Smartphone optimization) */}
      <div className="lg:hidden flex items-center gap-2 mb-3 bg-[#0d0d0d] p-1.5 rounded-xl border border-white/10 shrink-0">
        <button
          onClick={() => setMobileView('catalog')}
          className={`flex-1 py-3 rounded-lg text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer min-h-[44px] ${
            mobileView === 'catalog'
              ? 'bg-[#dc2626] text-white shadow-md accent-glow'
              : 'text-white/60 hover:text-white bg-[#141414]'
          }`}
        >
          <Barcode className="w-4 h-4" />
          <span>Catálogo</span>
        </button>

        <button
          onClick={() => setMobileView('register')}
          className={`flex-1 py-3 rounded-lg text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer min-h-[44px] relative ${
            mobileView === 'register'
              ? 'bg-[#dc2626] text-white shadow-md accent-glow'
              : 'text-white/60 hover:text-white bg-[#141414]'
          }`}
        >
          <ShoppingCart className="w-4 h-4" />
          <span>Caja / Ticket</span>
          {totalItemsCount > 0 && (
            <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-black bg-white text-[#dc2626]">
              {totalItemsCount}
            </span>
          )}
        </button>
      </div>

      {/* Main Grid: Responsive layout for Desktop (split) and Android (toggled/scrollable) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 flex-1 min-h-0">
        {/* Left side: Catalog & Fast Search (7 cols on desktop) */}
        <div
          className={`lg:col-span-7 flex flex-col bg-[#0d0d0d] rounded-xl p-4 sm:p-5 border border-white/10 overflow-hidden text-white ${
            mobileView === 'register' ? 'hidden lg:flex' : 'flex'
          }`}
        >
          {/* Module Switcher: Products vs Services */}
          <div className="flex items-center gap-2 mb-3 bg-black/40 p-1 rounded-lg border border-white/10 shrink-0">
            <button
              onClick={() => setActivePosTab('products')}
              className={`flex-1 py-2.5 rounded-md text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer min-h-[40px] ${
                activePosTab === 'products'
                  ? 'bg-[#dc2626] text-white shadow-md accent-glow'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
            >
              <Barcode className="w-4 h-4" />
              <span>Productos Papelería</span>
            </button>

            <button
              onClick={() => setActivePosTab('services')}
              className={`flex-1 py-2.5 rounded-md text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer min-h-[40px] ${
                activePosTab === 'services'
                  ? 'bg-[#dc2626] text-white shadow-md accent-glow'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Servicios & Copistería</span>
            </button>
          </div>

          {/* Top Search and Barcode Input */}
          <div className="flex gap-2 mb-3 shrink-0">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                placeholder={
                  activePosTab === 'products'
                    ? 'BUSCAR SKU / NOMBRE / ESCANEAR CÓDIGO...'
                    : 'BUSCAR SERVICIO (FOTOCOPIAS, ENCUADERNACIÓN)...'
                }
                className="w-full pl-10 pr-4 py-2.5 bg-[#141414] border border-white/10 rounded-lg text-xs text-white placeholder:text-white/30 focus:border-[#dc2626] focus:outline-none font-mono uppercase min-h-[42px]"
              />
            </div>
            <button
              onClick={loadPosData}
              className="px-3 bg-[#141414] hover:bg-white/10 border border-white/10 text-white rounded-lg transition-colors cursor-pointer flex items-center justify-center min-h-[42px]"
              title="Refrescar catálogo"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {/* Category Filter Chips */}
          <div className="shrink-0 mb-3">
            {activePosTab === 'products' ? (
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 scrollbar-none">
                <button
                  onClick={() => setSelectedCategory(null)}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider whitespace-nowrap transition-all cursor-pointer min-h-[32px] ${
                    selectedCategory === null
                      ? 'bg-[#dc2626] text-white shadow-md'
                      : 'bg-[#141414] text-white/60 hover:text-white border border-white/10 hover:bg-white/5'
                  }`}
                >
                  TODOS ({products.length})
                </button>
                {categories.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setSelectedCategory(c.id)}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider whitespace-nowrap transition-all cursor-pointer min-h-[32px] ${
                      selectedCategory === c.id
                        ? 'bg-[#dc2626] text-white shadow-md'
                        : 'bg-[#141414] text-white/60 hover:text-white border border-white/10 hover:bg-white/5'
                    }`}
                  >
                    {(c.name || '').toUpperCase()}
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 scrollbar-none">
                {[
                  { id: null, label: 'TODOS LOS SERVICIOS' },
                  { id: 'copias', label: 'FOTOCOPIAS & A3/A4' },
                  { id: 'impresiones', label: 'IMPRESIONES' },
                  { id: 'redaccion', label: 'TRATAMIENTO DE TEXTOS' },
                  { id: 'plastificado', label: 'ENCUADERNACIÓN & PLASTIFICACIÓN' },
                  { id: 'bebidas', label: 'BEBIDAS & CAFÉ' },
                ].map((cat) => (
                  <button
                    key={cat.id || 'all'}
                    onClick={() => setSelectedServiceCategory(cat.id)}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider whitespace-nowrap transition-all cursor-pointer min-h-[32px] ${
                      selectedServiceCategory === cat.id
                        ? 'bg-[#dc2626] text-white shadow-md'
                        : 'bg-[#141414] text-white/60 hover:text-white border border-white/10 hover:bg-white/5'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Cards Grid: Touch friendly 2 cols on mobile, 3 cols on desktop */}
          <div className="flex-1 overflow-y-auto grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 gap-2.5 p-1 pr-1.5 custom-scrollbar min-h-[260px]">
            {activePosTab === 'products' ? (
              filteredProducts.length === 0 ? (
                <div className="col-span-full py-12 text-center text-white/30 text-xs uppercase">
                  No se encontraron productos disponibles.
                </div>
              ) : (
                filteredProducts.map((product) => {
                  const priceInfo = calculateProductPrice(product, offers, 1);
                  const isOutOfStock = product.stock <= 0;

                  return (
                    <div
                      key={product.id}
                      onClick={() => !isOutOfStock && addToCart(product)}
                      className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all select-none group min-h-[115px] ${
                        isOutOfStock
                          ? 'bg-[#141414]/50 border-white/5 opacity-40 cursor-not-allowed'
                          : 'bg-[#141414] border-white/10 hover:border-[#dc2626] cursor-pointer hover:bg-white/5 active:scale-97'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between text-[9px] text-white/40 mb-1 font-mono">
                          <span className="font-bold text-[#ef4444]">{product.code}</span>
                          <span
                            className={`font-black px-1.5 py-0.5 rounded-md uppercase text-[8.5px] ${
                              product.stock <= 3
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                : 'bg-white/10 text-white/70 border border-white/10'
                            }`}
                          >
                            {product.stock} DISP.
                          </span>
                        </div>
                        <h4 className="font-bold text-xs text-white line-clamp-2 leading-snug uppercase group-hover:text-[#ef4444] transition-colors">
                          {product.name}
                        </h4>
                      </div>

                      <div className="mt-2 pt-2 border-t border-white/10 flex items-center justify-between">
                        <div className="flex flex-col">
                          {priceInfo.discountAmount > 0 && (
                            <span className="text-[9px] text-white/30 line-through">
                              {formatCurrency(priceInfo.originalPrice)}
                            </span>
                          )}
                          <span className="text-xs font-black text-white font-mono">
                            {formatCurrency(priceInfo.finalPrice)}
                          </span>
                        </div>
                        <div className="w-7 h-7 rounded-lg bg-[#dc2626] text-white flex items-center justify-center font-black text-xs shadow-md group-hover:scale-105 transition-transform">
                          <Plus className="w-3.5 h-3.5" />
                        </div>
                      </div>
                    </div>
                  );
                })
              )
            ) : filteredServices.length === 0 ? (
              <div className="col-span-full py-12 text-center text-white/30 text-xs uppercase">
                No se encontraron servicios registrados.
              </div>
            ) : (
              filteredServices.map((service) => (
                <div
                  key={service.id}
                  onClick={() => addServiceToCart(service)}
                  className="p-3 rounded-xl border bg-[#141414] border-white/10 hover:border-[#dc2626] cursor-pointer hover:bg-white/5 active:scale-97 text-left flex flex-col justify-between transition-all select-none group min-h-[115px]"
                >
                  <div>
                    <div className="flex items-center justify-between text-[9px] text-white/40 mb-1 font-mono">
                      <span className="font-bold text-[#ef4444]">{service.code}</span>
                      <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-black px-1.5 py-0.5 rounded-md uppercase text-[8.5px]">
                        SERVICIO
                      </span>
                    </div>
                    <h4 className="font-bold text-xs text-white line-clamp-2 leading-snug uppercase group-hover:text-[#ef4444] transition-colors">
                      {service.name}
                    </h4>
                    {service.description && (
                      <p className="text-[10px] text-white/40 line-clamp-1 mt-0.5">
                        {service.description}
                      </p>
                    )}
                  </div>

                  <div className="mt-2 pt-2 border-t border-white/10 flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="text-xs font-black text-[#ef4444] font-mono">
                        {formatCurrency(service.price)}
                      </span>
                      <span className="text-[9px] text-white/40">{service.unit_label}</span>
                    </div>
                    <div className="w-7 h-7 rounded-lg bg-[#dc2626] text-white flex items-center justify-center font-black text-xs shadow-md group-hover:scale-105 transition-transform">
                      <Plus className="w-3.5 h-3.5" />
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Android Mobile Floating Bottom Bar to switch to cashier with 1 tap */}
          {cart.length > 0 && (
            <div className="lg:hidden mt-3 pt-3 border-t border-white/10 flex items-center justify-between bg-[#141414] p-3 rounded-xl">
              <div>
                <p className="text-[10px] text-white/60 uppercase tracking-wider">
                  {totalItemsCount} items en ticket
                </p>
                <p className="text-sm font-black text-[#ef4444] font-mono">
                  {formatCurrency(total)}
                </p>
              </div>
              <button
                onClick={() => setMobileView('register')}
                className="px-4 py-2.5 bg-[#dc2626] hover:bg-[#b91c1c] text-white rounded-lg text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-lg cursor-pointer"
              >
                <span>VER CAJA</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Right side: POS Register / Cashier (5 cols on desktop, full view on mobile when active) */}
        <div
          className={`lg:col-span-5 flex flex-col bg-[#0d0d0d] rounded-xl p-4 sm:p-5 border border-white/10 justify-between text-white ${
            mobileView === 'catalog' ? 'hidden lg:flex' : 'flex'
          }`}
        >
          <div className="flex flex-col flex-1 overflow-hidden">
            {/* Cashier Header */}
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/10 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#dc2626] text-white flex items-center justify-center shadow-md">
                  <Receipt className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white font-display uppercase tracking-tight">
                    CAJA & FACTURACIÓN
                  </h3>
                  <p className="text-[9px] text-white/40 uppercase tracking-widest font-mono">
                    BIKIE SISTEMAS INFORMÁTICOS (XAF)
                  </p>
                </div>
              </div>

              {cart.length > 0 && (
                <button
                  onClick={clearCart}
                  className="px-2.5 py-1 text-[10px] font-black uppercase text-white/60 hover:text-[#ef4444] hover:bg-white/5 rounded-md flex items-center gap-1 cursor-pointer transition-colors"
                  title="Vaciar ticket"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>VACIAR</span>
                </button>
              )}
            </div>

            {/* Customer Information inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3 shrink-0">
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="NOMBRE CLIENTE / EMPRESA"
                className="px-3 py-2 bg-[#141414] border border-white/10 rounded-lg text-xs text-white placeholder:text-white/30 uppercase focus:border-[#dc2626] focus:outline-none min-h-[38px]"
              />
              <input
                type="text"
                value={customerIdDoc}
                onChange={(e) => setCustomerIdDoc(e.target.value)}
                placeholder="C.I. / NIF / RIF"
                className="px-3 py-2 bg-[#141414] border border-white/10 rounded-lg text-xs text-white placeholder:text-white/30 uppercase font-mono focus:border-[#dc2626] focus:outline-none min-h-[38px]"
              />
            </div>

            {/* Cart Table List: Scrollable */}
            <div className="flex-1 overflow-y-auto min-h-[160px] max-h-[280px] lg:max-h-[320px] divide-y divide-white/5 border border-white/10 rounded-xl bg-[#141414] p-1 custom-scrollbar">
              {cart.length === 0 ? (
                <div className="text-center py-12 text-white/30 text-xs uppercase flex flex-col items-center justify-center gap-2">
                  <ShoppingCart className="w-8 h-8 text-white/20" />
                  <span>Escanea un producto o selecciona un servicio</span>
                </div>
              ) : (
                calculatedItems.map((item) => (
                  <div
                    key={item.product.id}
                    className="p-2.5 flex items-center justify-between text-xs hover:bg-white/5 transition-colors gap-2"
                  >
                    <div className="min-w-0 pr-1 flex-1">
                      <p className="font-bold text-white uppercase truncate text-[11.5px]">
                        {item.product.name}
                      </p>
                      <p className="text-[10px] text-white/40">
                        {formatCurrency(item.calc.finalPrice)} c/u
                        {item.calc.discountAmount > 0 && (
                          <span className="text-[#ef4444] font-bold ml-1">
                            (-{formatCurrency(item.calc.discountAmount)})
                          </span>
                        )}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <div className="flex items-center border border-white/15 rounded-lg bg-[#0d0d0d]">
                        <button
                          onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                          className="w-7 h-7 flex items-center justify-center text-white/60 hover:text-[#ef4444] cursor-pointer min-h-[28px]"
                          aria-label="Restar uno"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="px-1.5 font-mono font-black text-white text-xs min-w-[20px] text-center">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                          className="w-7 h-7 flex items-center justify-center text-white/60 hover:text-[#ef4444] cursor-pointer min-h-[28px]"
                          aria-label="Sumar uno"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <span className="font-mono font-black w-20 text-right text-white text-xs">
                        {formatCurrency(item.calc.finalPrice * item.quantity)}
                      </span>

                      <button
                        onClick={() => removeFromCart(item.product.id)}
                        className="text-white/40 hover:text-[#ef4444] p-1.5 cursor-pointer rounded-md hover:bg-white/5"
                        aria-label="Eliminar"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Payment & Totals Section */}
          <div className="space-y-2.5 pt-3 mt-3 border-t border-white/10 shrink-0">
            {/* Payment Method selector buttons */}
            <div>
              <p className="text-[9px] font-black text-white/40 uppercase tracking-widest mb-1.5">
                MÉTODO DE PAGO
              </p>
              <div className="grid grid-cols-5 gap-1 text-[9px] uppercase font-mono">
                {[
                  { id: 'efectivo', label: 'EFECTIVO' },
                  { id: 'pago_movil', label: 'ORANGE/MTN' },
                  { id: 'punto_venta', label: 'P. VENTA' },
                  { id: 'binance', label: 'BINANCE' },
                  { id: 'transferencia', label: 'BANGE' },
                ].map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setPaymentMethod(m.id as PaymentMethod)}
                    className={`py-2 rounded-lg font-black transition-colors cursor-pointer text-center min-h-[36px] ${
                      paymentMethod === m.id
                        ? 'bg-[#dc2626] text-white shadow-md'
                        : 'bg-[#141414] text-white/60 hover:text-white border border-white/10 hover:bg-white/5'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Cash calculator with fast shortcuts */}
            {paymentMethod === 'efectivo' && (
              <div className="space-y-1.5 bg-[#141414] p-2.5 rounded-xl border border-white/10 font-mono">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <label className="block text-[8.5px] text-white/40 font-black uppercase tracking-wider mb-0.5">
                      MONTO RECIBIDO (FCFA)
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={cashTendered}
                      onChange={(e) => setCashTendered(e.target.value)}
                      placeholder="0"
                      className="w-full p-2 bg-[#0d0d0d] border border-white/10 rounded-lg font-mono text-xs text-white focus:border-[#dc2626] focus:outline-none min-h-[36px]"
                    />
                  </div>
                  <div>
                    <label className="block text-[8.5px] text-white/40 font-black uppercase tracking-wider mb-0.5">
                      CAMBIO / VUELTO
                    </label>
                    <div className="p-2 bg-[#0d0d0d] border border-white/10 rounded-lg font-mono text-xs font-black text-emerald-400 flex items-center min-h-[36px]">
                      {formatCurrency(cashChange)}
                    </div>
                  </div>
                </div>

                {/* Quick amount tender chips */}
                <div className="flex items-center gap-1 overflow-x-auto pt-1">
                  <button
                    type="button"
                    onClick={() => setCashTendered(total.toString())}
                    className="px-2 py-1 bg-white/5 hover:bg-white/15 text-white/80 rounded text-[9px] font-mono font-bold cursor-pointer whitespace-nowrap"
                  >
                    Exacto
                  </button>
                  <button
                    type="button"
                    onClick={() => setCashTendered((Math.ceil(total / 1000) * 1000).toString())}
                    className="px-2 py-1 bg-white/5 hover:bg-white/15 text-white/80 rounded text-[9px] font-mono font-bold cursor-pointer whitespace-nowrap"
                  >
                    Redondear 1.000
                  </button>
                  <button
                    type="button"
                    onClick={() => setCashTendered((Math.ceil(total / 5000) * 5000).toString())}
                    className="px-2 py-1 bg-white/5 hover:bg-white/15 text-white/80 rounded text-[9px] font-mono font-bold cursor-pointer whitespace-nowrap"
                  >
                    Redondear 5.000
                  </button>
                </div>
              </div>
            )}

            {/* Subtotal / Discount / Total */}
            <div className="space-y-1 text-xs font-mono pt-1">
              <div className="flex justify-between text-white/50">
                <span className="uppercase">SUBTOTAL:</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-[#ef4444] font-black uppercase">
                  <span>DESCUENTO PROMO:</span>
                  <span>-{formatCurrency(discount)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-black text-white pt-2 border-t border-white/10">
                <span className="uppercase">TOTAL A COBRAR:</span>
                <span className="text-lg sm:text-xl text-[#ef4444] font-mono font-black">
                  {formatCurrency(total)}
                </span>
              </div>
            </div>

            {/* Process Sale Button */}
            <button
              onClick={handleProcessPosSale}
              disabled={isProcessing || cart.length === 0}
              className="w-full py-3.5 bg-[#dc2626] hover:bg-[#b91c1c] text-white font-black uppercase tracking-[0.15em] text-xs rounded-xl flex items-center justify-center gap-2 shadow-lg accent-glow transition-all cursor-pointer disabled:opacity-50 font-mono min-h-[46px]"
            >
              <Receipt className="w-4 h-4" />
              <span>
                {isProcessing ? 'PROCESANDO VENTA...' : `COBRAR ${formatCurrency(total)} & FACTURAR`}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Completed Sale & Invoice Dialog */}
      {completedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xs font-mono">
          <div className="bg-[#0d0d0d] rounded-2xl max-w-md w-full p-6 shadow-2xl border border-white/20 text-center text-white">
            <div className="w-14 h-14 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <h3 className="text-lg font-black text-white font-display uppercase tracking-tight">
              ¡VENTA REGISTRADA EXITOSAMENTE!
            </h3>
            <p className="text-[10px] text-white/40 uppercase tracking-widest mt-1">
              LA FACTURA HA SIDO EMITIDA Y GUARDADA EN EL SISTEMA.
            </p>

            <div className="my-4 p-4 rounded-xl bg-[#141414] border border-white/10 text-left text-xs space-y-1.5 uppercase">
              <p className="font-bold text-white">
                FACTURA: <span className="text-[#ef4444] font-black">{completedInvoice.invoice_number}</span>
              </p>
              <p className="text-white/60">CLIENTE: {completedInvoice.customer_name}</p>
              <p className="text-white/60">MÉTODO: {(completedInvoice.payment_method || 'EFECTIVO').toUpperCase()}</p>
              <p className="text-white font-black pt-2 border-t border-white/10 flex justify-between">
                <span>TOTAL PAGADO:</span>
                <span className="text-[#ef4444]">{formatCurrency(completedInvoice.total)}</span>
              </p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => {
                  onViewInvoice(completedInvoice);
                  setCompletedInvoice(null);
                }}
                className="flex-1 py-3 bg-[#dc2626] hover:bg-[#b91c1c] text-white font-black uppercase tracking-wider text-xs rounded-xl flex items-center justify-center gap-1.5 cursor-pointer accent-glow shadow-md min-h-[44px]"
              >
                <Printer className="w-4 h-4" />
                <span>VER FACTURA</span>
              </button>
              <button
                onClick={() => setCompletedInvoice(null)}
                className="py-3 px-4 bg-[#141414] hover:bg-white/10 border border-white/10 text-white font-black uppercase tracking-wider text-xs rounded-xl cursor-pointer min-h-[44px]"
              >
                CERRAR
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

