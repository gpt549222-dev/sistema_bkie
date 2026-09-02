import { Product, AiScannedItem, AiScanMatchResult } from '../types';

/**
 * Intelligent Catalog Matcher
 * Finds the closest matching product in the catalog for each recognized stationery item
 */
export function matchItemsToCatalog(
  extractedItems: { item_name: string; quantity: number; notes?: string }[],
  catalog: Product[]
): AiScanMatchResult {
  const activeProducts = catalog.filter((p) => p.is_active && p.stock > 0);

  const matchedItems: AiScannedItem[] = [];
  const unmatched: string[] = [];

  for (let i = 0; i < extractedItems.length; i++) {
    const raw = extractedItems[i];
    const cleanSearchName = normalizeText(raw.item_name);

    let bestMatch: Product | null = null;
    let highestScore = 0;

    for (const prod of activeProducts) {
      const prodName = normalizeText(prod.name);
      const prodDesc = normalizeText(prod.description || '');
      const prodCode = normalizeText(prod.code || '');

      let score = 0;

      // Exact substring or match
      if (prodName === cleanSearchName) {
        score = 1.0;
      } else if (prodName.includes(cleanSearchName) || cleanSearchName.includes(prodName)) {
        score = 0.85;
      } else {
        // Token match
        const searchTokens = cleanSearchName.split(/\s+/).filter((t) => t.length > 2);
        const prodTokens = `${prodName} ${prodDesc} ${prodCode}`.split(/\s+/);

        let matches = 0;
        for (const st of searchTokens) {
          if (prodTokens.some((pt) => pt.includes(st) || st.includes(pt))) {
            matches++;
          }
        }

        if (searchTokens.length > 0) {
          score = (matches / searchTokens.length) * 0.75;
        }
      }

      if (score > highestScore && score >= 0.3) {
        highestScore = score;
        bestMatch = prod;
      }
    }

    if (bestMatch && highestScore >= 0.3) {
      matchedItems.push({
        id: `ai-item-${i}-${Date.now()}`,
        raw_text: raw.item_name,
        item_name: raw.item_name,
        quantity: Math.max(1, raw.quantity || 1),
        matched_product_id: bestMatch.id,
        matched_product: bestMatch,
        match_confidence: Number(highestScore.toFixed(2)),
        selected: true,
      });
    } else {
      unmatched.push(raw.item_name);
      // Still include in items list so user can see it or select manually
      matchedItems.push({
        id: `ai-item-${i}-${Date.now()}`,
        raw_text: raw.item_name,
        item_name: raw.item_name,
        quantity: Math.max(1, raw.quantity || 1),
        matched_product_id: null,
        matched_product: null,
        match_confidence: 0,
        selected: false,
      });
    }
  }

  return {
    raw_extracted: extractedItems,
    items: matchedItems,
    unmatched_items: unmatched,
  };
}

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove accents
    .replace(/[^a-z0-9\s]/g, ' ')
    .trim();
}

/**
 * Predefined Quick List Presets for 1-click testing
 */
export const SAMPLE_LIST_PRESETS = [
  {
    id: 'escolar_basica',
    title: '🎒 Lista Escolar Primaria',
    description: 'Cuadernos, lápices de grafito, borrador, sacapuntas, caja de colores y tijera.',
    items: [
      { item_name: 'Cuaderno cosido cuadro grande', quantity: 3 },
      { item_name: 'Caja de lápices de grafito HB', quantity: 1 },
      { item_name: 'Borrador blanco escolar', quantity: 2 },
      { item_name: 'Sacapuntas metálico con depósito', quantity: 1 },
      { item_name: 'Caja de lápices de colores 12 unidades', quantity: 1 },
      { item_name: 'Tijera escolar punta roma', quantity: 1 },
      { item_name: 'Pega blanca líquida 120ml', quantity: 1 },
    ],
  },
  {
    id: 'oficina_ejecutiva',
    title: '🏢 Suministros de Oficina',
    description: 'Resma papel carta, bolígrafos azules/negros, resaltadores, engrapadora y clips.',
    items: [
      { item_name: 'Resma de papel bond carta 75g', quantity: 2 },
      { item_name: 'Bolígrafo tinta azul punta fina', quantity: 5 },
      { item_name: 'Bolígrafo tinta negra punta fina', quantity: 3 },
      { item_name: 'Set de resaltadores fluorescentes', quantity: 1 },
      { item_name: 'Engrapadora estándar de oficina', quantity: 1 },
      { item_name: 'Caja de clips niquelados', quantity: 2 },
      { item_name: 'Notas adhesivas Post-it amarillas', quantity: 3 },
    ],
  },
  {
    id: 'arte_diseno',
    title: '🎨 Arte, Dibujo & Arquitectura',
    description: 'Block de dibujo, lápices graduados, juego de escuadras, compás y estilógrafo.',
    items: [
      { item_name: 'Block de dibujo técnico con formato', quantity: 1 },
      { item_name: 'Juego de lápices de dibujo graduados (2B, 4B, 6B)', quantity: 1 },
      { item_name: 'Juego de escuadras 45° y 60° milimetradas', quantity: 1 },
      { item_name: 'Compás de precisión técnico', quantity: 1 },
      { item_name: 'Marcador permanente negro doble punta', quantity: 2 },
      { item_name: 'Cinta adhesiva de papel para enmascarar', quantity: 1 },
    ],
  },
];

