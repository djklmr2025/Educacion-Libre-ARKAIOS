/*
 * ARKAIOS · Imágenes compartidas para plantillas
 * Pegar (Ctrl+V), arrastrar entre recuadros (mover / intercambiar),
 * barra de Autollenar (Pexels → Wikimedia) y Generar con IA (Puter).
 *
 * Uso en una plantilla:
 *   <script src="js/arkaios-imagenes.js"></script>
 *   ArkImagenes.init({
 *     slots: () => [...document.querySelectorAll('.mi-recuadro')], // en orden de índice
 *     get: (i) => src | null,          // imagen actual del recuadro i
 *     set: (i, src) => {},             // guardar src (o null) en el recuadro i y redibujar
 *     swap: (a, b) => {},              // opcional; por defecto usa get/set
 *     add: (urls) => {},               // opcional; plantillas de lista (sin recuadros fijos)
 *     toolbar: '#contenedor',          // opcional; dónde insertar la barra (por defecto arriba del body)
 *     orientation: 'landscape',        // opcional; orientación pedida a Pexels
 *     aiHint: 'ilustración educativa', // opcional; se agrega al prompt de IA
 *     dragSwap: true,                  // false si la plantilla ya mueve imágenes por su cuenta
 *     paste: true,                     // false si la plantilla ya maneja Ctrl+V
 *     exposeApply: true                // define window.applyExternalImages si no existe
 *   });
 */
