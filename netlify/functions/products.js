const { getStore } = require("@netlify/blobs");

const STORE_NAME = "carniceria";
const KEY = "products";

const ADMIN_SECRET = process.env.ADMIN_SECRET || "cambiar-este-secreto";

function getProductsStore() {
  // En algunos sitios, Netlify no inyecta la configuración automática de
  // Blobs dentro de la función. Si están cargadas las variables
  // NETLIFY_SITE_ID y NETLIFY_BLOBS_TOKEN, nos conectamos manualmente;
  // si no, probamos con la configuración automática.
  if (process.env.NETLIFY_SITE_ID && process.env.NETLIFY_BLOBS_TOKEN) {
    return getStore({
      name: STORE_NAME,
      siteID: process.env.NETLIFY_SITE_ID,
      token: process.env.NETLIFY_BLOBS_TOKEN,
    });
  }
  return getStore(STORE_NAME);
}

const SEED_PRODUCTS = [
  { id: "asado", name: "Asado", category: "Vacuno", unit: "kg", price: 9800, image: "https://placehold.co/500x360/7A2426/EDE3D2?font=roboto&text=Asado", active: true, offer: false },
  { id: "vacio", name: "Vacío", category: "Vacuno", unit: "kg", price: 11500, image: "https://placehold.co/500x360/7A2426/EDE3D2?font=roboto&text=Vac%C3%ADo", active: true, offer: false },
  { id: "matambre", name: "Matambre", category: "Vacuno", unit: "kg", price: 10200, image: "https://placehold.co/500x360/7A2426/EDE3D2?font=roboto&text=Matambre", active: true, offer: false },
  { id: "bife-chorizo", name: "Bife de chorizo", category: "Vacuno", unit: "kg", price: 13500, image: "https://placehold.co/500x360/7A2426/EDE3D2?font=roboto&text=Bife+de+Chorizo", active: true, offer: true },
  { id: "bife-ancho", name: "Bife ancho", category: "Vacuno", unit: "kg", price: 12800, image: "https://placehold.co/500x360/7A2426/EDE3D2?font=roboto&text=Bife+Ancho", active: true, offer: false },
  { id: "colita-cuadril", name: "Colita de cuadril", category: "Vacuno", unit: "kg", price: 11900, image: "https://placehold.co/500x360/7A2426/EDE3D2?font=roboto&text=Colita+de+Cuadril", active: true, offer: false },
  { id: "peceto", name: "Peceto", category: "Vacuno", unit: "kg", price: 10800, image: "https://placehold.co/500x360/7A2426/EDE3D2?font=roboto&text=Peceto", active: true, offer: false },
  { id: "nalga", name: "Nalga", category: "Vacuno", unit: "kg", price: 10500, image: "https://placehold.co/500x360/7A2426/EDE3D2?font=roboto&text=Nalga", active: true, offer: false },
  { id: "carne-picada", name: "Carne picada especial", category: "Vacuno", unit: "kg", price: 8900, image: "https://placehold.co/500x360/7A2426/EDE3D2?font=roboto&text=Carne+Picada", active: true, offer: false },
  { id: "costillar-cerdo", name: "Costillar de cerdo", category: "Cerdo", unit: "kg", price: 7800, image: "https://placehold.co/500x360/C89B3C/241F1D?font=roboto&text=Costillar+Cerdo", active: true, offer: false },
  { id: "bondiola", name: "Bondiola", category: "Cerdo", unit: "kg", price: 8600, image: "https://placehold.co/500x360/C89B3C/241F1D?font=roboto&text=Bondiola", active: true, offer: false },
  { id: "pechito-cerdo", name: "Pechito de cerdo", category: "Cerdo", unit: "kg", price: 7200, image: "https://placehold.co/500x360/C89B3C/241F1D?font=roboto&text=Pechito+Cerdo", active: true, offer: true },
  { id: "chorizo", name: "Chorizo", category: "Embutidos", unit: "unidad", price: 1200, image: "https://placehold.co/500x360/4C6444/EDE3D2?font=roboto&text=Chorizo", active: true, offer: false },
  { id: "morcilla", name: "Morcilla", category: "Embutidos", unit: "unidad", price: 900, image: "https://placehold.co/500x360/4C6444/EDE3D2?font=roboto&text=Morcilla", active: true, offer: false },
  { id: "molleja", name: "Mollejas", category: "Achuras", unit: "kg", price: 9500, image: "https://placehold.co/500x360/241F1D/EDE3D2?font=roboto&text=Mollejas", active: true, offer: false },
  { id: "chinchulin", name: "Chinchulines", category: "Achuras", unit: "kg", price: 6800, image: "https://placehold.co/500x360/241F1D/EDE3D2?font=roboto&text=Chinchulines", active: true, offer: false },
  { id: "higado", name: "Hígado", category: "Achuras", unit: "kg", price: 3200, image: "https://placehold.co/500x360/241F1D/EDE3D2?font=roboto&text=H%C3%ADgado", active: true, offer: false }
];

function json(status, body) {
  return {
    statusCode: status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(body),
  };
}

exports.handler = async (event) => {
  const store = getProductsStore();

  if (event.httpMethod === "GET") {
    let products = await store.get(KEY, { type: "json" });
    if (!products) {
      products = SEED_PRODUCTS;
      await store.setJSON(KEY, products);
    }
    return json(200, { products });
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

    const { action, product, id } = payload;
    let products = (await store.get(KEY, { type: "json" })) || SEED_PRODUCTS;

    if (action === "upsert" && product && product.id) {
      const idx = products.findIndex((p) => p.id === product.id);
      if (idx >= 0) {
        products[idx] = { ...products[idx], ...product };
      } else {
        products.push(product);
      }
    } else if (action === "delete" && id) {
      products = products.filter((p) => p.id !== id);
    } else {
      return json(400, { error: "Acción inválida" });
    }

    await store.setJSON(KEY, products);
    return json(200, { products });
  }

  return json(405, { error: "Método no permitido" });
};
