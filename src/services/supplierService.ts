import { supabase, isTableMissingError } from './supabase';
import { Supplier } from '../types';

const LOCAL_SUPPLIERS_KEY = 'bikie_suppliers_data';

export const DEFAULT_SUPPLIERS: Supplier[] = [
  {
    id: 'sup-1',
    name: 'Distribuidora Central de Papelería S.A.',
    contact_person: 'Laurent Essono',
    website_url: 'https://distripapel-central.example.com',
    phone: '+237 670 112 233',
    email: 'ventas@distripapel.cm',
    address: 'Zona Industrial Bassa, Douala',
    category: 'Papelería General',
    notes: 'Proveedor principal de cuadernos, resmas de papel bond 75g/80g y cartulinas. Despacho semanal.',
    is_active: true,
    created_at: new Date().toISOString(),
  },
  {
    id: 'sup-2',
    name: 'Importadora Gráfica & Consumibles Global',
    contact_person: 'Marie Claire Ngo',
    website_url: 'https://graficaglobal.example.com',
    phone: '+237 699 445 566',
    email: 'pedidos@graficaglobal.cm',
    address: 'Boulevard de la Liberté, Akwa',
    category: 'Consumibles de Impresión',
    notes: 'Tóners originales, tintas Epson/HP, cintas y laminadoras térmicas.',
    is_active: true,
    created_at: new Date().toISOString(),
  },
  {
    id: 'sup-3',
    name: 'Bebidas & Refrigerios del Litoral',
    contact_person: 'Alain Mbarga',
    website_url: 'https://bebidaslitoral.example.com',
    phone: '+237 655 889 900',
    email: 'contacto@bebidaslitoral.cm',
    address: 'Av. des Cocotiers, Bonanjo',
    category: 'Bebidas & Cafetería',
    notes: 'Agua mineral, jugos en lata, café y botanas para atención al cliente.',
    is_active: true,
    created_at: new Date().toISOString(),
  },
  {
    id: 'sup-4',
    name: 'Suministros Escolares & Bellas Artes Tech',
    contact_person: 'Fabiola Kouam',
    website_url: 'https://artestech-supplies.example.com',
    phone: '+237 680 778 899',
    email: 'info@artestech.cm',
    address: 'Rue Joss, Douala',
    category: 'Arte y Arquitectura',
    notes: 'Materiales técnicos: compases, estilógrafos, reglas T, pinturas acrílicas y lienzos.',
    is_active: true,
    created_at: new Date().toISOString(),
  },
];

function getLocalSuppliers(): Supplier[] {
  try {
    const raw = localStorage.getItem(LOCAL_SUPPLIERS_KEY);
    if (!raw) {
      localStorage.setItem(LOCAL_SUPPLIERS_KEY, JSON.stringify(DEFAULT_SUPPLIERS));
      return DEFAULT_SUPPLIERS;
    }
    return JSON.parse(raw);
  } catch {
    return DEFAULT_SUPPLIERS;
  }
}

function saveLocalSuppliers(suppliers: Supplier[]): void {
  try {
    localStorage.setItem(LOCAL_SUPPLIERS_KEY, JSON.stringify(suppliers));
  } catch (e) {
    console.error('Error saving local suppliers:', e);
  }
}

export async function getSuppliers(includeInactive = false): Promise<Supplier[]> {
  try {
    let query = supabase
      .from('suppliers')
      .select('*')
      .order('name', { ascending: true });

    if (!includeInactive) {
      query = query.eq('is_active', true);
    }

    const { data, error } = await query;

    if (error) {
      if (isTableMissingError(error)) {
        console.info("Tabla 'suppliers' aún no creada en Supabase. Usando almacenamiento local.");
        const local = getLocalSuppliers();
        return includeInactive ? local : local.filter((s) => s.is_active);
      }
      throw error;
    }

    if (!data || data.length === 0) {
      const local = getLocalSuppliers();
      return includeInactive ? local : local.filter((s) => s.is_active);
    }

    return (data || []).map((s: any) => ({
      id: s.id,
      name: s.name,
      contact_person: s.contact_person || null,
      website_url: s.website_url || null,
      phone: s.phone || null,
      email: s.email || null,
      address: s.address || null,
      category: s.category || 'General',
      notes: s.notes || null,
      is_active: s.is_active !== false,
      created_at: s.created_at,
      updated_at: s.updated_at,
    }));
  } catch (err) {
    console.warn('Fallback to local suppliers:', err);
    const local = getLocalSuppliers();
    return includeInactive ? local : local.filter((s) => s.is_active);
  }
}

export async function createSupplier(supplierData: {
  name: string;
  contact_person?: string | null;
  website_url?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  category?: string | null;
  notes?: string | null;
  is_active?: boolean;
}): Promise<Supplier> {
  const newSupplier: Supplier = {
    id: `sup-${Date.now()}`,
    name: supplierData.name.trim(),
    contact_person: supplierData.contact_person?.trim() || null,
    website_url: supplierData.website_url?.trim() || null,
    phone: supplierData.phone?.trim() || null,
    email: supplierData.email?.trim() || null,
    address: supplierData.address?.trim() || null,
    category: supplierData.category || 'Papelería General',
    notes: supplierData.notes?.trim() || null,
    is_active: supplierData.is_active !== false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  try {
    const { data, error } = await supabase
      .from('suppliers')
      .insert({
        name: newSupplier.name,
        contact_person: newSupplier.contact_person,
        website_url: newSupplier.website_url,
        phone: newSupplier.phone,
        email: newSupplier.email,
        address: newSupplier.address,
        category: newSupplier.category,
        notes: newSupplier.notes,
        is_active: newSupplier.is_active,
      })
      .select()
      .single();

    if (!error && data) {
      newSupplier.id = data.id;
    }
  } catch (e) {
    console.warn('Stored supplier locally:', e);
  }

  const local = getLocalSuppliers();
  const updated = [newSupplier, ...local];
  saveLocalSuppliers(updated);

  return newSupplier;
}

export async function updateSupplier(
  id: string,
  updates: Partial<Supplier>
): Promise<Supplier> {
  const local = getLocalSuppliers();
  const existing = local.find((s) => s.id === id);

  const updatedSupplier: Supplier = {
    ...(existing || ({} as Supplier)),
    ...updates,
    id,
    updated_at: new Date().toISOString(),
  };

  try {
    await supabase
      .from('suppliers')
      .update({
        name: updatedSupplier.name,
        contact_person: updatedSupplier.contact_person,
        website_url: updatedSupplier.website_url,
        phone: updatedSupplier.phone,
        email: updatedSupplier.email,
        address: updatedSupplier.address,
        category: updatedSupplier.category,
        notes: updatedSupplier.notes,
        is_active: updatedSupplier.is_active,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);
  } catch (e) {
    console.warn('Updated supplier locally:', e);
  }

  const updatedList = local.map((s) => (s.id === id ? updatedSupplier : s));
  saveLocalSuppliers(updatedList);

  return updatedSupplier;
}

export async function deleteSupplier(id: string): Promise<boolean> {
  try {
    await supabase.from('suppliers').delete().eq('id', id);
  } catch (e) {
    console.warn('Deleted supplier locally:', e);
  }

  const local = getLocalSuppliers();
  const filtered = local.filter((s) => s.id !== id);
  saveLocalSuppliers(filtered);

  return true;
}