(function () {
  'use strict';

  const PEXELS_PROXY = '/api/pexels';
  const PUTER_SDK = 'https://js.puter.com/v2/';
  const DRAG_THRESHOLD_PX = 6;
  const WIKI_OVERFETCH = 3;
  const SAFE_SRC = /^(https?:|data:image\/|blob:)/i;

  let cfg = null;
  let selected = -1;
  let gesture = null;

  const CSS = `
  .ark-img-bar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;padding:8px 12px;margin:0 0 10px;
    background:#fff;border:1px solid #cbd5e1;border-radius:10px;font:13px "Segoe UI",system-ui,sans-serif;color:#1e293b;
    box-shadow:0 2px 8px rgba(15,23,42,.06)}
  .ark-img-bar input{flex:1 1 220px;font:inherit;padding:7px 10px;border:1px solid #cbd5e1;border-radius:8px;min-width:0}
  .ark-img-bar input:focus{outline:2px solid #4f46e5;outline-offset:-1px}
  .ark-img-bar button{border:0;border-radius:8px;padding:8px 12px;font:inherit;font-weight:700;cursor:pointer;background:#eef2ff;color:#4f46e5}
  .ark-img-bar button.ark-primary{background:#4f46e5;color:#fff}
  .ark-img-bar button:disabled{opacity:.55;cursor:wait}
  .ark-img-bar .ark-status{font-size:12px;color:#64748b}
  .ark-img-bar .ark-hint{flex-basis:100%;font-size:11.5px;color:#64748b;margin:0}
  .ark-slot-selected{outline:3px solid #4f46e5 !important;outline-offset:2px}
  .ark-swap-source{opacity:.45}
  .ark-swap-target{outline:3px dashed #4f46e5 !important;outline-offset:3px}
  .ark-toast{position:fixed;bottom:18px;left:50%;transform:translateX(-50%);background:#1e293b;color:#fff;padding:8px 14px;
    border-radius:8px;font:13px "Segoe UI",system-ui,sans-serif;opacity:0;transition:opacity .2s;pointer-events:none;z-index:99999}
  .ark-toast.ark-show{opacity:1}
  @media print{.ark-img-bar,.ark-toast{display:none !important}
    .ark-slot-selected,.ark-swap-target{outline:none !important}.ark-swap-source{opacity:1}}`;

  function toast(msg) {
    let t = document.querySelector('.ark-toast');
    if (!t) {
      t = document.createElement('div');
      t.className = 'ark-toast';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.classList.add('ark-show');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => t.classList.remove('ark-show'), 2200);
  }

  const slotEls = () => (cfg.slots() || []).filter(Boolean);
  const slotCount = () => slotEls().length;
  const indexOfSlot = (el) => slotEls().indexOf(el);

  function slotFromNode(node) {
    const els = slotEls();
    for (let n = node; n && n !== document; n = n.parentNode) {
      const i = els.indexOf(n);
      if (i !== -1) return i;
    }
    return -1;
  }

  function markSelected() {
    slotEls().forEach((el, i) => el.classList.toggle('ark-slot-selected', i === selected));
  }

  function select(i) {
    selected = i;
    markSelected();
  }

  function firstEmpty() {
    const n = slotCount();
    for (let i = 0; i < n; i++) if (!cfg.get(i)) return i;
    return -1;
  }

  function targetSlot() {
    if (selected >= 0 && selected < slotCount()) return selected;
    const e = firstEmpty();
    return e >= 0 ? e : (slotCount() ? 0 : -1);
  }

  function put(i, src) {
    if (src && !SAFE_SRC.test(src)) return;
    cfg.set(i, src);
    const next = firstEmpty();
    selected = next >= 0 ? next : i;
    requestAnimationFrame(markSelected);
  }

  function putMany(urls) {
    const list = (urls || []).filter((u) => typeof u === 'string' && SAFE_SRC.test(u));
    if (!list.length) return 0;
    const n = slotCount();
    if (!n && cfg.add) { cfg.add(list); return list.length; }
    const empties = [];
    for (let i = 0; i < n; i++) if (!cfg.get(i)) empties.push(i);
    const targets = empties.length ? empties : Array.from({ length: n }, (_, i) => i);
    let placed = 0;
    targets.forEach((slot, k) => { if (list[k]) { cfg.set(slot, list[k]); placed++; } });
    requestAnimationFrame(markSelected);
    return placed;
  }

  function readFile(file, i) {
    if (!file || !/^image\//.test(file.type)) { toast('Ese archivo no es una imagen.'); return; }
    const reader = new FileReader();
    reader.onload = () => (i >= 0 ? put(i, reader.result) : cfg.add && cfg.add([reader.result]));
    reader.onerror = () => toast('No se pudo leer la imagen.');
    reader.readAsDataURL(file);
  }

  function isTypingTarget(el) {
    if (!el) return false;
    if (el.isContentEditable) return true;
    const tag = el.tagName;
    return tag === 'TEXTAREA' || (tag === 'INPUT' && !/^(checkbox|radio|button|range|color|file)$/i.test(el.type));
  }

  function onPaste(e) {
    if (isTypingTarget(document.activeElement)) return;
    const items = Array.from((e.clipboardData && e.clipboardData.items) || []);
    const imgItem = items.find((it) => it.type && it.type.startsWith('image/'));
    const text = ((e.clipboardData && e.clipboardData.getData('text')) || '').trim();
    if (!imgItem && !SAFE_SRC.test(text)) return;
    const i = targetSlot();
    if (i < 0 && !cfg.add) { toast('No hay recuadros para pegar la imagen.'); return; }
    e.preventDefault();
    if (imgItem) readFile(imgItem.getAsFile(), i);
    else if (i >= 0) put(i, text);
    else cfg.add([text]);
  }

  function clearSwapMarks() {
    document.querySelectorAll('.ark-swap-source,.ark-swap-target')
      .forEach((el) => el.classList.remove('ark-swap-source', 'ark-swap-target'));
  }

  function doSwap(a, b) {
    if (cfg.swap) { cfg.swap(a, b); }
    else {
      const sa = cfg.get(a);
      const sb = cfg.get(b);
      cfg.set(a, sb || null);
      cfg.set(b, sa || null);
    }
    selected = b;
    requestAnimationFrame(markSelected);
    toast(`Imagen ${a + 1} ⇄ recuadro ${b + 1}`);
  }

  function onPointerDown(e) {
    if (e.button !== 0) return;
    const i = slotFromNode(e.target);
    if (i < 0) return;
    select(i);
    if (!cfg.dragSwap || !cfg.get(i) || e.target.closest('button,input,select,textarea,[contenteditable="true"]')) return;
    gesture = { i, x0: e.clientX, y0: e.clientY, active: false, target: -1 };
  }

  function onPointerMove(e) {
    if (!gesture) return;
    const g = gesture;
    if (!g.active) {
      const moved = Math.hypot(e.clientX - g.x0, e.clientY - g.y0) > DRAG_THRESHOLD_PX;
      const over = slotFromNode(document.elementFromPoint(e.clientX, e.clientY));
      if (!moved || over === g.i) return;
      g.active = true;
    }
    const over = slotFromNode(document.elementFromPoint(e.clientX, e.clientY));
    clearSwapMarks();
    slotEls()[g.i]?.classList.add('ark-swap-source');
    g.target = over !== g.i ? over : -1;
    if (g.target >= 0) slotEls()[g.target]?.classList.add('ark-swap-target');
  }

  function onPointerUp() {
    if (!gesture) return;
    const { i, target, active } = gesture;
    gesture = null;
    clearSwapMarks();
    if (active && target >= 0 && target !== i) doSwap(i, target);
  }

  function onDragOver(e) {
    if (slotFromNode(e.target) < 0) return;
    if (Array.from(e.dataTransfer?.types || []).includes('Files')) e.preventDefault();
  }

  function onDrop(e) {
    const i = slotFromNode(e.target);
    const file = e.dataTransfer?.files?.[0];
    if (i < 0 || !file) return;
    e.preventDefault();
    e.stopPropagation();
    readFile(file, i);
  }

  async function searchPexels(q, n) {
    const body = { q, per_page: n };
    if (cfg.orientation) body.orientation = cfg.orientation;
    const res = await fetch(PEXELS_PROXY, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error('Pexels ' + res.status);
    const data = await res.json();
    return (data.photos || []).map((p) => p.src && (p.src.large2x || p.src.large)).filter(Boolean);
  }

  async function searchWikimedia(q, n) {
    const url = 'https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*' +
      '&generator=search&gsrnamespace=6&gsrlimit=' + Math.min(50, n * WIKI_OVERFETCH) +
      '&gsrsearch=' + encodeURIComponent(q + ' filetype:bitmap') +
      '&prop=imageinfo&iiprop=url|size&iiurlwidth=1280';
    const res = await fetch(url);
    if (!res.ok) throw new Error('Wikimedia ' + res.status);
    const pages = Object.values(((await res.json()).query || {}).pages || {});
    const wantLandscape = cfg.orientation === 'landscape';
    const wantPortrait = cfg.orientation === 'portrait';
    return pages
      .map((p) => p.imageinfo && p.imageinfo[0])
      .filter((ii) => ii && (!wantLandscape || ii.width > ii.height) && (!wantPortrait || ii.height > ii.width))
      .map((ii) => ii.thumburl || ii.url)
      .slice(0, n);
  }

  function wantedCount() {
    const n = slotCount();
    if (!n) return cfg.addCount ? cfg.addCount() : 6;
    let empties = 0;
    for (let i = 0; i < n; i++) if (!cfg.get(i)) empties++;
    return empties || n;
  }

  async function autoFill(bar) {
    const q = bar.querySelector('.ark-topic').value.trim();
    if (!q) { toast('Escribe primero un tema.'); bar.querySelector('.ark-topic').focus(); return; }
    const btn = bar.querySelector('.ark-fill');
    const status = bar.querySelector('.ark-status');
    const n = Math.max(1, Math.min(40, wantedCount()));
    btn.disabled = true;
    status.textContent = '🔍 Buscando fotos de "' + q + '"…';
    try {
      let urls = [];
      let source = 'Pexels';
      try { urls = await searchPexels(q, n); } catch (err) { console.warn('[ArkImagenes] Pexels:', err); }
      if (!urls.length) {
        source = 'Wikimedia Commons';
        status.textContent = '🔍 Buscando en Wikimedia Commons…';
        urls = await searchWikimedia(q, n);
      }
      if (!urls.length) { status.textContent = '⚠️ No se encontraron imágenes. Prueba otro tema.'; return; }
      const placed = putMany(urls);
      status.textContent = '✅ ' + placed + ' imagen(es) de ' + source;
    } catch (err) {
      console.error('[ArkImagenes] autollenado:', err);
      status.textContent = '❌ No se pudieron buscar imágenes: ' + err.message;
    } finally {
      btn.disabled = false;
    }
  }

  function loadPuter() {
    if (window.puter) return Promise.resolve(window.puter);
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = PUTER_SDK;
      s.onload = () => (window.puter ? resolve(window.puter) : reject(new Error('Puter no disponible')));
      s.onerror = () => reject(new Error('No se pudo cargar Puter'));
      document.head.appendChild(s);
    });
  }

  async function generateAI(bar) {
    const q = bar.querySelector('.ark-topic').value.trim();
    if (!q) { toast('Escribe primero un tema.'); bar.querySelector('.ark-topic').focus(); return; }
    const btn = bar.querySelector('.ark-ai');
    const status = bar.querySelector('.ark-status');
    const i = targetSlot();
    btn.disabled = true;
    status.textContent = '🎨 Generando imagen' + (i >= 0 ? ' para el recuadro ' + (i + 1) : '') + '… (puede tardar)';
    try {
      const puter = await loadPuter();
      const prompt = q + ', ' + (cfg.aiHint || 'ilustración educativa, colores claros, sin texto');
      const imgEl = await puter.ai.txt2img(prompt);
      if (!imgEl || !imgEl.src) throw new Error('La IA no devolvió imagen');
      if (i >= 0) put(i, imgEl.src);
      else if (cfg.add) cfg.add([imgEl.src]);
      status.textContent = '✅ Imagen IA colocada' + (i >= 0 ? ' en el recuadro ' + (i + 1) : '');
    } catch (err) {
      console.error('[ArkImagenes] IA:', err);
      status.textContent = '❌ Error al generar: ' + (err.message || err);
    } finally {
      btn.disabled = false;
    }
  }

  function buildToolbar() {
    const bar = document.createElement('div');
    bar.className = 'ark-img-bar no-print';
    bar.innerHTML =
      '<input type="text" class="ark-topic" maxlength="200" placeholder="Tema: ej. animales de la selva, sistema solar…">' +
      '<button type="button" class="ark-fill ark-primary">🔍 Autollenar</button>' +
      '<button type="button" class="ark-ai">🎨 Generar con IA</button>' +
      '<span class="ark-status"></span>' +
      '<p class="ark-hint"><b>Autollenar</b> llena los recuadros vacíos (o todos si ya están llenos). ' +
      '<b>Generar con IA</b> pone la imagen en el recuadro seleccionado. ' +
      'Clic en un recuadro + <b>Ctrl+V</b> para pegar' +
      (cfg.dragSwap ? '; <b>arrastra una imagen a otro recuadro</b> para moverla o intercambiarla.' : '.') + '</p>';
    bar.querySelector('.ark-fill').addEventListener('click', () => autoFill(bar));
    bar.querySelector('.ark-ai').addEventListener('click', () => generateAI(bar));
    bar.querySelector('.ark-topic').addEventListener('keydown', (e) => { if (e.key === 'Enter') autoFill(bar); });

    const host = typeof cfg.toolbar === 'string' ? document.querySelector(cfg.toolbar) : cfg.toolbar;
    if (cfg.toolbar === false) return;
    if (host && cfg.toolbarPosition === 'after') host.insertAdjacentElement('afterend', bar);
    else if (host && cfg.toolbarPosition === 'before') host.insertAdjacentElement('beforebegin', bar);
    else if (host) host.appendChild(bar);
    else document.body.insertBefore(bar, document.body.firstChild);
  }

  function init(options) {
    if (cfg) return window.ArkImagenes;
    if (!options || typeof options.slots !== 'function' || typeof options.get !== 'function' || typeof options.set !== 'function') {
      throw new Error('ArkImagenes.init requiere slots(), get(i) y set(i, src)');
    }
    cfg = Object.assign({ dragSwap: true, paste: true, exposeApply: true }, options);

    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);
    buildToolbar();

    if (cfg.paste) document.addEventListener('paste', onPaste);
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointerup', onPointerUp);
    document.addEventListener('pointercancel', () => { gesture = null; clearSwapMarks(); });
    if (cfg.drop !== false) {
      document.addEventListener('dragover', onDragOver);
      document.addEventListener('drop', onDrop, true);
    }
    if (cfg.exposeApply && typeof window.applyExternalImages !== 'function') {
      window.applyExternalImages = (urls) => putMany(urls);
    }
    return window.ArkImagenes;
  }

  window.ArkImagenes = {
    init,
    put: (i, src) => cfg && put(i, src),
    putMany: (urls) => (cfg ? putMany(urls) : 0),
    select: (i) => cfg && select(i),
    refresh: () => cfg && markSelected(),
    count: () => (cfg ? slotCount() : 0),
    get: (i) => (cfg ? cfg.get(i) || null : null),
    slots: () => (cfg ? slotEls() : []),
    dragSwapEnabled: () => !!(cfg && cfg.dragSwap),
    toast
  };
})();
