const AdminOverview={
  session:null,

  esc(v){
    return String(v??'').replace(/[&<>"']/g,c=>({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[c]));
  },

  money(v){
    return `₹${Number(v||0).toLocaleString('en-IN',{maximumFractionDigits:2})}`;
  },

  toast(m){
    const e=document.getElementById('adminToast');
    if(!e)return;
    e.textContent=m;
    e.classList.add('show');
    setTimeout(()=>e.classList.remove('show'),2300);
  },

  async init(){
    try{
      this.session=JSON.parse(
        localStorage.getItem('desimall_admin_session')||'null'
      );
    }catch(_){
      this.session=null;
    }

    if(!this.session?.token){
      location.href='login.html';
      return;
    }

    refreshAdminDashboard.onclick=()=>this.load();

    await this.load();
  },

  async load(){
    try{
      const r=await DesiMallAPI.getAdminDashboard(
        this.session.token
      );

      if(!r.success){
        throw new Error(r.message||'Could not load admin dashboard.');
      }

      const s=r.stats||{};

      dashOrders.textContent=Number(s.totalOrders||0);
      dashSales.textContent=this.money(s.grossSales);
      dashSellers.textContent=Number(s.activeSellers||0);
      dashSellerMeta.textContent=`${Number(s.totalSellers||0)} total sellers`;
      dashRiders.textContent=Number(s.activeRiders||0);
      dashRiderMeta.textContent=`${Number(s.totalRiders||0)} total riders`;
      dashCustomers.textContent=Number(s.totalCustomers||0);
      dashProducts.textContent=Number(s.totalProducts||0);
      dashReturns.textContent=Number(s.totalReturns||0);
      dashSellerPaid.textContent=this.money(s.totalSellerPaid);

      this.orders(r.recentOrders||[]);
      this.inventory(r.inventoryAlerts||[]);
    }catch(error){
      this.toast(error?.message||'Could not load admin dashboard.');
      dashRecentOrders.innerHTML=`
        <tr><td colspan="5" class="dashboard-empty">
          ${this.esc(error?.message||'Dashboard request failed.')}
        </td></tr>
      `;
      dashInventoryAlerts.innerHTML=`
        <div class="dashboard-empty">Could not load inventory alerts.</div>
      `;
    }
  },

  orders(rows){
    dashRecentOrders.innerHTML=rows.length
      ? rows.map(x=>`
          <tr>
            <td><strong>${this.esc(x.OrderID)}</strong></td>
            <td>
              <strong>${this.esc(x.CustomerName||'Customer')}</strong>
              <div style="color:#8fa1b5;margin-top:3px">${this.esc(x.CustomerMobile||'')}</div>
            </td>
            <td>
              ${this.esc(x.PaymentMethod||'')}
              <div style="color:#8fa1b5;margin-top:3px">${this.esc(x.PaymentStatus||'')}</div>
            </td>
            <td>${this.esc(x.Status||'')}</td>
            <td><strong>${this.money(x.Amount)}</strong></td>
          </tr>
        `).join('')
      : `<tr><td colspan="5" class="dashboard-empty">No orders found.</td></tr>`;
  },

  inventory(rows){
    dashInventoryAlerts.innerHTML=rows.length
      ? rows.map(x=>`
          <div class="alert-row">
            <div>
              <strong>${this.esc(x.ProductName||'Product')}</strong>
              <span>${this.esc(x.ProductID||'')}</span>
            </div>
            <span class="stock">${Number(x.Stock||0)} left</span>
          </div>
        `).join('')
      : `<div class="dashboard-empty">No low-stock alerts.</div>`;
  }
};

document.addEventListener('DOMContentLoaded',()=>AdminOverview.init());
