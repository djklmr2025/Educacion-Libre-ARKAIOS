/**
 * ARKAIOS — Conector de Biblioteca de Material Educativo
 * =====================================================
 * Incluye este script en cualquier plantilla con:
 *   <script src="arkaios-biblioteca.js"></script>
 *
 * Qué hace:
 *  - Al cargar la página revisa si hay un PDF pendiente en localStorage
 *    (clave: "arkaios_pending_load")
 *  - Si existe, muestra un panel flotante de "Material de Referencia"
 *    con el PDF renderizado página a página usando PDF.js
 *  - El panel es colapsable, redimensionable y no interfiere con la plantilla
 *  - Al cerrar el panel limpia el localStorage
 */

(function () {
  'use strict';

  const PENDING_KEY = 'arkaios_pending_load';

  /* ── 1. Verificar si hay material pendiente ── */
  let pendingRaw = null;
  try { pendingRaw = localStorage.getItem(PENDING_KEY); } catch (e) { return; }
  if (!pendingRaw) return;

  let pending = null;
  try { pending = JSON.parse(pendingRaw); } catch (e) { return; }
  if (!pending || !pending.data) return;

  /* ── 2. Inyectar PDF.js si la página no lo tiene ya ── */
  function ensurePdfJs(cb) {
    if (window.pdfjsLib) { cb(); return; }
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    s.onload = () => {
      pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      cb();
    };
    document.head.appendChild(s);
  }

  /* ── 3. Crear el panel flotante ── */
  function buildPanel() {
    const meta = pending.metadata || {};
    const title = meta.title || 'Material de Referencia';
    const code  = meta.code  || '';

    const style = document.createElement('style');
    style.textContent = `
      #ark-ref-panel {
        position: fixed;
        top: 0; right: 0;
        width: 360px;
        height: 100vh;
        background: #0f172a;
        box-shadow: -4px 0 24px rgba(0,0,0,0.45);
        z-index: 99999;
        display: flex;
        flex-direction: column;
        font-family: 'Inter', system-ui, sans-serif;
        transition: transform 0.3s ease;
      }
      #ark-ref-panel.collapsed { transform: translateX(324px); }

      #ark-ref-header {
        background: #1e293b;
        padding: 12px 14px;
        display: flex;
        align-items: center;
        gap: 10px;
        flex-shrink: 0;
        border-bottom: 1px solid #334155;
      }
      #ark-ref-toggle {
        background: #2563eb;
        border: none;
        color: white;
        width: 32px; height: 32px;
        border-radius: 8px;
        cursor: pointer;
        font-size: 16px;
        flex-shrink: 0;
        display: flex; align-items: center; justify-content: center;
        transition: background 0.2s;
      }
      #ark-ref-toggle:hover { background: #1e40af; }
      #ark-ref-title {
        flex: 1;
        overflow: hidden;
      }
      #ark-ref-title strong {
        display: block;
        color: white;
        font-size: 13px;
        font-weight: 600;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      #ark-ref-title span {
        color: #64748b;
        font-size: 11px;
      }
      #ark-ref-close {
        background: #ef4444;
        border: none;
        color: white;
        width: 28px; height: 28px;
        border-radius: 6px;
        cursor: pointer;
        font-size: 13px;
        font-weight: 700;
        flex-shrink: 0;
        display: flex; align-items: center; justify-content: center;
      }
      #ark-ref-close:hover { background: #dc2626; }

      #ark-ref-body {
        flex: 1;
        overflow-y: auto;
        padding: 16px 12px;
        display: flex;
        flex-direction: column;
        gap: 12px;
        background: #1e293b;
      }
      #ark-ref-body canvas {
        width: 100%;
        height: auto;
        border-radius: 6px;
        box-shadow: 0 2px 12px rgba(0,0,0,0.4);
        background: white;
        display: block;
      }
      .ark-page-label {
        color: #64748b;
        font-size: 10px;
        text-align: center;
        padding-top: 2px;
      }
      #ark-ref-loading {
        color: #64748b;
        font-size: 13px;
        text-align: center;
        padding: 40px 0;
      }
      .ark-spinner {
        width: 32px; height: 32px;
        border: 3px solid rgba(255,255,255,0.1);
        border-top-color: #60a5fa;
        border-radius: 50%;
        animation: arkSpin 0.8s linear infinite;
        margin: 0 auto 12px;
      }
      @keyframes arkSpin { to { transform: rotate(360deg); } }

      /* Pestaña cuando está colapsado */
      #ark-ref-tab {
        position: fixed;
        top: 50%;
        right: 0;
        transform: translateY(-50%);
        background: #2563eb;
        color: white;
        writing-mode: vertical-rl;
        padding: 12px 8px;
        border-radius: 8px 0 0 8px;
        font-size: 12px;
        font-weight: 700;
        cursor: pointer;
        z-index: 99998;
        display: none;
        letter-spacing: 1px;
        box-shadow: -2px 0 10px rgba(37,99,235,0.4);
        transition: background 0.2s;
      }
      #ark-ref-tab:hover { background: #1e40af; }
    `;
    document.head.appendChild(style);

    const panel = document.createElement('div');
    panel.id = 'ark-ref-panel';
    panel.innerHTML = `
      <div id="ark-ref-header">
        <button id="ark-ref-toggle" title="Colapsar / Expandir">◀</button>
        <div id="ark-ref-title">
          <strong>📎 ${title}</strong>
          <span>${code ? '📋 ' + code + ' — ' : ''}Material de referencia</span>
        </div>
        <button id="ark-ref-close" title="Cerrar y limpiar">✕</button>
      </div>
      <div id="ark-ref-body">
        <div id="ark-ref-loading">
          <div class="ark-spinner"></div>
          Cargando referencia…
        </div>
      </div>
    `;
    document.body.appendChild(panel);

    // Pestaña de reapertura
    const tab = document.createElement('div');
    tab.id = 'ark-ref-tab';
    tab.textContent = '📎 REF';
    tab.onclick = () => expandPanel();
    document.body.appendChild(tab);

    // Botón toggle
    document.getElementById('ark-ref-toggle').onclick = () => {
      if (panel.classList.contains('collapsed')) expandPanel();
      else collapsePanel();
    };

    // Botón cerrar
    document.getElementById('ark-ref-close').onclick = () => {
      panel.remove();
      tab.remove();
      try { localStorage.removeItem(PENDING_KEY); } catch(e){}
    };

    return panel;
  }

  function collapsePanel() {
    const p = document.getElementById('ark-ref-panel');
    const t = document.getElementById('ark-ref-tab');
    const btn = document.getElementById('ark-ref-toggle');
    if (p) { p.classList.add('collapsed'); btn.textContent = '▶'; }
    if (t) t.style.display = 'block';
  }

  function expandPanel() {
    const p = document.getElementById('ark-ref-panel');
    const t = document.getElementById('ark-ref-tab');
    const btn = document.getElementById('ark-ref-toggle');
    if (p) { p.classList.remove('collapsed'); btn.textContent = '◀'; }
    if (t) t.style.display = 'none';
  }

  /* ── 4. Renderizar todas las páginas del PDF ── */
  async function renderPdf(panel) {
    const body = document.getElementById('ark-ref-body');
    try {
      const base64 = pending.data.split(',')[1];
      const binary = atob(base64);
      const bytes  = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

      const pdf   = await pdfjsLib.getDocument({ data: bytes.buffer }).promise;
      const total = pdf.numPages;

      body.innerHTML = '';

      for (let p = 1; p <= total; p++) {
        const page     = await pdf.getPage(p);
        const viewport = page.getViewport({ scale: 1 });
        // Ajustar al ancho del panel (~332px útiles)
        const scale    = 332 / viewport.width;
        const sv       = page.getViewport({ scale });

        const canvas   = document.createElement('canvas');
        canvas.width   = sv.width;
        canvas.height  = sv.height;

        const wrapper  = document.createElement('div');
        const label    = document.createElement('div');
        label.className = 'ark-page-label';
        label.textContent = `Página ${p} de ${total}`;
        wrapper.appendChild(canvas);
        wrapper.appendChild(label);
        body.appendChild(wrapper);

        await page.render({ canvasContext: canvas.getContext('2d'), viewport: sv }).promise;
      }
    } catch (err) {
      body.innerHTML = `<p style="color:#f87171;text-align:center;padding:20px;">
        ⚠️ Error al cargar referencia:<br><small>${err.message}</small></p>`;
    }
  }

  /* ── 5. Arrancar cuando el DOM esté listo ── */
  function init() {
    const panel = buildPanel();
    ensurePdfJs(() => renderPdf(panel));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
