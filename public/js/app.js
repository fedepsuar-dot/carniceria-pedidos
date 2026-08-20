(function () {
  "use strict";
 
  const WHATSAPP_NUMBER = "5491168310327";
  const PRODUCTS_ENDPOINT = "/.netlify/functions/products";
  const CART_STORAGE_KEY = "carniceria_cart_v1";
 
  let products = [];
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
    return unit === "kg" ? 0.5 : 1;
  }
 
  function formatQty(qty, unit) {
    if (unit === "kg") {
      return qty.toFixed(1).replace(".", ",") + " kg";
    }
    return qty + (qty === 1 ? " unidad" : " unidades");
  }
 
  async function fetchProducts() {
    const res = await fetch(PRODUCTS_ENDPOINT);
    if (!res.ok) throw new Error("No se pudo cargar el catálogo");
    const data = await res.json();
    return (data.products || []).filter((p) => p.active !== false);
  }
 
  function renderCatalog() {
    const categories = [...new Set(products.map((p) => p.category))];
 
    categoryNav.innerHTML = categories
      .map(
        (cat, i) =>
          `<button data-cat="${cat}" class="${i === 0 ? "active" : ""}">${cat}</button>`
      )
      .join("");
 
    catalogEl.innerHTML = categories
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
 
    categoryNav.querySelectorAll("button").forEach((btn) => {
      btn.addEventListener("click", () => {
        categoryNav.querySelectorAll("button").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        document.getElementById("cat-" + slugify(btn.dataset.cat))
          .scrollIntoView({ behavior: "smooth", block: "start", inline: "nearest" });
      });
    });
 
    products.forEach((p) => bindCardEvents(p));
  }
 
  function slugify(str) {
    return str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "-");
  }
 
  function renderCard(p) {
    const step = stepFor(p.unit);
    const currentQty = cart[p.id] ? cart[p.id].qty : 0;
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
          <div class="qty-row">
            <div class="stepper">
              <button type="button" class="qty-minus" aria-label="Restar">−</button>
              <span class="qty-value">${currentQty > 0 ? formatQty(currentQty, p.unit) : (p.unit === "kg" ? "0,5 kg" : "1")}</span>
              <button type="button" class="qty-plus" aria-label="Sumar">+</button>
            </div>
            <button type="button" class="add-btn">${currentQty > 0 ? "En el pedido" : "Agregar"}</button>
          </div>
        </div>
      </article>
    `;
  }
 
  function bindCardEvents(p) {
    const card = document.querySelector(`.product-card[data-id="${p.id}"]`);
    if (!card) return;
    const step = stepFor(p.unit);
    const qtyValueEl = card.querySelector(".qty-value");
    const addBtn = card.querySelector(".add-btn");
    let pendingQty = cart[p.id] ? cart[p.id].qty : step;
 
    function refreshLabel() {
      qtyValueEl.textContent = formatQty(pendingQty, p.unit).replace(",", ",");
    }
 
    card.querySelector(".qty-minus").addEventListener("click", () => {
      pendingQty = Math.max(step, +(pendingQty - step).toFixed(2));
      refreshLabel();
      if (cart[p.id]) updateCartQty(p, pendingQty);
    });
 
    card.querySelector(".qty-plus").addEventListener("click", () => {
      pendingQty = +(pendingQty + step).toFixed(2);
      refreshLabel();
      if (cart[p.id]) updateCartQty(p, pendingQty);
    });
 
    addBtn.addEventListener("click", () => {
      cart[p.id] = { id: p.id, name: p.name, unit: p.unit, price: p.price, qty: pendingQty };
      saveCart();
      renderCart();
      addBtn.textContent = "En el pedido";
      addBtn.classList.add("added");
      setTimeout(() => addBtn.classList.remove("added"), 400);
    });
  }
 
  function updateCartQty(p, qty) {
    cart[p.id] = { id: p.id, name: p.name, unit: p.unit, price: p.price, qty };
    saveCart();
    renderCart();
  }
 
  function cartTotal() {
    return Object.values(cart).reduce((sum, item) => sum + item.price * item.qty, 0);
  }
 
  function cartCount() {
    return Object.keys(cart).length;
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
        const product = products.find((p) => p.id === item.id);
        const img = product ? product.image : "";
        return `
          <div class="cart-line" data-id="${item.id}">
            <img src="${img}" alt="${item.name}">
            <div class="cart-line-info">
              <p class="cart-line-name">${item.name}</p>
              <p class="cart-line-sub">${formatQty(item.qty, item.unit)} · ${formatPrice(item.price * item.qty)}</p>
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
        const addBtn = document.querySelector(`.product-card[data-id="${id}"] .add-btn`);
        if (addBtn) addBtn.textContent = "Agregar";
      });
    });
 
    sendOrderBtn.disabled = false;
  }
 
  function buildWhatsappMessage() {
    const items = Object.values(cart);
    const name = customerNameInput.value.trim();
    const address = customerAddressInput.value.trim();
    let lines = [];
    lines.push("¡Hola! Quiero hacer este pedido" + (name ? ` a nombre de ${name}` : "") + ":");
    lines.push("");
    items.forEach((item) => {
      lines.push(`• ${item.name} — ${formatQty(item.qty, item.unit)}`);
    });
    lines.push("");
    lines.push(`Total estimado: ${formatPrice(cartTotal())}`);
    if (address) {
      lines.push("");
      lines.push(`Dirección de entrega: ${address}`);
    }
    lines.push("");
    lines.push("Quedo atento/a a la confirmación del total y la hora de retiro. ¡Gracias!");
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
      loadingMsg.remove();
      renderCatalog();
      renderCart();
    } catch (e) {
      loadingMsg.textContent = "No pudimos cargar el catálogo. Recargá la página en un momento.";
    }
  }
 
  init();
})();
 
