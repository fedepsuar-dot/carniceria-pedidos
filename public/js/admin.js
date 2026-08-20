(function () {
  "use strict";

  const PRODUCTS_ENDPOINT = "/.netlify/functions/products";
  const LOGIN_ENDPOINT = "/.netlify/functions/login";
  const TOKEN_KEY = "carniceria_admin_token";

  let products = [];

  const loginScreen = document.getElementById("loginScreen");
  const adminScreen = document.getElementById("adminScreen");
  const loginForm = document.getElementById("loginForm");
  const loginError = document.getElementById("loginError");
  const logoutBtn = document.getElementById("logoutBtn");
  const productListEl = document.getElementById("productList");
  const addForm = document.getElementById("addForm");
  const categoryList = document.getElementById("categoryList");

  function getToken() {
    return localStorage.getItem(TOKEN_KEY);
  }

  function setToken(t) {
    localStorage.setItem(TOKEN_KEY, t);
  }

  function clearToken() {
    localStorage.removeItem(TOKEN_KEY);
  }

  function slugify(str) {
    return (
      str
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "") + "-" + Math.random().toString(36).slice(2, 6)
    );
  }

  async function fetchProducts() {
    const res = await fetch(PRODUCTS_ENDPOINT);
    const data = await res.json();
    return data.products || [];
  }

  async function saveProduct(product) {
    const res = await fetch(PRODUCTS_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-token": getToken() },
      body: JSON.stringify({ action: "upsert", product }),
    });
    if (res.status === 401) throw new Error("unauthorized");
    if (!res.ok) throw new Error("save failed");
    return res.json();
  }

  async function deleteProduct(id) {
    const res = await fetch(PRODUCTS_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-token": getToken() },
      body: JSON.stringify({ action: "delete", id }),
    });
    if (res.status === 401) throw new Error("unauthorized");
    if (!res.ok) throw new Error("delete failed");
    return res.json();
  }

  function renderList() {
    const categories = [...new Set(products.map((p) => p.category))];
    categoryList.innerHTML = categories.map((c) => `<option value="${c}">`).join("");

    productListEl.innerHTML = products
      .map(
        (p) => `
        <div class="admin-product-row" data-id="${p.id}">
          <img src="${p.image || "https://placehold.co/100x100/241F1D/EDE3D2?text=%3F"}" alt="${p.name}">
          <input type="text" class="f-name" value="${escapeAttr(p.name)}" placeholder="Nombre">
          <input type="text" class="f-category" value="${escapeAttr(p.category)}" placeholder="Categoría" list="categoryList">
          <select class="f-unit">
            <option value="kg" ${p.unit === "kg" ? "selected" : ""}>Kilo</option>
            <option value="unidad" ${p.unit === "unidad" ? "selected" : ""}>Unidad</option>
          </select>
          <input type="number" class="f-price" value="${p.price}" min="0" step="1">
          <input type="url" class="f-image" value="${escapeAttr(p.image || "")}" placeholder="URL foto" style="grid-column: 1 / -1;">
          <div class="row-active-toggle">
            <label><input type="checkbox" class="f-active" ${p.active !== false ? "checked" : ""}> Visible</label>
            <label><input type="checkbox" class="f-offer" ${p.offer ? "checked" : ""}> Oferta</label>
          </div>
          <div class="row-actions">
            <button type="button" class="row-save">Guardar</button>
            <button type="button" class="row-delete">Borrar</button>
          </div>
          <span class="save-flash" hidden>Guardado ✓</span>
        </div>
      `
      )
      .join("");

    productListEl.querySelectorAll(".admin-product-row").forEach((row) => {
      const id = row.dataset.id;
      row.querySelector(".row-save").addEventListener("click", async () => {
        const product = {
          id,
          name: row.querySelector(".f-name").value.trim(),
          category: row.querySelector(".f-category").value.trim(),
          unit: row.querySelector(".f-unit").value,
          price: Number(row.querySelector(".f-price").value) || 0,
          image: row.querySelector(".f-image").value.trim(),
          active: row.querySelector(".f-active").checked,
          offer: row.querySelector(".f-offer").checked,
        };
        try {
          await saveProduct(product);
          const flash = row.querySelector(".save-flash");
          flash.hidden = false;
          setTimeout(() => (flash.hidden = true), 1500);
          products = products.map((p) => (p.id === id ? product : p));
        } catch (e) {
          handleAuthError(e);
        }
      });

      row.querySelector(".row-delete").addEventListener("click", async () => {
        if (!confirm("¿Borrar este corte del catálogo?")) return;
        try {
          await deleteProduct(id);
          products = products.filter((p) => p.id !== id);
          renderList();
        } catch (e) {
          handleAuthError(e);
        }
      });
    });
  }

  function escapeAttr(str) {
    return String(str).replace(/"/g, "&quot;");
  }

  function handleAuthError(e) {
    if (e.message === "unauthorized") {
      alert("Tu sesión expiró. Ingresá de nuevo.");
      clearToken();
      showLogin();
    } else {
      alert("Ocurrió un error guardando los cambios. Probá de nuevo.");
    }
  }

  addForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = document.getElementById("newName").value.trim();
    const category = document.getElementById("newCategory").value.trim();
    const price = Number(document.getElementById("newPrice").value) || 0;
    const unit = document.getElementById("newUnit").value;
    const image = document.getElementById("newImage").value.trim();
    const offer = document.getElementById("newOffer").checked;

    if (!name || !category) return;

    const product = { id: slugify(name), name, category, price, unit, image, offer, active: true };

    try {
      await saveProduct(product);
      products.push(product);
      renderList();
      addForm.reset();
    } catch (e) {
      handleAuthError(e);
    }
  });

  async function attemptLogin() {
    loginError.hidden = true;
    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value;

    if (!username || !password) {
      loginError.textContent = "Completá usuario y clave.";
      loginError.hidden = false;
      return;
    }

    try {
      const res = await fetch(LOGIN_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      if (!res.ok) {
        loginError.textContent = "Usuario o clave incorrectos.";
        loginError.hidden = false;
        return;
      }

      const data = await res.json();
      setToken(data.token);
      await showAdmin();
    } catch (err) {
      loginError.textContent = "No se pudo conectar. Revisá tu conexión e intentá de nuevo.";
      loginError.hidden = false;
      console.error("Error de login:", err);
    }
  }

  document.getElementById("loginBtn").addEventListener("click", attemptLogin);

  loginForm.addEventListener("submit", (e) => {
    e.preventDefault();
    attemptLogin();
  });

  document.getElementById("password").addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      attemptLogin();
    }
  });

  logoutBtn.addEventListener("click", () => {
    clearToken();
    showLogin();
  });

  function showLogin() {
    loginScreen.hidden = false;
    adminScreen.hidden = true;
  }

  async function showAdmin() {
    loginScreen.hidden = true;
    adminScreen.hidden = false;
    products = await fetchProducts();
    renderList();
  }

  (function init() {
    if (getToken()) {
      showAdmin();
    } else {
      showLogin();
    }
  })();
})();
