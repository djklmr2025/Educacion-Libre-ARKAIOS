#!/usr/bin/env node
// Emits an individual ARKAIOS EDU agent key once. It never stores or prints the root key.
import crypto from "node:crypto";
import fs from "node:fs";

const BASE = (process.env.ARKAIOS_EDU_URL || "https://eduacion-libre-proyecto-arkaios.vercel.app").replace(/\/+$/, "");
const args = process.argv.slice(2);
const value = (flag) => {
  const index = args.indexOf(flag);
  return index >= 0 ? String(args[index + 1] || "").trim() : "";
};
const values = (flag) => {
  const index = args.indexOf(flag);
  return index >= 0 ? String(args[index + 1] || "").split(",").map((v) => v.trim()).filter(Boolean) : [];
};

if (args.includes("--print-root-hash")) {
  const rootFile = process.env.ARKAIOS_EDU_ROOT_KEY_FILE;
  if (!rootFile) throw new Error("Define ARKAIOS_EDU_ROOT_KEY_FILE solo en tu almacén seguro local.");
  const root = fs.readFileSync(rootFile, "utf8").trim();
  if (!root) throw new Error("La clave raíz local está vacía.");
  console.log(crypto.createHash("sha256").update(root).digest("hex"));
  process.exit(0);
}

const name = value("--name");
if (!name) {
  console.error("Uso: node tools/arkaios-edu-enroll-agent.mjs --name <nombre> [--id <id>] [--role builder|platform|coordinator|custodian|research] [--capabilities a,b] [--description texto]");
  process.exit(2);
}
const rootFile = process.env.ARKAIOS_EDU_ROOT_KEY_FILE;
if (!rootFile) throw new Error("Define ARKAIOS_EDU_ROOT_KEY_FILE. No pases la clave raíz por argumentos ni la pegues en un chat.");
const root = fs.readFileSync(rootFile, "utf8").trim();
if (!root) throw new Error("La clave raíz local está vacía.");

const response = await fetch(`${BASE}/api/agent-enroll`, {
  method: "POST",
  headers: { "Content-Type": "application/json", "X-Arkaios-Root-Key": root },
  body: JSON.stringify({
    name,
    agentId: value("--id"),
    role: value("--role") || "legacy",
    capabilities: values("--capabilities"),
    description: value("--description")
  })
});
const data = await response.json().catch(() => ({}));
if (!response.ok || !data.ok) throw new Error(data.error || `HTTP ${response.status}`);
console.log(JSON.stringify({ agent: data.agent, key: data.key, warning: data.warning }, null, 2));
