export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.VITE_GROK_API_KEY || process.env.PROXY_API_KEY;
  const baseUrl = process.env.VITE_GROK_API_KEY
    ? 'https://api.x.ai'
    : (process.env.VITE_ARKAIOS_BASE_URL || process.env.ARKAIOS_BASE_URL || 'https://arkaios-service-proxy.onrender.com');

  if (!apiKey) {
    return res.status(500).json({ error: 'Missing API key for orchestrator' });
  }

  const body = req.body || {};
  const prompt = String(body.prompt || '').trim();
  const template = body.template || {};
  const currentData = body.data || {};

  if (!prompt) {
    return res.status(400).json({ error: 'Missing prompt' });
  }

  const compactTemplate = {
    id: template.id || 'template',
    title: template.title || 'Plantilla',
    modules: Array.isArray(template.modules) ? template.modules.slice(0, 150) : []
  };

  const messages = [
    {
      role: 'system',
      content: [
        'Eres ARKAIOS Orquestador. Tu tarea es completar modulos de una plantilla educativa.',
        'Responde SIEMPRE JSON valido con esta forma:',
        '{"reply":"texto breve","fill":{"module_id":"valor"},"images":{"image_slot_id":"url_o_prompt"}}',
        'Reglas:',
        '- Solo usa ids de modulos existentes.',
        '- fill para texto/inputs.',
        '- images para slots de imagen; usa URL si ya la tienes, o prompt corto en texto.',
        '- No incluyas markdown ni texto fuera del JSON.'
      ].join('\n')
    },
    {
      role: 'user',
      content: JSON.stringify({
        prompt,
        template: compactTemplate,
        currentData
      })
    }
  ];

  try {
    const chatResp = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'grok-2-latest',
        temperature: 0.4,
        messages
      })
    });

    const chatData = await chatResp.json();
    if (!chatResp.ok) return res.status(chatResp.status).json(chatData);

    const raw = chatData?.choices?.[0]?.message?.content || '{}';
    let parsed = {};
    try {
      parsed = JSON.parse(raw);
    } catch {
      const trimmed = String(raw).trim();
      const start = trimmed.indexOf('{');
      const end = trimmed.lastIndexOf('}');
      if (start >= 0 && end > start) {
        try { parsed = JSON.parse(trimmed.slice(start, end + 1)); } catch { parsed = {}; }
      }
    }

    const fill = parsed.fill && typeof parsed.fill === 'object' ? parsed.fill : {};
    const images = parsed.images && typeof parsed.images === 'object' ? parsed.images : {};
    const reply = parsed.reply || 'Solicitud procesada por ARKAIOS.';

    return res.status(200).json({
      ok: true,
      reply,
      fill,
      images,
      templateId: compactTemplate.id
    });
  } catch (error) {
    return res.status(500).json({
      error: 'Orchestrator request failed',
      details: error.message
    });
  }
}
