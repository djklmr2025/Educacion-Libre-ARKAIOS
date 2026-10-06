import { createHash } from "node:crypto";

// Banco de imágenes de la plantilla de frutas.
// Las imágenes se guardan como archivos en el repositorio (biblioteca/frutas/img)
// y un índice (biblioteca/frutas/index.json) dice a qué fruta pertenece cada una.
// Así persisten aunque el navegador borre su caché.

const OWNER = "djklmr2025";
const REPO = "Eduacion-Libre-Proyecto-ARKAIOS";
const BRANCH = process.env.ARKAIOS_BANK_BRANCH || "MAIN";
const DIR = "biblioteca/frutas";
const IDX = `${DIR}/index.json`;
const MAX_BYTES = 700_000; // la API de contenidos de GitHub lee archivos de hasta 1 MB
const MAX_PER_KEY = 12;
const MAX_KEYS = 300;
const FILE_RE = /^[a-z0-9-]{1,40}-[a-f0-9]{10}\.(png|jpg|webp)$/;

const api = (p) =>
  `https://api.github.com/repos/${OWNER}/${REPO}/contents/${p.split("/").map(encodeURIComponent).join("/")}`;

function headers(extra = {}) {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error("Missing GITHUB_TOKEN in environment variables");
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "User-Agent": "ARKAIOS-Vercel",
    "X-GitHub-Api-Version": "2022-11-28",
    ...extra
  };
}

async function getFile(path) {
  const r = await fetch(`${api(path)}?ref=${encodeURIComponent(BRANCH)}`, { headers: headers() });
  if (r.status === 404) return null;
  if (!r.ok) throw Object.assign(new Error(`GitHub ${r.status}`), { status: r.status });
  return r.json();
}

async function putFile(path, buf, message, sha) {
  const r = await fetch(api(path), {
    method: "PUT",
    headers: headers({ "Content-Type": "application/json" }),
    body: JSON.stringify({ message, content: buf.toString("base64"), branch: BRANCH, ...(sha ? { sha } : {}) })
  });
  if (!r.ok) throw Object.assign(new Error(`GitHub ${r.status}`), { status: r.status });
  return r.json();
}

async function deleteFile(path, sha, message) {
  const r = await fetch(api(path), {
    method: "DELETE",
    headers: headers({ "Content-Type": "application/json" }),
    body: JSON.stringify({ message, sha, branch: BRANCH })
  });
  if (!r.ok && r.status !== 404) throw Object.assign(new Error(`GitHub ${r.status}`), { status: r.status });
}

async function readIndex() {
  const f = await getFile(IDX);
  if (!f) return { data: { items: {} }, sha: null };
  const data = JSON.parse(Buffer.from(f.content, "base64").toString("utf8"));
  data.items = data.items || {};
  return { data, sha: f.sha };
}

// Actualiza el índice con reintentos si otra escritura llegó al mismo tiempo.
async function updateIndex(mutate, message) {
  for (let i = 0; i < 4; i++) {
    const { data, sha } = await readIndex();
    if (mutate(data) === false) return data;
    try {
      await putFile(IDX, Buffer.from(JSON.stringify(data, null, 2), "utf8"), message, sha);
      return data;
    } catch (e) {
      if (e.status !== 409 && e.status !== 422) throw e;
    }
  }
  throw new Error("No se pudo actualizar el índice, intenta de nuevo");
}

const cleanKey = (s) =>
  String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);

function authorized(req) {
  const need = process.env.ARKAIOS_SAVE_KEY;
  return !need || req.headers["x-arkaios-key"] === need;
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(204).end();

  try {
    if (req.method === "GET") {
      const img = req.query?.img;
      if (img) {
        if (!FILE_RE.test(img)) return res.status(400).json({ ok: false, error: "Nombre de imagen no válido" });
        const f = await getFile(`${DIR}/img/${img}`);
        if (!f) return res.status(404).json({ ok: false, error: "No existe" });
        const ext = img.split(".").pop();
        res.setHeader("Content-Type", ext === "jpg" ? "image/jpeg" : `image/${ext}`);
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        return res.status(200).send(Buffer.from(f.content, "base64"));
      }
      const { data } = await readIndex();
      res.setHeader("Cache-Control", "no-store");
      return res.status(200).json({ ok: true, items: data.items });
    }

    if (req.method === "POST" || req.method === "DELETE") {
      if (!authorized(req)) return res.status(401).json({ ok: false, error: "Unauthorized" });
    }

    if (req.method === "POST") {
      const key = cleanKey(req.body?.key);
      const m = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(String(req.body?.dataUrl || ""));
      if (!key || !m) return res.status(400).json({ ok: false, error: "Faltan key o dataUrl (png, jpeg o webp)" });
      const buf = Buffer.from(m[2], "base64");
      if (buf.length > MAX_BYTES) return res.status(413).json({ ok: false, error: "Imagen demasiado grande (máx. 700 KB)" });

      const ext = m[1] === "jpeg" ? "jpg" : m[1];
      const hash = createHash("sha256").update(buf).digest("hex").slice(0, 10);
      const file = `${key}-${hash}.${ext}`;

      const { data } = await readIndex();
      if ((data.items[key] || []).includes(file)) return res.status(200).json({ ok: true, key, file, existed: true });
      if (!data.items[key] && Object.keys(data.items).length >= MAX_KEYS)
        return res.status(409).json({ ok: false, error: "El banco alcanzó el máximo de frutas" });
      if ((data.items[key] || []).length >= MAX_PER_KEY)
        return res.status(409).json({ ok: false, error: `Máximo ${MAX_PER_KEY} versiones por fruta` });

      const path = `${DIR}/img/${file}`;
      const existing = await getFile(path);
      if (!existing) await putFile(path, buf, `banco-frutas: agregar ${file}`);
      await updateIndex((d) => {
        d.items[key] = d.items[key] || [];
        if (d.items[key].includes(file)) return false;
        d.items[key].push(file);
      }, `banco-frutas: indexar ${file}`);
      return res.status(200).json({ ok: true, key, file });
    }

    if (req.method === "DELETE") {
      const img = req.query?.img;
      if (!img || !FILE_RE.test(img)) return res.status(400).json({ ok: false, error: "Nombre de imagen no válido" });
      await updateIndex((d) => {
        let found = false;
        for (const k of Object.keys(d.items)) {
          const n = d.items[k].filter((f) => f !== img);
          if (n.length !== d.items[k].length) found = true;
          if (n.length) d.items[k] = n;
          else delete d.items[k];
        }
        return found ? undefined : false;
      }, `banco-frutas: quitar ${img} del índice`);
      const f = await getFile(`${DIR}/img/${img}`);
      if (f) await deleteFile(`${DIR}/img/${img}`, f.sha, `banco-frutas: borrar ${img}`);
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ ok: false, error: "Method not allowed" });
  } catch (err) {
    console.error(err);
    return res.status(err.status && err.status >= 400 && err.status < 600 ? 502 : 500).json({
      ok: false,
      error: err?.message || "Server error"
    });
  }
}
