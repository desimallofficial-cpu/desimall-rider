const RiderSupport={
session:null,tickets:[],selected:'',ticketFile:null,replyFile:null,

esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));},
date(v){if(!v)return '—';const d=new Date(v);return Number.isNaN(d.getTime())?String(v):d.toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'short'});},
statusClass(v){return String(v||'Open').toLowerCase().replace(/[^a-z0-9]+/g,'-');},
supportName(r){return String(r?.SenderType||'').toLowerCase()==='admin'?'DesiMall Support':(r?.SenderName||r?.SenderType||'Support');},

async init(){
 this.session=JSON.parse(localStorage.getItem('desimall_rider_session')||'null');
 if(!this.session?.token){location.href='login.html';return;}
 riderName.textContent=this.session?.rider?.RiderName||this.session?.profile?.full_name||'Rider';
 logoutBtn.onclick=()=>{localStorage.removeItem('desimall_rider_session');location.href='login.html'};
 refreshRiderSupport.onclick=()=>this.load();
 newRiderTicket.onclick=()=>this.showModal();
 closeRiderTicket.onclick=()=>this.hideModal();
 cancelRiderTicket.onclick=()=>this.hideModal();
 riderTicketModal.onclick=e=>{if(e.target===riderTicketModal)this.hideModal()};
 document.addEventListener('keydown',e=>{if(e.key==='Escape')this.hideModal()});
 riderTicketForm.addEventListener('submit',e=>{e.preventDefault();this.create()});
 riderScreenshot.addEventListener('change',e=>this.pickTicketImage(e.target.files?.[0]||null));
 await this.load();
},

showModal(){
 this.ticketFile=null;
 riderScreenshot.value='';
 riderScreenshotPreview.innerHTML='';
 riderTicketModal.classList.add('show');
 riderTicketModal.setAttribute('aria-hidden','false');
 document.body.style.overflow='hidden';
 setTimeout(()=>riderSubject.focus(),60);
},
hideModal(){
 riderTicketModal.classList.remove('show');
 riderTicketModal.setAttribute('aria-hidden','true');
 document.body.style.overflow='';
},

updateCounts(){
 const statuses=this.tickets.map(t=>String(t.Status||'Open').toLowerCase());
 supportOpenCount.textContent=statuses.filter(x=>['open','waiting admin','waiting-admin','waiting_admin','waiting rider','waiting-rider','waiting_rider'].includes(x)).length;
 supportProgressCount.textContent=statuses.filter(x=>x.includes('progress')).length;
 supportResolvedCount.textContent=statuses.filter(x=>x==='resolved'||x==='closed').length;
},

async load(){
 refreshRiderSupport.disabled=true;refreshRiderSupport.textContent='Loading...';
 try{
  const r=await DesiMallAPI.getRiderSupport(this.session.token);
  if(!r.success)throw new Error(r.message||'Could not load support.');
  this.tickets=r.tickets||[];
  this.updateCounts();this.render();
  if(this.selected&&this.tickets.some(x=>x.TicketID===this.selected))await this.open(this.selected,true);
  else if(this.tickets.length&&innerWidth>1050)await this.open(this.tickets[0].TicketID,true);
 }catch(e){
  riderTicketList.innerHTML=`<div class="support-empty-pro"><strong>Support unavailable</strong><span>${this.esc(e.message)}</span></div>`;
 }finally{refreshRiderSupport.disabled=false;refreshRiderSupport.textContent='Refresh'}
},

