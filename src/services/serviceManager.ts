import { supabase, isTableMissingError } from './supabase';
import { AdditionalService } from '../types';

const LOCAL_SERVICES_KEY = 'bikie_additional_services';

export const DEFAULT_SERVICES: AdditionalService[] = [
  {
    id: 'srv-1',
    code: 'SRV-COP-BN',
    name: 'Fotocopia Blanco y Negro (A4)',
    category: 'copias',
    price: 25,
    unit_label: 'por página',
    description: 'Copia nítida estándar en papel bond 75g',
    is_active: true,
    created_at: new Date().toISOString(),
  },
  {
    id: 'srv-2',
    code: 'SRV-COP-COL',
    name: 'Fotocopia a Color HD (A4)',
    category: 'copias',
    price: 100,
    unit_label: 'por página',
    description: 'Copia full color en alta resolución',
    is_active: true,
    created_at: new Date().toISOString(),
  },
  {
    id: 'srv-3',
    code: 'SRV-IMP-DOC',
    name: 'Impresión de Documentos / Tesis (A4)',
    category: 'impresiones',
    price: 50,
    unit_label: 'por página',
    description: 'Impresión láser de texto y gráficos',
    is_active: true,
    created_at: new Date().toISOString(),
  },
  {
    id: 'srv-4',
    code: 'SRV-PLA-CAR',
    name: 'Plastificado de Carnet / CNI / NIF',
    category: 'plastificado',
    price: 250,
    unit_label: 'por unidad',
    description: 'Protección térmica sellada mate o brillante',
    is_active: true,
    created_at: new Date().toISOString(),
  },
  {
    id: 'srv-5',
    code: 'SRV-PLA-A4',
    name: 'Plastificado Formato A4',
    category: 'plastificado',
    price: 500,
    unit_label: 'por unidad',
    description: 'Laminado térmico protector de alta durabilidad',
    is_active: true,
    created_at: new Date().toISOString(),
  },
  {
    id: 'srv-6',
    code: 'SRV-RED-CV',
    name: 'Redacción & Diseño de Curriculum Vitae (CV)',
    category: 'redaccion',
    price: 3000,
    unit_label: 'por documento',
    description: 'Redacción profesional y formato internacional ATS',
    is_active: true,
    created_at: new Date().toISOString(),
  },
  {
    id: 'srv-7',
    code: 'SRV-RED-CON',
    name: 'Redacción de Contratos & Cartas Comerciales',
    category: 'redaccion',
    price: 5000,
    unit_label: 'por documento',
    description: 'Redacción formal personalizada con términos legales',
    is_active: true,
    created_at: new Date().toISOString(),
  },
  {
    id: 'srv-8',
    code: 'SRV-ENC-ANI',
    name: 'Encuadernación con Anillado Espiral & Portada',
    category: 'encuadernacion',
    price: 1000,
    unit_label: 'por fascículo',
    description: 'Incluye tapas plásticas protectoras y espiral resistente',
    is_active: true,
    created_at: new Date().toISOString(),
  },
  {
    id: 'srv-9',
    code: 'SRV-DIG-PDF',
    name: 'Escaneo & Digitalización OCR a PDF',
    category: 'digitalizacion',
    price: 50,
    unit_label: 'por página',
    description: 'Digitalización en alta resolución enviada al correo/WhatsApp',
    is_active: true,
    created_at: new Date().toISOString(),
  },
  {
    id: 'srv-10',
    code: 'SRV-BEB-AGU',
    name: 'Agua Mineral Purificada 500ml',
    category: 'bebidas',
    price: 300,
    unit_label: 'por botella',
    description: 'Bebida fría refrescante',
    is_active: true,
    created_at: new Date().toISOString(),
  },
  {
    id: 'srv-11',
    code: 'SRV-BEB-JUG',
    name: 'Jugo Natural / Gaseosa Helada 330ml',
    category: 'bebidas',
    price: 500,
    unit_label: 'por lata/botella',
    description: 'Variedad de sabores bien fría',
    is_active: true,
    created_at: new Date().toISOString(),
  },
  {
    id: 'srv-12',
    code: 'SRV-BEB-CAF',
    name: 'Café Expreso / Capuchino Caliente',
    category: 'bebidas',
    price: 400,
    unit_label: 'por taza',
    description: 'Café recién colado con azúcar al gusto',
    is_active: true,
    created_at: new Date().toISOString(),
  },
];

