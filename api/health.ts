import type { VercelRequest, VercelResponse } from '@vercel/node';
import { setSecureCorsHeaders } from './_geminiService';

export default function handler(req: VercelRequest, res: VercelResponse) {
  setSecureCorsHeaders(req.headers, (k, v) => res.setHeader(k, v));

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const hasGemini = Boolean(process.env.GEMINI_API_KEY);
  const hasSupabase = Boolean(
    process.env.VITE_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL
  );

  return res.status(200).json({
    status: 'ok',
    has_gemini_key: hasGemini,
    has_supabase_configured: hasSupabase,
    time: new Date().toISOString(),
    platform: 'vercel-serverless',
  });
}
