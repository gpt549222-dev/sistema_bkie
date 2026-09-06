-- ==============================================================================
-- BIKIE PAPELERÍA - SCRIPT DE MIGRACIÓN: CÓDIGOS DE BARRAS & POS ESCÁNER
-- Archivo: DATOS_BARCODE.sql
-- ==============================================================================
-- Este script es 100% IDEMPOTENTE y SEGURO.
-- Puedes ejecutarlo directamente en el SQL Editor de tu proyecto en Supabase.
--
-- Añade:
--  1. Columna 'barcode' a public.products para almacenar el código de barras escaneable.
--  2. Sincronización automática de productos existentes (barcode = code).
--  3. Índices de búsqueda optimizados para escaneo de alta velocidad en el POS.
--  4. Función generadora de códigos de barras EAN-13 / Code-128 en PostgreSQL.
--  5. Trigger que asegura que todo producto nuevo o actualizado tenga su código de barra.
--  6. Actualización de la función RPC atómica 'create_product_atomic'.
-- ==============================================================================

-- 1. AGREGAR COLUMNA DE CÓDIGO DE BARRAS A LA TABLA PRODUCTS
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS barcode TEXT;

-- 2. SINCRONIZAR PRODUCTOS EXISTENTES SIN CÓDIGO DE BARRAS
UPDATE public.products 
SET barcode = UPPER(TRIM(code)) 
WHERE barcode IS NULL OR barcode = '';

-- 3. ÍNDICES DE ALTO RENDIMIENTO PARA BÚSQUEDA INSTANTÁNEA EN CAJA POS
CREATE INDEX IF NOT EXISTS idx_products_barcode_upper 
ON public.products (UPPER(TRIM(barcode)));

CREATE INDEX IF NOT EXISTS idx_products_code_upper 
ON public.products (UPPER(TRIM(code)));

-- 4. FUNCIÓN PARA GENERAR CÓDIGOS DE BARRAS ÚNICOS EN POSTGRESQL
-- Genera un código estándar de 13 dígitos compatible con lectores de código de barras
CREATE OR REPLACE FUNCTION public.generate_product_barcode(p_prefix TEXT DEFAULT '200')
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
    v_random_digits TEXT;
    v_code12 TEXT;
    v_sum INT := 0;
    v_digit INT;
    v_i INT;
    v_checksum INT;
    v_full_barcode TEXT;
    v_exists BOOLEAN;
BEGIN
    LOOP
        -- Generar 9 dígitos aleatorios
        v_random_digits := lpad(floor(random() * 1000000000)::text, 9, '0');
        v_code12 := p_prefix || v_random_digits;

        -- Cálculo estándar de checksum EAN-13 (módulo 10)
        v_sum := 0;
        FOR v_i IN 1..12 LOOP
            v_digit := substring(v_code12 from v_i for 1)::INT;
            IF v_i % 2 = 1 THEN
                v_sum := v_sum + v_digit;
            ELSE
                v_sum := v_sum + (v_digit * 3);
            END IF;
        END LOOP;

        v_checksum := (10 - (v_sum % 10)) % 10;
        v_full_barcode := v_code12 || v_checksum::text;

        -- Verificar que no exista ya en la base de datos
        SELECT EXISTS(
            SELECT 1 FROM public.products 
            WHERE barcode = v_full_barcode OR code = v_full_barcode
        ) INTO v_exists;

        IF NOT v_exists THEN
            RETURN v_full_barcode;
        END IF;
    END LOOP;
END;
$$;

-- 5. TRIGGER PARA AUTO-ASIGNAR CÓDIGO DE BARRAS ANTES DE INSERTAR
CREATE OR REPLACE FUNCTION public.trg_fn_ensure_product_barcode()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Si el código de barra está vacío, usar el SKU/code
    IF NEW.barcode IS NULL OR TRIM(NEW.barcode) = '' THEN
        IF NEW.code IS NOT NULL AND TRIM(NEW.code) <> '' THEN
            NEW.barcode := UPPER(TRIM(NEW.code));
        ELSE
            NEW.barcode := public.generate_product_barcode('200');
        END IF;
    ELSE
        NEW.barcode := UPPER(TRIM(NEW.barcode));
    END IF;

    -- Si el code viene vacío, usar el barcode
    IF NEW.code IS NULL OR TRIM(NEW.code) = '' THEN
        NEW.code := NEW.barcode;
    ELSE
        NEW.code := UPPER(TRIM(NEW.code));
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_products_ensure_barcode ON public.products;
CREATE TRIGGER trg_products_ensure_barcode
BEFORE INSERT OR UPDATE ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.trg_fn_ensure_product_barcode();

-- 6. ACTUALIZAR FUNCIÓN ATÓMICA DE CREACIÓN DE PRODUCTOS CON SOPORTE DE BARCODE
DROP FUNCTION IF EXISTS public.create_product_atomic(TEXT, TEXT, TEXT, NUMERIC, NUMERIC, INT, INT, UUID, TEXT, BOOLEAN, BOOLEAN, TEXT) CASCADE;
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
    p_is_featured BOOLEAN DEFAULT false,
    p_barcode TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_clean_code TEXT;
    v_clean_barcode TEXT;
    v_clean_name TEXT;
    v_product RECORD;
    v_category RECORD;
    v_movement_id UUID;
BEGIN
    -- 1. Verificar rol de administrador
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Operación denegada: Solo administradores pueden crear productos.';
    END IF;

    -- 2. Limpieza de datos
    v_clean_code := UPPER(TRIM(p_code));
    v_clean_name := TRIM(p_name);
    v_clean_barcode := UPPER(TRIM(COALESCE(p_barcode, p_code)));

    IF v_clean_code IS NULL OR v_clean_code = '' THEN
        v_clean_code := public.generate_product_barcode('200');
        v_clean_barcode := v_clean_code;
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

    -- Verificar unicidad de código
    IF EXISTS (SELECT 1 FROM public.products WHERE UPPER(TRIM(code)) = v_clean_code) THEN
        RAISE EXCEPTION 'Ya existe un producto registrado con el código "%".', v_clean_code;
    END IF;

    -- Verificar categoría si fue provista
    IF p_category_id IS NOT NULL THEN
        SELECT * INTO v_category FROM public.categories WHERE id = p_category_id;
        IF NOT FOUND OR v_category.id IS NULL THEN
            RAISE EXCEPTION 'La categoría especificada no existe.';
        END IF;
    END IF;

    -- 3. Inserción atómica del producto
    INSERT INTO public.products (
        code,
        barcode,
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
        v_clean_barcode,
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

    -- 4. Registrar movimiento de inventario inicial si hay existencias
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
            'purchase',
            p_stock,
            0,
            p_stock,
            'Inventario inicial al dar de alta producto'
        ) RETURNING id INTO v_movement_id;
    END IF;

    -- Retornar el producto creado en formato JSON
    RETURN to_jsonb(v_product);
END;
$$;

-- Permisos de ejecución
GRANT EXECUTE ON FUNCTION public.generate_product_barcode(TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.create_product_atomic(TEXT, TEXT, TEXT, NUMERIC, NUMERIC, INT, INT, UUID, TEXT, BOOLEAN, BOOLEAN, TEXT) TO authenticated;

-- Confirmación de ejecución exitosa
SELECT 'MIGRACIÓN DE CÓDIGOS DE BARRAS EXITOSA' as estado, count(*) as total_productos_actualizados FROM public.products;
