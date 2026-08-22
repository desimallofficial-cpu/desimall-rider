/**
 * DesiMall seller page controller.
 * Separates Products and Inventory into real URLs while reusing the live seller API/session.
 */
(function () {
  const page = document.body?.dataset?.sellerPage || 'products';

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  function setNavigation() {
    document.querySelectorAll('.panel-nav a').forEach(a => a.classList.remove('active'));
    const active = document.querySelector(`.panel-nav a[href="${page}.html"]`);
    if (active) active.classList.add('active');
  }

  function setPageContent() {
    const products = document.getElementById('products');
    const inventory = document.getElementById('inventory');
    const addButton = document.getElementById('openProductModal');
    const heading = document.querySelector('.panel-topbar h1');
    const welcome = document.getElementById('sellerWelcome');

    if (page === 'inventory') {
      if (products) products.hidden = true;
      if (inventory) inventory.hidden = false;
      if (addButton) addButton.hidden = true;
      if (heading) heading.textContent = 'दुकान का स्टॉक';
      if (welcome) welcome.textContent = 'उपलब्ध, सुरक्षित, बिकी और कम स्टॉक इकाइयों का साफ हिसाब।';
      document.body.classList.add('seller-inventory-page');
      ensureInventoryTable();
    } else {
      if (products) products.hidden = false;
      if (inventory) inventory.hidden = true;
      if (addButton) addButton.hidden = false;
      if (heading) heading.textContent = 'दुकान का सामान';
      document.body.classList.add('seller-products-page');
    }
  }

  function ensureInventoryTable() {
    const section = document.getElementById('inventory');
    if (!section || document.getElementById('inventoryProductBody')) return;
    section.insertAdjacentHTML('beforeend', `
      <div class="inventory-toolbar">
        <div>
          <h2>सामान के अनुसार स्टॉक</h2>
          <p class="muted">उपलब्ध स्टॉक = कुल स्टॉक में से सुरक्षित मात्रा घटाकर।</p>
        </div>
        <input id="inventorySearch" type="search" placeholder="सामान, SKU या श्रेणी खोजें">
      </div>
      <div class="table-wrap inventory-table-wrap">
        <table class="data-table inventory-product-table">
          <thead><tr><th>सामान</th><th>SKU / श्रेणी</th><th>उपलब्ध</th><th>सुरक्षित</th><th>बिका</th><th>स्टॉक स्थिति</th><th>कार्रवाई</th></tr></thead>
          <tbody id="inventoryProductBody"></tbody>
        </table>
      </div>`);
    document.getElementById('inventorySearch')?.addEventListener('input', renderInventoryTable);
  }

  function renderInventoryTable() {
    if (page !== 'inventory' || !window.SellerPanel) return;
    ensureInventoryTable();
    const body = document.getElementById('inventoryProductBody');
    if (!body) return;
    const query = (document.getElementById('inventorySearch')?.value || '').trim().toLowerCase();
    const rows = (SellerPanel.products || []).filter(p =>
      `${p.ProductName || ''} ${p.SKU || ''} ${p.Category || ''} ${p.ProductID || ''}`.toLowerCase().includes(query)
    );
    body.innerHTML = rows.length ? rows.map(p => {
      const stock = Number(p.Stock || 0);
      const reserved = Number(p.ReservedStock || 0);
      const sold = Number(p.SoldQty || 0);
      const available = Math.max(0, stock - reserved);
      const health = available === 0 ? ['स्टॉक खत्म','bad'] : available <= 5 ? ['स्टॉक कम','warn'] : ['भरपूर स्टॉक','good'];
      const img = p.ImageURL || '../assets/products/noimage.jpg';
      return `<tr>
        <td><div class="product-cell"><img src="${esc(img)}" onerror="this.src='../assets/products/noimage.jpg'"><div><strong>${esc(p.ProductName || 'Product')}</strong><div class="muted">${esc(p.ProductID || '')}</div></div></div></td>
        <td><strong>${esc(p.SKU || 'Auto')}</strong><div class="muted">${esc(p.Category || 'General')}</div></td>
        <td><strong>${available}</strong><div class="muted">कुल ${stock}</div></td>
        <td>${reserved}</td><td>${sold}</td>
        <td><span class="status ${health[1]}">${health[0]}</span></td>
        <td><button class="btn btn-light inventory-stock-btn" onclick="SellerPanel.quickStock('${esc(p.ProductID || '')}')"><i class="fa-solid fa-boxes-stacked"></i> स्टॉक बदलें</button></td>
      </tr>`;
    }).join('') : '<tr><td colspan="7" class="empty-panel">कोई सामान नहीं मिला।</td></tr>';
  }

  // seller.js is loaded immediately before this file. Wrap its render before DOMContentLoaded executes.
  if (window.SellerPanel) {
    const originalRender = SellerPanel.render.bind(SellerPanel);
    SellerPanel.render = function () {
      originalRender();
      renderInventoryTable();
    };
  }

  document.addEventListener('DOMContentLoaded', () => {
    setNavigation();
    setPageContent();
  });
})();
