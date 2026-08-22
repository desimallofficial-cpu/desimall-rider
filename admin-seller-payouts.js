const AdminSellerPayouts={
  rows:[],
  history:[],
  current:null,

  token(){
    try{
      return JSON.parse(localStorage.getItem('desimall_admin_session')||'null')?.token||'';
    }catch(_){
      return '';
    }
  },

  esc(v){
    return String(v??'').replace(/[&<>"']/g,c=>({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[c]));
  },

  money(v){
    return `₹${Number(v||0).toLocaleString('en-IN',{maximumFractionDigits:2})}`;
  },

  date(v){
    const d=new Date(v||0);
    if(Number.isNaN(d.getTime()))return this.esc(v||'—');

    return d.toLocaleString('en-IN',{
      day:'2-digit',
      month:'short',
      year:'numeric',
      hour:'2-digit',
      minute:'2-digit'
    });
  },

  toast(m){
    sellerPayoutToast.textContent=m;
    sellerPayoutToast.classList.add('show');
    setTimeout(()=>sellerPayoutToast.classList.remove('show'),2400);
  },

  async init(){
    if(!this.token()){
      location.href='login.html';
      return;
    }

    refreshSellerPayouts.onclick=()=>this.load();
    closeSellerPay.onclick=()=>this.closePay();
    cancelSellerPay.onclick=()=>this.closePay();
    sellerPayForm.onsubmit=e=>{
      e.preventDefault();
      this.pay();
    };

    sellerPayModal.addEventListener('click',e=>{
      if(e.target===sellerPayModal)this.closePay();
    });

    await this.load();
  },

  async load(){
    sellerPayoutRows.innerHTML='<tr><td colspan="5" class="empty-state">Loading seller payouts…</td></tr>';

    try{
      const r=await DesiMallAPI.getPendingSellerSettlements(this.token());

      if(!r.success){
        throw new Error(r.message||'Could not load seller payouts.');
      }

      this.rows=(r.settlements||[]).filter(
        x=>Number(x.Amount||0)>=0.01
      );
      this.history=r.history||[];
      this.summary=r.summary||null;

      this.renderSummary();
      this.renderRows();
      this.renderHistory();
    }catch(error){
      sellerPayoutRows.innerHTML=`
        <tr><td colspan="5">
          <div class="empty-state">
            <i class="fa-solid fa-triangle-exclamation"></i>
            <strong>Could not load seller payouts</strong>
            <span>${this.esc(error?.message||'Request failed.')}</span>
          </div>
        </td></tr>
      `;
      this.toast(error?.message||'Could not load seller payouts.');
    }
  },

  renderSummary(){
    const pending=this.summary
      ? Number(this.summary.PendingTotal||0)
      : this.rows.reduce((a,x)=>a+Number(x.Amount||0),0);

    const waiting=this.summary
      ? Number(this.summary.SellersAwaitingPayout||0)
      : this.rows.filter(x=>Number(x.Amount||0)>=0.01).length;

    const paid=this.summary
      ? Number(this.summary.TotalPaid||0)
      : this.history.reduce((a,x)=>a+Number(x.Amount||0),0);

    const cod=this.summary
      ? Number(this.summary.CODOnHold||0)
      : this.rows.reduce((a,x)=>a+Number(x.CODHold||0),0);

    const codReview=this.summary
      ? Number(this.summary.CODReview||0)
      : this.rows.reduce((a,x)=>a+Number(x.CODReview||0),0);

    spPendingTotal.textContent=this.money(pending);
    spPendingSellers.textContent=waiting;
    spPaidTotal.textContent=this.money(paid);
    spCODHold.textContent=this.money(cod);
    if(window.spCODReview)spCODReview.textContent=this.money(codReview);
  },

  accountHtml(x){
    if(x.BankAccountNumber){
      return `
        <strong>${this.esc(x.BankAccountName||'Bank Account')}</strong>
        <span class="bank-line">${this.esc(x.BankName||'')} · A/C ${this.esc(x.BankAccountNumber)}</span>
        <span class="bank-line">IFSC ${this.esc(x.IFSC||'Not provided')}</span>
      `;
    }

    if(x.UPIID){
      return `
        <strong>UPI</strong>
        <span class="bank-line">${this.esc(x.UPIID)}</span>
      `;
    }

    return `<span class="account-missing">Bank / UPI details missing</span>`;
  },

  renderRows(){
    if(!this.rows.length){
      sellerPayoutRows.innerHTML=`
        <tr><td colspan="5">
          <div class="empty-state">
            <i class="fa-solid fa-circle-check"></i>
            <strong>No seller payout is pending</strong>
            <span>Eligible seller balances will appear here automatically.</span>
          </div>
        </td></tr>
      `;
      return;
    }

    sellerPayoutRows.innerHTML=this.rows.map(x=>`
      <tr>
        <td>
          <div class="seller-main">
            <strong>${this.esc(x.SellerName||'Seller')}</strong>
            <span>${this.esc(x.ShopName||'')} · ${this.esc(x.SellerCode||'')}</span>
            <span>${this.esc(x.Mobile||x.Email||'')}</span>
          </div>
        </td>

        <td>${this.accountHtml(x)}</td>

        <td>
          <span class="ready"><i class="fa-solid fa-check"></i> Eligible</span>
          <span class="row-meta hold">COD Hold ${this.money(x.CODHold||0)}</span>
          ${Number(x.CODReview||0)>0
            ? `<span class="row-meta" style="color:#ffd277">COD Review ${this.money(x.CODReview||0)}</span>`
            : ''}
          <span class="row-meta returns">Returns ${this.money(x.ReturnAdjustments||0)}</span>
        </td>

        <td>
          <div class="money-main">${this.money(x.Amount)}</div>
          <span class="row-meta">Eligible sales ${this.money(x.EligibleSales||0)}</span>
        </td>

        <td>
          <button
            class="a-btn small primary"
            ${Number(x.Amount||0)>=0.01?'':'disabled'}
            onclick="AdminSellerPayouts.openPay('${this.esc(x.SellerID)}')"
          >
            <i class="fa-solid fa-building-columns"></i>
            ${Number(x.Amount||0)>=0.01?'Pay Seller':'No Payout'}
          </button>
        </td>
      </tr>
    `).join('');
  },

  renderHistory(){
    if(!this.history.length){
      sellerPayoutHistory.innerHTML=`
        <div class="empty-state">
          <i class="fa-solid fa-receipt"></i>
          <strong>No payout history</strong>
          <span>Completed seller payments will appear here.</span>
        </div>
      `;
      return;
    }

    sellerPayoutHistory.innerHTML=this.history.map(x=>`
      <div class="history-item">
        <div>
          <strong>${this.esc(x.SellerName||'Seller')}</strong>
          <span>${this.esc(x.ShopName||x.SellerCode||'')}</span>
          <span>${this.esc(x.PaymentMode||'')} · ${this.esc(x.Reference||'—')}</span>
          <span>${this.date(x.PaidAt)}</span>
        </div>
        <div class="history-amount">${this.money(x.Amount)}</div>
      </div>
    `).join('');
  },

  openPay(id){
    const x=this.rows.find(r=>String(r.SellerID)===String(id));
    if(!x)return this.toast('Seller payout not found.');
    if(Number(x.Amount||0)<0.01){
      return this.toast('No pending seller payout is available.');
    }

    this.current=x;

    paySellerId.value=x.SellerID;
    paySellerName.textContent=`${x.SellerName||'Seller'}${x.ShopName?' · '+x.ShopName:''}`;
    paySellerAmount.textContent=this.money(x.Amount);
    paySellerCOD.textContent=this.money(x.CODHold||0);
    paySellerReturns.textContent=this.money(x.ReturnAdjustments||0);

    if(x.BankAccountNumber){
      paySellerAccount.textContent=
        `${x.BankAccountName||'Bank Account'} · A/C ${x.BankAccountNumber} · IFSC ${x.IFSC||'Not provided'}`;
    }else if(x.UPIID){
      paySellerAccount.textContent=`UPI · ${x.UPIID}`;
    }else{
      paySellerAccount.textContent='Bank / UPI details missing';
    }

    paySellerMode.value=x.UPIID?'UPI':x.BankAccountNumber?'Bank Transfer':'';
    paySellerReference.value='';
    paySellerNote.value='';

    sellerPaySubtitle.textContent=`Pending payout ${this.money(x.Amount)}. Verify the actual transfer before confirming.`;
    sellerPayModal.classList.add('show');
  },

  closePay(){
    sellerPayModal.classList.remove('show');
    this.current=null;
    sellerPayForm.reset();
  },

  async pay(){
    if(!this.current)return;

    const mode=paySellerMode.value;
    const ref=paySellerReference.value.trim();

    if(!mode)return this.toast('Select payment method.');
    if(ref.length<2)return this.toast('Transaction reference is required.');

    if(!confirm(
      `Confirm that ${this.money(this.current.Amount)} has actually been paid to ${this.current.SellerName||'the seller'}?`
    )){
      return;
    }

    const btn=confirmSellerPay;
    btn.disabled=true;
    btn.innerHTML='<i class="fa-solid fa-spinner fa-spin"></i> Saving...';

    try{
      const r=await DesiMallAPI.paySellerSettlement({
        Token:this.token(),
        SellerID:this.current.SellerID,
        PaymentMode:mode,
        Reference:ref,
        AdminNote:paySellerNote.value.trim()
      });

      if(!r.success){
        throw new Error(r.message||'Seller payout failed.');
      }

      this.toast(r.message||'Seller payout recorded.');
      this.closePay();
      await this.load();
    }catch(error){
      this.toast(error?.message||'Seller payout failed.');
    }finally{
      btn.disabled=false;
      btn.innerHTML='<i class="fa-solid fa-check"></i> Confirm Payout';
    }
  }
};

document.addEventListener('DOMContentLoaded',()=>AdminSellerPayouts.init());
