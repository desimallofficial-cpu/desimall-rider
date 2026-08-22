const RiderDashboard = {
  key: 'desimall_rider_session',
  session: {},
  orders: [],
  geoWatchId: null,
  geoOrder: null,
  lastGeoPushAt: 0,

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
      </div>` : ''}

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
        return b('Delivered', 'Delivered', 'success');

      default:
        return '<span class="r-status">अभी कोई action नहीं</span>';
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
      return o.IsTez && /pickup assigned|pickup accepted|picked up|on the way|reached customer/.test(status);
    }) || null;
  },

  syncLiveTracking() {
    const order = this.currentTrackableTezOrder();

    if (!order) {
      this.geoOrder = null;
      if (this.geoWatchId !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(this.geoWatchId);
        this.geoWatchId = null;
      }
      return;
    }

    this.geoOrder = order;
    if (!navigator.geolocation || this.geoWatchId !== null) return;

    this.geoWatchId = navigator.geolocation.watchPosition(
      pos => this.pushLiveLocation(pos),
      err => console.warn('Rider GPS unavailable:', err?.message || err),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    );
  },

  async pushLiveLocation(position) {
    if (!this.geoOrder || !position?.coords) return;
    const now = Date.now();
    if (now - this.lastGeoPushAt < 8000) return;
    this.lastGeoPushAt = now;

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
    } catch (error) {
      console.warn('Live location push failed:', error?.message || error);
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
