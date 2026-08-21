/* DesiMall Seller Center — professional shell enhancer */
(function(){
  const file=(location.pathname.split('/').pop()||'index.html').toLowerCase();
  const body=document.body;
  if(!body)return;

  const pageNames={
    'index.html':'Dashboard','products.html':'Products','inventory.html':'Inventory',
    'orders.html':'Orders','returns.html':'Returns','hisab.html':'Payouts & Account',
    'support.html':'Support','profile.html':'Store Profile'
  };

  body.classList.add('seller-pro-ui');

  const sidebar=document.querySelector('.panel-sidebar,.seller-sidebar');
  if(sidebar){
    const active=(href)=>file===href?'active':'';
    sidebar.innerHTML=`
      <a class="seller-pro-brand" href="index.html" aria-label="DesiMall Seller Dashboard">
        <span class="brand-mark"><i class="fa-solid fa-store"></i></span>
        <span>Desi<em>Mall</em></span>
      </a>
      <div class="seller-pro-workspace-label">Seller Center</div>
      <div class="seller-sidebar-profile">
        <div class="seller-avatar" data-seller-avatar><span>S</span></div>
        <div><strong data-seller-name>Seller</strong><small data-seller-shop>DesiMall Seller</small></div>
      </div>
      <nav class="panel-nav">
        <div class="seller-pro-nav-section">Workspace</div>
        <a class="${active('index.html')}" href="index.html"><i class="fa-solid fa-table-cells-large"></i><span>Dashboard</span></a>
        <a class="${active('orders.html')}" href="orders.html"><i class="fa-solid fa-bag-shopping"></i><span>Orders</span></a>
        <a class="${active('returns.html')}" href="returns.html"><i class="fa-solid fa-arrow-rotate-left"></i><span>Returns</span></a>
        <div class="seller-pro-nav-section">Catalog</div>
        <a class="${active('products.html')}" href="products.html"><i class="fa-solid fa-box"></i><span>Products</span></a>
        <a class="${active('inventory.html')}" href="inventory.html"><i class="fa-solid fa-warehouse"></i><span>Inventory</span></a>
        <div class="seller-pro-nav-section">Business</div>
        <a class="${active('hisab.html')}" href="hisab.html"><i class="fa-solid fa-wallet"></i><span>Payouts & Account</span></a>
        <a class="${active('support.html')}" href="support.html"><i class="fa-solid fa-headset"></i><span>Support</span></a>
        <a class="${active('profile.html')}" href="profile.html"><i class="fa-solid fa-store-gear"></i><span>Store Profile</span></a>
      </nav>
      <div class="seller-pro-sidebar-bottom">
        <a class="seller-pro-store-link" href="../index.html"><i class="fa-solid fa-arrow-up-right-from-square"></i> View customer store</a>
      </div>`;
  }

  const main=document.querySelector('.panel-main,.seller-main');
  if(main && !main.querySelector('.seller-pro-contextbar')){
    const bar=document.createElement('div');
    bar.className='seller-pro-contextbar';
    bar.innerHTML=`<div class="crumb"><span>Seller Center</span><i class="fa-solid fa-chevron-right"></i><b>${pageNames[file]||'Workspace'}</b></div><div class="status">Workspace active</div>`;
    main.prepend(bar);
  }

  const overlay=document.createElement('div');
  overlay.className='seller-pro-overlay';
  overlay.onclick=()=>body.classList.remove('seller-menu-open');
  body.appendChild(overlay);

  if(sidebar){
    const toggle=document.createElement('button');
    toggle.className='seller-pro-mobile-toggle';
    toggle.type='button';toggle.title='Open seller menu';
    toggle.innerHTML='<i class="fa-solid fa-bars"></i>';
    toggle.onclick=()=>body.classList.toggle('seller-menu-open');
    body.appendChild(toggle);
    sidebar.addEventListener('click',e=>{if(e.target.closest('a')&&innerWidth<=780)body.classList.remove('seller-menu-open')});
  }

  // Existing shell repopulates seller identity after this structural replacement.
  try{
    const session=JSON.parse(localStorage.getItem('desimall_seller_session')||'{}');
    if(window.SellerShell && session.seller) SellerShell.apply(session.seller);
  }catch(_){ }
})();
