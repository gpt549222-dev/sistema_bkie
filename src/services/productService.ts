import { supabase, isTableMissingError } from './supabase';
import { Product, Category, InventoryMovement, InventoryMovementType } from '../types';
import { sanitizeImageUrl } from '../utils/imageUrl';

export async function getProducts(includeInactive = false): Promise<Product[]> {
  let query = supabase
    .from('products')
    .select('*, category:categories(*)')
    .order('created_at', { ascending: false });

  if (!includeInactive) {
    query = query.eq('is_active', true);
  }

  const { data, error } = await query;
  if (error) {
    if (isTableMissingError(error)) {
      console.warn("Tabla 'public.products' no encontrada en Supabase. Ejecuta la migración SQL.");
      return [];
    }
    throw new Error(`Error al obtener productos: ${error.message}`);
  }

  return (data || []).map((p: any) => ({
    ...p,
    price: Number(p.price) || 0,
    cost_price: Number(p.cost_price) || 0,
    stock: Number(p.stock) || 0,
    min_stock: Number(p.min_stock) || 0,
  }));
}

export async function getProduct(id: string): Promise<Product | null> {
  const { data, error } = await supabase
    .from('products')
    .select('*, category:categories(*)')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    if (isTableMissingError(error)) return null;
    throw new Error(`Error al obtener producto: ${error.message}`);
  }

  if (!data) return null;

  return {
    ...data,
    price: Number(data.price) || 0,
    cost_price: Number(data.cost_price) || 0,
    stock: Number(data.stock) || 0,
    min_stock: Number(data.min_stock) || 0,
  };
}

export async function getProductByCode(code: string): Promise<Product | null> {
  const cleanCode = (code || '').trim();
  if (!cleanCode) return null;

  // 1. Search by exact code or barcode
  let { data, error } = await supabase
    .from('products')
    .select('*, category:categories(*)')
    .eq('is_active', true)
    .or(`code.ilike.${cleanCode},barcode.ilike.${cleanCode}`)
    .maybeSingle();

  // If error (e.g. barcode column not yet added to table), fallback to pure code match
  if (error) {
    const fallback = await supabase
      .from('products')
      .select('*, category:categories(*)')
      .eq('is_active', true)
      .ilike('code', cleanCode)
      .maybeSingle();
    data = fallback.data;
    error = fallback.error;
  }

  // 2. If not found by code and string looks like UUID, search by ID
  if (!data && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanCode)) {
    const res = await supabase
      .from('products')
      .select('*, category:categories(*)')
      .eq('is_active', true)
      .eq('id', cleanCode)
      .maybeSingle();
    data = res.data;
    error = res.error;
  }

  if (error) {
    if (isTableMissingError(error)) return null;
    console.warn('[productService] Error buscando producto por código:', error.message);
    return null;
  }

  if (!data) return null;

  return {
    ...data,
    price: Number(data.price) || 0,
    cost_price: Number(data.cost_price) || 0,
    stock: Number(data.stock) || 0,
    min_stock: Number(data.min_stock) || 0,
  };
}

