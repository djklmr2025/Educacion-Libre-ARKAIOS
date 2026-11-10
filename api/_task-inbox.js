// api/_task-inbox.js
// Buzón de Tareas de ARKAIOS World para Solicitudes de Plantillas de Educación Libre

let taskQueue = [
  {
    id: "task_edu_001",
    title: "Control semanal de tareas con firmas para Primaria",
    grade: "primaria",
    author: "Prof. Mateo Morales",
    narration: "Plantilla en hoja horizontal tamaño carta con tabla de lunes a viernes, casillas de verificación para tareas entregadas, firmas de padre/tutor y observaciones del docente. Con exportación a PDF para impresión semanal.",
    file: null,
    status: "pending_review",
    assignedTo: "Claude AI",
    source: "Educación Libre - ARKAIOS",
    createdAt: new Date(Date.now() - 3600000).toISOString()
  }
];

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // GET: Listar todas las tareas del buzón de Arkaios World
  if (req.method === "GET") {
    return res.status(200).json({
      ok: true,
      service: "ARKAIOS World - Buzón de Tareas de Plantillas",
      count: taskQueue.length,
      tasks: taskQueue,
      meta: {
        destination: "Claude AI / Arkaios World Ecosystem",
        feedUrl: "https://educacion-libre-arkaios.vercel.app/api/task-inbox"
      }
    });
  }

  // POST: Registrar una nueva solicitud en el buzón
  if (req.method === "POST") {
    try {
      const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
      const { title, grade, author, narration, file } = body;

      if (!title || !narration) {
        return res.status(400).json({ ok: false, error: "Título y narración requeridos" });
      }

      const newTask = {
        id: `task_edu_${Date.now()}`,
        title: String(title).trim(),
        grade: String(grade || "general").trim(),
        author: String(author || "Comunidad Escolar").trim(),
        narration: String(narration).trim(),
        file: file || null,
        status: "queued_for_claude",
        assignedTo: "Claude AI",
        source: "Educación Libre - ARKAIOS",
        createdAt: new Date().toISOString()
      };

      taskQueue.unshift(newTask);

      return res.status(201).json({
        ok: true,
        message: "Tarea registrada en el Buzón de Arkaios World con éxito",
        task: newTask
      });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
