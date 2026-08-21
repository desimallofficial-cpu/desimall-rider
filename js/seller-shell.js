const SellerShell = {
  key:'desimall_seller_session',
  read(){try{return JSON.parse(localStorage.getItem(this.key))||{};}catch(_){return{};}},
  initials(name){return String(name||'Seller').trim().split(/\s+/).slice(0,2).map(x=>x[0]||'').join('').toUpperCase()||'S';},
  apply(seller){
    if(!seller)return;
    const fullAccess=String(seller.Status||'').toLowerCase()==='active'&&String(seller.KYCStatus||'').toLowerCase()==='approved';
    document.querySelectorAll('.panel-nav a').forEach(a=>{const href=a.getAttribute('href')||'';if(!fullAccess&&!/profile\.html|login\.html|\.\.\/index\.html/.test(href)){a.classList.add('locked');a.title='KYC approval required';a.onclick=e=>{e.preventDefault();location.href='profile.html';};}});
    if(!fullAccess&&!location.pathname.endsWith('/profile.html')&&!location.pathname.endsWith('/login.html'))location.replace('profile.html');
    const img=String(seller.ProfileImage||'').trim();
    document.querySelectorAll('[data-seller-avatar]').forEach(el=>{
      el.innerHTML=img?`<img src="${img}" alt="Seller profile">`:`<span>${this.initials(seller.SellerName||seller.ShopName)}</span>`;
    });
    document.querySelectorAll('[data-seller-name]').forEach(el=>el.textContent=seller.SellerName||seller.ShopName||'Seller');
    document.querySelectorAll('[data-seller-shop]').forEach(el=>{
      el.innerHTML=`<span>${seller.ShopName||'DesiMall Seller'}</span>${fullAccess?'<em class="trusted-seller"><i class="fa-solid fa-circle-check"></i> Verified Seller</em>':''}`;
    });
  },
  async init(){
    const session=this.read();
    if(session.seller)this.apply(session.seller);
    if(!session.token)return;
    const verifiedAt=Number(session.verifiedAt||0);
    if(session.seller&&Date.now()-verifiedAt<300000)return;
    let r;try{r=await DesiMallAPI.sellerSession(session.token);}catch(_){return;}
    if(r.success){session.seller=r.seller||session.seller;session.verifiedAt=Date.now();if(r.expiresAt)session.expiresAt=r.expiresAt;localStorage.setItem(this.key,JSON.stringify(session));this.apply(session.seller);}
  }
};
document.addEventListener('DOMContentLoaded',()=>SellerShell.init());


// Seller session keep-alive v0.7.6
(function startSellerKeepAlive() {
  const refresh = async () => {
    try {
      if (
        typeof DesiMallAPI !== 'undefined' &&
        typeof DesiMallAPI.ensureSellerSession === 'function'
      ) {
        await DesiMallAPI.ensureSellerSession(false);
      }
    } catch (error) {
      // Temporary network failure does not log seller out.
      console.warn(
        'Seller session refresh deferred:',
        error?.message || error
      );
    }
  };

  document.addEventListener('DOMContentLoaded', () => {
    refresh();
    setInterval(refresh, 10 * 60 * 1000);
  });
})();
