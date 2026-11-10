// api/_task-inbox.js — Buzón de solicitudes de plantillas («Pide tu plantilla»).
// Cada solicitud se guarda en la nube ARKAIOS (Drive): un JSON por solicitud y, si trae
// referencia, el archivo al lado. Cualquiera puede enviar (con límites); solo agentes con
// llave arkedu_ag_ o un admin humano pueden leer, porque incluye nombres de docentes.
import crypto from "node:crypto";
import { HttpError, drive, uploadFile, requireUser, quote } from "./_comunidad.js";

const ROOT_FOLDER = process.env.EDU_DRIVE_ROOT_ID || "1AQgkY6FwgkDA3kgROwgX9YdwIMx-Jo6G";
const REQ_FOLDER_NAME = "solicitudes";
const MAX_TITLE = 120;
const MAX_AUTHOR = 60;
const MAX_NARRATION = 4000;
const MAX_FILE_BYTES = 2_800_000; // cuerpo de Vercel ≤ 4.5 MB y el base64 crece ~33 %
const PER_IP_PER_HOUR = 5;
const GLOBAL_PER_HOUR = 60;
const LIST_LIMIT = 100;
const GRADES = ["preescolar", "primaria", "secundaria", "preparatoria", "universidad", "docente", "adultos", "general"];
const FILE_TYPES = [
  { type: "application/pdf", ext: "pdf", ok: (b) => b.subarray(0, 5).toString("latin1") === "%PDF-" },
  { type: "image/png", ext: "png", ok: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { type: "image/jpeg", ext: "jpg", ok: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { type: "image/webp", ext: "webp", ok: (b) => b.subarray(0, 4).toString("latin1") === "RIFF" && b.subarray(8, 12).toString("latin1") === "WEBP" }
];
const FILE_FIELDS = "id,name,createdTime,appProperties";

let folderCache = "";
const ipLog = new Map();

function text(value, max) {
  return String(value ?? "")
    .replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, max);
}

async function requestsFolder() {
  if (process.env.EDU_DRIVE_SOLICITUDES_ID) return process.env.EDU_DRIVE_SOLICITUDES_ID;
  if (folderCache) return folderCache;
  const q = encodeURIComponent(`name=${quote(REQ_FOLDER_NAME)} and ${quote(ROOT_FOLDER)} in parents and ` +
    "mimeType='application/vnd.google-apps.folder' and trashed=false");
  const found = await drive(`/files?q=${q}&fields=files(id)&pageSize=1`);
  folderCache = found.files?.[0]?.id ||
    (await drive("/files?fields=id", { method: "POST", body: {
      name: REQ_FOLDER_NAME, parents: [ROOT_FOLDER], mimeType: "application/vnd.google-apps.folder" } })).id;
  return folderCache;
}

function clientIp(req) {
  return String(req.headers["x-real-ip"] || req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "anon";
}

function checkIpRate(ip) {
  const hourAgo = Date.now() - 3_600_000;
  const recent = (ipLog.get(ip) || []).filter((t) => t > hourAgo);
  if (recent.length >= PER_IP_PER_HOUR) throw new HttpError(429, "Ya enviaste varias solicitudes en la última hora. Intenta más tarde.");
  ipLog.set(ip, [...recent, Date.now()]);
}

async function checkGlobalRate(folder) {
  const since = new Date(Date.now() - 3_600_000).toISOString();
  const q = encodeURIComponent(`${quote(folder)} in parents and trashed=false and ` +
    `appProperties has { key='k' and value='edu_req' } and createdTime > ${quote(since)}`);
  const recent = await drive(`/files?q=${q}&fields=files(id)&pageSize=${GLOBAL_PER_HOUR}`);
  if ((recent.files || []).length >= GLOBAL_PER_HOUR) {
    throw new HttpError(429, "El buzón recibió muchas solicitudes esta hora. Intenta más tarde.");
  }
}

function decodeFile(file) {
  if (file == null) return null;
  if (typeof file !== "object") throw new HttpError(400, "Adjunto inválido.");
  const m = /^data:([\w/+.-]+);base64,([A-Za-z0-9+/=\s]+)$/.exec(String(file.dataUrl || ""));
  if (!m) throw new HttpError(400, "El adjunto debe enviarse como dataUrl en base64.");
  const buffer = Buffer.from(m[2], "base64");
  if (!buffer.length) throw new HttpError(400, "El adjunto está vacío.");
  if (buffer.length > MAX_FILE_BYTES) throw new HttpError(413, "El adjunto pesa más de 2.8 MB. Usa una foto más ligera o comprime el PDF.");
  const kind = FILE_TYPES.find((t) => t.ok(buffer));
  if (!kind) throw new HttpError(400, "Solo se aceptan PDF, JPG, PNG o WEBP.");
  return { buffer, kind, originalName: text(file.name, 100) || `referencia.${kind.ext}` };
}

function parseRequest(body) {
  const title = text(body.title, MAX_TITLE).replace(/\n/g, " ");
  const narration = text(body.narration, MAX_NARRATION);
  if (!title || !narration) throw new HttpError(400, "Título y narración requeridos.");
  const grade = GRADES.includes(String(body.grade)) ? String(body.grade) : "general";
  const author = text(body.author, MAX_AUTHOR).replace(/\n/g, " ") || "Comunidad Escolar";
  return { title, narration, grade, author };
}

async function createRequest(req) {
  if (String(body(req).website || "")) throw new HttpError(400, "Solicitud rechazada.");
  const fields = parseRequest(body(req));
  const attachment = decodeFile(body(req).file);
  checkIpRate(clientIp(req));
  const folder = await requestsFolder();
  await checkGlobalRate(folder);
  const id = `task_edu_${Date.now()}${crypto.randomBytes(3).toString("hex")}`;
  const createdAt = new Date().toISOString();
  let file = null;
  if (attachment) {
    const stored = await uploadFile({
      name: `${id}.${attachment.kind.ext}`, parent: folder, mimeType: attachment.kind.type,
      buffer: attachment.buffer, appProperties: { k: "edu_req_file", req: id }
    });
    file = { id: stored.id, name: attachment.originalName, size: attachment.buffer.length, type: attachment.kind.type };
  }
  const task = { id, ...fields, file, status: "queued_for_claude", assignedTo: "Claude AI",
    source: "Educación Libre - ARKAIOS", createdAt };
  await uploadFile({
    name: `${id}.json`, parent: folder, mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(task, null, 1)), appProperties: { k: "edu_req", status: task.status }
  });
  return { id, createdAt };
}

function body(req) {
  if (req._parsedBody) return req._parsedBody;
  try {
    req._parsedBody = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
  } catch {
    throw new HttpError(400, "El cuerpo debe ser JSON.");
  }
  if (typeof req._parsedBody !== "object" || Array.isArray(req._parsedBody)) throw new HttpError(400, "El cuerpo debe ser un objeto JSON.");
  return req._parsedBody;
}

async function listRequests() {
  const folder = await requestsFolder();
  const q = encodeURIComponent(`${quote(folder)} in parents and trashed=false and appProperties has { key='k' and value='edu_req' }`);
  const list = await drive(`/files?q=${q}&fields=files(${FILE_FIELDS})&orderBy=createdTime desc&pageSize=${LIST_LIMIT}`);
  const tasks = await Promise.all((list.files || []).map(async (f) => {
    const r = await drive(`/files/${f.id}?alt=media`, { raw: true });
    const j = r.ok ? await r.json().catch(() => null) : null;
    if (!j?.id) return null;
    const file = j.file ? { ...j.file, url: `/api/task-inbox?action=file&id=${j.file.id}` } : null;
    return { ...j, status: f.appProperties?.status || j.status, file };
  }));
  return tasks.filter(Boolean);
}

async function streamAttachment(id, res) {
  if (!/^[\w-]{10,100}$/.test(id)) throw new HttpError(400, "id inválido.");
  const meta = await drive(`/files/${id}?fields=id,mimeType,parents,trashed,appProperties`);
  if (meta.trashed || meta.appProperties?.k !== "edu_req_file" || !meta.parents?.includes(await requestsFolder())) {
    throw new HttpError(404, "Adjunto no encontrado.");
  }
  const r = await drive(`/files/${id}?alt=media`, { raw: true });
  if (!r.ok) throw new HttpError(502, "No se pudo leer el adjunto.");
  res.setHeader("Content-Type", meta.mimeType);
  res.setHeader("Content-Disposition", "attachment");
  res.setHeader("X-Content-Type-Options", "nosniff");
  return res.status(200).send(Buffer.from(await r.arrayBuffer()));
}

async function requireReader(req) {
  const user = await requireUser(req);
  if (!user.isAgent && !user.isAdmin) throw new HttpError(403, "Solo agentes autorizados o administradores pueden leer el buzón.");
  if (user.isAgent && !String(req.headers.authorization || "").includes("arkedu_ag_")) {
    throw new HttpError(403, "Se requiere una llave de agente arkedu_ag_ emitida por un administrador.");
  }
  return user;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  try {
    if (req.method === "GET") {
      await requireReader(req);
      if (req.query?.action === "file") return await streamAttachment(String(req.query.id || ""), res);
      const tasks = await listRequests();
      return res.status(200).json({ ok: true, service: "Buzón de solicitudes de plantillas", count: tasks.length, tasks });
    }
    if (req.method === "POST") {
      const created = await createRequest(req);
      return res.status(201).json({ ok: true, message: "Solicitud registrada.", ...created });
    }
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ ok: false, error: "Método no permitido." });
  } catch (err) {
    const status = err instanceof HttpError ? err.status : 500;
    if (status >= 500) console.error("[task-inbox]", err);
    return res.status(status).json({ ok: false, error: err instanceof HttpError ? err.message : "Error interno del buzón." });
  }
}
