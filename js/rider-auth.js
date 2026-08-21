const RiderAuth = {
  key: 'desimall_rider_session',

  init() {
    const lt = document.getElementById('loginTab');
    const rt = document.getElementById('registerTab');
    const lf = document.getElementById('loginForm');
    const rf = document.getElementById('registerForm');

    lt.onclick = () => {
      lt.classList.add('active');
      rt.classList.remove('active');
      lf.classList.remove('hidden');
      rf.classList.add('hidden');
      this.msg('');
    };

    rt.onclick = () => {
      rt.classList.add('active');
      lt.classList.remove('active');
      rf.classList.remove('hidden');
      lf.classList.add('hidden');
      this.msg('');
    };

    lf.onsubmit = e => {
      e.preventDefault();
      this.login();
    };

    rf.onsubmit = e => {
      e.preventDefault();
      this.register();
    };

    this.check();
  },

  read() {
    try {
      return JSON.parse(localStorage.getItem(this.key)) || {};
    } catch (_) {
      return {};
    }
  },

  msg(text, good = false) {
    const el = document.getElementById('msg');
    el.textContent = text;
    el.classList.toggle('good', good);
  },

  async check() {
    const s = this.read();
    if (!s.token && !s.refreshToken) return;

    try {
      const r = await DesiMallAPI.riderSession(s.token || '');
      if (r?.success) location.replace('dashboard.html');
    } catch (_) {}
  },

  async login() {
    const btn = document.querySelector('#loginForm button');
    btn.disabled = true;

    try {
      const r = await DesiMallAPI.riderLogin({
        Identifier: document.getElementById('identifier').value.trim(),
        Password: document.getElementById('password').value
      });

      localStorage.setItem(
        this.key,
        JSON.stringify({
          token: r.token,
          refreshToken: r.refreshToken || r.session?.refresh_token || '',
          expiresAt: r.expiresAt || r.session?.expires_at || null,
          rider: r.rider
        })
      );

      location.replace('dashboard.html');
    } catch (error) {
      this.msg(error?.message || 'Login failed');
    } finally {
      btn.disabled = false;
    }
  },

  async register() {
    const btn = document.querySelector('#registerForm button');
    btn.disabled = true;

    try {
      const r = await DesiMallAPI.riderRegister({
        RiderName: rName.value.trim(),
        Mobile: rMobile.value.trim(),
        Email: rEmail.value.trim(),
        VehicleType: rVehicle.value,
        VehicleNumber: rVehicleNo.value.trim(),
        ServicePincode: rPincode.value.trim(),
        Password: rPassword.value
      });

      this.msg(r.message || 'Registration submitted.', true);
      if (r.success) registerForm.reset();
    } catch (error) {
      this.msg(error?.message || 'Registration failed');
    } finally {
      btn.disabled = false;
    }
  }
};

document.addEventListener('DOMContentLoaded', () => RiderAuth.init());
