const { getStore } = require("@netlify/blobs");

const STORE_NAME = "carniceria-images";
const ADMIN_SECRET = process.env.ADMIN_SECRET || "cambiar-este-secreto";

// Máximo permitido por imagen, ya en base64 (~4MB de archivo original).
const MAX_BASE64_LENGTH = 5_600_000;

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

function getImageStore() {
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

exports.handler = async (event) => {
  const store = getImageStore();

  // GET /.netlify/functions/images?key=xxx  -> devuelve la imagen
  if (event.httpMethod === "GET") {
    const key = (event.queryStringParameters || {}).key;
    if (!key) return json(400, { error: "Falta el parámetro key" });

    try {
      const record = await store.get(key, { type: "json" });
      if (!record) return json(404, { error: "Imagen no encontrada" });

      return {
        statusCode: 200,
        headers: {
          "Content-Type": record.contentType || "image/jpeg",
          "Cache-Control": "public, max-age=31536000, immutable",
        },
        body: record.data,
        isBase64Encoded: true,
      };
    } catch (e) {
      return json(404, { error: "Imagen no encontrada" });
    }
  }

  // POST -> sube una imagen nueva (requiere estar logueado como admin)
  if (event.httpMethod === "POST") {
    const token = event.headers["x-admin-token"] || event.headers["X-Admin-Token"];
    if (!token || token !== ADMIN_SECRET) {
      return json(401, { error: "No autorizado" });
    }

    let payload;
    try {
      payload = JSON.parse(event.body || "{}");
    } catch (e) {
      return json(400, { error: "JSON inválido" });
    }

    const { data, contentType, filename } = payload;

    if (!data) return json(400, { error: "Falta la imagen" });

    if (contentType && !ALLOWED_TYPES.includes(contentType)) {
      return json(400, { error: "Formato no permitido. Usá JPG, PNG, WEBP o GIF." });
    }

    if (data.length > MAX_BASE64_LENGTH) {
      return json(413, { error: "La imagen es muy pesada. Probá con una más chica." });
    }

    const safeName = (filename || "img")
      .toLowerCase()
      .replace(/[^a-z0-9.]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 40);
    const key = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName}`;

    try {
      await store.setJSON(key, { data, contentType: contentType || "image/jpeg" });
    } catch (e) {
      return json(500, { error: "No se pudo guardar la imagen" });
    }

    return json(200, {
      key,
      url: `/.netlify/functions/images?key=${encodeURIComponent(key)}`,
    });
  }

  return json(405, { error: "Método no permitido" });
};
