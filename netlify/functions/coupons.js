const { getStore } = require("@netlify/blobs");

const STORE_NAME = "carniceria";
const KEY = "coupons";

const ADMIN_SECRET = process.env.ADMIN_SECRET || "cambiar-este-secreto";

function getCouponStore() {
  if (process.env.NETLIFY_SITE_ID && process.env.NETLIFY_BLOBS_TOKEN) {
    return getStore({
      name: STORE_NAME,
      siteID: process.env.NETLIFY_SITE_ID,
      token: process.env.NETLIFY_BLOBS_TOKEN,
    });
  }
  return getStore(STORE_NAME);
}

function json(status, body) {
  return {
    statusCode: status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(body),
  };
}

function normalizeCode(code) {
  return String(code || "").trim().toUpperCase();
}

function isAdmin(event) {
  const token = event.headers["x-admin-token"] || event.headers["X-Admin-Token"];
  return token && token === ADMIN_SECRET;
}

exports.handler = async (event) => {
  const store = getCouponStore();

  // ---- Listado completo: solo para el panel admin ----
  if (event.httpMethod === "GET") {
    if (!isAdmin(event)) return json(401, { error: "No autorizado" });
    const coupons = (await store.get(KEY, { type: "json" })) || [];
    return json(200, { coupons });
  }

  if (event.httpMethod !== "POST") {
    return json(405, { error: "Método no permitido" });
  }

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch (e) {
    return json(400, { error: "JSON inválido" });
  }

  const { action } = payload;

  // ---- Validar un código (público, no consume el cupón) ----
  if (action === "validate") {
    const code = normalizeCode(payload.code);
    const coupons = (await store.get(KEY, { type: "json" })) || [];
    const coupon = coupons.find((c) => c.code === code && c.active !== false);
    if (!coupon) return json(200, { valid: false });
    return json(200, {
      valid: true,
      type: coupon.type,
      value: coupon.value,
      description: coupon.description || "",
    });
  }

  // ---- Canjear un código (público, lo borra: uso único) ----
  if (action === "redeem") {
    const code = normalizeCode(payload.code);
    let coupons = (await store.get(KEY, { type: "json" })) || [];
    const coupon = coupons.find((c) => c.code === code && c.active !== false);
    if (!coupon) return json(200, { redeemed: false });

    coupons = coupons.filter((c) => c.code !== code);
    await store.setJSON(KEY, coupons);

    return json(200, { redeemed: true, type: coupon.type, value: coupon.value });
  }

  // ---- A partir de acá, todo requiere estar logueado como admin ----
  if (!isAdmin(event)) return json(401, { error: "No autorizado" });

  let coupons = (await store.get(KEY, { type: "json" })) || [];

  if (action === "upsert") {
    const incoming = payload.coupon || {};
    const code = normalizeCode(incoming.code);
    if (!code) return json(400, { error: "Falta el código" });

    const coupon = {
      code,
      type: incoming.type === "fixed" ? "fixed" : "percent",
      value: Number(incoming.value) || 0,
      description: incoming.description || "",
      active: true,
    };

    const idx = coupons.findIndex((c) => c.code === code);
    if (idx >= 0) {
      coupons[idx] = coupon;
    } else {
      coupons.push(coupon);
    }
    await store.setJSON(KEY, coupons);
    return json(200, { coupons });
  }

  if (action === "delete") {
    const code = normalizeCode(payload.code);
    coupons = coupons.filter((c) => c.code !== code);
    await store.setJSON(KEY, coupons);
    return json(200, { coupons });
  }

  return json(400, { error: "Acción inválida" });
};
