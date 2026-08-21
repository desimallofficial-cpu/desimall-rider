const SellerHisab={
  version:'0.29.3',
  session:null,

  money(v){
    return `₹${Number(v||0).toLocaleString(
      'en-IN',
      {maximumFractionDigits:2}
    )}`;
  },

  esc(v){
    return String(v??'').replace(/[&<>'"]/g,c=>({
      '&':'&amp;',
      '<':'&lt;',
      '>':'&gt;',
      "'":'&#39;',
      '"':'&quot;'
    }[c]));
  },

  date(v){
    if(!v)return '—';

    const d=new Date(v);

    if(Number.isNaN(d.getTime())){
      return this.esc(v);
    }

    return d.toLocaleString('en-IN',{
      day:'2-digit',
      month:'short',
      year:'numeric',
      hour:'2-digit',
      minute:'2-digit'
    });
  },

  toast(m){
    sellerHisabToast.textContent=m;
    sellerHisabToast.classList.add('show');
    setTimeout(
      ()=>sellerHisabToast.classList.remove('show'),
      2300
    );
  },

  async init(){
    this.session=JSON.parse(
      localStorage.getItem('desimall_seller_session')||'null'
    );

    if(!this.session?.token){
      location.href='login.html';
      return;
    }

    refreshHisab.onclick=()=>this.load();

    await this.load();
  },

  async load(){
    try{
      const r=await DesiMallAPI.getSellerHisab(
        this.session.token
      );

      if(!r.success){
        this.toast(
          r.message||
          'Could not load seller account.'
        );
        return;
      }

      const s=r.seller||{};
      const st=r.stats||{};

      if(window.sideSellerName){
        sideSellerName.textContent=
          s.SellerName||
          s.Name||
          'Seller';
      }

      if(window.sideShopName){
        sideShopName.textContent=
          s.ShopName||
          'Seller Store';
      }

      sellerTotalEarning.textContent=
        this.money(st.netEntitlement);

      sellerPendingPayout.textContent=
        this.money(st.pendingPayout);

      sellerPaidPayout.textContent=
        this.money(st.paidPayout);

      sellerCODHold.textContent=
        this.money(st.codOnHold);

      sellerEligibleSales.textContent=
        this.money(st.eligibleSales);

      sellerReturnAdjustments.textContent=
        this.money(st.returnAdjustments);

      sellerMarketplaceFees.textContent=
        this.money(st.marketplaceFees);

      sellerPaidOrders.textContent=
        Number(st.eligibleOrders||0);

      sellerDeliveredGross.textContent=
        this.money(st.deliveredGross);

      sellerPaymentPending.textContent=
        this.money(st.paymentPending);

      sellerCODHoldOrders.textContent=
        Number(st.codHoldOrders||0);

      sellerCODReview.textContent=
        this.money(st.codReviewAmount);

      sellerCODReviewOrders.textContent=
        `${Number(st.codReviewOrders||0)} order${Number(st.codReviewOrders||0)===1?'':'s'}`;

      const codReview=Number(st.codReviewAmount||0);
      sellerCODReviewAlert.style.display=codReview>0?'block':'none';
      sellerCODReviewAlert.innerHTML=codReview>0
        ? `<strong>Blocked COD settlement: ${this.money(codReview)}</strong><br>
           These older/inconsistent COD records are excluded from payout and from live COD hold.
           DesiMall admin will reconcile them separately.`
        : '';

      sellerRecoveryDue.textContent=
        this.money(st.recoveryDue);

      const recovery=Number(st.recoveryDue||0);
      sellerRecoveryAlert.style.display=recovery>0?'block':'none';
      sellerRecoveryAlert.innerHTML=recovery>0
        ? `<strong>Adjustment due: ${this.money(recovery)}</strong><br>
           A return/refund was finalized after earlier seller entitlement/payout.
           This amount will be recovered from future eligible earnings; old payout
           history remains unchanged.`
        : '';

      this.renderActivity(r.history||[]);
      this.renderPayouts(r.payouts||[]);

      if(Number(st.recoveryDue||0)>0){
        this.toast(
          `Account adjustment due: ${this.money(st.recoveryDue)}`
        );
      }
    }catch(error){
      this.toast(
        error?.message||
        'Could not load seller account.'
      );
    }
  },

  renderActivity(rows){
    sellerHisabBody.innerHTML=rows.length
      ? rows.map(x=>{
          const amount=Number(x.Amount||0);
          const cls=
            x.Status==='Paid'
              ? 'paid'
              : amount<0
                ? 'negative'
                : x.Status==='COD Hold'
                  ? 'hold'
                  : 'positive';

          const reference=
            x.OrderID||
            x.Reference||
            '—';

          return `
            <tr>
              <td>${this.date(x.Date)}</td>
              <td>
                <strong>${this.esc(x.Type||'Activity')}</strong>
                ${
                  x.ProductName
                    ? `<div style="color:#93a4b8;margin-top:3px">${this.esc(x.ProductName)}</div>`
                    : ''
                }
              </td>
              <td>
                <strong>${this.esc(reference)}</strong>
                ${
                  x.Reference && x.OrderID
                    ? `<div style="color:#93a4b8;margin-top:3px">${this.esc(x.Reference)}</div>`
                    : ''
                }
              </td>
              <td>${this.esc(x.Status||'')}</td>
              <td>${Number(x.MarketplaceFee||0)>0?this.money(x.MarketplaceFee):'—'}</td>
              <td class="${cls}">
                ${amount>0?'+':''}${this.money(amount)}
              </td>
            </tr>
          `;
        }).join('')
      : `
        <tr>
          <td colspan="6" class="account-empty">
            No seller account activity yet.
          </td>
        </tr>
      `;
  },

  renderPayouts(rows){
    sellerPayoutHistory.innerHTML=rows.length
      ? rows.map(x=>`
          <div class="payout-item">
            <div>
              <strong>${this.esc(x.PaymentMode||'Payout')}</strong>
              <span>${this.esc(x.Reference||'—')}</span>
              <span>${this.date(x.PaidAt)}</span>
            </div>
            <div class="amount">
              ${this.money(x.Amount)}
            </div>
          </div>
        `).join('')
      : `
        <div class="account-empty">
          No payout history yet.
        </div>
      `;
  }
};

document.addEventListener(
  'DOMContentLoaded',
  ()=>SellerHisab.init()
);