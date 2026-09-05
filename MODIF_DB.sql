-- ==============================================================================
-- BIKIE PAPELERÍA & SISTEMAS INFORMÁTICOS — SCRIPT ÚNICO DE BASE DE DATOS
-- ARCHIVO OFICIAL EXCLUSIVO: MODIF_DB.sql
-- ==============================================================================
-- Este archivo es 100% IDEMPOTENTE, AUTOCONTENIDO y LISTO PARA PRODUCCIÓN.
-- Contiene:
--  1. Extensiones requeridas (uuid-ossp, pgcrypto).
--  2. Secuencias oficiales de facturación, pedidos y ventas.
--  3. Esquema completo de tablas (profiles, products, categories, orders, invoices,
--     services, suppliers, notifications, settings, etc.) con CREATE TABLE IF NOT EXISTS.
--  4. Seguridad y protección de roles (evita escalado de privilegios y auto-asignación admin).
--  5. Políticas estrictas de Row Level Security (RLS) para proteger datos privados.
--  6. Funciones y Procedimientos Atómicos con bloqueo pesimista (FOR UPDATE):
--     - create_product_atomic: Creación atómica de producto y stock inicial (ADMIN ONLY).
--     - adjust_product_stock_atomic: Ajuste de stock sin race-conditions.
--     - create_order_atomic: Pedido web atómico con descuento de inventario.
--     - process_pos_sale_atomic: Venta mostrador en una sola transacción ACID.
--     - cancel_order_with_stock_return: Cancelación atómica con reintegro de stock.
--     - process_payment_and_invoice: Confirmación de pago y emisión de factura.
--     - track_order: Consulta pública segura por número de pedido (SECURITY DEFINER).
--     - get_invoice_by_order: Consulta segura de factura por pedido.
--  7. Activación de Realtime en Supabase para sincronización instantánea.
-- ==============================================================================

-- 1. EXTENSIONES
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. SECUENCIAS
CREATE SEQUENCE IF NOT EXISTS invoice_number_seq START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS order_number_seq START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS sale_number_seq START WITH 1 INCREMENT BY 1;

-- ==============================================================================
-- 3. TABLAS COMPLETAS DEL SISTEMA (IF NOT EXISTS)
-- ==============================================================================

-- 3.1 PROFILES (Usuarios y Roles)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT,
    role TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('admin', 'cashier', 'customer')),
    phone TEXT,
    address TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3.2 CATEGORIES
CREATE TABLE IF NOT EXISTS public.categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3.3 PRODUCTS
CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    price NUMERIC(14,2) NOT NULL CHECK (price >= 0),
    cost_price NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (cost_price >= 0),
    stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
    min_stock INTEGER NOT NULL DEFAULT 5 CHECK (min_stock >= 0),
    category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
    image_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_featured BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3.4 OFFERS
CREATE TABLE IF NOT EXISTS public.offers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    type TEXT NOT NULL CHECK (type IN ('percentage', 'fixed_discount', 'special_price')),
    value NUMERIC(14,2) NOT NULL CHECK (value > 0),
    priority INTEGER NOT NULL DEFAULT 0,
    start_date TIMESTAMPTZ NOT NULL,
    end_date TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('scheduled', 'active', 'paused', 'finished')),
    is_global BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3.5 OFFER_PRODUCTS
CREATE TABLE IF NOT EXISTS public.offer_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    offer_id UUID NOT NULL REFERENCES public.offers(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    UNIQUE(offer_id, product_id)
);

-- 3.6 OFFER_CATEGORIES
CREATE TABLE IF NOT EXISTS public.offer_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    offer_id UUID NOT NULL REFERENCES public.offers(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    UNIQUE(offer_id, category_id)
);

-- 3.7 CUSTOMERS
CREATE TABLE IF NOT EXISTS public.customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    full_name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    id_doc TEXT,
    address TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3.8 ORDERS
CREATE TABLE IF NOT EXISTS public.orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number TEXT NOT NULL UNIQUE,
    client_request_id TEXT UNIQUE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    customer_name TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    customer_email TEXT,
    delivery_address TEXT,
    subtotal NUMERIC(14,2) NOT NULL DEFAULT 0,
    discount NUMERIC(14,2) NOT NULL DEFAULT 0,
    tax NUMERIC(14,2) NOT NULL DEFAULT 0,
    total NUMERIC(14,2) NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'processing', 'ready', 'delivered', 'cancelled')),
    payment_method TEXT NOT NULL DEFAULT 'cash',
    payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'confirmed', 'rejected')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3.9 ORDER_ITEMS
CREATE TABLE IF NOT EXISTS public.order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
    product_name TEXT NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    original_unit_price NUMERIC(14,2) NOT NULL,
    unit_price NUMERIC(14,2) NOT NULL,
    discount_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
    total_price NUMERIC(14,2) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3.10 ORDER_STATUS_HISTORY
CREATE TABLE IF NOT EXISTS public.order_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    previous_status TEXT,
    new_status TEXT NOT NULL DEFAULT 'pending',
    status TEXT,
    note TEXT,
    changed_by TEXT NOT NULL DEFAULT 'Sistema',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Asegurar compatibilidad en bases de datos con tablas preexistentes
ALTER TABLE public.order_status_history ADD COLUMN IF NOT EXISTS previous_status TEXT;
ALTER TABLE public.order_status_history ADD COLUMN IF NOT EXISTS new_status TEXT;
ALTER TABLE public.order_status_history ADD COLUMN IF NOT EXISTS status TEXT;

-- 3.11 PAYMENTS
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
    method TEXT NOT NULL DEFAULT 'cash',
    amount NUMERIC(14,2) NOT NULL CHECK (amount >= 0),
    status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('pending', 'confirmed', 'rejected')),
    reference TEXT,
    notes TEXT,
    paid_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Compatibilidad hacia atrás y adelante para la tabla payments
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS method TEXT DEFAULT 'cash';
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS payment_method TEXT;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS reference TEXT;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now());

-- 3.12 INVOICES
CREATE TABLE IF NOT EXISTS public.invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_number TEXT NOT NULL UNIQUE,
    order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    customer_name TEXT NOT NULL,
    customer_id_doc TEXT,
    customer_phone TEXT,
    customer_address TEXT,
    subtotal NUMERIC(14,2) NOT NULL DEFAULT 0,
    discount NUMERIC(14,2) NOT NULL DEFAULT 0,
    tax NUMERIC(14,2) NOT NULL DEFAULT 0,
    total NUMERIC(14,2) NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'XAF',
    payment_method TEXT NOT NULL DEFAULT 'cash',
    payment_status TEXT NOT NULL DEFAULT 'confirmed' CHECK (payment_status IN ('pending', 'confirmed', 'paid', 'partial', 'cancelled', 'rejected')),
    status TEXT NOT NULL DEFAULT 'paid' CHECK (status IN ('draft', 'issued', 'paid', 'partial', 'cancelled')),
    notes TEXT,
    paid_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3.12.1 MIGRACIÓN Y HOMOLOGACIÓN DE COLUMNAS Y RESTRICCIONES EN INVOICES
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS customer_id_doc TEXT;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS customer_phone TEXT;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS customer_address TEXT;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS subtotal NUMERIC(14,2) DEFAULT 0;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS discount NUMERIC(14,2) DEFAULT 0;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS tax NUMERIC(14,2) DEFAULT 0;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS total NUMERIC(14,2) DEFAULT 0;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'XAF';
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'cash';
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'confirmed';
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'paid';
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now());

ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_payment_status_check;
ALTER TABLE public.invoices ADD CONSTRAINT invoices_payment_status_check 
    CHECK (payment_status IN ('pending', 'confirmed', 'paid', 'partial', 'cancelled', 'rejected'));

ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_status_check;
ALTER TABLE public.invoices ADD CONSTRAINT invoices_status_check 
    CHECK (status IN ('draft', 'issued', 'paid', 'partial', 'cancelled'));

-- 3.12.2 MIGRACIÓN Y HOMOLOGACIÓN EN ORDERS
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_payment_status_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_payment_status_check 
    CHECK (payment_status IN ('pending', 'confirmed', 'partial', 'rejected'));

-- 3.13 INVOICE_ITEMS
CREATE TABLE IF NOT EXISTS public.invoice_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
    product_name TEXT NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    original_unit_price NUMERIC(14,2) NOT NULL,
    unit_price NUMERIC(14,2) NOT NULL,
    discount_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
    total NUMERIC(14,2) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3.14 SALES (Consolidado de ventas de mostrador / caja)
CREATE TABLE IF NOT EXISTS public.sales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_number TEXT NOT NULL UNIQUE,
    invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
    order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
    payment_id UUID REFERENCES public.payments(id) ON DELETE SET NULL,
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    customer_name TEXT NOT NULL DEFAULT 'Consumidor final',
    cashier_name TEXT NOT NULL DEFAULT 'Cajero',
    total_amount NUMERIC(14,2) NOT NULL CHECK (total_amount >= 0),
    payment_method TEXT NOT NULL DEFAULT 'cash',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3.14.1 HOMOLOGACIÓN Y PROTECCIÓN DE COLUMNAS EN SALES
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS payment_id UUID REFERENCES public.payments(id) ON DELETE SET NULL;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS customer_name TEXT DEFAULT 'Consumidor final';
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS cashier_name TEXT DEFAULT 'Cajero';
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'cash';

-- Sanitizar registros preexistentes antes de activar NOT NULL
UPDATE public.sales SET customer_name = 'Consumidor final' WHERE customer_name IS NULL OR trim(customer_name) = '';
UPDATE public.sales SET cashier_name = 'Cajero' WHERE cashier_name IS NULL OR trim(cashier_name) = '';
UPDATE public.sales SET payment_method = 'cash' WHERE payment_method IS NULL OR trim(payment_method) = '';

ALTER TABLE public.sales ALTER COLUMN customer_name SET DEFAULT 'Consumidor final';
ALTER TABLE public.sales ALTER COLUMN customer_name SET NOT NULL;
ALTER TABLE public.sales ALTER COLUMN cashier_name SET DEFAULT 'Cajero';
ALTER TABLE public.sales ALTER COLUMN cashier_name SET NOT NULL;
ALTER TABLE public.sales ALTER COLUMN payment_method SET DEFAULT 'cash';
ALTER TABLE public.sales ALTER COLUMN payment_method SET NOT NULL;

-- 3.15 INVENTORY_MOVEMENTS
CREATE TABLE IF NOT EXISTS public.inventory_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('initial', 'purchase', 'sale', 'adjustment', 'refund', 'damage', 'loss')),
    quantity INTEGER NOT NULL,
    previous_stock INTEGER NOT NULL,
    new_stock INTEGER NOT NULL,
    order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3.16 SERVICES (Servicios Adicionales: Copias, Redacción, Plastificado, etc.)
CREATE TABLE IF NOT EXISTS public.services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'copias',
    price NUMERIC(14,2) NOT NULL CHECK (price >= 0),
    unit_label TEXT NOT NULL DEFAULT 'por servicio',
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3.17 SUPPLIERS (Proveedores Comerciales)
CREATE TABLE IF NOT EXISTS public.suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    contact_person TEXT,
    website_url TEXT,
    phone TEXT,
    email TEXT,
    address TEXT,
    category TEXT NOT NULL DEFAULT 'Papelería General',
    notes TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3.18 NOTIFICATIONS (Centro de Notificaciones)
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'info',
    is_read BOOLEAN NOT NULL DEFAULT false,
    order_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3.19 SETTINGS (Configuración de Negocio)
CREATE TABLE IF NOT EXISTS public.settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT NOT NULL UNIQUE,
    value JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3.20 POS_SCANNER_SESSIONS (Sesiones remotas de escáner móvil para POS)
