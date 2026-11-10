// Run: node --test tests/task-inbox.test.mjs
// Drive, OAuth and Firebase are replaced by an in-memory fake; nothing leaves the machine.
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";

process.env.EDU_DRIVE_CLIENT_ID = "test";
process.env.EDU_DRIVE_CLIENT_SECRET = "test";
process.env.EDU_DRIVE_REFRESH_TOKEN = "test";

const AGENT_KEY = "arkedu_ag_" + "a".repeat(48);
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64)]);
let files;

function json(status, body) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function parseMultipart(body) {
  const text = Buffer.from(body).toString("latin1");
  const meta = JSON.parse(text.slice(text.indexOf("{"), text.indexOf("}\r\n--") + 1));
  const start = text.indexOf("\r\n\r\n", text.indexOf("Content-Type:", text.indexOf("}\r\n--"))) + 4;
  const end = text.lastIndexOf("\r\n--");
  return { meta, content: Buffer.from(body).subarray(start, end) };
}

globalThis.fetch = async (url, init = {}) => {
  const u = new URL(url);
  if (u.hostname === "oauth2.googleapis.com") return json(200, { access_token: "t", expires_in: 3600 });
  if (u.hostname === "identitytoolkit.googleapis.com") return json(400, {});
  if (u.pathname === "/upload/drive/v3/files" && init.method === "POST") {
    const { meta, content } = parseMultipart(init.body);
    const id = "f" + crypto.randomBytes(8).toString("hex");
    files.set(id, { id, ...meta, content, createdTime: new Date().toISOString(), trashed: false });
    return json(200, { id });
  }
  const m = /^\/drive\/v3\/files(?:\/([\w-]+))?$/.exec(u.pathname);
  if (!m) return json(404, {});
  if (!m[1] && init.method === "POST") {
    const body = JSON.parse(init.body);
    const id = "folder" + files.size;
    files.set(id, { id, ...body, trashed: false });
    return json(200, { id });
  }
  if (!m[1]) {
    const q = u.searchParams.get("q");
    const list = [...files.values()].filter((f) => {
      if (q.includes("name='agentes.json'")) return f.name === "agentes.json";
      if (q.includes("name='solicitudes'")) return f.name === "solicitudes";
      if (q.includes("value='edu_req'")) return f.appProperties?.k === "edu_req";
      return false;
    });
    return json(200, { files: list.map(({ content, ...f }) => f) });
  }
  const f = files.get(m[1]);
  if (!f) return json(404, {});
  if (u.searchParams.get("alt") === "media") return new Response(f.content, { status: 200 });
  return json(200, { ...f, content: undefined });
};

const { default: handler } = await import("../api/_task-inbox.js");

function call({ method = "GET", body, auth, query = {}, ip = "1.2.3.4" }) {
  return new Promise((resolve) => {
    const res = {
      headers: {}, statusCode: 200,
      setHeader(k, v) { this.headers[k] = v; },
      status(code) { this.statusCode = code; return this; },
      json(payload) { resolve({ status: this.statusCode, body: payload }); },
      send(payload) { resolve({ status: this.statusCode, body: payload, headers: this.headers }); },
      end() { resolve({ status: this.statusCode }); }
    };
    handler({ method, body, query, headers: { authorization: auth ? `Bearer ${auth}` : "", "x-real-ip": ip } }, res);
  });
}

beforeEach(() => {
  files = new Map();
  const hash = crypto.createHash("sha256").update(AGENT_KEY).digest("hex");
  files.set("agents", { id: "agents", name: "agentes.json", content: Buffer.from(JSON.stringify({ agents: [{ id: "c1", name: "Claude", hash }] })) });
});

const valid = (extra = {}) => ({ title: "Control semanal", grade: "primaria", author: "Prof. Prueba",
  narration: "Tabla de lunes a viernes\ncon firmas.", ...extra });

test("POST stores the request in Drive and GET with an agent key returns it", async () => {
  const created = await call({ method: "POST", body: valid(), ip: "10.0.0.1" });
  assert.equal(created.status, 201);
  assert.match(created.body.id, /^task_edu_\d+[a-f0-9]{6}$/);
  const listed = await call({ auth: AGENT_KEY });
  assert.equal(listed.status, 200);
  assert.equal(listed.body.tasks.length, 1);
  assert.equal(listed.body.tasks[0].narration, "Tabla de lunes a viernes\ncon firmas.");
  assert.equal(listed.body.tasks[0].status, "queued_for_claude");
});

test("GET without a key, or with a wrong one, is refused", async () => {
  assert.equal((await call({})).status, 401);
  assert.equal((await call({ auth: "arkedu_ag_" + "b".repeat(48) })).status, 401);
});

test("attachment is stored, type-checked by content, and downloadable only with a key", async () => {
  const dataUrl = "data:image/png;base64," + PNG.toString("base64");
  const created = await call({ method: "POST", body: valid({ file: { name: "libreta.png", dataUrl } }), ip: "10.0.0.2" });
  assert.equal(created.status, 201);
  const task = (await call({ auth: AGENT_KEY })).body.tasks[0];
  assert.equal(task.file.type, "image/png");
  assert.equal((await call({ query: { action: "file", id: task.file.id } })).status, 401);
  const dl = await call({ auth: AGENT_KEY, query: { action: "file", id: task.file.id } });
  assert.equal(dl.status, 200);
  assert.ok(Buffer.from(dl.body).equals(PNG));
});

test("rejects missing fields, disguised files and oversized files", async () => {
  assert.equal((await call({ method: "POST", body: valid({ narration: "  " }), ip: "10.0.0.3" })).status, 400);
  const fakePdf = "data:application/pdf;base64," + Buffer.from("<html>hola</html>").toString("base64");
  assert.equal((await call({ method: "POST", body: valid({ file: { name: "x.pdf", dataUrl: fakePdf } }), ip: "10.0.0.3" })).status, 400);
  const big = "data:image/png;base64," + Buffer.concat([PNG, Buffer.alloc(2_900_000)]).toString("base64");
  assert.equal((await call({ method: "POST", body: valid({ file: { name: "big.png", dataUrl: big } }), ip: "10.0.0.3" })).status, 413);
  assert.equal([...files.values()].filter((f) => f.appProperties?.k === "edu_req").length, 0);
});

test("clips long text and limits each IP to 5 requests per hour", async () => {
  const first = await call({ method: "POST", body: valid({ title: "T".repeat(500) }), ip: "10.0.0.4" });
  assert.equal(first.status, 201);
  const stored = (await call({ auth: AGENT_KEY })).body.tasks[0];
  assert.equal(stored.title.length, 120);
  for (let i = 0; i < 4; i++) assert.equal((await call({ method: "POST", body: valid(), ip: "10.0.0.4" })).status, 201);
  assert.equal((await call({ method: "POST", body: valid(), ip: "10.0.0.4" })).status, 429);
});

test("other methods are refused", async () => {
  assert.equal((await call({ method: "DELETE" })).status, 405);
});