export async function createProduct(productData: {
  code: string;
  barcode?: string | null;
  name: string;
  description?: string | null;
  price: number;
  cost_price?: number;
  stock: number;
  min_stock?: number;
  category_id?: string | null;
  image_url?: string | null;
  is_active?: boolean;
  is_featured?: boolean;
}): Promise<Product> {
  if (!productData.name?.trim()) {
    throw new Error('El nombre del producto es obligatorio.');
  }
  if (!productData.code?.trim()) {
    throw new Error('El código o SKU del producto es obligatorio.');
  }
  if (productData.price < 0) {
    throw new Error('El precio no puede ser negativo.');
  }
  if (productData.stock < 0) {
    throw new Error('El stock inicial no puede ser negativo.');
  }

  const cleanCode = (productData.code || '').trim().toUpperCase();
  const cleanBarcode = (productData.barcode || cleanCode).trim().toUpperCase();

  // 1. Intentar creación atómica con RPC (intentando primero con parámetro p_barcode)
  let rpcProduct: any = null;
  let rpcError: any = null;

  const res12 = await supabase.rpc('create_product_atomic', {
    p_code: cleanCode,
    p_name: (productData.name || '').trim(),
    p_description: productData.description?.trim() || null,
    p_price: Number(productData.price),
    p_cost_price: Number(productData.cost_price || 0),
    p_stock: Math.floor(Number(productData.stock || 0)),
    p_min_stock: Math.floor(Number(productData.min_stock ?? 5)),
    p_category_id: productData.category_id || null,
    p_image_url: sanitizeImageUrl(productData.image_url) || null,
    p_is_active: productData.is_active ?? true,
    p_is_featured: productData.is_featured ?? false,
    p_barcode: cleanBarcode,
  });

  if (!res12.error && res12.data) {
    rpcProduct = res12.data;
  } else {
    // Si falló por firma de función RPC de 11 argumentos, reintentar con 11 argumentos
    const res11 = await supabase.rpc('create_product_atomic', {
      p_code: cleanCode,
      p_name: (productData.name || '').trim(),
      p_description: productData.description?.trim() || null,
      p_price: Number(productData.price),
      p_cost_price: Number(productData.cost_price || 0),
      p_stock: Math.floor(Number(productData.stock || 0)),
      p_min_stock: Math.floor(Number(productData.min_stock ?? 5)),
      p_category_id: productData.category_id || null,
      p_image_url: sanitizeImageUrl(productData.image_url) || null,
      p_is_active: productData.is_active ?? true,
      p_is_featured: productData.is_featured ?? false,
    });

    if (!res11.error && res11.data) {
      rpcProduct = res11.data;
    } else {
      rpcError = res11.error || res12.error;
    }
  }

  // Si el RPC falló, lanzar error informativo y no realizar inserciones directas sin control atómico
  if (rpcError) {
    console.error('[productService] Error en RPC create_product_atomic:', rpcError);
    if (rpcError.code === '23505' || rpcError.message?.includes('Ya existe un producto') || rpcError.message?.includes('código')) {
      throw new Error(`Ya existe un producto con el código o código de barras "${cleanCode}".`);
    }
    throw new Error(rpcError.message || 'Error al crear producto en la base de datos.');
  }

  if (!rpcProduct || !rpcProduct.id) {
    throw new Error('No se pudo confirmar la creación del producto en la base de datos.');
  }

  return {
    ...rpcProduct,
    price: Number(rpcProduct.price) || 0,
    cost_price: Number(rpcProduct.cost_price) || 0,
    stock: Number(rpcProduct.stock) || 0,
    min_stock: Number(rpcProduct.min_stock) || 0,
  };
}

export async function updateProduct(
  id: string,
  productData: Partial<Product>
): Promise<Product> {
  const current = await getProduct(id);
  if (!current) {
    throw new Error('El producto no existe.');
  }

  const payload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (productData.code !== undefined) payload.code = (productData.code || '').trim().toUpperCase();
  if (productData.barcode !== undefined) payload.barcode = productData.barcode ? productData.barcode.trim().toUpperCase() : null;
  if (productData.name !== undefined) payload.name = (productData.name || '').trim();
  if (productData.description !== undefined) payload.description = productData.description?.trim() || null;
  if (productData.price !== undefined) {
    if (productData.price < 0) throw new Error('El precio no puede ser negativo.');
    payload.price = Number(productData.price);
  }
  if (productData.cost_price !== undefined) {
    payload.cost_price = Number(productData.cost_price);
  }
  // CRÍTICO: updateProduct NO debe permitir modificar 'stock' directamente.
  // Cualquier cambio de stock debe ser atómico y auditado vía adjustStock / adjust_product_stock_atomic.
  if (productData.stock !== undefined) {
    console.warn('Modificación directa de stock rechazada en updateProduct. El stock debe gestionarse mediante adjustStock() para trazabilidad en inventario.');
  }
  if (productData.min_stock !== undefined) {
    payload.min_stock = Math.floor(Number(productData.min_stock));
  }
  if (productData.category_id !== undefined) {
    payload.category_id = productData.category_id || null;
  }
  if (productData.image_url !== undefined) {
    payload.image_url = sanitizeImageUrl(productData.image_url) || null;
  }
  if (productData.is_active !== undefined) {
    payload.is_active = productData.is_active;
  }
  if (productData.is_featured !== undefined) {
    payload.is_featured = productData.is_featured;
  }

  const { data, error } = await supabase
    .from('products')
    .update(payload)
    .eq('id', id)
    .select('*, category:categories(*)')
    .single();

  if (error) {
    throw new Error(`Error al actualizar producto: ${error.message}`);
  }

  return {
    ...data,
    price: Number(data.price) || 0,
    cost_price: Number(data.cost_price) || 0,
    stock: Number(data.stock) || 0,
    min_stock: Number(data.min_stock) || 0,
  };
}

