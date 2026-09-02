import { supabase } from './supabase';
import { BusinessSettings } from '../types';

export const DEFAULT_SETTINGS: BusinessSettings = {
  business_name: 'BIKIE Sistemas Informáticos',
  rif_tax_id: '0214081-21',
  phone: '333098318 - 222544924 - 222213126',
  whatsapp: '+240 222544924',
  address: 'BARRIO EL PARAISO (cerca la guardería "Los Chupetes") - Malabo / Bata, GE',
  currency: 'XAF',
  currency_symbol: 'FCFA',
  tax_rate: 15,
  pago_movil_info: 'Orange Money / MTN MoMo • Tel: 222544924 / 333098318',
  binance_info: 'bikie_sistemas@pay.binance (Pay ID: 394819201)',
  bank_transfer_info: 'BANGE • Cta: 37101193101-51 • Sistemas Informáticos Bikie',
  invoice_prefix: 'BIKIE',
  sound_notifications_enabled: true,
};

export async function getBusinessSettings(): Promise<BusinessSettings> {
  const { data, error } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'business_info')
    .maybeSingle();

  if (error || !data) {
    return DEFAULT_SETTINGS;
  }
  return { ...DEFAULT_SETTINGS, ...data.value };
}

export async function updateBusinessSettings(settings: Partial<BusinessSettings>): Promise<void> {
  const current = await getBusinessSettings();
  const updated = { ...current, ...settings };

  const { error } = await supabase
    .from('settings')
    .upsert({
      key: 'business_info',
      value: updated,
      description: 'Configuración oficial de BIKIE Papelería',
      updated_at: new Date().toISOString(),
    });

  if (error) {
    throw new Error(`Error al guardar configuración en Supabase: ${error.message}`);
  }
}

/**
 * Seeds initial stationery data if Supabase tables are currently empty.
 */
