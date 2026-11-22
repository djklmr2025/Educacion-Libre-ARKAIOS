/**
 * ARKAIOS EDU — Motor de "Modo Word" y Gestión de "Mis Trabajos"
 * Formato portable de trabajo estructurado (.arkwork.json)
 * Persistencia local en navegador (localStorage / IndexedDB)
 * Edición visual directa sobre la hoja carta, autoreconocimiento de campos
 * y distinción clara entre "Guardar Trabajo (editable)" y "Exportar a PDF".
 */
(function (global) {
  'use strict';

  const STORAGE_KEY = 'ark_my_works_v1';
  const CURRENT_WORK_KEY = 'ark_current_active_work_id';
  const SAFE_IMG_SRC = /^(data:image\/(png|jpe?g|gif|webp|svg\+xml);base64,[A-Za-z0-9+/=]+|https?:\/\/[^\s"'<>]+)$/i;

  const ArkMyWorks = {
    // Retorna todos los trabajos guardados localmente
    getWorks: function () {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)) : [];
      } catch (e) {
        console.error('[ArkMyWorks] Error al leer trabajos:', e);
        return [];
      }
    },

    // Obtiene un trabajo por su ID
    getWork: function (id) {
      const works = this.getWorks();
      return works.find((w) => w.id === id) || null;
    },

    // Guarda o actualiza un trabajo en almacenamiento local
    saveWork: function (workData) {
      if (!workData || !workData.template) {
        throw new Error('Faltan datos requeridos (template)');
      }

      const works = this.getWorks();
      const now = Date.now();
      const id = workData.id || `work_${now}_${Math.random().toString(36).slice(2, 8)}`;

      const title = (workData.title || '').trim() || 'Trabajo sin título';
      const existingIndex = works.findIndex((w) => w.id === id);

      const workRecord = {
        schema: 'arkaios.edu.work.v1',
        id: id,
        title: title,
        template: workData.template,
        templateLabel: workData.templateLabel || workData.template,
        createdAt: existingIndex >= 0 ? works[existingIndex].createdAt : (workData.createdAt || now),
        updatedAt: now,
        data: workData.data || {}
      };

      if (existingIndex >= 0) {
        works[existingIndex] = workRecord;
      } else {
        works.unshift(workRecord);
      }

      localStorage.setItem(STORAGE_KEY, JSON.stringify(works));
      localStorage.setItem(CURRENT_WORK_KEY, id);
      return workRecord;
    },

    // Elimina un trabajo
    deleteWork: function (id) {
      const works = this.getWorks().filter((w) => w.id !== id);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(works));
      if (localStorage.getItem(CURRENT_WORK_KEY) === id) {
        localStorage.removeItem(CURRENT_WORK_KEY);
      }
      return true;
    },

    // Duplica un trabajo existente
    duplicateWork: function (id) {
      const original = this.getWork(id);
      if (!original) throw new Error('Trabajo no encontrado');

      const clone = JSON.parse(JSON.stringify(original));
      clone.id = null;
      clone.title = `Copia de ${original.title}`;
      clone.createdAt = Date.now();
      clone.updatedAt = Date.now();
      return this.saveWork(clone);
    },

    // Descarga el archivo portable .arkwork.json
    exportWorkJson: function (id) {
      const work = this.getWork(id);
      if (!work) throw new Error('Trabajo no encontrado');

      const jsonStr = JSON.stringify(work, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const safeTitle = (work.title || 'trabajo').replace(/[/\\?%*:|"<>]/g, '-').trim();
      a.href = url;
      a.download = `${safeTitle}.arkwork.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    },

    // Importa un archivo .arkwork.json desde disco
    importWorkJson: function (file) {
      return new Promise((resolve, reject) => {
        if (!file) return reject(new Error('No se seleccionó ningún archivo'));
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const parsed = JSON.parse(e.target.result);
            if (!parsed || !parsed.template || (!parsed.data && !parsed.fields)) {
              return reject(new Error('El archivo no tiene el formato válido de ARKAIOS Work'));
            }

            // Normalización
            const title = parsed.title || file.name.replace(/\.arkwork\.json$/i, '').replace(/\.json$/i, '');
            const newWork = {
              title: `${title} (importado)`,
              template: parsed.template,
              templateLabel: parsed.templateLabel || parsed.template,
              data: parsed.data || { __arkGeneric: 1, fields: parsed.fields || [], images: parsed.images || [] }
            };

            const saved = ArkMyWorks.saveWork(newWork);
            resolve(saved);
          } catch (err) {
            reject(new Error('Error al interpretar el archivo JSON: ' + err.message));
          }
        };
        reader.onerror = () => reject(new Error('Error al leer el archivo'));
        reader.readAsText(file);
      });
    },

    // Extrae y captura el estado completo editable de una plantilla dentro del iframe
    captureFrameData: function (frame) {
      const win = frame?.contentWindow;
      if (!win) return null;

      try {
        // 1. Si la plantilla implementa su propio exportador oficial
        if (typeof win.ARKAIOS_getData === 'function') {
          return win.ARKAIOS_getData();
        }

        // 2. Si existe ArkComunidad con captureFrame
        if (global.ArkComunidad && typeof global.ArkComunidad.captureFrame === 'function') {
          const cData = global.ArkComunidad.captureFrame(frame);
          if (cData) return cData;
        }

        // 3. Captura exhaustiva genérica de autoreconocimiento
        const doc = win.document;
        const fields = [];
        const editables = doc.querySelectorAll('[contenteditable="true"], input, textarea, select');
        editables.forEach((el, index) => {
          if (el.tagName === 'INPUT' && /^(file|button|submit|reset|image|hidden|password)$/i.test(el.type)) return;
          const selector = el.id ? `#${el.id}` : (el.name ? `[name="${el.name}"]` : null);
          if (el.isContentEditable) {
            fields.push({ i: index, sel: selector, t: 'text', v: el.innerHTML });
          } else if (el.type === 'checkbox' || el.type === 'radio') {
            fields.push({ i: index, sel: selector, t: 'check', v: el.checked });
          } else {
            fields.push({ i: index, sel: selector, t: 'value', v: el.value });
          }
        });

        const images = [];
        const imgEls = doc.querySelectorAll('img');
        imgEls.forEach((img, index) => {
          const src = img.getAttribute('src') || '';
          if (src && !src.startsWith('chrome://')) {
            images.push({ i: index, id: img.id || null, src: src });
          }
        });

        // Contenedores con imágenes de fondo o clases dinámicas
        const bgContainers = [];
        const bgEls = doc.querySelectorAll('[style*="background-image"], .photo-placeholder, .image-slot, .card-image');
        bgEls.forEach((bg, index) => {
          bgContainers.push({
            i: index,
            id: bg.id || null,
            bg: bg.style.backgroundImage || '',
            className: bg.className || ''
          });
        });

        return {
          __arkWorkData: 1,
          fields: fields,
          images: images,
          bgContainers: bgContainers
        };
      } catch (err) {
        console.warn('[ArkMyWorks] No se pudo capturar estado:', err);
        return null;
      }
    },

    // Restaura fielmente el estado editable en la plantilla dentro del iframe
    restoreFrameData: function (frame, data) {
      const win = frame?.contentWindow;
      if (!win || !data) return false;

      try {
        // 1. Si la plantilla tiene su propio restaurador nativo
        if (typeof win.ARKAIOS_setData === 'function') {
          win.ARKAIOS_setData(data);
          return true;
        }

        // 2. Si los datos fueron guardados con ArkComunidad genérico
        if (data.__arkGeneric && global.ArkComunidad && typeof global.ArkComunidad.restoreFrame === 'function') {
          return global.ArkComunidad.restoreFrame(frame, data);
        }

        const doc = win.document;

        // 3. Restauración con autoreconocimiento exhaustivo
        if (data.__arkWorkData) {
          const editables = [...doc.querySelectorAll('[contenteditable="true"], input, textarea, select')]
            .filter((el) => !(el.tagName === 'INPUT' && /^(file|button|submit|reset|image|hidden|password)$/i.test(el.type)));

          (data.fields || []).forEach((f) => {
            let el = null;
            if (f.sel) el = doc.querySelector(f.sel);
            if (!el && typeof f.i === 'number' && editables[f.i]) el = editables[f.i];
            if (!el) return;

            if (f.t === 'text' && el.isContentEditable) {
              el.innerHTML = f.v;
            } else if (f.t === 'check' && 'checked' in el) {
              el.checked = !!f.v;
            } else if (f.t === 'value' && 'value' in el) {
              el.value = String(f.v ?? '');
            }
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
          });

          const imgEls = [...doc.querySelectorAll('img')];
          (data.images || []).forEach((imgData) => {
            let img = null;
            if (imgData.id) img = doc.getElementById(imgData.id);
            if (!img && typeof imgData.i === 'number' && imgEls[imgData.i]) img = imgEls[imgData.i];
            if (img && imgData.src) {
              img.src = imgData.src;
              img.parentElement?.classList.add('has');
            }
          });

          if (Array.isArray(data.bgContainers)) {
            const bgEls = [...doc.querySelectorAll('[style*="background-image"], .photo-placeholder, .image-slot, .card-image')];
            data.bgContainers.forEach((c) => {
              let bgEl = null;
              if (c.id) bgEl = doc.getElementById(c.id);
              if (!bgEl && typeof c.i === 'number' && bgEls[c.i]) bgEl = bgEls[c.i];
              if (bgEl) {
                if (c.bg) bgEl.style.backgroundImage = c.bg;
                if (c.className) bgEl.className = c.className;
              }
            });
          }
          return true;
        }

        // Fallback simple por si venía estructurado plano
        if (typeof data === 'object') {
          Object.keys(data).forEach((key) => {
            const el = doc.getElementById(key) || doc.querySelector(`[name="${key}"]`);
            if (el) {
              if (el.isContentEditable) el.innerHTML = data[key];
              else el.value = data[key];
              el.dispatchEvent(new Event('input', { bubbles: true }));
            }
          });
          return true;
        }

        return false;
      } catch (err) {
        console.warn('[ArkMyWorks] Error al restaurar estado:', err);
        return false;
      }
    },

    // Formateador amigable de fecha
    formatDate: function (timestamp) {
      if (!timestamp) return 'Fecha desconocida';
      const d = new Date(timestamp);
      return d.toLocaleDateString('es-MX', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
  };

  global.ArkMyWorks = ArkMyWorks;
})(window);
