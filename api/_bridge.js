// ============================================================
// ARKAIOS ONLINE AGENT BRIDGE API (Vercel Serverless Function)
// Conecta https://eduacion-libre-proyecto-arkaios.vercel.app
// con https://gemini-lab-nine.vercel.app en producción online.
// ============================================================

const GEMINI_LAB_ONLINE_API = process.env.GEMINI_LAB_ONLINE_API || 'https://gemini-lab-nine.vercel.app/api/edu-agent';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    if (req.method === 'GET') {
      return res.status(200).json({
        ok: true,
        service: 'ARKAIOS Online Agent Bridge (Vercel Cloud)',
        connectedNodes: [
          'https://eduacion-libre-proyecto-arkaios.vercel.app',
          'https://gemini-lab-nine.vercel.app'
        ],
        timestamp: new Date().toISOString()
      });
    }

    if (req.method === 'POST') {
      const body = req.body || {};
      const requestText = String(body.request || body.prompt || '').trim();
      const mode = body.mode || 'bridge';
      const currentTemplate = body.currentTemplate || '';

      if (!requestText) {
        return res.status(400).json({ error: 'Campo "request" o "prompt" requerido' });
      }

      console.log(`[online-bridge] Transmitiendo a Gemini-Lab Online (${GEMINI_LAB_ONLINE_API}): "${requestText}"`);

      // Transmite la solicitud a Gemini-Lab Omni en Vercel
      const geminiLabResponse = await fetch(GEMINI_LAB_ONLINE_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          request: requestText,
          mode: mode,
          currentTemplate: currentTemplate
        })
      });

      const responseData = await geminiLabResponse.json();

      if (!geminiLabResponse.ok) {
        return res.status(geminiLabResponse.status).json({
          ok: false,
          error: 'Error al comunicarse con Gemini-Lab Online',
          details: responseData
        });
      }

      return res.status(200).json({
        ok: true,
        source: 'online-bridge',
        geminiLabResult: responseData,
        timestamp: new Date().toISOString()
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('[online-bridge] Error:', error);
    return res.status(500).json({
      ok: false,
      error: 'Error interno en el puente online',
      details: error.message
    });
  }
}
