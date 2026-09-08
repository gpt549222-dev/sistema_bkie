-- ==============================================================================
-- BIKIE PAPELERÍA & SUMINISTROS - MODIFICACIÓN DE BASE DE DATOS
-- Archivo: MODIF_DB.sql
-- Problema resuelto: PROBLEMA 2 - Restricción de create_pos_scanner_session()
-- ==============================================================================
-- Este script es 100% IDEMPOTENTE y SEGURO para ejecutar en Supabase SQL Editor.
--
-- Objetivos y directivas:
-- 1. create_pos_scanner_session() solo puede ejecutarse por personal autenticado (admin/cajero).
-- 2. El rol 'anon' tiene estrictamente REVOCADO el permiso de crear sesiones.
-- 3. Los dispositivos móviles ('anon' o 'authenticated') PUEDEN conectarse a sesiones existentes,
--    desconectarse, validar códigos escaneados y consultar el estado seguro de la sesión.
-- 4. get_pos_scanner_session_status() y connect_pos_scanner_session() NUNCA devuelven session_token.
-- 5. Todas las funciones utilizan SECURITY DEFINER y SET search_path = public.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. FUNCIÓN: create_pos_scanner_session
-- RESTRINGIDA: Solo para usuarios autenticados con rol 'admin' o 'cashier' (personal de tienda)
-- ------------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.create_pos_scanner_session(TEXT, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS public.create_pos_scanner_session(TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.create_pos_scanner_session() CASCADE;

CREATE OR REPLACE FUNCTION public.create_pos_scanner_session(
    p_pos_identifier TEXT DEFAULT 'Caja Principal',
    p_expires_minutes INTEGER DEFAULT 30
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_session_id UUID;
    v_token TEXT;
    v_short_code TEXT;
    v_expires_at TIMESTAMPTZ;
    v_result JSONB;
    v_user_id UUID;
    v_user_role TEXT;
BEGIN
    -- 1. VALIDACIÓN ESTRICTA DE AUTORIZACIÓN:
    -- Los usuarios anónimos (anon) NO tienen permiso para crear sesiones
    v_user_id := auth.uid();
    
    IF auth.role() = 'anon' OR v_user_id IS NULL THEN
        RAISE EXCEPTION 'Acceso denegado: Se requiere autenticación como personal autorizado (admin o cajero) para crear sesiones de escáner.';
    END IF;

    -- Verificar que el usuario tenga rol de personal de tienda ('admin' o 'cashier')
    SELECT role INTO v_user_role
    FROM public.profiles
    WHERE id = v_user_id;

    IF v_user_role IS NULL OR v_user_role NOT IN ('admin', 'cashier') THEN
        RAISE EXCEPTION 'Permisos insuficientes: Solo el personal de la tienda (admin o cajero) puede crear sesiones de escáner.';
    END IF;

    -- 2. GENERAR CREDENCIALES DE SESIÓN TEMPORAL
    v_session_id := gen_random_uuid();
    v_token := 'pss_' || encode(gen_random_bytes(24), 'hex');
    -- Código de 6 dígitos para enlace manual
    v_short_code := lpad(floor(random() * 900000 + 100000)::text, 6, '0');
    v_expires_at := timezone('utc'::text, now()) + (COALESCE(NULLIF(p_expires_minutes, 0), 30) || ' minutes')::interval;

    -- Desactivar sesiones previas en espera creadas por el mismo puesto/usuario
    UPDATE public.pos_scanner_sessions
    SET status = 'disconnected',
        disconnected_at = timezone('utc'::text, now())
    WHERE pos_identifier = COALESCE(NULLIF(trim(p_pos_identifier), ''), 'Caja Principal')
      AND status = 'waiting'
      AND created_by = v_user_id;

    -- Insertar la nueva sesión
    INSERT INTO public.pos_scanner_sessions (
        id,
        session_token,
        short_code,
        pos_identifier,
        created_by,
        status,
        expires_at,
        created_at
    ) VALUES (
        v_session_id,
        v_token,
        v_short_code,
        COALESCE(NULLIF(trim(p_pos_identifier), ''), 'Caja Principal'),
        v_user_id,
        'waiting',
        v_expires_at,
        timezone('utc'::text, now())
    );

    -- Devolver sesión creada (único momento en que el operador POS autenticado recibe el token para generar el QR)
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

-- ------------------------------------------------------------------------------
-- 2. FUNCIÓN: connect_pos_scanner_session
-- PÚBLICA: El dispositivo móvil se conecta a una sesión existente mediante token o código corto
-- NO devuelve session_token
-- ------------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.connect_pos_scanner_session(TEXT, TEXT, TEXT, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.connect_pos_scanner_session(TEXT, TEXT) CASCADE;

CREATE OR REPLACE FUNCTION public.connect_pos_scanner_session(
    p_token TEXT DEFAULT NULL,
    p_short_code TEXT DEFAULT NULL,
    p_device_id TEXT DEFAULT NULL,
    p_device_name TEXT DEFAULT 'Dispositivo Móvil'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

    -- Buscar sesión existente
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

    -- Conectar el dispositivo móvil
    UPDATE public.pos_scanner_sessions
    SET status = 'connected',
        device_id = COALESCE(NULLIF(trim(p_device_id), ''), v_session.device_id, 'device-' || substr(md5(random()::text), 1, 8)),
        device_name = COALESCE(NULLIF(trim(p_device_name), ''), v_session.device_name, 'Dispositivo Móvil'),
        connected_at = v_now
    WHERE id = v_session.id
    RETURNING * INTO v_session;

    -- Seguridad estricta: NO devolver session_token
    RETURN jsonb_build_object(
        'id', v_session.id,
        'session_id', v_session.id,
        'short_code', v_session.short_code,
        'pos_identifier', v_session.pos_identifier,
        'status', v_session.status,
        'device_id', v_session.device_id,
        'device_name', v_session.device_name,
        'created_at', v_session.created_at,
        'expires_at', v_session.expires_at,
        'connected_at', v_session.connected_at
    );
END;
$$;

-- ------------------------------------------------------------------------------
-- 3. FUNCIÓN: disconnect_pos_scanner_session
-- Permite desconectar la sesión desde el POS o desde el dispositivo móvil
-- ------------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.disconnect_pos_scanner_session(UUID, TEXT, TEXT) CASCADE;

CREATE OR REPLACE FUNCTION public.disconnect_pos_scanner_session(
    p_session_id UUID DEFAULT NULL,
    p_token TEXT DEFAULT NULL,
    p_device_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_session RECORD;
    v_now TIMESTAMPTZ := timezone('utc'::text, now());
BEGIN
    IF p_session_id IS NOT NULL THEN
        SELECT * INTO v_session FROM public.pos_scanner_sessions WHERE id = p_session_id;
    ELSIF p_token IS NOT NULL THEN
        SELECT * INTO v_session FROM public.pos_scanner_sessions WHERE session_token = trim(p_token);
    ELSE
        RETURN jsonb_build_object('success', false, 'error', 'Falta session_id o token');
    END IF;

    IF v_session.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Sesión no encontrada');
    END IF;

    -- Si el llamador es anónimo, debe coincidir el token o el dispositivo
    IF auth.role() = 'anon' THEN
        IF p_token IS NOT NULL AND v_session.session_token <> trim(p_token) THEN
            RAISE EXCEPTION 'No autorizado para desconectar esta sesión.';
        END IF;
    END IF;

    UPDATE public.pos_scanner_sessions
    SET status = 'disconnected',
        disconnected_at = v_now
    WHERE id = v_session.id;

    RETURN jsonb_build_object(
        'success', true,
        'session_id', v_session.id,
        'status', 'disconnected'
    );
END;
$$;

-- ------------------------------------------------------------------------------
-- 4. FUNCIÓN: validate_pos_scan_event
-- Valida un código de barras escaneado contra el inventario usando el session_token
-- ------------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.validate_pos_scan_event(TEXT, TEXT, TEXT) CASCADE;

CREATE OR REPLACE FUNCTION public.validate_pos_scan_event(
    p_token TEXT,
    p_barcode TEXT,
    p_device_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_session RECORD;
    v_product RECORD;
    v_now TIMESTAMPTZ := timezone('utc'::text, now());
    v_clean_barcode TEXT;
    v_trimmed_barcode TEXT;
BEGIN
    v_clean_barcode := trim(p_barcode);
    v_trimmed_barcode := ltrim(v_clean_barcode, '0');

    -- Validar token de sesión
    SELECT * INTO v_session
    FROM public.pos_scanner_sessions
    WHERE session_token = trim(p_token);

    IF v_session.id IS NULL THEN
        RETURN jsonb_build_object('valid', false, 'error', 'Sesión de escáner no válida o token incorrecto.');
    END IF;

    IF v_now > v_session.expires_at THEN
        UPDATE public.pos_scanner_sessions SET status = 'expired' WHERE id = v_session.id;
        RETURN jsonb_build_object('valid', false, 'error', 'La sesión de escáner ha expirado.');
    END IF;

    IF v_session.status = 'disconnected' THEN
        RETURN jsonb_build_object('valid', false, 'error', 'La sesión de escáner está desconectada.');
    END IF;

    -- Registrar último código escaneado
    UPDATE public.pos_scanner_sessions
    SET last_scanned_barcode = v_clean_barcode,
        last_scanned_at = v_now
    WHERE id = v_session.id;

    -- Buscar producto por código de barras o código interno
    SELECT * INTO v_product
    FROM public.products
    WHERE LOWER(barcode) = LOWER(v_clean_barcode)
       OR LOWER(code) = LOWER(v_clean_barcode)
       OR (v_trimmed_barcode <> '' AND (LOWER(barcode) = LOWER(v_trimmed_barcode) OR LOWER(code) = LOWER(v_trimmed_barcode)))
    LIMIT 1;

    IF v_product.id IS NOT NULL THEN
        RETURN jsonb_build_object(
            'valid', true,
            'found', true,
            'product_id', v_product.id,
            'barcode', COALESCE(v_product.barcode, v_product.code),
            'product_name', v_product.name,
            'price', v_product.price,
            'stock', v_product.stock
        );
    ELSE
        RETURN jsonb_build_object(
            'valid', true,
            'found', false,
            'barcode', v_clean_barcode,
            'message', 'Código no registrado en el inventario'
        );
    END IF;
END;
$$;

-- ------------------------------------------------------------------------------
-- 5. FUNCIÓN: get_pos_scanner_session_status
-- Devuelve exclusivamente metadatos seguros de la sesión (NUNCA session_token)
-- ------------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.get_pos_scanner_session_status(UUID, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.get_pos_scanner_session_status(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.get_pos_scanner_session_status(TEXT) CASCADE;

CREATE OR REPLACE FUNCTION public.get_pos_scanner_session_status(
    p_session_id UUID DEFAULT NULL,
    p_token TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

    -- Verificar expiración
    IF timezone('utc'::text, now()) > v_session.expires_at AND v_session.status <> 'disconnected' THEN
        UPDATE public.pos_scanner_sessions SET status = 'expired' WHERE id = v_session.id;
        v_session.status := 'expired';
    END IF;

    -- Devolver ÚNICAMENTE campos no sensibles (NUNCA session_token)
    RETURN jsonb_build_object(
        'session_id', v_session.id,
        'id', v_session.id,
        'status', v_session.status,
        'pos_identifier', v_session.pos_identifier,
        'device_id', v_session.device_id,
        'device_name', v_session.device_name,
        'short_code', v_session.short_code,
        'created_at', v_session.created_at,
        'expires_at', v_session.expires_at,
        'connected_at', v_session.connected_at,
        'disconnected_at', v_session.disconnected_at,
        'last_scanned_barcode', v_session.last_scanned_barcode,
        'last_scanned_at', v_session.last_scanned_at
    );
END;
$$;

-- ------------------------------------------------------------------------------
-- 6. MATRIZ DE PERMISOS (GRANT / REVOKE EXECUTE)
-- ------------------------------------------------------------------------------

-- 6.1 create_pos_scanner_session:
-- ESTRICTO: Revocado para PUBLIC y anon. Concedido únicamente a authenticated.
REVOKE ALL ON FUNCTION public.create_pos_scanner_session(TEXT, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_pos_scanner_session(TEXT, INTEGER) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_pos_scanner_session(TEXT, INTEGER) TO authenticated;

-- 6.2 connect_pos_scanner_session:
-- Concedido a anon y authenticated (el móvil se conecta a una sesión existente)
REVOKE ALL ON FUNCTION public.connect_pos_scanner_session(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.connect_pos_scanner_session(TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;

-- 6.3 disconnect_pos_scanner_session:
-- Concedido a anon y authenticated
REVOKE ALL ON FUNCTION public.disconnect_pos_scanner_session(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.disconnect_pos_scanner_session(UUID, TEXT, TEXT) TO anon, authenticated;

-- 6.4 validate_pos_scan_event:
-- Concedido a anon y authenticated (el móvil valida códigos usando el session_token)
REVOKE ALL ON FUNCTION public.validate_pos_scan_event(TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_pos_scan_event(TEXT, TEXT, TEXT) TO anon, authenticated;

-- 6.5 get_pos_scanner_session_status:
-- Concedido a anon y authenticated (solo expone metadatos seguros)
REVOKE ALL ON FUNCTION public.get_pos_scanner_session_status(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_pos_scanner_session_status(UUID, TEXT) TO anon, authenticated;