function getLocalServices(): AdditionalService[] {
  try {
    const raw = localStorage.getItem(LOCAL_SERVICES_KEY);
    if (!raw) {
      localStorage.setItem(LOCAL_SERVICES_KEY, JSON.stringify(DEFAULT_SERVICES));
      return DEFAULT_SERVICES;
    }
    return JSON.parse(raw);
  } catch {
    return DEFAULT_SERVICES;
  }
}

function saveLocalServices(services: AdditionalService[]): void {
  try {
    localStorage.setItem(LOCAL_SERVICES_KEY, JSON.stringify(services));
  } catch (e) {
    console.error('Error saving local services:', e);
  }
}

export async function getAdditionalServices(includeInactive = false): Promise<AdditionalService[]> {
  try {
    let query = supabase
      .from('services')
      .select('*')
      .order('name', { ascending: true });

    if (!includeInactive) {
      query = query.eq('is_active', true);
    }

    const { data, error } = await query;

    if (error) {
      if (isTableMissingError(error)) {
        console.info("Tabla 'services' aún no creada en Supabase. Usando almacenamiento local.");
        const local = getLocalServices();
        return includeInactive ? local : local.filter((s) => s.is_active);
      }
      throw error;
    }

    if (!data || data.length === 0) {
      const local = getLocalServices();
      return includeInactive ? local : local.filter((s) => s.is_active);
    }

    return (data || []).map((s: any) => ({
      id: s.id,
      code: s.code || `SRV-${s.id.slice(0, 5)}`,
      name: s.name,
      category: s.category || 'otros',
      price: Number(s.price) || 0,
      unit_label: s.unit_label || 'por unidad',
      description: s.description || null,
      is_active: s.is_active !== false,
      created_at: s.created_at,
      updated_at: s.updated_at,
    }));
  } catch (err) {
    console.warn('Fallback to local services due to error:', err);
    const local = getLocalServices();
    return includeInactive ? local : local.filter((s) => s.is_active);
  }
}

export async function createAdditionalService(serviceData: {
  code?: string;
  name: string;
  category: string;
  price: number;
  unit_label?: string;
  description?: string | null;
  is_active?: boolean;
}): Promise<AdditionalService> {
  const generatedCode =
    serviceData.code ||
    `SRV-${(serviceData.category || 'SRV').slice(0, 3).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`;

  const newService: AdditionalService = {
    id: `srv-${Date.now()}`,
    code: generatedCode,
    name: serviceData.name.trim(),
    category: serviceData.category || 'otros',
    price: Number(serviceData.price) || 0,
    unit_label: serviceData.unit_label || 'por servicio',
    description: serviceData.description ? serviceData.description.trim() : null,
    is_active: serviceData.is_active !== false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  try {
    const { data, error } = await supabase
      .from('services')
      .insert({
        code: newService.code,
        name: newService.name,
        category: newService.category,
        price: newService.price,
        unit_label: newService.unit_label,
        description: newService.description,
        is_active: newService.is_active,
      })
      .select()
      .single();

    if (!error && data) {
      newService.id = data.id;
    }
  } catch (e) {
    console.warn('Stored service locally:', e);
  }

  // Also update local storage cache
  const local = getLocalServices();
  const updated = [newService, ...local];
  saveLocalServices(updated);

  return newService;
}

export async function updateAdditionalService(
  id: string,
  updates: Partial<AdditionalService>
): Promise<AdditionalService> {
  const local = getLocalServices();
  const existing = local.find((s) => s.id === id);

  const updatedService: AdditionalService = {
    ...(existing || ({} as AdditionalService)),
    ...updates,
    id,
    updated_at: new Date().toISOString(),
  };

  try {
    await supabase
      .from('services')
      .update({
        code: updatedService.code,
        name: updatedService.name,
        category: updatedService.category,
        price: updatedService.price,
        unit_label: updatedService.unit_label,
        description: updatedService.description,
        is_active: updatedService.is_active,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);
  } catch (e) {
    console.warn('Updated service locally:', e);
  }

  const updatedList = local.map((s) => (s.id === id ? updatedService : s));
  saveLocalServices(updatedList);

  return updatedService;
}

export async function deleteAdditionalService(id: string): Promise<boolean> {
  try {
    await supabase.from('services').delete().eq('id', id);
  } catch (e) {
    console.warn('Deleted service locally:', e);
  }

  const local = getLocalServices();
  const filtered = local.filter((s) => s.id !== id);
  saveLocalServices(filtered);

  return true;
}
