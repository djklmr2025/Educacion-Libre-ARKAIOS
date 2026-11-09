// api/pexels.js
// Proxy de búsqueda de imágenes (Pexels, Pixabay, Freepik) sin exponer las API keys en el navegador.
// Un solo archivo porque Vercel Hobby limita a 12 funciones.
// Body: { q, per_page?, orientation?, provider?: 'pexels' | 'pixabay' | 'freepik' }

const ORIENTATIONS = ['landscape', 'portrait', 'square'];
const MAX_PER_PAGE = 40;

const PROVIDERS = {
  pexels: {
    envVar: 'PEXELS_API_KEY',
    build(q, perPage, orientation, key) {
      const o = ORIENTATIONS.includes(orientation) ? `&orientation=${orientation}` : '';
      return {
        url: `https://api.pexels.com/v1/search?query=${encodeURIComponent(q)}&per_page=${perPage}${o}`,
        headers: { Authorization: key },
      };
    },
  },
  pixabay: {
    envVar: 'PIXABAY_API_KEY',
    build(q, perPage, orientation, key) {
      const o = orientation === 'landscape' ? '&orientation=horizontal'
        : orientation === 'portrait' ? '&orientation=vertical' : '';
      const n = Math.max(3, perPage); // Pixabay exige per_page >= 3
      return {
        url: `https://pixabay.com/api/?key=${encodeURIComponent(key)}&q=${encodeURIComponent(q)}&image_type=photo&lang=es&safesearch=true&per_page=${n}${o}`,
        headers: {},
      };
    },
  },
  freepik: {
    envVar: 'FREEPIK_API_KEY',
    build(q, perPage, _orientation, key) {
      return {
        url: `https://api.freepik.com/v1/resources?locale=es-ES&term=${encodeURIComponent(q)}&limit=${perPage}`,
        headers: { 'x-freepik-api-key': key, 'Accept-Language': 'es-ES' },
      };
    },
  },
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
  } catch (e) {
    return res.status(400).json({ error: 'Cuerpo de la solicitud inválido (JSON malformado).' });
  }

  const providerName = body.provider || 'pexels';
  const provider = PROVIDERS[providerName];
  if (!provider) return res.status(400).json({ error: 'Proveedor no soportado.' });

  const q = typeof body.q === 'string' ? body.q.trim().slice(0, 100) : '';
  if (!q) return res.status(400).json({ error: 'El parámetro "q" (búsqueda) es requerido.' });

  const perPage = Math.min(MAX_PER_PAGE, Math.max(1, parseInt(body.per_page, 10) || 10));

  const key = process.env[provider.envVar];
  if (!key) return res.status(500).json({ error: `${provider.envVar} no está configurada en el servidor.` });

  const { url, headers } = provider.build(q, perPage, body.orientation, key);

  try {
    const upstream = await fetch(url, { headers });

    if (providerName === 'pexels') {
      for (const h of ['X-Ratelimit-Limit', 'X-Ratelimit-Remaining', 'X-Ratelimit-Reset']) {
        const v = upstream.headers.get(h);
        if (v) res.setHeader(h, v);
      }
    }

    if (!upstream.ok) {
      console.error(`Error de API ${providerName}:`, upstream.status, await upstream.text());
      return res.status(upstream.status).json({ error: `Error de la API de ${providerName}: ${upstream.statusText}` });
    }

    return res.status(200).json(await upstream.json());
  } catch (error) {
    console.error(`Error interno contactando ${providerName}:`, error);
    return res.status(500).json({ error: `Error interno del servidor al contactar ${providerName}.` });
  }
}
