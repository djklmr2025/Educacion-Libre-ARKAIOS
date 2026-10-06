// Función única para los puentes de agentes (el plan de Vercel limita el número de funciones).
// /api/bridge y /api/elemia-bridge siguen funcionando mediante rewrites en vercel.json,
// que añaden ?__op=<nombre>.
import bridge from "./_bridge.js";
import elemiaBridge from "./_elemia-bridge.js";

const routes = {
  bridge,
  "elemia-bridge": elemiaBridge
};

export default async function handler(req, res) {
  const op = String(req.query?.__op || "");
  const fn = Object.prototype.hasOwnProperty.call(routes, op) ? routes[op] : null;
  if (!fn) return res.status(404).json({ error: "Not found" });
  return fn(req, res);
}
