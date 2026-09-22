// api/agent-daemon.js
// ARKAIOS Agent Daemon — hub HTTP stateless para comunicación/orquestación entre agentes.
// En Vercel no es un proceso residente: cada llamada es una iteración del demonio.
// Estado durable opcional: el cliente conserva conversation/task ids o se conecta a storage externo.

const DEFAULT_TIMEOUT_MS = 25000;
const MAX_HOPS = 6;

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    return res.status(200).json({
      ok: true,
      service: 'ARKAIOS Agent Daemon',
      version: '1.0.0',
      mode: 'stateless-http-orchestrator',
      capabilities: ['health', 'discover', 'dispatch', 'broadcast', 'pipeline'],
      agents: configuredAgents().map(publicAgent),
      timestamp: new Date().toISOString()
    });
  }

  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });
  if (!authorized(req)) return res.status(401).json({ ok: false, error: 'Unauthorized' });

  const body = req.body || {};
  const action = String(body.action || 'dispatch');
  const traceId = cleanId(body.trace_id) || crypto.randomUUID();

  try {
    if (action === 'health' || action === 'discover') {
      const agents = configuredAgents();
      const checks = action === 'health'
        ? await Promise.all(agents.map(a => checkAgent(a, traceId)))
        : agents.map(a => ({ ...publicAgent(a), status: 'configured' }));
      return res.json({ ok: true, action, trace_id: traceId, agents: checks });
    }

    if (action === 'dispatch') {
      const agent = findAgent(body.agent);
      if (!agent) return res.status(404).json({ ok: false, error: 'Agent not configured' });
      const result = await dispatch(agent, body.message ?? body.payload, {
        traceId, taskId: cleanId(body.task_id), hop: 0, context: body.context
      });
      return res.json({ ok: true, action, trace_id: traceId, result });
    }

    if (action === 'broadcast') {
      const targets = selectAgents(body.agents);
      const results = await Promise.allSettled(targets.map(agent =>
        dispatch(agent, body.message ?? body.payload, {
          traceId, taskId: cleanId(body.task_id), hop: 0, context: body.context
        })
      ));
      return res.json({
        ok: true, action, trace_id: traceId,
        results: results.map((r, i) => r.status === 'fulfilled'
          ? { agent: targets[i].id, ok: true, response: r.value }
          : { agent: targets[i].id, ok: false, error: r.reason?.message || 'dispatch failed' })
      });
    }

    if (action === 'pipeline') {
      const ids = Array.isArray(body.agents) ? body.agents : [];
      if (!ids.length) return res.status(400).json({ ok: false, error: 'agents[] required for pipeline' });
      if (ids.length > MAX_HOPS) return res.status(400).json({ ok: false, error: `Pipeline max ${MAX_HOPS} hops` });

      let value = body.message ?? body.payload;
      const steps = [];
      for (let hop = 0; hop < ids.length; hop++) {
        const agent = findAgent(ids[hop]);
        if (!agent) throw new Error(`Agent not configured: ${ids[hop]}`);
        const response = await dispatch(agent, value, {
          traceId, taskId: cleanId(body.task_id), hop, context: body.context
        });
        steps.push({ agent: agent.id, response });
        value = response?.data ?? response;
      }
      return res.json({ ok: true, action, trace_id: traceId, final: value, steps });
    }

    return res.status(400).json({ ok: false, error: 'Unknown action' });
  } catch (error) {
    console.error('[agent-daemon]', traceId, error);
    return res.status(502).json({ ok: false, trace_id: traceId, error: error.message });
  }
}

