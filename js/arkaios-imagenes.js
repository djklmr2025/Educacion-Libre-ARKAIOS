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
  const PEXELS_REMOTE_PROXY = 'https://eduacion-libre-proyecto-arkaios.vercel.app/api/pexels';
  const PUTER_SDK = 'https://js.puter.com/v2/';
  const DRAG_THRESHOLD_PX = 6;
  const WIKI_OVERFETCH = 3;
  const SAFE_SRC = /^(https?:|data:image\/|blob:)/i;

  // Diccionario pedagógico ES -> EN para búsqueda visual limpia (sin diapositivas de texto)
  const SCHOOL_TOPIC_MAP = [
    { re: /\bjusticia\b/i, q: 'justice scale gavel law courthouse lady justice', label: 'Justicia', ai: 'Lady Justice holding golden balance scales and gavel, clean educational illustration, no text' },
    { re: /\bmoral\b/i, q: 'helping hands volunteer kindness charity empathy community', label: 'Moral', ai: 'people helping each other with kindness and empathy, moral values educational illustration, no text' },
    { re: /\b[eé]tica\b/i, q: 'handshake agreement equality respect teamwork integrity', label: 'Ética', ai: 'fairness integrity handshake and ethical teamwork, clean educational illustration, no text' },
    { re: /\blongitud\b/i, q: 'measuring tape ruler centimeter distance meter', label: 'Longitud (Magnitud Física)', ai: 'measuring tape and school ruler measuring length in centimeters and meters, clean educational illustration' },
    { re: /\bmasa\b/i, q: 'weighing scale balance weight kilogram gram', label: 'Masa (Magnitud Física)', ai: 'precision balance scale measuring mass in kilograms, clean educational illustration' },
    { re: /\btiempo\b/i, q: 'analog clock hourglass stopwatch time', label: 'Tiempo (Magnitud Física)', ai: 'analog clock stopwatch and hourglass measuring time, clean educational illustration' },
    { re: /\bderechos\s*humanos\b/i, q: 'human rights peace freedom equality hands', label: 'Derechos Humanos', ai: 'human rights peace and equality symbol, educational illustration' },
    { re: /\bdemocracia\b/i, q: 'voting ballot box democracy citizens', label: 'Democracia', ai: 'citizens voting in ballot box democracy, educational illustration' }
  ];

  function enrichSchoolTopic(rawTopic) {
    const clean = String(rawTopic || '')
      .replace(/\b(im[aá]genes|imagen|fotos|foto|cuadros|cuadro|ejemplos|ejemplo|de|del|la|el|los|las|un|una|unos|unas|sobre|tema|para|con|sin)\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    for (const item of SCHOOL_TOPIC_MAP) {
      if (item.re.test(rawTopic) || item.re.test(clean)) {
        return { raw: clean || item.label, label: item.label, query: item.q, aiPrompt: item.ai };
      }
    }
    const label = clean ? clean.charAt(0).toUpperCase() + clean.slice(1) : 'Educación';
    return { raw: clean || 'educacion', label, query: clean || 'education school', aiPrompt: (clean || 'education') + ', clean educational illustration, no text' };
  }

  /**
   * Analiza instrucciones escolares compuestas (ej. mensajes de WhatsApp con múltiples temas y cantidades).
   * Retorna: { isMulti, sizeCm, separatedInfoTopics, items: [{ count, label, query, aiPrompt, raw }] }
   */
  function parseHomeworkTasks(rawInput) {
    let text = String(rawInput || '')
      // Quitar encabezados de WhatsApp tipo "[2:18 p.m., 11/11/2026] Nombre:"
      .replace(/\[\d{1,2}:\d{2}[^\]]*\]\s*[^:\n]+:\s*/gi, '\n')
      .trim();

    // Detectar medida en cm o formato NxN (ej. "De 5x5" o "5 cm")
    let sizeCm = null;
    const sizeMatch = text.match(/\bde\s*(\d+)\s*[x×]\s*(\d+)\b/i) || text.match(/\b(\d+)\s*cm\b/i);
    if (sizeMatch) {
      const val = parseInt(sizeMatch[1], 10);
      if (val >= 3 && val <= 10) sizeCm = val;
    }

    // Detectar si pide separar imágenes de la información escrita (ej. "separado de la información de la justicia")
    const separatedInfoTopics = [];
    const sepRegex = /separad[oa]s?\s+de\s+la\s+informaci[oó]n\s+de\s+(?:la|el|los|las|a)?\s*([a-záéíóúñü]+)/gi;
    let sepM;
    while ((sepM = sepRegex.exec(text)) !== null) {
      separatedInfoTopics.push(sepM[1].trim());
    }

    // Limpiar frases de medida y "separado de la información..." para no contaminar los temas
    let working = text
      .replace(/separad[oa]s?\s+de\s+la\s+informaci[oó]n\s+de\s+(?:la|el|los|las|a)?\s*[a-záéíóúñü]+/gi, ' ')
      .replace(/\bde\s*\d+\s*[x×]\s*\d+\b/gi, ' ');

    const items = [];
    // Dividir por saltos de línea o punto y coma
    const lines = working.split(/[\n;]+/).map((s) => s.trim()).filter(Boolean);

    for (const line of lines) {
      // Caso 1: "3 imágenes de ejemplos de la longitud, masa y tiempo (una cada una)"
      const eachMatch = line.match(/(\d+)\s*(?:im[aá]genes|imagen|fotos|foto|cuadros|ilustraciones)?\s*(?:de\s+)?(?:ejemplos?\s+de\s+)?([^()]+?)\s*\(\s*(?:una|uno|1)\s+(?:de\s+)?cada\s+un[oa]\s*\)/i);
      if (eachMatch) {
        const subTopics = eachMatch[2]
          .split(/,|\s+y\s+|\s+e\s+/i)
          .map((s) => s.trim())
          .filter((s) => s.length >= 2);
        if (subTopics.length > 0) {
          subTopics.forEach((st) => {
            const info = enrichSchoolTopic(st);
            items.push({ count: 1, label: info.label, query: info.query, aiPrompt: info.aiPrompt, raw: st });
          });
          continue;
        }
      }

      // Caso 2: Múltiples cantidades en una misma línea: "2 imágenes de moral y 2 de ética"
      const multiMatches = [...line.matchAll(/(\d+)\s*(?:im[aá]genes|imagen|fotos|foto|cuadros|ejemplos)?\s*(?:de\s+|sobre\s+)([a-záéíóúñü\s,]+?)(?=(?:\s+y\s+\d+\b|\s*,\s*\d+\b|$))/gi)];
      if (multiMatches.length >= 1) {
        for (const m of multiMatches) {
          const count = Math.max(1, Math.min(30, parseInt(m[1], 10) || 1));
          const rawSub = m[2].replace(/\(\s*una\s+cada\s+una\s*\)/gi, '').trim();
          // Si dice "3 imágenes de ejemplos de longitud, masa y tiempo" con exactamente 3 subtemas separados por coma/y
          const parts = rawSub.split(/,|\s+y\s+/i).map((s) => s.replace(/^\s*(la|el|los|las|ejemplos?\s+de)\s+/i, '').trim()).filter((s) => s.length >= 2);
          if (parts.length > 1 && parts.length === count) {
            parts.forEach((p) => {
              const info = enrichSchoolTopic(p);
              items.push({ count: 1, label: info.label, query: info.query, aiPrompt: info.aiPrompt, raw: p });
            });
          } else {
            const info = enrichSchoolTopic(rawSub);
            items.push({ count, label: info.label, query: info.query, aiPrompt: info.aiPrompt, raw: rawSub });
          }
        }
      }
    }

    const totalRequested = items.reduce((acc, it) => acc + it.count, 0);
    return {
      isMulti: items.length > 1 || separatedInfoTopics.length > 0 || sizeCm !== null,
      sizeCm,
      separatedInfoTopics,
      items,
      totalRequested
    };
  }

  function createInfoSvgDataUrl(title, subtitle, bullets, accentColor) {
    const color = accentColor || '#1e40af';
    const linesHtml = (bullets || []).map((b, idx) => {
      const y = 185 + idx * 58;
      return `<text x="32" y="${y}" font-family="Segoe UI, Arial, sans-serif" font-size="21" font-weight="600" fill="#1e293b">• ${b}</text>`;
    }).join('');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="500" height="500" viewBox="0 0 500 500">
      <rect width="500" height="500" rx="18" fill="#f8fafc" stroke="${color}" stroke-width="10"/>
      <rect x="0" y="0" width="500" height="96" rx="14" fill="${color}"/>
      <text x="250" y="46" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="25" font-weight="800" fill="#ffffff">${title}</text>
      <text x="250" y="78" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="17" font-weight="600" fill="#dbeafe">${subtitle}</text>
      ${linesHtml}
      <rect x="24" y="430" width="452" height="44" rx="10" fill="#eff6ff"/>
      <text x="250" y="458" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="16" font-weight="700" fill="${color}">INFORMACIÓN SEPARADA DE LAS IMÁGENES</text>
    </svg>`;
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }

  function buildJusticeInfoCards() {
    return [
      {
        label: 'Info Justicia 1/3: ¿Qué es?',
        src: createInfoSvgDataUrl(
          '¿QUÉ ES LA JUSTICIA?',
          'Ficha Informativa 1 (Separada)',
          [
            'Principio ético, moral y jurídico',
            'Dar a cada persona lo que corresponde',
            'Trato equitativo sin discriminación',
            'Base de la paz y convivencia social',
            'Protege la dignidad y los derechos'
          ],
          '#1d4ed8'
        )
      },
      {
        label: 'Info Justicia 2/3: Tipos',
        src: createInfoSvgDataUrl(
          'TIPOS DE JUSTICIA',
          'Ficha Informativa 2 (Separada)',
          [
            'Distributiva: reparto justo de bienes',
            'Conmutativa: igualdad en acuerdos',
            'Legal: cumplimiento de las leyes',
            'Social: bienestar y derechos para todos',
            'Restaurativa: reparar el daño causado'
          ],
          '#4338ca'
        )
      },
      {
        label: 'Info Justicia 3/3: Símbolos',
        src: createInfoSvgDataUrl(
          'SÍMBOLOS DE LA JUSTICIA',
          'Ficha Informativa 3 (Separada)',
          [
            'La Balanza: equilibrio e igualdad',
            'La Venda: imparcialidad ante todos',
            'La Espada: firmeza para aplicar la ley',
            'Ética: reflexión sobre lo justo y recto',
            'Moral: normas de conducta humana'
          ],
          '#0f766e'
        )
      }
    ];
  }

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
    const body = { q, per_page: Math.min(40, Math.max(3, n + 2)) };
    if (cfg && cfg.orientation) body.orientation = cfg.orientation;
    const endpoints = [PEXELS_PROXY, PEXELS_REMOTE_PROXY];
    let lastErr = null;
    for (const ep of endpoints) {
      try {
        const res = await fetch(ep, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
        });
        if (!res.ok) throw new Error('Pexels ' + res.status);
        const data = await res.json();
        const urls = (data.photos || []).map((p) => p.src && (p.src.large || p.src.large2x)).filter(Boolean);
        if (urls.length) return urls.slice(0, n);
      } catch (err) {
        lastErr = err;
      }
    }
    if (lastErr) throw lastErr;
    return [];
  }

  async function searchWikimedia(q, n) {
    const url = 'https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*' +
      '&generator=search&gsrnamespace=6&gsrlimit=' + Math.min(50, n * WIKI_OVERFETCH) +
      '&gsrsearch=' + encodeURIComponent(q + ' filetype:bitmap') +
      '&prop=imageinfo&iiprop=url|size&iiurlwidth=1280';
    const res = await fetch(url);
    if (!res.ok) throw new Error('Wikimedia ' + res.status);
    const pages = Object.values(((await res.json()).query || {}).pages || {});
    const wantLandscape = cfg && cfg.orientation === 'landscape';
    const wantPortrait = cfg && cfg.orientation === 'portrait';
    return pages
      .map((p) => p.imageinfo && p.imageinfo[0])
      .filter((ii) => ii && (!wantLandscape || ii.width > ii.height) && (!wantPortrait || ii.height > ii.width))
      .map((ii) => ii.thumburl || ii.url)
      .slice(0, n);
  }

  function buildPollinationsUrl(promptText, seedOffset) {
    const seed = Math.floor(Math.random() * 1000000) + (seedOffset || 0) * 137;
    const clean = encodeURIComponent(promptText + ', educational school illustration, high quality, clean background, no text');
    return 'https://image.pollinations.ai/prompt/' + clean + '?width=512&height=512&seed=' + seed + '&nologo=true';
  }

  function wantedCount() {
    const n = slotCount();
    if (!n) return cfg.addCount ? cfg.addCount() : 6;
    let empties = 0;
    for (let i = 0; i < n; i++) if (!cfg.get(i)) empties++;
    return empties || n;
  }

  async function fetchImagesForSubtask(item, usedUrls) {
    const needed = item.count;
    let found = [];
    try {
      const pex = await searchPexels(item.query, needed + 4);
      found = pex.filter((u) => !usedUrls.has(u));
    } catch (err) {
      console.warn('[ArkImagenes] Pexels subtask:', err);
    }
    if (found.length < needed) {
      try {
        const wiki = await searchWikimedia(item.query, needed + 4);
        wiki.forEach((u) => { if (!usedUrls.has(u) && found.length < needed) found.push(u); });
      } catch (err) {
        console.warn('[ArkImagenes] Wikimedia subtask:', err);
      }
    }
    while (found.length < needed) {
      found.push(buildPollinationsUrl(item.aiPrompt || item.query, found.length + 1));
    }
    const selectedUrls = found.slice(0, needed);
    selectedUrls.forEach((u) => usedUrls.add(u));
    return selectedUrls;
  }

  async function fillHomework(rawPrompt, opts) {
    const plan = parseHomeworkTasks(rawPrompt);
    const bar = (opts && opts.bar) || document.querySelector('.ark-img-bar');
    const status = bar ? bar.querySelector('.ark-status') : null;
    const setStatus = (msg) => { if (status) status.textContent = msg; };

    // Ajustar tamaño de cuadros si el prompt pide ej. "De 5x5"
    if (plan.sizeCm) {
      const selTamano = document.getElementById('selector-tamano');
      if (selTamano && String(selTamano.value) !== String(plan.sizeCm)) {
        selTamano.value = String(plan.sizeCm);
        selTamano.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }

    if (!plan.items.length) return null;

    const usedUrls = new Set();
    const finalSlots = [];
    const finalLabels = [];

    for (let idx = 0; idx < plan.items.length; idx++) {
      const it = plan.items[idx];
      setStatus(`🤖 Agente IA (${idx + 1}/${plan.items.length}): buscando ${it.count} de "${it.label}"…`);
      const urls = await fetchImagesForSubtask(it, usedUrls);
      urls.forEach((u, k) => {
        finalSlots.push(u);
        finalLabels.push(it.count > 1 ? `${it.label} (${k + 1}/${it.count})` : `${it.label}`);
      });
    }

    // Si hay huecos para completar los 20 cuadros de 5x5 y se pidió "separado de la información de la justicia"
    const totalGridSlots = slotCount() || 20;
    const fillRemainingMode = (opts && opts.remainingMode) || 'info_cards';
    if (plan.separatedInfoTopics.length > 0 && finalSlots.length < totalGridSlots && fillRemainingMode === 'info_cards') {
      const infoCards = buildJusticeInfoCards();
      let cardIdx = 0;
      while (finalSlots.length < totalGridSlots && cardIdx < infoCards.length) {
        finalSlots.push(infoCards[cardIdx].src);
        finalLabels.push(infoCards[cardIdx].label);
        cardIdx++;
      }
    }

    // Colocar en la plantilla
    for (let i = 0; i < finalSlots.length; i++) {
      cfg.set(i, finalSlots[i]);
    }
    if (typeof window.ARKAIOS_setSlotLabels === 'function') {
      window.ARKAIOS_setSlotLabels(finalLabels, plan);
    }

    const summary = plan.items.map((it) => `${it.count} ${it.label}`).join(' + ');
    setStatus(`✅ Agente IA surtió ${finalSlots.length} cuadros: ${summary}`);
    toast(`✅ Plantilla surtida (${finalSlots.length} cuadros)`);
    return { placed: finalSlots.length, plan, urls: finalSlots, labels: finalLabels };
  }

  async function autoFill(bar) {
    const q = bar.querySelector('.ark-topic').value.trim();
    if (!q) { toast('Escribe primero un tema o pega las instrucciones de la tarea.'); bar.querySelector('.ark-topic').focus(); return; }
    const btn = bar.querySelector('.ark-fill');
    const status = bar.querySelector('.ark-status');
    btn.disabled = true;
    try {
      const plan = parseHomeworkTasks(q);
      if (plan.items.length > 1 || (plan.items.length === 1 && plan.items[0].count >= 1 && /\d/.test(q))) {
        await fillHomework(q, { bar });
        return;
      }
      const enriched = enrichSchoolTopic(q);
      const n = Math.max(1, Math.min(40, wantedCount()));
      status.textContent = '🔍 Buscando fotos de "' + enriched.label + '"…';
      let urls = [];
      let source = 'Pexels';
      try { urls = await searchPexels(enriched.query, n); } catch (err) { console.warn('[ArkImagenes] Pexels:', err); }
      if (!urls.length) {
        source = 'Wikimedia Commons';
        status.textContent = '🔍 Buscando en Wikimedia Commons…';
        urls = await searchWikimedia(enriched.query, n);
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

  async function generateAI(bar, explicitSlot) {
    const q = bar.querySelector('.ark-topic').value.trim();
    if (!q) { toast('Escribe primero un tema.'); bar.querySelector('.ark-topic').focus(); return; }
    const btn = bar.querySelector('.ark-ai');
    const status = bar.querySelector('.ark-status');
    const i = typeof explicitSlot === 'number' && explicitSlot >= 0 ? explicitSlot : targetSlot();
    btn.disabled = true;
    status.textContent = '🎨 Generando imagen IA' + (i >= 0 ? ' para el recuadro ' + (i + 1) : '') + '…';
    try {
      const enriched = enrichSchoolTopic(q);
      let imgSrc = '';
      try {
        const puter = await loadPuter();
        const prompt = enriched.aiPrompt + ', ' + (cfg.aiHint || 'ilustración educativa, colores claros, sin texto');
        const imgEl = await Promise.race([
          puter.ai.txt2img(prompt),
          new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 9000))
        ]);
        if (imgEl && imgEl.src) imgSrc = imgEl.src;
      } catch (puterErr) {
        console.warn('[ArkImagenes] Puter fallback a Pollinations FLUX:', puterErr.message);
      }
      if (!imgSrc) {
        imgSrc = buildPollinationsUrl(enriched.aiPrompt, i + 1);
      }
      if (i >= 0) put(i, imgSrc);
      else if (cfg.add) cfg.add([imgSrc]);
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
      '<input type="text" class="ark-topic" maxlength="1000" placeholder="Tema o pega tu tarea completa (ej. 10 imágenes de justicia, 2 de moral, 2 de ética, 3 de longitud, masa y tiempo de 5x5)…">' +
      '<button type="button" class="ark-fill ark-primary">🤖 Autollenar / Surtir Tarea</button>' +
      '<button type="button" class="ark-ai">🎨 Generar con IA</button>' +
      '<span class="ark-status"></span>' +
      '<p class="ark-hint"><b>Autollenar / Surtir Tarea</b> entiende un tema simple o una lista escolar con varias cantidades (ej. WhatsApp). ' +
      '<b>Generar con IA</b> crea una ilustración en el recuadro seleccionado. ' +
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
    parseHomeworkTasks,
    fillHomework: (promptText, opts) => (cfg ? fillHomework(promptText, opts) : Promise.resolve(null)),
    generateForSlot: (i) => {
      const bar = document.querySelector('.ark-img-bar');
      if (bar) return generateAI(bar, i);
    },
    toast
  };
})();
