(() => {
  const jobs = {
    'products.html': () => DesiMallAPI.getAdminProducts({}),
    'inventory.html': () => DesiMallAPI.getAdminInventory({}),
    'returns.html': () => DesiMallAPI.getAdminReturns({}),
    'orders.html': () => DesiMallAPI.getAdminOrders({}),
    'seller-management.html': () => DesiMallAPI.getAdminSellers(),
    'rider-management.html': () => DesiMallAPI.getAdminRiders(),
    'index.html': () => DesiMallAPI.getAdminDashboard()
  };
  const started = new Set();
  function run(name){
    if(started.has(name) || !jobs[name] || !window.DesiMallAPI) return;
    started.add(name);
    const execute=()=>jobs[name]().catch(()=>{});
    if('requestIdleCallback' in window) requestIdleCallback(execute,{timeout:1800});
    else setTimeout(execute,250);
  }
  document.querySelectorAll('.admin-nav a').forEach(a=>{
    const name=(a.getAttribute('href')||'').split('/').pop();
    a.addEventListener('mouseenter',()=>run(name),{once:true});
    a.addEventListener('focus',()=>run(name),{once:true});
  });
  window.addEventListener('load',()=>{
    const priority=['products.html','inventory.html','returns.html','orders.html'];
    priority.forEach((name,i)=>setTimeout(()=>run(name),500+i*350));
  },{once:true});
})();