#!/usr/bin/env python3
"""Genera una hoja imprimible de tarjetas cuadradas (por defecto 5 cm) a partir de un cards.json.

Uso:
  python build_sheet.py cards.json --out hoja.html [--pdf hoja.pdf] [--png-dir tarjetas/]
  python build_sheet.py --list-icons

cards.json:
{
  "title": "Ciberacoso",            # opcional, aparece chico en el margen
  "size_cm": 5,                     # lado de cada tarjeta (default 5)
  "page": "letter",                 # letter | a4
  "cards": [
    {"caption": "Piensa antes de publicar", "group": "Como evitarlo", "icon": "bulb"},
    {"caption": "Mi foto", "group": "Ejemplo", "image": "fotos/a.png"},   # imagen local (se incrusta)
    {"caption": "Custom", "group": "Ejemplo", "svg": "<svg viewBox='0 0 64 64'>...</svg>"}
  ]
}
Cada tarjeta usa UNA de: image | svg | icon. Si no hay ninguna, se usa el icono "star".
"""
import argparse, base64, html, json, math, mimetypes, sys
from pathlib import Path

PAGES = {"letter": (21.59, 27.94), "a4": (21.0, 29.7)}
PALETTE = ["#2563eb", "#db2777", "#059669", "#d97706", "#7c3aed", "#0891b2", "#dc2626", "#4d7c0f"]

ICONS = {
 "phone": '<rect x="19" y="5" width="26" height="54" rx="5"/><line x1="28" y1="51" x2="36" y2="51"/><line x1="27" y1="11" x2="37" y2="11"/>',
 "chat": '<path d="M8 12h48a3 3 0 0 1 3 3v26a3 3 0 0 1-3 3H32l-12 10V44H8a3 3 0 0 1-3-3V15a3 3 0 0 1 3-3z"/><line x1="18" y1="24" x2="46" y2="24"/><line x1="18" y1="33" x2="38" y2="33"/>',
 "sad": '<circle cx="32" cy="32" r="26"/><circle cx="23" cy="26" r="2.5" fill="currentColor"/><circle cx="41" cy="26" r="2.5" fill="currentColor"/><path d="M21 44c4-6 18-6 22 0"/>',
 "happy": '<circle cx="32" cy="32" r="26"/><circle cx="23" cy="26" r="2.5" fill="currentColor"/><circle cx="41" cy="26" r="2.5" fill="currentColor"/><path d="M21 38c4 7 18 7 22 0"/>',
 "neutral": '<circle cx="32" cy="32" r="26"/><circle cx="23" cy="26" r="2.5" fill="currentColor"/><circle cx="41" cy="26" r="2.5" fill="currentColor"/><line x1="22" y1="42" x2="42" y2="42"/>',
 "heart": '<path d="M32 55C10 39 6 27 6 20a13 13 0 0 1 26-3 13 13 0 0 1 26 3c0 7-4 19-26 35z"/>',
 "shield": '<path d="M32 5l22 8v16c0 14-9 24-22 30C19 53 10 43 10 29V13z"/><path d="M22 31l8 8 14-16"/>',
 "warning": '<path d="M32 7L60 55H4z"/><line x1="32" y1="24" x2="32" y2="40"/><circle cx="32" cy="47" r="1.8" fill="currentColor"/>',
 "lock": '<rect x="12" y="28" width="40" height="28" rx="4"/><path d="M20 28V20a12 12 0 0 1 24 0v8"/><circle cx="32" cy="42" r="3.5" fill="currentColor"/>',
 "eye": '<path d="M4 32C12 18 22 12 32 12s20 6 28 20C52 46 42 52 32 52S12 46 4 32z"/><circle cx="32" cy="32" r="9"/><circle cx="32" cy="32" r="3" fill="currentColor"/>',
 "eye-off": '<path d="M4 32C12 18 22 12 32 12s20 6 28 20C52 46 42 52 32 52S12 46 4 32z"/><circle cx="32" cy="32" r="9"/><line x1="10" y1="56" x2="54" y2="8"/>',
 "stop": '<path d="M22 6h20l16 16v20L42 58H22L6 42V22z"/><line x1="18" y1="32" x2="46" y2="32"/>',
 "clock": '<circle cx="32" cy="32" r="26"/><path d="M32 16v17l11 7"/>',
 "book": '<path d="M6 12c8-3 18-3 26 3 8-6 18-6 26-3v38c-8-3-18-3-26 3-8-6-18-6-26-3z"/><line x1="32" y1="15" x2="32" y2="53"/>',
 "bulb": '<path d="M22 44c0-6-10-9-10-22a20 20 0 0 1 40 0c0 13-10 16-10 22z"/><line x1="23" y1="52" x2="41" y2="52"/><line x1="26" y1="59" x2="38" y2="59"/>',
 "person": '<circle cx="32" cy="20" r="11"/><path d="M10 58c0-14 10-22 22-22s22 8 22 22z"/>',
 "people": '<circle cx="22" cy="22" r="9"/><path d="M4 56c0-12 8-19 18-19s18 7 18 19z"/><circle cx="44" cy="25" r="8"/><path d="M44 38c10 0 16 7 16 18H46"/>',
 "flag": '<line x1="14" y1="6" x2="14" y2="58"/><path d="M14 10h34l-8 12 8 12H14"/>',
 "block": '<circle cx="32" cy="32" r="26"/><line x1="14" y1="50" x2="50" y2="14"/>',
 "mail": '<rect x="5" y="13" width="54" height="38" rx="4"/><path d="M5 17l27 20 27-20"/>',
 "camera": '<path d="M8 20h12l4-7h16l4 7h12a3 3 0 0 1 3 3v26a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3V23a3 3 0 0 1 3-3z"/><circle cx="32" cy="36" r="10"/>',
 "globe": '<circle cx="32" cy="32" r="26"/><ellipse cx="32" cy="32" rx="11" ry="26"/><line x1="6" y1="32" x2="58" y2="32"/><path d="M10 18h44M10 46h44"/>',
 "key": '<circle cx="20" cy="32" r="12"/><path d="M32 32h26M50 32v10M42 32v8"/>',
 "question": '<circle cx="32" cy="32" r="26"/><path d="M23 25a9 9 0 1 1 13 8c-3 2-4 4-4 8"/><circle cx="32" cy="49" r="1.8" fill="currentColor"/>',
 "check": '<circle cx="32" cy="32" r="26"/><path d="M19 33l9 9 18-20"/>',
 "cross": '<circle cx="32" cy="32" r="26"/><path d="M22 22l20 20M42 22l-20 20"/>',
 "wifi": '<path d="M6 24a37 37 0 0 1 52 0M15 33a24 24 0 0 1 34 0M24 42a11 11 0 0 1 16 0"/><circle cx="32" cy="51" r="2.5" fill="currentColor"/>',
 "bell": '<path d="M14 44V28a18 18 0 0 1 36 0v16l6 6H8z"/><path d="M27 56a5 5 0 0 0 10 0"/>',
 "search": '<circle cx="27" cy="27" r="18"/><line x1="40" y1="40" x2="58" y2="58"/>',
 "home": '<path d="M6 30L32 8l26 22M12 26v30h40V26"/><rect x="26" y="38" width="12" height="18"/>',
 "megaphone": '<path d="M8 26h12l26-14v40L20 38H8z"/><path d="M20 38l4 16h8l-4-16"/>',
 "star": '<path d="M32 6l8 18 19 2-14 13 4 19-17-10-17 10 4-19L5 26l19-2z"/>',
}


