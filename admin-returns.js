const AdminReturns={
  rows:[],riders:[],selected:'',pollTimer:null,
  token(){
    try{
      return JSON.parse(localStorage.getItem('desimall_admin_session')||'null')?.token||'';
    }catch(_){return '';}
  },
  statusLabels:{
    'Requested':'New Request','Seller Accepted':'Seller Accepted','Seller Rejected':'Seller Objection',
    'Approved':'Approved','Rejected':'Rejected','Pickup Assigned':'Rider Assigned','Rider Accepted':'Rider Accepted','Picked Up':'Picked Up',
    'Received':'Mark Received','Inspection Passed':'Inspection Passed','Inspection Failed':'Inspection Failed',
    'Refund Processing':'Refund Processing','Refund Completed':'Refund Completed','Closed':'Closed'
  },
  esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));},
  money(v){return `₹${Number(v||0).toLocaleString('en-IN',{maximumFractionDigits:2})}`;},
  date(v){if(!v)return '—';const d=new Date(v);return isNaN(d)?String(v):d.toLocaleString('hi-IN',{dateStyle:'medium',timeStyle:'short'});},
  label(v){return this.statusLabels[v]||v||'—';},
  toast(m){adminToast.textContent=m;adminToast.classList.add('show');setTimeout(()=>adminToast.classList.remove('show'),2500);},
  init(){
    refreshAdminReturns.onclick=()=>this.load();
    adminReturnSearch.oninput=this.debounce(()=>this.load(),300);
    adminReturnStatus.onchange=()=>this.load();
    returnModalClose.onclick=()=>this.closeModal();
    returnActionModal.onclick=e=>{if(e.target===returnActionModal)this.closeModal();};
    this.restoreSaved();
    this.load(true);
    this.pollTimer=setInterval(()=>{if(!document.hidden)this.load(true);},20000);
  },
  restoreSaved(){
    try{
      const saved=JSON.parse(localStorage.getItem('dm_admin_returns_fast')||'null');
      if(!saved||!Array.isArray(saved.rows))return;
      this.rows=saved.rows;this.riders=saved.riders||[];const s=saved.stats||{};
      arTotal.textContent=s.total||this.rows.length;arNew.textContent=s.new||0;arApproved.textContent=s.approved||0;
      arPickup.textContent=s.pickup||0;arInspection.textContent=s.inspection||0;arRefund.textContent=s.refund||0;arCompleted.textContent=s.completed||0;
      this.renderList();
    }catch(_){}
  },
  debounce(fn,ms){let t;return(...args)=>{clearTimeout(t);t=setTimeout(()=>fn(...args),ms);};},
  async load(silent=false){
    const r=await DesiMallAPI.getAdminReturns({search:adminReturnSearch.value,status:adminReturnStatus.value},this.token());
    if(!r.success){if(!silent)this.toast(r.message||'Returns could not be loaded.');return;}
    this.rows=r.returns||[];this.riders=r.riders||[];
    try{localStorage.setItem('dm_admin_returns_fast',JSON.stringify({time:Date.now(),rows:this.rows,riders:this.riders,stats:r.stats||{}}));}catch(_){}
    const s=r.stats||{};
    arTotal.textContent=s.total||0;arNew.textContent=s.new||0;arApproved.textContent=s.approved||0;
    arPickup.textContent=s.pickup||0;arInspection.textContent=s.inspection||0;arRefund.textContent=s.refund||0;arCompleted.textContent=s.completed||0;
    this.renderList();
    if(this.selected&&this.rows.some(x=>x.ReturnID===this.selected))this.open(this.selected,true);
  },
  renderList(){
    adminReturnList.innerHTML=this.rows.length?this.rows.map(x=>{
      const active=this.selected===x.ReturnID?'active':'';
      return `<article class="return-item ${active}" onclick="AdminReturns.open('${this.esc(x.ReturnID)}')">
        <div class="return-list-top"><strong>${this.esc(x.ReturnID)}</strong><span class="return-badge return-status-${String(x.Status).replaceAll(' ','-')}">${this.esc(this.label(x.Status))}</span></div>
        <h3>${this.esc(x.ProductName)}</h3>
        <div class="return-meta"><span><i class="fa-solid fa-receipt"></i> ${this.esc(x.OrderID)}</span><span><i class="fa-solid fa-user"></i> ${this.esc(x.CustomerName)}</span></div>
        <div class="return-list-bottom"><span>${this.esc(x.SellerName||'Seller')}</span><strong>${this.money(x.OrderAmount)}</strong></div>
      </article>`;
    }).join(''):'<div class="support-empty"><i class="fa-solid fa-box-open"></i><strong>No return requests</strong></div>';
  },
  open(id,skipList=false){
    this.selected=id;if(!skipList)this.renderList();
    const x=this.rows.find(r=>r.ReturnID===id);if(!x)return;
    adminReturnDetail.innerHTML=`
      <div class="ticket-detail-head return-detail-head-v2">
        <div><h2>${this.esc(x.ProductName)}</h2><div class="return-meta"><strong>${this.esc(x.ReturnID)}</strong><span>${this.esc(x.OrderID)}</span><span>${this.date(x.RequestedAt)}</span></div></div>
        <span class="return-badge return-status-${String(x.Status).replaceAll(' ','-')}">${this.esc(this.label(x.Status))}</span>
      </div>

      <div class="return-people-grid">
        <article><i class="fa-solid fa-user"></i><div><small>Customer</small><strong>${this.esc(x.CustomerName)}</strong><span>${this.esc(x.CustomerMobile||'')}</span></div></article>
        <article><i class="fa-solid fa-shop"></i><div><small>Seller</small><strong>${this.esc(x.SellerName||'—')}</strong><span>${this.esc(x.SellerID||'')}</span></div></article>
        <article><i class="fa-solid fa-indian-rupee-sign"></i><div><small>Order / Seller amount</small><strong>${this.money(x.OrderAmount)} / ${this.money(x.SellerAmount)}</strong></div></article>
      </div>

      <div class="return-reason-box">
        <div><small>Return Reason</small><strong>${this.esc(x.Reason)}</strong></div>
        <p>${this.esc(x.Description)}</p>
        <small>Pickup: ${this.esc(x.PickupAddress||'—')}</small>
      </div>

      ${x.PhotoURL?`<div class="return-proof-block"><h3>Customer proof</h3><a href="${this.esc(x.PhotoURL)}" target="_blank"><img class="return-photo return-photo-large" src="${this.esc(x.PhotoURL)}"></a></div>`:''}

      <div class="return-timeline-v2">${this.timeline(x)}</div>

      ${(x.Messages||[]).length?`<section class="return-conversation"><h3>Conversation and Notes</h3>${x.Messages.map(m=>`<article class="${m.SenderType==='Admin'?'admin':''}"><strong>${this.esc(m.SenderName||m.SenderType)}</strong><p>${this.esc(m.Message)}</p><small>${this.date(m.CreatedAt)}</small></article>`).join('')}</section>`:''}

      ${x.RiderName?`<div class="return-rider-card"><i class="fa-solid fa-motorcycle"></i><div><small>Reverse pickup rider</small><strong>${this.esc(x.RiderName)}</strong><span>${this.esc(x.RiderID||'')}</span></div></div>`:''}

      ${x.PickupProofURL?`<div class="return-proof-card"><div><small>Pickup proof</small><strong>Collected from Customer</strong></div><a href="${this.esc(x.PickupProofURL)}" target="_blank">View Photo</a></div>`:''}
      ${x.ReceivedProofURL?`<div class="return-proof-card"><div><small>Deposit proof</small><strong>Received by ${this.esc(x.ReceivedBy||'—')}</strong><span>${this.esc(x.ReceiverNote||'')}</span></div><a href="${this.esc(x.ReceivedProofURL)}" target="_blank">View Photo</a></div>`:''}
      ${x.RefundStatus==='Completed'?`<div class="return-refund-card"><i class="fa-solid fa-circle-check"></i><div><small>Refund completed</small><strong>${this.money(x.RefundAmount)} · ${this.esc(x.RefundMode)}</strong><span>${this.esc(x.RefundReference||'No reference')} · Adjustment ${this.esc(x.SettlementAdjustmentID||'recorded')}</span></div></div>`:''}

      <div class="return-actions return-actions-v2">${this.actions(x)}</div>`;
  },
  timeline(x){
    const seq=[
      ['Requested','Request Submitted',x.RequestedAt],
      ['Seller Accepted','Seller Response',x.SellerRespondedAt],
      ['Approved','Admin Approval',x.AdminReviewedAt],
      ['Pickup Assigned','Rider Assigned',x.PickupAssignedAt],
      ['Rider Accepted','Rider Accepted',x.RiderAcceptedAt],
      ['Picked Up','Pickup',x.PickedUpAt],
      ['Received','Mark Received',x.ReceivedAt],
      ['Inspection Passed','Inspection',x.InspectedAt],
      ['Refund Completed','Refund',x.RefundedAt]
    ];
    const order=['Requested','Seller Accepted','Seller Rejected','Approved','Rejected','Pickup Assigned','Picked Up','Received','Inspection Passed','Inspection Failed','Refund Processing','Refund Completed','Closed'];
    const ci=order.indexOf(x.Status);
    return seq.map(([st,label,date])=>{
      const done=(st==='Seller Accepted'&&['Seller Rejected'].includes(x.Status))||order.indexOf(st)<=ci;
      return `<div class="return-step ${done?'done':''}"><i class="fa-solid ${done?'fa-check':'fa-circle'}"></i><div><strong>${label}</strong><small>${date?this.date(date):'Pending'}</small></div></div>`;
    }).join('');
  },
  actions(x){
    let a='';
    if(['Requested','Seller Accepted','Seller Rejected'].includes(x.Status)){
      a+=`<button class="a-btn primary" onclick="AdminReturns.reviewModal('Approve')"><i class="fa-solid fa-check"></i> Approve</button>`;
      a+=`<button class="a-btn danger" onclick="AdminReturns.reviewModal('Reject')"><i class="fa-solid fa-xmark"></i> Reject</button>`;
    }
    if(['Pickup Assigned','Rider Accepted'].includes(x.Status))a+=`<button class="a-btn" onclick="AdminReturns.resetOTP()"><i class="fa-solid fa-key"></i> OTP reset</button>`;
    if(x.Status==='Approved')a+=`<button class="a-btn primary" onclick="AdminReturns.assignModal()"><i class="fa-solid fa-motorcycle"></i> Assign Rider</button>`;
    if(x.Status==='Pickup Assigned')a+=`<button class="a-btn primary" onclick="AdminReturns.confirmStage('Picked Up','Has the rider collected the item from the customer?')"><i class="fa-solid fa-box"></i> Mark Picked Up</button>`;
    if(x.Status==='Picked Up')a+=`<button class="a-btn primary" onclick="AdminReturns.confirmStage('Received','Has the returned item reached the seller or warehouse?')"><i class="fa-solid fa-warehouse"></i> Mark Received</button>`;
    if(x.Status==='Received'){
      a+=`<button class="a-btn primary" onclick="AdminReturns.inspectionModal('Inspection Passed')"><i class="fa-solid fa-circle-check"></i> Inspection Passed</button>`;
      a+=`<button class="a-btn danger" onclick="AdminReturns.inspectionModal('Inspection Failed')"><i class="fa-solid fa-triangle-exclamation"></i> Inspection Failed</button>`;
    }
    if(x.Status==='Inspection Passed')a+=`<button class="a-btn primary" onclick="AdminReturns.refundModal()"><i class="fa-solid fa-indian-rupee-sign"></i> Complete Refund</button>`;
    if(!a)a='<span class="return-no-action">No action is pending at this stage.</span>';
    return a;
  },
  async resetOTP(){if(!confirm('Reset the pickup OTP?'))return;const r=await DesiMallAPI.resetReturnPickupOTP({ReturnID:this.selected});this.toast(r.message+(r.otp?' New OTP: '+r.otp:''));if(r.success)await this.load();},
  showModal(html){returnModalContent.innerHTML=html;returnActionModal.classList.add('show');returnActionModal.setAttribute('aria-hidden','false');},
  closeModal(){returnActionModal.classList.remove('show');returnActionModal.setAttribute('aria-hidden','true');},
  reviewModal(decision){
    const title=decision==='Approve'?'Approve Return':'Reject Return';
    this.showModal(`<h2>${title}</h2><p>Enter a clear reason for the decision.</p><textarea id="returnDecisionNote" rows="5" placeholder="Admin note..." required></textarea><div class="return-modal-actions"><button class="a-btn" onclick="AdminReturns.closeModal()">Close</button><button class="a-btn ${decision==='Approve'?'primary':'danger'}" onclick="AdminReturns.submitReview('${decision}')">Save Decision</button></div>`);
  },
  async submitReview(decision){
    const note=document.getElementById('returnDecisionNote').value.trim();
    if(note.length<4){this.toast('Enter a note of at least 4 characters.');return;}
    const r=await DesiMallAPI.adminReturnReview({ReturnID:this.selected,Decision:decision,Note:note});
    this.toast(r.message||'Updated.');if(r.success){this.closeModal();await this.load();}
  },
  assignModal(){
    const options=this.riders.length?this.riders.map(r=>`<option value="${this.esc(r.RiderID)}">${this.esc(r.RiderName)} · ${this.esc(r.Mobile||'')} · ${this.esc(r.VehicleType||'')}</option>`).join(''):'<option value="">No active rider</option>';
    this.showModal(`<h2>Reverse pickup rider</h2><p>Only an active rider can be assigned.</p><select id="returnRiderSelect">${options}</select><div class="return-modal-actions"><button class="a-btn" onclick="AdminReturns.closeModal()">Close</button><button class="a-btn primary" onclick="AdminReturns.submitAssign()">Assign Rider</button></div>`);
  },
  async submitAssign(){
    const id=document.getElementById('returnRiderSelect').value;if(!id){this.toast('Select an active rider.');return;}
    const r=await DesiMallAPI.assignReturnPickup({ReturnID:this.selected,RiderID:id});
    this.toast(r.message||'Updated.');if(r.success){this.closeModal();await this.load();}
  },
  async confirmStage(status,message){
    if(!confirm(message))return;
    const r=await DesiMallAPI.updateReturnStage({ReturnID:this.selected,Status:status});
    this.toast(r.message||'Updated.');if(r.success)await this.load();
  },
  inspectionModal(status){
    this.showModal(`<h2>${status==='Inspection Passed'?'Inspection Passed':'Inspection Failed'}</h2><p>Record the item's condition and included accessories.</p><textarea id="inspectionNote" rows="5" placeholder="Inspection note..." required></textarea><div class="return-modal-actions"><button class="a-btn" onclick="AdminReturns.closeModal()">Close</button><button class="a-btn ${status==='Inspection Passed'?'primary':'danger'}" onclick="AdminReturns.submitInspection('${status}')">Save Inspection</button></div>`);
  },
  async submitInspection(status){
    const note=document.getElementById('inspectionNote').value.trim();if(note.length<4){this.toast('Enter an inspection note.');return;}
    const r=await DesiMallAPI.updateReturnStage({ReturnID:this.selected,Status:status,Note:note});
    this.toast(r.message||'Updated.');if(r.success){this.closeModal();await this.load();}
  },
  refundModal(){
    const x=this.rows.find(r=>r.ReturnID===this.selected);
    this.showModal(`<h2>Complete Refund</h2><p>After processing the refund with the payment provider, enter the reference. The seller adjustment will also be recorded.</p>
      <div class="return-form-grid">
        <label>Refund Amount<input id="refundAmount" type="number" min="0" step="0.01" value="${Number(x.OrderAmount||0)}"></label>
        <label>Method<select id="refundMode"><option>Original Method</option><option>UPI</option><option>Bank Transfer</option><option>Wallet</option><option>Cash</option></select></label>
        <label class="full">Reference<input id="refundReference" placeholder="UTR / transaction / cash reference"></label>
        <label class="full">Finance note<textarea id="refundNote" rows="4" placeholder="Optional note"></textarea></label>
      </div><div class="return-modal-actions"><button class="a-btn" onclick="AdminReturns.closeModal()">Close</button><button class="a-btn primary" onclick="AdminReturns.submitRefund()">Record Refund</button></div>`);
  },
  async submitRefund(){
    const amount=Number(document.getElementById('refundAmount').value||0),mode=document.getElementById('refundMode').value,reference=document.getElementById('refundReference').value.trim(),note=document.getElementById('refundNote').value.trim();
    if(amount<=0){this.toast('Enter a valid refund amount.');return;}if(!reference){this.toast('Refund reference is required.');return;}
    const r=await DesiMallAPI.processReturnRefund({ReturnID:this.selected,Amount:amount,Mode:mode,Reference:reference,Note:note});
    this.toast(r.message||'Updated.');if(r.success){this.closeModal();await this.load();}
  }
};
document.addEventListener('DOMContentLoaded',()=>AdminReturns.init());