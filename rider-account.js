const RiderAccount={
key:'desimall_rider_session',
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
  recentList.innerHTML=rows.length?rows.map(row=>`
   <div class="account-row">
    <div><b>${this.esc(row.WorkID||row.OrderID||row.ReturnID||'Work')}</b><small>${this.esc(row.WorkType||'Delivery')} · ${this.esc(row.OrderStatus||'Completed')}</small></div>
    <div><span>${this.esc(row.WorkType||'Delivery')} Earning</span><small class="good-money">+${this.money(row.DeliveryEarning)}</small></div>
    <div><span>COD Collected</span><small class="cod-money">${this.money(row.CODCollected)}</small></div>
    <div><span>Payout</span><small>${this.esc(row.EarningStatus||'pending')}</small></div>
   </div>`).join(''):'<div class="r-empty">No rider earnings yet.</div>';

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

async logout(){
 try{await DesiMallAPI.riderLogout(this.session().token||'')}catch(_){}
 localStorage.removeItem(this.key);
 location.replace('login.html');
}
};

document.addEventListener('DOMContentLoaded',()=>RiderAccount.init());
