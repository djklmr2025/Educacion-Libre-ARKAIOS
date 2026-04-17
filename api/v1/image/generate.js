const CHANNEL = "xnaxg7ceyj";
const VERIFY = "https://image-generation.perchance.org/api/verifyUser";
const GENERATE = "https://image-generation.perchance.org/api/generate";
const DOWNLOAD = "https://image-generation.perchance.org/api/downloadTemporaryImage";
const POLLINATIONS = "https://image.pollinations.ai/prompt";

function setCors(res) {
  res.setHeader("Access-Control-Allow-Credentials", true);
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,POST");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

function json(res, status, data) {
  return res.status(status).json(data);
}

function parseResolution(value) {
  const resolution = String(value || "768x768").toLowerCase();
  return /^\d{3,4}x\d{3,4}$/.test(resolution) ? resolution : "768x768";
}

function resolutionToSize(resolution) {
  const [width, height] = resolution.split("x").map(Number);
  return {
    width: Math.min(Math.max(width || 768, 256), 1536),
    height: Math.min(Math.max(height || 768, 256), 1536)
  };
}

async function getUserKey(channel) {
  const url = `${VERIFY}?channel=${encodeURIComponent(channel)}&promptBase64=&__cacheBust=${Date.now()}`;
  const response = await fetch(url);
  const data = await response.json();

  if (!response.ok || !data.userKey) {
    throw new Error(data.message || "No se pudo verificar el canal de imagenes");
  }

  return data.userKey;
}

async function generateWithPerchance({ prompt, negativePrompt, resolution, channel, adultContent }) {
  const userKey = await getUserKey(channel);
  const body = new URLSearchParams({
    prompt,
    negativePrompt,
    resolution,
    guidanceScale: "7",
    seed: String(Math.floor(Math.random() * 2147483647)),
    channel,
    userKey,
    adultContent: adultContent ? "1" : "0",
    __cacheBust: String(Date.now())
  });

  const response = await fetch(GENERATE, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString()
  });

  const data = await response.json();
  if (!response.ok || data.status === "error" || !data.imageId) {
    throw new Error(data.message || data.error || "No se pudo generar la imagen");
  }

  return {
    ok: true,
    provider: "perchance",
    imageId: data.imageId,
    url: `${DOWNLOAD}?imageId=${encodeURIComponent(data.imageId)}`
  };
}

function generateWithPollinations({ prompt, negativePrompt, resolution }) {
  const { width, height } = resolutionToSize(resolution);
  const seed = Math.floor(Math.random() * 2147483647);
  const cleanNegative = negativePrompt ? `. Evitar: ${negativePrompt}` : "";
  const finalPrompt = `${prompt}${cleanNegative}`;
  const params = new URLSearchParams({
    width: String(width),
    height: String(height),
    seed: String(seed),
    nologo: "true",
    enhance: "true",
    model: "flux"
  });

  return {
    ok: true,
    provider: "pollinations",
    seed,
    url: `${POLLINATIONS}/${encodeURIComponent(finalPrompt)}?${params.toString()}`
  };
}

export default async function handler(req, res) {
  setCors(res);

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return json(res, 405, { ok: false, error: "Method not allowed" });

  const body = req.body || {};
  const prompt = String(body.prompt || "").trim();
  const style = String(body.style || "").trim();
  const negativePrompt = String(body.negativePrompt || "").trim();
  const resolution = parseResolution(body.resolution);
  const channel = String(body.channel || CHANNEL).trim() || CHANNEL;
  const adultContent = body.adultContent === true || body.adultContent === 1 || body.adultContent === "1";

  if (!prompt) {
    return json(res, 400, { ok: false, error: "Falta la descripcion de la imagen" });
  }

  const fullPrompt = style ? `${prompt}, ${style}` : prompt;

  try {
    const result = await generateWithPerchance({
      prompt: fullPrompt,
      negativePrompt,
      resolution,
      channel,
      adultContent
    });

    return json(res, 200, result);
  } catch (error) {
    const fallback = generateWithPollinations({
      prompt: fullPrompt,
      negativePrompt,
      resolution
    });

    return json(res, 200, {
      ...fallback,
      fallback: true,
      warning: error.message
    });
  }
}
