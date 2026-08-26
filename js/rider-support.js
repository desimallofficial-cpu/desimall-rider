const RiderSupport={
session:null,tickets:[],selected:'',

esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));},
date(v){if(!v)return '—';const d=new Date(v);return Number.isNaN(d.getTime())?String(v):d.toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'short'});},
statusClass(v){return String(v||'Open').toLowerCase().replace(/[^a-z0-9]+/g,'-');},

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
 riderTicketForm.onsubmit=e=>{e.preventDefault();this.create()};
 await this.load();
},

showModal(){riderTicketModal.classList.add('show');riderTicketModal.setAttribute('aria-hidden','false');document.body.style.overflow='hidden';setTimeout(()=>riderSubject.focus(),60)},
hideModal(){riderTicketModal.classList.remove('show');riderTicketModal.setAttribute('aria-hidden','true');document.body.style.overflow=''},

updateCounts(){
 const statuses=this.tickets.map(t=>String(t.Status||'Open').toLowerCase());
 supportOpenCount.textContent=statuses.filter(x=>['open','waiting admin','waiting-admin','waiting_admin'].includes(x)).length;
 supportProgressCount.textContent=statuses.filter(x=>x.includes('progress')).length;
 supportResolvedCount.textContent=statuses.filter(x=>x==='resolved'||x==='closed').length;
},

async load(){
 refreshRiderSupport.disabled=true;
 refreshRiderSupport.textContent='Loading...';
 try{
  const r=await DesiMallAPI.getRiderSupport(this.session.token);
  if(!r.success)throw new Error(r.message||'Could not load support.');
  this.tickets=r.tickets||[];
  this.updateCounts();
  this.render();
  if(this.selected&&this.tickets.some(x=>x.TicketID===this.selected))await this.open(this.selected,true);
  else if(this.tickets.length&&innerWidth>1050)await this.open(this.tickets[0].TicketID,true);
 }catch(e){
  riderTicketList.innerHTML=`<div class="support-empty-pro"><strong>Support unavailable</strong><span>${this.esc(e.message)}</span></div>`;
 }finally{
  refreshRiderSupport.disabled=false;
  refreshRiderSupport.textContent='Refresh';
 }
},

render(){
 riderTicketList.innerHTML=this.tickets.length?this.tickets.map(t=>`
 <button type="button" class="ticket-pro-item ${this.selected===t.TicketID?'active':''}" onclick="RiderSupport.open('${this.esc(t.TicketID)}')">
  <div class="ticket-pro-top"><strong>${this.esc(t.TicketID)}</strong><span class="ticket-status status-${this.statusClass(t.Status)}">${this.esc(t.Status||'Open')}</span></div>
  <h3>${this.esc(t.Subject)}</h3>
  <div class="ticket-pro-meta"><span>${this.esc(t.Category||'Other')}</span><span>${this.esc(t.Priority||'Medium')} priority</span></div>
 </button>`).join(''):`<div class="support-empty-pro"><div class="support-empty-icon">✓</div><strong>No support tickets</strong><span>Create a ticket whenever you need help.</span></div>`;
},

async open(id,skip=false){
 this.selected=id;this.render();
 const t=this.tickets.find(x=>x.TicketID===id);if(!t)return;
 const replies=Array.isArray(t.Replies)?t.Replies:[];
 riderTicketDetail.className='support-detail-pane';
 riderTicketDetail.innerHTML=`
  <div class="ticket-detail-pro-head">
   <div><span class="support-kicker">${this.esc(t.TicketID)}</span><h2>${this.esc(t.Subject)}</h2><div class="ticket-pro-meta"><span>${this.esc(t.Category||'Other')}</span><span>${this.esc(t.Priority||'Medium')} priority</span></div></div>
   <span class="ticket-status status-${this.statusClass(t.Status)}">${this.esc(t.Status||'Open')}</span>
  </div>
  <div class="ticket-description-pro">${this.esc(t.Description||'No description provided.')}</div>
  <div class="support-conversation-head"><b>Conversation</b><small>${replies.length} ${replies.length===1?'reply':'replies'}</small></div>
  <div class="support-chat-pro">${replies.length?replies.map(r=>`
   <div class="chat-pro ${String(r.SenderType||'').toLowerCase()==='rider'?'from-rider':'from-support'}">
    <div class="chat-pro-head"><strong>${this.esc(r.SenderName||r.SenderType||'Support')}</strong><small>${this.esc(this.date(r.CreatedAt||r.RepliedAt))}</small></div>
    <div>${this.esc(r.Message)}</div>
   </div>`).join(''):'<div class="support-no-replies">No replies yet. Support team response will appear here.</div>'}</div>
  ${String(t.Status||'').toLowerCase()==='closed'?'':`
  <form class="support-reply-pro" onsubmit="event.preventDefault();RiderSupport.reply()">
   <textarea id="riderReply" maxlength="1000" required placeholder="Write a reply..."></textarea>
   <button class="r-btn">Send Reply</button>
  </form>`}`;

 if(!skip&&t.LastReplyBy==='Admin'&&!t.RequesterSeenAt){
  try{await DesiMallAPI.markRiderSupportSeen({Token:this.session.token,TicketID:id});t.RequesterSeenAt=new Date().toISOString()}catch(_){}
 }
},

async create(){
 const submit=riderTicketForm.querySelector('button[type="submit"]');
 submit.disabled=true;submit.textContent='Submitting...';
 try{
  const r=await DesiMallAPI.createRiderSupportTicket({
   Token:this.session.token,Category:riderCategory.value,Priority:riderPriority.value,
   Subject:riderSubject.value.trim(),Description:riderDescription.value.trim()
  });
  if(!r.success)throw new Error(r.message||'Ticket failed.');
  riderTicketForm.reset();this.hideModal();this.selected=r.ticketId;await this.load();
 }catch(e){alert(e.message)}
 finally{submit.disabled=false;submit.textContent='Submit Ticket'}
},

async reply(){
 const box=document.getElementById('riderReply');const msg=box?.value.trim();if(!msg)return;
 const btn=box.closest('form').querySelector('button');btn.disabled=true;btn.textContent='Sending...';
 try{
  const r=await DesiMallAPI.riderSupportReply({Token:this.session.token,TicketID:this.selected,Message:msg});
  if(!r.success)throw new Error(r.message||'Reply failed.');
  await this.load();
 }catch(e){alert(e.message)}
 finally{if(document.body.contains(btn)){btn.disabled=false;btn.textContent='Send Reply'}}
}
};
document.addEventListener('DOMContentLoaded',()=>RiderSupport.init());