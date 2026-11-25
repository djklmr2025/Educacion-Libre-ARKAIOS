// Cliente de la Comunidad ARKAIOS EDU (nube compartida de materiales).
// Expone window.ArkComunidad: API, sanitizado de datos ajenos y captura/restauración de plantillas.
(function () {
  const API = "/api/comunidad";
  const SAFE_IMG_SRC = /^(data:image\/(png|jpe?g|gif|webp);base64,[A-Za-z0-9+/=]+|https:\/\/[^\s"'<>]+)$/i;
  const SAFE_HREF = /^(https:\/\/|mailto:)[^\s"'<>]+$/i;
  const ALLOWED_TAGS = new Set(["B", "I", "U", "S", "STRONG", "EM", "BR", "P", "DIV", "SPAN", "UL", "OL", "LI",
    "H1", "H2", "H3", "H4", "BLOCKQUOTE", "A", "IMG", "FONT", "SUB", "SUP", "TABLE", "THEAD", "TBODY", "TR", "TD", "TH", "HR"]);
  const DROP_TAGS = new Set(["SCRIPT", "STYLE", "IFRAME", "OBJECT", "EMBED", "LINK", "META", "BASE", "FORM", "SVG", "MATH", "TEMPLATE", "NOSCRIPT"]);

  async function idToken() {
    if (typeof window.ARK_getIdToken !== "function") return null;
    try { return await window.ARK_getIdToken(); } catch { return null; }
  }

  async function call(action, { method = "GET", params = {}, body, auth = false } = {}) {
    const qs = new URLSearchParams({ action, ...params });
    const headers = {};
    const token = await idToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    else if (auth) throw new Error("Inicia sesión con tu cuenta de Google para usar la Comunidad.");
    if (body !== undefined) headers["Content-Type"] = "application/json";
    const r = await fetch(`${API}?${qs}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.ok) throw new Error(j.error || `Error de la Comunidad (${r.status}).`);
    return j;
  }

  function cleanStyle(style) {
    return /url\s*\(|expression\s*\(|javascript:|@import/i.test(style) ? "" : style;
  }

  function sanitizeNode(node) {
    [...node.childNodes].forEach((child) => {
      if (child.nodeType === Node.COMMENT_NODE) { child.remove(); return; }
      if (child.nodeType !== Node.ELEMENT_NODE) return;
      if (DROP_TAGS.has(child.tagName)) { child.remove(); return; }
      if (!ALLOWED_TAGS.has(child.tagName)) {
        sanitizeNode(child);
        child.replaceWith(...child.childNodes);
        return;
      }
      [...child.attributes].forEach((attr) => {
        const name = attr.name.toLowerCase();
        const keep =
          (name === "class") ||
          (name === "style" && cleanStyle(attr.value)) ||
          (name === "href" && child.tagName === "A" && SAFE_HREF.test(attr.value)) ||
          (name === "src" && child.tagName === "IMG" && SAFE_IMG_SRC.test(attr.value)) ||
          (name === "alt" || name === "colspan" || name === "rowspan" || name === "color" || name === "align");
        if (!keep) child.removeAttribute(attr.name);
      });
      if (child.tagName === "A") { child.setAttribute("target", "_blank"); child.setAttribute("rel", "noopener noreferrer"); }
      sanitizeNode(child);
    });
  }

  function sanitizeHtml(html) {
    const doc = new DOMParser().parseFromString(`<body>${html}</body>`, "text/html");
    sanitizeNode(doc.body);
    return doc.body.innerHTML;
  }

  // Limpia en profundidad cualquier dato que venga de otra persona antes de entregarlo a una plantilla.
  function sanitizeData(value, depth = 0) {
    if (depth > 12) return null;
    if (typeof value === "string") {
      if (/^\s*(javascript|vbscript|data:text\/html)/i.test(value)) return "";
      return value.includes("<") ? sanitizeHtml(value) : value;
    }
    if (Array.isArray(value)) return value.slice(0, 5000).map((v) => sanitizeData(v, depth + 1));
    if (value && typeof value === "object") {
      const out = {};
      Object.keys(value).slice(0, 2000).forEach((k) => {
        if (k === "__proto__" || k === "constructor" || k === "prototype") return;
        out[k] = sanitizeData(value[k], depth + 1);
      });
      return out;
    }
    return typeof value === "number" || typeof value === "boolean" ? value : null;
  }

  // Captura genérica para plantillas que no implementan ARKAIOS_getData.
  function genericGetData(doc) {
    const fields = [...doc.querySelectorAll('[contenteditable="true"], input, textarea, select')]
      .filter((el) => !(el.tagName === "INPUT" && /^(file|button|submit|reset|image|hidden|password)$/i.test(el.type)))
      .map((el) => {
        if (el.isContentEditable) return { t: "text", v: el.innerText };
        if (el.type === "checkbox" || el.type === "radio") return { t: "check", v: el.checked };
        return { t: "value", v: el.value };
      });
    const images = [...doc.querySelectorAll("img")].map((img) => {
      const src = img.getAttribute("src") || "";
      return SAFE_IMG_SRC.test(src) ? src : "";
    });
    return { __arkGeneric: 1, fields, images };
  }

  function genericSetData(doc, data) {
    if (!data || !data.__arkGeneric) return false;
    const els = [...doc.querySelectorAll('[contenteditable="true"], input, textarea, select')]
      .filter((el) => !(el.tagName === "INPUT" && /^(file|button|submit|reset|image|hidden|password)$/i.test(el.type)));
    (data.fields || []).forEach((f, i) => {
      const el = els[i];
      if (!el || !f) return;
      if (f.t === "text" && el.isContentEditable) el.innerText = String(f.v ?? "");
      else if (f.t === "check" && "checked" in el) el.checked = !!f.v;
      else if (f.t === "value" && "value" in el) el.value = String(f.v ?? "");
      el.dispatchEvent(new Event("input", { bubbles: true }));
    });
    const imgs = [...doc.querySelectorAll("img")];
    (data.images || []).forEach((src, i) => {
      if (imgs[i] && src && SAFE_IMG_SRC.test(src)) {
        imgs[i].src = src;
        imgs[i].parentElement?.classList.add("has");
      }
    });
    return true;
  }

  function captureFrame(frame) {
    const win = frame?.contentWindow;
    if (!win) return null;
    try {
      if (typeof win.ARKAIOS_getData === "function") return win.ARKAIOS_getData();
      return genericGetData(win.document);
    } catch (e) {
      console.warn("[comunidad] No se pudo capturar la plantilla:", e);
      return null;
    }
  }

  function restoreFrame(frame, data, { untrusted = false } = {}) {
    const win = frame?.contentWindow;
    if (!win || data == null) return false;
    const safe = untrusted ? sanitizeData(data) : data;
    try {
      if (safe && safe.__arkGeneric) return genericSetData(win.document, safe);
      if (typeof win.ARKAIOS_setData === "function") { win.ARKAIOS_setData(safe); return true; }
      return false;
    } catch (e) {
      console.warn("[comunidad] No se pudo restaurar la plantilla:", e);
      return false;
    }
  }

  // Sube un PDF directo a Drive con sesión reanudable y por trozos: el archivo ya no
  // pasa por Vercel (su cuerpo está topado a 4.5 MB). Máximo 2 GB por archivo, tope
  // del hub 1 TB. onProgress recibe el avance de 0 a 1. Si la red se corta, pregunta
  // a Google cuánto recibió y reanuda desde ahí en vez de empezar de cero.
  const UPLOAD_CHUNK = 8 * 1024 * 1024; // múltiplo de 256 KB, como exige Drive
  async function uploadSessionStatus(resumeToken, total) {
    return call("upload-pdf-status", { method: "POST", body: { resumeToken, total }, auth: true });
  }
  const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
  async function uploadPdf(file, meta, onProgress) {
    const init = await call("upload-pdf-init", { method: "POST", body: { ...meta, size: file.size, name: file.name }, auth: true });
    if (!init.sessionUri || !init.resumeToken) throw new Error("No se pudo preparar la subida en la nube.");
    let start = 0;
    let fileId = null;
    let failures = 0;
    while (start < file.size) {
      try {
        const end = Math.min(start + UPLOAD_CHUNK, file.size);
        const r = await fetch(init.sessionUri, {
          method: "PUT",
          headers: { "Content-Range": `bytes ${start}-${end - 1}/${file.size}` },
          body: file.slice(start, end)
        });
        if (r.status === 308) {
          const st = await uploadSessionStatus(init.resumeToken, file.size);
          if (st.fileId) { fileId = st.fileId; start = file.size; break; }
          start = st.received;
        } else if (r.ok) {
          const j = await r.json().catch(() => ({}));
          fileId = j.id || null;
          start = file.size;
        } else {
          throw new Error(`Google devolvió ${r.status} al subir.`);
        }
        failures = 0;
        if (typeof onProgress === "function") onProgress(start / file.size);
      } catch (err) {
        failures++;
        try {
          const st = await uploadSessionStatus(init.resumeToken, file.size);
          if (st.fileId) { fileId = st.fileId; start = file.size; break; }
          start = Math.max(start, st.received);
          failures = 0;
          if (typeof onProgress === "function") onProgress(start / file.size);
        } catch {
          if (failures >= 5) throw new Error("Se cortó la subida a Google varias veces. Revisa tu conexión e inténtalo de nuevo.");
          await sleep(2000);
        }
      }
    }
    if (!fileId) {
      const st = await uploadSessionStatus(init.resumeToken, file.size).catch(() => null);
      if (st && st.fileId) fileId = st.fileId;
    }
    if (!fileId) throw new Error("No se pudo confirmar la subida en Google. Inténtalo de nuevo.");
    let lastErr = null;
    for (let i = 0; i < 3; i++) {
      try {
        return await call("upload-pdf-finish", { method: "POST", body: { fileId, ...meta }, auth: true });
      } catch (err) {
        lastErr = err;
        await sleep(1500);
      }
    }
    throw new Error(`El archivo llegó a Drive pero no se pudo registrar en la biblioteca (${lastErr ? lastErr.message : "error desconocido"}). Avísame y lo registro yo.`);
  }

  window.ArkComunidad = {
    uploadPdf,
    fileUrl: (id) => `${API}?action=file&id=${encodeURIComponent(id)}`,
    list: (params) => call("list", { params }),
    saved: () => call("saved", { auth: true }),
    me: () => call("me", { auth: true }),
    get: (id) => call("get", { params: { id } }),
    publish: (payload) => call("publish", { method: "POST", body: payload, auth: true }),
    toggleSave: (id, saved) => call("save", { method: "POST", body: { id, saved }, auth: true }),
    remove: (id) => call("delete", { method: "POST", body: { id }, auth: true }),
    agents: () => call("agents", { auth: true }),
    createAgent: (name, description) => call("agent-create", { method: "POST", body: { name, description }, auth: true }),
    revokeAgent: (id) => call("agent-revoke", { method: "POST", body: { id }, auth: true }),
    transferPdfOwner: (fileId, ownerUid, ownerName) => call("upload-pdf-transfer-owner", { method: "POST", body: { fileId, ownerUid, ownerName }, auth: true }),
    thumbUrl: (thumbId) => (thumbId ? `${API}?action=thumb&id=${encodeURIComponent(thumbId)}` : ""),
    captureFrame,
    restoreFrame,
    sanitizeData
  };
})();
