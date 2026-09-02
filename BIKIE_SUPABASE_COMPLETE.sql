-- ==============================================================================
-- BIKIE PAPELERÍA — SCRIPT COMPLETO DE MIGRACIÓN SUPABASE / POSTGRESQL
-- ARCHIVO ÚNICO Y OFICIAL: BIKIE_SUPABASE_COMPLETE.sql
-- ==============================================================================
-- Moneda Oficial: FCFA (XAF)
-- Totalmente idempotente y ejecutable en el Editor SQL de Supabase.
-- ==============================================================================

-- 1. EXTENSIONES
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. SECUENCIAS
CREATE SEQUENCE IF NOT EXISTS invoice_number_seq START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS order_number_seq START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS sale_number_seq START WITH 1 INCREMENT BY 1;

-- ==============================================================================
-- 3. TABLAS PRINCIPALES
-- ==============================================================================

-- 3.1 PROFILES (Usuarios y Roles del sistema)
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
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3.3 PRODUCTS
CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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

-- 3.5 OFFER_PRODUCTS (Relación Muchos a Muchos)
CREATE TABLE IF NOT EXISTS public.offer_products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    offer_id UUID NOT NULL REFERENCES public.offers(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    UNIQUE(offer_id, product_id)
);

-- 3.6 OFFER_CATEGORIES (Relación Muchos a Muchos)
CREATE TABLE IF NOT EXISTS public.offer_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    offer_id UUID NOT NULL REFERENCES public.offers(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    UNIQUE(offer_id, category_id)
);

-- 3.7 CUSTOMERS
CREATE TABLE IF NOT EXISTS public.customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    full_name TEXT NOT NULL,
    email TEXT,
    phone TEXT NOT NULL,
    address TEXT,
    identification_number TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3.8 ORDERS
CREATE TABLE IF NOT EXISTS public.orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_number TEXT NOT NULL UNIQUE,
    client_request_id TEXT UNIQUE,
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    customer_name TEXT NOT NULL,
    customer_email TEXT,
    customer_phone TEXT NOT NULL,
    delivery_address TEXT,
    subtotal NUMERIC(14,2) NOT NULL CHECK (subtotal >= 0),
    discount NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (discount >= 0),
    tax NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (tax >= 0),
    total NUMERIC(14,2) NOT NULL CHECK (total >= 0),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'preparing', 'ready', 'shipped', 'delivered', 'cancelled')),
    payment_method TEXT NOT NULL,
    payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'confirmed', 'rejected')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3.9 ORDER_ITEMS
CREATE TABLE IF NOT EXISTS public.order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
    product_name TEXT NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    original_unit_price NUMERIC(14,2) NOT NULL CHECK (original_unit_price >= 0),
    unit_price NUMERIC(14,2) NOT NULL CHECK (unit_price >= 0),
    discount_amount NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
    total_price NUMERIC(14,2) NOT NULL CHECK (total_price >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3.10 ORDER_STATUS_HISTORY
CREATE TABLE IF NOT EXISTS public.order_status_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    previous_status TEXT,
    new_status TEXT NOT NULL,
    changed_by TEXT,
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3.11 PAYMENTS
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
    method TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('pending', 'confirmed', 'rejected')),
    reference TEXT,
    notes TEXT,
    paid_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3.12 INVOICES
CREATE TABLE IF NOT EXISTS public.invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_number TEXT NOT NULL UNIQUE,
    order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    customer_name TEXT NOT NULL,
    customer_id_doc TEXT,
    customer_phone TEXT NOT NULL,
    customer_address TEXT,
    subtotal NUMERIC(14,2) NOT NULL CHECK (subtotal >= 0),
    discount NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (discount >= 0),
    tax NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (tax >= 0),
    total NUMERIC(14,2) NOT NULL CHECK (total >= 0),
    currency TEXT NOT NULL DEFAULT 'XAF',
    payment_method TEXT NOT NULL,
    payment_status TEXT NOT NULL DEFAULT 'confirmed' CHECK (payment_status IN ('pending', 'confirmed', 'rejected')),
    status TEXT NOT NULL DEFAULT 'paid' CHECK (status IN ('issued', 'paid', 'cancelled')),
    notes TEXT,
    paid_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    cancelled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3.13 INVOICE_ITEMS
