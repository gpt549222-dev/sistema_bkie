import type { VercelRequest, VercelResponse } from '@vercel/node';
import { processScanListRequest, setSecureCorsHeaders } from './_geminiService';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setSecureCorsHeaders(req.headers, (k, v) => res.setHeader(k, v));

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      body = {};
    }
  }

  const clientIp =
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
    req.socket?.remoteAddress ||
    '127.0.0.1';

  const result = await processScanListRequest(body, clientIp);
  return res.status(result.status).json(result.body);
}
