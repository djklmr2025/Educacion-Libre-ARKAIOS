// Función única para el módulo POS/Core (el plan de Vercel limita el número de funciones).
// Las URLs públicas /api/pos-login, /api/client-login y /api/pos-accounts siguen
// funcionando mediante rewrites en vercel.json, que añaden ?__op=<nombre>.
import posLogin from "./_pos-login.js";
import clientLogin from "./_client-login.js";
import posAccounts from "./_pos-accounts.js";

const routes = {
  "pos-login": posLogin,
  "client-login": clientLogin,
  "pos-accounts": posAccounts
};

export default async function handler(req, res) {
  const op = String(req.query?.__op || "");
  const fn = Object.prototype.hasOwnProperty.call(routes, op) ? routes[op] : null;
  if (!fn) return res.status(404).json({ ok: false, message: "Not found" });
  return fn(req, res);
}