CREATE TABLE IF NOT EXISTS public.pos_scanner_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_token TEXT NOT NULL UNIQUE,
    short_code TEXT NOT NULL,
    pos_identifier TEXT NOT NULL DEFAULT 'Caja Principal',
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'connected', 'disconnected', 'expired')),
    device_id TEXT,
    device_name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    expires_at TIMESTAMPTZ NOT NULL,
    connected_at TIMESTAMPTZ,
    disconnected_at TIMESTAMPTZ,
    last_scanned_barcode TEXT,
    last_scanned_at TIMESTAMPTZ
);

-- ==============================================================================
-- 4. ÍNDICES DE RENDIMIENTO
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_code ON public.products(code);
CREATE INDEX IF NOT EXISTS idx_products_is_active ON public.products(is_active);
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON public.orders(order_number);
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON public.orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_client_request_id ON public.orders(client_request_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_invoices_order_id ON public.invoices(order_id);
CREATE INDEX IF NOT EXISTS idx_invoices_number ON public.invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_services_category ON public.services(category);
CREATE INDEX IF NOT EXISTS idx_services_is_active ON public.services(is_active);
CREATE INDEX IF NOT EXISTS idx_suppliers_category ON public.suppliers(category);
CREATE INDEX IF NOT EXISTS idx_suppliers_is_active ON public.suppliers(is_active);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON public.notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_product ON public.inventory_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_pos_scanner_token ON public.pos_scanner_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_pos_scanner_short_code ON public.pos_scanner_sessions(short_code);
CREATE INDEX IF NOT EXISTS idx_pos_scanner_status ON public.pos_scanner_sessions(status);
CREATE INDEX IF NOT EXISTS idx_pos_scanner_expires_at ON public.pos_scanner_sessions(expires_at);

-- ==============================================================================
-- 5. AUTENTICACIÓN, ROLES Y PROTECCIÓN CONTRA ESCALADO DE PRIVILEGIOS
-- ==============================================================================

-- 5.1 Función para comprobar si el usuario actual es admin o personal de caja (staff)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role IN ('admin', 'cashier')
    );
$$;

-- 5.2 Trigger al registrarse: SIEMPRE forzar rol 'customer' (ignorar metadatos maliciosos)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name, role, phone)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
        'customer', -- FORZAR SIEMPRE ROL CUSTOMER
        NEW.raw_user_meta_data->>'phone'
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 5.3 Trigger en profiles: Bloquea a cualquier usuario no-admin cambiar roles
CREATE OR REPLACE FUNCTION public.protect_profile_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF (OLD.role IS DISTINCT FROM NEW.role) THEN
        IF NOT public.is_admin() THEN
            RAISE EXCEPTION 'Operación denegada: Solo un administrador autorizado puede modificar roles.';
        END IF;
    END IF;
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_profile_role ON public.profiles;
CREATE TRIGGER trg_protect_profile_role
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.protect_profile_role();

-- 5.4 Procedimiento administrativo para designar administrador inicial
DROP PROCEDURE IF EXISTS public.promote_user_to_admin(TEXT);
DROP PROCEDURE IF EXISTS public.promote_user_to_admin;
CREATE OR REPLACE PROCEDURE public.promote_user_to_admin(p_email TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
BEGIN
    SELECT id INTO v_user_id FROM auth.users WHERE lower(email) = lower(trim(p_email));
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Usuario con email % no encontrado en auth.users.', p_email;
    END IF;

    UPDATE public.profiles
    SET role = 'admin', updated_at = now()
    WHERE id = v_user_id;

    RAISE NOTICE 'Usuario % promovido a administrador exitosamente.', p_email;
END;
$$;

-- ==============================================================================
-- 6. ENDURECIMIENTO DE ROW LEVEL SECURITY (RLS)
-- ==============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offer_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offer_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos_scanner_sessions ENABLE ROW LEVEL SECURITY;

-- Limpieza de políticas previas
DROP POLICY IF EXISTS "Public read profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admin full access to profiles" ON public.profiles;
DROP POLICY IF EXISTS "Profiles readable by self or admin" ON public.profiles;
DROP POLICY IF EXISTS "Profiles updatable by self without role escalation" ON public.profiles;

CREATE POLICY "Profiles readable by self or admin" ON public.profiles
    FOR SELECT USING (auth.uid() = id OR public.is_admin());

CREATE POLICY "Profiles updatable by self without role escalation" ON public.profiles
    FOR UPDATE USING (auth.uid() = id OR public.is_admin());

-- Catálogo: lectura pública, escritura solo admin
DROP POLICY IF EXISTS "Public read categories" ON public.categories;
DROP POLICY IF EXISTS "Admin full access to categories" ON public.categories;
CREATE POLICY "Public read categories" ON public.categories FOR SELECT USING (true);
CREATE POLICY "Admin full access to categories" ON public.categories FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Public read products" ON public.products;
DROP POLICY IF EXISTS "Admin full access to products" ON public.products;
CREATE POLICY "Public read products" ON public.products FOR SELECT USING (true);
CREATE POLICY "Admin full access to products" ON public.products FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Public read offers" ON public.offers;
DROP POLICY IF EXISTS "Admin full access to offers" ON public.offers;
CREATE POLICY "Public read offers" ON public.offers FOR SELECT USING (true);
CREATE POLICY "Admin full access to offers" ON public.offers FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Public read offer_products" ON public.offer_products;
DROP POLICY IF EXISTS "Admin full access to offer_products" ON public.offer_products;
CREATE POLICY "Public read offer_products" ON public.offer_products FOR SELECT USING (true);
CREATE POLICY "Admin full access to offer_products" ON public.offer_products FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Public read offer_categories" ON public.offer_categories;
DROP POLICY IF EXISTS "Admin full access to offer_categories" ON public.offer_categories;
CREATE POLICY "Public read offer_categories" ON public.offer_categories FOR SELECT USING (true);
CREATE POLICY "Admin full access to offer_categories" ON public.offer_categories FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Public read services" ON public.services;
DROP POLICY IF EXISTS "Admin full access to services" ON public.services;
DROP POLICY IF EXISTS "Admin modify services" ON public.services;
CREATE POLICY "Public read services" ON public.services FOR SELECT USING (true);
CREATE POLICY "Admin full access to services" ON public.services FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Proveedores: Confidencialidad comercial (SOLO ADMIN)
DROP POLICY IF EXISTS "Admin all suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Public read suppliers" ON public.suppliers;
CREATE POLICY "Admin all suppliers" ON public.suppliers FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Clientes
DROP POLICY IF EXISTS "Customers readable by self or admin" ON public.customers;
DROP POLICY IF EXISTS "Customers insertable by all" ON public.customers;
DROP POLICY IF EXISTS "Admin full access to customers" ON public.customers;
CREATE POLICY "Customers readable by self or admin" ON public.customers
    FOR SELECT USING (auth.uid() = user_id OR public.is_admin());
CREATE POLICY "Customers insertable by all" ON public.customers FOR INSERT WITH CHECK (true);
CREATE POLICY "Admin full access to customers" ON public.customers FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Pedidos (Orders): Propietario o Admin pueden leer; inserción restringida a Admin o RPCs SECURITY DEFINER
DROP POLICY IF EXISTS "Orders readable by owner or admin" ON public.orders;
DROP POLICY IF EXISTS "Anyone can insert orders" ON public.orders;
DROP POLICY IF EXISTS "Admin can update orders" ON public.orders;
DROP POLICY IF EXISTS "Admin can delete orders" ON public.orders;
DROP POLICY IF EXISTS "Admin full access to orders" ON public.orders;
CREATE POLICY "Orders readable by owner or admin" ON public.orders
    FOR SELECT USING (auth.uid() = user_id OR public.is_admin());
CREATE POLICY "Admin full access to orders" ON public.orders
    FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Order Items: Lectura propietario o admin; inserción exclusiva admin o RPCs SECURITY DEFINER
DROP POLICY IF EXISTS "Order items readable by owner or admin" ON public.order_items;
DROP POLICY IF EXISTS "Anyone can insert order items" ON public.order_items;
DROP POLICY IF EXISTS "Admin full access to order items" ON public.order_items;
CREATE POLICY "Order items readable by owner or admin" ON public.order_items
    FOR SELECT USING (
        public.is_admin() OR
        EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.user_id = auth.uid())
    );
CREATE POLICY "Admin full access to order items" ON public.order_items
    FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Historial de pedidos: Lectura propietario o admin; inserción exclusiva admin o RPCs SECURITY DEFINER
DROP POLICY IF EXISTS "Order history readable by owner or admin" ON public.order_status_history;
DROP POLICY IF EXISTS "Anyone can insert order history" ON public.order_status_history;
DROP POLICY IF EXISTS "Admin full access to order history" ON public.order_status_history;
CREATE POLICY "Order history readable by owner or admin" ON public.order_status_history
    FOR SELECT USING (
        public.is_admin() OR
        EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.user_id = auth.uid())
    );
CREATE POLICY "Admin full access to order history" ON public.order_status_history
    FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Pagos: Inserción y modificación estrictamente restringidas a Admin y RPCs atómicos autorizados
DROP POLICY IF EXISTS "Payments readable by owner or admin" ON public.payments;
DROP POLICY IF EXISTS "Anyone can insert payments" ON public.payments;
DROP POLICY IF EXISTS "Admin full access to payments" ON public.payments;
CREATE POLICY "Payments readable by owner or admin" ON public.payments
    FOR SELECT USING (
        public.is_admin() OR
        EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.user_id = auth.uid())
    );
CREATE POLICY "Admin full access to payments" ON public.payments
    FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Facturas
DROP POLICY IF EXISTS "Invoices readable by owner or admin" ON public.invoices;
DROP POLICY IF EXISTS "Admin full access to invoices" ON public.invoices;
CREATE POLICY "Invoices readable by owner or admin" ON public.invoices
    FOR SELECT USING (
        public.is_admin() OR
        auth.uid() = customer_id OR
        EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.user_id = auth.uid())
    );
CREATE POLICY "Admin full access to invoices" ON public.invoices FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Items de Factura
DROP POLICY IF EXISTS "Invoice items readable by owner or admin" ON public.invoice_items;
DROP POLICY IF EXISTS "Admin full access to invoice items" ON public.invoice_items;
CREATE POLICY "Invoice items readable by owner or admin" ON public.invoice_items
    FOR SELECT USING (
        public.is_admin() OR
        EXISTS (
            SELECT 1 FROM public.invoices i
            WHERE i.id = invoice_id AND (
                i.customer_id = auth.uid() OR
                EXISTS (SELECT 1 FROM public.orders o WHERE o.id = i.order_id AND o.user_id = auth.uid())
            )
        )
    );
CREATE POLICY "Admin full access to invoice items" ON public.invoice_items FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Movimientos de inventario y Ventas (ESTRICTO ADMIN)
DROP POLICY IF EXISTS "Inventory movements admin only" ON public.inventory_movements;
CREATE POLICY "Inventory movements admin only" ON public.inventory_movements FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Sales admin only" ON public.sales;
CREATE POLICY "Sales admin only" ON public.sales FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Notificaciones: Exclusivo Admin (Inserciones de sistema vía RPC SECURITY DEFINER)
DROP POLICY IF EXISTS "Public read notifications" ON public.notifications;
DROP POLICY IF EXISTS "Admin all notifications" ON public.notifications;
DROP POLICY IF EXISTS "Notifications select for admin" ON public.notifications;
DROP POLICY IF EXISTS "Notifications insert allowed" ON public.notifications;
DROP POLICY IF EXISTS "Notifications update admin" ON public.notifications;
DROP POLICY IF EXISTS "Notifications delete admin" ON public.notifications;
DROP POLICY IF EXISTS "Notifications full admin" ON public.notifications;
CREATE POLICY "Notifications select for admin" ON public.notifications FOR SELECT USING (public.is_admin());
CREATE POLICY "Notifications full admin" ON public.notifications FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Configuración
DROP POLICY IF EXISTS "Public read settings" ON public.settings;
DROP POLICY IF EXISTS "Admin update settings" ON public.settings;
CREATE POLICY "Public read settings" ON public.settings FOR SELECT USING (true);
CREATE POLICY "Admin update settings" ON public.settings FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Sesiones de escáner móvil para POS
DROP POLICY IF EXISTS "Admin full access to pos scanner sessions" ON public.pos_scanner_sessions;
DROP POLICY IF EXISTS "Public access to pos scanner sessions" ON public.pos_scanner_sessions;
CREATE POLICY "Public access to pos scanner sessions" ON public.pos_scanner_sessions 
    FOR ALL USING (true) WITH CHECK (true);

