/**
 * ARKAIOS Orquestador de Plantillas (HTML+)
 * Integracion no invasiva para convertir plantillas HTML simples en plantillas inteligentes.
 */
(function () {
  'use strict';

  const VERSION = '0.1.0';
  const REGISTRY_KEY = 'arkaios_template_registry';
  const FIELD_SELECTOR = [
    'input:not([type="hidden"]):not([type="file"]):not([type="button"]):not([type="submit"])',
    'textarea',
    'select',
    '[contenteditable="true"]',
    '[data-arkaios-module]'
  ].join(',');
  const IMAGE_SLOT_SELECTOR = [
    '.arkaios-image-slot',
    '[data-arkaios-slot]',
    '[data-arkaios-image]',
    '.image-slot',
    '.img-slot'
  ].join(',');

  let panel;
  let panelBody;
  let modules = [];
  let statusEl;

  function isElementVisible(el) {
    const style = window.getComputedStyle(el);
    return style.display !== 'none' && style.visibility !== 'hidden';
  }

  function getTemplateId() {
    const bodyId = (document.body && document.body.dataset && document.body.dataset.arkaiosTemplate) || '';
    if (bodyId) return bodyId;
    const path = (window.location.pathname || '').split('/').pop() || 'template.html';
    return path.replace(/[^a-zA-Z0-9_.-]+/g, '-');
  }

  function getElLabel(el, idx) {
    const fromAttr = el.getAttribute('aria-label') || el.getAttribute('placeholder') || el.getAttribute('name');
    if (fromAttr) return fromAttr;
    const id = el.id;
    if (id) {
      const label = document.querySelector(`label[for="${id}"]`);
      if (label && label.textContent) return label.textContent.trim();
    }
    const txt = (el.textContent || '').trim();
    if (el.isContentEditable && txt) return txt.slice(0, 60);
    return `modulo_${idx + 1}`;
  }

  function moduleTypeFor(el) {
    const tag = el.tagName.toLowerCase();
    if (tag === 'select') return 'select';
    if (tag === 'textarea' || el.isContentEditable) return 'text';
    if (tag === 'input') {
      const t = (el.getAttribute('type') || 'text').toLowerCase();
      if (t === 'number') return 'number';
      if (t === 'date') return 'date';
      return 'text';
    }
    return 'text';
  }

  function readValue(el) {
    if (el.isContentEditable) return el.innerText || '';
    if ('value' in el) return el.value || '';
    return (el.textContent || '').trim();
  }

  function writeValue(el, value) {
    const safeValue = value == null ? '' : String(value);
    if (el.isContentEditable) {
      el.innerText = safeValue;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      return;
    }
    if ('value' in el) {
      el.value = safeValue;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return;
    }
    el.textContent = safeValue;
  }

  function discoverModules() {
    const fields = Array.from(document.querySelectorAll(FIELD_SELECTOR)).filter(isElementVisible);
    modules = fields.map((el, idx) => {
      if (!el.dataset.arkaiosModule) {
        el.dataset.arkaiosModule = `module_${idx + 1}`;
      }
      return {
        id: el.dataset.arkaiosModule,
        label: getElLabel(el, idx),
        type: moduleTypeFor(el),
        selector: `[data-arkaios-module="${el.dataset.arkaiosModule}"]`
      };
    });

    const imageSlots = Array.from(document.querySelectorAll(IMAGE_SLOT_SELECTOR));
    imageSlots.forEach((el, idx) => {
      if (!el.dataset.arkaiosSlot) el.dataset.arkaiosSlot = `image_slot_${idx + 1}`;
      modules.push({
        id: el.dataset.arkaiosSlot,
        label: el.dataset.arkaiosSlot,
        type: 'image',
        selector: `[data-arkaios-slot="${el.dataset.arkaiosSlot}"]`
      });
    });
    return modules;
  }

  function snapshotTemplate() {
    const templateId = getTemplateId();
    return {
      id: templateId,
      version: VERSION,
      url: window.location.href,
      title: document.title || templateId,
      discoveredAt: new Date().toISOString(),
      modules: discoverModules()
    };
  }

  function saveTemplateRegistry(schema) {
    let db = [];
    try {
      db = JSON.parse(localStorage.getItem(REGISTRY_KEY) || '[]');
      if (!Array.isArray(db)) db = [];
    } catch (err) {
      db = [];
    }
    const idx = db.findIndex((x) => x && x.id === schema.id);
    if (idx >= 0) db[idx] = schema;
    else db.unshift(schema);
    db = db.slice(0, 40);
    try {
      localStorage.setItem(REGISTRY_KEY, JSON.stringify(db));
    } catch (err) {
      // Ignore storage quota failures.
    }
  }

  function getModuleById(moduleId) {
    const m = modules.find((x) => x.id === moduleId);
    if (!m) return null;
    const el = document.querySelector(m.selector);
    return el ? { module: m, el } : null;
  }

  function insertImage(moduleId, url) {
    const found = getModuleById(moduleId);
    if (!found) return false;
    const { el } = found;
    if (!url) return false;
    const img = document.createElement('img');
    img.src = url;
    img.alt = 'ARKAIOS image';
    img.style.maxWidth = '100%';
    img.style.maxHeight = '100%';
    img.style.objectFit = 'contain';
    if (el.tagName.toLowerCase() === 'img') {
      el.src = url;
    } else {
      el.innerHTML = '';
      el.appendChild(img);
    }
    return true;
  }

  function fillFromObject(payload) {
    if (!payload || typeof payload !== 'object') return { updated: 0, skipped: 0 };
    let updated = 0;
    let skipped = 0;
    Object.entries(payload).forEach(([moduleId, value]) => {
      const found = getModuleById(moduleId);
      if (!found) {
        skipped += 1;
        return;
      }
      const type = found.module.type;
      if (type === 'image' && typeof value === 'string') {
        if (insertImage(moduleId, value)) updated += 1;
        else skipped += 1;
        return;
      }
      writeValue(found.el, value);
      updated += 1;
    });
    return { updated, skipped };
  }

  function collectData() {
    discoverModules();
    const data = {};
    modules.forEach((m) => {
      if (m.type === 'image') return;
      const el = document.querySelector(m.selector);
      if (!el) return;
      data[m.id] = readValue(el);
    });
    return data;
  }

  function setStatus(msg, isError) {
    if (!statusEl) return;
    statusEl.textContent = msg || '';
    statusEl.style.color = isError ? '#fca5a5' : '#93c5fd';
  }

  async function resolveImageValue(value) {
    if (!value || typeof value !== 'string') return '';
    if (/^https?:\/\//i.test(value) || value.startsWith('data:image/')) return value;
    try {
      const resp = await fetch('/api/arkaios-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'grok-2-image-1212',
          prompt: value,
          size: '1024x1024'
        })
      });
      if (!resp.ok) return '';
      const data = await resp.json();
      const url = data?.data?.[0]?.url || '';
      if (url) return url;
      const b64 = data?.data?.[0]?.b64_json || '';
      return b64 ? `data:image/png;base64,${b64}` : '';
    } catch {
      return '';
    }
  }

  async function askAssistant(prompt) {
    const text = (prompt || '').trim();
    if (!text) return;
    const template = snapshotTemplate();
    const data = collectData();
    setStatus('Consultando IA...');

    try {
      const resp = await fetch('/api/arkaios-orquestador', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: text, template, data })
      });
      const result = await resp.json();
      if (!resp.ok) {
        setStatus(`Error IA: ${result?.error || 'respuesta no valida'}`, true);
        return;
      }

      const fillResult = fillFromObject(result.fill || {});
      const imageEntries = Object.entries(result.images || {});
      for (const [slotId, rawValue] of imageEntries) {
        const url = await resolveImageValue(rawValue);
        if (url) insertImage(slotId, url);
      }

      setStatus(`${result.reply || 'Listo.'} | actualizados: ${fillResult.updated}`);

      window.postMessage(
        {
          source: 'ARKAIOS_ORQUESTADOR',
          type: 'ARKAIOS_ASSISTANT_REQUEST',
          payload: { prompt: text, template, data }
        },
        '*'
      );
    } catch (err) {
      setStatus(`Error de conexion: ${err.message}`, true);
    }
  }

  function createPanel() {
    const style = document.createElement('style');
    style.textContent = `
      #ark-orq-fab {
        position: fixed; right: 18px; bottom: 18px; z-index: 99997;
        border: none; border-radius: 999px; padding: 10px 14px;
        background: #0f766e; color: #fff; font: 600 13px/1.2 Inter,system-ui,sans-serif;
        cursor: pointer; box-shadow: 0 6px 20px rgba(15,118,110,.35);
      }
      #ark-orq-panel {
        position: fixed; right: 18px; bottom: 66px; width: min(400px, calc(100vw - 24px));
        max-height: min(75vh, 650px); background: #0f172a; color: #e2e8f0;
        border: 1px solid #1e293b; border-radius: 12px; z-index: 99998;
        display: none; box-shadow: 0 10px 35px rgba(2,6,23,.55); overflow: hidden;
        font: 500 13px/1.35 Inter,system-ui,sans-serif;
      }
      #ark-orq-panel.open { display: block; }
      #ark-orq-head {
        display: flex; align-items: center; justify-content: space-between;
        padding: 10px 12px; background: #111827; border-bottom: 1px solid #1f2937;
      }
      #ark-orq-head strong { font-size: 13px; color: #f8fafc; }
      #ark-orq-head button {
        border: 1px solid #334155; background: #1e293b; color: #cbd5e1; border-radius: 8px;
        padding: 4px 8px; cursor: pointer; font-size: 12px;
      }
      #ark-orq-body { padding: 10px 12px; overflow: auto; max-height: calc(min(75vh, 650px) - 50px); }
      #ark-orq-body .meta { color: #94a3b8; margin-bottom: 10px; font-size: 12px; }
      #ark-orq-body ul { margin: 0 0 12px 18px; padding: 0; }
      #ark-orq-body li { margin: 0 0 5px; }
      #ark-orq-body textarea {
        width: 100%; min-height: 70px; background: #020617; color: #e2e8f0;
        border: 1px solid #334155; border-radius: 8px; padding: 8px;
      }
      #ark-orq-body .row { display: flex; gap: 8px; margin-top: 8px; }
      #ark-orq-body .row button {
        border: none; border-radius: 8px; padding: 8px 10px; cursor: pointer; font-weight: 600;
      }
      #ark-orq-refresh { background: #1d4ed8; color: #fff; }
      #ark-orq-send { background: #0f766e; color: #fff; }
      #ark-orq-status { margin-top: 8px; font-size: 12px; color: #93c5fd; min-height: 16px; }
    `;
    document.head.appendChild(style);

    const fab = document.createElement('button');
    fab.id = 'ark-orq-fab';
    fab.type = 'button';
    fab.textContent = 'ARK AI';

    panel = document.createElement('div');
    panel.id = 'ark-orq-panel';
    panel.innerHTML = `
      <div id="ark-orq-head">
        <strong>Orquestador ARKAIOS</strong>
        <button id="ark-orq-close" type="button">Cerrar</button>
      </div>
      <div id="ark-orq-body"></div>
    `;
    panelBody = panel.querySelector('#ark-orq-body');

    document.body.appendChild(fab);
    document.body.appendChild(panel);

    fab.addEventListener('click', () => {
      panel.classList.toggle('open');
      if (panel.classList.contains('open')) renderPanel();
    });
    panel.querySelector('#ark-orq-close').addEventListener('click', () => panel.classList.remove('open'));
  }

  function renderPanel() {
    const schema = snapshotTemplate();
    const rows = schema.modules
      .slice(0, 20)
      .map((m) => `<li><code>${m.id}</code> <span>(${m.type})</span> ${m.label ? `- ${m.label}` : ''}</li>`)
      .join('');
    panelBody.innerHTML = `
      <div class="meta"><strong>${schema.title}</strong><br>${schema.modules.length} modulos detectados</div>
      <ul>${rows || '<li>Sin modulos detectados</li>'}</ul>
      <textarea id="ark-orq-prompt" placeholder="Ejemplo: genera texto para module_1 sobre ecosistemas y tono infantil"></textarea>
      <div class="row">
        <button id="ark-orq-refresh" type="button">Reescanear</button>
        <button id="ark-orq-send" type="button">Enviar a IA</button>
      </div>
      <div id="ark-orq-status"></div>
    `;
    const prompt = panelBody.querySelector('#ark-orq-prompt');
    statusEl = panelBody.querySelector('#ark-orq-status');
    panelBody.querySelector('#ark-orq-refresh').addEventListener('click', renderPanel);
    panelBody.querySelector('#ark-orq-send').addEventListener('click', async () => {
      await askAssistant(prompt.value);
    });
  }

  function bindInyecButtons() {
    const allButtons = Array.from(document.querySelectorAll('button, [role="button"], .btn'));
    allButtons.forEach((btn) => {
      const idClass = `${btn.id || ''} ${btn.className || ''}`.toLowerCase();
      const text = (btn.textContent || '').toLowerCase();
      const looksLikeInyec = idClass.includes('inyec') || text.includes('inyec');
      if (!looksLikeInyec || btn.dataset.arkaiosOrqBound === '1') return;
      btn.dataset.arkaiosOrqBound = '1';
      btn.addEventListener('click', () => {
        if (panel) {
          panel.classList.add('open');
          renderPanel();
        }
      });
    });
  }

  function installMessageBridge() {
    window.addEventListener('message', (event) => {
      const msg = event.data;
      if (!msg || typeof msg !== 'object') return;
      if (msg.type === 'ARKAIOS_TEMPLATE_FILL' && msg.payload) {
        const result = fillFromObject(msg.payload);
        window.postMessage({ source: 'ARKAIOS_ORQUESTADOR', type: 'ARKAIOS_TEMPLATE_FILL_RESULT', payload: result }, '*');
      }
      if (msg.type === 'ARKAIOS_TEMPLATE_SCAN_REQUEST') {
        window.postMessage({ source: 'ARKAIOS_ORQUESTADOR', type: 'ARKAIOS_TEMPLATE_SCHEMA', payload: snapshotTemplate() }, '*');
      }
    });
  }

  function installPublicApi() {
    window.ARKAIOS_Orquestador = {
      version: VERSION,
      scanTemplate: snapshotTemplate,
      collectData,
      fillTemplate: fillFromObject,
      insertImage,
      openAssistant: function () {
        if (panel) {
          panel.classList.add('open');
          renderPanel();
        }
      },
      exportSchema: function () {
        return JSON.stringify(snapshotTemplate(), null, 2);
      }
    };
  }

  function init() {
    discoverModules();
    saveTemplateRegistry(snapshotTemplate());
    createPanel();
    bindInyecButtons();
    installMessageBridge();
    installPublicApi();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
