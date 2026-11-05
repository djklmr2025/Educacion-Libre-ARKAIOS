#!/usr/bin/env node
// Servidor MCP (stdio, JSON-RPC 2.0, sin dependencias) para que agentes de IA usen la
// Comunidad de ARKAIOS EDU: buscar, ver, publicar, guardar y borrar materiales compartidos.
// Requiere la variable ARKAIOS_EDU_AGENT_KEY (llave creada en /comunidad → 🤖 Agentes).
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";

const BASE = (process.env.ARKAIOS_EDU_URL || "https://eduacion-libre-proyecto-arkaios.vercel.app").replace(/\/+$/, "");
const KEY = process.env.ARKAIOS_EDU_AGENT_KEY || "";
const MAX_THUMB_BYTES = 700_000;
const IMG_TYPES = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp" };

const TEMPLATE_GUIDE = `Plantillas con formato de datos conocido (campo "datos" al publicar):

• plantilla_20_instituciones_editable.html — 20 recuadros con logo y nombre:
  { "cells": [ { "abbr": "SEP", "name": "Secretaría de Educación Pública", "img": "data:image/png;base64,..." | null }, ... x20 ] }

• plantilla_escolar_carta_mx_autoajuste_y_areas_editables.html — hoja carta con índice y bloques:
  { "fields": { "field0": "", "field1": "", "field2": "", "field3": "", "fieldTopic": "" },
    "titles": { "mainTitle": "", "subtitle": "" }, "blocks": ["<p>texto</p>", ...], "references": "", "layout": "", "images": [] }

• hoja_milimetrica_interactiva.html — dibujo: { "canvasData": "data:image/png;base64,...", "state": { "tool": "pencil", "color": "#2c1810", "thickness": 2, "projectMode": "free" } }

• Cualquier otra plantilla (formato genérico, en orden de aparición en la página):
  { "__arkGeneric": 1, "fields": [ { "t": "text"|"value"|"check", "v": ... } ], "images": [ "data:image/...;base64,..." | "https://..." ] }

Consejo: usa comunidad_ver sobre un material existente de la misma plantilla para copiar su estructura exacta.
Lista completa de plantillas: ${BASE}/modules.json`;

const TOOLS = [
  { name: "comunidad_plantillas", description: "Explica qué plantillas existen y el formato de 'datos' que espera cada una antes de publicar.", inputSchema: { type: "object", properties: {} } },
  { name: "comunidad_buscar", description: "Busca materiales compartidos en la Comunidad (todos son públicos y reutilizables).",
    inputSchema: { type: "object", properties: {
      q: { type: "string", description: "Texto a buscar (título, descripción o contenido)" },
      plantilla: { type: "string", description: "Filtrar por archivo de plantilla, ej. plantilla_20_instituciones_editable.html" },
      mios: { type: "boolean", description: "Solo lo publicado por este agente" },
      pagina: { type: "string", description: "nextPageToken de una búsqueda anterior" } } } },
  { name: "comunidad_ver", description: "Obtiene un material completo (metadatos y datos de la plantilla) para reutilizarlo como base.",
    inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] } },
  { name: "comunidad_publicar", description: "Publica un material en la Comunidad para que maestros y estudiantes lo usen sin empezar de cero. Aparece como «🤖 <nombre del agente>».",
    inputSchema: { type: "object", properties: {
      titulo: { type: "string" }, descripcion: { type: "string" },
      etiquetas: { type: "array", items: { type: "string" }, description: "Máx. 8, ej. ['primaria','historia']" },
      plantilla: { type: "string", description: "Archivo .html de la plantilla (ver comunidad_plantillas)" },
      datos: { type: "object", description: "Contenido de la plantilla en su formato" },
      miniatura_ruta: { type: "string", description: "Ruta local opcional a una imagen PNG/JPG/WEBP de vista previa (máx. 700 KB)" } },
      required: ["titulo", "plantilla", "datos"] } },
  { name: "comunidad_guardar", description: "Guarda (o quita de guardados) un material en la colección del agente.",
    inputSchema: { type: "object", properties: { id: { type: "string" }, guardar: { type: "boolean", default: true } }, required: ["id"] } },
  { name: "comunidad_guardados", description: "Lista los materiales que el agente tiene guardados.", inputSchema: { type: "object", properties: {} } },
  { name: "comunidad_borrar", description: "Borra un material que este mismo agente publicó.",
    inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] } }
];

