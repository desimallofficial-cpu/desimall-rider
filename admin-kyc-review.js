const AdminKYCReview = {
  sellers: [],
  current: null,
  token(){
    try{
      return JSON.parse(localStorage.getItem('desimall_admin_session')||'null')?.token||'';
    }catch(_){
      return '';
    }
  },
  esc(v){return String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));},
  statusClass(v){return String(v||'').toLowerCase().replace(/\s+/g,'-');},
  date(v){if(!v)return '—';const d=new Date(v);return isNaN(d)?String(v):d.toLocaleString('en-IN');},
  initials(n){return String(n||'S').split(/\s+/).slice(0,2).map(x=>x[0]||'').join('').toUpperCase();},
  toast(m){const e=document.getElementById('adminToast');e.textContent=m;e.classList.add('show');setTimeout(()=>e.classList.remove('show'),2400);},
  async init(){
    document.querySelectorAll('[data-close-modal]').forEach(b=>b.onclick=()=>b.closest('.modal').classList.remove('show'));
    sellerSearch.oninput=()=>this.render();
    sellerKycFilter.onchange=()=>this.render();
    sellerAccountFilter.onchange=()=>this.render();
    refreshSellerKyc.onclick=()=>this.load();
    approveSellerKyc.onclick=()=>this.review('Approve');
    rejectSellerKyc.onclick=()=>this.review('Reject');
    suspendSeller.onclick=()=>this.review('Suspend');
    reactivateSeller.onclick=()=>this.review('Reactivate');
    await this.load();
  },
  async load(){
    sellersBody.innerHTML='<tr><td colspan="8" class="empty">Loading sellers…</td></tr>';
    const r=await DesiMallAPI.getAdminSellers(this.token());
    if(!r.success){sellersBody.innerHTML=`<tr><td colspan="8" class="empty">${this.esc(r.message||'Could not load sellers.')}</td></tr>`;return;}
    this.sellers=r.sellers||[];
    this.stats();
    this.render();
  },
  stats(){
    const a=this.sellers;
    sellerTotal.textContent=a.length;
    sellerAwaiting.textContent=a.filter(x=>['not submitted','pending',''].includes(String(x.KYCStatus||'').toLowerCase())).length;
    sellerSubmitted.textContent=a.filter(x=>String(x.KYCStatus||'').toLowerCase()==='submitted').length;
    sellerApproved.textContent=a.filter(x=>String(x.KYCStatus||'').toLowerCase()==='approved').length;
    sellerRejected.textContent=a.filter(x=>String(x.KYCStatus||'').toLowerCase()==='rejected').length;
    sellerSuspended.textContent=a.filter(x=>String(x.Status||'').toLowerCase()==='suspended').length;
  },
  documentCount(s){
    return [s.AadhaarDocumentURL,s.PANDocumentURL,s.GSTDocumentURL,s.BankDocumentURL].filter(Boolean).length;
  },
  filtered(){
    const q=sellerSearch.value.trim().toLowerCase();
    const k=sellerKycFilter.value.toLowerCase();
    const a=sellerAccountFilter.value.toLowerCase();
    return this.sellers.filter(s=>{
      const matchQ=!q||[s.SellerName,s.ShopName,s.Mobile,s.Email,s.PAN,s.GSTIN,s.SellerID].some(v=>String(v||'').toLowerCase().includes(q));
      const matchK=k==='all'||String(s.KYCStatus||'not submitted').toLowerCase()===k;
      const matchA=a==='all'||String(s.Status||'').toLowerCase()===a;
      return matchQ&&matchK&&matchA;
    });
  },
  render(){
    const rows=this.filtered();
    sellerRecordCount.textContent=`${rows.length} records`;
    sellersBody.innerHTML=rows.length?rows.map(s=>this.row(s)).join(''):'<tr><td colspan="8" class="empty">No matching sellers.</td></tr>';
  },
  row(s){
    const docs=this.documentCount(s);
    return `<tr>
      <td><div class="seller-summary">${s.ProfileImage?`<img class="avatar" src="${this.esc(s.ProfileImage)}">`:`<span class="avatar">${this.initials(s.SellerName)}</span>`}<div><strong>${this.esc(s.SellerName||'Seller')}</strong><div class="muted">${this.esc(s.ShopName||'')}</div><div class="muted">${this.esc(s.Mobile||'')}</div></div></div></td>
      <td>${this.esc(s.BusinessType||'—')}<div class="muted">${this.esc(s.GSTIN||'No GSTIN')}</div></td>
      <td><span class="badge ${this.statusClass(s.KYCStatus)}">${this.esc(s.KYCStatus||'Not Submitted')}</span>${s.KYCNotes?`<div class="muted">${this.esc(s.KYCNotes)}</div>`:''}</td>
      <td><span class="doc-count ${docs>=3?'complete':docs?'partial':''}"><i class="fa-solid fa-file-shield"></i>${docs}/4</span></td>
      <td>${s.UseCustomCommission?`Custom ${Number(s.CommissionPercent||0)}%`:'Marketplace default'}</td>
      <td><span class="badge ${this.statusClass(s.Status)}">${this.esc(s.Status||'Pending')}</span></td>
      <td>${this.date(s.KYCSubmittedAt)}</td>
      <td><button class="a-btn small primary" onclick="AdminKYCReview.open('${this.esc(s.SellerID)}')"><i class="fa-solid fa-magnifying-glass"></i> Review</button></td>
    </tr>`;
  },
  line(label,value){return `<div class="review-line"><span>${this.esc(label)}</span><strong>${this.esc(value||'—')}</strong></div>`;},
  docCard(label,url,required){
    if(!url)return `<article class="document-card missing"><strong>${this.esc(label)}</strong><div class="muted">${required?'Required document missing':'Not uploaded'}</div></article>`;
    return `<article class="document-card"><strong>${this.esc(label)}</strong><div class="document-actions"><button class="a-btn small" onclick='AdminKYCReview.preview(${JSON.stringify(label)},${JSON.stringify(url)})'><i class="fa-solid fa-eye"></i> Preview</button><a class="a-btn small" href="${this.esc(url)}" target="_blank" rel="noopener"><i class="fa-solid fa-arrow-up-right-from-square"></i> Open</a></div></article>`;
  },
  async open(id){
    const s=this.sellers.find(x=>String(x.SellerID)===String(id));if(!s)return;
    this.current=s;
    sellerModalTitle.textContent=`${s.SellerName||'Seller'} · ${s.ShopName||''}`;
    sellerModalSubtitle.textContent=`${s.Mobile||''}${s.Email?' • '+s.Email:''} • Seller ID ${s.SellerID||''}`;
    reviewNote.value=s.KYCNotes||'';
    const requiredMissing=!s.AadhaarDocumentURL||!s.PANDocumentURL||!s.BankDocumentURL;
    const historyResponse=await DesiMallAPI.getSellerKYCReviewHistory(id,this.token());
    const history=(historyResponse.history||[]).map(h=>`<div class="kyc-history-item ${this.statusClass(h.NewKYCStatus||h.NewSellerStatus)}"><strong>${this.esc(h.NewKYCStatus||h.NewSellerStatus||h.ReviewAction||'Review')}</strong><div class="muted">${this.esc(h.ReviewNote||'No note')} • ${this.esc(h.ReviewedBy||'Admin')} • ${this.date(h.ReviewedAt)}</div></div>`).join('')||'<div class="muted">No previous KYC review action.</div>';
    sellerReviewContent.innerHTML=`
      ${requiredMissing?'<div class="review-warning"><i class="fa-solid fa-triangle-exclamation"></i> One or more required documents are missing.</div>':String(s.KYCStatus).toLowerCase()==='approved'?'<div class="review-success"><i class="fa-solid fa-circle-check"></i> KYC is currently approved.</div>':''}
      <div class="kyc-review-grid">
        <section class="review-section"><h3><i class="fa-solid fa-shop"></i> Business details</h3><div class="review-list">
          ${this.line('Business type',s.BusinessType)}
          ${this.line('GSTIN',s.GSTIN)}
          ${this.line('PAN',s.PAN)}
          ${this.line('Aadhaar',s.Aadhaar)}
          ${this.line('Address',s.Address)}
        </div></section>
        <section class="review-section"><h3><i class="fa-solid fa-building-columns"></i> Bank details</h3><div class="review-list">
          ${this.line('Bank name',s.BankName)}
          ${this.line('Account number',s.AccountNumber)}
          ${this.line('IFSC',s.IFSC)}
          ${this.line('UPI ID',s.UPIID)}
          ${this.line('Current status',s.Status)}
        </div></section>
        <section class="review-section full"><h3><i class="fa-solid fa-file-shield"></i> Uploaded documents</h3><div class="document-grid">
          ${this.docCard('Aadhaar document',s.AadhaarDocumentURL,true)}
          ${this.docCard('PAN document',s.PANDocumentURL,true)}
          ${this.docCard('GST certificate',s.GSTDocumentURL,false)}
          ${this.docCard('Bank proof',s.BankDocumentURL,true)}
        </div></section>
        <section class="review-section full"><h3><i class="fa-solid fa-clock-rotate-left"></i> Review history</h3><div class="kyc-history">${history}</div></section>
      </div>`;
    sellerModal.classList.add('show');
  },
  preview(label,url){
    documentPreviewTitle.textContent=label;
    const clean=String(url||'');
    const isPdf=/\.pdf($|\?)/i.test(clean)||/drive\.google\.com\/file/i.test(clean);
    documentPreviewBody.innerHTML=isPdf?`<iframe src="${this.esc(clean)}"></iframe>`:`<img src="${this.esc(clean)}" alt="${this.esc(label)}">`;
    documentPreviewModal.classList.add('show');
  },
  async review(action){
    if(!this.current)return;
    const note=reviewNote.value.trim();
    if((action==='Reject'||action==='Suspend')&&!note)return this.toast(`${action} reason is required.`);
    if(action==='Approve'&&(!this.current.AadhaarDocumentURL||!this.current.PANDocumentURL||!this.current.BankDocumentURL)){
      if(!confirm('Required documents appear incomplete. Approve anyway?'))return;
    }
    const buttonMap={Approve:approveSellerKyc,Reject:rejectSellerKyc,Suspend:suspendSeller,Reactivate:reactivateSeller};
    const btn=buttonMap[action];btn.disabled=true;
    const r=await DesiMallAPI.reviewSellerKYC({Token:this.token(),SellerID:this.current.SellerID,ReviewAction:action,KYCNotes:note});
    btn.disabled=false;this.toast(r.message||'Review updated.');
    if(r.success){sellerModal.classList.remove('show');await this.load();}
  }
};
document.addEventListener('DOMContentLoaded',()=>AdminKYCReview.init());