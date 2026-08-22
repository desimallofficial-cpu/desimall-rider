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

  routeBlock(o) {
    const status=String(o.RiderStatus||'').toLowerCase();
    const picked=/picked up|on the way|reached customer|delivered/.test(status);
    const stops=Array.isArray(o.PickupStops)?o.PickupStops:[];

    if(!picked){
      if(!stops.length){
        return `<div class="r-route-panel">
          <div class="r-route-card pickup warning">
            <div>
              <small>PICKUP LOCATION</small>
              <strong>Seller pickup location loading…</strong>
              <p>Refresh once. If this remains, seller pickup data is not available from backend.</p>
            </div>
          </div>
        </div>`;
      }

      const cards=stops.map(s=>{
        const hasGps=Number.isFinite(Number(s.Latitude))&&Number.isFinite(Number(s.Longitude));
        const url=this.mapUrl(s.Latitude,s.Longitude,s.Address);

        return `<div class="r-route-card pickup">
          <div class="r-route-copy">
            <small>PICKUP LOCATION</small>
            <strong>${this.esc(s.ShopName||'Seller')}</strong>
            <p>${this.esc(s.Address|| (hasGps ? 'Precise shop GPS saved' : 'Seller address not available'))}</p>
            <span class="r-route-quality ${hasGps?'precise':'address'}">
              <i class="fa-solid ${hasGps?'fa-location-dot':'fa-map'}"></i>
              ${hasGps?'Precise shop GPS':'Address-based navigation'}
            </span>
          </div>
          ${url
            ? `<a class="r-map-btn" target="_blank" rel="noopener" href="${url}">
                <i class="fa-solid fa-route"></i> Navigate to Seller
              </a>`
            : `<span class="r-route-missing">Seller pickup location not set</span>`}
        </div>`;
      }).join('');

      return `<div class="r-route-panel">${cards}</div>`;
    }

    const customerUrl=this.mapUrl(
      o.CustomerLatitude,
      o.CustomerLongitude,
      o.DeliveryAddress
    );
    const hasCustomerGps=
      Number.isFinite(Number(o.CustomerLatitude)) &&
      Number.isFinite(Number(o.CustomerLongitude));

    return `<div class="r-route-panel">
      <div class="r-route-card delivery">
        <div class="r-route-copy">
          <small>DELIVERY LOCATION</small>
          <strong>${this.esc(o.CustomerName||'Customer')}</strong>
          <p>${this.esc(o.DeliveryAddress||'')}</p>
          <span class="r-route-quality ${hasCustomerGps?'precise':'address'}">
            <i class="fa-solid ${hasCustomerGps?'fa-location-dot':'fa-map'}"></i>
            ${hasCustomerGps?'Precise customer GPS':'Address-based navigation'}
          </span>
        </div>
        ${customerUrl
          ? `<a class="r-map-btn" target="_blank" rel="noopener" href="${customerUrl}">
              <i class="fa-solid fa-route"></i> Navigate to Customer
            </a>`
          : `<span class="r-route-missing">Customer delivery location unavailable</span>`}
      </div>
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

      <div class="r-order-actions">
        ${this.actions(o.OrderID, o.RiderStatus)}
      </div>
    </article>`;
  },

  actions(id, status) {
    const b = (label, next, cls = '') =>
      `<button class="r-btn ${cls}" onclick="RiderDashboard.update('${this.esc(id)}','${next}')">${label}</button>`;

    switch (String(status || '').toLowerCase()) {
      case 'pickup assigned':
        return b('Pickup स्वीकार करें', 'Pickup Accepted');

      case 'pickup accepted':
        return b('सामान ले लिया', 'Picked Up', 'success');

      case 'picked up':
        return b('Delivery शुरू करें', 'On the Way', 'success');

      case 'on the way':
        return b('Customer तक पहुँच गए', 'Reached Customer', 'success');

      case 'reached customer':
        return `
          <div class="r-delivery-otp-card">
            <div class="r-delivery-otp-copy">
              <span class="r-delivery-otp-kicker">
                <i class="fa-solid fa-shield-halved"></i> DELIVERY VERIFICATION
              </span>
              <strong>Customer से 6-digit OTP लें</strong>
              <small>सही OTP verify होने के बाद ही order Delivered होगा.</small>
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
                Verify OTP & Deliver
              </button>
            </div>

            <div class="r-otp-message" id="otpmsg_${this.esc(id)}"></div>
          </div>`;
      default:
        return '<span class="r-status">अभी कोई action नहीं</span>';
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
      const isTez =
        o.IsTez === true ||
        String(o.FulfillmentMode || '').toLowerCase() === 'tez';

      return isTez &&
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

    this.setGpsStatus('Requesting location permission…');

    this.geoWatchId = navigator.geolocation.watchPosition(
      pos => this.pushLiveLocation(pos),
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

  async pushLiveLocation(position) {
    if (!this.geoOrder || !position?.coords) return;

    const now = Date.now();
    if (now - this.lastGeoPushAt < 6000) return;
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
      this.setGpsStatus('Live location is on', 'live');

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
