// api/pexels.js
// Proxy de búsqueda de imágenes (Pexels, Pixabay, Freepik, Lorem Picsum) sin exponer las API keys en el navegador.
// Un solo archivo porque Vercel Hobby limita a 12 funciones.
// Body: { q, per_page?, limit?, orientation?, provider?: 'pexels' | 'pixabay' | 'freepik' | 'picsum' }

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

async function fetchPicsumImages(q, perPage) {
  const randomPage = Math.floor(Math.random() * 20) + 1;
  const listUrl = `https://picsum.photos/v2/list?page=${randomPage}&limit=${perPage}`;

  let list = [];
  try {
    const r = await fetch(listUrl, { headers: { 'User-Agent': 'ARKAIOS-Edu/1.0' } });
    if (r.ok) {
      list = await r.json();
    }
  } catch (e) {
    console.error('Error al consultar lista de Picsum:', e);
  }

  const results = [];
  for (let i = 0; i < perPage; i++) {
    const item = Array.isArray(list) ? list[i] : null;
    const id = item?.id;
    const author = item?.author || 'Lorem Picsum';
    const seed = `${(q || 'foto').replace(/[^a-zA-Z0-9]/g, '_')}_${i + 1}`;

    const regularUrl = id
      ? `https://picsum.photos/id/${id}/800/600`
      : `https://picsum.photos/seed/${encodeURIComponent(seed)}/800/600`;

    const smallUrl = id
      ? `https://picsum.photos/id/${id}/400/300`
      : `https://picsum.photos/seed/${encodeURIComponent(seed)}/400/300`;

    const fullUrl = item?.download_url || (id ? `https://picsum.photos/id/${id}/1920/1080` : regularUrl);

    results.push({
      id: id || `${seed}`,
      author,
      // Compatibilidad con Freepik (generador-fotos-infantiles.html):
      image: {
        source: {
          url: regularUrl,
        },
      },
      // Compatibilidad con Freepik (js/main.js):
      urls: {
        regular: regularUrl,
        small: smallUrl,
        full: fullUrl,
      },
      // Compatibilidad con Pexels:
      src: {
        large: regularUrl,
        medium: smallUrl,
        original: fullUrl,
      },
      // Compatibilidad con Pixabay:
      largeImageURL: regularUrl,
      webformatURL: smallUrl,
    });
  }

  return {
    data: results,
    photos: results,
    hits: results,
    total: results.length,
    provider: 'picsum',
  };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  let body = {};
  if (req.method === 'POST') {
    try {
      body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    } catch (e) {
      return res.status(400).json({ error: 'Cuerpo de la solicitud inválido (JSON malformado).' });
    }
  } else {
    body = req.query || {};
  }

  let providerName = (body.provider || req.query?.provider || '').toLowerCase();
  if (!providerName) {
    if (req.url && req.url.includes('/api/freepik')) providerName = 'freepik';
    else if (req.url && req.url.includes('/api/pixabay')) providerName = 'pixabay';
    else if (req.url && req.url.includes('/api/picsum')) providerName = 'picsum';
    else providerName = 'pexels';
  }

  if (providerName === 'lorem-picsum' || providerName === 'lorempicsum') {
    providerName = 'picsum';
  }

  const q = typeof body.q === 'string' ? body.q.trim().slice(0, 100) : (typeof req.query?.q === 'string' ? req.query.q.trim().slice(0, 100) : '');
  const perPage = Math.min(MAX_PER_PAGE, Math.max(1, parseInt(body.per_page || body.limit || req.query?.per_page || req.query?.limit, 10) || 10));

  // Lorem Picsum es libre y no requiere API Key
  if (providerName === 'picsum') {
    const picsumData = await fetchPicsumImages(q || 'educacion', perPage);
    return res.status(200).json(picsumData);
  }

  const provider = PROVIDERS[providerName];
  if (!provider) return res.status(400).json({ error: `Proveedor "${providerName}" no soportado.` });

  if (!q) return res.status(400).json({ error: 'El parámetro "q" (búsqueda) es requerido.' });

  const key = process.env[provider.envVar];

  // Si Freepik no tiene key configurada, recurrir de inmediato a Lorem Picsum
  if (providerName === 'freepik' && !key) {
    console.warn('FREEPIK_API_KEY no configurada; recurriendo a fallback Lorem Picsum.');
    const fallbackData = await fetchPicsumImages(q, perPage);
    return res.status(200).json(fallbackData);
  }

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
      const errText = await upstream.text();
      console.error(`Error de API ${providerName}:`, upstream.status, errText);

      // Si Freepik falla (ej. 401 Unauthorized), rescatamos con Lorem Picsum transparente
      if (providerName === 'freepik') {
        console.warn('Freepik rechazó la petición; activando fallback transparente de Lorem Picsum.');
        const fallbackData = await fetchPicsumImages(q, perPage);
        return res.status(200).json(fallbackData);
      }

      return res.status(upstream.status).json({ error: `Error de la API de ${providerName}: ${upstream.statusText}` });
    }

    return res.status(200).json(await upstream.json());
  } catch (error) {
    console.error(`Error interno contactando ${providerName}:`, error);

    if (providerName === 'freepik') {
      console.warn('Excepción al contactar Freepik; activando fallback Lorem Picsum.');
      const fallbackData = await fetchPicsumImages(q, perPage);
      return res.status(200).json(fallbackData);
    }

    return res.status(500).json({ error: `Error interno del servidor al contactar ${providerName}.` });
  }
}
