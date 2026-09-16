const { getStore } = require("@netlify/blobs");

const STORE_NAME = "carniceria";
const KEY = "combos";

const ADMIN_SECRET = process.env.ADMIN_SECRET || "cambiar-este-secreto";

const SEED_COMBOS = [
  {
    id: "combo-asador",
    title: "Combo Asador",
    description: "Para una buena juntada",
    price: 26000,
    image: "https://placehold.co/500x360/C89B3C/241F1D?font=roboto&text=Combo+Asador",
    active: true,
    items: [
      { name: "Asado", qty: 2, unit: "kg" },
      { name: "Chorizo", qty: 4, unit: "unidad" },
      { name: "Morcilla", qty: 2, unit: "unidad" }
    ]
  }
];

function getComboStore() {
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
  const store = getComboStore();

  if (event.httpMethod === "GET") {
    let combos = await store.get(KEY, { type: "json" });
    if (!combos) {
      combos = SEED_COMBOS;
      await store.setJSON(KEY, combos);
    }
    return json(200, { combos });
  }

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

    const { action, combo, id } = payload;
    let combos = (await store.get(KEY, { type: "json" })) || SEED_COMBOS;

    if (action === "upsert" && combo && combo.id) {
      const idx = combos.findIndex((c) => c.id === combo.id);
      if (idx >= 0) {
        combos[idx] = { ...combos[idx], ...combo };
      } else {
        combos.push(combo);
      }
    } else if (action === "delete" && id) {
      combos = combos.filter((c) => c.id !== id);
    } else {
      return json(400, { error: "Acción inválida" });
    }

    await store.setJSON(KEY, combos);
    return json(200, { combos });
  }

  return json(405, { error: "Método no permitido" });
};
