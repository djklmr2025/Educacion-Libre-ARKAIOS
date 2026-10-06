import { forwardJson, getCoreConfig, setCors } from "./_coreProxy.js";

function normalizeRole(account) {
  const raw = String(account?.account_role || account?.accountRole || "").toLowerCase();
  if (raw) return raw;
  const rol = String(account?.rol || "").toLowerCase();
  if (rol === "admin") return "master_admin";
  return "client";
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ ok: false, message: "Method not allowed" });

  const { base, key } = getCoreConfig();
  if (!key) return res.status(500).json({ ok: false, message: "Missing Core API key in server env" });

  const { account_id, nip, tenant_id, box_id } = req.body || {};
  if (!account_id || !nip) return res.status(400).json({ ok: false, message: "account_id and nip are required" });

  const accResult = await forwardJson(`${base}/api/accounts/${encodeURIComponent(account_id)}`, { key });
  if (accResult.status !== 200 || !accResult.data) {
    return res.status(accResult.status || 404).json({ ok: false, message: "Account not found" });
  }

  const account = accResult.data;
  if (String(account.nip || "") !== String(nip)) {
    return res.status(401).json({ ok: false, message: "Invalid NIP" });
  }

  const role = normalizeRole(account);
  if (!["client", "master_admin", "box_admin", "cashier"].includes(role)) {
    return res.status(403).json({ ok: false, message: "Unsupported account role" });
  }

  if (tenant_id && String(account.tenant_id || "") !== String(tenant_id)) {
    return res.status(403).json({ ok: false, message: "Tenant mismatch" });
  }
  if (box_id && String(account.box_id || "") && String(account.box_id || "") !== String(box_id)) {
    return res.status(403).json({ ok: false, message: "Box mismatch" });
  }

  return res.status(200).json({
    ok: true,
    account,
    account_role: role,
    history: Array.isArray(account.historial) ? account.historial : [],
  });
}
