(function () {
  "use strict";

  const PRODUCTS_ENDPOINT = "/.netlify/functions/products";
  const COMBOS_ENDPOINT = "/.netlify/functions/combos";
  const LOGIN_ENDPOINT = "/.netlify/functions/login";
  const TOKEN_KEY = "carniceria_admin_token";

  let products = [];
  let combos = [];

  const loginScreen = document.getElementById("loginScreen");
  const adminScreen = document.getElementById("adminScreen");
  const loginForm = document.getElementById("loginForm");
  const loginError = document.getElementById("loginError");
  const logoutBtn = document.getElementById("logoutBtn");
  const productListEl = document.getElementById("productList");
  const addForm = document.getElementById("addForm");
  const categoryList = document.getElementById("categoryList");

  const newBulkToggle = document.getElementById("newBulkToggle");
  const newBulkQtyField = document.getElementById("newBulkQtyField");
  const newBulkPriceField = document.getElementById("newBulkPriceField");

  const comboForm = document.getElementById("comboForm");
  const comboListEl = document.getElementById("comboList");
  const comboItemsList = document.getElementById("comboItemsList");
  const addComboItemBtn = document.getElementById("addComboItemBtn");
  const comboEditIdInput = document.getElementById("comboEditId");
  const comboFormTitle = document.getElementById("comboFormTitle");
  const cancelComboEditBtn = document.getElementById("cancelComboEditBtn");

  const IMAGES_ENDPOINT = "/.netlify/functions/images";

  // ---------- Subida de imágenes ----------

  // Achica la foto antes de subirla: las fotos de celular/cámara suelen pesar
  // varios MB y no hace falta tanto para mostrarlas en el catálogo.
  function resizeImage(file, maxSize) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("No se pudo leer el archivo"));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error("El archivo no es una imagen válida"));
        img.onload = () => {
          let { width, height } = img;
          if (width > maxSize || height > maxSize) {
            if (width > height) {
              height = Math.round((height * maxSize) / width);
              width = maxSize;
            } else {
              width = Math.round((width * maxSize) / height);
              height = maxSize;
            }
          }
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
          resolve(dataUrl.split(",")[1]);
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  async function uploadImage(file) {
    const base64 = await resizeImage(file, 1000);
    const res = await fetch(IMAGES_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-token": getToken() },
      body: JSON.stringify({
        data: base64,
        contentType: "image/jpeg",
        filename: file.name,
      }),
    });
    if (res.status === 401) throw new Error("unauthorized");
    if (!res.ok) {
      let msg = "No se pudo subir la imagen";
      try {
        const err = await res.json();
        if (err.error) msg = err.error;
      } catch (e) {}
      throw new Error(msg);
    }
    const data = await res.json();
    return data.url;
  }

  // Conecta un input de archivo con su campo de texto y su vista previa.
  function wireUpload(fileInput, urlInput, previewEl) {
    if (!fileInput) return;
    fileInput.addEventListener("change", async () => {
      const file = fileInput.files && fileInput.files[0];
      if (!file) return;

      const previewImg = previewEl.querySelector("img");
      const statusEl = previewEl.querySelector(".upload-status");
      previewEl.hidden = false;
      statusEl.className = "upload-status";
      statusEl.textContent = "Subiendo…";

      try {
        const url = await uploadImage(file);
        urlInput.value = url;
        previewImg.src = url;
        statusEl.className = "upload-status ok";
        statusEl.textContent = "Foto lista ✓";
      } catch (err) {
        statusEl.className = "upload-status error";
        statusEl.textContent = err.message || "Error al subir";
        if (err.message === "unauthorized") handleAuthError(err);
      } finally {
        fileInput.value = "";
      }
    });
  }

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

  // ---------- Cortes ----------

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
          <div class="row-image-wrap">
            <input type="text" class="f-image" value="${escapeAttr(p.image || "")}" placeholder="URL foto o subí una">
            <label class="row-upload-btn">
              Subir foto
              <input type="file" class="f-image-file" accept="image/*" hidden>
            </label>
          </div>
          <div class="row-active-toggle">
            <label><input type="checkbox" class="f-active" ${p.active !== false ? "checked" : ""}> Visible</label>
            <label><input type="checkbox" class="f-offer" ${p.offer ? "checked" : ""}> Oferta</label>
          </div>
          <div class="admin-bulk-row">
            <label><input type="checkbox" class="f-bulk-toggle" ${p.bulkMinQty && p.bulkPrice ? "checked" : ""}> Descuento por cantidad</label>
            <label>A partir de <input type="number" class="f-bulk-qty" min="0" step="0.1" value="${p.bulkMinQty || ""}" ${p.bulkMinQty && p.bulkPrice ? "" : "hidden"}></label>
            <label>Precio $ <input type="number" class="f-bulk-price" min="0" step="1" value="${p.bulkPrice || ""}" ${p.bulkMinQty && p.bulkPrice ? "" : "hidden"}></label>
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
      const bulkToggle = row.querySelector(".f-bulk-toggle");
      const bulkQtyInput = row.querySelector(".f-bulk-qty");
      const bulkPriceInput = row.querySelector(".f-bulk-price");

      bulkToggle.addEventListener("change", () => {
        bulkQtyInput.hidden = !bulkToggle.checked;
        bulkPriceInput.hidden = !bulkToggle.checked;
      });

      // Subida de foto directa en esta fila
      const rowFileInput = row.querySelector(".f-image-file");
      const rowImageInput = row.querySelector(".f-image");
      const rowThumb = row.querySelector("img");
      rowFileInput.addEventListener("change", async () => {
        const file = rowFileInput.files && rowFileInput.files[0];
        if (!file) return;
        const flash = row.querySelector(".save-flash");
        flash.hidden = false;
        flash.textContent = "Subiendo foto…";
        try {
          const url = await uploadImage(file);
          rowImageInput.value = url;
          rowThumb.src = url;
          flash.textContent = "Foto subida — tocá Guardar ✓";
          setTimeout(() => {
            flash.hidden = true;
            flash.textContent = "Guardado ✓";
          }, 4000);
        } catch (err) {
          flash.textContent = err.message || "Error al subir";
          setTimeout(() => {
            flash.hidden = true;
            flash.textContent = "Guardado ✓";
          }, 4000);
          if (err.message === "unauthorized") handleAuthError(err);
        } finally {
          rowFileInput.value = "";
        }
      });

      row.querySelector(".row-save").addEventListener("click", async () => {
        const bulkOn = bulkToggle.checked;
        const product = {
          id,
          name: row.querySelector(".f-name").value.trim(),
          category: row.querySelector(".f-category").value.trim(),
          unit: row.querySelector(".f-unit").value,
          price: Number(row.querySelector(".f-price").value) || 0,
          image: row.querySelector(".f-image").value.trim(),
          active: row.querySelector(".f-active").checked,
          offer: row.querySelector(".f-offer").checked,
          bulkMinQty: bulkOn ? Number(bulkQtyInput.value) || null : null,
          bulkPrice: bulkOn ? Number(bulkPriceInput.value) || null : null,
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

  newBulkToggle.addEventListener("change", () => {
    newBulkQtyField.hidden = !newBulkToggle.checked;
    newBulkPriceField.hidden = !newBulkToggle.checked;
  });

  wireUpload(
    document.getElementById("newImageFile"),
    document.getElementById("newImage"),
    document.getElementById("newImagePreview")
  );

  wireUpload(
    document.getElementById("comboImageFile"),
    document.getElementById("comboImage"),
    document.getElementById("comboImagePreview")
  );

  addForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = document.getElementById("newName").value.trim();
    const category = document.getElementById("newCategory").value.trim();
    const price = Number(document.getElementById("newPrice").value) || 0;
    const unit = document.getElementById("newUnit").value;
    const image = document.getElementById("newImage").value.trim();
    const offer = document.getElementById("newOffer").checked;
    const bulkOn = newBulkToggle.checked;
    const bulkMinQty = bulkOn ? Number(document.getElementById("newBulkQty").value) || null : null;
    const bulkPrice = bulkOn ? Number(document.getElementById("newBulkPrice").value) || null : null;

    if (!name || !category) return;

    const product = {
      id: slugify(name),
      name,
      category,
      price,
      unit,
      image,
      offer,
      active: true,
      bulkMinQty,
      bulkPrice,
    };

    try {
      await saveProduct(product);
      products.push(product);
      renderList();
      addForm.reset();
      newBulkQtyField.hidden = true;
      newBulkPriceField.hidden = true;
    } catch (e) {
      handleAuthError(e);
    }
  });

  // ---------- Combos / ofertas especiales ----------

  async function fetchCombos() {
    const res = await fetch(COMBOS_ENDPOINT);
    const data = await res.json();
    return data.combos || [];
  }

  async function saveCombo(combo) {
    const res = await fetch(COMBOS_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-token": getToken() },
      body: JSON.stringify({ action: "upsert", combo }),
    });
    if (res.status === 401) throw new Error("unauthorized");
    if (!res.ok) throw new Error("save failed");
    return res.json();
  }

  async function deleteCombo(id) {
    const res = await fetch(COMBOS_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-token": getToken() },
      body: JSON.stringify({ action: "delete", id }),
    });
    if (res.status === 401) throw new Error("unauthorized");
    if (!res.ok) throw new Error("delete failed");
    return res.json();
  }

  function addComboItemRow(item) {
    item = item || { name: "", qty: 1, unit: "kg" };
    const row = document.createElement("div");
    row.className = "combo-item-row";
    row.innerHTML = `
      <input type="text" class="ci-name" placeholder="Ej: Milanesa de pollo" value="${escapeAttr(item.name)}">
      <input type="number" class="ci-qty" min="0" step="0.1" value="${item.qty}">
      <select class="ci-unit">
        <option value="kg" ${item.unit === "kg" ? "selected" : ""}>kg</option>
        <option value="unidad" ${item.unit === "unidad" ? "selected" : ""}>unidad</option>
      </select>
      <button type="button" class="combo-item-remove" aria-label="Quitar">✕</button>
    `;
    row.querySelector(".combo-item-remove").addEventListener("click", () => row.remove());
    comboItemsList.appendChild(row);
  }

  addComboItemBtn.addEventListener("click", () => addComboItemRow());

  function resetComboForm() {
    comboForm.reset();
    comboEditIdInput.value = "";
    comboItemsList.innerHTML = "";
    addComboItemRow();
    addComboItemRow();
    comboFormTitle.textContent = "Crear combo / oferta especial";
    comboForm.querySelector(".whatsapp-btn").textContent = "Crear combo";
    cancelComboEditBtn.hidden = true;
    const preview = document.getElementById("comboImagePreview");
    if (preview) {
      preview.hidden = true;
      preview.querySelector("img").src = "";
      preview.querySelector(".upload-status").textContent = "";
    }
  }

  cancelComboEditBtn.addEventListener("click", resetComboForm);

  function collectComboItems() {
    return Array.from(comboItemsList.querySelectorAll(".combo-item-row"))
      .map((row) => ({
        name: row.querySelector(".ci-name").value.trim(),
        qty: Number(row.querySelector(".ci-qty").value) || 0,
        unit: row.querySelector(".ci-unit").value,
      }))
      .filter((it) => it.name && it.qty > 0);
  }

  comboForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const title = document.getElementById("comboTitle").value.trim();
    const price = Number(document.getElementById("comboPrice").value) || 0;
    const image = document.getElementById("comboImage").value.trim();
    const items = collectComboItems();
    const editId = comboEditIdInput.value;

    if (!title || items.length === 0) {
      alert("Completá el nombre del combo y al menos un producto incluido.");
      return;
    }

    const combo = {
      id: editId || slugify("combo-" + title),
      title,
      price,
      image,
      items,
      active: true,
    };

    try {
      await saveCombo(combo);
      if (editId) {
        combos = combos.map((c) => (c.id === editId ? combo : c));
      } else {
        combos.push(combo);
      }
      renderComboList();
      resetComboForm();
    } catch (err) {
      handleAuthError(err);
    }
  });

  function renderComboList() {
    if (combos.length === 0) {
      comboListEl.innerHTML = '<p class="admin-hint">Todavía no cargaste ningún combo.</p>';
      return;
    }

    comboListEl.innerHTML = combos
      .map((c) => {
        const itemsList = (c.items || [])
          .map((it) => `${it.qty}${it.unit === "kg" ? "kg" : " u."} ${it.name}`)
          .join(" + ");
        return `
          <div class="admin-product-row" data-id="${c.id}">
            <img src="${c.image || "https://placehold.co/100x100/C89B3C/241F1D?text=Combo"}" alt="${c.title}">
            <div class="combo-row-summary">
              <strong>${escapeAttr(c.title)}</strong> — ${formatPriceAdmin(c.price)}<br>
              ${itemsList}
            </div>
            <div class="row-active-toggle">
              <label><input type="checkbox" class="f-combo-active" ${c.active !== false ? "checked" : ""}> Visible</label>
            </div>
            <div class="row-actions">
              <button type="button" class="row-edit-combo">Editar</button>
              <button type="button" class="row-delete-combo">Borrar</button>
            </div>
          </div>
        `;
      })
      .join("");

    comboListEl.querySelectorAll(".admin-product-row").forEach((row) => {
      const id = row.dataset.id;
      const combo = combos.find((c) => c.id === id);

      row.querySelector(".f-combo-active").addEventListener("change", async (e) => {
        const updated = { ...combo, active: e.target.checked };
        try {
          await saveCombo(updated);
          combos = combos.map((c) => (c.id === id ? updated : c));
        } catch (err) {
          handleAuthError(err);
        }
      });

      row.querySelector(".row-edit-combo").addEventListener("click", () => {
        comboEditIdInput.value = combo.id;
        document.getElementById("comboTitle").value = combo.title;
        document.getElementById("comboPrice").value = combo.price;
        document.getElementById("comboImage").value = combo.image || "";
        const cPreview = document.getElementById("comboImagePreview");
        if (cPreview && combo.image) {
          cPreview.hidden = false;
          cPreview.querySelector("img").src = combo.image;
          cPreview.querySelector(".upload-status").className = "upload-status";
          cPreview.querySelector(".upload-status").textContent = "Foto actual";
        }
        comboItemsList.innerHTML = "";
        (combo.items || []).forEach((it) => addComboItemRow(it));
        if ((combo.items || []).length === 0) addComboItemRow();
        comboFormTitle.textContent = "Editar combo";
        comboForm.querySelector(".whatsapp-btn").textContent = "Actualizar combo";
        cancelComboEditBtn.hidden = false;
        comboForm.scrollIntoView({ behavior: "smooth", block: "start" });
      });

      row.querySelector(".row-delete-combo").addEventListener("click", async () => {
        if (!confirm("¿Borrar este combo?")) return;
        try {
          await deleteCombo(id);
          combos = combos.filter((c) => c.id !== id);
          renderComboList();
        } catch (err) {
          handleAuthError(err);
        }
      });
    });
  }

  function formatPriceAdmin(n) {
    return "$" + Math.round(n).toLocaleString("es-AR");
  }

  // ---------- Login ----------

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
    combos = await fetchCombos();
    renderComboList();
    if (comboItemsList.children.length === 0) {
      addComboItemRow();
      addComboItemRow();
    }
  }

  (function init() {
    if (getToken()) {
      showAdmin();
    } else {
      showLogin();
    }
  })();
})();
