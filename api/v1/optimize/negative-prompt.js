function setCors(res) {
  res.setHeader("Access-Control-Allow-Credentials", true);
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,POST");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

export default async function handler(req, res) {
  setCors(res);

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });

  const prompt = String(req.body?.prompt || "").trim();
  const base = [
    "borroso",
    "mala calidad",
    "deformado",
    "texto",
    "marca de agua",
    "anatomia incorrecta",
    "manos deformes",
    "dedos extra",
    "extremidades extra",
    "rostro distorsionado",
    "baja resolucion"
  ];

  const extra = /persona|retrato|humano|niño|nina|maestro|estudiante|familia/i.test(prompt)
    ? ["ojos desalineados", "piel plastica", "proporciones irreales"]
    : ["composicion confusa", "objetos duplicados"];

  return res.status(200).json({
    ok: true,
    negativePrompt: [...base, ...extra].join(", ")
  });
}
