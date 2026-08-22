const AdminProducts={
token(){
  try{
    return JSON.parse(localStorage.getItem('desimall_admin_session')||'null')?.token||'';
  }catch(_){return '';}
},
products:[],timer:null,flashProductId:null,
esc(v){return String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));},
async init(){this.bind();await this.load();},
bind(){
['productSearch','approvalFilter','categoryFilter'].forEach(id=>document.getElementById(id).addEventListener(id==='productSearch'?'input':'change',()=>this.loadDebounced()));
document.getElementById('refreshProducts').onclick=()=>this.load();
document.getElementById('closeDetail').onclick=()=>document.getElementById('productDetailModal').classList.remove('show');
document.getElementById('closeFlash').onclick=()=>document.getElementById('flashSaleModal').classList.remove('show');
document.getElementById('saveFlashSale').onclick=()=>this.saveFlashSale();
},
loadDebounced(){clearTimeout(this.timer);this.timer=setTimeout(()=>this.load(),250);},
async load(){
const b=document.getElementById('adminProductBody');b.innerHTML='<tr><td colspan="8">Loading products...</td></tr>';
const r=await DesiMallAPI.getAdminProducts({search:document.getElementById('productSearch').value,approval:document.getElementById('approvalFilter').value,category:document.getElementById('categoryFilter').value},this.token());
if(!r.success){b.innerHTML=`<tr><td colspan="8">${this.esc(r.message||'Could not load products.')}</td></tr>`;return;}
this.products=r.products||[];this.renderStats(r.stats||{});this.fillCategories();this.render();
},
renderStats(s){['Total','Pending','Approved','Rejected','Hidden','Featured','Flash'].forEach(k=>document.getElementById('st'+k).textContent=Number(s[k.toLowerCase()]||0));},
fillCategories(){
const sel=document.getElementById('categoryFilter'),cur=sel.value,cats=[...new Set(this.products.map(p=>String(p.Category||'').trim()).filter(Boolean))].sort(),old=[...sel.options].map(o=>o.value);
cats.forEach(c=>{if(!old.includes(c)){const o=document.createElement('option');o.value=c;o.textContent=c;sel.appendChild(o);}});
sel.value=cur;
},
render(){
const b=document.getElementById('adminProductBody');
if(!this.products.length){b.innerHTML='<tr><td colspan="8"><div class="empty">No matching products.</div></td></tr>';return;}
b.innerHTML=this.products.map(p=>this.row(p)).join('');
},
row(p){
const a=String(p.ApprovalStatus||'Pending'),cls=a.toLowerCase(),status=String(p.Status||'Pending');
const featured=p.IsFeatured===true||String(p.IsFeatured).toLowerCase()==='true';
const flash=p.IsFlashSale===true||String(p.IsFlashSale).toLowerCase()==='true';
const flashEnd=p.FlashSaleEnd?new Date(p.FlashSaleEnd):null, flashStart=p.FlashSaleStart?new Date(p.FlashSaleStart):null, now=new Date();
const flashLive=flash&&flashStart<=now&&now<flashEnd;
return `<tr>
<td><div class="product-cell"><img src="${this.esc(p.ImageURL||'../assets/products/noimage.jpg')}" onerror="this.src='../assets/products/noimage.jpg'"><div><strong>${this.esc(p.ProductName||'Product')}</strong><div class="muted">${this.esc(p.ProductID||'')}</div></div></div></td>
<td><strong>${this.esc(p.ShopName||p.Seller||'')}</strong><div class="muted">${this.esc(p.SellerName||p.SellerID||'')}</div></td>
<td>${this.esc(p.Category||'General')}<div class="muted">${this.esc(p.SKU||'')}</div></td>
<td><strong>₹${Number(p.FinalPrice||p.Price||0).toLocaleString('en-IN')}</strong><div class="muted">MRP ₹${Number(p.Price||0).toLocaleString('en-IN')} • Stock ${Number(p.Stock||0)}</div></td>
<td><span class="badge ${cls}">${this.esc(a)}</span>${p.ApprovalReason?`<div class="muted">${this.esc(p.ApprovalReason)}</div>`:''}</td>
<td><span class="badge ${status.toLowerCase()==='active'?'approved':'inactive'}">${this.esc(status)}</span></td>
<td>${featured?'<span class="badge approved">Featured</span>':''} ${flash?`<span class="badge pending">${flashLive?'Flash Live':'Flash Scheduled'}</span><div class="muted">₹${Number(p.FlashSalePrice||0).toLocaleString('en-IN')} • ${this.esc(p.FlashSaleEnd||'')}</div>`:''}</td>
<td><div class="actions">
<button class="view" onclick="AdminProducts.view('${this.esc(p.ProductID)}')">View</button>
${a.toLowerCase()!=='approved'?`<button class="approve" onclick="AdminProducts.action('${this.esc(p.ProductID)}','Approve')">Approve</button>`:''}
<button class="reject" onclick="AdminProducts.reject('${this.esc(p.ProductID)}')">Reject</button>
<button class="hide" onclick="AdminProducts.action('${this.esc(p.ProductID)}','${status.toLowerCase()==='active'?'Hide':'Activate'}')">${status.toLowerCase()==='active'?'Hide':'Activate'}</button>
<button class="feature" onclick="AdminProducts.action('${this.esc(p.ProductID)}','SetFeatured',${!featured})">${featured?'Unfeature':'Feature'}</button>
<button class="flash" onclick="${flash?`AdminProducts.removeFlashSale('${this.esc(p.ProductID)}')`:`AdminProducts.openFlashSale('${this.esc(p.ProductID)}')`}">${flash?'Remove Flash':'Flash Sale'}</button>
</div></td></tr>`;
},
async action(id,action,value){
let note='';if(['Approve','Hide','Activate'].includes(action))note=prompt('Optional moderation note:','')??'';
const r=await DesiMallAPI.moderateAdminProduct({Token:this.token(),ProductID:id,ModerationAction:action,Value:value,Note:note});
this.toast(r.message||'Updated.');if(r.success)await this.load();
},
async reject(id){
const reason=prompt('Rejection reason (required):','Incomplete or incorrect product information');
if(reason===null)return;if(!reason.trim())return this.toast('Rejection reason is required.');
const note=prompt('Optional internal moderation note:','')??'';
const r=await DesiMallAPI.moderateAdminProduct({Token:this.token(),ProductID:id,ModerationAction:'Reject',Reason:reason.trim(),Note:note});
this.toast(r.message||'Updated.');if(r.success)await this.load();
},
openFlashSale(id){
const p=this.products.find(x=>String(x.ProductID)===String(id));if(!p)return;
if(String(p.ApprovalStatus||'').toLowerCase()!=='approved'||String(p.Status||'').toLowerCase()!=='active')return this.toast('Approve and activate the product first.');
this.flashProductId=id;document.getElementById('flashProductName').textContent=p.ProductName||id;
document.getElementById('regularSalePrice').value=Number(p.FinalPrice||p.Price||0);
document.getElementById('flashSalePrice').value=p.FlashSalePrice||'';
const local=v=>{if(!v)return'';const d=new Date(v),off=d.getTimezoneOffset();return new Date(d.getTime()-off*60000).toISOString().slice(0,16)};
const start=p.FlashSaleStart||new Date(Date.now()+5*60000).toISOString();const end=p.FlashSaleEnd||new Date(Date.now()+24*3600000).toISOString();
document.getElementById('flashSaleStart').value=local(start);document.getElementById('flashSaleEnd').value=local(end);document.getElementById('flashSaleModal').classList.add('show');
},
async saveFlashSale(){
const price=Number(document.getElementById('flashSalePrice').value),start=document.getElementById('flashSaleStart').value,end=document.getElementById('flashSaleEnd').value;
if(!price||!start||!end)return this.toast('Flash price, start and end are required.');
const r=await DesiMallAPI.moderateAdminProduct({Token:this.token(),ProductID:this.flashProductId,ModerationAction:'SetFlashSale',Value:true,FlashSalePrice:price,FlashSaleStart:new Date(start).toISOString(),FlashSaleEnd:new Date(end).toISOString()});
this.toast(r.message||'Updated.');if(r.success){document.getElementById('flashSaleModal').classList.remove('show');await this.load();}
},
async removeFlashSale(id){if(!confirm('Remove this product from Flash Sale?'))return;const r=await DesiMallAPI.moderateAdminProduct({Token:this.token(),ProductID:id,ModerationAction:'SetFlashSale',Value:false});this.toast(r.message||'Updated.');if(r.success)await this.load();},
async view(id){
const p=this.products.find(x=>String(x.ProductID)===String(id));if(!p)return;
const hist=await DesiMallAPI.getProductModerationHistory(id,this.token());
const history=(hist.history||[]).map(h=>`<div class="history-item"><strong>${this.esc(h.Action||'Update')}</strong> • ${this.esc(h.NewApprovalStatus||'')}<div class="muted">${this.esc(h.Reason||h.Note||'No note')} • ${this.esc(h.CreatedAt||'')}</div></div>`).join('')||'<div class="muted">No moderation history yet.</div>';
document.getElementById('productDetailContent').innerHTML=`<div class="detail-grid"><div><img class="detail-img" src="${this.esc(p.ImageURL||'../assets/products/noimage.jpg')}"></div><div><h2>${this.esc(p.ProductName)}</h2><p>${this.esc(p.Description||'No description')}</p><p><strong>Seller:</strong> ${this.esc(p.ShopName||p.Seller||'')}</p><p><strong>Price:</strong> ₹${Number(p.FinalPrice||p.Price||0).toLocaleString('en-IN')} / MRP ₹${Number(p.Price||0).toLocaleString('en-IN')}</p><p><strong>Stock:</strong> ${Number(p.Stock||0)}</p><p><strong>Approval:</strong> ${this.esc(p.ApprovalStatus||'Pending')}</p></div><div class="full"><h3>Moderation History</h3><div class="history">${history}</div></div></div>`;
document.getElementById('productDetailModal').classList.add('show');
},
toast(msg){const e=document.getElementById('panelToast');e.textContent=msg;e.classList.add('show');setTimeout(()=>e.classList.remove('show'),3000);}
};
document.addEventListener('DOMContentLoaded',()=>AdminProducts.init());