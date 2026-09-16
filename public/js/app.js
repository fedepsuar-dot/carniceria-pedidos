(function () {
  "use strict";

  const WHATSAPP_NUMBER = "5491168310327";
  const PRODUCTS_ENDPOINT = "/.netlify/functions/products";
  const COMBOS_ENDPOINT = "/.netlify/functions/combos";
  const CART_STORAGE_KEY = "carniceria_cart_v1";

  let products = [];
  let combos = [];
  let cart = loadCart();

  const catalogEl = document.getElementById("catalog");
  const loadingMsg = document.getElementById("loadingMsg");
  const categoryNav = document.getElementById("categoryNav");
  const cartCountEl = document.getElementById("cartCount");
  const cartItemsEl = document.getElementById("cartItems");
  const cartDrawer = document.getElementById("cartDrawer");
  const cartOverlay = document.getElementById("cartOverlay");
  const openCartBtn = document.getElementById("openCartBtn");
  const closeCartBtn = document.getElementById("closeCartBtn");
  const sendOrderBtn = document.getElementById("sendOrderBtn");
  const customerNameInput = document.getElementById("customerName");
  const customerAddressInput = document.getElementById("customerAddress");
  const fulfillmentPickup = document.getElementById("fulfillmentPickup");
  const fulfillmentDelivery = document.getElementById("fulfillmentDelivery");
  const pickupInfo = document.getElementById("pickupInfo");
  const deliveryInfo = document.getElementById("deliveryInfo");

  const PICKUP_HOURS = "Lunes a viernes de 10 a 20hs · Sábados de 10 a 14hs.";

  function toggleFulfillmentUI() {
    const isDelivery = fulfillmentDelivery.checked;
    pickupInfo.hidden = isDelivery;
    deliveryInfo.hidden = !isDelivery;
  }

  fulfillmentPickup.addEventListener("change", toggleFulfillmentUI);
  fulfillmentDelivery.addEventListener("change", toggleFulfillmentUI);

  function loadCart() {
    try {
      const raw = localStorage.getItem(CART_STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  function saveCart() {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
  }

  function formatPrice(n) {
    return "$" + Math.round(n).toLocaleString("es-AR");
  }

  function stepFor(unit) {
    return unit === "kg" ? 0.1 : 1;
  }

  function formatQty(qty, unit) {
    if (unit === "kg") {
      return qty.toFixed(1).replace(".", ",") + " kg";
    }
    if (unit === "combo") {
      return qty + (qty === 1 ? " combo" : " combos");
    }
    return qty + (qty === 1 ? " unidad" : " unidades");
  }

  function formatNumberForInput(qty, unit) {
    if (unit === "kg") return qty.toFixed(1).replace(".", ",");
    return String(Math.round(qty));
  }

  // Precio total de una línea del carrito, aplicando el descuento por
  // cantidad si corresponde.
  function lineTotal(item) {
    if (item.type === "combo") return item.price * item.qty;
    const usesBulk = item.bulkMinQty && item.bulkPrice && item.qty >= item.bulkMinQty;
    const unitPrice = usesBulk ? item.bulkPrice : item.price;
    return unitPrice * item.qty;
  }

  function usesBulkPrice(item) {
    return !!(item.bulkMinQty && item.bulkPrice && item.qty >= item.bulkMinQty);
  }

  async function fetchProducts() {
    const res = await fetch(PRODUCTS_ENDPOINT);
    if (!res.ok) throw new Error("No se pudo cargar el catálogo");
    const data = await res.json();
    return (data.products || []).filter((p) => p.active !== false);
  }

  async function fetchCombos() {
    try {
      const res = await fetch(COMBOS_ENDPOINT);
      if (!res.ok) return [];
      const data = await res.json();
      return (data.combos || []).filter((c) => c.active !== false);
    } catch (e) {
      return [];
    }
  }

  function slugify(str) {
    return str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "-");
  }

  function renderCatalog() {
    const categories = [...new Set(products.map((p) => p.category))];
    const offerProducts = products.filter((p) => p.offer);
    const hasOfertas = offerProducts.length > 0 || combos.length > 0;

    const navItems = [];
    if (hasOfertas) navItems.push({ cat: "Ofertas", label: "🔥 Ofertas" });
    categories.forEach((cat) => navItems.push({ cat, label: cat }));

    categoryNav.innerHTML = navItems
      .map(
        (item, i) =>
          `<button data-cat="${item.cat}" class="${i === 0 ? "active" : ""}">${item.label}</button>`
      )
      .join("");

    let sectionsHtml = "";

    if (hasOfertas) {
      sectionsHtml += `
        <section class="category-section" id="cat-ofertas">
          <h2 class="category-title">Ofertas</h2>
          <div class="product-grid">
            ${combos.map(renderComboCard).join("")}
            ${offerProducts.map(renderCard).join("")}
          </div>
        </section>
      `;
    }

    sectionsHtml += categories
      .map((cat) => {
        const items = products.filter((p) => p.category === cat);
        return `
          <section class="category-section" id="cat-${slugify(cat)}">
            <h2 class="category-title">${cat}</h2>
            <div class="product-grid">
              ${items.map(renderCard).join("")}
            </div>
          </section>
        `;
      })
      .join("");

    catalogEl.innerHTML = sectionsHtml;

    categoryNav.querySelectorAll("button").forEach((btn) => {
      btn.addEventListener("click", () => {
        categoryNav.querySelectorAll("button").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        document.getElementById("cat-" + slugify(btn.dataset.cat))
          .scrollIntoView({ behavior: "smooth", block: "start", inline: "nearest" });
      });
    });

    // Un mismo corte puede aparecer dos veces (en Ofertas y en su categoría),
    // así que vinculamos TODAS las tarjetas que existan, no solo la primera.
    document.querySelectorAll(".product-card").forEach((cardEl) => {
      const product = products.find((p) => p.id === cardEl.dataset.id);
      if (product) bindCardEvents(product, cardEl);
    });
    document.querySelectorAll(".combo-card").forEach((cardEl) => {
      const combo = combos.find((c) => c.id === cardEl.dataset.id);
      if (combo) bindComboEvents(combo, cardEl);
    });
  }

  function renderCard(p) {
    const currentQty = cart[p.id] ? cart[p.id].qty : 0;
    const displayQty = currentQty > 0 ? currentQty : stepFor(p.unit);
    const bulkBadge =
      p.bulkMinQty && p.bulkPrice
        ? `<p class="bulk-badge">Llevando ${formatQty(p.bulkMinQty, p.unit)} o más: ${formatPrice(p.bulkPrice)} ${p.unit === "kg" ? "el kg" : "c/u"}</p>`
        : "";
    return `
      <article class="product-card" data-id="${p.id}">
        <div class="product-photo">
          <img src="${p.image}" alt="${p.name}" loading="lazy">
          ${p.offer ? '<span class="offer-stamp">Oferta</span>' : ""}
        </div>
        <div class="product-body">
          <h3 class="product-name">${p.name}</h3>
          <div class="product-price-row">
            <span class="product-price">${formatPrice(p.price)}</span>
            <span class="product-unit">/ ${p.unit === "kg" ? "kg" : "unidad"}</span>
          </div>
          ${bulkBadge}
          <div class="qty-row">
            <div class="stepper">
              <button type="button" class="qty-minus" aria-label="Restar">−</button>
              <div class="qty-input-wrap">
                <input type="text" inputmode="decimal" class="qty-input" value="${formatNumberForInput(displayQty, p.unit)}" aria-label="Cantidad">
                <span class="qty-unit-label">${p.unit === "kg" ? "kg" : "u."}</span>
              </div>
              <button type="button" class="qty-plus" aria-label="Sumar">+</button>
            </div>
            <button type="button" class="add-btn">${currentQty > 0 ? "En el pedido" : "Agregar"}</button>
          </div>
        </div>
      </article>
    `;
  }

  function renderComboCard(c) {
    const currentQty = cart[c.id] ? cart[c.id].qty : 0;
    const displayQty = currentQty > 0 ? currentQty : 1;
    const itemsList = (c.items || [])
      .map((it) => `${it.qty}${it.unit === "kg" ? "kg" : " u."} ${it.name}`)
      .join(" + ");
    return `
      <article class="product-card combo-card" data-id="${c.id}">
        <div class="product-photo">
          <img src="${c.image || "https://placehold.co/500x360/C89B3C/241F1D?text=Combo"}" alt="${c.title}" loading="lazy">
          <span class="offer-stamp combo-stamp">Combo</span>
        </div>
        <div class="product-body">
          <h3 class="product-name">${c.title}</h3>
          <p class="combo-items">${itemsList}</p>
          <div class="product-price-row">
            <span class="product-price">${formatPrice(c.price)}</span>
            <span class="product-unit">/ combo</span>
          </div>
          <div class="qty-row">
            <div class="stepper">
              <button type="button" class="qty-minus" aria-label="Restar">−</button>
              <div class="qty-input-wrap">
                <input type="text" inputmode="numeric" class="qty-input" value="${displayQty}" aria-label="Cantidad">
                <span class="qty-unit-label">u.</span>
              </div>
              <button type="button" class="qty-plus" aria-label="Sumar">+</button>
            </div>
            <button type="button" class="add-btn">${currentQty > 0 ? "En el pedido" : "Agregar"}</button>
          </div>
        </div>
      </article>
    `;
  }

  function bindCardEvents(p, card) {
    if (!card) return;
    const step = stepFor(p.unit);
    const qtyInput = card.querySelector(".qty-input");
    const addBtn = card.querySelector(".add-btn");
    let pendingQty = cart[p.id] ? cart[p.id].qty : step;

    function refreshInput() {
      qtyInput.value = formatNumberForInput(pendingQty, p.unit);
    }

    function commitValue() {
      let raw = qtyInput.value.replace(",", ".").replace(/[^0-9.]/g, "");
      let val = parseFloat(raw);
      if (isNaN(val) || val < step) val = step;
      val = Math.round(val / step) * step;
      pendingQty = +val.toFixed(2);
      refreshInput();
      if (cart[p.id]) updateCartQty(p, pendingQty);
    }

    function applyDelta(delta) {
      pendingQty = Math.max(step, +(pendingQty + delta).toFixed(2));
      refreshInput();
      if (cart[p.id]) updateCartQty(p, pendingQty);
    }

    // Filtra caracteres mientras escribe: solo dígitos y una coma (para kg)
    qtyInput.addEventListener("input", () => {
      let v = qtyInput.value.replace(/[^0-9,]/g, "");
      const parts = v.split(",");
      if (parts.length > 2) v = parts[0] + "," + parts.slice(1).join("");
      if (p.unit !== "kg") v = v.replace(/,/g, "");
      qtyInput.value = v;
    });

    qtyInput.addEventListener("blur", commitValue);
    qtyInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        qtyInput.blur();
      }
    });

    card.querySelector(".qty-minus").addEventListener("click", () => applyDelta(-step));
    card.querySelector(".qty-plus").addEventListener("click", () => applyDelta(step));

    addBtn.addEventListener("click", () => {
      commitValue();
      cart[p.id] = {
        id: p.id,
        name: p.name,
        unit: p.unit,
        price: p.price,
        qty: pendingQty,
        bulkMinQty: p.bulkMinQty || null,
        bulkPrice: p.bulkPrice || null,
      };
      saveCart();
      renderCart();
      addBtn.textContent = "En el pedido";
      addBtn.classList.add("added");
      setTimeout(() => addBtn.classList.remove("added"), 400);
    });
  }

  function bindComboEvents(c, card) {
    if (!card) return;
    const qtyInput = card.querySelector(".qty-input");
    const addBtn = card.querySelector(".add-btn");
    let pendingQty = cart[c.id] ? cart[c.id].qty : 1;

    function refreshInput() {
      qtyInput.value = String(pendingQty);
    }

    function commitValue() {
      let val = parseInt(qtyInput.value.replace(/[^0-9]/g, ""), 10);
      if (isNaN(val) || val < 1) val = 1;
      pendingQty = val;
      refreshInput();
      if (cart[c.id]) updateComboQty(c, pendingQty);
    }

    function applyDelta(delta) {
      pendingQty = Math.max(1, pendingQty + delta);
      refreshInput();
      if (cart[c.id]) updateComboQty(c, pendingQty);
    }

    qtyInput.addEventListener("input", () => {
      qtyInput.value = qtyInput.value.replace(/[^0-9]/g, "");
    });
    qtyInput.addEventListener("blur", commitValue);
    qtyInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        qtyInput.blur();
      }
    });

    card.querySelector(".qty-minus").addEventListener("click", () => applyDelta(-1));
    card.querySelector(".qty-plus").addEventListener("click", () => applyDelta(1));

    addBtn.addEventListener("click", () => {
      commitValue();
      cart[c.id] = {
        id: c.id,
        type: "combo",
        name: c.title,
        price: c.price,
        unit: "combo",
        qty: pendingQty,
        items: c.items || [],
      };
      saveCart();
      renderCart();
      addBtn.textContent = "En el pedido";
      addBtn.classList.add("added");
      setTimeout(() => addBtn.classList.remove("added"), 400);
    });
  }

  function updateCartQty(p, qty) {
    cart[p.id] = {
      id: p.id,
      name: p.name,
      unit: p.unit,
      price: p.price,
      qty,
      bulkMinQty: p.bulkMinQty || null,
      bulkPrice: p.bulkPrice || null,
    };
    saveCart();
    renderCart();
  }

  function updateComboQty(c, qty) {
    cart[c.id] = {
      id: c.id,
      type: "combo",
      name: c.title,
      price: c.price,
      unit: "combo",
      qty,
      items: c.items || [],
    };
    saveCart();
    renderCart();
  }

  function cartTotal() {
    return Object.values(cart).reduce((sum, item) => sum + lineTotal(item), 0);
  }

  function renderCart() {
    const items = Object.values(cart);
    cartCountEl.textContent = items.length;

    if (items.length === 0) {
      cartItemsEl.innerHTML = '<p class="cart-empty">Todavía no agregaste ningún corte.</p>';
      sendOrderBtn.disabled = true;
      return;
    }

    cartItemsEl.innerHTML = items
      .map((item) => {
        if (item.type === "combo") {
          const itemsList = (item.items || [])
            .map((it) => `${it.qty}${it.unit === "kg" ? "kg" : " u."} ${it.name}`)
            .join(" + ");
          return `
            <div class="cart-line" data-id="${item.id}">
              <div class="cart-line-info">
                <p class="cart-line-name">${item.name} (x${item.qty})</p>
                <p class="cart-line-sub combo-sub">${itemsList}</p>
                <p class="cart-line-sub">${formatPrice(lineTotal(item))}</p>
              </div>
              <div class="cart-line-actions">
                <button type="button" class="cart-line-remove" aria-label="Quitar">🗑</button>
              </div>
            </div>
          `;
        }
        const product = products.find((p) => p.id === item.id);
        const img = product ? product.image : "";
        const bulkTag = usesBulkPrice(item) ? ' <span class="bulk-tag">precio x cantidad</span>' : "";
        return `
          <div class="cart-line" data-id="${item.id}">
            <img src="${img}" alt="${item.name}">
            <div class="cart-line-info">
              <p class="cart-line-name">${item.name}</p>
              <p class="cart-line-sub">${formatQty(item.qty, item.unit)} · ${formatPrice(lineTotal(item))}${bulkTag}</p>
            </div>
            <div class="cart-line-actions">
              <button type="button" class="cart-line-remove" aria-label="Quitar">🗑</button>
            </div>
          </div>
        `;
      })
      .join("") +
      `<div class="cart-total-row"><span>Total estimado</span><span>${formatPrice(cartTotal())}</span></div>`;

    cartItemsEl.querySelectorAll(".cart-line-remove").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const id = e.target.closest(".cart-line").dataset.id;
        delete cart[id];
        saveCart();
        renderCart();
        document
          .querySelectorAll(`.product-card[data-id="${id}"] .add-btn, .combo-card[data-id="${id}"] .add-btn`)
          .forEach((btn2) => (btn2.textContent = "Agregar"));
      });
    });

    sendOrderBtn.disabled = false;
  }

  function buildWhatsappMessage() {
    const items = Object.values(cart);
    const name = customerNameInput.value.trim();
    const isDelivery = fulfillmentDelivery.checked;
    const address = customerAddressInput.value.trim();
    let lines = [];
    lines.push("¡Hola! Quiero hacer este pedido" + (name ? ` a nombre de ${name}` : "") + ":");
    lines.push("");
    items.forEach((item) => {
      if (item.type === "combo") {
        lines.push(`• ${item.name} (x${item.qty}) — ${formatPrice(lineTotal(item))}`);
        (item.items || []).forEach((it) => {
          lines.push(`   - ${it.qty}${it.unit === "kg" ? "kg" : " u."} ${it.name}`);
        });
      } else {
        const bulkNote = usesBulkPrice(item) ? " (precio por cantidad)" : "";
        lines.push(`• ${item.name} — ${formatQty(item.qty, item.unit)}${bulkNote}`);
      }
    });
    lines.push("");
    lines.push(`Total estimado: ${formatPrice(cartTotal())}`);
    lines.push("");
    if (isDelivery) {
      lines.push("Modalidad: Delivery");
      if (address) lines.push(`Dirección de entrega: ${address}`);
    } else {
      lines.push("Modalidad: Retiro en el local");
      lines.push(`Horario: ${PICKUP_HOURS}`);
    }
    lines.push("");
    lines.push("Quedo atento/a a la confirmación del total y la hora de retiro. ¡Gracias!");
    lines.push("");
    lines.push("Los productos no incluyen IVA, si requiere factura A, avisar antes de realizar el pago.");
    return lines.join("\n");
  }

  function openCart() {
    cartDrawer.classList.add("open");
    cartOverlay.hidden = false;
    cartDrawer.setAttribute("aria-hidden", "false");
  }

  function closeCart() {
    cartDrawer.classList.remove("open");
    cartOverlay.hidden = true;
    cartDrawer.setAttribute("aria-hidden", "true");
  }

  openCartBtn.addEventListener("click", openCart);
  closeCartBtn.addEventListener("click", closeCart);
  cartOverlay.addEventListener("click", closeCart);

  sendOrderBtn.addEventListener("click", () => {
    const message = buildWhatsappMessage();
    const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank");
  });

  async function init() {
    try {
      products = await fetchProducts();
      combos = await fetchCombos();
      loadingMsg.remove();
      renderCatalog();
      renderCart();
    } catch (e) {
      loadingMsg.textContent = "No pudimos cargar el catálogo. Recargá la página en un momento.";
    }
  }

  init();
})();
