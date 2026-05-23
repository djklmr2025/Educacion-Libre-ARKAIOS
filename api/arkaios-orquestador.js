export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const grokKey = process.env.VITE_GROK_API_KEY || process.env.GROK_API_KEY;
  const googleKey = process.env.GOOGLE_API_KEY || process.env.VITE_GOOGLE_API_KEY;

  // Decidir qué backend usar: Grok (xAI) si hay key, si no Gemini
  const useGrok = !!grokKey;
  const useGemini = !useGrok && !!googleKey;

  if (!useGrok && !useGemini) {
    return res.status(500).json({ error: 'Missing API key for orchestrator (Grok o Gemini requerido)' });
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

  const systemContent = [
    'Eres ARKAIOS Orquestador. Tu tarea es completar modulos de una plantilla educativa.',
    'Responde SIEMPRE JSON valido con esta forma:',
    '{"reply":"texto breve","fill":{"module_id":"valor"},"images":{"image_slot_id":"url_o_prompt"}}',
    'Reglas:',
    '- Solo usa ids de modulos existentes.',
    '- fill para texto/inputs.',
    '- images para slots de imagen; usa URL si ya la tienes, o prompt corto en texto.',
    '- No incluyas markdown ni texto fuera del JSON.'
  ].join('\n');

  const userContent = JSON.stringify({ prompt, template: compactTemplate, currentData });

  try {
    let raw = '{}';

    if (useGrok) {
      // Ruta Grok (xAI)
      const chatResp = await fetch('https://api.x.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${grokKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'grok-2-latest',
          temperature: 0.4,
          messages: [
            { role: 'system', content: systemContent },
            { role: 'user', content: userContent }
          ]
        })
      });
      const chatData = await chatResp.json();
      if (!chatResp.ok) return res.status(chatResp.status).json(chatData);
      raw = chatData?.choices?.[0]?.message?.content || '{}';

    } else {
      // Ruta Gemini (fallback de producción)
      const geminiResp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${googleKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: `${systemContent}\n\n${userContent}` }] }],
            generationConfig: { temperature: 0.4, maxOutputTokens: 1000 }
          })
        }
      );
      const geminiData = await geminiResp.json();
      if (!geminiResp.ok) return res.status(geminiResp.status).json(geminiData);
      raw = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    }

    // Parsear JSON de la respuesta
    let parsed = {};
    try {
      parsed = JSON.parse(raw);
    } catch {
      const trimmed = String(raw).trim();
      const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try { parsed = JSON.parse(jsonMatch[0]); } catch { parsed = {}; }
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
