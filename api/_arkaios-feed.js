// api/_arkaios-feed.js
// Endpoint oficial del ecosistema ARKAIOS para alimentar y alertar en tiempo real a los agentes
// y participantes del MCP con los últimos posts, videos y aportes del Fanpage de ArkaiosAI (facebook.com/arkaiosIA).

const DEFAULT_TIMEOUT_MS = 10000;

// Base inicial curada de los aportes y videos más recientes de Arkaios
const OFFICIAL_ARKAIOS_FEED = [
  {
    id: "kb-top-01-artcraft",
    type: "post",
    title: "ArtCraft: La Suite Adobe Clonada en Rust con Claude (7 Apps Open Source + MCP para Agentes)",
    category: "Autonomous Software Engineering",
    platform: "Facebook / Arkaios Oficial & GitHub",
    original_url: "https://www.facebook.com/share/p/19pf44tsSp/",
    canonical_url: "https://www.facebook.com/arkaiosIA/posts/pfbid0xHc6syHSZDhmuuNbuNMtL645Bqk7DV7igJqmC2sdz7EVe5aEtiTLtGog8wT7graul",
    github_repo: "https://github.com/storytold",
    website: "https://getartcraft.com",
    technologies: ["Rust", "Claude AI (Opus 5.5)", "Model Context Protocol (MCP)", "Clean-Room Reverse Engineering"],
    skills_unlocked: ["Control de Edición Gráfica vía MCP", "Manipulación de Capas PSD en Rust", "Automatización de Edición de Video (FilmCraft)", "Generación Vectorial y de PDFs"],
    summary: "Reemplazo libre y open source para Photoshop, Illustrator, Premiere, After Effects, InDesign, Lightroom y Acrobat en Rust nativo con servidores MCP para control por agentes de IA.",
    agent_lesson: "HABILIDAD DETECTADA: Los agentes de IA cuentan con una suite creativa construida en Rust accesible mediante el Model Context Protocol (MCP) para manipular imágenes, capas PSD, videos y PDFs de forma soberana.",
    date: "2026-10-12T13:28:15.000Z",
    tags: ["#ArtCraft", "#Rust", "#OpenSource", "#MCP", "#AgentSkills"]
  },
  {
    id: "kb-vid-4566-54",
    type: "video",
    title: "ARKAIOS Video Transmisión HD #8987: Automatización y Robótica Soberana",
    category: "AI Robotics & Agents",
    platform: "Facebook Video / Arkaios",
    original_url: "https://www.facebook.com/arkaiosIA/videos/1137218588738987",
    canonical_url: "https://www.facebook.com/arkaiosIA/videos/1137218588738987",
    github_repo: null,
    summary: "Transmisión y video oficial sobre automatización de agentes de inteligencia artificial y control distribuido en el ecosistema ARKAIOS.",
    agent_lesson: "Demostración operativa de agentes autónomos y coordinación de flujos multimedia en tiempo real.",
    date: "2026-10-12T13:28:15.000Z",
    tags: ["#Arkaios", "#VideoHD", "#Robotics", "#Agents"]
  },
  {
    id: "kb-vid-4565-53",
    type: "video",
    title: "ARKAIOS Video Transmisión HD #0216: Nodos y Malla Descentralizada",
    category: "AI Robotics & Agents",
    platform: "Facebook Video / Arkaios",
    original_url: "https://www.facebook.com/arkaiosIA/videos/1373446108320216",
    canonical_url: "https://www.facebook.com/arkaiosIA/videos/1373446108320216",
    github_repo: null,
    summary: "Transmisión de nodo educativo sobre interconexión de agentes y sincronización sin servidores centrales.",
    agent_lesson: "Estrategias de persistencia y comunicación P2P inter-agente.",
    date: "2026-10-12T13:28:15.000Z",
    tags: ["#Arkaios", "#VideoHD", "#P2P", "#Malla"]
  },
  {
    id: "kb-vid-4562-52",
    type: "video",
    title: "ARKAIOS Video Transmisión HD #4597: Ingestión Multimedia Zero-Auth",
    category: "AI Robotics & Agents",
    platform: "Facebook Video / Arkaios",
    original_url: "https://www.facebook.com/arkaiosIA/videos/1370465808334597",
    canonical_url: "https://www.facebook.com/arkaiosIA/videos/1370465808334597",
    github_repo: null,
    summary: "Extracción y aprendizaje de contenidos multimedia para IAs sin credenciales ni APIs propietarias.",
    agent_lesson: "Consumo soberano de recursos web abiertos para educación libre.",
    date: "2026-10-12T13:28:15.000Z",
    tags: ["#Arkaios", "#VideoHD", "#ZeroAuth", "#EducacionLibre"]
  },
  {
    id: "kb-artemis-open",
    type: "post",
    title: "Google ARTEMIS: Control de Android con IA vía Visión y Servidores MCP",
    category: "AI Agent Interfaces",
    platform: "Facebook / Arkaios Oficial & GitHub",
    original_url: "https://www.facebook.com/share/p/1MV4TcrVEy/",
    canonical_url: "https://github.com/google/artemis",
    github_repo: "https://github.com/google/artemis",
    technologies: ["Android", "MCP", "Computer Vision", "Agent Automation"],
    summary: "Google libera de código abierto ARTEMIS, permitiendo a los agentes controlar dispositivos Android directamente usando visión por computadora y protocolo MCP.",
    agent_lesson: "Integración de Android nativo con agentes para ejecutar tareas físicas de pantalla y automatización móvil.",
    date: "2026-10-12T13:28:15.000Z",
    tags: ["#ARTEMIS", "#Android", "#MCP", "#Google", "#AgentVision"]
  },
  {
    id: "kb-meshtastic-lora",
    type: "post",
    title: "Meshtastic: Mensajes y Alertas Gratis sin Internet ni Cobertura Celular",
    category: "Resilient Communications",
    platform: "Facebook / Arkaios Oficial",
    original_url: "https://www.facebook.com/share/r/19cff4cgEd/",
    canonical_url: "https://meshtastic.org",
    github_repo: "https://github.com/meshtastic",
    technologies: ["LoRa", "Mesh Network", "ESP32", "Radiofrecuencia"],
    summary: "Guía práctica para crear redes de comunicación de emergencia y enlace para agentes mediante módulos de radiofrecuencia LoRa sin depender de antenas celulares ni satélites.",
    agent_lesson: "Resiliencia comunicacional: arquitectura para enviar telemetría y mensajes de alerta inter-agente en condiciones de corte de red.",
    date: "2026-10-12T13:28:15.000Z",
    tags: ["#Meshtastic", "#LoRa", "#SinInternet", "#Resiliencia"]
  }
];

