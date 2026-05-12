// ============================================================
// ARKAIOS IA Chat — powered by Google Gemini
// Usa la suscripción Google One AI Pro del usuario.
// ============================================================

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || process.env.VITE_GOOGLE_API_KEY;

  if (!GOOGLE_API_KEY) {
    return res.status(500).json({ error: 'Server configuration error: Missing Google API Key' });
  }

  // Convertir el formato OpenAI (messages[]) al formato de Gemini
  const body = req.body || {};
  const messages = Array.isArray(body.messages) ? body.messages : [];
  const systemMessage = messages.find((m) => m.role === 'system');
  const conversationMessages = messages.filter((m) => m.role !== 'system');

  // Mapear roles: user -> user, assistant -> model
  const geminiContents = conversationMessages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: typeof m.content === 'string' ? m.content : JSON.stringify(m.content) }]
  }));

  const systemInstruction = systemMessage
    ? { parts: [{ text: systemMessage.content }] }
    : {
        parts: [{
          text: 'Eres ARKAIOS IA, un asistente educativo inteligente del ecosistema ARKAIOS. Ayudas a maestros y estudiantes con plantillas educativas, generación de contenido, imágenes y material didáctico. Responde siempre en español con tono amable y profesional.'
        }]
      };

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GOOGLE_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: systemInstruction,
          contents: geminiContents,
          generationConfig: {
            temperature: body.temperature ?? 0.7,
            maxOutputTokens: body.max_tokens ?? 1024
          }
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error('Gemini error:', JSON.stringify(data));
      return res.status(response.status).json({ error: data?.error?.message || 'Error de Gemini' });
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // Devolver en formato compatible con OpenAI para no romper el frontend
    return res.status(200).json({
      choices: [{
        message: {
          role: 'assistant',
          content: text
        },
        finish_reason: data.candidates?.[0]?.finishReason || 'stop'
      }],
      model: 'gemini-1.5-flash',
      usage: {
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0
      }
    });
  } catch (error) {
    console.error('Arkaios Gemini proxy error:', error);
    return res.status(500).json({ error: 'Failed to fetch from Gemini', details: error.message });
  }
}
