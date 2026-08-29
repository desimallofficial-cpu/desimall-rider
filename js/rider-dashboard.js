window.DESIMALL_RIDER_BUILD='v0.31.6';
const RiderDashboard = {
  key: 'desimall_rider_session',
  session: {},
  orders: [],
  geoWatchId: null,
  geoOrder: null,
  lastGeoPushAt: 0,
  gpsStartedByUser: false,
  lastLocationAt: 0,
  inAppMap: null,
  inAppRiderMarker: null,
  inAppTargetMarker: null,
  inAppRouteLine: null,
  inAppRouteCoords: [],
  currentMapTarget: null,
  currentRiderPosition: null,

  init() {
    try {
      this.session = JSON.parse(localStorage.getItem(this.key)) || {};
    } catch (_) {}

    if (!this.session.token && !this.session.refreshToken) {
      return location.replace('login.html');
    }

    riderName.textContent = this.session.rider?.RiderName || 'Rider';

    riderMeta.textContent = [
      this.session.rider?.VehicleType,
      this.session.rider?.VehicleNumber
    ].filter(Boolean).join(' · ') || 'Delivery Partner';

    refreshBtn.onclick = () => this.load();
    startGpsBtn.onclick = () => this.startLiveLocation(true);
    logoutBtn.onclick = () => this.logout();
    searchInput.oninput = () => this.render();
    statusFilter.onchange = () => this.render();

    this.load();
  },

  async load() {
    refreshBtn.disabled = true;
    refreshBtn.textContent = 'Loading...';

    try {
      const r = await DesiMallAPI.getRiderOrders(this.session.token || '');

      this.session = {
        ...this.session,
        ...DesiMallAPI._readRoleSession('rider')
      };

      this.orders = r.orders || [];
      this.render();
      this.syncLiveTracking();
    } catch (error) {
      if (error?.status === 401) {
        localStorage.removeItem(this.key);
        return location.replace('login.html');
      }

      orders.innerHTML =
        `<div class="r-empty">${this.esc(error?.message || 'Backend unavailable')}</div>`;
    } finally {
      refreshBtn.disabled = false;
      refreshBtn.textContent = 'Refresh';
    }
  },

  render() {
    const q = searchInput.value.trim().toLowerCase();
    const f = statusFilter.value.toLowerCase();

    const list = this.orders.filter(o =>
      (!f || String(o.RiderStatus || '').toLowerCase() === f) &&
      (!q || JSON.stringify([
        o.OrderID,
        o.CustomerName,
        o.CustomerMobile,
        ...(o.Items || []).map(i => i.ProductName)
      ]).toLowerCase().includes(q))
    );

    totalCount.textContent = this.orders.length;

    pickupCount.textContent = this.orders.filter(o =>
      /pickup assigned|pickup accepted/i.test(o.RiderStatus || '')
    ).length;

    wayCount.textContent = this.orders.filter(o =>
      /picked up|on the way|reached customer/i.test(o.RiderStatus || '')
    ).length;

    deliveredCount.textContent = this.orders.filter(o =>
      /delivered/i.test(o.RiderStatus || '')
    ).length;

    orders.innerHTML = list.length
      ? list.map(o => this.card(o)).join('')
      : '<div class="r-empty">Abhi koi assigned delivery nahi hai.</div>';
  },

  mapUrl(lat, lon, address='') {
    if (Number.isFinite(Number(lat)) && Number.isFinite(Number(lon))) {
      return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${Number(lat)},${Number(lon)}`)}`;
    }
    if (address) return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
    return '';
  },


  validCoordinate(lat, lon) {
    const a=Number(lat), b=Number(lon);
    return Number.isFinite(a) && Number.isFinite(b) &&
      Math.abs(a) <= 90 && Math.abs(b) <= 180 &&
      !(Math.abs(a) < 0.0001 && Math.abs(b) < 0.0001);
  },

  openInAppMap(kind, title, address, lat, lon) {
    const targetLat=Number(lat);
    const targetLon=Number(lon);

    if (!this.validCoordinate(targetLat,targetLon)) {
      alert(`${kind} ka exact GPS save nahi hai. Pehle us location ka latitude/longitude save karein.`);
      return;
    }

    this.currentMapTarget={
      kind:String(kind||'Location'),
      title:String(title||kind||'Location'),
      address:String(address||''),
      latitude:targetLat,
      longitude:targetLon
    };

    const modal=document.getElementById('riderMapModal');
    const titleEl=document.getElementById('riderMapTitle');
    const eyebrow=document.getElementById('riderMapEyebrow');
    const addressEl=document.getElementById('riderMapAddress');

    if(titleEl)titleEl.textContent=this.currentMapTarget.title;
    if(eyebrow)eyebrow.textContent=String(kind||'Location').toUpperCase();
    if(addressEl)addressEl.textContent=this.currentMapTarget.address || `${targetLat.toFixed(6)}, ${targetLon.toFixed(6)}`;

    modal?.classList.remove('hidden');
    modal?.setAttribute('aria-hidden','false');
    document.body.classList.add('r-map-open');

    setTimeout(()=>{
      this.ensureInAppMap();
      this.updateInAppRoute();
    },50);
  },

  closeInAppMap() {
    const modal=document.getElementById('riderMapModal');
    modal?.classList.add('hidden');
    modal?.setAttribute('aria-hidden','true');
    document.body.classList.remove('r-map-open');
  },

  ensureInAppMap() {
    if(this.inAppMap){
      setTimeout(()=>this.inAppMap.invalidateSize(),20);
      return this.inAppMap;
    }

    if(typeof L==='undefined')return null;
    const el=document.getElementById('riderInAppMap');
    if(!el)return null;

    this.inAppMap=L.map(el,{zoomControl:true}).setView([25.30,84.86],14);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{
      maxZoom:19,
      attribution:'© OpenStreetMap contributors'
    }).addTo(this.inAppMap);

    return this.inAppMap;
  },

  async updateInAppRoute() {
    const map=this.ensureInAppMap();
    const target=this.currentMapTarget;
    if(!map||!target)return;

    const tLat=Number(target.latitude);
    const tLon=Number(target.longitude);

    if(this.inAppTargetMarker){
      this.inAppTargetMarker.setLatLng([tLat,tLon]);
    }else{
      this.inAppTargetMarker=L.marker([tLat,tLon],{
        title:target.title
      }).addTo(map).bindPopup(`<strong>${this.esc(target.title)}</strong><br>${this.esc(target.address||'')}`);
    }

    let rider=this.currentRiderPosition;

    if(!rider && navigator.geolocation){
      try{
        const pos=await new Promise((resolve,reject)=>{
          navigator.geolocation.getCurrentPosition(resolve,reject,{
            enableHighAccuracy:true,
            maximumAge:0,
            timeout:15000
          });
        });
        rider={
          latitude:Number(pos.coords.latitude),
          longitude:Number(pos.coords.longitude),
          accuracy:Number(pos.coords.accuracy)
        };
        this.currentRiderPosition=rider;
      }catch(_){}
    }

    const gpsStatus=document.getElementById('riderMapGpsStatus');
    if(!rider || !this.validCoordinate(rider.latitude,rider.longitude)){
      if(gpsStatus)gpsStatus.textContent='Turn on precise location to show route';
      map.setView([tLat,tLon],16);
      return;
    }

    if(gpsStatus)gpsStatus.textContent=`GPS ±${Math.round(rider.accuracy||0)}m`;

    const rLat=Number(rider.latitude);
    const rLon=Number(rider.longitude);

    const bikeIcon=L.divIcon({
      className:'rider-bike-marker-wrap',
      html:'<div class="rider-bike-marker"><i class="fa-solid fa-motorcycle"></i></div>',
      iconSize:[42,42],
      iconAnchor:[21,21]
    });

    if(this.inAppRiderMarker){
      this.inAppRiderMarker.setLatLng([rLat,rLon]);
    }else{
      this.inAppRiderMarker=L.marker([rLat,rLon],{icon:bikeIcon}).addTo(map).bindPopup('Your live location');
    }

    const fallbackLine=[[rLat,rLon],[tLat,tLon]];

    try{
      const url=`https://router.project-osrm.org/route/v1/driving/${rLon},${rLat};${tLon},${tLat}?overview=full&geometries=geojson&steps=false`;
      const response=await fetch(url,{cache:'no-store'});
      if(!response.ok)throw new Error('route unavailable');
      const data=await response.json();
      const route=data?.routes?.[0];
      if(!route?.geometry?.coordinates?.length)throw new Error('route unavailable');

      const coords=route.geometry.coordinates.map(([lon,lat])=>[lat,lon]);
      this.inAppRouteCoords=coords;

      if(this.inAppRouteLine){
        this.inAppRouteLine.setLatLngs(coords);
      }else{
        this.inAppRouteLine=L.polyline(coords,{
          weight:6,
          opacity:.9,
          lineCap:'round',
          lineJoin:'round'
        }).addTo(map);
      }

      const distance=document.getElementById('riderMapDistance');
      const km=Number(route.distance||0)/1000;
      const min=Math.max(1,Math.ceil(Number(route.duration||0)/60));
      if(distance)distance.textContent=`${km<1?Math.round(km*1000)+' m':km.toFixed(1)+' km'} · about ${min} min`;

      map.fitBounds(this.inAppRouteLine.getBounds(),{padding:[40,40],maxZoom:17});
    }catch(error){
      if(this.inAppRouteLine){
        this.inAppRouteLine.setLatLngs(fallbackLine);
      }else{
        this.inAppRouteLine=L.polyline(fallbackLine,{
          weight:5,
          opacity:.75,
          dashArray:'8 8'
        }).addTo(map);
      }
      const distance=document.getElementById('riderMapDistance');
      if(distance)distance.textContent='Road route temporarily unavailable';
      map.fitBounds(this.inAppRouteLine.getBounds(),{padding:[40,40],maxZoom:17});
    }
  },

  centerOnRider() {
    if(this.inAppMap && this.currentRiderPosition){
      this.inAppMap.setView([
        Number(this.currentRiderPosition.latitude),
        Number(this.currentRiderPosition.longitude)
      ],17);
    }
  },

  fitCurrentRoute() {
    if(this.inAppMap && this.inAppRouteLine){
      this.inAppMap.fitBounds(this.inAppRouteLine.getBounds(),{padding:[40,40],maxZoom:17});
    }else if(this.currentMapTarget && this.inAppMap){
      this.inAppMap.setView([
        Number(this.currentMapTarget.latitude),
        Number(this.currentMapTarget.longitude)
      ],16);
    }
  },

  routeBlock(o) {
    const rawMode=String(o.FulfillmentMode||'marketplace').trim().toLowerCase();
    const mode=['try-on','try_on','tryon'].includes(rawMode)
      ? 'try_on'
      : (['services','service'].includes(rawMode)
          ? 'service'
          : (rawMode==='food' ? 'food' : (rawMode==='tez' ? 'tez' : 'marketplace')));

    const stops=Array.isArray(o.PickupStops)?o.PickupStops:[];
    const pickup=stops[0]||null;

    const pickupLabel=
      mode==='food'
        ? 'Restaurant Location'
        : mode==='service'
          ? ''
          : 'Seller Location';

    const pickupName=
      mode==='food'
        ? (pickup?.ShopName||pickup?.SellerName||'Restaurant')
        : (pickup?.ShopName||pickup?.SellerName||'Seller');

    const pickupLat=pickup?.Latitude;
    const pickupLon=pickup?.Longitude;
    const customerLat=o.CustomerLatitude;
    const customerLon=o.CustomerLongitude;

    const pickupReady=this.validCoordinate(pickupLat,pickupLon);
    const customerReady=this.validCoordinate(customerLat,customerLon);

    const button=(kind,title,address,lat,lon,label,cls,icon,ready)=>{
      if(!ready){
        return `<button class="r-map-btn ${cls} missing" type="button" disabled title="Exact GPS not saved">
          <i class="fa-solid fa-triangle-exclamation"></i>${label} GPS missing
        </button>`;
      }

      return `<button class="r-map-btn ${cls}" type="button"
        onclick='RiderDashboard.openInAppMap(${JSON.stringify(kind)},${JSON.stringify(title)},${JSON.stringify(address||"")},${Number(lat)},${Number(lon)})'>
        <i class="fa-solid ${icon}"></i>${label}
      </button>`;
    };

    return `<div class="r-route-panel r-route-universal">
      <div class="r-route-heading">
        <div>
          <small>${mode.toUpperCase()} LOCATION</small>
          <strong>In-app navigation</strong>
        </div>
        <span>Button click karte hi exact saved location isi app ke map me khulegi.</span>
      </div>

      <div class="r-route-buttons">
        ${mode!=='service'
          ? button(
              pickupLabel,
              pickupName,
              pickup?.Address||'',
              pickupLat,
              pickupLon,
              pickupLabel,
              'pickup-btn',
              mode==='food'?'fa-utensils':'fa-store',
              pickupReady
            )
          : ''}

        ${button(
          'Customer Location',
          o.CustomerName||'Customer',
          o.DeliveryAddress||'',
          customerLat,
          customerLon,
          'Customer Location',
          'customer-btn',
          'fa-house',
          customerReady
        )}
      </div>

      <div class="r-route-detail">
        ${mode!=='service' ? `
          <div>
            <small>${pickupLabel}</small>
            <strong>${this.esc(pickupName)}</strong>
            <p>${this.esc(pickup?.Address||'Pickup address not saved')}</p>
            <em>${pickupReady ? 'Exact GPS saved' : 'Exact GPS missing'}</em>
          </div>
        ` : ''}
        <div>
          <small>CUSTOMER</small>
          <strong>${this.esc(o.CustomerName||'Customer')}</strong>
          <p>${this.esc(o.DeliveryAddress||'Customer address not saved')}</p>
          <em>${customerReady ? 'Exact GPS saved' : 'Exact GPS missing'}</em>
        </div>
      </div>
    </div>`;
  },


  tryOnFinalizePanel(o) {
    const mode=String(o.FulfillmentMode||'').toLowerCase();
    const reached=String(o.RiderStatus||'').toLowerCase()==='reached customer';
    if(!['try_on','try-on','tryon'].includes(mode)||!reached)return '';

    const items=(o.Items||[]).map(item=>`
      <label class="r-tryon-item">
        <input type="checkbox" class="r-tryon-keep" data-order="${this.esc(o.OrderID)}" value="${this.esc(item.OrderItemID)}" data-amount="${Number(item.Amount||0)}">
        <span><b>${this.esc(item.ProductName)}</b><small>Keep this item · ₹${Number(item.Amount||0).toLocaleString('en-IN')}</small></span>
      </label>
    `).join('');

    return `<div class="r-tryon-finalize">
      <div class="r-tryon-title">
        <div><small>TRY-ON DECISION</small><strong>Customer chooses what to keep</strong></div>
        <span>${Number(o.TryOnTrialMinutes||15)} min trial</span>
      </div>
      <div class="r-tryon-help">Tick only the items the customer is keeping. Unticked items will return with you and go back to inventory.</div>
      <div class="r-tryon-items">${items}</div>
      <div class="r-tryon-summary">
        <span>Try-On visit fee</span><b>₹${Number(o.TryOnVisitFee||0).toLocaleString('en-IN')}</b>
      </div>
      <div class="r-tryon-controls">
        <input inputmode="numeric" maxlength="6" id="tryonOtp_${this.esc(o.OrderID)}" placeholder="Customer 6-digit OTP" oninput="this.value=this.value.replace(/\\D/g,'').slice(0,6)">
        <select id="tryonPay_${this.esc(o.OrderID)}"><option value="cash">Cash collected</option><option value="upi">UPI collected</option></select>
        <button class="r-btn success" type="button" onclick="RiderDashboard.finalizeTryOn('${this.esc(o.OrderID)}')"><i class="fa-solid fa-shirt"></i> Finalize Try-On</button>
      </div>
      <div class="r-otp-message" id="tryonMsg_${this.esc(o.OrderID)}"></div>
    </div>`;
  },

  card(o) {
    const items = (o.Items || [])
      .map(i => `${this.esc(i.ProductName)} × ${Number(i.Qty || 0)}`)
      .join(', ');

    return `<article class="r-order">
      <div class="r-order-head">
        <div>
          <strong>${this.esc(o.OrderID)}</strong>
          ${o.IsTez ? '<span class="r-tez-tag"><i class="fa-solid fa-bolt"></i> Tez</span>' : ''}
          ${['try_on','try-on','tryon'].includes(String(o.FulfillmentMode||'').toLowerCase()) ? '<span class="r-tez-tag"><i class="fa-solid fa-shirt"></i> Try-On</span>' : ''}
        </div>
        <span class="r-status">${this.esc(o.RiderStatus || '')}</span>
      </div>

      ${o.IsTez ? `<div class="r-tez-target">
        <i class="fa-solid fa-bolt"></i>
        Fast delivery target ${Number(o.DeliveryTargetMinMinutes || 0)}–${Number(o.DeliveryTargetMaxMinutes || 0)} min
      </div>
      <div class="r-gps-order-note">
        <i class="fa-solid fa-location-dot"></i>
        Customer live map tabhi chalega jab upar <b>Start Live Location</b> ON ho.
      </div>` : ''}

      ${this.routeBlock(o)}

      <div class="r-order-body">
        <div>
          <p><b>Customer:</b> ${this.esc(o.CustomerName || '')}</p>
          <p><b>Mobile:</b> ${this.esc(o.CustomerMobile || '')}</p>
          <p><b>Items:</b> ${items || '—'}</p>
        </div>

        <div>
          <p><b>Address:</b> ${this.esc(o.DeliveryAddress || '')}</p>
          <p><b>Payment:</b> ${this.esc(o.PaymentMode || 'COD')}</p>
          <p><b>Amount:</b> ₹${Number(o.TotalAmount || 0).toLocaleString('en-IN')}</p>
        </div>
      </div>

      ${this.tryOnFinalizePanel(o)}
      <div class="r-order-actions">
        ${this.actions(o.OrderID, o.RiderStatus, o.FulfillmentMode)}
      </div>
    </article>`;
  },

  actions(id, status, fulfillmentMode='marketplace') {
    const rawMode=String(fulfillmentMode||'marketplace').toLowerCase();
    const mode=['try-on','try_on','tryon'].includes(rawMode)
      ? 'try_on'
      : (['services','service'].includes(rawMode)
          ? 'service'
          : (rawMode==='food' ? 'food' : (rawMode==='tez' ? 'tez' : 'marketplace')));

    const b = (label, next, cls = '') =>
      `<button class="r-btn ${cls}" onclick="RiderDashboard.update('${this.esc(id)}','${next}')">${label}</button>`;

    switch (String(status || '').toLowerCase()) {
      case 'pickup assigned':
        return mode==='service'
          ? b('Service Job स्वीकार करें', 'Pickup Accepted')
          : b(mode==='food' ? 'Restaurant Pickup स्वीकार करें' : 'Pickup स्वीकार करें', 'Pickup Accepted');

      case 'pickup accepted':
        return mode==='service'
          ? b('Customer के लिए निकलें', 'On the Way', 'success')
          : b(mode==='food' ? 'Order ले लिया' : 'सामान ले लिया', 'Picked Up', 'success');

      case 'picked up':
        return b(
          mode==='try_on' ? 'Try-On Visit शुरू करें' : 'Delivery शुरू करें',
          'On the Way',
          'success'
        );

      case 'on the way':
        return b('Customer तक पहुँच गए', 'Reached Customer', 'success');

      case 'reached customer':
        if(mode==='try_on'){
          return '<span class="r-status">Use the Try-On decision panel above to finish this visit.</span>';
        }
        return `
          <div class="r-delivery-otp-card">
            <div class="r-delivery-otp-copy">
              <span class="r-delivery-otp-kicker">
                <i class="fa-solid fa-shield-halved"></i> OTP VERIFICATION REQUIRED
              </span>
              <strong>Customer से 6-digit OTP लें</strong>
              <small>
                सही OTP verify होने के बाद ही
                ${mode==='service' ? 'service Completed' : 'order Delivered'}
                होगा.
              </small>
            </div>

            <div class="r-otp-delivery">
              <input
                inputmode="numeric"
                pattern="[0-9]*"
                autocomplete="one-time-code"
                maxlength="6"
                id="otp_${this.esc(id)}"
                class="r-otp-input"
                placeholder="Enter 6-digit OTP"
                oninput="this.value=this.value.replace(/\\D/g,'').slice(0,6)"
              >
              <button
                type="button"
                class="r-btn success r-otp-submit"
                onclick="RiderDashboard.deliverWithOtp('${this.esc(id)}')"
              >
                <i class="fa-solid fa-circle-check"></i>
                ${mode==='service' ? 'Verify OTP & Complete' : 'Verify OTP & Deliver'}
              </button>
            </div>

            <div class="r-otp-message" id="otpmsg_${this.esc(id)}"></div>
          </div>`;
      default:
        return '<span class="r-status">अभी कोई action नहीं</span>';
    }
  },


  async finalizeTryOn(id) {
    const otp=String(document.getElementById(`tryonOtp_${id}`)?.value||'').replace(/\D/g,'').slice(0,6);
    const msg=document.getElementById(`tryonMsg_${id}`);
    const setMsg=(text,type='')=>{if(msg){msg.className=`r-otp-message ${type}`.trim();msg.textContent=text||'';}};
    if(otp.length!==6){setMsg('Enter the customer 6-digit OTP.','error');return;}

    const allTryItems=[...document.querySelectorAll('.r-tryon-keep')].filter(x=>String(x.dataset.order)===String(id));
    const keep=allTryItems.filter(x=>x.checked).map(x=>x.value);
    const payment=document.getElementById(`tryonPay_${id}`)?.value||'cash';
    const amount=keep.reduce((n,itemId)=>{
      const el=allTryItems.find(x=>x.value===itemId);
      return n+Number(el?.dataset.amount||0);
    },0);
    const order=this.orders.find(x=>String(x.OrderID)===String(id));
    const finalAmount=amount+Number(order?.TryOnVisitFee||0);

    if(!confirm(`Customer is keeping ${keep.length} item(s). Collect ₹${finalAmount.toLocaleString('en-IN')} by ${payment.toUpperCase()} and finalize?`))return;

    setMsg('Finalizing Try-On…','info');
    try{
      const r=await DesiMallAPI.finalizeRiderTryOn(id,{
        KeepOrderItemIDs:keep,DeliveryOTP:otp,CollectionMethod:payment
      },this.session.token||'');
      if(!r?.success)throw new Error(r?.message||'Try-On finalization failed');
      setMsg(r.message||'Try-On completed.','success');
      alert(r.message||'Try-On completed.');
      await this.load();
    }catch(error){
      setMsg(error?.message||'Could not finalize Try-On.','error');
    }
  },

  async deliverWithOtp(id) {
    const input=document.getElementById(`otp_${id}`);
    const msg=document.getElementById(`otpmsg_${id}`);
    const otp=String(input?.value||'').replace(/\D/g,'').slice(0,6);

    const setMsg=(text,type='')=>{
      if(!msg)return;
      msg.className=`r-otp-message ${type}`.trim();
      msg.textContent=text||'';
    };

    if(otp.length!==6){
      setMsg('Please enter the 6-digit OTP shown to the customer.','error');
      input?.focus();
      return;
    }

    const btn=input?.closest('.r-otp-delivery')?.querySelector('.r-otp-submit');
    if(btn){
      btn.disabled=true;
      btn.innerHTML='<i class="fa-solid fa-spinner fa-spin"></i> Verifying...';
    }
    setMsg('OTP verify ho raha hai...','info');

    try{
      const r=await DesiMallAPI.updateRiderOrderStatus(
        id,
        'Delivered',
        this.session.token||'',
        {DeliveryOTP:otp}
      );

      if(r?.success){
        setMsg('OTP verified. Order delivered successfully.','success');
        await this.load();
        return;
      }

      setMsg(r?.message||'Wrong / invalid OTP. Please enter the customer OTP.','error');
    }catch(error){
      setMsg(error?.message||'Wrong / invalid OTP. Please enter the customer OTP.','error');
    }finally{
      if(btn && document.body.contains(btn)){
        btn.disabled=false;
        btn.innerHTML='<i class="fa-solid fa-circle-check"></i> Verify OTP & Deliver';
      }
    }
  },

  async update(id, status) {
    if (!confirm(`${id} ko ${status} mark karein?`)) return;

    try {
      const r = await DesiMallAPI.updateRiderOrderStatus(
        id,
        status,
        this.session.token || ''
      );

      alert(r.message || 'Updated');
      if (r.success) await this.load();
    } catch (error) {
      alert(error?.message || 'Update failed');
    }
  },


  currentTrackableTezOrder() {
    return this.orders.find(o => {
      const status = String(o.RiderStatus || '').toLowerCase();
      const rawMode = String(o.FulfillmentMode || '').toLowerCase();
      const mapMode =
        o.IsTez === true ||
        ['tez','food','service','services','try-on','try_on','tryon'].includes(rawMode);

      return mapMode &&
        /pickup assigned|pickup accepted|picked up|on the way|reached customer/.test(status);
    }) || null;
  },

  setGpsStatus(message, state = '') {
    const box = document.getElementById('gpsStatus');
    const text = document.getElementById('gpsStatusText');
    if (text) text.textContent = message;
    if (box) {
      box.classList.remove('live', 'error');
      if (state) box.classList.add(state);
    }
  },

  syncLiveTracking() {
    const order = this.currentTrackableTezOrder();
    this.geoOrder = order || null;

    if (!order) {
      if (this.geoWatchId !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(this.geoWatchId);
        this.geoWatchId = null;
      }
      this.setGpsStatus('No active Tez delivery');
      if (typeof startGpsBtn !== 'undefined') {
        startGpsBtn.disabled = true;
        startGpsBtn.innerHTML = '<i class="fa-solid fa-location-dot"></i> No Tez delivery';
      }
      return;
    }

    if (typeof startGpsBtn !== 'undefined') {
      startGpsBtn.disabled = false;
      startGpsBtn.innerHTML = '<i class="fa-solid fa-location-crosshairs"></i> Start Live Location';
    }

    // If permission was already granted earlier, restart automatically.
    if (navigator.permissions?.query) {
      navigator.permissions.query({ name: 'geolocation' }).then(result => {
        if (result.state === 'granted' && this.geoWatchId === null) {
          this.startLiveLocation(false);
        } else if (result.state === 'denied') {
          this.setGpsStatus('Location permission blocked', 'error');
        } else if (this.geoWatchId === null) {
          this.setGpsStatus('Tap Start Live Location');
        }
      }).catch(() => {
        if (this.geoWatchId === null) this.setGpsStatus('Tap Start Live Location');
      });
    } else if (this.geoWatchId === null) {
      this.setGpsStatus('Tap Start Live Location');
    }
  },

  startLiveLocation(userInitiated = false) {
    const order = this.currentTrackableTezOrder();

    if (!order) {
      this.setGpsStatus('No active Tez delivery', 'error');
      return;
    }

    if (!navigator.geolocation) {
      this.setGpsStatus('GPS not supported on this device', 'error');
      return;
    }

    this.geoOrder = order;
    this.gpsStartedByUser = this.gpsStartedByUser || userInitiated;

    if (this.geoWatchId !== null) {
      this.setGpsStatus('Live location is on', 'live');
      return;
    }

    this.setGpsStatus('Requesting precise GPS…');

    navigator.geolocation.getCurrentPosition(
      pos => this.pushLiveLocation(pos, true),
      () => {},
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 20000
      }
    );

    this.geoWatchId = navigator.geolocation.watchPosition(
      pos => this.pushLiveLocation(pos, false),
      err => {
        if (this.geoWatchId !== null) {
          navigator.geolocation.clearWatch(this.geoWatchId);
          this.geoWatchId = null;
        }

        const code = Number(err?.code || 0);
        if (code === 1) {
          this.setGpsStatus('Location permission denied', 'error');
        } else if (code === 2) {
          this.setGpsStatus('GPS location unavailable', 'error');
        } else if (code === 3) {
          this.setGpsStatus('GPS timed out — tap Start again', 'error');
        } else {
          this.setGpsStatus(err?.message || 'Could not start live location', 'error');
        }
      },
      {
        enableHighAccuracy: true,
        maximumAge: 3000,
        timeout: 20000
      }
    );
  },

  async pushLiveLocation(position, force = false) {
    if (!this.geoOrder || !position?.coords) return;

    const now = Date.now();
    if (!force && now - this.lastGeoPushAt < 5000) return;

    const accuracy = Number(position.coords.accuracy);
    if (Number.isFinite(accuracy) && accuracy > 1500) {
      this.setGpsStatus(`GPS weak (${Math.round(accuracy)}m). Turn on Precise Location.`, 'error');
      return;
    }

    this.lastGeoPushAt = now;

    this.setGpsStatus('Sending live location…');

    try {
      await DesiMallAPI.updateRiderLiveLocation({
        OrderID: this.geoOrder.OrderID,
        Latitude: position.coords.latitude,
        Longitude: position.coords.longitude,
        Accuracy: position.coords.accuracy,
        Heading: position.coords.heading,
        Speed: position.coords.speed,
        CapturedAt: new Date(position.timestamp || Date.now()).toISOString()
      }, this.session.token || '');

      this.lastLocationAt = Date.now();

      const lat = Number(position.coords.latitude);
      const lon = Number(position.coords.longitude);
      const accuracy = Number(position.coords.accuracy);

      this.currentRiderPosition = {
        latitude: lat,
        longitude: lon,
        accuracy
      };

      if (this.currentMapTarget && document.getElementById('riderMapModal') && !document.getElementById('riderMapModal').classList.contains('hidden')) {
        this.updateInAppRoute();
      }

      this.setGpsStatus(
        `Live GPS ${lat.toFixed(5)}, ${lon.toFixed(5)} · ±${Math.round(accuracy || 0)}m`,
        'live'
      );

      if (typeof startGpsBtn !== 'undefined') {
        startGpsBtn.innerHTML = '<i class="fa-solid fa-location-dot"></i> Location Live';
      }
    } catch (error) {
      console.warn('Live location push failed:', error?.message || error);
      this.setGpsStatus(error?.message || 'Location upload failed', 'error');
    }
  },

  async logout() {
    if (this.geoWatchId !== null && navigator.geolocation) { navigator.geolocation.clearWatch(this.geoWatchId); this.geoWatchId = null; }
    try {
      await DesiMallAPI.riderLogout(this.session.token || '');
    } catch (_) {}

    localStorage.removeItem(this.key);
    location.replace('login.html');
  },

  esc(v) {
    return String(v ?? '').replace(/[&<>'"]/g, c => ({
      '&':'&amp;',
      '<':'&lt;',
      '>':'&gt;',
      "'":'&#39;',
      '"':'&quot;'
    }[c]));
  }
};

document.addEventListener('DOMContentLoaded', () => RiderDashboard.init());