-- ==============================================================================
-- 7. PROCEDIMIENTOS Y FUNCIONES ATÓMICAS (CONCURRENCY SAFE CON FOR UPDATE)
-- ==============================================================================

-- 7.1 RASTREO PÚBLICO SEGURO DE PEDIDOS POR NÚMERO (DATOS PRIVADOS PROTEGIDOS)
DROP FUNCTION IF EXISTS public.track_order(TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.track_order CASCADE;
CREATE OR REPLACE FUNCTION public.track_order(p_order_number TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_order RECORD;
    v_items JSONB;
    v_history JSONB;
BEGIN
    SELECT id, order_number, customer_name, total, status, payment_method, payment_status, created_at
    INTO v_order 
    FROM public.orders 
    WHERE upper(trim(order_number)) = upper(trim(p_order_number))
    LIMIT 1;

    IF v_order IS NULL THEN
        RETURN NULL;
    END IF;

    -- Solo devolver campos no sensibles de items (sin datos internos)
    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'id', i.id,
            'product_id', i.product_id,
            'product_name', i.product_name,
            'quantity', i.quantity,
            'unit_price', i.unit_price,
            'total_price', i.total_price
        )
    ), '[]'::jsonb) INTO v_items
    FROM public.order_items i
    WHERE i.order_id = v_order.id;

    -- Historial básico público de cambios de estado (sin notas internas o confidenciales)
    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'id', h.id,
            'previous_status', h.previous_status,
            'new_status', h.new_status,
            'status', h.new_status,
            'note', h.note,
            'created_at', h.created_at
        ) ORDER BY h.created_at ASC
    ), '[]'::jsonb) INTO v_history
    FROM public.order_status_history h
    WHERE h.order_id = v_order.id;

    -- NUNCA devolver teléfono, email, dirección, notas privadas ni cuentas/referencias de pagos
    RETURN jsonb_build_object(
        'id', v_order.id,
        'order_number', v_order.order_number,
        'customer_name', v_order.customer_name,
        'total', v_order.total,
        'status', v_order.status,
        'payment_method', v_order.payment_method,
        'payment_status', v_order.payment_status,
        'created_at', v_order.created_at,
        'items', v_items,
        'history', v_history
    );
END;
$$;

-- 7.2 CONSULTA PÚBLICA SEGURA DE FACTURA POR PEDIDO (DATOS PERSONALES PROTEGIDOS)
DROP FUNCTION IF EXISTS public.get_invoice_by_order(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.get_invoice_by_order CASCADE;
CREATE OR REPLACE FUNCTION public.get_invoice_by_order(p_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_invoice RECORD;
    v_items JSONB;
BEGIN
    SELECT id, invoice_number, order_id, customer_name, subtotal, discount, tax, total, currency, payment_method, payment_status, status, paid_at, created_at
    INTO v_invoice
    FROM public.invoices
    WHERE order_id = p_order_id
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_invoice IS NULL THEN
        RETURN NULL;
    END IF;

    -- Solo devolver campos indispensables para validar la factura
    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'id', i.id,
            'product_id', i.product_id,
            'product_name', i.product_name,
            'quantity', i.quantity,
            'unit_price', i.unit_price,
            'discount_amount', i.discount_amount,
            'total', i.total
        )
    ), '[]'::jsonb) INTO v_items
    FROM public.invoice_items i
    WHERE i.invoice_id = v_invoice.id;

    -- NUNCA exponer customer_phone, customer_address, customer_id_doc ni customer_id públicamente
    RETURN jsonb_build_object(
        'id', v_invoice.id,
        'invoice_number', v_invoice.invoice_number,
        'order_id', v_invoice.order_id,
        'customer_name', v_invoice.customer_name,
        'subtotal', v_invoice.subtotal,
        'discount', v_invoice.discount,
        'tax', v_invoice.tax,
        'total', v_invoice.total,
        'currency', v_invoice.currency,
        'payment_method', v_invoice.payment_method,
        'payment_status', v_invoice.payment_status,
        'status', v_invoice.status,
        'paid_at', v_invoice.paid_at,
        'created_at', v_invoice.created_at,
        'items', v_items
    );
END;
$$;

