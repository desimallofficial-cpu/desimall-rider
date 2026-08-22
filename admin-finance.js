const AdminFinance={
 version:'0.27.5',
 adminToken(){
  try{
   const s=JSON.parse(localStorage.getItem('desimall_admin_session')||'null');
   return s?.token||'';
  }catch(_){return '';}
 },
 data:null,cod:[],settlements:[],settlementHistory:[],riderSettlements:[],riderSettlementHistory:[],riderSettings:{},
 money(v){return `₹${Number(v||0).toLocaleString('en-IN',{maximumFractionDigits:2})}`;},
 esc(v){return String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));},
 toast(m){adminToast.textContent=m;adminToast.classList.add('show');setTimeout(()=>adminToast.classList.remove('show'),2400);},
 async init(){
  document.querySelectorAll('[data-close-modal]').forEach(b=>b.onclick=()=>b.closest('.modal').classList.remove('show'));
  refreshFinance.onclick=()=>this.load();
  backfillFinance.onclick=()=>this.backfill();
  loadCOD.onclick=()=>this.loadCOD();
  refreshSettlements.onclick=()=>this.loadSettlements();
  openExpense.onclick=()=>this.showExpense();
  openExpense2.onclick=()=>this.showExpense();
  expenseForm.onsubmit=e=>{e.preventDefault();this.addExpense();};
  settlementForm.onsubmit=e=>{e.preventDefault();this.paySeller();};
  riderSettlementForm.onsubmit=e=>{e.preventDefault();this.payRider();};
  refreshRiderSettlements.onclick=()=>this.loadRiderSettlements();
  expenseDate.value=new Date().toISOString().slice(0,10);
  await this.load();
 },
 showExpense(){expenseModal.classList.add('show');},
 async load(){
  const r=await DesiMallAPI.getFinanceDashboard({},this.adminToken());
  if(!r.success){this.toast(r.message||'Finance data load failed.');return;}
  this.data=r;this.renderStats(r.stats||{});this.renderChart(r.monthly||{});this.renderOrders(r.recentOrders||[]);this.renderExpenses(r.expenses||[]);
  await Promise.all([this.loadCOD(false),this.loadSettlements(false),this.loadRiderSettlements(false),this.loadCODReviewBlocked()]);
 },
 set(id,v){const e=document.getElementById(id);if(e)e.textContent=v;},
 renderStats(s){
  const map={finGMV:s.gmv,finConfirmedGMV:s.confirmedGMV,finGrossIncome:s.grossIncome,finNetProfit:s.netProfit,finSellerSettlement:s.sellerSettlement,finCommission:s.commission,finProcessing:s.processing,finDelivery:s.deliveryIncome,finExpenses:s.expenses,finPendingSettlement:s.pendingSettlement,finPaidSettlement:s.paidSettlement,finCashRiders:s.cashWithRiders,codCashRiders:s.cashWithRiders,codDeposited:s.codDeposited,codReconciled:s.codReconciled,codVariance:s.codVariance};
  Object.entries(map).forEach(([id,v])=>this.set(id,this.money(v)));
 },
 async loadCODReviewBlocked(){
  try{
    const r=await DesiMallAPI.getPendingSellerSettlements(this.adminToken());
    const amount=Number(r?.summary?.CODReview||0);
    this.set('codReviewBlocked',this.money(amount));
  }catch(_){
    this.set('codReviewBlocked','—');
  }
 },
 renderChart(monthly){
  const now=new Date(),list=[];
  for(let i=5;i>=0;i--){const d=new Date(now.getFullYear(),now.getMonth()-i,1),key=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;list.push({key,label:d.toLocaleString('en',{month:'short'}),...(monthly[key]||{gmv:0,income:0,expenses:0,profit:0})});}
  const max=Math.max(1,...list.flatMap(x=>[Math.abs(Number(x.gmv||0)),Math.abs(Number(x.income||0)),Math.abs(Number(x.profit||0))]));
  financeChart.innerHTML=list.map(x=>`<div class="month-group"><div class="bars"><i class="bar gmv" title="GMV ${this.money(x.gmv)}" style="height:${Math.max(2,Math.abs(x.gmv)/max*220)}px"></i><i class="bar income" title="Income ${this.money(x.income)}" style="height:${Math.max(2,Math.abs(x.income)/max*220)}px"></i><i class="bar ${Number(x.profit)<0?'negative':'profit'}" title="Profit ${this.money(x.profit)}" style="height:${Math.max(2,Math.abs(x.profit)/max*220)}px"></i></div><small>${x.label}</small></div>`).join('');
 },
 renderOrders(rows){
  financeOrdersBody.innerHTML=rows.length?rows.map(o=>`<tr><td><strong>${this.esc(o.OrderID||'')}</strong><div class="muted">${this.esc(o.OrderDate||'')}</div></td><td>${this.esc(o.CustomerName||'')}</td><td>${this.esc(o.PaymentMode||'')}<div class="muted">${this.esc(o.CODStatus||o.PaymentStatus||'')}</div></td><td>${this.money(o.TotalAmount)}</td><td>${this.money(o.CommissionAmount)}</td><td>${this.money(o.EstimatedFees)}</td><td>${this.money(o.DeliveryIncome)}</td><td>${this.money(o.SellerSettlement)}</td><td><span class="finance-status ${o.Confirmed?'confirmed':'pending'}">${this.esc(o.FinanceStatus||(o.Confirmed?'Confirmed income':'Not confirmed'))}</span>${o.NeedsVerification?`<button class="a-btn small primary" onclick="AdminFinance.verifyPayment('${this.esc(o.OrderID)}')">Verify Paid</button>`:''}</td></tr>`).join(''):'<tr><td colspan="9" class="empty">No financial orders yet.</td></tr>';
 },
 renderExpenses(rows){
  expensesBody.innerHTML=rows.length?rows.map(e=>`<tr><td>${this.esc(e.ExpenseDate||'')}</td><td>${this.esc(e.Category||'')}</td><td>${this.esc(e.Description||'')}</td><td>${this.money(e.Amount)}</td><td><button class="a-btn small bad" onclick="AdminFinance.deleteExpense('${this.esc(e.ExpenseID)}')"><i class="fa-solid fa-trash"></i></button></td></tr>`).join(''):'<tr><td colspan="5" class="empty">No expenses recorded.</td></tr>';
 },
 async addExpense(){
  const r=await DesiMallAPI.addFinanceExpense({Token:this.adminToken(),ExpenseDate:expenseDate.value,Category:expenseCategory.value,Description:expenseDescription.value.trim(),Amount:expenseAmount.value,PaymentMode:expenseMode.value,Reference:expenseReference.value.trim()});
  this.toast(r.message||'Expense saved.');
  if(r.success){expenseModal.classList.remove('show');expenseForm.reset();expenseDate.value=new Date().toISOString().slice(0,10);await this.load();}
 },

 async backfill(){
  const b=backfillFinance;b.disabled=true;b.innerHTML='<i class="fa-solid fa-spinner fa-spin"></i> Refreshing...';
  const r=await DesiMallAPI.backfillFinanceData(this.adminToken());b.disabled=false;b.innerHTML='<i class="fa-solid fa-database"></i> Refresh Old Data';
  this.toast(r.message||'Finance data refreshed.');if(r.success)await this.load();
 },
 async verifyPayment(orderId){
  const tx=prompt(`Online payment reference for ${orderId} (optional):`,'')??'';
  if(!confirm('Confirm that payment has actually been received?'))return;
  const r=await DesiMallAPI.verifyOnlinePayment({Token:this.adminToken(),OrderID:orderId,PaymentStatus:'Paid',TransactionID:tx});
  this.toast(r.message||'Payment updated.');if(r.success)await this.load();
 },
 async deleteExpense(id){
  if(!confirm('Remove this expense entry?'))return;
  const r=await DesiMallAPI.deleteFinanceExpense(id,this.adminToken());this.toast(r.message||'Updated.');if(r.success)await this.load();
 },

 async loadSettlements(showToast=true){
  const r=await DesiMallAPI.getPendingSellerSettlements(this.adminToken());
  if(!r.success){if(showToast)this.toast(r.message||'Settlement data failed.');return;}
  this.settlements=r.settlements||[];this.settlementHistory=r.history||[];this.renderSettlements();
 },
 renderSettlements(){
  pendingSettlementsBody.innerHTML=this.settlements.length?this.settlements.map(s=>`<tr><td><strong>${this.esc(s.SellerName||'Seller')}</strong><div class="muted">${this.esc(s.ShopName||'')} · ${this.esc(s.SellerCode||'')}</div></td><td>${s.BankAccountNumber?`<strong>${this.esc(s.BankAccountName||'Bank Account')}</strong><div class="muted">A/C ${this.esc(s.BankAccountNumber)} · ${this.esc(s.IFSC||'IFSC missing')}</div>`:s.UPIID?`<strong>UPI</strong><div class="muted">${this.esc(s.UPIID)}</div>`:'<span class="bank-missing">Bank/UPI details missing</span>'}</td><td><strong>${this.money(s.Amount)}</strong><div class="muted">COD hold ${this.money(s.CODHold||0)} · Returns ${this.money(s.ReturnAdjustments||0)}</div></td><td><button class="a-btn small primary pay-seller-btn" onclick="AdminFinance.openSettlement('${this.esc(s.SellerID)}')"><i class="fa-solid fa-building-columns"></i> Pay Seller</button></td></tr>`).join(''):'<tr><td colspan="4" class="empty">No seller payout is pending.</td></tr>';
  settlementHistoryBody.innerHTML=this.settlementHistory.length?this.settlementHistory.map(s=>`<tr><td><strong>${this.esc(s.SellerName||s.SellerID||'Seller')}</strong><div class="muted">${this.esc(s.OrderIDs||'')}</div></td><td><strong class="settlement-paid">${this.money(s.Amount)}</strong></td><td>${this.esc(s.PaymentMode||'')}<div class="settlement-ref">${this.esc(s.Reference||'—')}</div></td><td>${this.esc(s.PaidAt||s.CreatedAt||'')}</td></tr>`).join(''):'<tr><td colspan="4" class="empty">No seller payout history.</td></tr>';
 },
 openSettlement(sellerId){
  const s=this.settlements.find(x=>String(x.SellerID)===String(sellerId));
  if(!s)return this.toast('Seller payout record not found.');
  settlementOrderId.value='';
  settlementSellerId.value=s.SellerID;
  settlementSellerDisplay.value=`${s.SellerName||'Seller'}${s.ShopName?' · '+s.ShopName:''}`;
  settlementAmount.value=Number(s.Amount||0);
  settlementMode.value='';
  settlementReference.value='';
  settlementNote.value='';
  settlementModalSubtitle.textContent=`Pending seller payout ${this.money(s.Amount)}`;
  settlementAccountPreview.innerHTML=s.BankAccountNumber?`<strong>Bank Account:</strong> ${this.esc(s.BankAccountName||'')}<br>A/C: ${this.esc(s.BankAccountNumber)}<br>IFSC: ${this.esc(s.IFSC||'Not provided')}`:s.UPIID?`<strong>UPI ID:</strong> ${this.esc(s.UPIID)}`:'<span class="bank-missing">Seller bank/UPI information is missing. Verify account details before recording payout.</span>';
  settlementModal.classList.add('show');
 },
 async paySeller(){
  if(!settlementMode.value)return this.toast('Select a payment method.');if(!settlementReference.value.trim())return this.toast('Transaction reference is required.');
  if(!confirm(`Confirm payment of ${this.money(settlementAmount.value)} to the seller?`))return;
  const b=confirmSellerPayment;b.disabled=true;b.innerHTML='<i class="fa-solid fa-spinner fa-spin"></i> Saving...';
  const r=await DesiMallAPI.paySellerSettlement({Token:this.adminToken(),SellerID:settlementSellerId.value,PaymentMode:settlementMode.value,Reference:settlementReference.value.trim(),AdminNote:settlementNote.value.trim()});
  b.disabled=false;b.innerHTML='<i class="fa-solid fa-check"></i> Confirm Payment';this.toast(r.message||'Seller payment updated.');if(r.success){settlementModal.classList.remove('show');await this.load();}
 },

 async loadRiderSettlements(showToast=true){
  const r=await DesiMallAPI.getAdminRiderPayouts(this.adminToken());
  if(!r.success){if(showToast)this.toast(r.message||'Rider payout load failed.');return;}
  this.riderSettlements=r.riders||[];
  this.riderSettlementHistory=r.payoutHistory||[];
  this.renderRiderSettlements();
 },
 renderRiderSettlements(){
  riderSettlementsBody.innerHTML=this.riderSettlements.length?this.riderSettlements.map(r=>`<tr>
   <td><strong>${this.esc(r.RiderName||'Rider')}</strong><div class="muted">${this.esc(r.RiderCode||'')} · ${this.esc(r.Mobile||'')}</div></td>
   <td><strong>${this.money(r.PendingPayout)}</strong><div class="muted">${Number(r.PendingEarningRows||0)} pending earning entries</div></td>
   <td>${Number(r.CODToDeposit)>0?`<span class="bank-missing">${this.money(r.CODToDeposit)} pending</span>`:'<span class="settlement-paid">₹0 · Clear</span>'}</td>
   <td>${r.CanPay?'<span class="settlement-paid">Ready to pay</span>':'<span class="muted">On hold</span>'}</td>
   <td><button class="a-btn small primary" ${!r.CanPay?'disabled':''} onclick="AdminFinance.openRiderSettlement('${this.esc(r.RiderID)}')">Pay Rider</button></td>
  </tr>`).join(''):'<tr><td colspan="5" class="empty">No rider payout is currently pending.</td></tr>';

  riderSettlementHistoryBody.innerHTML=this.riderSettlementHistory.length?this.riderSettlementHistory.map(x=>`<tr>
   <td><strong>${this.esc(x.RiderName||x.RiderID||'Rider')}</strong><div class="muted">${this.esc(x.RiderCode||'')} · ${this.esc(x.Mobile||'')}</div></td>
   <td><strong class="settlement-paid">${this.money(x.Amount)}</strong></td>
   <td>${this.esc(x.PaymentMethod||'')}<div class="muted">${this.esc(x.ReferenceNo||'No reference')}</div></td>
   <td>${this.esc(x.PaidAt||'')}</td>
  </tr>`).join(''):'<tr><td colspan="4" class="empty">No rider payout history.</td></tr>';
 },
 openRiderSettlement(riderId){
  const r=this.riderSettlements.find(x=>String(x.RiderID)===String(riderId));
  if(!r)return this.toast('Rider payout record not found.');
  if(!r.CanPay)return this.toast('Rider payout is blocked until pending COD is received.');
  riderSettlementRiderId.value=r.RiderID;
  riderSettlementRiderName.value=r.RiderName||'Rider';
  riderSettlementAmount.value=Number(r.PendingPayout||0);
  riderSettlementMode.value='';
  riderSettlementReference.value='';
  riderSettlementNote.value='';
  riderSettlementSubtitle.textContent=`Pending earnings ${this.money(r.PendingPayout)} · COD to deposit ${this.money(r.CODToDeposit)}`;
  riderSettlementModal.classList.add('show');
 },
 async payRider(){
  if(!riderSettlementMode.value)return this.toast('Select a payment mode.');
  if(!confirm(`Confirm rider payment of ${this.money(riderSettlementAmount.value)}?`))return;
  const r=await DesiMallAPI.payAdminRiderPayout(
    riderSettlementRiderId.value,
    {PaymentMethod:riderSettlementMode.value,ReferenceNo:riderSettlementReference.value.trim(),Notes:riderSettlementNote.value.trim()},
    this.adminToken()
  );
  this.toast(r.message||'Rider payment updated.');
  if(r.success){riderSettlementModal.classList.remove('show');await this.load();}
 },

 async loadCOD(showToast=true){
  const r=await DesiMallAPI.getCODReconciliation({},this.adminToken());
  if(!r.success){if(showToast)this.toast(r.message||'COD data failed.');return;}
  this.cod=r.orders||[];this.renderCOD();
 },
 renderCOD(){
  const rows=this.cod.slice(0,12);
  codBody.innerHTML=rows.length?rows.map(o=>{
   const outstanding=Number(o.CODOutstanding||0);
   const deposited=Number(o.CODDeposited||0);
   const collected=Number(o.CODCollected||0);
   const clear=outstanding<=0 && collected>0;
   return `<tr><td><strong>${this.esc(o.OrderID||'')}</strong><div class="muted">${this.esc(o.RiderName||'')} ${o.RiderCode?'· '+this.esc(o.RiderCode):''}</div></td><td>${this.money(collected)}</td><td><span class="badge ${clear?'deposited':'pending'}">${clear?'Deposited':'Pending'}</span><div class="muted">Deposited ${this.money(deposited)} · Due ${this.money(outstanding)}</div></td><td>${clear?this.money(deposited):`<button class="a-btn small primary" onclick="AdminFinance.receiveCOD('${this.esc(o.OrderID)}',${collected})">COD Received</button>`}</td></tr>`;
  }).join(''):'<tr><td colspan="4" class="empty">No COD orders.</td></tr>';
 },
 async receiveCOD(orderId,total){
  if(!confirm(`Confirm COD ${this.money(total)} received from rider for ${orderId}?`))return;
  const r=await DesiMallAPI.markCODReceived(orderId,this.adminToken());
  this.toast(r.message||'COD updated.');
  if(r.success)await this.load();
 }

};
document.addEventListener('DOMContentLoaded',()=>AdminFinance.init());