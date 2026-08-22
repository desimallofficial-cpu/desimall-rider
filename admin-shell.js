(() => {
  const page = location.pathname.split('/').pop() || 'index.html';

  const groups = [
    ['Overview', [
      ['index.html','fa-chart-line','Dashboard'],
      ['orders.html','fa-box','Orders'],
      ['dispatch.html','fa-truck-fast','Dispatch'],
      ['returns.html','fa-rotate-left','Returns']
    ]],
    ['Catalog', [
      ['products.html','fa-box-open','Products'],
      ['inventory.html','fa-warehouse','Inventory']
    ]],
    ['Partners', [
      ['seller-management.html','fa-shop','Seller Management'],
      ['rider-management.html','fa-motorcycle','Rider Management']
    ]],
    ['Money', [
      ['finance.html','fa-indian-rupee-sign','Finance'],
      ['seller-payouts.html','fa-building-columns','Seller Payouts'],
      ['rider-payouts.html','fa-wallet','Rider Payouts'],
      ['cod.html','fa-money-bill-transfer','COD Reconciliation'],
      ['cod-review.html','fa-triangle-exclamation','COD Review']
    ]],
    ['Operations', [
      ['return-pickups.html','fa-boxes-packing','Return Pickups'],
      ['return-inspections.html','fa-clipboard-check','Return Inspection'],
      ['tez-management.html','fa-bolt','Tez Management'],
      ['marketplace-settings.html','fa-sliders','Marketplace Settings'],
      ['support.html','fa-headset','Support']
    ]]
  ];

  const buildNav = () => groups.map(([label,items]) => `
    <div class="admin-nav-group">${label}</div>
    ${items.map(([href,icon,text]) => `
      <a href="${href}" class="${page===href?'active':''}">
        <i class="fa-solid ${icon}"></i>
        <span>${text}</span>
      </a>
    `).join('')}
  `).join('');

  const fillSidebar = side => {
    side.innerHTML = `
      <a class="admin-brand" href="index.html">
        <i class="fa-solid fa-store"></i>
        <span>Desi<span style="color:#ff6b00">Mall</span></span>
      </a>
      <nav class="admin-nav">${buildNav()}</nav>
      <div class="admin-side-foot">
        DesiMall Admin Center<br>
        Founder &amp; Developed by Suraj Kumar
      </div>
    `;
  };

  document.body.dataset.adminUnified='1';

  let shell = document.querySelector('.admin-shell');
  let side = document.querySelector('.admin-side');
  let main = document.querySelector('.admin-main');

  if (!shell || !side || !main) {
    // Preserve every existing page element and wrap the legacy standalone page.
    const scriptNodes = Array.from(document.body.children).filter(
      el => el.tagName === 'SCRIPT'
    );
    const contentNodes = Array.from(document.body.children).filter(
      el => el.tagName !== 'SCRIPT'
    );

    shell = document.createElement('div');
    shell.className = 'admin-shell';

    side = document.createElement('aside');
    side.className = 'admin-side';

    main = document.createElement('main');
    main.className = 'admin-main';

    const content = document.createElement('div');
    content.className = 'admin-page-content';

    for (const node of contentNodes) {
      content.appendChild(node);
    }

    main.appendChild(content);
    shell.appendChild(side);
    shell.appendChild(main);

    if (scriptNodes.length) {
      document.body.insertBefore(shell, scriptNodes[0]);
    } else {
      document.body.appendChild(shell);
    }
  }

  fillSidebar(side);
})();