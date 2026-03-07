// api/pexels.js
// Endpoint serverless para buscar imágenes en Pexels sin exponer la API key en el navegador

export default async function handler(req, res) {
  // Configuración de CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Manejo de la solicitud OPTIONS (pre-flight)
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Solo permitir solicitudes POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const apiKey = process.env.PEXELS_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'PEXELS_API_KEY no está configurada en el servidor.' });
  }

  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch (e) {
    return res.status(400).json({ error: 'Cuerpo de la solicitud inválido (JSON malformado).' });
  }

  const { q, per_page = 10 } = body;

  if (!q) {
    return res.status(400).json({ error: 'El parámetro "q" (búsqueda) es requerido.' });
  }

  const apiUrl = 'https://api.pexels.com/v1/search';
  const searchUrl = `${apiUrl}?query=${encodeURIComponent(q)}&per_page=${per_page}`;

  try {
    const pexelsResponse = await fetch(searchUrl, {
      headers: {
        'Authorization': apiKey,
      },
    });
    
    const rateLimit = pexelsResponse.headers.get('X-Ratelimit-Limit');
    const rateLimitRemaining = pexelsResponse.headers.get('X-Ratelimit-Remaining');
    const rateLimitReset = pexelsResponse.headers.get('X-Ratelimit-Reset');

    if (rateLimit) res.setHeader('X-Ratelimit-Limit', rateLimit);
    if (rateLimitRemaining) res.setHeader('X-Ratelimit-Remaining', rateLimitRemaining);
    if (rateLimitReset) res.setHeader('X-Ratelimit-Reset', rateLimitReset);

    if (!pexelsResponse.ok) {
      const errorData = await pexelsResponse.text();
      console.error('Error de API Pexels:', errorData);
      return res.status(pexelsResponse.status).json({
        error: `Error de la API de Pexels: ${pexelsResponse.statusText}`,
        details: errorData,
      });
    }

    const data = await pexelsResponse.json();
    return res.status(200).json(data);

  } catch (error) {
    console.error('Error interno del servidor:', error);
    return res.status(500).json({ error: 'Error interno del servidor al contactar la API de Pexels.' });
  }
}
