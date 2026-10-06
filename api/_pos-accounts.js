import { forwardJson, getCoreConfig, setCors } from "./_coreProxy.js";

export default async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ ok: false, message: "Method not allowed" });

  const { base, key } = getCoreConfig();
  if (!key) return res.status(500).json({ ok: false, message: "Missing Core API key in server env" });

  const tenantId = req.query.tenant_id || req.query.tenantId || "";
  const boxId = req.query.box_id || req.query.boxId || "";
  const includeFull = req.query.include_full || "1";
  const allowMaster = req.query.allow_master || "true";

  const qs = new URLSearchParams({
    include_full: String(includeFull),
    allow_master: String(allowMaster),
  });
  if (tenantId) qs.set("tenant_id", String(tenantId));
  if (boxId) qs.set("box_id", String(boxId));

  const result = await forwardJson(`${base}/api/accounts?${qs.toString()}`, { key });
  return res.status(result.status).json(result.data);
}
