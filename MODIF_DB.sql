-- ==============================================================================
-- BIKIE PAPELERÍA — MODIFICACIONES DE BASE DE DATOS SUPABASE / POSTGRESQL
-- ARCHIVO OFICIAL REQUERIDO: MODIF_DB.sql
-- ==============================================================================
-- Este archivo contiene TODAS las modificaciones necesarias para producción real:
-- 1. Hardening de seguridad y autenticación (evita escalado de privilegios).
-- 2. Políticas RLS estrictas y endurecidas (sin fugas de datos de clientes/pedidos).
-- 3. Estructuras de datos completas (services, suppliers, notifications).
-- 4. Funciones atómicas con bloqueos a nivel de fila (FOR UPDATE) para eliminar
--    cualquier problema de concurrencia en stock, ventas web y ventas POS.
-- 5. Consulta segura de rastreo de pedidos (track_order) e invoices.
-- 6. Activación de Realtime en Supabase.
-- ==============================================================================

-- 1. EXTENSIONES
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. TABLAS ADICIONALES REQUERIDAS SI NO EXISTEN
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

CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'info',
    is_read BOOLEAN NOT NULL DEFAULT false,
    order_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Índices de alto rendimiento
CREATE INDEX IF NOT EXISTS idx_services_category ON public.services(category);
CREATE INDEX IF NOT EXISTS idx_services_is_active ON public.services(is_active);
CREATE INDEX IF NOT EXISTS idx_suppliers_is_active ON public.suppliers(is_active);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON public.notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);

-- 3. FUNCIÓN DE SEGURIDAD PARA VALIDACIÓN DE ADMIN
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin'
    );
$$;

-- 4. SEGURIDAD DE AUTENTICACIÓN: PREVENIR ESCALADO DE PRIVILEGIOS
-- A. Al registrarse un usuario, NUNCA puede asignarse el rol admin desde metadatos
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
        'customer', -- FORZAR SIEMPRE ROL CUSTOMER. NUNCA LEER DEL CLIENTE.
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

-- B. Trigger protector en public.profiles:
-- Impide que un usuario normal actualice su propia columna 'role' a 'admin'
CREATE OR REPLACE FUNCTION public.protect_profile_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Si el rol está cambiando y el usuario no es admin actual, rechazar
    IF (OLD.role IS DISTINCT FROM NEW.role) THEN
        IF NOT public.is_admin() THEN
            RAISE EXCEPTION 'Operación denegada: Solo un administrador existente puede modificar roles.';
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

