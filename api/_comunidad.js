// Comunidad ARKAIOS EDU: materiales compartidos guardados en la nube ARKAIOS (Google Drive).
// Drive es a la vez almacén de archivos y base de datos (appProperties). Cada usuario se
// identifica con su cuenta Firebase (Google); los materiales publicados son visibles para todos.
const DRIVE = "https://www.googleapis.com/drive/v3";
const UPLOAD = "https://www.googleapis.com/upload/drive/v3/files";
const FOLDERS = {
  materiales: process.env.EDU_DRIVE_MATERIALES_ID || "1c7jBFCh1LDW6xGxb2eeKvjuSZ45o3yxx",
  miniaturas: process.env.EDU_DRIVE_MINIATURAS_ID || "1y2Z4ocaRHyOrSTmY8UWoENgxu2OpLfge",
  usuarios: process.env.EDU_DRIVE_USUARIOS_ID || "1ZP_7003XU4x4SxUn7iwXCUKPcKrB5p2a"
};
// Public web key of the arkaios-world Firebase project (already shipped in login.html).
const FIREBASE_WEB_KEY = process.env.EDU_FIREBASE_WEB_KEY || "AIzaSyD-ceCiJPVnLlepVBcMBhLABJEC771uypM";
const ADMIN_EMAILS = (process.env.EDU_ADMIN_EMAILS || "djklmr2024@gmail.com,arkaios2026@gmail.com")
  .split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);

const MAX_DATA_BYTES = 3_500_000;
const MAX_THUMB_BYTES = 700_000;
const PAGE_SIZE = 30;
const PUBLISH_LIMIT_PER_HOUR = 20;
const MAT_FIELDS = "id,name,description,appProperties,createdTime,parents";

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

// ---------- Google Drive (OAuth de la cuenta dueña de la nube) ----------
let cachedToken = { value: "", expiresAt: 0 };

async function driveToken() {
  if (cachedToken.value && Date.now() < cachedToken.expiresAt - 60_000) return cachedToken.value;
  const { EDU_DRIVE_CLIENT_ID, EDU_DRIVE_CLIENT_SECRET, EDU_DRIVE_REFRESH_TOKEN } = process.env;
  if (!EDU_DRIVE_CLIENT_ID || !EDU_DRIVE_CLIENT_SECRET || !EDU_DRIVE_REFRESH_TOKEN) {
    throw new HttpError(503, "La nube ARKAIOS no está configurada en el servidor.");
  }
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: EDU_DRIVE_CLIENT_ID,
      client_secret: EDU_DRIVE_CLIENT_SECRET,
      refresh_token: EDU_DRIVE_REFRESH_TOKEN,
      grant_type: "refresh_token"
    })
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) throw new HttpError(502, "No se pudo conectar con la nube ARKAIOS.");
  cachedToken = { value: j.access_token, expiresAt: Date.now() + (j.expires_in || 3600) * 1000 };
  return cachedToken.value;
}

async function drive(path, { method = "GET", body, raw = false } = {}) {
  const headers = { Authorization: `Bearer ${await driveToken()}` };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const r = await fetch(`${DRIVE}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  if (raw) return r;
  const j = await r.json().catch(() => ({}));
  if (r.status === 404) throw new HttpError(404, "Material no encontrado.");
  if (!r.ok) throw new HttpError(502, `Error de la nube (${r.status}).`);
  return j;
}

async function uploadFile({ name, parent, mimeType, buffer, appProperties, description }) {
  const boundary = `ark${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
  const meta = { name, parents: [parent], mimeType, ...(appProperties ? { appProperties } : {}), ...(description ? { description } : {}) };
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`),
    buffer,
    Buffer.from(`\r\n--${boundary}--`)
  ]);
  const r = await fetch(`${UPLOAD}?uploadType=multipart&fields=${MAT_FIELDS}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${await driveToken()}`, "Content-Type": `multipart/related; boundary=${boundary}` },
    body
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new HttpError(502, `No se pudo guardar en la nube (${r.status}).`);
  return j;
}

async function replaceContent(fileId, buffer, mimeType) {
  const r = await fetch(`${UPLOAD}/${fileId}?uploadType=media`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${await driveToken()}`, "Content-Type": mimeType },
    body: buffer
  });
  if (!r.ok) throw new HttpError(502, "No se pudo actualizar la nube.");
}

