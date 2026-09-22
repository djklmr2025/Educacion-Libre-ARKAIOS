// api/apikey.js — ARKAIOS EDU Public API
// API educativa unificada. Las credenciales de proveedores viven SOLO en variables de entorno.

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-ark-api-key');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const apiKey = String(req.headers['x-ark-api-key'] || req.query.apikey || '').trim();

  if (req.method === 'GET') {
    return res.json({
      ok: true,
      name: 'ARKAIOS EDU API',
      version: '1.1.0',
      description: 'API para generación y automatización de material educativo',
      authenticated: isValidEducationalKey(apiKey),
      actions: availableActions(),
      auth: 'x-ark-api-key: aek_...'
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Método no permitido' });
  }

  if (!isValidEducationalKey(apiKey)) {
    return res.status(401).json({
      ok: false,
      error: 'API key ARKAIOS EDU inválida',
      docs: 'https://eduacion-libre-proyecto-arkaios.vercel.app/login.html'
    });
  }

  const body = req.body || {};
  const { action, subject, grade, topic, format } = body;
  if (!action) return res.status(400).json({ ok: false, error: 'Campo "action" requerido' });

  try {
    switch (action) {
      case 'validate':
        return res.json({
          ok: true, valid: true, message: 'API key ARKAIOS EDU activa',
          key: maskKey(apiKey), actions: availableActions()
        });

      case 'generate_essay': {
        const result = await callGemini(buildEssayPrompt(subject, grade, topic, format));
        return success(res, action, result, apiKey);
      }

      case 'generate_summary': {
        if (!body.content) return missing(res, 'content');
        const result = await callGemini(
          `Haz un resumen académico claro y estructurado del siguiente contenido para un estudiante de ${grade || 'secundaria'}:\n\n${body.content}`
        );
        return success(res, action, result, apiKey);
      }

      case 'generate_outline': {
        if (!topic) return missing(res, 'topic');
        const result = await callGemini(
          `Crea un esquema detallado para un trabajo escolar sobre "${topic}" para nivel ${grade || 'secundaria'}, materia ${subject || 'general'}. Incluye introducción, desarrollo con subtemas y conclusión.`
        );
        return success(res, action, result, apiKey);
      }

      case 'generate_worksheet': {
        if (!topic) return missing(res, 'topic');
        const count = clampInt(body.exercise_count, 8, 1, 30);
        const prompt = `Crea una hoja de trabajo educativa lista para imprimir.
Materia: ${subject || 'General'}
Nivel: ${grade || 'Primaria'}
Tema: ${topic}
Número de ejercicios: ${count}
Formato: ${format || 'hoja carta MX'}
Incluye título, instrucciones breves, ejercicios variados, espacio suficiente para responder y una sección final de respuestas para el docente. Devuelve contenido estructurado y claro, sin Markdown innecesario.`;
        return success(res, action, await callGemini(prompt), apiKey);
      }

      case 'generate_cover': {
        const title = body.title || topic;
        if (!title) return missing(res, 'title');
        const prompt = `Diseña la especificación textual de una portada escolar imprimible.
Título exacto: "${title}"
Nivel: ${grade || 'escolar'}
Materia: ${subject || 'general'}
Estilo: ${body.style || 'infantil, alegre, limpio y a color'}
${body.reference_description ? `Referencia visual: ${body.reference_description}` : ''}
Entrega: título, subtítulo opcional, composición, paleta sugerida, elementos visuales, espacios editables y un prompt final para un generador de imágenes. No cambies el título exacto.`;
        return success(res, action, await callGemini(prompt), apiKey);
      }

      case 'create_reading_report_book': {
        const schedule = buildWeeklySchedule(body);
        const cover = {
          title: body.title || 'Mi reporte de lecturas',
          subtitle: body.subtitle || '',
          style: body.cover_style || 'infantil, alegre, escolar y a color'
        };
        return res.json({
          ok: true, action, apiKey: maskKey(apiKey),
          book: {
            cover,
            schedule,
            page_count: schedule.length,
            template: body.template || 'reporte_lectura',
            output: body.output || 'pdf'
          }
        });
      }

      case 'list_templates':
        return res.json({ ok: true, action, apiKey: maskKey(apiKey), templates: educationalTemplates() });

      case 'fill_template': {
        if (!body.template_id) return missing(res, 'template_id');
        return res.json({
          ok: true, action, apiKey: maskKey(apiKey),
          template_id: body.template_id,
          fill: body.fill || {},
          images: body.images || {},
          message_type: 'ARKAIOS_TEMPLATE_FILL'
        });
      }

      default:
        return res.status(400).json({ ok: false, error: `Acción desconocida: ${action}`, actions: availableActions() });
    }
  } catch (error) {
    console.error('[ARKAIOS EDU API]', error);
    return res.status(500).json({ ok: false, error: 'Error procesando la solicitud', details: error.message });
  }
}

function availableActions() {
  return [
    'validate', 'generate_essay', 'generate_summary', 'generate_outline',
    'generate_worksheet', 'generate_cover', 'create_reading_report_book',
    'list_templates', 'fill_template'
  ];
}

function educationalTemplates() {
  return [
    { id: 'carta-mx-inteligente', file: 'plantilla_escolar_carta_mx_autoajuste_y_areas_editables.html', type: 'document' },
    { id: 'cuadros-v2-inteligente', file: 'plantilla-cuadros-imagenes-v2.html', type: 'images' },
    { id: 'fotos-infantiles-inteligente', file: 'generador-fotos-infantiles.html', type: 'photos' },
    { id: 'hoja_milimetrica_interactiva', file: 'hoja_milimetrica_interactiva.html', type: 'math' }
  ];
}

function isValidEducationalKey(key) {
  // Compatibilidad con las aek_ existentes. Se puede endurecer con ARKAIOS_EDU_API_KEYS.
  if (!key.startsWith('aek_') || key.length < 12) return false;
  const configured = String(process.env.ARKAIOS_EDU_API_KEYS || '')
    .split(',').map(k => k.trim()).filter(Boolean);
  return configured.length === 0 || configured.includes(key);
}

function maskKey(key) {
  if (!key) return '';
  return key.slice(0, 8) + '****' + key.slice(-4);
}

function missing(res, field) {
  return res.status(400).json({ ok: false, error: `Campo "${field}" requerido` });
}

function success(res, action, result, apiKey) {
  return res.json({ ok: true, action, result, apiKey: maskKey(apiKey) });
}

function clampInt(value, fallback, min, max) {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

function buildEssayPrompt(subject, grade, topic, format) {
  return `Escribe un trabajo escolar completo y bien estructurado.
Materia: ${subject || 'General'}
Nivel educativo: ${grade || 'Secundaria'}
Tema: ${topic || 'Tema no especificado'}
Formato: ${format || 'Ensayo estándar mexicano'}
Incluye portada con marcadores [NOMBRE] e [INSTITUCIÓN], índice, introducción, desarrollo, conclusión y referencias. Usa lenguaje apropiado para el nivel indicado.`;
}

function buildWeeklySchedule(body) {
  const start = parseISODate(body.start_date);
  const end = parseISODate(body.end_date);
  if (!start || !end || start > end) throw new Error('start_date y end_date deben usar YYYY-MM-DD y formar un rango válido');

  const weekday = clampInt(body.weekday, 3, 0, 6); // 0 domingo, 3 miércoles
  const excluded = new Set(Array.isArray(body.exclude_dates) ? body.exclude_dates : []);
  const ranges = Array.isArray(body.exclude_ranges) ? body.exclude_ranges : [];

  const cursor = new Date(start.getTime());
  while (cursor.getUTCDay() !== weekday) cursor.setUTCDate(cursor.getUTCDate() + 1);

  const schedule = [];
  while (cursor <= end) {
    const iso = cursor.toISOString().slice(0, 10);
    const inRange = ranges.some(r => {
      const a = parseISODate(r?.start);
      const b = parseISODate(r?.end);
      return a && b && cursor >= a && cursor <= b;
    });
    if (!excluded.has(iso) && !inRange) {
      schedule.push({ week: schedule.length + 1, date: iso, display_date: formatDateES(cursor) });
    }
    cursor.setUTCDate(cursor.getUTCDate() + 7);
  }
  return schedule;
}

function parseISODate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return null;
  const d = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatDateES(date) {
  return new Intl.DateTimeFormat('es-MX', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric', timeZone: 'UTC'
  }).format(date);
}

async function callGemini(prompt) {
  const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.VITE_GOOGLE_API_KEY;
  if (!key) throw new Error('Falta GEMINI_API_KEY/GOOGLE_API_KEY en variables de entorno');

  const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 4096 }
    })
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data?.error?.message || `Gemini HTTP ${response.status}`);
  return data.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || 'Sin respuesta de IA';
}
