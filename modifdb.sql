-- ==============================================================================
-- BIKIE PAPELERÍA — SCRIPT DE MODIFICACIONES DE BASE DE DATOS (modifdb.sql)
-- ==============================================================================
-- Este archivo contiene las extensiones de esquema para:
-- 1. Módulo de Servicios Adicionales (Copias, Redacción, Plastificado, Bebidas, etc.)
-- 2. Módulo de Proveedores (Suppliers)
-- Moneda Oficial del Sistema: FCFA (XAF)
-- ==============================================================================

-- 1. TABLA DE SERVICIOS ADICIONALES (public.services)
CREATE TABLE IF NOT EXISTS public.services (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'copias', -- 'copias', 'impresiones', 'redaccion', 'plastificado', 'encuadernacion', 'bebidas', 'digitalizacion', 'otros'
    price NUMERIC(14,2) NOT NULL CHECK (price >= 0),
    unit_label TEXT NOT NULL DEFAULT 'por servicio', -- 'por hoja', 'por unidad', 'por doc', etc.
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. TABLA DE PROVEEDORES (public.suppliers)
CREATE TABLE IF NOT EXISTS public.suppliers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    contact_person TEXT,
    website_url TEXT,
    phone TEXT,
    email TEXT,
    address TEXT,
    category TEXT DEFAULT 'Papelería General', -- 'Papelería General', 'Equipos', 'Consumibles', 'Bebidas', etc.
    notes TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3. ÍNDICES DE RENDIMIENTO
CREATE INDEX IF NOT EXISTS idx_services_category ON public.services(category);
CREATE INDEX IF NOT EXISTS idx_services_is_active ON public.services(is_active);
CREATE INDEX IF NOT EXISTS idx_suppliers_category ON public.suppliers(category);
CREATE INDEX IF NOT EXISTS idx_suppliers_is_active ON public.suppliers(is_active);

-- 4. HABILITAR ROW LEVEL SECURITY (RLS)
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

-- 5. POLÍTICAS RLS PARA SERVICIOS
DROP POLICY IF EXISTS "Public read services" ON public.services;
CREATE POLICY "Public read services" ON public.services
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admin modify services" ON public.services;
CREATE POLICY "Admin modify services" ON public.services
    FOR ALL USING (true) WITH CHECK (true);

-- 6. POLÍTICAS RLS PARA PROVEEDORES
DROP POLICY IF EXISTS "Public read suppliers" ON public.suppliers;
CREATE POLICY "Public read suppliers" ON public.suppliers
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admin modify suppliers" ON public.suppliers;
CREATE POLICY "Admin modify suppliers" ON public.suppliers
    FOR ALL USING (true) WITH CHECK (true);

-- 7. DATOS SEMILLA INICIALES (SERVICIOS ADICIONALES)
INSERT INTO public.services (code, name, category, price, unit_label, description, is_active)
VALUES
    ('SRV-COP-BN', 'Fotocopia Blanco y Negro (A4)', 'copias', 25, 'por página', 'Copia nítida estándar en papel bond 75g', true),
    ('SRV-COP-COL', 'Fotocopia a Color HD (A4)', 'copias', 100, 'por página', 'Copia full color en alta resolución', true),
    ('SRV-IMP-DOC', 'Impresión de Documentos / Tesis (A4)', 'impresiones', 50, 'por página', 'Impresión láser de texto y gráficos', true),
    ('SRV-PLA-CAR', 'Plastificado de Carnet / CNI / NIF', 'plastificado', 250, 'por unidad', 'Protección térmica sellada mate o brillante', true),
    ('SRV-PLA-A4', 'Plastificado Formato A4', 'plastificado', 500, 'por unidad', 'Laminado térmico protector de alta durabilidad', true),
    ('SRV-RED-CV', 'Redacción & Diseño de Curriculum Vitae (CV)', 'redaccion', 3000, 'por documento', 'Redacción profesional y formato internacional ATS', true),
    ('SRV-RED-CON', 'Redacción de Contratos & Cartas Comerciales', 'redaccion', 5000, 'por documento', 'Redacción formal personalizada con términos legales', true),
    ('SRV-ENC-ANI', 'Encuadernación con Anillado Espiral & Portada', 'encuadernacion', 1000, 'por fascículo', 'Incluye tapas plásticas protectoras y espiral resistente', true),
    ('SRV-DIG-PDF', 'Escaneo & Digitalización OCR a PDF', 'digitalizacion', 50, 'por página', 'Digitalización en alta resolución enviada al correo/WhatsApp', true),
    ('SRV-BEB-AGU', 'Agua Mineral Purificada 500ml', 'bebidas', 300, 'por botella', 'Bebida fría refrescante', true),
    ('SRV-BEB-JUG', 'Jugo Natural / Gaseosa Helada 330ml', 'bebidas', 500, 'por lata/botella', 'Variedad de sabores bien fría', true),
    ('SRV-BEB-CAF', 'Café Expreso / Capuchino Caliente', 'bebidas', 400, 'por taza', 'Café recién colado con azúcar al gusto', true)
ON CONFLICT (code) DO NOTHING;

-- 8. DATOS SEMILLA INICIALES (PROVEEDORES)
INSERT INTO public.suppliers (name, contact_person, website_url, phone, email, address, category, notes, is_active)
VALUES
    ('Distribuidora Central de Papelería S.A.', 'Laurent Essono', 'https://distripapel-central.example.com', '+237 670 112 233', 'ventas@distripapel.cm', 'Zona Industrial Bassa, Douala', 'Papelería General', 'Proveedor principal de cuadernos, resmas de papel bond y cartulinas. Despacho semanal.', true),
    ('Importadora Gráfica & Consumibles Global', 'Marie Claire Ngo', 'https://graficaglobal.example.com', '+237 699 445 566', 'pedidos@graficaglobal.cm', 'Boulevard de la Liberté, Akwa', 'Consumibles de Impresión', 'Tóners originales, tintas Epson/HP, cintas y laminadoras térmicas.', true),
    ('Bebidas & Refrigerios del Litoral', 'Alain Mbarga', 'https://bebidaslitoral.example.com', '+237 655 889 900', 'contacto@bebidaslitoral.cm', 'Av. des Cocotiers, Bonanjo', 'Bebidas & Cafetería', 'Agua mineral, jugos en lata, café y botanas para atención al cliente.', true),
    ('Suministros Escolares & Bellas Artes Tech', 'Fabiola Kouam', 'https://artestech-supplies.example.com', '+237 680 778 899', 'info@artestech.cm', 'Rue Joss, Douala', 'Arte y Arquitectura', 'Materiales técnicos: compases, estilógrafos, reglas T, pinturas acrílicas y lienzos.', true)
ON CONFLICT DO NOTHING;

-- 9. TABLA DE NOTIFICACIONES (public.notifications)
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'info', -- 'new_order', 'payment_confirmed', 'low_stock', 'offer_alert', 'info'
    is_read BOOLEAN NOT NULL DEFAULT false,
    order_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON public.notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read notifications" ON public.notifications;
CREATE POLICY "Public read notifications" ON public.notifications
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admin all notifications" ON public.notifications;
CREATE POLICY "Admin all notifications" ON public.notifications
    FOR ALL USING (true) WITH CHECK (true);