CREATE TABLE IF NOT EXISTS public.invoice_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
    product_name TEXT NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    original_unit_price NUMERIC(14,2) NOT NULL CHECK (original_unit_price >= 0),
    unit_price NUMERIC(14,2) NOT NULL CHECK (unit_price >= 0),
    discount_amount NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
    total NUMERIC(14,2) NOT NULL CHECK (total >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3.14 SALES
CREATE TABLE IF NOT EXISTS public.sales (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sale_number TEXT NOT NULL UNIQUE,
    order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
    invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
    payment_id UUID REFERENCES public.payments(id) ON DELETE SET NULL,
    customer_name TEXT NOT NULL,
    total_amount NUMERIC(14,2) NOT NULL CHECK (total_amount >= 0),
    payment_method TEXT NOT NULL,
    cashier_name TEXT NOT NULL DEFAULT 'Admin BIKIE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3.15 INVENTORY_MOVEMENTS (Kardex)
CREATE TABLE IF NOT EXISTS public.inventory_movements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('sale', 'refund', 'purchase', 'adjustment', 'loss', 'correction')),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    previous_stock INTEGER NOT NULL,
    new_stock INTEGER NOT NULL,
    order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3.16 NOTIFICATIONS
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
    invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
    is_read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3.17 CASH_REGISTERS (Cajas y Turnos)
CREATE TABLE IF NOT EXISTS public.cash_registers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    opened_by TEXT NOT NULL DEFAULT 'Admin',
    opened_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    closed_at TIMESTAMPTZ,
    initial_amount NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (initial_amount >= 0),
    final_amount NUMERIC(14,2) CHECK (final_amount IS NULL OR final_amount >= 0),
    total_sales NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (total_sales >= 0),
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
    notes TEXT
);

