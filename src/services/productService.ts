import { supabase, isTableMissingError } from './supabase';
import { Product, Category, InventoryMovement, InventoryMovementType } from '../types';

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

export async function createProduct(productData: {
  code: string;
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

  const payload = {
    code: (productData.code || '').trim().toUpperCase(),
    name: (productData.name || '').trim(),
    description: productData.description?.trim() || null,
    price: Number(productData.price),
    cost_price: Number(productData.cost_price || 0),
    stock: Math.floor(Number(productData.stock)),
    min_stock: Math.floor(Number(productData.min_stock ?? 5)),
    category_id: productData.category_id || null,
    image_url: productData.image_url || null,
    is_active: productData.is_active ?? true,
    is_featured: productData.is_featured ?? false,
  };

  const { data, error } = await supabase
    .from('products')
    .insert(payload)
    .select('*, category:categories(*)')
    .single();

  if (error) {
    if (error.code === '23505') {
      throw new Error(`Ya existe un producto con el código "${payload.code}".`);
    }
    throw new Error(`Error al crear producto: ${error.message}`);
  }

  // If initial stock was provided, record an inventory movement
  if (payload.stock > 0 && data?.id) {
    try {
      await supabase.from('inventory_movements').insert({
        product_id: data.id,
        type: 'purchase',
        quantity: payload.stock,
        previous_stock: 0,
        new_stock: payload.stock,
        note: 'Stock inicial al crear producto',
      });
    } catch (err) {
      console.warn('Inventory movement note skipped:', err);
    }
  }

  return {
    ...data,
    price: Number(data.price) || 0,
    cost_price: Number(data.cost_price) || 0,
    stock: Number(data.stock) || 0,
    min_stock: Number(data.min_stock) || 0,
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
  if (productData.name !== undefined) payload.name = (productData.name || '').trim();
  if (productData.description !== undefined) payload.description = productData.description?.trim() || null;
  if (productData.price !== undefined) {
    if (productData.price < 0) throw new Error('El precio no puede ser negativo.');
    payload.price = Number(productData.price);
  }
  if (productData.cost_price !== undefined) {
    payload.cost_price = Number(productData.cost_price);
  }
  if (productData.stock !== undefined) {
    payload.stock = Math.floor(Number(productData.stock));
  }
  if (productData.min_stock !== undefined) {
    payload.min_stock = Math.floor(Number(productData.min_stock));
  }
  if (productData.category_id !== undefined) {
    payload.category_id = productData.category_id || null;
  }
  if (productData.image_url !== undefined) {
    payload.image_url = productData.image_url || null;
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
  // 1. Try atomic PostgreSQL RPC with row-level lock (FOR UPDATE)
  try {
    const { data: rpcData, error: rpcError } = await supabase.rpc('adjust_product_stock_atomic', {
      p_product_id: productId,
      p_quantity_change: quantityChange,
      p_type: type,
      p_note: note || null,
      p_user: user || 'admin',
    });

    if (rpcError) {
      if (rpcError.message && (rpcError.message.includes('Stock insuficiente') || rpcError.message.includes('denegada'))) {
        throw new Error(rpcError.message);
      }
      throw rpcError;
    }

    if (rpcData?.success) {
      const refreshed = await getProduct(productId);
      if (refreshed) return refreshed;
    }
  } catch (err: any) {
    if (err.message && (err.message.includes('Stock insuficiente') || err.message.includes('denegada'))) {
      throw err;
    }
    console.warn('RPC adjust_product_stock_atomic fallback:', err);
  }

  // 2. Direct fallback
  const current = await getProduct(productId);
  if (!current) throw new Error('Producto no encontrado');

  const newStock = current.stock + quantityChange;
  if (newStock < 0) {
    throw new Error(`Stock insuficiente. El stock actual es ${current.stock} y no puede quedar negativo.`);
  }

  const { data: updatedProduct, error: updateError } = await supabase
    .from('products')
    .update({
      stock: newStock,
      updated_at: new Date().toISOString(),
    })
    .eq('id', productId)
    .select('*, category:categories(*)')
    .single();

  if (updateError) {
    throw new Error(`Error al actualizar stock: ${updateError.message}`);
  }

  try {
    await supabase.from('inventory_movements').insert({
      product_id: productId,
      type,
      quantity: Math.abs(quantityChange),
      previous_stock: current.stock,
      new_stock: newStock,
      note: note || `Ajuste manual de stock (${type})`,
    });
  } catch (err) {
    console.warn('Could not record inventory movement:', err);
  }

  return {
    ...updatedProduct,
    price: Number(updatedProduct.price) || 0,
    cost_price: Number(updatedProduct.cost_price) || 0,
    stock: Number(updatedProduct.stock) || 0,
    min_stock: Number(updatedProduct.min_stock) || 0,
  };
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
