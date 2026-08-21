const MarketplaceSettings={
settings:{},sellers:[],
token(){try{return JSON.parse(localStorage.getItem('desimall_admin_session')||'null')?.token||''}catch(_){return''}},
money(v){return `₹${Number(v||0).toLocaleString('en-IN',{maximumFractionDigits:2})}`;},
toast(m){adminToast.textContent=m;adminToast.classList.add('show');setTimeout(()=>adminToast.classList.remove('show'),2500);},
async init(){
  saveMarketplaceSettings.onclick=()=>this.save();
  exampleSettlement.oninput=()=>this.example();
  overrideSearch.oninput=()=>this.renderSellers();
  const token=this.token();
  const [sr,sellers]=await Promise.all([
    DesiMallAPI.getMarketplaceSettings(token),
    DesiMallAPI.getAdminSellers(token)
  ]);
  if(sr.success){this.settings=sr.settings||{};}else{this.toast(sr.message||'Settings could not be loaded.');}
  this.fill();
  if(sellers.success){this.sellers=sellers.sellers||[];this.renderSellers();}
},
fill(){
  const s=this.settings||{};
  setDefaultCommission.value=Number(s.DefaultCommissionPercent ?? 2);
  setNewSellerCommission.value=Number(s.NewSellerCommissionPercent ?? 0);
  setNewSellerDays.value=Number(s.NewSellerOfferDays ?? 30);
  setProcessingPercent.value=Number(s.ProcessingFeePercent ?? 1);
  setProcessingFixed.value=Number(s.ProcessingFeeFixed ?? 2);
  setLogisticsFee.value=Number(s.CustomerLogisticsFee ?? 40);
  setCodCharge.value=Number(s.CODCharge ?? 0);
  setSettlementLimit.value=Number(s.SettlementChangeLimitPerDay ?? 2);
  setFeaturedFee.value=Number(s.FeaturedPromotionFee ?? 0);
  setFlashFee.value=Number(s.FlashSalePromotionFee ?? 0);
  setLaunchMode.value=String(s.LaunchModeEnabled ?? true).toUpperCase()==='FALSE'?'FALSE':'TRUE';
  this.example();
},
collect(){return {
  Token:this.token(),
  DefaultCommissionPercent:Number(setDefaultCommission.value||0),
  NewSellerCommissionPercent:Number(setNewSellerCommission.value||0),
  NewSellerOfferDays:Number(setNewSellerDays.value||0),
  ProcessingFeePercent:Number(setProcessingPercent.value||0),
  ProcessingFeeFixed:Number(setProcessingFixed.value||0),
  CustomerLogisticsFee:Number(setLogisticsFee.value||0),
  CODCharge:Number(setCodCharge.value||0),
  SettlementChangeLimitPerDay:Number(setSettlementLimit.value||0),
  FeaturedPromotionFee:Number(setFeaturedFee.value||0),
  FlashSalePromotionFee:Number(setFlashFee.value||0),
  LaunchModeEnabled:setLaunchMode.value
};},
async save(){
  const b=saveMarketplaceSettings;b.disabled=true;
  const r=await DesiMallAPI.saveMarketplaceSettings(this.collect());
  b.disabled=false;this.toast(r.message||'Settings saved.');
  if(r.success){this.settings=r.settings||this.collect();this.fill();}
},
example(){
  const settlement=Number(exampleSettlement.value||0),
  rate=Number(setDefaultCommission.value||0),
  feeP=Number(setProcessingPercent.value||0),
  feeF=Number(setProcessingFixed.value||0),
  log=Number(setLogisticsFee.value||0),
  cod=Number(setCodCharge.value||0);
  const commission=Math.round(settlement*rate)/100,
  fees=settlement>0?Math.round((settlement*feeP/100+feeF)*100)/100:0,
  sellerPrice=settlement+commission+fees,listing=sellerPrice;
  exSettlement.textContent=this.money(settlement);
  exCommission.textContent='+'+this.money(commission);
  exFees.textContent='+'+this.money(fees);
  exSellerPrice.textContent=this.money(sellerPrice);
  exLogistics.textContent=this.money(log+cod)+' / order';
  exListing.textContent=this.money(listing);
},
renderSellers(){
  const q=overrideSearch.value.trim().toLowerCase(),
  list=this.sellers.filter(s=>`${s.SellerName} ${s.ShopName} ${s.Mobile}`.toLowerCase().includes(q));
  overrideBody.innerHTML=list.length?list.map(s=>`<tr>
    <td><strong>${s.SellerName||'Seller'}</strong><div class="muted">${s.ShopName||''}</div></td>
    <td>${s.JoinDate||s.CreatedAt||'—'}</td>
    <td><div class="switch-cell"><input id="ov_${s.SellerID}" type="checkbox" ${s.UseCustomCommission?'checked':''}><label for="ov_${s.SellerID}">${s.UseCustomCommission?'Custom override':'Marketplace default'}</label></div></td>
    <td><input id="rate_${s.SellerID}" type="number" min="0" max="100" step="0.1" value="${Number(s.CommissionPercent||0)}"></td>
    <td><button class="a-btn small primary" onclick="MarketplaceSettings.saveSeller('${s.SellerID}')">Save</button></td>
  </tr>`).join(''):'<tr><td colspan="5" class="empty">No sellers found.</td></tr>';
},
async saveSeller(id){
  const enabled=document.getElementById('ov_'+id).checked,
  rate=Number(document.getElementById('rate_'+id).value||0);
  const r=await DesiMallAPI.updateAdminSeller({
    Token:this.token(),SellerID:id,
    UseCustomCommission:enabled?'TRUE':'FALSE',
    CommissionPercent:rate
  });
  this.toast(r.message||'Seller pricing updated.');
  if(r.success){const s=this.sellers.find(x=>String(x.SellerID)===String(id));if(s){s.UseCustomCommission=enabled;s.CommissionPercent=rate;}this.renderSellers();}
}
};
document.addEventListener('DOMContentLoaded',()=>MarketplaceSettings.init());