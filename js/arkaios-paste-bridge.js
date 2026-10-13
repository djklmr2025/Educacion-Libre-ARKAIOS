/*! arkaios-paste-bridge.js v1.0
 * Ctrl+V universal para TODAS las plantillas cargadas en #plantillaFrame (index.html).
 *  - Los botones ya no roban el foco del iframe.
 *  - Ctrl+V desde el shell se reenvia a la plantilla activa (imagenes, PDF y texto).
 *  - Si la plantilla no maneja el pegado por su cuenta, se usa su propio <input type=file>,
 *    su drop (ondrop) o el ultimo campo editable donde se escribio.
 * No requiere tocar cada plantilla ni exponer llaves en el cliente.
 */
(function () {
  'use strict';
  var FRAME_ID = 'plantillaFrame';
  // inputs file cuyo onchange se asigna al vuelo (fila/celda concreta): no sirven como destino generico
  var SKIP_INPUT_IDS = ['fileInputHidden', 'input-individual'];
  var state = { lastTarget: null, lastEditable: null };
  var NON_TEXT = /^(button|submit|reset|checkbox|radio|file|range|color|image|hidden)$/i;

  function frame() { return document.getElementById(FRAME_ID); }
  function frameDoc() {
    var f = frame();
    if (!f || f.style.display === 'none') return null;
    try { return f.contentDocument || null; } catch (_) { return null; }
  }
  function isTextField(el) {
    if (!el || el.nodeType !== 1) return false;
    if (el.tagName === 'TEXTAREA') return !el.readOnly && !el.disabled;
    if (el.tagName === 'INPUT') return !NON_TEXT.test(el.type) && !el.readOnly && !el.disabled;
    return !!el.isContentEditable;
  }
  function editableOf(n) {
    if (!n || !n.closest) return null;
    if (isTextField(n)) return n;
    var ce = n.closest('[contenteditable]:not([contenteditable="false"])');
    return ce && isTextField(ce) ? ce : null;
  }
  function toast(msg) { try { if (typeof window.showIndicator === 'function') window.showIndicator(msg); } catch (_) {} }

  function clipboardFiles(cd) {
    var out = Array.prototype.slice.call(cd.files || []);
    if (!out.length && cd.items) {
      Array.prototype.forEach.call(cd.items, function (it) {
        if (it.kind === 'file') { var f = it.getAsFile(); if (f) out.push(f); }
      });
    }
    return out;
  }

  function fileAccepted(input, file) {
    var acc = (input.getAttribute('accept') || '').trim();
    if (!acc) return true;
    return acc.split(',').some(function (tok) {
      tok = tok.trim().toLowerCase();
      if (!tok) return false;
      if (tok.charAt(0) === '.') return file.name.toLowerCase().slice(-tok.length) === tok;
      if (tok.slice(-2) === '/*') return (file.type || '').toLowerCase().indexOf(tok.slice(0, -1)) === 0;
      return (file.type || '').toLowerCase() === tok;
    });
  }

  function insertText(el, text) {
    var doc = el.ownerDocument;
    el.focus();
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
      var s = el.selectionStart == null ? el.value.length : el.selectionStart;
      var e = el.selectionEnd == null ? s : el.selectionEnd;
      el.setRangeText(text, s, e, 'end');
    } else if (!doc.execCommand('insertText', false, text)) {
      el.textContent += text;
    }
    el.dispatchEvent(new (doc.defaultView.Event)('input', { bubbles: true }));
  }

  function deliverFiles(doc, files, target) {
    var w = doc.defaultView;
    var from = (state.lastTarget && state.lastTarget.ownerDocument === doc && state.lastTarget.isConnected) ? state.lastTarget : target;

    // 1) Elemento con ondrop propio (p. ej. tarjetas de frutas): simular drop
    for (var el = from; el && el.nodeType === 1; el = el.parentElement) {
      if (typeof el.ondrop === 'function') {
        try {
          var dt = new w.DataTransfer();
          files.forEach(function (f) { dt.items.add(f); });
          el.dispatchEvent(new w.DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }));
          return true;
        } catch (_) { break; }
      }
    }

    // 2) <input type=file> propio de la plantilla (reutiliza su logica de carga)
    var best = null, bestFiles = [];
    Array.prototype.slice.call(doc.querySelectorAll('input[type=file]')).forEach(function (inp) {
      if (inp.disabled || SKIP_INPUT_IDS.indexOf(inp.id) >= 0) return;
      var ok = files.filter(function (f) { return fileAccepted(inp, f); });
      if (!ok.length) return;
      if (!best || (inp.multiple && !best.multiple)) { best = inp; bestFiles = ok; }
    });
    if (best) {
      var dt2 = new w.DataTransfer();
      (best.multiple ? bestFiles : bestFiles.slice(0, 1)).forEach(function (f) { dt2.items.add(f); });
      best.files = dt2.files;
      best.dispatchEvent(new w.Event('input', { bubbles: true }));
      best.dispatchEvent(new w.Event('change', { bubbles: true }));
      return true;
    }

    // 3) Sin destino: avisar y dejar un evento para quien quiera engancharse
    w.dispatchEvent(new w.CustomEvent('arkaios:file-pasted', { detail: { files: files } }));
    toast('Esta plantilla no acepta ese tipo de archivo');
    return false;
  }

  // Se registra en el window del iframe (fase burbuja): corre DESPUES de los handlers propios de la plantilla.
  function onTemplatePaste(e) {
    if (e.defaultPrevented) return;
    var cd = e.clipboardData;
    if (!cd) return;
    var doc = (e.target && e.target.ownerDocument) || null;
    if (!doc) return;
    var files = clipboardFiles(cd);
    if (files.length) { e.preventDefault(); deliverFiles(doc, files, e.target); return; }
    var text = cd.getData('text/plain');
    if (!text) return;
    var ed = editableOf(e.target);
    if (ed) {
      if (!e.isTrusted) { e.preventDefault(); insertText(ed, text); } // reenviado desde el shell
      return; // pegado nativo
    }
    var last = state.lastEditable;
    if (last && last.isConnected && last.ownerDocument === doc) { e.preventDefault(); insertText(last, text); }
  }

  function attach() {
    var f = frame(), w, d;
    try { w = f && f.contentWindow; d = f && f.contentDocument; } catch (_) { return; }
    if (!w || !d || w.__arkPasteBridge) return;
    w.__arkPasteBridge = true;
    d.addEventListener('pointerdown', function (e) { state.lastTarget = e.target; var ed = editableOf(e.target); if (ed) state.lastEditable = ed; }, true);
    d.addEventListener('focusin', function (e) { var ed = editableOf(e.target); if (ed) state.lastEditable = ed; }, true);
    w.addEventListener('paste', onTemplatePaste);
  }

  function forwardToTemplate(doc, files, text) {
    var w = doc.defaultView;
    var target = doc.activeElement && doc.activeElement !== doc.body ? doc.activeElement : null;
    if (!target && state.lastTarget && state.lastTarget.isConnected && state.lastTarget.ownerDocument === doc) target = state.lastTarget;
    if (!target) target = doc.body;
    var dt = new w.DataTransfer();
    files.forEach(function (f) { dt.items.add(f); });
    if (text && !files.length) dt.setData('text/plain', text);
    var ev;
    try { ev = new w.ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }); } catch (_) {}
    if (!ev || !ev.clipboardData) {
      ev = new w.Event('paste', { bubbles: true, cancelable: true });
      Object.defineProperty(ev, 'clipboardData', { value: dt });
    }
    target.dispatchEvent(ev);
  }

  // Ctrl+V con el foco en el shell (por ejemplo, despues de pulsar un boton)
  document.addEventListener('paste', function (e) {
    var doc = frameDoc();
    if (!doc || !e.clipboardData) return;
    if (isTextField(e.target)) return;                                  // chat IA, modales, buscador...
    if (document.querySelector('.modal.active, .modal-overlay.active, [id$="Modal"].active')) return;
    var files = clipboardFiles(e.clipboardData);
    var text = e.clipboardData.getData('text/plain');
    if (!files.length && !text) return;
    attach();
    e.preventDefault();
    forwardToTemplate(doc, files, text);
  }, true);

  // Los botones no deben robar el foco del iframe (asi Ctrl+V sigue llegando a la plantilla)
  document.addEventListener('mousedown', function (e) {
    var t = e.target;
    if (!t || !t.closest || !frameDoc()) return;
    if (t.closest('input, textarea, select, option, label, [contenteditable="true"]')) return;
    if (t.closest('button, .btn, [role="button"]')) e.preventDefault();
  }, true);

  function boot() {
    var f = frame();
    if (!f) return;
    f.addEventListener('load', attach);
    attach();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();

  window.ARKAIOS_PASTE_BRIDGE = { attach: attach, deliverFiles: deliverFiles };
})();
