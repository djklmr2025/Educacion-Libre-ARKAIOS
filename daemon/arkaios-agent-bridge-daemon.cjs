/**
 * ============================================================
 * 🤖 DEMONIO DE COMUNICACIÓN INTER-AGENTES ARKAIOS (Bridge Daemon)
 * Conecta en tiempo real:
 *   - Agente A: Plantillero Educativo (Eduacion-Libre-Proyecto-ARKAIOS-MAIN)
 *   - Agente B: Co-Agente Gemini-Lab Omni (Gemini-lab-main)
 * 
 * Puerto por defecto: 8788
 * Soporta HTTP EventBus + Server-Sent Events (SSE) en tiempo real
 * ============================================================
 */

const http = require('http');
const PORT = process.env.BRIDGE_PORT || 8788;

const connectedClients = new Set();
const messageQueue = [];
const MAX_QUEUE_SIZE = 100;

const agentsStatus = {
  plantillero: { name: 'ARKAIOS Edu Plantillero', lastSeen: Date.now(), status: 'active' },
  geminiLab: { name: 'Gemini-Lab Omni (AETHYR)', lastSeen: Date.now(), status: 'active' }
};

function broadcastEvent(eventData) {
  const payload = `data: ${JSON.stringify(eventData)}\n\n`;
  connectedClients.forEach(client => {
    try {
      client.write(payload);
    } catch (e) {
      connectedClients.delete(client);
    }
  });
}

const server = http.createServer((req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  // Healthcheck & Estado del Enjambre
  if (url.pathname === '/health' || url.pathname === '/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      ok: true,
      service: 'ARKAIOS Inter-Agent Bridge Daemon',
      port: PORT,
      agents: agentsStatus,
      connectedClients: connectedClients.size,
      queuedMessages: messageQueue.length,
      timestamp: new Date().toISOString()
    }, null, 2));
    return;
  }

  // SSE Stream en Tiempo Real para Navegadores
  if (url.pathname === '/api/bridge/events') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });
    
    res.write(`data: ${JSON.stringify({ type: 'CONNECTED', message: 'Demonio de agentes conectado con éxito' })}\n\n`);
    connectedClients.add(res);

    req.on('close', () => {
      connectedClients.delete(res);
    });
    return;
  }

  // Publicar mensaje o tarea inter-agente
  if (url.pathname === '/api/bridge/publish' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const msg = JSON.parse(body || '{}');
        const messageId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        
        const formattedMessage = {
          id: messageId,
          from: msg.from || 'agent-unknown',
          to: msg.to || 'broadcast',
          type: msg.type || 'TASK_DELEGATED',
          payload: msg.payload || {},
          timestamp: new Date().toISOString()
        };

        if (msg.from && agentsStatus[msg.from]) {
          agentsStatus[msg.from].lastSeen = Date.now();
          agentsStatus[msg.from].status = 'active';
        }

        messageQueue.push(formattedMessage);
        if (messageQueue.length > MAX_QUEUE_SIZE) messageQueue.shift();

        broadcastEvent(formattedMessage);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, messageId, status: 'dispatched' }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'JSON inválido', details: err.message }));
      }
    });
    return;
  }

  // Consultar historial de mensajes
  if (url.pathname === '/api/bridge/messages') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, messages: messageQueue }));
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Endpoint no encontrado' }));
});

server.listen(PORT, () => {
  console.log(`\n==================================================`);
  console.log(`🤖 DEMONIO DE COMUNICACIÓN INTER-AGENTES INICIADO`);
  console.log(`📡 Escuchando en: http://localhost:${PORT}`);
  console.log(`🔗 Stream SSE: http://localhost:${PORT}/api/bridge/events`);
  console.log(`==================================================\n`);
});