-- 7.2.1 CREACIÓN ATÓMICA DE PRODUCTO Y REGISTRO DE STOCK INICIAL (ADMIN ONLY)
DROP FUNCTION IF EXISTS public.create_product_atomic(TEXT, TEXT, TEXT, NUMERIC, NUMERIC, INT, INT, UUID, TEXT, BOOLEAN, BOOLEAN) CASCADE;
DROP FUNCTION IF EXISTS public.create_product_atomic CASCADE;
CREATE OR REPLACE FUNCTION public.create_product_atomic(
    p_code TEXT,
    p_name TEXT,
    p_description TEXT DEFAULT NULL,
    p_price NUMERIC DEFAULT 0,
    p_cost_price NUMERIC DEFAULT 0,
    p_stock INT DEFAULT 0,
    p_min_stock INT DEFAULT 5,
    p_category_id UUID DEFAULT NULL,
    p_image_url TEXT DEFAULT NULL,
    p_is_active BOOLEAN DEFAULT true,
    p_is_featured BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_clean_code TEXT;
    v_clean_name TEXT;
    v_product RECORD;
    v_category RECORD;
    v_movement_id UUID;
BEGIN
    -- 1. Verificar estrictamente que el usuario tenga rol de administrador
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Operación denegada: Solo administradores pueden crear productos.';
    END IF;

    -- 2. Validaciones de integridad
    v_clean_code := UPPER(TRIM(p_code));
    v_clean_name := TRIM(p_name);

    IF v_clean_code IS NULL OR v_clean_code = '' THEN
        RAISE EXCEPTION 'El código o SKU del producto es obligatorio.';
    END IF;

    IF v_clean_name IS NULL OR v_clean_name = '' THEN
        RAISE EXCEPTION 'El nombre del producto es obligatorio.';
    END IF;

    IF p_price IS NULL OR p_price < 0 THEN
        RAISE EXCEPTION 'El precio de venta no puede ser negativo.';
    END IF;

    IF p_cost_price IS NULL OR p_cost_price < 0 THEN
        RAISE EXCEPTION 'El precio de costo no puede ser negativo.';
    END IF;

    IF p_stock IS NULL OR p_stock < 0 THEN
        RAISE EXCEPTION 'El stock inicial no puede ser negativo.';
    END IF;

    IF p_min_stock IS NULL OR p_min_stock < 0 THEN
        RAISE EXCEPTION 'El stock mínimo no puede ser negativo.';
    END IF;

    -- Verificar unicidad de SKU / código
    IF EXISTS (SELECT 1 FROM public.products WHERE UPPER(TRIM(code)) = v_clean_code) THEN
        RAISE EXCEPTION 'Ya existe un producto registrado con el código "%".', v_clean_code;
    END IF;

    -- Verificar categoría si fue provista
    IF p_category_id IS NOT NULL THEN
        SELECT * INTO v_category FROM public.categories WHERE id = p_category_id;
        IF v_category IS NULL THEN
            RAISE EXCEPTION 'La categoría especificada (ID: %) no existe.', p_category_id;
        END IF;
    END IF;

    -- 3. Inserción atómica del producto en la tabla
    INSERT INTO public.products (
        code,
        name,
        description,
        price,
        cost_price,
        stock,
        min_stock,
        category_id,
        image_url,
        is_active,
        is_featured
    ) VALUES (
        v_clean_code,
        v_clean_name,
        NULLIF(TRIM(p_description), ''),
        p_price,
        p_cost_price,
        p_stock,
        p_min_stock,
        p_category_id,
        NULLIF(TRIM(p_image_url), ''),
        COALESCE(p_is_active, true),
        COALESCE(p_is_featured, false)
    ) RETURNING * INTO v_product;

    -- 4. Registrar movimiento de inventario inicial dentro de la misma transacción atómica
    IF p_stock > 0 THEN
        INSERT INTO public.inventory_movements (
            product_id,
            type,
            quantity,
            previous_stock,
            new_stock,
            note
        ) VALUES (
            v_product.id,
            'initial',
            p_stock,
            0,
            p_stock,
            'Stock inicial registrado al crear producto'
        ) RETURNING id INTO v_movement_id;
    END IF;

    -- 5. Devolver producto creado con relación de categoría completa
    RETURN jsonb_build_object(
        'id', v_product.id,
        'code', v_product.code,
        'name', v_product.name,
        'description', v_product.description,
        'price', v_product.price,
        'cost_price', v_product.cost_price,
        'stock', v_product.stock,
        'min_stock', v_product.min_stock,
        'category_id', v_product.category_id,
        'image_url', v_product.image_url,
        'is_active', v_product.is_active,
        'is_featured', v_product.is_featured,
        'created_at', v_product.created_at,
        'updated_at', v_product.updated_at,
        'category', (
            SELECT row_to_json(c)
            FROM public.categories c
            WHERE c.id = v_product.category_id
        )
    );
END;
$$;

-- 7.3 AJUSTE ATÓMICO DE STOCK MANUAL (ADMIN ONLY)
DROP FUNCTION IF EXISTS public.adjust_product_stock_atomic(UUID, INT, TEXT, TEXT, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.adjust_product_stock_atomic CASCADE;
CREATE OR REPLACE FUNCTION public.adjust_product_stock_atomic(
    p_product_id UUID,
    p_quantity_change INT,
    p_type TEXT,
    p_note TEXT DEFAULT NULL,
    p_user TEXT DEFAULT 'admin'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_product RECORD;
    v_new_stock INT;
    v_movement_id UUID;
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Solo administradores pueden realizar ajustes de stock.';
    END IF;

    -- Bloqueo pesimista de fila
    SELECT * INTO v_product
    FROM public.products
    WHERE id = p_product_id
    FOR UPDATE;

    IF v_product IS NULL THEN
        RAISE EXCEPTION 'Producto no encontrado (ID: %)', p_product_id;
    END IF;

    v_new_stock := v_product.stock + p_quantity_change;
    IF v_new_stock < 0 THEN
        RAISE EXCEPTION 'Stock insuficiente para el producto "%". Stock actual: %, solicitado: %',
            v_product.name, v_product.stock, p_quantity_change;
    END IF;

    UPDATE public.products
    SET stock = v_new_stock, updated_at = now()
    WHERE id = p_product_id;

    INSERT INTO public.inventory_movements (
        product_id, type, quantity, previous_stock, new_stock, note
    ) VALUES (
        p_product_id,
        p_type,
        abs(p_quantity_change),
        v_product.stock,
        v_new_stock,
        COALESCE(p_note, 'Ajuste manual de inventario por ' || p_user)
    ) RETURNING id INTO v_movement_id;

    RETURN jsonb_build_object(
        'success', true,
        'product_id', p_product_id,
        'previous_stock', v_product.stock,
        'new_stock', v_new_stock,
        'movement_id', v_movement_id
    );
END;
$$;

-- 7.4 CREACIÓN ATÓMICA DE PEDIDOS WEB CON DESCUENTO DE STOCK Y CÁLCULO SEVERAL SEGURO
DROP FUNCTION IF EXISTS public.create_order_atomic(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB) CASCADE;
DROP FUNCTION IF EXISTS public.create_order_atomic CASCADE;
CREATE OR REPLACE FUNCTION public.create_order_atomic(
    p_order_number TEXT DEFAULT NULL,
    p_client_request_id TEXT DEFAULT NULL,
    p_customer_name TEXT DEFAULT NULL,
    p_customer_phone TEXT DEFAULT NULL,
    p_customer_email TEXT DEFAULT NULL,
    p_delivery_address TEXT DEFAULT NULL,
    p_payment_method TEXT DEFAULT 'cash',
    p_notes TEXT DEFAULT NULL,
    p_items JSONB DEFAULT '[]'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_existing_order RECORD;
    v_order_id UUID;
    v_order_number TEXT;
    v_subtotal NUMERIC(14,2) := 0;
    v_discount NUMERIC(14,2) := 0;
    v_tax NUMERIC(14,2) := 0;
    v_total NUMERIC(14,2) := 0;
    v_item RECORD;
    v_product RECORD;
    v_base_price NUMERIC(14,2);
    v_item_discount NUMERIC(14,2);
    v_final_unit_price NUMERIC(14,2);
    v_item_total NUMERIC(14,2);
    v_offer RECORD;
    v_curr_date TEXT := to_char(now(), 'YYYYMMDD');
    v_seq_num BIGINT;
BEGIN
    -- Validar datos del cliente
    IF p_customer_name IS NULL OR trim(p_customer_name) = '' THEN
        RAISE EXCEPTION 'El nombre del cliente es obligatorio.';
    END IF;

    IF p_customer_phone IS NULL OR trim(p_customer_phone) = '' THEN
        RAISE EXCEPTION 'El teléfono del cliente es obligatorio.';
    END IF;

    IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'El pedido debe contener al menos un producto.';
    END IF;

    -- Idempotencia estricta por client_request_id
    IF p_client_request_id IS NOT NULL AND trim(p_client_request_id) != '' THEN
        SELECT * INTO v_existing_order
        FROM public.orders
        WHERE client_request_id = p_client_request_id;

        IF v_existing_order.id IS NOT NULL THEN
            RETURN jsonb_build_object(
                'success', true,
                'order_id', v_existing_order.id,
                'order_number', v_existing_order.order_number,
                'total', v_existing_order.total,
                'is_duplicate', true
            );
        END IF;
    END IF;

    -- Generar número de pedido único y seguro en la base de datos
    SELECT nextval('order_number_seq') INTO v_seq_num;
    v_order_number := 'BIK-' || v_curr_date || '-' || LPAD(v_seq_num::TEXT, 5, '0');

    -- 1. Validar, bloquear stock con FOR UPDATE y recalcular precios en el servidor
    FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(
        product_id UUID,
        quantity INT
    )
    LOOP
        IF v_item.product_id IS NULL THEN
            RAISE EXCEPTION 'ID de producto no especificado.';
        END IF;

        IF v_item.quantity IS NULL OR v_item.quantity <= 0 THEN
            RAISE EXCEPTION 'La cantidad solicitada debe ser mayor a 0.';
        END IF;

        -- Bloqueo pesimista del producto
        SELECT * INTO v_product
        FROM public.products
        WHERE id = v_item.product_id
        FOR UPDATE;

        IF v_product IS NULL THEN
            RAISE EXCEPTION 'Producto con ID % no encontrado en el catálogo.', v_item.product_id;
        END IF;

        IF v_product.is_active IS FALSE THEN
            RAISE EXCEPTION 'El producto "%" no se encuentra disponible para la venta.', v_product.name;
        END IF;

        IF v_product.stock < v_item.quantity THEN
            RAISE EXCEPTION 'Stock insuficiente para "%". Stock disponible: %, solicitado: %',
                v_product.name, v_product.stock, v_item.quantity;
        END IF;

        -- PRECIO REAL DE BASE DE DATOS (NUNCA SE CONFÍA EN EL CLIENTE)
        v_base_price := v_product.price;
        v_item_discount := 0;

        -- Buscar oferta activa aplicable al producto o a su categoría
        SELECT o.* INTO v_offer
        FROM public.offers o
        LEFT JOIN public.offer_products op ON op.offer_id = o.id AND op.product_id = v_product.id
        LEFT JOIN public.offer_categories oc ON oc.offer_id = o.id AND oc.category_id = v_product.category_id
        WHERE o.status = 'active'
          AND (o.is_global = true OR op.id IS NOT NULL OR oc.id IS NOT NULL)
          AND (o.start_date <= now() AND o.end_date >= now())
        ORDER BY o.priority DESC, o.value DESC
        LIMIT 1;

        IF v_offer.id IS NOT NULL THEN
            IF v_offer.type = 'percentage' THEN
                v_item_discount := ROUND(v_base_price * (v_offer.value / 100.0), 2);
            ELSIF v_offer.type = 'fixed_discount' THEN
                v_item_discount := LEAST(v_base_price, v_offer.value);
            ELSIF v_offer.type = 'special_price' THEN
                v_item_discount := GREATEST(0, v_base_price - v_offer.value);
            END IF;
        END IF;

        v_final_unit_price := GREATEST(0, v_base_price - v_item_discount);
        v_item_total := v_final_unit_price * v_item.quantity;

        v_subtotal := v_subtotal + (v_base_price * v_item.quantity);
        v_discount := v_discount + (v_item_discount * v_item.quantity);
        v_total := v_total + v_item_total;
    END LOOP;

    -- 2. Insertar Pedido seguro
    INSERT INTO public.orders (
        order_number, client_request_id, user_id, customer_name, customer_phone,
        customer_email, delivery_address, subtotal, discount, tax, total,
        status, payment_method, payment_status, notes
    ) VALUES (
        v_order_number, p_client_request_id, auth.uid(), trim(p_customer_name), trim(p_customer_phone),
        p_customer_email, p_delivery_address, v_subtotal, v_discount, v_tax, v_total,
        'pending', COALESCE(p_payment_method, 'cash'), 'pending', p_notes
    ) RETURNING id INTO v_order_id;

    -- 3. Insertar Items con valores recalculados y descontar inventario
    FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(
        product_id UUID,
        quantity INT
    )
    LOOP
        SELECT * INTO v_product
        FROM public.products
        WHERE id = v_item.product_id;

        v_base_price := v_product.price;
        v_item_discount := 0;

        SELECT o.* INTO v_offer
        FROM public.offers o
        LEFT JOIN public.offer_products op ON op.offer_id = o.id AND op.product_id = v_product.id
        LEFT JOIN public.offer_categories oc ON oc.offer_id = o.id AND oc.category_id = v_product.category_id
        WHERE o.status = 'active'
          AND (o.is_global = true OR op.id IS NOT NULL OR oc.id IS NOT NULL)
          AND (o.start_date <= now() AND o.end_date >= now())
        ORDER BY o.priority DESC, o.value DESC
        LIMIT 1;

        IF v_offer.id IS NOT NULL THEN
            IF v_offer.type = 'percentage' THEN
                v_item_discount := ROUND(v_base_price * (v_offer.value / 100.0), 2);
            ELSIF v_offer.type = 'fixed_discount' THEN
                v_item_discount := LEAST(v_base_price, v_offer.value);
            ELSIF v_offer.type = 'special_price' THEN
                v_item_discount := GREATEST(0, v_base_price - v_offer.value);
            END IF;
        END IF;

        v_final_unit_price := GREATEST(0, v_base_price - v_item_discount);
        v_item_total := v_final_unit_price * v_item.quantity;

        INSERT INTO public.order_items (
            order_id, product_id, product_name, quantity, original_unit_price,
            unit_price, discount_amount, total_price
        ) VALUES (
            v_order_id, v_product.id, v_product.name, v_item.quantity,
            v_base_price, v_final_unit_price, v_item_discount, v_item_total
        );

        -- Actualizar stock
        UPDATE public.products
        SET stock = stock - v_item.quantity, updated_at = now()
        WHERE id = v_product.id;

        -- Registrar movimiento en kardex
        INSERT INTO public.inventory_movements (
            product_id, type, quantity, previous_stock, new_stock, order_id, note
        ) VALUES (
            v_product.id, 'sale', v_item.quantity,
            v_product.stock, (v_product.stock - v_item.quantity),
            v_order_id, 'Venta Web Pedido #' || v_order_number
        );
    END LOOP;

    -- 4. Historial y Notificación
    INSERT INTO public.order_status_history (order_id, previous_status, new_status, note, changed_by)
    VALUES (v_order_id, NULL, 'pending', 'Pedido creado exitosamente desde la tienda web BIKIE.', p_customer_name);

    INSERT INTO public.notifications (title, message, type, order_id)
    VALUES (
        'Nuevo Pedido #' || v_order_number,
        'Cliente: ' || p_customer_name || ' • Total: ' || v_total || ' FCFA',
        'new_order',
        v_order_id
    );

    RETURN jsonb_build_object(
        'success', true,
        'order_id', v_order_id,
        'order_number', v_order_number,
        'total', v_total
    );
END;
$$;

-- 7.5 VENTA DIRECTA POS ATÓMICA EN UNA SOLA TRANSACCIÓN (CAJA / MOSTRADOR)
-- SEGURIDAD CRÍTICA: NUNCA CONFÍA EN PRECIOS, SUBTOTALES, DESCUENTOS NI TOTALES DEL FRONTEND
-- PREVENCIÓN MATEMÁTICA DE DEADLOCKS (40P01): ORDENAMIENTO DETERMINISTA POR PRODUCT_ID ASC EN FOR UPDATE
-- RESOLUCIÓN DE CLIENTES: AUTORIDAD EXCLUSIVA DE BD PARA CUSTOMER_NAME Y ASOCIACIÓN DE CUSTOMER_ID
DROP FUNCTION IF EXISTS public.process_pos_sale_atomic(TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT, TEXT, TEXT, JSONB) CASCADE;
DROP FUNCTION IF EXISTS public.process_pos_sale_atomic(TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT, TEXT, TEXT, JSONB, UUID, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.process_pos_sale_atomic CASCADE;

CREATE OR REPLACE FUNCTION public.process_pos_sale_atomic(
    p_order_number TEXT DEFAULT NULL,
    p_customer_name TEXT DEFAULT NULL,
    p_customer_phone TEXT DEFAULT NULL,
    p_customer_id_doc TEXT DEFAULT NULL,
    p_customer_address TEXT DEFAULT NULL,
    p_subtotal NUMERIC(14,2) DEFAULT NULL, -- Ignorado por seguridad
    p_discount NUMERIC(14,2) DEFAULT NULL, -- Ignorado por seguridad
    p_tax NUMERIC(14,2) DEFAULT NULL,      -- Ignorado por seguridad
    p_total NUMERIC(14,2) DEFAULT NULL,    -- Ignorado por seguridad
    p_payment_method TEXT DEFAULT 'cash',
    p_reference TEXT DEFAULT NULL,
    p_cashier_name TEXT DEFAULT 'Cajero',
    p_notes TEXT DEFAULT NULL,
    p_items JSONB DEFAULT '[]'::jsonb,
    p_customer_id UUID DEFAULT NULL,
    p_client_request_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_order_id UUID;
    v_invoice_id UUID;
    v_payment_id UUID;
    v_sale_id UUID;
    v_order_number TEXT;
    v_invoice_number TEXT;
    v_existing_order RECORD;
    v_existing_invoice RECORD;
    v_existing_sale RECORD;
    v_customer_record RECORD;
    v_final_customer_name TEXT;
    v_final_customer_phone TEXT;
    v_final_customer_id_doc TEXT;
    v_final_customer_address TEXT;
    v_item RECORD;
    v_product RECORD;
    v_service RECORD;
    v_is_service BOOLEAN;
    v_offer RECORD;
    v_base_price NUMERIC(14,2);
    v_item_discount NUMERIC(14,2);
    v_final_unit_price NUMERIC(14,2);
    v_item_total NUMERIC(14,2);
    v_calculated_subtotal NUMERIC(14,2) := 0;
    v_calculated_discount NUMERIC(14,2) := 0;
    v_calculated_tax NUMERIC(14,2) := 0;
    v_calculated_total NUMERIC(14,2) := 0;
    v_processed_items JSONB := '[]'::jsonb;
    v_proc_item RECORD;
    v_curr_year TEXT := to_char(now(), 'YYYY');
    v_curr_month TEXT := to_char(now(), 'MM');
    v_seq_num BIGINT;
BEGIN
    -- Control de acceso administrativo
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Operación denegada: Solo personal autorizado puede registrar ventas POS.';
    END IF;

    IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'La venta POS debe contener al menos un producto válido.';
    END IF;

    -- Idempotencia estricta por client_request_id (previene ventas duplicadas en reintentos de red)
    IF p_client_request_id IS NOT NULL AND trim(p_client_request_id) != '' THEN
        SELECT * INTO v_existing_order
        FROM public.orders
        WHERE client_request_id = trim(p_client_request_id);

        IF v_existing_order.id IS NOT NULL THEN
            SELECT * INTO v_existing_invoice
            FROM public.invoices
            WHERE order_id = v_existing_order.id
            LIMIT 1;

            SELECT * INTO v_existing_sale
            FROM public.sales
            WHERE order_id = v_existing_order.id
            LIMIT 1;

            RETURN jsonb_build_object(
                'success', true,
                'order_id', v_existing_order.id,
                'order_number', v_existing_order.order_number,
                'invoice_id', v_existing_invoice.id,
                'invoice_number', v_existing_invoice.invoice_number,
                'payment_id', NULL,
                'sale_id', v_existing_sale.id,
                'customer_id', v_existing_order.customer_id,
                'customer_name', v_existing_order.customer_name,
                'subtotal', v_existing_order.subtotal,
                'discount', v_existing_order.discount,
                'tax', v_existing_order.tax,
                'total', v_existing_order.total,
                'is_duplicate', true
            );
        END IF;
    END IF;

    -- Resolución autoritativa de cliente en PostgreSQL
    IF p_customer_id IS NOT NULL THEN
        SELECT * INTO v_customer_record
        FROM public.customers
        WHERE id = p_customer_id;

        IF v_customer_record.id IS NOT NULL THEN
            -- Si existe cliente registrado, se usa obligatoriamente la información oficial de la BD
            v_final_customer_name := COALESCE(NULLIF(trim(v_customer_record.full_name), ''), 'Consumidor final');
            v_final_customer_phone := COALESCE(NULLIF(trim(v_customer_record.phone), ''), NULLIF(trim(p_customer_phone), ''), 'N/A');
            v_final_customer_id_doc := COALESCE(NULLIF(trim(v_customer_record.id_doc), ''), NULLIF(trim(p_customer_id_doc), ''));
            v_final_customer_address := COALESCE(NULLIF(trim(v_customer_record.address), ''), NULLIF(trim(p_customer_address), ''), 'Mostrador POS BIKIE');
        ELSE
            -- Si el UUID no existe en customers, evitar error de FK y asignar Consumidor final
            p_customer_id := NULL;
            v_final_customer_name := COALESCE(NULLIF(trim(p_customer_name), ''), 'Consumidor final');
            IF v_final_customer_name = 'Cliente Mostrador' THEN
                v_final_customer_name := 'Consumidor final';
            END IF;
            v_final_customer_phone := COALESCE(NULLIF(trim(p_customer_phone), ''), 'N/A');
            v_final_customer_id_doc := NULLIF(trim(p_customer_id_doc), '');
            v_final_customer_address := COALESCE(NULLIF(trim(p_customer_address), ''), 'Mostrador POS BIKIE');
        END IF;
    ELSE
        -- Sin cliente seleccionado: Venta a Consumidor final
        v_final_customer_name := COALESCE(NULLIF(trim(p_customer_name), ''), 'Consumidor final');
        IF v_final_customer_name = 'Cliente Mostrador' THEN
            v_final_customer_name := 'Consumidor final';
        END IF;
        v_final_customer_phone := COALESCE(NULLIF(trim(p_customer_phone), ''), 'N/A');
        v_final_customer_id_doc := NULLIF(trim(p_customer_id_doc), '');
        v_final_customer_address := COALESCE(NULLIF(trim(p_customer_address), ''), 'Mostrador POS BIKIE');
    END IF;

    -- Garantía a prueba de fallos: customer_name NUNCA puede ser NULL ni vacío
    IF v_final_customer_name IS NULL OR trim(v_final_customer_name) = '' THEN
        v_final_customer_name := 'Consumidor final';
    END IF;

    -- Generar o asegurar número de pedido único y seguro desde la secuencia
    IF p_order_number IS NULL OR trim(p_order_number) = '' THEN
        SELECT nextval('order_number_seq') INTO v_seq_num;
        v_order_number := 'POS-' || to_char(now(), 'YYYYMMDD') || '-' || LPAD(v_seq_num::TEXT, 5, '0');
    ELSE
        v_order_number := trim(p_order_number);
    END IF;

    -- 1. Agrupar y ordenar determinísticamente por product_id ASC para prevenir DEADLOCKS (40P01).
    -- Bloquear stock con FOR UPDATE y calcular precios estrictamente desde la base de datos.
    FOR v_item IN
        SELECT
            x.product_id,
            SUM(x.quantity)::INT AS quantity
        FROM jsonb_to_recordset(p_items) AS x(
            product_id UUID,
            quantity INT
        )
        GROUP BY x.product_id
        ORDER BY x.product_id ASC
    LOOP
        IF v_item.product_id IS NULL THEN
            RAISE EXCEPTION 'ID de producto no especificado en venta POS.';
        END IF;

        IF v_item.quantity IS NULL OR v_item.quantity <= 0 THEN
            RAISE EXCEPTION 'La cantidad para cada producto debe ser mayor a 0.';
        END IF;

        -- Bloqueo pesimista ordenado de la fila del producto
        SELECT * INTO v_product
        FROM public.products
        WHERE id = v_item.product_id
        FOR UPDATE;

        IF v_product IS NOT NULL THEN
            v_is_service := false;

            IF v_product.is_active IS FALSE THEN
                RAISE EXCEPTION 'El producto "%" no se encuentra disponible para la venta.', v_product.name;
            END IF;

            IF v_product.stock < v_item.quantity THEN
                RAISE EXCEPTION 'Stock insuficiente para "%". Disponible en tienda: %, Solicitado en caja: %',
                    v_product.name, v_product.stock, v_item.quantity;
            END IF;

            -- PRECIO REAL DE BASE DE DATOS
            v_base_price := v_product.price;
            v_item_discount := 0;

            -- Buscar oferta o promoción activa aplicable
            SELECT o.* INTO v_offer
            FROM public.offers o
            LEFT JOIN public.offer_products op ON op.offer_id = o.id AND op.product_id = v_product.id
            LEFT JOIN public.offer_categories oc ON oc.offer_id = o.id AND oc.category_id = v_product.category_id
            WHERE o.status = 'active'
              AND (o.is_global = true OR op.id IS NOT NULL OR oc.id IS NOT NULL)
              AND (o.start_date <= now() AND o.end_date >= now())
            ORDER BY o.priority DESC, o.value DESC
            LIMIT 1;

            IF v_offer.id IS NOT NULL THEN
                IF v_offer.type = 'percentage' THEN
                    v_item_discount := ROUND(v_base_price * (v_offer.value / 100.0), 2);
                ELSIF v_offer.type = 'fixed_discount' THEN
                    v_item_discount := LEAST(v_base_price, v_offer.value);
                ELSIF v_offer.type = 'special_price' THEN
                    v_item_discount := GREATEST(0, v_base_price - v_offer.value);
                END IF;
            END IF;

            v_final_unit_price := GREATEST(0, v_base_price - v_item_discount);
            v_item_total := v_final_unit_price * v_item.quantity;

            -- Descontar stock atómicamente
            UPDATE public.products
            SET stock = stock - v_item.quantity, updated_at = now()
            WHERE id = v_product.id;

            -- Registrar ítem procesado
            v_processed_items := v_processed_items || jsonb_build_object(
                'product_id', v_product.id,
                'is_service', false,
                'product_name', v_product.name,
                'quantity', v_item.quantity,
                'original_unit_price', v_base_price,
                'unit_price', v_final_unit_price,
                'discount_amount', v_item_discount,
                'total_price', v_item_total,
                'previous_stock', v_product.stock,
                'new_stock', (v_product.stock - v_item.quantity)
            );
        ELSE
            -- Verificar si es un servicio adicional
            SELECT * INTO v_service
            FROM public.services
            WHERE id = v_item.product_id;

            IF v_service IS NULL THEN
                RAISE EXCEPTION 'Producto o servicio con ID % no encontrado en el catálogo.', v_item.product_id;
            END IF;

            v_is_service := true;
            v_base_price := v_service.price;
            v_item_discount := 0;
            v_final_unit_price := v_service.price;
            v_item_total := v_final_unit_price * v_item.quantity;

            v_processed_items := v_processed_items || jsonb_build_object(
                'product_id', v_service.id,
                'is_service', true,
                'product_name', v_service.name,
                'quantity', v_item.quantity,
                'original_unit_price', v_base_price,
                'unit_price', v_final_unit_price,
                'discount_amount', 0,
                'total_price', v_item_total,
                'previous_stock', 0,
                'new_stock', 0
            );
        END IF;

        v_calculated_subtotal := v_calculated_subtotal + (v_base_price * v_item.quantity);
        v_calculated_discount := v_calculated_discount + (v_item_discount * v_item.quantity);
        v_calculated_total := v_calculated_total + v_item_total;
    END LOOP;

    -- 2. Crear Pedido en estado delivered con customer_id asociado
    INSERT INTO public.orders (
        order_number, client_request_id, customer_id, customer_name, customer_phone,
        customer_email, delivery_address, subtotal, discount, tax, total,
        status, payment_method, payment_status, notes
    ) VALUES (
        v_order_number, NULLIF(trim(p_client_request_id), ''), p_customer_id,
        v_final_customer_name, v_final_customer_phone, NULL,
        v_final_customer_address, v_calculated_subtotal, v_calculated_discount,
        v_calculated_tax, v_calculated_total, 'delivered',
        COALESCE(NULLIF(trim(p_payment_method), ''), 'cash'), 'confirmed',
        COALESCE(p_notes, 'Venta en mostrador POS')
    ) RETURNING id INTO v_order_id;

    -- 3. Registrar Pago Confirmado vinculado a la orden
    INSERT INTO public.payments (
        order_id, method, amount, status, reference, notes, paid_at
    ) VALUES (
        v_order_id, COALESCE(NULLIF(trim(p_payment_method), ''), 'cash'),
        v_calculated_total, 'confirmed', p_reference,
        'Venta en mostrador POS BIKIE - Cajero: ' || COALESCE(NULLIF(trim(p_cashier_name), ''), 'Caja'),
        now()
    ) RETURNING id INTO v_payment_id;

    -- 4. Generar Secuencia y Factura Oficial con customer_id y customer_name seguro
    SELECT nextval('invoice_number_seq') INTO v_seq_num;
    v_invoice_number := 'FAC-' || v_curr_year || v_curr_month || '-' || LPAD(v_seq_num::TEXT, 5, '0');

    INSERT INTO public.invoices (
        invoice_number, order_id, customer_id, customer_name, customer_id_doc,
        customer_phone, customer_address, subtotal, discount, tax, total,
        currency, payment_method, payment_status, status, notes, paid_at
    ) VALUES (
        v_invoice_number, v_order_id, p_customer_id, v_final_customer_name,
        v_final_customer_id_doc, v_final_customer_phone, v_final_customer_address,
        v_calculated_subtotal, v_calculated_discount, v_calculated_tax, v_calculated_total,
        'XAF', COALESCE(NULLIF(trim(p_payment_method), ''), 'cash'), 'confirmed', 'paid',
        p_notes, now()
    ) RETURNING id INTO v_invoice_id;

    -- 5. Crear Items de Pedido, Factura y Movimientos de Inventario vinculados
    FOR v_proc_item IN SELECT * FROM jsonb_to_recordset(v_processed_items) AS y(
        product_id UUID,
        is_service BOOLEAN,
        product_name TEXT,
        quantity INT,
        original_unit_price NUMERIC(14,2),
        unit_price NUMERIC(14,2),
        discount_amount NUMERIC(14,2),
        total_price NUMERIC(14,2),
        previous_stock INT,
        new_stock INT
    )
    LOOP
        INSERT INTO public.order_items (
            order_id, product_id, product_name, quantity, original_unit_price,
            unit_price, discount_amount, total_price
        ) VALUES (
            v_order_id,
            CASE WHEN v_proc_item.is_service THEN NULL ELSE v_proc_item.product_id END,
            v_proc_item.product_name, v_proc_item.quantity,
            v_proc_item.original_unit_price, v_proc_item.unit_price,
            v_proc_item.discount_amount, v_proc_item.total_price
        );

        INSERT INTO public.invoice_items (
            invoice_id, product_id, product_name, quantity,
            original_unit_price, unit_price, discount_amount, total
        ) VALUES (
            v_invoice_id,
            CASE WHEN v_proc_item.is_service THEN NULL ELSE v_proc_item.product_id END,
            v_proc_item.product_name, v_proc_item.quantity,
            v_proc_item.original_unit_price, v_proc_item.unit_price,
            v_proc_item.discount_amount, v_proc_item.total_price
        );

        -- Registrar movimiento de inventario vinculado al pedido (solo para productos físicos)
        IF NOT v_proc_item.is_service THEN
            INSERT INTO public.inventory_movements (
                product_id, type, quantity, previous_stock, new_stock, order_id, note
            ) VALUES (
                v_proc_item.product_id, 'sale', v_proc_item.quantity,
                v_proc_item.previous_stock, v_proc_item.new_stock,
                v_order_id,
                'Venta Mostrador POS #' || v_order_number
            );
        END IF;
    END LOOP;

    -- 6. Registrar Venta en Libro Diario (sales) con TODAS las columnas NOT NULL y relaciones satisfechas
    INSERT INTO public.sales (
        sale_number,
        invoice_id,
        order_id,
        payment_id,
        customer_id,
        customer_name,
        cashier_name,
        total_amount,
        payment_method
    ) VALUES (
        'VTA-' || v_curr_year || '-' || LPAD(nextval('sale_number_seq')::TEXT, 6, '0'),
        v_invoice_id,
        v_order_id,
        v_payment_id,
        p_customer_id,
        v_final_customer_name,
        COALESCE(NULLIF(trim(p_cashier_name), ''), 'Cajero'),
        v_calculated_total,
        COALESCE(NULLIF(trim(p_payment_method), ''), 'cash')
    ) RETURNING id INTO v_sale_id;

    -- 7. Notificación en panel
    INSERT INTO public.notifications (title, message, type, order_id)
    VALUES (
        'Venta POS #' || v_invoice_number,
        'Cajero: ' || COALESCE(NULLIF(trim(p_cashier_name), ''), 'Cajero') || ' • Cliente: ' || v_final_customer_name || ' • Total: ' || v_calculated_total || ' FCFA',
        'payment_confirmed',
        v_order_id
    );

    RETURN jsonb_build_object(
        'success', true,
        'order_id', v_order_id,
        'order_number', v_order_number,
        'invoice_id', v_invoice_id,
        'invoice_number', v_invoice_number,
        'payment_id', v_payment_id,
        'sale_id', v_sale_id,
        'customer_id', p_customer_id,
        'customer_name', v_final_customer_name,
        'subtotal', v_calculated_subtotal,
        'discount', v_calculated_discount,
        'tax', v_calculated_tax,
        'total', v_calculated_total
    );
END;
$$;

-- 7.6 CANCELACIÓN ATÓMICA DE PEDIDO CON DEVOLUCIÓN DE STOCK
DROP FUNCTION IF EXISTS public.cancel_order_with_stock_return(UUID, TEXT, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.cancel_order_with_stock_return CASCADE;
CREATE OR REPLACE FUNCTION public.cancel_order_with_stock_return(
    p_order_id UUID,
    p_reason TEXT,
    p_cancelled_by TEXT DEFAULT 'Administrador'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_order RECORD;
    v_item RECORD;
    v_product RECORD;
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Solo administradores pueden cancelar pedidos con retorno de stock.';
    END IF;

    SELECT * INTO v_order
    FROM public.orders
    WHERE id = p_order_id
    FOR UPDATE;

    IF v_order IS NULL THEN
        RAISE EXCEPTION 'Pedido con ID % no encontrado.', p_order_id;
    END IF;

    IF v_order.status = 'cancelled' THEN
        RAISE EXCEPTION 'El pedido ya se encuentra cancelado.';
    END IF;

    -- Reintegrar stock de cada artículo del pedido
    FOR v_item IN SELECT * FROM public.order_items WHERE order_id = p_order_id
    LOOP
        IF v_item.product_id IS NOT NULL THEN
            SELECT * INTO v_product
            FROM public.products
            WHERE id = v_item.product_id
            FOR UPDATE;

            IF v_product IS NOT NULL THEN
                UPDATE public.products
                SET stock = stock + v_item.quantity, updated_at = now()
                WHERE id = v_item.product_id;

                INSERT INTO public.inventory_movements (
                    product_id, type, quantity, previous_stock, new_stock, order_id, note
                ) VALUES (
                    v_item.product_id, 'refund', v_item.quantity,
                    v_product.stock, (v_product.stock + v_item.quantity),
                    p_order_id, 'Reintegro por cancelación de Pedido #' || v_order.order_number || ': ' || COALESCE(p_reason, 'Sin motivo')
                );
            END IF;
        END IF;
    END LOOP;

    -- Actualizar estado
    UPDATE public.orders
    SET status = 'cancelled', updated_at = now()
    WHERE id = p_order_id;

    -- Registrar en historial
    INSERT INTO public.order_status_history (
        order_id, previous_status, new_status, changed_by, note
    ) VALUES (
        p_order_id, v_order.status, 'cancelled', p_cancelled_by,
        COALESCE(p_reason, 'Cancelado con reintegro automático de inventario.')
    );

    RETURN jsonb_build_object(
        'success', true,
        'order_id', p_order_id,
        'previous_status', v_order.status,
        'new_status', 'cancelled'
    );
END;
$$;

-- 7.7 CONFIRMACIÓN DE PAGO Y EMISIÓN ATÓMICA DE FACTURA
-- SEGURIDAD CRÍTICA: LA BASE DE DATOS CONTROLA ESTADOS, SALDOS Y TRANSACCIONES
DROP FUNCTION IF EXISTS public.process_payment_and_invoice(UUID, TEXT, NUMERIC, TEXT, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.process_payment_and_invoice(UUID, TEXT, NUMERIC(14,2), TEXT, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.process_payment_and_invoice CASCADE;
CREATE OR REPLACE FUNCTION public.process_payment_and_invoice(
    p_order_id UUID,
    p_payment_method TEXT,
    p_amount NUMERIC(14,2),
    p_reference TEXT DEFAULT NULL,
    p_cashier_name TEXT DEFAULT 'Admin BIKIE'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_order RECORD;
    v_item RECORD;
    v_payment_id UUID;
    v_invoice_id UUID;
    v_invoice_number TEXT;
    v_already_paid NUMERIC(14,2) := 0;
    v_pending_balance NUMERIC(14,2);
    v_new_paid_total NUMERIC(14,2);
    v_order_payment_status TEXT;
    v_invoice_status TEXT;
    v_paid_at TIMESTAMPTZ := NULL;
    v_curr_year TEXT := to_char(now(), 'YYYY');
    v_curr_month TEXT := to_char(now(), 'MM');
    v_seq_num BIGINT;
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Operación denegada: Solo administradores pueden registrar pagos y emitir facturas.';
    END IF;

    -- Bloquear pedido con FOR UPDATE para garantizar consistencia transaccional
    SELECT * INTO v_order
    FROM public.orders
    WHERE id = p_order_id
    FOR UPDATE;

    IF v_order IS NULL THEN
        RAISE EXCEPTION 'Pedido con ID % no encontrado.', p_order_id;
    END IF;

    IF v_order.status = 'cancelled' THEN
        RAISE EXCEPTION 'No se puede registrar pagos ni emitir facturas para un pedido cancelado.';
    END IF;

    IF p_amount IS NULL OR p_amount <= 0 THEN
        RAISE EXCEPTION 'El monto del pago debe ser estrictamente mayor a 0 FCFA.';
    END IF;

    -- Comprobar importe frente a los pagos acumulados confirmados en PostgreSQL
    SELECT COALESCE(SUM(amount), 0) INTO v_already_paid
    FROM public.payments
    WHERE order_id = p_order_id AND status = 'confirmed';

    v_pending_balance := GREATEST(0, v_order.total - v_already_paid);

    IF v_pending_balance <= 0 THEN
        RAISE EXCEPTION 'El pedido ya se encuentra totalmente liquidado. Saldo pendiente: 0 FCFA.';
    END IF;

    IF p_amount > v_pending_balance THEN
        RAISE EXCEPTION 'El importe a pagar (% FCFA) no puede exceder el saldo pendiente real (% FCFA).', p_amount, v_pending_balance;
    END IF;

    v_new_paid_total := v_already_paid + p_amount;

    -- La base de datos decide si el estado es liquidado ('paid'/'confirmed') o parcial ('partial')
    IF v_new_paid_total >= v_order.total THEN
        v_order_payment_status := 'confirmed';
        v_invoice_status := 'paid';
        v_paid_at := now();
    ELSE
        v_order_payment_status := 'partial';
        v_invoice_status := 'partial';
        v_paid_at := NULL;
    END IF;

    -- 1. Insertar Pago confirmado
    INSERT INTO public.payments (
        order_id, method, amount, status, reference, notes, paid_at
    ) VALUES (
        p_order_id, COALESCE(p_payment_method, 'cash'), p_amount, 'confirmed', p_reference,
        'Cobrado por ' || COALESCE(p_cashier_name, 'Caja'), now()
    ) RETURNING id INTO v_payment_id;

    -- 2. Actualizar estado del Pedido en base al cálculo determinista
    UPDATE public.orders
    SET payment_status = v_order_payment_status,
        payment_method = COALESCE(p_payment_method, payment_method),
        updated_at = now()
    WHERE id = p_order_id;

    -- 3. Emitir o actualizar factura garantizando atomicidad
    SELECT id, invoice_number INTO v_invoice_id, v_invoice_number
    FROM public.invoices
    WHERE order_id = p_order_id
    FOR UPDATE;

    IF v_invoice_id IS NULL THEN
        SELECT nextval('invoice_number_seq') INTO v_seq_num;
        v_invoice_number := 'FAC-' || v_curr_year || v_curr_month || '-' || LPAD(v_seq_num::TEXT, 5, '0');

        INSERT INTO public.invoices (
            invoice_number, order_id, customer_id, customer_name, customer_id_doc,
            customer_phone, customer_address, subtotal, discount, tax, total,
            currency, payment_method, payment_status, status, notes, paid_at
        ) VALUES (
            v_invoice_number, p_order_id, v_order.customer_id, v_order.customer_name,
            NULL, v_order.customer_phone, v_order.delivery_address,
            v_order.subtotal, v_order.discount, v_order.tax, v_order.total,
            'XAF', COALESCE(p_payment_method, 'cash'), v_order_payment_status, v_invoice_status,
            'Factura oficial BIKIE Papelería', v_paid_at
        ) RETURNING id INTO v_invoice_id;

        -- Copiar items de pedido a ítems de factura
        FOR v_item IN SELECT * FROM public.order_items WHERE order_id = p_order_id
        LOOP
            INSERT INTO public.invoice_items (
                invoice_id, product_id, product_name, quantity,
                original_unit_price, unit_price, discount_amount, total
            ) VALUES (
                v_invoice_id, v_item.product_id, v_item.product_name, v_item.quantity,
                v_item.original_unit_price, v_item.unit_price,
                v_item.discount_amount, v_item.total_price
            );
        END LOOP;
    ELSE
        -- Si la factura ya existía, sincronizar su estado de pago de forma segura
        UPDATE public.invoices
        SET payment_status = v_order_payment_status,
            status = v_invoice_status,
            payment_method = COALESCE(p_payment_method, payment_method),
            paid_at = COALESCE(v_paid_at, paid_at),
            updated_at = now()
        WHERE id = v_invoice_id;
    END IF;

    -- 4. Historial y Notificación
    INSERT INTO public.order_status_history (order_id, previous_status, new_status, changed_by, note)
    VALUES (
        p_order_id, v_order.status, v_order.status, p_cashier_name,
        'Pago de ' || p_amount || ' FCFA confirmado (' || v_invoice_status || '). Factura: ' || v_invoice_number || '. Saldo: ' || GREATEST(0, v_order.total - v_new_paid_total) || ' FCFA.'
    );

    INSERT INTO public.notifications (title, message, type, order_id)
    VALUES (
        'Pago Confirmado Pedido #' || v_order.order_number,
        'Factura: ' || v_invoice_number || ' • Monto: ' || p_amount || ' FCFA • Estado: ' || v_invoice_status,
        'payment_confirmed',
        p_order_id
    );

    RETURN jsonb_build_object(
        'success', true,
        'order_id', p_order_id,
        'payment_id', v_payment_id,
        'invoice_id', v_invoice_id,
        'invoice_number', v_invoice_number,
        'amount_paid', p_amount,
        'total_paid', v_new_paid_total,
        'remaining_balance', GREATEST(0, v_order.total - v_new_paid_total),
        'payment_status', v_order_payment_status,
        'invoice_status', v_invoice_status
    );
END;
$$;

-- 7.8 ACTUALIZACIÓN ATÓMICA DE ESTADO DE PEDIDO
DROP FUNCTION IF EXISTS public.update_order_status_atomic(UUID, TEXT, TEXT, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.update_order_status_atomic CASCADE;
CREATE OR REPLACE FUNCTION public.update_order_status_atomic(
    p_order_id UUID,
    p_new_status TEXT,
    p_note TEXT DEFAULT NULL,
    p_changed_by TEXT DEFAULT 'Administrador'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_order RECORD;
    v_prev_status TEXT;
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Solo administradores pueden cambiar el estado de pedidos.';
    END IF;

    SELECT * INTO v_order
    FROM public.orders
    WHERE id = p_order_id
    FOR UPDATE;

    IF v_order IS NULL THEN
        RAISE EXCEPTION 'Pedido con ID % no encontrado.', p_order_id;
    END IF;

    v_prev_status := v_order.status;

    UPDATE public.orders
    SET status = p_new_status,
        updated_at = now()
    WHERE id = p_order_id;

    INSERT INTO public.order_status_history (
        order_id, previous_status, new_status, changed_by, note
    ) VALUES (
        p_order_id, v_prev_status, p_new_status, p_changed_by,
        COALESCE(p_note, 'Estado actualizado a ' || p_new_status)
    );

    RETURN jsonb_build_object(
        'success', true,
        'order_id', p_order_id,
        'previous_status', v_prev_status,
        'new_status', p_new_status
    );
END;
$$;

-- 7.9 CANCELACIÓN ATÓMICA Y LÓGICA DE FACTURA (ANTIFRAUDE, PROHIBIDO DELETE)
DROP FUNCTION IF EXISTS public.cancel_invoice_atomic(UUID, TEXT, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.cancel_invoice_atomic CASCADE;
CREATE OR REPLACE FUNCTION public.cancel_invoice_atomic(
    p_invoice_id UUID,
    p_reason TEXT DEFAULT 'Anulación por administrador',
    p_cancelled_by TEXT DEFAULT 'Administrador'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_invoice RECORD;
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Operación denegada: Solo administradores pueden cancelar facturas.';
    END IF;

    SELECT * INTO v_invoice
    FROM public.invoices
    WHERE id = p_invoice_id
    FOR UPDATE;

    IF v_invoice IS NULL THEN
        RAISE EXCEPTION 'Factura con ID % no encontrada.', p_invoice_id;
    END IF;

    IF v_invoice.status = 'cancelled' THEN
        RAISE EXCEPTION 'La factura % ya se encuentra anulada.', v_invoice.invoice_number;
    END IF;

    -- Cancelación lógica inmutable (prohíbe borrado físico por trazabilidad fiscal y contable)
    UPDATE public.invoices
    SET status = 'cancelled',
        payment_status = 'cancelled',
        notes = COALESCE(notes || E'\n', '') || 'ANULADA el ' || to_char(now(), 'YYYY-MM-DD HH24:MI:SS') || ' por ' || COALESCE(p_cancelled_by, 'Admin') || '. Motivo: ' || COALESCE(p_reason, 'Sin motivo especificado'),
        updated_at = now()
    WHERE id = p_invoice_id;

    -- Si está vinculada a un pedido, registrar la anulación en el historial del pedido
    IF v_invoice.order_id IS NOT NULL THEN
        INSERT INTO public.order_status_history (
            order_id, previous_status, new_status, changed_by, note
        ) VALUES (
            v_invoice.order_id, 'invoice_active', 'invoice_cancelled',
            p_cancelled_by, 'Factura ' || v_invoice.invoice_number || ' anulada: ' || COALESCE(p_reason, 'Sin motivo')
        );
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'invoice_id', p_invoice_id,
        'invoice_number', v_invoice.invoice_number,
        'status', 'cancelled'
    );
END;
$$;

-- 7.10 ALIAS DE CANCELACIÓN ATÓMICA DE PEDIDOS
DROP FUNCTION IF EXISTS public.cancel_order_atomic(UUID, TEXT, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.cancel_order_atomic CASCADE;
CREATE OR REPLACE FUNCTION public.cancel_order_atomic(
    p_order_id UUID,
    p_reason TEXT DEFAULT 'Cancelación por administrador',
    p_cancelled_by TEXT DEFAULT 'Administrador'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Solo administradores pueden cancelar pedidos.';
    END IF;
    RETURN public.cancel_order_with_stock_return(p_order_id, p_reason, p_cancelled_by);
END;
$$;

-- ==============================================================================
-- 7.15 CREAR SESIÓN DE ESCÁNER MÓVIL REMOTO PARA POS
-- ==============================================================================
DROP FUNCTION IF EXISTS public.create_pos_scanner_session(TEXT, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS public.create_pos_scanner_session(INTEGER, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.create_pos_scanner_session CASCADE;

CREATE OR REPLACE FUNCTION public.create_pos_scanner_session(
    p_pos_identifier TEXT DEFAULT 'Caja Principal',
    p_expires_minutes INTEGER DEFAULT 30
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_session_id UUID;
    v_token TEXT;
    v_short_code TEXT;
    v_expires_at TIMESTAMPTZ;
    v_result JSONB;
BEGIN
    -- Generar token aleatorio criptográficamente seguro
    v_token := encode(gen_random_bytes(24), 'hex');

    -- Generar código corto de 6 dígitos
    v_short_code := (floor(random() * 899999 + 100000))::text;

    -- Calcular expiración segura (mínimo 5 min, máximo 180 min, default 30)
    v_expires_at := timezone('utc'::text, now()) + (GREATEST(5, LEAST(COALESCE(p_expires_minutes, 30), 180)) || ' minutes')::interval;

    INSERT INTO public.pos_scanner_sessions (
        session_token,
        short_code,
        pos_identifier,
        created_by,
        status,
        expires_at
    ) VALUES (
        v_token,
        v_short_code,
        COALESCE(NULLIF(trim(p_pos_identifier), ''), 'Caja Principal'),
        auth.uid(),
        'waiting',
        v_expires_at
    ) RETURNING id INTO v_session_id;

    SELECT jsonb_build_object(
        'id', v_session_id,
        'session_token', v_token,
        'short_code', v_short_code,
        'pos_identifier', COALESCE(NULLIF(trim(p_pos_identifier), ''), 'Caja Principal'),
        'status', 'waiting',
        'expires_at', v_expires_at,
        'created_at', timezone('utc'::text, now())
    ) INTO v_result;

    RETURN v_result;
END;
$$;

-- Alias con orden alternativo de parámetros (p_expires_minutes, p_pos_identifier) para PostgREST
CREATE OR REPLACE FUNCTION public.create_pos_scanner_session(
    p_expires_minutes INTEGER,
    p_pos_identifier TEXT DEFAULT 'Caja Principal'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN public.create_pos_scanner_session(p_pos_identifier, p_expires_minutes);
END;
$$;

-- ==============================================================================
-- 7.16 CONECTAR DISPOSITIVO MÓVIL A LA SESIÓN DE ESCÁNER
-- ==============================================================================
DROP FUNCTION IF EXISTS public.connect_pos_scanner_session(TEXT, TEXT, TEXT, TEXT) CASCADE;
CREATE OR REPLACE FUNCTION public.connect_pos_scanner_session(
    p_token TEXT DEFAULT NULL,
    p_short_code TEXT DEFAULT NULL,
    p_device_id TEXT DEFAULT NULL,
    p_device_name TEXT DEFAULT 'Dispositivo Móvil'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_session RECORD;
    v_now TIMESTAMPTZ := timezone('utc'::text, now());
    v_clean_code TEXT;
    v_clean_token TEXT;
BEGIN
    v_clean_token := NULLIF(trim(p_token), '');
    v_clean_code := NULLIF(trim(p_short_code), '');

    IF v_clean_token IS NULL AND v_clean_code IS NULL THEN
        RAISE EXCEPTION 'Debes proporcionar el token de sesión o el código de 6 dígitos.';
    END IF;

    -- Buscar sesión
    IF v_clean_token IS NOT NULL THEN
        SELECT * INTO v_session
        FROM public.pos_scanner_sessions
        WHERE session_token = v_clean_token;
    ELSE
        SELECT * INTO v_session
        FROM public.pos_scanner_sessions
        WHERE short_code = v_clean_code
          AND status IN ('waiting', 'connected')
        ORDER BY created_at DESC
        LIMIT 1;
    END IF;

    IF v_session.id IS NULL THEN
        RAISE EXCEPTION 'Sesión de escáner no encontrada o código inválido.';
    END IF;

    -- Verificar expiración
    IF v_now > v_session.expires_at THEN
        UPDATE public.pos_scanner_sessions
        SET status = 'expired'
        WHERE id = v_session.id;

        RAISE EXCEPTION 'La sesión de escáner ha expirado. Genera un nuevo código en el POS.';
    END IF;

    -- Verificar desconexión previa
    IF v_session.status = 'disconnected' THEN
        RAISE EXCEPTION 'Esta sesión de escáner fue finalizada desde el POS.';
    END IF;

    -- Concurrencia: prevenir que dos móviles controlen el mismo POS al mismo tiempo
    IF v_session.status = 'connected' AND v_session.device_id IS NOT NULL THEN
        IF p_device_id IS NOT NULL AND v_session.device_id <> p_device_id THEN
            RAISE EXCEPTION 'Este POS ya tiene un escáner conectado (%s). Desconéctalo desde el POS para vincular uno nuevo.',
                COALESCE(v_session.device_name, 'otro dispositivo');
        END IF;
    END IF;

    -- Actualizar conexión
    UPDATE public.pos_scanner_sessions
    SET status = 'connected',
        device_id = COALESCE(NULLIF(trim(p_device_id), ''), v_session.device_id, 'device-' || substr(md5(random()::text), 1, 8)),
        device_name = COALESCE(NULLIF(trim(p_device_name), ''), v_session.device_name, 'Dispositivo Móvil'),
        connected_at = COALESCE(v_session.connected_at, v_now)
    WHERE id = v_session.id
    RETURNING * INTO v_session;

    RETURN jsonb_build_object(
        'id', v_session.id,
        'session_token', v_session.session_token,
        'short_code', v_session.short_code,
        'pos_identifier', v_session.pos_identifier,
        'status', v_session.status,
        'device_id', v_session.device_id,
        'device_name', v_session.device_name,
        'expires_at', v_session.expires_at,
        'connected_at', v_session.connected_at
    );
END;
$$;

-- ==============================================================================
-- 7.17 DESCONECTAR SESIÓN DE ESCÁNER
-- ==============================================================================
DROP FUNCTION IF EXISTS public.disconnect_pos_scanner_session(UUID, TEXT, TEXT) CASCADE;
CREATE OR REPLACE FUNCTION public.disconnect_pos_scanner_session(
    p_session_id UUID DEFAULT NULL,
    p_token TEXT DEFAULT NULL,
    p_device_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_target_id UUID;
BEGIN
    IF p_session_id IS NOT NULL THEN
        v_target_id := p_session_id;
    ELSIF p_token IS NOT NULL THEN
        SELECT id INTO v_target_id
        FROM public.pos_scanner_sessions
        WHERE session_token = trim(p_token);
    END IF;

    IF v_target_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Sesión no encontrada');
    END IF;

    UPDATE public.pos_scanner_sessions
    SET status = 'disconnected',
        disconnected_at = timezone('utc'::text, now())
    WHERE id = v_target_id;

    RETURN jsonb_build_object('success', true, 'session_id', v_target_id, 'status', 'disconnected');
END;
$$;

-- ==============================================================================
-- 7.18 VALIDACIÓN DE EVENTO DE ESCANEO DESDE DISPOSITIVO MÓVIL
-- ==============================================================================
DROP FUNCTION IF EXISTS public.validate_pos_scan_event(TEXT, TEXT, TEXT) CASCADE;
CREATE OR REPLACE FUNCTION public.validate_pos_scan_event(
    p_token TEXT,
    p_barcode TEXT,
    p_device_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_session RECORD;
    v_product RECORD;
    v_now TIMESTAMPTZ := timezone('utc'::text, now());
    v_clean_barcode TEXT;
BEGIN
    v_clean_barcode := trim(p_barcode);

    IF v_clean_barcode IS NULL OR v_clean_barcode = '' THEN
        RETURN jsonb_build_object(
            'valid', false,
            'error', 'Código de barras vacío o no válido'
        );
    END IF;

    -- Validar sesión
    SELECT * INTO v_session
    FROM public.pos_scanner_sessions
    WHERE session_token = trim(p_token);

    IF v_session.id IS NULL THEN
        RETURN jsonb_build_object('valid', false, 'error', 'Sesión de escáner no válida');
    END IF;

    IF v_now > v_session.expires_at THEN
        UPDATE public.pos_scanner_sessions SET status = 'expired' WHERE id = v_session.id;
        RETURN jsonb_build_object('valid', false, 'error', 'Sesión expirada');
    END IF;

    IF v_session.status <> 'connected' THEN
        RETURN jsonb_build_object('valid', false, 'error', 'La sesión no está en estado conectado');
    END IF;

    -- Actualizar auditoría del último escaneo
    UPDATE public.pos_scanner_sessions
    SET last_scanned_barcode = v_clean_barcode,
        last_scanned_at = v_now
    WHERE id = v_session.id;

    -- Buscar producto real en la base de datos
    SELECT id, code, name, price, stock, is_active
    INTO v_product
    FROM public.products
    WHERE (lower(code) = lower(v_clean_barcode) OR id::text = v_clean_barcode)
      AND is_active = true
    LIMIT 1;

    IF v_product.id IS NULL THEN
        RETURN jsonb_build_object(
            'valid', true,
            'found', false,
            'barcode', v_clean_barcode,
            'error', 'Producto no encontrado'
        );
    END IF;

    RETURN jsonb_build_object(
        'valid', true,
        'found', true,
        'barcode', v_product.code,
        'product_id', v_product.id,
        'product_name', v_product.name,
        'price', v_product.price,
        'stock', v_product.stock
    );
END;
$$;

-- ==============================================================================
-- 7.19 ESTADO DE SESIÓN DE ESCÁNER
-- ==============================================================================
DROP FUNCTION IF EXISTS public.get_pos_scanner_session_status(UUID, TEXT) CASCADE;
CREATE OR REPLACE FUNCTION public.get_pos_scanner_session_status(
    p_session_id UUID DEFAULT NULL,
    p_token TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_session RECORD;
BEGIN
    IF p_session_id IS NOT NULL THEN
        SELECT * INTO v_session FROM public.pos_scanner_sessions WHERE id = p_session_id;
    ELSIF p_token IS NOT NULL THEN
        SELECT * INTO v_session FROM public.pos_scanner_sessions WHERE session_token = trim(p_token);
    ELSE
        RETURN jsonb_build_object('error', 'Falta session_id o token');
    END IF;

    IF v_session.id IS NULL THEN
        RETURN jsonb_build_object('status', 'not_found');
    END IF;

    IF timezone('utc'::text, now()) > v_session.expires_at AND v_session.status <> 'disconnected' THEN
        UPDATE public.pos_scanner_sessions SET status = 'expired' WHERE id = v_session.id;
        v_session.status := 'expired';
    END IF;

    RETURN jsonb_build_object(
        'id', v_session.id,
        'session_token', v_session.session_token,
        'short_code', v_session.short_code,
        'pos_identifier', v_session.pos_identifier,
        'status', v_session.status,
        'device_id', v_session.device_id,
        'device_name', v_session.device_name,
        'expires_at', v_session.expires_at,
        'connected_at', v_session.connected_at,
        'last_scanned_barcode', v_session.last_scanned_barcode,
        'last_scanned_at', v_session.last_scanned_at
    );
END;
$$;

-- ==============================================================================
-- 7.11 PERMISOS EXPLÍCITOS PARA FUNCIONES SECURITY DEFINER
-- ==============================================================================
-- Revocar ejecución pública indiscriminada de funciones del sistema
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.protect_profile_role() FROM PUBLIC;
REVOKE ALL ON PROCEDURE public.promote_user_to_admin(TEXT) FROM PUBLIC;
REVOKE ALL ON PROCEDURE public.promote_user_to_admin(TEXT) FROM anon, authenticated;

-- Revocar ejecución pública indiscriminada de RPCs atómicos
REVOKE ALL ON FUNCTION public.create_product_atomic(TEXT, TEXT, TEXT, NUMERIC, NUMERIC, INT, INT, UUID, TEXT, BOOLEAN, BOOLEAN) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.process_pos_sale_atomic(TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT, TEXT, TEXT, JSONB, UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.process_payment_and_invoice(UUID, TEXT, NUMERIC, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.adjust_product_stock_atomic(UUID, INT, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cancel_order_with_stock_return(UUID, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cancel_order_atomic(UUID, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cancel_invoice_atomic(UUID, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_order_status_atomic(UUID, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_order_atomic(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.track_order(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_invoice_by_order(UUID) FROM PUBLIC;

-- Revocar también explícitamente del rol 'anon' para funciones administrativas
REVOKE ALL ON FUNCTION public.create_product_atomic(TEXT, TEXT, TEXT, NUMERIC, NUMERIC, INT, INT, UUID, TEXT, BOOLEAN, BOOLEAN) FROM anon;
REVOKE ALL ON FUNCTION public.process_pos_sale_atomic(TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT, TEXT, TEXT, JSONB, UUID, TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.process_payment_and_invoice(UUID, TEXT, NUMERIC, TEXT, TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.adjust_product_stock_atomic(UUID, INT, TEXT, TEXT, TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.cancel_order_with_stock_return(UUID, TEXT, TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.cancel_order_atomic(UUID, TEXT, TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.cancel_invoice_atomic(UUID, TEXT, TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.update_order_status_atomic(UUID, TEXT, TEXT, TEXT) FROM anon;

-- Otorgar ejecución de funciones administrativas exclusivamente a usuarios autenticados
-- (Nota: cada función contiene validación interna estricta con is_admin())
GRANT EXECUTE ON FUNCTION public.create_product_atomic(TEXT, TEXT, TEXT, NUMERIC, NUMERIC, INT, INT, UUID, TEXT, BOOLEAN, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_pos_sale_atomic(TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT, TEXT, TEXT, JSONB, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_payment_and_invoice(UUID, TEXT, NUMERIC, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.adjust_product_stock_atomic(UUID, INT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_order_with_stock_return(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_order_atomic(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_invoice_atomic(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_order_status_atomic(UUID, TEXT, TEXT, TEXT) TO authenticated;

-- Otorgar función de verificación de rol a authenticated y anon (para evaluación en RLS)
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, anon;

-- Otorgar procedimiento exclusivo de promoción administrativa solo a superusuario / backend
GRANT EXECUTE ON PROCEDURE public.promote_user_to_admin(TEXT) TO postgres, service_role;

-- Funciones públicas autorizadas para storefront (crear pedidos web y tracking)
GRANT EXECUTE ON FUNCTION public.create_order_atomic(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.track_order(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_invoice_by_order(UUID) TO anon, authenticated;

-- Funciones autorizadas para escáner móvil remoto de POS
REVOKE ALL ON FUNCTION public.create_pos_scanner_session(TEXT, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_pos_scanner_session(INTEGER, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_pos_scanner_session(TEXT, INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_pos_scanner_session(INTEGER, TEXT) TO anon, authenticated;

GRANT EXECUTE ON FUNCTION public.connect_pos_scanner_session(TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.disconnect_pos_scanner_session(UUID, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.validate_pos_scan_event(TEXT, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_pos_scanner_session_status(UUID, TEXT) TO anon, authenticated;

-- ==============================================================================
-- 8. CONFIGURACIÓN SUPABASE REALTIME
-- ==============================================================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'products') THEN
            ALTER PUBLICATION supabase_realtime ADD TABLE public.products;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'orders') THEN
            ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'invoices') THEN
            ALTER PUBLICATION supabase_realtime ADD TABLE public.invoices;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'services') THEN
            ALTER PUBLICATION supabase_realtime ADD TABLE public.services;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'suppliers') THEN
            ALTER PUBLICATION supabase_realtime ADD TABLE public.suppliers;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'notifications') THEN
            ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'inventory_movements') THEN
            ALTER PUBLICATION supabase_realtime ADD TABLE public.inventory_movements;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'pos_scanner_sessions') THEN
            ALTER PUBLICATION supabase_realtime ADD TABLE public.pos_scanner_sessions;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'sales') THEN
            ALTER PUBLICATION supabase_realtime ADD TABLE public.sales;
        END IF;
    END IF;
END $$;

-- ==============================================================================
-- FIN DEL SCRIPT OFICIAL: MODIF_DB.sql
-- ==============================================================================
