/**
 * Test Suite para el Modo Word y Gestor de Mis Trabajos de ARKAIOS EDU
 * Verifica la serialización, almacenamiento, autoreconocimiento y reconstrucción.
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

// Mock simple de window y localStorage para pruebas Node
const storage = {};
global.localStorage = {
  getItem: (k) => storage[k] || null,
  setItem: (k, v) => { storage[k] = String(v); },
  removeItem: (k) => { delete storage[k]; }
};

global.window = global;
global.document = {
  body: {
    appendChild: () => {},
  },
  createElement: (tag) => ({
    tagName: tag.toUpperCase(),
    setAttribute: () => {},
    removeAttribute: () => {},
    click: () => {},
    remove: () => {}
  })
};

global.Blob = class {
  constructor(parts, opts) { this.parts = parts; this.opts = opts; }
};
global.URL = {
  createObjectURL: () => 'blob:mock-url',
  revokeObjectURL: () => {}
};

// Cargar arkaios-my-works.js
const scriptCode = fs.readFileSync(path.join(__dirname, '..', 'js', 'arkaios-my-works.js'), 'utf8');
eval(scriptCode);

console.log('--- INICIANDO PRUEBAS DE MODO WORD & MIS TRABAJOS ---');

// Test 1: Guardar un trabajo nuevo
const mockWork = {
  title: 'Tarea 1: Ciencias Naturales',
  template: 'plantilla_escolar_carta_mx_autoajuste_y_areas_editables.html',
  templateLabel: 'Carta MX - Índice + Texto',
  data: {
    __arkWorkData: 1,
    fields: [
      { i: 0, sel: '#tituloTarea', t: 'text', v: 'La Fotosíntesis y las Plantas' },
      { i: 1, sel: '#nombreAlumno', t: 'value', v: 'Estudiante Arkaios' }
    ],
    images: [
      { i: 0, id: 'imgPrincipal', src: 'https://images.unsplash.com/photo-leaf.jpg' }
    ]
  }
};

const saved = window.ArkMyWorks.saveWork(mockWork);
assert.ok(saved.id, 'Debe asignar un ID único al trabajo');
assert.strictEqual(saved.title, 'Tarea 1: Ciencias Naturales', 'El título debe coincidir');
console.log('✅ Test 1: Guardar trabajo inicial superado (ID:', saved.id, ')');

// Test 2: Obtener lista de trabajos
const list = window.ArkMyWorks.getWorks();
assert.strictEqual(list.length, 1, 'Debe haber 1 trabajo en localStorage');
assert.strictEqual(list[0].id, saved.id);
console.log('✅ Test 2: Listar trabajos guardados superado');

// Test 3: Duplicar trabajo
const clone = window.ArkMyWorks.duplicateWork(saved.id);
assert.notStrictEqual(clone.id, saved.id, 'El duplicado debe tener un ID distinto');
assert.strictEqual(clone.title, 'Copia de Tarea 1: Ciencias Naturales');
assert.strictEqual(window.ArkMyWorks.getWorks().length, 2, 'Deben haber 2 trabajos');
console.log('✅ Test 3: Duplicar trabajo superado (Nuevo ID:', clone.id, ')');

// Test 4: Reconstrucción y restauración de estado en DOM simulado
const mockDoc = {
  elements: {
    '#tituloTarea': { isContentEditable: true, innerHTML: '', dispatchEvent: () => {} },
    '#nombreAlumno': { isContentEditable: false, value: '', dispatchEvent: () => {} }
  },
  images: {
    'imgPrincipal': { id: 'imgPrincipal', src: '', parentElement: { classList: { add: () => {} } } }
  },
  querySelector: function(sel) { return this.elements[sel] || null; },
  getElementById: function(id) { return this.images[id] || null; },
  querySelectorAll: function() { return []; }
};

const mockFrame = {
  contentWindow: {
    document: mockDoc
  }
};

const restored = window.ArkMyWorks.restoreFrameData(mockFrame, saved.data);
assert.strictEqual(restored, true, 'La restauración debe retornar true');
assert.strictEqual(mockDoc.elements['#tituloTarea'].innerHTML, 'La Fotosíntesis y las Plantas', 'El texto editable debe coincidir');
assert.strictEqual(mockDoc.elements['#nombreAlumno'].value, 'Estudiante Arkaios', 'El input debe coincidir');
assert.strictEqual(mockDoc.images['imgPrincipal'].src, 'https://images.unsplash.com/photo-leaf.jpg', 'La imagen debe coincidir');
console.log('✅ Test 4: Restauración e inyección en DOM superada con 100% fidelidad');

// Test 5: Eliminar trabajo
window.ArkMyWorks.deleteWork(saved.id);
assert.strictEqual(window.ArkMyWorks.getWorks().length, 1, 'Debe quedar solo 1 trabajo');
console.log('✅ Test 5: Eliminación de trabajo superada');

console.log('----------------------------------------------------');
console.log('🎉 TODAS LAS PRUEBAS DE MODO WORD Y MIS TRABAJOS PASARON CON ÉXITO');
