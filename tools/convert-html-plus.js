#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Uso: node tools/convert-html-plus.js <archivo.html> [--template-id=id] [--with-library] [--dry-run]');
  process.exit(1);
}

const fileArg = args.find((a) => !a.startsWith('--'));
const withLibrary = args.includes('--with-library');
const dryRun = args.includes('--dry-run');
const templateIdArg = args.find((a) => a.startsWith('--template-id=')) || '';
const templateId = templateIdArg ? templateIdArg.split('=')[1].trim() : '';

if (!fileArg) {
  console.error('Error: falta ruta de archivo HTML.');
  process.exit(1);
}

const filePath = path.resolve(process.cwd(), fileArg);
if (!fs.existsSync(filePath)) {
  console.error(`Error: no existe ${filePath}`);
  process.exit(1);
}

let src = fs.readFileSync(filePath, 'utf8');
if (!/<\/body>/i.test(src)) {
  console.error('Error: el archivo no contiene </body>.');
  process.exit(1);
}

const changes = [];
const desiredId = templateId || path.basename(filePath).replace(/[^a-zA-Z0-9_.-]+/g, '-');

if (!/data-arkaios-template=/i.test(src) && /<body[^>]*>/i.test(src)) {
  src = src.replace(/<body([^>]*)>/i, (_m, attrs) => `<body${attrs} data-arkaios-template="${desiredId}">`);
  changes.push(`body[data-arkaios-template="${desiredId}"]`);
}

if (withLibrary && !/src=["']arkaios-biblioteca\.js["']/i.test(src)) {
  src = src.replace(/<\/body>/i, '  <script src="arkaios-biblioteca.js"></script>\n</body>');
  changes.push('script arkaios-biblioteca.js');
}

if (!/src=["']arkaios-orquestador\.js["']/i.test(src)) {
  src = src.replace(/<\/body>/i, '  <script src="arkaios-orquestador.js"></script>\n</body>');
  changes.push('script arkaios-orquestador.js');
}

if (!changes.length) {
  console.log(`Sin cambios: ${filePath}`);
  process.exit(0);
}

if (dryRun) {
  console.log(`Dry run (${filePath}):`);
  changes.forEach((c) => console.log(`- ${c}`));
  process.exit(0);
}

fs.writeFileSync(filePath, src, 'utf8');
console.log(`Actualizado: ${filePath}`);
changes.forEach((c) => console.log(`- ${c}`));