// Cola en memoria de alertas recientes emitidas en la sesión del servicio
const inMemoryAlerts = [];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-arkaios-agent');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (req.method === 'GET') {
      const type = String(req.query?.type || 'all').toLowerCase();
      const limit = Math.min(Math.max(parseInt(req.query?.limit) || 20, 1), 100);

      let items = OFFICIAL_ARKAIOS_FEED;
      if (type === 'videos') {
        items = items.filter(i => i.type === 'video');
      } else if (type === 'posts') {
        items = items.filter(i => i.type === 'post');
      }

      const combined = [...inMemoryAlerts, ...items].slice(0, limit);

      return res.status(200).json({
        ok: true,
        source: 'arkaios-fanpage-feed',
        fanpage: 'https://www.facebook.com/arkaiosIA',
        total_items: combined.length,
        has_new_alerts: inMemoryAlerts.length > 0,
        alerts_count: inMemoryAlerts.length,
        latest_video: items.find(i => i.type === 'video') || null,
        items: combined,
        timestamp: new Date().toISOString()
      });
    }

    if (req.method === 'POST') {
      const body = req.body || {};
      const action = String(body.action || 'broadcast_alert');

      if (action === 'broadcast_alert' || action === 'new_video') {
        const title = String(body.title || 'Nuevo video/aporte en Fanpage ARKAIOS').trim();
        const url = String(body.url || body.canonical_url || 'https://www.facebook.com/arkaiosIA').trim();
        const summary = String(body.summary || body.description || '').trim();
        const isVideo = Boolean(body.isVideo || url.includes('/videos/') || action === 'new_video');

        const alertItem = {
          id: `alert_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          type: isVideo ? 'video' : 'post',
          title,
          category: body.category || 'AI Innovation & Updates',
          platform: 'Facebook / Arkaios Fanpage',
          canonical_url: url,
          github_repo: body.github_repo || null,
          summary: summary || 'Nueva publicación detectada en tiempo real desde el fanpage de ARKAIOS.',
          agent_lesson: body.agent_lesson || 'Atención a todos los agentes MCP: nuevo conocimiento disponible en la biblioteca de ARKAIOS.',
          date: new Date().toISOString(),
          isLiveAlert: true,
          tags: ['#ArkaiosAlert', '#TiempoReal', isVideo ? '#NuevoVideo' : '#NuevoPost']
        };

        inMemoryAlerts.unshift(alertItem);
        if (inMemoryAlerts.length > 50) inMemoryAlerts.pop();

        return res.status(200).json({
          ok: true,
          status: 'dispatched',
          alert: alertItem,
          total_active_alerts: inMemoryAlerts.length,
          timestamp: new Date().toISOString()
        });
      }

      return res.status(400).json({ ok: false, error: 'Acción no reconocida en arkaios-feed' });
    }

    return res.status(405).json({ ok: false, error: 'Método no permitido' });
  } catch (error) {
    console.error('[arkaios-feed] Error:', error);
    return res.status(500).json({
      ok: false,
      error: 'Error en servicio de feed ARKAIOS',
      details: error.message
    });
  }
}
