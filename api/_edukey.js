// Llave personal ARKAIOS EDU (aek_...) que cada usuario le da a su IA o agente
// para que trabaje en el ecosistema a su nombre.
// Formato: aek_<payload base64url>.<firma HMAC-SHA256>. El servidor la verifica sin base de datos;
// rotar ARKAIOS_EDU_KEY_SECRET invalida todas las llaves emitidas.
import crypto from "node:crypto";

const PREFIX = "aek_";
const KEY_VERSION = 1;
const SIG_LEN = 32;
const KEY_RE = /^aek_([A-Za-z0-9_-]{8,400})\.([A-Za-z0-9_-]{32})$/;

const b64url = (buf) => Buffer.from(buf).toString("base64url");

function secret() {
  return process.env.ARKAIOS_EDU_KEY_SECRET || "";
}

function sign(payload, key) {
  return b64url(crypto.createHmac("sha256", key).update(payload).digest()).slice(0, SIG_LEN);
}

export function isUserKeyFormat(value) {
  return typeof value === "string" && value.startsWith(PREFIX);
}

export function issueUserKey({ uid, name }) {
  const key = secret();
  if (!key) throw new Error("ARKAIOS_EDU_KEY_SECRET no está configurada.");
  const payload = b64url(JSON.stringify({ u: uid, n: String(name || "").slice(0, 40), v: KEY_VERSION }));
  return `${PREFIX}${payload}.${sign(payload, key)}`;
}

// Devuelve { uid, name } si la llave es auténtica; null en cualquier otro caso.
export function verifyUserKey(value) {
  const key = secret();
  const m = KEY_RE.exec(String(value || "").trim());
  if (!key || !m) return null;
  const expected = Buffer.from(sign(m[1], key));
  const given = Buffer.from(m[2]);
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) return null;
  try {
    const data = JSON.parse(Buffer.from(m[1], "base64url").toString("utf8"));
    if (data.v !== KEY_VERSION || typeof data.u !== "string" || !data.u) return null;
    return { uid: data.u, name: String(data.n || "") };
  } catch {
    return null;
  }
}
