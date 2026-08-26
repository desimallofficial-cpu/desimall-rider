const RiderAccount={
key:'desimall_rider_session',
recentRows:[],orderCache:null,
session(){try{return JSON.parse(localStorage.getItem(this.key))||{}}catch(_){return{}}},
money(v){return `₹${Number(v||0).toLocaleString('en-IN',{maximumFractionDigits:2})}`},
date(v){if(!v)return '—';const d=new Date(v);return Number.isNaN(d.getTime())?String(v):d.toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'short'})},
methodLabel(v){const x=String(v||'').toLowerCase();if(x==='upi')return 'UPI';if(x==='bank_transfer')return 'Bank Transfer';if(x==='cash')return 'Cash';return v||'—'},
esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))},

async init(){
 const s=this.session();
 if(!s.token&&!s.refreshToken){location.replace('login.html');return}
 riderName.textContent=s.rider?.RiderName||'Rider';
 refreshBtn.onclick=()=>this.load();
 logoutBtn.onclick=()=>this.logout();
 closeDeliveryDetail.onclick=()=>this.closeDetail();
 deliveryDetailModal.onclick=e=>{if(e.target===deliveryDetailModal)this.closeDetail()};
 document.addEventListener('keydown',e=>{if(e.key==='Escape')this.closeDetail()});
 await this.load();
},

async load(){
 refreshBtn.disabled=true;
 refreshBtn.textContent='Loading...';

 try{
  const r=await DesiMallAPI.getRiderAccount(this.session().token||'');
  const x=r.summary||{};

  todayEarnings.textContent=this.money(x.TodayEarnings);
  codCash.textContent=this.money(x.CODCashWithYou);
  codDeposit.textContent=this.money(x.CODToDeposit);
  pendingPayout.textContent=this.money(x.PendingPayout);

  const rows=r.recent||[];
  this.recentRows=rows;
  recentList.innerHTML=rows.length?rows.map(row=>{
   const workId=String(row.WorkID||row.OrderID||row.ReturnID||'Work');
   const canOpen=Boolean(row.OrderID||(/^DM-/i.test(workId)&&String(row.WorkType||'Delivery').toLowerCase().includes('delivery')));
   const completedAt=row.DeliveredAt||row.CompletedAt||row.WorkCompletedAt||row.UpdatedAt||row.CreatedAt||'';
   return `
   <div class="account-row">
    <div>${canOpen?`<button class="order-detail-link" type="button" onclick="RiderAccount.openDeliveryDetail('${this.esc(workId)}')">${this.esc(workId)}</button>`:`<b>${this.esc(workId)}</b>`}<small>${this.esc(row.WorkType||'Delivery')} · ${this.esc(row.OrderStatus||'Completed')}${completedAt?` · <span class="delivery-date">${this.esc(this.date(completedAt))}</span>`:''}</small></div>
    <div><span>${this.esc(row.WorkType||'Delivery')} Earning</span><small class="good-money">+${this.money(row.DeliveryEarning)}</small></div>
    <div><span>COD Collected</span><small class="cod-money">${this.money(row.CODCollected)}</small></div>
    <div><span>Payout</span><small>${this.esc(row.EarningStatus||'pending')}</small></div>
   </div>`}).join(''):'<div class="r-empty">No rider earnings yet.</div>';

  const payouts=r.payoutHistory||[];
  payoutList.innerHTML=payouts.length?payouts.map(row=>`
   <div class="account-row">
    <div><b>${this.esc(this.date(row.PaidAt))}</b><small>${this.esc(row.Status||'paid')}</small></div>
    <div><span>Amount Paid</span><small class="good-money">${this.money(row.Amount)}</small></div>
    <div><span>Payment Method</span><small>${this.esc(this.methodLabel(row.PaymentMethod))}</small></div>
    <div><span>Reference</span><small>${this.esc(row.ReferenceNo||'—')}</small></div>
   </div>`).join(''):'<div class="r-empty">No payout history yet.</div>';

 }catch(error){
  const m=this.esc(error?.message||'Could not load rider account.');
  recentList.innerHTML=`<div class="r-empty">${m}</div>`;
  payoutList.innerHTML=`<div class="r-empty">${m}</div>`;
 }finally{
  refreshBtn.disabled=false;
  refreshBtn.textContent='Refresh';
 }
},


async getOrders(){
 if(this.orderCache)return this.orderCache;
 try{
  const r=await DesiMallAPI.getRiderOrders(this.session().token||'');
  this.orderCache=Array.isArray(r?.orders)?r.orders:Array.isArray(r)?r:[];
 }catch(_){this.orderCache=[]}
 return this.orderCache;
},

