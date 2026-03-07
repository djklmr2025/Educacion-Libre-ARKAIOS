import { forwardJson, getCoreConfig, setCors } from "./_coreProxy.js";

export default async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ ok: false, message: "Method not allowed" });

  const { base, key } = getCoreConfig();
  if (!key) return res.status(500).json({ ok: false, message: "Missing Core API key in server env" });

  const payload = req.body || {};
  const result = await forwardJson(`${base}/api/pos/login`, {
    method: "POST",
    body: {
      account_id: payload.account_id,
      nip: payload.nip,
      role: payload.role,
      tenant_id: payload.tenant_id,
      box_id: payload.box_id,
      allow_master: payload.allow_master !== false,
    },
    key,
  });

  return res.status(result.status).json(result.data);
}
