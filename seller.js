const SellerPanel = {
  products: [],
  selectedImageFile: null,
  selectedIds: new Set(),
  sessionKey: 'desimall_seller_session',
  session: null,
  marketplaceSettings: null,
  pricingRule: null,
  wizardStep: 1,
  draftKey: 'desimall_product_draft_v2',

  async init() {
    const allowed = await this.requireSession();
    if (!allowed) return;
    this.bind();

    // Saved catalogue ko turant dikhayein; backend response ka wait na karayein.
    this.products = this.readCache();
    if (this.products.length) this.render();

    // Product/stock sabse pehle load hoga.
    await this.loadProducts();
    this.render();

    // Pricing/upload checks background me; stock loading ko block nahi karenge.
    this.loadMarketplaceSettings().then(() => {
      this.updateUnitPreview();
      this.updatePricingPreview();
    }).catch(() => {});
    DesiMallAPI.getUploadStatus(this.session.token).then(uploadStatus => {
      if (!uploadStatus.success && document.body?.dataset?.sellerPage === 'products') {
        this.toast(uploadStatus.message || 'Drive upload backend is not ready.');
      }
    }).catch(() => {});
  },

  bind() {
    const on=(id,event,fn)=>{const el=document.getElementById(id);if(el)el.addEventListener(event,fn);};
    on('openProductModal','click',()=>this.open());
    on('closeProductModal','click',()=>this.close());
    on('productModal','click',e=>{if(e.target.id==='productModal')this.close();});
    on('productForm','submit',e=>{e.preventDefault();this.submit();});
    on('sellerSearch','input',()=>this.render());
    on('sellerStatusFilter','change',()=>this.render());
    on('pfImageFile','change',e=>this.chooseImage(e.target.files?.[0]));
    on('pfUnit','change',()=>{this.updateUnitPreview();this.saveDraft();});
    on('pfUnitValue','input',()=>{this.updateUnitPreview();this.saveDraft();});
    on('pfMrp','input',()=>{this.updatePricingPreview();this.saveDraft();});
    on('pfSettlement','input',()=>{this.updatePricingPreview();this.saveDraft();});
    on('sellerLogout','click',()=>this.logout());
    on('selectAllProducts','change',e=>this.selectAll(e.target.checked));
    on('clearSelection','click',()=>this.clearSelection());
    on('applyBulk','click',()=>this.applyBulk());
    on('wizardNext','click',()=>this.nextStep());
    on('wizardBack','click',()=>this.prevStep());
    document.querySelectorAll('#categoryCards [data-category]').forEach(btn=>btn.onclick=()=>this.setCategory(btn.dataset.category));
    document.querySelectorAll('#productWizardSteps [data-step]').forEach(x=>x.onclick=()=>{const n=Number(x.dataset.step);if(n<=this.wizardStep)this.goStep(n);});
    document.querySelectorAll('#productForm input,#productForm select,#productForm textarea').forEach(el=>{
      if(!['file','hidden'].includes(el.type))el.addEventListener('input',()=>this.saveDraft());
    });
    document.querySelectorAll('.coming-soon').forEach(link=>link.onclick=e=>{e.preventDefault();this.toast('ई सुविधा अगिला phase में आई।');});
  },

  el(id){return document.getElementById(id);},
  value(id,fallback=''){const el=this.el(id);return el?String(el.value??fallback):String(fallback);},
  number(id,fallback=0){const n=Number(this.value(id,fallback));return Number.isFinite(n)?n:Number(fallback||0);},
  setValue(id,value=''){const el=this.el(id);if(el)el.value=value??'';},
  setText(id,value=''){const el=this.el(id);if(el)el.textContent=value??'';},

  readSession() { try { return JSON.parse(localStorage.getItem(this.sessionKey)) || {}; } catch (_) { return {}; } },

  async requireSession() {
    this.session=this.readSession();
    if(!this.session.token){window.location.replace('login.html');return false;}
    const seller=this.session.seller||{};
    document.getElementById('sellerWelcome').textContent=`${seller.ShopName||seller.SellerName||'Seller'} • Products and inventory are loading...`;
    return true;
  },

  async logout() {
    const token = this.session?.token || '';
    localStorage.removeItem(this.sessionKey);
    if (token) await DesiMallAPI.sellerLogout(token);
    window.location.replace('login.html');
  },

  async loadProducts() {
    const result = await DesiMallAPI.getSellerProducts(this.session.token);
    if (result.success && Array.isArray(result.products)) {
      this.products = result.products;
      if(result.seller){this.session.seller=result.seller;this.session.verifiedAt=Date.now();localStorage.setItem(this.sessionKey,JSON.stringify(this.session));if(typeof SellerShell!=='undefined')SellerShell.apply(result.seller);}
      this.cache();
    } else {
      this.products = this.readCache();
      this.toast(result.message || 'Backend unavailable. Showing cached catalogue.');
    }
  },

  readCache() {
    try {
      const sellerId = this.session?.seller?.SellerID || 'current';
      const candidates = [
        localStorage.getItem(`desimall_seller_products_${sellerId}`),
        localStorage.getItem('desimall_seller_products'),
        localStorage.getItem('desimall_cached_products')
      ];
      for (const raw of candidates) {
        const data = JSON.parse(raw || '[]');
        if (Array.isArray(data) && data.length) return data;
      }
      return [];
    } catch (_) { return []; }
  },
  cache() {
    const sellerId = this.session?.seller?.SellerID || 'current';
    localStorage.setItem(`desimall_seller_products_${sellerId}`, JSON.stringify(this.products));
    localStorage.setItem('desimall_seller_products', JSON.stringify(this.products));
    localStorage.setItem('desimall_cached_products', JSON.stringify(this.products.filter(p => String(p.Status || '').toLowerCase() === 'active')));
  },

  updateUnitPreview() {
    const unit=this.value('pfUnit','Piece'), value=this.value('pfUnitValue','1');
    this.setValue('pfUnitPreview',`${value} ${unit}`);
  },

  async loadMarketplaceSettings() {
    const r = await DesiMallAPI.getMarketplaceSettings(this.session.token);
    if (r.success) { this.marketplaceSettings = r.settings || {}; this.pricingRule = r.pricingRule || null; }
    else this.marketplaceSettings = {DefaultCommissionPercent:2,ProcessingFeePercent:1,ProcessingFeeFixed:2,CustomerLogisticsFee:40,CODCharge:0};
  },

  money(value) { return `₹${Number(value || 0).toLocaleString('en-IN',{maximumFractionDigits:2})}`; },

  calculateLocalPricing(settlement) {
    const s=this.marketplaceSettings||{}, rule=this.pricingRule||{};
    const rate=Number(rule.rate ?? s.DefaultCommissionPercent ?? 2);
    const feePercent=Number(s.ProcessingFeePercent||1), feeFixed=Number(s.ProcessingFeeFixed||2);
    const deliveryPerOrder=Number(s.DeliveryChargePerOrder ?? s.CustomerLogisticsFee ?? 40);
    const commission=Math.round(Number(settlement||0)*rate)/100;
    const fees=Number(settlement)>0?Math.round((Number(settlement)*feePercent/100+feeFixed)*100)/100:0;
    const sellerPrice=Math.round((Number(settlement||0)+commission+fees)*100)/100;
    // Delivery/COD are order-level charges. Never add them to each product.
    const listing=sellerPrice;
    return {settlement:Number(settlement||0),rate,commission,fees,sellerPrice,deliveryPerOrder,logistics:0,listing,source:rule.source||'Marketplace Default'};
  },

  updatePricingPreview() {
    const mrp=this.number('pfMrp'), settlement=this.number('pfSettlement');
    const p=this.calculateLocalPricing(settlement);
    this.setText('pfSettlementOut',this.money(p.settlement));this.setText('pfCommissionRate',`(${p.rate}%)`);
    this.setText('pfCommissionOut',`+${this.money(p.commission)}`);this.setText('pfFeesOut',`+${this.money(p.fees)}`);
    this.setText('pfSellerPriceOut',this.money(p.sellerPrice));this.setText('pfLogisticsOut','Checkout पर अलग');
    this.setText('pfListingOut',this.money(p.listing));this.setText('pfCommissionSource',p.source);this.setValue('pfPrice',p.listing||'');
    const warning=this.el('pfPricingWarning');
    if(warning){
      if(!(settlement>0)||!(mrp>0)){warning.textContent='MRP और settlement भरें।';warning.className='spv2-warning';}
      else if(p.listing>mrp){warning.textContent=`Customer price ${this.money(p.listing)} MRP से अधिक है। MRP बढ़ाईं या settlement घटाईं।`;warning.className='spv2-warning bad';}
      else{warning.textContent=`Product price ${this.money(p.listing)} रहेगा। Delivery charge पूरे order पर checkout में अलग लगेगा। रउआ के ${this.money(p.settlement)} मिली।`;warning.className='spv2-warning good';}
    }
    this.updateFinalPreview();
  },

  chooseImage(file) {
    if(!file)return;
    try {
      DesiMallUpload.validate(file);this.selectedImageFile=file;
      const preview=this.el('pfImagePreview');if(preview)DesiMallUpload.preview(file,preview);
      this.setText('pfImageStatus',`${file.name} (${(file.size/1024/1024).toFixed(2)} MB) • सेव करते समय upload होगा`);
      this.saveDraft();this.updateFinalPreview();
    } catch(error){this.selectedImageFile=null;this.setValue('pfImageFile','');this.toast(error.message);}
  },

  filteredProducts() {
    const q=this.value('sellerSearch').toLowerCase().trim();
    const filter=this.value('sellerStatusFilter');
    return this.products.filter(p => {
      const stock = Number(p.Stock || 0);
      const status = String(p.Status || '').trim().toLowerCase();
      const matchesText = `${p.ProductName || ''} ${p.Category || ''} ${p.SKU || ''} ${p.ProductID || ''}`.toLowerCase().includes(q);
      let matchesFilter = true;
      if (filter === 'out') matchesFilter = stock === 0;
      else if (filter === 'low') matchesFilter = stock > 0 && stock <= 5;
      else if (filter) matchesFilter = status === filter;
      return matchesText && matchesFilter;
    });
  },

  render() {
    const list = this.filteredProducts();
    const active = this.products.filter(p => String(p.Status || '').trim().toLowerCase() === 'active').length;
    const pending = this.products.filter(p => String(p.Status || '').trim().toLowerCase() === 'pending').length;
    const inactive = this.products.filter(p => String(p.Status || '').trim().toLowerCase() === 'inactive').length;
    const stock = this.products.reduce((s,p) => s + Number(p.Stock || 0), 0);
    const reserved = this.products.reduce((s,p) => s + Number(p.ReservedStock || 0), 0);
    const sold = this.products.reduce((s,p) => s + Number(p.SoldQty || 0), 0);
    const out = this.products.filter(p => Number(p.Stock || 0) === 0).length;
    const low = this.products.filter(p => Number(p.Stock || 0) <= 5).length;
    const value = this.products.reduce((s,p) => s + Number(p.FinalPrice || p.Price || 0) * Number(p.Stock || 0), 0);

    const setText=(id,value)=>{const el=document.getElementById(id);if(el)el.textContent=value;};
    setText('sellerProductCount', this.products.length);
    setText('sellerActiveCount', active);
    setText('sellerPendingCount', pending);
    setText('sellerInactiveCount', inactive);
    setText('sellerStockCount', stock);
    setText('sellerLowStock', low);
    setText('sellerSoldCount', sold);
    setText('sellerValue', `₹${value.toLocaleString('en-IN')}`);
    setText('inventoryAvailable', Math.max(0, stock - reserved));
    setText('inventoryReserved', reserved);
    setText('inventorySold', sold);
    setText('inventoryOut', out);

    document.getElementById('sellerProductBody').innerHTML = list.length ? list.map(p => this.rowHtml(p)).join('') : '<tr><td colspan="8" class="empty-panel">No products found.</td></tr>';
    document.querySelectorAll('.product-select').forEach(cb => cb.checked = this.selectedIds.has(cb.value));
    this.updateSelectionUi();
  },

  rowHtml(p) {
    const id = String(p.ProductID || p.ID || '');
    const stock = Number(p.Stock || 0), reserved = Number(p.ReservedStock || 0), sold = Number(p.SoldQty || 0);
    const mrp = Number(p.Price || 0), sale = Number(p.FinalPrice || p.Price || 0);
    const discount = Number(p.Discount || (mrp > sale ? Math.round((mrp-sale)*100/mrp) : 0));
    const state = String(p.Status || 'Pending').trim().toLowerCase();
    const approval = String(p.ApprovalStatus || (state === 'active' ? 'Approved' : 'Pending')).trim().toLowerCase();
    const status = approval === 'rejected' ? ['Rejected', 'bad'] : approval === 'pending' ? ['Pending approval', 'warn'] : state === 'inactive' ? ['Approved • Hidden', 'bad'] : stock === 0 ? ['Approved • Out of stock', 'bad'] : stock <= 5 ? ['Approved • Low stock', 'warn'] : ['Approved • Active', 'good'];
    const hasRealImage=Boolean(String(p.ImageURL||'').trim());
    const img = hasRealImage ? p.ImageURL : '../assets/products/noimage.jpg';
    const unit = `${p.UnitValue || 1} ${p.Unit || 'Piece'}`;
    return `<tr>
      <td><input class="product-select" type="checkbox" value="${this.esc(id)}" onchange="SellerPanel.toggleSelection(this.value,this.checked)"></td>
      <td><div class="product-cell"><img src="${this.esc(img)}" onerror="this.src='../assets/products/noimage.jpg'"><div><strong>${this.esc(p.ProductName || 'Product')}</strong><div class="muted">${this.esc(id)} • ${this.esc(unit)}</div>${hasRealImage?'':'<div class="photo-needed"><i class="fa-solid fa-camera"></i> Photo needed</div>'}</div></div></td>
      <td><strong>${this.esc(p.SKU || 'Auto')}</strong><div class="muted">${this.esc(p.Category || 'General')}</div></td>
      <td><span class="price-old">₹${mrp.toLocaleString('en-IN')}</span><strong class="price-sale">₹${sale.toLocaleString('en-IN')}</strong><div class="muted">Settlement ₹${Number(p.BankSettlement||p.SellerPrice||sale).toLocaleString('en-IN')}</div></td>
      <td><span class="discount-pill">${discount}% OFF</span></td>
      <td><strong>${stock}</strong><div class="muted">Reserved ${reserved} • Sold ${sold}</div></td>
      <td><span class="status ${status[1]}">${status[0]}</span>${p.ApprovalReason ? `<div class="muted rejection-reason" title="${this.esc(p.ApprovalReason)}">${this.esc(p.ApprovalReason)}</div>` : ''}</td>
      <td><div class="action-group wrap-actions">
        <button class="icon-btn" title="Edit" onclick="SellerPanel.edit('${this.esc(id)}')"><i class="fa-solid fa-pen"></i></button>
        <button class="icon-btn" title="Update bank settlement" onclick="SellerPanel.quickPrice('${this.esc(id)}')"><i class="fa-solid fa-tag"></i></button>
        <button class="icon-btn" title="Quick stock" onclick="SellerPanel.quickStock('${this.esc(id)}')"><i class="fa-solid fa-boxes-stacked"></i></button>
        <button class="icon-btn" title="Duplicate" onclick="SellerPanel.duplicate('${this.esc(id)}')"><i class="fa-solid fa-copy"></i></button>
        <button class="icon-btn" title="${state === 'inactive' ? 'Show' : 'Hide'}" onclick="SellerPanel.toggleStatus('${this.esc(id)}','${state === 'inactive' ? 'Active' : 'Inactive'}')"><i class="fa-solid ${state === 'inactive' ? 'fa-eye' : 'fa-eye-slash'}"></i></button>
      </div></td>
    </tr>`;
  },

  open(product=null) {
    this.selectedImageFile=null;this.el('productModal')?.classList.add('show');
    this.setText('productModalTitle',product?'Product बदलें':'नया Product जोड़ें');
    this.el('productForm')?.reset();
    this.setValue('editProductId',product?.ProductID||'');this.setValue('pfName',product?.ProductName||'');
    this.setCategory(product?.Category||'General');this.setValue('pfBrand',product?.Brand||'');this.setValue('pfSku',product?.SKU||'');
    this.setValue('pfStatus',['Active','Inactive'].includes(String(product?.Status))?product.Status:'');
    this.setValue('pfMrp',product?.Price||'');this.setValue('pfSettlement',product?.BankSettlement||product?.SellerPrice||product?.FinalPrice||'');
    this.setValue('pfStock',product?.Stock??'');this.setValue('pfLowStock',product?.LowStockThreshold??5);
    this.setValue('pfReserved',product?.ReservedStock||0);this.setValue('pfSold',product?.SoldQty||0);
    this.setValue('pfUnit',product?.Unit||'Piece');this.setValue('pfUnitValue',product?.UnitValue||1);
    this.setValue('pfImage',product?.ImageURL||'');this.setValue('pfDescription',product?.Description||'');
    const preview=this.el('pfImagePreview');if(preview){preview.src=product?.ImageURL||'../assets/products/noimage.jpg';preview.hidden=false;}
    this.setText('pfImageStatus',product?.ImageURL?'Current product image':'JPG, PNG या WEBP • Max 8 MB');
    if(!product)this.restoreDraft();
    this.clearValidation();this.updateUnitPreview();this.updatePricingPreview();this.goStep(1);this.updateCategoryExtras();
  },

  close() {
    this.el('productModal')?.classList.remove('show');this.selectedImageFile=null;this.clearValidation();
  },

  setCategory(category){
    const allowed=['Grocery','Fashion','Electronics','General'];const value=allowed.includes(category)?category:'General';
    this.setValue('pfCategory',value);document.querySelectorAll('#categoryCards [data-category]').forEach(b=>b.classList.toggle('active',b.dataset.category===value));
    this.updateCategoryExtras();this.saveDraft();this.updateFinalPreview();
  },
  updateCategoryExtras(){const category=this.value('pfCategory','General');document.querySelectorAll('[data-extra]').forEach(x=>x.classList.toggle('active',x.dataset.extra===category));},
  goStep(step){
    this.wizardStep=Math.max(1,Math.min(5,Number(step)||1));
    document.querySelectorAll('.spv2-pane').forEach(x=>x.classList.toggle('active',Number(x.dataset.pane)===this.wizardStep));
    document.querySelectorAll('.spv2-step').forEach(x=>{const n=Number(x.dataset.step);x.classList.toggle('active',n===this.wizardStep);x.classList.toggle('done',n<this.wizardStep);});
    this.el('wizardBack')?.classList.toggle('spv2-hidden',this.wizardStep===1);this.el('wizardNext')?.classList.toggle('spv2-hidden',this.wizardStep===5);this.el('wizardSave')?.classList.toggle('spv2-hidden',this.wizardStep!==5);
    if(this.wizardStep===5)this.updateFinalPreview();
    this.el('productModal')?.querySelector('.spv2-main')?.scrollTo({top:0,behavior:'smooth'});
  },
  nextStep(){if(!this.validateStep(this.wizardStep))return;this.goStep(this.wizardStep+1);},
  prevStep(){this.goStep(this.wizardStep-1);},
  clearValidation(){document.querySelectorAll('.spv2-field.invalid').forEach(x=>x.classList.remove('invalid'));},
  validateStep(step){
    this.clearValidation();
    const ids=step===1?['pfName']:step===2?['pfMrp','pfSettlement']:step===3?['pfStock']:[];
    let ok=true;
    ids.forEach(id=>{
      const field=this.el(id)?.closest('.spv2-field');
      const valid=id==='pfName'?this.value(id).trim().length>=2:id==='pfStock'?this.number(id)>=0:this.number(id)>0;
      if(!valid){field?.classList.add('invalid');ok=false;}
    });
    if(step===2){
      const p=this.calculateLocalPricing(this.number('pfSettlement'));
      if(p.listing>this.number('pfMrp')){this.toast('Customer price MRP से ज्यादा बा। दाम ठीक करीं।');ok=false;}
    }
    if(step===4){
      const editId=this.value('editProductId').trim();
      const currentImage=this.value('pfImage').trim();
      const hasImage=Boolean(this.selectedImageFile||currentImage);
      if(!hasImage){
        this.el('pfImageFile')?.closest('.spv2-field')?.classList.add('invalid');
        this.setText('pfImageStatus','Product photo जरूरी है। सही product की photo upload करें।');
        this.toast('Product save करने से पहले real product photo upload करें।');
        ok=false;
      }
      if(editId && !hasImage){
        this.toast('इस पुराने product में photo missing है। पहले सही photo upload करें।');
      }
    }
    if(!ok&&step!==4)this.toast('लाल निशान वाला जानकारी सही से भरीं।');
    return ok;
  },
  collectExtras(){
    const category=this.value('pfCategory','General'), parts=[];
    if(this.value('pfBrand').trim())parts.push(`Brand: ${this.value('pfBrand').trim()}`);
    if(category==='Grocery'){if(this.value('pfExpiry').trim())parts.push(`Expiry/Shelf life: ${this.value('pfExpiry').trim()}`);if(this.value('pfFssai').trim())parts.push(`FSSAI: ${this.value('pfFssai').trim()}`);}
    if(category==='Fashion'){['Color','Size','Fabric','Gender'].forEach(k=>{const v=this.value('pf'+k).trim();if(v)parts.push(`${k}: ${v}`);});}
    if(category==='Electronics'){[['Model','pfModel'],['Warranty','pfWarranty'],['Voltage','pfVoltage'],['Brand','pfTechBrand']].forEach(([k,id])=>{const v=this.value(id).trim();if(v)parts.push(`${k}: ${v}`);});}
    return parts;
  },
  updateFinalPreview(){
    this.setText('previewName',this.value('pfName','Product name')||'Product name');this.setText('previewPrice',this.money(this.number('pfPrice')));
    this.setText('previewCategory',this.value('pfCategory','General'));this.setText('previewUnit',this.value('pfUnitPreview','1 Piece'));this.setText('previewStock',`Stock ${this.number('pfStock')}`);
    this.setText('previewDescription',this.value('pfDescription').trim()||'Description यहाँ दिखेगा।');this.setText('previewSettlement',this.money(this.number('pfSettlement')));
    const img=this.el('previewImage');if(img)img.src=this.el('pfImagePreview')?.src||this.value('pfImage')||'../assets/products/noimage.jpg';
  },
  draftData(){const ids=['pfName','pfCategory','pfBrand','pfSku','pfStatus','pfMrp','pfSettlement','pfStock','pfLowStock','pfUnit','pfUnitValue','pfImage','pfDescription','pfExpiry','pfFssai','pfColor','pfSize','pfFabric','pfGender','pfModel','pfWarranty','pfVoltage','pfTechBrand'];return Object.fromEntries(ids.map(id=>[id,this.value(id)]));},
  saveDraft(){if(this.value('editProductId'))return;clearTimeout(this.draftTimer);this.draftTimer=setTimeout(()=>{try{localStorage.setItem(this.draftKey,JSON.stringify(this.draftData()));this.setText('draftState','✓ Draft saved');}catch{}},250);},
  restoreDraft(){try{const d=JSON.parse(localStorage.getItem(this.draftKey)||'null');if(!d)return;Object.entries(d).forEach(([id,v])=>this.setValue(id,v));this.setCategory(d.pfCategory||'General');this.setText('draftState','पुराना draft मिल गइल');}catch{}},
  clearDraft(){try{localStorage.removeItem(this.draftKey);}catch{}},

  async submit() {
    if(![1,2,3,4].every(step=>this.validateStep(step))){this.goStep(1);return;}
    const button=this.el('wizardSave'), editId=this.value('editProductId'), mrp=this.number('pfMrp'), settlement=this.number('pfSettlement'), pricing=this.calculateLocalPricing(settlement);
    this.setBusy(button,true,this.selectedImageFile?'फोटो upload हो रहा है…':'Product save हो रहा है…');
    try{
      let imageUrl=this.value('pfImage').trim();
      if(this.selectedImageFile){
        const uploaded=await DesiMallUpload.uploadProductImage(this.selectedImageFile);
        imageUrl=String(uploaded?.imageUrl||uploaded?.ImageURL||'').trim();
      }
      if(!imageUrl)throw new Error('Product photo upload नहीं हुआ। सही photo चुनकर फिर save करें।');
      const description=[this.value('pfDescription').trim(),...this.collectExtras()].filter(Boolean).join('\n');
      const payload={Token:this.session.token,ProductID:editId||undefined,ProductName:this.value('pfName').trim(),Category:this.value('pfCategory','General'),SKU:this.value('pfSku').trim(),Status:this.value('pfStatus')||undefined,Price:mrp,FinalPrice:pricing.listing,BankSettlement:settlement,Stock:this.number('pfStock'),Unit:this.value('pfUnit','Piece'),UnitValue:this.number('pfUnitValue',1)||1,ImageURL:imageUrl,Description:description,Brand:this.value('pfBrand').trim(),LowStockThreshold:this.number('pfLowStock',5)};
      const result=editId?await DesiMallAPI.editProduct(payload):await DesiMallAPI.addProduct(payload);if(!result.success)throw new Error(result.message||result.error||'Product could not be saved.');
      this.clearDraft();await this.loadProducts();this.render();this.close();this.toast(result.message||'Product save हो गइल।');
    }catch(error){console.error(error);this.toast(error.message||'Save failed.');}finally{this.setBusy(button,false);}
  },

  edit(id) { const p=this.products.find(x=>String(x.ProductID)===String(id)); if(p) this.open(p); },

  async quickPrice(id) {
    const p=this.products.find(x=>String(x.ProductID)===String(id));if(!p)return;
    const current=Number(p.BankSettlement||p.SellerPrice||p.FinalPrice||0);
    const valueText=prompt(`Update bank settlement for ${p.ProductName}
Current: ₹${current}
Daily change limit applies.`,String(current));
    if(valueText===null)return;
    const value=Number(valueText);if(!(value>0))return this.toast('Invalid bank settlement.');
    const pricing=this.calculateLocalPricing(value);
    if(pricing.listing>Number(p.Price))return this.toast(`Listing price ${this.money(pricing.listing)} MRP से ज्यादा हो जाएगी.`);
    const result=await DesiMallAPI.editProduct({Token:this.session.token,ProductID:id,Price:Number(p.Price),BankSettlement:value});
    await this.afterAction(result);
  },

  async quickStock(id) {
    const p=this.products.find(x=>String(x.ProductID)===String(id)); if(!p) return;
    const stock=prompt(`New stock for ${p.ProductName}`, String(p.Stock || 0)); if(stock===null) return;
    const value=Math.max(0,parseInt(stock,10)||0);
    const result=await DesiMallAPI.updateStock(id,value,this.session.token); await this.afterAction(result);
  },

  async duplicate(id) {
    if(!confirm('Create a pending copy of this product?')) return;
    const result=await DesiMallAPI.duplicateProduct(id,this.session.token); await this.afterAction(result);
  },

  async toggleStatus(id,status) {
    const result=await DesiMallAPI.setProductStatus(id,status,this.session.token); await this.afterAction(result);
  },

  toggleSelection(id,checked) { checked ? this.selectedIds.add(id) : this.selectedIds.delete(id); this.updateSelectionUi(); },
  selectAll(checked) { this.selectedIds.clear(); if(checked) this.filteredProducts().forEach(p=>this.selectedIds.add(String(p.ProductID))); this.render(); },
  clearSelection() { this.selectedIds.clear(); document.getElementById('selectAllProducts').checked=false; this.render(); },
  updateSelectionUi() { document.getElementById('selectedCount').textContent=this.selectedIds.size; document.getElementById('bulkBar').classList.toggle('active',this.selectedIds.size>0); },

  async applyBulk() {
    if(!this.selectedIds.size) return this.toast('Products select karein.');
    const action=document.getElementById('bulkAction').value, value=document.getElementById('bulkValue').value;
    if(!action) return this.toast('Bulk action choose karein.');
    if(['stock-add','stock-set','discount'].includes(action) && value==='') return this.toast('Value enter karein.');
    const result=await DesiMallAPI.bulkUpdateProducts([...this.selectedIds],action,Number(value||0),this.session.token);
    if(result.success) this.clearSelection();
    await this.afterAction(result);
  },

  async afterAction(result) {
    if(!result.success) return this.toast(result.message || 'Action failed.');
    await this.loadProducts(); this.render(); this.toast(result.message || 'Updated.');
  },

  setBusy(button,busy,label='Please wait...') { if(!button) return; if(busy){button.dataset.label=button.innerHTML;button.disabled=true;button.innerHTML=`<i class="fa-solid fa-spinner fa-spin"></i> ${label}`;}else{button.disabled=false;button.innerHTML=button.dataset.label||'<i class="fa-solid fa-floppy-disk"></i> Product सेव करें';} },
  toast(message) { const el=document.getElementById('panelToast'); el.textContent=message; el.classList.add('show'); clearTimeout(this.toastTimer); this.toastTimer=setTimeout(()=>el.classList.remove('show'),3500); },
  esc(value) { return String(value ?? '').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
};

document.addEventListener('DOMContentLoaded',()=>SellerPanel.init());