const quote = (s) => `'${String(s).replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;

// ---------- Usuarios (Firebase Auth, validado por Google) ----------
async function requireUser(req) {
  const m = /^Bearer\s+(.+)$/i.exec(String(req.headers.authorization || ""));
  if (!m) throw new HttpError(401, "Inicia sesión con tu cuenta para continuar.");
  const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_WEB_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken: m[1] })
  });
  const j = await r.json().catch(() => ({}));
  const u = j.users?.[0];
  if (!r.ok || !u?.localId) throw new HttpError(401, "Tu sesión expiró. Vuelve a iniciar sesión.");
  const email = String(u.email || "").toLowerCase();
  return { uid: u.localId, email, name: u.displayName || email.split("@")[0] || "Usuario", isAdmin: ADMIN_EMAILS.includes(email) };
}

const publishLog = new Map();
function checkPublishRate(uid) {
  const hourAgo = Date.now() - 3_600_000;
  const recent = (publishLog.get(uid) || []).filter((t) => t > hourAgo);
  if (recent.length >= PUBLISH_LIMIT_PER_HOUR) throw new HttpError(429, "Has publicado mucho en la última hora. Intenta más tarde.");
  publishLog.set(uid, [...recent, Date.now()]);
}

async function userFile(uid) {
  const q = encodeURIComponent(`name=${quote(`user_${uid}.json`)} and ${quote(FOLDERS.usuarios)} in parents and trashed=false`);
  const l = await drive(`/files?q=${q}&fields=files(id)&pageSize=1`);
  return l.files?.[0]?.id || null;
}

async function readSaved(uid) {
  const id = await userFile(uid);
  if (!id) return { fileId: null, saved: [] };
  const r = await drive(`/files/${id}?alt=media`, { raw: true });
  const j = r.ok ? await r.json().catch(() => ({})) : {};
  return { fileId: id, saved: Array.isArray(j.saved) ? j.saved.filter((s) => typeof s === "string") : [] };
}

async function writeSaved(uid, fileId, saved) {
  const buffer = Buffer.from(JSON.stringify({ uid, saved, updatedAt: new Date().toISOString() }));
  if (fileId) return replaceContent(fileId, buffer, "application/json");
  return uploadFile({ name: `user_${uid}.json`, parent: FOLDERS.usuarios, mimeType: "application/json", buffer });
}

// ---------- Materiales ----------
function toCard(f) {
  const p = f.appProperties || {};
  return {
    id: f.id,
    title: f.name.replace(/\.json$/i, ""),
    description: f.description || "",
    template: p.tpl || "",
    tags: p.tags ? p.tags.split(",").filter(Boolean) : [],
    ownerUid: p.owner || "",
    ownerName: p.ownerName || "Comunidad",
    thumbId: p.thumb || "",
    saves: Number(p.saves) || 0,
    createdTime: f.createdTime
  };
}

async function getMaterialMeta(id) {
  if (!/^[\w-]{10,80}$/.test(id)) throw new HttpError(400, "Identificador inválido.");
  const f = await drive(`/files/${id}?fields=${MAT_FIELDS},trashed`);
  if (f.trashed || !f.parents?.includes(FOLDERS.materiales) || f.appProperties?.k !== "edu_mat") {
    throw new HttpError(404, "Material no encontrado.");
  }
  return f;
}

async function listMaterials(query, user) {
  const parts = [`${quote(FOLDERS.materiales)} in parents`, "trashed=false", "appProperties has { key='k' and value='edu_mat' }"];
  const text = String(query.q || "").trim().slice(0, 80);
  if (text) parts.push(`(name contains ${quote(text)} or fullText contains ${quote(text)})`);
  if (query.tpl && /^[\w.-]+\.html$/.test(query.tpl)) parts.push(`appProperties has { key='tpl' and value=${quote(query.tpl)} }`);
  if (query.owner === "me") {
    if (!user) throw new HttpError(401, "Inicia sesión para ver tus materiales.");
    parts.push(`appProperties has { key='owner' and value=${quote(user.uid)} }`);
  }
  const pageToken = /^[\w.~-]{1,600}$/.test(String(query.pageToken || "")) ? `&pageToken=${query.pageToken}` : "";
  const orderBy = text ? "" : "&orderBy=createdTime desc";
  const l = await drive(`/files?q=${encodeURIComponent(parts.join(" and "))}&fields=nextPageToken,files(${MAT_FIELDS})&pageSize=${PAGE_SIZE}${orderBy}${pageToken}`);
  return { items: (l.files || []).map(toCard), nextPageToken: l.nextPageToken || null };
}

async function listSaved(user) {
  const { saved } = await readSaved(user.uid);
  const metas = await Promise.all(saved.slice(-60).reverse().map((id) => getMaterialMeta(id).then(toCard).catch(() => null)));
  return { items: metas.filter(Boolean), nextPageToken: null };
}

function cleanText(v, max) {
  return String(v || "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max);
}

function fitAppProp(key, value) {
  let v = value;
  while (Buffer.byteLength(key + v, "utf8") > 120) v = v.slice(0, -1);
  return v;
}

function decodeThumb(dataUrl) {
  const m = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl || ""));
  if (!m) return null;
  const buffer = Buffer.from(m[2], "base64");
  if (buffer.length > MAX_THUMB_BYTES) throw new HttpError(413, "La vista previa es demasiado grande.");
  return { buffer, mimeType: `image/${m[1]}` };
}

async function publish(body, user) {
  const title = cleanText(body.title, 120);
  const description = cleanText(body.description, 1000);
  const template = String(body.template || "");
  if (!title) throw new HttpError(400, "Escribe un título.");
  if (!/^[\w.-]+\.html$/.test(template)) throw new HttpError(400, "Plantilla inválida.");
  const tags = (Array.isArray(body.tags) ? body.tags : [])
    .map((t) => cleanText(t, 24).toLowerCase().replace(/[,]/g, "")).filter(Boolean).slice(0, 8);
  const dataBuffer = Buffer.from(JSON.stringify({ template, data: body.data ?? null }));
  if (dataBuffer.length > MAX_DATA_BYTES) throw new HttpError(413, "El material es demasiado grande (máx. 3.5 MB). Reduce imágenes.");
  checkPublishRate(user.uid);

  const thumb = decodeThumb(body.thumbnail);
  let thumbId = "";
  if (thumb) {
    const ext = thumb.mimeType.split("/")[1];
    const t = await uploadFile({ name: `thumb_${Date.now()}.${ext}`, parent: FOLDERS.miniaturas, mimeType: thumb.mimeType, buffer: thumb.buffer });
    thumbId = t.id;
  }
  const f = await uploadFile({
    name: `${title}.json`,
    parent: FOLDERS.materiales,
    mimeType: "application/json",
    buffer: dataBuffer,
    description,
    appProperties: {
      k: "edu_mat",
      tpl: template,
      owner: user.uid,
      ownerName: fitAppProp("ownerName", user.name),
      tags: fitAppProp("tags", tags.join(",")),
      thumb: thumbId,
      saves: "0"
    }
  });
  return { item: toCard(f) };
}

async function toggleSave(body, user) {
  const id = String(body.id || "");
  const want = body.saved !== false;
  const f = await getMaterialMeta(id);
  const { fileId, saved } = await readSaved(user.uid);
  const has = saved.includes(id);
  if (has === want) return { saved: want, saves: Number(f.appProperties.saves) || 0 };
  const next = want ? [...saved, id].slice(-500) : saved.filter((s) => s !== id);
  await writeSaved(user.uid, fileId, next);
  const saves = Math.max(0, (Number(f.appProperties.saves) || 0) + (want ? 1 : -1));
  await drive(`/files/${id}?fields=id`, { method: "PATCH", body: { appProperties: { saves: String(saves) } } });
  return { saved: want, saves };
}

async function removeMaterial(body, user) {
  const f = await getMaterialMeta(String(body.id || ""));
  if (f.appProperties.owner !== user.uid && !user.isAdmin) throw new HttpError(403, "Solo quien lo publicó puede borrarlo.");
  await drive(`/files/${f.id}?fields=id`, { method: "PATCH", body: { trashed: true } });
  if (f.appProperties.thumb) await drive(`/files/${f.appProperties.thumb}?fields=id`, { method: "PATCH", body: { trashed: true } }).catch(() => null);
  return { deleted: f.id };
}

async function streamThumb(id, res) {
  if (!/^[\w-]{10,80}$/.test(id)) throw new HttpError(400, "Identificador inválido.");
  const f = await drive(`/files/${id}?fields=parents,mimeType,trashed`);
  if (f.trashed || !f.parents?.includes(FOLDERS.miniaturas) || !/^image\//.test(f.mimeType)) throw new HttpError(404, "Imagen no encontrada.");
  const r = await drive(`/files/${id}?alt=media`, { raw: true });
  if (!r.ok) throw new HttpError(502, "No se pudo leer la imagen.");
  res.setHeader("Content-Type", f.mimeType);
  res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  return res.status(200).send(Buffer.from(await r.arrayBuffer()));
}

async function getMaterial(id) {
  const f = await getMaterialMeta(id);
  const r = await drive(`/files/${f.id}?alt=media`, { raw: true });
  const content = r.ok ? await r.json().catch(() => ({})) : {};
  return { item: toCard(f), data: content.data ?? null };
}

export default async function handler(req, res) {
  const action = String(req.query?.action || "list");
  try {
    if (req.method === "GET") {
      if (action === "thumb") return await streamThumb(String(req.query.id || ""), res);
      res.setHeader("Cache-Control", "no-store");
      if (action === "get") return res.status(200).json({ ok: true, ...(await getMaterial(String(req.query.id || ""))) });
      if (action === "me") {
        const user = await requireUser(req);
        return res.status(200).json({ ok: true, user: { uid: user.uid, name: user.name, isAdmin: user.isAdmin }, saved: (await readSaved(user.uid)).saved });
      }
      if (action === "saved") return res.status(200).json({ ok: true, ...(await listSaved(await requireUser(req))) });
      const user = req.query.owner === "me" ? await requireUser(req) : null;
      return res.status(200).json({ ok: true, ...(await listMaterials(req.query, user)) });
    }
    if (req.method === "POST") {
      res.setHeader("Cache-Control", "no-store");
      const user = await requireUser(req);
      const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
      if (action === "publish") return res.status(200).json({ ok: true, ...(await publish(body, user)) });
      if (action === "save") return res.status(200).json({ ok: true, ...(await toggleSave(body, user)) });
      if (action === "delete") return res.status(200).json({ ok: true, ...(await removeMaterial(body, user)) });
    }
    return res.status(405).json({ ok: false, error: "Acción no permitida." });
  } catch (err) {
    const status = err instanceof HttpError ? err.status : 500;
    if (status >= 500) console.error("[comunidad]", err);
    return res.status(status).json({ ok: false, error: err instanceof HttpError ? err.message : "Error interno de la Comunidad." });
  }
}
