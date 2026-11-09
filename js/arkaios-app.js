/*
 * ARKAIOS · Modos de trabajo y funciones de la app Android.
 *
 *  🤖 Modo Agente: el Copiloto IA queda abierto como ventana fija, con menú rápido de plantillas
 *     y dictado por voz; el agente surte las plantillas (Auto-Rellenar, imágenes, Gemini-Lab).
 *  ✏️ Modo Estudio: el usuario trabaja a mano; el Copiloto queda como botón flotante.
 *
 *  Dentro de la app (Capacitor.Plugins.Arkaios): Imprimir/PDF y descargas pasan por Android,
 *  porque el WebView no imprime ni descarga por sí solo.
 */
(function () {
  'use strict';

  const MODE_KEY = 'ark_work_mode';
  const Cap = window.Capacitor;
  const NATIVE = Cap && Cap.isNativePlatform && Cap.isNativePlatform() ? Cap.Plugins.Arkaios : null;
  const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;

  const CSS = `
  .ark-mode-switch{display:inline-flex;border:1px solid #cbd5e1;border-radius:999px;overflow:hidden;background:#fff;flex-shrink:0}
  .ark-mode-switch button{border:0;background:transparent;padding:7px 12px;font:700 12px 'Poppins',system-ui,sans-serif;color:#334155;cursor:pointer;white-space:nowrap}
  .ark-mode-switch button.on{background:#1e293b;color:#fff}
  .ark-quick{display:flex;gap:6px;overflow-x:auto;padding:8px 12px;border-bottom:1px solid #e2e8f0;background:#f8fafc;scrollbar-width:thin;flex-shrink:0}
  .ark-quick button{flex-shrink:0;border:1px solid #e2e8f0;background:#fff;border-radius:999px;padding:6px 11px;font:600 12px system-ui,sans-serif;color:#1e293b;cursor:pointer;white-space:nowrap}
  .ark-quick button.on{background:#2563eb;border-color:#2563eb;color:#fff}
  .ark-quick-label{flex-shrink:0;font:700 11px system-ui,sans-serif;color:#64748b;align-self:center;text-transform:uppercase;letter-spacing:.04em}
  .ark-mic{border:0;border-radius:10px;padding:8px 10px;background:#eef2ff;color:#4f46e5;font:700 13px system-ui,sans-serif;cursor:pointer;align-self:flex-start}
  .ark-mic.rec{background:#dc2626;color:#fff;animation:arkPulse 1s infinite}
  @keyframes arkPulse{50%{opacity:.6}}
  body.ark-agent .puter-ai-trigger{display:none}
  body.ark-agent .puter-ai-drawer{opacity:1;pointer-events:auto;transform:none;top:72px;bottom:0;right:0;height:auto;max-height:none;width:440px;border-radius:16px 0 0 0}
  @media (min-width:1100px){body.ark-agent .layout{margin-right:440px}}
  @media (max-width:1099px){body.ark-agent .puter-ai-drawer{top:auto;width:100vw;max-width:100vw;height:62vh;border-radius:18px 18px 0 0}
    body.ark-agent .puter-ai-drawer.ark-min{height:56px}}
  .ark-min-btn{display:none;border:0;background:rgba(255,255,255,.15);color:#fff;border-radius:8px;padding:4px 9px;cursor:pointer;font-weight:700;margin-right:6px}
  @media (max-width:1099px){body.ark-agent .ark-min-btn{display:inline-block}}
  .ark-chooser{position:fixed;inset:0;z-index:100000;background:rgba(15,23,42,.72);display:flex;align-items:center;justify-content:center;padding:16px}
  .ark-chooser-box{background:#fff;border-radius:22px;max-width:640px;width:100%;padding:24px;box-shadow:0 30px 80px rgba(0,0,0,.4);font-family:system-ui,sans-serif}
  .ark-chooser-box h2{font:800 22px 'Poppins',system-ui,sans-serif;color:#0f172a;margin:0 0 4px}
  .ark-chooser-box p{color:#475569;font-size:14px;margin:0 0 16px}
  .ark-chooser-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
  @media (max-width:560px){.ark-chooser-grid{grid-template-columns:1fr}}
  .ark-chooser-grid button{text-align:left;border:2px solid #e2e8f0;border-radius:16px;padding:16px;background:#fff;cursor:pointer;font:inherit}
  .ark-chooser-grid button:hover,.ark-chooser-grid button:focus-visible{border-color:#2563eb;background:#eff6ff}
  .ark-chooser-grid b{display:block;font-size:17px;color:#0f172a;margin:6px 0 4px}
  .ark-chooser-grid span{font-size:13px;color:#475569;line-height:1.45}
  .ark-chooser-grid big{font-size:30px}`;

  const $ = (id) => document.getElementById(id);
  const readMode = () => { try { return localStorage.getItem(MODE_KEY); } catch (e) { return null; } };
  const saveMode = (m) => { try { localStorage.setItem(MODE_KEY, m); } catch (e) { /* modo solo en memoria */ } };

  // ---------- Modos ----------
  function applyMode(mode) {
    const agent = mode === 'agente';
    document.body.classList.toggle('ark-agent', agent);
    const drawer = $('puterAiDrawer');
    if (drawer) {
      drawer.classList.toggle('open', agent);
      drawer.classList.remove('ark-min');
    }
    document.querySelectorAll('.ark-mode-switch button').forEach((b) => b.classList.toggle('on', b.dataset.mode === mode));
    if (agent && typeof window.scanActiveTemplate === 'function') window.scanActiveTemplate();
  }

  function setMode(mode) {
    saveMode(mode);
    applyMode(mode);
  }

  function buildSwitch() {
    const host = document.querySelector('.header-actions');
    if (!host || host.querySelector('.ark-mode-switch')) return;
    const sw = document.createElement('div');
    sw.className = 'ark-mode-switch';
    sw.setAttribute('role', 'group');
    sw.setAttribute('aria-label', 'Modo de trabajo');
    sw.innerHTML = '<button type="button" data-mode="agente" title="El agente IA trabaja contigo">🤖 Agente</button>' +
      '<button type="button" data-mode="estudio" title="Tú haces el trabajo a mano">✏️ Estudio</button>';
    sw.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) setMode(b.dataset.mode); });
    host.insertBefore(sw, host.firstChild);
  }

  function showChooser() {
    const wrap = document.createElement('div');
    wrap.className = 'ark-chooser';
    wrap.innerHTML = '<div class="ark-chooser-box" role="dialog" aria-modal="true" aria-labelledby="arkChooserTitle">' +
      '<h2 id="arkChooserTitle">¿Cómo quieres trabajar hoy?</h2><p>Puedes cambiarlo cuando quieras desde la barra de arriba.</p>' +
      '<div class="ark-chooser-grid">' +
      '<button type="button" data-mode="agente"><big>🤖</big><b>Modo Agente IA</b><span>Tu agente escolar trabaja contigo: le pides la tarea (escrita o por voz), elige la plantilla y la surte por ti.</span></button>' +
      '<button type="button" data-mode="estudio"><big>✏️</big><b>Modo Estudio</b><span>Tú eliges la plantilla y la llenas a mano. El asistente queda a un clic por si lo necesitas.</span></button>' +
      '</div></div>';
    wrap.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-mode]');
      if (!b) return;
      setMode(b.dataset.mode);
      wrap.remove();
    });
    document.body.appendChild(wrap);
    wrap.querySelector('button').focus();
  }

  // ---------- Menú rápido de plantillas dentro del Copiloto ----------
  async function buildQuickMenu() {
    const drawer = $('puterAiDrawer');
    const header = drawer && drawer.querySelector('.puter-ai-header');
    if (!header || drawer.querySelector('.ark-quick')) return;
    const bar = document.createElement('div');
    bar.className = 'ark-quick';
    bar.innerHTML = '<span class="ark-quick-label">Plantillas</span>';
    header.insertAdjacentElement('afterend', bar);
    let items = [];
    try {
      const m = await (await fetch('modules.json', { cache: 'no-store' })).json();
      items = m.sections.flatMap((s) => s.items);
    } catch (e) {
      bar.insertAdjacentHTML('beforeend', '<span class="ark-quick-label">No se pudo cargar el menú</span>');
      return;
    }
    items.forEach((it) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.dataset.target = it.target;
      b.textContent = (it.icon ? it.icon + ' ' : '') + it.label;
      bar.appendChild(b);
    });
    bar.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-target]');
      if (!b || typeof window.loadTemplate !== 'function') return;
      window.loadTemplate(b.dataset.target);
      bar.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
      if (typeof window.switchPuterTab === 'function') window.switchPuterTab('autofill');
    });

    const min = document.createElement('button');
    min.type = 'button';
    min.className = 'ark-min-btn';
    min.textContent = '▾';
    min.title = 'Minimizar / expandir agente';
    min.addEventListener('click', () => { drawer.classList.toggle('ark-min'); min.textContent = drawer.classList.contains('ark-min') ? '▴' : '▾'; });
    const close = header.querySelector('.puter-ai-close');
    if (close) {
      header.insertBefore(min, close);
      close.addEventListener('click', () => { if (document.body.classList.contains('ark-agent')) setMode('estudio'); });
    }
  }

  // ---------- Dictado por voz ----------
  function dictate() {
    if (NATIVE) return NATIVE.listen({ lang: 'es-MX', prompt: 'Dile a tu agente qué necesitas' }).then((r) => r.text || '');
    return new Promise((resolve, reject) => {
      const rec = new SpeechRec();
      rec.lang = 'es-MX';
      rec.interimResults = false;
      rec.onresult = (e) => resolve(e.results[0][0].transcript);
      rec.onerror = (e) => reject(new Error(e.error || 'No se pudo escuchar'));
      rec.onend = () => resolve('');
      rec.start();
    });
  }

  function addMic(textareaId) {
    const ta = $(textareaId);
    if (!ta || (!NATIVE && !SpeechRec) || ta.parentElement.querySelector('.ark-mic')) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ark-mic';
    btn.textContent = '🎙️ Dictar';
    btn.addEventListener('click', async () => {
      btn.classList.add('rec');
      btn.textContent = '🎙️ Escuchando…';
      try {
        const text = (await dictate()).trim();
        if (text) { ta.value = ta.value ? ta.value.trim() + ' ' + text : text; ta.dispatchEvent(new Event('input', { bubbles: true })); }
      } catch (e) {
        if (!/cancel/i.test(e.message || '')) alert('🎙️ ' + (e.message || e));
      } finally {
        btn.classList.remove('rec');
        btn.textContent = '🎙️ Dictar';
      }
    });
    ta.insertAdjacentElement('afterend', btn);
  }

  // ---------- App Android: imprimir y descargar ----------
  function snapshotHtml(doc) {
    doc.querySelectorAll('input').forEach((el) => {
      if (el.type === 'checkbox' || el.type === 'radio') el.toggleAttribute('checked', el.checked);
      else if (el.type !== 'file') el.setAttribute('value', el.value);
    });
    doc.querySelectorAll('textarea').forEach((el) => { el.textContent = el.value; });
    doc.querySelectorAll('select option').forEach((o) => o.toggleAttribute('selected', o.selected));
    const canvases = [...doc.querySelectorAll('canvas')].map((c) => { try { return c.toDataURL('image/png'); } catch (e) { return ''; } });
    const clone = doc.documentElement.cloneNode(true);
    clone.querySelectorAll('canvas').forEach((c, i) => {
      if (!canvases[i]) return;
      const img = doc.createElement('img');
      img.src = canvases[i];
      img.style.cssText = c.style.cssText;
      img.width = c.width; img.height = c.height;
      c.replaceWith(img);
    });
    clone.querySelectorAll('script').forEach((s) => s.remove());
    return '<!DOCTYPE html>' + clone.outerHTML;
  }

  function isLandscape(doc) {
    try {
      return [...doc.styleSheets].some((sh) => [...sh.cssRules].some((r) => r.type === CSSRule.PAGE_RULE && /landscape/i.test(r.cssText)));
    } catch (e) { return false; }
  }

  function nativePrint(win) {
    const doc = win.document;
    return NATIVE.printHtml({ html: snapshotHtml(doc), baseUrl: doc.URL, title: doc.title || 'ARKAIOS', landscape: isLandscape(doc) })
      .catch((e) => alert('🖨️ No se pudo imprimir: ' + (e.message || e)));
  }

  function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result).split(',')[1] || '');
      r.onerror = () => reject(new Error('No se pudo leer el archivo'));
      r.readAsDataURL(blob);
    });
  }

  async function nativeDownload(anchor) {
    const href = anchor.href;
    const name = anchor.getAttribute('download') || href.split('/').pop().split('?')[0] || 'archivo';
    try {
      const blob = await (await fetch(href)).blob();
      await NATIVE.saveFile({ name, mime: blob.type || 'application/octet-stream', data: await blobToBase64(blob) });
    } catch (e) {
      if (/^https:/i.test(href)) NATIVE.openExternal({ url: href });
      else alert('💾 No se pudo guardar: ' + (e.message || e));
    }
  }

  function patchWindow(win) {
    if (!win || win.__arkNativePatched) return;
    try {
      win.__arkNativePatched = true;
      win.print = () => nativePrint(win);
      const origClick = win.HTMLAnchorElement.prototype.click;
      win.HTMLAnchorElement.prototype.click = function () {
        if (this.hasAttribute('download') && this.href) { nativeDownload(this); return; }
        return origClick.call(this);
      };
      win.document.addEventListener('click', (e) => {
        const a = e.target.closest && e.target.closest('a[download]');
        if (a && a.href) { e.preventDefault(); nativeDownload(a); }
      }, true);
    } catch (e) {
      console.warn('[ARKAIOS app] no se pudo preparar la ventana:', e);
    }
  }

  function setupNative() {
    if (!NATIVE) return;
    patchWindow(window);
    const frame = $('plantillaFrame');
    if (frame) frame.addEventListener('load', () => { try { patchWindow(frame.contentWindow); } catch (e) { /* otra procedencia */ } });
  }

  // ---------- Inicio ----------
  function init() {
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);
    setupNative();
    buildSwitch();
    buildQuickMenu();
    addMic('aiAutofillPrompt');
    addMic('coagentTaskPrompt');
    addMic('aiImagePrompt');
    const mode = readMode();
    if (mode === 'agente' || mode === 'estudio') applyMode(mode);
    else if ($('puterAiDrawer')) showChooser();
  }

  window.ArkaiosApp = { setMode, isApp: () => !!NATIVE, print: (win) => (NATIVE ? nativePrint(win || window) : (win || window).print()) };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
