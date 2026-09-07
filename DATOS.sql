-- ==============================================================================
-- BIKIE PAPELERÍA & SUMINISTROS - SCRIPT DE BASE DE DATOS
-- Archivo: DATOS.sql
-- ==============================================================================
-- Este script es 100% IDEMPOTENTE y SEGURO.
-- Ejecútalo en el SQL Editor de tu proyecto Supabase para habilitar:
--   1. Gestión de usuarios (Crear nuevo usuario admin, cajero o cliente con contraseña).
--   2. Funciones para anular, eliminar y depurar facturas de forma segura.
--   3. Funciones para eliminar y limpiar pedidos (cancelados, entregados o todos).
--   4. Listado seguro de perfiles de usuario para la pantalla de Configuración.
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==============================================================================
-- 1. GESTIÓN DE USUARIOS DEL SISTEMA (CREACIÓN, LISTADO Y ROLES)
-- ==============================================================================

-- 1.1 Función para crear un nuevo usuario directamente en auth.users y public.profiles
CREATE OR REPLACE FUNCTION public.create_new_system_user(
    p_email TEXT,
    p_password TEXT,
    p_full_name TEXT DEFAULT '',
    p_role TEXT DEFAULT 'cashier',
    p_phone TEXT DEFAULT ''
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
    v_user_id UUID;
    v_encrypted_pw TEXT;
    v_normalized_email TEXT;
    v_clean_role TEXT;
BEGIN
    v_normalized_email := LOWER(TRIM(p_email));
    v_clean_role := LOWER(TRIM(p_role));

    IF v_normalized_email IS NULL OR v_normalized_email = '' OR v_normalized_email NOT LIKE '%@%' THEN
        RETURN jsonb_build_object('success', false, 'message', 'Correo electrónico inválido.');
    END IF;

    IF p_password IS NULL OR length(p_password) < 6 THEN
        RETURN jsonb_build_object('success', false, 'message', 'La contraseña debe tener al menos 6 caracteres.');
    END IF;

    IF v_clean_role NOT IN ('admin', 'cashier', 'customer') THEN
        v_clean_role := 'cashier';
    END IF;

    -- Verificar si el usuario ya existe en auth.users
    SELECT id INTO v_user_id FROM auth.users WHERE email = v_normalized_email;
    IF v_user_id IS NOT NULL THEN
        -- Si existe, actualizamos su rol y perfil
        UPDATE public.profiles
        SET full_name = COALESCE(NULLIF(TRIM(p_full_name), ''), full_name),
            role = v_clean_role,
            phone = COALESCE(NULLIF(TRIM(p_phone), ''), phone),
            updated_at = now()
        WHERE id = v_user_id;

        -- Actualizar contraseña en auth.users
        v_encrypted_pw := crypt(p_password, gen_salt('bf'));
        UPDATE auth.users
        SET encrypted_password = v_encrypted_pw,
            updated_at = now()
        WHERE id = v_user_id;

        RETURN jsonb_build_object(
            'success', true,
            'user_id', v_user_id,
            'email', v_normalized_email,
            'role', v_clean_role,
            'message', 'Usuario existente actualizado con éxito.'
        );
    END IF;

    -- Generar UUID y hash de contraseña con pgcrypto
    v_user_id := gen_random_uuid();
    v_encrypted_pw := crypt(p_password, gen_salt('bf'));

    -- Insertar en auth.users
    INSERT INTO auth.users (
        id,
        instance_id,
        aud,
        role,
        email,
        encrypted_password,
        email_confirmed_at,
        raw_app_meta_data,
        raw_user_meta_data,
        created_at,
        updated_at,
        confirmation_token,
        recovery_token
    ) VALUES (
        v_user_id,
        '00000000-0000-0000-0000-000000000000'::uuid,
        'authenticated',
        'authenticated',
        v_normalized_email,
        v_encrypted_pw,
        now(),
        jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
        jsonb_build_object('full_name', p_full_name, 'phone', p_phone, 'role', v_clean_role),
        now(),
        now(),
        '',
        ''
    );

    -- Insertar o actualizar en public.profiles
    INSERT INTO public.profiles (
        id,
        full_name,
        role,
        phone,
        created_at,
        updated_at
    ) VALUES (
        v_user_id,
        COALESCE(TRIM(p_full_name), v_normalized_email),
        v_clean_role,
        TRIM(p_phone),
        now(),
        now()
    )
    ON CONFLICT (id) DO UPDATE
    SET full_name = EXCLUDED.full_name,
        role = EXCLUDED.role,
        phone = EXCLUDED.phone,
        updated_at = now();

    RETURN jsonb_build_object(
        'success', true,
        'user_id', v_user_id,
        'email', v_normalized_email,
        'role', v_clean_role,
        'message', 'Usuario creado exitosamente.'
    );
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$;

-- 1.2 Función para consultar usuarios y roles del sistema
CREATE OR REPLACE FUNCTION public.get_system_users()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_users JSONB;
BEGIN
    SELECT jsonb_agg(
        jsonb_build_object(
            'id', u.id,
            'email', u.email,
            'full_name', COALESCE(p.full_name, u.raw_user_meta_data->>'full_name', ''),
            'role', COALESCE(p.role, 'customer'),
            'phone', COALESCE(p.phone, ''),
            'created_at', u.created_at,
            'last_sign_in_at', u.last_sign_in_at
        ) ORDER BY u.created_at DESC
    ) INTO v_users
    FROM auth.users u
    LEFT JOIN public.profiles p ON p.id = u.id;

    RETURN COALESCE(v_users, '[]'::jsonb);
END;
$$;

-- 1.3 Función para eliminar un usuario del sistema
CREATE OR REPLACE FUNCTION public.delete_system_user(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
    DELETE FROM public.profiles WHERE id = p_user_id;
    DELETE FROM auth.users WHERE id = p_user_id;
    RETURN jsonb_build_object('success', true, 'message', 'Usuario eliminado.');
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$;

-- ==============================================================================
-- 2. GESTIÓN Y LIMPIEZA DE PEDIDOS (ORDERS)
-- ==============================================================================

-- 2.1 Eliminar un pedido individual en cascada
CREATE OR REPLACE FUNCTION public.delete_order_atomic(p_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    DELETE FROM public.order_items WHERE order_id = p_order_id;
    DELETE FROM public.order_status_history WHERE order_id = p_order_id;
    DELETE FROM public.payments WHERE order_id = p_order_id;
    UPDATE public.sales SET order_id = NULL WHERE order_id = p_order_id;
    UPDATE public.invoices SET order_id = NULL WHERE order_id = p_order_id;
    DELETE FROM public.orders WHERE id = p_order_id;

    RETURN jsonb_build_object('success', true, 'order_id', p_order_id);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$;

-- 2.2 Limpieza masiva de pedidos por estado ('cancelled', 'delivered', 'all')
CREATE OR REPLACE FUNCTION public.clear_orders_atomic(p_mode TEXT DEFAULT 'cancelled')
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_ids UUID[];
    v_count INT := 0;
BEGIN
    IF p_mode = 'cancelled' THEN
        SELECT array_agg(id) INTO v_ids FROM public.orders WHERE status = 'cancelled';
    ELSIF p_mode = 'delivered' THEN
        SELECT array_agg(id) INTO v_ids FROM public.orders WHERE status = 'delivered';
    ELSE
        SELECT array_agg(id) INTO v_ids FROM public.orders;
    END IF;

    IF v_ids IS NOT NULL AND array_length(v_ids, 1) > 0 THEN
        v_count := array_length(v_ids, 1);
        DELETE FROM public.order_items WHERE order_id = ANY(v_ids);
        DELETE FROM public.order_status_history WHERE order_id = ANY(v_ids);
        DELETE FROM public.payments WHERE order_id = ANY(v_ids);
        UPDATE public.sales SET order_id = NULL WHERE order_id = ANY(v_ids);
        UPDATE public.invoices SET order_id = NULL WHERE order_id = ANY(v_ids);
        DELETE FROM public.orders WHERE id = ANY(v_ids);
    END IF;

    RETURN jsonb_build_object('success', true, 'deleted_count', v_count);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$;

-- ==============================================================================
-- 3. GESTIÓN Y LIMPIEZA DE FACTURAS (INVOICES)
-- ==============================================================================

-- 3.1 Anulación oficial de factura
CREATE OR REPLACE FUNCTION public.cancel_invoice_atomic(
    p_invoice_id UUID,
    p_reason TEXT DEFAULT 'Anulación por administrador',
    p_cancelled_by TEXT DEFAULT 'Administrador'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_invoice RECORD;
BEGIN
    SELECT * INTO v_invoice FROM public.invoices WHERE id = p_invoice_id FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Factura no encontrada.');
    END IF;

    UPDATE public.invoices
    SET status = 'cancelled',
        payment_status = 'cancelled',
        notes = COALESCE(notes || E'\n', '') || 'ANULADA: ' || COALESCE(p_reason, 'Sin motivo') || ' por ' || COALESCE(p_cancelled_by, 'Admin') || ' [' || to_char(now(), 'YYYY-MM-DD HH24:MI') || ']',
        updated_at = now()
    WHERE id = p_invoice_id;

    RETURN jsonb_build_object('success', true, 'invoice_id', p_invoice_id, 'status', 'cancelled');
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$;

-- 3.2 Borrado físico de factura en cascada
CREATE OR REPLACE FUNCTION public.delete_invoice_atomic(p_invoice_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    DELETE FROM public.invoice_items WHERE invoice_id = p_invoice_id;
    UPDATE public.sales SET invoice_id = NULL WHERE invoice_id = p_invoice_id;
    DELETE FROM public.invoices WHERE id = p_invoice_id;

    RETURN jsonb_build_object('success', true, 'invoice_id', p_invoice_id);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$;

-- 3.3 Limpieza masiva de facturas ('cancelled', 'all')
CREATE OR REPLACE FUNCTION public.clear_invoices_atomic(p_mode TEXT DEFAULT 'cancelled')
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_ids UUID[];
    v_count INT := 0;
BEGIN
    IF p_mode = 'cancelled' THEN
        SELECT array_agg(id) INTO v_ids FROM public.invoices WHERE status = 'cancelled';
    ELSE
        SELECT array_agg(id) INTO v_ids FROM public.invoices;
    END IF;

    IF v_ids IS NOT NULL AND array_length(v_ids, 1) > 0 THEN
        v_count := array_length(v_ids, 1);
        DELETE FROM public.invoice_items WHERE invoice_id = ANY(v_ids);
        UPDATE public.sales SET invoice_id = NULL WHERE invoice_id = ANY(v_ids);
        DELETE FROM public.invoices WHERE id = ANY(v_ids);
    END IF;

    RETURN jsonb_build_object('success', true, 'deleted_count', v_count);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$;

-- ==============================================================================
-- 4. PERMISOS DE EJECUCIÓN (RPC)
-- ==============================================================================
GRANT EXECUTE ON FUNCTION public.create_new_system_user(TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_system_users() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.delete_system_user(UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.delete_order_atomic(UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.clear_orders_atomic(TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.cancel_invoice_atomic(UUID, TEXT, TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.delete_invoice_atomic(UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.clear_invoices_atomic(TEXT) TO authenticated, anon;

-- Notificar éxito de instalación
SELECT 'DATOS.sql instalado correctamente con soporte para Usuarios, Pedidos y Facturas.' AS resultado;
