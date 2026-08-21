document.addEventListener('DOMContentLoaded',()=>AdminTez.init());

const AdminTez={
  data:{zones:[],sellers:[],products:[],stats:{}},

  esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));},
  money(v){return `₹${Number(v||0).toLocaleString('en-IN',{maximumFractionDigits:2})}`;},
  val(id){return document.getElementById(id)?.value||'';},
  num(id,fallback=0){const n=Number(this.val(id));return Number.isFinite(n)?n:fallback;},
  checked(id){return Boolean(document.getElementById(id)?.checked);},

  async init(){
    document.getElementById('refreshTez')?.addEventListener('click',()=>this.load());
    document.getElementById('sellerSearch')?.addEventListener('input',()=>this.renderSellers());
    document.getElementById('productSearch')?.addEventListener('input',()=>this.renderProducts());
    document.getElementById('productFilter')?.addEventListener('change',()=>this.renderProducts());
    await this.load();
  },

  async load(){
    this.busy(true);
    try{
      this.data=await DesiMallAPI.getAdminTez();
      this.renderStats();
      this.renderZones();
      this.renderSellers();
      this.renderProducts();
    }catch(error){
      this.toast(error?.message||'Could not load Tez management.');
    }finally{
      this.busy(false);
    }
  },

  busy(on){
    const btn=document.getElementById('refreshTez');
    if(btn){btn.disabled=on;btn.innerHTML=on?'<i class="fa-solid fa-spinner fa-spin"></i> Loading':'<i class="fa-solid fa-rotate"></i> Refresh';}
  },

  renderStats(){
    const s=this.data.stats||{};
    this.set('statZones',s.active_zones??s.zones??0);
    this.set('statCoverage',s.active_seller_coverages??0);
    this.set('statEnabled',s.enabled_products??0);
    this.set('statInStock',s.in_stock_products??0);
  },

  renderZones(){
    const root=document.getElementById('zoneContainer');
    const zones=this.data.zones||[];
    root.innerHTML=zones.length?zones.map(z=>`
      <article class="zone-card">
        <label>Zone name<input id="zoneName_${z.id}" value="${this.esc(z.zone_name)}"></label>
        <label>Pincode<input value="${this.esc(z.pincode)}" disabled></label>
        <label>Min delivery (min)<input id="zoneMin_${z.id}" type="number" min="5" value="${z.delivery_min_minutes}"></label>
        <label>Max delivery (min)<input id="zoneMax_${z.id}" type="number" min="5" value="${z.delivery_max_minutes}"></label>
        <label>Tez delivery fee (₹)<input id="zoneFee_${z.id}" type="number" min="0" step=".01" value="${z.delivery_fee}"></label>
        <label>Minimum order (₹)<input id="zoneMinOrder_${z.id}" type="number" min="0" step=".01" value="${z.minimum_order_value}"></label>
        <div>
          <label class="switch-wrap"><input id="zoneActive_${z.id}" type="checkbox" ${z.is_active?'checked':''}> Active</label>
          <button class="save-btn" onclick="AdminTez.saveZone('${z.id}')">Save Zone</button>
        </div>
      </article>
    `).join(''):'<div class="empty-row">No Tez zone configured.</div>';
  },

  sellerRows(){
    const q=this.val('sellerSearch').trim().toLowerCase();
    return (this.data.sellers||[]).filter(s=>{
      const text=`${s.shop_name} ${s.seller_code}`.toLowerCase();
      return !q||text.includes(q);
    });
  },

  renderSellers(){
    const body=document.getElementById('sellerCoverageBody');
    const zones=this.data.zones||[];
    const rows=[];

    this.sellerRows().forEach(seller=>{
      zones.forEach(zone=>{
        const cov=(seller.coverage||[]).find(c=>c.zone_id===zone.id)||{};
        const accountGood=String(seller.status).toLowerCase()==='active' &&
          ['approved','verified'].includes(String(seller.kyc_status).toLowerCase());

        rows.push(`<tr>
          <td><div class="seller-cell"><i class="fa-solid fa-shop"></i><div><strong>${this.esc(seller.shop_name)}</strong><div class="muted">${this.esc(seller.seller_code||seller.id)}</div></div></div></td>
          <td><span class="status-pill ${accountGood?'good':'bad'}">${this.esc(seller.status||'')} / ${this.esc(seller.kyc_status||'')}</span></td>
          <td>${this.esc(zone.zone_name)}<div class="muted">${this.esc(zone.pincode)}</div></td>
          <td><input class="table-input" id="prep_${seller.id}_${zone.id}" type="number" min="0" value="${Number(cov.preparation_minutes||10)}"></td>
          <td><input class="table-input" id="cap_${seller.id}_${zone.id}" type="number" min="1" value="${Number(cov.max_active_orders||20)}"></td>
          <td><input class="tez-toggle" id="cov_${seller.id}_${zone.id}" type="checkbox" ${cov.is_active?'checked':''} ${accountGood?'':'disabled'}></td>
          <td><button class="row-save" onclick="AdminTez.saveCoverage('${seller.id}','${zone.id}')">Save</button></td>
        </tr>`);
      });
    });

    body.innerHTML=rows.length?rows.join(''):'<tr><td colspan="7" class="empty-row">No sellers found.</td></tr>';
  },

  productRows(){
    const q=this.val('productSearch').trim().toLowerCase();
    const filter=this.val('productFilter')||'all';

    return (this.data.products||[]).filter(p=>{
      const text=`${p.name} ${p.sku} ${p.seller_name}`.toLowerCase();
      if(q&&!text.includes(q))return false;
      if(filter==='enabled'&&!p.tez_enabled)return false;
      if(filter==='disabled'&&p.tez_enabled)return false;
      if(filter==='stock'&&!(p.tez_enabled&&p.available_qty>=p.minimum_available_stock))return false;
      return true;
    });
  },

  renderProducts(){
    const body=document.getElementById('tezProductBody');
    const rows=this.productRows();

    body.innerHTML=rows.length?rows.map(p=>{
      const inStock=p.available_qty>=p.minimum_available_stock;
      return `<tr>
        <td><div class="product-cell-tez"><img src="${this.esc(p.image_url||'../assets/products/noimage.jpg')}" onerror="this.src='../assets/products/noimage.jpg'"><div><strong>${this.esc(p.name)}</strong><div class="muted">${this.esc(p.sku||p.id)} · ${this.money(p.selling_price)}</div></div></div></td>
        <td>${this.esc(p.seller_name)}</td>
        <td><span class="status-pill ${inStock?'good':'warn'}">${p.available_qty} available</span><div class="muted">${p.stock_qty} stock · ${p.reserved_qty} reserved</div></td>
        <td><input class="table-input" id="min_${p.id}" type="number" min="1" value="${p.minimum_available_stock}"></td>
        <td><input class="table-input" id="max_${p.id}" type="number" min="1" value="${p.max_qty_per_order}"></td>
        <td><input class="table-input" id="pri_${p.id}" type="number" min="1" value="${p.priority}"></td>
        <td><input class="tez-toggle" id="prod_${p.id}" type="checkbox" ${p.tez_enabled?'checked':''}></td>
        <td><button class="row-save" onclick="AdminTez.saveProduct('${p.id}')">Save</button></td>
      </tr>`;
    }).join(''):'<tr><td colspan="8" class="empty-row">No products found.</td></tr>';
  },

  async saveZone(zoneId){
    try{
      await DesiMallAPI.updateAdminTezZone(zoneId,{
        ZoneName:this.val(`zoneName_${zoneId}`),
        DeliveryMinMinutes:this.num(`zoneMin_${zoneId}`,20),
        DeliveryMaxMinutes:this.num(`zoneMax_${zoneId}`,45),
        DeliveryFee:this.num(`zoneFee_${zoneId}`,0),
        MinimumOrderValue:this.num(`zoneMinOrder_${zoneId}`,0),
        IsActive:this.checked(`zoneActive_${zoneId}`)
      });
      this.toast('Tez zone saved.');
      await this.load();
    }catch(error){this.toast(error?.message||'Zone save failed.');}
  },

  async saveCoverage(sellerId,zoneId){
    try{
      await DesiMallAPI.updateAdminTezCoverage({
        SellerID:sellerId,
        ZoneID:zoneId,
        PreparationMinutes:this.num(`prep_${sellerId}_${zoneId}`,10),
        MaxActiveOrders:this.num(`cap_${sellerId}_${zoneId}`,20),
        IsActive:this.checked(`cov_${sellerId}_${zoneId}`)
      });
      this.toast('Seller Tez coverage saved.');
      await this.load();
    }catch(error){this.toast(error?.message==='Failed to fetch'?'Backend connection failed. Confirm /health is v0.25.1 and redeploy.':(error?.message||'Seller coverage save failed.'));}
  },

  async saveProduct(productId){
    try{
      await DesiMallAPI.updateAdminTezProduct(productId,{
        IsEnabled:this.checked(`prod_${productId}`),
        MinimumAvailableStock:this.num(`min_${productId}`,1),
        MaxQtyPerOrder:this.num(`max_${productId}`,5),
        Priority:this.num(`pri_${productId}`,100)
      });
      this.toast('Product Tez rule saved.');
      await this.load();
    }catch(error){this.toast(error?.message==='Failed to fetch'?'Backend connection failed. Confirm /health is v0.25.1 and redeploy.':(error?.message||'Product Tez save failed.'));}
  },

  set(id,value){const el=document.getElementById(id);if(el)el.textContent=value;},
  toast(message){
    const el=document.getElementById('adminToast');
    if(!el)return;
    el.textContent=message;
    el.classList.add('show');
    clearTimeout(this._timer);
    this._timer=setTimeout(()=>el.classList.remove('show'),2200);
  }
};
