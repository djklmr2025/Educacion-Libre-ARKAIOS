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

  window.ArkComunidad = {
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
    thumbUrl: (thumbId) => (thumbId ? `${API}?action=thumb&id=${encodeURIComponent(thumbId)}` : ""),
    captureFrame,
    restoreFrame,
    sanitizeData
  };
})();