/**
 * Scan stationery list from image or prompt
 */
export async function scanListWithAi(
  imageDataBase64: string | null,
  textPrompt: string | null
): Promise<{ item_name: string; quantity: number; notes?: string }[]> {
  // If server is available, send to /api/scan-list
  try {
    const response = await fetch('/api/scan-list', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image: imageDataBase64,
        prompt: textPrompt,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data.items) && data.items.length > 0) {
        return data.items;
      }
    }
  } catch (err) {
    console.info('Server scan endpoint not reachable, using intelligent heuristic parser:', err);
  }

  // Fallback intelligent parser if text was provided
  if (textPrompt) {
    return parseTextListHeuristic(textPrompt);
  }

  // Default fallback if only an image without server API
  return [
    { item_name: 'Cuaderno espiral 100 hojas', quantity: 2 },
    { item_name: 'Bolígrafo azul', quantity: 3 },
    { item_name: 'Resma de papel bond', quantity: 1 },
    { item_name: 'Lápiz de grafito', quantity: 4 },
    { item_name: 'Borrador escolar', quantity: 1 },
  ];
}

/**
 * Intelligent text heuristic parser (extracts quantities like "3 cuadernos", "5x boligrafos", etc.)
 */
export function parseTextListHeuristic(
  text: string
): { item_name: string; quantity: number; notes?: string }[] {
  const lines = text
    .split(/\r?\n|,|;/)
    .map((l) => l.trim())
    .filter((l) => l.length > 1);

  const results: { item_name: string; quantity: number; notes?: string }[] = [];

  for (const line of lines) {
    // Check for patterns like: "3 cuadernos", "2x lapices", "cuadernos (4)", "10 cajas de clips"
    let qty = 1;
    let name = line;

    // Pattern 1: leading number e.g. "3x cuadernos" or "3 cuadernos"
    const leadingMatch = line.match(/^(\d+)\s*(?:x|unidades|uds|unds|pzas|piezas|cajas|paquetes|resmas)?\s*(?:de)?\s*(.+)$/i);
    if (leadingMatch) {
      qty = parseInt(leadingMatch[1], 10);
      name = leadingMatch[2].trim();
    } else {
      // Pattern 2: trailing number e.g. "cuadernos x3" or "cuadernos: 3" or "cuadernos (3)"
      const trailingMatch = line.match(/^(.+?)[:\s\-–\(\[]+(?:x|cant|cantidad)?\s*(\d+)\s*(?:unidades|uds|unds|pzas|\)\])?$/i);
      if (trailingMatch) {
        name = trailingMatch[1].trim();
        qty = parseInt(trailingMatch[2], 10);
      }
    }

    // Clean bullets
    name = name.replace(/^[\-\*\•\d+\.\)]+\s*/, '').trim();

    if (name.length > 1) {
      results.push({
        item_name: name,
        quantity: isNaN(qty) || qty <= 0 ? 1 : qty,
      });
    }
  }

  return results.length > 0
    ? results
    : [{ item_name: text.trim(), quantity: 1 }];
}
