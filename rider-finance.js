const RiderFinance={
  key:'desimall_rider_session',session:{},data:null,
  money(v){return `₹${Number(v||0).toLocaleString('en-IN',{maximumFractionDigits:2})}`;},
  esc(v){return String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));},
  date(v){if(!v)return '—';const d=new Date(v);return isNaN(d)?String(v):d.toLocaleString('hi-IN',{dateStyle:'medium',timeStyle:'short'});},
  toast(m){riderToast.textContent=m;riderToast.classList.add('show');setTimeout(()=>riderToast.classList.remove('show'),2400);},
  init(){
    try{this.session=JSON.parse(localStorage.getItem(this.key)||'null')||{}}catch{}
    if(!this.session.token)return location.replace('login.html');
    riderName.textContent=this.session.rider?.RiderName||'Rider';
    riderMeta.textContent=[this.session.rider?.VehicleType,this.session.rider?.VehicleNumber].filter(Boolean).join(' · ');
    refreshBtn.onclick=()=>this.load(false);
    logoutBtn.onclick=()=>this.logout();
    this.restore();
    this.load(true);
  },
  restore(){
    try{
      const c=JSON.parse(localStorage.getItem('dm_rider_finance_fast')||'null');
      if(c?.data){this.data=c.data;this.render();}
    }catch{}
  },
  async load(silent){
    const r=await DesiMallAPI.getRiderFinance(this.session.token);
    if(!r.success){if(!silent)this.toast(r.message||'हिसाब load नहीं हुआ');return;}
    this.data=r;
    try{localStorage.setItem('dm_rider_finance_fast',JSON.stringify({time:Date.now(),data:r}))}catch{}
    this.render();
  },
  render(){
    const d=this.data||{},s=d.summary||{};
    rfTotal.textContent=this.money(s.totalEarning);
    rfDelivery.textContent=this.money(s.deliveryEarning);
    rfReturn.textContent=this.money(s.returnEarning);
    rfPending.textContent=this.money(s.payable);
    rfPaid.textContent=this.money(s.paid);
    rfCOD.textContent=this.money(s.codPending);
    payoutNotice.className='rf-payout-notice '+(s.payoutBlocked?'blocked':'ready');
    payoutNotice.innerHTML=s.payoutBlocked
      ?`<i class="fa-solid fa-lock"></i><div><strong>भुगतान hold है</strong><span>${this.money(s.codPending)} COD जमा/reconcile होने के बाद payout खुलेगा।</span></div>`
      :`<i class="fa-solid fa-circle-check"></i><div><strong>भुगतान के लिए तैयार</strong><span>Net payable ${this.money(s.payable)} है।</span></div>`;

    earningsBody.innerHTML=(d.earnings||[]).length?(d.earnings||[]).map(e=>`<tr>
      <td><strong>${this.esc(e.SourceType)}</strong></td>
      <td>${this.esc(e.ReturnID||e.OrderID||e.SourceID)}</td>
      <td>${this.money(e.NetAmount)}</td>
      <td><span class="rf-badge ${String(e.Status||'').toLowerCase()}">${this.esc(e.Status)}</span></td>
      <td>${this.date(e.CreatedAt)}</td>
    </tr>`).join(''):'<tr><td colspan="5" class="rf-empty">अभी कोई earning entry नहीं है।</td></tr>';

    settlementsBody.innerHTML=(d.settlements||[]).length?(d.settlements||[]).map(x=>`<tr>
      <td><strong>${this.esc(x.SettlementID)}</strong></td>
      <td>${this.money(x.NetAmount)}</td>
      <td>${this.esc(x.PaymentMode)}<small>${this.esc(x.Reference||'')}</small></td>
      <td>${this.date(x.PaidAt||x.CreatedAt)}</td>
    </tr>`).join(''):'<tr><td colspan="4" class="rf-empty">अभी कोई payout history नहीं है।</td></tr>';

    adjustmentsBody.innerHTML=(d.adjustments||[]).length?(d.adjustments||[]).map(x=>`<tr>
      <td><span class="rf-badge ${String(x.AdjustmentType).toLowerCase()}">${this.esc(x.AdjustmentType)}</span></td>
      <td>${this.money(x.Amount)}</td>
      <td>${this.esc(x.Reason||'—')}</td>
      <td>${this.esc(x.Status)}</td>
    </tr>`).join(''):'<tr><td colspan="4" class="rf-empty">कोई bonus/penalty नहीं है।</td></tr>';
  },
  async logout(){
    await DesiMallAPI.riderLogout(this.session.token);
    localStorage.removeItem(this.key);
    location.replace('login.html');
  }
};
document.addEventListener('DOMContentLoaded',()=>RiderFinance.init());