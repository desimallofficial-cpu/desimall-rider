const SellerReturns={
  session:null,
  rows:[],
  selected:'',

  esc(v){
    return String(v??'').replace(/[&<>"']/g,c=>({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[c]));
  },

  money(v){
    return `₹${Number(v||0).toLocaleString('en-IN')}`;
  },

  // Seller panel uses operational return language. Customer refund wording
  // remains an admin/customer concern; the underlying API status is unchanged.
  displayStatus(status){
    const map={
      'Refund Processing':'Return Closing',
      'Refund Completed':'Return Completed',
      'Closed':'Return Completed'
    };
    return map[String(status||'')]||String(status||'');
  },

  toast(message){
    panelToast.textContent=message;
    panelToast.classList.add('show');
    setTimeout(()=>panelToast.classList.remove('show'),2600);
  },

  async init(){
    this.session=JSON.parse(
      localStorage.getItem('desimall_seller_session')||'null'
    );

    if(!this.session?.token){
      location.href='login.html';
      return;
    }

    refreshSellerReturns.onclick=()=>this.load();
    sellerReturnFilter.onchange=()=>this.renderList();

    await this.load();
  },

  async load(){
    try{
      const r=await DesiMallAPI.getSellerReturns(this.session.token);

      this.rows=r.returns||[];

      srTotal.textContent=this.rows.length;
      srPending.textContent=this.rows.filter(x=>x.Status==='Requested').length;
      srAccepted.textContent=this.rows.filter(
        x=>['Seller Accepted','Approved'].includes(x.Status)
      ).length;
      srPickup.textContent=this.rows.filter(
        x=>/Pickup Assigned|Rider Accepted|Picked Up|Received/.test(x.Status)
      ).length;
      srRefunded.textContent=this.rows.filter(
        x=>['Refund Completed','Closed'].includes(x.Status)
      ).length;

      this.renderList();

      if(this.selected && this.rows.some(x=>x.ReturnID===this.selected)){
        this.open(this.selected);
      }else if(this.rows.length){
        this.open(this.rows[0].ReturnID);
      }else{
        this.selected='';
        sellerReturnDetail.innerHTML=this.emptyDetail();
      }
    }catch(error){
      this.rows=[];
      this.renderList();
      sellerReturnDetail.innerHTML=this.emptyDetail(
        error?.message||'Could not load returns.'
      );
      this.toast(error?.message||'Could not load returns.');
    }
  },

  renderList(){
    const filter=sellerReturnFilter.value;

    const rows=this.rows.filter(x=>{
      if(!filter)return true;
      if(filter==='__return_closing__')return x.Status==='Refund Processing';
      if(filter==='__return_completed__')return ['Refund Completed','Closed'].includes(x.Status);
      return x.Status===filter;
    });

    sellerReturnList.innerHTML=rows.length
      ? rows.map(x=>`
        <button
          type="button"
          class="seller-return-row ${this.selected===x.ReturnID?'active':''}"
          onclick="SellerReturns.open('${this.esc(x.ReturnID)}')"
        >
          <div class="seller-return-row-main">
            <strong>${this.esc(x.ProductName)}</strong>
            <span>${this.esc(x.ReturnID)} · ${this.esc(x.OrderID)}</span>
          </div>

          <div class="seller-return-row-reason">
            ${this.esc(x.Reason||'No reason')}
          </div>

          <span class="return-badge return-status-${String(x.Status||'').replaceAll(' ','-')}">
            ${this.esc(this.displayStatus(x.Status))}
          </span>
        </button>
      `).join('')
      : `<div class="support-empty seller-return-empty">
          <i class="fa-solid fa-box-open"></i>
          <strong>No returns found</strong>
          <span>Returns for your products will appear here.</span>
        </div>`;
  },

  emptyDetail(message='Select a return to view its details.'){
    return `<div class="support-empty seller-return-empty">
      <i class="fa-solid fa-rotate-left"></i>
      <strong>Return details</strong>
      <span>${this.esc(message)}</span>
    </div>`;
  },

  open(id){
    this.selected=id;
    this.renderList();

    const x=this.rows.find(r=>r.ReturnID===id);
    if(!x)return;

    const action=x.Status==='Requested'
      ? `<div class="return-actions">
          <button class="btn btn-primary" onclick="SellerReturns.decide('Accept')">
            Accept Return
          </button>
          <button class="btn btn-danger" onclick="SellerReturns.decide('Reject')">
            Reject Return
          </button>
        </div>`
      : '';

    const messages=(x.Messages||[]).length
      ? `<div class="seller-return-messages">
          ${(x.Messages||[]).map(m=>`
            <div class="seller-return-message ${String(m.SenderType||'').toLowerCase()}">
              <strong>${this.esc(m.SenderName||m.SenderType)}</strong>
              <p>${this.esc(m.Message)}</p>
            </div>
          `).join('')}
        </div>`
      : '';

    sellerReturnDetail.innerHTML=`
      <div class="seller-return-detail-head">
        <div>
          <span class="seller-eyebrow">${this.esc(x.ReturnID)}</span>
          <h2>${this.esc(x.ProductName)}</h2>
          <p>${this.esc(x.OrderID)} · Qty ${Number(x.Qty||1)}</p>
        </div>
        <span class="return-badge return-status-${String(x.Status||'').replaceAll(' ','-')}">
          ${this.esc(x.Status)}
        </span>
      </div>

      <div class="seller-return-detail-grid">
        <div>
          <small>Customer</small>
          <strong>${this.esc(x.CustomerName||'Customer')}</strong>
          <span>${this.esc(x.CustomerMobile||'')}</span>
        </div>

        <div>
          <small>Return Amount</small>
          <strong>${this.money(x.RefundAmount||x.OrderAmount||0)}</strong>
          <span>${this.esc(x.Reason||'')}</span>
        </div>

        <div class="wide">
          <small>Pickup Address</small>
          <strong>${this.esc(x.PickupAddress||'Not available')}</strong>
        </div>

        ${x.Description?`
          <div class="wide">
            <small>Customer Note</small>
            <strong>${this.esc(x.Description)}</strong>
          </div>
        `:''}

        ${x.SellerNote?`
          <div class="wide">
            <small>Seller Note</small>
            <strong>${this.esc(x.SellerNote)}</strong>
          </div>
        `:''}
      </div>

      ${x.PhotoURL?`
        <a class="seller-return-proof" href="${this.esc(x.PhotoURL)}" target="_blank">
          <i class="fa-solid fa-image"></i>
          View Return Proof
        </a>
      `:''}

      ${messages}

      ${action}
    `;
  },

  async decide(decision){
    if(!this.selected)return;

    let note='';

    if(decision==='Reject'){
      note=prompt('Reason for rejecting this return:')||'';
      if(note.trim().length<3){
        return this.toast('Please enter a rejection reason.');
      }
    }else{
      note=prompt('Optional seller note:')||'';
    }

    try{
      const r=await DesiMallAPI.sellerReturnDecision({
        Token:this.session.token,
        ReturnID:this.selected,
        Decision:decision,
        Note:note
      });

      this.toast(r.message||'Return updated.');
      if(r.success)await this.load();
    }catch(error){
      this.toast(error?.message||'Could not update return.');
    }
  }
};

document.addEventListener(
  'DOMContentLoaded',
  ()=>SellerReturns.init()
);