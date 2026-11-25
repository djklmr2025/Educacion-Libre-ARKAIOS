#!/usr/bin/env node
// Emits an individual ARKAIOS EDU agent key once. It never stores or prints the root key.
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
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

function readRootCredential(rootFile) {
  const lines = fs.readFileSync(rootFile, "utf8")
    .split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length !== 1 || /\s/.test(lines[0])) {
    throw new Error("El archivo de clave raíz debe contener una única credencial opaca en una sola línea. Rechazado para evitar enviar un volcado de secretos.");
  }
  return lines[0];
}

function installUserEnvironmentKey(key) {
  if (process.platform !== "win32") {
    throw new Error("--install-user-env actualmente está disponible para Windows.");
  }
  // The credential is supplied via stdin, never rendered in a command line or log.
  const result = spawnSync("powershell.exe", ["-NoProfile", "-Command", "[Environment]::SetEnvironmentVariable('ARKAIOS_EDU_AGENT_KEY', [Console]::In.ReadToEnd().Trim(), 'User')"], {
    input: key,
    encoding: "utf8",
    windowsHide: true
  });
  if (result.status !== 0) throw new Error("No se pudo guardar la llave en el entorno seguro del usuario.");
}

if (args.includes("--print-root-hash")) {
  const rootFile = process.env.ARKAIOS_EDU_ROOT_KEY_FILE;
  if (!rootFile) throw new Error("Define ARKAIOS_EDU_ROOT_KEY_FILE solo en tu almacén seguro local.");
  const root = readRootCredential(rootFile);
  console.log(crypto.createHash("sha256").update(root).digest("hex"));
  process.exit(0);
}

const name = value("--name");
if (!name) {
  console.error("Uso: node tools/arkaios-edu-enroll-agent.mjs --name <nombre> [--id <id>] [--role builder|platform|coordinator|custodian|research] [--capabilities a,b] [--description texto] [--install-user-env]");
  process.exit(2);
}
const rootFile = process.env.ARKAIOS_EDU_ROOT_KEY_FILE;
if (!rootFile) throw new Error("Define ARKAIOS_EDU_ROOT_KEY_FILE. No pases la clave raíz por argumentos ni la pegues en un chat.");
const root = readRootCredential(rootFile);

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
if (args.includes("--install-user-env")) installUserEnvironmentKey(data.key);
console.log(JSON.stringify({
  agent: data.agent,
  installedInUserEnvironment: args.includes("--install-user-env"),
  ...(args.includes("--install-user-env") ? {} : { key: data.key, warning: data.warning })
}, null, 2));