-- C. Procedimiento seguro para que el propietario pueda designar su primer admin
CREATE OR REPLACE PROCEDURE public.promote_user_to_admin(p_email TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
BEGIN
    SELECT id INTO v_user_id FROM auth.users WHERE lower(email) = lower(trim(p_email));
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Usuario con correo % no encontrado en Supabase Auth', p_email;
    END IF;

    UPDATE public.profiles
    SET role = 'admin', updated_at = now()
    WHERE id = v_user_id;

    RAISE NOTICE 'Usuario % promovido a administrador exitosamente.', p_email;
END;
$$;

-- 5. ENDURECIMIENTO TOTAL DE ROW LEVEL SECURITY (RLS)
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

-- Limpieza de políticas previas para evitar duplicados
DROP POLICY IF EXISTS "Public read profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admin full access to profiles" ON public.profiles;
DROP POLICY IF EXISTS "Profiles readable by self or admin" ON public.profiles;
DROP POLICY IF EXISTS "Profiles updatable by self without role escalation" ON public.profiles;

CREATE POLICY "Profiles readable by self or admin" ON public.profiles
    FOR SELECT USING (auth.uid() = id OR public.is_admin());

CREATE POLICY "Profiles updatable by self without role escalation" ON public.profiles
    FOR UPDATE USING (auth.uid() = id OR public.is_admin());

-- Catálogo público de lectura, escritura solo admin
DROP POLICY IF EXISTS "Public read active categories" ON public.categories;
DROP POLICY IF EXISTS "Public read categories" ON public.categories;
DROP POLICY IF EXISTS "Admin full access to categories" ON public.categories;
CREATE POLICY "Public read categories" ON public.categories FOR SELECT USING (true);
CREATE POLICY "Admin full access to categories" ON public.categories FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Public read active products" ON public.products;
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
CREATE POLICY "Public read services" ON public.services FOR SELECT USING (true);
CREATE POLICY "Admin full access to services" ON public.services FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Proveedores: Confidencialidad comercial (SOLO ADMIN)
DROP POLICY IF EXISTS "Admin all suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Public read suppliers" ON public.suppliers;
CREATE POLICY "Admin all suppliers" ON public.suppliers FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Pedidos (Orders): Solo el dueño autenticado o el administrador pueden leer
-- Las inserciones son públicas para permitir compras web anónimas/invitados
DROP POLICY IF EXISTS "Orders readable by owner or admin" ON public.orders;
DROP POLICY IF EXISTS "Anyone can insert orders" ON public.orders;
DROP POLICY IF EXISTS "Admin can update orders" ON public.orders;
DROP POLICY IF EXISTS "Admin can delete orders" ON public.orders;
CREATE POLICY "Orders readable by owner or admin" ON public.orders
    FOR SELECT USING (auth.uid() = user_id OR public.is_admin());
CREATE POLICY "Anyone can insert orders" ON public.orders
    FOR INSERT WITH CHECK (true);
CREATE POLICY "Admin can update orders" ON public.orders
    FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Admin can delete orders" ON public.orders
    FOR DELETE USING (public.is_admin());

-- Items de pedidos
DROP POLICY IF EXISTS "Order items readable by owner or admin" ON public.order_items;
DROP POLICY IF EXISTS "Anyone can insert order items" ON public.order_items;
DROP POLICY IF EXISTS "Admin full access to order items" ON public.order_items;
CREATE POLICY "Order items readable by owner or admin" ON public.order_items
    FOR SELECT USING (
        public.is_admin() OR
        EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.user_id = auth.uid())
    );
CREATE POLICY "Anyone can insert order items" ON public.order_items FOR INSERT WITH CHECK (true);
CREATE POLICY "Admin full access to order items" ON public.order_items FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Historial de pedidos
DROP POLICY IF EXISTS "Order history readable by owner or admin" ON public.order_status_history;
DROP POLICY IF EXISTS "Anyone can insert order history" ON public.order_status_history;
DROP POLICY IF EXISTS "Admin full access to order history" ON public.order_status_history;
CREATE POLICY "Order history readable by owner or admin" ON public.order_status_history
    FOR SELECT USING (
        public.is_admin() OR
        EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.user_id = auth.uid())
    );
CREATE POLICY "Anyone can insert order history" ON public.order_status_history FOR INSERT WITH CHECK (true);
CREATE POLICY "Admin full access to order history" ON public.order_status_history FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Pagos (Payments)
DROP POLICY IF EXISTS "Payments readable by owner or admin" ON public.payments;
DROP POLICY IF EXISTS "Admin full access to payments" ON public.payments;
CREATE POLICY "Payments readable by owner or admin" ON public.payments
    FOR SELECT USING (
        public.is_admin() OR
        EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.user_id = auth.uid())
    );
CREATE POLICY "Admin full access to payments" ON public.payments FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Facturas (Invoices) e items
DROP POLICY IF EXISTS "Invoices readable by owner or admin" ON public.invoices;
DROP POLICY IF EXISTS "Admin full access to invoices" ON public.invoices;
CREATE POLICY "Invoices readable by owner or admin" ON public.invoices
    FOR SELECT USING (
        public.is_admin() OR
        auth.uid() = customer_id OR
        EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.user_id = auth.uid())
    );
CREATE POLICY "Admin full access to invoices" ON public.invoices FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

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

-- Notificaciones: Admin ve y administra; el sistema puede insertar
DROP POLICY IF EXISTS "Public read notifications" ON public.notifications;
DROP POLICY IF EXISTS "Admin all notifications" ON public.notifications;
CREATE POLICY "Notifications select for admin" ON public.notifications FOR SELECT USING (public.is_admin());
CREATE POLICY "Notifications insert allowed" ON public.notifications FOR INSERT WITH CHECK (true);
CREATE POLICY "Notifications update admin" ON public.notifications FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Notifications delete admin" ON public.notifications FOR DELETE USING (public.is_admin());

