/**
 * generateModules.js
 * Escanea archivos .html y genera modules.json para menú dinámico del index.
 * Heurística simple por nombre de archivo para clasificar.
 */
const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const OUT = path.join(ROOT, "modules.json");

// Ajusta si tus html viven en otra carpeta:
const SCAN_DIR = ROOT;

// Excluir del menú:
const EXCLUDE = new Set([
  "index.html",
  "projects.html",
  "pdf-manager.html"
]);

function prettifyName(file) {
  return file
    .replace(/\.html$/i, "")
    .replace(/[-_]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, c => c.toUpperCase());
}

function categorize(file) {
  const f = file.toLowerCase();

  const isText =
    f.includes("carta") ||
    f.includes("hoja") ||
    f.includes("biografia") ||
    f.includes("plantilla_escolar") ||
    f.includes("texto");

  const isImage =
    f.includes("foto") ||
    f.includes("pixabay") ||
    f.includes("imagen") ||
    f.includes("circulos") ||
    f.includes("jack") ||
    f.includes("cuadros");

  if (isText) return "text";
  if (isImage) return "image";
  return "other";
}

function iconForCategory(cat) {
  if (cat === "text") return "📝";
  if (cat === "image") return "📸";
  return "🧩";
}

function iconForFile(file) {
  const f = file.toLowerCase();
  if (f.includes("carta")) return "📄";
  if (f.includes("hoja")) return "📐";
  if (f.includes("biografia")) return "👤";
  if (f.includes("foto")) return "👶";
  if (f.includes("pixabay")) return "🌐";
  if (f.includes("circulos") || f.includes("jack")) return "⭕";
  if (f.includes("cuadros")) return "🖼️";
  if (f.includes("imagen")) return "🎨";
  return "📄";
}

function listHtmlFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const ent of entries) {
    // solo raíz (simple). Si quieres recursivo, te lo hago.
    if (ent.isFile() && ent.name.toLowerCase().endsWith(".html")) {
      if (!EXCLUDE.has(ent.name)) files.push(ent.name);
    }
  }
  return files.sort((a, b) => a.localeCompare(b, "es"));
}

function buildManifest(files) {
  const buckets = {
    text: [],
    image: [],
    other: [],
  };

  files.forEach(file => {
    const cat = categorize(file);
    buckets[cat].push({
      label: prettifyName(file),
      icon: iconForFile(file),
      target: file,
    });
  });

  const sections = [];

  if (buckets.text.length) {
    sections.push({
      title: "Módulos de Texto",
      icon: "📝",
      makeFirstActive: true,
      items: buckets.text,
    });
  }

  if (buckets.image.length) {
    sections.push({
      title: "Módulos de Imagen",
      icon: "📸",
      items: buckets.image,
    });
  }

  if (buckets.other.length) {
    sections.push({
      title: "Otros",
      icon: iconForCategory("other"),
      items: buckets.other,
    });
  }

  // Biblioteca fija (si la tienes)
  sections.push({
    title: "Biblioteca",
    icon: "📚",
    items: [
      { label: "Material Reutilizable", icon: "📖", target: "material-educativo-reutilizable.html" }
    ]
  });

  return { sections };
}

(function main() {
  const files = listHtmlFiles(SCAN_DIR);
  const manifest = buildManifest(files);

  fs.writeFileSync(OUT, JSON.stringify(manifest, null, 2), "utf8");
  console.log(`[OK] Generado modules.json con ${files.length} módulos`);
})();
