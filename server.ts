import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

let geminiClient: GoogleGenAI | null = null;

function getGemini(): GoogleGenAI | null {
  const key =
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_GENAI_API_KEY ||
    process.env.VITE_GEMINI_API_KEY;
  if (!key) {
    return null;
  }
  if (!geminiClient) {
    geminiClient = new GoogleGenAI({ apiKey: key });
  }
  return geminiClient;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // JSON Body Parser with high limit for images
  app.use(express.json({ limit: '15mb' }));

  // API Health Check
  app.get('/api/health', (req, res) => {
    const hasGemini = Boolean(
      process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_GENAI_API_KEY
    );
    const hasSupabase = Boolean(
      process.env.VITE_SUPABASE_URL ||
      process.env.SUPABASE_URL ||
      process.env.NEXT_PUBLIC_SUPABASE_URL
    );
    res.json({
      status: 'ok',
      has_gemini_key: hasGemini,
      has_supabase_configured: hasSupabase,
      time: new Date().toISOString(),
      platform: 'express-server',
    });
  });

  // API Route: AI Scan Stationery List
  app.post('/api/scan-list', async (req, res) => {
    const { image, prompt } = req.body || {};
    try {
      const ai = getGemini();

      if (!ai) {
        return res.status(503).json({
          success: false,
          error: 'El servicio de IA de Gemini no está configurado en el servidor. Configure GEMINI_API_KEY en las variables de entorno.',
          items: [],
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

      return res.json({
        success: true,
        source: 'gemini_vision',
        items: Array.isArray(parsed.items) ? parsed.items : [],
      });
    } catch (err: any) {
      console.error('Error in /api/scan-list:', err);
      return res.status(500).json({
        success: false,
        error: err.message || 'Error al procesar la lista con la IA de Gemini.',
        items: [],
      });
    }
  });

  // Vite middleware in dev or static serving in prod
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`BIKIE Papelería Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