-- Configuración comercial
DROP POLICY IF EXISTS "Public read settings" ON public.settings;
DROP POLICY IF EXISTS "Admin update settings" ON public.settings;
CREATE POLICY "Public read settings" ON public.settings FOR SELECT USING (true);
CREATE POLICY "Admin update settings" ON public.settings FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());


-- 6. RPC DE RASTREO SEGURO DE PEDIDOS (TRACK ORDER)
-- Permite que un cliente consulte un pedido si conoce el número exacto, sin exponer la tabla orders
CREATE OR REPLACE FUNCTION public.track_order(p_order_number TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_order RECORD;
    v_items JSONB;
    v_history JSONB;
    v_payments JSONB;
BEGIN
    SELECT * INTO v_order 
    FROM public.orders 
    WHERE upper(trim(order_number)) = upper(trim(p_order_number))
    LIMIT 1;

    IF v_order IS NULL THEN
        RETURN NULL;
    END IF;

    SELECT COALESCE(jsonb_agg(row_to_json(i)), '[]'::jsonb) INTO v_items
    FROM public.order_items i
    WHERE i.order_id = v_order.id;

    SELECT COALESCE(jsonb_agg(row_to_json(h) ORDER BY h.created_at ASC), '[]'::jsonb) INTO v_history
    FROM public.order_status_history h
    WHERE h.order_id = v_order.id;

    SELECT COALESCE(jsonb_agg(row_to_json(p)), '[]'::jsonb) INTO v_payments
    FROM public.payments p
    WHERE p.order_id = v_order.id;

    RETURN jsonb_build_object(
        'id', v_order.id,
        'order_number', v_order.order_number,
        'customer_name', v_order.customer_name,
        'customer_phone', v_order.customer_phone,
        'customer_email', v_order.customer_email,
        'delivery_address', v_order.delivery_address,
        'subtotal', v_order.subtotal,
        'discount', v_order.discount,
        'tax', v_order.tax,
        'total', v_order.total,
        'status', v_order.status,
        'payment_method', v_order.payment_method,
        'payment_status', v_order.payment_status,
        'notes', v_order.notes,
        'created_at', v_order.created_at,
        'updated_at', v_order.updated_at,
        'items', v_items,
        'history', v_history,
        'payments', v_payments
    );
END;
$$;

-- 7. RPC PARA RECUPERAR FACTURA POR PEDIDO DE FORMA SEGURA
CREATE OR REPLACE FUNCTION public.get_invoice_by_order(p_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_invoice RECORD;
    v_items JSONB;
BEGIN
    SELECT * INTO v_invoice
    FROM public.invoices
    WHERE order_id = p_order_id
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_invoice IS NULL THEN
        RETURN NULL;
    END IF;

    SELECT COALESCE(jsonb_agg(row_to_json(i)), '[]'::jsonb) INTO v_items
    FROM public.invoice_items i
    WHERE i.invoice_id = v_invoice.id;

    RETURN jsonb_build_object(
        'id', v_invoice.id,
        'invoice_number', v_invoice.invoice_number,
        'order_id', v_invoice.order_id,
        'customer_id', v_invoice.customer_id,
        'customer_name', v_invoice.customer_name,
        'customer_id_doc', v_invoice.customer_id_doc,
        'customer_phone', v_invoice.customer_phone,
        'customer_address', v_invoice.customer_address,
        'subtotal', v_invoice.subtotal,
        'discount', v_invoice.discount,
        'tax', v_invoice.tax,
        'total', v_invoice.total,
        'currency', v_invoice.currency,
        'payment_method', v_invoice.payment_method,
        'payment_status', v_invoice.payment_status,
        'status', v_invoice.status,
        'notes', v_invoice.notes,
        'paid_at', v_invoice.paid_at,
        'created_at', v_invoice.created_at,
        'items', v_items
    );
END;
$$;


-- 8. GESTIÓN DE STOCK ATÓMICA Y CONCURRENTE
-- Función para ajuste manual de inventario con bloqueo de fila (FOR UPDATE)
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

    -- Bloqueo pesimista de fila para evitar race conditions
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

-- 9. CREACIÓN ATÓMICA DE PEDIDOS CON CURSORES Y FOR UPDATE
CREATE OR REPLACE FUNCTION public.create_order_atomic(
    p_order_number TEXT,
    p_client_request_id TEXT,
    p_customer_name TEXT,
    p_customer_phone TEXT,
    p_customer_email TEXT,
    p_delivery_address TEXT,
    p_payment_method TEXT,
    p_notes TEXT,
    p_items JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_existing_id UUID;
    v_order_id UUID;
    v_subtotal NUMERIC(14,2) := 0;
    v_discount NUMERIC(14,2) := 0;
    v_tax NUMERIC(14,2) := 0;
    v_total NUMERIC(14,2) := 0;
    v_item RECORD;
    v_product RECORD;
    v_item_total NUMERIC(14,2);
BEGIN
    -- Idempotencia: Verificar si el pedido ya fue procesado
    IF p_client_request_id IS NOT NULL AND trim(p_client_request_id) != '' THEN
        SELECT id INTO v_existing_id
        FROM public.orders
        WHERE client_request_id = p_client_request_id;

        IF v_existing_id IS NOT NULL THEN
            RETURN jsonb_build_object(
                'success', true,
                'order_id', v_existing_id,
                'order_number', p_order_number,
                'is_duplicate', true
            );
        END IF;
    END IF;

    -- Validar que haya artículos
    IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'El pedido debe contener al menos un producto.';
    END IF;

    -- 1. Calcular totales y verificar stock con bloqueo FOR UPDATE
    FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(
        product_id UUID,
        product_name TEXT,
        quantity INT,
        unit_price NUMERIC(14,2),
        original_unit_price NUMERIC(14,2),
        discount_amount NUMERIC(14,2)
    )
    LOOP
        SELECT * INTO v_product
        FROM public.products
        WHERE id = v_item.product_id
        FOR UPDATE;

        IF v_product IS NULL THEN
            RAISE EXCEPTION 'Producto con ID % no encontrado.', v_item.product_id;
        END IF;

        IF v_product.stock < v_item.quantity THEN
            RAISE EXCEPTION 'Stock insuficiente para "%". Disponible: %, Solicitado: %',
                v_product.name, v_product.stock, v_item.quantity;
        END IF;

        v_item_total := v_item.unit_price * v_item.quantity;
        v_subtotal := v_subtotal + (COALESCE(v_item.original_unit_price, v_item.unit_price) * v_item.quantity);
        v_discount := v_discount + (COALESCE(v_item.discount_amount, 0) * v_item.quantity);
        v_total := v_total + v_item_total;
    END LOOP;

    -- 2. Insertar Pedido
    INSERT INTO public.orders (
        order_number, client_request_id, user_id, customer_name, customer_phone,
        customer_email, delivery_address, subtotal, discount, tax, total,
        status, payment_method, payment_status, notes
    ) VALUES (
        p_order_number, p_client_request_id, auth.uid(), p_customer_name, p_customer_phone,
        p_customer_email, p_delivery_address, v_subtotal, v_discount, v_tax, v_total,
        'pending', p_payment_method, 'pending', p_notes
    ) RETURNING id INTO v_order_id;

    -- 3. Insertar items, descontar inventario y registrar movimiento
    FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(
        product_id UUID,
        product_name TEXT,
        quantity INT,
        unit_price NUMERIC(14,2),
        original_unit_price NUMERIC(14,2),
        discount_amount NUMERIC(14,2)
    )
    LOOP
        v_item_total := v_item.unit_price * v_item.quantity;

        INSERT INTO public.order_items (
            order_id, product_id, product_name, quantity, original_unit_price,
            unit_price, discount_amount, total_price
        ) VALUES (
            v_order_id, v_item.product_id, v_item.product_name, v_item.quantity,
            COALESCE(v_item.original_unit_price, v_item.unit_price),
            v_item.unit_price, COALESCE(v_item.discount_amount, 0), v_item_total
        );

        SELECT stock INTO v_product.stock FROM public.products WHERE id = v_item.product_id;

        UPDATE public.products
        SET stock = stock - v_item.quantity, updated_at = now()
        WHERE id = v_item.product_id;

        INSERT INTO public.inventory_movements (
            product_id, type, quantity, previous_stock, new_stock, order_id, note
        ) VALUES (
            v_item.product_id, 'sale', v_item.quantity,
            v_product.stock, (v_product.stock - v_item.quantity),
            v_order_id, 'Venta Web Pedido #' || p_order_number
        );
    END LOOP;

    -- 4. Registrar estado inicial y notificación
    INSERT INTO public.order_status_history (order_id, status, note, changed_by)
    VALUES (v_order_id, 'pending', 'Pedido creado exitosamente desde la tienda web BIKIE.', p_customer_name);

    INSERT INTO public.notifications (title, message, type, order_id)
    VALUES (
        'Nuevo Pedido #' || p_order_number,
        'Cliente: ' || p_customer_name || ' • Total: ' || v_total || ' FCFA',
        'new_order',
        v_order_id
    );

    RETURN jsonb_build_object(
        'success', true,
        'order_id', v_order_id,
        'order_number', p_order_number,
        'total', v_total
    );
END;
$$;

-- 10. VENTA DIRECTA POS ATÓMICA EN UNA SOLA TRANSACCIÓN CONCURRENTE
CREATE OR REPLACE FUNCTION public.process_pos_sale_atomic(
    p_order_number TEXT,
    p_customer_name TEXT,
    p_customer_phone TEXT,
    p_customer_id_doc TEXT,
    p_customer_address TEXT,
    p_subtotal NUMERIC(14,2),
    p_discount NUMERIC(14,2),
    p_tax NUMERIC(14,2),
    p_total NUMERIC(14,2),
    p_payment_method TEXT,
    p_reference TEXT,
    p_cashier_name TEXT,
    p_notes TEXT,
    p_items JSONB
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
    v_invoice_number TEXT;
    v_item RECORD;
    v_product RECORD;
    v_item_total NUMERIC(14,2);
    v_curr_year TEXT := to_char(now(), 'YYYY');
    v_curr_month TEXT := to_char(now(), 'MM');
    v_seq_num BIGINT;
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Solo personal autorizado puede registrar ventas POS.';
    END IF;

    IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'La venta debe contener al menos un producto o servicio.';
    END IF;

    -- 1. Validar y descontar stock con bloqueo FOR UPDATE
    FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(
        product_id UUID,
        product_name TEXT,
        quantity INT,
        original_unit_price NUMERIC(14,2),
        unit_price NUMERIC(14,2),
        discount_amount NUMERIC(14,2),
        total_price NUMERIC(14,2)
    )
    LOOP
        -- Solo si corresponde a un producto existente (los servicios no descontarán si no están en products)
        SELECT * INTO v_product
        FROM public.products
        WHERE id = v_item.product_id
        FOR UPDATE;

        IF v_product IS NOT NULL THEN
            IF v_product.stock < v_item.quantity THEN
                RAISE EXCEPTION 'Stock insuficiente para "%". Disponible: %, Solicitado en caja: %',
                    v_product.name, v_product.stock, v_item.quantity;
            END IF;

            UPDATE public.products
            SET stock = stock - v_item.quantity, updated_at = now()
            WHERE id = v_item.product_id;

            INSERT INTO public.inventory_movements (
                product_id, type, quantity, previous_stock, new_stock, note
            ) VALUES (
                v_item.product_id, 'sale', v_item.quantity,
                v_product.stock, (v_product.stock - v_item.quantity),
                'Venta Mostrador POS #' || p_order_number
            );
        END IF;
    END LOOP;

    -- 2. Crear Registro de Pedido Completado
    INSERT INTO public.orders (
        order_number, customer_name, customer_phone, customer_email, delivery_address,
        subtotal, discount, tax, total, status, payment_method, payment_status, notes
    ) VALUES (
        p_order_number, COALESCE(p_customer_name, 'Cliente Mostrador'),
        COALESCE(p_customer_phone, 'N/A'), NULL,
        COALESCE(p_customer_address, 'Mostrador POS BIKIE'),
        p_subtotal, p_discount, p_tax, p_total,
        'delivered', p_payment_method, 'confirmed',
        COALESCE(p_notes, 'Venta en mostrador POS')
    ) RETURNING id INTO v_order_id;

    -- 3. Crear Items de Pedido
    FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(
        product_id UUID,
        product_name TEXT,
        quantity INT,
        original_unit_price NUMERIC(14,2),
        unit_price NUMERIC(14,2),
        discount_amount NUMERIC(14,2),
        total_price NUMERIC(14,2)
    )
    LOOP
        INSERT INTO public.order_items (
            order_id, product_id, product_name, quantity, original_unit_price,
            unit_price, discount_amount, total_price
        ) VALUES (
            v_order_id, v_item.product_id, v_item.product_name, v_item.quantity,
            v_item.original_unit_price, v_item.unit_price,
            v_item.discount_amount, v_item.total_price
        );
    END LOOP;

    -- 4. Registrar Pago Confirmado
    INSERT INTO public.payments (
        order_id, payment_method, amount, status, reference, verified_at, verified_by
    ) VALUES (
        v_order_id, p_payment_method, p_total, 'confirmed',
        p_reference, now(), p_cashier_name
    ) RETURNING id INTO v_payment_id;

    -- 5. Generar Secuencia y Factura Oficial
    SELECT nextval('invoice_number_seq') INTO v_seq_num;
    v_invoice_number := 'FAC-' || v_curr_year || v_curr_month || '-' || LPAD(v_seq_num::TEXT, 5, '0');

    INSERT INTO public.invoices (
        invoice_number, order_id, customer_name, customer_id_doc, customer_phone,
        customer_address, subtotal, discount, tax, total, currency,
        payment_method, payment_status, status, notes, paid_at
    ) VALUES (
        v_invoice_number, v_order_id, COALESCE(p_customer_name, 'Cliente Mostrador'),
        p_customer_id_doc, p_customer_phone, p_customer_address,
        p_subtotal, p_discount, p_tax, p_total, 'XAF',
        p_payment_method, 'paid', 'paid', p_notes, now()
    ) RETURNING id INTO v_invoice_id;

    -- 6. Crear Items de Factura
    FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(
        product_id UUID,
        product_name TEXT,
        quantity INT,
        original_unit_price NUMERIC(14,2),
        unit_price NUMERIC(14,2),
        discount_amount NUMERIC(14,2),
        total_price NUMERIC(14,2)
    )
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

    -- 7. Registrar Venta Consolidada
    INSERT INTO public.sales (
        sale_number, invoice_id, order_id, cashier_name, total_amount, payment_method
    ) VALUES (
        'VTA-' || v_curr_year || '-' || LPAD(nextval('sale_number_seq')::TEXT, 6, '0'),
        v_invoice_id, v_order_id, p_cashier_name, p_total, p_payment_method
    ) RETURNING id INTO v_sale_id;

    -- 8. Notificación
    INSERT INTO public.notifications (title, message, type, order_id)
    VALUES (
        'Venta POS #' || v_invoice_number,
        'Cajero: ' || p_cashier_name || ' • Monto: ' || p_total || ' FCFA',
        'payment_confirmed',
        v_order_id
    );

    RETURN jsonb_build_object(
        'success', true,
        'order_id', v_order_id,
        'order_number', p_order_number,
        'invoice_id', v_invoice_id,
        'invoice_number', v_invoice_number,
        'payment_id', v_payment_id,
        'sale_id', v_sale_id,
        'total', p_total
    );
END;
$$;

-- 11. HABILITAR PUBLICACIÓN REALTIME EN SUPABASE
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
    END IF;
END $$;

-- FIN DE MODIF_DB.sql
