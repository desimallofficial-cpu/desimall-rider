document.addEventListener('DOMContentLoaded', () => SellerOrders.init());

const SellerOrders = {
  version: '0.7.7',
  sessionKey:'desimall_seller_session',
  session:null,
  orders:[],
  activeStatus:'',
  selectedOrderId:'',
  money:n=>`₹${Number(n||0).toLocaleString('en-IN')}`,
  itemRate(i){
    const value=i?.UnitPrice??i?.Rate??i?.unit_price??i?.Price??i?.price??0;
    const n=Number(value);
    return Number.isFinite(n)?n:0;
  },
  itemAmount(i){
    const direct=i?.LineTotal??i?.Amount??i?.line_total??i?.Total??i?.total;
    if(direct!==undefined&&direct!==null&&direct!==''){
      const n=Number(direct);
      if(Number.isFinite(n))return n;
    }
    return this.itemRate(i)*(Number(i?.Qty??i?.qty??0)||0);
  },
  itemMrp(i){
    const value=i?.MRP??i?.Mrp??i?.mrp??i?.UnitPrice??i?.Rate??i?.unit_price??i?.Price??0;
    const n=Number(value);
    return Number.isFinite(n)?n:0;
  },
  esc:s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),
  date:v=>{if(!v)return '—';const d=new Date(v);return Number.isNaN(d.getTime())?String(v):d.toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'short'});},

  async init(){
    if(!this.requireLocalSession()) return;
    document.getElementById('sellerLogout').onclick=()=>this.logout();
    document.getElementById('refreshOrders').onclick=()=>this.load();
    document.getElementById('orderSearch').oninput=()=>this.render();
    document.getElementById('orderStatusFilter').onchange=e=>{this.activeStatus=e.target.value;this.syncChips();this.render();};
    document.getElementById('closeReasonModal').onclick=()=>this.closeModal('reasonModal');
    document.getElementById('reasonForm').onsubmit=e=>{e.preventDefault();this.submitReason();};
    document.getElementById('closeDetailsModal').onclick=()=>this.closeModal('detailsModal');
    document.getElementById('printInvoiceBtn').onclick=()=>this.printDocument('invoice');
    document.getElementById('printPackingBtn').onclick=()=>this.printDocument('packing');
    document.getElementById('printLabelBtn').onclick=()=>this.printDocument('label');
    document.getElementById('printAllBtn').onclick=()=>this.printDocument('all');
    document.getElementById('orderFilterChips').onclick=e=>{
      const b=e.target.closest('button[data-status]');if(!b)return;
      this.activeStatus=b.dataset.status||'';document.getElementById('orderStatusFilter').value=this.activeStatus;this.syncChips();this.render();
    };
    document.querySelectorAll('.modal').forEach(m=>m.addEventListener('click',e=>{if(e.target===m)this.closeModal(m.id);}));
    document.querySelectorAll('.coming-soon').forEach(a=>a.onclick=e=>{e.preventDefault();this.toast('Ye module agle phase me live hoga.');});
    try{
      const cacheKey=`desimall_seller_orders_${this.session?.seller?.SellerID||'current'}`;
      const cached=JSON.parse(localStorage.getItem(cacheKey)||'[]');
      if(Array.isArray(cached)&&cached.length){this.orders=cached;this.render();}
    }catch(_){}
    await this.load();
  },

  readSession(){try{return JSON.parse(localStorage.getItem(this.sessionKey))||{};}catch(_){return{};}},
  requireLocalSession(){
    this.session=this.readSession();
    if(!this.session.token){location.replace('login.html');return false;}
    const seller=this.session.seller||{};
    document.getElementById('sellerWelcome').textContent=`${seller.ShopName||seller.SellerName||'Seller'} • Accept, prepare and hand orders to the assigned rider.`;
    return true;
  },
  async logout(){const token=this.session?.token||'';localStorage.removeItem(this.sessionKey);if(token)await DesiMallAPI.sellerLogout(token);location.replace('login.html');},

  async load(){
    this.session=this.readSession();
    const btn=document.getElementById('refreshOrders');
    const cacheKey=`desimall_seller_orders_${this.session?.seller?.SellerID||'current'}`;
    btn.disabled=true;
    btn.innerHTML='<i class="fa-solid fa-spinner fa-spin"></i> लोड हो रहा';
    let r;
    try{
      r=await DesiMallAPI.getSellerOrders(this.session.token);
      this.session=this.readSession();
    }catch(error){
      if(error?.status===401||error?.code==='SELLER_SESSION_ENDED'){
        localStorage.removeItem(this.sessionKey);
        location.replace('login.html?reason=session');
        return;
      }
      r={success:false,message:error?.message||'Network unavailable',offline:true};
    }finally{
      btn.disabled=false;
      btn.innerHTML='<i class="fa-solid fa-rotate"></i> ताज़ा करें';
    }

    if(!r.success){
      const m=String(r.message||r.error||'').toLowerCase();
      if(/invalid seller session|session expired|seller login required|account is not active|invalid or expired supabase session|seller account is required|seller account is not active/.test(m)){
        localStorage.removeItem(this.sessionKey);
        location.replace('login.html?reason=session');
        return;
      }
      try{
        const cached=JSON.parse(localStorage.getItem(cacheKey)||'[]');
        if(Array.isArray(cached)&&cached.length){
          this.orders=cached;
          this.render();
          this.toast('Live backend slow hai. Last saved orders dikh rahe hain.');
          return;
        }
      }catch(_){}
      this.orders=[];
      this.render();
      this.toast(r.message||'Backend temporarily unavailable. Refresh karke dobara try karein.');
      return;
    }

    if(r.seller){
      this.session.seller=r.seller;
      localStorage.setItem(this.sessionKey,JSON.stringify(this.session));
      document.getElementById('sellerWelcome').textContent=`${r.seller.ShopName||r.seller.SellerName||'Seller'} • Accept, prepare and hand orders to the assigned rider.`;
    }
    this.orders=Array.isArray(r.orders)?r.orders:[];
    try{localStorage.setItem(cacheKey,JSON.stringify(this.orders));}catch(_){}
    this.render();
  },
  filtered(){
    const q=document.getElementById('orderSearch').value.toLowerCase().trim();
    const status=(this.activeStatus||document.getElementById('orderStatusFilter').value).toLowerCase();
    return this.orders.filter(o=>{
      const text=[o.OrderID,o.CustomerName,o.CustomerMobile,o.PaymentMode,o.TrackingID,o.CourierName,...(o.Items||[]).map(i=>`${i.ProductName} ${i.ProductID}`)].join(' ').toLowerCase();
      return (!q||text.includes(q))&&(!status||String(o.SellerStatus||'Pending').toLowerCase()===status);
    });
  },
  syncChips(){document.querySelectorAll('#orderFilterChips button').forEach(b=>b.classList.toggle('active',(b.dataset.status||'')===this.activeStatus));},
  count(status){return this.orders.filter(o=>String(o.SellerStatus||'Pending').toLowerCase()===status.toLowerCase()).length;},
  render(){
    const list=this.filtered();
    document.getElementById('statTotal').textContent=this.orders.length;
    document.getElementById('statPending').textContent=this.count('Pending');
    document.getElementById('statReady').textContent=this.count('Ready for Pickup');
    document.getElementById('statPreparing').textContent=this.count('Preparing');
    document.getElementById('statAccepted').textContent=this.count('Accepted');
    document.getElementById('statValue').textContent=this.money(this.orders.reduce((s,o)=>s+Number(o.SellerAmount||0),0));
    const box=document.getElementById('sellerOrdersList'),empty=document.getElementById('sellerOrdersEmpty');
    empty.hidden=!!list.length;box.innerHTML=list.map(o=>this.card(o)).join('');
  },
  initials(name){return String(name||'C').trim().split(/\s+/).slice(0,2).map(x=>x[0]||'').join('').toUpperCase()||'C';},
  avatar(o){return o.CustomerAvatar?`<img src="${this.esc(o.CustomerAvatar)}" alt="" onerror="this.replaceWith(Object.assign(document.createElement('span'),{textContent:'${this.esc(this.initials(o.CustomerName))}'}))">`:`<span>${this.esc(this.initials(o.CustomerName))}</span>`;},
  card(o){
    const status=o.SellerStatus||'Pending';
    const items=(o.Items||[]).map(i=>`<div class="seller-order-item"><img src="${this.esc(i.ImageURL||'../assets/products/noimage.jpg')}" onerror="this.src='../assets/products/noimage.jpg'"><div><strong>${this.esc(i.ProductName)}</strong><span>${this.esc(i.ProductID||'')} · Qty ${i.Qty} · ${this.esc(i.UnitValue||1)} ${this.esc(i.Unit||'Piece')}</span></div><b>${this.money(this.itemAmount(i))}</b></div>`).join('');
    const buttons=this.statusButtons(o.OrderID,status);
    const reason=o.RejectedReason||o.CancelReason||o.DeliveryFailedReason||'';
    return `<article class="seller-order-card">
      <div class="seller-order-head"><div><strong>${this.esc(o.OrderID)}</strong><span>${this.esc(o.OrderDate||'')} · ${this.esc(o.PaymentMode||'COD')}</span></div><span class="status ${this.statusClass(status)}">${this.esc(status)}</span></div>
      <div class="seller-order-customer"><div class="customer-identity"><div class="customer-avatar">${this.avatar(o)}</div><div><b>${this.esc(o.CustomerName||'Customer')}</b><span>${this.esc(o.CustomerMobile||'')}</span></div></div><div><span>${this.esc(o.DeliveryAddress||'')}</span><span>${this.esc([o.City,o.State,o.Pincode].filter(Boolean).join(', '))}</span></div></div>
      <div class="seller-order-items">${items}</div>
      ${(o.CourierName||o.TrackingID)?`<div class="shipping-info"><span><i class="fa-solid fa-truck"></i> ${this.esc(o.CourierName||'Courier')}</span><strong>${this.esc(o.TrackingID||'')}</strong></div>`:''}
      ${reason?`<div class="order-reason"><i class="fa-solid fa-circle-info"></i> ${this.esc(reason)}</div>`:''}
      <div class="seller-order-footer"><div><span>Seller amount</span><strong>${this.money(o.SellerAmount)}</strong></div><div class="order-status-actions"><button class="btn btn-light" onclick="SellerOrders.showDetails('${this.esc(o.OrderID)}')"><i class="fa-solid fa-eye"></i> Details</button>${buttons}</div></div>
    </article>`;
  },
  statusClass(s){s=String(s).toLowerCase();if(['cancelled','returned'].includes(s))return'bad';if(['delivered'].includes(s))return'good';if(['ready for pickup','pickup assigned','pickup accepted','picked up','on the way','reached customer'].includes(s))return'info';return'warn';},
  statusButtons(id,status){
    const s=String(status).toLowerCase();
    if(s==='pending')return `<button class="btn btn-primary" onclick="SellerOrders.update('${this.esc(id)}','Accepted')">Accept</button><button class="btn btn-danger" onclick="SellerOrders.openReason('${this.esc(id)}','Cancelled')">Cancel</button>`;
    if(s==='accepted')return `<button class="btn btn-primary" onclick="SellerOrders.update('${this.esc(id)}','Preparing')">Start preparing</button><button class="btn btn-danger" onclick="SellerOrders.openReason('${this.esc(id)}','Cancelled')">Cancel</button>`;
    if(s==='preparing')return `<button class="btn btn-primary" onclick="SellerOrders.update('${this.esc(id)}','Ready for Pickup')">Ready for pickup</button><button class="btn btn-danger" onclick="SellerOrders.openReason('${this.esc(id)}','Cancelled')">Cancel</button>`;
    if(s==='ready for pickup')return `<span class="waiting-rider"><i class="fa-solid fa-person-biking"></i> Waiting for rider assignment</span>`;
    if(s==='shipped')return `<button class="btn btn-primary" onclick="SellerOrders.update('${this.esc(id)}','Out for Delivery')">Out for delivery</button><button class="btn btn-danger" onclick="SellerOrders.openReason('${this.esc(id)}','Returned')">Return</button>`;
    if(s==='out for delivery')return `<button class="btn btn-primary" onclick="SellerOrders.update('${this.esc(id)}','Delivered')">Mark delivered</button><button class="btn btn-danger" onclick="SellerOrders.openReason('${this.esc(id)}','Returned')">Return</button>`;
    if (s === 'delivered') return '';
    return '';
  },
  findOrder(id){return this.orders.find(o=>String(o.OrderID)===String(id));},
  showDetails(id){
    const o=this.findOrder(id);if(!o)return;
    this.selectedOrderId=String(id);
    const status=o.SellerStatus||o.Status||'Pending';
    const timeline=[
      ['Placed',o.CreatedAt||o.OrderDate],
      ['Accepted',o.AcceptedDate],
      ['Preparing',o.PreparingDate],
      ['Ready for Pickup',o.ReadyForPickupDate],
      ['Pickup Accepted',o.PickupAcceptedDate],
      ['Picked Up',o.PickedUpDate],
      ['On the Way',o.OnTheWayDate],
      ['Reached Customer',o.ReachedCustomerDate],
      ['Delivered',o.DeliveredDate]
    ].map(([n,d])=>`<li class="${d?'done':''}"><span></span><div><strong>${n}</strong><small>${this.date(d)}</small></div></li>`).join('');
    const itemRows=(o.Items||[]).map(i=>{
      const mrp=this.itemMrp(i);
      const sale=this.itemRate(i);
      const discount=Number(i.DiscountPercent||0);
      return `<tr>
        <td><div class="detail-product"><img src="${this.esc(i.ImageURL||'../assets/products/placeholder.png')}" onerror="this.style.display='none'"><div><strong>${this.esc(i.ProductName||'Product')}</strong><small>${this.esc(i.ProductID||'')} · ${this.esc(i.Size||'Free Size')}</small></div></div></td>
        <td>${Number(i.Qty||0)}</td>
        <td>${this.esc(`${i.UnitValue||1} ${i.Unit||'Piece'}`)}</td>
        <td>${this.money(mrp)}</td>
        <td>${discount?`${discount}%`:'—'}</td>
        <td>${this.money(sale)}</td>
        <td>${this.money(this.itemAmount(i))}</td>
      </tr>`;
    }).join('');
    const address=[o.DeliveryAddress,o.Landmark,o.City,o.State,o.Pincode].filter(Boolean).join(', ');
    const courier=o.CourierName||'Not assigned';
    const tracking=o.TrackingID||'Not generated';
    const invoice=o.InvoiceNumber||`INV-${String(o.OrderID||'').replace(/^DM-/,'')}`;
    document.getElementById('orderDetailsBody').innerHTML=`
      <div class="order-detail-summary">
        <div><span>Order ID</span><strong>${this.esc(o.OrderID)}</strong></div>
        <div><span>Invoice</span><strong>${this.esc(invoice)}</strong></div>
        <div><span>Status</span><strong class="status ${this.statusClass(status)}">${this.esc(status)}</strong></div>
        <div><span>Order date</span><strong>${this.date(o.CreatedAt||o.OrderDate)}</strong></div>
      </div>
      <div class="order-detail-grid">
        <section class="detail-section">
          <h3><i class="fa-solid fa-user"></i> Customer & delivery</h3>
          <p><b>Name:</b> ${this.esc(o.CustomerName||'Customer')}</p>
          <p><b>Mobile:</b> ${this.esc(o.CustomerMobile||'—')}</p>
          <p><b>Address:</b> ${this.esc(address||'—')}</p>
        </section>
        <section class="detail-section">
          <h3><i class="fa-solid fa-credit-card"></i> Payment & shipment</h3>
          <p><b>Payment:</b> ${this.esc(o.PaymentMode||'COD')} · ${this.esc(o.PaymentStatus||'Pending')}</p>
          <p><b>Courier:</b> ${this.esc(courier)}</p>
          <p><b>Tracking ID:</b> ${this.esc(tracking)}</p>
          <p><b>Seller amount:</b> ${this.money(o.SellerAmount)}</p>
        </section>
      </div>
      <div class="detail-table-wrap"><table class="detail-table"><thead><tr><th>Product</th><th>Qty</th><th>Unit</th><th>MRP</th><th>Discount</th><th>Sale</th><th>Total</th></tr></thead><tbody>${itemRows}</tbody></table></div>
      <div class="order-detail-bottom">
        <section><h3>Order timeline</h3><ul class="seller-order-timeline">${timeline}</ul></section>
        <section class="amount-breakdown">
          <h3>Amount summary</h3>
          <div><span>Subtotal</span><strong>${this.money(o.Subtotal||o.SellerAmount)}</strong></div>
          <div><span>Coupon discount</span><strong>-${this.money(o.CouponDiscount||0)}</strong></div>
          <div><span>Delivery charge</span><strong>${Number(o.DeliveryCharge||0)?this.money(o.DeliveryCharge):'FREE'}</strong></div>
          <div class="amount-total"><span>Order total</span><strong>${this.money(o.TotalAmount||o.SellerAmount)}</strong></div>
        </section>
      </div>`;
    document.getElementById('documentActionBar').hidden=false;
    this.openModal('detailsModal');
  },

  getSelectedOrder(){return this.findOrder(this.selectedOrderId);},

  documentHtml(type,o){
    const seller=this.session?.seller||{};
    const invoice=o.InvoiceNumber||`INV-${String(o.OrderID||'').replace(/^DM-/,'')}`;
    const fullAddress=[o.DeliveryAddress,o.Landmark,o.City,o.State,o.Pincode].filter(Boolean).join(', ');
    const rows=(o.Items||[]).map((i,idx)=>`<tr><td>${idx+1}</td><td><b>${this.esc(i.ProductName||'Product')}</b><br><small>${this.esc(i.ProductID||'')}</small></td><td>${Number(i.Qty||0)}</td><td>${this.esc(`${i.UnitValue||1} ${i.Unit||'Piece'}`)}</td><td>${this.money(this.itemRate(i))}</td><td>${this.money(this.itemAmount(i))}</td></tr>`).join('');
    const commonStyle=`<style>
      *{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#111;margin:0;padding:24px;background:#fff}.doc{max-width:800px;margin:auto}.head{display:flex;justify-content:space-between;gap:20px;border-bottom:3px solid #ff6b00;padding-bottom:14px}.brand{font-size:26px;font-weight:900;color:#ff6b00}.muted{color:#666;font-size:12px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin:18px 0}.box{border:1px solid #ddd;border-radius:8px;padding:13px}.box h3{margin:0 0 8px;font-size:14px;color:#ff6b00}.box p{margin:4px 0;font-size:12px;line-height:1.45}table{width:100%;border-collapse:collapse;margin-top:15px}th,td{border:1px solid #ddd;padding:9px;text-align:left;font-size:12px}th{background:#f3f4f6}.totals{margin-left:auto;width:310px;margin-top:16px}.totals div{display:flex;justify-content:space-between;padding:7px;border-bottom:1px solid #eee}.total{font-size:16px;font-weight:bold;background:#fff3eb}.actions{display:none}.label{border:2px solid #111;padding:18px;max-width:620px;margin:auto}.label-grid{display:grid;grid-template-columns:1.5fr 1fr;gap:18px}.barcode{height:55px;background:repeating-linear-gradient(90deg,#111 0,#111 2px,#fff 2px,#fff 5px);margin:12px 0}.big{font-size:22px;font-weight:900}.packing-check{width:18px;height:18px;border:1px solid #111;display:inline-block;vertical-align:middle;margin-right:7px}@media print{body{padding:0}.doc{max-width:none}.page-break{page-break-before:always}}</style>`;
    const header=`<div class="head"><div><div class="brand">DesiMall</div><div class="muted">${this.esc(seller.ShopName||seller.SellerName||'Seller')}</div></div><div style="text-align:right"><b>${this.esc(invoice)}</b><div class="muted">Order: ${this.esc(o.OrderID)}</div><div class="muted">${this.date(o.CreatedAt||o.OrderDate)}</div></div></div>`;
    const invoiceBody=`<div class="doc">${header}<div class="grid"><div class="box"><h3>Sold by</h3><p><b>${this.esc(seller.ShopName||'DesiMall Seller')}</b></p><p>${this.esc(seller.Address||seller.BusinessAddress||'')}</p><p>${this.esc(seller.Email||'')}</p></div><div class="box"><h3>Ship to</h3><p><b>${this.esc(o.CustomerName||'Customer')}</b></p><p>${this.esc(fullAddress)}</p><p>${this.esc(o.CustomerMobile||'')}</p></div></div><table><thead><tr><th>#</th><th>Item</th><th>Qty</th><th>Unit</th><th>Rate</th><th>Amount</th></tr></thead><tbody>${rows}</tbody></table><div class="totals"><div><span>Subtotal</span><b>${this.money(o.Subtotal||o.SellerAmount)}</b></div><div><span>Coupon</span><b>-${this.money(o.CouponDiscount||0)}</b></div><div><span>Delivery</span><b>${Number(o.DeliveryCharge||0)?this.money(o.DeliveryCharge):'FREE'}</b></div><div class="total"><span>Total</span><b>${this.money(o.TotalAmount||o.SellerAmount)}</b></div></div><p class="muted">Payment: ${this.esc(o.PaymentMode||'COD')} · ${this.esc(o.PaymentStatus||'Pending')}</p></div>`;
    const packingBody=`<div class="doc">${header}<h2>Packing Slip</h2><div class="grid"><div class="box"><h3>Customer</h3><p><b>${this.esc(o.CustomerName||'')}</b></p><p>${this.esc(fullAddress)}</p><p>${this.esc(o.CustomerMobile||'')}</p></div><div class="box"><h3>Shipment</h3><p>Courier: ${this.esc(o.CourierName||'Not assigned')}</p><p>Tracking: ${this.esc(o.TrackingID||'Not assigned')}</p><p>Payment: ${this.esc(o.PaymentMode||'COD')}</p></div></div><table><thead><tr><th>Check</th><th>Product</th><th>Qty</th><th>Unit</th></tr></thead><tbody>${(o.Items||[]).map(i=>`<tr><td><span class="packing-check"></span></td><td>${this.esc(i.ProductName||'')}<br><small>${this.esc(i.ProductID||'')}</small></td><td>${Number(i.Qty||0)}</td><td>${this.esc(`${i.UnitValue||1} ${i.Unit||'Piece'}`)}</td></tr>`).join('')}</tbody></table><div class="box" style="margin-top:18px"><h3>Seller checklist</h3><p>☐ Product verified &nbsp; ☐ Quantity verified &nbsp; ☐ Invoice enclosed &nbsp; ☐ Package sealed</p></div></div>`;
    const labelBody=`<div class="label"><div class="label-grid"><div><div class="big">SHIP TO</div><p><b>${this.esc(o.CustomerName||'Customer')}</b></p><p>${this.esc(fullAddress)}</p><p>Mobile: ${this.esc(o.CustomerMobile||'')}</p></div><div><div class="brand">DesiMall</div><p><b>${this.esc(o.PaymentMode||'COD')}</b></p><p>${this.money(o.TotalAmount||o.SellerAmount)}</p></div></div><hr><p><b>Order:</b> ${this.esc(o.OrderID)}</p><p><b>Courier:</b> ${this.esc(o.CourierName||'Not assigned')}</p><p><b>Tracking:</b> ${this.esc(o.TrackingID||'Not assigned')}</p><div class="barcode"></div><div class="big" style="text-align:center">${this.esc(o.TrackingID||o.OrderID)}</div><p class="muted" style="text-align:center">Handle with care · Seller: ${this.esc(seller.ShopName||seller.SellerName||'DesiMall Seller')}</p></div>`;
    const body=type==='invoice'?invoiceBody:type==='packing'?packingBody:type==='label'?labelBody:`${invoiceBody}<div class="page-break"></div>${packingBody}<div class="page-break"></div>${labelBody}`;
    return `<!doctype html><html><head><meta charset="utf-8"><title>${this.esc(type)} - ${this.esc(o.OrderID)}</title>${commonStyle}</head><body>${body}<script>window.onload=()=>setTimeout(()=>window.print(),250);<\/script></body></html>`;
  },

  printDocument(type){
    const o=this.getSelectedOrder();if(!o){this.toast('Pehle order details kholen.');return;}
    const w=window.open('','_blank','width=980,height=760');
    if(!w){this.toast('Popup blocked. Browser me popups allow karein.');return;}
    w.document.open();w.document.write(this.documentHtml(type,o));w.document.close();
  },

  openShipping(orderId){document.getElementById('shippingOrderId').value=orderId;document.getElementById('shippingCourier').value='';document.getElementById('shippingTracking').value='';this.openModal('shippingModal');},
  openReason(orderId,status){document.getElementById('reasonOrderId').value=orderId;document.getElementById('reasonStatus').value=status;document.getElementById('reasonText').value='';document.getElementById('reasonModalTitle').textContent=status==='Cancelled'?'Cancel order':'Mark order returned';document.getElementById('reasonLabel').textContent=status==='Cancelled'?'Cancellation reason':'Return reason';document.getElementById('reasonSubmitBtn').textContent=status==='Cancelled'?'Confirm cancellation':'Confirm return';this.openModal('reasonModal');},
  openModal(id){document.getElementById(id).classList.add('show');},
  closeModal(id){document.getElementById(id).classList.remove('show');},
  async submitShipping(){
    const id=document.getElementById('shippingOrderId').value,courier=document.getElementById('shippingCourier').value.trim(),tracking=document.getElementById('shippingTracking').value.trim();
    if(!courier||!tracking){this.toast('Courier and tracking ID are required.');return;}
    const r=await DesiMallAPI.updateSellerOrderStatus(id,'Shipped',this.session.token,{CourierName:courier,TrackingID:tracking});
    if(!r.success){this.toast(r.message||'Shipping update failed.');return;}this.closeModal('shippingModal');this.toast('Order marked shipped.');await this.load();
  },
  async submitReason(){
    const id=document.getElementById('reasonOrderId').value,status=document.getElementById('reasonStatus').value,reason=document.getElementById('reasonText').value.trim();
    if(!reason){this.toast('Reason is required.');return;}
    try{
      this.session=this.readSession();
      const r=await DesiMallAPI.updateSellerOrderStatus(id,status,this.session.token,{Reason:reason});
      this.session=this.readSession();
      if(!r.success){this.toast(r.message||'Status update failed.');return;}
      this.closeModal('reasonModal');
      this.toast(`Order ${status.toLowerCase()}.`);
      await this.load();
    }catch(error){
      if(error?.status===401||error?.code==='SELLER_SESSION_ENDED'){
        localStorage.removeItem(this.sessionKey);
        location.replace('login.html?reason=session');
        return;
      }
      this.toast(error?.message||'Status update failed.');
    }
  },
  async update(orderId,status){
    if(!confirm(`Change ${orderId} to ${status}?`))return;

    try{
      this.session=this.readSession();

      const r=await DesiMallAPI.updateSellerOrderStatus(
        orderId,
        status,
        this.session.token
      );

      this.session=this.readSession();

      if(!r?.success){
        this.toast(r?.message||'Status update failed.');
        return;
      }

      this.toast(
        status==='Ready for Pickup'
          ? 'Order rider ke liye ready ho gaya.'
          : 'Order status updated.'
      );

      await this.load();
    }catch(error){
      console.error('Seller order status update:',error);

      if(
        error?.status===401 ||
        error?.code==='SELLER_SESSION_ENDED'
      ){
        localStorage.removeItem(this.sessionKey);
        location.replace('login.html?reason=session');
        return;
      }

      this.toast(
        error?.message ||
        'Status update failed. Dobara try karein.'
      );
    }
  },
  toast(m){const e=document.getElementById('panelToast');e.textContent=m;e.classList.add('show');setTimeout(()=>e.classList.remove('show'),2600);}
};