render(){
 riderTicketList.innerHTML=this.tickets.length?this.tickets.map(t=>`
 <button type="button" class="ticket-pro-item ${this.selected===t.TicketID?'active':''}" onclick="RiderSupport.open('${this.esc(t.TicketID)}')">
  <div class="ticket-pro-top"><strong>${this.esc(t.TicketID)}</strong><span class="ticket-status status-${this.statusClass(t.Status)}">${this.esc(t.Status||'Open')}</span></div>
  <h3>${this.esc(t.Subject)}</h3>
  <div class="ticket-pro-meta"><span>${this.esc(t.Category||'Other')}</span><span>${this.esc(t.Priority||'Medium')} priority</span></div>
  <small class="ticket-list-time">Updated ${this.esc(this.date(t.UpdatedAt||t.CreatedAt))}</small>
 </button>`).join(''):`<div class="support-empty-pro"><div class="support-empty-icon">✓</div><strong>No support tickets</strong><span>Create a ticket whenever you need help.</span></div>`;
},

attachmentHtml(a){
 const url=String(a?.AttachmentURL||'').trim();if(!url)return '';
 const name=this.esc(a?.AttachmentName||'Problem screenshot');
 return `<a class="support-attachment" href="${this.esc(url)}" target="_blank" rel="noopener">
  <img src="${this.esc(url)}" alt="${name}" loading="lazy">
  <span><i class="fa-solid fa-paperclip"></i> ${name}</span>
 </a>`;
},

async open(id,skip=false){
 this.selected=id;this.replyFile=null;this.render();
 const t=this.tickets.find(x=>x.TicketID===id);if(!t)return;
 const replies=Array.isArray(t.Replies)?t.Replies:[];
 const reference=t.RelatedReturnCode||t.RelatedOrderCode||'—';
 const lastReply=t.LastReplyBy==='Admin'?'DesiMall Support':(t.LastReplyBy||'Rider');

 riderTicketDetail.className='support-detail-pane';
 riderTicketDetail.innerHTML=`
  <div class="ticket-detail-pro-head">
   <div><span class="support-kicker">${this.esc(t.TicketID)}</span><h2>${this.esc(t.Subject)}</h2><div class="ticket-pro-meta"><span>${this.esc(t.Category||'Other')}</span><span>${this.esc(t.Priority||'Medium')} priority</span></div></div>
   <span class="ticket-status status-${this.statusClass(t.Status)}">${this.esc(t.Status||'Open')}</span>
  </div>

  <div class="ticket-summary-grid">
   <div><small>Created</small><b>${this.esc(this.date(t.CreatedAt))}</b></div>
   <div><small>Last updated</small><b>${this.esc(this.date(t.UpdatedAt||t.CreatedAt))}</b></div>
   <div><small>Last reply by</small><b>${this.esc(lastReply)}</b></div>
   <div><small>Reference</small><b>${this.esc(reference)}</b></div>
  </div>

  <div class="ticket-description-pro">
   <span class="ticket-section-label">PROBLEM DESCRIPTION</span>
   ${this.esc(t.Description||'No description provided.')}
  </div>

  <div class="support-conversation-head"><b>Conversation</b><small>${replies.length} ${replies.length===1?'reply':'replies'}</small></div>
  <div class="support-chat-pro">${replies.length?replies.map(r=>`
   <div class="chat-pro ${String(r.SenderType||'').toLowerCase()==='rider'?'from-rider':'from-support'}">
    <div class="chat-pro-head"><strong>${this.esc(this.supportName(r))}</strong><small>${this.esc(this.date(r.CreatedAt||r.RepliedAt))}</small></div>
    <div>${this.esc(r.Message||'')}</div>
    ${this.attachmentHtml(r)}
   </div>`).join(''):'<div class="support-no-replies">No replies yet. Support team response will appear here.</div>'}</div>

  ${String(t.Status||'').toLowerCase()==='closed'?'':`
  <form class="support-reply-pro support-reply-inline" onsubmit="event.preventDefault();RiderSupport.reply()">
   <div class="support-reply-shell">
    <textarea id="riderReply" maxlength="1000" placeholder="Write a reply..."></textarea>
    <div id="riderReplyPreview" class="reply-inline-preview"></div>
    <div class="reply-inline-actions">
     <label class="reply-icon-btn" title="Attach screenshot" aria-label="Attach screenshot">
      <i class="fa-solid fa-paperclip"></i>
      <input id="riderReplyScreenshot" type="file" accept="image/jpeg,image/png,image/webp" hidden>
     </label>
     <button class="reply-send-icon" title="Send reply" aria-label="Send reply">
      <i class="fa-solid fa-paper-plane"></i>
     </button>
    </div>
   </div>
  </form>`}`;

 const replyInput=document.getElementById('riderReplyScreenshot');
 if(replyInput)replyInput.addEventListener('change',e=>this.pickReplyImage(e.target.files?.[0]||null));

 if(!skip&&t.LastReplyBy==='Admin'&&!t.RequesterSeenAt){
  try{await DesiMallAPI.markRiderSupportSeen({Token:this.session.token,TicketID:id});t.RequesterSeenAt=new Date().toISOString()}catch(_){}
 }
},

