export function setCors(res) {
  res.setHeader("Access-Control-Allow-Credentials", true);
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,POST");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, X-Requested-With, Accept, x-api-key, Authorization"
  );
}

export function getCoreConfig() {
  const base =
    process.env.CORE_API_BASE ||
    process.env.VITE_STATE_SYNC_BASE ||
    "https://arkaios-core-api-2.onrender.com";

  const key =
    process.env.ARKAIOS_INTERNAL_KEY ||
    process.env.ARKAIOS_FOUNDER_KEY ||
    process.env.VITE_ARKAIOS_CORE_API_KEY ||
    "";

  return { base: base.replace(/\/$/, ""), key };
}

export async function forwardJson(url, { method = "GET", body, key }) {
  const response = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  let data = null;
  try {
    data = await response.json();
  } catch (err) {
    data = { ok: false, message: "Invalid JSON from Core" };
  }

  return { status: response.status, data };
}