export async function deleteProduct(id: string): Promise<{ deactivated: boolean }> {
  // Check if product is in order_items or invoice_items
  const { data: orderItems } = await supabase
    .from('order_items')
    .select('id')
    .eq('product_id', id)
    .limit(1);

  if (orderItems && orderItems.length > 0) {
    // Soft delete to protect history
    await supabase.from('products').update({ is_active: false }).eq('id', id);
    return { deactivated: true };
  }

  const { error } = await supabase.from('products').delete().eq('id', id);
  if (error) {
    // If foreign key constraint failed, soft deactivate
    await supabase.from('products').update({ is_active: false }).eq('id', id);
    return { deactivated: true };
  }
  return { deactivated: false };
}

export async function adjustStock(
  productId: string,
  quantityChange: number,
  type: InventoryMovementType,
  note?: string,
  user?: string
): Promise<Product> {
  // CRÍTICO: Operación de inventario 100% atómica y segura en PostgreSQL (FOR UPDATE)
  // Sin fallbacks directos del cliente para prevenir condiciones de carrera y desincronización en Kardex.
  const { data: rpcData, error: rpcError } = await supabase.rpc('adjust_product_stock_atomic', {
    p_product_id: productId,
    p_quantity_change: quantityChange,
    p_type: type,
    p_note: note || null,
    p_user: user || 'admin',
  });

  if (rpcError) {
    throw new Error(rpcError.message || 'Error al ajustar el inventario de forma atómica en la base de datos.');
  }

  if (!rpcData?.success) {
    throw new Error('La operación de ajuste de stock no pudo ser completada por la base de datos.');
  }

  const refreshed = await getProduct(productId);
  if (!refreshed) {
    throw new Error('Producto actualizado correctamente en base de datos, pero no se pudo recargar.');
  }

  return refreshed;
}

export async function getCategories(): Promise<Category[]> {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });

  if (error) {
    if (isTableMissingError(error)) {
      console.warn("Tabla 'public.categories' no encontrada en Supabase.");
      return [];
    }
    throw new Error(`Error al obtener categorías: ${error.message}`);
  }

  return data || [];
}

export async function createCategory(cat: {
  name: string;
  slug?: string;
  description?: string;
  sort_order?: number;
}): Promise<Category> {
  const slug = (cat.slug || cat.name)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

  const { data, error } = await supabase
    .from('categories')
    .insert({
      name: cat.name.trim(),
      slug,
      description: cat.description?.trim() || null,
      sort_order: cat.sort_order || 0,
      is_active: true,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Error al crear categoría: ${error.message}`);
  }

  return data;
}

export async function updateCategory(
  id: string,
  cat: Partial<Category>
): Promise<Category> {
  const payload: Record<string, unknown> = {};
  if (cat.name) payload.name = cat.name.trim();
  if (cat.slug) payload.slug = cat.slug.trim();
  if (cat.description !== undefined) payload.description = cat.description;
  if (cat.sort_order !== undefined) payload.sort_order = cat.sort_order;
  if (cat.is_active !== undefined) payload.is_active = cat.is_active;

  const { data, error } = await supabase
    .from('categories')
    .update(payload)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new Error(`Error al actualizar categoría: ${error.message}`);
  }

  return data;
}

export async function deleteCategory(id: string): Promise<void> {
  const { data: products } = await supabase
    .from('products')
    .select('id')
    .eq('category_id', id)
    .limit(1);

  if (products && products.length > 0) {
    throw new Error('No se puede eliminar la categoría porque tiene productos asignados. Reasigna o edita los productos primero.');
  }

  const { error } = await supabase.from('categories').delete().eq('id', id);
  if (error) {
    throw new Error(`Error al eliminar categoría: ${error.message}`);
  }
}

export async function getInventoryMovements(productId?: string): Promise<InventoryMovement[]> {
  let query = supabase
    .from('inventory_movements')
    .select('*, product:products(name, code)')
    .order('created_at', { ascending: false });

  if (productId) {
    query = query.eq('product_id', productId);
  }

  const { data, error } = await query;
  if (error) {
    if (isTableMissingError(error)) return [];
    throw new Error(`Error al obtener movimientos de inventario: ${error.message}`);
  }

  return (data || []).map((m: any) => ({
    ...m,
    product_name: m.product?.name ? `${m.product.name} (${m.product.code})` : 'Producto',
  }));
}

export const adjustProductStock = adjustStock;