export async function seedInitialDatabaseIfEmpty(): Promise<{
  seeded: boolean;
  message: string;
}> {
  const { data: existingProducts } = await supabase.from('products').select('id').limit(1);
  if (existingProducts && existingProducts.length > 0) {
    return {
      seeded: false,
      message: 'La base de datos ya contiene productos. No se requiere inicialización.',
    };
  }

  // 1. Initial Categories
  const categoriesToInsert = [
    { name: 'Cuadernos y Libretas', slug: 'cuadernos-libretas', description: 'Cuadernos grapados, anillados, libretas de notas y agendas ejecutivas', sort_order: 1 },
    { name: 'Escritura y Bolígrafos', slug: 'escritura-boligrafos', description: 'Bolígrafos, lápices de grafito, marcadores y resaltadores de precisión', sort_order: 2 },
    { name: 'Arte y Dibujo', slug: 'arte-dibujo', description: 'Lápices de colores, acuarelas, pinceles, blocks de dibujo y cartulinas', sort_order: 3 },
    { name: 'Oficina y Archivo', slug: 'oficina-archivo', description: 'Carpetas, grapadoras, perforadoras, clips y organizadores de archivo', sort_order: 4 },
    { name: 'Escolar y Manualidades', slug: 'escolar-manualidades', description: 'Pegamentos, tijeras escolares, plastilinas, silicón y foami', sort_order: 5 },
  ];

  const { data: createdCats, error: catError } = await supabase
    .from('categories')
    .insert(categoriesToInsert)
    .select();

  if (catError) {
    throw new Error(`Error al crear categorías iniciales: ${catError.message}`);
  }

  const catMap: Record<string, string> = {};
  createdCats?.forEach((c) => {
    catMap[c.slug] = c.id;
  });

  // 2. Initial Products in FCFA
  const productsToInsert = [
    {
      code: 'CUA-UNI-100',
      name: 'Cuaderno Universitario Cuadriculado 100 Hojas',
      description: 'Cuaderno espiral tapa dura con papel resistente de 75g. Ideal para secundaria y universidad.',
      price: 1800.0,
      cost_price: 1000.0,
      stock: 45,
      min_stock: 10,
      category_id: catMap['cuadernos-libretas'],
      image_url: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=600&auto=format&fit=crop&q=80',
      is_active: true,
      is_featured: true,
    },
    {
      code: 'CUA-LIN-100',
      name: 'Cuaderno Universitario Línea Simple 100 Hojas',
      description: 'Cuaderno con margen reglamentario y espiral metálico doble reforzado.',
      price: 1800.0,
      cost_price: 1000.0,
      stock: 38,
      min_stock: 10,
      category_id: catMap['cuadernos-libretas'],
      image_url: 'https://images.unsplash.com/photo-1589829085413-56de8ae18c73?w=600&auto=format&fit=crop&q=80',
      is_active: true,
      is_featured: false,
    },
    {
      code: 'BOL-BIC-AZU',
      name: 'Pack Bolígrafos BIC Cristal Azul (Caja x10)',
      description: 'Punta media 1.0 mm con tinta de secado ultra rápido. Máxima durabilidad.',
      price: 2500.0,
      cost_price: 1500.0,
      stock: 30,
      min_stock: 8,
      category_id: catMap['escritura-boligrafos'],
      image_url: 'https://images.unsplash.com/photo-1585336261026-77cc7c20c025?w=600&auto=format&fit=crop&q=80',
      is_active: true,
      is_featured: true,
    },
    {
      code: 'RES-STA-SET',
      name: 'Set Resaltadores Neón Pastel x6 Colores',
      description: 'Resaltadores punta biselada para 3 grosores de trazo. Colores vibrantes anti-manchas.',
      price: 3500.0,
      cost_price: 2000.0,
      stock: 22,
      min_stock: 5,
      category_id: catMap['escritura-boligrafos'],
      image_url: 'https://images.unsplash.com/photo-1595781572981-d63169b77765?w=600&auto=format&fit=crop&q=80',
      is_active: true,
      is_featured: true,
    },
    {
      code: 'COL-PRI-24C',
      name: 'Caja de Lápices de Colores Prisma x24 Tonos',
      description: 'Mina ultra suave de 4mm con pigmentación intensa. Ideal para arte y tareas escolares.',
      price: 5500.0,
      cost_price: 3200.0,
      stock: 18,
      min_stock: 5,
      category_id: catMap['arte-dibujo'],
      image_url: 'https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=600&auto=format&fit=crop&q=80',
      is_active: true,
      is_featured: true,
    },
    {
      code: 'CAR-ARCH-OFI',
      name: 'Carpeta de Archivo Fuelle Tamaño Oficio con Elásticos',
      description: 'Fabricada en polipropileno rígido de alta densidad con 12 divisiones indexadas.',
      price: 2800.0,
      cost_price: 1600.0,
      stock: 25,
      min_stock: 6,
      category_id: catMap['oficina-archivo'],
      image_url: 'https://images.unsplash.com/photo-1586075010923-2dd4570fb338?w=600&auto=format&fit=crop&q=80',
      is_active: true,
      is_featured: false,
    },
    {
      code: 'GRA-IND-PRO',
      name: 'Grapadora Metálica de Escritorio + Caja de Grapas 26/6',
      description: 'Capacidad de engrapado de hasta 30 hojas. Cuerpo 100% metálico anti-atasco.',
      price: 4200.0,
      cost_price: 2500.0,
      stock: 15,
      min_stock: 4,
      category_id: catMap['oficina-archivo'],
      image_url: 'https://images.unsplash.com/photo-1590725140246-20acbe442a8b?w=600&auto=format&fit=crop&q=80',
      is_active: true,
      is_featured: false,
    },
    {
      code: 'PEG-BAR-040',
      name: 'Pega en Barra Lavable 40g (Pack x2)',
      description: 'Fórmula no tóxica de secado transparente sin arrugar el papel. Ideal para niños.',
      price: 1500.0,
      cost_price: 800.0,
      stock: 50,
      min_stock: 12,
      category_id: catMap['escolar-manualidades'],
      image_url: 'https://images.unsplash.com/photo-1568832359672-e36cf5d74f54?w=600&auto=format&fit=crop&q=80',
      is_active: true,
      is_featured: false,
    },
    {
      code: 'TIJ-ESC-PUN',
      name: 'Tijera Escolar Punta Roma Acero Inoxidable',
      description: 'Mango ergonómico con hojas graduadas en centímetros para cortes precisos y seguros.',
      price: 1200.0,
      cost_price: 600.0,
      stock: 40,
      min_stock: 8,
      category_id: catMap['escolar-manualidades'],
      image_url: 'https://images.unsplash.com/photo-1503792501406-2c40da09e1e2?w=600&auto=format&fit=crop&q=80',
      is_active: true,
      is_featured: false,
    },
    {
      code: 'BLO-DIB-GRA',
      name: 'Block de Dibujo Bristol A4 20 Hojas 180g',
      description: 'Papel liso extra blanco para rotuladores, tinta china y lápiz grafito.',
      price: 2600.0,
      cost_price: 1400.0,
      stock: 28,
      min_stock: 6,
      category_id: catMap['arte-dibujo'],
      image_url: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?w=600&auto=format&fit=crop&q=80',
      is_active: true,
      is_featured: false,
    },
  ];

  const { data: createdProducts, error: prodError } = await supabase
    .from('products')
    .insert(productsToInsert)
    .select();

  if (prodError) {
    throw new Error(`Error al crear productos iniciales: ${prodError.message}`);
  }

  // 3. Initial Offer
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 1);
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + 30);

  const { data: createdOffer } = await supabase
    .from('offers')
    .insert({
      name: 'Temporada Escolar BIKIE - 15% OFF',
      description: '15% de descuento especial en todos los cuadernos y packs de escritura para el regreso a clases.',
      type: 'percentage',
      value: 15,
      priority: 10,
      start_date: startDate.toISOString(),
      end_date: endDate.toISOString(),
      status: 'active',
      is_global: false,
    })
    .select()
    .single();

  if (createdOffer && catMap['cuadernos-libretas'] && catMap['escritura-boligrafos']) {
    await supabase.from('offer_categories').insert([
      { offer_id: createdOffer.id, category_id: catMap['cuadernos-libretas'] },
      { offer_id: createdOffer.id, category_id: catMap['escritura-boligrafos'] },
    ]);
  }

  // 4. Initial Settings
  await updateBusinessSettings(DEFAULT_SETTINGS);

  return {
    seeded: true,
    message: `Base de datos inicializada con éxito: ${createdCats?.length || 0} categorías, ${createdProducts?.length || 0} productos y 1 oferta activa.`,
  };
}