function configuredAgents() {
  const raw = process.env.ARKAIOS_AGENT_REGISTRY;
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.filter(validAgent).map(normalizeAgent);
    } catch (e) {
      console.error('[agent-daemon] invalid ARKAIOS_AGENT_REGISTRY:', e.message);
    }
  }

  // Defaults conocidos del ecosistema; las keys siguen en variables server-side.
  return [
    {
      id: 'gemini-lab',
      name: 'Gemini Lab EDU',
      url: process.env.GEMINI_LAB_ONLINE_API || 'https://gemini-lab-nine.vercel.app/api/edu-agent',
      authEnv: 'GEMINI_LAB_AGENT_KEY',
      protocol: 'arkaios-json'
    },
    {
      id: 'arkaios-bridge',
      name: 'ARKAIOS Bridge',
      url: process.env.ARKAIOS_BRIDGE_URL || 'https://eduacion-libre-proyecto-arkaios.vercel.app/api/bridge',
      authEnv: 'ARKAIOS_BRIDGE_KEY',
      protocol: 'arkaios-json'
    }
  ].filter(validAgent).map(normalizeAgent);
}

function normalizeAgent(a) {
  return {
    id: cleanId(a.id),
    name: String(a.name || a.id),
    url: String(a.url),
    protocol: String(a.protocol || 'arkaios-json'),
    authEnv: a.authEnv ? String(a.authEnv) : null
  };
}

function validAgent(a) {
  try {
    const u = new URL(String(a?.url || ''));
    return !!a?.id && u.protocol === 'https:';
  } catch { return false; }
}

function publicAgent(a) {
  return { id: a.id, name: a.name, protocol: a.protocol, configured: true };
}

function findAgent(id) {
  const wanted = cleanId(id);
  return configuredAgents().find(a => a.id === wanted);
}

function selectAgents(ids) {
  if (!Array.isArray(ids) || !ids.length) return configuredAgents();
  const wanted = new Set(ids.map(cleanId));
  return configuredAgents().filter(a => wanted.has(a.id));
}

async function checkAgent(agent, traceId) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    const response = await fetch(agent.url, {
      method: 'GET',
      headers: agentHeaders(agent, traceId),
      signal: controller.signal
    });
    clearTimeout(timer);
    return { ...publicAgent(agent), status: response.ok ? 'online' : 'degraded', http_status: response.status };
  } catch (error) {
    return { ...publicAgent(agent), status: 'offline', error: error.name === 'AbortError' ? 'timeout' : error.message };
  }
}

async function dispatch(agent, payload, meta) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  try {
    const response = await fetch(agent.url, {
      method: 'POST',
      headers: agentHeaders(agent, meta.traceId),
      body: JSON.stringify({
        request: typeof payload === 'string' ? payload : undefined,
        payload: typeof payload === 'string' ? undefined : payload,
        mode: 'agent-daemon',
        trace_id: meta.traceId,
        task_id: meta.taskId || undefined,
        hop: meta.hop,
        context: meta.context || undefined,
        source: 'arkaios-agent-daemon'
      }),
      signal: controller.signal
    });

    const text = await response.text();
    let data;
    try { data = JSON.parse(text); } catch { data = text; }
    if (!response.ok) throw new Error(`${agent.id} HTTP ${response.status}: ${typeof data === 'string' ? data.slice(0, 300) : JSON.stringify(data).slice(0, 300)}`);
    return { agent: agent.id, http_status: response.status, data };
  } finally {
    clearTimeout(timer);
  }
}

function agentHeaders(agent, traceId) {
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'X-ARKAIOS-Trace': traceId
  };
  if (agent.authEnv && process.env[agent.authEnv]) {
    headers.Authorization = `Bearer ${process.env[agent.authEnv]}`;
  }
  return headers;
}

function authorized(req) {
  const expected = process.env.ARKAIOS_DAEMON_KEY;
  // Si se configura una key, se vuelve obligatoria. Sin key, mantiene compatibilidad inicial.
  if (!expected) return true;
  const bearer = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const ark = String(req.headers['x-ark-api-key'] || '');
  return bearer === expected || ark === expected;
}

function cleanId(value) {
  return String(value || '').trim().replace(/[^a-zA-Z0-9._:-]/g, '').slice(0, 100);
}

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-ark-api-key, X-ARKAIOS-Trace');
}