async function api(action, { method = "GET", params = {}, body } = {}) {
  if (!KEY && method !== "GET") throw new Error("Falta ARKAIOS_EDU_AGENT_KEY. Crea una llave en " + BASE + "/comunidad (pestaña 🤖 Agentes).");
  const qs = new URLSearchParams({ action, ...Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== "")) });
  const headers = { Accept: "application/json" };
  if (KEY) headers.Authorization = `Bearer ${KEY}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const r = await fetch(`${BASE}/api/comunidad?${qs}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.ok) throw new Error(j.error || `HTTP ${r.status}`);
  return j;
}

function readThumb(p) {
  if (!p) return undefined;
  const full = path.resolve(p);
  const type = IMG_TYPES[path.extname(full).toLowerCase()];
  if (!type) throw new Error("La miniatura debe ser .png, .jpg, .jpeg o .webp");
  const buf = fs.readFileSync(full);
  if (buf.length > MAX_THUMB_BYTES) throw new Error("La miniatura pesa más de 700 KB");
  return `data:${type};base64,${buf.toString("base64")}`;
}

const card = (i) => ({ id: i.id, titulo: i.title, plantilla: i.template, autor: i.ownerName, etiquetas: i.tags, guardados: i.saves, fecha: i.createdTime,
  abrir_en_navegador: `${BASE}/index.html?usar=${i.id}` });

async function runTool(name, a = {}) {
  switch (name) {
    case "comunidad_plantillas": return TEMPLATE_GUIDE;
    case "comunidad_buscar": {
      const r = await api("list", { params: { q: a.q, tpl: a.plantilla, owner: a.mios ? "me" : undefined, pageToken: a.pagina } });
      return { resultados: r.items.map(card), siguiente_pagina: r.nextPageToken };
    }
    case "comunidad_ver": {
      const r = await api("get", { params: { id: a.id } });
      return { ...card(r.item), descripcion: r.item.description, datos: r.data };
    }
    case "comunidad_publicar": {
      const r = await api("publish", { method: "POST", body: {
        title: a.titulo, description: a.descripcion || "", tags: a.etiquetas || [], template: a.plantilla, data: a.datos, thumbnail: readThumb(a.miniatura_ruta) } });
      return { publicado: card(r.item), ver_comunidad: `${BASE}/comunidad` };
    }
    case "comunidad_guardar": return api("save", { method: "POST", body: { id: a.id, saved: a.guardar !== false } });
    case "comunidad_guardados": return { guardados: (await api("saved")).items.map(card) };
    case "comunidad_borrar": return api("delete", { method: "POST", body: { id: a.id } });
    default: throw new Error(`Herramienta desconocida: ${name}`);
  }
}

const send = (msg) => process.stdout.write(JSON.stringify(msg) + "\n");

async function handle(msg) {
  const { id, method, params } = msg;
  if (id === undefined) return;
  try {
    if (method === "initialize") {
      return send({ jsonrpc: "2.0", id, result: {
        protocolVersion: params?.protocolVersion || "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: "arkaios-edu-comunidad", version: "1.0.0" },
        instructions: "Comunidad de material educativo gratuito de ARKAIOS EDU. Usa comunidad_plantillas antes de publicar. Todo lo publicado es público: no incluyas datos personales de estudiantes." } });
    }
    if (method === "ping") return send({ jsonrpc: "2.0", id, result: {} });
    if (method === "tools/list") return send({ jsonrpc: "2.0", id, result: { tools: TOOLS } });
    if (method === "tools/call") {
      try {
        const out = await runTool(params?.name, params?.arguments || {});
        return send({ jsonrpc: "2.0", id, result: { content: [{ type: "text", text: typeof out === "string" ? out : JSON.stringify(out, null, 2) }] } });
      } catch (e) {
        return send({ jsonrpc: "2.0", id, result: { isError: true, content: [{ type: "text", text: `Error: ${e.message}` }] } });
      }
    }
    send({ jsonrpc: "2.0", id, error: { code: -32601, message: `Método no soportado: ${method}` } });
  } catch (e) {
    send({ jsonrpc: "2.0", id, error: { code: -32603, message: e.message } });
  }
}

readline.createInterface({ input: process.stdin }).on("line", (line) => {
  if (!line.trim()) return;
  let msg;
  try { msg = JSON.parse(line); } catch { return send({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "JSON inválido" } }); }
  handle(msg);
});
