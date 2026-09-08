import { GoogleGenAI } from '@google/genai';

let geminiClient: GoogleGenAI | null = null;

/**
 * Lazy initialization of GoogleGenAI client using exclusively GEMINI_API_KEY
 */
export function getGemini(): GoogleGenAI | null {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  if (!geminiClient) {
    geminiClient = new GoogleGenAI({ apiKey: key });
  }
  return geminiClient;
}

// In-memory sliding-window rate limiter per client IP
interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minuto
const MAX_REQUESTS_PER_WINDOW = 15; // Máximo 15 análisis por minuto por IP

export function checkRateLimit(clientIp: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const entry = rateLimitStore.get(clientIp);

  // Limpieza periódica de entradas expiradas
  if (rateLimitStore.size > 1000) {
    for (const [key, val] of rateLimitStore.entries()) {
      if (val.resetTime < now) {
        rateLimitStore.delete(key);
      }
    }
  }

  if (!entry || entry.resetTime < now) {
    rateLimitStore.set(clientIp, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true };
  }

  if (entry.count >= MAX_REQUESTS_PER_WINDOW) {
    const retryAfter = Math.ceil((entry.resetTime - now) / 1000);
    return { allowed: false, retryAfter };
  }

  entry.count++;
  return { allowed: true };
}

// Validación estricta de imágenes
const MAX_BASE64_LENGTH = 7 * 1024 * 1024; // ~5MB de archivo binario
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

export interface ValidationResult {
  valid: boolean;
  error?: string;
  mimeType?: string;
  base64Data?: string;
}

export function validateImageInput(imageStr?: unknown): ValidationResult {
  if (!imageStr) {
    return { valid: true };
  }

  if (typeof imageStr !== 'string') {
    return { valid: false, error: 'Formato de imagen inválido. Se requiere cadena base64.' };
  }

  if (imageStr.length > MAX_BASE64_LENGTH) {
    return { valid: false, error: 'La imagen supera el tamaño máximo permitido (5MB). Comprime o recorta la foto.' };
  }

  const mimeMatch = imageStr.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,/);
  if (!mimeMatch) {
    return { valid: false, error: 'Formato de datos de imagen inválido. Debe ser una URI data:image/...;base64.' };
  }

  const mimeType = mimeMatch[1].toLowerCase();
  if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
    return { valid: false, error: `Formato de imagen no permitido (${mimeType}). Formatos aceptados: JPG, PNG, WEBP.` };
  }

  const base64Data = imageStr.replace(/^data:[a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+;base64,/, '').trim();
  if (base64Data.length === 0) {
    return { valid: false, error: 'La imagen proporcionada está vacía.' };
  }

  return { valid: true, mimeType, base64Data };
}

/**
 * Configuración segura de encabezados CORS para producción
 */
export function setSecureCorsHeaders(
  reqHeaders: Record<string, unknown>,
  setHeader: (k: string, v: string) => void
): void {
  const origin = (reqHeaders['origin'] || reqHeaders['Origin']) as string | undefined;
  const host = (reqHeaders['host'] || reqHeaders['Host']) as string | undefined;

  let allowedOrigin = '';
  if (origin && typeof origin === 'string') {
    const isLocalhost = origin.includes('localhost') || origin.includes('127.0.0.1');
    const isVercel = origin.endsWith('.vercel.app');
    const isGoogleRun = origin.includes('.run.app');
    const isMatchingHost = host && origin.includes(host);

    if (isLocalhost || isVercel || isGoogleRun || isMatchingHost) {
      allowedOrigin = origin;
    }
  }

  if (allowedOrigin) {
    setHeader('Access-Control-Allow-Origin', allowedOrigin);
    setHeader('Access-Control-Allow-Credentials', 'true');
  }
  setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

/**
 * Lógica reutilizable y segura de análisis de listas con Gemini
 */
export async function processScanListRequest(
  body: any,
  clientIp: string
): Promise<{ status: number; body: Record<string, unknown> }> {
  // 1. Rate limiting
  const rl = checkRateLimit(clientIp);
  if (!rl.allowed) {
    return {
      status: 429,
      body: {
        success: false,
        error: `Has superado el límite de solicitudes de escaneo. Espera ${rl.retryAfter || 60} segundos antes de intentar de nuevo.`,
        items: [],
      },
    };
  }

  const { image, prompt } = body || {};

  // 2. Validación de longitud de prompt
  if (prompt && typeof prompt === 'string' && prompt.length > 2000) {
    return {
      status: 400,
      body: {
        success: false,
        error: 'El texto de la lista excede el límite máximo permitido de 2,000 caracteres.',
        items: [],
      },
    };
  }

  // 3. Validación de imagen
  const imgValidation = validateImageInput(image);
  if (!imgValidation.valid) {
    return {
      status: 400,
      body: {
        success: false,
        error: imgValidation.error,
        items: [],
      },
    };
  }

  if (!imgValidation.base64Data && (!prompt || typeof prompt !== 'string' || !prompt.trim())) {
    return {
      status: 400,
      body: {
        success: false,
        error: 'Debe proporcionar una imagen o un texto con la lista de útiles a cotizar.',
        items: [],
      },
    };
  }

  // 4. Obtención de cliente Gemini
  const ai = getGemini();
  if (!ai) {
    return {
      status: 503,
      body: {
        success: false,
        error: 'El servicio de IA no está disponible en este momento. Ingrese los artículos manualmente.',
        items: [],
      },
    };
  }

  // 5. Consulta segura a Gemini
  try {
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
    if (imgValidation.base64Data && imgValidation.mimeType) {
      contents = [
        {
          role: 'user',
          parts: [
            { text: prompt ? `${systemPrompt}\n\nInstrucción adicional: ${prompt}` : systemPrompt },
            {
              inlineData: {
                mimeType: imgValidation.mimeType,
                data: imgValidation.base64Data,
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
              text: `${systemPrompt}\n\nLista de texto proporcionada por el cliente:\n${prompt}`,
            },
          ],
        },
      ];
    }

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const responseText = response.text?.trim() || '{}';
    let parsed: any = {};
    try {
      parsed = JSON.parse(responseText);
    } catch {
      parsed = { items: [] };
    }

    return {
      status: 200,
      body: {
        success: true,
        source: 'gemini_vision',
        items: Array.isArray(parsed.items) ? parsed.items : [],
      },
    };
  } catch (serverErr: any) {
    // Registro detallado seguro solo en consola del servidor
    console.error('[Gemini /api/scan-list error]:', serverErr?.message || serverErr);

    // Respuesta sanitizada y segura para el cliente
    return {
      status: 500,
      body: {
        success: false,
        error: 'No se pudo procesar la lista escolar con la IA. Verifique que la imagen sea nítida o ingrese los útiles manualmente.',
        items: [],
      },
    };
  }
}
