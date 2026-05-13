// api/apikey.js — Vercel Serverless Function
// Valida y registra API keys educativas de ARKAIOS EDU

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-ark-api-key');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const apiKey = req.headers['x-ark-api-key'] || req.query.apikey;

  // POST /api/apikey — validar key y procesar petición educativa
  if (req.method === 'POST') {
    if (!apiKey || !apiKey.startsWith('aek_')) {
      return res.status(401).json({
        ok: false,
        error: 'API key inválida. Obtén la tuya en: https://eduacion-libre-proyecto-arkaios.vercel.app/login.html'
      });
    }

    const { action, subject, grade, topic, format } = req.body || {};

    if (!action) {
      return res.status(400).json({ ok: false, error: 'Campo "action" requerido' });
    }

    // Routing de acciones educativas
    switch(action) {

      case 'generate_essay': {
        const prompt = buildEssayPrompt(subject, grade, topic, format);
        const result = await callGemini(prompt);
        return res.json({ ok: true, action, result, apiKey: maskKey(apiKey) });
      }

      case 'generate_summary': {
        const { content } = req.body;
        if (!content) return res.status(400).json({ ok: false, error: 'Campo "content" requerido' });
        const prompt = `Haz un resumen académico claro y estructurado del siguiente contenido para un estudiante de ${grade || 'secundaria'}:\n\n${content}`;
        const result = await callGemini(prompt);
        return res.json({ ok: true, action, result, apiKey: maskKey(apiKey) });
      }

      case 'generate_outline': {
        const prompt = `Crea un esquema detallado para un trabajo escolar sobre: "${topic}" para nivel ${grade || 'secundaria'}, materia: ${subject || 'general'}. Incluye introducción, desarrollo con subtemas y conclusión.`;
        const result = await callGemini(prompt);
        return res.json({ ok: true, action, result, apiKey: maskKey(apiKey) });
      }

      case 'validate': {
        return res.json({
          ok: true,
          valid: true,
          message: 'API key ARKAIOS EDU activa',
          key: maskKey(apiKey),
          actions: ['generate_essay', 'generate_summary', 'generate_outline'],
          docs: 'https://eduacion-libre-proyecto-arkaios.vercel.app/login.html'
        });
      }

      default:
        return res.status(400).json({ ok: false, error: `Acción desconocida: ${action}` });
    }
  }

  // GET /api/apikey — info del endpoint
  if (req.method === 'GET') {
    if (apiKey) {
      const valid = apiKey.startsWith('aek_') && apiKey.length > 10;
      return res.json({
        ok: true,
        valid,
        key: maskKey(apiKey),
        message: valid ? 'API key válida' : 'API key inválida',
        endpoints: {
          validate: 'POST /api/apikey { action: "validate" }',
          essay: 'POST /api/apikey { action: "generate_essay", subject, grade, topic }',
          summary: 'POST /api/apikey { action: "generate_summary", content, grade }',
          outline: 'POST /api/apikey { action: "generate_outline", subject, grade, topic }'
        }
      });
    }
    return res.json({
      ok: true,
      name: 'ARKAIOS EDU API',
      version: '1.0.0',
      login: 'https://eduacion-libre-proyecto-arkaios.vercel.app/login.html',
      description: 'Obtén tu API key gratis iniciando sesión con Google'
    });
  }

  return res.status(405).json({ ok: false, error: 'Método no permitido' });
}

// ── Helpers ──────────────────────────────────────────

function maskKey(key) {
  return key.substring(0, 8) + '****' + key.slice(-4);
}

function buildEssayPrompt(subject, grade, topic, format) {
  return `Escribe un trabajo escolar completo y bien estructurado con las siguientes características:

Materia: ${subject || 'General'}
Nivel educativo: ${grade || 'Secundaria'}
Tema: ${topic || 'Tema no especificado'}
Formato: ${format || 'Ensayo estándar mexicano'}

El trabajo debe incluir:
1. Portada (título, materia, nombre del alumno: [NOMBRE], fecha, institución: [INSTITUCIÓN])
2. Índice
3. Introducción
4. Desarrollo con subtemas bien definidos
5. Conclusión
6. Referencias bibliográficas

Usa un lenguaje académico apropiado para el nivel indicado. Formato para México.`;
}

async function callGemini(prompt) {
  const GEMINI_KEY = process.env.GEMINI_API_KEY || '***REMOVIDA***';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 2048 }
    })
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini error: ${err}`);
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || 'Sin respuesta de IA';
}
