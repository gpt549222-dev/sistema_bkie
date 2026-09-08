import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import { processScanListRequest, setSecureCorsHeaders } from './api/_geminiService';

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware de CORS seguro para endpoints de /api
  app.use('/api', (req, res, next) => {
    setSecureCorsHeaders(req.headers as Record<string, unknown>, (k, v) => res.setHeader(k, v));
    if (req.method === 'OPTIONS') {
      return res.sendStatus(204);
    }
    next();
  });

  // JSON Body Parser con límite seguro para imágenes base64
  app.use(express.json({ limit: '10mb' }));

  // API Health Check
  app.get('/api/health', (req, res) => {
    const hasGemini = Boolean(process.env.GEMINI_API_KEY);
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

  // API Route: AI Scan Stationery List delegada al servicio reutilizable
  app.post('/api/scan-list', async (req, res) => {
    const clientIp =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.socket.remoteAddress ||
      '127.0.0.1';

    const result = await processScanListRequest(req.body, clientIp);
    return res.status(result.status).json(result.body);
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