def icon_svg(name):
    inner = ICONS.get(name)
    if inner is None:
        print(f"AVISO: icono '{name}' no existe; uso 'star'. Ver --list-icons", file=sys.stderr)
        inner = ICONS["star"]
    return ('<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="3.2" '
            f'stroke-linecap="round" stroke-linejoin="round">{inner}</svg>')


def image_tag(path, base):
    p = (base / path).expanduser()
    if not p.exists():
        print(f"AVISO: no existe la imagen {p}", file=sys.stderr)
        return icon_svg("question")
    mime = mimetypes.guess_type(p.name)[0] or "image/png"
    b64 = base64.b64encode(p.read_bytes()).decode()
    return f'<img alt="" src="data:{mime};base64,{b64}">'


def card_html(card, idx, color, base):
    if card.get("image"):
        art = image_tag(card["image"], base)
    elif card.get("svg"):
        art = card["svg"]
    else:
        art = icon_svg(card.get("icon", "star"))
    group = html.escape(card.get("group", ""))
    cap = html.escape(card.get("caption", ""))
    return (f'<div class="cell" style="--c:{color}"><div class="tag">{idx} · {group}</div>'
            f'<div class="art">{art}</div><div class="cap"><span>{cap}</span></div></div>')


CSS = """
*{box-sizing:border-box}
body{margin:0;background:#e5e7eb;font-family:Arial,Helvetica,sans-serif}
.page{width:%(W)scm;height:%(H)scm;margin:12px auto;background:#fff;position:relative;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 18px rgba(0,0,0,.25)}
.title{position:absolute;top:.3cm;left:0;right:0;text-align:center;font-size:7pt;color:#6b7280}
.grid{display:grid;grid-template-columns:repeat(%(cols)s,%(S)scm);grid-auto-rows:%(S)scm}
.cell{width:%(S)scm;height:%(S)scm;border:.2mm dashed #9ca3af;display:flex;flex-direction:column;overflow:hidden;background:#fff}
.cell.empty{background:#fafafa}
.tag{height:calc(.55cm * var(--k));line-height:calc(.55cm * var(--k));font-size:calc(6.5pt * var(--k));font-weight:700;letter-spacing:.03em;text-transform:uppercase;color:#fff;background:var(--c);text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding:0 .1cm}
.art{flex:1;min-height:0;display:flex;align-items:center;justify-content:center;color:var(--c);padding:calc(.18cm * var(--k))}
.art svg,.art img{max-width:100%%;max-height:100%%;width:auto;height:100%%}
.cap{min-height:calc(1.3cm * var(--k));display:flex;align-items:center;justify-content:center;text-align:center;font-size:calc(10pt * var(--k));font-weight:700;line-height:1.15;color:#111827;padding:0 calc(.18cm * var(--k)) calc(.14cm * var(--k))}
.cap span{display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.export .cell{border:none}
@page{size:%(W)scm %(H)scm;margin:0}
@media print{body{background:#fff}.page{margin:0;box-shadow:none;break-after:page}.page:last-child{break-after:auto}}
"""


