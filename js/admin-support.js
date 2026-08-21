const AdminSupport={
tickets:[],selectedId:'',pollTimer:null,role:'',
token(){try{return JSON.parse(localStorage.getItem('desimall_admin_session')||'null')?.token||''}catch(_){return''}},
esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));},
date(v){const d=new Date(v);return isNaN(d)?String(v||'—'):d.toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'short'});},
toast(m){adminToast.textContent=m;adminToast.classList.add('show');setTimeout(()=>adminToast.classList.remove('show'),2400);},
init(){
 refreshAdminSupport.onclick=()=>this.load();
 adminSupportSearch.oninput=()=>this.load();
 adminSupportStatus.onchange=()=>this.load();
 adminSupportPriority.onchange=()=>this.load();
 document.querySelectorAll('.support-type-tabs button').forEach(b=>b.onclick=()=>{
   document.querySelectorAll('.support-type-tabs button').forEach(x=>x.classList.remove('active'));b.classList.add('active');this.role=b.dataset.role||'';this.load();
 });
 this.load();this.startPolling();
 document.addEventListener('visibilitychange',()=>{if(document.hidden)this.stopPolling();else{this.startPolling();this.load(true);}});
},
async load(silent=false){
 const r=await DesiMallAPI.getAdminSupport({
   search:adminSupportSearch.value,status:adminSupportStatus.value,
   priority:adminSupportPriority.value,role:this.role
 },this.token());
 if(!r.success){adminSupportLive.innerHTML='<i class="fa-solid fa-circle"></i> Offline';if(!silent)this.toast(r.message||'Tickets could not be loaded.');return;}
 adminSupportLive.innerHTML='<i class="fa-solid fa-circle"></i> Live';this.tickets=r.tickets||[];
 const s=r.stats||{};aSupportTotal.textContent=s.total||0;aSupportUnread.textContent=s.unread||0;aSupportUrgent.textContent=s.urgent||0;aSupportResolved.textContent=s.resolved||0;
 this.renderList();if(this.selectedId&&this.tickets.some(x=>x.TicketID===this.selectedId))this.open(this.selectedId,true);else{this.selectedId='';}
},
renderList(){adminTicketList.innerHTML=this.tickets.length?this.tickets.map(t=>`<article class="ticket-item ${this.selectedId===t.TicketID?'active':''} ${t.LastReplyBy!=='Admin'&&!t.AdminSeenAt?'unread':''}" onclick="AdminSupport.open('${this.esc(t.TicketID)}')"><div class="ticket-row"><strong>${this.esc(t.TicketID)}</strong><span class="ticket-badge status-${String(t.Status).replaceAll(' ','-')}">${this.esc(t.Status)}</span></div><h3>${this.esc(t.Subject)}</h3><div class="ticket-meta"><span class="user-type">${this.esc(t.UserType)}</span><span>${this.esc(t.RequesterName||'User')}</span><span>${this.esc(t.Category)}</span><span class="ticket-badge priority-${this.esc(t.Priority)}">${this.esc(t.Priority)}</span></div></article>`).join(''):'<div class="support-empty"><i class="fa-solid fa-ticket"></i><strong>No support tickets</strong><span>Customer, Seller or Rider tickets will appear here.</span></div>';},
async open(id,skipSeen=false){
 this.selectedId=id;this.renderList();const t=this.tickets.find(x=>x.TicketID===id);if(!t)return;
 const wait=t.RequesterRole==='seller'?'Waiting Seller':t.RequesterRole==='rider'?'Waiting Rider':'Waiting Customer';
 adminTicketDetail.innerHTML=`<div class="ticket-detail-head"><div><h2>${this.esc(t.Subject)}</h2><div class="ticket-meta"><strong>${this.esc(t.TicketID)}</strong><span class="user-type">${this.esc(t.UserType)}</span><span>${this.esc(t.RequesterName)}</span><span>${this.esc(t.RequesterMobile)}</span><span>${this.esc(t.RequesterContext)}</span><span>${this.esc(t.Category)}</span></div></div><span class="ticket-badge status-${String(t.Status).replaceAll(' ','-')}">${this.esc(t.Status)}</span></div>
 <div class="ticket-description">${this.esc(t.Description)}</div>
 ${(t.RelatedOrderCode||t.RelatedReturnCode)?`<div class="ticket-meta"><span>Order: ${this.esc(t.RelatedOrderCode||'—')}</span><span>Return: ${this.esc(t.RelatedReturnCode||'—')}</span></div>`:''}
 <div class="support-chat" id="adminSupportChat">${(t.Replies||[]).map(r=>`<div class="chat-message ${r.SenderType==='Admin'?'seller':'admin'}"><strong>${this.esc(r.SenderName||r.SenderType)}</strong><div>${this.esc(r.Message)}</div>${r.AttachmentURL?`<a class="attachment-link" href="${this.esc(r.AttachmentURL)}" target="_blank">Attachment</a>`:''}<small>${this.date(r.CreatedAt)}</small></div>`).join('')}</div>
 ${t.Status==='Closed'?'<div class="support-empty"><strong>Ticket closed</strong></div>':`<form onsubmit="event.preventDefault();AdminSupport.reply()"><div class="form-grid"><div class="field"><label>Status</label><select id="adminReplyStatus"><option>${wait}</option><option>In Progress</option><option>Resolved</option><option>Closed</option></select></div><div class="field"><label>Priority</label><select id="adminReplyPriority"><option ${t.Priority==='Low'?'selected':''}>Low</option><option ${t.Priority==='Medium'?'selected':''}>Medium</option><option ${t.Priority==='High'?'selected':''}>High</option><option ${t.Priority==='Urgent'?'selected':''}>Urgent</option></select></div><div class="field full"><label>Reply</label><div class="chat-tools"><textarea id="adminReplyMessage" rows="4" required placeholder="Write support reply..."></textarea><button class="a-btn primary"><i class="fa-solid fa-paper-plane"></i> Send</button></div></div></div></form>`}`;
 requestAnimationFrame(()=>{const box=document.getElementById('adminSupportChat');if(box)box.scrollTop=box.scrollHeight;});
 if(!skipSeen&&t.LastReplyBy!=='Admin'&&!t.AdminSeenAt){await DesiMallAPI.markAdminSupportSeen({Token:this.token(),TicketID:id});t.AdminSeenAt=new Date().toISOString();this.renderList();}
},
startPolling(){this.stopPolling();this.pollTimer=setInterval(()=>{if(!document.hidden)this.load(true);},15000);},
stopPolling(){if(this.pollTimer){clearInterval(this.pollTimer);this.pollTimer=null;}},
async reply(){
 const r=await DesiMallAPI.adminSupportReply({
   Token:this.token(),TicketID:this.selectedId,Message:adminReplyMessage.value,
   Status:adminReplyStatus.value,Priority:adminReplyPriority.value,AdminName:'DesiMall Support'
 });
 if(!r.success){this.toast(r.message||'Reply failed.');return;}this.toast(r.message);await this.load();
}
};
document.addEventListener('DOMContentLoaded',()=>AdminSupport.init());