detailValue(...values){
 for(const value of values){
  if(value!==undefined&&value!==null&&String(value).trim()!=='')return value;
 }
 return '';
},

async openDeliveryDetail(id){
 const fallback=this.recentRows.find(x=>String(x.OrderID||x.WorkID||'')===String(id))||{};
 deliveryDetailContent.innerHTML='<div class="r-detail-loading">Loading delivery details...</div>';
 deliveryDetailModal.classList.add('show');
 deliveryDetailModal.setAttribute('aria-hidden','false');

 const orders=await this.getOrders();
 const order=orders.find(x=>String(x.OrderID||x.order_id||'')===String(id))||{};
 const amount=this.detailValue(order.TotalAmount,order.Amount,fallback.OrderAmount,fallback.TotalAmount,fallback.Amount);
 const payment=this.detailValue(order.PaymentMode,order.PaymentMethod,fallback.PaymentMode,fallback.PaymentMethod,'—');
 const status=this.detailValue(order.RiderStatus,order.Status,fallback.OrderStatus,'Delivered');
 const customer=this.detailValue(order.CustomerName,fallback.CustomerName,'—');
 const mobile=this.detailValue(order.CustomerMobile,fallback.CustomerMobile,'—');
 const address=this.detailValue(order.DeliveryAddress,fallback.DeliveryAddress,'—');
 const deliveredAt=this.detailValue(
   order.DeliveredAt,order.DeliveryCompletedAt,order.CompletedAt,order.UpdatedAt,
   fallback.DeliveredAt,fallback.CompletedAt,fallback.WorkCompletedAt,fallback.UpdatedAt,fallback.CreatedAt
 );
 const createdAt=this.detailValue(order.CreatedAt,order.OrderedAt,order.OrderDate,fallback.OrderCreatedAt);
 const cod=this.detailValue(fallback.CODCollected,order.CODCollected);
 const earning=this.detailValue(fallback.DeliveryEarning,order.DeliveryEarning);
 const items=Array.isArray(order.Items)&&order.Items.length
   ? order.Items.map(i=>`${this.esc(i.ProductName||i.Name||'Item')} × ${Number(i.Qty||i.Quantity||0)}`).join('<br>')
   : this.esc(this.detailValue(fallback.Items,fallback.ItemSummary,'—'));

 deliveryDetailContent.innerHTML=`
  <div class="r-detail-head">
   <div><span class="r-detail-eyebrow">DELIVERY DETAILS</span><h2>${this.esc(id)}</h2></div>
   <span class="r-status">${this.esc(status)}</span>
  </div>
  <div class="r-detail-grid">
   <div class="r-detail-box"><small>Delivered Amount</small><strong>${amount!==''?this.money(amount):'—'}</strong></div>
   <div class="r-detail-box"><small>Payment</small><strong>${this.esc(payment)}</strong></div>
   <div class="r-detail-box"><small>Delivery Earning</small><strong class="good-money">${earning!==''?'+'+this.money(earning):'—'}</strong></div>
   <div class="r-detail-box"><small>COD Collected</small><strong class="cod-money">${cod!==''?this.money(cod):'—'}</strong></div>
  </div>
  <div class="r-detail-section">
   <h3>Delivery timeline</h3>
   <div class="r-detail-line"><span>Order created</span><b>${createdAt?this.esc(this.date(createdAt)):'—'}</b></div>
   <div class="r-detail-line"><span>Delivered / completed</span><b>${deliveredAt?this.esc(this.date(deliveredAt)):'—'}</b></div>
  </div>
  <div class="r-detail-section">
   <h3>Customer & order</h3>
   <div class="r-detail-line"><span>Customer</span><b>${this.esc(customer)}</b></div>
   <div class="r-detail-line"><span>Mobile</span><b>${this.esc(mobile)}</b></div>
   <div class="r-detail-line"><span>Items</span><b>${items}</b></div>
   <div class="r-detail-line"><span>Address</span><b>${this.esc(address)}</b></div>
  </div>`;
},

closeDetail(){
 deliveryDetailModal.classList.remove('show');
 deliveryDetailModal.setAttribute('aria-hidden','true');
},

async logout(){
 try{await DesiMallAPI.riderLogout(this.session().token||'')}catch(_){}
 localStorage.removeItem(this.key);
 location.replace('login.html');
}
};

document.addEventListener('DOMContentLoaded',()=>RiderAccount.init());