-- 3.18 CASH_MOVEMENTS (Movimientos de caja)
CREATE TABLE IF NOT EXISTS public.cash_movements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cash_register_id UUID REFERENCES public.cash_registers(id) ON DELETE SET NULL,
    type TEXT NOT NULL CHECK (type IN ('sale_in', 'deposit', 'withdrawal', 'refund_out')),
    amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
    description TEXT NOT NULL,
    payment_id UUID REFERENCES public.payments(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3.19 SETTINGS (Configuración del negocio)
CREATE TABLE IF NOT EXISTS public.settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3.20 ACTIVITY_LOGS (Auditoría)
CREATE TABLE IF NOT EXISTS public.activity_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT,
    details JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ==============================================================================
-- 4. ÍNDICES DE RENDIMIENTO
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_code ON public.products(code);
CREATE INDEX IF NOT EXISTS idx_products_active ON public.products(is_active);
CREATE INDEX IF NOT EXISTS idx_offers_status_dates ON public.offers(status, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_orders_customer ON public.orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_invoices_order ON public.invoices(order_id);
CREATE INDEX IF NOT EXISTS idx_invoices_created ON public.invoices(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_product ON public.inventory_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON public.notifications(user_id, is_read);

-- ==============================================================================
-- 5. FUNCIONES Y PROCEDIMIENTOS ALMACENADOS (TRANSACCIONES ATÓMICAS)
-- ==============================================================================

-- 5.1 Generador de Números de Factura Consecutivos (BIKIE-2026-000001)
CREATE OR REPLACE FUNCTION public.generate_invoice_number()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
    current_year TEXT;
    next_val BIGINT;
    formatted_num TEXT;
BEGIN
    current_year := to_char(CURRENT_DATE, 'YYYY');
    next_val := nextval('invoice_number_seq');
    formatted_num := 'BIKIE-' || current_year || '-' || lpad(next_val::text, 6, '0');
    RETURN formatted_num;
END;
$$;

-- 5.2 Helper: Verificar si un usuario es administrador
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- 5.3 Creación Atómica de Pedido con Descuento de Stock
CREATE OR REPLACE FUNCTION public.create_order_atomic(
    p_order_number TEXT,
    p_client_request_id TEXT,
    p_customer_name TEXT,
    p_customer_phone TEXT,
    p_customer_email TEXT,
    p_delivery_address TEXT,
    p_payment_method TEXT,
    p_notes TEXT,
    p_items JSONB,
    p_user_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_order_id UUID;
    v_customer_id UUID;
    v_item RECORD;
    v_product RECORD;
    v_subtotal NUMERIC(14,2) := 0;
    v_discount NUMERIC(14,2) := 0;
    v_tax NUMERIC(14,2) := 0;
    v_total NUMERIC(14,2) := 0;
    v_existing_order UUID;
BEGIN
    -- Idempotencia por client_request_id
    IF p_client_request_id IS NOT NULL THEN
        SELECT id INTO v_existing_order FROM public.orders WHERE client_request_id = p_client_request_id;
        IF v_existing_order IS NOT NULL THEN
            RETURN jsonb_build_object('success', true, 'order_id', v_existing_order, 'message', 'Pedido ya registrado previamente');
        END IF;
    END IF;

    -- Buscar o crear cliente
    SELECT id INTO v_customer_id FROM public.customers WHERE phone = p_customer_phone LIMIT 1;
    IF v_customer_id IS NULL THEN
        INSERT INTO public.customers (user_id, full_name, email, phone, address)
        VALUES (p_user_id, p_customer_name, p_customer_email, p_customer_phone, p_delivery_address)
        RETURNING id INTO v_customer_id;
    END IF;

    -- Validar productos y calcular totales
    FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(
        product_id UUID,
        product_name TEXT,
        quantity INT,
        unit_price NUMERIC(14,2),
        original_unit_price NUMERIC(14,2),
        discount_amount NUMERIC(14,2)
    )
    LOOP
        SELECT * INTO v_product FROM public.products WHERE id = v_item.product_id FOR UPDATE;
        IF v_product IS NULL THEN
            RAISE EXCEPTION 'Producto no encontrado: %', v_item.product_name;
        END IF;
        IF v_product.stock < v_item.quantity THEN
            RAISE EXCEPTION 'Stock insuficiente para "%". Disponible: %, Solicitado: %', v_product.name, v_product.stock, v_item.quantity;
        END IF;

        v_subtotal := v_subtotal + (v_item.original_unit_price * v_item.quantity);
        v_discount := v_discount + ((v_item.original_unit_price - v_item.unit_price) * v_item.quantity);
    END LOOP;

    v_total := v_subtotal - v_discount;

    -- Insertar Orden
    INSERT INTO public.orders (
        order_number, client_request_id, customer_id, user_id, customer_name, customer_email,
        customer_phone, delivery_address, subtotal, discount, tax, total,
        status, payment_method, payment_status, notes
    ) VALUES (
        p_order_number, p_client_request_id, v_customer_id, p_user_id, p_customer_name, p_customer_email,
        p_customer_phone, p_delivery_address, v_subtotal, v_discount, v_tax, v_total,
        'pending', p_payment_method, 'pending', p_notes
    ) RETURNING id INTO v_order_id;

    -- Insertar Items y Descontar Stock con Movimiento Kardex
    FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(
        product_id UUID,
        product_name TEXT,
        quantity INT,
        unit_price NUMERIC(14,2),
        original_unit_price NUMERIC(14,2),
        discount_amount NUMERIC(14,2)
    )
    LOOP
        SELECT * INTO v_product FROM public.products WHERE id = v_item.product_id;

        INSERT INTO public.order_items (
            order_id, product_id, product_name, quantity, original_unit_price,
            unit_price, discount_amount, total_price
        ) VALUES (
            v_order_id, v_item.product_id, v_item.product_name, v_item.quantity,
            v_item.original_unit_price, v_item.unit_price, v_item.discount_amount,
            (v_item.unit_price * v_item.quantity)
        );

        -- Actualizar Stock
        UPDATE public.products
        SET stock = stock - v_item.quantity, updated_at = now()
        WHERE id = v_item.product_id;

        -- Registrar Kardex
        INSERT INTO public.inventory_movements (
            product_id, type, quantity, previous_stock, new_stock, order_id, note
        ) VALUES (
            v_item.product_id, 'sale', v_item.quantity, v_product.stock,
            (v_product.stock - v_item.quantity), v_order_id,
            'Venta por Pedido #' || p_order_number
        );
    END LOOP;

    -- Registrar Historial de Estado Inicial
    INSERT INTO public.order_status_history (order_id, previous_status, new_status, changed_by, note)
    VALUES (v_order_id, NULL, 'pending', 'Cliente', 'Pedido recibido por la tienda web');

    -- Notificación para Administradores
    INSERT INTO public.notifications (type, title, message, order_id)
    VALUES ('new_order', '¡Nuevo Pedido ' || p_order_number || '!', 'Cliente ' || p_customer_name || ' por ' || v_total || ' FCFA', v_order_id);

    RETURN jsonb_build_object('success', true, 'order_id', v_order_id, 'order_number', p_order_number, 'total', v_total);
END;
$$;

-- 5.4 Procesar Pago y Emitir Factura Atómicamente
CREATE OR REPLACE FUNCTION public.process_payment_and_invoice(
    p_order_id UUID,
    p_payment_method TEXT,
    p_amount NUMERIC(14,2),
    p_reference TEXT,
    p_cashier_name TEXT DEFAULT 'Admin BIKIE'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_order RECORD;
    v_invoice_id UUID;
    v_invoice_num TEXT;
    v_payment_id UUID;
    v_sale_num TEXT;
    v_item RECORD;
BEGIN
    SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
    IF v_order IS NULL THEN
        RAISE EXCEPTION 'Pedido no encontrado';
    END IF;

    -- Registrar Pago
    INSERT INTO public.payments (order_id, amount, method, status, reference, paid_at)
    VALUES (p_order_id, p_amount, p_payment_method, 'confirmed', p_reference, now())
    RETURNING id INTO v_payment_id;

    -- Generar Número de Factura
    v_invoice_num := public.generate_invoice_number();

    -- Insertar Factura
    INSERT INTO public.invoices (
        invoice_number, order_id, customer_id, customer_name, customer_id_doc,
        customer_phone, customer_address, subtotal, discount, tax, total,
        currency, payment_method, payment_status, status, notes, paid_at
    ) VALUES (
        v_invoice_num, p_order_id, v_order.customer_id, v_order.customer_name, NULL,
        v_order.customer_phone, v_order.delivery_address, v_order.subtotal, v_order.discount,
        v_order.tax, v_order.total, 'XAF', p_payment_method, 'confirmed', 'paid',
        'Factura oficial generada por BIKIE Papelería', now()
    ) RETURNING id INTO v_invoice_id;

    -- Copiar Items de Orden a Factura
    FOR v_item IN SELECT * FROM public.order_items WHERE order_id = p_order_id
    LOOP
        INSERT INTO public.invoice_items (
            invoice_id, product_id, product_name, quantity, original_unit_price,
            unit_price, discount_amount, total
        ) VALUES (
            v_invoice_id, v_item.product_id, v_item.product_name, v_item.quantity,
            v_item.original_unit_price, v_item.unit_price, v_item.discount_amount, v_item.total_price
        );
    END LOOP;

    -- Generar Venta
    v_sale_num := 'VEN-' || to_char(CURRENT_DATE, 'YYYY') || '-' || lpad(nextval('sale_number_seq')::text, 6, '0');
    INSERT INTO public.sales (
        sale_number, order_id, invoice_id, payment_id, customer_name,
        total_amount, payment_method, cashier_name
    ) VALUES (
        v_sale_num, p_order_id, v_invoice_id, v_payment_id, v_order.customer_name,
        v_order.total, p_payment_method, p_cashier_name
    );

    -- Actualizar Estado de la Orden
    UPDATE public.orders
    SET payment_status = 'confirmed',
        status = CASE WHEN status = 'pending' THEN 'accepted' ELSE status END,
        updated_at = now()
    WHERE id = p_order_id;

    -- Historial
    INSERT INTO public.order_status_history (order_id, previous_status, new_status, changed_by, note)
    VALUES (p_order_id, v_order.status, 'accepted', p_cashier_name, 'Pago confirmado y Factura ' || v_invoice_num || ' emitida.');

    -- Notificación
    INSERT INTO public.notifications (type, title, message, order_id, invoice_id)
    VALUES ('invoice_created', 'Factura ' || v_invoice_num || ' emitida', 'Pedido #' || v_order.order_number || ' pagado con éxito.', p_order_id, v_invoice_id);

    RETURN jsonb_build_object(
        'success', true,
        'invoice_id', v_invoice_id,
        'invoice_number', v_invoice_num,
        'payment_id', v_payment_id
    );
END;
$$;

-- 5.5 Cancelar Pedido con Devolución de Stock Atómica
CREATE OR REPLACE FUNCTION public.cancel_order_with_stock_return(
    p_order_id UUID,
    p_reason TEXT,
    p_cancelled_by TEXT DEFAULT 'Admin'
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
    SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
    IF v_order IS NULL THEN
        RAISE EXCEPTION 'Pedido no encontrado';
    END IF;
    IF v_order.status = 'cancelled' THEN
        RETURN jsonb_build_object('success', true, 'message', 'El pedido ya estaba cancelado');
    END IF;

    -- Devolver Stock si el pedido no fue cancelado
    FOR v_item IN SELECT * FROM public.order_items WHERE order_id = p_order_id
    LOOP
        SELECT * INTO v_product FROM public.products WHERE id = v_item.product_id FOR UPDATE;
        IF v_product IS NOT NULL THEN
            UPDATE public.products
            SET stock = stock + v_item.quantity, updated_at = now()
            WHERE id = v_item.product_id;

            INSERT INTO public.inventory_movements (
                product_id, type, quantity, previous_stock, new_stock, order_id, note
            ) VALUES (
                v_item.product_id, 'refund', v_item.quantity, v_product.stock,
                (v_product.stock + v_item.quantity), p_order_id,
                'Reintegro de stock por cancelación de Pedido #' || v_order.order_number || '. Motivo: ' || COALESCE(p_reason, 'Sin motivo')
            );
        END IF;
    END LOOP;

    -- Actualizar orden
    UPDATE public.orders
    SET status = 'cancelled', updated_at = now()
    WHERE id = p_order_id;

    -- Historial
    INSERT INTO public.order_status_history (order_id, previous_status, new_status, changed_by, note)
    VALUES (p_order_id, v_order.status, 'cancelled', p_cancelled_by, 'Cancelado: ' || COALESCE(p_reason, 'Sin motivo'));

    RETURN jsonb_build_object('success', true, 'message', 'Pedido cancelado y stock reintegrado correctamente.');
END;
$$;

-- ==============================================================================
-- 6. ROW LEVEL SECURITY (RLS) POLICIES
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
ALTER TABLE public.cash_registers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- Limpieza preventiva de políticas previas
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public') LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
    END LOOP;
END $$;

-- 6.1 PROFILES
CREATE POLICY "Profiles are viewable by owner or admin" ON public.profiles
    FOR SELECT USING (auth.uid() = id OR public.is_admin());
CREATE POLICY "Profiles can be updated by owner or admin" ON public.profiles
    FOR UPDATE USING (auth.uid() = id OR public.is_admin());
CREATE POLICY "Profiles can be inserted on auth" ON public.profiles
    FOR INSERT WITH CHECK (auth.uid() = id OR public.is_admin());

-- 6.2 CATEGORIES (Público lectura, Admin escritura)
CREATE POLICY "Categories are readable by everyone" ON public.categories
    FOR SELECT USING (true);
CREATE POLICY "Categories manageable by admin" ON public.categories
    FOR ALL USING (public.is_admin());

-- 6.3 PRODUCTS (Público lectura, Admin escritura)
CREATE POLICY "Products are readable by everyone" ON public.products
    FOR SELECT USING (true);
CREATE POLICY "Products manageable by admin" ON public.products
    FOR ALL USING (public.is_admin());

-- 6.4 OFFERS (Público lectura, Admin escritura)
CREATE POLICY "Offers readable by everyone" ON public.offers
    FOR SELECT USING (true);
CREATE POLICY "Offers manageable by admin" ON public.offers
    FOR ALL USING (public.is_admin());

CREATE POLICY "Offer products readable by everyone" ON public.offer_products
    FOR SELECT USING (true);
CREATE POLICY "Offer products manageable by admin" ON public.offer_products
    FOR ALL USING (public.is_admin());

CREATE POLICY "Offer categories readable by everyone" ON public.offer_categories
    FOR SELECT USING (true);
CREATE POLICY "Offer categories manageable by admin" ON public.offer_categories
    FOR ALL USING (public.is_admin());

-- 6.5 CUSTOMERS
CREATE POLICY "Customers readable by owner or admin" ON public.customers
    FOR SELECT USING (auth.uid() = user_id OR public.is_admin() OR auth.uid() IS NULL);
CREATE POLICY "Customers insertable by anyone" ON public.customers
    FOR INSERT WITH CHECK (true);
CREATE POLICY "Customers manageable by admin" ON public.customers
    FOR UPDATE USING (public.is_admin());

-- 6.6 ORDERS
CREATE POLICY "Orders readable by owner or admin" ON public.orders
    FOR SELECT USING (auth.uid() = user_id OR public.is_admin() OR auth.uid() IS NULL);
CREATE POLICY "Orders insertable by anyone" ON public.orders
    FOR INSERT WITH CHECK (true);
CREATE POLICY "Orders updatable by admin" ON public.orders
    FOR UPDATE USING (public.is_admin());

-- 6.7 ORDER_ITEMS
CREATE POLICY "Order items readable by everyone or admin" ON public.order_items
    FOR SELECT USING (true);
CREATE POLICY "Order items insertable by anyone" ON public.order_items
    FOR INSERT WITH CHECK (true);
CREATE POLICY "Order items manageable by admin" ON public.order_items
    FOR ALL USING (public.is_admin());

-- 6.8 ORDER STATUS HISTORY
CREATE POLICY "History readable by everyone" ON public.order_status_history
    FOR SELECT USING (true);
CREATE POLICY "History insertable by anyone" ON public.order_status_history
    FOR INSERT WITH CHECK (true);

-- 6.9 PAYMENTS
CREATE POLICY "Payments readable by admin or owner" ON public.payments
    FOR SELECT USING (public.is_admin() OR auth.uid() IS NOT NULL);
CREATE POLICY "Payments insertable by anyone" ON public.payments
    FOR INSERT WITH CHECK (true);
CREATE POLICY "Payments manageable by admin" ON public.payments
    FOR UPDATE USING (public.is_admin());

-- 6.10 INVOICES
CREATE POLICY "Invoices readable by everyone with order or admin" ON public.invoices
    FOR SELECT USING (true);
CREATE POLICY "Invoices manageable by admin" ON public.invoices
    FOR ALL USING (public.is_admin());

CREATE POLICY "Invoice items readable by everyone" ON public.invoice_items
    FOR SELECT USING (true);
CREATE POLICY "Invoice items manageable by admin" ON public.invoice_items
    FOR ALL USING (public.is_admin());

-- 6.11 SALES
CREATE POLICY "Sales manageable by admin" ON public.sales
    FOR ALL USING (public.is_admin());

-- 6.12 INVENTORY_MOVEMENTS (Kardex)
CREATE POLICY "Inventory movements readable and manageable by admin" ON public.inventory_movements
    FOR ALL USING (public.is_admin());

-- 6.13 NOTIFICATIONS
CREATE POLICY "Notifications viewable by user or admin" ON public.notifications
    FOR SELECT USING (auth.uid() = user_id OR public.is_admin() OR user_id IS NULL);
CREATE POLICY "Notifications insertable by system" ON public.notifications
    FOR INSERT WITH CHECK (true);
CREATE POLICY "Notifications updatable by user or admin" ON public.notifications
    FOR UPDATE USING (auth.uid() = user_id OR public.is_admin() OR user_id IS NULL);
CREATE POLICY "Notifications deletable by admin" ON public.notifications
    FOR DELETE USING (public.is_admin());

-- 6.14 CASH REGISTERS & MOVEMENTS
CREATE POLICY "Cash registers manageable by admin" ON public.cash_registers
    FOR ALL USING (public.is_admin());
CREATE POLICY "Cash movements manageable by admin" ON public.cash_movements
    FOR ALL USING (public.is_admin());

-- 6.15 SETTINGS
CREATE POLICY "Settings readable by everyone" ON public.settings
    FOR SELECT USING (true);
CREATE POLICY "Settings manageable by admin" ON public.settings
    FOR ALL USING (public.is_admin());

-- 6.16 ACTIVITY LOGS
CREATE POLICY "Activity logs manageable by admin" ON public.activity_logs
    FOR ALL USING (public.is_admin());

-- ==============================================================================
-- 7. SUPABASE REALTIME CONFIGURATION
-- ==============================================================================
DO $$
BEGIN
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.products;
    EXCEPTION WHEN duplicate_object THEN END;
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.offers;
    EXCEPTION WHEN duplicate_object THEN END;
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
    EXCEPTION WHEN duplicate_object THEN END;
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.payments;
    EXCEPTION WHEN duplicate_object THEN END;
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.invoices;
    EXCEPTION WHEN duplicate_object THEN END;
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.sales;
    EXCEPTION WHEN duplicate_object THEN END;
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
    EXCEPTION WHEN duplicate_object THEN END;
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.inventory_movements;
    EXCEPTION WHEN duplicate_object THEN END;
END $$;

-- ==============================================================================
-- 8. TRIGGER DE CREACIÓN DE PERFIL AUTOMÁTICO EN AUTH.USERS
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', new.email),
    COALESCE(new.raw_user_meta_data->>'role', 'customer')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- ==============================================================================
-- 9. DATOS INICIALES REALES (SEMILLA BIKIE PAPELERÍA — MONEDA FCFA)
-- ==============================================================================

-- 9.1 Configuración del negocio
INSERT INTO public.settings (key, value, description)
VALUES (
    'business_info',
    '{
        "business_name": "BIKIE Papelería",
        "rif_tax_id": "J-50124890-1",
        "phone": "+237 600 000 000",
        "whatsapp": "+237600000000",
        "address": "Boulevard de la Liberté, C.C. BIKIE Central, Local 4",
        "currency": "XAF",
        "currency_symbol": "FCFA",
        "tax_rate": 0,
        "pago_movil_info": "Orange Money / MTN MoMo • Tlf: +237 600 000 000",
        "binance_info": "bikie_papeleria@pay.binance (Pay ID: 394819201)",
        "bank_transfer_info": "Afriland First Bank • Cta Cte: 0012-3456-7890-1234 • BIKIE Papelería S.A.",
        "invoice_prefix": "BIKIE",
        "sound_notifications_enabled": true
    }'::jsonb,
    'Configuración oficial de BIKIE Papelería'
)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();

-- 9.2 Categorías de Papelería
INSERT INTO public.categories (id, name, slug, description, sort_order, is_active)
VALUES
    ('c1111111-1111-1111-1111-111111111111', 'Cuadernos y Libretas', 'cuadernos-libretas', 'Cuadernos grapados, anillados, libretas de notas y agendas ejecutivas', 1, true),
    ('c2222222-2222-2222-2222-222222222222', 'Escritura y Bolígrafos', 'escritura-boligrafos', 'Bolígrafos, lápices de grafito, marcadores y resaltadores de precisión', 2, true),
    ('c3333333-3333-3333-3333-333333333333', 'Arte y Dibujo', 'arte-dibujo', 'Lápices de colores, acuarelas, pinceles, blocks de dibujo y cartulinas', 3, true),
    ('c4444444-4444-4444-4444-444444444444', 'Oficina y Archivo', 'oficina-archivo', 'Carpetas, grapadoras, perforadoras, clips y organizadores de archivo', 4, true),
    ('c5555555-5555-5555-5555-555555555555', 'Escolar y Manualidades', 'escolar-manualidades', 'Pegamentos, tijeras escolares, plastilinas, silicón y foami', 5, true)
ON CONFLICT (id) DO NOTHING;

-- 9.3 Catálogo de Productos con Precios Reales en FCFA
INSERT INTO public.products (id, code, name, description, price, cost_price, stock, min_stock, category_id, image_url, is_active, is_featured)
VALUES
    (
        'p1111111-1111-1111-1111-111111111111',
        'CUA-UNI-100',
        'Cuaderno Universitario Cuadriculado 100 Hojas',
        'Cuaderno espiral tapa dura con papel extra resistente de 75g. Ideal para secundaria y universidad.',
        1800.00,
        1000.00,
        45,
        10,
        'c1111111-1111-1111-1111-111111111111',
        'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=600&auto=format&fit=crop&q=80',
        true,
        true
    ),
    (
        'p2222222-2222-2222-2222-222222222222',
        'CUA-LIN-100',
        'Cuaderno Universitario Línea Simple 100 Hojas',
        'Cuaderno con margen reglamentario y espiral metálico doble reforzado.',
        1800.00,
        1000.00,
        38,
        10,
        'c1111111-1111-1111-1111-111111111111',
        'https://images.unsplash.com/photo-1589829085413-56de8ae18c73?w=600&auto=format&fit=crop&q=80',
        true,
        false
    ),
    (
        'p3333333-3333-3333-3333-333333333333',
        'BOL-BIC-AZU',
        'Pack Bolígrafos BIC Cristal Azul (Caja x10)',
        'Punta media 1.0 mm con tinta de secado ultra rápido. Máxima durabilidad de escritura.',
        2500.00,
        1500.00,
        30,
        8,
        'c2222222-2222-2222-2222-222222222222',
        'https://images.unsplash.com/photo-1585336261026-77cc7c20c025?w=600&auto=format&fit=crop&q=80',
        true,
        true
    ),
    (
        'p4444444-4444-4444-4444-444444444444',
        'RES-STA-SET',
        'Set Resaltadores Neón Pastel x6 Colores',
        'Resaltadores punta biselada para 3 grosores de trazo. Colores vibrantes y anti-manchas.',
        3500.00,
        2000.00,
        22,
        5,
        'c2222222-2222-2222-2222-222222222222',
        'https://images.unsplash.com/photo-1595781572981-d63169b77765?w=600&auto=format&fit=crop&q=80',
        true,
        true
    ),
    (
        'p5555555-5555-5555-5555-555555555555',
        'COL-PRI-24C',
        'Caja de Lápices de Colores Prisma x24 Tonos',
        'Mina ultra suave de 4mm con pigmentación intensa. Ideal para arte y tareas escolares.',
        5500.00,
        3200.00,
        18,
        5,
        'c3333333-3333-3333-3333-333333333333',
        'https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=600&auto=format&fit=crop&q=80',
        true,
        true
    ),
    (
        'p6666666-6666-6666-6666-666666666666',
        'CAR-ARCH-OFI',
        'Carpeta de Archivo Fuelle Tamaño Oficio con Elásticos',
        'Fabricada en polipropileno rígido de alta densidad con 12 divisiones indexadas.',
        2800.00,
        1600.00,
        25,
        6,
        'c4444444-4444-4444-4444-444444444444',
        'https://images.unsplash.com/photo-1586075010923-2dd4570fb338?w=600&auto=format&fit=crop&q=80',
        true,
        false
    ),
    (
        'p7777777-7777-7777-7777-777777777777',
        'GRA-IND-PRO',
        'Grapadora Metálica de Escritorio + Caja de Grapas 26/6',
        'Capacidad de engrapado de hasta 30 hojas. Cuerpo 100% metálico anti-atasco.',
        4200.00,
        2500.00,
        15,
        4,
        'c4444444-4444-4444-4444-444444444444',
        'https://images.unsplash.com/photo-1590725140246-20acbe442a8b?w=600&auto=format&fit=crop&q=80',
        true,
        false
    ),
    (
        'p8888888-8888-8888-8888-888888888888',
        'PEG-BAR-040',
        'Pega en Barra Lavable 40g (Pack x2)',
        'Fórmula no tóxica de secado transparente sin arrugar el papel. Ideal para niños.',
        1500.00,
        800.00,
        50,
        12,
        'c5555555-5555-5555-5555-555555555555',
        'https://images.unsplash.com/photo-1568832359672-e36cf5d74f54?w=600&auto=format&fit=crop&q=80',
        true,
        false
    ),
    (
        'p9999999-9999-9999-9999-999999999999',
        'TIJ-ESC-PUN',
        'Tijera Escolar Punta Roma Acero Inoxidable',
        'Mango ergonómico con hojas graduadas en centímetros para cortes precisos y seguros.',
        1200.00,
        600.00,
        40,
        8,
        'c5555555-5555-5555-5555-555555555555',
        'https://images.unsplash.com/photo-1503792501406-2c40da09e1e2?w=600&auto=format&fit=crop&q=80',
        true,
        false
    ),
    (
        'paaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        'BLO-DIB-GRA',
        'Block de Dibujo Bristol A4 20 Hojas 180g',
        'Papel liso extra blanco de alto gramaje para rotuladores, tinta china y lápiz grafito.',
        2600.00,
        1400.00,
        28,
        6,
        'c3333333-3333-3333-3333-333333333333',
        'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?w=600&auto=format&fit=crop&q=80',
        true,
        false
    )
ON CONFLICT (id) DO NOTHING;

-- 9.4 Oferta Inicial de Temporada
INSERT INTO public.offers (id, name, description, type, value, priority, start_date, end_date, status, is_global)
VALUES (
    'off11111-1111-1111-1111-111111111111',
    'Temporada Escolar BIKIE - 15% OFF',
    '15% de descuento especial en todos los cuadernos y packs de escritura para el regreso a clases.',
    'percentage',
    15,
    10,
    timezone('utc'::text, now() - INTERVAL '1 day'),
    timezone('utc'::text, now() + INTERVAL '30 days'),
    'active',
    false
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.offer_categories (offer_id, category_id)
VALUES
    ('off11111-1111-1111-1111-111111111111', 'c1111111-1111-1111-1111-111111111111'),
    ('off11111-1111-1111-1111-111111111111', 'c2222222-2222-2222-2222-222222222222')
ON CONFLICT DO NOTHING;

-- ==============================================================================
-- INSTRUCCIÓN PARA CREAR O DESIGNAR AL ADMINISTRADOR:
-- Ejecutar en SQL Editor si ya creaste un usuario en Supabase Auth:
--
-- UPDATE public.profiles
-- SET role = 'admin'
-- WHERE id = 'TU-UUID-DE-AUTH-USERS';
-- ==============================================================================