previewHtml(file,which){
 if(!file)return '';
 const url=URL.createObjectURL(file);
 return `<div class="selected-image-chip"><img src="${url}" alt="Selected screenshot"><span>${this.esc(file.name)}</span><button type="button" onclick="RiderSupport.removeImage('${which}')">×</button></div>`;
},

pickTicketImage(file){
 if(!file){this.ticketFile=null;riderScreenshotPreview.innerHTML='';return}
 if(!/^image\/(jpeg|png|webp)$/i.test(file.type)){alert('JPG, PNG ya WEBP image select karein.');riderScreenshot.value='';return}
 if(file.size>8*1024*1024){alert('Original screenshot 8 MB se chhota hona chahiye.');riderScreenshot.value='';return}
 this.ticketFile=file;riderScreenshotPreview.innerHTML=this.previewHtml(file,'ticket');
},
pickReplyImage(file){
 if(!file){this.replyFile=null;const p=document.getElementById('riderReplyPreview');if(p)p.innerHTML='';return}
 if(!/^image\/(jpeg|png|webp)$/i.test(file.type)){alert('JPG, PNG ya WEBP image select karein.');return}
 if(file.size>8*1024*1024){alert('Original screenshot 8 MB se chhota hona chahiye.');return}
 this.replyFile=file;const p=document.getElementById('riderReplyPreview');if(p)p.innerHTML=this.previewHtml(file,'reply');
},
removeImage(which){
 if(which==='ticket'){this.ticketFile=null;riderScreenshot.value='';riderScreenshotPreview.innerHTML=''}
 else{this.replyFile=null;const input=document.getElementById('riderReplyScreenshot');if(input)input.value='';const p=document.getElementById('riderReplyPreview');if(p)p.innerHTML=''}
},

async compressImage(file){
 const bitmap=await createImageBitmap(file);
 const maxDim=1400;
 const scale=Math.min(1,maxDim/Math.max(bitmap.width,bitmap.height));
 const canvas=document.createElement('canvas');
 canvas.width=Math.max(1,Math.round(bitmap.width*scale));
 canvas.height=Math.max(1,Math.round(bitmap.height*scale));
 const ctx=canvas.getContext('2d');
 ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);
 bitmap.close?.();

 let quality=.82,blob=null;
 for(let i=0;i<6;i++){
  blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',quality));
  if(blob&&blob.size<=850*1024)break;
  quality-=.10;
 }
 if(!blob)throw new Error('Screenshot compress nahi ho saka.');
 if(blob.size>950*1024)throw new Error('Screenshot compress hone ke baad bhi bahut bada hai.');
 return new File([blob],(file.name||'support').replace(/\.[^.]+$/,'')+'.jpg',{type:'image/jpeg'});
},

fileToDataUrl(file){
 return new Promise((resolve,reject)=>{
  const r=new FileReader();
  r.onload=()=>resolve(String(r.result||''));r.onerror=()=>reject(new Error('Screenshot read nahi ho saka.'));
  r.readAsDataURL(file);
 });
},

