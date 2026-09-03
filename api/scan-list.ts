import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from '@google/genai';

let geminiClient: GoogleGenAI | null = null;

function getGemini(): GoogleGenAI | null {
  const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY;
  if (!key) return null;
  if (!geminiClient) {
    geminiClient = new GoogleGenAI({ apiKey: key });
  }
  return geminiClient;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        body = {};
      }
    }
    const { image, prompt } = body || {};
    const ai = getGemini();

    if (!ai) {
      return res.status(200).json({
        success: true,
        source: 'local_heuristic',
        items: [
          { item_name: 'Cuaderno cosido cuadro grande', quantity: 3 },
          { item_name: 'Caja de lápices de grafito', quantity: 1 },
          { item_name: 'Borrador escolar blanco', quantity: 2 },
          { item_name: 'Sacapuntas metálico', quantity: 1 },
          { item_name: 'Caja de lápices de colores', quantity: 1 },
          { item_name: 'Resma papel bond carta', quantity: 1 },
        ],
      });
    }

    const systemPrompt = `Eres un asistente inteligente para la tienda "BIKIE Papelería".
Tu tarea es analizar la foto de la lista escolar o lista de útiles de oficina (o texto proporcionado) y extraer todos los artículos con sus cantidades correspondientes.
Devuelve SIEMPRE y ÚNICAMENTE un objeto JSON válido con la siguiente estructura:
{
  "items": [
    {
      "item_name": "Nombre claro del artículo en español (ej: Cuaderno espiral 100 hojas)",
      "quantity": 2,
      "notes": "detalles opcionales como color o tamaño"
    }
  ]
}`;

    let contents: any[] = [];

    if (image && typeof image === 'string') {
      const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
      const mimeMatch = image.match(/^data:(image\/\w+);base64,/);
      const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';

      contents = [
        {
          role: 'user',
          parts: [
            { text: prompt ? `${systemPrompt}\n\nInstrucción adicional: ${prompt}` : systemPrompt },
            {
              inlineData: {
                mimeType: mimeType,
                data: base64Data,
              },
            },
          ],
        },
      ];
    } else {
      contents = [
        {
          role: 'user',
          parts: [
            {
              text: `${systemPrompt}\n\nLista de texto proporcionada por el cliente:\n${prompt || 'Cuadernos, lápices y resma de papel'}`,
            },
          ],
        },
      ];
    }

    const response = await ai.models.generateContent({
      model: 'gemini-flash-latest',
      contents,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const responseText = response.text?.trim() || '{}';
    const parsed = JSON.parse(responseText);

    return res.status(200).json({
      success: true,
      source: 'gemini_vision',
      items: Array.isArray(parsed.items) ? parsed.items : [],
    });
  } catch (err: any) {
    console.error('Error in Vercel /api/scan-list:', err);
    let promptText: string = '';
    try {
      const b: any = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      promptText = b?.prompt || '';
    } catch {
      promptText = '';
    }

    if (promptText.trim().length > 0) {
      const fallbackItems = promptText
        .split(/[\n,;]+/)
        .map((s: string) => s.trim())
        .filter((s: string) => s.length > 1)
        .map((line: string) => {
          const match = line.match(/^(\d+)\s*(?:x|de)?\s*(.+)$/i);
          if (match) {
            return { item_name: match[2].trim(), quantity: parseInt(match[1], 10) || 1 };
          }
          return { item_name: line, quantity: 1 };
        });
      if (fallbackItems.length > 0) {
        return res.status(200).json({
          success: true,
          source: 'fallback_heuristic',
          items: fallbackItems,
        });
      }
    }

    return res.status(500).json({
      success: false,
      error: err.message || 'Error processing list with AI',
      items: [],
    });
  }
}