def build(spec, base, size_override=None, page_override=None, show_title=True, fill=True):
    size = float(size_override or spec.get("size_cm", 5))
    W, H = PAGES[(page_override or spec.get("page", "letter")).lower()]
    min_margin = 0.5
    cols = max(1, math.floor((W - 2 * min_margin) / size))
    rows = max(1, math.floor((H - 2 * min_margin - (0.4 if show_title else 0)) / size))
    per = cols * rows
    cards = spec["cards"]
    colors = {}
    for c in cards:
        g = c.get("group", "")
        if g not in colors:
            colors[g] = PALETTE[len(colors) % len(PALETTE)]
    pages = []
    n_pages = max(1, math.ceil(len(cards) / per))
    for p in range(n_pages):
        chunk = cards[p * per:(p + 1) * per]
        cells = [card_html(c, p * per + i + 1, colors[c.get("group", "")], base) for i, c in enumerate(chunk)]
        if fill:
            cells += ['<div class="cell empty"></div>'] * (per - len(chunk))
        t = html.escape(spec.get("title", "")) if show_title else ""
        title = f'<div class="title">{t} · hoja {p + 1}/{n_pages}</div>' if t else ""
        pages.append(f'<section class="page">{title}<div class="grid">{"".join(cells)}</div></section>')
    css = CSS % dict(W=W, H=H, S=size, cols=cols)
    doc = (f'<!doctype html><html lang="es"><head><meta charset="utf-8">'
           f'<title>{html.escape(spec.get("title", "Hoja de tarjetas"))}</title>'
           f'<style>:root{{--k:{size / 5:.3f}}}{css}</style></head><body>{"".join(pages)}</body></html>')
    return doc, dict(size=size, cols=cols, rows=rows, per_page=per, pages=n_pages, cards=len(cards))


def export(html_path, pdf=None, png_dir=None):
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print("AVISO: playwright no esta instalado; solo se genero el HTML "
              "(abrelo y usa Imprimir > Guardar como PDF).", file=sys.stderr)
        return
    with sync_playwright() as p:
        b = p.chromium.launch()
        ctx = b.new_context(device_scale_factor=4)
        pg = ctx.new_page()
        pg.goto(Path(html_path).resolve().as_uri())
        if pdf:
            pg.pdf(path=str(pdf), prefer_css_page_size=True, print_background=True)
        if png_dir:
            Path(png_dir).mkdir(parents=True, exist_ok=True)
            pg.evaluate("document.body.classList.add('export')")
            for i, el in enumerate(pg.query_selector_all(".cell:not(.empty)"), 1):
                el.screenshot(path=str(Path(png_dir) / f"{i:02d}.png"))
        b.close()


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("cards", nargs="?")
    ap.add_argument("--out", default="hoja.html")
    ap.add_argument("--pdf")
    ap.add_argument("--png-dir")
    ap.add_argument("--size-cm", type=float)
    ap.add_argument("--page", choices=list(PAGES))
    ap.add_argument("--no-title", action="store_true")
    ap.add_argument("--no-fill", action="store_true", help="no completar con celdas vacias")
    ap.add_argument("--list-icons", action="store_true")
    a = ap.parse_args()
    if a.list_icons:
        print(", ".join(sorted(ICONS)))
        return
    if not a.cards:
        ap.error("falta cards.json")
    path = Path(a.cards)
    spec = json.loads(path.read_text(encoding="utf-8"))
    doc, info = build(spec, path.parent, a.size_cm, a.page, not a.no_title, not a.no_fill)
    Path(a.out).write_text(doc, encoding="utf-8")
    print(f"OK {a.out}: {info['cards']} tarjetas de {info['size']} cm, "
          f"{info['cols']}x{info['rows']} por hoja, {info['pages']} hoja(s)")
    if a.pdf or a.png_dir:
        export(a.out, a.pdf, a.png_dir)


if __name__ == "__main__":
    main()