async uploadImage(file){
 if(!file)return {url:'',name:''};
 const compressed=await this.compressImage(file);
 const base64=await this.fileToDataUrl(compressed);
 const r=await DesiMallAPI.riderSupportImage({
  Token:this.session.token,
  FileName:compressed.name,
  MimeType:compressed.type,
  Base64Data:base64
 });
 if(!r?.success)throw new Error(r?.message||'Screenshot upload nahi ho saka.');
 return {url:r.ImageURL||r.imageUrl||'',name:r.FileName||r.fileName||compressed.name};
},

async create(){
 const submit=document.getElementById('submitRiderTicket');
 const msg=document.getElementById('riderTicketFormMsg');
 if(submit?.disabled)return;

 const category=String(riderCategory?.value||'').trim();
 const priority=String(riderPriority?.value||'Medium').trim();
 const reference=String(riderReference?.value||'').trim();
 const subject=String(riderSubject?.value||'').trim();
 const description=String(riderDescription?.value||'').trim();
 const show=(text,type='')=>{if(msg){msg.className=`support-form-msg ${type}`.trim();msg.textContent=text||''}};

 if(!category){show('Please select a category.','error');return}
 if(subject.length<3){show('Subject kam se kam 3 characters ka hona chahiye.','error');riderSubject.focus();return}
 if(description.length<3){show('Description kam se kam 3 characters ka hona chahiye.','error');riderDescription.focus();return}

 submit.disabled=true;submit.innerHTML='<i class="fa-solid fa-spinner fa-spin"></i> Submitting...';
 show(this.ticketFile?'Screenshot upload ho raha hai...':'Ticket submit ho raha hai...','loading');

 try{
  const media=await this.uploadImage(this.ticketFile);
  const isReturn=/return/i.test(category);
  const payload={
   Token:this.session.token,Category:category,Priority:priority,Subject:subject,Description:description,
   AttachmentURL:media.url,AttachmentName:media.name
  };
  if(reference){
   if(isReturn)payload.RelatedReturnCode=reference;
   else payload.RelatedOrderCode=reference;
  }

  const r=await DesiMallAPI.createRiderSupportTicket(payload);
  if(!r?.success)throw new Error(r?.message||'Ticket submit nahi ho saka.');

  show(`Ticket ${r.ticketId||''} successfully create ho gaya.`,'success');
  riderTicketForm.reset();this.ticketFile=null;riderScreenshotPreview.innerHTML='';
  this.selected=r.ticketId||'';
  await this.load();
  setTimeout(()=>{this.hideModal();show('')},700);
 }catch(e){
  console.error('Rider support create:',e);show(e?.message||'Ticket submit nahi ho saka. Please try again.','error');
 }finally{
  submit.disabled=false;submit.innerHTML='<i class="fa-solid fa-paper-plane"></i> Submit Ticket';
 }
},

async reply(){
 const box=document.getElementById('riderReply');
 const message=String(box?.value||'').trim();
 if(!message&&!this.replyFile){alert('Reply message likhein ya screenshot add karein.');return}

 const form=box?.closest('form');const btn=form?.querySelector('button.reply-send-icon');
 if(btn?.disabled)return;
 btn.disabled=true;btn.innerHTML='<i class="fa-solid fa-spinner fa-spin"></i>';

 try{
  const media=await this.uploadImage(this.replyFile);
  const r=await DesiMallAPI.riderSupportReply({
   Token:this.session.token,TicketID:this.selected,Message:message,
   AttachmentURL:media.url,AttachmentName:media.name
  });
  if(!r?.success)throw new Error(r?.message||'Reply failed.');
  this.replyFile=null;
  await this.load();
 }catch(e){alert(e?.message||'Reply failed.')}
 finally{if(document.body.contains(btn)){btn.disabled=false;btn.innerHTML='<i class="fa-solid fa-paper-plane"></i>'}}
}
};
document.addEventListener('DOMContentLoaded',()=>RiderSupport.init());